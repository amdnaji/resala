using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Resala.Backend.Data;
using Resala.Backend.Hubs;
using Resala.Backend.Models;
using Resala.Backend.Models.DTOs;

namespace Resala.Backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatController(AppDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet]
        public async Task<IActionResult> GetMyChats()
        {
            var userId = CurrentUserId;

            var chats = await _context.Chats
                .Include(c => c.Participants).ThenInclude(p => p.User)
                .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
                    .ThenInclude(m => m.Reactions)
                        .ThenInclude(r => r.User)
                .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
                    .ThenInclude(m => m.Attachments)
                .Where(c => c.Participants.Any(p => p.UserId == userId))
                .OrderByDescending(c => c.Messages.Max(m => m.CreatedAt))
                .ToListAsync();

            var result = chats.Select(c => new ChatResponseDto
            {
                Id = c.Id,
                Type = c.Type,
                Title = c.Title,
                ProfilePictureUrl = c.ProfilePictureUrl,
                CreatedAt = c.CreatedAt,
                Participants = c.Participants.Select(p => new ParticipantDto
                {
                    UserId = p.UserId,
                    Username = p.User.UserName!,
                    DisplayName = p.User.DisplayName,
                    Bio = p.User.Bio,
                    ProfilePictureUrl = p.User.ProfilePictureUrl,
                    LastSeenAt = p.User.LastSeenAt,
                    IsOnline = ChatHub.UserConnections.ContainsKey(p.UserId.ToString()),
                    Role = p.Role
                }).ToList(),
                LastMessage = c.Messages.OrderByDescending(m => m.CreatedAt).Select(m => new MessageDto
                {
                    Id = m.Id,
                    ChatId = m.ChatId,
                    SenderId = m.SenderId,
                    SenderName = m.Sender.DisplayName,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    IsRead = m.IsRead,
                    ParentMessageId = m.ParentMessageId,
                    ParentMessageContent = m.ParentMessage != null ? m.ParentMessage.Content : null,
                    ParentMessageSenderName = m.ParentMessage != null ? m.ParentMessage.Sender.DisplayName : null,
                    Reactions = m.Reactions.Select(r => new ReactionDto
                    {
                        UserId = r.UserId,
                        Username = r.User.DisplayName,
                        Emoji = r.Emoji,
                        CreatedAt = r.CreatedAt
                    }).ToList(),
                    Attachments = m.Attachments.Select(a => new AttachmentDto
                    {
                        Id = a.Id,
                        FileUrl = a.FileUrl,
                        FileType = a.FileType,
                        MimeType = a.MimeType,
                        OriginalFileName = a.OriginalFileName,
                        FileSize = a.FileSize
                    }).ToList()
                }).FirstOrDefault(),
                UnreadCount = c.Messages.Count(m => m.SenderId != userId && !m.IsRead)
            }).ToList();

            return Ok(result);
        }

        [HttpPost("private")]
        public async Task<IActionResult> CreateOrGetPrivateChat([FromBody] CreatePrivateChatDto request)
        {
            var userId = CurrentUserId;
            
            if (userId == request.TargetUserId)
                return BadRequest("Cannot create a chat with yourself.");

            // Check if private chat already exists
            var existingChat = await _context.Chats
                .Include(c => c.Participants)
                .Where(c => c.Type == ChatType.Private)
                .Where(c => c.Participants.Any(p => p.UserId == userId) && c.Participants.Any(p => p.UserId == request.TargetUserId))
                .FirstOrDefaultAsync();

            if (existingChat != null)
            {
                return Ok(new { ChatId = existingChat.Id });
            }

            var targetUser = await _context.Users.FindAsync(request.TargetUserId);
            if (targetUser == null) return NotFound("Target user not found.");

            var chat = new Chat { Type = ChatType.Private };
            chat.Participants.Add(new ChatParticipant { UserId = userId });
            chat.Participants.Add(new ChatParticipant { UserId = request.TargetUserId });

            _context.Chats.Add(chat);
            await _context.SaveChangesAsync();

            return Ok(new { ChatId = chat.Id });
        }

        [HttpPost("group")]
        public async Task<IActionResult> CreateGroupChat([FromBody] CreateGroupChatDto request)
        {
            var userId = CurrentUserId;
            
            if (request.ParticipantIds == null || request.ParticipantIds.Count == 0)
                return BadRequest("Group must have participants.");

            var chat = new Chat 
            { 
                Type = ChatType.Group,
                Title = string.IsNullOrWhiteSpace(request.Title) ? "New Group" : request.Title
            };
            
            chat.Participants.Add(new ChatParticipant { UserId = userId, Role = ParticipantRole.Admin });
            
            foreach (var pid in request.ParticipantIds)
            {
                if (pid != userId && await _context.Users.AnyAsync(u => u.Id == pid))
                {
                    chat.Participants.Add(new ChatParticipant { UserId = pid, Role = ParticipantRole.Member });
                }
            }

            if (chat.Participants.Count < 2)
                return BadRequest("Not enough valid participants.");

            _context.Chats.Add(chat);
            await _context.SaveChangesAsync();

            var participantIdsStr = chat.Participants.Select(p => p.UserId.ToString()).ToList();
            await _hubContext.Clients.Users(participantIdsStr).SendAsync("newchatcreated", chat.Id);

            return Ok(new { ChatId = chat.Id });
        }

        [HttpPut("{chatId}")]
        public async Task<IActionResult> UpdateGroupChat(Guid chatId, [FromBody] UpdateGroupDto request)
        {
            var userId = CurrentUserId;
            var chat = await _context.Chats.Include(c => c.Participants).FirstOrDefaultAsync(c => c.Id == chatId);
            
            if (chat == null || chat.Type != ChatType.Group) return NotFound("Group not found.");
            
            var requester = chat.Participants.FirstOrDefault(p => p.UserId == userId);
            if (requester == null || requester.Role != ParticipantRole.Admin)
                return StatusCode(403, "Only admins can update the group.");

            if (!string.IsNullOrWhiteSpace(request.Title))
            {
                var oldTitle = chat.Title;
                chat.Title = request.Title;
                await _context.SaveChangesAsync();

                var pIds = chat.Participants.Select(p => p.UserId.ToString()).ToList();
                await _hubContext.Clients.Users(pIds).SendAsync("groupupdated", chat.Id, request.Title);
                var sender = await _context.Users.FindAsync(userId);
                await _hubContext.Clients.Users(pIds).SendAsync("systemmessage", chat.Id, $"{sender?.DisplayName} changed the group name to \"{request.Title}\".", DateTime.UtcNow);
            }

            if (request.ProfilePictureUrl != null)
            {
                chat.ProfilePictureUrl = request.ProfilePictureUrl;
                await _context.SaveChangesAsync();

                var pIds = chat.Participants.Select(p => p.UserId.ToString()).ToList();
                await _hubContext.Clients.Users(pIds).SendAsync("groupupdated", chat.Id, chat.Title);
            }

            return Ok();
        }

        [HttpPost("{chatId}/participants")]
        public async Task<IActionResult> AddParticipants(Guid chatId, [FromBody] AddParticipantsDto request)
        {
            var userId = CurrentUserId;
            var chat = await _context.Chats.Include(c => c.Participants).FirstOrDefaultAsync(c => c.Id == chatId);
            
            if (chat == null || chat.Type != ChatType.Group) return NotFound("Group not found.");
            
            var requester = chat.Participants.FirstOrDefault(p => p.UserId == userId);
            if (requester == null || requester.Role != ParticipantRole.Admin)
                return StatusCode(403, "Only admins can add participants.");

            bool addedAny = false;
            foreach (var pid in request.ParticipantIds)
            {
                if (!chat.Participants.Any(p => p.UserId == pid) && await _context.Users.AnyAsync(u => u.Id == pid))
                {
                    chat.Participants.Add(new ChatParticipant { UserId = pid, Role = ParticipantRole.Member });
                    addedAny = true;
                }
            }

            if (addedAny)
            {
                await _context.SaveChangesAsync();
                var pIds = chat.Participants.Select(p => p.UserId.ToString()).ToList();
                await _hubContext.Clients.Users(pIds).SendAsync("newchatcreated", chat.Id);

                var sender = await _context.Users.FindAsync(userId);
                await _hubContext.Clients.Users(pIds).SendAsync("systemmessage", chat.Id, $"{sender?.DisplayName} added new members to the group.", DateTime.UtcNow);
            }

            return Ok();
        }

        [HttpDelete("{chatId}/participants/{participantId}")]
        public async Task<IActionResult> RemoveParticipant(Guid chatId, Guid participantId)
        {
            var userId = CurrentUserId;
            var chat = await _context.Chats.Include(c => c.Participants).FirstOrDefaultAsync(c => c.Id == chatId);
            
            if (chat == null || chat.Type != ChatType.Group) return NotFound("Group not found.");
            
            var requester = chat.Participants.FirstOrDefault(p => p.UserId == userId);
            if (requester == null) return StatusCode(403, "You are not a member of this group.");
            
            if (userId != participantId && requester.Role != ParticipantRole.Admin)
            {
                return StatusCode(403, "Only admins can remove other participants.");
            }

            var participantToRemove = chat.Participants.FirstOrDefault(p => p.UserId == participantId);
            if (participantToRemove == null) return NotFound("Participant not found in group.");

            if (chat.Participants.Count <= 2 && userId != participantId)
                return BadRequest("Cannot remove participant. Group must have at least one other member.");

            chat.Participants.Remove(participantToRemove);
            await _context.SaveChangesAsync();

            var pIds = chat.Participants.Select(p => p.UserId.ToString()).ToList();
            pIds.Add(participantId.ToString()); // also notify the removed user so their UI can clear the chat

            await _hubContext.Clients.Users(pIds).SendAsync("userremovedfromgroup", chat.Id, participantId);

            var remover = await _context.Users.FindAsync(userId);
            var removedUser = await _context.Users.FindAsync(participantId);
            
            string msg = userId == participantId 
                ? $"{remover?.DisplayName} left the group." 
                : $"{remover?.DisplayName} removed {removedUser?.DisplayName}.";
                
            await _hubContext.Clients.Users(pIds).SendAsync("systemmessage", chat.Id, msg, DateTime.UtcNow);

            return Ok();
        }

        [HttpGet("{chatId}/messages")]
        public async Task<IActionResult> GetMessages(Guid chatId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            var userId = CurrentUserId;

            var isParticipant = await _context.ChatParticipants
                .AnyAsync(cp => cp.ChatId == chatId && cp.UserId == userId);

            if (!isParticipant) 
            {
                return StatusCode(403, "User is not a participant in this chat.");
            }

            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.ParentMessage).ThenInclude(pm => pm!.Sender)
                .Include(m => m.Reactions).ThenInclude(r => r.User)
                .Include(m => m.Attachments)
                .Where(m => m.ChatId == chatId)
                .OrderByDescending(m => m.CreatedAt) // Newest first for pagination
                .Skip(skip)
                .Take(take)
                .Select(m => new MessageDto
                {
                    Id = m.Id,
                    ChatId = m.ChatId,
                    SenderId = m.SenderId,
                    SenderName = m.Sender.DisplayName,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    IsRead = m.IsRead,
                    ParentMessageId = m.ParentMessageId,
                    ParentMessageContent = m.ParentMessage != null ? m.ParentMessage.Content : null,
                    ParentMessageSenderName = m.ParentMessage != null ? m.ParentMessage.Sender.DisplayName : null,
                    Reactions = m.Reactions.Select(r => new ReactionDto
                    {
                        UserId = r.UserId,
                        Username = r.User.DisplayName,
                        Emoji = r.Emoji,
                        CreatedAt = r.CreatedAt
                    }).ToList(),
                    Attachments = m.Attachments.Select(a => new AttachmentDto
                    {
                        Id = a.Id,
                        FileUrl = a.FileUrl,
                        FileType = a.FileType,
                        MimeType = a.MimeType,
                        OriginalFileName = a.OriginalFileName,
                        FileSize = a.FileSize
                    }).ToList()
                })
                .ToListAsync();

            messages.Reverse(); // Return oldest to newest for UI display

            return Ok(messages);
        }

        [HttpGet("{chatId}/attachments")]
        public async Task<IActionResult> GetChatAttachments(Guid chatId)
        {
            var userId = CurrentUserId;

            var isParticipant = await _context.ChatParticipants
                .AnyAsync(cp => cp.ChatId == chatId && cp.UserId == userId);

            if (!isParticipant)
            {
                return StatusCode(403, "User is not a participant in this chat.");
            }

            // More robust query starting from messages to ensure correct chat filter
            var attachments = await _context.Messages
                .Where(m => m.ChatId == chatId)
                .SelectMany(m => m.Attachments)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new AttachmentDto
                {
                    Id = a.Id,
                    MessageId = a.MessageId,
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    MimeType = a.MimeType,
                    OriginalFileName = a.OriginalFileName,
                    FileSize = a.FileSize,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(attachments);
        }

        [HttpPost("{chatId}/picture")]
        public async Task<IActionResult> UploadGroupPicture(Guid chatId, [FromForm] IFormFile file, [FromServices] Resala.Backend.Services.IStorageService storageService)
        {
            var userId = CurrentUserId;
            var chat = await _context.Chats.Include(c => c.Participants).FirstOrDefaultAsync(c => c.Id == chatId);
            
            if (chat == null || chat.Type != ChatType.Group) return NotFound("Group not found.");
            
            var requester = chat.Participants.FirstOrDefault(p => p.UserId == userId);
            if (requester == null || requester.Role != ParticipantRole.Admin)
                return StatusCode(403, "Only admins can change the group picture.");

            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = System.IO.Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type.");

            // Optionally delete old picture
            if (!string.IsNullOrEmpty(chat.ProfilePictureUrl) && chat.ProfilePictureUrl.Contains("/uploads/"))
            {
                await storageService.DeleteFileAsync(chat.ProfilePictureUrl);
            }

            var fileUrl = await storageService.UploadFileAsync(file, "groups");

            chat.ProfilePictureUrl = fileUrl;
            await _context.SaveChangesAsync();

            var pIds = chat.Participants.Select(p => p.UserId.ToString()).ToList();
            await _hubContext.Clients.Users(pIds).SendAsync("groupupdated", chat.Id, chat.Title);
            
            var sender = await _context.Users.FindAsync(userId);
            await _hubContext.Clients.Users(pIds).SendAsync("systemmessage", chat.Id, $"{sender?.DisplayName} changed the group picture.", DateTime.UtcNow);

            return Ok(new { ProfilePictureUrl = chat.ProfilePictureUrl });
        }
    }
}
