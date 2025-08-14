import { ipcMain, WebContents } from 'electron';
import { WorkflowStateService } from '../config/WorkflowStateService';
import { StepType, StepStatusType } from '../../renderer/src/stores/types/StoreTypes';

export class WorkflowIPCHandlers {
  constructor(
    private workflowStateService: WorkflowStateService,
    private webContents: WebContents
  ) {
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // ============================================================================
    // WORKFLOW STATE HANDLERS
    // ============================================================================
    
    ipcMain.handle('workflow:getState', (_, workspaceId: string) => {
      try {
        return this.workflowStateService.getWorkflowState(workspaceId);
      } catch (error) {
        console.error('Failed to get workflow state:', error);
        throw error;
      }
    });
    
    ipcMain.handle('workflow:setCurrentStep', (_, workspaceId: string, step: StepType) => {
      try {
        console.log(`📡 Main: setCurrentStep called with workspaceId: ${workspaceId}, step: ${step}`);
        this.workflowStateService.setCurrentStep(workspaceId, step);
        
        // Broadcast step change to all renderer processes
        const eventData = {
          workspaceId,
          currentStep: step
        };
        console.log(`📡 Main: Broadcasting stepChanged event:`, eventData);
        this.webContents.send('workflow:stepChanged', eventData);
        
        return { success: true };
      } catch (error) {
        console.error('Failed to set current step:', error);
        throw error;
      }
    });
    
    ipcMain.handle('workflow:setStepState', (_, workspaceId: string, step: StepType, state: StepStatusType) => {
      try {
        this.workflowStateService.setStepState(workspaceId, step, state);
        
        // Broadcast step state change to all renderer processes
        this.webContents.send('workflow:stepStateChanged', {
          workspaceId,
          step,
          state
        });
        
        return { success: true };
      } catch (error) {
        console.error('Failed to set step state:', error);
        throw error;
      }
    });
    
    ipcMain.handle('workflow:resetState', (_, workspaceId: string) => {
      try {
        this.workflowStateService.resetWorkflowState(workspaceId);
        
        // Broadcast workflow reset to all renderer processes
        this.webContents.send('workflow:stateReset', {
          workspaceId
        });
        
        return { success: true };
      } catch (error) {
        console.error('Failed to reset workflow state:', error);
        throw error;
      }
    });
    
    ipcMain.handle('workflow:removeWorkspaceState', (_, workspaceId: string) => {
      try {
        this.workflowStateService.removeWorkspaceState(workspaceId);
        return { success: true };
      } catch (error) {
        console.error('Failed to remove workspace workflow state:', error);
        throw error;
      }
    });
    
    ipcMain.handle('workflow:getAllStates', () => {
      try {
        return this.workflowStateService.getAllWorkspaceStates();
      } catch (error) {
        console.error('Failed to get all workflow states:', error);
        throw error;
      }
    });
    
    ipcMain.handle('workflow:cleanup', (_, activeWorkspaceIds: string[]) => {
      try {
        this.workflowStateService.cleanupOldStates(activeWorkspaceIds);
        return { success: true };
      } catch (error) {
        console.error('Failed to cleanup workflow states:', error);
        throw error;
      }
    });
  }
}