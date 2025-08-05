/**
 * React state management utilities for enhanced workflow integration
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkflowState } from '../hooks/useWorkflowStateManager'
import { useAppStore } from '../stores/app-store'
import { workflowStateManager } from '../services/workflow/workflow-state-manager'
import { StepState } from '../types/workflow-state'
// Modern workflow state management using WorkflowStateManager

export interface ReactStateOptions {
  autoSync?: boolean
  syncInterval?: number
  enableOptimisticUpdates?: boolean
  errorRecovery?: boolean
}

/**
 * Enhanced hook for workflow state integration with React components
 * Provides automatic synchronization and optimistic updates
 */
export const useWorkflowIntegration = (options: ReactStateOptions = {}) => {
  const {
    autoSync = true,
    syncInterval = 5000,
    enableOptimisticUpdates = true,
    errorRecovery = true
  } = options

  const { currentStepId, steps } = useWorkflowState()
  const appStore = useAppStore()
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncRef = useRef<number>(0)

  // Automatic synchronization
  useEffect(() => {
    if (!autoSync) return

    const performSync = async () => {
      const now = Date.now()
      if (now - lastSyncRef.current < syncInterval) return

      try {
        console.log('🔧 [DEBUG] react-state-utils: Performing automatic workflow state sync', {
          timestamp: new Date().toISOString(),
          currentStepBefore: workflowStateManager.getCurrentStep(),
          stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
        })

        await workflowStateManager.loadState()
        lastSyncRef.current = now
        
        console.log('🔄 [DEBUG] Automatic workflow state sync completed', {
          timestamp: new Date().toISOString(),
          currentStepAfter: workflowStateManager.getCurrentStep()
        })
      } catch (error) {
        console.warn('⚠️ [DEBUG] Automatic sync failed:', error)
        if (errorRecovery) {
          // Attempt basic error recovery
          try {
            console.log('🔧 [DEBUG] Attempting error recovery sync')
            await workflowStateManager.loadState()
          } catch (recoveryError) {
            console.error('❌ [DEBUG] Error recovery failed:', recoveryError)
          }
        }
      }
    }

    // Initial sync
    performSync()

    // Set up interval
    syncIntervalRef.current = setInterval(performSync, syncInterval)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [autoSync, syncInterval, errorRecovery])

  // Optimistic navigation helper
  const performOptimisticNavigation = useCallback(async (
    operation: () => Promise<any>,
    optimisticUpdate?: () => void,
    rollback?: () => void
  ) => {
    if (!enableOptimisticUpdates) {
      return await operation()
    }

    try {
      // Apply optimistic update
      if (optimisticUpdate) {
        optimisticUpdate()
      }

      // Perform actual operation
      const result = await operation()
      
      return result
    } catch (error) {
      console.error('❌ Optimistic operation failed:', error)
      
      // Rollback optimistic changes
      if (rollback) {
        rollback()
      }
      
      if (errorRecovery) {
        console.log('🔧 [DEBUG] react-state-utils: Error recovery - performing loadState()', {
          timestamp: new Date().toISOString(),
          currentStepBefore: workflowStateManager.getCurrentStep()
        })
        await workflowStateManager.loadState()
        console.log('🔧 [DEBUG] react-state-utils: Error recovery loadState() completed', {
          timestamp: new Date().toISOString(),
          currentStepAfter: workflowStateManager.getCurrentStep()
        })
      }
      
      throw error
    }
  }, [enableOptimisticUpdates, errorRecovery])

  // Enhanced notification with workflow context
  const showWorkflowNotification = useCallback((
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    workflowContext?: {
      currentStep?: string
      operation?: string
      metadata?: Record<string, any>
    }
  ) => {
    const contextualMessage = workflowContext 
      ? `[${workflowContext.currentStep || 'Unknown'}] ${message}`
      : message

    appStore.showNotification(contextualMessage, type)
    
    // Log with full context for debugging
    console.log(`📢 Workflow notification [${type}]:`, {
      message: contextualMessage,
      context: workflowContext,
      timestamp: new Date().toISOString()
    })
  }, [appStore])

  // State consistency checker
  const checkStateConsistency = useCallback((): boolean => {
    try {
      // Basic consistency checks using modern state
      const hasValidCurrentStep = steps.some(s => s.id === currentStepId)
      const hasValidStepProgression = steps.every((step, index) => {
        if (index === 0) return step.stateMetadata.state === StepState.Ready || step.stateMetadata.state === StepState.Complete
        
        const prevStep = steps[index - 1]
        const isAccessible = step.stateMetadata.state === StepState.Ready || step.stateMetadata.state === StepState.Complete
        const prevCompleted = prevStep.stateMetadata.state === StepState.Complete || prevStep.stateMetadata.state === StepState.Skip
        
        return !isAccessible || prevCompleted
      })
      
      const isConsistent = hasValidCurrentStep && hasValidStepProgression
      
      if (!isConsistent) {
        console.warn('⚠️ Workflow state inconsistency detected:', {
          hasValidCurrentStep,
          hasValidStepProgression,
          currentStep: currentStepId,
          stepStates: steps.map(s => ({ 
            id: s.id, 
            state: s.stateMetadata.state,
            isAccessible: s.stateMetadata.state === StepState.Ready || s.stateMetadata.state === StepState.Complete
          }))
        })
      }
      
      return isConsistent
    } catch (error) {
      console.error('❌ State consistency check failed:', error)
      return false
    }
  }, [steps, currentStepId])

  return {
    currentStepId,
    steps,
    appStore,
    performOptimisticNavigation,
    showWorkflowNotification,
    checkStateConsistency,
    synchronizeState: () => {
      console.log('🔧 [DEBUG] react-state-utils: synchronizeState() called', {
        timestamp: new Date().toISOString(),
        currentStepBefore: workflowStateManager.getCurrentStep(),
        stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
      })
      return workflowStateManager.loadState()
    }
  }
}

/**
 * React hook for managing loading states during workflow operations
 */
export const useWorkflowLoading = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  
  const setLoading = useCallback((operation: string, isLoading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [operation]: isLoading }))
  }, [])
  
  const isLoading = useCallback((operation?: string) => {
    if (operation) {
      return loadingStates[operation] || false
    }
    return Object.values(loadingStates).some(Boolean)
  }, [loadingStates])
  
  const withLoading = useCallback(async <T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    setLoading(operation, true)
    try {
      return await fn()
    } finally {
      setLoading(operation, false)
    }
  }, [setLoading])
  
  return { setLoading, isLoading, withLoading }
}

// Export useState for convenience
export { useState }