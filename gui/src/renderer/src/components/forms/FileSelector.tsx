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
  Snackbar,
  Alert,
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
import { createComponentLogger } from '../../utils/logger';

const logger = createComponentLogger('FileSelector');


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
  onFileCleanupRequest?: () => Promise<void>;
  onJsonCleanupRequest?: () => Promise<void>;
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  onFileRemoved,
  initialFile: _initialFile,
  initialJsonFile: _initialJsonFile,
  onFileSelect,
  onJsonFileSelect,
  onFileCleanupRequest,
  onJsonCleanupRequest: _onJsonCleanupRequest,
}) => {
  // Use centralized stores as the single source of truth for component state
  const inputStep = useInputStepContent();
  const { updateStepContent } = useStepActions();

  // Component state for UI interactions
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
  const [error, setError] = useState<string | null>(null);

  // Function to generate video thumbnail and metadata using main process
  const generateVideoMetadata = useCallback(
    async (filePath: string) => {
      setIsGeneratingMetadata(true);
      try {
        // Use the new IPC-based video processing
        const result = await window.cantocapAPI.getVideoMetadata(filePath);

        if (result.error) {
          logger.warn('Video metadata generation failed', { error: result.error, filePath });
          setMetadataGenerationFailed(true);
          return;
        }

        // Set thumbnail if available
        if (result.thumbnail) {
          setVideoThumbnail(result.thumbnail);
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

          const formattedMetadata = {
            duration: formatDuration(result.metadata.duration),
            resolution: `${result.metadata.width}×${result.metadata.height}`,
            size: formatFileSize(result.metadata.size),
          };
          setVideoMetadata(formattedMetadata);

          // Also update the step store with metadata, including raw numeric duration for timeout calculation
          try {
            await updateStepContent('input', {
              mediaMetadata: formattedMetadata,
              videoDurationSeconds: result.metadata.duration, // Store raw duration in seconds for processing timeout
              lastModified: Date.now(),
            });
          } catch (error) {
            logger.error('Failed to save video metadata to step store', { error, filePath });
          }
        }
      } catch (error) {
        logger.error('Video metadata generation error', { error, filePath });
        setMetadataGenerationFailed(true);
      } finally {
        setIsGeneratingMetadata(false);
      }
    },
    [updateStepContent]
  );

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
    logger.userAction('File selection dialog opened');
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
        logger.userAction('File selected from dialog', { fileName: filePath.split('/').pop() });

        // Now show loading since user actually selected a file
        setIsLoading(true);

        // Reset metadata states for new file
        setVideoThumbnail(null);
        setVideoMetadata(null);
        setMetadataGenerationFailed(false);

        // Update the input step with the selected file
        try {
          await updateStepContent('input', {
            inputFile: filePath,
            selectedFile: filePath,
            lastModified: Date.now(),
          });
        } catch (error) {
          logger.error('File selection failed', { error, filePath });
          throw error; // Re-throw to be caught by outer try-catch
        }

        // Output path handling would be moved to config step in complete rewrite

        // Generate video metadata if it's a video file
        const ext = filePath.split('.').pop()?.toLowerCase();
        const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];
        if (videoExts.includes(ext || '')) {
          await generateVideoMetadata(filePath);
        }

        // Notify parent component about file selection
        if (onFileSelect) {
          onFileSelect(filePath);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('File selection process failed', { error: errorMsg });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStepContent, generateVideoMetadata, onFileSelect, inputStep.inputFile]);

  const handleClearFile = useCallback(async () => {
    logger.userAction('File removal initiated');
    try {
      // Clear local component state
      setVideoThumbnail(null);
      setVideoMetadata(null);
      setIsGeneratingMetadata(false);
      setMetadataGenerationFailed(false);

      // Use parent cleanup callback for data cleanup
      if (onFileCleanupRequest) {
        await onFileCleanupRequest();
      }

      // Notify parent component that file was removed
      onFileRemoved?.();
    } catch (error) {
      logger.error('File cleanup failed', { error });
    }
  }, [onFileCleanupRequest, onFileRemoved]);

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
          logger.userAction('File dropped for upload', {
            fileName: file.name,
            fileType: file.type,
          });
          try {
            // Show loading now that we confirmed the file is supported
            setIsLoading(true);

            // Reset metadata states for new file
            setVideoThumbnail(null);
            setVideoMetadata(null);
            setMetadataGenerationFailed(false);

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
            } catch (atomicError) {
              logger.error('Drag-and-drop file upload failed', { error: atomicError, filePath });
              throw atomicError; // Re-throw to be caught by outer try-catch
            }

            // Output path handling would be moved to config step in complete rewrite

            // Generate video metadata if it's a video file
            const ext = filePath.split('.').pop()?.toLowerCase();
            const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];
            if (videoExts.includes(ext || '')) {
              await generateVideoMetadata(filePath);
            }

            // Notify parent component about file selection via drag & drop
            if (onFileSelect) {
              onFileSelect(filePath);
            }
          } catch (error) {
            const errorMsg =
              error instanceof Error
                ? error.message
                : 'Unknown error occurred while processing the dropped file';
            logger.error('Drag and drop file handling failed', { error: errorMsg });
          } finally {
            setIsLoading(false);
          }
        } else {
          logger.warn('Unsupported file type attempted', {
            fileName: file.name,
            fileType: file.type,
          });
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

  // JSON file selector with immediate parsing and validation
  const handleJsonImport = useCallback(async () => {
    logger.userAction('JSON file selection initiated');

    try {
      setIsImportingJson(true);
      logger.info('Opening JSON file dialog');

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
        logger.info('JSON file selected', { fileName: filePath.split('/').pop() });

        // Import and parse JSON file immediately
        const importResult = await window.cantocapAPI.subtitleImportJson(filePath);
        
        if (!importResult.success) {
          // Show error immediately if JSON is invalid
          const errorMsg = importResult.error || 'Failed to import JSON file';
          logger.error('JSON import failed', { error: errorMsg, filePath });
          throw new Error(errorMsg);
        }

        // Import was successful, save both file path and parsed subtitles
        logger.info('JSON file imported successfully', { 
          fileName: filePath.split('/').pop(),
          subtitleCount: importResult.subtitles?.length || 0
        });

        // Convert imported subtitles to standard format
        const { validateJsonSubtitleStructure } = await import('../../utils/subtitleConverter');
        const validated = validateJsonSubtitleStructure(importResult);

        // Update input step with both file path and parsed subtitles
        await updateStepContent('input', {
          importedJsonFile: filePath,
          importedSubtitles: validated.subtitles,
          lastModified: Date.now(),
        });

        logger.info('JSON subtitles saved to step store', {
          subtitleCount: validated.subtitles.length
        });

        // Notify parent component
        if (onJsonFileSelect) {
          onJsonFileSelect(filePath);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('JSON file selection failed', { error: errorMsg });
      
      // Show user-friendly error message using Material-UI Snackbar
      setError(`Failed to import JSON file: ${errorMsg}`);
    } finally {
      setIsImportingJson(false);
    }
  }, [updateStepContent, onJsonFileSelect]);

  // Handle JSON caption removal using parent callback
  const handleRemoveJsonCaption = useCallback(async () => {
    logger.userAction('JSON caption removal initiated');
    try {
      // Use parent cleanup callback for JSON removal
      if (_onJsonCleanupRequest) {
        await _onJsonCleanupRequest();
      }

      // Notify through callback if provided
      if (onJsonFileSelect) {
        onJsonFileSelect(null);
      }
    } catch (error) {
      logger.error('Failed to remove JSON caption', { error });
    }
  }, [_onJsonCleanupRequest, onJsonFileSelect]);

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

      {/* Error Snackbar for JSON import errors */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};
