import Store from 'electron-store';
import { MainLogger } from '../logger';
import type { MainProcessLogger } from '@/types/logger';

export interface AppSettingsSchema {
  apiKeys: {
    gemini?: string;
    openai?: string;
    huggingface?: string;
  };
  // placeholder for future preferences
}

const DEFAULT_SETTINGS: AppSettingsSchema = {
  apiKeys: {},
};

export class AppSettingsService {
  private store: Store<AppSettingsSchema>;
  private logger: MainProcessLogger = MainLogger.createScopedLogger('AppSettingsService');

  constructor() {
    this.store = new Store<AppSettingsSchema>({
      name: 'app-settings',
      defaults: DEFAULT_SETTINGS,
    });
  }

  getSettings(): AppSettingsSchema {
    const settings = this.store.store || DEFAULT_SETTINGS;
    // Ensure structure
    return {
      apiKeys: settings.apiKeys || {},
    };
  }

  updateSettings(partial: Partial<AppSettingsSchema>): AppSettingsSchema {
    const current = this.getSettings();
    const next: AppSettingsSchema = {
      apiKeys: {
        ...current.apiKeys,
        ...(partial.apiKeys || {}),
      },
    };
    this.store.store = next;
    this.logger.info('Updated app settings');
    return next;
  }

  reset(): void {
    this.store.store = DEFAULT_SETTINGS;
    this.logger.info('Reset app settings to defaults');
  }
}

