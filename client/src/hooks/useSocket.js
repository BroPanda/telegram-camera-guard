import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const useSocket = (url) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    const s = io(url, {
      extraHeaders: { "ngrok-skip-browser-warning": "true" },
      reconnection: true,
      reconnectionDelay: 2000
    });

    s.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      socketRef.current = s;
      setSocket(s);
    });

    s.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    s.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
    });

    return () => {
      s.disconnect();
    };
  }, [url]);

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
    return () => {
        if(socketRef.current) socketRef.current.off(event, callback);
    }
  }, []);

  return { socket, isConnected, emit, on };
};

export default useSocket;
