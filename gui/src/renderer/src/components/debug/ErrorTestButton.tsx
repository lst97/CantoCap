import React, { useState } from 'react'
import {
  Fab,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Fade,
  Backdrop
} from '@mui/material'
import {
  BugReport as BugIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  NetworkCheck as NetworkIcon,
  Folder as FileIcon,
  Code as RuntimeIcon,
  Visibility as TestIcon,
  Close as CloseIcon
} from '@mui/icons-material'

interface ErrorTestButtonProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export const ErrorTestButton: React.FC<ErrorTestButtonProps> = ({ 
  position = 'bottom-right' 
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleToggleVisibility = () => {
    setIsVisible(!isVisible)
  }

  // Test error functions
  const testRuntimeError = () => {
    handleClose()
    setTimeout(() => {
      // @ts-ignore - Intentional error
      const obj = null
      obj.someProperty.doesNotExist()
    }, 100)
  }

  const testNetworkError = () => {
    handleClose()
    setTimeout(() => {
      throw new Error('Network request failed: Unable to connect to transcription service')
    }, 100)
  }

  const testFileSystemError = () => {
    handleClose()
    setTimeout(() => {
      throw new Error('ENOENT: no such file or directory, open \'/path/to/missing/file.mp4\'')
    }, 100)
  }

  const testProcessingError = () => {
    handleClose()
    setTimeout(() => {
      throw new Error('FFmpeg processing failed: Unsupported codec or corrupted video file')
    }, 100)
  }

  const testValidationError = () => {
    handleClose()
    setTimeout(() => {
      throw new Error('Validation failed: Required API key is missing or invalid')
    }, 100)
  }

  const testUnknownError = () => {
    handleClose()
    setTimeout(() => {
      throw new Error('Something unexpected happened in the quantum flux capacitor')
    }, 100)
  }

  const getPositionStyles = () => {
    const positions = {
      'top-right': { top: 24, right: 24 },
      'top-left': { top: 24, left: 24 },
      'bottom-right': { bottom: 24, right: 24 },
      'bottom-left': { bottom: 24, left: 24 }
    }
    return positions[position]
  }

  // Always show in development, or when debug=true in URL, or when NODE_ENV is not production
  if (process.env.NODE_ENV === 'production' && !window.location.search.includes('debug=true')) {
    return null
  }

  return (
    <>
      <Fade in={isVisible}>
        <Fab
          color="error"
          aria-label="test errors"
          onClick={handleClick}
          sx={{
            position: 'fixed',
            ...getPositionStyles(),
            zIndex: 1300,
            background: 'linear-gradient(135deg, #ED4245 0%, #DC2626 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #F87171 0%, #ED4245 100%)',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 20px rgba(237, 66, 69, 0.4)',
          }}
        >
          <BugIcon />
        </Fab>
      </Fade>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(47, 49, 54, 0.95) 0%, rgba(54, 57, 63, 0.95) 100%)',
            border: '1px solid rgba(237, 66, 69, 0.3)',
            borderRadius: 3,
            minWidth: 280,
            maxWidth: 320,
            backdropFilter: 'blur(10px)',
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="h6" sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: 'error.main',
            fontWeight: 700
          }}>
            <TestIcon />
            Error Testing Panel
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Trigger different error types to test the error boundary
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(237, 66, 69, 0.2)' }} />

        <MenuItem onClick={testRuntimeError}>
          <ListItemIcon>
            <RuntimeIcon sx={{ color: '#ED4245' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Runtime Error</Typography>
            <Typography variant="caption" color="text.secondary">
              Null reference exception
            </Typography>
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={testNetworkError}>
          <ListItemIcon>
            <NetworkIcon sx={{ color: '#7DD3FC' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Network Error</Typography>
            <Typography variant="caption" color="text.secondary">
              Connection failure
            </Typography>
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={testFileSystemError}>
          <ListItemIcon>
            <FileIcon sx={{ color: '#FEE75C' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>File System Error</Typography>
            <Typography variant="caption" color="text.secondary">
              File not found
            </Typography>
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={testProcessingError}>
          <ListItemIcon>
            <ErrorIcon sx={{ color: '#F59E0B' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Processing Error</Typography>
            <Typography variant="caption" color="text.secondary">
              FFmpeg processing failure
            </Typography>
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={testValidationError}>
          <ListItemIcon>
            <WarningIcon sx={{ color: '#F87171' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Validation Error</Typography>
            <Typography variant="caption" color="text.secondary">
              Invalid input data
            </Typography>
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={testUnknownError}>
          <ListItemIcon>
            <BugIcon sx={{ color: '#96989D' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Unknown Error</Typography>
            <Typography variant="caption" color="text.secondary">
              Unexpected error type
            </Typography>
          </ListItemText>
        </MenuItem>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        <MenuItem onClick={handleToggleVisibility}>
          <ListItemIcon>
            <CloseIcon sx={{ color: 'text.secondary' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" color="text.secondary">
              Hide Test Button
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Hidden toggle to show button again */}
      {!isVisible && (
        <Box
          onClick={handleToggleVisibility}
          sx={{
            position: 'fixed',
            ...getPositionStyles(),
            width: 20,
            height: 20,
            backgroundColor: 'rgba(237, 66, 69, 0.5)',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 1300,
            '&:hover': {
              backgroundColor: 'rgba(237, 66, 69, 0.8)',
            }
          }}
        />
      )}
    </>
  )
}