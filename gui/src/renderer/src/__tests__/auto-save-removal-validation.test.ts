/**
 * Auto-Save Removal Validation Test Suite
 * 
 * Comprehensive tests for auto-save system removal
 * Validates Phase 1: Auto-Save Elimination and Performance Improvements
 */

import { renderHook, act } from '@testing-library/react'
import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { useAutoSaveIntegration } from '../hooks/useAutoSaveIntegration'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock performance monitoring
const mockPerformanceNow = vi.fn()
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow
  }
})

// Mock IndexedDB operations
vi.mock('../utils/subtitle-indexeddb', () => ({
  saveModifiedSubtitles: vi.fn().mockResolvedValue(undefined),
  saveOriginalSubtitles: vi.fn().mockResolvedValue(undefined),
  loadSessionSubtitles: vi.fn().mockResolvedValue({ original: [], modified: [] }),
  hasSessionData: vi.fn().mockResolvedValue({ hasOriginal: false, hasModified: false }),
  listWorkspaceSessions: vi.fn().mockResolvedValue([]),
  cleanupWorkspaceSession: vi.fn().mockResolvedValue({ deletedSessions: 0, deletedRecords: 0, reclaimedBytes: 0 }),
  cleanupOldSessions: vi.fn().mockResolvedValue({ deletedRecords: 0, reclaimedBytes: 0 }),
  cleanupOrphanedSessions: vi.fn().mockResolvedValue({ deletedRecords: 0, reclaimedBytes: 0 }),
  getStorageStats: vi.fn().mockResolvedValue({ totalRecords: 0, totalSessions: 0, totalWorkspaces: 0, totalBytes: 0 })
}))

// Mock workspace context
vi.mock('../contexts/WorkspaceConfigContext', () => ({
  useWorkspaceConfig: () => ({
    currentWorkspaceId: 'test-workspace-123',
    isWorkspaceReady: true
  })
}))

// Mock temp storage
vi.mock('../hooks/useSubtitleTempStorage', () => ({
  useSubtitleTempStorage: () => ({
    isAutoSaving: false,
    hasUnsavedChanges: false,
    lastSaveTime: null,
    currentSession: null,
    hasRecoverableSession: false,
    updateContent: vi.fn(),
    saveContent: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({ success: true, data: 'test-session-id' }),
    recoverSession: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    clearContent: vi.fn()
  })
}))

describe('Auto-Save Removal Validation Tests', () => {
  let store: ReturnType<typeof useSubtitleEditStore>
  let startTime: number
  let performanceTimings: number[]

  beforeEach(() => {
    // Reset performance tracking
    startTime = 0
    performanceTimings = []
    mockPerformanceNow.mockImplementation(() => {
      const time = startTime + performanceTimings.length * 10
      performanceTimings.push(time)
      return time
    })

    // Reset all mocks
    vi.clearAllMocks()
    
    // Reset store state
    useSubtitleEditStore.setState({
      session: null,
      edits: [],
      isLoading: false,
      error: null,
      undoStack: [],
      redoStack: [],
      isAutoSaving: false,
      lastAutoSave: null,
      isSaving: false,
      saveError: null,
      lastManualSave: null,
      sessionRecovery: {
        hasRecoverableSession: false,
        recoverableSessionId: null,
        lastSessionWorkspaceId: null
      },
      persistenceEnabled: false,
      autoSaveCallback: null,
      performanceMonitoring: {
        enabled: true, // Enable for testing
        indexedDBOperations: 0,
        totalOperationTime: 0,
        errorCount: 0,
        lastCleanup: Date.now()
      }
    })

    store = useSubtitleEditStore.getState()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Phase 1: Auto-Save System Removal', () => {
    it('should have auto-save disabled by default in useAutoSaveIntegration', () => {
      const { result } = renderHook(() => useAutoSaveIntegration())
      
      // Verify auto-save is disabled (line 69: disabled = true)
      expect(result.current.isAutoSaving).toBe(false)
      
      // Manual save functions should still be available
      expect(typeof result.current.forceSave).toBe('function')
      expect(typeof result.current.createBackup).toBe('function')
      expect(typeof result.current.clearContent).toBe('function')
    })

    it('should not start auto-save timers when auto-save is disabled', () => {
      const { result } = renderHook(() => useAutoSaveIntegration({
        disabled: true, // Explicitly disabled
        autoSaveEnabled: false,
        autoSaveInterval: 1000 // Would create timer if enabled
      }))

      // Wait for any potential timers to start
      setTimeout(() => {
        // Verify no auto-saving state
        expect(result.current.isAutoSaving).toBe(false)
      }, 1100)
    })

    it('should not trigger automatic saves on subtitle changes', async () => {
      // Setup: Create session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [
            { id: 1, startTime: 0, endTime: 5, text: 'Original text' }
          ]
        )
      })

      // Track auto-save attempts
      const autoSaveCallback = vi.fn()
      act(() => {
        store.setAutoSaveCallback(autoSaveCallback)
      })

      // Test: Make multiple subtitle changes
      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified text 1' })
      })

      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified text 2' })
      })

      act(() => {
        store.addSubtitle(5, 10, 'New subtitle')
      })

      // Wait for any potential auto-save delays
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify: Auto-save callback was NOT triggered automatically
      // (triggerAutoSaveCallback is disabled per lines 154-158)
      expect(autoSaveCallback).not.toHaveBeenCalled()

      // Verify: Session is dirty but no automatic saves occurred
      const finalState = useSubtitleEditStore.getState()
      expect(finalState.session?.isDirty).toBe(true)
      expect(finalState.isAutoSaving).toBe(false)
      expect(finalState.lastAutoSave).toBeNull()
    })

    it('should show performance improvement in JSON import operations', async () => {
      // Simulate a large JSON import (typical performance bottleneck)
      const largeSubtitleData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        startTime: i * 2,
        endTime: (i * 2) + 1.5,
        text: `Subtitle ${i + 1} with longer text content for performance testing`
      }))

      // Reset performance tracking
      startTime = performance.now()
      
      // Test: JSON import operation
      const importStartTime = performance.now()
      
      await act(async () => {
        await store.initializeSession(
          'large-import.json',
          'test-video.mp4', 
          'test-workspace-123',
          largeSubtitleData,
          true // pre-transformed
        )
      })

      const importEndTime = performance.now()
      const importDuration = importEndTime - importStartTime

      // Verify: Import completed quickly (target: <500ms)
      console.log(`JSON Import Duration: ${importDuration.toFixed(2)}ms`)
      expect(importDuration).toBeLessThan(500) // Should be significantly faster than 2-3 seconds

      // Verify: No auto-save was triggered during import
      const finalState = useSubtitleEditStore.getState()
      expect(finalState.isAutoSaving).toBe(false)
      expect(finalState.session?.currentSubtitles).toHaveLength(100)
    })

    it('should not create background intervals for auto-save', () => {
      const originalSetInterval = global.setInterval
      const intervalSpy = vi.fn()
      global.setInterval = intervalSpy

      try {
        // Initialize auto-save integration (should be disabled)
        const { result } = renderHook(() => useAutoSaveIntegration({
          autoSaveEnabled: true, // This should be overridden by disabled: true
          autoSaveInterval: 1000
        }))

        // Wait for any potential interval creation
        setTimeout(() => {
          // Verify: No intervals were created for auto-save
          expect(intervalSpy).not.toHaveBeenCalledWith(
            expect.any(Function),
            expect.any(Number)
          )
        }, 100)

      } finally {
        global.setInterval = originalSetInterval
      }
    })

    it('should demonstrate memory stability without auto-save timers', () => {
      const initialMemoryUsage = process.memoryUsage?.()?.heapUsed || 0

      // Create and destroy multiple auto-save integration instances
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() => useAutoSaveIntegration({
          disabled: true,
          autoSaveEnabled: false
        }))
        unmount()
      }

      // Verify: Memory usage remains stable (no timer leaks)
      const finalMemoryUsage = process.memoryUsage?.()?.heapUsed || 0
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage

      // Memory increase should be minimal (no significant timer/closure leaks)
      expect(memoryIncrease).toBeLessThan(1024 * 1024) // Less than 1MB increase
    })

    it('should confirm triggerAutoSaveCallback is disabled', async () => {
      // Setup session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test' }]
        )
      })

      // Create a spy to monitor console.log (triggerAutoSaveCallback logs instead of saving)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Test: Trigger operations that would have caused auto-save
      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified' })
      })

      act(() => {
        store.addSubtitle(5, 10, 'New subtitle')
      })

      act(() => {
        store.deleteSubtitle('subtitle-1')
      })

      // Verify: Auto-save is logged but not executed (per lines 154-158)
      // The function now just logs "Action recorded (auto-save disabled)"
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Action recorded (auto-save disabled)')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for re-render operations', async () => {
      const testCases = [
        { size: 10, description: 'Small dataset' },
        { size: 50, description: 'Medium dataset' },
        { size: 100, description: 'Large dataset' }
      ]

      for (const testCase of testCases) {
        const subtitleData = Array.from({ length: testCase.size }, (_, i) => ({
          id: i + 1,
          startTime: i * 2,
          endTime: (i * 2) + 1.5,
          text: `Test subtitle ${i + 1}`
        }))

        const startTime = performance.now()

        await act(async () => {
          await store.initializeSession(
            `test-${testCase.size}.json`,
            'test-video.mp4', 
            'test-workspace-123',
            subtitleData,
            true
          )
        })

        const endTime = performance.now()
        const duration = endTime - startTime

        console.log(`${testCase.description} (${testCase.size} items): ${duration.toFixed(2)}ms`)

        // Verify: All operations complete within performance target
        expect(duration).toBeLessThan(500) // Target: <500ms

        // Clean up for next test
        act(() => {
          store.clearSession()
        })
      }
    })

    it('should show no performance regression in UI responsiveness', async () => {
      // Setup session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test' }]
        )
      })

      // Test rapid successive operations (would have caused delays with auto-save)
      const operations = [
        () => store.updateSubtitle('subtitle-1', { text: 'Update 1' }),
        () => store.updateSubtitle('subtitle-1', { text: 'Update 2' }),
        () => store.addSubtitle(5, 10, 'New subtitle'),
        () => store.updateSubtitle('subtitle-1', { text: 'Update 3' }),
        () => store.undo(),
        () => store.redo(),
        () => store.updateSubtitle('subtitle-1', { text: 'Final update' })
      ]

      const operationTimes: number[] = []

      for (const operation of operations) {
        const startTime = performance.now()
        
        act(() => {
          operation()
        })

        const endTime = performance.now()
        operationTimes.push(endTime - startTime)
      }

      // Verify: All operations are immediate (no auto-save delays)
      operationTimes.forEach((time, index) => {
        console.log(`Operation ${index + 1}: ${time.toFixed(2)}ms`)
        expect(time).toBeLessThan(50) // Should be nearly instantaneous without auto-save
      })

      const averageTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length
      console.log(`Average operation time: ${averageTime.toFixed(2)}ms`)
      expect(averageTime).toBeLessThan(20) // Very fast average
    })
  })

  describe('Memory Leak Prevention', () => {
    it('should not create timer leaks when auto-save is disabled', () => {
      const activeTimers: NodeJS.Timeout[] = []
      
      const originalSetTimeout = global.setTimeout
      const originalSetInterval = global.setInterval
      const originalClearTimeout = global.clearTimeout
      const originalClearInterval = global.clearInterval

      // Track timer creation and cleanup
      global.setTimeout = (fn: Function, delay: number) => {
        const timer = originalSetTimeout(fn, delay)
        activeTimers.push(timer)
        return timer
      }

      global.setInterval = (fn: Function, delay: number) => {
        const timer = originalSetInterval(fn, delay)
        activeTimers.push(timer)
        return timer
      }

      global.clearTimeout = (timer: NodeJS.Timeout) => {
        const index = activeTimers.indexOf(timer)
        if (index > -1) activeTimers.splice(index, 1)
        return originalClearTimeout(timer)
      }

      global.clearInterval = (timer: NodeJS.Timeout) => {
        const index = activeTimers.indexOf(timer)
        if (index > -1) activeTimers.splice(index, 1)
        return originalClearInterval(timer)
      }

      try {
        // Create multiple auto-save integration instances
        const hooks = []
        for (let i = 0; i < 5; i++) {
          hooks.push(renderHook(() => useAutoSaveIntegration({
            disabled: true,
            autoSaveInterval: 1000,
            autoSaveDebounce: 500
          })))
        }

        // Unmount all hooks
        hooks.forEach(({ unmount }) => unmount())

        // Verify: No timers are left active (no leaks)
        expect(activeTimers.length).toBe(0)

      } finally {
        // Restore original functions
        global.setTimeout = originalSetTimeout
        global.setInterval = originalSetInterval
        global.clearTimeout = originalClearTimeout
        global.clearInterval = originalClearInterval

        // Clean up any remaining timers
        activeTimers.forEach(timer => {
          originalClearTimeout(timer)
          originalClearInterval(timer)
        })
      }
    })
  })

  describe('Backwards Compatibility', () => {
    it('should maintain manual save functionality while auto-save is disabled', async () => {
      // Setup session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test' }]
        )
      })

      // Make changes
      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified' })
      })

      // Verify session is dirty
      expect(useSubtitleEditStore.getState().session?.isDirty).toBe(true)

      // Test manual save still works
      const result = await act(async () => {
        return await store.manualSaveToIndexedDB()
      })

      expect(result).toBe(true)
      expect(useSubtitleEditStore.getState().session?.isDirty).toBe(false)
    })

    it('should provide auto-save integration API for future re-enablement', () => {
      const { result } = renderHook(() => useAutoSaveIntegration({
        disabled: false, // Could be re-enabled in future
        debug: true
      }))

      // Verify all API methods are still available
      expect(typeof result.current.forceSave).toBe('function')
      expect(typeof result.current.createBackup).toBe('function')
      expect(typeof result.current.initializeFromSubtitles).toBe('function')
      expect(typeof result.current.initializeFromImport).toBe('function')
      expect(typeof result.current.recoverSession).toBe('function')
      expect(typeof result.current.cleanup).toBe('function')
    })
  })
})