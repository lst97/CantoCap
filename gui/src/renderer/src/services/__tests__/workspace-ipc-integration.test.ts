/**
 * Workspace IPC Integration Tests
 * 
 * Tests the integration between IndexedDB storage and main process
 * workspace management through IPC calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WorkspaceIPCIntegration } from '../workspace-ipc-integration'
import type { MigrationStatus } from '../../types/workspace'

// Mock window.cantocapAPI
const mockCantocapAPI = {
  // Workspace Management
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  syncWorkspace: vi.fn(),
  
  // Configuration Management
  getWorkspaceConfig: vi.fn(),
  syncWorkspaceConfig: vi.fn(),
  
  // Migration Operations
  startWorkspaceMigration: vi.fn(),
  completeWorkspaceMigration: vi.fn(),
  rollbackWorkspaceMigration: vi.fn(),
  getWorkspaceMigrationStatus: vi.fn(),
  
  // Backup & Recovery
  createWorkspaceBackup: vi.fn(),
  restoreWorkspaceBackup: vi.fn(),
  
  // Performance Monitoring
  getWorkspacePerformanceMetrics: vi.fn(),
  clearWorkspacePerformanceMetrics: vi.fn(),
  
  // Initialization
  initializeWorkspaceSystem: vi.fn(),
  
  // Event Listeners
  onWorkspaceMigrationUpdate: vi.fn(),
  onWorkspaceMigrationProgress: vi.fn(),
  onWorkspaceMigrationRollback: vi.fn()
}

// Mock workspace database
vi.mock('../workspace-database', () => ({
  getWorkspaceDatabase: () => ({
    initializeDatabase: vi.fn().mockResolvedValue(undefined),
    saveWorkspace: vi.fn().mockResolvedValue(undefined),
    getWorkspace: vi.fn().mockResolvedValue(null),
    deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    getAllWorkspaces: vi.fn().mockResolvedValue([])
  })
}))

describe('WorkspaceIPCIntegration', () => {
  let integration: WorkspaceIPCIntegration

  beforeEach(() => {
    // Setup global mock
    global.window = {
      cantocapAPI: mockCantocapAPI
    } as any

    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup default mock returns
    mockCantocapAPI.onWorkspaceMigrationUpdate.mockReturnValue(() => {})
    mockCantocapAPI.onWorkspaceMigrationProgress.mockReturnValue(() => {})
    mockCantocapAPI.onWorkspaceMigrationRollback.mockReturnValue(() => {})
    
    integration = new WorkspaceIPCIntegration()
  })

  afterEach(() => {
    integration.cleanup()
  })

  describe('initializeIntegration', () => {
    it('should initialize successfully when no migration is needed', async () => {
      // Setup mocks
      mockCantocapAPI.getWorkspaceMigrationStatus.mockResolvedValue(null)
      mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValue({ success: true })
      mockCantocapAPI.listWorkspaces.mockResolvedValue([])

      const result = await integration.initializeIntegration()

      expect(result.success).toBe(true)
      expect(result.message).toBe('Workspace system initialized successfully')
      expect(mockCantocapAPI.initializeWorkspaceSystem).toHaveBeenCalled()
    })

    it('should start migration when workspaces exist in main process', async () => {
      // Setup mocks
      mockCantocapAPI.getWorkspaceMigrationStatus.mockResolvedValue(null)
      mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValue({ success: true })
      mockCantocapAPI.listWorkspaces.mockResolvedValue([
        {
          id: 'ws_123',
          name: 'Test Workspace',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now()
        }
      ])
      mockCantocapAPI.startWorkspaceMigration.mockResolvedValue({
        success: true,
        backupPath: '/backup/path'
      })
      mockCantocapAPI.getWorkspaceConfig.mockResolvedValue({
        workspaceId: 'ws_123',
        inputFile: null,
        outputFile: null,
        language: 'zh'
      })
      mockCantocapAPI.completeWorkspaceMigration.mockResolvedValue({ success: true })

      const result = await integration.initializeIntegration()

      expect(result.success).toBe(true)
      expect(result.message).toBe('Migration started successfully')
      expect(mockCantocapAPI.startWorkspaceMigration).toHaveBeenCalled()
    })

    it('should handle migration in progress', async () => {
      const migrationStatus: MigrationStatus = {
        isInProgress: true,
        currentPhase: 'migrate',
        totalPhases: 3,
        completedPhases: 2,
        canRollback: true
      }

      mockCantocapAPI.getWorkspaceMigrationStatus.mockResolvedValue(migrationStatus)

      const result = await integration.initializeIntegration()

      expect(result.success).toBe(false)
      expect(result.message).toContain('Migration already in progress')
    })

    it('should handle initialization failures', async () => {
      mockCantocapAPI.getWorkspaceMigrationStatus.mockResolvedValue(null)
      mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValue({ success: false })

      const result = await integration.initializeIntegration()

      expect(result.success).toBe(false)
      expect(result.message).toContain('Initialization failed')
    })
  })

  describe('createWorkspace', () => {
    it('should create workspace in both main process and IndexedDB', async () => {
      mockCantocapAPI.createWorkspace.mockResolvedValue({
        success: true,
        workspaceId: 'ws_new_123'
      })

      const result = await integration.createWorkspace('New Workspace')

      expect(result.success).toBe(true)
      expect(result.workspaceId).toBe('ws_new_123')
      expect(mockCantocapAPI.createWorkspace).toHaveBeenCalledWith('New Workspace')
    })

    it('should handle main process creation failure', async () => {
      mockCantocapAPI.createWorkspace.mockResolvedValue({
        success: false,
        workspaceId: ''
      })

      const result = await integration.createWorkspace('Failed Workspace')

      expect(result.success).toBe(false)
      expect(result.workspaceId).toBeUndefined()
    })
  })

  describe('deleteWorkspace', () => {
    it('should delete workspace from both IndexedDB and main process', async () => {
      mockCantocapAPI.deleteWorkspace.mockResolvedValue({ success: true })

      const result = await integration.deleteWorkspace('ws_delete_123')

      expect(result.success).toBe(true)
      expect(mockCantocapAPI.deleteWorkspace).toHaveBeenCalledWith('ws_delete_123')
    })

    it('should succeed even if main process deletion fails', async () => {
      mockCantocapAPI.deleteWorkspace.mockResolvedValue({ success: false })

      const result = await integration.deleteWorkspace('ws_delete_456')

      expect(result.success).toBe(true) // IndexedDB deletion should succeed
    })
  })

  describe('syncWorkspaceToMainProcess', () => {
    it('should skip sync when in progress', async () => {
      // Start a sync
      integration['syncInProgress'] = true

      const result = await integration.syncWorkspaceToMainProcess('ws_sync_123')

      expect(result.success).toBe(false)
      expect(mockCantocapAPI.syncWorkspaceConfig).not.toHaveBeenCalled()
    })

    it('should debounce rapid sync calls', async () => {
      // Set recent sync time
      integration['lastSyncTime'] = Date.now() - 1000 // 1 second ago

      const result = await integration.syncWorkspaceToMainProcess('ws_sync_456')

      expect(result.success).toBe(true)
      expect(mockCantocapAPI.syncWorkspaceConfig).not.toHaveBeenCalled()
    })
  })

  describe('createBackup', () => {
    it('should create backup through main process', async () => {
      mockCantocapAPI.createWorkspaceBackup.mockResolvedValue({
        success: true,
        backupPath: '/backup/ws_backup_123.json'
      })

      const result = await integration.createBackup('ws_backup_123')

      expect(result.success).toBe(true)
      expect(result.backupPath).toBe('/backup/ws_backup_123.json')
      expect(mockCantocapAPI.createWorkspaceBackup).toHaveBeenCalledWith('ws_backup_123')
    })

    it('should handle backup failure', async () => {
      mockCantocapAPI.createWorkspaceBackup.mockResolvedValue({
        success: false,
        backupPath: ''
      })

      const result = await integration.createBackup('ws_backup_failed')

      expect(result.success).toBe(false)
      expect(result.backupPath).toBeUndefined()
    })
  })

  describe('isSystemReady', () => {
    it('should return true when no migration is in progress', async () => {
      mockCantocapAPI.getWorkspaceMigrationStatus.mockResolvedValue(null)

      const result = await integration.isSystemReady()

      expect(result).toBe(true)
    })

    it('should return false when migration is in progress', async () => {
      mockCantocapAPI.getWorkspaceMigrationStatus.mockResolvedValue({
        isInProgress: true,
        totalPhases: 3,
        completedPhases: 1,
        canRollback: true
      })

      const result = await integration.isSystemReady()

      expect(result).toBe(false)
    })

    it('should return false on API error', async () => {
      mockCantocapAPI.getWorkspaceMigrationStatus.mockRejectedValue(new Error('API Error'))

      const result = await integration.isSystemReady()

      expect(result).toBe(false)
    })
  })

  describe('Performance and Monitoring', () => {
    it('should get performance metrics from main process', async () => {
      const mockMetrics = [
        {
          operationType: 'create' as const,
          duration: 150,
          success: true,
          workspaceId: 'ws_123',
          timestamp: Date.now()
        }
      ]

      mockCantocapAPI.getWorkspacePerformanceMetrics.mockResolvedValue(mockMetrics)

      const result = await integration.getPerformanceMetrics()

      expect(result).toEqual(mockMetrics)
      expect(mockCantocapAPI.getWorkspacePerformanceMetrics).toHaveBeenCalled()
    })

    it('should handle performance metrics error', async () => {
      mockCantocapAPI.getWorkspacePerformanceMetrics.mockRejectedValue(new Error('Metrics Error'))

      const result = await integration.getPerformanceMetrics()

      expect(result).toEqual([])
    })
  })
})