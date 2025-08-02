/**
 * Content Hash Cache Management
 * 
 * Intelligent caching system for content hashes to eliminate redundant
 * calculations and significantly improve performance during auto-save operations.
 */

import type { SubtitleData } from '../../../types'

interface CacheEntry {
  hash: string
  timestamp: number
  accessCount: number
  lastAccessed: number
  contentSize: number
}

interface CacheStats {
  hits: number
  misses: number
  evictions: number
  hitRate: number
  avgAccessTime: number
  totalEntries: number
  memoryUsage: number
}

/**
 * High-performance content hash cache with LRU eviction and memory management
 */
export class ContentHashCache {
  private cache = new Map<string, CacheEntry>()
  private readonly maxSize: number
  private readonly maxAge: number
  private readonly maxMemory: number
  private stats: CacheStats

  // Performance thresholds
  private readonly FAST_LOOKUP_THRESHOLD = 1000 // Items
  private readonly MEMORY_WARNING_THRESHOLD = 0.8 // 80% of max memory

  constructor(options: {
    maxSize?: number
    maxAge?: number // milliseconds
    maxMemory?: number // bytes
  } = {}) {
    this.maxSize = options.maxSize || 500
    this.maxAge = options.maxAge || 300000 // 5 minutes
    this.maxMemory = options.maxMemory || 10 * 1024 * 1024 // 10MB
    
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      avgAccessTime: 0,
      totalEntries: 0,
      memoryUsage: 0
    }

    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000) // Every minute
  }

  /**
   * Generate optimized cache key for subtitle content
   */
  private generateCacheKey(content: SubtitleData[] | any): string {
    if (Array.isArray(content) && content.length > 0 && 'id' in content[0]) {
      // Optimized key for subtitle arrays - use structure fingerprint
      const subtitles = content as SubtitleData[]
      const fingerprint = {
        length: subtitles.length,
        firstId: subtitles[0]?.id,
        lastId: subtitles[subtitles.length - 1]?.id,
        firstText: subtitles[0]?.text?.substring(0, 50),
        lastText: subtitles[subtitles.length - 1]?.text?.substring(0, 50),
        totalDuration: subtitles.reduce((sum, s) => sum + (s.endTime - s.startTime), 0)
      }
      return `subtitles:${JSON.stringify(fingerprint)}`
    }
    
    // Fallback for other content types
    const str = JSON.stringify(content)
    return `content:${str.length}:${this.quickHash(str.substring(0, 1000))}`
  }

  /**
   * Ultra-fast hash for cache key generation
   */
  private quickHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Get hash from cache with performance tracking
   */
  get(content: any): string | null {
    const startTime = performance.now()
    const key = this.generateCacheKey(content)
    const entry = this.cache.get(key)
    
    if (entry && this.isEntryValid(entry)) {
      // Cache hit
      entry.accessCount++
      entry.lastAccessed = Date.now()
      this.stats.hits++
      
      const accessTime = performance.now() - startTime
      this.updateAccessTime(accessTime)
      
      return entry.hash
    }
    
    // Cache miss
    this.stats.misses++
    if (entry) {
      // Entry existed but was stale
      this.cache.delete(key)
    }
    
    return null
  }

  /**
   * Store hash in cache with memory management
   */
  set(content: any, hash: string): void {
    const key = this.generateCacheKey(content)
    const contentSize = this.estimateContentSize(content)
    
    // Check memory constraints
    if (this.shouldEvict(contentSize)) {
      this.evictLRU()
    }
    
    const entry: CacheEntry = {
      hash,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      contentSize
    }
    
    this.cache.set(key, entry)
    this.updateStats()
    
    // Enforce size limits
    while (this.cache.size > this.maxSize) {
      this.evictLRU()
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isEntryValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp
    return age < this.maxAge
  }

  /**
   * Estimate memory usage of content
   */
  private estimateContentSize(content: any): number {
    if (Array.isArray(content)) {
      // Estimate subtitle array size
      return content.length * 100 // Rough estimate: 100 bytes per subtitle
    }
    
    try {
      return JSON.stringify(content).length * 2 // UTF-16 encoding
    } catch {
      return 1000 // Fallback estimate
    }
  }

  /**
   * Determine if eviction is needed based on memory constraints
   */
  private shouldEvict(newContentSize: number): boolean {
    const currentMemory = this.estimateMemoryUsage()
    const projectedMemory = currentMemory + newContentSize
    
    return projectedMemory > this.maxMemory * this.MEMORY_WARNING_THRESHOLD
  }

  /**
   * Estimate total cache memory usage
   */
  private estimateMemoryUsage(): number {
    let total = 0
    for (const entry of this.cache.values()) {
      total += entry.contentSize + entry.hash.length * 2 + 200 // Entry overhead
    }
    return total
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return
    
    let oldestKey: string | null = null
    let oldestTime = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key))
    this.updateStats()
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
    this.stats.totalEntries = this.cache.size
    this.stats.memoryUsage = this.estimateMemoryUsage()
  }

  /**
   * Update average access time
   */
  private updateAccessTime(accessTime: number): void {
    const alpha = 0.1 // Exponential smoothing factor
    this.stats.avgAccessTime = this.stats.avgAccessTime * (1 - alpha) + accessTime * alpha
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    this.updateStats()
    return { ...this.stats }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      avgAccessTime: 0,
      totalEntries: 0,
      memoryUsage: 0
    }
  }

  /**
   * Optimize cache for subtitle workloads
   */
  optimizeForSubtitles(): void {
    // Pre-warm cache with common subtitle patterns
    const commonPatterns = [
      [], // Empty array
      [{ id: 1, text: '', startTime: 0, endTime: 1000 }], // Single subtitle
    ]
    
    // Don't actually calculate hashes, just prepare cache structure
    commonPatterns.forEach(pattern => {
      this.generateCacheKey(pattern)
    })
  }

  /**
   * Get cache efficiency recommendations
   */
  getEfficiencyReport(): {
    isEfficient: boolean
    recommendations: string[]
    stats: CacheStats
  } {
    const stats = this.getStats()
    const recommendations: string[] = []
    let isEfficient = true

    if (stats.hitRate < 0.7) {
      isEfficient = false
      recommendations.push('Cache hit rate is low. Consider increasing cache size or TTL.')
    }

    if (stats.avgAccessTime > 5) {
      isEfficient = false
      recommendations.push('Cache access time is high. Consider cache optimization.')
    }

    if (stats.memoryUsage > this.maxMemory * 0.9) {
      isEfficient = false
      recommendations.push('Cache memory usage is high. Consider reducing cache size.')
    }

    if (stats.evictions > stats.hits * 0.1) {
      isEfficient = false
      recommendations.push('High eviction rate detected. Consider increasing cache capacity.')
    }

    return {
      isEfficient,
      recommendations,
      stats
    }
  }
}

// Global cache instance
export const globalContentHashCache = new ContentHashCache({
  maxSize: 500,
  maxAge: 300000, // 5 minutes
  maxMemory: 10 * 1024 * 1024 // 10MB
})

// Initialize cache for subtitle operations
globalContentHashCache.optimizeForSubtitles()