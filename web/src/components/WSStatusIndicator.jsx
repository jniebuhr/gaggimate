import { useContext, useEffect, useState } from 'preact/hooks';
import { ApiServiceContext } from '../services/ApiService.js';

export function WSStatusIndicator() {
  const apiService = useContext(ApiServiceContext);
  const [status, setStatus] = useState('disconnected');
  const [secondsUntilReconnect, setSecondsUntilReconnect] = useState(null);

  useEffect(() => {
    if (!apiService) return;

    const interval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - apiService.lastMessageTime;
      const isConnected = apiService.socket?.readyState === WebSocket.OPEN;
      const isConnecting = apiService.socket?.readyState === WebSocket.CONNECTING;

      if (isConnecting) {
        setStatus('connecting');
        setSecondsUntilReconnect(null);
      } else if (!isConnected) {
        setStatus('disconnected');
        if (apiService.reconnectScheduledAt) {
          const seconds = Math.ceil((apiService.reconnectScheduledAt - Date.now()) / 1000);
          setSecondsUntilReconnect(seconds > 0 ? seconds : null);
        } else {
          setSecondsUntilReconnect(null);
        }
      } else if (timeSinceLastMessage > 2000) {
        setStatus('stale');
        setSecondsUntilReconnect(null);
      } else {
        setStatus('connected');
        setSecondsUntilReconnect(null);
      }
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [apiService]);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'stale':
        return 'bg-yellow-500';
      case 'connecting':
      case 'disconnected':
      default:
        return 'bg-red-500';
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'connected':
        return 'Connected to Gaggimate';
      case 'stale':
        return 'No recent messages from machine';
      case 'connecting': {
        return 'Connecting...';
      }
      case 'disconnected': {
        if (secondsUntilReconnect != null && secondsUntilReconnect > 0) {
          return `Gaggimate disconnected - reconnecting in ${secondsUntilReconnect}s`;
        }
        return 'Gaggimate disconnected';
      }
      default:
        return 'Gaggimate disconnected';
    }
  };

  return (
    <div className='tooltip tooltip-left' data-tip={getStatusTitle()}>
      <div className='relative inline-flex items-center justify-center'>
        <div
          className={`h-2 w-2 rounded-full ${getStatusColor()} transition-colors duration-100 ${status === 'connecting' ? 'animate-pulse' : ''}`}
        />
      </div>
    </div>
  );
}
