// Approval system types
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type CriticalityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApprovalRequest {
  id: string;
  taskId: string;
  agentType: string;
  action: string;
  description: string;
  criticality: CriticalityLevel;
  context: any;
  timestamp: number;
  status: ApprovalStatus;
  approver?: string;
  approvalTime?: number;
  reasoning?: string;
}

export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  approver: string;
  reasoning?: string;
  timestamp: number;
}
