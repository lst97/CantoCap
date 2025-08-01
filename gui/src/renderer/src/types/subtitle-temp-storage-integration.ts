/**
 * Subtitle Temporary Storage Integration Types
 * 
 * Enhanced integration types for seamless interaction with the existing
 * workspace system, subtitle persistence, and React hooks. Provides
 * type-safe bridges between the auto-save system and the broader application.
 */

import type { 
  SubtitleData, 
  ProcessingStatistics, 
  AppConfig 
} from '../../../types'
import type {
  WorkflowStepId,
  ReviewStepConfig,
  WorkspaceWithGrouping,
  EnhancedWorkspaceStore,
  WorkspaceError
} from './workspace'
import type {
  SubtitleFileContent,
  SubtitleFileMetadata,
  SubtitleFileOperations,
  SubtitleSessionData,
  SubtitleValidationResult
} from './subtitle-persistence'
import type {
  SubtitleTempContent,
  SubtitleTempSession,
  SubtitleTempMetadata,
  SubtitleTempError,
  SubtitleTempOperationResponse,
  SubtitleAutoSaveConfig
} from './subtitle-temp-storage'
import type {
  WorkspaceId,
  SessionId,
  StorageId,
  OperationId,
  TypedOperationResult,
  ValidationResult,
  PerformanceMetric
} from './subtitle-temp-storage-utils'

// ============================================================================
// INTEGRATION BRIDGE TYPES
// ============================================================================

/**
 * Bridge interface between temporary storage and persistent subtitle files
 */
export interface SubtitleStorageBridge {
  /** Convert temporary content to persistent file content */
  toPersistentContent(tempContent: SubtitleTempContent): SubtitleFileContent
  
  /** Convert persistent file content to temporary content */
  toTemporaryContent(fileContent: SubtitleFileContent, sessionId: SessionId): SubtitleTempContent
  
  /** Synchronize changes between temporary and persistent storage */
  synchronize(
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    options?: {
      direction: 'temp-to-persistent' | 'persistent-to-temp' | 'bidirectional'
      conflictResolution: 'prefer-temp' | 'prefer-persistent' | 'manual'
      createBackup: boolean
    }
  ): Promise<TypedOperationResult<SynchronizationResult>>
  
  /** Validate compatibility between storage formats */
  validateCompatibility(
    tempContent: SubtitleTempContent,
    fileContent: SubtitleFileContent
  ): ValidationResult
}

/**
 * Result of storage synchronization operation
 */
export interface SynchronizationResult {
  /** Operations performed during synchronization */
  operations: Array<{
    type: 'create' | 'update' | 'delete' | 'merge'
    target: 'temporary' | 'persistent'
    itemId: string
    success: boolean
    error?: string
  }>
  
  /** Conflicts encountered and their resolution */
  conflicts: Array<{
    itemId: string
    field: string
    tempValue: any
    persistentValue: any
    resolution: 'temp' | 'persistent' | 'merged' | 'manual'
    timestamp: number
  }>
  
  /** Performance metrics */
  metrics: {
    itemsProcessed: number
    conflictsResolved: number
    duration: number
    bytesTransferred: number
  }
  
  /** Final state after synchronization */
  finalState: {
    temporaryItemCount: number
    persistentItemCount: number
    lastSyncTimestamp: number
  }
}

/**
 * Enhanced workspace integration for subtitle temporary storage
 */
export interface WorkspaceSubtitleTempIntegration {
  /** Get temporary storage configuration for a workspace step */
  getStepTempStorageConfig<T extends ReviewStepConfig>(
    workspaceId: WorkspaceId,
    stepId: Extract<WorkflowStepId, 'review'>
  ): Promise<T & { tempStorageConfig: SubtitleAutoSaveConfig }>
  
  /** Update step configuration with temporary storage settings */
  updateStepTempStorageConfig<T extends ReviewStepConfig>(
    workspaceId: WorkspaceId,
    stepId: Extract<WorkflowStepId, 'review'>,
    tempConfig: Partial<SubtitleAutoSaveConfig>
  ): Promise<void>
  
  /** Create integrated session for workspace step */
  createIntegratedSession(
    workspaceId: WorkspaceId,
    stepId: WorkflowStepId,
    sessionType: SubtitleTempSession['sessionType'],
    options?: {
      inheritFromPrevious?: boolean
      autoStart?: boolean
      syncWithPersistent?: boolean
    }
  ): Promise<SessionId>
  
  /** Get all active temporary sessions for workspace */
  getActiveTemporarySessions(workspaceId: WorkspaceId): Promise<IntegratedSessionInfo[]>
  
  /** Cleanup temporary storage for workspace */
  cleanupWorkspaceTemporaryStorage(
    workspaceId: WorkspaceId,
    options?: {
      olderThan?: number
      preserveActive?: boolean
      createBackup?: boolean
    }
  ): Promise<CleanupResult>
}

/**
 * Integrated session information with workspace context
 */
export interface IntegratedSessionInfo {
  /** Session details */
  session: SubtitleTempSession
  
  /** Associated workspace information */
  workspace: {
    id: WorkspaceId
    name: string
    isActive: boolean
    lastAccessed: number
  }
  
  /** Step context if applicable */
  stepContext?: {
    stepId: WorkflowStepId
    stepConfig: any
    stepPosition: number
  }
  
  /** Storage statistics */
  storageStats: {
    itemCount: number
    totalSize: number
    lastModified: number
    hasUnsavedChanges: boolean
  }
  
  /** Performance metrics */
  performanceMetrics: {
    averageOperationTime: number
    operationCount: number
    errorCount: number
    cacheHitRate: number
  }
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  /** Summary statistics */
  summary: {
    sessionsRemoved: number
    itemsRemoved: number
    bytesReclaimed: number
    duration: number
  }
  
  /** Detailed operation log */
  operations: Array<{
    type: 'session' | 'content' | 'backup'
    id: string
    size: number
    timestamp: number
    success: boolean
    error?: string
  }>
  
  /** Any errors encountered */
  errors: SubtitleTempError[]
  
  /** Recommendations for future cleanup */
  recommendations: Array<{
    type: 'schedule' | 'config' | 'optimization'
    message: string
    priority: 'low' | 'medium' | 'high'
  }>
}

// ============================================================================
// REACT HOOK INTEGRATION TYPES
// ============================================================================

/**
 * Enhanced hook options for temporary storage integration
 */
export interface UseSubtitleTempStorageOptions {
  /** Workspace identifier */
  workspaceId: WorkspaceId
  
  /** Session configuration */
  sessionConfig?: {
    sessionType: SubtitleTempSession['sessionType']
    autoStart: boolean
    inheritFromPrevious: boolean
  }
  
  /** Auto-save configuration */
  autoSave?: Partial<SubtitleAutoSaveConfig>
  
  /** Synchronization options */
  sync?: {
    enabled: boolean
    direction: 'temp-to-persistent' | 'persistent-to-temp' | 'bidirectional'
    interval: number
    conflictResolution: 'prefer-temp' | 'prefer-persistent' | 'manual'
  }
  
  /** Performance options */
  performance?: {
    enableMetrics: boolean
    metricsInterval: number
    cacheEnabled: boolean
    cacheTTL: number
  }
  
  /** Error handling */
  errorHandling?: {
    retryAttempts: number
    retryDelay: number
    fallbackToCache: boolean
    notifyOnError: boolean
  }
  
  /** Event callbacks */
  callbacks?: {
    onSessionCreated?: (sessionId: SessionId) => void
    onContentChanged?: (changeCount: number) => void
    onAutoSaveTriggered?: (reason: string) => void
    onSyncCompleted?: (result: SynchronizationResult) => void
    onError?: (error: SubtitleTempError) => void
  }
}

/**
 * Hook return type for subtitle temporary storage
 */
export interface UseSubtitleTempStorageResult {
  // Session management
  session: SubtitleTempSession | null
  sessionId: SessionId | null
  isSessionActive: boolean
  
  // Content management
  content: SubtitleTempContent | null
  isContentLoaded: boolean
  hasUnsavedChanges: boolean
  changeCount: number
  
  // Operations
  operations: {
    saveContent: (content: SubtitleTempContent) => Promise<void>
    loadContent: (sessionId?: SessionId) => Promise<SubtitleTempContent | null>
    createSession: (sessionType?: string) => Promise<SessionId>
    endSession: (sessionId?: SessionId) => Promise<void>
    triggerAutoSave: () => Promise<void>
    synchronize: (options?: Partial<SynchronizationOptions>) => Promise<SynchronizationResult>
  }
  
  // State management
  state: {
    isLoading: boolean
    isSaving: boolean
    isSyncing: boolean
    lastSaveTime: number | null
    lastSyncTime: number | null
    error: SubtitleTempError | null
  }
  
  // Metrics and monitoring
  metrics: {
    operationCount: number
    averageOperationTime: number
    cacheHitRate: number
    errorCount: number
    totalDataProcessed: number
  }
  
  // Configuration
  config: {
    autoSaveConfig: SubtitleAutoSaveConfig
    updateAutoSaveConfig: (config: Partial<SubtitleAutoSaveConfig>) => Promise<void>
  }
  
  // Utilities
  utils: {
    validateContent: (content: SubtitleTempContent) => ValidationResult
    estimateStorageSize: (content: SubtitleTempContent) => number
    clearCache: () => Promise<void>
    exportSession: () => Promise<string>
    importSession: (sessionData: string) => Promise<void>
  }
}

/**
 * Synchronization options for hook operations
 */
export interface SynchronizationOptions {
  direction: 'temp-to-persistent' | 'persistent-to-temp' | 'bidirectional'
  conflictResolution: 'prefer-temp' | 'prefer-persistent' | 'manual'
  createBackup: boolean
  validateAfterSync: boolean
  notifyOnConflict: boolean
}

/**
 * Enhanced workspace hook integration
 */
export interface UseWorkspaceWithTempStorageResult {
  // Workspace management (inherited)
  workspace: WorkspaceWithGrouping | null
  isWorkspaceLoaded: boolean
  
  // Enhanced with temporary storage
  tempStorage: {
    activeSessions: IntegratedSessionInfo[]
    totalStorageUsed: number
    isCleanupNeeded: boolean
    lastCleanup: number | null
  }
  
  // Operations
  operations: {
    // Workspace operations (inherited)
    switchWorkspace: (workspaceId: WorkspaceId) => Promise<void>
    
    // Enhanced temporary storage operations
    createTempSession: (
      stepId: WorkflowStepId,
      sessionType: string,
      options?: Partial<UseSubtitleTempStorageOptions>
    ) => Promise<SessionId>
    
    getTempSession: (sessionId: SessionId) => Promise<IntegratedSessionInfo | null>
    
    cleanupTempStorage: (options?: {
      olderThan?: number
      preserveActive?: boolean
    }) => Promise<CleanupResult>
    
    syncAllSessions: () => Promise<SynchronizationResult[]>
    
    getStorageMetrics: () => Promise<StorageMetrics>
  }
  
  // Configuration
  tempStorageConfig: {
    isEnabled: boolean
    globalSettings: SubtitleAutoSaveConfig
    updateGlobalSettings: (config: Partial<SubtitleAutoSaveConfig>) => Promise<void>
  }
}

/**
 * Storage metrics for monitoring and optimization
 */
export interface StorageMetrics {
  /** Total storage usage across all sessions */
  totalStorage: {
    used: number
    available: number
    percentage: number
  }
  
  /** Session statistics */
  sessions: {
    active: number
    inactive: number
    expired: number
    total: number
  }
  
  /** Performance metrics */
  performance: {
    averageOperationTime: number
    averageSaveTime: number
    averageLoadTime: number
    cacheHitRate: number
    errorRate: number
  }
  
  /** Cleanup recommendations */
  cleanup: {
    isNeeded: boolean
    estimatedReclaim: number
    expiredSessions: number
    oldBackups: number
  }
  
  /** Trend data */
  trends: {
    storageGrowthRate: number
    operationFrequency: number
    errorTrend: 'increasing' | 'stable' | 'decreasing'
  }
}

// ============================================================================
// MIDDLEWARE AND PLUGIN TYPES
// ============================================================================

/**
 * Middleware interface for temporary storage operations
 */
export interface TempStorageMiddleware {
  /** Middleware name for identification */
  name: string
  
  /** Priority for execution order (higher = earlier) */
  priority: number
  
  /** Execute before operation */
  before?: (
    operation: string,
    context: any,
    next: () => Promise<any>
  ) => Promise<any>
  
  /** Execute after operation */
  after?: (
    operation: string,
    result: any,
    context: any
  ) => Promise<any>
  
  /** Handle operation errors */
  onError?: (
    operation: string,
    error: Error,
    context: any
  ) => Promise<any>
}

/**
 * Plugin interface for extending temporary storage functionality
 */
export interface TempStoragePlugin {
  /** Plugin name and version */
  name: string
  version: string
  
  /** Plugin dependencies */
  dependencies?: string[]
  
  /** Initialize plugin */
  initialize: (context: PluginContext) => Promise<void>
  
  /** Cleanup plugin resources */
  cleanup: () => Promise<void>
  
  /** Plugin-specific operations */
  operations?: Record<string, (...args: any[]) => any>
  
  /** Event handlers */
  eventHandlers?: Record<string, (...args: any[]) => void>
}

/**
 * Plugin context for initialization
 */
export interface PluginContext {
  /** Access to storage operations */
  storage: {
    save: (data: any) => Promise<void>
    load: (key: string) => Promise<any>
    delete: (key: string) => Promise<void>
  }
  
  /** Event system access */
  events: {
    on: (event: string, handler: (...args: any[]) => void) => void
    emit: (event: string, ...args: any[]) => void
  }
  
  /** Configuration access */
  config: {
    get: (key: string) => any
    set: (key: string, value: any) => void
  }
  
  /** Logger instance */
  logger: {
    debug: (message: string, ...args: any[]) => void
    info: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
  }
}

// ============================================================================
// TESTING AND MOCK TYPES
// ============================================================================

/**
 * Mock implementation interface for testing
 */
export interface MockTempStorageProvider {
  /** Create mock session */
  createMockSession(
    workspaceId: WorkspaceId,
    overrides?: Partial<SubtitleTempSession>
  ): SubtitleTempSession
  
  /** Create mock content */
  createMockContent(
    sessionId: SessionId,
    subtitleCount?: number,
    overrides?: Partial<SubtitleTempContent>
  ): SubtitleTempContent
  
  /** Create mock error */
  createMockError(
    code: string,
    overrides?: Partial<SubtitleTempError>
  ): SubtitleTempError
  
  /** Simulate operation delay */
  simulateDelay(min: number, max: number): Promise<void>
  
  /** Simulate operation failure */
  simulateFailure(probability: number, error?: SubtitleTempError): void
  
  /** Reset mock state */
  reset(): void
  
  /** Get operation history */
  getOperationHistory(): Array<{
    operation: string
    timestamp: number
    success: boolean
    duration: number
  }>
}

/**
 * Test utilities for temporary storage
 */
export interface TempStorageTestUtils {
  /** Create test workspace */
  createTestWorkspace(options?: {
    withSessions?: number
    withContent?: boolean
    withErrors?: boolean
  }): Promise<WorkspaceId>
  
  /** Generate test data */
  generateTestData: {
    subtitles: (count: number) => SubtitleData[]
    session: (workspaceId: WorkspaceId) => SubtitleTempSession
    content: (sessionId: SessionId, subtitleCount?: number) => SubtitleTempContent
    metadata: (workspaceId: WorkspaceId) => SubtitleTempMetadata
  }
  
  /** Validation helpers */
  validate: {
    session: (session: any) => ValidationResult
    content: (content: any) => ValidationResult
    operation: (operation: any) => ValidationResult
  }
  
  /** Performance testing */
  performance: {
    measureOperation: <T>(
      operation: () => Promise<T>,
      iterations?: number
    ) => Promise<{ result: T; metrics: PerformanceMetric[] }>
    
    stressTest: (
      operations: Array<() => Promise<any>>,
      concurrency: number
    ) => Promise<{ success: number; failed: number; metrics: PerformanceMetric[] }>
  }
  
  /** Cleanup test resources */
  cleanup: () => Promise<void>
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Export interface for temporary storage data
 */
export interface TempStorageExport {
  /** Export metadata */
  metadata: {
    version: string
    exportedAt: number
    workspaceId: WorkspaceId
    exportType: 'full' | 'sessions-only' | 'content-only'
  }
  
  /** Exported sessions */
  sessions: SubtitleTempSession[]
  
  /** Exported content */
  content: Record<SessionId, SubtitleTempContent>
  
  /** Configuration snapshots */
  configs: Record<SessionId, SubtitleAutoSaveConfig>
  
  /** Performance metrics */
  metrics?: PerformanceMetric[]
}

/**
 * Import options for temporary storage data
 */
export interface TempStorageImportOptions {
  /** Target workspace */
  workspaceId: WorkspaceId
  
  /** Import strategy */
  strategy: 'merge' | 'replace' | 'skip-existing'
  
  /** Validation options */
  validation: {
    strict: boolean
    skipInvalid: boolean
    reportErrors: boolean
  }
  
  /** Transformation options */
  transform?: {
    sessionIds: 'preserve' | 'regenerate'
    timestamps: 'preserve' | 'update'
    metadata: 'preserve' | 'update'
  }
}

/**
 * Import result with detailed feedback
 */
export interface TempStorageImportResult {
  /** Import success status */
  success: boolean
  
  /** Import statistics */
  statistics: {
    sessionsImported: number
    contentItemsImported: number
    configsImported: number
    duplicatesSkipped: number
    errorsEncountered: number
  }
  
  /** Error details */
  errors: Array<{
    sessionId?: SessionId
    error: string
    severity: 'warning' | 'error' | 'critical'
  }>
  
  /** Mapping of old to new IDs */
  idMappings: {
    sessions: Record<string, SessionId>
    workspaces: Record<string, WorkspaceId>
  }
  
  /** Performance metrics */
  metrics: {
    duration: number
    throughput: number
    memoryUsage: number
  }
}