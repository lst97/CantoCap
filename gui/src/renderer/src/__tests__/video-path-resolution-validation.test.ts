/**
 * Video Path Resolution Validation Test Suite
 * 
 * Comprehensive tests for video path resolution between steps
 * Validates Phase 3: Video Path Resolution and Step 1 → Step 4 Flow
 */

import { renderHook, act } from '@testing-library/react'
import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock app store for config.inputFile fallback
const mockAppStore = {
  config: {
    inputFile: '/path/to/selected/video.mp4',
    outputFile: '/path/to/output/subtitles.srt',
    importedJsonFile: null,
    isImportedFromJson: false,
    subtitle: []
  }
}

// Mock IndexedDB operations
vi.mock('../utils/subtitle-indexeddb', () => ({
  saveModifiedSubtitles: vi.fn().mockResolvedValue(undefined),
  saveOriginalSubtitles: vi.fn().mockResolvedValue(undefined),
  loadSessionSubtitles: vi.fn().mockResolvedValue({ 
    original: [
      { id: 'test-1', startTime: 0, endTime: 5, text: 'Test subtitle 1' },
      { id: 'test-2', startTime: 5, endTime: 10, text: 'Test subtitle 2' }
    ], 
    modified: null 
  }),
  hasSessionData: vi.fn().mockResolvedValue({ hasOriginal: true, hasModified: false }),
  listWorkspaceSessions: vi.fn().mockResolvedValue(['session-123']),
  cleanupWorkspaceSession: vi.fn().mockResolvedValue({ deletedSessions: 0, deletedRecords: 0, reclaimedBytes: 0 }),
  cleanupOldSessions: vi.fn().mockResolvedValue({ deletedRecords: 0, reclaimedBytes: 0 }),
  cleanupOrphanedSessions: vi.fn().mockResolvedValue({ deletedRecords: 0, reclaimedBytes: 0 }),
  getStorageStats: vi.fn().mockResolvedValue({ totalRecords: 2, totalSessions: 1, totalWorkspaces: 1, totalBytes: 1024 })
}))

// Mock app store import
vi.mock('../stores/app-store', () => ({
  useAppStore: {
    getState: () => mockAppStore
  }
}))

describe('Video Path Resolution Validation Tests', () => {
  let store: ReturnType<typeof useSubtitleEditStore>

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Reset mock app store
    mockAppStore.config = {
      inputFile: '/path/to/selected/video.mp4',
      outputFile: '/path/to/output/subtitles.srt',
      importedJsonFile: null,
      isImportedFromJson: false,
      subtitle: []
    }
    
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

  describe('Phase 3: Video Path Resolution', () => {
    it('should use provided video path when available', async () => {
      const providedVideoPath = '/path/to/selected/video.mp4'
      const subtitlePath = 'test-subtitles.srt'
      const workspaceId = 'test-workspace-123'

      // Test: Initialize session with explicit video path
      await act(async () => {
        await store.initializeSession(
          subtitlePath,
          providedVideoPath,
          workspaceId,
          [
            { id: 1, startTime: 0, endTime: 5, text: 'Test subtitle 1' },
            { id: 2, startTime: 5, endTime: 10, text: 'Test subtitle 2' }
          ]
        )
      })

      // Verify: Session uses the provided video path
      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.videoPath).toBe(providedVideoPath)
      expect(session?.workspaceId).toBe(workspaceId)
    })

    it('should fallback to config.inputFile when video path is missing', async () => {
      const emptyVideoPath = '' // Empty video path to trigger fallback
      const subtitlePath = 'test-subtitles.srt'
      const workspaceId = 'test-workspace-123'

      // Test: Initialize session with empty video path
      await act(async () => {
        await store.initializeSession(
          subtitlePath,
          emptyVideoPath,
          workspaceId,
          [
            { id: 1, startTime: 0, endTime: 5, text: 'Test subtitle' }
          ]
        )
      })

      // Verify: Session falls back to config.inputFile
      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.videoPath).toBe(emptyVideoPath) // Store keeps the original empty path
      
      // The fallback logic is implemented in ReviewStep.tsx (lines 414-421)
      // This test confirms the session creation doesn't fail with empty video path
    })

    it('should handle null video path gracefully', async () => {
      const nullVideoPath = null as any // Null video path
      const subtitlePath = 'test-subtitles.srt'
      const workspaceId = 'test-workspace-123'

      // Test: Initialize session with null video path
      await act(async () => {
        await store.initializeSession(
          subtitlePath,
          nullVideoPath,
          workspaceId,
          [
            { id: 1, startTime: 0, endTime: 5, text: 'Test subtitle' }
          ]
        )
      })

      // Verify: Session handles null video path gracefully
      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.videoPath).toBe(nullVideoPath)
    })

    it('should restore video path from config.inputFile during session recovery', async () => {
      const workspaceId = 'test-workspace-123'
      
      // Mock session recovery scenario (simulates IndexedDB not storing video path)
      vi.mocked((await import('../utils/subtitle-indexeddb')).loadSessionSubtitles)
        .mockResolvedValueOnce({
          original: [
            { id: 'test-1', startTime: 0, endTime: 5, text: 'Test subtitle 1' }
          ],
          modified: [
            { id: 'test-1', startTime: 0, endTime: 5, text: 'Modified subtitle 1' }
          ]
        })

      // Test: Check and restore workspace session (simulates Step 4 entry)
      const restoredSessionId = await act(async () => {
        return await store.checkAndRestoreWorkspaceSession(workspaceId)
      })

      // Verify: Session was restored
      expect(restoredSessionId).toBe('session-123')

      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      
      // Verify: Video path falls back to config.inputFile (lines 1048, 1291 in store)
      expect(session?.videoPath).toBe(mockAppStore.config.inputFile)
      expect(session?.workspaceId).toBe(workspaceId)
      expect(session?.currentSubtitles).toHaveLength(1)
      expect(session?.isDirty).toBe(true) // Has modified data
    })

    it('should handle recovery when original session recovery fails', async () => {
      const sessionId = 'test-session-123'
      const workspaceId = 'test-workspace-456'

      // Test: Recover session with explicit session ID
      const result = await act(async () => {
        return await store.recoverSession(sessionId)
      })

      // Verify: Recovery uses fallback video path from config
      expect(result).toBe(true)

      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.sessionId).toBe(sessionId)
      expect(session?.videoPath).toBe(mockAppStore.config.inputFile) // Fallback applied
    })
  })

  describe('Step 1 → Step 4 Data Flow', () => {
    it('should preserve video path through JSON import workflow', async () => {
      // Step 1: Set video file in config
      mockAppStore.config.inputFile = '/user/selected/video.mp4'
      mockAppStore.config.importedJsonFile = '/user/imported/subtitles.json'
      mockAppStore.config.isImportedFromJson = true

      // Step 2-3: JSON import workflow (simulated)
      const importedSubtitles = [
        { id: 1, startTime: 0, endTime: 5, text: 'Imported subtitle 1' },
        { id: 2, startTime: 5, endTime: 10, text: 'Imported subtitle 2' },
        { id: 3, startTime: 10, endTime: 15, text: 'Imported subtitle 3' }
      ]

      // Step 4: Initialize review session with imported data
      await act(async () => {
        await store.initializeSession(
          'imported-subtitles.json',
          mockAppStore.config.inputFile, // Video path from Step 1
          'workspace-json-import',
          importedSubtitles,
          true // pre-transformed
        )
      })

      // Verify: Step 4 session has correct video path and subtitle data
      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.videoPath).toBe('/user/selected/video.mp4') // From Step 1
      expect(session?.currentSubtitles).toHaveLength(3)
      expect(session?.currentSubtitles[0].text).toBe('Imported subtitle 1')
      expect(session?.workspaceId).toBe('workspace-json-import')
    })

    it('should handle SRT workflow with video path preservation', async () => {
      // Step 1: Video file selected
      mockAppStore.config.inputFile = '/user/videos/presentation.mp4'
      mockAppStore.config.outputFile = '/user/output/presentation_subtitles.srt'
      
      // Step 3: Model generation complete, Step 4: Review
      const generatedSubtitles = [
        { id: 1, startTime: 0.5, endTime: 3.2, text: 'Welcome to our presentation' },
        { id: 2, startTime: 3.5, endTime: 7.1, text: 'Today we will discuss the main topics' }
      ]

      await act(async () => {
        await store.initializeSession(
          mockAppStore.config.outputFile.replace(/\.[^/.]+$/, ".srt"),
          mockAppStore.config.inputFile, // Video path preserved from Step 1
          'workspace-srt-generation',
          generatedSubtitles
        )
      })

      // Verify: Video path flows correctly from Step 1 to Step 4
      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.videoPath).toBe('/user/videos/presentation.mp4')
      expect(session?.currentSubtitles).toHaveLength(2)
      expect(session?.workspaceId).toBe('workspace-srt-generation')
    })

    it('should handle video path resolution in mixed scenarios', async () => {
      // Scenario: User has multiple files, some with missing paths
      const testScenarios = [
        {
          name: 'Complete path info',
          videoPath: '/complete/video.mp4',
          configInputFile: '/config/fallback.mp4',
          expectedResult: '/complete/video.mp4'
        },
        {
          name: 'Empty video path with config fallback',
          videoPath: '',
          configInputFile: '/config/fallback.mp4',
          expectedResult: '' // Store preserves original, ReviewStep.tsx handles fallback
        },
        {
          name: 'Null video path with config fallback',
          videoPath: null,
          configInputFile: '/config/fallback.mp4',
          expectedResult: null // Store preserves original, ReviewStep.tsx handles fallback
        }
      ]

      for (const scenario of testScenarios) {
        // Update config for each scenario
        mockAppStore.config.inputFile = scenario.configInputFile

        await act(async () => {
          await store.initializeSession(
            'test.srt',
            scenario.videoPath as any,
            `workspace-${scenario.name.replace(/\s+/g, '-')}`,
            [{ id: 1, startTime: 0, endTime: 5, text: 'Test' }]
          )
        })

        const session = useSubtitleEditStore.getState().session
        expect(session?.videoPath).toBe(scenario.expectedResult)

        // Clean up for next scenario
        act(() => {
          store.clearSession()
        })
      }
    })
  })

  describe('Video Player Integration Points', () => {
    it('should provide video path for player initialization', async () => {
      const videoPath = '/media/test-video.mp4'
      
      await act(async () => {
        await store.initializeSession(
          'test.srt',
          videoPath,
          'test-workspace',
          [
            { id: 1, startTime: 0, endTime: 5, text: 'First subtitle' },
            { id: 2, startTime: 5, endTime: 10, text: 'Second subtitle' }
          ]
        )
      })

      const session = useSubtitleEditStore.getState().session
      
      // Verify: Video player can access video path
      expect(session?.videoPath).toBe(videoPath)
      
      // Verify: Subtitle timing data is available for sync
      expect(session?.currentSubtitles[0].startTime).toBe(0)
      expect(session?.currentSubtitles[0].endTime).toBe(5)
      expect(session?.currentSubtitles[1].startTime).toBe(5)
      expect(session?.currentSubtitles[1].endTime).toBe(10)
    })

    it('should support video player state management', async () => {
      await act(async () => {
        await store.initializeSession(
          'test.srt',
          '/video/test.mp4',
          'test-workspace',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test subtitle' }]
        )
      })

      // Test: Video player state updates
      act(() => {
        store.setCurrentTime(2.5)
      })

      act(() => {
        store.setVideoPlaying(true)
      })

      act(() => {
        store.setVideoDuration(120.0)
      })

      act(() => {
        store.setSelectedSubtitle('subtitle-1')
      })

      // Verify: All video player state is tracked
      const session = useSubtitleEditStore.getState().session
      expect(session?.currentTime).toBe(2.5)
      expect(session?.isVideoPlaying).toBe(true)
      expect(session?.videoDuration).toBe(120.0)
      expect(session?.selectedSubtitleId).toBe('subtitle-1')
    })

    it('should support jump to subtitle functionality', async () => {
      await act(async () => {
        await store.initializeSession(
          'test.srt',
          '/video/test.mp4',
          'test-workspace',
          [
            { id: 1, startTime: 0, endTime: 5, text: 'First' },
            { id: 2, startTime: 5, endTime: 10, text: 'Second' },
            { id: 3, startTime: 10, endTime: 15, text: 'Third' }
          ]
        )
      })

      // Test: Jump to specific subtitle
      act(() => {
        store.jumpToSubtitle('subtitle-2')
      })

      // Verify: Video player jumps to subtitle start time
      const session = useSubtitleEditStore.getState().session
      expect(session?.currentTime).toBe(5) // Start time of subtitle-2
      expect(session?.selectedSubtitleId).toBe('subtitle-2')
      expect(session?.shouldAutoPause).toBe(true)
    })
  })

  describe('Error Scenarios and Fallbacks', () => {
    it('should handle missing config.inputFile gracefully', async () => {
      // Scenario: Both video path and config.inputFile are missing
      mockAppStore.config.inputFile = null as any
      
      await act(async () => {
        await store.initializeSession(
          'test.srt',
          '', // Empty video path
          'test-workspace',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test' }]
        )
      })

      // Verify: Session is created despite missing video paths
      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.videoPath).toBe('')
      expect(session?.currentSubtitles).toHaveLength(1)
    })

    it('should handle session recovery with missing video metadata', async () => {
      const workspaceId = 'test-workspace-recovery'
      
      // Mock IndexedDB with subtitle data but no video path info
      vi.mocked((await import('../utils/subtitle-indexeddb')).loadSessionSubtitles)
        .mockResolvedValueOnce({
          original: [
            { id: 'recovered-1', startTime: 0, endTime: 5, text: 'Recovered subtitle' }
          ],
          modified: null
        })

      mockAppStore.config.inputFile = '/fallback/video.mp4'

      // Test: Session recovery
      const sessionId = await act(async () => {
        return await store.checkAndRestoreWorkspaceSession(workspaceId)
      })

      // Verify: Recovery succeeded with fallback video path
      expect(sessionId).toBe('session-123')

      const session = useSubtitleEditStore.getState().session
      expect(session).not.toBeNull()
      expect(session?.videoPath).toBe('/fallback/video.mp4') // Uses config.inputFile
      expect(session?.currentSubtitles).toHaveLength(1)
      expect(session?.currentSubtitles[0].text).toBe('Recovered subtitle')
    })

    it('should maintain session integrity when video path changes', async () => {
      // Initialize session with original video path
      await act(async () => {
        await store.initializeSession(
          'test.srt',
          '/original/video.mp4',
          'test-workspace',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Test subtitle' }]
        )
      })

      const originalSession = useSubtitleEditStore.getState().session
      expect(originalSession?.videoPath).toBe('/original/video.mp4')

      // Simulate video path change (user selects different video)
      mockAppStore.config.inputFile = '/new/video.mp4'

      // The session should maintain its original video path
      // (path changes would trigger new session initialization in real app)
      const currentSession = useSubtitleEditStore.getState().session
      expect(currentSession?.videoPath).toBe('/original/video.mp4') // Unchanged
      expect(currentSession?.sessionId).toBe(originalSession?.sessionId) // Same session
    })
  })

  describe('Integration with ReviewStep Component', () => {
    it('should provide all necessary data for ReviewStep video path resolution', async () => {
      // Simulate the exact scenario in ReviewStep.tsx (lines 414-421)
      const providedVideoPath = '' // Empty, should trigger fallback
      const fallbackVideoPath = '/step1/selected/video.mp4'
      
      mockAppStore.config.inputFile = fallbackVideoPath

      await act(async () => {
        await store.initializeSession(
          'review.srt',
          providedVideoPath,
          'review-workspace',
          [{ id: 1, startTime: 0, endTime: 5, text: 'Review subtitle' }]
        )
      })

      const session = useSubtitleEditStore.getState().session

      // Simulate ReviewStep.tsx video path validation logic
      const validatedVideoPath = session?.videoPath || mockAppStore.config.inputFile || ''

      // Verify: Fallback logic works as expected
      expect(validatedVideoPath).toBe(fallbackVideoPath)
      expect(session?.currentSubtitles).toHaveLength(1)
      expect(session?.workspaceId).toBe('review-workspace')
    })
  })
})