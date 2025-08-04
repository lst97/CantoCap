/**
 * Workflow Config Bridge Service
 * Connects workflow state changes to immediate configuration persistence
 * Replaces complex auto-save timers with event-driven config updates
 */

import { configEventEmitter, type ConfigPersistenceEvents } from './config-persistence-event-system'
import { useAppStore } from '../stores/app-store'
import type { StepState, StepId } from '../types/workflow-state'

/**
 * Configuration section mapping for different types of updates
 */
interface ConfigSectionMapping {
  workflowProgress: {
    currentStepId: string
    completedSteps: string[]
    stepStates: Record<string, StepState>
    lastUpdated: number
  }
  
  stepConfigurations: Record<string, {
    settings: Record<string, any>
    userPreferences: Record<string, any>
    completionData: any
  }>
}

/**
 * Workflow Configuration Bridge
 * Handles immediate persistence of workflow state changes to configuration
 */
export class WorkflowConfigBridge {
  private static instance: WorkflowConfigBridge | null = null
  private initialized = false
  
  static getInstance(): WorkflowConfigBridge {
    if (!WorkflowConfigBridge.instance) {
      WorkflowConfigBridge.instance = new WorkflowConfigBridge()
    }
    return WorkflowConfigBridge.instance
  }
  
  /**
   * Initialize the bridge and set up event listeners
   */
  initialize(): void {
    if (this.initialized) return
    
    console.log('🔧 [WORKFLOW BRIDGE] Initializing workflow-config bridge')
    
    // Listen for workflow state changes and immediately persist them
    configEventEmitter.on('workflow-state-changed', this.handleWorkflowStateChange.bind(this))
    configEventEmitter.on('user-interaction', this.handleUserInteraction.bind(this))
    configEventEmitter.on('config-update-required', this.handleConfigUpdateRequired.bind(this))
    
    this.initialized = true
  }
  
  /**
   * Handle workflow state changes by immediately updating configuration
   */
  private async handleWorkflowStateChange(
    data: ConfigPersistenceEvents['workflow-state-changed']
  ): Promise<void> {
    const { stepId, previousState, newState, workspaceId, metadata } = data
    
    console.log('🔧 [WORKFLOW BRIDGE] Handling workflow state change:', {
      stepId,
      previousState,
      newState,
      workspaceId
    })
    
    try {
      // Update workflow progress in configuration
      await this.persistWorkflowProgress(stepId, newState, workspaceId, metadata)
      
      // Update step-specific configuration if metadata contains settings
      if (metadata?.stepConfig) {
        await this.persistStepConfiguration(stepId, metadata.stepConfig, workspaceId)
      }
      
      // Handle step completion logic
      if (newState === 'complete') {
        await this.handleStepCompletion(stepId, workspaceId, metadata)
      }
      
    } catch (error) {
      console.error('🚨 [WORKFLOW BRIDGE] Failed to handle workflow state change:', error)
    }
  }
  
  /**
   * Handle user interactions by immediately updating relevant configuration
   */
  private async handleUserInteraction(
    data: ConfigPersistenceEvents['user-interaction']
  ): Promise<void> {
    const { interactionType, configSection, configKey, value, workspaceId } = data
    
    console.log('🔧 [WORKFLOW BRIDGE] Handling user interaction:', {
      interactionType,
      configSection,
      configKey,
      workspaceId
    })
    
    try {
      // Get app store instance for immediate config updates
      const appStore = useAppStore.getState()
      
      // Call updateConfig immediately for user interactions
      await appStore.updateConfig(configKey as any, value)
      
      console.log('✅ [WORKFLOW BRIDGE] User interaction persisted immediately')
      
    } catch (error) {
      console.error('🚨 [WORKFLOW BRIDGE] Failed to handle user interaction:', error)
    }
  }
  
  /**
   * Handle direct config update requirements
   */
  private async handleConfigUpdateRequired(
    data: ConfigPersistenceEvents['config-update-required']
  ): Promise<void> {
    const { configSection, updates, priority, workspaceId } = data
    
    console.log('🔧 [WORKFLOW BRIDGE] Handling config update requirement:', {
      configSection,
      priority,
      workspaceId,
      updateKeys: Object.keys(updates)
    })
    
    try {
      // Apply each update immediately using existing updateConfig method
      for (const [key, value] of Object.entries(updates)) {
        const appStore = useAppStore.getState()
        await appStore.updateConfig(key as any, value)
      }
      
      console.log('✅ [WORKFLOW BRIDGE] Config updates applied immediately')
      
    } catch (error) {
      console.error('🚨 [WORKFLOW BRIDGE] Failed to apply config updates:', error)
    }
  }
  
  /**
   * Persist workflow progress to configuration
   */
  private async persistWorkflowProgress(
    stepId: StepId,
    newState: StepState,
    workspaceId: string | null,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Use existing updateConfig for workflow progress
      const appStore = useAppStore.getState()
      
      // Update current step tracking
      if (newState === 'complete') {
        // This will trigger navigation and state updates via existing logic
        console.log('🔧 [WORKFLOW BRIDGE] Step completed, updating workflow progress:', stepId)
      }
      
      // Store step state for workspace persistence
      if (workspaceId && window.cantocapAPI?.updateConfigSection) {
        await window.cantocapAPI.updateConfigSection('workflowProgress', {
          [`stepState_${stepId}`]: newState,
          lastUpdated: Date.now(),
          workspaceId
        })
      }
      
    } catch (error) {
      console.error('🚨 [WORKFLOW BRIDGE] Failed to persist workflow progress:', error)
    }
  }
  
  /**
   * Persist step-specific configuration
   */
  private async persistStepConfiguration(
    stepId: StepId,
    stepConfig: any,
    workspaceId: string | null
  ): Promise<void> {
    try {
      if (workspaceId && window.cantocapAPI?.updateConfigSection) {
        await window.cantocapAPI.updateConfigSection('stepConfigurations', {
          [stepId]: {
            settings: stepConfig,
            lastModified: Date.now(),
            workspaceId
          }
        })
      }
      
      console.log('✅ [WORKFLOW BRIDGE] Step configuration persisted:', stepId)
      
    } catch (error) {
      console.error('🚨 [WORKFLOW BRIDGE] Failed to persist step configuration:', error)
    }
  }
  
  /**
   * Handle step completion with immediate config updates
   */
  private async handleStepCompletion(
    stepId: StepId,
    workspaceId: string | null,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Update completion tracking
      if (workspaceId && window.cantocapAPI?.updateConfigSection) {
        await window.cantocapAPI.updateConfigSection('workflowProgress', {
          [`completedStep_${stepId}`]: Date.now(),
          lastCompletedStep: stepId,
          workspaceId
        })
      }
      
      // Store completion metadata if available
      if (metadata?.completionData) {
        await this.persistStepConfiguration(stepId, { 
          completionData: metadata.completionData,
          completedAt: Date.now()
        }, workspaceId)
      }
      
      console.log('✅ [WORKFLOW BRIDGE] Step completion handled:', stepId)
      
    } catch (error) {
      console.error('🚨 [WORKFLOW BRIDGE] Failed to handle step completion:', error)
    }
  }
  
  /**
   * Simple retry logic for failed config updates
   */
  private async retryConfigUpdate(
    updateFn: () => Promise<void>,
    retryCount = 0,
    maxRetries = 3
  ): Promise<void> {
    try {
      await updateFn()
    } catch (error) {
      if (retryCount < maxRetries) {
        // Simple exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.retryConfigUpdate(updateFn, retryCount + 1, maxRetries)
      }
      
      console.error(`🚨 [WORKFLOW BRIDGE] Config update failed after ${maxRetries} attempts:`, error)
      throw error
    }
  }
  
  /**
   * Clean shutdown
   */
  destroy(): void {
    if (this.initialized) {
      configEventEmitter.removeAllListeners('workflow-state-changed')
      configEventEmitter.removeAllListeners('user-interaction')
      configEventEmitter.removeAllListeners('config-update-required')
      this.initialized = false
    }
    WorkflowConfigBridge.instance = null
  }
}

// Singleton instance for global access
export const workflowConfigBridge = WorkflowConfigBridge.getInstance()

// Initialize the bridge automatically
workflowConfigBridge.initialize()

// Helper function to trigger immediate config updates from components
export const triggerConfigUpdate = (
  configSection: string,
  updates: Record<string, any>,
  workspaceId?: string | null
) => {
  configEventEmitter.emit('config-update-required', {
    configSection,
    updates,
    priority: 'immediate',
    workspaceId
  })
}

// Helper function to trigger user interaction events
export const triggerUserInteraction = (
  interactionType: ConfigPersistenceEvents['user-interaction']['interactionType'],
  configKey: string,
  value: any,
  workspaceId?: string | null
) => {
  configEventEmitter.emit('user-interaction', {
    interactionType,
    configSection: 'user-interaction',
    configKey,
    value,
    workspaceId
  })
}