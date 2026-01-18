/**
 * @fileoverview Desktop component
 */

/**
 * Feature card data
 */
interface IFeature {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}

/**
 * Features list
 */
const FEATURES: readonly IFeature[] = [
  {
    icon: '🧠',
    title: 'Distributed LLM Kernel',
    description: 'Claude, GPT, Gemini, and DeepSeek work together, routing tasks by capability.',
  },
  {
    icon: '🤖',
    title: 'AI Agent Applications',
    description: 'Architect, Coder, Executor, and Critic agents that can build and modify the OS.',
  },
  {
    icon: '✓',
    title: 'Human Supervision',
    description: 'Critical decisions routed to approval queues for human operator review.',
  },
  {
    icon: '📴',
    title: 'Offline Capable',
    description: 'Service worker enabled for offline operation and local state persistence.',
  },
];

/**
 * Desktop component
 */
export function Desktop(): JSX.Element {
  return (
    <div className="desktop">
      <div className="desktop-content">
        <div className="welcome-card">
          <h2 className="welcome-title">Welcome to SymbiOS</h2>
          <p className="welcome-description">
            A browser-based AI-native operating system where multiple LLMs form a distributed
            kernel and AI agents are first-class applications.
          </p>
          <div className="features-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="feature-card">
                <span className="feature-icon">{feature.icon}</span>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-text">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
