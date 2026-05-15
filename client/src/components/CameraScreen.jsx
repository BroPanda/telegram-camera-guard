import React, { useEffect, useRef, useState } from 'react';
import { StopCircle, RefreshCw } from 'lucide-react';

function CameraScreen({ group, user, onStop, emit, on }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('Ініціалізація камери...');
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, 
          audio: false 
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('Трансляція активна');

        // Join as camera
        emit('join-group-final', { 
          groupId: group.id, 
          userId: user.id, 
          username: user.first_name, 
          role: 'camera' 
        });

        // Start snapshot intervals
        intervalRef.current = setInterval(() => {
          captureSnapshot();
        }, 2000);

      } catch (err) {
        console.error('Camera error:', err);
        setStatus('Помилка доступу до камери');
      }
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    emit('leave-group');
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth / 2;
    canvas.height = videoRef.current.videoHeight / 2;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    emit('camera-snapshot', { 
      groupId: group.id, 
      cameraName: group.cameraName || 'Камера', 
      image: dataUrl 
    });
  };

  // WebRTC Signaling listeners (for live view requests)
  useEffect(() => {
    const pcMap = {}; // targetSocketId -> RTCPeerConnection

    const cleanupOffer = on('offer', async ({ from, offer }) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pcMap[from] = pc;
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
        }

        pc.onicecandidate = (e) => {
            if (e.candidate) emit('ice-candidate', { target: from, candidate: e.candidate });
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('answer', { target: from, answer });
    });

    const cleanupIce = on('ice-candidate', ({ from, candidate }) => {
        if (pcMap[from]) pcMap[from].addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
        cleanupOffer();
        cleanupIce();
        Object.values(pcMap).forEach(pc => pc.close());
    };
  }, [on, emit]);

  return (
    <div className="screen">
      <div className="video-container">
        <video ref={videoRef} autoPlay playsInline muted style={{ transform: 'scaleX(-1)' }}></video>
        <div className="status-overlay">
          <span className="live-indicator">LIVE</span>
          <span>{status}</span>
        </div>
      </div>
      <div className="card glass center">
        <h4>{group.cameraName || 'Камера'}</h4>
        <p style={{ fontSize: '0.8em', opacity: 0.6 }}>Трансляція в групу: {group.name}</p>
        <button onClick={onStop} className="danger" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <StopCircle size={20} />
          Зупинити трансляцію
        </button>
      </div>
    </div>
  );
}

export default CameraScreen;
