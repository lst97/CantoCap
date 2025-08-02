/**
 * Configuration Manager End-to-End Tests
 * 
 * Comprehensive end-to-end scenarios covering:
 * - Complete configuration workflows
 * - Workspace switching with config isolation
 * - Error recovery during workspace changes
 * - Data consistency across workspace switches
 * - Performance under high configuration update frequency
 * - Real user interaction patterns
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { configurationManager } from '../../services/configuration-manager'
import { useAppStore } from '../../stores/app-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { 
  EnhancedWorkspaceConfigProvider,
  useUnifiedConfig,
  useEnhancedWorkspaceConfig,
  useEnhancedStepConfig
} from '../../contexts/EnhancedWorkspaceConfigContext'
import { useConfigurationMigration, useSmartConfig } from '../../hooks/useConfigurationMigration'
import { ConfigErrorHandler } from '../../utils/config-error-handler'

// Mock stores
jest.mock('../../stores/app-store')
jest.mock('../../stores/workspace-store')

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>
const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>

// Mock component for testing React integration
const TestConfigurationComponent: React.FC<{
  onConfigUpdate?: (key: string, value: any) => void
  onError?: (error: Error) => void
}> = ({ onConfigUpdate, onError }) => {
  const { setValue, getValue, isLoading, error, clearError } = useUnifiedConfig()
  const [currentValue, setCurrentValue] = React.useState<string>('')

  const handleUpdateConfig = async (key: string, value: any) => {
    try {
      await setValue(key as any, value)
      onConfigUpdate?.(key, value)
    } catch (err) {
      onError?.(err as Error)
    }
  }

  const handleGetConfig = async (key: string) => {
    try {
      const value = await getValue(key as any)
      setCurrentValue(String(value))
    } catch (err) {
      onError?.(err as Error)
    }
  }

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Ready'}</div>
      <div data-testid="error">{error?.message || 'No Error'}</div>
      <div data-testid="current-value">{currentValue}</div>
      
      <button 
        data-testid="update-language"
        onClick={() => handleUpdateConfig('language', 'fr')}
        disabled={isLoading}
      >
        Update Language
      </button>
      
      <button 
        data-testid="get-language"
        onClick={() => handleGetConfig('language')}
        disabled={isLoading}
      >
        Get Language
      </button>
      
      <button 
        data-testid="clear-error"
        onClick={clearError}
      >
        Clear Error
      </button>
    </div>
  )
}

describe('Configuration Manager End-to-End Tests', () => {
  let mockAppStoreState: any
  let mockWorkspaceStoreState: any
  let mockAppStoreActions: any
  let mockWorkspaceStoreActions: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Reset configuration manager state
    configurationManager.onWorkspaceTransitionComplete()
    
    // Setup realistic store states
    mockAppStoreState = {
      config: {
        geminiKey: 'e2e-api-key',
        hfToken: 'e2e-hf-token',
        ffmpegPath: '/usr/bin/ffmpeg',
        language: 'zh',
        inputFile: null,
        outputFile: null,
        priority: 'balanced',
        maxChunkDuration: 30,
        videoQuality: '720p'
      },
      isInitialized: true
    }
    
    mockAppStoreActions = {
      updateConfig: jest.fn((key, value) => {
        mockAppStoreState.config[key] = value
      }),
      initialize: jest.fn()
    }
    
    mockWorkspaceStoreState = {
      currentWorkspace: {
        id: 'e2e-workspace-123',
        name: 'E2E Test Workspace',
        config: {
          language: 'zh',
          inputFile: '/e2e/test/input.mp4',
          outputFile: '/e2e/test/output.srt',
          priority: 'quality'
        }
      },
      availableWorkspaces: [
        { id: 'e2e-workspace-123', name: 'E2E Test Workspace' },
        { id: 'e2e-workspace-456', name: 'E2E Second Workspace' }
      ],
      autoSaveStatus: { pendingSaves: 0, lastSave: Date.now(), errors: [] },
      cacheMetrics: { hits: 15, misses: 3, size: 8 },
      lastError: null,
      isInitialized: true
    }
    
    mockWorkspaceStoreActions = {
      setStepConfig: jest.fn().mockResolvedValue(undefined),
      getStepConfig: jest.fn().mockResolvedValue({ enabled: true, mode: 'simple' }),
      resetStepConfig: jest.fn().mockResolvedValue(undefined),
      switchWorkspace: jest.fn().mockResolvedValue(undefined),
      clearError: jest.fn(),
      initializeWorkspaces: jest.fn().mockResolvedValue(undefined)
    }
    
    // Configure store mocks
    mockUseAppStore.mockReturnValue({ ...mockAppStoreState, ...mockAppStoreActions })
    mockUseAppStore.getState = jest.fn().mockReturnValue({ ...mockAppStoreState, ...mockAppStoreActions })
    
    mockUseWorkspaceStore.mockReturnValue({ ...mockWorkspaceStoreState, ...mockWorkspaceStoreActions })
    mockUseWorkspaceStore.getState = jest.fn().mockReturnValue({ ...mockWorkspaceStoreState, ...mockWorkspaceStoreActions })
    mockUseWorkspaceStore.subscribe = jest.fn()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Complete Configuration Workflows', () => {
    test('should handle complete subtitle generation configuration workflow', async () => {
      // Simulate a complete workflow: global setup → workspace config → step config → processing
      
      // 1. Global API configuration
      const globalResults = await Promise.all([
        configurationManager.setConfig('geminiKey', 'workflow-gemini-key'),
        configurationManager.setConfig('hfToken', 'workflow-hf-token'),
        configurationManager.setConfig('ffmpegPath', '/workflow/ffmpeg')
      ])
      
      globalResults.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.targetStore).toBe('app')
      })
      
      // 2. Input file configuration
      const inputResult = await configurationManager.setConfig('inputFile', '/workflow/video.mp4')
      expect(inputResult.success).toBe(true)
      expect(inputResult.targetStore).toBe('workspace')
      
      // 3. Processing configuration
      const processingResults = await Promise.all([
        configurationManager.setConfig('language', 'zh'),
        configurationManager.setConfig('priority', 'quality'),
        configurationManager.setConfig('maxChunkDuration', 45),
        configurationManager.setConfig('videoQuality', '720p')
      ])
      
      processingResults.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.targetStore).toBe('workspace')
      })
      
      // 4. Step-specific configuration
      const stepResults = await Promise.all([
        configurationManager.setStepConfig('input' as any, {
          validateInput: true,
          extractAudio: true
        }),
        configurationManager.setStepConfig('processing' as any, {
          mode: 'advanced',
          useGemini: true,
          chunkOverlap: 0.5
        }),
        configurationManager.setStepConfig('review' as any, {
          showConfidence: true,
          autoSave: true,
          highlightLowConfidence: true
        }),
        configurationManager.setStepConfig('export' as any, {
          format: 'srt',
          includeMetadata: true,
          embedTimings: true
        })
      ])
      
      stepResults.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.targetStore).toBe('workspace')
        expect(result.workspaceId).toBe('e2e-workspace-123')
      })
      
      // 5. Verify complete configuration state
      const finalGlobalConfig = await Promise.all([
        configurationManager.getConfig('geminiKey'),
        configurationManager.getConfig('hfToken'),
        configurationManager.getConfig('ffmpegPath')
      ])
      
      const finalWorkspaceConfig = await Promise.all([
        configurationManager.getConfig('inputFile'),
        configurationManager.getConfig('language'),
        configurationManager.getConfig('priority'),
        configurationManager.getConfig('maxChunkDuration')
      ])
      
      const finalStepConfigs = await Promise.all([
        configurationManager.getStepConfig('input' as any),
        configurationManager.getStepConfig('processing' as any),
        configurationManager.getStepConfig('review' as any),
        configurationManager.getStepConfig('export' as any)
      ])
      
      // Verify all configurations are correctly set
      expect(finalGlobalConfig).toEqual([
        'workflow-gemini-key',
        'workflow-hf-token', 
        '/workflow/ffmpeg'
      ])
      
      expect(finalWorkspaceConfig).toEqual([
        '/workflow/video.mp4',
        'zh',
        'quality',
        45
      ])
      
      expect(finalStepConfigs[0]).toMatchObject({ validateInput: true, extractAudio: true })
      expect(finalStepConfigs[1]).toMatchObject({ mode: 'advanced', useGemini: true })
      expect(finalStepConfigs[2]).toMatchObject({ showConfidence: true, autoSave: true })
      expect(finalStepConfigs[3]).toMatchObject({ format: 'srt', includeMetadata: true })
      
      // Verify store interaction counts
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(7) // 3 global + 4 workspace
      expect(mockWorkspaceStoreActions.setStepConfig).toHaveBeenCalledTimes(4)
    })

    test('should handle configuration workflow with validation errors and recovery', async () => {
      // 1. Valid configuration
      const validResult = await configurationManager.setConfig('language', 'zh')
      expect(validResult.success).toBe(true)
      
      // 2. Invalid configuration (should fail validation)
      const invalidResult = await configurationManager.setConfig('language', 'invalid-lang' as any)
      expect(invalidResult.success).toBe(false)
      expect(invalidResult.error?.message).toContain('validation failed')
      
      // 3. Recovery with valid configuration
      const recoveryResult = await configurationManager.setConfig('language', 'en')
      expect(recoveryResult.success).toBe(true)
      
      // 4. Skip validation for special cases
      const skipValidationResult = await configurationManager.setConfig(
        'language', 
        'custom-lang' as any, 
        { skipValidation: true }
      )
      expect(skipValidationResult.success).toBe(true)
      
      // Verify final state
      const finalLanguage = await configurationManager.getConfig('language')
      expect(finalLanguage).toBe('custom-lang')
    })
  })

  describe('Workspace Switching with Configuration Isolation', () => {
    test('should maintain configuration isolation during workspace switches', async () => {
      // Configure first workspace
      await configurationManager.setConfig('inputFile', '/workspace1/video.mp4')
      await configurationManager.setConfig('language', 'zh')
      await configurationManager.setConfig('priority', 'quality')
      
      await configurationManager.setStepConfig('processing' as any, {
        mode: 'advanced',
        workspace: 'first'
      })
      
      // Simulate workspace switch to second workspace
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'e2e-workspace-456',
        name: 'E2E Second Workspace',
        config: {
          language: 'en',
          inputFile: '/workspace2/video.mp4',
          priority: 'speed'
        }
      }
      
      // Configure second workspace
      await configurationManager.setConfig('inputFile', '/workspace2/different.mp4')
      await configurationManager.setConfig('language', 'en')
      await configurationManager.setConfig('priority', 'speed')
      
      await configurationManager.setStepConfig('processing' as any, {
        mode: 'simple',
        workspace: 'second'
      })
      
      // Verify second workspace configuration
      const workspace2Config = await Promise.all([
        configurationManager.getConfig('inputFile'),
        configurationManager.getConfig('language'),
        configurationManager.getConfig('priority'),
        configurationManager.getStepConfig('processing' as any)
      ])
      
      expect(workspace2Config).toEqual([
        '/workspace2/different.mp4',
        'en',
        'speed',
        { mode: 'simple', workspace: 'second' }
      ])
      
      // Switch back to first workspace
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'e2e-workspace-123',
        name: 'E2E Test Workspace',
        config: {
          language: 'zh',
          inputFile: '/workspace1/video.mp4',
          priority: 'quality'
        }
      }
      
      // Verify first workspace configuration is preserved
      const workspace1Config = await Promise.all([
        configurationManager.getConfig('inputFile'),
        configurationManager.getConfig('language'),
        configurationManager.getConfig('priority')
      ])
      
      expect(workspace1Config).toEqual([
        '/workspace1/video.mp4',
        'zh',
        'quality'
      ])
      
      // Verify global configuration remains consistent
      const globalConfig = await Promise.all([
        configurationManager.getConfig('geminiKey'),
        configurationManager.getConfig('ffmpegPath')
      ])
      
      expect(globalConfig).toEqual(['e2e-api-key', '/usr/bin/ffmpeg'])
    })

    test('should handle rapid workspace switching without data corruption', async () => {
      const workspaces = [
        { id: 'rapid-1', config: { language: 'zh', priority: 'quality' } },
        { id: 'rapid-2', config: { language: 'en', priority: 'speed' } },
        { id: 'rapid-3', config: { language: 'fr', priority: 'balanced' } },
        { id: 'rapid-4', config: { language: 'de', priority: 'quality' } }
      ]
      
      // Rapidly switch workspaces and configure each
      for (let i = 0; i < workspaces.length; i++) {
        const workspace = workspaces[i]
        
        // Simulate workspace switch
        mockWorkspaceStoreState.currentWorkspace = {
          id: workspace.id,
          name: `Rapid Workspace ${i + 1}`,
          config: workspace.config
        }
        
        // Configure workspace
        await Promise.all([
          configurationManager.setConfig('language', workspace.config.language as any),
          configurationManager.setConfig('priority', workspace.config.priority as any),
          configurationManager.setConfig('inputFile', `/rapid/${workspace.id}.mp4`)
        ])
        
        // Verify configuration immediately
        const currentConfig = await Promise.all([
          configurationManager.getConfig('language'),
          configurationManager.getConfig('priority'),
          configurationManager.getConfig('inputFile')
        ])
        
        expect(currentConfig).toEqual([
          workspace.config.language,
          workspace.config.priority,
          `/rapid/${workspace.id}.mp4`
        ])
      }
      
      // Verify all configurations were applied correctly
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(workspaces.length * 3)
    })
  })

  describe('Error Recovery During Workspace Changes', () => {
    test('should recover from workspace transition errors', async () => {
      // Start workspace transition
      configurationManager.onWorkspaceTransitionStart('e2e-workspace-123', 'e2e-workspace-456')
      
      // Attempt configuration during transition (should fail)
      const duringTransitionResult = await configurationManager.setConfig('language', 'pt')
      expect(duringTransitionResult.success).toBe(false)
      expect(duringTransitionResult.error?.message).toContain('transitioning')
      
      // Simulate transition error
      configurationManager.onWorkspaceTransitionError(new Error('Transition failed'))
      
      // Should be able to configure again after error recovery
      const afterErrorResult = await configurationManager.setConfig('language', 'pt')
      expect(afterErrorResult.success).toBe(true)
      
      // Start new transition
      configurationManager.onWorkspaceTransitionStart('e2e-workspace-123', 'e2e-workspace-789')
      
      // Force update during transition
      const forceUpdateResult = await configurationManager.setConfig(
        'priority', 
        'speed', 
        { forceUpdate: true }
      )
      expect(forceUpdateResult.success).toBe(true)
      
      // Complete transition normally
      configurationManager.onWorkspaceTransitionComplete()
      
      // Verify normal operation is restored
      const normalResult = await configurationManager.setConfig('maxChunkDuration', 60)
      expect(normalResult.success).toBe(true)
    })

    test('should handle configuration errors with automatic recovery', async () => {
      // Mock store to throw error then recover
      let errorCount = 0
      mockAppStoreActions.updateConfig.mockImplementation((key, value) => {
        errorCount++
        if (errorCount <= 2) {
          throw new Error(`Store operation failed (attempt ${errorCount})`)
        }
        mockAppStoreState.config[key] = value
      })
      
      // First attempt should fail
      const firstResult = await configurationManager.setConfig('language', 'it')
      expect(firstResult.success).toBe(false)
      expect(firstResult.error?.message).toContain('Store operation failed (attempt 1)')
      
      // Second attempt should also fail
      const secondResult = await configurationManager.setConfig('priority', 'quality')
      expect(secondResult.success).toBe(false)
      expect(secondResult.error?.message).toContain('Store operation failed (attempt 2)')
      
      // Third attempt should succeed (after "recovery")
      const thirdResult = await configurationManager.setConfig('maxChunkDuration', 45)
      expect(thirdResult.success).toBe(true)
      
      // Verify system is still functional
      expect(configurationManager.isReady()).toBe(true)
      
      // Subsequent operations should work normally
      const subsequentResult = await configurationManager.setConfig('videoQuality', '480p')
      expect(subsequentResult.success).toBe(true)
    })
  })

  describe('React Component Integration', () => {
    test('should integrate configuration manager with React components', async () => {
      const mockOnConfigUpdate = jest.fn()
      const mockOnError = jest.fn()
      
      const { getByTestId } = render(
        <EnhancedWorkspaceConfigProvider>
          <TestConfigurationComponent 
            onConfigUpdate={mockOnConfigUpdate}
            onError={mockOnError}
          />
        </EnhancedWorkspaceConfigProvider>
      )
      
      // Initial state should be ready
      expect(getByTestId('loading')).toHaveTextContent('Ready')
      expect(getByTestId('error')).toHaveTextContent('No Error')
      
      // Test configuration update
      await act(async () => {
        fireEvent.click(getByTestId('update-language'))
      })
      
      expect(mockOnConfigUpdate).toHaveBeenCalledWith('language', 'fr')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('language', 'fr')
      
      // Test configuration retrieval
      await act(async () => {
        fireEvent.click(getByTestId('get-language'))
      })
      
      await waitFor(() => {
        expect(getByTestId('current-value')).toHaveTextContent('fr')
      })
    })

    test('should handle component-level errors with error boundaries', async () => {
      // Mock configuration error
      mockAppStoreActions.updateConfig.mockImplementation(() => {
        throw new Error('Component level error')
      })
      
      const mockOnError = jest.fn()
      
      const { getByTestId } = render(
        <EnhancedWorkspaceConfigProvider>
          <TestConfigurationComponent onError={mockOnError} />
        </EnhancedWorkspaceConfigProvider>
      )
      
      // Trigger error
      await act(async () => {
        fireEvent.click(getByTestId('update-language'))
      })
      
      // Should handle error gracefully
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
      
      // Component should show error state
      await waitFor(() => {
        expect(getByTestId('error')).not.toHaveTextContent('No Error')
      })
      
      // Should be able to clear error
      await act(async () => {
        fireEvent.click(getByTestId('clear-error'))
      })
      
      await waitFor(() => {
        expect(getByTestId('error')).toHaveTextContent('No Error')
      })
    })

    test('should handle loading states during configuration operations', async () => {
      // Mock slow configuration update
      let resolveUpdate: () => void
      mockAppStoreActions.updateConfig.mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveUpdate = resolve
        })
      })
      
      const { getByTestId } = render(
        <EnhancedWorkspaceConfigProvider>
          <TestConfigurationComponent />
        </EnhancedWorkspaceConfigProvider>
      )
      
      // Start update
      act(() => {
        fireEvent.click(getByTestId('update-language'))
      })
      
      // Should show loading state
      await waitFor(() => {
        expect(getByTestId('loading')).toHaveTextContent('Loading')
      })
      
      // Button should be disabled during loading
      expect(getByTestId('update-language')).toBeDisabled()
      
      // Complete update
      await act(async () => {
        resolveUpdate!()
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      // Should return to ready state
      await waitFor(() => {
        expect(getByTestId('loading')).toHaveTextContent('Ready')
        expect(getByTestId('update-language')).not.toBeDisabled()
      })
    })
  })

  describe('Performance Under High Update Frequency', () => {
    test('should maintain performance with high-frequency configuration updates', async () => {
      const startTime = Date.now()
      const updatePromises: Promise<any>[] = []
      
      // Generate 100 configuration updates
      for (let i = 0; i < 100; i++) {
        const configKey = i % 2 === 0 ? 'language' : 'priority'
        const configValue = i % 2 === 0 ? `lang-${i}` : 'quality'
        
        updatePromises.push(
          configurationManager.setConfig(configKey as any, configValue)
        )
      }
      
      // Wait for all updates to complete
      const results = await Promise.all(updatePromises)
      const endTime = Date.now()
      
      // All updates should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
      })
      
      // Should complete within reasonable time (less than 2 seconds for 100 updates)
      const duration = endTime - startTime
      expect(duration).toBeLessThan(2000)
      
      // Should maintain system stability
      expect(configurationManager.isReady()).toBe(true)
      
      // Verify final state is consistent
      const finalLanguage = await configurationManager.getConfig('language')
      const finalPriority = await configurationManager.getConfig('priority')
      
      expect(finalLanguage).toBe('lang-98') // Last even index
      expect(finalPriority).toBe('quality') // Last odd index
    })

    test('should handle mixed configuration and step updates efficiently', async () => {
      const startTime = Date.now()
      const allPromises: Promise<any>[] = []
      
      // Generate mixed updates: 50 config + 50 step config
      for (let i = 0; i < 50; i++) {
        // Configuration updates
        allPromises.push(
          configurationManager.setConfig('language', `mixed-lang-${i}`)
        )
        
        // Step configuration updates
        allPromises.push(
          configurationManager.setStepConfig(`step-${i % 5}` as any, {
            iteration: i,
            enabled: i % 2 === 0
          })
        )
      }
      
      const results = await Promise.all(allPromises)
      const endTime = Date.now()
      
      // All updates should succeed
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
      
      // Should complete efficiently
      const duration = endTime - startTime
      expect(duration).toBeLessThan(3000) // 3 seconds for 100 mixed operations
      
      // Verify store interaction counts
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(50)
      expect(mockWorkspaceStoreActions.setStepConfig).toHaveBeenCalledTimes(50)
    })
  })

  describe('Data Consistency Across Operations', () => {
    test('should maintain data consistency during concurrent operations', async () => {
      // Setup concurrent operations that might interfere with each other
      const concurrentOperations = [
        // Global config updates
        configurationManager.setConfig('geminiKey', 'concurrent-key-1'),
        configurationManager.setConfig('hfToken', 'concurrent-token-1'),
        
        // Workspace config updates  
        configurationManager.setConfig('language', 'concurrent-zh'),
        configurationManager.setConfig('priority', 'concurrent-quality'),
        
        // Step config updates
        configurationManager.setStepConfig('processing' as any, { concurrent: true, step: 1 }),
        configurationManager.setStepConfig('review' as any, { concurrent: true, step: 2 }),
        
        // More global configs
        configurationManager.setConfig('ffmpegPath', '/concurrent/ffmpeg'),
        
        // More workspace configs
        configurationManager.setConfig('maxChunkDuration', 35),
        configurationManager.setConfig('videoQuality', '480p'),
        
        // More step configs
        configurationManager.setStepConfig('export' as any, { concurrent: true, step: 3 })
      ]
      
      const results = await Promise.all(concurrentOperations)
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
      
      // Verify final state consistency
      const finalGlobalConfig = await Promise.all([
        configurationManager.getConfig('geminiKey'),
        configurationManager.getConfig('hfToken'),
        configurationManager.getConfig('ffmpegPath')
      ])
      
      const finalWorkspaceConfig = await Promise.all([
        configurationManager.getConfig('language'),
        configurationManager.getConfig('priority'),
        configurationManager.getConfig('maxChunkDuration'),
        configurationManager.getConfig('videoQuality')
      ])
      
      const finalStepConfigs = await Promise.all([
        configurationManager.getStepConfig('processing' as any),
        configurationManager.getStepConfig('review' as any),
        configurationManager.getStepConfig('export' as any)
      ])
      
      // Verify all values are correctly set
      expect(finalGlobalConfig).toEqual([
        'concurrent-key-1',
        'concurrent-token-1',
        '/concurrent/ffmpeg'
      ])
      
      expect(finalWorkspaceConfig).toEqual([
        'concurrent-zh',
        'concurrent-quality',
        35,
        '480p'
      ])
      
      expect(finalStepConfigs).toEqual([
        { concurrent: true, step: 1 },
        { concurrent: true, step: 2 },
        { concurrent: true, step: 3 }
      ])
    })

    test('should maintain consistency during workspace transitions with concurrent updates', async () => {
      // Start with initial configuration
      await configurationManager.setConfig('language', 'consistency-zh')
      await configurationManager.setConfig('priority', 'consistency-quality')
      
      // Start workspace transition
      configurationManager.onWorkspaceTransitionStart('e2e-workspace-123', 'e2e-workspace-456')
      
      // Attempt multiple concurrent updates during transition
      const transitionUpdates = [
        configurationManager.setConfig('language', 'during-transition', { forceUpdate: true }),
        configurationManager.setConfig('geminiKey', 'transition-key'), // Global, should work
        configurationManager.setConfig('priority', 'transition-priority'), // Workspace, should fail
        configurationManager.setConfig('hfToken', 'transition-token'), // Global, should work
      ]
      
      const transitionResults = await Promise.all(transitionUpdates)
      
      // Check which succeeded and which failed as expected
      expect(transitionResults[0].success).toBe(true) // Forced update
      expect(transitionResults[1].success).toBe(true) // Global config
      expect(transitionResults[2].success).toBe(false) // Workspace config without force
      expect(transitionResults[3].success).toBe(true) // Global config
      
      // Complete transition
      configurationManager.onWorkspaceTransitionComplete()
      
      // Verify final state is consistent
      const postTransitionConfig = await Promise.all([
        configurationManager.getConfig('language'),
        configurationManager.getConfig('geminiKey'),
        configurationManager.getConfig('hfToken')
      ])
      
      expect(postTransitionConfig).toEqual([
        'during-transition', // Updated with force
        'transition-key',    // Global update succeeded
        'transition-token'   // Global update succeeded
      ])
    })
  })

  describe('Real User Interaction Patterns', () => {
    test('should handle typical user workflow patterns', async () => {
      // Pattern 1: User sets up new project
      await configurationManager.setConfig('inputFile', '/user/project/video.mp4')
      await configurationManager.setConfig('language', 'zh')
      
      // Pattern 2: User adjusts quality settings
      await configurationManager.setConfig('priority', 'quality')
      await configurationManager.setConfig('maxChunkDuration', 30)
      
      // Pattern 3: User configures processing steps
      await configurationManager.setStepConfig('processing' as any, {
        useAdvanced: true,
        qualityThreshold: 0.8
      })
      
      // Pattern 4: User realizes they need different settings, makes changes
      await configurationManager.setConfig('priority', 'speed')
      await configurationManager.setConfig('maxChunkDuration', 15)
      
      // Pattern 5: User switches to different project (workspace)
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'user-project-2',
        name: 'User Project 2',
        config: { language: 'en' }
      }
      
      await configurationManager.setConfig('inputFile', '/user/project2/different.mp4')
      await configurationManager.setConfig('language', 'en')
      
      // Pattern 6: User goes back to first project
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'e2e-workspace-123',
        name: 'E2E Test Workspace',
        config: {
          language: 'zh',
          inputFile: '/user/project/video.mp4',
          priority: 'speed',
          maxChunkDuration: 15
        }
      }
      
      // Verify first project settings are preserved
      const firstProjectConfig = await Promise.all([
        configurationManager.getConfig('inputFile'),
        configurationManager.getConfig('language'),
        configurationManager.getConfig('priority'),
        configurationManager.getConfig('maxChunkDuration')
      ])
      
      expect(firstProjectConfig).toEqual([
        '/user/project/video.mp4',
        'zh',
        'speed',
        15
      ])
      
      // Verify all interactions were recorded
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(8) // All config updates
      expect(mockWorkspaceStoreActions.setStepConfig).toHaveBeenCalledTimes(1) // One step config
    })

    test('should handle error scenarios that users might encounter', async () => {
      // Scenario 1: User provides invalid configuration
      const invalidResult = await configurationManager.setConfig('maxChunkDuration', -5)
      expect(invalidResult.success).toBe(false)
      expect(invalidResult.error?.message).toContain('between 1 and 60')
      
      // Scenario 2: User tries to configure without active workspace
      mockWorkspaceStoreState.currentWorkspace = null
      
      const noWorkspaceResult = await configurationManager.setConfig('inputFile', '/no/workspace.mp4')
      expect(noWorkspaceResult.success).toBe(false)
      expect(noWorkspaceResult.error?.message).toContain('No active workspace')
      
      // Scenario 3: User encounters temporary system error
      mockAppStoreState.isInitialized = false
      expect(configurationManager.isReady()).toBe(false)
      
      // Scenario 4: System recovers, user can continue
      mockAppStoreState.isInitialized = true
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'recovered-workspace',
        name: 'Recovered Workspace',
        config: {}
      }
      
      expect(configurationManager.isReady()).toBe(true)
      
      const recoveredResult = await configurationManager.setConfig('language', 'recovered-lang')
      expect(recoveredResult.success).toBe(true)
    })
  })
})