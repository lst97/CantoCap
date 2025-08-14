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

      // Update the store first
      set(state => ({
        data: { 
          ...state.data, 
          ...migratedContent, 
          lastModified: Date.now() 
        }
      }));

      // CRITICAL FIX: Call persistence directly to avoid circular dependency
      // Do NOT call useStepStore.updateStepContent() as it will call us back!
      try {
        const { useAppStore } = await import('../useAppStore');
        const workspaceId = useAppStore.getState().activeWorkspaceId;
        
        if (!workspaceId) {
          console.warn('CONFIG STORE: No active workspace - cannot persist config changes');
          return;
        }

        const updatedData = get().data;
        console.log(`💾 UPDATE CONFIG: Persisting directly to Electron with data:`, updatedData);
        
        // Call IPC directly to avoid circular dependency
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:updateContent', workspaceId, 'config', updatedData);
        console.log(`✅ UPDATE CONFIG: Successfully persisted config changes to Electron store`);
      } catch (error) {
        console.error(`❌ UPDATE CONFIG: Failed to persist config changes:`, error);
        throw error; // Re-throw to let calling code handle the error
      }
    },

    resetConfigStep: () => {
      set({ data: defaultConfigStepData });
    },

    setModel: async (model: string) => {
      console.log(`🔄 SET MODEL: Setting model to:`, model);
      
      // Update the store first
      set(state => {
        const newData = {
          ...state.data,
          modelSettings: {
            ...state.data.modelSettings,
            whisperModel: model as WhisperModel
          },
          lastModified: Date.now()
        };
        console.log(`✅ SET MODEL: Updated store data:`, newData);
        return { data: newData };
      });

      // Call persistence directly to avoid circular dependency
      try {
        const { useAppStore } = await import('../useAppStore');
        const workspaceId = useAppStore.getState().activeWorkspaceId;
        
        if (!workspaceId) {
          console.warn('SET MODEL: No active workspace - cannot persist model change');
          return;
        }

        const updatedData = get().data;
        console.log(`💾 SET MODEL: Persisting directly to Electron with data:`, updatedData);
        
        // Call IPC directly to avoid circular dependency
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:updateContent', workspaceId, 'config', updatedData);
        console.log(`✅ SET MODEL: Successfully persisted model change to Electron store`);
      } catch (error) {
        console.error(`❌ SET MODEL: Failed to persist model change:`, error);
      }
    },

    setLanguage: async (language: string) => {
      // Update the store first
      set(state => ({
        data: { ...state.data, language: language as ProcessingLanguage, lastModified: Date.now() }
      }));

      // Call persistence directly to avoid circular dependency
      try {
        const { useAppStore } = await import('../useAppStore');
        const workspaceId = useAppStore.getState().activeWorkspaceId;
        
        if (!workspaceId) {
          console.warn('SET LANGUAGE: No active workspace - cannot persist language change');
          return;
        }

        const updatedData = get().data;
        console.log(`💾 SET LANGUAGE: Persisting directly to Electron with data:`, updatedData);
        
        // Call IPC directly to avoid circular dependency
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:updateContent', workspaceId, 'config', updatedData);
        console.log(`✅ SET LANGUAGE: Successfully persisted language change to Electron store`);
      } catch (error) {
        console.error(`❌ SET LANGUAGE: Failed to persist language change:`, error);
      }
    },

    setCharset: async (charset: string) => {
      // Update the store first
      set(state => ({
        data: { ...state.data, charset: charset as "traditional" | "simplified", lastModified: Date.now() }
      }));

      // Call persistence directly to avoid circular dependency
      try {
        const { useAppStore } = await import('../useAppStore');
        const workspaceId = useAppStore.getState().activeWorkspaceId;
        
        if (!workspaceId) {
          console.warn('SET CHARSET: No active workspace - cannot persist charset change');
          return;
        }

        const updatedData = get().data;
        console.log(`💾 SET CHARSET: Persisting directly to Electron with data:`, updatedData);
        
        // Call IPC directly to avoid circular dependency
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('step:updateContent', workspaceId, 'config', updatedData);
        console.log(`✅ SET CHARSET: Successfully persisted charset change to Electron store`);
      } catch (error) {
        console.error(`❌ SET CHARSET: Failed to persist charset change:`, error);
      }
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