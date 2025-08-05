import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../stores/app-store'
import { workflowStateManager } from '../services/workflow/workflow-state-manager'
import { useWorkflowState } from '../contexts/WorkflowStateContext'
import { StepState } from '../types/workflow-state'
import { useWorkflowValidationStore } from '../stores/workflow-validation-store'
import { useUIStore } from '../stores/ui-store'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { useLoadingOverlay } from '../components/ui/LoadingOverlay'

/**
 * useWorkflowIntegration - Central hook for managing workflow state coordination
 * 
 * This hook coordinates between:
 * - App store (media files, processing)
 * - Workflow store (step navigation)
 * - Validation store (step requirements)
 * - UI store (loading, settings)
 * - Workspace store (workspace switching)
 */
export const useWorkflowIntegration = () => {
  const appStore = useAppStore()
  const { currentStep } = useWorkflowState()
  const allSteps = workflowStateManager.getAllSteps()
  const validationStore = useWorkflowValidationStore()
  const uiStore = useUIStore()
  const workspaceStore = useWorkspaceStore()
  const subtitleEditStore = useSubtitleEditStore()
  const loadingOverlay = useLoadingOverlay()

  // Initialize all systems
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize UI store
        uiStore.initialize()
        
        // Initialize validation system
        await validationStore.initialize()
        
        console.log('Workflow integration initialized successfully')
      } catch (error) {
        console.error('Failed to initialize workflow integration:', error)
      }
    }
    
    initialize()
  }, [])

  // PERFORMANCE FIX: Add debouncing to media file validation
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Handle media file validation and step state updates
  useEffect(() => {
    const hasMediaFile = !!appStore.config.inputFile
    
    console.log('🔧 useWorkflowIntegration media file change:', {
      inputFile: appStore.config.inputFile,
      hasMediaFile,
      timestamp: Date.now()
    })
    
    // PERFORMANCE FIX: Check if validation is needed before calling updateMediaFile
    const currentValidation = validationStore.mediaValidation
    const sameFile = currentValidation.mediaPath === appStore.config.inputFile
    const alreadyValidated = currentValidation.lastValidated !== null
    
    if (sameFile && alreadyValidated) {
      console.log('🔧 [PERFORMANCE] useWorkflowIntegration: Skipping validation - file already validated')
    } else {
      // PERFORMANCE FIX: Debounce validation updates to prevent rapid-fire calls
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
      
      validationTimeoutRef.current = setTimeout(() => {
        // Update validation store (this already calls enforceStepAccess internally)
        validationStore.updateMediaFile(appStore.config.inputFile)
        validationTimeoutRef.current = null
      }, 100) // 100ms debounce
    }
    
    // Update UI store immediately (no debounce needed for UI state)
    uiStore.updateMediaFileStatus(hasMediaFile)
    
    // Note: syncWithWorkflowStore is now called internally by updateMediaFile
    // to prevent race conditions
    
    // Cleanup timeout on unmount
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
        validationTimeoutRef.current = null
      }
    }
    
  }, [appStore.config.inputFile])

  // Handle workspace switching with loading overlay
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    
    if (workspaceStore.isLoading) {
      const currentWorkspaceName = workspaceStore.currentWorkspace?.name || 'Unknown'
      
      // Show loading overlay after a short delay to avoid flashing
      timeoutId = setTimeout(() => {
        loadingOverlay.showWorkspaceSwitching(currentWorkspaceName)
      }, 100)
    } else {
      loadingOverlay.hide()
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [workspaceStore.isLoading, workspaceStore.currentWorkspace?.name])

  // Handle processing state updates
  useEffect(() => {
    if (appStore.processing.isActive) {
      // Update dynamic title for processing
      uiStore.updateTitle(
        'Processing',
        'processing',
        {
          processingStage: appStore.processing.stage,
        }
      )
    } else if (!uiStore.settingsUI.isSettingsMode) {
      // Reset title when not processing and not in settings
      uiStore.resetTitle()
    }
  }, [appStore.processing.isActive, appStore.processing.stage, uiStore.settingsUI.isSettingsMode])

  // Workspace title management is now handled in StepNavigation component

  // Step validation integration
  const validateCurrentStep = useCallback(async () => {
    // Using modern currentStep from useWorkflowState hook
    const validation = await validationStore.validateStep(currentStep)
    
    // Update workflow state with validation results using WorkflowStateManager
    // Special handling for input-file step - never mark as error (it's the entry point)
    if (currentStep === 'input-file') {
      await workflowStateManager.transitionState('input-file', StepState.Ready, {
        reason: 'Input step is entry point - always accessible'
      })
    }
    // Special handling for config step - don't mark as error if accessible
    else if (currentStep === 'config' && validation.canAccess) {
      // Config step is accessible, don't show as error even if not fully configured
      await workflowStateManager.transitionState('config', StepState.Ready, {
        reason: 'Config step is accessible'
      })
    } else if (validation.errors.length > 0) {
      await workflowStateManager.transitionState(currentStep, StepState.Error, {
        reason: 'Validation failed',
        message: validation.errors.join(', ')
      })
    } else {
      await workflowStateManager.transitionState(currentStep, StepState.Ready, {
        reason: 'Validation passed'
      })
    }
    
    return validation.isValid
  }, [currentStep])

  // Enhanced step navigation with validation and session saving
  const navigateToStep = useCallback(async (stepId: string) => {
    // Save current session if we're leaving the review step and have unsaved changes
    // Using modern currentStep from useWorkflowState hook
    
    if (currentStep === 'review' && subtitleEditStore.session?.isDirty) {
      try {
        console.log('💾 Saving subtitle session before navigation...')
        await subtitleEditStore.saveSessionToTempStorage()
        console.log('✅ Subtitle session saved successfully')
      } catch (error) {
        console.warn('Failed to save subtitle session during navigation:', error)
        // Continue navigation even if save fails - user can recover later
      }
    }
    
    // Always allow navigation to step 1 (input-file) - users should always be able to return to the beginning
    if (stepId === 'input-file') {
      workflowStateManager.setCurrentStep(stepId)
      return true
    }
    
    // Validate other steps
    const validation = await validationStore.validateStep(stepId)
    
    if (validation.canAccess) {
      workflowStateManager.setCurrentStep(stepId)
      return true
    } else {
      // Show validation errors
      console.warn(`Cannot navigate to step ${stepId}:`, validation.errors)
      return false
    }
  }, [currentStep, validationStore, subtitleEditStore])

  // Settings mode integration
  const enterSettingsMode = useCallback((initialTab?: string) => {
    uiStore.enterSettingsMode(initialTab)
  }, [])

  const exitSettingsMode = useCallback(() => {
    uiStore.exitSettingsMode()
    // Reset title to workspace name
    uiStore.resetTitle()
  }, [])

  // Workspace switching with validation and session saving
  const switchWorkspace = useCallback(async (workspaceId: string) => {
    try {
      loadingOverlay.showIndeterminate('Switching workspace...')
      
      // Save current subtitle session if we have unsaved changes
      if (subtitleEditStore.session?.isDirty) {
        try {
          console.log('💾 Saving subtitle session before workspace switch...')
          await subtitleEditStore.saveSessionToTempStorage()
          console.log('✅ Subtitle session saved successfully')
        } catch (error) {
          console.warn('Failed to save subtitle session during workspace switch:', error)
        }
      }
      
      await workspaceStore.switchWorkspace(workspaceId)
      
      // Re-validate all steps after workspace switch
      await validationStore.validateAllSteps()
      validationStore.syncWithWorkflowStore()
      
      loadingOverlay.hide()
      return true
    } catch (error) {
      loadingOverlay.hide()
      console.error('Failed to switch workspace:', error)
      return false
    }
  }, [loadingOverlay, workspaceStore, validationStore, subtitleEditStore])

  // Get comprehensive validation summary
  const getValidationSummary = useCallback(() => {
    return {
      ...validationStore.getValidationSummary(),
      mediaValidation: validationStore.mediaValidation,
      stepValidations: validationStore.stepValidations
    }
  }, [validationStore.getValidationSummary, validationStore.mediaValidation, validationStore.stepValidations])

  return {
    // Step navigation
    navigateToStep,
    validateCurrentStep,
    currentStep: currentStep,
    steps: Array.from(allSteps.values()),
    
    // Settings integration
    enterSettingsMode,
    exitSettingsMode,
    isSettingsMode: uiStore.settingsUI.isSettingsMode,
    
    // Workspace management
    switchWorkspace,
    currentWorkspace: workspaceStore.currentWorkspace,
    availableWorkspaces: workspaceStore.availableWorkspaces,
    
    // Validation
    getValidationSummary,
    hasMediaFile: validationStore.mediaValidation.hasMediaFile,
    
    // Loading states
    isLoading: workspaceStore.isLoading || validationStore.isValidating,
    loadingOverlay,
    
    // Processing state
    processing: appStore.processing,
    
    // UI state
    dynamicTitle: uiStore.dynamicTitle,
    
    // Actions
    showLoadingOverlay: loadingOverlay.show,
    hideLoadingOverlay: loadingOverlay.hide,
    updateTitle: uiStore.updateTitle,
    resetTitle: uiStore.resetTitle
  }
}

/**
 * useStepValidation - Hook for step-specific validation
 */
export const useStepValidation = (stepId: string) => {
  const validationStore = useWorkflowValidationStore()
  const validation = validationStore.stepValidations[stepId]
  
  const validateStep = useCallback(async () => {
    return await validationStore.validateStep(stepId)
  }, [stepId])
  
  return {
    validation,
    validateStep,
    isValid: validation?.isValid ?? false,
    canAccess: validation?.canAccess ?? false,
    errors: validation?.errors ?? [],
    warnings: validation?.warnings ?? [],
    isValidating: validationStore.isValidating
  }
}

/**
 * useSettingsIntegration - Hook for settings mode management
 */
export const useSettingsIntegration = () => {
  const uiStore = useUIStore()
  
  return {
    isSettingsMode: uiStore.settingsUI.isSettingsMode,
    activeTab: uiStore.settingsUI.activeSettingsTab,
    settingsHistory: uiStore.settingsUI.settingsHistory,
    
    enterSettings: uiStore.enterSettingsMode,
    exitSettings: uiStore.exitSettingsMode,
    setActiveTab: uiStore.setActiveSettingsTab,
    navigateSettings: uiStore.navigateSettings,
    goBackInSettings: uiStore.goBackInSettings,
    
    canGoBack: uiStore.settingsUI.settingsHistory.length > 1
  }
}