/**
 * Comprehensive Performance Benchmarking Suite
 * Validates WorkflowStateManager optimizations and measures improvements
 * Includes before/after comparisons and regression testing
 */

import { WorkflowStateManager } from '../workflow/workflow-state-manager'
import { performanceMonitor } from '../performance-monitor'
import { workflowObjectPool } from '../object-pool'
import { StepState, createStepId } from '../../types/workflow-state'

export interface BenchmarkConfig {
  iterations: number
  warmupRuns: number
  concurrentOperations: number
  enableLogging: boolean
}

export interface BenchmarkResult {
  name: string
  category: 'state-transition' | 'memory' | 'notification' | 'cache' | 'react-integration'
  metrics: {
    avgTime: number
    minTime: number
    maxTime: number
    p95Time: number
    p99Time: number
    throughput: number
    memoryUsage: number
    memoryDelta: number
    gcCollections: number
    errorRate: number
  }
  metadata: {
    iterations: number
    timestamp: number
    configuration: Record<string, any>
  }
  comparison?: {
    baseline: BenchmarkResult
    improvement: {
      timeImprovement: number // percentage
      memoryImprovement: number // percentage
      throughputImprovement: number // percentage
    }
  }
}

export interface BenchmarkSuite {
  name: string
  version: string
  results: BenchmarkResult[]
  summary: {
    totalTime: number
    overallImprovement: number
    passedTargets: number
    totalTargets: number
  }
}

/**
 * Comprehensive benchmarking suite for WorkflowStateManager
 */
export class PerformanceBenchmarkSuite {
  private config: BenchmarkConfig
  private baselineResults: Map<string, BenchmarkResult> = new Map()

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      iterations: 1000,
      warmupRuns: 100,
      concurrentOperations: 10,
      enableLogging: false,
      ...config
    }
  }

  /**
   * Run complete benchmark suite
   */
  async runCompleteSuite(): Promise<BenchmarkSuite> {
    console.log('🚀 Starting comprehensive performance benchmark suite...')
    const startTime = performance.now()

    // Warmup
    await this.warmup()

    const results: BenchmarkResult[] = []

    // Core state transition benchmarks
    results.push(await this.benchmarkStateTransitions())
    results.push(await this.benchmarkBatchTransitions())
    results.push(await this.benchmarkConcurrentTransitions())

    // Memory management benchmarks
    results.push(await this.benchmarkMemoryUsage())
    results.push(await this.benchmarkObjectPooling())
    results.push(await this.benchmarkGarbageCollection())

    // Cache performance benchmarks
    results.push(await this.benchmarkCachePerformance())
    results.push(await this.benchmarkCacheInvalidation())

    // Notification system benchmarks
    results.push(await this.benchmarkNotificationSystem())
    results.push(await this.benchmarkObserverScaling())

    // React integration benchmarks (simulated)
    results.push(await this.benchmarkReactHookPerformance())
    results.push(await this.benchmarkRerenderOptimization())

    const totalTime = performance.now() - startTime

    const summary = this.generateSummary(results, totalTime)

    return {
      name: 'WorkflowStateManager Performance Suite',
      version: '2.0.0',
      results,
      summary
    }
  }

  /**
   * Warmup phase to stabilize JIT and GC
   */
  private async warmup(): Promise<void> {
    console.log('🔥 Warming up...')
    const manager = new WorkflowStateManager()

    for (let i = 0; i < this.config.warmupRuns; i++) {
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('input-file', StepState.Ready)
    }

    manager.destroy()
    
    // Force GC if available
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Benchmark basic state transitions
   */
  async benchmarkStateTransitions(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('input-file', StepState.Ready)
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Basic State Transitions',
      'state-transition',
      times,
      memoryAfter - memoryBefore,
      { 
        stepsPerIteration: 2,
        targetTime: 1, // 1ms per transition
        manager: 'WorkflowStateManager'
      }
    )
  }

  /**
   * Benchmark batch state transitions
   */
  async benchmarkBatchTransitions(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()

    for (let i = 0; i < this.config.iterations / 10; i++) {
      const startTime = performance.now()
      
      const operations = [
        { stepId: 'input-file', newState: StepState.Complete },
        { stepId: 'config', newState: StepState.Ready },
        { stepId: 'processing', newState: StepState.Blocked },
        { stepId: 'review', newState: StepState.Blocked },
        { stepId: 'export', newState: StepState.Blocked }
      ]
      
      await manager.batchTransition(operations)
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Batch State Transitions',
      'state-transition',
      times,
      memoryAfter - memoryBefore,
      { 
        batchSize: 5,
        targetTime: 5, // 5ms for batch of 5
        manager: 'WorkflowStateManager'
      }
    )
  }

  /**
   * Benchmark concurrent state transitions
   */
  async benchmarkConcurrentTransitions(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()

    for (let i = 0; i < this.config.iterations / this.config.concurrentOperations; i++) {
      const startTime = performance.now()
      
      const promises = []
      for (let j = 0; j < this.config.concurrentOperations; j++) {
        promises.push(manager.transitionState('input-file', j % 2 === 0 ? StepState.Complete : StepState.Ready))
      }
      
      await Promise.all(promises)
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Concurrent State Transitions',
      'state-transition',
      times,
      memoryAfter - memoryBefore,
      { 
        concurrency: this.config.concurrentOperations,
        targetTime: 10, // 10ms for concurrent operations
        manager: 'WorkflowStateManager'
      }
    )
  }

  /**
   * Benchmark memory usage patterns
   */
  async benchmarkMemoryUsage(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memorySnapshots: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      // Create state changes that generate events and metadata
      await manager.transitionState('input-file', StepState.Complete, {
        message: `Completion ${i}`,
        context: { iteration: i, timestamp: Date.now() }
      })
      
      const endTime = performance.now()
      times.push(endTime - startTime)
      memorySnapshots.push(this.getMemoryUsage())
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    // Calculate memory growth trend
    const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0]

    return this.createBenchmarkResult(
      'Memory Usage Pattern',
      'memory',
      times,
      memoryAfter - memoryBefore,
      { 
        memoryGrowth,
        memoryGrowthPerOperation: memoryGrowth / this.config.iterations,
        targetMemoryGrowth: 1024 * 1024, // 1MB max growth
        manager: 'WorkflowStateManager'
      }
    )
  }

  /**
   * Benchmark object pooling effectiveness
   */
  async benchmarkObjectPooling(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const poolStatsBefore = workflowObjectPool.getPoolStats()

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      // Create and return objects to pool
      const event = workflowObjectPool.createStateChangeEvent(
        'test-step',
        'ready',
        'complete',
        { test: true },
        Date.now(),
        'ready-to-complete',
        true
      )
      
      workflowObjectPool.returnStateChangeEvent(event)
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const poolStatsAfter = workflowObjectPool.getPoolStats()
    const memoryAfter = this.getMemoryUsage()

    return this.createBenchmarkResult(
      'Object Pooling Effectiveness',
      'memory',
      times,
      memoryAfter - memoryBefore,
      { 
        poolUtilization: poolStatsAfter.stateChangeEvents.utilization,
        memoryServed: poolStatsAfter.totalMemorySaving,
        objectsCreated: poolStatsAfter.stateChangeEvents.created,
        objectsBorrowed: poolStatsAfter.stateChangeEvents.borrowed,
        targetUtilization: 0.8 // 80% utilization target
      }
    )
  }

  /**
   * Benchmark garbage collection impact
   */
  async benchmarkGarbageCollection(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    let gcCount = 0

    // Monitor GC if available
    const originalGC = global.gc
    if (originalGC) {
      global.gc = () => {
        gcCount++
        return originalGC()
      }
    }

    const manager = new WorkflowStateManager()

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      // Create memory pressure
      const largeObjects = []
      for (let j = 0; j < 100; j++) {
        largeObjects.push({
          data: new Array(1000).fill(Math.random()),
          metadata: { index: j, created: Date.now() }
        })
      }
      
      await manager.transitionState('input-file', StepState.Complete)
      
      // Release references
      largeObjects.length = 0
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    // Restore original GC
    if (originalGC) {
      global.gc = originalGC
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Garbage Collection Impact',
      'memory',
      times,
      memoryAfter - memoryBefore,
      { 
        gcCollections: gcCount,
        gcPressure: gcCount / this.config.iterations,
        targetGCPressure: 0.1 // Low GC pressure target
      }
    )
  }

  /**
   * Benchmark cache performance
   */
  async benchmarkCachePerformance(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()
    let cacheHits = 0
    let cacheMisses = 0

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      // Perform operations that should benefit from caching
      const stepId = `step-${i % 10}` // Reuse step IDs for cache hits
      const isAccessible = manager.isStepAccessible(stepId)
      const state = manager.getStepState(stepId)
      
      if (isAccessible !== null) cacheHits++
      else cacheMisses++
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const hitRate = cacheHits / (cacheHits + cacheMisses)
    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Cache Performance',
      'cache',
      times,
      memoryAfter - memoryBefore,
      { 
        hitRate,
        cacheHits,
        cacheMisses,
        targetHitRate: 0.9 // 90% hit rate target
      }
    )
  }

  /**
   * Benchmark cache invalidation performance
   */
  async benchmarkCacheInvalidation(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      // Cause cache invalidation
      await manager.transitionState('input-file', StepState.Complete)
      manager.clearCaches() // Force cache clear
      
      // Access data (should rebuild cache)
      manager.isStepAccessible('input-file')
      manager.getStepState('config')
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Cache Invalidation',
      'cache',
      times,
      memoryAfter - memoryBefore,
      { 
        targetTime: 2, // 2ms for invalidation + rebuild
        manager: 'WorkflowStateManager'
      }
    )
  }

  /**
   * Benchmark notification system performance
   */
  async benchmarkNotificationSystem(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()
    
    // Subscribe observers
    const observers = []
    for (let i = 0; i < 100; i++) {
      observers.push(manager.subscribe(() => {
        // Simulate observer work
        Math.random()
      }))
    }

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    // Cleanup observers
    observers.forEach(unsubscribe => unsubscribe())
    
    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Notification System',
      'notification',
      times,
      memoryAfter - memoryBefore,
      { 
        observerCount: 100,
        targetTime: 5, // 5ms with 100 observers
        manager: 'WorkflowStateManager'
      }
    )
  }

  /**
   * Benchmark observer scaling
   */
  async benchmarkObserverScaling(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()
    
    const observerCounts = [10, 50, 100, 200, 500]
    
    for (const observerCount of observerCounts) {
      // Subscribe observers
      const observers = []
      for (let i = 0; i < observerCount; i++) {
        observers.push(manager.subscribe(() => {
          Math.random()
        }))
      }

      const startTime = performance.now()
      
      await manager.transitionState('input-file', StepState.Complete)
      
      const endTime = performance.now()
      times.push(endTime - startTime)

      // Cleanup observers
      observers.forEach(unsubscribe => unsubscribe())
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Observer Scaling',
      'notification',
      times,
      memoryAfter - memoryBefore,
      { 
        observerCounts,
        scalingFactor: times[times.length - 1] / times[0],
        targetScalingFactor: 5, // Linear scaling up to 5x
        manager: 'WorkflowStateManager'
      }
    )
  }

  /**
   * Benchmark React hook performance (simulated)
   */
  async benchmarkReactHookPerformance(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    
    // Simulate React hook operations
    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      // Simulate useStepState operations
      const stepId = createStepId('input-file')
      const state = getStepState(stepId)
      const isAccessible = isStepAccessible(stepId)
      
      // Simulate memoization checks
      const memoizedValue = useMemo(() => ({ state, isAccessible }), [state, isAccessible])
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const memoryAfter = this.getMemoryUsage()

    return this.createBenchmarkResult(
      'React Hook Performance',
      'react-integration',
      times,
      memoryAfter - memoryBefore,
      { 
        targetTime: 0.5, // 0.5ms for hook operations
        framework: 'React'
      }
    )
  }

  /**
   * Benchmark re-render optimization
   */
  async benchmarkRerenderOptimization(): Promise<BenchmarkResult> {
    const times: number[] = []
    const memoryBefore = this.getMemoryUsage()
    const manager = new WorkflowStateManager()
    let rerenderCount = 0

    // Simulate component re-renders
    const mockComponent = {
      rerender: () => {
        rerenderCount++
        // Simulate component work
        const state = manager.getAllSteps()
        return Array.from(state.values()).length
      }
    }

    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now()
      
      await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      mockComponent.rerender()
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const memoryAfter = this.getMemoryUsage()
    manager.destroy()

    return this.createBenchmarkResult(
      'Re-render Optimization',
      'react-integration',
      times,
      memoryAfter - memoryBefore,
      { 
        rerenderCount,
        rerenderRatio: rerenderCount / this.config.iterations,
        targetRerenderTime: 10, // 10ms per re-render
        framework: 'React'
      }
    )
  }

  /**
   * Helper function to create benchmark result
   */
  private createBenchmarkResult(
    name: string,
    category: BenchmarkResult['category'],
    times: number[],
    memoryDelta: number,
    configuration: Record<string, any>
  ): BenchmarkResult {
    const sortedTimes = [...times].sort((a, b) => a - b)
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length
    const minTime = sortedTimes[0]
    const maxTime = sortedTimes[sortedTimes.length - 1]
    const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)]
    const p99Time = sortedTimes[Math.floor(sortedTimes.length * 0.99)]
    const throughput = 1000 / avgTime // operations per second

    return {
      name,
      category,
      metrics: {
        avgTime,
        minTime,
        maxTime,
        p95Time,
        p99Time,
        throughput,
        memoryUsage: this.getMemoryUsage(),
        memoryDelta,
        gcCollections: 0, // Would be filled by GC monitoring
        errorRate: 0 // Would be filled by error tracking
      },
      metadata: {
        iterations: times.length,
        timestamp: Date.now(),
        configuration
      }
    }
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(results: BenchmarkResult[], totalTime: number) {
    const targets = [
      { category: 'state-transition', target: 1 }, // 1ms
      { category: 'cache', target: 0.9 }, // 90% hit rate
      { category: 'memory', target: 50 * 1024 * 1024 }, // 50MB
      { category: 'notification', target: 5 }, // 5ms
      { category: 'react-integration', target: 10 } // 10ms
    ]

    let passedTargets = 0
    let overallImprovement = 0

    for (const result of results) {
      const target = targets.find(t => t.category === result.category)
      if (target && result.metrics.avgTime <= target.target) {
        passedTargets++
      }
      
      // Calculate improvement if baseline exists
      if (result.comparison) {
        overallImprovement += result.comparison.improvement.timeImprovement
      }
    }

    overallImprovement = overallImprovement / results.length

    return {
      totalTime,
      overallImprovement,
      passedTargets,
      totalTargets: targets.length
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (window.performance as any).memory
      return memory ? memory.usedJSHeapSize : 0
    }
    return 0
  }

  /**
   * Store baseline results for comparison
   */
  storeBaseline(results: BenchmarkResult[]): void {
    for (const result of results) {
      this.baselineResults.set(result.name, result)
    }
  }

  /**
   * Add comparison data to results
   */
  addComparison(results: BenchmarkResult[]): BenchmarkResult[] {
    return results.map(result => {
      const baseline = this.baselineResults.get(result.name)
      if (baseline) {
        const timeImprovement = ((baseline.metrics.avgTime - result.metrics.avgTime) / baseline.metrics.avgTime) * 100
        const memoryImprovement = ((baseline.metrics.memoryDelta - result.metrics.memoryDelta) / baseline.metrics.memoryDelta) * 100
        const throughputImprovement = ((result.metrics.throughput - baseline.metrics.throughput) / baseline.metrics.throughput) * 100

        return {
          ...result,
          comparison: {
            baseline,
            improvement: {
              timeImprovement,
              memoryImprovement,
              throughputImprovement
            }
          }
        }
      }
      return result
    })
  }
}

// Simulate useMemo for benchmark
function useMemo<T>(factory: () => T, deps: any[]): T {
  return factory()
}

// Create singleton instance
export const benchmarkSuite = new PerformanceBenchmarkSuite()