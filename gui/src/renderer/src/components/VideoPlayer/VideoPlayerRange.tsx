import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Box,
  Button,
  Paper,
  Stack,
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
  VolumeUp as VolumeIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material'

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
  className
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'current' | null>(null)
  const [dragPreviewTime, setDragPreviewTime] = useState<number | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange | null>(
    startTime !== endTime ? { start: startTime, end: endTime } : null
  )

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
    if (startTime !== endTime) {
      setTimeRange({ start: startTime, end: endTime })
    } else {
      setTimeRange(null)
    }
  }, [startTime, endTime])

  const previewTime = dragPreviewTime ?? hoverTime ?? currentTime

  return (
    <Box 
      className={className}
      sx={{ 
        width: '100%',
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
          gap: 1,
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

        {/* Progress Indicator */}
        <Box
          sx={{
            flex: 1,
            height: 4,
            backgroundColor: '#444',
            borderRadius: 2,
            mx: 2,
            position: 'relative'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${currentPercentage}%`,
              backgroundColor: 'white',
              borderRadius: 2
            }}
          />
        </Box>

        {/* Duration */}
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace', 
            color: '#aaa',
            minWidth: 60,
            fontSize: '0.8rem'
          }}
        >
          {formatTime(duration)}
        </Typography>

        {/* Controls */}
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

        <Box sx={{ width: 16 }} />

        {/* Range Controls */}
        {timeRange && (
          <>
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
          </>
        )}

        <Box sx={{ flex: 0.5 }} />

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
            color: '#4fc3f7'
          }}
        >
          Frame {Math.floor((currentTime / duration) * 100) || 0}
        </Typography>

        <IconButton sx={{ color: 'white', p: 0.5 }} size="small">
          <FullscreenIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Timeline Section */}
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column' }}>
        {/* Time markers every 30 seconds */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888', mb: 1 }}>
          {Array.from({ length: Math.ceil(duration / 30) + 1 }, (_, i) => {
            const time = i * 30
            return time <= duration ? (
              <span key={i}>{formatTime(time)}</span>
            ) : null
          }).filter(Boolean)}
        </Box>

        {/* Timeline Track Container */}
        <Box sx={{ position: 'relative', mb: 2 }}>
          {/* Preview tooltip */}
          {showPreview && (hoverTime !== null || dragPreviewTime !== null) && (
            <Box
              sx={{
                position: 'absolute',
                bottom: '100%',
                left: `${((dragPreviewTime ?? hoverTime ?? 0) / duration) * 100}%`,
                transform: 'translateX(-50%)',
                mb: 1,
                zIndex: 10
              }}
            >
              <Paper
                sx={{
                  p: 1,
                  backgroundColor: '#000',
                  color: 'white',
                  fontSize: '0.75rem',
                  borderRadius: 1,
                  border: '1px solid #444'
                }}
              >
                <Box sx={{ fontFamily: 'monospace', textAlign: 'center' }}>
                  {formatTime(dragPreviewTime ?? hoverTime ?? 0)}
                </Box>
                <Box sx={{ fontSize: '0.6rem', opacity: 0.8, textAlign: 'center' }}>
                  Frame {Math.floor(((dragPreviewTime ?? hoverTime ?? 0) / duration) * 100)}
                </Box>
              </Paper>
            </Box>
          )}

          {/* Main Timeline Track */}
          <Box
            ref={trackRef}
            sx={{
              position: 'relative',
              height: 8,
              backgroundColor: '#444',
              borderRadius: 0,
              cursor: 'pointer',
              mb: 1,
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
                      content: '\"[\"',
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
                      content: '\"]\"',
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontFamily: 'monospace' }}>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <span><strong>Start:</strong> {timeRange ? formatTime(timeRange.start) : '--:--'}</span>
            <span><strong>End:</strong> {timeRange ? formatTime(timeRange.end) : '--:--'}</span>
            <span><strong>Duration:</strong> {timeRange ? formatTime(timeRange.end - timeRange.start) : '--:--'}</span>
          </Box>
          <span><strong>Current:</strong> {formatTime(currentTime)}</span>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center', gap: 2 }}>
          {timeRange ? (
            <>
              <Button
                variant="outlined"
                onClick={() => onPlay?.()}
                sx={{ color: '#ff9800', borderColor: '#ff9800', '&:hover': { borderColor: '#ffb74d' } }}
              >
                Preview Range
              </Button>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearRange}
                sx={{ color: '#f44336', borderColor: '#f44336', '&:hover': { borderColor: '#ef5350' } }}
              >
                Clear Range
              </Button>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: '#888', fontStyle: 'italic' }}>
              Double-click on the timeline to create a range
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}