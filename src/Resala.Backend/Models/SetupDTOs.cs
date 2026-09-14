using System.ComponentModel.DataAnnotations;
using Resala.Backend.Services;

namespace Resala.Backend.Models
{
    public class TestDatabaseRequest
    {
        public string? Host { get; set; } = "localhost";
        public int Port { get; set; } = 5432;
        public string? Database { get; set; } = "resala_chat";
        public string? Username { get; set; } = "postgres";
        public string? Password { get; set; }
        public string? SslMode { get; set; } = "Prefer";
        public string? RawConnectionString { get; set; }
    }

    public class TestStorageRequest
    {
        public string Provider { get; set; } = "LocalStorage"; // "LocalStorage" or "AzureBlob"
        public string? Path { get; set; }
        public string? AzureConnectionString { get; set; }
        public string? AzureContainerName { get; set; } = "files";
        public int? SasExpiryDays { get; set; } = 365;
    }

    public class TestLdapRequest
    {
        public string DomainName { get; set; } = string.Empty;
        public string? UpnBase { get; set; }
        public int Port { get; set; } = 389;
        public bool UseSsl { get; set; } = false;
        public bool SkipCertValidation { get; set; } = true;
        public string? TestUsername { get; set; }
        public string? TestPassword { get; set; }
    }

    public class AdminUserSetupDTO
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(6)]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string DisplayName { get; set; } = string.Empty;
    }

    public class SaveSetupRequest
    {
        // Database
        public TestDatabaseRequest Database { get; set; } = new();

        // Storage
        public TestStorageRequest Storage { get; set; } = new();

        // Auth
        public string AuthMode { get; set; } = "Standalone"; // "Standalone" or "LDAP"
        public TestLdapRequest? LdapSettings { get; set; }

        // Initial Super Admin (required if Standalone)
        public AdminUserSetupDTO? AdminUser { get; set; }
    }

    public class TestResultDTO
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? Details { get; set; }
    }

    public class SetupStatusResponse
    {
        public bool IsSetupCompleted { get; set; }
        public bool CanConnectToDatabase { get; set; }
        public bool CustomConfigFileExists { get; set; }
        public string CustomConfigFilePath { get; set; } = string.Empty;
        public ConfigurationSourceInfo? DatabaseSource { get; set; }
        public ConfigurationSourceInfo? StorageSource { get; set; }
        public ConfigurationSourceInfo? AuthModeSource { get; set; }
        public Dictionary<string, ConfigurationSourceInfo> AllSources { get; set; } = new();
        public CurrentConfigSummary CurrentConfig { get; set; } = new();
    }

    public class CurrentConfigSummary
    {
        public string DatabaseHost { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public string DatabaseUsername { get; set; } = string.Empty;
        public string StorageProvider { get; set; } = string.Empty;
        public string StoragePath { get; set; } = string.Empty;
        public string AzureContainerName { get; set; } = string.Empty;
        public string AuthMode { get; set; } = string.Empty;
        public string LdapDomain { get; set; } = string.Empty;
    }
}
