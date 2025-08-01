/**
 * Enhanced WorkspaceConfigContext with Centralized Configuration Manager
 *
 * Provides a unified API for both app configuration and step configuration
 * with automatic workspace targeting and intelligent routing.
 *
 * Key Enhancements:
 * - Unified setConfig() method for all configuration updates
 * - Automatic workspace context detection
 * - Intelligent routing between app store and workspace store
 * - Graceful workspace transition handling
 * - Enhanced error handling and validation
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useSubtitlePersistence } from '../hooks/useSubtitlePersistence';
import {
  configurationManager,
  useConfigurationManagerEvents,
  type ConfigUpdateOptions,
  type ConfigOperationResult,
} from '../services/configuration-manager';
import type {
  WorkflowStepId,
  StepConfigMap,
  AutoSaveStatus,
  WorkspaceError,
  CacheMetrics,
} from '../types/workspace';
import type { AppConfig } from '../../../types';

// Enhanced context interface with unified configuration management
interface EnhancedWorkspaceConfigContextValue {
  // Current workspace
  currentWorkspaceId: string | null;
  isWorkspaceReady: boolean;

  // Unified configuration methods
  setConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
    options?: ConfigUpdateOptions
  ) => Promise<ConfigOperationResult>;

  getConfig: <K extends keyof AppConfig>(key: K) => Promise<AppConfig[K]>;

  // Step configuration methods (backward compatibility)
  getStepConfig: <T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K
  ) => Promise<T | null>;

  setStepConfig: <T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K,
    config: Partial<T>,
    options?: {
      merge?: boolean;
      skipValidation?: boolean;
    }
  ) => Promise<void>;

  resetStepConfig: <K extends WorkflowStepId>(stepId: K) => Promise<void>;

  // Auto-save status
  autoSaveStatus: AutoSaveStatus;
  isAutoSaving: boolean;

  // Cache metrics
  cacheMetrics: CacheMetrics;

  // Error handling
  lastError: WorkspaceError | null;
  clearError: () => void;

  // Workspace requirement checking
  hasWorkspaces: boolean;
  isEmpty: boolean;

  // Workspace context information
  workspaceContext: {
    isTransitioning: boolean;
    isReady: boolean;
    hasActiveWorkspace: boolean;
  };

  // Enhanced configuration operations
  batchUpdateConfigs: (
    updates: Array<{
      key: keyof AppConfig;
      value: any;
      options?: ConfigUpdateOptions;
    }>
  ) => Promise<ConfigOperationResult[]>;

  // Validation
  validateConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ) => {
    isValid: boolean;
    errors: string[];
  };
}

// Create enhanced context
const EnhancedWorkspaceConfigContext = createContext<EnhancedWorkspaceConfigContextValue | null>(
  null
);

// Enhanced provider component
interface EnhancedWorkspaceConfigProviderProps {
  children: React.ReactNode;
}

export const EnhancedWorkspaceConfigProvider: React.FC<EnhancedWorkspaceConfigProviderProps> = ({
  children,
}) => {
  const store = useWorkspaceStore();
  const [isReady, setIsReady] = useState(false);
  const [lastOperationResult, setLastOperationResult] = useState<ConfigOperationResult | null>(
    null
  );

  // Initialize configuration manager events
  useConfigurationManagerEvents();

  // Initialize workspace system
  useEffect(() => {
    const initializeWorkspaces = async () => {
      if (!store.isInitialized) {
        try {
          await store.initializeWorkspaces();
          setIsReady(true);
        } catch (error) {
          console.error('Failed to initialize workspace system:', error);
          setIsReady(false);
        }
      } else {
        setIsReady(true);
      }
    };

    initializeWorkspaces();
  }, [store.isInitialized]);

  // Unified configuration setter with automatic routing
  const setConfig = useCallback(
    async <K extends keyof AppConfig>(
      key: K,
      value: AppConfig[K],
      options: ConfigUpdateOptions = {}
    ): Promise<ConfigOperationResult> => {
      try {
        const result = await configurationManager.setConfig(key, value, options);
        setLastOperationResult(result);

        if (!result.success && result.error) {
          console.error('Configuration update failed:', result.error);
        }

        return result;
      } catch (error) {
        const errorResult: ConfigOperationResult = {
          success: false,
          targetStore: 'app',
          error: error as Error,
        };
        setLastOperationResult(errorResult);
        return errorResult;
      }
    },
    []
  );

  // Unified configuration getter
  const getConfig = useCallback(
    async <K extends keyof AppConfig>(key: K): Promise<AppConfig[K]> => {
      return await configurationManager.getConfig(key);
    },
    []
  );

  // Step configuration methods (maintaining backward compatibility)
  const getStepConfig = useCallback(
    async <T extends StepConfigMap[K], K extends WorkflowStepId>(stepId: K): Promise<T | null> => {
      return await configurationManager.getStepConfig<T, K>(stepId);
    },
    []
  );

  const setStepConfig = useCallback(
    async <T extends StepConfigMap[K], K extends WorkflowStepId>(
      stepId: K,
      config: Partial<T>,
      options: {
        merge?: boolean;
        skipValidation?: boolean;
      } = {}
    ): Promise<void> => {
      const result = await configurationManager.setStepConfig<T, K>(stepId, config, {
        merge: options.merge ?? true,
        skipValidation: options.skipValidation ?? false,
      });

      if (!result.success && result.error) {
        throw result.error;
      }
    },
    []
  );

  const resetStepConfig = useCallback(
    async <K extends WorkflowStepId>(stepId: K): Promise<void> => {
      if (!store.currentWorkspace) {
        throw new Error('No active workspace');
      }

      return await store.resetStepConfig<K>(store.currentWorkspace.id, stepId);
    },
    [store.currentWorkspace, store.resetStepConfig]
  );

  // Batch configuration updates
  const batchUpdateConfigs = useCallback(
    async (
      updates: Array<{
        key: keyof AppConfig;
        value: any;
        options?: ConfigUpdateOptions;
      }>
    ): Promise<ConfigOperationResult[]> => {
      const results: ConfigOperationResult[] = [];

      for (const update of updates) {
        try {
          const result = await setConfig(update.key, update.value, update.options);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            targetStore: 'app',
            error: error as Error,
          });
        }
      }

      return results;
    },
    [setConfig]
  );

  // Configuration validation
  const validateConfig = useCallback(
    <K extends keyof AppConfig>(
      key: K,
      value: AppConfig[K]
    ): { isValid: boolean; errors: string[] } => {
      // Use configuration manager's validation logic
      return (configurationManager as any).validateConfig(key, value);
    },
    []
  );

  const clearError = useCallback(() => {
    store.clearError();
    setLastOperationResult(null);
  }, [store.clearError]);

  // Derive workspace context information
  const workspaceContext = configurationManager.getWorkspaceContext();
  const hasWorkspaces = store.availableWorkspaces.length > 0;
  const isEmpty = !hasWorkspaces;

  const contextValue: EnhancedWorkspaceConfigContextValue = {
    // Current workspace
    currentWorkspaceId: store.currentWorkspace?.id || null,
    isWorkspaceReady: isReady && !!store.currentWorkspace,

    // Unified configuration methods
    setConfig,
    getConfig,

    // Step configuration methods (backward compatibility)
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
    isEmpty,

    // Workspace context information
    workspaceContext: {
      isTransitioning: workspaceContext.isTransitioning,
      isReady: workspaceContext.isReady,
      hasActiveWorkspace: !!workspaceContext.currentWorkspaceId,
    },

    // Enhanced configuration operations
    batchUpdateConfigs,
    validateConfig,
  };

  return (
    <EnhancedWorkspaceConfigContext.Provider value={contextValue}>
      {children}
    </EnhancedWorkspaceConfigContext.Provider>
  );
};

// Hook to use enhanced workspace configuration context
export const useEnhancedWorkspaceConfig = (): EnhancedWorkspaceConfigContextValue => {
  const context = useContext(EnhancedWorkspaceConfigContext);
  if (!context) {
    throw new Error(
      'useEnhancedWorkspaceConfig must be used within an EnhancedWorkspaceConfigProvider'
    );
  }
  return context;
};

// Simplified hook for unified configuration access
export const useUnifiedConfig = () => {
  const {
    setConfig,
    getConfig,
    isWorkspaceReady,
    workspaceContext,
    validateConfig,
    lastError,
    clearError,
  } = useEnhancedWorkspaceConfig();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Simplified set method with loading state and error handling
  const setValue = useCallback(
    async <K extends keyof AppConfig>(
      key: K,
      value: AppConfig[K],
      options?: ConfigUpdateOptions
    ) => {
      if (!isWorkspaceReady) {
        throw new Error('Workspace not ready');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await setConfig(key, value, options);

        if (!result.success && result.error) {
          setError(result.error);
          throw result.error;
        }

        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [setConfig, isWorkspaceReady]
  );

  // Simplified get method with error handling
  const getValue = useCallback(
    async <K extends keyof AppConfig>(key: K) => {
      if (!isWorkspaceReady) {
        throw new Error('Workspace not ready');
      }

      try {
        return await getConfig(key);
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      }
    },
    [getConfig, isWorkspaceReady]
  );

  return {
    setValue,
    getValue,
    validateConfig,
    isLoading,
    isReady: isWorkspaceReady,
    error: error || lastError,
    clearError: () => {
      setError(null);
      clearError();
    },
    workspaceContext,
  };
};

// Enhanced step configuration hook with centralized manager
export const useEnhancedStepConfig = <T extends StepConfigMap[K], K extends WorkflowStepId>(
  stepId: K
) => {
  const { getStepConfig, setStepConfig, resetStepConfig, isWorkspaceReady } =
    useEnhancedWorkspaceConfig();
  const [config, setConfig] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load configuration on mount and when workspace changes
  useEffect(() => {
    if (!isWorkspaceReady) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getStepConfig<T, K>(stepId)
      .then((loadedConfig) => {
        if (isMounted) {
          setConfig(loadedConfig);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [stepId, getStepConfig, isWorkspaceReady]);

  // Update configuration with optimistic updates
  const updateConfig = useCallback(
    async (updates: Partial<T>, options?: { merge?: boolean; skipValidation?: boolean }) => {
      if (!isWorkspaceReady) {
        throw new Error('Workspace not ready');
      }

      // Optimistic update
      const previousConfig = config;
      const optimisticConfig =
        options?.merge !== false && config ? ({ ...config, ...updates } as T) : (updates as T);

      setConfig(optimisticConfig);

      try {
        await setStepConfig<T, K>(stepId, updates, options);
      } catch (error) {
        // Rollback on error
        setConfig(previousConfig);
        throw error;
      }
    },
    [stepId, setStepConfig, config, isWorkspaceReady]
  );

  // Reset configuration
  const resetConfig = useCallback(async () => {
    if (!isWorkspaceReady) {
      throw new Error('Workspace not ready');
    }

    try {
      await resetStepConfig<K>(stepId);
      // Reload the configuration after reset
      const resetConfig = await getStepConfig<T, K>(stepId);
      setConfig(resetConfig);
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [stepId, resetStepConfig, getStepConfig, isWorkspaceReady]);

  return [
    config,
    updateConfig,
    {
      isLoading,
      error,
      resetConfig,
      isReady: isWorkspaceReady,
    },
  ] as const;
};

// Backward compatibility exports
export {
  // Re-export original context for gradual migration
  useWorkspaceConfig,
  useStepConfig,
  useWorkspaceRequirement,
  useInputFileConfig,
  useConfigStepConfig,
  useProcessingStepConfig,
  useReviewStepConfig,
  useExportStepConfig,
  useWorkspaceStepIntegration,
} from './WorkspaceConfigContext';
