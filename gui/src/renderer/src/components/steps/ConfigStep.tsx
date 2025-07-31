import React, { useEffect, useState } from 'react'
import { Box, Typography, Stack, LinearProgress, Fade, Alert, Snackbar, Chip } from '@mui/material'
import { Settings as SettingsIcon, Preview as PreviewIcon, CheckCircle as CheckIcon, Save, Error as ErrorIcon } from '@mui/icons-material'
import { AdvancedPanel } from '../ui/AdvancedPanel'
import { OutputLocationSelector } from '../forms/OutputLocationSelector'
import { QuickOptionsSelector } from '../forms/QuickOptionsSelector'
import { CharsetSelector } from '../forms/CharsetSelector'
import { APIKeyInput } from '../forms/APIKeyInput'
import { TranslationSelector } from '../forms/TranslationSelector'
import { ActionPanel } from '../ui/ActionPanel'
import { BaseCard } from '../elements'
import { useAppStore } from '../../stores/app-store'
import { useConfigStepConfig, useWorkspaceConfig } from '../../contexts/WorkspaceConfigContext'

const ConfigPreview: React.FC = () => {
  const { config } = useAppStore()
  
  const getCompletionPercentage = () => {
    let completed = 0
    const total = 6
    
    if (config.outputFile || config.inputFile) completed++
    if (config.charset) completed++
    if (config.language) completed++
    if (config.model) completed++
    if (config.subtitle) completed++
    if (config.geminiKey || config.speakers || config.written || config.music) completed++
    
    return Math.round((completed / total) * 100)
  }
  
  const completion = getCompletionPercentage()
  
  return (
    <BaseCard 
      variant="subtle" 
      sx={{ p: 3, height: 'fit-content' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <PreviewIcon color="primary" />
          Configuration Summary
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">{completion}%</Typography>
          {completion === 100 && <CheckIcon color="success" fontSize="small" />}
        </Box>
      </Box>
      
      <LinearProgress 
        variant="determinate" 
        value={completion} 
        sx={{ 
          mb: 3, 
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            background: completion === 100 
              ? 'linear-gradient(90deg, #57F287 0%, #22C55E 100%)'
              : 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)'
          }
        }} 
      />
      
      <Stack spacing={3}>
        <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>📁 Output</Typography>
          <Typography variant="body2" color="text.secondary">
            {config.outputFile ? config.outputFile.split(/[\\/]/).pop() : 'Auto-generated'}
          </Typography>
        </Box>
        
        <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>🌐 Language & Format</Typography>
          <Typography variant="body2">
            {config.charset === 'traditional' ? '繁體中文' : '简体中文'} • {
              Array.isArray(config.subtitle) 
                ? `Imported (${config.subtitle.length} subtitles)` 
                : config.subtitle?.toUpperCase() || 'SRT'
            }
          </Typography>
        </Box>
        
        <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>⚙️ Processing</Typography>
          <Typography variant="body2">
            {config.model || 'Auto-select'} • {config.language === 'zh' ? 'Chinese' : config.language?.toUpperCase() || 'Auto-detect'}
          </Typography>
        </Box>
        
        {(config.speakers || config.music || config.geminiKey) && (
          <Fade in={true}>
            <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(87, 242, 135, 0.05)', border: '1px solid rgba(87, 242, 135, 0.1)' }}>
              <Typography variant="subtitle2" color="success.main" sx={{ mb: 1, fontWeight: 600 }}>✨ Enhanced Features</Typography>
              <Stack spacing={0.5}>
                {config.speakers && <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>• Speaker identification</Typography>}
                {config.music && <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>• Music detection</Typography>}
                {config.geminiKey && <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>• AI refinement (Gemini)</Typography>}
                {config.geminiKey && config.written && <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>• Enhanced written style conversion</Typography>}
              </Stack>
            </Box>
          </Fade>
        )}
      </Stack>
    </BaseCard>
  )
}

const ConfigSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; important?: boolean }> = ({ 
  title, 
  icon, 
  children, 
  important = false 
}) => {
  return (
    <BaseCard 
      variant={important ? 'important' : 'default'} 
      interactive
      sx={{ p: 3 }}
    >
      <Typography variant="h6" sx={{ 
        mb: 3, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        fontWeight: 600,
        color: important ? 'primary.main' : 'text.primary'
      }}>
        {icon}
        {title}
      </Typography>
      {children}
    </BaseCard>
  )
}

export const ConfigStep: React.FC = () => {
  const [config, updateConfig, { isLoading, error, isReady }] = useConfigStepConfig()
  const { autoSaveStatus, isAutoSaving, lastError, clearError } = useWorkspaceConfig()
  const [showAutoSaveNotification, setShowAutoSaveNotification] = useState(false)
  const [showErrorNotification, setShowErrorNotification] = useState(false)

  // Handle auto-save status changes
  useEffect(() => {
    if (autoSaveStatus.lastSaveTime && !isAutoSaving) {
      setShowAutoSaveNotification(true)
    }
  }, [autoSaveStatus.lastSaveTime, isAutoSaving])

  // Handle errors
  useEffect(() => {
    if (lastError || error) {
      setShowErrorNotification(true)
    }
  }, [lastError, error])

  // Show loading state while workspace is initializing
  if (!isReady) {
    return (
      <Box sx={{ 
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <LinearProgress sx={{ width: '100%', maxWidth: 400, mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Loading configuration settings...
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ 
        display: 'flex',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Main Configuration - Scrollable */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          pr: 2
        }}>
          {/* Auto-save Status Indicator */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mb: 2,
            minHeight: 32
          }}>
            {isAutoSaving && (
              <Chip
                icon={<Save />}
                label="Auto-saving..."
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {autoSaveStatus.lastSaveTime && !isAutoSaving && (
              <Chip
                icon={<CheckIcon />}
                label="Saved"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {(lastError || error) && (
              <Chip
                icon={<ErrorIcon />}
                label="Save error"
                size="small"
                color="error"
                variant="outlined"
              />
            )}
          </Box>

          {/* Configuration Loading State */}
          {isLoading && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Loading configuration settings...
            </Alert>
          )}

          {/* Configuration Error State */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={() => clearError()}
            >
              Failed to load configuration: {error.message}
            </Alert>
          )}

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ 
              mb: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              fontWeight: 700
            }}>
              <SettingsIcon color="primary" />
              Transcription Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure your subtitle generation settings for optimal results
            </Typography>
          </Box>
        
        <Stack spacing={3}>
          <ConfigSection 
            title="Output Settings" 
            icon={<Box sx={{ fontSize: '1.25rem' }}>📁</Box>}
            important={true}
          >
            <OutputLocationSelector />
          </ConfigSection>
          
          <ConfigSection 
            title="Language & Format" 
            icon={<Box sx={{ fontSize: '1.25rem' }}>🌐</Box>}
          >
            <Stack spacing={3}>
              <CharsetSelector />
              <TranslationSelector />
            </Stack>
          </ConfigSection>
          
          <ConfigSection 
            title="Processing Options" 
            icon={<Box sx={{ fontSize: '1.25rem' }}>⚙️</Box>}
          >
            <QuickOptionsSelector />
          </ConfigSection>
          
          <ConfigSection 
            title="AI Enhancement" 
            icon={<Box sx={{ fontSize: '1.25rem' }}>✨</Box>}
            important={true}
          >
            <APIKeyInput />
          </ConfigSection>
          
          <AdvancedPanel />
        </Stack>
        
        {/* Bottom padding for better scrolling */}
        <Box sx={{ height: 24 }} />
      </Box>
      
      {/* Actions and Configuration Preview - Scrollable */}
      <Box sx={{ 
        width: 450,
        minWidth: 450,
        maxWidth: 450,
        height: '100%',
        display: 'flex', 
        flexDirection: 'column', 
        gap: 3,
        p: 4,
        pl: 3,
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        overflow: 'auto'
      }}>
        <ActionPanel />
        <ConfigPreview />
      </Box>
    </Box>

    {/* Auto-save Success Notification */}
    <Snackbar
      open={showAutoSaveNotification}
      autoHideDuration={3000}
      onClose={() => setShowAutoSaveNotification(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={() => setShowAutoSaveNotification(false)} 
        severity="success"
        variant="filled"
      >
        Configuration saved automatically
      </Alert>
    </Snackbar>

    {/* Error Notification */}
    <Snackbar
      open={showErrorNotification}
      autoHideDuration={6000}
      onClose={() => {
        setShowErrorNotification(false)
        clearError()
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={() => {
          setShowErrorNotification(false)
          clearError()
        }} 
        severity="error"
        variant="filled"
      >
        {lastError?.message || error?.message || 'Failed to save configuration'}
      </Alert>
    </Snackbar>
  </>
  )
}