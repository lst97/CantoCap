/**
 * Comprehensive Test Suite for WorkflowStateManager
 * Tests all state transitions, edge cases, performance, and integration scenarios
 * Covers: State transitions, atomic operations, persistence, React integration, error handling
 */

import { jest } from '@jest/globals'
import { WorkflowStateManager } from '../workflow/workflow-state-manager'
import {
  StepState,
  StepId,
  createStepId,
  createTimestamp,
  createVersion,
  WorkflowStateManagerConfig,
  StateChangeEvent,
  BatchStateOperation,
  WORKFLOW_CONSTANTS
} from '../../types/workflow-state'

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000
  }
} as any

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16)
  return 1
})

// Mock setTimeout/clearTimeout for debouncing tests
jest.useFakeTimers()

describe('WorkflowStateManager - Core Functionality', () => {
  let manager: WorkflowStateManager
  let mockPersistence: any
  let stateChangeEvents: StateChangeEvent[] = []

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    stateChangeEvents = []
    
    // Create mock persistence
    mockPersistence = {
      saveState: jest.fn().mockResolvedValue(undefined),
      loadState: jest.fn().mockResolvedValue(null),
      clearState: jest.fn().mockResolvedValue(undefined),
      hasStoredState: jest.fn().mockResolvedValue(false),
      getStorageInfo: jest.fn().mockResolvedValue({ size: 0, lastModified: Date.now() })
    }

    // Create manager with test config
    manager = new WorkflowStateManager({
      strictValidation: true,
      enableLogging: false,
      maxHistoryEntries: 10,
      persistence: mockPersistence
    })

    // Subscribe to state changes for testing
    manager.subscribe((event) => {
      stateChangeEvents.push(event)
    })

    jest.runOnlyPendingTimers()
  })

  afterEach(() => {
    manager.destroy()
    jest.runOnlyPendingTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default steps in correct states', () => {
      const steps = manager.getAllSteps()
      
      expect(steps.size).toBe(5)
      
      // Check initial states
      expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      expect(manager.getStepState('config')).toBe(StepState.Blocked)
      expect(manager.getStepState('processing')).toBe(StepState.Blocked)
      expect(manager.getStepState('review')).toBe(StepState.Blocked)
      expect(manager.getStepState('export')).toBe(StepState.Blocked)
    })

    it('should set current step to input-file initially', () => {
      expect(manager.getCurrentStep()).toBe(createStepId('input-file'))
    })

    it('should have empty state history initially', () => {
      expect(manager.getStateHistory()).toHaveLength(0)
    })
  })

  describe('State Transition Validation', () => {
    describe('Valid Transitions', () => {
      it('should allow Ready → Complete transition', async () => {
        const result = await manager.transitionState('input-file', StepState.Complete)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Complete)
      })

      it('should allow Ready → Error transition', async () => {
        const result = await manager.transitionState('input-file', StepState.Error, {
          message: 'Test error',
          reason: 'Test failure'
        })
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Error)
      })

      it('should allow Ready → Warning transition', async () => {
        const result = await manager.transitionState('input-file', StepState.Warning, {
          message: 'Test warning'
        })
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Warning)
      })

      it('should allow Ready → Blocked transition', async () => {
        const result = await manager.transitionState('input-file', StepState.Blocked)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Blocked)
      })

      it('should allow Ready → Skip transition', async () => {
        const result = await manager.transitionState('input-file', StepState.Skip)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Skip)
      })

      it('should allow Complete → Ready transition', async () => {
        await manager.transitionState('input-file', StepState.Complete)
        const result = await manager.transitionState('input-file', StepState.Ready)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      })

      it('should allow Error → Ready transition', async () => {
        await manager.transitionState('input-file', StepState.Error)
        const result = await manager.transitionState('input-file', StepState.Ready)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      })

      it('should allow Warning → Complete transition', async () => {
        await manager.transitionState('input-file', StepState.Warning)
        const result = await manager.transitionState('input-file', StepState.Complete)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Complete)
      })

      it('should allow Skip → Ready transition', async () => {
        await manager.transitionState('input-file', StepState.Skip)
        const result = await manager.transitionState('input-file', StepState.Ready)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      })

      it('should allow Blocked → Ready transition', async () => {
        const result = await manager.transitionState('config', StepState.Ready)
        
        expect(result.success).toBe(true)
        expect(manager.getStepState('config')).toBe(StepState.Ready)
      })
    })

    describe('Invalid Transitions', () => {
      it('should reject Complete → Blocked transition', async () => {
        await manager.transitionState('input-file', StepState.Complete)
        const result = await manager.transitionState('input-file', StepState.Blocked)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid transition')
        expect(result.errorCode).toBe(WORKFLOW_CONSTANTS.ERROR_CODES.INVALID_TRANSITION)
      })

      it('should reject Skip → Complete transition', async () => {
        await manager.transitionState('input-file', StepState.Skip)
        const result = await manager.transitionState('input-file', StepState.Complete)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid transition')
      })

      it('should reject Error → Complete transition', async () => {
        await manager.transitionState('input-file', StepState.Error)
        const result = await manager.transitionState('input-file', StepState.Complete)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid transition')
      })

      it('should reject Blocked → Complete transition', async () => {
        const result = await manager.transitionState('config', StepState.Complete)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid transition')
      })
    })

    describe('Transition Validation Edge Cases', () => {
      it('should reject transition to invalid state', async () => {
        const result = await manager.transitionState('input-file', 'invalid-state' as any)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid target state')
      })

      it('should reject transition for non-existent step', async () => {
        const result = await manager.transitionState('non-existent-step', StepState.Complete)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Step not found')
      })

      it('should reject transition with invalid step ID format', async () => {
        const result = await manager.transitionState('Invalid Step ID!', StepState.Complete)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid step ID format')
      })
    })
  })

  describe('Dependent Step Management', () => {
    it('should unblock next step when current step completes', async () => {
      await manager.transitionState('input-file', StepState.Complete)
      
      // Config step should be unblocked
      expect(manager.getStepState('config')).toBe(StepState.Ready)
      
      // Other steps should remain blocked
      expect(manager.getStepState('processing')).toBe(StepState.Blocked)
      expect(manager.getStepState('review')).toBe(StepState.Blocked)
      expect(manager.getStepState('export')).toBe(StepState.Blocked)
    })

    it('should handle sequential step completion', async () => {
      // Complete input-file
      await manager.transitionState('input-file', StepState.Complete)
      expect(manager.getStepState('config')).toBe(StepState.Ready)
      
      // Complete config
      await manager.transitionState('config', StepState.Complete)
      expect(manager.getStepState('processing')).toBe(StepState.Ready)
      
      // Complete processing
      await manager.transitionState('processing', StepState.Complete)
      expect(manager.getStepState('review')).toBe(StepState.Ready)
      
      // Complete review
      await manager.transitionState('review', StepState.Complete)
      expect(manager.getStepState('export')).toBe(StepState.Ready)
    })

    it('should block subsequent steps when step is reset', async () => {
      // First complete all steps
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('config', StepState.Complete)
      await manager.transitionState('processing', StepState.Complete)
      await manager.transitionState('review', StepState.Complete)
      
      // Reset config step
      await manager.transitionState('config', StepState.Ready)
      
      // Subsequent steps should be blocked
      expect(manager.getStepState('processing')).toBe(StepState.Blocked)
      expect(manager.getStepState('review')).toBe(StepState.Blocked)
      expect(manager.getStepState('export')).toBe(StepState.Blocked)
      
      // Input-file should remain complete
      expect(manager.getStepState('input-file')).toBe(StepState.Complete)
    })
  })

  describe('Atomic Operations and Rollback', () => {
    it('should provide rollback function for successful transitions', async () => {
      const originalState = manager.getStepState('input-file')
      const result = await manager.transitionState('input-file', StepState.Complete)
      
      expect(result.success).toBe(true)
      expect(result.rollback).toBeDefined()
      
      // Execute rollback
      if (result.rollback) {
        await result.rollback()
        expect(manager.getStepState('input-file')).toBe(originalState)
      }
    })

    it('should handle rollback with proper state restoration', async () => {
      const originalStep = manager.getStep('input-file')
      
      await manager.transitionState('input-file', StepState.Complete, {
        message: 'Completed successfully'
      })
      
      const result = await manager.transitionState('input-file', StepState.Error, {
        message: 'Test error',
        reason: 'Testing rollback'
      })
      
      // Rollback to Complete state
      if (result.rollback) {
        await result.rollback()
        
        const restoredStep = manager.getStep('input-file')
        expect(restoredStep?.stateMetadata.state).toBe(StepState.Complete)
        expect(restoredStep?.stateMetadata.message).toBe('Completed successfully')
      }
    })

    it('should emit rollback events to observers', async () => {
      stateChangeEvents = []
      
      const result = await manager.transitionState('input-file', StepState.Complete)
      expect(stateChangeEvents).toHaveLength(1)
      
      if (result.rollback) {
        await result.rollback()
        expect(stateChangeEvents).toHaveLength(2)
        
        const rollbackEvent = stateChangeEvents[1]
        expect(rollbackEvent.oldState).toBe(StepState.Complete)
        expect(rollbackEvent.newState).toBe(StepState.Ready)
      }
    })
  })

  describe('Batch Operations', () => {
    it('should execute batch transitions successfully', async () => {
      const operations: BatchStateOperation[] = [
        { stepId: createStepId('input-file'), newState: StepState.Complete },
        { stepId: createStepId('config'), newState: StepState.Ready },
        { stepId: createStepId('processing'), newState: StepState.Ready }
      ]
      
      const result = await manager.batchTransition(operations)
      
      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(3)
      expect(result.results.every(r => r.success)).toBe(true)
      
      expect(manager.getStepState('input-file')).toBe(StepState.Complete)
      expect(manager.getStepState('config')).toBe(StepState.Ready)
      expect(manager.getStepState('processing')).toBe(StepState.Ready)
    })

    it('should rollback all operations if one fails', async () => {
      const operations: BatchStateOperation[] = [
        { stepId: createStepId('input-file'), newState: StepState.Complete },
        { stepId: createStepId('config'), newState: StepState.Complete }, // Invalid transition
        { stepId: createStepId('processing'), newState: StepState.Ready }
      ]
      
      const result = await manager.batchTransition(operations)
      
      expect(result.success).toBe(false)
      
      // All states should remain unchanged
      expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      expect(manager.getStepState('config')).toBe(StepState.Blocked)
      expect(manager.getStepState('processing')).toBe(StepState.Blocked)
    })

    it('should provide batch rollback functionality', async () => {
      const operations: BatchStateOperation[] = [
        { stepId: createStepId('input-file'), newState: StepState.Complete },
        { stepId: createStepId('config'), newState: StepState.Ready }
      ]
      
      const result = await manager.batchTransition(operations)
      expect(result.success).toBe(true)
      
      // Execute batch rollback
      if (result.rollback) {
        await result.rollback()
        
        expect(manager.getStepState('input-file')).toBe(StepState.Ready)
        expect(manager.getStepState('config')).toBe(StepState.Blocked)
      }
    })
  })

  describe('Performance and Caching', () => {
    it('should cache validation results for performance', async () => {
      const startTime = performance.now()
      
      // First transition (should compute validation)
      await manager.transitionState('input-file', StepState.Complete)
      
      // Reset to ready
      await manager.transitionState('input-file', StepState.Ready)
      
      // Second identical transition (should use cache)
      await manager.transitionState('input-file', StepState.Complete)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete quickly due to caching
      expect(duration).toBeLessThan(100) // 100ms threshold
    })

    it('should invalidate caches when state changes', async () => {
      // Get initial state to populate cache
      const state1 = manager.getStepState('input-file')
      expect(state1).toBe(StepState.Ready)
      
      // Change state
      await manager.transitionState('input-file', StepState.Complete)
      
      // Get state again (should reflect new state, not cached)
      const state2 = manager.getStepState('input-file')
      expect(state2).toBe(StepState.Complete)
    })

    it('should maintain accessibility cache', () => {
      // Test accessibility caching
      const accessible1 = manager.isStepAccessible('input-file')
      const accessible2 = manager.isStepAccessible('input-file')
      
      expect(accessible1).toBe(true)
      expect(accessible2).toBe(true)
    })

    it('should provide performance metrics', () => {
      const metrics = manager.getPerformanceMetrics()
      
      expect(metrics).toHaveProperty('stateTransitionTime')
      expect(metrics).toHaveProperty('notificationTime')
      expect(metrics).toHaveProperty('cacheHitRate')
      expect(metrics).toHaveProperty('memoryUsage')
      expect(metrics).toHaveProperty('observerCount')
      expect(metrics).toHaveProperty('rerenderCount')
    })
  })

  describe('State Persistence', () => {
    it('should save state to persistence', async () => {
      await manager.transitionState('input-file', StepState.Complete)
      await manager.saveState()
      
      expect(mockPersistence.saveState).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStepId: expect.any(String),
          steps: expect.any(Object),
          timestamp: expect.any(Number),
          version: expect.any(String)
        })
      )
    })

    it('should load state from persistence', async () => {
      const mockSnapshot = {
        currentStepId: createStepId('config'),
        steps: {
          [createStepId('input-file')]: {
            id: createStepId('input-file'),
            title: 'Input File',
            description: 'Test',
            stateMetadata: {
              state: StepState.Complete,
              lastModified: createTimestamp(),
              reason: 'Loaded from persistence'
            }
          }
        },
        timestamp: createTimestamp(),
        version: createVersion('2.0.0')
      }
      
      mockPersistence.loadState.mockResolvedValue(mockSnapshot)
      
      const result = await manager.loadState()
      
      expect(result).toBe(true)
      expect(manager.getCurrentStep()).toBe(createStepId('config'))
    })

    it('should handle persistence errors gracefully', async () => {
      mockPersistence.saveState.mockRejectedValue(new Error('Storage full'))
      
      await expect(manager.saveState()).rejects.toThrow('Storage full')
    })

    it('should return false when no state to load', async () => {
      mockPersistence.loadState.mockResolvedValue(null)
      
      const result = await manager.loadState()
      expect(result).toBe(false)
    })
  })

  describe('Observer Pattern and Notifications', () => {
    it('should notify observers of state changes', async () => {
      stateChangeEvents = []
      
      await manager.transitionState('input-file', StepState.Complete, {
        message: 'Test completion'
      })
      
      expect(stateChangeEvents).toHaveLength(1)
      
      const event = stateChangeEvents[0]
      expect(event.stepId).toBe(createStepId('input-file'))
      expect(event.oldState).toBe(StepState.Ready)
      expect(event.newState).toBe(StepState.Complete)
      expect(event.metadata.message).toBe('Test completion')
    })

    it('should support step-specific subscriptions', async () => {
      const inputFileEvents: StateChangeEvent[] = []
      const configEvents: StateChangeEvent[] = []
      
      const unsubscribeInput = manager.subscribe((event) => {
        inputFileEvents.push(event)
      }, createStepId('input-file'))
      
      const unsubscribeConfig = manager.subscribe((event) => {
        configEvents.push(event)
      }, createStepId('config'))
      
      await manager.transitionState('input-file', StepState.Complete)
      
      expect(inputFileEvents).toHaveLength(1)
      expect(configEvents).toHaveLength(0)
      
      unsubscribeInput()
      unsubscribeConfig()
    })

    it('should debounce notifications for performance', async () => {
      stateChangeEvents = []
      
      // Make rapid state changes
      manager.transitionState('input-file', StepState.Complete)
      manager.transitionState('config', StepState.Ready)
      manager.transitionState('processing', StepState.Ready)
      
      // Advance timers to trigger debounced notifications
      jest.advanceTimersByTime(20)
      
      // Should have received batched notifications
      expect(stateChangeEvents.length).toBeGreaterThan(0)
    })

    it('should handle observer errors gracefully', async () => {
      const errorObserver = jest.fn(() => {
        throw new Error('Observer error')
      })
      
      manager.subscribe(errorObserver)
      
      // Should not throw despite observer error
      await expect(manager.transitionState('input-file', StepState.Complete))
        .resolves.toHaveProperty('success', true)
    })

    it('should clean up observers on unsubscribe', () => {
      const observer = jest.fn()
      const unsubscribe = manager.subscribe(observer)
      
      expect(manager.getPerformanceMetrics().observerCount).toBeGreaterThan(0)
      
      unsubscribe()
      
      // Observer count should be reduced (note: may not be 0 due to global observers)
      expect(manager.getPerformanceMetrics().observerCount).toBeLessThanOrEqual(1)
    })
  })

  describe('State History Management', () => {
    it('should maintain state change history', async () => {
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('input-file', StepState.Ready)
      
      const history = manager.getStateHistory()
      
      expect(history).toHaveLength(2)
      expect(history[0].oldState).toBe(StepState.Ready)
      expect(history[0].newState).toBe(StepState.Complete)
      expect(history[1].oldState).toBe(StepState.Complete)
      expect(history[1].newState).toBe(StepState.Ready)
    })

    it('should limit history entries to configured maximum', async () => {
      // Make more transitions than the limit (10)
      for (let i = 0; i < 15; i++) {
        const state = i % 2 === 0 ? StepState.Complete : StepState.Ready
        await manager.transitionState('input-file', state)
      }
      
      const history = manager.getStateHistory()
      expect(history).toHaveLength(10) // Should be limited to maxHistoryEntries
    })
  })

  describe('Utility Methods', () => {
    it('should provide type-safe step state checkers', async () => {
      expect(manager.isStepReady('input-file')).toBe(true)
      expect(manager.isStepComplete('input-file')).toBe(false)
      expect(manager.isStepBlocked('input-file')).toBe(false)
      expect(manager.isStepError('input-file')).toBe(false)
      expect(manager.isStepSkipped('input-file')).toBe(false)
      expect(manager.hasStepWarning('input-file')).toBe(false)
      
      await manager.transitionState('input-file', StepState.Complete)
      
      expect(manager.isStepReady('input-file')).toBe(false)
      expect(manager.isStepComplete('input-file')).toBe(true)
    })

    it('should get typed step data', async () => {
      await manager.transitionState('input-file', StepState.Complete)
      
      const completeStep = manager.getTypedStep('input-file', StepState.Complete)
      const readyStep = manager.getTypedStep('input-file', StepState.Ready)
      
      expect(completeStep).not.toBeNull()
      expect(readyStep).toBeNull()
    })

    it('should get steps with specific state', async () => {
      await manager.transitionState('input-file', StepState.Complete)
      
      const completeSteps = manager.getStepsWithState(StepState.Complete)
      const blockedSteps = manager.getStepsWithState(StepState.Blocked)
      
      expect(completeSteps).toHaveLength(1)
      expect(blockedSteps).toHaveLength(4) // config, processing, review, export
    })

    it('should handle current step navigation', () => {
      expect(manager.getCurrentStep()).toBe(createStepId('input-file'))
      
      const success = manager.setCurrentStep('config')
      expect(success).toBe(true)
      expect(manager.getCurrentStep()).toBe(createStepId('config'))
      
      const failure = manager.setCurrentStep('invalid-step')
      expect(failure).toBe(false)
    })
  })

  describe('Reset and Cleanup', () => {
    it('should reset workflow to initial state', async () => {
      // Make some changes
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('config', StepState.Ready)
      
      manager.reset()
      
      // Should be back to initial state
      expect(manager.getCurrentStep()).toBe(createStepId('input-file'))
      expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      expect(manager.getStepState('config')).toBe(StepState.Blocked)
      expect(manager.getStateHistory()).toHaveLength(0)
    })

    it('should clear caches on reset', async () => {
      // Populate caches
      manager.getStepState('input-file')
      manager.isStepAccessible('input-file')
      
      manager.reset()
      
      // Caches should be cleared (verified by checking cache hit rate resets)
      const metrics = manager.getPerformanceMetrics()
      expect(metrics.cacheHitRate).toBe(0)
    })

    it('should cleanup resources on destroy', () => {
      const initialObserverCount = manager.getPerformanceMetrics().observerCount
      
      manager.destroy()
      
      // Should clean up observers and resources
      expect(() => manager.getPerformanceMetrics().observerCount).not.toThrow()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent state transitions safely', async () => {
      // Attempt concurrent transitions
      const promises = [
        manager.transitionState('input-file', StepState.Complete),
        manager.transitionState('input-file', StepState.Error),
        manager.transitionState('input-file', StepState.Warning)
      ]
      
      const results = await Promise.all(promises)
      
      // Only one should succeed (the first one processed)
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBe(1)
    })

    it('should handle malformed step IDs gracefully', async () => {
      const result = await manager.transitionState('', StepState.Complete)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid step ID format')
    })

    it('should handle undefined/null parameters', async () => {
      const result = await manager.transitionState(null as any, StepState.Complete)
      
      expect(result.success).toBe(false)
    })

    it('should validate step ID creation', () => {
      expect(() => createStepId('valid-step-id')).not.toThrow()
      expect(() => createStepId('Invalid Step!')).toThrow('Invalid step ID format')
      expect(() => createStepId('')).toThrow('Invalid step ID format')
    })
  })
})