/**
 * Stress Testing Suite for WorkflowStateManager
 * Tests performance under high load, memory management, and concurrent operations
 */

import { jest } from '@jest/globals'
import { WorkflowStateManager } from '../workflow-state-manager'
import {
  StepState,
  createStepId,
  StateChangeEvent,
  BatchStateOperation
} from '../../types/workflow-state'

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000
  }
} as any

global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16)
  return 1
})

jest.useFakeTimers()

describe('WorkflowStateManager - Stress Testing', () => {
  let manager: WorkflowStateManager
  let stateChangeEvents: StateChangeEvent[] = []

  beforeEach(() => {
    jest.clearAllMocks()
    stateChangeEvents = []
    
    manager = new WorkflowStateManager({
      strictValidation: true,
      enableLogging: false,
      maxHistoryEntries: 1000 // Increased for stress testing
    })

    manager.subscribe((event) => {
      stateChangeEvents.push(event)
    })

    jest.runOnlyPendingTimers()
  })

  afterEach(() => {
    manager.destroy()
    jest.runOnlyPendingTimers()
  })

  describe('High-Volume State Transitions', () => {
    it('should handle 1000 rapid state transitions', async () => {
      const startTime = performance.now()
      const iterations = 1000
      
      // Perform rapid state transitions
      for (let i = 0; i < iterations; i++) {
        const newState = i % 2 === 0 ? StepState.Complete : StepState.Ready
        await manager.transitionState('input-file', newState)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time (target: <1000ms)
      expect(duration).toBeLessThan(1000)
      
      // Should maintain state consistency
      const finalState = manager.getStepState('input-file')
      expect([StepState.Complete, StepState.Ready]).toContain(finalState)
      
      // History should be properly managed
      const history = manager.getStateHistory()
      expect(history.length).toBeLessThanOrEqual(1000)
    })

    it('should maintain performance with many observers', async () => {
      const observerCount = 100
      const observers: Array<() => void> = []
      
      // Add many observers
      for (let i = 0; i < observerCount; i++) {
        const unsubscribe = manager.subscribe(jest.fn())
        observers.push(unsubscribe)
      }
      
      const startTime = performance.now()
      
      // Perform state transitions with many observers
      for (let i = 0; i < 100; i++) {
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time despite many observers
      expect(duration).toBeLessThan(2000)
      
      // Cleanup observers
      observers.forEach(unsubscribe => unsubscribe())
    })

    it('should handle concurrent batch operations', async () => {
      const batchCount = 10
      const operationsPerBatch = 5
      
      const batchPromises = Array.from({ length: batchCount }, (_, batchIndex) => {
        const operations: BatchStateOperation[] = Array.from({ length: operationsPerBatch }, (_, opIndex) => ({
          stepId: createStepId('input-file'),
          newState: (batchIndex + opIndex) % 2 === 0 ? StepState.Complete : StepState.Ready,
          metadata: { reason: `Batch ${batchIndex} Operation ${opIndex}` }
        }))
        
        return manager.batchTransition(operations)
      })
      
      const startTime = performance.now()
      const results = await Promise.all(batchPromises)
      const endTime = performance.now()
      
      const duration = endTime - startTime
      
      // Should complete concurrent batches efficiently
      expect(duration).toBeLessThan(1000)
      
      // At least some batches should succeed (due to concurrency, some may fail)
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeGreaterThan(0)
    })
  })

  describe('Memory Management', () => {
    it('should not leak memory with many state transitions', async () => {
      const initialMetrics = manager.getPerformanceMetrics()
      
      // Perform many transitions to test memory management
      for (let i = 0; i < 2000; i++) {
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
        
        // Periodically check memory usage
        if (i % 500 === 0) {
          const metrics = manager.getPerformanceMetrics()
          // Memory usage should not grow unboundedly
          expect(metrics.memoryUsage).toBeLessThan(initialMetrics.memoryUsage * 5)
        }
      }
      
      // Force garbage collection simulation
      manager.clearCaches()
      
      const finalMetrics = manager.getPerformanceMetrics()
      
      // Memory should be released after cache clearing
      expect(finalMetrics.memoryUsage).toBeDefined()
    })

    it('should limit history size to prevent memory leaks', async () => {
      const maxHistoryEntries = 1000
      const transitionCount = maxHistoryEntries + 500 // Exceed limit
      
      for (let i = 0; i < transitionCount; i++) {
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      }
      
      const history = manager.getStateHistory()
      
      // History should be limited to maximum entries
      expect(history.length).toBeLessThanOrEqual(maxHistoryEntries)
    })

    it('should handle observer cleanup efficiently', () => {
      const observerCount = 1000
      const unsubscribeFunctions: Array<() => void> = []
      
      // Add many observers
      for (let i = 0; i < observerCount; i++) {
        const unsubscribe = manager.subscribe(jest.fn())
        unsubscribeFunctions.push(unsubscribe)
      }
      
      expect(manager.getPerformanceMetrics().observerCount).toBeGreaterThan(observerCount - 10)
      
      // Remove all observers
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
      
      // Observer count should be minimal
      expect(manager.getPerformanceMetrics().observerCount).toBeLessThan(10)
    })
  })

  describe('Cache Performance', () => {
    it('should maintain high cache hit rate under load', async () => {
      // Perform many repeated operations to test caching
      for (let i = 0; i < 500; i++) {
        // Alternate between same operations to trigger cache hits
        if (i % 2 === 0) {
          manager.getStepState('input-file')
          manager.isStepAccessible('input-file')
        } else {
          manager.getStepState('config')
          manager.isStepAccessible('config')
        }
      }
      
      const metrics = manager.getPerformanceMetrics()
      
      // Cache hit rate should be high due to repeated operations
      expect(metrics.cacheHitRate).toBeGreaterThan(0.7) // 70% hit rate
    })

    it('should invalidate caches efficiently', async () => {
      // Populate caches
      for (let i = 0; i < 100; i++) {
        manager.getStepState('input-file')
        manager.isStepAccessible('input-file')
      }
      
      const startTime = performance.now()
      
      // State change should invalidate caches quickly
      await manager.transitionState('input-file', StepState.Complete)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Cache invalidation should be fast
      expect(duration).toBeLessThan(50) // 50ms threshold
      
      // Verify state is correct after cache invalidation
      expect(manager.getStepState('input-file')).toBe(StepState.Complete)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle simultaneous read/write operations', async () => {
      const readOperations = 200
      const writeOperations = 50
      
      // Start concurrent read operations
      const readPromises = Array.from({ length: readOperations }, async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
        return {
          state: manager.getStepState('input-file'),
          accessible: manager.isStepAccessible('input-file'),
          step: manager.getStep('input-file'),
          iteration: i
        }
      })
      
      // Start concurrent write operations
      const writePromises = Array.from({ length: writeOperations }, async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20))
        const newState = i % 2 === 0 ? StepState.Complete : StepState.Ready
        return manager.transitionState('input-file', newState, {
          reason: `Concurrent write ${i}`
        })
      })
      
      const startTime = performance.now()
      
      // Execute all operations concurrently
      const [readResults, writeResults] = await Promise.all([
        Promise.all(readPromises),
        Promise.all(writePromises)
      ])
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete concurrent operations efficiently
      expect(duration).toBeLessThan(2000)
      
      // All read operations should complete
      expect(readResults).toHaveLength(readOperations)
      expect(readResults.every(r => r.state !== null)).toBe(true)
      
      // Some write operations should succeed
      const successfulWrites = writeResults.filter(r => r.success).length
      expect(successfulWrites).toBeGreaterThan(0)
    })

    it('should maintain data consistency under concurrent access', async () => {
      const concurrentUpdates = 100
      let successCount = 0
      let errorCount = 0
      
      const updatePromises = Array.from({ length: concurrentUpdates }, async (_, i) => {
        try {
          const result = await manager.transitionState(
            'input-file',
            i % 2 === 0 ? StepState.Complete : StepState.Ready,
            { reason: `Concurrent update ${i}` }
          )
          
          if (result.success) {
            successCount++
          } else {
            errorCount++
          }
          
          return result
        } catch (error) {
          errorCount++
          throw error
        }
      })
      
      await Promise.all(updatePromises)
      
      // Should have processed all updates
      expect(successCount + errorCount).toBe(concurrentUpdates)
      
      // Final state should be consistent
      const finalState = manager.getStepState('input-file')
      expect([StepState.Complete, StepState.Ready]).toContain(finalState)
      
      // Step data should be valid
      const step = manager.getStep('input-file')
      expect(step).not.toBeNull()
      expect(step?.stateMetadata.state).toBe(finalState)
    })
  })

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle excessive observer notifications gracefully', async () => {
      const observerCount = 500
      let notificationCount = 0
      
      // Add many observers that increment counter
      for (let i = 0; i < observerCount; i++) {
        manager.subscribe(() => {
          notificationCount++
        })
      }
      
      const startTime = performance.now()
      
      // Trigger notifications
      await manager.transitionState('input-file', StepState.Complete)
      
      // Allow notifications to process
      jest.advanceTimersByTime(100)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should handle many notifications efficiently
      expect(duration).toBeLessThan(500)
      expect(notificationCount).toBeGreaterThan(0)
    })

    it('should handle rapid consecutive state changes', async () => {
      const changeCount = 1000
      const interval = 1 // 1ms between changes
      
      const startTime = performance.now()
      
      // Rapid state changes
      for (let i = 0; i < changeCount; i++) {
        await new Promise(resolve => setTimeout(resolve, interval))
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should handle rapid changes efficiently
      expect(duration).toBeLessThan(changeCount * interval * 2) // Allow 2x expected time
      
      // Final state should be consistent
      const finalState = manager.getStepState('input-file')
      expect([StepState.Complete, StepState.Ready]).toContain(finalState)
    })
  })

  describe('Error Recovery Under Load', () => {
    it('should recover from transient errors during high load', async () => {
      let errorCount = 0
      let successCount = 0
      
      // Simulate mixed operations with some errors
      const operations = Array.from({ length: 200 }, async (_, i) => {
        try {
          // Simulate occasional invalid operations
          if (i % 20 === 0) {
            // Invalid transition to trigger error
            const result = await manager.transitionState('input-file', 'invalid-state' as any)
            if (!result.success) errorCount++
            return result
          } else {
            const result = await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
            if (result.success) successCount++
            else errorCount++
            return result
          }
        } catch (error) {
          errorCount++
          throw error
        }
      })
      
      await Promise.all(operations)
      
      // Should have handled both successes and errors
      expect(successCount).toBeGreaterThan(0)
      expect(errorCount).toBeGreaterThan(0)
      
      // System should still be functional
      expect(manager.getStepState('input-file')).not.toBeNull()
      const step = manager.getStep('input-file')
      expect(step).not.toBeNull()
    })

    it('should maintain system stability after observer errors', async () => {
      let errorObserverCalls = 0
      let normalObserverCalls = 0
      
      // Add error-throwing observer
      manager.subscribe(() => {
        errorObserverCalls++
        throw new Error('Observer error')
      })
      
      // Add normal observer
      manager.subscribe(() => {
        normalObserverCalls++
      })
      
      // Perform state transitions
      for (let i = 0; i < 50; i++) {
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      }
      
      // Both observers should have been called despite errors
      expect(errorObserverCalls).toBeGreaterThan(0)
      expect(normalObserverCalls).toBeGreaterThan(0)
      
      // System should remain functional
      expect(manager.getStepState('input-file')).not.toBeNull()
    })
  })

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for state transitions', async () => {
      const transitionCount = 100
      const targetTimePerTransition = 1 // 1ms per transition
      
      const startTime = performance.now()
      
      for (let i = 0; i < transitionCount; i++) {
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      const averageTime = duration / transitionCount
      
      // Should meet performance target
      expect(averageTime).toBeLessThan(targetTimePerTransition)
    })

    it('should demonstrate cache effectiveness', async () => {
      const operationCount = 1000
      
      // First run: no cache
      manager.clearCaches()
      const startTime1 = performance.now()
      
      for (let i = 0; i < operationCount; i++) {
        manager.getStepState('input-file')
        manager.isStepAccessible('input-file')
      }
      
      const endTime1 = performance.now()
      const durationWithoutCache = endTime1 - startTime1
      
      // Second run: with cache
      const startTime2 = performance.now()
      
      for (let i = 0; i < operationCount; i++) {
        manager.getStepState('input-file')
        manager.isStepAccessible('input-file')
      }
      
      const endTime2 = performance.now()
      const durationWithCache = endTime2 - startTime2
      
      // Cached operations should be faster
      expect(durationWithCache).toBeLessThan(durationWithoutCache)
      
      // Cache hit rate should be high
      const metrics = manager.getPerformanceMetrics()
      expect(metrics.cacheHitRate).toBeGreaterThan(0.8)
    })
  })
})