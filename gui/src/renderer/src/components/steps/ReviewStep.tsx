import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Box, Alert, Snackbar, LinearProgress, Typography, Chip } from '@mui/material';
import { CheckCircle, Save, Error as ErrorIcon } from '@mui/icons-material';
import { useAppStore } from '../../stores/app-store';
import { useSubtitleEditStore } from '../../stores/subtitle-edit-store';
import { useReviewStepConfig, useWorkspaceConfig } from '../../contexts/WorkspaceConfigContext';
import { useSubtitleTempStorage } from '../../hooks/useSubtitleTempStorage';
// DISABLED: import { useAutoSaveIntegration } from '../../hooks/useAutoSaveIntegration';
import { VideoPreviewSection } from './ReviewStep/VideoPreviewSection';
import { SubtitleEditor } from './ReviewStep/SubtitleEditor';
import { SubtitleListPanel } from './ReviewStep/SubtitleListPanel';
import { ProcessingErrorBoundary } from '../common/ProcessingErrorBoundary';
// REMOVED: SubtitleAutoSaveIndicator - auto-save UI components deleted
import { SessionRecoveryDialog } from '../dialogs/SessionRecoveryDialog';
import { pulseKeyframes } from './ReviewStep/styles';
import { PerformanceMonitor, debounce } from '../../utils/performance-utils';
import { transformSubtitleData } from '../../utils/subtitle-transformation';
import type { SubtitleFileContent } from '../../types/subtitle-persistence';
import type { SubtitleEntry } from '../../types/subtitle';

// Helper functions for quality calculations
const calculateGaps = (subtitles: SubtitleEntry[]): number => {
  if (subtitles.length < 2) return 0;
  
  let gapCount = 0;
  const minGapThreshold = 0.1; // 100ms minimum gap
  
  for (let i = 0; i < subtitles.length - 1; i++) {
    const current = subtitles[i];
    const next = subtitles[i + 1];
    
    if (current.endTime && next.startTime) {
      const gap = next.startTime - current.endTime;
      if (gap > minGapThreshold) {
        gapCount++;
      }
    }
  }
  
  return gapCount;
};

const calculateOverlaps = (subtitles: SubtitleEntry[]): number => {
  if (subtitles.length < 2) return 0;
  
  let overlapCount = 0;
  
  for (let i = 0; i < subtitles.length - 1; i++) {
    const current = subtitles[i];
    const next = subtitles[i + 1];
    
    if (current.endTime && next.startTime && current.endTime > next.startTime) {
      overlapCount++;
    }
  }
  
  return overlapCount;
};

const calculateQualityScore = (subtitles: SubtitleEntry[]): number => {
  if (subtitles.length === 0) return 0;
  
  let totalScore = 0;
  let validSubtitles = 0;
  
  for (const subtitle of subtitles) {
    let score = 1.0; // Start with perfect score
    
    // Confidence penalty - lower confidence reduces score
    if (subtitle.confidence !== undefined) {
      score *= subtitle.confidence;
    }
    
    // Duration penalty - very short or very long subtitles get penalized
    if (subtitle.duration !== undefined) {
      const duration = subtitle.duration;
      if (duration < 0.5) {
        score *= 0.7; // Penalty for very short subtitles
      } else if (duration > 10) {
        score *= 0.8; // Penalty for very long subtitles
      }
    }
    
    // Text quality penalties
    if (subtitle.text) {
      const text = subtitle.text.trim();
      if (text.length < 2) {
        score *= 0.5; // Penalty for very short text
      }
      if (text.length > 200) {
        score *= 0.9; // Minor penalty for very long text
      }
    }
    
    totalScore += score;
    validSubtitles++;
  }
  
  return validSubtitles > 0 ? totalScore / validSubtitles : 0;
};

const ReviewStepComponent: React.FC = () => {
  const { config } = useAppStore();
  const {
    initializeSession,
    clearSession,
    session,
    isLoading,
    enablePersistence,
    checkForRecoverableSession,
    recoverSession,
    sessionRecovery,
    saveSessionToTempStorage,
    restorePersistedSession,
    setAutoSaveCallback,
    resetSessionForNewContent,
  } = useSubtitleEditStore();
  const reviewStepResult = useReviewStepConfig();
  const {
    config: reviewConfig,
    updateConfig: updateReviewConfig,
    isLoading: configLoading,
    error,
    isReady,
    // Subtitle persistence properties
    persistenceData,
    loadSubtitleFile,
    saveSubtitleFile,
    createSubtitleFile,
    isLoadingFiles,
    isSavingFiles,
    hasUnsavedFileChanges,
    fileError,
    clearFileError,
  } = reviewStepResult;
  const { autoSaveStatus, isAutoSaving, lastError, clearError, currentWorkspaceId } =
    useWorkspaceConfig();

  // DISABLED: Auto-save integration permanently disabled for performance
  // const autoSaveIntegration = useAutoSaveIntegration({ disabled: true });
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [subtitleFiles, setSubtitleFiles] = useState<Record<string, SubtitleFileContent>>({});
  const [originalFileId, setOriginalFileId] = useState<string | null>(null);
  const [modifiedFileId, setModifiedFileId] = useState<string | null>(null);
  const [showSessionRecovery, setShowSessionRecovery] = useState(false);
  const [sessionRecoveryInfo, setSessionRecoveryInfo] = useState<{
    lastModified: number;
    subtitleCount: number;
    editCount: number;
    workspaceId: string;
  } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false); // Prevent infinite initialization loops
  const [initializationMutex, setInitializationMutex] = useState(false); // Prevent concurrent initialization
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce initialization
  
  // Additional performance-related refs
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const get = useSubtitleEditStore.getState;

  // CRITICAL: Comprehensive cleanup on unmount
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = pulseKeyframes;
    document.head.appendChild(style);
    
    return () => {
      // Style cleanup
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
      
      // Timeout cleanup
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
      
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      
      // CRITICAL: Clear initialization tracking on unmount
      initializationCompleteRef.current.clear();
    };
  }, []);

  // CRITICAL: Reset initialization tracking when workspace or input file changes
  useEffect(() => {
    initializationCompleteRef.current.clear();
    console.log('🔄 Cleared initialization tracking due to workspace/file change');
  }, [currentWorkspaceId, config.inputFile]);

  // Create stable reference to prevent infinite re-renders
  const lastInitDataRef = useRef<{
    inputFile: string | null;
    outputFile: string | null;
    subtitleCount: number;
    videoPath: string | null;
    originalPath: string | null;
  }>({
    inputFile: null,
    outputFile: null,
    subtitleCount: 0,
    videoPath: null,
    originalPath: null,
  });

  // STABLE: Content fingerprint to detect NEW source content (not user edits)
  const createContentFingerprint = useCallback(
    (data: {
      inputFile: string | null;
      outputFile: string | null;
      importedJsonFile: string | null;
      workspaceId: string | null;
      hasSubtitleData: boolean;
    }) => {
      // Only include factors that indicate NEW source content, not user edits
      const { inputFile, outputFile, importedJsonFile, workspaceId, hasSubtitleData } = data;
      // Use file paths and timestamps, NOT subtitle content (which changes with user edits)
      return `${workspaceId}:${inputFile}:${outputFile}:${importedJsonFile}:${hasSubtitleData}`;
    },
    [] // STABLE: Empty deps to prevent recreation
  );

  const lastContentFingerprintRef = useRef<string>('');

  // OPTIMIZED: Auto-save integration callback with reduced re-renders
  const autoSaveCallbackRef = useRef<((subtitles: any[], action: string) => void) | null>(null);
  
  useEffect(() => {
    // Create stable callback reference
    const callback = (subtitles: any[], action: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Auto-save triggered for action: ${action}`, {
          subtitleCount: subtitles.length,
        });
      }
      // DISABLED AUTO-SAVE INTEGRATION FOR PERFORMANCE
      // The auto-save integration causes 2-3 second delays during JSON imports
      /*
      autoSaveIntegration.forceSave().catch((error) => {
        console.error('Auto-save failed:', error);
      });
      */
    };

    autoSaveCallbackRef.current = callback;
    setAutoSaveCallback(callback);

    // Cleanup callback on unmount
    return () => {
      setAutoSaveCallback(null);
      autoSaveCallbackRef.current = null;
    };
  }, []); // Empty dependency array - callback is stable

  // DISABLED: Auto-save cleanup (was causing performance issues)
  // useEffect(() => {
  //   return () => {
  //     // Auto-save cleanup disabled
  //   };
  // }, [currentWorkspaceId]);

  // Performance monitor instance
  const performanceMonitor = PerformanceMonitor.getInstance();

  // CRITICAL FIX: Stable subtitle data preparation to prevent infinite re-renders
  const preparedSubtitleData = useMemo(() => {
    // Reduced debug logging to prevent performance impact
    const hasInputFile = !!config.inputFile;
    const hasSubtitle = Array.isArray(config.subtitle) && config.subtitle.length > 0;
    const hasOutputFile = !!config.outputFile;
    const hasImportedJson = !!config.importedJsonFile;
    const isImported = config.isImportedFromJson;

    // Fast path: JSON imports (highest priority)
    if (hasInputFile && hasSubtitle && (hasImportedJson || isImported)) {
      // CRITICAL: Return stable reference to prevent infinite loops
      return {
        data: config.subtitle,
        type: 'JSON_IMPORT' as const,
        source: config.importedJsonFile || 'imported-json',
        // Add stable identity to prevent object recreation
        __stable_id: `json_import_${config.inputFile}_${config.subtitle.length}_${config.importedJsonFile}`,
      };
    }

    // Standard subtitle array
    if (hasInputFile && hasSubtitle) {
      return config.subtitle;
    }

    // SRT loading marker
    if (hasInputFile && hasOutputFile && !hasImportedJson) {
      return 'LOAD_FROM_SRT' as const;
    }

    return null;
  }, [
    config.inputFile,
    config.subtitle,
    config.outputFile,
    config.importedJsonFile,
    config.isImportedFromJson,
  ]);

  /**
   * Load subtitle files from persistence layer
   */
  const loadSubtitleFiles = useCallback(async () => {
    if (!isReady || !config.inputFile) return;

    try {
      // Try to load existing files first
      const workspaceId = persistenceData.currentSession?.workspaceId;
      if (workspaceId) {
        // Check for existing original and modified files
        const files = persistenceData.currentFiles;

        if (Object.keys(files).length > 0) {
          setSubtitleFiles(files);
          // Find original and modified file IDs
          const originalFile = Object.entries(files).find(
            ([_, content]) => content.metadata && content.metadata.fileType === 'original'
          );
          const modifiedFile = Object.entries(files).find(
            ([_, content]) => content.metadata && content.metadata.fileType === 'modified'
          );

          if (originalFile) setOriginalFileId(originalFile[0]);
          if (modifiedFile) setModifiedFileId(modifiedFile[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load subtitle files:', error);
    }
  }, [isReady, config.inputFile, persistenceData]);

  /**
   * Save subtitle session to persistence layer
   */
  const saveSubtitleSession = useCallback(async () => {
    if (!session || !isReady) return;

    try {
      // Create subtitle file content from session
      const subtitleFileContent: SubtitleFileContent = {
        metadata: {
          fileId: modifiedFileId || `modified-${Date.now()}`,
          workspaceId: persistenceData.currentSession?.workspaceId || 'default',
          version: 1,
          schemaVersion: 1,
        },
        subtitles: session.currentSubtitles.map((subtitle) => ({
          id: subtitle.id,
          index: subtitle.index,
          startTime: subtitle.startTime,
          endTime: subtitle.endTime,
          text: subtitle.text,
          translation: subtitle.translation,
          confidence: subtitle.confidence,
          speaker: subtitle.speaker,
          music: subtitle.isMusic || false,
        })),
        statistics: {
          totalSubtitles: session.currentSubtitles.length,
          totalDuration: session.totalDuration || 0,
          wordCount: session.currentSubtitles.reduce(
            (count, sub) => count + (sub.text?.split(' ').length || 0),
            0
          ),
          characterCount: session.currentSubtitles.reduce(
            (count, sub) => count + (sub.text?.length || 0),
            0
          ),
          translationCoverage:
            session.currentSubtitles.filter((sub) => sub.translation && sub.translation.trim())
              .length / session.currentSubtitles.length,
          averageConfidence:
            session.currentSubtitles.reduce((sum, sub) => sum + (sub.confidence || 0), 0) /
            session.currentSubtitles.length,
          speakerDistribution: {},
          musicSegments: session.currentSubtitles.filter((sub) => sub.isMusic).length,
          qualityDistribution: {
            high: session.currentSubtitles.filter((sub) => (sub.confidence || 0) > 0.8).length,
            medium: session.currentSubtitles.filter(
              (sub) => (sub.confidence || 0) >= 0.5 && (sub.confidence || 0) <= 0.8
            ).length,
            low: session.currentSubtitles.filter((sub) => (sub.confidence || 0) < 0.5).length,
          },
          timingStats: {
            averageDuration:
              session.currentSubtitles.reduce((sum, sub) => sum + (sub.duration || 0), 0) /
              session.currentSubtitles.length,
            minDuration: Math.min(...session.currentSubtitles.map((sub) => sub.duration || 0)),
            maxDuration: Math.max(...session.currentSubtitles.map((sub) => sub.duration || 0)),
            gapCount: calculateGaps(session.currentSubtitles),
            overlapCount: calculateOverlaps(session.currentSubtitles)
          },
        },
        editHistory: session.modifications.map((mod) => ({
          id: mod.id,
          timestamp: Date.parse(mod.timestamp),
          operation:
            mod.type === 'added'
              ? 'create'
              : mod.type === 'deleted'
                ? 'delete'
                : mod.type === 'modified'
                  ? 'update'
                  : 'update',
          subtitleId: parseInt(mod.subtitleId) || 0,
          field: 'text',
          previousValue: mod.original,
          newValue: mod.modified,
          source: 'user',
          context: {
            reason: mod.description,
          },
        })),
        validation: {
          isValid: true,
          warnings: [],
          errors: [],
          qualityScore: calculateQualityScore(session.currentSubtitles)
        },
      };

      // Save or create the modified file
      if (modifiedFileId) {
        await saveSubtitleFile(modifiedFileId, subtitleFileContent, { createBackup: true });
      } else {
        const newFileId = await createSubtitleFile(subtitleFileContent, 'modified');
        setModifiedFileId(newFileId);
      }

      // Update workspace configuration
      await updateReviewConfig({
        subtitlePersistence: {
          modifiedFile: {
            fileId: modifiedFileId || 'new',
            path: `${modifiedFileId || 'new'}.json`,
            metadata: subtitleFileContent.metadata as any,
            hasChanges: session.isDirty,
          },
          sessionBackups: [],
          autoSave: {
            enabled: reviewConfig?.editingPreferences?.autoSave !== false,
            interval: reviewConfig?.editingPreferences?.autoSaveConfig?.interval || 30000,
            lastSave: Date.now(),
            backupCount: 1,
          },
          operationHistory: [],
          cacheStatus: {
            isCached: true,
            lastCacheUpdate: Date.now(),
          },
          performance: {
            lastOperationTime: Date.now(),
            averageOperationTime: 1000,
            totalOperations: 1,
            errorCount: 0,
          },
        },
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error('Failed to save subtitle session:', error);
    }
  }, [
    session,
    isReady,
    modifiedFileId,
    saveSubtitleFile,
    createSubtitleFile,
    updateReviewConfig,
    reviewConfig,
    persistenceData,
  ]);

  // PERFORMANCE-CRITICAL: Optimized initialization with reduced overhead
  const stableInitializeSession = useCallback(
    async (subtitlePath: string, videoPath: string, importedData?: any[]) => {
      if (!currentWorkspaceId) {
        console.warn('Cannot initialize session without workspace ID');
        return;
      }

      const validatedVideoPath = videoPath || config.inputFile || '';
      const isImport = !!importedData;
      
      setIsInitializing(true);

      try {
        clearSession(); // Clear existing session to prevent conflicts

        if (isImport) {
          // Optimized transformation with performance monitoring
          const startTime = performance.now();
          const transformedData = await transformSubtitleData(importedData, {
            useCache: true,
            forceSync: importedData.length < 50, // Increased threshold for sync processing
          });
          const transformTime = performance.now() - startTime;

          // Data integrity check (only log if there's actual loss)
          if (importedData.length !== transformedData.length) {
            console.error('🚨 DATA LOSS:', {
              original: importedData.length,
              transformed: transformedData.length,
              lost: importedData.length - transformedData.length,
            });
          }

          await initializeSession(
            subtitlePath,
            validatedVideoPath,
            currentWorkspaceId,
            transformedData,
            true
          );

          // Performance tracking
          if (transformTime > 100) {
            console.warn(`⚡ Slow transformation: ${transformTime.toFixed(2)}ms for ${importedData.length} subtitles`);
          }
        } else {
          await initializeSession(subtitlePath, validatedVideoPath, currentWorkspaceId);
        }

        performanceMonitor.endOperation(
          isImport ? 'JSON Import Init' : 'SRT Init', 
          importedData?.length
        );
      } catch (error) {
        console.error('Session initialization failed:', error);
        performanceMonitor.endOperation('Init ERROR', importedData?.length);
        throw error; // Re-throw to trigger circuit breaker
      } finally {
        setIsInitializing(false);
      }
    },
    [
      initializeSession,
      clearSession,
      performanceMonitor,
      currentWorkspaceId,
      config.inputFile,
    ]
  );

  // Load or create session when subtitle data is expected but not available
  const ensureSessionExists = useCallback(
    async (srtPath: string, videoPath: string) => {
      // Ensure we have a valid video path - use config.inputFile as fallback
      const validatedVideoPath = videoPath || config.inputFile || '';
      console.log('🔧 DEBUG: ensureSessionExists video path validation:', {
        originalVideoPath: videoPath,
        validatedVideoPath,
        'config.inputFile': config.inputFile,
        timestamp: new Date().toISOString(),
      });
      try {
        console.log('🔄 Ensuring session exists for workspace:', currentWorkspaceId);

        // First, try to load subtitle data from workspace persistence
        if (currentWorkspaceId) {
          try {
            const result = await window.cantocapAPI.loadSubtitleFile({
              workspaceId: currentWorkspaceId,
              fileType: 'modified', // Try to load user modifications first
            });

            if (result.success && result.data?.subtitles?.length > 0) {
              console.log(
                '✅ Loaded subtitle data from workspace storage:',
                result.data.subtitles.length,
                'subtitles'
              );

              // Transform the data and initialize session
              const transformedData = result.data.subtitles.map((subtitle) => ({
                id: subtitle.id?.toString() || Math.random().toString(),
                index: subtitle.index || 0,
                startTime: subtitle.startTime || 0,
                endTime: subtitle.endTime || 0,
                duration: (subtitle.endTime || 0) - (subtitle.startTime || 0),
                text: subtitle.text || '',
                translation: subtitle.translation,
                confidence: subtitle.confidence,
                speaker: subtitle.speaker,
                isMusic: subtitle.music || false,
              }));

              await stableInitializeSession(srtPath, validatedVideoPath, transformedData);
              return;
            }
          } catch (workspaceLoadError) {
            console.warn('⚠️ Could not load from workspace storage:', workspaceLoadError);
          }

          // Try to load original file if modified doesn't exist
          try {
            const result = await window.cantocapAPI.loadSubtitleFile({
              workspaceId: currentWorkspaceId,
              fileType: 'original',
            });

            if (result.success && result.data?.subtitles?.length > 0) {
              console.log(
                '✅ Loaded original subtitle data from workspace storage:',
                result.data.subtitles.length,
                'subtitles'
              );

              const transformedData = result.data.subtitles.map((subtitle) => ({
                id: subtitle.id?.toString() || Math.random().toString(),
                index: subtitle.index || 0,
                startTime: subtitle.startTime || 0,
                endTime: subtitle.endTime || 0,
                duration: (subtitle.endTime || 0) - (subtitle.startTime || 0),
                text: subtitle.text || '',
                translation: subtitle.translation,
                confidence: subtitle.confidence,
                speaker: subtitle.speaker,
                isMusic: subtitle.music || false,
              }));

              await stableInitializeSession(srtPath, validatedVideoPath, transformedData);
              return;
            }
          } catch (originalLoadError) {
            console.warn(
              '⚠️ Could not load original file from workspace storage:',
              originalLoadError
            );
          }
        }

        // If no data is found in workspace storage, create empty session for user to add subtitles
        console.log(
          '📝 No existing subtitle data found, creating empty session for manual editing'
        );
        await stableInitializeSession(srtPath, validatedVideoPath, []);
      } catch (error) {
        console.error('❌ Failed to ensure session exists:', error);
        // Create empty session as fallback
        try {
          await stableInitializeSession(srtPath, validatedVideoPath, []);
        } catch (fallbackError) {
          console.error('❌ Failed to create fallback empty session:', fallbackError);
        }
      }
    },
    [stableInitializeSession, currentWorkspaceId, config.inputFile]
  );

  // REMOVED: Automatic reset handlers that trigger on config changes
  // Session resets now only happen on explicit user button clicks
  // This prevents unwanted session resets during step navigation

  // Session resets are now handled directly in app-store updateConfig and startTranscription
  // This ensures they only trigger on explicit user button clicks, not navigation

  // CRITICAL FIX: Split monolithic useEffect into focused, performance-optimized effects
  
  // Circuit breaker for initialization failures
  const initializationCircuitBreakerRef = useRef<{ failures: number; lastFailure: number }>({
    failures: 0,
    lastFailure: 0,
  });

  // CRITICAL FIX: Track initialization completion to prevent loops
  const initializationCompleteRef = useRef<Set<string>>(new Set());
  
  // Effect 1: Handle JSON import data initialization (highest priority)
  useEffect(() => {
    if (!preparedSubtitleData || typeof preparedSubtitleData !== 'object' || preparedSubtitleData.type !== 'JSON_IMPORT') {
      return;
    }

    if (session || isLoading || initializationMutex || !currentWorkspaceId || !isReady) {
      return;
    }

    // CRITICAL: Check if this exact import has already been initialized
    const importId = preparedSubtitleData.__stable_id || `json_${config.inputFile}_${preparedSubtitleData.data.length}`;
    if (initializationCompleteRef.current.has(importId)) {
      return;
    }

    // Skip if batch JSON import is in progress
    if ((window as any).__JSON_IMPORT_IN_PROGRESS) {
      return;
    }

    const initializeJsonImport = async () => {
      setInitializationMutex(true);
      try {
        await stableInitializeSession(
          preparedSubtitleData.source,
          config.inputFile,
          preparedSubtitleData.data
        );
        // Mark this import as completed
        initializationCompleteRef.current.add(importId);
        initializationCircuitBreakerRef.current.failures = 0;
      } catch (error) {
        console.error('❌ JSON import initialization failed:', error);
        initializationCircuitBreakerRef.current.failures++;
        initializationCircuitBreakerRef.current.lastFailure = Date.now();
      } finally {
        setInitializationMutex(false);
      }
    };

    // Debounce JSON import initialization
    const timeoutId = setTimeout(initializeJsonImport, 100);
    return () => clearTimeout(timeoutId);
  }, [
    preparedSubtitleData,
    // INFINITE LOOP FIX: Remove session?.sessionId from deps - checked in effect body instead
    isLoading,
    currentWorkspaceId,
    isReady,
    config.inputFile,
    stableInitializeSession
  ]);

  // Effect 2: Handle array-based imported data (medium priority)
  useEffect(() => {
    if (!preparedSubtitleData || !Array.isArray(preparedSubtitleData) || !config.importedJsonFile) {
      return;
    }

    if (session || isLoading || initializationMutex || !currentWorkspaceId || !isReady || !config.inputFile) {
      return;
    }

    // CRITICAL: Check if this exact array import has already been initialized
    const arrayImportId = `array_${config.inputFile}_${preparedSubtitleData.length}_${config.importedJsonFile}`;
    if (initializationCompleteRef.current.has(arrayImportId)) {
      return;
    }

    const initializeArrayImport = async () => {
      setInitializationMutex(true);
      try {
        await stableInitializeSession(
          'imported-subtitles.json',
          config.inputFile,
          preparedSubtitleData
        );
        // Mark this array import as completed
        initializationCompleteRef.current.add(arrayImportId);
        initializationCircuitBreakerRef.current.failures = 0;
      } catch (error) {
        console.error('❌ Array import initialization failed:', error);
        initializationCircuitBreakerRef.current.failures++;
        initializationCircuitBreakerRef.current.lastFailure = Date.now();
      } finally {
        setInitializationMutex(false);
      }
    };

    const timeoutId = setTimeout(initializeArrayImport, 150);
    return () => clearTimeout(timeoutId);
  }, [
    preparedSubtitleData,
    config.importedJsonFile,
    config.inputFile,
    // INFINITE LOOP FIX: Remove session?.sessionId from deps - checked in effect body instead
    isLoading,
    currentWorkspaceId,
    isReady,
    stableInitializeSession
  ]);

  // Effect 3: Handle SRT loading (lowest priority)
  useEffect(() => {
    const shouldLoadSrt = preparedSubtitleData === 'LOAD_FROM_SRT' || 
      (config.inputFile && config.outputFile && !config.importedJsonFile);
    
    if (!shouldLoadSrt) {
      return;
    }

    if (session || isLoading || initializationMutex || !currentWorkspaceId || !isReady) {
      return;
    }

    // Circuit breaker check
    const circuitBreaker = initializationCircuitBreakerRef.current;
    const now = Date.now();
    if (circuitBreaker.failures > 3 && (now - circuitBreaker.lastFailure) < 60000) {
      console.warn('🚫 Circuit breaker: Too many SRT initialization failures, backing off');
      return;
    }

    const initializeSrt = async () => {
      setInitializationMutex(true);
      try {
        const srtPath = config.outputFile?.replace(/\.[^/.]+$/, '.srt') || 'output.srt';
        await ensureSessionExists(srtPath, config.inputFile);
        circuitBreaker.failures = 0;
      } catch (error) {
        console.error('❌ SRT initialization failed:', error);
        circuitBreaker.failures++;
        circuitBreaker.lastFailure = now;
      } finally {
        setInitializationMutex(false);
      }
    };

    const timeoutId = setTimeout(initializeSrt, 200);
    return () => clearTimeout(timeoutId);
  }, [
    preparedSubtitleData,
    config.inputFile,
    config.outputFile,
    config.importedJsonFile,
    session?.sessionId,
    isLoading,
    currentWorkspaceId,
    isReady,
    ensureSessionExists
  ]);

  // Effect 4: Handle existing workspace session restoration
  useEffect(() => {
    if (session || isLoading || !currentWorkspaceId || !isReady) {
      return;
    }

    const restoreExistingSession = async () => {
      try {
        const { checkAndRestoreWorkspaceSession } = useSubtitleEditStore.getState();
        const existingSessionId = await checkAndRestoreWorkspaceSession(currentWorkspaceId);
        
        if (existingSessionId) {
          console.log('🔄 Restored existing workspace session:', existingSessionId);
          initializationCircuitBreakerRef.current.failures = 0;
        }
      } catch (error) {
        console.warn('⚠️ Failed to restore existing session:', error);
      }
    };

    const timeoutId = setTimeout(restoreExistingSession, 50);
    return () => clearTimeout(timeoutId);
  }, [
    session?.sessionId,
    isLoading,
    currentWorkspaceId,
    isReady
  ]);

  // OPTIMIZED: Session recovery check with performance improvements
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRecoveryCheckRef = useRef<string>('');
  
  useEffect(() => {
    if (!isReady || !currentWorkspaceId) return;

    // Skip if we already checked this workspace recently
    const recoveryKey = `${currentWorkspaceId}-${isReady}`;
    if (lastRecoveryCheckRef.current === recoveryKey) {
      return;
    }

    // Clear any pending recovery check
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }

    recoveryTimeoutRef.current = setTimeout(async () => {
      try {
        lastRecoveryCheckRef.current = recoveryKey;
        
        // Enable persistence for this workspace
        enablePersistence(currentWorkspaceId);

        // Fast path: Check for existing session first
        const { checkAndRestoreWorkspaceSession } = useSubtitleEditStore.getState();
        const existingSessionId = await checkAndRestoreWorkspaceSession(currentWorkspaceId);

        if (existingSessionId) {
          console.log('🔄 Auto-restored workspace session:', existingSessionId);
          return;
        }

        // Check localStorage for session recovery (optimized)
        const persistedState: any = JSON.parse(localStorage.getItem('subtitle-edit-store') || '{}');
        const sessionInfo = persistedState.state?.session;

        if (sessionInfo?.workspaceId === currentWorkspaceId) {
          // Same workspace - attempt automatic restoration
          const hasPersistedSession = await restorePersistedSession();
          if (hasPersistedSession) {
            console.log('✅ Auto-restored persisted session for workspace');
            return;
          }
        } else if (sessionInfo?.workspaceId && sessionInfo.workspaceId !== currentWorkspaceId) {
          // Different workspace - show recovery dialog
          setSessionRecoveryInfo({
            lastModified: new Date(sessionInfo.lastModified).getTime(),
            subtitleCount: sessionInfo.subtitleCount || 0,
            editCount: sessionInfo.editCount || 0,
            workspaceId: sessionInfo.workspaceId,
          });
          setShowSessionRecovery(true);
          return;
        }

        // Final check: IndexedDB recoverable sessions (least priority)
        const hasRecoverable = await checkForRecoverableSession(currentWorkspaceId);
        if (hasRecoverable && sessionRecovery.recoverableSessionId) {
          const sessionDetails = sessionRecovery.sessionDetails;
          setSessionRecoveryInfo({
            lastModified: sessionDetails?.lastModified || Date.now() - 300000,
            subtitleCount: sessionDetails?.subtitleCount || 0,
            editCount: sessionDetails?.editCount || 0,
            workspaceId: currentWorkspaceId,
          });
          setShowSessionRecovery(true);
        }
      } catch (error) {
        console.error('❌ Session recovery check failed:', error);
      }
    }, 250); // Increased debounce for better performance

    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, [
    isReady,
    currentWorkspaceId,
    enablePersistence,
    checkForRecoverableSession,
    restorePersistedSession,
    sessionRecovery.recoverableSessionId
  ]);

  // REMOVED: Automatic session initialization on config changes
  // Session initialization now only happens on explicit user actions
  // This prevents unwanted session resets during step navigation

  // Load subtitle files when component mounts
  useEffect(() => {
    if (isReady) {
      loadSubtitleFiles();
    }
  }, [isReady, loadSubtitleFiles]);

  // Handle errors (including file errors)
  useEffect(() => {
    if (lastError || error || fileError) {
      setShowErrorNotification(true);
    }
  }, [lastError, error, fileError]);

  // PERFORMANCE-OPTIMIZED: Simplified manual save system (auto-save disabled)
  const lastManualSaveRef = useRef<number>(0);
  
  useEffect(() => {
    // Clear any existing save interval
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
    }

    // Only set up save for dirty sessions
    if (!isReady || !session?.isDirty || !currentWorkspaceId) {
      return;
    }

    // Set up interval-based save (much more performance-friendly than effect dependencies)
    saveIntervalRef.current = setInterval(async () => {
      const currentState = get(); // Get fresh state
      if (!currentState.session?.isDirty || !currentWorkspaceId) {
        return;
      }

      const now = Date.now();
      const timeSinceLastSave = now - lastManualSaveRef.current;
      const MIN_SAVE_INTERVAL = 45000; // 45 seconds to prevent UI blocking
      
      if (timeSinceLastSave > MIN_SAVE_INTERVAL) {
        try {
          // Use only the most stable save method from store actions
          await currentState.saveSessionToTempStorage();
          lastManualSaveRef.current = now;
          console.log('💾 Interval save completed');
        } catch (error) {
          console.warn('⚠️ Interval save failed:', error);
        }
      }
    }, 60000); // Check every 60 seconds

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [
    // MINIMAL DEPENDENCIES: Only essential state for save setup
    session?.sessionId, // Track session changes, not dirty state
    isReady,
    currentWorkspaceId
  ]);

  // Show loading state while workspace is initializing
  if (!isReady || isLoadingFiles) {
    return (
      <Box
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <LinearProgress sx={{ width: '100%', maxWidth: 400, mb: 2 }} />
        <Typography variant='body2' color='text.secondary'>
          {!isReady ? 'Loading review configuration...' : 'Loading subtitle files...'}
        </Typography>
        {isLoadingFiles && (
          <Typography variant='caption' color='text.secondary' sx={{ mt: 1 }}>
            Restoring subtitle session and validating files...
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
          {/* REMOVED: SubtitleAutoSaveIndicator - auto-save UI components deleted */}

          {/* DISABLED FOR PERFORMANCE: Enhanced Auto-Save Status */}
          {/* Auto-save UI indicators disabled to reduce re-renders */}
          {/*
        {autoSaveIntegration.isAutoSaving && (
          <Box sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Chip
              icon={<Save />}
              label="Enhanced Auto-saving..."
              size="small"
              color="primary"
              variant="filled"
              sx={{ backgroundColor: 'rgba(25, 118, 210, 0.9)' }}
            />
          </Box>
        )}
        */}

          {/* Legacy Status Indicators (fallback) */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 200, // Offset to avoid collision with new indicator
              zIndex: 9,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {(isAutoSaving || isSavingFiles) && (
              <Chip
                icon={<Save />}
                label={isSavingFiles ? 'Saving files...' : 'Auto-saving...'}
                size='small'
                color='primary'
                variant='filled'
                sx={{ backgroundColor: 'rgba(25, 118, 210, 0.9)' }}
              />
            )}
            {autoSaveStatus.lastSaveTime && !isAutoSaving && !isSavingFiles && (
              <Chip
                icon={<CheckCircle />}
                label='Saved'
                size='small'
                color='success'
                variant='filled'
                sx={{ backgroundColor: 'rgba(46, 125, 50, 0.9)' }}
              />
            )}
            {(lastError || error || fileError) && (
              <Chip
                icon={<ErrorIcon />}
                label={fileError ? 'File error' : 'Save error'}
                size='small'
                color='error'
                variant='filled'
                sx={{ backgroundColor: 'rgba(211, 47, 47, 0.9)' }}
              />
            )}
          </Box>

          {/* Configuration Loading State */}
          {configLoading && (
            <Alert severity='info' sx={{ m: 2, zIndex: 5 }}>
              Loading review configuration...
            </Alert>
          )}

          {/* Configuration Error State */}
          {error && (
            <Alert severity='error' sx={{ m: 2, zIndex: 5 }} onClose={() => clearError()}>
              Failed to load configuration: {error.message}
            </Alert>
          )}

          {/* File Operation Error State */}
          {fileError && (
            <Alert severity='error' sx={{ m: 2, zIndex: 5 }} onClose={() => clearFileError()}>
              Subtitle file error: {fileError.message}
              {fileError.recovery && (
                <Typography variant='caption' display='block' sx={{ mt: 1 }}>
                  Suggestion: {fileError.recovery.description}
                </Typography>
              )}
            </Alert>
          )}
          {/* Video Preview Section - increased to ~50% of height */}
          <Box
            sx={{
              flex: '0 0 40%',
              minHeight: '380px', // Increased for better video viewing
              p: 2,
              borderBottom: '1px solid rgba(64, 68, 75, 0.3)',
              backgroundColor: '#202225',
              position: 'relative',
              zIndex: 1,
              overflow: 'hidden',
            }}
          >
            <VideoPreviewSection />
          </Box>

          {/* Two-column layout - drastically reduced to ~50% for button visibility */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              flex: '1 1 60%', // Drastically reduced to ensure Add button is fully visible
              maxHeight: '60vh', // Much smaller height to prevent overflow
              overflow: 'hidden',
              p: 2,
              position: 'relative',
              zIndex: 0,
            }}
          >
            {/* Left Column - Generated Subtitles with Diff */}
            <Box
              sx={{
                minHeight: 0,
                maxHeight: '90%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <SubtitleListPanel />
            </Box>

            {/* Right Column - Edit Panel */}
            <Box
              sx={{
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <SubtitleEditor />
            </Box>
          </Box>
        </Box>

      {/* Session Recovery Dialog */}
      <SessionRecoveryDialog
        open={showSessionRecovery}
        sessionId={sessionRecovery.recoverableSessionId}
        sessionInfo={sessionRecoveryInfo}
        onRecover={async (sessionId) => {
          try {
            console.log('🔄 Starting session recovery for sessionId:', sessionId);

            // Check if this session belongs to current workspace
            const { checkAndRestoreWorkspaceSession, loadSession } =
              useSubtitleEditStore.getState();
            const currentWorkspaceSessionId = checkAndRestoreWorkspaceSession(currentWorkspaceId);

            if (currentWorkspaceSessionId && currentWorkspaceSessionId === sessionId) {
              console.log(
                '✅ Session belongs to current workspace, using existing session directly'
              );

              // Load the existing session from persisted state
              const persistedState: any = JSON.parse(
                localStorage.getItem('subtitle-edit-store') || '{}'
              );
              if (
                persistedState.state?.session &&
                persistedState.state.session.sessionId === sessionId
              ) {
                const sessionInfo = persistedState.state.session;

                // Reconstruct the full session object with workspaceId
                const restoredSession: TempSubtitleSession = {
                  sessionId: sessionInfo.sessionId,
                  workspaceId: sessionInfo.workspaceId || currentWorkspaceId, // Ensure workspace binding
                  originalPath: sessionInfo.originalPath,
                  tempPath: sessionInfo.tempPath,
                  videoPath: sessionInfo.videoPath,
                  originalSubtitles: sessionInfo.originalSubtitles || [],
                  currentSubtitles: sessionInfo.currentSubtitles || [],
                  modifications: sessionInfo.modifications || [],
                  lastModified: new Date(sessionInfo.lastModified),
                  isDirty: sessionInfo.isDirty || false,
                  currentTime: sessionInfo.currentTime || 0,
                  selectedSubtitleId: sessionInfo.selectedSubtitleId || null,
                  isVideoPlaying: sessionInfo.isVideoPlaying || false,
                  shouldAutoPause: sessionInfo.shouldAutoPause || false,
                  videoDuration: sessionInfo.videoDuration || 0,
                };

                // Load the existing session directly instead of creating new one
                loadSession(restoredSession);
                console.log('✅ Existing workspace session restored successfully');
                return true;
              }
            }

            // Try IndexedDB recovery for non-current workspace sessions
            let success = await recoverSession(sessionId);

            // DISABLED FOR PERFORMANCE: Auto-save integration recovery
            /*
          if (!success && autoSaveIntegration.hasRecoverableSession) {
            try {
              await autoSaveIntegration.recoverSession(sessionId)
              success = true
            } catch (error) {
              console.warn('Auto-save integration recovery failed:', error)
            }
          }
          */

            if (!success) {
              console.log('⚠️ IndexedDB recovery failed, falling back to localStorage restoration');
              // If IndexedDB recovery fails, try to restore from localStorage persistence
              const persistedState: any = JSON.parse(
                localStorage.getItem('subtitle-edit-store') || '{}'
              );

              if (
                persistedState.state?.session &&
                persistedState.state.session.sessionId === sessionId
              ) {
                const sessionInfo = persistedState.state.session;

                // Only create new session if it's from a different workspace or no current session exists
                if (sessionInfo.videoPath && sessionInfo.originalPath) {
                  await stableInitializeSession(sessionInfo.originalPath, sessionInfo.videoPath);

                  // Restore session state
                  if (session) {
                    session.currentTime = sessionInfo.currentTime || 0;
                    session.selectedSubtitleId = sessionInfo.selectedSubtitleId;
                    session.videoDuration = sessionInfo.videoDuration || 0;
                    session.isDirty = sessionInfo.isDirty;
                  }

                  success = true;
                  console.log('✅ Session recovered from localStorage with new initialization');
                }
              }
            }

            if (success) {
              setShowSessionRecovery(false);

              // Clear the recovery flag to prevent re-triggering
              // Note: This will be handled by the store's internal logic

              return true;
            }

            return false;
          } catch (error) {
            console.error('Failed to recover session:', error);
            return false;
          }
        }}
        onDiscard={() => {
          setShowSessionRecovery(false);

          // Clear persisted session data to prevent re-triggering
          try {
            const persistedState: any = JSON.parse(
              localStorage.getItem('subtitle-edit-store') || '{}'
            );
            if (persistedState.state) {
              persistedState.state.session = null;
              persistedState.state.sessionRecovery = {
                hasRecoverableSession: false,
                recoverableSessionId: null,
                lastSessionWorkspaceId: null,
              };
              localStorage.setItem('subtitle-edit-store', JSON.stringify(persistedState));
            }
          } catch (error) {
            console.warn('Failed to clear persisted session:', error);
          }

          // Continue with normal initialization
        }}
        onClose={() => setShowSessionRecovery(false)}
      />

      {/* Error Notification */}
      <Snackbar
        open={showErrorNotification}
        autoHideDuration={6000}
        onClose={() => {
          setShowErrorNotification(false);
          clearError();
          if (fileError) clearFileError();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => {
            setShowErrorNotification(false);
            clearError();
            if (fileError) clearFileError();
          }}
          severity='error'
          variant='filled'
        >
          {fileError?.message ||
            lastError?.message ||
            error?.message ||
            'Failed to save subtitle session'}
          {fileError?.recovery && (
            <Typography variant='caption' display='block' sx={{ mt: 1 }}>
              Recovery: {fileError.recovery.description}
            </Typography>
          )}
        </Alert>
      </Snackbar>
    </>
  );
};

// PERFORMANCE: Memoized component to prevent unnecessary re-renders during JSON import
const MemoizedReviewStepComponent = React.memo(ReviewStepComponent, (prevProps, nextProps) => {
  // CRITICAL: Custom comparison function - no props to compare, prevent unnecessary re-renders
  // This stops React from re-rendering during rapid JSON import state changes
  return true;
});

// Error boundary wrapper for additional stability
const ReviewStepWithErrorBoundary: React.FC = () => (
  <ProcessingErrorBoundary processingStep="review" enableEngineRecovery={true}>
    <MemoizedReviewStepComponent />
  </ProcessingErrorBoundary>
);

export const ReviewStep = React.memo(ReviewStepWithErrorBoundary);
