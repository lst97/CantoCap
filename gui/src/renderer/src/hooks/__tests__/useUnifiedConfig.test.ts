/**
 * useUnifiedConfig Hook Tests
 * 
 * Focused unit tests for the useUnifiedConfig hook covering:
 * - Hook behavior with different workspace states
 * - Loading states and error handling
 * - Configuration updates and retrieval
 * - Integration with ConfigurationManager
 */

import { renderHook, act } from '@testing-library/react'
import { useUnifiedConfig } from '../../contexts/EnhancedWorkspaceConfigContext'
import { useEnhancedWorkspaceConfig } from '../../contexts/EnhancedWorkspaceConfigContext'
import type { ConfigOperationResult } from '../../services/configuration-manager'

// Mock the enhanced workspace config context
jest.mock('../../contexts/EnhancedWorkspaceConfigContext', () => ({
  ...jest.requireActual('../../contexts/EnhancedWorkspaceConfigContext'),
  useEnhancedWorkspaceConfig: jest.fn()
}))

const mockUseEnhancedWorkspaceConfig = useEnhancedWorkspaceConfig as jest.MockedFunction<typeof useEnhancedWorkspaceConfig>

describe('useUnifiedConfig Hook', () => {
  let mockEnhancedConfig: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockEnhancedConfig = {
      setConfig: jest.fn(),
      getConfig: jest.fn(),
      isWorkspaceReady: true,
      workspaceContext: {
        isTransitioning: false,
        isReady: true,
        hasActiveWorkspace: true
      },
      validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      lastError: null,
      clearError: jest.fn()
    }
    
    mockUseEnhancedWorkspaceConfig.mockReturnValue(mockEnhancedConfig)
  })

  describe('Hook Initialization', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useUnifiedConfig())
      
      expect(result.current).toMatchObject({
        setValue: expect.any(Function),
        getValue: expect.any(Function),
        validateConfig: expect.any(Function),
        isLoading: false,
        isReady: true,
        error: null,
        clearError: expect.any(Function),
        workspaceContext: expect.any(Object)
      })
    })

    test('should reflect workspace readiness state', () => {
      mockEnhancedConfig.isWorkspaceReady = false
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      expect(result.current.isReady).toBe(false)
    })

    test('should include workspace context information', () => {
      const { result } = renderHook(() => useUnifiedConfig())
      
      expect(result.current.workspaceContext).toEqual({
        isTransitioning: false,
        isReady: true,
        hasActiveWorkspace: true
      })
    })
  })

  describe('Configuration Value Setting', () => {
    test('should handle successful value updates', async () => {
      const successResult: ConfigOperationResult = {
        success: true,
        targetStore: 'workspace',
        workspaceId: 'workspace-123'
      }
      mockEnhancedConfig.setConfig.mockResolvedValue(successResult)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      let updateResult: ConfigOperationResult
      
      await act(async () => {
        updateResult = await result.current.setValue('language', 'en')
      })
      
      expect(updateResult!).toEqual(successResult)
      expect(mockEnhancedConfig.setConfig).toHaveBeenCalledWith('language', 'en', undefined)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    test('should handle value updates with options', async () => {
      const successResult: ConfigOperationResult = {
        success: true,
        targetStore: 'app'
      }
      mockEnhancedConfig.setConfig.mockResolvedValue(successResult)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      const options = { skipValidation: true, priority: 'critical' as const }
      
      await act(async () => {
        await result.current.setValue('geminiKey', 'new-key', options)
      })
      
      expect(mockEnhancedConfig.setConfig).toHaveBeenCalledWith('geminiKey', 'new-key', options)
    })

    test('should manage loading state during updates', async () => {
      let resolveUpdate: (value: ConfigOperationResult) => void
      const updatePromise = new Promise<ConfigOperationResult>((resolve) => {
        resolveUpdate = resolve
      })
      mockEnhancedConfig.setConfig.mockReturnValue(updatePromise)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      // Start update
      let updatePromiseResult: Promise<ConfigOperationResult>
      act(() => {
        updatePromiseResult = result.current.setValue('language', 'en')
      })
      
      // Should be loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBe(null)
      
      // Complete update
      await act(async () => {
        resolveUpdate!({ success: true, targetStore: 'workspace' })
        await updatePromiseResult
      })
      
      // Should no longer be loading
      expect(result.current.isLoading).toBe(false)
    })

    test('should handle update errors', async () => {
      const updateError = new Error('Configuration update failed')
      const errorResult: ConfigOperationResult = {
        success: false,
        targetStore: 'workspace',
        error: updateError
      }
      mockEnhancedConfig.setConfig.mockResolvedValue(errorResult)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      await expect(act(async () => {
        await result.current.setValue('language', 'invalid-lang')
      })).rejects.toThrow('Configuration update failed')
      
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(updateError)
    })

    test('should handle promise rejection during updates', async () => {
      const rejectionError = new Error('Promise rejected')
      mockEnhancedConfig.setConfig.mockRejectedValue(rejectionError)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      await expect(act(async () => {
        await result.current.setValue('language', 'en')
      })).rejects.toThrow('Promise rejected')
      
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(rejectionError)
    })

    test('should prevent updates when workspace not ready', async () => {
      mockEnhancedConfig.isWorkspaceReady = false
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      await expect(act(async () => {
        await result.current.setValue('language', 'en')
      })).rejects.toThrow('Workspace not ready')
      
      expect(mockEnhancedConfig.setConfig).not.toHaveBeenCalled()
    })
  })

  describe('Configuration Value Retrieval', () => {
    test('should handle successful value retrieval', async () => {
      mockEnhancedConfig.getConfig.mockResolvedValue('zh')
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      let retrievedValue: string
      
      await act(async () => {
        retrievedValue = await result.current.getValue('language')
      })
      
      expect(retrievedValue!).toBe('zh')
      expect(mockEnhancedConfig.getConfig).toHaveBeenCalledWith('language')
    })

    test('should handle retrieval errors', async () => {
      const retrievalError = new Error('Failed to retrieve configuration')
      mockEnhancedConfig.getConfig.mockRejectedValue(retrievalError)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      await expect(act(async () => {
        await result.current.getValue('language')
      })).rejects.toThrow('Failed to retrieve configuration')
      
      expect(result.current.error).toBe(retrievalError)
    })

    test('should prevent retrieval when workspace not ready', async () => {
      mockEnhancedConfig.isWorkspaceReady = false
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      await expect(act(async () => {
        await result.current.getValue('language')
      })).rejects.toThrow('Workspace not ready')
      
      expect(mockEnhancedConfig.getConfig).not.toHaveBeenCalled()
    })
  })

  describe('Validation Operations', () => {
    test('should delegate validation to enhanced config', () => {
      const validationResult = { isValid: true, errors: [] }
      mockEnhancedConfig.validateConfig.mockReturnValue(validationResult)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      const validationOutput = result.current.validateConfig('language', 'zh')
      
      expect(validationOutput).toEqual(validationResult)
      expect(mockEnhancedConfig.validateConfig).toHaveBeenCalledWith('language', 'zh')
    })

    test('should handle validation errors', () => {
      const validationResult = { 
        isValid: false, 
        errors: ['Invalid language code'] 
      }
      mockEnhancedConfig.validateConfig.mockReturnValue(validationResult)
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      const validationOutput = result.current.validateConfig('language', 'invalid')
      
      expect(validationOutput).toEqual(validationResult)
    })
  })

  describe('Error Management', () => {
    test('should expose errors from enhanced config context', () => {
      const contextError = { message: 'Context error', type: 'workspace' }
      mockEnhancedConfig.lastError = contextError
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      expect(result.current.error).toBe(contextError)
    })

    test('should prioritize local errors over context errors', async () => {
      const contextError = { message: 'Context error' }
      const localError = new Error('Local error')
      
      mockEnhancedConfig.lastError = contextError
      mockEnhancedConfig.setConfig.mockResolvedValue({
        success: false,
        targetStore: 'workspace',
        error: localError
      })
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      await expect(act(async () => {
        await result.current.setValue('language', 'invalid')
      })).rejects.toThrow('Local error')
      
      expect(result.current.error).toBe(localError)
    })

    test('should clear both local and context errors', () => {
      const localError = new Error('Local error')
      mockEnhancedConfig.lastError = { message: 'Context error' }
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      // Set local error
      act(() => {
        result.current.setValue('language', 'invalid').catch(() => {})
      })
      
      // Clear errors
      act(() => {
        result.current.clearError()
      })
      
      expect(mockEnhancedConfig.clearError).toHaveBeenCalled()
    })
  })

  describe('State Synchronization', () => {
    test('should update when enhanced config state changes', () => {
      const { result, rerender } = renderHook(() => useUnifiedConfig())
      
      // Initial state
      expect(result.current.isReady).toBe(true)
      
      // Change enhanced config state
      mockEnhancedConfig.isWorkspaceReady = false
      rerender()
      
      expect(result.current.isReady).toBe(false)
    })

    test('should update workspace context when it changes', () => {
      const { result, rerender } = renderHook(() => useUnifiedConfig())
      
      // Initial context
      expect(result.current.workspaceContext.isTransitioning).toBe(false)
      
      // Change workspace context
      mockEnhancedConfig.workspaceContext.isTransitioning = true
      rerender()
      
      expect(result.current.workspaceContext.isTransitioning).toBe(true)
    })

    test('should maintain consistent function references', () => {
      const { result, rerender } = renderHook(() => useUnifiedConfig())
      
      const initialFunctions = {
        setValue: result.current.setValue,
        getValue: result.current.getValue,
        validateConfig: result.current.validateConfig,
        clearError: result.current.clearError
      }
      
      rerender()
      
      expect(result.current.setValue).toBe(initialFunctions.setValue)
      expect(result.current.getValue).toBe(initialFunctions.getValue)
      expect(result.current.validateConfig).toBe(initialFunctions.validateConfig)
      expect(result.current.clearError).toBe(initialFunctions.clearError)
    })
  })

  describe('Edge Cases', () => {
    test('should handle rapid successive updates', async () => {
      mockEnhancedConfig.setConfig.mockResolvedValue({
        success: true,
        targetStore: 'workspace'
      })
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      // Start multiple updates rapidly
      const updates = [
        result.current.setValue('language', 'en'),
        result.current.setValue('priority', 'speed'),
        result.current.setValue('charset', 'traditional')
      ]
      
      await act(async () => {
        await Promise.all(updates)
      })
      
      expect(mockEnhancedConfig.setConfig).toHaveBeenCalledTimes(3)
      expect(result.current.isLoading).toBe(false)
    })

    test('should handle mixed success and failure updates', async () => {
      mockEnhancedConfig.setConfig
        .mockResolvedValueOnce({ success: true, targetStore: 'workspace' })
        .mockResolvedValueOnce({ 
          success: false, 
          targetStore: 'workspace', 
          error: new Error('Update failed') 
        })
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      // First update succeeds
      await act(async () => {
        const result1 = await result.current.setValue('language', 'en')
        expect(result1.success).toBe(true)
      })
      
      expect(result.current.error).toBe(null)
      
      // Second update fails
      await expect(act(async () => {
        await result.current.setValue('priority', 'invalid')
      })).rejects.toThrow('Update failed')
      
      expect(result.current.error?.message).toBe('Update failed')
    })

    test('should handle undefined and null values appropriately', async () => {
      mockEnhancedConfig.setConfig.mockResolvedValue({
        success: true,
        targetStore: 'workspace'
      })
      
      const { result } = renderHook(() => useUnifiedConfig())
      
      // Test with undefined
      await act(async () => {
        await result.current.setValue('inputFile', undefined as any)
      })
      
      expect(mockEnhancedConfig.setConfig).toHaveBeenCalledWith('inputFile', undefined, undefined)
      
      // Test with null
      await act(async () => {
        await result.current.setValue('outputFile', null as any)
      })
      
      expect(mockEnhancedConfig.setConfig).toHaveBeenCalledWith('outputFile', null, undefined)
    })
  })
})