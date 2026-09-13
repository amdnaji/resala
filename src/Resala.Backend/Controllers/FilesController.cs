using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Resala.Backend.Data;
using Resala.Backend.Models.DTOs;
using Resala.Backend.Services;

namespace Resala.Backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FilesController : ControllerBase
    {
        private readonly IStorageService _storageService;
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;

        public FilesController(
            IStorageService storageService,
            AppDbContext context,
            IMemoryCache cache)
        {
            _storageService = storageService;
            _context = context;
            _cache = cache;
        }

        private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpPost("upload")]
        [RequestSizeLimit(100_000_000)] // 100MB max limit
        public async Task<IActionResult> UploadAttachment(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            try
            {
                var fileUrl = await _storageService.UploadAttachmentAsync(file);

                // Extract filename to track as pending upload for this user
                var uri = new Uri(fileUrl, UriKind.RelativeOrAbsolute);
                var path = uri.IsAbsoluteUri ? uri.AbsolutePath : fileUrl;
                var fileName = Path.GetFileName(path);

                if (!string.IsNullOrEmpty(fileName))
                {
                    _cache.Set($"pending_att_{fileName}", CurrentUserId, TimeSpan.FromHours(2));
                }

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

        [HttpGet("attachments/{year}/{month}/{day}/{fileName}")]
        public async Task<IActionResult> GetAttachment(string year, string month, string day, string fileName)
        {
            var userId = CurrentUserId;
            var relativePath = $"attachments/{year}/{month}/{day}/{fileName}";

            // Check authorization cache first
            var authCacheKey = $"auth_perm_{userId}_{fileName}";
            if (!_cache.TryGetValue(authCacheKey, out bool isAuthorized))
            {
                // 1. Check if the attachment is saved in the database under a message
                var attachment = await _context.Attachments
                    .Include(a => a.Message)
                        .ThenInclude(m => m.Chat)
                            .ThenInclude(c => c.Participants)
                    .FirstOrDefaultAsync(a => a.FileUrl.Contains(fileName));

                if (attachment != null)
                {
                    // Verify user is an active participant in the chat
                    isAuthorized = attachment.Message.Chat.Participants.Any(p => p.UserId == userId);
                }
                else
                {
                    // 2. Check if this is a pending upload by the current user (e.g. previewing before sending)
                    if (_cache.TryGetValue($"pending_att_{fileName}", out Guid uploaderId) && uploaderId == userId)
                    {
                        isAuthorized = true;
                    }
                }

                if (isAuthorized)
                {
                    _cache.Set(authCacheKey, true, TimeSpan.FromMinutes(10));
                }
            }

            if (!isAuthorized)
            {
                return Forbid();
            }

            // 3. User is authorized: stream directly from storage with full range support (ZERO REDIRECTS, ZERO LEAKAGE)
            var fileResult = await _storageService.GetAttachmentFileAsync(relativePath);
            if (fileResult == null)
            {
                return NotFound("Attachment not found.");
            }

            if (fileResult.Stream != null)
            {
                return File(fileResult.Stream, fileResult.ContentType ?? "application/octet-stream", enableRangeProcessing: true);
            }

            if (!string.IsNullOrEmpty(fileResult.PhysicalPath))
            {
                return PhysicalFile(fileResult.PhysicalPath, fileResult.ContentType ?? "application/octet-stream", enableRangeProcessing: true);
            }

            return NotFound();
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
