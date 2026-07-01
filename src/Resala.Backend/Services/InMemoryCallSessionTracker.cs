using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;

namespace Resala.Backend.Services
{
    public class InMemoryCallSessionTracker : ICallSessionTracker
    {
        // Key: ChatId, Value: ActiveCallSession
        private readonly ConcurrentDictionary<string, ActiveCallSession> _sessions = new();
        private const double SessionTimeoutSeconds = 45.0;

        public Task AddSessionAsync(string chatId, string callerId, string callerName, string receiverId, string callType)
        {
            // Clean up any stale sessions first
            CleanupStaleSessions();

            var session = new ActiveCallSession
            {
                ChatId = chatId,
                CallerId = callerId,
                CallerName = callerName,
                ReceiverId = receiverId,
                CallType = callType,
                StartTime = DateTime.UtcNow
            };

            // Register or overwrite session for this chatId
            _sessions[chatId] = session;
            return Task.CompletedTask;
        }

        public Task<ActiveCallSession?> GetSessionForReceiverAsync(string receiverId)
        {
            CleanupStaleSessions();

            // Find the most recent active call session for this receiver
            var activeSession = _sessions.Values
                .Where(s => s.ReceiverId == receiverId && (DateTime.UtcNow - s.StartTime).TotalSeconds < SessionTimeoutSeconds)
                .OrderByDescending(s => s.StartTime)
                .FirstOrDefault();

            return Task.FromResult<ActiveCallSession?>(activeSession);
        }

        public Task RemoveSessionAsync(string chatId)
        {
            _sessions.TryRemove(chatId, out _);
            return Task.CompletedTask;
        }

        private void CleanupStaleSessions()
        {
            var staleKeys = _sessions.Where(pair => (DateTime.UtcNow - pair.Value.StartTime).TotalSeconds >= SessionTimeoutSeconds)
                                     .Select(pair => pair.Key)
                                     .ToList();

            foreach (var key in staleKeys)
            {
                _sessions.TryRemove(key, out _);
            }
        }
    }
}
