import React, { useState, useCallback } from 'react'
import { Box, IconButton, Tooltip, Divider, Typography, CircularProgress, Alert } from '@mui/material'
import { 
  Add as AddIcon, 
  Settings as SettingsIcon,
  Warning as WarningIcon 
} from '@mui/icons-material'
import { WorkspaceAvatar } from './WorkspaceAvatar'
import { WorkspaceContextMenu } from './WorkspaceContextMenu'
import { WorkspaceCreationDialog } from './WorkspaceCreationDialog'
import { MigrationProgressDialog } from './MigrationProgressDialog'
import { useWorkspacePanelIntegration } from './hooks'
import type { Workspace } from './types'

interface EnhancedWorkspacePanelProps {
  // Settings callback (only external prop needed now)
  onSettings?: () => void
}

/**
 * EnhancedWorkspacePanel - Fully integrated workspace management panel
 * Now self-contained with integrated workspace store operations
 */
export const EnhancedWorkspacePanel: React.FC<EnhancedWorkspacePanelProps> = ({
  onSettings = () => console.log('Open settings')
}) => {
  // Get all workspace state and actions from integrated store
  const {
    workspaces,
    activeWorkspace,
    isMigrating,
    migrationPhase,
    migrationProgress,
    canRollback,
    isLoading,
    lastError,
    onCreateWorkspace,
    onSwitchWorkspace,
    onRenameWorkspace,
    onDuplicateWorkspace,
    onDeleteWorkspace,
    onRollback
  } = useWorkspacePanelIntegration()
  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    workspace: Workspace
    anchorEl: HTMLElement
  } | null>(null)
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null)

  // Enhanced event handlers with loading states and error handling
  const handleWorkspaceClick = useCallback(async (workspace: Workspace) => {
    if (workspace.id !== activeWorkspace?.id && !operationInProgress) {
      setOperationInProgress('switching')
      try {
        await onSwitchWorkspace(workspace.id)
      } catch (error) {
        console.error('Failed to switch workspace:', error)
      } finally {
        setOperationInProgress(null)
      }
    }
  }, [activeWorkspace?.id, onSwitchWorkspace, operationInProgress])

  const handleWorkspaceContextMenu = useCallback((event: React.MouseEvent<HTMLElement>, workspace: Workspace) => {
    event.preventDefault()
    if (!operationInProgress) {
      setContextMenu({
        workspace,
        anchorEl: event.currentTarget
      })
    }
  }, [operationInProgress])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleCreateWorkspace = useCallback(async (name: string, copyFromId?: string) => {
    setOperationInProgress('creating')
    try {
      await onCreateWorkspace(name, copyFromId)
      setCreateDialogOpen(false)
    } catch (error) {
      console.error('Failed to create workspace:', error)
      // Dialog stays open on error for user to retry
    } finally {
      setOperationInProgress(null)
    }
  }, [onCreateWorkspace])

  const handleSetActiveWorkspace = useCallback(async (workspaceId: string) => {
    setOperationInProgress('switching')
    try {
      await onSwitchWorkspace(workspaceId)
      setContextMenu(null)
    } catch (error) {
      console.error('Failed to set active workspace:', error)
    } finally {
      setOperationInProgress(null)
    }
  }, [onSwitchWorkspace])

  return (
    <>
      <Box 
        sx={{ 
          width: 80,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          gap: 2,
          borderRight: 1,
          borderColor: 'divider',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {/* Error Alert */}
        {lastError && (
          <Alert 
            severity="error" 
            sx={{ 
              width: '90%', 
              fontSize: '0.7rem',
              '& .MuiAlert-message': { overflow: 'hidden', textOverflow: 'ellipsis' }
            }}
          >
            {lastError.message || 'Workspace error'}
          </Alert>
        )}

        {/* Create New Workspace Button */}
        <Tooltip title="Create New Workspace" placement="right">
          <IconButton
            onClick={() => setCreateDialogOpen(true)}
            disabled={isMigrating || isLoading || operationInProgress === 'creating'}
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'primary.main',
              borderRadius: 2,
              color: 'white',
              position: 'relative',
              '&:hover': { 
                backgroundColor: 'primary.dark', 
                transform: 'scale(1.05)',
                boxShadow: 4
              },
              '&:disabled': {
                backgroundColor: 'grey.600',
                color: 'grey.400'
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: 2
            }}
          >
            {operationInProgress === 'creating' ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              <AddIcon sx={{ fontSize: 32 }} />
            )}
          </IconButton>
        </Tooltip>
        
        {/* Workspace List */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1.5,
          width: '100%',
          alignItems: 'center',
          overflow: 'auto',
          py: 1
        }}>
          {isLoading && workspaces.length === 0 ? (
            // Loading state
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4
            }}>
              <CircularProgress size={24} />
            </Box>
          ) : workspaces.length === 0 ? (
            // Empty state
            <Box sx={{ 
              textAlign: 'center', 
              py: 2,
              opacity: 0.6
            }}>
              <Typography variant="caption" sx={{ 
                writingMode: 'vertical-lr',
                color: 'text.secondary',
                fontSize: '0.7rem'
              }}>
                No workspaces
              </Typography>
            </Box>
          ) : (
            workspaces.map((workspace) => (
              <Box key={workspace.id} sx={{ position: 'relative' }}>
                <WorkspaceAvatar
                  workspace={workspace}
                  size="medium"
                  isActive={workspace.id === activeWorkspace?.id}
                  onClick={() => handleWorkspaceClick(workspace)}
                  onContextMenu={(event) => handleWorkspaceContextMenu(event, workspace)}
                />
                {/* Switching indicator */}
                {operationInProgress === 'switching' && workspace.id === activeWorkspace?.id && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: 2
                    }}
                  >
                    <CircularProgress size={20} sx={{ color: 'white' }} />
                  </Box>
                )}
              </Box>
            ))
          )}
        </Box>

        {/* Divider */}
        {workspaces.length > 0 && (
          <Divider sx={{ width: '60%', bgcolor: 'divider' }} />
        )}
        
        {/* Settings Button */}
        <Tooltip title="Settings" placement="right">
          <IconButton
            onClick={onSettings}
            disabled={isMigrating || isLoading}
            sx={{
              width: 40,
              height: 40,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                transform: 'scale(1.05)'
              },
              '&:disabled': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'grey.600'
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Workspace Creation Dialog */}
      <WorkspaceCreationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreateWorkspace={handleCreateWorkspace}
        availableWorkspaces={workspaces}
      />

      {/* Context Menu */}
      {contextMenu && (
        <WorkspaceContextMenu
          workspace={contextMenu.workspace}
          anchorEl={contextMenu.anchorEl}
          onClose={handleCloseContextMenu}
          onRename={onRenameWorkspace}
          onDuplicate={onDuplicateWorkspace}
          onDelete={onDeleteWorkspace}
          onSetActive={handleSetActiveWorkspace}
        />
      )}

      {/* Migration Progress Dialog */}
      <MigrationProgressDialog
        isOpen={isMigrating}
        currentPhase={migrationPhase}
        progress={migrationProgress}
        canRollback={canRollback}
        onRollback={onRollback}
        onClose={() => {}} // Migration dialog auto-closes on completion
      />
    </>
  )
}

// Create a wrapper component for backward compatibility
export const WorkspacePanel = EnhancedWorkspacePanel