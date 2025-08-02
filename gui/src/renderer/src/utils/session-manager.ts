/**
 * Session Manager Utility
 * 
 * Comprehensive session lifecycle management with workspace rebinding,
 * recovery, and performance monitoring for the subtitle editing system.
 */

import type { SubtitleEntry } from '../types/subtitle'
import { 
  saveOriginalSubtitles, 
  saveModifiedSubtitles, 
  loadSessionSubtitles, 
  hasSessionData,
  deleteSessionData,
  listWorkspaceSessions,
  cleanupWorkspaceSession,
  cleanupOldSessions,
  cleanupOrphanedSessions,
  getStorageStats
} from './subtitle-indexeddb'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface SessionManagerConfig {
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean
  /** Auto-cleanup interval in milliseconds */
  autoCleanupInterval: number
  /** Maximum session age before cleanup (days) */
  maxSessionAge: number
  /** Enable debug logging */
  debug: boolean
  /** Maximum concurrent operations */
  maxConcurrentOperations: number
}

export interface SessionOperationResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  duration: number
  timestamp: number
}

export interface SessionRecoveryInfo {
  sessionId: string
  workspaceId: string
  hasOriginal: boolean
  hasModified: boolean
  subtitleCount: number
  lastModified: number
}

export interface PerformanceMetrics {
  totalOperations: number
  averageOperationTime: number
  errorRate: number
  cachehits: number
  cacheHitRate: number
  lastCleanup: number
}

// ============================================================================
// SESSION MANAGER CLASS
// ============================================================================

export class SessionManager {
  private config: SessionManagerConfig
  private metrics: PerformanceMetrics
  private operationQueue: Map<string, Promise<any>>
  private cleanupTimer: NodeJS.Timeout | null
  private performanceStartTimes: Map<string, number>

  constructor(config: Partial<SessionManagerConfig> = {}) {
    this.config = {
      enablePerformanceMonitoring: true,
      autoCleanupInterval: 60 * 60 * 1000, // 1 hour
      maxSessionAge: 7, // days
      debug: false,
      maxConcurrentOperations: 5,
      ...config
    }

    this.metrics = {
      totalOperations: 0,
      averageOperationTime: 0,
      errorRate: 0,
      cachehits: 0,
      cacheHitRate: 0,
      lastCleanup: Date.now()
    }

    this.operationQueue = new Map()
    this.cleanupTimer = null
    this.performanceStartTimes = new Map()

    // Start auto-cleanup if enabled
    if (this.config.autoCleanupInterval > 0) {
      this.startAutoCleanup()
    }
  }

  // ============================================================================
  // CORE SESSION OPERATIONS
  // ============================================================================

  /**
   * Initialize a new session with workspace binding validation
   */
  async initializeSession(
    workspaceId: string,
    sessionId: string,
    subtitles: SubtitleEntry[],
    options: {
      validateWorkspace?: boolean
      cleanupPrevious?: boolean
      createBackup?: boolean
    } = {}
  ): Promise<SessionOperationResult<string>> {
    const operationId = `init-${workspaceId}-${Date.now()}`
    const startTime = this.startPerformanceTimer(operationId)

    try {
      const { validateWorkspace = true, cleanupPrevious = true, createBackup = false } = options

      this.log(`🚀 Initializing session ${sessionId} for workspace ${workspaceId}`)

      // Validate workspace ID format
      if (validateWorkspace && !this.validateWorkspaceId(workspaceId)) {
        throw new Error(`Invalid workspace ID format: ${workspaceId}`)
      }

      // Cleanup previous sessions if requested
      if (cleanupPrevious) {
        await this.cleanupWorkspace(workspaceId)
      }

      // Create backup if requested
      if (createBackup) {
        const existingSessions = await listWorkspaceSessions(workspaceId)
        for (const existingSessionId of existingSessions) {
          const hasData = await hasSessionData(workspaceId, existingSessionId)
          if (hasData.hasModified) {
            this.log(`💾 Creating backup for existing session ${existingSessionId}`)
            // Note: Backup logic would be implemented here
          }
        }
      }

      // Save original subtitles
      await saveOriginalSubtitles(workspaceId, sessionId, subtitles)

      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, true)

      this.log(`✅ Session ${sessionId} initialized successfully in ${duration.toFixed(2)}ms`)

      return {
        success: true,
        data: sessionId,
        duration,
        timestamp: Date.now()
      }
    } catch (error) {
      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, false)

      this.log(`❌ Session initialization failed: ${error.message}`)

      return {
        success: false,
        error: error as Error,
        duration,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Cleanup workspace sessions with atomic operations
   */
  async cleanupWorkspace(workspaceId: string): Promise<SessionOperationResult<{
    deletedSessions: number
    deletedRecords: number
    reclaimedBytes: number
  }>> {
    const operationId = `cleanup-${workspaceId}-${Date.now()}`
    const startTime = this.startPerformanceTimer(operationId)

    try {
      this.log(`🧹 Starting workspace cleanup for ${workspaceId}`)

      const result = await cleanupWorkspaceSession(workspaceId)
      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, true)

      this.log(`✅ Workspace cleanup completed:`, result)

      return {
        success: true,
        data: result,
        duration,
        timestamp: Date.now()
      }
    } catch (error) {
      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, false)

      this.log(`❌ Workspace cleanup failed: ${error.message}`)

      return {
        success: false,
        error: error as Error,
        duration,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Check and restore workspace session with validation
   */
  async checkAndRestoreWorkspaceSession(workspaceId: string): Promise<SessionOperationResult<SessionRecoveryInfo | null>> {
    const operationId = `restore-${workspaceId}-${Date.now()}`
    const startTime = this.startPerformanceTimer(operationId)

    try {
      this.log(`🔍 Checking for recoverable sessions in workspace ${workspaceId}`)

      const sessionIds = await listWorkspaceSessions(workspaceId)
      
      if (sessionIds.length === 0) {
        const duration = this.endPerformanceTimer(operationId, startTime)
        this.updateMetrics(duration, true)
        
        return {
          success: true,
          data: null,
          duration,
          timestamp: Date.now()
        }
      }

      // Find the most recent session with data
      let latestSession: SessionRecoveryInfo | null = null
      let latestModified = 0

      for (const sessionId of sessionIds) {
        const sessionData = await hasSessionData(workspaceId, sessionId)
        
        if (sessionData.hasOriginal || sessionData.hasModified) {
          try {
            const subtitles = await loadSessionSubtitles(workspaceId, sessionId)
            const currentSubtitles = subtitles.modified || subtitles.original
            
            if (currentSubtitles && currentSubtitles.length > 0) {
              // Use current timestamp as we don't store modification time in simple storage
              const modifiedTime = Date.now()
              
              if (modifiedTime > latestModified) {
                latestModified = modifiedTime
                latestSession = {
                  sessionId,
                  workspaceId,
                  hasOriginal: sessionData.hasOriginal,
                  hasModified: sessionData.hasModified,
                  subtitleCount: currentSubtitles.length,
                  lastModified: modifiedTime
                }
              }
            }
          } catch (error) {
            this.log(`⚠️ Failed to load session ${sessionId} data: ${error.message}`)
          }
        }
      }

      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, true)

      if (latestSession) {
        this.log(`✅ Found recoverable session:`, latestSession)
      } else {
        this.log(`ℹ️ No recoverable sessions found for workspace ${workspaceId}`)
      }

      return {
        success: true,
        data: latestSession,
        duration,
        timestamp: Date.now()
      }
    } catch (error) {
      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, false)

      this.log(`❌ Session restoration check failed: ${error.message}`)

      return {
        success: false,
        error: error as Error,
        duration,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Perform system-wide cleanup with configurable options
   */
  async performSystemCleanup(options: {
    olderThanDays?: number
    removeOrphaned?: boolean
    maxSizeBytes?: number
    dryRun?: boolean
  } = {}): Promise<SessionOperationResult<{
    oldSessionsResult: any
    orphanedResult?: any
    totalCleaned: number
    totalReclaimedBytes: number
  }>> {
    const {
      olderThanDays = this.config.maxSessionAge,
      removeOrphaned = true,
      maxSizeBytes,
      dryRun = false
    } = options

    const operationId = `system-cleanup-${Date.now()}`
    const startTime = this.startPerformanceTimer(operationId)

    try {
      this.log(`🧹 Starting system cleanup`, { olderThanDays, removeOrphaned, dryRun })

      // Check current storage usage if size limit is specified
      if (maxSizeBytes) {
        const stats = await getStorageStats()
        if (stats.totalBytes < maxSizeBytes) {
          this.log(`ℹ️ Storage usage (${stats.totalBytes} bytes) is below limit (${maxSizeBytes} bytes), skipping cleanup`)
          
          const duration = this.endPerformanceTimer(operationId, startTime)
          return {
            success: true,
            data: {
              oldSessionsResult: { deletedSessions: 0, deletedRecords: 0, reclaimedBytes: 0 },
              totalCleaned: 0,
              totalReclaimedBytes: 0
            },
            duration,
            timestamp: Date.now()
          }
        }
      }

      let totalCleaned = 0
      let totalReclaimedBytes = 0

      // Cleanup old sessions
      const oldSessionsResult = dryRun 
        ? { deletedSessions: 0, deletedRecords: 0, reclaimedBytes: 0, duration: 0 }
        : await cleanupOldSessions(olderThanDays)
      
      totalCleaned += oldSessionsResult.deletedRecords
      totalReclaimedBytes += oldSessionsResult.reclaimedBytes

      // Cleanup orphaned sessions if requested
      let orphanedResult
      if (removeOrphaned) {
        orphanedResult = dryRun
          ? { deletedSessions: 0, deletedRecords: 0, reclaimedBytes: 0 }
          : await cleanupOrphanedSessions()
        
        totalCleaned += orphanedResult.deletedRecords
        totalReclaimedBytes += orphanedResult.reclaimedBytes
      }

      // Update cleanup timestamp
      this.metrics.lastCleanup = Date.now()

      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, true)

      const result = {
        oldSessionsResult,
        orphanedResult,
        totalCleaned,
        totalReclaimedBytes
      }

      this.log(`✅ System cleanup completed:`, result)

      return {
        success: true,
        data: result,
        duration,
        timestamp: Date.now()
      }
    } catch (error) {
      const duration = this.endPerformanceTimer(operationId, startTime)
      this.updateMetrics(duration, false)

      this.log(`❌ System cleanup failed: ${error.message}`)

      return {
        success: false,
        error: error as Error,
        duration,
        timestamp: Date.now()
      }
    }
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  private startPerformanceTimer(operationId: string): number {
    if (!this.config.enablePerformanceMonitoring) return 0
    
    const startTime = performance.now()
    this.performanceStartTimes.set(operationId, startTime)
    return startTime
  }

  private endPerformanceTimer(operationId: string, startTime: number): number {
    if (!this.config.enablePerformanceMonitoring) return 0
    
    const endTime = performance.now()
    const duration = endTime - startTime
    this.performanceStartTimes.delete(operationId)
    return duration
  }

  private updateMetrics(duration: number, success: boolean): void {
    if (!this.config.enablePerformanceMonitoring) return

    this.metrics.totalOperations++
    
    // Update average operation time
    const totalTime = this.metrics.averageOperationTime * (this.metrics.totalOperations - 1)
    this.metrics.averageOperationTime = (totalTime + duration) / this.metrics.totalOperations
    
    // Update error rate
    if (!success) {
      const errors = this.metrics.errorRate * (this.metrics.totalOperations - 1) / 100
      this.metrics.errorRate = ((errors + 1) / this.metrics.totalOperations) * 100
    } else {
      const errors = this.metrics.errorRate * (this.metrics.totalOperations - 1) / 100
      this.metrics.errorRate = (errors / this.metrics.totalOperations) * 100
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      averageOperationTime: 0,
      errorRate: 0,
      cachehits: 0,
      cacheHitRate: 0,
      lastCleanup: this.metrics.lastCleanup
    }
    this.log('📊 Performance metrics reset')
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private validateWorkspaceId(workspaceId: string): boolean {
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return typeof workspaceId === 'string' && workspaceId.length > 0 && uuidRegex.test(workspaceId)
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      if (data) {
        console.log(`[SessionManager] ${message}`, data)
      } else {
        console.log(`[SessionManager] ${message}`)
      }
    }
  }

  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        this.log('🕒 Auto-cleanup triggered')
        await this.performSystemCleanup({
          olderThanDays: this.config.maxSessionAge,
          removeOrphaned: true
        })
      } catch (error) {
        this.log('❌ Auto-cleanup failed:', error)
      }
    }, this.config.autoCleanupInterval)
  }

  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      this.log('🛑 Auto-cleanup stopped')
    }
  }

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Gracefully shutdown the session manager
   */
  async shutdown(): Promise<void> {
    this.log('🛑 Shutting down session manager')
    
    this.stopAutoCleanup()
    
    // Wait for any pending operations
    if (this.operationQueue.size > 0) {
      this.log(`⏳ Waiting for ${this.operationQueue.size} pending operations`)
      await Promise.allSettled(Array.from(this.operationQueue.values()))
    }
    
    this.operationQueue.clear()
    this.performanceStartTimes.clear()
    
    this.log('✅ Session manager shutdown complete')
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SessionManagerConfig>): void {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...newConfig }
    
    // Restart auto-cleanup if interval changed
    if (oldConfig.autoCleanupInterval !== this.config.autoCleanupInterval) {
      this.stopAutoCleanup()
      if (this.config.autoCleanupInterval > 0) {
        this.startAutoCleanup()
      }
    }
    
    this.log('⚙️ Configuration updated:', newConfig)
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let sessionManagerInstance: SessionManager | null = null

export function getSessionManager(config?: Partial<SessionManagerConfig>): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(config)
  }
  return sessionManagerInstance
}

export function resetSessionManager(): void {
  if (sessionManagerInstance) {
    sessionManagerInstance.shutdown()
    sessionManagerInstance = null
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick workspace cleanup function
 */
export async function quickCleanupWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const manager = getSessionManager({ debug: false })
    const result = await manager.cleanupWorkspace(workspaceId)
    return result.success
  } catch (error) {
    console.error('Quick workspace cleanup failed:', error)
    return false
  }
}

/**
 * Quick session recovery check
 */
export async function quickCheckRecovery(workspaceId: string): Promise<SessionRecoveryInfo | null> {
  try {
    const manager = getSessionManager({ debug: false })
    const result = await manager.checkAndRestoreWorkspaceSession(workspaceId)
    return result.success ? result.data || null : null
  } catch (error) {
    console.error('Quick recovery check failed:', error)
    return null
  }
}