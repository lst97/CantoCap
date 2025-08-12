import { create } from 'zustand';
import { AppState, WindowState, AppStateUpdateEvent } from './types/StoreTypes';

// ============================================================================
// APP STORE - GLOBAL APPLICATION STATE
// ============================================================================

export const useAppStore = create<AppState>((set, get) => ({
  // State
  activeWorkspaceId: null,
  recentWorkspaces: [],
  windowState: {
    width: 1200,
    height: 800,
    maximized: false
  },
  isLoading: false,
  ui: {
    showAdvanced: false
  },
  appVersion: '0.1.0.alpha',
  dependencies: {
    python: {
      status: 'checking',
      available: false
    },
    ffmpeg: {
      status: 'checking', 
      available: false
    }
  },
  hardware: {
    checking: false
  },
  
  // Actions
  actions: {
    setActiveWorkspace: async (id: string) => {
      try {
        set({ isLoading: true });
        await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', id);
        // State will be updated via IPC event listener
      } catch (error) {
        console.error('Failed to set active workspace:', error);
      } finally {
        set({ isLoading: false });
      }
    },
    
    addRecentWorkspace: (id: string) => {
      const current = get().recentWorkspaces;
      const updated = [id, ...current.filter(wsId => wsId !== id)].slice(0, 10);
      set({ recentWorkspaces: updated });
    },
    
    loadAppState: async () => {
      try {
        set({ isLoading: true });
        const state = await window.electron.ipcRenderer.invoke('app:getState');
        set({
          activeWorkspaceId: state.activeWorkspaceId,
          recentWorkspaces: state.recentWorkspaces,
          windowState: state.windowState,
          isLoading: false
        });
      } catch (error) {
        console.error('Failed to load app state:', error);
        set({ isLoading: false });
      }
    },
    
    updateWindowState: async (windowState: Partial<WindowState>) => {
      try {
        // Update local state immediately for responsiveness
        set(state => ({ 
          windowState: { ...state.windowState, ...windowState } 
        }));
        
        // Persist to main process
        await window.electron.ipcRenderer.invoke('app:updateWindowState', windowState);
      } catch (error) {
        console.error('Failed to update window state:', error);
      }
    },
    
    clearRecentWorkspaces: async () => {
      try {
        await window.electron.ipcRenderer.invoke('app:clearRecentWorkspaces');
        // State will be updated via IPC event
      } catch (error) {
        console.error('Failed to clear recent workspaces:', error);
      }
    },
    
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },
    
    toggleAdvanced: () => {
      set(state => ({
        ui: {
          ...state.ui,
          showAdvanced: !state.ui.showAdvanced
        }
      }));
    },

    checkDependencies: async () => {
      // Placeholder implementation - this would typically call IPC to check system dependencies
      console.log('Checking dependencies...');
      // For now, just update to available after a brief delay
      setTimeout(() => {
        set(() => ({
          dependencies: {
            python: { status: 'available', available: true, version: 'Python 3.12.0' },
            ffmpeg: { status: 'available', available: true, version: 'FFmpeg 6.0' }
          }
        }));
      }, 1000);
    },

    checkHardware: async () => {
      // Placeholder implementation
      console.log('Checking hardware...');
      set(state => ({
        hardware: {
          ...state.hardware,
          checking: true
        }
      }));
    },

    showNotification: (message: string, type: string = 'info') => {
      // Placeholder implementation
      console.log(`Notification [${type}]:`, message);
    },

    setActiveModal: (modal: string | null) => {
      // Placeholder implementation
      console.log('Setting active modal:', modal);
    }
  }
}));

// ============================================================================
// IPC EVENT LISTENERS FOR REAL-TIME SYNC
// ============================================================================

// Initialize IPC listeners with defensive state updates
if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
  // App state updates from main process - defensive update
  window.electron.ipcRenderer.on('app:stateUpdated', (state: AppStateUpdateEvent) => {
    useAppStore.setState((currentState) => {
      // Only update if state actually changed
      const hasActiveWorkspaceChanged = currentState.activeWorkspaceId !== state.activeWorkspaceId;
      const hasRecentWorkspacesChanged = JSON.stringify(currentState.recentWorkspaces) !== JSON.stringify(state.recentWorkspaces);
      const hasWindowStateChanged = JSON.stringify(currentState.windowState) !== JSON.stringify(state.windowState);
      
      if (!hasActiveWorkspaceChanged && !hasRecentWorkspacesChanged && !hasWindowStateChanged) {
        return currentState; // No change needed
      }
      
      return {
        ...currentState,
        activeWorkspaceId: state.activeWorkspaceId,
        recentWorkspaces: state.recentWorkspaces,
        windowState: state.windowState
      };
    });
  });
  
  // Window state updates from main process - defensive update
  window.electron.ipcRenderer.on('app:windowStateUpdated', (windowState: WindowState) => {
    useAppStore.setState(currentState => {
      // Only update if window state actually changed
      const hasWindowStateChanged = JSON.stringify(currentState.windowState) !== JSON.stringify({ ...currentState.windowState, ...windowState });
      
      if (!hasWindowStateChanged) {
        return currentState; // No change needed
      }
      
      return {
        ...currentState,
        windowState: { ...currentState.windowState, ...windowState }
      };
    });
  });
}

// ============================================================================
// HELPER HOOKS AND SELECTORS
// ============================================================================

// Hook to get only the active workspace ID
export const useActiveWorkspaceId = () => useAppStore(state => state.activeWorkspaceId);

// Hook to get only recent workspaces
export const useRecentWorkspaces = () => useAppStore(state => state.recentWorkspaces);

// Hook to get only window state
export const useWindowState = () => useAppStore(state => state.windowState);

// Hook to get only app actions
export const useAppActions = () => useAppStore(state => state.actions);

// Hook to check if app is loading
export const useAppLoading = () => useAppStore(state => state.isLoading);

// Selector to check if a specific workspace is active
export const useIsWorkspaceActive = (workspaceId: string) => 
  useAppStore(state => state.activeWorkspaceId === workspaceId);

// Selector to check if workspace is in recent list
export const useIsWorkspaceRecent = (workspaceId: string) =>
  useAppStore(state => state.recentWorkspaces.includes(workspaceId));