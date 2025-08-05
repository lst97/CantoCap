import React, { createContext, useContext, ReactNode, useMemo, useCallback, useRef } from 'react'
import { workflowStateManager } from '../services/workflow/workflow-state-manager'
import { useWorkflowState as useWorkflowStateHook } from '../hooks/useWorkflowStateManager'
import { StepId, AnyWorkflowStepState, StepState } from '../types/workflow-state'

// Context type definition  
interface WorkflowStateContextType {
  currentStep: string
  currentStepId: string  // Alias for backward compatibility
  steps: ReadonlyMap<StepId, AnyWorkflowStepState>  // Map for direct access
  stepsArray: AnyWorkflowStepState[]  // Array for component iteration
  _updateCount: number
  getAllSteps: () => ReadonlyMap<StepId, AnyWorkflowStepState>
  navigateToStep: (stepId: string) => void
  isStepAccessible: (stepId: string) => boolean
  isStepComplete: (stepId: string) => boolean
  getStepState: (stepId: string) => StepState | null
}

// Create the context
const WorkflowStateContext = createContext<WorkflowStateContextType | null>(null)

// Provider component
interface WorkflowStateProviderProps {
  children: ReactNode
}

export const WorkflowStateProvider: React.FC<WorkflowStateProviderProps> = React.memo(({ children }) => {
  // Single instance of the workflow state hook
  const workflowState = useWorkflowStateHook()
  
  // Only log in development and limit frequency
  const lastLogRef = useRef<number>(0)
  const now = Date.now()
  if (process.env.NODE_ENV === 'development' && now - lastLogRef.current > 1000) {
    console.log('🔧 [SINGLETON] WorkflowStateProvider: Creating single workflow state instance', {
      timestamp: new Date().toISOString(),
      currentStepId: workflowState.currentStepId,
      currentStepTitle: workflowState.currentStep?.title || 'Unknown'
    })
    lastLogRef.current = now
  }
  
  // Stabilized callback functions to prevent recreation
  const getAllSteps = useCallback(() => workflowStateManager.getAllSteps(), [])
  const navigateToStep = useCallback((stepId: string) => workflowStateManager.setCurrentStep(stepId), [])
  const isStepAccessible = useCallback((stepId: string) => workflowStateManager.isStepAccessible(stepId), [])
  const isStepComplete = useCallback((stepId: string) => workflowStateManager.isStepComplete(stepId), [])
  const getStepState = useCallback((stepId: string) => workflowStateManager.getStepState(stepId), [])
  
  // Optimized memoization with stable references
  const contextValue = useMemo<WorkflowStateContextType>(() => ({
    currentStep: workflowState.currentStepId,
    currentStepId: workflowState.currentStepId,
    steps: workflowState.allSteps || workflowStateManager.getAllSteps(),  // Map for direct access
    stepsArray: workflowState.steps || [],  // Array from hook for component iteration
    _updateCount: workflowState._updateCount || 0,
    getAllSteps,
    navigateToStep,
    isStepAccessible,
    isStepComplete,
    getStepState
  }), [
    workflowState.currentStepId, 
    workflowState.allSteps,
    workflowState.steps,  // Add steps array dependency
    workflowState._updateCount,
    getAllSteps,
    navigateToStep,
    isStepAccessible,
    isStepComplete,
    getStepState
  ])
  
  return (
    <WorkflowStateContext.Provider value={contextValue}>
      {children}
    </WorkflowStateContext.Provider>
  )
})

WorkflowStateProvider.displayName = 'WorkflowStateProvider'

// Custom hook to consume the context with optimized logging
export const useWorkflowStateContext = (): WorkflowStateContextType => {
  const context = useContext(WorkflowStateContext)
  
  if (!context) {
    throw new Error('useWorkflowStateContext must be used within a WorkflowStateProvider')
  }
  
  // Throttled logging to prevent render cascade spam
  const logRef = useRef<{ lastLog: number; lastStepId: string }>({ lastLog: 0, lastStepId: '' })
  const now = Date.now()
  const shouldLog = process.env.NODE_ENV === 'development' && 
    (now - logRef.current.lastLog > 2000 || logRef.current.lastStepId !== context.currentStepId)
  
  if (shouldLog) {
    console.log('🔧 [SINGLETON] useWorkflowStateContext: Using shared workflow state', {
      timestamp: new Date().toISOString(),
      currentStepId: context.currentStepId,
      currentStepTitle: context.steps.get(context.currentStepId as StepId)?.title || 'Unknown'
    })
    logRef.current = { lastLog: now, lastStepId: context.currentStepId }
  }
  
  return context
}

// Re-export the singleton context hook as the main workflow state hook
export const useWorkflowState = useWorkflowStateContext