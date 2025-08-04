// Performance Optimization Hooks - React hooks for performance-aware interactions
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
// REMOVED: auto-save-engine - timer-based auto-save system deleted
import { backgroundSyncCoordinator } from '../workers/background-sync'
import { performanceMonitor } from '../utils/performance-monitor'
// REMOVED: auto-save-engine types - timer-based auto-save system deleted
import type { 
  PerformanceSnapshot,
  PerformanceAlert,
  PerformanceBudget,
  PerformanceMetric
} from '../utils/performance-monitor'
import type { WorkflowStepId } from '../types/workspace'

// ============================================================================
// PERFORMANCE OPTIMIZATION HOOKS
// ============================================================================

/**
 * Main performance optimization hook providing real-time metrics and controls
 */
export function usePerformanceOptimization() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [autoOptimizationEnabled, setAutoOptimizationEnabled] = useState(true)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Start/stop monitoring
  const startMonitoring = useCallback(() => {
    if (!isMonitoring) {
      performanceMonitor.startMonitoring({
        monitoringInterval: 2000,
        enableAutoOptimization: autoOptimizationEnabled
      })
      setIsMonitoring(true)

      // Update snapshot periodically
      updateIntervalRef.current = setInterval(() => {
        setSnapshot(performanceMonitor.getCurrentSnapshot())
      }, 3000) // Update every 3 seconds
    }
  }, [isMonitoring, autoOptimizationEnabled])

  const stopMonitoring = useCallback(() => {
    if (isMonitoring) {
      performanceMonitor.stopMonitoring()
      setIsMonitoring(false)

      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
    }
  }, [isMonitoring])

  // Toggle auto-optimization
  const toggleAutoOptimization = useCallback(() => {
    const newValue = !autoOptimizationEnabled
    setAutoOptimizationEnabled(newValue)
    
    if (isMonitoring) {
      performanceMonitor.configure({ enableAutoOptimization: newValue })
    }
  }, [autoOptimizationEnabled, isMonitoring])

  // Apply optimization suggestion
  const applyOptimization = useCallback(async (suggestionId: string) => {
    try {
      // REMOVED: auto-save-engine - timer-based auto-save system deleted
      console.log('Apply optimization suggestion (no-op):', suggestionId)
      // Refresh snapshot after applying optimization
      setTimeout(() => {
        setSnapshot(performanceMonitor.getCurrentSnapshot())
      }, 1000)
    } catch (error) {
      console.error('Failed to apply optimization:', error)
    }
  }, [])

  // Acknowledge performance alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    performanceMonitor.acknowledgeAlert(alertId)
    setSnapshot(performanceMonitor.getCurrentSnapshot())
  }, [])

  // Set performance budget
  const setBudget = useCallback((budget: Omit<PerformanceBudget, 'isExceeded' | 'lastUpdated'>) => {
    performanceMonitor.setBudget(budget)
    setSnapshot(performanceMonitor.getCurrentSnapshot())
  }, [])

  // Initialize monitoring on mount
  useEffect(() => {
    startMonitoring()
    return () => {
      stopMonitoring()
    }
  }, [startMonitoring, stopMonitoring])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [])

  return {
    snapshot,
    isMonitoring,
    autoOptimizationEnabled,
    startMonitoring,
    stopMonitoring,
    toggleAutoOptimization,
    applyOptimization,
    acknowledgeAlert,
    setBudget
  }
}

/**
 * Hook for auto-save performance monitoring and control
 */
export function useAutoSavePerformance() {
  const [metrics, setMetrics] = useState<AutoSavePerformanceMetrics | null>(null)
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])
  const [isEnabled, setIsEnabled] = useState(true)

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      // REMOVED: auto-save-engine performance metrics
      setMetrics(null)
      setSuggestions([])
    }

    updateMetrics()
    const interval = setInterval(updateMetrics, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Configure auto-save
  const configure = useCallback((config: {
    enabled?: boolean
    debounceMs?: number
    batchSize?: number
    maxRetries?: number
  }) => {
    // REMOVED: autoSaveEngine.configure(config)
    if (config.enabled !== undefined) {
      setIsEnabled(config.enabled)
    }
  }, [])

  // Force flush pending saves
  const flush = useCallback(async () => {
    try {
      // REMOVED: auto-save-engine flush (no-op)
    } catch (error) {
      console.error('Failed to flush auto-save queue:', error)
    }
  }, [])

  // Apply optimization suggestion
  const applyOptimization = useCallback(async (suggestionId: string) => {
    try {
      // REMOVED: auto-save-engine - timer-based auto-save system deleted
      console.log('Apply optimization suggestion (no-op):', suggestionId)
    } catch (error) {
      console.error('Failed to apply auto-save optimization:', error)
    }
  }, [])

  return {
    metrics,
    suggestions,
    isEnabled,
    configure,
    flush,
    applyOptimization
  }
}

/**
 * Hook for performance-aware step configuration management
 */
export function usePerformantStepConfig(workspaceId: string, stepId: WorkflowStepId) {
  const [saveLatency, setSaveLatency] = useState<number>(0)
  const [isOptimized, setIsOptimized] = useState(true)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSaveTimeRef = useRef<number>(0)

  // Performance-aware save function
  const saveConfig = useCallback(async (config: any, priority: 'critical' | 'normal' | 'low' = 'normal') => {
    const startTime = Date.now()
    
    try {
      // REMOVED: auto-save-engine step config save (using event-driven system instead)
      console.log('Schedule step config save (no-op):', workspaceId, stepId)
      
      const latency = Date.now() - startTime
      setSaveLatency(latency)
      lastSaveTimeRef.current = Date.now()
      
      // Update optimization status based on performance
      setIsOptimized(latency < 100) // Sub-100ms is considered optimized
      
    } catch (error) {
      console.error('Failed to save step configuration:', error)
      setIsOptimized(false)
    }
  }, [workspaceId, stepId])

  // Debounced save for frequent updates
  const debouncedSave = useCallback((config: any, debounceMs: number = 1500) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      saveConfig(config, 'normal')
    }, debounceMs)
  }, [saveConfig])

  // Immediate save for critical changes
  const immediateSave = useCallback((config: any) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    return saveConfig(config, 'critical')
  }, [saveConfig])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    saveConfig,
    debouncedSave,
    immediateSave,
    saveLatency,
    isOptimized,
    lastSaveTime: lastSaveTimeRef.current
  }
}

/**
 * Hook for background processing coordination
 */
export function useBackgroundSync() {
  const [workerStats, setWorkerStats] = useState(backgroundSyncCoordinator.getWorkerStats())
  const [isProcessing, setIsProcessing] = useState(false)

  // Update worker stats periodically
  useEffect(() => {
    const updateStats = () => {
      const stats = backgroundSyncCoordinator.getWorkerStats()
      setWorkerStats(stats)
      setIsProcessing(stats.activeThreads > 0)
    }

    updateStats()
    const interval = setInterval(updateStats, 2000) // Update every 2 seconds

    return () => clearInterval(interval)
  }, [])

  // Compress data in background
  const compressData = useCallback(async (data: any, algorithm: 'gzip' | 'lz4' | 'json' = 'json') => {
    try {
      return await backgroundSyncCoordinator.compressData(data, algorithm)
    } catch (error) {
      console.error('Background compression failed:', error)
      throw error
    }
  }, [])

  // Process operations in background
  const processBatch = useCallback(async (operations: SaveOperation[], options = {
    maxConcurrency: 3,
    timeout: 30000,
    retryOnFailure: true
  }) => {
    try {
      return await backgroundSyncCoordinator.processBatch(operations, options)
    } catch (error) {
      console.error('Background batch processing failed:', error)
      throw error
    }
  }, [])

  // Perform background cleanup
  const performCleanup = useCallback(async (options = {
    clearExpiredCache: true,
    compactDatabase: false,
    optimizeMemory: true
  }) => {
    try {
      return await backgroundSyncCoordinator.performCleanup(options)
    } catch (error) {
      console.error('Background cleanup failed:', error)
      throw error
    }
  }, [])

  // Set worker concurrency
  const setConcurrency = useCallback((maxConcurrency: number) => {
    backgroundSyncCoordinator.setMaxConcurrency(maxConcurrency)
  }, [])

  return {
    workerStats,
    isProcessing,
    compressData,
    processBatch,
    performCleanup,
    setConcurrency
  }
}

/**
 * Hook for adaptive performance based on system resources
 */
export function useAdaptivePerformance() {
  const [performanceMode, setPerformanceMode] = useState<'high' | 'balanced' | 'power-saving'>('balanced')
  const [systemLoad, setSystemLoad] = useState({ cpu: 0, memory: 0, storage: 0 })
  
  // Monitor system resources
  useEffect(() => {
    const updateSystemLoad = () => {
      const snapshot = performanceMonitor.getCurrentSnapshot()
      if (snapshot) {
        const resources = snapshot.systemResources
        setSystemLoad({
          cpu: resources.find(r => r.type === 'cpu')?.utilization || 0,
          memory: resources.find(r => r.type === 'memory')?.utilization || 0,
          storage: resources.find(r => r.type === 'storage')?.utilization || 0
        })
      }
    }

    updateSystemLoad()
    const interval = setInterval(updateSystemLoad, 5000)
    return () => clearInterval(interval)
  }, [])

  // Auto-adjust performance mode based on system load
  useEffect(() => {
    const avgLoad = (systemLoad.cpu + systemLoad.memory + systemLoad.storage) / 3
    
    if (avgLoad > 80) {
      setPerformanceMode('power-saving')
    } else if (avgLoad > 50) {
      setPerformanceMode('balanced')
    } else {
      setPerformanceMode('high')
    }
  }, [systemLoad])

  // Get optimized settings based on performance mode
  const getOptimizedSettings = useMemo(() => {
    switch (performanceMode) {
      case 'high':
        return {
          debounceMs: 500,
          batchSize: 8,
          monitoringInterval: 1000,
          maxConcurrency: 5
        }
      case 'balanced':
        return {
          debounceMs: 1500,
          batchSize: 5,
          monitoringInterval: 2000,
          maxConcurrency: 3
        }
      case 'power-saving':
        return {
          debounceMs: 3000,
          batchSize: 3,
          monitoringInterval: 5000,
          maxConcurrency: 2
        }
      default:
        return {
          debounceMs: 1500,
          batchSize: 5,
          monitoringInterval: 2000,
          maxConcurrency: 3
        }
    }
  }, [performanceMode])

  // Apply optimized settings
  const applyOptimizedSettings = useCallback(() => {
    const settings = getOptimizedSettings
    
    // Configure auto-save engine
    // REMOVED: autoSaveEngine.configure({
    //   debounceMs: settings.debounceMs,
    //   batchSize: settings.batchSize
    // })
    
    // Configure performance monitor
    performanceMonitor.configure({
      monitoringInterval: settings.monitoringInterval
    })
    
    // Configure background sync
    backgroundSyncCoordinator.setMaxConcurrency(settings.maxConcurrency)
  }, [getOptimizedSettings])

  // Apply settings when they change
  useEffect(() => {
    applyOptimizedSettings()
  }, [applyOptimizedSettings])

  return {
    performanceMode,
    systemLoad,
    optimizedSettings: getOptimizedSettings,
    applyOptimizedSettings,
    setPerformanceMode
  }
}

/**
 * Hook for performance-aware UI rendering
 */
export function usePerformanceAwareRendering(componentName: string) {
  const [renderCount, setRenderCount] = useState(0)
  const [averageRenderTime, setAverageRenderTime] = useState(0)
  const renderStartTimeRef = useRef<number>(0)
  const renderTimesRef = useRef<number[]>([])

  // Start render timing
  const startRenderTiming = useCallback(() => {
    renderStartTimeRef.current = performance.now()
  }, [])

  // End render timing
  const endRenderTiming = useCallback(() => {
    const renderTime = performance.now() - renderStartTimeRef.current
    renderTimesRef.current.push(renderTime)
    
    // Keep only last 10 render times
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current.shift()
    }
    
    // Update statistics
    setRenderCount(prev => prev + 1)
    const avgTime = renderTimesRef.current.reduce((sum, time) => sum + time, 0) / renderTimesRef.current.length
    setAverageRenderTime(avgTime)
    
    // Log slow renders
    if (renderTime > 16) { // Slower than 60fps
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
    }
  }, [componentName])

  // Check if component should use performance optimizations
  const shouldOptimizeRendering = useMemo(() => {
    return averageRenderTime > 16 || renderCount > 100
  }, [averageRenderTime, renderCount])

  // Get render performance status
  const getRenderPerformanceStatus = useMemo(() => {
    if (averageRenderTime < 8) return 'excellent'
    if (averageRenderTime < 16) return 'good'
    if (averageRenderTime < 32) return 'acceptable'
    return 'poor'
  }, [averageRenderTime])

  return {
    renderCount,
    averageRenderTime,
    shouldOptimizeRendering,
    renderPerformanceStatus: getRenderPerformanceStatus,
    startRenderTiming,
    endRenderTiming
  }
}

/**
 * Hook for memory-aware data loading
 */
export function useMemoryAwareLoading<T>(
  loadFunction: () => Promise<T>,
  dependencies: any[] = [],
  memoryThreshold: number = 100 // MB
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [memoryUsage, setMemoryUsage] = useState(0)

  // Check memory usage
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      const usedMB = memInfo.usedJSHeapSize / 1024 / 1024
      setMemoryUsage(usedMB)
      return usedMB
    }
    return 0
  }, [])

  // Load data if memory allows
  const loadData = useCallback(async () => {
    if (loading) return

    const currentMemory = checkMemoryUsage()
    if (currentMemory > memoryThreshold) {
      setError(new Error(`Memory usage too high (${currentMemory.toFixed(1)}MB > ${memoryThreshold}MB)`))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await loadFunction()
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
      checkMemoryUsage()
    }
  }, [loadFunction, loading, memoryThreshold, checkMemoryUsage])

  // Load data when dependencies change
  useEffect(() => {
    loadData()
  }, dependencies)

  // Clear data to free memory
  const clearData = useCallback(() => {
    setData(null)
    setError(null)
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc()
    }
    checkMemoryUsage()
  }, [checkMemoryUsage])

  return {
    data,
    loading,
    error,
    memoryUsage,
    loadData,
    clearData,
    canLoad: memoryUsage <= memoryThreshold
  }
}