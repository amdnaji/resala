using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;

namespace Resala.Backend.Services
{
    public class AzureBlobStorageProvider : IStorageService
    {
        private readonly BlobContainerClient _containerClient;
        private readonly string _containerName;
        private readonly int _sasExpiryDays;
        private readonly ILogger<AzureBlobStorageProvider> _logger;
        private readonly IHttpContextAccessor? _httpContextAccessor;
        private bool _containerInitialized = false;

        public AzureBlobStorageProvider(
            IConfiguration configuration,
            ILogger<AzureBlobStorageProvider> logger,
            IHttpContextAccessor? httpContextAccessor = null)
        {
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;

            var connectionString = configuration.GetValue<string>("Storage:Azure:ConnectionString")
                                ?? configuration.GetConnectionString("AzureStorage")
                                ?? throw new InvalidOperationException("Azure Storage ConnectionString is not configured.");

            _containerName = configuration.GetValue<string>("Storage:Azure:ContainerName") ?? "resala-files";
            _sasExpiryDays = configuration.GetValue<int?>("Storage:Azure:SasExpiryDays") ?? 365;

            var blobServiceClient = new BlobServiceClient(connectionString);
            _containerClient = blobServiceClient.GetBlobContainerClient(_containerName);
        }

        public bool IsConfigured => _containerClient != null;

        private async Task EnsureContainerExistsAsync()
        {
            if (_containerInitialized) return;

            try
            {
                await _containerClient.CreateIfNotExistsAsync();
                _containerInitialized = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not create Azure Blob container '{ContainerName}' automatically (it may already exist or account lacks create permissions). Proceeding...", _containerName);
                _containerInitialized = true;
            }
        }

        public async Task<string> UploadFileAsync(IFormFile file, string directory)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File is empty or null.", nameof(file));

            await EnsureContainerExistsAsync();

            var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var normalizedDirectory = (directory ?? string.Empty).Trim('/').Replace('\\', '/');
            var blobPath = string.IsNullOrEmpty(normalizedDirectory) 
                ? uniqueFileName 
                : $"{normalizedDirectory}/{uniqueFileName}";

            var blobClient = _containerClient.GetBlobClient(blobPath);

            var options = new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = file.ContentType
                }
            };

            await using (var stream = file.OpenReadStream())
            {
                await blobClient.UploadAsync(stream, options);
            }

            return GenerateReadUrl(blobClient, blobPath);
        }

        public async Task<string> UploadAttachmentAsync(IFormFile file)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File is empty or null.", nameof(file));

            await EnsureContainerExistsAsync();

            var now = DateTime.UtcNow;
            var year = now.ToString("yyyy", CultureInfo.InvariantCulture);
            var month = now.ToString("MM", CultureInfo.InvariantCulture);
            var day = now.ToString("dd", CultureInfo.InvariantCulture);

            var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";
            var blobPath = $"attachments/{year}/{month}/{day}/{uniqueFileName}";

            var blobClient = _containerClient.GetBlobClient(blobPath);

            var options = new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = file.ContentType
                }
            };

            await using (var stream = file.OpenReadStream())
            {
                await blobClient.UploadAsync(stream, options);
            }

            // Return protected gatekeeper endpoint instead of direct long-lived SAS URL
            var request = _httpContextAccessor?.HttpContext?.Request;
            var baseUrl = request != null ? $"{request.Scheme}://{request.Host}" : "";
            var dateUrlPart = $"{year}/{month}/{day}";
            return $"{baseUrl}/api/files/attachments/{dateUrlPart}/{uniqueFileName}";
        }

        public async Task<StorageFileResult?> GetAttachmentFileAsync(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath)) return null;

            await EnsureContainerExistsAsync();

            var cleanBlobPath = relativePath.TrimStart('/').Replace('\\', '/');
            var blobClient = _containerClient.GetBlobClient(cleanBlobPath);

            var exists = await blobClient.ExistsAsync();
            if (!exists.Value)
            {
                return null;
            }

            var properties = await blobClient.GetPropertiesAsync();
            var stream = await blobClient.OpenReadAsync();

            return new StorageFileResult
            {
                Stream = stream,
                ContentType = properties.Value.ContentType,
                FileName = Path.GetFileName(cleanBlobPath),
                FileLength = properties.Value.ContentLength
            };
        }

        public async Task DeleteFileAsync(string fileUrl)
        {
            if (string.IsNullOrWhiteSpace(fileUrl)) return;

            try
            {
                await EnsureContainerExistsAsync();

                var uri = new Uri(fileUrl);
                var path = uri.AbsolutePath.TrimStart('/');
                var containerPrefix = $"{_containerName}/";

                string blobName;
                if (path.StartsWith("api/files/", StringComparison.OrdinalIgnoreCase))
                {
                    blobName = path.Substring("api/files/".Length);
                }
                else if (path.StartsWith(containerPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    blobName = path.Substring(containerPrefix.Length);
                }
                else
                {
                    var slashIndex = path.IndexOf('/');
                    blobName = slashIndex >= 0 ? path.Substring(slashIndex + 1) : path;
                }

                blobName = Uri.UnescapeDataString(blobName);
                var blobClient = _containerClient.GetBlobClient(blobName);
                await blobClient.DeleteIfExistsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete blob at url '{FileUrl}'.", fileUrl);
            }
        }

        private string GenerateReadUrl(BlobClient blobClient, string blobPath)
        {
            if (blobClient.CanGenerateSasUri)
            {
                var sasBuilder = new BlobSasBuilder
                {
                    BlobContainerName = _containerName,
                    BlobName = blobPath,
                    Resource = "b",
                    StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5), // Clock skew compensation
                    ExpiresOn = DateTimeOffset.UtcNow.AddDays(_sasExpiryDays)
                };

                sasBuilder.SetPermissions(BlobSasPermissions.Read);

                return blobClient.GenerateSasUri(sasBuilder).ToString();
            }

            return blobClient.Uri.ToString();
        }
    }
}
