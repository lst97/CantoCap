/**
 * Workspace Flow Integration Tests
 * 
 * Comprehensive testing of workspace-step coordination including:
 * - Empty state → workspace creation flow
 * - Step configuration preservation across workspace operations
 * - Auto-save functionality integration
 * - Error recovery and graceful degradation
 * - Real-time UI updates and synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act, waitFor, renderHook } from '@testing-library/react'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Import system components
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useAppStore } from '../../stores/app-store'
// Legacy workflow store removed - using WorkflowStateManager directly
import { WorkspacePanel } from '../../components/layout/WorkspacePanel'
import { ReviewStep } from '../../components/steps/ReviewStep'

// Import types
import type { 
  WorkspaceConfig, 
  WorkspaceStep,
  StepConfiguration,
  AutoSaveStatus
} from '../../types/workspace'
import type { WorkflowState } from '../../types/workflow'

/**
 * Integration Test Suite for Workspace Flow
 */
describe('Workspace Flow Integration', () => {
  // Test state and mocks
  let workspaceStore: ReturnType<typeof useWorkspaceStore>
  let appStore: ReturnType<typeof useAppStore>
  let workflowStore: ReturnType<typeof useWorkflowStore>

  // Mock API responses
  const mockCantocapAPI = {
    // Workspace Management
    listWorkspaces: vi.fn(),
    createWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    syncWorkspace: vi.fn(),
    
    // Configuration Management
    getWorkspaceConfig: vi.fn(),
    syncWorkspaceConfig: vi.fn(),
    
    // Step Configuration
    getStepConfiguration: vi.fn(),
    saveStepConfiguration: vi.fn(),
    
    // System State
    initializeWorkspaceSystem: vi.fn(),
    isSystemReady: vi.fn(),
    
    // Performance Metrics
    getWorkspacePerformanceMetrics: vi.fn(),
    recordWorkspaceOperation: vi.fn(),
    
    // Event Listeners
    onWorkspaceUpdate: vi.fn(() => () => {}),
    onConfigurationChange: vi.fn(() => () => {}),
    onAutoSaveUpdate: vi.fn(() => () => {})
  }

  beforeAll(() => {
    // Setup global window mock
    global.window = {
      cantocapAPI: mockCantocapAPI,
      performance: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn()
      }
    } as any

    // Mock IndexedDB
    global.indexedDB = {
      open: vi.fn(),
      deleteDatabase: vi.fn()
    } as any
  })

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
    
    // Setup default successful responses
    mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValue({ success: true })
    mockCantocapAPI.listWorkspaces.mockResolvedValue([])
    mockCantocapAPI.isSystemReady.mockResolvedValue(true)
    mockCantocapAPI.getWorkspacePerformanceMetrics.mockResolvedValue([])
    mockCantocapAPI.syncWorkspaceConfig.mockResolvedValue({ success: true })
    mockCantocapAPI.saveStepConfiguration.mockResolvedValue({ success: true })

    // Initialize performance monitoring
    if (global.performance?.now) {
      (global.performance.now as any).mockReturnValue(Date.now())
    }
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  afterAll(() => {
    delete (global as any).window
  })

  /**
   * 1. EMPTY STATE TO WORKSPACE CREATION FLOW
   */
  describe('Empty State → Workspace Creation Flow', () => {
    it('should handle complete empty state → first workspace creation → step initialization', async () => {
      // Track performance
      const startTime = Date.now()
      
      // Phase 1: Initialize stores
      const { result: workspaceResult } = renderHook(() => useWorkspaceStore())
      const { result: appResult } = renderHook(() => useAppStore())
      const { result: workflowResult } = renderHook(() => useWorkflowStore())
      
      workspaceStore = workspaceResult.current
      appStore = appResult.current
      workflowStore = workflowResult.current

      // Verify initial empty state
      expect(workspaceStore.availableWorkspaces).toHaveLength(0)
      expect(workspaceStore.currentWorkspace).toBeNull()
      expect(workspaceStore.isInitialized).toBe(false)

      // Phase 2: Initialize system
      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      expect(workspaceStore.isInitialized).toBe(true)
      expect(mockCantocapAPI.initializeWorkspaceSystem).toHaveBeenCalled()

      // Phase 3: Create first workspace
      mockCantocapAPI.createWorkspace.mockResolvedValue({
        success: true,
        workspaceId: 'ws_first_123'
      })

      const createResult = await act(async () => {
        return await workspaceStore.createWorkspace('My First Project')
      })

      expect(createResult.success).toBe(true)
      expect(createResult.workspaceId).toBe('ws_first_123')

      // Phase 4: Verify workspace activation and step initialization
      await waitFor(() => {
        expect(workspaceStore.currentWorkspace?.id).toBe('ws_first_123')
        expect(workspaceStore.currentWorkspace?.name).toBe('My First Project')
      })

      // Phase 5: Verify step configuration initialization
      const stepConfig = workspaceStore.getStepConfiguration('input')
      expect(stepConfig).toBeDefined()
      expect(stepConfig.workspaceId).toBe('ws_first_123')

      // Performance validation: complete flow < 2s
      const totalTime = Date.now() - startTime
      expect(totalTime).toBeLessThan(2000)
    })

    it('should handle workspace creation with pre-populated configuration', async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      // Initialize system
      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      // Setup creation with initial config
      const initialConfig: Partial<WorkspaceConfig> = {
        language: 'zh',
        inputFile: { path: '/test/sample.mp4', name: 'sample.mp4' }
      }

      mockCantocapAPI.createWorkspace.mockResolvedValue({
        success: true,
        workspaceId: 'ws_configured_456'
      })

      // Create workspace with initial configuration
      const createResult = await act(async () => {
        return await workspaceStore.createWorkspace('Configured Project', initialConfig)
      })

      expect(createResult.success).toBe(true)

      // Verify configuration was applied
      await waitFor(() => {
        const config = workspaceStore.getCurrentWorkspaceConfig()
        expect(config?.language).toBe('zh')
        expect(config?.inputFile?.name).toBe('sample.mp4')
      })

      // Verify step configuration reflects the initial data
      const inputStepConfig = workspaceStore.getStepConfiguration('input')
      expect(inputStepConfig.data?.inputFile).toEqual(initialConfig.inputFile)
    })

    it('should handle empty state with system recovery', async () => {
      // Simulate corrupted system state
      mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValueOnce({ success: false })
      mockCantocapAPI.listWorkspaces.mockRejectedValueOnce(new Error('System corrupted'))

      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      // First initialization attempt should fail
      let firstResult: any
      await act(async () => {
        try {
          firstResult = await workspaceStore.initializeWorkspaces()
        } catch (error) {
          firstResult = { success: false, error }
        }
      })

      expect(firstResult.success).toBe(false)
      expect(workspaceStore.lastError).toBeDefined()

      // Setup recovery scenario
      mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValue({ success: true })
      mockCantocapAPI.listWorkspaces.mockResolvedValue([])

      // Retry initialization should succeed
      await act(async () => {
        await workspaceStore.retryInitialization()
      })

      await waitFor(() => {
        expect(workspaceStore.isInitialized).toBe(true)
        expect(workspaceStore.lastError).toBeNull()
      })
    })
  })

  /**
   * 2. STEP CONFIGURATION PRESERVATION
   */
  describe('Step Configuration Preservation', () => {
    beforeEach(async () => {
      // Setup workspace for step configuration tests
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = {
          id: 'ws_steps_789',
          name: 'Step Test Workspace',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      })
    })

    it('should preserve step configuration across workspace switching', async () => {
      // Configure step data for workspace 1
      const step1Config: StepConfiguration = {
        stepId: 'input',
        workspaceId: 'ws_steps_789',
        isCompleted: true,
        data: {
          inputFile: { path: '/test/video1.mp4', name: 'video1.mp4' },
          language: 'zh'
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', step1Config)
      })

      // Create and switch to second workspace
      mockCantocapAPI.createWorkspace.mockResolvedValue({
        success: true,
        workspaceId: 'ws_steps_abc'
      })

      await act(async () => {
        await workspaceStore.createWorkspace('Second Workspace')
      })

      // Configure step data for workspace 2
      const step2Config: StepConfiguration = {
        stepId: 'input',
        workspaceId: 'ws_steps_abc',
        isCompleted: true,
        data: {
          inputFile: { path: '/test/video2.mp4', name: 'video2.mp4' },
          language: 'en'
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', step2Config)
      })

      // Switch back to first workspace
      await act(async () => {
        await workspaceStore.switchWorkspace('ws_steps_789')
      })

      // Verify step configuration was preserved
      await waitFor(() => {
        const restoredConfig = workspaceStore.getStepConfiguration('input')
        expect(restoredConfig.data?.inputFile?.name).toBe('video1.mp4')
        expect(restoredConfig.data?.language).toBe('zh')
      })

      // Switch back to second workspace and verify its config
      await act(async () => {
        await workspaceStore.switchWorkspace('ws_steps_abc')
      })

      await waitFor(() => {
        const config2 = workspaceStore.getStepConfiguration('input')
        expect(config2.data?.inputFile?.name).toBe('video2.mp4')
        expect(config2.data?.language).toBe('en')
      })
    })

    it('should handle step progression with validation', async () => {
      const { result: workflowResult } = renderHook(() => useWorkflowStore())
      workflowStore = workflowResult.current

      // Step 1: Input File Configuration
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: 'ws_steps_789',
        isCompleted: false,
        data: {
          inputFile: { path: '/test/progression.mp4', name: 'progression.mp4' }
        },
        validationState: { isValid: false, errors: ['Language not selected'] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
      })

      // Verify step is not completed due to validation error
      expect(workspaceStore.getStepConfiguration('input').isCompleted).toBe(false)
      expect(workflowStore.canProgressToNextStep()).toBe(false)

      // Complete input step validation
      const completedInputConfig: StepConfiguration = {
        ...inputConfig,
        data: {
          ...inputConfig.data,
          language: 'zh'
        },
        validationState: { isValid: true, errors: [] },
        isCompleted: true,
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', completedInputConfig)
      })

      // Verify progression is now allowed
      await waitFor(() => {
        expect(workspaceStore.getStepConfiguration('input').isCompleted).toBe(true)
        expect(workflowStore.canProgressToNextStep()).toBe(true)
      })

      // Progress to processing step
      await act(async () => {
        workflowStore.setCurrentStep('processing')
      })

      // Verify step configuration carries forward
      const processingConfig = workspaceStore.getStepConfiguration('processing')
      expect(processingConfig.data?.inputFile).toEqual(completedInputConfig.data?.inputFile)
      expect(processingConfig.data?.language).toBe('zh')
    })

    it('should handle concurrent step modifications with conflict resolution', async () => {
      // Simulate concurrent modifications to the same step
      const baseConfig: StepConfiguration = {
        stepId: 'processing',
        workspaceId: 'ws_steps_789',
        isCompleted: false,
        data: {
          processingProgress: 0,
          estimatedTimeRemaining: 300
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      // Start concurrent updates
      const update1Promise = act(async () => {
        await workspaceStore.updateStepConfiguration('processing', {
          ...baseConfig,
          data: { ...baseConfig.data, processingProgress: 25 },
          lastModified: Date.now() + 1
        })
      })

      const update2Promise = act(async () => {
        await workspaceStore.updateStepConfiguration('processing', {
          ...baseConfig,
          data: { ...baseConfig.data, processingProgress: 30 },
          lastModified: Date.now() + 2
        })
      })

      // Wait for both updates
      await Promise.all([update1Promise, update2Promise])

      // Verify conflict resolution (last write wins)
      await waitFor(() => {
        const finalConfig = workspaceStore.getStepConfiguration('processing')
        expect(finalConfig.data?.processingProgress).toBe(30) // Later modification
      })

      // Verify save was called with resolved configuration
      expect(mockCantocapAPI.saveStepConfiguration).toHaveBeenCalled()
    })
  })

  /**
   * 3. AUTO-SAVE FUNCTIONALITY INTEGRATION
   */
  describe('Auto-Save Functionality Integration', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = {
          id: 'ws_autosave_101',
          name: 'Auto-Save Test',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      })
    })

    it('should trigger auto-save on configuration changes with debouncing', async () => {
      const startTime = Date.now()

      // Rapid configuration changes
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'en' })
      })

      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'zh' })
      })

      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'fr' })
      })

      // UI should not be blocked
      const uiBlockingTime = Date.now() - startTime
      expect(uiBlockingTime).toBeLessThan(50)

      // Verify pending save status
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBeGreaterThan(0)

      // Fast-forward through debounce period
      await act(async () => {
        vi.advanceTimersByTime(2000) // Default debounce is 1.5s
        await vi.runAllTimersAsync()
      })

      // Verify auto-save was triggered
      await waitFor(() => {
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalled()
        expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)
      })

      // Verify final configuration
      expect(workspaceStore.getCurrentWorkspaceConfig()?.language).toBe('fr')
    })

    it('should handle auto-save failures with retry mechanism', async () => {
      // Setup auto-save failure
      mockCantocapAPI.syncWorkspaceConfig.mockRejectedValueOnce(new Error('Network error'))
      mockCantocapAPI.syncWorkspaceConfig.mockResolvedValueOnce({ success: true })

      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({
          inputFile: { path: '/test/retry.mp4', name: 'retry.mp4' }
        })
      })

      // Fast-forward through debounce
      await act(async () => {
        vi.advanceTimersByTime(2000)
        await vi.runAllTimersAsync()
      })

      // Verify failure was recorded
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.failedSaves).toBe(1)
        expect(workspaceStore.autoSaveStatus.lastError).toBeDefined()
      })

      // Trigger retry
      await act(async () => {
        await workspaceStore.retryFailedSaves()
      })

      // Verify retry succeeded
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.failedSaves).toBe(0)
        expect(workspaceStore.autoSaveStatus.lastError).toBeNull()
      })
    })

    it('should show real-time auto-save status in UI', async () => {
      // Render WorkspacePanel to test UI integration
      const { rerender } = render(<WorkspacePanel />)

      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      // Setup workspace
      await act(async () => {
        workspaceStore.currentWorkspace = {
          id: 'ws_ui_status',
          name: 'UI Status Test',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      })

      rerender(<WorkspacePanel />)

      // Make configuration change
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'en' })
      })

      // Should show saving indicator
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBeGreaterThan(0)

      // Fast-forward through save
      await act(async () => {
        vi.advanceTimersByTime(2000)
        await vi.runAllTimersAsync()
      })

      // Should show saved status
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)
        expect(workspaceStore.autoSaveStatus.lastSaveTime).toBeDefined()
      })
    })

    it('should handle offline/online auto-save scenarios', async () => {
      // Simulate offline scenario
      mockCantocapAPI.syncWorkspaceConfig.mockRejectedValue(new Error('Network unavailable'))

      // Make changes while offline
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'offline-test' })
      })

      // Fast-forward through save attempt
      await act(async () => {
        vi.advanceTimersByTime(2000)
        await vi.runAllTimersAsync()
      })

      // Verify failed save was queued
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.failedSaves).toBe(1)
      })

      // Simulate coming back online
      mockCantocapAPI.syncWorkspaceConfig.mockResolvedValue({ success: true })

      // Trigger retry
      await act(async () => {
        await workspaceStore.retryFailedSaves()
      })

      // Verify sync succeeded
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.failedSaves).toBe(0)
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          'ws_autosave_101',
          expect.objectContaining({ language: 'offline-test' })
        )
      })
    })
  })

  /**
   * 4. ERROR RECOVERY AND GRACEFUL DEGRADATION
   */
  describe('Error Recovery and Graceful Degradation', () => {
    it('should handle workspace corruption with recovery options', async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      // Setup corrupted workspace scenario
      mockCantocapAPI.getWorkspaceConfig.mockRejectedValue(new Error('Workspace data corrupted'))
      mockCantocapAPI.createWorkspaceBackup.mockResolvedValue({
        success: true,
        backupPath: '/backup/corrupted-ws.json'
      })

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.availableWorkspaces = [{
          id: 'ws_corrupted_123',
          name: 'Corrupted Workspace',
          isActive: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }]
      })

      // Attempt to switch to corrupted workspace
      const switchResult = await act(async () => {
        try {
          return await workspaceStore.switchWorkspace('ws_corrupted_123')
        } catch (error) {
          return { success: false, error }
        }
      })

      expect(switchResult.success).toBe(false)
      expect(workspaceStore.lastError?.message).toContain('corrupted')

      // Verify recovery options are available
      expect(workspaceStore.recoveryOptions).toBeDefined()
      expect(workspaceStore.recoveryOptions.canCreateBackup).toBe(true)
      expect(workspaceStore.recoveryOptions.canResetWorkspace).toBe(true)

      // Test recovery action
      await act(async () => {
        await workspaceStore.resetWorkspace('ws_corrupted_123')
      })

      // Verify workspace was reset to default state
      await waitFor(() => {
        const config = workspaceStore.getCurrentWorkspaceConfig()
        expect(config?.workspaceId).toBe('ws_corrupted_123')
        expect(config?.inputFile).toBeNull()
        expect(config?.outputFile).toBeNull()
      })
    })

    it('should provide graceful degradation when IPC is unavailable', async () => {
      // Setup IPC unavailable scenario
      mockCantocapAPI.createWorkspace.mockRejectedValue(new Error('IPC not available'))
      mockCantocapAPI.syncWorkspaceConfig.mockRejectedValue(new Error('IPC not available'))

      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      // Attempt workspace creation (should fall back to local-only mode)
      const createResult = await act(async () => {
        return await workspaceStore.createWorkspace('Local Only Workspace')
      })

      // Should succeed with local fallback
      expect(createResult.success).toBe(true)
      expect(createResult.isLocalOnly).toBe(true)

      // Verify local workspace was created
      expect(workspaceStore.availableWorkspaces).toHaveLength(1)
      expect(workspaceStore.currentWorkspace?.name).toBe('Local Only Workspace')

      // Configuration changes should work locally
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'local-test' })
      })

      expect(workspaceStore.getCurrentWorkspaceConfig()?.language).toBe('local-test')

      // Should show warning about IPC unavailability
      expect(workspaceStore.systemWarnings).toContain('IPC_UNAVAILABLE')
    })

    it('should handle storage quota exceeded gracefully', async () => {
      // Mock storage quota exceeded
      const quotaError = new Error('QuotaExceededError')
      quotaError.name = 'QuotaExceededError'
      
      vi.doMock('../../services/workspace-database', () => ({
        getWorkspaceDatabase: () => ({
          saveWorkspace: vi.fn().mockRejectedValue(quotaError),
          initializeDatabase: vi.fn().mockResolvedValue(undefined)
        })
      }))

      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      // Attempt to create workspace (should trigger quota error)
      const createResult = await act(async () => {
        return await workspaceStore.createWorkspace('Quota Test')
      })

      expect(createResult.success).toBe(false)
      expect(workspaceStore.lastError?.name).toBe('QuotaExceededError')

      // Verify cleanup suggestions are provided
      expect(workspaceStore.storageCleanupSuggestions).toBeDefined()
      expect(workspaceStore.storageCleanupSuggestions.length).toBeGreaterThan(0)

      // Test cleanup action
      await act(async () => {
        await workspaceStore.cleanupOldWorkspaces()
      })

      // Should attempt to free space
      expect(workspaceStore.storageCleanupSuggestions.length).toBe(0)
    })
  })

  /**
   * 5. REAL-TIME UI UPDATES AND SYNCHRONIZATION
   */
  describe('Real-time UI Updates and Synchronization', () => {
    it('should synchronize workspace list updates across components', async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      // Initialize with some workspaces
      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.availableWorkspaces = [
          {
            id: 'ws_sync_1',
            name: 'Sync Test 1',
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessedAt: Date.now()
          },
          {
            id: 'ws_sync_2',
            name: 'Sync Test 2',
            isActive: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessedAt: Date.now()
          }
        ]
      })

      // Render multiple components that use workspace data
      const { rerender } = render(<WorkspacePanel />)

      // Verify initial state
      expect(workspaceStore.availableWorkspaces).toHaveLength(2)

      // Create new workspace
      mockCantocapAPI.createWorkspace.mockResolvedValue({
        success: true,
        workspaceId: 'ws_sync_3'
      })

      await act(async () => {
        await workspaceStore.createWorkspace('Sync Test 3')
      })

      // Verify all components receive the update
      rerender(<WorkspacePanel />)
      
      await waitFor(() => {
        expect(workspaceStore.availableWorkspaces).toHaveLength(3)
        expect(workspaceStore.availableWorkspaces.some(w => w.name === 'Sync Test 3')).toBe(true)
      })
    })

    it('should handle real-time configuration updates during processing', async () => {
      const { result: workspaceResult } = renderHook(() => useWorkspaceStore())
      const { result: workflowResult } = renderHook(() => useWorkflowStore())
      
      workspaceStore = workspaceResult.current
      workflowStore = workflowResult.current

      // Setup processing workspace
      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = {
          id: 'ws_realtime_processing',
          name: 'Real-time Processing',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
        workflowStore.setCurrentStep('processing')
      })

      // Start processing with initial progress
      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', {
          stepId: 'processing',
          workspaceId: 'ws_realtime_processing',
          isCompleted: false,
          data: {
            processingProgress: 0,
            status: 'starting'
          },
          validationState: { isValid: true, errors: [] },
          lastModified: Date.now()
        })
      })

      // Simulate real-time progress updates
      const progressUpdates = [10, 25, 50, 75, 90, 100]
      
      for (const progress of progressUpdates) {
        await act(async () => {
          await workspaceStore.updateStepConfiguration('processing', {
            stepId: 'processing',
            workspaceId: 'ws_realtime_processing',
            isCompleted: progress === 100,
            data: {
              processingProgress: progress,
              status: progress === 100 ? 'completed' : 'processing'
            },
            validationState: { isValid: true, errors: [] },
            lastModified: Date.now()
          })
        })

        // Verify UI reflects the update
        await waitFor(() => {
          const config = workspaceStore.getStepConfiguration('processing')
          expect(config.data?.processingProgress).toBe(progress)
        })

        // Small delay to simulate real processing
        await act(async () => {
          vi.advanceTimersByTime(100)
        })
      }

      // Verify completion
      const finalConfig = workspaceStore.getStepConfiguration('processing')
      expect(finalConfig.isCompleted).toBe(true)
      expect(finalConfig.data?.status).toBe('completed')
    })

    it('should maintain UI responsiveness during batch operations', async () => {
      const { result } = renderHook(() => useWorkspaceStore())
      workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      const startTime = Date.now()
      const batchSize = 50

      // Perform batch workspace operations
      const operations = Array.from({ length: batchSize }, (_, i) => {
        mockCantocapAPI.createWorkspace.mockResolvedValue({
          success: true,
          workspaceId: `ws_batch_${i}`
        })
        
        return workspaceStore.createWorkspace(`Batch Workspace ${i}`)
      })

      // Execute all operations
      await act(async () => {
        await Promise.all(operations)
      })

      // Verify UI remained responsive
      const totalTime = Date.now() - startTime
      expect(totalTime).toBeLessThan(5000) // 5 second max for 50 operations

      // Verify all workspaces were created
      await waitFor(() => {
        expect(workspaceStore.availableWorkspaces.length).toBe(batchSize)
      })

      // Verify no UI blocking occurred
      expect(workspaceStore.isPerformingBatchOperation).toBe(false)
    })
  })
})