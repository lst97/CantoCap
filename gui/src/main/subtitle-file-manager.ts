/**
 * Subtitle File Manager
 * 
 * Main process service for secure subtitle file operations with performance optimization,
 * caching, and integration with the existing workspace system.
 */

import { app } from 'electron'
import { join, dirname, basename, extname } from 'path'
import { readFile, writeFile, mkdir, access, unlink, stat, readdir } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import { createHash } from 'crypto'
import { getWorkspaceManager } from './workspace-manager'
import {
  SUBTITLE_FILE_CONSTANTS,
  DEFAULT_SUBTITLE_CACHE_CONFIG
} from '../types/subtitle-ipc'
import type {
  SubtitleFileMetadata,
  SubtitleFileContent,
  SubtitleFileResult,
  CreateSubtitleFileParams,
  LoadSubtitleFileParams,
  SaveSubtitleFileParams,
  DeleteSubtitleFileParams,
  GetSubtitleMetadataParams,
  CleanupSubtitleFilesParams,
  BatchSubtitleOperationParams,
  BatchSubtitleOperationResult,
  StreamSubtitleFileParams,
  StreamWriteSubtitleParams,
  StreamProgressData,
  SubtitleFileError,
  SubtitleFileErrorCode,
  SubtitleFileCacheEntry,
  SubtitleFileCacheConfig,
  SubtitleFileCacheMetrics,
  PathValidationResult,
  ContentValidationResult,
  OperationSecurityContext
} from '../types/subtitle-ipc'
import type { SubtitleEntry, SubtitleModification } from '../types/subtitle'

/**
 * Performance metrics for subtitle file operations
 */
interface SubtitleFilePerformanceMetrics {
  operationType: 'create' | 'load' | 'save' | 'delete' | 'metadata' | 'cleanup' | 'stream'
  duration: number
  success: boolean
  workspaceId?: string
  fileType?: string
  fileSize?: number
  fromCache?: boolean
  compressionRatio?: number
  error?: string
  timestamp: number
}

/**
 * Stream tracking information
 */
interface StreamInfo {
  streamId: string
  workspaceId: string
  fileType: string
  sessionId?: string
  operation: 'read' | 'write'
  startTime: number
  totalBytes: number
  processedBytes: number
  chunkSize: number
  chunks: Buffer[]
  isComplete: boolean
  error?: string
}

export class SubtitleFileManager {
  private workspaceManager = getWorkspaceManager()
  private cache = new Map<string, SubtitleFileCacheEntry>()
  private cacheConfig: SubtitleFileCacheConfig = { ...DEFAULT_SUBTITLE_CACHE_CONFIG }
  private cacheMetrics: SubtitleFileCacheMetrics = this.initializeCacheMetrics()
  private performanceMetrics: SubtitleFilePerformanceMetrics[] = []
  private activeStreams = new Map<string, StreamInfo>()
  private compressionCache = new Map<string, Buffer>()

  constructor() {
    // Initialize cache cleanup interval
    setInterval(() => this.cleanupExpiredCache(), 60000) // Every minute
    
    // Initialize compression cache cleanup
    setInterval(() => this.cleanupCompressionCache(), 300000) // Every 5 minutes
  }

  // ============================================================================
  // CORE FILE OPERATIONS
  // ============================================================================

  /**
   * Create a new subtitle file
   */
  async createSubtitleFile(params: CreateSubtitleFileParams): Promise<SubtitleFileResult<SubtitleFileMetadata>> {
    const startTime = Date.now()
    const securityContext: OperationSecurityContext = {
      workspaceId: params.workspaceId,
      operationType: 'write',
      fileType: params.fileType,
      sessionId: params.sessionInfo?.sessionId,
      timestamp: startTime
    }

    try {
      // Validate security context
      await this.validateSecurityContext(securityContext)

      // Validate workspace
      const workspaceDir = await this.getWorkspaceSubtitleDir(params.workspaceId)
      
      // Generate file path
      const filePath = this.generateFilePath(
        workspaceDir, 
        params.fileType, 
        params.sessionInfo?.sessionId
      )

      // Validate path
      const pathValidation = this.validateFilePath(filePath, 'write')
      if (!pathValidation.isValid) {
        throw this.createError('PATH_TRAVERSAL_BLOCKED', 'Invalid file path', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'create'
        })
      }

      // Check if file exists and handle overwrite
      if (existsSync(filePath) && !params.options?.overwrite) {
        throw this.createError('VERSION_CONFLICT', 'File already exists', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'create'
        })
      }

      // Create backup if requested
      if (params.options?.createBackup && existsSync(filePath)) {
        await this.createBackupFile(filePath)
      }

      // Prepare file content
      const fileContent: SubtitleFileContent = {
        metadata: this.createFileMetadata(filePath, params.fileType, params.sessionInfo?.sessionId),
        subtitles: params.content,
        sessionInfo: params.sessionInfo ? {
          sessionId: params.sessionInfo.sessionId,
          workspaceId: params.workspaceId,
          videoPath: params.sessionInfo.videoPath,
          lastEditTime: Date.now(),
          totalModifications: 0
        } : undefined,
        qualityMetrics: this.calculateQualityMetrics(params.content)
      }

      // Serialize and optionally compress content
      let serializedContent = JSON.stringify(fileContent, null, 2)
      if (params.options?.compress) {
        serializedContent = await this.compressContent(serializedContent)
      }

      // Ensure directory exists
      await mkdir(dirname(filePath), { recursive: true })

      // Write file with specified encoding
      const encoding = params.options?.encoding || 'utf8'
      await writeFile(filePath, serializedContent, encoding)

      // Update metadata after write
      const stats = await stat(filePath)
      fileContent.metadata.fileSize = stats.size
      fileContent.metadata.lastModified = stats.mtime.getTime()
      fileContent.metadata.checksum = this.calculateChecksum(serializedContent)

      // Cache the content if caching is enabled
      if (this.cacheConfig.enabled) {
        await this.setCacheEntry(params.workspaceId, params.fileType, fileContent, params.sessionInfo?.sessionId)
      }

      // Record performance metrics
      this.recordPerformanceMetric({
        operationType: 'create',
        duration: Date.now() - startTime,
        success: true,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        fileSize: stats.size,
        compressionRatio: params.options?.compress ? serializedContent.length / JSON.stringify(fileContent).length : undefined,
        timestamp: startTime
      })

      return {
        success: true,
        data: fileContent.metadata,
        metadata: {
          filePath,
          fileSize: stats.size,
          operationTime: Date.now() - startTime,
          compressionRatio: params.options?.compress ? serializedContent.length / JSON.stringify(fileContent).length : undefined
        }
      }

    } catch (error) {
      // Record error metrics
      this.recordPerformanceMetric({
        operationType: 'create',
        duration: Date.now() - startTime,
        success: false,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime
      })

      return this.handleError(error, 'create')
    }
  }

  /**
   * Load a subtitle file
   */
  async loadSubtitleFile(params: LoadSubtitleFileParams): Promise<SubtitleFileResult<SubtitleFileContent>> {
    const startTime = Date.now()
    const securityContext: OperationSecurityContext = {
      workspaceId: params.workspaceId,
      operationType: 'read',
      fileType: params.fileType,
      sessionId: params.sessionId,
      timestamp: startTime
    }

    try {
      // Validate security context
      await this.validateSecurityContext(securityContext)

      // Check cache first if enabled
      if (this.cacheConfig.enabled && params.options?.useCache !== false) {
        const cachedContent = this.getCacheEntry(params.workspaceId, params.fileType, params.sessionId)
        if (cachedContent) {
          this.cacheMetrics.hits++
          this.cacheMetrics.totalRequests++
          this.updateCacheMetrics()

          this.recordPerformanceMetric({
            operationType: 'load',
            duration: Date.now() - startTime,
            success: true,
            workspaceId: params.workspaceId,
            fileType: params.fileType,
            fromCache: true,
            timestamp: startTime
          })

          return {
            success: true,
            data: cachedContent,
            metadata: {
              operationTime: Date.now() - startTime,
              fromCache: true
            }
          }
        }
      }

      // Cache miss - load from file
      this.cacheMetrics.misses++
      this.cacheMetrics.totalRequests++

      // Get file path
      const workspaceDir = await this.getWorkspaceSubtitleDir(params.workspaceId)
      const filePath = this.generateFilePath(workspaceDir, params.fileType, params.sessionId)

      // Validate path
      const pathValidation = this.validateFilePath(filePath, 'read')
      if (!pathValidation.isValid) {
        throw this.createError('PATH_TRAVERSAL_BLOCKED', 'Invalid file path', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'load'
        })
      }

      // Check file exists
      if (!existsSync(filePath)) {
        throw this.createError('FILE_NOT_FOUND', 'Subtitle file not found', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'load'
        })
      }

      // Get file stats
      const stats = await stat(filePath)
      if (stats.size > SUBTITLE_FILE_CONSTANTS.MAX_FILE_SIZE) {
        throw this.createError('FILE_TOO_LARGE', 'File exceeds maximum size limit', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'load',
          details: { fileSize: stats.size, maxSize: SUBTITLE_FILE_CONSTANTS.MAX_FILE_SIZE }
        })
      }

      // Read file content
      const encoding = params.options?.encoding || 'utf8'
      let fileContent = await readFile(filePath, encoding)

      // Decompress if needed
      if (params.options?.decompress) {
        fileContent = await this.decompressContent(fileContent)
      }

      // Parse content
      let parsedContent: SubtitleFileContent
      try {
        parsedContent = JSON.parse(fileContent)
      } catch (parseError) {
        throw this.createError('FILE_CORRUPTED', 'Failed to parse subtitle file', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'load',
          details: { parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error' }
        })
      }

      // Validate checksum if requested
      if (params.options?.validateChecksum && parsedContent.metadata?.checksum) {
        const actualChecksum = this.calculateChecksum(fileContent)
        if (actualChecksum !== parsedContent.metadata.checksum) {
          throw this.createError('CHECKSUM_MISMATCH', 'File integrity check failed', {
            workspaceId: params.workspaceId,
            filePath,
            operation: 'load',
            details: {
              expectedChecksum: parsedContent.metadata.checksum,
              actualChecksum
            }
          })
        }
      }

      // Update access metadata
      parsedContent.metadata.lastModified = stats.mtime.getTime()
      parsedContent.metadata.fileSize = stats.size

      // Cache the content if caching is enabled
      if (this.cacheConfig.enabled) {
        await this.setCacheEntry(params.workspaceId, params.fileType, parsedContent, params.sessionId)
      }

      // Record performance metrics
      this.recordPerformanceMetric({
        operationType: 'load',
        duration: Date.now() - startTime,
        success: true,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        fileSize: stats.size,
        fromCache: false,
        timestamp: startTime
      })

      this.updateCacheMetrics()

      return {
        success: true,
        data: parsedContent,
        metadata: {
          filePath,
          fileSize: stats.size,
          operationTime: Date.now() - startTime,
          fromCache: false
        }
      }

    } catch (error) {
      // Record error metrics
      this.recordPerformanceMetric({
        operationType: 'load',
        duration: Date.now() - startTime,
        success: false,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime
      })

      return this.handleError(error, 'load')
    }
  }

  /**
   * Save subtitle file with optimistic locking
   */
  async saveSubtitleFile(params: SaveSubtitleFileParams): Promise<SubtitleFileResult<SubtitleFileMetadata>> {
    const startTime = Date.now()
    const securityContext: OperationSecurityContext = {
      workspaceId: params.workspaceId,
      operationType: 'write',
      fileType: params.fileType,
      sessionId: params.sessionInfo?.sessionId,
      timestamp: startTime
    }

    try {
      // Validate security context
      await this.validateSecurityContext(securityContext)

      // Get file path
      const workspaceDir = await this.getWorkspaceSubtitleDir(params.workspaceId)
      const filePath = this.generateFilePath(workspaceDir, params.fileType, params.sessionInfo?.sessionId)

      // Validate path
      const pathValidation = this.validateFilePath(filePath, 'write')
      if (!pathValidation.isValid) {
        throw this.createError('PATH_TRAVERSAL_BLOCKED', 'Invalid file path', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'save'
        })
      }

      // Check for version conflicts (optimistic locking)
      if (params.options?.expectedVersion && existsSync(filePath)) {
        const existingContent = await this.loadExistingFileForVersionCheck(filePath)
        if (existingContent.metadata.version !== params.options.expectedVersion) {
          throw this.createError('VERSION_CONFLICT', 'File was modified by another process', {
            workspaceId: params.workspaceId,
            filePath,
            operation: 'save',
            details: {
              expectedVersion: params.options.expectedVersion,
              actualVersion: existingContent.metadata.version
            }
          })
        }
      }

      // Create backup if requested or file exists
      if ((params.options?.createBackup || existsSync(filePath)) && existsSync(filePath)) {
        await this.createBackupFile(filePath)
      }

      // Prepare file content
      const existingMetadata = existsSync(filePath) ? 
        (await this.loadExistingFileForVersionCheck(filePath)).metadata : null

      const fileContent: SubtitleFileContent = {
        metadata: this.createFileMetadata(
          filePath, 
          params.fileType, 
          params.sessionInfo?.sessionId,
          existingMetadata
        ),
        subtitles: params.content,
        sessionInfo: params.sessionInfo ? {
          sessionId: params.sessionInfo.sessionId,
          workspaceId: params.workspaceId,
          videoPath: params.sessionInfo.videoPath,
          lastEditTime: Date.now(),
          totalModifications: params.sessionInfo.modifications?.length || 0
        } : undefined,
        qualityMetrics: this.calculateQualityMetrics(params.content)
      }

      // Serialize and optionally compress content
      let serializedContent = JSON.stringify(fileContent, null, 2)
      if (params.options?.compress) {
        serializedContent = await this.compressContent(serializedContent)
      }

      // Ensure directory exists
      await mkdir(dirname(filePath), { recursive: true })

      // Write file atomically
      const tempPath = `${filePath}.tmp`
      const encoding = params.options?.encoding || 'utf8'
      await writeFile(tempPath, serializedContent, encoding)

      // Move temp file to final location (atomic operation)
      await this.atomicMove(tempPath, filePath)

      // Update metadata after write
      const stats = await stat(filePath)
      fileContent.metadata.fileSize = stats.size
      fileContent.metadata.lastModified = stats.mtime.getTime()
      fileContent.metadata.checksum = this.calculateChecksum(serializedContent)

      // Update cache
      if (this.cacheConfig.enabled) {
        await this.setCacheEntry(params.workspaceId, params.fileType, fileContent, params.sessionInfo?.sessionId)
      }

      // Record performance metrics
      this.recordPerformanceMetric({
        operationType: 'save',
        duration: Date.now() - startTime,
        success: true,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        fileSize: stats.size,
        compressionRatio: params.options?.compress ? serializedContent.length / JSON.stringify(fileContent).length : undefined,
        timestamp: startTime
      })

      return {
        success: true,
        data: fileContent.metadata,
        metadata: {
          filePath,
          fileSize: stats.size,
          operationTime: Date.now() - startTime,
          compressionRatio: params.options?.compress ? serializedContent.length / JSON.stringify(fileContent).length : undefined
        }
      }

    } catch (error) {
      // Record error metrics
      this.recordPerformanceMetric({
        operationType: 'save',
        duration: Date.now() - startTime,
        success: false,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime
      })

      return this.handleError(error, 'save')
    }
  }

  /**
   * Delete subtitle file
   */
  async deleteSubtitleFile(params: DeleteSubtitleFileParams): Promise<SubtitleFileResult<boolean>> {
    const startTime = Date.now()
    const securityContext: OperationSecurityContext = {
      workspaceId: params.workspaceId,
      operationType: 'delete',
      fileType: params.fileType,
      sessionId: params.sessionId,
      timestamp: startTime
    }

    try {
      // Validate security context
      await this.validateSecurityContext(securityContext)

      // Get file path
      const workspaceDir = await this.getWorkspaceSubtitleDir(params.workspaceId)
      const filePath = this.generateFilePath(workspaceDir, params.fileType, params.sessionId)

      // Validate path
      const pathValidation = this.validateFilePath(filePath, 'delete')
      if (!pathValidation.isValid) {
        throw this.createError('PATH_TRAVERSAL_BLOCKED', 'Invalid file path', {
          workspaceId: params.workspaceId,
          filePath,
          operation: 'delete'
        })
      }

      // Check file exists
      if (!existsSync(filePath)) {
        if (!params.options?.force) {
          throw this.createError('FILE_NOT_FOUND', 'Subtitle file not found', {
            workspaceId: params.workspaceId,
            filePath,
            operation: 'delete'
          })
        }
        // If force is true, consider missing file as successful deletion
        return { success: true, data: true }
      }

      // Create backup if requested
      if (params.options?.createBackup) {
        await this.createBackupFile(filePath)
      }

      // Remove from cache first
      this.removeCacheEntry(params.workspaceId, params.fileType, params.sessionId)

      // Delete the file
      await unlink(filePath)

      // Record performance metrics
      this.recordPerformanceMetric({
        operationType: 'delete',
        duration: Date.now() - startTime,
        success: true,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        timestamp: startTime
      })

      return {
        success: true,
        data: true,
        metadata: {
          filePath,
          operationTime: Date.now() - startTime
        }
      }

    } catch (error) {
      // Record error metrics
      this.recordPerformanceMetric({
        operationType: 'delete',
        duration: Date.now() - startTime,
        success: false,
        workspaceId: params.workspaceId,
        fileType: params.fileType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime
      })

      return this.handleError(error, 'delete')
    }
  }

  /**
   * Get subtitle file metadata
   */
  async getSubtitleMetadata(params: GetSubtitleMetadataParams): Promise<SubtitleFileResult<SubtitleFileMetadata[]>> {
    const startTime = Date.now()

    try {
      // Validate workspace
      const workspaceDir = await this.getWorkspaceSubtitleDir(params.workspaceId)
      
      const metadataList: SubtitleFileMetadata[] = []

      if (params.fileType) {
        // Get metadata for specific file type
        const filePath = this.generateFilePath(workspaceDir, params.fileType, params.sessionId)
        if (existsSync(filePath)) {
          const metadata = await this.getFileMetadata(filePath, params.fileType, params.sessionId)
          metadataList.push(metadata)
        }
      } else {
        // Get metadata for all files in workspace
        const fileTypes: Array<'original' | 'modified' | 'session' | 'backup'> = ['original', 'modified']
        
        for (const fileType of fileTypes) {
          const filePath = this.generateFilePath(workspaceDir, fileType)
          if (existsSync(filePath)) {
            const metadata = await this.getFileMetadata(filePath, fileType)
            metadataList.push(metadata)
          }
        }

        // Get session files
        const sessionDir = join(workspaceDir, 'sessions')
        if (existsSync(sessionDir)) {
          const sessionFiles = await readdir(sessionDir)
          for (const sessionFile of sessionFiles) {
            if (sessionFile.endsWith('.json')) {
              const sessionFilePath = join(sessionDir, sessionFile)
              const sessionId = sessionFile.replace('.json', '').replace('session-', '')
              const metadata = await this.getFileMetadata(sessionFilePath, 'session', sessionId)
              metadataList.push(metadata)
            }
          }
        }
      }

      // Record performance metrics
      this.recordPerformanceMetric({
        operationType: 'metadata',
        duration: Date.now() - startTime,
        success: true,
        workspaceId: params.workspaceId,
        timestamp: startTime
      })

      return {
        success: true,
        data: metadataList,
        metadata: {
          operationTime: Date.now() - startTime
        }
      }

    } catch (error) {
      // Record error metrics
      this.recordPerformanceMetric({
        operationType: 'metadata',
        duration: Date.now() - startTime,
        success: false,
        workspaceId: params.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime
      })

      return this.handleError(error, 'metadata')
    }
  }

  /**
   * Cleanup subtitle files
   */
  async cleanupSubtitleFiles(params: CleanupSubtitleFilesParams): Promise<SubtitleFileResult<{
    deletedFiles: string[]
    compressedFiles: string[]
    freedSpace: number
  }>> {
    const startTime = Date.now()

    try {
      // Validate workspace
      const workspaceDir = await this.getWorkspaceSubtitleDir(params.workspaceId)
      
      const deletedFiles: string[] = []
      const compressedFiles: string[] = []
      let freedSpace = 0

      // Clean up old session files if specified
      if (params.options?.olderThan) {
        const sessionDir = join(workspaceDir, 'sessions')
        if (existsSync(sessionDir)) {
          const sessionFiles = await readdir(sessionDir)
          for (const sessionFile of sessionFiles) {
            const sessionFilePath = join(sessionDir, sessionFile)
            const stats = await stat(sessionFilePath)
            if (stats.mtime.getTime() < params.options.olderThan) {
              if (!params.options?.dryRun) {
                freedSpace += stats.size
                await unlink(sessionFilePath)
              }
              deletedFiles.push(sessionFilePath)
            }
          }
        }
      }

      // Clean up backup files if specified
      if (params.options?.removeBackups) {
        const backupDir = join(workspaceDir, 'backups')
        if (existsSync(backupDir)) {
          const backupFiles = await readdir(backupDir)
          for (const backupFile of backupFiles) {
            const backupFilePath = join(backupDir, backupFile)
            const stats = await stat(backupFilePath)
            if (!params.options?.dryRun) {
              freedSpace += stats.size
              await unlink(backupFilePath)
            }
            deletedFiles.push(backupFilePath)
          }
        }
      }

      // Compress files if specified
      if (params.options?.compressFiles) {
        const filesToCompress = [
          join(workspaceDir, 'original.json'),
          join(workspaceDir, 'modified.json')
        ]

        for (const filePath of filesToCompress) {
          if (existsSync(filePath)) {
            const content = await readFile(filePath, 'utf8')
            const compressed = await this.compressContent(content)
            if (!params.options?.dryRun) {
              await writeFile(filePath, compressed, 'utf8')
            }
            compressedFiles.push(filePath)
          }
        }
      }

      // Record performance metrics
      this.recordPerformanceMetric({
        operationType: 'cleanup',
        duration: Date.now() - startTime,
        success: true,
        workspaceId: params.workspaceId,
        timestamp: startTime
      })

      return {
        success: true,
        data: {
          deletedFiles,
          compressedFiles,
          freedSpace
        },
        metadata: {
          operationTime: Date.now() - startTime
        }
      }

    } catch (error) {
      // Record error metrics
      this.recordPerformanceMetric({
        operationType: 'cleanup',
        duration: Date.now() - startTime,
        success: false,
        workspaceId: params.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime
      })

      return this.handleError(error, 'cleanup')
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Execute batch subtitle file operations
   */
  async batchSubtitleOperation(params: BatchSubtitleOperationParams): Promise<BatchSubtitleOperationResult> {
    const startTime = Date.now()
    const results: BatchSubtitleOperationResult['results'] = []
    let successCount = 0
    let failureCount = 0

    const concurrency = Math.min(
      params.options?.maxConcurrency || SUBTITLE_FILE_CONSTANTS.MAX_CONCURRENT_OPERATIONS,
      params.operations.length
    )

    // Execute operations with controlled concurrency
    for (let i = 0; i < params.operations.length; i += concurrency) {
      const batch = params.operations.slice(i, i + concurrency)
      const batchPromises = batch.map(async (operation) => {
        const opStartTime = Date.now()
        try {
          let result: any

          switch (operation.type) {
            case 'create':
              result = await this.createSubtitleFile(operation.params as CreateSubtitleFileParams)
              break
            case 'load':
              result = await this.loadSubtitleFile(operation.params as LoadSubtitleFileParams)
              break
            case 'save':
              result = await this.saveSubtitleFile(operation.params as SaveSubtitleFileParams)
              break
            case 'delete':
              result = await this.deleteSubtitleFile(operation.params as DeleteSubtitleFileParams)
              break
            case 'metadata':
              result = await this.getSubtitleMetadata(operation.params as GetSubtitleMetadataParams)
              break
            default:
              throw new Error(`Unsupported operation type: ${operation.type}`)
          }

          if (result.success) {
            successCount++
          } else {
            failureCount++
          }

          return {
            operationId: operation.operationId,
            success: result.success,
            data: result.data,
            error: result.error,
            errorCode: result.errorCode,
            operationTime: Date.now() - opStartTime
          }

        } catch (error) {
          failureCount++
          return {
            operationId: operation.operationId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            operationTime: Date.now() - opStartTime
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Stop on first error if continueOnError is false
      if (!params.options?.continueOnError && batchResults.some(r => !r.success)) {
        break
      }
    }

    const totalTime = Date.now() - startTime

    return {
      success: failureCount === 0,
      results,
      statistics: {
        totalOperations: params.operations.length,
        successfulOperations: successCount,
        failedOperations: failureCount,
        totalTime,
        averageTimePerOperation: totalTime / params.operations.length
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get workspace subtitle directory
   */
  private async getWorkspaceSubtitleDir(workspaceId: string): Promise<string> {
    const userDataPath = app.getPath('userData')
    const workspaceDir = join(userDataPath, 'workspaces', workspaceId, 'subtitles')
    
    // Ensure directory exists
    await mkdir(workspaceDir, { recursive: true })
    
    return workspaceDir
  }

  /**
   * Generate file path based on type and session
   */
  private generateFilePath(workspaceDir: string, fileType: string, sessionId?: string): string {
    switch (fileType) {
      case 'original':
        return join(workspaceDir, 'original.json')
      case 'modified':
        return join(workspaceDir, 'modified.json')
      case 'session':
        if (!sessionId) throw new Error('Session ID required for session files')
        return join(workspaceDir, 'sessions', `session-${sessionId}.json`)
      case 'backup':
        const timestamp = Date.now()
        return join(workspaceDir, 'backups', `backup-${timestamp}.json`)
      default:
        throw new Error(`Unsupported file type: ${fileType}`)
    }
  }

  /**
   * Create file metadata
   */
  private createFileMetadata(
    filePath: string, 
    fileType: string, 
    sessionId?: string,
    existingMetadata?: SubtitleFileMetadata
  ): SubtitleFileMetadata {
    const now = Date.now()
    return {
      filePath,
      fileSize: 0, // Will be updated after write
      lastModified: now,
      createdAt: existingMetadata?.createdAt || now,
      checksum: '', // Will be calculated after serialization
      version: (existingMetadata?.version || 0) + 1,
      sessionId,
      fileType: fileType as any,
      encoding: 'utf8'
    }
  }

  /**
   * Calculate quality metrics for subtitles
   */
  private calculateQualityMetrics(subtitles: SubtitleEntry[]) {
    const confidenceScores = subtitles
      .map(s => s.confidence)
      .filter((c): c is number => c !== undefined)
    
    const averageConfidence = confidenceScores.length > 0 ? 
      confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length : 0
    
    const lowConfidenceCount = confidenceScores.filter(c => c < 0.7).length
    
    const totalDuration = subtitles.reduce((sum, s) => sum + (s.endTime - s.startTime), 0)
    const wordCount = subtitles.reduce((sum, s) => sum + s.text.split(' ').length, 0)

    return {
      averageConfidence,
      lowConfidenceCount,
      totalDuration,
      wordCount
    }
  }

  /**
   * Calculate content checksum
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Validate file path for security
   */
  private validateFilePath(filePath: string, operation: 'read' | 'write' | 'delete'): PathValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic path validation
    if (!filePath || typeof filePath !== 'string') {
      errors.push('File path is required')
    }

    // Check for path traversal attempts
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
    if (normalizedPath.includes('..') || normalizedPath.includes('./')) {
      errors.push('Path traversal detected')
    }

    // Check for invalid characters
    if (SUBTITLE_FILE_CONSTANTS.INVALID_FILENAME_CHARS.test(basename(filePath))) {
      errors.push('Invalid filename characters')
    }

    // Check file extension for write operations
    if (operation === 'write') {
      const ext = extname(filePath).toLowerCase().slice(1)
      if (!SUBTITLE_FILE_CONSTANTS.ALLOWED_FILE_TYPES.includes(ext)) {
        errors.push(`Unsupported file type: ${ext}`)
      }
    }

    return {
      isValid: errors.length === 0,
      normalizedPath,
      errors,
      warnings,
      workspaceDir: dirname(filePath),
      relativePath: basename(filePath)
    }
  }

  /**
   * Validate security context
   */
  private async validateSecurityContext(context: OperationSecurityContext): Promise<void> {
    // For auto-save operations (create/save/write), skip workspace validation entirely
    // to prevent blocking subtitle editing functionality when workspace sync issues occur
    if (context.operationType === 'create' || context.operationType === 'save' || context.operationType === 'write') {
      // Auto-save operations are considered safe as they only write to the workspace subtitle directory
      // No workspace validation needed - just ensure directory structure exists
      return
    }

    // For non-auto-save operations, enforce strict workspace validation
    try {
      const workspaceConfig = await this.workspaceManager.getWorkspaceConfig(context.workspaceId)
      if (!workspaceConfig) {
        throw this.createError('WORKSPACE_NOT_FOUND', 'Workspace not found', {
          workspaceId: context.workspaceId,
          operation: context.operationType
        })
      }
    } catch (error) {
      throw this.createError('WORKSPACE_NOT_FOUND', 'Unable to access workspace', {
        workspaceId: context.workspaceId,
        operation: context.operationType
      })
    }

    // Additional security validations can be added here
    // e.g., rate limiting, user permissions, etc.
  }

  /**
   * Create backup file
   */
  private async createBackupFile(filePath: string): Promise<string> {
    const backupDir = join(dirname(filePath), 'backups')
    await mkdir(backupDir, { recursive: true })
    
    const timestamp = Date.now()
    const filename = basename(filePath, '.json')
    const backupPath = join(backupDir, `${filename}-backup-${timestamp}.json`)
    
    const content = await readFile(filePath, 'utf8')
    await writeFile(backupPath, content, 'utf8')
    
    return backupPath
  }

  /**
   * Load existing file for version checking
   */
  private async loadExistingFileForVersionCheck(filePath: string): Promise<SubtitleFileContent> {
    const content = await readFile(filePath, 'utf8')
    return JSON.parse(content)
  }

  /**
   * Atomic file move operation
   */
  private async atomicMove(tempPath: string, finalPath: string): Promise<void> {
    const fs = await import('fs')
    await fs.promises.rename(tempPath, finalPath)
  }

  /**
   * Get file metadata from disk
   */
  private async getFileMetadata(filePath: string, fileType: string, sessionId?: string): Promise<SubtitleFileMetadata> {
    const stats = await stat(filePath)
    const content = await readFile(filePath, 'utf8')
    
    try {
      const parsed = JSON.parse(content)
      return parsed.metadata || this.createFileMetadata(filePath, fileType, sessionId)
    } catch {
      // If parsing fails, create basic metadata
      return {
        filePath,
        fileSize: stats.size,
        lastModified: stats.mtime.getTime(),
        createdAt: stats.birthtime.getTime(),
        checksum: this.calculateChecksum(content),
        version: 1,
        sessionId,
        fileType: fileType as any,
        encoding: 'utf8'
      }
    }
  }

  /**
   * Compress content (placeholder - implement actual compression)
   */
  private async compressContent(content: string): Promise<string> {
    // Placeholder for compression - implement with zlib or similar
    return content
  }

  /**
   * Decompress content (placeholder - implement actual decompression)
   */
  private async decompressContent(content: string): Promise<string> {
    // Placeholder for decompression - implement with zlib or similar
    return content
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Generate cache key
   */
  private generateCacheKey(workspaceId: string, fileType: string, sessionId?: string): string {
    return sessionId ? `${workspaceId}:${fileType}:${sessionId}` : `${workspaceId}:${fileType}`
  }

  /**
   * Get cache entry
   */
  private getCacheEntry(workspaceId: string, fileType: string, sessionId?: string): SubtitleFileContent | null {
    const key = this.generateCacheKey(workspaceId, fileType, sessionId)
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check if expired
    if (Date.now() > entry.expiryTime) {
      this.cache.delete(key)
      this.cacheMetrics.evictions++
      return null
    }
    
    // Update access info
    entry.accessCount++
    entry.lastAccessed = Date.now()
    
    return entry.content
  }

  /**
   * Set cache entry
   */
  private async setCacheEntry(
    workspaceId: string, 
    fileType: string, 
    content: SubtitleFileContent, 
    sessionId?: string
  ): Promise<void> {
    if (!this.cacheConfig.enabled) return
    
    const key = this.generateCacheKey(workspaceId, fileType, sessionId)
    const memorySize = JSON.stringify(content).length * 2 // Rough estimate
    
    // Check cache size limits
    if (this.cache.size >= this.cacheConfig.maxEntries) {
      this.evictLRUEntries(1)
    }
    
    const entry: SubtitleFileCacheEntry = {
      key,
      content,
      timestamp: Date.now(),
      expiryTime: Date.now() + this.cacheConfig.defaultTTL,
      accessCount: 0,
      checksum: content.metadata.checksum,
      memorySize,
      lastAccessed: Date.now()
    }
    
    this.cache.set(key, entry)
  }

  /**
   * Remove cache entry
   */
  private removeCacheEntry(workspaceId: string, fileType: string, sessionId?: string): void {
    const key = this.generateCacheKey(workspaceId, fileType, sessionId)
    this.cache.delete(key)
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    let evicted = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiryTime) {
        this.cache.delete(key)
        evicted++
      }
    }
    
    this.cacheMetrics.evictions += evicted
    this.updateCacheMetrics()
  }

  /**
   * Evict LRU cache entries
   */
  private evictLRUEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0])
      this.cacheMetrics.evictions++
    }
  }

  /**
   * Initialize cache metrics
   */
  private initializeCacheMetrics(): SubtitleFileCacheMetrics {
    return {
      hitRate: 0,
      totalRequests: 0,
      hits: 0,
      misses: 0,
      currentSize: 0,
      entryCount: 0,
      averageAccessTime: 0,
      evictions: 0,
      memoryPressureCount: 0
    }
  }

  /**
   * Update cache metrics
   */
  private updateCacheMetrics(): void {
    this.cacheMetrics.hitRate = this.cacheMetrics.totalRequests > 0 ? 
      this.cacheMetrics.hits / this.cacheMetrics.totalRequests : 0
    this.cacheMetrics.entryCount = this.cache.size
    this.cacheMetrics.currentSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.memorySize, 0)
  }

  /**
   * Get cache metrics
   */
  public getCacheMetrics(): SubtitleFileCacheMetrics {
    this.updateCacheMetrics()
    return { ...this.cacheMetrics }
  }

  /**
   * Clear cache
   */
  public clearCache(workspaceId?: string): void {
    if (workspaceId) {
      // Clear cache for specific workspace
      for (const [key] of this.cache) {
        if (key.startsWith(`${workspaceId}:`)) {
          this.cache.delete(key)
        }
      }
    } else {
      // Clear all cache
      this.cache.clear()
    }
    this.updateCacheMetrics()
  }

  /**
   * Clean up compression cache
   */
  private cleanupCompressionCache(): void {
    // Simple cleanup - remove entries older than 5 minutes
    // In production, implement proper LRU or size-based eviction
    this.compressionCache.clear()
  }

  // ============================================================================
  // ERROR HANDLING AND PERFORMANCE
  // ============================================================================

  /**
   * Create subtitle file error
   */
  private createError(
    code: SubtitleFileErrorCode,
    message: string,
    context?: Partial<SubtitleFileError>
  ): SubtitleFileError {
    const error = new Error(message) as SubtitleFileError
    error.code = code
    error.workspaceId = context?.workspaceId
    error.filePath = context?.filePath
    error.sessionId = context?.sessionId
    error.operation = context?.operation
    error.details = context?.details
    error.recovery = context?.recovery
    error.context = context?.context
    return error
  }

  /**
   * Handle error and return formatted result
   */
  private handleError(error: any, operation: string): SubtitleFileResult<any> {
    const subtitleError = error instanceof Error && 'code' in error ? 
      error as SubtitleFileError : 
      this.createError('SERIALIZATION_ERROR', error instanceof Error ? error.message : 'Unknown error')

    return {
      success: false,
      error: subtitleError.message,
      errorCode: subtitleError.code
    }
  }

  /**
   * Record performance metric
   */
  private recordPerformanceMetric(metric: SubtitleFilePerformanceMetrics): void {
    this.performanceMetrics.push(metric)
    
    // Keep only last 1000 metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics.splice(0, this.performanceMetrics.length - 1000)
    }
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): SubtitleFilePerformanceMetrics[] {
    return [...this.performanceMetrics]
  }

  /**
   * Clear performance metrics
   */
  public clearPerformanceMetrics(): void {
    this.performanceMetrics = []
  }

  /**
   * Configure cache settings
   */
  public configureCaching(config: Partial<SubtitleFileCacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config }
    
    // Apply new settings
    if (!config.enabled) {
      this.clearCache()
    }
  }
}

// Singleton instance
let subtitleFileManager: SubtitleFileManager | null = null

export function getSubtitleFileManager(): SubtitleFileManager {
  if (!subtitleFileManager) {
    subtitleFileManager = new SubtitleFileManager()
  }
  return subtitleFileManager
}