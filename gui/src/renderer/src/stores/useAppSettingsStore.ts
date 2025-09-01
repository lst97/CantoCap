import { create } from 'zustand';
import type { ElectronWindow } from '../../../types';

export interface AppSettingsState {
  apiKeys: {
    gemini?: string;
    openai?: string;
    huggingface?: string;
  };
  isLoading: boolean;
  error: string | null;
  actions: {
    load: () => Promise<void>;
    update: (partial: { apiKeys?: Partial<AppSettingsState['apiKeys']> }) => Promise<void>;
    updateApiKeys: (partial: Partial<AppSettingsState['apiKeys']>) => Promise<void>;
  };
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  apiKeys: {},
  isLoading: false,
  error: null,
  actions: {
    load: async () => {
      set({ isLoading: true, error: null });
      try {
        const res = await (window as unknown as ElectronWindow).cantocapAPI.settingsGet();
        if (!res?.success || !res.settings) throw new Error(res?.error || 'Failed to load settings');
        set({ apiKeys: res.settings.apiKeys || {}, isLoading: false });
      } catch (e) {
        set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to load settings' });
      }
    },
    update: async (partial) => {
      try {
        const current = get();
        const next = {
          apiKeys: { ...current.apiKeys, ...(partial.apiKeys || {}) },
        };
        const res = await (window as unknown as ElectronWindow).cantocapAPI.settingsUpdate(next);
        if (!res?.success || !res.settings) throw new Error(res?.error || 'Failed to update settings');
        set({ apiKeys: res.settings.apiKeys });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : 'Failed to update settings' });
        throw e;
      }
    },
    updateApiKeys: async (partial) => {
      await get().actions.update({ apiKeys: partial });
    },
  },
}));
