/**
 * JSON Import Performance Monitor
 * Tracks performance metrics during JSON caption import to validate optimizations
 */

interface JsonImportMetrics {
  startTime: number
  endTime?: number
  renderCount: number
  validationCallsSkipped: number
  stepTransitionsCount: number
  totalDuration?: number
}

class JsonImportPerformanceMonitor {
  private metrics: JsonImportMetrics | null = null
  private renderObserver: MutationObserver | null = null
  private originalConsoleLog: typeof console.log

  constructor() {
    this.originalConsoleLog = console.log
    this.setupRenderCountTracking()
  }

  /**
   * Start monitoring JSON import performance
   */
  startMonitoring(): void {
    this.metrics = {
      startTime: performance.now(),
      renderCount: 0,
      validationCallsSkipped: 0,
      stepTransitionsCount: 0
    }

    // Track validation calls skipped
    this.interceptConsoleForValidationSkips()
    
    console.log('🚀 [PERFORMANCE MONITOR] JSON import tracking started')
  }

  /**
   * Stop monitoring and return metrics
   */
  stopMonitoring(): JsonImportMetrics | null {
    if (!this.metrics) {
      return null
    }

    this.metrics.endTime = performance.now()
    this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime

    // Restore original console.log
    console.log = this.originalConsoleLog

    const finalMetrics = { ...this.metrics }
    this.metrics = null

    console.log('✅ [PERFORMANCE MONITOR] JSON import tracking completed:', finalMetrics)
    return finalMetrics
  }

  /**
   * Track React renders by monitoring DOM mutations
   */
  private setupRenderCountTracking(): void {
    if (typeof window !== 'undefined' && window.MutationObserver) {
      this.renderObserver = new MutationObserver((mutations) => {
        if (this.metrics && mutations.length > 0) {
          // Only count significant mutations during import
          const importFlag = window as Window & { __JSON_IMPORT_IN_PROGRESS?: boolean }
          if (importFlag.__JSON_IMPORT_IN_PROGRESS) {
            this.metrics.renderCount += mutations.filter(m => 
              m.type === 'childList' && m.addedNodes.length > 0
            ).length
          }
        }
      })

      // Start observing when monitoring begins
      if (document.body) {
        this.renderObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false
        })
      }
    }
  }

  /**
   * Intercept console.log to count skipped validation calls
   */
  private interceptConsoleForValidationSkips(): void {
    const monitor = this
    console.log = function(...args: unknown[]) {
      // Count validation calls that were skipped
      const message = args[0]
      if (typeof message === 'string') {
        if (message.includes('Skipping') && message.includes('validation') && message.includes('JSON import')) {
          if (monitor.metrics) {
            monitor.metrics.validationCallsSkipped++
          }
        }
        if (message.includes('step transition') || message.includes('transitionState')) {
          if (monitor.metrics) {
            monitor.metrics.stepTransitionsCount++
          }
        }
      }
      
      // Call original console.log
      monitor.originalConsoleLog.apply(console, args)
    }
  }

  /**
   * Generate performance report
   */
  generateReport(metrics: JsonImportMetrics): string {
    const report = `
📊 JSON Import Performance Report
================================
⏱️  Total Duration: ${metrics.totalDuration?.toFixed(2)}ms
🔄 Render Count: ${metrics.renderCount}
⚡ Validation Calls Skipped: ${metrics.validationCallsSkipped}
🔀 Step Transitions: ${metrics.stepTransitionsCount}

🎯 Performance Score: ${this.calculatePerformanceScore(metrics)}
💡 Optimization Impact: ${metrics.validationCallsSkipped > 0 ? 'ACTIVE' : 'INACTIVE'}
    `
    return report.trim()
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: JsonImportMetrics): number {
    if (!metrics.totalDuration) return 0

    // Lower duration = higher score
    // Fewer renders = higher score
    // More validation skips = higher score (shows optimization working)
    const durationScore = Math.max(0, 100 - (metrics.totalDuration / 10)) // 10ms = 1 point deduction
    const renderScore = Math.max(0, 100 - (metrics.renderCount * 5)) // 5 points per render
    const optimizationBonus = metrics.validationCallsSkipped * 2 // 2 points per skipped validation

    return Math.min(100, Math.round((durationScore + renderScore + optimizationBonus) / 2))
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.renderObserver) {
      this.renderObserver.disconnect()
      this.renderObserver = null
    }
    console.log = this.originalConsoleLog
  }
}

// Export singleton instance
export const jsonImportPerformanceMonitor = new JsonImportPerformanceMonitor()

// Type exports
export type { JsonImportMetrics }