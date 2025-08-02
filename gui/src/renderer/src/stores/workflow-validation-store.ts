import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useAppStore } from './app-store'
import { useWorkflowStore } from './workflow-store'

/**
 * Workflow Validation Store - Simplified User Experience Flow
 * 
 * Implements the correct workflow panel logic:
 * 
 * User Experience Flow:
 * 1. App loads → Step 1 active (ready), Step 2-5 blocked 
 * 2. User uploads video → Step 1 completed, Step 2 ready 
 * 3. User removes video → Step 1 active (reset), Step 2-5 blocked 
 *
 * Clear Visual Hierarchy:
 * - Active Step: Blue color, step number, ready for interaction
 * - Completed Step: Green color, checkmark icon
 * - Blocked Steps: Grey color, blocked icon, clear prerequisite messaging
 * - No Error Confusion: Step 1 never shows errors for normal empty state
 */

// Workflow Validation Types
export interface MediaValidationResult {
  hasMediaFile: boolean
  mediaPath: string | null
  mediaType?: string
  duration?: number
  lastValidated: number | null
  validationError?: string
}

export interface StepValidationRule {
  id: string
  name: string
  validate: () => Promise<boolean>
  errorMessage: string
  warningMessage?: string
  isRequired: boolean
}

export interface StepValidationResult {
  stepId: string
  isValid: boolean
  canAccess: boolean
  errors: string[]
  warnings: string[]
  lastValidated: number
  validationRules: StepValidationRule[]
}

export interface WorkflowValidationState {
  mediaValidation: MediaValidationResult
  stepValidations: Record<string, StepValidationResult>
  isValidating: boolean
  globalValidationError: string | null
  lastGlobalValidation: number | null
}

export interface WorkflowValidationActions {
  // Media validation
  validateMediaFile: () => Promise<MediaValidationResult>
  updateMediaFile: (filePath: string | null) => Promise<void>
  
  // Step validation
  validateStep: (stepId: string) => Promise<StepValidationResult>
  validateAllSteps: () => Promise<void>
  resetStepValidation: (stepId: string) => void
  resetAllValidations: () => void
  
  // Workflow state management
  enforceStepAccess: () => void
  updateWorkflowFromValidation: () => void
  
  // Integration with workflow store
  syncWithWorkflowStore: () => void
  
  // Utility
  initialize: () => Promise<void>
  getValidationSummary: () => {
    totalSteps: number
    validSteps: number
    errorSteps: number
    warningSteps: number
    canProceed: boolean
  }
}

type WorkflowValidationStore = WorkflowValidationState & WorkflowValidationActions

// Simplified Validation Rules Factory - Aligns with User Experience Flow
const createStepValidationRules = (stepId: string): StepValidationRule[] => {
  const rules: StepValidationRule[] = []
  
  switch (stepId) {
    case 'input-file':
      // Step 1 never has validation rules - it's always ready and never shows errors
      // This is the entry point of the application
      break
      
    case 'config':
      // Step 2 only requires media file to be accessible
      rules.push({
        id: 'media-file-prerequisite',
        name: 'Media File Required',
        validate: async () => {
          const appStore = useAppStore.getState()
          return !!appStore.config.inputFile
        },
        errorMessage: 'Upload a media file first',
        isRequired: true
      })
      break
      
    case 'processing':
      // Step 3 requires config to be completed
      rules.push({
        id: 'config-completed',
        name: 'Configuration Completed', 
        validate: async () => {
          const workflowStore = useWorkflowStore.getState()
          const configStep = workflowStore.steps.find(s => s.id === 'config')
          return configStep?.isCompleted || false
        },
        errorMessage: 'Complete configuration first',
        isRequired: true
      })
      break
      
    case 'review':
      // Step 4 requires processing to be completed OR skipped (for JSON import flow)
      // OR if export step is accessible (user has progressed beyond review)
      // OR if we have JSON import context
      rules.push({
        id: 'processing-completed-or-skipped-or-json-import',
        name: 'Processing Completed or Skipped or JSON Import',
        validate: async () => {
          const workflowStore = useWorkflowStore.getState()
          const appStore = useAppStore.getState()
          const processingStep = workflowStore.steps.find(s => s.id === 'processing')
          const exportStep = workflowStore.steps.find(s => s.id === 'export')
          const configStep = workflowStore.steps.find(s => s.id === 'config')
          
          // ENHANCED: Check for JSON import context with multiple indicators
          const isJsonImport = appStore.config.importedJsonFile || 
                              appStore.config.isImportedFromJson ||
                              (configStep?.isSkipped && processingStep?.isSkipped) // Enhanced: Both config and processing skipped = JSON import
          const hasSubtitleData = Array.isArray(appStore.config.subtitle) && appStore.config.subtitle.length > 0
          
          console.log('🔍 Review step validation check:', {
            processingCompleted: processingStep?.isCompleted,
            processingSkipped: processingStep?.isSkipped,
            configSkipped: configStep?.isSkipped,
            exportAccessible: exportStep?.isAccessible,
            isJsonImport,
            hasSubtitleData,
            importedJsonFile: appStore.config.importedJsonFile,
            isImportedFromJson: appStore.config.isImportedFromJson
          });
          
          // Allow access if:
          // 1. Processing is completed OR skipped (JSON import flow)
          // 2. OR export step is accessible (user has progressed beyond review)
          // 3. OR we have a JSON import with subtitle data (immediate access)
          // 4. ENHANCED: Both config and processing are skipped (definitive JSON import flow)
          const canAccess = processingStep?.isCompleted || 
                           processingStep?.isSkipped || 
                           exportStep?.isAccessible || 
                           (isJsonImport && hasSubtitleData) ||
                           (configStep?.isSkipped && processingStep?.isSkipped) || // Enhanced condition
                           false;
                           
          console.log('🔍 Review step validation result:', canAccess);
          return canAccess;
        },
        errorMessage: 'Complete processing first',
        isRequired: true
      })
      break
      
    case 'export':
      // Step 5 requires review to be accessible
      rules.push({
        id: 'review-accessible',
        name: 'Review Step Accessible',
        validate: async () => {
          const workflowStore = useWorkflowStore.getState()
          const reviewStep = workflowStore.steps.find(s => s.id === 'review')
          return reviewStep?.isAccessible || false
        },
        errorMessage: 'Complete processing first',
        isRequired: true
      })
      break
  }
  
  return rules
}

// Initial state
const initialState: WorkflowValidationState = {
  mediaValidation: {
    hasMediaFile: false,
    mediaPath: null,
    lastValidated: null
  },
  stepValidations: {},
  isValidating: false,
  globalValidationError: null,
  lastGlobalValidation: null
}

export const useWorkflowValidationStore = create<WorkflowValidationStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Media validation
    validateMediaFile: async () => {
      const appStore = useAppStore.getState()
      const inputFile = appStore.config.inputFile
      
      const result: MediaValidationResult = {
        hasMediaFile: !!inputFile,
        mediaPath: inputFile,
        lastValidated: Date.now(),
        validationError: undefined
      }
      
      // Additional media file validation can be added here
      if (inputFile) {
        try {
          // Could add file existence check, format validation, etc.
          // For now, just check if path exists
          result.mediaType = inputFile.split('.').pop()?.toLowerCase()
        } catch (error) {
          result.validationError = error instanceof Error ? error.message : 'Unknown validation error'
          result.hasMediaFile = false
        }
      }
      
      set(state => ({
        mediaValidation: result
      }))
      
      return result
    },

    updateMediaFile: async (filePath) => {
      console.log('🔧 updateMediaFile called:', {
        filePath,
        timestamp: Date.now()
      })
      
      // Validate media file first and get result
      const result = await get().validateMediaFile()
      
      // Apply the user experience flow immediately after media validation
      if (result) {
        // First enforce step access to set correct step states
        get().enforceStepAccess()
        
        // Only validate steps that are accessible to avoid error states on blocked steps
        const workflowStore = useWorkflowStore.getState()
        const accessibleSteps = workflowStore.steps.filter(s => s.isAccessible).map(s => s.id)
        
        for (const stepId of accessibleSteps) {
          await get().validateStep(stepId)
        }
        
        // Sync workflow store to ensure consistency
        get().syncWithWorkflowStore()
      }
    },

    // Step validation - Simplified for correct user experience flow
    validateStep: async (stepId) => {
      const rules = createStepValidationRules(stepId)
      const errors: string[] = []
      const warnings: string[] = []
      let isValid = true
      let canAccess = false
      
      // Special handling for input-file step (Step 1)
      if (stepId === 'input-file') {
        // Step 1 is always accessible and never has errors
        canAccess = true
        isValid = true
      } else {
        // For all other steps, validate rules
        for (const rule of rules) {
          try {
            const ruleResult = await rule.validate()
            if (!ruleResult) {
              if (rule.isRequired) {
                errors.push(rule.errorMessage)
                isValid = false
              } else if (rule.warningMessage) {
                warnings.push(rule.warningMessage)
              }
            }
          } catch (error) {
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            isValid = false
          }
        }
        
        // Accessibility is the same as validity for steps 2-5
        canAccess = isValid
      }

      const result: StepValidationResult = {
        stepId,
        isValid,
        canAccess,
        errors,
        warnings,
        lastValidated: Date.now(),
        validationRules: rules
      }
      
      set(state => ({
        stepValidations: {
          ...state.stepValidations,
          [stepId]: result
        }
      }))
      
      return result
    },

    validateAllSteps: async () => {
      set({ isValidating: true })
      
      try {
        const stepIds = ['input-file', 'config', 'processing', 'review', 'export']
        
        for (const stepId of stepIds) {
          await get().validateStep(stepId)
        }
        
        set({
          lastGlobalValidation: Date.now(),
          globalValidationError: null
        })
      } catch (error) {
        set({
          globalValidationError: error instanceof Error ? error.message : 'Global validation failed'
        })
      } finally {
        set({ isValidating: false })
      }
    },

    resetStepValidation: (stepId) => {
      set(state => ({
        stepValidations: {
          ...state.stepValidations,
          [stepId]: undefined
        }
      }))
    },

    resetAllValidations: () => {
      set({
        mediaValidation: {
          hasMediaFile: false,
          mediaPath: null,
          lastValidated: null
        },
        stepValidations: {},
        globalValidationError: null,
        lastGlobalValidation: null
      })
    },

    // Simplified Workflow State Management - Implements User Experience Flow
    enforceStepAccess: () => {
      const appStore = useAppStore.getState()
      const workflowStore = useWorkflowStore.getState()
      const hasMediaFile = !!appStore.config.inputFile
      
      console.log('🔧 enforceStepAccess - Simplified Flow:', {
        hasMediaFile,
        timestamp: Date.now()
      })
      
      if (!hasMediaFile) {
        // User Experience Flow: App loads OR User removes video
        // → Step 1 active (ready), Step 2-5 blocked
        
        // Clear validation states for steps 2-5 to prevent showing errors
        const state = get()
        const clearedValidations = { ...state.stepValidations }
        const blockedSteps = ['config', 'processing', 'review', 'export']
        
        blockedSteps.forEach(stepId => {
          delete clearedValidations[stepId]
        })
        
        set({ stepValidations: clearedValidations })
        
        // Reset all steps to initial state - but this makes config accessible
        workflowStore.resetStepsFromRange('config', 'export')
        
        // Force update workflow store to ensure Step 2 is properly blocked
        const workflowStoreState = useWorkflowStore.getState()
        useWorkflowStore.setState({
          steps: workflowStoreState.steps.map(step => {
            if (step.id === 'input-file') {
              // Step 1 should be active and ready
              return {
                ...step,
                isAccessible: true,
                isCompleted: false,
                hasError: false,
                errorMessage: undefined
              }
            } else if (['config', 'processing', 'review', 'export'].includes(step.id)) {
              // Steps 2-5 should be completely blocked
              return {
                ...step,
                isAccessible: false,
                isCompleted: false,
                hasError: false,
                errorMessage: undefined
              }
            }
            return step
          }),
          currentStep: 'input-file'
        })
        
      } else {
        // User Experience Flow: User uploads video  
        // → Step 1 completed, Step 2 ready
        
        // Complete Step 1 and make Step 2 ready
        const inputFileStep = workflowStore.steps.find(s => s.id === 'input-file')
        const configStep = workflowStore.steps.find(s => s.id === 'config')
        
        if (inputFileStep && !inputFileStep.isCompleted) {
          // Mark Step 1 as completed
          workflowStore.completeStep('input-file')
        }
        
        if (configStep) {
          // Ensure Step 2 is accessible and ready
          configStep.isAccessible = true
          configStep.hasError = false
          configStep.errorMessage = undefined
        }
        
        // Navigate to Step 2 if still on Step 1
        if (workflowStore.currentStep === 'input-file') {
          workflowStore.setCurrentStep('config')
        }
      }
    },

    updateWorkflowFromValidation: () => {
      const state = get()
      const workflowStore = useWorkflowStore.getState()
      
      // Update workflow store based on validation results
      Object.entries(state.stepValidations).forEach(([stepId, validation]) => {
        if (validation) {
          const step = workflowStore.steps.find(s => s.id === stepId)
          if (step) {
            // Step 1 (input-file) never shows errors - it's always ready
            if (stepId === 'input-file') {
              step.hasError = false
              step.errorMessage = undefined
              // Step 1 is always accessible
              step.isAccessible = true
            } else {
              // For steps 2-5, show errors only if step is accessible but validation fails
              const hasActualError = validation.errors.length > 0 && step.isAccessible
              step.hasError = hasActualError
              step.errorMessage = hasActualError ? validation.errors.join(', ') : undefined
              
              // Update accessibility based on validation
              if (!validation.canAccess) {
                step.isAccessible = false
              }
            }
          }
        }
      })
    },

    // Integration with workflow store - Simplified
    syncWithWorkflowStore: () => {
      // Apply the simplified user experience flow
      get().enforceStepAccess()
      get().updateWorkflowFromValidation()
    },

    // Utility
    initialize: async () => {
      await get().validateMediaFile()
      await get().validateAllSteps()
      get().syncWithWorkflowStore()
    },

    getValidationSummary: () => {
      const state = get()
      const validations = Object.values(state.stepValidations)
      
      return {
        totalSteps: validations.length,
        validSteps: validations.filter(v => v.isValid).length,
        errorSteps: validations.filter(v => v.errors.length > 0).length,
        warningSteps: validations.filter(v => v.warnings.length > 0).length,
        canProceed: state.mediaValidation.hasMediaFile && validations.some(v => v.isValid)
      }
    }
  }))
)

// Subscribe to app store changes for automatic validation
let updateTimeout: NodeJS.Timeout | null = null
useAppStore.subscribe(
  (state) => state.config.inputFile,
  (inputFile, prevInputFile) => {
    if (inputFile !== prevInputFile) {
      console.log('🔧 App store inputFile subscription triggered:', {
        inputFile,
        prevInputFile,
        timestamp: Date.now()
      })
      
      // Debounce updates to prevent race conditions
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
      
      updateTimeout = setTimeout(() => {
        const validationStore = useWorkflowValidationStore.getState()
        validationStore.updateMediaFile(inputFile)
        updateTimeout = null
      }, 50) // 50ms debounce
    }
  }
)

// Subscribe to dependencies changes
useAppStore.subscribe(
  (state) => state.dependencies,
  (dependencies, prevDependencies) => {
    if (JSON.stringify(dependencies) !== JSON.stringify(prevDependencies)) {
      const validationStore = useWorkflowValidationStore.getState()
      validationStore.validateStep('config')
    }
  }
)

// Export selectors
export const selectMediaValidation = (state: WorkflowValidationStore) => state.mediaValidation
export const selectStepValidation = (stepId: string) => (state: WorkflowValidationStore) => 
  state.stepValidations[stepId]
export const selectValidationSummary = (state: WorkflowValidationStore) => 
  state.getValidationSummary()