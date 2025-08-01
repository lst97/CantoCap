// Application Types and Interfaces

export interface SubtitleData {
  id: number
  startTime: number
  endTime: number
  text: string
  translation?: string
  confidence?: number
  speaker?: string | null
  isMusic?: boolean
}

export interface DependencyStatus {
  name: string
  status: 'checking' | 'found' | 'missing' | 'error'
  version: string | null
  path: string | null
  available: boolean
  downloadUrl?: string
  autoInstallUrls?: Record<string, string>
  helpText?: string
  error: string | null
}

export interface ProcessingDebugMessage {
  id: string
  timestamp: number
  stage: string
  message: string
  level: 'debug' | 'info' | 'warning' | 'error'
  source?: string
}

export interface ProcessingState {
  isActive: boolean
  stage: 'idle' | 'preparing' | 'transcribing' | 'refining' | 'completed' | 'error' | 'cancelled'
  progress: number
  message: string
  timeElapsed: number
  timeRemaining: number
  currentStep: number | null
  totalSteps: number | null
  hardwareInfo: HardwareInfo | null
  error: string | null
  startTime: number | null
  debugMessages: ProcessingDebugMessage[]
  substage?: string
  engineStage?: string
  statistics?: ProcessingStatistics
}

export interface HardwareInfo {
  gpuAcceleration?: boolean
  memoryUsage?: string
  cpuUsage?: string
  raw_output?: string
  python_available?: boolean
  engine_path?: string
  [key: string]: any
}

export interface AppConfig {
  inputFile: string | null
  outputFile: string | null
  language: string
  model: string | null
  priority: 'speed' | 'balanced' | 'quality'
  speakers: boolean
  written: boolean
  music: boolean
  charset: 'traditional' | 'simplified'
  geminiKey: string
  hfToken: string
  noGeminiRefinement: boolean
  maxChunkDuration: number
  videoQuality: '360p' | '480p' | '720p'
  terminologyConfig: string | null
  ffmpegPath: string | null
  subtitle: string | SubtitleData[] | null
  duration: number
  verbose: boolean
  startTime: number | null
  endTime: number | null
  importedJsonFile: string | null
  autoSaveApiKeys: boolean
}

export interface UIState {
  activeModal: string | null
  showAdvanced: boolean
  notifications: Notification[]
  theme: 'light' | 'dark' | 'system'
  sidebarExpanded: boolean
  processingHistory: ProcessingHistoryEntry[]
}

export interface Notification {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  timestamp: number
}

export interface ProcessingHistoryEntry {
  id: number
  inputFile: string
  outputFile: string | null
  status: 'started' | 'completed' | 'failed' | 'cancelled'
  timestamp: number
  config: AppConfig
}

export interface HardwareState {
  info: HardwareInfo | null
  lastChecked: number | null
  checking: boolean
  error: string | null
}

export interface AppState {
  isInitialized: boolean
  appVersion: string | null
  dependencies: {
    python: DependencyStatus
    ffmpeg: DependencyStatus
  }
  processing: ProcessingState
  config: AppConfig
  ui: UIState
  hardware: HardwareState
}

// Modern IPC Message Types
export interface IPCMessage {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  category: 'system' | 'process' | 'model' | 'user'
  source: string
  content: string
  data?: Record<string, any>
}

export interface ProcessedMessage extends IPCMessage {
  shouldNotify: boolean
  displayClass: string
  icon: string
}

// Legacy interfaces (for backward compatibility during transition)
export interface IPCProgressUpdate {
  progress?: number
  message?: string
  status?: string
  stage?: string
  currentStep?: number
  totalSteps?: number
  hardwareInfo?: HardwareInfo
}

export interface QualityMetrics {
  overall_score: number
  quality_grade: string
  quality_confidence: number
  quality_breakdown: {
    technical: number
    linguistic: number
    readability: number
    translation: number
  }
}

export interface CoverageMetrics {
  overall_coverage: number
  coverage_confidence: number
  coverage_breakdown: {
    subtitle_coverage: number
    temporal_coverage: number
    content_coverage: number
    translation_quality: number
  }
}

export interface ProcessingStatistics {
  total_subtitles?: number
  total_duration?: number
  word_count?: number
  quality_score?: number
  quality_grade?: string
  quality_confidence?: number
  quality_breakdown?: {
    technical: number
    linguistic: number
    readability: number
    translation: number
  }
  translation_coverage?: number
  coverage_confidence?: number
  coverage_breakdown?: {
    subtitle_coverage: number
    temporal_coverage: number
    content_coverage: number
    translation_quality: number
  }
  processing_confidence?: number
  algorithm_version?: string
  formatting?: any
  dual_language?: any
  translation?: any
}

export interface IPCProcessComplete {
  message: string
  outputFile?: string
  exitCode: number
  statistics?: ProcessingStatistics
}

export interface IPCProcessError {
  message: string
  type: 'startup_error' | 'runtime_error' | 'exit_error' | 'spawn_error' | 'setup_error'
  exitCode?: number
}

export interface IPCProcessMessage {
  message: string
}

// File Dialog Types
export interface FileDialogOptions {
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export interface FileDialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface SaveFileDialogResult {
  canceled: boolean
  filePath?: string
}

// Initialization Types
export interface InitializationResult {
  success: boolean
  message: string
  dependencies: Record<string, DependencyStatus>
  requiresRestart?: boolean
}

// Electron API Types
export interface ElectronAPI {
  checkDependencies: () => Promise<Record<string, DependencyStatus>>
  runInitialization: () => Promise<InitializationResult>
  openPythonDownload: () => Promise<void>
  openPyenvGuide: () => Promise<void>
  openFFmpegDownload: () => Promise<void>
  runEngineSetup: () => Promise<boolean>
  getAppVersion: () => Promise<string>
  openExternalUrl: (url: string) => Promise<void>
  getPlatform: () => Promise<string>
  
  // DevTools Controls
  openDevTools: () => Promise<void>
  closeDevTools: () => Promise<void>
  toggleDevTools: () => Promise<void>
  
  openFileDialog: (options?: FileDialogOptions) => Promise<FileDialogResult>
  openFolderDialog: () => Promise<FileDialogResult>
  saveFileDialog: (options?: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<SaveFileDialogResult>
  writeExportFile: (filePath: string, content: string) => Promise<{ success: boolean }>
  readJsonFile: (filePath: string) => Promise<any>
  getConfig: () => Promise<any>
  setConfig: (section: string, value: any) => Promise<void>
  updateConfig: (updates: any) => Promise<void>
  getConfigSection: (section: string) => Promise<any>
  updateConfigSection: (section: string, updates: any) => Promise<void>
  setLastInputPath: (path: string) => Promise<void>
  setLastOutputPath: (path: string) => Promise<void>
  resetConfig: () => Promise<void>
  resetConfigSection: (section: string) => Promise<void>
  startTranscription: (config: AppConfig) => void
  cancelProcess: () => void
  checkHardware: () => Promise<HardwareInfo>
  onIPCMessage: (callback: (data: IPCMessage) => void) => () => void
  onProgressUpdate: (callback: (data: IPCProgressUpdate) => void) => () => void
  onProcessStarted: (callback: (data: IPCProcessMessage) => void) => () => void
  onProcessComplete: (callback: (data: IPCProcessComplete) => void) => () => void
  onProcessError: (callback: (data: IPCProcessError) => void) => () => void
  onProcessMessage: (callback: (data: IPCProcessMessage) => void) => () => void
  removeAllListeners: () => void

  // Workspace Management
  listWorkspaces: () => Promise<Array<any>>
  createWorkspace: (name: string) => Promise<{ success: boolean, workspaceId: string }>
  deleteWorkspace: (workspaceId: string) => Promise<{ success: boolean }>
  syncWorkspace: (workspaceId: string) => Promise<{ success: boolean }>

  // Configuration Management
  getWorkspaceConfig: (workspaceId: string) => Promise<AppConfig | null>
  syncWorkspaceConfig: (workspaceId: string, config: AppConfig) => Promise<{ success: boolean }>

  // Migration Operations
  startWorkspaceMigration: () => Promise<{ success: boolean, backupPath: string }>
  completeWorkspaceMigration: () => Promise<{ success: boolean }>
  rollbackWorkspaceMigration: () => Promise<{ success: boolean }>
  getWorkspaceMigrationStatus: () => Promise<any>

  // Backup & Recovery
  createWorkspaceBackup: (workspaceId: string) => Promise<{ success: boolean, backupPath: string }>
  restoreWorkspaceBackup: (backupPath: string) => Promise<{ success: boolean }>

  // Performance Monitoring
  getWorkspacePerformanceMetrics: () => Promise<any[]>
  clearWorkspacePerformanceMetrics: () => Promise<{ success: boolean }>

  // Initialization
  initializeWorkspaceSystem: () => Promise<{ success: boolean }>

  // Workspace Event Listeners
  onWorkspaceMigrationUpdate: (callback: (data: any) => void) => () => void
  onWorkspaceMigrationProgress: (callback: (data: { phase: string, progress: number, message: string }) => void) => () => void
  onWorkspaceMigrationRollback: (callback: (data: { success: boolean, message: string }) => void) => () => void

  // Subtitle File Operations
  createSubtitleFile: (params: any) => Promise<any>
  loadSubtitleFile: (params: any) => Promise<any>
  saveSubtitleFile: (params: any) => Promise<any>
  deleteSubtitleFile: (params: any) => Promise<any>
  getSubtitleMetadata: (params: any) => Promise<any>
  cleanupSubtitleFiles: (params: any) => Promise<any>
  batchSubtitleOperation: (params: any) => Promise<any>
  getSubtitleCacheMetrics: () => Promise<any>
  clearSubtitleCache: (workspaceId?: string) => Promise<{ success: boolean }>
  getSubtitlePerformanceMetrics: () => Promise<any[]>
  validateSubtitlePath: (workspaceId: string, path: string, operation: 'read' | 'write' | 'delete') => Promise<any>
  onSubtitleStreamProgress: (callback: (data: any) => void) => () => void
}

// Global Window Interface Extension
declare global {
  interface Window {
    cantocapAPI: ElectronAPI
    electronAPI: ElectronAPI // Add alias for consistency
    electron: any
    debugAPI?: {
      getProcessInfo: () => any
      testIPC: () => Promise<any>
    }
  }
}

// ============================================================================
// CONFIGURATION MANAGER TYPES
// ============================================================================

// Re-export configuration manager types for easy access
export type {
  // Core interfaces
  ConfigurationManager,
  ConfigUpdateOptions,
  ConfigValidationResult,
  ConfigOperationResult,
  ConfigError,
  ConfigErrorType,
  
  // Context and hooks
  UnifiedConfigContext,
  UnifiedConfigHook,
  ConfigHookState,
  ConfigHookActions,
  
  // Workspace integration
  WorkspaceConfigTarget,
  WorkspaceTransitionState,
  ConfigSyncStatus,
  
  // Utility types
  WorkspaceSpecificKeys,
  GlobalConfigKeys,
  ConfigKeyCategory,
  TypeSafeConfigOperation
} from './config-manager'

export {
  // Error classes
  ConfigError as ConfigurationError,
  ConfigValidationError,
  ConfigStorageError,
  ConfigSyncError,
  
  // Utility functions
  isWorkspaceSpecificKey,
  isGlobalKey,
  categorizeConfigKey,
  determineConfigTarget,
  
  // Constants
  DEFAULT_RETRY_POLICY,
  DEFAULT_CONFIG_UPDATE_OPTIONS,
  CONFIG_KEY_CATEGORIES
} from './config-manager'

// ============================================================================
// SUBTITLE TEMPORARY STORAGE SYSTEM EXPORTS
// ============================================================================

// Re-export all subtitle temporary storage types for easy access
export type {
  // Core temporary storage types
  SubtitleTempMetadata,
  SubtitleTempContent,
  SubtitleTempSession,
  SubtitleTempError,
  SubtitleTempOperationRequest,
  SubtitleTempOperationResponse,
  SubtitleTempBatchOperation,
  SubtitleTempBatchResponse,
  SubtitleTempStorageConfig,
  SubtitleTempCleanupResult,
  SubtitleAutoSaveConfig,
  
  // Statistics and validation types
  SubtitleTempStatistics,
  SubtitleValidationWarning,
  SubtitleValidationError,
  SubtitleTempSessionState,
  SubtitleTempSessionStats,
  
  // Database and storage types
  SubtitleTempStorageRecord,
  SubtitleTempSessionRecord,
  
  // Advanced utility types
  ValidationResult,
  ValidationSeverity,
  PerformanceMetric,
  DeepPartial,
  ContentFilter,
  ContentComparator,
  ContentTransformer,
  SearchParams,
  SearchResult
} from './renderer/src/types/subtitle-temp-storage'

export type {
  // Branded types for enhanced type safety
  WorkspaceId,
  SessionId,
  StorageId,
  OperationId,
  BatchId,
  
  // Generic operation types
  TypedOperationResult,
  TypedSessionManager,
  TypedStorageInterface,
  
  // Configuration and validation
  ConfigSchema,
  ConfigBuilder,
  MigrationStrategy,
  ValidationRule,
  CompositeValidator,
  EnhancedValidationResult,
  
  // Caching and performance
  TypedCache,
  TypedCacheConfig,
  PerformanceTracker,
  AggregatedMetrics,
  
  // Event system
  TypedEventEmitter,
  StorageEventPayloads,
  ReactiveStream
} from './renderer/src/types/subtitle-temp-storage-utils'

export type {
  // Integration bridge types
  SubtitleStorageBridge,
  SynchronizationResult,
  WorkspaceSubtitleTempIntegration,
  IntegratedSessionInfo,
  CleanupResult,
  
  // React hook integration
  UseSubtitleTempStorageOptions,
  UseSubtitleTempStorageResult,
  UseWorkspaceWithTempStorageResult,
  SynchronizationOptions,
  StorageMetrics,
  
  // Middleware and plugins
  TempStorageMiddleware,
  TempStoragePlugin,
  PluginContext,
  
  // Testing utilities
  MockTempStorageProvider,
  TempStorageTestUtils,
  
  // Export/import types
  TempStorageExport,
  TempStorageImportOptions,
  TempStorageImportResult
} from './renderer/src/types/subtitle-temp-storage-integration'

// Export utility functions and type guards
export {
  // Type guards
  isSubtitleTempError,
  isSubtitleTempContent,
  isSubtitleTempSession,
  isSubtitleTempMetadata,
  isSubtitleTempOperationRequest,
  isSubtitleTempStorageConfig,
  isSubtitleTempBatchOperation,
  isValidationResult,
  
  // Utility functions
  generateTempStorageId,
  calculateContentHash,
  estimateStorageSize,
  shouldCleanup,
  deepMerge,
  validateWorkspaceId,
  validateSessionId,
  createConfigValidator,
  createPerformanceMonitor,
  
  // Constants
  SUBTITLE_TEMP_STORAGE_CONSTANTS,
  DEFAULT_SUBTITLE_TEMP_CONFIG
} from './renderer/src/types/subtitle-temp-storage'

export {
  // Enhanced type guards
  createValidatingTypeGuard,
  isWorkspaceId,
  isSessionId,
  isStorageId,
  isOperationId,
  isBatchId,
  isValidSubtitleContent,
  validateStorageConfig,
  
  // Branded identifier creators
  createWorkspaceId,
  createSessionId,
  createOperationId,
  
  // Utility functions
  deepClone,
  safeJsonParse,
  debounce,
  throttle,
  createRetryFunction
} from './renderer/src/types/subtitle-temp-storage-utils'

export {};