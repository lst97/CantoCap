/**
 * Step Configuration Usage Examples
 * Demonstrates how to use the type-safe step configuration system
 * These examples show the new React hooks and validation system in action
 */

import React, { useCallback } from 'react'
import {
  useStepConfig,
  useInputFileConfig,
  useConfigStepConfig,
  useProcessingConfig,
  useReviewConfig,
  useExportConfig
} from '../hooks/useStepConfig'
import {
  useWorkspaceRequirement,
  useWorkspaceEmptyState,
  useWorkspaceStepIntegration,
  useInputFileIntegration,
  useConfigIntegration
} from '../hooks/useWorkspaceIntegration'
import { validateStepConfig } from '../utils/stepConfigValidation'
import { isValidStepConfig } from '../utils/typeGuards'
import type { InputFileStepConfig, ConfigStepConfig } from '../types/workspace'

// ============================================================================
// BASIC STEP CONFIGURATION USAGE
// ============================================================================

/**
 * Example: Basic Input File Configuration Component
 */
export const InputFileConfigExample: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceRequirement()
  
  // Type-safe hook for input file step configuration
  const {
    config,
    isLoading,
    isSaving,
    error,
    isDirty,
    validationResult,
    updateConfig,
    save,
    resetToDefault,
    clearError
  } = useInputFileConfig(activeWorkspaceId || '', {
    autoValidate: true,
    syncEnabled: true,
    onError: (error) => console.error('Input file config error:', error),
    onValidationSuccess: () => console.log('Input file config is valid'),
    onValidationError: (result) => console.warn('Validation errors:', result.errors)
  })
  
  const handleFileSelect = useCallback(async (filePath: string) => {
    await updateConfig({
      selectedFile: filePath,
      filePreferences: {
        autoValidate: true,
        extractMetadata: true,
        suggestOptimalSettings: true
      }
    })
  }, [updateConfig])
  
  const handleRangeSelect = useCallback(async (start: number, end: number) => {
    await updateConfig({
      selectedRange: {
        start,
        end,
        duration: end - start
      }
    })
  }, [updateConfig])
  
  if (isLoading) return <div>Loading input file configuration...</div>
  if (error) return (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={clearError}>Clear Error</button>
    </div>
  )
  
  return (
    <div>
      <h3>Input File Configuration</h3>
      
      {/* Current file display */}
      <div>
        <strong>Selected File:</strong> {config?.selectedFile || 'None'}
      </div>
      
      {/* File selection */}
      <div>
        <button onClick={() => handleFileSelect('/path/to/video.mp4')}>
          Select Video File
        </button>
      </div>
      
      {/* Range selection */}
      {config?.selectedFile && (
        <div>
          <button onClick={() => handleRangeSelect(10, 60)}>
            Select 10-60 second range
          </button>
        </div>
      )}
      
      {/* Validation status */}
      {validationResult && (
        <div>
          <p>Validation: {validationResult.isValid ? '✅ Valid' : '❌ Invalid'}</p>
          {validationResult.errors.map((error, index) => (
            <p key={index} style={{ color: 'red' }}>
              {error.field}: {error.message}
            </p>
          ))}
          {validationResult.warnings.map((warning, index) => (
            <p key={index} style={{ color: 'orange' }}>
              {warning.field}: {warning.message}
            </p>
          ))}
        </div>
      )}
      
      {/* Actions */}
      <div>
        {isDirty && <button onClick={save}>Save Changes</button>}
        <button onClick={resetToDefault}>Reset to Default</button>
      </div>
      
      {isSaving && <p>Saving...</p>}
    </div>
  )
}

// ============================================================================
// CONFIGURATION STEP USAGE
// ============================================================================

/**
 * Example: Configuration Step Component
 */
export const ConfigStepExample: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceRequirement()
  
  const {
    config,
    isLoading,
    error,
    validationResult,
    updateConfig,
    validate
  } = useConfigStepConfig(activeWorkspaceId || '', {
    autoValidate: true,
    debounceMs: 300
  })
  
  const handleLanguageChange = useCallback(async (language: string) => {
    await updateConfig({ language })
  }, [updateConfig])
  
  const handleApiKeyChange = useCallback(async (geminiKey: string) => {
    await updateConfig({ geminiKey })
  }, [updateConfig])
  
  const handleAdvancedSettings = useCallback(async () => {
    await updateConfig({
      advancedOptions: {
        qualityThresholds: {
          confidence: 0.85,
          accuracy: 0.9
        },
        batchSize: 5,
        parallelProcessing: true
      }
    })
  }, [updateConfig])
  
  if (isLoading) return <div>Loading configuration...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <div>
      <h3>Processing Configuration</h3>
      
      {/* Language selection */}
      <div>
        <label>Language:</label>
        <select 
          value={config?.language || ''} 
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          <option value="">Select Language</option>
          <option value="zh">Chinese</option>
          <option value="en">English</option>
          <option value="ja">Japanese</option>
        </select>
      </div>
      
      {/* API Key */}
      <div>
        <label>Gemini API Key:</label>
        <input
          type="password"
          value={config?.geminiKey || ''}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="Enter API key"
        />
      </div>
      
      {/* Priority */}
      <div>
        <label>Priority:</label>
        <select 
          value={config?.priority || 'balanced'}
          onChange={(e) => updateConfig({ priority: e.target.value as 'speed' | 'balanced' | 'quality' })}
        >
          <option value="speed">Speed</option>
          <option value="balanced">Balanced</option>
          <option value="quality">Quality</option>
        </select>
      </div>
      
      {/* Advanced settings */}
      <button onClick={handleAdvancedSettings}>
        Apply Advanced Settings
      </button>
      
      {/* Manual validation */}
      <button onClick={validate}>
        Validate Configuration
      </button>
      
      {/* Validation results */}
      {validationResult && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Validation Results:</h4>
          <p>Status: {validationResult.isValid ? '✅ Valid' : '❌ Invalid'}</p>
          
          {validationResult.errors.length > 0 && (
            <div>
              <strong>Errors:</strong>
              <ul>
                {validationResult.errors.map((error, index) => (
                  <li key={index} style={{ color: 'red' }}>
                    {error.field}: {error.message}
                    {error.suggestion && (
                      <div style={{ fontSize: '0.9em', fontStyle: 'italic' }}>
                        Suggestion: {error.suggestion}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {validationResult.warnings.length > 0 && (
            <div>
              <strong>Warnings:</strong>
              <ul>
                {validationResult.warnings.map((warning, index) => (
                  <li key={index} style={{ color: 'orange' }}>
                    {warning.field}: {warning.message}
                    {warning.suggestion && (
                      <div style={{ fontSize: '0.9em', fontStyle: 'italic' }}>
                        Suggestion: {warning.suggestion}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {validationResult.suggestions && validationResult.suggestions.length > 0 && (
            <div>
              <strong>Suggestions:</strong>
              <ul>
                {validationResult.suggestions.map((suggestion, index) => (
                  <li key={index} style={{ color: 'blue' }}>
                    {suggestion.field}: {suggestion.suggestion}
                    {suggestion.autoApply && (
                      <span style={{ fontSize: '0.8em' }}> (auto-apply available)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// WORKSPACE INTEGRATION USAGE
// ============================================================================

/**
 * Example: Workspace Integration Component
 */
export const WorkspaceIntegrationExample: React.FC = () => {
  const workspaceReq = useWorkspaceRequirement()
  const emptyState = useWorkspaceEmptyState()
  
  const stepIntegration = useWorkspaceStepIntegration({
    autoValidate: true,
    syncEnabled: true,
    onError: (error) => console.error('Step integration error:', error)
  })
  
  const inputIntegration = useInputFileIntegration({
    autoValidate: true,
    onValidationSuccess: () => console.log('Input file validation passed')
  })
  
  const configIntegration = useConfigIntegration({
    autoValidate: true
  })
  
  // Handle empty workspace state
  if (emptyState.isEmpty) {
    return (
      <div>
        <h2>Welcome to Canton Cap!</h2>
        <p>You don't have any workspaces yet. Create your first workspace to get started.</p>
        <button 
          onClick={() => emptyState.createFirstWorkspace()}
          disabled={emptyState.isCreating}
        >
          {emptyState.isCreating ? 'Creating...' : 'Create My First Workspace'}
        </button>
      </div>
    )
  }
  
  // Handle loading state
  if (!workspaceReq.isInitialized || workspaceReq.isLoading) {
    return <div>Loading workspace system...</div>
  }
  
  // Handle no active workspace
  if (!workspaceReq.hasActiveWorkspace) {
    return <div>No active workspace. Please select a workspace.</div>
  }
  
  return (
    <div>
      <h2>Workspace Integration Example</h2>
      
      {/* Workspace status */}
      <div style={{ background: '#f5f5f5', padding: '1rem', marginBottom: '1rem' }}>
        <h3>Workspace Status</h3>
        <p><strong>Active Workspace:</strong> {workspaceReq.activeWorkspaceId}</p>
        <p><strong>Total Workspaces:</strong> {workspaceReq.workspaceCount}</p>
        <p><strong>Step Configs Enabled:</strong> {workspaceReq.stepConfigsEnabled ? '✅ Yes' : '❌ No'}</p>
        
        {workspaceReq.error && (
          <p style={{ color: 'red' }}>
            <strong>Error:</strong> {workspaceReq.error.message}
          </p>
        )}
      </div>
      
      {/* Step integration status */}
      <div style={{ background: '#f0f8ff', padding: '1rem', marginBottom: '1rem' }}>
        <h3>Step Configuration Status</h3>
        <p><strong>Loading:</strong> {stepIntegration.isLoading ? 'Yes' : 'No'}</p>
        <p><strong>Saving:</strong> {stepIntegration.isSaving ? 'Yes' : 'No'}</p>
        <p><strong>Has Errors:</strong> {stepIntegration.hasErrors ? 'Yes' : 'No'}</p>
        <p><strong>Dirty Steps:</strong> {stepIntegration.dirtySteps.join(', ') || 'None'}</p>
        
        {stepIntegration.configHealth && (
          <div>
            <p><strong>Overall Health:</strong> {stepIntegration.configHealth.overallHealth}</p>
            <p><strong>Issues:</strong> {stepIntegration.configHealth.issues.length}</p>
          </div>
        )}
        
        {/* Actions */}
        <div style={{ marginTop: '0.5rem' }}>
          <button onClick={stepIntegration.validateAll}>Validate All</button>
          <button onClick={stepIntegration.saveAll} disabled={!stepIntegration.isDirty}>
            Save All
          </button>
          <button onClick={stepIntegration.refreshAll}>Refresh All</button>
          <button onClick={stepIntegration.resetAllSteps}>Reset All</button>
        </div>
      </div>
      
      {/* Input file integration */}
      <div style={{ background: '#fff5f5', padding: '1rem', marginBottom: '1rem' }}>
        <h3>Input File Step</h3>
        <p><strong>Has File:</strong> {inputIntegration.hasFile ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Has Valid File:</strong> {inputIntegration.hasValidFile ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Can Proceed:</strong> {inputIntegration.canProceed ? '✅ Yes' : '❌ No'}</p>
        
        {inputIntegration.config?.selectedFile && (
          <p><strong>Selected File:</strong> {inputIntegration.config.selectedFile}</p>
        )}
      </div>
      
      {/* Config integration */}
      <div style={{ background: '#f5fff5', padding: '1rem', marginBottom: '1rem' }}>
        <h3>Configuration Step</h3>
        <p><strong>Has Language:</strong> {configIntegration.hasLanguage ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Has API Keys:</strong> {configIntegration.hasApiKeys ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Can Proceed:</strong> {configIntegration.canProceed ? '✅ Yes' : '❌ No'}</p>
        
        {configIntegration.config?.language && (
          <p><strong>Language:</strong> {configIntegration.config.language}</p>
        )}
      </div>
      
      {/* Test step configuration updates */}
      <div style={{ background: '#fffef0', padding: '1rem' }}>
        <h3>Test Actions</h3>
        <button 
          onClick={() => stepIntegration.updateStepConfig('input-file', {
            selectedFile: '/example/test-video.mp4',
            filePreferences: {
              autoValidate: true,
              extractMetadata: true,
              suggestOptimalSettings: true
            }
          })}
        >
          Set Test Video File
        </button>
        
        <button 
          onClick={() => stepIntegration.updateStepConfig('config', {
            language: 'zh',
            priority: 'balanced',
            speakers: true,
            written: true
          })}
        >
          Set Test Configuration
        </button>
        
        <button 
          onClick={() => stepIntegration.updateMultipleSteps({
            'processing': {
              verbose: true,
              qualitySettings: {
                targetAccuracy: 0.9,
                minimumConfidence: 0.8,
                enableQualityChecks: true
              }
            },
            'export': {
              formatSettings: {
                format: 'srt',
                encoding: 'utf8',
                includeMetadata: false,
                includeConfidenceScores: true
              }
            }
          })}
        >
          Set Processing & Export Config
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// VALIDATION UTILITIES USAGE
// ============================================================================

/**
 * Example: Manual Validation Usage
 */
export const ValidationExample: React.FC = () => {
  const handleValidateInputConfig = useCallback(() => {
    const testConfig: Partial<InputFileStepConfig> = {
      selectedFile: '/path/to/video.mp4',
      selectedRange: {
        start: 10,
        end: 60,
        duration: 50
      },
      filePreferences: {
        autoValidate: true,
        extractMetadata: true,
        suggestOptimalSettings: false
      }
    }
    
    const result = validateStepConfig('input-file', testConfig)
    console.log('Input file validation result:', result)
    
    // Check type safety
    if (isValidStepConfig('input-file', testConfig)) {
      console.log('Configuration is type-safe:', testConfig)
    }
  }, [])
  
  const handleValidateConfigStep = useCallback(() => {
    const testConfig: Partial<ConfigStepConfig> = {
      language: 'zh',
      priority: 'quality',
      speakers: true,
      written: true,
      geminiKey: 'test-api-key',
      maxChunkDuration: 30,
      advancedOptions: {
        qualityThresholds: {
          confidence: 0.85,
          accuracy: 0.9
        },
        batchSize: 10,
        parallelProcessing: true
      }
    }
    
    const result = validateStepConfig('config', testConfig)
    console.log('Config step validation result:', result)
    
    if (!result.isValid) {
      console.error('Validation errors:', result.errors)
    }
    
    if (result.warnings.length > 0) {
      console.warn('Validation warnings:', result.warnings)
    }
    
    if (result.suggestions && result.suggestions.length > 0) {
      console.log('Validation suggestions:', result.suggestions)
    }
  }, [])
  
  return (
    <div>
      <h3>Manual Validation Examples</h3>
      <button onClick={handleValidateInputConfig}>
        Validate Input File Config
      </button>
      <button onClick={handleValidateConfigStep}>
        Validate Config Step
      </button>
      <p>Check console for validation results</p>
    </div>
  )
}

// ============================================================================
// COMPLETE EXAMPLE COMPONENT
// ============================================================================

/**
 * Complete example showing all features together
 */
export const CompleteStepConfigExample: React.FC = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Step Configuration System Examples</h1>
      
      <div style={{ display: 'grid', gap: '2rem' }}>
        <WorkspaceIntegrationExample />
        <InputFileConfigExample />
        <ConfigStepExample />
        <ValidationExample />
      </div>
    </div>
  )
}

export default CompleteStepConfigExample