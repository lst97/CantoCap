/**
 * Subtitle Temporary Storage Service
 * 
 * Enhanced subtitle auto-save system with IndexedDB persistence, data integrity validation,
 * and session management. Provides comprehensive CRUD operations for temporary subtitle storage.
 */

import type { SubtitleData } from '../../../types'
import type {
  SubtitleTempStorageRecord,
  SubtitleTempSessionRecord,
  SubtitleTempContent,
  SubtitleTempSession,
  SubtitleTempMetadata,
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
  SubtitleValidationError
} from '../types/subtitle-temp-storage'
import {
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
import { workspaceDatabase } from './workspace-database'

// ============================================================================
// CORE SERVICE CLASS
// ============================================================================

export class SubtitleTempStorageService {
  private config: SubtitleTempStorageConfig
  private operationQueue: Map<string, SubtitleTempOperationRequest> = new Map()
  private activeOperations: Set<string> = new Set()
  private cleanupTimer: NodeJS.Timeout | null = null
  private performanceMetrics: Map<string, number[]> = new Map()

  constructor(config: Partial<SubtitleTempStorageConfig> = {}) {
    this.config = { ...DEFAULT_SUBTITLE_TEMP_CONFIG, ...config }
    this.initializeService()
  }

  // ============================================================================
  // INITIALIZATION AND LIFECYCLE
  // ============================================================================

  /**
   * Initialize the service
   */
  private async initializeService(): Promise<void> {
    try {
      // Ensure database is ready
      await workspaceDatabase.healthCheck()
      
      // Start cleanup timer if enabled
      if (this.config.cleanup.enableAutomaticCleanup) {
        this.startCleanupTimer()
      }
      
      console.log('SubtitleTempStorageService initialized successfully')
    } catch (error) {
      console.error('Failed to initialize SubtitleTempStorageService:', error)
      throw this.createError('STORAGE_UNAVAILABLE', 'Service initialization failed', undefined, undefined, undefined, error)
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.performAutomaticCleanup()
      } catch (error) {
        console.warn('Automatic cleanup failed:', error)
      }
    }, this.config.database.cleanupInterval)
  }

  /**
   * Stop the service and cleanup resources
   */
  public async stopService(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    
    // Wait for active operations to complete
    const activeOps = Array.from(this.activeOperations)
    if (activeOps.length > 0) {
      console.log(`Waiting for ${activeOps.length} active operations to complete...`)
      // Give operations a chance to complete
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    this.operationQueue.clear()
    this.activeOperations.clear()
    this.performanceMetrics.clear()
    
    console.log('SubtitleTempStorageService stopped')
  }

  // ============================================================================
  // SUBTITLE CONTENT OPERATIONS
  // ============================================================================

  /**
   * Save subtitle content to temporary storage
   */
  async saveSubtitleContent(
    workspaceId: string,
    sessionId: string,
    subtitles: SubtitleData[],
    storageType: SubtitleTempMetadata['storageType'] = 'modified',
    options: {
      compressionEnabled?: boolean
      validateBeforeSave?: boolean
      createBackup?: boolean
      parentId?: string
    } = {}
  ): Promise<SubtitleTempOperationResponse<{ storageId: string }>> {
    const operationId = generateTempStorageId('save-op')
    const startTime = Date.now()
    
    try {
      this.activeOperations.add(operationId)
      
      // Validate inputs
      if (!workspaceId || !sessionId || !Array.isArray(subtitles)) {
        throw this.createError('VALIDATION_FAILED', 'Invalid input parameters', workspaceId, sessionId, operationId)
      }
      
      // Create content structure
      const content = await this.createSubtitleContent(workspaceId, sessionId, subtitles)
      
      // Validate content if requested
      if (options.validateBeforeSave || this.config.validation.validateOnSave) {
        const validation = await this.validateContent(content)
        if (!validation.isValid && validation.errors.some(e => e.critical)) {
          throw this.createError('VALIDATION_FAILED', 'Content validation failed', workspaceId, sessionId, operationId, validation.errors)
        }
      }
      
      // Create metadata
      const metadata = await this.createSubtitleMetadata(workspaceId, sessionId, storageType, content, options.parentId)
      
      // Create storage record
      const storageRecord = await this.createStorageRecord(metadata, content, options.compressionEnabled)
      
      // Save to database
      const transaction = await workspaceDatabase['getTransaction']([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage',
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata'
      ], 'readwrite')
      
      const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
      const metadataStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata')
      
      await workspaceDatabase['promisifyRequest'](storageStore.put(storageRecord))
      await workspaceDatabase['promisifyRequest'](metadataStore.put(metadata))
      
      // Update latest flag for this session and type
      if (storageType === 'modified' || storageType === 'auto_save') {
        await this.updateLatestFlags(workspaceId, sessionId, storageType, storageRecord.id)
      }
      
      // Record performance metrics
      this.recordPerformanceMetric('save', Date.now() - startTime)
      
      return {
        operationId,
        success: true,
        data: { storageId: storageRecord.id },
        metrics: {
          duration: Date.now() - startTime,
          dataSize: storageRecord.dataSize
        },
        timestamp: Date.now()
      }
      
    } catch (error) {
      return this.createErrorResponse(operationId, error, Date.now() - startTime)
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Load subtitle content from temporary storage
   */
  async loadSubtitleContent(
    storageId: string,
    options: {
      validateOnLoad?: boolean
      includeMetadata?: boolean
    } = {}
  ): Promise<SubtitleTempOperationResponse<SubtitleTempContent>> {
    const operationId = generateTempStorageId('load-op')
    const startTime = Date.now()
    
    try {
      this.activeOperations.add(operationId)
      
      // Get storage record
      const transaction = await workspaceDatabase['getTransaction']([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage'
      ])
      
      const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
      const storageRecord = await workspaceDatabase['promisifyRequest'](storageStore.get(storageId)) as SubtitleTempStorageRecord | undefined
      
      if (!storageRecord) {
        throw this.createError('VALIDATION_FAILED', `Storage record not found: ${storageId}`)
      }
      
      // Deserialize content
      const content = await this.deserializeContent(storageRecord)
      
      // Validate content if requested
      if (options.validateOnLoad || this.config.validation.validateOnLoad) {
        const validation = await this.validateContent(content)
        if (!validation.isValid) {
          console.warn(`Content validation warnings for ${storageId}:`, validation.warnings)
          if (validation.errors.some(e => e.critical)) {
            throw this.createError('DATA_CORRUPTION', 'Critical content validation errors', content.metadata.workspaceId, content.metadata.sessionId, operationId, validation.errors)
          }
        }
      }
      
      // Record performance metrics
      this.recordPerformanceMetric('load', Date.now() - startTime)
      
      return {
        operationId,
        success: true,
        data: content,
        metrics: {
          duration: Date.now() - startTime,
          dataSize: storageRecord.dataSize
        },
        timestamp: Date.now()
      }
      
    } catch (error) {
      return this.createErrorResponse(operationId, error, Date.now() - startTime)
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Delete subtitle content from temporary storage
   */
  async deleteSubtitleContent(
    storageId: string,
    options: {
      deleteChildren?: boolean
      createBackup?: boolean
    } = {}
  ): Promise<SubtitleTempOperationResponse<{ deletedCount: number }>> {
    const operationId = generateTempStorageId('delete-op')
    const startTime = Date.now()
    
    try {
      this.activeOperations.add(operationId)
      
      let deletedCount = 0
      
      const transaction = await workspaceDatabase['getTransaction']([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage',
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata'
      ], 'readwrite')
      
      const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
      const metadataStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata')
      
      // Delete children if requested
      if (options.deleteChildren) {
        const parentIndex = storageStore.index('parentId')
        const childCursor = parentIndex.openCursor(IDBKeyRange.only(storageId))
        
        await new Promise<void>((resolve, reject) => {
          childCursor.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
            if (cursor) {
              cursor.delete()
              deletedCount++
              cursor.continue()
            } else {
              resolve()
            }
          }
          childCursor.onerror = () => reject(childCursor.error)
        })
      }
      
      // Delete main record
      await workspaceDatabase['promisifyRequest'](storageStore.delete(storageId))
      await workspaceDatabase['promisifyRequest'](metadataStore.delete(storageId))
      deletedCount++
      
      // Record performance metrics
      this.recordPerformanceMetric('delete', Date.now() - startTime)
      
      return {
        operationId,
        success: true,
        data: { deletedCount },
        metrics: {
          duration: Date.now() - startTime,
          operationCount: deletedCount
        },
        timestamp: Date.now()
      }
      
    } catch (error) {
      return this.createErrorResponse(operationId, error, Date.now() - startTime)
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Create or update a subtitle editing session
   */
  async createOrUpdateSession(
    workspaceId: string,
    sessionId: string,
    sessionType: SubtitleTempSession['sessionType'],
    autoSaveConfig: SubtitleAutoSaveConfig
  ): Promise<SubtitleTempOperationResponse<SubtitleTempSession>> {
    const operationId = generateTempStorageId('session-op')
    const startTime = Date.now()
    
    try {
      this.activeOperations.add(operationId)
      
      const transaction = await workspaceDatabase['getTransaction']([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_SESSIONS || 'subtitle_temp_sessions'
      ], 'readwrite')
      
      const sessionsStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_SESSIONS || 'subtitle_temp_sessions')
      
      // Check if session exists
      const existingRecord = await workspaceDatabase['promisifyRequest'](sessionsStore.get(sessionId)) as SubtitleTempSessionRecord | undefined
      
      const now = Date.now()
      let session: SubtitleTempSession
      
      if (existingRecord) {
        // Update existing session
        session = JSON.parse(existingRecord.sessionData)
        session.lastActivity = now
        session.autoSaveConfig = { ...session.autoSaveConfig, ...autoSaveConfig }
      } else {
        // Create new session
        session = {
          sessionId,
          workspaceId,
          sessionType,
          createdAt: now,
          lastActivity: now,
          state: {
            editingMode: 'simple',
            multiSelect: {
              enabled: false,
              selectedIds: []
            },
            undoRedoState: {
              undoStackSize: 0,
              redoStackSize: 0,
              canUndo: false,
              canRedo: false,
              lastActionTimestamp: now
            },
            pendingChanges: {
              hasChanges: false,
              changeCount: 0,
              lastChangeTimestamp: now,
              needsValidation: false
            }
          },
          autoSaveConfig,
          sessionStats: {
            totalEdits: 0,
            editingTime: 0,
            autoSavesCount: 0,
            manualSavesCount: 0,
            validationRuns: 0,
            errorCount: 0,
            averageSaveInterval: autoSaveConfig.intervalMs
          },
          backupManagement: {
            maxBackups: autoSaveConfig.maxBackups,
            retentionHours: 24,
            lastCleanup: now,
            backupIds: []
          }
        }
      }
      
      // Create session record
      const sessionRecord: SubtitleTempSessionRecord = {
        sessionId,
        workspaceId,
        sessionType,
        sessionData: JSON.stringify(session),
        stateHash: calculateContentHash(session.state),
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        status: 'active',
        storageIds: existingRecord?.storageIds || [],
        configData: JSON.stringify(autoSaveConfig),
        version: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_VERSION,
        schemaVersion: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_SCHEMA_VERSION
      }
      
      await workspaceDatabase['promisifyRequest'](sessionsStore.put(sessionRecord))
      
      // Record performance metrics
      this.recordPerformanceMetric('session', Date.now() - startTime)
      
      return {
        operationId,
        success: true,
        data: session,
        metrics: {
          duration: Date.now() - startTime,
          dataSize: estimateStorageSize(session)
        },
        timestamp: Date.now()
      }
      
    } catch (error) {
      return this.createErrorResponse(operationId, error, Date.now() - startTime)
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Get subtitle editing session
   */
  async getSession(sessionId: string): Promise<SubtitleTempOperationResponse<SubtitleTempSession | null>> {
    const operationId = generateTempStorageId('get-session-op')
    const startTime = Date.now()
    
    try {
      const transaction = await workspaceDatabase['getTransaction']([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_SESSIONS || 'subtitle_temp_sessions'
      ])
      
      const sessionsStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_SESSIONS || 'subtitle_temp_sessions')
      const sessionRecord = await workspaceDatabase['promisifyRequest'](sessionsStore.get(sessionId)) as SubtitleTempSessionRecord | undefined
      
      let session: SubtitleTempSession | null = null
      if (sessionRecord) {
        session = JSON.parse(sessionRecord.sessionData)
      }
      
      return {
        operationId,
        success: true,
        data: session,
        metrics: {
          duration: Date.now() - startTime,
          dataSize: session ? estimateStorageSize(session) : 0
        },
        timestamp: Date.now()
      }
      
    } catch (error) {
      return this.createErrorResponse(operationId, error, Date.now() - startTime)
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Execute batch operations
   */
  async executeBatchOperation<T = any>(
    batchOperation: SubtitleTempBatchOperation<T>
  ): Promise<SubtitleTempBatchResponse<T>> {
    const startTime = Date.now()
    const responses: SubtitleTempOperationResponse<T>[] = []
    let successCount = 0
    let errorCount = 0
    let totalDataProcessed = 0
    
    try {
      if (batchOperation.executionMode === 'parallel') {
        // Execute operations in parallel
        const promises = batchOperation.operations.map(op => this.executeOperation<T>(op))
        const results = await Promise.allSettled(promises)
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            responses.push(result.value)
            if (result.value.success) {
              successCount++
              totalDataProcessed += result.value.metrics.dataSize || 0
            } else {
              errorCount++
            }
          } else {
            errorCount++
            responses.push({
              operationId: batchOperation.operations[index].operationId,
              success: false,
              error: this.createError('VALIDATION_FAILED', `Operation failed: ${result.reason}`, batchOperation.operations[index].workspaceId, batchOperation.operations[index].sessionId, batchOperation.operations[index].operationId),
              metrics: { duration: 0 },
              timestamp: Date.now()
            })
          }
          
          // Report progress
          if (batchOperation.onProgress) {
            batchOperation.onProgress(responses.length, batchOperation.operations.length, responses[responses.length - 1])
          }
        })
      } else {
        // Execute operations sequentially
        for (const operation of batchOperation.operations) {
          try {
            const response = await this.executeOperation<T>(operation)
            responses.push(response)
            
            if (response.success) {
              successCount++
              totalDataProcessed += response.metrics.dataSize || 0
            } else {
              errorCount++
              
              // Stop on first error if transactional
              if (batchOperation.transactional && !response.success) {
                break
              }
            }
            
            // Report progress
            if (batchOperation.onProgress) {
              batchOperation.onProgress(responses.length, batchOperation.operations.length, response)
            }
          } catch (error) {
            errorCount++
            responses.push({
              operationId: operation.operationId,
              success: false,
              error: isSubtitleTempError(error) ? error : this.createError('VALIDATION_FAILED', `Operation error: ${error}`, operation.workspaceId, operation.sessionId, operation.operationId),
              metrics: { duration: 0 },
              timestamp: Date.now()
            })
            
            // Stop on first error if transactional
            if (batchOperation.transactional) {
              break
            }
          }
        }
      }
      
      return {
        batchId: batchOperation.batchId,
        success: errorCount === 0,
        responses,
        batchMetrics: {
          totalDuration: Date.now() - startTime,
          successCount,
          errorCount,
          dataProcessed: totalDataProcessed
        },
        timestamp: Date.now()
      }
      
    } catch (error) {
      return {
        batchId: batchOperation.batchId,
        success: false,
        responses,
        batchMetrics: {
          totalDuration: Date.now() - startTime,
          successCount,
          errorCount,
          dataProcessed: totalDataProcessed
        },
        timestamp: Date.now()
      }
    }
  }

  // ============================================================================
  // CLEANUP AND MAINTENANCE
  // ============================================================================

  /**
   * Perform automatic cleanup of old storage records
   */
  async performAutomaticCleanup(): Promise<SubtitleTempCleanupResult> {
    const cleanupId = generateTempStorageId('cleanup')
    const startTime = Date.now()
    const errors: SubtitleTempError[] = []
    let recordsProcessed = 0
    let recordsDeleted = 0
    let spaceReclaimed = 0
    
    try {
      const cutoffTime = Date.now() - (this.config.cleanup.maxRetentionDays * 24 * 60 * 60 * 1000)
      
      const transaction = await workspaceDatabase['getTransaction']([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage',
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata',
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_SESSIONS || 'subtitle_temp_sessions'
      ], 'readwrite')
      
      const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
      const metadataStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata')
      const sessionsStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_SESSIONS || 'subtitle_temp_sessions')
      
      // Cleanup old storage records
      const storageIndex = storageStore.index('createdAt')
      const storageCursor = storageIndex.openCursor(IDBKeyRange.upperBound(cutoffTime))
      
      await new Promise<void>((resolve, reject) => {
        storageCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            const record = cursor.value as SubtitleTempStorageRecord
            recordsProcessed++
            
            // Skip if it's marked as latest
            if (!record.isLatest) {
              cursor.delete()
              recordsDeleted++
              spaceReclaimed += record.dataSize
            }
            
            cursor.continue()
          } else {
            resolve()
          }
        }
        storageCursor.onerror = () => reject(storageCursor.error)
      })
      
      // Cleanup old sessions
      const sessionIndex = sessionsStore.index('lastActivity')
      const sessionCursor = sessionIndex.openCursor(IDBKeyRange.upperBound(cutoffTime))
      
      await new Promise<void>((resolve, reject) => {
        sessionCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            const record = cursor.value as SubtitleTempSessionRecord
            recordsProcessed++
            
            if (record.status === 'expired' || record.status === 'archived') {
              cursor.delete()
              recordsDeleted++
            }
            
            cursor.continue()
          } else {
            resolve()
          }
        }
        sessionCursor.onerror = () => reject(sessionCursor.error)
      })
      
    } catch (error) {
      errors.push(this.createError('VALIDATION_FAILED', `Cleanup error: ${error}`, undefined, undefined, cleanupId))
    }
    
    return {
      cleanupId,
      recordsProcessed,
      recordsDeleted,
      spaceReclaimed,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      errors
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Create subtitle content structure
   */
  private async createSubtitleContent(
    workspaceId: string,
    sessionId: string,
    subtitles: SubtitleData[]
  ): Promise<SubtitleTempContent> {
    const statistics = this.calculateStatistics(subtitles)
    
    return {
      metadata: {
        id: generateTempStorageId('content'),
        workspaceId,
        sessionId,
        version: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_VERSION,
        schemaVersion: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_SCHEMA_VERSION
      },
      subtitles,
      statistics,
      editingContext: {
        selectedIds: [],
        filters: {
          showOnlyModified: false,
          showOnlyUntranslated: false,
          showOnlyLowConfidence: false
        },
        viewState: {
          scrollPosition: 0,
          zoomLevel: 1,
          displayMode: 'list',
          showConfidence: true,
          showTimings: true
        }
      },
      changeTracking: {
        changeCount: 0,
        lastUserAction: Date.now(),
        modifiedIds: new Set(),
        changeSeverity: 'minor'
      },
      validation: {
        isValid: true,
        lastValidated: Date.now(),
        warnings: [],
        errors: [],
        integrityScore: 1.0
      }
    }
  }

  /**
   * Create subtitle metadata
   */
  private async createSubtitleMetadata(
    workspaceId: string,
    sessionId: string,
    storageType: SubtitleTempMetadata['storageType'],
    content: SubtitleTempContent,
    parentId?: string
  ): Promise<SubtitleTempMetadata> {
    const contentHash = calculateContentHash(content)
    const dataSize = estimateStorageSize(content)
    const now = Date.now()
    
    return {
      id: content.metadata.id,
      workspaceId,
      sessionId,
      storageType,
      createdAt: now,
      lastModified: now,
      dataSize,
      contentHash,
      metadataHash: calculateContentHash({ workspaceId, sessionId, storageType, contentHash }),
      version: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_VERSION,
      schemaVersion: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_SCHEMA_VERSION,
      autoSave: storageType === 'auto_save' ? {
        intervalMs: this.config.autoSave.intervalMs,
        triggerReason: 'timer',
        changeCount: content.changeTracking.changeCount,
        lastUserAction: content.changeTracking.lastUserAction
      } : undefined,
      backupChain: parentId ? {
        parentId,
        hasChildren: false,
        generationLevel: 1,
        isLatest: true
      } : undefined
    }
  }

  /**
   * Create storage record from metadata and content
   */
  private async createStorageRecord(
    metadata: SubtitleTempMetadata,
    content: SubtitleTempContent,
    compressionEnabled?: boolean
  ): Promise<SubtitleTempStorageRecord> {
    let contentData = JSON.stringify(content)
    let metadataData = JSON.stringify(metadata)
    let isCompressed = false
    
    // Apply compression if enabled and beneficial
    if ((compressionEnabled || this.config.performance.enableCompression) && 
        metadata.dataSize > this.config.performance.compressionThreshold) {
      // Simple compression simulation - in production, use actual compression
      const compressedContent = this.simpleCompress(contentData)
      if (compressedContent.length < contentData.length * 0.8) {
        contentData = compressedContent
        isCompressed = true
      }
    }
    
    return {
      id: metadata.id,
      workspaceId: metadata.workspaceId,
      sessionId: metadata.sessionId,
      storageType: metadata.storageType,
      contentData,
      metadataData,
      contentHash: metadata.contentHash,
      metadataHash: metadata.metadataHash,
      createdAt: metadata.createdAt,
      lastModified: metadata.lastModified,
      dataSize: metadata.dataSize,
      version: metadata.version,
      schemaVersion: metadata.schemaVersion,
      isCompressed,
      parentId: metadata.backupChain?.parentId,
      generationLevel: metadata.backupChain?.generationLevel || 0,
      isLatest: metadata.backupChain?.isLatest || true
    }
  }

  /**
   * Deserialize content from storage record
   */
  private async deserializeContent(record: SubtitleTempStorageRecord): Promise<SubtitleTempContent> {
    let contentData = record.contentData
    
    // Decompress if needed
    if (record.isCompressed) {
      contentData = this.simpleDecompress(contentData)
    }
    
    const content = JSON.parse(contentData) as SubtitleTempContent
    
    // Verify content hash
    const actualHash = calculateContentHash(content)
    if (actualHash !== record.contentHash) {
      throw this.createError('DATA_CORRUPTION', `Content hash mismatch for ${record.id}`, record.workspaceId, record.sessionId, record.id)
    }
    
    return content
  }

  /**
   * Calculate subtitle statistics
   */
  private calculateStatistics(subtitles: SubtitleData[]): SubtitleTempStatistics {
    const stats: SubtitleTempStatistics = {
      totalCount: subtitles.length,
      modifiedCount: 0,
      totalDuration: 0,
      contentCoverage: 0,
      averageConfidence: 0,
      textStats: {
        totalCharacters: 0,
        totalWords: 0,
        averageWordsPerSubtitle: 0
      },
      qualityMetrics: {
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
        untranslatedCount: 0,
        emptyTextCount: 0
      },
      timingAnalysis: {
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        gapCount: 0,
        overlapCount: 0,
        totalGapDuration: 0
      }
    }
    
    if (subtitles.length === 0) return stats
    
    let totalConfidence = 0
    let confidenceCount = 0
    
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i]
      const duration = subtitle.endTime - subtitle.startTime
      
      // Duration statistics
      stats.totalDuration += duration
      stats.timingAnalysis.minDuration = Math.min(stats.timingAnalysis.minDuration, duration)
      stats.timingAnalysis.maxDuration = Math.max(stats.timingAnalysis.maxDuration, duration)
      
      // Text statistics
      if (subtitle.text) {
        stats.textStats.totalCharacters += subtitle.text.length
        const words = subtitle.text.split(/\s+/).filter(w => w.length > 0)
        stats.textStats.totalWords += words.length
      } else {
        stats.qualityMetrics.emptyTextCount++
      }
      
      // Translation statistics
      if (!subtitle.translation || subtitle.translation.trim() === '') {
        stats.qualityMetrics.untranslatedCount++
      }
      
      // Confidence statistics
      if (typeof subtitle.confidence === 'number') {
        totalConfidence += subtitle.confidence
        confidenceCount++
        
        if (subtitle.confidence > 0.8) {
          stats.qualityMetrics.highConfidenceCount++
        } else if (subtitle.confidence >= 0.5) {
          stats.qualityMetrics.mediumConfidenceCount++
        } else {
          stats.qualityMetrics.lowConfidenceCount++
        }
      }
      
      // Gap analysis
      if (i > 0) {
        const gap = subtitle.startTime - subtitles[i - 1].endTime
        if (gap > 0) {
          stats.timingAnalysis.gapCount++
          stats.timingAnalysis.totalGapDuration += gap
        } else if (gap < 0) {
          stats.timingAnalysis.overlapCount++
        }
      }
    }
    
    // Calculate averages
    stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0
    stats.timingAnalysis.averageDuration = stats.totalDuration / subtitles.length
    stats.textStats.averageWordsPerSubtitle = stats.textStats.totalWords / subtitles.length
    stats.contentCoverage = subtitles.length > 0 ? (subtitles.length - stats.qualityMetrics.emptyTextCount) / subtitles.length : 0
    
    if (stats.timingAnalysis.minDuration === Infinity) {
      stats.timingAnalysis.minDuration = 0
    }
    
    return stats
  }

  /**
   * Validate subtitle content
   */
  private async validateContent(content: SubtitleTempContent): Promise<{
    isValid: boolean
    warnings: SubtitleValidationWarning[]
    errors: SubtitleValidationError[]
  }> {
    const warnings: SubtitleValidationWarning[] = []
    const errors: SubtitleValidationError[] = []
    
    // Validate content structure
    if (!isSubtitleTempContent(content)) {
      errors.push({
        id: generateTempStorageId('error'),
        type: 'schema_violation',
        message: 'Invalid content structure',
        critical: true,
        recoverable: false
      })
    }
    
    // Validate subtitles
    for (let i = 0; i < content.subtitles.length; i++) {
      const subtitle = content.subtitles[i]
      
      // Timing validation
      if (subtitle.startTime >= subtitle.endTime) {
        errors.push({
          id: generateTempStorageId('error'),
          subtitleId: subtitle.id,
          type: 'invalid_timing',
          message: `Invalid timing: start=${subtitle.startTime}, end=${subtitle.endTime}`,
          critical: false,
          recoverable: true,
          context: { subtitleIndex: i }
        })
      }
      
      // Content validation
      if (!subtitle.text || subtitle.text.trim() === '') {
        warnings.push({
          id: generateTempStorageId('warning'),
          subtitleId: subtitle.id,
          type: 'missing_translation',
          message: 'Empty subtitle text',
          severity: 'medium',
          autoFixable: false,
          context: { subtitleIndex: i }
        })
      }
      
      // Confidence validation
      if (typeof subtitle.confidence === 'number' && subtitle.confidence < 0.5) {
        warnings.push({
          id: generateTempStorageId('warning'),
          subtitleId: subtitle.id,
          type: 'low_confidence',
          message: `Low confidence score: ${subtitle.confidence}`,
          severity: 'low',
          autoFixable: false,
          context: { subtitleIndex: i, confidence: subtitle.confidence }
        })
      }
    }
    
    return {
      isValid: errors.filter(e => e.critical).length === 0,
      warnings,
      errors
    }
  }

  /**
   * Execute individual operation
   */
  private async executeOperation<T = any>(request: SubtitleTempOperationRequest): Promise<SubtitleTempOperationResponse<T>> {
    switch (request.type) {
      case 'save':
        return this.saveSubtitleContent(
          request.workspaceId,
          request.sessionId || '',
          request.parameters?.subtitles || [],
          request.parameters?.storageType || 'modified',
          request.parameters?.options || {}
        ) as Promise<SubtitleTempOperationResponse<T>>
      
      case 'load':
        return this.loadSubtitleContent(
          request.parameters?.storageId || '',
          request.parameters?.options || {}
        ) as Promise<SubtitleTempOperationResponse<T>>
      
      case 'delete':
        return this.deleteSubtitleContent(
          request.parameters?.storageId || '',
          request.parameters?.options || {}
        ) as Promise<SubtitleTempOperationResponse<T>>
      
      default:
        return {
          operationId: request.operationId,
          success: false,
          error: this.createError('VALIDATION_FAILED', `Unsupported operation type: ${request.type}`, request.workspaceId, request.sessionId, request.operationId),
          metrics: { duration: 0 },
          timestamp: Date.now()
        }
    }
  }

  /**
   * Update latest flags for storage records
   */
  private async updateLatestFlags(
    workspaceId: string,
    sessionId: string,
    storageType: SubtitleTempMetadata['storageType'],
    newLatestId: string
  ): Promise<void> {
    const transaction = await workspaceDatabase['getTransaction']([
      workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage'
    ], 'readwrite')
    
    const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
    const workspaceIndex = storageStore.index('workspaceId')
    const cursor = workspaceIndex.openCursor(IDBKeyRange.only(workspaceId))
    
    await new Promise<void>((resolve, reject) => {
      cursor.onsuccess = (event) => {
        const result = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (result) {
          const record = result.value as SubtitleTempStorageRecord
          if (record.sessionId === sessionId && record.storageType === storageType) {
            if (record.id === newLatestId) {
              record.isLatest = true
            } else {
              record.isLatest = false
            }
            result.update(record)
          }
          result.continue()
        } else {
          resolve()
        }
      }
      cursor.onerror = () => reject(cursor.error)
    })
  }

  /**
   * Record performance metric
   */
  private recordPerformanceMetric(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, [])
    }
    
    const metrics = this.performanceMetrics.get(operation)!
    metrics.push(duration)
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift()
    }
  }

  /**
   * Simple compression simulation
   */
  private simpleCompress(input: string): string {
    // This is a placeholder - in production, use actual compression libraries
    return input // For now, no compression
  }

  /**
   * Simple decompression simulation
   */
  private simpleDecompress(input: string): string {
    // This is a placeholder - in production, use actual compression libraries
    return input // For now, no decompression
  }

  /**
   * Create error object
   */
  private createError(
    code: SubtitleTempError['code'],
    message: string,
    workspaceId?: string,
    sessionId?: string,
    storageId?: string,
    context?: any
  ): SubtitleTempError {
    return {
      code,
      message,
      workspaceId,
      sessionId,
      storageId,
      context,
      timestamp: Date.now(),
      severity: code === 'DATA_CORRUPTION' || code === 'STORAGE_UNAVAILABLE' ? 'critical' : 'medium',
      recoverySuggestions: this.getRecoverySuggestions(code)
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    operationId: string,
    error: any,
    duration: number
  ): SubtitleTempOperationResponse<any> {
    return {
      operationId,
      success: false,
      error: isSubtitleTempError(error) ? error : this.createError('VALIDATION_FAILED', `Operation failed: ${error}`),
      metrics: { duration },
      timestamp: Date.now()
    }
  }

  /**
   * Get recovery suggestions for error codes
   */
  private getRecoverySuggestions(code: SubtitleTempError['code']): string[] {
    switch (code) {
      case 'STORAGE_UNAVAILABLE':
        return ['Check IndexedDB support', 'Clear browser cache', 'Restart application']
      case 'DATA_CORRUPTION':
        return ['Restore from backup', 'Validate data integrity', 'Re-import original data']
      case 'VALIDATION_FAILED':
        return ['Check input parameters', 'Verify data format', 'Review validation rules']
      case 'QUOTA_EXCEEDED':
        return ['Clear old data', 'Increase storage quota', 'Enable compression']
      case 'SESSION_EXPIRED':
        return ['Create new session', 'Check session timeout settings']
      case 'HASH_MISMATCH':
        return ['Verify data integrity', 'Re-save content', 'Check for corruption']
      case 'SCHEMA_VIOLATION':
        return ['Update to latest version', 'Migrate data format', 'Reset configuration']
      case 'COMPRESSION_FAILED':
        return ['Disable compression', 'Reduce data size', 'Check compression settings']
      default:
        return ['Contact support', 'Check logs', 'Restart application']
    }
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): Record<string, { average: number; min: number; max: number; count: number }> {
    const result: Record<string, { average: number; min: number; max: number; count: number }> = {}
    
    for (const [operation, measurements] of this.performanceMetrics) {
      if (measurements.length > 0) {
        const average = measurements.reduce((a, b) => a + b, 0) / measurements.length
        const min = Math.min(...measurements)
        const max = Math.max(...measurements)
        
        result[operation] = { average, min, max, count: measurements.length }
      }
    }
    
    return result
  }

  /**
   * Get service configuration
   */
  public getConfiguration(): SubtitleTempStorageConfig {
    return { ...this.config }
  }

  /**
   * Update service configuration
   */
  public updateConfiguration(newConfig: Partial<SubtitleTempStorageConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Restart cleanup timer if cleanup settings changed
    if (newConfig.cleanup || newConfig.database) {
      this.startCleanupTimer()
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const subtitleTempStorageService = new SubtitleTempStorageService()

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { isSubtitleTempError, isSubtitleTempContent, isSubtitleTempSession } from '../types/subtitle-temp-storage'