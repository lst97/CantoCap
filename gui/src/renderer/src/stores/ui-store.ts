import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// UI State Types
export interface LoadingOverlayState {
  isVisible: boolean
  message: string
  progress?: number
  isDeterminate: boolean
  canCancel: boolean
  onCancel?: () => void
}

export interface SettingsUIState {
  isSettingsMode: boolean
  activeSettingsTab: string
  settingsHistory: string[]
}

export interface DynamicTitleState {
  currentTitle: string
  contextType: 'workspace' | 'settings' | 'processing'
  metadata?: {
    workspaceName?: string
    processingStage?: string
    settingsSection?: string
  }
}

export interface StepValidationState {
  hasMediaFile: boolean
  validationResults: Record<string, {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>
  lastValidated: number | null
}

// Combined UI State
interface UIState {
  // Loading Overlay Management
  loadingOverlay: LoadingOverlayState
  
  // Settings Integration
  settingsUI: SettingsUIState
  
  // Dynamic Title Management
  dynamicTitle: DynamicTitleState
  
  // Step Validation
  stepValidation: StepValidationState
  
  // General UI state
  isInitialized: boolean
  lastStateUpdate: number
}

// UI Actions
interface UIActions {
  // Loading Overlay Actions
  showLoadingOverlay: (config: Partial<LoadingOverlayState>) => void
  updateLoadingProgress: (progress: number, message?: string) => void
  hideLoadingOverlay: () => void
  
  // Settings Mode Actions
  enterSettingsMode: (activeTab?: string) => void
  exitSettingsMode: () => void
  setActiveSettingsTab: (tab: string) => void
  navigateSettings: (tab: string, addToHistory?: boolean) => void
  goBackInSettings: () => void
  
  // Dynamic Title Actions
  updateTitle: (title: string, contextType: DynamicTitleState['contextType'], metadata?: DynamicTitleState['metadata']) => void
  resetTitle: () => void
  
  // Step Validation Actions
  validateStepRequirements: (stepId: string) => Promise<boolean>
  updateMediaFileStatus: (hasMedia: boolean) => void
  resetStepValidation: () => void
  setStepValidationResult: (stepId: string, result: { isValid: boolean; errors: string[]; warnings: string[] }) => void
  
  // Utility Actions
  initialize: () => void
  reset: () => void
}

type UIStore = UIState & UIActions

// Initial state
const initialState: UIState = {
  loadingOverlay: {
    isVisible: false,
    message: 'Loading...',
    progress: 0,
    isDeterminate: false,
    canCancel: false
  },
  settingsUI: {
    isSettingsMode: false,
    activeSettingsTab: 'system',
    settingsHistory: []
  },
  dynamicTitle: {
    currentTitle: 'CantoCap',
    contextType: 'workspace',
    metadata: {}
  },
  stepValidation: {
    hasMediaFile: false,
    validationResults: {},
    lastValidated: null
  },
  isInitialized: false,
  lastStateUpdate: Date.now()
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Loading Overlay Actions
    showLoadingOverlay: (config) => {
      set(state => ({
        loadingOverlay: {
          ...state.loadingOverlay,
          ...config,
          isVisible: true
        },
        lastStateUpdate: Date.now()
      }))
    },

    updateLoadingProgress: (progress, message) => {
      set(state => ({
        loadingOverlay: {
          ...state.loadingOverlay,
          progress,
          message: message || state.loadingOverlay.message,
          isDeterminate: true
        },
        lastStateUpdate: Date.now()
      }))
    },

    hideLoadingOverlay: () => {
      set(state => ({
        loadingOverlay: {
          ...state.loadingOverlay,
          isVisible: false,
          progress: 0,
          isDeterminate: false
        },
        lastStateUpdate: Date.now()
      }))
    },

    // Settings Mode Actions
    enterSettingsMode: (activeTab = 'system') => {
      set(state => ({
        settingsUI: {
          ...state.settingsUI,
          isSettingsMode: true,
          activeSettingsTab: activeTab,
          settingsHistory: [activeTab]
        },
        // Preserve original title - don't change it to 'Settings'
        dynamicTitle: {
          ...state.dynamicTitle, // Keep existing title
          contextType: 'settings',
          metadata: { 
            ...state.dynamicTitle.metadata,
            settingsSection: activeTab 
          }
        },
        lastStateUpdate: Date.now()
      }))
    },

    exitSettingsMode: () => {
      set(state => ({
        settingsUI: {
          ...state.settingsUI,
          isSettingsMode: false,
          settingsHistory: []
        },
        lastStateUpdate: Date.now()
      }))
      
      // Reset title when exiting settings
      get().resetTitle()
    },

    setActiveSettingsTab: (tab) => {
      set(state => ({
        settingsUI: {
          ...state.settingsUI,
          activeSettingsTab: tab
        },
        dynamicTitle: {
          ...state.dynamicTitle,
          metadata: { ...state.dynamicTitle.metadata, settingsSection: tab }
        },
        lastStateUpdate: Date.now()
      }))
    },

    navigateSettings: (tab, addToHistory = true) => {
      set(state => ({
        settingsUI: {
          ...state.settingsUI,
          activeSettingsTab: tab,
          settingsHistory: addToHistory 
            ? [...state.settingsUI.settingsHistory, tab]
            : state.settingsUI.settingsHistory
        },
        dynamicTitle: {
          ...state.dynamicTitle,
          metadata: { ...state.dynamicTitle.metadata, settingsSection: tab }
        },
        lastStateUpdate: Date.now()
      }))
    },

    goBackInSettings: () => {
      const state = get()
      if (state.settingsUI.settingsHistory.length <= 1) return
      
      const newHistory = [...state.settingsUI.settingsHistory]
      newHistory.pop() // Remove current
      const previousTab = newHistory[newHistory.length - 1]
      
      set({
        settingsUI: {
          ...state.settingsUI,
          activeSettingsTab: previousTab,
          settingsHistory: newHistory
        },
        dynamicTitle: {
          ...state.dynamicTitle,
          metadata: { ...state.dynamicTitle.metadata, settingsSection: previousTab }
        },
        lastStateUpdate: Date.now()
      })
    },

    // Dynamic Title Actions
    updateTitle: (title, contextType, metadata) => {
      set(state => ({
        dynamicTitle: {
          currentTitle: title,
          contextType,
          metadata: { ...state.dynamicTitle.metadata, ...metadata }
        },
        lastStateUpdate: Date.now()
      }))
    },

    resetTitle: () => {
      // Import app store to get current workspace name (avoiding circular dependency)
      try {
        // This will be resolved through the integration hooks
        set(state => ({
          dynamicTitle: {
            currentTitle: 'CantoCap', // Default title
            contextType: 'workspace',
            metadata: {}
          },
          lastStateUpdate: Date.now()
        }))
      } catch (error) {
        console.warn('Could not reset title to workspace name:', error)
      }
    },

    // Step Validation Actions
    validateStepRequirements: async (stepId) => {
      const state = get()
      
      // Basic validation logic
      let isValid = true
      const errors: string[] = []
      const warnings: string[] = []
      
      switch (stepId) {
        case 'input-file':
          isValid = state.stepValidation.hasMediaFile
          if (!isValid) {
            errors.push('No media file uploaded')
          }
          break
          
        case 'config':
          if (!state.stepValidation.hasMediaFile) {
            isValid = false
            errors.push('Cannot configure without media file')
          }
          break
          
        case 'processing':
        case 'review':
        case 'export':
          if (!state.stepValidation.hasMediaFile) {
            isValid = false
            errors.push('Cannot proceed without media file')
          }
          break
      }
      
      // Update validation result
      get().setStepValidationResult(stepId, { isValid, errors, warnings })
      
      return isValid
    },

    updateMediaFileStatus: (hasMedia) => {
      set(state => ({
        stepValidation: {
          ...state.stepValidation,
          hasMediaFile: hasMedia,
          lastValidated: Date.now()
        },
        lastStateUpdate: Date.now()
      }))
      
      // Trigger re-validation of all steps
      const stepIds = ['input-file', 'config', 'processing', 'review', 'export']
      stepIds.forEach(stepId => {
        get().validateStepRequirements(stepId)
      })
    },

    resetStepValidation: () => {
      set(state => ({
        stepValidation: {
          hasMediaFile: false,
          validationResults: {},
          lastValidated: null
        },
        lastStateUpdate: Date.now()
      }))
    },

    setStepValidationResult: (stepId, result) => {
      set(state => ({
        stepValidation: {
          ...state.stepValidation,
          validationResults: {
            ...state.stepValidation.validationResults,
            [stepId]: result
          },
          lastValidated: Date.now()
        },
        lastStateUpdate: Date.now()
      }))
    },

    // Utility Actions
    initialize: () => {
      set(state => ({
        isInitialized: true,
        lastStateUpdate: Date.now()
      }))
    },

    reset: () => {
      set({
        ...initialState,
        isInitialized: true,
        lastStateUpdate: Date.now()
      })
    }
  }))
)

// Selectors for performance optimization
export const selectLoadingOverlay = (state: UIStore) => state.loadingOverlay
export const selectSettingsUI = (state: UIStore) => state.settingsUI
export const selectDynamicTitle = (state: UIStore) => state.dynamicTitle
export const selectStepValidation = (state: UIStore) => state.stepValidation

// Type exports
export type { UIStore, LoadingOverlayState, SettingsUIState, DynamicTitleState, StepValidationState }