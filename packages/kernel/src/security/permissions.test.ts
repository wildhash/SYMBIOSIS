/**
 * @fileoverview Tests for Permission Guard
 * @module @symbiosis/kernel/security/permissions.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PermissionGuard,
  createPermissionGuard,
  Permission,
  DEFAULT_RATE_LIMITS,
  ARCHITECT_PERMISSIONS,
  CODER_PERMISSIONS,
  CRITIC_PERMISSIONS,
  EXECUTOR_PERMISSIONS,
  type IAgentPermissions,
} from './permissions';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  beforeEach(() => {
    guard = createPermissionGuard();
  });

  describe('constructor', () => {
    it('should create with default agent permissions', () => {
      const agents = guard.getRegisteredAgents();
      expect(agents).toContain('architect');
      expect(agents).toContain('coder');
      expect(agents).toContain('critic');
      expect(agents).toContain('executor');
    });

    it('should accept custom permissions', () => {
      const customPerms: Record<string, IAgentPermissions> = {
        custom: {
          agentId: 'custom',
          permissions: new Set([Permission.FS_READ]),
          rateLimits: DEFAULT_RATE_LIMITS,
        },
      };
      const customGuard = createPermissionGuard(customPerms);

      expect(customGuard.getRegisteredAgents()).toContain('custom');
      expect(customGuard.hasPermission('custom', Permission.FS_READ)).toBe(true);
    });
  });

  describe('hasPermission', () => {
    it('should return true for allowed permissions', () => {
      expect(guard.hasPermission('architect', Permission.FS_READ)).toBe(true);
      expect(guard.hasPermission('architect', Permission.FS_WRITE)).toBe(true);
      expect(guard.hasPermission('architect', Permission.AGENT_SPAWN)).toBe(true);
    });

    it('should return false for denied permissions', () => {
      expect(guard.hasPermission('critic', Permission.FS_WRITE)).toBe(false);
      expect(guard.hasPermission('critic', Permission.NET_FETCH)).toBe(false);
    });

    it('should return false for unknown agents', () => {
      expect(guard.hasPermission('unknown', Permission.FS_READ)).toBe(false);
    });
  });

  describe('checkPermission', () => {
    it('should return allowed for valid permissions', () => {
      const result = guard.checkPermission('coder', Permission.FS_WRITE);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return denied with reason for missing permissions', () => {
      const result = guard.checkPermission('critic', Permission.FS_WRITE);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('lacks permission');
      expect(result.requiredPermission).toBe(Permission.FS_WRITE);
    });

    it('should return denied for unknown agents', () => {
      const result = guard.checkPermission('unknown', Permission.FS_READ);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown agent');
    });
  });

  describe('requirePermission', () => {
    it('should not throw for valid permissions', () => {
      expect(() => {
        guard.requirePermission('architect', Permission.FS_READ);
      }).not.toThrow();
    });

    it('should throw for missing permissions', () => {
      expect(() => {
        guard.requirePermission('critic', Permission.FS_WRITE);
      }).toThrow('lacks permission');
    });

    it('should throw for unknown agents', () => {
      expect(() => {
        guard.requirePermission('unknown', Permission.FS_READ);
      }).toThrow('Unknown agent');
    });
  });

  describe('checkPermissions', () => {
    it('should return allowed when all permissions exist', () => {
      const result = guard.checkPermissions('coder', [
        Permission.FS_READ,
        Permission.FS_WRITE,
        Permission.NET_FETCH,
      ]);
      expect(result.allowed).toBe(true);
    });

    it('should return denied when any permission is missing', () => {
      const result = guard.checkPermissions('coder', [
        Permission.FS_READ,
        Permission.AGENT_SPAWN, // Coder doesn't have this
      ]);
      expect(result.allowed).toBe(false);
      expect(result.requiredPermission).toBe(Permission.AGENT_SPAWN);
    });

    it('should return allowed for empty permissions array', () => {
      const result = guard.checkPermissions('coder', []);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getPermissions', () => {
    it('should return permissions set for known agents', () => {
      const perms = guard.getPermissions('architect');
      expect(perms).toBeDefined();
      expect(perms).toBeInstanceOf(Set);
      expect(perms?.has(Permission.FS_READ)).toBe(true);
    });

    it('should return undefined for unknown agents', () => {
      const perms = guard.getPermissions('unknown');
      expect(perms).toBeUndefined();
    });
  });

  describe('getRateLimits', () => {
    it('should return rate limits for known agents', () => {
      const limits = guard.getRateLimits('architect');
      expect(limits.maxTokensPerMinute).toBe(ARCHITECT_PERMISSIONS.rateLimits.maxTokensPerMinute);
      expect(limits.maxSpawnedAgents).toBe(2);
    });

    it('should return default limits for unknown agents', () => {
      const limits = guard.getRateLimits('unknown');
      expect(limits).toEqual(DEFAULT_RATE_LIMITS);
    });
  });

  describe('registerAgent', () => {
    it('should register new agent', () => {
      const newPerms: IAgentPermissions = {
        agentId: 'custom',
        permissions: new Set([Permission.FS_READ, Permission.NET_FETCH]),
        rateLimits: { ...DEFAULT_RATE_LIMITS, maxTokensPerMinute: 10_000 },
      };

      guard.registerAgent(newPerms);

      expect(guard.getRegisteredAgents()).toContain('custom');
      expect(guard.hasPermission('custom', Permission.FS_READ)).toBe(true);
      expect(guard.hasPermission('custom', Permission.FS_WRITE)).toBe(false);
    });

    it('should update existing agent', () => {
      const updatedPerms: IAgentPermissions = {
        agentId: 'critic',
        permissions: new Set([Permission.FS_READ, Permission.FS_WRITE]), // Add write
        rateLimits: CRITIC_PERMISSIONS.rateLimits,
      };

      guard.registerAgent(updatedPerms);

      expect(guard.hasPermission('critic', Permission.FS_WRITE)).toBe(true);
    });
  });

  describe('unregisterAgent', () => {
    it('should remove agent', () => {
      expect(guard.getRegisteredAgents()).toContain('critic');

      const result = guard.unregisterAgent('critic');
      expect(result).toBe(true);
      expect(guard.getRegisteredAgents()).not.toContain('critic');
    });

    it('should return false for non-existent agent', () => {
      const result = guard.unregisterAgent('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('static createPermissions', () => {
    it('should create permissions object', () => {
      const perms = PermissionGuard.createPermissions(
        'custom',
        new Set([Permission.FS_READ]),
        { maxTokensPerMinute: 5000 },
      );

      expect(perms.agentId).toBe('custom');
      expect(perms.permissions.has(Permission.FS_READ)).toBe(true);
      expect(perms.rateLimits.maxTokensPerMinute).toBe(5000);
      expect(perms.rateLimits.maxApiCallsPerMinute).toBe(DEFAULT_RATE_LIMITS.maxApiCallsPerMinute);
    });

    it('should use default rate limits when not provided', () => {
      const perms = PermissionGuard.createPermissions('custom', new Set([Permission.FS_READ]));

      expect(perms.rateLimits).toEqual(DEFAULT_RATE_LIMITS);
    });
  });
});

describe('Default Agent Permissions', () => {
  describe('ARCHITECT_PERMISSIONS', () => {
    it('should have correct permissions', () => {
      expect(ARCHITECT_PERMISSIONS.permissions.has(Permission.FS_READ)).toBe(true);
      expect(ARCHITECT_PERMISSIONS.permissions.has(Permission.FS_WRITE)).toBe(true);
      expect(ARCHITECT_PERMISSIONS.permissions.has(Permission.NET_FETCH)).toBe(true);
      expect(ARCHITECT_PERMISSIONS.permissions.has(Permission.AGENT_SPAWN)).toBe(true);
      expect(ARCHITECT_PERMISSIONS.permissions.has(Permission.KERNEL_ROUTE)).toBe(true);
    });

    it('should allow spawning agents', () => {
      expect(ARCHITECT_PERMISSIONS.rateLimits.maxSpawnedAgents).toBeGreaterThan(0);
    });
  });

  describe('CODER_PERMISSIONS', () => {
    it('should have correct permissions', () => {
      expect(CODER_PERMISSIONS.permissions.has(Permission.FS_READ)).toBe(true);
      expect(CODER_PERMISSIONS.permissions.has(Permission.FS_WRITE)).toBe(true);
      expect(CODER_PERMISSIONS.permissions.has(Permission.NET_FETCH)).toBe(true);
      expect(CODER_PERMISSIONS.permissions.has(Permission.EXEC_CODE)).toBe(true);
    });

    it('should not have spawn permission', () => {
      expect(CODER_PERMISSIONS.permissions.has(Permission.AGENT_SPAWN)).toBe(false);
      expect(CODER_PERMISSIONS.rateLimits.maxSpawnedAgents).toBe(0);
    });

    it('should have high token limit', () => {
      expect(CODER_PERMISSIONS.rateLimits.maxTokensPerMinute).toBe(100_000);
    });
  });

  describe('CRITIC_PERMISSIONS', () => {
    it('should be READ ONLY', () => {
      expect(CRITIC_PERMISSIONS.permissions.has(Permission.FS_READ)).toBe(true);
      expect(CRITIC_PERMISSIONS.permissions.has(Permission.FS_WRITE)).toBe(false);
      expect(CRITIC_PERMISSIONS.permissions.has(Permission.NET_FETCH)).toBe(false);
      expect(CRITIC_PERMISSIONS.permissions.has(Permission.EXEC_CODE)).toBe(false);
    });

    it('should have minimal rate limits', () => {
      expect(CRITIC_PERMISSIONS.rateLimits.maxSpawnedAgents).toBe(0);
    });
  });

  describe('EXECUTOR_PERMISSIONS', () => {
    it('should have execution permissions', () => {
      expect(EXECUTOR_PERMISSIONS.permissions.has(Permission.EXEC_CODE)).toBe(true);
      expect(EXECUTOR_PERMISSIONS.permissions.has(Permission.EXEC_SHELL)).toBe(true);
    });

    it('should NOT have network permissions by default', () => {
      expect(EXECUTOR_PERMISSIONS.permissions.has(Permission.NET_FETCH)).toBe(false);
      expect(EXECUTOR_PERMISSIONS.permissions.has(Permission.NET_WEBSOCKET)).toBe(false);
    });

    it('should have file system permissions', () => {
      expect(EXECUTOR_PERMISSIONS.permissions.has(Permission.FS_READ)).toBe(true);
      expect(EXECUTOR_PERMISSIONS.permissions.has(Permission.FS_WRITE)).toBe(true);
    });
  });
});
