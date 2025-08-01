import React, { useEffect, useState } from 'react'
import { Box, Alert, Snackbar, LinearProgress, Typography, Chip } from '@mui/material'
import { CheckCircle, Save, Error as ErrorIcon } from '@mui/icons-material'
import { InputPanel } from '../ui/InputPanel'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { useInputFileConfig, useWorkspaceConfig } from '../../contexts/WorkspaceConfigContext'

interface InputFileConfig {
  inputFile?: string | null
  selectedRange?: {
    start: number
    end: number
  }
  mediaMetadata?: {
    duration: number
    format: string
    size: number
  }
  lastModified?: number
}

export const InputFileStep: React.FC = () => {
  const [config, updateConfig, { isLoading, error, isReady }] = useInputFileConfig()
  const { autoSaveStatus, isAutoSaving, lastError, clearError } = useWorkspaceConfig()
  const [showErrorNotification, setShowErrorNotification] = useState(false)


  // Handle errors
  useEffect(() => {
    if (lastError || error) {
      setShowErrorNotification(true)
    }
  }, [lastError, error])

  // Handle input file selection
  const handleFileSelect = async (file: string) => {
    try {
      await updateConfig({
        inputFile: file,
        lastModified: Date.now()
      })
    } catch (error) {
      console.error('Failed to save input file selection:', error)
      // Error will be handled by error notification system
    }
  }

  // Handle range selection
  const handleRangeSelect = async (start: number, end: number) => {
    try {
      await updateConfig({
        selectedRange: { start, end },
        lastModified: Date.now()
      })
    } catch (error) {
      console.error('Failed to save range selection:', error)
    }
  }

  // Handle media metadata updates
  const handleMetadataUpdate = async (metadata: any) => {
    try {
      await updateConfig({
        mediaMetadata: metadata,
        lastModified: Date.now()
      })
    } catch (error) {
      console.error('Failed to save media metadata:', error)
    }
  }

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
          Loading workspace configuration...
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ 
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Configuration Loading State */}
        {isLoading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Loading input file configuration...
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

        {/* File Upload, Media Preview & Range Selection */}
        <ErrorBoundary 
          fallbackTitle="File Upload Error" 
          fallbackMessage="An error occurred while processing your video file. This might be due to a corrupted file, unsupported format, or insufficient system resources. Please try again with a different file or use the 'Browse Files' button instead of drag and drop."
        >
          <InputPanel 
            // Pass workspace-aware configuration
            initialFile={config?.inputFile || null}
            initialRange={config?.selectedRange}
            onFileSelect={handleFileSelect}
            onRangeSelect={handleRangeSelect}
            onMetadataUpdate={handleMetadataUpdate}
          />
        </ErrorBoundary>
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
          {lastError?.message || error?.message || 'Failed to save configuration'}
        </Alert>
      </Snackbar>
    </>
  )
}