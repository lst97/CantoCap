/**
 * High-Performance Object Pool System
 * Reduces garbage collection pressure and improves memory efficiency
 * Optimized for frequently created/destroyed objects in WorkflowStateManager
 */

export interface PoolableObject {
  reset?(): void
  dispose?(): void
}

export interface PoolConfig {
  initialSize: number
  maxSize: number
  growthFactor: number
  shrinkThreshold: number
  shrinkInterval: number
  validateObject?: (obj: any) => boolean
}

/**
 * Generic object pool with automatic sizing and memory management
 */
export class ObjectPool<T extends PoolableObject> {
  private pool: T[] = []
  private createFn: () => T
  private config: PoolConfig
  private created = 0
  private borrowed = 0
  private returned = 0
  private shrinkTimer?: NodeJS.Timeout
  
  constructor(
    createFn: () => T,
    config: Partial<PoolConfig> = {}
  ) {
    this.createFn = createFn
    this.config = {
      initialSize: 10,
      maxSize: 100,
      growthFactor: 1.5,
      shrinkThreshold: 0.25,
      shrinkInterval: 30000, // 30 seconds
      ...config
    }
    
    this.initialize()
    this.startShrinkTimer()
  }
  
  /**
   * Initialize pool with initial objects
   */
  private initialize(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      this.pool.push(this.createFn())
      this.created++
    }
  }
  
  /**
   * Borrow object from pool
   */
  borrow(): T {
    let obj = this.pool.pop()
    
    if (!obj) {
      // Pool exhausted, create new object
      obj = this.createFn()
      this.created++
    }
    
    // Reset object state if needed
    if (obj.reset) {
      obj.reset()
    }
    
    this.borrowed++
    return obj
  }
  
  /**
   * Return object to pool
   */
  return(obj: T): void {
    // Validate object if validator provided
    if (this.config.validateObject && !this.config.validateObject(obj)) {
      if (obj.dispose) {
        obj.dispose()
      }
      return
    }
    
    // Don't exceed max pool size
    if (this.pool.length < this.config.maxSize) {
      this.pool.push(obj)
    } else {
      // Pool full, dispose object
      if (obj.dispose) {
        obj.dispose()
      }
    }
    
    this.returned++
  }
  
  /**
   * Start automatic pool shrinking
   */
  private startShrinkTimer(): void {
    this.shrinkTimer = setInterval(() => {
      this.shrinkPool()
    }, this.config.shrinkInterval)
  }
  
  /**
   * Shrink pool if utilization is low
   */
  private shrinkPool(): void {
    const targetSize = Math.max(
      this.config.initialSize,
      Math.floor(this.pool.length * this.config.shrinkThreshold)
    )
    
    while (this.pool.length > targetSize) {
      const obj = this.pool.pop()
      if (obj?.dispose) {
        obj.dispose()
      }
    }
  }
  
  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number
    created: number
    borrowed: number
    returned: number
    utilization: number
  } {
    return {
      poolSize: this.pool.length,
      created: this.created,
      borrowed: this.borrowed,
      returned: this.returned,
      utilization: this.returned > 0 ? this.borrowed / this.returned : 1
    }
  }
  
  /**
   * Clear and dispose all objects in pool
   */
  clear(): void {
    this.pool.forEach(obj => {
      if (obj.dispose) {
        obj.dispose()
      }
    })
    this.pool = []
    
    if (this.shrinkTimer) {
      clearInterval(this.shrinkTimer)
    }
  }
  
  /**
   * Get current pool size
   */
  size(): number {
    return this.pool.length
  }
}

/**
 * State change event object for pooling
 */
export interface PoolableStateChangeEvent extends PoolableObject {
  stepId: string
  oldState: string
  newState: string
  metadata: any
  timestamp: number
  transitionKey: string
  isValid: boolean
}

/**
 * State metadata object for pooling
 */
export interface PoolableStateMetadata extends PoolableObject {
  state: string
  lastModified: number
  previousState?: string
  reason?: string
  message?: string
  context?: Record<string, unknown>
}

/**
 * Observer notification object for pooling
 */
export interface PoolableNotification extends PoolableObject {
  event: any
  observers: Set<Function>
  timestamp: number
}

/**
 * Centralized object pool manager for WorkflowStateManager
 */
export class WorkflowObjectPoolManager {
  private stateChangeEventPool: ObjectPool<PoolableStateChangeEvent>
  private stateMetadataPool: ObjectPool<PoolableStateMetadata>
  private notificationPool: ObjectPool<PoolableNotification>
  private observerSetPool: ObjectPool<Set<Function>>
  
  constructor() {
    // State change event pool
    this.stateChangeEventPool = new ObjectPool<PoolableStateChangeEvent>(
      () => ({
        stepId: '',
        oldState: '',
        newState: '',
        metadata: null,
        timestamp: 0,
        transitionKey: '',
        isValid: false,
        reset() {
          this.stepId = ''
          this.oldState = ''
          this.newState = ''
          this.metadata = null
          this.timestamp = 0
          this.transitionKey = ''
          this.isValid = false
        }
      }),
      { initialSize: 20, maxSize: 200 }
    )
    
    // State metadata pool
    this.stateMetadataPool = new ObjectPool<PoolableStateMetadata>(
      () => ({
        state: '',
        lastModified: 0,
        reset() {
          this.state = ''
          this.lastModified = 0
          this.previousState = undefined
          this.reason = undefined
          this.message = undefined
          this.context = undefined
        }
      }),
      { initialSize: 15, maxSize: 150 }
    )
    
    // Notification pool
    this.notificationPool = new ObjectPool<PoolableNotification>(
      () => ({
        event: null,
        observers: new Set(),
        timestamp: 0,
        reset() {
          this.event = null
          this.observers.clear()
          this.timestamp = 0
        }
      }),
      { initialSize: 10, maxSize: 100 }
    )
    
    // Observer set pool
    this.observerSetPool = new ObjectPool<Set<Function>>(
      () => new Set(),
      { 
        initialSize: 5, 
        maxSize: 50,
        validateObject: (set) => set instanceof Set
      }
    )
  }
  
  /**
   * Create pooled state change event
   */
  createStateChangeEvent(
    stepId: string,
    oldState: string,
    newState: string,
    metadata: any,
    timestamp: number,
    transitionKey: string,
    isValid: boolean
  ): PoolableStateChangeEvent {
    const event = this.stateChangeEventPool.borrow()
    event.stepId = stepId
    event.oldState = oldState
    event.newState = newState
    event.metadata = metadata
    event.timestamp = timestamp
    event.transitionKey = transitionKey
    event.isValid = isValid
    return event
  }
  
  /**
   * Return state change event to pool
   */
  returnStateChangeEvent(event: PoolableStateChangeEvent): void {
    this.stateChangeEventPool.return(event)
  }
  
  /**
   * Create pooled state metadata
   */
  createStateMetadata(
    state: string,
    lastModified: number,
    previousState?: string,
    reason?: string,
    message?: string,
    context?: Record<string, unknown>
  ): PoolableStateMetadata {
    const metadata = this.stateMetadataPool.borrow()
    metadata.state = state
    metadata.lastModified = lastModified
    metadata.previousState = previousState
    metadata.reason = reason
    metadata.message = message
    metadata.context = context
    return metadata
  }
  
  /**
   * Return state metadata to pool
   */
  returnStateMetadata(metadata: PoolableStateMetadata): void {
    this.stateMetadataPool.return(metadata)
  }
  
  /**
   * Create pooled notification
   */
  createNotification(event: any, observers: Set<Function>, timestamp: number): PoolableNotification {
    const notification = this.notificationPool.borrow()
    notification.event = event
    notification.observers = observers
    notification.timestamp = timestamp
    return notification
  }
  
  /**
   * Return notification to pool
   */
  returnNotification(notification: PoolableNotification): void {
    this.notificationPool.return(notification)
  }
  
  /**
   * Create pooled observer set
   */
  createObserverSet(): Set<Function> {
    const set = this.observerSetPool.borrow()
    set.clear() // Ensure it's empty
    return set
  }
  
  /**
   * Return observer set to pool
   */
  returnObserverSet(set: Set<Function>): void {
    this.observerSetPool.return(set)
  }
  
  /**
   * Get comprehensive pool statistics
   */
  getPoolStats(): {
    stateChangeEvents: ReturnType<ObjectPool<any>['getStats']>
    stateMetadata: ReturnType<ObjectPool<any>['getStats']>
    notifications: ReturnType<ObjectPool<any>['getStats']>
    observerSets: ReturnType<ObjectPool<any>['getStats']>
    totalMemorySaving: number
  } {
    const stateChangeStats = this.stateChangeEventPool.getStats()
    const stateMetadataStats = this.stateMetadataPool.getStats()
    const notificationStats = this.notificationPool.getStats()
    const observerSetStats = this.observerSetPool.getStats()
    
    // Estimate memory savings (rough calculation)
    const totalMemorySaving = (
      stateChangeStats.borrowed * 200 + // ~200 bytes per state change event
      stateMetadataStats.borrowed * 150 + // ~150 bytes per metadata
      notificationStats.borrowed * 100 + // ~100 bytes per notification
      observerSetStats.borrowed * 50 // ~50 bytes per set overhead
    )
    
    return {
      stateChangeEvents: stateChangeStats,
      stateMetadata: stateMetadataStats,
      notifications: notificationStats,
      observerSets: observerSetStats,
      totalMemorySaving
    }
  }
  
  /**
   * Clear all object pools
   */
  clearAllPools(): void {
    this.stateChangeEventPool.clear()
    this.stateMetadataPool.clear()
    this.notificationPool.clear()
    this.observerSetPool.clear()
  }
  
  /**
   * Generate pool utilization report
   */
  generateReport(): string {
    const stats = this.getPoolStats()
    
    return `
🏊 Object Pool Utilization Report
=================================

📦 State Change Events:
- Pool Size: ${stats.stateChangeEvents.poolSize}
- Created: ${stats.stateChangeEvents.created}
- Borrowed: ${stats.stateChangeEvents.borrowed}
- Returned: ${stats.stateChangeEvents.returned}
- Utilization: ${(stats.stateChangeEvents.utilization * 100).toFixed(1)}%

📋 State Metadata:
- Pool Size: ${stats.stateMetadata.poolSize}
- Created: ${stats.stateMetadata.created}
- Borrowed: ${stats.stateMetadata.borrowed}
- Returned: ${stats.stateMetadata.returned}
- Utilization: ${(stats.stateMetadata.utilization * 100).toFixed(1)}%

🔔 Notifications:
- Pool Size: ${stats.notifications.poolSize}
- Created: ${stats.notifications.created}
- Borrowed: ${stats.notifications.borrowed}
- Returned: ${stats.notifications.returned}
- Utilization: ${(stats.notifications.utilization * 100).toFixed(1)}%

👥 Observer Sets:
- Pool Size: ${stats.observerSets.poolSize}
- Created: ${stats.observerSets.created}
- Borrowed: ${stats.observerSets.borrowed}
- Returned: ${stats.observerSets.returned}
- Utilization: ${(stats.observerSets.utilization * 100).toFixed(1)}%

💾 Memory Savings: ~${(stats.totalMemorySaving / 1024).toFixed(1)}KB
`
  }
}

// Create singleton instance
export const workflowObjectPool = new WorkflowObjectPoolManager()