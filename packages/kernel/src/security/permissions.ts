/**
 * @fileoverview Permission system for agent security
 * @module @symbiosis/kernel/security/permissions
 */

/**
 * Permission types for agent capabilities
 */
export enum Permission {
  // File System
  FS_READ = 'fs:read',
  FS_WRITE = 'fs:write',
  FS_DELETE = 'fs:delete',

  // Network
  NET_FETCH = 'net:fetch',
  NET_WEBSOCKET = 'net:websocket',

  // Agent
  AGENT_SPAWN = 'agent:spawn',
  AGENT_KILL = 'agent:kill',

  // Kernel
  KERNEL_CONFIG = 'kernel:config',
  KERNEL_ROUTE = 'kernel:route',

  // Approval
  APPROVAL_BYPASS = 'approval:bypass',

  // Code Execution
  EXEC_CODE = 'exec:code',
  EXEC_SHELL = 'exec:shell',
}

/**
 * Rate limits for an agent
 */
export interface IAgentRateLimits {
  readonly maxTokensPerMinute: number;
  readonly maxApiCallsPerMinute: number;
  readonly maxSpawnedAgents: number;
}

/**
 * Agent permissions configuration
 */
export interface IAgentPermissions {
  readonly agentId: string;
  readonly permissions: ReadonlySet<Permission>;
  readonly rateLimits: IAgentRateLimits;
}

/**
 * Result of a permission check
 */
export interface IPermissionCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly requiredPermission?: Permission;
}

/**
 * Default rate limits for standard agents
 */
export const DEFAULT_RATE_LIMITS: IAgentRateLimits = {
  maxTokensPerMinute: 50_000,
  maxApiCallsPerMinute: 20,
  maxSpawnedAgents: 0,
};

/**
 * Architect agent permissions - can read, write, fetch, and spawn
 */
export const ARCHITECT_PERMISSIONS: IAgentPermissions = {
  agentId: 'architect',
  permissions: new Set([
    Permission.FS_READ,
    Permission.FS_WRITE,
    Permission.NET_FETCH,
    Permission.AGENT_SPAWN,
    Permission.KERNEL_ROUTE,
  ]),
  rateLimits: {
    maxTokensPerMinute: 50_000,
    maxApiCallsPerMinute: 20,
    maxSpawnedAgents: 2,
  },
};

/**
 * Coder agent permissions - can read, write, and fetch
 */
export const CODER_PERMISSIONS: IAgentPermissions = {
  agentId: 'coder',
  permissions: new Set([
    Permission.FS_READ,
    Permission.FS_WRITE,
    Permission.NET_FETCH,
    Permission.EXEC_CODE,
  ]),
  rateLimits: {
    maxTokensPerMinute: 100_000,
    maxApiCallsPerMinute: 30,
    maxSpawnedAgents: 0,
  },
};

/**
 * Critic agent permissions - READ ONLY, no write or network
 */
export const CRITIC_PERMISSIONS: IAgentPermissions = {
  agentId: 'critic',
  permissions: new Set([Permission.FS_READ]),
  rateLimits: {
    maxTokensPerMinute: 30_000,
    maxApiCallsPerMinute: 15,
    maxSpawnedAgents: 0,
  },
};

/**
 * Executor agent permissions - can read, write, execute code (no network by default)
 */
export const EXECUTOR_PERMISSIONS: IAgentPermissions = {
  agentId: 'executor',
  permissions: new Set([
    Permission.FS_READ,
    Permission.FS_WRITE,
    Permission.EXEC_CODE,
    Permission.EXEC_SHELL,
  ]),
  rateLimits: {
    maxTokensPerMinute: 20_000,
    maxApiCallsPerMinute: 10,
    maxSpawnedAgents: 0,
  },
};

/**
 * Default permission set by agent type
 */
export const DEFAULT_AGENT_PERMISSIONS: Readonly<Record<string, IAgentPermissions>> = {
  architect: ARCHITECT_PERMISSIONS,
  coder: CODER_PERMISSIONS,
  critic: CRITIC_PERMISSIONS,
  executor: EXECUTOR_PERMISSIONS,
};

/**
 * Permission Guard for enforcing agent permissions
 *
 * Provides:
 * - Permission checking for agents
 * - Rate limit enforcement
 * - Custom permission registration
 */
export class PermissionGuard {
  private readonly agentPermissions: Map<string, IAgentPermissions>;

  /**
   * Create a new Permission Guard
   * @param customPermissions - Optional custom permissions to add
   */
  constructor(customPermissions?: Readonly<Record<string, IAgentPermissions>>) {
    this.agentPermissions = new Map([
      ['architect', ARCHITECT_PERMISSIONS],
      ['coder', CODER_PERMISSIONS],
      ['critic', CRITIC_PERMISSIONS],
      ['executor', EXECUTOR_PERMISSIONS],
    ]);

    // Add custom permissions
    if (customPermissions !== undefined) {
      for (const [agentId, perms] of Object.entries(customPermissions)) {
        this.agentPermissions.set(agentId, perms);
      }
    }
  }

  /**
   * Check if an agent has a specific permission
   * @param agentId - The agent ID
   * @param permission - The permission to check
   * @returns True if the agent has the permission
   */
  public hasPermission(agentId: string, permission: Permission): boolean {
    const perms = this.agentPermissions.get(agentId);
    if (perms === undefined) {
      return false;
    }
    return perms.permissions.has(permission);
  }

  /**
   * Check permission and return a result object
   * @param agentId - The agent ID
   * @param permission - The permission to check
   * @returns Permission check result
   */
  public checkPermission(agentId: string, permission: Permission): IPermissionCheckResult {
    const perms = this.agentPermissions.get(agentId);

    if (perms === undefined) {
      return {
        allowed: false,
        reason: `Unknown agent: "${agentId}"`,
        requiredPermission: permission,
      };
    }

    if (!perms.permissions.has(permission)) {
      return {
        allowed: false,
        reason: `Agent "${agentId}" lacks permission: ${permission}`,
        requiredPermission: permission,
      };
    }

    return { allowed: true };
  }

  /**
   * Require a permission, throwing if not allowed
   * @param agentId - The agent ID
   * @param permission - The required permission
   * @throws Error if permission is not granted
   */
  public requirePermission(agentId: string, permission: Permission): void {
    const result = this.checkPermission(agentId, permission);
    if (!result.allowed) {
      throw new Error(result.reason);
    }
  }

  /**
   * Check multiple permissions at once
   * @param agentId - The agent ID
   * @param permissions - Array of permissions to check
   * @returns Permission check result (fails if any permission is missing)
   */
  public checkPermissions(agentId: string, permissions: readonly Permission[]): IPermissionCheckResult {
    for (const permission of permissions) {
      const result = this.checkPermission(agentId, permission);
      if (!result.allowed) {
        return result;
      }
    }
    return { allowed: true };
  }

  /**
   * Get all permissions for an agent
   * @param agentId - The agent ID
   * @returns Set of permissions or undefined if agent not found
   */
  public getPermissions(agentId: string): ReadonlySet<Permission> | undefined {
    return this.agentPermissions.get(agentId)?.permissions;
  }

  /**
   * Get rate limits for an agent
   * @param agentId - The agent ID
   * @returns Rate limits or default limits if agent not found
   */
  public getRateLimits(agentId: string): IAgentRateLimits {
    const perms = this.agentPermissions.get(agentId);
    if (perms === undefined) {
      return DEFAULT_RATE_LIMITS;
    }
    return perms.rateLimits;
  }

  /**
   * Register or update permissions for an agent
   * @param permissions - The agent permissions to register
   */
  public registerAgent(permissions: IAgentPermissions): void {
    this.agentPermissions.set(permissions.agentId, permissions);
  }

  /**
   * Remove an agent from the permission system
   * @param agentId - The agent ID to remove
   * @returns True if the agent was removed
   */
  public unregisterAgent(agentId: string): boolean {
    return this.agentPermissions.delete(agentId);
  }

  /**
   * Get list of all registered agent IDs
   * @returns Array of agent IDs
   */
  public getRegisteredAgents(): readonly string[] {
    return Array.from(this.agentPermissions.keys());
  }

  /**
   * Create a custom permission set
   * @param agentId - The agent ID
   * @param permissions - Set of permissions
   * @param rateLimits - Optional rate limits (uses defaults if not provided)
   * @returns Agent permissions object
   */
  public static createPermissions(
    agentId: string,
    permissions: ReadonlySet<Permission>,
    rateLimits?: Partial<IAgentRateLimits>,
  ): IAgentPermissions {
    return {
      agentId,
      permissions,
      rateLimits: { ...DEFAULT_RATE_LIMITS, ...rateLimits },
    };
  }
}

/**
 * Create a new Permission Guard instance
 * @param customPermissions - Optional custom permissions
 * @returns PermissionGuard instance
 */
export function createPermissionGuard(
  customPermissions?: Readonly<Record<string, IAgentPermissions>>,
): PermissionGuard {
  return new PermissionGuard(customPermissions);
}
