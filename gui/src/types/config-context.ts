/**
 * Configuration Context Types
 * 
 * React Context and Hook type definitions for the centralized
 * workspace configuration manager integration.
 */

import type { ReactNode, Context } from 'react'
import type {
  ConfigurationManager,
  UnifiedConfigContext,
  UnifiedConfigHook,
  ConfigUpdateOptions,
  ConfigValidationResult,
  ConfigOperationResult,
  ConfigError,
  ConfigSyncStatus,
  WorkspaceTransitionState,
  MigrationHookResult
} from './config-manager'
import type { AppConfig } from './index'

// ============================================================================
// REACT CONTEXT TYPES
// ============================================================================

/**
 * Configuration context provider props
 */
export interface ConfigContextProviderProps {
  /** Child components */
  children: ReactNode
  /** Configuration manager instance */
  configManager: ConfigurationManager
  /** Initial workspace ID */
  initialWorkspaceId?: string
  /** Enable automatic error recovery */
  enableAutoRecovery?: boolean
  /** Error boundary configuration */
  errorBoundary?: {
    /** Fallback component for configuration errors */
    fallbackComponent?: React.ComponentType<ConfigErrorBoundaryProps>
    /** Error event handler */
    onError?: (error: ConfigError, errorInfo: React.ErrorInfo) => void
    /** Recovery attempt handler */
    onRetry?: () => void
  }
  /** Performance monitoring configuration */
  performanceMonitoring?: {
    /** Enable performance tracking */
    enabled: boolean
    /** Sample rate (0-1) */
    sampleRate: number
    /** Metrics callback */
    onMetrics?: (metrics: ConfigPerformanceMetrics) => void
  }
}

/**
 * Configuration error boundary props
 */
export interface ConfigErrorBoundaryProps {
  /** Configuration error that occurred */
  error: ConfigError
  /** Error details from React */
  errorInfo?: React.ErrorInfo
  /** Retry handler */
  onRetry?: () => void
  /** Fallback to previous configuration */
  onFallback?: () => void
}

/**
 * Configuration performance metrics
 */
export interface ConfigPerformanceMetrics {
  /** Operation type */
  operation: 'get' | 'set' | 'update' | 'validate' | 'migrate'
  /** Operation duration (ms) */
  duration: number
  /** Success status */
  success: boolean
  /** Configuration key involved */
  key?: keyof AppConfig
  /** Target type */
  target?: 'workspace' | 'global' | 'fallback'
  /** Error type if failed */
  errorType?: string
  /** Timestamp */
  timestamp: number
}

// ============================================================================
// HOOK STATE TYPES
// ============================================================================

/**
 * Configuration hook state
 */
export interface ConfigHookState {
  /** Current configuration */
  config: AppConfig
  /** Current workspace ID */
  workspaceId: string | null
  /** Loading states */
  loading: {
    /** Overall loading state */
    isLoading: boolean
    /** Loading specific operations */
    operations: {
      get: boolean
      set: boolean
      update: boolean
      validate: boolean
      migrate: boolean
      switch: boolean
    }
  }
  /** Error state */
  error: ConfigError | null
  /** Sync status */
  syncStatus: ConfigSyncStatus
  /** Last operation result */
  lastOperation?: {
    type: string
    timestamp: number
    success: boolean
    duration: number
  }
}

/**
 * Configuration hook actions
 */
export interface ConfigHookActions {
  /** Get single configuration value */
  getConfig: <K extends keyof AppConfig>(
    key: K,
    options?: { 
      useCache?: boolean
      timeout?: number 
    }
  ) => Promise<AppConfig[K] | null>
  
  /** Set single configuration value */
  setConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
    options?: ConfigUpdateOptions
  ) => Promise<ConfigOperationResult<AppConfig[K]>>
  
  /** Update multiple configuration values */
  updateConfig: (
    updates: Partial<AppConfig>,
    options?: ConfigUpdateOptions
  ) => Promise<ConfigOperationResult<AppConfig>>
  
  /** Reset configuration values */
  resetConfig: (
    keys?: (keyof AppConfig)[],
    options?: ConfigUpdateOptions
  ) => Promise<ConfigOperationResult<AppConfig>>
  
  /** Validate configuration */
  validateConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ) => Promise<ConfigValidationResult<AppConfig[K]>>
  
  /** Switch workspace */
  switchWorkspace: (
    workspaceId: string
  ) => Promise<ConfigOperationResult<WorkspaceTransitionState>>
  
  /** Refresh configuration from source */
  refreshConfig: () => Promise<ConfigOperationResult<AppConfig>>
  
  /** Clear errors */
  clearErrors: () => void
  
  /** Force sync */
  forceSync: () => Promise<ConfigOperationResult<ConfigSyncStatus>>
}

// ============================================================================
// SPECIALIZED HOOK TYPES
// ============================================================================

/**
 * Configuration validation hook result
 */
export interface ConfigValidationHook {
  /** Validate single config value */
  validate: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ) => Promise<ConfigValidationResult<AppConfig[K]>>
  
  /** Validate full configuration */
  validateFull: (config: Partial<AppConfig>) => Promise<ConfigValidationResult<AppConfig>>
  
  /** Real-time validation state */
  validationState: {
    [K in keyof AppConfig]?: {
      isValid: boolean
      errors: string[]
      warnings: string[]
      lastValidated: number
    }
  }
  
  /** Validation in progress */
  isValidating: boolean
  
  /** Clear validation state */
  clearValidation: (key?: keyof AppConfig) => void
}

/**
 * Configuration sync hook result
 */
export interface ConfigSyncHook {
  /** Current sync status */
  syncStatus: ConfigSyncStatus
  
  /** Force synchronization */
  sync: (workspaceId?: string) => Promise<ConfigOperationResult<ConfigSyncStatus>>
  
  /** Auto-sync configuration */
  autoSync: {
    enabled: boolean
    interval: number
    lastSync: number | null
    toggle: (enabled: boolean) => void
    setInterval: (interval: number) => void
  }
  
  /** Sync conflicts */
  conflicts: Array<{
    key: keyof AppConfig
    localValue: any
    remoteValue: any
    timestamp: number
  }>
  
  /** Resolve sync conflict */
  resolveConflict: (
    key: keyof AppConfig,
    resolution: 'local' | 'remote' | 'merge',
    customValue?: any
  ) => Promise<ConfigOperationResult<any>>
}

/**
 * Configuration workspace hook result
 */
export interface ConfigWorkspaceHook {
  /** Current workspace ID */
  workspaceId: string | null
  
  /** Switch workspace */
  switchWorkspace: (workspaceId: string) => Promise<ConfigOperationResult<WorkspaceTransitionState>>
  
  /** Workspace transition state */
  transitionState: WorkspaceTransitionState | null
  
  /** Available workspaces */
  availableWorkspaces: Array<{
    id: string
    name: string
    lastUsed: number
    configCount: number
  }>
  
  /** Refresh workspace list */
  refreshWorkspaces: () => Promise<void>
  
  /** Create new workspace with current config */
  createWorkspaceFromCurrent: (name: string) => Promise<ConfigOperationResult<string>>
}

// ============================================================================
// HOOK FACTORY TYPES
// ============================================================================

/**
 * Configuration hook factory options
 */
export interface ConfigHookOptions {
  /** Enable real-time updates */
  realTime?: boolean
  /** Cache configuration locally */
  enableCache?: boolean
  /** Cache TTL in milliseconds */
  cacheTTL?: number
  /** Enable optimistic updates */
  optimisticUpdates?: boolean
  /** Error recovery strategy */
  errorRecovery?: 'retry' | 'fallback' | 'none'
  /** Performance monitoring */
  performanceMonitoring?: boolean
  /** Debug logging */
  debug?: boolean
}

/**
 * Composite configuration hook result
 */
export interface CompositeConfigHook extends 
  ConfigHookState,
  ConfigHookActions {
  /** Validation utilities */
  validation: ConfigValidationHook
  
  /** Sync utilities */
  sync: ConfigSyncHook
  
  /** Workspace utilities */
  workspace: ConfigWorkspaceHook
  
  /** Migration utilities */
  migration: MigrationHookResult
  
  /** Performance metrics */
  performance: {
    metrics: ConfigPerformanceMetrics[]
    averageLatency: number
    errorRate: number
    cacheHitRate: number
  }
}

// ============================================================================
// CONTEXT CREATION TYPES
// ============================================================================

/**
 * Configuration context value
 */
export interface ConfigContextValue {
  /** Configuration manager instance */
  configManager: ConfigurationManager
  /** Current state */
  state: ConfigHookState
  /** Actions */
  actions: ConfigHookActions
  /** Specialized hooks */
  hooks: {
    validation: ConfigValidationHook
    sync: ConfigSyncHook
    workspace: ConfigWorkspaceHook
    migration: MigrationHookResult
  }
}

/**
 * Configuration context type
 */
export type ConfigContext = Context<ConfigContextValue | null>

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

/**
 * Configuration middleware for request/response interception
 */
export interface ConfigMiddleware {
  /** Middleware name */
  name: string
  /** Request interceptor */
  beforeRequest?: <K extends keyof AppConfig>(
    operation: 'get' | 'set' | 'update' | 'validate',
    key: K,
    value?: AppConfig[K],
    options?: any
  ) => Promise<void> | void
  /** Response interceptor */
  afterResponse?: <K extends keyof AppConfig>(
    operation: 'get' | 'set' | 'update' | 'validate',
    key: K,
    result: any,
    error?: ConfigError
  ) => Promise<void> | void
  /** Error interceptor */
  onError?: (error: ConfigError, context: any) => Promise<boolean> | boolean
}

/**
 * Configuration middleware manager
 */
export interface ConfigMiddlewareManager {
  /** Add middleware */
  use(middleware: ConfigMiddleware): void
  /** Remove middleware */
  remove(name: string): void
  /** Get all middleware */
  getAll(): ConfigMiddleware[]
  /** Execute before request middleware */
  executeBeforeRequest: (
    operation: string,
    key: keyof AppConfig,
    value?: any,
    options?: any
  ) => Promise<void>
  /** Execute after response middleware */
  executeAfterResponse: (
    operation: string,
    key: keyof AppConfig,
    result: any,
    error?: ConfigError
  ) => Promise<void>
  /** Execute error middleware */
  executeOnError: (error: ConfigError, context: any) => Promise<boolean>
}

// ============================================================================
// PROVIDER FACTORY TYPES
// ============================================================================

/**
 * Configuration provider factory options
 */
export interface ConfigProviderFactoryOptions {
  /** Configuration manager factory */
  createConfigManager: () => ConfigurationManager
  /** Default workspace ID */
  defaultWorkspaceId?: string
  /** Middleware to include */
  middleware?: ConfigMiddleware[]
  /** Context options */
  contextOptions?: {
    /** Enable development tools */
    devtools?: boolean
    /** Context display name */
    displayName?: string
  }
  /** Performance options */
  performance?: {
    /** Enable performance monitoring */
    enabled: boolean
    /** Monitoring sample rate */
    sampleRate: number
  }
}

/**
 * Configuration provider factory result
 */
export interface ConfigProviderFactory {
  /** Provider component */
  Provider: React.ComponentType<Omit<ConfigContextProviderProps, 'configManager'>>
  /** Configuration context */
  Context: ConfigContext
  /** Hook factory */
  createHook: (options?: ConfigHookOptions) => () => CompositeConfigHook
  /** Middleware manager */
  middleware: ConfigMiddlewareManager
}

// ============================================================================
// TESTING TYPES
// ============================================================================

/**
 * Configuration testing utilities
 */
export interface ConfigTestUtils {
  /** Create mock configuration manager */
  createMockConfigManager: (
    initialConfig?: Partial<AppConfig>
  ) => ConfigurationManager
  
  /** Create test provider */
  TestProvider: React.ComponentType<{
    children: ReactNode
    initialConfig?: Partial<AppConfig>
    mockManager?: ConfigurationManager
  }>
  
  /** Wait for configuration updates */
  waitForConfigUpdate: (key: keyof AppConfig, timeout?: number) => Promise<void>
  
  /** Mock configuration operations */
  mockOperations: {
    get: jest.MockedFunction<any>
    set: jest.MockedFunction<any>
    update: jest.MockedFunction<any>
    validate: jest.MockedFunction<any>
  }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core context types
  UnifiedConfigContext,
  UnifiedConfigHook,
  
  // State and actions
  ConfigHookState,
  ConfigHookActions,
  
  // Specialized hooks
  ConfigValidationHook,
  ConfigSyncHook,
  ConfigWorkspaceHook,
  CompositeConfigHook,
  
  // Factory types
  ConfigProviderFactory,
  ConfigProviderFactoryOptions,
  
  // Middleware
  ConfigMiddleware,
  ConfigMiddlewareManager,
  
  // Testing
  ConfigTestUtils
}