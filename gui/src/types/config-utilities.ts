/**
 * Configuration Manager Utility Types
 * 
 * Advanced TypeScript utility types, mapped types, conditional types,
 * and helper functions for the configuration manager system.
 */

import type { AppConfig } from './index'
import type {
  WorkspaceSpecificKeys,
  GlobalConfigKeys,
  ConfigKeyCategory,
  WorkspaceConfigTarget,
  ConfigError,
  ConfigValidationResult,
  ConfigOperationResult
} from './config-manager'

// ============================================================================
// ADVANCED MAPPED TYPES
// ============================================================================

/**
 * Extract keys by category using mapped types
 */
export type KeysByCategory<T extends ConfigKeyCategory> = {
  [K in keyof AppConfig]: K extends WorkspaceSpecificKeys
    ? T extends 'workspace-specific'
      ? K
      : never
    : K extends GlobalConfigKeys
    ? T extends 'global'
      ? K
      : never
    : T extends 'system'
    ? K
    : never
}[keyof AppConfig]

/**
 * Configuration subset by category
 */
export type ConfigByCategory<T extends ConfigKeyCategory> = Pick<
  AppConfig,
  KeysByCategory<T>
>

/**
 * Workspace-specific configuration subset
 */
export type WorkspaceConfig = ConfigByCategory<'workspace-specific'>

/**
 * Global configuration subset
 */
export type GlobalConfig = ConfigByCategory<'global'>

/**
 * System configuration subset
 */
export type SystemConfig = ConfigByCategory<'system'>

// ============================================================================
// CONDITIONAL TYPES
// ============================================================================

/**
 * Conditional type for configuration operation result based on key type
 */
export type ConfigResultByKey<K extends keyof AppConfig> = K extends WorkspaceSpecificKeys
  ? ConfigOperationResult<AppConfig[K]> & {
      workspaceId: string
      target: Extract<WorkspaceConfigTarget, { type: 'workspace' }>
    }
  : K extends GlobalConfigKeys
  ? ConfigOperationResult<AppConfig[K]> & {
      target: Extract<WorkspaceConfigTarget, { type: 'global' }>
    }
  : ConfigOperationResult<AppConfig[K]> & {
      target: WorkspaceConfigTarget
    }

/**
 * Conditional type for required workspace context
 */
export type RequiresWorkspace<K extends keyof AppConfig> = K extends WorkspaceSpecificKeys
  ? { workspaceId: string }
  : { workspaceId?: string | null }

/**
 * Conditional type for configuration validation requirements
 */
export type ValidationRequirement<K extends keyof AppConfig> = K extends 
  | 'inputFile'
  | 'outputFile'
  | 'geminiKey'
  | 'hfToken'
  | 'startTime'
  | 'endTime'
  ? { validationRequired: true }
  : { validationRequired: false }

// ============================================================================
// TEMPLATE LITERAL TYPES
// ============================================================================

/**
 * Configuration event names using template literals
 */
export type ConfigEventName<K extends keyof AppConfig = keyof AppConfig> =
  | `config:${K}:updated`
  | `config:${K}:validated`
  | `config:${K}:error`
  | `config:${K}:synced`

/**
 * Workspace event names
 */
export type WorkspaceEventName =
  | `workspace:${string}:switched`
  | `workspace:${string}:created`
  | `workspace:${string}:deleted`
  | `workspace:${string}:synced`
  | `workspace:${string}:error`

/**
 * System event names
 */
export type SystemEventName =
  | 'config:manager:initialized'
  | 'config:manager:disposed'
  | 'config:sync:started'
  | 'config:sync:completed'
  | 'config:sync:failed'
  | 'config:migration:started'
  | 'config:migration:completed'
  | 'config:migration:failed'

/**
 * All configuration event names
 */
export type AllConfigEventNames = 
  | ConfigEventName
  | WorkspaceEventName
  | SystemEventName

// ============================================================================
// UTILITY FUNCTIONS WITH GENERIC CONSTRAINTS
// ============================================================================

/**
 * Type-safe configuration key validator
 */
export type ConfigKeyValidator = <K extends keyof AppConfig>(
  key: K
) => key is K

/**
 * Configuration value type guard
 */
export type ConfigValueTypeGuard<K extends keyof AppConfig> = (
  value: unknown
) => value is AppConfig[K]

/**
 * Configuration transformer with type constraints
 */
export type ConfigTransformer<
  K extends keyof AppConfig,
  TInput = AppConfig[K],
  TOutput = AppConfig[K]
> = (value: TInput) => TOutput

/**
 * Configuration comparator for change detection
 */
export type ConfigComparator<K extends keyof AppConfig> = (
  oldValue: AppConfig[K],
  newValue: AppConfig[K]
) => boolean

// ============================================================================
// ADVANCED GENERIC TYPES
// ============================================================================

/**
 * Configuration operation with generic key constraints
 */
export interface TypedConfigOperation<
  TKeys extends keyof AppConfig = keyof AppConfig,
  TOperation extends 'get' | 'set' | 'update' | 'delete' = 'get' | 'set' | 'update' | 'delete'
> {
  operation: TOperation
  keys: TKeys[]
  values?: TOperation extends 'set' | 'update' 
    ? { [K in TKeys]: AppConfig[K] }
    : never
  target: WorkspaceConfigTarget
  timestamp: number
}

/**
 * Configuration batch operation with type safety
 */
export interface BatchConfigOperation<TKeys extends keyof AppConfig = keyof AppConfig> {
  operations: Array<TypedConfigOperation<TKeys>>
  atomic: boolean
  rollbackOnError: boolean
  maxRetries: number
}

/**
 * Configuration change event with generic payload
 */
export interface ConfigChangeEvent<K extends keyof AppConfig = keyof AppConfig> {
  type: ConfigEventName<K>
  key: K
  oldValue: AppConfig[K] | null
  newValue: AppConfig[K]
  target: WorkspaceConfigTarget
  timestamp: number
  source: 'user' | 'system' | 'sync' | 'migration'
  metadata?: Record<string, any>
}

/**
 * Configuration subscription with type constraints
 */
export interface ConfigSubscription<K extends keyof AppConfig = keyof AppConfig> {
  keys: K[]
  callback: (events: ConfigChangeEvent<K>[]) => void
  options?: {
    immediate?: boolean
    debounce?: number
    filter?: (event: ConfigChangeEvent<K>) => boolean
  }
}

// ============================================================================
// RECURSIVE AND DEEP TYPES
// ============================================================================

/**
 * Deep partial configuration for updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P]
}

/**
 * Deep readonly configuration for immutable access
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Array<infer U>
      ? ReadonlyArray<DeepReadonly<U>>
      : DeepReadonly<T[P]>
    : T[P]
}

/**
 * Configuration path for nested access
 */
export type ConfigPath<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends object
    ? T[K] extends Array<any>
      ? K
      : K | `${K}.${ConfigPath<T[K]>}`
    : K
  : never

/**
 * Configuration value by path
 */
export type ConfigValueByPath<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends object
      ? ConfigValueByPath<T[K], Rest>
      : never
    : never
  : never

// ============================================================================
// BRANDED TYPES
// ============================================================================

/**
 * Branded workspace ID type
 */
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' }

/**
 * Branded configuration key type
 */
export type ConfigKey<K extends keyof AppConfig = keyof AppConfig> = K & {
  readonly __brand: 'ConfigKey'
}

/**
 * Branded timestamp type
 */
export type Timestamp = number & { readonly __brand: 'Timestamp' }

/**
 * Create branded workspace ID
 */
export const createWorkspaceId = (id: string): WorkspaceId => id as WorkspaceId

/**
 * Create branded config key  
 */
export const createConfigKey = <K extends keyof AppConfig>(key: K): ConfigKey<K> =>
  key as ConfigKey<K>

/**
 * Create branded timestamp
 */
export const createTimestamp = (time: number = Date.now()): Timestamp =>
  time as Timestamp

// ============================================================================
// DISCRIMINATED UNIONS
// ============================================================================

/**
 * Configuration operation result discriminated union
 */
export type ConfigOperationResultUnion<K extends keyof AppConfig> =
  | {
      success: true
      data: AppConfig[K]
      error?: never
      metadata: {
        operation: 'get' | 'set' | 'update'
        key: K
        target: WorkspaceConfigTarget
        duration: number
        cached: boolean
      }
    }
  | {
      success: false
      data?: never
      error: ConfigError
      metadata: {
        operation: 'get' | 'set' | 'update'
        key: K
        target: WorkspaceConfigTarget
        duration: number
        retryAttempts: number
      }
    }

/**
 * Configuration target discriminated union
 */
export type ConfigTargetUnion =
  | {
      type: 'workspace'
      workspaceId: WorkspaceId
      fallback?: never
    }
  | {
      type: 'global'
      workspaceId?: never
      fallback?: never
    }
  | {
      type: 'fallback-local'
      workspaceId?: never
      fallback: 'localStorage' | 'sessionStorage' | 'memory'
    }

// ============================================================================
// FUNCTION OVERLOAD TYPES
// ============================================================================

/**
 * Configuration getter with overloads
 */
export interface ConfigGetter {
  // Single key, workspace-specific
  <K extends WorkspaceSpecificKeys>(
    key: K,
    workspaceId: WorkspaceId
  ): Promise<AppConfig[K] | null>
  
  // Single key, global
  <K extends GlobalConfigKeys>(key: K): Promise<AppConfig[K] | null>
  
  // Multiple keys, workspace-specific
  <K extends WorkspaceSpecificKeys>(
    keys: K[],
    workspaceId: WorkspaceId
  ): Promise<Pick<AppConfig, K>>
  
  // Multiple keys, global
  <K extends GlobalConfigKeys>(keys: K[]): Promise<Pick<AppConfig, K>>
  
  // Full config
  (workspaceId?: WorkspaceId): Promise<AppConfig>
}

/**
 * Configuration setter with overloads
 */
export interface ConfigSetter {
  // Single key-value, workspace-specific
  <K extends WorkspaceSpecificKeys>(
    key: K,
    value: AppConfig[K],
    workspaceId: WorkspaceId,
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResultUnion<K>>
  
  // Single key-value, global
  <K extends GlobalConfigKeys>(
    key: K,
    value: AppConfig[K],
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResultUnion<K>>
  
  // Multiple key-values, workspace-specific
  <K extends WorkspaceSpecificKeys>(
    updates: Pick<AppConfig, K>,
    workspaceId: WorkspaceId,
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResult<Pick<AppConfig, K>>>
  
  // Multiple key-values, global
  <K extends GlobalConfigKeys>(
    updates: Pick<AppConfig, K>,
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResult<Pick<AppConfig, K>>>
}

// ============================================================================
// TYPE PREDICATES AND GUARDS
// ============================================================================

/**
 * Type predicate for workspace-specific keys
 */
export const isWorkspaceSpecificKey = <K extends keyof AppConfig>(
  key: K
): key is K & WorkspaceSpecificKeys => {
  const workspaceKeys: (keyof AppConfig)[] = [
    'inputFile', 'outputFile', 'language', 'model', 'priority',
    'speakers', 'written', 'music', 'charset', 'noGeminiRefinement',
    'maxChunkDuration', 'videoQuality', 'terminologyConfig',
    'subtitle', 'duration', 'verbose', 'startTime', 'endTime', 'importedJsonFile'
  ]
  return workspaceKeys.includes(key)
}

/**
 * Type predicate for global keys
 */
export const isGlobalKey = <K extends keyof AppConfig>(
  key: K
): key is K & GlobalConfigKeys => {
  const globalKeys: (keyof AppConfig)[] = ['geminiKey', 'hfToken', 'ffmpegPath']
  return globalKeys.includes(key)
}

/**
 * Type guard for configuration errors
 */
export const isConfigError = (error: unknown): error is ConfigError => {
  return error instanceof Error && 'type' in error && 'timestamp' in error
}

/**
 * Type guard for successful config operations
 */
export const isSuccessfulConfigResult = <T>(
  result: ConfigOperationResult<T>
): result is ConfigOperationResult<T> & { success: true; data: T } => {
  return result.success === true && result.data !== undefined
}

// ============================================================================
// UTILITY TYPE EXPORTS
// ============================================================================

export type {
  // Mapped types
  KeysByCategory,
  ConfigByCategory,
  WorkspaceConfig,
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
  TypedConfigOperation,
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
  ConfigTransformer,
  ConfigComparator
}