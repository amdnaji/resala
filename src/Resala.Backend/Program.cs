using System.Text;
using Resala.Backend.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Configure Cascading Configuration Pipeline:
// appsettings.json -> appsettings.{Env}.json -> User Secrets (Dev) -> appsettings.config.json (Outside Git) -> Environment Variables
builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true);

if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>(optional: true);
}

var customConfigPath = Environment.GetEnvironmentVariable("RESALA_CONFIG_PATH")
    ?? Path.Combine(builder.Environment.ContentRootPath, "appsettings.config.json");

builder.Configuration.AddJsonFile(customConfigPath, optional: true, reloadOnChange: true);
builder.Configuration.AddEnvironmentVariables();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Database=resala_chat;Username=postgres;Password=admin";

// 2. Add Database Context
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString)
           .UseSnakeCaseNamingConvention());

// 3. Add Identity Cookie Authentication
builder.Services.AddAuthorization();

builder.Services.AddIdentityApiEndpoints<Resala.Backend.Models.User>()
    .AddEntityFrameworkStores<AppDbContext>();

builder.Services.AddTransient<Microsoft.AspNetCore.Identity.IEmailSender<Resala.Backend.Models.User>, Resala.Backend.Services.FakeEmailSender>();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.None; // Required for cross-origin cross-site auth in dev
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // Required if SameSite=None
    
    // Return 401 instead of redirecting to login page for API
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
});

// 4. Add Services & SignalR
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();

var storageProvider = builder.Configuration.GetValue<string>("Storage:Provider") ?? "LocalStorage";
Console.WriteLine($"[Storage Service] Active Provider configured: '{storageProvider}'");
if (storageProvider.Equals("AzureBlob", StringComparison.OrdinalIgnoreCase))
{
    Console.WriteLine("[Storage Service] Registering AzureBlobStorageProvider.");
    builder.Services.AddScoped<Resala.Backend.Services.IStorageService, Resala.Backend.Services.AzureBlobStorageProvider>();
}
else
{
    Console.WriteLine("[Storage Service] Registering LocalDiskStorageProvider.");
    builder.Services.AddScoped<Resala.Backend.Services.IStorageService, Resala.Backend.Services.LocalDiskStorageProvider>();
}

builder.Services.AddScoped<Resala.Backend.Services.ILdapService, Resala.Backend.Services.LdapService>();
builder.Services.AddScoped<Resala.Backend.Services.IConfigurationInspectorService, Resala.Backend.Services.ConfigurationInspectorService>();
builder.Services.AddScoped<Resala.Backend.Services.ISetupService, Resala.Backend.Services.SetupService>();
builder.Services.AddHostedService<Resala.Backend.Services.StunHostedService>();
builder.Services.AddSingleton<Resala.Backend.Services.ICallSessionTracker, Resala.Backend.Services.InMemoryCallSessionTracker>();
builder.Services.AddSignalR();
builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Serve SPA static files from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Serve user uploads from configured storage path (optional)
var storagePath = builder.Configuration.GetValue<string>("Storage:Path");
if (!string.IsNullOrWhiteSpace(storagePath))
{
    try
    {
        if (!Directory.Exists(storagePath))
        {
            Directory.CreateDirectory(storagePath);
        }
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(storagePath),
            RequestPath = "/uploads"
        });
        Console.WriteLine($"[Storage] File storage successfully initialized at: {storagePath}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Storage Warning] Failed to initialize storage directory '{storagePath}': {ex.Message}. File storage will be disabled.");
    }
}
else
{
    Console.WriteLine("[Storage] Storage:Path is empty or null. File storage is disabled.");
}

app.UseCors("AllowAll");
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// Custom auth controller handles /api/auth/login and /api/auth/register

app.MapGet("/api/auth/latest-reset-link", () => 
{
    return Results.Ok(new { link = Resala.Backend.Services.FakeEmailSender.LastResetLink });
});

app.MapHub<Resala.Backend.Hubs.ChatHub>("/hubs/chat");

// Fallback to index.html for client-side SPA routing (React Router)
app.MapFallbackToFile("index.html");

try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<Resala.Backend.Data.AppDbContext>();
    if (db.Database.CanConnect())
    {
        var users = db.Users.Where(u => !u.EmailConfirmed).ToList();
        if (users.Any())
        {
            foreach (var u in users) u.EmailConfirmed = true;
            db.SaveChanges();
            Console.WriteLine($"[DevTask] Auto-confirmed {users.Count} users.");
        }

        // Auto-set DisplayName for users who have it empty
        var usersWithoutDisplayName = db.Users.Where(u => u.DisplayName == null || u.DisplayName == "").ToList();
        if (usersWithoutDisplayName.Any())
        {
            foreach (var u in usersWithoutDisplayName)
            {
                u.DisplayName = u.Email?.Split('@')[0] ?? u.UserName?.Split('@')[0] ?? "User";
            }
            db.SaveChanges();
            Console.WriteLine($"[DevTask] Auto-set DisplayName for {usersWithoutDisplayName.Count} users.");
        }
    }
    else
    {
        Console.WriteLine("[Setup] Database is not currently reachable. The setup wizard is ready at /setup");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"[Setup] Database initialization check deferred: {ex.Message}");
}

app.Run();
