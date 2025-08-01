/**
 * Subtitle Temporary Storage Performance Optimization Service
 * 
 * High-performance utilities for optimizing IndexedDB operations, memory management,
 * and background processing for the subtitle auto-save system.
 */

import type { SubtitleData } from '../../../types'
import type {
  SubtitleTempContent,
  SubtitleTempStorageRecord,
  SubtitleTempError,
  SubtitleTempOperationResponse,
  SubtitleTempBatchOperation,
  SubtitleTempBatchResponse
} from '../types/subtitle-temp-storage'

// ============================================================================
// PERFORMANCE CONSTANTS AND CONFIGURATION
// ============================================================================

export const PERFORMANCE_CONFIG = {
  // IndexedDB Optimization
  BATCH_SIZE: 100,
  MAX_TRANSACTION_SIZE: 50,
  CONNECTION_POOL_SIZE: 3,
  PREFETCH_THRESHOLD: 10,
  
  // Memory Management
  MEMORY_PRESSURE_THRESHOLD: 0.8, // 80% of available memory
  CACHE_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  OBJECT_POOL_SIZE: 1000,
  GC_INTERVAL: 30000, // 30 seconds
  
  // Background Processing
  WORKER_POOL_SIZE: 2,
  QUEUE_MAX_SIZE: 10000,
  PRIORITY_QUEUE_LEVELS: 4,
  DEBOUNCE_DELAY: 300,
  
  // Compression
  COMPRESSION_THRESHOLD: 10 * 1024, // 10KB
  COMPRESSION_LEVEL: 6,
  CHUNK_SIZE: 64 * 1024, // 64KB chunks
  
  // Monitoring
  METRICS_BUFFER_SIZE: 1000,
  PERFORMANCE_SAMPLE_RATE: 0.1, // 10% sampling
  ALERT_THRESHOLD_MS: 1000
} as const

// ============================================================================
// MEMORY MANAGEMENT AND OBJECT POOLING
// ============================================================================

/**
 * High-performance object pool for reducing garbage collection
 */
export class ObjectPool<T> {
  private pool: T[] = []
  private createFn: () => T
  private resetFn: (obj: T) => void
  private maxSize: number

  constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize = PERFORMANCE_CONFIG.OBJECT_POOL_SIZE) {
    this.createFn = createFn
    this.resetFn = resetFn
    this.maxSize = maxSize
  }

  acquire(): T {
    const obj = this.pool.pop()
    if (obj) {
      this.resetFn(obj)
      return obj
    }
    return this.createFn()
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj)
    }
  }

  clear(): void {
    this.pool.length = 0
  }

  get size(): number {
    return this.pool.length
  }
}

/**
 * Memory pressure monitoring and adaptive behavior
 */
export class MemoryManager {
  private memoryPressureCallback?: () => void
  private isMonitoring = false
  private lastGC = 0

  startMonitoring(onMemoryPressure?: () => void): void {
    this.memoryPressureCallback = onMemoryPressure
    this.isMonitoring = true
    this.scheduleMemoryCheck()
  }

  stopMonitoring(): void {
    this.isMonitoring = false
  }

  private scheduleMemoryCheck(): void {
    if (!this.isMonitoring) return

    setTimeout(() => {
      this.checkMemoryPressure()
      this.scheduleMemoryCheck()
    }, PERFORMANCE_CONFIG.GC_INTERVAL)
  }

  private checkMemoryPressure(): void {
    // Modern browsers memory API
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit
      
      if (usedRatio > PERFORMANCE_CONFIG.MEMORY_PRESSURE_THRESHOLD) {
        this.memoryPressureCallback?.()
        this.forceGarbageCollection()
      }
    }
  }

  private forceGarbageCollection(): void {
    const now = Date.now()
    if (now - this.lastGC > PERFORMANCE_CONFIG.GC_INTERVAL) {
      // Force garbage collection by creating memory pressure
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc()
      }
      this.lastGC = now
    }
  }

  getMemoryUsage(): { used: number; total: number; ratio: number } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.jsHeapSizeLimit,
        ratio: memory.usedJSHeapSize / memory.jsHeapSizeLimit
      }
    }
    return null
  }
}

// ============================================================================
// INDEXEDDB CONNECTION POOLING AND OPTIMIZATION
// ============================================================================

/**
 * IndexedDB connection pool for better resource management
 */
export class IndexedDBConnectionPool {
  private connections: IDBDatabase[] = []
  private pending: Array<(db: IDBDatabase) => void> = []
  private maxConnections: number
  private dbName: string
  private version: number

  constructor(dbName: string, version: number, maxConnections = PERFORMANCE_CONFIG.CONNECTION_POOL_SIZE) {
    this.dbName = dbName
    this.version = version
    this.maxConnections = maxConnections
  }

  async getConnection(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Return existing connection if available
      const connection = this.connections.pop()
      if (connection) {
        resolve(connection)
        return
      }

      // Queue request if at max capacity
      if (this.pending.length >= this.maxConnections) {
        this.pending.push(resolve)
        return
      }

      // Create new connection
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onsuccess = () => {
        resolve(request.result)
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  releaseConnection(db: IDBDatabase): void {
    // Serve pending requests first
    const pendingResolve = this.pending.shift()
    if (pendingResolve) {
      pendingResolve(db)
      return
    }

    // Return to pool if under capacity
    if (this.connections.length < this.maxConnections) {
      this.connections.push(db)
    } else {
      db.close()
    }
  }

  closeAll(): void {
    this.connections.forEach(db => db.close())
    this.connections.length = 0
    this.pending.length = 0
  }
}

// ============================================================================
// BATCH OPERATIONS OPTIMIZATION
// ============================================================================

/**
 * Optimized batch processor for IndexedDB operations
 */
export class BatchProcessor {
  private batchQueue: SubtitleTempBatchOperation<any>[] = []
  private processing = false
  private connectionPool: IndexedDBConnectionPool

  constructor(connectionPool: IndexedDBConnectionPool) {
    this.connectionPool = connectionPool
  }

  async enqueueBatch<T>(batch: SubtitleTempBatchOperation<T>): Promise<SubtitleTempBatchResponse<T>> {
    return new Promise((resolve, reject) => {
      const enhancedBatch = {
        ...batch,
        resolve,
        reject
      }
      
      this.batchQueue.push(enhancedBatch)
      this.processBatchQueue()
    })
  }

  private async processBatchQueue(): Promise<void> {
    if (this.processing || this.batchQueue.length === 0) return

    this.processing = true

    try {
      while (this.batchQueue.length > 0) {
        const batch = this.batchQueue.shift()!
        await this.processBatch(batch)
      }
    } finally {
      this.processing = false
    }
  }

  private async processBatch<T>(batch: SubtitleTempBatchOperation<T> & {
    resolve: (result: SubtitleTempBatchResponse<T>) => void
    reject: (error: Error) => void
  }): Promise<void> {
    const startTime = performance.now()
    let successCount = 0
    let errorCount = 0
    let totalDataProcessed = 0
    const responses: SubtitleTempOperationResponse<T>[] = []

    try {
      const db = await this.connectionPool.getConnection()
      
      try {
        // Process operations in optimized chunks
        const chunks = this.chunkOperations(batch.operations, PERFORMANCE_CONFIG.BATCH_SIZE)
        
        for (const chunk of chunks) {
          const chunkResults = await this.processChunk(db, chunk)
          responses.push(...chunkResults)
          
          // Update counters
          chunkResults.forEach(result => {
            if (result.success) {
              successCount++
              totalDataProcessed += result.metrics.dataSize || 0
            } else {
              errorCount++
            }
          })

          // Report progress
          if (batch.onProgress) {
            batch.onProgress(responses.length, batch.operations.length, responses[responses.length - 1])
          }

          // Break on error if transactional
          if (batch.transactional && errorCount > 0) {
            break
          }
        }

        batch.resolve({
          batchId: batch.batchId,
          success: errorCount === 0,
          responses,
          batchMetrics: {
            totalDuration: performance.now() - startTime,
            successCount,
            errorCount,
            dataProcessed: totalDataProcessed
          },
          timestamp: Date.now()
        })

      } finally {
        this.connectionPool.releaseConnection(db)
      }

    } catch (error) {
      batch.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private chunkOperations<T>(operations: any[], chunkSize: number): any[][] {
    const chunks: any[][] = []
    for (let i = 0; i < operations.length; i += chunkSize) {
      chunks.push(operations.slice(i, i + chunkSize))
    }
    return chunks
  }

  private async processChunk<T>(db: IDBDatabase, operations: any[]): Promise<SubtitleTempOperationResponse<T>[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['subtitle_temp_storage'], 'readwrite')
      const store = transaction.objectStore('subtitle_temp_storage')
      const results: SubtitleTempOperationResponse<T>[] = []
      let completed = 0

      transaction.oncomplete = () => resolve(results)
      transaction.onerror = () => reject(transaction.error)

      operations.forEach((operation, index) => {
        const startTime = performance.now()
        
        let request: IDBRequest
        switch (operation.type) {
          case 'save':
            request = store.put(operation.data)
            break
          case 'load':
            request = store.get(operation.id)
            break
          case 'delete':
            request = store.delete(operation.id)
            break
          default:
            throw new Error(`Unsupported operation: ${operation.type}`)
        }

        request.onsuccess = () => {
          results[index] = {
            operationId: operation.operationId,
            success: true,
            data: request.result,
            metrics: {
              duration: performance.now() - startTime,
              dataSize: operation.data ? JSON.stringify(operation.data).length : 0
            },
            timestamp: Date.now()
          }
          
          completed++
          if (completed === operations.length) {
            // Transaction will complete automatically
          }
        }

        request.onerror = () => {
          results[index] = {
            operationId: operation.operationId,
            success: false,
            error: {
              code: 'STORAGE_OPERATION_FAILED',
              message: request.error?.message || 'Operation failed',
              timestamp: Date.now(),
              severity: 'high'
            } as SubtitleTempError,
            metrics: {
              duration: performance.now() - startTime
            },
            timestamp: Date.now()
          }
          
          completed++
        }
      })
    })
  }
}

// ============================================================================
// BACKGROUND PROCESSING WITH WEB WORKERS
// ============================================================================

/**
 * Web Worker manager for background processing
 */
export class BackgroundProcessor {
  private workers: Worker[] = []
  private taskQueue: Array<{
    id: string
    data: any
    priority: number
    resolve: (result: any) => void
    reject: (error: Error) => void
  }> = []
  private workerIndex = 0

  constructor(workerScript: string, poolSize = PERFORMANCE_CONFIG.WORKER_POOL_SIZE) {
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript)
      worker.onmessage = this.handleWorkerMessage.bind(this)
      worker.onerror = this.handleWorkerError.bind(this)
      this.workers.push(worker)
    }
  }

  async processInBackground<T>(data: any, priority = 1): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = `task_${Date.now()}_${Math.random()}`
      
      this.taskQueue.push({
        id: taskId,
        data: { ...data, taskId },
        priority,
        resolve,
        reject
      })

      // Sort by priority (higher first)
      this.taskQueue.sort((a, b) => b.priority - a.priority)
      
      this.assignTasks()
    })
  }

  private assignTasks(): void {
    if (this.taskQueue.length === 0) return

    const task = this.taskQueue.shift()!
    const worker = this.workers[this.workerIndex]
    this.workerIndex = (this.workerIndex + 1) % this.workers.length

    worker.postMessage(task.data)
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { taskId, result, error } = event.data
    
    // Find the corresponding task
    const taskIndex = this.taskQueue.findIndex(task => task.id === taskId)
    if (taskIndex === -1) return

    const task = this.taskQueue.splice(taskIndex, 1)[0]
    
    if (error) {
      task.reject(new Error(error))
    } else {
      task.resolve(result)
    }

    // Process next task
    this.assignTasks()
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error)
  }

  terminate(): void {
    this.workers.forEach(worker => worker.terminate())
    this.workers.length = 0
    this.taskQueue.length = 0
  }
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * High-performance compression utilities
 */
export class CompressionManager {
  private static encoder = new TextEncoder()
  private static decoder = new TextDecoder()

  static async compress(data: string): Promise<{
    compressed: ArrayBuffer
    originalSize: number
    compressedSize: number
    ratio: number
  }> {
    const originalBytes = this.encoder.encode(data)
    const originalSize = originalBytes.length

    if (originalSize < PERFORMANCE_CONFIG.COMPRESSION_THRESHOLD) {
      return {
        compressed: originalBytes.buffer,
        originalSize,
        compressedSize: originalSize,
        ratio: 1
      }
    }

    try {
      // Use CompressionStream if available (modern browsers)
      if ('CompressionStream' in window) {
        const stream = new CompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()
        
        writer.write(originalBytes)
        writer.close()
        
        const chunks: Uint8Array[] = []
        let done = false
        
        while (!done) {
          const { value, done: streamDone } = await reader.read()
          done = streamDone
          if (value) chunks.push(value)
        }
        
        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        
        for (const chunk of chunks) {
          compressed.set(chunk, offset)
          offset += chunk.length
        }
        
        return {
          compressed: compressed.buffer,
          originalSize,
          compressedSize: compressed.length,
          ratio: compressed.length / originalSize
        }
      }
      
      // Fallback to basic compression
      return this.basicCompress(data)
      
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error)
      return {
        compressed: originalBytes.buffer,
        originalSize,
        compressedSize: originalSize,
        ratio: 1
      }
    }
  }

  static async decompress(data: ArrayBuffer, originalSize: number): Promise<string> {
    try {
      // Use DecompressionStream if available
      if ('DecompressionStream' in window) {
        const stream = new DecompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()
        
        writer.write(new Uint8Array(data))
        writer.close()
        
        const chunks: Uint8Array[] = []
        let done = false
        
        while (!done) {
          const { value, done: streamDone } = await reader.read()
          done = streamDone
          if (value) chunks.push(value)
        }
        
        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        
        for (const chunk of chunks) {
          decompressed.set(chunk, offset)
          offset += chunk.length
        }
        
        return this.decoder.decode(decompressed)
      }
      
      // Fallback
      return this.decoder.decode(data)
      
    } catch (error) {
      console.warn('Decompression failed:', error)
      return this.decoder.decode(data)
    }
  }

  private static basicCompress(data: string): {
    compressed: ArrayBuffer
    originalSize: number
    compressedSize: number
    ratio: number
  } {
    // Simple run-length encoding for basic compression
    const originalBytes = this.encoder.encode(data)
    const originalSize = originalBytes.length
    
    // For now, return uncompressed
    return {
      compressed: originalBytes.buffer,
      originalSize,
      compressedSize: originalSize,
      ratio: 1
    }
  }
}

// ============================================================================
// PERFORMANCE METRICS COLLECTOR
// ============================================================================

export interface PerformanceMetric {
  timestamp: number
  operation: string
  duration: number
  success: boolean
  dataSize?: number
  memoryUsage?: number
  cacheHit?: boolean
  error?: string
}

/**
 * High-performance metrics collection
 */
export class PerformanceMetricsCollector {
  private metrics: PerformanceMetric[] = []
  private memoryManager: MemoryManager
  private sampleRate: number

  constructor(sampleRate = PERFORMANCE_CONFIG.PERFORMANCE_SAMPLE_RATE) {
    this.sampleRate = sampleRate
    this.memoryManager = new MemoryManager()
    this.memoryManager.startMonitoring(() => this.handleMemoryPressure())
  }

  recordMetric(metric: Omit<PerformanceMetric, 'timestamp' | 'memoryUsage'>): void {
    // Sample metrics to avoid overwhelming the system
    if (Math.random() > this.sampleRate) return

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
      memoryUsage: this.memoryManager.getMemoryUsage()?.used
    }

    this.metrics.push(fullMetric)

    // Trim metrics if over limit
    if (this.metrics.length > PERFORMANCE_CONFIG.METRICS_BUFFER_SIZE) {
      this.metrics = this.metrics.slice(-PERFORMANCE_CONFIG.METRICS_BUFFER_SIZE / 2)
    }

    // Alert on slow operations
    if (metric.duration > PERFORMANCE_CONFIG.ALERT_THRESHOLD_MS) {
      console.warn(`Slow operation detected: ${metric.operation} took ${metric.duration}ms`)
    }
  }

  getMetrics(since?: number): PerformanceMetric[] {
    if (!since) return [...this.metrics]
    return this.metrics.filter(m => m.timestamp >= since)
  }

  getAveragePerformance(operation?: string, timeWindow = 60000): {
    averageDuration: number
    successRate: number
    throughput: number
    errorRate: number
  } {
    const cutoff = Date.now() - timeWindow
    let filteredMetrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    if (operation) {
      filteredMetrics = filteredMetrics.filter(m => m.operation === operation)
    }

    if (filteredMetrics.length === 0) {
      return {
        averageDuration: 0,
        successRate: 1,
        throughput: 0,
        errorRate: 0
      }
    }

    const totalDuration = filteredMetrics.reduce((sum, m) => sum + m.duration, 0)
    const successCount = filteredMetrics.filter(m => m.success).length
    const totalCount = filteredMetrics.length

    return {
      averageDuration: totalDuration / totalCount,
      successRate: successCount / totalCount,
      throughput: totalCount / (timeWindow / 1000), // operations per second
      errorRate: (totalCount - successCount) / totalCount
    }
  }

  private handleMemoryPressure(): void {
    // Clear old metrics
    const cutoff = Date.now() - 300000 // Keep only last 5 minutes
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    console.warn('Memory pressure detected, cleared old performance metrics')
  }

  stop(): void {
    this.memoryManager.stopMonitoring()
    this.metrics.length = 0
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const performanceManager = {
  memoryManager: new MemoryManager(),
  metricsCollector: new PerformanceMetricsCollector(),
  
  // Object pools for common operations
  contentPool: new ObjectPool<SubtitleTempContent>(
    () => ({} as SubtitleTempContent),
    (content) => {
      content.subtitles = []
      content.changeTracking = {
        changeCount: 0,
        lastUserAction: Date.now(),
        modifiedIds: new Set(),
        changeSeverity: 'minor'
      }
    }
  ),

  recordPool: new ObjectPool<SubtitleTempStorageRecord>(
    () => ({} as SubtitleTempStorageRecord),
    (record) => {
      // Reset record properties
      Object.keys(record).forEach(key => delete (record as any)[key])
    }
  )
}

// Start performance monitoring
performanceManager.memoryManager.startMonitoring(() => {
  // Handle memory pressure
  performanceManager.contentPool.clear()
  performanceManager.recordPool.clear()
})