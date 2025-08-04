/**
 * Config Persistence Event System
 * Replaces timer-based auto-save with immediate event-driven configuration persistence
 * Provides type-safe event coordination for all configuration updates
 */

import type { StepState, StepId } from '../types/workflow-state'

// Event type definitions for all configuration persistence events
export interface ConfigPersistenceEvents {
  'workflow-state-changed': {
    stepId: StepId
    previousState: StepState
    newState: StepState
    workspaceId: string | null
    metadata?: Record<string, any>
  }
  
  'user-interaction': {
    interactionType: 'file-selection' | 'setting-change' | 'step-navigation' | 'api-key-update'
    configSection: string
    configKey: string
    value: any
    workspaceId?: string | null
  }
  
  'config-update-required': {
    configSection: string
    updates: Record<string, any>
    priority: 'immediate' | 'normal'
    workspaceId?: string | null
  }
}

// Type-safe event emitter interface
export interface ConfigEventEmitter {
  emit<K extends keyof ConfigPersistenceEvents>(
    event: K, 
    data: ConfigPersistenceEvents[K]
  ): boolean
  
  on<K extends keyof ConfigPersistenceEvents>(
    event: K, 
    listener: (data: ConfigPersistenceEvents[K]) => Promise<void>
  ): void
  
  off<K extends keyof ConfigPersistenceEvents>(
    event: K, 
    listener: Function
  ): void
  
  removeAllListeners(event?: keyof ConfigPersistenceEvents): void
}

/**
 * Simple browser-compatible event emitter for configuration persistence
 * Replaces complex timer-based batching with immediate event dispatch
 */
class ConfigPersistenceEventSystem implements ConfigEventEmitter {
  private static instance: ConfigPersistenceEventSystem | null = null
  private listeners: Map<string, Set<Function>> = new Map()
  
  constructor() {
    // Browser-compatible event emitter implementation
  }
  
  static getInstance(): ConfigPersistenceEventSystem {
    if (!ConfigPersistenceEventSystem.instance) {
      ConfigPersistenceEventSystem.instance = new ConfigPersistenceEventSystem()
    }
    return ConfigPersistenceEventSystem.instance
  }
  
  // Type-safe event emission
  emit<K extends keyof ConfigPersistenceEvents>(
    event: K, 
    data: ConfigPersistenceEvents[K]
  ): boolean {
    console.log(`🔧 [CONFIG EVENT] Emitting ${event}:`, data)
    
    const eventListeners = this.listeners.get(event as string)
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          // Call listener asynchronously to avoid blocking
          Promise.resolve(listener(data)).catch(error => {
            console.error(`🚨 [CONFIG EVENT] Listener error for ${event}:`, error)
          })
        } catch (error) {
          console.error(`🚨 [CONFIG EVENT] Sync listener error for ${event}:`, error)
        }
      })
      return true
    }
    return false
  }
  
  // Type-safe event listener registration
  on<K extends keyof ConfigPersistenceEvents>(
    event: K, 
    listener: (data: ConfigPersistenceEvents[K]) => Promise<void>
  ): void {
    const eventKey = event as string
    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, new Set())
    }
    this.listeners.get(eventKey)!.add(listener)
  }
  
  // Type-safe event listener removal
  off<K extends keyof ConfigPersistenceEvents>(
    event: K, 
    listener: Function
  ): void {
    const eventKey = event as string
    const eventListeners = this.listeners.get(eventKey)
    if (eventListeners) {
      eventListeners.delete(listener)
      if (eventListeners.size === 0) {
        this.listeners.delete(eventKey)
      }
    }
  }
  
  // Remove all listeners
  removeAllListeners(event?: keyof ConfigPersistenceEvents): void {
    if (event) {
      this.listeners.delete(event as string)
    } else {
      this.listeners.clear()
    }
  }
  
  // Clean shutdown for testing/cleanup
  destroy(): void {
    this.removeAllListeners()
    ConfigPersistenceEventSystem.instance = null
  }
}

// Singleton instance for global access
export const configEventEmitter = ConfigPersistenceEventSystem.getInstance()

// Helper functions for common event emissions
export const emitWorkflowStateChange = (
  stepId: StepId,
  previousState: StepState,
  newState: StepState,
  workspaceId: string | null = null,
  metadata?: Record<string, any>
) => {
  configEventEmitter.emit('workflow-state-changed', {
    stepId,
    previousState,
    newState,
    workspaceId,
    metadata
  })
}

export const emitUserInteraction = (
  interactionType: ConfigPersistenceEvents['user-interaction']['interactionType'],
  configSection: string,
  configKey: string,
  value: any,
  workspaceId?: string | null
) => {
  configEventEmitter.emit('user-interaction', {
    interactionType,
    configSection,
    configKey,
    value,
    workspaceId
  })
}

export const emitConfigUpdateRequired = (
  configSection: string,
  updates: Record<string, any>,
  priority: 'immediate' | 'normal' = 'immediate',
  workspaceId?: string | null
) => {
  configEventEmitter.emit('config-update-required', {
    configSection,
    updates,
    priority,
    workspaceId
  })
}