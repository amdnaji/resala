using System.Text;
using Resala.Backend.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Add Configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

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
builder.Services.AddScoped<Resala.Backend.Services.IStorageService, Resala.Backend.Services.LocalDiskStorageProvider>();
builder.Services.AddScoped<Resala.Backend.Services.ILdapService, Resala.Backend.Services.LdapService>();
builder.Services.AddSignalR();
builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173", "http://127.0.0.1:5173",
            "http://localhost:5174", "http://127.0.0.1:5174"
        )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

var storagePath = builder.Configuration.GetValue<string>("Storage:Path");
if (!string.IsNullOrEmpty(storagePath))
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
}
else
{
    app.UseStaticFiles();
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

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<Resala.Backend.Data.AppDbContext>();
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

app.Run();
