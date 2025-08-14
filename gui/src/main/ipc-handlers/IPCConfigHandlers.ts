import { ipcMain, WebContents } from 'electron';
import { AppStateService, AppStateSchema } from '../config/AppStateService';
import { WorkspaceConfigService, WorkspaceSchema } from '../config/WorkspaceConfigService';
import { GroupConfigService, GroupSchema } from '../config/GroupConfigService';

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
    private groupService: GroupConfigService,
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
    
    ipcMain.handle('app:setActiveWorkspace', (_, workspaceId: string | null) => {
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
    
    ipcMain.handle('app:validateAndCleanState', () => {
      // Use the workspace service to check if workspaces exist
      const workspaceExistsCallback = (id: string) => this.workspaceService.workspaceExists(id);
      this.appStateService.validateAndCleanState(workspaceExistsCallback);
      this.broadcast('app:stateUpdated', this.appStateService.getState());
      return true;
    });
    
    // ============================================================================
    // WORKSPACE HANDLERS
    // ============================================================================
    
    ipcMain.handle('workspace:create', (_, name: string, backgroundColor?: string, emoji?: string) => {
      const { id, workspace } = this.workspaceService.createWorkspace(name, backgroundColor, emoji);
      this.broadcast('workspace:created', { id, workspace });
      
      // Also update app state to set new workspace as active
      this.appStateService.setActiveWorkspace(id);
      this.broadcast('app:stateUpdated', this.appStateService.getState());
      
      return { id, workspace };
    });
    
    ipcMain.handle('workspace:delete', (_, id: string) => {
      const stateBeforeDeletion = this.appStateService.getState();
      const wasActiveWorkspace = stateBeforeDeletion.activeWorkspaceId === id;
      
      const success = this.workspaceService.deleteWorkspace(id);
      if (success) {
        this.broadcast('workspace:deleted', { id });
        
        this.appStateService.removeFromRecent(id);
        
        if (wasActiveWorkspace) {
          const remainingWorkspaces = this.workspaceService.listWorkspaces();
          if (remainingWorkspaces.length === 0) {
            this.appStateService.setActiveWorkspace(null);
          }
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
    // GROUP MANAGEMENT HANDLERS
    // ============================================================================
    
    ipcMain.handle('group:create', (_, group: Partial<GroupSchema>) => {
      try {
        const { id, group: createdGroup } = this.groupService.createGroup(
          group.name || 'New Group',
          group.color || 'default'
        );
        this.broadcast('group:created', { id, group: createdGroup });
        return { id, group: createdGroup };
      } catch (error) {
        console.error('Failed to create group:', error);
        return null;
      }
    });
    
    ipcMain.handle('group:delete', (_, groupId: string) => {
      try {
        // Get workspaces that belong to this group before deleting
        const workspacesInGroup = this.workspaceService.getWorkspacesByGroup(groupId);
        
        // Remove all workspaces from the group
        workspacesInGroup.forEach(ws => {
          this.workspaceService.removeWorkspaceFromGroup(ws.id);
        });
        
        // Delete the group
        const success = this.groupService.deleteGroup(groupId);
        
        if (success) {
          this.broadcast('group:deleted', { groupId });
          // Broadcast workspace changes for each affected workspace
          workspacesInGroup.forEach(ws => {
            const updatedWorkspace = this.workspaceService.getWorkspace(ws.id);
            this.broadcast('workspace:updated', { id: ws.id, workspace: updatedWorkspace });
          });
        }
        
        return success;
      } catch (error) {
        console.error('Failed to delete group:', error);
        return false;
      }
    });
    
    ipcMain.handle('group:update', (_, groupId: string, updates: Partial<GroupSchema>) => {
      try {
        const success = this.groupService.updateGroup(groupId, updates);
        if (success) {
          const updatedGroup = this.groupService.getGroup(groupId);
          this.broadcast('group:updated', { groupId, group: updatedGroup });
        }
        return success;
      } catch (error) {
        console.error('Failed to update group:', error);
        return false;
      }
    });

    ipcMain.handle('group:list', () => {
      try {
        return this.groupService.listGroups();
      } catch (error) {
        console.error('Failed to list groups:', error);
        return [];
      }
    });

    ipcMain.handle('group:get', (_, groupId: string) => {
      try {
        return this.groupService.getGroup(groupId);
      } catch (error) {
        console.error('Failed to get group:', error);
        return null;
      }
    });
    
    ipcMain.handle('workspace:addToGroup', (_, workspaceId: string, groupId: string) => {
      try {
        // Verify group exists
        const group = this.groupService.getGroup(groupId);
        if (!group) {
          console.error('Cannot add workspace to non-existent group:', groupId);
          return false;
        }

        // Get current workspace to check if it's already in a group
        const workspace = this.workspaceService.getWorkspace(workspaceId);
        if (!workspace) {
          console.error('Cannot add non-existent workspace to group:', workspaceId);
          return false;
        }

        // If workspace is already in a different group, remove it first
        if (workspace.groupId && workspace.groupId !== groupId) {
          this.groupService.updateWorkspaceCount(workspace.groupId, -1);
        }

        // Add workspace to new group
        const success = this.workspaceService.addWorkspaceToGroup(workspaceId, groupId);
        
        if (success) {
          // Update workspace count in the group (only if it wasn't already in this group)
          if (workspace.groupId !== groupId) {
            this.groupService.updateWorkspaceCount(groupId, 1);
          }
          
          // Get updated data
          const updatedWorkspace = this.workspaceService.getWorkspace(workspaceId);
          const updatedGroup = this.groupService.getGroup(groupId);
          
          // Broadcast changes
          this.broadcast('workspace:updated', { id: workspaceId, workspace: updatedWorkspace });
          this.broadcast('group:updated', { groupId, group: updatedGroup });
          this.broadcast('workspace:groupChanged', { workspaceId, groupId, action: 'added' });
        }
        
        return success;
      } catch (error) {
        console.error('Failed to add workspace to group:', error);
        return false;
      }
    });
    
    ipcMain.handle('workspace:removeFromGroup', (_, workspaceId: string) => {
      try {
        const workspace = this.workspaceService.getWorkspace(workspaceId);
        if (!workspace || !workspace.groupId) {
          return true; // Nothing to remove
        }

        const oldGroupId = workspace.groupId;
        const success = this.workspaceService.removeWorkspaceFromGroup(workspaceId);
        
        if (success) {
          // Update workspace count in the old group
          this.groupService.updateWorkspaceCount(oldGroupId, -1);
          
          // Get updated data
          const updatedWorkspace = this.workspaceService.getWorkspace(workspaceId);
          const updatedGroup = this.groupService.getGroup(oldGroupId);
          
          // Broadcast changes
          this.broadcast('workspace:updated', { id: workspaceId, workspace: updatedWorkspace });
          if (updatedGroup) {
            this.broadcast('group:updated', { groupId: oldGroupId, group: updatedGroup });
          }
          this.broadcast('workspace:groupChanged', { workspaceId, groupId: null, action: 'removed' });
        }
        
        return success;
      } catch (error) {
        console.error('Failed to remove workspace from group:', error);
        return false;
      }
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
    ipcMain.removeAllListeners('app:validateAndCleanState');
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
    
    
    // Remove group management handlers
    ipcMain.removeAllListeners('group:create');
    ipcMain.removeAllListeners('group:delete');
    ipcMain.removeAllListeners('group:update');
    ipcMain.removeAllListeners('group:list');
    ipcMain.removeAllListeners('group:get');
    ipcMain.removeAllListeners('workspace:addToGroup');
    ipcMain.removeAllListeners('workspace:removeFromGroup');
  }
}