import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, User } from 'lucide-react';
import './App.css';

export default function DoctorCallInterface() {
  // Get API URLs from environment variables
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
  
  const [ws, setWs] = useState(null);
  const [doctorId] = useState('dr_sarah_123'); // In production, get from auth
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState([]);
  
  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    let websocket = null;
    let reconnectTimeout = null;
    let isUnmounting = false;

    const connectWebSocket = () => {
      if (isUnmounting) return;

      try {
        websocket = new WebSocket(WS_URL);
        
        websocket.onopen = () => {
          console.log('Connected to server');
          websocket.send(JSON.stringify({
            type: 'register',
            doctorId: doctorId
          }));
        };
        
        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            console.log('📨 Received:', data.type);
            
            if (data.type === 'incoming_call') {
              console.log('📞 Received incoming call data:', JSON.stringify(data, null, 2));
              setIncomingCall(data);
              playRingtone();
            }
            
            if (data.type === 'error') {
              console.error('Server error:', data.message);
              alert(`Error: ${data.message}`);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };
        
        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        websocket.onclose = () => {
          console.log('Disconnected from server');
          
          // Try to reconnect after 3 seconds if not unmounting
          if (!isUnmounting) {
            console.log('Attempting to reconnect in 3 seconds...');
            reconnectTimeout = setTimeout(() => {
              connectWebSocket();
            }, 3000);
          }
        };
        
        setWs(websocket);
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        
        // Retry connection
        if (!isUnmounting) {
          reconnectTimeout = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      }
    };

    // Initial connection
    connectWebSocket();
    
    return () => {
      isUnmounting = true;
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      if (websocket) {
        websocket.close();
      }
      
      stopWebRTCConnection();
    };
  }, [doctorId, WS_URL]);

  const playRingtone = () => {
    // Simple beep sound
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  };

  const startWebRTCConnection = async (callDataOverride = null) => {
    try {
      console.log('🔌 Starting WebRTC connection to OpenAI...');
      
      // Use callDataOverride if provided (from acceptCall), otherwise use activeCall state
      const currentCallData = callDataOverride || activeCall;
      
      console.log('📋 Using call data:', JSON.stringify(currentCallData, null, 2));
      
      // Get ephemeral token from backend
      const patientName = currentCallData?.patientName;
      const doctorName = currentCallData?.doctorName;
      
      console.log('🔑 Requesting ephemeral token with patient data:', {
        patientName: patientName,
        doctorName: doctorName,
        hasCallData: !!currentCallData
      });
      
      if (!patientName) {
        console.warn('⚠️ Warning: patientName is missing!');
        console.warn('   Call data keys:', currentCallData ? Object.keys(currentCallData) : 'null');
        console.warn('   Full call data:', currentCallData);
      }
      
      const tokenResponse = await fetch(`${API_URL}/api/get-ephemeral-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patientName || 'Patient',
          doctorName: doctorName || null
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        throw new Error(tokenData.error || 'Failed to get ephemeral token');
      }
      
      console.log('📦 Token response:', JSON.stringify(tokenData, null, 2));
      
      // The server returns { success: true, client_secret: "..." }
      // Handle case where client_secret might be an object with a value property
      let EPHEMERAL_KEY = tokenData.client_secret;
      
      console.log('🔍 Raw client_secret type:', typeof EPHEMERAL_KEY);
      console.log('🔍 Raw client_secret:', EPHEMERAL_KEY);
      
      if (EPHEMERAL_KEY && typeof EPHEMERAL_KEY === 'object') {
        console.log('🔍 client_secret is an object, extracting value...');
        // If it's an object, try to extract the value from common properties
        EPHEMERAL_KEY = EPHEMERAL_KEY.value || 
                        EPHEMERAL_KEY.client_secret || 
                        EPHEMERAL_KEY.token ||
                        EPHEMERAL_KEY.key ||
                        (Object.values(EPHEMERAL_KEY)[0]) || // First value if it's a simple object
                        null;
        console.log('🔍 Extracted value:', EPHEMERAL_KEY);
      }
      
      // Convert to string if it's not already
      if (EPHEMERAL_KEY && typeof EPHEMERAL_KEY !== 'string') {
        console.log('🔍 Converting to string from type:', typeof EPHEMERAL_KEY);
        EPHEMERAL_KEY = String(EPHEMERAL_KEY);
      }
      
      if (!EPHEMERAL_KEY || typeof EPHEMERAL_KEY !== 'string' || EPHEMERAL_KEY.trim().length === 0) {
        console.error('❌ Invalid token response:', tokenData);
        throw new Error('Invalid token response: client_secret is missing or invalid');
      }
      
      // Trim whitespace
      EPHEMERAL_KEY = EPHEMERAL_KEY.trim();
      
      console.log('🔑 Ephemeral key received');
      console.log('   Key type:', typeof EPHEMERAL_KEY);
      console.log('   Key length:', EPHEMERAL_KEY.length);
      // Safe substring - only if it's a string
      if (typeof EPHEMERAL_KEY === 'string' && EPHEMERAL_KEY.length > 0) {
        console.log('   Key starts with:', EPHEMERAL_KEY.substring(0, 10) + '...');
      } else {
        console.error('   Key is not a valid string!', EPHEMERAL_KEY);
      }
      
      console.log('✅ Ephemeral token received');
      
      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;
      
      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', pc.iceConnectionState);
      };
      
      // Set up to play remote audio from the model
      if (!audioElementRef.current) {
        const audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        audioElement.playsInline = true;
        audioElement.volume = 1.0; // Ensure volume is at max
        audioElement.muted = false; // Ensure not muted
        document.body.appendChild(audioElement); // Add to DOM
        audioElementRef.current = audioElement;
        console.log('🔊 Audio element created and added to DOM');
      }
      
      // Resume audio context if suspended (browser autoplay policy)
      // This is important for Chrome and other browsers that block autoplay
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        try {
          const audioContext = new AudioContextClass();
          console.log('🎵 Audio context state:', audioContext.state);
          if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              console.log('✅ Audio context resumed');
            }).catch(err => {
              console.warn('⚠️ Could not resume audio context:', err);
            });
          }
        } catch (err) {
          console.warn('⚠️ Could not create audio context:', err);
        }
      }
      
      pc.ontrack = (e) => {
        console.log('🔊 Received audio track from OpenAI');
        console.log('   Track kind:', e.track.kind);
        console.log('   Track enabled:', e.track.enabled);
        console.log('   Stream ID:', e.streams[0]?.id);
        console.log('   Stream tracks:', e.streams[0]?.getTracks().length);
        
        if (e.track.kind !== 'audio') {
          console.warn('⚠️ Received non-audio track, ignoring');
          return;
        }
        
        if (audioElementRef.current) {
          // Verify stream has audio tracks
          const stream = e.streams[0];
          if (!stream) {
            console.error('❌ No stream in track event');
            return;
          }
          
          const audioTracks = stream.getAudioTracks();
          console.log('🎵 Stream audio tracks:', audioTracks.length);
          if (audioTracks.length === 0) {
            console.warn('⚠️ Stream has no audio tracks');
          } else {
            audioTracks.forEach((track, idx) => {
              console.log(`   Track ${idx}:`, {
                enabled: track.enabled,
                readyState: track.readyState,
                id: track.id,
                label: track.label
              });
            });
          }
          
          // Stop any existing stream
          if (audioElementRef.current.srcObject) {
            const oldStream = audioElementRef.current.srcObject;
            oldStream.getTracks().forEach(track => track.stop());
          }
          
          // Set new stream
          audioElementRef.current.srcObject = stream;
          audioElementRef.current.volume = 1.0;
          audioElementRef.current.muted = false;
          
          // Ensure track is enabled
          e.track.enabled = true;
          
          // Log audio element state
          console.log('📻 Audio element configured:', {
            srcObject: !!audioElementRef.current.srcObject,
            volume: audioElementRef.current.volume,
            muted: audioElementRef.current.muted,
            paused: audioElementRef.current.paused,
            readyState: audioElementRef.current.readyState
          });
          
          // Wait for metadata to load, then play
          const playAudio = () => {
            audioElementRef.current.play().then(() => {
              console.log('✅ Audio playback started successfully');
              console.log('   Volume:', audioElementRef.current.volume);
              console.log('   Muted:', audioElementRef.current.muted);
              console.log('   Paused:', audioElementRef.current.paused);
            }).catch(err => {
              console.error('❌ Audio playback failed:', err);
              console.error('   Error name:', err.name);
              console.error('   Error message:', err.message);
              
              // Try to play on user interaction
              const tryPlayOnInteraction = () => {
                audioElementRef.current.play().then(() => {
                  console.log('✅ Audio playback started after user interaction');
                }).catch(playErr => {
                  console.error('❌ Still failed after interaction:', playErr);
                });
              };
              
              // Try multiple interaction types
              ['click', 'touchstart', 'keydown'].forEach(eventType => {
                document.body.addEventListener(eventType, tryPlayOnInteraction, { once: true });
              });
            });
          };
          
          // Try to play immediately
          playAudio();
          
          // Also try when audio is ready
          audioElementRef.current.addEventListener('loadedmetadata', () => {
            console.log('📻 Audio metadata loaded');
            playAudio();
          }, { once: true });
          
          // Monitor audio element state
          audioElementRef.current.addEventListener('play', () => {
            console.log('▶️ Audio is playing');
          });
          
          audioElementRef.current.addEventListener('pause', () => {
            console.log('⏸️ Audio is paused');
          });
          
          audioElementRef.current.addEventListener('error', (err) => {
            console.error('❌ Audio element error:', err);
          });
        }
      };
      
      // Add local audio track for microphone input
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      localStreamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);
      
      console.log('🎤 Microphone connected');
      
      // Set up data channel for sending and receiving events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;
      
      dc.onopen = () => {
        console.log('📡 Data channel opened - AI will start speaking in Urdu');
      };
      
      dc.onclose = () => {
        console.log('📡 Data channel closed');
      };
      
      dc.onerror = (error) => {
        console.error('❌ Data channel error:', error);
      };
      
      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          console.log('📨 Received event:', event.type);
          
          // Handle transcripts
          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            console.log('👨‍⚕️ Doctor said:', event.transcript);
            setTranscript(prev => [...prev, { speaker: 'Doctor', text: event.transcript }]);
          }
          
          if (event.type === 'response.audio_transcript.done') {
            console.log('🤖 AI said:', event.transcript);
            setTranscript(prev => [...prev, { speaker: 'AI', text: event.transcript }]);
          }
          
          if (event.type === 'response.done') {
            console.log('✅ AI response completed');
          }
          
          // Handle errors
          if (event.type === 'error') {
            console.error('❌ OpenAI error:', event.error);
            alert(`OpenAI error: ${event.error.message || JSON.stringify(event.error)}`);
          }
        } catch (error) {
          console.error('Error parsing data channel message:', error);
        }
      };
      
      // Start the session using SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('📤 Sending SDP offer to OpenAI...');
      
      // Verify EPHEMERAL_KEY is valid before making request
      if (!EPHEMERAL_KEY) {
        console.error('❌ EPHEMERAL_KEY is undefined or null');
        throw new Error('Invalid ephemeral key: key is missing');
      }
      
      if (typeof EPHEMERAL_KEY !== 'string') {
        console.error('❌ EPHEMERAL_KEY is not a string:', typeof EPHEMERAL_KEY, EPHEMERAL_KEY);
        throw new Error(`Invalid ephemeral key: expected string, got ${typeof EPHEMERAL_KEY}`);
      }
      
      const trimmedKey = EPHEMERAL_KEY.trim();
      if (trimmedKey.length === 0) {
        console.error('❌ EPHEMERAL_KEY is empty after trimming');
        throw new Error('Invalid ephemeral key: key is empty');
      }
      
      console.log('   Key length:', trimmedKey.length);
      console.log('   Key starts with:', trimmedKey.substring(0, 20) + '...');
      
      const authHeader = `Bearer ${trimmedKey}`;
      console.log('   Authorization header format:', authHeader.substring(0, 30) + '...');
      
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1'
        }
      });
      
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error('SDP exchange failed:', errorText);
        throw new Error(`SDP exchange failed: ${sdpResponse.status} ${sdpResponse.statusText} - ${errorText}`);
      }
      
      const answerSdp = await sdpResponse.text();
      console.log('✅ Received SDP answer from OpenAI');
      
      const answer = {
        type: 'answer',
        sdp: answerSdp
      };
      
      await pc.setRemoteDescription(answer);
      
      console.log('✅ WebRTC connection established with OpenAI!');
      
    } catch (error) {
      console.error('❌ Error starting WebRTC connection:', error);
      alert(`Failed to connect to AI: ${error.message}`);
    }
  };

  const stopWebRTCConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      if (audioElementRef.current.parentNode) {
        audioElementRef.current.parentNode.removeChild(audioElementRef.current);
      }
      audioElementRef.current = null;
    }
    
    console.log('🔌 WebRTC connection closed');
  };

  const acceptCall = () => {
    if (!incomingCall || !ws || ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot accept call: WebSocket not connected');
      return;
    }
    
    console.log('✅ Accepting call with data:', JSON.stringify(incomingCall, null, 2));
    console.log('   Patient Name:', incomingCall.patientName);
    console.log('   Doctor Name:', incomingCall.doctorName);
    console.log('   Patient ID:', incomingCall.patientId);
    console.log('   Doctor ID:', incomingCall.doctorId);
    
    // Store all call data in activeCall
    const callData = {
      ...incomingCall,
      patientName: incomingCall.patientName,
      doctorName: incomingCall.doctorName,
      patientId: incomingCall.patientId,
      doctorId: incomingCall.doctorId,
      appointmentType: incomingCall.appointmentType,
      symptoms: incomingCall.symptoms
    };
    
    setActiveCall(callData);
    setIncomingCall(null);
    setTranscript([]);
    
    // Start WebRTC connection to OpenAI
    // Pass callData directly to avoid state update timing issues
    startWebRTCConnection(callData);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    
    await fetch(`${API_URL}/api/reject-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: incomingCall.callId,
        patientId: incomingCall.patientId,
        doctorId: incomingCall.doctorId,
        reason: 'Doctor declined'
      })
    });
    
    setIncomingCall(null);
  };

  const endCall = async () => {
    if (!activeCall) return;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'call_ended',
          callId: activeCall.callId
        }));
      } catch (error) {
        console.error('Error sending end call message:', error);
      }
    }
    
    stopWebRTCConnection();
    setActiveCall(null);
    setTranscript([]);
  };


  return (
    <div className="call-interface">
      {/* Incoming Call Screen */}
      {incomingCall && !activeCall && (
        <div className="call-screen incoming-call">
          <div className="call-avatar">
            <User className="avatar-icon" />
          </div>
          <div className="call-info">
            <h2 className="caller-name">{incomingCall.patientName || 'Patient'}</h2>
            <p className="call-status">Incoming Call</p>
            <p className="caller-id">{incomingCall.patientId}</p>
          </div>
          <div className="call-actions">
            <button
              onClick={rejectCall}
              className="call-button reject-button"
              aria-label="Reject call"
            >
              <PhoneOff className="button-icon" />
            </button>
            <button
              onClick={acceptCall}
              className="call-button accept-button"
              aria-label="Accept call"
            >
              <Phone className="button-icon" />
            </button>
          </div>
        </div>
      )}

      {/* Active Call Screen */}
      {activeCall && (
        <div className="call-screen active-call">
          <div className="call-header">
            <div className="call-avatar active">
              <User className="avatar-icon" />
              <span className="pulse-ring"></span>
            </div>
            <div className="call-info">
              <h2 className="caller-name">{activeCall.patientName || 'Patient'}</h2>
              <p className="call-status">Call in progress</p>
            </div>
          </div>

          {/* Transcript Area */}
          <div className="transcript-container">
            <div className="transcript-header">
              <span className="transcript-label">Conversation</span>
              <span className="transcript-count">{transcript.length}</span>
            </div>
            <div className="transcript-content">
              {transcript.length === 0 ? (
                <div className="transcript-empty">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <p>Waiting for conversation...</p>
                </div>
              ) : (
                <div className="transcript-messages">
                  {transcript.map((item, idx) => (
                    <div
                      key={idx}
                      className={`message ${item.speaker === 'AI' ? 'message-ai' : 'message-doctor'}`}
                    >
                      <span className="message-speaker">
                        {item.speaker === 'AI' ? 'AI' : 'You'}
                      </span>
                      <p className="message-text">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Call Controls */}
          <div className="call-controls">
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                if (localStreamRef.current) {
                  localStreamRef.current.getTracks().forEach(track => {
                    track.enabled = isMuted;
                  });
                }
              }}
              className={`control-button ${isMuted ? 'muted' : ''}`}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="control-icon" /> : <Mic className="control-icon" />}
            </button>
            <button
              onClick={endCall}
              className="control-button end-call-button"
              aria-label="End call"
            >
              <PhoneOff className="control-icon" />
            </button>
          </div>
        </div>
      )}

      {/* Idle/Waiting Screen */}
      {!incomingCall && !activeCall && (
        <div className="call-screen waiting-screen">
          <div className="call-avatar idle">
            <Phone className="avatar-icon" />
          </div>
          <div className="call-info">
            <h2 className="caller-name">Ready</h2>
            <p className="call-status">Waiting for calls...</p>
          </div>
          <div className="status-indicators">
            <div className="status-item">
              <div className="status-dot online"></div>
              <span>Connected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}