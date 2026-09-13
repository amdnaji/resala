using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Resala.Backend.Services;
using System;
using System.Collections.Generic;
using Xunit;

namespace Resala.Tests
{
    public class StorageServiceTests
    {
        [Fact]
        public void AzureBlobStorageProvider_Throws_WhenConnectionStringMissing()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>())
                .Build();

            var mockLogger = new Mock<ILogger<AzureBlobStorageProvider>>();

            Assert.Throws<InvalidOperationException>(() => new AzureBlobStorageProvider(config, mockLogger.Object));
        }

        [Fact]
        public void AzureBlobStorageProvider_Initializes_WithValidConnectionString()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "Storage:Azure:ConnectionString", "DefaultEndpointsProtocol=https;AccountName=testacc;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;EndpointSuffix=core.windows.net" },
                    { "Storage:Azure:ContainerName", "resala-test-container" },
                    { "Storage:Azure:SasExpiryDays", "180" }
                })
                .Build();

            var mockLogger = new Mock<ILogger<AzureBlobStorageProvider>>();

            var provider = new AzureBlobStorageProvider(config, mockLogger.Object);
            Assert.NotNull(provider);
        }

        [Theory]
        [InlineData("LocalStorage", typeof(LocalDiskStorageProvider))]
        [InlineData("", typeof(LocalDiskStorageProvider))]
        [InlineData("AzureBlob", typeof(AzureBlobStorageProvider))]
        public void DependencyInjection_ResolvesCorrectProvider(string providerName, Type expectedType)
        {
            var inMemorySettings = new Dictionary<string, string?>
            {
                { "Storage:Provider", providerName },
                { "Storage:Azure:ConnectionString", "DefaultEndpointsProtocol=https;AccountName=testacc;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;EndpointSuffix=core.windows.net" }
            };

            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            var services = new ServiceCollection();
            services.AddSingleton<IConfiguration>(configuration);
            services.AddLogging();
            services.AddHttpContextAccessor();

            var mockEnv = new Mock<IWebHostEnvironment>();
            mockEnv.Setup(e => e.WebRootPath).Returns("wwwroot");
            services.AddSingleton(mockEnv.Object);

            var storageProvider = configuration.GetValue<string>("Storage:Provider") ?? "LocalStorage";
            if (storageProvider.Equals("AzureBlob", StringComparison.OrdinalIgnoreCase))
            {
                services.AddScoped<IStorageService, AzureBlobStorageProvider>();
            }
            else
            {
                services.AddScoped<IStorageService, LocalDiskStorageProvider>();
            }

            var serviceProvider = services.BuildServiceProvider();
            using var scope = serviceProvider.CreateScope();
            var storageService = scope.ServiceProvider.GetRequiredService<IStorageService>();

            Assert.IsType(expectedType, storageService);
        }

        [Fact]
        public async Task AzureBlobStorageProvider_UploadAndGetAttachmentFile_Succeeds()
        {
            var connectionString = Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                // Skip integration test when running without local/CI secret configured
                return;
            }

            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "Storage:Azure:ConnectionString", connectionString },
                    { "Storage:Azure:ContainerName", "files" },
                    { "Storage:Azure:SasExpiryDays", "1" }
                })
                .Build();

            var mockLogger = new Mock<ILogger<AzureBlobStorageProvider>>();
            var provider = new AzureBlobStorageProvider(config, mockLogger.Object);

            var expectedContent = $"Azure Gatekeeper Test - {Guid.NewGuid()} - {DateTime.UtcNow:O}";
            var bytes = System.Text.Encoding.UTF8.GetBytes(expectedContent);

            using var memoryStream = new System.IO.MemoryStream(bytes);
            var formFile = new FormFile(memoryStream, 0, bytes.Length, "file", "gatekeeper_test.txt")
            {
                Headers = new HeaderDictionary(),
                ContentType = "text/plain"
            };

            // 1. Upload returns protected gatekeeper URL
            var fileUrl = await provider.UploadAttachmentAsync(formFile);
            Assert.NotNull(fileUrl);
            Assert.Contains("/api/files/attachments/", fileUrl);

            // 2. Extract relative path: attachments/YYYY/MM/DD/filename
            var match = System.Text.RegularExpressions.Regex.Match(fileUrl, @"attachments/(\d{4})/(\d{2})/(\d{2})/(.+)");
            Assert.True(match.Success);
            var relativePath = match.Value;

            // 3. Get direct stream from Azure without any redirect
            var fileResult = await provider.GetAttachmentFileAsync(relativePath);
            Assert.NotNull(fileResult);
            Assert.NotNull(fileResult.Stream);
            Assert.Equal("text/plain", fileResult.ContentType);

            // 4. Read content from stream directly
            using var reader = new System.IO.StreamReader(fileResult.Stream);
            var downloadedContent = await reader.ReadToEndAsync();
            Assert.Equal(expectedContent, downloadedContent);

            // 5. Clean up
            await provider.DeleteFileAsync(fileUrl);
        }

        [Fact]
        public async Task LocalDiskStorageProvider_UploadAndGetAttachmentFile_Succeeds()
        {
            var tempDir = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "resala_test_storage_" + Guid.NewGuid());
            System.IO.Directory.CreateDirectory(tempDir);

            try
            {
                var config = new ConfigurationBuilder()
                    .AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        { "Storage:Path", tempDir }
                    })
                    .Build();

                var mockEnv = new Mock<IWebHostEnvironment>();
                mockEnv.Setup(e => e.WebRootPath).Returns(tempDir);

                var mockContextAccessor = new Mock<IHttpContextAccessor>();
                var httpContext = new DefaultHttpContext();
                httpContext.Request.Scheme = "https";
                httpContext.Request.Host = new HostString("localhost:5001");
                mockContextAccessor.Setup(a => a.HttpContext).Returns(httpContext);

                var provider = new LocalDiskStorageProvider(mockEnv.Object, mockContextAccessor.Object, config);

                var expectedContent = $"Local Gatekeeper Test - {Guid.NewGuid()}";
                var bytes = System.Text.Encoding.UTF8.GetBytes(expectedContent);

                using var memoryStream = new System.IO.MemoryStream(bytes);
                var formFile = new FormFile(memoryStream, 0, bytes.Length, "file", "local_test.txt")
                {
                    Headers = new HeaderDictionary(),
                    ContentType = "text/plain"
                };

                // 1. Upload returns protected gatekeeper URL
                var fileUrl = await provider.UploadAttachmentAsync(formFile);
                Assert.NotNull(fileUrl);
                Assert.StartsWith("https://localhost:5001/api/files/attachments/", fileUrl);

                // 2. Extract relative path
                var match = System.Text.RegularExpressions.Regex.Match(fileUrl, @"attachments/(\d{4})/(\d{2})/(\d{2})/(.+)");
                Assert.True(match.Success);
                var relativePath = match.Value;

                // 3. Get file result (Physical file)
                var fileResult = await provider.GetAttachmentFileAsync(relativePath);
                Assert.NotNull(fileResult);
                Assert.NotNull(fileResult.PhysicalPath);
                Assert.True(System.IO.File.Exists(fileResult.PhysicalPath));
                Assert.Equal("text/plain", fileResult.ContentType);

                // 4. Verify content
                var readContent = await System.IO.File.ReadAllTextAsync(fileResult.PhysicalPath);
                Assert.Equal(expectedContent, readContent);

                // 5. Clean up
                await provider.DeleteFileAsync(fileUrl);
                Assert.False(System.IO.File.Exists(fileResult.PhysicalPath));
            }
            finally
            {
                if (System.IO.Directory.Exists(tempDir))
                {
                    try { System.IO.Directory.Delete(tempDir, true); } catch { }
                }
            }
        }
    }
}
