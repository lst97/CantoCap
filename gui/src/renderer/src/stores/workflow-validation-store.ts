import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useAppStore } from './app-store'
import { workflowStateManager } from '../services/workflow/workflow-state-manager'
import { StepState, type StepId } from '../types/workflow-state'
import { atomicVideoRemoval } from '../utils/step-state-controller'

/**
 * Modern Workflow Validation Store - Business Logic Layer
 * 
 * This store provides business logic validation that coordinates with
 * WorkflowStateManager for state management. It focuses purely on
 * validation rules and user experience flow without duplicating
 * state management functionality.
 * 
 * User Experience Flow:
 * 1. App loads → Step 1 ready, Step 2-5 blocked 
 * 2. User uploads video → Step 1 completed, Step 2 ready 
 * 3. User removes video → Step 1 ready, Step 2-5 blocked 
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

// Modern Validation Rules Factory - Uses WorkflowStateManager
const createStepValidationRules = (stepId: string): StepValidationRule[] => {
  const rules: StepValidationRule[] = []
  
  switch (stepId) {
    case 'input-file':
      // Step 1 is always ready - no validation rules needed
      break
      
    case 'config':
      // Step 2 requires media file
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
          return workflowStateManager.isStepComplete('config')
        },
        errorMessage: 'Complete configuration first',
        isRequired: true
      })
      break
      
    case 'review':
      // Step 4 requires processing completed OR skipped (JSON import)
      rules.push({
        id: 'processing-completed-or-skipped-or-json-import',
        name: 'Processing Completed or Skipped or JSON Import',
        validate: async () => {
          const appStore = useAppStore.getState()
          const processingComplete = workflowStateManager.isStepComplete('processing')
          const processingSkipped = workflowStateManager.isStepSkipped('processing')
          const configSkipped = workflowStateManager.isStepSkipped('config')
          const exportAccessible = workflowStateManager.isStepAccessible('export')
          
          // Check for JSON import context
          const isJsonImport = appStore.config.importedJsonFile || 
                              appStore.config.isImportedFromJson ||
                              (configSkipped && processingSkipped)
          const hasSubtitleData = Array.isArray(appStore.config.subtitle) && appStore.config.subtitle.length > 0
          
          console.log('🔍 Review step validation check:', {
            processingComplete,
            processingSkipped,
            configSkipped,
            exportAccessible,
            isJsonImport,
            hasSubtitleData
          })
          
          const canAccess = processingComplete || 
                           processingSkipped || 
                           exportAccessible || 
                           (isJsonImport && hasSubtitleData) ||
                           (configSkipped && processingSkipped)
                           
          console.log('🔍 Review step validation result:', canAccess)
          return canAccess
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
          return workflowStateManager.isStepAccessible('review')
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
      
      set(_state => ({
        mediaValidation: result
      }))
      
      return result
    },

    updateMediaFile: async (filePath) => {
      const currentState = get()
      const currentFilePath = useAppStore.getState().config.inputFile
      
      console.log('🔧 updateMediaFile called:', {
        filePath,
        currentFilePath,
        timestamp: Date.now(),
        shouldSkip: currentFilePath === filePath && currentState.mediaValidation.lastValidated
      })
      
      // PERFORMANCE FIX: Skip if same file path and already validated
      if (currentFilePath === filePath && currentState.mediaValidation.lastValidated) {
        console.log('🔧 [PERFORMANCE] updateMediaFile: Skipping - same file already validated')
        return
      }
      
      // Validate media file first and get result
      const result = await get().validateMediaFile()
      
      // Apply the user experience flow immediately after media validation
      if (result) {
        // Check if step access enforcement is needed
        const hasMediaFile = !!filePath
        const inputStepState = workflowStateManager.getStepState('input-file')
        const configStepState = workflowStateManager.getStepState('config')
        
        // RACE CONDITION FIX: Don't interfere if step-state-controller already set correct states
        // For video uploads: input=Complete + config=Ready is the correct end state
        const isCorrectVideoUploadState = hasMediaFile && 
          inputStepState === StepState.Complete && 
          configStepState === StepState.Ready
          
        if (isCorrectVideoUploadState) {
          console.log('🔧 [RACE CONDITION FIX] Step states already correctly set by step-state-controller - skipping enforcement')
          return // Don't interfere with correct state
        }
        
        const shouldEnforceAccess = hasMediaFile && 
          (inputStepState !== StepState.Complete || configStepState !== StepState.Ready)
        
        if (shouldEnforceAccess) {
          console.log('🔧 [VALIDATION] Enforcing step access - states need update')
          await get().enforceStepAccess()
        } else {
          console.log('🔧 [PERFORMANCE] Skipping step access enforcement - states already correct')
        }
        
        // Only validate steps that are accessible to avoid error states on blocked steps
        const allSteps = workflowStateManager.getAllSteps()
        const accessibleSteps = Array.from(allSteps.values())
          .filter(step => step.stateMetadata.state === StepState.Ready || step.stateMetadata.state === StepState.Complete)
          .map(step => step.id)
        
        for (const stepId of accessibleSteps) {
          await get().validateStep(stepId)
        }
        
        // Only sync if we actually made changes
        if (shouldEnforceAccess) {
          console.log('🔧 [VALIDATION] Syncing workflow store after changes')
          await get().syncWithWorkflowStore()
        } else {
          console.log('🔧 [PERFORMANCE] Skipping workflow sync - no changes made')
        }
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
      set(state => {
        const { [stepId]: removed, ...remainingValidations } = state.stepValidations
        return {
          stepValidations: remainingValidations
        }
      })
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

    // Modern Step Access Enforcement - Works with WorkflowStateManager
    enforceStepAccess: async () => {
      const appStore = useAppStore.getState()
      const hasMediaFile = !!appStore.config.inputFile
      
      // PERFORMANCE FIX: Check current states to avoid unnecessary transitions
      const inputStepState = workflowStateManager.getStepState('input-file')
      const configStepState = workflowStateManager.getStepState('config')
      
      console.log('🔧 Modern enforceStepAccess:', {
        hasMediaFile,
        inputStepState,
        configStepState,
        timestamp: Date.now()
      })
      
      if (!hasMediaFile) {
        // No media file: Step 1 ready, Steps 2-5 blocked
        if (inputStepState !== StepState.Ready || configStepState !== StepState.Blocked) {
          console.log('🔧 No media file - resetting workflow')
        } else {
          console.log('🔧 [PERFORMANCE] Workflow already in correct state for no media file')
          return
        }
        
        // Clear validation states for blocked steps
        const state = get()
        const clearedValidations = { ...state.stepValidations }
        const blockedSteps = ['config', 'processing', 'review', 'export']
        
        blockedSteps.forEach(stepId => {
          delete clearedValidations[stepId]
        })
        
        set({ stepValidations: clearedValidations })
        
        // Use atomic video removal from step state controller
        await atomicVideoRemoval()
        
      } else {
        // Media file present: Step 1 completed, Step 2 ready
        // PERFORMANCE FIX: Check if states are already correct to avoid unnecessary transitions
        if (inputStepState === StepState.Complete && configStepState === StepState.Ready) {
          console.log('🔧 [PERFORMANCE] Media file states already correct - skipping transitions')
          return
        }
        
        console.log('🔧 Media file present - enabling config step')
        
        if (configStepState !== StepState.Ready) {
          await workflowStateManager.transitionState('config', StepState.Ready, {
            reason: 'Media uploaded - config step ready'
          })
        }
        
        // Note: Step completion handled by explicit user action, not automatic navigation
      }
    },

    updateWorkflowFromValidation: async () => {
      const state = get()
      console.log('🔄 Updating workflow from validation results')
      
      // Process validation results and update WorkflowStateManager accordingly
      for (const [stepId, validation] of Object.entries(state.stepValidations)) {
        if (validation) {
          try {
            // Determine target state based on validation results
            let targetState: StepState
            
            if (stepId === 'input-file') {
              // Step 1 is always ready when accessible
              targetState = StepState.Ready
            } else if (validation.errors.length > 0) {
              // Steps with validation errors go to Error state
              targetState = StepState.Error
            } else if (validation.warnings.length > 0) {
              // Steps with warnings go to Warning state
              targetState = StepState.Warning
            } else if (!validation.canAccess) {
              // Steps that can't be accessed are blocked
              targetState = StepState.Blocked
            } else {
              // Valid steps are ready
              targetState = StepState.Ready
            }
            
            // Update state through WorkflowStateManager
            await workflowStateManager.transitionState(stepId as StepId, targetState, {
              reason: 'Validation result update',
              message: validation.errors.length > 0 ? validation.errors[0] : undefined,
              context: {
                validationErrors: validation.errors,
                validationWarnings: validation.warnings,
                lastValidated: validation.lastValidated
              }
            })
            
          } catch (error) {
            console.error(`Failed to update state for step ${stepId}:`, error)
          }
        }
      }
    },

    // Modern workflow synchronization
    syncWithWorkflowStore: async () => {
      console.log('🔄 Syncing validation with WorkflowStateManager')
      await get().enforceStepAccess()
      await get().updateWorkflowFromValidation()
    },

    // Utility
    initialize: async () => {
      await get().validateMediaFile()
      await get().validateAllSteps()
      await get().syncWithWorkflowStore()
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

// Initialize subscriptions after module load to prevent circular dependency issues
let updateTimeout: NodeJS.Timeout | null = null

// Initialize subscriptions in a timeout to ensure all stores are loaded
const initializeSubscriptions = () => {
  try {
    // Subscribe to app store changes for automatic validation
    useAppStore.subscribe(
      (state) => state.config.inputFile,
      (inputFile, prevInputFile) => {
        // PERFORMANCE FIX: Skip during JSON import to prevent cascade re-renders
        const importFlag = window as Window & { __JSON_IMPORT_IN_PROGRESS?: boolean }
        if (importFlag.__JSON_IMPORT_IN_PROGRESS) {
          console.log('🚀 [PERFORMANCE] Skipping inputFile validation during JSON import')
          return
        }
        
        // PERFORMANCE FIX: Additional null/undefined comparison to prevent excessive calls
        if (inputFile !== prevInputFile && !(inputFile === null && prevInputFile === undefined)) {
          console.log('🔧 App store inputFile subscription triggered:', {
            inputFile,
            prevInputFile,
            timestamp: Date.now()
          })
          
          // Debounce updates to prevent race conditions
          if (updateTimeout) {
            clearTimeout(updateTimeout)
          }
          
          updateTimeout = setTimeout(async () => {
            // Double-check import flag before proceeding with validation
            const importFlag = window as Window & { __JSON_IMPORT_IN_PROGRESS?: boolean }
            if (importFlag.__JSON_IMPORT_IN_PROGRESS) {
              console.log('🚀 [PERFORMANCE] Aborting validation - import still in progress')
              updateTimeout = null
              return
            }
            
            const validationStore = useWorkflowValidationStore.getState()
            // PERFORMANCE FIX: Check if we already have this file validated before updating
            const currentValidation = validationStore.mediaValidation
            if (currentValidation.mediaPath === inputFile && currentValidation.lastValidated) {
              console.log('🔧 [PERFORMANCE] Subscription: File already validated, skipping update')
              updateTimeout = null
              return
            }
            
            await validationStore.updateMediaFile(inputFile)
            updateTimeout = null
          }, 50) // 50ms debounce
        }
      }
    )

    // Subscribe to dependencies changes
    useAppStore.subscribe(
      (state) => state.dependencies,
      async (dependencies, prevDependencies) => {
        // PERFORMANCE FIX: Skip dependency validation during JSON import
        const importFlag = window as Window & { __JSON_IMPORT_IN_PROGRESS?: boolean }
        if (importFlag.__JSON_IMPORT_IN_PROGRESS) {
          console.log('🚀 [PERFORMANCE] Skipping dependency validation during JSON import')
          return
        }
        
        if (JSON.stringify(dependencies) !== JSON.stringify(prevDependencies)) {
          const validationStore = useWorkflowValidationStore.getState()
          await validationStore.validateStep('config')
        }
      }
    )
    
    console.log('✅ Workflow validation store subscriptions initialized')
  } catch (error) {
    console.warn('⚠️ Failed to initialize workflow validation subscriptions:', error)
  }
}

// Initialize subscriptions after current execution context
setTimeout(initializeSubscriptions, 0)

// Export selectors
export const selectMediaValidation = (state: WorkflowValidationStore) => state.mediaValidation
export const selectStepValidation = (stepId: string) => (state: WorkflowValidationStore) => 
  state.stepValidations[stepId]
export const selectValidationSummary = (state: WorkflowValidationStore) => 
  state.getValidationSummary()