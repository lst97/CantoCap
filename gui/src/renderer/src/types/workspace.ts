// Workspace Management Types and Interfaces
import type { AppConfig, ProcessingHistoryEntry, SubtitleData, ProcessingStatistics } from '../../../types'
import type { WorkflowStep } from './workflow'
import type { 
  SubtitleFileMetadata, 
  SubtitleFileContent, 
  SubtitlePersistenceData, 
  SubtitleFileOperations,
  SubtitleFileStatus,
  SubtitleErrorRecovery,
  SubtitleSessionData,
  SubtitleValidationResult
} from './subtitle-persistence'

// ============================================================================
// STEP CONFIGURATION SYSTEM
// ============================================================================

/**
 * Workflow step identifiers for the 5-step processing pipeline
 */
export type WorkflowStepId = 'input-file' | 'config' | 'processing' | 'review' | 'export'

/**
 * Video metadata extracted during file input step
 */
export interface VideoMetadata {
  duration: number
  width?: number
  height?: number
  frameRate?: number
  codec?: string
  bitrate?: number
  aspectRatio?: string
  hasAudio: boolean
  audioCodec?: string
  audioChannels?: number
  fileSize: number
  format: string
}

/**
 * File validation result with detailed feedback
 */
export interface FileValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  fileType: 'video' | 'audio' | 'subtitle' | 'unknown'
  supportedFormats: string[]
  recommendedAction?: string
}

/**
 * Step 1: Input File Configuration
 * Handles file selection, validation, and metadata extraction
 */
export interface InputFileStepConfig {
  /** Selected input file path */
  selectedFile?: string
  /** Imported JSON subtitle file path */
  importedJsonFile?: string
  /** Extracted video metadata */
  videoMetadata?: VideoMetadata
  /** Selected time range for partial processing */
  selectedRange?: {
    start: number
    end: number
    duration: number
  }
  /** File validation results */
  fileValidation?: FileValidationResult
  /** Last input directory for file picker */
  lastInputDirectory?: string
  /** File processing preferences */
  filePreferences?: {
    autoValidate: boolean
    extractMetadata: boolean
    suggestOptimalSettings: boolean
  }
}

/**
 * Step 2: Configuration Settings
 * Core processing configuration and API settings
 */
export interface ConfigStepConfig {
  /** Processing language */
  language?: string
  /** AI model selection */
  model?: string | null
  /** Processing priority level */
  priority?: 'speed' | 'balanced' | 'quality'
  /** Enable speaker detection */
  speakers?: boolean
  /** Generate written-style subtitles */
  written?: boolean
  /** Detect and label music segments */
  music?: boolean
  /** Character set preference */
  charset?: 'traditional' | 'simplified'
  /** Gemini API key */
  geminiKey?: string
  /** Hugging Face token */
  hfToken?: string
  /** Disable Gemini refinement */
  noGeminiRefinement?: boolean
  /** Maximum chunk duration in seconds */
  maxChunkDuration?: number
  /** Video quality for processing */
  videoQuality?: '360p' | '480p' | '720p'
  /** Terminology configuration file path */
  terminologyConfig?: string | null
  /** FFmpeg executable path */
  ffmpegPath?: string | null
  /** Advanced processing options */
  advancedOptions?: {
    customPrompts?: Record<string, string>
    qualityThresholds?: {
      confidence: number
      accuracy: number
    }
    batchSize?: number
    parallelProcessing?: boolean
  }
}

/**
 * Step 3: Processing Configuration
 * Runtime processing settings and monitoring
 */
export interface ProcessingStepConfig {
  /** Enable verbose logging */
  verbose?: boolean
  /** Hardware acceleration preferences */
  hardwareAcceleration?: {
    useGPU: boolean
    preferredDevice?: string
    memoryLimit?: number
  }
  /** Processing quality settings */
  qualitySettings?: {
    targetAccuracy: number
    minimumConfidence: number
    enableQualityChecks: boolean
  }
  /** Monitoring and progress tracking */
  monitoring?: {
    enableDetailedLogging: boolean
    trackPerformanceMetrics: boolean
    saveDebugInfo: boolean
  }
  /** Processing constraints */
  constraints?: {
    maxProcessingTime?: number
    memoryLimit?: number
    cpuUsageLimit?: number
  }
  /** Current processing state (runtime only) */
  runtimeState?: {
    currentStage?: string
    progress?: number
    estimatedTimeRemaining?: number
    processingStatistics?: ProcessingStatistics
  }
}

/**
 * Step 4: Review Configuration
 * Subtitle review and editing preferences with enhanced file persistence
 */
export interface ReviewStepConfig {
  /** Current subtitle data */
  subtitleData?: SubtitleData[]
  /** Subtitle file persistence integration */
  subtitlePersistence?: SubtitlePersistenceData
  /** Current session data */
  currentSession?: SubtitleSessionData
  /** File validation results */
  fileValidation?: SubtitleValidationResult
  /** Editing preferences */
  editingPreferences?: {
    autoSave: boolean
    showConfidenceScores: boolean
    highlightLowConfidence: boolean
    enableSpellCheck: boolean
    defaultEditMode: 'simple' | 'advanced'
    /** Enhanced auto-save configuration */
    autoSaveConfig?: {
      interval: number
      createBackups: boolean
      maxBackups: number
      compressBackups: boolean
    }
  }
  /** Quality validation settings */
  qualityValidation?: {
    checkTimingOverlaps: boolean
    validateTextLength: boolean
    enforceMinimumDuration: boolean
    flagSuspiciousContent: boolean
    /** File integrity validation */
    validateFileIntegrity?: boolean
    /** Automatic validation on save */
    autoValidateOnSave?: boolean
    /** Quality thresholds */
    qualityThresholds?: {
      minimumConfidence: number
      maximumGapDuration: number
      minimumSubtitleDuration: number
    }
  }
  /** Review workflow state */
  reviewState?: {
    completedSegments: number[]
    flaggedIssues: Array<{
      subtitleId: number
      issue: string
      severity: 'low' | 'medium' | 'high'
      resolved: boolean
    }>
    reviewProgress: number
    lastReviewedAt?: number
    /** File operation status */
    fileOperationStatus?: {
      isLoading: boolean
      isSaving: boolean
      lastSaved?: number
      hasUnsavedChanges: boolean
      errorCount: number
    }
  }
  /** Display and UI preferences */
  displayOptions?: {
    fontSize: number
    showOriginalText: boolean
    showTranslation: boolean
    showTimestamps: boolean
    waveformDisplay: boolean
    /** Enhanced display options */
    showFileMetadata?: boolean
    showValidationStatus?: boolean
    showPerformanceMetrics?: boolean
    highlightUnsavedChanges?: boolean
  }
  /** Error recovery configuration */
  errorRecovery?: SubtitleErrorRecovery
  /** Performance monitoring */
  performance?: {
    trackOperations: boolean
    enableProfiling: boolean
    maxMetricsHistory: number
  }
  /** Cache configuration */
  cacheConfig?: {
    enabled: boolean
    maxSize: number
    defaultTTL: number
  }
}

/**
 * Step 5: Export Configuration
 * Output file settings and post-processing
 */
export interface ExportStepConfig {
  /** Output file path */
  outputFile?: string | null
  /** Export format settings */
  formatSettings?: {
    format: 'srt' | 'vtt' | 'json' | 'txt' | 'ass'
    encoding: 'utf8' | 'utf16' | 'gbk'
    includeMetadata: boolean
    includeConfidenceScores: boolean
  }
  /** Post-processing options */
  postProcessing?: {
    removeEmptyLines: boolean
    normalizeWhitespace: boolean
    applyTextFormatting: boolean
    generateSummary: boolean
  }
  /** Quality assurance */
  qualityAssurance?: {
    finalValidation: boolean
    exportChecklist: string[]
    backupOriginal: boolean
  }
  /** Export history */
  exportHistory?: Array<{
    filePath: string
    format: string
    timestamp: number
    fileSize: number
    success: boolean
  }>
  /** Last export directory */
  lastExportDirectory?: string
}

/**
 * Mapping from step IDs to their specific configuration types
 * This enables type-safe step configuration access
 */
export type StepConfigMap = {
  'input-file': InputFileStepConfig
  'config': ConfigStepConfig
  'processing': ProcessingStepConfig
  'review': ReviewStepConfig
  'export': ExportStepConfig
}

/**
 * Generic step configuration container with metadata
 */
export interface StepConfiguration<T = any> {
  /** Step identifier */
  stepId: WorkflowStepId
  /** Associated workspace ID */
  workspaceId: string
  /** Step-specific configuration data */
  data: T
  /** Last modification timestamp */
  lastModified: number
  /** Configuration version for migration support */
  version: number
  /** Optional checksum for integrity validation */
  checksum?: string
  /** Schema version for this step type */
  schemaVersion?: number
}

/**
 * Database record format for step configurations
 */
export interface StepConfigurationRecord {
  /** Composite key: workspace_id + step_id */
  workspace_id: string
  step_id: WorkflowStepId
  /** Serialized configuration data */
  config_data: string
  /** Metadata */
  last_modified: number
  version: number
  schema_version: number
  checksum?: string
  /** Compression flag for large configurations */
  is_compressed?: boolean
}

/**
 * Batch operation for multiple step configuration updates
 */
export interface StepConfigUpdate {
  stepId: WorkflowStepId
  config: Partial<StepConfigMap[WorkflowStepId]>
  merge?: boolean
}

/**
 * Result of batch step configuration operations
 */
export interface BatchResult {
  success: boolean
  updatedSteps: WorkflowStepId[]
  errors: Array<{
    stepId: WorkflowStepId
    error: string
  }>
  totalUpdated: number
  totalErrors: number
}

// ============================================================================
// LEGACY COMPATIBILITY TYPES
// ============================================================================

/**
 * Legacy workspace configuration (backward compatibility)
 * @deprecated Use step-specific configurations instead
 */
export interface LegacyWorkspaceConfig extends AppConfig {
  workspaceId?: string
  lastModified?: number
  version?: number
  /** Flag indicating this is a legacy configuration */
  _isLegacy?: boolean
}

/**
 * Current workspace configuration - maintains compatibility
 */
export interface WorkspaceConfig extends AppConfig {
  // Workspace-specific extensions to base config
  workspaceId?: string
  lastModified?: number
  version?: number
  /** Flag indicating migration to step configs is complete */
  _stepConfigsEnabled?: boolean
}

export interface WorkspaceMetadata {
  description?: string
  tags?: string[]
  color?: string
  icon?: string
  createdBy?: string
  totalProcessingTime?: number
  totalProcessedFiles?: number
  lastBackupDate?: number
  autoSaveEnabled?: boolean
  backupRetentionDays?: number
}

export interface Workspace {
  id: string                          // UUID v4
  name: string                        // Max 100 chars, validated
  createdAt: number                   // Timestamp
  updatedAt: number                   // Timestamp
  lastAccessedAt: number              // For usage tracking
  isActive: boolean                   // Currently selected workspace
  config: WorkspaceConfig             // Complete configuration state
  metadata: WorkspaceMetadata         // Additional workspace information
}

// Session Management Types
export type SessionType = 'subtitle_edit' | 'processing' | 'export' | 'workflow' | 'ui_state'

export interface WorkspaceSession {
  id: string                          // UUID v4
  workspaceId: string                 // Foreign key to workspace
  sessionType: SessionType
  sessionData: any                    // JSON blob for session state
  createdAt: number
  updatedAt: number
  isActive: boolean
}

// Specialized Session Data Types
export interface SubtitleEditSession {
  currentEditIndex?: number
  selectedSubtitles?: number[]
  editHistory?: any[]
  searchState?: {
    query: string
    results: number[]
    currentIndex: number
  }
  filterState?: {
    showOnlyUntranslated: boolean
    showOnlyConfident: boolean
    speakerFilter?: string
  }
}

export interface ProcessingSession {
  currentProcessingConfig?: WorkspaceConfig
  processingHistory?: ProcessingHistoryEntry[]
  lastProcessingResult?: any
  processingMetrics?: {
    averageProcessingTime: number
    successRate: number
    commonErrors: string[]
  }
}

export interface ExportSession {
  lastExportConfig?: any
  exportHistory?: Array<{
    format: string
    filePath: string
    timestamp: number
    fileSize?: number
  }>
  exportPresets?: Array<{
    name: string
    config: any
  }>
}

export interface WorkflowSession {
  workflowSteps?: WorkflowStep[]
  currentStep?: string
  stepHistory?: Array<{
    stepId: string
    timestamp: number
    completionTime?: number
    skipped?: boolean
    error?: string
  }>
}

// ============================================================================
// CACHE LAYER TYPES
// ============================================================================

/**
 * Cached step configuration with metadata
 */
export interface CachedStepConfig<T = any> {
  /** Cached configuration data */
  data: T
  /** Cache expiry timestamp */
  expiryTime: number
  /** Access count for LRU eviction */
  accessCount: number
  /** Dirty flag for unsaved changes */
  isDirty: boolean
  /** Last access timestamp */
  lastAccessed: number
  /** Cache entry size in bytes */
  size?: number
}

/**
 * Step configuration cache store
 */
export interface StepConfigCache {
  [cacheKey: string]: CachedStepConfig
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSize: number
  /** Default TTL in milliseconds */
  defaultTTL: number
  /** Maximum number of entries */
  maxEntries: number
  /** Enable LRU eviction */
  enableLRU: boolean
  /** Enable compression for large entries */
  enableCompression: boolean
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  hitCount: number
  missCount: number
  evictionCount: number
  totalRequests: number
  hitRate: number
  averageAccessTime: number
  cacheSize: number
  entryCount: number
}

// ============================================================================
// MIGRATION AND COMPATIBILITY TYPES
// ============================================================================

/**
 * Migration error details
 */
export interface MigrationError {
  workspaceId: string
  stepId?: WorkflowStepId
  error: string
  code: string
  recoverable: boolean
  retryCount?: number
}

/**
 * Result of step configuration migration
 */
export interface MigrationResult {
  success: boolean
  migratedWorkspaces: string[]
  errors: MigrationError[]
  rollbackData?: {
    workspaceConfigs: Record<string, LegacyWorkspaceConfig>
    backupPath: string
  }
  statistics: {
    totalWorkspaces: number
    successfulMigrations: number
    failedMigrations: number
    skippedWorkspaces: number
    migrationTime: number
  }
}

/**
 * Migration phase definition
 */
export interface MigrationPhase {
  id: string
  name: string
  description: string
  estimatedDuration: number
  isRollbackable: boolean
  stepMigrations?: {
    stepId: WorkflowStepId
    migrationFunction: string
    requiredFields: string[]
  }[]
}

export interface MigrationStatus {
  isInProgress: boolean
  currentPhase?: string
  totalPhases: number
  completedPhases: number
  startTime?: number
  estimatedCompletion?: number
  lastError?: string
  canRollback: boolean
  backupPath?: string
}

export interface MigrationLogEntry {
  id: string
  phase: string
  timestamp: number
  success: boolean
  backupPath?: string
  errorMessage?: string
  dataAffected?: {
    workspaces?: number
    sessions?: number
    configSize?: number
  }
}

// ============================================================================
// ENHANCED DATABASE SCHEMA TYPES
// ============================================================================

/**
 * Enhanced storage schema with step configuration support
 */
export interface EnhancedWorkspaceStorageSchema {
  version: 2
  stores: {
    /** Core workspace data */
    workspaces: {
      keyPath: 'id'
      data: Workspace
      indexes: ['isActive', 'lastAccessedAt', 'createdAt']
    }
    /** Legacy workspace sessions */
    workspace_sessions: {
      keyPath: 'id'
      data: WorkspaceSession
      indexes: ['workspaceId', 'sessionType', 'isActive']
    }
    /** Step-specific configurations */
    step_configurations: {
      keyPath: ['workspace_id', 'step_id']
      data: StepConfigurationRecord
      indexes: ['workspace_id', 'step_id', 'last_modified']
    }
    /** Configuration cache */
    step_config_cache: {
      keyPath: 'cache_key'
      data: {
        cache_key: string
        config_data: string
        expiry_time: number
        access_count: number
        is_dirty: boolean
        last_accessed: number
        size: number
      }
      indexes: ['expiry_time', 'last_accessed', 'access_count']
    }
    /** Migration tracking */
    migration_log: {
      keyPath: 'id'
      data: MigrationLogEntry
      indexes: ['phase', 'timestamp', 'success']
    }
    /** Performance metrics */
    performance_metrics: {
      keyPath: 'id'
      data: EnhancedWorkspacePerformanceMetrics
      indexes: ['operationType', 'timestamp', 'workspaceId']
    }
  }
}

/**
 * Legacy storage schema for backward compatibility
 */
export interface WorkspaceStorageSchema {
  version: 1
  stores: {
    workspaces: {
      keyPath: 'id'
      data: Workspace
    }
    workspace_sessions: {
      keyPath: 'id'
      data: WorkspaceSession
    }
    migration_log: {
      keyPath: 'id'
      data: MigrationLogEntry
    }
  }
}

/**
 * Enhanced performance metrics with step-specific tracking
 */
export interface EnhancedWorkspacePerformanceMetrics extends WorkspacePerformanceMetrics {
  /** Step-specific operation details */
  stepId?: WorkflowStepId
  /** Operation category */
  category: 'workspace' | 'step_config' | 'cache' | 'migration'
  /** Cache performance data */
  cacheMetrics?: {
    hitRate: number
    accessTime: number
    cacheSize: number
  }
  /** Step configuration size */
  configSize?: number
  /** Number of configurations affected */
  configCount?: number
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Step configuration specific errors
 */
export interface StepConfigError extends Error {
  code: 
    | 'STEP_CONFIG_NOT_FOUND'
    | 'STEP_CONFIG_INVALID'
    | 'STEP_CONFIG_MIGRATION_FAILED'
    | 'STEP_CONFIG_CACHE_ERROR'
    | 'STEP_CONFIG_SERIALIZATION_ERROR'
    | 'STEP_CONFIG_VALIDATION_ERROR'
    | 'STEP_CONFIG_CORRUPTED'
  workspaceId?: string
  stepId?: WorkflowStepId
  configData?: any
  validationErrors?: string[]
  recoveryAction?: string
}

/**
 * Enhanced workspace error with step configuration support
 */
export interface WorkspaceError extends Error {
  code: 
    | 'WORKSPACE_NOT_FOUND' 
    | 'MIGRATION_FAILED' 
    | 'STORAGE_UNAVAILABLE' 
    | 'VALIDATION_ERROR' 
    | 'BACKUP_FAILED'
    | 'STEP_CONFIG_ERROR'
    | 'CACHE_ERROR'
    | 'BATCH_OPERATION_FAILED'
  workspaceId?: string
  phase?: string
  details?: any
  stepConfigError?: StepConfigError
  affectedSteps?: WorkflowStepId[]
  recoverable?: boolean
}

// Validation Types
export interface WorkspaceValidationRule {
  field: keyof Workspace
  validator: (value: any) => boolean
  message: string
}

export interface WorkspaceValidationResult {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    value: any
  }>
  warnings: Array<{
    field: string
    message: string
    value: any
  }>
}

// Performance Monitoring Types
export interface WorkspacePerformanceMetrics {
  operationType: 'create' | 'switch' | 'update' | 'delete' | 'backup' | 'migrate'
  duration: number
  success: boolean
  workspaceId?: string
  dataSize?: number
  error?: string
  timestamp: number
}

// Backup and Recovery Types
export interface WorkspaceBackup {
  id: string
  workspaceId: string
  backupPath: string
  createdAt: number
  size: number
  isAutomatic: boolean
  description?: string
  configSnapshot: WorkspaceConfig
  isCorrupted?: boolean
  restoredAt?: number
}

export interface BackupStrategy {
  enabled: boolean
  frequency: 'manual' | 'on_change' | 'hourly' | 'daily'
  retentionDays: number
  maxBackups: number
  compressionEnabled: boolean
  includesSessions: boolean
}

// Conflict Resolution Types
export interface ConfigConflict {
  field: keyof WorkspaceConfig
  localValue: any
  remoteValue: any
  timestamp: number
  resolutionStrategy: 'local' | 'remote' | 'merge' | 'manual'
}

export interface ConflictResolution {
  conflicts: ConfigConflict[]
  resolutionStrategy: 'auto' | 'manual'
  resolvedAt?: number
  resolvedBy?: 'user' | 'system'
}

// Auto-Save Types
export interface AutoSaveConfig {
  enabled: boolean
  debounceMs: number
  maxRetries: number
  batchSize: number
  includesSessions: boolean
}

export interface AutoSaveStatus {
  isEnabled: boolean
  lastSaveTime?: number
  pendingSaves: number
  failedSaves: number
  nextScheduledSave?: number
}

// Import/Export Types
export interface WorkspaceExportData {
  workspace: Workspace
  sessions: WorkspaceSession[]
  backups: WorkspaceBackup[]
  metadata: {
    exportedAt: number
    version: string
    format: 'full' | 'config_only' | 'sessions_only'
  }
}

export interface WorkspaceImportOptions {
  overwriteExisting: boolean
  includesSessions: boolean
  includesBackups: boolean
  validateIntegrity: boolean
}

// ============================================================================
// ENHANCED STORE TYPES
// ============================================================================

/**
 * Enhanced workspace store state with step configuration support
 */
export interface EnhancedWorkspaceStoreState extends WorkspaceStoreState {
  // Step Configuration State
  stepConfigCache: StepConfigCache
  cacheMetrics: CacheMetrics
  cacheConfig: CacheConfig
  
  // Enhanced Migration State
  stepConfigMigrationStatus: {
    isEnabled: boolean
    inProgress: boolean
    completedWorkspaces: string[]
    failedWorkspaces: string[]
    lastMigrationResult?: MigrationResult
  }
  
  // Empty State Management
  hasAnyWorkspace: boolean
  workspaceCount: number
  
  // Performance Tracking
  enhancedMetrics: EnhancedWorkspacePerformanceMetrics[]
}

/**
 * Original workspace store state for backward compatibility
 */
export interface WorkspaceStoreState {
  // Core State
  currentWorkspace: Workspace | null
  availableWorkspaces: Workspace[]
  isInitialized: boolean
  isLoading: boolean
  
  // Migration State
  migrationStatus: MigrationStatus | null
  
  // Performance Monitoring
  performanceMetrics: WorkspacePerformanceMetrics[]
  
  // Auto-Save State
  autoSaveStatus: AutoSaveStatus
  
  // Error State
  lastError: WorkspaceError | null
}

/**
 * Enhanced workspace store actions with step configuration management
 */
export interface EnhancedWorkspaceStoreActions extends WorkspaceStoreActions {
  // ============================================================================
  // STEP CONFIGURATION MANAGEMENT
  // ============================================================================
  
  /**
   * Get step-specific configuration with type safety
   * @param workspaceId - Target workspace ID
   * @param stepId - Step identifier
   * @returns Promise resolving to step configuration or null
   */
  getStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
    workspaceId: string, 
    stepId: K
  ): Promise<T | null>
  
  /**
   * Set step-specific configuration with type safety
   * @param workspaceId - Target workspace ID
   * @param stepId - Step identifier
   * @param config - Partial configuration to merge/set
   * @param options - Update options
   */
  setStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
    workspaceId: string,
    stepId: K, 
    config: Partial<T>,
    options?: {
      merge?: boolean
      skipValidation?: boolean
      skipCache?: boolean
      createBackup?: boolean
    }
  ): Promise<void>
  
  /**
   * Get multiple step configurations efficiently
   * @param workspaceId - Target workspace ID
   * @param stepIds - Array of step identifiers
   * @returns Promise resolving to record of step configurations
   */
  getMultipleStepConfigs(
    workspaceId: string,
    stepIds: WorkflowStepId[]
  ): Promise<Partial<Record<WorkflowStepId, any>>>
  
  /**
   * Batch update multiple step configurations
   * @param workspaceId - Target workspace ID
   * @param updates - Array of step configuration updates
   * @returns Promise resolving to batch operation result
   */
  batchUpdateStepConfigs(
    workspaceId: string,
    updates: StepConfigUpdate[]
  ): Promise<BatchResult>
  
  /**
   * Reset step configuration to defaults
   * @param workspaceId - Target workspace ID
   * @param stepId - Step identifier
   */
  resetStepConfig<K extends WorkflowStepId>(
    workspaceId: string,
    stepId: K
  ): Promise<void>
  
  /**
   * Validate step configuration
   * @param workspaceId - Target workspace ID
   * @param stepId - Step identifier
   * @param config - Configuration to validate
   */
  validateStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
    workspaceId: string,
    stepId: K,
    config: Partial<T>
  ): Promise<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>
  
  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================
  
  /**
   * Clear step configuration cache
   * @param workspaceId - Optional workspace ID to clear specific workspace cache
   * @param stepId - Optional step ID to clear specific step cache
   */
  clearStepConfigCache(workspaceId?: string, stepId?: WorkflowStepId): Promise<void>
  
  /**
   * Refresh cache from database
   * @param workspaceId - Target workspace ID
   * @param stepIds - Optional array of step IDs to refresh
   */
  refreshStepConfigCache(
    workspaceId: string, 
    stepIds?: WorkflowStepId[]
  ): Promise<void>
  
  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): CacheMetrics
  
  /**
   * Configure cache settings
   * @param config - New cache configuration
   */
  configureCaching(config: Partial<CacheConfig>): void
  
  // ============================================================================
  // EMPTY STATE MANAGEMENT
  // ============================================================================
  
  /**
   * Check if any workspace exists
   * @returns Boolean indicating if workspaces exist
   */
  hasAnyWorkspace(): boolean
  
  /**
   * Get total workspace count
   * @returns Number of available workspaces
   */
  getWorkspaceCount(): number
  
  /**
   * Check if step configurations are enabled for workspace
   * @param workspaceId - Target workspace ID
   */
  isStepConfigEnabled(workspaceId: string): Promise<boolean>
  
  // ============================================================================
  // MIGRATION SUPPORT
  // ============================================================================
  
  /**
   * Migrate workspace to step-specific configurations
   * @param workspaceId - Optional workspace ID, migrates all if not provided
   */
  migrateToStepConfigs(workspaceId?: string): Promise<MigrationResult>
  
  /**
   * Check if migration is needed
   * @param workspaceId - Target workspace ID
   */
  needsStepConfigMigration(workspaceId: string): Promise<boolean>
  
  /**
   * Rollback step configuration migration
   * @param workspaceId - Target workspace ID
   * @param rollbackData - Rollback data from migration result
   */
  rollbackStepConfigMigration(
    workspaceId: string,
    rollbackData: MigrationResult['rollbackData']
  ): Promise<void>
  
  // ============================================================================
  // SUBTITLE FILE PERSISTENCE OPERATIONS
  // ============================================================================
  
  /**
   * Get subtitle file operations interface for workspace
   * @param workspaceId - Target workspace ID
   * @returns Promise resolving to subtitle file operations interface
   */
  getSubtitleFileOperations(workspaceId: string): Promise<SubtitleFileOperations>
  
  /**
   * Load subtitle file content
   * @param workspaceId - Target workspace ID
   * @param fileId - Subtitle file identifier
   * @param options - Load options
   */
  loadSubtitleFile(
    workspaceId: string,
    fileId: string,
    options?: { useCache?: boolean; validateIntegrity?: boolean }
  ): Promise<SubtitleFileContent | null>
  
  /**
   * Save subtitle file content
   * @param workspaceId - Target workspace ID
   * @param fileId - Subtitle file identifier
   * @param content - Subtitle content to save
   * @param options - Save options
   */
  saveSubtitleFile(
    workspaceId: string,
    fileId: string,
    content: SubtitleFileContent,
    options?: {
      createBackup?: boolean
      validateAfter?: boolean
      compress?: boolean
      updateSession?: boolean
    }
  ): Promise<void>
  
  /**
   * Create new subtitle file
   * @param workspaceId - Target workspace ID
   * @param content - Initial subtitle content
   * @param options - Creation options
   */
  createSubtitleFile(
    workspaceId: string,
    content: SubtitleFileContent,
    options?: {
      fileType?: 'original' | 'modified' | 'session_backup'
      compress?: boolean
      validate?: boolean
    }
  ): Promise<string>
  
  /**
   * Delete subtitle file
   * @param workspaceId - Target workspace ID
   * @param fileId - File identifier to delete
   * @param options - Deletion options
   */
  deleteSubtitleFile(
    workspaceId: string,
    fileId: string,
    options?: { permanent?: boolean; createBackup?: boolean }
  ): Promise<void>
  
  /**
   * Validate subtitle file
   * @param workspaceId - Target workspace ID
   * @param fileId - File identifier to validate
   */
  validateSubtitleFile(
    workspaceId: string,
    fileId: string
  ): Promise<SubtitleValidationResult>
  
  /**
   * Get subtitle file metadata
   * @param workspaceId - Target workspace ID
   * @param fileId - File identifier
   */
  getSubtitleFileMetadata(
    workspaceId: string,
    fileId: string
  ): Promise<SubtitleFileMetadata | null>
  
  /**
   * Create subtitle file backup
   * @param workspaceId - Target workspace ID
   * @param fileId - File identifier to backup
   * @param description - Optional backup description
   */
  createSubtitleBackup(
    workspaceId: string,
    fileId: string,
    description?: string
  ): Promise<string>
  
  /**
   * Restore subtitle file from backup
   * @param workspaceId - Target workspace ID
   * @param backupId - Backup identifier
   */
  restoreSubtitleBackup(
    workspaceId: string,
    backupId: string
  ): Promise<void>
  
  /**
   * Get subtitle file operation status
   * @param workspaceId - Target workspace ID
   */
  getSubtitleFileStatus(workspaceId: string): Promise<SubtitleFileStatus>
  
  /**
   * Update subtitle session data
   * @param workspaceId - Target workspace ID
   * @param sessionData - Session data to update
   */
  updateSubtitleSession(
    workspaceId: string,
    sessionData: Partial<SubtitleSessionData>
  ): Promise<void>
  
  /**
   * Get subtitle session data
   * @param workspaceId - Target workspace ID
   * @param sessionType - Type of session to retrieve
   */
  getSubtitleSession(
    workspaceId: string,
    sessionType?: SubtitleSessionData['sessionType']
  ): Promise<SubtitleSessionData | null>
  
  /**
   * Clear subtitle file cache
   * @param workspaceId - Optional workspace ID to clear specific workspace cache
   * @param fileId - Optional file ID to clear specific file cache
   */
  clearSubtitleFileCache(workspaceId?: string, fileId?: string): Promise<void>
  
  /**
   * Get subtitle file performance metrics
   * @param workspaceId - Optional workspace ID to filter metrics
   */
  getSubtitleFilePerformanceMetrics(workspaceId?: string): Promise<any[]>
  
  // ============================================================================
  // ENHANCED PERFORMANCE MONITORING
  // ============================================================================
  
  /**
   * Get enhanced performance metrics with step configuration data
   */
  getEnhancedPerformanceMetrics(): EnhancedWorkspacePerformanceMetrics[]
  
  /**
   * Clear enhanced performance metrics
   */
  clearEnhancedPerformanceMetrics(): void
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Export step configurations
   * @param workspaceId - Target workspace ID
   * @param stepIds - Optional array of step IDs to export
   */
  exportStepConfigs(
    workspaceId: string,
    stepIds?: WorkflowStepId[]
  ): Promise<Record<WorkflowStepId, any>>
  
  /**
   * Import step configurations
   * @param workspaceId - Target workspace ID
   * @param stepConfigs - Step configurations to import
   * @param options - Import options
   */
  importStepConfigs(
    workspaceId: string,
    stepConfigs: Partial<Record<WorkflowStepId, any>>,
    options?: {
      overwrite?: boolean
      skipValidation?: boolean
      createBackup?: boolean
    }
  ): Promise<BatchResult>
}

export interface WorkspaceStoreActions {
  // Initialization
  initializeWorkspaces: () => Promise<void>
  
  // Core Workspace Operations
  createWorkspace: (name: string, config?: Partial<WorkspaceConfig>) => Promise<Workspace>
  switchWorkspace: (workspaceId: string) => Promise<void>
  updateWorkspaceConfig: (workspaceId: string, config: Partial<WorkspaceConfig>) => Promise<void>
  updateWorkspaceMetadata: (workspaceId: string, metadata: Partial<WorkspaceMetadata>) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  duplicateWorkspace: (workspaceId: string, newName: string) => Promise<Workspace>
  
  // Session Management
  saveWorkspaceSession: (sessionType: SessionType, sessionData: any) => Promise<void>
  loadWorkspaceSession: (workspaceId: string, sessionType: SessionType) => Promise<any>
  deleteWorkspaceSession: (workspaceId: string, sessionType: SessionType) => Promise<void>
  
  // Auto-Save & Persistence
  autoSaveCurrentWorkspace: () => Promise<void>
  enableAutoSave: (config?: Partial<AutoSaveConfig>) => void
  disableAutoSave: () => void
  
  // Migration Operations
  startMigration: () => Promise<{ success: boolean, backupPath: string }>
  completeMigration: () => Promise<{ success: boolean }>
  rollbackMigration: () => Promise<{ success: boolean }>
  getMigrationStatus: () => Promise<MigrationStatus>
  
  // Backup and Recovery
  createBackup: (workspaceId: string, description?: string) => Promise<WorkspaceBackup>
  restoreFromBackup: (backupId: string) => Promise<void>
  listBackups: (workspaceId: string) => Promise<WorkspaceBackup[]>
  deleteBackup: (backupId: string) => Promise<void>
  
  // Import/Export
  exportWorkspace: (workspaceId: string, format: 'full' | 'config_only' | 'sessions_only') => Promise<WorkspaceExportData>
  importWorkspace: (data: WorkspaceExportData, options: WorkspaceImportOptions) => Promise<Workspace>
  
  // Validation and Integrity
  validateWorkspace: (workspace: Workspace) => WorkspaceValidationResult
  repairWorkspace: (workspaceId: string) => Promise<{ success: boolean, issues: string[] }>
  
  // Performance and Monitoring
  getPerformanceMetrics: () => WorkspacePerformanceMetrics[]
  clearPerformanceMetrics: () => void
  
  // Error Handling
  clearError: () => void
  handleError: (error: WorkspaceError) => void
}

// ============================================================================
// FINAL STORE TYPE DEFINITIONS
// ============================================================================

/**
 * Enhanced workspace store combining state and actions
 * This is the main store type that should be used going forward
 */
export type EnhancedWorkspaceStore = EnhancedWorkspaceStoreState & EnhancedWorkspaceStoreActions

/**
 * Legacy workspace store for backward compatibility
 * @deprecated Use EnhancedWorkspaceStore instead
 */
export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions

// ============================================================================
// UTILITY TYPES AND HELPERS
// ============================================================================

/**
 * Options for creating a new workspace
 */
export type WorkspaceCreateOptions = {
  name: string
  config?: Partial<WorkspaceConfig>
  metadata?: Partial<WorkspaceMetadata>
  copyFrom?: string // workspaceId to copy settings from
  enableStepConfigs?: boolean // Enable step-specific configurations
  initialStepConfigs?: Partial<StepConfigMap> // Initial step configurations
}

/**
 * Options for switching workspaces
 */
export type WorkspaceSwitchOptions = {
  saveCurrentState?: boolean
  loadSessions?: boolean
  validateIntegrity?: boolean
  loadStepConfigs?: boolean // Load step-specific configurations
  cacheStepConfigs?: boolean // Cache configurations for performance
}

/**
 * Options for updating workspaces
 */
export type WorkspaceUpdateOptions = {
  skipValidation?: boolean
  skipAutoSave?: boolean
  createBackup?: boolean
  updateStepConfigs?: boolean // Also update step configurations
  batchUpdate?: boolean // Use batch operations for better performance
}

/**
 * Type-safe step configuration getter utility type
 */
export type StepConfigGetter = {
  <K extends WorkflowStepId>(stepId: K): Promise<StepConfigMap[K] | null>
}

/**
 * Type-safe step configuration setter utility type
 */
export type StepConfigSetter = {
  <K extends WorkflowStepId>(stepId: K, config: Partial<StepConfigMap[K]>): Promise<void>
}

/**
 * Default step configurations factory type
 */
export type StepConfigDefaults = {
  readonly [K in WorkflowStepId]: () => StepConfigMap[K]
}

/**
 * Step configuration validation result
 */
export type StepConfigValidationResult<K extends WorkflowStepId> = {
  stepId: K
  isValid: boolean
  errors: Array<{
    field: keyof StepConfigMap[K]
    message: string
    value: any
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    field: keyof StepConfigMap[K]
    message: string
    value: any
  }>
  suggestions?: Array<{
    field: keyof StepConfigMap[K]
    suggestion: string
    autoApply: boolean
  }>
}

/**
 * Batch validation result for multiple step configurations
 */
export type BatchValidationResult = {
  overallValid: boolean
  stepResults: Partial<Record<WorkflowStepId, StepConfigValidationResult<WorkflowStepId>>>
  totalErrors: number
  totalWarnings: number
  criticalErrors: WorkflowStepId[]
}

/**
 * Step configuration migration mapping
 */
export type StepConfigMigrationMap = {
  [K in WorkflowStepId]: {
    fromLegacy: (legacyConfig: LegacyWorkspaceConfig) => Partial<StepConfigMap[K]>
    toLegacy: (stepConfig: StepConfigMap[K]) => Partial<LegacyWorkspaceConfig>
    validator: (config: Partial<StepConfigMap[K]>) => StepConfigValidationResult<K>
    defaults: () => StepConfigMap[K]
  }
}

/**
 * Performance optimization hint type
 */
export type PerformanceHint = 
  | 'cache_miss_frequent'
  | 'large_config_size'
  | 'slow_validation'
  | 'memory_pressure'
  | 'batch_opportunity'
  | 'migration_needed'

/**
 * Configuration health check result
 */
export type ConfigHealthCheck = {
  workspaceId: string
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  stepHealth: Record<WorkflowStepId, 'healthy' | 'warning' | 'error' | 'missing'>
  issues: Array<{
    stepId?: WorkflowStepId
    severity: 'low' | 'medium' | 'high' | 'critical'
    issue: string
    suggestion: string
    autoFixAvailable: boolean
  }>
  performanceHints: PerformanceHint[]
  migrationRecommended: boolean
  lastHealthCheck: number
}

// ============================================================================
// REACT HOOK INTEGRATION TYPES
// ============================================================================

/**
 * Options for step configuration hooks
 */
export interface UseStepConfigOptions {
  /** Enable automatic validation on changes */
  autoValidate?: boolean
  /** Debounce time for auto-save in milliseconds */
  debounceMs?: number
  /** Enable real-time synchronization */
  syncEnabled?: boolean
  /** Merge strategy for updates */
  mergeStrategy?: 'merge' | 'replace'
  /** Enable optimistic updates */
  optimisticUpdates?: boolean
  /** Custom error handler */
  onError?: (error: WorkspaceError | StepConfigError) => void
  /** Custom validation success handler */
  onValidationSuccess?: () => void
  /** Custom validation error handler */
  onValidationError?: (result: StepConfigValidationResult<any>) => void
}

/**
 * Enhanced validation result with React hook integration
 */
export interface ReactValidationResult<K extends WorkflowStepId> extends StepConfigValidationResult<K> {
  /** Whether validation is currently in progress */
  isValidating?: boolean
  /** Timestamp of last validation */
  lastValidated?: number
  /** Auto-applied suggestions count */
  autoAppliedSuggestions?: number
}

/**
 * Step configuration hook return type
 */
export interface StepConfigHookResult<T> {
  /** Current configuration data */
  config: T | null
  /** Loading state */
  isLoading: boolean
  /** Saving state */
  isSaving: boolean
  /** Validation state */
  isValidating: boolean
  /** Current validation result */
  validationResult: StepConfigValidationResult<any> | null
  /** Last error that occurred */
  error: WorkspaceError | StepConfigError | null
  /** Whether the configuration has unsaved changes */
  isDirty: boolean
  /** Cache hit indicator */
  fromCache: boolean
  /** Last update timestamp */
  lastUpdated: number | null
  
  // Actions
  /** Update configuration (partial or complete) */
  updateConfig: (updates: Partial<T>) => Promise<void>
  /** Replace entire configuration */
  replaceConfig: (newConfig: T) => Promise<void>
  /** Reset to default configuration */
  resetToDefault: () => Promise<void>
  /** Force refresh from database */
  refresh: () => Promise<void>
  /** Validate current configuration */
  validate: () => Promise<StepConfigValidationResult<any>>
  /** Save changes immediately */
  save: () => Promise<void>
  /** Clear error state */
  clearError: () => void
  /** Revert unsaved changes */
  revert: () => Promise<void>
}

/**
 * Enhanced hook result for ReviewStepConfig with subtitle persistence
 */
export interface ReviewStepConfigHookResult extends StepConfigHookResult<ReviewStepConfig> {
  /** Subtitle file operations interface */
  subtitleFiles: SubtitleFileOperations
  /** Subtitle file operation status */
  subtitleFileStatus: SubtitleFileStatus | null
  /** Current subtitle session */
  currentSession: SubtitleSessionData | null
  /** File validation results */
  fileValidation: SubtitleValidationResult | null
  
  // Enhanced subtitle-specific actions
  /** Load subtitle file */
  loadSubtitleFile: (fileId: string, options?: { useCache?: boolean }) => Promise<SubtitleFileContent | null>
  /** Save subtitle file */
  saveSubtitleFile: (fileId: string, content: SubtitleFileContent, options?: { createBackup?: boolean }) => Promise<void>
  /** Create new subtitle file */
  createSubtitleFile: (content: SubtitleFileContent, fileType?: 'original' | 'modified') => Promise<string>
  /** Delete subtitle file */
  deleteSubtitleFile: (fileId: string, options?: { permanent?: boolean }) => Promise<void>
  /** Validate subtitle file */
  validateSubtitleFile: (fileId: string) => Promise<SubtitleValidationResult>
  /** Create file backup */
  createBackup: (fileId: string, description?: string) => Promise<string>
  /** Restore from backup */
  restoreBackup: (backupId: string) => Promise<void>
  /** Update current session */
  updateSession: (sessionData: Partial<SubtitleSessionData>) => Promise<void>
  /** Clear subtitle cache */
  clearSubtitleCache: (fileId?: string) => Promise<void>
  /** Get performance metrics */
  getPerformanceMetrics: () => Promise<any[]>
  
  // File operation states
  /** Whether subtitle files are loading */
  isLoadingFiles: boolean
  /** Whether subtitle files are being saved */
  isSavingFiles: boolean
  /** Whether subtitle files have unsaved changes */
  hasUnsavedFileChanges: boolean
  /** Last file operation error */
  fileError: SubtitleFileError | null
  /** Clear file error state */
  clearFileError: () => void
}

/**
 * Subtitle persistence hook options
 */
export interface UseSubtitlePersistenceOptions extends UseStepConfigOptions {
  /** Enable automatic file operations */
  autoFileOperations?: boolean
  /** Auto-save interval for files */
  fileAutoSaveInterval?: number
  /** Enable file validation on load */
  validateOnLoad?: boolean
  /** Enable cache for file operations */
  enableFileCache?: boolean
  /** Maximum file size for automatic operations */
  maxAutoFileSize?: number
  /** Custom file error handler */
  onFileError?: (error: SubtitleFileError) => void
  /** Custom file operation success handler */
  onFileOperationSuccess?: (operation: string, result: any) => void
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean
}

/**
 * Workspace requirement detection result
 */
export interface WorkspaceRequirement {
  /** Whether any workspace exists */
  hasAnyWorkspace: boolean
  /** Current workspace count */
  workspaceCount: number
  /** Whether a workspace is currently active */
  hasActiveWorkspace: boolean
  /** Current active workspace ID */
  activeWorkspaceId: string | null
  /** Whether the workspace system is initialized */
  isInitialized: boolean
  /** Whether workspaces are currently loading */
  isLoading: boolean
  /** Whether step configurations are enabled for current workspace */
  stepConfigsEnabled: boolean
  /** Last error if any */
  error: WorkspaceError | null
}

// ============================================================================
// ENHANCED CONSTANTS
// ============================================================================

export const WORKSPACE_CONSTANTS = {
  // Legacy constants (maintain compatibility)
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  DEFAULT_BACKUP_RETENTION_DAYS: 30,
  DEFAULT_AUTO_SAVE_DEBOUNCE_MS: 2000,
  MAX_PERFORMANCE_METRICS: 1000,
  MIGRATION_TIMEOUT_MS: 300000, // 5 minutes
  BACKUP_TIMEOUT_MS: 60000, // 1 minute
  MAX_AUTO_SAVE_RETRIES: 3,
  WORKSPACE_VERSION: 1,
  
  // Enhanced constants for step configuration system
  STEP_CONFIG_VERSION: 2,
  MAX_STEP_CONFIG_SIZE: 1024 * 1024, // 1MB per step config
  DEFAULT_CACHE_TTL: 300000, // 5 minutes
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_CACHE_ENTRIES: 1000,
  VALIDATION_TIMEOUT_MS: 10000, // 10 seconds
  BATCH_OPERATION_TIMEOUT_MS: 60000, // 1 minute
  DEFAULT_STEP_CONFIG_SCHEMA_VERSION: 1,
  
  // Performance thresholds
  CACHE_HIT_RATE_WARNING_THRESHOLD: 0.8,
  CONFIG_SIZE_WARNING_THRESHOLD: 100 * 1024, // 100KB
  VALIDATION_TIME_WARNING_THRESHOLD: 1000, // 1 second
  
  // Migration constants
  MIGRATION_BATCH_SIZE: 10,
  MIGRATION_RETRY_ATTEMPTS: 3,
  ROLLBACK_TIMEOUT_MS: 120000, // 2 minutes
  
  // Subtitle persistence constants
  SUBTITLE_FILE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  SUBTITLE_AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  SUBTITLE_BACKUP_RETENTION_DAYS: 7, // 7 days
  SUBTITLE_MAX_BACKUPS_PER_FILE: 10,
  SUBTITLE_CACHE_MAX_SIZE: 20 * 1024 * 1024, // 20MB
  SUBTITLE_CACHE_TTL: 600000, // 10 minutes
  SUBTITLE_OPERATION_TIMEOUT: 30000, // 30 seconds
  SUBTITLE_BATCH_SIZE: 100, // Subtitles per batch
  SUBTITLE_COMPRESSION_THRESHOLD: 50 * 1024, // 50KB
  SUBTITLE_VALIDATION_TIMEOUT: 5000, // 5 seconds
  
  // Step configuration defaults
  DEFAULT_CACHE_CONFIG: {
    maxSize: 50 * 1024 * 1024, // 50MB
    defaultTTL: 300000, // 5 minutes
    maxEntries: 1000,
    enableLRU: true,
    enableCompression: true
  } as CacheConfig,
  
  // Default subtitle persistence configuration
  DEFAULT_SUBTITLE_PERSISTENCE_CONFIG: {
    autoSave: {
      enabled: true,
      interval: 30000, // 30 seconds
      createBackups: true,
      maxBackups: 5,
      compressBackups: true
    },
    validation: {
      validateOnLoad: true,
      validateOnSave: true,
      validateIntegrity: true,
      qualityThresholds: {
        minimumConfidence: 0.7,
        maximumGapDuration: 3.0,
        minimumSubtitleDuration: 0.5
      }
    },
    cache: {
      enabled: true,
      maxSize: 20 * 1024 * 1024, // 20MB
      defaultTTL: 600000, // 10 minutes
      enableCompression: true
    },
    errorRecovery: {
      autoRecovery: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      },
      backupRecovery: {
        enabled: true,
        autoRestoreOnCorruption: true,
        maxBackupAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }
  }
} as const

/**
 * Step configuration schema versions for each step type
 */
export const STEP_CONFIG_SCHEMA_VERSIONS = {
  'input-file': 1,
  'config': 1,
  'processing': 1,
  'review': 1,
  'export': 1
} as const

/**
 * Default step configuration templates
 */
export const DEFAULT_STEP_CONFIGS: StepConfigDefaults = {
  'input-file': () => ({
    filePreferences: {
      autoValidate: true,
      extractMetadata: true,
      suggestOptimalSettings: true
    }
  }),
  'config': () => ({
    language: 'zh',
    priority: 'balanced',
    speakers: false,
    written: true,
    music: false,
    charset: 'traditional',
    noGeminiRefinement: false,
    maxChunkDuration: 15,
    videoQuality: '360p',
    advancedOptions: {
      qualityThresholds: {
        confidence: 0.8,
        accuracy: 0.85
      },
      batchSize: 10,
      parallelProcessing: false
    }
  }),
  'processing': () => ({
    verbose: false,
    hardwareAcceleration: {
      useGPU: false,
      memoryLimit: 4096
    },
    qualitySettings: {
      targetAccuracy: 0.9,
      minimumConfidence: 0.7,
      enableQualityChecks: true
    },
    monitoring: {
      enableDetailedLogging: false,
      trackPerformanceMetrics: true,
      saveDebugInfo: false
    }
  }),
  'review': () => ({
    editingPreferences: {
      autoSave: true,
      showConfidenceScores: true,
      highlightLowConfidence: true,
      enableSpellCheck: false,
      defaultEditMode: 'simple',
      autoSaveConfig: {
        interval: 30000, // 30 seconds
        createBackups: true,
        maxBackups: 5,
        compressBackups: true
      }
    },
    qualityValidation: {
      checkTimingOverlaps: true,
      validateTextLength: true,
      enforceMinimumDuration: true,
      flagSuspiciousContent: true,
      validateFileIntegrity: true,
      autoValidateOnSave: true,
      qualityThresholds: {
        minimumConfidence: 0.7,
        maximumGapDuration: 3.0,
        minimumSubtitleDuration: 0.5
      }
    },
    displayOptions: {
      fontSize: 14,
      showOriginalText: true,
      showTranslation: true,
      showTimestamps: true,
      waveformDisplay: false,
      showFileMetadata: false,
      showValidationStatus: true,
      showPerformanceMetrics: false,
      highlightUnsavedChanges: true
    },
    errorRecovery: {
      autoRecovery: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      },
      backupRecovery: {
        enabled: true,
        autoRestoreOnCorruption: true,
        maxBackupAge: 24 * 60 * 60 * 1000 // 24 hours
      },
      cacheRecovery: {
        enabled: true,
        fallbackToCache: true,
        cacheValidation: true
      },
      manualRecovery: {
        recreateFromOriginal: true,
        exportAndReimport: true,
        contactSupport: false
      }
    },
    performance: {
      trackOperations: true,
      enableProfiling: false,
      maxMetricsHistory: 100
    },
    cacheConfig: {
      enabled: true,
      maxSize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 300000 // 5 minutes
    }
  }),
  'export': () => ({
    formatSettings: {
      format: 'srt',
      encoding: 'utf8',
      includeMetadata: false,
      includeConfidenceScores: false
    },
    postProcessing: {
      removeEmptyLines: true,
      normalizeWhitespace: true,
      applyTextFormatting: false,
      generateSummary: false
    },
    qualityAssurance: {
      finalValidation: true,
      exportChecklist: [],
      backupOriginal: true
    }
  })
}

// ============================================================================
// TYPE GUARDS AND VALIDATION FUNCTIONS
// ============================================================================

/**
 * Type guard for workspace errors
 */
export function isWorkspaceError(error: any): error is WorkspaceError {
  return error && typeof error.code === 'string' && 
    (error.code.startsWith('WORKSPACE_') || error.code.startsWith('STEP_CONFIG_'))
}

/**
 * Type guard for step configuration errors
 */
export function isStepConfigError(error: any): error is StepConfigError {
  return error && typeof error.code === 'string' && error.code.startsWith('STEP_CONFIG_')
}

/**
 * Type guard for legacy workspace configuration
 */
export function isLegacyWorkspaceConfig(config: any): config is LegacyWorkspaceConfig {
  return config && typeof config === 'object' && 
    (config._isLegacy === true || !config._stepConfigsEnabled)
}

/**
 * Type guard for enhanced workspace store
 */
export function isEnhancedWorkspaceStore(store: any): store is EnhancedWorkspaceStore {
  return store && 
    typeof store.getStepConfig === 'function' &&
    typeof store.setStepConfig === 'function' &&
    typeof store.batchUpdateStepConfigs === 'function'
}

/**
 * Type guard for valid workflow step ID
 */
export function isValidWorkflowStepId(stepId: any): stepId is WorkflowStepId {
  return typeof stepId === 'string' && 
    ['input-file', 'config', 'processing', 'review', 'export'].includes(stepId)
}

/**
 * Type guard for step configuration record
 */
export function isStepConfigurationRecord(record: any): record is StepConfigurationRecord {
  return record && 
    typeof record.workspace_id === 'string' &&
    typeof record.step_id === 'string' &&
    typeof record.config_data === 'string' &&
    isValidWorkflowStepId(record.step_id)
}

/**
 * Type guard for cached step config
 */
export function isCachedStepConfig(cached: any): cached is CachedStepConfig {
  return cached &&
    typeof cached.expiryTime === 'number' &&
    typeof cached.accessCount === 'number' &&
    typeof cached.isDirty === 'boolean'
}

/**
 * Validate workspace name
 */
export function isValidWorkspaceName(name: string): boolean {
  return name.length > 0 && 
    name.length <= WORKSPACE_CONSTANTS.MAX_NAME_LENGTH && 
    !/[<>:"/\\|?*]/.test(name)
}

/**
 * Validate workspace ID (UUID v4)
 */
export function isValidWorkspaceId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Validate step configuration size
 */
export function isValidStepConfigSize(configData: string): boolean {
  return configData.length <= WORKSPACE_CONSTANTS.MAX_STEP_CONFIG_SIZE
}

/**
 * Check if cache entry is expired
 */
export function isCacheEntryExpired(cached: CachedStepConfig): boolean {
  return Date.now() > cached.expiryTime
}

/**
 * Check if migration is needed for workspace
 */
export function needsMigration(workspace: Workspace): boolean {
  return !workspace.config._stepConfigsEnabled && 
    workspace.config.version < WORKSPACE_CONSTANTS.STEP_CONFIG_VERSION
}

/**
 * Type guard for ReviewStepConfig with subtitle persistence
 */
export function hasSubtitlePersistence(config: ReviewStepConfig): config is ReviewStepConfig & { subtitlePersistence: SubtitlePersistenceData } {
  return config.subtitlePersistence !== undefined
}

/**
 * Type guard for subtitle session data
 */
export function hasSubtitleSession(config: ReviewStepConfig): config is ReviewStepConfig & { currentSession: SubtitleSessionData } {
  return config.currentSession !== undefined
}

/**
 * Validate ReviewStepConfig with subtitle persistence
 */
export function validateReviewStepConfigWithPersistence(config: ReviewStepConfig): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate auto-save configuration
  if (config.editingPreferences?.autoSaveConfig) {
    const autoSaveConfig = config.editingPreferences.autoSaveConfig
    if (autoSaveConfig.interval < 1000) {
      warnings.push('Auto-save interval less than 1 second may impact performance')
    }
    if (autoSaveConfig.maxBackups > 20) {
      warnings.push('Large number of backups may consume significant storage')
    }
  }

  // Validate quality thresholds
  if (config.qualityValidation?.qualityThresholds) {
    const thresholds = config.qualityValidation.qualityThresholds
    if (thresholds.minimumConfidence < 0 || thresholds.minimumConfidence > 1) {
      errors.push('Minimum confidence must be between 0 and 1')
    }
    if (thresholds.maximumGapDuration < 0) {
      errors.push('Maximum gap duration must be positive')
    }
    if (thresholds.minimumSubtitleDuration < 0) {
      errors.push('Minimum subtitle duration must be positive')
    }
  }

  // Validate cache configuration
  if (config.cacheConfig) {
    if (config.cacheConfig.maxSize < 1024 * 1024) {
      warnings.push('Cache size less than 1MB may be too small for optimal performance')
    }
    if (config.cacheConfig.defaultTTL < 60000) {
      warnings.push('Cache TTL less than 1 minute may cause frequent cache misses')
    }
  }

  // Validate error recovery configuration
  if (config.errorRecovery?.autoRecovery) {
    const autoRecovery = config.errorRecovery.autoRecovery
    if (autoRecovery.maxRetries > 10) {
      warnings.push('High retry count may cause long delays during errors')
    }
    if (autoRecovery.retryDelay < 100) {
      warnings.push('Very short retry delay may not allow enough time for error recovery')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Generate cache key for step configuration
 */
export function generateStepConfigCacheKey(workspaceId: string, stepId: WorkflowStepId): string {
  return `${workspaceId}:${stepId}`
}

/**
 * Parse cache key to extract workspace and step IDs
 */
export function parseCacheKey(cacheKey: string): { workspaceId: string; stepId: WorkflowStepId } | null {
  const parts = cacheKey.split(':')
  if (parts.length !== 2) return null
  
  const [workspaceId, stepId] = parts
  if (!isValidWorkspaceId(workspaceId) || !isValidWorkflowStepId(stepId)) {
    return null
  }
  
  return { workspaceId, stepId }
}

/**
 * Validate step configuration against schema
 */
export function validateStepConfigSchema<K extends WorkflowStepId>(
  stepId: K,
  config: any
): StepConfigValidationResult<K> {
  const errors: StepConfigValidationResult<K>['errors'] = []
  const warnings: StepConfigValidationResult<K>['warnings'] = []
  
  // Basic validation - can be extended with more specific rules
  if (!config || typeof config !== 'object') {
    errors.push({
      field: 'root' as keyof StepConfigMap[K],
      message: 'Configuration must be an object',
      value: config,
      severity: 'error'
    })
  }
  
  return {
    stepId,
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Check configuration health
 */
export function checkConfigHealth(
  workspaceId: string,
  stepConfigs: Partial<StepConfigMap>
): ConfigHealthCheck {
  const stepHealth: Record<WorkflowStepId, 'healthy' | 'warning' | 'error' | 'missing'> = {
    'input-file': 'missing',
    'config': 'missing',
    'processing': 'missing',
    'review': 'missing',
    'export': 'missing'
  }
  
  const issues: ConfigHealthCheck['issues'] = []
  const performanceHints: PerformanceHint[] = []
  
  // Analyze each step configuration
  for (const stepId of Object.keys(stepConfigs) as WorkflowStepId[]) {
    const config = stepConfigs[stepId]
    if (config) {
      const validation = validateStepConfigSchema(stepId, config)
      stepHealth[stepId] = validation.isValid ? 'healthy' : 
        validation.errors.length > 0 ? 'error' : 'warning'
      
      // Add validation issues
      validation.errors.forEach(error => {
        issues.push({
          stepId,
          severity: error.severity === 'error' ? 'high' : 'medium',
          issue: error.message,
          suggestion: `Fix ${error.field} field`,
          autoFixAvailable: false
        })
      })
    }
  }
  
  // Calculate overall health
  const healthScores = Object.values(stepHealth)
  const healthyCount = healthScores.filter(h => h === 'healthy').length
  const errorCount = healthScores.filter(h => h === 'error').length
  const warningCount = healthScores.filter(h => h === 'warning').length
  
  let overallHealth: ConfigHealthCheck['overallHealth']
  if (errorCount > 0) overallHealth = 'critical'
  else if (warningCount > 2) overallHealth = 'poor'
  else if (warningCount > 0) overallHealth = 'fair'
  else if (healthyCount >= 4) overallHealth = 'excellent'
  else overallHealth = 'good'
  
  return {
    workspaceId,
    overallHealth,
    stepHealth,
    issues,
    performanceHints,
    migrationRecommended: needsMigration({ config: { _stepConfigsEnabled: false } } as Workspace),
    lastHealthCheck: Date.now()
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create default step configuration for a given step
 */
export function createDefaultStepConfig<K extends WorkflowStepId>(stepId: K): StepConfigMap[K] {
  return DEFAULT_STEP_CONFIGS[stepId]()
}

/**
 * Merge step configurations with proper type safety
 */
export function mergeStepConfigs<K extends WorkflowStepId>(
  stepId: K,
  existing: Partial<StepConfigMap[K]>,
  updates: Partial<StepConfigMap[K]>
): StepConfigMap[K] {
  const defaults = createDefaultStepConfig(stepId)
  return { ...defaults, ...existing, ...updates }
}

/**
 * Calculate configuration checksum for integrity validation
 */
export function calculateConfigChecksum(config: any): string {
  const configString = JSON.stringify(config, Object.keys(config).sort())
  // Simple hash function - in production, use a proper crypto hash
  let hash = 0
  for (let i = 0; i < configString.length; i++) {
    const char = configString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(16)
}

/**
 * Estimate configuration size in bytes
 */
export function estimateConfigSize(config: any): number {
  return JSON.stringify(config).length * 2 // Rough estimate (UTF-16)
}

/**
 * Compress configuration data for storage
 */
export function compressConfigData(config: any): string {
  // In production, implement actual compression (e.g., LZ-string)
  return JSON.stringify(config)
}

/**
 * Decompress configuration data from storage
 */
export function decompressConfigData(compressedData: string): any {
  try {
    return JSON.parse(compressedData)
  } catch {
    throw new Error('Failed to decompress configuration data')
  }
}