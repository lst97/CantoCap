import React, { useState, useEffect } from 'react'
import { Box, Chip, Tooltip, CircularProgress } from '@mui/material'
import {
  CloudDone as SavedIcon,
  CloudSync as SavingIcon,
  CloudOff as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { useWorkspaceStore } from '../../stores/workspace-store'

interface WorkspaceStatusIndicatorProps {
  showFullStatus?: boolean
  compact?: boolean
}

/**
 * WorkspaceStatusIndicator - Real-time workspace status indicator
 * Shows auto-save status, migration status, and workspace health
 */
export const WorkspaceStatusIndicator: React.FC<WorkspaceStatusIndicatorProps> = ({
  showFullStatus = false,
  compact = true
}) => {
  const {
    currentWorkspace,
    autoSaveStatus,
    migrationStatus,
    lastError,
    isLoading
  } = useWorkspaceStore()

  const [lastSaveTime, setLastSaveTime] = useState<string>('')

  // Update last save time display
  useEffect(() => {
    if (autoSaveStatus?.lastSaveTime) {
      const updateTime = () => {
        const now = Date.now()
        const diff = now - autoSaveStatus.lastSaveTime!
        
        if (diff < 60000) { // Less than 1 minute
          setLastSaveTime('just now')
        } else if (diff < 3600000) { // Less than 1 hour
          const minutes = Math.floor(diff / 60000)
          setLastSaveTime(`${minutes}m ago`)
        } else { // More than 1 hour
          const hours = Math.floor(diff / 3600000)
          setLastSaveTime(`${hours}h ago`)
        }
      }

      updateTime()
      const interval = setInterval(updateTime, 30000) // Update every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoSaveStatus?.lastSaveTime])

  // Determine status
  const getStatus = () => {
    // Migration in progress
    if (migrationStatus?.isActive) {
      return {
        type: 'migrating' as const,
        label: 'Migrating',
        color: 'info' as const,
        icon: <CircularProgress size={16} />,
        tooltip: `Migration ${migrationStatus.currentPhase}: ${migrationStatus.progress}%`
      }
    }

    // Error state
    if (lastError) {
      return {
        type: 'error' as const,
        label: 'Error',
        color: 'error' as const,
        icon: <ErrorIcon fontSize="small" />,
        tooltip: `Error: ${lastError.message || 'Unknown error'}`
      }
    }

    // Loading state
    if (isLoading) {
      return {
        type: 'loading' as const,
        label: 'Loading',
        color: 'default' as const,
        icon: <CircularProgress size={16} />,
        tooltip: 'Loading workspace...'
      }
    }

    // Auto-save states
    if (autoSaveStatus?.isEnabled) {
      if (autoSaveStatus.pendingSaves > 0) {
        return {
          type: 'saving' as const,
          label: 'Saving',
          color: 'warning' as const,
          icon: <SavingIcon fontSize="small" />,
          tooltip: `Auto-saving... (${autoSaveStatus.pendingSaves} pending)`
        }
      }

      if (autoSaveStatus.failedSaves > 0) {
        return {
          type: 'save-error' as const,
          label: 'Save Error',
          color: 'error' as const,
          icon: <WarningIcon fontSize="small" />,
          tooltip: `${autoSaveStatus.failedSaves} failed saves. Check connection.`
        }
      }

      return {
        type: 'saved' as const,
        label: 'Saved',
        color: 'success' as const,
        icon: <SavedIcon fontSize="small" />,
        tooltip: `Last saved ${lastSaveTime || 'recently'}`
      }
    }

    // Auto-save disabled
    return {
      type: 'disabled' as const,
      label: 'Manual',
      color: 'default' as const,
      icon: <CloudOff fontSize="small" />,
      tooltip: 'Auto-save disabled'
    }
  }

  const status = getStatus()

  if (!currentWorkspace && !migrationStatus?.isActive) {
    return null
  }

  if (compact) {
    return (
      <Tooltip title={status.tooltip} placement="top">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: `${status.color}.main`,
            backgroundOpacity: 0.1,
            color: `${status.color}.main`,
            fontSize: '0.75rem'
          }}
        >
          {status.icon}
          {!compact && status.label}
        </Box>
      </Tooltip>
    )
  }

  return (
    <Chip
      icon={status.icon}
      label={status.label}
      color={status.color}
      size="small"
      variant="outlined"
      sx={{
        fontSize: '0.75rem',
        '& .MuiChip-icon': {
          fontSize: '0.875rem'
        }
      }}
    />
  )
}

/**
 * WorkspaceHealthStatus - Detailed workspace health information
 * For use in settings or debug panels
 */
export const WorkspaceHealthStatus: React.FC = () => {
  const {
    currentWorkspace,
    availableWorkspaces,
    autoSaveStatus,
    performanceMetrics,
    migrationStatus,
    lastError
  } = useWorkspaceStore()

  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ mb: 2 }}>
        <strong>Workspace Health Status</strong>
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Active Workspace:</span>
          <span>{currentWorkspace?.name || 'None'}</span>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Total Workspaces:</span>
          <span>{availableWorkspaces.length}</span>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Auto-save:</span>
          <span>{autoSaveStatus?.isEnabled ? 'Enabled' : 'Disabled'}</span>
        </Box>
        
        {autoSaveStatus?.isEnabled && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pending Saves:</span>
              <span>{autoSaveStatus.pendingSaves}</span>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Failed Saves:</span>
              <span>{autoSaveStatus.failedSaves}</span>
            </Box>
          </>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Performance Metrics:</span>
          <span>{performanceMetrics.length} entries</span>
        </Box>
        
        {migrationStatus?.isActive && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Migration:</span>
            <span>{migrationStatus.currentPhase} ({migrationStatus.progress}%)</span>
          </Box>
        )}
        
        {lastError && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'error.main' }}>
            <span>Last Error:</span>
            <span>{lastError.message}</span>
          </Box>
        )}
      </Box>
    </Box>
  )
}