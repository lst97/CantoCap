import React, { useState, useEffect } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { 
  MovieFilter as MovieIcon,
  Settings as SettingsIcon,
  PlayArrow as ProcessingIcon
} from '@mui/icons-material'
import { getPlatform, type Platform } from '../../services/platform'
import { useUIStore, selectDynamicTitle, selectSettingsUI } from '../../stores/ui-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useAppStore } from '../../stores/app-store'

/**
 * Enhanced CustomTitleBar with dynamic title support
 * 
 * Features:
 * - Context-aware title display (workspace name, settings, processing)
 * - Processing status indication
 * - Settings mode indication
 * - Platform-specific styling
 */
export const CustomTitleBar: React.FC = () => {
  const [platform, setPlatform] = useState<Platform>('windows')
  
  // Store subscriptions
  const dynamicTitle = useUIStore(selectDynamicTitle)
  const settingsUI = useUIStore(selectSettingsUI)
  const { currentWorkspace } = useWorkspaceStore()
  const { processing } = useAppStore()

  useEffect(() => {
    getPlatform().then(setPlatform)
  }, [])

  // Dynamic title logic
  const getTitleContent = () => {
    if (settingsUI.isSettingsMode) {
      return {
        icon: <SettingsIcon color="primary" sx={{ fontSize: 24 }} />,
        title: dynamicTitle.currentTitle, // Use preserved title instead of hardcoded 'Settings'
        subtitle: dynamicTitle.metadata?.settingsSection || 'Global Settings'
      }
    }
    
    if (processing.isActive && processing.stage !== 'idle') {
      return {
        icon: <ProcessingIcon color="warning" sx={{ fontSize: 24 }} />,
        title: 'Processing',
        subtitle: processing.message || 'Generating subtitles...'
      }
    }
    
    // Default application title (workspace name is now shown in workflow panel)
    return {
      icon: <MovieIcon color="primary" sx={{ fontSize: 24 }} />,
      title: 'CantoCap',
      subtitle: 'Cantonese Caption Generator'
    }
  }

  // Only show custom title bar on macOS (Windows/Linux now use native frame)
  if (platform !== 'macos') {
    return null
  }

  const { icon, title, subtitle } = getTitleContent()

  return (
    <Box 
      sx={{ 
        height: 40,
        backgroundColor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        px: 10, // Extra padding on macOS for native traffic lights
        userSelect: 'none',
        WebkitAppRegion: 'drag' // Enable dragging on the title bar
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        flex: 1,
        justifyContent: 'center', // Center the title on macOS
        gap: 1
      }}>
        {icon}
        
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: 'text.primary',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {title}
        </Typography>
        
        {subtitle && (
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              maxWidth: 150,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            • {subtitle}
          </Typography>
        )}
        
        {/* Processing Status Chip */}
        {processing.isActive && processing.stage !== 'idle' && (
          <Chip
            label={processing.stage}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ 
              height: 20,
              fontSize: '0.65rem',
              textTransform: 'capitalize'
            }}
          />
        )}
        
        {/* Settings Mode Chip */}
        {settingsUI.isSettingsMode && (
          <Chip
            label="Settings"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ 
              height: 20,
              fontSize: '0.65rem'
            }}
          />
        )}
      </Box>
    </Box>
  )
}