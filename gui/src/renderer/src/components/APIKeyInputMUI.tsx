import React, { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControlLabel,
  Switch,
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
import { useAppStore } from '../store/app-store'

interface KeyValidation {
  valid: boolean
  message: string
}

export const APIKeyInputMUI: React.FC = () => {
  const { config, updateConfig } = useAppStore()
  const [showKey, setShowKey] = useState(false)
  const [keyValidation, setKeyValidation] = useState<KeyValidation | null>(null)

  const handleKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateConfig('geminiKey', value)
    
    // Basic validation
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

  const handleToggleRefinement = useCallback(() => {
    updateConfig('noGeminiRefinement', !config.noGeminiRefinement)
  }, [config.noGeminiRefinement, updateConfig])

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
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <KeyIcon color="primary" />
        Google Gemini API Key (Optional)
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enables AI-powered transcription refinement for better accuracy
      </Typography>
      
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            type={showKey ? 'text' : 'password'}
            value={config.geminiKey}
            onChange={handleKeyChange}
            placeholder="Enter your Gemini API key here..."
            size="small"
            error={keyValidation?.valid === false}
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
            sx={{ minWidth: 'auto', px: 2 }}
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
        
        <FormControlLabel
          control={
            <Switch
              checked={!config.noGeminiRefinement}
              onChange={handleToggleRefinement}
              disabled={!config.geminiKey}
            />
          }
          label="Enable Gemini refinement (improves transcription accuracy)"
        />
        
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