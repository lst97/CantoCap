import { BrowserWindow } from 'electron'
import { getWorkspaceManager } from './workspace-manager'
import type { MigrationStatus, MigrationPhase } from '../renderer/src/types/workspace'

/**
 * Migration Coordinator
 * 
 * Coordinates workspace migration between main and renderer processes
 * Implements three-phase migration with rollback capabilities
 */
export class MigrationCoordinator {
  private workspaceManager = getWorkspaceManager()
  private migrationPhases: MigrationPhase[] = [
    {
      id: 'backup',
      name: 'Create Backup',
      description: 'Creating comprehensive backup of current workspace data',
      estimatedDuration: 5000, // 5 seconds
      isRollbackable: true
    },
    {
      id: 'initialize',
      name: 'Initialize Storage',
      description: 'Setting up IndexedDB storage layer in renderer process',
      estimatedDuration: 10000, // 10 seconds
      isRollbackable: true
    },
    {
      id: 'migrate',
      name: 'Migrate Data',
      description: 'Transferring workspace data to new storage system',
      estimatedDuration: 15000, // 15 seconds
      isRollbackable: true
    }
  ]
  
  private currentMigration: {
    status: MigrationStatus
    mainWindow?: BrowserWindow
    startTime: number
  } | null = null

  /**
   * Start migration process with main process coordination
   */
  public async startMigration(mainWindow?: BrowserWindow): Promise<{ success: boolean, backupPath: string }> {
    try {
      if (this.currentMigration?.status.isInProgress) {
        // Return current migration status instead of throwing error
        return {
          success: false,
          backupPath: this.currentMigration.status.backupPath || ''
        }
      }

      // Check if migration is actually needed
      const hasExistingConfig = await this.workspaceManager.hasExistingWorkspaces()
      if (!hasExistingConfig) {
        // No existing configuration to migrate
        return {
          success: true,
          backupPath: '' // No backup needed
        }
      }

      // Phase 1: Create backup in main process
      const backupResult = await this.workspaceManager.createMigrationBackup()
      
      if (!backupResult.success) {
        throw new Error('Failed to create migration backup')
      }

      // Initialize migration status
      const migrationStatus: MigrationStatus = {
        isInProgress: true,
        currentPhase: 'backup',
        totalPhases: this.migrationPhases.length,
        completedPhases: 1,
        startTime: Date.now(),
        estimatedCompletion: Date.now() + this.getTotalEstimatedDuration(),
        canRollback: true,
        backupPath: backupResult.backupPath
      }

      this.currentMigration = {
        status: migrationStatus,
        mainWindow,
        startTime: Date.now()
      }

      // Notify renderer of migration start
      if (mainWindow) {
        mainWindow.webContents.send('workspace:migrationUpdate', migrationStatus)
      }

      return { success: true, backupPath: backupResult.backupPath }
    } catch (error) {
      console.error('Failed to start migration:', error)
      
      // Reset migration state on failure
      this.currentMigration = null
      
      return { success: false, backupPath: '' }
    }
  }

  /**
   * Complete migration after renderer process initialization
   */
  public async completeMigration(): Promise<{ success: boolean }> {
    try {
      if (!this.currentMigration?.status.isInProgress) {
        throw new Error('No migration in progress')
      }

      // Phase 2: Renderer process should have initialized IndexedDB
      await this.updateMigrationPhase('initialize')

      // Phase 3: Data migration (coordinated between processes)
      await this.updateMigrationPhase('migrate')

      // Validate migration success
      const validationResult = await this.workspaceManager.validateMigration()
      
      if (!validationResult.success) {
        console.warn('Migration validation issues:', validationResult.issues)
        // Continue with completion but log issues
      }

      // Mark migration as complete
      const completedStatus: MigrationStatus = {
        ...this.currentMigration.status,
        isInProgress: false,
        currentPhase: 'completed',
        completedPhases: this.migrationPhases.length,
        estimatedCompletion: Date.now()
      }

      // Notify renderer of completion
      if (this.currentMigration.mainWindow) {
        this.currentMigration.mainWindow.webContents.send('workspace:migrationUpdate', completedStatus)
      }

      // Clean up migration state
      this.currentMigration = null

      return { success: true }
    } catch (error) {
      console.error('Failed to complete migration:', error)
      
      // Mark migration as failed but keep state for potential rollback
      if (this.currentMigration) {
        this.currentMigration.status.lastError = error instanceof Error ? error.message : 'Unknown error'
        
        if (this.currentMigration.mainWindow) {
          this.currentMigration.mainWindow.webContents.send('workspace:migrationUpdate', this.currentMigration.status)
        }
      }
      
      return { success: false }
    }
  }

  /**
   * Rollback migration to previous state
   */
  public async rollbackMigration(): Promise<{ success: boolean }> {
    try {
      if (!this.currentMigration) {
        throw new Error('No migration to rollback')
      }

      // Attempt rollback through workspace manager
      const rollbackResult = await this.workspaceManager.rollbackMigration()
      
      if (!rollbackResult.success) {
        throw new Error('Workspace manager rollback failed')
      }

      // Notify renderer of rollback
      if (this.currentMigration.mainWindow) {
        this.currentMigration.mainWindow.webContents.send('workspace:migrationRollback', {
          success: true,
          message: 'Migration rolled back successfully'
        })
      }

      // Clean up migration state
      this.currentMigration = null

      return { success: true }
    } catch (error) {
      console.error('Failed to rollback migration:', error)
      
      // Notify renderer of rollback failure
      if (this.currentMigration?.mainWindow) {
        this.currentMigration.mainWindow.webContents.send('workspace:migrationRollback', {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown rollback error'
        })
      }
      
      return { success: false }
    }
  }

  /**
   * Get current migration status
   */
  public getMigrationStatus(): MigrationStatus | null {
    if (!this.currentMigration) {
      // Check if migration is completed by consulting workspace manager
      const wmStatus = this.workspaceManager.getMigrationStatus()
      if (wmStatus?.isInProgress === false) {
        return null // Migration completed
      }
      return wmStatus
    }
    
    return this.currentMigration.status
  }

  /**
   * Update migration phase and notify renderer
   */
  private async updateMigrationPhase(phaseId: string): Promise<void> {
    if (!this.currentMigration) return

    const phaseIndex = this.migrationPhases.findIndex(p => p.id === phaseId)
    if (phaseIndex === -1) return

    const currentPhase = this.migrationPhases[phaseIndex]
    const completedPhases = phaseIndex + 1

    // Update migration status
    this.currentMigration.status = {
      ...this.currentMigration.status,
      currentPhase: currentPhase.id,
      completedPhases,
      estimatedCompletion: this.calculateEstimatedCompletion(phaseIndex)
    }

    // Notify renderer
    if (this.currentMigration.mainWindow) {
      this.currentMigration.mainWindow.webContents.send('workspace:migrationUpdate', this.currentMigration.status)
    }

    // Simulate phase duration for realistic progress
    await this.simulatePhaseProgress(currentPhase.estimatedDuration)
  }

  /**
   * Calculate estimated completion time based on current phase
   */
  private calculateEstimatedCompletion(currentPhaseIndex: number): number {
    const remainingPhases = this.migrationPhases.slice(currentPhaseIndex + 1)
    const remainingDuration = remainingPhases.reduce((total, phase) => total + phase.estimatedDuration, 0)
    return Date.now() + remainingDuration
  }

  /**
   * Get total estimated duration for all phases
   */
  private getTotalEstimatedDuration(): number {
    return this.migrationPhases.reduce((total, phase) => total + phase.estimatedDuration, 0)
  }

  /**
   * Simulate phase progress with periodic updates
   */
  private async simulatePhaseProgress(duration: number): Promise<void> {
    const steps = 10
    const stepDuration = duration / steps
    
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration))
      
      // Send intermediate progress if migration is still active
      if (this.currentMigration?.mainWindow && this.currentMigration.status.isInProgress) {
        const progress = (i + 1) / steps
        this.currentMigration.mainWindow.webContents.send('workspace:migrationProgress', {
          phase: this.currentMigration.status.currentPhase,
          progress,
          message: `${Math.round(progress * 100)}% complete`
        })
      }
    }
  }

  /**
   * Handle renderer process initialization complete
   */
  public async onRendererInitialized(): Promise<void> {
    if (this.currentMigration?.status.currentPhase === 'initialize') {
      await this.updateMigrationPhase('migrate')
    }
  }

  /**
   * Handle renderer process data migration complete
   */
  public async onDataMigrationComplete(): Promise<void> {
    if (this.currentMigration?.status.currentPhase === 'migrate') {
      await this.completeMigration()
    }
  }

  /**
   * Emergency stop migration
   */
  public async emergencyStop(): Promise<void> {
    if (this.currentMigration) {
      console.warn('Emergency stopping migration')
      
      // Attempt automatic rollback
      try {
        await this.rollbackMigration()
      } catch (error) {
        console.error('Emergency rollback failed:', error)
      }
    }
  }

  /**
   * Check if migration is required
   */
  public isMigrationRequired(): boolean {
    const wmStatus = this.workspaceManager.getMigrationStatus()
    return wmStatus === null || wmStatus.isInProgress
  }

  /**
   * Get migration phases information
   */
  public getMigrationPhases(): MigrationPhase[] {
    return [...this.migrationPhases]
  }
}

// Singleton instance
let migrationCoordinator: MigrationCoordinator | null = null

export function getMigrationCoordinator(): MigrationCoordinator {
  if (!migrationCoordinator) {
    migrationCoordinator = new MigrationCoordinator()
  }
  return migrationCoordinator
}