using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Resala.Backend.Services;
using Resala.Backend.Models.DTOs;

namespace Resala.Backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FilesController : ControllerBase
    {
        private readonly IStorageService _storageService;

        public FilesController(IStorageService storageService)
        {
            _storageService = storageService;
        }

        [HttpPost("upload")]
        [RequestSizeLimit(100_000_000)] // 100MB max limit
        public async Task<IActionResult> UploadAttachment(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            try
            {
                var fileUrl = await _storageService.UploadAttachmentAsync(file);

                var dto = new AttachmentDto
                {
                    FileUrl = fileUrl,
                    OriginalFileName = file.FileName,
                    FileSize = file.Length,
                    MimeType = file.ContentType,
                    FileType = DetermineFileType(file.ContentType)
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        private string DetermineFileType(string mimeType)
        {
            if (string.IsNullOrEmpty(mimeType)) return "document";
            if (mimeType.StartsWith("image/")) return "image";
            if (mimeType.StartsWith("video/")) return "video";
            if (mimeType.StartsWith("audio/")) return "audio";
            return "document";
        }
    }
}
