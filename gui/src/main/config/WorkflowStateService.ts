import Store from 'electron-store';
import { StepType, StepStatusType, StepStatus } from '../../renderer/src/stores/types/StoreTypes';

export interface WorkflowStateSchema {
  // Per-workspace workflow states
  workspaceStates: {
    [workspaceId: string]: {
      currentStep: StepType;
      stepStates: Record<StepType, StepStatusType>;
      lastUpdated: number;
    };
  };
}

export class WorkflowStateService {
  private store: Store<WorkflowStateSchema>;
  
  constructor() {
    this.store = new Store<WorkflowStateSchema>({
      name: 'workflow-state',
      defaults: {
        workspaceStates: {}
      }
    });
  }
  
  private getDefaultStepStates(): Record<StepType, StepStatusType> {
    return {
      input: StepStatus.READY,
      config: StepStatus.BLOCK,
      processing: StepStatus.BLOCK,
      review: StepStatus.BLOCK,
      export: StepStatus.BLOCK,
    };
  }
  
  getWorkflowState(workspaceId: string): { currentStep: StepType; stepStates: Record<StepType, StepStatusType> } {
    const allStates = this.store.get('workspaceStates', {});
    const workspaceState = allStates[workspaceId];
    
    if (workspaceState) {
      return {
        currentStep: workspaceState.currentStep,
        stepStates: workspaceState.stepStates
      };
    }
    
    // Return default state for new workspace
    return {
      currentStep: 'input',
      stepStates: this.getDefaultStepStates()
    };
  }
  
  setCurrentStep(workspaceId: string, step: StepType): void {
    const allStates = this.store.get('workspaceStates', {});
    const existingState = allStates[workspaceId] || {
      currentStep: 'input',
      stepStates: this.getDefaultStepStates(),
      lastUpdated: Date.now()
    };
    
    existingState.currentStep = step;
    existingState.lastUpdated = Date.now();
    
    allStates[workspaceId] = existingState;
    this.store.set('workspaceStates', allStates);
    
    console.log(`💾 Persisted workflow step for workspace ${workspaceId}: ${step}`);
  }
  
  setStepState(workspaceId: string, step: StepType, state: StepStatusType): void {
    const allStates = this.store.get('workspaceStates', {});
    const existingState = allStates[workspaceId] || {
      currentStep: 'input',
      stepStates: this.getDefaultStepStates(),
      lastUpdated: Date.now()
    };
    
    existingState.stepStates[step] = state;
    existingState.lastUpdated = Date.now();
    
    allStates[workspaceId] = existingState;
    this.store.set('workspaceStates', allStates);
    
    console.log(`💾 Persisted step state for workspace ${workspaceId}: ${step} = ${state}`);
  }
  
  resetWorkflowState(workspaceId: string): void {
    const allStates = this.store.get('workspaceStates', {});
    
    allStates[workspaceId] = {
      currentStep: 'input',
      stepStates: this.getDefaultStepStates(),
      lastUpdated: Date.now()
    };
    
    this.store.set('workspaceStates', allStates);
    console.log(`💾 Reset workflow state for workspace ${workspaceId}`);
  }
  
  removeWorkspaceState(workspaceId: string): void {
    const allStates = this.store.get('workspaceStates', {});
    delete allStates[workspaceId];
    this.store.set('workspaceStates', allStates);
    console.log(`💾 Removed workflow state for workspace ${workspaceId}`);
  }
  
  cleanupOldStates(activeWorkspaceIds: string[]): void {
    const allStates = this.store.get('workspaceStates', {});
    const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    let hasChanges = false;
    
    Object.keys(allStates).forEach(workspaceId => {
      const state = allStates[workspaceId];
      
      // Remove states for workspaces that no longer exist or are very old
      if (!activeWorkspaceIds.includes(workspaceId) && state.lastUpdated < cutoffTime) {
        delete allStates[workspaceId];
        hasChanges = true;
        console.log(`🧹 Cleaned up old workflow state for workspace ${workspaceId}`);
      }
    });
    
    if (hasChanges) {
      this.store.set('workspaceStates', allStates);
    }
  }
  
  getAllWorkspaceStates(): Record<string, { currentStep: StepType; stepStates: Record<StepType, StepStatusType>; lastUpdated: number }> {
    return this.store.get('workspaceStates', {});
  }
  
  reset(): void {
    this.store.clear();
    console.log('💾 Reset all workflow states');
  }
}