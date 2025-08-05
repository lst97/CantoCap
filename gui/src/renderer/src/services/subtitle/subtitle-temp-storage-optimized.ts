/**
 * Optimized Subtitle Temporary Storage Service
 * 
 * High-performance version of the subtitle temp storage service with advanced optimizations:
 * - Connection pooling and batch operations
 * - Memory management and object pooling  
 * - Background processing with Web Workers
 * - Intelligent caching and compression
 * - Performance monitoring and adaptive behavior
 */

import type { SubtitleData } from '../../../../types'
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
  SubtitleTempStorageConfig
} from '../../types/subtitle-temp-storage'
import {
  SUBTITLE_TEMP_STORAGE_CONSTANTS,
  DEFAULT_SUBTITLE_TEMP_CONFIG,
  generateTempStorageId,
  calculateContentHash,
  estimateStorageSize,
  isSubtitleTempError,
  isSubtitleTempContent
} from '../../types/subtitle-temp-storage'
import {
  IndexedDBConnectionPool,
  BatchProcessor,
  BackgroundProcessor,
  CompressionManager,
  performanceManager,
  PERFORMANCE_CONFIG
} from './subtitle-temp-storage-performance'
import { workspaceDatabase } from '../workspace/workspace-database'

// ============================================================================
// OPTIMIZED CACHE LAYER
// ============================================================================

/**
 * High-performance LRU cache with TTL support
 */
class OptimizedCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; accessCount: number }>()
  private accessOrder: string[] = []
  private maxSize: number
  private ttl: number

  constructor(maxSize = 1000, ttl = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key)
      return undefined
    }

    // Update access order and count
    entry.accessCount++
    this.moveToFront(key)
    
    performanceManager.metricsCollector.recordMetric({
      operation: 'cache_hit',
      duration: 0,
      success: true,
      cacheHit: true
    })

    return entry.value
  }

  set(key: string, value: T): void {
    const existing = this.cache.get(key)
    if (existing) {
      existing.value = value
      existing.timestamp = Date.now()
      this.moveToFront(key)
      return
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    })
    this.accessOrder.unshift(key)

    // Evict if necessary
    if (this.cache.size > this.maxSize) {
      this.evictLRU()
    }

    performanceManager.metricsCollector.recordMetric({
      operation: 'cache_set',
      duration: 0,
      success: true,
      cacheHit: false
    })
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      const index = this.accessOrder.indexOf(key)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
      }
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder.length = 0
  }

  private moveToFront(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
      this.accessOrder.unshift(key)
    }
  }

  private evictLRU(): void {
    const lruKey = this.accessOrder.pop()
    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }

  getStats(): { size: number; hitRate: number; averageAccessCount: number } {
    const entries = Array.from(this.cache.values())
    const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0)
    
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hit/miss ratio
      averageAccessCount: entries.length > 0 ? totalAccess / entries.length : 0
    }
  }
}

// ============================================================================
// OPTIMIZED STORAGE SERVICE
// ============================================================================

export class OptimizedSubtitleTempStorageService {
  private config: SubtitleTempStorageConfig
  private connectionPool: IndexedDBConnectionPool
  private batchProcessor: BatchProcessor
  private backgroundProcessor: BackgroundProcessor | null = null
  private contentCache: OptimizedCache<SubtitleTempContent>
  private metadataCache: OptimizedCache<SubtitleTempMetadata>
  private sessionCache: OptimizedCache<SubtitleTempSession>
  
  // Performance tracking
  private operationQueue = new Map<string, SubtitleTempOperationRequest>()
  private activeOperations = new Set<string>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private performanceTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<SubtitleTempStorageConfig> = {}) {
    this.config = { ...DEFAULT_SUBTITLE_TEMP_CONFIG, ...config }
    
    // Initialize optimized components
    this.connectionPool = new IndexedDBConnectionPool(
      this.config.database.name,
      this.config.database.version,
      PERFORMANCE_CONFIG.CONNECTION_POOL_SIZE
    )
    
    this.batchProcessor = new BatchProcessor(this.connectionPool)
    
    // Initialize caches
    this.contentCache = new OptimizedCache<SubtitleTempContent>(500, 600000) // 10 minutes
    this.metadataCache = new OptimizedCache<SubtitleTempMetadata>(1000, 300000) // 5 minutes
    this.sessionCache = new OptimizedCache<SubtitleTempSession>(100, 1800000) // 30 minutes

    // Initialize background processor if workers are supported
    if (typeof Worker !== 'undefined') {
      try {
        this.backgroundProcessor = new BackgroundProcessor('/workers/subtitle-compression-worker.js')
      } catch (error) {
        console.warn('Background processing not available:', error)
      }
    }

    this.initializeService()
  }

  // ============================================================================
  // INITIALIZATION AND LIFECYCLE
  // ============================================================================

  private async initializeService(): Promise<void> {
    try {
      // Ensure database is ready
      await workspaceDatabase.healthCheck()
      
      // Start cleanup timer
      if (this.config.cleanup.enableAutomaticCleanup) {
        this.startCleanupTimer()
      }

      // Start performance monitoring
      this.startPerformanceMonitoring()
      
      console.log('OptimizedSubtitleTempStorageService initialized successfully')
    } catch (error) {
      console.error('Failed to initialize OptimizedSubtitleTempStorageService:', error)
      throw this.createError('STORAGE_UNAVAILABLE', 'Service initialization failed', undefined, undefined, undefined, error)
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.performOptimizedCleanup()
        this.optimizeCaches()
      } catch (error) {
        console.warn('Automatic cleanup failed:', error)
      }
    }, this.config.database.cleanupInterval)
  }

  private startPerformanceMonitoring(): void {
    this.performanceTimer = setInterval(() => {
      this.reportPerformanceMetrics()
    }, 30000) // Every 30 seconds
  }

  public async stopService(): Promise<void> {
    // Stop timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer)
      this.performanceTimer = null
    }

    // Wait for active operations
    const activeOps = Array.from(this.activeOperations)
    if (activeOps.length > 0) {
      console.log(`Waiting for ${activeOps.length} active operations to complete...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Cleanup resources
    this.connectionPool.closeAll()
    this.backgroundProcessor?.terminate()
    this.contentCache.clear()
    this.metadataCache.clear()
    this.sessionCache.clear()
    this.operationQueue.clear()
    this.activeOperations.clear()
    
    console.log('OptimizedSubtitleTempStorageService stopped')
  }

  // ============================================================================
  // OPTIMIZED CONTENT OPERATIONS
  // ============================================================================

  /**
   * High-performance subtitle content save with intelligent caching and compression
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
      priority?: 'low' | 'normal' | 'high' | 'critical'
    } = {}
  ): Promise<SubtitleTempOperationResponse<{ storageId: string }>> {
    const operationId = generateTempStorageId('save-op')
    const startTime = performance.now()
    
    try {
      this.activeOperations.add(operationId)
      
      // Input validation
      if (!workspaceId || !sessionId || !Array.isArray(subtitles)) {
        throw this.createError('VALIDATION_FAILED', 'Invalid input parameters', workspaceId, sessionId, operationId)
      }

      // Create content with object pooling
      const content = await this.createOptimizedSubtitleContent(workspaceId, sessionId, subtitles)
      
      // Check cache first
      const cacheKey = `${workspaceId}:${sessionId}:${storageType}`
      const cachedContent = this.contentCache.get(cacheKey)
      
      if (cachedContent && await calculateContentHash(cachedContent) === await calculateContentHash(content)) {
        // Content hasn't changed, return cached result
        return {
          operationId,
          success: true,
          data: { storageId: cachedContent.metadata.id },
          metrics: {
            duration: performance.now() - startTime,
            dataSize: estimateStorageSize(content)
          },
          timestamp: Date.now()
        }
      }

      // Validate content if requested
      if (options.validateBeforeSave || this.config.validation.validateOnSave) {
        const validation = await this.validateContentOptimized(content)
        if (!validation.isValid && validation.errors.some(e => e.critical)) {
          throw this.createError('VALIDATION_FAILED', 'Content validation failed', workspaceId, sessionId, operationId, validation.errors)
        }
      }

      // Create metadata
      const metadata = await this.createOptimizedSubtitleMetadata(workspaceId, sessionId, storageType, content, options.parentId)
      
      // Determine if compression should be used
      const dataSize = estimateStorageSize(content)
      const shouldCompress = (options.compressionEnabled ?? this.config.performance.enableCompression) && 
                           dataSize > this.config.performance.compressionThreshold

      // Create storage record with optimized compression
      const storageRecord = await this.createOptimizedStorageRecord(metadata, content, shouldCompress)

      // Use batch processor for high-priority operations
      if (options.priority === 'critical' || options.priority === 'high') {
        await this.saveToDatabaseDirect(storageRecord, metadata)
      } else {
        // Queue for batch processing
        await this.enqueueSaveOperation(storageRecord, metadata, options.priority || 'normal')
      }

      // Update caches
      this.contentCache.set(cacheKey, content)
      this.metadataCache.set(storageRecord.id, metadata)

      // Update latest flags
      if (storageType === 'modified' || storageType === 'auto_save') {
        await this.updateLatestFlagsOptimized(workspaceId, sessionId, storageType, storageRecord.id)
      }

      // Record performance metrics
      performanceManager.metricsCollector.recordMetric({
        operation: 'save_content',
        duration: performance.now() - startTime,
        success: true,
        dataSize
      })

      return {
        operationId,
        success: true,
        data: { storageId: storageRecord.id },
        metrics: {
          duration: performance.now() - startTime,
          dataSize: storageRecord.dataSize
        },
        timestamp: Date.now()
      }
      
    } catch (error) {
      performanceManager.metricsCollector.recordMetric({
        operation: 'save_content',
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      
      return this.createErrorResponse(operationId, error, performance.now() - startTime)
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Optimized content loading with multi-level caching
   */
  async loadSubtitleContent(
    storageId: string,
    options: {
      validateOnLoad?: boolean
      includeMetadata?: boolean
      priority?: 'low' | 'normal' | 'high'
    } = {}
  ): Promise<SubtitleTempOperationResponse<SubtitleTempContent>> {
    const operationId = generateTempStorageId('load-op')
    const startTime = performance.now()
    
    try {
      this.activeOperations.add(operationId)
      
      // Check cache first
      const cachedContent = this.contentCache.get(storageId)
      if (cachedContent) {
        performanceManager.metricsCollector.recordMetric({
          operation: 'load_content',
          duration: performance.now() - startTime,
          success: true,
          cacheHit: true,
          dataSize: estimateStorageSize(cachedContent)
        })

        return {
          operationId,
          success: true,
          data: cachedContent,
          metrics: {
            duration: performance.now() - startTime,
            dataSize: estimateStorageSize(cachedContent)
          },
          timestamp: Date.now()
        }
      }

      // Load from database
      const db = await this.connectionPool.getConnection()
      
      try {
        const transaction = db.transaction([
          workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage'
        ])
        
        const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
        const storageRecord = await this.promisifyRequest<SubtitleTempStorageRecord>(storageStore.get(storageId))
        
        if (!storageRecord) {
          throw this.createError('VALIDATION_FAILED', `Storage record not found: ${storageId}`)
        }

        // Deserialize content with optimized decompression
        const content = await this.deserializeContentOptimized(storageRecord)
        
        // Validate content if requested
        if (options.validateOnLoad || this.config.validation.validateOnLoad) {
          const validation = await this.validateContentOptimized(content)
          if (!validation.isValid) {
            console.warn(`Content validation warnings for ${storageId}:`, validation.warnings)
            if (validation.errors.some(e => e.critical)) {
              throw this.createError('DATA_CORRUPTION', 'Critical content validation errors', content.metadata.workspaceId, content.metadata.sessionId, operationId, validation.errors)
            }
          }
        }

        // Cache the loaded content
        this.contentCache.set(storageId, content)

        performanceManager.metricsCollector.recordMetric({
          operation: 'load_content',
          duration: performance.now() - startTime,
          success: true,
          cacheHit: false,
          dataSize: storageRecord.dataSize
        })

        return {
          operationId,
          success: true,
          data: content,
          metrics: {
            duration: performance.now() - startTime,
            dataSize: storageRecord.dataSize
          },
          timestamp: Date.now()
        }

      } finally {
        this.connectionPool.releaseConnection(db)
      }
      
    } catch (error) {
      performanceManager.metricsCollector.recordMetric({
        operation: 'load_content',
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      
      return this.createErrorResponse(operationId, error, performance.now() - startTime)
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Optimized batch operations with intelligent queuing
   */
  async executeBatchOperationOptimized<T = any>(
    batchOperation: SubtitleTempBatchOperation<T>
  ): Promise<SubtitleTempBatchResponse<T>> {
    const startTime = performance.now()
    
    try {
      const result = await this.batchProcessor.enqueueBatch(batchOperation)
      
      performanceManager.metricsCollector.recordMetric({
        operation: 'batch_operation',
        duration: performance.now() - startTime,
        success: result.success,
        dataSize: result.batchMetrics.dataProcessed
      })

      return result
    } catch (error) {
      performanceManager.metricsCollector.recordMetric({
        operation: 'batch_operation',
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      
      throw error
    }
  }

  // ============================================================================
  // PRIVATE OPTIMIZED HELPER METHODS
  // ============================================================================

  private async createOptimizedSubtitleContent(
    workspaceId: string,
    sessionId: string,
    subtitles: SubtitleData[]
  ): Promise<SubtitleTempContent> {
    // Use object pool for better memory management
    const content = performanceManager.contentPool.acquire()
    
    content.metadata = {
      id: generateTempStorageId('content'),
      workspaceId,
      sessionId,
      version: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_VERSION,
      schemaVersion: SUBTITLE_TEMP_STORAGE_CONSTANTS.CURRENT_SCHEMA_VERSION
    }
    
    content.subtitles = subtitles
    content.statistics = this.calculateStatisticsOptimized(subtitles)
    content.editingContext = {
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
    }
    content.changeTracking = {
      changeCount: 0,
      lastUserAction: Date.now(),
      modifiedIds: new Set(),
      changeSeverity: 'minor'
    }
    content.validation = {
      isValid: true,
      lastValidated: Date.now(),
      warnings: [],
      errors: [],
      integrityScore: 1.0
    }

    return content
  }

  private async createOptimizedSubtitleMetadata(
    workspaceId: string,
    sessionId: string,
    storageType: SubtitleTempMetadata['storageType'],
    content: SubtitleTempContent,
    parentId?: string
  ): Promise<SubtitleTempMetadata> {
    const contentHash = await calculateContentHash(content)
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
      metadataHash: await calculateContentHash({ workspaceId, sessionId, storageType, contentHash }),
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

  private async createOptimizedStorageRecord(
    metadata: SubtitleTempMetadata,
    content: SubtitleTempContent,
    shouldCompress: boolean
  ): Promise<SubtitleTempStorageRecord> {
    // Use object pool for better memory management
    const record = performanceManager.recordPool.acquire()
    
    let contentData = JSON.stringify(content)
    let metadataData = JSON.stringify(metadata)
    let isCompressed = false
    let compressionInfo: SubtitleTempMetadata['compression']

    // Apply compression if requested
    if (shouldCompress) {
      try {
        const compressed = await CompressionManager.compress(contentData)
        
        if (compressed.ratio < 0.8) { // Only use if compression saves at least 20%
          contentData = new TextDecoder().decode(compressed.compressed)
          isCompressed = true
          compressionInfo = {
            algorithm: 'gzip',
            originalSize: compressed.originalSize,
            compressedSize: compressed.compressedSize,
            compressionRatio: compressed.ratio
          }
        }
      } catch (error) {
        console.warn('Compression failed, using uncompressed data:', error)
      }
    }

    // Populate record
    Object.assign(record, {
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
    })

    // Update metadata with compression info
    if (compressionInfo) {
      metadata.compression = compressionInfo
    }

    return record as SubtitleTempStorageRecord
  }

  private async deserializeContentOptimized(record: SubtitleTempStorageRecord): Promise<SubtitleTempContent> {
    let contentData = record.contentData
    
    // Decompress if needed
    if (record.isCompressed) {
      try {
        const decompressed = await CompressionManager.decompress(
          new TextEncoder().encode(contentData).buffer,
          record.dataSize
        )
        contentData = decompressed
      } catch (error) {
        console.warn('Decompression failed:', error)
        // Continue with compressed data as fallback
      }
    }
    
    const content = JSON.parse(contentData) as SubtitleTempContent
    
    // Verify content hash
    const actualHash = await calculateContentHash(content)
    if (actualHash !== record.contentHash) {
      throw this.createError('DATA_CORRUPTION', `Content hash mismatch for ${record.id}`, record.workspaceId, record.sessionId, record.id)
    }
    
    return content
  }

  private calculateStatisticsOptimized(subtitles: SubtitleData[]): any {
    // Use more efficient calculation methods
    if (subtitles.length === 0) {
      return {
        totalCount: 0,
        modifiedCount: 0,
        totalDuration: 0,
        contentCoverage: 0,
        averageConfidence: 0
      }
    }

    // Batch calculations for better performance
    let totalDuration = 0
    let totalConfidence = 0
    let confidenceCount = 0
    let modifiedCount = 0

    for (const subtitle of subtitles) {
      totalDuration += subtitle.endTime - subtitle.startTime
      
      if (typeof subtitle.confidence === 'number') {
        totalConfidence += subtitle.confidence
        confidenceCount++
      }
      
      // Check if modified (simplified check)
      if (subtitle.translation !== subtitle.text) {
        modifiedCount++
      }
    }

    return {
      totalCount: subtitles.length,
      modifiedCount,
      totalDuration,
      contentCoverage: subtitles.length > 0 ? (subtitles.length - modifiedCount) / subtitles.length : 0,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0
    }
  }

  private async validateContentOptimized(content: SubtitleTempContent): Promise<{
    isValid: boolean
    warnings: any[]
    errors: any[]
  }> {
    // Simplified validation for better performance
    const warnings: any[] = []
    const errors: any[] = []
    
    // Basic structure validation
    if (!isSubtitleTempContent(content)) {
      errors.push({
        id: generateTempStorageId('error'),
        type: 'schema_violation',
        message: 'Invalid content structure',
        critical: true,
        recoverable: false
      })
    }

    // Fast validation of critical issues only
    for (let i = 0; i < content.subtitles.length; i++) {
      const subtitle = content.subtitles[i]
      
      // Only check critical timing issues
      if (subtitle.startTime >= subtitle.endTime) {
        errors.push({
          id: generateTempStorageId('error'),
          subtitleId: subtitle.id,
          type: 'invalid_timing',
          message: `Invalid timing at index ${i}`,
          critical: true,
          recoverable: true,
          context: { subtitleIndex: i }
        })
      }
    }

    return {
      isValid: errors.filter(e => e.critical).length === 0,
      warnings,
      errors
    }
  }

  private async saveToDatabaseDirect(record: SubtitleTempStorageRecord, metadata: SubtitleTempMetadata): Promise<void> {
    const db = await this.connectionPool.getConnection()
    
    try {
      const transaction = db.transaction([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage',
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata'
      ], 'readwrite')
      
      const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
      const metadataStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_METADATA || 'subtitle_temp_metadata')
      
      await Promise.all([
        this.promisifyRequest(storageStore.put(record)),
        this.promisifyRequest(metadataStore.put(metadata))
      ])
    } finally {
      this.connectionPool.releaseConnection(db)
    }
  }

  private async enqueueSaveOperation(
    record: SubtitleTempStorageRecord,
    metadata: SubtitleTempMetadata,
    priority: 'low' | 'normal' | 'high'
  ): Promise<void> {
    // For now, just save directly
    // In a full implementation, this would queue the operation
    await this.saveToDatabaseDirect(record, metadata)
  }

  private async updateLatestFlagsOptimized(
    workspaceId: string,
    sessionId: string,
    storageType: SubtitleTempMetadata['storageType'],
    newLatestId: string
  ): Promise<void> {
    // Use batch operation for better performance
    const db = await this.connectionPool.getConnection()
    
    try {
      const transaction = db.transaction([
        workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage'
      ], 'readwrite')
      
      const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
      const workspaceIndex = storageStore.index('workspaceId')
      
      // Use more efficient cursor operation
      const request = workspaceIndex.openCursor(IDBKeyRange.only(workspaceId))
      const updates: IDBRequest[] = []
      
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            const record = cursor.value as SubtitleTempStorageRecord
            if (record.sessionId === sessionId && record.storageType === storageType) {
              record.isLatest = record.id === newLatestId
              updates.push(cursor.update(record))
            }
            cursor.continue()
          } else {
            // Wait for all updates to complete
            Promise.all(updates.map(req => this.promisifyRequest(req)))
              .then(() => resolve())
              .catch(reject)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } finally {
      this.connectionPool.releaseConnection(db)
    }
  }

  private async performOptimizedCleanup(): Promise<SubtitleTempCleanupResult> {
    const cleanupId = generateTempStorageId('cleanup')
    const startTime = performance.now()
    let recordsProcessed = 0
    let recordsDeleted = 0
    let spaceReclaimed = 0

    try {
      const cutoffTime = Date.now() - (this.config.cleanup.maxRetentionDays * 24 * 60 * 60 * 1000)
      
      const db = await this.connectionPool.getConnection()
      
      try {
        // Use batch deletion for better performance
        const transaction = db.transaction([
          workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage'
        ], 'readwrite')
        
        const storageStore = transaction.objectStore(workspaceDatabase['STORES']?.SUBTITLE_TEMP_STORAGE || 'subtitle_temp_storage')
        const dateIndex = storageStore.index('createdAt')
        
        // Delete old records in batches
        const deleteRequests: IDBRequest[] = []
        const cursor = dateIndex.openCursor(IDBKeyRange.upperBound(cutoffTime))
        
        await new Promise<void>((resolve, reject) => {
          cursor.onsuccess = (event) => {
            const result = (event.target as IDBRequest<IDBCursorWithValue | null>).result
            if (result) {
              const record = result.value as SubtitleTempStorageRecord
              recordsProcessed++
              
              // Skip latest records
              if (!record.isLatest) {
                deleteRequests.push(result.delete())
                recordsDeleted++
                spaceReclaimed += record.dataSize
                
                // Process in batches to avoid blocking
                if (deleteRequests.length >= PERFORMANCE_CONFIG.BATCH_SIZE) {
                  Promise.all(deleteRequests.map(req => this.promisifyRequest(req)))
                    .then(() => {
                      deleteRequests.length = 0
                      result.continue()
                    })
                    .catch(reject)
                  return
                }
              }
              
              result.continue()
            } else {
              // Process remaining deletes
              if (deleteRequests.length > 0) {
                Promise.all(deleteRequests.map(req => this.promisifyRequest(req)))
                  .then(() => resolve())
                  .catch(reject)
              } else {
                resolve()
              }
            }
          }
          cursor.onerror = () => reject(cursor.error)
        })
      } finally {
        this.connectionPool.releaseConnection(db)
      }

      return {
        cleanupId,
        recordsProcessed,
        recordsDeleted,
        spaceReclaimed,
        duration: performance.now() - startTime,
        timestamp: Date.now(),
        errors: []
      }
    } catch (error) {
      return {
        cleanupId,
        recordsProcessed,
        recordsDeleted,
        spaceReclaimed,
        duration: performance.now() - startTime,
        timestamp: Date.now(),
        errors: [this.createError('VALIDATION_FAILED', `Cleanup error: ${error}`, undefined, undefined, cleanupId)]
      }
    }
  }

  private optimizeCaches(): void {
    // Clear expired entries and optimize cache performance
    const caches = [this.contentCache, this.metadataCache, this.sessionCache]
    
    caches.forEach(cache => {
      // Force a get operation to trigger TTL cleanup
      cache.get('__cleanup_trigger__')
    })
  }

  private reportPerformanceMetrics(): void {
    const metrics = performanceManager.metricsCollector.getAveragePerformance(undefined, 300000) // Last 5 minutes
    const memoryUsage = performanceManager.memoryManager.getMemoryUsage()
    
    console.log('Performance Report:', {
      averageLatency: metrics.averageDuration,
      successRate: metrics.successRate,
      throughput: metrics.throughput,
      errorRate: metrics.errorRate,
      memoryUsage: memoryUsage ? `${(memoryUsage.ratio * 100).toFixed(1)}%` : 'N/A',
      cacheStats: {
        content: this.contentCache.getStats(),
        metadata: this.metadataCache.getStats(),
        session: this.sessionCache.getStats()
      },
      activeOperations: this.activeOperations.size
    })
  }

  private promisifyRequest<T = any>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

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
      severity: code === 'DATA_CORRUPTION' || code === 'STORAGE_UNAVAILABLE' ? 'critical' : 'medium'
    }
  }

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

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  public getPerformanceMetrics(): {
    operationMetrics: ReturnType<typeof performanceManager.metricsCollector.getAveragePerformance>
    memoryUsage: ReturnType<typeof performanceManager.memoryManager.getMemoryUsage>
    cacheStats: {
      content: ReturnType<typeof this.contentCache.getStats>
      metadata: ReturnType<typeof this.metadataCache.getStats>
      session: ReturnType<typeof this.sessionCache.getStats>
    }
    systemStats: {
      activeOperations: number
      queueSize: number
      connectionPoolSize: number
    }
  } {
    return {
      operationMetrics: performanceManager.metricsCollector.getAveragePerformance(),
      memoryUsage: performanceManager.memoryManager.getMemoryUsage(),
      cacheStats: {
        content: this.contentCache.getStats(),
        metadata: this.metadataCache.getStats(),
        session: this.sessionCache.getStats()
      },
      systemStats: {
        activeOperations: this.activeOperations.size,
        queueSize: this.operationQueue.size,
        connectionPoolSize: PERFORMANCE_CONFIG.CONNECTION_POOL_SIZE
      }
    }
  }

  public getConfiguration(): SubtitleTempStorageConfig {
    return { ...this.config }
  }

  public updateConfiguration(newConfig: Partial<SubtitleTempStorageConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Restart cleanup timer if settings changed
    if (newConfig.cleanup || newConfig.database) {
      this.startCleanupTimer()
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const optimizedSubtitleTempStorageService = new OptimizedSubtitleTempStorageService()

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { CompressionManager, performanceManager } from './subtitle-temp-storage-performance'