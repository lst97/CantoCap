/**
 * Integration Test for Enhanced Subtitle Persistence
 * 
 * Tests the integration between the subtitle edit store, temp storage system,
 * and session recovery functionality.
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { SessionRecoveryDialog } from '../components/dialogs/SessionRecoveryDialog'

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: jest.fn(() => ({
    result: {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          index: jest.fn(() => ({
            getAll: jest.fn(() => ({
              onsuccess: null,
              onerror: null
            }))
          })),
          get: jest.fn(() => ({
            onsuccess: null,
            onerror: null
          })),
          put: jest.fn(() => ({
            onsuccess: null,
            onerror: null
          }))
        }))
      }))
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  }))
}

// @ts-ignore - Mock for testing
global.indexedDB = mockIndexedDB

describe('Enhanced Subtitle Persistence Integration', () => {
  beforeEach(() => {
    // Reset store state
    useSubtitleEditStore.getState().reset()
    jest.clearAllMocks()
  })

  describe('Store Persistence Configuration', () => {
    it('should enable persistence with workspace ID', () => {
      const store = useSubtitleEditStore.getState()
      const workspaceId = 'test-workspace-123'
      
      store.enablePersistence(workspaceId)
      
      const state = useSubtitleEditStore.getState()
      expect(state.persistenceEnabled).toBe(true)
      expect(state.sessionRecovery.lastSessionWorkspaceId).toBe(workspaceId)
      expect(state.tempStorageId).toBeTruthy()
    })

    it('should disable persistence and clear temp storage ID', () => {
      const store = useSubtitleEditStore.getState()
      
      // First enable persistence
      store.enablePersistence('test-workspace')
      expect(useSubtitleEditStore.getState().persistenceEnabled).toBe(true)
      
      // Then disable it
      store.disablePersistence()
      
      const state = useSubtitleEditStore.getState()
      expect(state.persistenceEnabled).toBe(false)
      expect(state.tempStorageId).toBeNull()
    })
  })

  describe('Session Recovery', () => {
    it('should check for recoverable sessions', async () => {
      const store = useSubtitleEditStore.getState()
      const workspaceId = 'test-workspace-456'
      
      // Mock a successful session check
      const mockTransaction = {
        objectStore: jest.fn(() => ({
          index: jest.fn(() => ({
            getAll: jest.fn(() => {
              const request = {
                onsuccess: null,
                onerror: null
              }
              // Simulate async response
              setTimeout(() => {
                if (request.onsuccess) {
                  request.onsuccess({ target: { result: [{ sessionId: 'recoverable-session', status: 'active' }] } })
                }
              }, 0)
              return request
            })
          }))
        }))
      }
      
      mockIndexedDB.open.mockReturnValue({
        result: { transaction: () => mockTransaction },
        onsuccess: null,
        onerror: null
      })
      
      const hasRecoverable = await store.checkForRecoverableSession(workspaceId)
      
      expect(hasRecoverable).toBe(true)
      expect(useSubtitleEditStore.getState().sessionRecovery.hasRecoverableSession).toBe(true)
    })
  })

  describe('SessionRecoveryDialog Component', () => {
    const mockOnRecover = jest.fn()
    const mockOnDiscard = jest.fn()
    const mockOnClose = jest.fn()

    const defaultProps = {
      open: true,
      sessionId: 'test-session-123',
      sessionInfo: {
        lastModified: Date.now() - 300000, // 5 minutes ago
        subtitleCount: 42,
        editCount: 7,
        workspaceId: 'test-workspace'
      },
      onRecover: mockOnRecover,
      onDiscard: mockOnDiscard,
      onClose: mockOnClose
    }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should render session recovery dialog with session info', () => {
      render(<SessionRecoveryDialog {...defaultProps} />)
      
      expect(screen.getByText('Recover Previous Session')).toBeInTheDocument()
      expect(screen.getByText('42 subtitles')).toBeInTheDocument()
      expect(screen.getByText('7 edits made')).toBeInTheDocument()
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument()
    })

    it('should call onRecover when recover button is clicked', async () => {
      mockOnRecover.mockResolvedValue(true)
      
      render(<SessionRecoveryDialog {...defaultProps} />)
      
      const recoverButton = screen.getByText('Recover Session')
      fireEvent.click(recoverButton)
      
      expect(mockOnRecover).toHaveBeenCalledWith('test-session-123')
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should call onDiscard when start fresh button is clicked', () => {
      render(<SessionRecoveryDialog {...defaultProps} />)
      
      const discardButton = screen.getByText('Start Fresh')
      fireEvent.click(discardButton)
      
      expect(mockOnDiscard).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should show error when recovery fails', async () => {
      mockOnRecover.mockResolvedValue(false)
      
      render(<SessionRecoveryDialog {...defaultProps} />)
      
      const recoverButton = screen.getByText('Recover Session')
      fireEvent.click(recoverButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to recover session/)).toBeInTheDocument()
      })
    })

    it('should format time correctly for different periods', () => {
      const testCases = [
        { ago: 30000, expected: 'Just now' }, // 30 seconds
        { ago: 120000, expected: '2 minutes ago' }, // 2 minutes
        { ago: 3600000, expected: '1 hour ago' }, // 1 hour
        { ago: 86400000, expected: 'yesterday' }, // 1 day
        { ago: 172800000, expected: '2 days ago' }, // 2 days
      ]

      testCases.forEach(({ ago, expected }) => {
        const props = {
          ...defaultProps,
          sessionInfo: {
            ...defaultProps.sessionInfo!,
            lastModified: Date.now() - ago
          }
        }
        
        const { rerender } = render(<SessionRecoveryDialog {...props} />)
        expect(screen.getByText(expected)).toBeInTheDocument()
        rerender(<div />) // Cleanup for next test
      })
    })
  })

  describe('Temp Storage Integration', () => {
    it('should convert session to temp content format', () => {
      const store = useSubtitleEditStore.getState()
      
      // Set up a mock session
      const mockSession = {
        sessionId: 'test-session',
        originalPath: '/test/original.srt',
        tempPath: '/test/temp.srt',
        videoPath: '/test/video.mp4',
        originalSubtitles: [],
        currentSubtitles: [
          {
            id: 'sub-1',
            index: 1,
            startTime: 1000,
            endTime: 3000,
            text: 'Test subtitle',
            originalText: 'Original text',
            confidence: 0.95
          }
        ],
        modifications: [],
        lastModified: new Date(),
        isDirty: false,
        currentTime: 0,
        selectedSubtitleId: null,
        isVideoPlaying: false,
        shouldAutoPause: false,
        videoDuration: 120000,
        totalDuration: 120000
      }
      
      // Enable persistence and set session
      store.enablePersistence('test-workspace')
      store.loadSession(mockSession)
      
      const tempContent = store.convertToTempContent()
      
      expect(tempContent).toBeTruthy()
      expect(tempContent!.subtitles).toHaveLength(1)
      expect(tempContent!.subtitles[0].text).toBe('Test subtitle')
      expect(tempContent!.editingContext.videoDuration).toBe(120000)
      expect(tempContent!.metadata.workspaceId).toBe('test-workspace')
    })
  })
})

describe('Auto-save Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should trigger auto-save when session becomes dirty', async () => {
    const store = useSubtitleEditStore.getState()
    const mockSaveFunction = jest.spyOn(store, 'saveSessionToTempStorage')
    
    // Enable persistence
    store.enablePersistence('test-workspace')
    
    // Create a session and make it dirty
    const mockSession = {
      sessionId: 'test-session',
      originalPath: '/test/original.srt',
      tempPath: '/test/temp.srt',
      videoPath: '/test/video.mp4',
      originalSubtitles: [],
      currentSubtitles: [],
      modifications: [],
      lastModified: new Date(),
      isDirty: true, // Mark as dirty
      currentTime: 0,
      selectedSubtitleId: null,
      isVideoPlaying: false,
      shouldAutoPause: false,
      videoDuration: 0,
      totalDuration: 0
    }
    
    store.loadSession(mockSession)
    
    // Fast-forward time to trigger auto-save
    jest.advanceTimersByTime(30000) // 30 seconds
    
    await waitFor(() => {
      expect(mockSaveFunction).toHaveBeenCalled()
    })
  })
})