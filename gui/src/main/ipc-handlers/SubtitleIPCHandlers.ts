import { ipcMain } from 'electron';
import Store from 'electron-store';

// ============================================================================
// SUBTITLE PERSISTENCE TYPES
// ============================================================================

interface Subtitle {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  text: string;
  translation?: string;
  speaker?: string;
  confidence?: number;
}

interface EditAction {
  type: 'update' | 'add' | 'delete' | 'split' | 'merge';
  subtitleId: string;
  data: any;
  timestamp: Date;
  description: string;
}

interface WorkspaceSubtitleData {
  workspaceId: string;
  videoPath: string;
  currentSubtitles: Subtitle[];
  originalSubtitles: Subtitle[];
  editHistory: {
    undoStack: EditAction[];
    redoStack: EditAction[];
  };
  metadata: {
    lastSaved: string;
    subtitleCount: number;
  };
}

// ============================================================================
// SUBTITLE IPC HANDLERS
// ============================================================================

export class SubtitleIPCHandlers {
  private subtitleStore: Store;

  constructor() {
    this.subtitleStore = new Store({
      name: 'subtitle-data',
      defaults: {}
    });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // ============================================================================
    // SUBTITLE WORKSPACE HANDLERS
    // ============================================================================

    // Load subtitle data for a workspace
    ipcMain.handle('subtitle:load-workspace', (_, workspaceId: string): WorkspaceSubtitleData | null => {
      try {
        const key = `subtitles.${workspaceId}`;
        const data = this.subtitleStore.get(key, null) as WorkspaceSubtitleData | null;
        
        if (data) {
          console.log(`✅ Loaded subtitle data for workspace ${workspaceId}: ${data.currentSubtitles.length} subtitles`);
        } else {
          console.log(`ℹ️ No subtitle data found for workspace ${workspaceId}`);
        }
        
        return data;
      } catch (error) {
        console.error(`❌ Failed to load subtitle data for workspace ${workspaceId}:`, error);
        return null;
      }
    });

    // Save subtitle data for a workspace
    ipcMain.handle('subtitle:save-workspace', (_, workspaceId: string, data: WorkspaceSubtitleData): void => {
      try {
        const key = `subtitles.${workspaceId}`;
        
        // Ensure metadata is up to date
        const saveData: WorkspaceSubtitleData = {
          ...data,
          metadata: {
            ...data.metadata,
            lastSaved: new Date().toISOString(),
            subtitleCount: data.currentSubtitles.length
          }
        };

        this.subtitleStore.set(key, saveData);
        
        console.log(`✅ Saved subtitle data for workspace ${workspaceId}: ${data.currentSubtitles.length} subtitles`);
      } catch (error) {
        console.error(`❌ Failed to save subtitle data for workspace ${workspaceId}:`, error);
        throw new Error(`Failed to save subtitle data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Clear subtitle data for a workspace
    ipcMain.handle('subtitle:clear-workspace', (_, workspaceId: string): void => {
      try {
        const key = `subtitles.${workspaceId}`;
        this.subtitleStore.delete(key);
        
        console.log(`✅ Cleared subtitle data for workspace ${workspaceId}`);
      } catch (error) {
        console.error(`❌ Failed to clear subtitle data for workspace ${workspaceId}:`, error);
        throw new Error(`Failed to clear subtitle data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // List all workspaces with subtitle data
    ipcMain.handle('subtitle:list-workspaces', (): string[] => {
      try {
        const store = this.subtitleStore.store;
        const workspaceIds: string[] = [];

        // Look for all keys that start with 'subtitles.'
        Object.keys(store).forEach(key => {
          if (key.startsWith('subtitles.')) {
            const workspaceId = key.replace('subtitles.', '');
            workspaceIds.push(workspaceId);
          }
        });

        console.log(`ℹ️ Found subtitle data for ${workspaceIds.length} workspaces`);
        return workspaceIds;
      } catch (error) {
        console.error('❌ Failed to list subtitle workspaces:', error);
        return [];
      }
    });

    // Get workspace subtitle metadata (without full data)
    ipcMain.handle('subtitle:get-workspace-metadata', (_, workspaceId: string) => {
      try {
        const key = `subtitles.${workspaceId}`;
        const data = this.subtitleStore.get(key, null) as WorkspaceSubtitleData | null;
        
        if (data) {
          return {
            workspaceId: data.workspaceId,
            videoPath: data.videoPath,
            subtitleCount: data.currentSubtitles.length,
            lastSaved: data.metadata.lastSaved,
            hasUnsavedChanges: data.editHistory.undoStack.length > 0
          };
        }
        
        return null;
      } catch (error) {
        console.error(`❌ Failed to get subtitle metadata for workspace ${workspaceId}:`, error);
        return null;
      }
    });

    // Bulk operations for cleanup and maintenance
    ipcMain.handle('subtitle:cleanup-orphaned-data', (): number => {
      try {
        let cleanedCount = 0;
        const store = this.subtitleStore.store;
        
        // This would typically check against existing workspaces
        // For now, we'll just report what we have
        Object.keys(store).forEach(key => {
          if (key.startsWith('subtitles.')) {
            const data = store[key] as WorkspaceSubtitleData;
            
            // Example cleanup logic: remove data older than 30 days with no subtitles
            const lastSaved = new Date(data.metadata.lastSaved);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            if (data.currentSubtitles.length === 0 && lastSaved < thirtyDaysAgo) {
              this.subtitleStore.delete(key);
              cleanedCount++;
            }
          }
        });

        console.log(`✅ Cleaned up ${cleanedCount} orphaned subtitle data entries`);
        return cleanedCount;
      } catch (error) {
        console.error('❌ Failed to cleanup orphaned subtitle data:', error);
        return 0;
      }
    });

    // Export subtitle data for backup
    ipcMain.handle('subtitle:export-workspace-data', (_, workspaceId: string) => {
      try {
        const key = `subtitles.${workspaceId}`;
        const data = this.subtitleStore.get(key, null) as WorkspaceSubtitleData | null;
        
        if (data) {
          // Return serialized data for export
          return {
            success: true,
            data: JSON.stringify(data, null, 2)
          };
        }
        
        return {
          success: false,
          error: 'No subtitle data found for workspace'
        };
      } catch (error) {
        console.error(`❌ Failed to export subtitle data for workspace ${workspaceId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Import subtitle data from backup
    ipcMain.handle('subtitle:import-workspace-data', (_, workspaceId: string, jsonData: string) => {
      try {
        const data = JSON.parse(jsonData) as WorkspaceSubtitleData;
        
        // Validate the data structure
        if (!data.workspaceId || !data.currentSubtitles || !Array.isArray(data.currentSubtitles)) {
          throw new Error('Invalid subtitle data structure');
        }
        
        // Update workspace ID to match target
        data.workspaceId = workspaceId;
        data.metadata.lastSaved = new Date().toISOString();
        
        const key = `subtitles.${workspaceId}`;
        this.subtitleStore.set(key, data);
        
        console.log(`✅ Imported subtitle data for workspace ${workspaceId}: ${data.currentSubtitles.length} subtitles`);
        return {
          success: true,
          subtitleCount: data.currentSubtitles.length
        };
      } catch (error) {
        console.error(`❌ Failed to import subtitle data for workspace ${workspaceId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid JSON data'
        };
      }
    });

    console.log('✅ Subtitle IPC handlers initialized');
  }

  // Cleanup method to remove all handlers
  public cleanup(): void {
    ipcMain.removeAllListeners('subtitle:load-workspace');
    ipcMain.removeAllListeners('subtitle:save-workspace');
    ipcMain.removeAllListeners('subtitle:clear-workspace');
    ipcMain.removeAllListeners('subtitle:list-workspaces');
    ipcMain.removeAllListeners('subtitle:get-workspace-metadata');
    ipcMain.removeAllListeners('subtitle:cleanup-orphaned-data');
    ipcMain.removeAllListeners('subtitle:export-workspace-data');
    ipcMain.removeAllListeners('subtitle:import-workspace-data');
    
    console.log('✅ Subtitle IPC handlers cleaned up');
  }

  // Get store statistics for debugging
  public getStoreStats(): object {
    try {
      const store = this.subtitleStore.store;
      const stats = {
        totalKeys: Object.keys(store).length,
        subtitleWorkspaces: 0,
        totalSubtitles: 0,
        storeSize: JSON.stringify(store).length
      };

      Object.keys(store).forEach(key => {
        if (key.startsWith('subtitles.')) {
          stats.subtitleWorkspaces++;
          const data = store[key] as WorkspaceSubtitleData;
          stats.totalSubtitles += data.currentSubtitles.length;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get store stats:', error);
      return { error: 'Failed to get statistics' };
    }
  }
}