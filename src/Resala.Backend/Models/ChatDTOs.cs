using System;
using System.Collections.Generic;

namespace Resala.Backend.Models.DTOs
{
    public class ReactionDto
    {
        public Guid UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Emoji { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class AttachmentDto
    {
        public Guid? Id { get; set; }
        public Guid? MessageId { get; set; }
        public string FileUrl { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public string MimeType { get; set; } = string.Empty;
        public string OriginalFileName { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreatePrivateChatDto
    {
        public Guid TargetUserId { get; set; }
    }

    public class CreateGroupChatDto
    {
        public string Title { get; set; } = string.Empty;
        public List<Guid> ParticipantIds { get; set; } = new();
    }

    public class AddParticipantsDto
    {
        public List<Guid> ParticipantIds { get; set; } = new();
    }

    public class UpdateGroupDto
    {
        public string? Title { get; set; }
        public string? ProfilePictureUrl { get; set; }
    }

    public class ChatResponseDto
    {
        public Guid Id { get; set; }
        public ChatType Type { get; set; }
        public string? Title { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<ParticipantDto> Participants { get; set; } = new();
        public MessageDto? LastMessage { get; set; }
        public int UnreadCount { get; set; }
    }

    public class ParticipantDto
    {
        public Guid UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? Bio { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime LastSeenAt { get; set; }
        public bool IsOnline { get; set; }
        public ParticipantRole Role { get; set; }
    }

    public class MessageDto
    {
        public Guid Id { get; set; }
        public Guid ChatId { get; set; }
        public Guid SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; }

        public Guid? ParentMessageId { get; set; }
        public string? ParentMessageContent { get; set; }
        public string? ParentMessageSenderName { get; set; }

        public List<ReactionDto> Reactions { get; set; } = new();
        public List<AttachmentDto> Attachments { get; set; } = new();
    }
}
