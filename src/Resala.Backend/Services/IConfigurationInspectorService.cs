namespace Resala.Backend.Services
{
    public class ConfigurationSourceInfo
    {
        public string Key { get; set; } = string.Empty;
        public string? Value { get; set; }
        public string SourceType { get; set; } = string.Empty; // "AppSettings", "UserSecrets", "CustomConfig", "Environment", "CommandLine", "NotSet"
        public string ProviderName { get; set; } = string.Empty;
        public bool IsMasked { get; set; }
    }

    public interface IConfigurationInspectorService
    {
        ConfigurationSourceInfo GetSourceInfo(string key, bool maskSensitive = true);
        Dictionary<string, ConfigurationSourceInfo> GetAppConfigurationSources();
        bool IsCustomConfigFilePresent();
        string GetCustomConfigFilePath();
    }
}
