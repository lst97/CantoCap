import Store from 'electron-store';

export interface AppStateSchema {
  activeWorkspaceId: string | null;
  recentWorkspaces: string[];
  windowState: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    maximized: boolean;
  };
}

export class AppStateService {
  private store: Store<AppStateSchema>;
  
  constructor() {
    this.store = new Store<AppStateSchema>({
      name: 'app-state',
      defaults: {
        activeWorkspaceId: null,
        recentWorkspaces: [],
        windowState: {
          width: 1200,
          height: 800,
          maximized: false
        }
      }
    });
  }
  
  getState(): AppStateSchema {
    const activeWorkspaceId = this.store.get('activeWorkspaceId', null);
    const recentWorkspaces = this.store.get('recentWorkspaces', []);
    const windowState = this.store.get('windowState', {
      width: 1200,
      height: 800,
      maximized: false
    });
    
    const state = {
      activeWorkspaceId: activeWorkspaceId === undefined ? null : activeWorkspaceId,
      recentWorkspaces: Array.isArray(recentWorkspaces) ? recentWorkspaces : [],
      windowState: windowState
    };
    
    // Defensive check to ensure we never return undefined activeWorkspaceId
    if (state.activeWorkspaceId === undefined) {
      console.warn('⚠️ AppStateService: Preventing undefined activeWorkspaceId from being returned');
      state.activeWorkspaceId = null;
    }
    
    return state;
  }
  
  setActiveWorkspace(workspaceId: string | null): void {
    if (!workspaceId) {
      this.store.set('activeWorkspaceId', null);
      return;
    }
    
    this.store.set('activeWorkspaceId', workspaceId);
    this.addRecentWorkspace(workspaceId);
  }
  
  addRecentWorkspace(workspaceId: string): void {
    const recent = this.store.get('recentWorkspaces', []);
    const updated = [workspaceId, ...recent.filter(id => id !== workspaceId)].slice(0, 10);
    this.store.set('recentWorkspaces', updated);
  }
  
  updateWindowState(state: Partial<AppStateSchema['windowState']>): void {
    this.store.set('windowState', { ...this.store.get('windowState'), ...state });
  }
  
  getWindowState(): AppStateSchema['windowState'] {
    return this.store.get('windowState');
  }
  
  clearRecentWorkspaces(): void {
    this.store.set('recentWorkspaces', []);
  }
  
  removeFromRecent(workspaceId: string): void {
    const recent = this.store.get('recentWorkspaces', []);
    this.store.set('recentWorkspaces', recent.filter(id => id !== workspaceId));
  }
  
  reset(): void {
    this.store.clear();
  }
  
  validateAndCleanState(workspaceExistsCallback: (id: string) => boolean): void {
    const state = this.getState();
    let hasChanges = false;
    
    // Validate active workspace
    if (state.activeWorkspaceId && !workspaceExistsCallback(state.activeWorkspaceId)) {
      console.warn('Clearing invalid active workspace:', state.activeWorkspaceId);
      this.store.set('activeWorkspaceId', null);
      hasChanges = true;
    }
    
    // Clean up recent workspaces
    const validRecentWorkspaces = state.recentWorkspaces.filter(id => {
      const exists = workspaceExistsCallback(id);
      if (!exists) {
        console.warn('Removing invalid recent workspace:', id);
      }
      return exists;
    });
    
    if (validRecentWorkspaces.length !== state.recentWorkspaces.length) {
      this.store.set('recentWorkspaces', validRecentWorkspaces);
      hasChanges = true;
    }
    
    if (hasChanges) {
      console.log('App state cleaned up - removed invalid workspace references');
    }
  }
}