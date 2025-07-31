import React, { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { Box, Alert, Snackbar, LinearProgress, Typography, Chip } from "@mui/material";
import { CheckCircle, Save, Error as ErrorIcon } from '@mui/icons-material'
import { useAppStore } from "../../stores/app-store";
import { useSubtitleEditStore } from "../../stores/subtitle-edit-store";
import { useReviewStepConfig, useWorkspaceConfig } from '../../contexts/WorkspaceConfigContext';
import { VideoPreviewSection } from "./ReviewStep/VideoPreviewSection";
import { SubtitleEditor } from "./ReviewStep/SubtitleEditor";
import { SubtitleListPanel } from "./ReviewStep/SubtitleListPanel";
import { ProcessingErrorBoundary } from "../common/ProcessingErrorBoundary";
import { SubtitleAutoSaveIndicator } from "../common/SubtitleAutoSaveIndicator";
import { pulseKeyframes } from "./ReviewStep/styles";
import { PerformanceMonitor, debounce } from "../../utils/performance-utils";
import { transformSubtitleData } from "../../utils/subtitle-transformation";
import type { SubtitleFileContent } from "../../types/subtitle-persistence";
import type { SubtitleEntry } from "../../types/subtitle";

export const ReviewStep: React.FC = () => {
  const { config } = useAppStore();
  const { initializeSession, clearSession, session, isLoading } = useSubtitleEditStore();
  const reviewStepResult = useReviewStepConfig()
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
    clearFileError
  } = reviewStepResult
  const { autoSaveStatus, isAutoSaving, lastError, clearError } = useWorkspaceConfig()
  const [showAutoSaveNotification, setShowAutoSaveNotification] = useState(false)
  const [showErrorNotification, setShowErrorNotification] = useState(false)
  const [subtitleFiles, setSubtitleFiles] = useState<Record<string, SubtitleFileContent>>({})
  const [originalFileId, setOriginalFileId] = useState<string | null>(null)
  const [modifiedFileId, setModifiedFileId] = useState<string | null>(null)

  // Inject CSS animation
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = pulseKeyframes;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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

  // Performance monitor instance
  const performanceMonitor = PerformanceMonitor.getInstance();

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
          const originalFile = Object.entries(files).find(([_, content]) => 
            content.metadata && content.metadata.fileType === 'original'
          );
          const modifiedFile = Object.entries(files).find(([_, content]) => 
            content.metadata && content.metadata.fileType === 'modified'  
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
          schemaVersion: 1
        },
        subtitles: session.currentSubtitles.map(subtitle => ({
          id: subtitle.id,
          index: subtitle.index,
          startTime: subtitle.startTime,
          endTime: subtitle.endTime,
          text: subtitle.text,
          originalText: subtitle.originalText,
          confidence: subtitle.confidence,
          speaker: subtitle.speaker,
          music: subtitle.isMusic || false
        })),
        statistics: {
          totalSubtitles: session.currentSubtitles.length,
          totalDuration: session.totalDuration || 0,
          wordCount: session.currentSubtitles.reduce((count, sub) => 
            count + (sub.text?.split(' ').length || 0), 0),
          characterCount: session.currentSubtitles.reduce((count, sub) => 
            count + (sub.text?.length || 0), 0),
          translationCoverage: session.currentSubtitles.filter(sub => 
            sub.originalText && sub.originalText.trim()).length / session.currentSubtitles.length,
          averageConfidence: session.currentSubtitles.reduce((sum, sub) => 
            sum + (sub.confidence || 0), 0) / session.currentSubtitles.length,
          speakerDistribution: {},
          musicSegments: session.currentSubtitles.filter(sub => sub.isMusic).length,
          qualityDistribution: {
            high: session.currentSubtitles.filter(sub => (sub.confidence || 0) > 0.8).length,
            medium: session.currentSubtitles.filter(sub => 
              (sub.confidence || 0) >= 0.5 && (sub.confidence || 0) <= 0.8).length,
            low: session.currentSubtitles.filter(sub => (sub.confidence || 0) < 0.5).length
          },
          timingStats: {
            averageDuration: session.currentSubtitles.reduce((sum, sub) => 
              sum + (sub.duration || 0), 0) / session.currentSubtitles.length,
            minDuration: Math.min(...session.currentSubtitles.map(sub => sub.duration || 0)),
            maxDuration: Math.max(...session.currentSubtitles.map(sub => sub.duration || 0)),
            gapCount: 0, // TODO: Calculate gaps
            overlapCount: 0 // TODO: Calculate overlaps
          }
        },
        editHistory: session.modifications.map(mod => ({
          id: mod.id,
          timestamp: Date.parse(mod.timestamp),
          operation: mod.type === 'added' ? 'create' : 
                   mod.type === 'deleted' ? 'delete' : 
                   mod.type === 'modified' ? 'update' : 'update',
          subtitleId: parseInt(mod.subtitleId) || 0,
          field: 'text',
          previousValue: mod.original,
          newValue: mod.modified,
          source: 'user',
          context: {
            reason: mod.description
          }
        })),
        validation: {
          isValid: true,
          warnings: [],
          errors: [],
          qualityScore: 0.8 // TODO: Calculate quality score
        }
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
            hasChanges: session.isDirty
          },
          sessionBackups: [],
          autoSave: {
            enabled: reviewConfig?.editingPreferences?.autoSave !== false,
            interval: reviewConfig?.editingPreferences?.autoSaveConfig?.interval || 30000,
            lastSave: Date.now(),
            backupCount: 1
          },
          operationHistory: [],
          cacheStatus: {
            isCached: true,
            lastCacheUpdate: Date.now()
          },
          performance: {
            lastOperationTime: Date.now(),
            averageOperationTime: 1000,
            totalOperations: 1,
            errorCount: 0
          }
        },
        lastModified: Date.now()
      });

    } catch (error) {
      console.error('Failed to save subtitle session:', error);
    }
  }, [session, isReady, modifiedFileId, saveSubtitleFile, createSubtitleFile, updateReviewConfig, reviewConfig, persistenceData]);

  // Stable initialization function with useCallback and performance monitoring
  const stableInitializeSession = useCallback(async (subtitlePath: string, videoPath: string, importedData?: any[]) => {
    const operationName = importedData ? 'JSON Import Session Init' : 'SRT Session Init';
    performanceMonitor.startOperation(operationName);
    
    try {
      console.log("🔄 Initializing subtitle editing session:", {
        subtitlePath,
        videoPath,
        hasImportedData: !!importedData,
        dataCount: importedData?.length || 0
      });

      // Clear existing session first to prevent conflicts
      clearSession();

      if (importedData) {
        // Transform data using optimized utility
        const transformedData = await transformSubtitleData(importedData, {
          useCache: true,
          forceSync: importedData.length < 20 // Use sync for small datasets
        });
        
        // Pass pre-transformed data to store
        await initializeSession(subtitlePath, videoPath, transformedData, true);
      } else {
        // For regular SRT files
        await initializeSession(subtitlePath, videoPath);
      }
      
      performanceMonitor.endOperation(operationName, importedData?.length);
    } catch (error) {
      console.error("Failed to initialize subtitle editing session:", error);
      performanceMonitor.endOperation(`${operationName} (ERROR)`, importedData?.length);
    }
  }, [initializeSession, clearSession, performanceMonitor]);

  // Memoized subtitle data preparation to prevent unnecessary recalculations
  const preparedSubtitleData = useMemo(() => {
    if (!config.inputFile || !Array.isArray(config.subtitle) || config.subtitle?.length === 0) {
      return null;
    }

    // Return raw data - let the transformation utility handle the optimization
    return config.subtitle;
  }, [config.inputFile, config.subtitle]);

  // Initialize session when component mounts and data is available
  useEffect(() => {
    if (isLoading) return; // Don't initialize while loading

    const currentData = {
      inputFile: config.inputFile,
      outputFile: config.outputFile,
      subtitleCount: preparedSubtitleData?.length || 0,
      videoPath: session?.videoPath || null,
      originalPath: session?.originalPath || null,
    };

    // Check if data has actually changed to prevent unnecessary re-initialization
    const dataChanged = 
      lastInitDataRef.current.inputFile !== currentData.inputFile ||
      lastInitDataRef.current.outputFile !== currentData.outputFile ||
      lastInitDataRef.current.subtitleCount !== currentData.subtitleCount ||
      lastInitDataRef.current.videoPath !== currentData.videoPath ||
      lastInitDataRef.current.originalPath !== currentData.originalPath;

    if (!dataChanged) {
      return; // No change, skip initialization
    }

    // Update reference for future comparisons
    lastInitDataRef.current = currentData;

    // Initialize based on available data
    if (preparedSubtitleData) {
      // JSON subtitles imported - pass raw data to optimized transformation
      stableInitializeSession('imported-subtitles.json', config.inputFile, preparedSubtitleData);
    } else if (config.inputFile && config.outputFile) {
      // Regular SRT file from processing
      const srtPath = config.outputFile.replace(/\.[^/.]+$/, ".srt");
      stableInitializeSession(srtPath, config.inputFile);
    }
  }, [
    config.inputFile,
    config.outputFile,
    preparedSubtitleData,
    isLoading,
    stableInitializeSession
  ]);

  // Load subtitle files when component mounts
  useEffect(() => {
    if (isReady) {
      loadSubtitleFiles();
    }
  }, [isReady, loadSubtitleFiles]);

  // Handle auto-save status changes
  useEffect(() => {
    if (autoSaveStatus.lastSaveTime && !isAutoSaving) {
      setShowAutoSaveNotification(true)
    }
  }, [autoSaveStatus.lastSaveTime, isAutoSaving])

  // Handle errors (including file errors)
  useEffect(() => {
    if (lastError || error || fileError) {
      setShowErrorNotification(true)
    }
  }, [lastError, error, fileError])

  // Save subtitle session state to workspace when it changes (debounced)
  useEffect(() => {
    if (isReady && session && session.isDirty) {
      const timeoutId = setTimeout(() => {
        saveSubtitleSession();
      }, 2000); // Debounce saves by 2 seconds
      
      return () => clearTimeout(timeoutId);
    }
  }, [session?.isDirty, session?.lastModified, isReady, saveSubtitleSession]);

  // Show loading state while workspace is initializing
  if (!isReady || isLoadingFiles) {
    return (
      <Box sx={{ 
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <LinearProgress sx={{ width: '100%', maxWidth: 400, mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          {!isReady ? 'Loading review configuration...' : 'Loading subtitle files...'}
        </Typography>
        {isLoadingFiles && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Restoring subtitle session and validating files...
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <>
    <ProcessingErrorBoundary processingStep="review" enableEngineRecovery={true}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Enhanced Auto-save Status Indicator with Subtitle Persistence */}
        <SubtitleAutoSaveIndicator
          persistenceData={persistenceData}
          position="top-right"
          showDetails={true}
          showPerformance={false}
          compact={false}
        />
        
        {/* Legacy Status Indicators (fallback) */}
        <Box sx={{ 
          position: 'absolute',
          top: 8,
          right: 200, // Offset to avoid collision with new indicator
          zIndex: 9,
          display: 'flex', 
          alignItems: 'center', 
          gap: 1
        }}>
          {(isAutoSaving || isSavingFiles) && (
            <Chip
              icon={<Save />}
              label={isSavingFiles ? "Saving files..." : "Auto-saving..."}
              size="small"
              color="primary"
              variant="filled"
              sx={{ backgroundColor: 'rgba(25, 118, 210, 0.9)' }}
            />
          )}
          {(autoSaveStatus.lastSaveTime && !isAutoSaving && !isSavingFiles) && (
            <Chip
              icon={<CheckCircle />}
              label="Saved"
              size="small"
              color="success"
              variant="filled"
              sx={{ backgroundColor: 'rgba(46, 125, 50, 0.9)' }}
            />
          )}
          {(lastError || error || fileError) && (
            <Chip
              icon={<ErrorIcon />}
              label={fileError ? "File error" : "Save error"}
              size="small"
              color="error"
              variant="filled"
              sx={{ backgroundColor: 'rgba(211, 47, 47, 0.9)' }}
            />
          )}
        </Box>

        {/* Configuration Loading State */}
        {configLoading && (
          <Alert severity="info" sx={{ m: 2, zIndex: 5 }}>
            Loading review configuration...
          </Alert>
        )}

        {/* Configuration Error State */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ m: 2, zIndex: 5 }}
            onClose={() => clearError()}
          >
            Failed to load configuration: {error.message}
          </Alert>
        )}
        
        {/* File Operation Error State */}
        {fileError && (
          <Alert 
            severity="error" 
            sx={{ m: 2, zIndex: 5 }}
            onClose={() => clearFileError()}
          >
            Subtitle file error: {fileError.message}
            {fileError.recovery && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Suggestion: {fileError.recovery.description}
              </Typography>
            )}
          </Alert>
        )}
        {/* Video Preview Section - increased to ~50% of height */}
        <Box
          sx={{
            flex: "0 0 40%",
            minHeight: "380px", // Increased for better video viewing
            p: 2,
            borderBottom: "1px solid rgba(64, 68, 75, 0.3)",
            backgroundColor: "#202225",
            position: "relative",
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          <VideoPreviewSection />
        </Box>

        {/* Two-column layout - drastically reduced to ~50% for button visibility */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 2,
            flex: "1 1 60%", // Drastically reduced to ensure Add button is fully visible
            maxHeight: "60vh", // Much smaller height to prevent overflow
            overflow: "hidden",
            p: 2,
            position: "relative",
            zIndex: 0,
          }}
        >
          {/* Left Column - Generated Subtitles with Diff */}
          <Box
            sx={{
              minHeight: 0,
              maxHeight: "90%",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <SubtitleListPanel />
          </Box>

          {/* Right Column - Edit Panel */}
          <Box
            sx={{
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <SubtitleEditor />
          </Box>
        </Box>
      </Box>
    </ProcessingErrorBoundary>

    {/* Auto-save Success Notification */}
    <Snackbar
      open={showAutoSaveNotification}
      autoHideDuration={3000}
      onClose={() => setShowAutoSaveNotification(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={() => setShowAutoSaveNotification(false)} 
        severity="success"
        variant="filled"
      >
        Subtitle session saved automatically
      </Alert>
    </Snackbar>

    {/* Error Notification */}
    <Snackbar
      open={showErrorNotification}
      autoHideDuration={6000}
      onClose={() => {
        setShowErrorNotification(false)
        clearError()
        if (fileError) clearFileError()
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={() => {
          setShowErrorNotification(false)
          clearError()
          if (fileError) clearFileError()
        }} 
        severity="error"
        variant="filled"
      >
        {fileError?.message || lastError?.message || error?.message || 'Failed to save subtitle session'}
        {fileError?.recovery && (
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Recovery: {fileError.recovery.description}
          </Typography>
        )}
      </Alert>
    </Snackbar>
  </>
  );
};