import { create } from 'zustand';
import { IpcRendererEvent } from 'electron';
import {
  WorkspaceState,
  WorkspaceMetadata,
  WorkspaceCreatedEvent,
  WorkspaceUpdatedEvent,
  WorkspaceDeletedEvent,
  WorkspaceGroup,
  WorkspaceGroupColor,
} from './types/StoreTypes';
import { createStoreLogger } from '../utils/logger';

// ============================================================================
// WORKSPACE STORE - WORKSPACE MANAGEMENT
// ============================================================================

const logger = createStoreLogger('Workspace');

// Helper function to load step content for a workspace
const loadWorkspaceStepContent = async (workspaceId: string) => {
  try {
    // Import and use the step store's loadAllStepContent method
    const { useStepStore } = await import('./useStepStore');
    await useStepStore.getState().actions.loadAllStepContent(workspaceId);
  } catch (error) {
    logger.error('Failed to load workspace step content', {
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - allow workspace switching to continue
  }
};

// Helper function to compute derived state for stable references
const computeDerivedState = (workspaces: Record<string, WorkspaceMetadata>) => {
  // Compute workspace list
  const workspaceList = Object.values(workspaces);

  // Compute available groups
  const availableGroups = workspaceList.reduce((groups, workspace) => {
    if (workspace.group && !groups.find((g) => g.id === workspace.group!.id)) {
      groups.push(workspace.group);
    }
    return groups;
  }, [] as WorkspaceGroup[]);

  // Compute grouped workspaces
  const groupedWorkspaces = workspaceList.reduce(
    (grouped, workspace) => {
      if (workspace.group) {
        if (!grouped[workspace.group.id]) {
          grouped[workspace.group.id] = {
            group: workspace.group,
            workspaces: [],
          };
        }
        grouped[workspace.group.id].workspaces.push(workspace);
      } else {
        if (!grouped['ungrouped']) {
          grouped['ungrouped'] = {
            group: null,
            workspaces: [],
          };
        }
        grouped['ungrouped'].workspaces.push(workspace);
      }
      return grouped;
    },
    {} as Record<string, { group: WorkspaceGroup | null; workspaces: WorkspaceMetadata[] }>
  );

  return {
    _workspaceList: workspaceList,
    _availableGroups: availableGroups,
    _groupedWorkspaces: groupedWorkspaces,
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

  // Flag to track when deletion is being handled by action (to prevent IPC override)
  _deletingWorkspaceId: null as string | null,

  // Actions
  actions: {
    createWorkspace: async (name: string, backgroundColor?: string, emoji?: string) => {
      try {
        set({ isLoading: true, error: null });
        const result = await window.electron.ipcRenderer.invoke(
          'workspace:create',
          name,
          backgroundColor,
          emoji
        );

        // Update local state immediately
        set((state) => ({
          workspaces: {
            ...state.workspaces,
            [result.id]: {
              id: result.workspace.id,
              name: result.workspace.name,
              createdAt: result.workspace.createdAt,
              lastAccessed: result.workspace.lastAccessed,
              backgroundColor: result.workspace.backgroundColor,
              emoji: result.workspace.emoji,
            },
          },
          currentWorkspaceId: result.id,
          isLoading: false,
        }));

        // Also update the step store's current workspace ID for synchronization
        try {
          const { useStepStore } = await import('./useStepStore');
          useStepStore.setState({ currentWorkspaceId: result.id });
        } catch (error) {
          logger.warn('Could not sync workspace ID to step store', {
            workspaceId: result.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Recompute derived state for stable references
        get().actions._recomputeDerivedState();

        // Load the new workspace's step content to avoid showing stale data
        try {
          await loadWorkspaceStepContent(result.id);
        } catch (loadError) {
          logger.warn('Could not load step content for newly created workspace', {
            workspaceId: result.id,
            error: loadError instanceof Error ? loadError.message : String(loadError),
          });
        }

        // Load workflow state for the new workspace (defaults if none)
        try {
          const { useWorkflowStore } = await import('./useWorkflowStore');
          await useWorkflowStore.getState().actions.loadWorkflowState(result.id);
          logger.debug('Loaded workflow state for newly created workspace', {
            workspaceId: result.id,
          });
        } catch (workflowError) {
          logger.warn('Could not load workflow state for newly created workspace', {
            workspaceId: result.id,
            error: workflowError instanceof Error ? workflowError.message : String(workflowError),
          });
        }

        // Mark as active in the app state (renderer + main)
        try {
          const { useAppStore } = await import('./useAppStore');
          useAppStore.setState({ activeWorkspaceId: result.id });
          await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', result.id);
        } catch (syncError) {
          logger.warn('Could not sync active workspace after creation', {
            workspaceId: result.id,
            error: syncError instanceof Error ? syncError.message : String(syncError),
          });
        }

        return result.id;
      } catch (error) {
        logger.error('Failed to create workspace', {
          name,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create workspace',
        });
        throw error;
      }
    },

    deleteWorkspace: async (id: string) => {
      try {
        set({ isLoading: true, error: null, _deletingWorkspaceId: id });

        const currentState = get();
        const isCurrentWorkspace = currentState.currentWorkspaceId === id;
        let newActiveWorkspaceId: string | null = null;

        // If we're deleting the current workspace, find an alternative
        if (isCurrentWorkspace) {
          const remainingWorkspaces = Object.values(currentState.workspaces).filter(
            (ws) => ws.id !== id
          );

          if (remainingWorkspaces.length > 0) {
            try {
              const { useAppStore } = await import('./useAppStore');
              const appState = useAppStore.getState();
              const recentWorkspaceIds = appState.recentWorkspaces || [];

              // Find the most recent workspace that still exists (excluding the one being deleted)
              const mostRecentWorkspace = recentWorkspaceIds
                .filter((wsId) => wsId !== id && currentState.workspaces[wsId])
                .map((wsId) => currentState.workspaces[wsId])
                .shift();

              if (mostRecentWorkspace) {
                newActiveWorkspaceId = mostRecentWorkspace.id;
              } else {
                // Fallback to the most recently accessed workspace
                const sortedByAccess = remainingWorkspaces.sort(
                  (a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
                );
                newActiveWorkspaceId = sortedByAccess[0].id;
              }
            } catch (error) {
              logger.warn(
                'Could not access app store for recent workspaces, using fallback selection',
                {
                  workspaceId: id,
                  error: error instanceof Error ? error.message : String(error),
                }
              );
              // Fallback: select the most recently accessed remaining workspace
              const sortedByAccess = remainingWorkspaces.sort(
                (a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
              );
              newActiveWorkspaceId = sortedByAccess[0].id;
            }
          }
        }

        const success = await window.electron.ipcRenderer.invoke('workspace:delete', id);

        if (success) {
          // Update workspace store state
          set((state) => {
            const { [id]: removed, ...remaining } = state.workspaces;
            const updatedCurrentWorkspaceId = isCurrentWorkspace
              ? newActiveWorkspaceId
              : state.currentWorkspaceId;

            return {
              workspaces: remaining,
              currentWorkspaceId: updatedCurrentWorkspaceId,
              isLoading: false,
              _deletingWorkspaceId: null,
            };
          });

          // If we found an alternative workspace, switch to it
          if (isCurrentWorkspace && newActiveWorkspaceId) {
            try {
              // Load step content for the new workspace
              await loadWorkspaceStepContent(newActiveWorkspaceId);

              // Load workflow state for the new workspace to ensure complete workspace isolation
              try {
                const { useWorkflowStore } = await import('./useWorkflowStore');
                await useWorkflowStore.getState().actions.loadWorkflowState(newActiveWorkspaceId);
                logger.debug('Loaded workflow state for alternative workspace after deletion', {
                  workspaceId: newActiveWorkspaceId,
                });
              } catch (workflowError) {
                logger.warn('Could not load workflow state for alternative workspace', {
                  workspaceId: newActiveWorkspaceId,
                  error:
                    workflowError instanceof Error ? workflowError.message : String(workflowError),
                });
                // Continue with workspace switching even if workflow state loading fails
              }

              // Sync with step store
              const { useStepStore } = await import('./useStepStore');
              useStepStore.setState({ currentWorkspaceId: newActiveWorkspaceId });

              // Set as active in app state - this is crucial for maintaining active workspace state
              await window.electron.ipcRenderer.invoke(
                'app:setActiveWorkspace',
                newActiveWorkspaceId
              );

              // Also update the app store directly for immediate UI update
              const { useAppStore } = await import('./useAppStore');
              useAppStore.setState({ activeWorkspaceId: newActiveWorkspaceId });
            } catch (error) {
              logger.error('Failed to switch to alternative workspace after deletion', {
                workspaceId: id,
                newWorkspaceId: newActiveWorkspaceId,
                error: error instanceof Error ? error.message : String(error),
              });
              // Even if switching fails, the deletion was successful, so don't throw
            }
          } else if (isCurrentWorkspace) {
            // No alternative workspace available, ensure app store is also set to null
            try {
              const { useAppStore } = await import('./useAppStore');
              useAppStore.setState({ activeWorkspaceId: null });
              await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', null);
            } catch (error) {
              logger.warn('Could not sync null workspace state with app store', {
                workspaceId: id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Recompute derived state for stable references
          get().actions._recomputeDerivedState();
        } else {
          set({
            isLoading: false,
            error: 'Failed to delete workspace',
            _deletingWorkspaceId: null,
          });
        }

        return success;
      } catch (error) {
        logger.error('Failed to delete workspace', {
          workspaceId: id,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to delete workspace',
          _deletingWorkspaceId: null,
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

        // Load step content for this workspace
        await loadWorkspaceStepContent(id);

        // Load workflow state for this workspace to ensure complete workspace isolation
        try {
          const { useWorkflowStore } = await import('./useWorkflowStore');
          await useWorkflowStore.getState().actions.loadWorkflowState(id);
          logger.debug('Loaded workflow state for workspace', { workspaceId: id });
        } catch (error) {
          logger.warn('Could not load workflow state during workspace switch', {
            workspaceId: id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't throw - allow workspace switching to continue even if workflow state loading fails
        }

        // Also update the step store's current workspace ID for synchronization
        try {
          const { useStepStore } = await import('./useStepStore');
          useStepStore.setState({ currentWorkspaceId: id });
        } catch (error) {
          logger.warn('Could not sync workspace ID to step store', {
            workspaceId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Set as active in app state (this will also update recent workspaces)
        await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', id);

        // Also update the app store directly for immediate UI update
        try {
          const { useAppStore } = await import('./useAppStore');
          useAppStore.setState({ activeWorkspaceId: id });
        } catch (error) {
          logger.warn('Could not sync activeWorkspaceId to app store', {
            workspaceId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } catch (error) {
        logger.error('Failed to switch workspace', {
          workspaceId: id,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to switch workspace',
        });
      }
    },

    loadGroups: async () => {
      try {
        const groups = await window.electron.ipcRenderer.invoke('group:list');
        logger.debug('Loaded groups from persistence', { groups });
        set({ _availableGroups: groups });
        return groups;
      } catch (error) {
        logger.error('Failed to load groups', {
          error: error instanceof Error ? error.message : String(error),
        });
        set({ _availableGroups: [] });
        return [];
      }
    },

    loadWorkspaces: async () => {
      try {
        set({ isLoading: true, error: null });

        // Load groups first
        const groups = await get().actions.loadGroups();
        const groupsById = groups.reduce(
          (acc: Record<string, WorkspaceGroup>, group: WorkspaceGroup) => {
            acc[group.id] = group;
            return acc;
          },
          {}
        );

        // Load workspaces and associate with groups
        const workspaceList = await window.electron.ipcRenderer.invoke('workspace:list');
        logger.debug('Loaded workspaces from persistence', {
          workspaceCount: workspaceList.length,
          groupCount: Object.keys(groupsById).length,
        });

        const workspaces = workspaceList.reduce(
          (
            acc: Record<string, WorkspaceMetadata>,
            ws: WorkspaceMetadata & { groupId?: string }
          ) => {
            // Convert workspace data and associate with group if it exists
            const workspace: WorkspaceMetadata = {
              id: ws.id,
              name: ws.name,
              createdAt: ws.createdAt,
              lastAccessed: ws.lastAccessed,
              backgroundColor: ws.backgroundColor,
              emoji: ws.emoji,
              group: ws.groupId ? groupsById[ws.groupId] || null : null,
            };

            if (ws.groupId) {
              if (!groupsById[ws.groupId]) {
                logger.warn('Workspace has invalid group reference', {
                  workspaceId: ws.id,
                  workspaceName: ws.name,
                  invalidGroupId: ws.groupId,
                });
              }
            }

            acc[ws.id] = workspace;
            return acc;
          },
          {}
        );

        set({ workspaces, isLoading: false, _initialized: true });

        // Recompute derived state for stable references
        get().actions._recomputeDerivedState();
      } catch (error) {
        logger.error('Failed to load workspaces', {
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load workspaces',
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
        logger.error('Failed to rename workspace', {
          workspaceId: id,
          newName: newName,
          error: error instanceof Error ? error.message : String(error),
        });
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
        logger.error('Failed to duplicate workspace', {
          sourceId: id,
          newName: newName,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to duplicate workspace',
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
        set({ isLoading: true, error: null });

        const groupData = {
          name,
          color,
        };

        // Create group via IPC - the IPC handler will generate ID and return full group data
        const result = await window.electron.ipcRenderer.invoke('group:create', groupData);

        if (result && result.id && result.group) {
          // Update local state - add the new group to available groups immediately
          const currentState = get();
          set({
            _availableGroups: [...currentState._availableGroups, result.group],
            isLoading: false,
          });
          return result.id;
        } else {
          throw new Error('Failed to create group via IPC');
        }
      } catch (error) {
        logger.error('Failed to create group', {
          name: name,
          color: color,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create group',
        });
        throw error;
      }
    },

    deleteGroup: async (groupId: string) => {
      try {
        set({ isLoading: true, error: null });

        const success = await window.electron.ipcRenderer.invoke('group:delete', groupId);

        if (success) {
          // Remove group association from all workspaces
          const currentState = get();
          const updatedWorkspaces = { ...currentState.workspaces };

          // Clear group from all workspaces that have this group
          Object.values(updatedWorkspaces).forEach((workspace) => {
            if (workspace.group?.id === groupId) {
              updatedWorkspaces[workspace.id] = {
                ...workspace,
                group: null,
              };
            }
          });

          set({ workspaces: updatedWorkspaces, isLoading: false });
          get().actions._recomputeDerivedState();
          return true;
        } else {
          set({ isLoading: false, error: 'Failed to delete group' });
          return false;
        }
      } catch (error) {
        logger.error('Failed to delete group', {
          groupId: groupId,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to delete group',
        });
        return false;
      }
    },

    updateGroup: async (
      groupId: string,
      updates: Partial<Omit<WorkspaceGroup, 'id' | 'metadata'>>
    ) => {
      try {
        set({ isLoading: true, error: null });

        const success = await window.electron.ipcRenderer.invoke('group:update', groupId, updates);

        if (success) {
          // Update group in all affected workspaces
          const currentState = get();
          const updatedWorkspaces = { ...currentState.workspaces };

          Object.values(updatedWorkspaces).forEach((workspace) => {
            if (workspace.group?.id === groupId) {
              updatedWorkspaces[workspace.id] = {
                ...workspace,
                group: {
                  ...workspace.group,
                  ...updates,
                  metadata: {
                    ...workspace.group.metadata,
                    lastModified: new Date(),
                  },
                },
              };
            }
          });

          set({ workspaces: updatedWorkspaces, isLoading: false });
          get().actions._recomputeDerivedState();
          return true;
        } else {
          set({ isLoading: false, error: 'Failed to update group' });
          return false;
        }
      } catch (error) {
        logger.error('Failed to update group', {
          groupId: groupId,
          updates: updates,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to update group',
        });
        return false;
      }
    },

    addWorkspaceToGroup: async (workspaceId: string, groupId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Get the group information
        const currentState = get();
        const existingGroup = currentState._availableGroups.find((g) => g.id === groupId);

        if (!existingGroup) {
          throw new Error(
            `Group not found: ${groupId}. Available groups: ${currentState._availableGroups.map((g) => g.id).join(', ')}`
          );
        }

        // Update workspace with group information via IPC
        const success = await window.electron.ipcRenderer.invoke(
          'workspace:addToGroup',
          workspaceId,
          groupId
        );

        if (success) {
          // Update local workspace state
          const updatedWorkspace = {
            ...currentState.workspaces[workspaceId],
            group: {
              ...existingGroup,
              metadata: {
                ...existingGroup.metadata,
                workspaceCount: existingGroup.metadata.workspaceCount + 1,
                lastModified: new Date(),
              },
            },
          };

          set({
            workspaces: {
              ...currentState.workspaces,
              [workspaceId]: updatedWorkspace,
            },
            isLoading: false,
          });

          get().actions._recomputeDerivedState();
        } else {
          throw new Error('Failed to add workspace to group via IPC');
        }
      } catch (error) {
        logger.error('Failed to add workspace to group', {
          workspaceId: workspaceId,
          groupId: groupId,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to add workspace to group',
        });
        throw error;
      }
    },

    removeWorkspaceFromGroup: async (workspaceId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Remove workspace from group via IPC
        const success = await window.electron.ipcRenderer.invoke(
          'workspace:removeFromGroup',
          workspaceId
        );

        if (success) {
          // Update local workspace state
          const currentState = get();
          const updatedWorkspace = {
            ...currentState.workspaces[workspaceId],
            group: null,
          };

          set({
            workspaces: {
              ...currentState.workspaces,
              [workspaceId]: updatedWorkspace,
            },
            isLoading: false,
          });

          get().actions._recomputeDerivedState();
        } else {
          throw new Error('Failed to remove workspace from group via IPC');
        }
      } catch (error) {
        logger.error('Failed to remove workspace from group', {
          workspaceId: workspaceId,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to remove workspace from group',
        });
        throw error;
      }
    },

    toggleGroupExpansion: async (groupId: string) => {
      try {
        const currentState = get();
        const group = currentState._availableGroups.find((g) => g.id === groupId);

        if (!group) {
          throw new Error(`Group not found: ${groupId}`);
        }

        const newExpandedState = !group.isExpanded;

        // Update group expansion state via IPC
        const success = await window.electron.ipcRenderer.invoke('group:update', groupId, {
          isExpanded: newExpandedState,
        });

        if (success) {
          // Update local group state
          const updatedGroups = currentState._availableGroups.map((g) =>
            g.id === groupId ? { ...g, isExpanded: newExpandedState } : g
          );

          // Update workspaces that reference this group
          const updatedWorkspaces = { ...currentState.workspaces };
          Object.keys(updatedWorkspaces).forEach((workspaceId) => {
            if (updatedWorkspaces[workspaceId].group?.id === groupId) {
              updatedWorkspaces[workspaceId] = {
                ...updatedWorkspaces[workspaceId],
                group: {
                  ...updatedWorkspaces[workspaceId].group!,
                  isExpanded: newExpandedState,
                },
              };
            }
          });

          set({
            _availableGroups: updatedGroups,
            workspaces: updatedWorkspaces,
          });

          get().actions._recomputeDerivedState();
        } else {
          throw new Error('Failed to update group expansion state via IPC');
        }
      } catch (error) {
        logger.error('Failed to toggle group expansion', {
          groupId: groupId,
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          error: error instanceof Error ? error.message : 'Failed to toggle group expansion',
        });
        throw error;
      }
    },

    // Internal helper to recompute derived state for stable references
    _recomputeDerivedState: () => {
      const currentState = get();
      const derivedState = computeDerivedState(currentState.workspaces);
      set(derivedState);
    },
  },
}));

// ============================================================================
// IPC EVENT LISTENERS FOR REAL-TIME SYNC
// ============================================================================

// Initialize IPC listeners with defensive state updates
if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
  // Workspace created event - defensive update
  window.electron.ipcRenderer.on(
    'workspace:created',
    (_: IpcRendererEvent, { id, workspace }: WorkspaceCreatedEvent) => {
      useWorkspaceStore.setState((currentState) => {
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
              lastAccessed: workspace.lastAccessed,
              backgroundColor: workspace.backgroundColor,
              emoji: workspace.emoji,
            },
          },
        };

        // Recompute derived state
        const derivedState = computeDerivedState(newState.workspaces);
        return { ...newState, ...derivedState };
      });
    }
  );

  // Workspace updated event - defensive update
  window.electron.ipcRenderer.on(
    'workspace:updated',
    (_: IpcRendererEvent, { id, workspace }: WorkspaceUpdatedEvent) => {
      useWorkspaceStore.setState((currentState) => {
        const existingWorkspace = currentState.workspaces[id];

        // Only update if workspace exists and has actually changed
        if (
          !existingWorkspace ||
          (existingWorkspace.name === workspace.name &&
            existingWorkspace.lastAccessed === workspace.lastAccessed)
        ) {
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
              lastAccessed: workspace.lastAccessed,
              backgroundColor: workspace.backgroundColor,
              emoji: workspace.emoji,
            },
          },
        };

        // Recompute derived state
        const derivedState = computeDerivedState(newState.workspaces);
        return { ...newState, ...derivedState };
      });
    }
  );

  // Workspace deleted event - defensive update
  window.electron.ipcRenderer.on(
    'workspace:deleted',
    (_: IpcRendererEvent, { id }: WorkspaceDeletedEvent) => {
      useWorkspaceStore.setState((currentState) => {
        // Only update if workspace actually exists
        if (!currentState.workspaces[id]) {
          return currentState; // No change needed
        }

        // Check if this deletion is currently being handled by the deleteWorkspace action
        // If so, skip the IPC event handling to avoid overriding the action's smart logic
        if (currentState._deletingWorkspaceId === id) {
          return currentState; // Let the action handle it
        }

        const { [id]: removed, ...remaining } = currentState.workspaces;

        // Smart preservation of current workspace state:
        // 1. If we're deleting a different workspace, preserve currentWorkspaceId
        // 2. If we're deleting the current workspace, only set to null if no other workspaces exist
        let newCurrentWorkspaceId = currentState.currentWorkspaceId;

        if (currentState.currentWorkspaceId === id) {
          // Only set to null if no other workspaces remain
          const remainingWorkspaceIds = Object.keys(remaining);
          if (remainingWorkspaceIds.length === 0) {
            newCurrentWorkspaceId = null;
          } else {
            // Try to find a reasonable alternative workspace from remaining ones
            const remainingWorkspaces = Object.values(remaining);
            const sortedByAccess = remainingWorkspaces.sort(
              (a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
            );
            newCurrentWorkspaceId = sortedByAccess[0].id;
          }
        }

        const newState = {
          ...currentState,
          workspaces: remaining,
          currentWorkspaceId: newCurrentWorkspaceId,
        };

        // Recompute derived state
        const derivedState = computeDerivedState(newState.workspaces);
        return { ...newState, ...derivedState };
      });
    }
  );

  // Group event listeners for real-time sync
  window.electron.ipcRenderer.on(
    'group:created',
    (_: IpcRendererEvent, { id, group }: { id: string; group: WorkspaceGroup }) => {
      useWorkspaceStore.setState((currentState) => {
        // Check if group already exists
        if (currentState._availableGroups.find((g) => g.id === id)) {
          return currentState; // No change needed
        }

        return {
          ...currentState,
          _availableGroups: [...currentState._availableGroups, group],
        };
      });
    }
  );

  window.electron.ipcRenderer.on(
    'group:updated',
    (_: IpcRendererEvent, { groupId, group }: { groupId: string; group: WorkspaceGroup }) => {
      useWorkspaceStore.setState((currentState) => {
        const groupIndex = currentState._availableGroups.findIndex((g) => g.id === groupId);
        if (groupIndex === -1) {
          return currentState; // Group not found
        }

        const updatedGroups = [...currentState._availableGroups];
        updatedGroups[groupIndex] = group;

        // Also update workspaces that reference this group
        const updatedWorkspaces = { ...currentState.workspaces };
        Object.keys(updatedWorkspaces).forEach((workspaceId) => {
          if (updatedWorkspaces[workspaceId].group?.id === groupId) {
            updatedWorkspaces[workspaceId] = {
              ...updatedWorkspaces[workspaceId],
              group,
            };
          }
        });

        const newState = {
          ...currentState,
          _availableGroups: updatedGroups,
          workspaces: updatedWorkspaces,
        };

        // Recompute derived state
        const derivedState = computeDerivedState(newState.workspaces);
        return { ...newState, ...derivedState };
      });
    }
  );

  window.electron.ipcRenderer.on(
    'group:deleted',
    (_: IpcRendererEvent, { groupId }: { groupId: string }) => {
      useWorkspaceStore.setState((currentState) => {
        // Remove group from available groups
        const updatedGroups = currentState._availableGroups.filter((g) => g.id !== groupId);

        // Remove group association from all workspaces
        const updatedWorkspaces = { ...currentState.workspaces };
        Object.keys(updatedWorkspaces).forEach((workspaceId) => {
          if (updatedWorkspaces[workspaceId].group?.id === groupId) {
            updatedWorkspaces[workspaceId] = {
              ...updatedWorkspaces[workspaceId],
              group: null,
            };
          }
        });

        const newState = {
          ...currentState,
          _availableGroups: updatedGroups,
          workspaces: updatedWorkspaces,
        };

        // Recompute derived state
        const derivedState = computeDerivedState(newState.workspaces);
        return { ...newState, ...derivedState };
      });
    }
  );
}

// ============================================================================
// HELPER HOOKS AND SELECTORS
// ============================================================================

// Hook to get all workspaces as an array (stable reference from pre-computed state)
export const useWorkspaceList = () => useWorkspaceStore((state) => state._workspaceList);

// Hook to get grouped workspaces (stable reference from pre-computed state)
export const useGroupedWorkspaces = () => useWorkspaceStore((state) => state._groupedWorkspaces);

// Hook to get available groups (stable reference from pre-computed state)
export const useAvailableGroups = () => useWorkspaceStore((state) => state._availableGroups);

// Hook to get current workspace
export const useCurrentWorkspace = () => {
  return useWorkspaceStore((state) => {
    if (!state.currentWorkspaceId) return null;
    return state.workspaces[state.currentWorkspaceId] || null;
  });
};

// Hook to get workspace by ID
export const useWorkspace = (id: string | null) =>
  useWorkspaceStore((state) => (id ? state.workspaces[id] : null));

// Individual action hooks to prevent reference changes
export const useCreateWorkspace = () => useWorkspaceStore((state) => state.actions.createWorkspace);
export const useDeleteWorkspace = () => useWorkspaceStore((state) => state.actions.deleteWorkspace);
export const useSwitchWorkspace = () => useWorkspaceStore((state) => state.actions.switchWorkspace);
export const useRenameWorkspace = () => useWorkspaceStore((state) => state.actions.renameWorkspace);
export const useDuplicateWorkspace = () =>
  useWorkspaceStore((state) => state.actions.duplicateWorkspace);
export const useCreateGroup = () => useWorkspaceStore((state) => state.actions.createGroup);
export const useDeleteGroup = () => useWorkspaceStore((state) => state.actions.deleteGroup);
export const useUpdateGroup = () => useWorkspaceStore((state) => state.actions.updateGroup);
export const useAddWorkspaceToGroup = () =>
  useWorkspaceStore((state) => state.actions.addWorkspaceToGroup);
export const useRemoveWorkspaceFromGroup = () =>
  useWorkspaceStore((state) => state.actions.removeWorkspaceFromGroup);
export const useToggleGroupExpansion = () =>
  useWorkspaceStore((state) => state.actions.toggleGroupExpansion);

// Hook to get workspace action state
export const useWorkspaceActions = () => useWorkspaceStore((state) => state.actions);

// Hook to get workspace loading state
export const useWorkspaceLoading = () => useWorkspaceStore((state) => state.isLoading);

// Hook to get workspace error state
export const useWorkspaceError = () => useWorkspaceStore((state) => state.error);

// Hook to get workspaces sorted by last accessed (most recent first) - memoized for stability
export const useRecentWorkspaces = () =>
  useWorkspaceStore((state) => {
    // Use the stable workspace list and sort it
    return [...state._workspaceList].sort(
      (a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    );
  });

// Hook to get workspaces sorted by creation date (newest first) - memoized for stability
export const useWorkspacesByCreated = () =>
  useWorkspaceStore((state) => {
    // Use the stable workspace list and sort it
    return [...state._workspaceList].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

// Hook to check if a workspace exists
export const useWorkspaceExists = (id: string | null) =>
  useWorkspaceStore((state) => (id ? !!state.workspaces[id] : false));

// Hook to get workspace count (stable reference from pre-computed state)
export const useWorkspaceCount = () => useWorkspaceStore((state) => state._workspaceList.length);

// Hook to check if workspace store is initialized
export const useWorkspaceInitialized = () => useWorkspaceStore((state) => state._initialized);
