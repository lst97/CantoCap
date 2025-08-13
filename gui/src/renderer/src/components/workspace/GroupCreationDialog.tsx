import React, { useState, useCallback } from 'react'
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
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Checkbox,
  Alert,
  Divider,
  FormHelperText
} from '@mui/material'
import { 
  Folder as GroupIcon,
  Add as AddIcon,
  Check as CheckIcon
} from '@mui/icons-material'
import { GroupColorPicker, getGroupColorRgb } from './GroupColorPicker'
import type { WorkspaceGroupColor, WorkspaceWithGrouping } from '../../stores/types/StoreTypes'

interface GroupCreationDialogProps {
  open: boolean
  onClose: () => void
  onCreateGroup: (
    name: string, 
    color: WorkspaceGroupColor, 
    workspaceIds: string[]
  ) => Promise<string>
  currentWorkspace?: WorkspaceWithGrouping
  availableWorkspaces?: WorkspaceWithGrouping[]
  autoAddCurrentWorkspace?: boolean
}

interface ValidationError {
  field: 'name' | 'workspaces'
  message: string
}

/**
 * GroupCreationDialog - Enhanced group creation with color picker and workspace selection
 * Features: Name validation, color selection, multi-workspace assignment, preview
 */
export const GroupCreationDialog: React.FC<GroupCreationDialogProps> = ({
  open,
  onClose,
  onCreateGroup,
  currentWorkspace,
  availableWorkspaces = [],
  autoAddCurrentWorkspace = true
}) => {
  const [groupName, setGroupName] = useState('')
  const [selectedColor, setSelectedColor] = useState<WorkspaceGroupColor>('default')
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)


  const [errors, setErrors] = useState<ValidationError[]>([])

  // Auto-select current workspace when dialog opens
  React.useEffect(() => {
    if (open && autoAddCurrentWorkspace && currentWorkspace) {
      setSelectedWorkspaces(new Set([currentWorkspace.id]))
    }
  }, [open, autoAddCurrentWorkspace, currentWorkspace])

  // Filter workspaces that aren't already in groups (optional - show all for flexibility)
  const availableForGrouping = availableWorkspaces.filter(workspace => 
    !workspace.group || workspace.id === currentWorkspace?.id
  )

  const handleClose = useCallback(() => {
    setGroupName('')
    setSelectedColor('default')
    setSelectedWorkspaces(new Set())
    setLoading(false)
    setErrors([])
    onClose()
  }, [onClose])

  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationError[] = []

    // Validate group name
    if (!groupName.trim()) {
      newErrors.push({ field: 'name', message: 'Group name is required' })
    } else if (groupName.trim().length < 2) {
      newErrors.push({ field: 'name', message: 'Group name must be at least 2 characters' })
    } else if (groupName.trim().length > 25) {
      newErrors.push({ field: 'name', message: 'Group name must be 25 characters or less' })
    }

    // Validate workspace selection
    if (selectedWorkspaces.size === 0) {
      newErrors.push({ field: 'workspaces', message: 'At least one workspace must be selected' })
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }, [groupName, selectedWorkspaces])

  const handleCreateGroup = useCallback(async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const workspaceIds = Array.from(selectedWorkspaces)
      await onCreateGroup(groupName.trim(), selectedColor, workspaceIds)
      handleClose()
    } catch (error) {
      console.error('Failed to create group:', error)
      setLoading(false)
      setErrors([{ field: 'name', message: 'Failed to create group. Please try again.' }])
    }
  }, [groupName, selectedColor, selectedWorkspaces, onCreateGroup, validateForm, handleClose])

  const handleWorkspaceToggle = useCallback((workspaceId: string) => {
    setSelectedWorkspaces(prev => {
      const newSet = new Set(prev)
      if (newSet.has(workspaceId)) {
        newSet.delete(workspaceId)
      } else {
        newSet.add(workspaceId)
      }
      return newSet
    })
    // Clear workspace validation errors when user makes changes
    setErrors(prev => prev.filter(e => e.field !== 'workspaces'))
  }, [])

  const getFieldError = useCallback((field: string) => 
    errors.find(error => error.field === field)?.message
  , [errors])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: 500
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ backgroundColor: getGroupColorRgb(selectedColor), color: 'white' }}>
            <GroupIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" component="div">
              Create New Group
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organize your workspaces into groups for better management
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        {/* Group Name Input */}
        <Box sx={{ mb: 3 }}>
          <TextField
            autoFocus
            fullWidth
            label="Group Name"
            value={groupName}
            onChange={(e) => {
              setGroupName(e.target.value)
              // Clear name validation errors when user types
              setErrors(prev => prev.filter(e => e.field !== 'name'))
            }}
            error={!!getFieldError('name')}
            helperText={getFieldError('name') || `${groupName.length}/25 characters`}
            inputProps={{ maxLength: 25 }}
            sx={{ mb: 2 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleCreateGroup()
              }
            }}
          />
        </Box>

        {/* Color Picker */}
        <GroupColorPicker
          selectedColor={selectedColor}
          onColorSelect={setSelectedColor}
          size="medium"
        />

        <Divider sx={{ my: 2 }} />

        {/* Workspace Selection */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500, color: 'text.primary' }}>
            Add Workspaces to Group
          </Typography>

          {getFieldError('workspaces') && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {getFieldError('workspaces')}
            </Alert>
          )}

          {/* Selected count indicator */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<CheckIcon />}
              label={`${selectedWorkspaces.size} workspace${selectedWorkspaces.size !== 1 ? 's' : ''} selected`}
              color={selectedWorkspaces.size > 0 ? 'primary' : 'default'}
              size="small"
              variant={selectedWorkspaces.size > 0 ? 'filled' : 'outlined'}
            />
          </Box>

          {/* Workspace List */}
          <List sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 2 }}>
            {availableForGrouping.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No workspaces available"
                  secondary="All workspaces are already in groups"
                  sx={{ textAlign: 'center' }}
                />
              </ListItem>
            ) : (
              availableForGrouping.map((workspace) => {
                const isSelected = selectedWorkspaces.has(workspace.id)
                const isCurrentWorkspace = workspace.id === currentWorkspace?.id
                
                return (
                  <ListItem key={workspace.id} disablePadding>
                    <ListItemButton
                      onClick={() => handleWorkspaceToggle(workspace.id)}
                      dense
                      sx={{ borderRadius: 1 }}
                    >
                      <Checkbox
                        edge="start"
                        checked={isSelected}
                        onChange={() => handleWorkspaceToggle(workspace.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                      
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            backgroundColor: workspace.backgroundColor || 'primary.main',
                            fontSize: '0.875rem'
                          }}
                        >
                          {workspace.emoji || workspace.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">
                              {workspace.name}
                            </Typography>
                            {isCurrentWorkspace && (
                              <Chip 
                                label="Current" 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.6rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          workspace.group 
                            ? `Currently in: ${workspace.group.name}`
                            : 'Not in any group'
                        }
                        secondaryTypographyProps={{
                          variant: 'caption',
                          sx: { fontSize: '0.7rem' }
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })
            )}
          </List>

          <FormHelperText sx={{ mt: 1 }}>
            Selected workspaces will be moved to this new group
          </FormHelperText>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreateGroup}
          disabled={loading || !groupName.trim() || selectedWorkspaces.size === 0}
          variant="contained"
          startIcon={loading ? undefined : <AddIcon />}
          sx={{ minWidth: 120 }}
        >
          {loading ? 'Creating...' : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}