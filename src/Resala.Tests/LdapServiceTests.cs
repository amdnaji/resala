using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Resala.Backend.Services;
using Xunit;

namespace Resala.Tests
{
    public class LdapServiceTests
    {
        private readonly Mock<IConfiguration> _mockConfig;
        private readonly Mock<ILogger<LdapService>> _mockLogger;

        public LdapServiceTests()
        {
            _mockConfig = new Mock<IConfiguration>();
            _mockLogger = new Mock<ILogger<LdapService>>();
        }

        [Fact]
        public void IsEnabled_ReturnsTrue_WhenDomainNameIsSet()
        {
            // Arrange
            _mockConfig.Setup(c => c["LdapSettings:DomainName"]).Returns("example.com");
            var service = new LdapService(_mockConfig.Object, _mockLogger.Object);

            // Act
            var result = service.IsEnabled;

            // Assert
            Assert.True(result);
        }

        [Fact]
        public void IsEnabled_ReturnsFalse_WhenDomainNameIsEmpty()
        {
            // Arrange
            _mockConfig.Setup(c => c["LdapSettings:DomainName"]).Returns("");
            var service = new LdapService(_mockConfig.Object, _mockLogger.Object);

            // Act
            var result = service.IsEnabled;

            // Assert
            Assert.False(result);
        }

        [Fact]
        public void AuthMode_ReturnsLDAP_WhenConfigured()
        {
            // Arrange
            _mockConfig.Setup(c => c["AuthMode"]).Returns("LDAP");
            var service = new LdapService(_mockConfig.Object, _mockLogger.Object);

            // Act
            var result = service.AuthMode;

            // Assert
            Assert.Equal("LDAP", result);
        }

        [Fact]
        public void AuthMode_ReturnsStandalone_ByDefault()
        {
            // Arrange
            _mockConfig.Setup(c => c["AuthMode"]).Returns((string)null);
            var service = new LdapService(_mockConfig.Object, _mockLogger.Object);

            // Act
            var result = service.AuthMode;

            // Assert
            Assert.Equal("Standalone", result);
        }
    }
}
