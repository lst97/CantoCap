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
    return this.store.store;
  }
  
  setActiveWorkspace(workspaceId: string): void {
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
}