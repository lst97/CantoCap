/**
 * Optimized React hooks for WorkflowStateManager
 * Performance targets: <10ms re-renders, 50% reduction in unnecessary updates
 * Features: intelligent memoization, debounced updates, subscription optimization
 */

import { useCallback, useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react'
import { 
  workflowStateManager,
  getStepState,
  isStepAccessible,
  transitionStep
} from '../services/workflow/workflow-state-manager'
import { performanceMonitor } from '../services/performance/performance-monitor'
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
 * Debounced state hook to prevent excessive re-renders
 */
function useDebouncedState<T>(initialValue: T, delay: number = 16): [T, (value: T) => void] {
  const [state, setState] = useState<T>(initialValue)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const pendingValueRef = useRef<T>(initialValue)

  const debouncedSetState = useCallback((value: T) => {
    pendingValueRef.current = value
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      setState(pendingValueRef.current)
    }, delay)
  }, [delay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return [state, debouncedSetState]
}

/**
 * Intelligent step selector with memoization
 */
function useStepSelector<T>(
  selector: (steps: ReadonlyMap<StepId, AnyWorkflowStepState>) => T,
  deps: any[] = []
): T {
  const [selectedValue, setSelectedValue] = useState<T>(() => 
    selector(workflowStateManager.getAllSteps())
  )
  const selectorRef = useRef(selector)
  const depsRef = useRef(deps)
  const lastValueRef = useRef(selectedValue)

  // Update selector ref when it changes
  useLayoutEffect(() => {
    selectorRef.current = selector
    depsRef.current = deps
  })

  useEffect(() => {
    const unsubscribe = workflowStateManager.subscribe((event: StateChangeEvent) => {
      const startTime = performance.now()
      
      try {
        const newValue = selectorRef.current(workflowStateManager.getAllSteps())
        
        // Only update if value actually changed (shallow comparison)
        if (newValue !== lastValueRef.current) {
          lastValueRef.current = newValue
          setSelectedValue(newValue)
        }
        
        // Record re-render performance
        const renderTime = performance.now() - startTime
        performanceMonitor.recordRerender(renderTime)
        
      } catch (error) {
        console.error('Step selector error:', error)
      }
    })

    return unsubscribe
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return selectedValue
}

/**
 * Optimized hook for accessing complete workflow state
 * Prevents unnecessary re-renders with intelligent memoization
 */
export function useOptimizedWorkflowState() {
  // Use selector for steps array to prevent Map recreation
  const steps = useStepSelector(
    (allSteps) => Array.from(allSteps.values()),
    []
  )
  
  // Use selector for current step to avoid unnecessary updates
  const currentStepId = useStepSelector(
    () => workflowStateManager.getCurrentStep(),
    []
  )
  
  // Memoize current step to prevent lookups on every render
  const currentStep = useMemo(() => {
    return steps.find(step => step.id === currentStepId) || null
  }, [steps, currentStepId])
  
  // Memoize steps map for components that need it
  const allSteps = useMemo(() => {
    return new Map(steps.map(step => [step.id, step]))
  }, [steps])
  
  // Memoize step counts for performance monitoring
  const stepCounts = useMemo(() => {
    const counts = {
      ready: 0,
      complete: 0,
      blocked: 0,
      error: 0,
      warning: 0,
      skip: 0
    }
    
    steps.forEach(step => {
      const state = step.stateMetadata.state
      if (state in counts) {
        counts[state as keyof typeof counts]++
      }
    })
    
    return counts
  }, [steps])

  return {
    steps,
    currentStep,
    currentStepId,
    allSteps,
    stepCounts,
    // Utility methods
    getStepById: useCallback((id: string) => allSteps.get(createStepId(id)), [allSteps]),
    getStepsByState: useCallback((state: StepState) => 
      steps.filter(step => step.stateMetadata.state === state), [steps]
    )
  }
}

/**
 * Optimized hook for accessing specific step state
 * Uses micro-subscriptions and intelligent caching
 */
export function useOptimizedStepState<T extends StepState = StepState>(
  stepId: string,
  expectedState?: T
) {
  const stepIdTyped = useMemo(() => createStepId(stepId), [stepId])
  
  // Use debounced state to prevent rapid updates
  const [step, setStep] = useDebouncedState<AnyWorkflowStepState | null>(
    workflowStateManager.getStep(stepIdTyped),
    8 // 8ms debounce
  )
  
  const [state, setState] = useDebouncedState<StepState | null>(
    workflowStateManager.getStepState(stepIdTyped),
    8
  )

  // Subscribe only to changes for this specific step
  useEffect(() => {
    const unsubscribe = workflowStateManager.subscribe((event: StateChangeEvent) => {
      if (event.stepId === stepIdTyped) {
        const startTime = performance.now()
        
        const updatedStep = workflowStateManager.getStep(stepIdTyped)
        const updatedState = workflowStateManager.getStepState(stepIdTyped)
        
        setStep(updatedStep)
        setState(updatedState)
        
        // Record re-render performance
        const renderTime = performance.now() - startTime
        performanceMonitor.recordRerender(renderTime)
      }
    }, stepIdTyped) // Step-specific subscription

    return unsubscribe
  }, [stepIdTyped, setStep, setState])

  // Memoized type-safe step getter
  const typedStep = useMemo(() => {
    if (expectedState && step && step.stateMetadata.state === expectedState) {
      return step as any // Type is safe due to the check
    }
    return null
  }, [step, expectedState])

  // Memoized state checkers for performance
  const stateCheckers = useMemo(() => ({
    isReady: state === StepState.Ready,
    isComplete: state === StepState.Complete,
    isBlocked: state === StepState.Blocked,
    isError: state === StepState.Error,
    isSkipped: state === StepState.Skip,
    hasWarning: state === StepState.Warning,
    isAccessible: state === StepState.Ready || state === StepState.Complete
  }), [state])

  return {
    step,
    state,
    typedStep,
    ...stateCheckers
  }
}

/**
 * Optimized hook for batch step state access
 * Efficient for components that need multiple step states
 */
export function useOptimizedMultiStepState(stepIds: string[]) {
  const stepIdsTyped = useMemo(() => 
    stepIds.map(id => createStepId(id)), [stepIds]
  )
  
  // Use debounced state for batch updates
  const [stepStates, setStepStates] = useDebouncedState(() => {
    const states = new Map<string, { step: AnyWorkflowStepState | null; state: StepState | null }>()
    stepIds.forEach(id => {
      const stepId = createStepId(id)
      states.set(id, {
        step: workflowStateManager.getStep(stepId),
        state: workflowStateManager.getStepState(stepId)
      })
    })
    return states
  }, 8)

  useEffect(() => {
    const unsubscribe = workflowStateManager.subscribe((event: StateChangeEvent) => {
      // Only update if one of our tracked steps changed
      if (stepIdsTyped.includes(event.stepId)) {
        const startTime = performance.now()
        
        setStepStates(() => {
          const states = new Map<string, { step: AnyWorkflowStepState | null; state: StepState | null }>()
          stepIds.forEach(id => {
            const stepId = createStepId(id)
            states.set(id, {
              step: workflowStateManager.getStep(stepId),
              state: workflowStateManager.getStepState(stepId)
            })
          })
          return states
        })
        
        // Record re-render performance
        const renderTime = performance.now() - startTime
        performanceMonitor.recordRerender(renderTime)
      }
    })

    return unsubscribe
  }, [stepIdsTyped, stepIds, setStepStates])

  // Memoized helper functions
  const helpers = useMemo(() => ({
    getStep: (id: string) => stepStates.get(id)?.step ?? null,
    getState: (id: string) => stepStates.get(id)?.state ?? null,
    isStepReady: (id: string) => stepStates.get(id)?.state === StepState.Ready,
    isStepComplete: (id: string) => stepStates.get(id)?.state === StepState.Complete,
    isStepAccessible: (id: string) => {
      const state = stepStates.get(id)?.state
      return state === StepState.Ready || state === StepState.Complete
    },
    getAllStates: () => Array.from(stepStates.entries()).map(([id, data]) => ({
      id,
      step: data.step,
      state: data.state
    }))
  }), [stepStates])

  return {
    stepStates,
    ...helpers
  }
}

/**
 * Optimized hook for workflow navigation with performance tracking
 */
export function useOptimizedWorkflowNavigation() {
  const { currentStepId } = useOptimizedWorkflowState()
  
  const navigateToStep = useCallback(async (stepId: string) => {
    return await performanceMonitor.measureAsyncOperation(
      'step-navigation',
      async () => {
        try {
          const targetStepId = createStepId(stepId)
          const isAccessible = workflowStateManager.isStepAccessible(targetStepId)
          
          if (isAccessible) {
            const success = workflowStateManager.setCurrentStep(targetStepId)
            if (!success) {
              throw new Error(`Failed to navigate to step: ${stepId}`)
            }
            return { success: true }
          } else {
            return { 
              success: false, 
              error: `Step ${stepId} is not accessible` 
            }
          }
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Navigation failed' 
          }
        }
      },
      10 // 10ms threshold for navigation
    )
  }, [])

  // Memoized accessibility checker
  const canNavigateToStep = useCallback((stepId: string) => {
    return workflowStateManager.isStepAccessible(stepId)
  }, [])

  // Memoized step order helpers
  const navigationHelpers = useMemo(() => {
    const allSteps = workflowStateManager.getAllSteps()
    const stepArray = Array.from(allSteps.values())
    const currentIndex = stepArray.findIndex(step => step.id === currentStepId)
    
    return {
      canGoNext: currentIndex < stepArray.length - 1,
      canGoPrevious: currentIndex > 0,
      nextStepId: currentIndex < stepArray.length - 1 ? stepArray[currentIndex + 1].id : null,
      previousStepId: currentIndex > 0 ? stepArray[currentIndex - 1].id : null,
      currentIndex,
      totalSteps: stepArray.length
    }
  }, [currentStepId])

  return {
    currentStepId,
    navigateToStep,
    canNavigateToStep,
    ...navigationHelpers
  }
}

/**
 * Optimized hook for step state transitions with batching
 */
export function useOptimizedStepTransitions() {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const pendingTransitions = useRef<Array<() => Promise<any>>>([])
  const batchTimeoutRef = useRef<NodeJS.Timeout>()

  // Batch transition executor
  const executeBatch = useCallback(async () => {
    if (pendingTransitions.current.length === 0) return
    
    const transitions = [...pendingTransitions.current]
    pendingTransitions.current = []
    
    setIsTransitioning(true)
    
    try {
      await Promise.all(transitions.map(transition => transition()))
    } finally {
      setIsTransitioning(false)
    }
  }, [])

  const transitionStepState = useCallback(async <T extends StepState>(
    stepId: string,
    newState: T,
    metadata?: Partial<StepStateMetadata<T>>,
    immediate = false
  ): Promise<StateTransitionResult<T>> => {
    
    const performTransition = async () => {
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
      }
    }

    if (immediate) {
      setIsTransitioning(true)
      try {
        return await performTransition()
      } finally {
        setIsTransitioning(false)
      }
    } else {
      // Batch the transition
      return new Promise((resolve) => {
        pendingTransitions.current.push(async () => {
          const result = await performTransition()
          resolve(result)
        })
        
        // Debounce batch execution
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current)
        }
        
        batchTimeoutRef.current = setTimeout(executeBatch, 16) // ~60fps
      })
    }
  }, [executeBatch])

  // Convenience methods with performance tracking
  const transitionMethods = useMemo(() => ({
    markStepComplete: (stepId: string, metadata?: Partial<StepStateMetadata<StepState.Complete>>, immediate = false) => {
      return transitionStepState(stepId, StepState.Complete, metadata, immediate)
    },
    
    markStepError: (stepId: string, errorMessage: string, metadata?: Partial<StepStateMetadata<StepState.Error>>, immediate = true) => {
      return transitionStepState(stepId, StepState.Error, {
        message: errorMessage,
        reason: 'Step encountered an error',
        ...metadata
      }, immediate) // Errors should be immediate
    },
    
    markStepReady: (stepId: string, metadata?: Partial<StepStateMetadata<StepState.Ready>>, immediate = false) => {
      return transitionStepState(stepId, StepState.Ready, metadata, immediate)
    },
    
    markStepBlocked: (stepId: string, reason: string, metadata?: Partial<StepStateMetadata<StepState.Blocked>>, immediate = false) => {
      return transitionStepState(stepId, StepState.Blocked, {
        reason,
        message: `Step blocked: ${reason}`,
        ...metadata
      }, immediate)
    },
    
    markStepSkipped: (stepId: string, skipReason: string, metadata?: Partial<StepStateMetadata<StepState.Skip>>, immediate = false) => {
      return transitionStepState(stepId, StepState.Skip, {
        reason: skipReason,
        message: `Step skipped: ${skipReason}`,
        ...metadata
      }, immediate)
    },
    
    markStepWarning: (stepId: string, warningMessage: string, metadata?: Partial<StepStateMetadata<StepState.Warning>>, immediate = false) => {
      return transitionStepState(stepId, StepState.Warning, {
        message: warningMessage,
        reason: 'Step has warnings',
        ...metadata
      }, immediate)
    }
  }), [transitionStepState])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  const flushTransitions = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
      batchTimeoutRef.current = undefined
    }
    return executeBatch()
  }, [executeBatch])

  // Cleanup
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
      }
    }
  }, [])

  return {
    transitionStepState,
    ...transitionMethods,
    isTransitioning,
    lastError,
    clearError,
    flushTransitions,
    pendingCount: pendingTransitions.current.length
  }
}

/**
 * Performance monitoring hook for workflow state operations
 */
export function useWorkflowPerformanceMonitor() {
  const [metrics, setMetrics] = useState(() => performanceMonitor.getMetrics())
  const [alerts, setAlerts] = useState(() => performanceMonitor.getAlerts())

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics())
      setAlerts(performanceMonitor.getAlerts())
    }, 1000) // Update every second

    return () => clearInterval(interval)
  }, [])

  const runBenchmarks = useCallback(async () => {
    return await performanceMonitor.runBenchmarkSuite()
  }, [])

  const generateReport = useCallback(() => {
    return performanceMonitor.generateReport()
  }, [])

  const clearData = useCallback(() => {
    performanceMonitor.clear()
    setMetrics(performanceMonitor.getMetrics())
    setAlerts(performanceMonitor.getAlerts())
  }, [])

  return {
    metrics,
    alerts,
    runBenchmarks,
    generateReport,
    clearData
  }
}