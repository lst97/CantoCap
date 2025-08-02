/**
 * Centralized Step State Controller
 * Prevents race conditions in workflow step management by providing atomic operations
 * and coordinating between multiple systems that need to update step states.
 */

import { useWorkflowStore } from '../stores/workflow-store'
// Note: useWorkflowValidationStore is accessed dynamically to avoid circular dependency

// Operation queue for atomic step state updates
interface StepOperation {
  id: string
  type: 'complete' | 'reset' | 'enable' | 'disable' | 'skip' | 'navigate'
  stepId?: string
  fromStepId?: string
  toStepId?: string
  targetStepId?: string
  skipStepIds?: string[]
  metadata?: any
}

class StepStateController {
  private operationQueue: StepOperation[] = []
  private isProcessing: boolean = false
  private operationId: number = 0

  /**
   * Executes atomic step operations to prevent race conditions
   */
  async executeAtomicStepOperation<T>(operation: () => T, metadata?: any): Promise<T> {
    const operationId = `atomic-${++this.operationId}-${Date.now()}`
    
    console.log(`🔄 Starting atomic step operation ${operationId}`, metadata)
    
    // Wait for any pending operations to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    this.isProcessing = true
    
    try {
      const result = operation()
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
   * Atomic file upload with coordinated step state updates
   */
  async handleFileUpload(fileType: 'video' | 'json', filePath: string | null, options?: {
    resetSteps?: boolean
    skipToStep?: string
    completeInputStep?: boolean
  }): Promise<void> {
    return this.executeAtomicStepOperation(() => {
      const workflowStore = useWorkflowStore.getState()
      
      // Access validation store dynamically to avoid circular dependency
      let validationStore: any = null
      try {
        const validationModule = require('../stores/workflow-validation-store')
        validationStore = validationModule.useWorkflowValidationStore.getState()
      } catch (error) {
        console.warn('Could not access validation store:', error)
      }
      
      console.log(`📁 Atomic ${fileType} file upload:`, filePath, options)
      
      if (filePath) {
        // File selected
        if (options?.completeInputStep !== false) {
          workflowStore.completeStep('input-file')
        }
        
        if (options?.resetSteps) {
          // Clear validation states first if validation store is available
          if (validationStore) {
            const clearedValidations = { ...validationStore.stepValidations }
            const stepsToReset = ['config', 'processing', 'review', 'export']
            stepsToReset.forEach(stepId => {
              delete clearedValidations[stepId]
            })
            try {
              const validationModule = require('../stores/workflow-validation-store')
              validationModule.useWorkflowValidationStore.setState({ stepValidations: clearedValidations })
            } catch (error) {
              console.warn('Could not update validation store state:', error)
            }
          }
          
          // Reset workflow steps
          workflowStore.resetStepsFromRange('config', 'export')
        }
        
        if (options?.skipToStep) {
          // Skip to specific step (for JSON imports)
          const stepsToSkip = ['config', 'processing']
          workflowStore.skipStepsAndNavigate(stepsToSkip, options.skipToStep)
        }
      } else {
        // File removed
        workflowStore.resetWorkflowFromStep('input-file')
        
        // Clear all validation states if validation store is available
        try {
          const validationModule = require('../stores/workflow-validation-store')
          validationModule.useWorkflowValidationStore.setState({ stepValidations: {} })
        } catch (error) {
          console.warn('Could not clear validation store state:', error)
        }
      }
    }, { fileType, filePath, options })
  }

  /**
   * Atomic JSON import navigation with step coordination
   */
  async handleJsonImportNavigation(context?: any): Promise<void> {
    return this.executeAtomicStepOperation(() => {
      const workflowStore = useWorkflowStore.getState()
      
      console.log('🚀 Atomic JSON import navigation', context)
      
      // Validate and complete input step for JSON import navigation
      const inputStep = workflowStore.steps.find(s => s.id === 'input-file')
      if (!inputStep) {
        throw new Error('Input file step not found during JSON import navigation')
      }
      
      // Complete input step if not already completed (defensive for JSON imports)
      if (!inputStep.isCompleted) {
        console.log('🔧 Input-file step not completed, completing it for JSON import navigation');
        workflowStore.completeStep('input-file')
      } else {
        console.log('✅ Input-file step already completed for JSON import navigation');
      }
      
      // Skip config and processing steps since we're importing processed subtitles
      workflowStore.markStepAsSkipped('config')
      workflowStore.markStepAsSkipped('processing')
      
      // Enable and navigate to review step
      workflowStore.enableStep('review')
      workflowStore.setCurrentStep('review')
      
      // Enable export step as well since subtitles are ready
      workflowStore.enableStep('export')
      
    }, { operation: 'json-import-navigation', context })
  }

  /**
   * Atomic step reset operation with validation coordination
   */
  async resetStepsFromRange(fromStepId: string, toStepId?: string, clearValidations: boolean = true): Promise<void> {
    return this.executeAtomicStepOperation(() => {
      const workflowStore = useWorkflowStore.getState()
      
      console.log(`🔄 Atomic step reset from ${fromStepId} to ${toStepId}`)
      
      if (clearValidations) {
        // Clear validation states for affected steps if validation store is available
        try {
          const validationModule = require('../stores/workflow-validation-store')
          const validationStore = validationModule.useWorkflowValidationStore.getState()
          const clearedValidations = { ...validationStore.stepValidations }
          
          // Determine steps to clear based on range
          const allSteps = ['input-file', 'config', 'processing', 'review', 'export']
          const fromIndex = allSteps.indexOf(fromStepId)
          const toIndex = toStepId ? allSteps.indexOf(toStepId) : allSteps.length - 1
          
          for (let i = fromIndex; i <= toIndex; i++) {
            if (allSteps[i]) {
              delete clearedValidations[allSteps[i]]
            }
          }
          
          validationModule.useWorkflowValidationStore.setState({ stepValidations: clearedValidations })
        } catch (error) {
          console.warn('Could not clear validation states:', error)
        }
      }
      
      // Reset workflow steps
      workflowStore.resetStepsFromRange(fromStepId, toStepId)
      
    }, { fromStepId, toStepId, clearValidations })
  }

  /**
   * Batch state update to prevent multiple re-renders
   */
  async batchStateUpdates(updates: (() => void)[]): Promise<void> {
    return this.executeAtomicStepOperation(() => {
      console.log(`🔄 Batching ${updates.length} state updates`)
      
      // Execute all updates in a single batch
      updates.forEach(update => update())
      
    }, { operation: 'batch-state-updates', count: updates.length })
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
export const batchStateUpdates = stepStateController.batchStateUpdates.bind(stepStateController)
export const waitForStepOperations = stepStateController.waitForOperations.bind(stepStateController)