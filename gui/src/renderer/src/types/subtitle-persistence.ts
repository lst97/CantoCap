/**
 * Subtitle File Persistence Types and Interfaces
 * 
 * Comprehensive TypeScript interfaces for type-safe subtitle file operations
 * with seamless integration to the enhanced workspace store system.
 */

import type { SubtitleData, ProcessingStatistics } from '../../../types'
import type { WorkflowStepId } from './workspace'

// ============================================================================
// CORE SUBTITLE FILE TYPES
// ============================================================================

/**
 * Subtitle file metadata with integrity tracking and performance metrics
 */
export interface SubtitleFileMetadata {
  /** Unique file identifier */
  fileId: string
  /** Associated workspace identifier */
  workspaceId: string
  /** File type classification */
  fileType: 'original' | 'modified' | 'session_backup' | 'export_cache'
  /** Original filename when imported */
  originalFilename?: string
  /** File creation timestamp */
  createdAt: number
  /** Last modification timestamp */
  lastModified: number
  /** File size in bytes */
  fileSize: number
  /** Content checksum for integrity validation */
  checksum: string
  /** File format version for migration support */
  version: number
  /** Schema version for data structure compatibility */
  schemaVersion: number
  /** Compression information */
  compression?: {
    algorithm: 'gzip' | 'lz4' | 'none'
    originalSize: number
    compressedSize: number
    compressionRatio: number
  }
  /** File validation status */
  validation: {
    isValid: boolean
    lastValidated: number
    validationErrors: string[]
    contentIntegrity: boolean
    structureIntegrity: boolean
  }
  /** Performance tracking */
  performance: {
    lastReadTime: number
    lastWriteTime: number
    averageReadTime: number
    averageWriteTime: number
    accessCount: number
  }
  /** Backup information */
  backup?: {
    hasBackup: boolean
    backupPath?: string
    backupTimestamp?: number
    autoBackupEnabled: boolean
  }
}

/**
 * Subtitle file content structure with enhanced metadata
 */
export interface SubtitleFileContent {
  /** File metadata reference */
  metadata: Pick<SubtitleFileMetadata, 'fileId' | 'workspaceId' | 'version' | 'schemaVersion'>
  /** Actual subtitle data */
  subtitles: SubtitleData[]
  /** Content statistics */
  statistics: SubtitleContentStatistics
  /** Processing context */
  processingContext?: {
    originalProcessingConfig?: any
    processingTimestamp?: number
    processingStatistics?: ProcessingStatistics
    qualityMetrics?: {
      confidence: number
      accuracy: number
      completeness: number
    }
  }
  /** Editing history */
  editHistory: SubtitleEditEntry[]
  /** Validation results */
  validation: {
    isValid: boolean
    warnings: string[]
    errors: string[]
    qualityScore: number
  }
  /** Export metadata */
  exportInfo?: {
    lastExportFormat?: string
    lastExportTimestamp?: number
    exportCount: number
  }
}

/**
 * Subtitle content statistics for analysis and optimization
 */
export interface SubtitleContentStatistics {
  /** Total number of subtitle entries */
  totalSubtitles: number
  /** Total duration covered by subtitles */
  totalDuration: number
  /** Total word count */
  wordCount: number
  /** Character count */
  characterCount: number
  /** Translation coverage percentage */
  translationCoverage: number
  /** Average confidence score */
  averageConfidence: number
  /** Speaker distribution */
  speakerDistribution: Record<string, number>
  /** Music segment count */
  musicSegments: number
  /** Quality distribution */
  qualityDistribution: {
    high: number    // confidence > 0.8
    medium: number  // confidence 0.5-0.8
    low: number     // confidence < 0.5
  }
  /** Timing statistics */
  timingStats: {
    averageDuration: number
    minDuration: number
    maxDuration: number
    gapCount: number
    overlapCount: number
  }
}

/**
 * Individual subtitle edit history entry
 */
export interface SubtitleEditEntry {
  /** Edit entry identifier */
  id: string
  /** Timestamp of the edit */
  timestamp: number
  /** Type of edit operation */
  operation: 'create' | 'update' | 'delete' | 'merge' | 'split' | 'translate' | 'timing_adjust'
  /** Subtitle ID affected */
  subtitleId: number
  /** Field that was changed */
  field?: 'text' | 'translation' | 'startTime' | 'endTime' | 'speaker' | 'confidence'
  /** Previous value */
  previousValue?: any
  /** New value */
  newValue?: any
  /** Edit source */
  source: 'user' | 'auto_save' | 'import' | 'processing' | 'validation'
  /** Additional context */
  context?: {
    batchOperation?: boolean
    batchId?: string
    reason?: string
    confidence?: number
  }
}

/**
 * Session-specific subtitle persistence data
 */
export interface SubtitleSessionData {
  /** Session identifier */
  sessionId: string
  /** Associated workspace identifier */
  workspaceId: string
  /** Session type */
  sessionType: 'review' | 'editing' | 'validation' | 'export'
  /** Session creation timestamp */
  createdAt: number
  /** Last update timestamp */
  lastUpdated: number
  /** Session state */
  state: {
    currentSubtitleIndex?: number
    selectedSubtitleIds: number[]
    editMode: 'simple' | 'advanced' | 'timeline'
    viewMode: 'list' | 'grid' | 'waveform'
    filters: SubtitleSessionFilters
    searchState?: SubtitleSearchState
  }
  /** Auto-save configuration */
  autoSave: {
    enabled: boolean
    interval: number
    lastSave?: number
    pendingChanges: boolean
  }
  /** Session preferences */
  preferences: {
    showConfidenceScores: boolean
    showTimestamps: boolean
    showSpeakers: boolean
    highlightLowConfidence: boolean
    enableSpellCheck: boolean
    fontSize: number
  }
  /** Session statistics */
  statistics: {
    editsCount: number
    timeSpent: number
    subtitlesReviewed: number
    issuesResolved: number
  }
}

/**
 * Subtitle session filters
 */
export interface SubtitleSessionFilters {
  /** Show only untranslated subtitles */
  showOnlyUntranslated: boolean
  /** Show only low confidence subtitles */
  showOnlyLowConfidence: boolean
  /** Filter by speaker */
  speakerFilter?: string
  /** Filter by confidence range */
  confidenceRange?: {
    min: number
    max: number
  }
  /** Filter by time range */
  timeRange?: {
    start: number
    end: number
  }
  /** Show only music segments */
  showOnlyMusic?: boolean
  /** Custom text filter */
  textFilter?: string
}

/**
 * Subtitle search state
 */
export interface SubtitleSearchState {
  /** Search query */
  query: string
  /** Search options */
  options: {
    caseSensitive: boolean
    wholeWord: boolean
    useRegex: boolean
    searchTranslations: boolean
    searchSpeakers: boolean
  }
  /** Search results */
  results: Array<{
    subtitleId: number
    field: 'text' | 'translation' | 'speaker'
    matches: Array<{
      start: number
      end: number
      text: string
    }>
  }>
  /** Current result index */
  currentIndex: number
  /** Total matches count */
  totalMatches: number
}

// ============================================================================
// FILE OPERATION TYPES
// ============================================================================

/**
 * Base interface for subtitle file operations
 */
export interface SubtitleFileOperation {
  /** Operation identifier */
  operationId: string
  /** Operation type */
  type: 'create' | 'read' | 'update' | 'delete' | 'validate' | 'backup' | 'restore'
  /** Associated workspace identifier */
  workspaceId: string
  /** Target file identifier */
  fileId?: string
  /** Operation timestamp */
  timestamp: number
  /** Operation status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  /** Progress percentage */
  progress: number
  /** Operation result */
  result?: any
  /** Error information */
  error?: SubtitleFileError
  /** Performance metrics */
  performance?: {
    startTime: number
    endTime?: number
    duration?: number
    bytesProcessed?: number
    throughput?: number
  }
}

/**
 * Subtitle file operation request parameters
 */
export interface SubtitleFileOperationRequest {
  /** Operation type */
  operation: SubtitleFileOperation['type']
  /** Target workspace identifier */
  workspaceId: string
  /** Target file identifier (for read/update/delete operations) */
  fileId?: string
  /** File data (for create/update operations) */
  data?: Partial<SubtitleFileContent>
  /** Operation options */
  options?: {
    /** Create backup before operation */
    createBackup?: boolean
    /** Validate content after operation */
    validateAfter?: boolean
    /** Use compression */
    compress?: boolean
    /** Skip cache */
    skipCache?: boolean
    /** Operation timeout in milliseconds */
    timeout?: number
    /** Batch operation identifier */
    batchId?: string
    /** File type for create operations */
    fileType?: 'original' | 'modified' | 'session' | 'backup'
  }
}

/**
 * Subtitle file operation response
 */
export interface SubtitleFileOperationResponse {
  /** Operation success status */
  success: boolean
  /** Operation identifier */
  operationId: string
  /** Result data */
  data?: any
  /** File metadata (for create/read operations) */
  metadata?: SubtitleFileMetadata
  /** Error information */
  error?: SubtitleFileError
  /** Performance metrics */
  performance: {
    duration: number
    bytesProcessed: number
    cacheHit?: boolean
  }
  /** Validation results (if validation was requested) */
  validation?: SubtitleValidationResult
}

/**
 * Batch subtitle file operation request
 */
export interface BatchSubtitleFileOperationRequest {
  /** Batch identifier */
  batchId: string
  /** Batch operations */
  operations: SubtitleFileOperationRequest[]
  /** Batch options */
  options?: {
    /** Continue on error */
    continueOnError?: boolean
    /** Maximum concurrent operations */
    maxConcurrency?: number
    /** Batch timeout in milliseconds */
    timeout?: number
    /** Transaction mode (all or nothing) */
    transaction?: boolean
  }
}

/**
 * Batch operation response
 */
export interface BatchSubtitleFileOperationResponse {
  /** Batch success status */
  success: boolean
  /** Batch identifier */
  batchId: string
  /** Individual operation results */
  results: SubtitleFileOperationResponse[]
  /** Batch statistics */
  statistics: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    totalDuration: number
    totalBytesProcessed: number
  }
  /** Batch errors */
  errors: SubtitleFileError[]
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Subtitle file specific error types
 */
export interface SubtitleFileError extends Error {
  code: 
    | 'SUBTITLE_FILE_NOT_FOUND'
    | 'SUBTITLE_FILE_CORRUPTED'
    | 'SUBTITLE_FILE_ACCESS_DENIED'
    | 'SUBTITLE_FILE_TOO_LARGE'
    | 'SUBTITLE_VALIDATION_FAILED'
    | 'SUBTITLE_CHECKSUM_MISMATCH'
    | 'SUBTITLE_VERSION_INCOMPATIBLE'
    | 'SUBTITLE_OPERATION_TIMEOUT'
    | 'SUBTITLE_CACHE_ERROR'
    | 'SUBTITLE_COMPRESSION_FAILED'
    | 'SUBTITLE_BACKUP_FAILED'
    | 'SUBTITLE_SERIALIZATION_ERROR'
    | 'SUBTITLE_WORKSPACE_MISMATCH'
  /** Associated workspace identifier */
  workspaceId?: string
  /** Associated file identifier */
  fileId?: string
  /** Operation that caused the error */
  operation?: string
  /** Additional error context */
  context?: {
    filePath?: string
    fileSize?: number
    expectedChecksum?: string
    actualChecksum?: string
    validationErrors?: string[]
  }
  /** Recovery action suggestions */
  recovery?: {
    action: 'retry' | 'restore_backup' | 'recreate' | 'manual_intervention'
    description: string
    autoRecoverable: boolean
  }
}

/**
 * Subtitle validation result
 */
export interface SubtitleValidationResult {
  /** Overall validation status */
  isValid: boolean
  /** Validation timestamp */
  timestamp: number
  /** Validation errors */
  errors: Array<{
    code: string
    message: string
    severity: 'error' | 'warning' | 'info'
    subtitleId?: number
    field?: string
    value?: any
    suggestion?: string
  }>
  /** Content integrity check */
  contentIntegrity: {
    checksum: string
    isValid: boolean
    corruptedEntries?: number[]
  }
  /** Structure validation */
  structureValidation: {
    isValid: boolean
    missingFields: string[]
    invalidFields: string[]
    timingIssues: Array<{
      type: 'overlap' | 'gap' | 'negative_duration' | 'out_of_order'
      subtitleIds: number[]
      description: string
    }>
  }
  /** Quality assessment */
  qualityAssessment: {
    overallScore: number
    issues: Array<{
      type: 'low_confidence' | 'missing_translation' | 'timing_issue' | 'content_issue'
      count: number
      severity: 'low' | 'medium' | 'high'
      affectedSubtitles: number[]
    }>
  }
}

// ============================================================================
// PERFORMANCE AND CACHING TYPES
// ============================================================================

/**
 * Subtitle file cache entry
 */
export interface SubtitleCacheEntry {
  /** Cache key */
  key: string
  /** Cached content */
  content: SubtitleFileContent
  /** Cache metadata */
  metadata: {
    /** Creation timestamp */
    createdAt: number
    /** Last access timestamp */
    lastAccessed: number
    /** Access count */
    accessCount: number
    /** Expiry timestamp */
    expiryTime: number
    /** Cache entry size in bytes */
    size: number
    /** Original size before compression */
    originalSize?: number
    /** Dirty flag for unsaved changes */
    isDirty: boolean
    /** Compression flag */
    isCompressed?: boolean
    /** Compression ratio */
    compressionRatio?: number
  }
  /** Cache statistics */
  statistics: {
    hitCount: number
    missCount: number
    loadTime: number
  }
}

/**
 * Subtitle cache configuration
 */
export interface SubtitleCacheConfig {
  /** Enable caching */
  enabled: boolean
  /** Maximum cache size in bytes */
  maxSize: number
  /** Maximum number of entries */
  maxEntries: number
  /** Default TTL in milliseconds */
  defaultTTL: number
  /** Enable LRU eviction */
  enableLRU: boolean
  /** Enable compression for cached entries */
  enableCompression: boolean
  /** Cache persistence */
  persistent: boolean
  /** Cache cleanup interval */
  cleanupInterval: number
}

/**
 * Subtitle cache metrics
 */
export interface SubtitleCacheMetrics {
  /** Total cache hits */
  hitCount: number
  /** Total cache misses */
  missCount: number
  /** Cache hit rate */
  hitRate: number
  /** Total cache evictions */
  evictionCount: number
  /** Current cache size in bytes */
  currentSize: number
  /** Current entry count */
  entryCount: number
  /** Average access time */
  averageAccessTime: number
  /** Cache efficiency score */
  efficiencyScore: number
  /** Memory usage breakdown */
  memoryUsage: {
    metadata: number
    content: number
    overhead: number
  }
}

/**
 * Subtitle file performance metrics
 */
export interface SubtitlePerformanceMetrics {
  /** Metric identifier */
  id: string
  /** Associated workspace identifier */
  workspaceId: string
  /** Operation type */
  operationType: 'read' | 'write' | 'validate' | 'compress' | 'backup'
  /** File size processed */
  fileSize: number
  /** Operation duration in milliseconds */
  duration: number
  /** Throughput in bytes per second */
  throughput: number
  /** Cache hit status */
  cacheHit: boolean
  /** Compression ratio (if applicable) */
  compressionRatio?: number
  /** Memory usage during operation */
  memoryUsage?: number
  /** Timestamp */
  timestamp: number
  /** Success status */
  success: boolean
  /** Error information */
  error?: string
}

/**
 * Streaming progress information for large file operations
 */
export interface SubtitleStreamProgress {
  /** Operation identifier */
  operationId: string
  /** Progress percentage */
  progress: number
  /** Bytes processed */
  bytesProcessed: number
  /** Total bytes */
  totalBytes: number
  /** Current processing rate in bytes per second */
  processingRate: number
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining: number
  /** Current chunk being processed */
  currentChunk?: number
  /** Total chunks */
  totalChunks?: number
  /** Status message */
  status: string
}

// ============================================================================
// INTEGRATION TYPES WITH WORKSPACE SYSTEM
// ============================================================================

/**
 * Subtitle persistence data for integration with ReviewStepConfig
 */
export interface SubtitlePersistenceData {
  /** Original subtitle file reference */
  originalFile?: {
    fileId: string
    path: string
    metadata: SubtitleFileMetadata
  }
  /** Modified subtitle file reference */
  modifiedFile?: {
    fileId: string
    path: string
    metadata: SubtitleFileMetadata
    hasChanges: boolean
  }
  /** Session backup files */
  sessionBackups: Array<{
    sessionId: string
    fileId: string
    path: string
    timestamp: number
  }>
  /** Auto-save configuration */
  autoSave: {
    enabled: boolean
    interval: number
    lastSave?: number
    backupCount: number
  }
  /** File operation history */
  operationHistory: SubtitleFileOperation[]
  /** Current cache status */
  cacheStatus: {
    isCached: boolean
    cacheKey?: string
    lastCacheUpdate?: number
  }
  /** Performance tracking */
  performance: {
    lastOperationTime: number
    averageOperationTime: number
    totalOperations: number
    errorCount: number
  }
}

/**
 * Subtitle file operation status for UI feedback
 */
export interface SubtitleFileStatus {
  /** Current operation */
  currentOperation?: SubtitleFileOperation
  /** Operation queue */
  operationQueue: SubtitleFileOperation[]
  /** Recent operations */
  recentOperations: SubtitleFileOperation[]
  /** Error state */
  hasErrors: boolean
  /** Last error */
  lastError?: SubtitleFileError
  /** Performance metrics */
  performanceMetrics: SubtitlePerformanceMetrics[]
  /** Cache metrics */
  cacheMetrics: SubtitleCacheMetrics
}

/**
 * Subtitle file operations interface for React hooks
 */
export interface SubtitleFileOperations {
  /** Load subtitle file */
  loadFile: (fileId: string, options?: { useCache?: boolean }) => Promise<SubtitleFileContent>
  /** Save subtitle file */
  saveFile: (fileId: string, content: SubtitleFileContent, options?: { createBackup?: boolean }) => Promise<void>
  /** Create new subtitle file */
  createFile: (content: SubtitleFileContent, options?: { compress?: boolean }) => Promise<string>
  /** Delete subtitle file */
  deleteFile: (fileId: string, options?: { permanent?: boolean }) => Promise<void>
  /** Validate subtitle file */
  validateFile: (fileId: string) => Promise<SubtitleValidationResult>
  /** Get file metadata */
  getMetadata: (fileId: string) => Promise<SubtitleFileMetadata>
  /** Create backup */
  createBackup: (fileId: string, description?: string) => Promise<string>
  /** Restore from backup */
  restoreBackup: (backupId: string) => Promise<void>
  /** Batch operations */
  batchOperation: (request: BatchSubtitleFileOperationRequest) => Promise<BatchSubtitleFileOperationResponse>
  /** Get operation status */
  getOperationStatus: (operationId: string) => Promise<SubtitleFileOperation>
  /** Cancel operation */
  cancelOperation: (operationId: string) => Promise<void>
  /** Clear cache */
  clearCache: (fileId?: string) => Promise<void>
  /** Get performance metrics */
  getPerformanceMetrics: () => Promise<SubtitlePerformanceMetrics[]>
}

/**
 * Error recovery strategies for subtitle file operations
 */
export interface SubtitleErrorRecovery {
  /** Automatic recovery */
  autoRecovery: {
    enabled: boolean
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
  /** Backup-based recovery */
  backupRecovery: {
    enabled: boolean
    autoRestoreOnCorruption: boolean
    maxBackupAge: number
  }
  /** Cache recovery */
  cacheRecovery: {
    enabled: boolean
    fallbackToCache: boolean
    cacheValidation: boolean
  }
  /** Manual recovery options */
  manualRecovery: {
    recreateFromOriginal: boolean
    exportAndReimport: boolean
    contactSupport: boolean
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Subtitle file operation result union type
 */
export type SubtitleFileResult<T = any> = {
  success: true
  data: T
  metadata?: SubtitleFileMetadata
  performance: { duration: number; bytesProcessed: number }
} | {
  success: false
  error: SubtitleFileError
  performance: { duration: number; bytesProcessed: number }
}

/**
 * File path validation result
 */
export interface SubtitlePathValidation {
  isValid: boolean
  path: string
  exists: boolean
  readable: boolean
  writable: boolean
  size?: number
  permissions: string
  errors: string[]
  warnings: string[]
}

/**
 * Compression information for subtitle files
 */
export interface SubtitleCompressionInfo {
  algorithm: 'gzip' | 'lz4' | 'brotli' | 'none'
  originalSize: number
  compressedSize: number
  compressionRatio: number
  compressionTime: number
  decompressionTime?: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SUBTITLE_PERSISTENCE_CONSTANTS = {
  /** Maximum file size for subtitle files (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Default cache TTL (5 minutes) */
  DEFAULT_CACHE_TTL: 5 * 60 * 1000,
  /** Maximum cache size (50MB) */
  MAX_CACHE_SIZE: 50 * 1024 * 1024,
  /** Default auto-save interval (30 seconds) */
  DEFAULT_AUTOSAVE_INTERVAL: 30 * 1000,
  /** Maximum operation timeout (2 minutes) */
  MAX_OPERATION_TIMEOUT: 2 * 60 * 1000,
  /** Maximum backup retention (30 days) */
  MAX_BACKUP_RETENTION: 30 * 24 * 60 * 60 * 1000,
  /** Current file format version */
  CURRENT_FILE_VERSION: 1,
  /** Current schema version */
  CURRENT_SCHEMA_VERSION: 1,
  /** Compression threshold (1KB) */
  COMPRESSION_THRESHOLD: 1024,
  /** Maximum retry attempts */
  MAX_RETRY_ATTEMPTS: 3,
  /** Default batch size */
  DEFAULT_BATCH_SIZE: 10
} as const

/**
 * Default subtitle cache configuration
 */
export const DEFAULT_SUBTITLE_CACHE_CONFIG: SubtitleCacheConfig = {
  enabled: true,
  maxSize: SUBTITLE_PERSISTENCE_CONSTANTS.MAX_CACHE_SIZE,
  maxEntries: 100,
  defaultTTL: SUBTITLE_PERSISTENCE_CONSTANTS.DEFAULT_CACHE_TTL,
  enableLRU: true,
  enableCompression: true,
  persistent: false,
  cleanupInterval: 60 * 1000 // 1 minute
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for subtitle file metadata
 */
export function isSubtitleFileMetadata(obj: any): obj is SubtitleFileMetadata {
  return obj &&
    typeof obj.fileId === 'string' &&
    typeof obj.workspaceId === 'string' &&
    typeof obj.fileType === 'string' &&
    typeof obj.createdAt === 'number' &&
    obj.validation &&
    obj.performance
}

/**
 * Type guard for subtitle file content
 */
export function isSubtitleFileContent(obj: any): obj is SubtitleFileContent {
  return obj &&
    obj.metadata &&
    Array.isArray(obj.subtitles) &&
    obj.statistics &&
    Array.isArray(obj.editHistory) &&
    obj.validation
}

/**
 * Type guard for subtitle file error
 */
export function isSubtitleFileError(error: any): error is SubtitleFileError {
  return error &&
    typeof error.code === 'string' &&
    error.code.startsWith('SUBTITLE_')
}

/**
 * Type guard for cached subtitle entry
 */
export function isSubtitleCacheEntry(obj: any): obj is SubtitleCacheEntry {
  return obj &&
    typeof obj.key === 'string' &&
    obj.content &&
    obj.metadata &&
    obj.statistics
}

/**
 * Validate subtitle file operation request
 */
export function isValidSubtitleFileOperationRequest(req: any): req is SubtitleFileOperationRequest {
  return req &&
    typeof req.operation === 'string' &&
    typeof req.workspaceId === 'string' &&
    ['create', 'read', 'update', 'delete', 'validate', 'backup', 'restore'].includes(req.operation)
}