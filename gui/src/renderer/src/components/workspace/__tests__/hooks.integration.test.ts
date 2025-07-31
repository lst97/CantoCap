/**
 * Integration tests for workspace hooks
 * Tests the integration between UI hooks and the workspace store
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { useWorkspaceManagement, useWorkspacePanelIntegration } from '../hooks'
import { useWorkspaceStore } from '../../../stores/workspace-store'
import { WorkspacePreloader, PerformanceMonitor } from '../performance-utils'

// Mock the workspace store
vi.mock('../../../stores/workspace-store')
const mockUseWorkspaceStore = useWorkspaceStore as Mock

// Mock window.cantocapAPI
Object.defineProperty(window, 'cantocapAPI', {
  value: {
    onWorkspaceMigrationProgress: vi.fn(),
    onWorkspaceMigrationUpdate: vi.fn(),
    onWorkspaceMigrationRollback: vi.fn()
  },
  writable: true
})

const mockWorkspaceStore = {
  availableWorkspaces: [
    {
      id: 'workspace-1',
      name: 'Test Workspace 1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      isActive: true,
      config: {},
      metadata: {}
    },
    {
      id: 'workspace-2',
      name: 'Test Workspace 2',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      isActive: false,
      config: {},
      metadata: {}
    }
  ],
  currentWorkspace: {
    id: 'workspace-1',
    name: 'Test Workspace 1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastAccessedAt: Date.now(),
    isActive: true,
    config: {},
    metadata: {}
  },
  isInitialized: true,
  isLoading: false,
  migrationStatus: null,
  performanceMetrics: [],
  autoSaveStatus: {
    isEnabled: true,
    pendingSaves: 0,
    failedSaves: 0,
    lastSaveTime: Date.now()
  },
  lastError: null,
  
  // Actions
  initializeWorkspaces: vi.fn().mockResolvedValue(undefined),
  createWorkspace: vi.fn().mockResolvedValue({}),
  switchWorkspace: vi.fn().mockResolvedValue(undefined),
  updateWorkspaceConfig: vi.fn().mockResolvedValue(undefined),
  updateWorkspaceMetadata: vi.fn().mockResolvedValue(undefined),
  deleteWorkspace: vi.fn().mockResolvedValue(undefined),
  duplicateWorkspace: vi.fn().mockResolvedValue({}),
  saveWorkspaceSession: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceSession: vi.fn().mockResolvedValue({}),
  startMigration: vi.fn().mockResolvedValue({}),
  rollbackMigration: vi.fn().mockResolvedValue({})
}

describe('Workspace Hooks Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWorkspaceStore.mockReturnValue(mockWorkspaceStore)
    PerformanceMonitor.clear()
    WorkspacePreloader.clear()
  })

  describe('useWorkspaceManagement', () => {
    it('should initialize workspace system on mount', async () => {
      const { result } = renderHook(() => useWorkspaceManagement())

      await waitFor(() => {
        expect(mockWorkspaceStore.initializeWorkspaces).toHaveBeenCalled()
      })

      expect(result.current.workspaces).toHaveLength(2)
      expect(result.current.activeWorkspace?.id).toBe('workspace-1')
    })

    it('should transform workspace data correctly', () => {
      const { result } = renderHook(() => useWorkspaceManagement())

      expect(result.current.workspaces[0]).toEqual({
        id: 'workspace-1',
        name: 'Test Workspace 1',
        emoji: 'T', // First character of name
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        isActive: true,
        sessionData: {
          currentStep: 'input-file'
        }
      })
    })

    it('should handle workspace creation', async () => {
      const { result } = renderHook(() => useWorkspaceManagement())

      await act(async () => {
        await result.current.createWorkspace('New Workspace')
      })

      expect(mockWorkspaceStore.createWorkspace).toHaveBeenCalledWith('New Workspace')
    })

    it('should handle workspace duplication on creation with copyFromId', async () => {
      const { result } = renderHook(() => useWorkspaceManagement())

      await act(async () => {
        await result.current.createWorkspace('Copied Workspace', 'workspace-1')
      })

      expect(mockWorkspaceStore.duplicateWorkspace).toHaveBeenCalledWith('workspace-1', 'Copied Workspace')
    })

    it('should handle workspace switching with performance monitoring', async () => {
      const { result } = renderHook(() => useWorkspaceManagement())

      await act(async () => {
        await result.current.switchWorkspace('workspace-2')
      })

      expect(mockWorkspaceStore.switchWorkspace).toHaveBeenCalledWith('workspace-2')
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Test error')
      mockWorkspaceStore.createWorkspace.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useWorkspaceManagement())

      await act(async () => {
        try {
          await result.current.createWorkspace('Failing Workspace')
        } catch (err) {
          expect(err).toBe(error)
        }
      })
    })
  })

  describe('useWorkspacePanelIntegration', () => {
    it('should provide panel-specific actions with performance timing', async () => {
      const { result } = renderHook(() => useWorkspacePanelIntegration())

      expect(result.current.onCreateWorkspace).toBeInstanceOf(Function)
      expect(result.current.onSwitchWorkspace).toBeInstanceOf(Function)
      expect(result.current.onRenameWorkspace).toBeInstanceOf(Function)
      expect(result.current.onDuplicateWorkspace).toBeInstanceOf(Function)
      expect(result.current.onDeleteWorkspace).toBeInstanceOf(Function)
    })

    it('should measure workspace switching performance', async () => {
      const { result } = renderHook(() => useWorkspacePanelIntegration())

      // Mock a slow workspace switch
      mockWorkspaceStore.switchWorkspace.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 600))
      )

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await act(async () => {
        await result.current.onSwitchWorkspace('workspace-2')
      })

      // Should warn if switching takes >500ms
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Workspace switching exceeded 500ms')
      )

      consoleSpy.mockRestore()
    })

    it('should handle rename operations', async () => {
      const { result } = renderHook(() => useWorkspacePanelIntegration())

      await act(async () => {
        await result.current.onRenameWorkspace('workspace-1', 'Renamed Workspace')
      })

      expect(mockWorkspaceStore.updateWorkspaceConfig).toHaveBeenCalled()
    })

    it('should handle delete operations', async () => {
      const { result } = renderHook(() => useWorkspacePanelIntegration())

      await act(async () => {
        await result.current.onDeleteWorkspace('workspace-2')
      })

      expect(mockWorkspaceStore.deleteWorkspace).toHaveBeenCalledWith('workspace-2')
    })

    it('should handle duplicate operations', async () => {
      const { result } = renderHook(() => useWorkspacePanelIntegration())

      await act(async () => {
        await result.current.onDuplicateWorkspace('workspace-1')
      })

      expect(mockWorkspaceStore.duplicateWorkspace).toHaveBeenCalledWith(
        'workspace-1',
        expect.stringContaining('(Copy)')
      )
    })

    it('should expose loading and error states', () => {
      mockWorkspaceStore.isLoading = true
      mockWorkspaceStore.lastError = { message: 'Test error' }

      const { result } = renderHook(() => useWorkspacePanelIntegration())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.lastError).toEqual({ message: 'Test error' })
    })
  })

  describe('Migration Integration', () => {
    it('should handle migration status', () => {
      mockWorkspaceStore.migrationStatus = {
        isActive: true,
        currentPhase: 'data-migration',
        progress: 50,
        canRollback: true
      }

      const { result } = renderHook(() => useWorkspaceManagement())

      expect(result.current.isMigrating).toBe(true)
      expect(result.current.migrationPhase).toBe('data-migration')
      expect(result.current.migrationProgress).toBe(50)
      expect(result.current.canRollback).toBe(true)
    })

    it('should handle migration rollback', async () => {
      const { result } = renderHook(() => useWorkspaceManagement())

      await act(async () => {
        await result.current.rollbackMigration()
      })

      expect(mockWorkspaceStore.rollbackMigration).toHaveBeenCalled()
    })
  })

  describe('Performance Optimization', () => {
    it('should preload workspace data for faster switching', async () => {
      const preloadSpy = vi.spyOn(WorkspacePreloader, 'prefetchWorkspace')

      renderHook(() => useWorkspaceManagement())

      await waitFor(() => {
        expect(preloadSpy).toHaveBeenCalled()
      })

      // Should preload inactive workspaces
      expect(preloadSpy).toHaveBeenCalledWith('workspace-2', expect.any(Function))
    })

    it('should track performance metrics', async () => {
      const { result } = renderHook(() => useWorkspacePanelIntegration())

      await act(async () => {
        await result.current.onSwitchWorkspace('workspace-2')
      })

      const metrics = PerformanceMonitor.getMetrics('workspace-switch')
      expect(metrics.count).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed')
      mockWorkspaceStore.initializeWorkspaces.mockRejectedValueOnce(error)
      mockWorkspaceStore.isInitialized = false

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderHook(() => useWorkspaceManagement())

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initialize workspace system:'),
          error
        )
      })

      consoleSpy.mockRestore()
    })

    it('should provide error context in hook operations', async () => {
      const error = new Error('Switch failed')
      mockWorkspaceStore.switchWorkspace.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useWorkspacePanelIntegration())
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await act(async () => {
        try {
          await result.current.onSwitchWorkspace('workspace-2')
        } catch (err) {
          // Error should be handled by the hook
        }
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to switch workspace in panel:',
        error
      )

      consoleSpy.mockRestore()
    })
  })
})