/**
 * Electron State Bridge Service
 * Provides enhanced state management integration with Electron's main process
 * Handles cross-platform state persistence, IPC state synchronization, and debugging
 * 
 * Features:
 * - Cross-platform file path handling
 * - Enhanced IPC communication with error recovery
 * - Electron-specific debugging information
 * - Performance monitoring for Electron context
 * - Process isolation compatibility
 */

import { 
  StepState, 
  StepId, 
  StateChangeEvent, 
  WorkflowStateSnapshot,
  createTimestamp,
  createStepId
} from '../types/workflow-state'

// Electron API type definitions
interface ElectronAPI {
  getPlatform(): Promise<string>
  getAppVersion(): Promise<string>
  getConfig(): Promise<any>
  setConfig(section: string, value: any): Promise<void>
  openDevTools(): Promise<void>
  removeAllListeners(): void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    cantocapAPI?: ElectronAPI
  }
}

/**
 * Cross-platform path utilities for Electron
 */
class ElectronPathUtils {
  private static platform: string | null = null

  static async getPlatform(): Promise<string> {
    if (this.platform === null) {
      try {
        this.platform = await window.electronAPI?.getPlatform() || 'unknown'
      } catch (error) {
        console.warn('Failed to get platform from Electron:', error)
        this.platform = 'unknown'
      }
    }
    return this.platform
  }

  /**
   * Normalize paths for cross-platform compatibility
   */
  static async normalizePath(path: string): Promise<string> {
    const platform = await this.getPlatform()
    
    switch (platform) {
      case 'win32':
        // Windows path normalization
        return path.replace(/\//g, '\\').replace(/\\\\/g, '\\')
      case 'darwin':
      case 'linux':
        // Unix-like path normalization
        return path.replace(/\\/g, '/').replace(/\/\//g, '/')
      default:
        return path
    }
  }

  /**
   * Check if running in sandboxed renderer process
   */
  static isSandboxed(): boolean {
    return process.contextIsolated && !process.nodeIntegration
  }

  /**
   * Get safe storage path for workflow state
   */
  static async getWorkflowStatePath(workspaceId?: string): Promise<string> {
    const platform = await this.getPlatform()
    const baseDir = platform === 'win32' ? 
      'AppData/Roaming/CantoCap' : 
      platform === 'darwin' ? 
        '~/Library/Application Support/CantoCap' : 
        '~/.config/cantocap'
    
    return workspaceId ? 
      `${baseDir}/workspaces/${workspaceId}/workflow-state.json` :
      `${baseDir}/workflow-state.json`
  }
}

/**
 * Enhanced IPC communication with error recovery
 */
class ElectronIPCBridge {
  private static reconnectAttempts = 0
  private static maxReconnectAttempts = 3
  private static connectionTimeout = 5000 // 5 seconds

  /**
   * Safe IPC call with timeout and error recovery
   */
  static async safeIPCCall<T>(
    operation: string,
    data?: any,
    timeout: number = this.connectionTimeout
  ): Promise<T | null> {
    try {
      // Check if Electron API is available
      if (!window.electronAPI && !window.cantocapAPI) {
        throw new Error('Electron API not available')
      }

      const api = window.electronAPI || window.cantocapAPI
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`IPC timeout: ${operation}`)), timeout)
      })

      // Execute the operation with timeout
      const result = await Promise.race([
        this.executeIPCOperation(api, operation, data),
        timeoutPromise
      ])

      // Reset reconnect attempts on success
      this.reconnectAttempts = 0
      return result as T

    } catch (error) {
      console.error(`IPC operation failed: ${operation}`, error)
      
      // Attempt reconnection if needed
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        console.log(`Attempting IPC reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * this.reconnectAttempts))
        return this.safeIPCCall<T>(operation, data, timeout)
      }

      return null
    }
  }

  /**
   * Execute specific IPC operation
   */
  private static async executeIPCOperation(api: ElectronAPI, operation: string, data?: any): Promise<any> {
    switch (operation) {
      case 'getPlatform':
        return api.getPlatform()
      case 'getAppVersion':
        return api.getAppVersion()
      case 'getConfig':
        return api.getConfig()
      case 'setConfig':
        return api.setConfig(data.section, data.value)
      case 'openDevTools':
        return api.openDevTools()
      default:
        throw new Error(`Unknown IPC operation: ${operation}`)
    }
  }

  /**
   * Check IPC connection health
   */
  static async checkIPCHealth(): Promise<boolean> {
    try {
      const result = await this.safeIPCCall<string>('getPlatform', undefined, 2000)
      return result !== null
    } catch {
      return false
    }
  }
}

/**
 * Electron-specific debug information collector
 */
class ElectronDebugCollector {
  private static debugSession = {
    sessionId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? 
               crypto.randomUUID().slice(0, 8) : 
               'debug-' + Math.random().toString(36).slice(2, 10),
    startTime: Date.now(),
    ipcCalls: [] as Array<{
      operation: string
      timestamp: number
      duration?: number
      success: boolean
      error?: string
    }>,
    stateChanges: [] as Array<{
      stepId: string
      oldState: StepState
      newState: StepState
      timestamp: number
      processId: string
    }>,
    performanceMetrics: {
      rendererMemory: 0,
      ipcLatency: 0,
      stateTransitionTime: 0,
      renderTime: 0
    }
  }

  /**
   * Collect comprehensive Electron environment information
   */
  static async collectEnvironmentInfo(): Promise<Record<string, any>> {
    const startTime = performance.now()
    
    try {
      const [platform, appVersion, ipcHealthy] = await Promise.all([
        ElectronPathUtils.getPlatform(),
        ElectronIPCBridge.safeIPCCall<string>('getAppVersion'),
        ElectronIPCBridge.checkIPCHealth()
      ])

      const envInfo = {
        // Electron Environment
        electron: {
          platform,
          appVersion,
          ipcHealthy,
          sandboxed: ElectronPathUtils.isSandboxed(),
          contextIsolated: process.contextIsolated,
          nodeIntegration: process.nodeIntegration,
          webSecurity: true // Assuming web security is enabled
        },

        // Process Information
        process: {
          type: 'renderer',
          platform: process.platform,
          version: process.version,
          versions: process.versions,
          pid: process.pid || 'unknown'
        },

        // Memory Information (if available)
        memory: this.getMemoryInfo(),

        // Debug Session Info
        session: {
          ...this.debugSession,
          currentTime: Date.now(),
          sessionDuration: Date.now() - this.debugSession.startTime
        },

        // Collection Performance
        collectionTime: performance.now() - startTime
      }

      return envInfo

    } catch (error) {
      return {
        error: 'Failed to collect environment info',
        details: error instanceof Error ? error.message : 'Unknown error',
        collectionTime: performance.now() - startTime
      }
    }
  }

  /**
   * Get memory information if available
   */
  private static getMemoryInfo(): Record<string, any> {
    try {
      if ('memory' in performance && typeof performance.memory === 'object') {
        const memory = performance.memory as any
        return {
          usedJSHeapSize: memory.usedJSHeapSize || 0,
          totalJSHeapSize: memory.totalJSHeapSize || 0,
          jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
          available: true
        }
      }
      return { available: false, reason: 'Performance.memory not available' }
    } catch (error) {
      return { 
        available: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Record IPC call for debugging
   */
  static recordIPCCall(operation: string, success: boolean, duration?: number, error?: string): void {
    this.debugSession.ipcCalls.push({
      operation,
      timestamp: Date.now(),
      duration,
      success,
      error
    })

    // Keep only last 50 IPC calls to prevent memory buildup
    if (this.debugSession.ipcCalls.length > 50) {
      this.debugSession.ipcCalls = this.debugSession.ipcCalls.slice(-25)
    }
  }

  /**
   * Record state change for debugging
   */
  static recordStateChange(event: StateChangeEvent): void {
    this.debugSession.stateChanges.push({
      stepId: event.stepId,
      oldState: event.oldState,
      newState: event.newState,
      timestamp: Date.now(),
      processId: `renderer-${process.pid || 'unknown'}`
    })

    // Keep only last 50 state changes
    if (this.debugSession.stateChanges.length > 50) {
      this.debugSession.stateChanges = this.debugSession.stateChanges.slice(-25)
    }
  }

  /**
   * Update performance metrics
   */
  static updatePerformanceMetrics(metrics: Partial<typeof this.debugSession.performanceMetrics>): void {
    Object.assign(this.debugSession.performanceMetrics, metrics)
  }

  /**
   * Generate comprehensive debug report
   */
  static async generateDebugReport(): Promise<string> {
    const envInfo = await this.collectEnvironmentInfo()
    
    const report = {
      title: 'CantoCap Electron State Management Debug Report',
      timestamp: new Date().toISOString(),
      environment: envInfo,
      recommendations: this.generateRecommendations(envInfo)
    }

    return JSON.stringify(report, null, 2)
  }

  /**
   * Generate performance recommendations
   */
  private static generateRecommendations(envInfo: any): string[] {
    const recommendations: string[] = []

    // IPC Health Recommendations
    if (!envInfo.electron?.ipcHealthy) {
      recommendations.push('IPC communication is unhealthy. Consider restarting the application.')
    }

    // Memory Recommendations
    if (envInfo.memory?.available && envInfo.memory.usedJSHeapSize > 100 * 1024 * 1024) {
      recommendations.push('High memory usage detected (>100MB). Consider optimizing state management.')
    }

    // Performance Recommendations
    if (this.debugSession.performanceMetrics.stateTransitionTime > 50) {
      recommendations.push('State transitions are slow (>50ms). Consider optimizing state logic.')
    }

    if (this.debugSession.ipcCalls.filter(call => !call.success).length > 5) {
      recommendations.push('Multiple IPC call failures detected. Check main process connectivity.')
    }

    return recommendations
  }
}

/**
 * Enhanced DevTools integration for state management
 */
class ElectronDevToolsIntegration {
  private static isDevToolsAvailable = false
  private static consoleGroupStack: string[] = []

  /**
   * Initialize DevTools integration
   */
  static async initialize(): Promise<void> {
    try {
      // Check if DevTools is available
      this.isDevToolsAvailable = typeof window !== 'undefined' && 
                                  'console' in window && 
                                  typeof console.group === 'function'

      if (this.isDevToolsAvailable) {
        console.log('🔧 [DevTools] Electron State Management Debug Integration Active')
        
        // Add CSS styles for better console output
        const styles = `
          .workflow-state-debug { color: #2196F3; font-weight: bold; }
          .workflow-state-error { color: #f44336; font-weight: bold; }
          .workflow-state-success { color: #4CAF50; font-weight: bold; }
          .workflow-state-warning { color: #FF9800; font-weight: bold; }
        `
        
        // Inject styles if possible
        if (document && document.head) {
          const styleElement = document.createElement('style')
          styleElement.textContent = styles
          document.head.appendChild(styleElement)
        }
      }
    } catch (error) {
      console.warn('Failed to initialize DevTools integration:', error)
    }
  }

  /**
   * Enhanced state change logging with collapsible groups
   */
  static logStateChange(event: StateChangeEvent, context?: Record<string, any>): void {
    if (!this.isDevToolsAvailable) return

    const groupTitle = `🔄 State Change: ${event.stepId} (${event.oldState} → ${event.newState})`
    
    console.group(groupTitle)
    console.log('📊 Event Details:', {
      stepId: event.stepId,
      transition: `${event.oldState} → ${event.newState}`,
      timestamp: new Date(event.timestamp).toISOString(),
      isValid: event.isValid,
      transitionKey: event.transitionKey
    })

    if (event.metadata) {
      console.log('📋 Metadata:', event.metadata)
    }

    if (context) {
      console.log('🌐 Context:', context)
    }

    // Add performance timing if available
    if (context?.performanceMetrics) {
      console.log('⚡ Performance:', context.performanceMetrics)
    }

    // Record for debug collector
    ElectronDebugCollector.recordStateChange(event)
    
    console.groupEnd()
  }

  /**
   * Log IPC operations with enhanced details
   */
  static logIPCOperation(operation: string, data?: any, result?: any, error?: Error): void {
    if (!this.isDevToolsAvailable) return

    const isError = !!error
    const icon = isError ? '❌' : '✅'
    const groupTitle = `${icon} IPC: ${operation}`

    console.group(groupTitle)
    
    if (data) {
      console.log('📤 Request Data:', data)
    }

    if (result) {
      console.log('📨 Response:', result)
    }

    if (error) {
      console.error('💥 Error:', error)
    }

    console.log('🕐 Timestamp:', new Date().toISOString())
    console.groupEnd()
  }

  /**
   * Log performance metrics with visual indicators
   */
  static logPerformanceMetrics(metrics: Record<string, number>): void {
    if (!this.isDevToolsAvailable) return

    console.group('⚡ Performance Metrics')
    
    Object.entries(metrics).forEach(([key, value]) => {
      const unit = key.includes('Time') || key.includes('Duration') ? 'ms' : 
                   key.includes('Memory') || key.includes('Size') ? 'bytes' : ''
      
      let icon = '📊'
      let style = 'color: #2196F3'
      
      // Add performance indicators
      if (key.includes('Time') && value > 100) {
        icon = '🐌'
        style = 'color: #ff9800'
      } else if (key.includes('Time') && value < 10) {
        icon = '⚡'
        style = 'color: #4CAF50'
      }

      console.log(`${icon} ${key}: %c${value}${unit}`, style)
    })
    
    console.groupEnd()
  }

  /**
   * Create interactive debug commands in console
   */
  static exposeDebugCommands(): void {
    if (!this.isDevToolsAvailable || typeof window === 'undefined') return

    // Expose debug utilities to global scope (only in development)
    if (process.env.NODE_ENV === 'development') {
      (window as any).cantoCapDebug = {
        // Environment information
        getEnvironmentInfo: () => ElectronDebugCollector.collectEnvironmentInfo(),
        
        // Generate debug report
        generateReport: () => ElectronDebugCollector.generateDebugReport(),
        
        // IPC testing
        testIPC: async () => {
          console.log('Testing IPC connection...')
          const healthy = await ElectronIPCBridge.checkIPCHealth()
          console.log(`IPC Health: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`)
          return healthy
        },

        // Open DevTools
        openDevTools: async () => {
          try {
            await ElectronIPCBridge.safeIPCCall('openDevTools')
            console.log('✅ DevTools opened')
          } catch (error) {
            console.error('❌ Failed to open DevTools:', error)
          }
        },

        // Memory usage
        getMemoryUsage: () => {
          if ('memory' in performance) {
            const memory = (performance as any).memory
            return {
              used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
              total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
              limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
            }
          }
          return 'Memory information not available'
        },

        // Clear debug data
        clearDebugData: () => {
          ElectronDebugCollector['debugSession'].ipcCalls = []
          ElectronDebugCollector['debugSession'].stateChanges = []
          console.log('🧹 Debug data cleared')
        }
      }

      console.log('🔧 Debug commands available at window.cantoCapDebug')
      console.log('Try: cantoCapDebug.getEnvironmentInfo()')
    }
  }
}

/**
 * Main Electron State Bridge Service
 * Coordinates all Electron-specific state management features
 */
export class ElectronStateBridge {
  private static instance: ElectronStateBridge | null = null
  private static isInitialized = false

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ElectronStateBridge {
    if (!this.instance) {
      this.instance = new ElectronStateBridge()
    }
    return this.instance
  }

  /**
   * Initialize the Electron State Bridge
   */
  async initialize(): Promise<void> {
    if (ElectronStateBridge.isInitialized) {
      return
    }

    console.log('🚀 Initializing Electron State Bridge')

    try {
      // Initialize DevTools integration
      await ElectronDevToolsIntegration.initialize()

      // Expose debug commands
      ElectronDevToolsIntegration.exposeDebugCommands()

      // Check IPC health
      const ipcHealthy = await ElectronIPCBridge.checkIPCHealth()
      console.log(`🔗 IPC Connection: ${ipcHealthy ? '✅ Healthy' : '❌ Unhealthy'}`)

      // Get platform information
      const platform = await ElectronPathUtils.getPlatform()
      console.log(`💻 Platform: ${platform}`)

      // Log initialization success
      console.log('✅ Electron State Bridge initialized successfully')
      
      ElectronStateBridge.isInitialized = true

    } catch (error) {
      console.error('❌ Failed to initialize Electron State Bridge:', error)
      throw error
    }
  }

  /**
   * Enhanced state persistence with cross-platform support
   */
  async persistState(snapshot: WorkflowStateSnapshot, workspaceId?: string): Promise<boolean> {
    try {
      const startTime = performance.now()
      
      // Get platform-appropriate storage path
      const storagePath = await ElectronPathUtils.getWorkflowStatePath(workspaceId)
      
      // Prepare state data with Electron metadata
      const electronSnapshot = {
        ...snapshot,
        electronMetadata: {
          platform: await ElectronPathUtils.getPlatform(),
          appVersion: await ElectronIPCBridge.safeIPCCall<string>('getAppVersion'),
          storagePath: await ElectronPathUtils.normalizePath(storagePath),
          persistedAt: createTimestamp(),
          processId: `renderer-${process.pid || 'unknown'}`
        }
      }

      // Persist through IPC
      const result = await ElectronIPCBridge.safeIPCCall('setConfig', {
        section: 'workflowState',
        value: electronSnapshot
      })

      const duration = performance.now() - startTime
      ElectronDebugCollector.updatePerformanceMetrics({ stateTransitionTime: duration })

      console.log(`💾 State persisted successfully (${duration.toFixed(2)}ms)`)
      return result !== null

    } catch (error) {
      console.error('❌ Failed to persist state:', error)
      return false
    }
  }

  /**
   * Load state with Electron-specific restoration
   */
  async loadState(workspaceId?: string): Promise<WorkflowStateSnapshot | null> {
    try {
      const startTime = performance.now()

      // Load through IPC
      const config = await ElectronIPCBridge.safeIPCCall<any>('getConfig')
      const savedState = config?.workflowState

      if (!savedState) {
        console.log('📂 No saved state found')
        return null
      }

      // Validate Electron metadata
      if (savedState.electronMetadata) {
        const currentPlatform = await ElectronPathUtils.getPlatform()
        if (savedState.electronMetadata.platform !== currentPlatform) {
          console.warn(`⚠️ Platform mismatch: saved on ${savedState.electronMetadata.platform}, running on ${currentPlatform}`)
        }
      }

      const duration = performance.now() - startTime
      console.log(`📂 State loaded successfully (${duration.toFixed(2)}ms)`)

      return savedState as WorkflowStateSnapshot

    } catch (error) {
      console.error('❌ Failed to load state:', error)
      return null
    }
  }

  /**
   * Enhanced state change notification with Electron debugging
   */
  notifyStateChange(event: StateChangeEvent, context?: Record<string, any>): void {
    // Log to DevTools with enhanced information
    ElectronDevToolsIntegration.logStateChange(event, {
      ...context,
      processType: 'renderer',
      processId: process.pid || 'unknown',
      platform: ElectronPathUtils.platform || 'unknown',
      timestamp: new Date().toISOString()
    })

    // Record for debugging
    ElectronDebugCollector.recordStateChange(event)
  }

  /**
   * Get comprehensive Electron environment information
   */
  async getElectronEnvironmentInfo(): Promise<Record<string, any>> {
    return ElectronDebugCollector.collectEnvironmentInfo()
  }

  /**
   * Generate debug report for troubleshooting
   */
  async generateDebugReport(): Promise<string> {
    return ElectronDebugCollector.generateDebugReport()
  }

  /**
   * Cleanup resources when shutting down
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Electron State Bridge')
    
    // Remove all listeners if available
    try {
      window.electronAPI?.removeAllListeners()
      window.cantocapAPI?.removeAllListeners()
    } catch (error) {
      console.warn('Warning during cleanup:', error)
    }

    ElectronStateBridge.isInitialized = false
    ElectronStateBridge.instance = null
  }
}

// Export utilities for direct usage
export {
  ElectronPathUtils,
  ElectronIPCBridge,
  ElectronDebugCollector,
  ElectronDevToolsIntegration
}

// Auto-initialize if in Electron environment
if (typeof window !== 'undefined' && (window.electronAPI || window.cantocapAPI)) {
  const bridge = ElectronStateBridge.getInstance()
  bridge.initialize().catch(console.error)
}