import { useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Card,
  Alert,
  Fade,
  Collapse
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon,
  InfoOutlined as InfoIcon
} from '@mui/icons-material'
import { useAppActions, useActiveWorkspaceId } from '../../stores/useAppStore'
import { 
  useConfigStepContent, 
  useProcessingStepContent, 
  useStepActions 
} from '../../stores/useStepStore'
import { useWorkflowActions } from '../../stores/useWorkflowStore'

export const ActionPanel = () => {
  // Get app-level data
  const appActions = useAppActions()
  const activeWorkspaceId = useActiveWorkspaceId()
  
  // Get step-specific data
  const config = useConfigStepContent()
  const processing = useProcessingStepContent()
  const stepActions = useStepActions()
  const workflowActions = useWorkflowActions()
  
  // Check if transcription can be started
  const canStartTranscription = useCallback(() => {
    return !!(config.inputFile && activeWorkspaceId && processing.status !== 'running')
  }, [config.inputFile, activeWorkspaceId, processing.status])
  
  // Helper to show notifications (placeholder)
  const showNotification = useCallback((message: string, type: string = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`)
    if (appActions.showNotification) {
      appActions.showNotification(message, type)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appActions.showNotification])

  const handleStartTranscription = useCallback(async () => {
    if (!canStartTranscription()) {
      if (!config.inputFile) {
        showNotification('Please select an input file first', 'error')
      } else if (!activeWorkspaceId) {
        showNotification('Please select a workspace first', 'error')
      }
      return
    }
    
    try {
      // Navigate to processing step and start transcription
      await workflowActions.navigateToStep('processing')
      showNotification('Starting transcription process...', 'info')
    } catch (error) {
      console.error('Failed to start transcription:', error)
      showNotification('Failed to start transcription', 'error')
    }
  }, [canStartTranscription, config.inputFile, activeWorkspaceId, workflowActions, showNotification])

  const handleCancelTranscription = useCallback(async () => {
    try {
      await stepActions.cancelTranscription()
      showNotification('Transcription cancelled', 'info')
    } catch (error) {
      console.error('Failed to cancel transcription:', error)
      showNotification('Failed to cancel transcription', 'error')
    }
  }, [stepActions, showNotification])

  const getButtonState = () => {
    if (processing.status === 'running') {
      return {
        text: 'Cancel Processing',
        icon: '⏹️',
        className: 'cancel-btn',
        action: handleCancelTranscription,
        disabled: processing.status !== 'running'
      }
    }
    
    // If processing is completed, disable the generate button
    if (processing.status === 'completed') {
      return {
        text: 'Subtitles Already Available',
        icon: '📁',
        className: 'generate-btn disabled',
        action: () => {},
        disabled: true
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
    // If processing is completed, show different status
    if (processing.status === 'completed') {
      return { 
        ready: true, 
        message: 'Subtitles are available - proceed to review and export', 
        icon: '📁' 
      }
    }
    
    const issues = []
    
    if (!config.inputFile) issues.push('No input file selected')
    if (!activeWorkspaceId) issues.push('No workspace selected')
    // Note: Dependencies check would need to be implemented in AppStore or separate dependency store
    
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
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600, mb: 1 }}>
        🚀 Actions
      </Typography>

      {/* Enhanced Readiness Status */}
      <Fade in={true}>
        <Alert 
          severity={readiness.ready ? 'success' : 'warning'}
          icon={readiness.ready ? <CheckIcon /> : <WarningIcon />}
          sx={{
            borderRadius: 3,
            backgroundColor: readiness.ready 
              ? 'rgba(87, 242, 135, 0.1)' 
              : 'rgba(254, 231, 92, 0.1)',
            border: 1,
            borderColor: readiness.ready 
              ? 'rgba(87, 242, 135, 0.3)' 
              : 'rgba(254, 231, 92, 0.3)',
            '& .MuiAlert-icon': {
              color: readiness.ready ? 'success.main' : 'warning.main'
            },
            '& .MuiAlert-message': {
              fontWeight: 500,
              fontSize: '0.875rem'
            }
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {readiness.ready ? '✨ Ready to Generate' : 'Issues Found'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
            {readiness.message}
          </Typography>
        </Alert>
      </Fade>

      {/* Enhanced Action Button */}
      <Button
        variant={processing.status === 'running' ? "outlined" : "contained"}
        color={processing.status === 'running' ? "error" : "primary"}
        size="large"
        fullWidth
        onClick={buttonState.action}
        disabled={buttonState.disabled}
        startIcon={processing.status === 'running' ? <StopIcon /> : <PlayIcon />}
        sx={{ 
          py: 2,
          px: 3,
          fontSize: '1.1rem',
          fontWeight: 700,
          borderRadius: 3,
          textTransform: 'none',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: processing.status === 'running' 
            ? 'transparent'
            : buttonState.disabled
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.3) 100%)'
              : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          '&:hover': {
            transform: buttonState.disabled ? 'none' : 'translateY(-2px)',
            boxShadow: buttonState.disabled 
              ? 'none'
              : processing.status === 'running'
                ? '0 4px 20px rgba(237, 66, 69, 0.3)'
                : '0 8px 25px rgba(245, 158, 11, 0.4)',
          },
          '&:disabled': {
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'not-allowed'
          }
        }}
      >
        {buttonState.text}
      </Button>

      {/* Enhanced Processing Info */}
      <Collapse in={processing.status === 'running'}>
        <Card sx={{ 
          p: 3, 
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 3
        }}>
          <Typography variant="subtitle1" sx={{ 
            mb: 2, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            fontWeight: 600,
            color: 'primary.main'
          }}>
            <RefreshIcon fontSize="small" sx={{ 
              animation: 'spin 2s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }} />
            Processing in Progress
          </Typography>
          
          <Stack spacing={2}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                CURRENT STAGE
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {processing.currentPhase || 'Initializing...'}
              </Typography>
            </Box>
            
            {processing.timeElapsed && processing.timeElapsed > 0 && (
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                  TIME ELAPSED
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimeIcon fontSize="small" color="secondary" />
                  {Math.floor((processing.timeElapsed || 0) / 60)}m {(processing.timeElapsed || 0) % 60}s
                </Typography>
              </Box>
            )}
          </Stack>
        </Card>
      </Collapse>

      {/* Enhanced Configuration Summary */}
      <Card sx={{ 
        p: 3, 
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 3
      }}>
        <Typography variant="subtitle1" sx={{ 
          mb: 3, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          fontWeight: 600
        }}>
          📋 Configuration Quick View
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
          
          {processing.status === 'completed' && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Subtitles:</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'success.main' }}>
                Available
              </Typography>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Language:</Typography>
            <Typography variant="body2">
              {config.language || 'Auto-detect'}
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
                {config.subtitle}
              </Typography>
            </Box>
          )}
          
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Features:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {/* Basic Features - Always show written style since it's a core function */}
              <Chip 
                label={`✍️ Transcription${config.geminiKey ? ' (AI Enhanced)' : ''}`}
                size="small" 
                sx={{ 
                  fontSize: '0.7rem', 
                  height: 24,
                  backgroundColor: config.geminiKey 
                    ? 'rgba(87, 242, 135, 0.15)' 
                    : 'rgba(125, 211, 252, 0.15)',
                  color: config.geminiKey ? 'success.main' : 'info.main',
                  border: config.geminiKey 
                    ? '1px solid rgba(87, 242, 135, 0.3)' 
                    : '1px solid rgba(125, 211, 252, 0.3)',
                  fontWeight: 500
                }}
              />
              
              {/* Enhanced Options */}
              {[
                config.speakers && { label: 'Speakers', icon: '👥' },
                config.music && { label: 'Music Detection', icon: '🎵' },
                config.geminiKey && { label: 'AI Refinement', icon: '✨' }
              ].filter((option): option is { label: string; icon: string } => Boolean(option)).map((option, index) => (
                <Chip 
                  key={index}
                  label={`${option.icon} ${option.label}`}
                  size="small" 
                  sx={{ 
                    fontSize: '0.7rem', 
                    height: 24,
                    backgroundColor: 'rgba(87, 242, 135, 0.15)',
                    color: 'success.main',
                    border: '1px solid rgba(87, 242, 135, 0.3)',
                    fontWeight: 500
                  }}
                />
              ))}
            </Box>
          </Box>
        </Stack>
      </Card>

      {/* Enhanced Tips */}
      <Card sx={{ 
        p: 3, 
        background: 'linear-gradient(135deg, rgba(125, 211, 252, 0.08) 0%, rgba(125, 211, 252, 0.03) 100%)',
        border: '1px solid rgba(125, 211, 252, 0.2)',
        borderRadius: 3
      }}>
        <Typography variant="subtitle1" sx={{ 
          mb: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          fontWeight: 600,
          color: 'info.main'
        }}>
          💡 Pro Tips
        </Typography>
        
        <Stack spacing={2}>
          {!config.geminiKey && (
            <Alert severity="info" sx={{ 
              backgroundColor: 'transparent',
              border: '1px solid rgba(125, 211, 252, 0.3)',
              '& .MuiAlert-icon': { color: 'info.main' }
            }}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                Add a Gemini API key for enhanced transcription accuracy
              </Typography>
            </Alert>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <InfoIcon sx={{ color: 'info.main', fontSize: '1rem', mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
              Enable speaker identification for multi-speaker content and music detection for content with background audio
            </Typography>
          </Box>
        </Stack>
      </Card>
    </Box>
  )
}