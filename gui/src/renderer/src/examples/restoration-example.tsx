/**
 * Example demonstrating how to use the restoration-aware useStepConfig hook
 * This file shows how to prevent navigation triggers during app reload scenarios
 */

import React, { useEffect, useState } from 'react'
import { useStepConfig, createRestorationContext, DEFAULT_RESTORATION_CONTEXT } from '../hooks/useStepConfig'

// Example component that uses restoration-aware step configuration
export const StepConfigWithRestoration: React.FC<{
  workspaceId: string
  isAppReloading?: boolean
}> = ({ workspaceId, isAppReloading = false }) => {
  const [isRestoring, setIsRestoring] = useState(isAppReloading)

  // Create restoration context based on app state
  const restorationContext = createRestorationContext(isRestoring, {
    preventNavigationTriggers: true,
    restorationTimeoutMs: 2000,
    onRestorationComplete: () => {
      console.log('App restoration completed, normal operation resumed')
      setIsRestoring(false)
    }
  })

  // Use the step config hook with restoration awareness
  const {
    config,
    isLoading,
    isRestoring: hookIsRestoring,
    isInitialLoad,
    updateConfig,
    error
  } = useStepConfig('review', workspaceId, {
    restorationContext,
    autoValidate: true,
    syncEnabled: true,
    onError: (error) => {
      console.error('Step config error:', error)
    }
  })

  // Example of conditional behavior based on restoration state
  useEffect(() => {
    if (!hookIsRestoring && !isInitialLoad && config) {
      // Only perform navigation or side effects after restoration is complete
      console.log('Ready for normal operations with config:', config)
    }
  }, [hookIsRestoring, isInitialLoad, config])

  // Handler that respects restoration state
  const handleConfigUpdate = async (updates: any) => {
    if (hookIsRestoring) {
      console.log('Skipping config update during restoration')
      return
    }

    try {
      await updateConfig(updates)
      console.log('Config updated successfully')
    } catch (error) {
      console.error('Failed to update config:', error)
    }
  }

  return (
    <div className="step-config-container">
      <h3>Step Configuration (Restoration-Aware)</h3>
      
      {/* Status indicators */}
      <div className="status-indicators">
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
        <div>Restoring: {hookIsRestoring ? 'Yes' : 'No'}</div>
        <div>Initial Load: {isInitialLoad ? 'Yes' : 'No'}</div>
        {error && <div className="error">Error: {error.message}</div>}
      </div>

      {/* Configuration display */}
      {config && (
        <div className="config-display">
          <h4>Current Configuration:</h4>
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
      )}

      {/* Controls - disabled during restoration */}
      <div className="controls">
        <button
          onClick={() => handleConfigUpdate({ autoSave: !config?.editingPreferences?.autoSave })}
          disabled={hookIsRestoring || isLoading}
        >
          Toggle Auto Save
        </button>
        
        <button
          onClick={() => handleConfigUpdate({ 
            displayOptions: { 
              ...config?.displayOptions, 
              fontSize: (config?.displayOptions?.fontSize || 14) + 1 
            }
          })}
          disabled={hookIsRestoring || isLoading}
        >
          Increase Font Size
        </button>
      </div>

      {/* Restoration status */}
      {hookIsRestoring && (
        <div className="restoration-notice">
          🔄 App is restoring... Navigation triggers are disabled.
        </div>
      )}
    </div>
  )
}

// Example of how to use with different restoration scenarios
export const RestorationExamples: React.FC = () => {
  return (
    <div className="restoration-examples">
      <h2>Restoration-Aware useStepConfig Examples</h2>

      {/* Example 1: App reload scenario */}
      <section>
        <h3>1. App Reload Scenario</h3>
        <StepConfigWithRestoration 
          workspaceId="workspace-1" 
          isAppReloading={true} 
        />
      </section>

      {/* Example 2: Normal operation */}
      <section>
        <h3>2. Normal Operation</h3>
        <StepConfigWithRestoration 
          workspaceId="workspace-2" 
          isAppReloading={false} 
        />
      </section>
    </div>
  )
}

// Example hook for managing app-wide restoration state
export const useAppRestoration = () => {
  const [isRestoring, setIsRestoring] = useState(false)

  useEffect(() => {
    // Detect app reload/refresh scenarios
    const handleBeforeUnload = () => {
      localStorage.setItem('app-was-reloading', 'true')
    }

    const handleLoad = () => {
      const wasReloading = localStorage.getItem('app-was-reloading')
      if (wasReloading) {
        setIsRestoring(true)
        localStorage.removeItem('app-was-reloading')
        
        // Auto-complete restoration after timeout
        setTimeout(() => {
          setIsRestoring(false)
        }, 2000)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('load', handleLoad)

    // Check on mount
    handleLoad()

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('load', handleLoad)
    }
  }, [])

  return { isRestoring, setIsRestoring }
}

// Usage example for the app-wide restoration hook
export const AppWithRestoration: React.FC = () => {
  const { isRestoring } = useAppRestoration()

  return (
    <div className="app">
      {isRestoring && (
        <div className="global-restoration-banner">
          App is restoring from reload...
        </div>
      )}
      
      <StepConfigWithRestoration 
        workspaceId="main-workspace" 
        isAppReloading={isRestoring}
      />
    </div>
  )
}