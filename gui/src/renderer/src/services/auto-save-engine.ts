// Auto-Save Engine - Performance-Optimized Real-Time Persistence System
import { workspaceDatabase } from './workspace-database'
import type { 
  WorkflowStepId, 
  StepConfigUpdate,
  AutoSaveConfig,
  AutoSaveStatus,
  WorkspaceError
} from '../types/workspace'

// ============================================================================
// PERFORMANCE-OPTIMIZED AUTO-SAVE TYPES
// ============================================================================

export interface SaveOperation {
  id: string
  type: 'workspace' | 'step-config' | 'session' | 'cache'
  priority: 'critical' | 'normal' | 'low'
  workspaceId: string
  stepId?: WorkflowStepId
  data: any
  estimatedSize: number
  createdAt: number
  retryCount: number
  maxRetries: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export interface SaveBatch {
  id: string
  priority: 'critical' | 'normal' | 'low'
  operations: SaveOperation[]
  totalSize: number
  createdAt: number
  processingStartedAt?: number
}

export interface ActivityPattern {
  activeInteractions: number
  lastActivityTime: number
  sessionDuration: number
  averageInteractionFrequency: number
  currentPattern: 'high-activity' | 'moderate' | 'low-activity' | 'idle'
}

export interface AutoSavePerformanceMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageSaveLatency: number
  averageBatchSize: number
  cacheHitRate: number
  memoryUsage: number
  backgroundTasksActive: number
  offlineOperations: number
}

export interface OptimizationSuggestion {
  id: string
  type: 'performance' | 'memory' | 'network' | 'storage'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  impact: string
  action?: () => Promise<void>
  createdAt: number
}

// ============================================================================
// ACTIVITY PATTERN ANALYZER
// ============================================================================

class ActivityPatternAnalyzer {
  private interactions: number[] = []
  private lastActivity = Date.now()
  private sessionStart = Date.now()
  private readonly windowSize = 30000 // 30 seconds
  private readonly inactivityThreshold = 60000 // 1 minute

  recordActivity(): void {
    const now = Date.now()
    this.interactions.push(now)
    this.lastActivity = now
    
    // Remove old interactions outside the window
    this.interactions = this.interactions.filter(time => now - time <= this.windowSize)
  }

  getCurrentPattern(): ActivityPattern {
    const now = Date.now()
    const activeInteractions = this.interactions.length
    const sessionDuration = now - this.sessionStart
    const averageInteractionFrequency = activeInteractions / Math.max(sessionDuration / 1000, 1)
    
    let currentPattern: ActivityPattern['currentPattern']
    
    if (now - this.lastActivity > this.inactivityThreshold) {
      currentPattern = 'idle'
    } else if (averageInteractionFrequency > 2) {
      currentPattern = 'high-activity'
    } else if (averageInteractionFrequency > 0.5) {
      currentPattern = 'moderate'
    } else {
      currentPattern = 'low-activity'
    }

    return {
      activeInteractions,
      lastActivityTime: this.lastActivity,
      sessionDuration,
      averageInteractionFrequency,
      currentPattern
    }
  }

  getOptimalDebounceMs(): number {
    const pattern = this.getCurrentPattern()
    
    switch (pattern.currentPattern) {
      case 'high-activity':
        return 500 // Quick saves during active editing
      case 'moderate':
        return 1500 // Standard debounce
      case 'low-activity':
        return 3000 // Longer debounce for infrequent changes
      case 'idle':
        return 100 // Immediate save when becoming idle
      default:
        return 1500
    }
  }

  getOptimalBatchSize(): number {
    const pattern = this.getCurrentPattern()
    
    switch (pattern.currentPattern) {
      case 'high-activity':
        return 8 // Larger batches for frequent operations
      case 'moderate':
        return 5 // Standard batch size
      case 'low-activity':
        return 3 // Smaller batches for infrequent operations
      case 'idle':
        return 1 // Process immediately when idle
      default:
        return 5
    }
  }
}

// ============================================================================
// PERFORMANCE-OPTIMIZED AUTO-SAVE ENGINE
// ============================================================================

export class AutoSaveEngine {
  private config: AutoSaveConfig = {
    enabled: true,
    debounceMs: 1500,
    maxRetries: 3,
    batchSize: 5,
    includesSessions: true
  }

  private status: AutoSaveStatus = {
    isEnabled: true,
    pendingSaves: 0,
    failedSaves: 0
  }

  private saveQueue: SaveOperation[] = []
  private processingBatch: SaveBatch | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private backgroundWorker: Worker | null = null
  private activityAnalyzer = new ActivityPatternAnalyzer()
  private performanceMetrics: AutoSavePerformanceMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageSaveLatency: 0,
    averageBatchSize: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    backgroundTasksActive: 0,
    offlineOperations: 0
  }
  private optimizationSuggestions: OptimizationSuggestion[] = []
  private isOnline = navigator.onLine
  private offlineQueue: SaveOperation[] = []

  constructor() {
    this.initializeBackgroundWorker()
    this.setupOnlineStatusMonitoring()
    this.startPerformanceMonitoring()
  }

  // ============================================================================
  // INITIALIZATION AND SETUP
  // ============================================================================

  private initializeBackgroundWorker(): void {
    try {
      // Note: Web Worker would be created here in a real implementation
      // For now, we'll simulate background processing with setTimeout
      console.log('Background sync worker initialized (simulated)')
    } catch (error) {
      console.warn('Background worker not available, falling back to main thread:', error)
    }
  }

  private setupOnlineStatusMonitoring(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.procesOfflineQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updatePerformanceMetrics()
      this.generateOptimizationSuggestions()
    }, 5000) // Monitor every 5 seconds
  }

  // ============================================================================
  // CORE AUTO-SAVE FUNCTIONALITY
  // ============================================================================

  configure(config: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...config }
    this.status.isEnabled = this.config.enabled
  }

  getStatus(): AutoSaveStatus & { performanceMetrics: AutoSavePerformanceMetrics } {
    return {
      ...this.status,
      performanceMetrics: { ...this.performanceMetrics }
    }
  }

  scheduleStepConfigSave(
    workspaceId: string,
    stepId: WorkflowStepId,
    config: any,
    priority: SaveOperation['priority'] = 'normal'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.activityAnalyzer.recordActivity()
      
      const operation: SaveOperation = {
        id: this.generateOperationId(),
        type: 'step-config',
        priority,
        workspaceId,
        stepId,
        data: config,
        estimatedSize: this.estimateDataSize(config),
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        onSuccess: () => resolve(),
        onError: (error) => reject(error)
      }

      if (this.isOnline) {
        this.addToQueue(operation)
        this.scheduleBatchProcessing()
      } else {
        this.addToOfflineQueue(operation)
      }
    })
  }

  scheduleWorkspaceSave(
    workspaceId: string,
    data: any,
    priority: SaveOperation['priority'] = 'normal'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.activityAnalyzer.recordActivity()
      
      const operation: SaveOperation = {
        id: this.generateOperationId(),
        type: 'workspace',
        priority,
        workspaceId,
        data,
        estimatedSize: this.estimateDataSize(data),
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        onSuccess: () => resolve(),
        onError: (error) => reject(error)
      }

      if (this.isOnline) {
        this.addToQueue(operation)
        this.scheduleBatchProcessing()
      } else {
        this.addToOfflineQueue(operation)
      }
    })
  }

  // ============================================================================
  // INTELLIGENT BATCHING AND QUEUING
  // ============================================================================

  private addToQueue(operation: SaveOperation): void {
    // Remove any existing operation for the same resource to avoid duplicates
    this.saveQueue = this.saveQueue.filter(existing => 
      !(existing.workspaceId === operation.workspaceId && 
        existing.stepId === operation.stepId && 
        existing.type === operation.type)
    )

    // Insert operation based on priority
    const insertIndex = this.findInsertionIndex(operation)
    this.saveQueue.splice(insertIndex, 0, operation)
    
    this.status.pendingSaves = this.saveQueue.length
  }

  private findInsertionIndex(operation: SaveOperation): number {
    const priorityOrder = { critical: 0, normal: 1, low: 2 }
    
    for (let i = 0; i < this.saveQueue.length; i++) {
      if (priorityOrder[operation.priority] < priorityOrder[this.saveQueue[i].priority]) {
        return i
      }
    }
    
    return this.saveQueue.length
  }

  private scheduleBatchProcessing(): void {
    if (!this.config.enabled || this.processingBatch) {
      return
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    const debounceMs = this.activityAnalyzer.getOptimalDebounceMs()
    
    this.debounceTimer = setTimeout(() => {
      this.processBatch()
    }, debounceMs)

    this.status.nextScheduledSave = Date.now() + debounceMs
  }

  private async processBatch(): Promise<void> {
    if (!this.saveQueue || this.saveQueue.length === 0 || this.processingBatch) {
      return
    }

    const batchSize = Math.min(
      this.activityAnalyzer.getOptimalBatchSize(),
      this.config.batchSize,
      this.saveQueue.length
    )

    // Create batch with priority-based selection
    const operations = this.selectOperationsForBatch(batchSize)
    const batch: SaveBatch = {
      id: this.generateBatchId(),
      priority: this.determineBatchPriority(operations),
      operations,
      totalSize: operations.reduce((sum, op) => sum + op.estimatedSize, 0),
      createdAt: Date.now(),
      processingStartedAt: Date.now()
    }

    this.processingBatch = batch
    this.status.pendingSaves = this.saveQueue.length

    try {
      await this.processBatchOperations(batch)
      this.performanceMetrics.successfulOperations += batch.operations.length
      
      // Notify success callbacks
      batch.operations.forEach(op => op.onSuccess?.())
      
    } catch (error) {
      console.error('Batch processing failed:', error)
      this.performanceMetrics.failedOperations += batch.operations.length
      
      // Handle failed operations
      await this.handleBatchFailure(batch, error as Error)
    } finally {
      this.processingBatch = null
      this.updatePerformanceMetrics()
      
      // Process next batch if queue is not empty
      if (this.saveQueue.length > 0) {
        setTimeout(() => this.processBatch(), 100)
      }
    }
  }

  private selectOperationsForBatch(batchSize: number): SaveOperation[] {
    const operations: SaveOperation[] = []
    
    // Defensive check for saveQueue
    if (!this.saveQueue || !Array.isArray(this.saveQueue)) {
      console.warn('AutoSaveEngine: saveQueue is not properly initialized')
      return operations
    }
    
    const operationsByPriority = this.groupOperationsByPriority()
    
    // Defensive check for operationsByPriority
    if (!operationsByPriority) {
      console.warn('AutoSaveEngine: groupOperationsByPriority returned undefined')
      return operations
    }
    
    // Process critical operations first
    ['critical', 'normal', 'low'].forEach(priority => {
      const priorityOps = operationsByPriority[priority as SaveOperation['priority']] || []
      while (operations.length < batchSize && priorityOps.length > 0) {
        operations.push(priorityOps.shift()!)
      }
    })

    // Remove selected operations from queue
    operations.forEach(op => {
      const index = this.saveQueue.findIndex(queueOp => queueOp.id === op.id)
      if (index !== -1) {
        this.saveQueue.splice(index, 1)
      }
    })

    return operations
  }

  private groupOperationsByPriority(): Record<SaveOperation['priority'], SaveOperation[]> {
    // Defensive check for saveQueue
    if (!this.saveQueue || !Array.isArray(this.saveQueue)) {
      console.warn('AutoSaveEngine: saveQueue is not properly initialized in groupOperationsByPriority')
      return {} as Record<SaveOperation['priority'], SaveOperation[]>
    }
    
    return this.saveQueue.reduce((groups, operation) => {
      // Defensive check for operation
      if (!operation || !operation.priority) {
        console.warn('AutoSaveEngine: invalid operation found in saveQueue', operation)
        return groups
      }
      
      if (!groups[operation.priority]) {
        groups[operation.priority] = []
      }
      groups[operation.priority].push(operation)
      return groups
    }, {} as Record<SaveOperation['priority'], SaveOperation[]>)
  }

  private determineBatchPriority(operations: SaveOperation[]): SaveBatch['priority'] {
    if (operations.some(op => op.priority === 'critical')) return 'critical'
    if (operations.some(op => op.priority === 'normal')) return 'normal'
    return 'low'
  }

  // ============================================================================
  // BATCH PROCESSING AND DATABASE OPERATIONS
  // ============================================================================

  private async processBatchOperations(batch: SaveBatch): Promise<void> {
    const startTime = Date.now()
    
    // Group operations by type for optimized processing
    const operationsByType = this.groupOperationsByType(batch.operations)
    
    // Process step configurations in batch
    if (operationsByType['step-config']?.length > 0) {
      await this.processStepConfigBatch(operationsByType['step-config'])
    }
    
    // Process workspace updates
    if (operationsByType['workspace']?.length > 0) {
      await this.processWorkspaceBatch(operationsByType['workspace'])
    }
    
    // Process session updates
    if (operationsByType['session']?.length > 0) {
      await this.processSessionBatch(operationsByType['session'])
    }

    // Update performance metrics
    const processingTime = Date.now() - startTime
    this.performanceMetrics.averageSaveLatency = 
      (this.performanceMetrics.averageSaveLatency + processingTime) / 2
    this.performanceMetrics.averageBatchSize = 
      (this.performanceMetrics.averageBatchSize + batch.operations.length) / 2
  }

  private groupOperationsByType(operations: SaveOperation[]): Record<SaveOperation['type'], SaveOperation[]> {
    return operations.reduce((groups, operation) => {
      if (!groups[operation.type]) {
        groups[operation.type] = []
      }
      groups[operation.type].push(operation)
      return groups
    }, {} as Record<SaveOperation['type'], SaveOperation[]>)
  }

  private async processStepConfigBatch(operations: SaveOperation[]): Promise<void> {
    // Group by workspace for batch updates
    const workspaceGroups = operations.reduce((groups, operation) => {
      if (!groups[operation.workspaceId]) {
        groups[operation.workspaceId] = []
      }
      groups[operation.workspaceId].push({
        stepId: operation.stepId!,
        config: operation.data,
        merge: true
      } satisfies StepConfigUpdate)
      return groups
    }, {} as Record<string, StepConfigUpdate[]>)

    // Process each workspace group
    for (const [workspaceId, updates] of Object.entries(workspaceGroups)) {
      await workspaceDatabase.batchUpdateStepConfigurations(workspaceId, updates)
    }
  }

  private async processWorkspaceBatch(operations: SaveOperation[]): Promise<void> {
    // Process workspace updates sequentially to avoid conflicts
    for (const operation of operations) {
      await workspaceDatabase.updateWorkspace(operation.data)
    }
  }

  private async processSessionBatch(operations: SaveOperation[]): Promise<void> {
    // Process session updates sequentially
    for (const operation of operations) {
      await workspaceDatabase.updateSession(operation.data)
    }
  }

  private async handleBatchFailure(batch: SaveBatch, error: Error): Promise<void> {
    // Increment retry count for all operations
    batch.operations.forEach(op => op.retryCount++)
    
    // Separate retryable and failed operations
    const retryableOps = batch.operations.filter(op => op.retryCount < op.maxRetries)
    const failedOps = batch.operations.filter(op => op.retryCount >= op.maxRetries)
    
    // Re-queue retryable operations with exponential backoff
    retryableOps.forEach(op => {
      setTimeout(() => {
        this.addToQueue(op)
        this.scheduleBatchProcessing()
      }, Math.pow(2, op.retryCount) * 1000)
    })
    
    // Notify failed operations
    failedOps.forEach(op => {
      this.status.failedSaves++
      op.onError?.(error)
    })
  }

  // ============================================================================
  // OFFLINE SUPPORT
  // ============================================================================

  private addToOfflineQueue(operation: SaveOperation): void {
    this.offlineQueue.push(operation)
    this.performanceMetrics.offlineOperations++
    
    // Limit offline queue size to prevent memory issues
    if (this.offlineQueue.length > 1000) {
      this.offlineQueue.shift() // Remove oldest operation
    }
  }

  private async procesOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) {
      return
    }

    console.log(`Processing ${this.offlineQueue.length} offline operations`)
    
    // Move offline operations to main queue
    this.offlineQueue.forEach(operation => {
      this.addToQueue(operation)
    })
    
    this.offlineQueue = []
    this.performanceMetrics.offlineOperations = 0
    
    // Start processing
    this.scheduleBatchProcessing()
  }

  // ============================================================================
  // PERFORMANCE MONITORING AND OPTIMIZATION
  // ============================================================================

  private updatePerformanceMetrics(): void {
    this.performanceMetrics.totalOperations = 
      this.performanceMetrics.successfulOperations + this.performanceMetrics.failedOperations
    
    // Estimate memory usage (simplified)
    this.performanceMetrics.memoryUsage = 
      (this.saveQueue.length + this.offlineQueue.length) * 1024 // Rough estimate
    
    this.performanceMetrics.backgroundTasksActive = 
      this.processingBatch ? 1 : 0
  }

  private generateOptimizationSuggestions(): void {
    const metrics = this.performanceMetrics
    const pattern = this.activityAnalyzer.getCurrentPattern()
    
    // Clear old suggestions
    this.optimizationSuggestions = this.optimizationSuggestions.filter(
      suggestion => Date.now() - suggestion.createdAt < 300000 // 5 minutes
    )
    
    // Memory optimization suggestions
    if (metrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
      this.addOptimizationSuggestion({
        type: 'memory',
        severity: 'warning',
        title: 'High memory usage detected',
        description: `Auto-save is using ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB of memory`,
        impact: 'May slow down the application',
        action: async () => {
          await this.processBatch() // Force process pending saves
        }
      })
    }
    
    // Performance optimization suggestions
    if (metrics.averageSaveLatency > 2000) { // 2 seconds
      this.addOptimizationSuggestion({
        type: 'performance',
        severity: 'warning',
        title: 'Slow save operations detected',
        description: `Average save time is ${Math.round(metrics.averageSaveLatency)}ms`,
        impact: 'Users may experience delays',
        action: async () => {
          // Increase batch size for better throughput
          this.configure({ batchSize: Math.min(this.config.batchSize + 2, 10) })
        }
      })
    }
    
    // Activity pattern optimization
    if (pattern.currentPattern === 'high-activity' && this.config.debounceMs > 1000) {
      this.addOptimizationSuggestion({
        type: 'performance',
        severity: 'info',
        title: 'High activity detected',
        description: 'Consider reducing debounce time for more responsive saves',
        impact: 'Improved user experience during active editing',
        action: async () => {
          this.configure({ debounceMs: 500 })
        }
      })
    }
    
    // Offline queue suggestions
    if (metrics.offlineOperations > 100) {
      this.addOptimizationSuggestion({
        type: 'network',
        severity: 'critical',
        title: 'Large offline queue detected',
        description: `${metrics.offlineOperations} operations pending sync`,
        impact: 'Data may be lost if not synced soon',
        action: async () => {
          if (this.isOnline) {
            await this.procesOfflineQueue()
          }
        }
      })
    }
  }

  private addOptimizationSuggestion(suggestion: Omit<OptimizationSuggestion, 'id' | 'createdAt'>): void {
    // Check if similar suggestion already exists
    const exists = this.optimizationSuggestions.some(existing => 
      existing.type === suggestion.type && existing.title === suggestion.title
    )
    
    if (!exists) {
      this.optimizationSuggestions.push({
        ...suggestion,
        id: this.generateOperationId(),
        createdAt: Date.now()
      })
    }
  }

  getOptimizationSuggestions(): OptimizationSuggestion[] {
    return [...this.optimizationSuggestions]
  }

  async applyOptimizationSuggestion(suggestionId: string): Promise<void> {
    const suggestion = this.optimizationSuggestions.find(s => s.id === suggestionId)
    if (suggestion?.action) {
      await suggestion.action()
      // Remove applied suggestion
      this.optimizationSuggestions = this.optimizationSuggestions.filter(s => s.id !== suggestionId)
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private estimateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length
    } catch {
      return 1024 // Default estimate
    }
  }

  // ============================================================================
  // CLEANUP AND DISPOSAL
  // ============================================================================

  disable(): void {
    this.config.enabled = false
    this.status.isEnabled = false
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    
    if (this.backgroundWorker) {
      this.backgroundWorker.terminate()
      this.backgroundWorker = null
    }
    
    // Clear queues
    this.saveQueue = []
    this.offlineQueue = []
    this.status.pendingSaves = 0
  }

  async flush(): Promise<void> {
    // Process all pending operations immediately
    while (this.saveQueue.length > 0 || this.processingBatch) {
      await this.processBatch()
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    // Process offline queue if online
    if (this.isOnline) {
      await this.procesOfflineQueue()
    }
  }
}

// Singleton instance
export const autoSaveEngine = new AutoSaveEngine()