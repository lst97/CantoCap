import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { WorkspaceMigrationService } from '../workspace-migration'
import { IndexedDBService } from '../indexeddb-service'
import { AppConfig, WorkspaceConfig } from '../../types/workflow'

interface MigrationTestResult {
  success: boolean
  duration: number
  dataIntegrity: number
  error?: string
  preservedData?: any
}

interface MigrationTestCase {
  name: string
  data: any
  expectedSuccess: boolean
  maxDuration: number
  complexity: 'simple' | 'complex' | 'corrupted' | 'edge'
}

class MigrationSuccessTracker {
  private attempts: number = 0
  private successes: number = 0
  private failures: Array<{ case: string, error: string }> = []

  recordAttempt(caseName: string) {
    this.attempts++
  }

  recordSuccess() {
    this.successes++
  }

  recordFailure(caseName: string, error: string) {
    this.failures.push({ case: caseName, error })
  }

  getSuccessRate(): number {
    return this.attempts > 0 ? (this.successes / this.attempts) * 100 : 0
  }

  meetsTarget(): boolean {
    return this.getSuccessRate() >= 99.5
  }

  getFailureDetails() {
    return this.failures
  }

  getStats() {
    return {
      attempts: this.attempts,
      successes: this.successes,
      failures: this.failures.length,
      successRate: this.getSuccessRate(),
      meetsTarget: this.meetsTarget()
    }
  }
}

class MigrationTestDataFactory {
  static createSimpleConfig(): AppConfig {
    return {
      language: 'en',
      model: 'small',
      priority: 'balanced',
      numSpeakers: 'auto',
      outputFormat: 'srt',
      batchSize: 25,
      useGPU: false,
      deviceId: 'cpu',
      computeType: 'int8',
      vadFilter: true,
      vadThreshold: 0.6,
      logProb: -1.0,
      noSpeechThreshold: 0.6,
      compressionRatio: 2.4,
      temperature: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
      bestOf: 5,
      patience: 1.0,
      lengthPenalty: 1.0,
      repetitionPenalty: 1.0,
      noRepeatNgramSize: 0,
      maxNewTokens: null,
      promptLookupNumTokens: null,
      hallucination_silence_threshold: null,
      hotwords: null,
      language_detection_threshold: null,
      language_detection_segments: null
    }
  }

  static createComplexConfig(): AppConfig {
    return {
      ...this.createSimpleConfig(),
      language: 'zh',
      model: 'large-v3',
      priority: 'quality',
      numSpeakers: '3',
      useGPU: true,
      deviceId: 'cuda:0',
      computeType: 'float16',
      temperature: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      hotwords: 'technical terms, API, database, authentication',
      hallucination_silence_threshold: 2.0,
      language_detection_threshold: 0.5,
      language_detection_segments: 3
    }
  }

  static createWorkspaceConfigs(count: number = 5): WorkspaceConfig[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `workspace-${i + 1}`,
      name: `Test Workspace ${i + 1}`,
      description: `Test workspace for migration testing ${i + 1}`,
      appConfig: i % 2 === 0 ? this.createSimpleConfig() : this.createComplexConfig(),
      workflowStep: i < 2 ? 'input' : i < 4 ? 'config' : 'processing',
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - i * 60 * 60 * 1000),
      isActive: i === 0
    }))
  }

  static createCorruptedConfig(): any {
    return {
      language: 'invalid-lang',
      model: null,
      priority: 'invalid-priority',
      temperature: 'not-an-array',
      useGPU: 'not-boolean',
      extraField: 'should-be-ignored',
      nestedCorruption: {
        validField: 'valid',
        corruptedField: undefined
      }
    }
  }

  static createEdgeCaseConfig(): AppConfig {
    return {
      ...this.createComplexConfig(),
      hotwords: 'a'.repeat(1000), // Very long hotwords
      temperature: Array.from({ length: 50 }, (_, i) => i / 50), // Many temperature values
      language_detection_segments: 100 // High segment count
    }
  }
}

describe('Migration System Validation', () => {
  let migrationService: WorkspaceMigrationService
  let indexedDBService: IndexedDBService
  let successTracker: MigrationSuccessTracker

  beforeEach(async () => {
    migrationService = new WorkspaceMigrationService()
    indexedDBService = new IndexedDBService()
    successTracker = new MigrationSuccessTracker()
    
    // Clear any existing data
    await indexedDBService.clear()
  })

  afterEach(async () => {
    await indexedDBService.clear()
  })

  const migrationTestCases: MigrationTestCase[] = [
    {
      name: 'Simple Configuration Migration',
      data: MigrationTestDataFactory.createSimpleConfig(),
      expectedSuccess: true,
      maxDuration: 5000,
      complexity: 'simple'
    },
    {
      name: 'Complex Configuration with All Features',
      data: MigrationTestDataFactory.createComplexConfig(),
      expectedSuccess: true,
      maxDuration: 15000,
      complexity: 'complex'
    },
    {
      name: 'Multiple Workspaces Migration',
      data: MigrationTestDataFactory.createWorkspaceConfigs(10),
      expectedSuccess: true,
      maxDuration: 20000,
      complexity: 'complex'
    },
    {
      name: 'Corrupted Data Recovery',
      data: MigrationTestDataFactory.createCorruptedConfig(),
      expectedSuccess: true, // Should recover gracefully
      maxDuration: 10000,
      complexity: 'corrupted'
    },
    {
      name: 'Edge Case Configuration',
      data: MigrationTestDataFactory.createEdgeCaseConfig(),
      expectedSuccess: true,
      maxDuration: 25000,
      complexity: 'edge'
    }
  ]

  // Generate additional test cases for statistical validation
  const generateStressTestCases = (count: number): MigrationTestCase[] => {
    return Array.from({ length: count }, (_, i) => ({
      name: `Stress Test Case ${i + 1}`,
      data: i % 4 === 0 ? MigrationTestDataFactory.createSimpleConfig() :
            i % 4 === 1 ? MigrationTestDataFactory.createComplexConfig() :
            i % 4 === 2 ? MigrationTestDataFactory.createWorkspaceConfigs(3) :
            MigrationTestDataFactory.createEdgeCaseConfig(),
      expectedSuccess: true,
      maxDuration: 15000,
      complexity: i % 2 === 0 ? 'simple' : 'complex'
    }))
  }

  const allTestCases = [...migrationTestCases, ...generateStressTestCases(95)] // Total 100 test cases

  async function runMigrationTest(testCase: MigrationTestCase): Promise<MigrationTestResult> {
    const startTime = performance.now()
    
    try {
      successTracker.recordAttempt(testCase.name)
      
      // Store original data for integrity validation
      const originalData = JSON.parse(JSON.stringify(testCase.data))
      
      let result: any
      if (Array.isArray(testCase.data)) {
        // Multiple workspaces
        result = await Promise.all(
          testCase.data.map(workspace => migrationService.migrateWorkspace(workspace))
        )
      } else {
        // Single configuration
        result = await migrationService.migrateAppConfig(testCase.data)
      }
      
      const duration = performance.now() - startTime
      
      // Validate data integrity
      const dataIntegrity = calculateDataIntegrity(originalData, result)
      
      if (dataIntegrity >= 95) { // 95% minimum integrity for success
        successTracker.recordSuccess()
        return {
          success: true,
          duration,
          dataIntegrity,
          preservedData: result
        }
      } else {
        throw new Error(`Data integrity too low: ${dataIntegrity}%`)
      }
      
    } catch (error) {
      const duration = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      successTracker.recordFailure(testCase.name, errorMessage)
      
      return {
        success: false,
        duration,
        dataIntegrity: 0,
        error: errorMessage
      }
    }
  }

  function calculateDataIntegrity(original: any, migrated: any): number {
    if (!migrated) return 0
    
    let totalFields = 0
    let preservedFields = 0
    
    function compareObjects(orig: any, migr: any) {
      if (Array.isArray(orig) && Array.isArray(migr)) {
        totalFields++
        if (orig.length === migr.length) preservedFields++
        return
      }
      
      if (typeof orig === 'object' && orig !== null) {
        Object.keys(orig).forEach(key => {
          totalFields++
          if (key in migr && typeof orig[key] === typeof migr[key]) {
            preservedFields++
            if (typeof orig[key] === 'object') {
              compareObjects(orig[key], migr[key])
            }
          }
        })
      }
    }
    
    compareObjects(original, migrated)
    return totalFields > 0 ? (preservedFields / totalFields) * 100 : 0
  }

  describe('Core Migration Tests', () => {
    migrationTestCases.forEach(testCase => {
      it(`should handle ${testCase.name}`, async () => {
        const result = await runMigrationTest(testCase)
        
        expect(result.success).toBe(testCase.expectedSuccess)
        expect(result.duration).toBeLessThan(testCase.maxDuration)
        
        if (testCase.expectedSuccess) {
          expect(result.dataIntegrity).toBeGreaterThanOrEqual(95)
        }
      }, testCase.maxDuration + 5000) // Add buffer for test timeout
    })
  })

  describe('Statistical Validation - 99.5% Success Rate', () => {
    it('should achieve 99.5% success rate across 100 test cases', async () => {
      const results: MigrationTestResult[] = []
      
      // Run all test cases
      for (const testCase of allTestCases) {
        const result = await runMigrationTest(testCase)
        results.push(result)
      }
      
      const stats = successTracker.getStats()
      
      console.log('Migration Test Statistics:')
      console.log(`Total Attempts: ${stats.attempts}`)
      console.log(`Successes: ${stats.successes}`)
      console.log(`Failures: ${stats.failures}`)
      console.log(`Success Rate: ${stats.successRate.toFixed(2)}%`)
      console.log(`Meets Target (99.5%): ${stats.meetsTarget}`)
      
      if (stats.failures > 0) {
        console.log('Failure Details:', stats.failures)
        successTracker.getFailureDetails().forEach(failure => {
          console.log(`  - ${failure.case}: ${failure.error}`)
        })
      }
      
      // Performance statistics
      const successfulResults = results.filter(r => r.success)
      const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length
      const maxDuration = Math.max(...successfulResults.map(r => r.duration))
      const avgIntegrity = successfulResults.reduce((sum, r) => sum + r.dataIntegrity, 0) / successfulResults.length
      
      console.log('Performance Statistics:')
      console.log(`Average Duration: ${avgDuration.toFixed(2)}ms`)
      console.log(`Maximum Duration: ${maxDuration.toFixed(2)}ms`)
      console.log(`Average Data Integrity: ${avgIntegrity.toFixed(2)}%`)
      
      // Validate success rate meets target
      expect(stats.successRate).toBeGreaterThanOrEqual(99.5)
      expect(stats.meetsTarget).toBe(true)
      
      // Validate performance targets
      expect(avgDuration).toBeLessThan(10000) // Average under 10 seconds
      expect(maxDuration).toBeLessThan(30000) // Max under 30 seconds
      expect(avgIntegrity).toBeGreaterThanOrEqual(99) // High data integrity
      
    }, 300000) // 5 minute timeout for full test suite
  })

  describe('Error Recovery Validation', () => {
    it('should recover from IndexedDB quota exceeded', async () => {
      // Simulate quota exceeded error
      const originalSet = indexedDBService.set
      indexedDBService.set = jest.fn().mockRejectedValue(new Error('QuotaExceededError'))
      
      const testCase = migrationTestCases[0]
      const result = await runMigrationTest(testCase)
      
      // Should fail gracefully and attempt recovery
      expect(result.success || result.error?.includes('fallback')).toBe(true)
      
      // Restore original method
      indexedDBService.set = originalSet
    })

    it('should handle corrupted data gracefully', async () => {
      const corruptedCase = migrationTestCases.find(tc => tc.complexity === 'corrupted')!
      const result = await runMigrationTest(corruptedCase)
      
      // Should either succeed with cleaned data or fail gracefully
      expect(result.success || result.error?.includes('validation')).toBe(true)
      
      if (result.success) {
        expect(result.dataIntegrity).toBeGreaterThan(50) // Some data should be recoverable
      }
    })
  })
})