/**
 * useStepConfig Hook - Type-Safe Step Configuration Management
 * Provides React integration for the enhanced workspace store with full type safety
 * Includes caching, validation, and real-time synchronization
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'
import { validateStepConfig } from '../utils/stepConfigValidation'
import { isValidStepConfig, sanitizeStepConfig } from '../utils/typeGuards'
import type {
  WorkflowStepId,
  StepConfigMap,
  StepConfigValidationResult,
  WorkspaceError,
  StepConfigError
} from '../types/workspace'

// ============================================================================
// HOOK OPTIONS AND CONFIGURATION
// ============================================================================

export interface UseStepConfigOptions {
  /** Enable automatic validation on changes */
  autoValidate?: boolean
  /** Debounce time for auto-save in milliseconds */
  debounceMs?: number
  /** Enable real-time synchronization */
  syncEnabled?: boolean
  /** Merge strategy for updates */
  mergeStrategy?: 'merge' | 'replace'
  /** Enable optimistic updates */
  optimisticUpdates?: boolean
  /** Custom error handler */
  onError?: (error: WorkspaceError | StepConfigError) => void
  /** Custom validation success handler */
  onValidationSuccess?: () => void
  /** Custom validation error handler */
  onValidationError?: (result: StepConfigValidationResult<any>) => void
}

interface UseStepConfigState<T> {
  /** Current configuration data */
  config: T | null
  /** Loading state */
  isLoading: boolean
  /** Saving state */
  isSaving: boolean
  /** Validation state */
  isValidating: boolean
  /** Current validation result */
  validationResult: StepConfigValidationResult<any> | null
  /** Last error that occurred */
  error: WorkspaceError | StepConfigError | null
  /** Whether the configuration has unsaved changes */
  isDirty: boolean
  /** Cache hit indicator */
  fromCache: boolean
  /** Last update timestamp */
  lastUpdated: number | null
}

interface UseStepConfigActions<T> {
  /** Update configuration (partial or complete) */
  updateConfig: (updates: Partial<T>) => Promise<void>
  /** Replace entire configuration */
  replaceConfig: (newConfig: T) => Promise<void>
  /** Reset to default configuration */
  resetToDefault: () => Promise<void>
  /** Force refresh from database */
  refresh: () => Promise<void>
  /** Validate current configuration */
  validate: () => Promise<StepConfigValidationResult<any>>
  /** Save changes immediately */
  save: () => Promise<void>
  /** Clear error state */
  clearError: () => void
  /** Revert unsaved changes */
  revert: () => Promise<void>
}

export type UseStepConfigReturn<T> = UseStepConfigState<T> & UseStepConfigActions<T>

// ============================================================================
// MAIN HOOK IMPLEMENTATION
// ============================================================================

/**
 * Type-safe hook for managing step configurations
 * Provides caching, validation, and real-time synchronization
 */
export function useStepConfig<K extends WorkflowStepId>(
  stepId: K,
  workspaceId: string,
  options: UseStepConfigOptions = {}
): UseStepConfigReturn<StepConfigMap[K]> {
  type StepConfigType = StepConfigMap[K]
  
  // Default options
  const {
    autoValidate = true,
    debounceMs = 500,
    syncEnabled = true,
    mergeStrategy = 'merge',
    optimisticUpdates = true,
    onError,
    onValidationSuccess,
    onValidationError
  } = options
  
  // Store and workspace management
  const store = useWorkspaceStore()
  
  // Component state
  const [state, setState] = useState<UseStepConfigState<StepConfigType>>({
    config: null,
    isLoading: true,
    isSaving: false,
    isValidating: false,
    validationResult: null,
    error: null,
    isDirty: false,
    fromCache: false,
    lastUpdated: null
  })
  
  // Refs for managing async operations
  const debounceRef = useRef<NodeJS.Timeout>()
  const validationRef = useRef<NodeJS.Timeout>()
  const originalConfigRef = useRef<StepConfigType | null>(null)
  const mountedRef = useRef(true)
  
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (validationRef.current) clearTimeout(validationRef.current)
    }
  }, [])
  
  // Error handler
  const handleError = useCallback((error: WorkspaceError | StepConfigError) => {
    if (!mountedRef.current) return
    
    setState(prev => ({ ...prev, error }))
    onError?.(error)
    console.error(`Step config error for ${stepId}:`, error)
  }, [stepId, onError])
  
  // Load configuration from store
  const loadConfig = useCallback(async (fromRefresh = false): Promise<void> => {
    if (!workspaceId || !stepId) return
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const config = await store.getStepConfig<StepConfigType, K>(workspaceId, stepId)
      
      if (!mountedRef.current) return
      
      // Validate loaded configuration
      let validationResult: StepConfigValidationResult<K> | null = null
      if (config && autoValidate) {
        validationResult = validateStepConfig(stepId, config)
        if (!validationResult.isValid) {
          console.warn(`Loaded invalid configuration for ${stepId}:`, validationResult.errors)
        }
      }
      
      // Check if config came from cache
      const cacheMetrics = store.getCacheMetrics()
      const fromCache = !fromRefresh && cacheMetrics.hitRate > 0
      
      setState(prev => ({
        ...prev,
        config,
        isLoading: false,
        validationResult,
        fromCache,
        lastUpdated: Date.now(),
        isDirty: false
      }))
      
      // Store original for revert functionality
      originalConfigRef.current = config ? { ...config } : null
      
      if (validationResult?.isValid) {
        onValidationSuccess?.()
      } else if (validationResult && !validationResult.isValid) {
        onValidationError?.(validationResult)
      }
      
    } catch (error) {
      if (!mountedRef.current) return
      
      handleError(error as WorkspaceError)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [workspaceId, stepId, store, autoValidate, handleError, onValidationSuccess, onValidationError])
  
  // Initial load
  useEffect(() => {
    loadConfig()
  }, [loadConfig])
  
  // Validation function
  const performValidation = useCallback(async (
    configToValidate: StepConfigType
  ): Promise<StepConfigValidationResult<K>> => {
    setState(prev => ({ ...prev, isValidating: true }))
    
    try {
      // Use store validation if available, otherwise use utility validation
      const result = await store.validateStepConfig(workspaceId, stepId, configToValidate)
      
      // Convert to our expected format
      const validationResult: StepConfigValidationResult<K> = {
        stepId,
        isValid: result.isValid,
        errors: result.errors.map(error => ({
          field: 'unknown',
          message: error,
          value: null,
          severity: 'error' as const
        })),
        warnings: result.warnings.map(warning => ({
          field: 'unknown',
          message: warning,
          value: null
        })),
        suggestions: []
      }
      
      if (!mountedRef.current) return validationResult
      
      setState(prev => ({ 
        ...prev, 
        isValidating: false,
        validationResult 
      }))
      
      if (validationResult.isValid) {
        onValidationSuccess?.()
      } else {
        onValidationError?.(validationResult)
      }
      
      return validationResult
      
    } catch (error) {
      if (!mountedRef.current) return {
        stepId,
        isValid: false,
        errors: [{ field: 'validation', message: 'Validation failed', value: null, severity: 'error' }],
        warnings: [],
        suggestions: []
      }
      
      setState(prev => ({ ...prev, isValidating: false }))
      handleError(error as WorkspaceError)
      throw error
    }
  }, [workspaceId, stepId, store, handleError, onValidationSuccess, onValidationError])
  
  // Debounced save function
  const debouncedSave = useCallback(async (configToSave: StepConfigType): Promise<void> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      
      try {
        setState(prev => ({ ...prev, isSaving: true }))
        
        await store.setStepConfig(workspaceId, stepId, configToSave, {
          merge: mergeStrategy === 'merge',
          skipValidation: !autoValidate
        })
        
        if (!mountedRef.current) return
        
        setState(prev => ({ 
          ...prev, 
          isSaving: false, 
          isDirty: false,
          lastUpdated: Date.now()
        }))
        
      } catch (error) {
        if (!mountedRef.current) return
        
        setState(prev => ({ ...prev, isSaving: false }))
        handleError(error as WorkspaceError)
      }
    }, debounceMs)
  }, [workspaceId, stepId, store, mergeStrategy, autoValidate, debounceMs, handleError])
  
  // Update configuration
  const updateConfig = useCallback(async (updates: Partial<StepConfigType>): Promise<void> => {
    if (!state.config) return
    
    const newConfig = mergeStrategy === 'merge' 
      ? { ...state.config, ...updates } as StepConfigType
      : updates as StepConfigType
    
    // Sanitize the configuration
    const sanitizedConfig = sanitizeStepConfig(stepId, newConfig)
    if (!sanitizedConfig) {
      const error = new Error('Invalid configuration data') as StepConfigError
      error.code = 'STEP_CONFIG_INVALID'
      error.stepId = stepId
      error.workspaceId = workspaceId
      handleError(error)
      return
    }
    
    // Optimistic update
    if (optimisticUpdates) {
      setState(prev => ({ 
        ...prev, 
        config: sanitizedConfig as StepConfigType,
        isDirty: true,
        error: null
      }))
    }
    
    // Validate if enabled
    if (autoValidate) {
      if (validationRef.current) clearTimeout(validationRef.current)
      validationRef.current = setTimeout(() => {
        performValidation(sanitizedConfig as StepConfigType)
      }, 100) // Short delay for validation
    }
    
    // Auto-save if sync is enabled
    if (syncEnabled) {
      await debouncedSave(sanitizedConfig as StepConfigType)
    }
  }, [state.config, stepId, mergeStrategy, handleError, workspaceId, optimisticUpdates, autoValidate, performValidation, syncEnabled, debouncedSave])
  
  // Replace entire configuration
  const replaceConfig = useCallback(async (newConfig: StepConfigType): Promise<void> => {
    // Validate the new configuration
    if (!isValidStepConfig(stepId, newConfig)) {
      const error = new Error('Invalid configuration format') as StepConfigError
      error.code = 'STEP_CONFIG_INVALID'
      error.stepId = stepId
      error.workspaceId = workspaceId
      handleError(error)
      return
    }
    
    setState(prev => ({ 
      ...prev, 
      config: newConfig,
      isDirty: true,
      error: null
    }))
    
    if (autoValidate) {
      await performValidation(newConfig)
    }
    
    if (syncEnabled) {
      await debouncedSave(newConfig)
    }
  }, [stepId, workspaceId, handleError, autoValidate, performValidation, syncEnabled, debouncedSave])
  
  // Reset to default configuration
  const resetToDefault = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      
      await store.resetStepConfig(workspaceId, stepId)
      await loadConfig(true) // Force refresh from database
      
    } catch (error) {
      handleError(error as WorkspaceError)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [workspaceId, stepId, store, loadConfig, handleError])
  
  // Force refresh from database
  const refresh = useCallback(async (): Promise<void> => {
    await loadConfig(true)
  }, [loadConfig])
  
  // Validate current configuration
  const validate = useCallback(async (): Promise<StepConfigValidationResult<any>> => {
    if (!state.config) {
      const emptyResult: StepConfigValidationResult<K> = {
        stepId,
        isValid: false,
        errors: [{ field: 'config', message: 'No configuration to validate', value: null, severity: 'error' }],
        warnings: [],
        suggestions: []
      }
      setState(prev => ({ ...prev, validationResult: emptyResult }))
      return emptyResult
    }
    
    return await performValidation(state.config)
  }, [state.config, stepId, performValidation])
  
  // Save changes immediately
  const save = useCallback(async (): Promise<void> => {
    if (!state.config || !state.isDirty) return
    
    // Clear existing debounced save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    try {
      setState(prev => ({ ...prev, isSaving: true }))
      
      await store.setStepConfig(workspaceId, stepId, state.config, {
        merge: false, // Save complete config
        skipValidation: !autoValidate
      })
      
      setState(prev => ({ 
        ...prev, 
        isSaving: false, 
        isDirty: false,
        lastUpdated: Date.now()
      }))
      
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }))
      handleError(error as WorkspaceError)
    }
  }, [state.config, state.isDirty, workspaceId, stepId, store, autoValidate, handleError])
  
  // Clear error state
  const clearError = useCallback((): void => {
    setState(prev => ({ ...prev, error: null }))
  }, [])
  
  // Revert unsaved changes
  const revert = useCallback(async (): Promise<void> => {
    if (originalConfigRef.current) {
      setState(prev => ({ 
        ...prev, 
        config: originalConfigRef.current,
        isDirty: false,
        error: null
      }))
      
      if (autoValidate) {
        await performValidation(originalConfigRef.current)
      }
    } else {
      await loadConfig(true)
    }
  }, [autoValidate, performValidation, loadConfig])
  
  // Return combined state and actions
  return {
    // State
    config: state.config,
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    isValidating: state.isValidating,
    validationResult: state.validationResult,
    error: state.error,
    isDirty: state.isDirty,
    fromCache: state.fromCache,
    lastUpdated: state.lastUpdated,
    
    // Actions
    updateConfig,
    replaceConfig,
    resetToDefault,
    refresh,
    validate,
    save,
    clearError,
    revert
  }
}

// ============================================================================
// SPECIALIZED HOOKS FOR EACH STEP
// ============================================================================

/**
 * Hook for Input File step configuration
 */
export function useInputFileConfig(workspaceId: string, options?: UseStepConfigOptions) {
  return useStepConfig('input-file', workspaceId, options)
}

/**
 * Hook for Config step configuration
 */
export function useConfigStepConfig(workspaceId: string, options?: UseStepConfigOptions) {
  return useStepConfig('config', workspaceId, options)
}

/**
 * Hook for Processing step configuration
 */
export function useProcessingConfig(workspaceId: string, options?: UseStepConfigOptions) {
  return useStepConfig('processing', workspaceId, options)
}

/**
 * Hook for Review step configuration
 */
export function useReviewConfig(workspaceId: string, options?: UseStepConfigOptions) {
  return useStepConfig('review', workspaceId, options)
}

/**
 * Hook for Export step configuration
 */
export function useExportConfig(workspaceId: string, options?: UseStepConfigOptions) {
  return useStepConfig('export', workspaceId, options)
}

// ============================================================================
// BATCH OPERATIONS HOOK
// ============================================================================

interface UseBatchStepConfigOptions {
  /** Steps to include in batch operations */
  steps?: WorkflowStepId[]
  /** Enable automatic validation */
  autoValidate?: boolean
  /** Error handler */
  onError?: (error: WorkspaceError) => void
}

interface BatchStepConfigState {
  configs: Partial<StepConfigMap>
  isLoading: boolean
  isSaving: boolean
  errors: Record<WorkflowStepId, WorkspaceError | null>
}

/**
 * Hook for managing multiple step configurations in batch
 */
export function useBatchStepConfig(
  workspaceId: string,
  options: UseBatchStepConfigOptions = {}
) {
  const {
    steps = ['input-file', 'config', 'processing', 'review', 'export'],
    autoValidate = true,
    onError
  } = options
  
  const store = useWorkspaceStore()
  const [state, setState] = useState<BatchStepConfigState>({
    configs: {},
    isLoading: true,
    isSaving: false,
    errors: {} as Record<WorkflowStepId, WorkspaceError | null>
  })
  
  // Load all configurations
  const loadConfigs = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      
      const configs = await store.getMultipleStepConfigs(workspaceId, steps)
      
      setState(prev => ({
        ...prev,
        configs,
        isLoading: false,
        errors: {} as Record<WorkflowStepId, WorkspaceError | null>
      }))
      
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }))
      onError?.(error as WorkspaceError)
    }
  }, [workspaceId, steps, store, onError])
  
  // Initial load
  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])
  
  // Batch update configurations
  const batchUpdate = useCallback(async (
    updates: Partial<Record<WorkflowStepId, any>>
  ): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isSaving: true }))
      
      const updateArray = Object.entries(updates).map(([stepId, config]) => ({
        stepId: stepId as WorkflowStepId,
        config,
        merge: true
      }))
      
      await store.batchUpdateStepConfigs(workspaceId, updateArray)
      
      setState(prev => ({
        ...prev,
        configs: { ...prev.configs, ...updates },
        isSaving: false
      }))
      
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }))
      onError?.(error as WorkspaceError)
    }
  }, [workspaceId, store, onError])
  
  return {
    ...state,
    loadConfigs,
    batchUpdate,
    refresh: loadConfigs
  }
}