/**
 * Unified Configuration Manager Usage Example
 * 
 * This example demonstrates how to use the centralized workspace configuration
 * manager with the new unified API for both app configuration and step configuration.
 */

import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Stack,
  Chip,
  Divider,
  CircularProgress
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useUnifiedConfig } from '../contexts/EnhancedWorkspaceConfigContext'
import { useConfigurationMigration, useSmartConfig } from '../hooks/useConfigurationMigration'
import { useConfigErrorHandler } from '../utils/config-error-handler'

export const UnifiedConfigExample: React.FC = () => {
  const [demoValue, setDemoValue] = useState('')
  const [operationStatus, setOperationStatus] = useState<string | null>(null)
  
  // New unified configuration API
  const { 
    setValue, 
    getValue, 
    validateConfig, 
    isLoading, 
    isReady, 
    error, 
    clearError,
    workspaceContext
  } = useUnifiedConfig()
  
  // Migration utilities for gradual adoption
  const migration = useConfigurationMigration()
  const smartConfig = useSmartConfig()
  
  // Error handling utilities
  const { 
    handleError, 
    attemptRecovery, 
    getUserErrorInfo,
    isRecovering 
  } = useConfigErrorHandler()

  // Example: Update language configuration
  const handleLanguageUpdate = async (language: string) => {
    setOperationStatus('Updating language configuration...')
    
    try {
      const result = await setValue('language', language, {
        validate: true,
        backup: false,
        silent: false
      })
      
      if (result.success) {
        setOperationStatus(`✅ Successfully updated language to ${language} (routed to ${result.targetStore})`)
      } else {
        setOperationStatus(`❌ Failed to update language: ${result.error?.message}`)
      }
    } catch (err) {
      const error = err as Error
      const errorResult = handleError(error, { configKey: 'language', configValue: language })
      setOperationStatus(`❌ Error: ${errorResult.userMessage}`)
    }
  }

  // Example: Batch configuration updates
  const handleBatchUpdate = async () => {
    setOperationStatus('Performing batch configuration update...')
    
    try {
      // Using smart config that automatically chooses best method
      await smartConfig.updateConfig('language', 'en')
      await smartConfig.updateConfig('priority', 'balanced')
      await smartConfig.updateConfig('speakers', false)
      
      setOperationStatus('✅ Batch update completed successfully')
    } catch (err) {
      const error = err as Error
      const errorResult = handleError(error)
      setOperationStatus(`❌ Batch update failed: ${errorResult.userMessage}`)
    }
  }

  // Example: Configuration validation
  const handleValidation = async () => {
    if (!demoValue) return
    
    setOperationStatus('Validating configuration...')
    
    try {
      const validationResult = await validateConfig('language', demoValue)
      
      if (validationResult.isValid) {
        setOperationStatus('✅ Configuration is valid')
      } else {
        setOperationStatus(`❌ Validation failed: ${validationResult.errors.join(', ')}`)
      }
    } catch (err) {
      setOperationStatus(`❌ Validation error: ${(err as Error).message}`)
    }
  }

  // Example: Error recovery
  const handleErrorRecovery = async () => {
    if (!error) return
    
    try {
      const recovery = await attemptRecovery(async () => {
        // Retry the last failed operation
        return await setValue('language', 'en')
      })
      
      if (recovery.success) {
        setOperationStatus('✅ Error recovery successful')
      } else {
        setOperationStatus('❌ Error recovery failed')
      }
    } catch (err) {
      setOperationStatus(`❌ Recovery error: ${(err as Error).message}`)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Unified Configuration Manager Demo
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        This example demonstrates the new centralized workspace configuration manager
        with automatic routing, error handling, and workspace context awareness.
      </Typography>

      {/* System Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>System Status</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip 
              icon={isReady ? <CheckIcon /> : <ErrorIcon />}
              label={isReady ? 'Ready' : 'Not Ready'}
              color={isReady ? 'success' : 'error'}
              size="small"
            />
            <Chip 
              label={`Workspace: ${workspaceContext.hasActiveWorkspace ? 'Active' : 'None'}`}
              color={workspaceContext.hasActiveWorkspace ? 'primary' : 'default'}
              size="small"
            />
            <Chip 
              label={workspaceContext.isTransitioning ? 'Transitioning' : 'Stable'}
              color={workspaceContext.isTransitioning ? 'warning' : 'success'}
              size="small"
            />
          </Stack>
          
          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2">Loading configuration...</Typography>
            </Box>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              <Typography variant="body2">{error.message}</Typography>
              <Button size="small" onClick={clearError} sx={{ mt: 1 }}>
                Clear Error
              </Button>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Migration Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Migration Status</Typography>
          <Stack spacing={1}>
            <Chip 
              label={migration.migration.isReady ? 'Migration Ready' : 'Migration Not Ready'}
              color={migration.migration.isReady ? 'success' : 'warning'}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              Smart Config Status: {smartConfig.migrationStatus.recommendations.useUnifiedConfig 
                ? 'Using Unified Config' 
                : 'Using Legacy Fallback'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* Configuration Operations */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Configuration Operations</Typography>
          
          <Stack spacing={2}>
            {/* Language Update Examples */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Language Configuration</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => handleLanguageUpdate('en')}
                  disabled={isLoading || !isReady}
                >
                  Set English
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => handleLanguageUpdate('zh')}
                  disabled={isLoading || !isReady}
                >
                  Set Chinese
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => handleLanguageUpdate('es')}
                  disabled={isLoading || !isReady}
                >
                  Set Spanish
                </Button>
              </Stack>
            </Box>

            {/* Batch Operations */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Batch Operations</Typography>
              <Button 
                variant="contained" 
                onClick={handleBatchUpdate}
                disabled={isLoading || !isReady}
              >
                Update Multiple Settings
              </Button>
            </Box>

            {/* Configuration Validation */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Configuration Validation</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Enter language code (e.g., 'en', 'zh')"
                  value={demoValue}
                  onChange={(e) => setDemoValue(e.target.value)}
                  sx={{ flexGrow: 1 }}
                />
                <Button 
                  variant="outlined"
                  onClick={handleValidation}
                  disabled={!demoValue || isLoading}
                >
                  Validate
                </Button>
              </Stack>
            </Box>

            {/* Error Recovery */}
            {error && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Error Recovery</Typography>
                <Stack spacing={1}>
                  {getUserErrorInfo && (
                    <Alert severity="warning">
                      <Typography variant="body2">{getUserErrorInfo.message}</Typography>
                      {getUserErrorInfo.suggestions.length > 0 && (
                        <ul>
                          {getUserErrorInfo.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      )}
                    </Alert>
                  )}
                  <Button 
                    variant="contained" 
                    color="warning"
                    onClick={handleErrorRecovery}
                    disabled={isRecovering}
                  >
                    {isRecovering ? 'Recovering...' : 'Attempt Recovery'}
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Operation Status */}
      {operationStatus && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Operation Status</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {operationStatus}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card sx={{ mt: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Implementation Guide</Typography>
          <Typography variant="body2" component="div">
            <strong>1. Replace legacy useAppStore().updateConfig() calls:</strong>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', margin: '8px 0' }}>
{`// Old way
const { updateConfig } = useAppStore()
updateConfig('language', 'en')

// New way
const { setValue } = useUnifiedConfig()
await setValue('language', 'en')`}
            </pre>
            
            <strong>2. Use smart fallback for gradual migration:</strong>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', margin: '8px 0' }}>
{`const smartConfig = useSmartConfig()
await smartConfig.updateConfig('language', 'en') // Automatically chooses best method`}
            </pre>
            
            <strong>3. Handle errors gracefully:</strong>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', margin: '8px 0' }}>
{`const { handleError, attemptRecovery } = useConfigErrorHandler()
try {
  await setValue('language', 'en')
} catch (err) {
  const errorResult = handleError(err as Error)
  // Show user-friendly error message
}`}
            </pre>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}