/**
 * Centralized Step State Controller
 * Prevents race conditions in workflow step management by providing atomic operations
 * and coordinating between multiple systems that need to update step states.
 */

import { workflowStateManager } from '../services/workflow-state-manager'
import { StepState, type StepId } from '../types/workflow-state'

class StepStateController {
  private isProcessing: boolean = false
  private operationId: number = 0

  /**
   * Executes atomic step operations to prevent race conditions
   */
  async executeAtomicStepOperation<T>(operation: () => T | Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
    const operationId = `atomic-${++this.operationId}-${Date.now()}`
    
    console.log(`🔄 Starting atomic step operation ${operationId}`, metadata)
    
    // Wait for any pending operations to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    this.isProcessing = true
    
    try {
      const result = await operation()
      console.log(`✅ Completed atomic step operation ${operationId}`)
      return result
    } catch (error) {
      console.error(`❌ Failed atomic step operation ${operationId}:`, error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Atomic video removal - All steps reset to Blocked except Step 1 (input-file) → Ready
   */
  async handleVideoRemoval(): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log('🗑️ Atomic video removal: resetting all steps to Blocked except input-file → Ready')
      
      // Reset all steps to Blocked first
      const allSteps: StepId[] = ['input-file', 'config', 'processing', 'review', 'export'] as StepId[]
      for (const stepId of allSteps) {
        if (stepId !== 'input-file') {
          await workflowStateManager.transitionState(stepId, StepState.Blocked, {
            reason: 'Video removed - step blocked'
          })
        }
      }
      
      // Set input-file to Ready state
      await workflowStateManager.transitionState('input-file', StepState.Ready, {
        reason: 'Video removed - ready for new input'
      })
      
      console.log('✅ Video removal atomic operation completed')
    }, { operation: 'video-removal' })
  }

  /**
   * Atomic file upload with coordinated step state updates
   * @param fileType - Type of file being uploaded ('video' | 'json')
   * @param filePath - Path to the uploaded file, null for file removal
   * @param options - Configuration options for upload behavior
   * @param options.resetSteps - Whether to reset downstream steps (default: false)
   * @param options.skipToStep - Step to skip to after upload (e.g., 'review' for JSON)
   * @param options.completeInputStep - Whether to mark input step as complete (default: true)
   * @throws {Error} When invalid parameters are provided
   */
  async handleFileUpload(
    fileType: 'video' | 'json', 
    filePath: string | null, 
    options: {
      resetSteps?: boolean
      skipToStep?: string
      completeInputStep?: boolean
    } = {}
  ): Promise<void> {
    // Input validation
    this.validateFileUploadInputs(fileType, filePath, options)
    
    return this.executeAtomicStepOperation(async () => {
      console.log(`📁 Atomic ${fileType} file upload:`, {
        filePath,
        options,
        currentStates: {
          inputFile: workflowStateManager.getStepState('input-file'),
          config: workflowStateManager.getStepState('config'),
          currentStep: workflowStateManager.getCurrentStep()
        },
        timestamp: new Date().toISOString()
      })
      
      if (filePath) {
        await this.processFileUpload(fileType, filePath, options)
        
        // Log final states after processing
        console.log('📁 File upload processing completed', {
          finalStates: {
            inputFile: workflowStateManager.getStepState('input-file'),
            config: workflowStateManager.getStepState('config'),
            currentStep: workflowStateManager.getCurrentStep()
          },
          expectedForVideo: fileType === 'video' ? 
            'inputFile: Complete, config: Ready' : 'varies',
          timestamp: new Date().toISOString()
        })
      } else {
        // File removed - call video removal logic
        console.log('📁 File removal detected, calling video removal logic')
        await this.handleVideoRemoval()
      }
    }, { fileType, filePath, options })
  }

  /**
   * Validates input parameters for file upload operations
   * @private
   */
  private validateFileUploadInputs(
    fileType: 'video' | 'json', 
    filePath: string | null, 
    options: Record<string, unknown>
  ): void {
    if (!['video', 'json'].includes(fileType)) {
      throw new Error(`Invalid file type: ${fileType}. Expected 'video' or 'json'`)
    }

    if (filePath !== null && typeof filePath !== 'string') {
      throw new Error(`Invalid file path type. Expected string or null, got ${typeof filePath}`)
    }

    if (filePath && filePath.trim().length === 0) {
      throw new Error('File path cannot be empty string')
    }

    if (options.skipToStep && typeof options.skipToStep !== 'string') {
      throw new Error(`Invalid skipToStep type. Expected string, got ${typeof options.skipToStep}`)
    }
  }

  /**
   * Checks if the current step states match expected video upload result
   * @private
   */
  private isVideoUploadStateCorrect(): boolean {
    const inputState = workflowStateManager.getStepState('input-file')
    const configState = workflowStateManager.getStepState('config')
    
    return inputState === StepState.Complete && configState === StepState.Ready
  }

  /**
   * Validates whether a reset operation is actually needed
   * @private
   */
  private shouldPerformReset(
    fileType: 'video' | 'json',
    filePath: string | null,
    options: { resetSteps?: boolean }
  ): boolean {
    // Don't reset if file path exists and states are already correct
    if (filePath && fileType === 'video' && this.isVideoUploadStateCorrect()) {
      console.log('🔧 [STATE PRESERVATION] Video upload states already correct, skipping reset')
      return false
    }

    // Only reset if explicitly requested or if file is being removed
    return options.resetSteps === true || filePath === null
  }

  /**
   * Processes file upload with type-specific logic
   * @private
   */
  private async processFileUpload(
    fileType: 'video' | 'json', 
    filePath: string, 
    options: {
      resetSteps?: boolean
      skipToStep?: string
      completeInputStep?: boolean
    }
  ): Promise<void> {
    const { resetSteps = false, skipToStep, completeInputStep = true } = options

    if (fileType === 'video') {
      await this.processVideoUpload(filePath, { resetSteps, completeInputStep })
    } else if (fileType === 'json') {
      await this.processJsonUpload(filePath, { skipToStep, completeInputStep })
    }
  }

  /**
   * Handles video file upload workflow
   * @private
   */
  private async processVideoUpload(
    filePath: string, 
    options: { resetSteps: boolean; completeInputStep: boolean }
  ): Promise<void> {
    const { resetSteps, completeInputStep } = options

    console.log('🔧 [VIDEO UPLOAD] Processing video upload', {
      filePath,
      resetSteps,
      completeInputStep,
      currentStates: {
        inputFile: workflowStateManager.getStepState('input-file'),
        config: workflowStateManager.getStepState('config')
      }
    })

    // Check if states are already correct to avoid unnecessary operations
    if (this.isVideoUploadStateCorrect()) {
      console.log('🔧 [STATE PRESERVATION] Video upload states already correct, preserving existing state')
      return
    }

    // Reset downstream steps only if needed and requested
    if (this.shouldPerformReset('video', filePath, { resetSteps })) {
      console.log('🔧 [VIDEO UPLOAD] Resetting downstream steps')
      await this.resetDownstreamSteps('File upload - resetting downstream steps')
    }

    // Complete input step (default behavior for video)
    if (completeInputStep) {
      await workflowStateManager.transitionState('input-file', StepState.Complete, {
        reason: 'Video file uploaded'
      })
    }

    // Enable config step for video uploads
    console.log('🔧 [DEBUG] About to set config to Ready state')
    
    // Enhanced debugging: show current states before transition
    console.log('🔧 [DEBUG] States before config transition:', {
      inputFileState: workflowStateManager.getStepState('input-file'),
      configState: workflowStateManager.getStepState('config'),
      allSteps: Array.from(workflowStateManager.getAllSteps().entries()).map(([id, step]) => ({
        id, 
        state: step.stateMetadata.state
      }))
    })
    
    const transitionResult = await workflowStateManager.transitionState('config', StepState.Ready, {
      reason: 'Video uploaded - config step ready'
    })
    
    // Check if transition was successful
    console.log('🔧 [DEBUG] Config transition result:', {
      success: transitionResult.success,
      error: transitionResult.error,
      errorCode: transitionResult.errorCode,
      timestamp: new Date().toISOString()
    })
    
    // Verify the state was set correctly
    const configStateAfterSet = workflowStateManager.getStepState('config')
    console.log('🔧 [DEBUG] Config state immediately after setting to Ready:', configStateAfterSet)
    
    // Check if transition was successful
    if (!transitionResult.success) {
      console.error('❌ [DEBUG] Config transition failed:', {
        error: transitionResult.error,
        errorCode: transitionResult.errorCode,
        reason: 'Transition was rejected by validation'
      })
    } else {
      console.log('✅ [DEBUG] Config transition succeeded')
    }

    // Automatically navigate to config step after video upload
    workflowStateManager.setCurrentStep('config')
    
    // Check state again after navigation
    const configStateAfterNav = workflowStateManager.getStepState('config')
    console.log('🔧 [DEBUG] Config state after navigation:', configStateAfterNav)
    
    console.log('✅ Video upload completed - step 1 complete, navigated to config step')
  }

  /**
   * Handles JSON file upload workflow
   * @private
   */
  private async processJsonUpload(
    _filePath: string, 
    options: { skipToStep?: string; completeInputStep: boolean }
  ): Promise<void> {
    const { skipToStep, completeInputStep } = options

    // Complete input step if requested
    if (completeInputStep) {
      await workflowStateManager.transitionState('input-file', StepState.Complete, {
        reason: 'JSON file imported'
      })
    }

    // Handle navigation to specific step (e.g., review)
    if (skipToStep === 'review') {
      await this.handleJsonReviewNavigation()
    }
  }

  /**
   * Handles JSON import navigation to review step
   * @private
   */
  private async handleJsonReviewNavigation(): Promise<void> {
    // Skip config and processing steps
    await Promise.all([
      workflowStateManager.transitionState('config', StepState.Skip, {
        reason: 'JSON import - skipping config step'
      }),
      workflowStateManager.transitionState('processing', StepState.Skip, {
        reason: 'JSON import - skipping processing step'
      })
    ])

    // Enable review step and navigate
    await workflowStateManager.transitionState('review', StepState.Ready, {
      reason: 'JSON import - ready for review'
    })

    workflowStateManager.setCurrentStep('review')
    console.log('✅ JSON import navigation to review step completed')
  }

  /**
   * Resets downstream steps to Blocked state
   * @private
   */
  private async resetDownstreamSteps(reason: string): Promise<void> {
    const stepsToReset: StepId[] = ['config', 'processing', 'review', 'export'] as StepId[]
    
    await Promise.all(
      stepsToReset.map(stepId =>
        workflowStateManager.transitionState(stepId, StepState.Blocked, { reason })
      )
    )
  }

  /**
   * Atomic JSON import navigation with step coordination
   */
  async handleJsonImportNavigation(context?: Readonly<{
    sourceType: 'regular' | 'json-import' | 'manual'
    timestamp: number
    metadata?: Readonly<Record<string, unknown>>
  }>): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log('🚀 Atomic JSON import navigation', context)
      
      // Complete input step if not already completed
      const inputStepState = workflowStateManager.getStepState('input-file')
      
      if (inputStepState !== StepState.Complete) {
        console.log('🔧 Input-file step not completed, completing it for JSON import navigation')
        await workflowStateManager.transitionState('input-file', StepState.Complete, {
          reason: 'JSON import - completing input step'
        })
      } else {
        console.log('✅ Input-file step already completed for JSON import navigation')
      }
      
      // Skip config and processing steps since we're importing processed subtitles
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
      
      workflowStateManager.setCurrentStep('review')
      
      // Enable export step as well since subtitles are ready
      await workflowStateManager.transitionState('export', StepState.Ready, {
        reason: 'JSON import - ready for export'
      })
      
      console.log('✅ JSON import navigation completed')
    }, { operation: 'json-import-navigation', context })
  }

  /**
   * Atomic step reset operation with range support
   */
  async resetStepsFromRange(fromStepId: string, toStepId?: string): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log(`🔄 Atomic step reset from ${fromStepId} to ${toStepId}`)
      
      // Determine steps to reset based on range
      const allSteps: StepId[] = ['input-file', 'config', 'processing', 'review', 'export'] as StepId[]
      const fromIndex = allSteps.indexOf(fromStepId as StepId)
      const toIndex = toStepId ? allSteps.indexOf(toStepId as StepId) : allSteps.length - 1
      
      if (fromIndex === -1) {
        throw new Error(`Invalid fromStepId: ${fromStepId}`)
      }
      
      // Reset steps in range to Blocked state
      for (let i = fromIndex; i <= toIndex; i++) {
        const stepId = allSteps[i]
        if (stepId) {
          await workflowStateManager.transitionState(stepId, StepState.Blocked, {
            reason: `Range reset from ${fromStepId} to ${toStepId || 'end'}`
          })
        }
      }
      
      console.log(`✅ Reset completed for steps ${fromStepId} to ${toStepId || 'end'}`)
    }, { fromStepId, toStepId })
  }

  /**
   * Processing workflow state transitions
   */
  async handleProcessingStart(): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log('🔄 Starting processing - blocking all other steps')
      
      // Step 2 (config) → Complete, Step 3 (processing) → Ready
      await workflowStateManager.transitionState('config', StepState.Complete, {
        reason: 'Configuration completed - starting processing'
      })
      
      await workflowStateManager.transitionState('processing', StepState.Ready, {
        reason: 'Processing starting'
      })
      
      // During processing: ALL other steps → Blocked
      const stepsToBlock: StepId[] = ['input-file', 'config', 'review', 'export'] as StepId[]
      for (const stepId of stepsToBlock) {
        await workflowStateManager.transitionState(stepId, StepState.Blocked, {
          reason: 'Processing active - step temporarily blocked'
        })
      }
      
      console.log('✅ Processing started - other steps blocked')
    }, { operation: 'processing-start' })
  }

  async handleProcessingComplete(): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log('✅ Processing complete - unblocking steps')
      
      // Step 3 (processing) → Complete, Step 4 (review) → Ready
      await workflowStateManager.transitionState('processing', StepState.Complete, {
        reason: 'Processing completed successfully'
      })
      
      await workflowStateManager.transitionState('review', StepState.Ready, {
        reason: 'Processing complete - ready for review'
      })
      
      // Unblock other steps (but keep them in their current logical state)
      await workflowStateManager.transitionState('input-file', StepState.Complete, {
        reason: 'Processing complete - input confirmed'
      })
      
      await workflowStateManager.transitionState('config', StepState.Complete, {
        reason: 'Processing complete - config confirmed'
      })
      
      console.log('✅ Processing complete - steps unblocked')
    }, { operation: 'processing-complete' })
  }

  async handleProcessingError(errorMessage: string): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log('❌ Processing error - unblocking and setting error state')
      
      // Step 3 (processing) → Error
      await workflowStateManager.transitionState('processing', StepState.Error, {
        reason: 'Processing failed',
        message: errorMessage
      })
      
      // Unblock other steps so user can modify and retry
      await workflowStateManager.transitionState('input-file', StepState.Complete, {
        reason: 'Processing failed - input still valid'
      })
      
      await workflowStateManager.transitionState('config', StepState.Ready, {
        reason: 'Processing failed - config can be modified'
      })
      
      // Review and export remain blocked until processing succeeds
      await workflowStateManager.transitionState('review', StepState.Blocked, {
        reason: 'Processing failed - review not available'
      })
      
      await workflowStateManager.transitionState('export', StepState.Blocked, {
        reason: 'Processing failed - export not available'
      })
      
      console.log('✅ Processing error handled - user can retry')
    }, { operation: 'processing-error', errorMessage })
  }

  /**
   * Export workflow state transitions
   */
  async handleExportComplete(): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log('📦 Export completed')
      
      // Step 4 (review) → Complete, Step 5 (export) → Ready
      await workflowStateManager.transitionState('review', StepState.Complete, {
        reason: 'Export initiated - review confirmed'
      })
      
      await workflowStateManager.transitionState('export', StepState.Ready, {
        reason: 'Ready for export'
      })
      
      console.log('✅ Export workflow completed')
    }, { operation: 'export-complete' })
  }

  /**
   * Error boundary integration
   */
  async handleStepError(stepId: string, errorMessage: string, severity: 'error' | 'warning' = 'error'): Promise<void> {
    return this.executeAtomicStepOperation(async () => {
      console.log(`${severity === 'error' ? '❌' : '⚠️'} Step ${stepId} ${severity}:`, errorMessage)
      
      const targetState = severity === 'error' ? StepState.Error : StepState.Warning
      
      await workflowStateManager.transitionState(stepId as StepId, targetState, {
        reason: `Step encountered ${severity}`,
        message: errorMessage
      })
      
      console.log(`✅ Step ${stepId} marked as ${severity}`)
    }, { operation: 'step-error', stepId, errorMessage, severity })
  }


  /**
   * Check if operations are currently being processed
   */
  isOperationInProgress(): boolean {
    return this.isProcessing
  }

  /**
   * Wait for all pending operations to complete
   */
  async waitForOperations(): Promise<void> {
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}

// Singleton instance
export const stepStateController = new StepStateController()

// Convenience methods for common operations
export const atomicFileUpload = stepStateController.handleFileUpload.bind(stepStateController)
export const atomicJsonNavigation = stepStateController.handleJsonImportNavigation.bind(stepStateController)
export const atomicStepReset = stepStateController.resetStepsFromRange.bind(stepStateController)
export const atomicVideoRemoval = stepStateController.handleVideoRemoval.bind(stepStateController)
export const atomicProcessingStart = stepStateController.handleProcessingStart.bind(stepStateController)
export const atomicProcessingComplete = stepStateController.handleProcessingComplete.bind(stepStateController)
export const atomicProcessingError = stepStateController.handleProcessingError.bind(stepStateController)
export const atomicExportComplete = stepStateController.handleExportComplete.bind(stepStateController)
export const atomicStepError = stepStateController.handleStepError.bind(stepStateController)
export const waitForStepOperations = stepStateController.waitForOperations.bind(stepStateController)

/**
 * Atomic workspace reset for a clean state
 */
export const atomicWorkspaceReset = async (metadata?: Record<string, unknown>) => {
  return stepStateController.executeAtomicStepOperation(async () => {
    console.log('🔄 Atomic workspace reset', metadata);

    // Reset all steps to their initial state
    workflowStateManager.reset();

    // Optionally, clear other related state here if needed
    // e.g., useAppStore.getState().clearSomeData();

    console.log('✅ Workspace reset completed');
  }, { operation: 'workspace-reset', ...metadata });
};

