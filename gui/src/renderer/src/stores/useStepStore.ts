import React from 'react';
import { create } from 'zustand';
import {
  StepContentState,
  StepType,
  ExportStepData,
  ExportRecord,
  ElectronWindow,
  InputStepData,
  ConfigStepData,
  ProcessingStepData,
  ReviewStepData,
} from './types/StoreTypes';
import { validateStepContent, safeWorkspaceOperation } from '../utils/workspaceValidation';
import {
  useInputStepStore,
  useConfigStepStore,
  useProcessingStepStore,
  useReviewStepStore,
  useExportStepStore,
} from './steps';

// ============================================================================
// STEP STORE - COORDINATED STEP CONTENT MANAGEMENT
// ============================================================================

export const useStepStore = create<StepContentState>((set, get) => {
  // Subscribe to individual stores and sync their data

  // Set up subscriptions to individual stores
  useInputStepStore.subscribe((state) => {
    set((currentState) => ({
      ...currentState,
      inputStep: state.data,
    }));
  });

  useConfigStepStore.subscribe((state) => {
    set((currentState) => ({
      ...currentState,
      configStep: state.data,
    }));
  });

  useProcessingStepStore.subscribe((state) => {
    set((currentState) => ({
      ...currentState,
      processingStep: state.data,
    }));
  });

  useReviewStepStore.subscribe((state) => {
    set((currentState) => ({
      ...currentState,
      reviewStep: state.data,
    }));
  });

  useExportStepStore.subscribe((state) => {
    set((currentState) => ({
      ...currentState,
      exportStep: state.data,
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
        console.log(`🔄 STEP UPDATE: Updating ${step} step with content:`, content);

        // Delegate to individual step stores first
        switch (step) {
          case 'input':
            useInputStepStore.getState().actions.updateInputStep(content);
            break;
          case 'config':
            console.log(`🔄 CONFIG UPDATE: Delegating to config store with:`, content);
            await useConfigStepStore.getState().actions.updateConfigStep(content);
            console.log(
              `✅ CONFIG UPDATE: Config store updated, current data:`,
              useConfigStepStore.getState().data
            );
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
            console.warn('StepStore: Could not get workspace ID from app store:', error);
          }
        }

        if (!currentWorkspaceId) {
          console.warn(
            'StepStore: No current workspace - cannot update step content. Please select a workspace first.'
          );
          return;
        }

        console.log(
          `🔄 StepStore: Updating ${step} step content for workspace:`,
          currentWorkspaceId
        );

        try {
          set({ hasUnsavedChanges: true, currentWorkspaceId });

          // CRITICAL FIX: Get the complete updated state from the individual store
          // instead of using the partial content. This prevents data loss during persistence.
          let completeStepData;
          switch (step) {
            case 'input':
              completeStepData = useInputStepStore.getState().data;
              break;
            case 'config':
              completeStepData = useConfigStepStore.getState().data;
              break;
            case 'processing':
              completeStepData = useProcessingStepStore.getState().data;
              break;
            case 'review':
              completeStepData = useReviewStepStore.getState().data;
              break;
            case 'export':
              completeStepData = useExportStepStore.getState().data;
              break;
            default:
              completeStepData = content;
          }

          console.log(`🔄 StepStore: Persisting complete ${step} step data:`, completeStepData);

          // Persist complete step data to main process to prevent field loss
          await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
            'step:updateContent',
            currentWorkspaceId,
            step,
            completeStepData
          );
          console.log(
            `✅ StepStore: ${step} step content updated for workspace:`,
            currentWorkspaceId
          );
        } catch (error) {
          console.error(`❌ StepStore: Failed to update ${step} step content:`, error);
          set({
            error: error instanceof Error ? error.message : 'Failed to update step content',
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
          await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
            'step:resetContent',
            currentWorkspaceId,
            step
          );

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
            error: error instanceof Error ? error.message : 'Failed to reset step content',
          });
        }
      },

      loadStepContent: async (workspaceId: string, step: StepType) => {
        try {
          set({ isLoading: true, error: null });

          console.log(`🔄 StepStore: Loading ${step} step content for workspace:`, workspaceId);

          const content = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
            'step:getContent',
            workspaceId,
            step
          );

          if (content) {
            // Validate step content before updating
            const validation = validateStepContent(step, content);
            if (!validation.isValid) {
              console.warn(`⚠️ Invalid ${step} step content:`, validation.errors);
              // Still load the content but log warnings
            }
            if (validation.warnings.length > 0) {
              console.warn(`⚠️ ${step} step content warnings:`, validation.warnings);
            }

            console.log(`✅ Loaded ${step} step content:`, content);

            // Update the individual store - this will trigger sync back to main store
            switch (step) {
              case 'input':
                useInputStepStore.getState().actions.updateInputStep(content);
                break;
              case 'config':
                await useConfigStepStore.getState().actions.updateConfigStep(content);
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
          } else {
            console.log(`ℹ️ No ${step} step content found for workspace:`, workspaceId);
          }

          set({ isLoading: false });
        } catch (error) {
          console.error(`Failed to load ${step} step content:`, error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : `Failed to load ${step} step content`,
          });
        }
      },

      loadAllStepContent: async (workspaceId: string) => {
        await safeWorkspaceOperation(async () => {
          set({ isLoading: true, error: null });
          console.log('🔄 StepStore: Loading all step content for workspace:', workspaceId);

          // CRITICAL: Reset all step stores to defaults before loading workspace-specific content
          // This ensures complete workspace isolation and prevents data contamination between workspaces
          console.log('🔄 StepStore: Resetting all step stores to ensure workspace isolation...');
          try {
            // Reset all stores synchronously and wait for completion
            const resetPromises = [
              Promise.resolve(useInputStepStore.getState().actions.resetInputStep()),
              Promise.resolve(useConfigStepStore.getState().actions.resetConfigStep()),
              Promise.resolve(useProcessingStepStore.getState().actions.resetProcessingStep()),
              Promise.resolve(useReviewStepStore.getState().actions.resetReviewStep()),
              Promise.resolve(useExportStepStore.getState().actions.resetExportStep()),
            ];

            await Promise.all(resetPromises);

            // Give a small delay to ensure all state updates have propagated
            await new Promise((resolve) => setTimeout(resolve, 10));

            console.log(
              '✅ StepStore: All step stores reset to defaults and ready for workspace loading'
            );
          } catch (resetError) {
            console.error('❌ StepStore: Failed to reset step stores:', resetError);
            throw new Error(
              `Failed to reset step stores for workspace isolation: ${resetError instanceof Error ? resetError.message : 'Unknown error'}`
            );
          }

          const stepTypes: StepType[] = ['input', 'config', 'processing', 'review', 'export'];

          // Load all steps in parallel for better performance
          const loadPromises = stepTypes.map(async (step) => {
            try {
              const content = await (
                window as unknown as ElectronWindow
              ).electron.ipcRenderer.invoke('step:getContent', workspaceId, step);

              if (content) {
                // Validate step content before updating
                const validation = validateStepContent(step, content);
                if (!validation.isValid) {
                  console.warn(`⚠️ Invalid ${step} step content:`, validation.errors);
                  // Continue loading but track validation issues
                }
                if (validation.warnings.length > 0) {
                  console.warn(`⚠️ ${step} step content warnings:`, validation.warnings);
                }

                console.log(
                  `✅ StepStore: Loaded ${step} step content for workspace ${workspaceId}`,
                  content
                );

                // Update the individual store with workspace context
                switch (step) {
                  case 'input':
                    useInputStepStore.getState().actions.updateInputStep(content);
                    break;
                  case 'config':
                    await useConfigStepStore.getState().actions.updateConfigStep(content);
                    break;
                  case 'processing':
                    useProcessingStepStore.getState().actions.updateProcessingStep(content);
                    break;
                  case 'review':
                    useReviewStepStore.getState().actions.updateReviewStep(content);
                    break;
                  case 'export':
                    useExportStepStore.getState().actions.updateExportStep(content);
                    // Also load workspace-specific export persistence data (format, history, preferences)
                    await useExportStepStore.getState().actions.loadWorkspacePersistenceData(workspaceId);
                    break;
                }
              }

              return { step, success: true, content };
            } catch (stepError) {
              console.warn(`⚠️ Failed to load ${step} step content:`, stepError);
              return { step, success: false, error: stepError };
            }
          });

          const results = await Promise.all(loadPromises);
          const failedSteps = results.filter((r) => !r.success);

          if (failedSteps.length > 0) {
            console.warn(
              `⚠️ Some steps failed to load:`,
              failedSteps.map((f) => f.step)
            );
          }

          // Validate workspace isolation by checking that stores don't have stale data
          try {
            const inputData = useInputStepStore.getState().data;
            const configData = useConfigStepStore.getState().data;
            const reviewData = useReviewStepStore.getState().data;

            console.log('🔍 StepStore: Validating workspace isolation for workspace:', workspaceId);
            console.log('🔍 Current step store states after loading:');
            console.log('  - Input lastModified:', inputData.lastModified);
            console.log('  - Config lastModified:', configData.lastModified);
            console.log('  - Review has subtitles:', reviewData.subtitles?.length || 0);

            console.log('✅ StepStore: Workspace isolation validation passed');
          } catch (validationError) {
            console.warn('⚠️ StepStore: Workspace isolation validation failed:', validationError);
          }

          set({
            isLoading: false,
            currentWorkspaceId: workspaceId,
          });

          console.log(
            '✅ StepStore: All step content loading completed for workspace:',
            workspaceId
          );
          console.log(
            '✅ StepStore: Workspace',
            workspaceId,
            'is now isolated with its own configuration'
          );
        }, `load all step content for workspace ${workspaceId}`);
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
            steps.map((step) =>
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
            hasUnsavedChanges: false,
          });
        } catch (error) {
          console.error('Failed to save all changes:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to save changes',
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
            steps.map((step) =>
              (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
                'step:getContent',
                currentWorkspaceId,
                step
              )
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
            hasUnsavedChanges: false,
          });
        } catch (error) {
          console.error('Failed to discard changes:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to discard changes',
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
      },
    },
  };
});

// ============================================================================
// IPC EVENT LISTENERS FOR REAL-TIME SYNC
// ============================================================================

// Initialize IPC listeners with enhanced defensive checks
if (typeof window !== 'undefined' && (window as unknown as ElectronWindow).electron?.ipcRenderer) {
  // Step content updated event - delegate to individual stores
  (window as unknown as ElectronWindow).electron.ipcRenderer.on(
    'step:contentUpdated',
    async (_event, { workspaceId, stepName, content }) => {
      const currentWorkspaceId = useStepStore.getState().currentWorkspaceId;

      // Only update if this is for the current workspace
      if (workspaceId !== currentWorkspaceId) {
        return; // No change needed - wrong workspace
      }

      // Delegate to individual stores - this will automatically sync back to main store
      switch (stepName) {
        case 'input':
          useInputStepStore.getState().actions.updateInputStep(content as Partial<InputStepData>);
          break;
        case 'config':
          await useConfigStepStore
            .getState()
            .actions.updateConfigStep(content as Partial<ConfigStepData>);
          break;
        case 'processing':
          useProcessingStepStore
            .getState()
            .actions.updateProcessingStep(content as Partial<ProcessingStepData>);
          break;
        case 'review':
          useReviewStepStore
            .getState()
            .actions.updateReviewStep(content as Partial<ReviewStepData>);
          break;
        case 'export':
          useExportStepStore
            .getState()
            .actions.updateExportStep(content as Partial<ExportStepData>);
          break;
      }
    }
  );
}

// ============================================================================
// HELPER HOOKS AND SELECTORS
// ============================================================================

// Hooks to get specific step content - use main store for consistency
export const useInputStepContent = () => useStepStore((state) => state.inputStep);
export const useConfigStepContent = () => useStepStore((state) => state.configStep);
export const useProcessingStepContent = () => useStepStore((state) => state.processingStep);
export const useReviewStepContent = () => useStepStore((state) => state.reviewStep);
export const useExportStepContent = () => useStepStore((state) => state.exportStep);

// Hook to get step content by step type
export const useStepContent = <T>(step: StepType) =>
  useStepStore((state) => state[`${step}Step` as keyof StepContentState] as T);

// Hook to get step actions
export const useStepActions = () => {
  const actions = useStepStore((state) => state.actions);
  return React.useMemo(() => actions, [actions]);
};

// Hook to get step loading state
export const useStepLoading = () => useStepStore((state) => state.isLoading);

// Hook to get step error state
export const useStepError = () => useStepStore((state) => state.error);

// Hook to check if there are unsaved changes
export const useHasUnsavedChanges = () => useStepStore((state) => state.hasUnsavedChanges);

// Specific content selectors for common use cases
export const useSelectedFiles = () => useStepStore((state) => state.inputStep.selectedFiles);
export const useInputFile = () =>
  useStepStore((state) => state.inputStep.inputFile || state.inputStep.selectedFile);
export const useSelectedRange = () => useStepStore((state) => state.inputStep.selectedRange);
export const useTimeRange = () => {
  const inputStep = useStepStore((state) => state.inputStep);

  return React.useMemo(
    () => ({
      startTime: inputStep.startTime,
      endTime: inputStep.endTime,
      duration: inputStep.duration,
      selectedRange: inputStep.selectedRange,
    }),
    [inputStep.startTime, inputStep.endTime, inputStep.duration, inputStep.selectedRange]
  );
};
export const useVideoMetadata = () => useStepStore((state) => state.inputStep.mediaMetadata);
export const useModelSettings = () => useStepStore((state) => state.configStep.modelSettings);
export const useProcessingStatus = () => useStepStore((state) => state.processingStep.status);
export const useProcessingProgress = () => useStepStore((state) => state.processingStep.progress);
export const useSubtitles = () => useStepStore((state) => state.reviewStep.subtitles);
export const useExportFormat = () => useStepStore((state) => state.exportStep.format);

// Hook to get validation state
export const useConfigValidation = () => {
  const configStep = useStepStore((state) => state.configStep);

  return React.useMemo(
    () => ({
      isValid: configStep.isValid,
      errors: configStep.validationErrors,
    }),
    [configStep.isValid, configStep.validationErrors]
  );
};

// Hook to get processing logs
export const useProcessingLogs = () => useStepStore((state) => state.processingStep.logs);

// Hook to get export history
export const useExportHistory = () => useStepStore((state) => state.exportStep.exportHistory);

// Hook to get CLI arguments for subtitle generation
export const useConfigAsCliArgs = () => useStepStore((state) => state.actions.getConfigAsCliArgs);

// ============================================================================
// EXPORT-SPECIFIC HOOKS
// ============================================================================

// Export state selectors - use centralized store for consistency
// NOTE: These hooks access export data through the centralized store for consistency,
// while the individual export store handles its own internal operations
export const useExportPreviewState = () => useStepStore((state) => state.exportStep.previewState);
export const useExportActionsState = () => useStepStore((state) => state.exportStep.actionsState);
export const useExportHighlightConfig = () => useStepStore((state) => state.exportStep.highlightConfig);
export const useExportValidationIssues = () => useStepStore((state) => state.exportStep.validationIssues);
export const useExportHistoryGrouping = () => useStepStore((state) => state.exportStep.historyGrouping);
export const useExportPreviewContent = () => useStepStore((state) => state.exportStep.previewContent);

export const useExportUserSelections = () => {
  const exportStep = useStepStore((state) => state.exportStep);
  return React.useMemo(
    () => ({
      selectedLanguages: exportStep.selectedLanguages || ['original'],
      includeMetadata: exportStep.includeMetadata || false,
      showTimestamps: exportStep.showTimestamps || false,
      customOutputPath: exportStep.customOutputPath || '',
    }),
    [
      exportStep.selectedLanguages,
      exportStep.includeMetadata,
      exportStep.showTimestamps,
      exportStep.customOutputPath,
    ]
  );
};

export const useExportStatus = () => {
  const exportStep = useStepStore((state) => state.exportStep);
  return React.useMemo(
    () => ({
      isExporting: exportStep.isExporting,
      exportProgress: exportStep.exportProgress,
      lastExportError: exportStep.lastExportError,
    }),
    [exportStep.isExporting, exportStep.exportProgress, exportStep.lastExportError]
  );
};

// Export actions selectors - delegate to individual export store
export const useExportActions = () => {
  const actions = useStepStore((state) => state.actions);

  return React.useMemo(
    () => ({
      updateExportFormat: actions.updateExportFormat,
      updateExportSettings: actions.updateExportSettings,
      updatePreviewState: actions.updatePreviewState,
      updateActionsState: actions.updateActionsState,
      updateHighlightConfig: actions.updateHighlightConfig,
      setPreviewContent: actions.setPreviewContent,
      updateUserSelections: actions.updateUserSelections,
      addExportRecord: actions.addExportRecord,
      removeExportRecord: actions.removeExportRecord,
      removeFromHistory: actions.removeFromHistory,
      clearHistory: actions.clearHistory,
      setExportingState: actions.setExportingState,
      generatePreviewContent: actions.generatePreviewContent,
    }),
    [actions]
  );
};

// Combined export hook for components - use centralized store for consistency
export const useExportStepComplete = () => {
  const exportStep = useExportStepContent();
  const actions = useExportActions();

  return React.useMemo(
    () => ({
      ...exportStep,
      actions,
    }),
    [exportStep, actions]
  );
};
