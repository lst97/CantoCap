/**
 * Workflow navigation utilities with atomic operations and error recovery
 */

import { useWorkflowStore } from '../stores/workflow-store'

// Declare global validation store for post-navigation validation
declare global {
  interface Window {
    __workflowValidationStore?: any;
    useWorkflowValidationStore?: any;
  }
}

// Type definitions for enhanced navigation
export interface NavigationContext {
  sourceType: 'regular' | 'json-import' | 'manual'
  timestamp: number
  metadata?: Record<string, any>
}

export interface NavigationResult {
  success: boolean
  error?: string
  previousState?: any
  rollbackFn?: () => void
}

/**
 * State synchronization utility for ensuring workflow state consistency
 */
export const synchronizeWorkflowState = async (): Promise<boolean> => {
  try {
    const workflowStore = useWorkflowStore.getState()
    
    // Re-initialize from workspace to ensure consistency
    await workflowStore.initializeFromWorkspace()
    
    console.log('🔄 Workflow state synchronized with workspace')
    return true
  } catch (error) {
    console.error('❌ Failed to synchronize workflow state:', error)
    return false
  }
}

export const navigateToProcessing = () => {
  try {
    const { setCurrentStep, completeStep } = useWorkflowStore.getState()
    
    // Complete previous steps and navigate to processing
    completeStep('input-file')
    completeStep('config')
    setCurrentStep('processing')
  } catch (error) {
    console.error('Failed to navigate to processing step:', error)
  }
}

export const navigateToConfig = () => {
  try {
    const { setCurrentStep } = useWorkflowStore.getState()
    setCurrentStep('config')
  } catch (error) {
    console.error('Failed to navigate to config step:', error)
  }
}

export const navigateToReview = () => {
  try {
    const { setCurrentStep, completeStep } = useWorkflowStore.getState()
    
    completeStep('processing')
    setCurrentStep('review')
  } catch (error) {
    console.error('Failed to navigate to review step:', error)
  }
}

/**
 * Enhanced atomic navigation for JSON import to Review step
 * Provides rollback capability and comprehensive error handling
 */
export const navigateToReviewFromJsonImport = (context?: NavigationContext): NavigationResult => {
  console.log('🚀 Starting atomic JSON import navigation to Review step')
  
  const navigationContext: NavigationContext = {
    sourceType: 'json-import',
    timestamp: Date.now(),
    ...context
  }
  
  // Use the workflow store's atomic operation for enhanced state management
  const workflowStore = useWorkflowStore.getState()
  
  return workflowStore.executeAtomicOperation(() => {
    // Step 1: Validate current state
    const inputStep = workflowStore.steps.find(s => s.id === 'input-file')
    if (!inputStep || !inputStep.isCompleted) {
      throw new Error('Input file step must be completed before JSON import navigation')
    }
    
    // Step 2: Mark input-file as completed (defensive)
    workflowStore.completeStep('input-file')
    
    // Step 3: Set import context for all affected steps
    workflowStore.setStepImportContext('config', navigationContext)
    workflowStore.setStepImportContext('processing', navigationContext)
    workflowStore.setStepImportContext('review', navigationContext)
    
    // Step 4: Skip and mark config and processing steps appropriately for JSON import
    const configStep = workflowStore.steps.find(s => s.id === 'config')
    const processingStep = workflowStore.steps.find(s => s.id === 'processing')
    
    if (configStep) {
      // Mark config as skipped since we're importing pre-configured subtitles
      workflowStore.markStepAsSkipped('config')
    }
    
    if (processingStep) {
      // Mark processing as skipped since subtitles are already processed
      workflowStore.markStepAsSkipped('processing')
    }
    
    // Step 5: Enable and navigate to review step
    workflowStore.enableStep('review')
    workflowStore.setCurrentStep('review')
    
    // Step 6: Enable export step since we have complete subtitle data
    workflowStore.enableStep('export')
    
    // Step 7: Force validation update for the new workflow state
    // This ensures that validation checks the updated step states immediately
    setTimeout(() => {
      // Import validation store dynamically to avoid circular dependencies
      try {
        const validationStore = window.__workflowValidationStore || 
          (typeof useWorkflowValidationStore !== 'undefined' && useWorkflowValidationStore.getState());
        
        if (validationStore && typeof validationStore.validateAllSteps === 'function') {
          validationStore.validateAllSteps().catch(error => {
            console.warn('⚠️ Post-navigation validation failed:', error);
          });
        }
      } catch (error) {
        console.warn('⚠️ Could not trigger post-navigation validation:', error);
      }
    }, 100); // Small delay to ensure state changes are flushed
    
    console.log('✅ Atomic JSON import navigation completed successfully', {
      context: navigationContext,
      targetStep: 'review',
      skippedSteps: ['config', 'processing'],
      enabledSteps: ['review', 'export']
    })
  })
}

/**
 * Enhanced atomic navigation for regular processing flow
 */
export const navigateToReviewFromProcessing = (context?: NavigationContext): NavigationResult => {
  console.log('🚀 Starting atomic processing-to-review navigation')
  
  const navigationContext: NavigationContext = {
    sourceType: 'regular',
    timestamp: Date.now(),
    ...context
  }
  
  const workflowStore = useWorkflowStore.getState()
  
  return workflowStore.executeAtomicOperation(() => {
    // Validate processing step is completed
    const processingStep = workflowStore.steps.find(s => s.id === 'processing')
    if (!processingStep || !processingStep.isCompleted) {
      throw new Error('Processing step must be completed before navigating to review')
    }
    
    // Set context for review step
    workflowStore.setStepImportContext('review', navigationContext)
    
    // Enable review and export steps
    workflowStore.enableStep('review')
    workflowStore.enableStep('export')
    workflowStore.setCurrentStep('review')
    
    console.log('✅ Atomic processing navigation completed', navigationContext)
  })
}

/**
 * Generic atomic step navigation with context awareness
 */
export const navigateToStepAtomic = (
  targetStepId: string, 
  context?: NavigationContext
): NavigationResult => {
  console.log(`🚀 Starting atomic navigation to step: ${targetStepId}`)
  
  const navigationContext: NavigationContext = {
    sourceType: context?.sourceType || 'manual',
    timestamp: Date.now(),
    ...context
  }
  
  const workflowStore = useWorkflowStore.getState()
  
  return workflowStore.executeAtomicOperation(() => {
    // Validate target step exists
    const targetStep = workflowStore.steps.find(s => s.id === targetStepId)
    if (!targetStep) {
      throw new Error(`Target step '${targetStepId}' not found`)
    }
    
    // Set context for the target step
    workflowStore.setStepImportContext(targetStepId, navigationContext)
    
    // Enable the target step if not already accessible
    if (!targetStep.isAccessible) {
      workflowStore.enableStep(targetStepId)
    }
    
    // Navigate to the step
    workflowStore.setCurrentStep(targetStepId)
    
    console.log(`✅ Atomic navigation to ${targetStepId} completed`, navigationContext)
  })
}