import { ipcMain, WebContents } from 'electron';
import { AppSettingsService, type AppSettingsSchema } from '../config/AppSettingsService';
import { MainLogger } from '../logger';
import type { MainProcessLogger } from '@/types/logger';

export class SettingsIPCHandlers {
  private logger: MainProcessLogger = MainLogger.createScopedLogger('SettingsIPC');

  constructor(private settingsService: AppSettingsService, private webContents: WebContents) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    ipcMain.handle('settings:get', () => {
      try {
        const settings = this.settingsService.getSettings();
        return { success: true, settings };
      } catch (error) {
        this.logger.error('Failed to get settings', { error: error instanceof Error ? error.message : String(error) });
        return { success: false, error: 'Failed to get app settings' };
      }
    });

    ipcMain.handle('settings:update', (_evt, partial: Partial<AppSettingsSchema>) => {
      try {
        const updated = this.settingsService.updateSettings(partial);
        // Broadcast optional event for UI sync
        this.webContents.send('settings:updated', updated);
        return { success: true, settings: updated };
      } catch (error) {
        this.logger.error('Failed to update settings', { error: error instanceof Error ? error.message : String(error) });
        return { success: false, error: 'Failed to update app settings' };
      }
    });
  }

  public cleanup(): void {
    ipcMain.removeAllListeners('settings:get');
    ipcMain.removeAllListeners('settings:update');
  }
}
