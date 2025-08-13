import React, { useState } from 'react'
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box
} from '@mui/material'
import {
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  RadioButtonChecked as ActiveIcon,
  Remove as RemoveIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { WorkspaceContextMenuProps } from './types'
import { getGroupColorRgb } from './GroupColorPicker'

/**
 * WorkspaceContextMenu - Context menu for workspace management actions
 * Features: Rename, duplicate, group management, delete, set active with confirmation dialogs
 * Group Management: Add to existing groups, remove from groups, create new groups
 */
export const WorkspaceContextMenu: React.FC<WorkspaceContextMenuProps> = ({
  workspace,
  anchorEl,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
  onSetActive,
  onAddToGroup,
  onRemoveFromGroup,
  onCreateGroup,
  onCreateNewGroup,
  availableGroups = []}) => {
  const [groupDialog, setGroupDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [loading, setLoading] = useState(false)


  const handleClose = () => {
    onClose()
    setGroupDialog(false)
    // Don't close enhanced group dialog when context menu closes
    // setEnhancedGroupDialog(false) - moved to dialog's own onClose
    setNewGroupName('')
    setLoading(false)
  }


  const handleDuplicate = async () => {
    setLoading(true)
    try {
      await onDuplicate(workspace.id)
      handleClose()
    } catch (error) {
      console.error('Failed to duplicate workspace:', error)
      setLoading(false)
    }
  }


  const handleSetActive = async () => {
    if (workspace.isActive) {
      handleClose()
      return
    }

    setLoading(true)
    try {
      await onSetActive(workspace.id)
      handleClose()
    } catch (error) {
      console.error('Failed to set active workspace:', error)
      setLoading(false)
    }
  }

  const handleAddToGroup = async (groupId: string) => {
    setLoading(true)
    try {
      await onAddToGroup?.(workspace.id, groupId)
      handleClose()
    } catch (error) {
      console.error('Failed to add workspace to group:', error)
      setLoading(false)
    }
  }

  const handleRemoveFromGroup = async () => {
    setLoading(true)
    try {
      await onRemoveFromGroup?.(workspace.id)
      handleClose()
    } catch (error) {
      console.error('Failed to remove workspace from group:', error)
      setLoading(false)
    }
  }

  const handleCreateGroup = async () => {
    if (newGroupName.trim().length === 0) return
    
    setLoading(true)
    try {
      await onCreateGroup?.(newGroupName.trim(), workspace.id)
      handleClose()
    } catch (error) {
      console.error('Failed to create group:', error)
      setLoading(false)
    }
  }


  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        disableRestoreFocus
        slotProps={{
          paper: {
            sx: {
              width: 240,
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              '& .MuiMenuItem-root': {
                borderRadius: 1,
                mx: 0.5,
                my: 0.25,
                py: 1,
                fontSize: '0.875rem',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }
            }
          }
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        {!workspace.isActive && [
          <MenuItem key="setActive" onClick={handleSetActive} disabled={loading}>
            <ListItemIcon>
              <ActiveIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Switch to Workspace" 
              secondary="Make this the active workspace"
              slotProps={{
                secondary: {
                  variant: 'caption',
                  sx: { fontSize: '0.7rem', color: 'text.secondary' }
                }
              }}
            />
          </MenuItem>,
          <Divider key="divider1" sx={{ my: 0.5 }} />
        ]}

        <MenuItem onClick={() => {
          onRename(workspace.id)
        }} disabled={loading}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Rename Workspace" 
            secondary="Change workspace name"
            slotProps={{
              secondary: {
                variant: 'caption',
                sx: { fontSize: '0.7rem', color: 'text.secondary' }
              }
            }}
          />
        </MenuItem>

        <MenuItem onClick={handleDuplicate} disabled={loading}>
          <ListItemIcon>
            <DuplicateIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Duplicate Workspace" 
            secondary="Create a copy with same settings"
            slotProps={{
              secondary: {
                variant: 'caption',
                sx: { fontSize: '0.7rem', color: 'text.secondary' }
              }
            }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Enhanced Group Management Section */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            📁 Group Management
          </Typography>
        </Box>

        {/* Create New Group - Always show this option */}
        <MenuItem onClick={() => {
          onCreateNewGroup?.(workspace.id)
        }} disabled={loading}>
          <ListItemIcon>
            <AddIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText 
            primary="Create New Group"
            secondary="Create a group with multiple workspaces"
            slotProps={{
              secondary: {
                variant: 'caption',
                sx: { fontSize: '0.7rem', color: 'text.secondary' }
              }
            }}
          />
        </MenuItem>

        {/* Add to Existing Groups - Show if groups exist */}
        {availableGroups.length > 0 && [
          <Box key="addToGroupHeader" sx={{ px: 2, py: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 500 }}>
              Add to Existing Group
            </Typography>
          </Box>,
          
          ...availableGroups.map(group => (
            <MenuItem
              key={group.id}
              onClick={() => handleAddToGroup(group.id)}
              disabled={loading || workspace.group?.id === group.id}
              sx={{ pl: 4 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '4px',
                    backgroundColor: getGroupColorRgb(group.color)
                  }}
                />
              </ListItemIcon>
              <ListItemText 
                primary={group.name}
                secondary={
                  workspace.group?.id === group.id 
                    ? 'Current group' 
                    : `${group.metadata.workspaceCount} workspace${group.metadata.workspaceCount !== 1 ? 's' : ''}`
                }
                slotProps={{
                  secondary: {
                    variant: 'caption',
                    sx: { fontSize: '0.65rem', color: 'text.secondary' }
                  }
                }}
              />
            </MenuItem>
          ))
        ]}

        {/* Remove from Group - Show if workspace is in a group */}
        {workspace.group && (
          <MenuItem onClick={handleRemoveFromGroup} disabled={loading}>
            <ListItemIcon>
              <RemoveIcon fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText 
              primary="Remove from Group"
              secondary={`Currently in: ${workspace.group.name}`}
              slotProps={{
                secondary: {
                  variant: 'caption',
                  sx: { fontSize: '0.7rem', color: 'text.secondary' }
                }
              }}
            />
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem 
          onClick={() => {
            onDelete(workspace.id)
            onClose() // Context menu can close immediately now
          }} 
          disabled={loading}
          sx={{ 
            color: 'error.main',
            '&:hover': {
              backgroundColor: 'rgba(237, 66, 69, 0.08)'
            }
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText 
            primary="Delete Workspace" 
            secondary={workspace.isActive ? 'Will switch to another workspace automatically' : 'Permanently remove workspace'}
            slotProps={{
              secondary: {
                variant: 'caption',
                sx: { fontSize: '0.7rem' }
              }
            }}
          />
        </MenuItem>
      </Menu>


      {/* Create Group Dialog */}
      <Dialog 
        open={groupDialog} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Group Name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            inputProps={{ maxLength: 25 }}
            helperText={`${newGroupName.length}/25 characters`}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGroupName.trim()) {
                handleCreateGroup()
              }
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This workspace will be automatically added to the new group.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateGroup} 
            disabled={loading || !newGroupName.trim()}
            variant="contained"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>


    </>
  )
}