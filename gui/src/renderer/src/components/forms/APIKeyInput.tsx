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
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showHfToken, setShowHfToken] = useState(false)
  const [geminiKeyValidation, setGeminiKeyValidation] = useState<KeyValidation | null>(null)
  const [hfTokenValidation, setHfTokenValidation] = useState<KeyValidation | null>(null)

  const handleGeminiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateConfig('geminiKey', value)
    
    if (value) {
      if (value.length < 20) {
        setGeminiKeyValidation({ valid: false, message: 'API key seems too short' })
      } else if (!value.startsWith('AI')) {
        setGeminiKeyValidation({ valid: false, message: 'Gemini API keys typically start with "AI"' })
      } else {
        setGeminiKeyValidation({ valid: true, message: 'API key format looks valid' })
      }
    } else {
      setGeminiKeyValidation(null)
    }
  }, [updateConfig])

  const handleHfTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateConfig('hfToken', value)
    
    if (value) {
      if (value.length < 30) {
        setHfTokenValidation({ valid: false, message: 'HuggingFace token seems too short' })
      } else if (!value.startsWith('hf_')) {
        setHfTokenValidation({ valid: false, message: 'HuggingFace tokens typically start with "hf_"' })
      } else {
        setHfTokenValidation({ valid: true, message: 'Token format looks valid' })
      }
    } else {
      setHfTokenValidation({ valid: false, message: 'HuggingFace token is required for Whisper model downloads' })
    }
  }, [updateConfig])

  const handleToggleRefinement = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked
    updateConfig('noGeminiRefinement', !enabled)
    
    // If disabling Gemini refinement, also disable AI-dependent features
    if (!enabled) {
      // Reset subtitle translation since it depends on Gemini
      if (config.subtitle && typeof config.subtitle === 'string') {
        updateConfig('subtitle', null)
      }
    }
  }, [config.noGeminiRefinement, config.subtitle, updateConfig])

  const toggleShowGeminiKey = useCallback(() => {
    setShowGeminiKey(!showGeminiKey)
  }, [showGeminiKey])

  const toggleShowHfToken = useCallback(() => {
    setShowHfToken(!showHfToken)
  }, [showHfToken])

  const clearGeminiKey = useCallback(() => {
    updateConfig('geminiKey', '')
    setGeminiKeyValidation(null)
  }, [updateConfig])

  const clearHfToken = useCallback(() => {
    updateConfig('hfToken', '')
    setHfTokenValidation({ valid: false, message: 'HuggingFace token is required for Whisper model downloads' })
  }, [updateConfig])

  const openGeminiDocs = useCallback(async () => {
    await window.cantocapAPI.openExternalUrl('https://makersuite.google.com/app/apikey')
  }, [])

  const openHuggingFaceDocs = useCallback(async () => {
    await window.cantocapAPI.openExternalUrl('https://huggingface.co/settings/tokens')
  }, [])

  return (
    <Stack spacing={4}>
      {/* HuggingFace Token - Required */}
      <Box>
        <Typography variant="h6" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
          <KeyIcon color="error" />
          HuggingFace Token (Required)
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
          Required for downloading Whisper models from HuggingFace. Without this token, model downloads will fail.
        </Typography>
        
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'start' }}>
            <TextField
              fullWidth
              type={showHfToken ? 'text' : 'password'}
              value={config.hfToken}
              onChange={handleHfTokenChange}
              placeholder="Enter your HuggingFace token here..."
              size="medium"
              error={hfTokenValidation?.valid === false}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.03)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  },
                  '&.Mui-focused': {
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderColor: 'error.main',
                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
                  },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={toggleShowHfToken} size="small">
                      {showHfToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                    {config.hfToken && (
                      <IconButton onClick={clearHfToken} size="small">
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    )}
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="outlined"
              onClick={openHuggingFaceDocs}
              startIcon={<OpenInNewIcon />}
              sx={{ 
                borderRadius: 2,
                px: 3,
                py: 1.75,
                fontSize: '0.875rem',
                fontWeight: 600,
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: 'error.main',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: 'error.main',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Get Token
            </Button>
          </Box>
          
          {hfTokenValidation && (
            <Alert 
              severity={hfTokenValidation.valid ? 'success' : 'error'}
              sx={{ 
                backgroundColor: hfTokenValidation.valid 
                  ? 'rgba(87, 242, 135, 0.1)' 
                  : 'rgba(239, 68, 68, 0.1)'
              }}
            >
              {hfTokenValidation.message}
            </Alert>
          )}
          
          {!config.hfToken && (
            <Alert severity="error" sx={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Token Required
              </Typography>
              <Typography variant="body2">
                HuggingFace token is mandatory for Whisper model downloads. 
                The application cannot function without this token.
              </Typography>
            </Alert>
          )}
        </Stack>
      </Box>

      {/* Google Gemini API Key - Optional */}
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
              type={showGeminiKey ? 'text' : 'password'}
              value={config.geminiKey}
              onChange={handleGeminiKeyChange}
              placeholder="Enter your Gemini API key here..."
              size="medium"
              error={geminiKeyValidation?.valid === false}
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
                    <IconButton onClick={toggleShowGeminiKey} size="small">
                      {showGeminiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                    {config.geminiKey && (
                      <IconButton onClick={clearGeminiKey} size="small">
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
          
          {geminiKeyValidation && (
            <Alert 
              severity={geminiKeyValidation.valid ? 'success' : 'warning'}
              sx={{ 
                backgroundColor: geminiKeyValidation.valid 
                  ? 'rgba(87, 242, 135, 0.1)' 
                  : 'rgba(255, 152, 0, 0.1)'
              }}
            >
              {geminiKeyValidation.message}
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
    </Stack>
  )
}