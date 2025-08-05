/**
 * Custom hook for handling workspace state synchronization with StepNavigation
 * Provides optimized state management and integration with app-store
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { workflowStateManager } from '../services/workflow/workflow-state-manager';
import { StateChangeEvent } from '../types/workflow-state';

interface WorkspaceStateSyncOptions {
  syncDebounceMs?: number;
  minSyncInterval?: number;
  enableLogging?: boolean;
}

interface WorkspaceStateSyncResult {
  syncToWorkspace: (event: StateChangeEvent) => Promise<void>;
  restoreFromWorkspace: () => Promise<boolean>;
  updateImportContext: (importedJsonFile: string | null) => Promise<void>;
  isInitialMount: React.MutableRefObject<boolean>;
  clearSyncTimer: () => void;
}

export function useWorkspaceStateSync(
  options: WorkspaceStateSyncOptions = {}
): WorkspaceStateSyncResult {
  const {
    syncDebounceMs = 500,
    minSyncInterval = 1000,
    enableLogging = process.env.NODE_ENV === 'development'
  } = options;

  const { importedJsonFile } = useAppStore();
  const { currentWorkspace } = useWorkspaceStore();
  
  // Refs for performance optimization
  const lastSyncTimestamp = useRef<number>(0);
  const syncDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef<boolean>(true);

  // Cleanup function
  const clearSyncTimer = useCallback(() => {
    if (syncDebounceTimer.current) {
      clearTimeout(syncDebounceTimer.current);
      syncDebounceTimer.current = null;
    }
  }, []);

  // Workspace sync function with debouncing
  const syncToWorkspace = useCallback(async (event: StateChangeEvent) => {
    if (!currentWorkspace?.id) return;
    
    const now = Date.now();
    
    // Debounce sync operations to prevent excessive calls
    if (now - lastSyncTimestamp.current < minSyncInterval) {
      clearSyncTimer();
      
      syncDebounceTimer.current = setTimeout(async () => {
        try {
          await workflowStateManager.syncToWorkspaceConfig(currentWorkspace.id);
          lastSyncTimestamp.current = Date.now();
          
          if (enableLogging) {
            console.log('🔄 [WORKSPACE SYNC] Config synced (debounced)', {
              workspaceId: currentWorkspace.id,
              stepId: event.stepId,
              newState: event.newState,
              delay: syncDebounceMs
            });
          }
        } catch (error) {
          console.error('❌ [WORKSPACE SYNC] Debounced sync failed:', error);
        }
      }, syncDebounceMs);
      return;
    }
    
    // Immediate sync for first call or after interval
    try {
      await workflowStateManager.syncToWorkspaceConfig(currentWorkspace.id);
      lastSyncTimestamp.current = now;
      
      if (enableLogging) {
        console.log('🔄 [WORKSPACE SYNC] Config synced (immediate)', {
          workspaceId: currentWorkspace.id,
          stepId: event.stepId,
          newState: event.newState
        });
      }
    } catch (error) {
      console.error('❌ [WORKSPACE SYNC] Immediate sync failed:', error);
    }
  }, [currentWorkspace?.id, minSyncInterval, syncDebounceMs, enableLogging, clearSyncTimer]);

  // Workspace restoration function
  const restoreFromWorkspace = useCallback(async (): Promise<boolean> => {
    if (!currentWorkspace?.config) {
      isInitialMount.current = false;
      return false;
    }
    
    try {
      const restored = await workflowStateManager.restoreFromWorkspaceConfig(currentWorkspace.config);
      
      if (restored && enableLogging) {
        console.log('✅ [WORKSPACE SYNC] State restored from workspace', {
          workspaceId: currentWorkspace.id,
          workspaceName: currentWorkspace.name
        });
      }
      
      isInitialMount.current = false;
      return restored;
    } catch (error) {
      console.error('❌ [WORKSPACE SYNC] Restoration failed:', error);
      isInitialMount.current = false;
      return false;
    }
  }, [currentWorkspace?.config, currentWorkspace?.id, currentWorkspace?.name, enableLogging]);

  // Import context update function
  const updateImportContext = useCallback(async (jsonFile: string | null): Promise<void> => {
    if (!jsonFile) return;
    
    try {
      await workflowStateManager.updateImportContext(jsonFile, 'json-import');
      
      if (enableLogging) {
        console.log('📥 [WORKSPACE SYNC] Import context updated', {
          importedJsonFile: jsonFile,
          workspaceId: currentWorkspace?.id
        });
      }
    } catch (error) {
      console.error('❌ [WORKSPACE SYNC] Import context update failed:', error);
    }
  }, [currentWorkspace?.id, enableLogging]);

  // Automatic restoration when workspace changes
  useEffect(() => {
    if (currentWorkspace?.id) {
      restoreFromWorkspace();
    } else {
      isInitialMount.current = false;
    }
  }, [currentWorkspace?.id, restoreFromWorkspace]);

  // Automatic import context update when importedJsonFile changes
  useEffect(() => {
    if (importedJsonFile) {
      updateImportContext(importedJsonFile);
    }
  }, [importedJsonFile, updateImportContext]);

  // Cleanup on unmount
  useEffect(() => {
    return clearSyncTimer;
  }, [clearSyncTimer]);

  return {
    syncToWorkspace,
    restoreFromWorkspace,
    updateImportContext,
    isInitialMount,
    clearSyncTimer
  };
}