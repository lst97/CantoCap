import React, { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControlLabel,
  Checkbox,
  Alert,
  Stack,
  InputAdornment
} from '@mui/material'
import {
  Key as KeyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Clear as ClearIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material'
import { useAppStore } from '../../store/app-store'

interface KeyValidation {
  valid: boolean
  message: string
}

export const APIKeyInput: React.FC = () => {
  const { config, updateConfig } = useAppStore()
  const [showKey, setShowKey] = useState(false)
  const [keyValidation, setKeyValidation] = useState<KeyValidation | null>(null)

  const handleKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateConfig('geminiKey', value)
    
    if (value) {
      if (value.length < 20) {
        setKeyValidation({ valid: false, message: 'API key seems too short' })
      } else if (!value.startsWith('AI')) {
        setKeyValidation({ valid: false, message: 'Gemini API keys typically start with "AI"' })
      } else {
        setKeyValidation({ valid: true, message: 'API key format looks valid' })
      }
    } else {
      setKeyValidation(null)
    }
  }, [updateConfig])

  const handleToggleRefinement = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked
    updateConfig('noGeminiRefinement', !enabled)
    
    // If disabling Gemini refinement, also disable AI-dependent features
    if (!enabled) {
      // Reset subtitle translation since it depends on Gemini
      if (config.subtitle) {
        updateConfig('subtitle', null)
      }
    }
  }, [config.noGeminiRefinement, config.subtitle, updateConfig])

  const toggleShowKey = useCallback(() => {
    setShowKey(!showKey)
  }, [showKey])

  const clearKey = useCallback(() => {
    updateConfig('geminiKey', '')
    setKeyValidation(null)
  }, [updateConfig])

  const openGeminiDocs = useCallback(async () => {
    await window.cantocapAPI.openExternalUrl('https://makersuite.google.com/app/apikey')
  }, [])

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
        <KeyIcon color="primary" />
        Google Gemini API Key (Optional)
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
        Enables AI-powered transcription refinement for enhanced accuracy and better quality subtitles
      </Typography>
      
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'start' }}>
          <TextField
            fullWidth
            type={showKey ? 'text' : 'password'}
            value={config.geminiKey}
            onChange={handleKeyChange}
            placeholder="Enter your Gemini API key here..."
            size="medium"
            error={keyValidation?.valid === false}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(245, 158, 11, 0.03)',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                },
                '&.Mui-focused': {
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderColor: 'primary.main',
                  boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.1)',
                },
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={toggleShowKey} size="small">
                    {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                  {config.geminiKey && (
                    <IconButton onClick={clearKey} size="small">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="outlined"
            onClick={openGeminiDocs}
            startIcon={<OpenInNewIcon />}
            sx={{ 
              borderRadius: 2,
              px: 3,
              py: 1.75,
              fontSize: '0.875rem',
              fontWeight: 600,
              borderColor: 'rgba(245, 158, 11, 0.3)',
              color: 'primary.main',
              minWidth: 'auto',
              whiteSpace: 'nowrap',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            Get Key
          </Button>
        </Box>
        
        {keyValidation && (
          <Alert 
            severity={keyValidation.valid ? 'success' : 'warning'}
            sx={{ 
              backgroundColor: keyValidation.valid 
                ? 'rgba(87, 242, 135, 0.1)' 
                : 'rgba(255, 152, 0, 0.1)'
            }}
          >
            {keyValidation.message}
          </Alert>
        )}
        
{config.geminiKey && (
          <FormControlLabel
            control={
              <Checkbox
                checked={!config.noGeminiRefinement}
                onChange={handleToggleRefinement}
                color="primary"
                sx={{
                  '&.Mui-checked': {
                    color: 'primary.main',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(245, 158, 11, 0.04)',
                  },
                }}
              />
            }
            label="Enable Gemini refinement (improves transcription accuracy)"
            sx={{
              mt: 1,
              '& .MuiFormControlLabel-label': {
                color: 'text.primary',
                fontSize: '0.875rem',
                fontWeight: 500,
              }
            }}
          />
        )}
        
        {!config.geminiKey && (
          <Alert severity="info" sx={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              No API key provided
            </Typography>
            <Typography variant="body2">
              CantoCap will work without an API key, but transcription accuracy may be lower.
              Get a free API key to enable AI-powered refinement.
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}