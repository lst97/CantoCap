/**
 * Example: Step Component using Centralized Configuration Manager
 * 
 * Shows how step components can use the unified configuration API
 * without needing to know about workspace context.
 */

import React, { useCallback } from 'react'
import { Button, TextField, FormControlLabel, Switch } from '@mui/material'
import { useUnifiedConfig } from '../contexts/EnhancedWorkspaceConfigContext'

// Example: Configuration Step Component
export const ConfigurationStepExample: React.FC = () => {
  const { setValue, getValue, validateConfig, isLoading, isReady, error, clearError } = useUnifiedConfig()

  // Simple configuration update - the manager handles workspace targeting automatically
  const handleLanguageChange = useCallback(async (language: string) => {
    try {
      clearError()
      
      // Validate before setting
      const validation = validateConfig('language', language)
      if (!validation.isValid) {
        console.error('Validation failed:', validation.errors)
        return
      }

      // Set configuration - automatically routed to workspace store
      const result = await setValue('language', language, {
        merge: true,
        priority: 'normal'
      })

      if (result.success) {
        console.log(`Language updated successfully in ${result.targetStore} store`)
        if (result.workspaceId) {
          console.log(`Targeted workspace: ${result.workspaceId}`)
        }
      } else {
        console.error('Failed to update language:', result.error)
      }
    } catch (err) {
      console.error('Error updating language:', err)
    }
  }, [setValue, validateConfig, clearError])

  // API key update - automatically routed to app store (global)
  const handleApiKeyChange = useCallback(async (apiKey: string) => {
    try {
      clearError()
      
      const result = await setValue('geminiKey', apiKey, {
        priority: 'critical', // Sensitive data gets higher priority
        skipValidation: false
      })

      if (result.success) {
        console.log(`API key updated in ${result.targetStore} store`)
      }
    } catch (err) {
      console.error('Error updating API key:', err)
    }
  }, [setValue, clearError])

  // Batch configuration update
  const handleBatchUpdate = useCallback(async () => {
    try {
      clearError()
      
      // Multiple config updates in sequence - each automatically routed
      const updates = [
        { key: 'language' as const, value: 'en' },
        { key: 'speakers' as const, value: true },
        { key: 'priority' as const, value: 'quality' as const }
      ]

      for (const update of updates) {
        await setValue(update.key, update.value, { merge: true })
      }

      console.log('Batch update completed')
    } catch (err) {
      console.error('Batch update failed:', err)
    }
  }, [setValue, clearError])

  if (!isReady) {
    return <div>Initializing workspace...</div>
  }

  return (
    <div>
      <h3>Configuration Step - Unified API Example</h3>
      
      {error && (
        <div style={{ color: 'red', marginBottom: 16 }}>
          Error: {error.message}
          <Button onClick={clearError} size="small">Clear</Button>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <TextField
          label="Language"
          placeholder="Enter language code (e.g., 'en', 'zh')"
          onChange={(e) => handleLanguageChange(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <TextField
          label="Gemini API Key"
          type="password"
          placeholder="Enter API key"
          onChange={(e) => handleApiKeyChange(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Button 
          onClick={handleBatchUpdate}
          disabled={isLoading}
          variant="contained"
        >
          Apply Batch Updates
        </Button>
      </div>

      {isLoading && <div>Updating configuration...</div>}
    </div>
  )
}

// Example: Processing Step Component with step-specific config
export const ProcessingStepExample: React.FC = () => {
  const { setValue, isReady, error } = useUnifiedConfig()

  const handleProcessingOptionChange = useCallback(async (enabled: boolean) => {
    try {
      // This will be automatically routed to workspace store
      await setValue('speakers', enabled, {
        merge: true,
        priority: 'normal'
      })
    } catch (err) {
      console.error('Failed to update processing option:', err)
    }
  }, [setValue])

  if (!isReady) {
    return <div>Workspace not ready</div>
  }

  return (
    <div>
      <h3>Processing Step - Automatic Workspace Targeting</h3>
      
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}

      <FormControlLabel
        control={
          <Switch 
            onChange={(e) => handleProcessingOptionChange(e.target.checked)}
          />
        }
        label="Enable Speaker Diarization"
      />
      
      <p style={{ fontSize: '0.8em', color: '#666' }}>
        This setting is automatically saved to the current workspace
      </p>
    </div>
  )
}

// Example: Migration from legacy direct store access
export const MigratedComponentExample: React.FC = () => {
  // Old way (deprecated):
  // const { updateConfig } = useAppStore()
  // updateConfig('language', 'en') // Component had to know this goes to workspace
  
  // New way (recommended):
  const { setValue, isReady } = useUnifiedConfig()
  
  const handleUpdate = useCallback(async () => {
    if (!isReady) return
    
    // No need to know about workspace targeting - handled automatically
    await setValue('language', 'en')
  }, [setValue, isReady])

  return (
    <div>
      <h3>Migrated Component Example</h3>
      <Button onClick={handleUpdate}>
        Update Language (Auto-targeted)
      </Button>
    </div>
  )
}