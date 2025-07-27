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
import { useAppStore } from '../../store/app-store'

interface CharsetOption {
  value: string
  label: string
  icon: string
  description: string
}

export const CharsetSelector: React.FC = () => {
  const { config, updateConfig } = useAppStore()

  const handleCharsetChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig('charset', event.target.value)
  }, [updateConfig])

  const charsets: CharsetOption[] = [
    {
      value: 'traditional',
      label: 'Traditional Chinese',
      icon: '繁',
      description: 'Traditional Chinese characters (繁體字)'
    },
    {
      value: 'simplified',
      label: 'Simplified Chinese', 
      icon: '简',
      description: 'Simplified Chinese characters (简体字)'
    }
  ]

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
        Choose the Chinese character set for your subtitles. This affects how the text appears in the final output.
      </Typography>
      
      <RadioGroup value={config.charset} onChange={handleCharsetChange}>
        <Stack spacing={2}>
          {charsets.map((charset) => (
            <Paper 
              key={charset.value}
              sx={{ 
                p: 3,
                border: 1,
                borderColor: config.charset === charset.value ? 'primary.main' : 'rgba(255, 255, 255, 0.1)',
                backgroundColor: config.charset === charset.value 
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)' 
                  : 'rgba(255, 255, 255, 0.02)',
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: config.charset === charset.value 
                    ? '0 8px 25px rgba(245, 158, 11, 0.2)'
                    : '0 4px 12px rgba(255, 255, 255, 0.1)',
                  borderColor: config.charset === charset.value ? 'primary.light' : 'rgba(245, 158, 11, 0.3)'
                }
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