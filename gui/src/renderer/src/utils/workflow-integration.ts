import { useWorkflowStore } from '../stores/workflow-store'
import { useExportStore } from '../stores/export-store'

/**
 * Integration utilities for connecting export operations with the workflow
 */

/**
 * Mark the export step as completed when a successful export is done
 */
export const completeExportStep = () => {
  const workflowStore = useWorkflowStore.getState()
  workflowStore.completeStep('export')
}

/**
 * Check if export step should be accessible based on processing completion
 */
export const checkExportAccessibility = () => {
  const workflowStore = useWorkflowStore.getState()
  const processingStep = workflowStore.steps.find(s => s.id === 'processing')
  
  return processingStep?.isCompleted || false
}

/**
 * Navigate to export step when subtitles are ready
 */
export const navigateToExport = () => {
  const workflowStore = useWorkflowStore.getState()
  
  if (checkExportAccessibility()) {
    workflowStore.setCurrentStep('export')
  }
}

/**
 * Subscribe to export completion and update workflow
 */
export const setupExportWorkflowIntegration = () => {
  // Subscribe to export progress completion
  const unsubscribe = useExportStore.subscribe(
    (state) => state.progress,
    (progress, previousProgress) => {
      // When export completes successfully, mark step as completed
      if (progress.stage === 'completed' && previousProgress?.stage !== 'completed') {
        completeExportStep()
      }
    },
    { equalityFn: (a, b) => a.stage === b.stage }
  )

  return unsubscribe
}

/**
 * Reset export state when starting a new workflow
 */
export const resetExportForNewWorkflow = () => {
  const exportStore = useExportStore.getState()
  
  // Clear any previous state
  exportStore.clearPreview()
  
  // Reset progress if not currently exporting
  if (!exportStore.progress.isExporting) {
    useExportStore.setState({
      progress: {
        isExporting: false,
        stage: 'preparing',
        progress: 0,
        message: 'Ready to export',
        currentStep: 0,
        totalSteps: 0
      },
      error: null
    })
  }
}

/**
 * Auto-generate export preview when subtitles are available
 */
export const autoGenerateExportPreview = (subtitles: any[]) => {
  const exportStore = useExportStore.getState()
  
  // Only generate preview if we have subtitles and no current preview
  if (subtitles.length > 0 && !exportStore.preview) {
    exportStore.generatePreview(subtitles)
  }
}