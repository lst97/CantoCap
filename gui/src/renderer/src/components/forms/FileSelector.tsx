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
  ImportExport as ImportIcon,
  Attachment as AttachmentIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useAppStore } from "../../stores/app-store";
import { useWorkflowStore } from "../../stores/workflow-store";
import { navigateToReviewFromJsonImport, synchronizeWorkflowState } from "../../utils/workflow-navigation";
import { atomicFileUpload, atomicJsonNavigation, batchStateUpdates } from "../../utils/step-state-controller";

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
  // Use app store for fallback, but prioritize passed props
  const { config: appConfig, updateConfig, showNotification } = useAppStore();
  
  // Prioritize workspace config passed via props
  const config = {
    ...appConfig,
    inputFile: initialFile !== undefined ? initialFile : appConfig.inputFile,
    importedJsonFile: initialJsonFile !== undefined ? initialJsonFile : appConfig.importedJsonFile
  };
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
  const [isImportingJson, setIsImportingJson] = useState(false);

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

        console.log('📁 Saving video file with atomic operations');
        
        // Use atomic file upload to coordinate all state updates
        await atomicFileUpload('video', filePath, {
          resetSteps: true,
          completeInputStep: true
        });
        
        // Save the input file - prioritize prop callback, fallback to updateConfig
        if (onFileSelect) {
          onFileSelect(filePath);
        } else {
          updateConfig("inputFile", filePath);
        }

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

        showNotification("Video file selected and auto-saved successfully", "success");
        console.log('✅ Video selection and atomic step updates completed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      showNotification(`Failed to select file: ${errorMsg}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [updateConfig, config.outputFile, showNotification, completeStep, generateVideoMetadata, onFileSelect]);

  const handleClearFile = useCallback(async () => {
    console.log('🗑️ Removing video file with atomic operations');
    
    // Use atomic file upload to coordinate all state updates
    await atomicFileUpload('video', null, {
      resetSteps: true,
      completeInputStep: false
    });
    
    // Clear the input file - prioritize prop callback, fallback to updateConfig
    if (onFileSelect) {
      onFileSelect(null);
    } else {
      updateConfig("inputFile", null);
    }
    
    // Clear related output file if it's auto-generated
    if (config.outputFile && config.outputFile.endsWith(".srt")) {
      updateConfig("outputFile", null);
    }
    
    // Also clear imported JSON caption if it exists
    if (config.importedJsonFile) {
      updateConfig("subtitle", null);
      
      // Use workspace config callback if available, fallback to app store
      if (onJsonFileSelect) {
        onJsonFileSelect(null);
      } else {
        updateConfig("importedJsonFile", null);
      }
    }
    
    // Clear video metadata and loading states
    setVideoThumbnail(null);
    setVideoMetadata(null);
    setIsGeneratingMetadata(false);
    
    // Notify parent component that file was removed
    onFileRemoved?.();
    
    showNotification("Video file removed and changes auto-saved", "info");
    console.log('✅ Video removal and atomic step updates completed');
  }, [updateConfig, config.outputFile, config.importedJsonFile, onFileRemoved, showNotification, onFileSelect, onJsonFileSelect]);

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

            console.log('📁 Drag & drop: Saving video file and auto-saving to workspace');

            // Get the file path from Electron's File object
            const filePath = (file as any).path;
            
            if (!filePath) {
              throw new Error('Unable to access the file path. Please use the "Browse Files" button to select your video.');
            }
            
            // Use atomic file upload to coordinate all state updates
            await atomicFileUpload('video', filePath, {
              resetSteps: true,
              completeInputStep: true
            });
            
            // Save the input file - prioritize prop callback, fallback to updateConfig
            if (onFileSelect) {
              onFileSelect(filePath);
            } else {
              updateConfig("inputFile", filePath);
            }

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

            showNotification("Video file dropped and auto-saved successfully", "success");
            console.log('✅ Drag & drop with atomic step updates completed');
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
    [updateConfig, config.outputFile, showNotification, completeStep, generateVideoMetadata, onFileSelect, onJsonFileSelect]
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

  // JSON validation function
  const validateCantocapJson = (jsonData: any): boolean => {
    console.log('🔍 Starting JSON validation...');
    
    if (!jsonData || typeof jsonData !== 'object') {
      console.error('❌ JSON validation failed: Invalid JSON object');
      return false;
    }
    
    // Check for required structure with enhanced logging
    if (!jsonData.metadata || !jsonData.subtitles) {
      console.error('❌ JSON validation failed: Missing metadata or subtitles', {
        hasMetadata: !!jsonData.metadata,
        hasSubtitles: !!jsonData.subtitles,
        availableKeys: Object.keys(jsonData)
      });
      return false;
    }
    
    // Validate metadata
    const { metadata } = jsonData;
    if (!metadata.format || !metadata.version) {
      console.error('❌ JSON validation failed: Invalid metadata structure', metadata);
      return false;
    }
    
    // Check if it's CantoCap format
    if (!metadata.format.includes('CantoCap')) {
      console.error('❌ JSON validation failed: Not CantoCap format', metadata.format);
      return false;
    }
    
    // Validate subtitles array
    const { subtitles } = jsonData;
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      console.error('❌ JSON validation failed: Invalid subtitles array', {
        isArray: Array.isArray(subtitles),
        length: subtitles?.length
      });
      return false;
    }
    
    console.log('🔍 Validating', subtitles.length, 'subtitles...');
    
    // Enhanced subtitle structure validation with tolerance
    const validSubtitles = subtitles.filter((sub: any, index: number) => {
      const hasValidIndex = typeof sub.index === 'number';
      const hasValidTiming = typeof sub.startTime === 'number' && typeof sub.endTime === 'number' && sub.endTime > sub.startTime;
      const hasValidCaption = typeof sub.caption === 'string' && sub.caption.trim().length > 0;
      const hasValidTranslation = sub.translation === undefined || typeof sub.translation === 'string';
      
      const isValid = hasValidIndex && hasValidTiming && hasValidCaption && hasValidTranslation;
      
      if (!isValid && index < 5) { // Log first 5 invalid subtitles for debugging
        console.warn(`⚠️ Subtitle ${index} failed validation:`, {
          hasValidIndex,
          hasValidTiming,
          hasValidCaption,
          hasValidTranslation,
          original: sub
        });
      }
      
      return isValid;
    });
    
    const validationRatio = validSubtitles.length / subtitles.length;
    console.log(`📊 JSON validation result: ${validSubtitles.length}/${subtitles.length} valid subtitles (${(validationRatio * 100).toFixed(1)}%)`);
    
    // CRITICAL FIX: Accept JSON if at least 90% of subtitles are valid (more tolerant)
    // This prevents rejecting good JSON files due to a few problematic subtitles
    const isValid = validationRatio >= 0.9;
    
    if (!isValid) {
      console.error(`❌ JSON validation failed: Only ${(validationRatio * 100).toFixed(1)}% of subtitles are valid (minimum 90% required)`);
    } else {
      console.log('✅ JSON validation passed successfully');
    }
    
    return isValid;
  };

  // Convert CantoCap JSON to Step 4 format
  const convertJsonToStep4Format = (jsonData: any) => {
    const { subtitles } = jsonData;
    
    if (!Array.isArray(subtitles)) {
      console.error('❌ Subtitles is not an array:', subtitles);
      return [];
    }
    
    console.log('🔄 Converting', subtitles.length, 'subtitles from JSON format');
    
    return subtitles.map((sub: any, index: number) => {
      // CRITICAL FIX: Proper ID generation to ensure string IDs and handle zero-based indexing
      const subtitleId = sub.index !== undefined ? String(sub.index) : `imported_${index}`;
      
      // CRITICAL FIX: Better field mapping and validation
      const converted = {
        id: subtitleId,
        index: sub.index !== undefined ? sub.index : index,
        startTime: Number(sub.startTime) || 0,
        endTime: Number(sub.endTime) || 0,
        duration: Number(sub.endTime || 0) - Number(sub.startTime || 0),
        text: String(sub.caption || sub.text || '').trim(),
        translation: String(sub.translation || '').trim(),
        confidence: Number(sub.confidence) || 0,
        speaker: sub.speaker || null,
        isMusic: Boolean(sub.isMusic || false)
      };
      
      // Log conversion details for debugging missing subtitles
      if (index < 3) { // Log first 3 for debugging
        console.log(`📝 Subtitle ${index} conversion:`, {
          original: { index: sub.index, caption: sub.caption, text: sub.text },
          converted: { id: converted.id, text: converted.text }
        });
      }
      
      // Validation: Ensure we have essential data
      if (!converted.text) {
        console.warn(`⚠️ Subtitle ${index} has empty text after conversion:`, sub);
      }
      
      if (converted.startTime >= converted.endTime) {
        console.warn(`⚠️ Subtitle ${index} has invalid timing:`, { 
          start: converted.startTime, 
          end: converted.endTime 
        });
      }
      
      return converted;
    }).filter(sub => {
      // CRITICAL FIX: Filter out invalid subtitles that could cause data loss
      const isValid = sub.text.length > 0 && sub.endTime > sub.startTime;
      if (!isValid) {
        console.warn('❌ Filtering out invalid subtitle:', sub);
      }
      return isValid;
    });
  };

  // Handle JSON import
  const handleJsonImport = useCallback(async () => {
    const importStartTime = performance.now();
    let importSuccess = false;
    try {
      setIsImportingJson(true);
      console.log('🔄 Starting JSON import process...', {
        timestamp: new Date().toISOString(),
        currentConfig: {
          hasInputFile: !!config.inputFile,
          hasSubtitle: !!config.subtitle,
          hasImportedJson: !!config.importedJsonFile
        }
      });
      
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          {
            name: "JSON Files",
            extensions: ["json"],
          },
          { name: "All Files", extensions: ["*"] },
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
          showNotification('Invalid CantoCap JSON format. Please select a valid subtitle export file.', 'error');
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
          dataLossDetected: (jsonContent.subtitles?.length || 0) !== convertedSubtitles.length
        });
        
        // CRITICAL: Check for data loss
        if ((jsonContent.subtitles?.length || 0) !== convertedSubtitles.length) {
          const lostCount = (jsonContent.subtitles?.length || 0) - convertedSubtitles.length;
          console.warn(`⚠️ DATA LOSS DETECTED: ${lostCount} subtitles were filtered out during conversion`);
          showNotification(`Warning: ${lostCount} subtitles were filtered out due to invalid data`, 'warning');
        }
        
        // Store subtitle data as temp file for persistence across app restarts
        const tempResult = await window.cantocapAPI.storeTempSubtitleData(convertedSubtitles);
        if (!tempResult.success) {
          console.error('❌ Failed to store temp subtitle data:', tempResult.error);
        } else {
          console.log('📄 Subtitle data stored in temp file:', tempResult.tempFilePath);
        }
        
        // FIXED: Use managed batch operations to prevent race conditions
        const { executeInBatch } = await import('../../utils/json-import-batch-manager');
        
        await executeInBatch(async () => {
          console.log('🔄 Applying batched config updates...');
          
          // Perform all config updates atomically
          updateConfig('subtitle', convertedSubtitles);
          
          // Use workspace config callback if available, fallback to app store
          if (onJsonFileSelect) {
            onJsonFileSelect(filePath);
          } else {
            updateConfig('importedJsonFile', filePath);
          }
          
          updateConfig('isImportedFromJson', true);
          
          // Add duration if available from metadata
          if (jsonContent.metadata?.statistics?.totalDuration) {
            updateConfig('duration', jsonContent.metadata.statistics.totalDuration);
          }
          
          // CRITICAL FIX: Complete input-file step for JSON imports
          // JSON imports should count as completing the input step since we have content to process
          const workflowStore = useWorkflowStore.getState();
          workflowStore.completeStep('input-file');
          console.log('✅ Input-file step completed for JSON import');
          
          console.log('✅ Atomic config batch completed:', {
            subtitleCount: convertedSubtitles.length,
            importedFile: filePath,
            inputStepCompleted: true
          });
        });
        
        // CRITICAL FIX: Trigger managed session integration after batch completes
        console.log('🔄 Initiating post-batch session integration');
        
        const { isJsonImportBatchActive, getDeferredJsonIntegration } = await import('../../utils/json-import-batch-manager');
        
        // Use a shorter delay since batch manager handles timing
        setTimeout(async () => {
          try {
            // Verify batch is complete using manager
            if (isJsonImportBatchActive()) {
              console.warn('⚠️ Batch still active per manager, skipping integration');
              return;
            }
            
            // Check for any deferred integration
            const deferredIntegration = getDeferredJsonIntegration();
            if (deferredIntegration) {
              console.log('🔄 Processing deferred JSON integration:', deferredIntegration);
            }
            
            const { handleJsonImportWithSessionReset } = await import('../../utils/session-workflow-integration');
            
            const result = await handleJsonImportWithSessionReset(convertedSubtitles, {
              sourceType: 'json-import-fileselector',
              timestamp: Date.now(),
              metadata: {
                fileName: filePath,
                subtitleCount: convertedSubtitles.length,
                triggeredBy: 'fileselector-managed-batch',
                hadDeferredIntegration: !!deferredIntegration
              }
            });
            
            if (result.success) {
              console.log('✅ Post-batch session integration completed successfully:', result);
            } else {
              console.warn('⚠️ Post-batch session integration failed:', result.error);
            }
          } catch (error) {
            console.warn('⚠️ Could not load session integration after batch:', error);
          }
        }, 150); // Reduced delay since manager handles timing
        
        showNotification('JSON subtitles imported successfully!', 'success');
        console.log('✅ JSON import complete, navigating to review step...');
        
        // Enhanced atomic navigation with proper timing coordination
        try {
          // Brief delay to ensure all config updates have been processed
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Synchronize workflow state to ensure consistency
          const syncSuccess = await synchronizeWorkflowState();
          if (!syncSuccess) {
            console.warn('⚠️ Workflow state synchronization failed, proceeding with navigation anyway');
          }
          
          // Additional delay before navigation to ensure session integration completes
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Perform atomic navigation
          const navigationResult = navigateToReviewFromJsonImport({
            sourceType: 'json-import',
            timestamp: Date.now(),
            metadata: {
              fileName: filePath,
              subtitleCount: convertedSubtitles.length,
              hasMetadata: !!jsonContent.metadata,
              importedAt: new Date().toISOString()
            }
          });
          
          if (navigationResult.success) {
            importSuccess = true;
            console.log('✅ Atomic JSON import navigation completed successfully');
            showNotification('🎉 JSON import complete! Ready for review.', 'success');
            
            // Additional UI state optimization - ensure React re-renders
            setTimeout(() => {
              showNotification('Navigation to Review step completed!', 'info');
            }, 100);
          } else {
            console.error('❌ Atomic navigation failed:', navigationResult.error);
            showNotification(`Navigation failed: ${navigationResult.error}`, 'error');
            
            // Enhanced error recovery with state synchronization
            try {
              // Attempt rollback if available
              if (navigationResult.rollback) {
                console.log('🔄 Attempting atomic rollback...');
                navigationResult.rollback();
                
                // Re-synchronize after rollback
                await synchronizeWorkflowState();
                showNotification('Workflow state restored. Please try again or navigate manually.', 'warning');
              } else {
                showNotification('Please manually navigate to Review step to continue.', 'warning');
              }
            } catch (rollbackError) {
              console.error('❌ Rollback failed:', rollbackError);
              showNotification('Recovery failed. Please restart the application if needed.', 'error');
            }
          }
        } catch (navError) {
          console.error('❌ Atomic navigation error:', navError);
          showNotification('Navigation system error. Please manually go to Review step.', 'error');
          
          // Final fallback - attempt to restore a known good state
          try {
            await synchronizeWorkflowState();
            showNotification('Attempted state recovery. Please try navigation again.', 'info');
          } catch (syncError) {
            console.error('❌ State recovery failed:', syncError);
          }
        }
      }
    } catch (error) {
      console.error('❌ JSON import error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showNotification(`Failed to import JSON: ${errorMsg}`, 'error');
      
      // Enhanced error logging with context
      console.error('💥 JSON import failed with context:', {
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        currentConfig: {
          hasInputFile: !!config.inputFile,
          hasSubtitle: !!config.subtitle,
          hasImportedJson: !!config.importedJsonFile
        },
        importTime: performance.now() - importStartTime
      });
    } finally {
      setIsImportingJson(false);
      const totalImportTime = performance.now() - importStartTime;
      console.log('🔄 JSON import process finished', {
        totalTime: `${totalImportTime.toFixed(2)}ms`,
        success: importSuccess,
        timestamp: new Date().toISOString()
      });
      
      // Performance warning for slow imports
      if (totalImportTime > 5000) { // 5 seconds
        console.warn(`⚠️ Slow JSON import detected: ${totalImportTime.toFixed(2)}ms`);
        showNotification('JSON import completed but took longer than expected', 'warning');
      }
    }
  }, [updateConfig, showNotification, completeStep]);

  // Handle JSON caption removal
  const handleRemoveJsonCaption = useCallback(async () => {
    console.log('🗑️ Removing imported JSON caption with atomic operations');
    
    // Use atomic JSON file operation to coordinate all state updates
    await atomicFileUpload('json', null, {
      resetSteps: false // Don't reset all steps, just config->export
    });
    
    // Clear subtitle data and imported file path
    updateConfig('subtitle', null);
    
    // Use workspace config callback if available, fallback to app store
    if (onJsonFileSelect) {
      onJsonFileSelect(null);
    } else {
      updateConfig('importedJsonFile', null);
    }
    
    // Reset workflow from config step when JSON is removed using atomic operation
    const { atomicStepReset } = await import('../../utils/step-state-controller');
    await atomicStepReset('config', 'export', true);
    
    // Ensure config step is accessible and completed if we have input file
    if (config.inputFile) {
      const workflowStore = useWorkflowStore.getState();
      workflowStore.completeStep('input-file');
    }
    
    showNotification('Imported subtitle removed. You can now configure subtitle generation.', 'info');
    console.log('✅ JSON caption removal with atomic operations completed');
  }, [updateConfig, config.inputFile, showNotification, onJsonFileSelect]);

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
                  
                  {/* Imported JSON Caption Path and Import Button - Horizontal Layout */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    {config.importedJsonFile ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                        <AttachmentIcon sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0, overflow: 'hidden' }}>
                          <Typography 
                            variant="body1" 
                            color="success.main" 
                            sx={{ 
                              fontSize: '0.85rem',
                              wordBreak: 'break-all',
                              lineHeight: 1.3,
                              overflow: 'hidden'
                            }}
                          >
                            Captions: <strong>{config.importedJsonFile}</strong>
                          </Typography>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveJsonCaption();
                            }}
                            size="small"
                            sx={{ 
                              color: 'error.main',
                              padding: '2px',
                              flexShrink: 0,
                              '&:hover': {
                                backgroundColor: 'error.lighter'
                              }
                            }}
                            title="Remove imported caption"
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1 }} />
                    )}
                    
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isImportingJson ? <CircularProgress size={16} /> : <ImportIcon />}
                      onClick={handleJsonImport}
                      disabled={isImportingJson}
                      sx={{ 
                        fontSize: '0.8rem',
                        px: 2,
                        py: 0.5,
                        minWidth: 'unset',
                        flexShrink: 0
                      }}
                    >
                      {isImportingJson ? 'Importing...' : 'Import Caption'}
                    </Button>
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
                        WebkitLineClamp: 2,
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
                
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%', mb: 2 }}>
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
                  
                  {/* Imported JSON Caption Path and Import Button - Horizontal Layout */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    {config.importedJsonFile ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                        <AttachmentIcon sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0, overflow: 'hidden' }}>
                          <Typography 
                            variant="body1" 
                            color="success.main" 
                            sx={{ 
                              fontSize: '0.85rem',
                              wordBreak: 'break-all',
                              lineHeight: 1.3,
                              overflow: 'hidden'
                            }}
                          >
                            Captions: <strong>{config.importedJsonFile}</strong>
                          </Typography>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveJsonCaption();
                            }}
                            size="small"
                            sx={{ 
                              color: 'error.main',
                              padding: '2px',
                              flexShrink: 0,
                              '&:hover': {
                                backgroundColor: 'error.lighter'
                              }
                            }}
                            title="Remove imported caption"
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1 }} />
                    )}
                    
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isImportingJson ? <CircularProgress size={16} /> : <ImportIcon />}
                      onClick={handleJsonImport}
                      disabled={isImportingJson}
                      sx={{ 
                        fontSize: '0.8rem',
                        px: 2,
                        py: 0.5,
                        minWidth: 'unset',
                        flexShrink: 0
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
