/**
 * React Hook for Workflow State Transitions
 * Provides easy access to atomic workflow state operations
 * with proper error handling and type safety
 */

import { useCallback } from 'react'
import {
  atomicFileUpload,
  atomicVideoRemoval,
  atomicJsonNavigation,
  atomicProcessingStart,
  atomicProcessingComplete,
  atomicProcessingError,
  atomicExportComplete,
  atomicStepError,
  stepStateController
} from '../utils/step-state-controller'

/**
 * Custom hook for workflow state transitions
 * Provides atomic operations for all workflow state changes
 */
export function useWorkflowStateTransitions() {
  // Video and file management
  const handleVideoUpload = useCallback(async (filePath: string) => {
    await atomicFileUpload('video', filePath)
  }, [])

  const handleVideoRemoval = useCallback(async () => {
    await atomicVideoRemoval()
  }, [])

  const handleJsonUpload = useCallback(async (filePath: string) => {
    await atomicFileUpload('json', filePath, {
      completeInputStep: true,
      skipToStep: 'review'
    })
  }, [])

  const handleJsonImportAfterVideo = useCallback(async (context?: any) => {
    await atomicJsonNavigation(context)
  }, [])

  // Workflow progression  
  const handleConfigurationComplete = useCallback(async () => {
    await atomicProcessingStart() // This starts subtitle generation
  }, [])

  const handleProcessingStart = useCallback(async () => {
    await atomicProcessingStart()
  }, [])

  const handleProcessingComplete = useCallback(async () => {
    await atomicProcessingComplete()
  }, [])

  const handleProcessingError = useCallback(async (errorMessage: string = 'Processing failed') => {
    await atomicProcessingError(errorMessage)
  }, [])

  const handleReviewComplete = useCallback(async () => {
    await atomicExportComplete() // Complete export workflow
  }, [])

  // Error and warning management
  const handleStepError = useCallback(async (
    stepId: string, 
    errorMessage: string, 
    severity: 'error' | 'warning' = 'error'
  ) => {
    await atomicStepError(stepId, errorMessage, severity)
  }, [])

  const handleStepWarning = useCallback(async (stepId: string, warningMessage: string) => {
    await atomicStepError(stepId, warningMessage, 'warning')
  }, [])

  const handleClearStepError = useCallback(async (stepId: string) => {
    // Use step error with a clear message to reset state
    await atomicStepError(stepId, '', 'error') // This will need to be handled in the controller
  }, [])

  // Utility functions
  const isOperationInProgress = useCallback(() => {
    return stepStateController.isOperationInProgress()
  }, [])

  const waitForOperations = useCallback(async () => {
    await stepStateController.waitForOperations()
  }, [])

  return {
    // Video and file management
    handleVideoUpload,
    handleVideoRemoval,
    handleJsonUpload,
    handleJsonImportAfterVideo,

    // Workflow progression
    handleConfigurationComplete,
    handleProcessingStart,
    handleProcessingComplete,
    handleProcessingError,
    handleReviewComplete,

    // Error and warning management
    handleStepError,
    handleStepWarning,
    handleClearStepError,

    // Utility functions
    isOperationInProgress,
    waitForOperations
  }
}

/**
 * Hook for step-specific error handling
 * Provides utilities for managing errors within a specific step context
 */
export function useStepErrorHandling(stepId: string) {
  const { handleStepError, handleStepWarning, handleClearStepError } = useWorkflowStateTransitions()

  const markError = useCallback(async (
    errorMessage: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    await handleStepError(stepId, errorMessage, severity)
  }, [stepId, handleStepError])

  const markWarning = useCallback(async (warningMessage: string) => {
    await handleStepWarning(stepId, warningMessage)
  }, [stepId, handleStepWarning])

  const clearError = useCallback(async () => {
    await handleClearStepError(stepId)
  }, [stepId, handleClearStepError])

  return {
    markError,
    markWarning,
    clearError
  }
}

/**
 * Hook for processing-specific state management
 * Handles the complex processing workflow states
 */
export function useProcessingStateManagement() {
  const {
    handleProcessingStart,
    handleProcessingComplete,
    handleProcessingError
  } = useWorkflowStateTransitions()

  const startProcessing = useCallback(async () => {
    console.log('🎬 Starting processing workflow')
    await handleProcessingStart()
  }, [handleProcessingStart])

  const completeProcessing = useCallback(async () => {
    console.log('✅ Completing processing workflow')
    await handleProcessingComplete()
  }, [handleProcessingComplete])

  const errorProcessing = useCallback(async (errorMessage: string) => {
    console.log('❌ Processing failed:', errorMessage)
    await handleProcessingError(errorMessage)
  }, [handleProcessingError])

  return {
    startProcessing,
    completeProcessing,
    errorProcessing
  }
}

/**
 * Hook for file upload state management
 * Handles both video and JSON upload workflows
 */
export function useFileUploadStateManagement() {
  const {
    handleVideoUpload,
    handleVideoRemoval,
    handleJsonUpload,
    handleJsonImportAfterVideo
  } = useWorkflowStateTransitions()

  const uploadVideo = useCallback(async (filePath: string) => {
    console.log('📹 Uploading video file:', filePath)
    await handleVideoUpload(filePath)
  }, [handleVideoUpload])

  const removeVideo = useCallback(async () => {
    console.log('🗑️ Removing video file')
    await handleVideoRemoval()
  }, [handleVideoRemoval])

  const uploadJson = useCallback(async (filePath: string) => {
    console.log('📄 Uploading JSON file:', filePath)
    await handleJsonUpload(filePath)
  }, [handleJsonUpload])

  const importJsonAfterVideo = useCallback(async () => {
    console.log('📊 Importing JSON after video upload')
    await handleJsonImportAfterVideo()
  }, [handleJsonImportAfterVideo])

  return {
    uploadVideo,
    removeVideo,
    uploadJson,
    importJsonAfterVideo
  }
}