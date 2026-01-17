import { Agent, AgentTask, AgentResult, AgentType, AgentMessage } from './types';
import { ArchitectAgent } from './architect';
import { CoderAgent } from './coder';
import { ExecutorAgent } from './executor';
import { CriticAgent } from './critic';

/**
 * Agent Manager - Coordinates all AI agents
 * Manages agent lifecycle, communication, and task distribution
 */
export class AgentManager {
  private agents: Map<AgentType, Agent> = new Map();
  private taskQueue: AgentTask[] = [];
  private results: Map<string, AgentResult> = new Map();
  private messageQueue: AgentMessage[] = [];

  constructor() {
    // Initialize all agents
    this.agents.set('architect', new ArchitectAgent());
    this.agents.set('coder', new CoderAgent());
    this.agents.set('executor', new ExecutorAgent());
    this.agents.set('critic', new CriticAgent());
  }

  /**
   * Submit a task to an agent
   */
  async submitTask(task: AgentTask): Promise<AgentResult> {
    const agent = this.agents.get(task.type);
    
    if (!agent) {
      throw new Error(`Agent not found for type: ${task.type}`);
    }

    if (!agent.canHandle(task)) {
      throw new Error(`Agent cannot handle task: ${task.id}`);
    }

    // Add to queue
    this.taskQueue.push(task);

    // Execute task
    const result = await agent.execute(task);
    
    // Store result
    this.results.set(result.taskId, result);

    return result;
  }

  /**
   * Get agent by type
   */
  getAgent(type: AgentType): Agent | undefined {
    return this.agents.get(type);
  }

  /**
   * Get task result
   */
  getResult(taskId: string): AgentResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Send message between agents
   */
  sendMessage(from: AgentType, to: AgentType, content: any): void {
    const message: AgentMessage = {
      from,
      to,
      content,
      timestamp: Date.now()
    };
    this.messageQueue.push(message);
  }

  /**
   * Get messages for an agent
   */
  getMessages(agentType: AgentType): AgentMessage[] {
    return this.messageQueue.filter(msg => msg.to === agentType);
  }

  /**
   * Get all pending tasks
   */
  getPendingTasks(): AgentTask[] {
    return this.taskQueue.filter(task => !this.results.has(task.id));
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    const completed = Array.from(this.results.keys());
    this.taskQueue = this.taskQueue.filter(
      task => !completed.includes(task.id)
    );
  }
}

// Singleton instance
export const agentManager = new AgentManager();
