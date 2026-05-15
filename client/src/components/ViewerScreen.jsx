import React, { useEffect, useState, useRef } from 'react';
import { X, Maximize2, ArrowLeft } from 'lucide-react';

function ViewerScreen({ group, user, onStop, emit, on }) {
  const [cameras, setCameras] = useState({}); // socketId -> { name, image }
  const [liveCamera, setLiveCamera] = useState(null); // socketId
  const liveVideoRef = useRef(null);
  const pcRef = useRef(null);

  useEffect(() => {
    emit('join-group-final', { 
      groupId: group.id, 
      userId: user.id, 
      username: user.first_name, 
      role: 'viewer' 
    });

    const cleanupUpdate = on('camera-update', ({ socketId, cameraName, image }) => {
      setCameras(prev => ({
        ...prev,
        [socketId]: { name: cameraName, image, lastUpdate: Date.now() }
      }));
    });

    const cleanupOffline = on('camera-offline', ({ socketId }) => {
      setCameras(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      if (liveCamera === socketId) setLiveCamera(null);
    });

    return () => {
      cleanupUpdate();
      cleanupOffline();
      emit('leave-group');
    };
  }, [emit, on, liveCamera, group.id, user.id, user.first_name]);

  const startLive = async (socketId) => {
    setLiveCamera(socketId);
    
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (liveVideoRef.current) liveVideoRef.current.srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) emit('ice-candidate', { target: socketId, candidate: e.candidate });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    emit('offer', { target: socketId, offer });
  };

  useEffect(() => {
    if (!liveCamera) return;

    const cleanupAnswer = on('answer', async ({ from, answer }) => {
      if (from === liveCamera && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    const cleanupIce = on('ice-candidate', ({ from, candidate }) => {
      if (from === liveCamera && pcRef.current) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      cleanupAnswer();
      cleanupIce();
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [liveCamera, on]);

  return (
    <div className="screen">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Огляд камер</h3>
        <button onClick={onStop} className="text-btn"><X size={24} /></button>
      </header>

      <div id="remote-videos-container">
        {Object.entries(cameras).map(([id, cam]) => (
          <div key={id} className="camera-card glass" onClick={() => startLive(id)}>
            <div className="camera-info">{cam.name}</div>
            <img src={cam.image} className="camera-snapshot" alt={cam.name} />
            <div className="live-badge">REC</div>
          </div>
        ))}
        {Object.keys(cameras).length === 0 && (
          <div className="center" style={{ gridColumn: '1/-1', padding: '40px', opacity: 0.5 }}>
            <p>Чекаємо на підключення камер...</p>
          </div>
        )}
      </div>

      {liveCamera && (
        <div className="screen" style={{ background: '#000', padding: 0, zIndex: 100 }}>
          <div className="video-container" style={{ borderRadius: 0 }}>
            <video ref={liveVideoRef} autoPlay playsInline muted></video>
            <div className="status-overlay">
              <span className="live-indicator">LIVE</span>
              <span>{cameras[liveCamera]?.name}</span>
            </div>
          </div>
          <div className="controls glass" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, background: 'none', border: 'none' }}>
            <button onClick={() => setLiveCamera(null)} className="secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} />
              Назад до огляду
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewerScreen;
