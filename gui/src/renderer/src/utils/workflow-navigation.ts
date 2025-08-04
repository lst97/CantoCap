/**
 * Workflow navigation utilities with atomic operations and error recovery
 */

import { workflowStateManager } from '../services/workflow-state-manager'
import { StepState } from '../types/workflow-state'

// Type definitions for navigation
export interface NavigationContext {
  sourceType: 'regular' | 'json-import' | 'manual'
  timestamp: number
  metadata?: Record<string, any>
}

export interface NavigationResult {
  success: boolean
  error?: string
  rollbackFn?: () => void
}

export const navigateToProcessing = async (): Promise<NavigationResult> => {
  try {
    // Complete previous steps and navigate to processing using WorkflowStateManager
    await workflowStateManager.transitionState('input-file', StepState.Complete, {
      reason: 'Navigation to processing - completing input step'
    })
    
    await workflowStateManager.transitionState('config', StepState.Complete, {
      reason: 'Navigation to processing - completing config step'
    })
    
    const success = workflowStateManager.setCurrentStep('processing')
    
    return { success }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to navigate to processing step'
    console.error('Failed to navigate to processing step:', error)
    return { success: false, error: errorMessage }
  }
}

export const navigateToConfig = async (): Promise<NavigationResult> => {
  try {
    const success = workflowStateManager.setCurrentStep('config')
    return { success }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to navigate to config step'
    console.error('Failed to navigate to config step:', error)
    return { success: false, error: errorMessage }
  }
}

export const navigateToReview = async (): Promise<NavigationResult> => {
  try {
    // Complete processing step and navigate to review using WorkflowStateManager
    await workflowStateManager.transitionState('processing', StepState.Complete, {
      reason: 'Navigation to review - completing processing step'
    })
    
    const success = workflowStateManager.setCurrentStep('review')
    
    return { success }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to navigate to review step'
    console.error('Failed to navigate to review step:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Navigate to Review step from JSON import
 */
export const navigateToReviewFromJsonImport = async (context?: NavigationContext): Promise<NavigationResult> => {
  console.log('🚀 Starting JSON import navigation to Review step')
  
  try {
    // Complete input-file step if not already completed
    const inputStepState = workflowStateManager.getStepState('input-file')
    if (inputStepState !== StepState.Complete) {
      await workflowStateManager.transitionState('input-file', StepState.Complete, {
        reason: 'JSON import - completing input step'
      })
    }
    
    // Skip config and processing steps for JSON import
    await workflowStateManager.transitionState('config', StepState.Skip, {
      reason: 'JSON import - config not needed'
    })
    
    await workflowStateManager.transitionState('processing', StepState.Skip, {
      reason: 'JSON import - processing not needed'
    })
    
    // Enable and navigate to review step
    await workflowStateManager.transitionState('review', StepState.Ready, {
      reason: 'JSON import - ready for review'
    })
    
    await workflowStateManager.transitionState('export', StepState.Ready, {
      reason: 'JSON import - ready for export'
    })
    
    const success = workflowStateManager.setCurrentStep('review')
    
    console.log('✅ JSON import navigation completed successfully')
    return { success }
  } catch (error) {
    console.error('❌ JSON import navigation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Navigation failed'
    }
  }
}

/**
 * Navigate to Review step from processing completion
 */
export const navigateToReviewFromProcessing = async (): Promise<NavigationResult> => {
  console.log('🚀 Starting processing-to-review navigation')
  
  try {
    // CRITICAL FIX: Prevent navigation to review if app is still initializing
    if (!workflowStateManager.initializationComplete) {
      console.warn('⚠️ Cannot navigate to review during app initialization - staying on input-file')
      return {
        success: false,
        error: 'Navigation blocked during app initialization'
      }
    }
    
    // Validate processing step is completed
    const processingStepState = workflowStateManager.getStepState('processing')
    if (processingStepState !== StepState.Complete) {
      throw new Error('Processing step must be completed before navigating to review')
    }
    
    // Enable review and export steps
    await workflowStateManager.transitionState('review', StepState.Ready, {
      reason: 'Processing complete - ready for review'
    })
    
    await workflowStateManager.transitionState('export', StepState.Ready, {
      reason: 'Processing complete - ready for export'
    })
    
    const success = workflowStateManager.setCurrentStep('review')
    
    console.log('✅ Processing navigation completed')
    return { success }
  } catch (error) {
    console.error('❌ Processing navigation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Navigation failed'
    }
  }
}