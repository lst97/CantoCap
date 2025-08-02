/**
 * Subtitle Temporary Storage Types
 * 
 * Comprehensive TypeScript interfaces for the enhanced subtitle auto-save system
 * with IndexedDB persistence, data integrity validation, and session management.
 */

import type { SubtitleData, ProcessingStatistics } from '../../../types'
import type { WorkflowStepId } from './workspace'

// ============================================================================
// CORE TEMPORARY STORAGE TYPES
// ============================================================================

/**
 * Temporary subtitle storage metadata with integrity tracking
 */
export interface SubtitleTempMetadata {
  /** Unique storage identifier */
  id: string
  /** Associated workspace identifier */
  workspaceId: string
  /** Session identifier for grouping related saves */
  sessionId: string
  /** Storage type classification */
  storageType: 'original' | 'modified' | 'session_backup' | 'auto_save'
  /** Creation timestamp */
  createdAt: number
  /** Last modification timestamp */
  lastModified: number
  /** Data size in bytes */
  dataSize: number
  /** Content hash for integrity validation */
  contentHash: string
  /** Metadata hash for structure validation */
  metadataHash: string
  /** Storage format version */
  version: number
  /** Schema version for migration support */
  schemaVersion: number
  /** Compression information */
  compression?: {
    algorithm: 'gzip' | 'lz4' | 'none'
    originalSize: number
    compressedSize: number
    compressionRatio: number
  }
  /** Auto-save specific metadata */
  autoSave?: {
    intervalMs: number
    triggerReason: 'timer' | 'content_change' | 'user_action' | 'session_end'
    changeCount: number
    lastUserAction?: number
  }
  /** Backup chain information */
  backupChain?: {
    parentId?: string
    hasChildren: boolean
    generationLevel: number
    isLatest: boolean
  }
}

/**
 * Temporary subtitle storage content structure
 */
export interface SubtitleTempContent {
  /** Storage metadata reference */
  metadata: Pick<SubtitleTempMetadata, 'id' | 'workspaceId' | 'sessionId' | 'version' | 'schemaVersion'>
  /** Subtitle data */
  subtitles: SubtitleData[]
  /** Content statistics for analysis */
  statistics: SubtitleTempStatistics
  /** Editing context */
  editingContext: {
    /** Current edit position */
    currentPosition?: {
      subtitleIndex: number
      cursorPosition: number
      selectionStart?: number
      selectionEnd?: number
    }
    /** Selected subtitle IDs */
    selectedIds: number[]
    /** Active filters */
    filters: SubtitleTempFilters
    /** View state */
    viewState: {
      scrollPosition: number
      zoomLevel: number
      displayMode: 'list' | 'timeline' | 'waveform'
      showConfidence: boolean
      showTimings: boolean
    }
  }
  /** Change tracking */
  changeTracking: {
    /** Number of changes since last save */
    changeCount: number
    /** Last user interaction timestamp */
    lastUserAction: number
    /** Modified subtitle IDs */
    modifiedIds: Set<number>
    /** Change severity level */
    changeSeverity: 'minor' | 'moderate' | 'major'
  }
  /** Validation state */
  validation: {
    isValid: boolean
    lastValidated: number
    warnings: SubtitleValidationWarning[]
    errors: SubtitleValidationError[]
    integrityScore: number
  }
}

/**
 * Subtitle temporary storage statistics
 */
export interface SubtitleTempStatistics {
  /** Total subtitle count */
  totalCount: number
  /** Modified subtitle count */
  modifiedCount: number
  /** Total content duration */
  totalDuration: number
  /** Content coverage percentage */
  contentCoverage: number
  /** Average confidence score */
  averageConfidence: number
  /** Text statistics */
  textStats: {
    totalCharacters: number
    totalWords: number
    averageWordsPerSubtitle: number
  }
  /** Quality metrics */
  qualityMetrics: {
    highConfidenceCount: number  // > 0.8
    mediumConfidenceCount: number // 0.5-0.8
    lowConfidenceCount: number   // < 0.5
    untranslatedCount: number
    emptyTextCount: number
  }
  /** Timing analysis */
  timingAnalysis: {
    averageDuration: number
    minDuration: number
    maxDuration: number
    gapCount: number
    overlapCount: number
    totalGapDuration: number
  }
}

/**
 * Subtitle temporary filters
 */
export interface SubtitleTempFilters {
  /** Show only modified subtitles */
  showOnlyModified: boolean
  /** Show only untranslated */
  showOnlyUntranslated: boolean
  /** Show only low confidence */
  showOnlyLowConfidence: boolean
  /** Confidence range filter */
  confidenceRange?: {
    min: number
    max: number
  }
  /** Time range filter */
  timeRange?: {
    start: number
    end: number
  }
  /** Text search filter */
  textFilter?: string
  /** Speaker filter */
  speakerFilter?: string
}

/**
 * Validation warning for temporary storage
 */
export interface SubtitleValidationWarning {
  id: string
  subtitleId: number
  type: 'timing_gap' | 'timing_overlap' | 'low_confidence' | 'missing_translation' | 'long_text'
  message: string
  severity: 'low' | 'medium' | 'high'
  autoFixable: boolean
  context?: any
}

/**
 * Validation error for temporary storage
 */
export interface SubtitleValidationError {
  id: string
  subtitleId?: number
  type: 'data_corruption' | 'invalid_timing' | 'hash_mismatch' | 'schema_violation'
  message: string
  critical: boolean
  recoverable: boolean
  context?: any
}

// ============================================================================
// SESSION MANAGEMENT TYPES
// ============================================================================

/**
 * Subtitle editing session with enhanced auto-save support
 */
export interface SubtitleTempSession {
  /** Session identifier */
  sessionId: string
  /** Associated workspace identifier */
  workspaceId: string
  /** Session type */
  sessionType: 'review' | 'editing' | 'validation' | 'export_prep'
  /** Session creation timestamp */
  createdAt: number
  /** Last activity timestamp */
  lastActivity: number
  /** Session state */
  state: SubtitleTempSessionState
  /** Auto-save configuration */
  autoSaveConfig: SubtitleAutoSaveConfig
  /** Session statistics */
  sessionStats: SubtitleTempSessionStats
  /** Backup management */
  backupManagement: {
    maxBackups: number
    retentionHours: number
    lastCleanup: number
    backupIds: string[]
  }
}

/**
 * Session state for temporary storage
 */
export interface SubtitleTempSessionState {
  /** Current active subtitle index */
  activeIndex?: number
  /** Current editing mode */
  editingMode: 'simple' | 'advanced' | 'timeline'
  /** Multi-selection state */
  multiSelect: {
    enabled: boolean
    selectedIds: number[]
    anchorId?: number
  }
  /** Undo/redo state */
  undoRedoState: {
    undoStackSize: number
    redoStackSize: number
    canUndo: boolean
    canRedo: boolean
    lastActionTimestamp: number
  }
  /** Pending changes */
  pendingChanges: {
    hasChanges: boolean
    changeCount: number
    lastChangeTimestamp: number
    needsValidation: boolean
  }
}

/**
 * Auto-save configuration for temporary storage
 */
export interface SubtitleAutoSaveConfig {
  /** Enable auto-save */
  enabled: boolean
  /** Auto-save interval in milliseconds */
  intervalMs: number
  /** Save on idle timeout */
  saveOnIdle: boolean
  /** Idle timeout in milliseconds */
  idleTimeoutMs: number
  /** Save on content change threshold */
  saveOnChangeCount: number
  /** Create incremental backups */
  createBackups: boolean
  /** Maximum number of backups to retain */
  maxBackups: number
  /** Compress saved data */
  compressionEnabled: boolean
  /** Validation before save */
  validateBeforeSave: boolean
}

/**
 * Session statistics for temporary storage
 */
export interface SubtitleTempSessionStats {
  /** Total edits made */
  totalEdits: number
  /** Time spent editing (milliseconds) */
  editingTime: number
  /** Auto-saves triggered */
  autoSavesCount: number
  /** Manual saves */
  manualSavesCount: number
  /** Validation runs */
  validationRuns: number
  /** Error count */
  errorCount: number
  /** Last save timestamp */
  lastSaveTimestamp?: number
  /** Average time between saves */
  averageSaveInterval: number
}

// ============================================================================
// OPERATION AND ERROR TYPES
// ============================================================================

/**
 * Temporary storage operation request
 */
export interface SubtitleTempOperationRequest {
  /** Operation identifier */
  operationId: string
  /** Operation type */
  type: 'save' | 'load' | 'delete' | 'validate' | 'cleanup' | 'backup' | 'restore'
  /** Target workspace ID */
  workspaceId: string
  /** Target session ID */
  sessionId?: string
  /** Target storage ID */
  storageId?: string
  /** Operation parameters */
  parameters?: Record<string, any>
  /** Operation priority */
  priority: 'low' | 'normal' | 'high' | 'critical'
  /** Request timestamp */
  timestamp: number
}

/**
 * Temporary storage operation response
 */
export interface SubtitleTempOperationResponse<T = any> {
  /** Operation identifier */
  operationId: string
  /** Operation success status */
  success: boolean
  /** Response data */
  data?: T
  /** Error information */
  error?: SubtitleTempError
  /** Performance metrics */
  metrics: {
    duration: number
    dataSize?: number
    operationCount?: number
  }
  /** Response timestamp */
  timestamp: number
}

/**
 * Temporary storage error
 */
export interface SubtitleTempError {
  /** Error code */
  code: 'STORAGE_UNAVAILABLE' | 'DATA_CORRUPTION' | 'VALIDATION_FAILED' | 'QUOTA_EXCEEDED' | 'SESSION_EXPIRED' | 'HASH_MISMATCH' | 'SCHEMA_VIOLATION' | 'COMPRESSION_FAILED' | 'OPERATION_CANCELLED' | 'STORAGE_TIMEOUT' | 'WORKSPACE_NOT_READY'
  /** Error message */
  message: string
  /** Associated workspace ID */
  workspaceId?: string
  /** Associated session ID */
  sessionId?: string
  /** Associated storage ID */
  storageId?: string
  /** Error context */
  context?: any
  /** Error timestamp */
  timestamp: number
  /** Error severity */
  severity: 'low' | 'medium' | 'high' | 'critical'
  /** Recovery suggestions */
  recoverySuggestions?: string[]
}

/**
 * Batch operation for multiple temporary storage operations
 */
export interface SubtitleTempBatchOperation<T = any> {
  /** Batch identifier */
  batchId: string
  /** Individual operations */
  operations: SubtitleTempOperationRequest[]
  /** Batch execution mode */
  executionMode: 'parallel' | 'sequential' | 'mixed'
  /** Transaction support */
  transactional: boolean
  /** Progress callback */
  onProgress?: (completed: number, total: number, current?: SubtitleTempOperationResponse<T>) => void
}

/**
 * Batch operation response
 */
export interface SubtitleTempBatchResponse<T = any> {
  /** Batch identifier */
  batchId: string
  /** Overall success status */
  success: boolean
  /** Individual operation responses */
  responses: SubtitleTempOperationResponse<T>[]
  /** Batch-level metrics */
  batchMetrics: {
    totalDuration: number
    successCount: number
    errorCount: number
    dataProcessed: number
  }
  /** Batch timestamp */
  timestamp: number
}

// ============================================================================
// DATABASE RECORD TYPES
// ============================================================================

/**
 * Database record for subtitle temporary storage
 */
export interface SubtitleTempStorageRecord {
  /** Primary key */
  id: string
  /** Associated workspace identifier */
  workspaceId: string
  /** Associated session identifier */
  sessionId: string
  /** Storage type */
  storageType: SubtitleTempMetadata['storageType']
  /** Serialized content data */
  contentData: string
  /** Serialized metadata */
  metadataData: string
  /** Content hash for integrity */
  contentHash: string
  /** Metadata hash for structure validation */
  metadataHash: string
  /** Creation timestamp */
  createdAt: number
  /** Last modification timestamp */
  lastModified: number
  /** Data size in bytes */
  dataSize: number
  /** Version information */
  version: number
  schemaVersion: number
  /** Compression flag */
  isCompressed: boolean
  /** Backup chain information */
  parentId?: string
  generationLevel: number
  isLatest: boolean
}

/**
 * Database record for subtitle editing sessions
 */
export interface SubtitleTempSessionRecord {
  /** Primary key */
  sessionId: string
  /** Associated workspace identifier */
  workspaceId: string
  /** Session type */
  sessionType: SubtitleTempSession['sessionType']
  /** Serialized session data */
  sessionData: string
  /** Session state hash */
  stateHash: string
  /** Creation timestamp */
  createdAt: number
  /** Last activity timestamp */
  lastActivity: number
  /** Session status */
  status: 'active' | 'inactive' | 'expired' | 'archived'
  /** Associated storage IDs */
  storageIds: string[]
  /** Session configuration */
  configData: string
  /** Version information */
  version: number
  schemaVersion: number
}

// ============================================================================
// UTILITY AND CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for subtitle temporary storage
 */
export interface SubtitleTempStorageConfig {
  /** Database configuration */
  database: {
    name: string
    version: number
    maxSize: number
    cleanupInterval: number
  }
  /** Auto-save defaults */
  autoSave: SubtitleAutoSaveConfig
  /** Validation settings */
  validation: {
    enableIntegrityChecks: boolean
    validateOnLoad: boolean
    validateOnSave: boolean
    repairCorruption: boolean
  }
  /** Performance settings */
  performance: {
    enableCompression: boolean
    compressionThreshold: number
    maxConcurrentOperations: number
    operationTimeout: number
  }
  /** Cleanup settings */
  cleanup: {
    maxRetentionDays: number
    maxStorageSize: number
    cleanupBatchSize: number
    enableAutomaticCleanup: boolean
  }
}

/**
 * Storage cleanup result
 */
export interface SubtitleTempCleanupResult {
  /** Cleanup operation ID */
  cleanupId: string
  /** Records processed */
  recordsProcessed: number
  /** Records deleted */
  recordsDeleted: number
  /** Space reclaimed in bytes */
  spaceReclaimed: number
  /** Cleanup duration */
  duration: number
  /** Cleanup timestamp */
  timestamp: number
  /** Any errors encountered */
  errors: SubtitleTempError[]
}

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

export const SUBTITLE_TEMP_STORAGE_CONSTANTS = {
  /** Database configuration */
  DB_NAME: 'CantoCap_SubtitleTemp',
  DB_VERSION: 1,
  SCHEMA_VERSION: 1,

  /** Store names */
  STORES: {
    TEMP_STORAGE: 'subtitle_temp_storage',
    TEMP_SESSIONS: 'subtitle_temp_sessions',
    TEMP_METADATA: 'subtitle_temp_metadata'
  } as const,

  /** Size limits */
  MAX_STORAGE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_RECORD_SIZE: 10 * 1024 * 1024,   // 10MB
  COMPRESSION_THRESHOLD: 1024,          // 1KB
  
  /** Time limits */
  MAX_RETENTION_DAYS: 30,
  DEFAULT_AUTO_SAVE_INTERVAL: 30000,    // 30 seconds
  DEFAULT_IDLE_TIMEOUT: 300000,         // 5 minutes
  
  /** Backup settings */
  DEFAULT_MAX_BACKUPS: 10,
  CLEANUP_INTERVAL: 3600000,            // 1 hour
  
  /** Version information */
  CURRENT_VERSION: 1,
  CURRENT_SCHEMA_VERSION: 1
} as const

export const DEFAULT_SUBTITLE_TEMP_CONFIG: SubtitleTempStorageConfig = {
  database: {
    name: SUBTITLE_TEMP_STORAGE_CONSTANTS.DB_NAME,
    version: SUBTITLE_TEMP_STORAGE_CONSTANTS.DB_VERSION,
    maxSize: SUBTITLE_TEMP_STORAGE_CONSTANTS.MAX_STORAGE_SIZE,
    cleanupInterval: SUBTITLE_TEMP_STORAGE_CONSTANTS.CLEANUP_INTERVAL
  },
  autoSave: {
    enabled: true,
    intervalMs: SUBTITLE_TEMP_STORAGE_CONSTANTS.DEFAULT_AUTO_SAVE_INTERVAL,
    saveOnIdle: true,
    idleTimeoutMs: SUBTITLE_TEMP_STORAGE_CONSTANTS.DEFAULT_IDLE_TIMEOUT,
    saveOnChangeCount: 10,
    createBackups: true,
    maxBackups: SUBTITLE_TEMP_STORAGE_CONSTANTS.DEFAULT_MAX_BACKUPS,
    compressionEnabled: true,
    validateBeforeSave: true
  },
  validation: {
    enableIntegrityChecks: true,
    validateOnLoad: true,
    validateOnSave: true,
    repairCorruption: false
  },
  performance: {
    enableCompression: true,
    compressionThreshold: SUBTITLE_TEMP_STORAGE_CONSTANTS.COMPRESSION_THRESHOLD,
    maxConcurrentOperations: 5,
    operationTimeout: 30000
  },
  cleanup: {
    maxRetentionDays: SUBTITLE_TEMP_STORAGE_CONSTANTS.MAX_RETENTION_DAYS,
    maxStorageSize: SUBTITLE_TEMP_STORAGE_CONSTANTS.MAX_STORAGE_SIZE,
    cleanupBatchSize: 100,
    enableAutomaticCleanup: true
  }
}

// ============================================================================
// ADVANCED TYPE UTILITIES AND GENERIC TYPES
// ============================================================================

/**
 * Generic operation result wrapper for type safety
 */
export type SubtitleTempResult<T> = {
  success: true
  data: T
  metadata?: Partial<SubtitleTempMetadata>
  metrics: SubtitleTempOperationResponse['metrics']
} | {
  success: false
  error: SubtitleTempError
  metrics: SubtitleTempOperationResponse['metrics']
}

/**
 * Utility type for extracting operation result data
 */
export type ExtractResultData<T> = T extends SubtitleTempResult<infer U> ? U : never

/**
 * Utility type for making certain fields optional while preserving type safety
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>

/**
 * Deep partial type for nested configuration updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Extract metadata keys type for type-safe metadata operations
 */
export type MetadataKeys = keyof SubtitleTempMetadata

/**
 * Extract content keys type for type-safe content operations
 */
export type ContentKeys = keyof SubtitleTempContent

/**
 * Session configuration type for auto-save and validation
 */
export type SessionConfigUpdate = DeepPartial<Pick<SubtitleTempSession, 'autoSaveConfig' | 'backupManagement'>>

/**
 * Validation severity levels with improved type safety
 */
export type ValidationSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Storage operation union type for type-safe operation handling
 */
export type StorageOperationType = SubtitleTempOperationRequest['type']

/**
 * Generic filter function type for content filtering
 */
export type ContentFilter<T = SubtitleData> = (item: T, index: number) => boolean

/**
 * Sorting comparator function type for content ordering
 */
export type ContentComparator<T = SubtitleData> = (a: T, b: T) => number

/**
 * Transformer function type for content processing
 */
export type ContentTransformer<T = SubtitleData, U = T> = (item: T) => U

/**
 * Predicate function type for validation and checking
 */
export type ContentPredicate<T = SubtitleData> = (item: T) => boolean

/**
 * Generic pagination parameters
 */
export interface PaginationParams {
  page: number
  limit: number
  offset?: number
}

/**
 * Generic paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

/**
 * Advanced search parameters with type safety
 */
export interface SearchParams {
  query: string
  fields?: (keyof SubtitleData)[]
  caseSensitive?: boolean
  wholeWord?: boolean
  useRegex?: boolean
  maxResults?: number
}

/**
 * Search result with highlighting information
 */
export interface SearchResult {
  item: SubtitleData
  matches: Array<{
    field: keyof SubtitleData
    value: string
    highlights: Array<{
      start: number
      end: number
      text: string
    }>
  }>
  score: number
}

/**
 * Generic cache entry wrapper with advanced metadata
 */
export interface CacheEntry<T> {
  key: string
  data: T
  metadata: {
    createdAt: number
    lastAccessed: number
    accessCount: number
    expiryTime: number
    size: number
    ttl: number
    tags?: string[]
    priority?: 'low' | 'normal' | 'high'
  }
  performance: {
    hitRate: number
    avgAccessTime: number
    totalHits: number
    totalMisses: number
  }
}

/**
 * Configuration validation schema type
 */
export interface ConfigValidationSchema<T> {
  required: (keyof T)[]
  optional: (keyof T)[]
  validators: Partial<Record<keyof T, (value: any) => ValidationResult>>
  transformers?: Partial<Record<keyof T, (value: any) => any>>
}

/**
 * Validation result with enhanced error reporting
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions?: ValidationSuggestion[]
}

/**
 * Enhanced validation error with context
 */
export interface ValidationError {
  field: string
  code: string
  message: string
  value: any
  severity: ValidationSeverity
  context?: Record<string, any>
  fixSuggestion?: string
}

/**
 * Enhanced validation warning with context
 */
export interface ValidationWarning {
  field: string
  code: string
  message: string
  value: any
  severity: Exclude<ValidationSeverity, 'critical'>
  context?: Record<string, any>
  suggestion?: string
}

/**
 * Validation suggestion for auto-fixes
 */
export interface ValidationSuggestion {
  field: string
  currentValue: any
  suggestedValue: any
  reason: string
  confidence: number
  autoApplicable: boolean
}

/**
 * Generic event emitter interface for reactive operations
 */
export interface EventEmitter<T extends Record<string, any[]>> {
  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void
  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void
  emit<K extends keyof T>(event: K, ...args: T[K]): void
  once<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void
}

/**
 * Storage event types for reactive updates
 */
export interface StorageEvents {
  'content-changed': [workspaceId: string, sessionId: string, changeCount: number]
  'auto-save-triggered': [workspaceId: string, sessionId: string, reason: string]
  'validation-completed': [workspaceId: string, sessionId: string, result: ValidationResult]
  'error-occurred': [error: SubtitleTempError]
  'cleanup-completed': [result: SubtitleTempCleanupResult]
  'backup-created': [workspaceId: string, backupId: string]
  'session-expired': [workspaceId: string, sessionId: string]
}

/**
 * Performance monitoring interface
 */
export interface PerformanceMonitor {
  startTimer(operation: string): string
  endTimer(timerId: string): number
  recordMetric(name: string, value: number, tags?: Record<string, string>): void
  getMetrics(operation?: string): PerformanceMetric[]
  clearMetrics(operation?: string): void
}

/**
 * Performance metric data structure
 */
export interface PerformanceMetric {
  id: string
  operation: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'ratio'
  timestamp: number
  tags?: Record<string, string>
  metadata?: Record<string, any>
}

/**
 * Advanced query builder for content filtering
 */
export interface QueryBuilder<T = SubtitleData> {
  where(field: keyof T, operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains', value: any): QueryBuilder<T>
  and(condition: ContentPredicate<T>): QueryBuilder<T>
  or(condition: ContentPredicate<T>): QueryBuilder<T>
  orderBy(field: keyof T, direction?: 'asc' | 'desc'): QueryBuilder<T>
  limit(count: number): QueryBuilder<T>
  offset(count: number): QueryBuilder<T>
  execute(): T[]
  count(): number
}

/**
 * Batch operation builder for type-safe bulk operations
 */
export interface BatchOperationBuilder {
  add(operation: SubtitleTempOperationRequest): BatchOperationBuilder
  addBulk(operations: SubtitleTempOperationRequest[]): BatchOperationBuilder
  configure(options: Partial<SubtitleTempBatchOperation['executionMode']>): BatchOperationBuilder
  validate(): ValidationResult
  execute(): Promise<SubtitleTempBatchResponse>
}

/**
 * Migration helper interface for schema updates
 */
export interface MigrationHelper {
  getCurrentVersion(): number
  getTargetVersion(): number
  needsMigration(data: any): boolean
  migrate(data: any, fromVersion: number, toVersion: number): Promise<any>
  validateMigration(originalData: any, migratedData: any): ValidationResult
}

// ============================================================================
// ENHANCED TYPE GUARDS AND VALIDATION UTILITIES
// ============================================================================

/**
 * Comprehensive type guard for SubtitleTempError with enhanced validation
 */
export function isSubtitleTempError(error: any): error is SubtitleTempError {
  return error && 
    typeof error.code === 'string' && 
    typeof error.message === 'string' &&
    typeof error.timestamp === 'number' &&
    typeof error.severity === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(error.severity)
}

/**
 * Enhanced type guard for SubtitleTempContent with deep validation
 */
export function isSubtitleTempContent(content: any): content is SubtitleTempContent {
  if (!content || typeof content !== 'object') return false
  
  return (
    content.metadata &&
    typeof content.metadata.id === 'string' &&
    typeof content.metadata.workspaceId === 'string' &&
    Array.isArray(content.subtitles) &&
    content.statistics &&
    typeof content.statistics.totalCount === 'number' &&
    content.editingContext &&
    content.changeTracking &&
    typeof content.changeTracking.changeCount === 'number' &&
    content.validation &&
    typeof content.validation.isValid === 'boolean'
  )
}

/**
 * Enhanced type guard for SubtitleTempSession with configuration validation
 */
export function isSubtitleTempSession(session: any): session is SubtitleTempSession {
  if (!session || typeof session !== 'object') return false
  
  return (
    typeof session.sessionId === 'string' &&
    typeof session.workspaceId === 'string' &&
    typeof session.sessionType === 'string' &&
    ['review', 'editing', 'validation', 'export_prep'].includes(session.sessionType) &&
    session.autoSaveConfig &&
    typeof session.autoSaveConfig.enabled === 'boolean' &&
    session.sessionStats &&
    typeof session.sessionStats.totalEdits === 'number'
  )
}

/**
 * Type guard for SubtitleTempMetadata with comprehensive validation
 */
export function isSubtitleTempMetadata(metadata: any): metadata is SubtitleTempMetadata {
  if (!metadata || typeof metadata !== 'object') return false
  
  return (
    typeof metadata.id === 'string' &&
    typeof metadata.workspaceId === 'string' &&
    typeof metadata.sessionId === 'string' &&
    typeof metadata.storageType === 'string' &&
    ['original', 'modified', 'session_backup', 'auto_save'].includes(metadata.storageType) &&
    typeof metadata.createdAt === 'number' &&
    typeof metadata.lastModified === 'number' &&
    typeof metadata.dataSize === 'number' &&
    typeof metadata.contentHash === 'string' &&
    typeof metadata.version === 'number'
  )
}

/**
 * Type guard for SubtitleTempOperationRequest with parameter validation
 */
export function isSubtitleTempOperationRequest(request: any): request is SubtitleTempOperationRequest {
  if (!request || typeof request !== 'object') return false
  
  return (
    typeof request.operationId === 'string' &&
    typeof request.type === 'string' &&
    ['save', 'load', 'delete', 'validate', 'cleanup', 'backup', 'restore'].includes(request.type) &&
    typeof request.workspaceId === 'string' &&
    typeof request.priority === 'string' &&
    ['low', 'normal', 'high', 'critical'].includes(request.priority) &&
    typeof request.timestamp === 'number'
  )
}

/**
 * Type guard for SubtitleTempStorageConfig with nested validation
 */
export function isSubtitleTempStorageConfig(config: any): config is SubtitleTempStorageConfig {
  if (!config || typeof config !== 'object') return false
  
  return (
    config.database &&
    typeof config.database.name === 'string' &&
    typeof config.database.version === 'number' &&
    config.autoSave &&
    typeof config.autoSave.enabled === 'boolean' &&
    config.validation &&
    typeof config.validation.enableIntegrityChecks === 'boolean' &&
    config.performance &&
    typeof config.performance.enableCompression === 'boolean' &&
    config.cleanup &&
    typeof config.cleanup.maxRetentionDays === 'number'
  )
}

/**
 * Type guard for batch operation requests
 */
export function isSubtitleTempBatchOperation(operation: any): operation is SubtitleTempBatchOperation {
  if (!operation || typeof operation !== 'object') return false
  
  return (
    typeof operation.batchId === 'string' &&
    Array.isArray(operation.operations) &&
    operation.operations.every(isSubtitleTempOperationRequest) &&
    typeof operation.executionMode === 'string' &&
    ['parallel', 'sequential', 'mixed'].includes(operation.executionMode) &&
    typeof operation.transactional === 'boolean'
  )
}

/**
 * Type guard for validation results
 */
export function isValidationResult(result: any): result is ValidationResult {
  if (!result || typeof result !== 'object') return false
  
  return (
    typeof result.isValid === 'boolean' &&
    Array.isArray(result.errors) &&
    Array.isArray(result.warnings)
  )
}

/**
 * Generic type guard factory for creating custom type guards
 */
export function createTypeGuard<T>(
  requiredFields: (keyof T)[],
  validators?: Partial<Record<keyof T, (value: any) => boolean>>
): (obj: any) => obj is T {
  return (obj: any): obj is T => {
    if (!obj || typeof obj !== 'object') return false
    
    // Check required fields
    for (const field of requiredFields) {
      if (!(field as string in obj)) return false
    }
    
    // Run custom validators
    if (validators) {
      for (const [field, validator] of Object.entries(validators) as Array<[keyof T, (value: any) => boolean]>) {
        if (field in obj && !validator(obj[field])) return false
      }
    }
    
    return true
  }
}

// ============================================================================
// UTILITY FUNCTIONS WITH ENHANCED TYPE SAFETY
// ============================================================================


/**
 * Calculate secure content hash using Web Crypto API when available
 * DEPRECATED: Use ContentHashManager.calculateOptimizedHash instead for better performance
 */
export async function calculateContentHash(content: any, algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256'): Promise<string> {
  const jsonString = JSON.stringify(content, Object.keys(content).sort())
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(jsonString)
      const hashBuffer = await crypto.subtle.digest(algorithm, data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // Fallback to simple hash
    }
  }
  
  // Fallback implementation for environments without crypto.subtle
  let hash = 0
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Estimate storage size with compression consideration
 */
export function estimateStorageSize(content: any, options?: {
  includeMetadata?: boolean
  compressionRatio?: number
}): { 
  uncompressed: number
  estimated: number
  compressionRatio: number
} {
  const opts = {
    includeMetadata: true,
    compressionRatio: 0.7, // Assume 30% compression
    ...options
  }
  
  const jsonString = JSON.stringify(content)
  const uncompressed = new Blob([jsonString]).size
  const estimated = Math.ceil(uncompressed * opts.compressionRatio)
  
  return {
    uncompressed,
    estimated,
    compressionRatio: opts.compressionRatio
  }
}

/**
 * Advanced cleanup decision with configurable policies
 */
export function shouldCleanup(
  currentSize: number, 
  lastCleanup: number, 
  config: SubtitleTempStorageConfig,
  policy?: {
    sizeThreshold?: number
    timeThreshold?: number
    forceCleanup?: boolean
  }
): {
  shouldCleanup: boolean
  reasons: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
} {
  const pol = {
    sizeThreshold: 0.8,
    timeThreshold: 1.0,
    forceCleanup: false,
    ...policy
  }
  
  const reasons: string[] = []
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
  
  if (pol.forceCleanup) {
    reasons.push('Force cleanup requested')
    severity = 'high'
  }
  
  const sizeRatio = currentSize / config.cleanup.maxStorageSize
  if (sizeRatio > pol.sizeThreshold) {
    reasons.push(`Storage size ${Math.round(sizeRatio * 100)}% of limit`)
    if (sizeRatio > 0.95) severity = 'critical'
    else if (sizeRatio > 0.9) severity = 'high'
    else severity = 'medium'
  }
  
  const timeSinceCleanup = Date.now() - lastCleanup
  const timeRatio = timeSinceCleanup / config.database.cleanupInterval
  if (timeRatio > pol.timeThreshold) {
    reasons.push(`Time since last cleanup: ${Math.round(timeRatio * 100)}% of interval`)
    if (severity === 'low') severity = 'medium'
  }
  
  return {
    shouldCleanup: reasons.length > 0,
    reasons,
    severity
  }
}

/**
 * Deep merge utility with type safety
 */
export function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  const result = { ...target }
  
  for (const key in source) {
    const sourceValue = source[key]
    const targetValue = target[key]
    
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        (result as any)[key] = deepMerge(targetValue, sourceValue)
      } else {
        (result as any)[key] = sourceValue
      }
    } else {
      (result as any)[key] = sourceValue
    }
  }
  
  return result
}

/**
 * Sanitize and validate workspace ID
 */
export function validateWorkspaceId(workspaceId: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  
  if (!workspaceId || typeof workspaceId !== 'string') {
    errors.push({
      field: 'workspaceId',
      code: 'INVALID_TYPE',
      message: 'Workspace ID must be a non-empty string',
      value: workspaceId,
      severity: 'critical'
    })
  } else {
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(workspaceId)) {
      errors.push({
        field: 'workspaceId',
        code: 'INVALID_FORMAT',
        message: 'Workspace ID must be a valid UUID v4 format',
        value: workspaceId,
        severity: 'high',
        fixSuggestion: 'Generate a new UUID v4 identifier'
      })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Sanitize and validate session ID
 */
export function validateSessionId(sessionId: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  
  if (!sessionId || typeof sessionId !== 'string') {
    errors.push({
      field: 'sessionId',
      code: 'INVALID_TYPE',
      message: 'Session ID must be a non-empty string',
      value: sessionId,
      severity: 'critical'
    })
  } else if (sessionId.length < 8) {
    warnings.push({
      field: 'sessionId',
      code: 'SHORT_ID',
      message: 'Session ID is shorter than recommended minimum (8 characters)',
      value: sessionId,
      severity: 'low',
      suggestion: 'Use longer session IDs for better uniqueness'
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Create a configuration validator with schema
 */
export function createConfigValidator<T>(
  schema: ConfigValidationSchema<T>
): (config: any) => ValidationResult {
  return (config: any): ValidationResult => {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const suggestions: ValidationSuggestion[] = []
    
    // Check required fields
    for (const field of schema.required) {
      if (!(field as string in config)) {
        errors.push({
          field: field as string,
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${String(field)}' is missing`,
          value: undefined,
          severity: 'critical'
        })
      }
    }
    
    // Run field validators
    for (const [field, validator] of Object.entries(schema.validators || {}) as Array<[keyof T, (value: any) => ValidationResult]>) {
      if (field in config) {
        const fieldResult = validator(config[field])
        errors.push(...fieldResult.errors.map(e => ({ ...e, field: `${String(field)}.${e.field}` })))
        warnings.push(...fieldResult.warnings.map(w => ({ ...w, field: `${String(field)}.${w.field}` })))
        if (fieldResult.suggestions) {
          suggestions.push(...fieldResult.suggestions.map(s => ({ ...s, field: `${String(field)}.${s.field}` })))
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }
}

/**
 * Performance metrics collector utility
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  const timers = new Map<string, number>()
  const metrics: PerformanceMetric[] = []
  
  return {
    startTimer(operation: string): string {
      const timerId = `${operation}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      timers.set(timerId, performance.now())
      return timerId
    },
    
    endTimer(timerId: string): number {
      const startTime = timers.get(timerId)
      if (!startTime) return 0
      
      const duration = performance.now() - startTime
      timers.delete(timerId)
      return duration
    },
    
    recordMetric(name: string, value: number, tags?: Record<string, string>): void {
      metrics.push({
        id: `metric-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        operation: name,
        value,
        unit: 'count',
        timestamp: Date.now(),
        tags
      })
    },
    
    getMetrics(operation?: string): PerformanceMetric[] {
      if (operation) {
        return metrics.filter(m => m.operation === operation)
      }
      return [...metrics]
    },
    
    clearMetrics(operation?: string): void {
      if (operation) {
        const index = metrics.findIndex(m => m.operation === operation)
        if (index >= 0) metrics.splice(index, 1)
      } else {
        metrics.length = 0
      }
    }
  }
}