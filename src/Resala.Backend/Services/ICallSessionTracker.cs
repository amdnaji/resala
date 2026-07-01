using System;
using System.Threading.Tasks;

namespace Resala.Backend.Services
{
    public class ActiveCallSession
    {
        public string ChatId { get; set; } = string.Empty;
        public string CallerId { get; set; } = string.Empty;
        public string CallerName { get; set; } = string.Empty;
        public string ReceiverId { get; set; } = string.Empty;
        public string CallType { get; set; } = string.Empty; // "AUDIO" or "VIDEO"
        public DateTime StartTime { get; set; } = DateTime.UtcNow;
    }

    public interface ICallSessionTracker
    {
        Task AddSessionAsync(string chatId, string callerId, string callerName, string receiverId, string callType);
        Task<ActiveCallSession?> GetSessionForReceiverAsync(string receiverId);
        Task RemoveSessionAsync(string chatId);
    }
}
