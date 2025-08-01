/**
 * Configuration Manager Types - Main Export Index
 * 
 * Centralized export point for all configuration manager TypeScript types,
 * interfaces, utilities, and integration patterns.
 */

// ============================================================================
// CORE CONFIGURATION MANAGER TYPES
// ============================================================================

export type {
  // Configuration categorization
  ConfigKeyCategory,
  WorkspaceSpecificKeys,
  GlobalConfigKeys,
  WorkspaceConfigTarget,
  ConfigKeyCategorization,
  
  // Configuration operations
  ConfigUpdateOptions,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigValidationWarning,
  ConfigOperationResult,
  
  // State management
  ConfigManagerState,
  PendingConfigUpdate,
  ConfigSyncStatus,
  ConfigSyncError,
  
  // Workspace transitions
  WorkspaceTransitionState,
  MigrationProgress,
  
  // Error handling
  ConfigErrorType,
  ErrorRecoveryStrategy,
  RetryPolicy,
  
  // Core service interface
  ConfigurationManager,
  
  // Context and hooks
  UnifiedConfigContext,
  UnifiedConfigHook,
  MigrationHookResult,
  
  // Utility types
  WorkspaceConfig,
  ConfigValidator,
  ConfigTransformer,
  TypeSafeConfigOperation
} from './config-manager'

// ============================================================================
// ERROR CLASSES
// ============================================================================

export {
  // Base error class
  ConfigError,
  
  // Specific error types
  ConfigValidationError,
  ConfigStorageError,
  ConfigSyncError
} from './config-manager'

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

export {
  // Default configurations
  DEFAULT_RETRY_POLICY,
  DEFAULT_CONFIG_UPDATE_OPTIONS,
  CONFIG_KEY_CATEGORIES,
  
  // Utility functions
  isWorkspaceSpecificKey,
  isGlobalKey,
  categorizeConfigKey,
  determineConfigTarget
} from './config-manager'

// ============================================================================
// REACT CONTEXT AND HOOKS
// ============================================================================

export type {
  // Provider types
  ConfigContextProviderProps,
  ConfigErrorBoundaryProps,
  ConfigPerformanceMetrics,
  
  // Hook types
  ConfigHookState,
  ConfigHookActions,
  ConfigValidationHook,
  ConfigSyncHook,
  ConfigWorkspaceHook,
  CompositeConfigHook,
  
  // Factory types
  ConfigHookOptions,
  ConfigProviderFactory,
  ConfigProviderFactoryOptions,
  
  // Context types
  ConfigContextValue,
  ConfigContext,
  
  // Middleware types
  ConfigMiddleware,
  ConfigMiddlewareManager,
  
  // Testing types
  ConfigTestUtils
} from './config-context'

// ============================================================================
// ADVANCED UTILITY TYPES
// ============================================================================

export type {
  // Mapped types
  KeysByCategory,
  ConfigByCategory,
  WorkspaceConfig as UtilityWorkspaceConfig,
  GlobalConfig,
  SystemConfig,
  
  // Conditional types
  ConfigResultByKey,
  RequiresWorkspace,
  ValidationRequirement,
  
  // Template literal types
  ConfigEventName,
  WorkspaceEventName,
  SystemEventName,
  AllConfigEventNames,
  
  // Generic types
  TypedConfigOperation as UtilityTypedConfigOperation,
  BatchConfigOperation,
  ConfigChangeEvent,
  ConfigSubscription,
  
  // Deep types
  DeepPartial,
  DeepReadonly,
  ConfigPath,
  ConfigValueByPath,
  
  // Branded types
  WorkspaceId,
  ConfigKey,
  Timestamp,
  
  // Discriminated unions
  ConfigOperationResultUnion,
  ConfigTargetUnion,
  
  // Function overload types
  ConfigGetter,
  ConfigSetter,
  
  // Utility function types
  ConfigKeyValidator,
  ConfigValueTypeGuard,
  ConfigTransformer as UtilityConfigTransformer,
  ConfigComparator
} from './config-utilities'

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export {
  // Branded type creators
  createWorkspaceId,
  createConfigKey,
  createTimestamp,
  
  // Type predicates and guards
  isWorkspaceSpecificKey as utilityIsWorkspaceSpecificKey,
  isGlobalKey as utilityIsGlobalKey,
  isConfigError,
  isSuccessfulConfigResult
} from './config-utilities'

// ============================================================================
// IMPLEMENTATION EXAMPLES
// ============================================================================

export {
  // Type-safe configuration builder
  TypeSafeConfigBuilder,
  
  // Configuration validators
  ConfigValidators,
  
  // Configuration transformers
  ConfigTransformers,
  
  // Usage examples
  typesSafeConfigExample,
  comprehensiveUsageExample,
  useTypeSafeConfig
} from './config-manager-examples'

// ============================================================================
// RE-EXPORTS FROM BASE TYPES
// ============================================================================

export type {
  // Core app types
  AppConfig,
  SubtitleData,
  ProcessingState,
  UIState,
  AppState
} from './index'

export type {
  // Workspace types
  WorkflowStepId
} from '../renderer/src/types/workspace'

// ============================================================================
// TYPE ASSERTION HELPERS
// ============================================================================

/**
 * Type assertion helper for configuration manager
 */
export const assertConfigManager = (
  manager: unknown
): asserts manager is ConfigurationManager => {
  if (!manager || typeof manager !== 'object') {
    throw new Error('Invalid configuration manager: must be an object')
  }
  
  const required = [
    'getConfig',
    'setConfig',
    'updateConfig',
    'getFullConfig',
    'validateConfig',
    'switchWorkspace'
  ]
  
  for (const method of required) {
    if (!(method in manager) || typeof (manager as any)[method] !== 'function') {
      throw new Error(`Invalid configuration manager: missing method '${method}'`)
    }
  }
}

/**
 * Type assertion helper for configuration context
 */
export const assertConfigContext = (
  context: unknown
): asserts context is UnifiedConfigContext => {
  if (!context || typeof context !== 'object') {
    throw new Error('Invalid configuration context: must be an object')
  }
  
  const required = ['configManager', 'config', 'isLoading', 'syncStatus']
  
  for (const prop of required) {
    if (!(prop in context)) {
      throw new Error(`Invalid configuration context: missing property '${prop}'`)
    }
  }
}

// ============================================================================
// VERSION AND COMPATIBILITY
// ============================================================================

/**
 * Configuration manager type version
 */
export const CONFIG_MANAGER_TYPES_VERSION = '1.0.0' as const

/**
 * TypeScript version compatibility
 */
export const TYPESCRIPT_VERSION_REQUIREMENT = '>=4.9.0' as const

/**
 * React version compatibility
 */
export const REACT_VERSION_REQUIREMENT = '>=18.0.0' as const

// ============================================================================
// DOCUMENTATION LINKS
// ============================================================================

/**
 * Documentation and usage guide links
 */
export const DOCUMENTATION_LINKS = {
  CONFIGURATION_MANAGER: '/docs/config-manager',
  TYPE_SAFETY_GUIDE: '/docs/type-safety',
  WORKSPACE_INTEGRATION: '/docs/workspace-integration',
  ERROR_HANDLING: '/docs/error-handling',
  REACT_INTEGRATION: '/docs/react-integration',
  MIGRATION_GUIDE: '/docs/migration'
} as const