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
  Delete as DeleteIcon,
  Palette as ColorIcon
} from '@mui/icons-material'
import { WorkspaceGroup, WorkspaceGroupColor } from '../../stores/types/StoreTypes'
import { getGroupColorRgb } from './GroupColorPicker'

interface GroupContextMenuProps {
  group: WorkspaceGroup
  anchorEl: HTMLElement | null
  onClose: () => void
  onRenameGroup: (groupId: string, newName: string) => Promise<void>
  onDeleteGroup: (groupId: string) => Promise<void>
  onChangeGroupColor: (groupId: string, color: WorkspaceGroupColor) => Promise<void>
}

/**
 * GroupContextMenu - Context menu for group management actions
 * Features: Rename, color change, delete, add workspace, settings
 */
export const GroupContextMenu: React.FC<GroupContextMenuProps> = ({
  group,
  anchorEl,
  onClose,
  onRenameGroup,
  onDeleteGroup,
  onChangeGroupColor
}) => {
  const [renameDialog, setRenameDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState(group.name)
  const [colorDialog, setColorDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  const groupColors: WorkspaceGroupColor[] = [
    'default', 'blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo'
  ]

  const handleClose = () => {
    onClose()
    setRenameDialog(false)
    setColorDialog(false)
    setNewGroupName(group.name)
    setLoading(false)
  }

  const handleRename = async () => {
    if (newGroupName.trim().length === 0) return
    
    setLoading(true)
    try {
      await onRenameGroup(group.id, newGroupName.trim())
      handleClose()
    } catch (error) {
      console.error('Failed to rename group:', error)
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onDeleteGroup(group.id)
      handleClose()
    } catch (error) {
      console.error('Failed to delete group:', error)
      setLoading(false)
    }
  }

  const handleColorChange = async (color: WorkspaceGroupColor) => {
    setLoading(true)
    try {
      await onChangeGroupColor(group.id, color)
      handleClose()
    } catch (error) {
      console.error('Failed to change group color:', error)
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
        {/* Group Header */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            📁 Group: {group.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
            {group.metadata.workspaceCount} workspace{group.metadata.workspaceCount !== 1 ? 's' : ''}
          </Typography>
        </Box>

        <MenuItem onClick={() => setRenameDialog(true)} disabled={loading}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Rename Group" 
            secondary="Change the group name"
            slotProps={{
              secondary: {
                variant: 'caption',
                sx: { fontSize: '0.7rem', color: 'text.secondary' }
              }
            }}
          />
        </MenuItem>

        <MenuItem onClick={() => setColorDialog(true)} disabled={loading}>
          <ListItemIcon>
            <ColorIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Change Color" 
            secondary="Update group color theme"
            slotProps={{
              secondary: {
                variant: 'caption',
                sx: { fontSize: '0.7rem', color: 'text.secondary' }
              }
            }}
          />
        </MenuItem>


        <Divider sx={{ my: 0.5 }} />

        <MenuItem 
          onClick={handleDelete}
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
            primary="Delete Group" 
            secondary={`Remove group and ungroup ${group.metadata.workspaceCount} workspace${group.metadata.workspaceCount !== 1 ? 's' : ''}`}
            slotProps={{
              secondary: {
                variant: 'caption',
                sx: { fontSize: '0.7rem' }
              }
            }}
          />
        </MenuItem>
      </Menu>

      {/* Rename Group Dialog */}
      <Dialog 
        open={renameDialog} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rename Group</DialogTitle>
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
            disabled={loading || !newGroupName.trim() || newGroupName === group.name}
            variant="contained"
          >
            {loading ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Color Change Dialog */}
      <Dialog 
        open={colorDialog} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Group Color</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose a new color theme for this group
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {groupColors.map((color) => (
              <Box
                key={color}
                onClick={() => handleColorChange(color)}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  backgroundColor: getGroupColorRgb(color),
                  border: group.color === color ? '3px solid' : '2px solid',
                  borderColor: group.color === color ? 'primary.main' : 'divider',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    borderColor: 'primary.main'
                  }
                }}
              >
                {group.color === color && (
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    ✓
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}