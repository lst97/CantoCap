// Migration Service - Three-phase migration system with comprehensive rollback capability
import { workspaceDatabase } from './workspace/workspace-database'
import type { 
  Workspace, 
  WorkspaceConfig, 
  MigrationStatus, 
  MigrationPhase, 
  MigrationLogEntry,
  WorkspaceError
} from '../types/workspace'
import { WORKSPACE_CONSTANTS } from '../types/workspace'
import type { AppConfig } from '../../../types'

// UUID v4 generator using Web Crypto API
const generateUUID = (): string => {
  return crypto.randomUUID()
}

// Migration phases configuration
const MIGRATION_PHASES: MigrationPhase[] = [
  {
    id: 'backup',
    name: 'Backup Creation',
    description: 'Create backup of existing configuration and data',
    estimatedDuration: 5000, // 5 seconds
    isRollbackable: true
  },
  {
    id: 'transform',
    name: 'Data Transformation',
    description: 'Transform localStorage data to IndexedDB format',
    estimatedDuration: 10000, // 10 seconds
    isRollbackable: true
  },
  {
    id: 'validate',
    name: 'Validation & Cleanup',
    description: 'Validate migrated data and cleanup old storage',
    estimatedDuration: 3000, // 3 seconds
    isRollbackable: false
  }
]

// Backup manager for migration rollback
class MigrationBackupManager {
  private backupData: {
    localStorage: Record<string, string>
    timestamp: number
    backupPath?: string
  } | null = null

  async createBackup(): Promise<string> {
    const backupData: Record<string, string> = {}
    
    // Backup all localStorage data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        backupData[key] = localStorage.getItem(key) || ''
      }
    }

    this.backupData = {
      localStorage: backupData,
      timestamp: Date.now()
    }

    // Create backup file path reference
    const backupPath = `migration_backup_${Date.now()}.json`
    this.backupData.backupPath = backupPath

    // Store backup in memory and return path
    return backupPath
  }

  async restoreBackup(): Promise<void> {
    if (!this.backupData) {
      throw new Error('No backup data available for restore')
    }

    // Clear current localStorage
    localStorage.clear()

    // Restore from backup
    for (const [key, value] of Object.entries(this.backupData.localStorage)) {
      localStorage.setItem(key, value)
    }
  }

  getBackupInfo(): { path?: string; timestamp?: number; hasBackup: boolean } {
    return {
      path: this.backupData?.backupPath,
      timestamp: this.backupData?.timestamp,
      hasBackup: this.backupData !== null
    }
  }

  clearBackup(): void {
    this.backupData = null
  }
}

// Migration configuration analyzer
class ConfigurationAnalyzer {
  analyzeLocalStorageConfig(): {
    hasConfig: boolean
    configSize: number
    isValid: boolean
    config?: Partial<AppConfig>
    errors: string[]
  } {
    const errors: string[] = []
    let config: Partial<AppConfig> | undefined
    let isValid = false
    let configSize = 0

    try {
      const configStr = localStorage.getItem('cantocap-config')
      if (!configStr) {
        return { hasConfig: false, configSize: 0, isValid: false, errors: ['No configuration found'] }
      }

      configSize = configStr.length
      config = JSON.parse(configStr)
      
      // Basic validation
      if (typeof config === 'object' && config !== null) {
        isValid = true
      } else {
        errors.push('Configuration is not a valid object')
      }

    } catch (error) {
      errors.push(`Failed to parse configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      hasConfig: !!config,
      configSize,
      isValid,
      config,
      errors
    }
  }

  analyzeUIState(): {
    hasUIState: boolean
    stateSize: number
    isValid: boolean
    uiState?: any
    errors: string[]
  } {
    const errors: string[] = []
    let uiState: any
    let isValid = false
    let stateSize = 0

    try {
      const stateStr = localStorage.getItem('cantocap-ui-state')
      if (!stateStr) {
        return { hasUIState: false, stateSize: 0, isValid: false, errors: ['No UI state found'] }
      }

      stateSize = stateStr.length
      uiState = JSON.parse(stateStr)
      
      if (typeof uiState === 'object' && uiState !== null) {
        isValid = true
      } else {
        errors.push('UI state is not a valid object')
      }

    } catch (error) {
      errors.push(`Failed to parse UI state: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      hasUIState: !!uiState,
      stateSize,
      isValid,
      uiState,
      errors
    }
  }

  analyzeWorkflowState(): {
    hasWorkflowState: boolean
    stateSize: number
    isValid: boolean
    workflowState?: any
    errors: string[]
  } {
    const errors: string[] = []
    let workflowState: any
    let isValid = false
    let stateSize = 0

    try {
      const stateStr = localStorage.getItem('workflow-storage')
      if (!stateStr) {
        return { hasWorkflowState: false, stateSize: 0, isValid: false, errors: ['No workflow state found'] }
      }

      stateSize = stateStr.length
      const parsedData = JSON.parse(stateStr)
      workflowState = parsedData.state // Zustand persist format
      
      if (typeof workflowState === 'object' && workflowState !== null) {
        isValid = true
      } else {
        errors.push('Workflow state is not a valid object')
      }

    } catch (error) {
      errors.push(`Failed to parse workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      hasWorkflowState: !!workflowState,
      stateSize,
      isValid,
      workflowState,
      errors
    }
  }
}

// Main migration service
export class MigrationService {
  private backupManager = new MigrationBackupManager()
  private configAnalyzer = new ConfigurationAnalyzer()
  private currentStatus: MigrationStatus = {
    isInProgress: false,
    totalPhases: MIGRATION_PHASES.length,
    completedPhases: 0,
    canRollback: false
  }

  // Public API
  async startMigration(): Promise<{ success: boolean, backupPath: string }> {
    if (this.currentStatus.isInProgress) {
      throw new Error('Migration is already in progress')
    }

    this.currentStatus = {
      isInProgress: true,
      currentPhase: 'backup',
      totalPhases: MIGRATION_PHASES.length,
      completedPhases: 0,
      startTime: Date.now(),
      estimatedCompletion: Date.now() + MIGRATION_PHASES.reduce((sum, phase) => sum + phase.estimatedDuration, 0),
      canRollback: false
    }

    try {
      // Phase 1: Backup
      await this.executePhase('backup')
      
      const backupInfo = this.backupManager.getBackupInfo()
      return {
        success: true,
        backupPath: backupInfo.path || 'in-memory-backup'
      }
    } catch (error) {
      await this.handleMigrationError('backup', error)
      throw error
    }
  }

  async completeMigration(): Promise<{ success: boolean }> {
    if (!this.currentStatus.isInProgress) {
      throw new Error('No migration in progress')
    }

    try {
      // Phase 2: Transform
      await this.executePhase('transform')
      
      // Phase 3: Validate
      await this.executePhase('validate')

      this.currentStatus = {
        ...this.currentStatus,
        isInProgress: false,
        canRollback: false
      }

      return { success: true }
    } catch (error) {
      await this.handleMigrationError(this.currentStatus.currentPhase || 'unknown', error)
      throw error
    }
  }

  async rollbackMigration(): Promise<{ success: boolean }> {
    if (!this.currentStatus.canRollback) {
      throw new Error('Migration cannot be rolled back at this time')
    }

    try {
      await this.logMigrationEntry('rollback', 'Migration rollback started', true)
      
      // Clear IndexedDB data
      await workspaceDatabase.clearAllData()
      
      // Restore localStorage backup
      await this.backupManager.restoreBackup()
      
      this.currentStatus = {
        isInProgress: false,
        totalPhases: MIGRATION_PHASES.length,
        completedPhases: 0,
        canRollback: false
      }

      await this.logMigrationEntry('rollback', 'Migration rollback completed successfully', true)
      
      return { success: true }
    } catch (error) {
      await this.logMigrationEntry('rollback', `Migration rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`, false)
      throw error
    }
  }

  getMigrationStatus(): MigrationStatus {
    return { ...this.currentStatus }
  }

  // Phase execution
  private async executePhase(phaseId: string): Promise<void> {
    const phase = MIGRATION_PHASES.find(p => p.id === phaseId)
    if (!phase) {
      throw new Error(`Unknown migration phase: ${phaseId}`)
    }

    this.currentStatus.currentPhase = phaseId
    await this.logMigrationEntry(phaseId, `Starting ${phase.name}`, true)

    try {
      switch (phaseId) {
        case 'backup':
          await this.executeBackupPhase()
          break
        case 'transform':
          await this.executeTransformPhase()
          break
        case 'validate':
          await this.executeValidatePhase()
          break
        default:
          throw new Error(`Unhandled migration phase: ${phaseId}`)
      }

      this.currentStatus.completedPhases++
      this.currentStatus.canRollback = phase.isRollbackable
      
      await this.logMigrationEntry(phaseId, `Completed ${phase.name}`, true)
    } catch (error) {
      await this.logMigrationEntry(phaseId, `Failed ${phase.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, false)
      throw error
    }
  }

  private async executeBackupPhase(): Promise<void> {
    // Analyze existing configuration
    const configAnalysis = this.configAnalyzer.analyzeLocalStorageConfig()
    const uiAnalysis = this.configAnalyzer.analyzeUIState()
    const workflowAnalysis = this.configAnalyzer.analyzeWorkflowState()

    if (!configAnalysis.hasConfig && !uiAnalysis.hasUIState && !workflowAnalysis.hasWorkflowState) {
      throw new Error('No existing configuration found to migrate')
    }

    // Create backup
    const backupPath = await this.backupManager.createBackup()
    
    await this.logMigrationEntry('backup', `Backup created: ${backupPath}`, true, {
      configSize: configAnalysis.configSize,
      uiStateSize: uiAnalysis.stateSize,
      workflowStateSize: workflowAnalysis.stateSize,
      totalSize: configAnalysis.configSize + uiAnalysis.stateSize + workflowAnalysis.stateSize
    })
  }

  private async executeTransformPhase(): Promise<void> {
    const configAnalysis = this.configAnalyzer.analyzeLocalStorageConfig()
    const uiAnalysis = this.configAnalyzer.analyzeUIState()
    const workflowAnalysis = this.configAnalyzer.analyzeWorkflowState()

    if (!configAnalysis.isValid) {
      throw new Error(`Invalid configuration: ${configAnalysis.errors.join(', ')}`)
    }

    // Create default workspace from existing configuration
    const now = Date.now()
    const workspaceConfig: WorkspaceConfig = {
      // Default values
      inputFile: null,
      outputFile: null,
      language: 'zh',
      model: null,
      priority: 'balanced',
      speakers: false,
      written: true,
      music: false,
      charset: 'traditional',
      geminiKey: '',
      hfToken: '',
      noGeminiRefinement: false,
      maxChunkDuration: 15,
      videoQuality: '360p',
      terminologyConfig: null,
      ffmpegPath: null,
      subtitle: null,
      duration: 10.0,
      verbose: false,
      startTime: null,
      endTime: null,
      importedJsonFile: null,
      // Merge with existing config
      ...configAnalysis.config,
      // Workspace-specific fields
      workspaceId: '',
      lastModified: now,
      version: WORKSPACE_CONSTANTS.WORKSPACE_VERSION
    }

    const workspace: Workspace = {
      id: generateUUID(),
      name: 'Default Workspace',
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      isActive: true,
      config: workspaceConfig,
      metadata: {
        description: 'Migrated from localStorage configuration',
        tags: ['migrated'],
        autoSaveEnabled: true,
        backupRetentionDays: WORKSPACE_CONSTANTS.DEFAULT_BACKUP_RETENTION_DAYS,
        totalProcessingTime: 0,
        totalProcessedFiles: 0
      }
    }

    // Store in IndexedDB
    await workspaceDatabase.createWorkspace(workspace)

    await this.logMigrationEntry('transform', 'Data transformation completed', true, {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      configFields: Object.keys(workspaceConfig).length
    })
  }

  private async executeValidatePhase(): Promise<void> {
    // Validate IndexedDB data
    const workspaces = await workspaceDatabase.getAllWorkspaces()
    
    if (workspaces.length === 0) {
      throw new Error('No workspaces found after migration')
    }

    const activeWorkspace = workspaces.find(w => w.isActive)
    if (!activeWorkspace) {
      throw new Error('No active workspace found after migration')
    }

    // Validate workspace structure
    if (!activeWorkspace.id || !activeWorkspace.name || !activeWorkspace.config) {
      throw new Error('Migrated workspace has invalid structure')
    }

    // Test database operations
    const testWorkspace = await workspaceDatabase.getWorkspace(activeWorkspace.id)
    if (!testWorkspace) {
      throw new Error('Failed to retrieve migrated workspace')
    }

    // Cleanup old localStorage data (only after successful validation)
    const keysToRemove = [
      'cantocap-config',
      'cantocap-ui-state',
      'workflow-storage'
    ]

    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }

    // Clear backup since we're past the rollback point
    this.backupManager.clearBackup()

    await this.logMigrationEntry('validate', 'Migration validation and cleanup completed', true, {
      migratedWorkspaces: workspaces.length,
      activeWorkspaceId: activeWorkspace.id,
      cleanedKeys: keysToRemove.length
    })
  }

  private async handleMigrationError(phase: string, error: any): Promise<void> {
    this.currentStatus.lastError = error instanceof Error ? error.message : 'Unknown error'
    this.currentStatus.canRollback = true

    await this.logMigrationEntry(phase, `Migration failed: ${this.currentStatus.lastError}`, false)
  }

  private async logMigrationEntry(phase: string, message: string, success: boolean, data?: any): Promise<void> {
    const entry: MigrationLogEntry = {
      id: generateUUID(),
      phase,
      timestamp: Date.now(),
      success,
      errorMessage: success ? undefined : message,
      dataAffected: data
    }

    try {
      await workspaceDatabase.addMigrationLogEntry(entry)
    } catch (error) {
      console.error('Failed to log migration entry:', error)
      // Don't throw here to avoid breaking the migration process
    }
  }

  // Utility methods
  async checkMigrationNeeded(): Promise<{ needed: boolean; reason: string; confidence: number }> {
    try {
      // Check if IndexedDB already has workspaces
      const workspaces = await workspaceDatabase.getAllWorkspaces()
      if (workspaces.length > 0) {
        return {
          needed: false,
          reason: 'Workspaces already exist in IndexedDB',
          confidence: 1.0
        }
      }

      // Check if localStorage has configuration
      const configAnalysis = this.configAnalyzer.analyzeLocalStorageConfig()
      if (configAnalysis.hasConfig && configAnalysis.isValid) {
        return {
          needed: true,
          reason: 'Valid localStorage configuration found',
          confidence: 0.9
        }
      }

      if (configAnalysis.hasConfig && !configAnalysis.isValid) {
        return {
          needed: true,
          reason: `Invalid localStorage configuration found: ${configAnalysis.errors.join(', ')}`,
          confidence: 0.7
        }
      }

      return {
        needed: false,
        reason: 'No existing configuration to migrate',
        confidence: 1.0
      }
    } catch (error) {
      return {
        needed: false,
        reason: `Migration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.0
      }
    }
  }

  async estimateMigrationTime(): Promise<number> {
    const configAnalysis = this.configAnalyzer.analyzeLocalStorageConfig()
    const baseTime = MIGRATION_PHASES.reduce((sum, phase) => sum + phase.estimatedDuration, 0)
    
    // Add time based on data size
    const sizeMultiplier = Math.max(1, configAnalysis.configSize / 1000) // 1ms per KB
    
    return baseTime + sizeMultiplier
  }

  async getMigrationPreview(): Promise<{
    currentConfig: any
    targetWorkspace: Partial<Workspace>
    warnings: string[]
    estimatedTime: number
  }> {
    const configAnalysis = this.configAnalyzer.analyzeLocalStorageConfig()
    const estimatedTime = await this.estimateMigrationTime()
    
    const warnings: string[] = []
    
    if (!configAnalysis.isValid) {
      warnings.push(...configAnalysis.errors)
    }

    const targetWorkspace: Partial<Workspace> = {
      name: 'Default Workspace',
      config: configAnalysis.config as WorkspaceConfig,
      metadata: {
        description: 'Migrated from localStorage configuration',
        tags: ['migrated']
      }
    }

    return {
      currentConfig: configAnalysis.config,
      targetWorkspace,
      warnings,
      estimatedTime
    }
  }
}

// Singleton instance
export const migrationService = new MigrationService()

// Utility functions
export async function checkMigrationStatus(): Promise<{ needed: boolean; safe: boolean; reason: string }> {
  try {
    const check = await migrationService.checkMigrationNeeded()
    const databaseHealth = await workspaceDatabase.healthCheck()
    
    return {
      needed: check.needed,
      safe: databaseHealth.isHealthy && check.confidence > 0.5,
      reason: check.reason
    }
  } catch (error) {
    return {
      needed: false,
      safe: false,
      reason: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

export async function performSafeMigration(): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
  try {
    const status = await checkMigrationStatus()
    if (!status.needed) {
      return { success: true }
    }

    if (!status.safe) {
      return { success: false, error: status.reason }
    }

    // Execute migration
    const startResult = await migrationService.startMigration()
    if (!startResult.success) {
      return { success: false, error: 'Failed to start migration' }
    }

    const completeResult = await migrationService.completeMigration()
    if (!completeResult.success) {
      return { success: false, error: 'Failed to complete migration' }
    }

    // Get the migrated workspace
    const workspaces = await workspaceDatabase.getAllWorkspaces()
    const activeWorkspace = workspaces.find(w => w.isActive)

    return { 
      success: true, 
      workspaceId: activeWorkspace?.id 
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown migration error' 
    }
  }
}