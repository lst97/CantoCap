/**
 * React state management utilities for enhanced workflow integration
 */

import { useCallback, useEffect, useRef } from 'react'
import { useWorkflowStore } from '../stores/workflow-store'
import { useAppStore } from '../stores/app-store'
import { synchronizeWorkflowState } from './workflow-navigation'

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

  const workflowStore = useWorkflowStore()
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
        await synchronizeWorkflowState()
        lastSyncRef.current = now
        console.log('🔄 Automatic workflow state sync completed')
      } catch (error) {
        console.warn('⚠️ Automatic sync failed:', error)
        if (errorRecovery) {
          // Attempt basic error recovery
          try {
            workflowStore.initializeFromWorkspace()
          } catch (recoveryError) {
            console.error('❌ Error recovery failed:', recoveryError)
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
  }, [autoSync, syncInterval, errorRecovery, workflowStore])

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
        await synchronizeWorkflowState()
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
      const currentState = workflowStore.getState()
      
      // Basic consistency checks
      const hasValidCurrentStep = currentState.steps.some(s => s.id === currentState.currentStep)
      const hasValidStepProgression = currentState.steps.every((step, index) => {
        if (index === 0) return step.isAccessible // First step should always be accessible
        
        const prevStep = currentState.steps[index - 1]
        return !step.isAccessible || prevStep.isCompleted || prevStep.isSkipped
      })
      
      const isConsistent = hasValidCurrentStep && hasValidStepProgression
      
      if (!isConsistent) {
        console.warn('⚠️ Workflow state inconsistency detected:', {
          hasValidCurrentStep,
          hasValidStepProgression,
          currentStep: currentState.currentStep,
          stepStates: currentState.steps.map(s => ({ 
            id: s.id, 
            isCompleted: s.isCompleted, 
            isAccessible: s.isAccessible 
          }))
        })
      }
      
      return isConsistent
    } catch (error) {
      console.error('❌ State consistency check failed:', error)
      return false
    }
  }, [workflowStore])

  return {
    workflowStore,
    appStore,
    performOptimisticNavigation,
    showWorkflowNotification,
    checkStateConsistency,
    synchronizeState: synchronizeWorkflowState
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

// Re-export useState for convenience
import { useState } from 'react'
export { useState }