import { create } from 'zustand';
import { AppState, WindowState, AppStateUpdateEvent, ElectronWindow } from './types/StoreTypes';
import { createStoreLogger } from '../utils/logger';
// ============================================================================
// APP STORE - GLOBAL APPLICATION STATE
// ============================================================================

const logger = createStoreLogger('AppStore');

export const useAppStore = create<AppState>((set, get) => ({
  // State
  activeWorkspaceId: null,
  recentWorkspaces: [],
  windowState: {
    width: 1200,
    height: 800,
    maximized: false,
  },
  isLoading: false,
  ui: {
    showAdvanced: false,
  },
  appVersion: '0.1.0.alpha',
  dependencies: {
    python: {
      status: 'checking',
      available: false,
    },
    ffmpeg: {
      status: 'checking',
      available: false,
    },
  },
  hardware: {
    checking: false,
  },

  // Actions
  actions: {
    setActiveWorkspace: async (id: string) => {
      try {
        set({ isLoading: true });
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
          'app:setActiveWorkspace',
          id
        );
        // State will be updated via IPC event listener
      } catch (error) {
        logger.error('Failed to set active workspace', { workspaceId: id, error });
      } finally {
        set({ isLoading: false });
      }
    },

    addRecentWorkspace: (id: string) => {
      const current = get().recentWorkspaces;
      const updated = [id, ...current.filter((wsId) => wsId !== id)].slice(0, 10);
      set({ recentWorkspaces: updated });
      logger.debug('Recent workspace added', { workspaceId: id, recentCount: updated.length });
    },

    loadAppState: async () => {
      try {
        set({ isLoading: true });

        const rawState = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
          'app:getState'
        );

        if (!rawState) {
          throw new Error('No state received from main process');
        }

        // Type the state object properly
        const state = rawState as Partial<AppStateUpdateEvent>;

        // Validate the state structure
        const validatedState = {
          activeWorkspaceId: state.activeWorkspaceId || null,
          recentWorkspaces: Array.isArray(state.recentWorkspaces) ? state.recentWorkspaces : [],
          windowState: state.windowState || { width: 1200, height: 800, maximized: false },
        };

        set({
          activeWorkspaceId: validatedState.activeWorkspaceId,
          recentWorkspaces: validatedState.recentWorkspaces,
          windowState: validatedState.windowState,
          isLoading: false,
        });

        // Return the loaded state for external use (like workspace restoration)
        return validatedState;
      } catch (error) {
        logger.error('Failed to load app state', { error });
        set({ isLoading: false });
        throw error; // Re-throw to allow calling code to handle the error
      }
    },

    updateWindowState: async (windowState: Partial<WindowState>) => {
      try {
        // Update local state immediately for responsiveness
        set((state) => ({
          windowState: { ...state.windowState, ...windowState },
        }));

        // Persist to main process
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
          'app:updateWindowState',
          windowState
        );
      } catch (error) {
        logger.error('Failed to update window state', { windowState, error });
      }
    },

    clearRecentWorkspaces: async () => {
      try {
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
          'app:clearRecentWorkspaces'
        );
        // State will be updated via IPC event
      } catch (error) {
        logger.error('Failed to clear recent workspaces', { error });
      }
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    toggleAdvanced: () => {
      const currentState = get();
      const newState = !currentState.ui.showAdvanced;
      set((state) => ({
        ui: {
          ...state.ui,
          showAdvanced: newState,
        },
      }));
      logger.debug('Advanced settings toggled', { showAdvanced: newState });
    },

    checkDependencies: async () => {
      logger.debug('Checking system dependencies');
      // TODO: Replace with real IPC call to check system dependencies
      setTimeout(() => {
        set(() => ({
          dependencies: {
            python: { status: 'available', available: true, version: 'Python 3.12.0' },
            ffmpeg: { status: 'available', available: true, version: 'FFmpeg 6.0' },
          },
        }));
        logger.info('Dependencies check completed', {
          python: 'available',
          ffmpeg: 'available'
        });
      }, 1000);
    },

    checkHardware: async () => {
      logger.debug('Starting hardware check');
      set((state) => ({
        hardware: {
          ...state.hardware,
          checking: true,
        },
      }));
      // TODO: Add actual hardware checking logic
    },

    showNotification: (message: string, type: string = 'info') => {
      // TODO: Replace with actual notification system
      logger.info('Notification requested', { message, type });
    },

    setActiveModal: (modal: string | null) => {
      // TODO: Implement modal state management
      logger.debug('Modal state change requested', { modal });
    },
  },
}));

// ============================================================================
// IPC EVENT LISTENERS FOR REAL-TIME SYNC
// ============================================================================

// Initialize IPC listeners with defensive state updates
if (typeof window !== 'undefined' && (window as unknown as ElectronWindow).electron?.ipcRenderer) {
  logger.debug('Initializing IPC event listeners');
  // App state updates from main process - defensive update with validation
  (window as unknown as ElectronWindow).electron.ipcRenderer.on(
    'app:stateUpdated',
    (_event: unknown, ...args: unknown[]) => {
      const state = args[0] as AppStateUpdateEvent;
      useAppStore.setState((currentState) => {
        // DEFENSIVE: If the main process sends undefined activeWorkspaceId, REJECT the update entirely
        // and preserve the current renderer state (this is expected behavior during certain state transitions)
        if (state.activeWorkspaceId === undefined) {
          logger.warn('Rejecting state update with undefined activeWorkspaceId', {
            reason: 'expected during transitions'
          });

          // Only update non-activeWorkspaceId fields if they are valid
          const safeUpdate = {
            ...currentState,
            recentWorkspaces: Array.isArray(state.recentWorkspaces)
              ? state.recentWorkspaces
              : currentState.recentWorkspaces,
            windowState: state.windowState || currentState.windowState,
          };

          return safeUpdate;
        }

        // Normal path - validate incoming state and normalize values
        const normalizedActiveWorkspaceId =
          state.activeWorkspaceId === null ? null : state.activeWorkspaceId;
        const normalizedRecentWorkspaces = Array.isArray(state.recentWorkspaces)
          ? state.recentWorkspaces
          : currentState.recentWorkspaces;
        const normalizedWindowState = state.windowState || currentState.windowState;

        // Check if any changes are needed
        const hasActiveWorkspaceChanged =
          currentState.activeWorkspaceId !== normalizedActiveWorkspaceId;
        const hasRecentWorkspacesChanged =
          JSON.stringify(currentState.recentWorkspaces) !==
          JSON.stringify(normalizedRecentWorkspaces);
        const hasWindowStateChanged =
          JSON.stringify(currentState.windowState) !== JSON.stringify(normalizedWindowState);

        if (!hasActiveWorkspaceChanged && !hasRecentWorkspacesChanged && !hasWindowStateChanged) {
          return currentState; // No change needed
        }

        // Log significant state changes
        if (hasActiveWorkspaceChanged) {
          logger.info('Active workspace changed via IPC', {
            from: currentState.activeWorkspaceId,
            to: normalizedActiveWorkspaceId
          });
        }

        return {
          ...currentState,
          activeWorkspaceId: normalizedActiveWorkspaceId,
          recentWorkspaces: normalizedRecentWorkspaces,
          windowState: normalizedWindowState,
        };
      });
    }
  );

  // Window state updates from main process - defensive update
  (window as unknown as ElectronWindow).electron.ipcRenderer.on(
    'app:windowStateUpdated',
    (_event: unknown, ...args: unknown[]) => {
      const windowState = args[0] as WindowState;
      useAppStore.setState((currentState) => {
        // Only update if window state actually changed
        const hasWindowStateChanged =
          JSON.stringify(currentState.windowState) !==
          JSON.stringify({ ...currentState.windowState, ...windowState });

        if (!hasWindowStateChanged) {
          return currentState; // No change needed
        }

        logger.debug('Window state updated via IPC', { windowState });

        return {
          ...currentState,
          windowState: { ...currentState.windowState, ...windowState },
        };
      });
    }
  );
}

// ============================================================================
// HELPER HOOKS AND SELECTORS
// ============================================================================

// Hook to get only the active workspace ID
export const useActiveWorkspaceId = () => useAppStore((state) => state.activeWorkspaceId);

// Hook to get only recent workspaces
export const useRecentWorkspaces = () => useAppStore((state) => state.recentWorkspaces);

// Hook to get only window state
export const useWindowState = () => useAppStore((state) => state.windowState);

// Hook to get only app actions
export const useAppActions = () => useAppStore((state) => state.actions);

// Hook to check if app is loading
export const useAppLoading = () => useAppStore((state) => state.isLoading);

// Selector to check if a specific workspace is active
export const useIsWorkspaceActive = (workspaceId: string) =>
  useAppStore((state) => state.activeWorkspaceId === workspaceId);

// Selector to check if workspace is in recent list
export const useIsWorkspaceRecent = (workspaceId: string) =>
  useAppStore((state) => state.recentWorkspaces.includes(workspaceId));
