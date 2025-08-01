/**
 * Configuration Manager Unit Tests
 * 
 * Comprehensive unit tests for the ConfigurationManager service covering:
 * - Config key categorization and automatic routing
 * - Workspace transition handling
 * - Caching functionality and invalidation
 * - Error handling and recovery strategies
 * - Validation logic
 */

import { ConfigurationManager, configurationManager, type ConfigUpdateOptions, type ConfigOperationResult } from '../configuration-manager'
import { useAppStore } from '../../stores/app-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { AppConfig } from '../../../../types'

// Mock the stores
jest.mock('../../stores/app-store')
jest.mock('../../stores/workspace-store')

const mockAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>
const mockWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>

describe('ConfigurationManager', () => {
  let manager: ConfigurationManager
  let mockAppStoreState: any
  let mockWorkspaceStoreState: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Create fresh manager instance for each test
    manager = new ConfigurationManager()
    
    // Setup mock store states
    mockAppStoreState = {
      config: {
        geminiKey: 'test-api-key',
        language: 'zh',
        inputFile: '/test/input.mp4',
        outputFile: '/test/output.srt',
        priority: 'balanced'
      },
      updateConfig: jest.fn(),
      isInitialized: true
    }
    
    mockWorkspaceStoreState = {
      currentWorkspace: {
        id: 'workspace-123',
        name: 'Test Workspace',
        config: {
          language: 'zh',
          inputFile: '/test/input.mp4'
        }
      },
      availableWorkspaces: [],
      setStepConfig: jest.fn(),
      getStepConfig: jest.fn(),
      resetStepConfig: jest.fn(),
      isInitialized: true
    }
    
    // Configure mock implementations
    mockAppStore.mockReturnValue(mockAppStoreState)
    mockAppStore.getState = jest.fn().mockReturnValue(mockAppStoreState)
    
    mockWorkspaceStore.mockReturnValue(mockWorkspaceStoreState)
    mockWorkspaceStore.getState = jest.fn().mockReturnValue(mockWorkspaceStoreState)
    mockWorkspaceStore.subscribe = jest.fn()
  })

  describe('Config Key Categorization and Routing', () => {
    test('should route workspace-specific keys to workspace store', async () => {
      const result = await manager.setConfig('inputFile', '/new/input.mp4')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('workspace')
      expect(result.workspaceId).toBe('workspace-123')
      expect(mockAppStoreState.updateConfig).toHaveBeenCalledWith('inputFile', '/new/input.mp4')
    })

    test('should route global keys to app store', async () => {
      const result = await manager.setConfig('geminiKey', 'new-api-key')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('app')
      expect(mockAppStoreState.updateConfig).toHaveBeenCalledWith('geminiKey', 'new-api-key')
    })

    test('should route unknown keys to both stores', async () => {
      const result = await manager.setConfig('unknownKey' as keyof AppConfig, 'value')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('both')
      expect(mockAppStoreState.updateConfig).toHaveBeenCalledWith('unknownKey', 'value')
    })

    test('should categorize all workspace-specific keys correctly', () => {
      const workspaceKeys = [
        'inputFile', 'outputFile', 'language', 'model', 'priority', 
        'speakers', 'written', 'music', 'charset', 'noGeminiRefinement',
        'maxChunkDuration', 'videoQuality', 'terminologyConfig', 
        'subtitle', 'duration', 'verbose', 'startTime', 'endTime', 'importedJsonFile'
      ]
      
      workspaceKeys.forEach(key => {
        const targetStore = (manager as any).determineTargetStore(key)
        expect(targetStore).toBe('workspace')
      })
    })

    test('should categorize all global keys correctly', () => {
      const globalKeys = ['geminiKey', 'hfToken', 'ffmpegPath']
      
      globalKeys.forEach(key => {
        const targetStore = (manager as any).determineTargetStore(key)
        expect(targetStore).toBe('app')
      })
    })
  })

  describe('Workspace Transition Handling', () => {
    test('should block config updates during workspace transition', async () => {
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const result = await manager.setConfig('language', 'en')
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('transitioning')
    })

    test('should allow forced updates during workspace transition', async () => {
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const result = await manager.setConfig('language', 'en', { forceUpdate: true })
      
      expect(result.success).toBe(true)
      expect(mockAppStoreState.updateConfig).toHaveBeenCalledWith('language', 'en')
    })

    test('should timeout workspace transitions and allow updates', async () => {
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      // Mock transition timeout
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // transition start
        .mockReturnValueOnce(7000) // check time (6 seconds later, past 5s timeout)
      
      const result = await manager.setConfig('language', 'en')
      
      expect(result.success).toBe(true)
      expect(mockAppStoreState.updateConfig).toHaveBeenCalledWith('language', 'en')
    })

    test('should clear transition state on completion', () => {
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      expect(manager.isReady()).toBe(false)
      
      manager.onWorkspaceTransitionComplete()
      expect(manager.isReady()).toBe(true)
    })

    test('should clear transition state on error', () => {
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      expect(manager.isReady()).toBe(false)
      
      manager.onWorkspaceTransitionError(new Error('Transition failed'))
      expect(manager.isReady()).toBe(true)
    })

    test('should prefer target workspace config during transition', async () => {
      mockWorkspaceStoreState.currentWorkspace.config.language = 'en'
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const result = await manager.getConfig('language')
      
      expect(result).toBe('en')
    })
  })

  describe('Workspace Context Requirements', () => {
    test('should fail workspace-specific config when no workspace is active', async () => {
      mockWorkspaceStoreState.currentWorkspace = null
      
      const result = await manager.setConfig('inputFile', '/test/file.mp4')
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('No active workspace')
    })

    test('should succeed with global config when no workspace is active', async () => {
      mockWorkspaceStoreState.currentWorkspace = null
      
      const result = await manager.setConfig('geminiKey', 'new-key')
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('app')
    })

    test('should fail step config operations when no workspace is active', async () => {
      mockWorkspaceStoreState.currentWorkspace = null
      
      const result = await manager.setStepConfig('step-1' as any, { enabled: true })
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('No active workspace')
    })
  })

  describe('Configuration Validation', () => {
    test('should validate language values', async () => {
      const result = await manager.setConfig('language', 'invalid-lang' as any)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('validation failed')
      expect(result.error?.message).toContain('Invalid language code')
    })

    test('should validate priority values', async () => {
      const result = await manager.setConfig('priority', 'invalid-priority' as any)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('validation failed')
      expect(result.error?.message).toContain('Invalid priority')
    })

    test('should validate charset values', async () => {
      const result = await manager.setConfig('charset', 'invalid-charset' as any)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('validation failed')
      expect(result.error?.message).toContain('Invalid charset')
    })

    test('should validate videoQuality values', async () => {
      const result = await manager.setConfig('videoQuality', '1080p' as any)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('validation failed')
      expect(result.error?.message).toContain('Invalid video quality')
    })

    test('should validate maxChunkDuration range', async () => {
      const resultTooLow = await manager.setConfig('maxChunkDuration', 0)
      expect(resultTooLow.success).toBe(false)
      expect(resultTooLow.error?.message).toContain('between 1 and 60')
      
      const resultTooHigh = await manager.setConfig('maxChunkDuration', 61)
      expect(resultTooHigh.success).toBe(false)
      expect(resultTooHigh.error?.message).toContain('between 1 and 60')
    })

    test('should validate negative duration', async () => {
      const result = await manager.setConfig('duration', -100)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('cannot be negative')
    })

    test('should allow valid values', async () => {
      const validConfigs = [
        { key: 'language' as const, value: 'zh' },
        { key: 'priority' as const, value: 'speed' },
        { key: 'charset' as const, value: 'traditional' },
        { key: 'videoQuality' as const, value: '720p' },
        { key: 'maxChunkDuration' as const, value: 30 },
        { key: 'duration' as const, value: 3600 }
      ]
      
      for (const config of validConfigs) {
        const result = await manager.setConfig(config.key, config.value)
        expect(result.success).toBe(true)
      }
    })

    test('should skip validation when requested', async () => {
      const result = await manager.setConfig('language', 'invalid-lang' as any, { skipValidation: true })
      
      expect(result.success).toBe(true)
      expect(mockAppStoreState.updateConfig).toHaveBeenCalledWith('language', 'invalid-lang')
    })

    test('should reject undefined values', async () => {
      const result = await manager.setConfig('language', undefined as any)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('cannot be undefined')
    })
  })

  describe('Step Configuration Management', () => {
    test('should set step configuration successfully', async () => {
      mockWorkspaceStoreState.setStepConfig.mockResolvedValue(undefined)
      
      const stepConfig = { enabled: true, mode: 'advanced' }
      const result = await manager.setStepConfig('step-1' as any, stepConfig)
      
      expect(result.success).toBe(true)
      expect(result.targetStore).toBe('workspace')
      expect(result.workspaceId).toBe('workspace-123')
      expect(mockWorkspaceStoreState.setStepConfig).toHaveBeenCalledWith(
        'workspace-123',
        'step-1',
        stepConfig,
        {
          merge: true,
          skipValidation: false,
          skipCache: false,
          createBackup: false
        }
      )
    })

    test('should create backup for critical priority step config', async () => {
      mockWorkspaceStoreState.setStepConfig.mockResolvedValue(undefined)
      
      const stepConfig = { enabled: true }
      const result = await manager.setStepConfig('step-1' as any, stepConfig, { priority: 'critical' })
      
      expect(result.success).toBe(true)
      expect(mockWorkspaceStoreState.setStepConfig).toHaveBeenCalledWith(
        'workspace-123',
        'step-1',
        stepConfig,
        expect.objectContaining({ createBackup: true })
      )
    })

    test('should get step configuration successfully', async () => {
      const mockStepConfig = { enabled: true, mode: 'simple' }
      mockWorkspaceStoreState.getStepConfig.mockResolvedValue(mockStepConfig)
      
      const result = await manager.getStepConfig('step-1' as any)
      
      expect(result).toEqual(mockStepConfig)
      expect(mockWorkspaceStoreState.getStepConfig).toHaveBeenCalledWith('workspace-123', 'step-1')
    })

    test('should handle step configuration errors', async () => {
      const stepError = new Error('Step config failed')
      mockWorkspaceStoreState.setStepConfig.mockRejectedValue(stepError)
      
      const result = await manager.setStepConfig('step-1' as any, { enabled: true })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(stepError)
      expect(result.targetStore).toBe('workspace')
    })

    test('should block step config during workspace transition', async () => {
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const result = await manager.setStepConfig('step-1' as any, { enabled: true })
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('transitioning')
    })
  })

  describe('Error Handling and Recovery', () => {
    test('should handle store operation errors gracefully', async () => {
      const storeError = new Error('Store operation failed')
      mockAppStoreState.updateConfig.mockImplementation(() => {
        throw storeError
      })
      
      const result = await manager.setConfig('language', 'zh')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(storeError)
      expect(result.rollbackAvailable).toBe(false)
    })

    test('should provide detailed error context', async () => {
      const result = await manager.setConfig('language', 'invalid-lang' as any)
      
      expect(result.success).toBe(false)
      expect(result.targetStore).toBe('workspace')
      expect(result.workspaceId).toBe('workspace-123')
      expect(result.error).toBeInstanceOf(Error)
    })

    test('should log errors appropriately', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      await manager.setConfig('language', 'invalid-lang' as any)
      
      expect(consoleSpy).toHaveBeenCalledWith('Configuration update failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('System State and Context', () => {
    test('should report ready state correctly', () => {
      expect(manager.isReady()).toBe(true)
      
      // Test with uninitialized app store
      mockAppStoreState.isInitialized = false
      expect(manager.isReady()).toBe(false)
      
      // Test with uninitialized workspace store
      mockAppStoreState.isInitialized = true
      mockWorkspaceStoreState.isInitialized = false
      expect(manager.isReady()).toBe(false)
      
      // Test during transition
      mockWorkspaceStoreState.isInitialized = true
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      expect(manager.isReady()).toBe(false)
    })

    test('should provide comprehensive workspace context', () => {
      const context = manager.getWorkspaceContext()
      
      expect(context).toEqual({
        currentWorkspaceId: 'workspace-123',
        hasWorkspaces: false, // Empty availableWorkspaces array in mock
        isTransitioning: false,
        isReady: true,
        appInitialized: true,
        workspaceInitialized: true
      })
    })

    test('should handle null workspace in context', () => {
      mockWorkspaceStoreState.currentWorkspace = null
      
      const context = manager.getWorkspaceContext()
      
      expect(context.currentWorkspaceId).toBe(null)
      expect(context.isReady).toBe(true)
    })
  })

  describe('Configuration Options and Behavior', () => {
    test('should respect merge option for config updates', async () => {
      const result = await manager.setConfig('language', 'zh', { merge: false })
      
      expect(result.success).toBe(true)
      expect(mockAppStoreState.updateConfig).toHaveBeenCalledWith('language', 'zh')
    })

    test('should handle different priority levels', async () => {
      const priorities: Array<'critical' | 'normal' | 'low'> = ['critical', 'normal', 'low']
      
      for (const priority of priorities) {
        const result = await manager.setConfig('language', 'zh', { priority })
        expect(result.success).toBe(true)
      }
    })

    test('should handle config retrieval during normal operation', async () => {
      const result = await manager.getConfig('language')
      
      expect(result).toBe('zh')
    })

    test('should return correct config during transition', async () => {
      mockWorkspaceStoreState.currentWorkspace.config.language = 'en'
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const result = await manager.getConfig('language')
      
      expect(result).toBe('en') // Should prefer workspace config during transition
    })

    test('should fall back to app store for non-workspace keys during transition', async () => {
      manager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      const result = await manager.getConfig('geminiKey')
      
      expect(result).toBe('test-api-key') // Should get from app store
    })
  })

  describe('Singleton Behavior', () => {
    test('should export singleton instance', () => {
      expect(configurationManager).toBeInstanceOf(ConfigurationManager)
    })

    test('should maintain state across operations', async () => {
      configurationManager.onWorkspaceTransitionStart('workspace-123', 'workspace-456')
      
      expect(configurationManager.isReady()).toBe(false)
      
      configurationManager.onWorkspaceTransitionComplete()
      
      expect(configurationManager.isReady()).toBe(true)
    })
  })
})

describe('Configuration Manager Integration', () => {
  test('should handle realistic configuration workflow', async () => {
    const manager = new ConfigurationManager()
    
    // Setup realistic store states
    const appStoreState = {
      config: { geminiKey: 'test-key', language: 'zh' },
      updateConfig: jest.fn(),
      isInitialized: true
    }
    
    const workspaceStoreState = {
      currentWorkspace: { id: 'workspace-123', config: {} },
      setStepConfig: jest.fn().mockResolvedValue(undefined),
      getStepConfig: jest.fn().mockResolvedValue({ enabled: true }),
      isInitialized: true
    }
    
    mockAppStore.getState = jest.fn().mockReturnValue(appStoreState)
    mockWorkspaceStore.getState = jest.fn().mockReturnValue(workspaceStoreState)
    
    // Test workflow: update global config, then workspace config, then step config
    const globalResult = await manager.setConfig('geminiKey', 'new-key')
    expect(globalResult.success).toBe(true)
    expect(globalResult.targetStore).toBe('app')
    
    const workspaceResult = await manager.setConfig('language', 'en')
    expect(workspaceResult.success).toBe(true)
    expect(workspaceResult.targetStore).toBe('workspace')
    
    const stepResult = await manager.setStepConfig('processing' as any, { mode: 'advanced' })
    expect(stepResult.success).toBe(true)
    expect(stepResult.targetStore).toBe('workspace')
    
    // Verify all calls were made correctly
    expect(appStoreState.updateConfig).toHaveBeenCalledTimes(3) // All config updates go through app store
    expect(workspaceStoreState.setStepConfig).toHaveBeenCalledTimes(1)
  })
})