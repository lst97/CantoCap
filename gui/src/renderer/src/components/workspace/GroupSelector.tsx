import React from 'react'
import {
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  SelectChangeEvent
} from '@mui/material'
import { WorkspaceGroup } from '../../stores/types/StoreTypes'
import { getGroupColorRgb } from './GroupColorPicker'

interface GroupSelectorProps {
  value: string
  onChange: (value: string) => void
  groups: WorkspaceGroup[]
  disabled?: boolean
  placeholder?: string
  helperText?: string
  fullWidth?: boolean
  error?: boolean
}

/**
 * GroupSelector - Custom styled dropdown for selecting workspace groups
 * Uses the same dark theme styling as other form selectors in the app
 */
export const GroupSelector: React.FC<GroupSelectorProps> = ({
  value,
  onChange,
  groups,
  disabled = false,
  placeholder = 'Select Group',
  helperText,
  fullWidth = true,
  error = false
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
          {/* Placeholder item when no value is selected */}
          {value === '' && (
            <MenuItem value="" disabled>
              <em style={{ color: '#96989D' }}>{placeholder}</em>
            </MenuItem>
          )}
          
          {groups.length === 0 ? (
            <MenuItem value="" disabled>
              <em style={{ color: '#96989D' }}>No groups available</em>
            </MenuItem>
          ) : (
            groups.map((group) => (
              <MenuItem key={group.id} value={group.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '4px',
                      backgroundColor: getGroupColorRgb(group.color),
                      flexShrink: 0
                    }}
                  />
                  <Box sx={{ flex: 1, textAlign: 'left' }}>
                    <Typography variant="body2" sx={{ color: '#DCDDDE', fontSize: '0.8rem' }}>
                      {group.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {group.metadata.workspaceCount} workspace{group.metadata.workspaceCount !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
      {helperText && (
        <Typography 
          variant="caption" 
          color={error ? 'error.main' : 'text.secondary'}
          sx={{ 
            fontSize: '0.7rem',
            marginLeft: 0,
            marginTop: '4px',
            display: 'block',
            lineHeight: 1.4
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  )
}