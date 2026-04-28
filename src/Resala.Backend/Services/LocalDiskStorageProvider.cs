using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System;
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

        public async Task<string> UploadFileAsync(IFormFile file, string directory)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File is empty or null.");

            var storagePath = _configuration.GetValue<string>("Storage:Path");
            if (string.IsNullOrEmpty(storagePath))
            {
                var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                storagePath = Path.Combine(webRootPath, "uploads");
            }
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

            var dateFolder = DateTime.UtcNow.ToString("yyyy\\\\MM\\\\dd");
            var directory = Path.Combine("attachments", dateFolder);

            var storagePath = _configuration.GetValue<string>("Storage:Path");
            if (string.IsNullOrEmpty(storagePath))
            {
                var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                storagePath = Path.Combine(webRootPath, "uploads");
            }
            var uploadsFolder = Path.Combine(storagePath, directory);
            
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var extension = Path.GetExtension(file.FileName);
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            var request = _httpContextAccessor.HttpContext?.Request;
            var baseUrl = $"{request?.Scheme}://{request?.Host}";
            var dateUrlPart = DateTime.UtcNow.ToString("yyyy/MM/dd");
            var fileUrl = $"{baseUrl}/uploads/attachments/{dateUrlPart}/{uniqueFileName}";

            return fileUrl;
        }

        public Task DeleteFileAsync(string fileUrl)
        {
            if (string.IsNullOrEmpty(fileUrl)) return Task.CompletedTask;

            try
            {
                var uri = new Uri(fileUrl);
                var localPath = uri.LocalPath; // e.g., /uploads/profile-pictures/filename.jpg
                
                var storagePath = _configuration.GetValue<string>("Storage:Path");
                if (string.IsNullOrEmpty(storagePath))
                {
                    var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                    storagePath = Path.Combine(webRootPath, "uploads");
                }
                
                // Remove the "/uploads/" part to get the relative path inside the storage directory
                var relativePath = localPath.StartsWith("/uploads/") ? localPath.Substring(9) : localPath.TrimStart('/');
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
    }
}
