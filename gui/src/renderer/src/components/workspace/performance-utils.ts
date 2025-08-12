/**
 * Simplified performance utilities for workspace operations
 * Essential performance monitoring and optimization utilities only
 */

import { useCallback, useRef, useState } from 'react'

// Basic performance monitoring
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map()

  static startMeasurement(operation: string): () => number {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Store measurement (keep last 20 for memory efficiency)
      const existing = this.measurements.get(operation) || []
      existing.push(duration)
      
      if (existing.length > 20) {
        existing.shift()
      }
      
      this.measurements.set(operation, existing)
      
      // Log if operation is slow
      if (duration > 500) {
        console.warn(`⚠️ Slow ${operation}: ${duration.toFixed(2)}ms`)
      }
      
      return duration
    }
  }

  static getAverageTime(operation: string): number {
    const measurements = this.measurements.get(operation) || []
    if (measurements.length === 0) return 0
    
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length
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
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

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

// Fast workspace switching with timeout protection
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
      // Apply timeout to prevent hanging
      await Promise.race([
        switchFn(workspaceId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Switch timeout')), 3000)
        )
      ])

      const duration = measureEnd()
      console.log(`✅ Workspace switch completed in ${duration.toFixed(2)}ms`)
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
    isSwitching
  }
}

// Simple performance debugging
export const PerformanceDebugger = {
  logWorkspaceMetrics: () => {
    const switchTime = PerformanceMonitor.getAverageTime('workspace-switch')
    if (switchTime > 0) {
      console.log(`📊 Average workspace switch: ${switchTime.toFixed(2)}ms`)
    }
  }
}