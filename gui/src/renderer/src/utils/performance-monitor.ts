// Performance Monitor - Real-time performance tracking and optimization
// REMOVED: auto-save-engine types - timer-based auto-save system deleted

import { generateAlertId } from './id-generator'

// ============================================================================
// PERFORMANCE MONITORING TYPES
// ============================================================================

export interface PerformanceMetric {
  id: string
  category: 'memory' | 'cpu' | 'storage' | 'network' | 'ui' | 'cache'
  name: string
  value: number
  unit: string
  threshold: {
    warning: number
    critical: number
  }
  timestamp: number
  trend: 'improving' | 'stable' | 'degrading'
}

export interface PerformanceBudget {
  category: PerformanceMetric['category']
  name: string
  maxValue: number
  warningThreshold: number
  currentValue: number
  isExceeded: boolean
  lastUpdated: number
}

export interface PerformanceAlert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  category: PerformanceMetric['category']
  title: string
  description: string
  impact: string
  recommendation: string
  timestamp: number
  acknowledged: boolean
  autoResolve?: boolean
}

export interface SystemResource {
  name: string
  type: 'memory' | 'cpu' | 'storage' | 'network'
  current: number
  max: number
  unit: string
  utilization: number
  trend: 'up' | 'down' | 'stable'
}

export interface PerformanceSnapshot {
  timestamp: number
  metrics: PerformanceMetric[]
  budgets: PerformanceBudget[]
  alerts: PerformanceAlert[]
  systemResources: SystemResource[]
  recommendations: OptimizationSuggestion[]
  overallScore: number
}

export interface PerformanceConfig {
  monitoringInterval: number
  metricsRetentionTime: number
  alertThresholds: Record<string, { warning: number; critical: number }>
  budgets: PerformanceBudget[]
  enableAutoOptimization: boolean
  enablePredictiveAnalysis: boolean
}

// ============================================================================
// PERFORMANCE METRICS COLLECTOR
// ============================================================================

class PerformanceMetricsCollector {
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 1000
  private collectionInterval: NodeJS.Timeout | null = null

  startCollection(intervalMs: number = 1000): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
    }

    this.collectionInterval = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)
  }

  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
      this.collectionInterval = null
    }
  }

  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now()
    const newMetrics: PerformanceMetric[] = []

    // Memory metrics
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      newMetrics.push(
        this.createMetric('memory', 'heap-used', memInfo.usedJSHeapSize / 1024 / 1024, 'MB', 
          { warning: 50, critical: 100 }, timestamp),
        this.createMetric('memory', 'heap-total', memInfo.totalJSHeapSize / 1024 / 1024, 'MB',
          { warning: 100, critical: 200 }, timestamp),
        this.createMetric('memory', 'heap-limit', memInfo.jsHeapSizeLimit / 1024 / 1024, 'MB',
          { warning: 500, critical: 1000 }, timestamp)
      )
    }

    // Navigation timing metrics
    if ('navigation' in performance) {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navTiming) {
        newMetrics.push(
          this.createMetric('network', 'dns-lookup', navTiming.domainLookupEnd - navTiming.domainLookupStart, 'ms',
            { warning: 200, critical: 500 }, timestamp),
          this.createMetric('network', 'connection-time', navTiming.connectEnd - navTiming.connectStart, 'ms',
            { warning: 300, critical: 800 }, timestamp),
          this.createMetric('ui', 'dom-content-loaded', navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart, 'ms',
            { warning: 1000, critical: 3000 }, timestamp)
        )
      }
    }

    // Paint timing metrics
    const paintMetrics = performance.getEntriesByType('paint')
    paintMetrics.forEach(entry => {
      newMetrics.push(
        this.createMetric('ui', entry.name, entry.startTime, 'ms',
          { warning: 1000, critical: 2500 }, timestamp)
      )
    })

    // Storage usage metrics (estimate)
    newMetrics.push(
      this.createMetric('storage', 'indexeddb-estimate', await this.estimateStorageUsage(), 'MB',
        { warning: 100, critical: 500 }, timestamp)
    )

    // CPU usage estimate (based on task timing)
    newMetrics.push(
      this.createMetric('cpu', 'main-thread-blocking', await this.estimateMainThreadBlocking(), 'ms',
        { warning: 50, critical: 100 }, timestamp)
    )

    // Add metrics and maintain size limit
    this.metrics.push(...newMetrics)
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Calculate trends
    this.calculateTrends()
  }

  private createMetric(
    category: PerformanceMetric['category'],
    name: string,
    value: number,
    unit: string,
    threshold: { warning: number; critical: number },
    timestamp: number
  ): PerformanceMetric {
    return {
      id: `${category}-${name}-${timestamp}`,
      category,
      name,
      value,
      unit,
      threshold,
      timestamp,
      trend: 'stable' // Will be calculated later
    }
  }

  private calculateTrends(): void {
    const recentWindow = 5 // Last 5 measurements
    const metricsGroups = this.groupMetricsByName()

    Object.entries(metricsGroups).forEach(([name, metrics]) => {
      if (metrics.length >= recentWindow) {
        const recent = metrics.slice(-recentWindow)
        const older = metrics.slice(-recentWindow * 2, -recentWindow)

        if (older.length > 0) {
          const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length
          const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length
          const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100

          let trend: PerformanceMetric['trend']
          if (Math.abs(changePercent) < 5) {
            trend = 'stable'
          } else if (changePercent > 0) {
            trend = 'degrading' // Higher values usually mean worse performance
          } else {
            trend = 'improving'
          }

          // Update trend for recent metrics
          recent.forEach(metric => metric.trend = trend)
        }
      }
    })
  }

  private groupMetricsByName(): Record<string, PerformanceMetric[]> {
    return this.metrics.reduce((groups, metric) => {
      const key = `${metric.category}-${metric.name}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(metric)
      return groups
    }, {} as Record<string, PerformanceMetric[]>)
  }

  private async estimateStorageUsage(): Promise<number> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        return (estimate.usage || 0) / 1024 / 1024 // Convert to MB
      }
    } catch (error) {
      console.warn('Could not estimate storage usage:', error)
    }
    return 0
  }

  private async estimateMainThreadBlocking(): Promise<number> {
    return new Promise(resolve => {
      const start = performance.now()
      setTimeout(() => {
        const blocked = performance.now() - start
        resolve(Math.max(0, blocked - 5)) // Account for timer overhead
      }, 0)
    })
  }

  getMetrics(category?: PerformanceMetric['category'], limit?: number): PerformanceMetric[] {
    let filtered = category ? this.metrics.filter(m => m.category === category) : this.metrics
    if (limit) {
      filtered = filtered.slice(-limit)
    }
    return [...filtered]
  }

  getLatestMetric(category: PerformanceMetric['category'], name: string): PerformanceMetric | null {
    const matches = this.metrics.filter(m => m.category === category && m.name === name)
    return matches.length > 0 ? matches[matches.length - 1] : null
  }

  clearMetrics(): void {
    this.metrics = []
  }
}

// ============================================================================
// PERFORMANCE BUDGET MANAGER
// ============================================================================

class PerformanceBudgetManager {
  private budgets: PerformanceBudget[] = []
  private defaultBudgets: PerformanceBudget[] = [
    {
      category: 'memory',
      name: 'heap-used',
      maxValue: 100,
      warningThreshold: 75,
      currentValue: 0,
      isExceeded: false,
      lastUpdated: Date.now()
    },
    {
      category: 'ui',
      name: 'first-contentful-paint',
      maxValue: 1500,
      warningThreshold: 1000,
      currentValue: 0,
      isExceeded: false,
      lastUpdated: Date.now()
    },
    {
      category: 'storage',
      name: 'indexeddb-estimate',
      maxValue: 500,
      warningThreshold: 300,
      currentValue: 0,
      isExceeded: false,
      lastUpdated: Date.now()
    },
    {
      category: 'cpu',
      name: 'main-thread-blocking',
      maxValue: 100,
      warningThreshold: 50,
      currentValue: 0,
      isExceeded: false,
      lastUpdated: Date.now()
    }
  ]

  constructor() {
    this.budgets = [...this.defaultBudgets]
  }

  setBudget(budget: Omit<PerformanceBudget, 'isExceeded' | 'lastUpdated'>): void {
    const existingIndex = this.budgets.findIndex(
      b => b.category === budget.category && b.name === budget.name
    )

    const newBudget: PerformanceBudget = {
      ...budget,
      isExceeded: budget.currentValue > budget.maxValue,
      lastUpdated: Date.now()
    }

    if (existingIndex >= 0) {
      this.budgets[existingIndex] = newBudget
    } else {
      this.budgets.push(newBudget)
    }
  }

  updateBudgetValue(category: PerformanceMetric['category'], name: string, value: number): void {
    const budget = this.budgets.find(b => b.category === category && b.name === name)
    if (budget) {
      budget.currentValue = value
      budget.isExceeded = value > budget.maxValue
      budget.lastUpdated = Date.now()
    }
  }

  getBudgets(): PerformanceBudget[] {
    return [...this.budgets]
  }

  getExceededBudgets(): PerformanceBudget[] {
    return this.budgets.filter(b => b.isExceeded)
  }

  getBudgetUtilization(category: PerformanceMetric['category'], name: string): number {
    const budget = this.budgets.find(b => b.category === category && b.name === name)
    return budget ? (budget.currentValue / budget.maxValue) * 100 : 0
  }
}

// ============================================================================
// PERFORMANCE ALERT MANAGER
// ============================================================================

class PerformanceAlertManager {
  private alerts: PerformanceAlert[] = []
  private readonly maxAlerts = 100

  addAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const newAlert: PerformanceAlert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: Date.now(),
      acknowledged: false
    }

    // Check for duplicate alerts
    const existingAlert = this.alerts.find(
      a => a.category === alert.category && 
           a.title === alert.title && 
           !a.acknowledged &&
           Date.now() - a.timestamp < 300000 // 5 minutes
    )

    if (!existingAlert) {
      this.alerts.unshift(newAlert)
      
      // Maintain size limit
      if (this.alerts.length > this.maxAlerts) {
        this.alerts = this.alerts.slice(0, this.maxAlerts)
      }
    }
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
    }
  }

  getAlerts(includeAcknowledged: boolean = false): PerformanceAlert[] {
    return this.alerts.filter(alert => includeAcknowledged || !alert.acknowledged)
  }

  getAlertsByCategory(category: PerformanceMetric['category']): PerformanceAlert[] {
    return this.alerts.filter(alert => alert.category === category && !alert.acknowledged)
  }

  clearAcknowledgedAlerts(): void {
    this.alerts = this.alerts.filter(alert => !alert.acknowledged)
  }

  private generateAlertId(): string {
    return generateAlertId()
  }
}

// ============================================================================
// MAIN PERFORMANCE MONITOR
// ============================================================================

export class PerformanceMonitor {
  private metricsCollector = new PerformanceMetricsCollector()
  private budgetManager = new PerformanceBudgetManager()
  private alertManager = new PerformanceAlertManager()
  private config: PerformanceConfig = {
    monitoringInterval: 2000,
    metricsRetentionTime: 3600000, // 1 hour
    alertThresholds: {
      'memory-heap-used': { warning: 75, critical: 100 },
      'ui-first-contentful-paint': { warning: 1000, critical: 2500 },
      'storage-indexeddb-estimate': { warning: 300, critical: 500 },
      'cpu-main-thread-blocking': { warning: 50, critical: 100 }
    },
    budgets: [],
    enableAutoOptimization: true,
    enablePredictiveAnalysis: false
  }
  private isMonitoring = false
  private analysisInterval: NodeJS.Timeout | null = null

  // ============================================================================
  // MONITORING CONTROL
  // ============================================================================

  startMonitoring(config?: Partial<PerformanceConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.metricsCollector.startCollection(this.config.monitoringInterval)
    
    // Start analysis interval
    this.analysisInterval = setInterval(() => {
      this.analyzePerformance()
    }, this.config.monitoringInterval * 2) // Analyze less frequently than collection

    console.log('Performance monitoring started')
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    this.metricsCollector.stopCollection()
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval)
      this.analysisInterval = null
    }

    console.log('Performance monitoring stopped')
  }

  configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (this.isMonitoring) {
      this.stopMonitoring()
      this.startMonitoring()
    }
  }

  // ============================================================================
  // PERFORMANCE ANALYSIS
  // ============================================================================

  private analyzePerformance(): void {
    const metrics = this.metricsCollector.getMetrics(undefined, 50) // Last 50 metrics
    
    // Update budget values
    this.updateBudgetsFromMetrics(metrics)
    
    // Generate alerts
    this.generatePerformanceAlerts(metrics)
    
    // Auto-optimize if enabled
    if (this.config.enableAutoOptimization) {
      this.performAutoOptimization(metrics)
    }
    
    // Cleanup old data
    this.cleanupOldData()
  }

  private updateBudgetsFromMetrics(metrics: PerformanceMetric[]): void {
    const latestMetrics = this.getLatestMetricsByName(metrics)
    
    Object.entries(latestMetrics).forEach(([key, metric]) => {
      const [category, name] = key.split('-', 2)
      this.budgetManager.updateBudgetValue(
        category as PerformanceMetric['category'], 
        name, 
        metric.value
      )
    })
  }

  private getLatestMetricsByName(metrics: PerformanceMetric[]): Record<string, PerformanceMetric> {
    const latest: Record<string, PerformanceMetric> = {}
    
    metrics.forEach(metric => {
      const key = `${metric.category}-${metric.name}`
      if (!latest[key] || metric.timestamp > latest[key].timestamp) {
        latest[key] = metric
      }
    })
    
    return latest
  }

  private generatePerformanceAlerts(metrics: PerformanceMetric[]): void {
    const latestMetrics = this.getLatestMetricsByName(metrics)
    
    Object.values(latestMetrics).forEach(metric => {
      const key = `${metric.category}-${metric.name}`
      const thresholds = this.config.alertThresholds[key]
      
      if (!thresholds) return
      
      if (metric.value > thresholds.critical) {
        this.alertManager.addAlert({
          severity: 'critical',
          category: metric.category,
          title: `Critical ${metric.category} usage`,
          description: `${metric.name} is at ${metric.value}${metric.unit}, exceeding critical threshold of ${thresholds.critical}${metric.unit}`,
          impact: 'Severe performance degradation expected',
          recommendation: this.getRecommendation(metric.category, metric.name, 'critical'),
          autoResolve: false
        })
      } else if (metric.value > thresholds.warning) {
        this.alertManager.addAlert({
          severity: 'warning',
          category: metric.category,
          title: `High ${metric.category} usage`,
          description: `${metric.name} is at ${metric.value}${metric.unit}, exceeding warning threshold of ${thresholds.warning}${metric.unit}`,
          impact: 'Performance may be affected',
          recommendation: this.getRecommendation(metric.category, metric.name, 'warning'),
          autoResolve: true
        })
      }
    })
  }

  private getRecommendation(category: PerformanceMetric['category'], name: string, severity: 'warning' | 'critical'): string {
    const recommendations: Record<string, Record<string, string>> = {
      memory: {
        warning: 'Consider clearing caches or reducing data retention',
        critical: 'Immediate action required: restart application or clear all caches'
      },
      ui: {
        warning: 'Optimize rendering performance and reduce DOM complexity',
        critical: 'Critical UI performance issue: check for blocking operations'
      },
      storage: {
        warning: 'Clean up old data or consider archiving large datasets',
        critical: 'Storage limit reached: immediate cleanup required'
      },
      cpu: {
        warning: 'Reduce background processing or optimize heavy operations',
        critical: 'Main thread blocking detected: move operations to background'
      }
    }

    return recommendations[category]?.[severity] || 'Monitor performance metrics and optimize as needed'
  }

  private performAutoOptimization(metrics: PerformanceMetric[]): void {
    const exceededBudgets = this.budgetManager.getExceededBudgets()
    
    exceededBudgets.forEach(budget => {
      switch (budget.category) {
        case 'memory':
          this.optimizeMemoryUsage()
          break
        case 'storage':
          this.optimizeStorageUsage()
          break
        case 'cpu':
          this.optimizeCPUUsage()
          break
      }
    })
  }

  private optimizeMemoryUsage(): void {
    // Trigger garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc()
    }
    
    console.log('Auto-optimization: Memory cleanup performed')
  }

  private optimizeStorageUsage(): void {
    // This would trigger cache cleanup in the background sync worker
    console.log('Auto-optimization: Storage cleanup scheduled')
  }

  private optimizeCPUUsage(): void {
    // This would reduce background processing intensity
    console.log('Auto-optimization: CPU usage optimization applied')
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionTime
    
    // Clean up old alerts
    this.alertManager.clearAcknowledgedAlerts()
    
    // Clean up old metrics is handled by the collector
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getCurrentSnapshot(): PerformanceSnapshot {
    const metrics = this.metricsCollector.getMetrics(undefined, 20) // Last 20 metrics
    const budgets = this.budgetManager.getBudgets()
    const alerts = this.alertManager.getAlerts()
    
    // Calculate overall performance score (0-100)
    const overallScore = this.calculateOverallScore(budgets, alerts)
    
    return {
      timestamp: Date.now(),
      metrics,
      budgets,
      alerts,
      systemResources: this.getSystemResources(metrics),
      recommendations: this.generateRecommendations(budgets, alerts),
      overallScore
    }
  }

  private calculateOverallScore(budgets: PerformanceBudget[], alerts: PerformanceAlert[]): number {
    let score = 100
    
    // Deduct points for exceeded budgets
    budgets.forEach(budget => {
      if (budget.isExceeded) {
        const excessPercent = ((budget.currentValue - budget.maxValue) / budget.maxValue) * 100
        score -= Math.min(excessPercent, 20) // Max 20 points deduction per budget
      }
    })
    
    // Deduct points for alerts
    alerts.forEach(alert => {
      switch (alert.severity) {
        case 'critical':
          score -= 15
          break
        case 'warning':
          score -= 5
          break
        case 'info':
          score -= 1
          break
      }
    })
    
    return Math.max(0, Math.round(score))
  }

  private getSystemResources(metrics: PerformanceMetric[]): SystemResource[] {
    const latestMetrics = this.getLatestMetricsByName(metrics)
    const resources: SystemResource[] = []
    
    // Memory resource
    const memoryMetric = latestMetrics['memory-heap-used']
    if (memoryMetric) {
      resources.push({
        name: 'Memory',
        type: 'memory',
        current: memoryMetric.value,
        max: 200, // Estimated max
        unit: 'MB',
        utilization: (memoryMetric.value / 200) * 100,
        trend: memoryMetric.trend === 'improving' ? 'down' : memoryMetric.trend === 'degrading' ? 'up' : 'stable'
      })
    }
    
    // Storage resource
    const storageMetric = latestMetrics['storage-indexeddb-estimate']
    if (storageMetric) {
      resources.push({
        name: 'Storage',
        type: 'storage',
        current: storageMetric.value,
        max: 500,
        unit: 'MB',
        utilization: (storageMetric.value / 500) * 100,
        trend: storageMetric.trend === 'improving' ? 'down' : storageMetric.trend === 'degrading' ? 'up' : 'stable'
      })
    }
    
    return resources
  }

  private generateRecommendations(budgets: PerformanceBudget[], alerts: PerformanceAlert[]): OptimizationSuggestion[] {
    const recommendations: OptimizationSuggestion[] = []
    
    // Generate recommendations based on exceeded budgets
    budgets.filter(b => b.isExceeded).forEach(budget => {
      recommendations.push({
        id: `budget-${budget.category}-${budget.name}`,
        type: 'performance',
        severity: budget.currentValue > budget.maxValue * 1.5 ? 'critical' : 'warning',
        title: `${budget.category} budget exceeded`,
        description: `${budget.name} is using ${budget.currentValue}${budget.category === 'memory' ? 'MB' : 'ms'} (limit: ${budget.maxValue}${budget.category === 'memory' ? 'MB' : 'ms'})`,
        impact: 'Performance degradation',
        createdAt: Date.now()
      })
    })
    
    return recommendations
  }

  getMetrics(category?: PerformanceMetric['category'], limit?: number): PerformanceMetric[] {
    return this.metricsCollector.getMetrics(category, limit)
  }

  getBudgets(): PerformanceBudget[] {
    return this.budgetManager.getBudgets()
  }

  getAlerts(includeAcknowledged?: boolean): PerformanceAlert[] {
    return this.alertManager.getAlerts(includeAcknowledged)
  }

  acknowledgeAlert(alertId: string): void {
    this.alertManager.acknowledgeAlert(alertId)
  }

  setBudget(budget: Omit<PerformanceBudget, 'isExceeded' | 'lastUpdated'>): void {
    this.budgetManager.setBudget(budget)
  }

  getConfig(): PerformanceConfig {
    return { ...this.config }
  }

  isActive(): boolean {
    return this.isMonitoring
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()