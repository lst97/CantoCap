import React from 'react'
import { Button, Tooltip } from '@mui/material'
import { BugReport as BugReportIcon } from '@mui/icons-material'

interface DevToolsButtonProps {
  variant?: 'contained' | 'outlined' | 'text'
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
}

/**
 * DevToolsButton - Quick access button to open Chrome DevTools
 * Only visible in development mode
 */
export const DevToolsButton: React.FC<DevToolsButtonProps> = ({
  variant = 'outlined',
  size = 'small',
  showLabel = false
}) => {
  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  const handleOpenDevTools = async () => {
    try {
      if (window.electronAPI?.toggleDevTools) {
        await window.electronAPI.toggleDevTools()
      } else {
        console.warn('DevTools API not available')
      }
    } catch (error) {
      console.error('Failed to open DevTools:', error)
    }
  }

  return (
    <Tooltip title="Open Chrome DevTools (F12)">
      <Button
        variant={variant}
        size={size}
        onClick={handleOpenDevTools}
        startIcon={<BugReportIcon />}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9999,
          minWidth: showLabel ? 'auto' : 40,
          backgroundColor: variant === 'contained' ? 'error.main' : 'transparent',
          borderColor: 'error.main',
          color: 'error.main',
          '&:hover': {
            backgroundColor: 'error.main',
            color: 'white',
          }
        }}
      >
        {showLabel && 'DevTools'}
      </Button>
    </Tooltip>
  )
}

export default DevToolsButton