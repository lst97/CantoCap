import React from 'react'
import { Avatar, Tooltip, Box } from '@mui/material'
import { WorkspaceAvatarProps } from './types'

/**
 * WorkspaceAvatar - Smart avatar component for workspace representation
 * Features: Auto-generated emoji/initial, active state indicator, consistent sizing
 */
export const WorkspaceAvatar: React.FC<WorkspaceAvatarProps> = ({
  workspace,
  size = 'medium',
  isActive = false,
  onClick,
  onContextMenu
}) => {
  const sizeMap = {
    small: { width: 40, height: 40, fontSize: '1rem' },
    medium: { width: 52, height: 52, fontSize: '1.5rem' },
    large: { width: 64, height: 64, fontSize: '2rem' }
  }

  const dimensions = sizeMap[size]

  // Generate display content: emoji > first char > fallback
  const getDisplayContent = () => {
    if (workspace.emoji) return workspace.emoji
    if (workspace.name) return workspace.name.charAt(0).toUpperCase()
    return '粵' // Fallback to CantoCap character
  }

  // Generate background color from workspace ID for consistency
  const getBackgroundColor = () => {
    if (workspace.color) return workspace.color
    
    // Generate consistent color from workspace ID
    const hash = workspace.id.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)
    
    const colors = [
      '#F59E0B', // Primary amber
      '#57F287', // Success green  
      '#FEE75C', // Warning yellow
      '#7DD3FC', // Info blue
      '#A78BFA', // Purple
      '#FB7185', // Pink
      '#34D399', // Emerald
      '#FBBF24'  // Yellow
    ]
    
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <Tooltip title={workspace.name} placement="right" arrow>
      <Box sx={{ position: 'relative' }}>
        <Avatar
          onClick={onClick}
          onContextMenu={onContextMenu}
          sx={{
            ...dimensions,
            backgroundColor: getBackgroundColor(),
            borderRadius: 2,
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            border: isActive ? 3 : 2,
            borderColor: isActive ? 'primary.main' : 'transparent',
            boxShadow: isActive 
              ? '0 0 0 2px rgba(245, 158, 11, 0.2)' 
              : 'none',
            '&:hover': {
              transform: 'scale(1.05)',
              borderColor: isActive ? 'primary.light' : 'primary.main',
              boxShadow: isActive 
                ? '0 0 0 3px rgba(245, 158, 11, 0.3)' 
                : '0 0 0 2px rgba(245, 158, 11, 0.2)',
            },
            '&:active': {
              transform: 'scale(0.98)',
            }
          }}
        >
          {getDisplayContent()}
        </Avatar>
        
        {/* Active Indicator Dot */}
        {isActive && (
          <Box
            sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 12,
              height: 12,
              backgroundColor: 'primary.main',
              borderRadius: '50%',
              border: '2px solid',
              borderColor: 'background.paper',
              boxShadow: '0 0 4px rgba(245, 158, 11, 0.4)'
            }}
          />
        )}
      </Box>
    </Tooltip>
  )
}