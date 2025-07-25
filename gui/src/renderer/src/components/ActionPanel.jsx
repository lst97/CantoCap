import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Stack,
  Divider,
  IconButton
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useAppStore } from '../store/app-store'

export const ActionPanel = () => {
  const { 
    canStartTranscription,
    startTranscription,
    cancelTranscription,
    processing,
    config,
    dependencies,
    toggleAdvanced,
    ui,
    showNotification
  } = useAppStore()

  const handleStartTranscription = useCallback(() => {
    if (!canStartTranscription()) {
      if (!config.inputFile) {
        showNotification('Please select an input file first', 'error')
      } else if (!dependencies.python.available) {
        showNotification('Python 3.12 is required but not available', 'error')
      } else if (!dependencies.ffmpeg.available) {
        showNotification('FFmpeg is required but not available', 'error')
      }
      return
    }
    
    startTranscription()
  }, [canStartTranscription, startTranscription, config.inputFile, dependencies, showNotification])

  const handleCancelTranscription = useCallback(() => {
    cancelTranscription()
  }, [cancelTranscription])

  const getButtonState = () => {
    if (processing.isActive) {
      return {
        text: 'Cancel Processing',
        icon: '⏹️',
        className: 'cancel-btn',
        action: handleCancelTranscription,
        disabled: false
      }
    }
    
    if (canStartTranscription()) {
      return {
        text: 'Generate Subtitles',
        icon: '🎬',
        className: 'generate-btn primary',
        action: handleStartTranscription,
        disabled: false
      }
    }
    
    return {
      text: 'Generate Subtitles',
      icon: '🎬',
      className: 'generate-btn disabled',
      action: () => {},
      disabled: true
    }
  }

  const buttonState = getButtonState()

  const getReadinessStatus = () => {
    const issues = []
    
    if (!config.inputFile) issues.push('No input file selected')
    if (!dependencies.python.available) issues.push('Python 3.12 not available')
    if (!dependencies.ffmpeg.available) issues.push('FFmpeg not available')
    
    if (issues.length === 0) {
      return { ready: true, message: 'Ready to generate subtitles', icon: '✅' }
    }
    
    return { 
      ready: false, 
      message: `${issues.length} issue${issues.length > 1 ? 's' : ''}: ${issues.join(', ')}`,
      icon: '⚠️'
    }
  }

  const readiness = getReadinessStatus()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          🚀 Actions
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SettingsIcon />}
          onClick={toggleAdvanced}
          sx={{ fontSize: '0.75rem' }}
        >
          {ui.showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
        </Button>
      </Box>

      {/* Readiness Status */}
      <Paper 
        sx={{ 
          p: 2, 
          backgroundColor: readiness.ready ? 'rgba(87, 242, 135, 0.1)' : 'rgba(237, 66, 69, 0.1)',
          border: 1,
          borderColor: readiness.ready ? 'success.main' : 'error.main'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {readiness.ready ? (
            <CheckIcon color="success" fontSize="small" />
          ) : (
            <WarningIcon color="error" fontSize="small" />
          )}
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {readiness.message}
          </Typography>
        </Box>
      </Paper>

      {/* Action Button */}
      <Button
        variant={processing.isActive ? "outlined" : "contained"}
        color={processing.isActive ? "error" : "primary"}
        size="large"
        fullWidth
        onClick={buttonState.action}
        disabled={buttonState.disabled}
        startIcon={processing.isActive ? <StopIcon /> : <PlayIcon />}
        sx={{ 
          py: 1.5,
          fontSize: '1rem',
          fontWeight: 600
        }}
      >
        {buttonState.text}
      </Button>

      {/* Processing Info */}
      {processing.isActive && (
        <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RefreshIcon fontSize="small" color="primary" />
              <Typography variant="body2">
                Stage: {processing.stage.charAt(0).toUpperCase() + processing.stage.slice(1)}
              </Typography>
            </Box>
            
            {processing.timeElapsed > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimeIcon fontSize="small" color="secondary" />
                <Typography variant="body2">
                  Elapsed: {Math.floor(processing.timeElapsed / 60)}m {processing.timeElapsed % 60}s
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      {/* Configuration Summary */}
      <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
        <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          📋 Current Configuration
        </Typography>
        
        <Stack spacing={1}>
          {config.inputFile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Input:</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {config.inputFile.split(/[\\/]/).pop()}
              </Typography>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Language:</Typography>
            <Typography variant="body2">
              {config.language === 'zh' ? 'Chinese' : config.language.toUpperCase()}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Model:</Typography>
            <Typography variant="body2">
              {config.model || 'Auto-select'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Character Set:</Typography>
            <Typography variant="body2">
              {config.charset === 'traditional' ? 'Traditional' : 'Simplified'}
            </Typography>
          </Box>
          
          {config.subtitle && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Translation:</Typography>
              <Typography variant="body2">
                {config.subtitle.toUpperCase()}
              </Typography>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography variant="body2" color="text.secondary">Options:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 150 }}>
              {[
                config.speakers && 'Speakers',
                config.written && 'Written Style',
                config.music && 'Music Detection',
                config.geminiKey && 'AI Refinement'
              ].filter(Boolean).map((option, index) => (
                <Chip 
                  key={index}
                  label={option} 
                  size="small" 
                  sx={{ 
                    fontSize: '0.65rem', 
                    height: 20,
                    backgroundColor: 'rgba(245, 158, 11, 0.2)'
                  }}
                />
              ))}
              {![config.speakers, config.written, config.music, config.geminiKey].some(Boolean) && (
                <Typography variant="body2" color="text.secondary">None</Typography>
              )}
            </Box>
          </Box>
        </Stack>
      </Paper>

      {/* Tips */}
      <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
        <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          💡 Tips
        </Typography>
        
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            • Use a Gemini API key for better transcription accuracy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            • Enable speaker identification for multi-speaker content
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            • Check hardware specs for optimal model selection
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}