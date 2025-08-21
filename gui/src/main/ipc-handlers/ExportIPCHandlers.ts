import { ipcMain, WebContents } from 'electron';
import { ExportConfigService } from '../config/ExportConfigService';
import { MainLogger } from '../logger';
import type { MainProcessLogger } from '../../types/logger';
import type {
  ExportWorkspacePreferences,
  ExportSessionState,
  ModifiedSubtitleData,
  WorkspaceExportHistory,
} from '../../renderer/src/stores/types/StoreTypes';

export class ExportIPCHandlers {
  private exportConfigService: ExportConfigService;
  private logger: MainProcessLogger = MainLogger.createScopedLogger('ExportIPC');

  constructor(private webContents: WebContents) {
    this.exportConfigService = new ExportConfigService();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // ============================================================================
    // EXPORT PREFERENCES HANDLERS
    // ============================================================================

    ipcMain.handle(
      'export:loadPreferences',
      (_, workspaceId: string): ExportWorkspacePreferences | null => {
        try {
          this.logger.debug('📖 Loading export preferences', { workspaceId });
          return this.exportConfigService.loadExportPreferences(workspaceId);
        } catch (error) {
          this.logger.error('Failed to load export preferences', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
          });
          throw error;
        }
      }
    );

    ipcMain.handle(
      'export:savePreferences',
      (_, workspaceId: string, preferences: Partial<ExportWorkspacePreferences>): void => {
        try {
          this.logger.debug('💾 Saving export preferences', { workspaceId, preferences });
          this.exportConfigService.saveExportPreferences(workspaceId, preferences);

          // Broadcast preferences update to renderer
          this.broadcast('export:preferencesUpdated', {
            workspaceId,
            preferences: this.exportConfigService.loadExportPreferences(workspaceId),
          });
        } catch (error) {
          this.logger.error('Failed to save export preferences', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
          });
          throw error;
        }
      }
    );

    ipcMain.handle('export:clearPreferences', (_, workspaceId: string): void => {
      try {
        this.logger.info('🗑️ Clearing export preferences', { workspaceId });
        this.exportConfigService.clearExportPreferences(workspaceId);

        // Broadcast preferences cleared to renderer
        this.broadcast('export:preferencesCleared', { workspaceId });
      } catch (error) {
        this.logger.error('Failed to clear export preferences', {
          error: error instanceof Error ? error.message : String(error),
          workspaceId,
        });
        throw error;
      }
    });

    // ============================================================================
    // EXPORT SESSION HANDLERS
    // ============================================================================

    ipcMain.handle('export:loadSession', (_, workspaceId: string): ExportSessionState | null => {
      try {
        this.logger.debug('📖 Loading export session', { workspaceId });
        return this.exportConfigService.loadExportSession(workspaceId);
      } catch (error) {
        this.logger.error('Failed to load export session', {
          error: error instanceof Error ? error.message : String(error),
          workspaceId,
        });
        throw error;
      }
    });

    ipcMain.handle(
      'export:saveSession',
      (_, workspaceId: string, session: Partial<ExportSessionState>): void => {
        try {
          this.logger.debug('💾 Saving export session', { workspaceId, session });
          this.exportConfigService.saveExportSession(workspaceId, session);

          // Broadcast session update to renderer
          this.broadcast('export:sessionUpdated', {
            workspaceId,
            session: this.exportConfigService.loadExportSession(workspaceId),
          });
        } catch (error) {
          this.logger.error('Failed to save export session', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
          });
          throw error;
        }
      }
    );

    // ============================================================================
    // MODIFIED SUBTITLES HANDLERS
    // ============================================================================

    ipcMain.handle(
      'export:loadModifiedSubtitles',
      (_, workspaceId: string): ModifiedSubtitleData | null => {
        try {
          this.logger.debug('📖 Loading modified subtitles', { workspaceId });
          return this.exportConfigService.loadModifiedSubtitles(workspaceId);
        } catch (error) {
          this.logger.error('Failed to load modified subtitles', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
          });
          throw error;
        }
      }
    );

    ipcMain.handle(
      'export:saveModifiedSubtitles',
      (_, workspaceId: string, data: ModifiedSubtitleData): void => {
        try {
          this.logger.debug('💾 Saving modified subtitles', {
            workspaceId,
            subtitleCount: data.modifiedSubtitles.length,
          });
          this.exportConfigService.saveModifiedSubtitles(workspaceId, data);

          // Broadcast modified subtitles update to renderer
          this.broadcast('export:modifiedSubtitlesUpdated', {
            workspaceId,
            data: this.exportConfigService.loadModifiedSubtitles(workspaceId),
          });
        } catch (error) {
          this.logger.error('Failed to save modified subtitles', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
          });
          throw error;
        }
      }
    );

    // ============================================================================
    // EXPORT HISTORY HANDLERS
    // ============================================================================

    ipcMain.handle(
      'export:loadHistory',
      (_, workspaceId: string): WorkspaceExportHistory | null => {
        try {
          this.logger.debug('📖 Loading export history', { workspaceId });
          return this.exportConfigService.loadWorkspaceExportHistory(workspaceId);
        } catch (error) {
          this.logger.error('Failed to load export history', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
          });
          throw error;
        }
      }
    );

    ipcMain.handle(
      'export:saveHistory',
      (_, workspaceId: string, history: WorkspaceExportHistory): void => {
        try {
          this.logger.debug('💾 Saving export history', {
            workspaceId,
            exportCount: history.exports.length,
          });
          this.exportConfigService.saveWorkspaceExportHistory(workspaceId, history);

          // Broadcast history update to renderer
          this.broadcast('export:historyUpdated', {
            workspaceId,
            history: this.exportConfigService.loadWorkspaceExportHistory(workspaceId),
          });
        } catch (error) {
          this.logger.error('Failed to save export history', {
            error: error instanceof Error ? error.message : String(error),
            workspaceId,
          });
          throw error;
        }
      }
    );

    // ============================================================================
    // UTILITY HANDLERS
    // ============================================================================

    ipcMain.handle('export:getAllWorkspaceIds', (): string[] => {
      try {
        return this.exportConfigService.getAllWorkspaceIds();
      } catch (error) {
        this.logger.error('Failed to get all workspace IDs', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    ipcMain.handle('export:getStorageStats', () => {
      try {
        return this.exportConfigService.getStorageStats();
      } catch (error) {
        this.logger.error('Failed to get storage stats', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    ipcMain.handle('export:cleanupOldData', (_, activeWorkspaceIds: string[]): void => {
      try {
        this.logger.info('🧹 Cleaning up export data for inactive workspaces', {
          activeWorkspaceIds,
        });
        this.exportConfigService.cleanupOldData(activeWorkspaceIds);

        // Broadcast cleanup completion
        this.broadcast('export:dataCleanupCompleted', { activeWorkspaceIds });
      } catch (error) {
        this.logger.error('Failed to cleanup old export data', {
          error: error instanceof Error ? error.message : String(error),
          activeWorkspaceIds,
        });
        throw error;
      }
    });

    this.logger.info('Export IPC handlers initialized successfully');
  }

  private broadcast(channel: string, data: unknown): void {
    // Send to the main window's webContents
    if (this.webContents && !this.webContents.isDestroyed()) {
      this.webContents.send(channel, data);
    }
  }

  // Cleanup method to remove all handlers
  public cleanup(): void {
    // Remove export preferences handlers
    ipcMain.removeAllListeners('export:loadPreferences');
    ipcMain.removeAllListeners('export:savePreferences');
    ipcMain.removeAllListeners('export:clearPreferences');

    // Remove export session handlers
    ipcMain.removeAllListeners('export:loadSession');
    ipcMain.removeAllListeners('export:saveSession');

    // Remove modified subtitles handlers
    ipcMain.removeAllListeners('export:loadModifiedSubtitles');
    ipcMain.removeAllListeners('export:saveModifiedSubtitles');

    // Remove export history handlers
    ipcMain.removeAllListeners('export:loadHistory');
    ipcMain.removeAllListeners('export:saveHistory');

    // Remove utility handlers
    ipcMain.removeAllListeners('export:getAllWorkspaceIds');
    ipcMain.removeAllListeners('export:getStorageStats');
    ipcMain.removeAllListeners('export:cleanupOldData');

    this.logger.info('Export IPC handlers cleaned up successfully');
  }
}
