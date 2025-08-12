import React from 'react'
import { Box, Chip, Tooltip, CircularProgress } from '@mui/material'
import {
  CheckCircle as ActiveIcon,
  CloudOff as ErrorIcon} from '@mui/icons-material'
import { 
  useCurrentWorkspace, 
  useWorkspaceLoading, 
  useWorkspaceError,
  useWorkspaceList 
} from '../../stores/useWorkspaceStore'

interface WorkspaceStatusIndicatorProps {
  showFullStatus?: boolean
  compact?: boolean
}

/**
 * WorkspaceStatusIndicator - Real-time workspace status indicator
 * Shows workspace status and health information
 */
export const WorkspaceStatusIndicator: React.FC<WorkspaceStatusIndicatorProps> = ({
  compact = true
}) => {
  // Get workspace state from new store
  const currentWorkspace = useCurrentWorkspace()
  const isLoading = useWorkspaceLoading()
  const error = useWorkspaceError()

  // Determine status
  const getStatus = () => {
    // Error state
    if (error) {
      return {
        type: 'error' as const,
        label: 'Error',
        color: 'error' as const,
        icon: <ErrorIcon fontSize="small" />,
        tooltip: `Error: ${error}`
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

    // Active workspace state
    if (currentWorkspace) {
      return {
        type: 'active' as const,
        label: 'Active',
        color: 'success' as const,
        icon: <ActiveIcon fontSize="small" />,
        tooltip: `Active workspace: ${currentWorkspace.name}`
      }
    }

    // No workspace selected
    return {
      type: 'inactive' as const,
      label: 'No workspace',
      color: 'default' as const,
      icon: <ErrorIcon fontSize="small" />,
      tooltip: 'No workspace selected'
    }
  }

  const status = getStatus()

  // Always show some status
  // if (!currentWorkspace && !isLoading) {
  //   return null
  // }

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
  const currentWorkspace = useCurrentWorkspace()
  const workspaces = useWorkspaceList()
  const isLoading = useWorkspaceLoading()
  const error = useWorkspaceError()

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
          <span>{workspaces.length}</span>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Loading:</span>
          <span>{isLoading ? 'Yes' : 'No'}</span>
        </Box>
        
        {error && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'error.main' }}>
            <span>Error:</span>
            <span>{error}</span>
          </Box>
        )}
      </Box>
    </Box>
  )
}