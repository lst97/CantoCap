/**
 * useSubtitlePersistence Hook
 *
 * React hook for managing subtitle file persistence operations.
 * Provides state management, auto-save functionality, and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSubtitleTempStorage, type UseSubtitleTempStorageResult } from './useSubtitleTempStorage';
import { useWorkspaceConfig } from '../contexts/WorkspaceConfigContext';
import { getSubtitlePersistenceService } from '../services/subtitle-persistence-service';
import type {
  SubtitleFileContent,
  SubtitleFileOperations,
  SubtitleFileStatus,
  SubtitleFileError,
  SubtitleValidationResult,
  SubtitleSessionData,
  SubtitlePerformanceMetrics,
} from '../types/subtitle-persistence';

import { isSubtitleFileError } from '../types/subtitle-persistence';

/**
 * Options for useSubtitlePersistence hook
 */
export interface UseSubtitlePersistenceOptions {
  /** Enable enhanced temp storage integration */
  enableTempStorage?: boolean;
  /** Enable automatic validation */
  autoValidate?: boolean;
  /** Debounce time for operations */
  debounceMs?: number;
  /** Enable sync operations */
  syncEnabled?: boolean;
  /** Merge strategy for conflicts */
  mergeStrategy?: 'merge' | 'overwrite' | 'manual';
  /** Enable optimistic updates */
  optimisticUpdates?: boolean;
  /** Enable automatic file operations */
  autoFileOperations?: boolean;
  /** Auto-save interval for files */
  fileAutoSaveInterval?: number;
  /** Validate files on load */
  validateOnLoad?: boolean;
  /** Enable file caching */
  enableFileCache?: boolean;
  /** Maximum file size for auto operations */
  maxAutoFileSize?: number;
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Error callback */
  onError?: (error: SubtitleFileError) => void;
  /** Validation success callback */
  onValidationSuccess?: () => void;
  /** Validation error callback */
  onValidationError?: (error: any) => void;
  /** File error callback */
  onFileError?: (error: SubtitleFileError) => void;
  /** File operation success callback */
  onFileOperationSuccess?: (operation: string, result: any) => void;
}

/**
 * Hook result interface
 */
export interface UseSubtitlePersistenceResult {
  // File Operations
  subtitleFiles: SubtitleFileOperations;
  
  // Enhanced Integration
  tempStorage?: UseSubtitleTempStorageResult;

  // Current State
  currentFiles: Record<string, SubtitleFileContent>;
  currentSession: SubtitleSessionData | null;
  fileStatus: SubtitleFileStatus | null;

  // Loading States
  isLoading: boolean;
  isLoadingFiles: boolean;
  isSaving: boolean;
  isSavingFiles: boolean;
  isValidating: boolean;

  // Auto-save State
  isAutoSaving: boolean;
  lastAutoSave: number | null;
  hasUnsavedChanges: boolean;
  pendingOperations: number;

  // Validation State
  validationResults: Record<string, SubtitleValidationResult>;

  // Error State
  error: SubtitleFileError | null;
  fileErrors: Record<string, SubtitleFileError>;

  // Performance State
  performanceMetrics: SubtitlePerformanceMetrics[];
  cacheMetrics: any;
  performanceAnalytics: {
    averageLatency: number;
    throughputTrend: number;
    errorRate: number;
    cacheEfficiency: number;
    memoryTrend: { current: number; trend: number; peak: number };
    performanceScore: number;
  };

  // Actions
  loadFile: (
    fileId: string,
    options?: { useCache?: boolean; validateOnLoad?: boolean }
  ) => Promise<SubtitleFileContent | null>;
  saveFile: (
    fileId: string,
    content: SubtitleFileContent,
    options?: { createBackup?: boolean; validate?: boolean }
  ) => Promise<void>;
  createFile: (
    content: SubtitleFileContent,
    options?: { compress?: boolean; fileType?: 'original' | 'modified' }
  ) => Promise<string>;
  deleteFile: (fileId: string, options?: { permanent?: boolean }) => Promise<void>;
  validateFile: (fileId: string) => Promise<SubtitleValidationResult>;
  createBackup: (fileId: string, description?: string) => Promise<string>;
  restoreBackup: (backupId: string) => Promise<void>;

  // Session Management
  updateSession: (sessionData: Partial<SubtitleSessionData>) => Promise<void>;
  saveSession: () => Promise<void>;
  loadSession: (sessionType?: SubtitleSessionData['sessionType']) => Promise<void>;

  // Cache Management
  clearCache: (fileId?: string) => Promise<void>;
  refreshFile: (fileId: string) => Promise<void>;

  // Auto-save Control
  enableAutoSave: (interval?: number) => void;
  disableAutoSave: () => void;
  saveAll: () => Promise<void>;

  // Error Handling
  clearError: () => void;
  clearFileError: (fileId: string) => void;
  retryOperation: (operationId: string) => Promise<void>;

  // Performance
  getPerformanceMetrics: () => Promise<SubtitlePerformanceMetrics[]>;
  clearPerformanceMetrics: () => void;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Omit<
  Required<UseSubtitlePersistenceOptions>,
  'onError' | 'onValidationSuccess' | 'onValidationError' | 'onFileError' | 'onFileOperationSuccess'
> = {
  enableTempStorage: true, // Enable temp storage by default
  autoValidate: true,
  debounceMs: 1000,
  syncEnabled: true,
  mergeStrategy: 'merge',
  optimisticUpdates: true,
  autoFileOperations: true,
  fileAutoSaveInterval: 30000, // 30 seconds
  validateOnLoad: true,
  enableFileCache: true,
  maxAutoFileSize: 10 * 1024 * 1024, // 10MB
  enablePerformanceMonitoring: true,
};

/**
 * useSubtitlePersistence hook
 */
export function useSubtitlePersistence(
  workspaceId?: string,
  options: UseSubtitlePersistenceOptions = {}
): UseSubtitlePersistenceResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { currentWorkspaceId, isWorkspaceReady } = useWorkspaceConfig();
  
  // Initialize temp storage if enabled
  const tempStorage = mergedOptions.enableTempStorage ? useSubtitleTempStorage({
    autoSaveEnabled: mergedOptions.autoFileOperations,
    autoSaveInterval: mergedOptions.fileAutoSaveInterval,
    compressionEnabled: true,
    validateBeforeSave: mergedOptions.autoValidate,
    enableSessionRecovery: true,
    onError: mergedOptions.onError ? (error) => {
      // Convert temp storage error to legacy format
      const legacyError: SubtitleFileError = {
        code: 'SUBTITLE_OPERATION_TIMEOUT', // Map closest legacy code
        message: error.message,
        timestamp: error.timestamp,
        context: error.context,
        recovery: error.recoverySuggestions ? {
          description: error.recoverySuggestions[0],
          action: () => Promise.resolve()
        } : undefined
      } as SubtitleFileError;
      mergedOptions.onError(legacyError);
    } : undefined
  }) : undefined;
  
  // Only use workspaceId when workspace is ready to prevent initialization races
  const activeWorkspaceId = (isWorkspaceReady && (workspaceId || currentWorkspaceId)) ? 
    (workspaceId || currentWorkspaceId) : undefined;

  // Service instance
  const serviceRef = useRef(getSubtitlePersistenceService());
  const service = serviceRef.current;

  // State
  const [currentFiles, setCurrentFiles] = useState<Record<string, SubtitleFileContent>>({});
  const [currentSession, setCurrentSession] = useState<SubtitleSessionData | null>(null);
  const [fileStatus] = useState<SubtitleFileStatus | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSaving] = useState(false);
  const [isSavingFiles, setIsSavingFiles] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Auto-save state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingOperations, setPendingOperations] = useState(0);

  // Validation state
  const [validationResults, setValidationResults] = useState<
    Record<string, SubtitleValidationResult>
  >({});

  // Error state
  const [error, setError] = useState<SubtitleFileError | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, SubtitleFileError>>({});

  // Performance state
  const [performanceMetrics, setPerformanceMetrics] = useState<SubtitlePerformanceMetrics[]>([]);
  const [cacheMetrics, setCacheMetrics] = useState<any>({});
  const [performanceAnalytics, setPerformanceAnalytics] = useState({
    averageLatency: 0,
    throughputTrend: 0,
    errorRate: 0,
    cacheEfficiency: 0,
    memoryTrend: { current: 0, trend: 0, peak: 0 },
    performanceScore: 100,
  });

  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(mergedOptions.autoFileOperations);

  // Track dirty files
  const dirtyFilesRef = useRef<Set<string>>(new Set());

  /**
   * Handle errors with callbacks
   */
  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const subtitleError = isSubtitleFileError(error)
        ? error
        : (new Error(
            `${context || 'Operation'} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          ) as SubtitleFileError);

      if (!subtitleError.code) {
        subtitleError.code = 'SUBTITLE_OPERATION_TIMEOUT';
      }

      setError(subtitleError);

      if (mergedOptions.onError) {
        mergedOptions.onError(subtitleError);
      }

      if (mergedOptions.onFileError && isSubtitleFileError(error)) {
        mergedOptions.onFileError(error);
      }
    },
    [mergedOptions]
  );

  /**
   * Handle operation success
   */
  const handleOperationSuccess = useCallback(
    (operation: string, result: any) => {
      if (mergedOptions.onFileOperationSuccess) {
        mergedOptions.onFileOperationSuccess(operation, result);
      }
    },
    [mergedOptions]
  );

  /**
   * Load subtitle file
   */
  const loadFile = useCallback(
    async (
      fileId: string,
      options: { useCache?: boolean; validateOnLoad?: boolean } = {}
    ): Promise<SubtitleFileContent | null> => {
      if (!activeWorkspaceId) return null;

      setIsLoadingFiles(true);
      setPendingOperations((prev) => prev + 1);

      try {
        const content = await service.loadFile(fileId, {
          useCache: options.useCache !== false && mergedOptions.enableFileCache,
        });

        if (content) {
          setCurrentFiles((prev) => ({ ...prev, [fileId]: content }));

          // Validate on load if requested
          if (options.validateOnLoad !== false && mergedOptions.validateOnLoad) {
            try {
              const validation = await service.validateFile(fileId);
              setValidationResults((prev) => ({ ...prev, [fileId]: validation }));

              if (validation.isValid && mergedOptions.onValidationSuccess) {
                mergedOptions.onValidationSuccess();
              } else if (!validation.isValid && mergedOptions.onValidationError) {
                mergedOptions.onValidationError(validation as any);
              }
            } catch (validationError) {
              console.warn('File validation failed:', validationError);
            }
          }

          handleOperationSuccess('load', { fileId, content });
        }

        return content;
      } catch (error) {
        const fileError = error as SubtitleFileError;
        setFileErrors((prev) => ({ ...prev, [fileId]: fileError }));
        handleError(error, `Loading file ${fileId}`);
        return null;
      } finally {
        setIsLoadingFiles(false);
        setPendingOperations((prev) => prev - 1);
      }
    },
    [activeWorkspaceId, service, mergedOptions, handleError, handleOperationSuccess]
  );

  /**
   * Save subtitle file with enhanced performance features
   */
  const saveFile = useCallback(
    async (
      fileId: string,
      content: SubtitleFileContent,
      options: { createBackup?: boolean; validate?: boolean; priority?: number } = {}
    ): Promise<void> => {
      if (!activeWorkspaceId) return;

      setIsSavingFiles(true);
      setPendingOperations((prev) => prev + 1);

      try {
        await service.saveFile(fileId, content, {
          createBackup: options.createBackup !== false,
          priority: options.priority || 1,
        });

        // Update local state
        setCurrentFiles((prev) => ({ ...prev, [fileId]: content }));
        dirtyFilesRef.current.delete(fileId);
        setHasUnsavedChanges(dirtyFilesRef.current.size > 0);

        // Validate after save if requested
        if (options.validate !== false && mergedOptions.autoValidate) {
          try {
            const validation = await service.validateFile(fileId);
            setValidationResults((prev) => ({ ...prev, [fileId]: validation }));
          } catch (validationError) {
            console.warn('Post-save validation failed:', validationError);
          }
        }

        // Clear file-specific errors
        setFileErrors((prev) => {
          const { [fileId]: removed, ...rest } = prev;
          return rest;
        });

        handleOperationSuccess('save', { fileId, content });
      } catch (error) {
        const fileError = error as SubtitleFileError;
        setFileErrors((prev) => ({ ...prev, [fileId]: fileError }));
        handleError(error, `Saving file ${fileId}`);
        throw error;
      } finally {
        setIsSavingFiles(false);
        setPendingOperations((prev) => prev - 1);
      }
    },
    [activeWorkspaceId, service, mergedOptions, handleError, handleOperationSuccess]
  );

  /**
   * Create new subtitle file
   */
  const createFile = useCallback(
    async (
      content: SubtitleFileContent,
      options: { compress?: boolean; fileType?: 'original' | 'modified' } = {}
    ): Promise<string> => {
      if (!activeWorkspaceId) throw new Error('No active workspace');

      setIsSavingFiles(true);
      setPendingOperations((prev) => prev + 1);

      try {
        // Ensure workspace ID is set
        content.metadata.workspaceId = activeWorkspaceId;

        const fileId = await service.createFile(content, {
          compress: options.compress !== false && content.subtitles.length > 100, // Compress large files by default
          fileType: options.fileType || 'modified',
        });

        setCurrentFiles((prev) => ({ ...prev, [fileId]: content }));
        handleOperationSuccess('create', {
          fileId,
          content,
          fileType: options.fileType || 'modified',
        });

        return fileId;
      } catch (error) {
        handleError(error, 'Creating new file');
        throw error;
      } finally {
        setIsSavingFiles(false);
        setPendingOperations((prev) => prev - 1);
      }
    },
    [activeWorkspaceId, service, handleError, handleOperationSuccess]
  );

  /**
   * Delete subtitle file
   */
  const deleteFile = useCallback(
    async (fileId: string, options: { permanent?: boolean } = {}): Promise<void> => {
      if (!activeWorkspaceId) return;

      setPendingOperations((prev) => prev + 1);

      try {
        await service.deleteFile(fileId, options);

        // Remove from local state
        setCurrentFiles((prev) => {
          const { [fileId]: removed, ...rest } = prev;
          return rest;
        });

        // Remove from dirty files
        dirtyFilesRef.current.delete(fileId);
        setHasUnsavedChanges(dirtyFilesRef.current.size > 0);

        // Clear file-specific state
        setFileErrors((prev) => {
          const { [fileId]: removed, ...rest } = prev;
          return rest;
        });
        setValidationResults((prev) => {
          const { [fileId]: removed, ...rest } = prev;
          return rest;
        });

        handleOperationSuccess('delete', { fileId });
      } catch (error) {
        handleError(error, `Deleting file ${fileId}`);
        throw error;
      } finally {
        setPendingOperations((prev) => prev - 1);
      }
    },
    [activeWorkspaceId, service, handleError, handleOperationSuccess]
  );

  /**
   * Validate subtitle file
   */
  const validateFile = useCallback(
    async (fileId: string): Promise<SubtitleValidationResult> => {
      if (!activeWorkspaceId) throw new Error('No active workspace');

      setIsValidating(true);
      setPendingOperations((prev) => prev + 1);

      try {
        const validation = await service.validateFile(fileId);
        setValidationResults((prev) => ({ ...prev, [fileId]: validation }));

        if (validation.isValid && mergedOptions.onValidationSuccess) {
          mergedOptions.onValidationSuccess();
        } else if (!validation.isValid && mergedOptions.onValidationError) {
          mergedOptions.onValidationError(validation as any);
        }

        handleOperationSuccess('validate', { fileId, validation });

        return validation;
      } catch (error) {
        handleError(error, `Validating file ${fileId}`);
        throw error;
      } finally {
        setIsValidating(false);
        setPendingOperations((prev) => prev - 1);
      }
    },
    [activeWorkspaceId, service, mergedOptions, handleError, handleOperationSuccess]
  );

  /**
   * Create backup
   */
  const createBackup = useCallback(
    async (fileId: string, description?: string): Promise<string> => {
      if (!activeWorkspaceId) throw new Error('No active workspace');

      setPendingOperations((prev) => prev + 1);

      try {
        const backupId = await service.createBackup(fileId, description);
        handleOperationSuccess('backup', { fileId, backupId, description });
        return backupId;
      } catch (error) {
        handleError(error, `Creating backup for file ${fileId}`);
        throw error;
      } finally {
        setPendingOperations((prev) => prev - 1);
      }
    },
    [activeWorkspaceId, service, handleError, handleOperationSuccess]
  );

  /**
   * Restore from backup
   */
  const restoreBackup = useCallback(
    async (backupId: string): Promise<void> => {
      if (!activeWorkspaceId) return;

      setPendingOperations((prev) => prev + 1);

      try {
        await service.restoreBackup(backupId);

        // Clear local state since files may have changed
        setCurrentFiles({});
        dirtyFilesRef.current.clear();
        setHasUnsavedChanges(false);

        handleOperationSuccess('restore', { backupId });
      } catch (error) {
        handleError(error, `Restoring backup ${backupId}`);
        throw error;
      } finally {
        setPendingOperations((prev) => prev - 1);
      }
    },
    [activeWorkspaceId, service, handleError, handleOperationSuccess]
  );

  /**
   * Update session data
   */
  const updateSession = useCallback(
    async (sessionData: Partial<SubtitleSessionData>): Promise<void> => {
      if (!activeWorkspaceId) return;

      try {
        const updatedSession = currentSession
          ? { ...currentSession, ...sessionData, lastUpdated: Date.now() }
          : {
              sessionId: `session-${Date.now()}`,
              workspaceId: activeWorkspaceId,
              sessionType: 'review' as const,
              createdAt: Date.now(),
              lastUpdated: Date.now(),
              state: {
                selectedSubtitleIds: [],
                editMode: 'simple' as const,
                viewMode: 'list' as const,
                filters: {
                  showOnlyUntranslated: false,
                  showOnlyLowConfidence: false,
                },
              },
              autoSave: {
                enabled: true,
                interval: mergedOptions.fileAutoSaveInterval,
                pendingChanges: false,
              },
              preferences: {
                showConfidenceScores: true,
                showTimestamps: true,
                showSpeakers: true,
                highlightLowConfidence: true,
                enableSpellCheck: false,
                fontSize: 14,
              },
              statistics: {
                editsCount: 0,
                timeSpent: 0,
                subtitlesReviewed: 0,
                issuesResolved: 0,
              },
              ...sessionData,
            };

        setCurrentSession(updatedSession);

        // Save to workspace store if needed
        // This would typically involve IPC call to persist session
      } catch (error) {
        handleError(error, 'Updating session');
      }
    },
    [activeWorkspaceId, currentSession, mergedOptions.fileAutoSaveInterval, handleError]
  );

  /**
   * Save session
   */
  const saveSession = useCallback(async (): Promise<void> => {
    if (!currentSession || !activeWorkspaceId) return;

    try {
      // Save session via IPC
      await window.electron.ipcRenderer.invoke('save-subtitle-session', {
        workspaceId: activeWorkspaceId,
        sessionData: currentSession,
      });
    } catch (error) {
      handleError(error, 'Saving session');
    }
  }, [currentSession, activeWorkspaceId, handleError]);

  /**
   * Load session
   */
  const loadSession = useCallback(
    async (sessionType: SubtitleSessionData['sessionType'] = 'review'): Promise<void> => {
      if (!activeWorkspaceId) return;

      setIsLoading(true);

      try {
        const sessionData = await window.electron.ipcRenderer.invoke('load-subtitle-session', {
          workspaceId: activeWorkspaceId,
          sessionType,
        });

        if (sessionData) {
          setCurrentSession(sessionData);
        }
      } catch (error) {
        handleError(error, 'Loading session');
      } finally {
        setIsLoading(false);
      }
    },
    [activeWorkspaceId, handleError]
  );

  /**
   * Clear cache
   */
  const clearCache = useCallback(
    async (fileId?: string): Promise<void> => {
      try {
        await service.clearCache(fileId);

        // Update cache metrics
        setCacheMetrics(service.getCacheMetrics());
      } catch (error) {
        handleError(error, 'Clearing cache');
      }
    },
    [service, handleError]
  );

  /**
   * Refresh file from backend
   */
  const refreshFile = useCallback(
    async (fileId: string): Promise<void> => {
      if (!activeWorkspaceId) return;

      try {
        // Clear cache for this file
        await service.clearCache(fileId);

        // Reload the file
        await loadFile(fileId, { useCache: false });
      } catch (error) {
        handleError(error, `Refreshing file ${fileId}`);
      }
    },
    [activeWorkspaceId, service, loadFile, handleError]
  );

  /**
   * Enable auto-save
   */
  const enableAutoSave = useCallback(
    (interval?: number): void => {
      // Note: Do not call setAutoSaveEnabled(true) here to avoid infinite loops
      // The state management is handled by the component using this hook
      
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setInterval(async () => {
        if (dirtyFilesRef.current.size > 0 && !isSavingFiles) {
          setIsAutoSaving(true);

          try {
            const savePromises = Array.from(dirtyFilesRef.current).map(async (fileId) => {
              const content = currentFiles[fileId];
              if (content) {
                await saveFile(fileId, content);
              }
            });

            await Promise.all(savePromises);
            setLastAutoSave(Date.now());
          } catch (error) {
            console.error('Auto-save failed:', error);
          } finally {
            setIsAutoSaving(false);
          }
        }
      }, interval || mergedOptions.fileAutoSaveInterval);
    },
    [isSavingFiles, currentFiles, saveFile, mergedOptions.fileAutoSaveInterval]
  );

  /**
   * Disable auto-save
   */
  const disableAutoSave = useCallback((): void => {
    // Note: Do not call setAutoSaveEnabled(false) here to avoid infinite loops
    // The state management is handled by the component using this hook

    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  /**
   * Save all dirty files
   */
  const saveAll = useCallback(async (): Promise<void> => {
    if (dirtyFilesRef.current.size === 0) return;

    setIsSavingFiles(true);

    try {
      const savePromises = Array.from(dirtyFilesRef.current).map(async (fileId) => {
        const content = currentFiles[fileId];
        if (content) {
          await saveFile(fileId, content);
        }
      });

      await Promise.all(savePromises);
    } catch (error) {
      handleError(error, 'Saving all files');
      throw error;
    } finally {
      setIsSavingFiles(false);
    }
  }, [currentFiles, saveFile, handleError]);

  /**
   * Clear error
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Clear file-specific error
   */
  const clearFileError = useCallback((fileId: string): void => {
    setFileErrors((prev) => {
      const { [fileId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * Retry operation
   */
  const retryOperation = useCallback(async (operationId: string): Promise<void> => {
    // Implementation would depend on how operations are tracked
    console.log('Retrying operation:', operationId);
  }, []);

  /**
   * Get performance metrics
   */
  const getPerformanceMetrics = useCallback(async (): Promise<SubtitlePerformanceMetrics[]> => {
    if (!mergedOptions.enablePerformanceMonitoring) return [];

    try {
      const metrics = await service.getPerformanceMetrics();
      setPerformanceMetrics(metrics);
      return metrics;
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return [];
    }
  }, [service, mergedOptions.enablePerformanceMonitoring]);

  /**
   * Clear performance metrics
   */
  const clearPerformanceMetrics = useCallback((): void => {
    setPerformanceMetrics([]);
  }, []);

  /**
   * Update cache metrics and performance analytics periodically
   */
  useEffect(() => {
    const updateMetrics = async () => {
      try {
        // Update cache metrics
        const cache = service.getCacheMetrics();
        setCacheMetrics(cache);

        // Update performance analytics if enhanced tracker is available
        if (mergedOptions.enablePerformanceMonitoring && service.getPerformanceAnalytics) {
          const analytics = await service.getPerformanceAnalytics();
          setPerformanceAnalytics(analytics);
        }
      } catch (error) {
        console.warn('Failed to update performance metrics:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [service, mergedOptions.enablePerformanceMonitoring]);

  /**
   * Auto-save setup - Fixed infinite loop by removing setState calls from useEffect
   */
  useEffect(() => {
    if (autoSaveEnabled && isWorkspaceReady) {
      // Setup auto-save timer directly without calling enableAutoSave() to prevent infinite loop
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setInterval(async () => {
        if (dirtyFilesRef.current.size > 0 && !isSavingFiles) {
          setIsAutoSaving(true);

          try {
            const savePromises = Array.from(dirtyFilesRef.current).map(async (fileId) => {
              const content = currentFiles[fileId];
              if (content) {
                await saveFile(fileId, content);
              }
            });

            await Promise.all(savePromises);
            setLastAutoSave(Date.now());
          } catch (error) {
            console.error('Auto-save failed:', error);
          } finally {
            setIsAutoSaving(false);
          }
        }
      }, mergedOptions.fileAutoSaveInterval);
    } else {
      // Disable auto-save timer directly without calling disableAutoSave() to prevent infinite loop
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveEnabled, isWorkspaceReady, isSavingFiles, currentFiles, saveFile, mergedOptions.fileAutoSaveInterval]);

  /**
   * Load session on workspace change
   */
  useEffect(() => {
    if (activeWorkspaceId && isWorkspaceReady) {
      loadSession();
    }
  }, [activeWorkspaceId, isWorkspaceReady]);

  // Create the subtitle file operations interface
  const subtitleFiles: SubtitleFileOperations = {
    loadFile: async (fileId: string, options?: { useCache?: boolean }) => {
      const result = await loadFile(fileId, options);
      if (result === null) {
        throw new Error(`Failed to load file: ${fileId}`);
      }
      return result;
    },
    saveFile,
    createFile,
    deleteFile,
    validateFile,
    getMetadata: async (fileId: string) => {
      const metadata = await service.getMetadata(fileId);
      return metadata;
    },
    createBackup,
    restoreBackup,
    batchOperation: service.batchOperation.bind(service),
    getOperationStatus: service.getOperationStatus.bind(service),
    cancelOperation: service.cancelOperation.bind(service),
    clearCache,
    getPerformanceMetrics,
  };

  return {
    // File Operations
    subtitleFiles,
    
    // Enhanced Integration
    tempStorage,

    // Current State
    currentFiles,
    currentSession,
    fileStatus,

    // Loading States
    isLoading,
    isLoadingFiles,
    isSaving,
    isSavingFiles,
    isValidating,

    // Auto-save State
    isAutoSaving,
    lastAutoSave,
    hasUnsavedChanges,
    pendingOperations,

    // Validation State
    validationResults,

    // Error State
    error,
    fileErrors,

    // Performance State
    performanceMetrics,
    cacheMetrics,
    performanceAnalytics,

    // Actions
    loadFile,
    saveFile,
    createFile,
    deleteFile,
    validateFile,
    createBackup,
    restoreBackup,

    // Session Management
    updateSession,
    saveSession,
    loadSession,

    // Cache Management
    clearCache,
    refreshFile,

    // Auto-save Control
    enableAutoSave,
    disableAutoSave,
    saveAll,

    // Error Handling
    clearError,
    clearFileError,
    retryOperation,

    // Performance
    getPerformanceMetrics,
    clearPerformanceMetrics,
  };
}
