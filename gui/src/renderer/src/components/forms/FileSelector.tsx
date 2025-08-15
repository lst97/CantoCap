import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Clear as ClearIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  Edit as EditIcon,
  AccessTime as TimeIcon,
  Folder as FolderIcon,
  ImportExport as ImportIcon,
  Attachment as AttachmentIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useInputStepContent, useStepActions } from '../../stores/useStepStore';
import { useSubtitleActions } from '../../stores/useSubtitleEditStore';
import { useWorkflowActions } from '../../stores/useWorkflowStore';
import { useActiveWorkspaceId } from '../../stores/useAppStore';
import { StepStatus, StepType } from '../../stores/types/StoreTypes';

interface ImportedSubtitle {
  id?: string;
  start?: number;
  startTime?: number;
  end?: number;
  endTime?: number;
  text?: string;
  caption?: string;
  translation?: string;
  speaker?: string | null;
  confidence?: number;
  isMusic?: boolean;
  [key: string]: unknown; // Allow additional properties from backend
}

// Extended File interface for Electron drag-and-drop
interface ExtendedFile extends File {
  path?: string;
}

interface FileSelectorProps {
  onFileRemoved?: () => void;
  initialFile?: string | null;
  initialJsonFile?: string | null;
  onFileSelect?: (file: string) => void;
  onJsonFileSelect?: (file: string | null) => void;
}

// Comprehensive cleanup utility for file removal operations
interface CleanupOptions {
  clearInputFile?: boolean;
  clearJsonFile?: boolean;
  resetWorkflow?: boolean;
  targetStep?: 'input' | 'config';
  preserveMediaWorkflow?: boolean;
}

interface SubtitleActionsType {
  clearWorkspace: () => void;
}

const createComprehensiveCleanup = (
  activeWorkspaceId: string | null,
  updateStepContent: <T>(
    step: StepType,
    content: Partial<T>,
    workspaceId?: string
  ) => Promise<void>,
  setStepState: (step: StepType, status: StepStatus) => Promise<void>,
  navigateToStep: (step: StepType) => Promise<void>,
  useSubtitleActions: () => SubtitleActionsType
) => {
  return async (options: CleanupOptions) => {
    console.log('🧹 Starting comprehensive cleanup with options:', options);

    try {
      // Phase 1: Clear step content based on options
      const stepUpdates: Record<string, unknown> = { lastModified: Date.now() };

      if (options.clearInputFile) {
        stepUpdates.inputFile = null;
        stepUpdates.selectedFile = null;
      }

      if (options.clearJsonFile) {
        stepUpdates.importedJsonFile = null;
      }

      if (Object.keys(stepUpdates).length > 1) {
        // More than just lastModified
        await updateStepContent('input', stepUpdates);

        // Note: Workflow navigation permissions will be updated automatically through state changes
        console.log('✅ Step content cleared:', Object.keys(stepUpdates));
      }

      // Phase 2: Clear subtitle workspace and backend store
      if (activeWorkspaceId && (options.clearInputFile || options.clearJsonFile)) {
        console.log('🗄️ Clearing subtitle workspace and backend store');
        try {
          // Clear subtitle editing store (frontend)
          const { clearWorkspace } = useSubtitleActions();
          clearWorkspace();

          // Clear backend subtitle workspace persistence
          await window.cantocapAPI.subtitleWorkspaceDelete(activeWorkspaceId);

          // Clear step sync data
          await window.cantocapAPI.subtitleSyncToStep(activeWorkspaceId, []);

          console.log('✅ Subtitle workspace and backend store cleared');
        } catch (workspaceError) {
          console.warn('⚠️ Failed to clear subtitle workspace:', workspaceError);
        }
      }

      // Phase 2.5: Reset processing, review, and export step content when clearing input file
      if (options.clearInputFile) {
        console.log('🔄 Resetting processing, review, and export step content');
        try {
          // Reset processing step - clear completed status and all data
          await updateStepContent('processing', {
            status: 'idle',
            progress: 0,
            currentPhase: undefined,
            logs: [],
            startTime: undefined,
            endTime: undefined,
            outputFile: undefined,
            jsonSubtitleData: undefined,
            convertedSubtitles: undefined,
            statistics: undefined,
            timeElapsed: undefined,
            estimatedTimeRemaining: undefined,
            hardwareInfo: undefined
          });

          // Reset review step - clear all subtitle data
          await updateStepContent('review', {
            subtitles: [],
            jsonSubtitleData: undefined,
            hasJsonData: false,
            processingStatistics: undefined,
            processingCompleted: false,
            lastProcessedAt: undefined,
            currentEdit: undefined,
            playbackPosition: 0,
            selectedSubtitleIndex: undefined,
            searchQuery: undefined,
            filteredSubtitles: [],
            hasUnsavedChanges: false,
            inputFile: undefined
          });

          // Reset export step - clear export history and state  
          await updateStepContent('export', {
            exportHistory: [],
            lastExported: undefined,
            actionsState: { 
              isExporting: false, 
              exportProgress: 0,
              exportError: undefined 
            },
            previewState: {
              isPreviewReady: false,
              previewContent: '',
              lastPreviewGenerated: undefined
            }
          });

          console.log('✅ Processing, review, and export step content reset');
        } catch (stepResetError) {
          console.warn('⚠️ Failed to reset step content:', stepResetError);
        }
      }

      // Phase 3: Reset workflow state based on options
      if (options.resetWorkflow) {
        console.log('🔄 Resetting workflow state');
        try {
          if (options.preserveMediaWorkflow && !options.clearInputFile) {
            // Media file exists, reset to allow re-processing from config
            await setStepState('input', StepStatus.COMPLETE); // Keep input complete
            await setStepState('config', StepStatus.READY); // Config ready
            await setStepState('processing', StepStatus.BLOCK); // Processing blocked
            await setStepState('review', StepStatus.BLOCK); // Review blocked
            await setStepState('export', StepStatus.BLOCK); // Export blocked
          } else {
            // Full reset to initial state
            await setStepState('input', StepStatus.READY); // Step 1 ready
            await setStepState('config', StepStatus.BLOCK); // Step 2 blocked
            await setStepState('processing', StepStatus.BLOCK); // Step 3 blocked
            await setStepState('review', StepStatus.BLOCK); // Step 4 blocked
            await setStepState('export', StepStatus.BLOCK); // Step 5 blocked
          }

          // Navigate to target step
          const targetStep = options.targetStep || 'input';
          await navigateToStep(targetStep);

          console.log(`✅ Workflow state reset, navigated to ${targetStep}`);
        } catch (workflowError) {
          console.error('❌ Failed to reset workflow state:', workflowError);
        }
      }

      console.log('✅ Comprehensive cleanup completed successfully');
    } catch (error) {
      console.error('❌ Comprehensive cleanup failed:', error);
      throw error;
    }
  };
};

export const FileSelector: React.FC<FileSelectorProps> = ({
  onFileRemoved,
  initialFile,
  initialJsonFile,
  onFileSelect,
  onJsonFileSelect,
}) => {
  // Use centralized stores as the single source of truth for component state
  const inputStep = useInputStepContent();
  const { updateStepContent } = useStepActions();

  // Subtitle editing and workflow management
  const subtitleActions = useSubtitleActions();
  const { importFromJson, exportToStep } = subtitleActions;
  const { setStepState, navigateToStep } = useWorkflowActions();
  const activeWorkspaceId = useActiveWorkspaceId();

  // Optimized debug effect - only log on significant changes, not every render
  useEffect(() => {
    // Only log if there are actual differences or changes
    const hasSignificantChanges =
      initialFile !== (inputStep.inputFile || inputStep.selectedFile) ||
      initialJsonFile !== inputStep.importedJsonFile;

    if (hasSignificantChanges) {
      console.log('🔧 [VIDEO DEBUG] FileSelector State Change:', {
        timestamp: new Date().toISOString(),
        props: { initialFile, initialJsonFile },
        storeConfig: {
          inputFile: inputStep.inputFile,
          importedJsonFile: inputStep.importedJsonFile,
        },
        hasFileInStore: !!(inputStep.inputFile || inputStep.selectedFile),
        propsVsStore: {
          inputFileMatch: initialFile === (inputStep.inputFile || inputStep.selectedFile),
          jsonFileMatch: initialJsonFile === inputStep.importedJsonFile,
        },
      });
    }
  }, [
    initialFile,
    initialJsonFile,
    inputStep.inputFile,
    inputStep.importedJsonFile,
    inputStep.selectedFile,
  ]);

  // Modern workflow navigation using WorkflowStateManager directly
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration?: string;
    size?: string;
    resolution?: string;
  } | null>(null);
  const [metadataGenerationFailed, setMetadataGenerationFailed] = useState<boolean>(false);
  const [isImportingJson, setIsImportingJson] = useState(false);

  // Function to generate video thumbnail and metadata using main process
  const generateVideoMetadata = useCallback(async (filePath: string) => {
    setIsGeneratingMetadata(true);
    try {
      console.log('🎬 Processing video metadata using main process for:', filePath);

      // Use the new IPC-based video processing
      const result = await window.cantocapAPI.getVideoMetadata(filePath);

      if (result.error) {
        console.warn('Error processing video metadata:', result.error);
        setMetadataGenerationFailed(true);
        return;
      }

      // Set thumbnail if available
      if (result.thumbnail) {
        setVideoThumbnail(result.thumbnail);
        console.log('✅ Video thumbnail generated successfully');
      }

      // Set metadata if available
      if (result.metadata) {
        // Format duration from seconds to mm:ss format
        const formatDuration = (seconds: number) => {
          if (!isFinite(seconds) || seconds < 0) return '0:00';
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Format file size
        const formatFileSize = (bytes: number) => {
          if (bytes === 0) return 'Unknown';
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(1024));
          return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
        };

        setVideoMetadata({
          duration: formatDuration(result.metadata.duration),
          resolution: `${result.metadata.width}×${result.metadata.height}`,
          size: formatFileSize(result.metadata.size),
        });

        console.log('✅ Video metadata processed successfully:', {
          duration: result.metadata.duration,
          resolution: `${result.metadata.width}×${result.metadata.height}`,
          format: result.metadata.format,
        });
      }
    } catch (error) {
      console.warn('Error in generateVideoMetadata:', error);
      setMetadataGenerationFailed(true);
    } finally {
      setIsGeneratingMetadata(false);
    }
  }, []);

  // React 19 Optimization: Memoize video extensions to prevent recreation
  const videoExtensions = useMemo(() => ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'], []);

  // Regenerate video metadata when component mounts with existing file
  useEffect(() => {
    const regenerateMetadata = async () => {
      if (
        inputStep.inputFile &&
        !videoMetadata &&
        !videoThumbnail &&
        !isLoading &&
        !isGeneratingMetadata &&
        !metadataGenerationFailed
      ) {
        const ext = inputStep.inputFile.split('.').pop()?.toLowerCase();
        if (videoExtensions.includes(ext || '')) {
          console.log('Regenerating video metadata for:', inputStep.inputFile);
          await generateVideoMetadata(inputStep.inputFile);
        }
      }
    };

    regenerateMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputStep.inputFile,
    // Remove videoMetadata and videoThumbnail from deps to prevent infinite loops
    // They are checked in the condition above, not needed as dependencies
    isLoading,
    isGeneratingMetadata,
    metadataGenerationFailed,
    generateVideoMetadata,
    videoExtensions,
  ]);

  const handleFileSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'],
          },
          {
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];

        // Now show loading since user actually selected a file
        setIsLoading(true);

        // Reset metadata states for new file
        setVideoThumbnail(null);
        setVideoMetadata(null);
        setMetadataGenerationFailed(false);

        console.log('📁 Saving video file with atomic operations');

        // Update the input step with the selected file
        try {
          await updateStepContent('input', {
            inputFile: filePath,
            selectedFile: filePath,
            lastModified: Date.now(),
          });
          console.log('✅ File selection completed successfully');
        } catch (error) {
          console.error('❌ File selection failed:', error);
          throw error; // Re-throw to be caught by outer try-catch
        }

        // Save the input file - use event-driven system for immediate persistence
        console.log('🔧 [VIDEO DEBUG] FileSelector: About to update config with selected file:', {
          timestamp: new Date().toISOString(),
          filePath,
          hasCallback: !!onFileSelect,
          currentConfigBefore: inputStep.inputFile,
          willUseCallback: !!onFileSelect,
        });

        if (onFileSelect) {
          console.log('✅ [VIDEO DEBUG] FileSelector: Using callback to update file');
          onFileSelect(filePath);
        } else {
          console.log(
            '✅ [VIDEO DEBUG] FileSelector: File already updated through centralized store'
          );
        }

        // Output path handling would be moved to config step in complete rewrite

        // Generate video metadata if it's a video file
        const ext = filePath.split('.').pop()?.toLowerCase();
        const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];
        if (videoExts.includes(ext || '')) {
          await generateVideoMetadata(filePath);
        }

        // Auto-complete step 1 and enable step 2 when media file is uploaded
        // This enables step 2 to become ready while keeping the user on step 1
        await setStepState('input', StepStatus.COMPLETE); // Complete step 1
        await setStepState('config', StepStatus.READY); // Make step 2 ready (not just navigable)

        console.log(
          '✅ Video selection and step updates completed - Step 1 completed, Step 2 ready'
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to select file: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStepContent, generateVideoMetadata, onFileSelect, inputStep.inputFile]);

  // Create cleanup utility instance
  const performCleanup = useMemo(
    () =>
      createComprehensiveCleanup(
        activeWorkspaceId,
        updateStepContent,
        setStepState,
        navigateToStep,
        () => ({ clearWorkspace: subtitleActions.clearWorkspace })
      ),
    [
      activeWorkspaceId,
      updateStepContent,
      setStepState,
      navigateToStep,
      subtitleActions.clearWorkspace,
    ]
  );

  const handleClearFile = useCallback(async () => {
    console.log(
      '🗑️ Removing video file with comprehensive cleanup (video + JSON + workspace reset)'
    );

    try {
      // Use comprehensive cleanup utility for complete media file removal
      await performCleanup({
        clearInputFile: true,
        clearJsonFile: true,
        resetWorkflow: true,
        targetStep: 'input',
        preserveMediaWorkflow: false,
      });

      // Clear local component state
      setVideoThumbnail(null);
      setVideoMetadata(null);
      setIsGeneratingMetadata(false);
      setMetadataGenerationFailed(false);

      // Notify parent component that file was removed
      onFileRemoved?.();

      console.log('✅ Comprehensive video file removal completed');
    } catch (error) {
      console.error('Failed to clear file:', error);
    }
  }, [performCleanup, onFileRemoved]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // React 19 Optimization: Memoize supported types to prevent recreation
  const supportedTypes = useMemo(
    () => [
      'video/',
      'audio/',
      '.mp4',
      '.avi',
      '.mov',
      '.mkv',
      '.webm',
      '.flv',
      '.mp3',
      '.wav',
      '.flac',
      '.m4a',
      '.aac',
      '.ogg',
    ],
    []
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file: ExtendedFile = files[0] as ExtendedFile;

        const isSupported = supportedTypes.some(
          (type) =>
            file.type.startsWith(type) || file.name.toLowerCase().endsWith(type.replace('.', ''))
        );

        if (isSupported) {
          try {
            // Show loading now that we confirmed the file is supported
            setIsLoading(true);

            // Reset metadata states for new file
            setVideoThumbnail(null);
            setVideoMetadata(null);
            setMetadataGenerationFailed(false);

            console.log('📁 Drag & drop: Saving video file and auto-saving to workspace');

            // Get the file path from Electron's File object
            const filePath = file.path;

            if (!filePath) {
              throw new Error(
                'Unable to access the file path. Please use the "Browse Files" button to select your video.'
              );
            }

            // Update the input step with the selected file
            try {
              await updateStepContent('input', {
                inputFile: filePath,
                selectedFile: filePath,
                lastModified: Date.now(),
              });
              console.log('✅ Drag-and-drop file upload completed successfully');
            } catch (atomicError) {
              console.error('❌ Drag-and-drop file upload failed:', atomicError);
              throw atomicError; // Re-throw to be caught by outer try-catch
            }

            // Notify parent component if callback is provided
            if (onFileSelect) {
              console.log(
                '✅ [VIDEO DEBUG] FileSelector (drag-drop): Using callback to update file'
              );
              onFileSelect(filePath);
            }

            // Output path handling would be moved to config step in complete rewrite

            // Generate video metadata if it's a video file
            const ext = filePath.split('.').pop()?.toLowerCase();
            const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];
            if (videoExts.includes(ext || '')) {
              await generateVideoMetadata(filePath);
            }

            // Auto-complete step 1 and enable step 2 when media file is uploaded via drag & drop
            // This enables step 2 to become ready while keeping the user on step 1
            await setStepState('input', StepStatus.COMPLETE); // Complete step 1
            await setStepState('config', StepStatus.READY); // Make step 2 ready (not just navigable)

            console.log(
              '✅ Drag & drop with step updates completed - Step 1 completed, Step 2 ready'
            );
          } catch (error) {
            console.error('Error in drag and drop file handling:', error);
            const errorMsg =
              error instanceof Error
                ? error.message
                : 'Unknown error occurred while processing the dropped file';
            console.error(errorMsg);
          } finally {
            setIsLoading(false);
          }
        } else {
          console.error('Unsupported file type. Please select a video or audio file.');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateStepContent, generateVideoMetadata, onFileSelect, supportedTypes]
  );

  const getFileName = (filePath: string | null): string | null => {
    if (!filePath) return null;
    return filePath.split(/[\\\\/]/).pop() || null;
  };

  const getFileIcon = (filePath: string | null) => {
    if (!filePath) return <FileIcon />;
    const ext = filePath.split('.').pop()?.toLowerCase();
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];
    const audioExts = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'];

    if (videoExts.includes(ext || '')) return <VideoIcon />;
    if (audioExts.includes(ext || '')) return <AudioIcon />;
    return <FileIcon />;
  };

  const getFileType = (filePath: string | null): string => {
    if (!filePath) return 'No file selected';
    const ext = filePath.split('.').pop()?.toLowerCase();
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];
    const audioExts = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'];

    if (videoExts.includes(ext || '')) return 'Video File';
    if (audioExts.includes(ext || '')) return 'Audio File';
    return 'Media File';
  };

  // Convert CantoCap JSON to Step 4 format (reserved for future use)

  // Enhanced JSON-only import handler
  const handleJsonImport = useCallback(async () => {
    const importStartTime = performance.now();
    let importSuccess = false;

    try {
      setIsImportingJson(true);
      console.log('🔄 Starting JSON subtitle import...');

      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          {
            name: 'JSON Subtitle Files',
            extensions: ['json'],
          },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        console.log('📁 Importing JSON file:', filePath);

        // DEBUG: Read the raw JSON file to see what's actually in it
        try {
          const rawFileContent = await (
            window as unknown as {
              cantocapAPI: { readTextFile: (path: string) => Promise<string> };
            }
          ).cantocapAPI.readTextFile(filePath);
          const parsedJson = JSON.parse(rawFileContent) as ImportedSubtitle[];
          console.log('📄 Raw JSON file content (first 3 items):', {
            totalItems: parsedJson.length,
            firstFew: parsedJson.slice(0, 3).map((item: ImportedSubtitle) => ({
              caption: item.caption,
              text: item.text,
              translation: item.translation,
              hasTranslation: !!item.translation,
              allKeys: Object.keys(item),
            })),
          });
        } catch (err) {
          console.warn('Could not read raw JSON for debugging:', err);
        }

        // Use backend import validation (more robust than frontend validation)
        const importResult = await window.cantocapAPI.subtitleImportJson(filePath);

        if (!importResult.success) {
          console.error('❌ JSON import validation failed:', importResult.error);
          throw new Error(`Invalid JSON format: ${importResult.error}`);
        }

        console.log('✅ JSON import validation passed, processing subtitles...');

        // Debug: Check what backend returned
        console.log('🔍 Backend import result structure:', {
          success: importResult.success,
          subtitleCount: importResult.subtitles?.length || 0,
          firstFewSubtitles:
            importResult.subtitles?.slice(0, 3).map((sub) => ({
              id: sub.id,
              caption: sub.caption,
              text: sub.text,
              translation: sub.translation,
              hasTranslation: !!sub.translation,
              allKeys: Object.keys(sub),
            })) || [],
        });

        if (!importResult.subtitles || importResult.subtitles.length === 0) {
          throw new Error('No valid subtitles found in JSON file');
        }

        // Convert to internal format
        const conversionStartTime = performance.now();
        const convertedSubtitles = importResult.subtitles.map(
          (sub: ImportedSubtitle, index: number) => {
            // Debug logging for first few items
            if (index < 3) {
              console.log(`📊 FileSelector converting subtitle ${index}:`, {
                originalSub: sub,
                caption: sub.caption,
                text: sub.text,
                translation: sub.translation,
                hasTranslation: !!sub.translation,
              });
            }

            const startTime = sub.start ?? sub.startTime ?? 0;
            const endTime = sub.end ?? sub.endTime ?? 0;
            const converted = {
              id: sub.id || `imported_${index}`,
              index: index,
              startTime: startTime,
              endTime: endTime,
              duration: endTime - startTime,
              text: sub.text ?? sub.caption ?? '',
              translation:
                sub.translation && typeof sub.translation === 'string' ? sub.translation : '',
              speaker: sub.speaker || null,
              confidence: sub.confidence || 1,
              isMusic: sub.isMusic || false,
            };

            if (index < 3) {
              console.log(`✅ FileSelector converted subtitle ${index}:`, {
                id: converted.id,
                text: converted.text,
                translation: converted.translation,
                hasTranslation: !!converted.translation,
              });
            }

            return converted;
          }
        );
        const conversionTime = performance.now() - conversionStartTime;

        console.log('✅ Subtitle processing completed:', {
          importedCount: importResult.subtitles.length,
          convertedCount: convertedSubtitles.length,
          conversionTime: `${conversionTime.toFixed(2)}ms`,
          filePath: filePath.split('/').pop(),
        });

        // Import subtitles using the new workflow
        try {
          if (!activeWorkspaceId) {
            throw new Error('No active workspace found');
          }

          // CRITICAL FIX: Clear existing workspace data before importing new JSON
          // This ensures the new JSON becomes the baseline for diff comparison
          console.log('🧹 Clearing existing workspace data before JSON import');
          try {
            await window.cantocapAPI.subtitleWorkspaceDelete(activeWorkspaceId);
            console.log('✅ Existing workspace data cleared');
          } catch (clearError) {
            console.log('ℹ️ No existing workspace data to clear:', clearError);
          }

          // Debug: Check what we're passing to importFromJson
          console.log('🔥 FILESELECTOR: About to call importFromJson with data:', {
            workspaceId: activeWorkspaceId,
            filePath,
            subtitleCount: convertedSubtitles.length,
            subtitlesWithTranslations: convertedSubtitles.filter(
              (s) => s.translation && s.translation.trim()
            ).length,
            firstFewConverted: convertedSubtitles.slice(0, 3).map((sub) => ({
              id: sub.id,
              text: sub.text,
              translation: sub.translation,
              hasTranslation: !!sub.translation,
              translationType: typeof sub.translation,
              translationLength: sub.translation ? sub.translation.length : 0,
            })),
          });

          // Import JSON data into subtitle editing store
          // Note: importFromJson handles creating fresh baseline data
          await importFromJson(activeWorkspaceId, filePath, convertedSubtitles);

          // Export to step store for step navigation
          await exportToStep();

          // Update input step with JSON file info
          await updateStepContent('input', {
            importedJsonFile: filePath,
            lastModified: Date.now(),
          });

          // Note: Workflow navigation permissions will be updated automatically through state changes

          // Calculate total duration from subtitles
          const totalDuration = Math.max(...convertedSubtitles.map((sub) => sub.endTime));
          if (totalDuration > 0) {
            await updateStepContent('input', {
              duration: totalDuration,
            });
          }

          // Update workflow states for JSON import
          await setStepState('input', StepStatus.COMPLETE); // Step 1 complete
          await setStepState('config', StepStatus.SKIP); // Skip step 2
          await setStepState('processing', StepStatus.SKIP); // Skip step 3
          await setStepState('review', StepStatus.READY); // Step 4 ready

          // Navigate to step 4 (review)
          await navigateToStep('review');

          // Notify parent component if callback is provided
          if (onJsonFileSelect) {
            onJsonFileSelect(filePath);
          }

          console.log('✅ JSON import completed:', {
            subtitleCount: convertedSubtitles.length,
            importedFile: filePath,
            workspaceId: activeWorkspaceId,
            navigatedToStep: 'review',
          });
        } catch (error) {
          console.error('Failed to complete JSON import workflow:', error);
          throw error;
        }

        console.log('✅ JSON subtitles imported successfully!');
        console.log('✅ JSON import complete - ready for processing');

        importSuccess = true;
        console.log('✅ JSON import completed successfully');
      }
    } catch (error) {
      console.error('❌ JSON import error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to import JSON: ${errorMsg}`);

      // Enhanced error logging with context
      console.error('💥 JSON import failed with context:', {
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        importTime: performance.now() - importStartTime,
      });
    } finally {
      setIsImportingJson(false);
      const totalImportTime = performance.now() - importStartTime;
      console.log('🔄 JSON import process finished', {
        totalTime: `${totalImportTime.toFixed(2)}ms`,
        success: importSuccess,
        timestamp: new Date().toISOString(),
      });

      // Performance warning for slow imports
      if (totalImportTime > 5000) {
        // 5 seconds
        console.warn(`⚠️ Slow JSON import detected: ${totalImportTime.toFixed(2)}ms`);
        console.warn('JSON import completed but took longer than expected');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStepContent, onJsonFileSelect]);

  // Handle JSON caption removal with comprehensive cleanup
  const handleRemoveJsonCaption = useCallback(async () => {
    console.log('🗑️ Removing imported JSON caption with comprehensive cleanup');

    try {
      // Determine cleanup strategy based on media file presence
      const hasMediaFile = !!inputStep.inputFile;

      // Use comprehensive cleanup utility for JSON removal
      await performCleanup({
        clearInputFile: false, // Don't clear media file
        clearJsonFile: true, // Clear JSON file
        resetWorkflow: true, // Reset workflow state
        targetStep: hasMediaFile ? 'config' : 'input', // Navigate appropriately
        preserveMediaWorkflow: hasMediaFile, // Preserve media workflow if media exists
      });

      // Notify through callback if provided
      if (onJsonFileSelect) {
        onJsonFileSelect(null);
      }

      console.log('Imported subtitle removed. You can now configure subtitle generation.');
      console.log('✅ Comprehensive JSON caption removal completed');
    } catch (error) {
      console.error('Failed to remove JSON caption:', error);
    }
  }, [performCleanup, inputStep.inputFile, onJsonFileSelect]);

  return (
    <Box>
      <Typography
        variant='subtitle2'
        sx={{
          mb: 2,
          fontWeight: 500,
          color: 'text.primary',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        Select Audio/Video File
        <Chip label='Required' size='small' color='primary' variant='outlined' />
      </Typography>

      {/* Drag & Drop Area */}
      <Paper
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!inputStep.inputFile ? handleFileSelect : undefined}
        sx={{
          p: inputStep.inputFile ? 0 : 4,
          minHeight: inputStep.inputFile ? 240 : 280,
          height: inputStep.inputFile ? 240 : 280,
          border: inputStep.inputFile ? 0 : 2,
          borderStyle: inputStep.inputFile ? 'none' : 'dashed',
          borderColor: inputStep.inputFile
            ? 'transparent'
            : isDragOver
              ? 'primary.main'
              : 'grey.300',
          backgroundColor: inputStep.inputFile
            ? 'transparent'
            : isDragOver
              ? 'primary.50'
              : 'background.paper',
          transition: 'all 0.2s ease-in-out',
          cursor: inputStep.inputFile ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover': inputStep.inputFile
            ? {}
            : {
                borderColor: 'primary.main',
                backgroundColor: 'primary.50',
              },
        }}
      >
        {inputStep.inputFile ? (
          // Show loading card when generating metadata
          isGeneratingMetadata ? (
            <Card
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: 'background.paper',
                display: 'flex',
                flexDirection: 'row',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {/* Loading thumbnail placeholder */}
              <Box
                sx={{
                  width: 280,
                  height: 240,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#000000',
                  flexShrink: 0,
                }}
              >
                <CircularProgress
                  size={48}
                  sx={{
                    animation: 'spin 1s linear infinite !important',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </Box>

              {/* Loading content placeholder */}
              <CardContent
                sx={{
                  p: 3,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 240,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Typography
                    variant='h6'
                    sx={{ fontWeight: 600, flex: 1, mr: 2, fontSize: '1.1rem' }}
                  >
                    {getFileName(inputStep.inputFile)}
                  </Typography>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    color='error'
                    size='medium'
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>

                <Chip
                  icon={<VideoIcon />}
                  label={getFileType(inputStep.inputFile)}
                  size='medium'
                  color='primary'
                  variant='outlined'
                  sx={{ alignSelf: 'flex-start', mb: 2 }}
                />

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flex: 1,
                    justifyContent: 'center',
                  }}
                >
                  <CircularProgress
                    size={24}
                    sx={{
                      animation: 'spin 1s linear infinite !important',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  />
                  <Typography variant='body2' color='text.secondary'>
                    Loading video metadata...
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ) : videoMetadata && videoThumbnail ? (
            <Card
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: 'background.paper',
                display: 'flex',
                flexDirection: 'row',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {/* Thumbnail on the left */}
              <CardMedia
                component='img'
                sx={{
                  width: 280,
                  height: 240,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
                image={videoThumbnail}
                alt='Video thumbnail'
              />

              {/* Metadata content on the right */}
              <CardContent
                sx={{
                  p: 3,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 240,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Typography
                    variant='h6'
                    sx={{ fontWeight: 600, flex: 1, mr: 2, fontSize: '1.1rem' }}
                  >
                    {getFileName(inputStep.inputFile)}
                  </Typography>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    color='error'
                    size='medium'
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>

                <Chip
                  icon={<VideoIcon />}
                  label={getFileType(inputStep.inputFile)}
                  size='medium'
                  color='primary'
                  variant='outlined'
                  sx={{ alignSelf: 'flex-start', mb: 2 }}
                />

                <Stack spacing={1.5} sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant='body1' color='text.secondary' sx={{ fontSize: '0.95rem' }}>
                      Duration: <strong>{videoMetadata.duration}</strong>
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <EditIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant='body1' color='text.secondary' sx={{ fontSize: '0.95rem' }}>
                      Resolution: <strong>{videoMetadata.resolution}</strong>
                    </Typography>
                  </Box>

                  {/* Imported JSON Caption Path and Import Button - Horizontal Layout */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}
                  >
                    {inputStep.importedJsonFile ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <AttachmentIcon
                          sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }}
                        />
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <Typography
                            variant='body1'
                            color='success.main'
                            sx={{
                              fontSize: '0.85rem',
                              wordBreak: 'break-all',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                            }}
                          >
                            Captions: <strong>{inputStep.importedJsonFile}</strong>
                          </Typography>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveJsonCaption();
                            }}
                            size='small'
                            sx={{
                              color: 'error.main',
                              padding: '2px',
                              flexShrink: 0,
                              '&:hover': {
                                backgroundColor: 'error.lighter',
                              },
                            }}
                            title='Remove imported caption'
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1 }} />
                    )}

                    <Button
                      variant='outlined'
                      size='small'
                      startIcon={isImportingJson ? <CircularProgress size={16} /> : <ImportIcon />}
                      onClick={handleJsonImport}
                      disabled={isImportingJson}
                      sx={{
                        fontSize: '0.8rem',
                        px: 2,
                        py: 0.5,
                        minWidth: 'unset',
                        flexShrink: 0,
                      }}
                    >
                      {isImportingJson ? 'Importing JSON...' : 'Import JSON'}
                    </Button>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <FolderIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
                    <Typography
                      variant='body1'
                      color='text.secondary'
                      sx={{
                        fontSize: '0.85rem',
                        wordBreak: 'break-all',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      <strong>{inputStep.inputFile}</strong>
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            // For non-video files, show a similar card layout but without thumbnail
            <Card
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: 'background.paper',
                display: 'flex',
                flexDirection: 'row',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {/* File icon on the left */}
              <Box
                sx={{
                  width: 280,
                  height: 240,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#000000',
                  color: 'primary.main',
                }}
              >
                <Box sx={{ fontSize: 80 }}>{getFileIcon(inputStep.inputFile)}</Box>
              </Box>

              {/* Metadata content on the right */}
              <CardContent
                sx={{
                  p: 3,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 240,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Typography
                    variant='h6'
                    sx={{ fontWeight: 600, flex: 1, mr: 2, fontSize: '1.1rem' }}
                  >
                    {getFileName(inputStep.inputFile)}
                  </Typography>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    color='error'
                    size='medium'
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>

                <Chip
                  icon={getFileIcon(inputStep.inputFile)}
                  label={getFileType(inputStep.inputFile)}
                  size='medium'
                  color='success'
                  variant='outlined'
                  sx={{ alignSelf: 'flex-start', mb: 2 }}
                />

                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      width: '100%',
                      mb: 2,
                    }}
                  >
                    <FolderIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
                    <Typography
                      variant='body1'
                      color='text.secondary'
                      sx={{
                        fontSize: '0.85rem',
                        wordBreak: 'break-all',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      <strong>{inputStep.inputFile}</strong>
                    </Typography>
                  </Box>

                  {/* Imported JSON Caption Path and Import Button - Horizontal Layout */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}
                  >
                    {inputStep.importedJsonFile ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <AttachmentIcon
                          sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }}
                        />
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <Typography
                            variant='body1'
                            color='success.main'
                            sx={{
                              fontSize: '0.85rem',
                              wordBreak: 'break-all',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                            }}
                          >
                            Captions: <strong>{inputStep.importedJsonFile}</strong>
                          </Typography>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveJsonCaption();
                            }}
                            size='small'
                            sx={{
                              color: 'error.main',
                              padding: '2px',
                              flexShrink: 0,
                              '&:hover': {
                                backgroundColor: 'error.lighter',
                              },
                            }}
                            title='Remove imported caption'
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1 }} />
                    )}

                    <Button
                      variant='outlined'
                      size='small'
                      startIcon={isImportingJson ? <CircularProgress size={16} /> : <ImportIcon />}
                      onClick={handleJsonImport}
                      disabled={isImportingJson}
                      sx={{
                        fontSize: '0.8rem',
                        px: 2,
                        py: 0.5,
                        minWidth: 'unset',
                        flexShrink: 0,
                      }}
                    >
                      {isImportingJson ? 'Importing JSON...' : 'Import JSON'}
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )
        ) : isLoading ? (
          <Stack alignItems='center' spacing={2}>
            <CircularProgress
              size={64}
              sx={{
                animation: 'spin 1s linear infinite !important',
                '@keyframes spin': {
                  '0%': {
                    transform: 'rotate(0deg)',
                  },
                  '100%': {
                    transform: 'rotate(360deg)',
                  },
                },
              }}
            />
            <Box textAlign='center'>
              <Typography variant='h6' sx={{ mb: 1, color: 'text.primary' }}>
                Processing video file...
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Please wait while we load your media file
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Stack alignItems='center' spacing={2}>
            <UploadIcon
              sx={{
                fontSize: 64,
                color: isDragOver ? 'primary.main' : 'grey.400',
              }}
            />
            <Box textAlign='center'>
              <Typography variant='h6' sx={{ mb: 1, color: 'text.primary' }}>
                {isDragOver ? 'Drop your file here' : 'Choose or drag your file here'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Supported formats: MP4, AVI, MOV, MP3, WAV, FLAC, and more
              </Typography>
            </Box>
            <Button
              variant='outlined'
              startIcon={<UploadIcon />}
              sx={{ mt: 2 }}
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleFileSelect();
              }}
            >
              Browse Files
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
};
