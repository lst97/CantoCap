/**
 * Performance-Optimized Content Hashing Utility
 * 
 * Provides fast content hashing with intelligent caching to eliminate
 * performance bottlenecks in the auto-save system. Uses multiple hash
 * algorithms optimized for different use cases.
 */

import { globalContentHashCache } from './content-hash-cache'

// Hash cache with TTL management
interface HashCacheEntry {
  hash: string
  timestamp: number
  accessCount: number
}

/**
 * High-performance content hash manager with intelligent caching
 */
export class ContentHashManager {
  private static cache = new Map<string, HashCacheEntry>()
  private static readonly CACHE_TTL = 300000 // 5 minutes
  private static readonly MAX_CACHE_SIZE = 1000
  
  /**
   * Calculate optimized hash with caching and algorithm selection
   */
  static async calculateOptimizedHash(
    content: any, 
    options: {
      requiresCrypto?: boolean
      useCache?: boolean
      priority?: 'speed' | 'accuracy'
    } = {}
  ): Promise<string> {
    const { 
      requiresCrypto = false, 
      useCache = true, 
      priority = 'speed' 
    } = options
    
    // Check global cache first for maximum performance
    if (useCache) {
      const cachedHash = globalContentHashCache.get(content)
      if (cachedHash) {
        return cachedHash
      }
    }
    
    // Calculate hash using appropriate algorithm
    const hash = requiresCrypto 
      ? await this.calculateCryptoHash(content)
      : priority === 'speed' 
        ? this.calculateFastHash(content)
        : this.calculateBalancedHash(content)
    
    // Store in global cache for maximum reuse
    if (useCache) {
      globalContentHashCache.set(content, hash)
    }
    
    return hash
  }
  
  /**
   * Ultra-fast hash generation for cache keys and content comparison
   */
  private static generateCacheKey(content: any): string {
    const str = typeof content === 'string' 
      ? content 
      : JSON.stringify(content)
    
    // Use djb2 hash algorithm - very fast
    let hash = 5381
    const maxLength = Math.min(str.length, 1000) // Only hash first 1KB for speed
    
    for (let i = 0; i < maxLength; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i)
    }
    
    // Include full length to handle content size changes
    return `${(hash >>> 0).toString(36)}-${str.length}`
  }
  
  /**
   * Fast non-cryptographic hash for content comparison
   */
  static calculateFastHash(content: any): string {
    const jsonString = JSON.stringify(content)
    
    // FNV-1a hash algorithm - fast and good distribution
    let hash = 2166136261
    for (let i = 0; i < jsonString.length; i++) {
      hash ^= jsonString.charCodeAt(i)
      hash = (hash * 16777619) >>> 0
    }
    
    return hash.toString(36)
  }
  
  /**
   * Balanced hash with better collision resistance
   */
  private static calculateBalancedHash(content: any): string {
    const jsonString = JSON.stringify(content, Object.keys(content).sort())
    
    // xxHash32 inspired algorithm - good balance of speed and quality
    let h32 = 0x9E3779B9 // Prime number seed
    
    for (let i = 0; i < jsonString.length; i += 4) {
      let k = 0
      for (let j = 0; j < 4 && i + j < jsonString.length; j++) {
        k |= jsonString.charCodeAt(i + j) << (j * 8)
      }
      
      k = Math.imul(k, 0xCC9E2D51)
      k = (k << 15) | (k >>> 17)
      k = Math.imul(k, 0x1B873593)
      
      h32 ^= k
      h32 = (h32 << 13) | (h32 >>> 19)
      h32 = Math.imul(h32, 5) + 0xE6546B64
    }
    
    h32 ^= jsonString.length
    h32 ^= h32 >>> 16
    h32 = Math.imul(h32, 0x85EBCA6B)
    h32 ^= h32 >>> 13
    h32 = Math.imul(h32, 0xC2B2AE35)
    h32 ^= h32 >>> 16
    
    return (h32 >>> 0).toString(36)
  }
  
  /**
   * Cryptographic hash for integrity verification
   */
  private static async calculateCryptoHash(content: any): Promise<string> {
    const jsonString = JSON.stringify(content, Object.keys(content).sort())
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder()
        const data = encoder.encode(jsonString)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      } catch {
        // Fallback to balanced hash if crypto fails
        return this.calculateBalancedHash(content)
      }
    }
    
    // Fallback for environments without crypto.subtle
    return this.calculateBalancedHash(content)
  }
  
  /**
   * Cache maintenance - remove old/unused entries
   */
  private static maintainCache(): void {
    const now = Date.now()
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key)
      }
    }
    
    // If still over size limit, remove least recently used
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
  }
  
  /**
   * Clear cache (useful for testing or memory management)
   */
  static clearCache(): void {
    this.cache.clear()
  }
  
  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): {
    size: number
    hitRate: number
    totalAccess: number
    avgAccessCount: number
  } {
    const entries = Array.from(this.cache.values())
    const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0)
    
    return {
      size: this.cache.size,
      hitRate: entries.length > 0 ? totalAccess / entries.length : 0,
      totalAccess,
      avgAccessCount: entries.length > 0 ? totalAccess / entries.length : 0
    }
  }
}

/**
 * Legacy function compatibility - optimized version
 */
export async function calculateContentHash(
  content: any, 
  algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256'
): Promise<string> {
  return ContentHashManager.calculateOptimizedHash(content, {
    requiresCrypto: true,
    useCache: true,
    priority: 'accuracy'
  })
}

/**
 * Fast hash for content comparison (non-cryptographic) - synchronous version
 */
export function calculateFastContentHash(content: any): string {
  // Check cache first
  const cachedHash = globalContentHashCache.get(content)
  if (cachedHash) {
    return cachedHash
  }
  
  // Calculate fast hash synchronously
  const hash = ContentHashManager.calculateFastHash(content)
  
  // Cache result
  globalContentHashCache.set(content, hash)
  
  return hash
}

/**
 * Batch hash calculation for multiple items
 */
export async function calculateBatchHashes(
  items: any[],
  options: {
    requiresCrypto?: boolean
    useCache?: boolean
    batchSize?: number
  } = {}
): Promise<string[]> {
  const { batchSize = 10 } = options
  const results: string[] = []
  
  // Process in batches to avoid blocking
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(item => ContentHashManager.calculateOptimizedHash(item, options))
    )
    results.push(...batchResults)
    
    // Yield to event loop between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  
  return results
}