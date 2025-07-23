import React, { useState, useEffect } from 'react'
import { 
  Backdrop,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Chip,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Divider
} from '@mui/material'
import { 
  Movie as MovieIcon,
  Build as BuildIcon,
  Mic as MicIcon,
  AutoFixHigh as RefineIcon,
  CheckCircle as CompleteIcon,
  Error as ErrorIcon,
  Stop as StopIcon,
  Computer as ComputerIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon
} from '@mui/icons-material'
import { useAppStore } from '../store/app-store'

export const ProgressPanel = () => {
  const { processing } = useAppStore()
  const [animatedProgress, setAnimatedProgress] = useState(0)

  // Smooth progress animation
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimatedProgress(prev => {
        const diff = processing.progress - prev
        if (Math.abs(diff) < 0.1) return processing.progress
        return prev + (diff * 0.1)
      })
    }, 50)
    
    return () => clearInterval(timer)
  }, [processing.progress])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStageInfo = (stage) => {
    const stages = {
      idle: { icon: <StopIcon />, label: 'Idle', color: 'default', severity: 'info' },
      preparing: { icon: <BuildIcon />, label: 'Preparing', color: 'primary', severity: 'info' },
      transcribing: { icon: <MicIcon />, label: 'Transcribing', color: 'success', severity: 'info' },
      refining: { icon: <RefineIcon />, label: 'Refining', color: 'secondary', severity: 'info' },
      completed: { icon: <CompleteIcon />, label: 'Completed', color: 'success', severity: 'success' },
      error: { icon: <ErrorIcon />, label: 'Error', color: 'error', severity: 'error' },
      cancelled: { icon: <StopIcon />, label: 'Cancelled', color: 'warning', severity: 'warning' }
    }
    
    return stages[stage] || stages.idle
  }

  const stageInfo = getStageInfo(processing.stage)

  return (
    <Backdrop
      open={processing.isActive}
      sx={{ 
        color: '#fff', 
        zIndex: (theme) => theme.zIndex.modal + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <Card 
        sx={{ 
          minWidth: 500,
          maxWidth: 600,
          mx: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
        elevation={8}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <MovieIcon sx={{ fontSize: 32 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Processing Subtitles
              </Typography>
            </Box>
            
            <Chip
              icon={stageInfo.icon}
              label={stageInfo.label}
              color={stageInfo.color}
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          </Box>

          {/* Progress Bar */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Progress
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {Math.round(animatedProgress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={animatedProgress}
              sx={{
                height: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'white',
                  borderRadius: 4
                }
              }}
            />
          </Box>

          {/* Status Message */}
          <Typography 
            variant="body1" 
            sx={{ 
              mb: 3, 
              textAlign: 'center',
              opacity: 0.9,
              minHeight: 24
            }}
          >
            {processing.message}
          </Typography>

          {/* Steps */}
          {processing.currentStep && processing.totalSteps && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                Step {processing.currentStep} of {processing.totalSteps}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {Array.from({ length: processing.totalSteps }, (_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: i + 1 <= processing.currentStep 
                        ? 'white' 
                        : 'rgba(255, 255, 255, 0.3)',
                      transition: 'background-color 0.3s ease'
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.3)', my: 2 }} />

          {/* Stats */}
          <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 2 }}>
            <Box textAlign="center">
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                Elapsed
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatTime(processing.timeElapsed || 0)}
              </Typography>
            </Box>
            
            {processing.timeRemaining > 0 && (
              <Box textAlign="center">
                <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                  Remaining
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {formatTime(processing.timeRemaining)}
                </Typography>
              </Box>
            )}
          </Stack>

          {/* Hardware Info */}
          {processing.hardwareInfo && (
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ flexWrap: 'wrap' }}>
              <Chip
                icon={<ComputerIcon />}
                label={processing.hardwareInfo.gpuAcceleration ? 'GPU Accelerated' : 'CPU Processing'}
                size="small"
                sx={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              
              {processing.hardwareInfo.memoryUsage && (
                <Chip
                  icon={<MemoryIcon />}
                  label={`Memory: ${processing.hardwareInfo.memoryUsage}`}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                />
              )}
              
              {processing.hardwareInfo.cpuUsage && (
                <Chip
                  icon={<SpeedIcon />}
                  label={`CPU: ${processing.hardwareInfo.cpuUsage}`}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                />
              )}
            </Stack>
          )}

          {/* Error Display */}
          {processing.error && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 3,
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                color: 'white',
                '& .MuiAlert-icon': { color: '#ff6b6b' }
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Processing Error
              </Typography>
              <Typography variant="body2" component="div">
                {processing.error.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Backdrop>
  )
}