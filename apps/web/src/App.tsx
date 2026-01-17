/**
 * @fileoverview Main application component
 */

import { useState, useEffect } from 'react';

import { Desktop } from './components/Desktop';
import { StatusBar } from './components/StatusBar';

import './globals.css';

/**
 * Main application component
 */
export function App(): JSX.Element {
  const [isBooting, setIsBooting] = useState(true);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  // Handle boot sequence
  useEffect(() => {
    const bootTimer = setTimeout(() => {
      setIsBooting(false);
    }, 2000);

    return (): void => {
      clearTimeout(bootTimer);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true);
    };

    const handleOffline = (): void => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return (): void => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="app">
      {isBooting ? (
        <BootScreen />
      ) : (
        <>
          <StatusBar isOnline={isOnline} />
          <Desktop />
        </>
      )}
    </div>
  );
}

/**
 * Boot screen component
 */
function BootScreen(): JSX.Element {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 100));
    }, 100);

    return (): void => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="boot-screen">
      <div className="boot-content">
        <h1 className="boot-title">
          SYMBI<span className="boot-title-accent">OS</span>
        </h1>
        <div className="boot-progress">
          <div className="boot-progress-bar" style={{ width: `${String(progress)}%` }} />
        </div>
        <p className="boot-status">Initializing multi-model kernel...</p>
      </div>
    </div>
  );
}
