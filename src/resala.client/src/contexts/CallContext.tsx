import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { useSignalR } from './SignalRContext';
import { WebGLRenderer } from '../utils/WebGLRenderer';
import { SegmentationEngine } from '../utils/SegmentationEngine';

export type CallState = 'IDLE' | 'PRE_CALL' | 'OUTGOING' | 'INCOMING' | 'CONNECTED' | 'DISCONNECTED' | 'BUSY';
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
  proceedToCall: () => Promise<void>;
  cancelPreCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleBackgroundBlur: () => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  selectedVideoDeviceId: string | null;
  selectedAudioDeviceId: string | null;
  changeVideoDevice: (deviceId: string) => Promise<void>;
  changeAudioDevice: (deviceId: string) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

// Global States for MediaPipe Tasks Vision Video Effects
let mode: 'normal' | 'blur' | 'bg' = 'normal';
let processedStream: MediaStream | null = null;
let originalRawVideoTrack: MediaStreamTrack | null = null;
let renderLoopActive = false;
let rawVideoElement: HTMLVideoElement | null = null;
let webglRenderer: WebGLRenderer | null = null;
let segmentationEngine: SegmentationEngine | null = null;


// Web Audio API Synthesizer Sound Generator
class CallSoundEffects {
  private ctx: AudioContext | null = null;
  private intervalIds: any[] = [];
  private activeSoundType: 'dialing' | 'ringing' | 'busy' | null = null;

  constructor() {
    this.playDialing = this.playDialing.bind(this);
    this.playRinging = this.playRinging.bind(this);
    this.playConnected = this.playConnected.bind(this);
    this.playDisconnected = this.playDisconnected.bind(this);
    this.playBusy = this.playBusy.bind(this);
    this.stop = this.stop.bind(this);
  }

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
    this.activeSoundType = 'dialing';
    this.initCtx();
    const playBeep = () => {
      if (this.activeSoundType !== 'dialing') return;
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
    const id = setInterval(playBeep, 3000);
    this.intervalIds.push(id);
  }

  playRinging() {
    this.stop();
    this.activeSoundType = 'ringing';
    this.initCtx();
    const playRing = () => {
      if (this.activeSoundType !== 'ringing') return;
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
    const id = setInterval(playRing, 3500);
    this.intervalIds.push(id);
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
    this.activeSoundType = 'busy';
    this.initCtx();
    const playBusyBeep = () => {
      if (this.activeSoundType !== 'busy') return;
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
    const id = setInterval(playBusyBeep, 600);
    this.intervalIds.push(id);
  }

  stop() {
    this.activeSoundType = null;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
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

  // Hardware Devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);

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
    // Select correct target user based on whether we are the caller or callee
    targetUserIdRef.current = isCallerRef.current ? receiverId : callerId;
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

    renderLoopActive = false;
    mode = 'normal';
    processedStream = null;
    originalRawVideoTrack = null;
    if (webglRenderer) {
      webglRenderer.destroy();
      webglRenderer = null;
    }
    if (segmentationEngine) {
      segmentationEngine.destroy();
      segmentationEngine = null;
    }
    setVideoMode('normal');

    if (rawVideoElement) {
      rawVideoElement.srcObject = null;
      if (rawVideoElement.parentNode) {
        rawVideoElement.parentNode.removeChild(rawVideoElement);
      }
      rawVideoElement = null;
    }

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
      await initializeDevices(stream);
      if (type === 'VIDEO') {
        triggerBackgroundSelfieSegmentationWarmup(stream);
      }
    }

    // 2. Setup RTCPeerConnection using internal STUN server exclusively (No external servers)
    const stunHost = window.location.hostname || 'localhost';
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: `stun:${stunHost}:3478` }
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

    // 7. If the caller already selected background blur/effects during dialing, hot-swap the track immediately
    if (mode !== 'normal' && processedStream) {
      const blurredTrack = processedStream.getVideoTracks()[0];
      if (blurredTrack) {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          console.log('[ResalaBlur] initWebRTCPipeline: Automatically hot-swapping track with active processed canvas track...');
          await videoSender.replaceTrack(blurredTrack).catch(err => {
            console.error('[ResalaBlur] Failed to auto replace track in pipeline:', err);
          });
        }
      }
    }
  };

  // Helper to trigger background warmup of SelfieSegmentation
  const triggerBackgroundSelfieSegmentationWarmup = async (stream: MediaStream) => {
    try {
      const canvas = document.getElementById('blurCanvas') as HTMLCanvasElement;
      if (!canvas) return;

      // Initialize WebGLRenderer
      if (!webglRenderer) {
        webglRenderer = new WebGLRenderer(canvas);
      }

      // Initialize SegmentationEngine using @mediapipe/tasks-vision
      if (!segmentationEngine) {
        console.log('[ResalaBlur] Pre-initializing local MediaPipe Tasks Vision ImageSegmenter...');
        segmentationEngine = new SegmentationEngine();
        await segmentationEngine.initialize();
      }

      // 2. Create/Warm up permanent rawVideoElement in background to avoid attachment delays later
      if (!rawVideoElement) {
        rawVideoElement = document.createElement('video');
        rawVideoElement.id = 'resalaRawVideo';
        rawVideoElement.autoplay = true;
        rawVideoElement.playsInline = true;
        rawVideoElement.muted = true;
        rawVideoElement.style.display = 'none';
        document.body.appendChild(rawVideoElement);
        console.log('[ResalaBlur] Warmup: Permanent raw video element created in DOM.');
      }

      const activeVideoTrack = stream.getVideoTracks()[0];
      if (activeVideoTrack && rawVideoElement.srcObject === null) {
        const rawStream = new MediaStream([activeVideoTrack]);
        rawVideoElement.srcObject = rawStream;

        rawVideoElement.onloadedmetadata = () => {
          rawVideoElement?.play().then(() => {
            console.log('[ResalaBlur] Warmup: Sending warmup frame to ImageSegmenter...');
            if (segmentationEngine && rawVideoElement) {
              segmentationEngine.segment(rawVideoElement, performance.now());
              console.log('[ResalaBlur] Warmup: Background warmup completed. WASM loaded successfully.');
            }
          }).catch(err => {
            console.warn('[ResalaBlur] Warmup: play() failed:', err);
          });
        };
      }
    } catch (err) {
      console.error('[ResalaBlur] Failed to trigger background SelfieSegmentation warmup:', err);
    }
  };

  // Helper to query available media devices
  const updateDeviceList = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter(d => d.kind === 'videoinput');
      const audios = devices.filter(d => d.kind === 'audioinput');
      setVideoDevices(videos);
      setAudioDevices(audios);
      console.log('[CallContext] Updated device list. Video devices:', videos.length, 'Audio devices:', audios.length);
    } catch (err) {
      console.error('[CallContext] Failed to enumerate devices:', err);
    }
  };

  // Helper to initialize active device selections based on warmed up stream
  const initializeDevices = async (stream: MediaStream) => {
    await updateDeviceList();
    
    const activeVideoTrack = stream.getVideoTracks()[0];
    const activeAudioTrack = stream.getAudioTracks()[0];
    
    if (activeVideoTrack) {
      const settings = activeVideoTrack.getSettings();
      if (settings.deviceId) {
        setSelectedVideoDeviceId(settings.deviceId);
        console.log('[CallContext] Selected video device initialized to:', settings.deviceId);
      }
    }
    if (activeAudioTrack) {
      const settings = activeAudioTrack.getSettings();
      if (settings.deviceId) {
        setSelectedAudioDeviceId(settings.deviceId);
        console.log('[CallContext] Selected audio device initialized to:', settings.deviceId);
      }
    }
  };

  // Handler to switch video input device dynamically
  const changeVideoDevice = async (deviceId: string) => {
    if (!deviceId) return;
    setSelectedVideoDeviceId(deviceId);

    if (localStreamRef.current) {
      console.log('[CallContext] Changing video device to:', deviceId);
      
      // Stop existing video tracks
      const currentVideoTracks = localStreamRef.current.getVideoTracks();
      currentVideoTracks.forEach(t => t.stop());

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: 1280, height: 720, frameRate: 30 },
          audio: false
        });
        const newVideoTrack = newStream.getVideoTracks()[0];

        if (newVideoTrack) {
          // If we are in blurred/bg mode, update originalRawVideoTrack and feed it to the raw video element
          if (mode !== 'normal') {
            originalRawVideoTrack = newVideoTrack;
            if (rawVideoElement) {
              rawVideoElement.srcObject = new MediaStream([newVideoTrack]);
              await rawVideoElement.play().catch(err => {
                console.error('[CallContext] Failed to restart rawVideoElement for new camera device:', err);
              });
            }
          } else {
            // Normal mode: construct a new combined stream for local rendering
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            const tracks = [newVideoTrack];
            if (audioTrack) tracks.push(audioTrack);
            
            const updatedStream = new MediaStream(tracks);
            localStreamRef.current = updatedStream;
            setLocalStream(updatedStream);
          }

          // If we have an active WebRTC peer connection, hot-swap the track
          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
              const trackToUse = mode !== 'normal' && processedStream
                ? processedStream.getVideoTracks()[0]
                : newVideoTrack;
              
              if (trackToUse) {
                console.log('[CallContext] Hot-swapping WebRTC video sender track with new device track...');
                await videoSender.replaceTrack(trackToUse);
              }
            }
          }
        }
      } catch (err) {
        console.error('[CallContext] Failed to change video device:', err);
      }
    }
  };

  // Handler to switch audio input device dynamically
  const changeAudioDevice = async (deviceId: string) => {
    if (!deviceId) return;
    setSelectedAudioDeviceId(deviceId);

    if (localStreamRef.current) {
      console.log('[CallContext] Changing audio device to:', deviceId);

      // Stop existing audio tracks
      const currentAudioTracks = localStreamRef.current.getAudioTracks();
      currentAudioTracks.forEach(t => t.stop());

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { deviceId: { exact: deviceId } }
        });
        const newAudioTrack = newStream.getAudioTracks()[0];

        if (newAudioTrack) {
          // Construct a new combined stream for local rendering
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          const tracks = [newAudioTrack];
          if (videoTrack) tracks.push(videoTrack);

          const updatedStream = new MediaStream(tracks);
          localStreamRef.current = updatedStream;
          setLocalStream(updatedStream);

          // If we have an active WebRTC peer connection, hot-swap the track
          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (audioSender) {
              console.log('[CallContext] Hot-swapping WebRTC audio sender track with new device track...');
              await audioSender.replaceTrack(newAudioTrack);
            }
          }
        }
      } catch (err) {
        console.error('[CallContext] Failed to change audio device:', err);
      }
    }
  };

  // Caller: Start call
  const startCall = async (cId: string, targetUserId: string, targetUserName: string, type: CallType) => {
    if (!connection || callState !== 'IDLE') return;

    isCallerRef.current = true;
    setCallType(type);
    setChatId(cId);
    setReceiverId(targetUserId);
    setReceiverName(targetUserName);

    // Warm up camera immediately for video call, but enter PRE_CALL lobby setup first
    if (type === 'VIDEO') {
      setCallState('PRE_CALL');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 1280, height: 720, frameRate: 30 }
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        await initializeDevices(stream);
        triggerBackgroundSelfieSegmentationWarmup(stream);
      } catch (err) {
        console.error("Failed to warm up camera on startCall PRE_CALL:", err);
      }
    } else {
      // Audio calls dial immediately
      setCallState('OUTGOING');
      sounds.playDialing();

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
    }
  };

  // Proceed to place the video call after user is satisfied in pre-call lobby
  const proceedToCall = async () => {
    if (callState !== 'PRE_CALL' || !chatId || !receiverId) return;

    setCallState('OUTGOING');
    sounds.playDialing();

    // Ringing timeout (45 seconds)
    ringingTimeoutRef.current = setTimeout(() => {
      console.log('Call ringing timed out (no answer).');
      endCall();
    }, 45000);

    try {
      if (connection) {
        await connection.invoke('StartCall', chatId, receiverId, 'VIDEO');
      }
    } catch (err) {
      console.error('SignalR start call from pre-call lobby failed:', err);
      setCallState('IDLE');
      cleanupCall();
    }
  };

  // Cancel call from pre-call lobby
  const cancelPreCall = () => {
    setCallState('IDLE');
    cleanupCall();
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
  const checkBrowserCapabilities = (canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2');
    const supportsWasm = typeof WebAssembly === "object";
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
    if (!gl) {
      return { 
        supported: false, 
        reason: isRtl ? "المتصفح لا يدعم تقنيات تسريع الرسوميات الحديثة (WebGL2) اللازمة لعزل الخلفية." : "Your browser does not support WebGL2 graphics acceleration."
      };
    }

    return { supported: true, reason: "" };
  };

  // setVideoEffectMode: حلقة تغيير وضعية المعالجة وتشغيل محرك التصفية عند الطلب
  const setVideoEffectMode = async (newMode: 'normal' | 'blur' | 'bg') => {
    if ((callState !== 'CONNECTED' && callState !== 'OUTGOING' && callState !== 'PRE_CALL') || callType !== 'VIDEO') return;

    const canvas = document.getElementById('blurCanvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('[ResalaBlur] Hidden canvas #blurCanvas not found in DOM!');
      return;
    }

    // فحص الأهلية البرمجية عند التفعيل
    if (newMode !== 'normal') {
      const capability = checkBrowserCapabilities(canvas);
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
    setIsBackgroundBlurred(newMode === 'blur');

    // For 'normal' mode, update videoMode immediately (CSS mirror stays on).
    // For blur/bg, defer videoMode update until the canvas stream is ready,
    // preventing the split-second CSS mirror removal before WebGL takes over.
    if (newMode === 'normal') {
      setVideoMode(newMode);
    }

    if (newMode === 'normal') {
      // TURN OFF VIDEO EFFECTS
      console.log('[ResalaBlur] Reverting to Normal camera...');
      try {
        // 1. Stop the render loop
        renderLoopActive = false;
        console.log('[ResalaBlur] Render loop stopped.');

        // 2. Clear raw video element stream - kept active to avoid toggle delays

        // 3. Revert RTCPeerConnection video track back to the original raw video track
        if (peerConnectionRef.current && originalRawVideoTrack) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            console.log('[ResalaBlur] Reverting track back to original raw camera video track...');
            await videoSender.replaceTrack(originalRawVideoTrack);
          }
        }

        // 4. Restore original stream in local preview
        if (localStreamRef.current && originalRawVideoTrack) {
          const rawAudioTrack = localStreamRef.current.getAudioTracks()[0];
          const restoredTracks = [originalRawVideoTrack];
          if (rawAudioTrack) restoredTracks.push(rawAudioTrack);
          setLocalStream(new MediaStream(restoredTracks));
        }

        // 5. Canvas clearing not needed for WebGL mode
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

        // 2. Initialize hidden raw video element if not done yet
        if (!rawVideoElement) {
          rawVideoElement = document.createElement('video');
          rawVideoElement.id = 'resalaRawVideo';
          rawVideoElement.autoplay = true;
          rawVideoElement.playsInline = true;
          rawVideoElement.muted = true;
          rawVideoElement.style.display = 'none';
          document.body.appendChild(rawVideoElement);
          console.log('[ResalaBlur] Hidden raw video element created in DOM.');
        }

        // Feed original raw camera stream to the hidden video element (only if not already set)
        if (rawVideoElement.srcObject === null) {
          if (originalRawVideoTrack) {
            const rawStream = new MediaStream([originalRawVideoTrack]);
            rawVideoElement.srcObject = rawStream;
            await rawVideoElement.play().catch(err => console.error('[ResalaBlur] Failed to play rawVideoElement:', err));
          } else if (localStreamRef.current) {
            const rawTracks = localStreamRef.current.getVideoTracks();
            if (rawTracks.length > 0) {
              const rawStream = new MediaStream([rawTracks[0]]);
              rawVideoElement.srcObject = rawStream;
              await rawVideoElement.play().catch(err => console.error('[ResalaBlur] Failed to play rawVideoElement fallback:', err));
            }
          }
        }

        // Fix canvas dimensions to match raw video element or fallback
        if (rawVideoElement && rawVideoElement.videoWidth && rawVideoElement.videoHeight) {
          canvas.width = rawVideoElement.videoWidth;
          canvas.height = rawVideoElement.videoHeight;
        } else {
          canvas.width = 640;
          canvas.height = 480;
        }

        // Initialize WebGLRenderer
        if (!webglRenderer) {
          webglRenderer = new WebGLRenderer(canvas);
        }

        // 3. Initialize Tasks Vision SegmentationEngine
        if (!segmentationEngine) {
          console.log('[ResalaBlur] Initializing local MediaPipe Tasks Vision ImageSegmenter...');
          segmentationEngine = new SegmentationEngine();
          await segmentationEngine.initialize();
        }

        // 5. Start requestAnimationFrame render loop using rawVideoElement
        if (!renderLoopActive) {
          renderLoopActive = true;
          console.log('[ResalaBlur] Starting requestAnimationFrame render loop...');

          const processFrame = () => {
            if (!renderLoopActive) return;
            if (mode !== 'normal' && segmentationEngine && webglRenderer && rawVideoElement) {
              try {
                const timestampMs = performance.now();
                const mask = segmentationEngine.segment(rawVideoElement, timestampMs);
                const bgImg = document.getElementById('bgImg') as HTMLImageElement;
                
                webglRenderer.render(rawVideoElement, mask, {
                  type: mode === 'blur' ? 'blur' : 'image',
                  source: bgImg || undefined
                });
              } catch (e) {
                console.error('[ResalaBlur] Error in segmentation frame:', e);
              }
            }
            if (renderLoopActive) {
              requestAnimationFrame(processFrame);
            }
          };

          requestAnimationFrame(processFrame);
        }

        // 6. Capture the stream once globally if not already captured
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
        // Set videoMode NOW — same React batch as stream switch, so CSS mirror
        // is removed at the exact same render as the WebGL-mirrored stream appears.
        setVideoMode(newMode);
        setIsBlurLoading(false);
        setLocalStream(finalStream);
        console.log(`[ResalaBlur] Video effect ${newMode} enabled successfully!`);
      } catch (err) {
        console.error('[ResalaBlur] Failed to enable video effect:', err);
        mode = 'normal';
        setVideoMode('normal');
        setIsBackgroundBlurred(false);
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
        proceedToCall,
        cancelPreCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        toggleBackgroundBlur,
        localStream,
        remoteStream,
        videoDevices,
        audioDevices,
        selectedVideoDeviceId,
        selectedAudioDeviceId,
        changeVideoDevice,
        changeAudioDevice
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
