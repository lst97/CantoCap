/**
 * Subtitle File Operations IPC Types
 * 
 * Type definitions for secure IPC communication between main and renderer processes
 * for subtitle file persistence operations.
 */

import type { SubtitleData, SubtitleEntry, TempSubtitleSession, SubtitleModification } from './subtitle'

// ============================================================================
// CORE SUBTITLE FILE TYPES
// ============================================================================

/**
 * Subtitle file metadata for tracking and integrity validation
 */
export interface SubtitleFileMetadata {
  /** File path */
  filePath: string
  /** File size in bytes */
  fileSize: number
  /** Last modified timestamp */
  lastModified: number
  /** File creation timestamp */
  createdAt: number
  /** Checksum for integrity validation */
  checksum: string
  /** File version for optimistic locking */
  version: number
  /** Original file path if this is a copy/backup */
  originalPath?: string
  /** Session ID that created/modified this file */
  sessionId?: string
  /** File type classification */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Compression flag */
  isCompressed?: boolean
  /** File encoding */
  encoding: 'utf8' | 'utf16' | 'gbk'
}

/**
 * Subtitle file content structure for persistence
 */
export interface SubtitleFileContent {
  /** File metadata */
  metadata: SubtitleFileMetadata
  /** Subtitle entries */
  subtitles: SubtitleEntry[]
  /** Session information if applicable */
  sessionInfo?: {
    sessionId: string
    workspaceId: string
    videoPath: string
    lastEditTime: number
    totalModifications: number
  }
  /** Quality metrics */
  qualityMetrics?: {
    averageConfidence: number
    lowConfidenceCount: number
    totalDuration: number
    wordCount: number
  }
}

/**
 * Subtitle file operation result
 */
export interface SubtitleFileResult<T = any> {
  /** Operation success flag */
  success: boolean
  /** Result data if successful */
  data?: T
  /** Error message if failed */
  error?: string
  /** Error code for programmatic handling */
  errorCode?: SubtitleFileErrorCode
  /** Additional metadata */
  metadata?: {
    filePath?: string
    fileSize?: number
    operationTime?: number
    fromCache?: boolean
    compressionRatio?: number
  }
}

/**
 * Subtitle file error codes for consistent error handling
 */
export type SubtitleFileErrorCode = 
  | 'FILE_NOT_FOUND'
  | 'FILE_ACCESS_DENIED' 
  | 'FILE_CORRUPTED'
  | 'FILE_TOO_LARGE'
  | 'WORKSPACE_NOT_FOUND'
  | 'INVALID_SESSION'
  | 'CHECKSUM_MISMATCH'
  | 'VERSION_CONFLICT'
  | 'COMPRESSION_FAILED'
  | 'SERIALIZATION_ERROR'
  | 'PATH_TRAVERSAL_BLOCKED'
  | 'CONCURRENT_ACCESS'
  | 'STORAGE_FULL'
  | 'NETWORK_ERROR'

// ============================================================================
// IPC OPERATION TYPES
// ============================================================================

/**
 * Create subtitle file operation parameters
 */
export interface CreateSubtitleFileParams {
  /** Target workspace ID */
  workspaceId: string
  /** File type to create */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Subtitle content */
  content: SubtitleEntry[]
  /** Session information */
  sessionInfo?: {
    sessionId: string
    videoPath: string
  }
  /** File options */
  options?: {
    compress?: boolean
    encoding?: 'utf8' | 'utf16' | 'gbk'
    overwrite?: boolean
    createBackup?: boolean
  }
}

/**
 * Load subtitle file operation parameters
 */
export interface LoadSubtitleFileParams {
  /** Target workspace ID */
  workspaceId: string
  /** File type to load */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Session ID for session files */
  sessionId?: string
  /** Load options */
  options?: {
    validateChecksum?: boolean
    useCache?: boolean
    decompress?: boolean
    encoding?: 'utf8' | 'utf16' | 'gbk'
  }
}

/**
 * Save subtitle file operation parameters
 */
export interface SaveSubtitleFileParams {
  /** Target workspace ID */
  workspaceId: string
  /** File type to save */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Subtitle content */
  content: SubtitleEntry[]
  /** Session information */
  sessionInfo?: {
    sessionId: string
    videoPath: string
    modifications: SubtitleModification[]
  }
  /** Save options */
  options?: {
    compress?: boolean
    encoding?: 'utf8' | 'utf16' | 'gbk'
    createBackup?: boolean
    forceOverwrite?: boolean
    expectedVersion?: number // For optimistic locking
  }
}

/**
 * Delete subtitle file operation parameters
 */
export interface DeleteSubtitleFileParams {
  /** Target workspace ID */
  workspaceId: string
  /** File type to delete */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Session ID for session files */
  sessionId?: string
  /** Delete options */
  options?: {
    createBackup?: boolean
    force?: boolean
  }
}

/**
 * Get subtitle metadata operation parameters
 */
export interface GetSubtitleMetadataParams {
  /** Target workspace ID */
  workspaceId: string
  /** File type to query */
  fileType?: 'original' | 'modified' | 'session' | 'backup'
  /** Session ID for session files */
  sessionId?: string
}

/**
 * Cleanup subtitle files operation parameters
 */
export interface CleanupSubtitleFilesParams {
  /** Target workspace ID */
  workspaceId: string
  /** Cleanup options */
  options?: {
    /** Remove session files older than this timestamp */
    olderThan?: number
    /** Remove backup files */
    removeBackups?: boolean
    /** Compress remaining files */
    compressFiles?: boolean
    /** Dry run - don't actually delete */
    dryRun?: boolean
  }
}

// ============================================================================
// STREAMING AND LARGE FILE SUPPORT
// ============================================================================

/**
 * Streaming read parameters for large subtitle files
 */
export interface StreamSubtitleFileParams {
  /** Target workspace ID */
  workspaceId: string
  /** File type to stream */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Session ID for session files */
  sessionId?: string
  /** Streaming options */
  options?: {
    /** Chunk size in bytes */
    chunkSize?: number
    /** Start offset */
    startOffset?: number
    /** End offset */
    endOffset?: number
    /** Validate each chunk */
    validateChunks?: boolean
  }
}

/**
 * Streaming write parameters for large subtitle files
 */
export interface StreamWriteSubtitleParams {
  /** Target workspace ID */
  workspaceId: string
  /** File type to write */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Session ID for session files */
  sessionId?: string
  /** Stream ID for tracking */
  streamId: string
  /** Chunk data */
  chunk: ArrayBuffer | string
  /** Is this the final chunk */
  isLast: boolean
  /** Stream options */
  options?: {
    compress?: boolean
    encoding?: 'utf8' | 'utf16' | 'gbk'
    validateChunks?: boolean
  }
}

/**
 * Streaming progress callback data
 */
export interface StreamProgressData {
  /** Stream ID */
  streamId: string
  /** Bytes processed */
  bytesProcessed: number
  /** Total bytes */
  totalBytes: number
  /** Progress percentage */
  progress: number
  /** Operation type */
  operation: 'read' | 'write'
  /** Current chunk index */
  chunkIndex: number
  /** Error if any */
  error?: string
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch operation parameters for multiple subtitle file operations
 */
export interface BatchSubtitleOperationParams {
  /** Target workspace ID */
  workspaceId: string
  /** Array of operations to perform */
  operations: Array<{
    /** Operation type */
    type: 'create' | 'load' | 'save' | 'delete' | 'metadata'
    /** Operation parameters */
    params: CreateSubtitleFileParams | LoadSubtitleFileParams | SaveSubtitleFileParams | DeleteSubtitleFileParams | GetSubtitleMetadataParams
    /** Optional operation ID for tracking */
    operationId?: string
  }>
  /** Batch options */
  options?: {
    /** Continue on error */
    continueOnError?: boolean
    /** Maximum concurrent operations */
    maxConcurrency?: number
    /** Timeout for entire batch in ms */
    timeoutMs?: number
    /** Create transaction log */
    createLog?: boolean
  }
}

/**
 * Batch operation result
 */
export interface BatchSubtitleOperationResult {
  /** Overall success flag */
  success: boolean
  /** Results for each operation */
  results: Array<{
    operationId?: string
    success: boolean
    data?: any
    error?: string
    errorCode?: SubtitleFileErrorCode
    operationTime?: number
  }>
  /** Overall statistics */
  statistics: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    totalTime: number
    averageTimePerOperation: number
  }
  /** Transaction log path if created */
  logPath?: string
}

// ============================================================================
// CACHE AND PERFORMANCE TYPES
// ============================================================================

/**
 * Subtitle file cache entry
 */
export interface SubtitleFileCacheEntry {
  /** Cache key */
  key: string
  /** Cached content */
  content: SubtitleFileContent
  /** Cache timestamp */
  timestamp: number
  /** Expiry time */
  expiryTime: number
  /** Access count */
  accessCount: number
  /** File checksum for validation */
  checksum: string
  /** Memory size in bytes */
  memorySize: number
}

/**
 * Cache configuration for subtitle files
 */
export interface SubtitleFileCacheConfig {
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
  /** Cache only compressed files */
  cacheCompressedOnly: boolean
  /** Preload frequently accessed files */
  preloadFrequent: boolean
}

/**
 * Cache performance metrics
 */
export interface SubtitleFileCacheMetrics {
  /** Cache hit rate */
  hitRate: number
  /** Total requests */
  totalRequests: number
  /** Cache hits */
  hits: number
  /** Cache misses */
  misses: number
  /** Current cache size */
  currentSize: number
  /** Number of cached entries */
  entryCount: number
  /** Average access time */
  averageAccessTime: number
  /** Eviction count */
  evictions: number
  /** Memory pressure warnings */
  memoryPressureCount: number
}

// ============================================================================
// VALIDATION AND SECURITY TYPES
// ============================================================================

/**
 * File path validation result
 */
export interface PathValidationResult {
  /** Is path valid */
  isValid: boolean
  /** Normalized path */
  normalizedPath: string
  /** Validation errors */
  errors: string[]
  /** Security warnings */
  warnings: string[]
  /** Resolved workspace directory */
  workspaceDir: string
  /** Relative path within workspace */
  relativePath: string
}

/**
 * File content validation result
 */
export interface ContentValidationResult {
  /** Is content valid */
  isValid: boolean
  /** Validation errors */
  errors: string[]
  /** Content warnings */
  warnings: string[]
  /** Detected encoding */
  detectedEncoding?: string
  /** File size */
  fileSize: number
  /** Subtitle count */
  subtitleCount?: number
  /** Content checksum */
  checksum: string
}

/**
 * Operation security context
 */
export interface OperationSecurityContext {
  /** Workspace ID being accessed */
  workspaceId: string
  /** Operation type */
  operationType: 'read' | 'write' | 'delete' | 'metadata'
  /** File type being accessed */
  fileType: 'original' | 'modified' | 'session' | 'backup'
  /** Session ID if applicable */
  sessionId?: string
  /** Request timestamp */
  timestamp: number
  /** IP address if network request */
  ipAddress?: string
  /** User agent if applicable */
  userAgent?: string
}

// ============================================================================
// ENHANCED ERROR HANDLING
// ============================================================================

/**
 * Detailed subtitle file error
 */
export interface SubtitleFileError extends Error {
  /** Error code */
  code: SubtitleFileErrorCode
  /** Workspace ID */
  workspaceId?: string
  /** File path */
  filePath?: string
  /** Session ID */
  sessionId?: string
  /** Operation context */
  operation?: string
  /** Additional details */
  details?: {
    expectedChecksum?: string
    actualChecksum?: string
    expectedVersion?: number
    actualVersion?: number
    fileSize?: number
    timestamp?: number
  }
  /** Recovery suggestions */
  recovery?: {
    canRetry: boolean
    suggestedAction: string
    alternativeFiles?: string[]
  }
  /** Stack trace context */
  context?: {
    functionName: string
    lineNumber?: number
    additionalInfo?: Record<string, any>
  }
}

// ============================================================================
// IPC CHANNEL DEFINITIONS
// ============================================================================

/**
 * IPC channel names for subtitle file operations
 */
export const SUBTITLE_IPC_CHANNELS = {
  // Core CRUD operations
  CREATE: 'subtitle:create',
  LOAD: 'subtitle:load', 
  SAVE: 'subtitle:save',
  DELETE: 'subtitle:delete',
  METADATA: 'subtitle:metadata',
  CLEANUP: 'subtitle:cleanup',
  
  // Streaming operations
  STREAM_READ: 'subtitle:stream-read',
  STREAM_WRITE: 'subtitle:stream-write',
  STREAM_PROGRESS: 'subtitle:stream-progress',
  
  // Batch operations
  BATCH_OPERATION: 'subtitle:batch-operation',
  
  // Cache management
  CACHE_GET: 'subtitle:cache-get',
  CACHE_SET: 'subtitle:cache-set',
  CACHE_CLEAR: 'subtitle:cache-clear',
  CACHE_METRICS: 'subtitle:cache-metrics',
  
  // Validation and security
  VALIDATE_PATH: 'subtitle:validate-path',
  VALIDATE_CONTENT: 'subtitle:validate-content',
  SECURITY_CHECK: 'subtitle:security-check',
  
  // Session management
  SESSION_SAVE: 'subtitle:session-save',
  SESSION_LOAD: 'subtitle:session-load',
  SESSION_DELETE: 'subtitle:session-delete',
  SESSION_LIST: 'subtitle:session-list',
  
  // Performance and monitoring
  PERFORMANCE_METRICS: 'subtitle:performance-metrics',
  HEALTH_CHECK: 'subtitle:health-check'
} as const

/**
 * Type mapping for IPC channel parameters
 */
export type SubtitleIPCChannelMap = {
  [SUBTITLE_IPC_CHANNELS.CREATE]: {
    params: CreateSubtitleFileParams
    result: SubtitleFileResult<SubtitleFileMetadata>
  }
  [SUBTITLE_IPC_CHANNELS.LOAD]: {
    params: LoadSubtitleFileParams
    result: SubtitleFileResult<SubtitleFileContent>
  }
  [SUBTITLE_IPC_CHANNELS.SAVE]: {
    params: SaveSubtitleFileParams
    result: SubtitleFileResult<SubtitleFileMetadata>
  }
  [SUBTITLE_IPC_CHANNELS.DELETE]: {
    params: DeleteSubtitleFileParams
    result: SubtitleFileResult<boolean>
  }
  [SUBTITLE_IPC_CHANNELS.METADATA]: {
    params: GetSubtitleMetadataParams
    result: SubtitleFileResult<SubtitleFileMetadata[]>
  }
  [SUBTITLE_IPC_CHANNELS.CLEANUP]: {
    params: CleanupSubtitleFilesParams
    result: SubtitleFileResult<{
      deletedFiles: string[]
      compressedFiles: string[]
      freedSpace: number
    }>
  }
  [SUBTITLE_IPC_CHANNELS.STREAM_READ]: {
    params: StreamSubtitleFileParams
    result: SubtitleFileResult<{
      streamId: string
      totalChunks: number
      chunkSize: number
    }>
  }
  [SUBTITLE_IPC_CHANNELS.STREAM_WRITE]: {
    params: StreamWriteSubtitleParams
    result: SubtitleFileResult<{
      streamId: string
      bytesWritten: number
      isComplete: boolean
    }>
  }
  [SUBTITLE_IPC_CHANNELS.BATCH_OPERATION]: {
    params: BatchSubtitleOperationParams
    result: BatchSubtitleOperationResult
  }
  [SUBTITLE_IPC_CHANNELS.VALIDATE_PATH]: {
    params: {
      workspaceId: string
      path: string
      operation: 'read' | 'write' | 'delete'
    }
    result: PathValidationResult
  }
  [SUBTITLE_IPC_CHANNELS.VALIDATE_CONTENT]: {
    params: {
      content: string | ArrayBuffer
      encoding?: string
    }
    result: ContentValidationResult
  }
}

// ============================================================================
// INTEGRATION WITH EXISTING ELECTRON API
// ============================================================================

/**
 * Extended Electron API for subtitle file operations
 */
export interface SubtitleFileElectronAPI {
  // Core operations
  createSubtitleFile: (params: CreateSubtitleFileParams) => Promise<SubtitleFileResult<SubtitleFileMetadata>>
  loadSubtitleFile: (params: LoadSubtitleFileParams) => Promise<SubtitleFileResult<SubtitleFileContent>>
  saveSubtitleFile: (params: SaveSubtitleFileParams) => Promise<SubtitleFileResult<SubtitleFileMetadata>>
  deleteSubtitleFile: (params: DeleteSubtitleFileParams) => Promise<SubtitleFileResult<boolean>>
  getSubtitleMetadata: (params: GetSubtitleMetadataParams) => Promise<SubtitleFileResult<SubtitleFileMetadata[]>>
  cleanupSubtitleFiles: (params: CleanupSubtitleFilesParams) => Promise<SubtitleFileResult<any>>
  
  // Streaming operations
  streamReadSubtitleFile: (params: StreamSubtitleFileParams) => Promise<SubtitleFileResult<any>>
  streamWriteSubtitleFile: (params: StreamWriteSubtitleParams) => Promise<SubtitleFileResult<any>>
  
  // Batch operations
  batchSubtitleOperation: (params: BatchSubtitleOperationParams) => Promise<BatchSubtitleOperationResult>
  
  // Validation
  validateSubtitlePath: (workspaceId: string, path: string, operation: 'read' | 'write' | 'delete') => Promise<PathValidationResult>
  validateSubtitleContent: (content: string | ArrayBuffer, encoding?: string) => Promise<ContentValidationResult>
  
  // Event listeners for streaming progress
  onSubtitleStreamProgress: (callback: (data: StreamProgressData) => void) => () => void
  onSubtitleOperationComplete: (callback: (data: { operation: string, result: any }) => void) => () => void
  onSubtitleError: (callback: (error: SubtitleFileError) => void) => () => void
}

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

/**
 * Default configuration values for subtitle file operations
 */
export const SUBTITLE_FILE_CONSTANTS = {
  // File size limits
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_SUBTITLE_COUNT: 10000,
  MAX_TEXT_LENGTH: 1000,
  
  // Performance settings
  DEFAULT_CHUNK_SIZE: 64 * 1024, // 64KB
  MAX_CONCURRENT_OPERATIONS: 5,
  DEFAULT_TIMEOUT_MS: 30000, // 30 seconds
  BATCH_TIMEOUT_MS: 300000, // 5 minutes
  
  // Cache settings
  DEFAULT_CACHE_TTL: 300000, // 5 minutes
  MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_CACHE_ENTRIES: 1000,
  
  // File extensions
  SUPPORTED_EXTENSIONS: ['.json', '.srt', '.vtt', '.ass', '.txt'],
  
  // Directory structure
  SUBTITLE_DIR: 'subtitles',
  SESSION_DIR: 'sessions',
  BACKUP_DIR: 'backups',
  TEMP_DIR: 'temp',
  
  // File naming patterns
  ORIGINAL_FILE: 'original.json',
  MODIFIED_FILE: 'modified.json',
  METADATA_FILE: 'metadata.json',
  SESSION_FILE_PATTERN: 'session-{sessionId}.json',
  BACKUP_FILE_PATTERN: 'backup-{timestamp}.json',
  
  // Validation settings
  PATH_MAX_LENGTH: 260,
  FILENAME_MAX_LENGTH: 100,
  INVALID_FILENAME_CHARS: /[<>:"/\\|?*\x00-\x1f]/g,
  
  // Security settings
  ALLOWED_FILE_TYPES: ['json', 'srt', 'vtt', 'txt'],
  MAX_PATH_DEPTH: 10,
  BLOCKED_PATHS: ['..', '.', '__proto__', 'constructor']
} as const

/**
 * Default cache configuration
 */
export const DEFAULT_SUBTITLE_CACHE_CONFIG: SubtitleFileCacheConfig = {
  enabled: true,
  maxSize: SUBTITLE_FILE_CONSTANTS.MAX_CACHE_SIZE,
  maxEntries: SUBTITLE_FILE_CONSTANTS.MAX_CACHE_ENTRIES,
  defaultTTL: SUBTITLE_FILE_CONSTANTS.DEFAULT_CACHE_TTL,
  enableLRU: true,
  cacheCompressedOnly: false,
  preloadFrequent: true
}

// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================

/**
 * Type guard for subtitle file error
 */
export function isSubtitleFileError(error: any): error is SubtitleFileError {
  return error instanceof Error && 
    'code' in error && 
    typeof error.code === 'string' &&
    Object.values(SUBTITLE_FILE_CONSTANTS).includes(error.code as any)
}

/**
 * Type guard for valid workspace ID
 */
export function isValidWorkspaceId(id: any): id is string {
  return typeof id === 'string' && 
    id.length > 0 && 
    /^[a-zA-Z0-9_-]+$/.test(id)
}

/**
 * Type guard for valid session ID
 */
export function isValidSessionId(id: any): id is string {
  return typeof id === 'string' && 
    id.length > 0 && 
    /^session-[0-9]+(-[a-zA-Z0-9]+)?$/.test(id)
}

/**
 * Generate cache key for subtitle file
 */
export function generateSubtitleCacheKey(
  workspaceId: string, 
  fileType: string, 
  sessionId?: string
): string {
  const base = `subtitle:${workspaceId}:${fileType}`
  return sessionId ? `${base}:${sessionId}` : base
}

/**
 * Validate file path for security
 */
export function validateSubtitlePath(workspaceId: string, filePath: string): PathValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Basic validation
  if (!filePath || typeof filePath !== 'string') {
    errors.push('File path is required and must be a string')
  }
  
  if (filePath.length > SUBTITLE_FILE_CONSTANTS.PATH_MAX_LENGTH) {
    errors.push(`File path exceeds maximum length of ${SUBTITLE_FILE_CONSTANTS.PATH_MAX_LENGTH}`)
  }
  
  // Security validation
  for (const blockedPath of SUBTITLE_FILE_CONSTANTS.BLOCKED_PATHS) {
    if (filePath.includes(blockedPath)) {
      errors.push(`File path contains blocked component: ${blockedPath}`)
    }
  }
  
  if (SUBTITLE_FILE_CONSTANTS.INVALID_FILENAME_CHARS.test(filePath)) {
    errors.push('File path contains invalid characters')
  }
  
  // Normalize path
  const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  const workspaceDir = `workspaces/${workspaceId}/subtitles`
  const relativePath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath
  
  return {
    isValid: errors.length === 0,
    normalizedPath,
    errors,
    warnings,
    workspaceDir,
    relativePath
  }
}

/**
 * Create subtitle file error
 */
export function createSubtitleFileError(
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