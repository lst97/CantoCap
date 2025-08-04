/**
 * Electron State Management Integration Tests
 * Comprehensive testing suite for Electron-specific state management features
 * 
 * Test Categories:
 * - Cross-platform compatibility
 * - IPC communication integrity
 * - State persistence in Electron context
 * - Performance validation
 * - Security context verification
 * - Process isolation compatibility
 */

import { jest } from '@jest/globals'
import { 
  ElectronStateBridge,
  ElectronIPCBridge,
  ElectronPathUtils,
  ElectronDebugCollector
} from '../../services/electron-state-bridge'
import { 
  ElectronStateValidator,
  validateElectronState,
  validateElectronStateChange
} from '../../utils/electron-state-validation'
import {
  StepState,
  createStepId,
  createTimestamp,
  createVersion,
  createWorkflowStateSnapshot,
  StateChangeEvent
} from '../../types/workflow-state'

// Mock Electron APIs
const mockElectronAPI = {
  getPlatform: jest.fn(),
  getAppVersion: jest.fn(),
  getConfig: jest.fn(),
  setConfig: jest.fn(),
  openDevTools: jest.fn(),
  removeAllListeners: jest.fn()
}

const mockCantocapAPI = {
  ...mockElectronAPI
}

// Setup global mocks
Object.defineProperty(global, 'window', {
  value: {
    electronAPI: mockElectronAPI,
    cantocapAPI: mockCantocapAPI,
    performance: {
      now: jest.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 60 * 1024 * 1024, // 60MB
        jsHeapSizeLimit: 2048 * 1024 * 1024 // 2GB
      }
    }
  },
  writable: true
})

Object.defineProperty(global, 'process', {
  value: {
    platform: 'darwin',
    pid: 12345,
    contextIsolated: true,
    nodeIntegration: false
  },
  writable: true
})

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2))
  },
  writable: true
})

// Also setup window.crypto for browser environment
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2))
  },
  writable: true
})

describe('Electron State Management Integration', () => {
  let bridge: ElectronStateBridge
  let validator: ElectronStateValidator

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup default mock responses
    mockElectronAPI.getPlatform.mockResolvedValue('darwin')
    mockElectronAPI.getAppVersion.mockResolvedValue('1.0.0-test')
    mockElectronAPI.getConfig.mockResolvedValue({})
    mockElectronAPI.setConfig.mockResolvedValue(undefined)

    // Get instances
    bridge = ElectronStateBridge.getInstance()
    validator = ElectronStateValidator.getInstance()
  })

  afterEach(() => {
    // Clear caches
    validator.clearCache()
  })

  describe('ElectronStateBridge', () => {
    test('should initialize successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      await bridge.initialize()
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Electron State Bridge initialized'))
      
      consoleSpy.mockRestore()
    })

    test('should handle IPC communication errors gracefully', async () => {
      mockElectronAPI.getPlatform.mockRejectedValue(new Error('IPC Error'))
      
      const envInfo = await bridge.getElectronEnvironmentInfo()
      
      expect(envInfo).toHaveProperty('error')
      expect(envInfo.error).toContain('Failed to collect environment info')
    })

    test('should persist state with Electron metadata', async () => {
      const snapshot = createWorkflowStateSnapshot(
        createStepId('test-step'),
        {
          'test-step': {
            id: createStepId('test-step'),
            title: 'Test Step',
            description: 'Test Description',
            stateMetadata: {
              state: StepState.Ready,
              lastModified: createTimestamp(),
              reason: 'test'
            }
          }
        }
      )

      mockElectronAPI.setConfig.mockResolvedValue(true)

      const result = await bridge.persistState(snapshot, 'test-workspace')

      expect(result).toBe(true)
      expect(mockElectronAPI.setConfig).toHaveBeenCalledWith({
        section: 'workflowState',
        value: expect.objectContaining({
          electronMetadata: expect.objectContaining({
            platform: 'darwin',
            appVersion: '1.0.0-test',
            processId: expect.stringContaining('renderer-')
          })
        })
      })
    })

    test('should load state with validation', async () => {
      const mockSavedState = {
        currentStepId: createStepId('test-step'),
        steps: {
          'test-step': {
            id: createStepId('test-step'),
            title: 'Test Step',
            description: 'Test Description',
            stateMetadata: {
              state: StepState.Complete,
              lastModified: createTimestamp()
            }
          }
        },
        timestamp: createTimestamp(),
        version: createVersion('2.0.0'),
        electronMetadata: {
          platform: 'darwin',
          appVersion: '1.0.0-test'
        }
      }

      mockElectronAPI.getConfig.mockResolvedValue({
        workflowState: mockSavedState
      })

      const result = await bridge.loadState('test-workspace')

      expect(result).toMatchObject({
        currentStepId: expect.any(String),
        steps: expect.any(Object),
        electronMetadata: expect.objectContaining({
          platform: 'darwin'
        })
      })
    })

    test('should handle platform mismatch warnings', async () => {
      const mockSavedState = {
        electronMetadata: {
          platform: 'win32', // Different from current platform
          appVersion: '1.0.0-test'
        }
      }

      mockElectronAPI.getConfig.mockResolvedValue({
        workflowState: mockSavedState
      })

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      await bridge.loadState()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Platform mismatch')
      )

      consoleSpy.mockRestore()
    })

    test('should generate comprehensive debug report', async () => {
      const report = await bridge.generateDebugReport()
      const parsed = JSON.parse(report)

      expect(parsed).toHaveProperty('title', 'CantoCap Electron State Management Debug Report')
      expect(parsed).toHaveProperty('timestamp')
      expect(parsed).toHaveProperty('environment')
      expect(parsed).toHaveProperty('recommendations')
      expect(parsed.environment).toHaveProperty('electron')
      expect(parsed.environment).toHaveProperty('process')
    })
  })

  describe('ElectronPathUtils', () => {
    test('should detect platform correctly', async () => {
      const platform = await ElectronPathUtils.getPlatform()
      expect(platform).toBe('darwin')
      expect(mockElectronAPI.getPlatform).toHaveBeenCalled()
    })

    test('should normalize paths for different platforms', async () => {
      // Test Windows path normalization
      mockElectronAPI.getPlatform.mockResolvedValueOnce('win32')
      const winPath = await ElectronPathUtils.normalizePath('/some/unix/path')
      expect(winPath).toBe('\\some\\unix\\path')

      // Test Unix path normalization
      mockElectronAPI.getPlatform.mockResolvedValueOnce('darwin')
      const unixPath = await ElectronPathUtils.normalizePath('\\some\\windows\\path')
      expect(unixPath).toBe('/some/windows/path')
    })

    test('should detect sandboxed environment', () => {
      const isSandboxed = ElectronPathUtils.isSandboxed()
      expect(typeof isSandboxed).toBe('boolean')
    })

    test('should generate appropriate storage paths', async () => {
      const path = await ElectronPathUtils.getWorkflowStatePath('test-workspace')
      expect(path).toContain('CantoCap')
      expect(path).toContain('test-workspace')
      expect(path).toContain('workflow-state.json')
    })
  })

  describe('ElectronIPCBridge', () => {
    test('should check IPC health', async () => {
      mockElectronAPI.getPlatform.mockResolvedValue('darwin')
      
      const isHealthy = await ElectronIPCBridge.checkIPCHealth()
      
      expect(isHealthy).toBe(true)
      expect(mockElectronAPI.getPlatform).toHaveBeenCalled()
    })

    test('should handle IPC timeouts', async () => {
      mockElectronAPI.getPlatform.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
      )

      const result = await ElectronIPCBridge.safeIPCCall('getPlatform', undefined, 100) // 100ms timeout

      expect(result).toBeNull()
    })

    test('should retry failed IPC calls', async () => {
      let callCount = 0
      mockElectronAPI.getPlatform.mockImplementation(() => {
        callCount++
        if (callCount < 2) {
          throw new Error('IPC Error')
        }
        return Promise.resolve('darwin')
      })

      const result = await ElectronIPCBridge.safeIPCCall('getPlatform')

      expect(result).toBe('darwin')
      expect(callCount).toBe(2) // Should have retried once
    })
  })

  describe('ElectronDebugCollector', () => {
    test('should collect comprehensive environment info', async () => {
      const envInfo = await ElectronDebugCollector.collectEnvironmentInfo()

      expect(envInfo).toHaveProperty('electron')
      expect(envInfo).toHaveProperty('process')
      expect(envInfo).toHaveProperty('memory')
      expect(envInfo).toHaveProperty('session')
      expect(envInfo.electron).toHaveProperty('platform', 'darwin')
      expect(envInfo.process).toHaveProperty('type', 'renderer')
    })

    test('should record state changes', () => {
      const event: StateChangeEvent = {
        stepId: createStepId('test-step'),
        oldState: StepState.Ready,
        newState: StepState.Complete,
        metadata: {
          state: StepState.Complete,
          lastModified: createTimestamp()
        },
        timestamp: createTimestamp(),
        transitionKey: 'ready-to-complete',
        isValid: true
      }

      ElectronDebugCollector.recordStateChange(event)

      // Should not throw and should update internal state
      expect(() => ElectronDebugCollector.recordStateChange(event)).not.toThrow()
    })

    test('should record IPC calls', () => {
      ElectronDebugCollector.recordIPCCall('getPlatform', true, 15.5)
      
      // Should not throw
      expect(() => ElectronDebugCollector.recordIPCCall('getPlatform', true, 15.5)).not.toThrow()
    })

    test('should update performance metrics', () => {
      ElectronDebugCollector.updatePerformanceMetrics({
        stateTransitionTime: 25.5,
        ipcLatency: 10.2
      })

      // Should not throw
      expect(() => ElectronDebugCollector.updatePerformanceMetrics({
        stateTransitionTime: 25.5
      })).not.toThrow()
    })
  })

  describe('ElectronStateValidator', () => {
    test('should validate complete workflow state', async () => {
      const snapshot = createWorkflowStateSnapshot(
        createStepId('input-file'),
        {
          'input-file': {
            id: createStepId('input-file'),
            title: 'Input File',
            description: 'Select input file',
            stateMetadata: {
              state: StepState.Complete,
              lastModified: createTimestamp()
            }
          }
        }
      )

      const result = await validator.validateWorkflowState(snapshot)

      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('performance')
      expect(result).toHaveProperty('environment')
      expect(result.performance).toHaveProperty('validationTime')
      expect(typeof result.performance.validationTime).toBe('number')
    })

    test('should detect structural errors', async () => {
      const invalidSnapshot = createWorkflowStateSnapshot(
        '' as any, // Invalid step ID
        {}
      )

      const result = await validator.validateWorkflowState(invalidSnapshot)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MISSING_CURRENT_STEP'
          })
        ])
      )
    })

    test('should validate state changes', async () => {
      const validEvent: StateChangeEvent = {
        stepId: createStepId('input-file'),
        oldState: StepState.Ready,
        newState: StepState.Complete,
        metadata: {
          state: StepState.Complete,
          lastModified: createTimestamp()
        },
        timestamp: createTimestamp(),
        transitionKey: 'ready-to-complete',
        isValid: true
      }

      const result = await validator.validateStateChange(validEvent)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should detect invalid state transitions', async () => {
      const invalidEvent: StateChangeEvent = {
        stepId: createStepId('input-file'),
        oldState: StepState.Ready,
        newState: StepState.Complete,
        metadata: {
          state: StepState.Complete,
          lastModified: createTimestamp()
        },
        timestamp: createTimestamp(),
        transitionKey: 'ready-to-complete',
        isValid: false // Invalid transition
      }

      const result = await validator.validateStateChange(invalidEvent)

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_STATE_TRANSITION'
          })
        ])
      )
    })

    test('should detect high memory usage', async () => {
      // Mock high memory usage
      Object.defineProperty(window.performance, 'memory', {
        value: {
          usedJSHeapSize: 250 * 1024 * 1024, // 250MB (high)
          totalJSHeapSize: 300 * 1024 * 1024,
          jsHeapSizeLimit: 2048 * 1024 * 1024
        },
        writable: true
      })

      const snapshot = createWorkflowStateSnapshot(
        createStepId('test-step'),
        {
          'test-step': {
            id: createStepId('test-step'),
            title: 'Test',
            description: 'Test',
            stateMetadata: {
              state: StepState.Ready,
              lastModified: createTimestamp()
            }
          }
        }
      )

      const result = await validator.validateWorkflowState(snapshot)

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'HIGH_MEMORY_USAGE'
          })
        ])
      )
    })

    test('should use validation cache', async () => {
      const event: StateChangeEvent = {
        stepId: createStepId('test-step'),
        oldState: StepState.Ready,
        newState: StepState.Complete,
        metadata: {
          state: StepState.Complete,
          lastModified: createTimestamp()
        },
        timestamp: createTimestamp(),
        transitionKey: 'ready-to-complete',
        isValid: true
      }

      // First call
      const result1 = await validator.validateStateChange(event)
      
      // Second call should use cache
      const result2 = await validator.validateStateChange(event)

      expect(result1).toEqual(result2)
      // Performance should be faster on second call (cache hit)
      expect(result2.performance.validationTime).toBeLessThanOrEqual(result1.performance.validationTime)
    })

    test('should provide validation statistics', () => {
      const stats = validator.getValidationStats()

      expect(stats).toHaveProperty('cacheSize')
      expect(stats).toHaveProperty('cacheHitRate')
      expect(stats).toHaveProperty('totalValidations')
      expect(typeof stats.cacheSize).toBe('number')
    })

    test('should clear validation cache', () => {
      validator.clearCache()
      const stats = validator.getValidationStats()
      expect(stats.cacheSize).toBe(0)
    })
  })

  describe('Convenience Functions', () => {
    test('validateElectronState should work correctly', async () => {
      const snapshot = createWorkflowStateSnapshot(
        createStepId('input-file'),
        {
          'input-file': {
            id: createStepId('input-file'),
            title: 'Input File',
            description: 'Select input file',
            stateMetadata: {
              state: StepState.Ready,
              lastModified: createTimestamp()
            }
          }
        }
      )

      const result = await validateElectronState(snapshot)

      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
    })

    test('validateElectronStateChange should work correctly', async () => {
      const event: StateChangeEvent = {
        stepId: createStepId('input-file'),
        oldState: StepState.Ready,
        newState: StepState.Complete,
        metadata: {
          state: StepState.Complete,
          lastModified: createTimestamp()
        },
        timestamp: createTimestamp(),
        transitionKey: 'ready-to-complete',
        isValid: true
      }

      const result = await validateElectronStateChange(event)

      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('errors')
    })
  })

  describe('Error Handling', () => {
    test('should handle missing Electron API gracefully', async () => {
      // Temporarily remove Electron API
      const originalAPI = window.electronAPI
      delete (window as any).electronAPI
      delete (window as any).cantocapAPI

      const envInfo = await ElectronDebugCollector.collectEnvironmentInfo()

      expect(envInfo).toHaveProperty('error')

      // Restore API
      ;(window as any).electronAPI = originalAPI
    })

    test('should handle IPC failures gracefully', async () => {
      mockElectronAPI.getPlatform.mockRejectedValue(new Error('IPC Failed'))

      const result = await ElectronIPCBridge.safeIPCCall('getPlatform')

      expect(result).toBeNull()
    })

    test('should handle validation errors gracefully', async () => {
      // Create invalid snapshot
      const invalidSnapshot = {
        currentStepId: null,
        steps: null,
        timestamp: 'invalid',
        version: 'invalid'
      } as any

      const result = await validator.validateWorkflowState(invalidSnapshot)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    test('validation should complete within performance threshold', async () => {
      const snapshot = createWorkflowStateSnapshot(
        createStepId('input-file'),
        {
          'input-file': {
            id: createStepId('input-file'),
            title: 'Input File',
            description: 'Select input file',
            stateMetadata: {
              state: StepState.Ready,
              lastModified: createTimestamp()
            }
          }
        }
      )

      const startTime = performance.now()
      const result = await validator.validateWorkflowState(snapshot)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(100) // Should complete within 100ms
      expect(result.performance.validationTime).toBeLessThan(100)
    })

    test('should handle large state snapshots efficiently', async () => {
      // Create snapshot with many steps
      const steps: Record<string, any> = {}
      for (let i = 0; i < 50; i++) {
        const stepId = createStepId(`step-${i}`)
        steps[stepId] = {
          id: stepId,
          title: `Step ${i}`,
          description: `Description ${i}`,
          stateMetadata: {
            state: StepState.Ready,
            lastModified: createTimestamp()
          }
        }
      }

      const snapshot = createWorkflowStateSnapshot(createStepId('step-0'), steps)

      const startTime = performance.now()
      const result = await validator.validateWorkflowState(snapshot)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(200) // Should still be fast with many steps
      expect(result).toHaveProperty('isValid')
    })
  })

  describe('Cross-Platform Compatibility', () => {
    test('should handle Windows platform', async () => {
      mockElectronAPI.getPlatform.mockResolvedValue('win32')

      const platform = await ElectronPathUtils.getPlatform()
      expect(platform).toBe('win32')

      const normalizedPath = await ElectronPathUtils.normalizePath('/unix/path')
      expect(normalizedPath).toBe('\\unix\\path')
    })

    test('should handle Linux platform', async () => {
      mockElectronAPI.getPlatform.mockResolvedValue('linux')

      const platform = await ElectronPathUtils.getPlatform()
      expect(platform).toBe('linux')

      const normalizedPath = await ElectronPathUtils.normalizePath('\\windows\\path')
      expect(normalizedPath).toBe('/windows/path')
    })

    test('should detect cross-platform path issues', async () => {
      const snapshot = createWorkflowStateSnapshot(
        createStepId('input-file'),
        {
          'input-file': {
            id: createStepId('input-file'),
            title: 'Input File',
            description: 'Select input file',
            stateMetadata: {
              state: StepState.Ready,
              lastModified: createTimestamp()
            }
          }
        },
        {
          restorationContext: {
            isRestoring: false,
            restorationSource: 'manual',
            preserveCurrentStep: true,
            backupData: {
              filePath: 'C:\\Windows\\Path\\file.txt' // Windows path on non-Windows
            }
          }
        }
      )

      // Mock non-Windows platform
      mockElectronAPI.getPlatform.mockResolvedValue('darwin')

      const result = await validator.validateWorkflowState(snapshot)

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'CROSS_PLATFORM_PATH_ISSUE'
          })
        ])
      )
    })
  })
})

describe('Integration with Existing State Management', () => {
  test('should integrate with workflow state manager', async () => {
    // This test would verify integration with the main workflow state manager
    // For now, we'll test that the bridge can be initialized alongside other components
    
    const bridge = ElectronStateBridge.getInstance()
    await bridge.initialize()
    
    // Should not throw
    expect(bridge).toBeDefined()
  })

  test('should work with existing debugging infrastructure', () => {
    // Test integration with existing debug panel
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    ElectronDebugCollector.recordIPCCall('test-operation', true, 15)
    
    // Should not throw
    expect(() => ElectronDebugCollector.recordIPCCall('test-operation', true, 15)).not.toThrow()
    
    consoleSpy.mockRestore()
  })
})