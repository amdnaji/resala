using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;

namespace Resala.Backend.Services
{
    public class LocalDiskStorageProvider : IStorageService
    {
        private readonly IWebHostEnvironment _env;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;

        public LocalDiskStorageProvider(
            IWebHostEnvironment env, 
            IHttpContextAccessor httpContextAccessor,
            Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _env = env;
            _httpContextAccessor = httpContextAccessor;
            _configuration = configuration;
        }

        private string GetStorageBasePath()
        {
            var storagePath = _configuration.GetValue<string>("Storage:Path");
            if (string.IsNullOrEmpty(storagePath))
            {
                var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                storagePath = Path.Combine(webRootPath, "uploads");
            }
            return storagePath;
        }

        public async Task<string> UploadFileAsync(IFormFile file, string directory)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File is empty or null.");

            var storagePath = GetStorageBasePath();
            var uploadsFolder = Path.Combine(storagePath, directory);
            
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var uniqueFileName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(file.FileName);
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            var request = _httpContextAccessor.HttpContext?.Request;
            var baseUrl = $"{request?.Scheme}://{request?.Host}";
            var fileUrl = $"{baseUrl}/uploads/{directory}/{uniqueFileName}";

            return fileUrl;
        }

        public async Task<string> UploadAttachmentAsync(IFormFile file)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File is empty or null.");

            // Capture UTC date once for consistency across folder creation and URL generation
            var now = DateTime.UtcNow;
            var year = now.ToString("yyyy", CultureInfo.InvariantCulture);
            var month = now.ToString("MM", CultureInfo.InvariantCulture);
            var day = now.ToString("dd", CultureInfo.InvariantCulture);

            var directory = Path.Combine("attachments", year, month, day);
            var storagePath = GetStorageBasePath();
            var uploadsFolder = Path.Combine(storagePath, directory);
            
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            var request = _httpContextAccessor.HttpContext?.Request;
            var baseUrl = $"{request?.Scheme}://{request?.Host}";
            var dateUrlPart = $"{year}/{month}/{day}";
            var fileUrl = $"{baseUrl}/api/files/attachments/{dateUrlPart}/{uniqueFileName}";

            return fileUrl;
        }

        public Task<StorageFileResult?> GetAttachmentFileAsync(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath)) return Task.FromResult<StorageFileResult?>(null);

            var cleanRelativePath = relativePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var storagePath = GetStorageBasePath();
            var fullPath = Path.Combine(storagePath, cleanRelativePath);

            if (!File.Exists(fullPath))
            {
                return Task.FromResult<StorageFileResult?>(null);
            }

            var extension = Path.GetExtension(fullPath)?.ToLowerInvariant() ?? "";
            var contentType = GetContentType(extension);
            var fileName = Path.GetFileName(fullPath);
            var fileInfo = new FileInfo(fullPath);

            return Task.FromResult<StorageFileResult?>(new StorageFileResult
            {
                PhysicalPath = fullPath,
                ContentType = contentType,
                FileName = fileName,
                FileLength = fileInfo.Length
            });
        }

        public Task DeleteFileAsync(string fileUrl)
        {
            if (string.IsNullOrEmpty(fileUrl)) return Task.CompletedTask;

            try
            {
                var uri = new Uri(fileUrl);
                var localPath = uri.LocalPath;
                
                var storagePath = GetStorageBasePath();
                
                // Remove "/api/files/" or "/uploads/" prefix to get the relative path
                string relativePath;
                if (localPath.StartsWith("/api/files/", StringComparison.OrdinalIgnoreCase))
                {
                    relativePath = localPath.Substring("/api/files/".Length);
                }
                else if (localPath.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
                {
                    relativePath = localPath.Substring("/uploads/".Length);
                }
                else
                {
                    relativePath = localPath.TrimStart('/');
                }

                var filePath = Path.Combine(storagePath, relativePath.Replace('/', Path.DirectorySeparatorChar));
                
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }
            }
            catch (Exception)
            {
                // Ignore delete errors for simplicity, log in production
            }

            return Task.CompletedTask;
        }

        private static string GetContentType(string extension)
        {
            return extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".webp" => "image/webp",
                ".mp3" => "audio/mpeg",
                ".wav" => "audio/wav",
                ".ogg" => "audio/ogg",
                ".mp4" => "video/mp4",
                ".webm" => "video/webm",
                ".pdf" => "application/pdf",
                ".txt" => "text/plain",
                _ => "application/octet-stream"
            };
        }
    }
}
