/**
 * Formats raw call system messages into localized user-friendly strings.
 * @param content The raw message content (e.g. "[System:CompletedVideoCall:93]")
 * @param t The i18next translation function
 */
export const formatCallSystemMessage = (content: string, t: any): string => {
  if (!content) return '';

  if (content === '[System:MissedCall]') {
    return t('chat.missed_audio_call', 'Missed Audio Call');
  }

  if (content === '[System:MissedVideoCall]') {
    return t('chat.missed_video_call', 'Missed Video Call');
  }

  if (content.startsWith('[System:CompletedCall:')) {
    const parts = content.split(':');
    const durationSeconds = parseInt(parts[2], 10) || 0;
    const durationStr = formatDuration(durationSeconds);
    return t('chat.completed_audio_call', { defaultValue: `Completed Audio Call (${durationStr})`, duration: durationStr });
  }

  if (content.startsWith('[System:CompletedVideoCall:')) {
    const parts = content.split(':');
    const durationSeconds = parseInt(parts[2], 10) || 0;
    const durationStr = formatDuration(durationSeconds);
    return t('chat.completed_video_call', { defaultValue: `Completed Video Call (${durationStr})`, duration: durationStr });
  }

  return content;
};

/**
 * Format raw seconds to MM:SS string.
 */
const formatDuration = (secs: number): string => {
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
};
