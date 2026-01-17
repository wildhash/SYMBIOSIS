import React, { useState } from 'react';
import { agentManager } from '../agents/manager';
import { AgentTask, AgentResult, AgentType } from '../agents/types';
import './AgentDashboard.css';

interface AgentDashboardProps {
  onTaskSubmit?: (result: AgentResult) => void;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ onTaskSubmit }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('architect');
  const [taskDescription, setTaskDescription] = useState('');
  const [results, setResults] = useState<AgentResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const agents: AgentType[] = ['architect', 'coder', 'executor', 'critic'];

  const handleSubmitTask = async () => {
    if (!taskDescription.trim()) return;

    setIsProcessing(true);

    const task: AgentTask = {
      id: `task-${Date.now()}`,
      type: selectedAgent,
      description: taskDescription,
      context: {},
      priority: 1,
      requiresApproval: selectedAgent === 'coder' || selectedAgent === 'architect'
    };

    try {
      const result = await agentManager.submitTask(task);
      setResults(prev => [result, ...prev]);
      setTaskDescription('');
      
      if (onTaskSubmit) {
        onTaskSubmit(result);
      }
    } catch (error) {
      console.error('Task submission failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="agent-dashboard">
      <div className="dashboard-header">
        <h2>AI Agents Dashboard</h2>
        <div className="agent-status">
          {agents.map(agent => (
            <div key={agent} className="agent-badge">
              <span className="agent-icon">🤖</span>
              <span className="agent-name">{agent}</span>
              <span className="status-indicator active"></span>
            </div>
          ))}
        </div>
      </div>

      <div className="task-submission">
        <h3>Submit Task</h3>
        <div className="form-group">
          <label>Select Agent:</label>
          <select 
            value={selectedAgent} 
            onChange={(e) => setSelectedAgent(e.target.value as AgentType)}
            disabled={isProcessing}
          >
            {agents.map(agent => (
              <option key={agent} value={agent}>
                {agent.charAt(0).toUpperCase() + agent.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Task Description:</label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Describe the task for the agent..."
            rows={4}
            disabled={isProcessing}
          />
        </div>

        <button 
          onClick={handleSubmitTask}
          disabled={isProcessing || !taskDescription.trim()}
          className="submit-button"
        >
          {isProcessing ? 'Processing...' : 'Submit Task'}
        </button>
      </div>

      <div className="results-section">
        <h3>Task Results</h3>
        {results.length === 0 ? (
          <p className="no-results">No tasks completed yet</p>
        ) : (
          <div className="results-list">
            {results.map(result => (
              <div key={result.taskId} className={`result-card ${result.success ? 'success' : 'error'}`}>
                <div className="result-header">
                  <span className="agent-type">{result.agentType}</span>
                  <span className="execution-time">{result.executionTime}ms</span>
                  <span className={`status ${result.success ? 'success' : 'error'}`}>
                    {result.success ? '✓' : '✗'}
                  </span>
                </div>
                <div className="result-content">
                  {result.success ? (
                    <div>
                      <strong>Provider:</strong> {result.output?.provider || 'N/A'}
                      {result.needsApproval && (
                        <span className="approval-badge">Needs Approval</span>
                      )}
                    </div>
                  ) : (
                    <div className="error-message">{result.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
