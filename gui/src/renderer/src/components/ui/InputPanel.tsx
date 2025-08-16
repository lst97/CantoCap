import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Typography, Box, Stack, Divider, Chip, Alert, AlertTitle, Snackbar } from '@mui/material';
import {
  FolderOpen as FolderIcon,
  VolumeUp as VolumeIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { FileSelector } from '../forms/FileSelector';
import { VideoPlayer } from './VideoPlayer';
import { useInputStepContent, useStepActions } from '../../stores/useStepStore';
import { VideoMetadata } from '../../stores/types/StoreTypes';

// Type definitions
interface TimeRange {
  start: number;
  end: number;
}

interface WindowSize {
  width: number;
  height: number;
}

interface InputPanelProps {
  initialFile?: string | null;
  initialRange?: TimeRange | null;
  initialJsonFile?: string | null;
  onFileSelect?: (file: string) => void;
  onJsonFileSelect?: (file: string | null) => void;
  onRangeSelect?: (start: number, end: number) => void;
  onMetadataUpdate?: (metadata: VideoMetadata) => void;
}

export const InputPanel: React.FC<InputPanelProps> = React.memo(
  ({ initialFile, initialJsonFile, onFileSelect, onJsonFileSelect, onRangeSelect }) => {
    // Use step store as the single source of truth
    const inputStepContent = useInputStepContent();
    const stepActions = useStepActions();

    // Optimized config derivation with stable reference and memoization
    const config = useMemo(
      () => ({
        inputFile: inputStepContent?.inputFile || inputStepContent?.selectedFile || initialFile,
        importedJsonFile: inputStepContent?.importedJsonFile || initialJsonFile,
        startTime: inputStepContent?.startTime,
        endTime: inputStepContent?.endTime,
        duration: inputStepContent?.duration || 10.0,
        selectedRange: inputStepContent?.selectedRange,
      }),
      [inputStepContent, initialFile, initialJsonFile]
    );

    // Throttled debug logging
    const debugLogRef = useRef<{ lastLog: number; lastInputFile: string | undefined | null }>({
      lastLog: 0,
      lastInputFile: undefined,
    });

    useEffect(() => {
      const now = Date.now();
      const shouldLog =
        process.env.NODE_ENV === 'development' &&
        (now - debugLogRef.current.lastLog > 2000 ||
          debugLogRef.current.lastInputFile !== config.inputFile);

      if (shouldLog) {
        console.log('🔧 [VIDEO DEBUG] InputPanel State Change:', {
          timestamp: new Date().toISOString(),
          props: { initialFile, initialJsonFile },
          inputStepContent: {
            inputFile: inputStepContent?.inputFile,
            importedJsonFile: inputStepContent?.importedJsonFile,
          },
          finalConfig: {
            inputFile: config.inputFile,
            importedJsonFile: config.importedJsonFile,
          },
          hasVideoFile: !!config.inputFile,
          videoPath: config.inputFile,
          willShowVideo: !!config.inputFile,
        });
        debugLogRef.current = { lastLog: now, lastInputFile: config.inputFile };
      }
    }, [
      initialFile,
      initialJsonFile,
      inputStepContent?.inputFile,
      inputStepContent?.importedJsonFile,
      config.inputFile,
      config.importedJsonFile,
    ]);
    const [timeRange, setTimeRange] = useState<TimeRange | null>(null);
    const [isRangeValid, setIsRangeValid] = useState<boolean>(false);
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [windowSize, setWindowSize] = useState<WindowSize>({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);

    const handleTimeRangeChange = useCallback(
      async (range: TimeRange | null) => {
        setTimeRange(range);
        setIsRangeValid(Boolean(range && range.end > range.start && range.end - range.start >= 1));

        try {
          // Save time range using step store
          if (range) {
            const selectedRange = {
              start: range.start,
              end: range.end,
              duration: range.end - range.start
            };
            await stepActions.updateStepContent('input', {
              startTime: range.start,
              endTime: range.end,
              duration: range.end - range.start,
              selectedRange,
              lastModified: Date.now()
            });
            onRangeSelect?.(range.start, range.end);
          } else {
            await stepActions.updateStepContent('input', {
              startTime: null,
              endTime: null,
              duration: 10.0,
              selectedRange: null,
              lastModified: Date.now()
            });
          }

          console.log('Time range updated via step store:', range);
        } catch (err) {
          console.error('Failed to update time range configuration:', err);
        }
      },
      [stepActions, onRangeSelect]
    );

    const handleVideoDurationChange = useCallback((duration: number) => {
      setVideoDuration(duration);
    }, []);

    const handleMediaError = useCallback((error: {
      errorCode: number;
      errorMessage: string;
      src: string;
      originalSrc?: string;
    }) => {
      console.error('🚨 Media Error in InputPanel:', error);
      
      let userFriendlyMessage = 'Unable to load media file.';
      
      // Handle specific error cases
      if (error.errorCode === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
        if (error.errorMessage?.includes('DEMUXER_ERROR_COULD_NOT_OPEN')) {
          userFriendlyMessage = 'Media file not found. The file may have been moved, renamed, or deleted.';
        } else {
          userFriendlyMessage = 'Media format not supported or file is corrupted.';
        }
      } else if (error.errorCode === 2) { // MEDIA_ERR_NETWORK
        userFriendlyMessage = 'Network error loading media file.';
      } else if (error.errorCode === 3) { // MEDIA_ERR_DECODE
        userFriendlyMessage = 'Unable to decode media file. The file may be corrupted.';
      } else if (error.errorCode === 1) { // MEDIA_ERR_ABORTED
        userFriendlyMessage = 'Media loading was aborted.';
      }
      
      setMediaError(userFriendlyMessage);
      setShowErrorSnackbar(true);
    }, []);

    // Sync local timeRange state with global config on mount and when config changes
    useEffect(() => {
      if (config.startTime !== null && config.startTime !== undefined && 
          config.endTime !== null && config.endTime !== undefined) {
        const restoredRange = {
          start: config.startTime,
          end: config.endTime,
        };
        console.log('Restoring time range from config:', restoredRange);
        setTimeRange(restoredRange);
        setIsRangeValid(
          Boolean(
            restoredRange.end > restoredRange.start && restoredRange.end - restoredRange.start >= 1
          )
        );
      } else {
        setTimeRange(null);
        setIsRangeValid(false);
      }
    }, [config.startTime, config.endTime]);

    const handleFileRemoved = useCallback(async () => {
      // Reset video-related state when file is removed
      setTimeRange(null);
      setIsRangeValid(false);
      setVideoDuration(0);

      try {
        await stepActions.updateStepContent('input', {
          startTime: null,
          endTime: null,
          duration: 10.0,
          selectedRange: null,
          lastModified: Date.now()
        });
      } catch (err) {
        console.error('Failed to reset time range configuration:', err);
      }
    }, [stepActions]);

    // Helper function to determine if the range represents the full video (i.e., no real selection)
    const isFullRangeSelected = useCallback(
      (range: TimeRange | null) => {
        if (!range || !videoDuration) return false;
        // Consider it a full range if start is 0 and end is within 1 second of duration
        return range.start === 0 && Math.abs(range.end - videoDuration) < 1;
      },
      [videoDuration]
    );

    // Load existing range from config on mount
    useEffect(() => {
      if (config.startTime !== null && config.startTime !== undefined && 
          config.endTime !== null && config.endTime !== undefined) {
        const existingRange = {
          start: config.startTime,
          end: config.endTime,
        };
        setTimeRange(existingRange);
        setIsRangeValid(
          Boolean(
            existingRange.end > existingRange.start && existingRange.end - existingRange.start >= 1
          )
        );
      }
    }, [config.startTime, config.endTime]);

    // Window resize handler
    useEffect(() => {
      const handleResize = () => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Validate media file when inputFile changes (on app reload)
    useEffect(() => {
      const validateMediaFile = async () => {
        if (!config.inputFile) return;

        try {
          const validation = await window.cantocapAPI.validateMediaFile(config.inputFile);
          if (!validation.isValid) {
            setMediaError(validation.error || 'Media file is not accessible');
            setShowErrorSnackbar(true);
          }
        } catch (error) {
          console.error('Error validating media file:', error);
          setMediaError('Unable to validate media file');
          setShowErrorSnackbar(true);
        }
      };

      validateMediaFile();
    }, [config.inputFile]);

    // Force recalculation when range state changes (affects status alert size)
    useEffect(() => {
      // Trigger a small artificial resize to force recalculation
      // This ensures height calculation updates when status alerts change
      const timeoutId = setTimeout(() => {
        setWindowSize((prev) => ({ ...prev, height: window.innerHeight }));
      }, 0);

      return () => clearTimeout(timeoutId);
    }, [timeRange, isRangeValid]);

    // Calculate available height for Media Preview section
    const getMediaPreviewHeight = useCallback(() => {
      // Dynamic calculation that accounts for actual UI state
      // Fixed UI elements:
      // - TitleBar (40px on macOS, 0px elsewhere) + MainContentArea header (48px) + InputFileStep padding (48px)
      // - InputPanel header (60px) + FileSelector (80px) + Divider (20px) + Media Preview header (40px)
      const fixedUIElements = 336;

      // Dynamic UI elements - Status alerts that change based on timeRange state
      let statusAlertHeight = 0;
      if (timeRange) {
        // "Processing Range Selected" alert with chips - larger height
        if (isRangeValid) {
          statusAlertHeight = 95; // Success alert: title(24px) + chips row(32px) + padding(32px) + margin(8px)
        } else {
          statusAlertHeight = 115; // Warning alert: title(24px) + chips row(32px) + warning text(20px) + padding(32px) + margin(8px)
        }
      } else {
        // "No Range Selected" alert - smaller height
        statusAlertHeight = 75; // Info alert: title(24px) + text(20px) + padding(24px) + margin(8px)
      }

      // Additional margins and safety buffer (reduced due to more precise calculations)
      const marginsAndBuffer = 70;

      const reservedForUI = fixedUIElements + statusAlertHeight + marginsAndBuffer;
      const availableHeight = windowSize.height - reservedForUI;

      // Responsive scaling based on window size
      let usagePercentage = 0.85; // Default for large windows
      let minHeight = 350;

      // Adjust for smaller windows - be more conservative
      if (windowSize.height < 600) {
        usagePercentage = 0.75; // More conservative for small windows
        minHeight = 280;
      } else if (windowSize.height < 800) {
        usagePercentage = 0.8; // Slightly more conservative for medium windows
        minHeight = 320;
      }

      const maxHeight = Math.max(minHeight, availableHeight * usagePercentage);
      const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, availableHeight));

      // Enhanced debug log showing dynamic calculations
      console.log('MediaPreview height calculation:', {
        windowHeight: windowSize.height,
        fixedUIElements,
        statusAlertHeight,
        hasTimeRange: !!timeRange,
        isRangeValid,
        reservedForUI,
        availableHeight,
        usagePercentage,
        minHeight,
        calculatedHeight,
      });

      return calculatedHeight;
    }, [windowSize, timeRange, isRangeValid]);

    return (
      <Box
        sx={{
          width: '100%',
          height: '90%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'transparent',
          overflow: 'visible',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <FolderIcon color='primary' sx={{ fontSize: 24 }} />
          <Typography
            variant='h6'
            component='h2'
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            File Input & Media Preview
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* File Selector */}
            <Box>
              <FileSelector
                onFileRemoved={handleFileRemoved}
                initialFile={config.inputFile}
                initialJsonFile={config.importedJsonFile}
                onFileSelect={onFileSelect}
                onJsonFileSelect={onJsonFileSelect}
              />
            </Box>

            <Divider sx={{ borderColor: 'divider' }} />

            {/* Media Preview & Range Selection - Only show when video is selected */}
            {config.inputFile && (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography
                  variant='h6'
                  sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <VolumeIcon color='primary' />
                  Media Preview & Range Selection
                </Typography>

                {/* Media Preview Container with calculated available height */}
                <Box
                  sx={{
                    height: `${getMediaPreviewHeight()}px`,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible',
                  }}
                >
                  <VideoPlayer
                    src={config.inputFile}
                    onTimeRangeChange={handleTimeRangeChange}
                    onDurationChange={handleVideoDurationChange}
                    onError={handleMediaError}
                    initialRange={timeRange || undefined}
                  />
                </Box>
              </Box>
            )}

            {/* Processing Range Status - Only show when video is selected */}
            {config.inputFile &&
              (timeRange && !isFullRangeSelected(timeRange) ? (
                <Alert
                  severity={isRangeValid ? 'success' : 'warning'}
                  sx={{ mt: 1, flexShrink: 0 }}
                  icon={isRangeValid ? <CheckIcon /> : <TimeIcon />}
                >
                  <AlertTitle>
                    {isRangeValid ? 'Processing Range Selected' : 'Range Selection'}
                  </AlertTitle>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      mt: 1,
                    }}
                  >
                    {timeRange && (
                      <>
                        <Chip
                          label={`Start: ${Math.floor(timeRange.start / 60)}:${(Math.floor(timeRange.start) % 60).toString().padStart(2, '0')}`}
                          size='small'
                          color={isRangeValid ? 'success' : 'warning'}
                          variant='outlined'
                        />
                        <Chip
                          label={`End: ${Math.floor(timeRange.end / 60)}:${(Math.floor(timeRange.end) % 60).toString().padStart(2, '0')}`}
                          size='small'
                          color={isRangeValid ? 'success' : 'warning'}
                          variant='outlined'
                        />
                        <Chip
                          label={`Duration: ${Math.floor((timeRange.end - timeRange.start) / 60)}:${(Math.floor(timeRange.end - timeRange.start) % 60).toString().padStart(2, '0')}`}
                          size='small'
                          color={isRangeValid ? 'success' : 'default'}
                          icon={<TimeIcon />}
                        />
                      </>
                    )}
                  </Box>
                  {!isRangeValid && (
                    <Typography variant='body2' sx={{ mt: 1, color: 'warning.main' }}>
                      Please select a range of at least 1 second for processing.
                    </Typography>
                  )}
                </Alert>
              ) : (
                <Alert severity='info' sx={{ mt: 1, flexShrink: 0 }}>
                  <AlertTitle>No Range Selected</AlertTitle>
                  <Typography variant='body2'>
                    Use the timeline above to select a specific range for processing, or leave
                    unselected to process the entire file.
                  </Typography>
                </Alert>
              ))}
          </Stack>
        </Box>
        
        {/* Media Error Snackbar */}
        <Snackbar
          open={showErrorSnackbar}
          autoHideDuration={8000}
          onClose={() => setShowErrorSnackbar(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setShowErrorSnackbar(false)}
            severity="error"
            variant="filled"
            icon={<ErrorIcon />}
            sx={{ width: '100%' }}
          >
            <AlertTitle>Media Loading Error</AlertTitle>
            {mediaError}
          </Alert>
        </Snackbar>
      </Box>
    );
  }
);

InputPanel.displayName = 'InputPanel';
