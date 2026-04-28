using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace Resala.Backend.Services
{
    public interface IStorageService
    {
        Task<string> UploadFileAsync(IFormFile file, string directory);
        Task<string> UploadAttachmentAsync(IFormFile file);
        Task DeleteFileAsync(string fileUrl);
    }
}
