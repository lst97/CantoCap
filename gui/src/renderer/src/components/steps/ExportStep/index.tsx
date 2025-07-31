import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Box, Typography, Stack, IconButton, Tooltip, Menu, MenuItem, Alert, Snackbar, LinearProgress, Chip } from '@mui/material'
import { Download as DownloadIcon, MoreVert as MoreVertIcon, CheckCircle, Save, Error as ErrorIcon } from '@mui/icons-material'

import { useExportStore } from '../../../stores/export-store'
import { useExportStepConfig, useWorkspaceConfig } from '../../../contexts/WorkspaceConfigContext'
import { ConfigSection } from './ConfigSection'
import { FormatSelector } from './FormatSelector'
import { LanguageOptions } from './LanguageOptions'
import { ExportActions, ExportActionsRef } from './ExportActions'
import { ExportPreview } from './ExportPreview'
import { ExportHistory } from './ExportHistory'

export const ExportStep: React.FC = () => {
  const { generatePreview, getSubtitleData, progress } = useExportStore()
  const [config, updateConfig, { isLoading, error, isReady }] = useExportStepConfig()
  const { autoSaveStatus, isAutoSaving, lastError, clearError } = useWorkspaceConfig()
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [showAutoSaveNotification, setShowAutoSaveNotification] = useState(false)
  const [showErrorNotification, setShowErrorNotification] = useState(false)
  const isMenuOpen = Boolean(menuAnchorEl)
  const exportActionsRef = useRef<ExportActionsRef>(null)
  
  const subtitles = getSubtitleData()
  const canExport = subtitles.length > 0 && !progress.isExporting
  
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

  // Save export progress and history to workspace
  useEffect(() => {
    if (isReady && progress) {
      updateConfig({
        exportProgress: {
          isExporting: progress.isExporting,
          progress: progress.progress,
          stage: progress.stage,
          exportedFiles: progress.exportedFiles,
          errors: progress.errors
        },
        lastModified: Date.now()
      }).catch(error => {
        console.error('Failed to save export progress:', error)
      })
    }
  }, [progress, updateConfig, isReady])

  // Generate initial preview on mount
  useEffect(() => {
    generatePreview()
  }, [generatePreview])

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
          Loading export configuration...
        </Typography>
      </Box>
    )
  }
  
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget)
  }, [])
  
  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null)
  }, [])
  
  const handleMultiFormatMenuClick = useCallback(() => {
    exportActionsRef.current?.openMultiFormatDialog()
    handleMenuClose()
  }, [handleMenuClose])
  
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
                icon={<CheckCircle />}
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
              Loading export configuration...
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
            <DownloadIcon color="primary" />
            Export Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure your export settings and preview the output
          </Typography>
        </Box>
        
        <Stack spacing={3}>
          <ConfigSection 
            title="Export Format" 
            icon={<Box sx={{ fontSize: '1.25rem' }}>📄</Box>}
            important={true}
          >
            <FormatSelector />
          </ConfigSection>
          
          <ConfigSection 
            title="Language Options" 
            icon={<Box sx={{ fontSize: '1.25rem' }}>🌐</Box>}
          >
            <LanguageOptions />
          </ConfigSection>
          
          <ConfigSection 
            title="Export Actions" 
            icon={<Box sx={{ fontSize: '1.25rem' }}>⚡</Box>}
            important={true}
            action={
              <Tooltip title="More options">
                <IconButton
                  onClick={handleMenuOpen}
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
            }
          >
            <ExportActions ref={exportActionsRef} />
          </ConfigSection>
        </Stack>
        
        {/* Bottom padding for better scrolling */}
        <Box sx={{ height: 24 }} />
      </Box>
      
      {/* Preview and History Panel - Scrollable */}
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
        <ExportPreview />
        <ExportHistory />
      </Box>
      
      {/* Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleMultiFormatMenuClick} disabled={!canExport}>
          Export Multiple Formats
        </MenuItem>
      </Menu>
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
        Export configuration saved automatically
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
        {lastError?.message || error?.message || 'Failed to save export configuration'}
      </Alert>
    </Snackbar>
  </>
  )
}