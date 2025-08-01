import React from 'react'
import {
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
  IconButton,
  Fade,
  Backdrop
} from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { useUIStore, selectLoadingOverlay } from '../../stores/ui-store'

export interface LoadingOverlayProps {
  /** Override the store state for testing */
  override?: {
    isVisible: boolean
    message: string
    progress?: number
    isDeterminate?: boolean
    canCancel?: boolean
    onCancel?: () => void
  }
}

/**
 * LoadingOverlay - Full-screen loading overlay with progress indication
 * 
 * Features:
 * - Determinate and indeterminate progress modes
 * - Cancelable operations
 * - Context-aware messaging
 * - Smooth transitions
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ override }) => {
  const storeOverlay = useUIStore(selectLoadingOverlay)
  const { hideLoadingOverlay } = useUIStore()
  
  // Use override if provided, otherwise use store state
  const overlay = override || storeOverlay
  
  const handleCancel = () => {
    if (overlay.onCancel) {
      overlay.onCancel()
    }
    hideLoadingOverlay()
  }
  
  if (!overlay.isVisible) {
    return null
  }
  
  return (
    <Backdrop
      open={overlay.isVisible}
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <Fade in={overlay.isVisible} timeout={300}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 320,
            minHeight: 200,
            maxWidth: 480,
            p: 4,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            position: 'relative'
          }}
        >
          {/* Cancel Button */}
          {overlay.canCancel && (
            <IconButton
              onClick={handleCancel}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: 'text.secondary'
              }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          )}
          
          {/* Progress Indicator */}
          <Box sx={{ mb: 3 }}>
            {overlay.isDeterminate ? (
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={overlay.progress || 0}
                  size={80}
                  thickness={4}
                  sx={{ color: 'primary.main' }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    variant="caption"
                    component="div"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    {Math.round(overlay.progress || 0)}%
                  </Typography>
                </Box>
              </Box>
            ) : (
              <CircularProgress
                variant="indeterminate"
                size={80}
                thickness={4}
                sx={{ 
                  color: 'primary.main',
                  animation: 'spin 1.4s linear infinite',
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                    animation: 'circular-dash 1.4s ease-in-out infinite',
                  },
                  '@keyframes spin': {
                    '0%': {
                      transform: 'rotate(0deg)',
                    },
                    '100%': {
                      transform: 'rotate(360deg)',
                    },
                  },
                  '@keyframes circular-dash': {
                    '0%': {
                      strokeDasharray: '1px, 200px',
                      strokeDashoffset: '0px',
                    },
                    '50%': {
                      strokeDasharray: '100px, 200px',
                      strokeDashoffset: '-15px',
                    },
                    '100%': {
                      strokeDasharray: '100px, 200px',
                      strokeDashoffset: '-125px',
                    },
                  },
                }}
              />
            )}
          </Box>
          
          {/* Message */}
          <Typography
            variant="h6"
            color="text.primary"
            sx={{ 
              textAlign: 'center',
              mb: 2,
              fontWeight: 500
            }}
          >
            {overlay.message}
          </Typography>
          
          {/* Progress Bar for Determinate Mode */}
          {overlay.isDeterminate && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={overlay.progress || 0}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    backgroundColor: 'primary.main'
                  }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {overlay.progress ? `${Math.round(overlay.progress)}%` : '0%'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  100%
                </Typography>
              </Box>
            </Box>
          )}
          
          {/* Cancel Instructions */}
          {overlay.canCancel && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ 
                textAlign: 'center',
                mt: 2,
                opacity: 0.8
              }}
            >
              Click the × to cancel
            </Typography>
          )}
        </Box>
      </Fade>
    </Backdrop>
  )
}

/**
 * Hook for easy loading overlay management
 */
export const useLoadingOverlay = () => {
  const { showLoadingOverlay, updateLoadingProgress, hideLoadingOverlay } = useUIStore()
  
  return {
    show: showLoadingOverlay,
    updateProgress: updateLoadingProgress,
    hide: hideLoadingOverlay,
    
    // Convenience methods
    showIndeterminate: (message: string, canCancel = false, onCancel?: () => void) => {
      showLoadingOverlay({
        message,
        isDeterminate: false,
        canCancel,
        onCancel
      })
    },
    
    showDeterminate: (message: string, initialProgress = 0, canCancel = false, onCancel?: () => void) => {
      showLoadingOverlay({
        message,
        progress: initialProgress,
        isDeterminate: true,
        canCancel,
        onCancel
      })
    },
    
    // Workspace switching specific
    showWorkspaceSwitching: (workspaceName: string) => {
      showLoadingOverlay({
        message: `Switching to ${workspaceName}...`,
        isDeterminate: false,
        canCancel: false
      })
    }
  }
}