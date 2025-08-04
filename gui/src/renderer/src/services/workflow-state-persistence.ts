/**
 * Workflow State Persistence Implementations
 * Provides concrete implementations of state persistence for different storage backends
 */

import { 
  WorkflowStatePersistence, 
  WorkflowStateSnapshot 
} from '../types/workflow-state'
import { workspaceDatabase } from './workspace-database'
import { useWorkspaceStore } from '../stores/workspace-store'

/**
 * Workspace-based persistence implementation
 * Integrates with existing workspace storage system
 */
export class WorkspaceStatePersistence implements WorkflowStatePersistence {
  private readonly SESSION_TYPE = 'workflow-state' as const

  async saveState(snapshot: WorkflowStateSnapshot): Promise<void> {
    try {
      const workspaceStore = useWorkspaceStore.getState()
      const currentWorkspace = workspaceStore.currentWorkspace

      if (!currentWorkspace) {
        throw new Error('No active workspace for state persistence')
      }

      // Save to workspace session data
      await workspaceStore.saveWorkspaceSession(
        currentWorkspace.id,
        this.SESSION_TYPE,
        {
          workflowState: snapshot,
          timestamp: snapshot.timestamp,
          version: snapshot.version
        }
      )

      console.log(`💾 Workflow state saved to workspace: ${currentWorkspace.name}`)
    } catch (error) {
      console.error('Failed to save workflow state:', error)
      throw error
    }
  }

  async loadState(): Promise<WorkflowStateSnapshot | null> {
    try {
      const workspaceStore = useWorkspaceStore.getState()
      const currentWorkspace = workspaceStore.currentWorkspace

      if (!currentWorkspace) {
        console.log('No active workspace for state loading')
        return null
      }

      // Load from workspace session data
      const sessionData = await workspaceStore.loadWorkspaceSession(
        currentWorkspace.id,
        this.SESSION_TYPE
      )

      if (!sessionData?.workflowState) {
        console.log('No workflow state found in workspace session')
        return null
      }

      console.log(`📂 Workflow state loaded from workspace: ${currentWorkspace.name}`)
      return sessionData.workflowState as WorkflowStateSnapshot
    } catch (error) {
      console.error('Failed to load workflow state:', error)
      return null
    }
  }

  async clearState(): Promise<void> {
    try {
      const workspaceStore = useWorkspaceStore.getState()
      const currentWorkspace = workspaceStore.currentWorkspace

      if (!currentWorkspace) {
        return // Nothing to clear
      }

      // Clear session data
      await workspaceStore.saveWorkspaceSession(
        currentWorkspace.id,
        this.SESSION_TYPE,
        null
      )

      console.log(`🗑️ Workflow state cleared from workspace: ${currentWorkspace.name}`)
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
 * LocalStorage-based persistence implementation
 * Fallback for when workspace storage is unavailable
 */
export class LocalStorageStatePersistence implements WorkflowStatePersistence {
  private readonly STORAGE_KEY = 'canton-cap:workflow-state'

  async saveState(snapshot: WorkflowStateSnapshot): Promise<void> {
    try {
      const serialized = JSON.stringify(snapshot)
      localStorage.setItem(this.STORAGE_KEY, serialized)
      console.log('💾 Workflow state saved to localStorage')
    } catch (error) {
      console.error('Failed to save workflow state to localStorage:', error)
      throw error
    }
  }

  async loadState(): Promise<WorkflowStateSnapshot | null> {
    try {
      const serialized = localStorage.getItem(this.STORAGE_KEY)
      if (!serialized) {
        return null
      }

      const state = JSON.parse(serialized) as WorkflowStateSnapshot
      console.log('📂 Workflow state loaded from localStorage')
      return state
    } catch (error) {
      console.error('Failed to load workflow state from localStorage:', error)
      return null
    }
  }

  async clearState(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('🗑️ Workflow state cleared from localStorage')
    } catch (error) {
      console.error('Failed to clear workflow state from localStorage:', error)
      throw error
    }
  }

  async hasStoredState(): Promise<boolean> {
    try {
      return localStorage.getItem(this.STORAGE_KEY) !== null
    } catch (error) {
      console.error('Error checking localStorage for stored state:', error)
      return false
    }
  }

  async getStorageInfo(): Promise<{ size: number; lastModified: number }> {
    try {
      const serialized = localStorage.getItem(this.STORAGE_KEY)
      if (!serialized) {
        return { size: 0, lastModified: 0 }
      }

      const state = JSON.parse(serialized) as WorkflowStateSnapshot
      return {
        size: new Blob([serialized]).size,
        lastModified: state.timestamp
      }
    } catch (error) {
      console.error('Error getting localStorage storage info:', error)
      return { size: 0, lastModified: 0 }
    }
  }
}

/**
 * In-memory persistence implementation
 * For testing and development scenarios
 */
export class MemoryStatePersistence implements WorkflowStatePersistence {
  private storedState: WorkflowStateSnapshot | null = null

  async saveState(snapshot: WorkflowStateSnapshot): Promise<void> {
    this.storedState = { ...snapshot }
    console.log('💾 Workflow state saved to memory')
  }

  async loadState(): Promise<WorkflowStateSnapshot | null> {
    if (this.storedState) {
      console.log('📂 Workflow state loaded from memory')
      return { ...this.storedState }
    }
    return null
  }

  async clearState(): Promise<void> {
    this.storedState = null
    console.log('🗑️ Workflow state cleared from memory')
  }

  async hasStoredState(): Promise<boolean> {
    return this.storedState !== null
  }

  async getStorageInfo(): Promise<{ size: number; lastModified: number }> {
    if (!this.storedState) {
      return { size: 0, lastModified: 0 }
    }

    const serialized = JSON.stringify(this.storedState)
    return {
      size: new Blob([serialized]).size,
      lastModified: this.storedState.timestamp
    }
  }
}

/**
 * Factory function to create appropriate persistence implementation
 */
export function createWorkflowStatePersistence(
  preferredType: 'workspace' | 'localStorage' | 'memory' = 'workspace'
): WorkflowStatePersistence {
  switch (preferredType) {
    case 'workspace':
      try {
        // Test if workspace system is available
        const workspaceStore = useWorkspaceStore.getState()
        if (workspaceStore) {
          return new WorkspaceStatePersistence()
        }
      } catch (error) {
        console.warn('Workspace persistence unavailable, falling back to localStorage')
      }
      // Fallthrough to localStorage
      
    case 'localStorage':
      try {
        // Test if localStorage is available
        localStorage.setItem('test', 'test')
        localStorage.removeItem('test')
        return new LocalStorageStatePersistence()
      } catch (error) {
        console.warn('localStorage unavailable, falling back to memory persistence')
      }
      // Fallthrough to memory
      
    case 'memory':
    default:
      return new MemoryStatePersistence()
  }
}

// Default persistence instance
export const defaultWorkflowStatePersistence = createWorkflowStatePersistence('workspace')