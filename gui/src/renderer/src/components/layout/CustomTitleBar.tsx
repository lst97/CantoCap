import React, { useState, useEffect } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { 
  MovieFilter as MovieIcon,
  PlayArrow as ProcessingIcon
} from '@mui/icons-material'
import { useAppStore } from '../../stores/useAppStore'
import { useCurrentWorkspace } from '../../stores/useWorkspaceStore'
import { createComponentLogger } from '../../utils/logger'

/**
 * Enhanced CustomTitleBar with dynamic title support
 * 
 * Features:
 * - Context-aware title display (workspace name, processing)
 * - Processing status indication
 * - Platform-specific styling
 */
export const CustomTitleBar: React.FC = () => {
  const [platform, setPlatform] = useState<'macos' | 'windows' | 'linux'>('windows')
  const logger = createComponentLogger('CustomTitleBar')
  // Store subscriptions
  const currentWorkspace = useCurrentWorkspace()
  const { isLoading } = useAppStore()

  useEffect(() => {
    // Simple platform detection using window.electronAPI
    const detectPlatform = async () => {
      try {
        if (window.electronAPI?.getPlatform) {
          const detectedPlatform = await window.electronAPI.getPlatform()
          setPlatform(detectedPlatform as 'macos' | 'windows' | 'linux')
        }
      } catch {
        logger.error('Platform detection failed, using default')
      }
    }
    detectPlatform()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dynamic title logic
  const getTitleContent = () => {
    if (isLoading) {
      return {
        icon: <ProcessingIcon color="warning" sx={{ fontSize: 24 }} />,
        title: 'Loading',
        subtitle: 'Initializing application...'
      }
    }
    
    // Default application title with workspace name if available
    return {
      icon: <MovieIcon color="primary" sx={{ fontSize: 24 }} />,
      title: 'CantoCap',
      subtitle: currentWorkspace?.name || 'Cantonese Caption Generator'
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
        
        {/* Loading Status Chip */}
        {isLoading && (
          <Chip
            label="Loading"
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
      </Box>
    </Box>
  )
}