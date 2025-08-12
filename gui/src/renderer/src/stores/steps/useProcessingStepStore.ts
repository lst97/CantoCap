import { create } from 'zustand';
import { ProcessingStepData } from '../types/StoreTypes';

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
    setHardwareInfo: (info: any) => void;
    setStartTime: (time: string) => void;
    setEndTime: (time: string) => void;
    setEstimatedTimeRemaining: (time: number | undefined) => void;
    cancel: () => Promise<void>;
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

export const useProcessingStepStore = create<ProcessingStepState>((set, get) => ({
  data: defaultProcessingStepData,
  
  actions: {
    updateProcessingStep: (content: Partial<ProcessingStepData>) => {
      set(state => ({
        data: { ...state.data, ...content }
      }));
    },

    resetProcessingStep: () => {
      set({ data: defaultProcessingStepData });
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
        await (window as any).electron.ipcRenderer.invoke('processing:cancel');
        
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