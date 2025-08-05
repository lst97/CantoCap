/**
 * React hooks for consuming centralized WorkflowStateManager
 * Provides type-safe, performance-optimized access to workflow state with proper memoization
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { 
  workflowStateManager,
  getStepState,
  isStepAccessible,
  transitionStep
} from '../services/workflow/workflow-state-manager'
import {
  StepState,
  StepId,
  AnyWorkflowStepState,
  StateChangeEvent,
  StepStateMetadata,
  StateTransitionResult,
  createStepId
} from '../types/workflow-state'

/**
 * Hook for accessing complete workflow state with automatic updates
 * Uses memoization to prevent unnecessary re-renders
 */
export function useWorkflowState() {

  const [allSteps, setAllSteps] = useState<ReadonlyMap<StepId, AnyWorkflowStepState>>(
    workflowStateManager.getAllSteps()
  )
  const [currentStepId, setCurrentStepId] = useState<StepId>(
    workflowStateManager.getCurrentStep()
  )
  const updateRef = useRef<number>(0)

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = workflowStateManager.subscribe((event: StateChangeEvent) => {
      updateRef.current += 1
      setAllSteps(workflowStateManager.getAllSteps())
      setCurrentStepId(workflowStateManager.getCurrentStep())
    })

    return unsubscribe
  }, [])

  // Convert Map to Array for easier consumption in React components
  const steps = useMemo(() => {
    return Array.from(allSteps.values())
  }, [allSteps])

  const currentStep = useMemo(() => {
    return allSteps.get(currentStepId) || null
  }, [allSteps, currentStepId])

  return {
    steps,
    currentStep,
    currentStepId,
    allSteps,
    // Include update counter for debugging
    _updateCount: updateRef.current
  }
}

/**
 * Hook for accessing a specific step's state with type safety
 * Automatically re-renders when the step state changes
 */
export function useStepState<T extends StepState = StepState>(
  stepId: string,
  expectedState?: T
) {
  const [step, setStep] = useState<AnyWorkflowStepState | null>(() => 
    workflowStateManager.getStep(stepId)
  )
  const [state, setState] = useState<StepState | null>(() => 
    workflowStateManager.getStepState(stepId)
  )

  // Subscribe to changes for this specific step
  useEffect(() => {
    const unsubscribe = workflowStateManager.subscribe((event: StateChangeEvent) => {
      if (event.stepId === stepId || typeof stepId === 'string' && event.stepId === createStepId(stepId)) {
        const updatedStep = workflowStateManager.getStep(stepId)
        const updatedState = workflowStateManager.getStepState(stepId)
        setStep(updatedStep)
        setState(updatedState)
      }
    })

    return unsubscribe
  }, [stepId])

  // Type-safe step getter for specific states
  const typedStep = useMemo(() => {
    if (expectedState && step && step.stateMetadata.state === expectedState) {
      return step as any // We know the type is correct due to the check
    }
    return null
  }, [step, expectedState])

  // State checkers with memoization
  const isReady = useMemo(() => state === StepState.Ready, [state])
  const isComplete = useMemo(() => state === StepState.Complete, [state])
  const isBlocked = useMemo(() => state === StepState.Blocked, [state])
  const isError = useMemo(() => state === StepState.Error, [state])
  const isSkipped = useMemo(() => state === StepState.Skip, [state])
  const hasWarning = useMemo(() => state === StepState.Warning, [state])
  const isAccessible = useMemo(() => 
    state === StepState.Ready || state === StepState.Complete, [state])

  return {
    step,
    state,
    typedStep,
    isReady,
    isComplete,
    isBlocked,
    isError,
    isSkipped,
    hasWarning,
    isAccessible
  }
}

/**
 * Hook for workflow navigation with validation
 * Provides methods for safe step transitions
 */
export function useWorkflowNavigation() {
  const { currentStepId } = useWorkflowState()

  // Helper method for user-friendly accessibility messages
  const getUserFriendlyAccessibilityMessage = useCallback((stepId: string, stepState: string) => {
    const stepNames: Record<string, string> = {
      'input-file': 'File Selection',
      'processing': 'Processing',
      'review': 'Review & Edit'
    }
    
    const stepName = stepNames[stepId] || stepId
    
    switch (stepState) {
      case 'blocked':
        switch (stepId) {
          case 'processing':
            return 'Please select a video file first before proceeding to processing.'
          case 'review':
            return 'Complete the processing step to review and edit your subtitles.'
          default:
            return `Complete the previous steps before accessing ${stepName}.`
        }
      case 'pending':
        return `${stepName} is not yet available. Complete the current step first.`
      case 'error':
        return `${stepName} encountered an error. Please resolve the issue before continuing.`
      default:
        return `${stepName} is not accessible in its current state (${stepState}).`
    }
  }, [])

  const navigateToStep = useCallback(async (stepId: string) => {
    const startTime = performance.now()
    
    // Enhanced debugging: Log navigation attempt
    const currentStepId = workflowStateManager.getCurrentStep()
    console.log(`🧭 Navigation attempt: ${currentStepId} → ${stepId}`, {
      timestamp: new Date().toISOString(),
      currentStep: currentStepId,
      targetStep: stepId,
      currentStepState: workflowStateManager.getStepState(currentStepId),
      sessionId: crypto.randomUUID().slice(0, 8) // Modern session tracking with better uniqueness
    })

    try {
      // Enhanced createStepId error handling
      let targetStepId: string
      try {
        targetStepId = typeof stepId === 'string' ? createStepId(stepId) : stepId
        console.log(`✅ Step ID validation successful: ${stepId} → ${targetStepId}`)
      } catch (stepIdError) {
        const errorMsg = `Invalid step ID format: ${stepId}`
        console.error(`❌ Step ID validation failed:`, {
          inputStepId: stepId,
          error: stepIdError,
          message: errorMsg
        })
        return { 
          success: false, 
          error: errorMsg,
          details: 'Step ID must be a valid workflow step identifier'
        }
      }
      
      // Always allow navigation to step 1 (input-file) - users should always be able to return to the beginning
      if (stepId === 'input-file') {
        console.log(`🏠 Navigating to home step (input-file) - always accessible`)
        
        const success = workflowStateManager.setCurrentStep(targetStepId)
        const endTime = performance.now()
        
        if (!success) {
          const errorMsg = `Failed to navigate to step: ${stepId}`
          console.error(`❌ Navigation to input-file failed:`, {
            stepId,
            targetStepId,
            duration: `${(endTime - startTime).toFixed(2)}ms`,
            currentStepId: workflowStateManager.getCurrentStep()
          })
          return { 
            success: false, 
            error: errorMsg,
            details: 'Internal state management error - please try refreshing the application'
          }
        }
        
        console.log(`✅ Navigation to input-file successful`, {
          duration: `${(endTime - startTime).toFixed(2)}ms`,
          newStepId: workflowStateManager.getCurrentStep()
        })
        return { success: true, stepId: targetStepId, duration: endTime - startTime }
      }
      
      // Enhanced accessibility checking with detailed logging
      console.log(`🔍 Checking accessibility for step: ${stepId}`)
      const targetStepState = workflowStateManager.getStepState(targetStepId)
      const isAccessible = workflowStateManager.isStepAccessible(targetStepId)
      
      console.log(`📊 Accessibility check result:`, {
        stepId,
        targetStepId,
        stepState: targetStepState,
        isAccessible,
        reasoning: isAccessible 
          ? `Step is ${targetStepState} and can be navigated to`
          : `Step is ${targetStepState} and cannot be accessed yet`
      })
      
      if (isAccessible) {
        console.log(`🚀 Attempting navigation to accessible step: ${stepId}`)
        const success = workflowStateManager.setCurrentStep(targetStepId)
        const endTime = performance.now()
        
        if (!success) {
          const errorMsg = `Failed to navigate to step: ${stepId}`
          console.error(`❌ Navigation failed despite accessibility:`, {
            stepId,
            targetStepId,
            stepState: targetStepState,
            duration: `${(endTime - startTime).toFixed(2)}ms`,
            currentStepId: workflowStateManager.getCurrentStep()
          })
          return { 
            success: false, 
            error: errorMsg,
            details: 'Navigation blocked by internal state validation - some prerequisites may not be met'
          }
        }
        
        console.log(`✅ Navigation successful:`, {
          fromStep: currentStepId,
          toStep: stepId,
          duration: `${(endTime - startTime).toFixed(2)}ms`,
          newStepId: workflowStateManager.getCurrentStep()
        })
        return { success: true, stepId: targetStepId, duration: endTime - startTime }
      } else {
        const endTime = performance.now()
        const errorMsg = `Step "${stepId}" is not accessible yet`
        const userFriendlyMessage = getUserFriendlyAccessibilityMessage(stepId, targetStepState)
        
        console.warn(`⚠️ Navigation blocked - step not accessible:`, {
          stepId,
          targetStepId,
          stepState: targetStepState,
          duration: `${(endTime - startTime).toFixed(2)}ms`,
          reason: userFriendlyMessage
        })
        
        return { 
          success: false, 
          error: errorMsg,
          details: userFriendlyMessage,
          stepState: targetStepState
        }
      }
    } catch (error) {
      const endTime = performance.now()
      const errorMsg = error instanceof Error ? error.message : 'Navigation failed'
      
      console.error(`🚨 Navigation error:`, {
        fromStep: currentStepId,
        toStep: stepId,
        duration: `${(endTime - startTime).toFixed(2)}ms`,
        error: error,
        stack: error instanceof Error ? error.stack : undefined
      })
      
      return { 
        success: false, 
        error: errorMsg,
        details: 'An unexpected error occurred during navigation. Please try again or contact support if the problem persists.',
        duration: endTime - startTime
      }
    }
  }, [currentStepId])

  const canNavigateToStep = useCallback((stepId: string) => {
    // Always allow navigation to step 1 (input-file)
    if (stepId === 'input-file') {
      return true
    }
    return workflowStateManager.isStepAccessible(stepId)
  }, [])

  return {
    currentStepId,
    navigateToStep,
    canNavigateToStep
  }
}

/**
 * Hook for step state transitions with error handling
 * Provides type-safe methods for changing step states
 */
export function useStepTransitions() {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const transitionStepState = useCallback(async <T extends StepState>(
    stepId: string,
    newState: T,
    metadata?: Partial<StepStateMetadata<T>>
  ): Promise<StateTransitionResult<T>> => {
    setIsTransitioning(true)
    setLastError(null)
    
    try {
      const result = await workflowStateManager.transitionState(stepId, newState, metadata)
      
      if (!result.success && result.error) {
        setLastError(result.error)
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transition failed'
      setLastError(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setIsTransitioning(false)
    }
  }, [])

  // Convenience methods for common transitions
  const markStepComplete = useCallback((stepId: string, metadata?: Partial<StepStateMetadata<StepState.Complete>>) => {
    return transitionStepState(stepId, StepState.Complete, metadata)
  }, [transitionStepState])

  const markStepError = useCallback((stepId: string, errorMessage: string, metadata?: Partial<StepStateMetadata<StepState.Error>>) => {
    return transitionStepState(stepId, StepState.Error, {
      message: errorMessage,
      reason: 'Step encountered an error',
      ...metadata
    })
  }, [transitionStepState])

  const markStepReady = useCallback((stepId: string, metadata?: Partial<StepStateMetadata<StepState.Ready>>) => {
    return transitionStepState(stepId, StepState.Ready, metadata)
  }, [transitionStepState])

  const markStepBlocked = useCallback((stepId: string, reason: string, metadata?: Partial<StepStateMetadata<StepState.Blocked>>) => {
    return transitionStepState(stepId, StepState.Blocked, {
      reason,
      message: `Step blocked: ${reason}`,
      ...metadata
    })
  }, [transitionStepState])

  const markStepSkipped = useCallback((stepId: string, skipReason: string, metadata?: Partial<StepStateMetadata<StepState.Skip>>) => {
    return transitionStepState(stepId, StepState.Skip, {
      reason: skipReason,
      message: `Step skipped: ${skipReason}`,
      ...metadata
    })
  }, [transitionStepState])

  const markStepWarning = useCallback((stepId: string, warningMessage: string, metadata?: Partial<StepStateMetadata<StepState.Warning>>) => {
    return transitionStepState(stepId, StepState.Warning, {
      message: warningMessage,
      reason: 'Step has warnings',
      ...metadata
    })
  }, [transitionStepState])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    transitionStepState,
    markStepComplete,
    markStepError,
    markStepReady,
    markStepBlocked,
    markStepSkipped,
    markStepWarning,
    isTransitioning,
    lastError,
    clearError
  }
}

/**
 * Hook for step validation and accessibility checks
 * Provides real-time validation state for UI components
 */
export function useStepValidation() {
  const { steps } = useWorkflowState()

  const getStepAccessibility = useCallback((stepId: string) => {
    // Always allow access to step 1 (input-file) - users should always be able to return to the beginning
    if (stepId === 'input-file') {
      return { 
        accessible: true, 
        reason: 'Step 1 is always accessible',
        isAccessible: true
      }
    }
    
    const step = steps.find(s => s.id === stepId)
    if (!step) {
      return { 
        accessible: false, 
        reason: 'Step not found',
        isAccessible: false
      }
    }

    const state = step.stateMetadata.state
    const isAccessible = state === StepState.Ready || state === StepState.Complete

    if (!isAccessible) {
      switch (state) {
        case StepState.Blocked:
          return { 
            accessible: false, 
            reason: step.stateMetadata.message || 'Step is blocked by prerequisites',
            isAccessible: false
          }
        case StepState.Error:
          return { 
            accessible: false, 
            reason: step.stateMetadata.message || 'Step has errors',
            isAccessible: false
          }
        case StepState.Skip:
          return { 
            accessible: false, 
            reason: 'Step was skipped',
            isAccessible: false
          }
        default:
          return { 
            accessible: false, 
            reason: 'Step is not ready',
            isAccessible: false
          }
      }
    }

    return { 
      accessible: true, 
      reason: null,
      isAccessible: true
    }
  }, [steps])

  const getStepProgress = useCallback(() => {
    const completedSteps = steps.filter(step => 
      step.stateMetadata.state === StepState.Complete
    ).length
    
    const totalSteps = steps.length
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

    return {
      completedSteps,
      totalSteps,
      progressPercentage,
      isComplete: completedSteps === totalSteps
    }
  }, [steps])

  return {
    getStepAccessibility,
    getStepProgress
  }
}

/**
 * Hook for batch operations and workflow control
 * Provides methods for complex workflow state management
 */
export function useWorkflowControl() {
  const [isBusy, setIsBusy] = useState(false)

  const resetWorkflow = useCallback(async () => {
    setIsBusy(true)
    try {
      workflowStateManager.reset()
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Reset failed' 
      }
    } finally {
      setIsBusy(false)
    }
  }, [])

  const saveState = useCallback(async () => {
    setIsBusy(true)
    try {
      await workflowStateManager.saveState()
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Save failed' 
      }
    } finally {
      setIsBusy(false)
    }
  }, [])

  const loadState = useCallback(async () => {
    setIsBusy(true)
    try {
      const success = await workflowStateManager.loadState()
      return { success }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Load failed' 
      }
    } finally {
      setIsBusy(false)
    }
  }, [])

  return {
    resetWorkflow,
    saveState,
    loadState,
    isBusy
  }
}


