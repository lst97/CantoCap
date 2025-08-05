/**
 * Enhanced Subtitle Auto-Save System - Service Layer Integration
 * 
 * Unified export for all subtitle temporary storage services and utilities.
 * This module provides a clean API for integrating the enhanced auto-save system
 * with the existing Canton-Cap application architecture.
 */

// ============================================================================
// CORE SERVICES
// ============================================================================

export { WorkspaceDatabase, workspaceDatabase } from './workspace/workspace-database'
export { SubtitleTempStorageService, subtitleTempStorageService } from './subtitle/subtitle-temp-storage-service'
export { SubtitleTempMigrationService, subtitleTempMigrationService } from './subtitle/subtitle-temp-migration'

// ============================================================================
// VALIDATION AND INTEGRITY
// ============================================================================

export {
  HashValidator,
  DataIntegrityValidator,
  CorruptionDetector,
  createIntegrityError,
  shouldValidateIntegrity,
  generateIntegrityReport
} from '../utils/subtitle-integrity-validator'

export type {
  IntegrityIssue,
  CorruptionSign
} from '../utils/subtitle-integrity-validator'

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Core temporary storage types
export type {
  SubtitleTempMetadata,
  SubtitleTempContent,
  SubtitleTempSession,
  SubtitleTempStorageRecord,
  SubtitleTempSessionRecord,
  SubtitleTempError,
  SubtitleTempOperationRequest,
  SubtitleTempOperationResponse,
  SubtitleTempBatchOperation,
  SubtitleTempBatchResponse,
  SubtitleTempCleanupResult,
  SubtitleTempStorageConfig,
  SubtitleAutoSaveConfig,
  SubtitleTempStatistics,
  SubtitleValidationWarning,
  SubtitleValidationError,
  SubtitleTempFilters,
  SubtitleTempSessionState
} from '../types/subtitle-temp-storage'

// Migration types
export type {
  MigrationPlan,
  MigrationStep,
  MigrationResult,
  LegacySubtitleData
} from './subtitle/subtitle-temp-migration'

// ============================================================================
// CONSTANTS AND UTILITIES
// ============================================================================

export {
  SUBTITLE_TEMP_STORAGE_CONSTANTS,
  DEFAULT_SUBTITLE_TEMP_CONFIG,
  generateTempStorageId,
  calculateContentHash,
  estimateStorageSize,
  shouldCleanup,
  isSubtitleTempError,
  isSubtitleTempContent,
  isSubtitleTempSession
} from '../types/subtitle-temp-storage'

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Initialize the enhanced subtitle auto-save system
 */
export async function initializeSubtitleAutoSave(config?: Partial<SubtitleTempStorageConfig>): Promise<{
  success: boolean
  error?: SubtitleTempError
  migrationRequired?: boolean
}> {
  try {
    // Check if migration is needed
    const migrationPlan = await subtitleTempMigrationService.createMigrationPlan()
    const migrationRequired = migrationPlan.steps.length > 2 // More than just structure and validation
    
    if (migrationRequired) {
      console.log('Migration required for subtitle auto-save system')
      return {
        success: true,
        migrationRequired: true
      }
    }
    
    // Update service configuration if provided
    if (config) {
      subtitleTempStorageService.updateConfiguration(config)
    }
    
    console.log('Subtitle auto-save system initialized successfully')
    return { success: true }
    
  } catch (error) {
    const tempError: SubtitleTempError = {
      code: 'STORAGE_UNAVAILABLE',
      message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now(),
      severity: 'critical',
      recoverySuggestions: [
        'Check browser IndexedDB support',
        'Clear browser cache and reload',
        'Check for storage quota issues'
      ]
    }
    
    return {
      success: false,
      error: tempError
    }
  }
}

/**
 * Perform system migration with progress reporting
 */
export async function performSystemMigration(
  onProgress?: (step: string, progress: number) => void
): Promise<MigrationResult> {
  try {
    const migrationPlan = await subtitleTempMigrationService.createMigrationPlan()
    
    return await subtitleTempMigrationService.executeMigration(migrationPlan, {
      skipBackup: false,
      skipCleanup: false,
      validateEachStep: true,
      onProgress
    })
    
  } catch (error) {
    return {
      success: false,
      migrationId: 'failed',
      startTime: Date.now(),
      endTime: Date.now(),
      totalDuration: 0,
      stepsCompleted: [],
      stepsFailed: ['initialization'],
      recordsMigrated: 0,
      errors: [{
        code: 'STORAGE_UNAVAILABLE',
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        severity: 'critical',
        recoverySuggestions: ['Check system requirements', 'Contact support']
      }],
      warnings: []
    }
  }
}

/**
 * Create a new auto-save session for subtitle editing
 */
export async function createAutoSaveSession(
  workspaceId: string,
  sessionType: SubtitleTempSession['sessionType'] = 'editing',
  autoSaveConfig?: Partial<SubtitleAutoSaveConfig>
): Promise<{
  success: boolean
  sessionId?: string
  session?: SubtitleTempSession
  error?: SubtitleTempError
}> {
  try {
    const sessionId = generateTempStorageId('session')
    const config: SubtitleAutoSaveConfig = {
      ...DEFAULT_SUBTITLE_TEMP_CONFIG.autoSave,
      ...autoSaveConfig
    }
    
    const response = await subtitleTempStorageService.createOrUpdateSession(
      workspaceId,
      sessionId,
      sessionType,
      config
    )
    
    if (response.success) {
      return {
        success: true,
        sessionId,
        session: response.data
      }
    } else {
      return {
        success: false,
        error: response.error
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        workspaceId,
        timestamp: Date.now(),
        severity: 'medium',
        recoverySuggestions: ['Verify workspace ID', 'Check session configuration', 'Retry operation']
      }
    }
  }
}

/**
 * Auto-save subtitle content with integrity validation
 */
export async function autoSaveSubtitles(
  workspaceId: string,
  sessionId: string,
  subtitles: SubtitleData[],
  options?: {
    validateBeforeSave?: boolean
    createBackup?: boolean
    storageType?: SubtitleTempMetadata['storageType']
  }
): Promise<{
  success: boolean
  storageId?: string
  validationWarnings?: SubtitleValidationWarning[]
  error?: SubtitleTempError
}> {
  try {
    const response = await subtitleTempStorageService.saveSubtitleContent(
      workspaceId,
      sessionId,
      subtitles,
      options?.storageType || 'auto_save',
      {
        validateBeforeSave: options?.validateBeforeSave ?? true,
        createBackup: options?.createBackup ?? true,
        compressionEnabled: true
      }
    )
    
    if (response.success && response.data) {
      return {
        success: true,
        storageId: response.data.storageId
      }
    } else {
      return {
        success: false,
        error: response.error
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Auto-save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        workspaceId,
        sessionId,
        timestamp: Date.now(),
        severity: 'medium',
        recoverySuggestions: ['Check subtitle data format', 'Verify session exists', 'Retry save operation']
      }
    }
  }
}

/**
 * Load subtitle content with integrity validation
 */
export async function loadSubtitles(
  storageId: string,
  options?: {
    validateOnLoad?: boolean
    includeMetadata?: boolean
  }
): Promise<{
  success: boolean
  content?: SubtitleTempContent
  validationWarnings?: SubtitleValidationWarning[]
  error?: SubtitleTempError
}> {
  try {
    const response = await subtitleTempStorageService.loadSubtitleContent(storageId, {
      validateOnLoad: options?.validateOnLoad ?? true,
      includeMetadata: options?.includeMetadata ?? false
    })
    
    if (response.success) {
      return {
        success: true,
        content: response.data
      }
    } else {
      return {
        success: false,
        error: response.error
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Load failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storageId,
        timestamp: Date.now(),
        severity: 'medium',
        recoverySuggestions: ['Verify storage ID exists', 'Check data integrity', 'Try alternative backup']
      }
    }
  }
}

/**
 * Perform system cleanup and maintenance
 */
export async function performSystemCleanup(): Promise<SubtitleTempCleanupResult> {
  try {
    return await subtitleTempStorageService.performAutomaticCleanup()
  } catch (error) {
    return {
      cleanupId: generateTempStorageId('cleanup-failed'),
      recordsProcessed: 0,
      recordsDeleted: 0,
      spaceReclaimed: 0,
      duration: 0,
      timestamp: Date.now(),
      errors: [{
        code: 'VALIDATION_FAILED',
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        severity: 'medium',
        recoverySuggestions: ['Check database status', 'Retry cleanup', 'Manual cleanup may be required']
      }]
    }
  }
}

/**
 * Get system health and performance metrics
 */
export async function getSystemHealth(): Promise<{
  databaseHealth: { isHealthy: boolean; issues: string[] }
  serviceMetrics: Record<string, { average: number; min: number; max: number; count: number }>
  storageUsage: { workspaces: number; sessions: number; total: number }
  migrationStatus?: MigrationResult[]
}> {
  try {
    const [databaseHealth, storageUsage] = await Promise.all([
      workspaceDatabase.healthCheck(),
      workspaceDatabase.getDatabaseSize()
    ])
    
    const serviceMetrics = subtitleTempStorageService.getPerformanceMetrics()
    const migrationStatus = subtitleTempMigrationService.getActiveMigrations()
    
    return {
      databaseHealth,
      serviceMetrics,
      storageUsage,
      migrationStatus: migrationStatus.length > 0 ? migrationStatus : undefined
    }
    
  } catch (error) {
    return {
      databaseHealth: { isHealthy: false, issues: [`Health check failed: ${error}`] },
      serviceMetrics: {},
      storageUsage: { workspaces: 0, sessions: 0, total: 0 }
    }
  }
}

/**
 * Import legacy subtitle data
 */
export async function importLegacySubtitles(
  legacyData: LegacySubtitleData[],
  options?: {
    validateData?: boolean
    createBackup?: boolean
    overwriteExisting?: boolean
  }
): Promise<{
  success: boolean
  recordsImported: number
  recordsSkipped: number
  errors: SubtitleTempError[]
  warnings: string[]
}> {
  return await subtitleTempMigrationService.importLegacyData(legacyData, options)
}

// ============================================================================
// TYPE RE-EXPORTS FOR CONVENIENCE
// ============================================================================

import type { SubtitleData } from '../../../types'
import type {
  SubtitleTempStorageConfig,
  SubtitleAutoSaveConfig,
  SubtitleTempSession,
  SubtitleTempContent,
  SubtitleTempMetadata,
  SubtitleTempError,
  SubtitleValidationWarning,
  SubtitleTempCleanupResult
} from '../types/subtitle-temp-storage'
import type { MigrationResult, LegacySubtitleData } from './subtitle/subtitle-temp-migration'
import {
  DEFAULT_SUBTITLE_TEMP_CONFIG,
  generateTempStorageId
} from '../types/subtitle-temp-storage'
import { subtitleTempStorageService } from './subtitle/subtitle-temp-storage-service'
import { subtitleTempMigrationService } from './subtitle/subtitle-temp-migration'

// Re-export SubtitleData for convenience
export type { SubtitleData }