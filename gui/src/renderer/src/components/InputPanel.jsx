import React, { useState, useCallback, useEffect } from 'react'
import { 
  Typography, 
  Box, 
  Stack,
  Divider,
  Paper,
  Chip,
  Alert,
  AlertTitle
} from '@mui/material'
import { 
  FolderOpen as FolderIcon,
  VolumeUp as VolumeIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material'
import { FileSelector } from './FileSelector'
import { VideoPlayer } from './VideoPlayer'
import { useAppStore } from '../store/app-store'

export const InputPanel = () => {
  const { config, updateConfig } = useAppStore()
  const [timeRange, setTimeRange] = useState(null)
  const [isRangeValid, setIsRangeValid] = useState(false)

  const handleTimeRangeChange = useCallback((range) => {
    setTimeRange(range)
    setIsRangeValid(range && range.end > range.start && (range.end - range.start) >= 1)
    
    // Save time range to app store for processing
    if (range) {
      updateConfig('startTime', range.start)
      updateConfig('endTime', range.end)
      updateConfig('duration', range.end - range.start)
    } else {
      updateConfig('startTime', null)
      updateConfig('endTime', null)
      updateConfig('duration', 10.0) // Reset to default
    }
    
    console.log('Time range selected:', range)
  }, [updateConfig])

  // Load existing range from config on mount
  useEffect(() => {
    if (config.startTime !== null && config.endTime !== null) {
      const existingRange = {
        start: config.startTime,
        end: config.endTime
      }
      setTimeRange(existingRange)
      setIsRangeValid(existingRange.end > existingRange.start && (existingRange.end - existingRange.start) >= 1)
    }
  }, [config.startTime, config.endTime])

  return (
    <Box 
      sx={{ 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'transparent'
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <FolderIcon color="primary" sx={{ fontSize: 24 }} />
        <Typography 
          variant="h6" 
          component="h2"
          sx={{ 
            fontWeight: 600,
            color: 'text.primary'
          }}
        >
          File Input & Media Preview
        </Typography>
      </Box>

      {/* Content */}
      <Stack spacing={2}>
        {/* File Selector */}
        <Box>
          <FileSelector />
        </Box>
        
        <Divider sx={{ borderColor: 'divider' }} />
        
        {/* Media Preview & Range Selection */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <VolumeIcon color="primary" />
            Media Preview & Range Selection
          </Typography>
          
          <VideoPlayer 
            src={config.inputFile}
            onTimeRangeChange={handleTimeRangeChange}
            initialRange={timeRange}
          />
          
          {/* Processing Range Status */}
          {timeRange ? (
            <Alert 
              severity={isRangeValid ? "success" : "warning"} 
              sx={{ mt: 2 }}
              icon={isRangeValid ? <CheckIcon /> : <TimeIcon />}
            >
              <AlertTitle>
                {isRangeValid ? "Processing Range Selected" : "Range Selection"}
              </AlertTitle>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
                <Chip 
                  label={`Start: ${Math.floor(timeRange.start / 60)}:${(Math.floor(timeRange.start) % 60).toString().padStart(2, '0')}`}
                  size="small"
                  color={isRangeValid ? "success" : "warning"}
                  variant="outlined"
                />
                <Chip 
                  label={`End: ${Math.floor(timeRange.end / 60)}:${(Math.floor(timeRange.end) % 60).toString().padStart(2, '0')}`}
                  size="small"
                  color={isRangeValid ? "success" : "warning"}
                  variant="outlined"
                />
                <Chip 
                  label={`Duration: ${Math.floor((timeRange.end - timeRange.start) / 60)}:${(Math.floor(timeRange.end - timeRange.start) % 60).toString().padStart(2, '0')}`}
                  size="small"
                  color={isRangeValid ? "success" : "default"}
                  icon={<TimeIcon />}
                />
              </Box>
              {!isRangeValid && (
                <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>
                  Please select a range of at least 1 second for processing.
                </Typography>
              )}
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              <AlertTitle>No Range Selected</AlertTitle>
              <Typography variant="body2">
                Use the timeline above to select a specific range for processing, or leave unselected to process the entire file.
              </Typography>
            </Alert>
          )}
        </Box>
      </Stack>
    </Box>
  )
}