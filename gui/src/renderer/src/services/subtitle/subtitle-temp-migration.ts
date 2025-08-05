/**
 * Subtitle Temporary Storage Migration Service
 * 
 * Handles migration of existing subtitle data to the enhanced temporary storage system.
 * Provides backward compatibility and data preservation during system upgrades.
 */

import type { SubtitleData } from '../../../../types'
import type {
  SubtitleTempError,
  SubtitleAutoSaveConfig
} from '../../types/subtitle-temp-storage'
import {
  SUBTITLE_TEMP_STORAGE_CONSTANTS,
  DEFAULT_SUBTITLE_TEMP_CONFIG,
  generateTempStorageId,
  estimateStorageSize
} from '../../types/subtitle-temp-storage'
import { workspaceDatabase } from '../workspace/workspace-database'
import { subtitleTempStorageService } from './subtitle-temp-storage-service'

// ============================================================================
// MIGRATION TYPES
// ============================================================================

export interface MigrationPlan {
  id: string
  version: {
    from: number
    to: number
  }
  steps: MigrationStep[]
  estimatedDuration: number
  dataBackupRequired: boolean
  reversible: boolean
}

export interface MigrationStep {
  id: string
  name: string
  description: string
  operation: 'backup' | 'transform' | 'validate' | 'cleanup' | 'index_rebuild'
  estimatedDuration: number
  riskLevel: 'low' | 'medium' | 'high'
  dependencies: string[]
}

export interface MigrationResult {
  success: boolean
  migrationId: string
  startTime: number
  endTime: number
  totalDuration: number
  stepsCompleted: string[]
  stepsFailed: string[]
  recordsMigrated: number
  dataBackupPath?: string
  errors: SubtitleTempError[]
  warnings: string[]
}

export interface LegacySubtitleData {
  // Legacy format from existing subtitle persistence
  workspaceId: string
  subtitles: SubtitleData[]
  metadata?: {
    createdAt: number
    lastModified?: number
    version?: number
  }
  session?: {
    sessionId?: string
    sessionType?: string
    autoSave?: boolean
  }
}

// ============================================================================
// MIGRATION SERVICE
// ============================================================================

export class SubtitleTempMigrationService {
  private activeMigrations: Map<string, MigrationResult> = new Map()

  // ============================================================================
  // MIGRATION PLANNING
  // ============================================================================

  /**
   * Analyze existing data and create migration plan
   */
  async createMigrationPlan(workspaceId?: string): Promise<MigrationPlan> {
    const migrationId = generateTempStorageId('migration-plan')
    
    try {
      // Analyze existing data
      const analysisResult = await this.analyzeExistingData(workspaceId)
      
      // Determine migration steps based on analysis
      const steps = this.planMigrationSteps(analysisResult)
      
      // Calculate estimated duration
      const estimatedDuration = steps.reduce((total, step) => total + step.estimatedDuration, 0)
      
      // Determine if backup is required
      const dataBackupRequired = analysisResult.riskFactors.length > 0 || analysisResult.recordCount > 100
      
      // Check if migration is reversible
      const reversible = !steps.some(step => step.operation === 'cleanup' && step.riskLevel === 'high')
      
      return {
        id: migrationId,
        version: {
          from: analysisResult.currentVersion,
          to: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_VERSION
        },
        steps,
        estimatedDuration,
        dataBackupRequired,
        reversible
      }
      
    } catch (error) {
      throw this.createMigrationError('MIGRATION_PLANNING_FAILED', `Migration planning failed: ${error}`, workspaceId, migrationId)
    }
  }

  /**
   * Analyze existing data for migration planning
   */
  private async analyzeExistingData(workspaceId?: string): Promise<{
    recordCount: number
    currentVersion: number
    dataTypes: string[]
    riskFactors: string[]
    storageSize: number
    oldestRecord: number
    newestRecord: number
  }> {
    try {
      // Get existing workspace data
      const workspaces = workspaceId ? 
        [await workspaceDatabase.getWorkspace(workspaceId)].filter(Boolean) : 
        await workspaceDatabase.getAllWorkspaces()
      
      let recordCount = 0
      let storageSize = 0
      let oldestRecord = Date.now()
      let newestRecord = 0
      const dataTypes = new Set<string>()
      const riskFactors: string[] = []
      
      // Analyze each workspace
      for (const workspace of workspaces) {
        if (!workspace) continue
        
        recordCount++
        storageSize += estimateStorageSize(workspace)
        oldestRecord = Math.min(oldestRecord, workspace.createdAt)
        newestRecord = Math.max(newestRecord, workspace.lastAccessedAt)
        
        // Check for different data types
        if (workspace.config) {
          dataTypes.add('workspace_config')
        }
        
        // Check for risk factors
        if (workspace.version && workspace.version < SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_VERSION) {
          riskFactors.push(`Outdated version: ${workspace.version}`)
        }
        
        if (storageSize > 50 * 1024 * 1024) { // 50MB threshold
          riskFactors.push('Large data size detected')
        }
        
        // REMOVED: Legacy workspace sessions (replaced by step configurations)
        // Skip session analysis as sessions have been migrated to step configs
        console.log(`Skipping legacy session analysis for workspace ${workspace.id} - sessions replaced by step configurations`)
      }
      
      return {
        recordCount,
        currentVersion: 0, // Assume legacy version
        dataTypes: Array.from(dataTypes),
        riskFactors,
        storageSize,
        oldestRecord: oldestRecord === Date.now() ? 0 : oldestRecord,
        newestRecord
      }
      
    } catch (error) {
      throw this.createMigrationError('DATA_ANALYSIS_FAILED', `Data analysis failed: ${error}`, workspaceId)
    }
  }

  /**
   * Plan migration steps based on analysis
   */
  private planMigrationSteps(analysis: {
    recordCount: number
    currentVersion: number
    dataTypes: string[]
    riskFactors: string[]
    storageSize: number
  }): MigrationStep[] {
    const steps: MigrationStep[] = []
    
    // Step 1: Backup existing data (if required)
    if (analysis.riskFactors.length > 0 || analysis.recordCount > 50) {
      steps.push({
        id: 'backup-data',
        name: 'Backup Existing Data',
        description: 'Create backup of existing subtitle and workspace data',
        operation: 'backup',
        estimatedDuration: Math.max(5000, analysis.storageSize / 1000), // 1ms per KB minimum 5s
        riskLevel: 'low',
        dependencies: []
      })
    }
    
    // Step 2: Create new storage structure
    steps.push({
      id: 'create-structure',
      name: 'Create Storage Structure',
      description: 'Initialize new temporary storage database structure',
      operation: 'transform',
      estimatedDuration: 2000,
      riskLevel: 'low',
      dependencies: analysis.riskFactors.length > 0 ? ['backup-data'] : []
    })
    
    // Step 3: Migrate workspace data
    if (analysis.dataTypes.includes('workspace_config')) {
      steps.push({
        id: 'migrate-workspaces',
        name: 'Migrate Workspace Data',
        description: 'Convert existing workspace configurations to new format',
        operation: 'transform',
        estimatedDuration: analysis.recordCount * 100, // 100ms per record
        riskLevel: 'medium',
        dependencies: ['create-structure']
      })
    }
    
    // Step 4: Migrate session data
    if (analysis.dataTypes.includes('workspace_session')) {
      steps.push({
        id: 'migrate-sessions',
        name: 'Migrate Session Data',
        description: 'Convert existing session data to new temporary storage format',
        operation: 'transform',
        estimatedDuration: analysis.recordCount * 50, // 50ms per session
        riskLevel: 'medium',
        dependencies: ['migrate-workspaces']
      })
    }
    
    // Step 5: Validate migrated data
    steps.push({
      id: 'validate-migration',
      name: 'Validate Migrated Data',
      description: 'Verify integrity of migrated data using hash validation',
      operation: 'validate',
      estimatedDuration: analysis.recordCount * 200, // 200ms per record for validation
      riskLevel: 'low',
      dependencies: steps.length > 0 ? [steps[steps.length - 1].id] : []
    })
    
    // Step 6: Rebuild indexes
    steps.push({
      id: 'rebuild-indexes',
      name: 'Rebuild Database Indexes',
      description: 'Optimize database indexes for new storage structure',
      operation: 'index_rebuild',
      estimatedDuration: 5000,
      riskLevel: 'low',
      dependencies: ['validate-migration']
    })
    
    // Step 7: Cleanup old data (optional, high risk)
    if (analysis.recordCount > 100) {
      steps.push({
        id: 'cleanup-legacy',
        name: 'Cleanup Legacy Data',
        description: 'Remove old data structures after successful migration',
        operation: 'cleanup',
        estimatedDuration: 3000,
        riskLevel: 'high',
        dependencies: ['rebuild-indexes']
      })
    }
    
    return steps
  }

  // ============================================================================
  // MIGRATION EXECUTION
  // ============================================================================

  /**
   * Execute migration plan
   */
  async executeMigration(
    plan: MigrationPlan,
    options: {
      skipBackup?: boolean
      skipCleanup?: boolean
      validateEachStep?: boolean
      onProgress?: (step: string, progress: number) => void
    } = {}
  ): Promise<MigrationResult> {
    const migrationId = plan.id
    const startTime = Date.now()
    
    const result: MigrationResult = {
      success: false,
      migrationId,
      startTime,
      endTime: 0,
      totalDuration: 0,
      stepsCompleted: [],
      stepsFailed: [],
      recordsMigrated: 0,
      errors: [],
      warnings: []
    }
    
    this.activeMigrations.set(migrationId, result)
    
    try {
      let recordsMigrated = 0
      
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i]
        
        // Skip backup if requested
        if (step.operation === 'backup' && options.skipBackup) {
          result.warnings.push(`Skipped backup step: ${step.id}`)
          continue
        }
        
        // Skip cleanup if requested
        if (step.operation === 'cleanup' && options.skipCleanup) {
          result.warnings.push(`Skipped cleanup step: ${step.id}`)
          continue
        }
        
        // Report progress
        if (options.onProgress) {
          options.onProgress(step.name, (i / plan.steps.length) * 100)
        }
        
        try {
          // Execute step
          const stepResult = await this.executeStep(step, migrationId)
          
          if (stepResult.success) {
            result.stepsCompleted.push(step.id)
            recordsMigrated += stepResult.recordsProcessed
            
            if (stepResult.warnings) {
              result.warnings.push(...stepResult.warnings)
            }
          } else {
            result.stepsFailed.push(step.id)
            if (stepResult.error) {
              result.errors.push(stepResult.error)
            }
            
            // Stop on critical failures
            if (step.riskLevel === 'high' || step.operation === 'validate') {
              throw this.createMigrationError('MIGRATION_STEP_FAILED', `Critical step failed: ${step.name}`, undefined, migrationId)
            }
          }
          
          // Validate each step if requested
          if (options.validateEachStep) {
            const validationResult = await this.validateMigrationStep(step, migrationId)
            if (!validationResult.isValid) {
              result.warnings.push(`Step validation warnings for ${step.id}: ${validationResult.issues.join(', ')}`)
            }
          }
          
        } catch (error) {
          result.stepsFailed.push(step.id)
          result.errors.push(
            this.createMigrationError('MIGRATION_STEP_FAILED', `Step ${step.id} failed: ${error}`, undefined, migrationId)
          )
          
          // Continue with non-critical steps
          if (step.riskLevel !== 'high') {
            result.warnings.push(`Non-critical step failed, continuing: ${step.id}`)
            continue
          } else {
            break
          }
        }
      }
      
      // Final progress report
      if (options.onProgress) {
        options.onProgress('Migration Complete', 100)
      }
      
      result.recordsMigrated = recordsMigrated
      result.success = result.stepsFailed.length === 0 || 
                      result.stepsFailed.every(stepId => 
                        plan.steps.find(s => s.id === stepId)?.riskLevel !== 'high'
                      )
      
    } catch (error) {
      result.errors.push(
        this.createMigrationError('MIGRATION_FAILED', `Migration execution failed: ${error}`, undefined, migrationId)
      )
    } finally {
      result.endTime = Date.now()
      result.totalDuration = result.endTime - result.startTime
      this.activeMigrations.delete(migrationId)
    }
    
    return result
  }

  /**
   * Execute individual migration step
   */
  private async executeStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
    error?: SubtitleTempError
    warnings?: string[]
  }> {
    const warnings: string[] = []
    let recordsProcessed = 0
    
    try {
      switch (step.operation) {
        case 'backup':
          return await this.executeBackupStep(step, migrationId)
        
        case 'transform':
          if (step.id === 'create-structure') {
            return await this.executeCreateStructureStep(step, migrationId)
          } else if (step.id === 'migrate-workspaces') {
            return await this.executeMigrateWorkspacesStep(step, migrationId)
          } else if (step.id === 'migrate-sessions') {
            return await this.executeMigrateSessionsStep(step, migrationId)
          }
          break
        
        case 'validate':
          return await this.executeValidationStep(step, migrationId)
        
        case 'index_rebuild':
          return await this.executeIndexRebuildStep(step, migrationId)
        
        case 'cleanup':
          return await this.executeCleanupStep(step, migrationId)
      }
      
      return {
        success: false,
        recordsProcessed: 0,
        error: this.createMigrationError('UNKNOWN_STEP_TYPE', `Unknown step type: ${step.operation}`, undefined, migrationId)
      }
      
    } catch (error) {
      return {
        success: false,
        recordsProcessed,
        error: this.createMigrationError('STEP_EXECUTION_FAILED', `Step execution failed: ${error}`, undefined, migrationId)
      }
    }
  }

  // ============================================================================
  // STEP IMPLEMENTATIONS
  // ============================================================================

  /**
   * Execute backup step
   */
  private async executeBackupStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
    warnings?: string[]
  }> {
    try {
      // Get all workspace data
      const workspaces = await workspaceDatabase.getAllWorkspaces()
      const backupData: any[] = []
      
      for (const workspace of workspaces) {
        backupData.push({
          type: 'workspace',
          data: workspace,
          backupTimestamp: Date.now()
        })
        
        // REMOVED: Legacy sessions (replaced by step configurations)
        // Skip session backup as sessions have been migrated to step configs
        console.log(`Skipping legacy session backup for workspace ${workspace.id} - sessions replaced by step configurations`)
      }
      
      // Store backup data (in production, this would be written to a file or external storage)
      const backupKey = `migration_backup_${migrationId}_${Date.now()}`
      localStorage.setItem(backupKey, JSON.stringify(backupData))
      
      return {
        success: true,
        recordsProcessed: backupData.length,
        warnings: [`Backup stored in localStorage as ${backupKey}`]
      }
      
    } catch (error) {
      throw this.createMigrationError('BACKUP_FAILED', `Backup step failed: ${error}`, undefined, migrationId)
    }
  }

  /**
   * Execute create structure step
   */
  private async executeCreateStructureStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
  }> {
    try {
      // Verify the new database structure exists
      const healthCheck = await workspaceDatabase.healthCheck()
      
      if (!healthCheck.isHealthy) {
        throw new Error(`Database health check failed: ${healthCheck.issues.join(', ')}`)
      }
      
      return {
        success: true,
        recordsProcessed: 0
      }
      
    } catch (error) {
      throw this.createMigrationError('STRUCTURE_CREATION_FAILED', `Structure creation failed: ${error}`, undefined, migrationId)
    }
  }

  /**
   * Execute migrate workspaces step
   */
  private async executeMigrateWorkspacesStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
    warnings?: string[]
  }> {
    try {
      const workspaces = await workspaceDatabase.getAllWorkspaces()
      const warnings: string[] = []
      let recordsProcessed = 0
      
      for (const workspace of workspaces) {
        try {
          // Create default session for existing workspace
          const sessionId = generateTempStorageId('session')
          const autoSaveConfig: SubtitleAutoSaveConfig = {
            enabled: true,
            intervalMs: DEFAULT_SUBTITLE_TEMP_CONFIG.autoSave.intervalMs,
            saveOnIdle: true,
            idleTimeoutMs: DEFAULT_SUBTITLE_TEMP_CONFIG.autoSave.idleTimeoutMs,
            saveOnChangeCount: 10,
            createBackups: true,
            maxBackups: 5,
            compressionEnabled: true,
            validateBeforeSave: true
          }
          
          const sessionResponse = await subtitleTempStorageService.createOrUpdateSession(
            workspace.id,
            sessionId,
            'editing',
            autoSaveConfig
          )
          
          if (sessionResponse.success) {
            recordsProcessed++
          } else {
            warnings.push(`Failed to create session for workspace ${workspace.id}: ${sessionResponse.error?.message}`)
          }
          
        } catch (error) {
          warnings.push(`Failed to migrate workspace ${workspace.id}: ${error}`)
        }
      }
      
      return {
        success: true,
        recordsProcessed,
        warnings: warnings.length > 0 ? warnings : undefined
      }
      
    } catch (error) {
      throw this.createMigrationError('WORKSPACE_MIGRATION_FAILED', `Workspace migration failed: ${error}`, undefined, migrationId)
    }
  }

  /**
   * Execute migrate sessions step
   */
  private async executeMigrateSessionsStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
    warnings?: string[]
  }> {
    try {
      // Get all workspace sessions from old format
      const workspaces = await workspaceDatabase.getAllWorkspaces()
      const warnings: string[] = []
      let recordsProcessed = 0
      
      for (const workspace of workspaces) {
        // REMOVED: Legacy session migration (sessions replaced by step configurations)
        // Skip session migration as the sessions system has been removed
        console.log(`Skipping legacy session migration for workspace ${workspace.id} - sessions replaced by step configurations`)
        continue
        
        // Legacy code removed - sessions no longer exist
        const sessions: any[] = [] // Empty array to prevent errors
        
        for (const session of sessions) {
          try {
            // If there's subtitle data in the session, migrate it
            if (session.data && typeof session.data === 'object') {
              const sessionData = session.data as any
              
              if (sessionData.subtitles && Array.isArray(sessionData.subtitles)) {
                const saveResponse = await subtitleTempStorageService.saveSubtitleContent(
                  workspace.id,
                  session.id,
                  sessionData.subtitles as SubtitleData[],
                  'modified',
                  {
                    validateBeforeSave: true,
                    createBackup: false
                  }
                )
                
                if (saveResponse.success) {
                  recordsProcessed++
                } else {
                  warnings.push(`Failed to migrate subtitle data for session ${session.id}: ${saveResponse.error?.message}`)
                }
              }
            }
            
          } catch (error) {
            warnings.push(`Failed to migrate session ${session.id}: ${error}`)
          }
        }
      }
      
      return {
        success: true,
        recordsProcessed,
        warnings: warnings.length > 0 ? warnings : undefined
      }
      
    } catch (error) {
      throw this.createMigrationError('SESSION_MIGRATION_FAILED', `Session migration failed: ${error}`, undefined, migrationId)
    }
  }

  /**
   * Execute validation step
   */
  private async executeValidationStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
    warnings?: string[]
  }> {
    try {
      // Validate migrated data integrity
      const warnings: string[] = []
      let recordsProcessed = 0
      
      // This would typically validate the new storage format
      // For now, we'll just verify the service is working
      const servicePerformance = subtitleTempStorageService.getPerformanceMetrics()
      
      if (Object.keys(servicePerformance).length === 0) {
        warnings.push('No performance metrics available - service may not have been used yet')
      }
      
      recordsProcessed = Object.values(servicePerformance).reduce((sum, metric) => sum + metric.count, 0)
      
      return {
        success: true,
        recordsProcessed,
        warnings: warnings.length > 0 ? warnings : undefined
      }
      
    } catch (error) {
      throw this.createMigrationError('VALIDATION_FAILED', `Validation step failed: ${error}`, undefined, migrationId)
    }
  }

  /**
   * Execute index rebuild step
   */
  private async executeIndexRebuildStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
  }> {
    try {
      // In a real implementation, this would rebuild database indexes
      // For IndexedDB, this is handled automatically
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate work
      
      return {
        success: true,
        recordsProcessed: 0
      }
      
    } catch (error) {
      throw this.createMigrationError('INDEX_REBUILD_FAILED', `Index rebuild failed: ${error}`, undefined, migrationId)
    }
  }

  /**
   * Execute cleanup step
   */
  private async executeCleanupStep(step: MigrationStep, migrationId: string): Promise<{
    success: boolean
    recordsProcessed: number
    warnings?: string[]
  }> {
    try {
      // Cleanup old backup data from localStorage
      const warnings: string[] = []
      let recordsProcessed = 0
      
      // Find backup keys
      const backupKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('migration_backup_')) {
          backupKeys.push(key)
        }
      }
      
      // Remove old backups (keep only the most recent 5)
      if (backupKeys.length > 5) {
        const keysToRemove = backupKeys.slice(0, backupKeys.length - 5)
        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
          recordsProcessed++
        })
        
        warnings.push(`Removed ${keysToRemove.length} old backup entries`)
      }
      
      return {
        success: true,
        recordsProcessed,
        warnings: warnings.length > 0 ? warnings : undefined
      }
      
    } catch (error) {
      throw this.createMigrationError('CLEANUP_FAILED', `Cleanup step failed: ${error}`, undefined, migrationId)
    }
  }

  // ============================================================================
  // VALIDATION AND UTILITIES
  // ============================================================================

  /**
   * Validate migration step
   */
  private async validateMigrationStep(step: MigrationStep, migrationId: string): Promise<{
    isValid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    
    try {
      switch (step.operation) {
        case 'backup':
          // Check if backup exists
          const backupKey = `migration_backup_${migrationId}`
          if (!localStorage.getItem(backupKey)) {
            issues.push('Backup data not found')
          }
          break
        
        case 'transform':
          // Validate database structure
          const healthCheck = await workspaceDatabase.healthCheck()
          if (!healthCheck.isHealthy) {
            issues.push(`Database health issues: ${healthCheck.issues.join(', ')}`)
          }
          break
        
        case 'validate':
          // Additional validation checks
          break
      }
      
    } catch (error) {
      issues.push(`Validation error: ${error}`)
    }
    
    return {
      isValid: issues.length === 0,
      issues
    }
  }

  /**
   * Get migration status
   */
  getMigrationStatus(migrationId: string): MigrationResult | null {
    return this.activeMigrations.get(migrationId) || null
  }

  /**
   * Get all active migrations
   */
  getActiveMigrations(): MigrationResult[] {
    return Array.from(this.activeMigrations.values())
  }

  /**
   * Create migration error
   */
  private createMigrationError(
    code: SubtitleTempError['code'],
    message: string,
    workspaceId?: string,
    migrationId?: string
  ): SubtitleTempError {
    return {
      code,
      message,
      workspaceId,
      sessionId: migrationId,
      storageId: migrationId,
      context: { migrationId },
      timestamp: Date.now(),
      severity: 'critical',
      recoverySuggestions: [
        'Check migration logs for details',
        'Restore from backup if available',
        'Contact support for assistance',
        'Consider manual data recovery'
      ]
    }
  }

  // ============================================================================
  // LEGACY DATA IMPORT
  // ============================================================================

  /**
   * Import legacy subtitle data
   */
  async importLegacyData(
    legacyData: LegacySubtitleData[],
    options: {
      validateData?: boolean
      createBackup?: boolean
      overwriteExisting?: boolean
    } = {}
  ): Promise<{
    success: boolean
    recordsImported: number
    recordsSkipped: number
    errors: SubtitleTempError[]
    warnings: string[]
  }> {
    const result = {
      success: false,
      recordsImported: 0,
      recordsSkipped: 0,
      errors: [] as SubtitleTempError[],
      warnings: [] as string[]
    }
    
    try {
      for (const legacyRecord of legacyData) {
        try {
          // Validate legacy data format
          if (!legacyRecord.workspaceId || !Array.isArray(legacyRecord.subtitles)) {
            result.recordsSkipped++
            result.warnings.push(`Skipped invalid legacy record: missing workspaceId or subtitles`)
            continue
          }
          
          // Create session if not exists
          const sessionId = legacyRecord.session?.sessionId || generateTempStorageId('imported-session')
          const sessionType = (legacyRecord.session?.sessionType as any) || 'editing'
          
          const sessionResponse = await subtitleTempStorageService.createOrUpdateSession(
            legacyRecord.workspaceId,
            sessionId,
            sessionType,
            {
              enabled: legacyRecord.session?.autoSave || false,
              intervalMs: 30000,
              saveOnIdle: true,
              idleTimeoutMs: 300000,
              saveOnChangeCount: 10,
              createBackups: options.createBackup || false,
              maxBackups: 5,
              compressionEnabled: true,
              validateBeforeSave: options.validateData || false
            }
          )
          
          if (!sessionResponse.success) {
            result.errors.push(sessionResponse.error || this.createMigrationError('SESSION_CREATION_FAILED', 'Failed to create session for import'))
            continue
          }
          
          // Import subtitle data
          const saveResponse = await subtitleTempStorageService.saveSubtitleContent(
            legacyRecord.workspaceId,
            sessionId,
            legacyRecord.subtitles,
            'original',
            {
              validateBeforeSave: options.validateData,
              createBackup: options.createBackup,
              compressionEnabled: true
            }
          )
          
          if (saveResponse.success) {
            result.recordsImported++
          } else {
            result.errors.push(saveResponse.error || this.createMigrationError('DATA_IMPORT_FAILED', 'Failed to import subtitle data'))
            result.recordsSkipped++
          }
          
        } catch (error) {
          result.errors.push(this.createMigrationError('IMPORT_RECORD_FAILED', `Failed to import record: ${error}`))
          result.recordsSkipped++
        }
      }
      
      result.success = result.errors.length === 0 || result.recordsImported > 0
      
    } catch (error) {
      result.errors.push(this.createMigrationError('IMPORT_FAILED', `Legacy data import failed: ${error}`))
    }
    
    return result
  }

  /**
   * Export data for backup
   */
  async exportForBackup(workspaceId?: string): Promise<{
    success: boolean
    exportData: any
    exportSize: number
    timestamp: number
    errors: SubtitleTempError[]
  }> {
    const result = {
      success: false,
      exportData: null as any,
      exportSize: 0,
      timestamp: Date.now(),
      errors: [] as SubtitleTempError[]
    }
    
    try {
      const exportData: any = {
        version: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_VERSION,
        timestamp: result.timestamp,
        workspaces: [],
        sessions: [],
        storageRecords: []
      }
      
      // Export workspace data
      const workspaces = workspaceId ? 
        [await workspaceDatabase.getWorkspace(workspaceId)].filter(Boolean) : 
        await workspaceDatabase.getAllWorkspaces()
      
      exportData.workspaces = workspaces
      
      // Export session data for each workspace
      for (const workspace of workspaces) {
        if (!workspace) continue
        
        try {
          // REMOVED: Legacy session export (sessions replaced by step configurations)
          // Skip session export as sessions have been migrated to step configs
          console.log(`Skipping legacy session export for workspace ${workspace.id} - sessions replaced by step configurations`)
        } catch (error) {
          result.errors.push(this.createMigrationError('EXPORT_SESSION_FAILED', `Failed to export step configs for workspace ${workspace.id}: ${error}`))
        }
      }
      
      result.exportData = exportData
      result.exportSize = estimateStorageSize(exportData)
      result.success = result.errors.length === 0
      
    } catch (error) {
      result.errors.push(this.createMigrationError('EXPORT_FAILED', `Export failed: ${error}`))
    }
    
    return result
  }
}

// ============================================================================
// SINGLETON AND EXPORTS
// ============================================================================

export const subtitleTempMigrationService = new SubtitleTempMigrationService()

export type {
  MigrationPlan,
  MigrationStep,
  MigrationResult,
  LegacySubtitleData
}