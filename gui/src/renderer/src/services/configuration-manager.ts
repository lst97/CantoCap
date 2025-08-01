/**
 * Centralized Workspace Configuration Manager
 * 
 * Provides workspace-aware configuration management with automatic routing
 * between app store and workspace store based on config key categorization.
 * 
 * Key Features:
 * - Automatic workspace context detection
 * - Intelligent routing to appropriate stores
 * - Graceful workspace transition handling
 * - Type-safe configuration operations
 * - Error recovery and validation
 */

import { useEffect } from 'react'
import { useAppStore } from '../stores/app-store'
import { useWorkspaceStore } from '../stores/workspace-store'
import type { AppConfig } from '../../../types'
import type { WorkflowStepId, StepConfigMap } from '../types/workspace'

// Configuration categories for intelligent routing
const WORKSPACE_SPECIFIC_KEYS: (keyof AppConfig)[] = [
  'inputFile', 'outputFile', 'language', 'model', 'priority', 
  'speakers', 'written', 'music', 'charset', 'noGeminiRefinement',
  'maxChunkDuration', 'videoQuality', 'terminologyConfig', 
  'subtitle', 'duration', 'verbose', 'startTime', 'endTime', 'importedJsonFile'
]

const GLOBAL_KEYS: (keyof AppConfig)[] = [
  'geminiKey', 'hfToken', 'ffmpegPath'
]

// Configuration update options
export interface ConfigUpdateOptions {
  /**
   * Whether to merge with existing config (default: true)
   */
  merge?: boolean
  
  /**
   * Skip validation checks (default: false)
   */
  skipValidation?: boolean
  
  /**
   * Priority for auto-save operations (default: 'normal')
   */
  priority?: 'critical' | 'normal' | 'low'
  
  /**
   * Force update even if workspace is transitioning (default: false)
   */
  forceUpdate?: boolean
}

// Configuration operation result
export interface ConfigOperationResult {
  success: boolean
  targetStore: 'app' | 'workspace' | 'both'
  workspaceId?: string
  error?: Error
  rollbackAvailable?: boolean
}

// Workspace transition state
interface WorkspaceTransitionState {
  isTransitioning: boolean
  fromWorkspaceId?: string
  toWorkspaceId?: string
  transitionStartTime?: number
}

/**
 * Centralized Configuration Manager
 * 
 * Provides workspace-aware configuration operations with automatic routing
 * and intelligent error handling.
 */
export class ConfigurationManager {
  private transitionState: WorkspaceTransitionState = { isTransitioning: false }
  private readonly TRANSITION_TIMEOUT = 5000 // 5 seconds
  
  /**
   * Set configuration value with automatic workspace targeting
   * 
   * @param key - Configuration key
   * @param value - Configuration value
   * @param options - Update options
   * @returns Promise resolving to operation result
   */
  async setConfig<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
    options: ConfigUpdateOptions = {}
  ): Promise<ConfigOperationResult> {
    const {
      merge = true,
      skipValidation = false,
      priority = 'normal',
      forceUpdate = false
    } = options

    try {
      // Check workspace transition state
      if (this.transitionState.isTransitioning && !forceUpdate) {
        const isTimedOut = this.transitionState.transitionStartTime &&
          (Date.now() - this.transitionState.transitionStartTime) > this.TRANSITION_TIMEOUT

        if (isTimedOut) {
          console.warn('Workspace transition timed out, forcing update')
          this.clearTransitionState()
        } else {
          throw new Error('Workspace is transitioning. Use forceUpdate option if necessary.')
        }
      }

      // Validate configuration if requested
      if (!skipValidation) {
        const validationResult = this.validateConfig(key, value)
        if (!validationResult.isValid) {
          throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`)
        }
      }

      // Determine target store and execute update
      const targetStore = this.determineTargetStore(key)
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace
      
      const result: ConfigOperationResult = {
        success: false,
        targetStore,
        workspaceId: currentWorkspace?.id
      }

      switch (targetStore) {
        case 'app':
          // Route to app store for global settings
          useAppStore.getState().updateConfig(key, value)
          result.success = true
          break

        case 'workspace':
          // Route to workspace store for workspace-specific settings
          if (!currentWorkspace) {
            throw new Error('No active workspace for workspace-specific configuration')
          }
          
          // Update through app store (which will route to workspace store)
          useAppStore.getState().updateConfig(key, value)
          result.success = true
          result.workspaceId = currentWorkspace.id
          break

        case 'both':
          // Update both stores if configuration affects both
          useAppStore.getState().updateConfig(key, value)
          result.success = true
          result.workspaceId = currentWorkspace?.id
          break

        default:
          throw new Error(`Unknown target store: ${targetStore}`)
      }

      return result

    } catch (error) {
      const result: ConfigOperationResult = {
        success: false,
        targetStore: this.determineTargetStore(key),
        workspaceId: useWorkspaceStore.getState().currentWorkspace?.id,
        error: error as Error,
        rollbackAvailable: false // Could be enhanced with rollback capability
      }

      console.error('Configuration update failed:', error)
      return result
    }
  }

  /**
   * Get configuration value with workspace context awareness
   * 
   * @param key - Configuration key
   * @returns Promise resolving to configuration value
   */
  async getConfig<K extends keyof AppConfig>(key: K): Promise<AppConfig[K]> {
    const appStore = useAppStore.getState()
    
    // Check workspace transition state
    if (this.transitionState.isTransitioning) {
      // During transition, prefer the target workspace config if available
      const workspaceStore = useWorkspaceStore.getState()
      const targetWorkspace = workspaceStore.currentWorkspace
      
      if (targetWorkspace && WORKSPACE_SPECIFIC_KEYS.includes(key)) {
        return targetWorkspace.config[key] as AppConfig[K]
      }
    }

    return appStore.config[key]
  }

  /**
   * Set step configuration with workspace targeting
   * 
   * @param stepId - Step identifier
   * @param config - Step configuration partial
   * @param options - Update options
   * @returns Promise resolving to operation result
   */
  async setStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K,
    config: Partial<T>,
    options: ConfigUpdateOptions = {}
  ): Promise<ConfigOperationResult> {
    const {
      merge = true,
      skipValidation = false,
      priority = 'normal',
      forceUpdate = false
    } = options

    try {
      // Check workspace availability
      const workspaceStore = useWorkspaceStore.getState()
      const currentWorkspace = workspaceStore.currentWorkspace

      if (!currentWorkspace) {
        throw new Error('No active workspace for step configuration')
      }

      // Check workspace transition state
      if (this.transitionState.isTransitioning && !forceUpdate) {
        throw new Error('Workspace is transitioning. Use forceUpdate option if necessary.')
      }

      // Update step configuration through workspace store
      await workspaceStore.setStepConfig<T, K>(
        currentWorkspace.id,
        stepId,
        config,
        {
          merge,
          skipValidation,
          skipCache: false,
          createBackup: priority === 'critical'
        }
      )

      return {
        success: true,
        targetStore: 'workspace',
        workspaceId: currentWorkspace.id
      }

    } catch (error) {
      return {
        success: false,
        targetStore: 'workspace',
        workspaceId: useWorkspaceStore.getState().currentWorkspace?.id,
        error: error as Error
      }
    }
  }

  /**
   * Get step configuration with workspace context
   * 
   * @param stepId - Step identifier
   * @returns Promise resolving to step configuration
   */
  async getStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
    stepId: K
  ): Promise<T | null> {
    const workspaceStore = useWorkspaceStore.getState()
    const currentWorkspace = workspaceStore.currentWorkspace

    if (!currentWorkspace) {
      throw new Error('No active workspace for step configuration')
    }

    return await workspaceStore.getStepConfig<T, K>(currentWorkspace.id, stepId)
  }

  /**
   * Handle workspace transition events
   * 
   * @param fromWorkspaceId - Source workspace ID
   * @param toWorkspaceId - Target workspace ID
   */
  onWorkspaceTransitionStart(fromWorkspaceId?: string, toWorkspaceId?: string): void {
    this.transitionState = {
      isTransitioning: true,
      fromWorkspaceId,
      toWorkspaceId,
      transitionStartTime: Date.now()
    }

    console.log('Workspace transition started:', { fromWorkspaceId, toWorkspaceId })
  }

  /**
   * Handle workspace transition completion
   */
  onWorkspaceTransitionComplete(): void {
    console.log('Workspace transition completed')
    this.clearTransitionState()
  }

  /**
   * Handle workspace transition errors
   * 
   * @param error - Transition error
   */
  onWorkspaceTransitionError(error: Error): void {
    console.error('Workspace transition error:', error)
    this.clearTransitionState()
  }

  /**
   * Check if manager is ready for operations
   * 
   * @returns True if manager is ready
   */
  isReady(): boolean {
    const appStore = useAppStore.getState()
    const workspaceStore = useWorkspaceStore.getState()
    
    return appStore.isInitialized && 
           workspaceStore.isInitialized && 
           !this.transitionState.isTransitioning
  }

  /**
   * Get current workspace context information
   * 
   * @returns Workspace context info
   */
  getWorkspaceContext() {
    const workspaceStore = useWorkspaceStore.getState()
    const appStore = useAppStore.getState()
    
    return {
      currentWorkspaceId: workspaceStore.currentWorkspace?.id || null,
      hasWorkspaces: workspaceStore.availableWorkspaces.length > 0,
      isTransitioning: this.transitionState.isTransitioning,
      isReady: this.isReady(),
      appInitialized: appStore.isInitialized,
      workspaceInitialized: workspaceStore.isInitialized
    }
  }

  /**
   * Validate configuration value
   * 
   * @param key - Configuration key
   * @param value - Configuration value
   * @returns Validation result
   */
  private validateConfig<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Basic validation rules
    if (value === undefined) {
      errors.push(`Configuration value for '${key}' cannot be undefined`)
    }

    // Key-specific validation
    switch (key) {
      case 'language':
        if (typeof value === 'string' && !['zh', 'en', 'es', 'fr', 'de', 'ja'].includes(value)) {
          errors.push(`Invalid language code: ${value}`)
        }
        break

      case 'priority':
        if (typeof value === 'string' && !['speed', 'balanced', 'quality'].includes(value)) {
          errors.push(`Invalid priority: ${value}`)
        }
        break

      case 'charset':
        if (typeof value === 'string' && !['traditional', 'simplified'].includes(value)) {
          errors.push(`Invalid charset: ${value}`)
        }
        break

      case 'videoQuality':
        if (typeof value === 'string' && !['360p', '480p', '720p'].includes(value)) {
          errors.push(`Invalid video quality: ${value}`)
        }
        break

      case 'maxChunkDuration':
        if (typeof value === 'number' && (value < 1 || value > 60)) {
          errors.push(`Max chunk duration must be between 1 and 60 seconds`)
        }
        break

      case 'duration':
        if (typeof value === 'number' && value < 0) {
          errors.push(`Duration cannot be negative`)
        }
        break
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Determine which store should handle the configuration update
   * 
   * @param key - Configuration key
   * @returns Target store identifier
   */
  private determineTargetStore<K extends keyof AppConfig>(key: K): 'app' | 'workspace' | 'both' {
    if (WORKSPACE_SPECIFIC_KEYS.includes(key)) {
      return 'workspace'
    }
    
    if (GLOBAL_KEYS.includes(key)) {
      return 'app'
    }
    
    // For unknown keys, route to both stores to maintain compatibility
    return 'both'
  }

  /**
   * Clear workspace transition state
   */
  private clearTransitionState(): void {
    this.transitionState = { isTransitioning: false }
  }
}

// Create singleton instance
export const configurationManager = new ConfigurationManager()

/**
 * Hook for workspace transition event handling
 * This should be used in the workspace store or context to notify the configuration manager
 */
export const useConfigurationManagerEvents = () => {
  const workspaceStore = useWorkspaceStore()
  
  // Subscribe to workspace changes and notify configuration manager
  useEffect(() => {
    let previousWorkspaceId = workspaceStore.currentWorkspace?.id

    const unsubscribe = useWorkspaceStore.subscribe(
      (state) => state.currentWorkspace,
      (currentWorkspace) => {
        const currentWorkspaceId = currentWorkspace?.id

        if (previousWorkspaceId !== currentWorkspaceId) {
          if (previousWorkspaceId && currentWorkspaceId) {
            // Workspace switch
            configurationManager.onWorkspaceTransitionStart(previousWorkspaceId, currentWorkspaceId)
            
            // Simulate transition completion (in real app, this would be triggered by workspace load completion)
            setTimeout(() => {
              configurationManager.onWorkspaceTransitionComplete()
            }, 100)
          }
          
          previousWorkspaceId = currentWorkspaceId
        }
      }
    )

    return unsubscribe
  }, [workspaceStore])

  return {
    onTransitionStart: configurationManager.onWorkspaceTransitionStart.bind(configurationManager),
    onTransitionComplete: configurationManager.onWorkspaceTransitionComplete.bind(configurationManager),
    onTransitionError: configurationManager.onWorkspaceTransitionError.bind(configurationManager)
  }
}