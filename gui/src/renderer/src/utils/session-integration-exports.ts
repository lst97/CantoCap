/**
 * Session Integration Exports
 * 
 * Convenience exports for components to use the integrated session management functions
 */

export { 
  handleJsonImportWithSessionReset,
  handleVideoRemovalWithCleanup,
  handleProcessingCompletionWithSessionSetup,
  performEnhancedSessionReset,
  handleWorkspaceChangeWithSessionCoordination,
  type IntegratedOperationResult
} from './session-workflow-integration'

export {
  navigateToReviewFromJsonImport,
  navigateToReviewFromProcessing,
  navigateToStepAtomic,
  synchronizeWorkflowState,
  type NavigationContext,
  type NavigationResult
} from './workflow-navigation'

// Additional convenience functions for common use cases

/**
 * Handle JSON import with complete session setup and navigation
 * This is the main function components should use for JSON imports
 */
export async function processJsonImportComplete(subtitleData: any[]) {
  const { handleJsonImportWithSessionReset } = await import('./session-workflow-integration')
  
  return handleJsonImportWithSessionReset(subtitleData, {
    sourceType: 'json-import',
    timestamp: Date.now(),
    metadata: { dataLength: subtitleData.length }
  })
}

/**
 * Handle processing completion with session setup and navigation
 * This is the main function processing components should use
 */
export async function processProcessingComplete(subtitleData: any[]) {
  const { handleProcessingCompletionWithSessionSetup } = await import('./session-workflow-integration')
  
  return handleProcessingCompletionWithSessionSetup(subtitleData, {
    sourceType: 'regular',
    timestamp: Date.now(),
    metadata: { dataLength: subtitleData.length }
  })
}

/**
 * Quick session reset with enhanced features
 * For use by components that need immediate session cleanup
 */
export async function quickSessionReset(reason: 'step1_import' | 'step1_video_change' | 'step3_generation') {
  const { performEnhancedSessionReset } = await import('./session-workflow-integration')
  
  return performEnhancedSessionReset(reason)
}