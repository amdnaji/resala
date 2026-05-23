import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { useSignalR } from './SignalRContext';

export type CallState = 'IDLE' | 'OUTGOING' | 'INCOMING' | 'CONNECTED' | 'DISCONNECTED' | 'BUSY';

interface AudioCallContextType {
  callState: CallState;
  chatId: string | null;
  callerId: string | null;
  callerName: string | null;
  receiverId: string | null;
  receiverName: string | null;
  duration: number;
  isMuted: boolean;
  startCall: (chatId: string, targetUserId: string, targetUserName: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  remoteStream: MediaStream | null;
}

const AudioCallContext = createContext<AudioCallContextType | undefined>(undefined);

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

export const AudioCallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { connection, isConnected } = useSignalR();

  // Call States
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [chatId, setChatId] = useState<string | null>(null);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // WebRTC References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Ringing & Call Tracking References
  const isCallerRef = useRef<boolean>(false);
  const durationRef = useRef<number>(0);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State refs to prevent closure issues in listeners
  const callStateRef = useRef<CallState>('IDLE');
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Call System Message logger
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
    
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }

    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }

    setRemoteStream(null);
    setIsMuted(false);
    setDuration(0);
  };

  // SignalR Event Listeners Setup
  useEffect(() => {
    if (!connection || !isConnected) return;

    // 1. INCOMING CALL
    const handleIncomingCall = (cId: string, fromUserId: string, fromName: string) => {
      console.log(`Incoming call received: Chat: ${cId}, From: ${fromName} (${fromUserId})`);
      if (callStateRef.current !== 'IDLE') {
        // We are already in a call, reject as busy
        connection.invoke('RejectCall', cId, fromUserId, 'BUSY').catch(console.error);
        return;
      }

      isCallerRef.current = false;
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
      audioTimerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start WebRTC Negotiation as Caller
      try {
        await initWebRTCPipeline(cId, byUserId, true);
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
      logCallMessage(cId, '[System:MissedCall]');

      setCallState('BUSY');
      sounds.stop();
      sounds.playBusy();

      // Return to idle after 3 seconds of busy signals
      setTimeout(() => {
        setCallState('IDLE');
        cleanupCall();
      }, 3500);
    };

    // 4. CALL ENDED
    const handleCallEnded = (cId: string, byUserId: string) => {
      console.log(`Call ended by: ${byUserId} in Chat: ${cId}`);

      if (isCallerRef.current && callStateRef.current === 'CONNECTED') {
        logCallMessage(cId, `[System:CompletedCall:${durationRef.current}]`);
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
      if (!pc) return;

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
      if (!pc) return;

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
  const initWebRTCPipeline = async (cId: string, targetUserId: string, isInitiator: boolean) => {
    // 1. Get user media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

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
      console.log('Remote audio track received');
      const [remoteMediaStream] = event.streams;
      setRemoteStream(remoteMediaStream);

      // Programmatically create HTML5 audio element to play sound
      if (!remoteAudioRef.current) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        remoteAudioRef.current = audio;
      }
      remoteAudioRef.current.srcObject = remoteMediaStream;
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

  // Caller: start call
  const startCall = async (cId: string, targetUserId: string, targetUserName: string) => {
    if (!connection || callState !== 'IDLE') return;

    isCallerRef.current = true;
    setCallState('OUTGOING');
    setChatId(cId);
    setReceiverId(targetUserId);
    setReceiverName(targetUserName);
    sounds.playDialing();

    // Ringing timeout (45 seconds)
    ringingTimeoutRef.current = setTimeout(() => {
      console.log('Call ringing timed out (no answer).');
      endCall();
    }, 45000);

    try {
      await connection.invoke('StartCall', cId, targetUserId);
    } catch (err) {
      console.error('SignalR start call failed:', err);
      setCallState('IDLE');
      cleanupCall();
    }
  };

  // Callee: accept call
  const acceptCall = async () => {
    if (!connection || callState !== 'INCOMING' || !chatId || !callerId) return;

    isCallerRef.current = false;
    sounds.playConnected();
    setCallState('CONNECTED');

    // Start timer
    setDuration(0);
    audioTimerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    try {
      await connection.invoke('AcceptCall', chatId, callerId);
      await initWebRTCPipeline(chatId, callerId, false);
    } catch (err) {
      console.error('SignalR accept call failed:', err);
      endCall();
    }
  };

  // Callee: reject call
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

  // Either party: end call
  const endCall = async () => {
    const targetUserId = targetUserIdRef.current;
    const cId = activeChatIdRef.current;

    console.log(`Ending call. Target: ${targetUserId}, Chat: ${cId}`);

    // If caller ends it while OUTGOING, or either ends it while CONNECTED
    if (cId) {
      if (callState === 'OUTGOING') {
        logCallMessage(cId, '[System:MissedCall]');
      } else if (callState === 'CONNECTED' && isCallerRef.current) {
        logCallMessage(cId, `[System:CompletedCall:${durationRef.current}]`);
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

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Auto clean up when context unmounts
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  return (
    <AudioCallContext.Provider
      value={{
        callState,
        chatId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        duration,
        isMuted,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        remoteStream
      }}
    >
      {children}
    </AudioCallContext.Provider>
  );
};

export const useAudioCall = () => {
  const context = useContext(AudioCallContext);
  if (context === undefined) {
    throw new Error('useAudioCall must be used within an AudioCallProvider');
  }
  return context;
};
