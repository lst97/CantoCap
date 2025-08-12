import React, { useState, useCallback, useMemo } from 'react'
import { Box, IconButton, Tooltip } from '@mui/material'
import { 
  Add as AddIcon, 
  Settings as SettingsIcon} from '@mui/icons-material'
import { WorkspaceContextMenu } from '../workspace/WorkspaceContextMenu'
import { WorkspaceCreationDialog } from '../workspace/WorkspaceCreationDialog'
import { 
  useWorkspaceList, 
  useWorkspaceLoading, 
  useWorkspaceCount,
  useAvailableGroups,
  useCreateWorkspace,
  useSwitchWorkspace,
  useRenameWorkspace,
  useDuplicateWorkspace,
  useDeleteWorkspace,
  useCreateGroup,
  useAddWorkspaceToGroup,
  useRemoveWorkspaceFromGroup
} from '../../stores/useWorkspaceStore'
import type { WorkspaceWithGrouping } from '../../stores/types/StoreTypes'

interface WorkspacePanelProps {
  onSettings?: () => void
}

/**
 * WorkspacePanel - Discord-style tiny workspace sidebar
 * Shows workspace avatars in a vertical column like Discord servers
 */
export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  onSettings = () => console.log('Open settings')
}) => {
  // Use direct store hooks with stable references - NO MORE WRAPPER HOOKS!
  const workspaceListRaw = useWorkspaceList()
  const workspaces = useMemo(() => 
    (workspaceListRaw || []) as WorkspaceWithGrouping[], 
    [workspaceListRaw]
  )
  const isLoading = useWorkspaceLoading()
  const workspaceCount = useWorkspaceCount()
  
  // Get pre-computed grouping data directly from store (stable references)
  const availableGroups = useAvailableGroups()
  
  // Get action hooks directly from store
  const createWorkspace = useCreateWorkspace()
  const switchWorkspace = useSwitchWorkspace()
  const renameWorkspace = useRenameWorkspace()
  const duplicateWorkspace = useDuplicateWorkspace()
  const deleteWorkspace = useDeleteWorkspace()
  const createGroup = useCreateGroup()
  const addWorkspaceToGroup = useAddWorkspaceToGroup()
  const removeWorkspaceFromGroup = useRemoveWorkspaceFromGroup()

  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    workspace: WorkspaceWithGrouping
    anchorEl: HTMLElement
  } | null>(null)

  // Event handlers with proper error handling
  const handleWorkspaceClick = useCallback(async (workspace: WorkspaceWithGrouping) => {
    try {
      await switchWorkspace(workspace.id)
    } catch (error) {
      console.error('Failed to switch workspace:', error)
    }
  }, [switchWorkspace])

  const handleWorkspaceContextMenu = useCallback((event: React.MouseEvent<HTMLElement>, workspace: WorkspaceWithGrouping) => {
    event.preventDefault()
    setContextMenu({
      workspace,
      anchorEl: event.currentTarget
    })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleCreateWorkspace = useCallback(async (name: string, copyFromId?: string) => {
    try {
      if (copyFromId) {
        await duplicateWorkspace(copyFromId, name)
      } else {
        await createWorkspace(name)
      }
      setCreateDialogOpen(false)
    } catch (error) {
      console.error('Failed to create workspace:', error)
    }
  }, [createWorkspace, duplicateWorkspace])

  const handleSetActiveWorkspace = useCallback(async (workspaceId: string) => {
    try {
      await switchWorkspace(workspaceId)
      setContextMenu(null)
    } catch (error) {
      console.error('Failed to set active workspace:', error)
    }
  }, [switchWorkspace])

  const handleRenameWorkspace = useCallback(async (workspaceId: string, newName: string) => {
    try {
      await renameWorkspace(workspaceId, newName)
      setContextMenu(null)
    } catch (error) {
      console.error('Failed to rename workspace:', error)
    }
  }, [renameWorkspace])

  const handleDuplicateWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const currentWorkspace = workspaces.find(w => w.id === workspaceId)
      const defaultName = `Copy of ${currentWorkspace?.name || 'Workspace'}`
      await duplicateWorkspace(workspaceId, defaultName)
      setContextMenu(null)
    } catch (error) {
      console.error('Failed to duplicate workspace:', error)
    }
  }, [duplicateWorkspace, workspaces])

  const handleDeleteWorkspace = useCallback(async (workspaceId: string) => {
    try {
      await deleteWorkspace(workspaceId)
      setContextMenu(null)
    } catch (error) {
      console.error('Failed to delete workspace:', error)
    }
  }, [deleteWorkspace])

  return (
    <Box
      sx={{
        width: 72, // Discord-like narrow sidebar
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgb(32, 34, 37)', // Discord dark sidebar color
        borderRadius: 0,
        overflow: 'hidden',
        py: 1
      }}
    >
      {/* Create workspace button at top */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <Tooltip title="Create new workspace" placement="right">
          <IconButton
            onClick={() => setCreateDialogOpen(true)}
            disabled={isLoading}
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'rgb(54, 57, 63)',
              color: 'rgb(176, 180, 185)',
              borderRadius: '50%',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'white',
                borderRadius: '16px',
                transition: 'all 0.2s ease'
              }
            }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Separator line */}
      {workspaceCount > 0 && (
        <Box sx={{ 
          height: 2, 
          backgroundColor: 'rgb(54, 57, 63)', 
          mx: 2, 
          mb: 1,
          borderRadius: 1
        }} />
      )}

      {/* Workspace avatars */}
      <Box 
        sx={{ 
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          px: 1
        }}
      >
        {/* Render all workspaces as simple avatars */}
        {workspaces.map((workspace) => (
          <Tooltip key={workspace.id} title={workspace.name} placement="right">
            <Box
              onClick={() => handleWorkspaceClick(workspace)}
              onContextMenu={(event) => handleWorkspaceContextMenu(event, workspace)}
              sx={{
                width: 56,
                height: 56,
                backgroundColor: workspace.isActive ? 'primary.main' : 'rgb(54, 57, 63)',
                color: 'white',
                borderRadius: workspace.isActive ? '16px' : '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                border: workspace.isActive ? '2px solid' : 'none',
                borderColor: 'primary.light',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderRadius: '16px',
                  backgroundColor: workspace.isActive ? 'primary.main' : 'primary.dark'
                }
              }}
            >
              {workspace.name.charAt(0).toUpperCase()}
            </Box>
          </Tooltip>
        ))}
      </Box>

      {/* Settings button at bottom */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
        <Tooltip title="Workspace settings" placement="right">
          <IconButton
            onClick={onSettings}
            disabled={isLoading}
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'rgb(54, 57, 63)',
              color: 'rgb(176, 180, 185)',
              borderRadius: '50%',
              '&:hover': {
                backgroundColor: 'rgb(64, 68, 75)',
                borderRadius: '16px',
                transition: 'all 0.2s ease'
              }
            }}
          >
            <SettingsIcon />
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
          onRename={handleRenameWorkspace}
          onDuplicate={handleDuplicateWorkspace}
          onDelete={handleDeleteWorkspace}
          onSetActive={handleSetActiveWorkspace}
          onAddToGroup={addWorkspaceToGroup}
          onRemoveFromGroup={removeWorkspaceFromGroup}
          onCreateGroup={async (name: string, workspaceId: string) => {
            const groupId = await createGroup(name)
            await addWorkspaceToGroup(workspaceId, groupId)
            return groupId
          }}
          availableGroups={availableGroups}
        />
      )}
    </Box>
  )
}