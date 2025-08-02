/**
 * IndexedDB Performance Monitor
 * 
 * Specialized performance monitoring for IndexedDB operations with
 * real-time metrics, bottleneck detection, and optimization recommendations.
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface IndexedDBOperation {
  id: string
  operation: 'read' | 'write' | 'delete' | 'cleanup' | 'init'
  tableName: string
  recordCount?: number
  dataSize?: number
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: Error
  metadata?: Record<string, any>
}

export interface IndexedDBMetrics {
  // Operation counts
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  
  // Performance metrics
  averageOperationTime: number
  medianOperationTime: number
  slowestOperation: number
  fastestOperation: number
  
  // Operation type breakdown
  readOperations: number
  writeOperations: number
  deleteOperations: number
  cleanupOperations: number
  
  // Data metrics
  totalDataProcessed: number
  averageDataSize: number
  totalRecordsProcessed: number
  
  // Error analysis
  errorRate: number
  commonErrors: Array<{ error: string; count: number }>
  
  // Performance analysis
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  bottlenecks: string[]
  recommendations: string[]
  
  // Time-based metrics
  metricsStartTime: number
  lastOperation: number
  uptime: number
}

export interface PerformanceThresholds {
  maxOperationTime: number
  maxErrorRate: number
  minOperationsPerSecond: number
  maxDataSizePerOperation: number
  warningThresholds: {
    operationTime: number
    errorRate: number
    operationsPerSecond: number
  }
}

// ============================================================================
// INDEXEDDB PERFORMANCE MONITOR CLASS
// ============================================================================

export class IndexedDBPerformanceMonitor {
  private operations: IndexedDBOperation[] = []
  private maxOperationsHistory: number
  private thresholds: PerformanceThresholds
  private startTime: number
  private isEnabled: boolean

  constructor(options: {
    maxOperationsHistory?: number
    thresholds?: Partial<PerformanceThresholds>
    enabled?: boolean
  } = {}) {
    this.maxOperationsHistory = options.maxOperationsHistory || 1000
    this.startTime = Date.now()
    this.isEnabled = options.enabled !== false
    
    this.thresholds = {
      maxOperationTime: 1000, // 1 second
      maxErrorRate: 5, // 5%
      minOperationsPerSecond: 1,
      maxDataSizePerOperation: 10 * 1024 * 1024, // 10MB
      warningThresholds: {
        operationTime: 500, // 500ms
        errorRate: 2, // 2%
        operationsPerSecond: 2
      },
      ...options.thresholds
    }
  }

  // ============================================================================
  // OPERATION TRACKING
  // ============================================================================

  /**
   * Start tracking an IndexedDB operation
   */
  startOperation(
    operation: IndexedDBOperation['operation'],
    tableName: string,
    metadata?: Record<string, any>
  ): string {
    if (!this.isEnabled) return ''

    const operationId = `${operation}-${tableName}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    
    const operationRecord: IndexedDBOperation = {
      id: operationId,
      operation,
      tableName,
      startTime: performance.now(),
      success: false,
      metadata
    }
    
    this.operations.push(operationRecord)
    this.maintainHistoryLimit()
    
    return operationId
  }

  /**
   * End tracking an IndexedDB operation
   */
  endOperation(
    operationId: string,
    success: boolean,
    options: {
      recordCount?: number
      dataSize?: number
      error?: Error
    } = {}
  ): number {
    if (!this.isEnabled || !operationId) return 0

    const operation = this.operations.find(op => op.id === operationId)
    if (!operation) return 0

    const endTime = performance.now()
    const duration = endTime - operation.startTime

    operation.endTime = endTime
    operation.duration = duration
    operation.success = success
    operation.recordCount = options.recordCount
    operation.dataSize = options.dataSize
    operation.error = options.error

    // Log warning for slow operations
    if (duration > this.thresholds.warningThresholds.operationTime) {
      console.warn(`⚠️ Slow IndexedDB operation detected: ${operation.operation} on ${operation.tableName} took ${duration.toFixed(2)}ms`)
    }

    return duration
  }

  /**
   * Record a failed operation
   */
  recordFailure(
    operation: IndexedDBOperation['operation'],
    tableName: string,
    error: Error,
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return

    const operationId = this.startOperation(operation, tableName, metadata)
    this.endOperation(operationId, false, { error })
  }

  // ============================================================================
  // METRICS CALCULATION
  // ============================================================================

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): IndexedDBMetrics {
    const completedOperations = this.operations.filter(op => op.duration !== undefined)
    const successfulOps = completedOperations.filter(op => op.success)
    const failedOps = completedOperations.filter(op => !op.success)

    // Calculate durations
    const durations = completedOperations.map(op => op.duration!).filter(d => d > 0)
    const averageOperationTime = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0

    const sortedDurations = [...durations].sort((a, b) => a - b)
    const medianOperationTime = sortedDurations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : 0

    // Operation type counts
    const readOps = completedOperations.filter(op => op.operation === 'read').length
    const writeOps = completedOperations.filter(op => op.operation === 'write').length
    const deleteOps = completedOperations.filter(op => op.operation === 'delete').length
    const cleanupOps = completedOperations.filter(op => op.operation === 'cleanup').length

    // Data metrics
    const totalDataProcessed = completedOperations
      .filter(op => op.dataSize)
      .reduce((sum, op) => sum + (op.dataSize || 0), 0)
    
    const totalRecordsProcessed = completedOperations
      .filter(op => op.recordCount)
      .reduce((sum, op) => sum + (op.recordCount || 0), 0)

    const averageDataSize = totalDataProcessed > 0 && completedOperations.length > 0
      ? totalDataProcessed / completedOperations.filter(op => op.dataSize).length
      : 0

    // Error analysis
    const errorRate = completedOperations.length > 0
      ? (failedOps.length / completedOperations.length) * 100
      : 0

    const errorCounts = new Map<string, number>()
    failedOps.forEach(op => {
      if (op.error) {
        const errorKey = op.error.name || op.error.message || 'Unknown Error'
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1)
      }
    })

    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Performance analysis
    const performanceGrade = this.calculatePerformanceGrade(
      averageOperationTime,
      errorRate,
      completedOperations.length
    )

    const bottlenecks = this.identifyBottlenecks(completedOperations)
    const recommendations = this.generateRecommendations(
      averageOperationTime,
      errorRate,
      completedOperations,
      bottlenecks
    )

    const now = Date.now()
    const lastOperation = completedOperations.length > 0
      ? Math.max(...completedOperations.map(op => op.startTime))
      : this.startTime

    return {
      totalOperations: completedOperations.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      
      averageOperationTime,
      medianOperationTime,
      slowestOperation: durations.length > 0 ? Math.max(...durations) : 0,
      fastestOperation: durations.length > 0 ? Math.min(...durations) : 0,
      
      readOperations: readOps,
      writeOperations: writeOps,
      deleteOperations: deleteOps,
      cleanupOperations: cleanupOps,
      
      totalDataProcessed,
      averageDataSize,
      totalRecordsProcessed,
      
      errorRate,
      commonErrors,
      
      performanceGrade,
      bottlenecks,
      recommendations,
      
      metricsStartTime: this.startTime,
      lastOperation,
      uptime: now - this.startTime
    }
  }

  /**
   * Get real-time performance status
   */
  getPerformanceStatus(): {
    status: 'excellent' | 'good' | 'warning' | 'critical'
    message: string
    metrics: {
      averageOperationTime: number
      errorRate: number
      operationsPerSecond: number
    }
  } {
    const metrics = this.getMetrics()
    const recentOps = this.operations.filter(
      op => op.startTime > Date.now() - 60000 // Last minute
    )
    
    const operationsPerSecond = recentOps.length / 60
    
    let status: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent'
    let message = 'IndexedDB performance is optimal'

    if (metrics.errorRate > this.thresholds.maxErrorRate) {
      status = 'critical'
      message = `High error rate detected: ${metrics.errorRate.toFixed(1)}%`
    } else if (metrics.averageOperationTime > this.thresholds.maxOperationTime) {
      status = 'critical'
      message = `Operations are too slow: ${metrics.averageOperationTime.toFixed(1)}ms average`
    } else if (metrics.errorRate > this.thresholds.warningThresholds.errorRate) {
      status = 'warning'
      message = `Elevated error rate: ${metrics.errorRate.toFixed(1)}%`
    } else if (metrics.averageOperationTime > this.thresholds.warningThresholds.operationTime) {
      status = 'warning'
      message = `Operations are slower than optimal: ${metrics.averageOperationTime.toFixed(1)}ms average`
    } else if (operationsPerSecond < this.thresholds.warningThresholds.operationsPerSecond && recentOps.length > 0) {
      status = 'good'
      message = `Performance is good but could be optimized`
    }

    return {
      status,
      message,
      metrics: {
        averageOperationTime: metrics.averageOperationTime,
        errorRate: metrics.errorRate,
        operationsPerSecond
      }
    }
  }

  // ============================================================================
  // ANALYSIS FUNCTIONS
  // ============================================================================

  private calculatePerformanceGrade(
    avgTime: number,
    errorRate: number,
    operationCount: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 100

    // Deduct points for slow operations
    if (avgTime > 100) score -= Math.min(50, (avgTime - 100) / 10)
    
    // Deduct points for errors
    score -= errorRate * 10
    
    // Deduct points for insufficient data
    if (operationCount < 10) score -= 20

    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  private identifyBottlenecks(operations: IndexedDBOperation[]): string[] {
    const bottlenecks: string[] = []

    // Check for slow operation types
    const operationTypes = ['read', 'write', 'delete', 'cleanup'] as const
    operationTypes.forEach(type => {
      const typeOps = operations.filter(op => op.operation === type && op.duration)
      if (typeOps.length === 0) return

      const avgTime = typeOps.reduce((sum, op) => sum + (op.duration || 0), 0) / typeOps.length
      if (avgTime > this.thresholds.warningThresholds.operationTime) {
        bottlenecks.push(`Slow ${type} operations (${avgTime.toFixed(1)}ms average)`)
      }
    })

    // Check for problematic tables
    const tablePerformance = new Map<string, number[]>()
    operations.forEach(op => {
      if (op.duration && op.tableName) {
        if (!tablePerformance.has(op.tableName)) {
          tablePerformance.set(op.tableName, [])
        }
        tablePerformance.get(op.tableName)!.push(op.duration)
      }
    })

    tablePerformance.forEach((durations, tableName) => {
      const avgTime = durations.reduce((sum, d) => sum + d, 0) / durations.length
      if (avgTime > this.thresholds.warningThresholds.operationTime) {
        bottlenecks.push(`Slow table operations: ${tableName} (${avgTime.toFixed(1)}ms average)`)
      }
    })

    // Check for large data operations
    const largeDataOps = operations.filter(op => 
      op.dataSize && op.dataSize > this.thresholds.maxDataSizePerOperation / 2
    )
    if (largeDataOps.length > 0) {
      bottlenecks.push(`Large data operations detected (${largeDataOps.length} operations)`)
    }

    return bottlenecks
  }

  private generateRecommendations(
    avgTime: number,
    errorRate: number,
    operations: IndexedDBOperation[],
    bottlenecks: string[]
  ): string[] {
    const recommendations: string[] = []

    if (avgTime > this.thresholds.warningThresholds.operationTime) {
      recommendations.push('Consider batching operations to reduce overhead')
      recommendations.push('Implement operation caching for frequently accessed data')
      recommendations.push('Use transactions efficiently to group related operations')
    }

    if (errorRate > this.thresholds.warningThresholds.errorRate) {
      recommendations.push('Implement proper error handling and retry logic')
      recommendations.push('Validate data before database operations')
      recommendations.push('Check for quota exceeded errors and implement cleanup')
    }

    if (bottlenecks.some(b => b.includes('write operations'))) {
      recommendations.push('Consider implementing write-behind caching')
      recommendations.push('Use bulk operations for multiple writes')
    }

    if (bottlenecks.some(b => b.includes('Large data'))) {
      recommendations.push('Implement data compression for large payloads')
      recommendations.push('Consider pagination for large dataset operations')
    }

    const failedOps = operations.filter(op => !op.success)
    if (failedOps.length > 0) {
      const quotaErrors = failedOps.filter(op => 
        op.error?.message?.includes('quota') || op.error?.name === 'QuotaExceededError'
      )
      if (quotaErrors.length > 0) {
        recommendations.push('Implement automatic cleanup when storage quota is exceeded')
      }
    }

    return recommendations
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private maintainHistoryLimit(): void {
    if (this.operations.length > this.maxOperationsHistory) {
      // Remove oldest operations, keeping the most recent ones
      const removeCount = this.operations.length - this.maxOperationsHistory
      this.operations.splice(0, removeCount)
    }
  }

  /**
   * Reset all metrics and operation history
   */
  reset(): void {
    this.operations = []
    this.startTime = Date.now()
  }

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): {
    metrics: IndexedDBMetrics
    operations: IndexedDBOperation[]
    thresholds: PerformanceThresholds
  } {
    return {
      metrics: this.getMetrics(),
      operations: [...this.operations],
      thresholds: { ...this.thresholds }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let performanceMonitorInstance: IndexedDBPerformanceMonitor | null = null

export function getIndexedDBPerformanceMonitor(options?: Parameters<typeof IndexedDBPerformanceMonitor.prototype.constructor>[0]): IndexedDBPerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new IndexedDBPerformanceMonitor(options)
  }
  return performanceMonitorInstance
}

export function resetIndexedDBPerformanceMonitor(): void {
  performanceMonitorInstance = null
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick performance check for IndexedDB operations
 */
export function quickPerformanceCheck(): {
  status: 'excellent' | 'good' | 'warning' | 'critical'
  message: string
} {
  const monitor = getIndexedDBPerformanceMonitor({ enabled: true })
  return monitor.getPerformanceStatus()
}

/**
 * Decorator for automatic operation monitoring
 */
export function monitorIndexedDBOperation(
  operation: IndexedDBOperation['operation'],
  tableName: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const monitor = getIndexedDBPerformanceMonitor({ enabled: true })
      const operationId = monitor.startOperation(operation, tableName, { method: propertyKey })

      try {
        const result = await originalMethod.apply(this, args)
        monitor.endOperation(operationId, true, {
          recordCount: Array.isArray(result) ? result.length : 1
        })
        return result
      } catch (error) {
        monitor.endOperation(operationId, false, { error: error as Error })
        throw error
      }
    }

    return descriptor
  }
}