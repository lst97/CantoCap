import { create } from 'zustand';
import { ConfigStepData, ProcessingLanguage, WhisperModel } from '../types/StoreTypes';

interface ConfigStepState {
  data: ConfigStepData;
  actions: {
    updateConfigStep: (content: Partial<ConfigStepData>) => void;
    resetConfigStep: () => void;
    setModel: (model: string) => void;
    setLanguage: (language: string) => void;
    setCharset: (charset: string) => void;
    setGeminiKey: (key: string | undefined) => void;
    setOutputFile: (file: string | null) => void;
    toggleSpeakers: (enabled: boolean) => void;
    toggleWritten: (enabled: boolean) => void;
    toggleMusic: (enabled: boolean) => void;
    updateModelSettings: (settings: Partial<ConfigStepData['modelSettings']>) => void;
    updateAdvancedSettings: (settings: Partial<ConfigStepData['advancedSettings']>) => void;
    setValidation: (isValid: boolean, errors: string[]) => void;
    getCliArgs: () => string[];
  };
}

const defaultConfigStepData: ConfigStepData = {
  // Core fields used by ConfigStep.tsx
  outputFile: null,
  inputFile: null,
  charset: 'traditional',
  language: 'zh' as const,
  model: 'openai/whisper-medium',
  subtitle: null, // No translation by default
  geminiKey: undefined,
  speakers: false,
  written: false,
  music: false,

  // Additional CLI args fields
  priority: 'balanced',
  noGeminiRefinement: false,
  maxChunkDuration: 15,
  videoQuality: '360p',
  terminologyConfig: undefined,
  ffmpegPath: undefined,
  verbose: false,
  
  // Structured settings
  modelSettings: {
    whisperModel: 'openai/whisper-medium',
    enableGemini: false,
    temperature: 0.1
  },
  apiKeys: {},
  advancedSettings: {
    chunkDuration: 30,
    numWorkers: 4,
    enableSpeakerDiarization: false,
    enableMusicDetection: false
  },
  isValid: false,
  validationErrors: []
};

export const useConfigStepStore = create<ConfigStepState>((set, get) => ({
  data: defaultConfigStepData,
  
  actions: {
    updateConfigStep: (content: Partial<ConfigStepData>) => {
      set(state => ({
        data: { ...state.data, ...content }
      }));
    },

    resetConfigStep: () => {
      set({ data: defaultConfigStepData });
    },

    setModel: (model: string) => {
      set(state => ({
        data: {
          ...state.data,
          model: model as WhisperModel,
          modelSettings: {
            ...state.data.modelSettings,
            whisperModel: model as WhisperModel
          }
        }
      }));
    },

    setLanguage: (language: string) => {
      set(state => ({
        data: { ...state.data, language: language as ProcessingLanguage }
      }));
    },

    setCharset: (charset: string) => {
      set(state => ({
        data: { ...state.data, charset: charset as "traditional" | "simplified" }
      }));
    },

    setGeminiKey: (key: string | undefined) => {
      set(state => ({
        data: {
          ...state.data,
          geminiKey: key,
          modelSettings: {
            ...state.data.modelSettings,
            enableGemini: !!key
          }
        }
      }));
    },

    setOutputFile: (file: string | null) => {
      set(state => ({
        data: { ...state.data, outputFile: file }
      }));
    },

    toggleSpeakers: (enabled: boolean) => {
      set(state => ({
        data: {
          ...state.data,
          speakers: enabled,
          advancedSettings: {
            ...state.data.advancedSettings,
            enableSpeakerDiarization: enabled
          }
        }
      }));
    },

    toggleWritten: (enabled: boolean) => {
      set(state => ({
        data: { ...state.data, written: enabled }
      }));
    },

    toggleMusic: (enabled: boolean) => {
      set(state => ({
        data: {
          ...state.data,
          music: enabled,
          advancedSettings: {
            ...state.data.advancedSettings,
            enableMusicDetection: enabled
          }
        }
      }));
    },

    updateModelSettings: (settings: Partial<ConfigStepData['modelSettings']>) => {
      set(state => ({
        data: {
          ...state.data,
          modelSettings: { ...state.data.modelSettings, ...settings }
        }
      }));
    },

    updateAdvancedSettings: (settings: Partial<ConfigStepData['advancedSettings']>) => {
      set(state => ({
        data: {
          ...state.data,
          advancedSettings: { ...state.data.advancedSettings, ...settings }
        }
      }));
    },

    setValidation: (isValid: boolean, errors: string[]) => {
      set(state => ({
        data: { ...state.data, isValid, validationErrors: errors }
      }));
    },

    getCliArgs: () => {
      const state = get();
      const config = state.data;
      const args: string[] = [];

      // Note: Input file will be added by the main useStepStore
      
      // Output file
      if (config.outputFile) {
        args.push('--output', config.outputFile);
      }

      // Language (only if not default 'zh')
      if (config.language && config.language !== 'zh') {
        args.push('--language', config.language);
      }

      // Model
      if (config.model) {
        args.push('--model', config.model);
      }

      // Priority (only if not default 'balanced')
      if (config.priority && config.priority !== 'balanced') {
        args.push('--priority', config.priority);
      }

      // Boolean flags
      if (config.speakers) args.push('--speakers');
      if (config.written) args.push('--written');
      if (config.music) args.push('--music');

      // Charset (only if not default 'traditional')
      if (config.charset && config.charset !== 'traditional') {
        args.push('--charset', config.charset);
      }

      // Gemini key
      if (config.geminiKey) {
        args.push('--gemini-key', config.geminiKey);
      }

      // No Gemini refinement
      if (config.noGeminiRefinement) {
        args.push('--no-gemini-refinement');
      }

      // Max chunk duration (only if not default 15)
      if (config.maxChunkDuration && config.maxChunkDuration !== 15) {
        args.push('--max-chunk-duration', String(config.maxChunkDuration));
      }

      // Video quality (only if not default '360p')
      if (config.videoQuality && config.videoQuality !== '360p') {
        args.push('--video-quality', config.videoQuality);
      }

      // Terminology config
      if (config.terminologyConfig) {
        args.push('--config', config.terminologyConfig);
      }

      // FFmpeg path
      if (config.ffmpegPath) {
        args.push('--ffmpeg-path', config.ffmpegPath);
      }

      // Translation subtitle (only if it's a string - language code)
      if (config.subtitle && typeof config.subtitle === 'string') {
        args.push('--subtitle', config.subtitle);
      }

      // Verbose
      if (config.verbose) {
        args.push('--verbose');
      }

      return args;
    }
  }
}));

// Selectors
export const useConfigStepData = () => useConfigStepStore(state => state.data);
export const useConfigStepActions = () => useConfigStepStore(state => state.actions);
export const useModelSettings = () => useConfigStepStore(state => state.data.modelSettings);
export const useConfigValidation = () => useConfigStepStore(state => ({
  isValid: state.data.isValid,
  errors: state.data.validationErrors
}));
export const useConfigAsCliArgs = () => useConfigStepStore(state => state.actions.getCliArgs);