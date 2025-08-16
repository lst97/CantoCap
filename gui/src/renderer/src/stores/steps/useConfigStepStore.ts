import { create } from 'zustand';
import { ConfigStepData, ProcessingLanguage, WhisperModel, ElectronWindow } from '../types/StoreTypes';

interface ConfigStepState {
  data: ConfigStepData;
  actions: {
    updateConfigStep: (content: Partial<ConfigStepData>) => Promise<void>;
    resetConfigStep: () => void;
    setModel: (model: string) => Promise<void>;
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
  subtitle: null, // No translation by default
  geminiKey: undefined,
  speakers: false,
  written: false,
  music: false,

  // Additional CLI args fields
  priority: 'balanced',
  noGeminiRefinement: false,
  maxChunkDuration: 15, // Legacy large file chunking (minutes)
  videoQuality: '360p',
  terminologyConfig: undefined,
  ffmpegPath: undefined,
  verbose: false,
  
  // New adaptive chunking fields
  enableAdaptiveChunking: true, // Enable by default
  whisperChunkDuration: 30, // seconds
  geminiChunkDuration: 900, // seconds (15 minutes)
  
  // Structured settings
  modelSettings: {
    whisperModel: 'openai/whisper-medium',
    enableGemini: false,
    temperature: 0.1
  },
  apiKeys: {},
  advancedSettings: {
    chunkDuration: 30, // Legacy field for backward compatibility
    numWorkers: 4,
    enableSpeakerDiarization: false,
    enableMusicDetection: false,
    // New adaptive chunking strategy
    chunkingStrategy: {
      whisperChunkDuration: 30,
      whisperOverlap: 5,
      geminiChunkDuration: 900,
      geminiOverlap: 30
    }
  },
  isValid: false,
  validationErrors: []
};

export const useConfigStepStore = create<ConfigStepState>((set, get) => ({
  data: defaultConfigStepData,
  
  actions: {
    updateConfigStep: async (content: Partial<ConfigStepData>) => {
      console.log(`🔄 UPDATE CONFIG: Updating config with:`, content);
      
      // Migrate legacy data: if 'model' field exists, move it to modelSettings.whisperModel
      const migratedContent = { ...content };
      if ('model' in migratedContent && (migratedContent as any).model) {
        const legacyModel = (migratedContent as any).model;
        console.log(`🔄 CONFIG STORE MIGRATION: Found legacy model field:`, legacyModel);
        
        if (!migratedContent.modelSettings) {
          migratedContent.modelSettings = { 
            whisperModel: legacyModel,
            enableGemini: false,
            temperature: 0.1
          };
        } else {
          migratedContent.modelSettings = {
            ...migratedContent.modelSettings,
            whisperModel: legacyModel
          };
        }
        
        // Remove the legacy field
        delete (migratedContent as any).model;
        console.log(`✅ CONFIG STORE MIGRATION: Migrated to modelSettings.whisperModel:`, migratedContent.modelSettings.whisperModel);
      }

      // Update the store only - persistence is handled by useStepStore
      set(state => ({
        data: { 
          ...state.data, 
          ...migratedContent, 
          lastModified: Date.now() 
        }
      }));

      // NOTE: Persistence is handled by useStepStore.updateStepContent()
      // No need to persist here to avoid double persistence and infinite loops
    },

    resetConfigStep: () => {
      console.log('🔄 CONFIG STORE: Resetting config step to defaults for workspace isolation');
      set({ 
        data: { 
          ...defaultConfigStepData,
          lastModified: Date.now(),
          // Ensure all object references are completely new
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
          validationErrors: []
        } 
      });
      console.log('✅ CONFIG STORE: Reset completed');
    },

    setModel: (model: string) => {
      // Update the store only - persistence is handled by useStepStore
      set(state => ({
        data: {
          ...state.data,
          modelSettings: {
            ...state.data.modelSettings,
            whisperModel: model as WhisperModel
          },
          lastModified: Date.now()
        }
      }));
    },

    setLanguage: (language: string) => {
      // Update the store only - persistence is handled by useStepStore
      set(state => ({
        data: { ...state.data, language: language as ProcessingLanguage, lastModified: Date.now() }
      }));
    },

    setCharset: (charset: string) => {
      // Update the store only - persistence is handled by useStepStore
      set(state => ({
        data: { ...state.data, charset: charset as "traditional" | "simplified", lastModified: Date.now() }
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
      if (config.modelSettings?.whisperModel) {
        args.push('--model', config.modelSettings.whisperModel);
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

      // Adaptive chunking parameters
      if (config.enableAdaptiveChunking) {
        args.push('--enable-adaptive-chunking');
      }
      
      
      if (config.whisperChunkDuration && config.whisperChunkDuration !== 30) {
        args.push('--whisper-chunk-duration', String(config.whisperChunkDuration));
      }
      
      if (config.geminiChunkDuration && config.geminiChunkDuration !== 900) {
        args.push('--gemini-chunk-duration', String(Math.round(config.geminiChunkDuration / 60))); // Convert to minutes
      }
      
      // Advanced chunking strategy (send as JSON if configured)
      if (config.advancedSettings?.chunkingStrategy) {
        const strategy = config.advancedSettings.chunkingStrategy;
        // Only send if it differs from defaults
        const isDefault = strategy.whisperChunkDuration === 30 && 
                         strategy.whisperOverlap === 5 && 
                         strategy.geminiChunkDuration === 900 && 
                         strategy.geminiOverlap === 30;
        
        if (!isDefault) {
          args.push('--chunking-strategy', JSON.stringify(strategy));
        }
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