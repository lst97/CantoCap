import { ipcMain, WebContents } from 'electron';
import { WorkflowStateService } from '../config/WorkflowStateService';
import { MainLogger } from '../logger';
import type { MainProcessLogger } from '../../types/logger';
import { StepType, StepStatusType } from '../../renderer/src/stores/types/StoreTypes';

export class WorkflowIPCHandlers {
  private logger: MainProcessLogger = MainLogger.createScopedLogger('WorkflowIPC');

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
        this.logger.error('Failed to get workflow state', {
          error: error instanceof Error ? error.message : String(error),
          workspaceId,
        });
        throw error;
      }
    });

    ipcMain.handle('workflow:setCurrentStep', (_, workspaceId: string, step: StepType) => {
      try {
        this.logger.info(
          `📡 Main: setCurrentStep called with workspaceId: ${workspaceId}, step: ${step}`
        );
        this.workflowStateService.setCurrentStep(workspaceId, step);

        // Broadcast step change to all renderer processes
        const eventData = {
          workspaceId,
          currentStep: step,
        };
        this.webContents.send('workflow:stepChanged', eventData);

        return { success: true };
      } catch (error) {
        this.logger.error('Failed to set current step', {
          error: error instanceof Error ? error.message : String(error),
          workspaceId,
          step,
        });
        throw error;
      }
    });

    ipcMain.handle(
      'workflow:setStepState',
      (_, workspaceId: string, step: StepType, state: StepStatusType) => {
        try {
          this.workflowStateService.setStepState(workspaceId, step, state);

          // Broadcast step state change to all renderer processes
          this.webContents.send('workflow:stepStateChanged', {
            workspaceId,
            step,
            state,
          });

          return { success: true };
        } catch (error) {
          this.logger.error('Failed to set step state', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
            step,
            state,
          });
          throw error;
        }
      }
    );

    ipcMain.handle('workflow:resetState', (_, workspaceId: string) => {
      try {
        this.workflowStateService.resetWorkflowState(workspaceId);

        // Broadcast workflow reset to all renderer processes
        this.webContents.send('workflow:stateReset', {
          workspaceId,
        });

        return { success: true };
      } catch (error) {
        this.logger.error('Failed to reset workflow state', {
          error: error instanceof Error ? error.message : String(error),
          workspaceId,
        });
        throw error;
      }
    });

    ipcMain.handle('workflow:removeWorkspaceState', (_, workspaceId: string) => {
      try {
        this.workflowStateService.removeWorkspaceState(workspaceId);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to remove workspace workflow state', {
          error: error instanceof Error ? error.message : String(error),
          workspaceId,
        });
        throw error;
      }
    });

    ipcMain.handle('workflow:getAllStates', () => {
      try {
        return this.workflowStateService.getAllWorkspaceStates();
      } catch (error) {
        this.logger.error('Failed to get all workflow states', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    ipcMain.handle('workflow:cleanup', (_, activeWorkspaceIds: string[]) => {
      try {
        this.workflowStateService.cleanupOldStates(activeWorkspaceIds);
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to cleanup workflow states', {
          error: error instanceof Error ? error.message : String(error),
          activeWorkspaceIds,
        });
        throw error;
      }
    });

    this.logger.info('Workflow IPC handlers initialized successfully');
    this.logger.info('✅ Workflow IPC handlers initialized successfully');
  }

  // Cleanup method to remove all handlers
  public cleanup(): void {
    ipcMain.removeAllListeners('workflow:getState');
    ipcMain.removeAllListeners('workflow:setCurrentStep');
    ipcMain.removeAllListeners('workflow:setStepState');
    ipcMain.removeAllListeners('workflow:resetState');
    ipcMain.removeAllListeners('workflow:removeWorkspaceState');
    ipcMain.removeAllListeners('workflow:getAllStates');
    ipcMain.removeAllListeners('workflow:cleanup');

    this.logger.info('Workflow IPC handlers cleaned up successfully');
    this.logger.info('✅ Workflow IPC handlers cleaned up');
  }
}
