import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Paper,
  Stack,
  Chip,
  SelectChangeEvent
} from '@mui/material'
import {
  Translate as TranslateIcon,
  Key as KeyIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { useConfigStepContent, useStepActions } from '../../stores/useStepStore'
import type { TranslationLanguage } from '../../stores/types/StoreTypes'

interface TranslationOption {
  value: string
  label: string
  description: string
}

export const TranslationSelector: React.FC = () => {
  const config = useConfigStepContent()
  const { updateStepContent } = useStepActions()

  const handleTranslationChange = useCallback(async (event: SelectChangeEvent<TranslationLanguage | 'none'>) => {
    const value = event.target.value as TranslationLanguage | 'none'
    const newValue: TranslationLanguage | null = value === 'none' ? null : (value as TranslationLanguage)
    
    try {
      await updateStepContent('config', { subtitle: newValue })
    } catch (err) {
      console.error('Failed to update translation configuration:', err)
    }
  }, [updateStepContent])

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

  const hasGeminiKey = Boolean(config.geminiKey)
  const isGeminiRefinementEnabled = !(config.noGeminiRefinement ?? false)
  const isTranslationAvailable = hasGeminiKey && isGeminiRefinementEnabled

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TranslateIcon color="primary" />
          Subtitle Translation (Optional)
        </Typography>
        <Chip
          icon={isTranslationAvailable ? <KeyIcon /> : <WarningIcon />}
          label={isTranslationAvailable ? "Translation Ready" : "Translation Disabled"}
          size="small"
          color={isTranslationAvailable ? "success" : "warning"}
          variant={isTranslationAvailable ? "filled" : "outlined"}
        />
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Generate dual-language subtitles with translation alongside original text. {!isTranslationAvailable && 'Requires Gemini API key and refinement to be enabled in AI Enhancement section.'}
      </Typography>
      
      <Stack spacing={2}>
        <FormControl fullWidth size="small" disabled={!isTranslationAvailable}>
          <Select
            value={getCurrentSelection()}
            onChange={handleTranslationChange}
            displayEmpty
            disabled={!isTranslationAvailable}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2F3136',
                  '& .MuiMenuItem-root': {
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: '#36393F',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(245, 158, 11, 0.3)',
                      },
                    },
                  },
                },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#2F3136',
                '& fieldset': {
                  borderColor: '#40444B',
                },
                '&:hover fieldset': {
                  borderColor: '#5865F2',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865F2',
                  boxShadow: '0 0 0 3px rgba(88, 101, 242, 0.1)',
                },
              },
              '& .MuiSelect-select': {
                backgroundColor: '#2F3136 !important',
                color: '#DCDDDE',
                padding: '16px',
                fontSize: '14px',
              },
              '& .MuiSelect-icon': {
                color: '#96989D',
              },
            }}
          >
            {translationOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        
        {config.subtitle && !Array.isArray(config.subtitle) && (
          <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              📝 Output Format Preview:
            </Typography>
            
            <Box sx={{ 
              p: 2, 
              backgroundColor: 'rgba(245, 158, 11, 0.1)', 
              borderRadius: 1,
              fontSize: '0.75rem'
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                1. 00:00:01,000 → 00:00:03,500
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                你好，歡迎收看我們的節目
              </Typography>
              <Typography variant="body2" color="success.main" sx={{ fontStyle: 'italic' }}>
                {getSelectedOption()?.description.split(' ')[0]} translation text
              </Typography>
            </Box>
          </Paper>
        )}
        
        {!isTranslationAvailable && (
          <Alert severity="warning" sx={{ backgroundColor: 'rgba(254, 231, 92, 0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {!hasGeminiKey ? "API Key Required" : "Refinement Disabled"}
            </Typography>
            <Typography variant="body2">
              {!hasGeminiKey 
                ? "To enable subtitle translation, please configure your Gemini API key in the AI Enhancement section above."
                : "To enable subtitle translation, please enable Gemini refinement in the AI Enhancement section above."
              }
            </Typography>
          </Alert>
        )}
        
        {isTranslationAvailable && !config.subtitle && (
          <Alert severity="info" sx={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Single language output
            </Typography>
            <Typography variant="body2">
              Subtitles will be generated in the original language only ({(config.charset ?? 'traditional') === 'traditional' ? 'Traditional' : 'Simplified'} Chinese)
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}