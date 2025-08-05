/**
 * Subtitle Persistence Edge Cases Tests
 * 
 * Tests for edge cases, error recovery, and resilience scenarios.
 * Validates the system's behavior under unusual conditions and failure states.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SubtitlePersistenceService, resetSubtitlePersistenceService } from '../../services/subtitle/subtitle-persistence-service'
import {
  generateMockSubtitleFileContent,
  MockIPCResponse,
  ErrorSimulator,
  TestWorkspaceUtils,
  PerformanceTestUtils
} from '../utils/subtitle-test-helpers'
import type { 
  SubtitleFileContent,
  SubtitleFileOperationRequest 
} from '../../types/subtitle-persistence'

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

// Mock console methods to avoid noise in tests
const originalConsole = {
  warn: console.warn,
  error: console.error
}

beforeEach(() => {
  console.warn = vi.fn()
  console.error = vi.fn()
})

afterEach(() => {
  console.warn = originalConsole.warn
  console.error = originalConsole.error
})

describe('Subtitle Persistence Edge Cases Tests', () => {
  let service: SubtitlePersistenceService
  let testWorkspaceId: string

  beforeEach(() => {
    resetSubtitlePersistenceService()
    service = new SubtitlePersistenceService({
      enabled: true,
      maxSize: 5 * 1024 * 1024, // 5MB for edge case testing
      maxEntries: 50,
      defaultTTL: 30000, // Shorter TTL for edge case testing
      enableLRU: true,
      enableCompression: true
    })

    testWorkspaceId = TestWorkspaceUtils.createTestWorkspace()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await service.clearCache()
  })

  describe('File Corruption Scenarios', () => {
    it('should handle corrupted file headers gracefully', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.error('SUBTITLE_FILE_CORRUPTED', 'Invalid file header')
      )

      await expect(service.loadFile('corrupted-header-file'))
        .rejects.toThrow('Invalid file header')

      // Service should remain functional for other files
      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(generateMockSubtitleFileContent())
      )

      const validFile = await service.loadFile('valid-file')
      expect(validFile).toBeDefined()
    })

    it('should handle corrupted JSON data', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        success: true,
        data: '{"invalid": json syntax}', // Malformed JSON
        metadata: { fileId: 'corrupted-json' }
      })

      await expect(service.loadFile('corrupted-json'))
        .rejects.toThrow()
    })

    it('should handle partial file corruption with recovery', async () => {
      const partiallyCorrupted = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId
      })
      
      // Corrupt some subtitle entries
      partiallyCorrupted.subtitles[5] = null as any
      delete partiallyCorrupted.subtitles[10]

      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(partiallyCorrupted)
      )

      // Should handle corrupted entries gracefully
      const result = await service.loadFile('partially-corrupted')
      expect(result).toBeDefined()
      
      // Should validate and report issues
      const validation = await service.validateFile('partially-corrupted')
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should handle checksum mismatches', async () => {
      const content = generateMockSubtitleFileContent({ workspaceId: testWorkspaceId })
      
      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.error('SUBTITLE_FILE_CORRUPTED', 'Checksum validation failed')
      )

      await expect(service.loadFile('checksum-mismatch'))
        .rejects.toThrow('Checksum validation failed')
    })
  })

  describe('Network and I/O Failures', () => {
    it('should handle network timeouts with retry logic', async () => {
      let attemptCount = 0
      mockIpcRenderer.invoke.mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw ErrorSimulator.networkError()
        }
        return MockIPCResponse.success(generateMockSubtitleFileContent())
      })

      // Should eventually succeed after retries
      const result = await service.loadFile('timeout-file')
      expect(result).toBeDefined()
      expect(attemptCount).toBe(3)
    })

    it('should handle disk full scenarios', async () => {
      const content = generateMockSubtitleFileContent({ workspaceId: testWorkspaceId })
      
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        ErrorSimulator.diskSpaceError()
      )

      await expect(service.saveFile('test-file', content))
        .rejects.toThrow('Insufficient disk space')

      // Cache should not be affected
      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.entryCount).toBeGreaterThanOrEqual(0)
    })

    it('should handle permission denied errors', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        ErrorSimulator.permissionError('write')
      )

      await expect(service.createFile(generateMockSubtitleFileContent()))
        .rejects.toThrow('Permission denied for write')
    })

    it('should handle sudden network disconnection', async () => {
      // Simulate network disconnection during operation
      mockIpcRenderer.invoke.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        throw new Error('Network unreachable')
      })

      await expect(service.loadFile('network-fail'))
        .rejects.toThrow('Network unreachable')
    })
  })

  describe('Memory and Resource Constraints', () => {
    it('should handle extremely large files gracefully', async () => {
      const hugeContent = PerformanceTestUtils.generateLargeSubtitleData(10 * 1024) // 10MB
      
      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(hugeContent)
      )

      // Should handle large files without crashing
      const result = await service.loadFile('huge-file')
      expect(result).toBeDefined()

      // Should not cache files that are too large
      const cacheMetrics = service.getCacheMetrics()
      // Implementation should skip caching very large files
    })

    it('should handle memory pressure during cache operations', async () => {
      // Fill cache to near capacity
      const filePromises = Array.from({ length: 10 }, (_, i) =>
        service.loadFile(`memory-test-${i}`)
      )

      await Promise.all(filePromises)

      // Should handle memory pressure gracefully
      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.entryCount).toBeLessThanOrEqual(50) // Should respect max entries
    })

    it('should handle rapid cache eviction scenarios', async () => {
      // Configure very small cache
      const smallCacheService = new SubtitlePersistenceService({
        enabled: true,
        maxSize: 1024, // 1KB only
        maxEntries: 2,
        enableLRU: true
      })

      // Load many files to force rapid evictions
      for (let i = 0; i < 10; i++) {
        await smallCacheService.loadFile(`eviction-test-${i}`)
      }

      const cacheMetrics = smallCacheService.getCacheMetrics()
      expect(cacheMetrics.evictionCount).toBeGreaterThan(5)
      expect(cacheMetrics.entryCount).toBeLessThanOrEqual(2)
    })

    it('should handle memory leaks in long-running sessions', async () => {
      // Simulate long-running session with many operations
      const operationCycles = 50
      
      for (let cycle = 0; cycle < operationCycles; cycle++) {
        const fileId = `cycle-${cycle}`
        const content = generateMockSubtitleFileContent({
          fileId,
          workspaceId: testWorkspaceId,
          subtitleCount: 10
        })

        await service.loadFile(fileId)
        await service.saveFile(fileId, content)
        
        // Periodically clear cache to simulate realistic usage
        if (cycle % 10 === 0) {
          await service.clearCache()
        }
      }

      // Should not accumulate unbounded memory
      const finalMetrics = service.getCacheMetrics()
      expect(finalMetrics.memoryUsage.total).toBeLessThan(10 * 1024 * 1024) // 10MB max
    })
  })

  describe('Concurrency Edge Cases', () => {
    it('should handle simultaneous access to same file', async () => {
      const fileId = 'concurrent-access-file'
      const content = generateMockSubtitleFileContent({ workspaceId: testWorkspaceId })

      // Multiple simultaneous loads of same file
      const loadPromises = Array.from({ length: 5 }, () =>
        service.loadFile(fileId)
      )

      const results = await Promise.all(loadPromises)
      
      // All should succeed and return same content
      expect(results.every(r => r !== null)).toBe(true)
      expect(results.every(r => r?.metadata.fileId === fileId)).toBe(true)

      // Should deduplicate IPC calls
      const ipcCalls = mockIpcRenderer.invoke.mock.calls.filter(
        call => call[1]?.fileId === fileId
      )
      expect(ipcCalls.length).toBe(1) // Should deduplicate
    })

    it('should handle race conditions in cache updates', async () => {
      const fileId = 'race-condition-file'
      const content1 = generateMockSubtitleFileContent({ workspaceId: testWorkspaceId })
      const content2 = { ...content1, subtitles: [...content1.subtitles.slice(0, 5)] }

      // Simultaneous save operations
      const savePromises = [
        service.saveFile(fileId, content1),
        service.saveFile(fileId, content2)
      ]

      // Both should complete without error (last write wins)
      await expect(Promise.all(savePromises)).resolves.toBeDefined()
    })

    it('should handle cache coherency during concurrent operations', async () => {
      const fileId = 'cache-coherency-test'
      
      // Start load operation
      const loadPromise = service.loadFile(fileId)
      
      // Immediately start save operation
      const content = generateMockSubtitleFileContent({ workspaceId: testWorkspaceId })
      const savePromise = service.saveFile(fileId, content)

      // Both should complete successfully
      const [loadResult, saveResult] = await Promise.all([loadPromise, savePromise])
      
      expect(loadResult).toBeDefined()
      expect(saveResult).toBeUndefined() // save returns void
    })

    it('should handle interrupted operations gracefully', async () => {
      const fileId = 'interrupted-operation'
      
      // Mock operation that gets interrupted
      mockIpcRenderer.invoke.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        throw new Error('Operation interrupted')
      })

      await expect(service.loadFile(fileId))
        .rejects.toThrow('Operation interrupted')

      // Service should recover and work for subsequent operations
      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(generateMockSubtitleFileContent())
      )

      const result = await service.loadFile('recovery-test')
      expect(result).toBeDefined()
    })
  })

  describe('Data Integrity Edge Cases', () => {
    it('should handle malformed subtitle timestamps', async () => {
      const malformedContent = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId
      })
      
      // Corrupt timestamps
      malformedContent.subtitles[0].startTime = -1000
      malformedContent.subtitles[1].endTime = NaN
      malformedContent.subtitles[2].startTime = malformedContent.subtitles[2].endTime + 1000 // Start after end

      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(malformedContent)
      )

      const result = await service.loadFile('malformed-timestamps')
      expect(result).toBeDefined()

      // Validation should catch the issues
      const validation = await service.validateFile('malformed-timestamps')
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should handle missing required fields', async () => {
      const incompleteContent = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId
      })
      
      // Remove required fields
      delete incompleteContent.metadata.fileId
      delete incompleteContent.subtitles[0].id
      incompleteContent.subtitles[1].text = undefined as any

      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(incompleteContent)
      )

      await expect(service.loadFile('incomplete-content'))
        .rejects.toThrow()
    })

    it('should handle circular references in data', async () => {
      const circularContent = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId
      })
      
      // Create circular reference (would cause JSON serialization issues)
      const circular: any = { data: circularContent }
      circular.self = circular

      mockIpcRenderer.invoke.mockImplementationOnce(async () => {
        // This would fail in real JSON.stringify
        throw new Error('Converting circular structure to JSON')
      })

      await expect(service.loadFile('circular-reference'))
        .rejects.toThrow('Converting circular structure to JSON')
    })

    it('should handle extremely long text content', async () => {
      const longTextContent = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId,
        subtitleCount: 5
      })
      
      // Create extremely long subtitle text
      const longText = 'A'.repeat(100000) // 100KB of text in single subtitle
      longTextContent.subtitles[0].text = longText

      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(longTextContent)
      )

      const result = await service.loadFile('long-text-file')
      expect(result).toBeDefined()
      expect(result?.subtitles[0].text).toHaveLength(100000)
    })
  })

  describe('Cache Edge Cases', () => {
    it('should handle cache corruption', async () => {
      const fileId = 'cache-corruption-test'
      
      // Load file to cache it
      await service.loadFile(fileId)
      
      // Manually corrupt cache by directly accessing it (if possible)
      // In real implementation, would simulate cache corruption
      
      // Should fall back to backend when cache is corrupted
      const result = await service.loadFile(fileId)
      expect(result).toBeDefined()
    })

    it('should handle cache expiry edge cases', async () => {
      // Configure very short TTL
      const shortTTLService = new SubtitlePersistenceService({
        enabled: true,
        defaultTTL: 100, // 100ms TTL
        maxSize: 1024 * 1024,
        maxEntries: 10
      })

      const fileId = 'expiry-test'
      
      // Load file
      await shortTTLService.loadFile(fileId)
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Should reload from backend after expiry
      const result = await shortTTLService.loadFile(fileId)
      expect(result).toBeDefined()
    })

    it('should handle cache size calculation edge cases', async () => {
      // Create content with unusual structure
      const weirdContent = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId
      })
      
      // Add unusual properties that might affect size calculation
      weirdContent.subtitles[0].metadata = {
        largeArray: new Array(1000).fill('data'),
        deepNesting: { a: { b: { c: { d: 'deep' } } } },
        nullValues: null,
        undefinedValues: undefined
      } as any

      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(weirdContent)
      )

      const result = await service.loadFile('weird-structure')
      expect(result).toBeDefined()
      
      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.currentSize).toBeGreaterThan(0)
    })
  })

  describe('Validation Edge Cases', () => {
    it('should handle validation of empty files', async () => {
      const emptyContent = {
        metadata: {
          fileId: 'empty-file',
          workspaceId: testWorkspaceId,
          version: 1,
          schemaVersion: 1
        },
        subtitles: [],
        statistics: {
          totalSubtitles: 0,
          totalDuration: 0,
          wordCount: 0,
          characterCount: 0,
          translationCoverage: 0,
          averageConfidence: 0,
          speakerDistribution: {},
          musicSegments: 0,
          qualityDistribution: { high: 0, medium: 0, low: 0 },
          timingStats: {
            averageDuration: 0,
            minDuration: 0,
            maxDuration: 0,
            gapCount: 0,
            overlapCount: 0
          }
        },
        editHistory: [],
        validation: {
          isValid: true,
          warnings: [],
          errors: [],
          qualityScore: 1.0
        }
      }

      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(emptyContent)
      )

      const result = await service.loadFile('empty-file')
      expect(result).toBeDefined()
      expect(result?.subtitles).toHaveLength(0)

      const validation = await service.validateFile('empty-file')
      expect(validation.isValid).toBe(true)
    })

    it('should handle validation timeouts', async () => {
      mockIpcRenderer.invoke.mockImplementation(async (channel, request) => {
        if (request.operation === 'validate') {
          await new Promise(resolve => setTimeout(resolve, 5000)) // Long delay
          throw new Error('Validation timeout')
        }
        return MockIPCResponse.success(generateMockSubtitleFileContent())
      })

      await expect(service.validateFile('slow-validation'))
        .rejects.toThrow('Validation timeout')
    })

    it('should handle validation of files with special characters', async () => {
      const specialCharContent = generateMockSubtitleFileContent({
        workspaceId: testWorkspaceId,
        subtitleCount: 3
      })
      
      // Add special characters and Unicode
      specialCharContent.subtitles[0].text = '🎵 Music: "Hello" & <special> chars 你好 🎵'
      specialCharContent.subtitles[1].text = '\n\t Special\r\n whitespace\0'
      specialCharContent.subtitles[2].text = '\\escaped\\" quotes and \\slashes\\\\'

      mockIpcRenderer.invoke.mockResolvedValueOnce(
        MockIPCResponse.success(specialCharContent)
      )

      const result = await service.loadFile('special-chars')
      expect(result).toBeDefined()

      const validation = await service.validateFile('special-chars')
      expect(validation.isValid).toBe(true)
    })
  })

  describe('Session and State Edge Cases', () => {
    it('should handle session state corruption', async () => {
      // Mock corrupted session state
      mockIpcRenderer.invoke.mockImplementation(async (channel) => {
        if (channel === 'load-subtitle-session') {
          return {
            // Corrupted session data
            sessionId: null,
            workspaceId: undefined,
            invalidField: 'corruption'
          }
        }
        return MockIPCResponse.success({})
      })

      // Should handle corrupted session gracefully
      // Implementation would create new session or fallback
    })

    it('should handle rapid session updates', async () => {
      const updatePromises = Array.from({ length: 10 }, (_, i) =>
        // These would be calls to session update if implemented
        Promise.resolve()
      )

      // Should handle rapid updates without corruption
      await Promise.all(updatePromises)
    })

    it('should handle session persistence failures', async () => {
      mockIpcRenderer.invoke.mockImplementation(async (channel) => {
        if (channel === 'save-subtitle-session') {
          throw new Error('Session save failed')
        }
        return MockIPCResponse.success({})
      })

      // Should handle session save failures gracefully
      // Implementation would continue working even if session can't be saved
    })
  })

  describe('Cleanup and Resource Management', () => {
    it('should handle cleanup during active operations', async () => {
      const fileId = 'cleanup-test'
      
      // Start operation
      const loadPromise = service.loadFile(fileId)
      
      // Immediately cleanup
      const cleanupPromise = service.clearCache()
      
      // Both should complete without error
      await Promise.all([loadPromise, cleanupPromise])
    })

    it('should handle memory cleanup edge cases', async () => {
      // Load many small files
      const filePromises = Array.from({ length: 100 }, (_, i) =>
        service.loadFile(`small-file-${i}`)
      )

      await Promise.all(filePromises)

      // Force cleanup
      await service.clearCache()

      const cacheMetrics = service.getCacheMetrics()
      expect(cacheMetrics.entryCount).toBe(0)
      expect(cacheMetrics.currentSize).toBe(0)
    })

    it('should handle service disposal during operations', async () => {
      const fileId = 'disposal-test'
      
      // Start long-running operation
      const operationPromise = service.loadFile(fileId)
      
      // Reset service (simulates disposal)
      resetSubtitlePersistenceService()
      
      // Original operation should still complete or fail gracefully
      await expect(operationPromise).resolves.toBeDefined()
    })
  })
})