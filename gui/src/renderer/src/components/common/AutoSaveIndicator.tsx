/**
 * AutoSaveIndicator Component
 * Reusable auto-save status indicator with Material-UI design
 * Shows saving state, success state, and error state with appropriate styling
 */

import React from 'react'
import { Box, Chip } from '@mui/material'
import { CheckCircle, Save, Error as ErrorIcon, Sync } from '@mui/icons-material'
import type { AutoSaveStatus, WorkspaceError } from '../../types/workspace'

interface AutoSaveIndicatorProps {
  autoSaveStatus: AutoSaveStatus
  isAutoSaving: boolean
  error?: WorkspaceError | Error | null
  variant?: 'default' | 'compact'
  showWhenIdle?: boolean
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  autoSaveStatus,
  isAutoSaving,
  error,
  variant = 'default',
  showWhenIdle = true
}) => {
  const hasRecentSave = autoSaveStatus.lastSaveTime && (Date.now() - autoSaveStatus.lastSaveTime) < 30000 // 30 seconds
  
  // Don't show anything if idle and showWhenIdle is false
  if (!showWhenIdle && !isAutoSaving && !error && !hasRecentSave) {
    return null
  }

  const getStatusChip = () => {
    if (error) {
      return (
        <Chip
          icon={<ErrorIcon />}
          label={variant === 'compact' ? 'Error' : 'Save error'}
          size="small"
          color="error"
          variant="outlined"
          sx={{
            backgroundColor: 'rgba(211, 47, 47, 0.1)',
            borderColor: 'rgba(211, 47, 47, 0.3)'
          }}
        />
      )
    }
    
    if (isAutoSaving) {
      return (
        <Chip
          icon={<Save sx={{ animation: 'pulse 1.5s ease-in-out infinite' }} />}
          label={variant === 'compact' ? 'Saving...' : 'Auto-saving...'}
          size="small"
          color="primary"
          variant="outlined"
          sx={{
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderColor: 'rgba(25, 118, 210, 0.3)',
            '& .MuiChip-icon': {
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 }
              }
            }
          }}
        />
      )
    }
    
    if (hasRecentSave) {
      return (
        <Chip
          icon={<CheckCircle />}
          label={variant === 'compact' ? 'Saved' : 'Saved'}
          size="small"
          color="success"
          variant="outlined"
          sx={{
            backgroundColor: 'rgba(46, 125, 50, 0.1)',
            borderColor: 'rgba(46, 125, 50, 0.3)'
          }}
        />
      )
    }

    // Show pending saves if any
    if (autoSaveStatus.pendingSaves > 0) {
      return (
        <Chip
          icon={<Sync />}
          label={`${autoSaveStatus.pendingSaves} pending`}
          size="small"
          color="info"
          variant="outlined"
          sx={{
            backgroundColor: 'rgba(2, 136, 209, 0.1)',
            borderColor: 'rgba(2, 136, 209, 0.3)'
          }}
        />
      )
    }

    return null
  }

  const statusChip = getStatusChip()
  
  if (!statusChip) {
    return null
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        minHeight: variant === 'compact' ? 24 : 32
      }}
      role="status"
      aria-live="polite"
      aria-label={
        error ? 'Auto-save error' :
        isAutoSaving ? 'Auto-saving in progress' :
        hasRecentSave ? 'Recently saved' :
        autoSaveStatus.pendingSaves > 0 ? `${autoSaveStatus.pendingSaves} saves pending` :
        'Auto-save status'
      }
    >
      {statusChip}
    </Box>
  )
}

// Specialized indicators for different contexts
export const StepAutoSaveIndicator: React.FC<{
  autoSaveStatus: AutoSaveStatus
  isAutoSaving: boolean
  error?: WorkspaceError | Error | null
}> = (props) => (
  <AutoSaveIndicator {...props} variant="default" showWhenIdle={false} />
)

export const CompactAutoSaveIndicator: React.FC<{
  autoSaveStatus: AutoSaveStatus
  isAutoSaving: boolean
  error?: WorkspaceError | Error | null
}> = (props) => (
  <AutoSaveIndicator {...props} variant="compact" showWhenIdle={true} />
)