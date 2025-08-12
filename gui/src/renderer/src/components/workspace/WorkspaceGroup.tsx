import React, { useState } from 'react'
import { Box, IconButton, Typography, Collapse } from '@mui/material'
import { 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material'
import { WorkspaceAvatar } from './WorkspaceAvatar'
import type { WorkspaceGroup as WorkspaceGroupType, WorkspaceWithGrouping, WorkspaceGroupColor } from '../../stores/types/StoreTypes'

interface WorkspaceGroupProps {
  group: WorkspaceGroupType
  workspaces: WorkspaceWithGrouping[]
  isActive?: boolean
  onToggleExpansion: (groupId: string) => void
  onWorkspaceClick: (workspace: WorkspaceWithGrouping) => void
  onWorkspaceContextMenu: (event: React.MouseEvent<HTMLElement>, workspace: WorkspaceWithGrouping) => void
  onGroupContextMenu?: (event: React.MouseEvent, group: WorkspaceGroupType) => void
}

const GROUP_COLORS: Record<WorkspaceGroupColor, string> = {
  default: '#6366f1',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1'
}

export const WorkspaceGroup: React.FC<WorkspaceGroupProps> = ({
  group,
  workspaces,
  isActive = false,
  onToggleExpansion,
  onWorkspaceClick,
  onWorkspaceContextMenu,
  onGroupContextMenu
}) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const groupColor = GROUP_COLORS[group.color]
  const sortedWorkspaces = workspaces.sort((a, b) => (a.position || 0) - (b.position || 0))

  const handleGroupClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    onToggleExpansion(group.id)
  }

  const handleGroupContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onGroupContextMenu?.(event, group)
  }

  return (
    <Box
      sx={{ width: '100%' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Group Header */}
      <Box
        onClick={handleGroupClick}
        onContextMenu={handleGroupContextMenu}
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: 48,
          px: 1,
          cursor: 'pointer',
          backgroundColor: isHovered ? 'action.hover' : 'transparent',
          borderRadius: 1,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }}
      >
        {/* Group Icon and Expansion Toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
          <IconButton
            size="small"
            sx={{ 
              color: groupColor,
              width: 24,
              height: 24,
              p: 0
            }}
          >
            {group.isExpanded ? (
              <FolderOpenIcon fontSize="small" />
            ) : (
              <FolderIcon fontSize="small" />
            )}
          </IconButton>
          
          <IconButton
            size="small"
            sx={{ 
              color: 'text.secondary',
              width: 16,
              height: 16,
              p: 0,
              ml: 0.5
            }}
          >
            {group.isExpanded ? (
              <ExpandLessIcon fontSize="inherit" />
            ) : (
              <ExpandMoreIcon fontSize="inherit" />
            )}
          </IconButton>
        </Box>

        {/* Group Name and Count */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {group.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.6rem',
              display: 'block'
            }}
          >
            {group.metadata.workspaceCount} workspace{group.metadata.workspaceCount !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Group Color Indicator */}
        <Box
          sx={{
            width: 3,
            height: 24,
            backgroundColor: groupColor,
            borderRadius: 0.75,
            opacity: isActive ? 1 : 0.6
          }}
        />
      </Box>

      {/* Workspaces in Group */}
      <Collapse in={group.isExpanded} timeout={200}>
        <Box sx={{ pl: 2, pt: 0.5 }}>
          {sortedWorkspaces.map((workspace) => (
            <Box key={workspace.id} sx={{ mb: 1 }}>
              <WorkspaceAvatar
                workspace={workspace}
                size="small"
                isActive={workspace.isActive}
                onClick={() => onWorkspaceClick(workspace)}
                onContextMenu={(event) => onWorkspaceContextMenu(event, workspace)}
                sx={{
                  width: 40,
                  height: 40
                }}
              />
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}