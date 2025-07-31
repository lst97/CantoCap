/**
 * Performance utilities for workspace operations
 * Ensures <500ms workspace switching and optimizes UI responsiveness
 */

import { useCallback, useRef, useState, useEffect } from 'react'

// Performance monitoring utilities
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map()

  static startMeasurement(operation: string): () => number {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Store measurement
      const existing = this.measurements.get(operation) || []
      existing.push(duration)
      
      // Keep only last 50 measurements
      if (existing.length > 50) {
        existing.shift()
      }
      
      this.measurements.set(operation, existing)
      
      // Log if exceeds target
      if (operation === 'workspace-switch' && duration > 500) {
        console.warn(`⚠️ Workspace switching exceeded 500ms target: ${duration.toFixed(2)}ms`)
      }
      
      return duration
    }
  }

  static getAverageTime(operation: string): number {
    const measurements = this.measurements.get(operation) || []
    if (measurements.length === 0) return 0
    
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length
  }

  static getMetrics(operation: string) {
    const measurements = this.measurements.get(operation) || []
    if (measurements.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, p95: 0 }
    }

    const sorted = [...measurements].sort((a, b) => a - b)
    const count = measurements.length
    const average = measurements.reduce((sum, time) => sum + time, 0) / count
    const min = sorted[0]
    const max = sorted[count - 1]
    const p95Index = Math.floor(count * 0.95)
    const p95 = sorted[p95Index]

    return { count, average, min, max, p95 }
  }

  static getAllMetrics() {
    const results: Record<string, any> = {}
    
    for (const [operation] of this.measurements) {
      results[operation] = this.getMetrics(operation)
    }
    
    return results
  }

  static clear() {
    this.measurements.clear()
  }
}

// Debounced operation utility
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )
}

// Optimistic UI update hook
export function useOptimisticUpdate<T>(
  currentValue: T,
  updateFn: (newValue: T) => Promise<void>
) {
  const [optimisticValue, setOptimisticValue] = useState(currentValue)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setOptimisticValue(currentValue)
  }, [currentValue])

  const update = useCallback(async (newValue: T) => {
    // Immediately update UI
    setOptimisticValue(newValue)
    setIsUpdating(true)
    setError(null)

    try {
      await updateFn(newValue)
    } catch (err) {
      // Revert on error
      setOptimisticValue(currentValue)
      setError(err as Error)
    } finally {
      setIsUpdating(false)
    }
  }, [currentValue, updateFn])

  return {
    value: optimisticValue,
    isUpdating,
    error,
    update
  }
}

// Batch operations to reduce re-renders
export function useBatchedUpdates() {
  const [isBatching, setIsBatching] = useState(false)
  const batchedUpdates = useRef<(() => void)[]>([])

  const addUpdate = useCallback((update: () => void) => {
    batchedUpdates.current.push(update)
    
    if (!isBatching) {
      setIsBatching(true)
      
      // Use requestAnimationFrame for optimal batching
      requestAnimationFrame(() => {
        const updates = batchedUpdates.current
        batchedUpdates.current = []
        
        // Execute all updates in a single batch
        updates.forEach(update => update())
        setIsBatching(false)
      })
    }
  }, [isBatching])

  return { addUpdate, isBatching }
}

// Workspace switching optimization
export function useFastWorkspaceSwitch() {
  const switchingRef = useRef<string | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)

  const fastSwitch = useCallback(async (
    workspaceId: string,
    switchFn: (id: string) => Promise<void>
  ) => {
    // Prevent concurrent switches
    if (switchingRef.current) {
      console.warn('Workspace switch already in progress, ignoring')
      return
    }

    switchingRef.current = workspaceId
    setIsSwitching(true)

    const measureEnd = PerformanceMonitor.startMeasurement('workspace-switch')

    try {
      // Preload workspace data if possible
      await Promise.race([
        switchFn(workspaceId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Switch timeout')), 2000)
        )
      ])

      const duration = measureEnd()
      
      if (duration > 500) {
        console.warn(`Workspace switch took ${duration.toFixed(2)}ms (target: <500ms)`)
      } else {
        console.log(`✅ Workspace switch completed in ${duration.toFixed(2)}ms`)
      }
    } catch (error) {
      measureEnd()
      throw error
    } finally {
      switchingRef.current = null
      setIsSwitching(false)
    }
  }, [])

  return {
    fastSwitch,
    isSwitching,
    currentlySwitchingTo: switchingRef.current
  }
}

// Memory optimization for workspace lists
export function useVirtualizedWorkspaces<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0)
  
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.floor(scrollTop / itemHeight)
  const endIndex = Math.min(startIndex + visibleCount, items.length)
  
  const visibleItems = items.slice(startIndex, endIndex)
  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (event: React.UIEvent<HTMLElement>) => {
      setScrollTop(event.currentTarget.scrollTop)
    }
  }
}

// Workspace data preloading
export class WorkspacePreloader {
  private static cache = new Map<string, any>()
  private static prefetchQueue = new Set<string>()

  static async prefetchWorkspace(workspaceId: string, loader: () => Promise<any>) {
    if (this.cache.has(workspaceId) || this.prefetchQueue.has(workspaceId)) {
      return
    }

    this.prefetchQueue.add(workspaceId)

    try {
      const data = await loader()
      this.cache.set(workspaceId, data)
    } catch (error) {
      console.warn(`Failed to prefetch workspace ${workspaceId}:`, error)
    } finally {
      this.prefetchQueue.delete(workspaceId)
    }
  }

  static getCached(workspaceId: string) {
    return this.cache.get(workspaceId)
  }

  static clear() {
    this.cache.clear()
    this.prefetchQueue.clear()
  }

  static getStats() {
    return {
      cacheSize: this.cache.size,
      prefetchingCount: this.prefetchQueue.size
    }
  }
}

// Performance debugging utilities
export const PerformanceDebugger = {
  logWorkspaceMetrics: () => {
    const metrics = PerformanceMonitor.getAllMetrics()
    console.group('📊 Workspace Performance Metrics')
    
    Object.entries(metrics).forEach(([operation, stats]) => {
      console.log(`${operation}:`, {
        'Average': `${stats.average.toFixed(2)}ms`,
        'P95': `${stats.p95.toFixed(2)}ms`,
        'Count': stats.count,
        'Min/Max': `${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms`
      })
    })
    
    console.groupEnd()
  },

  logPreloaderStats: () => {
    const stats = WorkspacePreloader.getStats()
    console.log('🚀 Workspace Preloader Stats:', stats)
  },

  startContinuousMonitoring: (intervalMs = 30000) => {
    const interval = setInterval(() => {
      const switchMetrics = PerformanceMonitor.getMetrics('workspace-switch')
      if (switchMetrics.count > 0 && switchMetrics.average > 400) {
        console.warn(`⚠️ Workspace switching performance degraded: ${switchMetrics.average.toFixed(2)}ms average`)
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }
}