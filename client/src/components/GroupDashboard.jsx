import React, { useState, useEffect } from 'react';
import { Camera, Eye, Trash2, Check, X, ArrowLeft } from 'lucide-react';

function GroupDashboard({ group, isAdmin, onBack, onSelectRole, emit, on, user }) {
  const [cameraName, setCameraName] = useState('Камера');
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    const cleanupRequest = on('join-request', (request) => {
      setPendingRequests(prev => {
        if (prev.find(r => r.userId === request.userId)) return prev;
        return [...prev, request];
      });
    });

    return () => {
      cleanupRequest();
    };
  }, [on]);

  const handleApprove = (req, approved) => {
    emit('approve-member', { groupId: group.id, userId: req.userId, approved });
    setPendingRequests(prev => prev.filter(p => p.userId !== req.userId));
  };

  const handleDeleteGroup = () => {
    if (window.confirm('Видалити цю групу назавжди?')) {
      emit('delete-group', { groupId: group.id, userId: user.id });
      onBack();
    }
  };

  return (
    <div className="screen">
      <div className="card glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>{group.name}</h2>
            <p style={{ opacity: 0.6 }}>ID: {group.id}</p>
          </div>
          {isAdmin && (
            <button onClick={handleDeleteGroup} className="icon-btn danger" style={{ background: 'none', padding: '5px' }}>
              <Trash2 size={20} color="#e74c3c" />
            </button>
          )}
        </div>
      </div>

      {isAdmin && pendingRequests.length > 0 && (
        <div className="card glass" style={{ borderColor: 'var(--primary)' }}>
          <h4 style={{ color: 'var(--primary)' }}>Запити на вступ ({pendingRequests.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingRequests.map(req => (
              <div key={req.userId} className="glass" style={{ padding: '10px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{req.username}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleApprove(req, true)} className="primary" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                    <Check size={16} />
                  </button>
                  <button onClick={() => handleApprove(req, false)} className="danger" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="role-cards">
        <div className="role-card glass">
          <div className="icon"><Camera size={48} color="var(--primary)" style={{ margin: '0 auto' }} /></div>
          <h3>Режим камери</h3>
          <p style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '10px' }}>Транслювати відео з цього пристрою</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={cameraName} 
              onChange={(e) => setCameraName(e.target.value)} 
              placeholder="Назва камери"
              style={{ flex: 1 }}
            />
            <button 
              onClick={() => onSelectRole('camera', { cameraName })} 
              className="primary"
            >
              Пуск
            </button>
          </div>
        </div>

        <div className="role-card glass" onClick={() => onSelectRole('viewer')} style={{ cursor: 'pointer' }}>
          <div className="icon"><Eye size={48} color="#00d2ff" style={{ margin: '0 auto' }} /></div>
          <h3>Режим глядача</h3>
          <p style={{ fontSize: '0.8em', opacity: 0.7 }}>Дивитися всі камери в цій групі</p>
          <button className="secondary" style={{ marginTop: '10px', width: '100%' }}>Увійти</button>
        </div>
      </div>

      <button onClick={onBack} className="text-btn">
        <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
        Назад до списку
      </button>
    </div>
  );
}

export default GroupDashboard;
