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
  Button
} from '@mui/material'
import {
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  RadioButtonChecked as ActiveIcon
} from '@mui/icons-material'
import { WorkspaceContextMenuProps } from './types'
import { WorkspaceDeleteDialog } from './WorkspaceDeleteDialog'

/**
 * WorkspaceContextMenu - Context menu for workspace management actions
 * Features: Rename, duplicate, delete, set active with confirmation dialogs
 */
export const WorkspaceContextMenu: React.FC<WorkspaceContextMenuProps> = ({
  workspace,
  anchorEl,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
  onSetActive
}) => {
  const [renameDialog, setRenameDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [newName, setNewName] = useState(workspace.name)
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    onClose()
    setRenameDialog(false)
    setDeleteDialog(false)
    setNewName(workspace.name)
    setLoading(false)
  }

  const handleRename = async () => {
    if (newName.trim() === workspace.name.trim()) {
      handleClose()
      return
    }

    if (newName.trim().length === 0) return

    setLoading(true)
    try {
      await onRename(workspace.id, newName.trim())
      handleClose()
    } catch (error) {
      console.error('Failed to rename workspace:', error)
      setLoading(false)
    }
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

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onDelete(workspace.id)
      handleClose()
    } catch (error) {
      console.error('Failed to delete workspace:', error)
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

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        disableRestoreFocus
        PaperProps={{
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
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        {!workspace.isActive && (
          <>
            <MenuItem onClick={handleSetActive} disabled={loading}>
              <ListItemIcon>
                <ActiveIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Switch to Workspace" 
                secondary="Make this the active workspace"
                secondaryTypographyProps={{
                  variant: 'caption',
                  sx: { fontSize: '0.7rem', color: 'text.secondary' }
                }}
              />
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
          </>
        )}

        <MenuItem onClick={() => setRenameDialog(true)} disabled={loading}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Rename Workspace" 
            secondary="Change workspace name"
            secondaryTypographyProps={{
              variant: 'caption',
              sx: { fontSize: '0.7rem', color: 'text.secondary' }
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
            secondaryTypographyProps={{
              variant: 'caption',
              sx: { fontSize: '0.7rem', color: 'text.secondary' }
            }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem 
          onClick={() => setDeleteDialog(true)} 
          disabled={loading || workspace.isActive}
          sx={{ 
            color: workspace.isActive ? 'text.disabled' : 'error.main',
            '&:hover': {
              backgroundColor: workspace.isActive ? 'transparent' : 'rgba(237, 66, 69, 0.08)'
            }
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color={workspace.isActive ? 'disabled' : 'error'} />
          </ListItemIcon>
          <ListItemText 
            primary="Delete Workspace" 
            secondary={workspace.isActive ? 'Cannot delete active workspace' : 'Permanently remove workspace'}
            secondaryTypographyProps={{
              variant: 'caption',
              sx: { fontSize: '0.7rem' }
            }}
          />
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog 
        open={renameDialog} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rename Workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Workspace Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            inputProps={{ maxLength: 30 }}
            helperText={`${newName.length}/30 characters`}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                handleRename()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleRename} 
            disabled={loading || !newName.trim() || newName.trim() === workspace.name.trim()}
            variant="contained"
          >
            {loading ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Delete Confirmation Dialog */}
      <WorkspaceDeleteDialog
        open={deleteDialog}
        workspace={workspace}
        loading={loading}
        onClose={handleClose}
        onConfirm={handleDelete}
      />
    </>
  )
}