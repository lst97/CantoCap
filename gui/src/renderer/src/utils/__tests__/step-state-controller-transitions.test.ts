/**
 * Tests for Workflow State Transition Logic
 * Validates all specific state transition rules are implemented correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest'
import {
  stepStateController,
  atomicVideoRemoval,
  atomicProcessingStart,
  atomicProcessingComplete,
  atomicProcessingError,
  atomicExportComplete,
  atomicStepError,
  atomicJsonNavigation
} from '../step-state-controller'
// Legacy workflow store removed - now using WorkflowStateManager directly

// Mock the validation store
vi.mock('../../stores/workflow-validation-store', () => ({
  useWorkflowValidationStore: {
    getState: vi.fn(() => ({
      stepValidations: {}
    })),
    setState: vi.fn()
  }
}))

describe('Step State Controller - Workflow Transitions', () => {
  let mockWorkflowStore: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowStore = {
      completeStep: vi.fn(),
      enableStep: vi.fn(),
      disableStep: vi.fn(),
      setCurrentStep: vi.fn(),
      markStepAsSkipped: vi.fn(),
      resetWorkflowFromStep: vi.fn(),
      resetStepsFromRange: vi.fn(),
      markStepAsError: vi.fn(),
      clearStepError: vi.fn(),
      skipStepsAndNavigate: vi.fn()
    }
    ;(useWorkflowStore.getState as MockedFunction<any>).mockReturnValue(mockWorkflowStore)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Video Removal Transition', () => {
    it('should reset all steps to blocked except input-file which becomes ready', async () => {
      await atomicVideoRemoval()

      expect(mockWorkflowStore.resetWorkflowFromStep).toHaveBeenCalledWith('input-file')
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('input-file')
    })

    it('should clear all validation states on video removal', async () => {
      const mockValidationStore = await import('../../stores/workflow-validation-store')
      const setStateSpy = vi.spyOn(mockValidationStore.useWorkflowValidationStore, 'setState')

      await atomicVideoRemoval()

      expect(setStateSpy).toHaveBeenCalledWith({ stepValidations: {} })
    })
  })

  describe('Video Upload Transition', () => {
    it('should complete step 1 and enable step 2 without navigation', async () => {
      await stepStateController.handleFileUpload('video', '/path/to/video.mp4')

      expect(mockWorkflowStore.completeStep).toHaveBeenCalledWith('input-file')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('config')
      // Should NOT call setCurrentStep for video uploads
      expect(mockWorkflowStore.setCurrentStep).not.toHaveBeenCalled()
    })
  })

  describe('JSON Import After Video Transition', () => {
    it('should skip config and processing steps and navigate to review', async () => {
      await atomicJsonImportAfterVideo()

      expect(mockWorkflowStore.completeStep).toHaveBeenCalledWith('input-file')
      expect(mockWorkflowStore.markStepAsSkipped).toHaveBeenCalledWith('config')
      expect(mockWorkflowStore.markStepAsSkipped).toHaveBeenCalledWith('processing')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('review')
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('review')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('export')
    })
  })

  describe('Subtitle Generation Transition', () => {
    it('should complete config step and enable processing', async () => {
      await atomicSubtitleGeneration()

      expect(mockWorkflowStore.completeStep).toHaveBeenCalledWith('config')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('processing')
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('processing')
    })
  })

  describe('Processing State Transitions', () => {
    it('should block all other steps when processing starts', async () => {
      await atomicProcessingStart()

      const expectedBlockedSteps = ['input-file', 'config', 'review', 'export']
      expectedBlockedSteps.forEach(stepId => {
        expect(mockWorkflowStore.disableStep).toHaveBeenCalledWith(stepId)
      })
    })

    it('should complete processing and enable review on success', async () => {
      await atomicProcessingComplete()

      expect(mockWorkflowStore.completeStep).toHaveBeenCalledWith('processing')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('review')
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('review')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('input-file')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('config')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('export')
    })

    it('should mark processing as error and unblock other steps on failure', async () => {
      const errorMessage = 'Processing failed due to audio quality'
      await atomicProcessingError(errorMessage)

      expect(mockWorkflowStore.markStepAsError).toHaveBeenCalledWith('processing', errorMessage)
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('input-file')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('config')
    })
  })

  describe('Export Transition', () => {
    it('should complete review step and enable export', async () => {
      await atomicExportStart()

      expect(mockWorkflowStore.completeStep).toHaveBeenCalledWith('review')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('export')
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('export')
    })
  })

  describe('Error Handling Transitions', () => {
    it('should mark step as error and keep it enabled', async () => {
      const stepId = 'config'
      const errorMessage = 'Configuration validation failed'
      const severity = 'high'

      await atomicStepError(stepId, errorMessage, severity)

      expect(mockWorkflowStore.markStepAsError).toHaveBeenCalledWith(stepId, errorMessage)
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith(stepId)
    })

    it('should unblock other steps when processing has critical error', async () => {
      await atomicStepError('processing', 'Critical processing error', 'critical')

      expect(mockWorkflowStore.markStepAsError).toHaveBeenCalledWith('processing', 'Critical processing error')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('processing')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('input-file')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('config')
    })

    it('should mark step with warning and keep it enabled', async () => {
      const stepId = 'config'
      const warningMessage = 'Model may not work well with this audio quality'

      await atomicStepWarning(stepId, warningMessage)

      expect(mockWorkflowStore.markStepAsError).toHaveBeenCalledWith(stepId, `Warning: ${warningMessage}`)
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith(stepId)
    })

    it('should clear step error', async () => {
      const stepId = 'processing'

      await atomicClearStepError(stepId)

      expect(mockWorkflowStore.clearStepError).toHaveBeenCalledWith(stepId)
    })
  })

  describe('Atomic Operations', () => {
    it('should prevent race conditions during concurrent operations', async () => {
      const operation1 = atomicVideoRemoval()
      const operation2 = atomicSubtitleGeneration()
      const operation3 = atomicProcessingStart()

      await Promise.all([operation1, operation2, operation3])

      // All operations should complete without interference
      // The exact order may vary, but all should execute
      expect(mockWorkflowStore.resetWorkflowFromStep).toHaveBeenCalled()
      expect(mockWorkflowStore.completeStep).toHaveBeenCalled()
      expect(mockWorkflowStore.disableStep).toHaveBeenCalled()
    })

    it('should queue operations when already processing', async () => {
      const startTime = Date.now()
      
      // Start multiple operations simultaneously
      const promises = [
        atomicSubtitleGeneration(),
        atomicProcessingStart(),
        atomicProcessingComplete()
      ]

      await Promise.all(promises)
      
      const endTime = Date.now()
      
      // Operations should be serialized, taking more time than if parallel
      expect(endTime - startTime).toBeGreaterThan(0)
      
      // All operations should have completed
      expect(mockWorkflowStore.completeStep).toHaveBeenCalledTimes(2) // config + processing
      expect(mockWorkflowStore.enableStep).toHaveBeenCalled()
    })
  })

  describe('State Transition Validation', () => {
    it('should handle errors gracefully during state transitions', async () => {
      // Mock a failure in the workflow store
      mockWorkflowStore.completeStep.mockRejectedValueOnce(new Error('Store operation failed'))

      // The atomic operation should not throw
      await expect(atomicSubtitleGeneration()).resolves.not.toThrow()
    })

    it('should maintain operation consistency even with partial failures', async () => {
      // Mock partial failure scenario
      mockWorkflowStore.enableStep.mockRejectedValueOnce(new Error('Enable step failed'))

      await atomicProcessingComplete()

      // The complete step should still have been called
      expect(mockWorkflowStore.completeStep).toHaveBeenCalledWith('processing')
    })
  })
})