import { create } from 'zustand';
import { ExportStepData, Subtitle } from '../types/StoreTypes';
import { formatSRTTime, formatVTTTime, formatTime } from './utils';
import {
  getLanguageContent,
  formatSRTText,
  formatVTTText,
  formatTXTText,
  formatJSONSubtitle,
  validateLanguageSelection,
  type LanguageSelection,
  type ExportFormat
} from './exportLanguageHelpers';

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
      console.log('🔄 EXPORT STORE: Resetting export step to defaults for workspace isolation');
      set({ 
        data: { 
          ...defaultExportStepData,
          lastModified: Date.now(),
          // Ensure all array and object references are completely new
          exportSettings: {
            includeTimecodes: true,
            charset: 'utf-8',
            translation: false,
            lineBreaks: 'auto',
            maxLineLength: undefined
          },
          exportHistory: [],
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
          selectedLanguages: ['original'],
          previewContent: undefined,
          lastGenerated: undefined
        } 
      });
      console.log('✅ EXPORT STORE: Reset completed');
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

      // Validate language selection
      const { selectedLanguages } = state.data;
      const languageValidation = validateLanguageSelection(
        subtitles, 
        selectedLanguages as LanguageSelection[]
      );
      
      if (!languageValidation.isValid) {
        const warningMessage = `# Export Warning\n\n${languageValidation.warnings.join('\n')}\n\nPlease adjust your language selections in the Export Options.`;
        set(prevState => ({
          data: {
            ...prevState.data,
            previewContent: warningMessage,
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
              
              // Get language-aware content
              const languageContent = getLanguageContent(
                sub, 
                selectedLanguages as LanguageSelection[], 
                'srt' as ExportFormat
              );
              let text = formatSRTText(languageContent);
              
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
              
              // Get language-aware content
              const languageContent = getLanguageContent(
                sub, 
                selectedLanguages as LanguageSelection[], 
                'vtt' as ExportFormat
              );
              let text = formatVTTText(languageContent);
              
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
              
              // Get language-aware content
              const languageContent = getLanguageContent(
                sub, 
                selectedLanguages as LanguageSelection[], 
                'txt' as ExportFormat
              );
              text += formatTXTText(languageContent);
              
              // Apply line breaks and length formatting
              return formatText(text);
            }).join('\n');
            break;

          case 'json':
            // Get config data for metadata - use a try-catch to handle missing config
            let configData;
            try {
              const { useConfigStepStore } = await import('./useConfigStepStore');
              configData = useConfigStepStore.getState().data;
            } catch (error) {
              console.warn('Could not get config data for JSON export metadata:', error);
              configData = null;
            }

            // Calculate total duration
            const totalDuration = subtitles.length > 0 
              ? Math.max(...subtitles.map(sub => sub.endTime))
              : 0;

            // Create JSON structure with dynamic field inclusion
            const jsonData = {
              metadata: {
                format: 'JSON',
                version: '1.0',
                generatedAt: new Date().toISOString(),
                settings: {
                  language: configData?.language || 'zh',
                  charset: configData?.charset || 'traditional',
                  modelUsed: configData?.modelSettings?.whisperModel || 'whisper-medium',
                  geminiEnabled: configData?.modelSettings?.enableGemini || false,
                  speakerDiarization: configData?.speakers || false,
                  musicDetection: configData?.music || false,
                  selectedLanguages: selectedLanguages
                },
                statistics: {
                  totalSubtitles: subtitles.length,
                  totalDuration: Math.round(totalDuration * 100) / 100
                }
              },
              subtitles: subtitles.map((sub, index) => {
                const languageContent = getLanguageContent(
                  sub, 
                  selectedLanguages as LanguageSelection[], 
                  'json' as ExportFormat
                );
                return formatJSONSubtitle(sub, languageContent, index);
              })
            };

            content = JSON.stringify(jsonData, null, 2);
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

// Individual store selectors - for direct store access when needed
// These are unique to the individual store and provide direct access to store internals
export const useExportStepData = () => useExportStepStore(state => state.data);
export const useExportStepActions = () => useExportStepStore(state => state.actions);

// Note: Other export hooks (useExportFormat, useExportPreviewState, etc.) are provided 
// by the centralized useStepStore for consistency across the application.
// Components should use the centralized store hooks for better coordination.