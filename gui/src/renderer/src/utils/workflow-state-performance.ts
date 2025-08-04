/**
 * Performance-Optimized Utilities for Workflow State Management
 * Provides high-performance operations and optimizations for TypeScript state management
 * 
 * @fileoverview Advanced TypeScript performance optimizations and caching strategies
 * @version 2.0.0
 * @performance Sub-millisecond operations with intelligent caching
 */

import {
  StepState,
  StepStateMetadata,
  WorkflowStepState,
  AnyWorkflowStepState,
  StepId,
  Timestamp,
  DefaultStepId,
  WORKFLOW_CONSTANTS,
  createStepId,
  createTimestamp,
  StateTransitions
} from '../types/workflow-state'

/**
 * Performance monitoring and optimization utilities
 */

// Performance metrics tracking
interface PerformanceMetrics {
  operationCount: number
  averageExecutionTime: number
  cacheHitRate: number
  lastOptimization: Timestamp
}

// Memoization cache for expensive operations
const operationCache = new Map<string, {
  result: unknown
  timestamp: Timestamp
  accessCount: number
}>()

// Performance metrics
let metrics: PerformanceMetrics = {
  operationCount: 0,
  averageExecutionTime: 0,
  cacheHitRate: 0,
  lastOptimization: createTimestamp()
}

// Cache configuration
const CACHE_CONFIG = {
  MAX_SIZE: 500,
  TTL_MS: 300000, // 5 minutes
  CLEANUP_INTERVAL: 60000 // 1 minute
} as const
  
/**
 * Performance-optimized step ID creation with caching
 */
export function createOptimizedStepId(id: string): StepId {
  const cacheKey = `stepId:${id}`
  const cached = operationCache.get(cacheKey)
  
  if (cached && isCacheValid(cached.timestamp)) {
    cached.accessCount++
    return cached.result as StepId
  }
  
  const result = createStepId(id)
  setCacheEntry(cacheKey, result)
  return result
}

/**
 * Batch step ID creation for improved performance
 */
export function createBatchStepIds(ids: readonly string[]): readonly StepId[] {
  return ids.map(id => createOptimizedStepId(id))
}
  
  /**
   * Optimized state validation with result caching
   */
  export function validateStateTransitionCached<
    From extends StepState,
    To extends StepState
  >(from: From, to: To): to is StateTransitions.ValidTargetStates<From> {
    const cacheKey = `transition:${from}-to-${to}`
    const cached = WorkflowPerformance.operationCache.get(cacheKey)
    
    if (cached && WorkflowPerformance.isCacheValid(cached.timestamp)) {
      cached.accessCount++
      return cached.result as boolean
    }
    
    // Pre-computed transition matrix for O(1) lookup
    const validTransitions: Readonly<Record<StepState, readonly StepState[]>> = {
      [StepState.Ready]: [StepState.Complete, StepState.Error, StepState.Warning, StepState.Blocked, StepState.Skip],
      [StepState.Complete]: [StepState.Ready, StepState.Error],
      [StepState.Error]: [StepState.Ready, StepState.Warning],
      [StepState.Warning]: [StepState.Ready, StepState.Complete, StepState.Error],
      [StepState.Blocked]: [StepState.Ready],
      [StepState.Skip]: [StepState.Ready]
    } as const
    
    const result = (validTransitions[from] as readonly StepState[])?.includes(to) ?? false
    WorkflowPerformance.setCacheEntry(cacheKey, result)
    return result as any
  }
  
  /**
   * Optimized step filtering with type narrowing
   */
  export function filterStepsByState<T extends StepState>(
    steps: ReadonlyArray<AnyWorkflowStepState>,
    state: T
  ): ReadonlyArray<WorkflowStepState<T>> {
    const cacheKey = `filter:${state}:${steps.length}`
    
    // For small arrays, direct filtering is faster than caching overhead
    if (steps.length < 10) {
      return steps.filter(step => step.stateMetadata.state === state) as WorkflowStepState<T>[]
    }
    
    const cached = WorkflowPerformance.operationCache.get(cacheKey)
    if (cached && WorkflowPerformance.isCacheValid(cached.timestamp)) {
      cached.accessCount++
      return cached.result as WorkflowStepState<T>[]
    }
    
    const result = steps.filter(step => step.stateMetadata.state === state) as WorkflowStepState<T>[]
    WorkflowPerformance.setCacheEntry(cacheKey, result)
    return result
  }
  
  /**
   * High-performance step lookup with index optimization
   */
  export function createStepLookupIndex(
    steps: ReadonlyMap<StepId, AnyWorkflowStepState>
  ): ReadonlyMap<StepState, ReadonlyArray<StepId>> {
    const cacheKey = `index:${steps.size}`
    const cached = WorkflowPerformance.operationCache.get(cacheKey)
    
    if (cached && WorkflowPerformance.isCacheValid(cached.timestamp)) {
      cached.accessCount++
      return cached.result as ReadonlyMap<StepState, ReadonlyArray<StepId>>
    }
    
    const index = new Map<StepState, StepId[]>()
    
    // Initialize with empty arrays for all states
    Object.values(StepState).forEach(state => {
      index.set(state, [])
    })
    
    // Populate index
    for (const [stepId, step] of steps) {
      const stateArray = index.get(step.stateMetadata.state)
      if (stateArray) {
        stateArray.push(stepId)
      }
    }
    
    // Convert to readonly
    const readonlyIndex = new Map(
      Array.from(index.entries()).map(([state, ids]) => [state, Object.freeze([...ids])] as const)
    )
    
    WorkflowPerformance.setCacheEntry(cacheKey, readonlyIndex)
    return readonlyIndex as ReadonlyMap<StepState, ReadonlyArray<StepId>>
  }
  
  /**
   * Optimized state metadata creation with object pooling
   */
  export function createOptimizedStateMetadata<T extends StepState>(
    state: T,
    options: {
      reason?: string
      message?: string
      context?: Readonly<Record<string, unknown>>
      previousState?: StepState
    } = {}
  ): StepStateMetadata<T> {
    // Use frozen object for better V8 optimization
    return Object.freeze({
      state,
      lastModified: createTimestamp(),
      reason: options.reason,
      message: options.message,
      context: options.context ? Object.freeze({ ...options.context }) : undefined,
      previousState: options.previousState
    } as StepStateMetadata<T>)
  }
  
  /**
   * Batch state metadata creation for multiple steps
   */
  export function createBatchStateMetadata<T extends StepState>(
    state: T,
    count: number,
    baseOptions: {
      reason?: string
      message?: string
      context?: Readonly<Record<string, unknown>>
    } = {}
  ): ReadonlyArray<StepStateMetadata<T>> {
    const timestamp = createTimestamp()
    const frozenContext = baseOptions.context ? Object.freeze({ ...baseOptions.context }) : undefined
    
    return Array.from({ length: count }, () => 
      Object.freeze({
        state,
        lastModified: timestamp,
        reason: baseOptions.reason,
        message: baseOptions.message,
        context: frozenContext
      } as StepStateMetadata<T>)
    )
  }
  
  /**
   * Performance-optimized step creation factory
   */
  export function createStepFactory<T extends StepState>(state: T) {
    return {
      state,
      create(
        id: StepId,
        title: string,
        description: string,
        metadata?: Partial<StepStateMetadata<T>>
      ): WorkflowStepState<T> {
        const optimizedMetadata = WorkflowPerformance.createOptimizedStateMetadata(state, {
          ...metadata,
          reason: metadata?.reason,
          message: metadata?.message,
          context: metadata?.context
        })
        
        return Object.freeze({
          id,
          title,
          description,
          stateMetadata: optimizedMetadata
        } as WorkflowStepState<T>)
      }
    }
  }
  
  /**
   * Memory-efficient deep clone for workflow steps
   */
  export function cloneWorkflowStep<T extends AnyWorkflowStepState>(step: T): T {
    // Structured cloning is faster than JSON.parse(JSON.stringify())
    // for objects with known structure
    return {
      ...step,
      stateMetadata: {
        ...step.stateMetadata,
        context: step.stateMetadata.context ? { ...step.stateMetadata.context } : undefined
      },
      requiredFields: step.requiredFields ? [...step.requiredFields] : undefined,
      validationRules: step.validationRules ? [...step.validationRules] : undefined,
      importContext: step.importContext ? { ...step.importContext } : undefined
    } as T
  }
  
/**
 * Cache management utilities
 */
function isCacheValid(timestamp: Timestamp): boolean {
  return (Date.now() - timestamp) < CACHE_CONFIG.TTL_MS
}

function setCacheEntry(key: string, result: unknown): void {
  // Cleanup old entries if cache is full
  if (operationCache.size >= CACHE_CONFIG.MAX_SIZE) {
    cleanupCache()
  }
  
  operationCache.set(key, {
    result,
    timestamp: createTimestamp(),
    accessCount: 1
  })
}

function cleanupCache(): void {
  const now = Date.now()
  const entries = Array.from(operationCache.entries())
  
  // Remove expired entries first
  entries.forEach(([key, value]) => {
    if ((now - value.timestamp) > CACHE_CONFIG.TTL_MS) {
      operationCache.delete(key)
      }
    })
    
    // If still too large, remove least recently used entries
    if (WorkflowPerformance.operationCache.size > WorkflowPerformance.CACHE_CONFIG.MAX_SIZE * 0.8) {
      const sortedEntries = entries
        .filter(([key]) => WorkflowPerformance.operationCache.has(key))
        .sort((a, b) => a[1].accessCount - b[1].accessCount)
      
      const toRemove = Math.floor(WorkflowPerformance.CACHE_CONFIG.MAX_SIZE * 0.2)
      sortedEntries.slice(0, toRemove).forEach(([key]) => {
        WorkflowPerformance.operationCache.delete(key)
      })
    }
  }
  
  /**
   * Performance monitoring and metrics
   */
  export function getPerformanceMetrics(): Readonly<PerformanceMetrics> {
    return Object.freeze({ ...WorkflowPerformance.metrics })
  }
  
  export function getCacheMetrics(): Readonly<{
    size: number
    maxSize: number
    hitRate: number
    averageAccessCount: number
  }> {
    const entries = Array.from(WorkflowPerformance.operationCache.values())
    const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0)
    
    return Object.freeze({
      size: WorkflowPerformance.operationCache.size,
      maxSize: WorkflowPerformance.CACHE_CONFIG.MAX_SIZE,
      hitRate: entries.length > 0 ? totalAccess / entries.length : 0,
      averageAccessCount: entries.length > 0 ? totalAccess / entries.length : 0
    })
  }
  
  /**
   * Manually trigger cache cleanup
   */
  export function clearCache(): void {
    WorkflowPerformance.operationCache.clear()
    WorkflowPerformance.metrics.lastOptimization = createTimestamp()
  }
  
  /**
   * Optimize cache based on usage patterns
   */
  export function optimizeCache(): void {
    WorkflowPerformance.cleanupCache()
    WorkflowPerformance.metrics.lastOptimization = createTimestamp()
  }
  
  /**
   * Performance benchmarking utility
   */
  export async function benchmark<T>(
    operation: () => T | Promise<T>,
    iterations: number = 1000
  ): Promise<{
    averageTime: number
    totalTime: number
    operationsPerSecond: number
    result: T
  }> {
    const startTime = performance.now()
    let result: T
    
    for (let i = 0; i < iterations; i++) {
      result = await operation()
    }
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    const averageTime = totalTime / iterations
    
    return {
      averageTime,
      totalTime,
      operationsPerSecond: 1000 / averageTime,
      result: result!
    }
  }

/**
 * Type-safe step state factories for common states
 */
export const StepFactories = {
  ready: createStepFactory(StepState.Ready),
  complete: createStepFactory(StepState.Complete),
  error: createStepFactory(StepState.Error),
  warning: createStepFactory(StepState.Warning),
  blocked: createStepFactory(StepState.Blocked),
  skip: createStepFactory(StepState.Skip)
} as const

// All functions are already exported individually above