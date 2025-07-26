import React, { useCallback, useState, useEffect } from "react";
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
} from "@mui/material";
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Clear as ClearIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  Edit as EditIcon,
  AccessTime as TimeIcon,
  Folder as FolderIcon,
} from "@mui/icons-material";
import { useAppStore } from "../../store/app-store";
import { useWorkflowStore } from "../../stores/workflow-store";

interface FileSelectorProps {
  onFileRemoved?: () => void;
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  onFileRemoved,
}) => {
  const { config, updateConfig, showNotification } = useAppStore();
  const { completeStep } = useWorkflowStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration?: string;
    size?: string;
    resolution?: string;
  } | null>(null);

  // Function to generate video thumbnail and metadata
  const generateVideoMetadata = useCallback(async (filePath: string) => {
    setIsGeneratingMetadata(true);
    try {
      // Create a video element to load the file and extract metadata
      const video = document.createElement('video');
      // Convert file path to proper file URL for Electron
      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      video.src = fileUrl;
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('Video metadata generation timed out');
        setIsGeneratingMetadata(false);
      }, 10000); // 10 second timeout
      
      await new Promise<void>((resolve, _reject) => {
        video.onloadedmetadata = () => {
          try {
            clearTimeout(timeout);
            
            // Validate video dimensions
            if (!video.videoWidth || !video.videoHeight || !isFinite(video.duration)) {
              console.warn('Invalid video dimensions or duration');
              resolve();
              return;
            }
            
            // Generate thumbnail
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = 300;
              canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
              
              // Seek to 10% of video duration for thumbnail
              const seekTime = Math.min(video.duration * 0.1, video.duration - 1);
              video.currentTime = seekTime;
              
              video.onseeked = () => {
                try {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  setVideoThumbnail(thumbnailDataUrl);
                  
                  // Format duration
                  const formatDuration = (seconds: number) => {
                    if (!isFinite(seconds) || seconds < 0) return '0:00';
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                  };
                  
                  // Set metadata
                  setVideoMetadata({
                    duration: formatDuration(video.duration),
                    resolution: `${video.videoWidth}×${video.videoHeight}`,
                    size: 'Unknown' // File size would need to be obtained differently
                  });
                  
                  resolve();
                } catch (error) {
                  console.warn('Error generating thumbnail:', error);
                  resolve();
                }
              };
              
              video.onerror = () => {
                console.warn('Error during video seeking');
                resolve();
              };
            } else {
              console.warn('Could not get canvas context');
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            console.warn('Error in video metadata generation:', error);
            resolve();
          }
        };
        
        video.onerror = (e) => {
          clearTimeout(timeout);
          console.warn('Error loading video for metadata:', e);
          resolve(); // Don't reject, just continue without metadata
        };
        
        video.onabort = () => {
          clearTimeout(timeout);
          console.warn('Video loading aborted');
          resolve();
        };
      });
    } catch (error) {
      console.warn('Error in generateVideoMetadata:', error);
    } finally {
      setIsGeneratingMetadata(false);
    }
  }, []);

  // Regenerate video metadata when component mounts with existing file
  useEffect(() => {
    const regenerateMetadata = async () => {
      if (config.inputFile && !videoMetadata && !videoThumbnail && !isLoading && !isGeneratingMetadata) {
        const ext = config.inputFile.split(".").pop()?.toLowerCase();
        const videoExts = ["mp4", "avi", "mov", "mkv", "webm", "flv"];
        if (videoExts.includes(ext || "")) {
          console.log('Regenerating video metadata for:', config.inputFile);
          await generateVideoMetadata(config.inputFile);
        }
      }
    };

    regenerateMetadata();
  }, [config.inputFile, videoMetadata, videoThumbnail, generateVideoMetadata, isLoading, isGeneratingMetadata]);

  const handleFileSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          {
            name: "Video Files",
            extensions: ["mp4", "avi", "mov", "mkv", "webm", "flv"],
          },
          {
            name: "Audio Files",
            extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg"],
          },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];

        // Now show loading since user actually selected a file
        setIsLoading(true);

        // Simulate processing delay for video loading
        await new Promise((resolve) => setTimeout(resolve, 800));

        updateConfig("inputFile", filePath);

        if (!config.outputFile) {
          const outputPath = filePath.replace(/\.[^/.]+$/, ".srt");
          updateConfig("outputFile", outputPath);
        }

        // Generate video metadata if it's a video file
        const ext = filePath.split(".").pop()?.toLowerCase();
        const videoExts = ["mp4", "avi", "mov", "mkv", "webm", "flv"];
        if (videoExts.includes(ext || "")) {
          await generateVideoMetadata(filePath);
        }

        showNotification("Input file selected successfully", "success");

        // Enable the Configuration step
        completeStep("input-file");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      showNotification(`Failed to select file: ${errorMsg}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [updateConfig, config.outputFile, showNotification, completeStep, generateVideoMetadata]);

  const handleClearFile = useCallback(() => {
    updateConfig("inputFile", null);
    if (config.outputFile && config.outputFile.endsWith(".srt")) {
      updateConfig("outputFile", null);
    }
    // Clear video metadata and loading states
    setVideoThumbnail(null);
    setVideoMetadata(null);
    setIsGeneratingMetadata(false);
    // Notify parent component that file was removed
    onFileRemoved?.();
  }, [updateConfig, config.outputFile, onFileRemoved]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];
        const supportedTypes = [
          "video/",
          "audio/",
          ".mp4",
          ".avi",
          ".mov",
          ".mkv",
          ".webm",
          ".flv",
          ".mp3",
          ".wav",
          ".flac",
          ".m4a",
          ".aac",
          ".ogg",
        ];

        const isSupported = supportedTypes.some(
          (type) =>
            file.type.startsWith(type) ||
            file.name.toLowerCase().endsWith(type.replace(".", ""))
        );

        if (isSupported) {
          try {
            // Show loading now that we confirmed the file is supported
            setIsLoading(true);

            // Simulate processing delay for video loading
            await new Promise((resolve) => setTimeout(resolve, 800));

            // Get the file path from Electron's File object
            const filePath = (file as any).path;
            
            if (!filePath) {
              throw new Error('Unable to access the file path. Please use the "Browse Files" button to select your video.');
            }
            
            updateConfig("inputFile", filePath);

            if (!config.outputFile) {
              const outputPath = filePath.replace(/\.[^/.]+$/, ".srt");
              updateConfig("outputFile", outputPath);
            }

            // Generate video metadata if it's a video file
            const ext = filePath.split(".").pop()?.toLowerCase();
            const videoExts = ["mp4", "avi", "mov", "mkv", "webm", "flv"];
            if (videoExts.includes(ext || "")) {
              await generateVideoMetadata(filePath);
            }

            showNotification("File selected successfully", "success");

            // Enable the Configuration step
            completeStep("input-file");
          } catch (error) {
            console.error('Error in drag and drop file handling:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred while processing the dropped file';
            showNotification(errorMsg, "error");
          } finally {
            setIsLoading(false);
          }
        } else {
          showNotification("Unsupported file type. Please select a video or audio file.", "error");
        }
      }
    },
    [updateConfig, config.outputFile, showNotification, completeStep, generateVideoMetadata]
  );

  const getFileName = (filePath: string | null): string | null => {
    if (!filePath) return null;
    return filePath.split(/[\\/]/).pop() || null;
  };

  const getFileIcon = (filePath: string | null) => {
    if (!filePath) return <FileIcon />;
    const ext = filePath.split(".").pop()?.toLowerCase();
    const videoExts = ["mp4", "avi", "mov", "mkv", "webm", "flv"];
    const audioExts = ["mp3", "wav", "flac", "m4a", "aac", "ogg"];

    if (videoExts.includes(ext || "")) return <VideoIcon />;
    if (audioExts.includes(ext || "")) return <AudioIcon />;
    return <FileIcon />;
  };

  const getFileType = (filePath: string | null): string => {
    if (!filePath) return "No file selected";
    const ext = filePath.split(".").pop()?.toLowerCase();
    const videoExts = ["mp4", "avi", "mov", "mkv", "webm", "flv"];
    const audioExts = ["mp3", "wav", "flac", "m4a", "aac", "ogg"];

    if (videoExts.includes(ext || "")) return "Video File";
    if (audioExts.includes(ext || "")) return "Audio File";
    return "Media File";
  };

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 2,
          fontWeight: 500,
          color: "text.primary",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        Select Audio/Video File
        <Chip
          label="Required"
          size="small"
          color="primary"
          variant="outlined"
        />
      </Typography>

      {/* Drag & Drop Area */}
      <Paper
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!config.inputFile ? handleFileSelect : undefined}
        sx={{
          p: config.inputFile ? 0 : 4,
          minHeight: config.inputFile ? 240 : 280,
          height: config.inputFile ? 240 : 280,
          border: config.inputFile ? 0 : 2,
          borderStyle: config.inputFile ? "none" : "dashed",
          borderColor: config.inputFile ? "transparent" : (isDragOver ? "primary.main" : "grey.300"),
          backgroundColor: config.inputFile ? "transparent" : (isDragOver ? "primary.50" : "background.paper"),
          transition: "all 0.2s ease-in-out",
          cursor: config.inputFile ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "&:hover": config.inputFile ? {} : {
            borderColor: "primary.main",
            backgroundColor: "primary.50",
          },
        }}
      >
        {config.inputFile ? (
          // Show loading card when generating metadata
          isGeneratingMetadata ? (
            <Card sx={{ 
              width: '100%', 
              height: '100%',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'row',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              {/* Loading thumbnail placeholder */}
              <Box sx={{
                width: 280,
                height: 240,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000000',
                flexShrink: 0
              }}>
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
              <CardContent sx={{ 
                p: 3, 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                height: 240,
                overflow: 'hidden'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, mr: 2, fontSize: '1.1rem' }}>
                    {getFileName(config.inputFile)}
                  </Typography>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    color="error"
                    size="medium"
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>
                
                <Chip
                  icon={<VideoIcon />}
                  label={getFileType(config.inputFile)}
                  size="medium"
                  color="primary"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start', mb: 2 }}
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
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
                  <Typography variant="body2" color="text.secondary">
                    Loading video metadata...
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ) : videoMetadata && videoThumbnail ? (
            <Card sx={{ 
              width: '100%', 
              height: '100%',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'row',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              {/* Thumbnail on the left */}
              <CardMedia
                component="img"
                sx={{
                  width: 280,
                  height: 240,
                  objectFit: 'cover',
                  flexShrink: 0
                }}
                image={videoThumbnail}
                alt="Video thumbnail"
              />
              
              {/* Metadata content on the right */}
              <CardContent sx={{ 
                p: 3, 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                height: 240,
                overflow: 'hidden'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, mr: 2, fontSize: '1.1rem' }}>
                    {getFileName(config.inputFile)}
                  </Typography>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    color="error"
                    size="medium"
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>
                
                <Chip
                  icon={<VideoIcon />}
                  label={getFileType(config.inputFile)}
                  size="medium"
                  color="primary"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start', mb: 2 }}
                />
                
                <Stack spacing={1.5} sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.95rem' }}>
                      Duration: <strong>{videoMetadata.duration}</strong>
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <EditIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.95rem' }}>
                      Resolution: <strong>{videoMetadata.resolution}</strong>
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <FolderIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
                    <Typography 
                      variant="body1" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: '0.85rem',
                        wordBreak: 'break-all',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      <strong>{config.inputFile}</strong>
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            // For non-video files, show a similar card layout but without thumbnail
            <Card sx={{ 
              width: '100%', 
              height: '100%',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'row',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              {/* File icon on the left */}
              <Box sx={{
                width: 280,
                height: 240,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000000',
                color: 'primary.main'
              }}>
                <Box sx={{ fontSize: 80 }}>
                  {getFileIcon(config.inputFile)}
                </Box>
              </Box>
              
              {/* Metadata content on the right */}
              <CardContent sx={{ 
                p: 3, 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                height: 240,
                overflow: 'hidden'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>  
                  <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, mr: 2, fontSize: '1.1rem' }}>
                    {getFileName(config.inputFile)}
                  </Typography>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    color="error"
                    size="medium"
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>
                
                <Chip
                  icon={getFileIcon(config.inputFile)}
                  label={getFileType(config.inputFile)}
                  size="medium"
                  color="success"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start', mb: 2 }}
                />
                
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                    <FolderIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
                    <Typography 
                      variant="body1" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: '0.85rem',
                        wordBreak: 'break-all',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      <strong>{config.inputFile}</strong>
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )
        ) : isLoading ? (
          <Stack alignItems="center" spacing={2}>
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
            <Box textAlign="center">
              <Typography variant="h6" sx={{ mb: 1, color: "text.primary" }}>
                Processing video file...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please wait while we load your media file
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Stack alignItems="center" spacing={2}>
            <UploadIcon
              sx={{
                fontSize: 64,
                color: isDragOver ? "primary.main" : "grey.400",
              }}
            />
            <Box textAlign="center">
              <Typography variant="h6" sx={{ mb: 1, color: "text.primary" }}>
                {isDragOver
                  ? "Drop your file here"
                  : "Choose or drag your file here"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supported formats: MP4, AVI, MOV, MP3, WAV, FLAC, and more
              </Typography>
            </Box>
            <Button
              variant="outlined"
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
