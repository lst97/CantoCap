import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { BasicVideoPlayer } from '../VideoPlayer/BasicVideoPlayer'
import { VideoPlayerRange } from '../VideoPlayer/VideoPlayerRange'

interface VideoPlayerProps {
  src?: string
  onTimeRangeChange?: (range: { start: number; end: number } | null) => void
  onDurationChange?: (duration: number) => void
  onError?: (error: {
    errorCode: number;
    errorMessage: string;
    src: string;
    originalSrc?: string;
  }) => void
  initialRange?: { start: number; end: number }
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  onTimeRangeChange,
  onDurationChange,
  onError,
  initialRange
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timeRange, setTimeRange] = useState<{ start: number; end: number } | null>(initialRange || null)
  const [justPausedAtRangeEnd, setJustPausedAtRangeEnd] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)

  // Sync local timeRange with initialRange prop changes
  useEffect(() => {
    if (initialRange !== timeRange) {
      console.log('VideoPlayer: Syncing timeRange with initialRange:', initialRange)
      setTimeRange(initialRange || null)
    }
  }, [initialRange, timeRange])

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    setJustPausedAtRangeEnd(false) // Reset the flag when user manually plays
    // Trigger play on the actual video element
    const videoElement = document.querySelector('video')
    if (videoElement) {
      videoElement.play().catch(console.error)
    }
  }, [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    // Trigger pause on the actual video element
    const videoElement = document.querySelector('video')
    if (videoElement) {
      videoElement.pause()
    }
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
    
    // Reset the pause flag if we're far from the start (user manually seeked or played)
    if (timeRange && justPausedAtRangeEnd && Math.abs(time - timeRange.start) > 0.5) {
      setJustPausedAtRangeEnd(false)
    }
    
    // Range-bound playback logic
    if (timeRange && isPlaying && !justPausedAtRangeEnd) {
      const { start, end } = timeRange
      
      
      // If current time is within the selected range (or very close to boundaries)
      if (time >= start - 0.1 && time <= end + 0.1) {
        // If playback reaches or exceeds the end of the range, seek to start and pause
        if (time >= end - 0.1) {
          const videoElement = document.querySelector('video')
          if (videoElement) {
            videoElement.pause() // Pause FIRST
            setIsPlaying(false) // Update state immediately
            setJustPausedAtRangeEnd(true) // Set flag to prevent immediate re-triggering
            videoElement.currentTime = start // Then seek
            setCurrentTime(start)
            return // Exit early to prevent sync processing
          }
        }
      }
      // If current time is outside the range, allow normal playback (no restrictions)
    }
    
    // Only sync playing state if we didn't just pause the video
    const videoElement = document.querySelector('video')
    if (videoElement) {
      setIsPlaying(!videoElement.paused)
    }
  }, [timeRange, isPlaying, justPausedAtRangeEnd])

  const handleLoadedMetadata = useCallback((dur: number) => {
    setDuration(dur)
    onDurationChange?.(dur)
  }, [onDurationChange])

  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time)
    // Update the actual video element time
    const videoElement = document.querySelector('video')
    if (videoElement) {
      videoElement.currentTime = time
    }
  }, [])

  const handleRangeChange = useCallback((start: number, end: number) => {
    const newRange = { start, end }
    setTimeRange(newRange)
    onTimeRangeChange?.(newRange)
  }, [onTimeRangeChange])

  const handleFullscreen = useCallback(() => {
    // Get the video element from BasicVideoPlayer and request fullscreen
    const videoElement = document.querySelector('video')
    if (videoElement) {
      if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen()
      }
    }
  }, [])

  // Track container size for responsive video player height
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setContainerSize({ width, height })
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Sync playing state with video events
  useEffect(() => {
    const videoElement = document.querySelector('video')
    if (!videoElement) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    videoElement.addEventListener('play', handlePlay)
    videoElement.addEventListener('pause', handlePause)
    videoElement.addEventListener('ended', handleEnded)

    return () => {
      videoElement.removeEventListener('play', handlePlay)
      videoElement.removeEventListener('pause', handlePause)
      videoElement.removeEventListener('ended', handleEnded)
    }
  }, [src]) // Re-run when video source changes

  // Convert local file path to media URL for secure playback
  useEffect(() => {
    const convertMediaSource = async () => {
      if (!src) {
        setMediaUrl(null)
        setIsLoadingMedia(false)
        return
      }

      // Check if it's already a localmedia://, file://, data:// or web URL
      if (src.startsWith('localmedia://') || src.startsWith('file://') || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
        setMediaUrl(src)
        setIsLoadingMedia(false)
        return
      }

      // Convert local file path to media URL
      setIsLoadingMedia(true)
      try {
        const convertedMediaUrl = await window.cantocapAPI.getMediaUrl(src)
        setMediaUrl(convertedMediaUrl)
        console.log('🎬 VideoPlayer: Converted file path to media URL:', { src, convertedMediaUrl })
      } catch (error) {
        console.error('Failed to convert media to URL:', error)
        setMediaUrl(null)
      } finally {
        setIsLoadingMedia(false)
      }
    }

    convertMediaSource()
  }, [src])

  // Keyboard navigation for frame-by-frame control
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const videoElement = document.querySelector('video')
      if (!videoElement || !duration) return

      // Only handle keys when the video player area is focused or visible
      const isVideoPlayerFocused = containerRef.current?.contains(document.activeElement) || 
                                   document.activeElement === document.body

      if (!isVideoPlayerFocused) return

      const frameRate = 30 // Assume 30fps, adjust as needed
      const frameTime = 1 / frameRate

      switch (event.key) {
        case 'ArrowLeft': {
          event.preventDefault()
          // Pause video if playing during frame navigation
          if (isPlaying) {
            handlePause()
          }
          const prevTime = Math.max(0, currentTime - frameTime)
          handleTimeChange(prevTime)
          break
        }

        case 'ArrowRight': {
          event.preventDefault()
          // Pause video if playing during frame navigation
          if (isPlaying) {
            handlePause()
          }
          const nextTime = Math.min(duration, currentTime + frameTime)
          handleTimeChange(nextTime)
          break
        }

        case ' ': // Space bar for play/pause
          event.preventDefault()
          if (isPlaying) {
            handlePause()
          } else {
            handlePlay()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentTime, duration, isPlaying, handleTimeChange, handlePlay, handlePause])

  // Calculate responsive minimum height for BasicVideoPlayer
  const getVideoPlayerMinHeight = useCallback(() => {
    // Adjust minimum height based on container size
    if (containerSize.height < 350) {
      return 150 // Very small containers
    } else if (containerSize.height < 500) {
      return 180 // Small containers
    } else if (containerSize.height < 700) {
      return 220 // Medium containers
    } else {
      return 250 // Large containers
    }
  }, [containerSize])


  return (
    <Box 
      ref={containerRef}
      tabIndex={0}
      sx={{ 
        width: '100%', 
        height: '100%', // Use full container height provided by parent
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'visible', // Allow thumbnail to be visible
        outline: 'none', // Remove focus outline
        '&:focus': {
          outline: 'none'
        }
      }}>
      {/* Basic Video Player - Dynamic height, 100% width */}
      <Box sx={{ 
        width: '100%', 
        height: '100%',
        minHeight: getVideoPlayerMinHeight(), // Responsive minimum height
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {isLoadingMedia && (
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            zIndex: 10,
            color: 'white'
          }}>
            Loading media...
          </Box>
        )}
        
        <BasicVideoPlayer
          src={mediaUrl || src}
          currentTime={currentTime}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={onError}
          showVolumeControl={false}
          showFullscreenButton={false}
          showSkipButtons={false}
          className="video-player-main"
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
        />
      </Box>
      
      {/* Video Player Range Component - Fixed compact size at bottom */}
      <Box sx={{ 
        width: '100%', 
        height: 140, // Reduced fixed size for controls
        minHeight: 140, // Ensure minimum space
        maxHeight: 140, // Prevent expansion
        flexShrink: 0, // Don't shrink this container
        borderTop: '1px solid #333',
        overflow: 'visible' // Allow thumbnail to overflow
      }}>
        <VideoPlayerRange
          duration={duration}
          currentTime={currentTime}
          startTime={timeRange?.start || 0}
          endTime={timeRange?.end || duration}
          onRangeChange={handleRangeChange}
          onTimeChange={handleTimeChange}
          onPlay={handlePlay}
          onPause={handlePause}
          isPlaying={isPlaying}
          onFullscreen={handleFullscreen}
          className="video-player-range"
        />
      </Box>
    </Box>
  )
}