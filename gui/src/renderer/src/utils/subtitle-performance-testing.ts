/**
 * Subtitle Performance Testing Utilities
 * 
 * Comprehensive testing utilities for validating performance optimization results
 * and benchmarking the subtitle auto-save system.
 */

import type { SubtitleData } from '../../../types'
import type {
  SubtitleTempContent,
  SubtitleTempStorageRecord,
  SubtitleTempError,
  SubtitleTempOperationResponse
} from '../types/subtitle-temp-storage'
import { optimizedSubtitleTempStorageService } from '../services/subtitle/subtitle-temp-storage-optimized'
import { performanceManager } from '../services/subtitle/subtitle-temp-storage-performance'

// ============================================================================
// PERFORMANCE TEST CONFIGURATION
// ============================================================================

export interface PerformanceTestConfig {
  /** Number of test iterations */
  iterations: number
  /** Test data size variations */
  dataSizes: number[]
  /** Concurrent operation levels */
  concurrencyLevels: number[]
  /** Enable memory profiling */
  memoryProfiling: boolean
  /** Enable detailed logging */
  detailedLogging: boolean
  /** Test timeout in milliseconds */
  timeout: number
  /** Warmup iterations */
  warmupIterations: number
}

export interface PerformanceTestResult {
  testName: string
  config: PerformanceTestConfig
  results: {
    latency: LatencyMetrics
    throughput: ThroughputMetrics
    memory: MemoryMetrics
    errors: ErrorMetrics
    scalability: ScalabilityMetrics
  }
  recommendations: string[]
  timestamp: number
}

interface LatencyMetrics {
  average: number
  median: number
  p95: number
  p99: number
  min: number
  max: number
  standardDeviation: number
}

interface ThroughputMetrics {
  operationsPerSecond: number
  dataTransferRate: number // MB/s
  peakThroughput: number
  sustainedThroughput: number
}

interface MemoryMetrics {
  peakUsage: number
  averageUsage: number
  memoryLeaks: boolean
  gcPressure: number
  objectPoolEfficiency: number
}

interface ErrorMetrics {
  errorRate: number
  errorTypes: Record<string, number>
  recoveryTime: number
  criticalErrors: number
}

interface ScalabilityMetrics {
  linearScaling: boolean
  scalingFactor: number
  bottleneckPoints: number[]
  resourceUtilization: number
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

export class SubtitleTestDataGenerator {
  /**
   * Generate test subtitle data with specified characteristics
   */
  static generateSubtitles(
    count: number,
    options: {
      avgTextLength?: number
      confidenceRange?: [number, number]
      timingVariation?: number
      includeTranslations?: boolean
      corruptionRate?: number
    } = {}
  ): SubtitleData[] {
    const {
      avgTextLength = 50,
      confidenceRange = [0.7, 0.95],
      timingVariation = 1000,
      includeTranslations = true,
      corruptionRate = 0
    } = options

    const subtitles: SubtitleData[] = []
    let currentTime = 0

    for (let i = 0; i < count; i++) {
      const duration = 2000 + Math.random() * timingVariation
      const textLength = Math.max(10, avgTextLength + (Math.random() - 0.5) * 20)
      const confidence = confidenceRange[0] + Math.random() * (confidenceRange[1] - confidenceRange[0])

      // Generate text content
      const text = this.generateRandomText(textLength)
      const translation = includeTranslations ? this.generateRandomText(textLength * 0.8) : undefined

      // Apply corruption if specified
      const isCorrupted = Math.random() < corruptionRate

      subtitles.push({
        id: i + 1,
        startTime: currentTime,
        endTime: currentTime + duration,
        text: isCorrupted ? '' : text,
        translation: isCorrupted ? undefined : translation,
        confidence: isCorrupted ? 0.1 : confidence,
        speaker: `Speaker ${Math.floor(i / 10) + 1}`,
        metadata: {
          processingTime: Math.random() * 100,
          source: 'test-generator'
        }
      })

      currentTime += duration + Math.random() * 500 // Small gap between subtitles
    }

    return subtitles
  }

  /**
   * Generate realistic subtitle content structure
   */
  static generateSubtitleContent(
    workspaceId: string,
    sessionId: string,
    subtitleCount: number,
    options: {
      complexity?: 'simple' | 'medium' | 'complex'
      errorRate?: number
    } = {}
  ): SubtitleTempContent {
    const { complexity = 'medium', errorRate = 0 } = options
    
    const subtitles = this.generateSubtitles(subtitleCount, {
      avgTextLength: complexity === 'simple' ? 30 : complexity === 'medium' ? 50 : 80,
      confidenceRange: complexity === 'simple' ? [0.8, 0.95] : [0.6, 0.9],
      includeTranslations: complexity !== 'simple',
      corruptionRate: errorRate
    })

    return {
      metadata: {
        id: `test-content-${Date.now()}`,
        workspaceId,
        sessionId,
        version: 1,
        schemaVersion: 1
      },
      subtitles,
      statistics: {
        totalCount: subtitles.length,
        modifiedCount: Math.floor(subtitles.length * 0.3),
        totalDuration: subtitles.reduce((sum, s) => sum + (s.endTime - s.startTime), 0),
        contentCoverage: 0.9,
        averageConfidence: 0.85
      },
      editingContext: {
        selectedIds: [],
        filters: {
          showOnlyModified: false,
          showOnlyUntranslated: false,
          showOnlyLowConfidence: false
        },
        viewState: {
          scrollPosition: 0,
          zoomLevel: 1,
          displayMode: 'list',
          showConfidence: true,
          showTimings: true
        }
      },
      changeTracking: {
        changeCount: 0,
        lastUserAction: Date.now(),
        modifiedIds: new Set(),
        changeSeverity: 'minor'
      },
      validation: {
        isValid: true,
        lastValidated: Date.now(),
        warnings: [],
        errors: [],
        integrityScore: 1.0
      }
    }
  }

  private static generateRandomText(length: number): string {
    const words = [
      'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'and', 'runs',
      'through', 'forest', 'with', 'great', 'speed', 'while', 'birds', 'sing', 'in',
      'trees', 'above', 'small', 'animals', 'watch', 'from', 'their', 'hiding', 'places'
    ]
    
    let text = ''
    while (text.length < length) {
      const word = words[Math.floor(Math.random() * words.length)]
      text += (text.length > 0 ? ' ' : '') + word
    }
    
    return text.substring(0, length)
  }
}

// ============================================================================
// PERFORMANCE BENCHMARKS
// ============================================================================

export class SubtitlePerformanceBenchmark {
  private config: PerformanceTestConfig
  private results: PerformanceTestResult[] = []

  constructor(config: Partial<PerformanceTestConfig> = {}) {
    this.config = {
      iterations: 100,
      dataSizes: [10, 100, 1000, 5000],
      concurrencyLevels: [1, 5, 10, 20],
      memoryProfiling: true,
      detailedLogging: false,
      timeout: 30000,
      warmupIterations: 10,
      ...config
    }
  }

  /**
   * Run comprehensive performance benchmark suite
   */
  async runBenchmarkSuite(): Promise<PerformanceTestResult[]> {
    console.log('Starting performance benchmark suite...')
    
    try {
      // Warmup
      await this.warmup()

      // Core performance tests
      await this.benchmarkSaveOperations()
      await this.benchmarkLoadOperations()
      await this.benchmarkBatchOperations()
      await this.benchmarkConcurrentOperations()
      await this.benchmarkMemoryUsage()
      await this.benchmarkScalability()

      // Generate summary report
      this.generateSummaryReport()

      return this.results
    } catch (error) {
      console.error('Benchmark suite failed:', error)
      throw error
    }
  }

  /**
   * Warmup the system before running benchmarks
   */
  private async warmup(): Promise<void> {
    console.log('Warming up system...')
    
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const testData = SubtitleTestDataGenerator.generateSubtitleContent(
        'warmup-workspace',
        'warmup-session',
        100
      )
      
      await optimizedSubtitleTempStorageService.saveSubtitleContent(
        'warmup-workspace',
        'warmup-session',
        testData.subtitles
      )
    }
  }

  /**
   * Benchmark save operations with various data sizes
   */
  private async benchmarkSaveOperations(): Promise<void> {
    console.log('Benchmarking save operations...')
    
    const latencies: number[] = []
    const throughputs: number[] = []
    const memoryUsages: number[] = []
    const errors: SubtitleTempError[] = []

    for (const dataSize of this.config.dataSizes) {
      for (let i = 0; i < this.config.iterations; i++) {
        const testData = SubtitleTestDataGenerator.generateSubtitleContent(
          `test-workspace-${i}`,
          `test-session-${i}`,
          dataSize
        )

        const startTime = performance.now()
        const startMemory = this.getCurrentMemoryUsage()

        try {
          const result = await optimizedSubtitleTempStorageService.saveSubtitleContent(
            `test-workspace-${i}`,
            `test-session-${i}`,
            testData.subtitles
          )

          const duration = performance.now() - startTime
          const endMemory = this.getCurrentMemoryUsage()

          if (result.success) {
            latencies.push(duration)
            throughputs.push((testData.subtitles.length / duration) * 1000) // ops/sec
            memoryUsages.push(endMemory - startMemory)
          } else if (result.error) {
            errors.push(result.error)
          }
        } catch (error) {
          errors.push({
            code: 'VALIDATION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
            severity: 'high'
          })
        }
      }
    }

    this.results.push({
      testName: 'Save Operations',
      config: this.config,
      results: {
        latency: this.calculateLatencyMetrics(latencies),
        throughput: this.calculateThroughputMetrics(throughputs),
        memory: this.calculateMemoryMetrics(memoryUsages),
        errors: this.calculateErrorMetrics(errors),
        scalability: this.calculateScalabilityMetrics(latencies, this.config.dataSizes)
      },
      recommendations: this.generateRecommendations('save', latencies, errors),
      timestamp: Date.now()
    })
  }

  /**
   * Benchmark load operations
   */
  private async benchmarkLoadOperations(): Promise<void> {
    console.log('Benchmarking load operations...')
    
    // Pre-populate data for loading
    const storageIds: string[] = []
    for (let i = 0; i < this.config.iterations; i++) {
      const testData = SubtitleTestDataGenerator.generateSubtitleContent(
        `load-test-workspace-${i}`,
        `load-test-session-${i}`,
        1000
      )

      const result = await optimizedSubtitleTempStorageService.saveSubtitleContent(
        `load-test-workspace-${i}`,
        `load-test-session-${i}`,
        testData.subtitles
      )

      if (result.success) {
        storageIds.push(result.data.storageId)
      }
    }

    // Benchmark loading
    const latencies: number[] = []
    const throughputs: number[] = []
    const errors: SubtitleTempError[] = []

    for (const storageId of storageIds) {
      const startTime = performance.now()

      try {
        const result = await optimizedSubtitleTempStorageService.loadSubtitleContent(storageId)
        const duration = performance.now() - startTime

        if (result.success) {
          latencies.push(duration)
          throughputs.push((result.data.subtitles.length / duration) * 1000) // ops/sec
        } else if (result.error) {
          errors.push(result.error)
        }
      } catch (error) {
        errors.push({
          code: 'VALIDATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          severity: 'high'
        })
      }
    }

    this.results.push({
      testName: 'Load Operations',
      config: this.config,
      results: {
        latency: this.calculateLatencyMetrics(latencies),
        throughput: this.calculateThroughputMetrics(throughputs),
        memory: { peakUsage: 0, averageUsage: 0, memoryLeaks: false, gcPressure: 0, objectPoolEfficiency: 0 },
        errors: this.calculateErrorMetrics(errors),
        scalability: this.calculateScalabilityMetrics(latencies, [storageIds.length])
      },
      recommendations: this.generateRecommendations('load', latencies, errors),
      timestamp: Date.now()
    })
  }

  /**
   * Benchmark batch operations
   */
  private async benchmarkBatchOperations(): Promise<void> {
    console.log('Benchmarking batch operations...')
    
    const batchSizes = [5, 10, 25, 50]
    const latencies: number[] = []
    const throughputs: number[] = []
    const errors: SubtitleTempError[] = []

    for (const batchSize of batchSizes) {
      for (let i = 0; i < Math.floor(this.config.iterations / 10); i++) {
        // Create batch operation data
        const operations = []
        for (let j = 0; j < batchSize; j++) {
          const testData = SubtitleTestDataGenerator.generateSubtitleContent(
            `batch-workspace-${i}-${j}`,
            `batch-session-${i}-${j}`,
            100
          )
          operations.push({
            operationId: `batch-op-${i}-${j}`,
            type: 'save' as const,
            workspaceId: `batch-workspace-${i}-${j}`,
            sessionId: `batch-session-${i}-${j}`,
            parameters: {
              subtitles: testData.subtitles,
              storageType: 'auto_save' as const
            }
          })
        }

        const batchOperation = {
          batchId: `batch-${i}`,
          operations,
          executionMode: 'parallel' as const,
          transactional: false
        }

        const startTime = performance.now()

        try {
          const result = await optimizedSubtitleTempStorageService.executeBatchOperationOptimized(batchOperation)
          const duration = performance.now() - startTime

          if (result.success) {
            latencies.push(duration)
            throughputs.push((batchSize / duration) * 1000) // ops/sec
          }

          // Collect errors from batch results
          result.responses.forEach(response => {
            if (!response.success && response.error) {
              errors.push(response.error)
            }
          })
        } catch (error) {
          errors.push({
            code: 'VALIDATION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
            severity: 'high'
          })
        }
      }
    }

    this.results.push({
      testName: 'Batch Operations',
      config: this.config,
      results: {
        latency: this.calculateLatencyMetrics(latencies),
        throughput: this.calculateThroughputMetrics(throughputs),
        memory: { peakUsage: 0, averageUsage: 0, memoryLeaks: false, gcPressure: 0, objectPoolEfficiency: 0 },
        errors: this.calculateErrorMetrics(errors),
        scalability: this.calculateScalabilityMetrics(latencies, batchSizes)
      },
      recommendations: this.generateRecommendations('batch', latencies, errors),
      timestamp: Date.now()
    })
  }

  /**
   * Benchmark concurrent operations
   */
  private async benchmarkConcurrentOperations(): Promise<void> {
    console.log('Benchmarking concurrent operations...')
    
    const latencies: number[] = []
    const throughputs: number[] = []
    const errors: SubtitleTempError[] = []

    for (const concurrencyLevel of this.config.concurrencyLevels) {
      const promises = []
      
      for (let i = 0; i < concurrencyLevel; i++) {
        const testData = SubtitleTestDataGenerator.generateSubtitleContent(
          `concurrent-workspace-${i}`,
          `concurrent-session-${i}`,
          500
        )

        const startTime = performance.now()
        const promise = optimizedSubtitleTempStorageService.saveSubtitleContent(
          `concurrent-workspace-${i}`,
          `concurrent-session-${i}`,
          testData.subtitles
        ).then(result => {
          const duration = performance.now() - startTime
          
          if (result.success) {
            latencies.push(duration)
            throughputs.push((testData.subtitles.length / duration) * 1000)
          } else if (result.error) {
            errors.push(result.error)
          }
        })

        promises.push(promise)
      }

      await Promise.all(promises)
    }

    this.results.push({
      testName: 'Concurrent Operations',
      config: this.config,
      results: {
        latency: this.calculateLatencyMetrics(latencies),
        throughput: this.calculateThroughputMetrics(throughputs),
        memory: { peakUsage: 0, averageUsage: 0, memoryLeaks: false, gcPressure: 0, objectPoolEfficiency: 0 },
        errors: this.calculateErrorMetrics(errors),
        scalability: this.calculateScalabilityMetrics(latencies, this.config.concurrencyLevels)
      },
      recommendations: this.generateRecommendations('concurrent', latencies, errors),
      timestamp: Date.now()
    })
  }

  /**
   * Benchmark memory usage patterns
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    console.log('Benchmarking memory usage...')
    
    const memoryReadings: number[] = []
    const initialMemory = this.getCurrentMemoryUsage()

    for (let i = 0; i < 50; i++) {
      const testData = SubtitleTestDataGenerator.generateSubtitleContent(
        `memory-workspace-${i}`,
        `memory-session-${i}`,
        2000 // Large dataset
      )

      await optimizedSubtitleTempStorageService.saveSubtitleContent(
        `memory-workspace-${i}`,
        `memory-session-${i}`,
        testData.subtitles
      )

      const currentMemory = this.getCurrentMemoryUsage()
      memoryReadings.push(currentMemory)
    }

    const finalMemory = this.getCurrentMemoryUsage()
    const memoryLeak = finalMemory > initialMemory * 1.5 // 50% increase indicates potential leak

    this.results.push({
      testName: 'Memory Usage',
      config: this.config,
      results: {
        latency: { average: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0, standardDeviation: 0 },
        throughput: { operationsPerSecond: 0, dataTransferRate: 0, peakThroughput: 0, sustainedThroughput: 0 },
        memory: {
          peakUsage: Math.max(...memoryReadings),
          averageUsage: memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length,
          memoryLeaks: memoryLeak,
          gcPressure: this.calculateGCPressure(memoryReadings),
          objectPoolEfficiency: 0.85 // Would need actual measurement
        },
        errors: { errorRate: 0, errorTypes: {}, recoveryTime: 0, criticalErrors: 0 },
        scalability: { linearScaling: true, scalingFactor: 1.0, bottleneckPoints: [], resourceUtilization: 0.7 }
      },
      recommendations: this.generateMemoryRecommendations(memoryReadings, memoryLeak),
      timestamp: Date.now()
    })
  }

  /**
   * Benchmark scalability characteristics
   */
  private async benchmarkScalability(): Promise<void> {
    console.log('Benchmarking scalability...')
    
    const scalabilityData: Array<{ size: number; latency: number; throughput: number }> = []

    for (const dataSize of [100, 500, 1000, 2500, 5000, 7500, 10000]) {
      const latencies: number[] = []
      const throughputs: number[] = []

      for (let i = 0; i < 10; i++) {
        const testData = SubtitleTestDataGenerator.generateSubtitleContent(
          `scalability-workspace-${i}`,
          `scalability-session-${i}`,
          dataSize
        )

        const startTime = performance.now()
        const result = await optimizedSubtitleTempStorageService.saveSubtitleContent(
          `scalability-workspace-${i}`,
          `scalability-session-${i}`,
          testData.subtitles
        )

        if (result.success) {
          const duration = performance.now() - startTime
          latencies.push(duration)
          throughputs.push((dataSize / duration) * 1000)
        }
      }

      if (latencies.length > 0) {
        scalabilityData.push({
          size: dataSize,
          latency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
          throughput: throughputs.reduce((a, b) => a + b, 0) / throughputs.length
        })
      }
    }

    // Analyze scalability characteristics
    const linearScaling = this.isLinearScaling(scalabilityData)
    const scalingFactor = this.calculateScalingFactor(scalabilityData)
    const bottleneckPoints = this.findBottleneckPoints(scalabilityData)

    this.results.push({
      testName: 'Scalability Analysis',
      config: this.config,
      results: {
        latency: this.calculateLatencyMetrics(scalabilityData.map(d => d.latency)),
        throughput: this.calculateThroughputMetrics(scalabilityData.map(d => d.throughput)),
        memory: { peakUsage: 0, averageUsage: 0, memoryLeaks: false, gcPressure: 0, objectPoolEfficiency: 0 },
        errors: { errorRate: 0, errorTypes: {}, recoveryTime: 0, criticalErrors: 0 },
        scalability: {
          linearScaling,
          scalingFactor,
          bottleneckPoints,
          resourceUtilization: 0.75
        }
      },
      recommendations: this.generateScalabilityRecommendations(linearScaling, scalingFactor, bottleneckPoints),
      timestamp: Date.now()
    })
  }

  // ============================================================================
  // METRIC CALCULATION HELPERS
  // ============================================================================

  private calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return { average: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0, standardDeviation: 0 }
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    const average = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const median = sorted[Math.floor(sorted.length / 2)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    
    const variance = latencies.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / latencies.length
    const standardDeviation = Math.sqrt(variance)

    return { average, median, p95, p99, min, max, standardDeviation }
  }

  private calculateThroughputMetrics(throughputs: number[]): ThroughputMetrics {
    if (throughputs.length === 0) {
      return { operationsPerSecond: 0, dataTransferRate: 0, peakThroughput: 0, sustainedThroughput: 0 }
    }

    const average = throughputs.reduce((a, b) => a + b, 0) / throughputs.length
    const peak = Math.max(...throughputs)
    const sustained = throughputs.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, throughputs.length)

    return {
      operationsPerSecond: average,
      dataTransferRate: average * 0.001, // Rough estimate
      peakThroughput: peak,
      sustainedThroughput: sustained
    }
  }

  private calculateMemoryMetrics(memoryUsages: number[]): MemoryMetrics {
    if (memoryUsages.length === 0) {
      return { peakUsage: 0, averageUsage: 0, memoryLeaks: false, gcPressure: 0, objectPoolEfficiency: 0 }
    }

    const peak = Math.max(...memoryUsages)
    const average = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
    const memoryLeaks = peak > average * 2 // Simple heuristic
    const gcPressure = this.calculateGCPressure(memoryUsages)

    return {
      peakUsage: peak,
      averageUsage: average,
      memoryLeaks,
      gcPressure,
      objectPoolEfficiency: 0.8 // Would need actual measurement
    }
  }

  private calculateErrorMetrics(errors: SubtitleTempError[]): ErrorMetrics {
    const errorTypes: Record<string, number> = {}
    let criticalErrors = 0

    errors.forEach(error => {
      errorTypes[error.code] = (errorTypes[error.code] || 0) + 1
      if (error.severity === 'critical') {
        criticalErrors++
      }
    })

    return {
      errorRate: errors.length / this.config.iterations,
      errorTypes,
      recoveryTime: 0, // Would need actual measurement
      criticalErrors
    }
  }

  private calculateScalabilityMetrics(latencies: number[], sizes: number[]): ScalabilityMetrics {
    if (latencies.length === 0 || sizes.length === 0) {
      return { linearScaling: false, scalingFactor: 0, bottleneckPoints: [], resourceUtilization: 0 }
    }

    // Simple linear regression to check scaling
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length
    
    const scalingFactor = avgLatency / avgSize
    const linearScaling = scalingFactor < 2.0 // Heuristic: less than 2x increase per size increase

    return {
      linearScaling,
      scalingFactor,
      bottleneckPoints: [], // Would need more complex analysis
      resourceUtilization: 0.7 // Estimated
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private calculateGCPressure(memoryReadings: number[]): number {
    // Calculate GC pressure based on memory pattern volatility
    let volatility = 0
    for (let i = 1; i < memoryReadings.length; i++) {
      const change = Math.abs(memoryReadings[i] - memoryReadings[i - 1])
      volatility += change
    }
    return volatility / memoryReadings.length
  }

  private isLinearScaling(data: Array<{ size: number; latency: number }>): boolean {
    if (data.length < 3) return true

    // Check if latency increases roughly linearly with size
    const ratios = []
    for (let i = 1; i < data.length; i++) {
      const sizeRatio = data[i].size / data[i - 1].size
      const latencyRatio = data[i].latency / data[i - 1].latency
      ratios.push(latencyRatio / sizeRatio)
    }

    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length
    const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - avgRatio, 2), 0) / ratios.length
    
    return variance < 0.5 // Low variance indicates linear scaling
  }

  private calculateScalingFactor(data: Array<{ size: number; latency: number }>): number {
    if (data.length < 2) return 1.0

    const first = data[0]
    const last = data[data.length - 1]
    
    const sizeIncrease = last.size / first.size
    const latencyIncrease = last.latency / first.latency
    
    return latencyIncrease / sizeIncrease
  }

  private findBottleneckPoints(data: Array<{ size: number; latency: number }>): number[] {
    const bottlenecks = []
    
    for (let i = 1; i < data.length - 1; i++) {
      const prevRatio = data[i].latency / data[i - 1].latency
      const nextRatio = data[i + 1].latency / data[i].latency
      
      // Detect significant performance degradation
      if (prevRatio > 1.5 || nextRatio > 1.5) {
        bottlenecks.push(data[i].size)
      }
    }
    
    return bottlenecks
  }

  // ============================================================================
  // RECOMMENDATION GENERATORS
  // ============================================================================

  private generateRecommendations(testType: string, latencies: number[], errors: SubtitleTempError[]): string[] {
    const recommendations: string[] = []
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const errorRate = errors.length / this.config.iterations

    if (avgLatency > 1000) {
      recommendations.push(`High ${testType} latency detected (${avgLatency.toFixed(0)}ms). Consider enabling compression or optimizing data structures.`)
    }

    if (errorRate > 0.05) {
      recommendations.push(`High error rate (${(errorRate * 100).toFixed(1)}%) in ${testType} operations. Review error handling and data validation.`)
    }

    if (testType === 'save' && avgLatency > 500) {
      recommendations.push('Consider implementing background save queuing to improve user experience.')
    }

    if (testType === 'load' && avgLatency > 200) {
      recommendations.push('Implement more aggressive caching strategies to improve load performance.')
    }

    return recommendations
  }

  private generateMemoryRecommendations(memoryReadings: number[], hasMemoryLeak: boolean): string[] {
    const recommendations: string[] = []
    
    if (hasMemoryLeak) {
      recommendations.push('Potential memory leak detected. Review object lifecycle management and ensure proper cleanup.')
    }

    const peakUsage = Math.max(...memoryReadings)
    if (peakUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected. Consider implementing more efficient data structures or compression.')
    }

    const gcPressure = this.calculateGCPressure(memoryReadings)
    if (gcPressure > 10 * 1024 * 1024) { // 10MB volatility
      recommendations.push('High GC pressure detected. Review object creation patterns and consider object pooling.')
    }

    return recommendations
  }

  private generateScalabilityRecommendations(
    linearScaling: boolean,
    scalingFactor: number,
    bottlenecks: number[]
  ): string[] {
    const recommendations: string[] = []

    if (!linearScaling) {
      recommendations.push('Non-linear scaling detected. Review algorithms for complexity issues and consider optimization.')
    }

    if (scalingFactor > 2.0) {
      recommendations.push(`Poor scaling factor (${scalingFactor.toFixed(2)}). Performance degrades significantly with data size.`)
    }

    if (bottlenecks.length > 0) {
      recommendations.push(`Performance bottlenecks detected at data sizes: ${bottlenecks.join(', ')}. Consider implementation changes at these thresholds.`)
    }

    return recommendations
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  private generateSummaryReport(): void {
    console.log('\n=== PERFORMANCE BENCHMARK SUMMARY ===')
    
    this.results.forEach(result => {
      console.log(`\n${result.testName}:`)
      console.log(`  Average Latency: ${result.results.latency.average.toFixed(2)}ms`)
      console.log(`  P95 Latency: ${result.results.latency.p95.toFixed(2)}ms`)
      console.log(`  Throughput: ${result.results.throughput.operationsPerSecond.toFixed(2)} ops/sec`)
      console.log(`  Error Rate: ${(result.results.errors.errorRate * 100).toFixed(2)}%`)
      
      if (result.recommendations.length > 0) {
        console.log('  Recommendations:')
        result.recommendations.forEach(rec => console.log(`    - ${rec}`))
      }
    })
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify(this.results, null, 2)
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Run quick performance validation
 */
export async function runQuickPerformanceValidation(): Promise<{
  passed: boolean
  issues: string[]
  metrics: {
    saveLatency: number
    loadLatency: number
    memoryUsage: number
  }
}> {
  const issues: string[] = []
  
  // Test save performance
  const testData = SubtitleTestDataGenerator.generateSubtitleContent('perf-test', 'perf-session', 1000)
  
  const saveStart = performance.now()
  const saveResult = await optimizedSubtitleTempStorageService.saveSubtitleContent('perf-test', 'perf-session', testData.subtitles)
  const saveLatency = performance.now() - saveStart

  if (saveLatency > 2000) {
    issues.push(`Slow save operation: ${saveLatency.toFixed(0)}ms`)
  }

  let loadLatency = 0
  if (saveResult.success) {
    const loadStart = performance.now()
    await optimizedSubtitleTempStorageService.loadSubtitleContent(saveResult.data.storageId)
    loadLatency = performance.now() - loadStart

    if (loadLatency > 1000) {
      issues.push(`Slow load operation: ${loadLatency.toFixed(0)}ms`)
    }
  }

  // Check memory usage
  const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0
  if (memoryUsage > 200 * 1024 * 1024) { // 200MB
    issues.push(`High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(0)}MB`)
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      saveLatency,
      loadLatency,
      memoryUsage
    }
  }
}

/**
 * Monitor performance continuously
 */
export class ContinuousPerformanceMonitor {
  private monitoring = false
  private metrics: Array<{ timestamp: number; latency: number; throughput: number; errors: number }> = []
  private intervalId?: NodeJS.Timeout

  start(intervalMs = 10000): void {
    if (this.monitoring) return

    this.monitoring = true
    this.intervalId = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    this.monitoring = false
  }

  private collectMetrics(): void {
    const perfMetrics = performanceManager.metricsCollector.getAveragePerformance()
    
    this.metrics.push({
      timestamp: Date.now(),
      latency: perfMetrics.averageDuration,
      throughput: perfMetrics.throughput,
      errors: perfMetrics.errorRate
    })

    // Keep only last 1000 measurements
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  getMetrics(): typeof this.metrics {
    return [...this.metrics]
  }

  getLatestMetrics(): typeof this.metrics[0] | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }
}

export default SubtitlePerformanceBenchmark