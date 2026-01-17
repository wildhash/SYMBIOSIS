import React, { useState, useEffect } from 'react';
import { kernelRouter } from '../kernel/router';
import { LLMProvider } from '../kernel/types';
import { LLM_CONFIGS } from '../kernel/llm-config';
import { ModelSelector, ModelUpgradePanel } from './ModelSelector';
import './KernelMonitor.css';

export const KernelMonitor: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const providers: LLMProvider[] = ['claude', 'gpt', 'gemini', 'deepseek'];

  useEffect(() => {
    const checkOffline = () => {
      setIsOffline(kernelRouter.isOffline());
    };

    checkOffline();
    window.addEventListener('online', checkOffline);
    window.addEventListener('offline', checkOffline);

    return () => {
      window.removeEventListener('online', checkOffline);
      window.removeEventListener('offline', checkOffline);
    };
  }, []);

  const getProviderStatus = () => {
    return isOffline ? 'offline' : 'online';
  };

  return (
    <div className="kernel-monitor">
      <div className="monitor-header">
        <h2>Kernel Status</h2>
        <div className={`connection-status ${isOffline ? 'offline' : 'online'}`}>
          <span className="status-dot"></span>
          {isOffline ? 'Offline Mode' : 'Online'}
        </div>
      </div>

      <ModelUpgradePanel />

      <div className="providers-grid">
        {providers.map(provider => {
          const config = LLM_CONFIGS[provider];
          const status = getProviderStatus();
          
          return (
            <div key={provider} className={`provider-card ${status}`}>
              <div className="provider-header">
                <h3>{provider.toUpperCase()}</h3>
                <span className={`status-badge ${status}`}>
                  {status}
                </span>
              </div>
              
              <div className="provider-info">
                <ModelSelector provider={provider} />
                <div className="info-item">
                  <span className="label">Cost/Token:</span>
                  <span className="value">${config.costPerToken.toFixed(8)}</span>
                </div>
              </div>

              <div className="capabilities">
                <h4>Capabilities</h4>
                <div className="capability-bars">
                  {Object.entries(config.capabilities).map(([key, value]) => (
                    <div key={key} className="capability-bar">
                      <span className="cap-label">{key}</span>
                      <div className="bar-container">
                        <div 
                          className="bar-fill" 
                          style={{ width: `${value * 100}%` }}
                        ></div>
                      </div>
                      <span className="cap-value">{(value * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isOffline && (
        <div className="offline-notice">
          <p>⚠️ Running in offline mode. Some features may be limited.</p>
        </div>
      )}
    </div>
  );
};
