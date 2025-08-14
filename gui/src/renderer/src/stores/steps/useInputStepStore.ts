import { create } from 'zustand';
import { InputStepData } from '../types/StoreTypes';

interface InputStepState {
  data: InputStepData;
  actions: {
    updateInputStep: (content: Partial<InputStepData>) => void;
    resetInputStep: () => void;
    setSelectedFile: (file: string | null) => void;
    setSelectedRange: (range: { start: number; end: number } | null) => void;
    setTimeRange: (startTime: number | null, endTime: number | null) => void;
    setDuration: (duration: number) => void;
    setMediaMetadata: (metadata: any) => void;
  };
}

const defaultInputStepData: InputStepData = {
  selectedFiles: [],
  fileValidation: {},
  dragDropState: false,
  selectedFile: null,
  inputFile: null,
  importedJsonFile: null,
  selectedRange: null,
  startTime: null,
  endTime: null,
  duration: 10.0,
  mediaMetadata: undefined,
  lastModified: Date.now(),
  currentFile: undefined,
  fileMetadata: undefined
};

export const useInputStepStore = create<InputStepState>((set, get) => ({
  data: defaultInputStepData,
  
  actions: {
    updateInputStep: (content: Partial<InputStepData>) => {
      set(state => ({
        data: {
          ...state.data,
          ...content,
          lastModified: Date.now()
        }
      }));
    },

    resetInputStep: () => {
      set({ data: { ...defaultInputStepData, lastModified: Date.now() } });
    },

    setSelectedFile: (file: string | null) => {
      set(state => ({
        data: {
          ...state.data,
          selectedFile: file,
          inputFile: file,
          lastModified: Date.now()
        }
      }));
    },

    setSelectedRange: (range: { start: number; end: number } | null) => {
      set(state => ({
        data: {
          ...state.data,
          selectedRange: range as any,
          lastModified: Date.now()
        }
      }));
    },

    setTimeRange: (startTime: number | null, endTime: number | null) => {
      set(state => ({
        data: {
          ...state.data,
          startTime,
          endTime,
          lastModified: Date.now()
        }
      }));
    },

    setDuration: (duration: number) => {
      set(state => ({
        data: {
          ...state.data,
          duration,
          lastModified: Date.now()
        }
      }));
    },

    setMediaMetadata: (metadata: any) => {
      set(state => ({
        data: {
          ...state.data,
          mediaMetadata: metadata,
          lastModified: Date.now()
        }
      }));
    }
  }
}));

// Selectors
export const useInputStepData = () => useInputStepStore(state => state.data);
export const useInputStepActions = () => useInputStepStore(state => state.actions);
export const useSelectedFiles = () => useInputStepStore(state => state.data.selectedFiles);
// Removed duplicate useInputFile - use the one from useStepStore instead to avoid conflicts
export const useSelectedRange = () => useInputStepStore(state => state.data.selectedRange);
export const useTimeRange = () => useInputStepStore(state => ({
  startTime: state.data.startTime,
  endTime: state.data.endTime,
  duration: state.data.duration,
  selectedRange: state.data.selectedRange
}));
export const useVideoMetadata = () => useInputStepStore(state => state.data.mediaMetadata);