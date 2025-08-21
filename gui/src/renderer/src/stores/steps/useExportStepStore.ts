import { create } from 'zustand';
import { 
  ExportStepData, 
  Subtitle,
  ExportWorkspacePreferences,
  ExportSessionState,
  ModifiedSubtitleData,
  WorkspaceExportHistory,
  ElectronWindow
} from '../types/StoreTypes';
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
import { 
  generateLanguageAwareFCPXML, 
  validateFCPXML,
  type FCPXMLMetadata 
} from '../../components/steps/ExportStep/fcpxmlHelpers';
import { createStoreLogger } from '../../utils/logger';

const logger = createStoreLogger('Export');

interface ExportStepState {
  data: ExportStepData;
  actions: {
    updateExportStep: (content: Partial<ExportStepData>) => void;
    resetExportStep: () => void;
    updateExportFormat: (format: string) => Promise<void>;
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
    addExportRecord: (record: Omit<ExportStepData['exportHistory'][0], 'id'>) => Promise<void>;
    removeExportRecord: (recordId: string) => void;
    removeFromHistory: (index: number) => void;
    clearHistory: () => void;
    setExportingState: (isExporting: boolean, progress?: number, error?: string) => void;
    generatePreviewContent: (subtitles: Subtitle[]) => Promise<void>;
    
    // Enhanced persistence actions (similar to step 2's pattern)
    loadExportPreferences: (workspaceId: string) => Promise<ExportWorkspacePreferences | null>;
    saveExportPreferences: (workspaceId: string, preferences: Partial<ExportWorkspacePreferences>) => Promise<void>;
    loadExportSession: (workspaceId: string) => Promise<ExportSessionState | null>;
    saveExportSession: (workspaceId: string, session: Partial<ExportSessionState>) => Promise<void>;
    clearExportPreferences: (workspaceId: string) => Promise<void>;
    
    // Modified subtitle data preservation (from step 4)
    loadModifiedSubtitles: (workspaceId: string) => Promise<ModifiedSubtitleData | null>;
    saveModifiedSubtitles: (workspaceId: string, data: ModifiedSubtitleData) => Promise<void>;
    
    // Workspace export history management
    loadWorkspaceExportHistory: (workspaceId: string) => Promise<WorkspaceExportHistory | null>;
    saveWorkspaceExportHistory: (workspaceId: string, history: WorkspaceExportHistory) => Promise<void>;
    loadWorkspacePersistenceData: (workspaceId: string) => Promise<void>;
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
      logger.info('Resetting export step to defaults for workspace isolation');
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
      logger.debug('Export step reset completed');
    },

    updateExportFormat: async (format: string) => {
      // Update the format in the store
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

      // Save format preference to persistent storage
      try {
        const { useAppStore } = await import('../useAppStore');
        const activeWorkspaceId = useAppStore.getState().activeWorkspaceId;
        if (activeWorkspaceId) {
          await get().actions.saveExportPreferences(activeWorkspaceId, {
            preferredFormat: format
          });
          logger.debug('Saved export format preference', { format, workspaceId: activeWorkspaceId });
        }
      } catch (error) {
        logger.warn('Could not save export format preference', {
          format,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't throw - allow format change to continue even if saving fails
      }
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

    addExportRecord: async (record: Omit<ExportStepData['exportHistory'][0], 'id'>) => {
      const id = `export_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newRecord = { id, ...record };
      
      // Update the store state
      set(state => ({
        data: {
          ...state.data,
          exportHistory: [
            newRecord,
            ...state.data.exportHistory
          ].slice(0, 50), // Keep only last 50 exports
          lastModified: Date.now()
        }
      }));

      // Save to persistent storage
      try {
        const { useAppStore } = await import('../useAppStore');
        const activeWorkspaceId = useAppStore.getState().activeWorkspaceId;
        if (activeWorkspaceId) {
          // Get the updated history from the store
          const currentState = get();
          const updatedHistory: WorkspaceExportHistory = {
            workspaceId: activeWorkspaceId,
            exports: currentState.data.exportHistory,
            preferences: {
              workspaceId: activeWorkspaceId,
              preferredFormat: currentState.data.format,
              selectedLanguages: currentState.data.selectedLanguages,
              includeMetadata: currentState.data.includeMetadata,
              showTimestamps: currentState.data.showTimestamps,
              customOutputPath: currentState.data.customOutputPath,
              exportSettings: currentState.data.exportSettings,
              lastUsedSettings: {
                format: currentState.data.format,
                timestamp: Date.now()
              }
            },
            lastUpdated: new Date().toISOString()
          };
          
          await get().actions.saveWorkspaceExportHistory(activeWorkspaceId, updatedHistory);
          logger.debug('Saved export history record', {
            outputPath: record.outputPath,
            workspaceId: activeWorkspaceId
          });
        }
      } catch (error) {
        logger.warn('Could not save export history record', {
          outputPath: record.outputPath,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't throw - allow record addition to continue even if saving fails
      }
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
              logger.warn('Could not get config data for JSON export metadata', {
                error: error instanceof Error ? error.message : String(error)
              });
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

          case 'fcpxml':
            // Get video metadata for FCPXML
            let videoMetadata: FCPXMLMetadata = {
              projectName: 'CantoCap Subtitles',
              eventName: 'CantoCap Export',
              frameRate: 30,
              width: 1920,
              height: 1080
            };

            // Try to get video metadata from input file if available
            try {
              const { useInputStepStore } = await import('./useInputStepStore');
              const inputData = useInputStepStore.getState().data;
              if (inputData.mediaMetadata) {
                // Parse resolution if available (e.g., "1920x1080")
                if (inputData.mediaMetadata.resolution) {
                  const [width, height] = inputData.mediaMetadata.resolution.split('x').map(Number);
                  if (width && height) {
                    videoMetadata.width = width;
                    videoMetadata.height = height;
                  }
                }
                // Parse frame rate if available (e.g., "30.00 fps")
                if (inputData.mediaMetadata.frameRate) {
                  const frameRate = parseFloat(inputData.mediaMetadata.frameRate.replace(/[^\d.]/g, ''));
                  if (frameRate && frameRate > 0) {
                    videoMetadata.frameRate = frameRate;
                  }
                }
              }
              
              // Set project name based on input file
              if (inputData.selectedFile) {
                const fileName = inputData.selectedFile.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'CantoCap Subtitles';
                videoMetadata.projectName = fileName;
              }
            } catch (error) {
              logger.warn('Could not get input metadata for FCPXML export', {
                error: error instanceof Error ? error.message : String(error)
              });
            }

            // Generate FCPXML content
            content = generateLanguageAwareFCPXML(
              subtitles,
              selectedLanguages as string[],
              includeMetadata || false,
              showTimestamps || false,
              videoMetadata
            );

            // Validate generated FCPXML
            const validation = validateFCPXML(content);
            if (!validation.isValid) {
              logger.warn('Generated FCPXML has validation issues', {
                errors: validation.errors
              });
              // Only add validation warnings for critical structural issues
              const criticalErrors = validation.errors.filter(error => 
                error.includes('Missing') && (
                  error.includes('XML declaration') ||
                  error.includes('FCPXML doctype') ||
                  error.includes('FCPXML version') ||
                  error.includes('Invalid FCPXML structure')
                )
              );
              
              if (criticalErrors.length > 0) {
                content = `<!-- FCPXML Generated with validation warnings -->\n${content}\n\n<!-- Critical validation issues:\n${criticalErrors.join('\n')}\n-->`;
              } else {
                // For non-critical validation issues, just log them but don't modify the XML
                logger.debug('FCPXML generated successfully with minor validation notes', {
                  validationNotes: validation.errors
                });
              }
            }
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
        logger.error('Failed to generate preview', {
          error: error instanceof Error ? error.message : String(error)
        });
        set(prevState => ({
          data: {
            ...prevState.data,
            previewContent: '# Error generating preview\n\nPlease try again.',
            lastGenerated: Date.now()
          }
        }));
      }
    },

    // Enhanced persistence actions implementation (similar to step 2's pattern)
    loadExportPreferences: async (workspaceId: string) => {
      try {
        logger.debug('Loading export preferences', { workspaceId });
        const preferences = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:loadPreferences', workspaceId) as ExportWorkspacePreferences | null;
        return preferences || null;
      } catch (error) {
        logger.error('Failed to load export preferences', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    },

    saveExportPreferences: async (workspaceId: string, preferences: Partial<ExportWorkspacePreferences>) => {
      try {
        logger.debug('Saving export preferences', { workspaceId });
        
        // Save via IPC
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:savePreferences', workspaceId, preferences);
        
        // Update current store state with preferences
        if (preferences.preferredFormat) {
          set(state => ({
            data: {
              ...state.data,
              format: preferences.preferredFormat || state.data.format,
              lastModified: Date.now()
            }
          }));
        }
        
        if (preferences.selectedLanguages) {
          set(state => ({
            data: {
              ...state.data,
              selectedLanguages: preferences.selectedLanguages || state.data.selectedLanguages,
              lastModified: Date.now()
            }
          }));
        }
        
        if (preferences.exportSettings) {
          set(state => ({
            data: {
              ...state.data,
              exportSettings: { ...state.data.exportSettings, ...preferences.exportSettings },
              lastModified: Date.now()
            }
          }));
        }
      } catch (error) {
        logger.error('Failed to save export preferences', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    loadExportSession: async (workspaceId: string) => {
      try {
        logger.debug('Loading export session', { workspaceId });
        const session = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:loadSession', workspaceId) as ExportSessionState | null;
        return session || null;
      } catch (error) {
        logger.error('Failed to load export session', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    },

    saveExportSession: async (workspaceId: string, session: Partial<ExportSessionState>) => {
      try {
        logger.debug('Saving export session', { workspaceId });
        
        // Save via IPC
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:saveSession', workspaceId, session);
        
        // Update current store state
        if (session.currentFormat) {
          set(state => ({
            data: {
              ...state.data,
              format: session.currentFormat || state.data.format,
              lastModified: Date.now()
            }
          }));
        }
        
        if (session.userSelections) {
          set(state => ({
            data: {
              ...state.data,
              selectedLanguages: session.userSelections?.selectedLanguages || state.data.selectedLanguages,
              includeMetadata: session.userSelections?.includeMetadata ?? state.data.includeMetadata,
              showTimestamps: session.userSelections?.showTimestamps ?? state.data.showTimestamps,
              customOutputPath: session.userSelections?.customOutputPath || state.data.customOutputPath,
              lastModified: Date.now()
            }
          }));
        }
        
        if (session.uiState) {
          set(state => ({
            data: {
              ...state.data,
              previewState: { ...state.data.previewState, ...session.uiState?.previewState },
              actionsState: { ...state.data.actionsState, ...session.uiState?.actionsState },
              highlightConfig: { ...state.data.highlightConfig, ...session.uiState?.highlightConfig },
              lastModified: Date.now()
            }
          }));
        }
      } catch (error) {
        logger.error('Failed to save export session', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    clearExportPreferences: async (workspaceId: string) => {
      try {
        logger.debug('Clearing export preferences', { workspaceId });
        
        // Clear via IPC
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:clearPreferences', workspaceId);
        
        // Reset store to defaults
        set(state => ({
          data: {
            ...defaultExportStepData,
            exportHistory: state.data.exportHistory, // Preserve history
            lastModified: Date.now()
          }
        }));
      } catch (error) {
        logger.error('Failed to clear export preferences', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    loadModifiedSubtitles: async (workspaceId: string) => {
      try {
        logger.debug('Loading modified subtitles', { workspaceId });
        const data = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:loadModifiedSubtitles', workspaceId) as ModifiedSubtitleData | null;
        return data || null;
      } catch (error) {
        logger.error('Failed to load modified subtitles', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    },

    saveModifiedSubtitles: async (workspaceId: string, data: ModifiedSubtitleData) => {
      try {
        logger.debug('Saving modified subtitles', { workspaceId });
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:saveModifiedSubtitles', workspaceId, data);
      } catch (error) {
        logger.error('Failed to save modified subtitles', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    loadWorkspaceExportHistory: async (workspaceId: string) => {
      try {
        logger.debug('Loading export history', { workspaceId });
        const history = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:loadHistory', workspaceId) as WorkspaceExportHistory | null;
        return history || null;
      } catch (error) {
        logger.error('Failed to load workspace export history', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    },

    saveWorkspaceExportHistory: async (workspaceId: string, history: WorkspaceExportHistory) => {
      try {
        logger.debug('Saving export history', { workspaceId });
        
        // Save via IPC
        await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('export:saveHistory', workspaceId, history);
        
        // Update current store with history data
        set(state => ({
          data: {
            ...state.data,
            exportHistory: history.exports,
            lastModified: Date.now()
          }
        }));
      } catch (error) {
        logger.error('Failed to save workspace export history', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    // Load all workspace-specific export persistence data
    loadWorkspacePersistenceData: async (workspaceId: string) => {
      try {
        logger.info('Loading all export persistence data', { workspaceId });
        
        // Load export preferences (format selection, language options, etc.)
        const preferences = await get().actions.loadExportPreferences(workspaceId);
        if (preferences) {
          // Apply preferences to current state
          set(state => ({
            data: {
              ...state.data,
              format: preferences.preferredFormat || state.data.format,
              selectedLanguages: preferences.selectedLanguages || state.data.selectedLanguages,
              includeMetadata: preferences.includeMetadata ?? state.data.includeMetadata,
              showTimestamps: preferences.showTimestamps ?? state.data.showTimestamps,
              customOutputPath: preferences.customOutputPath ?? state.data.customOutputPath,
              exportSettings: {
                ...state.data.exportSettings,
                ...preferences.exportSettings
              },
              lastModified: Date.now()
            }
          }));
          logger.debug('Applied export preferences', { workspaceId });
        }

        // Load export history
        const history = await get().actions.loadWorkspaceExportHistory(workspaceId);
        if (history) {
          set(state => ({
            data: {
              ...state.data,
              exportHistory: history.exports,
              lastModified: Date.now()
            }
          }));
          logger.debug('Loaded export history', {
            workspaceId,
            entriesCount: history.exports.length
          });
        }

        // Load export session state (UI state, temporary preferences)
        const sessionState = await get().actions.loadExportSession(workspaceId);
        if (sessionState) {
          set(state => ({
            data: {
              ...state.data,
              format: sessionState.currentFormat || state.data.format,
              selectedLanguages: sessionState.userSelections?.selectedLanguages || state.data.selectedLanguages,
              includeMetadata: sessionState.userSelections?.includeMetadata ?? state.data.includeMetadata,
              showTimestamps: sessionState.userSelections?.showTimestamps ?? state.data.showTimestamps,
              customOutputPath: sessionState.userSelections?.customOutputPath ?? state.data.customOutputPath,
              previewState: {
                ...state.data.previewState,
                ...sessionState.uiState?.previewState
              },
              actionsState: {
                ...state.data.actionsState,
                ...sessionState.uiState?.actionsState
              },
              highlightConfig: {
                ...state.data.highlightConfig,
                ...sessionState.uiState?.highlightConfig
              },
              lastModified: Date.now()
            }
          }));
          logger.debug('Applied export session state', { workspaceId });
        }

        logger.debug('Successfully loaded all export persistence data', { workspaceId });
      } catch (error) {
        logger.error('Failed to load workspace persistence data', {
          workspaceId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't throw - allow workspace switching to continue even if persistence loading fails
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