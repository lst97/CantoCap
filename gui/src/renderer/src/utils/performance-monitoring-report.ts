/**
 * Comprehensive Performance Monitoring and Analysis
 * 
 * Advanced performance tracking for auto-save system optimizations,
 * providing detailed bottleneck analysis and optimization recommendations.
 */

import { PerformanceMonitor } from './performance-utils'
import { globalContentHashCache } from './content-hash-cache'

interface PerformanceBreakdown {
  operation: string
  totalTime: number
  breakdown: {
    hashCalculation: number
    databaseOperations: number
    objectCreation: number
    serialization: number
    cacheOperations: number
  }
  optimizationLevel: 'baseline' | 'optimized' | 'experimental'
  recommendations: string[]
}

interface SystemMetrics {
  memoryUsage: {
    used: number
    total: number
    percentage: number
  } | null
  cacheEfficiency: {
    hitRate: number
    avgAccessTime: number
    memoryUsage: number
    recommendations: string[]
  }
  performanceProfile: {
    averageOperationTime: number
    slowOperationCount: number
    fastOperationCount: number
    totalOperations: number
  }
}

interface OptimizationImpact {
  before: {
    averageTime: number
    throughput: number
  }
  after: {
    averageTime: number
    throughput: number
  }
  improvement: {
    timeReduction: number
    throughputIncrease: number
    percentageImprovement: number
  }
  achievedTarget: boolean
}

/**
 * Enhanced performance monitoring with bottleneck analysis
 */
export class PerformanceAnalyzer {
  private operationBreakdowns = new Map<string, PerformanceBreakdown>()
  private baselineMetrics = new Map<string, number>()
  private optimizationTargets = new Map<string, number>()

  constructor() {
    // Set performance targets
    this.optimizationTargets.set('JSON Import Session Init', 33) // Target: 33ms for 11 items
    this.optimizationTargets.set('Subtitle Session Init', 30) // Target: 30ms
    this.optimizationTargets.set('Hash Calculation', 5) // Target: 5ms
    this.optimizationTargets.set('Database Operations', 20) // Target: 20ms
  }

  /**
   * Record baseline performance before optimizations
   */
  recordBaseline(operation: string, duration: number, dataSize?: number): void {
    const normalizedDuration = dataSize ? duration / dataSize : duration
    this.baselineMetrics.set(operation, normalizedDuration)
  }

  /**
   * Analyze performance breakdown for complex operations
   */
  analyzeOperationBreakdown(
    operation: string,
    phases: {
      hashCalculation?: number
      databaseOperations?: number
      objectCreation?: number
      serialization?: number
      cacheOperations?: number
    },
    totalTime: number,
    optimizationLevel: 'baseline' | 'optimized' | 'experimental' = 'baseline'
  ): PerformanceBreakdown {
    const breakdown = {
      hashCalculation: phases.hashCalculation || 0,
      databaseOperations: phases.databaseOperations || 0,
      objectCreation: phases.objectCreation || 0,
      serialization: phases.serialization || 0,
      cacheOperations: phases.cacheOperations || 0
    }

    const recommendations = this.generateOperationRecommendations(breakdown, totalTime, operation)

    const analysis: PerformanceBreakdown = {
      operation,
      totalTime,
      breakdown,
      optimizationLevel,
      recommendations
    }

    this.operationBreakdowns.set(operation, analysis)
    return analysis
  }

  /**
   * Generate optimization recommendations based on performance breakdown
   */
  private generateOperationRecommendations(
    breakdown: PerformanceBreakdown['breakdown'],
    totalTime: number,
    operation: string
  ): string[] {
    const recommendations: string[] = []
    const target = this.optimizationTargets.get(operation) || totalTime * 0.5

    // Hash calculation optimization
    if (breakdown.hashCalculation > totalTime * 0.3) {
      recommendations.push('Hash calculation is a major bottleneck (>30% of time). Consider caching or faster algorithms.')
    }

    // Database operation optimization
    if (breakdown.databaseOperations > totalTime * 0.4) {
      recommendations.push('Database operations are slow (>40% of time). Consider parallel operations or connection pooling.')
    }

    // Object creation optimization
    if (breakdown.objectCreation > totalTime * 0.25) {
      recommendations.push('Object creation overhead is high (>25% of time). Consider object pooling or lazy evaluation.')
    }

    // Serialization optimization
    if (breakdown.serialization > totalTime * 0.2) {
      recommendations.push('Serialization is expensive (>20% of time). Consider reducing payload size or streaming.')
    }

    // Overall performance check
    if (totalTime > target) {
      const improvement = ((totalTime - target) / totalTime * 100).toFixed(1)
      recommendations.push(`Operation is ${improvement}% slower than target. Total optimization needed: ${(totalTime - target).toFixed(1)}ms`)
    }

    return recommendations
  }

  /**
   * Get comprehensive system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const perfMonitor = PerformanceMonitor.getInstance()
    const perfStats = perfMonitor.getPerformanceStats()
    const cacheReport = globalContentHashCache.getEfficiencyReport()

    // Memory usage
    let memoryUsage = null
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory
      memoryUsage = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
        percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
      }
    }

    return {
      memoryUsage,
      cacheEfficiency: {
        hitRate: cacheReport?.stats?.hitRate || 0,
        avgAccessTime: cacheReport?.stats?.avgAccessTime || 0,
        memoryUsage: cacheReport?.stats?.memoryUsage || 0,
        recommendations: cacheReport?.recommendations || []
      },
      performanceProfile: {
        averageOperationTime: perfStats.averageDuration,
        slowOperationCount: perfStats.slowOperations,
        fastOperationCount: perfStats.operationCount - perfStats.slowOperations,
        totalOperations: perfStats.operationCount
      }
    }
  }

  /**
   * Calculate optimization impact
   */
  calculateOptimizationImpact(
    operation: string,
    currentDuration: number,
    dataSize?: number
  ): OptimizationImpact | null {
    const baseline = this.baselineMetrics.get(operation)
    const target = this.optimizationTargets.get(operation)
    
    if (!baseline) return null

    const normalizedCurrent = dataSize ? currentDuration / dataSize : currentDuration
    const throughputBefore = dataSize ? dataSize / (baseline * dataSize) * 1000 : 1000 / baseline
    const throughputAfter = dataSize ? dataSize / currentDuration * 1000 : 1000 / currentDuration

    const timeReduction = (baseline * (dataSize || 1)) - currentDuration
    const throughputIncrease = throughputAfter - throughputBefore
    const percentageImprovement = ((baseline * (dataSize || 1)) - currentDuration) / (baseline * (dataSize || 1)) * 100

    return {
      before: {
        averageTime: baseline * (dataSize || 1),
        throughput: throughputBefore
      },
      after: {
        averageTime: currentDuration,
        throughput: throughputAfter
      },
      improvement: {
        timeReduction,
        throughputIncrease,
        percentageImprovement
      },
      achievedTarget: target ? currentDuration <= target * (dataSize || 1) : false
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(): {
    summary: {
      overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
      majorBottlenecks: string[]
      quickWins: string[]
      systemMetrics: SystemMetrics
    }
    detailedAnalysis: PerformanceBreakdown[]
    optimizationImpacts: OptimizationImpact[]
    recommendations: {
      immediate: string[]
      shortTerm: string[]
      longTerm: string[]
    }
  } {
    const systemMetrics = this.getSystemMetrics()
    const breakdowns = Array.from(this.operationBreakdowns.values())
    
    // Calculate optimization impacts
    const impacts: OptimizationImpact[] = []
    for (const [operation, baseline] of this.baselineMetrics.entries()) {
      const breakdown = this.operationBreakdowns.get(operation)
      if (breakdown) {
        const impact = this.calculateOptimizationImpact(operation, breakdown.totalTime, 11) // Assuming 11 items for JSON import
        if (impact) impacts.push(impact)
      }
    }

    // Determine overall health
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'
    if (systemMetrics.performanceProfile.slowOperationCount > 3) overallHealth = 'poor'
    else if (systemMetrics.performanceProfile.slowOperationCount > 1) overallHealth = 'fair'
    else if (systemMetrics.performanceProfile.averageDuration > 100) overallHealth = 'good'

    // Identify bottlenecks
    const majorBottlenecks: string[] = []
    const quickWins: string[] = []

    breakdowns.forEach(breakdown => {
      const { breakdown: phases, totalTime, operation } = breakdown
      
      // Major bottlenecks (>100ms or >40% of total time)
      if (totalTime > 100) {
        majorBottlenecks.push(`${operation}: ${totalTime.toFixed(1)}ms total time`)
      }
      
      if (phases.hashCalculation > totalTime * 0.3) {
        majorBottlenecks.push(`${operation}: Hash calculation bottleneck`)
      }
      
      if (phases.databaseOperations > totalTime * 0.4) {
        majorBottlenecks.push(`${operation}: Database operation bottleneck`)
      }

      // Quick wins (easy optimizations)
      if (phases.cacheOperations < 5 && phases.hashCalculation > 20) {
        quickWins.push(`${operation}: Implement hash caching`)
      }
      
      if (phases.databaseOperations > 40 && operation.includes('parallel')) {
        quickWins.push(`${operation}: Parallelize database operations`)
      }
    })

    // Generate recommendations
    const recommendations = this.generateRecommendations(systemMetrics, impacts, breakdowns)

    return {
      summary: {
        overallHealth,
        majorBottlenecks,
        quickWins,
        systemMetrics
      },
      detailedAnalysis: breakdowns,
      optimizationImpacts: impacts,
      recommendations
    }
  }

  /**
   * Generate categorized recommendations
   */
  private generateRecommendations(
    systemMetrics: SystemMetrics,
    impacts: OptimizationImpact[],
    breakdowns: PerformanceBreakdown[]
  ): {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
  } {
    const immediate: string[] = []
    const shortTerm: string[] = []
    const longTerm: string[] = []

    // Cache efficiency
    const hitRate = systemMetrics.cacheEfficiency?.hitRate || 0
    if (hitRate < 0.5) {
      immediate.push('Cache hit rate is very low. Enable caching for all hash operations.')
    } else if (hitRate < 0.8) {
      shortTerm.push('Improve cache hit rate by optimizing cache size and TTL settings.')
    }

    // Memory usage
    if (systemMetrics.memoryUsage?.percentage && systemMetrics.memoryUsage.percentage > 80) {
      immediate.push('High memory usage detected. Implement garbage collection optimization.')
    }

    // Operation performance
    const hasSlowOperations = systemMetrics.performanceProfile.slowOperationCount > 1
    if (hasSlowOperations) {
      immediate.push('Multiple slow operations detected. Prioritize parallel processing optimization.')
    }

    // Optimization impact analysis
    const unmetTargets = impacts.filter(impact => !impact.achievedTarget)
    if (unmetTargets.length > 0) {
      shortTerm.push(`${unmetTargets.length} operations still below target performance. Focus on hash optimization and database parallelization.`)
    }

    // Long-term recommendations
    longTerm.push('Consider implementing Web Workers for heavy computations')
    longTerm.push('Evaluate database schema optimization for faster queries')
    longTerm.push('Implement predictive caching based on user behavior patterns')

    return { immediate, shortTerm, longTerm }
  }

  /**
   * Clear all recorded metrics (useful for testing)
   */
  clearMetrics(): void {
    this.operationBreakdowns.clear()
    this.baselineMetrics.clear()
  }

  /**
   * Export performance data for external analysis
   */
  exportPerformanceData(): {
    timestamp: number
    baselines: Record<string, number>
    breakdowns: PerformanceBreakdown[]
    systemMetrics: SystemMetrics
  } {
    return {
      timestamp: Date.now(),
      baselines: Object.fromEntries(this.baselineMetrics),
      breakdowns: Array.from(this.operationBreakdowns.values()),
      systemMetrics: this.getSystemMetrics()
    }
  }
}

// Global performance analyzer instance
export const globalPerformanceAnalyzer = new PerformanceAnalyzer()

// Helper function to log performance improvements
export function logPerformanceImprovement(
  operation: string,
  beforeTime: number,
  afterTime: number,
  dataSize?: number
): void {
  const improvement = ((beforeTime - afterTime) / beforeTime * 100).toFixed(1)
  const throughputBefore = dataSize ? (dataSize / beforeTime * 1000).toFixed(1) : 'N/A'
  const throughputAfter = dataSize ? (dataSize / afterTime * 1000).toFixed(1) : 'N/A'
  
  console.log(`🚀 PERFORMANCE IMPROVEMENT: ${operation}`)
  console.log(`   Before: ${beforeTime.toFixed(2)}ms (${throughputBefore} items/sec)`)
  console.log(`   After:  ${afterTime.toFixed(2)}ms (${throughputAfter} items/sec)`)
  console.log(`   Improvement: ${improvement}% faster`)
}