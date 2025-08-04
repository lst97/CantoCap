/**
 * Workspace Integration Hooks
 * Provides React hooks for workspace requirement detection, empty state management,
 * and seamless integration with the step configuration system
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRestorationSafeEffect, isInGlobalRestorationMode } from '../utils/restoration-guards'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useStepConfig, useBatchStepConfig } from './useStepConfig'
import { validateBatchStepConfigs } from '../utils/stepConfigValidation'
import type {
  WorkflowStepId,
  StepConfigMap,
  BatchValidationResult,
  WorkspaceError,
  ConfigHealthCheck
} from '../types/workspace'

// ============================================================================
// WORKSPACE REQUIREMENT HOOKS
// ============================================================================

interface WorkspaceRequirement {
  /** Whether any workspace exists */
  hasAnyWorkspace: boolean
  /** Current workspace count */
  workspaceCount: number
  /** Whether a workspace is currently active */
  hasActiveWorkspace: boolean
  /** Current active workspace ID */
  activeWorkspaceId: string | null
  /** Whether the workspace system is initialized */
  isInitialized: boolean
  /** Whether workspaces are currently loading */
  isLoading: boolean
  /** Whether step configurations are enabled for current workspace */
  stepConfigsEnabled: boolean
  /** Last error if any */
  error: WorkspaceError | null
}

/**
 * Hook for detecting workspace requirements and empty states
 * Essential for routing logic and conditional rendering
 */
export function useWorkspaceRequirement(): WorkspaceRequirement {
  const store = useWorkspaceStore()
  const [stepConfigsEnabled, setStepConfigsEnabled] = useState(false)
  const hasMountedRef = useRef(false)
  
  // Check if step configs are enabled for current workspace
  useRestorationSafeEffect(() => {
    const checkStepConfigs = async () => {
      if (store.currentWorkspace) {
        try {
          const enabled = await store.isStepConfigEnabled(store.currentWorkspace.id)
          setStepConfigsEnabled(enabled)
        } catch (error) {
          console.warn('Failed to check step config status:', error)
          setStepConfigsEnabled(false)
        }
      } else {
        setStepConfigsEnabled(false)
      }
    }
    
    checkStepConfigs()
  }, [store.currentWorkspace?.id], {
    skipInitialMount: true,
    skipDuringRestore: true,
    description: 'workspace step config check'
  })
  
  return {
    hasAnyWorkspace: store.hasAnyWorkspace(),
    workspaceCount: store.getWorkspaceCount(),
    hasActiveWorkspace: store.currentWorkspace !== null,
    activeWorkspaceId: store.currentWorkspace?.id || null,
    isInitialized: store.isInitialized,
    isLoading: store.isLoading,
    stepConfigsEnabled,
    error: store.lastError
  }
}

/**
 * Hook for workspace empty state detection with creation helpers
 */
export function useWorkspaceEmptyState() {
  const requirement = useWorkspaceRequirement()
  const store = useWorkspaceStore()
  const [isCreating, setIsCreating] = useState(false)
  
  const createFirstWorkspace = useCallback(async (name: string = 'My First Workspace') => {
    setIsCreating(true)
    try {
      await store.createWorkspace(name)
      // Auto-switch to the new workspace
      const workspaces = store.availableWorkspaces
      if (workspaces.length > 0) {
        const newWorkspace = workspaces[workspaces.length - 1]
        await store.switchWorkspace(newWorkspace.id)
      }
    } catch (error) {
      console.error('Failed to create first workspace:', error)
      throw error
    } finally {
      setIsCreating(false)
    }
  }, [store])
  
  return {
    ...requirement,
    isEmpty: !requirement.hasAnyWorkspace && requirement.isInitialized,
    isCreating,
    createFirstWorkspace
  }
}

// ============================================================================
// STEP CONFIGURATION INTEGRATION HOOKS
// ============================================================================

interface WorkspaceStepIntegrationOptions {
  /** Enable automatic validation */
  autoValidate?: boolean
  /** Enable real-time sync */
  syncEnabled?: boolean
  /** Steps to include in integration */
  steps?: WorkflowStepId[]
  /** Error handler */
  onError?: (error: WorkspaceError) => void
}

interface WorkspaceStepIntegrationState {
  /** All step configurations */
  stepConfigs: Partial<StepConfigMap>
  /** Validation results for all steps */
  validationResults: Record<WorkflowStepId, any>
  /** Overall configuration health */
  configHealth: ConfigHealthCheck | null
  /** Loading states */
  isLoading: boolean
  isSaving: boolean
  isValidating: boolean
  /** Error states */
  errors: Record<WorkflowStepId, WorkspaceError | null>
  hasErrors: boolean
  /** Dirty state tracking */
  isDirty: boolean
  dirtySteps: WorkflowStepId[]
}

interface WorkspaceStepIntegrationActions {
  /** Update a specific step configuration */
  updateStepConfig: <K extends WorkflowStepId>(
    stepId: K,
    updates: Partial<StepConfigMap[K]>
  ) => Promise<void>
  /** Update multiple step configurations */
  updateMultipleSteps: (updates: Partial<Record<WorkflowStepId, any>>) => Promise<void>
  /** Reset a step to defaults */
  resetStep: (stepId: WorkflowStepId) => Promise<void>
  /** Reset all steps to defaults */
  resetAllSteps: () => Promise<void>
  /** Validate all configurations */
  validateAll: () => Promise<BatchValidationResult>
  /** Save all changes */
  saveAll: () => Promise<void>
  /** Refresh all configurations */
  refreshAll: () => Promise<void>
  /** Clear errors for a specific step */
  clearStepError: (stepId: WorkflowStepId) => void
  /** Clear all errors */
  clearAllErrors: () => void
}

/**
 * Comprehensive hook for workspace step configuration integration
 * Manages all step configurations with unified state and actions
 */
export function useWorkspaceStepIntegration(
  options: WorkspaceStepIntegrationOptions = {}
): WorkspaceStepIntegrationState & WorkspaceStepIntegrationActions {
  const {
    autoValidate = true,
    syncEnabled = true,
    steps = ['input-file', 'config', 'processing', 'review', 'export'],
    onError
  } = options
  
  const requirement = useWorkspaceRequirement()
  const workspaceId = requirement.activeWorkspaceId
  
  // Use batch configuration management
  const batchConfig = useBatchStepConfig(workspaceId || '', {
    steps,
    autoValidate,
    onError
  })
  
  // Individual step validation results
  const [validationResults, setValidationResults] = useState<Record<WorkflowStepId, any>>({} as Record<WorkflowStepId, any>)
  const [configHealth, setConfigHealth] = useState<ConfigHealthCheck | null>(null)
  const [dirtySteps, setDirtySteps] = useState<WorkflowStepId[]>([])
  
  // Validate all configurations
  const validateAll = useCallback(async (): Promise<BatchValidationResult> => {
    if (!workspaceId) {
      return {
        overallValid: false,
        stepResults: {},
        totalErrors: 1,
        totalWarnings: 0,
        criticalErrors: []
      }
    }
    
    const result = validateBatchStepConfigs(batchConfig.configs)
    setValidationResults(result.stepResults as Record<WorkflowStepId, any>)
    
    // Update config health
    const health: ConfigHealthCheck = {
      workspaceId,
      overallHealth: result.overallValid ? 'excellent' : 
        result.totalErrors > 5 ? 'critical' :
        result.totalErrors > 2 ? 'poor' :
        result.totalWarnings > 3 ? 'fair' : 'good',
      stepHealth: {} as Record<WorkflowStepId, 'healthy' | 'warning' | 'error' | 'missing'>,
      issues: [],
      performanceHints: [],
      migrationRecommended: false,
      lastHealthCheck: Date.now()
    }
    
    // Map step results to health indicators
    for (const stepId of steps) {
      const stepResult = result.stepResults[stepId]
      if (!stepResult) {
        health.stepHealth[stepId] = 'missing'
      } else if (!stepResult.isValid) {
        health.stepHealth[stepId] = 'error'
      } else if (stepResult.warnings.length > 0) {
        health.stepHealth[stepId] = 'warning'
      } else {
        health.stepHealth[stepId] = 'healthy'
      }
    }
    
    setConfigHealth(health)
    return result
  }, [workspaceId, batchConfig.configs, steps])
  
  // Auto-validate when configurations change (with restoration guard)
  useRestorationSafeEffect(() => {
    // Skip validation if workspace is being restored or configs are empty
    if (!autoValidate || Object.keys(batchConfig.configs).length === 0) {
      return
    }
    
    // Additional check for global restoration mode
    if (isInGlobalRestorationMode()) {
      console.log('🛡️ Skipping auto-validation during global restoration mode')
      return
    }
    
    // Debounce validation to prevent excessive calls
    const timeoutId = setTimeout(() => {
      validateAll().catch(error => {
        console.warn('Auto-validation failed:', error)
      })
    }, 300)
    
    return () => clearTimeout(timeoutId)
  }, [autoValidate, batchConfig.configs], {
    skipInitialMount: true,
    skipDuringRestore: true,
    description: 'batch config auto-validation'
  })
  
  // Update step configuration
  const updateStepConfig = useCallback(async <K extends WorkflowStepId>(
    stepId: K,
    updates: Partial<StepConfigMap[K]>
  ): Promise<void> => {
    if (!workspaceId) return
    
    await batchConfig.batchUpdate({ [stepId]: updates })
    
    // Track dirty state
    setDirtySteps(prev => prev.includes(stepId) ? prev : [...prev, stepId])
  }, [workspaceId, batchConfig])
  
  // Update multiple steps
  const updateMultipleSteps = useCallback(async (
    updates: Partial<Record<WorkflowStepId, any>>
  ): Promise<void> => {
    if (!workspaceId) return
    
    await batchConfig.batchUpdate(updates)
    
    // Track dirty state
    const updatedSteps = Object.keys(updates) as WorkflowStepId[]
    setDirtySteps(prev => {
      const newSteps = updatedSteps.filter(step => !prev.includes(step))
      return [...prev, ...newSteps]
    })
  }, [workspaceId, batchConfig])
  
  // Reset step to defaults
  const resetStep = useCallback(async (stepId: WorkflowStepId): Promise<void> => {
    if (!workspaceId) return
    
    const store = useWorkspaceStore.getState()
    await store.resetStepConfig(workspaceId, stepId)
    await batchConfig.refresh()
    
    // Remove from dirty steps
    setDirtySteps(prev => prev.filter(step => step !== stepId))
  }, [workspaceId, batchConfig])
  
  // Reset all steps to defaults
  const resetAllSteps = useCallback(async (): Promise<void> => {
    if (!workspaceId) return
    
    const store = useWorkspaceStore.getState()
    
    // Reset each step individually
    for (const stepId of steps) {
      await store.resetStepConfig(workspaceId, stepId)
    }
    
    await batchConfig.refresh()
    setDirtySteps([])
  }, [workspaceId, steps, batchConfig])
  
  // Save all changes
  const saveAll = useCallback(async (): Promise<void> => {
    if (!workspaceId || dirtySteps.length === 0) return
    
    // The batch config automatically saves, so we just need to clear dirty state
    setDirtySteps([])
  }, [workspaceId, dirtySteps])
  
  // Clear step error
  const clearStepError = useCallback((stepId: WorkflowStepId): void => {
    // Individual step error clearing would need to be implemented
    // For now, we'll rely on the batch config error handling
  }, [])
  
  // Clear all errors
  const clearAllErrors = useCallback((): void => {
    const store = useWorkspaceStore.getState()
    store.clearError()
  }, [])
  
  // Computed state
  const hasErrors = useMemo(() => {
    return Object.values(batchConfig.errors).some(error => error !== null)
  }, [batchConfig.errors])
  
  const isDirty = useMemo(() => {
    return dirtySteps.length > 0
  }, [dirtySteps])
  
  return {
    // State
    stepConfigs: batchConfig.configs,
    validationResults,
    configHealth,
    isLoading: batchConfig.isLoading,
    isSaving: batchConfig.isSaving,
    isValidating: false, // Would need to track this in batch config
    errors: batchConfig.errors,
    hasErrors,
    isDirty,
    dirtySteps,
    
    // Actions
    updateStepConfig,
    updateMultipleSteps,
    resetStep,
    resetAllSteps,
    validateAll,
    saveAll,
    refreshAll: batchConfig.refresh,
    clearStepError,
    clearAllErrors
  }
}

// ============================================================================
// STEP-SPECIFIC INTEGRATION HOOKS
// ============================================================================

/**
 * Hook for input file step integration with workspace context
 */
export function useInputFileIntegration(options: UseStepConfigOptions = {}) {
  const requirement = useWorkspaceRequirement()
  const stepConfig = useStepConfig('input-file', requirement.activeWorkspaceId || '', options)
  
  const hasFile = useMemo(() => {
    return stepConfig.config?.selectedFile ? true : false
  }, [stepConfig.config?.selectedFile])
  
  const hasValidFile = useMemo(() => {
    return hasFile && stepConfig.config?.fileValidation?.isValid === true
  }, [hasFile, stepConfig.config?.fileValidation?.isValid])
  
  return {
    ...stepConfig,
    ...requirement,
    hasFile,
    hasValidFile,
    canProceed: hasValidFile && stepConfig.validationResult?.isValid !== false
  }
}

/**
 * Hook for configuration step integration with workspace context
 */
export function useConfigIntegration(options: UseStepConfigOptions = {}) {
  const requirement = useWorkspaceRequirement()
  const stepConfig = useStepConfig('config', requirement.activeWorkspaceId || '', options)
  
  const hasLanguage = useMemo(() => {
    return stepConfig.config?.language ? true : false
  }, [stepConfig.config?.language])
  
  const hasApiKeys = useMemo(() => {
    return (stepConfig.config?.geminiKey || stepConfig.config?.noGeminiRefinement) ? true : false
  }, [stepConfig.config?.geminiKey, stepConfig.config?.noGeminiRefinement])
  
  return {
    ...stepConfig,
    ...requirement,
    hasLanguage,
    hasApiKeys,
    canProceed: hasLanguage && stepConfig.validationResult?.isValid !== false
  }
}

/**
 * Hook for processing step integration with workspace context
 */
export function useProcessingIntegration(options: UseStepConfigOptions = {}) {
  const requirement = useWorkspaceRequirement()
  const stepConfig = useStepConfig('processing', requirement.activeWorkspaceId || '', options)
  
  const isProcessingReady = useMemo(() => {
    return stepConfig.config?.qualitySettings?.enableQualityChecks !== false
  }, [stepConfig.config?.qualitySettings?.enableQualityChecks])
  
  return {
    ...stepConfig,
    ...requirement,
    isProcessingReady,
    canProceed: isProcessingReady && stepConfig.validationResult?.isValid !== false
  }
}

/**
 * Hook for review step integration with workspace context
 */
export function useReviewIntegration(options: UseStepConfigOptions = {}) {
  const requirement = useWorkspaceRequirement()
  const stepConfig = useStepConfig('review', requirement.activeWorkspaceId || '', options)
  
  const hasSubtitles = useMemo(() => {
    return stepConfig.config?.subtitleData && stepConfig.config.subtitleData.length > 0
  }, [stepConfig.config?.subtitleData])
  
  const reviewProgress = useMemo(() => {
    return stepConfig.config?.reviewState?.reviewProgress || 0
  }, [stepConfig.config?.reviewState?.reviewProgress])
  
  return {
    ...stepConfig,
    ...requirement,
    hasSubtitles,
    reviewProgress,
    canProceed: hasSubtitles && stepConfig.validationResult?.isValid !== false
  }
}

/**
 * Hook for export step integration with workspace context
 */
export function useExportIntegration(options: UseStepConfigOptions = {}) {
  const requirement = useWorkspaceRequirement()
  const stepConfig = useStepConfig('export', requirement.activeWorkspaceId || '', options)
  
  const hasOutputPath = useMemo(() => {
    return stepConfig.config?.outputFile ? true : false
  }, [stepConfig.config?.outputFile])
  
  const exportReady = useMemo(() => {
    return hasOutputPath && stepConfig.config?.formatSettings?.format
  }, [hasOutputPath, stepConfig.config?.formatSettings?.format])
  
  return {
    ...stepConfig,
    ...requirement,
    hasOutputPath,
    exportReady,
    canProceed: exportReady && stepConfig.validationResult?.isValid !== false
  }
}

// ============================================================================
// MIGRATION STATUS HOOK
// ============================================================================

interface MigrationStatus {
  /** Whether migration is needed */
  migrationNeeded: boolean
  /** Whether migration is in progress */
  migrationInProgress: boolean
  /** Migration progress percentage */
  migrationProgress: number
  /** Whether migration can be rolled back */
  canRollback: boolean
  /** Migration error if any */
  migrationError: WorkspaceError | null
}

/**
 * Hook for tracking workspace migration status
 */
export function useMigrationStatus(): MigrationStatus {
  const store = useWorkspaceStore()
  const requirement = useWorkspaceRequirement()
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  
  // Check if migration is needed for current workspace
  useRestorationSafeEffect(() => {
    const checkMigrationStatus = async () => {
      if (requirement.activeWorkspaceId) {
        try {
          const needed = await store.needsStepConfigMigration(requirement.activeWorkspaceId)
          setMigrationNeeded(needed)
        } catch (error) {
          console.warn('Failed to check migration status:', error)
          setMigrationNeeded(false)
        }
      }
    }
    
    checkMigrationStatus()
  }, [requirement.activeWorkspaceId], {
    skipInitialMount: true,
    skipDuringRestore: true,
    description: 'migration status check'
  })
  
  return {
    migrationNeeded,
    migrationInProgress: store.stepConfigMigrationStatus.inProgress,
    migrationProgress: 100, // Simplified for now
    canRollback: false, // Would need to implement rollback tracking
    migrationError: store.lastError && store.lastError.code?.includes('MIGRATION') ? store.lastError : null
  }
}