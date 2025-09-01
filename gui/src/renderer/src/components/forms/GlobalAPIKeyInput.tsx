import React, { useEffect, useState, useCallback } from 'react'
import { Box, Typography, TextField, Button, IconButton, Alert, Stack, InputAdornment } from '@mui/material'
import { Key as KeyIcon, Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon, Clear as ClearIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material'
import { useAppSettingsStore } from '../../stores/useAppSettingsStore'

export const GlobalAPIKeyInput: React.FC = () => {
  const { apiKeys, actions } = useAppSettingsStore()
  const [geminiKeyValue, setGeminiKeyValue] = useState(apiKeys.gemini ?? '')
  const [hfKeyValue, setHfKeyValue] = useState(apiKeys.huggingface ?? '')
  const [showGemini, setShowGemini] = useState(false)
  const [showHF, setShowHF] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    actions.load()
  }, [actions])

  useEffect(() => {
    setGeminiKeyValue(apiKeys.gemini ?? '')
    setHfKeyValue(apiKeys.huggingface ?? '')
  }, [apiKeys.gemini, apiKeys.huggingface])

  const saveGemini = useCallback(async () => {
    try {
      await actions.updateApiKeys({ gemini: geminiKeyValue })
      setError(null)
    } catch {
      setError('Failed to save Gemini key')
    }
  }, [geminiKeyValue, actions])

  const saveHF = useCallback(async () => {
    try {
      await actions.updateApiKeys({ huggingface: hfKeyValue })
      setError(null)
    } catch {
      setError('Failed to save Hugging Face key')
    }
  }, [hfKeyValue, actions])

  const clearGemini = useCallback(async () => {
    setGeminiKeyValue('')
    await actions.updateApiKeys({ gemini: '' })
  }, [actions])

  const clearHF = useCallback(async () => {
    setHfKeyValue('')
    await actions.updateApiKeys({ huggingface: '' })
  }, [actions])

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant='h6' sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
          <KeyIcon color='primary' />
          Google Gemini API Key (Global Default)
        </Typography>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'start' }}>
            <TextField
              fullWidth
              type={showGemini ? 'text' : 'password'}
              value={geminiKeyValue}
              onChange={(e) => setGeminiKeyValue(e.target.value)}
              onBlur={saveGemini}
              placeholder='Enter your Gemini API key here...'
              size='medium'
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.02)' } }}
              InputProps={{ endAdornment: (
                <InputAdornment position='end'>
                  <IconButton onClick={() => setShowGemini(!showGemini)} size='small'>
                    {showGemini ? <VisibilityOffIcon fontSize='small'/> : <VisibilityIcon fontSize='small'/>}
                  </IconButton>
                  {geminiKeyValue && (
                    <IconButton onClick={clearGemini} size='small'>
                      <ClearIcon fontSize='small' />
                    </IconButton>
                  )}
                </InputAdornment>
              )}}/>
            <Button variant='outlined' onClick={() => window.cantocapAPI.openExternalUrl('https://makersuite.google.com/app/apikey')} startIcon={<OpenInNewIcon />}>
              Get Key
            </Button>
          </Box>
        </Stack>
      </Box>

      <Box>
        <Typography variant='h6' sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
          <KeyIcon color='warning' />
          Hugging Face API Key (Global Default)
        </Typography>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'start' }}>
            <TextField
              fullWidth
              type={showHF ? 'text' : 'password'}
              value={hfKeyValue}
              onChange={(e) => setHfKeyValue(e.target.value)}
              onBlur={saveHF}
              placeholder='Enter your Hugging Face API key here...'
              size='medium'
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.02)' } }}
              InputProps={{ endAdornment: (
                <InputAdornment position='end'>
                  <IconButton onClick={() => setShowHF(!showHF)} size='small'>
                    {showHF ? <VisibilityOffIcon fontSize='small'/> : <VisibilityIcon fontSize='small'/>}
                  </IconButton>
                  {hfKeyValue && (
                    <IconButton onClick={clearHF} size='small'>
                      <ClearIcon fontSize='small' />
                    </IconButton>
                  )}
                </InputAdornment>
              )}}/>
            <Button variant='outlined' onClick={() => window.cantocapAPI.openExternalUrl('https://huggingface.co/settings/tokens')} startIcon={<OpenInNewIcon />}>
              Get Key
            </Button>
          </Box>
        </Stack>
      </Box>

      {error && <Alert severity='error'>{error}</Alert>}
    </Stack>
  )
}
