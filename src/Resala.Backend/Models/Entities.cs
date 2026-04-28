using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;

namespace Resala.Backend.Models
{
    // Inherit from IdentityUser<Guid> instead of writing Id, Username, Email, PasswordHash manually
    public class User : IdentityUser<Guid>
    {
        public User() : base()
        {
            Id = Guid.CreateVersion7();
        }

        public string DisplayName { get; set; } = string.Empty;
        public string? Bio { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
        public string PreferredLanguage { get; set; } = "en";

        // Navigation Properties
        [JsonIgnore]
        public ICollection<ChatParticipant> ChatParticipants { get; set; } = new List<ChatParticipant>();
    }

    public enum ChatType
    {
        Private = 0,
        Group = 1
    }

    public enum ParticipantRole
    {
        Member = 0,
        Admin = 1
    }

    public class Chat
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();
        public ChatType Type { get; set; }
        public string? Title { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [JsonIgnore]
        public ICollection<ChatParticipant> Participants { get; set; } = new List<ChatParticipant>();
        
        [JsonIgnore]
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }

    public class ChatParticipant
    {
        public Guid ChatId { get; set; }
        public Chat Chat { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public ParticipantRole Role { get; set; } = ParticipantRole.Member;
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }

    public class Message
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();
        
        public Guid ChatId { get; set; }
        [JsonIgnore]
        public Chat Chat { get; set; } = null!;

        public Guid SenderId { get; set; }
        public User Sender { get; set; } = null!;

        public Guid? ParentMessageId { get; set; }
        public Message? ParentMessage { get; set; }

        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsRead { get; set; } = false;

        public ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();
        public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
    }

    public class Attachment
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid MessageId { get; set; }
        [JsonIgnore]
        public Message Message { get; set; } = null!;

        public string FileUrl { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public string MimeType { get; set; } = string.Empty;
        public string OriginalFileName { get; set; } = string.Empty;
        public long FileSize { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class MessageReaction
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid MessageId { get; set; }
        [JsonIgnore]
        public Message Message { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public string Emoji { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
