using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Resala.Backend.Data;
using Resala.Backend.Models;
using Resala.Backend.Models.DTOs;

namespace Resala.Backend.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;
        // Map UserId string -> HashSet of ConnectionIds (handles multiple tabs)
        public static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> UserConnections = new();

        public ChatHub(AppDbContext context)
        {
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var userIdStr = Context.UserIdentifier;
            if (userIdStr != null)
            {
                var userConns = UserConnections.GetOrAdd(userIdStr, _ => new ConcurrentDictionary<string, byte>());
                userConns.TryAdd(Context.ConnectionId, 0);

                if (Guid.TryParse(userIdStr, out var userId))
                {
                    // Update user last seen
                    var user = await _context.Users.FindAsync(userId);
                    if (user != null)
                    {
                        user.LastSeenAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                    }
                }

                // Notify others user is online
                // Notify others user is online (using both casings just in case)
                await Clients.Others.SendAsync("UserStatusChanged", userIdStr, true, DateTime.UtcNow);
                await Clients.Others.SendAsync("userstatuschanged", userIdStr, true, DateTime.UtcNow);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userIdStr = Context.UserIdentifier;
            if (userIdStr != null)
            {
                if (UserConnections.TryGetValue(userIdStr, out var userConns))
                {
                    userConns.TryRemove(Context.ConnectionId, out _);
                    
                    if (userConns.IsEmpty)
                    {
                        UserConnections.TryRemove(userIdStr, out _);
                        
                        if (Guid.TryParse(userIdStr, out var userId))
                        {
                            var user = await _context.Users.FindAsync(userId);
                            if (user != null)
                            {
                                user.LastSeenAt = DateTime.UtcNow;
                                await _context.SaveChangesAsync();
                            }
                        }
                        
                        // Notify others user is offline
                        // Notify others user is offline
                        await Clients.Others.SendAsync("UserStatusChanged", userIdStr, false, DateTime.UtcNow);
                        await Clients.Others.SendAsync("userstatuschanged", userIdStr, false, DateTime.UtcNow);
                    }
                }
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(string chatId, string content, string? parentMessageId = null, List<AttachmentDto>? attachments = null)
        {
            var senderId = Context.UserIdentifier;
            bool hasContent = !string.IsNullOrWhiteSpace(content);
            bool hasAttachments = attachments != null && attachments.Any();
            
            if (string.IsNullOrWhiteSpace(senderId) || (!hasContent && !hasAttachments)) return;
            
            var chatIdGuid = Guid.Parse(chatId);
            var senderIdGuid = Guid.Parse(senderId);
            Guid? parentIdGuid = string.IsNullOrEmpty(parentMessageId) ? null : Guid.Parse(parentMessageId);

            // Find all participants to broadcast to
            var participantIds = await _context.ChatParticipants
                .Where(cp => cp.ChatId == chatIdGuid)
                .Select(cp => cp.UserId.ToString())
                .ToListAsync();
                
            var isParticipant = participantIds.Contains(senderId);
            if (!isParticipant) return;

            var message = new Message
            {
                ChatId = chatIdGuid,
                SenderId = senderIdGuid,
                Content = content ?? string.Empty,
                CreatedAt = DateTime.UtcNow,
                IsRead = false,
                ParentMessageId = parentIdGuid
            };

            if (attachments != null && attachments.Any())
            {
                foreach (var att in attachments)
                {
                    message.Attachments.Add(new Attachment
                    {
                        FileUrl = att.FileUrl,
                        FileType = att.FileType,
                        MimeType = att.MimeType,
                        OriginalFileName = att.OriginalFileName,
                        FileSize = att.FileSize,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            // Load parent info for the broadcast if it exists
            string? parentContent = null;
            string? parentSenderName = null;

            if (parentIdGuid.HasValue)
            {
                var parentMsg = await _context.Messages
                    .Include(m => m.Sender)
                    .FirstOrDefaultAsync(m => m.Id == parentIdGuid.Value);
                
                if (parentMsg != null)
                {
                    parentContent = parentMsg.Content;
                    parentSenderName = parentMsg.Sender.DisplayName;
                }
            }

            // Get sender profile for name
            var sender = await _context.Users.FindAsync(senderIdGuid);

            // Broadcast to the chat participants using Users
            var messageDto = new
            {
                id = message.Id,
                chatId = message.ChatId,
                senderId = message.SenderId,
                senderName = sender?.DisplayName ?? "Unknown",
                content = message.Content,
                createdAt = message.CreatedAt,
                isRead = message.IsRead,
                parentMessageId = message.ParentMessageId,
                parentMessageContent = parentContent,
                parentMessageSenderName = parentSenderName,
                attachments = message.Attachments.Select(a => new AttachmentDto
                {
                    Id = a.Id,
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    MimeType = a.MimeType,
                    OriginalFileName = a.OriginalFileName,
                    FileSize = a.FileSize
                }).ToList()
            };

            await Clients.Users(participantIds).SendAsync("receivemessage", messageDto);
        }

        public async Task TypingStatus(string chatId, bool isTyping)
        {
            var senderId = Context.UserIdentifier;
            if (string.IsNullOrWhiteSpace(senderId)) return;
            
            var chatIdGuid = Guid.Parse(chatId);
            var senderIdGuid = Guid.Parse(senderId);

            var participantIds = await _context.ChatParticipants
                .Where(cp => cp.ChatId == chatIdGuid)
                .Select(cp => cp.UserId.ToString())
                .ToListAsync();

            var isParticipant = participantIds.Contains(senderId);
            if (!isParticipant) return;

            // Broadcast to users EXCEPT sender
            // Note: Since Clients.Users doesn't have an "Except" override like Groups,
            // we filter the participant list.
            var recipients = participantIds.Where(id => id != senderId).ToList();
            if (recipients.Any())
            {
                await Clients.Users(recipients).SendAsync("usertyping", chatId, senderId, isTyping);
            }
        }

        public async Task MarkMessagesAsRead(string chatId)
        {
            var userId = Context.UserIdentifier;
            if (string.IsNullOrWhiteSpace(userId)) return;

            var chatIdGuid = Guid.Parse(chatId);
            var userIdGuid = Guid.Parse(userId);

            // Find unread messages not sent by the current user
            var unreadMessages = await _context.Messages
                .Where(m => m.ChatId == chatIdGuid && m.SenderId != userIdGuid && !m.IsRead)
                .ToListAsync();

            if (unreadMessages.Any())
            {
                foreach (var msg in unreadMessages)
                {
                    msg.IsRead = true;
                }

                await _context.SaveChangesAsync();

                // Get participants to notify
                var participantIds = await _context.ChatParticipants
                    .Where(cp => cp.ChatId == chatIdGuid)
                    .Select(cp => cp.UserId.ToString())
                    .ToListAsync();

                // Notify all participants (including sender) that messages were read
                // The sender needs to know so they can update their UI checkmarks
                await Clients.Users(participantIds).SendAsync("messagesread", chatId, userId);
            }
        }

        public async Task ToggleReaction(string messageId, string emoji)
        {
            var userIdStr = Context.UserIdentifier;
            if (string.IsNullOrWhiteSpace(userIdStr)) return;
            
            var messageIdGuid = Guid.Parse(messageId);
            var userIdGuid = Guid.Parse(userIdStr);

            var message = await _context.Messages
                .Include(m => m.Chat)
                .ThenInclude(c => c.Participants)
                .FirstOrDefaultAsync(m => m.Id == messageIdGuid);

            if (message == null) return;

            var isParticipant = message.Chat.Participants.Any(p => p.UserId == userIdGuid);
            if (!isParticipant) return;

            var existingReactions = await _context.MessageReactions
                .Where(r => r.MessageId == messageIdGuid && r.UserId == userIdGuid)
                .ToListAsync();

            bool isAdded = false;
            
            // Remove any existing reactions by this user for this message
            if (existingReactions.Any())
            {
                _context.MessageReactions.RemoveRange(existingReactions);
                
                // If they clicked the exact same emoji that they already had, 
                // we just let it be removed (toggle off).
                // If they clicked a different emoji, we will add the new one below.
                if (existingReactions.Count == 1 && existingReactions.First().Emoji == emoji)
                {
                    // It's a toggle off, do nothing more.
                }
                else
                {
                    var reaction = new MessageReaction
                    {
                        MessageId = messageIdGuid,
                        UserId = userIdGuid,
                        Emoji = emoji,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.MessageReactions.Add(reaction);
                    isAdded = true;
                }
            }
            else
            {
                var reaction = new MessageReaction
                {
                    MessageId = messageIdGuid,
                    UserId = userIdGuid,
                    Emoji = emoji,
                    CreatedAt = DateTime.UtcNow
                };
                _context.MessageReactions.Add(reaction);
                isAdded = true;
            }

            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userIdGuid);
            var participantIds = message.Chat.Participants.Select(p => p.UserId.ToString()).ToList();

            await Clients.Users(participantIds).SendAsync("messagereactionchanged", new
            {
                messageId = message.Id,
                userId = userIdGuid,
                username = user?.DisplayName ?? "Unknown",
                emoji = emoji,
                isAdded = isAdded,
                createdAt = DateTime.UtcNow
            });
        }
    }
}
