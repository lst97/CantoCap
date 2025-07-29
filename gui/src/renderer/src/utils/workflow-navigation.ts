/**
 * Workflow navigation utilities
 */

import { useWorkflowStore } from '../stores/workflow-store'

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