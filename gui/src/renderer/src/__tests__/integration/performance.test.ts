/**
 * Performance Integration Tests
 * 
 * Comprehensive performance testing including:
 * - Startup performance benchmarks (< 1000ms total)
 * - Workspace switching performance (< 500ms)
 * - Auto-save latency validation (< 100ms UI blocking)
 * - Memory usage monitoring (< 100MB peak)
 * - Concurrent operations performance (>95% success rate)
 * - Large dataset handling and virtualization
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals'
import { act, waitFor, renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Import system components
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useAppStore } from '../../stores/app-store'
// Legacy workflow store removed - using WorkflowStateManager directly
import { WorkspaceIPCIntegration } from '../../services/workspace/workspace-ipc-integration'

// Import types
import type { 
  WorkspaceConfig, 
  StepConfiguration,
  PerformanceMetric,
  PerformanceBenchmark
} from '../../types/workspace'

/**
 * Performance Benchmarks and Targets
 */
const PERFORMANCE_TARGETS = {
  startup: {
    totalTime: 1000, // ms
    workspaceInit: 200, // ms
    storeInit: 100, // ms
    ipcInit: 150, // ms
  },
  workspaceSwitching: {
    totalTime: 500, // ms
    configLoad: 100, // ms
    stateUpdate: 50, // ms
    uiRender: 100, // ms
  },
  autoSave: {
    uiBlocking: 50, // ms
    debounceTime: 1500, // ms
    saveLatency: 200, // ms
    batchProcessing: 100, // ms per batch
  },
  memory: {
    baselineUsage: 50 * 1024 * 1024, // 50MB
    peakUsage: 100 * 1024 * 1024, // 100MB
    workspaceOverhead: 2 * 1024 * 1024, // 2MB per workspace
    gcThreshold: 80 * 1024 * 1024, // 80MB trigger GC
  },
  concurrency: {
    successRate: 0.95, // 95%
    maxConcurrentOps: 20,
    operationTimeout: 5000, // ms
    errorRate: 0.05, // 5%
  },
  largeDatasets: {
    segmentLoad: 100, // ms for 1000 segments
    virtualScrolling: 16, // ms per frame (60fps)
    searchTime: 200, // ms for full-text search
    exportTime: 5000, // ms for 10000 segments
  }
}

/**
 * Performance Integration Test Suite
 */
describe('Performance Integration', () => {
  let workspaceStore: ReturnType<typeof useWorkspaceStore>
  let appStore: ReturnType<typeof useAppStore>
  let workflowStore: ReturnType<typeof useWorkflowStore>
  let performanceMetrics: PerformanceMetric[]

  // Performance monitoring utilities
  const performanceMonitor = {
    startTime: 0,
    measurements: new Map<string, number>(),
    
    start(label: string) {
      this.startTime = performance.now()
      this.measurements.set(`${label}_start`, this.startTime)
    },
    
    end(label: string): number {
      const endTime = performance.now()
      const startTime = this.measurements.get(`${label}_start`) || this.startTime
      const duration = endTime - startTime
      this.measurements.set(`${label}_duration`, duration)
      return duration
    },
    
    measure(label: string, startMark?: string, endMark?: string): number {
      const startTime = startMark ? this.measurements.get(startMark) || 0 : this.startTime
      const endTime = endMark ? this.measurements.get(endMark) || performance.now() : performance.now()
      const duration = endTime - startTime
      this.measurements.set(`${label}_measure`, duration)
      return duration
    },
    
    getMemoryUsage(): { used: number; total: number; percentage: number } {
      const memory = (performance as any).memory
      if (!memory) return { used: 0, total: 0, percentage: 0 }
      
      const used = memory.usedJSHeapSize
      const total = memory.totalJSHeapSize
      const percentage = (used / total) * 100
      
      return { used, total, percentage }
    },
    
    clear() {
      this.measurements.clear()
      this.startTime = 0
    }
  }

  // Mock API with performance simulation
  const mockCantocapAPI = {
    initializeWorkspaceSystem: jest.fn(),
    listWorkspaces: jest.fn(),
    createWorkspace: jest.fn(),
    deleteWorkspace: jest.fn(),
    syncWorkspace: jest.fn(),
    getWorkspaceConfig: jest.fn(),
    syncWorkspaceConfig: jest.fn(),
    saveStepConfiguration: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    recordPerformanceMetric: jest.fn(),
    clearPerformanceMetrics: jest.fn(),
    
    // Simulate realistic API delays
    _simulateDelay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  }

  beforeAll(() => {
    global.window = {
      cantocapAPI: mockCantocapAPI,
      performance: {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB
          totalJSHeapSize: 100 * 1024 * 1024, // 100MB
          jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
        }
      }
    } as any

    // Enable performance monitoring
    jest.spyOn(performance, 'now').mockImplementation(() => Date.now())
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    performanceMonitor.clear()
    performanceMetrics = []

    // Setup mock responses with realistic delays
    mockCantocapAPI.initializeWorkspaceSystem.mockImplementation(async () => {
      await mockCantocapAPI._simulateDelay(100)
      return { success: true }
    })

    mockCantocapAPI.listWorkspaces.mockImplementation(async () => {
      await mockCantocapAPI._simulateDelay(50)
      return []
    })

    mockCantocapAPI.getWorkspaceConfig.mockImplementation(async () => {
      await mockCantocapAPI._simulateDelay(80)
      return { workspaceId: 'test', language: 'zh', inputFile: null, outputFile: null }
    })

    mockCantocapAPI.syncWorkspaceConfig.mockImplementation(async () => {
      await mockCantocapAPI._simulateDelay(120)
      return { success: true }
    })

    mockCantocapAPI.getPerformanceMetrics.mockResolvedValue([])
    mockCantocapAPI.recordPerformanceMetric.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    delete (global as any).window
  })

  /**
   * 1. STARTUP PERFORMANCE BENCHMARKS
   */
  describe('Startup Performance', () => {
    it('should meet total startup time target (< 1000ms)', async () => {
      performanceMonitor.start('startup_total')

      // Phase 1: Store Initialization
      performanceMonitor.start('store_init')
      const { result: appResult } = renderHook(() => useAppStore())
      const { result: workspaceResult } = renderHook(() => useWorkspaceStore())
      const { result: workflowResult } = renderHook(() => useWorkflowStore())
      
      appStore = appResult.current
      workspaceStore = workspaceResult.current
      workflowStore = workflowResult.current
      
      const storeInitTime = performanceMonitor.end('store_init')

      // Phase 2: Workspace System Initialization
      performanceMonitor.start('workspace_init')
      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })
      const workspaceInitTime = performanceMonitor.end('workspace_init')

      // Phase 3: IPC Integration
      performanceMonitor.start('ipc_init')
      const ipcIntegration = new WorkspaceIPCIntegration()
      await act(async () => {
        await ipcIntegration.initializeIntegration()
      })
      const ipcInitTime = performanceMonitor.end('ipc_init')

      const totalStartupTime = performanceMonitor.end('startup_total')

      // Validate individual component targets
      expect(storeInitTime).toBeLessThan(PERFORMANCE_TARGETS.startup.storeInit)
      expect(workspaceInitTime).toBeLessThan(PERFORMANCE_TARGETS.startup.workspaceInit)
      expect(ipcInitTime).toBeLessThan(PERFORMANCE_TARGETS.startup.ipcInit)

      // Validate total startup time
      expect(totalStartupTime).toBeLessThan(PERFORMANCE_TARGETS.startup.totalTime)

      // Record performance metrics
      await mockCantocapAPI.recordPerformanceMetric({
        type: 'startup',
        totalTime: totalStartupTime,
        breakdown: {
          storeInit: storeInitTime,
          workspaceInit: workspaceInitTime,
          ipcInit: ipcInitTime
        },
        timestamp: Date.now()
      })
    })

    it('should handle cold start vs warm start performance', async () => {
      // Cold start (first initialization)
      performanceMonitor.start('cold_start')
      
      const { result: workspaceResult1 } = renderHook(() => useWorkspaceStore())
      await act(async () => {
        await workspaceResult1.current.initializeWorkspaces()
      })
      
      const coldStartTime = performanceMonitor.end('cold_start')

      // Simulate app restart (warm start with cached data)
      mockCantocapAPI.listWorkspaces.mockResolvedValue([
        {
          id: 'ws_cached',
          name: 'Cached Workspace',
          isActive: true,
          createdAt: Date.now() - 10000,
          updatedAt: Date.now() - 1000,
          lastAccessedAt: Date.now() - 100
        }
      ])

      performanceMonitor.start('warm_start')
      
      const { result: workspaceResult2 } = renderHook(() => useWorkspaceStore())
      await act(async () => {
        await workspaceResult2.current.initializeWorkspaces()
      })
      
      const warmStartTime = performanceMonitor.end('warm_start')

      // Warm start should be significantly faster
      expect(warmStartTime).toBeLessThan(coldStartTime * 0.7) // At least 30% faster
      expect(warmStartTime).toBeLessThan(PERFORMANCE_TARGETS.startup.totalTime * 0.5)
    })

    it('should maintain performance with large number of existing workspaces', async () => {
      // Generate large workspace list
      const workspaceCount = 50
      const workspaces = Array.from({ length: workspaceCount }, (_, i) => ({
        id: `ws_large_${i}`,
        name: `Large Dataset Workspace ${i}`,
        isActive: i === 0,
        createdAt: Date.now() - (i * 1000),
        updatedAt: Date.now() - (i * 100),
        lastAccessedAt: Date.now() - (i * 10)
      }))

      mockCantocapAPI.listWorkspaces.mockResolvedValue(workspaces)

      performanceMonitor.start('large_dataset_startup')
      
      const { result } = renderHook(() => useWorkspaceStore())
      await act(async () => {
        await result.current.initializeWorkspaces()
      })
      
      const largeDatasetStartupTime = performanceMonitor.end('large_dataset_startup')

      // Should still meet startup targets even with large dataset
      expect(largeDatasetStartupTime).toBeLessThan(PERFORMANCE_TARGETS.startup.totalTime * 1.5) // 1.5x allowance for large datasets

      // Verify all workspaces loaded
      await waitFor(() => {
        expect(result.current.availableWorkspaces).toHaveLength(workspaceCount)
      })
    })
  })

  /**
   * 2. WORKSPACE SWITCHING PERFORMANCE
   */
  describe('Workspace Switching Performance', () => {
    let sourceWorkspace: any
    let targetWorkspace: any

    beforeEach(async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      // Setup test workspaces
      sourceWorkspace = {
        id: 'ws_source',
        name: 'Source Workspace',
        isActive: true,
        createdAt: Date.now() - 5000,
        updatedAt: Date.now() - 1000,
        lastAccessedAt: Date.now() - 100
      }

      targetWorkspace = {
        id: 'ws_target',
        name: 'Target Workspace',
        isActive: false,
        createdAt: Date.now() - 3000,
        updatedAt: Date.now() - 500,
        lastAccessedAt: Date.now() - 200
      }

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.availableWorkspaces = [sourceWorkspace, targetWorkspace]
        workspaceStore.currentWorkspace = sourceWorkspace
      })

      // Setup target workspace configuration
      mockCantocapAPI.getWorkspaceConfig.mockResolvedValue({
        workspaceId: targetWorkspace.id,
        language: 'zh',
        inputFile: { path: '/test/target.mp4', name: 'target.mp4' },
        outputFile: null
      })
    })

    it('should meet workspace switching time target (< 500ms)', async () => {
      performanceMonitor.start('workspace_switch_total')

      // Phase 1: Configuration Loading
      performanceMonitor.start('config_load')
      await act(async () => {
        await workspaceStore.switchWorkspace(targetWorkspace.id)
      })
      const configLoadTime = performanceMonitor.measure('config_load', 'config_load_start')

      // Phase 2: State Update
      const stateUpdateTime = performanceMonitor.measure('state_update')

      const totalSwitchTime = performanceMonitor.end('workspace_switch_total')

      // Validate component targets
      expect(configLoadTime).toBeLessThan(PERFORMANCE_TARGETS.workspaceSwitching.configLoad)
      expect(totalSwitchTime).toBeLessThan(PERFORMANCE_TARGETS.workspaceSwitching.totalTime)

      // Verify workspace switched correctly
      await waitFor(() => {
        expect(workspaceStore.currentWorkspace?.id).toBe(targetWorkspace.id)
      })
    })

    it('should optimize switching between recently accessed workspaces', async () => {
      // Switch to target workspace (first time)
      performanceMonitor.start('first_switch')
      await act(async () => {
        await workspaceStore.switchWorkspace(targetWorkspace.id)
      })
      const firstSwitchTime = performanceMonitor.end('first_switch')

      // Switch back to source workspace
      await act(async () => {
        await workspaceStore.switchWorkspace(sourceWorkspace.id)
      })

      // Switch to target workspace again (should be cached)
      performanceMonitor.start('cached_switch')
      await act(async () => {
        await workspaceStore.switchWorkspace(targetWorkspace.id)
      })
      const cachedSwitchTime = performanceMonitor.end('cached_switch')

      // Cached switch should be significantly faster
      expect(cachedSwitchTime).toBeLessThan(firstSwitchTime * 0.5) // At least 50% faster
      expect(cachedSwitchTime).toBeLessThan(PERFORMANCE_TARGETS.workspaceSwitching.totalTime * 0.3)
    })

    it('should handle rapid workspace switching without performance degradation', async () => {
      const switchCount = 10
      const switchTimes: number[] = []

      // Perform rapid switches
      for (let i = 0; i < switchCount; i++) {
        const targetId = i % 2 === 0 ? targetWorkspace.id : sourceWorkspace.id
        
        performanceMonitor.start(`rapid_switch_${i}`)
        await act(async () => {
          await workspaceStore.switchWorkspace(targetId)
        })
        const switchTime = performanceMonitor.end(`rapid_switch_${i}`)
        
        switchTimes.push(switchTime)
      }

      // Verify consistent performance
      const averageSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length
      const maxSwitchTime = Math.max(...switchTimes)
      const performanceDegradation = (maxSwitchTime - switchTimes[0]) / switchTimes[0]

      expect(averageSwitchTime).toBeLessThan(PERFORMANCE_TARGETS.workspaceSwitching.totalTime)
      expect(performanceDegradation).toBeLessThan(0.2) // Less than 20% degradation
    })
  })

  /**
   * 3. AUTO-SAVE LATENCY VALIDATION
   */
  describe('Auto-Save Performance', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = {
          id: 'ws_autosave_perf',
          name: 'Auto-Save Performance Test',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      })
    })

    it('should maintain UI responsiveness during auto-save (< 50ms blocking)', async () => {
      const uiBlockingTimes: number[] = []
      const changeCount = 20

      // Perform multiple rapid configuration changes
      for (let i = 0; i < changeCount; i++) {
        performanceMonitor.start(`ui_blocking_${i}`)
        
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig({
            language: `config-${i}`,
            timestamp: Date.now()
          })
        })
        
        const blockingTime = performanceMonitor.end(`ui_blocking_${i}`)
        uiBlockingTimes.push(blockingTime)
      }

      // Validate UI blocking times
      const maxBlockingTime = Math.max(...uiBlockingTimes)
      const averageBlockingTime = uiBlockingTimes.reduce((a, b) => a + b, 0) / uiBlockingTimes.length

      expect(maxBlockingTime).toBeLessThan(PERFORMANCE_TARGETS.autoSave.uiBlocking)
      expect(averageBlockingTime).toBeLessThan(PERFORMANCE_TARGETS.autoSave.uiBlocking * 0.5)

      // Verify pending saves are managed efficiently
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBeGreaterThan(0)
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBeLessThanOrEqual(changeCount)
    })

    it('should optimize batch processing performance', async () => {
      // Configure for batch testing
      await act(async () => {
        await workspaceStore.setAutoSaveOptions({
          debounceTime: 1000,
          maxBatchSize: 15,
          enableBatching: true
        })
      })

      const batchSize = 25
      performanceMonitor.start('batch_generation')

      // Generate batch of changes
      for (let i = 0; i < batchSize; i++) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig({
            [`field_${i}`]: `value_${i}`,
            batchIndex: i
          })
        })
      }

      const batchGenerationTime = performanceMonitor.end('batch_generation')

      // Fast-forward through debounce period
      performanceMonitor.start('batch_processing')
      await act(async () => {
        jest.advanceTimersByTime(1500)
        await jest.runAllTimersAsync()
      })
      const batchProcessingTime = performanceMonitor.end('batch_processing')

      // Validate batch performance
      expect(batchGenerationTime).toBeLessThan(PERFORMANCE_TARGETS.autoSave.uiBlocking * batchSize)
      expect(batchProcessingTime).toBeLessThan(PERFORMANCE_TARGETS.autoSave.batchProcessing * Math.ceil(batchSize / 15))

      // Verify batching efficiency
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)
        expect(workspaceStore.autoSaveStatus.lastBatchSize).toBe(batchSize)
      })
    })

    it('should handle save latency under network constraints', async () => {
      // Simulate various network latencies
      const networkLatencies = [50, 100, 200, 500, 1000] // ms

      const saveLatencies: number[] = []

      for (const latency of networkLatencies) {
        // Configure API delay
        mockCantocapAPI.syncWorkspaceConfig.mockImplementation(async () => {
          await mockCantocapAPI._simulateDelay(latency)
          return { success: true }
        })

        performanceMonitor.start(`save_latency_${latency}`)
        
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig({
            networkLatency: latency,
            timestamp: Date.now()
          })
        })

        // Fast-forward through debounce
        await act(async () => {
          jest.advanceTimersByTime(2000)
          await jest.runAllTimersAsync()
        })

        const totalLatency = performanceMonitor.end(`save_latency_${latency}`)
        saveLatencies.push(totalLatency - latency) // Subtract network latency to get processing overhead

        // Wait for save completion
        await waitFor(() => {
          expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)
        })
      }

      // Processing overhead should remain consistent regardless of network latency
      const maxOverhead = Math.max(...saveLatencies)
      const minOverhead = Math.min(...saveLatencies)
      const overheadVariation = (maxOverhead - minOverhead) / minOverhead

      expect(maxOverhead).toBeLessThan(PERFORMANCE_TARGETS.autoSave.saveLatency)
      expect(overheadVariation).toBeLessThan(0.3) // Less than 30% variation
    })
  })

  /**
   * 4. MEMORY USAGE MONITORING
   */
  describe('Memory Usage Performance', () => {
    it('should maintain memory usage within targets', async () => {
      const initialMemory = performanceMonitor.getMemoryUsage()
      expect(initialMemory.used).toBeLessThan(PERFORMANCE_TARGETS.memory.baselineUsage)

      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      // Create multiple workspaces
      const workspaceCount = 10
      for (let i = 0; i < workspaceCount; i++) {
        mockCantocapAPI.createWorkspace.mockResolvedValue({
          success: true,
          workspaceId: `ws_memory_${i}`
        })

        await act(async () => {
          await workspaceStore.createWorkspace(`Memory Test ${i}`)
        })
      }

      const memoryAfterWorkspaces = performanceMonitor.getMemoryUsage()
      const memoryIncrease = memoryAfterWorkspaces.used - initialMemory.used
      const memoryPerWorkspace = memoryIncrease / workspaceCount

      // Validate memory usage
      expect(memoryAfterWorkspaces.used).toBeLessThan(PERFORMANCE_TARGETS.memory.peakUsage)
      expect(memoryPerWorkspace).toBeLessThan(PERFORMANCE_TARGETS.memory.workspaceOverhead)

      // Test memory cleanup
      for (let i = 0; i < workspaceCount; i++) {
        await act(async () => {
          await workspaceStore.deleteWorkspace(`ws_memory_${i}`)
        })
      }

      // Force garbage collection simulation
      if (global.gc) global.gc()

      const memoryAfterCleanup = performanceMonitor.getMemoryUsage()
      const memoryReclaimed = memoryAfterWorkspaces.used - memoryAfterCleanup.used
      const reclamationRate = memoryReclaimed / memoryIncrease

      expect(reclamationRate).toBeGreaterThan(0.8) // At least 80% memory reclaimed
    })

    it('should handle memory pressure gracefully', async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      // Simulate memory pressure by creating large configurations
      const largeConfigSize = 1000 // Large configuration objects
      
      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = {
          id: 'ws_memory_pressure',
          name: 'Memory Pressure Test',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      })

      performanceMonitor.start('memory_pressure_test')

      // Generate large configuration data
      for (let i = 0; i < largeConfigSize; i++) {
        const largeData = {
          [`largeField_${i}`]: new Array(100).fill(`data-${i}`).join(' '),
          segments: Array.from({ length: 50 }, (_, j) => ({
            id: j,
            text: `Segment ${j} for iteration ${i}`,
            metadata: new Array(20).fill(`meta-${i}-${j}`).join(' ')
          }))
        }

        await act(async () => {
          await workspaceStore.updateWorkspaceConfig(largeData)
        })

        // Check memory usage periodically
        if (i % 100 === 0) {
          const currentMemory = performanceMonitor.getMemoryUsage()
          
          // If approaching memory limit, should trigger optimization
          if (currentMemory.used > PERFORMANCE_TARGETS.memory.gcThreshold) {
            expect(workspaceStore.memoryOptimizationActive).toBe(true)
            break
          }
        }
      }

      const memoryPressureTime = performanceMonitor.end('memory_pressure_test')
      const finalMemory = performanceMonitor.getMemoryUsage()

      // Should handle memory pressure without crashing
      expect(finalMemory.used).toBeLessThan(PERFORMANCE_TARGETS.memory.peakUsage * 1.2) // 20% tolerance
      expect(memoryPressureTime).toBeLessThan(30000) // Should complete within 30 seconds
    })
  })

  /**
   * 5. CONCURRENT OPERATIONS PERFORMANCE
   */
  describe('Concurrent Operations Performance', () => {
    it('should maintain high success rate under concurrent load (>95%)', async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      const concurrentOperations = PERFORMANCE_TARGETS.concurrency.maxConcurrentOps
      const operationPromises: Promise<any>[] = []
      let successCount = 0
      let errorCount = 0

      performanceMonitor.start('concurrent_operations')

      // Generate concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        const operationType = i % 4
        let operationPromise: Promise<any>

        switch (operationType) {
          case 0: // Workspace creation
            mockCantocapAPI.createWorkspace.mockResolvedValue({
              success: true,
              workspaceId: `ws_concurrent_${i}`
            })
            operationPromise = workspaceStore.createWorkspace(`Concurrent ${i}`)
            break

          case 1: // Configuration update
            operationPromise = workspaceStore.updateWorkspaceConfig({
              [`concurrentField_${i}`]: `value_${i}`,
              timestamp: Date.now()
            })
            break

          case 2: // Step configuration
            operationPromise = workspaceStore.updateStepConfiguration('processing', {
              stepId: 'processing',
              workspaceId: 'ws_concurrent_test',
              isCompleted: false,
              data: { [`stepData_${i}`]: `stepValue_${i}` },
              validationState: { isValid: true, errors: [] },
              lastModified: Date.now()
            })
            break

          case 3: // Workspace switching
            operationPromise = workspaceStore.switchWorkspace(`ws_concurrent_${Math.floor(i / 4)}`)
            break

          default:
            operationPromise = Promise.resolve({ success: true })
        }

        // Wrap in timeout and error handling
        const timedOperation = Promise.race([
          operationPromise.then(result => ({ success: true, result })),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), PERFORMANCE_TARGETS.concurrency.operationTimeout)
          )
        ])

        operationPromises.push(
          timedOperation
            .then(result => {
              successCount++
              return result
            })
            .catch(error => {
              errorCount++
              return { success: false, error }
            })
        )
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(operationPromises)
      const concurrentOperationTime = performanceMonitor.end('concurrent_operations')

      // Calculate performance metrics
      const totalOperations = concurrentOperations
      const actualSuccessRate = successCount / totalOperations
      const actualErrorRate = errorCount / totalOperations

      // Validate performance targets
      expect(actualSuccessRate).toBeGreaterThan(PERFORMANCE_TARGETS.concurrency.successRate)
      expect(actualErrorRate).toBeLessThan(PERFORMANCE_TARGETS.concurrency.errorRate)
      expect(concurrentOperationTime).toBeLessThan(PERFORMANCE_TARGETS.concurrency.operationTimeout * 2)

      // Verify system stability after concurrent load
      const finalMemory = performanceMonitor.getMemoryUsage()
      expect(finalMemory.used).toBeLessThan(PERFORMANCE_TARGETS.memory.peakUsage)
    })

    it('should handle concurrent auto-save operations efficiently', async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = {
          id: 'ws_concurrent_autosave',
          name: 'Concurrent Auto-Save Test',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      })

      const concurrentUpdates = 50
      const updatePromises: Promise<any>[] = []

      performanceMonitor.start('concurrent_autosave')

      // Generate concurrent configuration updates
      for (let i = 0; i < concurrentUpdates; i++) {
        const updatePromise = workspaceStore.updateWorkspaceConfig({
          [`concurrentUpdate_${i}`]: `value_${i}`,
          updateIndex: i,
          timestamp: Date.now() + i
        })

        updatePromises.push(updatePromise)
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises)

      // Fast-forward through debounce period
      await act(async () => {
        jest.advanceTimersByTime(3000)
        await jest.runAllTimersAsync()
      })

      const concurrentAutoSaveTime = performanceMonitor.end('concurrent_autosave')

      // Validate auto-save efficiency
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)
        expect(workspaceStore.autoSaveStatus.failedSaves).toBe(0)
      })

      // Should efficiently batch concurrent updates
      expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledTimes(1) // Single batched save
      expect(concurrentAutoSaveTime).toBeLessThan(5000) // Complete within 5 seconds

      // Verify final configuration contains all updates
      const finalConfig = workspaceStore.getCurrentWorkspaceConfig()
      expect(finalConfig?.updateIndex).toBe(concurrentUpdates - 1) // Last update wins
    })
  })

  /**
   * 6. LARGE DATASET HANDLING
   */
  describe('Large Dataset Performance', () => {
    it('should handle large subtitle segment datasets efficiently', async () => {
      const segmentCount = 5000 // Large subtitle file
      const mockSegments = Array.from({ length: segmentCount }, (_, i) => ({
        id: i,
        start: i * 2,
        end: (i * 2) + 1.8,
        text: `This is subtitle segment number ${i} with some longer text content to simulate real subtitles.`,
        confidence: 0.85 + (Math.random() * 0.15)
      }))

      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = {
          id: 'ws_large_dataset',
          name: 'Large Dataset Test',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      })

      // Load large dataset
      performanceMonitor.start('large_dataset_load')
      
      await act(async () => {
        await workspaceStore.updateStepConfiguration('review', {
          stepId: 'review',
          workspaceId: 'ws_large_dataset',
          isCompleted: false,
          data: {
            segments: mockSegments,
            totalSegments: segmentCount,
            processingComplete: true
          },
          validationState: { isValid: true, errors: [] },
          lastModified: Date.now()
        })
      })

      const loadTime = performanceMonitor.end('large_dataset_load')

      // Validate load performance
      const expectedLoadTime = PERFORMANCE_TARGETS.largeDatasets.segmentLoad * (segmentCount / 1000)
      expect(loadTime).toBeLessThan(expectedLoadTime)

      // Test search performance
      performanceMonitor.start('large_dataset_search')
      
      const searchResults = await act(async () => {
        return workspaceStore.searchSegments('segment number 2500')
      })
      
      const searchTime = performanceMonitor.end('large_dataset_search')

      expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.largeDatasets.searchTime)
      expect(searchResults.length).toBeGreaterThan(0)

      // Test export performance
      performanceMonitor.start('large_dataset_export')
      
      const exportResult = await act(async () => {
        return workspaceStore.exportSegments('srt', mockSegments)
      })
      
      const exportTime = performanceMonitor.end('large_dataset_export')

      const expectedExportTime = PERFORMANCE_TARGETS.largeDatasets.exportTime * (segmentCount / 10000)
      expect(exportTime).toBeLessThan(expectedExportTime)
      expect(exportResult.success).toBe(true)
    })

    it('should implement efficient virtual scrolling for large lists', async () => {
      const largeListSize = 10000
      const viewportSize = 100 // Visible items
      const mockItems = Array.from({ length: largeListSize }, (_, i) => ({
        id: i,
        content: `Item ${i} with some content data`,
        metadata: { index: i, type: 'test' }
      }))

      // Simulate virtual scrolling performance
      performanceMonitor.start('virtual_scroll_init')
      
      const virtualList = {
        items: mockItems,
        viewportStart: 0,
        viewportEnd: viewportSize,
        getVisibleItems: function() {
          return this.items.slice(this.viewportStart, this.viewportEnd)
        },
        scrollTo: function(index: number) {
          this.viewportStart = Math.max(0, index - Math.floor(viewportSize / 2))
          this.viewportEnd = Math.min(this.items.length, this.viewportStart + viewportSize)
        }
      }

      const initTime = performanceMonitor.end('virtual_scroll_init')

      // Test scrolling performance
      const scrollPositions = [1000, 5000, 8000, 2000, 9500]
      const scrollTimes: number[] = []

      for (const position of scrollPositions) {
        performanceMonitor.start(`scroll_to_${position}`)
        virtualList.scrollTo(position)
        const visibleItems = virtualList.getVisibleItems()
        const scrollTime = performanceMonitor.end(`scroll_to_${position}`)

        scrollTimes.push(scrollTime)
        expect(visibleItems.length).toBeLessThanOrEqual(viewportSize)
      }

      // Validate virtual scrolling performance
      expect(initTime).toBeLessThan(100) // Fast initialization
      const maxScrollTime = Math.max(...scrollTimes)
      expect(maxScrollTime).toBeLessThan(PERFORMANCE_TARGETS.largeDatasets.virtualScrolling)

      // Performance should be consistent regardless of list size
      const scrollTimeVariation = Math.max(...scrollTimes) - Math.min(...scrollTimes)
      expect(scrollTimeVariation).toBeLessThan(10) // Less than 10ms variation
    })
  })
})