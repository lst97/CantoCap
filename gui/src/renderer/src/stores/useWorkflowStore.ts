import { create } from 'zustand';
import {
  WorkflowState,
  StepType,
  StepStatusType,
  StepStatus,
  WorkflowStepChangedEvent,
  WorkflowStepStateChangedEvent,
} from './types/StoreTypes';
import { useStepStore } from './useStepStore';
import { ElectronWindow } from '@/types';
import { createStoreLogger } from '../utils/logger';

// Import to get current workspace ID for persistence
let getAppStore: (() => { activeWorkspaceId: string | null }) | null = null;

// Dynamically import to avoid circular dependencies
const getWorkspaceId = async (): Promise<string | null> => {
  if (!getAppStore) {
    const { useAppStore } = await import('./useAppStore');
    getAppStore = () => useAppStore.getState();
  }
  return getAppStore().activeWorkspaceId;
};

// Get input step content for JSON import detection
const getInputStepContent = (): { importedJsonFile?: string | null } => {
  try {
    return useStepStore.getState().inputStep || {};
  } catch (error) {
    return {};
  }
};

// Get processing step content for status detection
const getProcessingStepContent = (): { status?: 'idle' | 'running' | 'completed' | 'error' } => {
  try {
    return useStepStore.getState().processingStep || {};
  } catch (error) {
    return {};
  }
};

// ============================================================================
// WORKFLOW STORE - STEP NAVIGATION AND STATE MANAGEMENT
// ============================================================================

const logger = createStoreLogger('Workflow');
const STEP_ORDER: StepType[] = ['input', 'config', 'processing', 'review', 'export'];

// Helper method to calculate which steps can be navigated to
const calculateNavigationPermissions = (
  stepStates: Record<StepType, StepStatusType>, 
  inputStepContent?: { importedJsonFile?: string | null },
  processingStepContent?: { status?: 'idle' | 'running' | 'completed' | 'error' }
) => {
  const navigation: Record<StepType, boolean> = {
    input: true, // Always accessible
    config: false,
    processing: false,
    review: false,
    export: false,
  };

  // Check if processing is currently running - disable navigation to other steps if so
  const isProcessingRunning = processingStepContent?.status === 'running';
  
  // If processing is running, only allow navigation to the processing step itself
  if (isProcessingRunning) {
    return {
      input: false,
      config: false,
      processing: true, // Keep processing step accessible when running
      review: false,
      export: false,
    };
  }

  // Check if JSON was imported - if so, allow skipping config and processing steps
  const hasJsonImport = !!(inputStepContent?.importedJsonFile);
  
  // Config accessible if input is complete or has warning
  if (stepStates.input === StepStatus.COMPLETE || stepStates.input === StepStatus.WARNING) {
    navigation.config = true;
  }

  // Processing accessible if config is complete/warning OR processing is already ready
  if (stepStates.config === StepStatus.COMPLETE || 
      stepStates.config === StepStatus.WARNING ||
      stepStates.processing === StepStatus.READY) {
    navigation.processing = true;
  }
  
  // Special case: After cancelling processing, allow backward navigation to config and input
  // when processing is READY and processing status is idle
  if (stepStates.processing === StepStatus.READY && processingStepContent?.status === 'idle') {
    navigation.config = true;
    navigation.input = true;
  }

  // Review accessible if processing is complete or has warning
  // OR if JSON was imported (bypass config and processing requirements)
  if (
    stepStates.processing === StepStatus.COMPLETE ||
    stepStates.processing === StepStatus.WARNING ||
    (hasJsonImport && (stepStates.input === StepStatus.COMPLETE || stepStates.input === StepStatus.WARNING))
  ) {
    navigation.review = true;
  }

  // Export accessible if review is complete or has warning
  if (stepStates.review === StepStatus.COMPLETE || stepStates.review === StepStatus.WARNING) {
    navigation.export = true;
  }

  // Allow skipping to later steps if current step is skipped
  STEP_ORDER.forEach((step, index) => {
    if (stepStates[step] === StepStatus.SKIP && index > 0) {
      // If a step is skipped, allow access to next step
      const nextStepIndex = index + 1;
      if (nextStepIndex < STEP_ORDER.length) {
        navigation[STEP_ORDER[nextStepIndex]] = true;
      }
    }
  });

  logger.debug('Navigation permissions calculated', {
    hasJsonImport,
    isProcessingRunning,
    inputStatus: stepStates.input,
    processingStatus: stepStates.processing,
    canAccessReview: navigation.review
  });

  return navigation;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // State
  currentStep: 'input',
  stepStates: {
    input: StepStatus.READY,
    config: StepStatus.BLOCK,
    processing: StepStatus.BLOCK,
    review: StepStatus.BLOCK,
    export: StepStatus.BLOCK,
  },
  canNavigate: {
    input: true,
    config: false,
    processing: false,
    review: false,
    export: false,
  },

  // Actions
  actions: {
    // Navigate to a different step - ONLY changes currentStep, never modifies step states
    // Step states should only be changed by explicit actions within step content
    navigateToStep: async (step: StepType) => {
      const { actions } = get();
      const currentState = get();
      
      logger.info('Navigation request', {
        from: currentState.currentStep,
        to: step,
        canNavigate: actions.canNavigateToStep(step)
      });

      if (actions.canNavigateToStep(step)) {
        // IMPORTANT: Navigation should ONLY change currentStep, never step states
        // This ensures step states are only modified by explicit actions within step content
        const previousStepStates = currentState.stepStates;
        
        set(state => ({
          ...state,
          currentStep: step,
          // Explicitly preserve step states - they should not change during navigation
          stepStates: previousStepStates
        }));
        
        logger.debug('Navigation completed successfully', {
          newCurrentStep: step,
          statesPreserved: true
        });

        // Persist to main process for cross-session state using context bridge API
        try {
          const workspaceId = await getWorkspaceId();
          if (workspaceId && (window as unknown as ElectronWindow).cantocapAPI?.workflowSetCurrentStep) {
            await (window as unknown as ElectronWindow).cantocapAPI.workflowSetCurrentStep(workspaceId, step);
            logger.debug('Persisted current step', { step, workspaceId });
          }
        } catch (error) {
          logger.error('Failed to persist current step', {
            step,
            workspaceId: await getWorkspaceId(),
            error: error instanceof Error ? error.message : String(error)
          });
          return { success: false, error: `Failed to persist step: ${error}` };
        }
        return { success: true };
      } else {
        logger.warn('Cannot navigate to step - blocked or invalid', { step });
        return { success: false, error: `Cannot navigate to step ${step} - step is blocked or invalid` };
      }
    },

    // Set step state - should only be called from within step content, never from navigation
    setStepState: async (step: StepType, state: StepStatusType) => {
      const currentStates = get().stepStates;
      
      // Only proceed if the state has actually changed
      if (currentStates[step] === state) {
        return;
      }

      const updatedStates = { ...currentStates, [step]: state };

      // Update navigation permissions based on step completion and JSON import status
      const inputStepContent = getInputStepContent();
      const processingStepContent = getProcessingStepContent();
      const updatedNavigation = calculateNavigationPermissions(updatedStates, inputStepContent, processingStepContent);

      set({
        stepStates: updatedStates,
        canNavigate: updatedNavigation,
      });

      // Persist step state change to main process only when state actually changed using context bridge API
      try {
        const workspaceId = await getWorkspaceId();
        if (workspaceId && (window as unknown as ElectronWindow).cantocapAPI?.workflowSetStepState) {
          await (window as unknown as ElectronWindow).cantocapAPI.workflowSetStepState(workspaceId, step, state);
          logger.debug('Persisted step state change', { step, state, workspaceId });
        }
      } catch (error) {
        logger.error('Failed to persist step state', {
          step,
          state,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    resetWorkflow: async () => {
      const defaultState = {
        currentStep: 'input' as StepType,
        stepStates: {
          input: StepStatus.READY,
          config: StepStatus.BLOCK,
          processing: StepStatus.BLOCK,
          review: StepStatus.BLOCK,
          export: StepStatus.BLOCK,
        },
        canNavigate: calculateNavigationPermissions({
          input: StepStatus.READY,
          config: StepStatus.BLOCK,
          processing: StepStatus.BLOCK,
          review: StepStatus.BLOCK,
          export: StepStatus.BLOCK,
        }, undefined, { status: 'idle' }),
      };

      set(defaultState);

      // Persist the reset state using context bridge API
      try {
        const workspaceId = await getWorkspaceId();
        if (workspaceId && (window as unknown as ElectronWindow).cantocapAPI?.workflowResetState) {
          await (window as unknown as ElectronWindow).cantocapAPI.workflowResetState(workspaceId);
          logger.debug('Reset workflow state persisted', { workspaceId });
        }
      } catch (error) {
        logger.error('Failed to persist workflow reset', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    loadWorkflowState: async (workspaceId: string) => {
      try {
        if ((window as unknown as ElectronWindow).cantocapAPI?.workflowGetState) {
          const persistedState = await (window as unknown as ElectronWindow).cantocapAPI.workflowGetState(workspaceId);
          
          if (persistedState && typeof persistedState === 'object' && 
            'currentStep' in persistedState && 'stepStates' in persistedState) {
            const typedState = persistedState as { currentStep: StepType; stepStates: Record<StepType, StepStatusType> };
            const inputStepContent = getInputStepContent();
            const processingStepContent = getProcessingStepContent();
            
            // CRITICAL FIX: Handle processing step completion status persistence issue
            // If processing step is marked as COMPLETE in workflow but step content shows 'running',
            // override the step content status to prevent incorrect navigation back to Step 3
            let correctedProcessingStepContent = processingStepContent;
            if (typedState.stepStates.processing === StepStatus.COMPLETE && 
                processingStepContent?.status === 'running') {
              logger.warn('Correcting processing step status mismatch', {
                workspaceId,
                workflowState: 'COMPLETE',
                processingState: 'running'
              });
              correctedProcessingStepContent = { ...processingStepContent, status: 'completed' as const };
              
              // Also update the processing step store to reflect the correct status
              const { useProcessingStepStore } = await import('./steps/useProcessingStepStore');
              useProcessingStepStore.getState().actions.updateStatusFromEvent({ status: 'completed' });
            }
            
            const updatedNavigation = calculateNavigationPermissions(typedState.stepStates, inputStepContent, correctedProcessingStepContent);
            
            const currentState = get();
            logger.info('Loading persisted workflow state', {
              workspaceId,
              currentStep: currentState.currentStep,
              persistedStep: typedState.currentStep,
              willChange: currentState.currentStep !== typedState.currentStep
            });
            
            set({
              currentStep: typedState.currentStep,
              stepStates: typedState.stepStates,
              canNavigate: updatedNavigation,
            });
            
            logger.debug('Persisted workflow state loaded successfully', {
              workspaceId,
              currentStep: typedState.currentStep
            });
          } else {
            logger.debug('No persisted workflow state found, using defaults', { workspaceId });
          }
        }
      } catch (error) {
        logger.error('Failed to load workflow state', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    canNavigateToStep: (step: StepType) => {
      const { canNavigate } = get();
      return canNavigate[step];
    },

    getNextStep: () => {
      const { currentStep } = get();
      const currentIndex = STEP_ORDER.indexOf(currentStep);

      if (currentIndex < STEP_ORDER.length - 1) {
        return STEP_ORDER[currentIndex + 1];
      }

      return null;
    },

    getPreviousStep: () => {
      const { currentStep } = get();
      const currentIndex = STEP_ORDER.indexOf(currentStep);

      if (currentIndex > 0) {
        return STEP_ORDER[currentIndex - 1];
      }

      return null;
    },

    completeCurrentStep: async () => {
      const { currentStep, actions } = get();
      await actions.setStepState(currentStep, StepStatus.COMPLETE);

      // Auto-navigate to next step if available and accessible
      const nextStep = actions.getNextStep();
      if (nextStep && actions.canNavigateToStep(nextStep)) {
        await actions.navigateToStep(nextStep);
      }
    },

    // Refresh navigation permissions (e.g., when JSON import status changes)
    refreshNavigationPermissions: () => {
      const { stepStates } = get();
      const inputStepContent = getInputStepContent();
      const processingStepContent = getProcessingStepContent();
      const updatedNavigation = calculateNavigationPermissions(stepStates, inputStepContent, processingStepContent);
      
      set({ canNavigate: updatedNavigation });
      
      logger.debug('Navigation permissions refreshed due to input step changes');
    },
  },
}));

// ============================================================================
// IPC EVENT LISTENERS
// ============================================================================

// Initialize IPC listeners with enhanced defensive checks
if (typeof window !== 'undefined' && (window as unknown as ElectronWindow).electron?.ipcRenderer) {
  // Workflow step changed event - enhanced defensive update
  (window as unknown as ElectronWindow).electron.ipcRenderer.on(
    'workflow:stepChanged',
    (_event: never, data: WorkflowStepChangedEvent) => {
      const { currentStep } = data;
      logger.debug('IPC stepChanged event received', { currentStep });
      useWorkflowStore.setState((currentState) => {
        // Only update if step actually changed
        if (currentState.currentStep !== currentStep) {
          logger.debug('IPC updating current step', {
            from: currentState.currentStep,
            to: currentStep
          });
          return { ...currentState, currentStep };
        }
        return currentState; // No change needed - return exact same reference
      });
    }
  );

  // Workflow step state changed event - enhanced defensive update
  (window as unknown as ElectronWindow).electron.ipcRenderer.on(
    'workflow:stepStateChanged',
    (_event: never, data: WorkflowStepStateChangedEvent) => {
      const { step, state: newState } = data;
      useWorkflowStore.setState((currentState) => {
        // Only update if step state actually changed
        if (currentState.stepStates[step] !== newState) {
          const updatedStates = { ...currentState.stepStates, [step]: newState };
          const inputStepContent = getInputStepContent();
          const processingStepContent = getProcessingStepContent();
          const updatedNavigation = calculateNavigationPermissions(updatedStates, inputStepContent, processingStepContent);

          // Double-check if navigation actually changed to prevent unnecessary updates
          const navigationChanged = JSON.stringify(currentState.canNavigate) !== JSON.stringify(updatedNavigation);
          
          if (!navigationChanged && currentState.stepStates[step] === newState) {
            return currentState; // No effective change
          }

          logger.debug('IPC step state changed', { step, newState });
          return {
            ...currentState,
            stepStates: updatedStates,
            canNavigate: updatedNavigation,
          };
        }
        return currentState; // No change needed - return exact same reference
      });
    }
  );
}

// ============================================================================
// HELPER HOOKS AND SELECTORS
// ============================================================================

// Hook to get current step
export const useCurrentStep = () => useWorkflowStore((state) => state.currentStep);

// Hook to get all step states
export const useStepStates = () => useWorkflowStore((state) => state.stepStates);

// Hook to get specific step state
export const useStepState = (step: StepType) => useWorkflowStore((state) => state.stepStates[step]);

// Hook to get navigation permissions
export const useCanNavigate = () => useWorkflowStore((state) => state.canNavigate);

// Hook to check if specific step is accessible
export const useCanNavigateToStep = (step: StepType) =>
  useWorkflowStore((state) => state.canNavigate[step]);

// Hook to get workflow actions
export const useWorkflowActions = () => useWorkflowStore((state) => state.actions);

// Hook to get next available step
export const useNextStep = () => useWorkflowStore((state) => state.actions.getNextStep());

// Hook to get previous step
export const usePreviousStep = () => useWorkflowStore((state) => state.actions.getPreviousStep());

// Hook to check if current step is the first step
export const useIsFirstStep = () =>
  useWorkflowStore((state) => STEP_ORDER.indexOf(state.currentStep) === 0);

// Hook to check if current step is the last step
export const useIsLastStep = () =>
  useWorkflowStore((state) => STEP_ORDER.indexOf(state.currentStep) === STEP_ORDER.length - 1);

// Hook to get workflow progress (percentage of completed steps)
export const useWorkflowProgress = () =>
  useWorkflowStore((state) => {
    const completedSteps = STEP_ORDER.filter(
      (step) =>
        state.stepStates[step] === StepStatus.COMPLETE || state.stepStates[step] === StepStatus.SKIP
    ).length;
    return (completedSteps / STEP_ORDER.length) * 100;
  });

// Hook to load workflow state for a workspace
export const useLoadWorkflowState = () => useWorkflowStore((state) => state.actions.loadWorkflowState);

// Hook to check if workflow is complete
export const useIsWorkflowComplete = () =>
  useWorkflowStore((state) =>
    STEP_ORDER.every(
      (step) =>
        state.stepStates[step] === StepStatus.COMPLETE || state.stepStates[step] === StepStatus.SKIP
    )
  );

// Hook to get steps with their states for rendering navigation
export const useStepsWithStates = () =>
  useWorkflowStore((state) =>
    STEP_ORDER.map((step) => ({
      step,
      state: state.stepStates[step],
      canNavigate: state.canNavigate[step],
      isCurrent: state.currentStep === step,
    }))
  );
