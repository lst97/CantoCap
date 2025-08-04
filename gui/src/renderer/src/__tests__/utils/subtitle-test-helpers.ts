/**
 * Subtitle Persistence Test Helpers
 * 
 * Utility functions and mock data for testing subtitle persistence functionality.
 * Provides comprehensive test scenarios, performance validation, and error simulation.
 */

import { generateTestWorkspaceId } from '../../utils/id-generator'

import type {
  SubtitleFileContent,
  SubtitleFileMetadata,
  SubtitleValidationResult,
  SubtitleSessionData,
  SubtitlePerformanceMetrics,
  SubtitleFileError
} from '../../types/subtitle-persistence'
import type { SubtitleData } from '../../../../types'

/**
 * Generate mock subtitle data for testing
 */
export function generateMockSubtitleData(count: number = 10): SubtitleData[] {
  const subtitles: SubtitleData[] = []
  
  for (let i = 0; i < count; i++) {
    const startTime = i * 5000 // 5 seconds apart
    const endTime = startTime + 3000 // 3 second duration
    
    subtitles.push({
      id: `sub-${i}`,
      startTime,
      endTime,
      text: `Test subtitle ${i + 1}: This is sample text for testing purposes.`,
      translation: i % 3 === 0 ? `Translated text ${i + 1}` : undefined,
      confidence: 0.8 + (Math.random() * 0.2), // 0.8-1.0 confidence
      speaker: i % 4 === 0 ? `Speaker ${Math.floor(i / 4) + 1}` : undefined,
      isMusic: i % 10 === 9, // Every 10th subtitle is music
      metadata: {
        processingConfidence: 0.85 + (Math.random() * 0.15),
        editCount: Math.floor(Math.random() * 3),
        lastEdited: Date.now() - Math.random() * 1000000,
        quality: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low',
        tags: i % 5 === 0 ? ['important'] : []
      }
    })
  }
  
  return subtitles
}

/**
 * Generate mock subtitle file content
 */
export function generateMockSubtitleFileContent(options: {
  fileId?: string
  workspaceId?: string
  subtitleCount?: number
  fileType?: 'original' | 'modified'
  includeEditHistory?: boolean
} = {}): SubtitleFileContent {
  const {
    fileId = `test-file-${Date.now()}`,
    workspaceId = `test-workspace-${Date.now()}`,
    subtitleCount = 50,
    fileType = 'modified',
    includeEditHistory = true
  } = options

  const subtitles = generateMockSubtitleData(subtitleCount)
  
  const content: SubtitleFileContent = {
    metadata: {
      fileId,
      workspaceId,
      version: 1,
      schemaVersion: 1
    },
    subtitles,
    statistics: {
      totalSubtitles: subtitles.length,
      totalDuration: subtitles.reduce((sum, sub) => sum + (sub.endTime - sub.startTime), 0),
      wordCount: subtitles.reduce((sum, sub) => sum + (sub.text?.split(' ').length || 0), 0),
      characterCount: subtitles.reduce((sum, sub) => sum + (sub.text?.length || 0), 0),
      translationCoverage: (subtitles.filter(sub => sub.translation).length / subtitles.length) * 100,
      averageConfidence: subtitles.reduce((sum, sub) => sum + (sub.confidence || 0), 0) / subtitles.length,
      speakerDistribution: subtitles.reduce((acc, sub) => {
        if (sub.speaker) {
          acc[sub.speaker] = (acc[sub.speaker] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>),
      musicSegments: subtitles.filter(sub => sub.isMusic).length,
      qualityDistribution: {
        high: subtitles.filter(sub => (sub.confidence || 0) > 0.8).length,
        medium: subtitles.filter(sub => (sub.confidence || 0) >= 0.5 && (sub.confidence || 0) <= 0.8).length,
        low: subtitles.filter(sub => (sub.confidence || 0) < 0.5).length
      },
      timingStats: {
        averageDuration: subtitles.reduce((sum, sub) => sum + (sub.endTime - sub.startTime), 0) / subtitles.length,
        minDuration: Math.min(...subtitles.map(sub => sub.endTime - sub.startTime)),
        maxDuration: Math.max(...subtitles.map(sub => sub.endTime - sub.startTime)),
        gapCount: 0, // Would require gap analysis
        overlapCount: 0 // Would require overlap analysis
      }
    },
    editHistory: includeEditHistory ? [
      {
        id: `edit-${Date.now()}`,
        timestamp: Date.now() - 60000,
        operation: 'create',
        subtitleId: subtitles[0].id,
        changes: {
          text: { from: '', to: subtitles[0].text }
        },
        metadata: {
          source: 'manual',
          confidence: 1.0,
          processingTime: 0
        }
      }
    ] : [],
    validation: {
      isValid: true,
      warnings: [],
      errors: [],
      qualityScore: 0.85
    }
  }

  return content
}

/**
 * Generate mock subtitle file metadata
 */
export function generateMockSubtitleFileMetadata(options: {
  fileId?: string
  workspaceId?: string
  fileType?: 'original' | 'modified'
  fileSize?: number
  withBackup?: boolean
  withValidationErrors?: boolean
} = {}): SubtitleFileMetadata {
  const {
    fileId = `test-file-${Date.now()}`,
    workspaceId = `test-workspace-${Date.now()}`,
    fileType = 'modified',
    fileSize = 50000,
    withBackup = false,
    withValidationErrors = false
  } = options

  const now = Date.now()
  
  return {
    fileId,
    workspaceId,
    fileType,
    originalFilename: `test-${fileType}.json`,
    createdAt: now - 3600000, // 1 hour ago
    lastModified: now - 300000, // 5 minutes ago
    fileSize,
    checksum: `mock-checksum-${Date.now()}`,
    version: 1,
    schemaVersion: 1,
    compression: {
      algorithm: 'gzip',
      originalSize: fileSize,
      compressedSize: Math.floor(fileSize * 0.7),
      compressionRatio: 0.7
    },
    validation: {
      isValid: !withValidationErrors,
      lastValidated: now - 60000,
      validationErrors: withValidationErrors ? ['Test validation error'] : [],
      contentIntegrity: true,
      structureIntegrity: true
    },
    performance: {
      lastReadTime: 150,
      lastWriteTime: 200,
      averageReadTime: 175,
      averageWriteTime: 225,
      accessCount: 15
    },
    backup: withBackup ? {
      hasBackup: true,
      backupPath: `/backups/${fileId}.backup`,
      backupTimestamp: now - 1800000, // 30 minutes ago
      autoBackupEnabled: true
    } : undefined
  }
}

/**
 * Generate mock session data
 */
export function generateMockSessionData(options: {
  workspaceId?: string
  sessionType?: 'review' | 'edit' | 'validate'
  withStatistics?: boolean
} = {}): SubtitleSessionData {
  const {
    workspaceId = `test-workspace-${Date.now()}`,
    sessionType = 'review',
    withStatistics = true
  } = options

  const now = Date.now()
  
  return {
    sessionId: `session-${now}`,
    workspaceId,
    sessionType,
    createdAt: now - 1800000, // 30 minutes ago
    lastUpdated: now - 60000, // 1 minute ago
    state: {
      selectedSubtitleIds: ['sub-0', 'sub-1'],
      editMode: 'advanced',
      viewMode: 'grid',
      filters: {
        showOnlyUntranslated: false,
        showOnlyLowConfidence: true
      }
    },
    autoSave: {
      enabled: true,
      interval: 30000,
      pendingChanges: false
    },
    preferences: {
      showConfidenceScores: true,
      showTimestamps: true,
      showSpeakers: true,
      highlightLowConfidence: true,
      enableSpellCheck: false,
      fontSize: 14
    },
    statistics: withStatistics ? {
      editsCount: 25,
      timeSpent: 1800000, // 30 minutes
      subtitlesReviewed: 45,
      issuesResolved: 12
    } : {
      editsCount: 0,
      timeSpent: 0,
      subtitlesReviewed: 0,
      issuesResolved: 0
    }
  }
}

/**
 * Generate mock performance metrics
 */
export function generateMockPerformanceMetrics(count: number = 10): SubtitlePerformanceMetrics[] {
  const metrics: SubtitlePerformanceMetrics[] = []
  const operations: Array<SubtitlePerformanceMetrics['operationType']> = ['read', 'write', 'validate', 'compress']
  
  for (let i = 0; i < count; i++) {
    const fileSize = 10000 + Math.random() * 40000
    const duration = 100 + Math.random() * 300
    
    metrics.push({
      id: `metric-${Date.now()}-${i}`,
      workspaceId: `test-workspace-${Math.floor(i / 3)}`,
      operationType: operations[i % operations.length],
      fileSize,
      duration,
      throughput: fileSize / duration * 1000,
      cacheHit: Math.random() > 0.3, // 70% cache hit rate
      timestamp: Date.now() - (i * 60000), // 1 minute intervals
      success: Math.random() > 0.1, // 90% success rate
      error: Math.random() > 0.9 ? 'Mock error message' : undefined,
      memoryUsage: Math.floor(Math.random() * 50000000) // Up to 50MB
    })
  }
  
  return metrics
}

/**
 * Generate mock validation result
 */
export function generateMockValidationResult(isValid: boolean = true): SubtitleValidationResult {
  return {
    isValid,
    errors: isValid ? [] : [
      {
        code: 'TIMING_OVERLAP',
        message: 'Subtitle timing overlap detected',
        severity: 'error',
        subtitleId: 'sub-5',
        context: {
          startTime: 10000,
          endTime: 15000,
          conflictingId: 'sub-6'
        }
      }
    ],
    warnings: [
      {
        code: 'LOW_CONFIDENCE',
        message: 'Low confidence subtitle detected',
        severity: 'warning',
        subtitleId: 'sub-10',
        context: {
          confidence: 0.45,
          threshold: 0.5
        }
      }
    ],
    statistics: {
      totalSubtitles: 50,
      validSubtitles: isValid ? 50 : 49,
      errorCount: isValid ? 0 : 1,
      warningCount: 1,
      qualityScore: isValid ? 0.95 : 0.85
    },
    performance: {
      validationTime: 250,
      throughput: 200
    },
    metadata: {
      validatedAt: Date.now(),
      validatorVersion: '1.0.0',
      checksum: `validation-${Date.now()}`
    }
  }
}

/**
 * Create mock IPC responses
 */
export class MockIPCResponse {
  static success<T>(data: T, performance?: any): any {
    return {
      success: true,
      data,
      performance: performance || {
        bytesProcessed: JSON.stringify(data).length,
        processingTime: 150,
        cacheHit: false
      },
      metadata: {
        timestamp: Date.now(),
        operationId: `op-${Date.now()}`
      }
    }
  }

  static error(code: string, message: string): any {
    const error = new Error(message) as SubtitleFileError
    error.code = code as any
    
    return {
      success: false,
      error,
      performance: {
        bytesProcessed: 0,
        processingTime: 50,
        cacheHit: false
      }
    }
  }

  static withMetadata<T>(data: T, metadata: SubtitleFileMetadata): any {
    return {
      success: true,
      data,
      metadata,
      performance: {
        bytesProcessed: JSON.stringify(data).length,
        processingTime: 200,
        cacheHit: false
      }
    }
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure operation performance
   */
  static async measureOperation<T>(
    operation: () => Promise<T>,
    expectedMaxDuration: number
  ): Promise<{ result: T; duration: number; passed: boolean }> {
    const startTime = performance.now()
    const result = await operation()
    const duration = performance.now() - startTime
    
    return {
      result,
      duration,
      passed: duration <= expectedMaxDuration
    }
  }

  /**
   * Generate large subtitle data for performance testing
   */
  static generateLargeSubtitleData(targetSizeKB: number): SubtitleFileContent {
    // Estimate subtitles needed for target size
    const avgSubtitleSize = 150 // bytes
    const subtitleCount = Math.floor((targetSizeKB * 1024) / avgSubtitleSize)
    
    return generateMockSubtitleFileContent({
      subtitleCount,
      includeEditHistory: false
    })
  }

  /**
   * Simulate memory usage tracking
   */
  static async trackMemoryUsage<T>(
    operation: () => Promise<T>,
    maxMemoryMB: number
  ): Promise<{ result: T; memoryUsed: number; passed: boolean }> {
    // Mock memory tracking (in real implementation, would use performance.memory)
    const initialMemory = Math.random() * 20000000 // 0-20MB
    const result = await operation()
    const finalMemory = initialMemory + Math.random() * 10000000 // Additional 0-10MB
    const memoryUsed = finalMemory - initialMemory
    
    return {
      result,
      memoryUsed,
      passed: memoryUsed <= maxMemoryMB * 1024 * 1024
    }
  }

  /**
   * Test concurrent operations
   */
  static async testConcurrentOperations<T>(
    operations: Array<() => Promise<T>>,
    maxConcurrency: number = 3
  ): Promise<Array<{ success: boolean; result?: T; error?: Error; duration: number }>> {
    const results: Array<{ success: boolean; result?: T; error?: Error; duration: number }> = []
    
    // Process operations in batches
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency)
      
      const batchResults = await Promise.allSettled(
        batch.map(async op => {
          const startTime = performance.now()
          try {
            const result = await op()
            return {
              success: true,
              result,
              duration: performance.now() - startTime
            }
          } catch (error) {
            return {
              success: false,
              error: error as Error,
              duration: performance.now() - startTime
            }
          }
        })
      )
      
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : {
        success: false,
        error: r.reason,
        duration: 0
      }))
    }
    
    return results
  }
}

/**
 * Error simulation utilities
 */
export class ErrorSimulator {
  /**
   * Simulate network errors
   */
  static networkError(): SubtitleFileError {
    const error = new Error('Network connection failed') as SubtitleFileError
    error.code = 'SUBTITLE_OPERATION_TIMEOUT'
    return error
  }

  /**
   * Simulate file corruption
   */
  static corruptionError(fileId: string): SubtitleFileError {
    const error = new Error(`File ${fileId} is corrupted`) as SubtitleFileError
    error.code = 'SUBTITLE_FILE_CORRUPTED'
    return error
  }

  /**
   * Simulate disk space error
   */
  static diskSpaceError(): SubtitleFileError {
    const error = new Error('Insufficient disk space') as SubtitleFileError
    error.code = 'SUBTITLE_FILE_ACCESS_DENIED'
    return error
  }

  /**
   * Simulate validation error
   */
  static validationError(issues: string[]): SubtitleFileError {
    const error = new Error(`Validation failed: ${issues.join(', ')}`) as SubtitleFileError
    error.code = 'SUBTITLE_VALIDATION_FAILED'
    return error
  }

  /**
   * Simulate permission error
   */
  static permissionError(operation: string): SubtitleFileError {
    const error = new Error(`Permission denied for ${operation}`) as SubtitleFileError
    error.code = 'SUBTITLE_FILE_ACCESS_DENIED'
    return error
  }
}

/**
 * Test workspace utilities
 */
export class TestWorkspaceUtils {
  /**
   * Create isolated test workspace
   */
  static createTestWorkspace(id?: string): string {
    return id || generateTestWorkspaceId()
  }

  /**
   * Create test file structure
   */
  static createTestFileStructure(workspaceId: string): {
    originalFile: SubtitleFileContent
    modifiedFile: SubtitleFileContent
    backupFile: SubtitleFileContent
  } {
    const baseContent = generateMockSubtitleFileContent({
      workspaceId,
      subtitleCount: 30
    })

    return {
      originalFile: {
        ...baseContent,
        metadata: { ...baseContent.metadata, fileId: `${workspaceId}-original` }
      },
      modifiedFile: {
        ...baseContent,
        metadata: { ...baseContent.metadata, fileId: `${workspaceId}-modified` },
        subtitles: baseContent.subtitles.map((sub, index) => ({
          ...sub,
          text: index < 5 ? `Modified: ${sub.text}` : sub.text
        }))
      },
      backupFile: {
        ...baseContent,
        metadata: { ...baseContent.metadata, fileId: `${workspaceId}-backup` }
      }
    }
  }

  /**
   * Cleanup test workspace
   */
  static async cleanupTestWorkspace(workspaceId: string): Promise<void> {
    // Mock cleanup - in real implementation would clean up files and database entries
    console.log(`Cleaning up test workspace: ${workspaceId}`)
  }
}

/**
 * Cache test utilities
 */
export class CacheTestUtils {
  /**
   * Generate cache performance scenarios
   */
  static generateCacheScenarios() {
    return {
      coldCache: { hitRate: 0, accessTime: 200 },
      warmCache: { hitRate: 0.7, accessTime: 50 },
      hotCache: { hitRate: 0.95, accessTime: 10 },
      evictingCache: { hitRate: 0.6, accessTime: 75 }
    }
  }

  /**
   * Simulate cache behavior
   */
  static simulateCacheMetrics(scenario: keyof ReturnType<typeof CacheTestUtils.generateCacheScenarios>) {
    const scenarios = this.generateCacheScenarios()
    const selected = scenarios[scenario]
    
    return {
      hitCount: 100,
      missCount: Math.floor(100 * (1 - selected.hitRate) / selected.hitRate),
      hitRate: selected.hitRate,
      evictionCount: scenario === 'evictingCache' ? 15 : 5,
      currentSize: Math.floor(Math.random() * 10000000), // 0-10MB
      entryCount: 25 + Math.floor(Math.random() * 25), // 25-50 entries
      averageAccessTime: selected.accessTime,
      efficiencyScore: selected.hitRate * 0.8 + 0.2,
      compressionMetrics: {
        compressedEntries: 15,
        compressionRatio: 0.7,
        spaceSaved: 2000000, // 2MB
        compressionEffectiveness: 0.3
      },
      memoryUsage: {
        metadata: 7500, // 30 entries * 250 bytes
        content: Math.floor(Math.random() * 5000000), // 0-5MB
        overhead: 4500, // 30 entries * 150 bytes
        total: Math.floor(Math.random() * 5000000) + 12000
      },
      predictiveMetrics: {
        patternsTracked: 45,
        averageFrequency: 2.3,
        cacheWarmingOpportunities: ['file-1', 'file-2', 'file-3']
      }
    }
  }
}