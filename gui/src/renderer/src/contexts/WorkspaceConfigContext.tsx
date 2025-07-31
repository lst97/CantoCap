/**
 * WorkspaceConfigContext - Global workspace configuration management
 * Provides type-safe step configuration access with auto-save functionality
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useSubtitlePersistence } from '../hooks/useSubtitlePersistence'
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
  const store = useWorkspaceStore()
  const [isReady, setIsReady] = useState(false)

  // Initialize workspace system
  useEffect(() => {
    const initializeWorkspaces = async () => {
      if (!store.isInitialized) {
        try {
          await store.initializeWorkspaces()
          setIsReady(true)
        } catch (error) {
          console.error('Failed to initialize workspace system:', error)
          setIsReady(false)
        }
      } else {
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

  // Derive workspace requirement state
  const hasWorkspaces = store.availableWorkspaces.length > 0
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
      return
    }

    let isMounted = true
    setIsLoading(true)
    setError(null)

    getStepConfig<T, K>(stepId)
      .then((loadedConfig) => {
        if (isMounted) {
          setConfig(loadedConfig)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err)
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
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
      isLoading,
      error,
      resetConfig,
      isReady: isWorkspaceReady
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
  const { currentWorkspaceId } = useWorkspaceConfig()
  
  // Use subtitle persistence hook
  const persistenceResult = useSubtitlePersistence(
    currentWorkspaceId || undefined,
    {
      autoFileOperations: config?.editingPreferences?.autoSave !== false,
      fileAutoSaveInterval: config?.editingPreferences?.autoSaveConfig?.interval || 30000,
      validateOnLoad: config?.qualityValidation?.validateFileIntegrity !== false,
      enableFileCache: config?.cacheConfig?.enabled !== false,
      autoValidate: config?.qualityValidation?.autoValidateOnSave !== false,
      enablePerformanceMonitoring: config?.performance?.trackOperations !== false
    }
  )
  
  // Enhanced hook result that includes subtitle persistence
  const enhancedResult = {
    // Original hook result
    ...hookResult,
    config,
    updateConfig,
    
    // Subtitle persistence integration
    subtitleFiles: persistenceResult.subtitleFiles,
    subtitleFileStatus: persistenceResult.fileStatus,
    currentSession: persistenceResult.currentSession,
    fileValidation: persistenceResult.validationResults,
    
    // Enhanced subtitle-specific actions
    loadSubtitleFile: persistenceResult.loadFile,
    saveSubtitleFile: persistenceResult.saveFile,
    createSubtitleFile: persistenceResult.createFile,
    deleteSubtitleFile: persistenceResult.deleteFile,
    validateSubtitleFile: persistenceResult.validateFile,
    createBackup: persistenceResult.createBackup,
    restoreBackup: persistenceResult.restoreBackup,
    updateSession: persistenceResult.updateSession,
    clearSubtitleCache: persistenceResult.clearCache,
    getPerformanceMetrics: persistenceResult.getPerformanceMetrics,
    
    // File operation states
    isLoadingFiles: persistenceResult.isLoadingFiles,
    isSavingFiles: persistenceResult.isSavingFiles,
    hasUnsavedFileChanges: persistenceResult.hasUnsavedChanges,
    fileError: persistenceResult.error,
    clearFileError: persistenceResult.clearError,
    
    // Additional persistence data
    persistenceData: persistenceResult
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