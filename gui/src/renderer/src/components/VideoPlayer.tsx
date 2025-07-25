import React, { useState, useCallback } from 'react'
import { Box } from '@mui/material'
import { BasicVideoPlayer } from './VideoPlayer/BasicVideoPlayer'
import { VideoPlayerRange } from './VideoPlayer/VideoPlayerRange'

interface VideoPlayerProps {
  src?: string
  onTimeRangeChange?: (range: { start: number; end: number } | null) => void
  initialRange?: { start: number; end: number }
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  onTimeRangeChange,
  initialRange
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timeRange, setTimeRange] = useState<{ start: number; end: number } | null>(initialRange || null)

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
  }, [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleLoadedMetadata = useCallback((dur: number) => {
    setDuration(dur)
  }, [])

  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleRangeChange = useCallback((start: number, end: number) => {
    const newRange = { start, end }
    setTimeRange(newRange)
    onTimeRangeChange?.(newRange)
  }, [onTimeRangeChange])

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Basic Video Player - Auto height */}
      <Box sx={{ width: '100%', mb: 2 }}>
        <BasicVideoPlayer
          src={src}
          currentTime={currentTime}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          showVolumeControl={false}
          showFullscreenButton={false}
          showSkipButtons={false}
        />
      </Box>
      
      {/* Video Player Range Component - Fixed height */}
      <Box sx={{ width: '100%', height: 220 }}>
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
        />
      </Box>
    </Box>
  )
}