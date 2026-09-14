using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Moq;
using Resala.Backend.Services;
using System.Collections.Generic;
using System.IO;
using Xunit;

namespace Resala.Tests
{
    public class ConfigurationInspectorTests
    {
        [Fact]
        public void MaskValue_Masks_Password_In_ConnectionString()
        {
            var envMock = new Mock<IWebHostEnvironment>();
            envMock.Setup(e => e.ContentRootPath).Returns(Directory.GetCurrentDirectory());

            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "ConnectionStrings:DefaultConnection", "Host=localhost;Database=testdb;Username=postgres;Password=supersecretpass" },
                    { "AuthMode", "Standalone" }
                })
                .Build();

            var inspector = new ConfigurationInspectorService(config, envMock.Object);
            var info = inspector.GetSourceInfo("ConnectionStrings:DefaultConnection", maskSensitive: true);

            Assert.True(info.IsMasked);
            Assert.DoesNotContain("supersecretpass", info.Value);
            Assert.Contains("Password=********", info.Value);
        }

        [Fact]
        public void GetSourceInfo_Identifies_Unset_Keys()
        {
            var envMock = new Mock<IWebHostEnvironment>();
            envMock.Setup(e => e.ContentRootPath).Returns(Directory.GetCurrentDirectory());

            var config = new ConfigurationBuilder().Build();
            var inspector = new ConfigurationInspectorService(config, envMock.Object);

            var info = inspector.GetSourceInfo("NonExistentKey");
            Assert.Equal("NotSet", info.SourceType);
            Assert.Null(info.Value);
        }

        [Fact]
        public void GetCustomConfigFilePath_Honors_Environment_Variable()
        {
            var envMock = new Mock<IWebHostEnvironment>();
            envMock.Setup(e => e.ContentRootPath).Returns(@"C:\app");

            var config = new ConfigurationBuilder().Build();
            var inspector = new ConfigurationInspectorService(config, envMock.Object);

            var defaultPath = inspector.GetCustomConfigFilePath();
            Assert.Contains("appsettings.config.json", defaultPath);

            try
            {
                Environment.SetEnvironmentVariable("RESALA_CONFIG_PATH", @"/custom/path/resala.json");
                var customPath = inspector.GetCustomConfigFilePath();
                Assert.Equal(@"/custom/path/resala.json", customPath);
            }
            finally
            {
                Environment.SetEnvironmentVariable("RESALA_CONFIG_PATH", null);
            }
        }
    }
}
