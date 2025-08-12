import { create } from 'zustand';
import { ExportStepData, Subtitle } from '../types/StoreTypes';
import { formatSRTTime, formatVTTTime, formatTime } from './utils';

interface ExportStepState {
  data: ExportStepData;
  actions: {
    updateExportStep: (content: Partial<ExportStepData>) => void;
    resetExportStep: () => void;
    updateExportFormat: (format: string) => void;
    updateExportSettings: (settings: Partial<ExportStepData['exportSettings']>) => void;
    updatePreviewState: (previewState: Partial<ExportStepData['previewState']>) => void;
    updateActionsState: (actionsState: Partial<ExportStepData['actionsState']>) => void;
    updateHighlightConfig: (highlightConfig: Partial<ExportStepData['highlightConfig']>) => void;
    setPreviewContent: (content: string) => void;
    updateUserSelections: (selections: {
      selectedLanguages?: string[];
      includeMetadata?: boolean;
      showTimestamps?: boolean;
      customOutputPath?: string;
    }) => void;
    addExportRecord: (record: Omit<ExportStepData['exportHistory'][0], 'id'>) => void;
    removeExportRecord: (recordId: string) => void;
    removeFromHistory: (index: number) => void;
    clearHistory: () => void;
    setExportingState: (isExporting: boolean, progress?: number, error?: string) => void;
    generatePreviewContent: (subtitles: Subtitle[]) => Promise<void>;
  };
}

const defaultExportStepData: ExportStepData = {
  // Core Export Configuration
  format: 'srt',
  outputPath: undefined,
  exportSettings: {
    includeTimecodes: true,
    charset: 'utf-8',
    translation: false,
    lineBreaks: 'auto',
    maxLineLength: undefined
  },
  exportHistory: [],
  isExporting: false,
  exportProgress: undefined,
  lastExportError: undefined,
  
  // UI State Management
  previewState: {
    fullscreenOpen: false,
    copySnackbar: false,
    showLineNumbers: true
  },
  actionsState: {
    showMultiFormatDialog: false,
    selectedFormats: [],
    snackbarOpen: false
  },
  highlightConfig: {
    language: 'srt',
    showLineNumbers: true
  },
  validationIssues: {},
  historyGrouping: {},
  
  // Generated Content
  previewContent: undefined,
  lastGenerated: undefined,
  
  // Persistent User Selections
  selectedLanguages: ['original'],
  includeMetadata: false,
  showTimestamps: true,
  customOutputPath: undefined,
  lastModified: Date.now()
};

export const useExportStepStore = create<ExportStepState>((set, get) => ({
  data: defaultExportStepData,
  
  actions: {
    updateExportStep: (content: Partial<ExportStepData>) => {
      set(state => ({
        data: {
          ...state.data,
          ...content,
          lastModified: Date.now()
        }
      }));
    },

    resetExportStep: () => {
      set({ data: { ...defaultExportStepData, lastModified: Date.now() } });
    },

    updateExportFormat: (format: string) => {
      set(state => ({
        data: {
          ...state.data,
          format,
          highlightConfig: {
            ...state.data.highlightConfig,
            language: format
          },
          lastModified: Date.now()
        }
      }));
    },

    updateExportSettings: (settings: Partial<ExportStepData['exportSettings']>) => {
      set(state => ({
        data: {
          ...state.data,
          exportSettings: {
            ...state.data.exportSettings,
            ...settings
          },
          lastModified: Date.now()
        }
      }));
    },

    updatePreviewState: (previewState: Partial<ExportStepData['previewState']>) => {
      set(state => ({
        data: {
          ...state.data,
          previewState: {
            ...state.data.previewState,
            ...previewState
          }
        }
      }));
    },

    updateActionsState: (actionsState: Partial<ExportStepData['actionsState']>) => {
      set(state => ({
        data: {
          ...state.data,
          actionsState: {
            ...state.data.actionsState,
            ...actionsState
          }
        }
      }));
    },

    updateHighlightConfig: (highlightConfig: Partial<ExportStepData['highlightConfig']>) => {
      set(state => ({
        data: {
          ...state.data,
          highlightConfig: {
            ...state.data.highlightConfig,
            ...highlightConfig
          }
        }
      }));
    },

    setPreviewContent: (content: string) => {
      set(state => ({
        data: {
          ...state.data,
          previewContent: content,
          lastGenerated: Date.now()
        }
      }));
    },

    updateUserSelections: (selections: {
      selectedLanguages?: string[];
      includeMetadata?: boolean;
      showTimestamps?: boolean;
      customOutputPath?: string;
    }) => {
      set(state => ({
        data: {
          ...state.data,
          ...selections,
          lastModified: Date.now()
        }
      }));
    },

    addExportRecord: (record: Omit<ExportStepData['exportHistory'][0], 'id'>) => {
      const id = `export_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      set(state => ({
        data: {
          ...state.data,
          exportHistory: [
            { id, ...record },
            ...state.data.exportHistory
          ].slice(0, 50), // Keep only last 50 exports
          lastModified: Date.now()
        }
      }));
    },

    removeExportRecord: (recordId: string) => {
      set(state => ({
        data: {
          ...state.data,
          exportHistory: state.data.exportHistory.filter(r => r.id !== recordId),
          lastModified: Date.now()
        }
      }));
    },

    removeFromHistory: (index: number) => {
      set(state => ({
        data: {
          ...state.data,
          exportHistory: state.data.exportHistory.filter((_, i) => i !== index),
          lastModified: Date.now()
        }
      }));
    },

    clearHistory: () => {
      set(state => ({
        data: {
          ...state.data,
          exportHistory: [],
          lastModified: Date.now()
        }
      }));
    },

    setExportingState: (isExporting: boolean, progress?: number, error?: string) => {
      set(state => ({
        data: {
          ...state.data,
          isExporting,
          exportProgress: progress,
          lastExportError: error
        }
      }));
    },

    generatePreviewContent: async (subtitles: Subtitle[]) => {
      const state = get();
      
      if (!subtitles.length) {
        set(prevState => ({
          data: {
            ...prevState.data,
            previewContent: '# No subtitles available\n\nPlease complete the transcription process first.',
            lastGenerated: Date.now()
          }
        }));
        return;
      }

      try {
        // Generate preview content based on format
        const { format, exportSettings, selectedLanguages, includeMetadata, showTimestamps } = state.data;
        let content = '';

        // Helper function to apply line breaks and max line length
        const formatText = (text: string): string => {
          if (exportSettings.lineBreaks === 'manual' && exportSettings.maxLineLength) {
            const words = text.split(' ');
            const lines: string[] = [];
            let currentLine = '';

            for (const word of words) {
              if (currentLine.length + word.length + 1 <= exportSettings.maxLineLength) {
                currentLine += (currentLine ? ' ' : '') + word;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              }
            }
            if (currentLine) lines.push(currentLine);
            return lines.join('\n');
          }
          return text;
        };

        switch (format.toLowerCase()) {
          case 'srt':
            content = subtitles.map((sub, index) => {
              let result = `${index + 1}\n`;
              
              // Add timecodes if enabled
              if (exportSettings.includeTimecodes) {
                const startTime = formatSRTTime(sub.startTime);
                const endTime = formatSRTTime(sub.endTime);
                result += `${startTime} --> ${endTime}\n`;
              }
              
              let text = sub.text;
              
              // Add translation if enabled
              if ((exportSettings.translation || selectedLanguages.includes('translation')) && sub.translation) {
                text += `\n${sub.translation}`;
              }
              
              // Add metadata if requested
              if (includeMetadata && sub.confidence) {
                text += `\n[Confidence: ${Math.round(sub.confidence * 100)}%]`;
              }
              
              // Apply line breaks and length formatting
              text = formatText(text);
              result += `${text}\n`;
              
              return result;
            }).join('\n');
            break;

          case 'vtt':
            content = 'WEBVTT\n\n' + subtitles.map(sub => {
              let result = '';
              
              // Add timecodes if enabled
              if (exportSettings.includeTimecodes) {
                const startTime = formatVTTTime(sub.startTime);
                const endTime = formatVTTTime(sub.endTime);
                result += `${startTime} --> ${endTime}\n`;
              }
              
              let text = sub.text;
              
              // Add translation if enabled
              if ((exportSettings.translation || selectedLanguages.includes('translation')) && sub.translation) {
                text += `\n${sub.translation}`;
              }
              
              // Apply line breaks and length formatting
              text = formatText(text);
              result += `${text}\n`;
              
              return result;
            }).join('\n');
            break;

          case 'txt':
            content = subtitles.map(sub => {
              let text = '';
              
              // Add timestamps if enabled
              if (showTimestamps || exportSettings.includeTimecodes) {
                text += `[${formatTime(sub.startTime)}] `;
              }
              
              text += sub.text;
              
              // Add translation if enabled
              if ((exportSettings.translation || selectedLanguages.includes('translation')) && sub.translation) {
                text += ` (${sub.translation})`;
              }
              
              // Apply line breaks and length formatting
              return formatText(text);
            }).join('\n');
            break;

          default:
            content = '# Unsupported format\n\nPreview not available for this format.';
        }

        set(prevState => ({
          data: {
            ...prevState.data,
            previewContent: content,
            lastGenerated: Date.now()
          }
        }));

      } catch (error) {
        console.error('Failed to generate preview:', error);
        set(prevState => ({
          data: {
            ...prevState.data,
            previewContent: '# Error generating preview\n\nPlease try again.',
            lastGenerated: Date.now()
          }
        }));
      }
    }
  }
}));

// Selectors
export const useExportStepData = () => useExportStepStore(state => state.data);
export const useExportStepActions = () => useExportStepStore(state => state.actions);
export const useExportFormat = () => useExportStepStore(state => state.data.format);
export const useExportPreviewState = () => useExportStepStore(state => state.data.previewState);
export const useExportActionsState = () => useExportStepStore(state => state.data.actionsState);
export const useExportHighlightConfig = () => useExportStepStore(state => state.data.highlightConfig);
export const useExportValidationIssues = () => useExportStepStore(state => state.data.validationIssues);
export const useExportHistoryGrouping = () => useExportStepStore(state => state.data.historyGrouping);
export const useExportPreviewContent = () => useExportStepStore(state => state.data.previewContent);
export const useExportHistory = () => useExportStepStore(state => state.data.exportHistory);
export const useExportUserSelections = () => useExportStepStore(state => ({
  selectedLanguages: state.data.selectedLanguages,
  includeMetadata: state.data.includeMetadata,
  showTimestamps: state.data.showTimestamps,
  customOutputPath: state.data.customOutputPath
}));
export const useExportStatus = () => useExportStepStore(state => ({
  isExporting: state.data.isExporting,
  exportProgress: state.data.exportProgress,
  lastExportError: state.data.lastExportError
}));

// Combined export hook for components
export const useExportStepComplete = () => {
  const data = useExportStepData();
  const actions = useExportStepActions();
  
  return {
    ...data,
    actions
  };
};