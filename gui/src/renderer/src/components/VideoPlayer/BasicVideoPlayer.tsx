import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Box,
  IconButton,
  Slider,
  Tooltip
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeOffIcon,
  Fullscreen as FullscreenIcon,
  Replay10 as Skip10BackIcon,
  Forward10 as Skip10ForwardIcon
} from '@mui/icons-material'

interface BasicVideoPlayerProps {
  src?: string
  currentTime?: number
  onTimeUpdate?: (time: number) => void
  onLoadedMetadata?: (duration: number) => void
  showVolumeControl?: boolean
  showFullscreenButton?: boolean
  showSkipButtons?: boolean
  autoPlay?: boolean
  className?: string
}

export const BasicVideoPlayer: React.FC<BasicVideoPlayerProps> = ({
  src,
  currentTime = 0,
  onTimeUpdate,
  onLoadedMetadata,
  showVolumeControl = true,
  showFullscreenButton = true,
  showSkipButtons = true,
  autoPlay = false,
  className
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleTimeUpdateInternal = useCallback(() => {
    if (!videoRef.current) return
    const time = videoRef.current.currentTime
    onTimeUpdate?.(time)
  }, [onTimeUpdate])

  const handleLoadedMetadataInternal = useCallback(() => {
    if (!videoRef.current) return
    const dur = videoRef.current.duration
    setDuration(dur)
    onLoadedMetadata?.(dur)
  }, [onLoadedMetadata])

  const handleVolumeChange = useCallback((_: Event, value: number | number[]) => {
    if (!videoRef.current) return
    const newVolume = Array.isArray(value) ? value[0] : value
    videoRef.current.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }, [])

  const handleMuteToggle = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleFullscreen = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen()
    }
  }, [])

  const handleSkip10Back = useCallback(() => {
    if (!videoRef.current) return
    const newTime = Math.max(0, videoRef.current.currentTime - 10)
    videoRef.current.currentTime = newTime
    onTimeUpdate?.(newTime)
  }, [onTimeUpdate])

  const handleSkip10Forward = useCallback(() => {
    if (!videoRef.current) return
    const newTime = Math.min(duration, videoRef.current.currentTime + 10)
    videoRef.current.currentTime = newTime
    onTimeUpdate?.(newTime)
  }, [duration, onTimeUpdate])

  // Sync external currentTime with video
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime])

  // Auto-hide controls
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout

    const showControlsTemporarily = () => {
      setShowControls(true)
      clearTimeout(hideTimeout)
      hideTimeout = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false)
        }
      }, 3000)
    }

    const handleMouseMove = () => showControlsTemporarily()
    const handleMouseLeave = () => {
      if (isPlaying) {
        hideTimeout = setTimeout(() => setShowControls(false), 1000)
      }
    }

    if (videoRef.current) {
      const video = videoRef.current
      video.addEventListener('mousemove', handleMouseMove)
      video.addEventListener('mouseleave', handleMouseLeave)
      
      return () => {
        video.removeEventListener('mousemove', handleMouseMove)
        video.removeEventListener('mouseleave', handleMouseLeave)
        clearTimeout(hideTimeout)
      }
    }
  }, [isPlaying])

  if (!src) {
    return (
      <Box 
        className={className}
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: 200,
          backgroundColor: '#000',
          borderRadius: 1,
          color: 'white'
        }}
      >
        No video source provided
      </Box>
    )
  }

  return (
    <Box 
      className={className}
      sx={{ 
        position: 'relative', 
        backgroundColor: '#000',
        borderRadius: 1,
        overflow: 'hidden'
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPlaying && setShowControls(true)}
    >
      <video
        ref={videoRef}
        src={src}
        onTimeUpdate={handleTimeUpdateInternal}
        onLoadedMetadata={handleLoadedMetadataInternal}
        autoPlay={autoPlay}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '400px',
          display: 'block'
        }}
      />
      
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
          gap: 2
        }}
      >
        {/* Time Display */}
        <Box sx={{ color: 'white', fontSize: '0.875rem', fontFamily: 'monospace', minWidth: 80 }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Box>

        {/* Skip Back */}
        {showSkipButtons && (
          <Tooltip title="Skip 10s back">
            <IconButton onClick={handleSkip10Back} sx={{ color: 'white' }} size="small">
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
          <Tooltip title="Skip 10s forward">
            <IconButton onClick={handleSkip10Forward} sx={{ color: 'white' }} size="small">
              <Skip10ForwardIcon />
            </IconButton>
          </Tooltip>
        )}

        <Box sx={{ flex: 1 }} />
        
        {/* Volume Control */}
        {showVolumeControl && (
          <>
            <IconButton onClick={handleMuteToggle} sx={{ color: 'white' }} size="small">
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
                  color: 'white'
                },
                '& .MuiSlider-track': {
                  color: 'white'
                },
                '& .MuiSlider-rail': {
                  color: 'rgba(255, 255, 255, 0.3)'
                }
              }}
              size="small"
            />
          </>
        )}
        
        {/* Fullscreen */}
        {showFullscreenButton && (
          <Tooltip title="Fullscreen">
            <IconButton onClick={handleFullscreen} sx={{ color: 'white' }} size="small">
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
            transition: 'opacity 0.3s ease'
          }}
          onClick={handlePlayPause}
        >
          <PlayIcon sx={{ fontSize: 32, color: 'white' }} />
        </Box>
      )}
    </Box>
  )
}