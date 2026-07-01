import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../contexts/CallContext';
import { Mic, MicOff, Phone, PhoneOff, User, Video, VideoOff, Monitor, MonitorOff, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const CallOverlay: React.FC = () => {
  const [showEffectsMenu, setShowEffectsMenu] = useState(false);

  const {
    callState,
    callType,
    callerName,
    receiverName,
    duration,
    isMuted,
    isVideoMuted,
    isScreenSharing,
    videoMode,
    setVideoEffectMode,
    isBlurLoading,
    acceptCall,
    rejectCall,
    endCall,
    proceedToCall,
    cancelPreCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    localStream,
    remoteStream,
    videoDevices,
    audioDevices,
    selectedVideoDeviceId,
    selectedAudioDeviceId,
    changeVideoDevice,
    changeAudioDevice
  } = useCall();

  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar' || document.documentElement.dir === 'rtl';

  // Video Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Bind Local Stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => {
        console.warn("Failed to play local video stream:", err);
      });
    }
  }, [localStream, callState]);

  // Bind Remote Stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => {
        console.warn("Failed to play remote video stream:", err);
      });
    }
  }, [remoteStream, callState]);

  // Bind Remote Audio (for Audio-only calls)
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream && callType === 'AUDIO') {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => {
        console.warn("Failed to play remote audio stream:", err);
      });
    }
  }, [remoteStream, callType, callState]);

  if (callState === 'IDLE') return null;

  // Format Duration (00:00)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Get active name to display
  const displayName = callState === 'INCOMING' 
    ? callerName 
    : (callState === 'OUTGOING' ? receiverName : (receiverName || callerName));

  // Call Status Label
  const getStatusLabel = () => {
    switch (callState) {
      case 'OUTGOING':
        return isRtl ? 'جاري الاتصال...' : 'Calling...';
      case 'INCOMING':
        return callType === 'VIDEO'
          ? (isRtl ? 'مكالمة فيديو واردة...' : 'Incoming video call...')
          : (isRtl ? 'مكالمة صوتية واردة...' : 'Incoming audio call...');
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

  // Check if remote video tracks are active
  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().some(track => track.enabled && track.readyState === 'live');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl transition-all duration-500 animate-fadeIn text-white font-sans p-4 sm:p-6 overflow-hidden select-none">
      
      {/* Background Subtle Ambience Glows behind the card */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* ---------------------------------------------------- */}
      {/* 1. VIDEO CALL PERSISTENT CONTAINER                  */}
      {/* ---------------------------------------------------- */}
      {callType === 'VIDEO' && callState !== 'INCOMING' ? (
        <div className="w-full max-w-4xl h-[70vh] min-h-[480px] rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl relative overflow-hidden transition-all duration-500 animate-scaleUp flex items-center justify-center">
          
          {/* Main Remote Video Stream or Centered Pulse Placeholder or Pre-Call Setup Lobby */}
          {callState === 'CONNECTED' && hasRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover z-0 absolute inset-0 bg-slate-950"
            />
          ) : callState === 'PRE_CALL' ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/20 pointer-events-none p-6 text-center">
              <div className="bg-slate-950/85 border border-white/10 px-6 py-5 rounded-2xl backdrop-blur-md shadow-2xl max-w-sm pointer-events-auto">
                <Sparkles className="text-amber-400 mx-auto mb-2 animate-bounce" size={28} />
                <h3 className="text-sm font-bold text-white mb-1">
                  {isRtl ? 'معاينة ما قبل الاتصال' : 'Pre-call Setup Lobby'}
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  {isRtl 
                    ? 'اختر وضع الكاميرا والأجهزة وتأكد من مظهرك وخلفيتك قبل بدء الاتصال بالضغط على زر الهاتف بالأسفل.'
                    : 'Configure your effects & devices and verify your background before placing the call by clicking the green button below.'}
                </p>

                {/* Device selectors */}
                <div className="flex flex-col gap-3 text-right text-xs text-slate-300 w-full border-t border-white/5 pt-3.5 mt-2">
                  {/* Microphone selector */}
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Mic size={10} className="text-slate-400" />
                      <span>{isRtl ? 'الميكروفون (مدخل الصوت)' : 'Microphone (Audio Input)'}</span>
                    </label>
                    <select
                      value={selectedAudioDeviceId || ''}
                      onChange={(e) => changeAudioDevice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                    >
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `${isRtl ? 'ميكروفون' : 'Microphone'} ${device.deviceId.slice(0, 4)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Camera selector */}
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Video size={10} className="text-slate-400" />
                      <span>{isRtl ? 'الكاميرا (مدخل الفيديو)' : 'Camera (Video Input)'}</span>
                    </label>
                    <select
                      value={selectedVideoDeviceId || ''}
                      onChange={(e) => changeVideoDevice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                    >
                      {videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `${isRtl ? 'كاميرا' : 'Camera'} ${device.deviceId.slice(0, 4)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Calling / Connecting state inside the main canvas
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/90 relative z-0">
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-emerald-500/5 blur-[80px]" />
              <div className="relative flex items-center justify-center mb-6">
                <div className="absolute w-36 h-36 rounded-full border border-emerald-500/20 animate-ping opacity-30" style={{ animationDuration: '3s' }} />
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-slate-850 to-slate-700 flex items-center justify-center text-white text-3xl font-bold shadow-2xl border border-slate-700">
                  {displayName ? displayName.charAt(0).toUpperCase() : <User size={36} className="text-slate-400" />}
                </div>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-white mb-2">
                {displayName}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-full">
                <Loader2 size={12} className="animate-spin text-emerald-400" />
                <span>
                  {callState === 'OUTGOING'
                    ? (isRtl ? 'جاري الاتصال...' : 'Calling...')
                    : (isRtl ? 'بانتظار تغذية الفيديو...' : 'Connecting video...')}
                </span>
              </p>
            </div>
          )}

          {/* Top subtle overlay inside container */}
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-10" />

          {/* Metadata Display overlay (Top Left of Card) */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 flex flex-col items-start bg-slate-950/50 backdrop-blur-md border border-white/5 px-3 py-2 rounded-xl">
            <span className="text-white text-sm sm:text-base font-bold tracking-tight">
              {displayName}
            </span>
            <span className="text-emerald-400 font-mono text-xs font-semibold mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              {formatTime(duration)}
            </span>
          </div>

          {/* Floating Picture-in-Picture Local Preview (Top Right) or Full Background Preview during PRE_CALL */}
          <div className={
            callState === 'PRE_CALL'
              ? "absolute inset-0 w-full h-full z-0 overflow-hidden"
              : "absolute top-4 right-4 sm:top-6 sm:right-6 z-20"
          }>
            <div className={
              callState === 'PRE_CALL'
                ? "w-full h-full relative"
                : "w-24 h-32 sm:w-36 sm:h-48 rounded-xl border border-white/10 shadow-2xl overflow-hidden bg-slate-900/80 backdrop-blur-md relative transition-transform duration-300 hover:scale-[1.03]"
            }>
              {/* Local video element persistently mounted in DOM to prevent document.getElementById('localVideo') null errors */}
              <video
                id="localVideo"
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  localStream && !isVideoMuted ? 'block' : 'hidden'
                }`}
              />

              {/* Cam muted placeholder persistently mounted in DOM, hidden when camera is active */}
              <div 
                className={`w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 ${
                  localStream && !isVideoMuted ? 'hidden' : 'flex'
                }`}
              >
                <VideoOff size={callState === 'PRE_CALL' ? 36 : 20} className="text-slate-500 animate-pulse mb-1" />
                <span className="text-[8px] uppercase font-bold tracking-wider opacity-60">
                  {isRtl ? 'كاميرتك مغلقة' : 'Cam Muted'}
                </span>
              </div>
              {isScreenSharing && (
                <div className="absolute bottom-1.5 left-1.5 bg-emerald-500 text-white rounded px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider flex items-center gap-0.5 shadow">
                  <Monitor size={6} />
                  <span>{isRtl ? 'تشارك' : 'Sharing'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Floating Control Dock (Bottom Center of Card) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-auto">
            <div className="flex items-center gap-4 bg-slate-950/70 border border-white/10 px-5 sm:px-6 py-3 rounded-2xl backdrop-blur-md shadow-2xl">
              
              {/* MIC MUTED BUTTON */}
              <button
                onClick={toggleMute}
                className={`p-3 rounded-xl border transition-all duration-300 ${
                  isMuted
                    ? 'bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {/* CAMERA MUTED BUTTON */}
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-xl border transition-all duration-300 ${
                  isVideoMuted
                    ? 'bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={isVideoMuted ? 'Start Video' : 'Stop Video'}
              >
                {isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}
              </button>

              {/* MONITOR SCREEN SHARE BUTTON */}
              {callState !== 'PRE_CALL' && (
                <button
                  onClick={toggleScreenShare}
                  disabled={callState !== 'CONNECTED'}
                  className={`p-3 rounded-xl border transition-all duration-300 ${
                    isScreenSharing
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                  title={isScreenSharing ? 'Stop Share' : 'Share Screen'}
                >
                  {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
                </button>
              )}

              {/* VIDEO EFFECTS POPUP MENU */}
              <div className="relative">
                <button
                  id="toggleBlurBtn"
                  onClick={() => setShowEffectsMenu(!showEffectsMenu)}
                  disabled={(callState !== 'CONNECTED' && callState !== 'OUTGOING' && callState !== 'PRE_CALL') || isVideoMuted}
                  className={`p-3 rounded-xl border transition-all duration-300 ${
                    videoMode !== 'normal'
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                  title={isRtl ? 'مؤثرات الفيديو' : 'Video Effects'}
                >
                  {isBlurLoading ? (
                    <Loader2 size={18} className="animate-spin text-emerald-400" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                </button>

                {/* Floating Glassmorphic Menu */}
                {showEffectsMenu && (
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-48 bg-slate-950/90 border border-slate-800 p-2 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col gap-1.5 animate-scaleUp">
                    <span className="text-[10px] text-slate-400 font-semibold px-2.5 py-1 tracking-wider uppercase border-b border-slate-900/80 mb-1 block">
                      {isRtl ? 'مؤثرات الكاميرا' : 'Camera Effects'}
                    </span>
                    
                    {/* Normal Camera */}
                    <button
                      onClick={() => {
                        setVideoEffectMode('normal');
                        setShowEffectsMenu(false);
                      }}
                      className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        videoMode === 'normal'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent'
                      }`}
                    >
                      <Video size={14} />
                      <span>{isRtl ? 'كاميرا عادية' : 'Normal Camera'}</span>
                    </button>

                    {/* Background Blur */}
                    <button
                      onClick={() => {
                        setVideoEffectMode('blur');
                        setShowEffectsMenu(false);
                      }}
                      className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        videoMode === 'blur'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent'
                      }`}
                    >
                      <Sparkles size={14} />
                      <span>{isRtl ? 'تمويه الخلفية' : 'Blur Background'}</span>
                    </button>

                    {/* Virtual Background */}
                    <button
                      onClick={() => {
                        setVideoEffectMode('bg');
                        setShowEffectsMenu(false);
                      }}
                      className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        videoMode === 'bg'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent'
                      }`}
                    >
                      <ImageIcon size={14} />
                      <span>{isRtl ? 'الخلفية الافتراضية' : 'Virtual Background'}</span>
                    </button>
                  </div>
                )}
              </div>


              {/* END CALL / PRE-CALL ACTION BUTTONS */}
              {callState === 'PRE_CALL' ? (
                <>
                  {/* CANCEL LOBBY BUTTON */}
                  <button
                    onClick={cancelPreCall}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all duration-300 transform active:scale-95 flex items-center justify-center"
                    title={isRtl ? 'إلغاء' : 'Cancel'}
                  >
                    <PhoneOff size={18} className="text-rose-400" />
                  </button>

                  {/* PROCEED / START CALL BUTTON */}
                  <button
                    onClick={proceedToCall}
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl border border-emerald-500/30 shadow-lg transition-all duration-300 transform active:scale-95 flex items-center justify-center animate-pulse"
                    title={isRtl ? 'بدء الاتصال' : 'Start Call'}
                  >
                    <Phone size={18} />
                  </button>
                </>
              ) : (
                <button
                  onClick={endCall}
                  className="p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all duration-300 transform active:scale-95 flex items-center justify-center"
                  title={isRtl ? 'إنهاء المكالمة' : 'End Call'}
                >
                  <PhoneOff size={18} />
                </button>
              )}

            </div>
          </div>

        </div>
      ) : (
        // ----------------------------------------------------
        // 2. AUDIO CALL OR INCOMING CALL CARD CONTAINER       
        // ----------------------------------------------------
        <div className="w-full max-w-sm py-12 px-6 rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center relative z-10 transition-all duration-500 animate-scaleUp overflow-hidden">
          
          {/* Card Decorative Background Glows */}
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-[50px] pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-blue-500/10 blur-[50px] pointer-events-none" />

          {/* Call Status Header */}
          <span className="text-emerald-400 font-semibold tracking-wider text-xs uppercase mb-3 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] relative z-10">
            {getStatusLabel()}
          </span>

          {/* Dynamic Animated Avatar Wrapper */}
          <div className="relative my-8 flex items-center justify-center z-10">
            {/* Ripple rings */}
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
            <div className={`w-32 h-32 rounded-full bg-gradient-to-tr from-slate-850 to-slate-700 flex items-center justify-center text-white text-4xl font-bold shadow-2xl relative border-2 transition-all duration-500 ${
              callState === 'CONNECTED' ? 'border-emerald-500' : 'border-slate-600'
            }`}>
              {displayName ? displayName.charAt(0).toUpperCase() : <User size={48} className="text-slate-400" />}
              
              {/* Online indicator */}
              {callState === 'CONNECTED' && (
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                </div>
              )}
            </div>
          </div>

          {/* Name and Detail */}
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 max-w-xs truncate relative z-10">
            {displayName || (isRtl ? 'مستخدم رِسالة' : 'Resala User')}
          </h2>

          {/* Timer or Detail Label */}
          {callState === 'CONNECTED' ? (
            <p className="text-3xl font-mono tracking-wider font-semibold text-emerald-400 bg-slate-950/70 border border-slate-800/80 px-4 py-1.5 rounded-2xl shadow-inner mt-2 relative z-10">
              {formatTime(duration)}
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-1 max-w-xs truncate relative z-10">
              {callState === 'BUSY'
                ? (isRtl ? 'الخط مشغول حالياً' : 'Line is currently busy')
                : (isRtl ? 'رِسالة صوتية آمنة' : 'Secure Resala Audio')}
            </p>
          )}

          {/* Control Dock */}
          <div className="mt-12 flex justify-center w-full relative z-10">
            <div className="flex items-center gap-4 px-5 py-3.5 bg-slate-950/50 border border-slate-800/80 rounded-2xl backdrop-blur-md shadow-inner">
              
              {/* Decline Call (Incoming only) */}
              {callState === 'INCOMING' && (
                <button
                  onClick={() => rejectCall()}
                  className="p-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-all duration-300 transform active:scale-95 flex items-center justify-center"
                  title={isRtl ? 'رفض' : 'Decline'}
                >
                  <PhoneOff size={20} />
                </button>
              )}

              {/* Accept Call (Incoming only) */}
              {callState === 'INCOMING' && (
                <button
                  onClick={acceptCall}
                  className="p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all duration-300 transform active:scale-95 flex items-center justify-center"
                  title={isRtl ? 'قبول' : 'Accept'}
                >
                  <Phone size={20} className="animate-bounce" style={{ animationDuration: '2s' }} />
                </button>
              )}

              {/* Toggles (Active / Outgoing only) */}
              {callState !== 'INCOMING' && (
                <>
                  {/* MIC TOGGLE */}
                  <button
                    onClick={toggleMute}
                    disabled={callState !== 'CONNECTED'}
                    className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-center ${
                      isMuted
                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>

                  {/* END CALL */}
                  <button
                    onClick={endCall}
                    className="p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all duration-300 transform active:scale-95 flex items-center justify-center"
                    title={isRtl ? 'إنهاء' : 'End Call'}
                  >
                    <PhoneOff size={20} />
                  </button>
                </>
              )}

            </div>
          </div>

        </div>
      )}

      {/* Hidden HTML5 Audio tag for remote audio on Audio-only calls */}
      {callType === 'AUDIO' && callState === 'CONNECTED' && (
        <audio ref={remoteAudioRef} autoPlay playsInline />
      )}

      {/* Unified Security Badge below call container */}
      <div className="absolute bottom-4 flex items-center gap-1.5 text-[9px] text-slate-500 tracking-wider">
        <svg className="w-3 h-3 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold uppercase">{isRtl ? 'اتصال مشفر آمن E2EE' : 'End-to-End Encrypted'}</span>
      </div>

    </div>
  );
};
