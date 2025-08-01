/**
 * Subtitle Temporary Storage Utility Types and Type Guards
 * 
 * Advanced TypeScript utilities for enhanced type safety and developer experience
 * in the subtitle auto-save system. Provides generic utilities, type guards,
 * and helper functions for better code maintainability.
 */

import type {
  SubtitleData,
  ProcessingStatistics
} from '../../../types'
import type {
  SubtitleTempContent,
  SubtitleTempMetadata,
  SubtitleTempSession,
  SubtitleTempError,
  SubtitleTempOperationRequest,
  SubtitleTempOperationResponse,
  SubtitleTempStorageConfig,
  SubtitleTempBatchOperation,
  ValidationSeverity,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationSuggestion
} from './subtitle-temp-storage'

// ============================================================================
// ADVANCED GENERIC UTILITIES
// ============================================================================

/**
 * Conditional type for extracting required fields from a type
 */
export type RequiredFields<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

/**
 * Conditional type for extracting optional fields from a type
 */
export type OptionalFields<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

/**
 * Create a type with all fields required except specified optional ones
 */
export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Pick<T, K>

/**
 * Create a type with all fields optional except specified required ones
 */
export type OptionalExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>

/**
 * Extract function return type with proper error handling
 */
export type ExtractReturnType<T> = T extends (...args: any[]) => infer R ? R : never

/**
 * Extract promise value type
 */
export type ExtractPromiseType<T> = T extends Promise<infer U> ? U : T

/**
 * Create a discriminated union based on a property
 */
export type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends Record<K, V> ? T : never

/**
 * Recursive readonly type for deep immutability
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * Type-safe key-value pair extraction
 */
export type KeyValuePair<T, K extends keyof T = keyof T> = {
  key: K
  value: T[K]
}

/**
 * Branded type for enhanced type safety
 */
export type Brand<T, B> = T & { __brand: B }

/**
 * Branded types for critical identifiers
 */
export type WorkspaceId = Brand<string, 'WorkspaceId'>
export type SessionId = Brand<string, 'SessionId'>
export type StorageId = Brand<string, 'StorageId'>
export type OperationId = Brand<string, 'OperationId'>
export type BatchId = Brand<string, 'BatchId'>

/**
 * Type-safe JSON serialization
 */
export type Serializable<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends object
  ? { [K in keyof T]: Serializable<T[K]> }
  : never

// ============================================================================
// OPERATION-SPECIFIC TYPES
// ============================================================================

/**
 * Type-safe operation result with branded identifiers
 */
export interface TypedOperationResult<T, E = SubtitleTempError> {
  success: boolean
  operationId: OperationId
  workspaceId: WorkspaceId
  sessionId?: SessionId
  data?: T
  error?: E
  timestamp: number
  metadata?: {
    duration: number
    bytesProcessed: number
    cacheHit: boolean
    retryCount: number
  }
}

/**
 * Enhanced operation context with type safety
 */
export interface OperationContext {
  workspaceId: WorkspaceId
  sessionId?: SessionId
  operationId: OperationId
  userId?: string
  requestTimestamp: number
  timeout?: number
  priority: 'low' | 'normal' | 'high' | 'critical'
  metadata?: Record<string, Serializable<unknown>>
}

/**
 * Type-safe batch operation request
 */
export interface TypedBatchOperationRequest<T = any> {
  batchId: BatchId
  operations: Array<SubtitleTempOperationRequest & { data?: T }>
  context: OperationContext
  options: {
    continueOnError: boolean
    maxConcurrency: number
    timeout: number
    transactional: boolean
  }
}

/**
 * Enhanced session management with type safety
 */
export interface TypedSessionManager {
  createSession(workspaceId: WorkspaceId, sessionType: string): Promise<SessionId>
  getSession(sessionId: SessionId): Promise<SubtitleTempSession | null>
  updateSession(sessionId: SessionId, updates: Partial<SubtitleTempSession>): Promise<void>
  expireSession(sessionId: SessionId): Promise<void>
  listActiveSessions(workspaceId: WorkspaceId): Promise<SessionId[]>
  cleanupExpiredSessions(): Promise<SessionId[]>
}

/**
 * Type-safe storage interface
 */
export interface TypedStorageInterface {
  save<T extends SubtitleTempContent>(
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    content: T
  ): Promise<TypedOperationResult<StorageId>>
  
  load<T extends SubtitleTempContent>(
    workspaceId: WorkspaceId,
    storageId: StorageId
  ): Promise<TypedOperationResult<T>>
  
  delete(
    workspaceId: WorkspaceId,
    storageId: StorageId
  ): Promise<TypedOperationResult<void>>
  
  validate(
    workspaceId: WorkspaceId,
    storageId: StorageId
  ): Promise<TypedOperationResult<ValidationResult>>
}

// ============================================================================
// CONFIGURATION AND SCHEMA TYPES
// ============================================================================

/**
 * Configuration schema with validation rules
 */
export interface ConfigSchema<T> {
  properties: {
    [K in keyof T]: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array'
      required: boolean
      default?: T[K]
      validator?: (value: T[K]) => ValidationResult
      transformer?: (value: any) => T[K]
      description?: string
      examples?: T[K][]
    }
  }
  additionalProperties?: boolean
  strict?: boolean
}

/**
 * Type-safe configuration builder
 */
export interface ConfigBuilder<T> {
  setProperty<K extends keyof T>(key: K, value: T[K]): ConfigBuilder<T>
  setDefaults(defaults: Partial<T>): ConfigBuilder<T>
  validate(): ValidationResult
  build(): T
  reset(): ConfigBuilder<T>
}

/**
 * Migration strategy interface
 */
export interface MigrationStrategy<TFrom, TTo> {
  version: number
  targetVersion: number
  description: string
  up(data: TFrom): Promise<TTo>
  down(data: TTo): Promise<TFrom>
  validate(data: TFrom | TTo): ValidationResult
}

// ============================================================================
// ENHANCED VALIDATION TYPES
// ============================================================================

/**
 * Validation rule with context
 */
export interface ValidationRule<T> {
  name: string
  validator: (value: T, context?: any) => ValidationResult
  severity: ValidationSeverity
  async?: boolean
  dependsOn?: string[]
}

/**
 * Composite validator for complex validations
 */
export interface CompositeValidator<T> {
  rules: ValidationRule<T>[]
  mode: 'all' | 'any' | 'sequential'
  shortCircuit: boolean
  validate(value: T, context?: any): Promise<ValidationResult>
}

/**
 * Validation context with metadata
 */
export interface ValidationContext {
  workspaceId: WorkspaceId
  sessionId?: SessionId
  operationId?: OperationId
  timestamp: number
  userId?: string
  metadata?: Record<string, any>
}

/**
 * Enhanced validation result with metrics
 */
export interface EnhancedValidationResult extends ValidationResult {
  context: ValidationContext
  metrics: {
    duration: number
    rulesExecuted: number
    rulesSkipped: number
    cacheHits: number
  }
  performance: {
    validationTime: number
    averageRuleTime: number
    slowestRule?: string
  }
}

// ============================================================================
// CACHING AND PERFORMANCE TYPES
// ============================================================================

/**
 * Generic cache interface with type safety
 */
export interface TypedCache<K, V> {
  get(key: K): Promise<V | null>
  set(key: K, value: V, ttl?: number): Promise<void>
  delete(key: K): Promise<boolean>
  clear(): Promise<void>
  has(key: K): Promise<boolean>
  size(): Promise<number>
  keys(): Promise<K[]>
  values(): Promise<V[]>
  entries(): Promise<Array<[K, V]>>
}

/**
 * Cache configuration with type safety
 */
export interface TypedCacheConfig<K, V> {
  maxSize: number
  maxEntries: number
  defaultTTL: number
  enableCompression: boolean
  compressionThreshold: number
  serializer: {
    serialize(value: V): string
    deserialize(data: string): V
  }
  keyGenerator: (key: K) => string
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'fifo'
  metrics: {
    enabled: boolean
    sampleRate: number
  }
}

/**
 * Performance monitoring interface
 */
export interface PerformanceTracker {
  startOperation(name: string, context?: OperationContext): string
  endOperation(id: string): number
  recordMetric(name: string, value: number, tags?: Record<string, string>): void
  getMetrics(filter?: string): PerformanceMetric[]
  getAggregatedMetrics(operation: string): AggregatedMetrics
}

/**
 * Performance metric data structure
 */
export interface PerformanceMetric {
  id: string
  operation: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'ratio' | 'ops/sec'
  timestamp: number
  tags?: Record<string, string>
  context?: OperationContext
}

/**
 * Aggregated performance metrics
 */
export interface AggregatedMetrics {
  operation: string
  count: number
  min: number
  max: number
  avg: number
  median: number
  p95: number
  p99: number
  total: number
  rate: number
  errorRate: number
}

// ============================================================================
// REACTIVE AND EVENT TYPES
// ============================================================================

/**
 * Event system with type safety
 */
export interface TypedEventEmitter<TEvents extends Record<string, any[]>> {
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void
  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void
  once<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void
  listenerCount<K extends keyof TEvents>(event: K): number
  removeAllListeners<K extends keyof TEvents>(event?: K): void
}

/**
 * Storage events with enhanced payloads
 */
export interface StorageEventPayloads {
  'content-updated': [
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    changeCount: number,
    metadata: { field: string; oldValue: any; newValue: any }[]
  ]
  'auto-save-triggered': [
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    trigger: 'timer' | 'content-change' | 'user-action' | 'session-end',
    metadata: { changeCount: number; lastSave: number }
  ]
  'validation-completed': [
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    result: EnhancedValidationResult
  ]
  'error-occurred': [
    error: SubtitleTempError,
    context: OperationContext,
    recovery?: { action: string; success: boolean }
  ]
  'cache-event': [
    event: 'hit' | 'miss' | 'eviction' | 'clear',
    key: string,
    metadata: { size?: number; ttl?: number }
  ]
  'performance-alert': [
    metric: string,
    value: number,
    threshold: number,
    context: OperationContext
  ]
}

/**
 * Reactive data stream interface
 */
export interface ReactiveStream<T> {
  subscribe(observer: (value: T) => void): () => void
  map<U>(mapper: (value: T) => U): ReactiveStream<U>
  filter(predicate: (value: T) => boolean): ReactiveStream<T>
  debounce(ms: number): ReactiveStream<T>
  throttle(ms: number): ReactiveStream<T>
  distinctUntilChanged(comparer?: (a: T, b: T) => boolean): ReactiveStream<T>
  take(count: number): ReactiveStream<T>
  takeUntil(condition: (value: T) => boolean): ReactiveStream<T>
}

// ============================================================================
// ENHANCED TYPE GUARDS
// ============================================================================

/**
 * Generic type guard factory with validation
 */
export function createValidatingTypeGuard<T>(
  schema: ConfigSchema<T>
): (obj: any) => obj is T {
  return (obj: any): obj is T => {
    if (!obj || typeof obj !== 'object') return false

    for (const [key, property] of Object.entries(schema.properties)) {
      const value = obj[key]
      
      // Check required fields
      if (property.required && (value === undefined || value === null)) {
        return false
      }
      
      // Type validation
      if (value !== undefined) {
        switch (property.type) {
          case 'string':
            if (typeof value !== 'string') return false
            break
          case 'number':
            if (typeof value !== 'number' || isNaN(value)) return false
            break
          case 'boolean':
            if (typeof value !== 'boolean') return false
            break
          case 'object':
            if (typeof value !== 'object' || Array.isArray(value)) return false
            break
          case 'array':
            if (!Array.isArray(value)) return false
            break
        }
        
        // Custom validation
        if (property.validator) {
          const result = property.validator(value)
          if (!result.isValid) return false
        }
      }
    }
    
    return true
  }
}

/**
 * Brand validation utilities
 */
export function isWorkspaceId(value: string): value is WorkspaceId {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

export function isSessionId(value: string): value is SessionId {
  return typeof value === 'string' && value.length >= 8 && /^[a-zA-Z0-9_-]+$/.test(value)
}

export function isStorageId(value: string): value is StorageId {
  return typeof value === 'string' && value.startsWith('temp-') && value.length > 8
}

export function isOperationId(value: string): value is OperationId {
  return typeof value === 'string' && value.includes('-') && value.length > 16
}

export function isBatchId(value: string): value is BatchId {
  return typeof value === 'string' && value.startsWith('batch-') && value.length > 10
}

/**
 * Enhanced content validation
 */
export function isValidSubtitleContent(content: any): content is SubtitleTempContent {
  if (!content || typeof content !== 'object') return false
  
  return (
    // Metadata validation
    content.metadata &&
    typeof content.metadata.id === 'string' &&
    isWorkspaceId(content.metadata.workspaceId) &&
    typeof content.metadata.version === 'number' &&
    
    // Subtitles validation
    Array.isArray(content.subtitles) &&
    content.subtitles.every((subtitle: any) =>
      typeof subtitle.id === 'number' &&
      typeof subtitle.startTime === 'number' &&
      typeof subtitle.endTime === 'number' &&
      typeof subtitle.text === 'string' &&
      subtitle.startTime < subtitle.endTime
    ) &&
    
    // Statistics validation
    content.statistics &&
    typeof content.statistics.totalCount === 'number' &&
    content.statistics.totalCount === content.subtitles.length &&
    
    // Validation state
    content.validation &&
    typeof content.validation.isValid === 'boolean'
  )
}

/**
 * Configuration validation with detailed feedback
 */
export function validateStorageConfig(config: any): EnhancedValidationResult {
  const context: ValidationContext = {
    workspaceId: 'config-validation' as WorkspaceId,
    timestamp: Date.now()
  }
  
  const startTime = performance.now()
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  let rulesExecuted = 0
  
  // Database configuration validation
  if (!config.database) {
    errors.push({
      field: 'database',
      code: 'MISSING_DATABASE_CONFIG',
      message: 'Database configuration is required',
      value: undefined,
      severity: 'critical'
    })
  } else {
    rulesExecuted++
    if (typeof config.database.name !== 'string') {
      errors.push({
        field: 'database.name',
        code: 'INVALID_DB_NAME',
        message: 'Database name must be a string',
        value: config.database.name,
        severity: 'high'
      })
    }
    
    if (typeof config.database.version !== 'number' || config.database.version < 1) {
      errors.push({
        field: 'database.version',
        code: 'INVALID_DB_VERSION',
        message: 'Database version must be a positive number',
        value: config.database.version,
        severity: 'high'
      })
    }
  }
  
  // Auto-save configuration validation
  if (config.autoSave) {
    rulesExecuted++
    if (typeof config.autoSave.intervalMs !== 'number' || config.autoSave.intervalMs < 1000) {
      warnings.push({
        field: 'autoSave.intervalMs',
        code: 'SHORT_INTERVAL',
        message: 'Auto-save interval less than 1 second may impact performance',
        value: config.autoSave.intervalMs,
        severity: 'medium'
      })
    }
    
    if (typeof config.autoSave.maxBackups !== 'number' || config.autoSave.maxBackups > 50) {
      warnings.push({
        field: 'autoSave.maxBackups',
        code: 'EXCESSIVE_BACKUPS',
        message: 'Large number of backups may consume significant storage',
        value: config.autoSave.maxBackups,
        severity: 'low'
      })
    }
  }
  
  const endTime = performance.now()
  const duration = endTime - startTime
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    context,
    metrics: {
      duration,
      rulesExecuted,
      rulesSkipped: 0,
      cacheHits: 0
    },
    performance: {
      validationTime: duration,
      averageRuleTime: rulesExecuted > 0 ? duration / rulesExecuted : 0
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a branded identifier with validation
 */
export function createWorkspaceId(id?: string): WorkspaceId {
  if (id && isWorkspaceId(id)) {
    return id
  }
  
  // Generate UUID v4
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
  
  return uuid as WorkspaceId
}

/**
 * Create a session ID with validation
 */
export function createSessionId(prefix: string = 'session'): SessionId {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 12)
  return `${prefix}-${timestamp}-${random}` as SessionId
}

/**
 * Create an operation ID with context
 */
export function createOperationId(operation: string, context?: OperationContext): OperationId {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  const workspacePrefix = context?.workspaceId?.substring(0, 8) || 'unknown'
  return `${operation}-${workspacePrefix}-${timestamp}-${random}` as OperationId
}

/**
 * Type-safe deep clone utility
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const cloned = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }
  return obj
}

/**
 * Safe JSON parsing with validation
 */
export function safeJsonParse<T>(
  json: string,
  validator?: (obj: any) => obj is T
): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(json)
    
    if (validator && !validator(parsed)) {
      return {
        success: false,
        error: 'Parsed data failed validation'
      }
    }
    
    return {
      success: true,
      data: parsed
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    }
  }
}

/**
 * Debounce utility with cleanup
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  const debounced = ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T & { cancel: () => void }
  
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }
  
  return debounced
}

/**
 * Throttle utility with cleanup
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T & { cancel: () => void } {
  let inThrottle = false
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  const throttled = ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      timeout = setTimeout(() => { inThrottle = false }, limit)
    }
  }) as T & { cancel: () => void }
  
  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    inThrottle = false
  }
  
  return throttled
}

/**
 * Create a retry utility with exponential backoff
 */
export function createRetryFunction<T extends (...args: any[]) => Promise<any>>(
  func: T,
  options: {
    maxRetries: number
    baseDelay: number
    backoffMultiplier: number
    maxDelay: number
  }
): T {
  return (async (...args: Parameters<T>) => {
    let lastError: Error
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await func(...args)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt === options.maxRetries) {
          throw lastError
        }
        
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
          options.maxDelay
        )
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }) as T
}