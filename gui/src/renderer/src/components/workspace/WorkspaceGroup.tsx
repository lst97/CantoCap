import React, { useState } from 'react'
import { Box, IconButton, Typography, Collapse, Tooltip } from '@mui/material'
import { 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WorkspaceAvatar } from './WorkspaceAvatar'
import type { WorkspaceGroup, WorkspaceWithGrouping, WorkspaceGroupColor } from '../../types/workspace'

interface WorkspaceGroupProps {
  group: WorkspaceGroup
  workspaces: WorkspaceWithGrouping[]
  isActive?: boolean
  onToggleExpansion: (groupId: string) => void
  onWorkspaceClick: (workspace: WorkspaceWithGrouping) => void
  onWorkspaceContextMenu: (event: React.MouseEvent, workspace: WorkspaceWithGrouping) => void
  onGroupContextMenu?: (event: React.MouseEvent, group: WorkspaceGroup) => void
}

const GROUP_COLORS: Record<WorkspaceGroupColor, string> = {
  default: '#6366f1',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
  cyan: '#06b6d4'
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
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: group.id,
    data: {
      type: 'group',
      group
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const groupColor = GROUP_COLORS[group.color]
  const sortedWorkspaces = workspaces.sort((a, b) => a.positionInGroup - b.positionInGroup)

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
    <div
      ref={setNodeRef}
      style={{ 
        ...style, 
        width: '100%'
      }}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Group Header */}
      <div
        {...listeners}
        onClick={handleGroupClick}
        onContextMenu={handleGroupContextMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '48px',
          padding: '0 8px',
          cursor: 'pointer',
          backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
          borderRadius: '4px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
        }}
        onMouseLeave={(e) => {
          if (!isHovered) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        {/* Group Icon and Expansion Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
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
        </div>

        {/* Group Name and Count */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </Typography>
        </div>

        {/* Group Color Indicator */}
        <div
          style={{
            width: '3px',
            height: '24px',
            backgroundColor: groupColor,
            borderRadius: '1.5px',
            opacity: isActive ? 1 : 0.6
          }}
        />
      </div>

      {/* Workspaces in Group */}
      <Collapse in={group.isExpanded} timeout={200}>
        <div style={{ paddingLeft: '16px', paddingTop: '4px' }}>
          {sortedWorkspaces.map((workspace) => (
            <div key={workspace.id} style={{ marginBottom: '8px' }}>
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
            </div>
          ))}
        </div>
      </Collapse>
    </div>
  )
}