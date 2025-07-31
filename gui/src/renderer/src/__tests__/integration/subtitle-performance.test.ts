/**
 * Subtitle Persistence Performance Tests
 * 
 * Performance validation tests for subtitle persistence system.
 * Validates performance targets and benchmarks under various load conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SubtitlePersistenceService, resetSubtitlePersistenceService } from '../../services/subtitle-persistence-service'
import {
  generateMockSubtitleFileContent,
  MockIPCResponse,
  PerformanceTestUtils,
  TestWorkspaceUtils,
  CacheTestUtils
} from '../utils/subtitle-test-helpers'
import type { SubtitleFileContent } from '../../types/subtitle-persistence'

// Performance targets from implementation requirements
const PERFORMANCE_TARGETS = {
  FILE_LOAD_TIME: 500, // ms for 100KB files
  AUTO_SAVE_LATENCY: 50, // ms UI blocking
  MEMORY_USAGE: 50 * 1024 * 1024, // 50MB for sessions
  CACHE_HIT_RATE: 0.9, // 90%
  COMPRESSION_RATIO: 0.7, // 30% size reduction
  CONCURRENT_OPERATIONS: 5, // Max concurrent operations
  THROUGHPUT_MIN: 1000, // bytes per second minimum
  ERROR_RATE_MAX: 0.01 // 1% maximum error rate
}

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

describe('Subtitle Persistence Performance Tests', () => {
  let service: SubtitlePersistenceService
  let testWorkspaceId: string

  beforeEach(() => {
    resetSubtitlePersistenceService()
    service = new SubtitlePersistenceService({
      enabled: true,
      maxSize: 10 * 1024 * 1024, // 10MB
      maxEntries: 100,
      defaultTTL: 300000,
      enableLRU: true,
      enableCompression: true
    })

    testWorkspaceId = TestWorkspaceUtils.createTestWorkspace()
    vi.clearAllMocks()

    // Setup IPC mock with realistic delays
    mockIpcRenderer.invoke.mockImplementation(async (channel: string, request: any) => {
      // Simulate realistic network/disk latency
      const baseDelay = 50 + Math.random() * 100 // 50-150ms
      const fileSize = request.data ? JSON.stringify(request.data).length : 10000
      const sizeDelay = fileSize / 10000 // 1ms per 10KB
      
      await new Promise(resolve => setTimeout(resolve, baseDelay + sizeDelay))

      switch (channel) {
        case 'subtitle-file-operation':
          return handlePerformanceOperation(request)
        case 'subtitle-batch-operation':
          return handleBatchOperation(request)
        default:
          return MockIPCResponse.success({ data: 'mock-response' })
      }
    })
  })

  afterEach(async () => {
    await service.clearCache()
  })

  function handlePerformanceOperation(request: any) {
    const { operation, fileId } = request

    switch (operation) {
      case 'read':
        // Return file content with size-based delay simulation
        const content = generateMockFileWithSize(fileId, 100 * 1024) // 100KB default
        return MockIPCResponse.success(content, {
          bytesProcessed: JSON.stringify(content).length,
          processingTime: 100,
          cacheHit: false
        })

      case 'create':
      case 'update':
        return MockIPCResponse.success(`${operation}-${Date.now()}`, {
          bytesProcessed: JSON.stringify(request.data).length,
          processingTime: 150,
          cacheHit: false
        })

      case 'validate':
        return MockIPCResponse.success({
          isValid: true,
          errors: [],
          warnings: [],
          statistics: { totalSubtitles: 100 },
          performance: { validationTime: 200 }
        })

      default:
        return MockIPCResponse.success({ result: 'mock' })
    }
  }

  function handleBatchOperation(request: any) {
    const results = request.operations.map((op: any, index: number) => ({
      success: true,
      data: handlePerformanceOperation(op).data,
      performance: {
        bytesProcessed: 5000,
        processingTime: 75
      }
    }))

    return {
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.length,
        failed: 0,
        totalProcessingTime: results.length * 75
      }
    }
  }

  function generateMockFileWithSize(fileId: string, targetSizeBytes: number): SubtitleFileContent {
    // Calculate subtitle count needed for target size
    const avgSubtitleSize = 150 // bytes per subtitle
    const subtitleCount = Math.floor(targetSizeBytes / avgSubtitleSize)
    
    return generateMockSubtitleFileContent({
      fileId: fileId || `perf-test-${Date.now()}`,
      workspaceId: testWorkspaceId,
      subtitleCount,
      includeEditHistory: false
    })
  }

  describe('File Load Performance', () => {
    it('should load 100KB files within 500ms target', async () => {
      const fileId = 'large-test-file'
      const content = generateMockFileWithSize(fileId, 100 * 1024) // 100KB

      const result = await PerformanceTestUtils.measureOperation(
        () => service.loadFile(fileId),
        PERFORMANCE_TARGETS.FILE_LOAD_TIME
      )

      expect(result.passed).toBe(true)
      expect(result.duration).toBeLessThan(PERFORMANCE_TARGETS.FILE_LOAD_TIME)
      expect(result.result).toBeDefined()
      
      console.log(`File load performance: ${result.duration.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.FILE_LOAD_TIME}ms)`)
    })

    it('should maintain performance with larger files (500KB)', async () => {
      const fileId = 'very-large-file'
      const content = generateMockFileWithSize(fileId, 500 * 1024) // 500KB

      const result = await PerformanceTestUtils.measureOperation(
        () => service.loadFile(fileId),
        PERFORMANCE_TARGETS.FILE_LOAD_TIME * 2.5 // Allow 2.5x for larger files
      )

      expect(result.passed).toBe(true)
      expect(result.result).toBeDefined()
      
      console.log(`Large file load performance: ${result.duration.toFixed(2)}ms`)
    })

    it('should achieve target throughput for file operations', async () => {
      const fileId = 'throughput-test-file'
      const content = generateMockFileWithSize(fileId, 50 * 1024) // 50KB

      const startTime = performance.now()
      const result = await service.loadFile(fileId)
      const duration = performance.now() - startTime

      const fileSize = JSON.stringify(result).length
      const throughput = (fileSize / duration) * 1000 // bytes per second

      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.THROUGHPUT_MIN)
      
      console.log(`Throughput: ${(throughput / 1024).toFixed(2)} KB/s (target: ${(PERFORMANCE_TARGETS.THROUGHPUT_MIN / 1024).toFixed(2)} KB/s)`)
    })
  })

  describe('Auto-save Performance', () => {
    it('should complete auto-save within UI blocking target', async () => {
      const fileId = 'autosave-test-file'
      const content = generateMockSubtitleFileContent({
        fileId,
        workspaceId: testWorkspaceId,
        subtitleCount: 25
      })

      // Simulate auto-save (low priority)
      const result = await PerformanceTestUtils.measureOperation(
        () => service.saveFile(fileId, content, { priority: 1 }),
        PERFORMANCE_TARGETS.AUTO_SAVE_LATENCY * 5 // Auto-save can be slower but shouldn't block UI
      )

      expect(result.passed).toBe(true)
      
      console.log(`Auto-save performance: ${result.duration.toFixed(2)}ms`)
    })

    it('should handle high-priority saves immediately', async () => {
      const fileId = 'priority-save-file'
      const content = generateMockSubtitleFileContent({
        fileId,
        workspaceId: testWorkspaceId,
        subtitleCount: 30
      })

      // High-priority save should be very fast
      const result = await PerformanceTestUtils.measureOperation(
        () => service.saveFile(fileId, content, { priority: 3 }),
        200 // High priority saves should be under 200ms
      )

      expect(result.passed).toBe(true)
      
      console.log(`High-priority save performance: ${result.duration.toFixed(2)}ms`)
    })

    it('should batch low-priority saves efficiently', async () => {
      const fileIds = ['batch-1', 'batch-2', 'batch-3', 'batch-4', 'batch-5']
      const contents = fileIds.map(id => generateMockSubtitleFileContent({
        fileId: id,
        workspaceId: testWorkspaceId,
        subtitleCount: 15
      }))

      // Start all saves simultaneously (low priority)
      const startTime = performance.now()
      const savePromises = contents.map((content, index) =>
        service.saveFile(fileIds[index], content, { priority: 1 })
      )

      await Promise.all(savePromises)
      const totalDuration = performance.now() - startTime

      // Batched operations should be more efficient than individual saves
      const avgDurationPerSave = totalDuration / fileIds.length
      expect(avgDurationPerSave).toBeLessThan(300) // Should average under 300ms per save
      
      console.log(`Batch save performance: ${avgDurationPerSave.toFixed(2)}ms average per save`)
    })
  })

  describe('Memory Usage Performance', () => {
    it('should stay within memory usage targets', async () => {
      const fileIds = ['mem-1', 'mem-2', 'mem-3', 'mem-4', 'mem-5']
      
      const result = await PerformanceTestUtils.trackMemoryUsage(
        async () => {
          // Load multiple files to test memory usage
          const loadPromises = fileIds.map(id =>
            service.loadFile(id, { useCache: true })
          )
          return await Promise.all(loadPromises)
        },
        PERFORMANCE_TARGETS.MEMORY_USAGE / (1024 * 1024) // Convert to MB
      )

      expect(result.passed).toBe(true)
      
      console.log(`Memory usage: ${(result.memoryUsed / (1024 * 1024)).toFixed(2)}MB (target: ${PERFORMANCE_TARGETS.MEMORY_USAGE / (1024 * 1024)}MB)`)
    })

    it('should efficiently manage cache memory', async () => {
      // Load files to populate cache
      const fileIds = Array.from({ length: 20 }, (_, i) => `cache-test-${i}`)
      
      for (const fileId of fileIds) {
        await service.loadFile(fileId)
      }

      const cacheMetrics = service.getCacheMetrics()
      
      // Verify cache is operating efficiently
      expect(cacheMetrics.entryCount).toBeGreaterThan(0)
      expect(cacheMetrics.memoryUsage.total).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_USAGE)
      expect(cacheMetrics.efficiencyScore).toBeGreaterThan(0.7) // 70% efficiency minimum
      
      console.log(`Cache efficiency: ${(cacheMetrics.efficiencyScore * 100).toFixed(1)}%`)
      console.log(`Cache memory usage: ${(cacheMetrics.memoryUsage.total / (1024 * 1024)).toFixed(2)}MB`)
    })
  })

  describe('Cache Performance', () => {
    it('should achieve target cache hit rate', async () => {
      const fileIds = ['cache-1', 'cache-2', 'cache-3']
      
      // First pass - populate cache
      for (const fileId of fileIds) {
        await service.loadFile(fileId, { useCache: true })
      }

      // Second pass - should hit cache
      for (const fileId of fileIds) {
        await service.loadFile(fileId, { useCache: true })
      }

      const cacheMetrics = service.getCacheMetrics()
      
      expect(cacheMetrics.hitRate).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.CACHE_HIT_RATE)
      
      console.log(`Cache hit rate: ${(cacheMetrics.hitRate * 100).toFixed(1)}% (target: ${PERFORMANCE_TARGETS.CACHE_HIT_RATE * 100}%)`)
    })

    it('should access cached files quickly', async () => {
      const fileId = 'cache-speed-test'
      
      // First load - populate cache
      await service.loadFile(fileId, { useCache: true })

      // Second load - should be from cache and very fast
      const result = await PerformanceTestUtils.measureOperation(
        () => service.loadFile(fileId, { useCache: true }),
        100 // Cache access should be under 100ms
      )

      expect(result.passed).toBe(true)
      expect(result.result).toBeDefined()
      
      console.log(`Cache access performance: ${result.duration.toFixed(2)}ms`)
    })

    it('should handle cache eviction efficiently', async () => {
      // Configure small cache to force evictions
      const smallCacheService = new SubtitlePersistenceService({
        enabled: true,
        maxSize: 100 * 1024, // 100KB max
        maxEntries: 5,
        enableLRU: true
      })

      // Load more files than cache can hold
      const fileIds = Array.from({ length: 10 }, (_, i) => `eviction-test-${i}`)
      
      for (const fileId of fileIds) {
        await smallCacheService.loadFile(fileId)
      }

      const cacheMetrics = smallCacheService.getCacheMetrics()
      
      // Should have evicted some entries
      expect(cacheMetrics.evictionCount).toBeGreaterThan(0)
      expect(cacheMetrics.entryCount).toBeLessThanOrEqual(5) // Respects max entries
      
      console.log(`Cache evictions: ${cacheMetrics.evictionCount}`)
    })
  })

  describe('Compression Performance', () => {
    it('should achieve target compression ratios', async () => {
      const largeContent = PerformanceTestUtils.generateLargeSubtitleData(200) // 200KB
      
      // Mock compression in IPC response
      mockIpcRenderer.invoke.mockImplementationOnce(async () => {
        const originalSize = JSON.stringify(largeContent).length
        const compressedSize = Math.floor(originalSize * 0.6) // 40% compression
        
        return MockIPCResponse.success(largeContent, {
          bytesProcessed: originalSize,
          processingTime: 200,
          compression: {
            originalSize,
            compressedSize,
            compressionRatio: compressedSize / originalSize
          }
        })
      })

      await service.loadFile('compression-test')

      const cacheMetrics = service.getCacheMetrics()
      
      if (cacheMetrics.compressionMetrics.compressedEntries > 0) {
        expect(cacheMetrics.compressionMetrics.compressionRatio)
          .toBeLessThanOrEqual(PERFORMANCE_TARGETS.COMPRESSION_RATIO)
        
        console.log(`Compression ratio: ${(cacheMetrics.compressionMetrics.compressionRatio * 100).toFixed(1)}%`)
      }
    })

    it('should compress large files without significant performance impact', async () => {
      const largeContent = PerformanceTestUtils.generateLargeSubtitleData(500) // 500KB

      const result = await PerformanceTestUtils.measureOperation(
        () => service.createFile(largeContent, { compress: true }),
        1000 // Allow 1 second for compression
      )

      expect(result.passed).toBe(true)
      expect(result.result).toBeDefined()
      
      console.log(`Large file compression performance: ${result.duration.toFixed(2)}ms`)
    })
  })

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent file operations efficiently', async () => {
      const fileIds = Array.from({ length: PERFORMANCE_TARGETS.CONCURRENT_OPERATIONS }, 
        (_, i) => `concurrent-${i}`)
      
      const operations = fileIds.map(fileId => 
        () => service.loadFile(fileId)
      )

      const results = await PerformanceTestUtils.testConcurrentOperations(
        operations,
        PERFORMANCE_TARGETS.CONCURRENT_OPERATIONS
      )

      const successfulOperations = results.filter(r => r.success)
      const averageDuration = successfulOperations.reduce((sum, r) => sum + r.duration, 0) / successfulOperations.length

      expect(successfulOperations.length).toBe(PERFORMANCE_TARGETS.CONCURRENT_OPERATIONS)
      expect(averageDuration).toBeLessThan(1000) // Should average under 1 second
      
      console.log(`Concurrent operations: ${successfulOperations.length}/${results.length} successful`)
      console.log(`Average duration: ${averageDuration.toFixed(2)}ms`)
    })

    it('should maintain error rates under targets during load', async () => {
      const operationCount = 50
      const operations = Array.from({ length: operationCount }, (_, i) =>
        () => service.loadFile(`load-test-${i}`)
      )

      const results = await PerformanceTestUtils.testConcurrentOperations(operations, 5)
      
      const errorRate = results.filter(r => !r.success).length / results.length
      
      expect(errorRate).toBeLessThanOrEqual(PERFORMANCE_TARGETS.ERROR_RATE_MAX)
      
      console.log(`Error rate under load: ${(errorRate * 100).toFixed(2)}% (target: ${PERFORMANCE_TARGETS.ERROR_RATE_MAX * 100}%)`)
    })
  })

  describe('Background Processing Performance', () => {
    it('should not block UI during background operations', async () => {
      const fileId = 'background-test'
      const content = generateMockSubtitleFileContent({
        fileId,
        workspaceId: testWorkspaceId,
        subtitleCount: 100
      })

      // Start a background save operation
      const savePromise = service.saveFile(fileId, content, { priority: 1 })
      
      // Immediately try to perform another operation
      const startTime = performance.now()
      await service.validateFile('another-file')
      const blockingTime = performance.now() - startTime

      // Should not be blocked by background save
      expect(blockingTime).toBeLessThan(PERFORMANCE_TARGETS.AUTO_SAVE_LATENCY)
      
      // Ensure background operation completes
      await savePromise
      
      console.log(`UI blocking time: ${blockingTime.toFixed(2)}ms (target: <${PERFORMANCE_TARGETS.AUTO_SAVE_LATENCY}ms)`)
    })

    it('should process background queue efficiently', async () => {
      const fileIds = ['bg-1', 'bg-2', 'bg-3', 'bg-4', 'bg-5']
      const contents = fileIds.map(id => generateMockSubtitleFileContent({
        fileId: id,
        workspaceId: testWorkspaceId,
        subtitleCount: 20
      }))

      // Queue multiple background operations
      const startTime = performance.now()
      const savePromises = contents.map((content, index) =>
        service.saveFile(fileIds[index], content, { priority: 1 })
      )

      await Promise.all(savePromises)
      const totalTime = performance.now() - startTime

      // Background processing should be efficient
      const avgTimePerOperation = totalTime / fileIds.length
      expect(avgTimePerOperation).toBeLessThan(500) // Should average under 500ms
      
      console.log(`Background queue performance: ${avgTimePerOperation.toFixed(2)}ms average per operation`)
    })
  })

  describe('Stress Testing', () => {
    it('should handle rapid file access patterns', async () => {
      const fileId = 'stress-test-file'
      const accessCount = 20

      // Rapid access pattern
      const startTime = performance.now()
      const accessPromises = Array.from({ length: accessCount }, () =>
        service.loadFile(fileId, { useCache: true })
      )

      const results = await Promise.all(accessPromises)
      const totalTime = performance.now() - startTime

      expect(results).toHaveLength(accessCount)
      expect(results.every(r => r !== null)).toBe(true)
      
      const avgAccessTime = totalTime / accessCount
      expect(avgAccessTime).toBeLessThan(200) // Should average under 200ms per access
      
      console.log(`Rapid access performance: ${avgAccessTime.toFixed(2)}ms average per access`)
    })

    it('should maintain performance under memory pressure', async () => {
      // Create many large files to stress memory
      const largeFiles = Array.from({ length: 10 }, (_, i) => ({
        fileId: `memory-stress-${i}`,
        content: PerformanceTestUtils.generateLargeSubtitleData(100) // 100KB each
      }))

      const startTime = performance.now()
      
      // Load all files
      for (const { fileId, content } of largeFiles) {
        await service.loadFile(fileId)
      }

      const loadTime = performance.now() - startTime
      
      // Verify cache management
      const cacheMetrics = service.getCacheMetrics()
      
      expect(cacheMetrics.memoryUsage.total).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_USAGE)
      expect(loadTime / largeFiles.length).toBeLessThan(1000) // Average under 1s per file
      
      console.log(`Memory stress test: ${(loadTime / largeFiles.length).toFixed(2)}ms average per large file`)
      console.log(`Final memory usage: ${(cacheMetrics.memoryUsage.total / (1024 * 1024)).toFixed(2)}MB`)
    })
  })

  describe('Performance Monitoring', () => {
    it('should track performance metrics accurately', async () => {
      // Perform various operations
      await service.loadFile('metrics-test-1')
      await service.validateFile('metrics-test-2')
      await service.saveFile('metrics-test-3', generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId
      }))

      const metrics = await service.getPerformanceMetrics()
      
      expect(metrics.length).toBeGreaterThanOrEqual(3)
      
      // Verify metric structure
      metrics.forEach(metric => {
        expect(metric.duration).toBeGreaterThan(0)
        expect(metric.throughput).toBeGreaterThan(0)
        expect(metric.timestamp).toBeGreaterThan(0)
        expect(typeof metric.success).toBe('boolean')
      })
      
      console.log(`Performance metrics collected: ${metrics.length}`)
    })
  })
})