# SymbiOS 🧬

The browser-native AI operating system where multiple LLMs form the kernel and agents are the apps—self-evolving, human-supervised, enterprise-ready.

## Overview

SymbiOS is a revolutionary browser-based AI-native operating system that runs entirely in your web browser with no installation required. Multiple LLMs (Claude, GPT, Gemini, DeepSeek) act as a distributed kernel, intelligently routing tasks by capability, cost, and safety. AI agents (Architect, Coder, Executor, Critic) operate as first-class applications that can build and modify the OS itself.

## Key Features

### 🧠 Distributed LLM Kernel
- **Multi-LLM Architecture**: Claude Opus 4.5, ChatGPT 5.2, Gemini 2.0, and DeepSeek V3 work together as a distributed kernel
- **Latest Models**: Always uses the most recent and capable AI models (updated Jan 2026):
  - **Claude Opus 4.5**: Best reasoning and coding (99% scores)
  - **ChatGPT 5.2**: Advanced general-purpose AI with o3 reasoning
  - **Gemini 2.0 Flash**: Fastest multimodal model with excellent cost efficiency
  - **DeepSeek V3**: Best coding performance at lowest cost
- **Model Selection**: Choose specific model versions or auto-upgrade to latest
- **Zero-Day Updates**: Configuration designed for immediate updates when new models release
- **Intelligent Routing**: Tasks are automatically routed to the best LLM based on:
  - Capability matching (reasoning, coding, analysis)
  - Cost efficiency
  - Safety requirements
  - Task complexity
- **Real-time Monitoring**: Live kernel status and provider health monitoring

### 🤖 AI Agent System
Four specialized AI agents work together as first-class applications:

- **Architect Agent**: System design and planning
  - Analyzes requirements
  - Creates system architecture
  - Identifies components and patterns
  - Assesses risks

- **Coder Agent**: Code generation and modification
  - Implements features
  - Generates tests
  - Creates documentation
  - Can modify the OS itself

- **Executor Agent**: Task execution
  - Runs builds and tests
  - Executes deployments
  - Manages artifacts
  - Handles operational tasks

- **Critic Agent**: Code review and validation
  - Reviews code quality
  - Identifies issues
  - Provides suggestions
  - Performs security assessments

### ✓ Human Approval System
- **Approval Queues**: Critical decisions routed to human operators
- **Criticality Levels**: Tasks prioritized by importance (low, medium, high, critical)
- **Full Context**: Detailed information for informed decision-making
- **Approval History**: Complete audit trail of all decisions

### 📴 Offline Capabilities
- **Service Worker**: Full PWA support with offline functionality
- **Local Storage**: Persistent state across sessions
- **Offline Detection**: Automatic fallback to offline mode
- **Network Resilience**: Continues operating during connectivity issues

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/wildhash/SYMBIOSIS.git
cd SYMBIOSIS

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Usage

1. **Access the OS**: Open your browser to `http://localhost:5173` (dev) or deploy to any static hosting
2. **Explore the Kernel**: View the distributed LLM kernel status and provider capabilities
3. **Submit Tasks to Agents**: Use the Agents tab to submit tasks to different AI agents
4. **Review Approvals**: Check the Approvals queue for tasks requiring human oversight
5. **Monitor Operations**: Track all system activity in real-time

## Architecture

### System Components

```
┌─────────────────────────────────────────┐
│         Browser Environment              │
│  ┌───────────────────────────────────┐  │
│  │    Distributed LLM Kernel         │  │
│  │  ┌─────┬─────┬────────┬─────────┐ │  │
│  │  │Claude│ GPT │ Gemini │DeepSeek│ │  │
│  │  └─────┴─────┴────────┴─────────┘ │  │
│  │         Kernel Router              │  │
│  └───────────────────────────────────┘  │
│                  │                       │
│  ┌───────────────┴───────────────────┐  │
│  │       Agent Manager               │  │
│  │  ┌──────────┬──────────────────┐  │  │
│  │  │Architect │ Coder │Executor  │  │  │
│  │  │          │       │  Critic  │  │  │
│  │  └──────────┴──────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                  │                       │
│  ┌───────────────┴───────────────────┐  │
│  │      Approval Queue Manager       │  │
│  │    (Human Supervision Layer)      │  │
│  └───────────────────────────────────┘  │
│                  │                       │
│  ┌───────────────┴───────────────────┐  │
│  │        React UI Layer             │  │
│  │  Dashboard │ Agents │ Approvals   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 4
- **Styling**: CSS3 with modern features
- **PWA**: Vite PWA plugin + Workbox
- **State Management**: React hooks + singleton managers

## Project Structure

```
SYMBIOSIS/
├── src/
│   ├── kernel/              # Distributed LLM kernel
│   │   ├── types.ts         # Core kernel types
│   │   ├── llm-config.ts    # LLM configurations
│   │   └── router.ts        # Task routing logic
│   ├── agents/              # AI agent system
│   │   ├── types.ts         # Agent types
│   │   ├── architect.ts     # Architect agent
│   │   ├── coder.ts         # Coder agent
│   │   ├── executor.ts      # Executor agent
│   │   ├── critic.ts        # Critic agent
│   │   └── manager.ts       # Agent manager
│   ├── approval/            # Approval system
│   │   ├── types.ts         # Approval types
│   │   └── queue.ts         # Approval queue manager
│   ├── components/          # React components
│   │   ├── AgentDashboard   # Agent interface
│   │   ├── ApprovalQueue    # Approval UI
│   │   └── KernelMonitor    # Kernel status
│   ├── App.tsx              # Main application
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── index.html              # HTML template
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
└── README.md               # This file
```

## Configuration

### Updating AI Models

SymbiOS is designed for **zero-day model updates**. When new AI models are released:

#### Automatic Model Updates (UI)
1. Navigate to the **Kernel** tab
2. Click **"Upgrade All"** button when new models are available
3. Or select specific model versions from the dropdown for each provider

#### Manual Configuration (Code)
Edit `src/kernel/llm-config.ts`:

```typescript
// Update AVAILABLE_MODELS with new releases
export const AVAILABLE_MODELS: Record<LLMProvider, string[]> = {
  claude: [
    'claude-opus-4.5',           // Add new models at the top
    'claude-3-5-sonnet-20241022',
  ],
  gpt: [
    'chatgpt-5.2',               // Latest models first
    'o3',
  ],
  // ... other providers
};

// Update LLM_CONFIGS to use latest models
export const LLM_CONFIGS: Record<LLMProvider, LLMConfig> = {
  claude: {
    model: 'claude-opus-4.5',    // Set to latest
    capabilities: {
      reasoning: 0.99,           // Update capability scores
      coding: 0.99,
      // ...
    },
    costPerToken: 0.000015       // Update pricing
  },
  // ... other providers
};
```

#### Current Models (as of Jan 2026)
- **Claude**: Opus 4.5 (best reasoning & coding)
- **OpenAI**: ChatGPT 5.2 / o3 (advanced reasoning)
- **Google**: Gemini 2.0 Flash Exp (fastest multimodal)
- **DeepSeek**: V3 (best coding at lowest cost)

#### Where to Check for Updates
- Claude: https://docs.anthropic.com/claude/docs/models-overview
- OpenAI: https://platform.openai.com/docs/models
- Google: https://ai.google.dev/models/gemini
- DeepSeek: https://platform.deepseek.com/docs

### LLM Provider Configuration

Each LLM provider can be configured with:
- API endpoints
- API keys
- Model selection (runtime switching supported)
- Capability scores
- Cost per token

```typescript
// Runtime model switching
import { setProviderModel } from './kernel/llm-config';
setProviderModel('claude', 'claude-opus-4.5');
```

### Approval Thresholds

Configure which agent actions require approval:
- Architect: High criticality (system changes)
- Coder: High criticality (code modifications)
- Executor: Medium criticality (deployments)
- Critic: Low criticality (reviews)

## Enterprise Features

- **Self-Evolving**: Agents can modify and improve the OS itself
- **Human-Supervised**: Critical decisions require operator approval
- **Cost-Optimized**: Intelligent routing minimizes LLM API costs
- **Security-First**: Safety-critical tasks use most reliable providers
- **Audit Trail**: Complete history of all operations and approvals
- **Offline-First**: Continues operating without internet connectivity
- **No Installation**: Runs entirely in browser, zero setup required

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Fork of AIOS kernel concepts
- Inspired by VibeOS methodology
- Built for the enterprise-first, AI-native future

---

**SymbiOS v0.1.0** - Where AI agents build their own operating system. 🧬
