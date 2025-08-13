import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { WorkspaceWithGrouping } from './types';
import { WORKSPACE_CONSTRAINTS } from './types';

export interface WorkspaceRenameDialogProps {
  open: boolean;
  workspace: WorkspaceWithGrouping | null;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
  availableWorkspaces?: WorkspaceWithGrouping[];
}

/**
 * WorkspaceRenameDialog - Rename workspace dialog
 * Features: Name validation, character limit, proper error handling
 */
export const WorkspaceRenameDialog: React.FC<WorkspaceRenameDialogProps> = ({
  open,
  workspace,
  onClose,
  onConfirm,
  availableWorkspaces = [],
}) => {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  // Reset state when dialog opens/closes or workspace changes
  useEffect(() => {
    if (open && workspace) {
      setNewName(workspace.name)
      setNameError('')
      setLoading(false)
    }
  }, [open, workspace])

  const validateName = (name: string): string => {
    if (!name.trim()) return 'Workspace name is required'
    if (name.length > WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH) {
      return `Name must be ${WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH} characters or less`
    }
    if (name.trim() === workspace?.name.trim()) {
      return 'Please enter a different name'
    }
    
    // Check for duplicate names (case-insensitive)
    const duplicateWorkspace = availableWorkspaces.find(
      w => w.id !== workspace?.id && w.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
    if (duplicateWorkspace) {
      return `A workspace named "${duplicateWorkspace.name}" already exists`
    }
    
    return ''
  }

  const handleNameChange = (name: string) => {
    setNewName(name)
    setNameError(validateName(name))
  }

  const handleConfirm = async () => {
    if (!workspace) return

    const error = validateName(newName)
    if (error) {
      setNameError(error)
      return
    }

    setLoading(true)
    try {
      await onConfirm(newName.trim())
      onClose()
    } catch (error) {
      console.error('Failed to rename workspace:', error)
      setNameError('Failed to rename workspace. Please try again.')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!workspace) return null

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: 'background.paper'
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        pb: 1
      }}>
        <EditIcon color="primary" />
        Rename Workspace
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Renaming workspace: <strong>{workspace.name}</strong>
          </Typography>
        </Box>

        <TextField
          autoFocus
          fullWidth
          label="Workspace Name"
          value={newName}
          onChange={(e) => handleNameChange(e.target.value)}
          error={Boolean(nameError)}
          helperText={nameError || `${newName.length}/${WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH} characters`}
          inputProps={{ maxLength: WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH }}
          sx={{ mb: 2 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim() && !nameError && !loading) {
              handleConfirm()
            }
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm} 
          disabled={loading || !newName.trim() || Boolean(nameError)}
          variant="contained"
          startIcon={loading ? undefined : <EditIcon />}
        >
          {loading ? 'Renaming...' : 'Rename'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}