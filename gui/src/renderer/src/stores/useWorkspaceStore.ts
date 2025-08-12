import { create } from 'zustand';
import { WorkspaceState, WorkspaceMetadata, WorkspaceCreatedEvent, WorkspaceUpdatedEvent, WorkspaceDeletedEvent, WorkspaceGroup, WorkspaceGroupColor } from './types/StoreTypes';

// ============================================================================
// WORKSPACE STORE - WORKSPACE MANAGEMENT
// ============================================================================

// Helper function to compute derived state for stable references
const computeDerivedState = (workspaces: Record<string, WorkspaceMetadata>) => {
  // Compute workspace list
  const workspaceList = Object.values(workspaces);
  
  // Compute available groups
  const availableGroups = workspaceList.reduce((groups, workspace) => {
    if (workspace.group && !groups.find(g => g.id === workspace.group!.id)) {
      groups.push(workspace.group);
    }
    return groups;
  }, [] as WorkspaceGroup[]);
  
  // Compute grouped workspaces
  const groupedWorkspaces = workspaceList.reduce((grouped, workspace) => {
    if (workspace.group) {
      if (!grouped[workspace.group.id]) {
        grouped[workspace.group.id] = {
          group: workspace.group,
          workspaces: []
        };
      }
      grouped[workspace.group.id].workspaces.push(workspace);
    } else {
      if (!grouped['ungrouped']) {
        grouped['ungrouped'] = {
          group: null,
          workspaces: []
        };
      }
      grouped['ungrouped'].workspaces.push(workspace);
    }
    return grouped;
  }, {} as Record<string, { group: WorkspaceGroup | null, workspaces: WorkspaceMetadata[] }>);
  
  return {
    _workspaceList: workspaceList,
    _availableGroups: availableGroups,
    _groupedWorkspaces: groupedWorkspaces
  };
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // State
  workspaces: {},
  currentWorkspaceId: null,
  isLoading: false,
  error: null,
  _initialized: false,
  
  // Pre-computed derived state - initialized empty
  _workspaceList: [],
  _groupedWorkspaces: {},
  _availableGroups: [],
  
  // Actions
  actions: {
    createWorkspace: async (name: string) => {
      try {
        set({ isLoading: true, error: null });
        const result = await window.electron.ipcRenderer.invoke('workspace:create', name);
        
        // Update local state immediately
        set(state => ({
          workspaces: { 
            ...state.workspaces, 
            [result.id]: {
              id: result.workspace.id,
              name: result.workspace.name,
              createdAt: result.workspace.createdAt,
              lastAccessed: result.workspace.lastAccessed
            }
          },
          currentWorkspaceId: result.id,
          isLoading: false
        }));
        
        // Also update the step store's current workspace ID for synchronization
        try {
          const { useStepStore } = await import('./useStepStore');
          useStepStore.setState({ currentWorkspaceId: result.id });
        } catch (error) {
          console.warn('Could not sync workspace ID to step store:', error);
        }
        
        // Recompute derived state for stable references
        get().actions._recomputeDerivedState();
        
        return result.id;
      } catch (error) {
        console.error('Failed to create workspace:', error);
        set({ 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to create workspace' 
        });
        throw error;
      }
    },
    
    deleteWorkspace: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const success = await window.electron.ipcRenderer.invoke('workspace:delete', id);
        
        if (success) {
          set(state => {
            const { [id]: removed, ...remaining } = state.workspaces;
            return { 
              workspaces: remaining,
              currentWorkspaceId: state.currentWorkspaceId === id ? null : state.currentWorkspaceId,
              isLoading: false
            };
          });
          
          // Recompute derived state for stable references
          get().actions._recomputeDerivedState();
        } else {
          set({ isLoading: false, error: 'Failed to delete workspace' });
        }
        
        return success;
      } catch (error) {
        console.error('Failed to delete workspace:', error);
        set({ 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to delete workspace' 
        });
        return false;
      }
    },
    
    switchWorkspace: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        
        // Check if workspace exists
        const exists = await window.electron.ipcRenderer.invoke('workspace:exists', id);
        if (!exists) {
          throw new Error('Workspace does not exist');
        }
        
        // Update current workspace
        set({ currentWorkspaceId: id, isLoading: false });
        
        // Also update the step store's current workspace ID for synchronization
        try {
          const { useStepStore } = await import('./useStepStore');
          useStepStore.setState({ currentWorkspaceId: id });
        } catch (error) {
          console.warn('Could not sync workspace ID to step store:', error);
        }
        
        // Set as active in app state (this will also update recent workspaces)
        await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', id);
        
      } catch (error) {
        console.error('Failed to switch workspace:', error);
        set({ 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to switch workspace' 
        });
      }
    },
    
    loadWorkspaces: async () => {
      try {
        set({ isLoading: true, error: null });
        const workspaceList = await window.electron.ipcRenderer.invoke('workspace:list');
        
        const workspaces = workspaceList.reduce((acc: Record<string, WorkspaceMetadata>, ws: WorkspaceMetadata) => {
          acc[ws.id] = ws;
          return acc;
        }, {});
        
        set({ workspaces, isLoading: false, _initialized: true });
        
        // Recompute derived state for stable references
        get().actions._recomputeDerivedState();
      } catch (error) {
        console.error('Failed to load workspaces:', error);
        set({ 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to load workspaces' 
        });
      }
    },
    
    renameWorkspace: async (id: string, newName: string) => {
      try {
        set({ error: null });
        const success = await window.electron.ipcRenderer.invoke('workspace:rename', id, newName);
        
        if (success) {
          // State will be updated via IPC event listener
        } else {
          set({ error: 'Failed to rename workspace' });
        }
        
        return success;
      } catch (error) {
        console.error('Failed to rename workspace:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to rename workspace';
        set({ error: errorMessage });
        return false;
      }
    },
    
    duplicateWorkspace: async (id: string, newName: string) => {
      try {
        set({ isLoading: true, error: null });
        const result = await window.electron.ipcRenderer.invoke('workspace:duplicate', id, newName);
        
        if (result) {
          // State will be updated via IPC event listener
          set({ isLoading: false });
          return result.id;
        } else {
          set({ isLoading: false, error: 'Failed to duplicate workspace' });
          return null;
        }
      } catch (error) {
        console.error('Failed to duplicate workspace:', error);
        set({ 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Failed to duplicate workspace' 
        });
        return null;
      }
    },
    
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },
    
    setError: (error: string | null) => {
      set({ error });
    },
    
    clearError: () => {
      set({ error: null });
    },

    // Group management methods
    createGroup: async (name: string, color: WorkspaceGroupColor = 'default') => {
      try {
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const group: WorkspaceGroup = {
          id: groupId,
          name,
          color,
          isExpanded: true,
          position: Date.now(),
          metadata: {
            workspaceCount: 0,
            createdAt: new Date(),
            lastModified: new Date()
          }
        };
        
        // TODO: Implement actual group persistence via IPC
        console.log('Creating group:', group);
        
        return groupId;
      } catch (error) {
        console.error('Failed to create group:', error);
        throw error;
      }
    },

    deleteGroup: async (groupId: string) => {
      try {
        // TODO: Implement actual group deletion via IPC
        console.log('Deleting group:', groupId);
        return true;
      } catch (error) {
        console.error('Failed to delete group:', error);
        return false;
      }
    },

    updateGroup: async (groupId: string, updates: Partial<Omit<WorkspaceGroup, 'id' | 'metadata'>>) => {
      try {
        // TODO: Implement actual group update via IPC
        console.log('Updating group:', groupId, updates);
        return true;
      } catch (error) {
        console.error('Failed to update group:', error);
        return false;
      }
    },

    addWorkspaceToGroup: async (workspaceId: string, groupId: string) => {
      try {
        // TODO: Implement actual workspace-group association via IPC
        console.log('Adding workspace to group:', workspaceId, groupId);
      } catch (error) {
        console.error('Failed to add workspace to group:', error);
        throw error;
      }
    },

    removeWorkspaceFromGroup: async (workspaceId: string) => {
      try {
        // TODO: Implement actual workspace-group dissociation via IPC
        console.log('Removing workspace from group:', workspaceId);
      } catch (error) {
        console.error('Failed to remove workspace from group:', error);
        throw error;
      }
    },

    // Internal helper to recompute derived state for stable references
    _recomputeDerivedState: () => {
      const currentState = get();
      const derivedState = computeDerivedState(currentState.workspaces);
      set(derivedState);
    }
  }
}));

// ============================================================================
// IPC EVENT LISTENERS FOR REAL-TIME SYNC
// ============================================================================

// Initialize IPC listeners with defensive state updates
if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
  // Workspace created event - defensive update
  window.electron.ipcRenderer.on('workspace:created', ({ id, workspace }: WorkspaceCreatedEvent) => {
    useWorkspaceStore.setState(currentState => {
      // Only update if workspace doesn't already exist
      if (currentState.workspaces[id]) {
        return currentState; // No change needed
      }
      
      const newState = {
        ...currentState,
        workspaces: { 
          ...currentState.workspaces, 
          [id]: {
            id: workspace.id,
            name: workspace.name,
            createdAt: workspace.createdAt,
            lastAccessed: workspace.lastAccessed
          }
        }
      };
      
      // Recompute derived state
      const derivedState = computeDerivedState(newState.workspaces);
      return { ...newState, ...derivedState };
    });
  });
  
  // Workspace updated event - defensive update
  window.electron.ipcRenderer.on('workspace:updated', ({ id, workspace }: WorkspaceUpdatedEvent) => {
    useWorkspaceStore.setState(currentState => {
      const existingWorkspace = currentState.workspaces[id];
      
      // Only update if workspace exists and has actually changed
      if (!existingWorkspace || 
          (existingWorkspace.name === workspace.name && 
           existingWorkspace.lastAccessed === workspace.lastAccessed)) {
        return currentState; // No change needed
      }
      
      const newState = {
        ...currentState,
        workspaces: { 
          ...currentState.workspaces, 
          [id]: {
            id: workspace.id,
            name: workspace.name,
            createdAt: workspace.createdAt,
            lastAccessed: workspace.lastAccessed
          }
        }
      };
      
      // Recompute derived state
      const derivedState = computeDerivedState(newState.workspaces);
      return { ...newState, ...derivedState };
    });
  });
  
  // Workspace deleted event - defensive update
  window.electron.ipcRenderer.on('workspace:deleted', ({ id }: WorkspaceDeletedEvent) => {
    useWorkspaceStore.setState(currentState => {
      // Only update if workspace actually exists
      if (!currentState.workspaces[id]) {
        return currentState; // No change needed
      }
      
      const { [id]: removed, ...remaining } = currentState.workspaces;
      const newState = { 
        ...currentState,
        workspaces: remaining,
        currentWorkspaceId: currentState.currentWorkspaceId === id ? null : currentState.currentWorkspaceId
      };
      
      // Recompute derived state
      const derivedState = computeDerivedState(newState.workspaces);
      return { ...newState, ...derivedState };
    });
  });
}

// ============================================================================
// HELPER HOOKS AND SELECTORS
// ============================================================================

// Hook to get all workspaces as an array (stable reference from pre-computed state)
export const useWorkspaceList = () => 
  useWorkspaceStore(state => state._workspaceList);

// Hook to get grouped workspaces (stable reference from pre-computed state)
export const useGroupedWorkspaces = () => 
  useWorkspaceStore(state => state._groupedWorkspaces);

// Hook to get available groups (stable reference from pre-computed state)
export const useAvailableGroups = () => 
  useWorkspaceStore(state => state._availableGroups);

// Hook to get current workspace
export const useCurrentWorkspace = () => {
  return useWorkspaceStore(state => {
    if (!state.currentWorkspaceId) return null;
    return state.workspaces[state.currentWorkspaceId] || null;
  });
};

// Hook to get workspace by ID
export const useWorkspace = (id: string | null) =>
  useWorkspaceStore(state => id ? state.workspaces[id] : null);

// Individual action hooks to prevent reference changes
export const useCreateWorkspace = () => useWorkspaceStore(state => state.actions.createWorkspace);
export const useDeleteWorkspace = () => useWorkspaceStore(state => state.actions.deleteWorkspace);
export const useSwitchWorkspace = () => useWorkspaceStore(state => state.actions.switchWorkspace);
export const useRenameWorkspace = () => useWorkspaceStore(state => state.actions.renameWorkspace);
export const useDuplicateWorkspace = () => useWorkspaceStore(state => state.actions.duplicateWorkspace);
export const useCreateGroup = () => useWorkspaceStore(state => state.actions.createGroup);
export const useDeleteGroup = () => useWorkspaceStore(state => state.actions.deleteGroup);
export const useUpdateGroup = () => useWorkspaceStore(state => state.actions.updateGroup);
export const useAddWorkspaceToGroup = () => useWorkspaceStore(state => state.actions.addWorkspaceToGroup);
export const useRemoveWorkspaceFromGroup = () => useWorkspaceStore(state => state.actions.removeWorkspaceFromGroup);

// Legacy hook for backward compatibility
export const useWorkspaceActions = () => useWorkspaceStore(state => state.actions);

// Hook to get workspace loading state
export const useWorkspaceLoading = () => useWorkspaceStore(state => state.isLoading);

// Hook to get workspace error state
export const useWorkspaceError = () => useWorkspaceStore(state => state.error);

// Hook to get workspaces sorted by last accessed (most recent first) - memoized for stability
export const useRecentWorkspaces = () => 
  useWorkspaceStore(state => {
    // Use the stable workspace list and sort it
    return [...state._workspaceList].sort((a, b) => 
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    );
  });

// Hook to get workspaces sorted by creation date (newest first) - memoized for stability
export const useWorkspacesByCreated = () =>
  useWorkspaceStore(state => {
    // Use the stable workspace list and sort it
    return [...state._workspaceList].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

// Hook to check if a workspace exists
export const useWorkspaceExists = (id: string | null) =>
  useWorkspaceStore(state => id ? !!state.workspaces[id] : false);

// Hook to get workspace count (stable reference from pre-computed state)
export const useWorkspaceCount = () =>
  useWorkspaceStore(state => state._workspaceList.length);

// Hook to check if workspace store is initialized
export const useWorkspaceInitialized = () => 
  useWorkspaceStore(state => state._initialized);