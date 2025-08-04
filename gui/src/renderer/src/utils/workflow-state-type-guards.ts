/**
 * Advanced Type Guards for Workflow State Management
 * Provides comprehensive runtime type validation with TypeScript type predicates
 * 
 * @fileoverview Optimized type guards for performance and strict type safety
 * @version 2.0.0
 * @performance Sub-millisecond validation for all operations
 */

import {
  StepState,
  StepStateMetadata,
  WorkflowStepState,
  AnyWorkflowStepState,
  WorkflowStateSnapshot,
  StateChangeEvent,
  BatchStateOperation,
  BatchOperationResult,
  StateTransitionRule,
  StateTransitionResult,
  StepId,
  Timestamp,
  Version,
  TypeGuards,
  WORKFLOW_CONSTANTS,
  DefaultStepId,
  ErrorCode,
  StateTransitions
} from '../types/workflow-state'

// Pre-compiled regex patterns for performance
const STEP_ID_REGEX = WORKFLOW_CONSTANTS.VALIDATION_PATTERNS.STEP_ID
const VERSION_REGEX = WORKFLOW_CONSTANTS.VALIDATION_PATTERNS.VERSION

// Memoization cache for expensive validations
const validationCache = new Map<string, boolean>()
const cacheMaxSize = 1000 // Prevent memory leaks

// Hit rate tracking counters
let cacheHits = 0
let cacheMisses = 0

/**
 * Clear validation cache when it gets too large
 */
function clearCacheIfNeeded(): void {
  if (validationCache.size > cacheMaxSize) {
    validationCache.clear()
    // Reset counters when clearing cache to maintain accuracy
    cacheHits = 0
    cacheMisses = 0
  }
}

/**
 * Performance-optimized type guard namespace
 * Uses cached regex patterns and memoization for frequently called guards
 */
export namespace WorkflowTypeGuards {
  
  /**
   * Enhanced StepState validation with enum checking
   */
  export function isStepState(value: unknown): value is StepState {
    return TypeGuards.isStepState(value)
  }
  
  /**
   * Branded StepId validation with format checking
   */
  export function isStepId(value: unknown): value is StepId {
    if (typeof value !== 'string') return false
    
    const cacheKey = `stepId:${value}`
    if (validationCache.has(cacheKey)) {
      cacheHits++
      return validationCache.get(cacheKey)!
    }
    
    cacheMisses++
    const isValid = value.length > 0 && 
                   value.length <= 50 && 
                   STEP_ID_REGEX.test(value)
    
    validationCache.set(cacheKey, isValid)
    clearCacheIfNeeded()
    
    return isValid
  }
  
  /**
   * Default step ID validation (compile-time known IDs)
   */
  export function isDefaultStepId(value: unknown): value is DefaultStepId {
    return typeof value === 'string' && 
           WORKFLOW_CONSTANTS.DEFAULT_STEP_ORDER.includes(value as DefaultStepId)
  }
  
  /**
   * Timestamp validation with range checking
   */
  export function isTimestamp(value: unknown): value is Timestamp {
    return typeof value === 'number' && 
           value > WORKFLOW_CONSTANTS.VALIDATION_PATTERNS.TIMESTAMP_MIN && 
           value <= Date.now() + 86400000 && // Allow 24h future tolerance
           Number.isInteger(value)
  }
  
  /**
   * Version validation with semantic versioning
   */
  export function isVersion(value: unknown): value is Version {
    if (typeof value !== 'string') return false
    
    const cacheKey = `version:${value}`
    if (validationCache.has(cacheKey)) {
      cacheHits++
      return validationCache.get(cacheKey)!
    }
    
    cacheMisses++
    const isValid = VERSION_REGEX.test(value)
    validationCache.set(cacheKey, isValid)
    clearCacheIfNeeded()
    
    return isValid
  }
  
  /**
   * Error code validation from predefined constants
   */
  export function isErrorCode(value: unknown): value is ErrorCode {
    return typeof value === 'string' && 
           Object.values(WORKFLOW_CONSTANTS.ERROR_CODES).includes(value as ErrorCode)
  }
  
  /**
   * State metadata validation with conditional type checking
   */
  export function isStepStateMetadata<T extends StepState>(
    value: unknown,
    expectedState?: T
  ): value is StepStateMetadata<T> {
    if (!value || typeof value !== 'object') return false
    
    const metadata = value as any
    
    // Required fields validation
    if (!isStepState(metadata.state)) return false
    if (!isTimestamp(metadata.lastModified)) return false
    
    // Optional fields validation
    if (metadata.message !== undefined && typeof metadata.message !== 'string') return false
    if (metadata.reason !== undefined && typeof metadata.reason !== 'string') return false
    if (metadata.previousState !== undefined && !isStepState(metadata.previousState)) return false
    if (metadata.context !== undefined && (typeof metadata.context !== 'object' || metadata.context === null)) return false
    
    // State-specific validation if expected state is provided
    if (expectedState && metadata.state !== expectedState) return false
    
    return true
  }
  
  /**
   * Workflow step state validation with deep type checking
   */
  export function isWorkflowStepState(value: unknown): value is AnyWorkflowStepState {
    if (!value || typeof value !== 'object') return false
    
    const step = value as any
    
    // Required fields validation
    if (!isStepId(step.id)) return false
    if (typeof step.title !== 'string' || step.title.length === 0) return false
    if (typeof step.description !== 'string') return false
    if (!isStepStateMetadata(step.stateMetadata)) return false
    
    // Optional fields validation
    if (step.requiredFields !== undefined) {
      if (!Array.isArray(step.requiredFields)) return false
      if (!step.requiredFields.every((field: unknown) => typeof field === 'string')) return false
    }
    
    if (step.validationRules !== undefined) {
      if (!Array.isArray(step.validationRules)) return false
      if (!step.validationRules.every((rule: unknown) => typeof rule === 'function')) return false
    }
    
    if (step.importContext !== undefined) {
      const ctx = step.importContext
      if (!ctx || typeof ctx !== 'object') return false
      if (!['regular', 'json-import', 'manual'].includes(ctx.sourceType)) return false
      if (!isTimestamp(ctx.timestamp)) return false
    }
    
    return true
  }
  
  /**
   * Workflow state snapshot validation
   */
  export function isWorkflowStateSnapshot(value: unknown): value is WorkflowStateSnapshot {
    if (!value || typeof value !== 'object') return false
    
    const snapshot = value as any
    
    // Required fields validation
    if (!isStepId(snapshot.currentStepId)) return false
    if (!isTimestamp(snapshot.timestamp)) return false
    if (!isVersion(snapshot.version)) return false
    
    // Steps validation
    if (!snapshot.steps || typeof snapshot.steps !== 'object') return false
    
    for (const [key, step] of Object.entries(snapshot.steps)) {
      if (!isStepId(key as unknown)) return false
      if (!isWorkflowStepState(step)) return false
    }
    
    // Optional restoration context validation
    if (snapshot.restorationContext !== undefined) {
      const ctx = snapshot.restorationContext
      if (!ctx || typeof ctx !== 'object') return false
      if (typeof ctx.isRestoring !== 'boolean') return false
      if (!['app-reload', 'workspace-switch', 'manual'].includes(ctx.restorationSource)) return false
      if (typeof ctx.preserveCurrentStep !== 'boolean') return false
    }
    
    return true
  }
  
  /**
   * State change event validation
   */
  export function isStateChangeEvent<T extends StepState>(
    value: unknown,
    expectedNewState?: T
  ): value is StateChangeEvent<T> {
    if (!value || typeof value !== 'object') return false
    
    const event = value as any
    
    // Required fields validation
    if (!isStepId(event.stepId)) return false
    if (!isStepState(event.oldState)) return false
    if (!isStepState(event.newState)) return false
    if (!isStepStateMetadata(event.metadata)) return false
    if (!isTimestamp(event.timestamp)) return false
    if (typeof event.transitionKey !== 'string') return false
    if (typeof event.isValid !== 'boolean') return false
    
    // Expected state validation
    if (expectedNewState && event.newState !== expectedNewState) return false
    
    return true
  }
  
  /**
   * Batch state operation validation
   */
  export function isBatchStateOperation<T extends StepState>(
    value: unknown,
    expectedState?: T
  ): value is BatchStateOperation<T> {
    if (!value || typeof value !== 'object') return false
    
    const operation = value as any
    
    // Required fields validation
    if (!isStepId(operation.stepId)) return false
    if (!isStepState(operation.newState)) return false
    
    // Optional fields validation
    if (operation.metadata !== undefined && !isStepStateMetadata(operation.metadata)) return false
    if (operation.validation !== undefined && typeof operation.validation !== 'boolean') return false
    if (operation.priority !== undefined) {
      if (!['low', 'normal', 'high', 'critical'].includes(operation.priority)) return false
    }
    
    // Expected state validation
    if (expectedState && operation.newState !== expectedState) return false
    
    return true
  }
  
  /**
   * Batch operation result validation
   */
  export function isBatchOperationResult(value: unknown): value is BatchOperationResult {
    if (!value || typeof value !== 'object') return false
    
    const result = value as any
    
    // Required fields validation
    if (typeof result.success !== 'boolean') return false
    if (!Array.isArray(result.results)) return false
    
    // Results array validation
    for (const resultItem of result.results) {
      if (!resultItem || typeof resultItem !== 'object') return false
      if (!isStepId(resultItem.stepId)) return false
      if (typeof resultItem.success !== 'boolean') return false
      if (resultItem.error !== undefined && typeof resultItem.error !== 'string') return false
      if (resultItem.errorCode !== undefined && !isErrorCode(resultItem.errorCode)) return false
    }
    
    // Optional fields validation
    if (result.rollback !== undefined && typeof result.rollback !== 'function') return false
    if (result.metadata !== undefined && (typeof result.metadata !== 'object' || result.metadata === null)) return false
    
    return true
  }
  
  /**
   * State transition rule validation with type-level validation
   */
  export function isStateTransitionRule<
    From extends StepState = StepState,
    To extends StepState = StepState
  >(value: unknown): value is StateTransitionRule<From, To> {
    if (!value || typeof value !== 'object') return false
    
    const rule = value as any
    
    // Required fields validation
    if (!isStepState(rule.from)) return false
    if (!isStepState(rule.to)) return false
    
    // Optional fields validation
    if (rule.condition !== undefined && typeof rule.condition !== 'function') return false
    if (rule.requiresValidation !== undefined && typeof rule.requiresValidation !== 'boolean') return false
    if (rule.metadata !== undefined && (typeof rule.metadata !== 'object' || rule.metadata === null)) return false
    
    return true
  }
  
  /**
   * State transition result validation
   */
  export function isStateTransitionResult<T = unknown>(
    value: unknown
  ): value is StateTransitionResult<T> {
    if (!value || typeof value !== 'object') return false
    
    const result = value as any
    
    // Required fields validation
    if (typeof result.success !== 'boolean') return false
    
    // Optional fields validation
    if (result.error !== undefined && typeof result.error !== 'string') return false
    if (result.errorCode !== undefined && !isErrorCode(result.errorCode)) return false
    if (result.rollback !== undefined && typeof result.rollback !== 'function') return false
    if (result.metadata !== undefined && (typeof result.metadata !== 'object' || result.metadata === null)) return false
    
    return true
  }
  
  /**
   * Validate state transition is allowed using compile-time types
   */
  export function isValidStateTransition<
    From extends StepState,
    To extends StepState
  >(
    from: From,
    to: To
  ): to is StateTransitions.ValidTargetStates<From> {
    // This provides runtime validation that matches compile-time constraints
    const validTransitions: Record<StepState, StepState[]> = {
      [StepState.Ready]: [StepState.Complete, StepState.Error, StepState.Warning, StepState.Blocked, StepState.Skip],
      [StepState.Complete]: [StepState.Ready, StepState.Error],
      [StepState.Error]: [StepState.Ready, StepState.Warning],
      [StepState.Warning]: [StepState.Ready, StepState.Complete, StepState.Error],
      [StepState.Blocked]: [StepState.Ready],
      [StepState.Skip]: [StepState.Ready]
    }
    
    return validTransitions[from]?.includes(to) ?? false
  }
  
  /**
   * Assert function for type-safe runtime assertions
   */
  export function assertStepState(value: unknown, context?: string): asserts value is StepState {
    if (!isStepState(value)) {
      throw new TypeError(`Invalid StepState${context ? ` in ${context}` : ''}: ${value}`)
    }
  }
  
  /**
   * Assert function for step ID validation
   */
  export function assertStepId(value: unknown, context?: string): asserts value is StepId {
    if (!isStepId(value)) {
      throw new TypeError(`Invalid StepId${context ? ` in ${context}` : ''}: ${value}`)
    }
  }
  
  /**
   * Assert function for workflow step state validation
   */
  export function assertWorkflowStepState(
    value: unknown,
    context?: string
  ): asserts value is AnyWorkflowStepState {
    if (!isWorkflowStepState(value)) {
      throw new TypeError(`Invalid WorkflowStepState${context ? ` in ${context}` : ''}`)
    }
  }
  
  /**
   * Performance monitoring for type guards
   */
  export function getValidationCacheStats(): {
    size: number
    maxSize: number
    hitRate: number
  } {
    return {
      size: validationCache.size,
      maxSize: cacheMaxSize,
      hitRate: cacheHits + cacheMisses === 0 
        ? 0 
        : cacheHits / (cacheHits + cacheMisses)
    }
  }
  
  /**
   * Clear validation cache manually
   */
  export function clearValidationCache(): void {
    validationCache.clear()
    cacheHits = 0
    cacheMisses = 0
  }
}

/**
 * Export type guards for convenient access
 */
export const {
  isStepState,
  isStepId,
  isDefaultStepId,
  isTimestamp,
  isVersion,
  isErrorCode,
  isStepStateMetadata,
  isWorkflowStepState,
  isWorkflowStateSnapshot,
  isStateChangeEvent,
  isBatchStateOperation,
  isBatchOperationResult,
  isStateTransitionRule,
  isStateTransitionResult,
  isValidStateTransition,
  assertStepState,
  assertStepId,
  assertWorkflowStepState,
  getValidationCacheStats,
  clearValidationCache
} = WorkflowTypeGuards