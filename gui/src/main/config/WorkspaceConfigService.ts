import type {
  ProcessingLanguage,
  TranslationLanguage,
  WhisperModel,
} from '../../renderer/src/stores/types/StoreTypes';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { MainLogger } from '../logger';
import { MainProcessLogger } from '@/types/logger';

interface TimeRange {
  start: number;
  end: number;
  duration: number;
}

interface VideoMetadata {
  duration?: string;
  resolution?: string;
  size?: string;
  codec?: string;
  bitrate?: string;
  frameRate?: string;
}

interface ModelSettings {
  whisperModel: WhisperModel;
  enableGemini: boolean;
  temperature: number;
}

interface ApiKeys {
  gemini?: string;
  openai?: string;
}

interface AdvancedSettings {
  chunkDuration: number;
  numWorkers: number;
  enableSpeakerDiarization: boolean;
  enableMusicDetection: boolean;
}

interface InputStepData {
  selectedFiles: string[];
  fileValidation: Record<string, boolean>;
  dragDropState: boolean;
  selectedFile?: string | null;
  inputFile?: string | null;
  importedJsonFile?: string | null;
  selectedRange?: TimeRange | null;
  startTime?: number | null;
  endTime?: number | null;
  duration?: number;
  mediaMetadata?: VideoMetadata;
  lastModified?: number;
  currentFile?: string;
  fileMetadata?: Record<string, unknown>;
}

interface ConfigStepData {
  // Core fields
  outputFile?: string | null;
  inputFile?: string | null;
  charset?: 'traditional' | 'simplified';
  language?: ProcessingLanguage;
  model?: WhisperModel;
  subtitle?: TranslationLanguage | null;
  geminiKey?: string;
  speakers?: boolean;
  written?: boolean;
  music?: boolean;

  // Additional CLI args fields
  priority?: 'balanced' | 'speed' | 'quality';
  noGeminiRefinement?: boolean;
  maxChunkDuration?: number;
  videoQuality?: '360p' | '720p' | '1080p';
  terminologyConfig?: string;
  ffmpegPath?: string;
  verbose?: boolean;

  // Structured settings
  modelSettings: ModelSettings;
  apiKeys: ApiKeys;
  advancedSettings: AdvancedSettings;

  // Validation
  isValid: boolean;
  validationErrors: string[];
  lastModified?: number;
}

export interface WorkspaceSchema {
  id: string;
  name: string;
  createdAt: string;
  lastAccessed: string;
  backgroundColor?: string;
  emoji?: string;
  groupId?: string | null;

  // Step content
  steps: {
    input: InputStepData;
    config: ConfigStepData;
    processing: {
      status: 'idle' | 'running' | 'completed' | 'error';
      progress: number;
      currentPhase?: string;
      logs: string[];
      hardwareInfo?: any; // TODO: Add hardware info type
    };
    review: {
      subtitles: unknown[];
      currentEdit?: unknown;
      playbackPosition: number;
      selectedSubtitleIndex?: number;
    };
    export: {
      format: string;
      outputPath?: string;
      exportSettings: {
        includeTimecodes: boolean;
        charset: string;
        translation: boolean;
      };
      exportHistory: unknown[];
    };
  };
}

export class WorkspaceConfigService {
  private stores: Map<string, Store<WorkspaceSchema>> = new Map();
  private workspaceList: Store<{ workspaces: string[] }>;
  private logger: MainProcessLogger = MainLogger.createScopedLogger('WorkspaceConfigService');

  constructor() {
    this.workspaceList = new Store<{ workspaces: string[] }>({
      name: 'workspace-list',
      defaults: { workspaces: [] },
    });
  }

  createWorkspace(
    name: string,
    backgroundColor?: string,
    emoji?: string
  ): { id: string; workspace: WorkspaceSchema } {
    const id = uuidv4();
    const now = new Date().toISOString();

    const workspace: WorkspaceSchema = {
      id,
      name,
      createdAt: now,
      lastAccessed: now,
      backgroundColor,
      emoji,
      groupId: null,
      steps: {
        input: {
          selectedFiles: [],
          fileValidation: {},
          dragDropState: false,
          selectedFile: null,
          inputFile: null,
          importedJsonFile: null,
          selectedRange: null,
          startTime: null,
          endTime: null,
          duration: 10.0,
          mediaMetadata: undefined,
          lastModified: Date.now(),
          currentFile: undefined,
          fileMetadata: undefined,
        },
        config: {
          // Core fields used by ConfigStep.tsx
          outputFile: null,
          inputFile: null,
          charset: 'traditional',
          language: 'zh',
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
            temperature: 0.1,
          },
          apiKeys: {},
          advancedSettings: {
            chunkDuration: 30,
            numWorkers: 4,
            enableSpeakerDiarization: false,
            enableMusicDetection: false,
          },

          // Validation
          isValid: false,
          validationErrors: [],
          lastModified: Date.now(),
          initializedWithDefaults: false,
        },
        processing: {
          status: 'idle',
          progress: 0,
          logs: [],
        },
        review: {
          subtitles: [],
          playbackPosition: 0,
        },
        export: {
          format: 'srt',
          exportSettings: {
            includeTimecodes: true,
            charset: 'utf-8',
            translation: false,
          },
          exportHistory: [],
        },
      },
    };

    const store = new Store<WorkspaceSchema>({
      name: `workspace-${id}`,
      defaults: workspace,
    });

    // Initialize the store with the workspace data
    store.store = workspace;
    this.stores.set(id, store);

    // Update workspace list
    const workspaces = this.workspaceList.get('workspaces', []);
    this.workspaceList.set('workspaces', [...workspaces, id]);

    return { id, workspace };
  }

  getWorkspace(id: string): WorkspaceSchema | null {
    const store = this.getOrCreateStore(id);
    return store ? store.store : null;
  }

  updateWorkspace(id: string, updates: Partial<WorkspaceSchema>): void {
    const store = this.getOrCreateStore(id);
    if (store) {
      Object.entries(updates).forEach(([key, value]) => {
        store.set(key, value);
      });
      store.set('lastAccessed', new Date().toISOString());
    }
  }

  updateStepContent(id: string, stepName: string, content: unknown): void {
    const store = this.getOrCreateStore(id);
    if (store) {
      const currentStepData = store.get(`steps.${stepName}`, {});
      this.logger.info(
        `🔍 WorkspaceConfigService: Current ${stepName} step data:`,
        currentStepData
      );

      // Use complete replacement instead of merge to ensure field deletions work
      store.set(`steps.${stepName}`, content);

      const savedData = store.get(`steps.${stepName}`, {});
      this.logger.info(`✅ WorkspaceConfigService: ${stepName} step data after save:`, savedData);

      store.set('lastAccessed', new Date().toISOString());
    }
  }

  getStepContent(id: string, stepName: string): unknown {
    const store = this.getOrCreateStore(id);
    if (store) {
      return store.get(`steps.${stepName}`, null);
    }
    return null;
  }

  deleteWorkspace(id: string): boolean {
    try {
      const store = this.stores.get(id);
      if (store) {
        store.clear();
        this.stores.delete(id);
      }

      // Remove from workspace list
      const workspaces = this.workspaceList.get('workspaces', []);
      this.workspaceList.set(
        'workspaces',
        workspaces.filter((wsId) => wsId !== id)
      );

      return true;
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      return false;
    }
  }

  listWorkspaces(): Array<{
    id: string;
    name: string;
    lastAccessed: string;
    createdAt: string;
    groupId?: string | null;
    backgroundColor?: string;
    emoji?: string;
  }> {
    const workspaceIds = this.workspaceList.get('workspaces', []);
    return workspaceIds
      .map((id) => {
        const workspace = this.getWorkspace(id);
        return workspace
          ? {
              id: workspace.id,
              name: workspace.name,
              lastAccessed: workspace.lastAccessed,
              createdAt: workspace.createdAt,
              groupId: workspace.groupId,
              backgroundColor: workspace.backgroundColor,
              emoji: workspace.emoji,
            }
          : null;
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      lastAccessed: string;
      createdAt: string;
      groupId?: string | null;
      backgroundColor?: string;
      emoji?: string;
    }>;
  }

  workspaceExists(id: string): boolean {
    const workspaces = this.workspaceList.get('workspaces', []);
    return workspaces.includes(id);
  }

  private getOrCreateStore(id: string): Store<WorkspaceSchema> | null {
    if (this.stores.has(id)) {
      return this.stores.get(id)!;
    }

    // Check if workspace exists
    if (this.workspaceExists(id)) {
      const store = new Store<WorkspaceSchema>({
        name: `workspace-${id}`,
      });
      this.stores.set(id, store);
      return store;
    }

    return null;
  }

  // Group management methods
  addWorkspaceToGroup(workspaceId: string, groupId: string): boolean {
    const store = this.getOrCreateStore(workspaceId);
    if (store) {
      store.set('groupId', groupId);
      store.set('lastAccessed', new Date().toISOString());
      return true;
    }
    return false;
  }

  removeWorkspaceFromGroup(workspaceId: string): boolean {
    const store = this.getOrCreateStore(workspaceId);
    if (store) {
      store.set('groupId', null);
      store.set('lastAccessed', new Date().toISOString());
      return true;
    }
    return false;
  }

  getWorkspacesByGroup(groupId: string): Array<{
    id: string;
    name: string;
    lastAccessed: string;
    createdAt: string;
    groupId?: string | null;
    backgroundColor?: string;
    emoji?: string;
  }> {
    const allWorkspaces = this.listWorkspaces();
    return allWorkspaces.filter((ws) => ws.groupId === groupId);
  }

  // Utility methods
  renameWorkspace(id: string, newName: string): boolean {
    const store = this.getOrCreateStore(id);
    if (store) {
      store.set('name', newName);
      store.set('lastAccessed', new Date().toISOString());
      return true;
    }
    return false;
  }

  duplicateWorkspace(
    id: string,
    newName: string
  ): { id: string; workspace: WorkspaceSchema } | null {
    const originalWorkspace = this.getWorkspace(id);
    if (!originalWorkspace) return null;

    const newWorkspace = this.createWorkspace(newName);

    // Copy all step data except IDs and timestamps
    const store = this.getOrCreateStore(newWorkspace.id);
    if (store) {
      store.set('steps', originalWorkspace.steps);
    }

    return newWorkspace;
  }
}
