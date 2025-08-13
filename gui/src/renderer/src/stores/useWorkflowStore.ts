import { create } from 'zustand';
import { IpcRendererEvent } from 'electron';
import {
  WorkflowState,
  StepType,
  StepStatusType,
  StepStatus,
  WorkflowStepChangedEvent,
  WorkflowStepStateChangedEvent,
} from './types/StoreTypes';

// ============================================================================
// WORKFLOW STORE - STEP NAVIGATION AND STATE MANAGEMENT
// ============================================================================

const STEP_ORDER: StepType[] = ['input', 'config', 'processing', 'review', 'export'];

// Helper method to calculate which steps can be navigated to
const calculateNavigationPermissions = (stepStates: Record<StepType, StepStatusType>) => {
  const navigation: Record<StepType, boolean> = {
    input: true, // Always accessible
    config: false,
    processing: false,
    review: false,
    export: false,
  };

  // Config accessible if input is complete or has warning
  if (stepStates.input === StepStatus.COMPLETE || stepStates.input === StepStatus.WARNING) {
    navigation.config = true;
  }

  // Processing accessible if config is complete or has warning
  if (stepStates.config === StepStatus.COMPLETE || stepStates.config === StepStatus.WARNING) {
    navigation.processing = true;
  }

  // Review accessible if processing is complete or has warning
  if (
    stepStates.processing === StepStatus.COMPLETE ||
    stepStates.processing === StepStatus.WARNING
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
    navigateToStep: async (step: StepType) => {
      const { actions } = get();

      if (actions.canNavigateToStep(step)) {
        set({ currentStep: step });

        // Optionally persist to main process for cross-session state
        try {
          // This could be used to persist workflow state if needed
          // await window.electron.ipcRenderer.invoke('workflow:setCurrentStep', workspaceId, step);
        } catch (error) {
          console.error('Failed to persist current step:', error);
        }
      } else {
        console.warn(`Cannot navigate to step ${step} - step is blocked or invalid`);
      }
    },

    setStepState: async (step: StepType, state: StepStatusType) => {
      const currentStates = get().stepStates;
      const updatedStates = { ...currentStates, [step]: state };

      // Update navigation permissions based on step completion
      const updatedNavigation = calculateNavigationPermissions(updatedStates);

      set({
        stepStates: updatedStates,
        canNavigate: updatedNavigation,
      });

      // Broadcast step state change for other components
      try {
        // This could be used to persist step states if needed
        // await window.electron.ipcRenderer.invoke('workflow:setStepState', workspaceId, step, state);
      } catch (error) {
        console.error('Failed to persist step state:', error);
      }
    },

    resetWorkflow: async () => {
      set({
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
      });
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
  },
}));

// ============================================================================
// IPC EVENT LISTENERS
// ============================================================================

// Initialize IPC listeners with enhanced defensive checks
if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
  // Workflow step changed event - enhanced defensive update
  window.electron.ipcRenderer.on(
    'workflow:stepChanged',
    (_: IpcRendererEvent, { currentStep }: WorkflowStepChangedEvent) => {
      useWorkflowStore.setState((currentState) => {
        // Only update if step actually changed
        if (currentState.currentStep !== currentStep) {
          return { ...currentState, currentStep };
        }
        return currentState; // No change needed - return exact same reference
      });
    }
  );

  // Workflow step state changed event - enhanced defensive update
  window.electron.ipcRenderer.on(
    'workflow:stepStateChanged',
    (_: IpcRendererEvent, { step, state: newState }: WorkflowStepStateChangedEvent) => {
      useWorkflowStore.setState((currentState) => {
        // Only update if step state actually changed
        if (currentState.stepStates[step] !== newState) {
          const updatedStates = { ...currentState.stepStates, [step]: newState };
          const updatedNavigation = calculateNavigationPermissions(updatedStates);

          // Double-check if navigation actually changed to prevent unnecessary updates
          const navigationChanged = JSON.stringify(currentState.canNavigate) !== JSON.stringify(updatedNavigation);
          
          if (!navigationChanged && currentState.stepStates[step] === newState) {
            return currentState; // No effective change
          }

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
