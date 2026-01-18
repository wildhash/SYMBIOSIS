/**
 * @fileoverview Status bar component
 */

import { useState, useEffect } from 'react';

/**
 * Status bar props
 */
interface IStatusBarProps {
  readonly isOnline: boolean;
}

/**
 * Status bar component
 */
export function StatusBar({ isOnline }: IStatusBarProps): JSX.Element {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return (): void => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-logo">SYMBIOSIS</span>
        <span className="status-bar-version">v0.1.0-alpha</span>
      </div>
      <div className="status-bar-right">
        <span>{time.toLocaleTimeString()}</span>
        <div className="status-indicator">
          <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span>{isOnline ? 'KERNEL READY' : 'OFFLINE'}</span>
        </div>
      </div>
    </div>
  );
}
