import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Chip,
  Divider,
  FormHelperText
} from '@mui/material'
import {
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Work as WorkspaceIcon
} from '@mui/icons-material'
import { WorkspaceCreationDialogProps, WORKSPACE_CONSTRAINTS } from './types'
import { WorkspaceAvatar } from './WorkspaceAvatar'

/**
 * WorkspaceCreationDialog - Dialog for creating new workspaces
 * Features: Name validation, copy from existing workspace, emoji selection
 */
export const WorkspaceCreationDialog: React.FC<WorkspaceCreationDialogProps> = ({
  open,
  onClose,
  onCreateWorkspace,
  availableWorkspaces
}) => {
  const [workspaceName, setWorkspaceName] = useState('')
  const [copyFromId, setCopyFromId] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('')
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  // Popular emoji options for workspaces
  const emojiOptions = ['粵', '🎬', '🎵', '📺', '🎯', '⭐', '🔥', '💎', '🚀', '💡', '🎨', '📚']

  const validateName = (name: string): string => {
    if (!name.trim()) return 'Workspace name is required'
    if (name.length > WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH) {
      return `Name must be ${WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH} characters or less`
    }
    if (availableWorkspaces.some(w => w.name.toLowerCase() === name.toLowerCase())) {
      return 'A workspace with this name already exists'
    }
    return ''
  }

  const handleNameChange = (name: string) => {
    setWorkspaceName(name)
    setNameError(validateName(name))
  }

  const handleCreate = async () => {
    const error = validateName(workspaceName)
    if (error) {
      setNameError(error)
      return
    }

    if (availableWorkspaces.length >= WORKSPACE_CONSTRAINTS.MAX_WORKSPACES) {
      setNameError(`Maximum ${WORKSPACE_CONSTRAINTS.MAX_WORKSPACES} workspaces allowed`)
      return
    }

    setLoading(true)
    try {
      // Use the parent's create workspace handler
      if (onCreateWorkspace) {
        await onCreateWorkspace(workspaceName.trim(), copyFromId || undefined)
      }
      
      handleClose()
    } catch (error) {
      console.error('Failed to create workspace:', error)
      setNameError('Failed to create workspace. Please try again.')
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    setWorkspaceName('')
    setCopyFromId('')
    setSelectedEmoji('')
    setNameError('')
    setLoading(false)
  }

  const copyFromWorkspace = availableWorkspaces.find(w => w.id === copyFromId)

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
        <WorkspaceIcon color="primary" />
        Create New Workspace
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Create a new workspace to organize your subtitle projects. Each workspace 
            maintains its own configuration and session state.
          </Typography>
        </Box>

        {/* Workspace Name */}
        <TextField
          autoFocus
          fullWidth
          label="Workspace Name"
          value={workspaceName}
          onChange={(e) => handleNameChange(e.target.value)}
          error={Boolean(nameError)}
          helperText={nameError || `${workspaceName.length}/${WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH} characters`}
          slotProps={{ htmlInput: { maxLength: WORKSPACE_CONSTRAINTS.MAX_WORKSPACE_NAME_LENGTH } }}
          sx={{ mb: 3 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && workspaceName.trim() && !nameError) {
              handleCreate()
            }
          }}
        />

        {/* Emoji Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Choose Icon (Optional)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {emojiOptions.map((emoji) => (
              <Chip
                key={emoji}
                label={emoji}
                onClick={() => setSelectedEmoji(selectedEmoji === emoji ? '' : emoji)}
                variant={selectedEmoji === emoji ? 'filled' : 'outlined'}
                color={selectedEmoji === emoji ? 'primary' : 'default'}
                sx={{
                  fontSize: '1.2rem',
                  width: 48,
                  height: 48,
                  '& .MuiChip-label': {
                    fontSize: '1.2rem'
                  }
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Copy From Existing Workspace */}
        {availableWorkspaces.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Copy Settings From (Optional)</InputLabel>
              <Select
                value={copyFromId}
                onChange={(e) => setCopyFromId(e.target.value)}
                label="Copy Settings From (Optional)"
              >
                <MenuItem value="">
                  <em>Start with default settings</em>
                </MenuItem>
                {availableWorkspaces.map((workspace) => (
                  <MenuItem key={workspace.id} value={workspace.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <WorkspaceAvatar workspace={workspace} size="small" />
                      <Box>
                        <Typography variant="body2">{workspace.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {workspace.isActive ? 'Active workspace' : 'Inactive'}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {copyFromWorkspace ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <CopyIcon fontSize="small" />
                    Will copy configuration and settings from &quot;{copyFromWorkspace.name}&quot;
                  </Box>
                ) : (
                  'Copy configuration, API keys, and preferences from an existing workspace'
                )}
              </FormHelperText>
            </FormControl>
          </>
        )}

        {/* Workspace Limit Warning */}
        {availableWorkspaces.length >= WORKSPACE_CONSTRAINTS.MAX_WORKSPACES - 1 && (
          <Box sx={{ 
            p: 2, 
            borderRadius: 2, 
            backgroundColor: 'rgba(255, 152, 0, 0.05)',
            border: '1px solid rgba(255, 152, 0, 0.2)',
            mt: 2
          }}>
            <Typography variant="body2" color="warning.main">
              <strong>Note:</strong> You&apos;re approaching the limit of {WORKSPACE_CONSTRAINTS.MAX_WORKSPACES} workspaces. 
              Consider deleting unused workspaces if needed.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleCreate} 
          disabled={loading || !workspaceName.trim() || Boolean(nameError)}
          variant="contained"
          startIcon={loading ? undefined : <AddIcon />}
        >
          {loading ? 'Creating...' : 'Create Workspace'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}