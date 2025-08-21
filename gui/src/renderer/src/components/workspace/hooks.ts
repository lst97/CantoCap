/**
 * Simplified Workspace Hooks
 * Clean integration with new Zustand-based workspace store
 */

import { useCallback, useMemo } from 'react';
import {
  useWorkspaceStore,
  useWorkspaceList,
  useCurrentWorkspace,
  useWorkspaceLoading,
  useWorkspaceError,
  useWorkspaceCount,
  useCreateWorkspace,
  useDeleteWorkspace,
  useSwitchWorkspace,
  useRenameWorkspace,
  useDuplicateWorkspace,
  useCreateGroup,
  useAddWorkspaceToGroup,
  useRemoveWorkspaceFromGroup,
} from '../../stores/useWorkspaceStore';
import type { WorkspaceWithGrouping, WorkspaceGroupColor } from '../../stores/types/StoreTypes';
import { createHookLogger } from '../../utils/logger';
/**
 * Primary hook for workspace management
 * Provides all workspace state and actions needed by components
 * Simplified to use new store architecture
 */
export const useWorkspaceManagement = (): {
  workspaces: WorkspaceWithGrouping[];
  activeWorkspace: WorkspaceWithGrouping | null;
  isLoading: boolean;
  error: string | null;
  workspaceCount: number;
  createWorkspace: (name: string) => Promise<string>;
  switchWorkspace: (id: string) => Promise<void>;
  renameWorkspace: (id: string, newName: string) => Promise<boolean>;
  duplicateWorkspace: (id: string, newName: string) => Promise<string | null>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  createGroup: (name: string, color?: WorkspaceGroupColor) => Promise<string>;
  addWorkspaceToGroup: (workspaceId: string, groupId: string) => Promise<void>;
  removeWorkspaceFromGroup: (workspaceId: string) => Promise<void>;
} => {
  const workspaces = useWorkspaceList() as WorkspaceWithGrouping[];
  const currentWorkspace = useCurrentWorkspace() as WorkspaceWithGrouping | null;
  const isLoading = useWorkspaceLoading();
  const error = useWorkspaceError();
  const workspaceCount = useWorkspaceCount();

  // Individual action hooks to prevent reference changes
  const createWorkspace = useCreateWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const renameWorkspace = useRenameWorkspace();
  const duplicateWorkspace = useDuplicateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const createGroup = useCreateGroup();
  const addWorkspaceToGroup = useAddWorkspaceToGroup();
  const removeWorkspaceFromGroup = useRemoveWorkspaceFromGroup();

  // Memoize the returned object to prevent infinite re-renders
  return useMemo(
    () => ({
      // State
      workspaces,
      activeWorkspace: currentWorkspace,
      isLoading,
      error,
      workspaceCount,

      // Actions
      createWorkspace,
      switchWorkspace,
      renameWorkspace,
      duplicateWorkspace,
      deleteWorkspace,

      // Group management actions
      createGroup,
      addWorkspaceToGroup,
      removeWorkspaceFromGroup,
    }),
    [
      workspaces,
      currentWorkspace,
      isLoading,
      error,
      workspaceCount,
      createWorkspace,
      switchWorkspace,
      renameWorkspace,
      duplicateWorkspace,
      deleteWorkspace,
      createGroup,
      addWorkspaceToGroup,
      removeWorkspaceFromGroup,
    ]
  );
};

/**
 * Hook for workspace panel integration
 * Provides simplified interface specifically for WorkspacePanel components
 * Simplified to avoid complex memoization and potential infinite loops
 */
export const useWorkspacePanelIntegration = (): {
  workspaces: WorkspaceWithGrouping[];
  activeWorkspace: WorkspaceWithGrouping | null;
  isLoading: boolean;
  error: string | null;
  workspaceCount: number;
  onCreateWorkspace: (name: string, copyFromId?: string) => Promise<void>;
  onSwitchWorkspace: (workspaceId: string) => Promise<void>;
  onRenameWorkspace: (workspaceId: string, newName: string) => Promise<void>;
  onDuplicateWorkspace: (workspaceId: string, newName?: string) => Promise<void>;
  onDeleteWorkspace: (workspaceId: string) => Promise<void>;
  onCreateGroup: (name: string, workspaceId: string) => Promise<string>;
  onAddToGroup: (workspaceId: string, groupId: string) => Promise<void>;
  onRemoveFromGroup: (workspaceId: string) => Promise<void>;
} => {
  const logger = createHookLogger('WorkspacePanelHook');
  // Use store hooks directly to avoid complex memoization chains
  const workspaces = useWorkspaceList() as WorkspaceWithGrouping[];
  const activeWorkspace = useCurrentWorkspace() as WorkspaceWithGrouping | null;
  const isLoading = useWorkspaceLoading();
  const error = useWorkspaceError();
  const workspaceCount = useWorkspaceCount();

  // Get action hooks directly
  const createWorkspace = useCreateWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const renameWorkspace = useRenameWorkspace();
  const duplicateWorkspace = useDuplicateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const createGroup = useCreateGroup();
  const addWorkspaceToGroup = useAddWorkspaceToGroup();
  const removeWorkspaceFromGroup = useRemoveWorkspaceFromGroup();

  // Workspace panel specific actions with error handling
  const onCreateWorkspace = useCallback(
    async (name: string, copyFromId?: string) => {
      try {
        if (copyFromId) {
          await duplicateWorkspace(copyFromId, name);
        } else {
          await createWorkspace(name);
        }
      } catch (error) {
        logger.error('Failed to create workspace in panel', { name, copyFromId, error });
        throw error;
      }
    },
    [createWorkspace, duplicateWorkspace, logger]
  );

  const onSwitchWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        await switchWorkspace(workspaceId);
      } catch (error) {
        logger.error('Failed to switch workspace in panel', { workspaceId, error });
        throw error;
      }
    },
    [switchWorkspace, logger]
  );

  const onRenameWorkspace = useCallback(
    async (workspaceId: string, newName: string) => {
      try {
        await renameWorkspace(workspaceId, newName);
      } catch (error) {
        logger.error('Failed to rename workspace in panel', { workspaceId, newName, error });
        throw error;
      }
    },
    [renameWorkspace, logger]
  );

  const onDuplicateWorkspace = useCallback(
    async (workspaceId: string, newName?: string) => {
      try {
        // Get current workspaces inside callback to avoid dependency
        const currentWorkspaces = useWorkspaceStore.getState().workspaces;
        const workspace = currentWorkspaces[workspaceId];
        const defaultName = `Copy of ${workspace?.name || 'Workspace'}`;
        await duplicateWorkspace(workspaceId, newName || defaultName);
      } catch (error) {
        logger.error('Failed to duplicate workspace in panel', { workspaceId, newName, error });
        throw error;
      }
    },
    [duplicateWorkspace, logger]
  );

  const onDeleteWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        await deleteWorkspace(workspaceId);
      } catch (error) {
        logger.error('Failed to delete workspace in panel', { workspaceId, error });
        throw error;
      }
    },
    [deleteWorkspace, logger]
  );

  const onCreateGroup = useCallback(
    async (name: string, workspaceId: string) => {
      try {
        const groupId = await createGroup(name);
        await addWorkspaceToGroup(workspaceId, groupId);
        return groupId;
      } catch (error) {
        logger.error('Failed to create group in panel', { name, workspaceId, error });
        throw error;
      }
    },
    [createGroup, addWorkspaceToGroup, logger]
  );

  const onAddToGroup = useCallback(
    async (workspaceId: string, groupId: string) => {
      try {
        await addWorkspaceToGroup(workspaceId, groupId);
      } catch (error) {
        logger.error('Failed to add workspace to group in panel', { workspaceId, groupId, error });
        throw error;
      }
    },
    [addWorkspaceToGroup, logger]
  );

  const onRemoveFromGroup = useCallback(
    async (workspaceId: string) => {
      try {
        await removeWorkspaceFromGroup(workspaceId);
      } catch (error) {
        logger.error('Failed to remove workspace from group in panel', { workspaceId, error });
        throw error;
      }
    },
    [removeWorkspaceFromGroup, logger]
  );

  // Return simple object without complex memoization to avoid infinite loops
  return {
    // State
    workspaces: workspaces || [],
    activeWorkspace,
    isLoading,
    error,
    workspaceCount,

    // Actions
    onCreateWorkspace,
    onSwitchWorkspace,
    onRenameWorkspace,
    onDuplicateWorkspace,
    onDeleteWorkspace,
    onCreateGroup,
    onAddToGroup,
    onRemoveFromGroup,
  };
};
