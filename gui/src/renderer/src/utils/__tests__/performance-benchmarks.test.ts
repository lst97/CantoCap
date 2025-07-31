import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { WorkspaceManager } from '../workspace-manager'
import { IndexedDBService } from '../indexeddb-service'
import { AppStore } from '../../stores/app-store'
import { WorkflowStore } from '../../stores/workflow-store'

interface PerformanceMetrics {
  duration: number
  memoryUsage: number
  cpuUsage?: number
  meetsTarget: boolean
}

interface PerformanceBenchmark {
  name: string
  target: number
  operation: () => Promise<any>
  setup?: () => Promise<void>
  cleanup?: () => Promise<void>
}

class PerformanceMonitor {
  private startTime: number = 0
  private startMemory: number = 0

  start() {
    this.startTime = performance.now()
    this.startMemory = this.getMemoryUsage()
  }

  async measureOperation<T>(
    name: string,
    operation: () => Promise<T>,
    target: number
  ): Promise<{ result: T; duration: number; meetsTarget: boolean; memoryDelta: number }> {
    const startTime = performance.now()
    const startMemory = this.getMemoryUsage()
    
    const result = await operation()
    
    const duration = performance.now() - startTime
    const memoryDelta = this.getMemoryUsage() - startMemory
    
    return {
      result,
      duration,
      memoryDelta,
      meetsTarget: duration < target
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
    }
    return 0
  }
}

class WorkspacePerformanceTestDataFactory {
  static createTestWorkspaces(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `perf-workspace-${i + 1}`,
      name: `Performance Test Workspace ${i + 1}`,
      description: `Performance testing workspace ${i + 1}`,
      appConfig: {
        language: i % 2 === 0 ? 'en' : 'zh',
        model: i % 3 === 0 ? 'small' : i % 3 === 1 ? 'medium' : 'large',
        priority: i % 2 === 0 ? 'speed' : 'quality',
        useGPU: i % 4 === 0,
        temperature: Array.from({ length: 10 }, (_, j) => j / 10)
      },
      workflowStep: ['input', 'config', 'processing', 'review', 'export'][i % 5],
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - i * 60 * 60 * 1000),
      isActive: i === 0
    }))
  }

  static createLargeSubtitleSession(lineCount: number = 1000) {
    return {
      id: 'perf-subtitle-session',
      subtitles: Array.from({ length: lineCount }, (_, i) => ({
        id: `subtitle-${i + 1}`,
        start: i * 2000,  // 2 seconds apart
        end: (i + 1) * 2000 - 100,
        text: `This is subtitle line ${i + 1} for performance testing purposes.`,
        speaker: `Speaker ${(i % 3) + 1}`,
        confidence: 0.9 + Math.random() * 0.1
      })),
      edits: Array.from({ length: Math.floor(lineCount / 10) }, (_, i) => ({
        id: `edit-${i + 1}`,
        subtitleId: `subtitle-${i * 10 + 1}`,
        originalText: `Original text ${i + 1}`,
        editedText: `Edited text ${i + 1}`,
        timestamp: new Date(Date.now() - i * 60000)
      }))
    }
  }
}

describe('Performance Benchmark Validation', () => {
  let workspaceManager: WorkspaceManager
  let indexedDBService: IndexedDBService
  let performanceMonitor: PerformanceMonitor
  let appStore: AppStore
  let workflowStore: WorkflowStore

  beforeEach(async () => {
    workspaceManager = new WorkspaceManager()
    indexedDBService = new IndexedDBService()
    performanceMonitor = new PerformanceMonitor()
    appStore = new AppStore()
    workflowStore = new WorkflowStore()
    
    // Clear any existing data
    await indexedDBService.clear()
  })

  afterEach(async () => {
    await indexedDBService.clear()
  })

  describe('Startup Performance Validation', () => {
    it('should meet <200ms startup degradation target', async () => {
      // Measure baseline startup (without workspace system)
      const baselineStartup = await performanceMonitor.measureOperation(
        'Baseline Startup',
        async () => {
          // Simulate basic app initialization
          const start = performance.now()
          await new Promise(resolve => setTimeout(resolve, 50)) // Simulate basic init
          return performance.now() - start
        },
        1000
      )

      // Measure workspace-enabled startup
      const workspaceStartup = await performanceMonitor.measureOperation(
        'Workspace-Enabled Startup',
        async () => {
          const start = performance.now()
          
          // Initialize workspace system
          await workspaceManager.initialize()
          await workspaceManager.loadWorkspaces()
          
          // Simulate full app startup with workspace restoration
          const defaultWorkspace = await workspaceManager.getCurrentWorkspace()
          if (defaultWorkspace) {
            await appStore.loadFromWorkspace(defaultWorkspace)
            await workflowStore.restoreState(defaultWorkspace.workflowStep)
          }
          
          return performance.now() - start
        },
        1000
      )

      const degradation = workspaceStartup.duration - baselineStartup.duration

      console.log('Startup Performance Results:')
      console.log(`Baseline startup: ${baselineStartup.duration.toFixed(2)}ms`)
      console.log(`Workspace startup: ${workspaceStartup.duration.toFixed(2)}ms`)
      console.log(`Degradation: ${degradation.toFixed(2)}ms`)
      console.log(`Memory delta: ${workspaceStartup.memoryDelta.toFixed(2)}MB`)
      console.log(`Meets target (<200ms): ${degradation < 200}`)

      expect(degradation).toBeLessThan(200) // <200ms degradation target
      expect(workspaceStartup.memoryDelta).toBeLessThan(20) // <20MB memory increase
    })

    it('should handle large workspace collections efficiently', async () => {
      // Create 20 workspaces for stress testing
      const testWorkspaces = WorkspacePerformanceTestDataFactory.createTestWorkspaces(20)
      
      // Store all workspaces
      for (const workspace of testWorkspaces) {
        await workspaceManager.createWorkspace(workspace)
      }

      const startupWithManyWorkspaces = await performanceMonitor.measureOperation(
        'Startup with 20 Workspaces',
        async () => {
          await workspaceManager.initialize()
          await workspaceManager.loadWorkspaces()
          const workspaces = await workspaceManager.getAllWorkspaces()
          return workspaces.length
        },
        2000
      )

      console.log('Large Collection Startup Results:')
      console.log(`Duration: ${startupWithManyWorkspaces.duration.toFixed(2)}ms`)
      console.log(`Workspaces loaded: ${startupWithManyWorkspaces.result}`)
      console.log(`Memory usage: ${startupWithManyWorkspaces.memoryDelta.toFixed(2)}MB`)

      expect(startupWithManyWorkspaces.duration).toBeLessThan(1000) // <1s for 20 workspaces
      expect(startupWithManyWorkspaces.result).toBe(20)
      expect(startupWithManyWorkspaces.memoryDelta).toBeLessThan(50) // <50MB for large collection
    })
  })

  describe('Workspace Switching Performance', () => {
    beforeEach(async () => {
      // Setup test workspaces
      const testWorkspaces = WorkspacePerformanceTestDataFactory.createTestWorkspaces(5)
      for (const workspace of testWorkspaces) {
        await workspaceManager.createWorkspace(workspace)
      }
    })

    it('should meet <500ms workspace switching target', async () => {
      const workspaces = await workspaceManager.getAllWorkspaces()
      const sourceWorkspace = workspaces[0]
      const targetWorkspace = workspaces[1]

      // Set initial workspace
      await workspaceManager.setCurrentWorkspace(sourceWorkspace.id)
      await appStore.loadFromWorkspace(sourceWorkspace)

      const switchingPerformance = await performanceMonitor.measureOperation(
        'Workspace Switching',
        async () => {
          // Complete workspace switch including:
          // 1. Save current state
          // 2. Switch workspace
          // 3. Load new configuration
          // 4. Update UI state
          
          await workspaceManager.saveCurrentState()
          await workspaceManager.setCurrentWorkspace(targetWorkspace.id)
          await appStore.loadFromWorkspace(targetWorkspace)
          await workflowStore.restoreState(targetWorkspace.workflowStep)
          
          return await workspaceManager.getCurrentWorkspace()
        },
        500
      )

      console.log('Workspace Switching Results:')
      console.log(`Duration: ${switchingPerformance.duration.toFixed(2)}ms`)
      console.log(`Memory delta: ${switchingPerformance.memoryDelta.toFixed(2)}MB`)
      console.log(`Meets target (<500ms): ${switchingPerformance.meetsTarget}`)

      expect(switchingPerformance.duration).toBeLessThan(500) // <500ms target
      expect(switchingPerformance.result?.id).toBe(targetWorkspace.id)
      expect(switchingPerformance.memoryDelta).toBeLessThan(10) // <10MB for switching
    })

    it('should maintain performance with multiple rapid switches', async () => {
      const workspaces = await workspaceManager.getAllWorkspaces()
      const switchTimes: number[] = []

      // Perform 10 rapid workspace switches
      for (let i = 0; i < 10; i++) {
        const targetWorkspace = workspaces[i % workspaces.length]
        
        const switchTime = await performanceMonitor.measureOperation(
          `Rapid Switch ${i + 1}`,
          async () => {
            await workspaceManager.setCurrentWorkspace(targetWorkspace.id)
            await appStore.loadFromWorkspace(targetWorkspace)
            return targetWorkspace.id
          },
          1000
        )
        
        switchTimes.push(switchTime.duration)
      }

      const avgSwitchTime = switchTimes.reduce((sum, time) => sum + time, 0) / switchTimes.length
      const maxSwitchTime = Math.max(...switchTimes)

      console.log('Rapid Switching Results:')
      console.log(`Average switch time: ${avgSwitchTime.toFixed(2)}ms`)
      console.log(`Maximum switch time: ${maxSwitchTime.toFixed(2)}ms`)
      console.log(`All switches under 1s: ${maxSwitchTime < 1000}`)

      expect(avgSwitchTime).toBeLessThan(300) // Average under 300ms
      expect(maxSwitchTime).toBeLessThan(1000) // No switch over 1s
    })
  })

  describe('Auto-Save Performance Impact', () => {
    beforeEach(async () => {
      const workspace = WorkspacePerformanceTestDataFactory.createTestWorkspaces(1)[0]
      await workspaceManager.createWorkspace(workspace)
      await workspaceManager.setCurrentWorkspace(workspace.id)
    })

    it('should maintain UI responsiveness during auto-save (<50ms blocking)', async () => {
      // Create large subtitle session for realistic auto-save testing
      const largeSession = WorkspacePerformanceTestDataFactory.createLargeSubtitleSession(500)
      
      // Simulate UI interactions during auto-save
      const uiResponsiveness = await performanceMonitor.measureOperation(
        'Auto-Save UI Impact',
        async () => {
          // Start auto-save operation
          const autoSavePromise = workspaceManager.saveCurrentState()
          
          // Immediately try UI operations (should not block)
          const uiStart = performance.now()
          
          // Simulate UI interactions
          await appStore.updateConfig({ language: 'en' })
          await workflowStore.updateStep('config')
          
          const uiDuration = performance.now() - uiStart
          
          // Wait for auto-save to complete
          await autoSavePromise
          
          return uiDuration
        },
        1000
      )

      console.log('Auto-Save UI Impact Results:')
      console.log(`UI blocking time: ${uiResponsiveness.result.toFixed(2)}ms`)
      console.log(`Total operation time: ${uiResponsiveness.duration.toFixed(2)}ms`)
      console.log(`Meets target (<50ms UI blocking): ${uiResponsiveness.result < 50}`)

      expect(uiResponsiveness.result).toBeLessThan(50) // <50ms UI blocking
    })

    it('should handle frequent auto-saves efficiently', async () => {
      const autoSaveTimes: number[] = []

      // Perform 20 auto-saves with small delays
      for (let i = 0; i < 20; i++) {
        // Make a small change
        await appStore.updateConfig({ 
          language: i % 2 === 0 ? 'en' : 'zh',
          priority: i % 3 === 0 ? 'speed' : 'quality'
        })

        const autoSaveTime = await performanceMonitor.measureOperation(
          `Auto-Save ${i + 1}`,
          async () => {
            await workspaceManager.saveCurrentState()
          },
          2000
        )

        autoSaveTimes.push(autoSaveTime.duration)
        
        // Small delay between auto-saves
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const avgAutoSaveTime = autoSaveTimes.reduce((sum, time) => sum + time, 0) / autoSaveTimes.length
      const maxAutoSaveTime = Math.max(...autoSaveTimes)

      console.log('Frequent Auto-Save Results:')
      console.log(`Average auto-save time: ${avgAutoSaveTime.toFixed(2)}ms`)
      console.log(`Maximum auto-save time: ${maxAutoSaveTime.toFixed(2)}ms`)
      console.log(`All auto-saves under 2s: ${maxAutoSaveTime < 2000}`)

      expect(avgAutoSaveTime).toBeLessThan(500) // Average under 500ms
      expect(maxAutoSaveTime).toBeLessThan(2000) // No auto-save over 2s
    })
  })

  describe('Memory Usage Validation', () => {
    it('should maintain reasonable memory usage with 10 workspaces', async () => {
      const initialMemory = performanceMonitor['getMemoryUsage']()
      
      // Create and load 10 workspaces with substantial data
      const testWorkspaces = WorkspacePerformanceTestDataFactory.createTestWorkspaces(10)
      
      for (const workspace of testWorkspaces) {
        await workspaceManager.createWorkspace(workspace)
        
        // Add subtitle data to each workspace
        const subtitleSession = WorkspacePerformanceTestDataFactory.createLargeSubtitleSession(100)
        await indexedDBService.set(`subtitle-session-${workspace.id}`, subtitleSession)
      }

      // Load all workspaces
      await workspaceManager.loadWorkspaces()
      
      const finalMemory = performanceMonitor['getMemoryUsage']()
      const memoryIncrease = finalMemory - initialMemory

      console.log('Memory Usage Results:')
      console.log(`Initial memory: ${initialMemory.toFixed(2)}MB`)
      console.log(`Final memory: ${finalMemory.toFixed(2)}MB`)
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`)
      console.log(`Meets target (<20MB): ${memoryIncrease < 20}`)

      expect(memoryIncrease).toBeLessThan(20) // <20MB increase target
    })
  })

  describe('Stress Testing', () => {
    it('should handle extreme workspace switching stress test', async () => {
      // Create 10 workspaces for stress testing
      const testWorkspaces = WorkspacePerformanceTestDataFactory.createTestWorkspaces(10)
      
      for (const workspace of testWorkspaces) {
        await workspaceManager.createWorkspace(workspace)
      }

      const stressTestResults = []

      // Perform 50 random workspace switches rapidly
      for (let i = 0; i < 50; i++) {
        const randomWorkspace = testWorkspaces[Math.floor(Math.random() * testWorkspaces.length)]
        
        const switchResult = await performanceMonitor.measureOperation(
          `Stress Switch ${i + 1}`,
          async () => {
            await workspaceManager.setCurrentWorkspace(randomWorkspace.id)
            return randomWorkspace.id
          },
          2000
        )
        
        stressTestResults.push(switchResult.duration)
        
        // No delay - immediate next switch
      }

      const avgStressTime = stressTestResults.reduce((sum, time) => sum + time, 0) / stressTestResults.length
      const maxStressTime = Math.max(...stressTestResults)
      const failedSwitches = stressTestResults.filter(time => time > 2000).length

      console.log('Stress Test Results:')
      console.log(`Average switch time: ${avgStressTime.toFixed(2)}ms`)
      console.log(`Maximum switch time: ${maxStressTime.toFixed(2)}ms`)
      console.log(`Failed switches (>2s): ${failedSwitches}`)
      console.log(`Success rate: ${((50 - failedSwitches) / 50 * 100).toFixed(2)}%`)

      expect(avgStressTime).toBeLessThan(1000) // Average under 1s even in stress
      expect(failedSwitches).toBeLessThan(3) // <6% failure rate acceptable in stress test
    })
  })
})