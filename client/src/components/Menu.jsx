import React, { useState } from 'react';

function Menu({ user, serverUrl, setServerUrl, userGroups, onSelectGroup, emit }) {
  const [newGroupName, setNewGroupName] = useState('');
  const [joinGroupId, setJoinGroupId] = useState('');

  const handleCreateGroup = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    emit('create-group', { 
      groupId: id, 
      userId: user.id, 
      username: user.first_name, 
      groupName: newGroupName || 'Нова група' 
    });
    setNewGroupName('');
  };

  const handleJoinGroup = () => {
    if (!joinGroupId) return;
    emit('join-group', { 
      groupId: joinGroupId.toUpperCase(), 
      userId: user.id, 
      username: user.first_name 
    });
    setJoinGroupId('');
  };

  return (
    <div className="screen">
      <header>
        <h1>Camera Guard</h1>
        <p>Вітаємо, {user?.first_name}!</p>
        <div className="server-config" style={{ marginTop: '10px' }}>
          <input 
            type="text" 
            value={serverUrl} 
            onChange={(e) => setServerUrl(e.target.value)} 
            placeholder="URL сервера (ngrok)"
            style={{ width: '100%', fontSize: '10px' }}
          />
        </div>
      </header>
      
      <div className="card glass">
        <h3>Створити групу</h3>
        <input 
          type="text" 
          value={newGroupName} 
          onChange={(e) => setNewGroupName(e.target.value)} 
          placeholder="Назва групи" 
        />
        <button onClick={handleCreateGroup} className="primary">Створити</button>
      </div>

      <div className="card glass">
        <h3>Приєднатися до групи</h3>
        <input 
          type="text" 
          value={joinGroupId} 
          onChange={(e) => setJoinGroupId(e.target.value)} 
          placeholder="ID групи" 
        />
        <button onClick={handleJoinGroup} className="secondary">Приєднатися</button>
      </div>

      {userGroups.length > 0 && (
        <div className="card glass">
          <h3>Ваші групи</h3>
          <div className="groups-list">
            {userGroups.map(group => (
              <div key={group.id} className="group-item glass">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{group.name}</div>
                  <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                    ID: {group.id} {group.isPending && '(Очікує...)'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="primary" 
                    style={{ padding: '8px 12px' }} 
                    onClick={() => onSelectGroup(group)}
                  >
                    {group.isPending ? 'Статус' : 'Увійти'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;
