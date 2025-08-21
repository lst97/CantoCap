import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, IconButton, Slider, Tooltip } from '@mui/material';
import { createComponentLogger } from '../../utils/logger';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeOffIcon,
  Fullscreen as FullscreenIcon,
  Replay10 as Skip10BackIcon,
  Forward10 as Skip10ForwardIcon,
} from '@mui/icons-material';

interface BasicVideoPlayerProps {
  src?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onError?: (error: {
    errorCode: number;
    errorMessage: string;
    src: string;
    originalSrc?: string;
  }) => void;
  showVolumeControl?: boolean;
  showFullscreenButton?: boolean;
  showSkipButtons?: boolean;
  autoPlay?: boolean;
  className?: string;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  selectedSubtitle?: {
    id: string;
    startTime: number;
    endTime: number;
  };
  autoReturnToStart?: boolean;
  isJumpTriggered?: boolean; // New prop to indicate explicit jump action
}

export const BasicVideoPlayer: React.FC<BasicVideoPlayerProps> = React.memo(
  ({
    src,
    currentTime = 0,
    onTimeUpdate,
    onLoadedMetadata,
    onError,
    showVolumeControl = true,
    showFullscreenButton = true,
    showSkipButtons = true,
    autoPlay = false,
    className,
    isPlaying: externalIsPlaying,
    onPlay: externalOnPlay,
    onPause: externalOnPause,
    selectedSubtitle,
    autoReturnToStart = false,
    isJumpTriggered = false,
  }) => {
    const logger = createComponentLogger('BasicVideoPlayer');
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasExternalControl, setHasExternalControl] = useState(false);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [, setContainerSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Refs for debounced time sync and subtitle boundary management
    const lastSyncTimeRef = useRef<number>(0);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isJumpingToSubtitleRef = useRef<boolean>(false);

    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = useCallback(() => {
      if (!videoRef.current) return;

      if (hasExternalControl) {
        // Use external control if available
        if (isPlaying) {
          externalOnPause?.();
        } else {
          externalOnPlay?.();
        }
      } else {
        // Use internal control
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    }, [isPlaying, hasExternalControl, externalOnPlay, externalOnPause]);

    const handleTimeUpdateInternal = useCallback(() => {
      if (!videoRef.current) return;
      const time = videoRef.current.currentTime;
      
      // Handle subtitle boundary checking for auto-pause and return
      // Only trigger auto-pause if this was an explicit jump (isJumpingToSubtitleRef is true)
      if (autoReturnToStart && selectedSubtitle && isJumpingToSubtitleRef.current) {
        // Check if we've reached the end of the selected subtitle
        if (time >= selectedSubtitle.endTime) {
          // Pause the video
          videoRef.current.pause();
          setIsPlaying(false);
          externalOnPause?.();
          
          // Jump back to start time with a small delay to ensure smooth playback
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = selectedSubtitle.startTime;
              onTimeUpdate?.(selectedSubtitle.startTime);
            }
            isJumpingToSubtitleRef.current = false;
          }, 50);
          
          return;
        }
      }
      
      onTimeUpdate?.(time);
    }, [onTimeUpdate, autoReturnToStart, selectedSubtitle, externalOnPause]);

    const handleLoadedMetadataInternal = useCallback(() => {
      if (!videoRef.current) return;
      const dur = videoRef.current.duration;
      setDuration(dur);
      onLoadedMetadata?.(dur);
    }, [onLoadedMetadata]);

    const handleVolumeChange = useCallback((_: Event, value: number | number[]) => {
      if (!videoRef.current) return;
      const newVolume = Array.isArray(value) ? value[0] : value;
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }, []);

    const handleMuteToggle = useCallback(() => {
      if (!videoRef.current) return;
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }, [isMuted]);

    const handleFullscreen = useCallback(() => {
      if (!videoRef.current) return;
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }, []);

    const handleSkip10Back = useCallback(() => {
      if (!videoRef.current) return;
      const newTime = Math.max(0, videoRef.current.currentTime - 10);
      videoRef.current.currentTime = newTime;
      onTimeUpdate?.(newTime);
    }, [onTimeUpdate]);

    const handleSkip10Forward = useCallback(() => {
      if (!videoRef.current) return;
      const newTime = Math.min(duration, videoRef.current.currentTime + 10);
      videoRef.current.currentTime = newTime;
      onTimeUpdate?.(newTime);
    }, [duration, onTimeUpdate]);


    // Debounced sync external currentTime with video to prevent oscillation
    useEffect(() => {
      if (!videoRef.current) return;
      
      const timeDifference = Math.abs(videoRef.current.currentTime - currentTime);
      const now = Date.now();
      
      // Only sync if:
      // 1. The time difference is significant (> 0.5s to avoid micro-adjustments)
      // 2. Enough time has passed since the last sync (debounce)
      // 3. We're not in the middle of a subtitle jump
      if (timeDifference > 0.5 && 
          (now - lastSyncTimeRef.current) > 200 && 
          !isJumpingToSubtitleRef.current) {
        
        // Clear any existing sync timeout
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        
        // Debounced sync with 100ms delay
        syncTimeoutRef.current = setTimeout(() => {
          if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
            videoRef.current.currentTime = currentTime;
            lastSyncTimeRef.current = Date.now();
          }
        }, 100);
      }
      
      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
      };
    }, [currentTime]);

    // Detect when jumping to a selected subtitle (only when explicitly triggered)
    useEffect(() => {
      if (selectedSubtitle && autoReturnToStart && isJumpTriggered) {
        // Set the flag to indicate we're jumping to a subtitle
        isJumpingToSubtitleRef.current = true;
        
        // Clear the flag after a reasonable time if not cleared by boundary detection
        const timeoutId = setTimeout(() => {
          isJumpingToSubtitleRef.current = false;
        }, (selectedSubtitle.endTime - selectedSubtitle.startTime) * 1000 + 1000);

        return () => {
          clearTimeout(timeoutId);
        };
      } else {
        // If not jumping explicitly, clear the flag
        isJumpingToSubtitleRef.current = false;
      }
    }, [selectedSubtitle, autoReturnToStart, isJumpTriggered]);

    // Check if external control is being used
    useEffect(() => {
      setHasExternalControl(!!externalOnPlay && !!externalOnPause);
    }, [externalOnPlay, externalOnPause]);

    // Sync external playing state and control video element
    useEffect(() => {
      if (hasExternalControl && externalIsPlaying !== undefined) {
        setIsPlaying(externalIsPlaying);

        // Actually control the video element based on external state
        if (videoRef.current) {
          if (externalIsPlaying) {
            videoRef.current.play().catch((error) => {
              console.error('🎬 VideoPlayer play() failed:', {
                name: error.name,
                code: error.code,
                src: videoRef.current?.src,
                readyState: videoRef.current?.readyState,
                networkState: videoRef.current?.networkState,
                error: videoRef.current?.error
              });
            });
          } else {
            videoRef.current.pause();
          }
        }
      }
    }, [externalIsPlaying, hasExternalControl]);

    // Container resize observer for responsive behavior (throttled)
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let resizeTimeout: NodeJS.Timeout;
      const resizeObserver = new ResizeObserver((entries) => {
        // Throttle resize updates to improve performance
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const entry = entries[0];
          if (entry) {
            const { width, height } = entry.contentRect;
            setContainerSize({ width, height });
          }
        }, 50);
      });

      resizeObserver.observe(container);
      return () => {
        resizeObserver.disconnect();
        clearTimeout(resizeTimeout);
      };
    }, []);

    // Auto-hide controls
    useEffect(() => {
      let hideTimeout: NodeJS.Timeout;

      const showControlsTemporarily = () => {
        setShowControls(true);
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
          if (isPlaying) {
            setShowControls(false);
          }
        }, 3000);
      };

      const handleMouseMove = () => showControlsTemporarily();
      const handleMouseLeave = () => {
        if (isPlaying) {
          hideTimeout = setTimeout(() => setShowControls(false), 1000);
        }
      };

      if (videoRef.current) {
        const video = videoRef.current;
        video.addEventListener('mousemove', handleMouseMove);
        video.addEventListener('mouseleave', handleMouseLeave);

        return () => {
          video.removeEventListener('mousemove', handleMouseMove);
          video.removeEventListener('mouseleave', handleMouseLeave);
          clearTimeout(hideTimeout);
        };
      }
    }, [isPlaying]);

    if (!src) {
      return (
        <Box
          className={className}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            borderRadius: 1,
            color: 'white',
          }}
        >
          No media source provided
        </Box>
      );
    }


    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{
          position: 'relative',
          backgroundColor: '#000',
          borderRadius: 1,
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => !isPlaying && setShowControls(true)}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <video
            ref={videoRef}
            src={src}
            onTimeUpdate={handleTimeUpdateInternal}
            onLoadedMetadata={handleLoadedMetadataInternal}
            onError={(e) => {
              const mediaElement = e.target as HTMLVideoElement;
              const errorDetails = {
                src: mediaElement.src,
                originalSrc: src,
                errorCode: mediaElement.error?.code || 0,
                errorMessage: mediaElement.error?.message || 'Unknown media error',
                readyState: mediaElement.readyState,
                networkState: mediaElement.networkState,
                currentSrc: mediaElement.currentSrc,
                isMediaUrl: mediaElement.src?.startsWith('localmedia://'),
                isFileUrl: mediaElement.src?.startsWith('file://'),
                mediaError: {
                  MEDIA_ERR_ABORTED: 1,
                  MEDIA_ERR_NETWORK: 2,
                  MEDIA_ERR_DECODE: 3,
                  MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
                },
                errorCodeMeaning: mediaElement.error?.code === 1 ? 'MEDIA_ERR_ABORTED' :
                                 mediaElement.error?.code === 2 ? 'MEDIA_ERR_NETWORK' :
                                 mediaElement.error?.code === 3 ? 'MEDIA_ERR_DECODE' :
                                 mediaElement.error?.code === 4 ? 'MEDIA_ERR_SRC_NOT_SUPPORTED' :
                                 'UNKNOWN'
              };
              
              logger.error('🎬 Media onError event', errorDetails);
              
              // Propagate error to parent component
              onError?.({
                errorCode: errorDetails.errorCode,
                errorMessage: errorDetails.errorMessage,
                src: errorDetails.src,
                originalSrc: errorDetails.originalSrc
              });
            }}
            autoPlay={autoPlay}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>

        {/* Controls Overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
            p: 2,
            opacity: showControls ? 1 : 0,
            transition: 'opacity 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Time Display */}
          <Box sx={{ color: 'white', fontSize: '0.875rem', fontFamily: 'monospace', minWidth: 80 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Box>

          {/* Skip Back */}
          {showSkipButtons && (
            <Tooltip title='Skip 10s back'>
              <IconButton onClick={handleSkip10Back} sx={{ color: 'white' }} size='small'>
                <Skip10BackIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Play/Pause */}
          <IconButton onClick={handlePlayPause} sx={{ color: 'white' }}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>

          {/* Skip Forward */}
          {showSkipButtons && (
            <Tooltip title='Skip 10s forward'>
              <IconButton onClick={handleSkip10Forward} sx={{ color: 'white' }} size='small'>
                <Skip10ForwardIcon />
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ flex: 1 }} />

          {/* Volume Control */}
          {showVolumeControl && (
            <>
              <IconButton onClick={handleMuteToggle} sx={{ color: 'white' }} size='small'>
                {isMuted ? <VolumeOffIcon /> : <VolumeIcon />}
              </IconButton>

              <Slider
                value={volume}
                onChange={handleVolumeChange}
                min={0}
                max={1}
                step={0.1}
                sx={{
                  width: 80,
                  color: 'white',
                  '& .MuiSlider-thumb': {
                    color: 'white',
                  },
                  '& .MuiSlider-track': {
                    color: 'white',
                  },
                  '& .MuiSlider-rail': {
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
                size='small'
              />
            </>
          )}

          {/* Fullscreen */}
          {showFullscreenButton && (
            <Tooltip title='Fullscreen'>
              <IconButton onClick={handleFullscreen} sx={{ color: 'white' }} size='small'>
                <FullscreenIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Center Play Button */}
        {!isPlaying && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '50%',
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            onClick={handlePlayPause}
          >
            <PlayIcon sx={{ fontSize: 32, color: 'white' }} />
          </Box>
        )}
      </Box>
    );
  }
);

BasicVideoPlayer.displayName = 'BasicVideoPlayer';
