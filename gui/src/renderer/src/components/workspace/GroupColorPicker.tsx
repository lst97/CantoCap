import React from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'
import type { WorkspaceGroupColor } from '../../stores/types/StoreTypes'

interface GroupColorPickerProps {
  selectedColor: WorkspaceGroupColor
  onColorSelect: (color: WorkspaceGroupColor) => void
  size?: 'small' | 'medium' | 'large'
}

const GROUP_COLORS = [
  { id: 'default' as WorkspaceGroupColor, name: 'Default', hex: '#4A5568', rgb: 'rgb(74, 85, 104)' },
  { id: 'blue' as WorkspaceGroupColor, name: 'Blue', hex: '#2B6CB0', rgb: 'rgb(43, 108, 176)' },
  { id: 'green' as WorkspaceGroupColor, name: 'Green', hex: '#047857', rgb: 'rgb(4, 120, 87)' },
  { id: 'yellow' as WorkspaceGroupColor, name: 'Yellow', hex: '#B45309', rgb: 'rgb(180, 83, 9)' },
  { id: 'red' as WorkspaceGroupColor, name: 'Red', hex: '#B91C1C', rgb: 'rgb(185, 28, 28)' },
  { id: 'purple' as WorkspaceGroupColor, name: 'Purple', hex: '#7C3AED', rgb: 'rgb(124, 58, 237)' },
  { id: 'pink' as WorkspaceGroupColor, name: 'Pink', hex: '#BE185D', rgb: 'rgb(190, 24, 93)' },
  { id: 'indigo' as WorkspaceGroupColor, name: 'Indigo', hex: '#4338CA', rgb: 'rgb(67, 56, 202)' }
] as const

const SIZE_CONFIG = {
  small: { size: 24, gap: 1 },
  medium: { size: 32, gap: 1.5 },
  large: { size: 40, gap: 2 }
}

/**
 * GroupColorPicker - Color selection component for workspace groups
 * Features: 8 predefined colors, visual selection feedback, accessibility
 */
export const GroupColorPicker: React.FC<GroupColorPickerProps> = ({
  selectedColor,
  onColorSelect,
  size = 'medium'
}) => {
  const sizeConfig = SIZE_CONFIG[size]

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500, color: 'text.primary' }}>
        Group Color
      </Typography>
      
      <Box 
        sx={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: sizeConfig.gap,
          justifyContent: 'flex-start'
        }}
      >
        {GROUP_COLORS.map((color) => {
          const isSelected = selectedColor === color.id
          
          return (
            <Tooltip key={color.id} title={color.name} placement="top">
              <Box
                onClick={() => onColorSelect(color.id)}
                sx={{
                  width: sizeConfig.size,
                  height: sizeConfig.size,
                  backgroundColor: color.rgb,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease-in-out',
                  border: isSelected 
                    ? '3px solid rgba(255, 255, 255, 0.9)' 
                    : '2px solid transparent',
                  boxShadow: isSelected 
                    ? '0 0 0 2px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.15)' 
                    : '0 2px 4px rgba(0, 0, 0, 0.1)',
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                  '&:hover': {
                    transform: 'scale(1.15)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    border: '2px solid rgba(255, 255, 255, 0.8)'
                  },
                  '&:active': {
                    transform: 'scale(1.05)'
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Select ${color.name} color for group`}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onColorSelect(color.id)
                  }
                }}
              >
                {isSelected && (
                  <CheckIcon 
                    sx={{ 
                      color: 'white',
                      fontSize: size === 'small' ? '14px' : size === 'large' ? '22px' : '18px',
                      filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
                    }} 
                  />
                )}
              </Box>
            </Tooltip>
          )
        })}
      </Box>
      
      <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary', display: 'block' }}>
        Choose a color to help identify your group visually
      </Typography>
    </Box>
  )
}

// Export color utilities for use in other components
export const getGroupColorHex = (color: WorkspaceGroupColor): string => {
  return GROUP_COLORS.find(c => c.id === color)?.hex || GROUP_COLORS[0].hex
}

export const getGroupColorRgb = (color: WorkspaceGroupColor): string => {
  return GROUP_COLORS.find(c => c.id === color)?.rgb || GROUP_COLORS[0].rgb
}

export { GROUP_COLORS }