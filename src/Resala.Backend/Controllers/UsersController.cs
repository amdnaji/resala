using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Resala.Backend.Data;
using Resala.Backend.Models;
using Resala.Backend.Hubs;

namespace Resala.Backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            var user = await _context.Users.FindAsync(CurrentUserId);
            if (user == null) return NotFound();

            return Ok(new UserProfileResponse
            {
                UserId = user.Id,
                Username = user.UserName,
                DisplayName = user.DisplayName,
                Bio = user.Bio,
                ProfilePictureUrl = user.ProfilePictureUrl,
                LastSeenAt = user.LastSeenAt,
                IsOnline = ChatHub.UserConnections.ContainsKey(user.Id.ToString()),
                PreferredLanguage = user.PreferredLanguage
            });
        }

        [HttpPost("profile-picture")]
        public async Task<IActionResult> UploadProfilePicture([FromForm] IFormFile file, [FromServices] Resala.Backend.Services.IStorageService storageService)
        {
            var user = await _context.Users.FindAsync(CurrentUserId);
            if (user == null) return NotFound();

            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = System.IO.Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type.");

            // Optionally delete old profile picture
            if (!string.IsNullOrEmpty(user.ProfilePictureUrl) && user.ProfilePictureUrl.Contains("/uploads/"))
            {
                await storageService.DeleteFileAsync(user.ProfilePictureUrl);
            }

            var fileUrl = await storageService.UploadFileAsync(file, "profiles");

            user.ProfilePictureUrl = fileUrl;
            await _context.SaveChangesAsync();

            return Ok(new { ProfilePictureUrl = user.ProfilePictureUrl });
        }

        [HttpPost("profile-picture-chunk")]
        public async Task<IActionResult> UploadProfilePictureChunk(
            [FromForm] IFormFile chunk,
            [FromForm] string fileName,
            [FromForm] int chunkIndex,
            [FromForm] int totalChunks,
            [FromServices] Resala.Backend.Services.IStorageService storageService,
            [FromServices] Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            var user = await _context.Users.FindAsync(CurrentUserId);
            if (user == null) return NotFound();

            if (chunk == null || chunk.Length == 0)
                return BadRequest("No chunk uploaded.");

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = System.IO.Path.GetExtension(fileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type.");

            var storagePath = configuration.GetValue<string>("Storage:Path");
            string tempUploadsDir;
            if (!string.IsNullOrEmpty(storagePath))
            {
                tempUploadsDir = System.IO.Path.Combine(storagePath, "temp_uploads");
            }
            else
            {
                var webRootPath = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "wwwroot");
                tempUploadsDir = System.IO.Path.Combine(webRootPath, "temp_uploads");
            }

            if (!System.IO.Directory.Exists(tempUploadsDir))
            {
                System.IO.Directory.CreateDirectory(tempUploadsDir);
            }

            // Create a unique directory for this upload session
            var uploadSessionId = $"{CurrentUserId}_{fileName}";
            var sessionDir = System.IO.Path.Combine(tempUploadsDir, uploadSessionId);
            
            if (!System.IO.Directory.Exists(sessionDir))
            {
                System.IO.Directory.CreateDirectory(sessionDir);
            }

            // Save the current chunk
            var chunkPath = System.IO.Path.Combine(sessionDir, $"{chunkIndex}.chunk");
            using (var stream = new System.IO.FileStream(chunkPath, System.IO.FileMode.Create))
            {
                await chunk.CopyToAsync(stream);
            }

            // If this is the last chunk, merge them
            if (chunkIndex == totalChunks - 1)
            {
                var mergedFilePath = System.IO.Path.Combine(tempUploadsDir, $"{Guid.NewGuid()}_{fileName}");
                
                using (var mergedStream = new System.IO.FileStream(mergedFilePath, System.IO.FileMode.Create))
                {
                    for (int i = 0; i < totalChunks; i++)
                    {
                        var currentChunkPath = System.IO.Path.Combine(sessionDir, $"{i}.chunk");
                        if (!System.IO.File.Exists(currentChunkPath))
                        {
                            // Missing chunk, clean up and fail
                            System.IO.Directory.Delete(sessionDir, true);
                            System.IO.File.Delete(mergedFilePath);
                            return BadRequest($"Missing chunk {i}. Upload failed.");
                        }

                        using (var chunkStream = new System.IO.FileStream(currentChunkPath, System.IO.FileMode.Open))
                        {
                            await chunkStream.CopyToAsync(mergedStream);
                        }
                    }
                }

                // Delete the chunks directory
                System.IO.Directory.Delete(sessionDir, true);

                // Now upload the merged file using IStorageService
                string fileUrl;
                using (var mergedStream = new System.IO.FileStream(mergedFilePath, System.IO.FileMode.Open))
                {
                    var formFile = new Microsoft.AspNetCore.Http.FormFile(mergedStream, 0, mergedStream.Length, "file", fileName)
                    {
                        Headers = new Microsoft.AspNetCore.Http.HeaderDictionary(),
                        ContentType = "application/octet-stream"
                    };
                    
                    // Optionally delete old profile picture
                    if (!string.IsNullOrEmpty(user.ProfilePictureUrl) && user.ProfilePictureUrl.Contains("/uploads/"))
                    {
                        await storageService.DeleteFileAsync(user.ProfilePictureUrl);
                    }

                    fileUrl = await storageService.UploadFileAsync(formFile, "profiles");
                }

                // Delete the merged temp file
                System.IO.File.Delete(mergedFilePath);

                user.ProfilePictureUrl = fileUrl;
                await _context.SaveChangesAsync();

                return Ok(new { ProfilePictureUrl = user.ProfilePictureUrl, Completed = true });
            }

            return Ok(new { Completed = false, ChunkIndex = chunkIndex });
        }

        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            var user = await _context.Users.FindAsync(CurrentUserId);
            if (user == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(request.DisplayName))
            {
                user.DisplayName = request.DisplayName;
            }

            if (request.Bio != null)
            {
                user.Bio = request.Bio;
            }

            if (request.ProfilePictureUrl != null)
            {
                user.ProfilePictureUrl = request.ProfilePictureUrl;
            }

            if (request.PreferredLanguage != null)
            {
                user.PreferredLanguage = request.PreferredLanguage;
            }

            await _context.SaveChangesAsync();

            return Ok(new UserProfileResponse
            {
                UserId = user.Id,
                Username = user.UserName,
                DisplayName = user.DisplayName,
                Bio = user.Bio,
                ProfilePictureUrl = user.ProfilePictureUrl,
                LastSeenAt = user.LastSeenAt,
                IsOnline = ChatHub.UserConnections.ContainsKey(user.Id.ToString()),
                PreferredLanguage = user.PreferredLanguage
            });
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string? query)
        {
            var currentUserId = CurrentUserId;

            var queryable = _context.Users.Where(u => u.Id != currentUserId);

            if (!string.IsNullOrWhiteSpace(query))
            {
                queryable = queryable.Where(u => u.UserName!.Contains(query) || (u.DisplayName != null && u.DisplayName.Contains(query)));
            }

            var users = await queryable
                .OrderByDescending(u => u.LastSeenAt)
                .Take(50)
                .ToListAsync();

            var result = users.Select(u => new UserProfileResponse
            {
                UserId = u.Id,
                Username = u.UserName,
                DisplayName = u.DisplayName,
                Bio = u.Bio,
                ProfilePictureUrl = u.ProfilePictureUrl,
                LastSeenAt = u.LastSeenAt,
                IsOnline = ChatHub.UserConnections.ContainsKey(u.Id.ToString()),
                PreferredLanguage = u.PreferredLanguage
            }).ToList();

            return Ok(result);
        }
    }
}
