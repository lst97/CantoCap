/**
 * Electron Integration Configuration
 * Central configuration for all Electron-specific features and enhancements
 * 
 * Features:
 * - Environment detection
 * - Performance thresholds
 * - Security settings
 * - Debug configuration
 * - Cross-platform settings
 */

import { ElectronStateBridge } from '../services/electron-state-bridge'
import { ElectronStateValidator } from '../utils/electron-state-validation'

/**
 * Electron environment configuration
 */
export interface ElectronConfig {
  // Performance Settings
  performance: {
    // Memory thresholds in MB
    memoryWarningThreshold: number
    memoryCriticalThreshold: number
    
    // Timing thresholds in ms
    stateTransitionWarningThreshold: number
    stateTransitionCriticalThreshold: number
    ipcLatencyWarningThreshold: number
    ipcLatencyCriticalThreshold: number
    
    // Validation settings
    validationCacheSize: number
    validationCacheTTL: number
  }

  // Security Settings
  security: {
    requireContextIsolation: boolean
    preferSandboxMode: boolean
    validateIPCCalls: boolean
    logSecurityEvents: boolean
  }

  // Debug Settings
  debug: {
    enabled: boolean
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    persistLogs: boolean
    maxLogEntries: number
    enablePerformanceMonitoring: boolean
    enableStateValidation: boolean
  }

  // Cross-platform Settings
  crossPlatform: {
    normalizePathsAutomatically: boolean
    warnOnPlatformMismatch: boolean
    validatePathCompatibility: boolean
  }

  // Auto-initialization Settings
  autoInit: {
    enabled: boolean
    validateOnStartup: boolean
    preloadValidationCache: boolean
    enableDebugConsoleCommands: boolean
  }
}

/**
 * Default Electron configuration
 */
export const DEFAULT_ELECTRON_CONFIG: ElectronConfig = {
  performance: {
    memoryWarningThreshold: 100, // 100MB
    memoryCriticalThreshold: 200, // 200MB
    stateTransitionWarningThreshold: 50, // 50ms
    stateTransitionCriticalThreshold: 100, // 100ms
    ipcLatencyWarningThreshold: 20, // 20ms
    ipcLatencyCriticalThreshold: 50, // 50ms
    validationCacheSize: 100,
    validationCacheTTL: 30000 // 30 seconds
  },

  security: {
    requireContextIsolation: true,
    preferSandboxMode: false, // May need Node.js access
    validateIPCCalls: true,
    logSecurityEvents: true
  },

  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    persistLogs: false,
    maxLogEntries: 1000,
    enablePerformanceMonitoring: true,
    enableStateValidation: true
  },

  crossPlatform: {
    normalizePathsAutomatically: true,
    warnOnPlatformMismatch: true,
    validatePathCompatibility: true
  },

  autoInit: {
    enabled: true,
    validateOnStartup: true,
    preloadValidationCache: false,
    enableDebugConsoleCommands: process.env.NODE_ENV === 'development'
  }
}

/**
 * Current runtime configuration
 */
let currentConfig: ElectronConfig = { ...DEFAULT_ELECTRON_CONFIG }

/**
 * Configuration manager for Electron integration
 */
export class ElectronConfigManager {
  private static instance: ElectronConfigManager | null = null
  private config: ElectronConfig
  private listeners: Array<(config: ElectronConfig) => void> = []

  private constructor(initialConfig: ElectronConfig = DEFAULT_ELECTRON_CONFIG) {
    this.config = { ...initialConfig }
  }

  static getInstance(initialConfig?: ElectronConfig): ElectronConfigManager {
    if (!this.instance) {
      this.instance = new ElectronConfigManager(initialConfig)
    }
    return this.instance
  }

  /**
   * Get current configuration
   */
  getConfig(): ElectronConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ElectronConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      // Deep merge nested objects
      performance: { ...this.config.performance, ...updates.performance },
      security: { ...this.config.security, ...updates.security },
      debug: { ...this.config.debug, ...updates.debug },
      crossPlatform: { ...this.config.crossPlatform, ...updates.crossPlatform },
      autoInit: { ...this.config.autoInit, ...updates.autoInit }
    }

    // Update global config
    currentConfig = { ...this.config }

    // Notify listeners
    this.listeners.forEach(listener => listener(this.config))
  }

  /**
   * Add configuration change listener
   */
  addListener(listener: (config: ElectronConfig) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.updateConfig(DEFAULT_ELECTRON_CONFIG)
  }

  /**
   * Validate current configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate performance thresholds
    if (this.config.performance.memoryWarningThreshold >= this.config.performance.memoryCriticalThreshold) {
      errors.push('Memory warning threshold must be less than critical threshold')
    }

    if (this.config.performance.stateTransitionWarningThreshold >= this.config.performance.stateTransitionCriticalThreshold) {
      errors.push('State transition warning threshold must be less than critical threshold')
    }

    if (this.config.performance.ipcLatencyWarningThreshold >= this.config.performance.ipcLatencyCriticalThreshold) {
      errors.push('IPC latency warning threshold must be less than critical threshold')
    }

    // Validate cache settings
    if (this.config.performance.validationCacheSize < 10) {
      errors.push('Validation cache size must be at least 10')
    }

    if (this.config.performance.validationCacheTTL < 1000) {
      errors.push('Validation cache TTL must be at least 1000ms')
    }

    // Validate debug settings
    if (this.config.debug.maxLogEntries < 100) {
      errors.push('Max log entries must be at least 100')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get configuration for specific environment
   */
  getEnvironmentConfig(): ElectronConfig {
    const baseConfig = { ...this.config }

    // Adjust for production environment
    if (process.env.NODE_ENV === 'production') {
      baseConfig.debug.enabled = false
      baseConfig.debug.logLevel = 'error'
      baseConfig.debug.enablePerformanceMonitoring = false
      baseConfig.autoInit.enableDebugConsoleCommands = false
    }

    // Adjust for test environment
    if (process.env.NODE_ENV === 'test') {
      baseConfig.debug.persistLogs = false
      baseConfig.performance.validationCacheTTL = 1000 // Shorter cache for tests
      baseConfig.autoInit.validateOnStartup = false
    }

    return baseConfig
  }
}

/**
 * Initialize Electron integration with configuration
 */
export async function initializeElectronIntegration(config?: Partial<ElectronConfig>): Promise<void> {
  const configManager = ElectronConfigManager.getInstance()
  
  if (config) {
    configManager.updateConfig(config)
  }

  const finalConfig = configManager.getEnvironmentConfig()

  // Validate configuration
  const validation = configManager.validateConfig()
  if (!validation.isValid) {
    console.warn('Electron configuration validation failed:', validation.errors)
  }

  // Initialize components if auto-init is enabled
  if (finalConfig.autoInit.enabled) {
    try {
      // Initialize state bridge
      const bridge = ElectronStateBridge.getInstance()
      await bridge.initialize()

      // Initialize validator with cache settings
      const validator = ElectronStateValidator.getInstance()
      
      // Preload validation cache if enabled
      if (finalConfig.autoInit.preloadValidationCache) {
        // Preload common validation patterns
        // This would be implemented based on common use cases
      }

      // Enable debug console commands if requested
      if (finalConfig.autoInit.enableDebugConsoleCommands) {
        // Debug commands are exposed in ElectronDevToolsIntegration
      }

      console.log('✅ Electron integration initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize Electron integration:', error)
      throw error
    }
  }
}

/**
 * Get current global configuration
 */
export function getElectronConfig(): ElectronConfig {
  return { ...currentConfig }
}

/**
 * Update global configuration
 */
export function updateElectronConfig(updates: Partial<ElectronConfig>): void {
  const configManager = ElectronConfigManager.getInstance()
  configManager.updateConfig(updates)
}

/**
 * Configuration presets for different use cases
 */
export const ELECTRON_CONFIG_PRESETS = {
  development: {
    ...DEFAULT_ELECTRON_CONFIG,
    debug: {
      ...DEFAULT_ELECTRON_CONFIG.debug,
      enabled: true,
      logLevel: 'debug' as const,
      enablePerformanceMonitoring: true,
      enableStateValidation: true
    },
    autoInit: {
      ...DEFAULT_ELECTRON_CONFIG.autoInit,
      validateOnStartup: true,
      enableDebugConsoleCommands: true
    }
  },

  production: {
    ...DEFAULT_ELECTRON_CONFIG,
    debug: {
      ...DEFAULT_ELECTRON_CONFIG.debug,
      enabled: false,
      logLevel: 'error' as const,
      enablePerformanceMonitoring: false,
      enableStateValidation: false
    },
    performance: {
      ...DEFAULT_ELECTRON_CONFIG.performance,
      validationCacheSize: 50, // Smaller cache in production
      validationCacheTTL: 60000 // Longer TTL in production
    }
  },

  testing: {
    ...DEFAULT_ELECTRON_CONFIG,
    debug: {
      ...DEFAULT_ELECTRON_CONFIG.debug,
      enabled: true,
      logLevel: 'info' as const,
      persistLogs: false,
      maxLogEntries: 100
    },
    performance: {
      ...DEFAULT_ELECTRON_CONFIG.performance,
      validationCacheTTL: 1000 // Short TTL for tests
    },
    autoInit: {
      ...DEFAULT_ELECTRON_CONFIG.autoInit,
      validateOnStartup: false,
      enableDebugConsoleCommands: false
    }
  },

  highPerformance: {
    ...DEFAULT_ELECTRON_CONFIG,
    performance: {
      ...DEFAULT_ELECTRON_CONFIG.performance,
      memoryWarningThreshold: 50, // Lower thresholds
      memoryCriticalThreshold: 100,
      stateTransitionWarningThreshold: 25,
      stateTransitionCriticalThreshold: 50,
      validationCacheSize: 200, // Larger cache
      validationCacheTTL: 60000 // Longer TTL
    },
    debug: {
      ...DEFAULT_ELECTRON_CONFIG.debug,
      enablePerformanceMonitoring: true,
      enableStateValidation: true
    }
  },

  secure: {
    ...DEFAULT_ELECTRON_CONFIG,
    security: {
      requireContextIsolation: true,
      preferSandboxMode: true,
      validateIPCCalls: true,
      logSecurityEvents: true
    },
    debug: {
      ...DEFAULT_ELECTRON_CONFIG.debug,
      logLevel: 'warn' as const,
      enableStateValidation: true // Keep validation for security
    }
  }
} as const

/**
 * Apply a configuration preset
 */
export function applyElectronConfigPreset(preset: keyof typeof ELECTRON_CONFIG_PRESETS): void {
  const configManager = ElectronConfigManager.getInstance()
  configManager.updateConfig(ELECTRON_CONFIG_PRESETS[preset])
}

/**
 * Export the configuration manager instance
 */
export const electronConfigManager = ElectronConfigManager.getInstance()

// Auto-initialize if enabled and in browser environment
if (typeof window !== 'undefined' && DEFAULT_ELECTRON_CONFIG.autoInit.enabled) {
  initializeElectronIntegration().catch(console.error)
}