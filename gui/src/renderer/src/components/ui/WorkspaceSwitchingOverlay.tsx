import React from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  Backdrop,
  Fade
} from '@mui/material'

export interface WorkspaceSwitchingOverlayProps {
  isVisible: boolean
  workspaceName: string
}

/**
 * WorkspaceSwitchingOverlay - Simple overlay for workspace switching
 * 
 * Features:
 * - Smooth fade transitions
 * - Workspace-specific messaging
 * - Minimal and focused design
 */
export const WorkspaceSwitchingOverlay: React.FC<WorkspaceSwitchingOverlayProps> = ({ 
  isVisible, 
  workspaceName 
}) => {
  if (!isVisible) {
    return null
  }
  
  return (
    <Backdrop
      open={isVisible}
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <Fade in={isVisible} timeout={300}>
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
            boxShadow: 24
          }}
        >
          {/* Progress Indicator */}
          <Box sx={{ mb: 3 }}>
            <CircularProgress
              variant="indeterminate"
              size={80}
              thickness={4}
              sx={{ 
                color: 'primary.main',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }}
            />
          </Box>
          
          {/* Message */}
          <Typography
            variant="h6"
            color="text.primary"
            sx={{ 
              textAlign: 'center',
              mb: 1,
              fontWeight: 500
            }}
          >
            Switching to {workspaceName}
          </Typography>
          
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ 
              textAlign: 'center',
              opacity: 0.8
            }}
          >
            Loading workspace configuration...
          </Typography>
        </Box>
      </Fade>
    </Backdrop>
  )
}