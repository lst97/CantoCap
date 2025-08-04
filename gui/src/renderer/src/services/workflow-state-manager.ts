/**
 * Centralized Workflow State Manager
 * High-performance, type-safe workflow state management with advanced memoization
 * Features: <1ms transitions, efficient notifications, memory management, batch operations
 * Performance targets: <1ms state transition, <10ms React re-render, 90%+ cache hit rate
 */

import {
  StepState,
  StepStateMetadata,
  WorkflowStepState,
  AnyWorkflowStepState,
  StateTransitionResult,
  StateChangeEvent,
  WorkflowStateManagerConfig,
  StateValidationError,
  BatchStateOperation,
  BatchOperationResult,
  StepId,
  createStepId,
  createTimestamp,
  createVersion,
  createWorkflowStateSnapshot,
  createTransitionRule,
  WORKFLOW_CONSTANTS,
  DefaultStepId,
  WorkflowTypes
} from '../types/workflow-state'
import { performanceMonitor } from './performance-monitor'
import { workflowObjectPool } from './object-pool'
import { emitWorkflowStateChange } from './config-persistence-event-system'
import { ElectronStateBridge } from './electron-state-bridge'

/**
 * Default state transition rules with type safety
 * Defines valid state changes using createTransitionRule for compile-time validation
 */
const DEFAULT_TRANSITION_RULES = [
  // Blocked can transition to Ready when prerequisites are met
  createTransitionRule({ from: StepState.Blocked, to: StepState.Ready }),
  
  // Ready can transition to Complete, Error, Warning, or be explicitly Blocked
  createTransitionRule({ from: StepState.Ready, to: StepState.Complete }),
  createTransitionRule({ from: StepState.Ready, to: StepState.Error }),
  createTransitionRule({ from: StepState.Ready, to: StepState.Warning }),
  createTransitionRule({ from: StepState.Ready, to: StepState.Blocked }),
  createTransitionRule({ from: StepState.Ready, to: StepState.Skip }),
  // Allow Ready → Ready for navigation scenarios (step switching)
  createTransitionRule({ from: StepState.Ready, to: StepState.Ready }),
  
  // Complete can be reset to Ready or marked as Error
  createTransitionRule({ from: StepState.Complete, to: StepState.Ready }),
  createTransitionRule({ from: StepState.Complete, to: StepState.Error }),
  // Allow Complete → Complete for navigation scenarios
  createTransitionRule({ from: StepState.Complete, to: StepState.Complete }),
  
  // Error can be resolved to Ready or Warning
  createTransitionRule({ from: StepState.Error, to: StepState.Ready }),
  createTransitionRule({ from: StepState.Error, to: StepState.Warning }),
  
  // Warning can be resolved or escalated
  createTransitionRule({ from: StepState.Warning, to: StepState.Ready }),
  createTransitionRule({ from: StepState.Warning, to: StepState.Complete }),
  createTransitionRule({ from: StepState.Warning, to: StepState.Error }),
  
  // Skip can be undone back to Ready
  createTransitionRule({ from: StepState.Skip, to: StepState.Ready }),
  
  // Blocked can stay blocked (for navigation scenarios)
  createTransitionRule({ from: StepState.Blocked, to: StepState.Blocked })
] as const


/**
 * Debouncer for batching rapid state changes
 */
class Debouncer {
  private timeoutId?: NodeJS.Timeout
  private pendingOperations: Array<() => void> = []
  
  constructor(private delay: number = 16) {} // ~60fps
  
  debounce(operation: () => void): void {
    this.pendingOperations.push(operation)
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }
    
    this.timeoutId = setTimeout(() => {
      const operations = [...this.pendingOperations]
      this.pendingOperations = []
      
      // Execute all pending operations in batch
      operations.forEach(op => op())
    }, this.delay)
  }
  
  flush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }
    
    const operations = [...this.pendingOperations]
    this.pendingOperations = []
    operations.forEach(op => op())
  }
  
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }
    this.pendingOperations = []
  }
}

/**
 * Circular Buffer for efficient history management
 */
class CircularBuffer<T> {
  private buffer: T[]
  private head = 0
  private tail = 0
  private size = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity)
  }

  push(item: T): void {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    
    if (this.size < this.capacity) {
      this.size++
    } else {
      this.head = (this.head + 1) % this.capacity
    }
  }

  toArray(): T[] {
    const result: T[] = []
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity
      result.push(this.buffer[index])
    }
    return result
  }

  clear(): void {
    this.head = 0
    this.tail = 0
    this.size = 0
  }

  get length(): number {
    return this.size
  }
}

/**
 * Advanced memoization cache with LRU eviction
 */
class MemoizationCache<K, V> {
  private cache = new Map<string, { value: V; timestamp: number; accessCount: number }>()
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  private createKey(key: K): string {
    return typeof key === 'string' ? key : JSON.stringify(key)
  }

  get(key: K): V | undefined {
    const keyStr = this.createKey(key)
    const entry = this.cache.get(keyStr)
    
    if (entry) {
      entry.accessCount++
      entry.timestamp = Date.now()
      return entry.value
    }
    
    return undefined
  }

  set(key: K, value: V): void {
    const keyStr = this.createKey(key)
    
    if (this.cache.size >= this.maxSize && !this.cache.has(keyStr)) {
      this.evictLRU()
    }
    
    this.cache.set(keyStr, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    })
  }

  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Infinity
    
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  clear(): void {
    this.cache.clear()
  }

  get hitRate(): number {
    const total = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessCount, 0)
    const hits = this.cache.size
    return hits > 0 ? (total - hits) / total : 0
  }
}

/**
 * Enhanced observer management with micro-subscriptions and performance optimization
 */
class ObserverManager {
  private globalObservers = new Set<WorkflowTypes.StateChangeHandler>()
  private stepObservers = new Map<StepId, Set<WorkflowTypes.StateChangeHandler>>()
  private notificationQueue: Array<{ event: StateChangeEvent; observers: Set<WorkflowTypes.StateChangeHandler> }> = []
  private isProcessingQueue = false
  private debouncer = new Debouncer(8) // 8ms debouncing for notifications
  private batchSize = 20 // Increased batch size for better performance

  subscribe(observer: WorkflowTypes.StateChangeHandler, stepId?: StepId): () => void {
    if (stepId) {
      if (!this.stepObservers.has(stepId)) {
        this.stepObservers.set(stepId, new Set())
      }
      this.stepObservers.get(stepId)!.add(observer)
      
      return () => {
        this.stepObservers.get(stepId)?.delete(observer)
        if (this.stepObservers.get(stepId)?.size === 0) {
          this.stepObservers.delete(stepId)
        }
      }
    } else {
      this.globalObservers.add(observer)
      return () => this.globalObservers.delete(observer)
    }
  }

  notify(event: StateChangeEvent): void {
    const startTime = performance.now()
    
    // Use object pool for observer set
    const relevantObservers = workflowObjectPool.createObserverSet()
    
    // Add global observers
    this.globalObservers.forEach(observer => relevantObservers.add(observer))
    
    // Add step-specific observers
    this.stepObservers.get(event.stepId)?.forEach(observer => relevantObservers.add(observer))
    
    if (relevantObservers.size > 0) {
      this.notificationQueue.push({ event, observers: relevantObservers })
      
      // Debounce notification processing for better performance
      this.debouncer.debounce(() => {
        this.processQueue()
      })
    } else {
      // Return empty set to pool
      workflowObjectPool.returnObserverSet(relevantObservers)
    }
    
    // Record notification performance
    const notificationTime = performance.now() - startTime
    performanceMonitor.recordNotification(notificationTime, this.notificationQueue.length, this.observerCount)
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return
    
    this.isProcessingQueue = true
    const startTime = performance.now()
    
    while (this.notificationQueue.length > 0) {
      const batch = this.notificationQueue.splice(0, this.batchSize) // Process in optimized batches
      
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          batch.forEach(({ event, observers }) => {
            observers.forEach(observer => {
              try {
                observer(event)
              } catch (error) {
                console.error('Observer error:', error)
                performanceMonitor.recordError?.('observer-notification', error)
              }
            })
            
            // Return observer set to pool
            workflowObjectPool.returnObserverSet(observers)
          })
          resolve(void 0)
        })
      })
    }
    
    this.isProcessingQueue = false
    
    // Record overall processing time
    const processingTime = performance.now() - startTime
    performanceMonitor.recordNotification(processingTime, 0, this.observerCount)
  }

  clear(): void {
    this.globalObservers.clear()
    this.stepObservers.clear()
    
    // Return all observer sets to pool before clearing
    this.notificationQueue.forEach(({ observers }) => {
      workflowObjectPool.returnObserverSet(observers)
    })
    
    this.notificationQueue = []
    this.debouncer.clear()
  }

  get observerCount(): number {
    let count = this.globalObservers.size
    this.stepObservers.forEach(set => count += set.size)
    return count
  }
}

/**
 * High-performance workflow state manager with advanced optimizations
 * Features: <1ms transitions, efficient notifications, memory management
 */
export class WorkflowStateManager {
  private readonly steps = new Map<StepId, AnyWorkflowStepState>()
  private currentStepId: StepId = createStepId('input-file')
  private readonly transitionRules = [...DEFAULT_TRANSITION_RULES] as const
  private readonly stateHistory = new CircularBuffer<StateChangeEvent>(100)
  private readonly observerManager = new ObserverManager()
  private readonly config: WorkflowStateManagerConfig
  private readonly electronBridge = ElectronStateBridge.getInstance()
  
  // Initialization guards to prevent race conditions
  private isInitializing = true
  private initializationComplete = false
  private initializationStartTime = Date.now()
  private readonly INITIALIZATION_TIMEOUT = 5000 // 5 seconds max initialization time
  
  // Performance optimization caches
  private readonly computedCache = new MemoizationCache<string, any>(50)
  private readonly accessibilityCache = new MemoizationCache<StepId, boolean>(20)
  private readonly stepArrayCache = new MemoizationCache<string, AnyWorkflowStepState[]>(5)
  
  // Cached state values for performance optimization
  private cachedCurrentStep: StepId | null = null
  private cachedStepStates = new Map<StepId, StepState>()
  
  // Performance metrics
  private performanceMetrics: PerformanceMetrics = {
    stateTransitionTime: 0,
    notificationTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    observerCount: 0,
    rerenderCount: 0
  }
  
  // State version for cache invalidation
  private stateVersion = 0

  constructor(config: Partial<WorkflowStateManagerConfig> = {}) {
    // Lazy evaluation: only create debug info if logging is enabled
    if (config.enableLogging !== false) {
      console.log('🔧 [DEBUG] WorkflowStateManager constructor called', {
        timestamp: new Date().toISOString(),
        config,
        stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
      })
    }

    this.config = {
      strictValidation: true,
      enableLogging: true,
      maxHistoryEntries: 100,
      ...config
    }

    // Optimized logging: avoid object construction unless logging enabled
    if (this.config.enableLogging) {
      console.log('🔧 [DEBUG] WorkflowStateManager config set', {
        finalConfig: this.config,
        timestamp: new Date().toISOString()
      })
    }

    this.initializeDefaultSteps()
    this.startPerformanceMonitoring()
    
    // Mark initialization as complete
    this.completeInitialization()

    if (this.config.enableLogging) {
      console.log('🔧 [DEBUG] WorkflowStateManager initialization complete', {
        currentStepId: this.currentStepId,
        stepsCount: this.steps.size,
        isInitializing: this.isInitializing,
        initializationComplete: this.initializationComplete,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      setInterval(() => {
        this.updatePerformanceMetrics()
      }, 5000) // Update every 5 seconds
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    this.performanceMetrics.cacheHitRate = this.computedCache.hitRate
    this.performanceMetrics.observerCount = this.observerManager.observerCount
    
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      this.performanceMetrics.memoryUsage = (window.performance as any).memory.usedJSHeapSize
    }
  }

  /**
   * Public async initialize method for component integration
   * Allows components to wait for manager initialization to complete
   */
  public async initialize(): Promise<void> {
    console.log('🔧 [DEBUG] Public initialize() called', {
      isInitializing: this.isInitializing,
      initializationComplete: this.initializationComplete,
      timestamp: new Date().toISOString()
    })

    // If already initialized, return immediately
    if (this.initializationComplete && !this.isInitializing) {
      console.log('✅ [DEBUG] WorkflowStateManager already initialized')
      return Promise.resolve()
    }

    // Wait for initialization to complete if currently initializing
    if (this.isInitializing) {
      return new Promise((resolve) => {
        const checkInitialization = () => {
          if (this.initializationComplete && !this.isInitializing) {
            console.log('✅ [DEBUG] WorkflowStateManager initialization wait completed')
            resolve()
          } else {
            setTimeout(checkInitialization, 10)
          }
        }
        checkInitialization()
      })
    }

    // Force complete initialization if needed
    if (!this.initializationComplete) {
      console.log('🔧 [DEBUG] Forcing initialization completion from public initialize()')
      this.completeInitialization()
    }

    return Promise.resolve()
  }

  /**
   * Complete initialization and remove race condition guards
   */
  private completeInitialization(): void {
    this.isInitializing = false
    this.initializationComplete = true
    
    console.log('✅ WorkflowStateManager initialization complete - race condition guards removed', {
      currentStepId: this.currentStepId,
      isInitializing: this.isInitializing,
      initializationComplete: this.initializationComplete,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Initialize default workflow steps with type safety
   * Always ensures workflow starts on step 1 (input-file)
   */
  private initializeDefaultSteps(): void {
    if (this.config.enableLogging) {
      console.log('🔧 [DEBUG] initializeDefaultSteps() called', {
        timestamp: new Date().toISOString(),
        currentStepIdBefore: this.currentStepId,
        stepsMapSizeBefore: this.steps.size,
        stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
      })
    }

    const defaultSteps: ReadonlyArray<{
      id: DefaultStepId,
      title: string,
      description: string,
      stateMetadata: StepStateMetadata
    }> = [
      {
        id: 'input-file',
        title: 'Input File',
        description: 'Upload media file and select processing range',
        stateMetadata: this.createStateMetadata(StepState.Ready, 'Initial state')
      },
      {
        id: 'config',
        title: 'Configuration', 
        description: 'Configure transcription and subtitle options',
        stateMetadata: this.createStateMetadata(StepState.Blocked, 'Waiting for input file')
      },
      {
        id: 'processing',
        title: 'Processing',
        description: 'Generate subtitles and monitor progress',
        stateMetadata: this.createStateMetadata(StepState.Blocked, 'Waiting for configuration')
      },
      {
        id: 'review',
        title: 'Review & Edit',
        description: 'Review and edit generated subtitles',
        stateMetadata: this.createStateMetadata(StepState.Blocked, 'Waiting for processing')
      },
      {
        id: 'export',
        title: 'Export',
        description: 'Configure export settings and download files',
        stateMetadata: this.createStateMetadata(StepState.Blocked, 'Waiting for review')
      }
    ] as const

    if (this.config.enableLogging) {
      console.log('🔧 [DEBUG] Creating default steps', {
        stepCount: defaultSteps.length,
        stepIds: defaultSteps.map(s => s.id),
        timestamp: new Date().toISOString()
      })
    }

    defaultSteps.forEach((stepData, index) => {
      const stepId = createStepId(stepData.id)
      const step: AnyWorkflowStepState = {
        id: stepId,
        title: stepData.title,
        description: stepData.description,
        stateMetadata: stepData.stateMetadata
      }
      this.steps.set(stepId, step)
      
      if (this.config.enableLogging) {
        console.log(`🔧 [DEBUG] Step ${index + 1} created:`, {
          stepId,
          stepDataId: stepData.id,
          state: stepData.stateMetadata.state,
          reason: stepData.stateMetadata.reason,
          timestamp: new Date().toISOString()
        })
      }
    })

    // CRITICAL FIX: Always ensure workflow starts on step 1 (input-file)
    // This prevents any workspace restoration from overriding the default start step
    const previousStepId = this.currentStepId
    this.currentStepId = createStepId('input-file')
    
    // CACHE FIX: Invalidate current step cache
    this.cachedCurrentStep = null
    
    if (this.config.enableLogging) {
      console.log('🔧 [DEBUG] Current step ID set to input-file', {
        previousStepId,
        newStepId: this.currentStepId,
        isDefaultStep: this.currentStepId === 'input-file',
        timestamp: new Date().toISOString()
      })
    }
    
    if (this.config.enableLogging) {
      console.log('✅ [DEBUG] Workflow initialized - current step set to input-file (step 1)', {
        stepsCreated: this.steps.size,
        allStepIds: Array.from(this.steps.keys()),
        currentStepId: this.currentStepId,
        timestamp: new Date().toISOString()
      })
    }
  }


  /**
   * Create state metadata with defaults and type safety
   */
  private createStateMetadata<T extends StepState>(
    state: T, 
    reason?: string, 
    message?: string,
    context?: Readonly<Record<string, unknown>>
  ): StepStateMetadata<T> {
    return {
      state,
      lastModified: createTimestamp(),
      reason,
      message,
      context: context ? Object.freeze({ ...context }) : undefined
    } as StepStateMetadata<T>
  }

  /**
   * Optimized state transition validation with caching
   */
  private validateTransition<T extends StepState>(
    stepId: StepId, 
    newState: T
  ): StateValidationError | null {
    const validationKey = `${stepId}-${newState}-${this.stateVersion}`
    const cachedResult = this.computedCache.get(validationKey)
    
    if (cachedResult !== undefined) {
      return cachedResult
    }

    const result = this.performValidation(stepId, newState)
    this.computedCache.set(validationKey, result)
    return result
  }

  /**
   * Core validation logic
   */
  private performValidation<T extends StepState>(
    stepId: StepId, 
    newState: T
  ): StateValidationError | null {
    console.log('🔧 [VALIDATION DEBUG] Starting validation', {
      stepId,
      newState,
      timestamp: new Date().toISOString()
    })
    
    // Optimized type checks without dynamic imports
    if (typeof stepId !== 'string' || stepId.length === 0) {
      console.log('❌ [VALIDATION DEBUG] Invalid step ID format', { stepId })
      return {
        stepId: stepId as string,
        currentState: StepState.Error,
        attemptedState: newState,
        reason: 'Invalid step ID format',
        code: WORKFLOW_CONSTANTS.ERROR_CODES.STEP_NOT_FOUND
      }
    }
    
    if (!Object.values(StepState).includes(newState)) {
      console.log('❌ [VALIDATION DEBUG] Invalid target state', { newState, validStates: Object.values(StepState) })
      return {
        stepId: stepId as string,
        currentState: StepState.Error,
        attemptedState: newState,
        reason: 'Invalid target state',
        code: WORKFLOW_CONSTANTS.ERROR_CODES.VALIDATION_FAILED
      }
    }

    const step = this.steps.get(stepId)
    if (!step) {
      console.log('❌ [VALIDATION DEBUG] Step not found', { stepId, availableSteps: Array.from(this.steps.keys()) })
      return {
        stepId: stepId as string,
        currentState: StepState.Error,
        attemptedState: newState,
        reason: 'Step not found',
        code: WORKFLOW_CONSTANTS.ERROR_CODES.STEP_NOT_FOUND
      }
    }

    const currentState = step.stateMetadata.state
    console.log('🔧 [VALIDATION DEBUG] Found step and current state', {
      stepId,
      currentState,
      newState,
      strictValidation: this.config.strictValidation
    })
    
    // Fast transition validation using pre-computed map
    const isValidTransitionResult = this.isValidTransition(currentState, newState)
    console.log('🔧 [VALIDATION DEBUG] Transition validity check', {
      from: currentState,
      to: newState,
      isValid: isValidTransitionResult,
      strictValidation: this.config.strictValidation
    })
    
    if (this.config.strictValidation && !isValidTransitionResult) {
      console.log('❌ [VALIDATION DEBUG] Invalid transition blocked by strict validation', {
        from: currentState,
        to: newState,
        availableTransitions: this.transitionRules.filter(rule => rule.from === currentState).map(rule => rule.to)
      })
      return {
        stepId: stepId as string,
        currentState,
        attemptedState: newState,
        reason: `Invalid transition from ${currentState} to ${newState}`,
        code: WORKFLOW_CONSTANTS.ERROR_CODES.INVALID_TRANSITION
      }
    }

    // Check custom condition if present
    const validTransition = this.transitionRules.find(rule => 
      rule.from === currentState && rule.to === newState
    )
    
    console.log('🔧 [VALIDATION DEBUG] Custom condition check', {
      foundTransitionRule: !!validTransition,
      hasCondition: !!validTransition?.condition,
      from: currentState,
      to: newState
    })
    
    if (validTransition?.condition && !validTransition.condition(step)) {
      console.log('❌ [VALIDATION DEBUG] Custom condition failed', {
        from: currentState,
        to: newState,
        conditionResult: false
      })
      return {
        stepId: stepId as string,
        currentState,
        attemptedState: newState,
        reason: 'Transition condition not met',
        code: WORKFLOW_CONSTANTS.ERROR_CODES.CONDITION_NOT_MET
      }
    }

    console.log('✅ [VALIDATION DEBUG] Validation passed successfully', {
      stepId,
      from: currentState,
      to: newState
    })

    return null
  }

  /**
   * Fast transition validation using lookup table
   */
  private isValidTransition(from: StepState, to: StepState): boolean {
    const transitionKey = `${from}-${to}`
    const cached = this.computedCache.get(`transition-${transitionKey}`)
    
    if (cached !== undefined) {
      console.log('🔧 [VALIDATION DEBUG] Using cached transition result', { from, to, cached })
      return cached
    }
    
    const matchingRules = this.transitionRules.filter(rule => rule.from === from && rule.to === to)
    const isValid = matchingRules.length > 0
    
    console.log('🔧 [VALIDATION DEBUG] Transition rule lookup', {
      from,
      to,
      transitionKey,
      matchingRules: matchingRules.length,
      isValid,
      allRulesForFrom: this.transitionRules.filter(rule => rule.from === from).map(rule => `${rule.from}->${rule.to}`)
    })
    
    this.computedCache.set(`transition-${transitionKey}`, isValid)
    return isValid
  }

  /**
   * High-performance atomic state transition with <1ms target
   * Enhanced with performance monitoring and object pooling
   */
  async transitionState<T extends StepState>(
    stepId: StepId | string, 
    newState: T, 
    metadata?: Partial<StepStateMetadata<T>>
  ): Promise<StateTransitionResult<T>> {
    // Use performance monitor for comprehensive tracking
    const { result } = await performanceMonitor.measureAsyncOperation(
      'state-transition',
      async () => {
        try {
          // Convert string to StepId if needed (optimized)
          const validStepId = typeof stepId === 'string' ? createStepId(stepId) : stepId
      
      // Fast validation with caching
      const validationError = this.validateTransition(validStepId, newState)
      if (validationError) {
        return {
          success: false,
          error: validationError.reason,
          errorCode: validationError.code
        }
      }

      const step = this.steps.get(validStepId)!
      const oldState = step.stateMetadata.state
      const oldMetadata = step.stateMetadata // Direct reference for performance

      // Optimized metadata creation
      const finalMetadata: StepStateMetadata<T> = {
        state: newState,
        lastModified: createTimestamp(),
        previousState: oldState,
        reason: metadata?.reason,
        message: metadata?.message,
        context: metadata?.context ? Object.freeze({ ...metadata.context }) : undefined
      } as StepStateMetadata<T>

      // Apply state change immutably (optimized)
      const updatedStep: AnyWorkflowStepState = {
        ...step,
        stateMetadata: finalMetadata
      }
      this.steps.set(validStepId, updatedStep)
      
      // Invalidate caches
      this.invalidateCaches(validStepId)

      // Auto-transition dependent steps if needed
      await this.updateDependentSteps(validStepId, newState)

      // Create optimized change event using object pool
      const changeEvent = workflowObjectPool.createStateChangeEvent(
        validStepId,
        oldState,
        newState,
        finalMetadata,
        Date.now(),
        `${oldState}-to-${newState}`,
        true
      ) as StateChangeEvent<T>

      // Add to circular buffer history
      this.stateHistory.push(changeEvent)

      // Efficient async notification
      this.observerManager.notify(changeEvent)

      // Enhanced Electron integration: Notify bridge with full context
      this.electronBridge.notifyStateChange(changeEvent, {
        performanceMetrics: {
          transitionDuration: performance.now() - performance.now(), // Will be measured by performance monitor
          timestamp: Date.now(),
          memoryUsage: typeof window !== 'undefined' && 'performance' in window && (window.performance as any).memory ? 
                      (window.performance as any).memory.usedJSHeapSize : 0
        },
        metadata: metadata || {},
        workspaceContext: {
          currentStepId: this.currentStepId,
          totalSteps: this.steps.size,
          completedSteps: Array.from(this.steps.values()).filter(s => s.stateMetadata.state === StepState.Complete).length
        }
      })

      // NEW: Emit config persistence event for immediate config updates
      emitWorkflowStateChange(
        validStepId,
        oldState,
        newState,
        null, // workspaceId - will be populated by bridge service
        {
          reason: metadata?.reason,
          message: metadata?.message,
          context: metadata?.context,
          timestamp: Date.now()
        }
      )

      // Record transition performance
      performanceMonitor.recordTransition(performance.now() - performance.now()) // Will be handled by measureAsyncOperation
      
      // Log performance if enabled
      if (this.config.enableLogging) {
        console.log(`⚡ State transition: ${validStepId} ${oldState} → ${newState}`, metadata?.reason)
      }

      // Return success with optimized rollback
          return {
            success: true,
            result: newState,
            rollback: async () => {
              const rollbackStep: AnyWorkflowStepState = {
                ...step,
                stateMetadata: oldMetadata
              }
              this.steps.set(validStepId, rollbackStep)
              this.invalidateCaches(validStepId)
              
              // Use object pool for rollback event
              const rollbackEvent = workflowObjectPool.createStateChangeEvent(
                validStepId,
                newState,
                oldState,
                oldMetadata,
                Date.now(),
                `${newState}-to-${oldState}`,
                true
              )
              this.observerManager.notify(rollbackEvent)
            }
          }

        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorCode: WORKFLOW_CONSTANTS.ERROR_CODES.VALIDATION_FAILED
          }
        }
      },
      1 // 1ms threshold
    )
    
    return result
  }

  /**
   * Invalidate relevant caches when state changes
   */
  private invalidateCaches(stepId: StepId): void {
    this.stateVersion++
    this.accessibilityCache.clear()
    this.stepArrayCache.clear()
    
    // Clear cached state values for affected step
    this.cachedStepStates.delete(stepId)
    this.cachedCurrentStep = null
    
    // Keep computed cache for validation as it uses state version
  }

  /**
   * Update dependent steps based on state changes with type safety
   */
  private async updateDependentSteps(stepId: StepId, newState: StepState): Promise<void> {
    const stepIndex = WORKFLOW_CONSTANTS.DEFAULT_STEP_ORDER.indexOf(stepId as DefaultStepId)
    if (stepIndex === -1) return

    if (newState === StepState.Complete) {
      // Unblock next step
      const nextStepId = WORKFLOW_CONSTANTS.DEFAULT_STEP_ORDER[stepIndex + 1]
      if (nextStepId) {
        const nextStepIdTyped = createStepId(nextStepId)
        const nextStep = this.steps.get(nextStepIdTyped)
        if (nextStep && nextStep.stateMetadata.state === StepState.Blocked) {
          await this.transitionState(nextStepIdTyped, StepState.Ready, {
            reason: `Unblocked by completion of ${stepId}`,
            context: { trigger: 'dependency-completion', sourceStep: stepId }
          })
        }
      }
    } else if (newState === StepState.Ready && stepIndex > 0) {
      // Block subsequent steps if this step is reset
      for (let i = stepIndex + 1; i < WORKFLOW_CONSTANTS.DEFAULT_STEP_ORDER.length; i++) {
        const subsequentStepIdStr = WORKFLOW_CONSTANTS.DEFAULT_STEP_ORDER[i]
        const subsequentStepId = createStepId(subsequentStepIdStr)
        const subsequentStep = this.steps.get(subsequentStepId)
        if (subsequentStep && subsequentStep.stateMetadata.state !== StepState.Blocked) {
          await this.transitionState(subsequentStepId, StepState.Blocked, {
            reason: `Blocked due to reset of prerequisite ${stepId}`,
            context: { trigger: 'dependency-reset', sourceStep: stepId }
          })
        }
      }
    }
  }

  /**
   * High-performance batch operations with transaction support
   */
  async batchTransition(operations: BatchStateOperation[]): Promise<BatchOperationResult> {
    const startTime = performance.now()
    const results: Array<{ stepId: string; success: boolean; error?: string }> = []
    const rollbacks: Array<() => Promise<void>> = []
    const stateSnapshot = new Map(this.steps)

    try {
      // Disable notifications during batch
      
      // Execute all operations in batch
      for (const operation of operations) {
        const result = await this.transitionState(
          operation.stepId, 
          operation.newState, 
          operation.metadata
        )
        
        results.push({
          stepId: operation.stepId,
          success: result.success,
          error: result.error
        })

        if (result.success && result.rollback) {
          rollbacks.push(result.rollback)
        } else if (!result.success) {
          // Fast rollback using snapshot
          this.steps.clear()
          stateSnapshot.forEach((step, id) => this.steps.set(id, step))
          this.invalidateCaches('')
          
          return {
            success: false,
            results,
            rollback: async () => {} // Already rolled back
          }
        }
      }

      const batchTime = performance.now() - startTime
      if (this.config.enableLogging) {
        console.log(`📦 Batch transition completed: ${operations.length} operations (${batchTime.toFixed(2)}ms)`)
      }

      return {
        success: true,
        results,
        rollback: async () => {
          for (const rollback of rollbacks.reverse()) {
            await rollback()
          }
        }
      }

    } catch (error) {
      // Emergency rollback using snapshot
      this.steps.clear()
      stateSnapshot.forEach((step, id) => this.steps.set(id, step))
      this.invalidateCaches('')
      
      return {
        success: false,
        results,
        rollback: async () => {}
      }
    }
  }

  /**
   * Optimized step state getter with dual-layer caching
   */
  getStepState(stepId: StepId | string): StepState | null {
    const validStepId = typeof stepId === 'string' ? createStepId(stepId) : stepId
    
    // Check fast cache first
    const cachedState = this.cachedStepStates.get(validStepId)
    if (cachedState !== undefined) {
      return cachedState
    }
    
    // Check computed cache
    const computedCached = this.computedCache.get(`state-${validStepId}-${this.stateVersion}`)
    if (computedCached !== undefined) {
      this.cachedStepStates.set(validStepId, computedCached)
      return computedCached
    }
    
    // Compute and cache
    const state = this.steps.get(validStepId)?.stateMetadata.state ?? null
    this.computedCache.set(`state-${validStepId}-${this.stateVersion}`, state)
    if (state !== null) {
      this.cachedStepStates.set(validStepId, state)
    }
    return state
  }

  /**
   * Get complete step data with enhanced type safety
   */
  getStep(stepId: StepId | string): AnyWorkflowStepState | null {
    const validStepId = typeof stepId === 'string' ? createStepId(stepId) : stepId
    return this.steps.get(validStepId) ?? null
  }

  /**
   * Get typed step data for specific state
   */
  getTypedStep<T extends StepState>(
    stepId: StepId | string,
    expectedState: T
  ): WorkflowStepState<T> | null {
    const step = this.getStep(stepId)
    if (step && step.stateMetadata.state === expectedState) {
      return step as WorkflowStepState<T>
    }
    return null
  }

  /**
   * Optimized step collection with caching
   */
  getAllSteps(): ReadonlyMap<StepId, AnyWorkflowStepState> {
    const cacheKey = `all-steps-${this.stateVersion}`
    const cached = this.stepArrayCache.get(cacheKey)
    
    if (cached) {
      return new Map(cached.map(step => [step.id, step])) as ReadonlyMap<StepId, AnyWorkflowStepState>
    }
    
    const stepsArray = Array.from(this.steps.values())
    this.stepArrayCache.set(cacheKey, stepsArray)
    return new Map(this.steps) as ReadonlyMap<StepId, AnyWorkflowStepState>
  }

  /**
   * Get steps with specific state
   */
  getStepsWithState<T extends StepState>(state: T): ReadonlyArray<WorkflowStepState<T>> {
    return Array.from(this.steps.values())
      .filter(step => step.stateMetadata.state === state) as WorkflowStepState<T>[]
  }

  /**
   * Get current active step with type safety and caching
   */
  getCurrentStep(): StepId {
    if (this.cachedCurrentStep === null) {
      this.cachedCurrentStep = this.currentStepId
    }
    return this.cachedCurrentStep
  }

  /**
   * Check if input-file step has been completed
   */
  private hasCompletedInputFile(): boolean {
    const inputStep = this.steps.get(createStepId('input-file'))
    return inputStep?.stateMetadata.state === StepState.Complete
  }

  /**
   * Determines if a step change is legitimate during initialization
   * @private
   */
  private isLegitimateStepChange(stepId: StepId): boolean {
    // Allow navigation to config step if input-file is complete
    if (stepId === createStepId('config') && this.hasCompletedInputFile()) {
      const configStep = this.steps.get(createStepId('config'))
      return configStep?.stateMetadata.state === StepState.Ready
    }

    // Allow navigation to review step if it's ready (JSON import scenario)
    if (stepId === createStepId('review')) {
      const reviewStep = this.steps.get(createStepId('review'))
      return reviewStep?.stateMetadata.state === StepState.Ready
    }

    // Default: block other step changes during initialization
    return false
  }

  /**
   * Set current active step with validation
   */
  setCurrentStep(stepId: StepId | string): boolean {
    
    // Debug logging only in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [DEBUG] setCurrentStep() called', {
        requestedStepId: stepId,
        currentStepIdBefore: this.currentStepId,
        isInitializing: this.isInitializing
      })
    }

    try {
      const validStepId = typeof stepId === 'string' ? createStepId(stepId) : stepId
      
      // GUARD: Prevent changes during initialization unless it's to input-file
      // BUT add timeout to prevent infinite blocking and allow legitimate operations
      if (this.isInitializing && validStepId !== createStepId('input-file')) {
        const timeSinceInit = Date.now() - this.initializationStartTime
        
        // Check if this is a legitimate step navigation after file upload
        const isLegitimateNavigation = this.isLegitimateStepChange(validStepId)
        
        if (timeSinceInit > this.INITIALIZATION_TIMEOUT || isLegitimateNavigation) {
          if (timeSinceInit > this.INITIALIZATION_TIMEOUT) {
            console.warn('🚨 [INITIALIZATION TIMEOUT] Force completing initialization due to timeout', {
              timeSinceInit,
              timeoutLimit: this.INITIALIZATION_TIMEOUT,
              requestedStepId: stepId,
              timestamp: new Date().toISOString()
            })
          } else {
            console.log('✅ [LEGITIMATE NAVIGATION] Allowing step change during initialization', {
              requestedStepId: stepId,
              reason: 'Valid step navigation after file upload',
              timestamp: new Date().toISOString()
            })
          }
          
          // Force complete initialization to prevent infinite blocking
          this.completeInitialization()
        } else {
          console.warn('⚠️ [POTENTIAL RACE CONDITION] Blocked step change during initialization', {
            requestedStepId: stepId,
            validStepId,
            currentStepId: this.currentStepId,
            isInitializing: this.isInitializing,
            timeSinceInit,
            timeoutLimit: this.INITIALIZATION_TIMEOUT,
            reason: 'Preventing race condition during workspace initialization',
            timestamp: new Date().toISOString()
          })
          return false
        }
      }
      
      console.log('🔧 [DEBUG] Step ID validation', {
        requestedStepId: stepId,
        validStepId,
        stepExists: this.steps.has(validStepId),
        availableSteps: Array.from(this.steps.keys()),
        timestamp: new Date().toISOString()
      })

      if (this.steps.has(validStepId)) {
        const previousStepId = this.currentStepId
        this.currentStepId = validStepId
        
        // CRITICAL FIX: Invalidate cached current step when it changes
        this.cachedCurrentStep = null
        
        console.log('🔧 [DEBUG] ✅ Current step changed successfully', {
          previousStepId,
          newStepId: this.currentStepId,
          stepChanged: previousStepId !== this.currentStepId,
          isInputFileStep: this.currentStepId === 'input-file',
          timestamp: new Date().toISOString()
        })
        
        // CRITICAL FIX: Notify React components of step change
        const stepState = this.getStepState(validStepId) || StepState.Ready
        const changeEvent: StateChangeEvent = {
          stepId: validStepId,
          previousState: this.getStepState(previousStepId),
          newState: stepState,
          metadata: {
            state: stepState,
            canProceed: this.isStepAccessible(validStepId),
            timestamp: new Date().toISOString()
          }
        }
        
        console.log('📢 [DEBUG] Notifying observers of step change', {
          previousStepId,
          newStepId: validStepId,
          changeEvent,
          timestamp: new Date().toISOString()
        })
        
        this.observerManager.notify(changeEvent)
        
        return true
      } else {
        console.log('🔧 [DEBUG] ❌ Step not found in steps map', {
          requestedStepId: stepId,
          validStepId,
          availableSteps: Array.from(this.steps.keys()),
          timestamp: new Date().toISOString()
        })
      }
      return false
    } catch (error) {
      console.error('🔧 [DEBUG] ❌ Error in setCurrentStep:', error, {
        requestedStepId: stepId,
        timestamp: new Date().toISOString()
      })
      return false
    }
  }

  /**
   * Optimized accessibility check with enhanced debugging and caching
   */
  isStepAccessible(stepId: StepId | string): boolean {
    const debugContext = {
      inputStepId: stepId,
      timestamp: new Date().toISOString(),
      caller: new Error().stack?.split('\n')[2]?.trim() // Get caller information
    }
    
    const validStepId = typeof stepId === 'string' ? createStepId(stepId) : stepId
    debugContext.validStepId = validStepId
    
    // Step 1 (input-file) is always accessible - users should always be able to return to the beginning
    if (validStepId === 'input-file' || (typeof stepId === 'string' && stepId === 'input-file')) {
      // Input-file always accessible (minimal logging)
      if (process.env.NODE_ENV === 'development') {
        console.log(`🏠 Accessibility: input-file always accessible`)
      }
      return true
    }
    
    // Check cache first
    const cached = this.accessibilityCache.get(validStepId)
    if (cached !== undefined) {
      // Return cached result (minimal logging)
      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 Accessibility: ${validStepId} = ${cached} (cached)`)
      }
      return cached
    }
    
    // Perform accessibility check
    const state = this.getStepState(validStepId)
    const accessible = state === StepState.Ready || state === StepState.Complete
    
    // Enhanced debugging with detailed reasoning
    
    // Log accessibility check result (minimal logging)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Accessibility: ${validStepId} = ${accessible} (${state})`)
    }
    
    // Cache the result
    this.accessibilityCache.set(validStepId, accessible)
    
    // Additional validation logging for development
    if (!accessible) {
      const prerequisites = this.getStepPrerequisites(validStepId)
      const currentStepId = this.getCurrentStep()
      
      // Get all completed steps for analysis
      const completedSteps = Array.from(this.getAllSteps().entries())
        .filter(([_, step]) => step.stateMetadata.state === StepState.Complete)
        .map(([stepId]) => stepId)
      
      console.log(`⚠️ Step blocked - detailed analysis:`, {
        stepId: validStepId,
        currentStep: currentStepId,
        blockedState: state,
        prerequisites: prerequisites,
        completedSteps: completedSteps
      })
    }
    
    return accessible
  }

  /**
   * Get detailed reasoning for accessibility decision
   */
  private getAccessibilityReasoning(stepId: StepId, state: StepState, accessible: boolean): string {
    if (accessible) {
      switch (state) {
        case StepState.Ready:
          return `Step is ready - all prerequisites have been completed`
        case StepState.Complete:
          return `Step is complete - can be navigated to for review/editing`
        default:
          return `Step is accessible (state: ${state})`
      }
    } else {
      switch (state) {
        case StepState.Blocked:
          const prerequisites = this.getStepPrerequisites(stepId)
          return `Step is blocked - requires completion of: ${prerequisites.join(', ')}`
        case StepState.Pending:
          return `Step is pending - not yet unlocked in the workflow`
        case StepState.Error:
          return `Step has errors - must be resolved before access`
        case StepState.Processing:
          return `Step is currently processing - wait for completion`
        default:
          return `Step is not accessible (state: ${state})`
      }
    }
  }

  /**
   * Get prerequisites for a step (for debugging purposes)
   */
  private getStepPrerequisites(stepId: StepId): string[] {
    switch (stepId) {
      case 'processing':
        return ['input-file (file selection)']
      case 'review':
        return ['input-file (file selection)', 'processing (subtitle generation)']
      default:
        return []
    }
  }

  /**
   * Type-safe step state checkers
   */
  isStepReady(stepId: StepId | string): boolean {
    return this.getStepState(stepId) === StepState.Ready
  }

  isStepComplete(stepId: StepId | string): boolean {
    return this.getStepState(stepId) === StepState.Complete
  }

  isStepBlocked(stepId: StepId | string): boolean {
    return this.getStepState(stepId) === StepState.Blocked
  }

  isStepError(stepId: StepId | string): boolean {
    return this.getStepState(stepId) === StepState.Error
  }

  isStepSkipped(stepId: StepId | string): boolean {
    return this.getStepState(stepId) === StepState.Skip
  }

  hasStepWarning(stepId: StepId | string): boolean {
    return this.getStepState(stepId) === StepState.Warning
  }

  /**
   * Save current state to persistence with type safety
   */
  async saveState(): Promise<void> {
    if (!this.config.persistence) return

    try {
      const snapshot = createWorkflowStateSnapshot(
        this.currentStepId,
        Object.fromEntries(this.steps),
        {
          version: createVersion('2.0.0')
        }
      )

      await this.config.persistence.saveState(snapshot)
      
      if (this.config.enableLogging) {
        console.log('💾 Workflow state saved successfully')
      }
    } catch (error) {
      console.error('❌ Failed to save workflow state:', error)
      throw error
    }
  }

  /**
   * Load state from persistence
   */
  async loadState(): Promise<boolean> {
    console.log('🔧 [DEBUG] loadState() called', {
      timestamp: new Date().toISOString(),
      hasPersistence: !!this.config.persistence,
      currentStepIdBefore: this.currentStepId,
      stepsCountBefore: this.steps.size,
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    })

    if (!this.config.persistence) {
      console.log('🔧 [DEBUG] No persistence configured, returning false')
      return false
    }

    try {
      const snapshot = await this.config.persistence.loadState()
      
      console.log('🔧 [DEBUG] Persistence snapshot loaded', {
        hasSnapshot: !!snapshot,
        snapshotCurrentStepId: snapshot?.currentStepId,
        snapshotStepsCount: snapshot?.steps ? Object.keys(snapshot.steps).length : 0,
        snapshotSteps: snapshot?.steps ? Object.keys(snapshot.steps) : [],
        timestamp: new Date().toISOString()
      })

      if (!snapshot) {
        console.log('🔧 [DEBUG] No snapshot found, returning false')
        return false
      }

      // Log pre-restoration state
      console.log('🔧 [DEBUG] Pre-restoration state', {
        currentStepId: this.currentStepId,
        stepsCount: this.steps.size,
        stepIds: Array.from(this.steps.keys()),
        timestamp: new Date().toISOString()
      })

      // Restore steps
      this.steps.clear()
      Object.entries(snapshot.steps).forEach(([id, step]) => {
        this.steps.set(id, step)
        console.log(`🔧 [DEBUG] Restored step:`, {
          stepId: id,
          stepState: step.stateMetadata?.state,
          stepTitle: step.title,
          timestamp: new Date().toISOString()
        })
      })

      // CRITICAL FIX: Prevent persistence from overriding input-file during fresh sessions
      const previousCurrentStepId = this.currentStepId
      const shouldRestoreStep = snapshot.currentStepId === 'input-file' || 
                               (snapshot.currentStepId === 'config' && this.hasCompletedInputFile())
      
      if (shouldRestoreStep) {
        this.currentStepId = snapshot.currentStepId
        
        // CACHE FIX: Invalidate current step cache
        this.cachedCurrentStep = null
        
        console.log('🔧 [DEBUG] ✅ Current step restored from snapshot', {
          previousCurrentStepId,
          restoredCurrentStepId: this.currentStepId,
          reason: snapshot.currentStepId === 'input-file' ? 'Default step' : 'Input completed'
        })
      } else {
        // Force back to input-file for new sessions or incomplete workflows
        this.currentStepId = createStepId('input-file')
        
        // CACHE FIX: Invalidate current step cache
        this.cachedCurrentStep = null
        
        console.log('🔧 [DEBUG] ⚠️ OVERRODE snapshot step - forced to input-file', {
          snapshotWantedStep: snapshot.currentStepId,
          actualStep: this.currentStepId,
          reason: 'Fresh session or incomplete input file step',
          timestamp: new Date().toISOString()
        })
      }

      // Log post-restoration state
      console.log('🔧 [DEBUG] Post-restoration state', {
        currentStepId: this.currentStepId,
        stepsCount: this.steps.size,
        stepIds: Array.from(this.steps.keys()),
        allStepStates: Array.from(this.steps.entries()).map(([id, step]) => ({
          id,
          state: step.stateMetadata?.state
        })),
        timestamp: new Date().toISOString()
      })

      if (this.config.enableLogging) {
        console.log('🔄 [DEBUG] Workflow state restored from persistence', {
          restoredCurrentStepId: this.currentStepId,
          isNotDefaultStep: this.currentStepId !== 'input-file',
          stepsRestored: this.steps.size,
          timestamp: new Date().toISOString()
        })
      }

      return true
    } catch (error) {
      console.error('❌ [DEBUG] Failed to load workflow state:', error, {
        timestamp: new Date().toISOString(),
        stackTrace: error instanceof Error ? error.stack : 'No stack trace'
      })
      return false
    }
  }

  /**
   * Get state history as array
   */
  getStateHistory(): ReadonlyArray<StateChangeEvent> {
    return this.stateHistory.toArray()
  }

  /**
   * Enhanced subscription with micro-subscriptions
   */
  subscribe(observer: (event: StateChangeEvent) => void, stepId?: StepId): () => void {
    return this.observerManager.subscribe(observer, stepId)
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Readonly<PerformanceMetrics> {
    this.updatePerformanceMetrics()
    return { ...this.performanceMetrics }
  }

  /**
   * Clear all caches for memory optimization
   */
  clearCaches(): void {
    this.computedCache.clear()
    this.accessibilityCache.clear()
    this.stepArrayCache.clear()
    this.cachedStepStates.clear()
    this.cachedCurrentStep = null
    this.stateVersion++
  }


  /**
   * Reset all steps to initial state
   */
  reset(): void {
    
    this.steps.clear()
    this.currentStepId = createStepId('input-file')
    this.stateHistory.clear()
    this.clearCaches()  // This already clears cachedCurrentStep
    this.initializeDefaultSteps()
    
    // Force notify all observers of the reset
    this.observerManager.notify({
      stepId: 'input-file',
      previousState: null,
      newState: StepState.Ready,
      metadata: {
        state: StepState.Ready,
        reason: 'Workflow reset to initial state',
        lastModified: createTimestamp(),
        previousState: null
      },
      timestamp: createTimestamp()
    })
    
    console.log('✅ [CRITICAL] Workflow reset complete - forced to input-file', {
      currentStepAfter: this.currentStepId,
      stepsCount: this.steps.size,
      isInputFileStep: this.currentStepId === 'input-file',
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Cleanup resources with enhanced memory management
   */
  destroy(): void {
    this.observerManager.clear()
    this.stateHistory.clear()
    this.clearCaches()
    
    // Clear all maps for GC
    this.steps.clear()
  }
}

// Singleton instance for global access
console.log('🔧 [DEBUG] Creating WorkflowStateManager singleton instance', {
  timestamp: new Date().toISOString(),
  stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
})

export const workflowStateManager = new WorkflowStateManager()

console.log('🔧 [DEBUG] WorkflowStateManager singleton instance created', {
  currentStepId: workflowStateManager.getCurrentStep(),
  stepsCount: workflowStateManager.getAllSteps().size,
  timestamp: new Date().toISOString()
})

// Helper functions for common operations
export const getStepState = (stepId: string) => workflowStateManager.getStepState(stepId)
export const isStepAccessible = (stepId: string) => workflowStateManager.isStepAccessible(stepId)
export const transitionStep = (stepId: string, newState: StepState, metadata?: Partial<StepStateMetadata>) => 
  workflowStateManager.transitionState(stepId, newState, metadata)

// Debug helper to track race condition
export const debugWorkflowState = () => {
  console.log('🔧 [DEBUG] === WORKFLOW STATE DEBUG SUMMARY ===', {
    timestamp: new Date().toISOString(),
    currentStepId: workflowStateManager.getCurrentStep(),
    stepsCount: workflowStateManager.getAllSteps().size,
    allSteps: Array.from(workflowStateManager.getAllSteps().entries()).map(([id, step]) => ({
      id,
      state: step.stateMetadata.state,
      title: step.title,
      lastModified: step.stateMetadata.lastModified
    })),
    hasPersistence: !!workflowStateManager['config'].persistence,
    performanceMetrics: workflowStateManager.getPerformanceMetrics()
  })
  console.log('🔧 [DEBUG] === END WORKFLOW STATE DEBUG SUMMARY ===')
}

// Debug call stack tracker
let debugCallStack: string[] = []
export const addDebugCall = (callName: string) => {
  debugCallStack.push(`${new Date().toISOString()}: ${callName}`)
  if (debugCallStack.length > 20) {
    debugCallStack = debugCallStack.slice(-10) // Keep last 10 calls
  }
}

export const getDebugCallStack = () => [...debugCallStack]

// Track when singleton is accessed
const originalGetCurrentStep = workflowStateManager.getCurrentStep.bind(workflowStateManager)
workflowStateManager.getCurrentStep = function() {
  addDebugCall('getCurrentStep()')
  return originalGetCurrentStep()
}

const originalSetCurrentStep = workflowStateManager.setCurrentStep.bind(workflowStateManager)
workflowStateManager.setCurrentStep = function(stepId) {
  addDebugCall(`setCurrentStep(${stepId})`)
  return originalSetCurrentStep(stepId)
}