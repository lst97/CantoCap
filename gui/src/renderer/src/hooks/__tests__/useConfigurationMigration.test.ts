/**
 * useConfigurationMigration Hook Tests
 * 
 * Tests for the configuration migration hook covering:
 * - Migration between legacy and new patterns
 * - Smart fallback mechanisms
 * - Migration status tracking
 * - Automatic fallback behavior
 */

import { renderHook, act } from '@testing-library/react'
import { useConfigurationMigration, useSmartConfig } from '../useConfigurationMigration'
import { useAppStore } from '../../stores/app-store'
import { useEnhancedWorkspaceConfig, useUnifiedConfig } from '../../contexts/EnhancedWorkspaceConfigContext'
import type { ConfigOperationResult } from '../../services/configuration-manager'

// Mock dependencies
jest.mock('../../stores/app-store')
jest.mock('../../contexts/EnhancedWorkspaceConfigContext')

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>
const mockUseEnhancedWorkspaceConfig = useEnhancedWorkspaceConfig as jest.MockedFunction<typeof useEnhancedWorkspaceConfig>
const mockUseUnifiedConfig = useUnifiedConfig as jest.MockedFunction<typeof useUnifiedConfig>

describe('useConfigurationMigration Hook', () => {
  let mockAppStore: any
  let mockEnhancedConfig: any
  let mockUnifiedConfig: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockAppStore = {
      config: {
        geminiKey: 'test-api-key',
        language: 'zh',
        inputFile: '/test/input.mp4'
      },
      updateConfig: jest.fn()
    }
    
    mockEnhancedConfig = {
      isWorkspaceReady: true,
      hasWorkspaces: true,
      workspaceContext: {
        isTransitioning: false,
        isReady: true,
        hasActiveWorkspace: true
      }
    }
    
    mockUnifiedConfig = {
      setValue: jest.fn().mockResolvedValue({ success: true, targetStore: 'workspace' }),
      getValue: jest.fn().mockResolvedValue('zh'),
      validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      isReady: true,
      error: null,
      clearError: jest.fn()
    }
    
    mockUseAppStore.mockReturnValue(mockAppStore)
    mockUseEnhancedWorkspaceConfig.mockReturnValue(mockEnhancedConfig)
    mockUseUnifiedConfig.mockReturnValue(mockUnifiedConfig)
  })

  describe('Migration Status Detection', () => {
    test('should recommend centralized config when workspace is ready', () => {
      const { result } = renderHook(() => useConfigurationMigration())
      
      const status = result.current.migration.checkStatus()
      
      expect(status).toMatchObject({
        canMigrate: true,
        isReady: true,
        hasWorkspaces: true,
        workspaceContext: expect.any(Object),
        recommendations: {
          useUnifiedConfig: true,
          useLegacyFallback: false,
          requiresWorkspaceSetup: false
        }
      })
    })

    test('should recommend legacy fallback when workspace not ready', () => {
      mockEnhancedConfig.isWorkspaceReady = false
      
      const { result } = renderHook(() => useConfigurationMigration())
      
      const status = result.current.migration.checkStatus()
      
      expect(status).toMatchObject({
        canMigrate: false,
        isReady: false,
        hasWorkspaces: true,
        recommendations: {
          useUnifiedConfig: false,
          useLegacyFallback: true,
          requiresWorkspaceSetup: false
        }
      })
    })

    test('should recommend workspace setup when no workspaces exist', () => {
      mockEnhancedConfig.hasWorkspaces = false
      
      const { result } = renderHook(() => useConfigurationMigration())
      
      const status = result.current.migration.checkStatus()
      
      expect(status).toMatchObject({
        canMigrate: false,
        isReady: true,
        hasWorkspaces: false,
        recommendations: {
          useUnifiedConfig: false,
          useLegacyFallback: true,
          requiresWorkspaceSetup: true
        }
      })
    })

    test('should reflect unified config readiness state', () => {
      mockUnifiedConfig.isReady = false
      
      const { result } = renderHook(() => useConfigurationMigration())
      
      expect(result.current.migration.isReady).toBe(false)
    })

    test('should expose unified config error state', () => {
      const configError = new Error('Configuration error')
      mockUnifiedConfig.error = configError
      
      const { result } = renderHook(() => useConfigurationMigration())
      
      expect(result.current.migration.error).toBe(configError)
    })
  })

  describe('Legacy Configuration API', () => {
    test('should provide legacy update config with deprecation warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const { result } = renderHook(() => useConfigurationMigration())
      
      result.current.legacy.updateConfig('language', 'en')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MIGRATION] Component is using legacy updateConfig')
      )
      expect(mockAppStore.updateConfig).toHaveBeenCalledWith('language', 'en')
      
      consoleSpy.mockRestore()
    })

    test('should provide legacy config getter', () => {
      const { result } = renderHook(() => useConfigurationMigration())
      
      const config = result.current.legacy.getConfig()
      
      expect(config).toBe(mockAppStore.config)
    })

    test('should show specific key in deprecation warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const { result } = renderHook(() => useConfigurationMigration())
      
      result.current.legacy.updateConfig('geminiKey', 'new-key')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("legacy updateConfig for 'geminiKey'")
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Centralized Configuration API', () => {
    test('should delegate to unified config for updates', async () => {
      const { result } = renderHook(() => useConfigurationMigration())
      
      const options = { skipValidation: true }
      
      await act(async () => {
        await result.current.centralized.updateConfig('language', 'en', options)
      })
      
      expect(mockUnifiedConfig.setValue).toHaveBeenCalledWith('language', 'en', options)
    })

    test('should delegate to unified config for retrieval', async () => {
      const { result } = renderHook(() => useConfigurationMigration())
      
      await act(async () => {
        const value = await result.current.centralized.getConfig('language')
        expect(value).toBe('zh')
      })
      
      expect(mockUnifiedConfig.getValue).toHaveBeenCalledWith('language')
    })

    test('should delegate validation to unified config', () => {
      const { result } = renderHook(() => useConfigurationMigration())
      
      const validationResult = result.current.centralized.validateConfig('language', 'zh')
      
      expect(validationResult).toEqual({ isValid: true, errors: [] })
      expect(mockUnifiedConfig.validateConfig).toHaveBeenCalledWith('language', 'zh')
    })
  })

  describe('Migration Utilities', () => {
    test('should provide migration utilities', () => {
      const { result } = renderHook(() => useConfigurationMigration())
      
      expect(result.current.migration).toMatchObject({
        checkStatus: expect.any(Function),
        isReady: true,
        error: null,
        clearError: expect.any(Function)
      })
    })

    test('should delegate error clearing to unified config', () => {
      const { result } = renderHook(() => useConfigurationMigration())
      
      result.current.migration.clearError()
      
      expect(mockUnifiedConfig.clearError).toHaveBeenCalled()
    })

    test('should update status when enhanced config changes', () => {
      const { result, rerender } = renderHook(() => useConfigurationMigration())
      
      let status = result.current.migration.checkStatus()
      expect(status.canMigrate).toBe(true)
      
      mockEnhancedConfig.isWorkspaceReady = false
      rerender()
      
      status = result.current.migration.checkStatus()
      expect(status.canMigrate).toBe(false)
    })
  })
})

describe('useSmartConfig Hook', () => {
  let mockAppStore: any
  let mockEnhancedConfig: any
  let mockUnifiedConfig: any
  let mockMigration: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockAppStore = {
      config: { language: 'zh', geminiKey: 'test-key' },
      updateConfig: jest.fn()
    }
    
    mockEnhancedConfig = {
      isWorkspaceReady: true,
      hasWorkspaces: true,
      workspaceContext: {
        isTransitioning: false,
        isReady: true,
        hasActiveWorkspace: true
      }
    }
    
    mockUnifiedConfig = {
      setValue: jest.fn().mockResolvedValue({ success: true, targetStore: 'workspace' }),
      getValue: jest.fn().mockResolvedValue('zh'),
      validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      isReady: true,
      error: null,
      clearError: jest.fn()
    }
    
    // Mock the migration hook to return our mock functions
    mockMigration = {
      legacy: {
        updateConfig: jest.fn(),
        getConfig: jest.fn().mockReturnValue(mockAppStore.config)
      },
      centralized: {
        updateConfig: mockUnifiedConfig.setValue,
        getConfig: mockUnifiedConfig.getValue,
        validateConfig: mockUnifiedConfig.validateConfig
      },
      migration: {
        checkStatus: jest.fn().mockReturnValue({
          canMigrate: true,
          isReady: true,
          hasWorkspaces: true,
          workspaceContext: mockEnhancedConfig.workspaceContext,
          recommendations: {
            useUnifiedConfig: true,
            useLegacyFallback: false,
            requiresWorkspaceSetup: false
          }
        })
      }
    }
    
    mockUseAppStore.mockReturnValue(mockAppStore)
    mockUseEnhancedWorkspaceConfig.mockReturnValue(mockEnhancedConfig)
    mockUseUnifiedConfig.mockReturnValue(mockUnifiedConfig)
    
    // Mock the useConfigurationMigration hook
    jest.doMock('../useConfigurationMigration', () => ({
      useConfigurationMigration: () => mockMigration,
      useSmartConfig: jest.requireActual('../useConfigurationMigration').useSmartConfig
    }))
  })

  describe('Automatic Configuration Method Selection', () => {
    test('should use centralized config when recommended', async () => {
      const { result } = renderHook(() => useSmartConfig())
      
      await act(async () => {
        const updateResult = await result.current.updateConfig('language', 'en')
        expect(updateResult.success).toBe(true)
      })
      
      expect(mockUnifiedConfig.setValue).toHaveBeenCalledWith('language', 'en', undefined)
      expect(mockMigration.legacy.updateConfig).not.toHaveBeenCalled()
    })

    test('should use legacy config when centralized not recommended', async () => {
      mockMigration.migration.checkStatus.mockReturnValue({
        canMigrate: false,
        isReady: false,
        hasWorkspaces: false,
        workspaceContext: mockEnhancedConfig.workspaceContext,
        recommendations: {
          useUnifiedConfig: false,
          useLegacyFallback: true,
          requiresWorkspaceSetup: true
        }
      })
      
      const { result } = renderHook(() => useSmartConfig())
      
      await act(async () => {
        const updateResult = await result.current.updateConfig('language', 'en')
        expect(updateResult.success).toBe(true)
        expect(updateResult.targetStore).toBe('app')
      })
      
      expect(mockMigration.legacy.updateConfig).toHaveBeenCalledWith('language', 'en')
      expect(mockUnifiedConfig.setValue).not.toHaveBeenCalled()
    })

    test('should handle config updates with options', async () => {
      const { result } = renderHook(() => useSmartConfig())
      
      const options = { skipValidation: true, priority: 'critical' as const }
      
      await act(async () => {
        await result.current.updateConfig('geminiKey', 'new-key', options)
      })
      
      expect(mockUnifiedConfig.setValue).toHaveBeenCalledWith('geminiKey', 'new-key', options)
    })

    test('should fall back gracefully when centralized config fails', async () => {
      mockUnifiedConfig.setValue.mockRejectedValue(new Error('Centralized config failed'))
      
      // Mock console.warn to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const { result } = renderHook(() => useSmartConfig())
      
      await expect(act(async () => {
        await result.current.updateConfig('language', 'en')
      })).rejects.toThrow('Centralized config failed')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Configuration Retrieval', () => {
    test('should use centralized retrieval when recommended', async () => {
      const { result } = renderHook(() => useSmartConfig())
      
      await act(async () => {
        const value = await result.current.getConfig('language')
        expect(value).toBe('zh')
      })
      
      expect(mockUnifiedConfig.getValue).toHaveBeenCalledWith('language')
    })

    test('should use legacy retrieval when centralized not recommended', async () => {
      mockMigration.migration.checkStatus.mockReturnValue({
        canMigrate: false,
        isReady: false,
        hasWorkspaces: false,
        workspaceContext: mockEnhancedConfig.workspaceContext,
        recommendations: {
          useUnifiedConfig: false,
          useLegacyFallback: true,
          requiresWorkspaceSetup: true
        }
      })
      
      const { result } = renderHook(() => useSmartConfig())
      
      await act(async () => {
        const value = await result.current.getConfig('language')
        expect(value).toBe('zh')
      })
      
      expect(mockMigration.legacy.getConfig).toHaveBeenCalled()
    })

    test('should handle retrieval errors gracefully', async () => {
      mockUnifiedConfig.getValue.mockRejectedValue(new Error('Retrieval failed'))
      
      const { result } = renderHook(() => useSmartConfig())
      
      await expect(act(async () => {
        await result.current.getConfig('language')
      })).rejects.toThrow('Retrieval failed')
    })
  })

  describe('Status and Context Information', () => {
    test('should expose migration status', () => {
      const { result } = renderHook(() => useSmartConfig())
      
      expect(result.current.migrationStatus).toMatchObject({
        canMigrate: true,
        isReady: true,
        hasWorkspaces: true,
        workspaceContext: expect.any(Object),
        recommendations: expect.any(Object)
      })
    })

    test('should expose workspace context', () => {
      const { result } = renderHook(() => useSmartConfig())
      
      expect(result.current.workspaceContext).toEqual({
        isTransitioning: false,
        isReady: true,
        hasActiveWorkspace: true
      })
    })

    test('should reflect readiness from enhanced config', () => {
      const { result } = renderHook(() => useSmartConfig())
      
      expect(result.current.isReady).toBe(true)
    })

    test('should update when migration status changes', () => {
      const { result, rerender } = renderHook(() => useSmartConfig())
      
      expect(result.current.migrationStatus.canMigrate).toBe(true)
      
      mockMigration.migration.checkStatus.mockReturnValue({
        canMigrate: false,
        isReady: false,
        hasWorkspaces: false,
        workspaceContext: mockEnhancedConfig.workspaceContext,
        recommendations: {
          useUnifiedConfig: false,
          useLegacyFallback: true,
          requiresWorkspaceSetup: true
        }
      })
      
      rerender()
      
      expect(result.current.migrationStatus.canMigrate).toBe(false)
    })
  })

  describe('Consistent Function References', () => {
    test('should maintain stable function references', () => {
      const { result, rerender } = renderHook(() => useSmartConfig())
      
      const initialFunctions = {
        updateConfig: result.current.updateConfig,
        getConfig: result.current.getConfig
      }
      
      rerender()
      
      expect(result.current.updateConfig).toBe(initialFunctions.updateConfig)
      expect(result.current.getConfig).toBe(initialFunctions.getConfig)
    })

    test('should update functions when migration strategy changes', async () => {
      const { result, rerender } = renderHook(() => useSmartConfig())
      
      // Initially should use centralized
      await act(async () => {
        await result.current.updateConfig('language', 'en')
      })
      expect(mockUnifiedConfig.setValue).toHaveBeenCalled()
      
      // Change to legacy fallback
      mockMigration.migration.checkStatus.mockReturnValue({
        canMigrate: false,
        isReady: false,
        hasWorkspaces: false,
        workspaceContext: mockEnhancedConfig.workspaceContext,
        recommendations: {
          useUnifiedConfig: false,
          useLegacyFallback: true,
          requiresWorkspaceSetup: true
        }
      })
      
      rerender()
      
      // Should now use legacy
      await act(async () => {
        await result.current.updateConfig('priority', 'speed')
      })
      expect(mockMigration.legacy.updateConfig).toHaveBeenCalledWith('priority', 'speed')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle mixed migration states gracefully', async () => {
      // Set up a scenario where migration status is inconsistent
      mockMigration.migration.checkStatus.mockReturnValue({
        canMigrate: true,
        isReady: false, // Inconsistent state
        hasWorkspaces: true,
        workspaceContext: mockEnhancedConfig.workspaceContext,
        recommendations: {
          useUnifiedConfig: true,
          useLegacyFallback: false,
          requiresWorkspaceSetup: false
        }
      })
      
      const { result } = renderHook(() => useSmartConfig())
      
      // Should still attempt to use centralized based on recommendations
      await act(async () => {
        await result.current.updateConfig('language', 'en')
      })
      
      expect(mockUnifiedConfig.setValue).toHaveBeenCalled()
    })

    test('should handle undefined configuration values', async () => {
      const { result } = renderHook(() => useSmartConfig())
      
      await act(async () => {
        await result.current.updateConfig('inputFile', undefined as any)
      })
      
      expect(mockUnifiedConfig.setValue).toHaveBeenCalledWith('inputFile', undefined, undefined)
    })

    test('should handle rapid migration status changes', async () => {
      const { result, rerender } = renderHook(() => useSmartConfig())
      
      // Start with centralized
      let statusCall = 0
      mockMigration.migration.checkStatus.mockImplementation(() => {
        statusCall++
        return statusCall % 2 === 1 ? {
          canMigrate: true,
          isReady: true,
          hasWorkspaces: true,
          workspaceContext: mockEnhancedConfig.workspaceContext,
          recommendations: { useUnifiedConfig: true, useLegacyFallback: false, requiresWorkspaceSetup: false }
        } : {
          canMigrate: false,
          isReady: false,
          hasWorkspaces: false,
          workspaceContext: mockEnhancedConfig.workspaceContext,
          recommendations: { useUnifiedConfig: false, useLegacyFallback: true, requiresWorkspaceSetup: true }
        }
      })
      
      // First call - should use centralized
      await act(async () => {
        await result.current.updateConfig('language', 'en')
      })
      expect(mockUnifiedConfig.setValue).toHaveBeenCalledWith('language', 'en', undefined)
      
      rerender()
      
      // Second call - should use legacy
      await act(async () => {
        await result.current.updateConfig('priority', 'speed')
      })
      expect(mockMigration.legacy.updateConfig).toHaveBeenCalledWith('priority', 'speed')
    })
  })
})