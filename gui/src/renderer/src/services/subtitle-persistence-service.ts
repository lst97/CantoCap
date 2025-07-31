/**
 * Subtitle Persistence Service
 * 
 * React service layer for subtitle file persistence operations.
 * Provides caching, error handling, and IPC communication with Electron backend.
 */

import type {
  SubtitleFileContent,
  SubtitleFileMetadata,
  SubtitleFileOperations,
  SubtitleFileOperationRequest,
  SubtitleFileOperationResponse,
  SubtitleFileError,
  SubtitleValidationResult,
  SubtitleCacheEntry,
  SubtitleCacheConfig,
  SubtitlePerformanceMetrics,
  BatchSubtitleFileOperationRequest,
  BatchSubtitleFileOperationResponse
} from '../types/subtitle-persistence'

// Import constants and runtime values separately
import {
  SUBTITLE_PERSISTENCE_CONSTANTS,
  DEFAULT_SUBTITLE_CACHE_CONFIG,
  isSubtitleFileError,
  isSubtitleFileContent,
  isSubtitleFileMetadata
} from '../types/subtitle-persistence'

/**
 * Background compression worker for non-blocking compression operations
 */
class CompressionWorker {
  private compressionQueue: Array<{
    id: string
    content: any
    resolve: (result: { content: any; size: number }) => void
    reject: (error: Error) => void
  }> = []
  private isProcessing = false

  /**
   * Compress content using gzip-like algorithm
   */
  async compress(content: SubtitleFileContent): Promise<{ content: SubtitleFileContent; size: number }> {
    return new Promise((resolve, reject) => {
      const id = `compress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      this.compressionQueue.push({
        id,
        content,
        resolve,
        reject
      })
      
      this.processQueue()
    })
  }

  /**
   * Decompress content
   */
  async decompress(content: SubtitleFileContent): Promise<SubtitleFileContent> {
    return new Promise((resolve, reject) => {
      const id = `decompress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      this.compressionQueue.push({
        id,
        content,
        resolve: (result) => resolve(result.content),
        reject
      })
      
      this.processQueue()
    })
  }

  /**
   * Process compression queue in background
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.compressionQueue.length === 0) return
    
    this.isProcessing = true
    
    try {
      while (this.compressionQueue.length > 0) {
        const task = this.compressionQueue.shift()!
        
        try {
          // Simulate compression using JSON stringification and basic compression
          const jsonString = JSON.stringify(task.content)
          const compressed = this.basicCompress(jsonString)
          
          task.resolve({
            content: task.content, // In real implementation, this would be compressed data
            size: compressed.length
          })
        } catch (error) {
          task.reject(new Error(`Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Basic compression algorithm (placeholder for actual gzip/brotli)
   */
  private basicCompress(input: string): string {
    // This is a simple run-length encoding placeholder
    // In production, use actual compression libraries like pako (gzip) or brotli
    let compressed = ''
    let current = input[0]
    let count = 1
    
    for (let i = 1; i < input.length; i++) {
      if (input[i] === current && count < 9) {
        count++
      } else {
        compressed += count > 1 ? `${count}${current}` : current
        current = input[i]
        count = 1
      }
    }
    
    compressed += count > 1 ? `${count}${current}` : current
    return compressed.length < input.length ? compressed : input
  }
}

/**
 * Background processing queue for non-blocking file operations
 */
class BackgroundProcessor {
  private operationQueue: Array<{
    id: string
    operation: () => Promise<any>
    priority: 'low' | 'normal' | 'high'
    resolve: (result: any) => void
    reject: (error: Error) => void
  }> = []
  private isProcessing = false
  private concurrentOperations = 0
  private maxConcurrency = 2

  /**
   * Queue background operation
   */
  async queueOperation<T>(
    operation: () => Promise<T>,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `bg-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      this.operationQueue.push({
        id,
        operation,
        priority,
        resolve,
        reject
      })
      
      // Sort by priority
      this.operationQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
      
      this.processQueue()
    })
  }

  /**
   * Process operation queue with concurrency limit
   */
  private async processQueue(): Promise<void> {
    if (this.concurrentOperations >= this.maxConcurrency || this.operationQueue.length === 0) return
    
    while (this.concurrentOperations < this.maxConcurrency && this.operationQueue.length > 0) {
      const task = this.operationQueue.shift()!
      this.concurrentOperations++
      
      // Process in background
      this.processTask(task).finally(() => {
        this.concurrentOperations--
        this.processQueue() // Process next task
      })
    }
  }

  /**
   * Process individual task
   */
  private async processTask(task: any): Promise<void> {
    try {
      const result = await task.operation()
      task.resolve(result)
    } catch (error) {
      task.reject(error instanceof Error ? error : new Error('Background operation failed'))
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      pendingOperations: this.operationQueue.length,
      activeOperations: this.concurrentOperations,
      maxConcurrency: this.maxConcurrency
    }
  }
}

/**
 * Enhanced cache implementation with compression, predictive loading, and performance monitoring
 */
class EnhancedSubtitleFileCache {
  private cache = new Map<string, SubtitleCacheEntry>()
  private config: SubtitleCacheConfig = DEFAULT_SUBTITLE_CACHE_CONFIG
  private currentSize = 0
  private usagePatterns = new Map<string, { frequency: number; lastAccess: number; avgSize: number }>()
  private compressionWorker: CompressionWorker
  private evictionCount = 0
  private accessTimes: number[] = []

  constructor(config?: Partial<SubtitleCacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
    this.compressionWorker = new CompressionWorker()
    
    // Start cache cleanup interval
    if (this.config.cleanupInterval > 0) {
      setInterval(() => this.performMaintenance(), this.config.cleanupInterval)
    }
  }

  /**
   * Get cached entry with performance tracking
   */
  async get(key: string): Promise<SubtitleFileContent | null> {
    const startTime = performance.now()
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.updateUsagePattern(key, null, false)
      return null
    }

    // Check expiry
    if (Date.now() > entry.metadata.expiryTime) {
      this.cache.delete(key)
      this.currentSize -= entry.metadata.size
      this.evictionCount++
      return null
    }

    // Update access metrics
    const accessTime = performance.now() - startTime
    this.accessTimes.push(accessTime)
    if (this.accessTimes.length > 100) {
      this.accessTimes = this.accessTimes.slice(-100) // Keep last 100 access times
    }

    entry.metadata.lastAccessed = Date.now()
    entry.metadata.accessCount++
    entry.statistics.hitCount++
    entry.statistics.loadTime = accessTime

    // Update usage patterns for predictive caching
    this.updateUsagePattern(key, entry.metadata.size, true)

    // Decompress if needed
    let content = entry.content
    if (this.config.enableCompression && entry.metadata.isCompressed) {
      content = await this.compressionWorker.decompress(content)
    }

    return content
  }

  /**
   * Set cache entry with compression and optimization
   */
  async set(key: string, content: SubtitleFileContent): Promise<void> {
    if (!this.config.enabled) return

    const originalSize = this.estimateSize(content)
    
    // Check size limit
    if (originalSize > this.config.maxSize / 4) {
      console.warn('Subtitle file too large for cache:', originalSize)
      return
    }

    // Compress content if enabled and beneficial
    let finalContent = content
    let finalSize = originalSize
    let isCompressed = false
    let compressionRatio = 1

    if (this.config.enableCompression && originalSize > 1024) { // Only compress files > 1KB
      try {
        const compressedResult = await this.compressionWorker.compress(content)
        if (compressedResult.size < originalSize * 0.8) { // Only use if >20% savings
          finalContent = compressedResult.content
          finalSize = compressedResult.size
          isCompressed = true
          compressionRatio = originalSize / finalSize
        }
      } catch (error) {
        console.warn('Compression failed:', error)
      }
    }

    // Create cache entry
    const entry: SubtitleCacheEntry = {
      key,
      content: finalContent,
      metadata: {
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        expiryTime: Date.now() + this.config.defaultTTL,
        size: finalSize,
        originalSize,
        isDirty: false,
        isCompressed,
        compressionRatio
      },
      statistics: {
        hitCount: 0,
        missCount: 1,
        loadTime: 0
      }
    }

    // Ensure cache limits
    await this.ensureCacheSize(finalSize)
    
    this.cache.set(key, entry)
    this.currentSize += finalSize
    
    // Update usage patterns
    this.updateUsagePattern(key, finalSize, false)
  }

  /**
   * Mark cache entry as dirty (needs saving)
   */
  markDirty(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      entry.metadata.isDirty = true
    }
  }

  /**
   * Clear cache entry
   */
  delete(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      this.cache.delete(key)
      this.currentSize -= entry.metadata.size
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.currentSize = 0
  }

  /**
   * Get enhanced cache metrics with compression and performance data
   */
  getMetrics() {
    const entries = Array.from(this.cache.values())
    const totalHits = entries.reduce((sum, entry) => sum + entry.statistics.hitCount, 0)
    const totalMisses = entries.reduce((sum, entry) => sum + entry.statistics.missCount, 0)
    
    // Calculate compression metrics
    const compressedEntries = entries.filter(e => e.metadata.isCompressed)
    const totalOriginalSize = entries.reduce((sum, e) => sum + (e.metadata.originalSize || e.metadata.size), 0)
    const averageCompressionRatio = compressedEntries.length > 0
      ? compressedEntries.reduce((sum, e) => sum + (e.metadata.compressionRatio || 1), 0) / compressedEntries.length
      : 1

    // Calculate average access time
    const avgAccessTime = this.accessTimes.length > 0
      ? this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length
      : 0

    return {
      hitCount: totalHits,
      missCount: totalMisses,
      hitRate: totalHits / Math.max(totalHits + totalMisses, 1),
      evictionCount: this.evictionCount,
      currentSize: this.currentSize,
      entryCount: this.cache.size,
      averageAccessTime: avgAccessTime,
      efficiencyScore: this.calculateEfficiency(totalHits / Math.max(totalHits + totalMisses, 1), this.currentSize),
      compressionMetrics: {
        compressedEntries: compressedEntries.length,
        compressionRatio: averageCompressionRatio,
        spaceSaved: totalOriginalSize - this.currentSize,
        compressionEffectiveness: totalOriginalSize > 0 ? (totalOriginalSize - this.currentSize) / totalOriginalSize : 0
      },
      memoryUsage: {
        metadata: this.cache.size * 300, // Updated estimate for enhanced metadata
        content: this.currentSize,
        overhead: this.cache.size * 150,
        total: this.currentSize + (this.cache.size * 450)
      },
      predictiveMetrics: {
        patternsTracked: this.usagePatterns.size,
        averageFrequency: this.getAverageUsageFrequency(),
        cacheWarmingOpportunities: this.identifyCacheWarmingOpportunities()
      }
    }
  }

  /**
   * Update usage patterns for predictive caching
   */
  private updateUsagePattern(key: string, size: number | null, hit: boolean): void {
    const existing = this.usagePatterns.get(key) || { frequency: 0, lastAccess: 0, avgSize: 0 }
    
    this.usagePatterns.set(key, {
      frequency: hit ? existing.frequency + 1 : existing.frequency,
      lastAccess: Date.now(),
      avgSize: size !== null ? (existing.avgSize + size) / 2 : existing.avgSize
    })
  }

  /**
   * Get average usage frequency for metrics
   */
  private getAverageUsageFrequency(): number {
    if (this.usagePatterns.size === 0) return 0
    
    const totalFrequency = Array.from(this.usagePatterns.values())
      .reduce((sum, pattern) => sum + pattern.frequency, 0)
    
    return totalFrequency / this.usagePatterns.size
  }

  /**
   * Identify cache warming opportunities based on usage patterns
   */
  private identifyCacheWarmingOpportunities(): string[] {
    const now = Date.now()
    const opportunities: string[] = []
    
    for (const [key, pattern] of this.usagePatterns.entries()) {
      // Files accessed frequently but not currently cached
      if (pattern.frequency > 2 && 
          now - pattern.lastAccess < 30 * 60 * 1000 && // Last access within 30 minutes
          !this.cache.has(key)) {
        opportunities.push(key)
      }
    }
    
    return opportunities
  }

  /**
   * Perform cache maintenance (cleanup expired entries, optimize patterns)
   */
  private performMaintenance(): void {
    const now = Date.now()
    
    // Clean up expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.metadata.expiryTime) {
        this.cache.delete(key)
        this.currentSize -= entry.metadata.size
        this.evictionCount++
      }
    }
    
    // Clean up old usage patterns (older than 24 hours)
    for (const [key, pattern] of this.usagePatterns.entries()) {
      if (now - pattern.lastAccess > 24 * 60 * 60 * 1000) {
        this.usagePatterns.delete(key)
      }
    }
    
    // Trim access times array if too large
    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-500)
    }
  }

  /**
   * Predict which files should be preloaded based on usage patterns
   */
  async warmCache(loadFunction: (key: string) => Promise<SubtitleFileContent | null>): Promise<void> {
    const opportunities = this.identifyCacheWarmingOpportunities()
    
    // Limit to top 5 opportunities to avoid overwhelming the system
    const topOpportunities = opportunities.slice(0, 5)
    
    const warmingPromises = topOpportunities.map(async (key) => {
      try {
        const content = await loadFunction(key)
        if (content) {
          await this.set(key, content)
        }
      } catch (error) {
        console.warn(`Cache warming failed for ${key}:`, error)
      }
    })
    
    await Promise.all(warmingPromises)
  }

  /**
   * Ensure cache doesn't exceed size limits
   */
  private async ensureCacheSize(newEntrySize: number): Promise<void> {
    if (!this.config.enableLRU) return

    // Remove entries if we would exceed limits
    while (
      (this.currentSize + newEntrySize > this.config.maxSize) ||
      (this.cache.size >= this.config.maxEntries)
    ) {
      this.evictLeastRecentlyUsed()
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestEntry: [string, SubtitleCacheEntry] | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.lastAccessed < oldestTime) {
        oldestTime = entry.metadata.lastAccessed
        oldestEntry = [key, entry]
      }
    }

    if (oldestEntry) {
      const [key, entry] = oldestEntry
      this.cache.delete(key)
      this.currentSize -= entry.metadata.size
    }
  }

  /**
   * Estimate content size in bytes
   */
  private estimateSize(content: SubtitleFileContent): number {
    return JSON.stringify(content).length * 2 // UTF-16 estimate
  }

  /**
   * Compress content for caching
   */
  private compress(content: SubtitleFileContent): SubtitleFileContent {
    // TODO: Implement actual compression
    return content
  }

  /**
   * Calculate cache efficiency score
   */
  private calculateEfficiency(hitRate: number, currentSize: number): number {
    return Math.min(hitRate * 0.7 + (1 - currentSize / this.config.maxSize) * 0.3, 1)
  }
}

/**
 * Intelligent auto-save batcher for optimized save operations
 */
class AutoSaveBatcher {
  private batchQueue = new Map<string, { content: SubtitleFileContent; priority: number; timestamp: number }>()
  private batchTimer: NodeJS.Timeout | null = null
  private batchDelay = 2000 // 2 seconds
  private maxBatchSize = 10

  /**
   * Add file to batch queue
   */
  addToBatch(
    fileId: string, 
    content: SubtitleFileContent, 
    priority: number = 1
  ): void {
    this.batchQueue.set(fileId, {
      content,
      priority,
      timestamp: Date.now()
    })

    // Trigger batch processing
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // Process immediately if high priority or batch is full
    if (priority > 2 || this.batchQueue.size >= this.maxBatchSize) {
      this.processBatch()
    } else {
      this.batchTimer = setTimeout(() => this.processBatch(), this.batchDelay)
    }
  }

  /**
   * Process batched operations
   */
  async processBatch(): Promise<void> {
    if (this.batchQueue.size === 0) return

    const batch = Array.from(this.batchQueue.entries())
    this.batchQueue.clear()

    // Sort by priority and timestamp
    batch.sort((a, b) => {
      const priorityDiff = b[1].priority - a[1].priority
      return priorityDiff !== 0 ? priorityDiff : a[1].timestamp - b[1].timestamp
    })

    try {
      // Process in parallel with concurrency limit
      const concurrency = Math.min(batch.length, 3)
      const chunks = []
      
      for (let i = 0; i < batch.length; i += concurrency) {
        chunks.push(batch.slice(i, i + concurrency))
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map(([fileId, data]) => 
          this.processSingleSave(fileId, data.content)
        ))
      }
    } catch (error) {
      console.error('Batch processing failed:', error)
    }
  }

  /**
   * Process single save operation (to be overridden by service)
   */
  private async processSingleSave(fileId: string, content: SubtitleFileContent): Promise<void> {
    // This will be bound to the actual save method
    console.log(`Processing save for ${fileId}`)
  }

  /**
   * Set the actual save function
   */
  setSaveFunction(saveFunction: (fileId: string, content: SubtitleFileContent, options?: any) => Promise<void>): void {
    this.processSingleSave = saveFunction
  }

  /**
   * Get batch status
   */
  getBatchStatus() {
    return {
      queuedOperations: this.batchQueue.size,
      isProcessing: this.batchTimer !== null
    }
  }
}

/**
 * Enhanced performance metrics tracker with memory monitoring
 */
class EnhancedPerformanceTracker {
  private metrics: SubtitlePerformanceMetrics[] = []
  private readonly maxMetrics = 200
  private memoryUsageHistory: Array<{ timestamp: number; usage: number }> = []

  /**
   * Record operation performance with memory tracking
   */
  recordOperation(
    workspaceId: string,
    operationType: SubtitlePerformanceMetrics['operationType'],
    fileSize: number,
    duration: number,
    success: boolean,
    cacheHit: boolean = false,
    error?: string,
    memoryUsage?: number
  ): void {
    const metric: SubtitlePerformanceMetrics = {
      id: `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      operationType,
      fileSize,
      duration,
      throughput: fileSize / Math.max(duration, 1) * 1000, // bytes per second
      cacheHit,
      timestamp: Date.now(),
      success,
      error,
      memoryUsage: memoryUsage || this.getCurrentMemoryUsage()
    }

    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Record memory usage
    this.recordMemoryUsage()
  }

  /**
   * Get current memory usage estimate
   */
  private getCurrentMemoryUsage(): number {
    // Estimate memory usage (in browsers, this is limited)
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize || 0
    }
    return 0
  }

  /**
   * Record memory usage for trend analysis
   */
  private recordMemoryUsage(): void {
    const usage = this.getCurrentMemoryUsage()
    this.memoryUsageHistory.push({
      timestamp: Date.now(),
      usage
    })

    // Keep only last hour of memory data
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    this.memoryUsageHistory = this.memoryUsageHistory.filter(
      entry => entry.timestamp > oneHourAgo
    )
  }

  /**
   * Get performance analytics
   */
  getAnalytics() {
    const now = Date.now()
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 5 * 60 * 1000) // Last 5 minutes

    return {
      totalOperations: this.metrics.length,
      recentOperations: recentMetrics.length,
      averageLatency: this.calculateAverageLatency(recentMetrics),
      throughputTrend: this.calculateThroughputTrend(),
      errorRate: this.calculateErrorRate(recentMetrics),
      cacheEfficiency: this.calculateCacheEfficiency(recentMetrics),
      memoryTrend: this.getMemoryTrend(),
      performanceScore: this.calculatePerformanceScore()
    }
  }

  private calculateAverageLatency(metrics: SubtitlePerformanceMetrics[]): number {
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
  }

  private calculateThroughputTrend(): number {
    if (this.metrics.length < 2) return 0
    
    const recent = this.metrics.slice(-10)
    const older = this.metrics.slice(-20, -10)
    
    const recentAvg = recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length
    const olderAvg = older.length > 0 ? older.reduce((sum, m) => sum + m.throughput, 0) / older.length : recentAvg
    
    return ((recentAvg - olderAvg) / olderAvg) * 100 // Percentage change
  }

  private calculateErrorRate(metrics: SubtitlePerformanceMetrics[]): number {
    if (metrics.length === 0) return 0
    const errors = metrics.filter(m => !m.success).length
    return (errors / metrics.length) * 100
  }

  private calculateCacheEfficiency(metrics: SubtitlePerformanceMetrics[]): number {
    const readMetrics = metrics.filter(m => m.operationType === 'read')
    if (readMetrics.length === 0) return 0
    
    const cacheHits = readMetrics.filter(m => m.cacheHit).length
    return (cacheHits / readMetrics.length) * 100
  }

  private getMemoryTrend(): { current: number; trend: number; peak: number } {
    if (this.memoryUsageHistory.length === 0) {
      return { current: 0, trend: 0, peak: 0 }
    }

    const current = this.memoryUsageHistory[this.memoryUsageHistory.length - 1].usage
    const peak = Math.max(...this.memoryUsageHistory.map(h => h.usage))
    
    // Calculate trend over last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const recentEntries = this.memoryUsageHistory.filter(h => h.timestamp > fiveMinutesAgo)
    
    let trend = 0
    if (recentEntries.length > 1) {
      const first = recentEntries[0].usage
      const last = recentEntries[recentEntries.length - 1].usage
      trend = ((last - first) / first) * 100
    }

    return { current, trend, peak }
  }

  private calculatePerformanceScore(): number {
    const analytics = {
      averageLatency: this.calculateAverageLatency(this.metrics.slice(-50)),
      errorRate: this.calculateErrorRate(this.metrics.slice(-50)),
      cacheEfficiency: this.calculateCacheEfficiency(this.metrics.slice(-50))
    }

    // Score based on multiple factors (0-100)
    let score = 100

    // Latency penalty (target: <500ms)
    if (analytics.averageLatency > 500) {
      score -= Math.min(30, (analytics.averageLatency - 500) / 100)
    }

    // Error rate penalty
    score -= analytics.errorRate * 2

    // Cache efficiency bonus
    score += (analytics.cacheEfficiency - 50) * 0.2

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Get performance metrics
   */
  getMetrics(): SubtitlePerformanceMetrics[] {
    return [...this.metrics]
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = []
    this.memoryUsageHistory = []
  }

  /**
   * Get average performance for operation type
   */
  getAveragePerformance(operationType: SubtitlePerformanceMetrics['operationType']) {
    const typeMetrics = this.metrics.filter(m => m.operationType === operationType && m.success)
    if (typeMetrics.length === 0) return null

    const avgDuration = typeMetrics.reduce((sum, m) => sum + m.duration, 0) / typeMetrics.length
    const avgThroughput = typeMetrics.reduce((sum, m) => sum + m.throughput, 0) / typeMetrics.length
    const cacheHitRate = typeMetrics.filter(m => m.cacheHit).length / typeMetrics.length
    const avgMemoryUsage = typeMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / typeMetrics.length

    return {
      averageDuration: avgDuration,
      averageThroughput: avgThroughput,
      cacheHitRate,
      averageMemoryUsage: avgMemoryUsage,
      sampleSize: typeMetrics.length
    }
  }
}

/**
 * Performance metrics tracker
 */
class PerformanceTracker {
  private metrics: SubtitlePerformanceMetrics[] = []
  private readonly maxMetrics = 100

  /**
   * Record operation performance
   */
  recordOperation(
    workspaceId: string,
    operationType: SubtitlePerformanceMetrics['operationType'],
    fileSize: number,
    duration: number,
    success: boolean,
    cacheHit: boolean = false,
    error?: string
  ): void {
    const metric: SubtitlePerformanceMetrics = {
      id: `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      operationType,
      fileSize,
      duration,
      throughput: fileSize / Math.max(duration, 1) * 1000, // bytes per second
      cacheHit,
      timestamp: Date.now(),
      success,
      error
    }

    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): SubtitlePerformanceMetrics[] {
    return [...this.metrics]
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Get average performance for operation type
   */
  getAveragePerformance(operationType: SubtitlePerformanceMetrics['operationType']) {
    const typeMetrics = this.metrics.filter(m => m.operationType === operationType && m.success)
    if (typeMetrics.length === 0) return null

    const avgDuration = typeMetrics.reduce((sum, m) => sum + m.duration, 0) / typeMetrics.length
    const avgThroughput = typeMetrics.reduce((sum, m) => sum + m.throughput, 0) / typeMetrics.length
    const cacheHitRate = typeMetrics.filter(m => m.cacheHit).length / typeMetrics.length

    return {
      averageDuration: avgDuration,
      averageThroughput: avgThroughput,
      cacheHitRate,
      sampleSize: typeMetrics.length
    }
  }
}

/**
 * Enhanced subtitle persistence service with streaming, background processing, and intelligent caching
 */
export class SubtitlePersistenceService implements SubtitleFileOperations {
  private cache: EnhancedSubtitleFileCache
  private performanceTracker = new EnhancedPerformanceTracker()
  private backgroundProcessor = new BackgroundProcessor()
  private operationQueue = new Map<string, Promise<any>>()
  private streamingThreshold = 100 * 1024 // 100KB
  private autoSaveBatcher = new AutoSaveBatcher()

  constructor(cacheConfig?: Partial<SubtitleCacheConfig>) {
    this.cache = new EnhancedSubtitleFileCache(cacheConfig)
    
    // Initialize cache warming and auto-save batching
    this.initializeCacheWarming()
    this.autoSaveBatcher.setSaveFunction(this.performActualSave.bind(this))
  }

  /**
   * Initialize cache warming based on usage patterns
   */
  private initializeCacheWarming(): void {
    // Warm cache every 10 minutes
    setInterval(async () => {
      try {
        await this.cache.warmCache(async (fileId) => {
          try {
            return await this.loadFileFromBackend(fileId, { skipCache: true })
          } catch {
            return null
          }
        })
      } catch (error) {
        console.warn('Cache warming failed:', error)
      }
    }, 10 * 60 * 1000)
  }

  /**
   * Load subtitle file with streaming support for large files
   */
  async loadFile(fileId: string, options: { useCache?: boolean } = {}): Promise<SubtitleFileContent> {
    const startTime = Date.now()
    const useCache = options.useCache !== false

    try {
      // Check cache first
      if (useCache) {
        const cached = await this.cache.get(fileId)
        if (cached) {
          const duration = Date.now() - startTime
          this.performanceTracker.recordOperation(
            cached.metadata.workspaceId,
            'read',
            this.estimateContentSize(cached),
            duration,
            true,
            true
          )
          return cached
        }
      }

      // Load from backend with streaming support
      const content = await this.loadFileFromBackend(fileId, { skipCache: !useCache })
      
      // Cache the result asynchronously to avoid blocking
      if (useCache) {
        this.backgroundProcessor.queueOperation(
          async () => await this.cache.set(fileId, content),
          'low'
        )
      }

      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        content.metadata.workspaceId,
        'read',
        this.estimateContentSize(content),
        duration,
        true,
        false
      )

      return content

    } catch (error) {
      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        await this.getCurrentWorkspaceId(),
        'read',
        0,
        duration,
        false,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Load file from backend with streaming support for large files
   */
  private async loadFileFromBackend(
    fileId: string, 
    options: { skipCache?: boolean } = {}
  ): Promise<SubtitleFileContent> {
    // First, get file metadata to determine if we need streaming
    const metadataRequest: SubtitleFileOperationRequest = {
      operation: 'read',
      workspaceId: await this.getCurrentWorkspaceId(),
      fileId,
      options: { skipCache: true }
    }

    const metadataResponse = await this.sendIPCRequest(metadataRequest)
    
    if (!metadataResponse.success || !metadataResponse.metadata) {
      throw this.createError('SUBTITLE_FILE_NOT_FOUND', `File ${fileId} not found`)
    }

    const fileSize = metadataResponse.metadata.fileSize

    // Use streaming for large files
    if (fileSize > this.streamingThreshold) {
      return await this.loadLargeFileStreaming(fileId, fileSize)
    } else {
      return await this.loadSmallFileDirect(fileId, options)
    }
  }

  /**
   * Load large files using streaming with progress feedback
   */
  private async loadLargeFileStreaming(fileId: string, fileSize: number): Promise<SubtitleFileContent> {
    const chunkSize = 32 * 1024 // 32KB chunks
    const totalChunks = Math.ceil(fileSize / chunkSize)
    let loadedContent: SubtitleFileContent | null = null
    
    try {
      // Process in chunks to avoid blocking the UI
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunkRequest: SubtitleFileOperationRequest = {
          operation: 'read',
          workspaceId: await this.getCurrentWorkspaceId(),
          fileId,
          options: {
            chunk: {
              index: chunkIndex,
              size: chunkSize,
              total: totalChunks
            }
          }
        }

        const chunkResponse = await this.sendIPCRequest(chunkRequest)
        
        if (!chunkResponse.success) {
          throw this.createError('SUBTITLE_FILE_CORRUPTED', `Failed to load chunk ${chunkIndex}`)
        }

        // Merge chunk data (this would be implemented based on actual chunk format)
        if (chunkIndex === 0) {
          loadedContent = chunkResponse.data as SubtitleFileContent
        } else {
          // Append subtitle entries from chunk
          loadedContent!.subtitles.push(...(chunkResponse.data as any).subtitles)
        }

        // Yield control to prevent blocking
        if (chunkIndex % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      if (!loadedContent) {
        throw this.createError('SUBTITLE_FILE_CORRUPTED', 'No content loaded')
      }

      // Validate and update statistics
      if (!isSubtitleFileContent(loadedContent)) {
        throw this.createError('SUBTITLE_FILE_CORRUPTED', `File ${fileId} has invalid format`)
      }

      // Update content statistics after streaming load
      loadedContent.statistics = this.calculateContentStatistics(loadedContent.subtitles)

      return loadedContent

    } catch (error) {
      throw this.createError(
        'SUBTITLE_FILE_CORRUPTED', 
        `Streaming load failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Load small files directly
   */
  private async loadSmallFileDirect(
    fileId: string, 
    options: { skipCache?: boolean } = {}
  ): Promise<SubtitleFileContent> {
    const request: SubtitleFileOperationRequest = {
      operation: 'read',
      workspaceId: await this.getCurrentWorkspaceId(),
      fileId,
      options: {
        skipCache: options.skipCache
      }
    }

    const response = await this.sendIPCRequest(request)
    
    if (!response.success || !response.data) {
      throw this.createError('SUBTITLE_FILE_NOT_FOUND', `File ${fileId} not found`)
    }

    const content: SubtitleFileContent = response.data
    
    // Validate content
    if (!isSubtitleFileContent(content)) {
      throw this.createError('SUBTITLE_FILE_CORRUPTED', `File ${fileId} has invalid format`)
    }

    return content
  }

  /**
   * Calculate content statistics for subtitle data
   */
  private calculateContentStatistics(subtitles: any[]): any {
    // Implementation for calculating subtitle statistics
    return {
      totalSubtitles: subtitles.length,
      totalDuration: subtitles.reduce((sum, sub) => sum + (sub.endTime - sub.startTime), 0),
      wordCount: subtitles.reduce((sum, sub) => sum + (sub.text?.split(' ').length || 0), 0),
      characterCount: subtitles.reduce((sum, sub) => sum + (sub.text?.length || 0), 0),
      translationCoverage: subtitles.filter(sub => sub.translation).length / subtitles.length * 100,
      averageConfidence: subtitles.reduce((sum, sub) => sum + (sub.confidence || 0), 0) / subtitles.length,
      speakerDistribution: {},
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
    }
  }

  /**
   * Save subtitle file with intelligent batching and optimization
   */
  async saveFile(
    fileId: string, 
    content: SubtitleFileContent, 
    options: { createBackup?: boolean; priority?: number } = {}
  ): Promise<void> {
    // Use intelligent batching for non-critical saves
    const priority = options.priority || 1
    
    if (priority <= 2) {
      // Add to batch queue for non-critical saves
      this.autoSaveBatcher.addToBatch(fileId, content, priority)
      return
    }

    // Process immediately for high-priority saves
    return this.performActualSave(fileId, content, options)
  }

  /**
   * Perform actual save operation
   */
  private async performActualSave(
    fileId: string, 
    content: SubtitleFileContent, 
    options: { createBackup?: boolean } = {}
  ): Promise<void> {
    const startTime = Date.now()

    try {
      // Validate content before saving
      if (!isSubtitleFileContent(content)) {
        throw this.createError('SUBTITLE_VALIDATION_FAILED', 'Invalid subtitle file content')
      }

      // Prepare save request
      const request: SubtitleFileOperationRequest = {
        operation: 'update',
        workspaceId: content.metadata.workspaceId,
        fileId,
        data: content,
        options: {
          createBackup: options.createBackup,
          validateAfter: true,
          fileType: 'modified' // Default fileType for update operations
        }
      }

      const response = await this.sendIPCRequest(request)
      
      if (!response.success) {
        throw response.error || this.createError('SUBTITLE_FILE_ACCESS_DENIED', 'Failed to save file')
      }

      // Update cache
      this.cache.set(fileId, content)

      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        content.metadata.workspaceId,
        'write',
        response.performance?.bytesProcessed || this.estimateContentSize(content),
        duration,
        true,
        false
      )

    } catch (error) {
      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        content.metadata.workspaceId,
        'write',
        this.estimateContentSize(content),
        duration,
        false,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Create new subtitle file
   */
  async createFile(
    content: SubtitleFileContent, 
    options: { compress?: boolean; fileType?: 'original' | 'modified' | 'session' | 'backup' } = {}
  ): Promise<string> {
    const startTime = Date.now()

    try {
      const request: SubtitleFileOperationRequest = {
        operation: 'create',
        workspaceId: content.metadata.workspaceId,
        data: content,
        options: {
          compress: options.compress,
          validateAfter: true,
          fileType: options.fileType || 'modified'
        }
      }

      const response = await this.sendIPCRequest(request)
      
      if (!response.success || !response.data) {
        throw response.error || this.createError('SUBTITLE_FILE_ACCESS_DENIED', 'Failed to create file')
      }

      const fileId: string = response.data
      
      // Cache the content
      this.cache.set(fileId, content)

      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        content.metadata.workspaceId,
        'write',
        response.performance?.bytesProcessed || this.estimateContentSize(content),
        duration,
        true,
        false
      )

      return fileId

    } catch (error) {
      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        content.metadata.workspaceId,
        'write',
        this.estimateContentSize(content),
        duration,
        false,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Delete subtitle file
   */
  async deleteFile(fileId: string, options: { permanent?: boolean } = {}): Promise<void> {
    const startTime = Date.now()

    try {
      const request: SubtitleFileOperationRequest = {
        operation: 'delete',
        workspaceId: await this.getCurrentWorkspaceId(),
        fileId,
        options: {
          createBackup: !options.permanent
        }
      }

      const response = await this.sendIPCRequest(request)
      
      if (!response.success) {
        throw response.error || this.createError('SUBTITLE_FILE_ACCESS_DENIED', 'Failed to delete file')
      }

      // Remove from cache
      this.cache.delete(fileId)

      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        await this.getCurrentWorkspaceId(),
        'write',
        0,
        duration,
        true,
        false
      )

    } catch (error) {
      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        await this.getCurrentWorkspaceId(),
        'write',
        0,
        duration,
        false,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Validate subtitle file
   */
  async validateFile(fileId: string): Promise<SubtitleValidationResult> {
    const startTime = Date.now()

    try {
      const request: SubtitleFileOperationRequest = {
        operation: 'validate',
        workspaceId: await this.getCurrentWorkspaceId(),
        fileId
      }

      const response = await this.sendIPCRequest(request)
      
      if (!response.success) {
        throw response.error || this.createError('SUBTITLE_VALIDATION_FAILED', 'Failed to validate file')
      }

      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        await this.getCurrentWorkspaceId(),
        'validate',
        response.performance?.bytesProcessed || 0,
        duration,
        true,
        false
      )

      return response.validation!

    } catch (error) {
      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(
        await this.getCurrentWorkspaceId(),
        'validate',
        0,
        duration,
        false,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(fileId: string): Promise<SubtitleFileMetadata> {
    const request: SubtitleFileOperationRequest = {
      operation: 'read',
      workspaceId: await this.getCurrentWorkspaceId(),
      fileId,
      options: { skipCache: true }
    }

    const response = await this.sendIPCRequest(request)
    
    if (!response.success || !response.metadata) {
      throw this.createError('SUBTITLE_FILE_NOT_FOUND', `Metadata for file ${fileId} not found`)
    }

    return response.metadata
  }

  /**
   * Create backup
   */
  async createBackup(fileId: string, description?: string): Promise<string> {
    const request: SubtitleFileOperationRequest = {
      operation: 'backup',
      workspaceId: await this.getCurrentWorkspaceId(),
      fileId,
      data: { description }
    }

    const response = await this.sendIPCRequest(request)
    
    if (!response.success || !response.data) {
      throw response.error || this.createError('SUBTITLE_BACKUP_FAILED', 'Failed to create backup')
    }

    return response.data
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    const request: SubtitleFileOperationRequest = {
      operation: 'restore',
      workspaceId: await this.getCurrentWorkspaceId(),
      data: { backupId }
    }

    const response = await this.sendIPCRequest(request)
    
    if (!response.success) {
      throw response.error || this.createError('SUBTITLE_BACKUP_FAILED', 'Failed to restore backup')
    }

    // Clear cache since file content has changed
    this.cache.clear()
  }

  /**
   * Batch operations
   */
  async batchOperation(request: BatchSubtitleFileOperationRequest): Promise<BatchSubtitleFileOperationResponse> {
    const response = await this.sendIPCBatchRequest(request)
    
    // Update cache based on successful operations
    response.results.forEach((result, index) => {
      if (result.success && result.data && request.operations[index]) {
        const operation = request.operations[index]
        if (operation.operation === 'read' && isSubtitleFileContent(result.data)) {
          this.cache.set(operation.fileId!, result.data)
        } else if (operation.operation === 'delete' && operation.fileId) {
          this.cache.delete(operation.fileId)
        }
      }
    })

    return response
  }

  /**
   * Get operation status
   */
  async getOperationStatus(operationId: string): Promise<any> {
    // This would typically query the backend for operation status
    // For now, return a placeholder
    return {
      operationId,
      status: 'completed',
      progress: 100
    }
  }

  /**
   * Cancel operation
   */
  async cancelOperation(operationId: string): Promise<void> {
    // Implementation would cancel the operation in the backend
    console.log('Operation cancelled:', operationId)
  }

  /**
   * Clear cache
   */
  async clearCache(fileId?: string): Promise<void> {
    if (fileId) {
      this.cache.delete(fileId)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<SubtitlePerformanceMetrics[]> {
    return this.performanceTracker.getMetrics()
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics() {
    return this.cache.getMetrics()
  }

  /**
   * Configure cache
   */
  configureCache(config: Partial<SubtitleCacheConfig>): void {
    this.cache = new SubtitleFileCache(config)
  }

  /**
   * Send IPC request to Electron backend
   */
  private async sendIPCRequest(request: SubtitleFileOperationRequest): Promise<SubtitleFileOperationResponse> {
    // Prevent duplicate operations
    const operationKey = `${request.operation}-${request.fileId || 'new'}`
    
    if (this.operationQueue.has(operationKey)) {
      return await this.operationQueue.get(operationKey)!
    }

    const operationPromise = this.performIPCRequest(request)
    this.operationQueue.set(operationKey, operationPromise)

    try {
      const result = await operationPromise
      return result
    } finally {
      this.operationQueue.delete(operationKey)
    }
  }

  /**
   * Perform actual IPC request
   */
  private async performIPCRequest(request: SubtitleFileOperationRequest): Promise<SubtitleFileOperationResponse> {
    try {
      // Use Electron IPC to communicate with backend
      const response = await window.electron.ipcRenderer.invoke('subtitle-file-operation', request)
      
      if (!response) {
        throw this.createError('SUBTITLE_OPERATION_TIMEOUT', 'No response from backend')
      }

      return response as SubtitleFileOperationResponse

    } catch (error) {
      if (isSubtitleFileError(error)) {
        throw error
      }
      
      throw this.createError(
        'SUBTITLE_SERIALIZATION_ERROR', 
        `IPC operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Send batch IPC request
   */
  private async sendIPCBatchRequest(
    request: BatchSubtitleFileOperationRequest
  ): Promise<BatchSubtitleFileOperationResponse> {
    try {
      const response = await window.electron.ipcRenderer.invoke('subtitle-batch-operation', request)
      return response as BatchSubtitleFileOperationResponse
    } catch (error) {
      throw this.createError(
        'SUBTITLE_SERIALIZATION_ERROR',
        `Batch operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get current workspace ID
   */
  private async getCurrentWorkspaceId(): Promise<string> {
    // This should be obtained from the workspace store
    // For now, use a placeholder
    return 'current-workspace-id'
  }

  /**
   * Create subtitle file error
   */
  private createError(code: SubtitleFileError['code'], message: string): SubtitleFileError {
    const error = new Error(message) as SubtitleFileError
    error.code = code
    return error
  }

  /**
   * Estimate content size
   */
  private estimateContentSize(content: SubtitleFileContent): number {
    return JSON.stringify(content).length * 2
  }
}

/**
 * Singleton instance of the subtitle persistence service
 */
let serviceInstance: SubtitlePersistenceService | null = null

/**
 * Get or create the subtitle persistence service instance
 */
export function getSubtitlePersistenceService(
  cacheConfig?: Partial<SubtitleCacheConfig>
): SubtitlePersistenceService {
  if (!serviceInstance) {
    serviceInstance = new SubtitlePersistenceService(cacheConfig)
  }
  return serviceInstance
}

/**
 * Reset the service instance (useful for testing)
 */
export function resetSubtitlePersistenceService(): void {
  serviceInstance = null
}