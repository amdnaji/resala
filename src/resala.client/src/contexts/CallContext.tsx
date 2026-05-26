import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { useSignalR } from './SignalRContext';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';
import { Camera } from '@mediapipe/camera_utils';

export type CallState = 'IDLE' | 'OUTGOING' | 'INCOMING' | 'CONNECTED' | 'DISCONNECTED' | 'BUSY';
export type CallType = 'AUDIO' | 'VIDEO';

interface CallContextType {
  callState: CallState;
  callType: CallType;
  chatId: string | null;
  callerId: string | null;
  callerName: string | null;
  receiverId: string | null;
  receiverName: string | null;
  duration: number;
  isMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isBackgroundBlurred: boolean;
  isBlurLoading: boolean;
  videoMode: 'normal' | 'blur' | 'bg';
  setVideoEffectMode: (mode: 'normal' | 'blur' | 'bg') => Promise<void>;
  startCall: (chatId: string, targetUserId: string, targetUserName: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleBackgroundBlur: () => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

// Production-Grade Global States for MediaPipe Selfie Segmentation Video Effects
let mode: 'normal' | 'blur' | 'bg' = 'normal';
let selfieSegmentation: SelfieSegmentation | null = null;
let camera: Camera | null = null;
let processedStream: MediaStream | null = null;
let originalRawVideoTrack: MediaStreamTrack | null = null;

// Throttling and Concurrency Control Guards (صمام الأمان لتقييد الإطارات والذاكرة)
let isProcessingFrame = false;
let lastFrameTime = 0;
const targetFPS = 25; // Balanced for CPU/GPU savings (25 frames per second)
const frameInterval = 1000 / targetFPS; // 40ms interval


// Web Audio API Synthesizer Sound Generator
class CallSoundEffects {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playDialing() {
    this.stop();
    this.initCtx();
    const playBeep = () => {
      if (!this.ctx) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc1.frequency.value = 350;
      osc2.frequency.value = 440;
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime + 1.2);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.4);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc1.start(this.ctx.currentTime);
      osc2.start(this.ctx.currentTime);
      
      osc1.stop(this.ctx.currentTime + 1.4);
      osc2.stop(this.ctx.currentTime + 1.4);
    };

    playBeep();
    this.intervalId = setInterval(playBeep, 3000);
  }

  playRinging() {
    this.stop();
    this.initCtx();
    const playRing = () => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime + 0.8);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.9);
      
      gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 1.1);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime + 1.9);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.0);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 2.0);
    };

    playRing();
    this.intervalId = setInterval(playRing, 3500);
  }

  playConnected() {
    this.stop();
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playDisconnected() {
    this.stop();
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.setValueAtTime(200, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playBusy() {
    this.stop();
    this.initCtx();
    const playBusyBeep = () => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.frequency.value = 480;
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime + 0.25);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.3);
    };

    playBusyBeep();
    this.intervalId = setInterval(playBusyBeep, 600);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

const sounds = new CallSoundEffects();

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { connection, isConnected } = useSignalR();
  const isRtl = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar';

  // Call States
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [callType, setCallType] = useState<CallType>('AUDIO');
  const [chatId, setChatId] = useState<string | null>(null);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  
  // Toggles & Streams
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isBackgroundBlurred, setIsBackgroundBlurred] = useState(false);
  const [isBlurLoading, setIsBlurLoading] = useState(false);
  const [videoMode, setVideoMode] = useState<'normal' | 'blur' | 'bg'>('normal');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // WebRTC References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareTrackRef = useRef<MediaStreamTrack | null>(null); // Active screen share track reference
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ringing & Call Tracking References
  const isCallerRef = useRef<boolean>(false);
  const durationRef = useRef<number>(0);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State refs to prevent closure issues in listeners
  const callStateRef = useRef<CallState>('IDLE');
  const callTypeRef = useRef<CallType>('AUDIO');
  
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Log system message in DB
  const logCallMessage = (cId: string, content: string) => {
    if (connection && isConnected) {
      connection.invoke('SendMessage', cId, content, null, null).catch(err => {
        console.error('Failed to log call system message:', err);
      });
    }
  };

  const activeChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeChatIdRef.current = chatId;
  }, [chatId]);

  const targetUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    targetUserIdRef.current = callState === 'OUTGOING' ? receiverId : callerId;
  }, [callState, receiverId, callerId]);

  // Cleanup helper
  const cleanupCall = () => {
    sounds.stop();
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    if (camera) {
      try {
        console.log('[ResalaBlur] Stopping MediaPipe Camera on call cleanup...');
        camera.stop();
      } catch (e) {
        console.warn('[ResalaBlur] Error stopping camera during cleanup:', e);
      }
      camera = null;
    }
    mode = 'normal';
    selfieSegmentation = null;
    processedStream = null;
    originalRawVideoTrack = null;
    isProcessingFrame = false;
    lastFrameTime = 0;
    setVideoMode('normal');

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenShareTrackRef.current) {
      screenShareTrackRef.current.stop();
      screenShareTrackRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
    setIsBackgroundBlurred(false);
    setIsBlurLoading(false);
    setDuration(0);
  };

  // SignalR Event Listeners Setup
  useEffect(() => {
    if (!connection || !isConnected) return;

    // 1. INCOMING CALL
    const handleIncomingCall = (cId: string, fromUserId: string, fromName: string, type: CallType) => {
      console.log(`Incoming ${type} call received: Chat: ${cId}, From: ${fromName} (${fromUserId})`);
      if (callStateRef.current !== 'IDLE') {
        // Already in a call, reject as busy
        connection.invoke('RejectCall', cId, fromUserId, 'BUSY').catch(console.error);
        return;
      }

      isCallerRef.current = false;
      setCallType(type || 'AUDIO');
      setCallState('INCOMING');
      setChatId(cId);
      setCallerId(fromUserId);
      setCallerName(fromName);
      sounds.playRinging();
    };

    // 2. CALL ACCEPTED
    const handleCallAccepted = async (cId: string, byUserId: string) => {
      console.log(`Call accepted by: ${byUserId} in Chat: ${cId}`);
      if (callStateRef.current !== 'OUTGOING' || activeChatIdRef.current !== cId) return;

      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }

      sounds.playConnected();
      setCallState('CONNECTED');
      
      // Start duration timer
      setDuration(0);
      callTimerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start WebRTC Negotiation as Caller
      try {
        await initWebRTCPipeline(cId, byUserId, true, callTypeRef.current);
      } catch (err) {
        console.error('Failed to initialize WebRTC call:', err);
        endCall();
      }
    };

    // 3. CALL REJECTED
    const handleCallRejected = (cId: string, byUserId: string, reason: string) => {
      console.log(`Call rejected by: ${byUserId} due to: ${reason}`);
      if (callStateRef.current !== 'OUTGOING' || activeChatIdRef.current !== cId) return;

      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }

      // Log missed call
      const isVideo = callTypeRef.current === 'VIDEO';
      logCallMessage(cId, isVideo ? '[System:MissedVideoCall]' : '[System:MissedCall]');

      setCallState('BUSY');
      sounds.stop();
      sounds.playBusy();

      // Return to idle after 3.5 seconds
      setTimeout(() => {
        setCallState('IDLE');
        cleanupCall();
      }, 3500);
    };

    // 4. CALL ENDED
    const handleCallEnded = (cId: string, byUserId: string) => {
      console.log(`Call ended by: ${byUserId} in Chat: ${cId}`);

      if (isCallerRef.current && callStateRef.current === 'CONNECTED') {
        const isVideo = callTypeRef.current === 'VIDEO';
        logCallMessage(cId, isVideo ? `[System:CompletedVideoCall:${durationRef.current}]` : `[System:CompletedCall:${durationRef.current}]`);
      }

      setCallState('DISCONNECTED');
      sounds.playDisconnected();
      setTimeout(() => {
        setCallState('IDLE');
        cleanupCall();
      }, 1500);
    };

    // 5. RECEIVE SDP
    const handleReceiveSdp = async (cId: string, fromUserId: string, sdpType: string, sdp: string) => {
      console.log(`SDP ${sdpType} received from: ${fromUserId}`);
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.warn('SDP discarded: Peer connection is not yet initialized.');
        return;
      }

      try {
        if (sdpType === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          connection.invoke('SendSdp', cId, fromUserId, 'answer', answer.sdp).catch(console.error);
        } else if (sdpType === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
        }
      } catch (err) {
        console.error('Error handling remote SDP:', err);
      }
    };

    // 6. RECEIVE ICE CANDIDATE
    const handleReceiveIceCandidate = async (
      _cId: string, 
      _fromUserId: string, 
      candidate: string, 
      sdpMid: string, 
      sdpMLineIndex: number
    ) => {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.warn('ICE candidate discarded: Peer connection is not yet initialized.');
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate({ candidate, sdpMid, sdpMLineIndex }));
      } catch (err) {
        console.error('Error adding remote ICE candidate:', err);
      }
    };

    connection.on('incomingcall', handleIncomingCall);
    connection.on('callaccepted', handleCallAccepted);
    connection.on('callrejected', handleCallRejected);
    connection.on('callended', handleCallEnded);
    connection.on('receivesdp', handleReceiveSdp);
    connection.on('receiveicecandidate', handleReceiveIceCandidate);

    return () => {
      connection.off('incomingcall', handleIncomingCall);
      connection.off('callaccepted', handleCallAccepted);
      connection.off('callrejected', handleCallRejected);
      connection.off('callended', handleCallEnded);
      connection.off('receivesdp', handleReceiveSdp);
      connection.off('receiveicecandidate', handleReceiveIceCandidate);
    };
  }, [connection, isConnected]);

  // WebRTC Setup Pipeline
  const initWebRTCPipeline = async (cId: string, targetUserId: string, isInitiator: boolean, type: CallType) => {
    let stream = localStreamRef.current;

    // 1. Get user media if not already warmed up
    if (!stream) {
      const constraints = {
        audio: true,
        video: type === 'VIDEO' ? { width: 1280, height: 720, frameRate: 30 } : false
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
    }

    // 2. Setup RTCPeerConnection (Local STUN server as primary, Google STUN as fallback)
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:localhost:3478' },
        { urls: 'stun:127.0.0.1:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    peerConnectionRef.current = pc;

    // 3. Add tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // 4. Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && connection) {
        connection.invoke(
          'SendIceCandidate',
          cId,
          targetUserId,
          event.candidate.candidate,
          event.candidate.sdpMid || '',
          event.candidate.sdpMLineIndex
        ).catch(console.error);
      }
    };

    // 5. Handle Remote Media Stream
    pc.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind);
      const [remoteMediaStream] = event.streams;
      setRemoteStream(remoteMediaStream);
    };

    // 6. Handle negotiation (Only initiator triggers offer)
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (connection) {
            await connection.invoke('SendSdp', cId, targetUserId, 'offer', offer.sdp);
          }
        } catch (err) {
          console.error('Error during negotiation offer creation:', err);
        }
      };
    }
  };

  // Caller: Start call
  const startCall = async (cId: string, targetUserId: string, targetUserName: string, type: CallType) => {
    if (!connection || callState !== 'IDLE') return;

    isCallerRef.current = true;
    setCallType(type);
    setCallState('OUTGOING');
    setChatId(cId);
    setReceiverId(targetUserId);
    setReceiverName(targetUserName);
    sounds.playDialing();

    // Warm up camera immediately for video call
    if (type === 'VIDEO') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 1280, height: 720, frameRate: 30 }
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Pre-warmed stream setup complete
      } catch (err) {
        console.error("Failed to warm up camera on startCall:", err);
      }
    }

    // Ringing timeout (45 seconds)
    ringingTimeoutRef.current = setTimeout(() => {
      console.log('Call ringing timed out (no answer).');
      endCall();
    }, 45000);

    try {
      await connection.invoke('StartCall', cId, targetUserId, type);
    } catch (err) {
      console.error('SignalR start call failed:', err);
      setCallState('IDLE');
      cleanupCall();
    }
  };

  // Callee: Accept call (Race-condition-free setup)
  const acceptCall = async () => {
    if (!connection || callState !== 'INCOMING' || !chatId || !callerId) return;

    isCallerRef.current = false;
    sounds.playConnected();
    setCallState('CONNECTED');

    // Start timer
    setDuration(0);
    callTimerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    try {
      // 1. Initialize receiver pipeline first!
      await initWebRTCPipeline(chatId, callerId, false, callTypeRef.current);
      // 2. Only notify the sender after we are fully ready to receive signaling
      await connection.invoke('AcceptCall', chatId, callerId);
    } catch (err) {
      console.error('SignalR accept call failed:', err);
      endCall();
    }
  };

  // Callee: Reject call
  const rejectCall = async (reason = 'DECLINED') => {
    if (!connection || callState !== 'INCOMING' || !chatId || !callerId) return;

    setCallState('IDLE');
    cleanupCall();

    try {
      await connection.invoke('RejectCall', chatId, callerId, reason);
    } catch (err) {
      console.error('SignalR reject call failed:', err);
    }
  };

  // Either party: End call
  const endCall = async () => {
    const targetUserId = targetUserIdRef.current;
    const cId = activeChatIdRef.current;

    console.log(`Ending call. Target: ${targetUserId}, Chat: ${cId}`);

    // Log call event
    if (cId) {
      const isVideo = callTypeRef.current === 'VIDEO';
      if (callState === 'OUTGOING') {
        logCallMessage(cId, isVideo ? '[System:MissedVideoCall]' : '[System:MissedCall]');
      } else if (callState === 'CONNECTED' && isCallerRef.current) {
        logCallMessage(cId, isVideo ? `[System:CompletedVideoCall:${durationRef.current}]` : `[System:CompletedCall:${durationRef.current}]`);
      }
    }

    setCallState('DISCONNECTED');
    sounds.playDisconnected();

    if (connection && cId && targetUserId) {
      try {
        await connection.invoke('EndCall', cId, targetUserId);
      } catch (err) {
        console.error('SignalR end call failed:', err);
      }
    }

    setTimeout(() => {
      setCallState('IDLE');
      cleanupCall();
    }, 1500);
  };

  // Mute local microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Turn camera on/off
  const toggleVideo = () => {
    if (callType !== 'VIDEO') return;
    
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Start / Stop screen sharing
  const toggleScreenShare = async () => {
    if (callState !== 'CONNECTED' || callType !== 'VIDEO') return;

    if (isScreenSharing) {
      // STOP SCREEN SHARING
      try {
        if (screenShareTrackRef.current) {
          screenShareTrackRef.current.stop();
          screenShareTrackRef.current = null;
        }

        // Restore raw camera track
        if (localStreamRef.current) {
          const rawVideoTrack = localStreamRef.current.getVideoTracks()[0];
          
          if (peerConnectionRef.current && rawVideoTrack) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(rawVideoTrack);
            }
          }

          // Restore local preview to raw stream
          setLocalStream(localStreamRef.current);
        }
        setIsScreenSharing(false);
      } catch (err) {
        console.error('Failed to restore camera feed:', err);
      }
    } else {
      // START SCREEN SHARING
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenShareTrackRef.current = screenTrack;

        // Swap track on RTCPeerConnection
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          }
        }

        // Create a new stream combining screen video track + raw audio track
        const rawAudioTrack = localStreamRef.current?.getAudioTracks()[0];
        const combinedTracks = [screenTrack];
        if (rawAudioTrack) combinedTracks.push(rawAudioTrack);
        
        setLocalStream(new MediaStream(combinedTracks));
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          toggleScreenShare(); // Toggles back to camera
        };
      } catch (err) {
        console.error('Failed to initiate screen share:', err);
      }
    }
  };

  // checkBrowserCapabilities: فحص إمكانية تشغيل الميزة البرمجية والرسومية على جهاز العميل
  const checkBrowserCapabilities = (ctx: CanvasRenderingContext2D) => {
    const supportsWasm = typeof WebAssembly === "object";
    const supportsCanvasFilter = ctx.filter !== undefined;
    const supportsGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (!supportsGetUserMedia) {
      return { 
        supported: false, 
        reason: isRtl ? "متصفحك الحالي لا يدعم تقنيات البث المباشر والوصول إلى كاميرا الويب." : "Your browser does not support live streaming and camera access."
      };
    }
    if (!supportsWasm) {
      return { 
        supported: false, 
        reason: isRtl ? "المتصفح لا يدعم معالجة الـ (WebAssembly) المطلوبة لتشغيل الذكاء الاصطناعي." : "Your browser does not support WebAssembly required for local AI."
      };
    }
    if (!supportsCanvasFilter) {
      return { 
        supported: false, 
        reason: isRtl ? "المتصفح لا يدعم فلاتر الرسوميات الحديثة (Canvas Filter) اللازمة لعمل غبش وتضليل." : "Your browser does not support HTML5 Canvas graphics filters."
      };
    }

    return { supported: true, reason: "" };
  };

  // setVideoEffectMode: حلقة تغيير وضعية المعالجة وتشغيل محرك التصفية عند الطلب
  const setVideoEffectMode = async (newMode: 'normal' | 'blur' | 'bg') => {
    if (callState !== 'CONNECTED' || callType !== 'VIDEO') return;

    const canvas = document.getElementById('blurCanvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('[ResalaBlur] Hidden canvas #blurCanvas not found in DOM!');
      return;
    }

    const videoElement = document.getElementById('localVideo') as HTMLVideoElement;
    if (!videoElement) {
      console.error('[ResalaBlur] Local video element #localVideo not found in DOM!');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[ResalaBlur] Failed to get 2D context for #blurCanvas');
      return;
    }

    // فحص الأهلية البرمجية عند التفعيل
    if (newMode !== 'normal') {
      const capability = checkBrowserCapabilities(ctx);
      if (!capability.supported) {
        alert(isRtl 
          ? `عذراً، لا يمكن تفعيل هذه الميزة في متصفحك الحالي.\n\nالسبب: ${capability.reason}\n\nينصح بشدة باستخدام Google Chrome أو Microsoft Edge للحصول على تجربة كاملة.`
          : `Sorry, this feature is not supported in your current browser.\n\nReason: ${capability.reason}\n\nWe recommend using Google Chrome or Microsoft Edge.`
        );
        return; 
      }
    }

    console.log(`[ResalaBlur] setVideoEffectMode called. Mode: ${newMode}`);
    mode = newMode;
    setVideoMode(newMode);
    setIsBackgroundBlurred(newMode === 'blur');

    if (newMode === 'normal') {
      // TURN OFF VIDEO EFFECTS
      console.log('[ResalaBlur] Reverting to Normal camera...');
      try {
        // 1. Stop the MediaPipe camera loop
        if (camera) {
          console.log('[ResalaBlur] Stopping MediaPipe Camera utility...');
          await camera.stop();
          camera = null;
        }

        // 2. Revert RTCPeerConnection video track back to the original raw video track
        if (peerConnectionRef.current && originalRawVideoTrack) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            console.log('[ResalaBlur] Reverting track back to original raw camera video track...');
            await videoSender.replaceTrack(originalRawVideoTrack);
          }
        }

        // 3. Restore original stream in local preview
        if (localStreamRef.current && originalRawVideoTrack) {
          const rawAudioTrack = localStreamRef.current.getAudioTracks()[0];
          const restoredTracks = [originalRawVideoTrack];
          if (rawAudioTrack) restoredTracks.push(rawAudioTrack);
          setLocalStream(new MediaStream(restoredTracks));
        }

        // 4. Clear the canvas to prevent memory leaks
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (err) {
        console.error('[ResalaBlur] Failed to revert to normal video:', err);
      }
    } else {
      // TURN ON/SWITCH TO BLUR OR BG EFFECT
      setIsBlurLoading(true);
      console.log(`[ResalaBlur] Activating effect mode: ${newMode}...`);

      try {
        // 1. Cache the original raw video track if not already done
        if (localStreamRef.current && !originalRawVideoTrack) {
          originalRawVideoTrack = localStreamRef.current.getVideoTracks()[0];
          console.log('[ResalaBlur] Original raw video track cached:', originalRawVideoTrack?.label);
        }

        // Fix canvas dimensions to match video element
        if (videoElement.videoWidth && videoElement.videoHeight) {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
        } else {
          canvas.width = 640;
          canvas.height = 480;
        }

        // 2. Initialize SelfieSegmentation model using NPM import if not done
        if (!selfieSegmentation) {
          console.log('[ResalaBlur] Initializing local MediaPipe SelfieSegmentation model (NPM version)...');
          selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) => `/selfie_segmentation/${file}` // Serves locally offline from public directory!
          });

          selfieSegmentation.setOptions({
            modelSelection: 0 // General model selection for high shoulders/chair accuracy
          });

          // 3. onResults strictly compliant with safety valves and canvas composition
          selfieSegmentation.onResults((results: any) => {
            try {
              if (mode === 'normal' || !canvas || !ctx) return;

              ctx.save();
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // 1. Draw the segmentation mask
              ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

              // 2. Draw the raw video ONLY where the mask is (the person)
              ctx.globalCompositeOperation = 'source-in';
              ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

              // 3. Draw the background/blurred image behind the person
              ctx.globalCompositeOperation = 'destination-over';

              if (mode === 'blur') {
                ctx.filter = 'blur(20px)';  // 20px deep blur as in the updated lab code
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
              } 
              else if (mode === 'bg') {
                ctx.filter = 'none';
                const bgImg = document.getElementById('bgImg') as HTMLImageElement;
                if (bgImg) {
                  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
                } else {
                  // Fallback if image not preloaded
                  ctx.fillStyle = '#1e1e24';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
              }

              ctx.restore();
            } finally {
              // Open safety valve immediately to allow processing next frame
              isProcessingFrame = false;
            }
          });
        }

        // 4. Initialize and start MediaPipe's Camera utility using NPM import
        if (!camera) {
          console.log('[ResalaBlur] Starting MediaPipe Camera utility loop (NPM version)...');
          camera = new Camera(videoElement, {
            onFrame: async () => {
              if (mode !== 'normal' && selfieSegmentation) {
                // FPS Throttling & Hardware Relief (25 FPS limit)
                const timestamp = performance.now();
                if (timestamp - lastFrameTime < frameInterval) {
                  return;
                }

                // Concurrent Frame Safety Valve: prevent chocking RAM
                if (!isProcessingFrame) {
                  isProcessingFrame = true;
                  lastFrameTime = timestamp;
                  try {
                    await selfieSegmentation.send({ image: videoElement });
                  } catch (e) {
                    console.error('[ResalaBlur] Error inside segmentation loop:', e);
                    isProcessingFrame = false;
                  }
                }
              }
            },
            width: canvas.width,
            height: canvas.height
          });

          await camera.start();
        }

        // 5. Capture the stream once globally if not already captured
        if (!processedStream) {
          processedStream = (canvas as any).captureStream(30);
          console.log('[ResalaBlur] Canvas stream captured once globally.');
        }

        // Assemble unified stream with canvas track + raw audio track
        const rawAudioTrack = localStreamRef.current?.getAudioTracks()[0];
        const combinedTracks = [...processedStream!.getVideoTracks()];
        if (rawAudioTrack) combinedTracks.push(rawAudioTrack);
        const finalStream = new MediaStream(combinedTracks);

        // 6. Safe replaceTrack on RTCPeerConnection checking references
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            const blurredTrack = finalStream.getVideoTracks()[0];
            if (blurredTrack) {
              console.log('[ResalaBlur] Swapping track with processed canvas track via replaceTrack...');
              await videoSender.replaceTrack(blurredTrack);
            }
          }
        }

        // 7. Update React state for local preview
        setLocalStream(finalStream);
        console.log(`[ResalaBlur] Video effect ${newMode} enabled successfully!`);
      } catch (err) {
        console.error('[ResalaBlur] Failed to enable video effect:', err);
        mode = 'normal';
        setVideoMode('normal');
        setIsBackgroundBlurred(false);
      } finally {
        setIsBlurLoading(false);
      }
    }
  };

  // Backward compatibility toggle mapping
  const toggleBackgroundBlur = async () => {
    const nextMode = videoMode === 'blur' ? 'normal' : 'blur';
    await setVideoEffectMode(nextMode);
  };

  // Cleanup when unmounting
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  // Hook up incomingCallOverlay event handlers to prevent blocking confirms in Edge
  useEffect(() => {
    const overlay = document.getElementById('incomingCallOverlay');
    const acceptBtn = document.getElementById('acceptCallBtn');
    const rejectBtn = document.getElementById('rejectCallBtn');

    const handleAccept = () => {
      console.log('[incomingCallOverlay] Accept clicked.');
      acceptCall();
    };

    const handleReject = () => {
      console.log('[incomingCallOverlay] Reject clicked.');
      rejectCall();
    };

    if (callState === 'INCOMING' && overlay) {
      overlay.style.display = 'block';
      overlay.style.position = 'fixed';
      overlay.style.top = '16px';
      overlay.style.left = '50%';
      overlay.style.transform = 'translateX(-50%)';
      overlay.style.zIndex = '999999';
      overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
      overlay.style.border = '1px solid #334155';
      overlay.style.color = 'white';
      overlay.style.padding = '14px 28px';
      overlay.style.borderRadius = '16px';
      overlay.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.6)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.gap = '20px';
      overlay.style.fontFamily = 'sans-serif';
      overlay.style.fontSize = '14px';
      overlay.style.fontWeight = 'bold';

      if (acceptBtn) {
        acceptBtn.style.backgroundColor = '#10b981';
        acceptBtn.style.color = 'white';
        acceptBtn.style.border = 'none';
        acceptBtn.style.padding = '8px 18px';
        acceptBtn.style.borderRadius = '8px';
        acceptBtn.style.cursor = 'pointer';
        acceptBtn.style.fontWeight = 'bold';
        acceptBtn.addEventListener('click', handleAccept);
      }
      if (rejectBtn) {
        rejectBtn.style.backgroundColor = '#ef4444';
        rejectBtn.style.color = 'white';
        rejectBtn.style.border = 'none';
        rejectBtn.style.padding = '8px 18px';
        rejectBtn.style.borderRadius = '8px';
        rejectBtn.style.cursor = 'pointer';
        rejectBtn.style.fontWeight = 'bold';
        rejectBtn.addEventListener('click', handleReject);
      }
    } else if (overlay) {
      overlay.style.display = 'none';
    }

    return () => {
      if (acceptBtn) acceptBtn.removeEventListener('click', handleAccept);
      if (rejectBtn) rejectBtn.removeEventListener('click', handleReject);
    };
  }, [callState, acceptCall, rejectCall]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        chatId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        duration,
        isMuted,
        isVideoMuted,
        isScreenSharing,
        isBackgroundBlurred,
        isBlurLoading,
        videoMode,
        setVideoEffectMode,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        toggleBackgroundBlur,
        localStream,
        remoteStream
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
