import React, { useState } from 'react';
import { LLMProvider } from '../kernel/types';
import { 
  getModelInfo, 
  setProviderModel, 
  isUsingLatestModel,
  upgradeAllToLatest 
} from '../kernel/llm-config';
import './ModelSelector.css';

interface ModelSelectorProps {
  provider: LLMProvider;
  onModelChange?: (model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  provider, 
  onModelChange 
}) => {
  const modelInfo = getModelInfo(provider);
  const [selectedModel, setSelectedModel] = useState(modelInfo.current);
  const usingLatest = isUsingLatestModel(provider);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setProviderModel(provider, model);
    if (onModelChange) {
      onModelChange(model);
    }
  };

  return (
    <div className="model-selector">
      <label className="model-label">
        <span>Model Version:</span>
        {!usingLatest && (
          <span className="update-badge">Update Available</span>
        )}
      </label>
      <select 
        value={selectedModel}
        onChange={(e) => handleModelChange(e.target.value)}
        className="model-select"
      >
        {modelInfo.available.map((model, index) => (
          <option key={model} value={model}>
            {model} {index === 0 ? '(Latest)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

export const ModelUpgradePanel: React.FC = () => {
  const [, setShowUpgrade] = useState(true);
  
  const providers: LLMProvider[] = ['claude', 'gpt', 'gemini', 'deepseek'];
  const needsUpgrade = providers.some(p => !isUsingLatestModel(p));

  const handleUpgradeAll = () => {
    upgradeAllToLatest();
    setShowUpgrade(false);
    setTimeout(() => setShowUpgrade(true), 100);
  };

  if (!needsUpgrade) {
    return null;
  }

  return (
    <div className="model-upgrade-panel">
      <div className="upgrade-icon">⚡</div>
      <div className="upgrade-content">
        <h4>New Models Available</h4>
        <p>Upgrade to the latest AI models for improved performance</p>
      </div>
      <button onClick={handleUpgradeAll} className="upgrade-button">
        Upgrade All
      </button>
    </div>
  );
};
