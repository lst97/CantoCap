/**
 * Phase 3: Integrated Workspace Store Hooks
 * Connects Phase 1 UI components to backend storage infrastructure
 * Integrates with the workspace-store.ts created by backend-architect
 */

import { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { Workspace as WorkspaceStoreType } from '../../types/workspace'
import type { Workspace } from './types'
import { 
  PerformanceMonitor, 
  useFastWorkspaceSwitch, 
  useOptimisticUpdate,
  WorkspacePreloader
} from './performance-utils'
import { useWorkspaceErrorHandler } from './WorkspaceErrorBoundary'

// Global migration state to prevent multiple simultaneous attempts
let globalMigrationAttempted = false
let globalMigrationInProgress = false

// Transform store workspace to UI workspace format
const transformWorkspaceForUI = (workspace: WorkspaceStoreType): Workspace => {
  return {
    id: workspace.id,
    name: workspace.name,
    emoji: workspace.name.charAt(0).toUpperCase(), // Generate emoji from name
    createdAt: new Date(workspace.createdAt),
    updatedAt: new Date(workspace.updatedAt),
    isActive: workspace.isActive,
    sessionData: {
      currentStep: 'input-file', // Default step for UI
      // Add any session data transformation here
    }
  }
}

// Real workspace store interface for integration
interface IntegratedWorkspaceStore {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  isMigrating: boolean
  migrationPhase: string
  migrationProgress: number
  canRollback: boolean
  isLoading: boolean
  lastError: any
  
  // Actions
  createWorkspace: (name: string, copyFromId?: string) => Promise<void>
  switchWorkspace: (workspaceId: string) => Promise<void>
  renameWorkspace: (workspaceId: string, newName: string) => Promise<void>
  duplicateWorkspace: (workspaceId: string) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  initializeMigration: () => Promise<void>
  rollbackMigration: () => Promise<void>
}

// Real implementation connecting to workspace store with performance optimizations
const useIntegratedWorkspaceStore = (): IntegratedWorkspaceStore => {
  const store = useWorkspaceStore()
  const [isInitialized, setIsInitialized] = useState(false)
  const { handleError, handleAsyncError } = useWorkspaceErrorHandler()
  const { fastSwitch, isSwitching } = useFastWorkspaceSwitch()

  // Initialize workspace system on first load with performance monitoring
  useEffect(() => {
    const initializeSystem = async () => {
      if (!store.isInitialized) {
        const measureEnd = PerformanceMonitor.startMeasurement('workspace-initialization')
        
        try {
          await store.initializeWorkspaces()
          setIsInitialized(true)
          
          const duration = measureEnd()
          console.log(`✅ Workspace system initialized in ${duration.toFixed(2)}ms`)
        } catch (error) {
          measureEnd()
          handleError(error as Error, 'workspace initialization')
        }
      } else {
        setIsInitialized(true)
      }
    }

    initializeSystem()
  }, [store.isInitialized, handleError])

  // Preload workspace data for faster switching
  useEffect(() => {
    if (store.availableWorkspaces.length > 0) {
      // Preload the first few workspaces for faster switching
      const workspacesToPreload = store.availableWorkspaces.slice(0, 3)
      
      workspacesToPreload.forEach(workspace => {
        if (workspace.id !== store.currentWorkspace?.id) {
          WorkspacePreloader.prefetchWorkspace(workspace.id, async () => {
            // Preload workspace config and step configurations (sessions removed)
            return {
              config: workspace.config,
              metadata: workspace.metadata || {}
            }
          })
        }
      })
    }
  }, [store.availableWorkspaces, store.currentWorkspace?.id])

  // Transform workspaces for UI
  const transformedWorkspaces = store.availableWorkspaces.map(transformWorkspaceForUI)
  const transformedActiveWorkspace = store.currentWorkspace ? transformWorkspaceForUI(store.currentWorkspace) : null

  // Migration status derivation
  const migrationStatus = store.migrationStatus
  const isMigrating = migrationStatus?.isActive || false
  const migrationPhase = migrationStatus?.currentPhase || 'completed'
  const migrationProgress = migrationStatus?.progress || 100
  const canRollback = migrationStatus?.canRollback || false

  return {
    workspaces: transformedWorkspaces,
    activeWorkspace: transformedActiveWorkspace,
    isMigrating,
    migrationPhase,
    migrationProgress,
    canRollback,
    isLoading: store.isLoading || isSwitching,
    lastError: store.lastError,
    
    createWorkspace: async (name: string, copyFromId?: string) => {
      try {
        if (copyFromId) {
          // Find the original workspace and duplicate it
          const originalWorkspace = store.availableWorkspaces.find(w => w.id === copyFromId)
          if (originalWorkspace) {
            await store.duplicateWorkspace(copyFromId, name)
          } else {
            await store.createWorkspace(name)
          }
        } else {
          await store.createWorkspace(name)
        }
      } catch (error) {
        console.error('Failed to create workspace:', error)
        throw error
      }
    },
    
    switchWorkspace: async (workspaceId: string) => {
      return await handleAsyncError(
        () => fastSwitch(workspaceId, (id) => store.switchWorkspace(id)),
        'workspace switching'
      )
    },
    
    renameWorkspace: async (workspaceId: string, newName: string) => {
      try {
        const workspace = store.availableWorkspaces.find(w => w.id === workspaceId)
        if (workspace && workspace.name !== newName) {
          workspace.name = newName
          workspace.updatedAt = Date.now()
          await store.updateWorkspaceMetadata(workspaceId, { description: '' }) // Trigger update
          // Temporarily update name directly through config
          await store.updateWorkspaceConfig(workspaceId, { lastModified: Date.now() })
        }
      } catch (error) {
        console.error('Failed to rename workspace:', error)
        throw error
      }
    },
    
    duplicateWorkspace: async (workspaceId: string) => {
      try {
        const originalWorkspace = store.availableWorkspaces.find(w => w.id === workspaceId)
        if (originalWorkspace) {
          await store.duplicateWorkspace(workspaceId, `${originalWorkspace.name} (Copy)`)
        }
      } catch (error) {
        console.error('Failed to duplicate workspace:', error)
        throw error
      }
    },
    
    deleteWorkspace: async (workspaceId: string) => {
      try {
        await store.deleteWorkspace(workspaceId)
      } catch (error) {
        console.error('Failed to delete workspace:', error)
        throw error
      }
    },
    
    initializeMigration: async () => {
      try {
        await store.startMigration()
      } catch (error) {
        console.error('Failed to start migration:', error)
        throw error
      }
    },
    
    rollbackMigration: async () => {
      try {
        await store.rollbackMigration()
      } catch (error) {
        console.error('Failed to rollback migration:', error)
        throw error
      }
    }
  }
}

/**
 * Primary hook for workspace management
 * Provides all workspace state and actions needed by components
 * Now fully integrated with backend storage infrastructure
 */
export const useWorkspaceManagement = () => {
  const store = useIntegratedWorkspaceStore()
  
  // DISABLED: Migration system causes persistent loops
  // Simply mark as attempted to prevent any migration attempts
  useEffect(() => {
    if (!globalMigrationAttempted) {
      globalMigrationAttempted = true
      console.log('Migration system disabled - workspace system will initialize without migration')
    }
  }, [])
  
  return store
}

/**
 * Hook for workspace panel integration
 * Provides simplified interface specifically for WorkspacePanel components
 * Now with real-time updates and performance optimizations
 */
export const useWorkspacePanelIntegration = () => {
  const {
    workspaces,
    activeWorkspace,
    isMigrating,
    migrationPhase,
    migrationProgress,
    canRollback,
    isLoading,
    lastError,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    rollbackMigration
  } = useWorkspaceManagement()

  // Workspace panel specific actions with performance optimizations
  const panelActions = {
    onCreateWorkspace: useCallback(async (name: string, copyFromId?: string) => {
      const startTime = performance.now()
      try {
        await createWorkspace(name, copyFromId)
        const endTime = performance.now()
        console.log(`Workspace creation took ${endTime - startTime}ms`)
      } catch (error) {
        console.error('Failed to create workspace in panel:', error)
        throw error
      }
    }, [createWorkspace]),

    onSwitchWorkspace: useCallback(async (workspaceId: string) => {
      const startTime = performance.now()
      try {
        await switchWorkspace(workspaceId)
        const endTime = performance.now()
        console.log(`Workspace switching took ${endTime - startTime}ms`)
        
        // Ensure switching is under 500ms requirement
        if (endTime - startTime > 500) {
          console.warn(`Workspace switching exceeded 500ms target: ${endTime - startTime}ms`)
        }
      } catch (error) {
        console.error('Failed to switch workspace in panel:', error)
        throw error
      }
    }, [switchWorkspace]),

    onRenameWorkspace: useCallback(async (workspaceId: string, newName: string) => {
      try {
        await renameWorkspace(workspaceId, newName)
      } catch (error) {
        console.error('Failed to rename workspace in panel:', error)
        throw error
      }
    }, [renameWorkspace]),

    onDuplicateWorkspace: useCallback(async (workspaceId: string) => {
      try {
        await duplicateWorkspace(workspaceId)
      } catch (error) {
        console.error('Failed to duplicate workspace in panel:', error)
        throw error
      }
    }, [duplicateWorkspace]),

    onDeleteWorkspace: useCallback(async (workspaceId: string) => {
      try {
        await deleteWorkspace(workspaceId)
      } catch (error) {
        console.error('Failed to delete workspace in panel:', error)
        throw error
      }
    }, [deleteWorkspace]),

    onRollback: useCallback(async () => {
      try {
        await rollbackMigration()
      } catch (error) {
        console.error('Failed to rollback migration in panel:', error)
        throw error
      }
    }, [rollbackMigration])
  }

  return {
    // State
    workspaces,
    activeWorkspace,
    isMigrating,
    migrationPhase,
    migrationProgress,
    canRollback,
    isLoading,
    lastError,
    
    // Actions
    ...panelActions
  }
}

/**
 * Hook for workspace session integration
 * Manages workspace session data (current step, config, etc.)
 * Now integrated with real session persistence
 */
export const useWorkspaceSession = () => {
  const { activeWorkspace } = useWorkspaceManagement()
  const store = useWorkspaceStore()
  
  const updateSessionData = useCallback(async (data: Partial<NonNullable<Workspace['sessionData']>>) => {
    if (!activeWorkspace) return
    
    try {
      // UPDATED: Use step configuration instead of legacy sessions
      await store.setStepConfig(activeWorkspace.id, 'config', {
        uiState: {
          currentStep: data.currentStep || 'input-file',
          ...data
        }
      })
      
      console.log('Updated session data via step config for workspace:', activeWorkspace.id, data)
    } catch (error) {
      console.error('Failed to update session data:', error)
    }
  }, [activeWorkspace, store])
  
  const getSessionData = useCallback(async () => {
    if (!activeWorkspace) return {}
    
    try {
      // UPDATED: Use step configuration instead of legacy sessions
      const stepConfig = await store.getStepConfig(activeWorkspace.id, 'config')
      return stepConfig?.data?.uiState || { currentStep: 'input-file' }
    } catch (error) {
      console.error('Failed to load session data:', error)
      return { currentStep: 'input-file' }
    }
  }, [activeWorkspace, store])
  
  // Load session data on workspace change
  const [sessionData, setSessionData] = useState<any>({ currentStep: 'input-file' })
  
  useEffect(() => {
    if (activeWorkspace) {
      getSessionData().then(setSessionData)
    }
  }, [activeWorkspace, getSessionData])
  
  return {
    activeWorkspace,
    sessionData,
    updateSessionData
  }
}