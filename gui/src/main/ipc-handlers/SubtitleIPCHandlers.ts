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

// Import shared EditAction type from renderer types
interface EditAction {
  type: 'update' | 'add' | 'delete' | 'split' | 'merge';
  subtitleId: string;
  data: Record<string, unknown>;
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
    // SUBTITLE WORKSPACE HANDLERS - Updated to match frontend API
    // ============================================================================

    // Load subtitle data for a workspace (updated API name)
    ipcMain.handle('subtitle:workspace-load', (_, workspaceId: string): WorkspaceSubtitleData | null => {
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

    // Save subtitle data for a workspace (updated API name)
    ipcMain.handle('subtitle:workspace-save', (_, workspaceId: string, data: WorkspaceSubtitleData): { success: boolean; error?: string } => {
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
        return { success: true };
      } catch (error) {
        console.error(`❌ Failed to save subtitle data for workspace ${workspaceId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    // Check if workspace exists (new API)
    ipcMain.handle('subtitle:workspace-exists', (_, workspaceId: string): boolean => {
      try {
        const key = `subtitles.${workspaceId}`;
        const exists = this.subtitleStore.has(key);
        console.log(`ℹ️ Workspace ${workspaceId} exists: ${exists}`);
        return exists;
      } catch (error) {
        console.error(`❌ Failed to check workspace existence ${workspaceId}:`, error);
        return false;
      }
    });

    // Delete workspace (new API)
    ipcMain.handle('subtitle:workspace-delete', (_, workspaceId: string): { success: boolean } => {
      try {
        const key = `subtitles.${workspaceId}`;
        if (this.subtitleStore.has(key)) {
          this.subtitleStore.delete(key);
        }
        console.log(`✅ Deleted workspace ${workspaceId}`);
        return { success: true };
      } catch (error) {
        console.error(`❌ Failed to delete workspace ${workspaceId}:`, error);
        return { success: false };
      }
    });

    // ============================================================================
    // IMPORT OPERATIONS - JSON only support
    // ============================================================================

    // Import JSON subtitle data - simplified to JSON only
    ipcMain.handle('subtitle:import-json', async (_, filePath: string): Promise<{ success: boolean; subtitles?: unknown[]; error?: string }> => {
      try {
        const { readFile } = await import('fs/promises');
        const content = await readFile(filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        // Validate JSON structure - support both flat array and CantoCap format
        let subtitlesToProcess: unknown[];
        
        if (Array.isArray(jsonData)) {
          // Direct array format
          subtitlesToProcess = jsonData;
        } else if (jsonData && typeof jsonData === 'object' && 'subtitles' in jsonData && Array.isArray(jsonData.subtitles)) {
          // CantoCap format with nested structure
          subtitlesToProcess = jsonData.subtitles;
        } else {
          return { success: false, error: 'Invalid JSON format: Expected array of subtitle objects or CantoCap format with subtitles array' };
        }

        // Enhanced validation of subtitle structure with type guard
        for (const [index, subtitle] of subtitlesToProcess.entries()) {
          // Type guard: Ensure subtitle is an object with expected properties
          if (!subtitle || typeof subtitle !== 'object') {
            return { 
              success: false, 
              error: `Invalid subtitle at index ${index}: Expected object, got ${typeof subtitle}` 
            };
          }

          const subtitleObj = subtitle as Record<string, unknown>;
          
          // Support both formats: generic (start/end/text) and CantoCap (startTime/endTime/caption)
          const startTime = subtitleObj.start ?? subtitleObj.startTime;
          const endTime = subtitleObj.end ?? subtitleObj.endTime;
          const text = subtitleObj.text ?? subtitleObj.caption;
          
          // Check required fields
          if (typeof startTime === 'undefined' || typeof endTime === 'undefined' || typeof text === 'undefined') {
            return { 
              success: false, 
              error: `Invalid subtitle at index ${index}: Missing required fields (start/startTime, end/endTime, text/caption)` 
            };
          }
          
          // Validate field types
          if (typeof startTime !== 'number' || typeof endTime !== 'number') {
            return { 
              success: false, 
              error: `Invalid subtitle at index ${index}: Time fields must be numbers (seconds)` 
            };
          }
          
          if (typeof text !== 'string' || text.trim() === '') {
            return { 
              success: false, 
              error: `Invalid subtitle at index ${index}: Text field must be a non-empty string` 
            };
          }
          
          // Validate time logic
          if (startTime >= endTime) {
            return { 
              success: false, 
              error: `Invalid subtitle at index ${index}: Start time (${startTime}s) must be less than end time (${endTime}s)` 
            };
          }
          
          if (startTime < 0 || endTime < 0) {
            return { 
              success: false, 
              error: `Invalid subtitle at index ${index}: Times must be positive numbers` 
            };
          }
        }

        console.log(`✅ Successfully imported and validated JSON with ${subtitlesToProcess.length} subtitles from ${filePath}`);
        return { success: true, subtitles: subtitlesToProcess };
      } catch (error) {
        console.error('Failed to import JSON:', error);
        
        if (error instanceof SyntaxError) {
          return { success: false, error: 'Invalid JSON file: Please check the file format and syntax' };
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Import failed: ${errorMessage}` };
      }
    });

    // Validate subtitle format
    ipcMain.handle('subtitle:validate-format', (_, data: unknown): { isValid: boolean; errors?: string[] } => {
      try {
        const errors: string[] = [];
        
        if (!Array.isArray(data)) {
          errors.push('Data must be an array of subtitle objects');
          return { isValid: false, errors };
        }
        
        for (const [index, subtitle] of data.entries()) {
          if (typeof subtitle.start !== 'number') {
            errors.push(`Subtitle ${index}: 'start' must be a number`);
          }
          if (typeof subtitle.end !== 'number') {
            errors.push(`Subtitle ${index}: 'end' must be a number`);
          }
          if (typeof subtitle.text !== 'string') {
            errors.push(`Subtitle ${index}: 'text' must be a string`);
          }
          if (subtitle.start >= subtitle.end) {
            errors.push(`Subtitle ${index}: 'start' time must be less than 'end' time`);
          }
        }
        
        return { isValid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
      } catch (error) {
        console.error('Failed to validate format:', error);
        return { isValid: false, errors: ['Validation failed due to internal error'] };
      }
    });

    // ============================================================================
    // STEP INTEGRATION - New API handlers
    // ============================================================================

    // Sync subtitles to step workflow
    ipcMain.handle('subtitle:sync-to-step', (_, workspaceId: string, subtitles: unknown[]): { success: boolean } => {
      try {
        // For now, we'll store this in the same store with a different key
        const stepKey = `step-data.${workspaceId}`;
        const stepData = {
          workspaceId,
          subtitles,
          timestamp: new Date().toISOString()
        };

        this.subtitleStore.set(stepKey, stepData);
        console.log(`✅ Synced ${subtitles.length} subtitles to step for workspace ${workspaceId}`);
        return { success: true };
      } catch (error) {
        console.error('Failed to sync to step:', error);
        return { success: false };
      }
    });

    // Sync subtitles from step workflow
    ipcMain.handle('subtitle:sync-from-step', (_, workspaceId: string): { subtitles?: unknown[] } => {
      try {
        const stepKey = `step-data.${workspaceId}`;
        const stepData = this.subtitleStore.get(stepKey, null) as { subtitles?: unknown[] } | null;
        
        if (stepData && stepData.subtitles) {
          console.log(`✅ Retrieved ${stepData.subtitles.length} subtitles from step for workspace ${workspaceId}`);
          return { subtitles: stepData.subtitles };
        }
        
        console.log(`ℹ️ No step data found for workspace ${workspaceId}`);
        return {};
      } catch (error) {
        console.error('Failed to sync from step:', error);
        return {};
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
    // Remove new API handlers
    ipcMain.removeAllListeners('subtitle:workspace-load');
    ipcMain.removeAllListeners('subtitle:workspace-save');
    ipcMain.removeAllListeners('subtitle:workspace-exists');
    ipcMain.removeAllListeners('subtitle:workspace-delete');
    ipcMain.removeAllListeners('subtitle:import-json');
    ipcMain.removeAllListeners('subtitle:validate-format');
    ipcMain.removeAllListeners('subtitle:sync-to-step');
    ipcMain.removeAllListeners('subtitle:sync-from-step');
    
    // Remove legacy handlers
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