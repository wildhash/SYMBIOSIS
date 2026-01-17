// Agent types and interfaces
export type AgentType = 'architect' | 'coder' | 'executor' | 'critic';

export interface AgentTask {
  id: string;
  type: AgentType;
  description: string;
  context: any;
  priority: number;
  requiresApproval: boolean;
}

export interface AgentResult {
  taskId: string;
  agentType: AgentType;
  success: boolean;
  output: any;
  needsApproval: boolean;
  executionTime: number;
  error?: string;
}

export interface Agent {
  type: AgentType;
  execute(task: AgentTask): Promise<AgentResult>;
  canHandle(task: AgentTask): boolean;
}

export interface AgentMessage {
  from: AgentType;
  to: AgentType;
  content: any;
  timestamp: number;
}
