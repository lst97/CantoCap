import React from 'react'
import { Box, Typography, Paper, Divider, Stack } from '@mui/material'
import { Settings as SettingsIcon, Preview as PreviewIcon } from '@mui/icons-material'
import { AdvancedPanel } from '../AdvancedPanel'
import { OutputLocationSelector } from '../OutputLocationSelector'
import { QuickOptionsSelector } from '../QuickOptionsSelector'
import { CharsetSelectorMUI } from '../CharsetSelectorMUI'
import { APIKeyInputMUI } from '../APIKeyInputMUI'
import { TranslationSelectorMUI } from '../TranslationSelectorMUI'
import { ActionPanel } from '../ActionPanel'

const ConfigPreview: React.FC = () => (
  <Paper sx={{ p: 3, height: 'fit-content' }}>
    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <PreviewIcon color="primary" />
      Configuration Summary
    </Typography>
    
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary">Language Detection:</Typography>
        <Typography variant="body2">Cantonese (Auto-detect)</Typography>
      </Box>
      
      <Divider />
      
      <Box>
        <Typography variant="subtitle2" color="text.secondary">Model Selection:</Typography>
        <Typography variant="body2">Auto (based on hardware)</Typography>
      </Box>
      
      <Divider />
      
      <Box>
        <Typography variant="subtitle2" color="text.secondary">Quality Settings:</Typography>
        <Typography variant="body2">High Quality</Typography>
      </Box>
      
      <Divider />
      
      <Box>
        <Typography variant="subtitle2" color="text.secondary">Output Format:</Typography>
        <Typography variant="body2">SRT + Traditional Chinese</Typography>
      </Box>
      
      <Divider />
      
      <Box>
        <Typography variant="subtitle2" color="text.secondary">Advanced Options:</Typography>
        <Typography variant="body2">Speaker identification: Enabled</Typography>
        <Typography variant="body2">AI refinement: Enabled</Typography>
      </Box>
    </Stack>
  </Paper>
)

export const ConfigStep: React.FC = () => {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3, height: '100%', p: 3 }}>
      {/* Main Configuration */}
      <Box>
        <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="primary" />
          Transcription Configuration
        </Typography>
        <Stack spacing={3}>
          <OutputLocationSelector />
          <Divider />
          <CharsetSelectorMUI />
          <Divider />
          <QuickOptionsSelector />
          <Divider />
          <APIKeyInputMUI />
          <Divider />
          <TranslationSelectorMUI />
          <Divider />
          <AdvancedPanel />
        </Stack>
      </Box>
      
      {/* Actions and Configuration Preview */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <ActionPanel />
        <ConfigPreview />
      </Box>
    </Box>
  )
}