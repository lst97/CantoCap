import { create } from 'zustand';
import { ProcessingStepData, ElectronWindow, StepStatus, ProcessingStatistics } from '../types/StoreTypes';
import type { CantocapSubtitleData, SubtitleStatistics } from '../../../../types/SubtitleTypes';

interface ProcessingStepState {
  data: ProcessingStepData;
  actions: {
    updateProcessingStep: (content: Partial<ProcessingStepData>) => void;
    resetProcessingStep: () => void;
    setStatus: (status: ProcessingStepData['status']) => void;
    setProgress: (progress: number) => void;
    setCurrentPhase: (phase: string | undefined) => void;
    addLog: (log: string) => void;
    setLogs: (logs: string[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHardwareInfo: (info: any) => void;
    setStartTime: (time: string) => void;
    setEndTime: (time: string) => void;
    setEstimatedTimeRemaining: (time: number | undefined) => void;
    cancel: () => Promise<void>;
    startProcessing: (initialData?: Partial<ProcessingStepData>) => void;
    updateStatusFromEvent: (eventData: {
      status?: 'idle' | 'running' | 'completed' | 'error';
      progress?: number;
      phase?: string;
      message?: string;
      error?: string;
    }) => void;
  };
}

const defaultProcessingStepData: ProcessingStepData = {
  status: 'idle',
  progress: 0,
  currentPhase: undefined,
  logs: [],
  hardwareInfo: undefined,
  startTime: undefined,
  endTime: undefined,
  estimatedTimeRemaining: undefined
};

// Helper function to safely convert statistics to ProcessingStatistics
const convertToProcessingStatistics = (statistics: ProcessingStatistics | SubtitleStatistics | unknown): ProcessingStatistics | undefined => {
  if (!statistics || typeof statistics !== 'object') {
    return undefined;
  }

  // If it's already ProcessingStatistics, return as-is
  if ('quality_score' in statistics || 'processing_time' in statistics) {
    return statistics as ProcessingStatistics;
  }

  // If it's SubtitleStatistics, convert to ProcessingStatistics format
  if ('totalSubtitles' in statistics && 'totalDuration' in statistics && 'averageConfidence' in statistics) {
    const subtitleStats = statistics as SubtitleStatistics;
    return {
      subtitle_count: subtitleStats.totalSubtitles,
      processing_time: subtitleStats.totalDuration,
      quality_score: subtitleStats.averageConfidence
    };
  }

  // Unknown format, return undefined
  return undefined;
};

export const useProcessingStepStore = create<ProcessingStepState>((set, _get) => ({
  data: defaultProcessingStepData,
  
  actions: {
    updateProcessingStep: (content: Partial<ProcessingStepData>) => {
      set(state => {
        // CRITICAL FIX: Prevent status regression from 'completed' or 'error' back to 'running'
        // This prevents timer updates from overriding completion status after processing finishes
        const currentStatus = state.data.status;
        const newStatus = content.status;
        
        if ((currentStatus === 'completed' || currentStatus === 'error') && 
            newStatus === 'running') {
          console.log(`⚠️ PROCESSING STORE: Prevented status regression from '${currentStatus}' to 'running'`);
          // Allow other updates but preserve the completion status
          const { status, ...otherContent } = content;
          return {
            data: { ...state.data, ...otherContent }
          };
        }
        
        // Also prevent updates that don't include status from affecting completed processing
        if ((currentStatus === 'completed' || currentStatus === 'error') && 
            !newStatus && Object.keys(content).length > 0) {
          // Only allow updates that don't interfere with completion state
          const allowedFields = ['endTime', 'jsonSubtitleData', 'originalJsonData', 'outputFile', 'statistics'];
          const filteredContent = Object.keys(content).reduce((acc, key) => {
            if (allowedFields.includes(key) || key === 'status') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (acc as any)[key] = (content as any)[key];
            } else {
              console.log(`⚠️ PROCESSING STORE: Blocked update to '${key}' on completed processing`);
            }
            return acc;
          }, {} as Partial<ProcessingStepData>);
          
          if (Object.keys(filteredContent).length === 0) {
            console.log(`⚠️ PROCESSING STORE: Blocked entire update on completed processing`);
            return state; // No changes
          }
          
          return {
            data: { ...state.data, ...filteredContent }
          };
        }
        
        return {
          data: { ...state.data, ...content }
        };
      });
    },

    // Start processing and update status
    startProcessing: (initialData?: Partial<ProcessingStepData>) => {
      console.log('🚀 PROCESSING STORE: Starting processing and updating status to running');
      set(state => ({
        data: {
          ...state.data,
          status: 'running',
          progress: 0,
          startTime: new Date().toISOString(),
          endTime: undefined,
          estimatedTimeRemaining: undefined,
          currentPhase: 'initializing',
          logs: [...state.data.logs, 'Processing started...'],
          ...initialData
        }
      }));
    },

    // Update status from IPC events - only persist critical state changes
    updateStatusFromEvent: (eventData: {
      status?: 'idle' | 'running' | 'completed' | 'error';
      progress?: number;
      phase?: string;
      message?: string;
      error?: string;
      jsonSubtitleData?: CantocapSubtitleData;
      statistics?: ProcessingStatistics | SubtitleStatistics | unknown;
      outputFile?: string;
      inputFile?: string;
    }) => {
      console.log('📡 PROCESSING STORE: Received IPC event update:', eventData);
      set(state => {
        const newLogs = [...state.data.logs];
        
        // Add logs for progress updates and critical events
        if (eventData.error) {
          newLogs.push(`Error: ${eventData.error}`);
        } else if (eventData.status === 'completed' && eventData.message) {
          newLogs.push(eventData.message);
        } else if (eventData.status === 'error' && eventData.message) {
          newLogs.push(eventData.message);
        } else if (eventData.message && eventData.phase) {
          // Add progress messages to recent activity
          newLogs.push(eventData.message);
        }

        // Convert statistics safely to ProcessingStatistics format
        const convertedStatistics = eventData.statistics ? convertToProcessingStatistics(eventData.statistics) : undefined;

        return {
          data: {
            ...state.data,
            ...(eventData.status && { status: eventData.status }),
            ...(eventData.progress !== undefined && { progress: eventData.progress }),
            ...(eventData.phase && { currentPhase: eventData.phase }),
            logs: newLogs,
            ...(eventData.jsonSubtitleData && { 
              jsonSubtitleData: eventData.jsonSubtitleData,
              // NEW: Preserve original JSON data for step 4 restore functionality
              // Only set originalJsonData if it hasn't been set yet (preserve immutability)
              ...(eventData.status === 'completed' && !state.data.originalJsonData && {
                originalJsonData: eventData.jsonSubtitleData
              })
            }),
            ...(convertedStatistics && { statistics: convertedStatistics }),
            ...(eventData.outputFile && { outputFile: eventData.outputFile }),
            ...(eventData.status === 'completed' && { 
              endTime: new Date().toISOString(),
              progress: 100 
            }),
            ...(eventData.status === 'error' && { 
              endTime: new Date().toISOString() 
            })
          }
        };
      });
    },

    resetProcessingStep: () => {
      console.log('🔄 PROCESSING STORE: Resetting processing step to defaults for workspace isolation');
      
      set(state => {
        const currentState = state;
        
        const newData = {
          ...defaultProcessingStepData,
          // Ensure all array references are completely new
          logs: [],
          status: 'idle' as const,
          progress: 0,
          currentPhase: undefined,
          hardwareInfo: undefined,
          startTime: undefined,
          endTime: undefined,
          estimatedTimeRemaining: undefined,
          // IMPORTANT: Preserve completed processing data for Step 4 access
          ...(currentState.data.status === 'completed' && {
            jsonSubtitleData: currentState.data.jsonSubtitleData,
            originalJsonData: currentState.data.originalJsonData,
            statistics: currentState.data.statistics,
            outputFile: currentState.data.outputFile
          })
        };
        
        console.log('✅ PROCESSING STORE: Reset completed, preserved completed data:', {
          preservedJsonData: !!newData.jsonSubtitleData,
          preservedOriginalData: !!newData.originalJsonData
        });
        
        return { data: newData };
      });
    },

    setStatus: (status: ProcessingStepData['status']) => {
      set(state => ({
        data: { ...state.data, status }
      }));
    },

    setProgress: (progress: number) => {
      set(state => ({
        data: { ...state.data, progress }
      }));
    },

    setCurrentPhase: (phase: string | undefined) => {
      set(state => ({
        data: { ...state.data, currentPhase: phase }
      }));
    },

    addLog: (log: string) => {
      set(state => ({
        data: {
          ...state.data,
          logs: [...state.data.logs, log]
        }
      }));
    },

    setLogs: (logs: string[]) => {
      set(state => ({
        data: { ...state.data, logs }
      }));
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHardwareInfo: (info: any) => {
      set(state => ({
        data: { ...state.data, hardwareInfo: info }
      }));
    },

    setStartTime: (time: string) => {
      set(state => ({
        data: { ...state.data, startTime: time }
      }));
    },

    setEndTime: (time: string) => {
      set(state => ({
        data: { ...state.data, endTime: time }
      }));
    },

    setEstimatedTimeRemaining: (time: number | undefined) => {
      set(state => ({
        data: { ...state.data, estimatedTimeRemaining: time }
      }));
    },

    cancel: async () => {
      try {
        await (window as unknown as ElectronWindow).cantocapAPI.processingCancel();
        
        // Reset processing state
        set(state => ({
          data: {
            ...state.data,
            status: 'idle',
            progress: 0,
            currentPhase: undefined,
            logs: [...state.data.logs, 'Transcription cancelled by user'],
            endTime: new Date().toISOString(),
            estimatedTimeRemaining: undefined
          }
        }));

        // Enhanced workflow state management for cancel functionality
        // We need to import this dynamically to avoid circular dependencies
        const { useWorkflowStore } = await import('../useWorkflowStore');
        const workflowActions = useWorkflowStore.getState().actions;
        
        // Set Step 3 (processing) to BLOCK status to disable it
        await workflowActions.setStepState('processing', StepStatus.BLOCK);
        console.log('✅ Processing step disabled (BLOCK status)');
        
        // Set Step 2 (config) back to READY status
        await workflowActions.setStepState('config', StepStatus.READY);
        console.log('✅ Config step set back to READY');
        
        // Ensure Step 1 remains accessible
        await workflowActions.setStepState('input', StepStatus.COMPLETE);
        console.log('✅ Input step maintained as COMPLETE');
        
        // Navigate back to Step 2 (config)
        await workflowActions.navigateToStep('config');
        console.log('✅ Navigated back to Step 2 (Config)');
        
      } catch (error) {
        console.error('Failed to cancel transcription:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to cancel transcription';
        
        set(state => ({
          data: {
            ...state.data,
            logs: [...state.data.logs, `Error: ${errorMessage}`]
          }
        }));
        
        throw error;
      }
    }
  }
}));

// Selectors
export const useProcessingStepData = () => useProcessingStepStore(state => state.data);
export const useProcessingStepActions = () => useProcessingStepStore(state => state.actions);
export const useProcessingStatus = () => useProcessingStepStore(state => state.data.status);
export const useProcessingProgress = () => useProcessingStepStore(state => state.data.progress);
export const useProcessingLogs = () => useProcessingStepStore(state => state.data.logs);
export const useProcessingPhase = () => useProcessingStepStore(state => state.data.currentPhase);
export const useProcessingTimeInfo = () => useProcessingStepStore(state => ({
  startTime: state.data.startTime,
  endTime: state.data.endTime,
  estimatedTimeRemaining: state.data.estimatedTimeRemaining
}));
export const useProcessingJsonData = () => useProcessingStepStore(state => state.data.jsonSubtitleData);
export const useProcessingOriginalJsonData = () => useProcessingStepStore(state => state.data.originalJsonData);
export const useProcessingStatistics = () => useProcessingStepStore(state => state.data.statistics);
export const useProcessingOutputFile = () => useProcessingStepStore(state => state.data.outputFile);