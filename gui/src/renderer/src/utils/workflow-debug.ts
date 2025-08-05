/**
 * Workflow Debugging Utilities
 * Comprehensive debugging tools to trace race conditions and navigation failures
 */

import { workflowStateManager, debugWorkflowState, getDebugCallStack } from '../services/workflow/workflow-state-manager'

/**
 * Comprehensive race condition debugger
 * Call this when step 1 navigation fails or race conditions are suspected
 */
export const debugRaceCondition = (context: string = 'unknown') => {
  console.group(`🚨 [RACE CONDITION DEBUG] Context: ${context}`)
  
  // Current state summary
  debugWorkflowState()
  
  // Call stack for recent operations
  console.log('🔧 [DEBUG] Recent call stack:', getDebugCallStack())
  
  // Check accessibility specifically for step 1
  const step1Accessible = workflowStateManager.isStepAccessible('input-file')
  const step1State = workflowStateManager.getStepState('input-file')
  const currentStep = workflowStateManager.getCurrentStep()
  
  console.log('🔧 [DEBUG] Step 1 (input-file) analysis:', {
    isAccessible: step1Accessible,
    state: step1State,
    currentStep,
    isCurrentStep: currentStep === 'input-file',
    expectedAccessibility: true, // Step 1 should always be accessible
    accessibilityMismatch: !step1Accessible // This should always be false
  })
  
  // Performance metrics
  const metrics = workflowStateManager.getPerformanceMetrics()
  console.log('🔧 [DEBUG] Performance metrics:', metrics)
  
  // Browser environment check
  console.log('🔧 [DEBUG] Environment:', {
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    hasLocalStorage: typeof localStorage !== 'undefined',
    hasSessionStorage: typeof sessionStorage !== 'undefined',
    documentReadyState: document.readyState
  })
  
  console.groupEnd()
}

/**
 * Navigation failure debugger
 * Call this when step navigation fails
 */
export const debugNavigationFailure = (requestedStepId: string, context: string = 'navigation') => {
  console.group(`🚨 [NAVIGATION FAILURE DEBUG] Step: ${requestedStepId}, Context: ${context}`)
  
  const targetState = workflowStateManager.getStepState(requestedStepId)
  const targetAccessible = workflowStateManager.isStepAccessible(requestedStepId)
  const currentStep = workflowStateManager.getCurrentStep()
  const allSteps = workflowStateManager.getAllSteps()
  
  console.log('🔧 [DEBUG] Navigation failure analysis:', {
    requestedStepId,
    targetState,
    targetAccessible,
    currentStep,
    stepExists: allSteps.has(requestedStepId),
    allAvailableSteps: Array.from(allSteps.keys()),
    stepStates: Array.from(allSteps.entries()).map(([id, step]) => ({
      id,
      state: step.stateMetadata.state,
      accessible: workflowStateManager.isStepAccessible(id)
    }))
  })
  
  // Special check for step 1 navigation failures
  if (requestedStepId === 'input-file') {
    console.log('🚨 [CRITICAL] Step 1 navigation failure - this should never happen!', {
      step1State: targetState,
      step1Accessible: targetAccessible,
      step1Exists: allSteps.has('input-file'),
      isAlreadyOnStep1: currentStep === 'input-file'
    })
  }
  
  debugRaceCondition('navigation-failure')
  console.groupEnd()
}

/**
 * Initialization debugger
 * Call this during component/hook initialization to track initialization order
 */
// Track initialization calls to prevent spam
let initDebugCount = 0
const MAX_INIT_DEBUG_CALLS = 10  // Limit to prevent spam

export const debugInitialization = (componentName: string, phase: 'start' | 'end' = 'start') => {
  // Only log first 10 initialization calls to prevent spam
  if (initDebugCount < MAX_INIT_DEBUG_CALLS) {
    console.log(`🔧 [INIT DEBUG] ${componentName} - ${phase}`, {
      timestamp: new Date().toISOString(),
      currentStep: workflowStateManager.getCurrentStep(),
      stepsCount: workflowStateManager.getAllSteps().size,
      recentCalls: getDebugCallStack().slice(-5),
      debugCallCount: initDebugCount + 1
    })
    initDebugCount++
  } else if (initDebugCount === MAX_INIT_DEBUG_CALLS) {
    console.log(`🔧 [INIT DEBUG] Reached max debug calls (${MAX_INIT_DEBUG_CALLS}) - further calls suppressed`)
    initDebugCount++
  }
}

/**
 * Workspace restoration debugger
 * Call this when workspace restoration might be interfering with workflow state
 */
export const debugWorkspaceRestoration = (phase: 'before' | 'after', workspaceData?: any) => {
  console.log(`🔧 [WORKSPACE DEBUG] Restoration ${phase}`, {
    timestamp: new Date().toISOString(),
    currentStep: workflowStateManager.getCurrentStep(),
    workspaceData: workspaceData ? Object.keys(workspaceData) : 'none',
    hasWorkspaceData: !!workspaceData
  })
  
  if (phase === 'after') {
    // Check if workspace restoration affected the default step
    const currentStep = workflowStateManager.getCurrentStep()
    if (currentStep !== 'input-file') {
      console.warn('🚨 [WORKSPACE WARNING] Workspace restoration may have changed default step!', {
        currentStep,
        expectedDefault: 'input-file',
        possibleRaceCondition: true
      })
    }
  }
}

/**
 * Continuous monitoring for race conditions
 * Set up watchers for specific patterns that indicate race conditions
 */
export const startRaceConditionMonitoring = () => {
  console.log('🔧 [DEBUG] Starting race condition monitoring...')
  
  // Monitor for unexpected step changes
  let lastKnownStep = workflowStateManager.getCurrentStep()
  const checkInterval = setInterval(() => {
    const currentStep = workflowStateManager.getCurrentStep()
    if (currentStep !== lastKnownStep) {
      console.log('🔧 [MONITOR] Step change detected:', {
        from: lastKnownStep,
        to: currentStep,
        timestamp: new Date().toISOString(),
        recentCalls: getDebugCallStack().slice(-3)
      })
      lastKnownStep = currentStep
    }
  }, 100) // Check every 100ms
  
  // Clean up after 30 seconds to avoid infinite monitoring
  setTimeout(() => {
    clearInterval(checkInterval)
    console.log('🔧 [DEBUG] Race condition monitoring stopped after 30 seconds')
  }, 30000)
  
  return () => clearInterval(checkInterval)
}

/**
 * Export helper for easy debugging from console
 */
export const debug = {
  raceCondition: debugRaceCondition,
  navigation: debugNavigationFailure,
  init: debugInitialization,
  workspace: debugWorkspaceRestoration,
  state: debugWorkflowState,
  calls: getDebugCallStack,
  monitor: startRaceConditionMonitoring
}

// Make debug tools available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).workflowDebug = debug
}