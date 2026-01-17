import { ApprovalRequest, ApprovalDecision, ApprovalStatus, CriticalityLevel } from './types';

/**
 * Approval Queue Manager
 * Manages human approval for critical AI agent decisions
 */
export class ApprovalQueue {
  private queue: ApprovalRequest[] = [];
  private history: ApprovalRequest[] = [];
  private listeners: Set<(queue: ApprovalRequest[]) => void> = new Set();

  /**
   * Add a request to the approval queue
   */
  addRequest(
    taskId: string,
    agentType: string,
    action: string,
    description: string,
    criticality: CriticalityLevel,
    context?: any
  ): ApprovalRequest {
    const request: ApprovalRequest = {
      id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      agentType,
      action,
      description,
      criticality,
      context: context || {},
      timestamp: Date.now(),
      status: 'pending'
    };

    this.queue.push(request);
    this.notifyListeners();
    
    return request;
  }

  /**
   * Process approval decision
   */
  processDecision(decision: ApprovalDecision): ApprovalRequest {
    const request = this.queue.find(r => r.id === decision.requestId);
    
    if (!request) {
      throw new Error(`Approval request not found: ${decision.requestId}`);
    }

    request.status = decision.approved ? 'approved' : 'rejected';
    request.approver = decision.approver;
    request.approvalTime = decision.timestamp;
    request.reasoning = decision.reasoning;

    // Move to history
    this.queue = this.queue.filter(r => r.id !== decision.requestId);
    this.history.push(request);

    this.notifyListeners();
    
    return request;
  }

  /**
   * Get pending requests
   */
  getPending(): ApprovalRequest[] {
    return [...this.queue].sort((a, b) => {
      // Sort by criticality first, then by timestamp
      const criticalityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const diff = criticalityOrder[a.criticality] - criticalityOrder[b.criticality];
      return diff !== 0 ? diff : a.timestamp - b.timestamp;
    });
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.queue.find(r => r.id === requestId) || 
           this.history.find(r => r.id === requestId);
  }

  /**
   * Get approval history
   */
  getHistory(limit?: number): ApprovalRequest[] {
    const sorted = [...this.history].sort((a, b) => 
      (b.approvalTime || b.timestamp) - (a.approvalTime || a.timestamp)
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Auto-approve low criticality requests older than threshold
   */
  autoApproveOldRequests(thresholdMs: number = 3600000): void {
    const now = Date.now();
    const toAutoApprove = this.queue.filter(
      r => r.criticality === 'low' && now - r.timestamp > thresholdMs
    );

    toAutoApprove.forEach(request => {
      this.processDecision({
        requestId: request.id,
        approved: true,
        approver: 'system-auto-approval',
        reasoning: 'Auto-approved after timeout',
        timestamp: Date.now()
      });
    });
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: ApprovalRequest[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const pending = this.getPending();
    this.listeners.forEach(listener => listener(pending));
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history = [];
    this.notifyListeners();
  }

  /**
   * Get statistics
   */
  getStatistics(): any {
    const approved = this.history.filter(r => r.status === 'approved').length;
    const rejected = this.history.filter(r => r.status === 'rejected').length;
    const pending = this.queue.length;

    return {
      pending,
      approved,
      rejected,
      total: approved + rejected,
      approvalRate: approved + rejected > 0 ? approved / (approved + rejected) : 0
    };
  }
}

// Singleton instance
export const approvalQueue = new ApprovalQueue();
