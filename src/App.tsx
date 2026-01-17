import React, { useState } from 'react';
import { AgentDashboard } from './components/AgentDashboard';
import { ApprovalQueue } from './components/ApprovalQueue';
import { KernelMonitor } from './components/KernelMonitor';
import { AgentResult } from './agents/types';
import { approvalQueue } from './approval/queue';
import './App.css';

type View = 'dashboard' | 'agents' | 'approvals' | 'kernel';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const handleTaskSubmit = (result: AgentResult) => {
    // If task needs approval, add to approval queue
    if (result.needsApproval && result.success) {
      approvalQueue.addRequest(
        result.taskId,
        result.agentType,
        'Task Execution',
        `${result.agentType} agent completed a task that requires approval`,
        result.agentType === 'architect' || result.agentType === 'coder' ? 'high' : 'medium',
        { result }
      );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🧬</span>
            <h1>SymbiOS</h1>
          </div>
          <p className="tagline">Browser-Native AI Operating System</p>
        </div>
        <nav className="nav-tabs">
          <button
            className={currentView === 'dashboard' ? 'active' : ''}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={currentView === 'kernel' ? 'active' : ''}
            onClick={() => setCurrentView('kernel')}
          >
            Kernel
          </button>
          <button
            className={currentView === 'agents' ? 'active' : ''}
            onClick={() => setCurrentView('agents')}
          >
            Agents
          </button>
          <button
            className={currentView === 'approvals' ? 'active' : ''}
            onClick={() => setCurrentView('approvals')}
          >
            Approvals
          </button>
        </nav>
      </header>

      <main className="app-main">
        {currentView === 'dashboard' && (
          <div className="dashboard-view">
            <div className="welcome-section">
              <h2>Welcome to SymbiOS</h2>
              <p>
                A browser-based AI-native operating system where multiple LLMs form a distributed kernel
                and AI agents are first-class applications.
              </p>
              <div className="features-grid">
                <div className="feature-card">
                  <span className="feature-icon">🧠</span>
                  <h3>Distributed LLM Kernel</h3>
                  <p>Claude, GPT, Gemini, and DeepSeek work together, routing tasks by capability, cost, and safety.</p>
                </div>
                <div className="feature-card">
                  <span className="feature-icon">🤖</span>
                  <h3>AI Agent Applications</h3>
                  <p>Architect, Coder, Executor, and Critic agents that can build and modify the OS itself.</p>
                </div>
                <div className="feature-card">
                  <span className="feature-icon">✓</span>
                  <h3>Human Supervision</h3>
                  <p>Critical decisions routed to approval queues for human operator review.</p>
                </div>
                <div className="feature-card">
                  <span className="feature-icon">📴</span>
                  <h3>Offline Capable</h3>
                  <p>Service worker enabled for offline operation and local state persistence.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'kernel' && <KernelMonitor />}
        {currentView === 'agents' && <AgentDashboard onTaskSubmit={handleTaskSubmit} />}
        {currentView === 'approvals' && <ApprovalQueue />}
      </main>

      <footer className="app-footer">
        <p>SymbiOS v0.1.0 - Enterprise-first, Self-evolving, Browser-native AI OS</p>
      </footer>
    </div>
  );
}

export default App;
