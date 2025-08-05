/**
 * Workspace IPC Integration Service
 *
 * Demonstrates integration between the IndexedDB storage layer and
 * main process workspace management through IPC calls.
 *
 * This service acts as a bridge between the backend-architect's storage
 * infrastructure and the main process workspace management system.
 */

import type {
  Workspace,
  WorkspaceConfig,
  MigrationStatus,
  WorkspacePerformanceMetrics,
} from '../../types/workspace';
import { workspaceDatabase } from './workspace-database';

export class WorkspaceIPCIntegration {
  private migrationListeners: Array<() => void> = [];
  private syncInProgress = false;
  private lastSyncTime = 0;
  private readonly SYNC_DEBOUNCE_MS = 2000;

  constructor() {
    this.setupMigrationListeners();
  }

  /**
   * Initialize workspace system integration
   * Coordinates between IndexedDB and main process
   */
  public async initializeIntegration(): Promise<{ success: boolean; message: string }> {
    try {
      // Step 1: Check if migration is needed
      const migrationStatus = await window.cantocapAPI.getWorkspaceMigrationStatus();

      if (migrationStatus?.isInProgress) {
        return {
          success: false,
          message: 'Migration already in progress. Please wait for completion.',
        };
      }

      // Step 2: Initialize main process workspace system
      const mainProcessInit = await window.cantocapAPI.initializeWorkspaceSystem();
      if (!mainProcessInit.success) {
        throw new Error('Failed to initialize main process workspace system');
      }

      // Step 3: Initialize IndexedDB storage
      const database = workspaceDatabase;
      // Ensure database is ready (initialization happens in constructor)
      await database.healthCheck();

      // Step 4: Check if migration is required
      const workspaceList = await window.cantocapAPI.listWorkspaces();
      const hasMainProcessWorkspaces = workspaceList.length > 0;

      if (hasMainProcessWorkspaces) {
        // Migration needed - start migration process
        const migrationResult = await this.startMigrationProcess();
        return {
          success: migrationResult.success,
          message: migrationResult.success
            ? 'Migration started successfully'
            : 'Failed to start migration process',
        };
      } else {
        // No migration needed - system ready
        return {
          success: true,
          message: 'Workspace system initialized successfully',
        };
      }
    } catch (error) {
      console.error('Failed to initialize workspace integration:', error);
      return {
        success: false,
        message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Start migration process with main process coordination
   */
  private async startMigrationProcess(): Promise<{ success: boolean; backupPath?: string }> {
    try {
      // Start migration in main process
      const startResult = await window.cantocapAPI.startWorkspaceMigration();
      if (!startResult.success) {
        throw new Error('Failed to start migration in main process');
      }

      // Initialize IndexedDB for migration
      const database = workspaceDatabase;
      // Ensure database is ready (initialization happens in constructor)
      await database.healthCheck();

      // Migrate workspace data from main process to IndexedDB
      const workspaceList = await window.cantocapAPI.listWorkspaces();

      for (const workspaceMeta of workspaceList) {
        try {
          // Get workspace config from main process
          const config = await window.cantocapAPI.getWorkspaceConfig(workspaceMeta.id);
          if (!config) continue;

          // Convert to full workspace object
          const workspace: Workspace = {
            id: workspaceMeta.id,
            name: workspaceMeta.name,
            createdAt: workspaceMeta.createdAt || Date.now(),
            updatedAt: workspaceMeta.updatedAt || Date.now(),
            lastAccessedAt: workspaceMeta.lastAccessedAt || Date.now(),
            isActive: workspaceMeta.isActive,
            config: config as WorkspaceConfig,
            metadata: {
              description: workspaceMeta.description,
              tags: workspaceMeta.tags || [],
              color: workspaceMeta.color || '#3b82f6',
              icon: workspaceMeta.icon || '📁',
              totalProcessingTime: workspaceMeta.totalProcessingTime || 0,
              totalProcessedFiles: workspaceMeta.totalProcessedFiles || 0,
              autoSaveEnabled: workspaceMeta.autoSaveEnabled ?? true,
              backupRetentionDays: workspaceMeta.backupRetentionDays || 30,
            },
          };

          // Store in IndexedDB
          await database.createWorkspace(workspace);
        } catch (error) {
          console.warn(`Failed to migrate workspace ${workspaceMeta.id}:`, error);
        }
      }

      // Complete migration
      const completeResult = await window.cantocapAPI.completeWorkspaceMigration();
      if (!completeResult.success) {
        console.warn('Migration completion reported failure, but IndexedDB migration succeeded');
      }

      return {
        success: true,
        backupPath: startResult.backupPath,
      };
    } catch (error) {
      console.error('Migration process failed:', error);

      // Attempt rollback
      try {
        await window.cantocapAPI.rollbackWorkspaceMigration();
      } catch (rollbackError) {
        console.error('Migration rollback also failed:', rollbackError);
      }

      return { success: false };
    }
  }

  /**
   * Sync workspace data between IndexedDB and main process
   */
  public async syncWorkspaceToMainProcess(workspaceId: string): Promise<{ success: boolean }> {
    if (this.syncInProgress) {
      return { success: false };
    }

    // Debounce sync operations
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_DEBOUNCE_MS) {
      return { success: true }; // Skip frequent syncs
    }

    this.syncInProgress = true;
    this.lastSyncTime = now;

    try {
      // Get workspace from IndexedDB
      const database = workspaceDatabase;
      const workspace = await database.getWorkspace(workspaceId);

      if (!workspace) {
        throw new Error('Workspace not found in IndexedDB');
      }

      // Sync config to main process
      const syncResult = await window.cantocapAPI.syncWorkspaceConfig(
        workspaceId,
        workspace.config
      );

      if (!syncResult.success) {
        throw new Error('Failed to sync config to main process');
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to sync workspace to main process:', error);
      return { success: false };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Create workspace in both IndexedDB and main process
   */
  public async createWorkspace(
    name: string,
    config?: Partial<WorkspaceConfig>
  ): Promise<{ success: boolean; workspaceId?: string }> {
    try {
      // Create workspace in main process first
      const mainProcessResult = await window.cantocapAPI.createWorkspace(name);
      if (!mainProcessResult.success) {
        throw new Error('Failed to create workspace in main process');
      }

      const workspaceId = mainProcessResult.workspaceId;

      // Create workspace object for IndexedDB
      const now = Date.now();
      const workspace: Workspace = {
        id: workspaceId,
        name,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
        isActive: false,
        config: {
          workspaceId,
          lastModified: now,
          version: 1,
          // Default config values
          inputFile: null,
          outputFile: null,
          language: 'zh',
          model: null,
          priority: 'balanced',
          speakers: false,
          written: false,
          music: false,
          charset: 'traditional',
          geminiKey: '',
          hfToken: '',
          noGeminiRefinement: false,
          maxChunkDuration: 30,
          videoQuality: '720p',
          terminologyConfig: null,
          ffmpegPath: null,
          subtitle: null,
          duration: 0,
          verbose: false,
          startTime: null,
          endTime: null,
          importedJsonFile: null,
          autoSaveApiKeys: true,
          ...config,
        },
        metadata: {
          description: `Workspace for ${name}`,
          tags: [],
          color: '#3b82f6',
          icon: '📁',
          totalProcessingTime: 0,
          totalProcessedFiles: 0,
          autoSaveEnabled: true,
          backupRetentionDays: 30,
        },
      };

      // Save to IndexedDB
      const database = workspaceDatabase;
      await database.createWorkspace(workspace);

      return { success: true, workspaceId };
    } catch (error) {
      console.error('Failed to create workspace:', error);
      return { success: false };
    }
  }

  /**
   * Delete workspace from both IndexedDB and main process
   */
  public async deleteWorkspace(workspaceId: string): Promise<{ success: boolean }> {
    try {
      // Delete from IndexedDB first
      const database = workspaceDatabase;
      await database.deleteWorkspace(workspaceId);

      // Delete from main process
      const mainProcessResult = await window.cantocapAPI.deleteWorkspace(workspaceId);
      if (!mainProcessResult.success) {
        console.warn(
          'Failed to delete workspace from main process, but IndexedDB deletion succeeded'
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      return { success: false };
    }
  }

  /**
   * Get performance metrics from main process
   */
  public async getPerformanceMetrics(): Promise<WorkspacePerformanceMetrics[]> {
    try {
      return await window.cantocapAPI.getWorkspacePerformanceMetrics();
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return [];
    }
  }

  /**
   * Create backup through main process
   */
  public async createBackup(
    workspaceId: string
  ): Promise<{ success: boolean; backupPath?: string }> {
    try {
      // Ensure workspace is synced before backup
      await this.syncWorkspaceToMainProcess(workspaceId);

      // Create backup in main process
      const backupResult = await window.cantocapAPI.createWorkspaceBackup(workspaceId);

      return {
        success: backupResult.success,
        backupPath: backupResult.backupPath,
      };
    } catch (error) {
      console.error('Failed to create backup:', error);
      return { success: false };
    }
  }

  /**
   * Restore workspace from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<{ success: boolean }> {
    try {
      const restoreResult = await window.cantocapAPI.restoreWorkspaceBackup(backupPath);

      if (restoreResult.success) {
        // Refresh IndexedDB data after restore
        // In a full implementation, we would reload workspace data
        const database = workspaceDatabase;
        // Ensure database is ready (initialization happens in constructor)
        await database.healthCheck();
      }

      return { success: restoreResult.success };
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return { success: false };
    }
  }

  /**
   * Setup migration event listeners
   */
  private setupMigrationListeners(): void {
    // Migration progress updates
    const migrationUpdateCleanup = window.cantocapAPI.onWorkspaceMigrationUpdate(
      (status: MigrationStatus) => {
        console.log('Migration status update:', status);
        this.handleMigrationUpdate(status);
      }
    );

    const migrationProgressCleanup = window.cantocapAPI.onWorkspaceMigrationProgress(
      (data: { phase: string; progress: number; message: string }) => {
        console.log('Migration progress:', data);
      }
    );

    const migrationRollbackCleanup = window.cantocapAPI.onWorkspaceMigrationRollback(
      (data: { success: boolean; message: string }) => {
        console.log('Migration rollback:', data);
      }
    );

    this.migrationListeners.push(
      migrationUpdateCleanup,
      migrationProgressCleanup,
      migrationRollbackCleanup
    );
  }

  /**
   * Handle migration status updates
   */
  private handleMigrationUpdate(status: MigrationStatus): void {
    if (!status.isInProgress && status.currentPhase === 'completed') {
      console.log('Migration completed successfully');
      // Migration completed - system ready
    } else if (status.lastError) {
      console.error('Migration error:', status.lastError);
      // Handle migration error
    }
  }

  /**
   * Cleanup integration service
   */
  public cleanup(): void {
    // Remove migration listeners
    this.migrationListeners.forEach((cleanup) => cleanup());
    this.migrationListeners = [];
  }

  /**
   * Check if workspace system is ready
   */
  public async isSystemReady(): Promise<boolean> {
    try {
      const migrationStatus = await window.cantocapAPI.getWorkspaceMigrationStatus();
      return !migrationStatus || !migrationStatus.isInProgress;
    } catch (error) {
      console.error('Failed to check system readiness:', error);
      return false;
    }
  }

  /**
   * Auto-sync configuration changes
   * This would be called when workspace config changes in the UI
   */
  public async autoSync(workspaceId: string, config: Partial<WorkspaceConfig>): Promise<void> {
    try {
      // Update IndexedDB first
      const database = workspaceDatabase;
      const workspace = await database.getWorkspace(workspaceId);

      if (workspace) {
        workspace.config = { ...workspace.config, ...config };
        workspace.updatedAt = Date.now();
        await database.updateWorkspace(workspace);

        // Background sync to main process (debounced)
        setTimeout(() => {
          this.syncWorkspaceToMainProcess(workspaceId).catch((error) => {
            console.warn('Background sync failed:', error);
          });
        }, this.SYNC_DEBOUNCE_MS);
      }
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }
}

// Singleton instance
let workspaceIPCIntegration: WorkspaceIPCIntegration | null = null;

export function getWorkspaceIPCIntegration(): WorkspaceIPCIntegration {
  if (!workspaceIPCIntegration) {
    workspaceIPCIntegration = new WorkspaceIPCIntegration();
  }
  return workspaceIPCIntegration;
}
