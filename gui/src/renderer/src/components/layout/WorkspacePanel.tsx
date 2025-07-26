import React from 'react'
import { Box, IconButton, Avatar, Tooltip } from '@mui/material'
import { Add as AddIcon, Settings as SettingsIcon } from '@mui/icons-material'

interface WorkspacePanelProps {
  onCreateWorkspace?: () => void
  onSettings?: () => void
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  onCreateWorkspace = () => console.log('Create workspace'),
  onSettings = () => console.log('Open settings')
}) => {
  return (
    <Box 
      sx={{ 
        width: 80,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        gap: 2,
        borderRight: 1,
        borderColor: 'divider'
      }}
    >
      {/* Create New Workspace - Large Plus Button */}
      <Tooltip title="Create New Workspace" placement="right">
        <IconButton
          onClick={onCreateWorkspace}
          sx={{
            width: 56,
            height: 56,
            backgroundColor: 'primary.main',
            borderRadius: 2,
            color: 'white',
            '&:hover': { 
              backgroundColor: 'primary.dark', 
              transform: 'scale(1.05)',
              boxShadow: 4
            },
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: 2
          }}
        >
          <AddIcon sx={{ fontSize: 32 }} />
        </IconButton>
      </Tooltip>
      
      {/* Current Workspace */}
      <Tooltip title="CantoCap Workspace" placement="right">
        <Avatar 
          sx={{
            width: 52,
            height: 52,
            backgroundColor: 'primary.main',
            borderRadius: 2,
            fontSize: '1.5rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            border: 2,
            borderColor: 'primary.main',
            '&:hover': {
              transform: 'scale(1.05)',
              borderColor: 'primary.light',
              boxShadow: 2
            }
          }}
        >
          粵
        </Avatar>
      </Tooltip>

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />
      
      {/* Settings at Bottom */}
      <Tooltip title="Settings" placement="right">
        <IconButton
          onClick={onSettings}
          sx={{
            width: 40,
            height: 40,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': { 
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              transform: 'scale(1.05)'
            },
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}