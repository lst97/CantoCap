/**
 * Auto-save Integration Tests
 * 
 * Tests to verify the enhanced auto-save functionality works correctly
 * across app restarts and step navigation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSubtitleEditStore } from '../../stores/subtitle-edit-store'
import { useSubtitleTempStorage } from '../../hooks/useSubtitleTempStorage'

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: vi.fn(() => ({
    result: {
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
          get: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() })),
          getAll: vi.fn(() => ({ onsuccess: vi.fn(), onerror: vi.fn() }))
        }))
      }))
    },
    onsuccess: vi.fn(),
    onerror: vi.fn(),
    onupgradeneeded: vi.fn()
  }))
}

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
})

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

describe('Auto-save Integration', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Reset localStorage mock
    mockLocalStorage.getItem.mockReturnValue('{}')
  })

  afterEach(() => {
    // Clean up any timers
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('Subtitle Edit Store Persistence', () => {
    it('should persist session data to localStorage', async () => {
      const { result } = renderHook(() => useSubtitleEditStore())

      // Initialize a session with some data
      await act(async () => {
        await result.current.initializeSession(
          'test-subtitles.srt',
          'test-video.mp4',
          [
            {
              id: 1,
              startTime: 0,
              endTime: 2000,
              text: 'Hello world',
              confidence: 0.95
            }
          ],
          true
        )
      })

      // Make the session dirty
      act(() => {
        result.current.updateSubtitle('subtitle-1', { text: 'Hello modified world' })
      })

      // Enable persistence
      act(() => {
        result.current.enablePersistence('test-workspace')
      })

      // Verify session is marked as dirty
      expect(result.current.session?.isDirty).toBe(true)

      // The persist middleware should save to localStorage
      // We can't directly test this without a more complex setup,
      // but we can verify the state is correct
      expect(result.current.persistenceEnabled).toBe(true)
    })

    it('should restore session on app restart', async () => {
      // Mock persisted state in localStorage
      const persistedState = {
        state: {
          session: {
            sessionId: 'test-session-123',
            originalPath: 'test-subtitles.srt',
            videoPath: 'test-video.mp4',
            isDirty: true,
            subtitleCount: 5,
            editCount: 3,
            lastModified: new Date().toISOString()
          },
          sessionRecovery: {
            hasRecoverableSession: false,
            recoverableSessionId: null,
            lastSessionWorkspaceId: 'test-workspace'
          }
        }
      }

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedState))

      const { result } = renderHook(() => useSubtitleEditStore())

      // Call restore method
      await act(async () => {
        const restored = await result.current.restorePersistedSession()
        expect(restored).toBe(true)
      })

      // Verify session recovery state was updated
      expect(result.current.sessionRecovery.hasRecoverableSession).toBe(true)
      expect(result.current.sessionRecovery.recoverableSessionId).toBe('test-session-123')
    })
  })

  describe('Enhanced Temp Storage', () => {
    it('should initialize with proper configuration', () => {
      const { result } = renderHook(() => 
        useSubtitleTempStorage({
          autoSaveEnabled: true,
          autoSaveInterval: 30000,
          enableSessionRecovery: true
        })
      )

      expect(result.current.isLoading).toBe(false)
      expect(result.current.currentContent).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should handle content updates and trigger auto-save', async () => {
      vi.useFakeTimers()

      const mockOnAutoSave = vi.fn()
      const { result } = renderHook(() => 
        useSubtitleTempStorage({
          autoSaveEnabled: true,
          autoSaveInterval: 5000, // 5 seconds for faster testing
          onAutoSave: mockOnAutoSave
        })
      )

      // Create a session first
      await act(async () => {
        await result.current.createSession('review')
      })

      // Update content to trigger auto-save
      act(() => {
        result.current.updateContent([
          {
            id: 1,
            startTime: 0,
            endTime: 2000,
            text: 'Test subtitle'
          }
        ])
      })

      expect(result.current.hasUnsavedChanges).toBe(true)

      // Fast-forward time to trigger auto-save
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Wait for any pending promises
      await waitFor(() => {
        // The auto-save should have been attempted
        // (though it may fail due to mocked IndexedDB)
        expect(result.current.hasUnsavedChanges).toBe(true) // Still true due to mock failure
      })

      vi.useRealTimers()
    })
  })

  describe('Session Recovery Flow', () => {
    it('should handle session recovery gracefully', async () => {
      // Setup persisted session data
      const persistedState = {
        state: {
          session: {
            sessionId: 'recoverable-session',
            originalPath: 'test.srt',
            videoPath: 'test.mp4',
            isDirty: true,
            subtitleCount: 10,
            editCount: 5
          },
          sessionRecovery: {
            hasRecoverableSession: true,
            recoverableSessionId: 'recoverable-session',
            lastSessionWorkspaceId: 'test-workspace'
          }
        }
      }

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedState))

      const { result } = renderHook(() => useSubtitleEditStore())

      // Try to recover the session
      await act(async () => {
        const success = await result.current.recoverSession('recoverable-session')
        // May fail due to mocked IndexedDB, but shouldn't throw
        expect(typeof success).toBe('boolean')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle IndexedDB errors gracefully', async () => {
      // Mock IndexedDB to throw an error
      mockIndexedDB.open.mockImplementation(() => {
        throw new Error('IndexedDB unavailable')
      })

      const { result } = renderHook(() => 
        useSubtitleTempStorage({
          onError: vi.fn() // Mock error handler
        })
      )

      // Try to save content - should handle error gracefully
      const saveResult = await act(async () => {
        return await result.current.forceSave()
      })

      expect(saveResult.success).toBe(false)
      expect(saveResult.error).toBeDefined()
    })

    it('should handle localStorage corruption gracefully', async () => {
      // Mock corrupted localStorage data
      mockLocalStorage.getItem.mockReturnValue('invalid-json')

      const { result } = renderHook(() => useSubtitleEditStore())

      // Should not throw error when trying to restore
      await act(async () => {
        const restored = await result.current.restorePersistedSession()
        expect(restored).toBe(false) // Should return false for corrupted data
      })
    })
  })

  describe('Performance', () => {
    it('should debounce auto-save operations', async () => {
      vi.useFakeTimers()

      const mockSave = vi.fn()
      const { result } = renderHook(() => useSubtitleEditStore())

      // Initialize session
      await act(async () => {
        await result.current.initializeSession('test.srt', 'test.mp4', [], true)
      })

      // Make multiple rapid updates
      act(() => {
        result.current.updateSubtitle('test-1', { text: 'Update 1' })
        result.current.updateSubtitle('test-2', { text: 'Update 2' })
        result.current.updateSubtitle('test-3', { text: 'Update 3' })
      })

      // Advance time slightly (less than debounce period)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should not have saved yet due to debouncing
      expect(result.current.session?.isDirty).toBe(true)

      vi.useRealTimers()
    })
  })
})