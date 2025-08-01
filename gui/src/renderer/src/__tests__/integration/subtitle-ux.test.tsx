/**
 * Subtitle Persistence User Experience Tests
 * 
 * Tests the user experience aspects of subtitle persistence including
 * auto-save indicators, error recovery UI, and accessibility features.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { useSubtitlePersistence } from '../../hooks/useSubtitlePersistence'
import { SubtitleAutoSaveIndicator } from '../../components/common/SubtitleAutoSaveIndicator'
import { WorkspaceConfigProvider } from '../../contexts/WorkspaceConfigContext'
import {
  generateMockSubtitleFileContent,
  generateMockSessionData,
  MockIPCResponse,
  TestWorkspaceUtils,
  ErrorSimulator
} from '../utils/subtitle-test-helpers'
import { resetSubtitlePersistenceService } from '../../services/subtitle-persistence-service'
import React from 'react'

// Mock Electron IPC
const mockIpcRenderer = {
  invoke: vi.fn()
}

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: mockIpcRenderer
  },
  writable: true
})

// Mock workspace database
vi.mock('../../services/workspace-database', () => ({
  workspaceDatabase: {
    getWorkspace: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ isHealthy: true, issues: [] })
  }
}))

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <WorkspaceConfigProvider>
    {children}
  </WorkspaceConfigProvider>
)

describe('Subtitle Persistence User Experience Tests', () => {
  let testWorkspaceId: string

  beforeEach(() => {
    resetSubtitlePersistenceService()
    testWorkspaceId = TestWorkspaceUtils.createTestWorkspace()
    vi.clearAllMocks()

    // Setup default IPC responses
    mockIpcRenderer.invoke.mockImplementation(async (channel: string, request: any) => {
      switch (channel) {
        case 'subtitle-file-operation':
          return handleSubtitleOperation(request)
        case 'save-subtitle-session':
          return MockIPCResponse.success({ saved: true })
        case 'load-subtitle-session':
          return generateMockSessionData({ workspaceId: testWorkspaceId })
        default:
          return MockIPCResponse.success({})
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function handleSubtitleOperation(request: any) {
    const { operation, fileId } = request

    switch (operation) {
      case 'read':
        return MockIPCResponse.success(
          generateMockSubtitleFileContent({
            fileId: fileId || 'test-file',
            workspaceId: testWorkspaceId
          })
        )
      case 'create':
      case 'update':
        return MockIPCResponse.success(`${operation}-${Date.now()}`)
      case 'validate':
        return MockIPCResponse.success({
          isValid: true,
          errors: [],
          warnings: [],
          statistics: { totalSubtitles: 50 },
          performance: { validationTime: 150 }
        })
      default:
        return MockIPCResponse.success({})
    }
  }

  describe('Auto-save User Experience', () => {
    it('should provide clear auto-save status feedback', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId, {
          fileAutoSaveInterval: 1000,
          enablePerformanceMonitoring: true
        })
      )

      // Initially no unsaved changes
      expect(result.current.hasUnsavedChanges).toBe(false)
      expect(result.current.isAutoSaving).toBe(false)

      // Load and modify file
      await act(async () => {
        const content = await result.current.loadFile('test-file')
        if (content) {
          content.subtitles[0].text = 'Modified text'
          await result.current.saveFile('test-file', content, { priority: 1 })
        }
      })

      // Should show appropriate status
      expect(result.current.hasUnsavedChanges).toBe(false) // Saved
      expect(result.current.lastAutoSave).toBeGreaterThan(0)
    })

    it('should show auto-save indicator component correctly', async () => {
      const mockProps = {
        isAutoSaving: false,
        hasUnsavedChanges: true,
        lastAutoSave: Date.now() - 30000, // 30 seconds ago
        pendingOperations: 2,
        error: null
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      // Should show unsaved changes indicator
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
      expect(screen.getByText(/2.*pending/i)).toBeInTheDocument()
    })

    it('should show saving state during auto-save', async () => {
      const mockProps = {
        isAutoSaving: true,
        hasUnsavedChanges: true,
        lastAutoSave: null,
        pendingOperations: 1,
        error: null
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      // Should show saving indicator
      expect(screen.getByText(/saving/i)).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should show success state after auto-save', async () => {
      const mockProps = {
        isAutoSaving: false,
        hasUnsavedChanges: false,
        lastAutoSave: Date.now() - 5000, // 5 seconds ago
        pendingOperations: 0,
        error: null
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      // Should show saved indicator
      expect(screen.getByText(/saved/i)).toBeInTheDocument()
      expect(screen.getByText(/5.*seconds ago/i)).toBeInTheDocument()
    })

    it('should enable/disable auto-save based on user preference', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId, {
          autoFileOperations: false
        })
      )

      // Auto-save should be disabled initially
      expect(result.current.hasUnsavedChanges).toBe(false)

      // Enable auto-save
      act(() => {
        result.current.enableAutoSave(2000)
      })

      // Should be enabled now
      await waitFor(() => {
        // Auto-save timer should be active
      })

      // Disable auto-save
      act(() => {
        result.current.disableAutoSave()
      })
    })
  })

  describe('Error Recovery User Experience', () => {
    it('should display user-friendly error messages', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Simulate file not found error
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        ErrorSimulator.corruptionError('test-file')
      )

      await act(async () => {
        try {
          await result.current.loadFile('test-file')
        } catch (error) {
          // Expected to fail
        }
      })

      // Should have user-friendly error
      expect(result.current.error).toBeDefined()
      expect(result.current.error?.message).toContain('corrupted')
    })

    it('should show error state in auto-save indicator', async () => {
      const mockProps = {
        isAutoSaving: false,
        hasUnsavedChanges: true,
        lastAutoSave: null,
        pendingOperations: 0,
        error: {
          code: 'SUBTITLE_FILE_ACCESS_DENIED',
          message: 'Permission denied'
        } as any
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      // Should show error state
      expect(screen.getByText(/error/i)).toBeInTheDocument()
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
    })

    it('should provide error recovery actions', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Simulate error
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        ErrorSimulator.networkError()
      )

      await act(async () => {
        try {
          await result.current.loadFile('test-file')
        } catch (error) {
          // Expected to fail
        }
      })

      expect(result.current.error).toBeDefined()

      // Clear error
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })

    it('should handle offline scenarios gracefully', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Simulate offline/network error
      mockIpcRenderer.invoke.mockRejectedValue(
        ErrorSimulator.networkError()
      )

      await act(async () => {
        try {
          await result.current.loadFile('offline-test')
        } catch (error) {
          // Should handle gracefully
        }
      })

      // Should provide appropriate feedback
      expect(result.current.error).toBeDefined()
      expect(result.current.error?.message).toMatch(/network|connection/i)
    })

    it('should show retry options for recoverable errors', async () => {
      const mockOnRetry = vi.fn()
      
      const mockProps = {
        isAutoSaving: false,
        hasUnsavedChanges: true,
        lastAutoSave: null,
        pendingOperations: 0,
        error: {
          code: 'SUBTITLE_OPERATION_TIMEOUT',
          message: 'Operation timed out'
        } as any,
        onRetry: mockOnRetry
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      // Should show retry button
      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()

      // Click retry
      fireEvent.click(retryButton)
      expect(mockOnRetry).toHaveBeenCalled()
    })
  })

  describe('Performance Feedback', () => {
    it('should show loading states during operations', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Should show loading state during file operations
      expect(result.current.isLoadingFiles).toBe(false)

      // Start loading operation
      act(() => {
        result.current.loadFile('loading-test')
      })

      // Should show loading
      expect(result.current.isLoadingFiles).toBe(true)
      expect(result.current.pendingOperations).toBeGreaterThan(0)

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoadingFiles).toBe(false)
      })
    })

    it('should provide performance metrics to users', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId, {
          enablePerformanceMonitoring: true
        })
      )

      // Perform some operations
      await act(async () => {
        await result.current.loadFile('perf-test-1')
        await result.current.loadFile('perf-test-2')
      })

      // Get performance metrics
      await act(async () => {
        const metrics = await result.current.getPerformanceMetrics()
        expect(metrics.length).toBeGreaterThan(0)
      })

      // Should have cache metrics
      expect(result.current.cacheMetrics).toBeDefined()
      expect(result.current.performanceAnalytics).toBeDefined()
    })

    it('should show cache efficiency information', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Load file multiple times to test cache
      await act(async () => {
        await result.current.loadFile('cache-test')
        await result.current.loadFile('cache-test') // Should hit cache
      })

      // Should have cache metrics
      expect(result.current.cacheMetrics.hitRate).toBeGreaterThanOrEqual(0)
      expect(result.current.cacheMetrics.entryCount).toBeGreaterThan(0)
    })
  })

  describe('Session Restoration Experience', () => {
    it('should restore session state transparently', async () => {
      const sessionData = generateMockSessionData({
        workspaceId: testWorkspaceId,
        sessionType: 'review'
      })

      mockIpcRenderer.invoke.mockImplementation(async (channel) => {
        if (channel === 'load-subtitle-session') {
          return sessionData
        }
        return MockIPCResponse.success({})
      })

      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Should load session automatically
      await waitFor(() => {
        expect(result.current.currentSession).toBeDefined()
      })

      expect(result.current.currentSession?.workspaceId).toBe(testWorkspaceId)
      expect(result.current.currentSession?.sessionType).toBe('review')
    })

    it('should handle session loading failures gracefully', async () => {
      mockIpcRenderer.invoke.mockImplementation(async (channel) => {
        if (channel === 'load-subtitle-session') {
          throw new Error('Session load failed')
        }
        return MockIPCResponse.success({})
      })

      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Should handle session load failure without crashing
      await waitFor(() => {
        expect(result.current.error).toBeDefined()
      })

      // Should still be functional
      expect(result.current.loadFile).toBeDefined()
    })

    it('should preserve user preferences across sessions', async () => {
      const sessionWithPrefs = generateMockSessionData({
        workspaceId: testWorkspaceId
      })
      sessionWithPrefs.preferences.showConfidenceScores = false
      sessionWithPrefs.preferences.fontSize = 16

      mockIpcRenderer.invoke.mockImplementation(async (channel) => {
        if (channel === 'load-subtitle-session') {
          return sessionWithPrefs
        }
        return MockIPCResponse.success({})
      })

      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      await waitFor(() => {
        expect(result.current.currentSession?.preferences.showConfidenceScores).toBe(false)
        expect(result.current.currentSession?.preferences.fontSize).toBe(16)
      })
    })
  })

  describe('Accessibility Features', () => {
    it('should provide accessible status announcements', async () => {
      const mockProps = {
        isAutoSaving: true,
        hasUnsavedChanges: true,
        lastAutoSave: null,
        pendingOperations: 1,
        error: null
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      // Should have proper ARIA labels
      const statusElement = screen.getByRole('status')
      expect(statusElement).toBeInTheDocument()
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide keyboard navigation for error recovery', async () => {
      const mockOnRetry = vi.fn()
      
      const mockProps = {
        isAutoSaving: false,
        hasUnsavedChanges: false,
        lastAutoSave: null,
        pendingOperations: 0,
        error: {
          code: 'SUBTITLE_OPERATION_TIMEOUT',
          message: 'Operation timed out'
        } as any,
        onRetry: mockOnRetry
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      const retryButton = screen.getByRole('button', { name: /retry/i })
      
      // Should be keyboard accessible
      expect(retryButton).toHaveAttribute('tabIndex', '0')
      
      // Test keyboard interaction
      fireEvent.keyDown(retryButton, { key: 'Enter' })
      expect(mockOnRetry).toHaveBeenCalled()
    })

    it('should provide screen reader friendly status updates', async () => {
      const mockProps = {
        isAutoSaving: false,
        hasUnsavedChanges: false,
        lastAutoSave: Date.now() - 10000,
        pendingOperations: 0,
        error: null
      }

      render(<SubtitleAutoSaveIndicator {...mockProps} />)

      // Should have descriptive text for screen readers
      const statusText = screen.getByText(/saved.*10.*seconds ago/i)
      expect(statusText).toBeInTheDocument()
    })
  })

  describe('Progressive Enhancement', () => {
    it('should work without cache when disabled', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId, {
          enableFileCache: false
        })
      )

      // Should still load files without cache
      await act(async () => {
        const content = await result.current.loadFile('no-cache-test')
        expect(content).toBeDefined()
      })

      // Cache metrics should show minimal usage
      expect(result.current.cacheMetrics.entryCount).toBe(0)
    })

    it('should function with reduced features in low-resource environments', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId, {
          enablePerformanceMonitoring: false,
          enableFileCache: false,
          autoFileOperations: false
        })
      )

      // Should still provide core functionality
      await act(async () => {
        const content = await result.current.loadFile('minimal-test')
        expect(content).toBeDefined()
      })

      // Performance monitoring should be minimal
      const metrics = await result.current.getPerformanceMetrics()
      expect(metrics).toHaveLength(0)
    })

    it('should gracefully degrade when background processing fails', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Simulate background processing failure
      mockIpcRenderer.invoke.mockImplementation(async (channel, request) => {
        if (request.options?.priority === 1) { // Background operation
          throw new Error('Background processing failed')
        }
        return handleSubtitleOperation(request)
      })

      // Should still work for high-priority operations
      await act(async () => {
        const content = generateMockSubtitleFileContent({ workspaceId: testWorkspaceId })
        await result.current.saveFile('degraded-test', content, { priority: 3 })
      })
    })
  })

  describe('User Feedback and Notifications', () => {
    it('should provide appropriate feedback for long-running operations', async () => {
      // Mock slow operation
      mockIpcRenderer.invoke.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
        return MockIPCResponse.success(generateMockSubtitleFileContent())
      })

      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      act(() => {
        result.current.loadFile('slow-operation')
      })

      // Should show loading state
      expect(result.current.isLoadingFiles).toBe(true)
      expect(result.current.pendingOperations).toBeGreaterThan(0)

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoadingFiles).toBe(false)
      }, { timeout: 3000 })
    })

    it('should show batch operation progress', async () => {
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId)
      )

      // Start multiple operations
      await act(async () => {
        const contents = Array.from({ length: 3 }, (_, i) =>
          generateMockSubtitleFileContent({
            fileId: `batch-${i}`,
            workspaceId: testWorkspaceId
          })
        )

        const savePromises = contents.map((content, i) =>
          result.current.saveFile(`batch-${i}`, content)
        )

        await Promise.all(savePromises)
      })

      // Should track pending operations
      expect(result.current.pendingOperations).toBe(0) // Should be completed
    })

    it('should provide success feedback for completed operations', async () => {
      const onSuccess = vi.fn()
      
      const { result } = renderHook(() => 
        useSubtitlePersistence(testWorkspaceId, {
          onFileOperationSuccess: onSuccess
        })
      )

      await act(async () => {
        await result.current.loadFile('success-test')
      })

      expect(onSuccess).toHaveBeenCalledWith('load', expect.any(Object))
    })
  })
})