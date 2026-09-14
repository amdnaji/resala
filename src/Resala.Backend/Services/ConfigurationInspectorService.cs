using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.Json;
using Microsoft.Extensions.Configuration.EnvironmentVariables;
using Microsoft.Extensions.Configuration.CommandLine;
using System.Text.RegularExpressions;

namespace Resala.Backend.Services
{
    public class ConfigurationInspectorService : IConfigurationInspectorService
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;

        public ConfigurationInspectorService(IConfiguration configuration, IWebHostEnvironment env)
        {
            _configuration = configuration;
            _env = env;
        }

        public string GetCustomConfigFilePath()
        {
            var envPath = Environment.GetEnvironmentVariable("RESALA_CONFIG_PATH");
            if (!string.IsNullOrWhiteSpace(envPath))
            {
                return envPath;
            }
            return Path.Combine(_env.ContentRootPath, "appsettings.config.json");
        }

        public bool IsCustomConfigFilePresent()
        {
            return File.Exists(GetCustomConfigFilePath());
        }

        public ConfigurationSourceInfo GetSourceInfo(string key, bool maskSensitive = true)
        {
            var result = new ConfigurationSourceInfo
            {
                Key = key,
                Value = _configuration[key],
                SourceType = "NotSet",
                ProviderName = "None",
                IsMasked = false
            };

            if (_configuration is IConfigurationRoot root)
            {
                // Inspect providers in reverse order (highest precedence first)
                foreach (var provider in root.Providers.Reverse())
                {
                    if (provider.TryGet(key, out var value))
                    {
                        result.Value = value;
                        ClassifyProvider(provider, result);
                        break;
                    }
                }
            }

            if (maskSensitive && !string.IsNullOrEmpty(result.Value))
            {
                if (IsSensitiveKey(key))
                {
                    result.Value = MaskValue(key, result.Value);
                    result.IsMasked = true;
                }
            }

            return result;
        }

        public Dictionary<string, ConfigurationSourceInfo> GetAppConfigurationSources()
        {
            var keysToCheck = new[]
            {
                "ConnectionStrings:DefaultConnection",
                "Storage:Provider",
                "Storage:Path",
                "Storage:Azure:ConnectionString",
                "Storage:Azure:ContainerName",
                "Storage:Azure:SasExpiryDays",
                "AuthMode",
                "LdapSettings:DomainName",
                "LdapSettings:UpnBase",
                "LdapSettings:Port",
                "LdapSettings:UseSsl",
                "LdapSettings:SkipCertValidation",
                "StunSettings:Enabled",
                "StunSettings:Port",
                "Setup:Completed"
            };

            var dict = new Dictionary<string, ConfigurationSourceInfo>(StringComparer.OrdinalIgnoreCase);
            foreach (var k in keysToCheck)
            {
                dict[k] = GetSourceInfo(k, maskSensitive: true);
            }

            return dict;
        }

        private void ClassifyProvider(IConfigurationProvider provider, ConfigurationSourceInfo info)
        {
            var typeName = provider.GetType().Name;

            if (provider is FileConfigurationProvider fileProvider)
            {
                var path = fileProvider.Source.Path ?? string.Empty;
                var fileName = Path.GetFileName(path);

                if (fileName.Equals("appsettings.config.json", StringComparison.OrdinalIgnoreCase) ||
                    fileName.Contains(".config.json", StringComparison.OrdinalIgnoreCase))
                {
                    info.SourceType = "CustomConfig";
                    info.ProviderName = $"appsettings.config.json";
                }
                else if (fileName.Equals("secrets.json", StringComparison.OrdinalIgnoreCase) ||
                         path.Contains("UserSecrets", StringComparison.OrdinalIgnoreCase))
                {
                    info.SourceType = "UserSecrets";
                    info.ProviderName = "User Secrets (secrets.json)";
                }
                else if (fileName.StartsWith("appsettings.", StringComparison.OrdinalIgnoreCase) ||
                         fileName.Equals("appsettings.json", StringComparison.OrdinalIgnoreCase))
                {
                    info.SourceType = "AppSettings";
                    info.ProviderName = fileName;
                }
                else
                {
                    info.SourceType = "File";
                    info.ProviderName = fileName;
                }
            }
            else if (provider is EnvironmentVariablesConfigurationProvider)
            {
                info.SourceType = "Environment";
                info.ProviderName = "Environment Variable";
            }
            else if (provider is CommandLineConfigurationProvider)
            {
                info.SourceType = "CommandLine";
                info.ProviderName = "Command Line Arguments";
            }
            else
            {
                info.SourceType = "Other";
                info.ProviderName = typeName;
            }
        }

        private static bool IsSensitiveKey(string key)
        {
            return key.Contains("Password", StringComparison.OrdinalIgnoreCase) ||
                   key.Contains("Secret", StringComparison.OrdinalIgnoreCase) ||
                   key.Contains("DefaultConnection", StringComparison.OrdinalIgnoreCase) ||
                   key.Contains("Azure:ConnectionString", StringComparison.OrdinalIgnoreCase);
        }

        private static string MaskValue(string key, string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return value;

            // If it's a PostgreSQL / ADO.NET connection string, mask the password portion
            if (key.Contains("Connection", StringComparison.OrdinalIgnoreCase))
            {
                var masked = Regex.Replace(value, "(?i)(Password|pwd)=([^;]+)", "$1=********");
                return masked;
            }

            if (value.Length <= 4) return "****";
            return string.Concat(value.AsSpan(0, 2), "******", value.AsSpan(value.Length - 2));
        }
    }
}
