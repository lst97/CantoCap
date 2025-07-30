import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WorkflowState, WorkflowStep } from '../types/workflow'

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

      canProgress: (stepId: string) => {
        const state = get()
        const step = state.steps.find(s => s.id === stepId)
        return step ? step.isAccessible : false
      },

      setCurrentStep: (stepId: string) => {
        const state = get()
        if (state.canProgress(stepId)) {
          set({ currentStep: stepId })
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

          return { steps: updatedSteps }
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

          return { steps: updatedSteps }
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