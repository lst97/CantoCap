/**
 * Workspace Configuration Integration Tests
 * 
 * Comprehensive integration tests covering:
 * - Store integration with app store and workspace store
 * - Configuration synchronization between stores
 * - Workspace switching scenarios
 * - Concurrent configuration update handling
 * - Real-world workflow scenarios
 */

import { renderHook, act } from '@testing-library/react'
import { configurationManager } from '../../services/configuration-manager'
import { useAppStore } from '../../stores/app-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { 
  EnhancedWorkspaceConfigProvider,
  useUnifiedConfig,
  useEnhancedWorkspaceConfig
} from '../../contexts/EnhancedWorkspaceConfigContext'
import { useConfigurationMigration } from '../../hooks/useConfigurationMigration'
import React from 'react'

// Mock stores
jest.mock('../../stores/app-store')
jest.mock('../../stores/workspace-store')

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>
const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>

describe('Workspace Configuration Integration', () => {
  let mockAppStoreState: any
  let mockWorkspaceStoreState: any
  let mockAppStoreActions: any
  let mockWorkspaceStoreActions: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Setup realistic store states
    mockAppStoreState = {
      config: {
        geminiKey: 'test-api-key',
        hfToken: 'test-hf-token',
        ffmpegPath: '/usr/bin/ffmpeg',
        language: 'zh',
        inputFile: null,
        outputFile: null,
        priority: 'balanced'
      },
      isInitialized: true
    }
    
    mockAppStoreActions = {
      updateConfig: jest.fn(),
      initialize: jest.fn()
    }
    
    mockWorkspaceStoreState = {
      currentWorkspace: {
        id: 'workspace-123',
        name: 'Test Workspace',
        config: {
          language: 'zh',
          inputFile: '/test/input.mp4',
          outputFile: '/test/output.srt',
          priority: 'quality'
        }
      },
      availableWorkspaces: [
        { id: 'workspace-123', name: 'Test Workspace' },
        { id: 'workspace-456', name: 'Another Workspace' }
      ],
      autoSaveStatus: { pendingSaves: 0, lastSave: Date.now(), errors: [] },
      cacheMetrics: { hits: 10, misses: 2, size: 5 },
      lastError: null,
      isInitialized: true
    }
    
    mockWorkspaceStoreActions = {
      setStepConfig: jest.fn().mockResolvedValue(undefined),
      getStepConfig: jest.fn().mockResolvedValue({ enabled: true }),
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

  describe('Store Integration and Routing', () => {
    test('should route global configurations to app store', async () => {
      const result = await configurationManager.setConfig('geminiKey', 'new-api-key')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('app')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('geminiKey', 'new-api-key')
    })

    test('should route workspace-specific configurations to workspace store via app store', async () => {
      const result = await configurationManager.setConfig('inputFile', '/new/input.mp4')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('workspace')
      expect(result.workspaceId).toBe('workspace-123')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('inputFile', '/new/input.mp4')
    })

    test('should handle configuration retrieval from appropriate stores', async () => {
      const globalValue = await configurationManager.getConfig('geminiKey')
      expect(globalValue).toBe('test-api-key')
      
      const workspaceValue = await configurationManager.getConfig('inputFile')
      expect(workspaceValue).toBe('/test/input.mp4') // From workspace config
    })

    test('should handle step configuration operations through workspace store', async () => {
      const stepConfig = { mode: 'advanced', enabled: true }
      const result = await configurationManager.setStepConfig('processing' as any, stepConfig)
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('workspace')
      expect(mockWorkspaceStoreActions.setStepConfig).toHaveBeenCalledWith(
        'workspace-123',
        'processing',
        stepConfig,
        expect.objectContaining({
          merge: true,
          skipValidation: false
        })
      )
    })
  })

  describe('Configuration Synchronization', () => {
    test('should maintain consistency between app and workspace configurations', async () => {
      // Update global config
      await configurationManager.setConfig('geminiKey', 'updated-key')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('geminiKey', 'updated-key')
      
      // Update workspace config
      await configurationManager.setConfig('language', 'en')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('language', 'en')
      
      // Verify both calls went through app store (which should route to appropriate stores)
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(2)
    })

    test('should handle overlapping configuration keys correctly', async () => {
      // Language exists in both app store defaults and workspace
      // Should route to workspace store for workspace-specific handling
      const result = await configurationManager.setConfig('language', 'es')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('workspace')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('language', 'es')
    })

    test('should handle unknown configuration keys by routing to both stores', async () => {
      const result = await configurationManager.setConfig('unknownKey' as any, 'test-value')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('both')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('unknownKey', 'test-value')
    })
  })

  describe('Workspace Switching Scenarios', () => {
    test('should handle workspace transitions gracefully', async () => {
      // Start workspace transition
      configurationManager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      // Attempt configuration update during transition
      const result = await configurationManager.setConfig('priority', 'speed')
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('transitioning')
      
      // Complete transition
      configurationManager.onWorkspaceTransitionComplete()
      
      // Should now allow updates
      const postTransitionResult = await configurationManager.setConfig('priority', 'speed')
      expect(postTransitionResult.success).toBe(true)
    })

    test('should prefer target workspace config during transitions', async () => {
      // Mock current workspace with different language
      mockWorkspaceStoreState.currentWorkspace.config.language = 'en'
      
      configurationManager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const language = await configurationManager.getConfig('language')
      
      // Should get from workspace during transition
      expect(language).toBe('en')
    })

    test('should handle workspace transition timeouts', async () => {
      // Start transition
      configurationManager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      // Mock timeout condition
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // transition start
        .mockReturnValueOnce(7000) // check time (6 seconds later, past 5s timeout)
      
      const result = await configurationManager.setConfig('priority', 'speed')
      
      expect(result.success).toBe(true) // Should force update after timeout
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('priority', 'speed')
    })

    test('should handle workspace switch with configuration updates', async () => {
      // Update config in first workspace
      await configurationManager.setConfig('inputFile', '/workspace1/input.mp4')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('inputFile', '/workspace1/input.mp4')
      
      // Simulate workspace switch
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'workspace-456',
        name: 'Another Workspace',
        config: { language: 'en', inputFile: null }
      }
      
      // Update config in second workspace
      await configurationManager.setConfig('inputFile', '/workspace2/input.mp4')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('inputFile', '/workspace2/input.mp4')
      
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(2)
    })
  })

  describe('Concurrent Configuration Updates', () => {
    test('should handle multiple simultaneous configuration updates', async () => {
      const updates = [
        configurationManager.setConfig('language', 'en'),
        configurationManager.setConfig('priority', 'speed'),
        configurationManager.setConfig('geminiKey', 'concurrent-key')
      ]
      
      const results = await Promise.all(updates)
      
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
      
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(3)
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('language', 'en')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('priority', 'speed')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('geminiKey', 'concurrent-key')
    })

    test('should handle concurrent step configuration updates', async () => {
      const stepUpdates = [
        configurationManager.setStepConfig('processing' as any, { mode: 'advanced' }),
        configurationManager.setStepConfig('review' as any, { showConfidence: true }),
        configurationManager.setStepConfig('export' as any, { format: 'srt' })
      ]
      
      const results = await Promise.all(stepUpdates)
      
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.targetStore).toBe('workspace')
      })
      
      expect(mockWorkspaceStoreActions.setStepConfig).toHaveBeenCalledTimes(3)
    })

    test('should handle mixed configuration and step updates', async () => {
      const mixedUpdates = [
        configurationManager.setConfig('language', 'fr'),
        configurationManager.setStepConfig('processing' as any, { enabled: false }),
        configurationManager.setConfig('priority', 'quality')
      ]
      
      const results = await Promise.all(mixedUpdates)
      
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
      
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(2)
      expect(mockWorkspaceStoreActions.setStepConfig).toHaveBeenCalledTimes(1)
    })

    test('should handle race conditions during workspace transitions', async () => {
      // Start multiple updates, then begin transition
      const update1Promise = configurationManager.setConfig('language', 'de')
      
      configurationManager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const update2Promise = configurationManager.setConfig('priority', 'speed')
      
      const [result1, result2] = await Promise.all([update1Promise, update2Promise])
      
      expect(result1.success).toBe(true) // Should succeed as it started before transition
      expect(result2.success).toBe(false) // Should fail due to transition
      expect(result2.error?.message).toContain('transitioning')
    })
  })

  describe('React Context Integration', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
    )

    test('should integrate configuration manager with React context', async () => {
      const { result } = renderHook(() => useUnifiedConfig(), { wrapper })
      
      await act(async () => {
        const updateResult = await result.current.setValue('language', 'ja')
        expect(updateResult.success).toBe(true)
      })
      
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('language', 'ja')
    })

    test('should handle context initialization with workspace store', async () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), { wrapper })
      
      await act(async () => {
        // Wait for initialization
      })
      
      expect(result.current.isWorkspaceReady).toBe(true)
      expect(result.current.currentWorkspaceId).toBe('workspace-123')
    })

    test('should provide consistent state across context and manager', () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), { wrapper })
      
      const contextInfo = result.current.workspaceContext
      const managerInfo = configurationManager.getWorkspaceContext()
      
      expect(contextInfo.isReady).toBe(managerInfo.isReady)
      expect(contextInfo.hasActiveWorkspace).toBe(!!managerInfo.currentWorkspaceId)
    })

    test('should handle batch configuration updates through context', async () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), { wrapper })
      
      const batchUpdates = [
        { key: 'language' as const, value: 'ko' },
        { key: 'priority' as const, value: 'speed' as const },
        { key: 'geminiKey' as const, value: 'batch-key' }
      ]
      
      await act(async () => {
        const results = await result.current.batchUpdateConfigs(batchUpdates)
        expect(results).toHaveLength(3)
        results.forEach(result => expect(result.success).toBe(true))
      })
      
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(3)
    })
  })

  describe('Error Handling and Recovery', () => {
    test('should handle store operation failures gracefully', async () => {
      const storeError = new Error('Store update failed')
      mockAppStoreActions.updateConfig.mockImplementation(() => {
        throw storeError
      })
      
      const result = await configurationManager.setConfig('language', 'pt')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(storeError)
      expect(result.targetStore).toBe('workspace')
    })

    test('should handle workspace store failures in step configuration', async () => {
      const stepError = new Error('Step config failed')
      mockWorkspaceStoreActions.setStepConfig.mockRejectedValue(stepError)
      
      const result = await configurationManager.setStepConfig('processing' as any, { enabled: true })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(stepError)
      expect(result.targetStore).toBe('workspace')
    })

    test('should maintain system stability during partial failures', async () => {
      // Set up mixed success/failure scenario
      mockAppStoreActions.updateConfig
        .mockImplementationOnce(() => {}) // Success
        .mockImplementationOnce(() => { throw new Error('Second update failed') }) // Failure
        .mockImplementationOnce(() => {}) // Success
      
      const updates = [
        configurationManager.setConfig('language', 'ru'),
        configurationManager.setConfig('priority', 'speed'),
        configurationManager.setConfig('geminiKey', 'recovery-key')
      ]
      
      const results = await Promise.all(updates)
      
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
      
      // System should remain functional
      expect(configurationManager.isReady()).toBe(true)
    })

    test('should handle initialization failures in React context', async () => {
      mockWorkspaceStoreActions.initializeWorkspaces.mockRejectedValue(new Error('Init failed'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), { 
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      await act(async () => {
        // Wait for initialization attempt
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize workspace system:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('Migration Integration', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
    )

    test('should support migration from legacy to centralized configuration', () => {
      const { result } = renderHook(() => useConfigurationMigration(), { wrapper })
      
      const migrationStatus = result.current.migration.checkStatus()
      
      expect(migrationStatus.canMigrate).toBe(true)
      expect(migrationStatus.recommendations.useUnifiedConfig).toBe(true)
      expect(migrationStatus.recommendations.useLegacyFallback).toBe(false)
    })

    test('should handle gradual migration scenarios', async () => {
      const { result } = renderHook(() => useConfigurationMigration(), { wrapper })
      
      // Use legacy method (with warning)
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      act(() => {
        result.current.legacy.updateConfig('language', 'legacy-lang')
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MIGRATION] Component is using legacy updateConfig')
      )
      
      // Use centralized method
      await act(async () => {
        await result.current.centralized.updateConfig('priority', 'centralized-priority')
      })
      
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('language', 'legacy-lang')
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledWith('priority', 'centralized-priority')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Performance and Optimization', () => {
    test('should handle high-frequency configuration updates efficiently', async () => {
      const updates: Promise<any>[] = []
      
      // Generate 50 rapid updates
      for (let i = 0; i < 50; i++) {
        updates.push(configurationManager.setConfig('language', `lang-${i}`))
      }
      
      const startTime = Date.now()
      const results = await Promise.all(updates)
      const endTime = Date.now()
      
      // All updates should succeed
      results.forEach(result => expect(result.success).toBe(true))
      
      // Should complete in reasonable time (less than 1 second for 50 updates)
      expect(endTime - startTime).toBeLessThan(1000)
      
      // Should have made appropriate number of store calls
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(50)
    })

    test('should maintain consistent performance during workspace transitions', async () => {
      const performanceResults: number[] = []
      
      for (let i = 0; i < 5; i++) {
        if (i === 2) {
          // Start transition in the middle
          configurationManager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
        }
        
        const startTime = Date.now()
        await configurationManager.setConfig('priority', `priority-${i}`, { forceUpdate: i >= 2 })
        const endTime = Date.now()
        
        performanceResults.push(endTime - startTime)
        
        if (i === 4) {
          // Complete transition
          configurationManager.onWorkspaceTransitionComplete()
        }
      }
      
      // Performance should remain consistent (all operations under 100ms)
      performanceResults.forEach(time => expect(time).toBeLessThan(100))
    })
  })

  describe('Real-world Workflow Scenarios', () => {
    test('should handle complete workspace configuration workflow', async () => {
      // 1. Initialize with global settings
      await configurationManager.setConfig('geminiKey', 'workflow-api-key')
      await configurationManager.setConfig('hfToken', 'workflow-hf-token')
      
      // 2. Configure workspace-specific settings
      await configurationManager.setConfig('inputFile', '/workflow/input.mp4')
      await configurationManager.setConfig('outputFile', '/workflow/output.srt')
      await configurationManager.setConfig('language', 'zh')
      await configurationManager.setConfig('priority', 'quality')
      
      // 3. Configure processing steps
      await configurationManager.setStepConfig('processing' as any, {
        mode: 'advanced',
        chunkSize: 30,
        enabled: true
      })
      
      await configurationManager.setStepConfig('review' as any, {
        showConfidence: true,
        autoSave: true
      })
      
      // 4. Verify all configurations are set correctly
      const globalConfigs = await Promise.all([
        configurationManager.getConfig('geminiKey'),
        configurationManager.getConfig('hfToken')
      ])
      
      const workspaceConfigs = await Promise.all([
        configurationManager.getConfig('inputFile'),
        configurationManager.getConfig('language'),
        configurationManager.getConfig('priority')
      ])
      
      const stepConfigs = await Promise.all([
        configurationManager.getStepConfig('processing' as any),
        configurationManager.getStepConfig('review' as any)
      ])
      
      // Verify results
      expect(globalConfigs).toEqual(['workflow-api-key', 'workflow-hf-token'])
      expect(workspaceConfigs).toEqual(['/workflow/input.mp4', 'zh', 'quality'])
      expect(stepConfigs[0]).toMatchObject({ mode: 'advanced', chunkSize: 30, enabled: true })
      expect(stepConfigs[1]).toMatchObject({ showConfidence: true, autoSave: true })
      
      // Verify store interactions
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(6)
      expect(mockWorkspaceStoreActions.setStepConfig).toHaveBeenCalledTimes(2)
    })

    test('should handle workspace switching with configuration preservation', async () => {
      // Configure first workspace
      await configurationManager.setConfig('inputFile', '/workspace1/video.mp4')
      await configurationManager.setConfig('language', 'zh')
      
      // Switch to second workspace
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'workspace-456',
        name: 'Second Workspace',
        config: { language: 'en', inputFile: null }
      }
      
      // Configure second workspace
      await configurationManager.setConfig('inputFile', '/workspace2/video.mp4')
      await configurationManager.setConfig('language', 'en')
      
      // Switch back to first workspace
      mockWorkspaceStoreState.currentWorkspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        config: { language: 'zh', inputFile: '/workspace1/video.mp4' }
      }
      
      // Verify configuration isolation
      const currentLanguage = await configurationManager.getConfig('language')
      const currentInputFile = await configurationManager.getConfig('inputFile')
      
      expect(currentLanguage).toBe('zh')
      expect(currentInputFile).toBe('/workspace1/video.mp4')
      
      // Verify all updates were made
      expect(mockAppStoreActions.updateConfig).toHaveBeenCalledTimes(4)
    })
  })
})