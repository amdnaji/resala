using System;

namespace Resala.Backend.Models
{
    /// <summary>
    /// Request model for updating user profile information.
    /// </summary>
    public class UpdateProfileRequest
    {
        public string? DisplayName { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string? PreferredLanguage { get; set; }
    }

    /// <summary>
    /// Standardized response model for user profile information.
    /// </summary>
    public class UserProfileResponse
    {
        public Guid UserId { get; set; }
        public string? Username { get; set; }
        public string? DisplayName { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime LastSeenAt { get; set; }
        public bool IsOnline { get; set; }
        public string PreferredLanguage { get; set; } = "en";
    }
}
