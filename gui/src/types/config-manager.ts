/**
 * Centralized Workspace Configuration Manager Types
 * 
 * Comprehensive TypeScript interfaces for workspace-aware configuration management,
 * error handling, validation, and migration support.
 */

import type { AppConfig } from './index'
import type { WorkflowStepId } from '../renderer/src/types/workspace'

// ============================================================================
// CONFIGURATION KEY CATEGORIZATION
// ============================================================================

/**
 * Configuration key categories for workspace-aware routing
 */
export type ConfigKeyCategory = 'workspace-specific' | 'global' | 'system'

/**
 * Workspace-specific configuration keys
 */
export type WorkspaceSpecificKeys = 
  | 'inputFile' 
  | 'outputFile' 
  | 'language' 
  | 'model' 
  | 'priority'
  | 'speakers' 
  | 'written' 
  | 'music' 
  | 'charset' 
  | 'noGeminiRefinement'
  | 'maxChunkDuration' 
  | 'videoQuality' 
  | 'terminologyConfig'
  | 'subtitle' 
  | 'duration' 
  | 'verbose' 
  | 'startTime' 
  | 'endTime' 
  | 'importedJsonFile'

/**
 * Global/system-wide configuration keys
 */
export type GlobalConfigKeys = 
  | 'geminiKey' 
  | 'hfToken' 
  | 'ffmpegPath'

/**
 * Configuration target for routing decisions
 */
export type WorkspaceConfigTarget = 
  | { type: 'workspace'; workspaceId: string }
  | { type: 'global' }
  | { type: 'fallback-local' }

// ============================================================================
// CONFIGURATION MANAGER INTERFACES
// ============================================================================

/**
 * Options for configuration update operations
 */
export interface ConfigUpdateOptions {
  /** Validate configuration before applying */
  validate?: boolean
  /** Create backup before update */
  backup?: boolean
  /** Silent mode - suppress notifications */
  silent?: boolean
  /** Force update even if validation fails */
  force?: boolean
  /** Retry configuration for failed operations */
  retry?: RetryPolicy
  /** Timeout for async operations */
  timeout?: number
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult<TValue = any> {
  /** Validation success status */
  isValid: boolean
  /** Validation errors */
  errors: ConfigValidationError[]
  /** Validation warnings */
  warnings: ConfigValidationWarning[]
  /** Validated value (potentially transformed) */
  validatedValue?: TValue
  /** Suggested corrections */
  suggestions?: string[]
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  /** Configuration key that failed validation */
  key: keyof AppConfig
  /** Error message */
  message: string
  /** Current invalid value */
  value: any
  /** Expected value type or format */
  expected?: string
  /** Error severity */
  severity: 'error' | 'warning'
}

/**
 * Configuration validation warning
 */
export interface ConfigValidationWarning {
  /** Configuration key with warning */
  key: keyof AppConfig
  /** Warning message */
  message: string
  /** Current value */
  value: any
  /** Recommended action */
  recommendation?: string
}

/**
 * Internal state management for configuration manager
 */
export interface ConfigManagerState {
  /** Currently active workspace ID */
  activeWorkspaceId: string | null
  /** Cached workspace configurations */
  workspaceConfigCache: Map<string, AppConfig>
  /** Global configuration cache */
  globalConfigCache: AppConfig | null
  /** Pending configuration updates */
  pendingUpdates: Map<string, PendingConfigUpdate>
  /** Sync status tracking */
  syncStatus: ConfigSyncStatus
  /** Error state */
  errors: ConfigError[]
  /** Last successful sync timestamp */
  lastSyncTime: number | null
  /** Migration state */
  migrationState: WorkspaceTransitionState | null
}

/**
 * Pending configuration update
 */
export interface PendingConfigUpdate {
  /** Configuration key */
  key: keyof AppConfig
  /** New value */
  value: any
  /** Target location */
  target: WorkspaceConfigTarget
  /** Update options */
  options: ConfigUpdateOptions
  /** Timestamp when update was queued */
  timestamp: number
  /** Retry count */
  retryCount: number
}

/**
 * Configuration synchronization status
 */
export interface ConfigSyncStatus {
  /** Overall sync status */
  status: 'synced' | 'syncing' | 'error' | 'offline'
  /** Last sync attempt timestamp */
  lastSyncAttempt: number | null
  /** Last successful sync timestamp */
  lastSuccessfulSync: number | null
  /** Pending sync operations count */
  pendingSyncCount: number
  /** Sync errors */
  syncErrors: ConfigSyncError[]
}

/**
 * Configuration sync error
 */
export interface ConfigSyncError {
  /** Error ID */
  id: string
  /** Configuration key that failed to sync */
  key: keyof AppConfig
  /** Target that failed */
  target: WorkspaceConfigTarget
  /** Error message */
  message: string
  /** Error timestamp */
  timestamp: number
  /** Retry attempts made */
  retryAttempts: number
}

// ============================================================================
// WORKSPACE TRANSITION & MIGRATION
// ============================================================================

/**
 * Workspace transition state for handling workspace switches
 */
export interface WorkspaceTransitionState {
  /** Transition status */
  status: 'preparing' | 'loading' | 'saving' | 'syncing' | 'completed' | 'failed'
  /** Source workspace ID (null for initial load) */
  fromWorkspaceId: string | null
  /** Target workspace ID */
  toWorkspaceId: string
  /** Configuration migration progress */
  migrationProgress: MigrationProgress
  /** Backup information */
  backup?: {
    path: string
    timestamp: number
    size: number
  }
  /** Transition start time */
  startTime: number
  /** Error information if transition failed */
  error?: ConfigError
}

/**
 * Migration progress tracking
 */
export interface MigrationProgress {
  /** Current migration step */
  currentStep: 'backup' | 'validate' | 'transform' | 'apply' | 'verify'
  /** Steps completed */
  stepsCompleted: number
  /** Total steps */
  totalSteps: number
  /** Progress percentage (0-100) */
  percentage: number
  /** Current operation message */
  message: string
  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number
}

// ============================================================================
// ERROR HANDLING SYSTEM
// ============================================================================

/**
 * Configuration error types
 */
export enum ConfigErrorType {
  // Validation errors
  VALIDATION_FAILED = 'validation_failed',
  INVALID_VALUE = 'invalid_value',
  MISSING_REQUIRED = 'missing_required',
  TYPE_MISMATCH = 'type_mismatch',
  
  // Storage errors
  STORAGE_ERROR = 'storage_error',
  WORKSPACE_NOT_FOUND = 'workspace_not_found',
  PERMISSION_DENIED = 'permission_denied',
  QUOTA_EXCEEDED = 'quota_exceeded',
  
  // Sync errors
  SYNC_FAILED = 'sync_failed',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  CONFLICT_ERROR = 'conflict_error',
  
  // Migration errors
  MIGRATION_FAILED = 'migration_failed',
  BACKUP_FAILED = 'backup_failed',
  ROLLBACK_FAILED = 'rollback_failed',
  
  // System errors
  SYSTEM_ERROR = 'system_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Base configuration error class
 */
export class ConfigError extends Error {
  public readonly type: ConfigErrorType
  public readonly key?: keyof AppConfig
  public readonly value?: any
  public readonly target?: WorkspaceConfigTarget
  public readonly timestamp: number
  public readonly retryable: boolean
  public readonly context?: Record<string, any>

  constructor(
    type: ConfigErrorType,
    message: string,
    options?: {
      key?: keyof AppConfig
      value?: any
      target?: WorkspaceConfigTarget
      retryable?: boolean
      context?: Record<string, any>
      cause?: Error
    }
  ) {
    super(message)
    this.name = 'ConfigError'
    this.type = type
    this.key = options?.key
    this.value = options?.value
    this.target = options?.target
    this.timestamp = Date.now()
    this.retryable = options?.retryable ?? false
    this.context = options?.context
    this.cause = options?.cause
  }
}

/**
 * Specific error types
 */
export class ConfigValidationError extends ConfigError {
  constructor(
    key: keyof AppConfig,
    value: any,
    message: string,
    expected?: string
  ) {
    super(ConfigErrorType.VALIDATION_FAILED, message, {
      key,
      value,
      retryable: false,
      context: { expected }
    })
  }
}

export class ConfigStorageError extends ConfigError {
  constructor(
    message: string,
    target: WorkspaceConfigTarget,
    cause?: Error
  ) {
    super(ConfigErrorType.STORAGE_ERROR, message, {
      target,
      retryable: true,
      cause
    })
  }
}

export class ConfigSyncError extends ConfigError {
  constructor(
    key: keyof AppConfig,
    target: WorkspaceConfigTarget,
    message: string,
    cause?: Error
  ) {
    super(ConfigErrorType.SYNC_FAILED, message, {
      key,
      target,
      retryable: true,
      cause
    })
  }
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Base delay between retries (ms) */
  baseDelay: number
  /** Maximum delay between retries (ms) */
  maxDelay: number
  /** Exponential backoff multiplier */
  backoffMultiplier: number
  /** Jitter factor (0-1) for randomization */
  jitterFactor: number
  /** Predicate to determine if error is retryable */
  shouldRetry?: (error: ConfigError, attempt: number) => boolean
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  /** Strategy type */
  type: 'retry' | 'fallback' | 'ignore' | 'user-intervention'
  /** Recovery options */
  options?: {
    /** Fallback configuration */
    fallbackConfig?: Partial<AppConfig>
    /** Fallback target */
    fallbackTarget?: WorkspaceConfigTarget
    /** User intervention callback */
    onUserIntervention?: (error: ConfigError) => Promise<boolean>
    /** Maximum recovery attempts */
    maxRecoveryAttempts?: number
  }
}

// ============================================================================
// CONFIGURATION MANAGER SERVICE INTERFACE
// ============================================================================

/**
 * Core configuration manager service interface
 */
export interface ConfigurationManager {
  // Core configuration operations
  getConfig<K extends keyof AppConfig>(
    key: K,
    workspaceId?: string
  ): Promise<AppConfig[K] | null>
  
  setConfig<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResult<AppConfig[K]>>
  
  updateConfig(
    updates: Partial<AppConfig>,
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResult<AppConfig>>
  
  getFullConfig(workspaceId?: string): Promise<AppConfig | null>
  
  resetConfig(
    keys?: (keyof AppConfig)[],
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResult<AppConfig>>
  
  // Validation
  validateConfig<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ): Promise<ConfigValidationResult<AppConfig[K]>>
  
  validateFullConfig(config: Partial<AppConfig>): Promise<ConfigValidationResult<AppConfig>>
  
  // Workspace management
  switchWorkspace(workspaceId: string): Promise<ConfigOperationResult<WorkspaceTransitionState>>
  
  syncWorkspaceConfig(
    workspaceId: string,
    config?: Partial<AppConfig>
  ): Promise<ConfigOperationResult<AppConfig>>
  
  // Migration support
  migrateFromLegacy(): Promise<ConfigOperationResult<MigrationProgress>>
  
  createConfigBackup(workspaceId?: string): Promise<ConfigOperationResult<string>>
  
  restoreConfigBackup(backupPath: string): Promise<ConfigOperationResult<AppConfig>>
  
  // State management
  getState(): ConfigManagerState
  
  subscribe(callback: (state: ConfigManagerState) => void): () => void
  
  // Error handling
  getLastError(): ConfigError | null
  
  clearErrors(): void
  
  // Cleanup
  dispose(): Promise<void>
}

/**
 * Configuration operation result
 */
export interface ConfigOperationResult<T = any> {
  /** Operation success status */
  success: boolean
  /** Result data */
  data?: T
  /** Operation error */
  error?: ConfigError
  /** Additional metadata */
  metadata?: {
    /** Operation duration (ms) */
    duration: number
    /** Target used for operation */
    target: WorkspaceConfigTarget
    /** Whether fallback was used */
    usedFallback: boolean
    /** Validation results if applicable */
    validation?: ConfigValidationResult
  }
}

// ============================================================================
// CONTEXT AND HOOK INTERFACES
// ============================================================================

/**
 * Unified configuration context interface
 */
export interface UnifiedConfigContext {
  /** Configuration manager instance */
  configManager: ConfigurationManager
  /** Current configuration state */
  config: AppConfig
  /** Current workspace ID */
  workspaceId: string | null
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: ConfigError | null
  /** Sync status */
  syncStatus: ConfigSyncStatus
}

/**
 * Configuration context provider props
 */
export interface ConfigContextProviderProps {
  /** Child components */
  children: React.ReactNode
  /** Initial workspace ID */
  initialWorkspaceId?: string
  /** Configuration manager instance */
  configManager?: ConfigurationManager
  /** Error boundary configuration */
  errorBoundary?: {
    fallbackComponent?: React.ComponentType<{ error: ConfigError }>
    onError?: (error: ConfigError) => void
  }
}

/**
 * Unified configuration hook return type
 */
export interface UnifiedConfigHook {
  // Configuration access
  config: AppConfig
  getConfig: <K extends keyof AppConfig>(key: K) => AppConfig[K] | null
  
  // Configuration updates
  setConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
    options?: ConfigUpdateOptions
  ) => Promise<ConfigOperationResult<AppConfig[K]>>
  
  updateConfig: (
    updates: Partial<AppConfig>,
    options?: ConfigUpdateOptions
  ) => Promise<ConfigOperationResult<AppConfig>>
  
  resetConfig: (
    keys?: (keyof AppConfig)[],
    options?: ConfigUpdateOptions
  ) => Promise<ConfigOperationResult<AppConfig>>
  
  // Validation
  validateConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ) => Promise<ConfigValidationResult<AppConfig[K]>>
  
  // State information
  workspaceId: string | null
  isLoading: boolean
  error: ConfigError | null
  syncStatus: ConfigSyncStatus
  
  // Workspace operations
  switchWorkspace: (workspaceId: string) => Promise<ConfigOperationResult<WorkspaceTransitionState>>
  
  // Error handling
  clearErrors: () => void
}

/**
 * Migration hook result
 */
export interface MigrationHookResult {
  /** Migration status */
  migrationStatus: MigrationProgress | null
  /** Start migration */
  startMigration: () => Promise<ConfigOperationResult<MigrationProgress>>
  /** Check if migration is needed */
  needsMigration: boolean
  /** Migration error */
  migrationError: ConfigError | null
}

// ============================================================================
// UTILITY TYPES AND FUNCTIONS
// ============================================================================

/**
 * Type-safe configuration key categorization
 */
export type ConfigKeyCategorization = {
  [K in keyof AppConfig]: K extends WorkspaceSpecificKeys
    ? 'workspace-specific'
    : K extends GlobalConfigKeys
    ? 'global'
    : 'system'
}

/**
 * Conditional type for workspace-specific configuration
 */
export type WorkspaceConfig<T extends keyof AppConfig> = T extends WorkspaceSpecificKeys
  ? { workspaceId: string; config: Pick<AppConfig, T> }
  : { config: Pick<AppConfig, T> }

/**
 * Type utility for configuration validation
 */
export type ConfigValidator<T = any> = (value: T) => ConfigValidationResult<T>

/**
 * Type utility for configuration transformers
 */
export type ConfigTransformer<TInput = any, TOutput = any> = (value: TInput) => TOutput

/**
 * Generic configuration operation with type safety
 */
export type TypeSafeConfigOperation<
  K extends keyof AppConfig,
  T extends AppConfig[K] = AppConfig[K]
> = {
  key: K
  value: T
  target: WorkspaceConfigTarget
  validator?: ConfigValidator<T>
  transformer?: ConfigTransformer<T, T>
}

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  shouldRetry: (error: ConfigError, attempt: number) => 
    error.retryable && attempt < 3
}

/**
 * Default config update options
 */
export const DEFAULT_CONFIG_UPDATE_OPTIONS: ConfigUpdateOptions = {
  validate: true,
  backup: false,
  silent: false,
  force: false,
  retry: DEFAULT_RETRY_POLICY,
  timeout: 5000
}

/**
 * Configuration key categorization map
 */
export const CONFIG_KEY_CATEGORIES: ConfigKeyCategorization = {
  inputFile: 'workspace-specific',
  outputFile: 'workspace-specific',
  language: 'workspace-specific',
  model: 'workspace-specific',
  priority: 'workspace-specific',
  speakers: 'workspace-specific',
  written: 'workspace-specific',
  music: 'workspace-specific',
  charset: 'workspace-specific',
  noGeminiRefinement: 'workspace-specific',
  maxChunkDuration: 'workspace-specific',
  videoQuality: 'workspace-specific',
  terminologyConfig: 'workspace-specific',
  subtitle: 'workspace-specific',
  duration: 'workspace-specific',
  verbose: 'workspace-specific',
  startTime: 'workspace-specific',
  endTime: 'workspace-specific',
  importedJsonFile: 'workspace-specific',
  geminiKey: 'global',
  hfToken: 'global',
  ffmpegPath: 'global'
} as const

// ============================================================================
// UTILITY FUNCTIONS TYPE DEFINITIONS
// ============================================================================

/**
 * Type guard for workspace-specific keys
 */
export const isWorkspaceSpecificKey = (key: keyof AppConfig): key is WorkspaceSpecificKeys =>
  CONFIG_KEY_CATEGORIES[key] === 'workspace-specific'

/**
 * Type guard for global keys
 */
export const isGlobalKey = (key: keyof AppConfig): key is GlobalConfigKeys =>
  CONFIG_KEY_CATEGORIES[key] === 'global'

/**
 * Configuration key categorization utility
 */
export const categorizeConfigKey = (key: keyof AppConfig): ConfigKeyCategory =>
  CONFIG_KEY_CATEGORIES[key]

/**
 * Determine configuration target based on key and workspace context
 */
export const determineConfigTarget = (
  key: keyof AppConfig,
  workspaceId?: string | null
): WorkspaceConfigTarget => {
  if (isWorkspaceSpecificKey(key) && workspaceId) {
    return { type: 'workspace', workspaceId }
  }
  if (isGlobalKey(key)) {
    return { type: 'global' }
  }
  return { type: 'fallback-local' }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Re-export key types for convenience
export type {
  AppConfig,
  WorkflowStepId
}