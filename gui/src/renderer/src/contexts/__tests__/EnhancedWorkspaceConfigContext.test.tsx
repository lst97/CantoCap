/**
 * Enhanced Workspace Config Context Tests
 * 
 * Comprehensive tests for the EnhancedWorkspaceConfigContext including:
 * - Context provider behavior
 * - useUnifiedConfig hook functionality
 * - useEnhancedStepConfig hook behavior
 * - Error boundary integration
 * - Loading state management
 */

import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { 
  EnhancedWorkspaceConfigProvider, 
  useEnhancedWorkspaceConfig,
  useUnifiedConfig,
  useEnhancedStepConfig
} from '../EnhancedWorkspaceConfigContext'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { configurationManager } from '../../services/configuration-manager'
import type { AppConfig } from '../../../../types'

// Mock dependencies
jest.mock('../../stores/workspace-store')
jest.mock('../../services/configuration-manager')

const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>
const mockConfigurationManager = configurationManager as jest.Mocked<typeof configurationManager>

describe('EnhancedWorkspaceConfigProvider', () => {
  let mockWorkspaceStore: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockWorkspaceStore = {
      isInitialized: true,
      currentWorkspace: {
        id: 'workspace-123',
        name: 'Test Workspace',
        config: { language: 'zh' }
      },
      availableWorkspaces: [{ id: 'workspace-123', name: 'Test Workspace' }],
      autoSaveStatus: { pendingSaves: 0, lastSave: Date.now(), errors: [] },
      cacheMetrics: { hits: 10, misses: 2, size: 5 },
      lastError: null,
      clearError: jest.fn(),
      initializeWorkspaces: jest.fn().mockResolvedValue(undefined)
    }
    
    mockUseWorkspaceStore.mockReturnValue(mockWorkspaceStore)
    
    // Mock configuration manager
    Object.assign(mockConfigurationManager, {
      setConfig: jest.fn().mockResolvedValue({ success: true, targetStore: 'workspace' }),
      getConfig: jest.fn().mockResolvedValue('zh'),
      setStepConfig: jest.fn().mockResolvedValue({ success: true, targetStore: 'workspace' }),
      getStepConfig: jest.fn().mockResolvedValue({ enabled: true }),
      getWorkspaceContext: jest.fn().mockReturnValue({
        currentWorkspaceId: 'workspace-123',
        hasWorkspaces: true,
        isTransitioning: false,
        isReady: true,
        appInitialized: true,
        workspaceInitialized: true
      }),
      validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] })
    })
  })

  describe('Provider Initialization', () => {
    test('should initialize workspace system on mount', async () => {
      render(
        <EnhancedWorkspaceConfigProvider>
          <div>Test Content</div>
        </EnhancedWorkspaceConfigProvider>
      )
      
      await waitFor(() => {
        expect(mockWorkspaceStore.initializeWorkspaces).toHaveBeenCalled()
      })
      
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    test('should handle initialization errors gracefully', async () => {
      const initError = new Error('Initialization failed')
      mockWorkspaceStore.initializeWorkspaces.mockRejectedValue(initError)
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(
        <EnhancedWorkspaceConfigProvider>
          <div>Test Content</div>
        </EnhancedWorkspaceConfigProvider>
      )
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize workspace system:', initError)
      })
      
      consoleSpy.mockRestore()
    })

    test('should skip initialization if already initialized', async () => {
      mockWorkspaceStore.isInitialized = true
      
      render(
        <EnhancedWorkspaceConfigProvider>
          <div>Test Content</div>
        </EnhancedWorkspaceConfigProvider>
      )
      
      // Should not call initializeWorkspaces since already initialized
      expect(mockWorkspaceStore.initializeWorkspaces).not.toHaveBeenCalled()
    })
  })

  describe('Context Value Provision', () => {
    test('should provide complete context value', () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      expect(result.current).toMatchObject({
        currentWorkspaceId: 'workspace-123',
        isWorkspaceReady: true,
        setConfig: expect.any(Function),
        getConfig: expect.any(Function),
        getStepConfig: expect.any(Function),
        setStepConfig: expect.any(Function),
        resetStepConfig: expect.any(Function),
        autoSaveStatus: expect.any(Object),
        isAutoSaving: false,
        cacheMetrics: expect.any(Object),
        lastError: null,
        clearError: expect.any(Function),
        hasWorkspaces: true,
        isEmpty: false,
        workspaceContext: expect.any(Object),
        batchUpdateConfigs: expect.any(Function),
        validateConfig: expect.any(Function)
      })
    })

    test('should handle missing workspace gracefully', () => {
      mockWorkspaceStore.currentWorkspace = null
      mockConfigurationManager.getWorkspaceContext.mockReturnValue({
        currentWorkspaceId: null,
        hasWorkspaces: false,
        isTransitioning: false,
        isReady: true,
        appInitialized: true,
        workspaceInitialized: true
      })
      
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      expect(result.current.currentWorkspaceId).toBe(null)
      expect(result.current.isWorkspaceReady).toBe(false)
      expect(result.current.isEmpty).toBe(true)
    })

    test('should calculate auto-saving status correctly', () => {
      mockWorkspaceStore.autoSaveStatus = { pendingSaves: 3, lastSave: Date.now() - 1000, errors: [] }
      
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      expect(result.current.isAutoSaving).toBe(true)
      expect(result.current.autoSaveStatus.pendingSaves).toBe(3)
    })
  })

  describe('Configuration Operations', () => {
    test('should handle successful config updates', async () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      await act(async () => {
        const updateResult = await result.current.setConfig('language', 'en')
        expect(updateResult.success).toBe(true)
      })
      
      expect(mockConfigurationManager.setConfig).toHaveBeenCalledWith('language', 'en', {})
    })

    test('should handle config update failures', async () => {
      const updateError = new Error('Update failed')
      mockConfigurationManager.setConfig.mockResolvedValue({
        success: false,
        targetStore: 'workspace',
        error: updateError
      })
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      await act(async () => {
        const updateResult = await result.current.setConfig('language', 'en')
        expect(updateResult.success).toBe(false)
        expect(updateResult.error).toBe(updateError)
      })
      
      expect(consoleSpy).toHaveBeenCalledWith('Configuration update failed:', updateError)
      consoleSpy.mockRestore()
    })

    test('should handle step configuration operations', async () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      // Test getStepConfig
      await act(async () => {
        const stepConfig = await result.current.getStepConfig('processing' as any)
        expect(stepConfig).toEqual({ enabled: true })
      })
      
      // Test setStepConfig
      await act(async () => {
        await result.current.setStepConfig('processing' as any, { mode: 'advanced' })
      })
      
      expect(mockConfigurationManager.getStepConfig).toHaveBeenCalledWith('processing')
      expect(mockConfigurationManager.setStepConfig).toHaveBeenCalledWith('processing', { mode: 'advanced' }, {
        merge: true,
        skipValidation: false
      })
    })

    test('should handle step configuration errors', async () => {
      const stepError = new Error('Step config failed')
      mockConfigurationManager.setStepConfig.mockResolvedValue({
        success: false,
        targetStore: 'workspace',
        error: stepError
      })
      
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      await expect(act(async () => {
        await result.current.setStepConfig('processing' as any, { mode: 'advanced' })
      })).rejects.toThrow('Step config failed')
    })

    test('should handle batch config updates', async () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      const updates = [
        { key: 'language' as keyof AppConfig, value: 'en' },
        { key: 'priority' as keyof AppConfig, value: 'speed' }
      ]
      
      await act(async () => {
        const results = await result.current.batchUpdateConfigs(updates)
        expect(results).toHaveLength(2)
        expect(results[0].success).toBe(true)
        expect(results[1].success).toBe(true)
      })
      
      expect(mockConfigurationManager.setConfig).toHaveBeenCalledTimes(2)
    })

    test('should handle validation operations', () => {
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      const validationResult = result.current.validateConfig('language', 'zh')
      
      expect(validationResult.isValid).toBe(true)
      expect(validationResult.errors).toEqual([])
    })
  })

  describe('Error Handling', () => {
    test('should provide error clearing functionality', () => {
      mockWorkspaceStore.lastError = { message: 'Test error', type: 'validation' }
      
      const { result } = renderHook(() => useEnhancedWorkspaceConfig(), {
        wrapper: ({ children }) => (
          <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
        )
      })
      
      act(() => {
        result.current.clearError()
      })
      
      expect(mockWorkspaceStore.clearError).toHaveBeenCalled()
    })

    test('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      expect(() => {
        renderHook(() => useEnhancedWorkspaceConfig())
      }).toThrow('useEnhancedWorkspaceConfig must be used within an EnhancedWorkspaceConfigProvider')
      
      consoleSpy.mockRestore()
    })
  })
})

describe('useUnifiedConfig Hook', () => {
  let mockWorkspaceStore: any

  beforeEach(() => {
    mockWorkspaceStore = {
      isInitialized: true,
      currentWorkspace: { id: 'workspace-123', name: 'Test Workspace' },
      availableWorkspaces: [{ id: 'workspace-123' }],
      autoSaveStatus: { pendingSaves: 0 },
      cacheMetrics: { hits: 0, misses: 0 },
      lastError: null,
      clearError: jest.fn(),
      initializeWorkspaces: jest.fn().mockResolvedValue(undefined)
    }
    
    mockUseWorkspaceStore.mockReturnValue(mockWorkspaceStore)
    
    mockConfigurationManager.getWorkspaceContext.mockReturnValue({
      currentWorkspaceId: 'workspace-123',
      hasWorkspaces: true,
      isTransitioning: false,
      isReady: true,
      appInitialized: true,
      workspaceInitialized: true
    })
  })

  test('should provide simplified configuration interface', () => {
    const { result } = renderHook(() => useUnifiedConfig(), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
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

  test('should handle successful value updates with loading state', async () => {
    mockConfigurationManager.setConfig.mockResolvedValue({ success: true, targetStore: 'workspace' })
    
    const { result } = renderHook(() => useUnifiedConfig(), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    let updatePromise: Promise<any>
    
    act(() => {
      updatePromise = result.current.setValue('language', 'en')
    })
    
    // Check loading state
    expect(result.current.isLoading).toBe(true)
    
    await act(async () => {
      const updateResult = await updatePromise
      expect(updateResult.success).toBe(true)
    })
    
    // Check loading state cleared
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  test('should handle value update errors with error state', async () => {
    const updateError = new Error('Update failed')
    mockConfigurationManager.setConfig.mockResolvedValue({
      success: false,
      targetStore: 'workspace',
      error: updateError
    })
    
    const { result } = renderHook(() => useUnifiedConfig(), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await expect(act(async () => {
      await result.current.setValue('language', 'en')
    })).rejects.toThrow('Update failed')
    
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(updateError)
  })

  test('should handle value retrieval', async () => {
    mockConfigurationManager.getConfig.mockResolvedValue('zh')
    
    const { result } = renderHook(() => useUnifiedConfig(), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await act(async () => {
      const value = await result.current.getValue('language')
      expect(value).toBe('zh')
    })
    
    expect(mockConfigurationManager.getConfig).toHaveBeenCalledWith('language')
  })

  test('should throw error when workspace not ready', async () => {
    mockWorkspaceStore.currentWorkspace = null
    mockConfigurationManager.getWorkspaceContext.mockReturnValue({
      currentWorkspaceId: null,
      hasWorkspaces: false,
      isTransitioning: false,
      isReady: false,
      appInitialized: true,
      workspaceInitialized: true
    })
    
    const { result } = renderHook(() => useUnifiedConfig(), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await expect(act(async () => {
      await result.current.setValue('language', 'en')
    })).rejects.toThrow('Workspace not ready')
    
    await expect(act(async () => {
      await result.current.getValue('language')
    })).rejects.toThrow('Workspace not ready')
  })

  test('should provide error clearing functionality', () => {
    mockWorkspaceStore.lastError = { message: 'Test error' }
    
    const { result } = renderHook(() => useUnifiedConfig(), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    expect(result.current.error).toBeTruthy()
    
    act(() => {
      result.current.clearError()
    })
    
    expect(mockWorkspaceStore.clearError).toHaveBeenCalled()
  })
})

describe('useEnhancedStepConfig Hook', () => {
  let mockWorkspaceStore: any

  beforeEach(() => {
    mockWorkspaceStore = {
      isInitialized: true,
      currentWorkspace: { id: 'workspace-123', name: 'Test Workspace' },
      availableWorkspaces: [{ id: 'workspace-123' }],
      autoSaveStatus: { pendingSaves: 0 },
      cacheMetrics: { hits: 0, misses: 0 },
      lastError: null,
      clearError: jest.fn(),
      initializeWorkspaces: jest.fn().mockResolvedValue(undefined),
      resetStepConfig: jest.fn().mockResolvedValue(undefined)
    }
    
    mockUseWorkspaceStore.mockReturnValue(mockWorkspaceStore)
    
    mockConfigurationManager.getWorkspaceContext.mockReturnValue({
      currentWorkspaceId: 'workspace-123',
      hasWorkspaces: true,
      isTransitioning: false,
      isReady: true,
      appInitialized: true,
      workspaceInitialized: true
    })
  })

  test('should load step configuration on mount', async () => {
    const mockStepConfig = { enabled: true, mode: 'advanced' }
    mockConfigurationManager.getStepConfig.mockResolvedValue(mockStepConfig)
    
    const { result } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    // Initially loading
    expect(result.current[2].isLoading).toBe(true)
    
    await waitFor(() => {
      expect(result.current[2].isLoading).toBe(false)
    })
    
    // Should have loaded config
    expect(result.current[0]).toEqual(mockStepConfig)
    expect(mockConfigurationManager.getStepConfig).toHaveBeenCalledWith('processing')
  })

  test('should handle step configuration updates with optimistic updates', async () => {
    const initialConfig = { enabled: false, mode: 'simple' }
    mockConfigurationManager.getStepConfig.mockResolvedValue(initialConfig)
    mockConfigurationManager.setStepConfig.mockResolvedValue({ success: true, targetStore: 'workspace' })
    
    const { result } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await waitFor(() => {
      expect(result.current[2].isLoading).toBe(false)
    })
    
    expect(result.current[0]).toEqual(initialConfig)
    
    // Update configuration
    const updates = { enabled: true, mode: 'advanced' }
    
    await act(async () => {
      await result.current[1](updates)
    })
    
    // Should show optimistic update
    expect(result.current[0]).toEqual({ ...initialConfig, ...updates })
    expect(mockConfigurationManager.setStepConfig).toHaveBeenCalledWith('processing', updates, {
      merge: true,
      skipValidation: false
    })
  })

  test('should rollback optimistic updates on error', async () => {
    const initialConfig = { enabled: false, mode: 'simple' }
    mockConfigurationManager.getStepConfig.mockResolvedValue(initialConfig)
    
    const updateError = new Error('Update failed')
    mockConfigurationManager.setStepConfig.mockRejectedValue(updateError)
    
    const { result } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await waitFor(() => {
      expect(result.current[2].isLoading).toBe(false)
    })
    
    expect(result.current[0]).toEqual(initialConfig)
    
    // Attempt update that will fail
    const updates = { enabled: true }
    
    await expect(act(async () => {
      await result.current[1](updates)
    })).rejects.toThrow('Update failed')
    
    // Should have rolled back to original config
    expect(result.current[0]).toEqual(initialConfig)
  })

  test('should handle step configuration reset', async () => {
    const initialConfig = { enabled: true, mode: 'advanced' }
    const resetConfig = { enabled: false, mode: 'simple' }
    
    mockConfigurationManager.getStepConfig
      .mockResolvedValueOnce(initialConfig) // Initial load
      .mockResolvedValueOnce(resetConfig)   // After reset
    
    const { result } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await waitFor(() => {
      expect(result.current[2].isLoading).toBe(false)
    })
    
    expect(result.current[0]).toEqual(initialConfig)
    
    // Reset configuration
    await act(async () => {
      await result.current[2].resetConfig()
    })
    
    expect(mockWorkspaceStore.resetStepConfig).toHaveBeenCalledWith('workspace-123', 'processing')
    expect(result.current[0]).toEqual(resetConfig)
  })

  test('should handle loading errors', async () => {
    const loadError = new Error('Failed to load step config')
    mockConfigurationManager.getStepConfig.mockRejectedValue(loadError)
    
    const { result } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await waitFor(() => {
      expect(result.current[2].isLoading).toBe(false)
    })
    
    expect(result.current[0]).toBe(null)
    expect(result.current[2].error).toBe(loadError)
  })

  test('should handle workspace not ready', () => {
    mockWorkspaceStore.currentWorkspace = null
    mockConfigurationManager.getWorkspaceContext.mockReturnValue({
      currentWorkspaceId: null,
      hasWorkspaces: false,
      isTransitioning: false,
      isReady: false,
      appInitialized: true,
      workspaceInitialized: true
    })
    
    const { result } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    // Should not be loading since workspace is not ready
    expect(result.current[2].isLoading).toBe(false)
    expect(result.current[2].isReady).toBe(false)
  })

  test('should handle merge option in updates', async () => {
    const initialConfig = { enabled: true, mode: 'simple', timeout: 30 }
    mockConfigurationManager.getStepConfig.mockResolvedValue(initialConfig)
    mockConfigurationManager.setStepConfig.mockResolvedValue({ success: true, targetStore: 'workspace' })
    
    const { result } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    await waitFor(() => {
      expect(result.current[2].isLoading).toBe(false)
    })
    
    // Update with merge: false
    const updates = { mode: 'advanced' }
    
    await act(async () => {
      await result.current[1](updates, { merge: false })
    })
    
    // Should replace entire config, not merge
    expect(result.current[0]).toEqual(updates)
    expect(mockConfigurationManager.setStepConfig).toHaveBeenCalledWith('processing', updates, {
      merge: false,
      skipValidation: false
    })
  })

  test('should cleanup properly on unmount', async () => {
    const { unmount } = renderHook(() => useEnhancedStepConfig('processing' as any), {
      wrapper: ({ children }) => (
        <EnhancedWorkspaceConfigProvider>{children}</EnhancedWorkspaceConfigProvider>
      )
    })
    
    // Unmount should not cause any errors
    expect(() => unmount()).not.toThrow()
  })
})