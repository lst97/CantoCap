import { ipcMain, WebContents } from 'electron';
import { AppStateService, AppStateSchema } from '../config/AppStateService';
import { WorkspaceConfigService, WorkspaceSchema } from '../config/WorkspaceConfigService';

// Type definitions for IPC handlers
type WindowState = AppStateSchema['windowState'];
type WorkspaceUpdate = Partial<Omit<WorkspaceSchema, 'id'>>;
type StepContent = unknown; // Generic step content type
type BroadcastData = unknown; // Generic broadcast data type
type DefaultStepContent = Record<string, unknown>;

export class IPCConfigHandlers {
  constructor(
    private appStateService: AppStateService,
    private workspaceService: WorkspaceConfigService,
    private webContents: WebContents
  ) {
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // ============================================================================
    // APP STATE HANDLERS
    // ============================================================================
    
    ipcMain.handle('app:getState', () => {
      return this.appStateService.getState();
    });
    
    ipcMain.handle('app:setActiveWorkspace', (_, workspaceId: string) => {
      this.appStateService.setActiveWorkspace(workspaceId);
      this.broadcast('app:stateUpdated', this.appStateService.getState());
      return true;
    });
    
    ipcMain.handle('app:updateWindowState', (_, windowState: Partial<WindowState>) => {
      this.appStateService.updateWindowState(windowState);
      this.broadcast('app:windowStateUpdated', this.appStateService.getWindowState());
      return true;
    });
    
    ipcMain.handle('app:clearRecentWorkspaces', () => {
      this.appStateService.clearRecentWorkspaces();
      this.broadcast('app:stateUpdated', this.appStateService.getState());
      return true;
    });
    
    // ============================================================================
    // WORKSPACE HANDLERS
    // ============================================================================
    
    ipcMain.handle('workspace:create', (_, name: string) => {
      const { id, workspace } = this.workspaceService.createWorkspace(name);
      this.broadcast('workspace:created', { id, workspace });
      
      // Also update app state to set new workspace as active
      this.appStateService.setActiveWorkspace(id);
      this.broadcast('app:stateUpdated', this.appStateService.getState());
      
      return { id, workspace };
    });
    
    ipcMain.handle('workspace:delete', (_, id: string) => {
      const success = this.workspaceService.deleteWorkspace(id);
      if (success) {
        this.broadcast('workspace:deleted', { id });
        
        // Remove from app state recent workspaces
        this.appStateService.removeFromRecent(id);
        
        // If this was the active workspace, clear it
        const currentState = this.appStateService.getState();
        if (currentState.activeWorkspaceId === id) {
          this.appStateService.setActiveWorkspace('');
        }
        
        this.broadcast('app:stateUpdated', this.appStateService.getState());
      }
      return success;
    });
    
    ipcMain.handle('workspace:list', () => {
      return this.workspaceService.listWorkspaces();
    });
    
    ipcMain.handle('workspace:get', (_, id: string) => {
      return this.workspaceService.getWorkspace(id);
    });
    
    ipcMain.handle('workspace:update', (_, id: string, updates: WorkspaceUpdate) => {
      this.workspaceService.updateWorkspace(id, updates);
      const updatedWorkspace = this.workspaceService.getWorkspace(id);
      this.broadcast('workspace:updated', { id, workspace: updatedWorkspace });
      return updatedWorkspace;
    });
    
    ipcMain.handle('workspace:rename', (_, id: string, newName: string) => {
      const success = this.workspaceService.renameWorkspace(id, newName);
      if (success) {
        const updatedWorkspace = this.workspaceService.getWorkspace(id);
        this.broadcast('workspace:updated', { id, workspace: updatedWorkspace });
      }
      return success;
    });
    
    ipcMain.handle('workspace:duplicate', (_, id: string, newName: string) => {
      const result = this.workspaceService.duplicateWorkspace(id, newName);
      if (result) {
        this.broadcast('workspace:created', { id: result.id, workspace: result.workspace });
      }
      return result;
    });
    
    ipcMain.handle('workspace:exists', (_, id: string) => {
      return this.workspaceService.workspaceExists(id);
    });
    
    // ============================================================================
    // STEP CONTENT HANDLERS
    // ============================================================================
    
    ipcMain.handle('step:updateContent', (_, workspaceId: string, stepName: string, content: StepContent) => {
      this.workspaceService.updateStepContent(workspaceId, stepName, content);
      const stepContent = this.workspaceService.getStepContent(workspaceId, stepName);
      this.broadcast('step:contentUpdated', { 
        workspaceId, 
        stepName, 
        content: stepContent 
      });
      return stepContent;
    });
    
    ipcMain.handle('step:getContent', (_, workspaceId: string, stepName: string) => {
      return this.workspaceService.getStepContent(workspaceId, stepName);
    });
    
    ipcMain.handle('step:resetContent', (_, workspaceId: string, stepName: string) => {
      // Get default content based on step
      const defaultContent = this.getDefaultStepContent(stepName);
      this.workspaceService.updateStepContent(workspaceId, stepName, defaultContent);
      this.broadcast('step:contentUpdated', { 
        workspaceId, 
        stepName, 
        content: defaultContent 
      });
      return defaultContent;
    });
    
    // ============================================================================
    // WORKFLOW HANDLERS
    // ============================================================================
    
    ipcMain.handle('workflow:setCurrentStep', (_, workspaceId: string, step: string) => {
      // This could be stored in workspace data if needed for persistence
      this.broadcast('workflow:stepChanged', { workspaceId, currentStep: step });
      return true;
    });
    
    ipcMain.handle('workflow:setStepState', (_, workspaceId: string, step: string, state: string) => {
      // This could be stored in workspace data if needed for persistence  
      this.broadcast('workflow:stepStateChanged', { workspaceId, step, state });
      return true;
    });
    
    // ============================================================================
    // LEGACY SUPPORT (to be removed gradually)
    // ============================================================================
    
    // Keep some legacy handlers temporarily for smooth transition
    ipcMain.handle('config:get', () => {
      // Return empty config or redirect to new system
      return {};
    });
    
    ipcMain.handle('config:set', () => {
      // Deprecated - log warning
      console.warn('Legacy config:set handler called - should use new workspace system');
      return true;
    });
  }
  
  private broadcast(channel: string, data: BroadcastData): void {
    // Send to the main window's webContents
    if (this.webContents && !this.webContents.isDestroyed()) {
      this.webContents.send(channel, data);
    }
  }
  
  private getDefaultStepContent(stepName: string): DefaultStepContent {
    const defaults: Record<string, DefaultStepContent> = {
      input: {
        selectedFiles: [],
        fileValidation: {},
        dragDropState: false
      },
      config: {
        modelSettings: {
          whisperModel: 'medium',
          enableGemini: false,
          temperature: 0.1
        },
        apiKeys: {},
        advancedSettings: {
          chunkDuration: 30,
          numWorkers: 4,
          enableSpeakerDiarization: false,
          enableMusicDetection: false
        }
      },
      processing: {
        status: 'idle',
        progress: 0,
        logs: []
      },
      review: {
        subtitles: [],
        playbackPosition: 0
      },
      export: {
        format: 'srt',
        exportSettings: {
          includeTimecodes: true,
          charset: 'utf-8',
          translation: false
        },
        exportHistory: []
      }
    };
    
    return defaults[stepName] || {};
  }
  
  // Cleanup method to remove all handlers
  public cleanup(): void {
    ipcMain.removeAllListeners('app:getState');
    ipcMain.removeAllListeners('app:setActiveWorkspace');
    ipcMain.removeAllListeners('app:updateWindowState');
    ipcMain.removeAllListeners('app:clearRecentWorkspaces');
    
    ipcMain.removeAllListeners('workspace:create');
    ipcMain.removeAllListeners('workspace:delete');
    ipcMain.removeAllListeners('workspace:list');
    ipcMain.removeAllListeners('workspace:get');
    ipcMain.removeAllListeners('workspace:update');
    ipcMain.removeAllListeners('workspace:rename');
    ipcMain.removeAllListeners('workspace:duplicate');
    ipcMain.removeAllListeners('workspace:exists');
    
    ipcMain.removeAllListeners('step:updateContent');
    ipcMain.removeAllListeners('step:getContent');
    ipcMain.removeAllListeners('step:resetContent');
    
    ipcMain.removeAllListeners('workflow:setCurrentStep');
    ipcMain.removeAllListeners('workflow:setStepState');
    
    // Remove legacy handlers
    ipcMain.removeAllListeners('config:get');
    ipcMain.removeAllListeners('config:set');
  }
}