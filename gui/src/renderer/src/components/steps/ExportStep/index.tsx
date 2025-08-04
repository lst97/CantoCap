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
  const [showErrorNotification, setShowErrorNotification] = useState(false)
  const isMenuOpen = Boolean(menuAnchorEl)
  const exportActionsRef = useRef<ExportActionsRef>(null)
  
  // CRITICAL FIX: Circuit breaker for workspace configuration save failures
  const saveFailureCountRef = useRef<number>(0)
  const lastSaveAttemptRef = useRef<number>(0)
  const lastSavedProgressRef = useRef<string>('')
  const MAX_SAVE_FAILURES = 3
  const SAVE_COOLDOWN_MS = 5000 // 5 second cooldown after failures
  const DEBOUNCE_MS = 1000 // 1 second debounce between saves
  
  const subtitles = getSubtitleData()
  const canExport = subtitles.length > 0 && !progress.isExporting
  

  // Handle errors
  useEffect(() => {
    if (lastError || error) {
      setShowErrorNotification(true)
    }
  }, [lastError, error])

  // CRITICAL FIX: Replace infinite loop useEffect with circuit breaker pattern
  const saveExportProgress = useCallback(async (currentProgress: typeof progress) => {
    const now = Date.now()
    
    // Circuit breaker: Stop trying if too many failures
    if (saveFailureCountRef.current >= MAX_SAVE_FAILURES) {
      const timeSinceLastAttempt = now - lastSaveAttemptRef.current
      if (timeSinceLastAttempt < SAVE_COOLDOWN_MS) {
        console.log(`🚫 Export progress save blocked by circuit breaker. Failures: ${saveFailureCountRef.current}, Cooldown: ${Math.ceil((SAVE_COOLDOWN_MS - timeSinceLastAttempt) / 1000)}s remaining`)
        return
      } else {
        // Reset after cooldown
        console.log('🔄 Circuit breaker reset after cooldown')
        saveFailureCountRef.current = 0
      }
    }
    
    // Debounce rapid calls
    const timeSinceLastAttempt = now - lastSaveAttemptRef.current
    if (timeSinceLastAttempt < DEBOUNCE_MS) {
      console.log('🚫 Export progress save debounced')
      return
    }
    
    // Create stable comparison key to prevent unnecessary saves
    const progressKey = JSON.stringify({
      isExporting: currentProgress.isExporting,
      progress: currentProgress.progress,
      stage: currentProgress.stage,
      exportedFiles: currentProgress.exportedFiles?.length || 0,
      errors: currentProgress.errors?.length || 0
    })
    
    // Skip if progress hasn't actually changed
    if (progressKey === lastSavedProgressRef.current) {
      console.log('🚫 Export progress save skipped - no changes detected')
      return
    }
    
    lastSaveAttemptRef.current = now
    
    try {
      console.log('💾 Saving export progress to workspace...', {
        isExporting: currentProgress.isExporting,
        progress: currentProgress.progress,
        stage: currentProgress.stage,
        failures: saveFailureCountRef.current
      })
      
      await updateConfig({
        exportProgress: {
          isExporting: currentProgress.isExporting,
          progress: currentProgress.progress,
          stage: currentProgress.stage,
          exportedFiles: currentProgress.exportedFiles,
          errors: currentProgress.errors
        },
        lastModified: now
      })
      
      // Success: Reset failure count and update saved progress
      saveFailureCountRef.current = 0
      lastSavedProgressRef.current = progressKey
      console.log('✅ Export progress saved successfully')
      
    } catch (error) {
      saveFailureCountRef.current += 1
      console.error(`❌ Failed to save export progress (attempt ${saveFailureCountRef.current}/${MAX_SAVE_FAILURES}):`, error)
      
      if (saveFailureCountRef.current >= MAX_SAVE_FAILURES) {
        console.warn(`🚨 Circuit breaker activated after ${MAX_SAVE_FAILURES} failures. Will retry after ${SAVE_COOLDOWN_MS}ms cooldown.`)
      }
    }
  }, [updateConfig])

  // CRITICAL FIX: Use stable save function with dependency on progress content, not updateConfig
  useEffect(() => {
    if (isReady && progress) {
      saveExportProgress(progress)
    }
  }, [
    isReady, 
    // Depend on progress content, not the progress object reference
    progress?.isExporting,
    progress?.progress, 
    progress?.stage,
    progress?.exportedFiles?.length,
    progress?.errors?.length,
    saveExportProgress
  ])

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