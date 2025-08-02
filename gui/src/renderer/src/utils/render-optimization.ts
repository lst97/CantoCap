/**
 * Render Optimization Utilities
 * Provides tools to reduce unnecessary re-renders and batch state updates for better performance
 */

import { unstable_batchedUpdates } from 'react-dom'

/**
 * Batch multiple React state updates to prevent unnecessary re-renders
 * Uses React's internal batching mechanism for optimal performance
 */
export const batchReactUpdates = <T>(callback: () => T): T => {
  return unstable_batchedUpdates(callback)
}

/**
 * Debounce function calls to prevent rapid successive executions
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      func.apply(null, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Create a batched version of a state update function
 * Useful for components that might trigger multiple state updates
 */
export const createBatchedUpdater = <T>(
  updateFunction: (value: T) => void,
  delay: number = 16 // ~1 frame at 60fps
) => {
  const debouncedUpdate = debounce(updateFunction, delay)
  
  return (value: T) => {
    batchReactUpdates(() => {
      debouncedUpdate(value)
    })
  }
}

/**
 * Performance monitoring for render optimization
 */
export class RenderPerformanceMonitor {
  private renderCounts = new Map<string, number>()
  private renderTimes = new Map<string, number[]>()
  
  startRender(componentName: string): number {
    const startTime = performance.now()
    const currentCount = this.renderCounts.get(componentName) || 0
    this.renderCounts.set(componentName, currentCount + 1)
    return startTime
  }
  
  endRender(componentName: string, startTime: number): void {
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    const times = this.renderTimes.get(componentName) || []
    times.push(renderTime)
    
    // Keep only last 100 render times
    if (times.length > 100) {
      times.shift()
    }
    
    this.renderTimes.set(componentName, times)
    
    // Log slow renders
    if (renderTime > 16) { // Slower than 60fps
      console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`)
    }
  }
  
  getStats(componentName: string) {
    const count = this.renderCounts.get(componentName) || 0
    const times = this.renderTimes.get(componentName) || []
    
    if (times.length === 0) {
      return { count, avgTime: 0, maxTime: 0, totalTime: 0 }
    }
    
    const totalTime = times.reduce((sum, time) => sum + time, 0)
    const avgTime = totalTime / times.length
    const maxTime = Math.max(...times)
    
    return { count, avgTime, maxTime, totalTime }
  }
  
  getAllStats() {
    const stats: Record<string, any> = {}
    
    for (const [componentName] of this.renderCounts) {
      stats[componentName] = this.getStats(componentName)
    }
    
    return stats
  }
  
  reset() {
    this.renderCounts.clear()
    this.renderTimes.clear()
  }
}

// Global performance monitor instance
export const renderMonitor = new RenderPerformanceMonitor()

/**
 * React hook for monitoring component render performance
 */
export const useRenderMonitor = (componentName: string) => {
  const startTime = renderMonitor.startRender(componentName)
  
  // Schedule end measurement after render completes
  React.useEffect(() => {
    renderMonitor.endRender(componentName, startTime)
  })
  
  return renderMonitor.getStats(componentName)
}

// Import React for the hook
import * as React from 'react'