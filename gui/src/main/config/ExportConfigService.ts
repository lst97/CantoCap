import Store from 'electron-store';
import type {
  ExportWorkspacePreferences,
  ExportSessionState,
  ModifiedSubtitleData,
  WorkspaceExportHistory,
} from '../../renderer/src/stores/types/StoreTypes';
import { MainLogger } from '../logger';
import { MainProcessLogger } from '@/types/logger';

// Schema for export preferences data
export interface ExportPreferencesSchema {
  workspaceId: string;
  preferredFormat?: string;
  selectedLanguages?: string[];
  includeMetadata?: boolean;
  showTimestamps?: boolean;
  customOutputPath?: string;
  exportSettings?: {
    includeTimecodes?: boolean;
    charset?: string;
    translation?: boolean;
    lineBreaks?: 'auto' | 'manual';
    maxLineLength?: number;
  };
  lastUsedSettings?: {
    format: string;
    timestamp: number;
  };
}

// Schema for export session state
export interface ExportSessionSchema {
  workspaceId: string;
  currentFormat?: string;
  previewContent?: string;
  lastGenerated?: number;
  userSelections?: {
    selectedLanguages?: string[];
    includeMetadata?: boolean;
    showTimestamps?: boolean;
    customOutputPath?: string;
  };
  uiState?: {
    previewState?: {
      fullscreenOpen?: boolean;
      copySnackbar?: boolean;
      showLineNumbers?: boolean;
    };
    actionsState?: {
      showMultiFormatDialog?: boolean;
      selectedFormats?: string[];
      snackbarOpen?: boolean;
    };
    highlightConfig?: {
      language?: string;
      showLineNumbers?: boolean;
    };
  };
  lastUpdated?: number;
}

// Schema for modified subtitle data from review step
export interface ModifiedSubtitleSchema {
  workspaceId: string;
  originalSubtitles: ModifiedSubtitleData['originalSubtitles'];
  modifiedSubtitles: ModifiedSubtitleData['modifiedSubtitles'];
  hasChanges: boolean;
  metadata: ModifiedSubtitleData['metadata'];
  lastModified: number;
}

// Schema for workspace export history
export interface WorkspaceExportHistorySchema {
  workspaceId: string;
  exports: WorkspaceExportHistory['exports'];
  preferences: WorkspaceExportHistory['preferences'];
  sessionState?: WorkspaceExportHistory['sessionState'];
  lastUpdated: string;
}

export class ExportConfigService {
  private store: Store<Record<string, unknown>>;
  private logger: MainProcessLogger = MainLogger.createScopedLogger('ExportConfigService');

  constructor() {
    this.store = new Store<Record<string, unknown>>({
      name: 'export-config',
      schema: {
        // Export preferences per workspace
        exportPreferences: {
          type: 'object',
          default: {},
        },
        // Export sessions per workspace
        exportSessions: {
          type: 'object',
          default: {},
        },
        // Modified subtitles per workspace
        modifiedSubtitles: {
          type: 'object',
          default: {},
        },
        // Export history per workspace
        exportHistory: {
          type: 'object',
          default: {},
        },
      },
    });

    this.logger.info('✅ Export Config Service initialized');
  }

  // ============================================================================
  // EXPORT PREFERENCES MANAGEMENT
  // ============================================================================

  /**
   * Load export preferences for a workspace
   */
  loadExportPreferences(workspaceId: string): ExportWorkspacePreferences | null {
    try {
      const key = `exportPreferences.${workspaceId}`;
      const preferences = this.store.get(key) as ExportPreferencesSchema | undefined;

      if (!preferences) {
        this.logger.info(`📖 No export preferences found for workspace: ${workspaceId}`);
        return null;
      }

      // Convert to the expected format
      const result: ExportWorkspacePreferences = {
        workspaceId: preferences.workspaceId,
        preferredFormat: preferences.preferredFormat || 'srt',
        selectedLanguages: preferences.selectedLanguages || ['original'],
        includeMetadata: preferences.includeMetadata || false,
        showTimestamps: preferences.showTimestamps || false,
        customOutputPath: preferences.customOutputPath,
        exportSettings: {
          includeTimecodes: preferences.exportSettings?.includeTimecodes ?? true,
          charset: preferences.exportSettings?.charset || 'utf-8',
          translation: preferences.exportSettings?.translation ?? false,
          lineBreaks: preferences.exportSettings?.lineBreaks || 'auto',
          maxLineLength: preferences.exportSettings?.maxLineLength,
        },
        lastUsedSettings: preferences.lastUsedSettings || {
          format: 'srt',
          timestamp: Date.now(),
        },
      };

      this.logger.info(`📖 Loaded export preferences for workspace: ${workspaceId}`, {
        result,
      });
      return result;
    } catch (error) {
      console.error('Failed to load export preferences:', error);
      return null;
    }
  }

  /**
   * Save export preferences for a workspace
   */
  saveExportPreferences(
    workspaceId: string,
    preferences: Partial<ExportWorkspacePreferences>
  ): void {
    try {
      const key = `exportPreferences.${workspaceId}`;

      // Get existing preferences or create default
      const existing = this.store.get(key) as ExportPreferencesSchema | undefined;
      const updated: ExportPreferencesSchema = {
        ...existing,
        workspaceId,
        ...preferences,
        // Ensure we don't lose existing settings when partially updating
        exportSettings: {
          ...(existing?.exportSettings || {}),
          ...(preferences.exportSettings || {}),
        },
      };

      this.store.set(key, updated);
      this.logger.info(`💾 Saved export preferences for workspace: ${workspaceId}`, {
        updated,
      });
    } catch (error) {
      console.error('Failed to save export preferences:', error);
      throw error;
    }
  }

  /**
   * Clear export preferences for a workspace
   */
  clearExportPreferences(workspaceId: string): void {
    try {
      const key = `exportPreferences.${workspaceId}`;
      this.store.delete(key);
      this.logger.info(`🗑️ Cleared export preferences for workspace: ${workspaceId}`);
    } catch (error) {
      console.error('Failed to clear export preferences:', error);
      throw error;
    }
  }

  // ============================================================================
  // EXPORT SESSION MANAGEMENT
  // ============================================================================

  /**
   * Load export session for a workspace
   */
  loadExportSession(workspaceId: string): ExportSessionState | null {
    try {
      const key = `exportSessions.${workspaceId}`;
      const session = this.store.get(key) as ExportSessionSchema | undefined;

      if (!session) {
        this.logger.info(`📖 No export session found for workspace: ${workspaceId}`);
        return null;
      }

      // Convert to the expected format
      const result: ExportSessionState = {
        workspaceId: session.workspaceId,
        currentFormat: session.currentFormat || 'srt',
        previewContent: session.previewContent,
        lastGenerated: session.lastGenerated,
        userSelections: {
          selectedLanguages: session.userSelections?.selectedLanguages || ['original'],
          includeMetadata: session.userSelections?.includeMetadata ?? false,
          showTimestamps: session.userSelections?.showTimestamps ?? false,
          customOutputPath: session.userSelections?.customOutputPath,
        },
        uiState: {
          previewState: {
            fullscreenOpen: session.uiState?.previewState?.fullscreenOpen ?? false,
            copySnackbar: session.uiState?.previewState?.copySnackbar ?? false,
            showLineNumbers: session.uiState?.previewState?.showLineNumbers ?? true,
          },
          actionsState: {
            showMultiFormatDialog: session.uiState?.actionsState?.showMultiFormatDialog ?? false,
            selectedFormats: session.uiState?.actionsState?.selectedFormats || [],
            snackbarOpen: session.uiState?.actionsState?.snackbarOpen ?? false,
          },
          highlightConfig: {
            language: session.uiState?.highlightConfig?.language || 'text',
            showLineNumbers: session.uiState?.highlightConfig?.showLineNumbers ?? true,
          },
        },
      };

      this.logger.info(`📖 Loaded export session for workspace: ${workspaceId}`, {
        result,
      });
      return result;
    } catch (error) {
      console.error('Failed to load export session:', error);
      return null;
    }
  }

  /**
   * Save export session for a workspace
   */
  saveExportSession(workspaceId: string, session: Partial<ExportSessionState>): void {
    try {
      const key = `exportSessions.${workspaceId}`;

      // Get existing session or create default
      const existing = this.store.get(key) as ExportSessionSchema | undefined;
      const updated: ExportSessionSchema = {
        ...existing,
        workspaceId,
        ...session,
        // Deep merge UI state to preserve existing values
        uiState: {
          ...(existing?.uiState || {}),
          ...(session.uiState || {}),
          previewState: {
            ...(existing?.uiState?.previewState || {}),
            ...(session.uiState?.previewState || {}),
          },
          actionsState: {
            ...(existing?.uiState?.actionsState || {}),
            ...(session.uiState?.actionsState || {}),
          },
          highlightConfig: {
            ...(existing?.uiState?.highlightConfig || {}),
            ...(session.uiState?.highlightConfig || {}),
          },
        },
        // Deep merge user selections
        userSelections: {
          ...(existing?.userSelections || {}),
          ...(session.userSelections || {}),
        },
        lastUpdated: Date.now(),
      };

      this.store.set(key, updated);
      this.logger.info(`💾 Saved export session for workspace: ${workspaceId}`, {
        updated,
      });
    } catch (error) {
      console.error('Failed to save export session:', error);
      throw error;
    }
  }

  // ============================================================================
  // MODIFIED SUBTITLES MANAGEMENT
  // ============================================================================

  /**
   * Load modified subtitles for a workspace
   */
  loadModifiedSubtitles(workspaceId: string): ModifiedSubtitleData | null {
    try {
      const key = `modifiedSubtitles.${workspaceId}`;
      const data = this.store.get(key) as ModifiedSubtitleSchema | undefined;

      if (!data) {
        this.logger.info(`📖 No modified subtitles found for workspace: ${workspaceId}`);
        return null;
      }

      // Convert to the expected format
      const result: ModifiedSubtitleData = {
        workspaceId: data.workspaceId,
        originalSubtitles: data.originalSubtitles,
        modifiedSubtitles: data.modifiedSubtitles,
        hasChanges: data.hasChanges,
        metadata: data.metadata,
        lastModified: data.lastModified.toString(),
      };

      this.logger.info(
        `📖 Loaded modified subtitles for workspace: ${workspaceId} (${result.modifiedSubtitles.length} subtitles)`,
        {
          result,
        }
      );
      return result;
    } catch (error) {
      console.error('Failed to load modified subtitles:', error);
      return null;
    }
  }

  /**
   * Save modified subtitles for a workspace
   */
  saveModifiedSubtitles(workspaceId: string, data: ModifiedSubtitleData): void {
    try {
      const key = `modifiedSubtitles.${workspaceId}`;

      const toSave: ModifiedSubtitleSchema = {
        workspaceId,
        originalSubtitles: data.originalSubtitles,
        modifiedSubtitles: data.modifiedSubtitles,
        hasChanges: data.hasChanges,
        metadata: data.metadata,
        lastModified: Date.now(),
      };

      this.store.set(key, toSave);
      this.logger.info(
        `💾 Saved modified subtitles for workspace: ${workspaceId} (${data.modifiedSubtitles.length} subtitles)`
      );
    } catch (error) {
      console.error('Failed to save modified subtitles:', error);
      throw error;
    }
  }

  // ============================================================================
  // EXPORT HISTORY MANAGEMENT
  // ============================================================================

  /**
   * Load export history for a workspace
   */
  loadWorkspaceExportHistory(workspaceId: string): WorkspaceExportHistory | null {
    try {
      const key = `exportHistory.${workspaceId}`;
      const history = this.store.get(key) as WorkspaceExportHistorySchema | undefined;

      if (!history) {
        this.logger.info(`📖 No export history found for workspace: ${workspaceId}`);
        return null;
      }

      // Convert to the expected format
      const result: WorkspaceExportHistory = {
        workspaceId: history.workspaceId,
        exports: history.exports || [],
        preferences: history.preferences,
        sessionState: history.sessionState,
        lastUpdated: history.lastUpdated,
      };

      this.logger.info(
        `📖 Loaded export history for workspace: ${workspaceId} (${result.exports.length} exports)`
      );
      return result;
    } catch (error) {
      console.error('Failed to load workspace export history:', error);
      return null;
    }
  }

  /**
   * Save export history for a workspace
   */
  saveWorkspaceExportHistory(workspaceId: string, history: WorkspaceExportHistory): void {
    try {
      const key = `exportHistory.${workspaceId}`;

      const toSave: WorkspaceExportHistorySchema = {
        workspaceId,
        exports: history.exports || [],
        preferences: history.preferences,
        sessionState: history.sessionState,
        lastUpdated: history.lastUpdated,
      };

      this.store.set(key, toSave);
      this.logger.info(
        `💾 Saved export history for workspace: ${workspaceId} (${toSave.exports.length} exports)`
      );
    } catch (error) {
      console.error('Failed to save workspace export history:', error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get all workspace IDs that have export data
   */
  getAllWorkspaceIds(): string[] {
    try {
      const allData = this.store.store;
      const workspaceIds = new Set<string>();

      // Extract workspace IDs from all sections
      ['exportPreferences', 'exportSessions', 'modifiedSubtitles', 'exportHistory'].forEach(
        (section) => {
          const sectionData = allData[section] as Record<string, unknown> | undefined;
          if (sectionData) {
            Object.keys(sectionData).forEach((key) => workspaceIds.add(key));
          }
        }
      );

      return Array.from(workspaceIds);
    } catch (error) {
      console.error('Failed to get all workspace IDs:', error);
      return [];
    }
  }

  /**
   * Clean up data for non-existent workspaces
   */
  cleanupOldData(activeWorkspaceIds: string[]): void {
    try {
      const allWorkspaceIds = this.getAllWorkspaceIds();
      const toDelete = allWorkspaceIds.filter((id) => !activeWorkspaceIds.includes(id));

      if (toDelete.length === 0) {
        this.logger.info('✅ No export data cleanup needed');
        return;
      }

      this.logger.info(`🧹 Cleaning up export data for ${toDelete.length} old workspaces:`, {
        toDelete,
      });

      toDelete.forEach((workspaceId) => {
        this.clearExportPreferences(workspaceId);
        this.store.delete(`exportSessions.${workspaceId}`);
        this.store.delete(`modifiedSubtitles.${workspaceId}`);
        this.store.delete(`exportHistory.${workspaceId}`);
      });

      this.logger.info('✅ Export data cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup old export data:', error);
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    totalWorkspaces: number;
    totalPreferences: number;
    totalSessions: number;
    totalSubtitleData: number;
    totalHistoryEntries: number;
  } {
    try {
      const allData = this.store.store;

      const preferences = allData.exportPreferences as Record<string, unknown> | undefined;
      const sessions = allData.exportSessions as Record<string, unknown> | undefined;
      const subtitles = allData.modifiedSubtitles as Record<string, unknown> | undefined;
      const history = allData.exportHistory as Record<string, unknown> | undefined;

      return {
        totalWorkspaces: this.getAllWorkspaceIds().length,
        totalPreferences: Object.keys(preferences || {}).length,
        totalSessions: Object.keys(sessions || {}).length,
        totalSubtitleData: Object.keys(subtitles || {}).length,
        totalHistoryEntries: Object.keys(history || {}).length,
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalWorkspaces: 0,
        totalPreferences: 0,
        totalSessions: 0,
        totalSubtitleData: 0,
        totalHistoryEntries: 0,
      };
    }
  }
}
