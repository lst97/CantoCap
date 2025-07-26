import React, { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { MovieFilter as MovieIcon } from '@mui/icons-material'
import { getPlatform, type Platform } from '../../services/platform'

// Removed custom Mac controls - using native Electron traffic light buttons

// Removed custom Windows controls - using native Electron window controls

export const CustomTitleBar: React.FC = () => {
  const [platform, setPlatform] = useState<Platform>('windows')

  useEffect(() => {
    getPlatform().then(setPlatform)
  }, [])

  // Only show custom title bar on macOS (Windows/Linux now use native frame)
  if (platform !== 'macos') {
    return null
  }

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
        justifyContent: 'center' // Center the title on macOS
      }}>
        <MovieIcon color="primary" sx={{ fontSize: 24, mr: 1.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          CantoCap
        </Typography>
        <Typography variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
          Cantonese Subtitle Generator
        </Typography>
      </Box>
    </Box>
  )
}