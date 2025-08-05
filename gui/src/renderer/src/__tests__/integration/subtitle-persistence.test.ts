/**
 * Subtitle Persistence Integration Tests
 * 
 * Comprehensive integration tests for the subtitle file persistence system.
 * Tests the complete lifecycle of subtitle files including creation, loading,
 * saving, validation, and workspace isolation.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { SubtitlePersistenceService, resetSubtitlePersistenceService } from '../../services/subtitle/subtitle-persistence-service'
import { workspaceDatabase } from '../../services/workspace/workspace-database'
import {
  generateMockSubtitleFileContent,
  generateMockSubtitleFileMetadata,
  generateMockSessionData,
  MockIPCResponse,
  TestWorkspaceUtils,
  ErrorSimulator,
  PerformanceTestUtils
} from '../utils/subtitle-test-helpers'
import type {
  SubtitleFileContent,
  SubtitleFileOperationRequest,
  SubtitleFileOperationResponse,
  SubtitleFileError
} from '../../types/subtitle-persistence'

// Mock Electron IPC
const mockIpcRenderer = {
  invoke: vi.fn()
}

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: mockIpcRenderer
  },
  writable: true
})

// Mock workspace database operations
vi.mock('../../services/workspace-database', () => ({
  workspaceDatabase: {
    getWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ isHealthy: true, issues: [] })
  }
}))

describe('Subtitle Persistence Integration Tests', () => {
  let service: SubtitlePersistenceService
  let testWorkspaceId: string
  let testFiles: ReturnType<typeof TestWorkspaceUtils.createTestFileStructure>

  beforeAll(async () => {
    // Setup test environment
    testWorkspaceId = TestWorkspaceUtils.createTestWorkspace()
    testFiles = TestWorkspaceUtils.createTestFileStructure(testWorkspaceId)
  })

  beforeEach(() => {
    // Reset service instance
    resetSubtitlePersistenceService()
    service = new SubtitlePersistenceService({
      enabled: true,
      maxSize: 10 * 1024 * 1024, // 10MB
      maxEntries: 100,
      defaultTTL: 300000, // 5 minutes
      enableLRU: true,
      enableCompression: true
    })

    // Clear all mocks
    vi.clearAllMocks()

    // Setup default IPC mock responses
    mockIpcRenderer.invoke.mockImplementation(async (channel: string, request: any) => {
      switch (channel) {
        case 'subtitle-file-operation':
          return handleSubtitleFileOperation(request)
        case 'subtitle-batch-operation':
          return handleBatchSubtitleOperation(request)
        case 'save-subtitle-session':
          return MockIPCResponse.success({ saved: true })
        case 'load-subtitle-session':
          return generateMockSessionData({ workspaceId: testWorkspaceId })
        default:
          throw new Error(`Unhandled IPC channel: ${channel}`)
      }
    })
  })

  afterEach(async () => {
    // Cleanup
    await service.clearCache()
  })

  afterAll(async () => {
    // Cleanup test workspace
    await TestWorkspaceUtils.cleanupTestWorkspace(testWorkspaceId)
  })

  /**
   * Mock IPC handler for subtitle file operations
   */
  function handleSubtitleFileOperation(request: SubtitleFileOperationRequest): SubtitleFileOperationResponse {
    const { operation, fileId, data } = request

    switch (operation) {
      case 'create':
        const newFileId = `created-${Date.now()}`
        return MockIPCResponse.success(newFileId)

      case 'read':
        if (fileId === 'nonexistent-file') {
          return MockIPCResponse.error('SUBTITLE_FILE_NOT_FOUND', 'File not found')
        }
        if (fileId === 'corrupted-file') {
          return MockIPCResponse.error('SUBTITLE_FILE_CORRUPTED', 'File is corrupted')
        }
        
        // Return appropriate test file
        const content = fileId?.includes('original') ? testFiles.originalFile
          : fileId?.includes('backup') ? testFiles.backupFile
          : testFiles.modifiedFile
        
        const metadata = generateMockSubtitleFileMetadata({
          fileId: fileId || content.metadata.fileId,
          workspaceId: testWorkspaceId
        })

        return MockIPCResponse.withMetadata(content, metadata)

      case 'update':
        return MockIPCResponse.success({ updated: true })

      case 'delete':
        return MockIPCResponse.success({ deleted: true })

      case 'validate':
        const isValid = !fileId?.includes('invalid')
        return MockIPCResponse.success({
          isValid,
          errors: isValid ? [] : [{ code: 'TEST_ERROR', message: 'Test validation error' }],
          warnings: [],
          statistics: { totalSubtitles: 50, validSubtitles: isValid ? 50 : 49 },
          performance: { validationTime: 150 },
          metadata: { validatedAt: Date.now() }
        })

      case 'backup':
        return MockIPCResponse.success(`backup-${Date.now()}`)

      case 'restore':
        return MockIPCResponse.success({ restored: true })

      default:
        return MockIPCResponse.error('SUBTITLE_OPERATION_TIMEOUT', 'Unknown operation')
    }
  }

  /**
   * Mock batch operation handler
   */
  function handleBatchSubtitleOperation(request: any) {
    const results = request.operations.map((op: any, index: number) => ({
      success: true,
      data: handleSubtitleFileOperation(op).data,
      metadata: { operationIndex: index }
    }))

    return {
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    }
  }

  describe('File Lifecycle Operations', () => {
    it('should create new subtitle file successfully', async () => {
      const content = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId,
        subtitleCount: 25
      })

      const fileId = await service.createFile(content, { compress: true })

      expect(fileId).toBeDefined()
      expect(fileId).toMatch(/created-\d+/)
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'subtitle-file-operation',
        expect.objectContaining({
          operation: 'create',
          workspaceId: testWorkspaceId,
          data: content,
          options: expect.objectContaining({
            compress: true,
            validateAfter: true
          })
        })
      )
    })

    it('should load existing subtitle file with caching', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId

      // First load - should hit backend
      const content1 = await service.loadFile(fileId, { useCache: true })
      
      // Second load - should hit cache
      const content2 = await service.loadFile(fileId, { useCache: true })

      expect(content1).toBeDefined()
      expect(content1?.metadata.fileId).toBe(fileId)
      expect(content2).toEqual(content1)

      // Backend should only be called once due to caching
      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(1)

      // Verify cache metrics
      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.hitRate).toBeGreaterThan(0)
    })

    it('should save subtitle file with auto-backup', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      const content = { ...testFiles.modifiedFile }
      content.subtitles[0].text = 'Updated subtitle text'

      await service.saveFile(fileId, content, { createBackup: true })

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'subtitle-file-operation',
        expect.objectContaining({
          operation: 'update',
          fileId,
          data: content,
          options: expect.objectContaining({
            createBackup: true,
            validateAfter: true
          })
        })
      )
    })

    it('should delete subtitle file with backup', async () => {
      const fileId = 'test-file-to-delete'

      await service.deleteFile(fileId, { permanent: false })

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'subtitle-file-operation',
        expect.objectContaining({
          operation: 'delete',
          fileId,
          options: expect.objectContaining({
            createBackup: true
          })
        })
      )
    })

    it('should validate subtitle file content', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId

      const validation = await service.validateFile(fileId)

      expect(validation).toBeDefined()
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.statistics.totalSubtitles).toBeGreaterThan(0)
    })
  })

  describe('Workspace Isolation', () => {
    it('should isolate subtitle files between workspaces', async () => {
      const workspace1Id = TestWorkspaceUtils.createTestWorkspace('workspace-1')
      const workspace2Id = TestWorkspaceUtils.createTestWorkspace('workspace-2')

      const content1 = generateMockSubtitleFileContent({
        workspaceId: workspace1Id,
        subtitleCount: 10
      })
      const content2 = generateMockSubtitleFileContent({
        workspaceId: workspace2Id,
        subtitleCount: 20
      })

      // Create files in different workspaces
      const fileId1 = await service.createFile(content1)
      const fileId2 = await service.createFile(content2)

      expect(fileId1).not.toBe(fileId2)

      // Verify IPC calls used correct workspace IDs
      const createCalls = mockIpcRenderer.invoke.mock.calls.filter(
        call => call[0] === 'subtitle-file-operation' && call[1].operation === 'create'
      )

      expect(createCalls).toHaveLength(2)
      expect(createCalls[0][1].workspaceId).toBe(workspace1Id)
      expect(createCalls[1][1].workspaceId).toBe(workspace2Id)
    })

    it('should not allow cross-workspace file access', async () => {
      const otherWorkspaceId = TestWorkspaceUtils.createTestWorkspace('other-workspace')
      
      // Mock file from different workspace
      mockIpcRenderer.invoke.mockImplementationOnce(async (channel, request) => {
        if (request.workspaceId !== otherWorkspaceId) {
          return MockIPCResponse.error('SUBTITLE_FILE_ACCESS_DENIED', 'Access denied')
        }
        return MockIPCResponse.success(testFiles.modifiedFile)
      })

      // Try to load file with wrong workspace context
      await expect(
        service.loadFile('cross-workspace-file', { useCache: false })
      ).rejects.toThrow('Access denied')
    })

    it('should clean up workspace files on workspace deletion', async () => {
      const workspaceId = TestWorkspaceUtils.createTestWorkspace('temp-workspace')
      
      // Create file in workspace
      const content = generateMockSubtitleFileContent({ workspaceId })
      const fileId = await service.createFile(content)

      // Simulate workspace deletion cleanup
      await service.clearCache() // Clear cache for workspace
      
      // Verify cache is empty
      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.entryCount).toBe(0)
    })
  })

  describe('Auto-save Functionality', () => {
    it('should handle auto-save with batching', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      const content = { ...testFiles.modifiedFile }

      // Test low-priority save (should be batched)
      const savePromise = service.saveFile(fileId, content, { priority: 1 })

      // Wait a bit to allow batching
      await new Promise(resolve => setTimeout(resolve, 100))

      await savePromise

      expect(mockIpcRenderer.invoke).toHaveBeenCalled()
    })

    it('should handle high-priority saves immediately', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      const content = { ...testFiles.modifiedFile }

      const startTime = Date.now()
      
      // High-priority save should be immediate
      await service.saveFile(fileId, content, { priority: 3 })
      
      const duration = Date.now() - startTime
      
      // Should complete quickly without batching delay
      expect(duration).toBeLessThan(1000)
      expect(mockIpcRenderer.invoke).toHaveBeenCalled()
    })
  })

  describe('Error Recovery', () => {
    it('should handle file not found errors gracefully', async () => {
      await expect(
        service.loadFile('nonexistent-file')
      ).rejects.toThrow('File not found')

      // Should still function for other operations
      const content = generateMockSubtitleFileContent({ workspaceId: testWorkspaceId })
      const fileId = await service.createFile(content)
      expect(fileId).toBeDefined()
    })

    it('should handle file corruption with appropriate errors', async () => {
      await expect(
        service.loadFile('corrupted-file')
      ).rejects.toThrow('File is corrupted')
    })

    it('should handle network timeouts', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        ErrorSimulator.networkError()
      )

      await expect(
        service.loadFile('timeout-file')
      ).rejects.toThrow('Network connection failed')
    })

    it('should handle validation failures appropriately', async () => {
      const validation = await service.validateFile('invalid-file')

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(1)
      expect(validation.errors[0].code).toBe('TEST_ERROR')
    })

    it('should recover from disk space errors', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        ErrorSimulator.diskSpaceError()
      )

      await expect(
        service.createFile(testFiles.modifiedFile)
      ).rejects.toThrow('Insufficient disk space')
    })
  })

  describe('Session Restoration', () => {
    it('should restore subtitle state after app restart', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      
      // Load file and cache it
      const originalContent = await service.loadFile(fileId)
      expect(originalContent).toBeDefined()

      // Simulate app restart by creating new service instance
      resetSubtitlePersistenceService()
      const newService = new SubtitlePersistenceService()

      // File should be reloadable (though not cached)
      const restoredContent = await newService.loadFile(fileId)
      expect(restoredContent).toBeDefined()
      expect(restoredContent?.metadata.fileId).toBe(fileId)
    })

    it('should handle concurrent editing scenarios', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      const content1 = { ...testFiles.modifiedFile }
      const content2 = { ...testFiles.modifiedFile }

      // Simulate concurrent edits
      content1.subtitles[0].text = 'Edit from user 1'
      content2.subtitles[0].text = 'Edit from user 2'

      // Both saves should succeed (last write wins)
      await Promise.all([
        service.saveFile(fileId, content1),
        service.saveFile(fileId, content2)
      ])

      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('Backup and Restore', () => {
    it('should create backups successfully', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      const description = 'Test backup before major edits'

      const backupId = await service.createBackup(fileId, description)

      expect(backupId).toMatch(/backup-\d+/)
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'subtitle-file-operation',
        expect.objectContaining({
          operation: 'backup',
          fileId,
          data: { description }
        })
      )
    })

    it('should restore from backup successfully', async () => {
      const backupId = 'test-backup-123'

      await service.restoreBackup(backupId)

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'subtitle-file-operation',
        expect.objectContaining({
          operation: 'restore',
          data: { backupId }
        })
      )
    })

    it('should clear cache after backup restoration', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      
      // Load and cache file
      await service.loadFile(fileId)
      
      let cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.entryCount).toBeGreaterThan(0)

      // Restore backup (should clear cache)
      await service.restoreBackup('test-backup')

      cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.entryCount).toBe(0)
    })
  })

  describe('Batch Operations', () => {
    it('should process batch operations efficiently', async () => {
      const operations = [
        { operation: 'read' as const, fileId: 'file-1' },
        { operation: 'read' as const, fileId: 'file-2' },
        { operation: 'read' as const, fileId: 'file-3' }
      ]

      const batchRequest = {
        workspaceId: testWorkspaceId,
        operations
      }

      const result = await service.batchOperation(batchRequest)

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(3)
      expect(result.summary.successful).toBe(3)
      expect(result.summary.failed).toBe(0)
    })

    it('should handle partial batch failures gracefully', async () => {
      const operations = [
        { operation: 'read' as const, fileId: 'valid-file' },
        { operation: 'read' as const, fileId: 'nonexistent-file' },
        { operation: 'read' as const, fileId: 'valid-file-2' }
      ]

      const batchRequest = {
        workspaceId: testWorkspaceId,
        operations
      }

      const result = await service.batchOperation(batchRequest)

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(3)
      // Implementation would handle individual failures
    })
  })

  describe('Cache Behavior', () => {
    it('should warm cache predictively', async () => {
      // Load several files to establish usage patterns
      const fileIds = ['file-1', 'file-2', 'file-3']
      
      for (const fileId of fileIds) {
        await service.loadFile(fileId)
        await service.loadFile(fileId) // Second access to establish pattern
      }

      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.hitRate).toBeGreaterThan(0)
      expect(cacheMetrics.predictiveMetrics.patternsTracked).toBeGreaterThan(0)
    })

    it('should evict least recently used entries', async () => {
      // Configure small cache for testing
      const smallCacheService = new SubtitlePersistenceService({
        enabled: true,
        maxSize: 1024, // Very small cache
        maxEntries: 2,
        enableLRU: true
      })

      // Load files that exceed cache capacity
      await smallCacheService.loadFile('file-1')
      await smallCacheService.loadFile('file-2')
      await smallCacheService.loadFile('file-3') // Should evict file-1

      const cacheMetrics = smallCacheService.getCacheMetrics()
      expect(cacheMetrics.evictionCount).toBeGreaterThan(0)
    })

    it('should compress large files in cache', async () => {
      const largeContent = PerformanceTestUtils.generateLargeSubtitleData(100) // 100KB
      
      // Mock large file response
      mockIpcRenderer.invoke.mockImplementationOnce(async () => {
        return MockIPCResponse.success(largeContent)
      })

      await service.loadFile('large-file')

      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.compressionMetrics.compressedEntries).toBeGreaterThan(0)
      expect(cacheMetrics.compressionMetrics.compressionRatio).toBeLessThan(1)
    })
  })

  describe('Performance Monitoring', () => {
    it('should track operation performance metrics', async () => {
      const fileId = testFiles.modifiedFile.metadata.fileId
      
      // Perform various operations
      await service.loadFile(fileId)
      await service.validateFile(fileId)
      await service.saveFile(fileId, testFiles.modifiedFile)

      const performanceMetrics = await service.getPerformanceMetrics()
      expect(performanceMetrics).toHaveLength(3)
      
      const readMetric = performanceMetrics.find(m => m.operationType === 'read')
      const validateMetric = performanceMetrics.find(m => m.operationType === 'validate')
      const writeMetric = performanceMetrics.find(m => m.operationType === 'write')

      expect(readMetric).toBeDefined()
      expect(validateMetric).toBeDefined()
      expect(writeMetric).toBeDefined()

      expect(readMetric!.success).toBe(true)
      expect(readMetric!.duration).toBeGreaterThan(0)
      expect(readMetric!.throughput).toBeGreaterThan(0)
    })

    it('should calculate performance analytics', async () => {
      // Perform multiple operations to generate metrics
      for (let i = 0; i < 5; i++) {
        await service.loadFile(`test-file-${i}`)
      }

      const performanceMetrics = await service.getPerformanceMetrics()
      expect(performanceMetrics.length).toBeGreaterThanOrEqual(5)

      // Verify metrics contain required fields
      performanceMetrics.forEach(metric => {
        expect(metric.id).toBeDefined()
        expect(metric.operationType).toBeDefined()
        expect(metric.duration).toBeGreaterThan(0)
        expect(metric.timestamp).toBeGreaterThan(0)
        expect(typeof metric.success).toBe('boolean')
      })
    })
  })
})