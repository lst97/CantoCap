import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { WorkspaceManager } from '../workspace-manager'
import { IndexedDBService } from '../indexeddb-service'
import { AppStore } from '../../stores/app-store'
import { WorkflowStore } from '../../stores/workflow-store'

interface ErrorScenario {
  name: string
  error: () => void | Promise<void>
  expectedRecovery: string
  testAction: () => Promise<any>
  validation: (result: any) => boolean
  cleanup?: () => void | Promise<void>
}

interface RecoveryTestResult {
  scenario: string
  success: boolean
  recoveryStrategy: string
  duration: number
  error?: string
}

class ErrorSimulator {
  private originalMethods: Map<string, any> = new Map()

  simulateIndexedDBError(errorType: string, service: IndexedDBService) {
    const originalSet = service.set
    const originalGet = service.get
    
    this.originalMethods.set('indexedDB-set', originalSet)
    this.originalMethods.set('indexedDB-get', originalGet)

    switch (errorType) {
      case 'QuotaExceededError':
        service.set = jest.fn().mockRejectedValue(new DOMException('QuotaExceededError', 'QuotaExceededError'))
        break
      case 'InvalidStateError':
        service.get = jest.fn().mockRejectedValue(new DOMException('InvalidStateError', 'InvalidStateError'))
        break
      case 'VersionError':
        service.set = jest.fn().mockRejectedValue(new DOMException('VersionError', 'VersionError'))
        break
      case 'DataError':
        service.get = jest.fn().mockResolvedValue(null)
        break
    }
  }

  simulateIPCTimeout(workspaceManager: WorkspaceManager) {
    const originalMethod = workspaceManager['sendIPCMessage']
    this.originalMethods.set('ipc-send', originalMethod)
    
    workspaceManager['sendIPCMessage'] = jest.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('IPC timeout')), 100)
      })
    })
  }

  simulateNetworkError() {
    const originalFetch = global.fetch
    this.originalMethods.set('fetch', originalFetch)
    
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
  }

  corruptMigrationData(service: IndexedDBService) {
    const originalGet = service.get
    this.originalMethods.set('migration-get', originalGet)
    
    service.get = jest.fn().mockImplementation(async (key: string) => {
      if (key.includes('workspace') || key.includes('config')) {
        return {
          // Corrupted data structure
          corruptedField: null,
          missingRequiredField: undefined,
          invalidType: 'should-be-object',
          nestedCorruption: {
            validField: 'valid',
            invalidField: null
          }
        }
      }
      return originalGet.call(service, key)
    })
  }

  simulateMemoryPressure() {
    // Simulate low memory by creating large objects
    const memoryPressure = []
    for (let i = 0; i < 1000; i++) {
      memoryPressure.push(new Array(10000).fill('memory-pressure-simulation'))
    }
    this.originalMethods.set('memory-pressure', memoryPressure)
  }

  restore(key: string, target: any) {
    const originalMethod = this.originalMethods.get(key)
    if (originalMethod) {
      if (key === 'fetch') {
        global.fetch = originalMethod
      } else if (key.includes('indexedDB')) {
        const method = key.split('-')[1]
        target[method] = originalMethod
      } else if (key === 'ipc-send') {
        target['sendIPCMessage'] = originalMethod
      } else if (key === 'memory-pressure') {
        // Memory will be cleaned up by GC
      }
      this.originalMethods.delete(key)
    }
  }

  restoreAll(targets: { [key: string]: any }) {
    this.originalMethods.forEach((originalMethod, key) => {
      if (key === 'fetch') {
        global.fetch = originalMethod
      } else if (key.includes('indexedDB')) {
        const method = key.split('-')[1]
        targets.indexedDB[method] = originalMethod
      } else if (key === 'ipc-send') {
        targets.workspaceManager['sendIPCMessage'] = originalMethod
      }
    })
    this.originalMethods.clear()
  }
}

describe('Error Recovery and Resilience Validation', () => {
  let workspaceManager: WorkspaceManager
  let indexedDBService: IndexedDBService
  let appStore: AppStore
  let workflowStore: WorkflowStore
  let errorSimulator: ErrorSimulator

  beforeEach(async () => {
    workspaceManager = new WorkspaceManager()
    indexedDBService = new IndexedDBService()
    appStore = new AppStore()
    workflowStore = new WorkflowStore()
    errorSimulator = new ErrorSimulator()
    
    await indexedDBService.clear()
  })

  afterEach(async () => {
    errorSimulator.restoreAll({
      indexedDB: indexedDBService,
      workspaceManager: workspaceManager
    })
    await indexedDBService.clear()
  })

  const errorScenarios: ErrorScenario[] = [
    {
      name: 'IndexedDB QuotaExceededError',
      error: () => errorSimulator.simulateIndexedDBError('QuotaExceededError', indexedDBService),
      expectedRecovery: 'localStorage fallback',
      testAction: async () => {
        const workspace = await workspaceManager.createWorkspace({
          name: 'Quota Test',
          description: 'Testing quota exceeded recovery'
        })
        return workspace
      },
      validation: (result) => result && (result.id || result.fallbackStorage === 'localStorage'),
      cleanup: () => errorSimulator.restore('indexedDB-set', indexedDBService)
    },
    {
      name: 'IndexedDB InvalidStateError',
      error: () => errorSimulator.simulateIndexedDBError('InvalidStateError', indexedDBService),
      expectedRecovery: 'database reconnection',
      testAction: async () => {
        await workspaceManager.createWorkspace({ name: 'Test' })
        const workspaces = await workspaceManager.getAllWorkspaces()
        return workspaces
      },
      validation: (result) => Array.isArray(result) || result === null,
      cleanup: () => errorSimulator.restore('indexedDB-get', indexedDBService)
    },
    {
      name: 'IPC Communication Timeout',
      error: () => errorSimulator.simulateIPCTimeout(workspaceManager),
      expectedRecovery: 'offline mode with retry',
      testAction: async () => {
        const result = await workspaceManager.saveCurrentState()
        return result
      },
      validation: (result) => result === null || result.offline === true,
      cleanup: () => errorSimulator.restore('ipc-send', workspaceManager)
    },
    {
      name: 'Migration Data Corruption',
      error: () => errorSimulator.corruptMigrationData(indexedDBService),
      expectedRecovery: 'automatic rollback',
      testAction: async () => {
        const migrated = await workspaceManager.migrateFromLegacyConfig({
          language: 'en',
          model: 'small'
        })
        return migrated
      },
      validation: (result) => result && (result.workspaces || result.rollback === true),
      cleanup: () => errorSimulator.restore('migration-get', indexedDBService)
    },
    {
      name: 'Network Connectivity Loss',
      error: () => errorSimulator.simulateNetworkError(),
      expectedRecovery: 'offline mode operation',
      testAction: async () => {
        // This would typically involve external API calls
        const workspace = await workspaceManager.createWorkspace({
          name: 'Network Test',
          description: 'Testing network failure recovery'
        })
        return workspace
      },
      validation: (result) => result && result.id,
      cleanup: () => errorSimulator.restore('fetch', null)
    },
    {
      name: 'Memory Pressure',
      error: () => errorSimulator.simulateMemoryPressure(),
      expectedRecovery: 'memory optimization',
      testAction: async () => {
        // Create multiple workspaces under memory pressure
        const workspaces = []
        for (let i = 0; i < 5; i++) {
          const workspace = await workspaceManager.createWorkspace({
            name: `Memory Test ${i + 1}`,
            description: `Testing under memory pressure ${i + 1}`
          })
          workspaces.push(workspace)
        }
        return workspaces
      },
      validation: (result) => Array.isArray(result) && result.length > 0
    }
  ]

  async function runErrorRecoveryTest(scenario: ErrorScenario): Promise<RecoveryTestResult> {
    const startTime = performance.now()
    
    try {
      // Apply error simulation
      await scenario.error()
      
      // Execute test action
      const result = await scenario.testAction()
      const duration = performance.now() - startTime
      
      // Validate recovery
      const recoverySuccessful = scenario.validation(result)
      
      // Cleanup if provided
      if (scenario.cleanup) {
        await scenario.cleanup()
      }
      
      return {
        scenario: scenario.name,
        success: recoverySuccessful,
        recoveryStrategy: scenario.expectedRecovery,
        duration
      }
      
    } catch (error) {
      const duration = performance.now() - startTime
      
      // Check if error was handled gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const gracefulFailure = errorMessage.includes('fallback') || 
                             errorMessage.includes('offline') || 
                             errorMessage.includes('retry')
      
      // Cleanup if provided
      if (scenario.cleanup) {
        await scenario.cleanup()
      }
      
      return {
        scenario: scenario.name,
        success: gracefulFailure,
        recoveryStrategy: scenario.expectedRecovery,
        duration,
        error: errorMessage
      }
    }
  }

  describe('Individual Error Recovery Scenarios', () => {
    errorScenarios.forEach(scenario => {
      it(`should recover from ${scenario.name}`, async () => {
        const result = await runErrorRecoveryTest(scenario)
        
        console.log(`${scenario.name} Results:`)
        console.log(`  Success: ${result.success}`)
        console.log(`  Recovery Strategy: ${result.recoveryStrategy}`)
        console.log(`  Duration: ${result.duration.toFixed(2)}ms`)
        if (result.error) {
          console.log(`  Error: ${result.error}`)
        }
        
        expect(result.success).toBe(true)
        expect(result.duration).toBeLessThan(10000) // Recovery under 10s
        
      }, 15000) // 15 second timeout per scenario
    })
  })

  describe('Cascading Failure Recovery', () => {
    it('should handle multiple simultaneous failures', async () => {
      // Simulate multiple failures at once
      errorSimulator.simulateIndexedDBError('QuotaExceededError', indexedDBService)
      errorSimulator.simulateIPCTimeout(workspaceManager)
      errorSimulator.simulateNetworkError()
      
      const startTime = performance.now()
      
      try {
        // Try to perform normal operations
        const workspace = await workspaceManager.createWorkspace({
          name: 'Cascading Failure Test',
          description: 'Testing multiple simultaneous failures'
        })
        
        await appStore.updateConfig({ language: 'en', model: 'small' })
        await workspaceManager.saveCurrentState()
        
        const duration = performance.now() - startTime
        
        console.log('Cascading Failure Results:')
        console.log(`  Duration: ${duration.toFixed(2)}ms`)
        console.log(`  Workspace created: ${!!workspace}`)
        
        // Should either succeed with fallbacks or fail gracefully
        expect(duration).toBeLessThan(15000) // Under 15s
        
      } catch (error) {
        const duration = performance.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        console.log('Cascading Failure Error:')
        console.log(`  Duration: ${duration.toFixed(2)}ms`)
        console.log(`  Error: ${errorMessage}`)
        
        // Should fail gracefully with meaningful error
        expect(errorMessage).toMatch(/(fallback|offline|retry|timeout)/i)
        expect(duration).toBeLessThan(15000)
      }
      
    }, 20000) // 20 second timeout
  })

  describe('Recovery Performance Validation', () => {
    it('should recover within acceptable time limits', async () => {
      const recoveryTimes: number[] = []
      
      for (const scenario of errorScenarios) {
        const result = await runErrorRecoveryTest(scenario)
        if (result.success) {
          recoveryTimes.push(result.duration)
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const avgRecoveryTime = recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length
      const maxRecoveryTime = Math.max(...recoveryTimes)
      
      console.log('Recovery Performance Summary:')
      console.log(`  Successful recoveries: ${recoveryTimes.length}/${errorScenarios.length}`)
      console.log(`  Average recovery time: ${avgRecoveryTime.toFixed(2)}ms`)
      console.log(`  Maximum recovery time: ${maxRecoveryTime.toFixed(2)}ms`)
      
      expect(recoveryTimes.length).toBeGreaterThanOrEqual(errorScenarios.length * 0.8) // 80% success rate
      expect(avgRecoveryTime).toBeLessThan(5000) // Average under 5s
      expect(maxRecoveryTime).toBeLessThan(15000) // Max under 15s
      
    }, 60000) // 60 second timeout for all scenarios
  })

  describe('State Consistency After Recovery', () => {
    it('should maintain data consistency after error recovery', async () => {
      // Create initial data
      const initialWorkspace = await workspaceManager.createWorkspace({
        name: 'Consistency Test',
        description: 'Testing data consistency after recovery',
        appConfig: {
          language: 'en',
          model: 'medium',
          priority: 'balanced'
        }
      })
      
      await appStore.updateConfig({ priority: 'quality', useGPU: true })
      await workspaceManager.saveCurrentState()
      
      // Simulate error and recovery
      errorSimulator.simulateIndexedDBError('InvalidStateError', indexedDBService)
      
      try {
        // Try to modify data during error condition
        await appStore.updateConfig({ language: 'zh' })
        await workspaceManager.saveCurrentState()
      } catch (error) {
        console.log('Expected error during consistency test:', error)
      }
      
      // Restore normal operation
      errorSimulator.restore('indexedDB-get', indexedDBService)
      
      // Verify data consistency
      const currentWorkspace = await workspaceManager.getCurrentWorkspace()
      const currentConfig = await appStore.getConfig()
      
      console.log('Consistency Test Results:')
      console.log('Current workspace:', currentWorkspace)
      console.log('Current config:', currentConfig)
      
      // Data should be consistent (either original or properly updated)
      expect(currentWorkspace).toBeTruthy()
      expect(currentWorkspace?.name).toBe('Consistency Test')
      expect(['quality', 'balanced']).toContain(currentConfig.priority)
      expect(['en', 'zh']).toContain(currentConfig.language)
      
    }, 15000) // 15 second timeout
  })

  describe('User Experience During Errors', () => {
    it('should provide clear error messages and recovery options', async () => {
      const errorMessages: string[] = []
      
      // Mock console to capture error messages
      const originalError = console.error
      console.error = jest.fn((...args) => {
        errorMessages.push(args.map(arg => String(arg)).join(' '))
      })
      
      try {
        // Simulate various errors and check messages
        for (const scenario of errorScenarios.slice(0, 3)) { // Test first 3 scenarios
          try {
            await runErrorRecoveryTest(scenario)
          } catch (error) {
            // Expected errors for UX testing
          }
        }
        
        console.log('Error Messages Captured:')
        errorMessages.forEach((msg, i) => {
          console.log(`  ${i + 1}: ${msg}`)
        })
        
        // Should have captured meaningful error messages
        expect(errorMessages.length).toBeGreaterThan(0)
        
        // Messages should be user-friendly
        const hasUserFriendlyMessages = errorMessages.some(msg => 
          msg.includes('fallback') || 
          msg.includes('retry') || 
          msg.includes('offline') ||
          msg.includes('recovery')
        )
        
        expect(hasUserFriendlyMessages).toBe(true)
        
      } finally {
        console.error = originalError
      }
      
    }, 25000) // 25 second timeout
  })
})