/**
 * Test suite for enhanced workflow navigation utilities
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { navigateToReviewFromJsonImport, NavigationContext } from '../workflow-navigation'

// Mock the workflow store
const mockWorkflowStore = {
  steps: [
    { id: 'input-file', isCompleted: true, isAccessible: true },
    { id: 'config', isCompleted: false, isAccessible: false },
    { id: 'processing', isCompleted: false, isAccessible: false },
    { id: 'review', isCompleted: false, isAccessible: false },
    { id: 'export', isCompleted: false, isAccessible: false }
  ],
  currentStep: 'input-file',
  completeStep: jest.fn(),
  markStepAsSkipped: jest.fn(),
  enableStep: jest.fn(),
  setCurrentStep: jest.fn(),
  setStepImportContext: jest.fn(),
  executeAtomicOperation: jest.fn((operation) => {
    try {
      operation()
      return { success: true, rollback: jest.fn() }
    } catch (error) {
      return { success: false, error: error.message, rollback: jest.fn() }
    }
  })
}

jest.mock('../stores/workflow-store', () => ({
  useWorkflowStore: {
    getState: () => mockWorkflowStore
  }
}))

describe('Enhanced Workflow Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock store state
    mockWorkflowStore.currentStep = 'input-file'
    mockWorkflowStore.steps = [
      { id: 'input-file', isCompleted: true, isAccessible: true },
      { id: 'config', isCompleted: false, isAccessible: false },
      { id: 'processing', isCompleted: false, isAccessible: false },
      { id: 'review', isCompleted: false, isAccessible: false },
      { id: 'export', isCompleted: false, isAccessible: false }
    ]
  })

  describe('navigateToReviewFromJsonImport', () => {
    it('should successfully navigate from JSON import to review step', () => {
      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now(),
        metadata: { fileName: 'test.json', subtitleCount: 10 }
      }

      const result = navigateToReviewFromJsonImport(context)

      expect(result.success).toBe(true)
      expect(mockWorkflowStore.executeAtomicOperation).toHaveBeenCalled()
      expect(mockWorkflowStore.completeStep).toHaveBeenCalledWith('input-file')
      expect(mockWorkflowStore.markStepAsSkipped).toHaveBeenCalledWith('config')
      expect(mockWorkflowStore.markStepAsSkipped).toHaveBeenCalledWith('processing')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('review')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('export')
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('review')
    })

    it('should fail when input-file step is not completed', () => {
      // Simulate uncompleted input-file step
      mockWorkflowStore.steps[0].isCompleted = false

      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now()
      }

      // Mock executeAtomicOperation to simulate the error
      mockWorkflowStore.executeAtomicOperation.mockImplementation((operation) => {
        try {
          operation()
          return { success: true, rollback: jest.fn() }
        } catch (error) {
          return { success: false, error: error.message, rollback: jest.fn() }
        }
      })

      const result = navigateToReviewFromJsonImport(context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Input file step must be completed')
    })

    it('should set import context for all affected steps', () => {
      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now(),
        metadata: { fileName: 'test.json' }
      }

      navigateToReviewFromJsonImport(context)

      expect(mockWorkflowStore.setStepImportContext).toHaveBeenCalledWith('config', context)
      expect(mockWorkflowStore.setStepImportContext).toHaveBeenCalledWith('processing', context)
      expect(mockWorkflowStore.setStepImportContext).toHaveBeenCalledWith('review', context)
    })
  })

  describe('Atomic Operations', () => {
    it('should provide rollback capability', () => {
      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now()
      }

      const result = navigateToReviewFromJsonImport(context)

      expect(result.success).toBe(true)
      expect(result.rollback).toBeDefined()
      expect(typeof result.rollback).toBe('function')
    })

    it('should handle errors gracefully', () => {
      // Mock executeAtomicOperation to throw an error
      mockWorkflowStore.executeAtomicOperation.mockImplementation(() => {
        throw new Error('Test error')
      })

      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now()
      }

      expect(() => navigateToReviewFromJsonImport(context)).not.toThrow()
    })
  })

  describe('JSON Import Data Flow Integration', () => {
    it('should handle subtitle data presence correctly', () => {
      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now(),
        metadata: { 
          fileName: 'test.json', 
          subtitleCount: 25,
          hasSubtitleData: true,
          triggeredBy: 'config-subtitle-update'
        }
      }

      const result = navigateToReviewFromJsonImport(context)

      expect(result.success).toBe(true)
      expect(mockWorkflowStore.setStepImportContext).toHaveBeenCalledWith('review', context)
      
      // Verify that the context includes subtitle data information
      const reviewContextCall = mockWorkflowStore.setStepImportContext.mock.calls
        .find(call => call[0] === 'review')
      expect(reviewContextCall[1].metadata.hasSubtitleData).toBe(true)
      expect(reviewContextCall[1].metadata.subtitleCount).toBe(25)
    })

    it('should properly skip config and processing steps for JSON import', () => {
      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now(),
        metadata: { fileName: 'import.json' }
      }

      navigateToReviewFromJsonImport(context)

      // Verify both config and processing steps are marked as skipped
      expect(mockWorkflowStore.markStepAsSkipped).toHaveBeenCalledWith('config')
      expect(mockWorkflowStore.markStepAsSkipped).toHaveBeenCalledWith('processing')
      
      // Verify review and export steps are enabled
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('review')
      expect(mockWorkflowStore.enableStep).toHaveBeenCalledWith('export')
      
      // Verify navigation goes directly to review
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('review')
    })

    it('should validate post-navigation state consistency', () => {
      const context: NavigationContext = {
        sourceType: 'json-import',
        timestamp: Date.now()
      }

      const result = navigateToReviewFromJsonImport(context)

      expect(result.success).toBe(true)
      
      // After navigation, verify the expected state changes occurred
      expect(mockWorkflowStore.executeAtomicOperation).toHaveBeenCalledTimes(1)
      
      // Verify the atomic operation was called with a function
      const atomicOperationCall = mockWorkflowStore.executeAtomicOperation.mock.calls[0]
      expect(typeof atomicOperationCall[0]).toBe('function')
    })
  })
})