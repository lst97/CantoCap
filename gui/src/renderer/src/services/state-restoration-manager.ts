/**
 * State Restoration Manager
 * Handles complete state recovery on app reload with validation and fallback
 * Ensures application consistency across sessions
 */

import { StepId, StepState, createStepId } from '../types/workflow-state';
import { WorkspaceConfig, Workspace } from '../types/workspace';
import { useWorkflowStateManager } from './workflow/workflow-state-manager';
import { useWorkspaceStore } from '../stores/workspace-store';
import { stateSyncManager } from './bridge/state-synchronization-strategy';

// Restoration status
export interface RestorationStatus {
  phase: 'initializing' | 'validating' | 'restoring' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: StepId;
  errors: IRestorationError[];
  warnings: RestorationWarning[];
  startTime: number;
  completionTime?: number;
  restoredWorkspaceId?: string;
}

// Restoration error interface
interface IRestorationError {
  type: 'workspace-not-found' | 'config-invalid' | 'step-state-corrupt' | 'sync-failed' | 'unknown';
  stepId?: StepId;
  workspaceId?: string;
  message: string;
  recoverable: boolean;
  timestamp: number;
}

// Restoration warning
export interface RestorationWarning {
  type: 'config-migration' | 'step-state-outdated' | 'partial-restore' | 'fallback-used';
  stepId?: StepId;
  message: string;
  timestamp: number;
}

// Restoration options
export interface RestorationOptions {
  validateIntegrity: boolean;
  enableFallback: boolean;
  skipCorruptedSteps: boolean;
  forceComplete: boolean;
  maxRetries: number;
  timeoutMs: number;
}

// Default restoration options
const DEFAULT_RESTORATION_OPTIONS: RestorationOptions = {
  validateIntegrity: true,
  enableFallback: true,
  skipCorruptedSteps: true,
  forceComplete: false,
  maxRetries: 3,
  timeoutMs: 30000, // 30 seconds
};

// Validation result for workspace config
export interface ConfigValidationResult {
  isValid: boolean;
  version: number;
  migrationsNeeded: string[];
  corruptedSteps: StepId[];
  errors: string[];
  warnings: string[];
}

/**
 * State Restoration Manager
 * Manages complete application state restoration with validation and recovery
 */
export class StateRestorationManager {
  private status: RestorationStatus = {
    phase: 'initializing',
    progress: 0,
    errors: [],
    warnings: [],
    startTime: Date.now(),
  };

  private options: RestorationOptions;
  private restorationPromise: Promise<RestorationStatus> | null = null;

  constructor(options: Partial<RestorationOptions> = {}) {
    this.options = { ...DEFAULT_RESTORATION_OPTIONS, ...options };
  }

  /**
   * Perform complete state restoration
   */
  public async restoreApplicationState(
    workspaceId?: string,
    options: Partial<RestorationOptions> = {}
  ): Promise<RestorationStatus> {
    // Prevent concurrent restorations
    if (this.restorationPromise) {
      return this.restorationPromise;
    }

    const mergedOptions = { ...this.options, ...options };

    this.restorationPromise = this.performRestoration(mergedOptions, workspaceId);

    try {
      const result = await this.restorationPromise;
      return result;
    } finally {
      this.restorationPromise = null;
    }
  }

  /**
   * Internal restoration implementation
   */
  private async performRestoration(
    options: RestorationOptions,
    workspaceId?: string
  ): Promise<RestorationStatus> {
    this.updateStatus({
      phase: 'initializing',
      progress: 0,
      errors: [],
      warnings: [],
      startTime: Date.now(),
      restoredWorkspaceId: workspaceId,
    });

    try {
      // Phase 1: Initialize workspace store
      await this.initializeWorkspaces();
      this.updateStatus({ phase: 'validating', progress: 20 });

      // Phase 2: Determine active workspace
      const activeWorkspace = await this.determineActiveWorkspace(workspaceId);
      if (!activeWorkspace) {
        throw new RestorationError({
          type: 'workspace-not-found',
          workspaceId,
          message: workspaceId
            ? `Workspace '${workspaceId}' not found`
            : 'No active workspace available',
          recoverable: true,
        });
      }

      this.updateStatus({
        progress: 40,
        restoredWorkspaceId: activeWorkspace.id,
      });

      // Phase 3: Validate workspace config
      const validation = await this.validateWorkspaceConfig(activeWorkspace.config);
      if (!validation.isValid && !options.enableFallback) {
        throw new RestorationError({
          type: 'config-invalid',
          workspaceId: activeWorkspace.id,
          message: `Workspace config validation failed: ${validation.errors.join(', ')}`,
          recoverable: false,
        });
      }

      // Add warnings for validation issues
      validation.warnings.forEach((warning) => {
        this.addWarning({
          type: 'config-migration',
          message: warning,
        });
      });

      this.updateStatus({ phase: 'restoring', progress: 60 });

      // Phase 4: Restore workflow state
      await this.restoreWorkflowState(activeWorkspace, validation, options);
      this.updateStatus({ progress: 80 });

      // Phase 5: Perform final synchronization
      await this.performFinalSync(activeWorkspace.id);

      // Phase 6: Complete restoration
      this.updateStatus({
        phase: 'completed',
        progress: 100,
        completionTime: Date.now(),
      });

      return this.status;
    } catch (error) {
      const restorationError =
        error instanceof RestorationError
          ? error
          : new RestorationError({
              type: 'unknown',
              message: error instanceof Error ? error.message : 'Unknown restoration error',
              recoverable: false,
            });

      this.addError(restorationError);

      // Attempt fallback restoration if enabled
      if (options.enableFallback && restorationError.recoverable) {
        try {
          await this.performFallbackRestoration();
          this.updateStatus({
            phase: 'completed',
            progress: 100,
            completionTime: Date.now(),
          });
        } catch {
          this.updateStatus({
            phase: 'failed',
            completionTime: Date.now(),
          });
        }
      } else {
        this.updateStatus({
          phase: 'failed',
          completionTime: Date.now(),
        });
      }

      return this.status;
    }
  }

  /**
   * Initialize workspace store
   */
  private async initializeWorkspaces(): Promise<void> {
    const workspaceStore = useWorkspaceStore.getState();
    if (!workspaceStore.isInitialized) {
      await workspaceStore.initializeWorkspaces();
    }
  }

  /**
   * Determine the active workspace to restore
   */
  private async determineActiveWorkspace(requestedWorkspaceId?: string): Promise<Workspace | null> {
    const workspaceStore = useWorkspaceStore.getState();
    const { availableWorkspaces, currentWorkspace } = workspaceStore;

    // If specific workspace requested, find it
    if (requestedWorkspaceId) {
      const workspace = availableWorkspaces.find((w) => w.id === requestedWorkspaceId);
      if (workspace) {
        // Switch to requested workspace if not current
        if (currentWorkspace?.id !== requestedWorkspaceId) {
          await workspaceStore.switchWorkspace(requestedWorkspaceId);
        }
        return workspace;
      }
    }

    // Use current workspace if available
    if (currentWorkspace) {
      return currentWorkspace;
    }

    // Find most recently accessed workspace
    const recentWorkspace = availableWorkspaces
      .filter((w) => w.lastAccessedAt)
      .sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0))[0];

    if (recentWorkspace) {
      await workspaceStore.switchWorkspace(recentWorkspace.id);
      return recentWorkspace;
    }

    // No suitable workspace found
    return null;
  }

  /**
   * Validate workspace configuration
   */
  private async validateWorkspaceConfig(config: WorkspaceConfig): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      isValid: true,
      version: config.version || 1,
      migrationsNeeded: [],
      corruptedSteps: [],
      errors: [],
      warnings: [],
    };

    try {
      // Validate basic config structure
      if (!config) {
        result.errors.push('Config is null or undefined');
        result.isValid = false;
        return result;
      }

      // Validate step states
      if (config.stepStates) {
        const validStepIds: StepId[] = [
          createStepId('input-file'),
          createStepId('config'),
          createStepId('processing'),
          createStepId('review'),
          createStepId('export'),
        ];

        for (const [stepId, stepConfig] of Object.entries(config.stepStates)) {
          const typedStepId = createStepId(stepId);

          // Check if step ID is valid
          if (!validStepIds.includes(typedStepId)) {
            result.warnings.push(`Unknown step ID: ${stepId}`);
            continue;
          }

          // Validate step config structure
          if (!stepConfig || typeof stepConfig !== 'object') {
            result.errors.push(`Invalid step config for ${stepId}`);
            result.corruptedSteps.push(typedStepId);
            continue;
          }

          // Validate required fields
          if (
            typeof stepConfig.state !== 'string' ||
            !Object.values(StepState).includes(stepConfig.state as StepState)
          ) {
            result.errors.push(`Invalid state for step ${stepId}: ${stepConfig.state}`);
            result.corruptedSteps.push(typedStepId);
          }

          if (typeof stepConfig.lastModified !== 'number' || stepConfig.lastModified <= 0) {
            result.warnings.push(`Invalid lastModified timestamp for step ${stepId}`);
          }
        }
      }

      // Validate current step
      if (config.lastActiveStep) {
        const validStepIds: StepId[] = [
          createStepId('input-file'),
          createStepId('config'),
          createStepId('processing'),
          createStepId('review'),
          createStepId('export'),
        ];
        if (
          config.lastActiveStep &&
          !validStepIds.some((stepId) => stepId === createStepId(config.lastActiveStep!))
        ) {
          result.errors.push(`Invalid lastActiveStep: ${config.lastActiveStep}`);
        }
      }

      // Validate import context
      if (config.importContext) {
        const context = config.importContext;
        if (
          !context.sourceType ||
          !['regular', 'json-import', 'manual'].includes(context.sourceType)
        ) {
          result.warnings.push('Invalid import context sourceType');
        }
        if (typeof context.timestamp !== 'number' || context.timestamp <= 0) {
          result.warnings.push('Invalid import context timestamp');
        }
      }

      // Check for backward compatibility issues
      if (config.importedJsonFile && !config.importContext) {
        result.migrationsNeeded.push('import-context-migration');
        result.warnings.push('Legacy importedJsonFile detected, migration to importContext needed');
      }

      // Validate version
      const CURRENT_CONFIG_VERSION = 2;
      if (result.version < CURRENT_CONFIG_VERSION) {
        result.migrationsNeeded.push(`version-${CURRENT_CONFIG_VERSION}`);
        result.warnings.push(
          `Config version ${result.version} is outdated, current version is ${CURRENT_CONFIG_VERSION}`
        );
      }

      result.isValid = result.errors.length === 0 && result.corruptedSteps.length === 0;
    } catch (error) {
      result.errors.push(
        `Config validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      result.isValid = false;
    }

    return result;
  }

  /**
   * Restore workflow state from workspace
   */
  private async restoreWorkflowState(
    workspace: Workspace,
    validation: ConfigValidationResult,
    options: RestorationOptions
  ): Promise<void> {
    const workflowManager = useWorkflowStateManager;

    try {
      // Perform migrations if needed
      let configToRestore = workspace.config;
      if (validation.migrationsNeeded.length > 0) {
        configToRestore = await this.performConfigMigrations(
          workspace.config,
          validation.migrationsNeeded
        );
        this.addWarning({
          type: 'config-migration',
          message: `Applied migrations: ${validation.migrationsNeeded.join(', ')}`,
        });
      }

      // Skip corrupted steps if enabled
      if (options.skipCorruptedSteps && validation.corruptedSteps.length > 0) {
        configToRestore = this.sanitizeConfig(configToRestore, validation.corruptedSteps);
        this.addWarning({
          type: 'partial-restore',
          message: `Skipped corrupted steps: ${validation.corruptedSteps.join(', ')}`,
        });
      }

      // Attempt restoration with retries
      let retryCount = 0;
      while (retryCount < options.maxRetries) {
        try {
          await workflowManager.restoreFromWorkspaceConfig(configToRestore as any);
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= options.maxRetries) {
            throw error;
          }

          this.addWarning({
            type: 'partial-restore',
            message: `Restoration attempt ${retryCount} failed, retrying...`,
          });

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        }
      }
    } catch (error) {
      throw new RestorationError({
        type: 'step-state-corrupt',
        workspaceId: workspace.id,
        message: `Failed to restore workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      });
    }
  }

  /**
   * Perform final synchronization
   */
  private async performFinalSync(_workspaceId: string): Promise<void> {
    try {
      const syncResult = await stateSyncManager.performSync();

      if (!syncResult.success) {
        this.addWarning({
          type: 'partial-restore',
          message: `Final sync completed with errors: ${syncResult.errors.join(', ')}`,
        });
      }

      if (syncResult.conflicts.length > 0) {
        this.addWarning({
          type: 'partial-restore',
          message: `Resolved ${syncResult.conflicts.length} conflicts during final sync`,
        });
      }
    } catch (error) {
      // Log sync error but don't fail restoration
      this.addWarning({
        type: 'partial-restore',
        message: `Final sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Perform fallback restoration with default state
   */
  private async performFallbackRestoration(): Promise<void> {
    try {
      const workflowManager = useWorkflowStateManager;

      // Reset to default state
      workflowManager.reset();

      this.addWarning({
        type: 'fallback-used',
        message: 'Restoration failed, initialized with default state',
      });
    } catch (error) {
      throw new RestorationError({
        type: 'unknown',
        message: `Fallback restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: false,
      });
    }
  }

  /**
   * Perform configuration migrations
   */
  private async performConfigMigrations(
    config: WorkspaceConfig,
    migrations: string[]
  ): Promise<WorkspaceConfig> {
    let migratedConfig = { ...config };

    for (const migration of migrations) {
      switch (migration) {
        case 'import-context-migration':
          if (migratedConfig.importedJsonFile && !migratedConfig.importContext) {
            migratedConfig.importContext = {
              sourceType: 'json-import',
              timestamp: migratedConfig.lastModified || Date.now(),
              importedJsonFile: migratedConfig.importedJsonFile,
            };
          }
          break;

        case 'version-2':
          migratedConfig.version = 2;
          // Add any version 2 specific migrations here
          break;

        default:
          console.warn(`Unknown migration: ${migration}`);
      }
    }

    return migratedConfig;
  }

  /**
   * Sanitize config by removing corrupted steps
   */
  private sanitizeConfig(config: WorkspaceConfig, corruptedSteps: StepId[]): WorkspaceConfig {
    const sanitizedConfig = { ...config };

    if (sanitizedConfig.stepStates) {
      const cleanedStepStates = { ...sanitizedConfig.stepStates };

      for (const stepId of corruptedSteps) {
        delete cleanedStepStates[stepId as keyof typeof cleanedStepStates];
      }

      sanitizedConfig.stepStates = cleanedStepStates;
    }

    // Reset to first step if current step is corrupted
    if (
      sanitizedConfig.lastActiveStep &&
      corruptedSteps.some((step) => step === createStepId(sanitizedConfig.lastActiveStep!))
    ) {
      sanitizedConfig.lastActiveStep = 'input-file';
    }

    return sanitizedConfig;
  }

  /**
   * Update restoration status
   */
  private updateStatus(updates: Partial<RestorationStatus>): void {
    this.status = { ...this.status, ...updates };
  }

  /**
   * Add restoration error
   */
  private addError(error: RestorationError): void {
    this.status.errors.push(error);
  }

  /**
   * Add restoration warning
   */
  private addWarning(warning: Omit<RestorationWarning, 'timestamp'>): void {
    this.status.warnings.push({
      ...warning,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current restoration status
   */
  public getStatus(): RestorationStatus {
    return { ...this.status };
  }

  /**
   * Check if restoration is in progress
   */
  public isRestoring(): boolean {
    return (
      this.status.phase === 'initializing' ||
      this.status.phase === 'validating' ||
      this.status.phase === 'restoring'
    );
  }

  /**
   * Reset restoration status
   */
  public reset(): void {
    this.status = {
      phase: 'initializing',
      progress: 0,
      errors: [],
      warnings: [],
      startTime: Date.now(),
    };
    this.restorationPromise = null;
  }
}

// Custom error class for restoration errors
class RestorationError extends Error {
  public type:
    | 'workspace-not-found'
    | 'config-invalid'
    | 'step-state-corrupt'
    | 'sync-failed'
    | 'unknown';
  public stepId?: StepId;
  public workspaceId?: string;
  public recoverable: boolean;
  public timestamp: number;

  constructor(options: {
    type:
      | 'workspace-not-found'
      | 'config-invalid'
      | 'step-state-corrupt'
      | 'sync-failed'
      | 'unknown';
    stepId?: StepId;
    workspaceId?: string;
    message: string;
    recoverable: boolean;
  }) {
    super(options.message);
    this.name = 'RestorationError';
    this.type = options.type;
    this.stepId = options.stepId;
    this.workspaceId = options.workspaceId;
    this.recoverable = options.recoverable;
    this.timestamp = Date.now();
  }
}

// Create global restoration manager instance
export const stateRestorationManager = new StateRestorationManager();

// Export for direct usage
export default stateRestorationManager;
