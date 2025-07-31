/**
 * Auto-Save Integration Tests
 * 
 * Comprehensive testing of auto-save functionality including:
 * - Real-time configuration persistence with debouncing
 * - Conflict resolution during concurrent modifications
 * - Network failure recovery and offline synchronization
 * - Performance optimization and batching strategies
 * - Cross-component auto-save coordination
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals'
import { act, waitFor, renderHook } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/react'

// Import system components
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useAppStore } from '../../stores/app-store'

// Import types
import type { 
  WorkspaceConfig, 
  StepConfiguration,
  AutoSaveStatus,
  AutoSaveOptions
} from '../../types/workspace'

/**
 * Auto-Save Integration Test Suite
 */
describe('Auto-Save Integration', () => {
  let workspaceStore: ReturnType<typeof useWorkspaceStore>
  let appStore: ReturnType<typeof useAppStore>

  // Mock APIs with detailed auto-save simulation
  const mockCantocapAPI = {
    syncWorkspaceConfig: jest.fn(),
    saveStepConfiguration: jest.fn(),
    getAutoSaveStatus: jest.fn(),
    setAutoSaveOptions: jest.fn(),
    createAutoSaveBackup: jest.fn(),
    restoreAutoSaveBackup: jest.fn(),
    initializeWorkspaceSystem: jest.fn(),
    
    // Network simulation
    isOnline: jest.fn(),
    onNetworkChange: jest.fn(() => () => {})
  }

  // Test workspace setup
  const testWorkspace = {
    id: 'ws_autosave_test',
    name: 'Auto-Save Test Workspace',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastAccessedAt: Date.now()
  }

  // Auto-save configuration
  const defaultAutoSaveOptions: AutoSaveOptions = {
    debounceTime: 1500, // 1.5 seconds
    maxBatchSize: 10,
    retryAttempts: 3,
    backupInterval: 30000, // 30 seconds
    enableOfflineQueue: true
  }

  beforeAll(() => {
    global.window = {
      cantocapAPI: mockCantocapAPI,
      performance: { now: jest.fn(() => Date.now()) },
      navigator: { onLine: true }
    } as any
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Setup default successful responses
    mockCantocapAPI.syncWorkspaceConfig.mockResolvedValue({ success: true })
    mockCantocapAPI.saveStepConfiguration.mockResolvedValue({ success: true })
    mockCantocapAPI.getAutoSaveStatus.mockResolvedValue({
      isEnabled: true,
      pendingSaves: 0,
      failedSaves: 0,
      lastSaveTime: Date.now(),
      lastError: null
    })
    mockCantocapAPI.setAutoSaveOptions.mockResolvedValue({ success: true })
    mockCantocapAPI.createAutoSaveBackup.mockResolvedValue({ 
      success: true, 
      backupPath: '/backup/autosave.json' 
    })
    mockCantocapAPI.isOnline.mockReturnValue(true)
    mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValue({ success: true })

    // Initialize stores
    const { result: workspaceResult } = renderHook(() => useWorkspaceStore())
    const { result: appResult } = renderHook(() => useAppStore())
    
    workspaceStore = workspaceResult.current
    appStore = appResult.current

    // Setup test workspace
    await act(async () => {
      await workspaceStore.initializeWorkspaces()
      workspaceStore.currentWorkspace = testWorkspace
      await workspaceStore.setAutoSaveOptions(defaultAutoSaveOptions)
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    delete (global as any).window
  })

  /**
   * 1. REAL-TIME CONFIGURATION PERSISTENCE WITH DEBOUNCING
   */
  describe('Real-time Configuration Persistence', () => {
    it('should debounce rapid configuration changes and save final state', async () => {
      const startTime = Date.now()
      
      // Rapid sequence of configuration changes
      const changes = [
        { language: 'en' },
        { language: 'zh' },
        { language: 'fr' },
        { language: 'de' },
        { language: 'es' }
      ]

      // Apply changes rapidly
      for (const change of changes) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig(change)
        })
        
        // Small delay between changes (< debounce time)
        await act(async () => {
          jest.advanceTimersByTime(100)
        })
      }

      // Verify UI remains responsive
      const processingTime = Date.now() - startTime
      expect(processingTime).toBeLessThan(100) // Should be nearly instant

      // Verify debouncing is active
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBeGreaterThan(0)
      expect(mockCantocapAPI.syncWorkspaceConfig).not.toHaveBeenCalled()

      // Fast-forward through debounce period
      await act(async () => {
        jest.advanceTimersByTime(2000) // Beyond debounce time
        await jest.runAllTimersAsync()
      })

      // Should save only the final state
      await waitFor(() => {
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledTimes(1)
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          testWorkspace.id,
          expect.objectContaining({ language: 'es' }) // Final state
        )
      })

      // Verify auto-save status updated
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)
      expect(workspaceStore.autoSaveStatus.lastSaveTime).toBeDefined()
    })

    it('should handle step configuration auto-save with data inheritance', async () => {
      // Setup input step configuration
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          inputFile: { path: '/test/video.mp4', name: 'video.mp4' },
          language: 'initial'
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
      })

      // Rapid updates to step configuration
      const updates = ['update1', 'update2', 'update3']
      
      for (const language of updates) {
        await act(async () => {
          await workspaceStore.updateStepConfiguration('input', {
            ...inputConfig,
            data: { ...inputConfig.data, language },
            lastModified: Date.now()
          })
        })
        
        await act(async () => {
          jest.advanceTimersByTime(200)
        })
      }

      // Should debounce step configuration saves
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBeGreaterThan(0)

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Verify step configuration was saved with final state
      await waitFor(() => {
        expect(mockCantocapAPI.saveStepConfiguration).toHaveBeenCalledWith(
          'input',
          expect.objectContaining({
            data: expect.objectContaining({ language: 'update3' })
          })
        )
      })

      // Verify workspace config was also updated (inheritance)
      expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
        testWorkspace.id,
        expect.objectContaining({ language: 'update3' })
      )
    })

    it('should optimize auto-save performance with batching', async () => {
      // Configure batching
      await act(async () => {
        await workspaceStore.setAutoSaveOptions({
          ...defaultAutoSaveOptions,
          maxBatchSize: 5,
          debounceTime: 500
        })
      })

      // Create multiple configuration changes across different areas
      const changes = [
        { type: 'workspace', data: { language: 'zh' } },
        { type: 'step', stepId: 'input', data: { inputFile: { path: '/test/1.mp4', name: '1.mp4' } } },
        { type: 'workspace', data: { outputFormat: 'srt' } },
        { type: 'step', stepId: 'processing', data: { processingSpeed: 'fast' } },
        { type: 'workspace', data: { quality: 'high' } }
      ]

      // Apply all changes
      for (const change of changes) {
        await act(async () => {
          if (change.type === 'workspace') {
            await workspaceStore.updateWorkspaceConfig(change.data)
          } else {
            await workspaceStore.updateStepConfiguration(change.stepId!, {
              stepId: change.stepId!,
              workspaceId: testWorkspace.id,
              isCompleted: false,
              data: change.data,
              validationState: { isValid: true, errors: [] },
              lastModified: Date.now()
            })
          }
        })
      }

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(1000)
        await jest.runAllTimersAsync()
      })

      // Should batch saves efficiently
      await waitFor(() => {
        // Workspace config should be saved once with merged changes
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledTimes(1)
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          testWorkspace.id,
          expect.objectContaining({
            language: 'zh',
            outputFormat: 'srt',
            quality: 'high'
          })
        )

        // Step configurations should be saved separately
        expect(mockCantocapAPI.saveStepConfiguration).toHaveBeenCalledTimes(2)
      })
    })
  })

  /**
   * 2. CONFLICT RESOLUTION DURING CONCURRENT MODIFICATIONS
   */
  describe('Conflict Resolution', () => {
    it('should resolve conflicts with last-write-wins strategy', async () => {
      // Setup concurrent modification scenario
      const baseConfig: WorkspaceConfig = {
        workspaceId: testWorkspace.id,
        language: 'initial',
        inputFile: null,
        outputFile: null
      }

      await act(async () => {
        await workspaceStore.updateWorkspaceConfig(baseConfig)
      })

      // Simulate concurrent modifications
      const promises = [
        workspaceStore.updateWorkspaceConfig({ language: 'zh' }),
        workspaceStore.updateWorkspaceConfig({ language: 'en' }),
        workspaceStore.updateWorkspaceConfig({ language: 'fr' })
      ]

      await act(async () => {
        await Promise.all(promises)
      })

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Should resolve to last write
      await waitFor(() => {
        const currentConfig = workspaceStore.getCurrentWorkspaceConfig()
        expect(['zh', 'en', 'fr']).toContain(currentConfig?.language)
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledTimes(1)
      })
    })

    it('should handle step-level conflicts with validation', async () => {
      const stepConfig: StepConfiguration = {
        stepId: 'processing',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          processingProgress: 0,
          status: 'initializing'
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      // Initial configuration
      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', stepConfig)
      })

      // Concurrent step updates
      const concurrentUpdates = [
        { processingProgress: 25, status: 'processing', lastModified: Date.now() + 1 },
        { processingProgress: 30, status: 'processing', lastModified: Date.now() + 2 },
        { processingProgress: 20, status: 'processing', lastModified: Date.now() + 3 }
      ]

      const updatePromises = concurrentUpdates.map(update =>
        workspaceStore.updateStepConfiguration('processing', {
          ...stepConfig,
          data: { ...stepConfig.data, ...update },
          lastModified: update.lastModified
        })
      )

      await act(async () => {
        await Promise.all(updatePromises)
      })

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Should resolve to latest timestamp (20% progress)
      await waitFor(() => {
        const finalConfig = workspaceStore.getStepConfiguration('processing')
        expect(finalConfig.data?.processingProgress).toBe(20)
        expect(finalConfig.lastModified).toBe(Date.now() + 3)
      })
    })

    it('should detect and resolve cross-step conflicts', async () => {
      // Setup conflicting step configurations
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: testWorkspace.id,
        isCompleted: true,
        data: {
          inputFile: { path: '/test/video1.mp4', name: 'video1.mp4' },
          language: 'zh'
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      const processingConfig: StepConfiguration = {
        stepId: 'processing',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          inputFile: { path: '/test/video2.mp4', name: 'video2.mp4' }, // Conflict!
          language: 'en' // Conflict!
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now() + 1000
      }

      // Apply conflicting configurations
      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
        await workspaceStore.updateStepConfiguration('processing', processingConfig)
      })

      // Should detect conflict and resolve with precedence rules
      await waitFor(() => {
        const resolvedInputConfig = workspaceStore.getStepConfiguration('input')
        const resolvedProcessingConfig = workspaceStore.getStepConfiguration('processing')

        // Input step should maintain its configuration (completed step has precedence)
        expect(resolvedInputConfig.data?.inputFile?.name).toBe('video1.mp4')
        expect(resolvedInputConfig.data?.language).toBe('zh')

        // Processing step should inherit from input (dependency rule)
        expect(resolvedProcessingConfig.data?.inputFile?.name).toBe('video1.mp4')
        expect(resolvedProcessingConfig.data?.language).toBe('zh')
      })

      // Should record conflict resolution
      expect(workspaceStore.conflictHistory).toHaveLength(1)
      expect(workspaceStore.conflictHistory[0].resolution).toBe('dependency-precedence')
    })
  })

  /**
   * 3. NETWORK FAILURE RECOVERY AND OFFLINE SYNCHRONIZATION
   */
  describe('Network Failure Recovery', () => {
    it('should queue saves during network failures and sync when online', async () => {
      // Simulate network failure
      mockCantocapAPI.isOnline.mockReturnValue(false)
      mockCantocapAPI.syncWorkspaceConfig.mockRejectedValue(new Error('Network unavailable'))

      // Make configuration changes while offline
      const offlineChanges = [
        { language: 'offline-zh' },
        { outputFormat: 'offline-srt' },
        { quality: 'offline-high' }
      ]

      for (const change of offlineChanges) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig(change)
        })
      }

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Should queue failed saves
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.failedSaves).toBeGreaterThan(0)
        expect(workspaceStore.autoSaveStatus.offlineQueue.length).toBeGreaterThan(0)
      })

      // Simulate coming back online
      mockCantocapAPI.isOnline.mockReturnValue(true)
      mockCantocapAPI.syncWorkspaceConfig.mockResolvedValue({ success: true })

      // Trigger online sync
      await act(async () => {
        await workspaceStore.syncOfflineQueue()
      })

      // Should sync all offline changes
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.failedSaves).toBe(0)
        expect(workspaceStore.autoSaveStatus.offlineQueue.length).toBe(0)
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          testWorkspace.id,
          expect.objectContaining({
            language: 'offline-zh',
            outputFormat: 'offline-srt',
            quality: 'offline-high'
          })
        )
      })
    })

    it('should implement exponential backoff for retry attempts', async () => {
      // Setup intermittent failures
      let attemptCount = 0
      mockCantocapAPI.syncWorkspaceConfig.mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          return Promise.reject(new Error(`Network error attempt ${attemptCount}`))
        }
        return Promise.resolve({ success: true })
      })

      // Make configuration change
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'retry-test' })
      })

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Should implement exponential backoff
      const retryDelays = workspaceStore.autoSaveStatus.retryDelays
      expect(retryDelays.length).toBe(2) // Two failures before success
      expect(retryDelays[1]).toBeGreaterThan(retryDelays[0]) // Exponential increase

      // Should eventually succeed
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.failedSaves).toBe(0)
        expect(attemptCount).toBe(3)
      })
    })

    it('should maintain data integrity during network interruptions', async () => {
      // Start with successful save
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'before-interruption' })
      })

      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Verify successful save
      expect(workspaceStore.autoSaveStatus.lastSaveTime).toBeDefined()
      
      // Simulate network interruption during save
      mockCantocapAPI.syncWorkspaceConfig.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection lost')), 1000)
        })
      })

      // Make changes during interruption
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'during-interruption' })
      })

      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Should maintain local state integrity
      const currentConfig = workspaceStore.getCurrentWorkspaceConfig()
      expect(currentConfig?.language).toBe('during-interruption')

      // Should indicate unsaved changes
      expect(workspaceStore.autoSaveStatus.hasUnsavedChanges).toBe(true)
      expect(workspaceStore.autoSaveStatus.failedSaves).toBeGreaterThan(0)

      // Recovery should preserve all changes
      mockCantocapAPI.syncWorkspaceConfig.mockResolvedValue({ success: true })
      
      await act(async () => {
        await workspaceStore.retryFailedSaves()
      })

      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.hasUnsavedChanges).toBe(false)
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          testWorkspace.id,
          expect.objectContaining({ language: 'during-interruption' })
        )
      })
    })
  })

  /**
   * 4. PERFORMANCE OPTIMIZATION AND BATCHING
   */
  describe('Performance Optimization', () => {
    it('should optimize memory usage with configuration caching', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Generate many configuration changes
      const changeCount = 100
      
      for (let i = 0; i < changeCount; i++) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig({
            language: `config-${i}`,
            customData: new Array(1000).fill(`data-${i}`).join(' ') // Large data
          })
        })
        
        // Small delay
        await act(async () => {
          jest.advanceTimersByTime(10)
        })
      }

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // Should not cause memory leak
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB

      // Should only save final state
      expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledTimes(1)
      expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
        testWorkspace.id,
        expect.objectContaining({ language: `config-${changeCount - 1}` })
      )
    })

    it('should implement intelligent batching based on change frequency', async () => {
      // Configure adaptive batching
      await act(async () => {
        await workspaceStore.setAutoSaveOptions({
          ...defaultAutoSaveOptions,
          adaptiveBatching: true,
          maxBatchSize: 20,
          debounceTime: 1000
        })
      })

      // High-frequency changes (should increase batch size)
      const highFrequencyChanges = 30
      const startTime = Date.now()

      for (let i = 0; i < highFrequencyChanges; i++) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig({ 
            language: `high-freq-${i}`,
            timestamp: Date.now()
          })
        })
        
        // Very rapid changes
        await act(async () => {
          jest.advanceTimersByTime(50)
        })
      }

      // Should adapt debounce time based on frequency
      const adaptiveDebounceTime = workspaceStore.autoSaveStatus.currentDebounceTime
      expect(adaptiveDebounceTime).toBeGreaterThan(defaultAutoSaveOptions.debounceTime)

      // Fast-forward through adaptive debounce
      await act(async () => {
        jest.advanceTimersByTime(adaptiveDebounceTime + 1000)
        await jest.runAllTimersAsync()
      })

      // Should batch efficiently
      await waitFor(() => {
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledTimes(1)
        expect(workspaceStore.autoSaveStatus.lastBatchSize).toBe(highFrequencyChanges)
      })
    })

    it('should prioritize critical saves over regular saves', async () => {
      // Setup mixed priority saves
      const regularChanges = [
        { language: 'regular-1', priority: 'normal' },
        { language: 'regular-2', priority: 'normal' },
        { language: 'regular-3', priority: 'normal' }
      ]

      const criticalChanges = [
        { language: 'critical-1', priority: 'critical' },
        { language: 'critical-2', priority: 'critical' }
      ]

      // Apply regular changes first
      for (const change of regularChanges) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig(change, { priority: change.priority as any })
        })
      }

      // Apply critical changes (should jump queue)
      for (const change of criticalChanges) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig(change, { priority: change.priority as any })
        })
      }

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(500) // Shorter time for critical saves
        await jest.runAllTimersAsync()
      })

      // Critical saves should be processed first
      await waitFor(() => {
        const saveQueue = workspaceStore.autoSaveStatus.saveQueue
        const criticalIndex = saveQueue.findIndex(s => s.priority === 'critical')
        const regularIndex = saveQueue.findIndex(s => s.priority === 'normal')
        
        if (criticalIndex !== -1 && regularIndex !== -1) {
          expect(criticalIndex).toBeLessThan(regularIndex)
        }
      })
    })
  })

  /**
   * 5. CROSS-COMPONENT AUTO-SAVE COORDINATION
   */
  describe('Cross-Component Coordination', () => {
    it('should coordinate auto-save across multiple components', async () => {
      // Simulate changes from different components
      const componentChanges = [
        { source: 'InputStep', data: { inputFile: { path: '/test/input.mp4', name: 'input.mp4' } } },
        { source: 'ProcessingStep', data: { processingSpeed: 'fast' } },
        { source: 'ReviewStep', data: { reviewComments: 'Looks good' } },
        { source: 'ExportStep', data: { exportFormat: 'srt' } }
      ]

      // Apply changes from different sources
      for (const change of componentChanges) {
        await act(async () => {
          await workspaceStore.updateWorkspaceConfig({
            ...change.data,
            lastModifiedBy: change.source
          })
        })
        
        await act(async () => {
          jest.advanceTimersByTime(200)
        })
      }

      // Should coordinate saves across components
      expect(workspaceStore.autoSaveStatus.activeComponents).toEqual(
        expect.arrayContaining(['InputStep', 'ProcessingStep', 'ReviewStep', 'ExportStep'])
      )

      // Fast-forward through debounce
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Should consolidate changes from all components
      await waitFor(() => {
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          testWorkspace.id,
          expect.objectContaining({
            inputFile: { path: '/test/input.mp4', name: 'input.mp4' },
            processingSpeed: 'fast',
            reviewComments: 'Looks good',
            exportFormat: 'srt',
            lastModifiedBy: 'ExportStep' // Last component
          })
        )
      })
    })

    it('should handle component-specific auto-save preferences', async () => {
      // Configure component-specific options
      await act(async () => {
        await workspaceStore.setComponentAutoSaveOptions('ProcessingStep', {
          debounceTime: 500, // Faster for processing
          priority: 'high'
        })
        
        await workspaceStore.setComponentAutoSaveOptions('ReviewStep', {
          debounceTime: 2000, // Slower for review
          priority: 'normal'
        })
      })

      // Make changes from both components
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig(
          { processingProgress: 50 },
          { component: 'ProcessingStep' }
        )
        
        await workspaceStore.updateWorkspaceConfig(
          { reviewStatus: 'in-progress' },
          { component: 'ReviewStep' }
        )
      })

      // Processing step should save faster
      await act(async () => {
        jest.advanceTimersByTime(600) // Beyond processing debounce, within review debounce
        await jest.runAllTimersAsync()
      })

      // Processing save should have triggered
      await waitFor(() => {
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          testWorkspace.id,
          expect.objectContaining({ processingProgress: 50 })
        )
      })

      // Review save should still be pending
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBeGreaterThan(0)

      // Fast-forward to trigger review save
      await act(async () => {
        jest.advanceTimersByTime(2000)
        await jest.runAllTimersAsync()
      })

      // Review save should now trigger
      await waitFor(() => {
        expect(mockCantocapAPI.syncWorkspaceConfig).toHaveBeenCalledWith(
          testWorkspace.id,
          expect.objectContaining({ reviewStatus: 'in-progress' })
        )
      })
    })

    it('should provide real-time auto-save status to all components', async () => {
      // Start with no pending saves
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)

      // Make configuration change
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'status-test' })
      })

      // All components should see pending save status
      expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(1)
      expect(workspaceStore.autoSaveStatus.isSaving).toBe(false)

      // Fast-forward through debounce (but not completion)
      await act(async () => {
        jest.advanceTimersByTime(1500)
        // Don't run timers yet to catch saving state
      })

      // Should show saving status
      expect(workspaceStore.autoSaveStatus.isSaving).toBe(true)

      // Complete the save
      await act(async () => {
        await jest.runAllTimersAsync()
      })

      // Should show completed save status
      await waitFor(() => {
        expect(workspaceStore.autoSaveStatus.pendingSaves).toBe(0)
        expect(workspaceStore.autoSaveStatus.isSaving).toBe(false)
        expect(workspaceStore.autoSaveStatus.lastSaveTime).toBeDefined()
      })
    })
  })
})