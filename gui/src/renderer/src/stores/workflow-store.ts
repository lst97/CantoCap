import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WorkflowState, WorkflowStep } from '../types/workflow'
import { useWorkspaceStore } from './workspace-store'

// Helper function to save workflow state to workspace session
const saveWorkflowToWorkspace = async (workflowState: Partial<WorkflowState>) => {
  try {
    const workspaceStore = useWorkspaceStore.getState()
    if (workspaceStore.currentWorkspace) {
      await workspaceStore.saveWorkspaceSession('workflow', {
        workflowSteps: workflowState.steps,
        currentStep: workflowState.currentStep,
        stepHistory: [] // Could be enhanced to track step history
      })
    }
  } catch (error) {
    console.error('Failed to save workflow state to workspace:', error)
    // Don't throw here to avoid breaking the workflow
  }
}

// Helper function to load workflow state from workspace session
const loadWorkflowFromWorkspace = async (): Promise<Partial<WorkflowState> | null> => {
  try {
    const workspaceStore = useWorkspaceStore.getState()
    if (workspaceStore.currentWorkspace) {
      const sessionData = await workspaceStore.loadWorkspaceSession(
        workspaceStore.currentWorkspace.id, 
        'workflow'
      )
      
      if (sessionData) {
        return {
          steps: sessionData.workflowSteps || INITIAL_STEPS,
          currentStep: sessionData.currentStep || 'input-file'
        }
      }
    }
  } catch (error) {
    console.error('Failed to load workflow state from workspace:', error)
  }
  return null
}

const INITIAL_STEPS: WorkflowStep[] = [
  {
    id: 'input-file',
    title: 'Input File',
    description: 'Upload media file and select processing range',
    isCompleted: false,
    isAccessible: true,
    requiredFields: ['inputFile']
  },
  {
    id: 'config',
    title: 'Configuration',
    description: 'Configure transcription and subtitle options',
    isCompleted: false,
    isAccessible: false,
    requiredFields: ['language', 'model']
  },
  {
    id: 'processing',
    title: 'Processing',
    description: 'Generate subtitles and monitor progress',
    isCompleted: false,
    isAccessible: false
  },
  {
    id: 'review',
    title: 'Review & Edit',
    description: 'Review and edit generated subtitles',
    isCompleted: false,
    isAccessible: false
  },
  {
    id: 'export',
    title: 'Export',
    description: 'Configure export settings and download files',
    isCompleted: false,
    isAccessible: false
  }
]

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      currentStep: 'input-file',
      steps: INITIAL_STEPS,

      // Initialize with workspace data if available
      initializeFromWorkspace: async () => {
        const workspaceData = await loadWorkflowFromWorkspace()
        if (workspaceData) {
          set({
            currentStep: workspaceData.currentStep || 'input-file',
            steps: workspaceData.steps || INITIAL_STEPS
          })
        }
      },

      canProgress: (stepId: string) => {
        const state = get()
        const step = state.steps.find(s => s.id === stepId)
        return step ? step.isAccessible : false
      },

      setCurrentStep: (stepId: string) => {
        const state = get()
        if (state.canProgress(stepId)) {
          set({ currentStep: stepId })
          // Save to workspace
          saveWorkflowToWorkspace({ currentStep: stepId, steps: state.steps })
        }
      },

      completeStep: (stepId: string) => {
        set((state) => {
          const updatedSteps = state.steps.map((step) => {
            if (step.id === stepId) {
              return { ...step, isCompleted: true }
            }
            return step
          })

          // Special handling: When processing step completes, enable both review and export steps
          if (stepId === 'processing') {
            const reviewStepIndex = updatedSteps.findIndex(s => s.id === 'review')
            const exportStepIndex = updatedSteps.findIndex(s => s.id === 'export')
            
            if (reviewStepIndex >= 0) {
              updatedSteps[reviewStepIndex].isAccessible = true
            }
            if (exportStepIndex >= 0) {
              updatedSteps[exportStepIndex].isAccessible = true
            }
          } else {
            // Default behavior: Enable next step
            const currentIndex = updatedSteps.findIndex(s => s.id === stepId)
            if (currentIndex >= 0 && currentIndex < updatedSteps.length - 1) {
              updatedSteps[currentIndex + 1].isAccessible = true
            }
          }

          // Save workflow state to workspace session
          const newState = { steps: updatedSteps }
          saveWorkflowToWorkspace(newState)

          return newState
        })
      },

      validateStep: (stepId: string) => {
        const state = get()
        const step = state.steps.find(s => s.id === stepId)
        if (!step) return false

        // Add validation logic here based on step requirements
        if (stepId === 'input-file') {
          // Check if input file is selected (this would integrate with your app store)
          return true // Placeholder
        }

        return true
      },

      getNextAccessibleStep: (stepId: string) => {
        const state = get()
        const currentIndex = state.steps.findIndex(s => s.id === stepId)
        
        for (let i = currentIndex + 1; i < state.steps.length; i++) {
          if (state.steps[i].isAccessible) {
            return state.steps[i].id
          }
        }
        
        return null
      },

      disableStep: (stepId: string) => {
        set((state) => {
          const updatedSteps = state.steps.map((step) => {
            if (step.id === stepId) {
              return { 
                ...step, 
                isAccessible: false,
                isCompleted: false 
              }
            }
            return step
          })

          return { steps: updatedSteps }
        })
      },

      enableStep: (stepId: string) => {
        set((state) => {
          const updatedSteps = state.steps.map((step) => {
            if (step.id === stepId) {
              return { 
                ...step, 
                isAccessible: true
              }
            }
            return step
          })

          const newState = { steps: updatedSteps }
          saveWorkflowToWorkspace(newState)
          return newState
        })
      },

      resetWorkflowFromStep: (fromStepId: string) => {
        set((state) => {
          const fromIndex = state.steps.findIndex(s => s.id === fromStepId)
          if (fromIndex === -1) return state

          const updatedSteps = state.steps.map((step, index) => {
            if (index >= fromIndex) {
              return {
                ...step,
                isCompleted: false,
                isAccessible: index === fromIndex // Only the target step remains accessible
              }
            }
            return step
          })

          const newState = { steps: updatedSteps }
          saveWorkflowToWorkspace(newState)
          return newState
        })
      },

      skipToStep: (stepId: string) => {
        set((state) => {
          const targetIndex = state.steps.findIndex(s => s.id === stepId)
          if (targetIndex === -1) return state

          const updatedSteps = state.steps.map((step, index) => {
            if (index <= targetIndex) {
              return {
                ...step,
                isCompleted: index < targetIndex,
                isAccessible: true
              }
            }
            return step
          })

          return { 
            steps: updatedSteps,
            currentStep: stepId
          }
        })
      },

      markStepAsSkipped: (stepId: string) => {
        set((state) => {
          const updatedSteps = state.steps.map((step) => {
            if (step.id === stepId) {
              return {
                ...step,
                isSkipped: true,
                isCompleted: false,
                isAccessible: false
              }
            }
            return step
          })

          return { steps: updatedSteps }
        })
      },

      skipStepsAndNavigate: (skipStepIds: string[], targetStepId: string) => {
        set((state) => {
          const targetIndex = state.steps.findIndex(s => s.id === targetStepId)
          if (targetIndex === -1) return state

          const updatedSteps = state.steps.map((step, index) => {
            if (skipStepIds.includes(step.id)) {
              return {
                ...step,
                isSkipped: true,
                isCompleted: false,
                isAccessible: false
              }
            } else if (index <= targetIndex) {
              return {
                ...step,
                isAccessible: true,
                isCompleted: index < targetIndex && !skipStepIds.includes(step.id)
              }
            }
            return step
          })

          return { 
            steps: updatedSteps,
            currentStep: targetStepId
          }
        })
      },

      resetStepsFromRange: (fromStepId: string, toStepId?: string) => {
        set((state) => {
          const fromIndex = state.steps.findIndex(s => s.id === fromStepId)
          const toIndex = toStepId ? state.steps.findIndex(s => s.id === toStepId) : state.steps.length - 1
          
          if (fromIndex === -1) return state

          const updatedSteps = state.steps.map((step, index) => {
            if (index >= fromIndex && index <= toIndex) {
              return {
                ...step,
                isCompleted: false,
                isAccessible: index === fromIndex, // Only the first step in range remains accessible
                isSkipped: false,
                hasError: false,
                errorMessage: undefined
              }
            }
            return step
          })

          return { steps: updatedSteps }
        })
      },

      markStepAsError: (stepId: string, errorMessage?: string) => {
        set((state) => {
          const updatedSteps = state.steps.map((step) => {
            if (step.id === stepId) {
              return {
                ...step,
                hasError: true,
                errorMessage: errorMessage,
                isCompleted: false
              }
            }
            return step
          })

          return { steps: updatedSteps }
        })
      },

      clearStepError: (stepId: string) => {
        set((state) => {
          const updatedSteps = state.steps.map((step) => {
            if (step.id === stepId) {
              return {
                ...step,
                hasError: false,
                errorMessage: undefined
              }
            }
            return step
          })

          return { steps: updatedSteps }
        })
      },

      // Testing methods
      updateStep: (stepId: string) => {
        set((state) => ({ currentStep: stepId }))
      },

      updateStepData: (data: any) => {
        // Mock method for testing - in real implementation would update step-specific data
        console.log('Step data updated:', data)
      },

      restoreState: (stepId: string) => {
        set((state) => ({ currentStep: stepId }))
      },

      getState: () => {
        return get()
      },


      reset: () => {
        set({
          currentStep: 'input-file',
          steps: INITIAL_STEPS
        })
      },

      // Enhanced atomic operations
      executeAtomicOperation: (operation: () => void) => {
        const currentState = get()
        
        // Capture current state for rollback
        const snapshot = {
          currentStep: currentState.currentStep,
          steps: currentState.steps.map(step => ({ ...step }))
        }
        
        try {
          operation()
          return { 
            success: true,
            rollback: () => {
              set({
                currentStep: snapshot.currentStep,
                steps: snapshot.steps
              })
              console.log('🔄 Workflow state rolled back via executeAtomicOperation')
            }
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            rollback: () => {} // No-op since operation failed
          }
        }
      },

      setStepImportContext: (stepId: string, context: WorkflowStep['importContext']) => {
        set((state) => {
          const updatedSteps = state.steps.map((step) => {
            if (step.id === stepId) {
              return { ...step, importContext: context }
            }
            return step
          })

          const newState = { steps: updatedSteps }
          saveWorkflowToWorkspace(newState)
          return newState
        })
      }
    }),
    {
      name: 'workflow-storage',
      partialize: (state) => ({ 
        currentStep: state.currentStep,
        steps: state.steps.map(s => ({
          ...s,
          validationRules: undefined // Don't persist functions
        }))
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('Workflow state rehydrated:', {
            currentStep: state.currentStep,
            completedSteps: state.steps.filter(s => s.isCompleted).map(s => s.id),
            accessibleSteps: state.steps.filter(s => s.isAccessible).map(s => s.id)
          })
        } else {
          console.warn('Failed to rehydrate workflow state')
        }
      }
    }
  )
)