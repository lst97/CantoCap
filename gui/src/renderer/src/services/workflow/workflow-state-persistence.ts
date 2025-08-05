/**
 * Workflow State Persistence Implementation
 * Uses workflow config bridge for immediate persistence and single source of truth
 */

import { 
  WorkflowStatePersistence, 
  WorkflowStateSnapshot 
} from '../../types/workflow-state'
import { triggerConfigUpdate } from '../bridge/workflow-config-bridge'

/**
 * Config Bridge-based persistence implementation
 * Uses workflow config bridge for immediate persistence and single source of truth
 */
export class WorkflowConfigPersistence implements WorkflowStatePersistence {
  private readonly CONFIG_SECTION = 'workflowState' as const

  async saveState(snapshot: WorkflowStateSnapshot): Promise<void> {
    try {
      // Use config bridge for immediate persistence
      triggerConfigUpdate(
        this.CONFIG_SECTION,
        {
          snapshot: JSON.stringify(snapshot),
          timestamp: snapshot.timestamp,
          version: snapshot.version,
          currentStepId: snapshot.currentStepId
        }
      )

      console.log('💾 Workflow state saved via config bridge')
    } catch (error) {
      console.error('Failed to save workflow state:', error)
      throw error
    }
  }

  async loadState(): Promise<WorkflowStateSnapshot | null> {
    try {
      // Load from config using native API
      if (!window.cantocapAPI?.getConfig) {
        console.warn('CantoCap API not available for state loading')
        return null
      }

      const config = await window.cantocapAPI.getConfig()
      const stateData = config[this.CONFIG_SECTION]

      if (!stateData?.snapshot) {
        console.log('No workflow state found in config')
        return null
      }

      const snapshot = JSON.parse(stateData.snapshot) as WorkflowStateSnapshot
      console.log('📂 Workflow state loaded from config bridge')
      return snapshot
    } catch (error) {
      console.error('Failed to load workflow state:', error)
      return null
    }
  }

  async clearState(): Promise<void> {
    try {
      // Clear state using config bridge
      triggerConfigUpdate(
        this.CONFIG_SECTION,
        {
          snapshot: null,
          timestamp: null,
          version: null,
          currentStepId: null
        }
      )

      console.log('🗑️ Workflow state cleared via config bridge')
    } catch (error) {
      console.error('Failed to clear workflow state:', error)
      throw error
    }
  }

  async hasStoredState(): Promise<boolean> {
    try {
      const state = await this.loadState()
      return state !== null
    } catch (error) {
      console.error('Error checking for stored state:', error)
      return false
    }
  }

  async getStorageInfo(): Promise<{ size: number; lastModified: number }> {
    try {
      const state = await this.loadState()
      if (!state) {
        return { size: 0, lastModified: 0 }
      }

      // Estimate size based on JSON serialization
      const serialized = JSON.stringify(state)
      return {
        size: new Blob([serialized]).size,
        lastModified: state.timestamp
      }
    } catch (error) {
      console.error('Error getting storage info:', error)
      return { size: 0, lastModified: 0 }
    }
  }
}



/**
 * Factory function to create config bridge persistence implementation
 */
export function createWorkflowStatePersistence(): WorkflowStatePersistence {
  return new WorkflowConfigPersistence()
}

// Default persistence instance using config bridge
export const defaultWorkflowStatePersistence = createWorkflowStatePersistence()