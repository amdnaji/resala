using Novell.Directory.Ldap;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Resala.Backend.Services
{
    public class LdapService : ILdapService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<LdapService> _logger;

        public LdapService(IConfiguration configuration, ILogger<LdapService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public bool IsEnabled => !string.IsNullOrEmpty(_configuration["LdapSettings:DomainName"]);
        public string AuthMode => _configuration["AuthMode"] ?? "Standalone";

        public async Task<bool> ValidateCredentialsAsync(string username, string password)
        {
            if (!IsEnabled) return false;

            var ldapSettings = _configuration.GetSection("LdapSettings");
            string upnBase = ldapSettings["UpnBase"] ?? string.Empty;
            string domainName = ldapSettings["DomainName"] ?? string.Empty;
            int port = int.Parse(ldapSettings["Port"] ?? "389");
            bool useSsl = bool.Parse(ldapSettings["UseSsl"] ?? "false");
            bool skipCert = bool.Parse(ldapSettings["SkipCertValidation"] ?? "false");

            try
            {
                var options = new LdapConnectionOptions();

                if (useSsl)
                {
                    options.UseSsl();
                    if (skipCert)
                    {
                        options.ConfigureRemoteCertificateValidationCallback((s, cert, chain, err) => true);
                    }
                }

                using (var cn = new LdapConnection(options))
                {
                    _logger.LogInformation("Connecting to {DomainName} on port {Port} (SSL: {UseSsl})...", domainName, port, useSsl);
                    await cn.ConnectAsync(domainName, port);

                    string userPrincipalName = username.Contains("@") ? username : $"{username}@{upnBase}";
                    
                    _logger.LogInformation("Authenticating: {UserPrincipalName}...", userPrincipalName);
                    await cn.BindAsync(userPrincipalName, password);

                    if (cn.Bound)
                    {
                        _logger.LogInformation("LDAP Auth Success for {UserPrincipalName}", userPrincipalName);
                        return true;
                    }
                    
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during LDAP authentication for {Username}", username);
                return false;
            }
        }
    }
}
