/**
 * Electron-specific State Validation Utilities
 * Provides comprehensive validation for workflow state management in Electron context
 * 
 * Features:
 * - Cross-platform path validation
 * - IPC communication state verification
 * - Process isolation compatibility checks
 * - Memory usage validation
 * - Security context verification
 * - Performance threshold validation
 */

import { 
  StepState, 
  StepId, 
  WorkflowStateSnapshot,
  TypeGuards,
  StateChangeEvent,
  createStepId,
  createTimestamp
} from '../types/workflow-state'
import { ElectronStateBridge, ElectronIPCBridge, ElectronPathUtils } from '../services/electron-state-bridge'

/**
 * Electron-specific validation error types
 */
export interface ElectronValidationError {
  code: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'security' | 'performance' | 'compatibility' | 'integrity'
  context?: Record<string, any>
  recommendation?: string
}

/**
 * Validation result with detailed diagnostics
 */
export interface ElectronValidationResult {
  isValid: boolean
  errors: ElectronValidationError[]
  warnings: ElectronValidationError[]
  performance: {
    validationTime: number
    memoryUsage?: number
    ipcLatency?: number
  }
  environment: {
    platform: string
    ipcHealthy: boolean
    contextIsolated: boolean
    sandboxed: boolean
  }
}

/**
 * Comprehensive Electron state validator
 */
export class ElectronStateValidator {
  private static instance: ElectronStateValidator | null = null
  private bridge = ElectronStateBridge.getInstance()
  private validationCache = new Map<string, { result: ElectronValidationResult; timestamp: number }>()
  private readonly CACHE_TTL = 30000 // 30 seconds

  private constructor() {}

  static getInstance(): ElectronStateValidator {
    if (!this.instance) {
      this.instance = new ElectronStateValidator()
    }
    return this.instance
  }

  /**
   * Validate complete workflow state snapshot
   */
  async validateWorkflowState(snapshot: WorkflowStateSnapshot): Promise<ElectronValidationResult> {
    const startTime = performance.now()
    const errors: ElectronValidationError[] = []
    const warnings: ElectronValidationError[] = []

    try {
      // Get environment info
      const envInfo = await this.bridge.getElectronEnvironmentInfo()
      const environment = {
        platform: envInfo.electron?.platform || 'unknown',
        ipcHealthy: envInfo.electron?.ipcHealthy || false,
        contextIsolated: envInfo.electron?.contextIsolated || false,
        sandboxed: envInfo.electron?.sandboxed || false
      }

      // 1. Basic structural validation
      const structuralErrors = this.validateStructure(snapshot)
      errors.push(...structuralErrors)

      // 2. Cross-platform compatibility validation
      const compatibilityErrors = await this.validateCrossPlatformCompatibility(snapshot)
      errors.push(...compatibilityErrors)

      // 3. Security context validation
      const securityErrors = this.validateSecurityContext(environment)
      errors.push(...securityErrors)

      // 4. Performance validation
      const performanceErrors = await this.validatePerformance(envInfo)
      errors.push(...performanceErrors.errors)
      warnings.push(...performanceErrors.warnings)

      // 5. IPC communication validation
      const ipcErrors = await this.validateIPCCommunication()
      errors.push(...ipcErrors)

      // 6. Memory usage validation
      const memoryErrors = this.validateMemoryUsage(envInfo.memory)
      errors.push(...memoryErrors.errors)
      warnings.push(...memoryErrors.warnings)

      const validationTime = performance.now() - startTime

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        performance: {
          validationTime,
          memoryUsage: envInfo.memory?.usedJSHeapSize,
          ipcLatency: await this.measureIPCLatency()
        },
        environment
      }

    } catch (error) {
      errors.push({
        code: 'VALIDATION_FAILED',
        message: `State validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical',
        category: 'integrity',
        context: { error: error instanceof Error ? error.stack : undefined }
      })

      return {
        isValid: false,
        errors,
        warnings,
        performance: {
          validationTime: performance.now() - startTime
        },
        environment: {
          platform: 'unknown',
          ipcHealthy: false,
          contextIsolated: false,
          sandboxed: false
        }
      }
    }
  }

  /**
   * Validate state change in Electron context
   */
  async validateStateChange(event: StateChangeEvent): Promise<ElectronValidationResult> {
    const cacheKey = `state-change-${event.stepId}-${event.oldState}-${event.newState}`
    
    // Check cache first
    const cached = this.validationCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result
    }

    const startTime = performance.now()
    const errors: ElectronValidationError[] = []
    const warnings: ElectronValidationError[] = []

    try {
      // Get environment info
      const envInfo = await this.bridge.getElectronEnvironmentInfo()
      const environment = {
        platform: envInfo.electron?.platform || 'unknown',
        ipcHealthy: envInfo.electron?.ipcHealthy || false,
        contextIsolated: envInfo.electron?.contextIsolated || false,
        sandboxed: envInfo.electron?.sandboxed || false
      }

      // Validate state transition logic
      if (!event.isValid) {
        errors.push({
          code: 'INVALID_STATE_TRANSITION',
          message: `Invalid state transition: ${event.oldState} → ${event.newState} for step ${event.stepId}`,
          severity: 'high',
          category: 'integrity',
          recommendation: 'Check transition rules and step dependencies'
        })
      }

      // Validate step ID format
      if (!TypeGuards.isStepId(event.stepId)) {
        errors.push({
          code: 'INVALID_STEP_ID',
          message: `Invalid step ID format: ${event.stepId}`,
          severity: 'medium',
          category: 'integrity',
          recommendation: 'Use kebab-case format (e.g., "input-file", "config")'
        })
      }

      // Validate timestamp
      if (!TypeGuards.isTimestamp(event.timestamp)) {
        errors.push({
          code: 'INVALID_TIMESTAMP',
          message: `Invalid timestamp: ${event.timestamp}`,
          severity: 'medium',
          category: 'integrity'
        })
      }

      // Check for timing issues in Electron context
      const now = Date.now()
      if (event.timestamp > now + 1000) { // Future timestamp beyond reasonable clock skew
        warnings.push({
          code: 'FUTURE_TIMESTAMP',
          message: `State change timestamp is in the future: ${new Date(event.timestamp).toISOString()}`,
          severity: 'low',
          category: 'compatibility',
          recommendation: 'Check system clock synchronization'
        })
      }

      // Validate process isolation context
      if (environment.contextIsolated && !environment.sandboxed) {
        warnings.push({
          code: 'MIXED_SECURITY_CONTEXT',
          message: 'Context isolation enabled but not sandboxed - consider full sandboxing for security',
          severity: 'medium',
          category: 'security',
          recommendation: 'Enable sandbox mode for enhanced security'
        })
      }

      const validationTime = performance.now() - startTime
      const result: ElectronValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        performance: {
          validationTime,
          memoryUsage: envInfo.memory?.usedJSHeapSize,
          ipcLatency: await this.measureIPCLatency()
        },
        environment
      }

      // Cache the result
      this.validationCache.set(cacheKey, { result, timestamp: Date.now() })

      return result

    } catch (error) {
      const result: ElectronValidationResult = {
        isValid: false,
        errors: [{
          code: 'STATE_CHANGE_VALIDATION_FAILED',
          message: `Failed to validate state change: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'critical',
          category: 'integrity'
        }],
        warnings,
        performance: {
          validationTime: performance.now() - startTime
        },
        environment: {
          platform: 'unknown',
          ipcHealthy: false,
          contextIsolated: false,
          sandboxed: false
        }
      }

      return result
    }
  }

  /**
   * Validate basic structural integrity
   */
  private validateStructure(snapshot: WorkflowStateSnapshot): ElectronValidationError[] {
    const errors: ElectronValidationError[] = []

    // Validate required fields
    if (!snapshot.currentStepId) {
      errors.push({
        code: 'MISSING_CURRENT_STEP',
        message: 'Workflow snapshot missing current step ID',
        severity: 'critical',
        category: 'integrity'
      })
    }

    if (!snapshot.steps || Object.keys(snapshot.steps).length === 0) {
      errors.push({
        code: 'EMPTY_STEPS',
        message: 'Workflow snapshot has no steps defined',
        severity: 'critical',
        category: 'integrity'
      })
    }

    if (!TypeGuards.isTimestamp(snapshot.timestamp)) {
      errors.push({
        code: 'INVALID_SNAPSHOT_TIMESTAMP',
        message: `Invalid snapshot timestamp: ${snapshot.timestamp}`,
        severity: 'high',
        category: 'integrity'
      })
    }

    if (!TypeGuards.isVersion(snapshot.version)) {
      errors.push({
        code: 'INVALID_VERSION',
        message: `Invalid version format: ${snapshot.version}`,
        severity: 'medium',
        category: 'compatibility'
      })
    }

    // Validate step consistency
    if (snapshot.steps && snapshot.currentStepId) {
      const currentStepExists = Object.values(snapshot.steps).some(
        step => step.id === snapshot.currentStepId
      )
      
      if (!currentStepExists) {
        errors.push({
          code: 'CURRENT_STEP_NOT_FOUND',
          message: `Current step "${snapshot.currentStepId}" not found in steps collection`,
          severity: 'high',
          category: 'integrity'
        })
      }
    }

    return errors
  }

  /**
   * Validate cross-platform compatibility
   */
  private async validateCrossPlatformCompatibility(snapshot: WorkflowStateSnapshot): Promise<ElectronValidationError[]> {
    const errors: ElectronValidationError[] = []

    try {
      const platform = await ElectronPathUtils.getPlatform()

      // Check for platform-specific path issues
      if (snapshot.restorationContext?.backupData) {
        const backupData = snapshot.restorationContext.backupData
        
        // Look for potential path issues
        Object.entries(backupData).forEach(([key, value]) => {
          if (typeof value === 'string' && this.looksLikePath(value)) {
            const hasWinPath = value.includes('\\')
            const hasUnixPath = value.includes('/')
            
            if (hasWinPath && platform !== 'win32') {
              errors.push({
                code: 'CROSS_PLATFORM_PATH_ISSUE',
                message: `Windows-style path detected on ${platform}: ${value}`,
                severity: 'medium',
                category: 'compatibility',
                context: { key, value, platform },
                recommendation: 'Use cross-platform path utilities'
              })
            }
          }
        })
      }

      // Check version compatibility
      if (snapshot.version && snapshot.version.includes('win') && platform !== 'win32') {
        errors.push({
          code: 'PLATFORM_VERSION_MISMATCH',
          message: `Snapshot version suggests Windows but running on ${platform}`,
          severity: 'low',
          category: 'compatibility'
        })
      }

    } catch (error) {
      errors.push({
        code: 'PLATFORM_VALIDATION_FAILED',
        message: `Failed to validate platform compatibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium',
        category: 'compatibility'
      })
    }

    return errors
  }

  /**
   * Validate security context
   */
  private validateSecurityContext(environment: ElectronValidationResult['environment']): ElectronValidationError[] {
    const errors: ElectronValidationError[] = []

    // Check context isolation
    if (!environment.contextIsolated) {
      errors.push({
        code: 'CONTEXT_ISOLATION_DISABLED',
        message: 'Context isolation is disabled - security risk',
        severity: 'high',
        category: 'security',
        recommendation: 'Enable contextIsolation in webPreferences'
      })
    }

    // Check sandboxing (warning, not error as it may be intentionally disabled)
    if (!environment.sandboxed) {
      errors.push({
        code: 'SANDBOX_DISABLED',
        message: 'Sandbox mode is disabled - reduced security',
        severity: 'medium',
        category: 'security',
        recommendation: 'Consider enabling sandbox mode if Node.js access is not required'
      })
    }

    return errors
  }

  /**
   * Validate performance metrics
   */
  private async validatePerformance(envInfo: any): Promise<{ errors: ElectronValidationError[]; warnings: ElectronValidationError[] }> {
    const errors: ElectronValidationError[] = []
    const warnings: ElectronValidationError[] = []

    try {
      // Memory usage validation
      if (envInfo.memory?.available && envInfo.memory.usedJSHeapSize) {
        const memoryMB = envInfo.memory.usedJSHeapSize / (1024 * 1024)
        
        if (memoryMB > 200) { // 200MB threshold
          errors.push({
            code: 'HIGH_MEMORY_USAGE',
            message: `High memory usage: ${memoryMB.toFixed(1)}MB`,
            severity: 'high',
            category: 'performance',
            context: { memoryMB },
            recommendation: 'Consider optimizing state management or clearing unused data'
          })
        } else if (memoryMB > 100) { // 100MB warning threshold
          warnings.push({
            code: 'ELEVATED_MEMORY_USAGE',
            message: `Elevated memory usage: ${memoryMB.toFixed(1)}MB`,
            severity: 'medium',
            category: 'performance',
            context: { memoryMB },
            recommendation: 'Monitor memory usage and consider optimization'
          })
        }
      }

      // State transition performance
      if (envInfo.session?.performanceMetrics?.stateTransitionTime) {
        const transitionTime = envInfo.session.performanceMetrics.stateTransitionTime
        
        if (transitionTime > 100) {
          errors.push({
            code: 'SLOW_STATE_TRANSITIONS',
            message: `Slow state transitions: ${transitionTime.toFixed(2)}ms`,
            severity: 'medium',
            category: 'performance',
            recommendation: 'Optimize state transition logic'
          })
        } else if (transitionTime > 50) {
          warnings.push({
            code: 'SUBOPTIMAL_STATE_TRANSITIONS',
            message: `Suboptimal state transition time: ${transitionTime.toFixed(2)}ms`,
            severity: 'low',
            category: 'performance',
            recommendation: 'Consider performance optimizations'
          })
        }
      }

    } catch (error) {
      warnings.push({
        code: 'PERFORMANCE_VALIDATION_FAILED',
        message: `Failed to validate performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'low',
        category: 'performance'
      })
    }

    return { errors, warnings }
  }

  /**
   * Validate IPC communication health
   */
  private async validateIPCCommunication(): Promise<ElectronValidationError[]> {
    const errors: ElectronValidationError[] = []

    try {
      const isHealthy = await ElectronIPCBridge.checkIPCHealth()
      
      if (!isHealthy) {
        errors.push({
          code: 'IPC_COMMUNICATION_FAILED',
          message: 'IPC communication with main process is unhealthy',
          severity: 'critical',
          category: 'integrity',
          recommendation: 'Check main process connectivity and restart if necessary'
        })
      }
    } catch (error) {
      errors.push({
        code: 'IPC_VALIDATION_FAILED',
        message: `Failed to validate IPC communication: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'high',
        category: 'integrity'
      })
    }

    return errors
  }

  /**
   * Validate memory usage
   */
  private validateMemoryUsage(memoryInfo: any): { errors: ElectronValidationError[]; warnings: ElectronValidationError[] } {
    const errors: ElectronValidationError[] = []
    const warnings: ElectronValidationError[] = []

    if (!memoryInfo?.available) {
      warnings.push({
        code: 'MEMORY_INFO_UNAVAILABLE',
        message: 'Memory usage information not available',
        severity: 'low',
        category: 'performance',
        recommendation: 'Performance monitoring may be limited'
      })
      return { errors, warnings }
    }

    try {
      const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = memoryInfo
      
      // Check heap usage percentage
      const heapUsagePercent = (usedJSHeapSize / jsHeapSizeLimit) * 100
      
      if (heapUsagePercent > 80) {
        errors.push({
          code: 'CRITICAL_MEMORY_USAGE',
          message: `Critical memory usage: ${heapUsagePercent.toFixed(1)}% of heap limit`,
          severity: 'critical',
          category: 'performance',
          context: { heapUsagePercent, usedJSHeapSize, jsHeapSizeLimit },
          recommendation: 'Immediate memory cleanup required - consider restarting'
        })
      } else if (heapUsagePercent > 60) {
        warnings.push({
          code: 'HIGH_HEAP_USAGE',
          message: `High heap usage: ${heapUsagePercent.toFixed(1)}% of limit`,
          severity: 'medium',
          category: 'performance',
          context: { heapUsagePercent },
          recommendation: 'Monitor memory usage and consider cleanup'
        })
      }

      // Check if approaching total heap size
      const totalUsagePercent = (usedJSHeapSize / totalJSHeapSize) * 100
      if (totalUsagePercent > 90) {
        warnings.push({
          code: 'HEAP_FRAGMENTATION',
          message: `Potential heap fragmentation: ${totalUsagePercent.toFixed(1)}% of allocated heap used`,
          severity: 'medium',
          category: 'performance',
          recommendation: 'Consider triggering garbage collection'
        })
      }

    } catch (error) {
      warnings.push({
        code: 'MEMORY_VALIDATION_FAILED',
        message: `Failed to validate memory usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'low',
        category: 'performance'
      })
    }

    return { errors, warnings }
  }

  /**
   * Measure IPC latency
   */
  private async measureIPCLatency(): Promise<number> {
    try {
      const startTime = performance.now()
      await ElectronIPCBridge.safeIPCCall('getPlatform')
      return performance.now() - startTime
    } catch {
      return -1 // Indicates measurement failed
    }
  }

  /**
   * Check if a string looks like a file path
   */
  private looksLikePath(str: string): boolean {
    return /^[a-zA-Z]:[\\\/]/.test(str) || // Windows absolute path
           str.startsWith('/') || // Unix absolute path
           str.startsWith('./') || // Relative path
           str.startsWith('../') || // Parent relative path
           str.includes('\\') || // Contains backslash
           /\.[a-zA-Z0-9]{1,4}$/.test(str) // Has file extension
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear()
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    cacheSize: number
    cacheHitRate: number
    totalValidations: number
  } {
    // This would be implemented with proper tracking
    return {
      cacheSize: this.validationCache.size,
      cacheHitRate: 0, // Would track hits vs misses
      totalValidations: 0 // Would track total validation calls
    }
  }
}

/**
 * Convenience function for quick validation
 */
export async function validateElectronState(snapshot: WorkflowStateSnapshot): Promise<ElectronValidationResult> {
  const validator = ElectronStateValidator.getInstance()
  return validator.validateWorkflowState(snapshot)
}

/**
 * Convenience function for state change validation
 */
export async function validateElectronStateChange(event: StateChangeEvent): Promise<ElectronValidationResult> {
  const validator = ElectronStateValidator.getInstance()
  return validator.validateStateChange(event)
}

/**
 * Export validator instance for direct usage
 */
export const electronStateValidator = ElectronStateValidator.getInstance()