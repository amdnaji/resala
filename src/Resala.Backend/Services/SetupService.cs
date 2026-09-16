using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Novell.Directory.Ldap;
using Npgsql;
using Resala.Backend.Data;
using Resala.Backend.Models;
using System.Text.Json;

namespace Resala.Backend.Services
{
    public class SetupService : ISetupService
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;
        private readonly IConfigurationInspectorService _inspector;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SetupService> _logger;

        public SetupService(
            IConfiguration configuration,
            IWebHostEnvironment env,
            IConfigurationInspectorService inspector,
            IServiceProvider serviceProvider,
            ILogger<SetupService> logger)
        {
            _configuration = configuration;
            _env = env;
            _inspector = inspector;
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task<SetupStatusResponse> GetStatusAsync()
        {
            var isCompleted = _configuration.GetValue<bool>("Setup:Completed");
            var connStr = _configuration.GetConnectionString("DefaultConnection");

            // Direct check on appsettings.config.json if in-memory configuration has not picked it up yet
            if (!isCompleted && _inspector.IsCustomConfigFilePresent())
            {
                try
                {
                    var filePath = _inspector.GetCustomConfigFilePath();
                    if (File.Exists(filePath))
                    {
                        var jsonText = File.ReadAllText(filePath);
                        using var doc = JsonDocument.Parse(jsonText);
                        if (doc.RootElement.TryGetProperty("Setup", out var setupProp) &&
                            setupProp.TryGetProperty("Completed", out var completedProp))
                        {
                            isCompleted = completedProp.GetBoolean();
                        }
                        if (doc.RootElement.TryGetProperty("ConnectionStrings", out var connProp) &&
                            connProp.TryGetProperty("DefaultConnection", out var defConn))
                        {
                            var customConn = defConn.GetString();
                            if (!string.IsNullOrWhiteSpace(customConn))
                            {
                                connStr = customConn;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to read custom config directly in GetStatusAsync");
                }
            }

            bool canConnectDb = false;
            if (!string.IsNullOrWhiteSpace(connStr))
            {
                try
                {
                    await using var conn = new NpgsqlConnection(connStr);
                    await conn.OpenAsync();
                    canConnectDb = true;
                }
                catch
                {
                    canConnectDb = false;
                }
            }

            var sources = _inspector.GetAppConfigurationSources();

            // Extract safe summary
            var summary = new CurrentConfigSummary();
            if (!string.IsNullOrWhiteSpace(connStr))
            {
                try
                {
                    var builder = new NpgsqlConnectionStringBuilder(connStr);
                    summary.DatabaseHost = builder.Host ?? "";
                    summary.DatabaseName = builder.Database ?? "";
                    summary.DatabaseUsername = builder.Username ?? "";
                }
                catch
                {
                    summary.DatabaseHost = "configured (raw)";
                }
            }

            summary.StorageProvider = _configuration.GetValue<string>("Storage:Provider") ?? "LocalStorage";
            summary.StoragePath = _configuration.GetValue<string>("Storage:Path") ?? "";
            summary.AzureContainerName = _configuration.GetValue<string>("Storage:Azure:ContainerName") ?? "files";
            summary.AuthMode = _configuration.GetValue<string>("AuthMode") ?? "Standalone";
            summary.LdapDomain = _configuration.GetValue<string>("LdapSettings:DomainName") ?? "";

            return new SetupStatusResponse
            {
                IsSetupCompleted = isCompleted && canConnectDb,
                CanConnectToDatabase = canConnectDb,
                CustomConfigFileExists = _inspector.IsCustomConfigFilePresent(),
                CustomConfigFilePath = _inspector.GetCustomConfigFilePath(),
                DatabaseSource = sources.GetValueOrDefault("ConnectionStrings:DefaultConnection"),
                StorageSource = sources.GetValueOrDefault("Storage:Provider"),
                AuthModeSource = sources.GetValueOrDefault("AuthMode"),
                AllSources = sources,
                CurrentConfig = summary
            };
        }

        public async Task<TestResultDTO> TestDatabaseAsync(TestDatabaseRequest request)
        {
            var targetDb = string.IsNullOrWhiteSpace(request.Database) ? "resala_chat" : request.Database;
            string connStr = BuildConnectionString(request);

            try
            {
                await using var conn = new NpgsqlConnection(connStr);
                await conn.OpenAsync();

                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT version();";
                var version = (await cmd.ExecuteScalarAsync())?.ToString();

                return new TestResultDTO
                {
                    Success = true,
                    Message = $"Successfully connected to database '{targetDb}'.",
                    Details = version
                };
            }
            catch (PostgresException ex) when (ex.SqlState == "3D000") // Database does not exist
            {
                _logger.LogInformation("Database '{TargetDb}' does not exist. Testing PostgreSQL server reachability via 'postgres' default database...", targetDb);

                try
                {
                    var adminConnStr = BuildAdminConnectionString(request, "postgres");
                    await using var adminConn = new NpgsqlConnection(adminConnStr);
                    await adminConn.OpenAsync();

                    await using var cmd = adminConn.CreateCommand();
                    cmd.CommandText = "SELECT version();";
                    var version = (await cmd.ExecuteScalarAsync())?.ToString();

                    return new TestResultDTO
                    {
                        Success = true,
                        Message = $"PostgreSQL server credentials verified! Database '{targetDb}' does not exist yet and will be created automatically upon initialization.",
                        Details = version
                    };
                }
                catch (Exception adminEx)
                {
                    _logger.LogWarning(adminEx, "Server connection test failed against admin database");
                    return new TestResultDTO
                    {
                        Success = false,
                        Message = $"PostgreSQL server authentication or reachability failed: {adminEx.Message}",
                        Details = adminEx.Message
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TestDatabase failed");
                return new TestResultDTO
                {
                    Success = false,
                    Message = $"Database connection failed: {ex.Message}",
                    Details = ex.Message
                };
            }
        }

        public async Task<TestResultDTO> TestStorageAsync(TestStorageRequest request)
        {
            try
            {
                if (request.Provider.Equals("AzureBlob", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(request.AzureConnectionString))
                    {
                        return new TestResultDTO
                        {
                            Success = false,
                            Message = "Azure Blob Storage Connection String is required."
                        };
                    }

                    var containerName = string.IsNullOrWhiteSpace(request.AzureContainerName) ? "files" : request.AzureContainerName;
                    var blobServiceClient = new BlobServiceClient(request.AzureConnectionString);
                    var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
                    await containerClient.CreateIfNotExistsAsync();

                    return new TestResultDTO
                    {
                        Success = true,
                        Message = $"Successfully connected to Azure Blob Storage container '{containerName}'."
                    };
                }
                else
                {
                    // Local Storage
                    var path = request.Path;
                    if (string.IsNullOrWhiteSpace(path))
                    {
                        path = Path.Combine(_env.ContentRootPath, "storage");
                    }
                    else if (!Path.IsPathRooted(path))
                    {
                        path = Path.GetFullPath(Path.Combine(_env.ContentRootPath, path));
                    }

                    Directory.CreateDirectory(path);

                    // Test write permission
                    var testFile = Path.Combine(path, $".test_write_{Guid.NewGuid():N}.tmp");
                    await File.WriteAllTextAsync(testFile, "resala-storage-test");
                    if (File.Exists(testFile))
                    {
                        File.Delete(testFile);
                    }

                    return new TestResultDTO
                    {
                        Success = true,
                        Message = $"Storage path '{path}' is writable and verified."
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TestStorage failed");
                return new TestResultDTO
                {
                    Success = false,
                    Message = $"Storage verification failed: {ex.Message}"
                };
            }
        }

        public async Task<TestResultDTO> TestLdapAsync(TestLdapRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.DomainName))
            {
                return new TestResultDTO
                {
                    Success = false,
                    Message = "LDAP Domain Name / Server IP is required."
                };
            }

            try
            {
                var options = new LdapConnectionOptions();
                if (request.UseSsl)
                {
                    options.UseSsl();
                    if (request.SkipCertValidation)
                    {
                        options.ConfigureRemoteCertificateValidationCallback((s, c, ch, err) => true);
                    }
                }

                using var cn = new LdapConnection(options);
                await cn.ConnectAsync(request.DomainName, request.Port);

                if (!string.IsNullOrWhiteSpace(request.TestUsername) && !string.IsNullOrWhiteSpace(request.TestPassword))
                {
                    string upn = request.TestUsername.Contains('@')
                        ? request.TestUsername
                        : $"{request.TestUsername}@{request.UpnBase}";

                    await cn.BindAsync(upn, request.TestPassword);
                    if (cn.Bound)
                    {
                        return new TestResultDTO
                        {
                            Success = true,
                            Message = $"LDAP bind succeeded for user '{upn}'."
                        };
                    }
                }

                return new TestResultDTO
                {
                    Success = true,
                    Message = $"LDAP server at {request.DomainName}:{request.Port} is reachable."
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TestLdap failed");
                return new TestResultDTO
                {
                    Success = false,
                    Message = $"LDAP connection failed: {ex.Message}"
                };
            }
        }

        public async Task<TestResultDTO> SaveSetupAsync(SaveSetupRequest request)
        {
            // 1. Validate Database
            var dbTest = await TestDatabaseAsync(request.Database);
            if (!dbTest.Success)
            {
                return new TestResultDTO
                {
                    Success = false,
                    Message = $"Cannot save: Database validation failed. {dbTest.Message}"
                };
            }

            // 2. Validate Storage
            var storageTest = await TestStorageAsync(request.Storage);
            if (!storageTest.Success)
            {
                return new TestResultDTO
                {
                    Success = false,
                    Message = $"Cannot save: Storage validation failed. {storageTest.Message}"
                };
            }

            // 3. Validate LDAP if selected
            if (request.AuthMode.Equals("LDAP", StringComparison.OrdinalIgnoreCase) && request.LdapSettings != null)
            {
                var ldapTest = await TestLdapAsync(request.LdapSettings);
                if (!ldapTest.Success)
                {
                    return new TestResultDTO
                    {
                        Success = false,
                        Message = $"Cannot save: LDAP validation failed. {ldapTest.Message}"
                    };
                }
            }

            // 4. Validate Admin User if Standalone
            if (request.AuthMode.Equals("Standalone", StringComparison.OrdinalIgnoreCase))
            {
                if (request.AdminUser == null || string.IsNullOrWhiteSpace(request.AdminUser.Email) || string.IsNullOrWhiteSpace(request.AdminUser.Password))
                {
                    return new TestResultDTO
                    {
                        Success = false,
                        Message = "An initial Admin Email and Password are required for Standalone mode."
                    };
                }
            }

            try
            {
                var connString = BuildConnectionString(request.Database);
                var resolvedStoragePath = request.Storage.Path;
                if (request.Storage.Provider.Equals("LocalStorage", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(resolvedStoragePath))
                    {
                        resolvedStoragePath = Path.Combine(_env.ContentRootPath, "storage");
                    }
                }

                // 5. Build Config JSON
                var configPayload = new Dictionary<string, object?>
                {
                    ["ConnectionStrings"] = new Dictionary<string, string>
                    {
                        ["DefaultConnection"] = connString
                    },
                    ["Storage"] = new Dictionary<string, object?>
                    {
                        ["Provider"] = request.Storage.Provider,
                        ["Path"] = resolvedStoragePath ?? "",
                        ["Azure"] = new Dictionary<string, object?>
                        {
                            ["ConnectionString"] = request.Storage.AzureConnectionString ?? "",
                            ["ContainerName"] = string.IsNullOrWhiteSpace(request.Storage.AzureContainerName) ? "files" : request.Storage.AzureContainerName,
                            ["SasExpiryDays"] = request.Storage.SasExpiryDays ?? 365
                        }
                    },
                    ["AuthMode"] = request.AuthMode,
                    ["LdapSettings"] = new Dictionary<string, object?>
                    {
                        ["DomainName"] = request.LdapSettings?.DomainName ?? "",
                        ["UpnBase"] = request.LdapSettings?.UpnBase ?? "",
                        ["Port"] = request.LdapSettings?.Port ?? 389,
                        ["UseSsl"] = request.LdapSettings?.UseSsl ?? false,
                        ["SkipCertValidation"] = request.LdapSettings?.SkipCertValidation ?? true
                    },
                    ["Setup"] = new Dictionary<string, object?>
                    {
                        ["Completed"] = true,
                        ["ConfiguredAt"] = DateTime.UtcNow.ToString("o")
                    }
                };

                // 6. Write atomically to appsettings.config.json
                var targetFile = _inspector.GetCustomConfigFilePath();
                var dir = Path.GetDirectoryName(targetFile);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                var tempFile = $"{targetFile}.tmp";
                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var jsonString = JsonSerializer.Serialize(configPayload, jsonOptions);

                await File.WriteAllTextAsync(tempFile, jsonString);
                File.Move(tempFile, targetFile, overwrite: true);
                _logger.LogInformation("Successfully saved configuration to {TargetFile}", targetFile);

                // 7. Reload Configuration
                if (_configuration is IConfigurationRoot root)
                {
                    root.Reload();
                }

                // 8. Ensure database exists, then apply EF Core Migrations
                await EnsureDatabaseCreatedAsync(request.Database);

                _logger.LogInformation("Applying EF Core migrations on {ConnString}", connString);
                var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
                optionsBuilder.UseNpgsql(connString).UseSnakeCaseNamingConvention();

                await using (var dbContext = new AppDbContext(optionsBuilder.Options))
                {
                    await dbContext.Database.MigrateAsync();
                }

                // 9. Seed Initial Admin if Standalone
                if (request.AuthMode.Equals("Standalone", StringComparison.OrdinalIgnoreCase) && request.AdminUser != null)
                {
                    using var scope = _serviceProvider.CreateScope();
                    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
                    var existingAdmin = await userManager.FindByEmailAsync(request.AdminUser.Email);

                    if (existingAdmin == null)
                    {
                        var admin = new User
                        {
                            UserName = request.AdminUser.Email,
                            Email = request.AdminUser.Email,
                            DisplayName = string.IsNullOrWhiteSpace(request.AdminUser.DisplayName) ? "Admin" : request.AdminUser.DisplayName,
                            EmailConfirmed = true
                        };

                        var result = await userManager.CreateAsync(admin, request.AdminUser.Password);
                        if (!result.Succeeded)
                        {
                            var err = string.Join("; ", result.Errors.Select(e => e.Description));
                            _logger.LogWarning("Admin user creation issue: {Err}", err);
                            return new TestResultDTO
                            {
                                Success = false,
                                Message = $"Settings saved and database migrated, but admin account creation had errors: {err}"
                            };
                        }
                    }
                }

                return new TestResultDTO
                {
                    Success = true,
                    Message = "Setup successfully completed! Database created/migrated and configurations saved to appsettings.config.json."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to complete setup");
                return new TestResultDTO
                {
                    Success = false,
                    Message = $"Failed to save configuration: {ex.Message}",
                    Details = ex.ToString()
                };
            }
        }

        private async Task EnsureDatabaseCreatedAsync(TestDatabaseRequest request)
        {
            var targetDb = string.IsNullOrWhiteSpace(request.Database) ? "resala_chat" : request.Database;

            // Connect to server using default administrative database "postgres"
            var adminConnStr = BuildAdminConnectionString(request, "postgres");
            await using var conn = new NpgsqlConnection(adminConnStr);
            await conn.OpenAsync();

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT 1 FROM pg_database WHERE datname = @dbName;";
            cmd.Parameters.AddWithValue("dbName", targetDb);
            var exists = await cmd.ExecuteScalarAsync();

            if (exists == null)
            {
                _logger.LogInformation("Database '{TargetDb}' does not exist. Creating it...", targetDb);
                var sanitizedDb = targetDb.Replace("\"", "\"\"");
                await using var createCmd = conn.CreateCommand();
                createCmd.CommandText = $"CREATE DATABASE \"{sanitizedDb}\";";
                await createCmd.ExecuteNonQueryAsync();
                _logger.LogInformation("Database '{TargetDb}' created successfully.", targetDb);
            }
        }

        private static string BuildAdminConnectionString(TestDatabaseRequest request, string adminDb = "postgres")
        {
            if (!string.IsNullOrWhiteSpace(request.RawConnectionString))
            {
                var b = new NpgsqlConnectionStringBuilder(request.RawConnectionString)
                {
                    Database = adminDb,
                    Timeout = 5,
                    CommandTimeout = 10
                };
                return b.ConnectionString;
            }

            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = string.IsNullOrWhiteSpace(request.Host) ? "localhost" : request.Host,
                Port = request.Port <= 0 ? 5432 : request.Port,
                Database = adminDb,
                Username = string.IsNullOrWhiteSpace(request.Username) ? "postgres" : request.Username,
                Password = request.Password ?? "",
                Timeout = 5,
                CommandTimeout = 10
            };

            if (!string.IsNullOrWhiteSpace(request.SslMode) && Enum.TryParse<SslMode>(request.SslMode, true, out var mode))
            {
                builder.SslMode = mode;
            }

            return builder.ConnectionString;
        }

        private static string BuildConnectionString(TestDatabaseRequest request)
        {
            if (!string.IsNullOrWhiteSpace(request.RawConnectionString))
            {
                return request.RawConnectionString;
            }

            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = string.IsNullOrWhiteSpace(request.Host) ? "localhost" : request.Host,
                Port = request.Port <= 0 ? 5432 : request.Port,
                Database = string.IsNullOrWhiteSpace(request.Database) ? "resala_chat" : request.Database,
                Username = string.IsNullOrWhiteSpace(request.Username) ? "postgres" : request.Username,
                Password = request.Password ?? "",
                Timeout = 5,
                CommandTimeout = 10
            };

            if (!string.IsNullOrWhiteSpace(request.SslMode) && Enum.TryParse<SslMode>(request.SslMode, true, out var mode))
            {
                builder.SslMode = mode;
            }

            return builder.ConnectionString;
        }
    }
}
