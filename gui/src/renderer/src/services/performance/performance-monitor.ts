/**
 * Advanced Performance Monitoring System for WorkflowStateManager
 * Comprehensive profiling, benchmarking, and real-time metrics tracking
 * Target: <1ms state transitions, <10ms React re-renders, 90%+ cache hit rate
 */

export interface DetailedPerformanceMetrics {
  // Core transition metrics
  stateTransitionTime: number
  lastTransitionTime: number
  avgTransitionTime: number
  maxTransitionTime: number
  transitionCount: number
  
  // Notification system metrics
  notificationTime: number
  notificationQueueSize: number
  observerCount: number
  notificationLatency: number
  
  // Cache performance
  cacheHitRate: number
  cacheSize: number
  cacheMisses: number
  cacheHits: number
  
  // Memory management
  memoryUsage: number
  objectPoolUtilization: number
  gcPressure: number
  
  // React integration metrics
  rerenderCount: number
  rerenderTime: number
  subscriptionCount: number
  
  // System health
  errorRate: number
  throughput: number
  systemLoad: number
}

export interface PerformanceThresholds {
  maxTransitionTime: number // 1ms target
  maxNotificationTime: number // 5ms target
  minCacheHitRate: number // 90% target
  maxMemoryUsage: number // 50MB target
  maxRerenderTime: number // 10ms target
}

export interface PerformanceBenchmark {
  name: string
  iterations: number
  avgTime: number
  minTime: number
  maxTime: number
  throughput: number
  memoryDelta: number
  timestamp: number
}

/**
 * High-performance metrics collector with minimal overhead
 */
export class PerformanceMonitor {
  private metrics: DetailedPerformanceMetrics
  private thresholds: PerformanceThresholds
  private samples: Array<{ metric: keyof DetailedPerformanceMetrics; value: number; timestamp: number }> = []
  private benchmarks: Map<string, PerformanceBenchmark> = new Map()
  private alerts: Array<{ type: 'warning' | 'critical'; message: string; timestamp: number }> = []
  
  // Performance tracking
  private transitionTimes: number[] = []
  private notificationTimes: number[] = []
  private maxSamples = 1000
  
  // GC monitoring
  private lastMemoryCheck = 0
  private memoryCheckInterval = 5000 // 5 seconds
  
  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = {
      maxTransitionTime: 1, // 1ms
      maxNotificationTime: 5, // 5ms
      minCacheHitRate: 0.9, // 90%
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      maxRerenderTime: 10, // 10ms
      ...thresholds
    }
    
    this.metrics = this.initializeMetrics()
    this.startMonitoring()
  }
  
  private initializeMetrics(): DetailedPerformanceMetrics {
    return {
      stateTransitionTime: 0,
      lastTransitionTime: 0,
      avgTransitionTime: 0,
      maxTransitionTime: 0,
      transitionCount: 0,
      notificationTime: 0,
      notificationQueueSize: 0,
      observerCount: 0,
      notificationLatency: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      cacheMisses: 0,
      cacheHits: 0,
      memoryUsage: 0,
      objectPoolUtilization: 0,
      gcPressure: 0,
      rerenderCount: 0,
      rerenderTime: 0,
      subscriptionCount: 0,
      errorRate: 0,
      throughput: 0,
      systemLoad: 0
    }
  }
  
  /**
   * Start performance monitoring with minimal overhead
   */
  private startMonitoring(): void {
    if (typeof window !== 'undefined' && window.performance) {
      // Monitor GC pressure
      setInterval(() => {
        this.updateMemoryMetrics()
      }, this.memoryCheckInterval)
      
      // Monitor frame rate and system load
      this.monitorFrameRate()
    }
  }
  
  /**
   * Measure operation performance with automatic alerting
   */
  measureOperation<T>(
    name: string,
    operation: () => T,
    threshold?: number
  ): { result: T; duration: number } {
    const startTime = performance.now()
    let result: T
    
    try {
      result = operation()
    } catch (error) {
      this.recordError(name, error)
      throw error
    }
    
    const duration = performance.now() - startTime
    this.recordMetric(name, duration)
    
    // Check threshold violations
    if (threshold && duration > threshold) {
      this.addAlert('warning', `${name} exceeded threshold: ${duration.toFixed(2)}ms > ${threshold}ms`)
    }
    
    return { result, duration }
  }
  
  /**
   * Measure async operation performance
   */
  async measureAsyncOperation<T>(
    name: string,
    operation: () => Promise<T>,
    threshold?: number
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now()
    let result: T
    
    try {
      result = await operation()
    } catch (error) {
      this.recordError(name, error)
      throw error
    }
    
    const duration = performance.now() - startTime
    this.recordMetric(name, duration)
    
    if (threshold && duration > threshold) {
      this.addAlert('warning', `${name} exceeded threshold: ${duration.toFixed(2)}ms > ${threshold}ms`)
    }
    
    return { result, duration }
  }
  
  /**
   * Record state transition performance
   */
  recordTransition(duration: number): void {
    this.transitionTimes.push(duration)
    if (this.transitionTimes.length > this.maxSamples) {
      this.transitionTimes.shift()
    }
    
    this.metrics.lastTransitionTime = duration
    this.metrics.transitionCount++
    this.metrics.avgTransitionTime = this.transitionTimes.reduce((a, b) => a + b, 0) / this.transitionTimes.length
    this.metrics.maxTransitionTime = Math.max(this.metrics.maxTransitionTime, duration)
    
    if (duration > this.thresholds.maxTransitionTime) {
      this.addAlert('critical', `State transition exceeded threshold: ${duration.toFixed(2)}ms`)
    }
  }
  
  /**
   * Record notification performance
   */
  recordNotification(duration: number, queueSize: number, observerCount: number): void {
    this.notificationTimes.push(duration)
    if (this.notificationTimes.length > this.maxSamples) {
      this.notificationTimes.shift()
    }
    
    this.metrics.notificationTime = this.notificationTimes.length > 0 
      ? this.notificationTimes.reduce((a, b) => a + b, 0) / this.notificationTimes.length 
      : 0
    this.metrics.notificationQueueSize = queueSize
    this.metrics.observerCount = observerCount
    this.metrics.notificationLatency = duration
    
    if (duration > this.thresholds.maxNotificationTime) {
      this.addAlert('warning', `Notification time exceeded threshold: ${duration.toFixed(2)}ms`)
    }
  }
  
  /**
   * Record cache performance metrics
   */
  recordCacheMetrics(hits: number, misses: number, size: number): void {
    this.metrics.cacheHits = hits
    this.metrics.cacheMisses = misses
    this.metrics.cacheSize = size
    this.metrics.cacheHitRate = hits + misses > 0 ? hits / (hits + misses) : 0
    
    if (this.metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
      this.addAlert('warning', `Cache hit rate below threshold: ${(this.metrics.cacheHitRate * 100).toFixed(1)}%`)
    }
  }
  
  /**
   * Record React re-render metrics
   */
  recordRerender(duration: number): void {
    this.metrics.rerenderCount++
    this.metrics.rerenderTime = duration
    
    if (duration > this.thresholds.maxRerenderTime) {
      this.addAlert('warning', `Re-render time exceeded threshold: ${duration.toFixed(2)}ms`)
    }
  }
  
  /**
   * Update memory usage metrics
   */
  private updateMemoryMetrics(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (window.performance as any).memory
      if (memory) {
        const currentUsage = memory.usedJSHeapSize
        const gcPressure = currentUsage / memory.totalJSHeapSize
        
        this.metrics.memoryUsage = currentUsage
        this.metrics.gcPressure = gcPressure
        
        if (currentUsage > this.thresholds.maxMemoryUsage) {
          this.addAlert('critical', `Memory usage exceeded threshold: ${(currentUsage / 1024 / 1024).toFixed(1)}MB`)
        }
      }
    }
  }
  
  /**
   * Monitor frame rate for system load assessment
   */
  private monitorFrameRate(): void {
    let frameCount = 0
    let lastTime = performance.now()
    
    const updateFrameRate = () => {
      frameCount++
      const currentTime = performance.now()
      
      if (currentTime - lastTime >= 1000) {
        this.metrics.systemLoad = Math.max(0, 1 - (frameCount / 60)) // Ideal 60fps
        frameCount = 0
        lastTime = currentTime
      }
      
      requestAnimationFrame(updateFrameRate)
    }
    
    requestAnimationFrame(updateFrameRate)
  }
  
  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarkSuite(): Promise<Map<string, PerformanceBenchmark>> {
    const benchmarks = new Map<string, PerformanceBenchmark>()
    
    // State transition benchmark
    benchmarks.set('state-transition', await this.benchmarkStateTransition())
    
    // Cache performance benchmark
    benchmarks.set('cache-performance', await this.benchmarkCachePerformance())
    
    // Observer notification benchmark
    benchmarks.set('observer-notification', await this.benchmarkObserverNotification())
    
    // Memory allocation benchmark
    benchmarks.set('memory-allocation', await this.benchmarkMemoryAllocation())
    
    this.benchmarks = benchmarks
    return benchmarks
  }
  
  /**
   * Benchmark state transition performance
   */
  private async benchmarkStateTransition(): Promise<PerformanceBenchmark> {
    const iterations = 1000
    const times: number[] = []
    const startMemory = this.getCurrentMemoryUsage()
    
    for (let i = 0; i < iterations; i++) {
      const { duration } = this.measureOperation('transition-benchmark', () => {
        // Simulate state transition logic
        const state = { id: `step-${i}`, value: Math.random() }
        return JSON.parse(JSON.stringify(state))
      })
      times.push(duration)
    }
    
    const endMemory = this.getCurrentMemoryUsage()
    
    return {
      name: 'State Transition',
      iterations,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      throughput: iterations / (times.reduce((a, b) => a + b, 0) / 1000),
      memoryDelta: endMemory - startMemory,
      timestamp: Date.now()
    }
  }
  
  /**
   * Benchmark cache performance
   */
  private async benchmarkCachePerformance(): Promise<PerformanceBenchmark> {
    const cache = new Map<string, any>()
    const iterations = 5000
    const times: number[] = []
    let hits = 0
    
    // Pre-populate cache
    for (let i = 0; i < 100; i++) {
      cache.set(`key-${i}`, { value: i })
    }
    
    for (let i = 0; i < iterations; i++) {
      const key = `key-${i % 150}` // 66% hit rate
      const { duration } = this.measureOperation('cache-benchmark', () => {
        if (cache.has(key)) {
          hits++
          return cache.get(key)
        } else {
          const value = { value: i }
          cache.set(key, value)
          return value
        }
      })
      times.push(duration)
    }
    
    return {
      name: 'Cache Performance',
      iterations,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      throughput: iterations / (times.reduce((a, b) => a + b, 0) / 1000),
      memoryDelta: 0,
      timestamp: Date.now()
    }
  }
  
  /**
   * Benchmark observer notification performance
   */
  private async benchmarkObserverNotification(): Promise<PerformanceBenchmark> {
    const observers: Array<() => void> = []
    const iterations = 1000
    const times: number[] = []
    
    // Create observers
    for (let i = 0; i < 100; i++) {
      observers.push(() => {
        // Simulate observer work
        Math.random()
      })
    }
    
    for (let i = 0; i < iterations; i++) {
      const { duration } = this.measureOperation('notification-benchmark', () => {
        observers.forEach(observer => observer())
      })
      times.push(duration)
    }
    
    return {
      name: 'Observer Notification',
      iterations,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      throughput: iterations / (times.reduce((a, b) => a + b, 0) / 1000),
      memoryDelta: 0,
      timestamp: Date.now()
    }
  }
  
  /**
   * Benchmark memory allocation performance
   */
  private async benchmarkMemoryAllocation(): Promise<PerformanceBenchmark> {
    const iterations = 1000
    const times: number[] = []
    const startMemory = this.getCurrentMemoryUsage()
    
    for (let i = 0; i < iterations; i++) {
      const { duration } = this.measureOperation('memory-benchmark', () => {
        // Simulate object creation and cleanup
        const objects = []
        for (let j = 0; j < 100; j++) {
          objects.push({
            id: `obj-${j}`,
            data: new Array(100).fill(Math.random()),
            metadata: { created: Date.now(), index: j }
          })
        }
        return objects.length
      })
      times.push(duration)
    }
    
    const endMemory = this.getCurrentMemoryUsage()
    
    return {
      name: 'Memory Allocation',
      iterations,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      throughput: iterations / (times.reduce((a, b) => a + b, 0) / 1000),
      memoryDelta: endMemory - startMemory,
      timestamp: Date.now()
    }
  }
  
  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (window.performance as any).memory
      return memory ? memory.usedJSHeapSize : 0
    }
    return 0
  }
  
  /**
   * Record metric sample
   */
  private recordMetric(name: string, value: number): void {
    this.samples.push({
      metric: name as keyof DetailedPerformanceMetrics,
      value,
      timestamp: Date.now()
    })
    
    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }
  
  /**
   * Record error for error rate calculation
   */
  private recordError(operation: string, error: unknown): void {
    this.addAlert('critical', `Error in ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    // Update error rate
    const recentSamples = this.samples.filter(s => Date.now() - s.timestamp < 60000) // Last minute
    const errorCount = this.alerts.filter(a => Date.now() - a.timestamp < 60000).length
    this.metrics.errorRate = recentSamples.length > 0 ? errorCount / recentSamples.length : 0
  }
  
  /**
   * Add performance alert
   */
  private addAlert(type: 'warning' | 'critical', message: string): void {
    this.alerts.push({ type, message, timestamp: Date.now() })
    
    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts.shift()
    }
    
    console.warn(`🚨 Performance Alert [${type}]: ${message}`)
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics(): Readonly<DetailedPerformanceMetrics> {
    this.updateMemoryMetrics()
    return { ...this.metrics }
  }
  
  /**
   * Get performance alerts
   */
  getAlerts(): Array<{ type: 'warning' | 'critical'; message: string; timestamp: number }> {
    return [...this.alerts]
  }
  
  /**
   * Get benchmark results
   */
  getBenchmarks(): Map<string, PerformanceBenchmark> {
    return new Map(this.benchmarks)
  }
  
  /**
   * Clear all performance data
   */
  clear(): void {
    this.metrics = this.initializeMetrics()
    this.samples = []
    this.alerts = []
    this.transitionTimes = []
    this.notificationTimes = []
  }
  
  /**
   * Generate performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics()
    const alerts = this.getAlerts()
    const benchmarks = this.getBenchmarks()
    
    return `
🚀 WorkflowStateManager Performance Report
========================================

📊 Core Metrics:
- State Transition Time: ${metrics.lastTransitionTime.toFixed(2)}ms (avg: ${metrics.avgTransitionTime.toFixed(2)}ms, max: ${metrics.maxTransitionTime.toFixed(2)}ms)
- Notification Time: ${metrics.notificationTime.toFixed(2)}ms
- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
- Re-render Count: ${metrics.rerenderCount}
- Observer Count: ${metrics.observerCount}

⚠️ Alerts (${alerts.length}):
${alerts.slice(-5).map(alert => `- [${alert.type.toUpperCase()}] ${alert.message}`).join('\n')}

🏆 Benchmarks:
${Array.from(benchmarks.values()).map(bench => 
  `- ${bench.name}: ${bench.avgTime.toFixed(2)}ms avg (${bench.throughput.toFixed(0)} ops/sec)`
).join('\n')}

✅ Performance Targets:
- State Transition: ${metrics.avgTransitionTime <= this.thresholds.maxTransitionTime ? '✅' : '❌'} ${metrics.avgTransitionTime.toFixed(2)}ms / ${this.thresholds.maxTransitionTime}ms
- Cache Hit Rate: ${metrics.cacheHitRate >= this.thresholds.minCacheHitRate ? '✅' : '❌'} ${(metrics.cacheHitRate * 100).toFixed(1)}% / ${(this.thresholds.minCacheHitRate * 100).toFixed(0)}%
- Memory Usage: ${metrics.memoryUsage <= this.thresholds.maxMemoryUsage ? '✅' : '❌'} ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB / ${(this.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(0)}MB
`
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor()