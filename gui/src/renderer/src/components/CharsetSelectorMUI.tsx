import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Stack
} from '@mui/material'
import {
  Language as LanguageIcon
} from '@mui/icons-material'
import { useAppStore } from '../store/app-store'

interface CharsetOption {
  value: string
  label: string
  icon: string
  description: string
  example: string
}

export const CharsetSelectorMUI: React.FC = () => {
  const { config, updateConfig } = useAppStore()

  const handleCharsetChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig('charset', event.target.value)
  }, [updateConfig])

  const charsets: CharsetOption[] = [
    {
      value: 'traditional',
      label: 'Traditional Chinese',
      icon: '繁',
      description: 'Traditional Chinese characters (繁體字)',
      example: '繁體中文字幕'
    },
    {
      value: 'simplified',
      label: 'Simplified Chinese', 
      icon: '简',
      description: 'Simplified Chinese characters (简体字)',
      example: '简体中文字幕'
    }
  ]

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LanguageIcon color="primary" />
        Character Set
      </Typography>
      
      <RadioGroup value={config.charset} onChange={handleCharsetChange}>
        <Stack spacing={2}>
          {charsets.map((charset) => (
            <Paper 
              key={charset.value}
              sx={{ 
                p: 2,
                border: 1,
                borderColor: config.charset === charset.value ? 'primary.main' : 'divider',
                backgroundColor: config.charset === charset.value ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                transition: 'all 0.2s'
              }}
            >
              <FormControlLabel
                value={charset.value}
                control={<Radio />}
                label={
                  <Box sx={{ ml: 1, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Typography variant="h4" sx={{ fontSize: '2rem', fontWeight: 'bold' }}>
                        {charset.icon}
                      </Typography>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {charset.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {charset.description}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary">
                        Example:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {charset.example}
                      </Typography>
                    </Box>
                  </Box>
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
          ))}
        </Stack>
      </RadioGroup>
    </Box>
  )
}