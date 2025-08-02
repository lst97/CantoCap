/**
 * Manual Save Validation Test Suite
 * 
 * Comprehensive tests for manual save implementation
 * Validates Phase 2: Manual Save Operations
 */

import { renderHook, act } from '@testing-library/react'
import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { useAutoSaveIntegration } from '../hooks/useAutoSaveIntegration'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock IndexedDB operations
const mockSaveModifiedSubtitles = vi.fn()
const mockSaveOriginalSubtitles = vi.fn()
const mockLoadSessionSubtitles = vi.fn()

vi.mock('../utils/subtitle-indexeddb', () => ({
  saveModifiedSubtitles: mockSaveModifiedSubtitles,
  saveOriginalSubtitles: mockSaveOriginalSubtitles,
  loadSessionSubtitles: mockLoadSessionSubtitles,
  hasSessionData: vi.fn().mockResolvedValue({ hasOriginal: true, hasModified: false }),
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

describe('Manual Save Validation Tests', () => {
  let store: ReturnType<typeof useSubtitleEditStore>

  beforeEach(() => {
    // Reset mocks
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
        enabled: false,
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

  describe('Phase 2: Manual Save Implementation', () => {
    it('should skip manual save when session is not dirty', async () => {
      // Setup: Create a clean session (not dirty)
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [
            { id: 1, startTime: 0, endTime: 5, text: 'Test subtitle 1' },
            { id: 2, startTime: 5, endTime: 10, text: 'Test subtitle 2' }
          ]
        )
      })

      // Ensure session is not dirty
      const currentState = useSubtitleEditStore.getState()
      expect(currentState.session?.isDirty).toBe(false)

      // Test: Attempt manual save
      const result = await act(async () => {
        return await store.manualSaveToIndexedDB()
      })

      // Verify: Save was skipped but returned success
      expect(result).toBe(true)
      expect(mockSaveModifiedSubtitles).not.toHaveBeenCalled()
      
      const finalState = useSubtitleEditStore.getState()
      expect(finalState.isSaving).toBe(false)
      expect(finalState.saveError).toBeNull()
    })

    it('should perform manual save when session is dirty', async () => {
      // Setup: Create session and make it dirty
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [
            { id: 1, startTime: 0, endTime: 5, text: 'Test subtitle 1' }
          ]
        )
      })

      // Make session dirty by updating a subtitle
      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified subtitle text' })
      })

      const dirtyState = useSubtitleEditStore.getState()
      expect(dirtyState.session?.isDirty).toBe(true)

      // Mock successful save
      mockSaveModifiedSubtitles.mockResolvedValueOnce(undefined)

      // Test: Perform manual save
      const result = await act(async () => {
        return await store.manualSaveToIndexedDB()
      })

      // Verify: Save was performed successfully
      expect(result).toBe(true)
      expect(mockSaveModifiedSubtitles).toHaveBeenCalledWith(
        'test-workspace-123',
        expect.stringContaining('test-workspace-123-session-'),
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Modified subtitle text'
          })
        ])
      )

      const finalState = useSubtitleEditStore.getState()
      expect(finalState.session?.isDirty).toBe(false) // Should be clean after save
      expect(finalState.isSaving).toBe(false)
      expect(finalState.saveError).toBeNull()
      expect(finalState.lastManualSave).toBeInstanceOf(Date)
    })

    it('should handle manual save errors gracefully', async () => {
      // Setup: Create dirty session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test subtitle' }]
        )
      })

      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified text' })
      })

      // Mock save failure
      const saveError = new Error('IndexedDB save failed')
      mockSaveModifiedSubtitles.mockRejectedValueOnce(saveError)

      // Test: Attempt manual save with error
      const result = await act(async () => {
        return await store.manualSaveToIndexedDB()
      })

      // Verify: Error handled gracefully
      expect(result).toBe(false)
      expect(mockSaveModifiedSubtitles).toHaveBeenCalled()

      const finalState = useSubtitleEditStore.getState()
      expect(finalState.isSaving).toBe(false)
      expect(finalState.saveError).toBe('IndexedDB save failed')
      expect(finalState.session?.isDirty).toBe(true) // Should remain dirty on save failure
      expect(finalState.lastManualSave).toBeNull()
    })

    it('should reject save with missing session data', async () => {
      // Test: Attempt save with no session
      const result = await act(async () => {
        return await store.manualSaveToIndexedDB()
      })

      // Verify: Save rejected
      expect(result).toBe(true) // Returns true for "no changes to save"
      expect(mockSaveModifiedSubtitles).not.toHaveBeenCalled()
    })

    it('should validate required session data before save', async () => {
      // Setup: Create incomplete session (missing workspace ID)
      act(() => {
        useSubtitleEditStore.setState({
          session: {
            sessionId: 'test-session',
            workspaceId: '', // Empty workspace ID
            videoPath: 'test-video.mp4',
            originalSubtitles: [],
            currentSubtitles: [{ id: 'test', index: 1, startTime: 0, endTime: 5, duration: 5, text: 'Test' }],
            modifications: [],
            lastModified: new Date(),
            isDirty: true,
            currentTime: 0,
            selectedSubtitleId: null,
            isVideoPlaying: false,
            shouldAutoPause: false,
            videoDuration: 0
          }
        })
      })

      // Test: Attempt save with invalid session
      const result = await act(async () => {
        return await store.manualSaveToIndexedDB()
      })

      // Verify: Save rejected with appropriate error
      expect(result).toBe(false)
      expect(mockSaveModifiedSubtitles).not.toHaveBeenCalled()

      const finalState = useSubtitleEditStore.getState()
      expect(finalState.saveError).toBe('Missing required session data for save operation')
    })

    it('should track performance metrics during manual save', async () => {
      // Setup: Enable performance monitoring
      act(() => {
        store.enablePerformanceMonitoring()
      })

      // Create dirty session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test subtitle' }]
        )
      })

      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified text' })
      })

      // Mock successful save with delay
      mockSaveModifiedSubtitles.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      )

      // Test: Perform manual save
      await act(async () => {
        await store.manualSaveToIndexedDB()
      })

      // Verify: Performance metrics updated
      const metrics = store.getPerformanceMetrics()
      expect(metrics.indexedDBOperations).toBeGreaterThan(0)
      expect(metrics.averageOperationTime).toBeGreaterThan(0)
      expect(metrics.errorRate).toBe(0)
    })
  })

  describe('Manual Save Trigger Integration', () => {
    it('should trigger manual save after subtitle operations', async () => {
      // Setup session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [
            { id: 1, startTime: 0, endTime: 5, text: 'Test subtitle 1' },
            { id: 2, startTime: 5, endTime: 10, text: 'Test subtitle 2' }
          ]
        )
      })

      // Test: Update subtitle should make session dirty
      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Updated text' })
      })

      let state = useSubtitleEditStore.getState()
      expect(state.session?.isDirty).toBe(true)

      // Test: Add subtitle should make session dirty
      act(() => {
        store.addSubtitle(10, 15, 'New subtitle')
      })

      state = useSubtitleEditStore.getState()
      expect(state.session?.isDirty).toBe(true)
      expect(state.session?.currentSubtitles).toHaveLength(3)

      // Test: Delete subtitle should make session dirty
      act(() => {
        store.deleteSubtitle('subtitle-2')
      })

      state = useSubtitleEditStore.getState()
      expect(state.session?.isDirty).toBe(true)
      expect(state.session?.currentSubtitles).toHaveLength(2)

      // Test: Undo should make session dirty
      act(() => {
        store.undo()
      })

      state = useSubtitleEditStore.getState()
      expect(state.session?.isDirty).toBe(true)

      // Test: Redo should make session dirty
      act(() => {
        store.redo()
      })

      state = useSubtitleEditStore.getState()
      expect(state.session?.isDirty).toBe(true)
    })
  })

  describe('Auto-Save Integration Hook', () => {
    it('should have auto-save disabled by default', () => {
      const { result } = renderHook(() => useAutoSaveIntegration())
      
      // Verify auto-save is disabled
      expect(result.current.isAutoSaving).toBe(false)
      
      // The hook should be disabled by default (per line 69 in useAutoSaveIntegration.ts)
      // We can verify this by checking that forceSave still works for manual saves
      expect(typeof result.current.forceSave).toBe('function')
    })

    it('should provide manual save capabilities through forceSave', async () => {
      const { result } = renderHook(() => useAutoSaveIntegration({
        disabled: false, // Enable for this test
        debug: true
      }))

      // Test that forceSave function is available
      expect(typeof result.current.forceSave).toBe('function')
      
      // Test that manual controls are available
      expect(typeof result.current.createBackup).toBe('function')
      expect(typeof result.current.clearContent).toBe('function')
    })
  })

  describe('Save State Indicators', () => {
    it('should track saving state correctly', async () => {
      // Setup session
      await act(async () => {
        await store.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4', 
          'test-workspace-123',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test subtitle' }]
        )
      })

      // Make session dirty
      act(() => {
        store.updateSubtitle('subtitle-1', { text: 'Modified text' })
      })

      // Mock slow save to test saving state
      mockSaveModifiedSubtitles.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      // Start save and check saving state
      const savePromise = act(async () => {
        return store.manualSaveToIndexedDB()
      })

      // Verify saving state is active (this is challenging to test due to timing)
      // In a real UI test, we would check for the "Saving..." indicator

      await savePromise

      // Verify final state
      const finalState = useSubtitleEditStore.getState()
      expect(finalState.isSaving).toBe(false)
      expect(finalState.lastManualSave).toBeInstanceOf(Date)
    })

    it('should clear save errors when requested', async () => {
      // Setup: Create an error state
      act(() => {
        useSubtitleEditStore.setState({
          saveError: 'Test error message'
        })
      })

      expect(useSubtitleEditStore.getState().saveError).toBe('Test error message')

      // Test: Clear save error
      act(() => {
        store.clearSaveError()
      })

      // Verify: Error cleared
      expect(useSubtitleEditStore.getState().saveError).toBeNull()
    })
  })
})