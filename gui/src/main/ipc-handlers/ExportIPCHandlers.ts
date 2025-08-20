import { ipcMain, WebContents } from 'electron';
import { ExportConfigService } from '../config/ExportConfigService';
import type {
  ExportWorkspacePreferences,
  ExportSessionState,
  ModifiedSubtitleData,
  WorkspaceExportHistory,
} from '../../renderer/src/stores/types/StoreTypes';

export class ExportIPCHandlers {
  private exportConfigService: ExportConfigService;

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
          console.log(`📖 Loading export preferences for workspace: ${workspaceId}`);
          return this.exportConfigService.loadExportPreferences(workspaceId);
        } catch (error) {
          console.error('Failed to load export preferences:', error);
          throw error;
        }
      }
    );

    ipcMain.handle(
      'export:savePreferences',
      (_, workspaceId: string, preferences: Partial<ExportWorkspacePreferences>): void => {
        try {
          console.log(`💾 Saving export preferences for workspace: ${workspaceId}`, preferences);
          this.exportConfigService.saveExportPreferences(workspaceId, preferences);

          // Broadcast preferences update to renderer
          this.broadcast('export:preferencesUpdated', {
            workspaceId,
            preferences: this.exportConfigService.loadExportPreferences(workspaceId),
          });
        } catch (error) {
          console.error('Failed to save export preferences:', error);
          throw error;
        }
      }
    );

    ipcMain.handle('export:clearPreferences', (_, workspaceId: string): void => {
      try {
        console.log(`🗑️ Clearing export preferences for workspace: ${workspaceId}`);
        this.exportConfigService.clearExportPreferences(workspaceId);

        // Broadcast preferences cleared to renderer
        this.broadcast('export:preferencesCleared', { workspaceId });
      } catch (error) {
        console.error('Failed to clear export preferences:', error);
        throw error;
      }
    });

    // ============================================================================
    // EXPORT SESSION HANDLERS
    // ============================================================================

    ipcMain.handle('export:loadSession', (_, workspaceId: string): ExportSessionState | null => {
      try {
        console.log(`📖 Loading export session for workspace: ${workspaceId}`);
        return this.exportConfigService.loadExportSession(workspaceId);
      } catch (error) {
        console.error('Failed to load export session:', error);
        throw error;
      }
    });

    ipcMain.handle(
      'export:saveSession',
      (_, workspaceId: string, session: Partial<ExportSessionState>): void => {
        try {
          console.log(`💾 Saving export session for workspace: ${workspaceId}`, session);
          this.exportConfigService.saveExportSession(workspaceId, session);

          // Broadcast session update to renderer
          this.broadcast('export:sessionUpdated', {
            workspaceId,
            session: this.exportConfigService.loadExportSession(workspaceId),
          });
        } catch (error) {
          console.error('Failed to save export session:', error);
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
          console.log(`📖 Loading modified subtitles for workspace: ${workspaceId}`);
          return this.exportConfigService.loadModifiedSubtitles(workspaceId);
        } catch (error) {
          console.error('Failed to load modified subtitles:', error);
          throw error;
        }
      }
    );

    ipcMain.handle(
      'export:saveModifiedSubtitles',
      (_, workspaceId: string, data: ModifiedSubtitleData): void => {
        try {
          console.log(
            `💾 Saving modified subtitles for workspace: ${workspaceId} (${data.modifiedSubtitles.length} subtitles)`
          );
          this.exportConfigService.saveModifiedSubtitles(workspaceId, data);

          // Broadcast modified subtitles update to renderer
          this.broadcast('export:modifiedSubtitlesUpdated', {
            workspaceId,
            data: this.exportConfigService.loadModifiedSubtitles(workspaceId),
          });
        } catch (error) {
          console.error('Failed to save modified subtitles:', error);
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
          console.log(`📖 Loading export history for workspace: ${workspaceId}`);
          return this.exportConfigService.loadWorkspaceExportHistory(workspaceId);
        } catch (error) {
          console.error('Failed to load export history:', error);
          throw error;
        }
      }
    );

    ipcMain.handle(
      'export:saveHistory',
      (_, workspaceId: string, history: WorkspaceExportHistory): void => {
        try {
          console.log(
            `💾 Saving export history for workspace: ${workspaceId} (${history.exports.length} exports)`
          );
          this.exportConfigService.saveWorkspaceExportHistory(workspaceId, history);

          // Broadcast history update to renderer
          this.broadcast('export:historyUpdated', {
            workspaceId,
            history: this.exportConfigService.loadWorkspaceExportHistory(workspaceId),
          });
        } catch (error) {
          console.error('Failed to save export history:', error);
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
        console.error('Failed to get all workspace IDs:', error);
        throw error;
      }
    });

    ipcMain.handle('export:getStorageStats', () => {
      try {
        return this.exportConfigService.getStorageStats();
      } catch (error) {
        console.error('Failed to get storage stats:', error);
        throw error;
      }
    });

    ipcMain.handle('export:cleanupOldData', (_, activeWorkspaceIds: string[]): void => {
      try {
        console.log(`🧹 Cleaning up export data for inactive workspaces`);
        this.exportConfigService.cleanupOldData(activeWorkspaceIds);

        // Broadcast cleanup completion
        this.broadcast('export:dataCleanupCompleted', { activeWorkspaceIds });
      } catch (error) {
        console.error('Failed to cleanup old export data:', error);
        throw error;
      }
    });

    console.log('✅ Export IPC handlers initialized successfully');
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

    console.log('✅ Export IPC handlers cleaned up');
  }
}
