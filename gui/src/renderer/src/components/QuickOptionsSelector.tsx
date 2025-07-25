import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Paper,
  Grid,
  Stack
} from '@mui/material'
import {
  Bolt as BoltIcon,
  People as PeopleIcon,
  Edit as EditIcon,
  MusicNote as MusicIcon
} from '@mui/icons-material'
import { useAppStore } from '../store/app-store'

interface QuickOption {
  key: string
  label: string
  icon: React.ReactNode
  description: string
  enabled: boolean
}

export const QuickOptionsSelector: React.FC = () => {
  const { config, updateConfig } = useAppStore()

  const handleOptionChange = useCallback((key: string) => {
    updateConfig(key, !config[key as keyof typeof config])
  }, [config, updateConfig])

  const options: QuickOption[] = [
    {
      key: 'speakers',
      label: 'Speaker Identification',
      icon: <PeopleIcon />,
      description: 'Identify and label different speakers in the audio',
      enabled: config.speakers
    },
    {
      key: 'written',
      label: 'Written Style Conversion',
      icon: <EditIcon />,
      description: 'Convert colloquial speech to formal written style',
      enabled: config.written
    },
    {
      key: 'music',
      label: 'Music Detection',
      icon: <MusicIcon />,
      description: 'Detect and label music segments in the audio',
      enabled: config.music
    }
  ]

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BoltIcon color="primary" />
        Quick Options
      </Typography>
      
      <Grid container spacing={2}>
        {options.map((option) => (
          <Grid item xs={12} md={6} key={option.key}>
            <Paper 
              sx={{ 
                p: 2, 
                backgroundColor: option.enabled ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: 1,
                borderColor: option.enabled ? 'primary.main' : 'divider',
                transition: 'all 0.2s'
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={option.enabled}
                    onChange={() => handleOptionChange(option.key)}
                    color="primary"
                  />
                }
                label={
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {option.icon}
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {option.label}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                      {option.description}
                    </Typography>
                  </Stack>
                }
                sx={{ 
                  width: '100%', 
                  m: 0,
                  alignItems: 'flex-start',
                  '& .MuiFormControlLabel-label': {
                    flex: 1
                  }
                }}
              />
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}