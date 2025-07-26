import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Paper,
  Stack
} from '@mui/material'
import {
  Translate as TranslateIcon
} from '@mui/icons-material'
import { useAppStore } from '../../store/app-store'

interface TranslationOption {
  value: string
  label: string
  description: string
}

export const TranslationSelectorMUI: React.FC = () => {
  const { config, updateConfig } = useAppStore()

  const handleTranslationChange = useCallback((event: any) => {
    const value = event.target.value
    updateConfig('subtitle', value === 'none' ? null : value)
  }, [updateConfig])

  const translationOptions: TranslationOption[] = [
    { value: 'none', label: 'No Translation', description: 'Output in original language only' },
    { value: 'en_us', label: 'English (US)', description: 'American English translation' },
    { value: 'en_gb', label: 'English (UK)', description: 'British English translation' },
    { value: 'ja_jp', label: '日本語 (Japanese)', description: 'Japanese translation' },
    { value: 'ko_kr', label: '한국어 (Korean)', description: 'Korean translation' },
    { value: 'es_es', label: 'Español (Spanish)', description: 'Spanish translation' },
    { value: 'fr_fr', label: 'Français (French)', description: 'French translation' },
    { value: 'de_de', label: 'Deutsch (German)', description: 'German translation' },
    { value: 'it_it', label: 'Italiano (Italian)', description: 'Italian translation' },
    { value: 'pt_br', label: 'Português (Portuguese)', description: 'Portuguese translation' },
    { value: 'ru_ru', label: 'Русский (Russian)', description: 'Russian translation' }
  ]

  const getCurrentSelection = () => {
    return config.subtitle || 'none'
  }

  const getSelectedOption = () => {
    return translationOptions.find(option => option.value === getCurrentSelection())
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TranslateIcon color="primary" />
        Subtitle Translation (Optional)
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Generate dual-language subtitles with translation alongside original text
      </Typography>
      
      <Stack spacing={2}>
        <FormControl fullWidth size="small">
          <Select
            value={getCurrentSelection()}
            onChange={handleTranslationChange}
            displayEmpty
          >
            {translationOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {config.subtitle && (
          <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              📝 Output Format Preview:
            </Typography>
            
            <Stack spacing={1}>
              <Box sx={{ 
                p: 1, 
                backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                borderRadius: 1,
                fontSize: '0.75rem'
              }}>
                <Typography variant="caption" color="text.secondary">
                  1. 00:00:01,000 → 00:00:03,500
                </Typography>
                <Typography variant="body2">
                  你好，歡迎收看我們的節目
                </Typography>
              </Box>
              
              <Box sx={{ 
                p: 1, 
                backgroundColor: 'rgba(87, 242, 135, 0.1)', 
                borderRadius: 1,
                fontSize: '0.75rem'
              }}>
                <Typography variant="caption" color="text.secondary">
                  2. 00:00:01,000 → 00:00:03,500
                </Typography>
                <Typography variant="body2">
                  {getSelectedOption()?.description.split(' ')[0]} translation text
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}
        
        {!config.subtitle && (
          <Alert severity="info" sx={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Single language output
            </Typography>
            <Typography variant="body2">
              Subtitles will be generated in the original language only ({config.charset === 'traditional' ? 'Traditional' : 'Simplified'} Chinese)
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}