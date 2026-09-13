using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.Threading.Tasks;

namespace Resala.Backend.Services
{
    public class StorageFileResult
    {
        public Stream? Stream { get; set; }
        public string? PhysicalPath { get; set; }
        public string? ContentType { get; set; }
        public string? FileName { get; set; }
        public long? FileLength { get; set; }
    }

    public interface IStorageService
    {
        bool IsConfigured { get; }
        Task<string> UploadFileAsync(IFormFile file, string directory);
        Task<string> UploadAttachmentAsync(IFormFile file);
        Task DeleteFileAsync(string fileUrl);
        Task<StorageFileResult?> GetAttachmentFileAsync(string relativePath);
    }
}
