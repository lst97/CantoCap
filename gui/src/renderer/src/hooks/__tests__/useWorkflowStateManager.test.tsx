/**
 * React Integration Tests for WorkflowStateManager Hooks
 * Tests React component integration, re-rendering behavior, and hook interactions
 */

import React from 'react'
import { renderHook, act, render, screen, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import {
  useWorkflowState,
  useStepState,
  useWorkflowNavigation,
  useStepTransitions,
  useStepValidation,
  useWorkflowControl
} from '../useWorkflowStateManager'
import { WorkflowStateManager } from '../../services/workflow/workflow-state-manager'
import {
  StepState,
  createStepId,
  StateChangeEvent
} from '../../types/workflow-state'

// Mock the WorkflowStateManager
const mockManager = {
  getAllSteps: jest.fn(),
  getCurrentStep: jest.fn(),
  getStep: jest.fn(),
  getStepState: jest.fn(),
  isStepAccessible: jest.fn(),
  setCurrentStep: jest.fn(),
  transitionState: jest.fn(),
  subscribe: jest.fn(),
  reset: jest.fn(),
  saveState: jest.fn(),
  loadState: jest.fn(),
  destroy: jest.fn()
}

// Mock the manager instance
jest.mock('../../services/workflow-state-manager', () => ({
  workflowStateManager: mockManager,
  getStepState: jest.fn(),
  isStepAccessible: jest.fn(),
  transitionStep: jest.fn()
}))

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
} as any

global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16)
  return 1
})

describe('WorkflowStateManager React Hooks', () => {
  const mockSteps = new Map([
    [createStepId('input-file'), {
      id: createStepId('input-file'),
      title: 'Input File',
      description: 'Upload media file',
      stateMetadata: {
        state: StepState.Ready,
        lastModified: Date.now(),
        reason: 'Initial state'
      }
    }],
    [createStepId('config'), {
      id: createStepId('config'),
      title: 'Configuration',
      description: 'Configure options',
      stateMetadata: {
        state: StepState.Blocked,
        lastModified: Date.now(),
        reason: 'Waiting for input'
      }
    }]
  ])

  let subscriberCallback: (event: StateChangeEvent) => void

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock returns
    mockManager.getAllSteps.mockReturnValue(mockSteps)
    mockManager.getCurrentStep.mockReturnValue(createStepId('input-file'))
    mockManager.getStep.mockImplementation((stepId) => mockSteps.get(stepId))
    mockManager.getStepState.mockImplementation((stepId) => mockSteps.get(stepId)?.stateMetadata.state)
    mockManager.isStepAccessible.mockImplementation((stepId) => {
      const state = mockSteps.get(stepId)?.stateMetadata.state
      return state === StepState.Ready || state === StepState.Complete
    })
    mockManager.setCurrentStep.mockReturnValue(true)
    mockManager.transitionState.mockResolvedValue({ success: true })
    mockManager.subscribe.mockImplementation((callback) => {
      subscriberCallback = callback
      return jest.fn() // unsubscribe function
    })
    mockManager.reset.mockImplementation(() => {})
    mockManager.saveState.mockResolvedValue(undefined)
    mockManager.loadState.mockResolvedValue(true)
  })

  describe('useWorkflowState Hook', () => {
    it('should return current workflow state', () => {
      const { result } = renderHook(() => useWorkflowState())
      
      expect(result.current.steps).toHaveLength(2)
      expect(result.current.currentStepId).toBe(createStepId('input-file'))
      expect(result.current.currentStep).toEqual(mockSteps.get(createStepId('input-file')))
      expect(result.current.allSteps).toBe(mockSteps)
    })

    it('should re-render when state changes', async () => {
      const { result, rerender } = renderHook(() => useWorkflowState())
      
      expect(result.current._updateCount).toBe(0)
      
      // Simulate state change
      act(() => {
        if (subscriberCallback) {
          subscriberCallback({
            stepId: createStepId('input-file'),
            oldState: StepState.Ready,
            newState: StepState.Complete,
            metadata: {
              state: StepState.Complete,
              lastModified: Date.now()
            },
            timestamp: Date.now(),
            transitionKey: 'ready-to-complete',
            isValid: true
          } as StateChangeEvent)
        }
      })
      
      rerender()
      
      expect(result.current._updateCount).toBe(1)
      expect(mockManager.getAllSteps).toHaveBeenCalled()
      expect(mockManager.getCurrentStep).toHaveBeenCalled()
    })

    it('should memoize steps array to prevent unnecessary re-renders', () => {
      const { result, rerender } = renderHook(() => useWorkflowState())
      
      const initialSteps = result.current.steps
      
      rerender()
      
      // Should be the same reference if no changes
      expect(result.current.steps).toBe(initialSteps)
    })

    it('should cleanup subscription on unmount', () => {
      const unsubscribeMock = jest.fn()
      mockManager.subscribe.mockReturnValue(unsubscribeMock)
      
      const { unmount } = renderHook(() => useWorkflowState())
      
      unmount()
      
      expect(unsubscribeMock).toHaveBeenCalled()
    })
  })

  describe('useStepState Hook', () => {
    it('should return step state information', () => {
      const { result } = renderHook(() => useStepState('input-file'))
      
      expect(result.current.state).toBe(StepState.Ready)
      expect(result.current.isReady).toBe(true)
      expect(result.current.isComplete).toBe(false)
      expect(result.current.isBlocked).toBe(false)
      expect(result.current.isError).toBe(false)
      expect(result.current.isSkipped).toBe(false)
      expect(result.current.hasWarning).toBe(false)
      expect(result.current.isAccessible).toBe(true)
    })

    it('should update when specific step changes', () => {
      const { result } = renderHook(() => useStepState('input-file'))
      
      expect(result.current.state).toBe(StepState.Ready)
      
      // Update mock to return complete state
      mockManager.getStepState.mockReturnValue(StepState.Complete)
      mockManager.getStep.mockReturnValue({
        ...mockSteps.get(createStepId('input-file')),
        stateMetadata: {
          state: StepState.Complete,
          lastModified: Date.now()
        }
      })
      
      // Simulate state change for this specific step
      act(() => {
        if (subscriberCallback) {
          subscriberCallback({
            stepId: createStepId('input-file'),
            oldState: StepState.Ready,
            newState: StepState.Complete,
            metadata: {
              state: StepState.Complete,
              lastModified: Date.now()
            },
            timestamp: Date.now(),
            transitionKey: 'ready-to-complete',
            isValid: true
          } as StateChangeEvent)
        }
      })
      
      expect(result.current.state).toBe(StepState.Complete)
      expect(result.current.isComplete).toBe(true)
      expect(result.current.isReady).toBe(false)
    })

    it('should handle typed step validation', () => {
      const { result } = renderHook(() => useStepState('input-file', StepState.Ready))
      
      expect(result.current.typedStep).not.toBeNull()
      
      // Change to different state
      const { result: result2 } = renderHook(() => useStepState('input-file', StepState.Complete))
      
      expect(result2.current.typedStep).toBeNull()
    })

    it('should not update for unrelated step changes', () => {
      const { result } = renderHook(() => useStepState('input-file'))
      const initialState = result.current.state
      
      // Simulate state change for different step
      act(() => {
        if (subscriberCallback) {
          subscriberCallback({
            stepId: createStepId('config'),
            oldState: StepState.Blocked,
            newState: StepState.Ready,
            metadata: {
              state: StepState.Ready,
              lastModified: Date.now()
            },
            timestamp: Date.now(),
            transitionKey: 'blocked-to-ready',
            isValid: true
          } as StateChangeEvent)
        }
      })
      
      expect(result.current.state).toBe(initialState)
    })
  })

  describe('useWorkflowNavigation Hook', () => {
    it('should provide navigation methods', () => {
      const { result } = renderHook(() => useWorkflowNavigation())
      
      expect(result.current.currentStepId).toBe(createStepId('input-file'))
      expect(typeof result.current.navigateToStep).toBe('function')
      expect(typeof result.current.canNavigateToStep).toBe('function')
    })

    it('should navigate to accessible step', async () => {
      const { result } = renderHook(() => useWorkflowNavigation())
      
      mockManager.isStepAccessible.mockReturnValue(true)
      
      await act(async () => {
        const navResult = await result.current.navigateToStep('config')
        expect(navResult.success).toBe(true)
      })
      
      expect(mockManager.setCurrentStep).toHaveBeenCalledWith(createStepId('config'))
    })

    it('should reject navigation to inaccessible step', async () => {
      const { result } = renderHook(() => useWorkflowNavigation())
      
      mockManager.isStepAccessible.mockReturnValue(false)
      
      await act(async () => {
        const navResult = await result.current.navigateToStep('config')
        expect(navResult.success).toBe(false)
        expect(navResult.error).toContain('not accessible')
      })
      
      expect(mockManager.setCurrentStep).not.toHaveBeenCalled()
    })

    it('should check step accessibility', () => {
      const { result } = renderHook(() => useWorkflowNavigation())
      
      mockManager.isStepAccessible.mockReturnValue(true)
      expect(result.current.canNavigateToStep('input-file')).toBe(true)
      
      mockManager.isStepAccessible.mockReturnValue(false)
      expect(result.current.canNavigateToStep('config')).toBe(false)
    })

    it('should handle navigation errors gracefully', async () => {
      const { result } = renderHook(() => useWorkflowNavigation())
      
      mockManager.setCurrentStep.mockReturnValue(false)
      
      await act(async () => {
        const navResult = await result.current.navigateToStep('config')
        expect(navResult.success).toBe(false)
        expect(navResult.error).toContain('Failed to navigate')
      })
    })
  })

  describe('useStepTransitions Hook', () => {
    it('should provide transition methods', () => {
      const { result } = renderHook(() => useStepTransitions())
      
      expect(typeof result.current.transitionStepState).toBe('function')
      expect(typeof result.current.markStepComplete).toBe('function')
      expect(typeof result.current.markStepError).toBe('function')
      expect(typeof result.current.markStepReady).toBe('function')
      expect(typeof result.current.markStepBlocked).toBe('function')
      expect(typeof result.current.markStepSkipped).toBe('function')
      expect(typeof result.current.markStepWarning).toBe('function')
      expect(result.current.isTransitioning).toBe(false)
      expect(result.current.lastError).toBeNull()
    })

    it('should handle successful transitions', async () => {
      const { result } = renderHook(() => useStepTransitions())
      
      mockManager.transitionState.mockResolvedValue({ success: true })
      
      await act(async () => {
        const transitionResult = await result.current.markStepComplete('input-file')
        expect(transitionResult.success).toBe(true)
      })
      
      expect(mockManager.transitionState).toHaveBeenCalledWith(
        'input-file',
        StepState.Complete,
        undefined
      )
      expect(result.current.isTransitioning).toBe(false)
      expect(result.current.lastError).toBeNull()
    })

    it('should handle transition errors', async () => {
      const { result } = renderHook(() => useStepTransitions())
      
      mockManager.transitionState.mockResolvedValue({
        success: false,
        error: 'Invalid transition'
      })
      
      await act(async () => {
        const transitionResult = await result.current.markStepError('input-file', 'Test error')
        expect(transitionResult.success).toBe(false)
      })
      
      expect(result.current.lastError).toBe('Invalid transition')
    })

    it('should show transitioning state during operation', async () => {
      const { result } = renderHook(() => useStepTransitions())
      
      let resolveTransition: (value: any) => void
      const transitionPromise = new Promise(resolve => {
        resolveTransition = resolve
      })
      
      mockManager.transitionState.mockReturnValue(transitionPromise)
      
      act(() => {
        result.current.markStepComplete('input-file')
      })
      
      expect(result.current.isTransitioning).toBe(true)
      
      await act(async () => {
        resolveTransition({ success: true })
        await transitionPromise
      })
      
      expect(result.current.isTransitioning).toBe(false)
    })

    it('should provide convenience methods with correct parameters', async () => {
      const { result } = renderHook(() => useStepTransitions())
      
      mockManager.transitionState.mockResolvedValue({ success: true })
      
      await act(async () => {
        await result.current.markStepError('input-file', 'Test error')
      })
      
      expect(mockManager.transitionState).toHaveBeenCalledWith(
        'input-file',
        StepState.Error,
        expect.objectContaining({
          message: 'Test error',
          reason: 'Step encountered an error'
        })
      )
      
      await act(async () => {
        await result.current.markStepBlocked('input-file', 'Test blocking')
      })
      
      expect(mockManager.transitionState).toHaveBeenCalledWith(
        'input-file',
        StepState.Blocked,
        expect.objectContaining({
          reason: 'Test blocking',
          message: 'Step blocked: Test blocking'
        })
      )
    })

    it('should clear errors', () => {
      const { result } = renderHook(() => useStepTransitions())
      
      // Simulate error state
      act(() => {
        result.current.clearError()
      })
      
      expect(result.current.lastError).toBeNull()
    })
  })

  describe('useStepValidation Hook', () => {
    it('should provide validation methods', () => {
      const { result } = renderHook(() => useStepValidation())
      
      expect(typeof result.current.getStepAccessibility).toBe('function')
      expect(typeof result.current.getStepProgress).toBe('function')
    })

    it('should check step accessibility with reasons', () => {
      const { result } = renderHook(() => useStepValidation())
      
      // Test accessible step
      const accessibilityReady = result.current.getStepAccessibility('input-file')
      expect(accessibilityReady.accessible).toBe(true)
      expect(accessibilityReady.reason).toBeNull()
      
      // Test blocked step
      const accessibilityBlocked = result.current.getStepAccessibility('config')
      expect(accessibilityBlocked.accessible).toBe(false)
      expect(accessibilityBlocked.reason).toContain('blocked')
    })

    it('should calculate workflow progress', () => {
      const { result } = renderHook(() => useStepValidation())
      
      const progress = result.current.getStepProgress()
      
      expect(progress.totalSteps).toBe(2)
      expect(progress.completedSteps).toBe(0) // No completed steps initially
      expect(progress.progressPercentage).toBe(0)
      expect(progress.isComplete).toBe(false)
    })

    it('should update progress when steps complete', () => {
      // Mock one completed step
      const completedSteps = new Map([
        [createStepId('input-file'), {
          ...mockSteps.get(createStepId('input-file')),
          stateMetadata: {
            state: StepState.Complete,
            lastModified: Date.now()
          }
        }],
        [createStepId('config'), mockSteps.get(createStepId('config'))]
      ])
      
      mockManager.getAllSteps.mockReturnValue(completedSteps)
      
      const { result } = renderHook(() => useStepValidation())
      
      const progress = result.current.getStepProgress()
      
      expect(progress.completedSteps).toBe(1)
      expect(progress.progressPercentage).toBe(50)
      expect(progress.isComplete).toBe(false)
    })
  })

  describe('useWorkflowControl Hook', () => {
    it('should provide workflow control methods', () => {
      const { result } = renderHook(() => useWorkflowControl())
      
      expect(typeof result.current.resetWorkflow).toBe('function')
      expect(typeof result.current.saveState).toBe('function')
      expect(typeof result.current.loadState).toBe('function')
      expect(result.current.isBusy).toBe(false)
    })

    it('should reset workflow', async () => {
      const { result } = renderHook(() => useWorkflowControl())
      
      await act(async () => {
        const resetResult = await result.current.resetWorkflow()
        expect(resetResult.success).toBe(true)
      })
      
      expect(mockManager.reset).toHaveBeenCalled()
    })

    it('should save state', async () => {
      const { result } = renderHook(() => useWorkflowControl())
      
      await act(async () => {
        const saveResult = await result.current.saveState()
        expect(saveResult.success).toBe(true)
      })
      
      expect(mockManager.saveState).toHaveBeenCalled()
    })

    it('should load state', async () => {
      const { result } = renderHook(() => useWorkflowControl())
      
      await act(async () => {
        const loadResult = await result.current.loadState()
        expect(loadResult.success).toBe(true)
      })
      
      expect(mockManager.loadState).toHaveBeenCalled()
    })

    it('should show busy state during operations', async () => {
      const { result } = renderHook(() => useWorkflowControl())
      
      let resolveSave: (value: any) => void
      const savePromise = new Promise(resolve => {
        resolveSave = resolve
      })
      
      mockManager.saveState.mockReturnValue(savePromise)
      
      act(() => {
        result.current.saveState()
      })
      
      expect(result.current.isBusy).toBe(true)
      
      await act(async () => {
        resolveSave(undefined)
        await savePromise
      })
      
      expect(result.current.isBusy).toBe(false)
    })

    it('should handle operation errors', async () => {
      const { result } = renderHook(() => useWorkflowControl())
      
      mockManager.saveState.mockRejectedValue(new Error('Save failed'))
      
      await act(async () => {
        const saveResult = await result.current.saveState()
        expect(saveResult.success).toBe(false)
        expect(saveResult.error).toBe('Save failed')
      })
    })
  })


  describe('Hook Performance and Re-rendering', () => {
    it('should minimize re-renders with proper memoization', () => {
      const renderCounter = jest.fn()
      
      const TestComponent = () => {
        const { steps, currentStepId } = useWorkflowState()
        renderCounter()
        return <div data-testid="steps-count">{steps.length}</div>
      }
      
      const { rerender } = render(<TestComponent />)
      expect(renderCounter).toHaveBeenCalledTimes(1)
      
      // Rerender without state changes
      rerender(<TestComponent />)
      expect(renderCounter).toHaveBeenCalledTimes(2)
      
      // Verify DOM
      expect(screen.getByTestId('steps-count')).toHaveTextContent('2')
    })

    it('should handle rapid state updates efficiently', async () => {
      const { result } = renderHook(() => useStepState('input-file'))
      
      // Simulate rapid state changes
      for (let i = 0; i < 10; i++) {
        act(() => {
          if (subscriberCallback) {
            subscriberCallback({
              stepId: createStepId('input-file'),
              oldState: StepState.Ready,
              newState: i % 2 === 0 ? StepState.Complete : StepState.Ready,
              metadata: {
                state: i % 2 === 0 ? StepState.Complete : StepState.Ready,
                lastModified: Date.now()
              },
              timestamp: Date.now(),
              transitionKey: 'test-transition',
              isValid: true
            } as StateChangeEvent)
          }
        })
      }
      
      // Should handle rapid updates without issues
      expect(result.current.state).toBeDefined()
    })
  })

  describe('Error Boundary Integration', () => {
    it('should handle hook errors gracefully', () => {
      // Mock manager to throw error
      mockManager.getAllSteps.mockImplementation(() => {
        throw new Error('Manager error')
      })
      
      const { result } = renderHook(() => {
        try {
          return useWorkflowState()
        } catch (error) {
          return { error: (error as Error).message }
        }
      })
      
      expect(result.current).toHaveProperty('error')
    })

    it('should recover from transient errors', () => {
      let shouldError = true
      
      mockManager.getAllSteps.mockImplementation(() => {
        if (shouldError) {
          shouldError = false
          throw new Error('Transient error')
        }
        return mockSteps
      })
      
      const { result, rerender } = renderHook(() => {
        try {
          return useWorkflowState()
        } catch (error) {
          return { error: (error as Error).message }
        }
      })
      
      expect(result.current).toHaveProperty('error')
      
      // Should recover on next render
      rerender()
      expect(result.current).toHaveProperty('steps')
    })
  })
})