import React from 'react'
import {
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  SelectChangeEvent
} from '@mui/material'
import { WorkspaceWithGrouping } from '../../stores/types/StoreTypes'
import { WorkspaceAvatar } from './WorkspaceAvatar'

interface WorkspaceSelectorProps {
  value: string
  onChange: (value: string) => void
  workspaces: WorkspaceWithGrouping[]
  disabled?: boolean
  placeholder?: string
  helperText?: React.ReactNode
  fullWidth?: boolean
  error?: boolean
  includeEmpty?: boolean
  emptyLabel?: string
}

/**
 * WorkspaceSelector - Custom styled dropdown for selecting workspaces
 * Uses the same dark theme styling as other form selectors in the app
 */
export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  value,
  onChange,
  workspaces,
  disabled = false,
  placeholder = 'Select Workspace',
  helperText,
  fullWidth = true,
  error = false,
  includeEmpty = true,
  emptyLabel = 'Start with default settings'
}) => {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value)
  }

  return (
    <Box sx={{ width: fullWidth ? '100%' : 'auto' }}>
      <FormControl fullWidth={fullWidth} size="small" disabled={disabled}>
        <Select
          value={value}
          onChange={handleChange}
          displayEmpty
          disabled={disabled}
          error={error}
          MenuProps={{
            PaperProps: {
              sx: {
                backgroundColor: '#2F3136',
                '& .MuiMenuItem-root': {
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: '#36393F',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    '&:hover': {
                      backgroundColor: 'rgba(245, 158, 11, 0.3)',
                    },
                  },
                },
              },
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#2F3136',
              '& fieldset': {
                borderColor: error ? 'error.main' : '#40444B',
              },
              '&:hover fieldset': {
                borderColor: error ? 'error.main' : 'rgba(245, 158, 11, 0.4)',
              },
              '&.Mui-focused fieldset': {
                borderColor: error ? 'error.main' : 'primary.main',
                boxShadow: error ? '0 0 0 3px rgba(244, 67, 54, 0.1)' : '0 0 0 3px rgba(245, 158, 11, 0.1)',
              },
            },
            '& .MuiSelect-select': {
              backgroundColor: '#2F3136 !important',
              color: '#DCDDDE',
              padding: '12px 14px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              minHeight: 'auto',
            },
            '& .MuiSelect-icon': {
              color: '#96989D',
            },
          }}
        >
          {/* Show placeholder when no value is selected and includeEmpty is not used */}
          {value === '' && !includeEmpty && (
            <MenuItem value="" disabled>
              <em style={{ color: '#96989D', fontSize: '0.8rem' }}>{placeholder}</em>
            </MenuItem>
          )}
          
          {includeEmpty && (
            <MenuItem value="">
              <em style={{ color: '#96989D', fontSize: '0.8rem' }}>{emptyLabel}</em>
            </MenuItem>
          )}
          {workspaces.map((workspace) => (
            <MenuItem key={workspace.id} value={workspace.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                <WorkspaceAvatar workspace={workspace} size="small" />
                <Box sx={{ flex: 1, textAlign: 'left' }}>
                  <Typography variant="body2" sx={{ color: '#DCDDDE', fontSize: '0.8rem' }}>
                    {workspace.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {workspace.isActive ? 'Active workspace' : 'Inactive'}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {helperText && (
        <Box
          sx={{ 
            fontSize: '0.7rem',
            marginLeft: 0,
            marginTop: '4px',
            display: 'block',
            lineHeight: 1.4,
            color: error ? 'error.main' : 'text.secondary'
          }}
        >
          {helperText}
        </Box>
      )}
    </Box>
  )
}