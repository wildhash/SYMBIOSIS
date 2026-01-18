/**
 * @fileoverview Tests for ApprovalGate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';

import { noopLogger, ApprovalLevel } from '@symbiosis/shared';

import {
  ApprovalGate,
  ApprovalStatus,
  ApprovalGateErrorCode,
  createApprovalGate,
} from './approval-gate';
import type { IApprovalGateConfig } from './approval-gate';

describe('ApprovalGate', () => {
  const defaultConfig: IApprovalGateConfig = {
    defaultTimeoutMs: 5000,
    autoApproveLevel: ApprovalLevel.AUTO,
  };

  let gate: ApprovalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    gate = new ApprovalGate(defaultConfig, noopLogger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requestApproval', () => {
    it('should create a pending approval request', () => {
      const result = gate.requestApproval(
        'delete_file',
        'Delete important file',
        ApprovalLevel.APPROVE,
        'agent-1',
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.operation).toBe('delete_file');
        expect(result.value.status).toBe(ApprovalStatus.PENDING);
        expect(result.value.agentId).toBe('agent-1');
      }
    });

    it('should auto-approve AUTO level requests', () => {
      const result = gate.requestApproval(
        'read_file',
        'Read a file',
        ApprovalLevel.AUTO,
        'agent-1',
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(ApprovalStatus.AUTO_APPROVED);
      }
    });

    it('should block BLOCK level requests', () => {
      const result = gate.requestApproval(
        'dangerous_op',
        'Very dangerous',
        ApprovalLevel.BLOCK,
        'agent-1',
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ApprovalGateErrorCode.BLOCKED);
      }
    });

    it('should include context in request', () => {
      const context = { file: 'test.txt', reason: 'cleanup' };
      const result = gate.requestApproval(
        'delete_file',
        'Delete file',
        ApprovalLevel.APPROVE,
        'agent-1',
        context,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.context).toEqual(context);
      }
    });

    it('should emit request to stream', async () => {
      const streamPromise = firstValueFrom(gate.getRequestStream());

      gate.requestApproval('test_op', 'Test', ApprovalLevel.APPROVE, 'agent-1');

      const request = await streamPromise;
      expect(request.operation).toBe('test_op');
    });
  });

  describe('approve', () => {
    it('should approve a pending request', () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.APPROVE,
        'agent-1',
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      const approveResult = gate.approve(createResult.value.id, 'human-1', 'Looks good');

      expect(approveResult.ok).toBe(true);
      if (approveResult.ok) {
        expect(approveResult.value.status).toBe(ApprovalStatus.APPROVED);
        expect(approveResult.value.resolvedBy).toBe('human-1');
        expect(approveResult.value.reason).toBe('Looks good');
      }
    });

    it('should fail for non-existent request', () => {
      const result = gate.approve('non-existent', 'human-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ApprovalGateErrorCode.REQUEST_NOT_FOUND);
      }
    });

    it('should fail for already resolved request', () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.APPROVE,
        'agent-1',
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      gate.approve(createResult.value.id, 'human-1');
      const secondApprove = gate.approve(createResult.value.id, 'human-2');

      expect(secondApprove.ok).toBe(false);
      if (!secondApprove.ok) {
        expect(secondApprove.error.code).toBe(ApprovalGateErrorCode.ALREADY_RESOLVED);
      }
    });
  });

  describe('deny', () => {
    it('should deny a pending request', () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.APPROVE,
        'agent-1',
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      const denyResult = gate.deny(createResult.value.id, 'human-1', 'Too risky');

      expect(denyResult.ok).toBe(true);
      if (denyResult.ok) {
        expect(denyResult.value.status).toBe(ApprovalStatus.DENIED);
        expect(denyResult.value.reason).toBe('Too risky');
      }
    });
  });

  describe('timeout', () => {
    it('should timeout pending requests', () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.APPROVE,
        'agent-1',
        {},
        1000,
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      expect(createResult.value.status).toBe(ApprovalStatus.PENDING);

      vi.advanceTimersByTime(1500);

      const request = gate.getRequest(createResult.value.id);
      expect(request?.status).toBe(ApprovalStatus.TIMEOUT);
    });
  });

  describe('getPendingRequests', () => {
    it('should return only pending requests', () => {
      gate.requestApproval('op1', 'Test 1', ApprovalLevel.APPROVE, 'agent-1');
      gate.requestApproval('op2', 'Test 2', ApprovalLevel.AUTO, 'agent-1');
      gate.requestApproval('op3', 'Test 3', ApprovalLevel.APPROVE, 'agent-1');

      const pending = gate.getPendingRequests();

      expect(pending).toHaveLength(2);
      expect(pending.every((r) => r.status === ApprovalStatus.PENDING)).toBe(true);
    });
  });

  describe('getPendingCountStream', () => {
    it('should emit pending count changes', async () => {
      const countsPromise = firstValueFrom(
        gate.getPendingCountStream().pipe(take(3), toArray()),
      );

      gate.requestApproval('op1', 'Test 1', ApprovalLevel.APPROVE, 'agent-1');
      gate.requestApproval('op2', 'Test 2', ApprovalLevel.APPROVE, 'agent-1');

      const counts = await countsPromise;
      expect(counts).toEqual([0, 1, 2]);
    });
  });

  describe('isApproved', () => {
    it('should return true for approved requests', () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.APPROVE,
        'agent-1',
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      gate.approve(createResult.value.id, 'human-1');

      expect(gate.isApproved(createResult.value.id)).toBe(true);
    });

    it('should return true for auto-approved requests', () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.AUTO,
        'agent-1',
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      expect(gate.isApproved(createResult.value.id)).toBe(true);
    });

    it('should return false for denied requests', () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.APPROVE,
        'agent-1',
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      gate.deny(createResult.value.id, 'human-1', 'No');

      expect(gate.isApproved(createResult.value.id)).toBe(false);
    });

    it('should return false for non-existent requests', () => {
      expect(gate.isApproved('non-existent')).toBe(false);
    });
  });

  describe('waitForResolution', () => {
    it('should resolve when request is approved', async () => {
      const createResult = gate.requestApproval(
        'test_op',
        'Test',
        ApprovalLevel.APPROVE,
        'agent-1',
      );

      if (!createResult.ok) {
        throw new Error('Failed to create request');
      }

      const waitPromise = gate.waitForResolution(createResult.value.id, 50);

      // Approve after a short delay
      setTimeout(() => {
        gate.approve(createResult.value.id, 'human-1');
      }, 100);

      vi.advanceTimersByTime(200);

      const result = await waitPromise;
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(ApprovalStatus.APPROVED);
      }
    });

    it('should return error for non-existent request', async () => {
      const result = await gate.waitForResolution('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ApprovalGateErrorCode.REQUEST_NOT_FOUND);
      }
    });
  });

  describe('createApprovalGate', () => {
    it('should create an approval gate instance', () => {
      const approvalGate = createApprovalGate(defaultConfig, noopLogger);
      expect(approvalGate).toBeInstanceOf(ApprovalGate);
    });
  });
});
