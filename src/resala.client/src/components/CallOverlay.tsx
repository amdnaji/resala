import React from 'react';
import { useAudioCall } from '../contexts/AudioCallContext';
import { Mic, MicOff, Phone, PhoneOff, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const CallOverlay: React.FC = () => {
  const {
    callState,
    callerName,
    receiverName,
    duration,
    isMuted,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute
  } = useAudioCall();

  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar' || document.documentElement.dir === 'rtl';

  if (callState === 'IDLE') return null;

  // Format Duration (00:00)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Get active name to display
  const displayName = callState === 'INCOMING' ? callerName : receiverName;

  // Call Status Label (Arabic & English bilingual support)
  const getStatusLabel = () => {
    switch (callState) {
      case 'OUTGOING':
        return isRtl ? 'جاري الاتصال...' : 'Calling...';
      case 'INCOMING':
        return isRtl ? 'مكالمة صوتية واردة...' : 'Incoming audio call...';
      case 'CONNECTED':
        return isRtl ? 'مكالمة نشطة' : 'Active Call';
      case 'BUSY':
        return isRtl ? 'الخط مشغول' : 'Line Busy';
      case 'DISCONNECTED':
        return isRtl ? 'تم إنهاء المكالمة' : 'Call Ended';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xl transition-all duration-500 animate-fadeIn text-white font-sans">
      
      {/* Background Ambience Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-72 h-72 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-sm px-6 py-12 flex flex-col items-center text-center relative z-10 select-none">
        
        {/* Call Status Header */}
        <span className="text-emerald-400 font-semibold tracking-wider text-xs uppercase mb-3 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          {getStatusLabel()}
        </span>

        {/* Dynamic Animated Avatar Wrapper */}
        <div className="relative my-8 flex items-center justify-center">
          {/* Ripple rings (pulse animations) */}
          {(callState === 'OUTGOING' || callState === 'INCOMING') && (
            <>
              <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30 animate-ping opacity-25" style={{ animationDuration: '3s' }} />
              <div className="absolute w-56 h-56 rounded-full border border-blue-500/20 animate-ping opacity-15" style={{ animationDuration: '4s' }} />
            </>
          )}
          {callState === 'CONNECTED' && (
            <div className="absolute w-40 h-40 rounded-full bg-emerald-500/5 border border-emerald-500/10 animate-pulse" />
          )}

          {/* Core Avatar */}
          <div className={`w-32 h-32 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white text-4xl font-bold shadow-2xl relative border-2 transition-all duration-500 ${
            callState === 'CONNECTED' ? 'border-emerald-500' : 'border-slate-600'
          }`}>
            {displayName ? displayName.charAt(0).toUpperCase() : <User size={48} className="text-slate-400" />}
            
            {/* Online indicator or tiny audio wave */}
            {callState === 'CONNECTED' && (
              <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </div>
            )}
          </div>
        </div>

        {/* Name and Detail */}
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2 max-w-xs truncate">
          {displayName || (isRtl ? 'مستخدم رِسالة' : 'Resala User')}
        </h2>

        {/* Timer or Detail Label */}
        {callState === 'CONNECTED' ? (
          <p className="text-3xl font-mono tracking-wider font-semibold text-emerald-400 bg-slate-900/60 border border-slate-800 px-4 py-1.5 rounded-2xl shadow-inner mt-2">
            {formatTime(duration)}
          </p>
        ) : (
          <p className="text-sm text-slate-400 mt-1 max-w-xs truncate">
            {callState === 'BUSY' ? (isRtl ? 'يرجى المحاولة لاحقاً' : 'Please try again later') : (isRtl ? 'رِسالة صوتية آمنة' : 'Secure Resala Audio')}
          </p>
        )}

        {/* Control Actions Section */}
        <div className="mt-16 w-full flex flex-col items-center justify-center">
          
          {/* Action buttons inside glass card */}
          <div className="flex items-center gap-8 bg-slate-900/40 border border-slate-800/80 px-8 py-5 rounded-3xl backdrop-blur-md shadow-2xl">
            
            {/* MUTE BUTTON (Visible during active calling/connected states) */}
            {(callState === 'CONNECTED' || callState === 'OUTGOING') && (
              <button
                onClick={toggleMute}
                disabled={callState !== 'CONNECTED'}
                className={`p-4 rounded-2xl border transition-all duration-300 transform active:scale-95 flex items-center justify-center ${
                  isMuted
                    ? 'bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
            )}

            {/* INCOMING ACTION BUTTONS (Accept / Reject) */}
            {callState === 'INCOMING' && (
              <div className="flex items-center gap-8">
                {/* DECLINE BUTTON */}
                <button
                  onClick={() => rejectCall()}
                  className="p-5 rounded-2xl bg-rose-600 hover:bg-rose-500 border border-rose-500/20 text-white shadow-[0_10px_20px_rgba(244,63,94,0.3)] hover:shadow-[0_10px_25px_rgba(244,63,94,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center justify-center"
                  title={isRtl ? 'رفض' : 'Decline'}
                >
                  <PhoneOff size={24} />
                </button>

                {/* ACCEPT BUTTON */}
                <button
                  onClick={acceptCall}
                  className="p-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 border border-emerald-400/20 text-white shadow-[0_10px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_10px_25px_rgba(16,185,129,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center justify-center relative overflow-hidden group"
                  title={isRtl ? 'قبول' : 'Accept'}
                >
                  <span className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                  <Phone size={24} className="relative z-10 animate-bounce" style={{ animationDuration: '2s' }} />
                </button>
              </div>
            )}

            {/* END CALL BUTTON (Visible for Outgoing and Connected states) */}
            {(callState === 'CONNECTED' || callState === 'OUTGOING') && (
              <button
                onClick={endCall}
                className="p-5 rounded-2xl bg-rose-600 hover:bg-rose-500 border border-rose-500/20 text-white shadow-[0_10px_20px_rgba(244,63,94,0.3)] hover:shadow-[0_10px_25px_rgba(244,63,94,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center justify-center"
                title={isRtl ? 'إنهاء المكالمة' : 'End Call'}
              >
                <PhoneOff size={24} />
              </button>
            )}

          </div>

        </div>

        {/* Security / Encryption Badge */}
        <div className="absolute bottom-6 flex items-center gap-1.5 text-xs text-slate-500">
          <svg className="w-3.5 h-3.5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium tracking-wide uppercase">{isRtl ? 'اتصال مشفر آمن' : 'End-to-End Encrypted'}</span>
        </div>

      </div>
    </div>
  );
};
