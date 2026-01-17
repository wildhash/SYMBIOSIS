import React, { useState, useEffect } from 'react';
import { approvalQueue } from '../approval/queue';
import { ApprovalRequest, ApprovalDecision } from '../approval/types';
import './ApprovalQueue.css';

export const ApprovalQueue: React.FC = () => {
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);

  useEffect(() => {
    // Subscribe to queue updates
    const unsubscribe = approvalQueue.subscribe((queue) => {
      setPending(queue);
    });

    // Load initial pending requests
    setPending(approvalQueue.getPending());

    return unsubscribe;
  }, []);

  const handleApprove = (requestId: string) => {
    const decision: ApprovalDecision = {
      requestId,
      approved: true,
      approver: 'operator',
      reasoning: 'Approved by operator',
      timestamp: Date.now()
    };

    approvalQueue.processDecision(decision);
    setSelectedRequest(null);
  };

  const handleReject = (requestId: string, reasoning?: string) => {
    const decision: ApprovalDecision = {
      requestId,
      approved: false,
      approver: 'operator',
      reasoning: reasoning || 'Rejected by operator',
      timestamp: Date.now()
    };

    approvalQueue.processDecision(decision);
    setSelectedRequest(null);
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#666';
    }
  };

  return (
    <div className="approval-queue">
      <div className="queue-header">
        <h2>Approval Queue</h2>
        <div className="queue-stats">
          <span className="stat">
            <strong>{pending.length}</strong> Pending
          </span>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="empty-queue">
          <p>✓ No pending approvals</p>
        </div>
      ) : (
        <div className="requests-list">
          {pending.map(request => (
            <div 
              key={request.id} 
              className="request-card"
              style={{ borderLeftColor: getCriticalityColor(request.criticality) }}
            >
              <div className="request-header">
                <span className="criticality-badge" style={{ 
                  background: getCriticalityColor(request.criticality) 
                }}>
                  {request.criticality.toUpperCase()}
                </span>
                <span className="agent-type">{request.agentType}</span>
                <span className="timestamp">
                  {new Date(request.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="request-body">
                <h4>{request.action}</h4>
                <p>{request.description}</p>
              </div>

              <div className="request-actions">
                <button 
                  className="details-button"
                  onClick={() => setSelectedRequest(request)}
                >
                  View Details
                </button>
                <button 
                  className="reject-button"
                  onClick={() => handleReject(request.id)}
                >
                  Reject
                </button>
                <button 
                  className="approve-button"
                  onClick={() => handleApprove(request.id)}
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Approval Request Details</h3>
              <button className="close-button" onClick={() => setSelectedRequest(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <strong>Task ID:</strong> {selectedRequest.taskId}
              </div>
              <div className="detail-row">
                <strong>Agent:</strong> {selectedRequest.agentType}
              </div>
              <div className="detail-row">
                <strong>Action:</strong> {selectedRequest.action}
              </div>
              <div className="detail-row">
                <strong>Description:</strong> {selectedRequest.description}
              </div>
              <div className="detail-row">
                <strong>Criticality:</strong> 
                <span style={{ color: getCriticalityColor(selectedRequest.criticality) }}>
                  {selectedRequest.criticality}
                </span>
              </div>
              <div className="detail-row">
                <strong>Context:</strong>
                <pre>{JSON.stringify(selectedRequest.context, null, 2)}</pre>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => handleReject(selectedRequest.id)}>
                Reject
              </button>
              <button onClick={() => handleApprove(selectedRequest.id)}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
