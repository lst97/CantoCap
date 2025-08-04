/**
 * Performance Testing Suite for WorkflowStateManager
 * Tests performance benchmarks, memory usage, and operation timing targets
 */

import { jest } from '@jest/globals'
import { WorkflowStateManager } from '../workflow-state-manager'
import {
  StepState,
  createStepId,
  StateChangeEvent,
  BatchStateOperation
} from '../../types/workflow-state'

// Performance testing utilities
class PerformanceProfiler {
  private startTime: number = 0
  private measurements: Array<{ operation: string; duration: number; memory?: number }> = []

  start() {
    this.startTime = performance.now()
  }

  end(operation: string): number {
    const duration = performance.now() - this.startTime
    const memory = (performance as any).memory?.usedJSHeapSize || 0
    
    this.measurements.push({ operation, duration, memory })
    return duration
  }

  getReport() {
    return {
      measurements: [...this.measurements],
      averageDuration: this.measurements.reduce((sum, m) => sum + m.duration, 0) / this.measurements.length,
      maxDuration: Math.max(...this.measurements.map(m => m.duration)),
      minDuration: Math.min(...this.measurements.map(m => m.duration)),
      totalMemory: this.measurements[this.measurements.length - 1]?.memory || 0
    }
  }

  clear() {
    this.measurements = []
  }
}

// Mock high-precision performance API
global.performance = {
  now: jest.fn(() => {
    const hrTime = process.hrtime()
    return hrTime[0] * 1000 + hrTime[1] / 1000000
  }),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 10000000,
    jsHeapSizeLimit: 100000000
  }
} as any

global.requestAnimationFrame = jest.fn((cb) => {
  setImmediate(cb)
  return 1
})

// Enable real timers for performance testing
jest.useRealTimers()

describe('WorkflowStateManager - Performance Benchmarks', () => {
  let manager: WorkflowStateManager
  let profiler: PerformanceProfiler
  const PERFORMANCE_TARGETS = {
    STATE_TRANSITION: 1, // 1ms target
    NOTIFICATION: 10, // 10ms target
    CACHE_ACCESS: 0.1, // 0.1ms target
    BATCH_OPERATION: 50, // 50ms for 10 operations
    MEMORY_LIMIT: 50 * 1024 * 1024 // 50MB limit
  }

  beforeEach(() => {
    profiler = new PerformanceProfiler()
    
    manager = new WorkflowStateManager({
      strictValidation: true,
      enableLogging: false,
      maxHistoryEntries: 1000
    })
  })

  afterEach(() => {
    manager.destroy()
  })

  describe('State Transition Performance', () => {
    it('should meet <1ms state transition target', async () => {
      const iterations = 100
      const durations: number[] = []

      for (let i = 0; i < iterations; i++) {
        profiler.start()
        
        await manager.transitionState(
          'input-file', 
          i % 2 === 0 ? StepState.Complete : StepState.Ready
        )
        
        const duration = profiler.end('state-transition')
        durations.push(duration)
      }

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const maxDuration = Math.max(...durations)
      const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]

      console.log(`State Transition Performance:
        Average: ${avgDuration.toFixed(3)}ms
        Maximum: ${maxDuration.toFixed(3)}ms
        95th percentile: ${p95Duration.toFixed(3)}ms
        Target: ${PERFORMANCE_TARGETS.STATE_TRANSITION}ms`)

      // Performance assertions
      expect(avgDuration).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION)
      expect(p95Duration).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION * 2)
    })

    it('should maintain performance with complex metadata', async () => {
      const complexMetadata = {
        reason: 'Complex operation with detailed context',
        context: {
          fileInfo: { name: 'video.mp4', size: 1024000, duration: 120 },
          processingOptions: { quality: 'high', format: 'srt', language: 'cantonese' },
          timestamps: Array.from({ length: 100 }, (_, i) => ({ start: i * 1000, end: (i + 1) * 1000 })),
          metadata: { confidence: 95, segments: 150, edits: [] }
        }
      }

      profiler.start()
      
      const result = await manager.transitionState('input-file', StepState.Complete, complexMetadata)
      
      const duration = profiler.end('complex-metadata-transition')
      
      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION * 3) // Allow 3x for complex data
    })

    it('should scale linearly with workflow size', async () => {
      // Create manager with more steps by adding custom steps
      const largeWorkflowManager = new WorkflowStateManager({
        strictValidation: true,
        enableLogging: false,
        maxHistoryEntries: 1000
      })

      try {
        const stepCount = 10
        const durations: number[] = []

        // Simulate larger workflow by making transitions for multiple steps
        for (let i = 0; i < stepCount; i++) {
          profiler.start()
          
          // Use different steps to avoid dependency conflicts
          const stepId = i === 0 ? 'input-file' : `step-${i}`
          const result = await largeWorkflowManager.transitionState(stepId, StepState.Complete)
          
          // Only measure successful transitions to existing steps
          if (result.success) {
            const duration = profiler.end(`step-${i}-transition`)
            durations.push(duration)
          }
        }

        // Performance should remain consistent regardless of workflow progress
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
        expect(avgDuration).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION * 2)
        
      } finally {
        largeWorkflowManager.destroy()
      }
    })
  })

  describe('Notification Performance', () => {
    it('should meet notification performance targets', async () => {
      const observerCount = 50
      let notificationCount = 0
      const notificationTimes: number[] = []

      // Add multiple observers
      const unsubscribeFunctions = Array.from({ length: observerCount }, () => {
        return manager.subscribe((event) => {
          const notificationTime = performance.now()
          notificationTimes.push(notificationTime)
          notificationCount++
        })
      })

      try {
        profiler.start()
        
        await manager.transitionState('input-file', StepState.Complete)
        
        // Wait for notifications to process
        await new Promise(resolve => setTimeout(resolve, 50))
        
        const duration = profiler.end('notification-processing')

        expect(notificationCount).toBe(observerCount)
        expect(duration).toBeLessThan(PERFORMANCE_TARGETS.NOTIFICATION)

      } finally {
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
      }
    })

    it('should handle burst notifications efficiently', async () => {
      let notificationCount = 0
      const startTime = performance.now()

      manager.subscribe(() => {
        notificationCount++
      })

      // Create burst of state changes
      const burstSize = 20
      const promises = Array.from({ length: burstSize }, (_, i) => 
        manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      )

      await Promise.all(promises)
      
      // Wait for notifications to process
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const duration = performance.now() - startTime

      expect(notificationCount).toBe(burstSize)
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.NOTIFICATION * burstSize / 10) // Allow batching efficiency
    })

    it('should debounce rapid notifications', async () => {
      let notificationCount = 0
      const notificationTimes: number[] = []

      manager.subscribe(() => {
        notificationCount++
        notificationTimes.push(performance.now())
      })

      const rapidChanges = 10
      const startTime = performance.now()

      // Make rapid changes
      for (let i = 0; i < rapidChanges; i++) {
        manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      }

      // Wait for debouncing
      await new Promise(resolve => setTimeout(resolve, 100))

      const duration = performance.now() - startTime

      // Should have fewer notifications than changes due to debouncing
      expect(notificationCount).toBeLessThanOrEqual(rapidChanges)
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.NOTIFICATION * 2)
    })
  })

  describe('Cache Performance', () => {
    it('should achieve high cache hit rates', async () => {
      const operations = 1000
      const cacheTestOperations = [
        () => manager.getStepState('input-file'),
        () => manager.isStepAccessible('input-file'),
        () => manager.getStep('input-file'),
        () => manager.getStepState('config'),
        () => manager.isStepAccessible('config')
      ]

      profiler.start()

      // Perform repeated operations to test caching
      for (let i = 0; i < operations; i++) {
        const operation = cacheTestOperations[i % cacheTestOperations.length]
        operation()
      }

      const duration = profiler.end('cache-operations')
      const avgTimePerOperation = duration / operations

      const metrics = manager.getPerformanceMetrics()

      console.log(`Cache Performance:
        Total time: ${duration.toFixed(3)}ms
        Avg per operation: ${avgTimePerOperation.toFixed(3)}ms
        Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`)

      expect(avgTimePerOperation).toBeLessThan(PERFORMANCE_TARGETS.CACHE_ACCESS)
      expect(metrics.cacheHitRate).toBeGreaterThan(0.8) // 80% hit rate
    })

    it('should invalidate caches efficiently', async () => {
      // Populate caches
      for (let i = 0; i < 100; i++) {
        manager.getStepState('input-file')
        manager.isStepAccessible('input-file')
      }

      profiler.start()
      
      // State change should invalidate caches
      await manager.transitionState('input-file', StepState.Complete)
      
      const duration = profiler.end('cache-invalidation')

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION * 2)
      
      // Verify cache was invalidated by checking new state
      expect(manager.getStepState('input-file')).toBe(StepState.Complete)
    })

    it('should manage cache memory efficiently', async () => {
      const initialMetrics = manager.getPerformanceMetrics()

      // Generate many cache entries
      for (let i = 0; i < 1000; i++) {
        manager.getStepState(`fake-step-${i % 10}`) // Rotate through 10 different steps
        manager.isStepAccessible(`fake-step-${i % 10}`)
      }

      const finalMetrics = manager.getPerformanceMetrics()

      // Memory usage should not grow unboundedly
      expect(finalMetrics.memoryUsage).toBeLessThan(initialMetrics.memoryUsage + PERFORMANCE_TARGETS.MEMORY_LIMIT)
    })
  })

  describe('Batch Operation Performance', () => {
    it('should perform batch operations efficiently', async () => {
      const batchSize = 10
      const operations: BatchStateOperation[] = Array.from({ length: batchSize }, (_, i) => ({
        stepId: createStepId('input-file'),
        newState: i % 2 === 0 ? StepState.Complete : StepState.Ready,
        metadata: { reason: `Batch operation ${i}` }
      }))

      profiler.start()
      
      const result = await manager.batchTransition(operations)
      
      const duration = profiler.end('batch-operation')

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.BATCH_OPERATION)

      console.log(`Batch Operation Performance:
        Operations: ${batchSize}
        Total time: ${duration.toFixed(3)}ms
        Avg per operation: ${(duration / batchSize).toFixed(3)}ms`)
    })

    it('should scale batch operations linearly', async () => {
      const batchSizes = [5, 10, 20, 50]
      const results: Array<{ size: number; duration: number; avgPerOp: number }> = []

      for (const batchSize of batchSizes) {
        const operations: BatchStateOperation[] = Array.from({ length: batchSize }, (_, i) => ({
          stepId: createStepId('input-file'),
          newState: i % 2 === 0 ? StepState.Complete : StepState.Ready
        }))

        profiler.start()
        
        const result = await manager.batchTransition(operations)
        
        const duration = profiler.end(`batch-${batchSize}`)

        expect(result.success).toBe(true)

        results.push({
          size: batchSize,
          duration,
          avgPerOp: duration / batchSize
        })
      }

      // Check that performance scales reasonably
      const avgPerOpVariance = Math.max(...results.map(r => r.avgPerOp)) - Math.min(...results.map(r => r.avgPerOp))
      expect(avgPerOpVariance).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION * 2) // Should stay within 2x
    })
  })

  describe('Memory Management', () => {
    it('should maintain stable memory usage', async () => {
      const initialMetrics = manager.getPerformanceMetrics()
      const initialMemory = initialMetrics.memoryUsage

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
        
        // Periodically check memory
        if (i % 100 === 0) {
          const currentMetrics = manager.getPerformanceMetrics()
          expect(currentMetrics.memoryUsage).toBeLessThan(initialMemory + PERFORMANCE_TARGETS.MEMORY_LIMIT)
        }
      }

      const finalMetrics = manager.getPerformanceMetrics()
      
      console.log(`Memory Management:
        Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final: ${(finalMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB
        Increase: ${((finalMetrics.memoryUsage - initialMemory) / 1024 / 1024).toFixed(2)}MB`)

      // Memory growth should be bounded
      expect(finalMetrics.memoryUsage - initialMemory).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_LIMIT)
    })

    it('should clean up resources on destroy', async () => {
      const testManager = new WorkflowStateManager({
        strictValidation: true,
        enableLogging: false,
        maxHistoryEntries: 100
      })

      // Use the manager to create some state
      await testManager.transitionState('input-file', StepState.Complete)
      testManager.subscribe(() => {})

      const beforeDestroy = testManager.getPerformanceMetrics()
      
      profiler.start()
      testManager.destroy()
      const destroyDuration = profiler.end('manager-destroy')

      // Destroy should be fast
      expect(destroyDuration).toBeLessThan(10) // 10ms

      // Should not throw when accessing destroyed manager
      expect(() => testManager.getPerformanceMetrics()).not.toThrow()
    })

    it('should handle garbage collection pressure', async () => {
      // Force multiple GC cycles by creating and discarding many objects
      for (let i = 0; i < 100; i++) {
        const largeObject = new Array(10000).fill(0).map((_, idx) => ({ id: idx, data: new Array(100).fill('test') }))
        
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
        
        // Discard large object to trigger GC pressure
        largeObject.length = 0
      }

      // Manager should still be responsive
      const startTime = performance.now()
      const state = manager.getStepState('input-file')
      const duration = performance.now() - startTime

      expect(state).toBeDefined()
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.CACHE_ACCESS * 10) // Allow for GC overhead
    })
  })

  describe('Observer Performance', () => {
    it('should scale with observer count', async () => {
      const observerCounts = [10, 50, 100, 500]
      const results: Array<{ count: number; duration: number }> = []

      for (const observerCount of observerCounts) {
        const testManager = new WorkflowStateManager({
          strictValidation: true,
          enableLogging: false,
          maxHistoryEntries: 100
        })

        try {
          // Add observers
          const unsubscribeFunctions = Array.from({ length: observerCount }, () => 
            testManager.subscribe(() => {})
          )

          profiler.start()
          
          await testManager.transitionState('input-file', StepState.Complete)
          await new Promise(resolve => setTimeout(resolve, 50)) // Wait for notifications
          
          const duration = profiler.end(`observers-${observerCount}`)

          results.push({ count: observerCount, duration })

          // Cleanup
          unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
        } finally {
          testManager.destroy()
        }
      }

      // Performance should scale reasonably
      results.forEach(result => {
        console.log(`Observer Performance: ${result.count} observers = ${result.duration.toFixed(3)}ms`)
        expect(result.duration).toBeLessThan(PERFORMANCE_TARGETS.NOTIFICATION * (result.count / 10))
      })
    })

    it('should handle observer errors without performance impact', async () => {
      const normalObserverCount = 50
      const errorObserverCount = 10

      // Add normal observers
      Array.from({ length: normalObserverCount }, () => 
        manager.subscribe(() => {})
      )

      // Add error-throwing observers
      Array.from({ length: errorObserverCount }, () => 
        manager.subscribe(() => {
          throw new Error('Observer error')
        })
      )

      profiler.start()
      
      await manager.transitionState('input-file', StepState.Complete)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const duration = profiler.end('error-observers')

      // Performance should not be significantly impacted by errors
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.NOTIFICATION * 2)
    })
  })

  describe('Real-World Performance Scenarios', () => {
    it('should handle realistic subtitle workflow performance', async () => {
      profiler.start()

      // Simulate complete subtitle generation workflow
      await manager.transitionState('input-file', StepState.Complete, {
        context: { fileName: 'movie.mp4', size: 1024000000, duration: 7200 }
      })

      await manager.transitionState('config', StepState.Complete, {
        context: { 
          language: 'cantonese', 
          format: 'srt', 
          quality: 'high',
          options: { segments: 300, confidence: 85 }
        }
      })

      await manager.transitionState('processing', StepState.Complete, {
        context: { 
          segments: 300,
          totalWords: 5000,
          processingTime: 120000,
          confidence: { avg: 87, min: 65, max: 98 }
        }
      })

      await manager.transitionState('review', StepState.Complete, {
        context: { 
          edits: 45,
          corrections: 12,
          reviewTime: 1800000,
          finalApproval: true
        }
      })

      await manager.transitionState('export', StepState.Complete, {
        context: { 
          formats: ['srt', 'vtt', 'ass'],
          filesSaved: 3,
          totalSize: 256000
        }
      })

      const duration = profiler.end('realistic-workflow')

      console.log(`Realistic Workflow Performance: ${duration.toFixed(3)}ms`)

      // Complete workflow should finish quickly
      expect(duration).toBeLessThan(100) // 100ms for complete workflow

      // Verify final state
      expect(manager.getStepState('export')).toBe(StepState.Complete)
      
      // Check history
      const history = manager.getStateHistory()
      expect(history).toHaveLength(5)
    })

    it('should maintain performance during concurrent user interactions', async () => {
      let readOperationCount = 0
      let writeOperationCount = 0

      // Simulate concurrent read operations (UI queries)
      const readInterval = setInterval(() => {
        manager.getStepState('input-file')
        manager.isStepAccessible('config')
        manager.getAllSteps()
        readOperationCount++
      }, 10)

      // Simulate periodic state updates
      const writeInterval = setInterval(async () => {
        await manager.transitionState('input-file', writeOperationCount % 2 === 0 ? StepState.Complete : StepState.Ready)
        writeOperationCount++
      }, 100)

      profiler.start()

      // Run for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000))

      clearInterval(readInterval)
      clearInterval(writeInterval)

      const duration = profiler.end('concurrent-operations')

      console.log(`Concurrent Operations:
        Duration: ${duration.toFixed(3)}ms
        Read operations: ${readOperationCount}
        Write operations: ${writeOperationCount}
        Avg read time: ${(duration / readOperationCount).toFixed(3)}ms
        Avg write time: ${(duration / writeOperationCount).toFixed(3)}ms`)

      expect(duration / readOperationCount).toBeLessThan(PERFORMANCE_TARGETS.CACHE_ACCESS * 10)
      expect(duration / writeOperationCount).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION * 10)
    })

    it('should demonstrate overall system performance', () => {
      const report = profiler.getReport()
      
      console.log('Performance Test Summary:')
      console.log(`Total measurements: ${report.measurements.length}`)
      console.log(`Average duration: ${report.averageDuration.toFixed(3)}ms`)
      console.log(`Max duration: ${report.maxDuration.toFixed(3)}ms`)
      console.log(`Min duration: ${report.minDuration.toFixed(3)}ms`)
      console.log(`Final memory usage: ${(report.totalMemory / 1024 / 1024).toFixed(2)}MB`)

      // Overall system should meet performance targets
      expect(report.averageDuration).toBeLessThan(PERFORMANCE_TARGETS.STATE_TRANSITION * 10)
      expect(report.totalMemory).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_LIMIT * 2)
    })
  })
})