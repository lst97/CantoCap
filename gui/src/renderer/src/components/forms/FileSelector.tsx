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

// TypeScript interfaces for subtitle data structure
interface SubtitleData {
  index: number;
  startTime: number;
  endTime: number;
  caption?: string;
  text?: string;
  translation?: string;
  confidence?: number;
  speaker?: string | null;
  isMusic?: boolean;
}

interface ConvertedSubtitle {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  text: string;
  translation: string;
  confidence: number;
  speaker: string | null;
  isMusic: boolean;
}

interface CantocapJsonMetadata {
  format: string;
  version: string;
  statistics?: {
    totalDuration?: number;
  };
}

interface CantocapJsonData {
  metadata: CantocapJsonMetadata;
  subtitles: SubtitleData[];
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

  useEffect(() => {
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
      stackTrace: new Error().stack?.split('\n').slice(1, 3).join('\n'),
    });
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
          return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };

        setVideoMetadata({
          duration: formatDuration(result.metadata.duration),
          resolution: `${result.metadata.width}×${result.metadata.height}`,
          size: formatFileSize(result.metadata.size),
        });
        
        console.log('✅ Video metadata processed successfully:', {
          duration: result.metadata.duration,
          resolution: `${result.metadata.width}×${result.metadata.height}`,
          format: result.metadata.format
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
  }, [
    inputStep.inputFile,
    videoMetadata,
    videoThumbnail,
    generateVideoMetadata,
    isLoading,
    isGeneratingMetadata,
    metadataGenerationFailed,
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

        console.log('✅ Video selection and step updates completed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to select file: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [updateStepContent, generateVideoMetadata, onFileSelect, inputStep.inputFile]);

  const handleClearFile = useCallback(async () => {
    console.log('🗑️ Removing video file with comprehensive cleanup (video + JSON)');

    try {
      // Clear input step data through centralized store
      await updateStepContent('input', {
        inputFile: null,
        selectedFile: null,
        importedJsonFile: null,
        lastModified: Date.now(),
      });

      // Clear local component state
      setVideoThumbnail(null);
      setVideoMetadata(null);
      setIsGeneratingMetadata(false);
      setMetadataGenerationFailed(false);

      // Notify parent component that file was removed
      onFileRemoved?.();

      console.log('✅ Video file removal completed');
    } catch (error) {
      console.error('Failed to clear file:', error);
    }
  }, [updateStepContent, onFileRemoved]);

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

            console.log('✅ Drag & drop with step updates completed');
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

  // JSON validation function
  const validateCantocapJson = (jsonData: unknown): jsonData is CantocapJsonData => {
    console.log('🔍 Starting JSON validation...');

    if (!jsonData || typeof jsonData !== 'object') {
      console.error('❌ JSON validation failed: Invalid JSON object');
      return false;
    }

    // Type guard to check if jsonData has the expected structure
    const hasRequiredStructure = (
      data: unknown
    ): data is { metadata: unknown; subtitles: unknown } => {
      return data !== null && typeof data === 'object' && 'metadata' in data && 'subtitles' in data;
    };

    // Check for required structure with enhanced logging
    if (!hasRequiredStructure(jsonData)) {
      console.error('❌ JSON validation failed: Missing metadata or subtitles', {
        hasMetadata: !!(jsonData as Record<string, unknown>)?.metadata,
        hasSubtitles: !!(jsonData as Record<string, unknown>)?.subtitles,
        availableKeys: Object.keys(jsonData as Record<string, unknown>),
      });
      return false;
    }

    // Validate metadata structure
    const metadata = jsonData.metadata as Record<string, unknown>;
    if (!metadata || typeof metadata !== 'object' || !metadata.format || !metadata.version) {
      console.error('❌ JSON validation failed: Invalid metadata structure', metadata);
      return false;
    }

    // Check if it's CantoCap format
    if (typeof metadata.format !== 'string' || !metadata.format.includes('CantoCap')) {
      console.error('❌ JSON validation failed: Not CantoCap format', metadata.format);
      return false;
    }

    // Validate subtitles array
    const subtitles = jsonData.subtitles;
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      console.error('❌ JSON validation failed: Invalid subtitles array', {
        isArray: Array.isArray(subtitles),
        length: Array.isArray(subtitles) ? subtitles.length : 'N/A',
      });
      return false;
    }

    console.log('🔍 Validating', subtitles.length, 'subtitles...');

    // Type guard for subtitle validation
    const isValidSubtitle = (sub: unknown): sub is SubtitleData => {
      if (!sub || typeof sub !== 'object') return false;
      const subtitle = sub as Record<string, unknown>;

      const hasValidIndex = typeof subtitle.index === 'number';
      const hasValidTiming =
        typeof subtitle.startTime === 'number' &&
        typeof subtitle.endTime === 'number' &&
        (subtitle.endTime as number) > (subtitle.startTime as number);
      const hasValidCaption =
        (typeof subtitle.caption === 'string' && subtitle.caption.trim().length > 0) ||
        (typeof subtitle.text === 'string' && subtitle.text.trim().length > 0);
      const hasValidTranslation =
        subtitle.translation === undefined || typeof subtitle.translation === 'string';

      return hasValidIndex && hasValidTiming && hasValidCaption && hasValidTranslation;
    };

    // Enhanced subtitle structure validation with tolerance
    const validSubtitles = subtitles.filter((sub: unknown, index: number): sub is SubtitleData => {
      const isValid = isValidSubtitle(sub);

      if (!isValid && index < 5) {
        // Log first 5 invalid subtitles for debugging
        const subtitle = sub as Record<string, unknown>;
        console.warn(`⚠️ Subtitle ${index} failed validation:`, {
          hasValidIndex: typeof subtitle.index === 'number',
          hasValidTiming:
            typeof subtitle.startTime === 'number' && typeof subtitle.endTime === 'number',
          hasValidCaption:
            typeof subtitle.caption === 'string' || typeof subtitle.text === 'string',
          hasValidTranslation:
            subtitle.translation === undefined || typeof subtitle.translation === 'string',
          original: sub,
        });
      }

      return isValid;
    });

    const validationRatio = validSubtitles.length / subtitles.length;
    console.log(
      `📊 JSON validation result: ${validSubtitles.length}/${subtitles.length} valid subtitles (${(validationRatio * 100).toFixed(1)}%)`
    );

    // CRITICAL FIX: Accept JSON if at least 90% of subtitles are valid (more tolerant)
    // This prevents rejecting good JSON files due to a few problematic subtitles
    const isValid = validationRatio >= 0.9;

    if (!isValid) {
      console.error(
        `❌ JSON validation failed: Only ${(validationRatio * 100).toFixed(1)}% of subtitles are valid (minimum 90% required)`
      );
    } else {
      console.log('✅ JSON validation passed successfully');
    }

    return isValid;
  };

  // Convert CantoCap JSON to Step 4 format
  const convertJsonToStep4Format = (jsonData: CantocapJsonData): ConvertedSubtitle[] => {
    const { subtitles } = jsonData;

    if (!Array.isArray(subtitles)) {
      console.error('❌ Subtitles is not an array:', subtitles);
      return [];
    }

    console.log('🔄 Converting', subtitles.length, 'subtitles from JSON format');

    return subtitles
      .map((sub: SubtitleData, index: number): ConvertedSubtitle => {
        // CRITICAL FIX: Proper ID generation to ensure string IDs and handle zero-based indexing
        const subtitleId = sub.index !== undefined ? String(sub.index) : `imported_${index}`;

        // CRITICAL FIX: Better field mapping and validation
        const converted: ConvertedSubtitle = {
          id: subtitleId,
          index: sub.index !== undefined ? sub.index : index,
          startTime: Number(sub.startTime) || 0,
          endTime: Number(sub.endTime) || 0,
          duration: Number(sub.endTime || 0) - Number(sub.startTime || 0),
          text: String(sub.caption || sub.text || '').trim(),
          translation: String(sub.translation || '').trim(),
          confidence: Number(sub.confidence) || 0,
          speaker: sub.speaker || null,
          isMusic: Boolean(sub.isMusic || false),
        };

        // Log conversion details for debugging missing subtitles
        if (index < 3) {
          // Log first 3 for debugging
          console.log(`📝 Subtitle ${index} conversion:`, {
            original: { index: sub.index, caption: sub.caption, text: sub.text },
            converted: { id: converted.id, text: converted.text },
          });
        }

        // Validation: Ensure we have essential data
        if (!converted.text) {
          console.warn(`⚠️ Subtitle ${index} has empty text after conversion:`, sub);
        }

        if (converted.startTime >= converted.endTime) {
          console.warn(`⚠️ Subtitle ${index} has invalid timing:`, {
            start: converted.startTime,
            end: converted.endTime,
          });
        }

        return converted;
      })
      .filter((sub) => {
        // CRITICAL FIX: Filter out invalid subtitles that could cause data loss
        const isValid = sub.text.length > 0 && sub.endTime > sub.startTime;
        if (!isValid) {
          console.warn('❌ Filtering out invalid subtitle:', sub);
        }
        return isValid;
      });
  };

  // Simplified JSON import handler
  const handleJsonImport = useCallback(async () => {
    const importStartTime = performance.now();
    let importSuccess = false;

    try {
      setIsImportingJson(true);
      console.log('🔄 Starting JSON import process...');

      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          {
            name: 'JSON Files',
            extensions: ['json'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        console.log('📁 Reading JSON file:', filePath);

        // Read the JSON file
        const jsonContent = await window.cantocapAPI.readJsonFile(filePath);
        console.log('📄 JSON content loaded, validating structure...');

        // Validate the JSON structure
        if (!validateCantocapJson(jsonContent)) {
          console.error('❌ JSON validation failed');
          console.error(
            'Invalid CantoCap JSON format. Please select a valid subtitle export file.'
          );
          return;
        }

        console.log('✅ JSON validation passed, converting format...');

        // Convert to Step 4 format and store in app config
        const conversionStartTime = performance.now();
        const convertedSubtitles = convertJsonToStep4Format(jsonContent);
        const conversionTime = performance.now() - conversionStartTime;

        console.log('🔄 Conversion completed:', {
          originalCount: jsonContent.subtitles?.length || 0,
          convertedCount: convertedSubtitles.length,
          conversionTime: `${conversionTime.toFixed(2)}ms`,
          dataLossDetected: (jsonContent.subtitles?.length || 0) !== convertedSubtitles.length,
        });

        // Check for data loss
        if ((jsonContent.subtitles?.length || 0) !== convertedSubtitles.length) {
          const lostCount = (jsonContent.subtitles?.length || 0) - convertedSubtitles.length;
          console.warn(
            `⚠️ DATA LOSS DETECTED: ${lostCount} subtitles were filtered out during conversion`
          );
          console.warn(`Warning: ${lostCount} subtitles were filtered out due to invalid data`);
        }

        // Store subtitle data as temp file for persistence across app restarts
        const tempResult = await window.cantocapAPI.storeTempSubtitleData(convertedSubtitles);
        if (!tempResult.success) {
          console.error('❌ Failed to store temp subtitle data:', tempResult.error);
        } else {
          console.log('📄 Subtitle data stored in temp file:', tempResult.tempFilePath);
        }

        // Update step content with imported subtitle data - simplified approach
        try {
          // Store subtitle data directly in the centralized store
          // Note: This is a simplified approach - full implementation would need proper ReviewStepData integration
          await updateStepContent('input', {
            importedJsonFile: filePath,
            lastModified: Date.now(),
          });

          // Add duration if available from metadata
          if (jsonContent.metadata?.statistics?.totalDuration) {
            await updateStepContent('input', {
              duration: jsonContent.metadata.statistics.totalDuration,
            });
          }

          // Notify parent component if callback is provided
          if (onJsonFileSelect) {
            onJsonFileSelect(filePath);
          }

          console.log('✅ JSON import completed:', {
            subtitleCount: convertedSubtitles.length,
            importedFile: filePath,
          });
        } catch (error) {
          console.error('Failed to update step content with JSON data:', error);
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
  }, [updateStepContent, onJsonFileSelect]);

  // Handle JSON caption removal
  const handleRemoveJsonCaption = useCallback(async () => {
    console.log('🗑️ Removing imported JSON caption');

    try {
      await updateStepContent('input', {
        importedJsonFile: null,
        lastModified: Date.now(),
      });

      console.log('Imported subtitle removed. You can now configure subtitle generation.');
      console.log('✅ JSON caption removal completed');
    } catch (error) {
      console.error('Failed to remove JSON caption:', error);
    }
  }, [updateStepContent]);

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
                      {isImportingJson ? 'Importing...' : 'Import Caption'}
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
                      {isImportingJson ? 'Importing...' : 'Import Caption'}
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
