import React from 'react'
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Divider
} from '@mui/material'
import {
  Close as CloseIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { ModelSettings } from './ModelSettings'
import { ProcessingOptions } from './ProcessingOptions'
import { AdvancedSettings } from './AdvancedSettings'
import { SystemStatus } from './SystemStatus'
import { useAppStore } from '../store/app-store'

export const AdvancedPanel = () => {
  const { toggleAdvanced } = useAppStore()

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 3
      }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          🔧 Advanced Options
        </Typography>
        <IconButton
          onClick={toggleAdvanced}
          size="small"
          sx={{ 
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      
      <Stack spacing={3} sx={{ width: '100%' }}>
        <Box sx={{ width: '100%' }}>
          <ModelSettings />
        </Box>
        
        <Divider sx={{ borderColor: 'divider' }} />
        
        <Box sx={{ width: '100%' }}>
          <ProcessingOptions />
        </Box>
        
        <Divider sx={{ borderColor: 'divider' }} />
        
        <Box sx={{ width: '100%' }}>
          <AdvancedSettings />
        </Box>
        
        <Divider sx={{ borderColor: 'divider' }} />
        
        <Box sx={{ width: '100%' }}>
          <SystemStatus />
        </Box>
      </Stack>
    </Box>
  )
}