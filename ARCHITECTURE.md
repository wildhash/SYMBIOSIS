# SymbiOS Architecture

## Overview

SymbiOS is a browser-based AI-native operating system that implements a revolutionary architecture where multiple Large Language Models (LLMs) function as a distributed kernel, and AI agents operate as first-class applications.

## System Architecture

### Layer 1: Distributed LLM Kernel

The kernel layer consists of multiple LLM providers working together:

```
┌─────────────────────────────────────────┐
│     Distributed LLM Kernel              │
│                                         │
│  ┌────────┬──────┬────────┬──────────┐ │
│  │ Claude │ GPT  │ Gemini │DeepSeek │ │
│  └────────┴──────┴────────┴──────────┘ │
│              │                          │
│      ┌───────┴───────┐                 │
│      │ Kernel Router │                 │
│      └───────────────┘                 │
└─────────────────────────────────────────┘
```

**Kernel Router** (`src/kernel/router.ts`)
- Routes tasks to optimal LLM based on:
  - Capability matching (reasoning, coding, analysis)
  - Cost efficiency
  - Safety requirements
  - Task complexity
  - Network availability

**LLM Configurations** (`src/kernel/llm-config.ts`)
- Claude 3.5 Sonnet: Best for reasoning & coding (98% coding score)
- GPT-4 Turbo: Balanced performance (92% coding, 90% reasoning)
- Gemini Pro: Cost-efficient analysis (90% cost efficiency)
- DeepSeek Coder: Specialized coding at low cost (95% coding, 95% cost efficiency)

### Layer 2: AI Agent System

Four specialized agents operate as first-class applications:

```
┌─────────────────────────────────────────┐
│        Agent Manager                    │
│                                         │
│  ┌──────────┬────────┬─────────────┐  │
│  │Architect │ Coder  │  Executor   │  │
│  │          │        │   Critic    │  │
│  └──────────┴────────┴─────────────┘  │
└─────────────────────────────────────────┘
```

**Architect Agent** (`src/agents/architect.ts`)
- System design and planning
- Architecture recommendations
- Component identification
- Risk assessment
- Routes to LLMs with high reasoning capability

**Coder Agent** (`src/agents/coder.ts`)
- Code generation and modification
- Test generation
- Documentation creation
- Can modify the OS itself
- Routes to LLMs with high coding capability

**Executor Agent** (`src/agents/executor.ts`)
- Task execution
- Build and deployment
- Artifact collection
- Routes to fast, cost-efficient LLMs

**Critic Agent** (`src/agents/critic.ts`)
- Code review and validation
- Issue identification
- Security assessment
- Improvement suggestions
- Routes to LLMs with high analysis and safety

### Layer 3: Human Approval System

```
┌─────────────────────────────────────────┐
│     Approval Queue Manager              │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Criticality-based Prioritization│  │
│  │  - Critical: Immediate attention  │  │
│  │  - High: System modifications     │  │
│  │  - Medium: Standard operations    │  │
│  │  - Low: Routine tasks            │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Approval Queue** (`src/approval/queue.ts`)
- Manages critical decision workflows
- Prioritizes by criticality level
- Maintains approval history
- Auto-approves low-priority old requests
- Real-time notification system

### Layer 4: User Interface

```
┌─────────────────────────────────────────┐
│          React UI Layer                 │
│                                         │
│  ┌───────────┬──────────┬────────────┐ │
│  │ Dashboard │  Kernel  │   Agents   │ │
│  │           │ Monitor  │ Dashboard  │ │
│  │           │          │            │ │
│  │           │          │ Approval   │ │
│  │           │          │   Queue    │ │
│  └───────────┴──────────┴────────────┘ │
└─────────────────────────────────────────┘
```

**Dashboard** (`src/App.tsx`)
- Welcome screen with feature overview
- Navigation to all system components

**Kernel Monitor** (`src/components/KernelMonitor.tsx`)
- Real-time LLM provider status
- Capability visualization
- Cost tracking
- Online/offline mode indicator

**Agent Dashboard** (`src/components/AgentDashboard.tsx`)
- Task submission interface
- Agent selection
- Task results display
- Real-time execution feedback

**Approval Queue** (`src/components/ApprovalQueue.tsx`)
- Pending approval list
- Detailed request view
- Approve/reject functionality
- Approval history

## Data Flow

### Task Execution Flow

```
1. User submits task → Agent Dashboard
2. Agent Manager receives task → Selects appropriate agent
3. Agent analyzes task → Determines requirements
4. Kernel Router evaluates → Routes to best LLM
5. LLM processes task → Returns result
6. Agent processes result → Checks if approval needed
7a. If needs approval → Adds to Approval Queue → Waits for human
7b. If no approval → Returns result immediately
8. Human approves/rejects → Updates task status
9. Result displayed → User sees outcome
```

### Offline Mode Flow

```
1. Network disconnection detected
2. Kernel Router switches to offline mode
3. Uses local fallback LLM (DeepSeek)
4. Service Worker serves cached assets
5. Local storage maintains state
6. System continues operating with reduced functionality
7. Network reconnection → Full functionality restored
```

## Technology Stack

### Frontend
- **React 18**: Component-based UI
- **TypeScript**: Type-safe development
- **CSS3**: Modern styling with gradients and animations
- **Vite 4**: Fast build tool with HMR

### Backend (Browser-side)
- **Service Workers**: Offline support via PWA
- **Local Storage**: State persistence
- **Workbox**: Advanced caching strategies

### Build & Development
- **ESLint**: Code linting
- **TypeScript Compiler**: Type checking
- **Vite PWA Plugin**: Progressive Web App features

## Security Considerations

1. **LLM Safety Routing**: Critical tasks routed to most reliable providers
2. **Human Approval**: High-criticality actions require human review
3. **Input Validation**: All user inputs validated
4. **Audit Trail**: Complete history of all approvals and decisions
5. **No Direct API Keys**: API keys should be configured via environment

## Scalability

- **Horizontal**: Add more LLM providers to kernel
- **Vertical**: Upgrade to more capable models
- **Agent Extension**: Easy to add new specialized agents
- **Task Queuing**: Built-in queue management for high load

## Future Enhancements

1. **Local LLM Support**: Run models in-browser with WebGPU
2. **Agent Collaboration**: Multi-agent task coordination
3. **Learning System**: Improve routing decisions over time
4. **Version Control**: Track OS self-modifications
5. **Plugin System**: Third-party agent extensions
6. **Multi-user**: Collaborative approval workflows

## Development Guidelines

### Adding a New Agent

1. Create agent file in `src/agents/`
2. Implement `Agent` interface
3. Define task requirements for LLM routing
4. Register agent in `AgentManager`
5. Add UI component if needed

### Adding a New LLM Provider

1. Add provider to `LLMProvider` type in `src/kernel/types.ts`
2. Configure capabilities in `src/kernel/llm-config.ts`
3. Update router logic if needed
4. Add provider UI card in `KernelMonitor`

### Modifying Approval Logic

1. Update criticality levels in `src/approval/types.ts`
2. Modify routing logic in agents
3. Update UI to reflect new approval rules
4. Test approval workflows thoroughly

## Performance Optimization

- **Code Splitting**: Vite handles automatic splitting
- **Lazy Loading**: Components loaded on demand
- **Service Worker Caching**: Static assets cached
- **Minimal Re-renders**: React optimization techniques
- **CSS Optimization**: Efficient selectors and animations

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## Deployment

### Static Hosting (Recommended)
```bash
npm run build
# Deploy dist/ folder to:
# - Vercel
# - Netlify
# - GitHub Pages
# - Cloudflare Pages
# - Any static hosting
```

### Docker (Optional)
```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html
```

## Configuration

### Environment Variables
```env
VITE_CLAUDE_API_KEY=sk-...
VITE_OPENAI_API_KEY=sk-...
VITE_GEMINI_API_KEY=...
VITE_DEEPSEEK_API_KEY=...
```

### Runtime Configuration
```typescript
// Update provider configs at runtime
kernelRouter.updateProviderConfig('claude', {
  apiKey: 'your-key',
  endpoint: 'custom-endpoint'
});
```

## Testing Strategy

1. **Unit Tests**: Individual agent and kernel functions
2. **Integration Tests**: Agent-kernel interactions
3. **E2E Tests**: Full user workflows
4. **Manual Testing**: UI/UX validation
5. **Performance Tests**: Load and stress testing

---

**SymbiOS** - Where AI agents build their own operating system. 🧬
