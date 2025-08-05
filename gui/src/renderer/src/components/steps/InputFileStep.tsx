import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Box, Alert, Snackbar, LinearProgress, Typography } from '@mui/material'
import { InputPanel } from '../ui/InputPanel'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { useInputFileConfig, useWorkspaceConfig } from '../../contexts/WorkspaceConfigContext'
import { useAppStore } from '../../stores/app-store'
import { triggerUserInteraction } from '../../services/bridge/workflow-config-bridge'
import { VideoMetadata } from '../../types/workspace'

export const InputFileStep: React.FC = () => {
  const [config, updateConfig, { isLoading, error, isReady }] = useInputFileConfig()
  const { lastError, clearError } = useWorkspaceConfig()
  const [showErrorNotification, setShowErrorNotification] = useState(false)
  
  // CRITICAL DEBUG: Log workspace vs app store config mismatch
  const { config: appConfig, updateConfig: updateAppConfig } = useAppStore()
  
  // Debounced logging to prevent excessive debug output
  const debugLogRef = useRef<{ lastLog: number; lastHash: string }>({ lastLog: 0, lastHash: '' })
  
  // React 19 Optimization: Memoize debug data to prevent unnecessary re-renders
  const debugData = useMemo(() => ({
    workspaceConfig: {
      selectedFile: config?.selectedFile,
      hasConfig: !!config,
      isReady,
      isLoading
    },
    appStoreConfig: {
      inputFile: appConfig.inputFile,
      hasInputFile: !!appConfig.inputFile
    },
    mismatch: {
      workspaceVsAppStore: config?.selectedFile !== appConfig.inputFile,
      workspaceFile: config?.selectedFile,
      appStoreFile: appConfig.inputFile
    }
  }), [config, isReady, isLoading, appConfig.inputFile]);
  
  useEffect(() => {
    // Throttle debug logging to prevent render cascade spam
    const now = Date.now()
    const dataHash = JSON.stringify(debugData)
    const shouldLog = process.env.NODE_ENV === 'development' && 
      (now - debugLogRef.current.lastLog > 1000 || debugLogRef.current.lastHash !== dataHash)
    
    if (shouldLog) {
      console.log('🔧 [VIDEO DEBUG] InputFileStep: Config state comparison:', {
        timestamp: new Date().toISOString(),
        ...debugData
      })
      debugLogRef.current = { lastLog: now, lastHash: dataHash }
    }
  }, [debugData]);


  // Handle errors
  useEffect(() => {
    if (lastError || error) {
      setShowErrorNotification(true)
    }
  }, [lastError, error])

  // Debounced update to prevent rapid successive changes
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<{ workspace: string | undefined; appStore: string | undefined }>({
    workspace: undefined,
    appStore: undefined
  })
  
  // React 19 Optimization: Memoize file selection handler with debouncing
  const handleFileSelect = useCallback(async (file: string) => {
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    const logOnce = process.env.NODE_ENV === 'development'
    if (logOnce) {
      console.log('🔧 [VIDEO DEBUG] InputFileStep: handleFileSelect called:', {
        timestamp: new Date().toISOString(),
        file,
        currentConfigBefore: config?.selectedFile,
        currentAppConfigBefore: appConfig.inputFile
      })
    }
    
    // Enhanced duplicate detection with last update tracking
    const workspaceChanged = config?.selectedFile !== file && lastUpdateRef.current.workspace !== file
    const appStoreChanged = appConfig.inputFile !== file && lastUpdateRef.current.appStore !== file
    
    if (!workspaceChanged && !appStoreChanged) {
      if (logOnce) {
        console.log('🔧 [PERFORMANCE] InputFileStep: Skipping duplicate update - values already match')
      }
      return
    }
    
    // Debounced update to prevent race conditions
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        // Update tracking before making changes
        lastUpdateRef.current = { workspace: file, appStore: file }
        
        // Batch updates to prevent cascading re-renders
        const updates: Promise<void>[] = []
        
        if (workspaceChanged) {
          if (logOnce) console.log('🔧 [VIDEO DEBUG] InputFileStep: Updating workspace config')
          
          triggerUserInteraction('file-selection', 'inputFile', file)
          updates.push(updateConfig({
            selectedFile: file,
            lastModified: Date.now()
          }))
        }
        
        if (appStoreChanged) {
          if (logOnce) console.log('🔧 [VIDEO DEBUG] InputFileStep: Updating app store for UI sync')
          updateAppConfig('inputFile', file)
        }
        
        // Wait for all updates to complete
        await Promise.all(updates)
        
        if (logOnce) {
          console.log('✅ [VIDEO DEBUG] InputFileStep: Config updates completed (batched)')
        }
      } catch (error) {
        console.error('❌ [VIDEO DEBUG] InputFileStep: Failed to save input file selection:', error)
        // Reset tracking on error
        lastUpdateRef.current = { workspace: undefined, appStore: undefined }
      }
    }, 50) // 50ms debounce
  }, [config?.selectedFile, appConfig.inputFile, updateConfig, updateAppConfig]);

  // React 19 Optimization: Memoize JSON file selection handler with batched updates
  const handleJsonFileSelect = useCallback(async (file: string | null) => {
    // Skip if no actual change
    if (config?.importedJsonFile === file) {
      return
    }
    
    const logOnce = process.env.NODE_ENV === 'development'
    if (logOnce) {
      console.log('🔧 [PERFORMANCE] InputFileStep: handleJsonFileSelect called (batched):', {
        timestamp: new Date().toISOString(),
        file,
        currentJsonFile: config?.importedJsonFile
      })
    }
    
    try {
      // Set import flag to prevent cascade re-renders
      const importFlag = window as Window & { __JSON_IMPORT_IN_PROGRESS?: boolean }
      importFlag.__JSON_IMPORT_IN_PROGRESS = true
      
      // Batch all updates in a single transaction
      const batchedUpdate = async () => {
        // Trigger user interaction
        triggerUserInteraction('file-selection', 'importedJsonFile', file)
        
        // Update workspace config
        await updateConfig({
          importedJsonFile: file || undefined,
          lastModified: Date.now()
        })
        
        // Update app store immediately after workspace config (within same batch)
        updateAppConfig('importedJsonFile', file)
      }
      
      // Use startTransition for non-urgent state updates to reduce re-renders
      await new Promise<void>((resolve, reject) => {
        React.startTransition(() => {
          batchedUpdate().then(resolve).catch(reject)
        })
      })
      
      if (logOnce) {
        console.log('✅ [PERFORMANCE] InputFileStep: Batched JSON config updates completed')
      }
    } catch (error) {
      console.error('❌ [PERFORMANCE] InputFileStep: Failed to save JSON file selection:', error)
    } finally {
      // Clear import flag after a delay to allow subscriptions to settle
      setTimeout(() => {
        const importFlag = window as Window & { __JSON_IMPORT_IN_PROGRESS?: boolean }
        importFlag.__JSON_IMPORT_IN_PROGRESS = false
      }, 100)
    }
  }, [config?.importedJsonFile, updateConfig, updateAppConfig])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  // React 19 Optimization: Memoize range selection handler
  const handleRangeSelect = useCallback(async (start: number, end: number) => {
    try {
      const duration = end - start;
      // Trigger immediate config update through event system
      triggerUserInteraction('setting-change', 'selectedRange', { start, end, duration });
      
      await updateConfig({
        selectedRange: { start, end, duration },
        lastModified: Date.now()
      })
    } catch (error) {
      console.error('Failed to save range selection:', error)
    }
  }, [updateConfig]);

  // React 19 Optimization: Memoize metadata update handler
  const handleMetadataUpdate = useCallback(async (metadata: VideoMetadata) => {
    try {
      // Trigger immediate config update through event system
      triggerUserInteraction('setting-change', 'mediaMetadata', metadata);
      
      await updateConfig({
        mediaMetadata: metadata,
        lastModified: Date.now()
      })
    } catch (error) {
      console.error('Failed to save media metadata:', error)
    }
  }, [updateConfig]);

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
        {/* File Upload, Media Preview & Range Selection */}
        <ErrorBoundary 
          fallbackTitle="File Upload Error" 
          fallbackMessage="An error occurred while processing your video file. This might be due to a corrupted file, unsupported format, or insufficient system resources. Please try again with a different file or use the 'Browse Files' button instead of drag and drop."
        >
          <InputPanel 
            // Pass workspace-aware configuration
            initialFile={config?.selectedFile || null}
            initialRange={config?.selectedRange}
            initialJsonFile={config?.importedJsonFile || null}
            onFileSelect={handleFileSelect}
            onJsonFileSelect={handleJsonFileSelect}
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