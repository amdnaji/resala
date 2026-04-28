export const playNotificationSound = async () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    // Use a single global context to avoid limits and manage suspension state
    if (!(window as any).globalAudioContext) {
      (window as any).globalAudioContext = new AudioContext();
    }
    const context = (window as any).globalAudioContext;
    
    // Crucial for browser autoplay policies: resume if suspended
    if (context.state === 'suspended') {
      await context.resume();
    }
    
    // Helper function to create an extremely soft, calm chime
    const playSoftChime = (freq: number, startTime: number) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      // Pure sine wave is the smoothest and least harsh sounding
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      
      // Envelope: Very gentle attack and a long, fading release
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05); // Low volume (0.15)
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.6);
    };

    const now = context.currentTime;

    // A very calm, warm, double-chime (C5 then E5)
    // Similar to a gentle xylophone or soft bell
    playSoftChime(523.25, now);           // C5
    playSoftChime(659.25, now + 0.15);    // E5

  } catch (e) {
    console.error("Audio playback failed", e);
  }
};
