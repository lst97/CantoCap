import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Card,
  CardContent,
  Switch,
  Alert
} from '@mui/material'
import {
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Work as WorkspaceIcon,
  Folder as GroupIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material'
import { WorkspaceCreationDialogProps, WORKSPACE_CONSTRAINTS } from './types'
import { WORKSPACE_COLORS, getRandomWorkspaceColor, type WorkspaceColor } from '../../utils/workspaceColors'
import { GroupColorPicker } from './GroupColorPicker'
import { WorkspaceGroupColor } from '../../stores/types/StoreTypes'
import { GroupSelector } from './GroupSelector'
import { WorkspaceSelector } from './WorkspaceSelector'

/**
 * WorkspaceCreationDialog - Dialog for creating new workspaces
 * Features: Name validation, copy from existing workspace, emoji selection
 */
export const WorkspaceCreationDialog: React.FC<WorkspaceCreationDialogProps> = ({
  open,
  onClose,
  onCreateWorkspace,
  availableWorkspaces,
  availableGroups = []}) => {
  const [workspaceName, setWorkspaceName] = useState('')
  const [copyFromId, setCopyFromId] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('')
  const [selectedColor, setSelectedColor] = useState<WorkspaceColor | ''>('')
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  // Group-related state
  const [enableGrouping, setEnableGrouping] = useState(false)
  const [groupAction, setGroupAction] = useState<'existing' | 'new'>('existing')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState<WorkspaceGroupColor>('default')
  const [groupError, setGroupError] = useState('')

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

  const validateGroup = (): string => {
    if (!enableGrouping) return ''
    
    if (groupAction === 'existing') {
      if (!selectedGroupId) {
        return 'Please select a group or choose to create a new one'
      }
    } else if (groupAction === 'new') {
      if (!newGroupName.trim()) {
        return 'Group name is required'
      }
      if (newGroupName.trim().length < 2) {
        return 'Group name must be at least 2 characters'
      }
      if (newGroupName.trim().length > 25) {
        return 'Group name must be 25 characters or less'
      }
      if (availableGroups.some(g => g.name.toLowerCase() === newGroupName.toLowerCase())) {
        return 'A group with this name already exists'
      }
    }
    return ''
  }

  const handleNameChange = (name: string) => {
    setWorkspaceName(name)
    setNameError(validateName(name))
  }

  const handleCreate = async () => {
    const nameError = validateName(workspaceName)
    if (nameError) {
      setNameError(nameError)
      return
    }

    const groupValidationError = validateGroup()
    if (groupValidationError) {
      setGroupError(groupValidationError)
      return
    }

    if (availableWorkspaces.length >= WORKSPACE_CONSTRAINTS.MAX_WORKSPACES) {
      setNameError(`Maximum ${WORKSPACE_CONSTRAINTS.MAX_WORKSPACES} workspaces allowed`)
      return
    }

    setLoading(true)
    try {
      // Use random color if none selected
      const backgroundColor = selectedColor || getRandomWorkspaceColor()
      
      // Prepare group information if grouping is enabled
      const groupInfo = enableGrouping ? {
        action: groupAction,
        groupId: groupAction === 'existing' ? selectedGroupId : undefined,
        newGroupName: groupAction === 'new' ? newGroupName.trim() : undefined,
        newGroupColor: groupAction === 'new' ? newGroupColor : undefined
      } : undefined

      // Create the workspace with group information
      await onCreateWorkspace(
        workspaceName.trim(), 
        copyFromId || undefined, 
        backgroundColor, 
        selectedEmoji || undefined,
        groupInfo
      )
      
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
    setSelectedColor('')
    setNameError('')
    setLoading(false)
    
    // Reset group-related state
    setEnableGrouping(false)
    setGroupAction('existing')
    setSelectedGroupId('')
    setNewGroupName('')
    setNewGroupColor('default')
    setGroupError('')
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

        {/* Color Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Choose Color (Optional - Random if not selected)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {WORKSPACE_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => setSelectedColor(selectedColor === color ? '' : color)}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: color,
                  cursor: 'pointer',
                  border: selectedColor === color ? '3px solid white' : '2px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: selectedColor === color 
                    ? `0 0 0 2px ${color}, 0 4px 12px rgba(0, 0, 0, 0.3)` 
                    : '0 2px 4px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    boxShadow: `0 0 0 2px ${color}, 0 4px 12px rgba(0, 0, 0, 0.3)`
                  }
                }}
              />
            ))}
          </Box>
          {!selectedColor && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              A random color will be assigned if none is selected
            </Typography>
          )}
        </Box>

        {/* Group Management Section */}
        <Card sx={{ mb: 3, bgcolor: 'background.default' }}>
          <CardContent sx={{ 
            pb: enableGrouping ? '16px !important' : '12px !important',
            pt: '12px !important'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: enableGrouping ? 2 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <GroupIcon color="action" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Group Assignment
                </Typography>
              </Box>
              <Switch
                checked={enableGrouping}
                onChange={(e) => {
                  setEnableGrouping(e.target.checked)
                  setGroupError('')
                }}
                size="small"
                sx={{
                  width: 42,
                  height: 24,
                  padding: 0,
                  '& .MuiSwitch-switchBase': {
                    padding: 0,
                    margin: '2px',
                    transitionDuration: '300ms',
                    '&.Mui-checked': {
                      transform: 'translateX(18px)',
                      color: '#fff',
                      '& + .MuiSwitch-track': {
                        backgroundColor: 'primary.main',
                        opacity: 1,
                        border: 0,
                      },
                    },
                  },
                  '& .MuiSwitch-thumb': {
                    boxSizing: 'border-box',
                    width: 20,
                    height: 20,
                  },
                  '& .MuiSwitch-track': {
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    opacity: 1,
                    transition: 'background-color 300ms ease',
                  },
                }}
              />
            </Box>

            {enableGrouping && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add this workspace to a group for better organization
                </Typography>

                {groupError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {groupError}
                  </Alert>
                )}

                {/* Group Action Selection */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label="Join Existing"
                    onClick={() => setGroupAction('existing')}
                    variant={groupAction === 'existing' ? 'filled' : 'outlined'}
                    color={groupAction === 'existing' ? 'primary' : 'default'}
                    icon={<FolderOpenIcon />}
                    size="small"
                    sx={{ 
                      height: 28,
                      '& .MuiChip-label': {
                        fontSize: '0.75rem',
                        px: 1
                      },
                      '& .MuiChip-icon': {
                        fontSize: '0.875rem'
                      }
                    }}
                  />
                  <Chip
                    label="Create New"
                    onClick={() => setGroupAction('new')}
                    variant={groupAction === 'new' ? 'filled' : 'outlined'}
                    color={groupAction === 'new' ? 'primary' : 'default'}
                    icon={<AddIcon />}
                    size="small"
                    sx={{ 
                      height: 28,
                      '& .MuiChip-label': {
                        fontSize: '0.75rem',
                        px: 1
                      },
                      '& .MuiChip-icon': {
                        fontSize: '0.875rem'
                      }
                    }}
                  />
                </Box>

                {/* Existing Group Selection */}
                {groupAction === 'existing' && (
                  <GroupSelector
                    value={selectedGroupId}
                    onChange={(value) => {
                      setSelectedGroupId(value)
                      setGroupError('')
                    }}
                    groups={availableGroups}
                    disabled={availableGroups.length === 0}
                    placeholder="Select Group"
                    helperText={
                      availableGroups.length === 0 
                        ? 'No groups exist yet. Create a new group instead.' 
                        : 'Choose an existing group to add this workspace to'
                    }
                    error={Boolean(groupError && groupAction === 'existing')}
                  />
                )}

                {/* New Group Creation */}
                {groupAction === 'new' && (
                  <Box>
                    <TextField
                      fullWidth
                      label="New Group Name"
                      value={newGroupName}
                      onChange={(e) => {
                        setNewGroupName(e.target.value)
                        setGroupError('')
                      }}
                      error={Boolean(groupError)}
                      helperText={groupError || `${newGroupName.length}/25 characters`}
                      inputProps={{ maxLength: 25 }}
                      sx={{ mb: 2 }}
                    />
                    
                    <GroupColorPicker
                      selectedColor={newGroupColor}
                      onColorSelect={setNewGroupColor}
                      size="small"
                    />
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Copy From Existing Workspace */}
        {availableWorkspaces.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
                Copy Settings From (Optional)
              </Typography>
              <WorkspaceSelector
                value={copyFromId}
                onChange={setCopyFromId}
                workspaces={availableWorkspaces}
                placeholder="Copy Settings From (Optional)"
                helperText={
                  copyFromWorkspace ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CopyIcon fontSize="small" />
                      Will copy configuration and settings from &quot;{copyFromWorkspace.name}&quot;
                    </Box>
                  ) : (
                    'Copy configuration, API keys, and preferences from an existing workspace'
                  )
                }
                includeEmpty={true}
                emptyLabel="Start with default settings"
              />
            </Box>
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