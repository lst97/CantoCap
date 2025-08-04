/**
 * WorkspaceConfigContext - Global workspace configuration management
 * Provides type-safe step configuration access with auto-save functionality
 */

import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useSubtitlePersistence } from '../hooks/useSubtitlePersistence'
import { debugInitialization, debugWorkspaceRestoration } from '../utils/workflow-debug'
import type { 
  WorkflowStepId, 
  StepConfigMap,
  AutoSaveStatus,
  WorkspaceError,
  CacheMetrics 
} from '../types/workspace'

// Context interface for workspace configuration management
interface WorkspaceConfigContextValue {
  // Current workspace
  currentWorkspaceId: string | null
  isWorkspaceReady: boolean
  
  // Step configuration methods
  getStepConfig: <T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K
  ) => Promise<T | null>
  
  setStepConfig: <T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K,
    config: Partial<T>,
    options?: {
      merge?: boolean
      skipValidation?: boolean
    }
  ) => Promise<void>
  
  resetStepConfig: <K extends WorkflowStepId>(stepId: K) => Promise<void>
  
  // Auto-save status
  autoSaveStatus: AutoSaveStatus
  isAutoSaving: boolean
  
  // Cache metrics
  cacheMetrics: CacheMetrics
  
  // Error handling
  lastError: WorkspaceError | null
  clearError: () => void
  
  // Workspace requirement checking
  hasWorkspaces: boolean
  isEmpty: boolean
}

// Create context
const WorkspaceConfigContext = createContext<WorkspaceConfigContextValue | null>(null)

// Provider component
interface WorkspaceConfigProviderProps {
  children: React.ReactNode
}

export const WorkspaceConfigProvider: React.FC<WorkspaceConfigProviderProps> = ({ children }) => {
  debugInitialization('WorkspaceConfigProvider', 'start')
  const store = useWorkspaceStore()
  const [isReady, setIsReady] = useState(false)

  // Initialize workspace system
  useEffect(() => {
    console.log('🔧 [DEBUG] WorkspaceConfigProvider initialization effect triggered', {
      storeIsInitialized: store.isInitialized,
      isReady,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    })

    const initializeWorkspaces = async () => {
      console.log('🔧 [DEBUG] initializeWorkspaces() called', {
        storeIsInitialized: store.isInitialized,
        timestamp: new Date().toISOString()
      })

      if (!store.isInitialized) {
        try {
          console.log('🔧 [DEBUG] Calling store.initializeWorkspaces()')
          debugWorkspaceRestoration('before')
          
          await store.initializeWorkspaces()
          
          debugWorkspaceRestoration('after', {
            isInitialized: store.isInitialized,
            currentWorkspace: store.currentWorkspace?.id,
            availableWorkspaces: store.availableWorkspaces?.length
          })
          
          console.log('🔧 [DEBUG] ✅ Workspace system initialized successfully', {
            isInitialized: store.isInitialized,
            currentWorkspace: store.currentWorkspace?.id,
            availableWorkspaces: store.availableWorkspaces?.length,
            timestamp: new Date().toISOString()
          })
          
          setIsReady(true)
        } catch (error) {
          console.error('❌ [DEBUG] Failed to initialize workspace system:', error, {
            timestamp: new Date().toISOString(),
            stackTrace: error instanceof Error ? error.stack : 'No stack trace'
          })
          setIsReady(false)
        }
      } else {
        console.log('🔧 [DEBUG] Workspace system already initialized', {
          currentWorkspace: store.currentWorkspace?.id,
          availableWorkspaces: store.availableWorkspaces?.length,
          timestamp: new Date().toISOString()
        })
        setIsReady(true)
      }
    }

    initializeWorkspaces()
  }, [store.isInitialized])

  // Step configuration methods with current workspace context
  const getStepConfig = useCallback(async <T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K
  ): Promise<T | null> => {
    if (!store.currentWorkspace) {
      throw new Error('No active workspace')
    }
    
    return await store.getStepConfig<T, K>(store.currentWorkspace.id, stepId)
  }, [store.currentWorkspace, store.getStepConfig])

  const setStepConfig = useCallback(async <T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K,
    config: Partial<T>,
    options: {
      merge?: boolean
      skipValidation?: boolean
    } = {}
  ): Promise<void> => {
    if (!store.currentWorkspace) {
      throw new Error('No active workspace')
    }
    
    return await store.setStepConfig<T, K>(
      store.currentWorkspace.id, 
      stepId, 
      config, 
      {
        merge: options.merge ?? true,
        skipValidation: options.skipValidation ?? false,
        skipCache: false,
        createBackup: false
      }
    )
  }, [store.currentWorkspace, store.setStepConfig])

  const resetStepConfig = useCallback(async <K extends WorkflowStepId>(
    stepId: K
  ): Promise<void> => {
    if (!store.currentWorkspace) {
      throw new Error('No active workspace')
    }
    
    return await store.resetStepConfig<K>(store.currentWorkspace.id, stepId)
  }, [store.currentWorkspace, store.resetStepConfig])

  const clearError = useCallback(() => {
    store.clearError()
  }, [store.clearError])

  // Derive workspace requirement state - safely handle undefined during initialization
  const hasWorkspaces = store.availableWorkspaces?.length > 0 || false
  const isEmpty = !hasWorkspaces

  const contextValue: WorkspaceConfigContextValue = {
    // Current workspace
    currentWorkspaceId: store.currentWorkspace?.id || null,
    isWorkspaceReady: isReady && !!store.currentWorkspace,
    
    // Step configuration methods
    getStepConfig,
    setStepConfig,
    resetStepConfig,
    
    // Auto-save status
    autoSaveStatus: store.autoSaveStatus,
    isAutoSaving: store.autoSaveStatus.pendingSaves > 0,
    
    // Cache metrics
    cacheMetrics: store.cacheMetrics,
    
    // Error handling
    lastError: store.lastError,
    clearError,
    
    // Workspace requirement checking
    hasWorkspaces,
    isEmpty
  }

  return (
    <WorkspaceConfigContext.Provider value={contextValue}>
      {children}
    </WorkspaceConfigContext.Provider>
  )
}

// Hook to use workspace configuration context
export const useWorkspaceConfig = (): WorkspaceConfigContextValue => {
  const context = useContext(WorkspaceConfigContext)
  if (!context) {
    throw new Error('useWorkspaceConfig must be used within a WorkspaceConfigProvider')
  }
  return context
}

// Specialized hooks for step configuration access
export const useStepConfig = <T extends StepConfigMap[K], K extends WorkflowStepId>(
  stepId: K
) => {
  const { getStepConfig, setStepConfig, resetStepConfig, isWorkspaceReady } = useWorkspaceConfig()
  const [config, setConfig] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load configuration on mount and when workspace changes
  useEffect(() => {
    if (!isWorkspaceReady) {
      setIsLoading(false)
      setConfig(null)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setError(null)

    // Add timeout to prevent hanging during JSON loading
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn(`Step config loading timeout for ${stepId}`)
        setIsLoading(false)
        setError(new Error(`Loading timeout for step ${stepId}`))
      }
    }, 10000) // 10 second timeout

    getStepConfig<T, K>(stepId)
      .then((loadedConfig) => {
        if (isMounted) {
          clearTimeout(timeoutId)
          setConfig(loadedConfig)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          clearTimeout(timeoutId)
          setError(err)
          setIsLoading(false)
          setConfig(null)
        }
      })

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [stepId, getStepConfig, isWorkspaceReady])

  // Update configuration with optimistic updates
  const updateConfig = useCallback(async (
    updates: Partial<T>,
    options?: { merge?: boolean; skipValidation?: boolean }
  ) => {
    if (!isWorkspaceReady) {
      throw new Error('Workspace not ready')
    }

    // Optimistic update
    const previousConfig = config
    const optimisticConfig = options?.merge !== false && config
      ? { ...config, ...updates } as T
      : updates as T
    
    setConfig(optimisticConfig)

    try {
      await setStepConfig<T, K>(stepId, updates, options)
    } catch (error) {
      // Rollback on error
      setConfig(previousConfig)
      throw error
    }
  }, [stepId, setStepConfig, config, isWorkspaceReady])

  // Reset configuration
  const resetConfig = useCallback(async () => {
    if (!isWorkspaceReady) {
      throw new Error('Workspace not ready')
    }

    try {
      await resetStepConfig<K>(stepId)
      // Reload the configuration after reset
      const resetConfig = await getStepConfig<T, K>(stepId)
      setConfig(resetConfig)
    } catch (error) {
      setError(error as Error)
      throw error
    }
  }, [stepId, resetStepConfig, getStepConfig, isWorkspaceReady])

  return [
    config,
    updateConfig,
    {
      isLoading: Boolean(isLoading),
      error: error || null,
      resetConfig,
      isReady: Boolean(isWorkspaceReady && !error)
    }
  ] as const
}

// Hook for workspace requirement detection
export const useWorkspaceRequirement = () => {
  const { hasWorkspaces, isEmpty, isWorkspaceReady } = useWorkspaceConfig()
  
  return {
    hasWorkspaces,
    isEmpty,
    isReady: isWorkspaceReady,
    requiresWorkspace: isEmpty
  }
}

// Specialized hooks for each step configuration type
export const useInputFileConfig = () => {
  return useStepConfig('input-file')
}

export const useConfigStepConfig = () => {
  return useStepConfig('config')
}

export const useProcessingStepConfig = () => {
  return useStepConfig('processing')
}

export const useReviewStepConfig = () => {
  const [config, updateConfig, hookResult] = useStepConfig('review')
  const { currentWorkspaceId, isWorkspaceReady } = useWorkspaceConfig()
  
  // Remove useMemo to prevent dependency array issues during rapid config updates
  const persistenceOptions = {
    autoFileOperations: config?.editingPreferences?.autoSave !== false,
    fileAutoSaveInterval: config?.editingPreferences?.autoSaveConfig?.interval || 30000,
    validateOnLoad: config?.qualityValidation?.validateFileIntegrity !== false,
    enableFileCache: config?.cacheConfig?.enabled !== false,
    autoValidate: config?.qualityValidation?.autoValidateOnSave !== false,
    enablePerformanceMonitoring: config?.performance?.trackOperations !== false
  }
  
  // Always call useSubtitlePersistence with stable parameters to prevent hook rule violations
  // Only pass workspaceId when workspace is ready to prevent race conditions
  const persistenceResult = useSubtitlePersistence(
    isWorkspaceReady && currentWorkspaceId ? currentWorkspaceId : undefined,
    persistenceOptions
  )
  
  // Enhanced hook result that includes subtitle persistence
  // Add comprehensive validation to prevent undefined values during JSON loading
  const enhancedResult = {
    // Original hook result - ensure these are always defined
    // Include workspace readiness in loading state
    isLoading: Boolean(hookResult?.isLoading || persistenceResult?.isLoadingFiles || !isWorkspaceReady),
    isReady: Boolean(isWorkspaceReady && hookResult?.isReady !== false && !persistenceResult?.error),
    error: hookResult?.error || persistenceResult?.error || null,
    resetConfig: hookResult?.resetConfig,
    config,
    updateConfig,
    
    // Subtitle persistence integration - safely handle undefined/null values
    subtitleFiles: persistenceResult?.subtitleFiles || null,
    subtitleFileStatus: persistenceResult?.fileStatus || null,
    currentSession: persistenceResult?.currentSession || null,
    fileValidation: persistenceResult?.validationResults || {},
    
    // Enhanced subtitle-specific actions - with null checks
    loadSubtitleFile: persistenceResult?.loadFile || (() => Promise.resolve(null)),
    saveSubtitleFile: persistenceResult?.saveFile || (() => Promise.resolve()),
    createSubtitleFile: persistenceResult?.createFile || (() => Promise.resolve('')),
    deleteSubtitleFile: persistenceResult?.deleteFile || (() => Promise.resolve()),
    validateSubtitleFile: persistenceResult?.validateFile || (() => Promise.resolve({ isValid: false, errors: [] })),
    createBackup: persistenceResult?.createBackup || (() => Promise.resolve('')),
    restoreBackup: persistenceResult?.restoreBackup || (() => Promise.resolve()),
    updateSession: persistenceResult?.updateSession || (() => Promise.resolve()),
    clearSubtitleCache: persistenceResult?.clearCache || (() => Promise.resolve()),
    getPerformanceMetrics: persistenceResult?.getPerformanceMetrics || (() => Promise.resolve([])),
    
    // File operation states - ensure always boolean
    isLoadingFiles: Boolean(persistenceResult?.isLoadingFiles),
    isSavingFiles: Boolean(persistenceResult?.isSavingFiles),
    hasUnsavedFileChanges: Boolean(persistenceResult?.hasUnsavedChanges),
    fileError: persistenceResult?.error || null,
    clearFileError: persistenceResult?.clearError || (() => {}),
    
    // Additional persistence data - safely wrapped
    persistenceData: persistenceResult || null
  }
  
  return enhancedResult
}

export const useExportStepConfig = () => {
  return useStepConfig('export')
}

// Hook for comprehensive workspace integration
export const useWorkspaceStepIntegration = () => {
  const workspaceConfig = useWorkspaceConfig()
  const store = useWorkspaceStore()
  
  // Batch configuration updates
  const batchUpdateConfigs = useCallback(async (
    updates: Array<{
      stepId: WorkflowStepId
      config: any
      merge?: boolean
    }>
  ) => {
    if (!workspaceConfig.currentWorkspaceId) {
      throw new Error('No active workspace')
    }

    const batchUpdates = updates.map(({ stepId, config, merge = true }) => ({
      stepId,
      config,
      merge
    }))

    return await store.batchUpdateStepConfigs(workspaceConfig.currentWorkspaceId, batchUpdates)
  }, [workspaceConfig.currentWorkspaceId, store.batchUpdateStepConfigs])

  // Get multiple step configurations
  const getMultipleConfigs = useCallback(async (stepIds: WorkflowStepId[]) => {
    if (!workspaceConfig.currentWorkspaceId) {
      throw new Error('No active workspace')
    }

    return await store.getMultipleStepConfigs(workspaceConfig.currentWorkspaceId, stepIds)
  }, [workspaceConfig.currentWorkspaceId, store.getMultipleStepConfigs])

  return {
    ...workspaceConfig,
    batchUpdateConfigs,
    getMultipleConfigs,
    // Enhanced workspace store methods
    clearCache: (stepId?: WorkflowStepId) => 
      store.clearStepConfigCache(workspaceConfig.currentWorkspaceId || undefined, stepId),
    refreshCache: (stepIds?: WorkflowStepId[]) => 
      workspaceConfig.currentWorkspaceId 
        ? store.refreshStepConfigCache(workspaceConfig.currentWorkspaceId, stepIds)
        : Promise.resolve()
  }
}