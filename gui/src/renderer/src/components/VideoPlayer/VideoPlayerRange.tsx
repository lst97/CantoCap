import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Box,
  Typography,
  Tooltip,
  IconButton
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipPrevious as GoToStartIcon,
  SkipNext as GoToEndIcon,
  Clear as ClearIcon,
  Replay10 as Skip10BackIcon,
  Forward10 as Skip10ForwardIcon,
  Fullscreen as FullscreenIcon,
  Preview as PreviewIcon
} from '@mui/icons-material'
import { VideoThumbnailPreview } from '../ui/VideoThumbnailPreview'

interface TimeRange {
  start: number
  end: number
}

interface VideoPlayerRangeProps {
  duration?: number
  currentTime?: number
  startTime?: number
  endTime?: number
  onRangeChange?: (start: number, end: number) => void
  onTimeChange?: (time: number) => void
  onPlay?: () => void
  onPause?: () => void
  isPlaying?: boolean
  className?: string
  onFullscreen?: () => void
}

export const VideoPlayerRange: React.FC<VideoPlayerRangeProps> = ({
  duration = 120,
  currentTime = 0,
  startTime = 0,
  endTime = 120,
  onRangeChange,
  onTimeChange,
  onPlay,
  onPause,
  isPlaying = false,
  className,
  onFullscreen
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'current' | null>(null)
  const [dragPreviewTime, setDragPreviewTime] = useState<number | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange | null>(
    startTime !== endTime && !(startTime === 0 && endTime === duration) ? { start: startTime, end: endTime } : null
  )
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startPercentage = timeRange ? (timeRange.start / duration) * 100 : 0
  const endPercentage = timeRange ? (timeRange.end / duration) * 100 : 100
  const currentPercentage = (currentTime / duration) * 100

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!trackRef.current || !duration) return

    const rect = trackRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const time = (percentage / 100) * duration

    if (isDragging === 'start' && timeRange) {
      const newStart = Math.max(0, Math.min(time, timeRange.end - 1))
      setDragPreviewTime(newStart)
      const newRange = { start: newStart, end: timeRange.end }
      setTimeRange(newRange)
      onRangeChange?.(newStart, timeRange.end)
    } else if (isDragging === 'end' && timeRange) {
      const newEnd = Math.max(timeRange.start + 1, Math.min(time, duration))
      setDragPreviewTime(newEnd)
      const newRange = { start: timeRange.start, end: newEnd }
      setTimeRange(newRange)
      onRangeChange?.(timeRange.start, newEnd)
    } else if (isDragging === 'current') {
      const newTime = Math.max(0, Math.min(time, duration))
      setDragPreviewTime(newTime)
      onTimeChange?.(newTime)
    } else {
      setHoverTime(time)
    }
  }, [isDragging, duration, timeRange, onRangeChange, onTimeChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
    setDragPreviewTime(null)
    setShowPreview(false)
  }, [])

  const handleTrackClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || isDragging) return
    
    const rect = trackRef.current.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickTime = (clickX / rect.width) * duration
    const newTime = Math.max(0, Math.min(clickTime, duration))
    
    onTimeChange?.(newTime)
  }, [isDragging, duration, onTimeChange])

  const handleStartDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging('start')
    setShowPreview(true)
    setDragPreviewTime(timeRange?.start || 0)
  }, [timeRange])

  const handleEndDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging('end')
    setShowPreview(true)
    setDragPreviewTime(timeRange?.end || duration)
  }, [timeRange, duration])

  const handleCurrentDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging('current')
    setShowPreview(true)
    setDragPreviewTime(currentTime)
  }, [currentTime])

  const handleTrackHover = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current || isDragging) return
    
    const rect = trackRef.current.getBoundingClientRect()
    const percentage = ((e.clientX - rect.left) / rect.width) * 100
    const time = (percentage / 100) * duration
    setHoverTime(time)
    setShowPreview(true)
    
    // Update mouse position for thumbnail
    setMousePosition({ x: e.clientX, y: e.clientY })
  }, [isDragging, duration])

  const handleTrackLeave = useCallback(() => {
    if (!isDragging) {
      setShowPreview(false)
      setHoverTime(null)
    }
  }, [isDragging])

  const handleTrackDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return
    
    const rect = trackRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickTime = (clickX / rect.width) * duration
    
    const rangeSize = Math.min(30, duration * 0.25)
    const start = Math.max(0, clickTime - rangeSize / 2)
    const end = Math.min(duration, start + rangeSize)
    
    const newRange = { start, end }
    setTimeRange(newRange)
    onRangeChange?.(start, end)
  }, [duration, onRangeChange])

  const handleGoToRangeStart = useCallback(() => {
    if (timeRange) {
      onTimeChange?.(timeRange.start)
    }
  }, [timeRange, onTimeChange])

  const handleGoToRangeEnd = useCallback(() => {
    if (timeRange) {
      onTimeChange?.(timeRange.end)
    }
  }, [timeRange, onTimeChange])

  const handleClearRange = useCallback(() => {
    setTimeRange(null)
    onRangeChange?.(0, duration)
  }, [duration, onRangeChange])

  const handlePreviewRange = useCallback(() => {
    if (timeRange) {
      onTimeChange?.(timeRange.start)
      onPlay?.()
    }
  }, [timeRange, onTimeChange, onPlay])

  const handleFullscreen = useCallback(() => {
    if (onFullscreen) {
      onFullscreen()
    } else {
      // Default fullscreen behavior
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
      }
    }
  }, [onFullscreen])

  const handleSkip10Back = useCallback(() => {
    const newTime = Math.max(0, currentTime - 10)
    onTimeChange?.(newTime)
  }, [currentTime, onTimeChange])

  const handleSkip10Forward = useCallback(() => {
    const newTime = Math.min(duration, currentTime + 10)
    onTimeChange?.(newTime)
  }, [currentTime, duration, onTimeChange])

  // Mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Update timeRange when props change
  useEffect(() => {
    if (startTime !== endTime && !(startTime === 0 && endTime === duration)) {
      setTimeRange({ start: startTime, end: endTime })
    } else {
      setTimeRange(null)
    }
  }, [startTime, endTime, duration])



  return (
    <>
      {/* Separate thumbnail component positioned outside container */}
      <VideoThumbnailPreview
        isVisible={showPreview && (hoverTime !== null || dragPreviewTime !== null)}
        position={mousePosition}
        time={dragPreviewTime ?? hoverTime ?? 0}
        duration={duration}
      />
      
      <Box 
        className={className}
        sx={{ 
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          backgroundColor: '#1a1a1a',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 1,
          overflow: 'hidden'
        }}
      >
      {/* Compact Controls Bar */}
      <Box
        sx={{
          backgroundColor: '#2a2a2a',
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          minHeight: 48,
          borderBottom: '1px solid #333'
        }}
      >
        {/* Time Display */}
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace', 
            color: 'white',
            minWidth: 60,
            fontSize: '0.8rem'
          }}
        >
          {formatTime(currentTime)}
        </Typography>

        {/* Duration */}
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace', 
            color: '#aaa',
            minWidth: 60,
            fontSize: '0.8rem',
            mr: 2
          }}
        >
          {formatTime(duration)}
        </Typography>

        {/* Spacer to push controls to center */}
        <Box sx={{ flex: 1 }} />

        {/* Controls Container - Centered */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Back 10s">
            <IconButton onClick={handleSkip10Back} sx={{ color: 'white', p: 0.5 }} size="small">
              <Skip10BackIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <IconButton onClick={isPlaying ? onPause : onPlay} sx={{ color: 'white', p: 0.5 }}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>

          <Tooltip title="Forward 10s">
            <IconButton onClick={handleSkip10Forward} sx={{ color: 'white', p: 0.5 }} size="small">
              <Skip10ForwardIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Range Controls */}
          {timeRange && (
            <>
              <Box sx={{ width: 8 }} />
              <Tooltip title="Go to Start">
                <IconButton onClick={handleGoToRangeStart} sx={{ color: '#ff9800', p: 0.5 }} size="small">
                  <GoToStartIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Go to End">
                <IconButton onClick={handleGoToRangeEnd} sx={{ color: '#ff9800', p: 0.5 }} size="small">
                  <GoToEndIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Preview Range">
                <IconButton onClick={handlePreviewRange} sx={{ color: '#ff9800', p: 0.5 }} size="small">
                  <PreviewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Clear Range">
                <IconButton onClick={handleClearRange} sx={{ color: '#f44336', p: 0.5 }} size="small">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        {/* Spacer to push right elements to the right */}
        <Box sx={{ flex: 1 }} />

        {/* Frame Counter */}
        <Typography
          variant="body2"
          sx={{
            backgroundColor: '#3a3a3a',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#ffa726',
            mr: 1
          }}
        >
          Frame {Math.floor((currentTime / duration) * 100) || 0}
        </Typography>

        <Tooltip title="Fullscreen">
          <IconButton onClick={handleFullscreen} sx={{ color: 'white', p: 0.5 }} size="small">
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Timeline Section */}
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Time markers every 30 seconds */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#888', mb: 0.5 }}>
          {Array.from({ length: Math.ceil(duration / 30) + 1 }, (_, i) => {
            const time = i * 30
            return time <= duration ? (
              <span key={i}>{formatTime(time)}</span>
            ) : null
          }).filter(Boolean)}
        </Box>

        {/* Timeline Track Container */}
        <Box sx={{ position: 'relative', mb: 2 }}>

          {/* Main Timeline Track */}
          <Box
            ref={trackRef}
            sx={{
              position: 'relative',
              height: 12,
              backgroundColor: '#444',
              borderRadius: 2,
              cursor: 'pointer',
              mb: 0.5,
              '&:hover': {
                backgroundColor: '#555'
              }
            }}
            onClick={handleTrackClick}
            onDoubleClick={handleTrackDoubleClick}
            onMouseMove={handleTrackHover}
            onMouseLeave={handleTrackLeave}
          >
            {/* Progress */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${currentPercentage}%`,
                backgroundColor: 'white',
                transition: 'width 0.1s'
              }}
            />
            
            {/* Selected Range */}
            {timeRange && (
              <Box
                sx={{
                  position: 'absolute',
                  left: `${startPercentage}%`,
                  width: `${endPercentage - startPercentage}%`,
                  top: 0,
                  height: '100%',
                  backgroundColor: 'rgba(255, 152, 0, 0.3)',
                  border: '1px solid #ff9800'
                }}
              />
            )}

            {/* Range progress within selection */}
            {timeRange && currentTime >= timeRange.start && currentTime <= timeRange.end && (
              <Box
                sx={{
                  position: 'absolute',
                  left: `${startPercentage}%`,
                  width: `${currentPercentage - startPercentage}%`,
                  top: 0,
                  height: '100%',
                  backgroundColor: '#ff9800'
                }}
              />
            )}

            {/* Range Handles */}
            {timeRange && (
              <>
                {/* Start handle */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${startPercentage}%`,
                    top: -8,
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 24,
                    backgroundColor: '#ff9800',
                    cursor: 'ew-resize',
                    borderRadius: 1,
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                      transform: 'translateX(-50%) scale(1.1)'
                    },
                    '&::before': {
                      content: '"["',
                      position: 'absolute',
                      top: -2,
                      left: -12,
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: '#ff9800'
                    }
                  }}
                  onMouseDown={handleStartDrag}
                />
                {/* End handle */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${endPercentage}%`,
                    top: -8,
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 24,
                    backgroundColor: '#ff9800',
                    cursor: 'ew-resize',
                    borderRadius: 1,
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                      transform: 'translateX(-50%) scale(1.1)'
                    },
                    '&::after': {
                      content: '"]"',
                      position: 'absolute',
                      top: -2,
                      left: 16,
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: '#ff9800'
                    }
                  }}
                  onMouseDown={handleEndDrag}
                />
              </>
            )}

            {/* Current time handle */}
            <Box
              sx={{
                position: 'absolute',
                left: `${currentPercentage}%`,
                top: -6,
                transform: 'translateX(-50%)',
                width: 12,
                height: 20,
                backgroundColor: 'white',
                cursor: 'ew-resize',
                borderRadius: '50%',
                border: '2px solid #333',
                '&:hover': {
                  transform: 'translateX(-50%) scale(1.2)'
                }
              }}
              onMouseDown={handleCurrentDrag}
            />
          </Box>
        </Box>

        {/* Range Info */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontFamily: 'monospace', position: 'relative' }}>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <span><strong>Start:</strong> {timeRange ? formatTime(timeRange.start) : '--:--'}</span>
            <span><strong>End:</strong> {timeRange ? formatTime(timeRange.end) : '--:--'}</span>
            <span><strong>Duration:</strong> {timeRange ? formatTime(timeRange.end - timeRange.start) : '--:--'}</span>
          </Box>
          
          {/* Centered Instruction Text */}
          <Box sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            {!timeRange && (
              <Typography variant="body2" sx={{ color: '#888', fontStyle: 'italic', fontSize: '0.8rem' }}>
                Double-click on the timeline to create a range
              </Typography>
            )}
          </Box>
          
          <span><strong>Current:</strong> {formatTime(currentTime)}</span>
        </Box>
      </Box>
      </Box>
    </>
  )
}