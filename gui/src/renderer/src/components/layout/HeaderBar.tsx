import React from 'react'
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Chip, 
  Avatar 
} from '@mui/material'
import { 
  MovieFilter as MovieIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Pending as PendingIcon
} from '@mui/icons-material'
import { useAppStore } from '../../store/app-store'

export const HeaderBar: React.FC = () => {
  const { appVersion, dependencies } = useAppStore()

  const systemStatus = () => {
    const pythonOk = dependencies.python.available
    const ffmpegOk = dependencies.ffmpeg.available
    
    if (pythonOk && ffmpegOk) {
      return { 
        status: 'ready', 
        color: 'success' as const, 
        text: 'System Ready',
        icon: <CheckIcon fontSize="small" />
      }
    }
    if (!pythonOk || !ffmpegOk) {
      return { 
        status: 'missing', 
        color: 'error' as const, 
        text: 'Dependencies Missing',
        icon: <ErrorIcon fontSize="small" />
      }
    }
    return { 
      status: 'checking', 
      color: 'warning' as const, 
      text: 'Checking System...',
      icon: <PendingIcon fontSize="small" />
    }
  }

  const status = systemStatus()

  return (
    <AppBar 
      position="static" 
      elevation={1}
      sx={{ 
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
        {/* Left: App Logo & Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main',
              width: 40,
              height: 40
            }}
          >
            <MovieIcon />
          </Avatar>
          <Box>
            <Typography 
              variant="h5" 
              component="h1" 
              sx={{ 
                fontWeight: 600,
                color: 'text.primary',
                lineHeight: 1.2
              }}
            >
              CantoCap
            </Typography>
            <Typography
              variant="body2"
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.75rem',
                lineHeight: 1
              }}
            >
              Cantonese Caption Generator
            </Typography>
          </Box>
        </Box>

        {/* Center: System Status */}
        <Box sx={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
          <Chip
            icon={status.icon}
            label={status.text}
            color={status.color}
            variant="outlined"
            size="medium"
            sx={{
              fontWeight: 500,
              '& .MuiChip-icon': {
                fontSize: '1rem'
              }
            }}
          />
        </Box>

        {/* Right: Version */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Chip
            label={`v${appVersion || '1.0.0'}`}
            size="small"
            variant="outlined"
            sx={{
              backgroundColor: 'grey.50',
              borderColor: 'grey.300',
              fontSize: '0.75rem'
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  )
}