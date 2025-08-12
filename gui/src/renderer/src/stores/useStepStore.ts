import { create } from 'zustand';
import { 
  StepContentState,
  StepType, 
  StepContentUpdatedEvent,
  ExportStepData,
  ExportRecord,
} from './types/StoreTypes';
import {
  useInputStepStore,
  useConfigStepStore,
  useProcessingStepStore,
  useReviewStepStore,
  useExportStepStore
} from './steps';

// Window type declaration for electron
interface ElectronWindow extends Window {
  electron: {
    ipcRenderer: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: <T = unknown>(channel: string, callback: (event: T) => void) => void;
    };
  };
}

// ============================================================================
// STEP STORE - COORDINATED STEP CONTENT MANAGEMENT
// ============================================================================

export const useStepStore = create<StepContentState>((set, get) => {
  // Subscribe to individual stores and sync their data

  // Set up subscriptions to individual stores
  useInputStepStore.subscribe((state) => {
    set(currentState => ({
      ...currentState,
      inputStep: state.data
    }));
  });

  useConfigStepStore.subscribe((state) => {
    set(currentState => ({
      ...currentState,
      configStep: state.data
    }));
  });

  useProcessingStepStore.subscribe((state) => {
    set(currentState => ({
      ...currentState,
      processingStep: state.data
    }));
  });

  useReviewStepStore.subscribe((state) => {
    set(currentState => ({
      ...currentState,
      reviewStep: state.data
    }));
  });

  useExportStepStore.subscribe((state) => {
    set(currentState => ({
      ...currentState,
      exportStep: state.data
    }));
  });

  // Initialize with current state from individual stores
  const initialInputData = useInputStepStore.getState().data;
  const initialConfigData = useConfigStepStore.getState().data;
  const initialProcessingData = useProcessingStepStore.getState().data;
  const initialReviewData = useReviewStepStore.getState().data;
  const initialExportData = useExportStepStore.getState().data;

  return {
    // Step Data - synced from individual stores
    inputStep: initialInputData,
    configStep: initialConfigData,
    processingStep: initialProcessingData,
    reviewStep: initialReviewData,
    exportStep: initialExportData,
    
    // General State
    isLoading: false,
    error: null,
    hasUnsavedChanges: false,
    currentWorkspaceId: null,
    
    // Actions
    actions: {
      updateStepContent: async <T>(step: StepType, content: Partial<T>, workspaceId?: string) => {
        // Delegate to individual step stores first
        switch (step) {
          case 'input':
            useInputStepStore.getState().actions.updateInputStep(content);
            break;
          case 'config':
            useConfigStepStore.getState().actions.updateConfigStep(content);
            break;
          case 'processing':
            useProcessingStepStore.getState().actions.updateProcessingStep(content);
            break;
          case 'review':
            useReviewStepStore.getState().actions.updateReviewStep(content);
            break;
          case 'export':
            useExportStepStore.getState().actions.updateExportStep(content);
            break;
        }
        
        // Handle workspace persistence
        let currentWorkspaceId = workspaceId || get().currentWorkspaceId;
        
        if (!currentWorkspaceId) {
          try {
            const { useAppStore } = await import('./useAppStore');
            currentWorkspaceId = useAppStore.getState().activeWorkspaceId;
          } catch (error) {
            console.warn('Could not get workspace ID from app store:', error);
          }
        }
        
        if (!currentWorkspaceId) {
          console.warn('No current workspace - cannot update step content. Please select a workspace first.');
          return;
        }
        
        try {
          set({ hasUnsavedChanges: true, currentWorkspaceId });
          
          // Persist to main process
          await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:updateContent', currentWorkspaceId, step, content);
          
        } catch (error) {
          console.error('Failed to update step content:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update step content' 
          });
        }
      },
      
      getStepContent: (step: StepType) => {
        // Get from current state (which is synced from individual stores)
        const state = get();
        return state[`${step}Step` as keyof StepContentState];
      },
      
      resetStepContent: async (step: StepType, workspaceId?: string) => {
        const currentWorkspaceId = workspaceId || get().currentWorkspaceId;
        if (!currentWorkspaceId) return;
        
        try {
          set({ isLoading: true, error: null });
          
          // Get default content from main process
          await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:resetContent', currentWorkspaceId, step);
          
          // Reset the individual store
          switch (step) {
            case 'input':
              useInputStepStore.getState().actions.resetInputStep();
              break;
            case 'config':
              useConfigStepStore.getState().actions.resetConfigStep();
              break;
            case 'processing':
              useProcessingStepStore.getState().actions.resetProcessingStep();
              break;
            case 'review':
              useReviewStepStore.getState().actions.resetReviewStep();
              break;
            case 'export':
              useExportStepStore.getState().actions.resetExportStep();
              break;
          }
          
          set({ isLoading: false });
          
        } catch (error) {
          console.error('Failed to reset step content:', error);
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to reset step content' 
          });
        }
      },
      
      loadStepContent: async (workspaceId: string, step: StepType) => {
        try {
          set({ isLoading: true, error: null });
          
          const content = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:getContent', workspaceId, step);
          
          if (content) {
            // Update the individual store - this will trigger sync back to main store
            switch (step) {
              case 'input':
                useInputStepStore.getState().actions.updateInputStep(content);
                break;
              case 'config':
                useConfigStepStore.getState().actions.updateConfigStep(content);
                break;
              case 'processing':
                useProcessingStepStore.getState().actions.updateProcessingStep(content);
                break;
              case 'review':
                useReviewStepStore.getState().actions.updateReviewStep(content);
                break;
              case 'export':
                useExportStepStore.getState().actions.updateExportStep(content);
                break;
            }
          }
          
          set({ isLoading: false });
          
        } catch (error) {
          console.error('Failed to load step content:', error);
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load step content' 
          });
        }
      },
      
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
      
      setError: (error: string | null) => {
        set({ error });
      },
      
      clearError: () => {
        set({ error: null });
      },
      
      markUnsavedChanges: (hasChanges: boolean) => {
        set({ hasUnsavedChanges: hasChanges });
      },
      
      saveAllChanges: async () => {
        const currentWorkspaceId = get().currentWorkspaceId;
        if (!currentWorkspaceId) return;
        
        try {
          set({ isLoading: true, error: null });
          
          // Save all step content to main process
          const state = get();
          const steps: StepType[] = ['input', 'config', 'processing', 'review', 'export'];
          
          await Promise.all(
            steps.map(step => 
              (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
                'step:updateContent', 
                currentWorkspaceId, 
                step, 
                state[`${step}Step` as keyof StepContentState]
              )
            )
          );
          
          set({ 
            isLoading: false,
            hasUnsavedChanges: false
          });
          
        } catch (error) {
          console.error('Failed to save all changes:', error);
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to save changes' 
          });
        }
      },
      
      discardChanges: async () => {
        const currentWorkspaceId = get().currentWorkspaceId;
        if (!currentWorkspaceId) return;
        
        try {
          set({ isLoading: true, error: null });
          
          // Reload all step content from main process
          const steps: StepType[] = ['input', 'config', 'processing', 'review', 'export'];
          
          const stepContents = await Promise.all(
            steps.map(step => 
              (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:getContent', currentWorkspaceId, step)
            )
          );
          
          // Update individual stores with fresh data - this will sync back to main store
          steps.forEach((step, index) => {
            if (stepContents[index]) {
              get().actions.updateStepContent(step, stepContents[index]);
            }
          });
          
          set({ 
            isLoading: false, 
            hasUnsavedChanges: false 
          });
          
        } catch (error) {
          console.error('Failed to discard changes:', error);
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to discard changes' 
          });
        }
      },

      // Generate CLI arguments from config for engine execution
      getConfigAsCliArgs: () => {
        const state = get();
        const inputConfig = state.inputStep;
        const args: string[] = [];

        // Input file (required)
        if (inputConfig.inputFile || inputConfig.selectedFile) {
          args.push(inputConfig.inputFile || inputConfig.selectedFile!);
        }

        // Get the rest from config store
        const configArgs = useConfigStepStore.getState().actions.getCliArgs();
        args.push(...configArgs);

        return args;
      },
      
      // Cancel ongoing transcription process
      cancelTranscription: async () => {
        try {
          await useProcessingStepStore.getState().actions.cancel();
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to cancel transcription' });
          throw error;
        }
      },

      // Export-specific actions - delegate to export store
      updateExportFormat: (format: string) => {
        useExportStepStore.getState().actions.updateExportFormat(format);
        set({ hasUnsavedChanges: true });
      },

      updateExportSettings: (settings: Partial<ExportStepData['exportSettings']>) => {
        useExportStepStore.getState().actions.updateExportSettings(settings);
        set({ hasUnsavedChanges: true });
      },

      updatePreviewState: (previewState: Partial<ExportStepData['previewState']>) => {
        useExportStepStore.getState().actions.updatePreviewState(previewState);
      },

      updateActionsState: (actionsState: Partial<ExportStepData['actionsState']>) => {
        useExportStepStore.getState().actions.updateActionsState(actionsState);
      },

      updateHighlightConfig: (highlightConfig: Partial<ExportStepData['highlightConfig']>) => {
        useExportStepStore.getState().actions.updateHighlightConfig(highlightConfig);
      },

      setPreviewContent: (content: string) => {
        useExportStepStore.getState().actions.setPreviewContent(content);
      },

      updateUserSelections: (selections: {
        selectedLanguages?: string[];
        includeMetadata?: boolean;
        showTimestamps?: boolean;
        customOutputPath?: string;
      }) => {
        useExportStepStore.getState().actions.updateUserSelections(selections);
        set({ hasUnsavedChanges: true });
      },

      addExportRecord: (record: Omit<ExportRecord, 'id'>) => {
        useExportStepStore.getState().actions.addExportRecord(record);
        set({ hasUnsavedChanges: true });
      },

      removeExportRecord: (recordId: string) => {
        useExportStepStore.getState().actions.removeExportRecord(recordId);
        set({ hasUnsavedChanges: true });
      },

      removeFromHistory: (index: number) => {
        useExportStepStore.getState().actions.removeFromHistory(index);
        set({ hasUnsavedChanges: true });
      },

      clearHistory: () => {
        useExportStepStore.getState().actions.clearHistory();
        set({ hasUnsavedChanges: true });
      },

      setExportingState: (isExporting: boolean, progress?: number, error?: string) => {
        useExportStepStore.getState().actions.setExportingState(isExporting, progress, error);
      },

      generatePreviewContent: async () => {
        const subtitles = useReviewStepStore.getState().data.subtitles;
        await useExportStepStore.getState().actions.generatePreviewContent(subtitles);
      }
    }
  };
});

// ============================================================================
// IPC EVENT LISTENERS FOR REAL-TIME SYNC
// ============================================================================

// Initialize IPC listeners with enhanced defensive checks
if (typeof window !== 'undefined' && (window as unknown as ElectronWindow).electron?.ipcRenderer) {
  // Step content updated event - delegate to individual stores
  (window as unknown as ElectronWindow).electron.ipcRenderer.on<StepContentUpdatedEvent>('step:contentUpdated', ({ workspaceId, stepName, content }) => {
    const currentWorkspaceId = useStepStore.getState().currentWorkspaceId;
    
    // Only update if this is for the current workspace
    if (workspaceId !== currentWorkspaceId) {
      return; // No change needed - wrong workspace
    }
    
    // Delegate to individual stores - this will automatically sync back to main store
    switch (stepName) {
      case 'input':
        useInputStepStore.getState().actions.updateInputStep(content);
        break;
      case 'config':
        useConfigStepStore.getState().actions.updateConfigStep(content);
        break;
      case 'processing':
        useProcessingStepStore.getState().actions.updateProcessingStep(content);
        break;
      case 'review':
        useReviewStepStore.getState().actions.updateReviewStep(content);
        break;
      case 'export':
        useExportStepStore.getState().actions.updateExportStep(content);
        break;
    }
  });
}

// ============================================================================
// HELPER HOOKS AND SELECTORS
// ============================================================================

// Hooks to get specific step content - use main store for consistency
export const useInputStepContent = () => useStepStore(state => state.inputStep);
export const useConfigStepContent = () => useStepStore(state => state.configStep);
export const useProcessingStepContent = () => useStepStore(state => state.processingStep);
export const useReviewStepContent = () => useStepStore(state => state.reviewStep);
export const useExportStepContent = () => useStepStore(state => state.exportStep);

// Hook to get step content by step type
export const useStepContent = <T>(step: StepType) => 
  useStepStore(state => state[`${step}Step` as keyof StepContentState] as T);

// Hook to get step actions
export const useStepActions = () => useStepStore(state => state.actions);

// Hook to get step loading state
export const useStepLoading = () => useStepStore(state => state.isLoading);

// Hook to get step error state  
export const useStepError = () => useStepStore(state => state.error);

// Hook to check if there are unsaved changes
export const useHasUnsavedChanges = () => useStepStore(state => state.hasUnsavedChanges);

// Specific content selectors for common use cases
export const useSelectedFiles = () => useStepStore(state => state.inputStep.selectedFiles);
export const useInputFile = () => useStepStore(state => state.inputStep.inputFile || state.inputStep.selectedFile);
export const useSelectedRange = () => useStepStore(state => state.inputStep.selectedRange);
export const useTimeRange = () => useStepStore(state => ({
  startTime: state.inputStep.startTime,
  endTime: state.inputStep.endTime,
  duration: state.inputStep.duration,
  selectedRange: state.inputStep.selectedRange
}));
export const useVideoMetadata = () => useStepStore(state => state.inputStep.mediaMetadata);
export const useModelSettings = () => useStepStore(state => state.configStep.modelSettings);
export const useProcessingStatus = () => useStepStore(state => state.processingStep.status);
export const useProcessingProgress = () => useStepStore(state => state.processingStep.progress);
export const useSubtitles = () => useStepStore(state => state.reviewStep.subtitles);
export const useExportFormat = () => useStepStore(state => state.exportStep.format);

// Hook to get validation state
export const useConfigValidation = () => useStepStore(state => ({
  isValid: state.configStep.isValid,
  errors: state.configStep.validationErrors
}));

// Hook to get processing logs
export const useProcessingLogs = () => useStepStore(state => state.processingStep.logs);

// Hook to get export history
export const useExportHistory = () => useStepStore(state => state.exportStep.exportHistory);

// Hook to get CLI arguments for subtitle generation
export const useConfigAsCliArgs = () => useStepStore(state => state.actions.getConfigAsCliArgs);

// ============================================================================
// EXPORT-SPECIFIC HOOKS
// ============================================================================

// Export state selectors
export const useExportPreviewState = () => useStepStore(state => state.exportStep.previewState);
export const useExportActionsState = () => useStepStore(state => state.exportStep.actionsState);
export const useExportHighlightConfig = () => useStepStore(state => state.exportStep.highlightConfig);
export const useExportValidationIssues = () => useStepStore(state => state.exportStep.validationIssues);
export const useExportHistoryGrouping = () => useStepStore(state => state.exportStep.historyGrouping);
export const useExportPreviewContent = () => useStepStore(state => state.exportStep.previewContent);
export const useExportUserSelections = () => useStepStore(state => ({
  selectedLanguages: state.exportStep.selectedLanguages,
  includeMetadata: state.exportStep.includeMetadata,
  showTimestamps: state.exportStep.showTimestamps,
  customOutputPath: state.exportStep.customOutputPath
}));
export const useExportStatus = () => useStepStore(state => ({
  isExporting: state.exportStep.isExporting,
  exportProgress: state.exportStep.exportProgress,
  lastExportError: state.exportStep.lastExportError
}));

// Export actions selectors
export const useExportActions = () => useStepStore(state => ({
  updateExportFormat: state.actions.updateExportFormat,
  updateExportSettings: state.actions.updateExportSettings,
  updatePreviewState: state.actions.updatePreviewState,
  updateActionsState: state.actions.updateActionsState,
  updateHighlightConfig: state.actions.updateHighlightConfig,
  setPreviewContent: state.actions.setPreviewContent,
  updateUserSelections: state.actions.updateUserSelections,
  addExportRecord: state.actions.addExportRecord,
  removeExportRecord: state.actions.removeExportRecord,
  removeFromHistory: state.actions.removeFromHistory,
  clearHistory: state.actions.clearHistory,
  setExportingState: state.actions.setExportingState,
  generatePreviewContent: state.actions.generatePreviewContent
}));

// Combined export hook for components
export const useExportStepComplete = () => {
  const exportStep = useExportStepContent();
  const actions = useExportActions();
  
  return {
    ...exportStep,
    actions
  };
};