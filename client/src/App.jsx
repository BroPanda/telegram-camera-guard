import React, { useState, useEffect, useCallback } from 'react';
import useSocket from './hooks/useSocket';
import Menu from './components/Menu';
import GroupDashboard from './components/GroupDashboard';
import CameraScreen from './components/CameraScreen';
import ViewerScreen from './components/ViewerScreen';
import WaitingScreen from './components/WaitingScreen';

const tg = window.Telegram?.WebApp;

function App() {
  const [screen, setScreen] = useState('menu');
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('server_url') || 'https://telegram-camera-guard.onrender.com');
  const [user, setUser] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [debugMsg, setDebugMsg] = useState('Initializing...');

  const { socket, isConnected, emit, on } = useSocket(serverUrl);

  useEffect(() => {
    if (tg) {
      tg.expand();
      setUser(tg.initDataUnsafe?.user || { id: 'guest', first_name: 'Гість' });
    } else {
      setUser({ id: 'guest', first_name: 'Гість' });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('server_url', serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    if (isConnected && user) {
      setDebugMsg('Connected! Requesting groups...');
      emit('get-user-groups', user.id);
    } else if (!isConnected) {
      setDebugMsg('Disconnected. Checking URL...');
    }
  }, [isConnected, user, emit]);

  useEffect(() => {
    if (!socket) return;

    const cleanupGroups = on('user-groups', (groups) => {
      setUserGroups(groups);
      setDebugMsg(`Groups loaded: ${groups.length}`);
    });

    const cleanupApproved = on('join-approved', ({ groupId }) => {
      const group = userGroups.find(g => g.id === groupId) || { id: groupId, name: 'Схвалена група' };
      setCurrentGroup(group);
      setScreen('role');
    });

    const cleanupWaiting = on('join-waiting', () => {
      setScreen('waiting');
    });

    const cleanupRejected = on('join-rejected', () => {
        alert('Ваш запит відхилено або вас видалено з групи');
        setScreen('menu');
    });

    return () => {
      cleanupGroups();
      cleanupApproved();
      cleanupWaiting();
      cleanupRejected();
    };
  }, [socket, on, userGroups]);

  const handleSelectGroup = (group) => {
    setCurrentGroup(group);
    setIsAdmin(group.isAdmin);
    if (group.isPending) {
      setScreen('waiting');
    } else {
      setScreen('role');
    }
  };

  const handleBackToMenu = () => {
    setScreen('menu');
    setCurrentGroup(null);
    setIsAdmin(false);
  };

  return (
    <div id="app">
      {screen === 'menu' && (
        <Menu 
          user={user} 
          serverUrl={serverUrl} 
          setServerUrl={setServerUrl} 
          userGroups={userGroups}
          onSelectGroup={handleSelectGroup}
          emit={emit}
        />
      )}

      {screen === 'waiting' && (
        <WaitingScreen 
          group={currentGroup} 
          onCancel={() => setScreen('menu')} 
        />
      )}

      {screen === 'role' && (
        <GroupDashboard 
          group={currentGroup}
          isAdmin={isAdmin}
          onBack={handleBackToMenu}
          onSelectRole={(role, options) => {
            if (role === 'camera') {
              setScreen('camera');
              setCurrentGroup({ ...currentGroup, cameraName: options?.cameraName });
            } else {
              setScreen('viewer');
            }
          }}
          emit={emit}
          on={on}
          user={user}
        />
      )}

      {screen === 'camera' && (
        <CameraScreen 
          group={currentGroup}
          user={user}
          onStop={() => setScreen('role')}
          emit={emit}
          on={on}
        />
      )}

      {screen === 'viewer' && (
        <ViewerScreen 
          group={currentGroup}
          user={user}
          onStop={() => setScreen('role')}
          emit={emit}
          on={on}
        />
      )}

      <div className="debug-panel">
        LOG: <span>{debugMsg} ({isConnected ? 'ON' : 'OFF'})</span>
      </div>
    </div>
  );
}

export default App;
