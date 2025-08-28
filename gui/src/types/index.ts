// ============================================================================
// SHARED TYPE DEFINITIONS - CENTRALIZED TYPES FOR CANTON CAP GUI
// ============================================================================

import {
  ProcessingLanguage,
  TranslationLanguage,
  WhisperModel,
} from '../renderer/src/stores/types/StoreTypes';

// Dependency checking types
export interface DependencyStatus {
  status: 'checking' | 'available' | 'missing' | 'error';
  available: boolean;
  version?: string;
  name?: string;
  helpText?: string;
  downloadUrl?: string;
}

// Legacy application configuration types (deprecated - use ProcessingConfig instead)
export interface AppConfig {
  // Core configuration fields
  outputFile?: string | null;
  inputFile?: string | null;
  charset?: 'traditional' | 'simplified';
  language?: string;
  model?: string;
  subtitle?: string | null;
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
}

// Modern processing configuration interface aligned with step stores
export interface ProcessingConfig {
  // Required fields
  inputFile: string;

  // Core configuration
  outputFile?: string | null;
  charset: 'traditional' | 'simplified';
  language: ProcessingLanguage;
  subtitle?: TranslationLanguage | null;

  // Media metadata (for timeout calculation)
  mediaDuration?: number; // Duration in seconds

  // Model settings
  modelSettings: {
    whisperModel: WhisperModel;
    geminiModel?: string;
    enableGemini: boolean;
    temperature: number;
  };

  // API keys
  apiKeys: {
    gemini?: string;
    openai?: string;
    huggingface?: string;
  };

  // Features
  features: {
    speakers: boolean;
    written: boolean;
    music: boolean;
  };

  // Advanced settings
  advancedSettings: {
    chunkDuration: number;
    numWorkers: number;
    enableSpeakerDiarization: boolean;
    enableMusicDetection: boolean;
  };

  // CLI options
  priority?: 'balanced' | 'speed' | 'quality';
  noGeminiRefinement?: boolean;
  maxChunkDuration?: number;
  videoQuality?: '360p' | '720p' | '1080p';
  terminologyConfig?: string;
  ffmpegPath?: string;
  verbose?: boolean;
}

// Hardware information types - comprehensive definition merging both previous definitions
export interface HardwareInfo {
  checking?: boolean;
  gpuAcceleration?: boolean;
  memoryUsage?: string;
  deviceInfo?: string;
  modelLoadTime?: number;
  processingSpeed?: string;
}

// File dialog options
export interface FileDialogOptions {
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  defaultPath?: string;
  properties?: string[];
}

// Initialization service result
export interface InitializationResult {
  success: boolean;
  message: string;
  dependencies: Record<string, DependencyStatus>;
  requiresRestart?: boolean;
}

// Window and electron types
export interface ElectronWindow extends Window {
  electron: {
    ipcRenderer: {
      // Align with preload (electronCompat) surface
      // Use any for IPC channel payloads to maximize compatibility with Electron typings
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  };
  cantocapAPI: {
    // System Operations
    checkDependencies: () => Promise<Record<string, DependencyStatus>>;

    // Initialization and Setup
    runInitialization: () => Promise<InitializationResult>;
    runEngineSetup: () => Promise<boolean>;
    openPythonDownload: () => Promise<void>;
    openPyenvGuide: () => Promise<void>;
    openFFmpegDownload: () => Promise<void>;

    // External URLs
    openExternalUrl: (url: string) => Promise<void>;

    // Application Info
    getAppVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;

    // DevTools Controls
    openDevTools: () => Promise<void>;
    closeDevTools: () => Promise<void>;
    toggleDevTools: () => Promise<void>;

    // File Dialogs
    openFileDialog: (options?: FileDialogOptions) => Promise<FileDialogResult>;
    openFolderDialog: () => Promise<FileDialogResult>;
    saveFileDialog: (options?: {
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<SaveFileDialogResult>;
    writeExportFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
    readJsonFile: (filePath: string) => Promise<unknown>;

    // Media Processing
    getVideoMetadata: (filePath: string) => Promise<{
      metadata: {
        duration: number;
        width: number;
        height: number;
        framerate: number;
        size: number;
        format: string;
      } | null;
      thumbnail: string | null;
      error?: string;
    }>;
    clearVideoCache: () => Promise<void>;
    getMediaUrl: (filePath: string) => Promise<string | null>;
    validateMediaFile: (filePath: string) => Promise<{
      isValid: boolean;
      exists: boolean;
      error?: string;
    }>;

    // Process Management
    startTranscription: (config: AppConfig) => void;
    cancelProcess: () => void;
    checkHardware: () => Promise<HardwareInfo>;

    // Modern IPC Message Handler
    onIPCMessage: (callback: (data: IPCMessage) => void) => () => void;

    // Subtitle Management - Workspace Operations
    subtitleWorkspaceLoad: (workspaceId: string) => Promise<unknown>;
    subtitleWorkspaceSave: (
      workspaceId: string,
      data: unknown
    ) => Promise<{ success: boolean; error?: string }>;
    subtitleWorkspaceExists: (workspaceId: string) => Promise<boolean>;
    subtitleWorkspaceDelete: (workspaceId: string) => Promise<{ success: boolean }>;

    // Subtitle Management - Import Operations
    subtitleImportJson: (
      filePath: string
    ) => Promise<{ success: boolean; subtitles?: unknown[]; error?: string }>;
    subtitleValidateFormat: (data: unknown) => Promise<{ isValid: boolean; errors?: string[] }>;

    // Subtitle Management - Step Integration
    subtitleSyncToStep: (
      workspaceId: string,
      subtitles: unknown[]
    ) => Promise<{ success: boolean }>;
    subtitleSyncFromStep: (workspaceId: string) => Promise<{ subtitles?: unknown[] }>;

    // Workflow State Management - CRITICAL FOR STEP TRANSITIONS
    workflowGetState: (workspaceId: string) => Promise<unknown>;
    workflowSetCurrentStep: (workspaceId: string, step: string) => Promise<{ success: boolean }>;
    workflowSetStepState: (workspaceId: string, step: string, state: string) => Promise<{ success: boolean }>;
    workflowResetState: (workspaceId: string) => Promise<{ success: boolean }>;
    workflowRemoveWorkspaceState: (workspaceId: string) => Promise<{ success: boolean }>;
    workflowGetAllStates: () => Promise<unknown>;
    workflowCleanup: (activeWorkspaceIds: string[]) => Promise<{ success: boolean }>;

    // Processing Control - CRITICAL FOR STEP 2→3 TRANSITION
    processingStart: (config: unknown) => Promise<{ success: boolean; error?: string }>;
    processingCancel: () => Promise<{ success: boolean; error?: string }>;
    processingGetStatus: () => Promise<{ success: boolean; isRunning: boolean; status: string; error?: string }>;
    processingConvertConfig: (stepConfig: unknown) => Promise<{ success: boolean; config?: unknown; error?: string }>;
    processingValidateConfig: (config: unknown) => Promise<{ success: boolean; isValid: boolean; errors?: string[]; error?: string }>;
    processingGetTimeEstimate: (config: unknown) => Promise<{ success: boolean; estimate?: unknown; error?: string }>;
    processingValidateFFmpeg: () => Promise<{ success: boolean; isValid: boolean; ffmpegPath?: string; error?: string }>;
    processingGetCommandPreview: (
      config: ProcessingConfig
    ) => Promise<{ success: boolean; command?: string; parts?: string[]; error?: string }>;

    // IPC Event Handlers for processing and workflow events
    onProcessingEvent: (callback: (data: unknown) => void) => (() => void);
    onWorkflowStepChanged: (callback: (data: unknown) => void) => (() => void);
    onWorkflowStepStateChanged: (callback: (data: unknown) => void) => (() => void);
    onWorkflowStateReset: (callback: (data: unknown) => void) => (() => void);

    // Utility Functions
    removeAllListeners: () => void;
  };
}

// Additional types for Electron API
export interface ElectronAPI {
  [key: string]: unknown;
}

export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveFileDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface IPCMessage {
  [key: string]: unknown;
}

// Re-export types from StoreTypes that are used externally
export type {
  WindowState,
  Subtitle,
  EditAction,
  WorkspaceSubtitleData,
  StepType,
  StepStatus,
  StepStatusType,
  ProcessingLanguage,
  TranslationLanguage,
  WhisperModel,
} from '../renderer/src/stores/types/StoreTypes';

// Processing event types for IPC communication
export interface ProcessingEvent {
  type: 'status-change' | 'progress-update' | 'log-message' | 'phase-change' | 'error' | 'complete';
  data: {
    status?: 'idle' | 'running' | 'completed' | 'error';
    progress?: number;
    phase?: string;
    message?: string;
    error?: string;
    logs?: string[];
    statistics?: unknown;
    outputFile?: string;
    // Enhanced completion data with JSON subtitle format
    subtitleData?: import('./SubtitleTypes').CantocapSubtitleData;
    outputFilePath?: string; // Alternative name for outputFile in completion events
  };
}

// Processing error types
export interface ProcessingError {
  code:
    | 'ENGINE_NOT_FOUND'
    | 'INVALID_CONFIG'
    | 'PROCESS_FAILED'
    | 'IPC_ERROR'
    | 'SETUP_ERROR'
    | 'TIMEOUT_ERROR';
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

// ============================================================================
// IPC Response Types for type-safe invoke calls
// ============================================================================
// Base interface for most IPC responses that can succeed or fail
export interface BaseIPCResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// Processing IPC Response Types
// ============================================================================

export interface ProcessingConvertConfigResponse extends BaseIPCResponse {
  config?: ProcessingConfig;
}

export interface ProcessingTimeEstimateResponse extends BaseIPCResponse {
  estimate?: {
    timeoutMs: number;
    timeoutDisplay: string;
    estimatedProcessingMs: number;
    estimatedProcessingDisplay: string;
    basedOnDuration: boolean;
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ProcessingStartResponse extends BaseIPCResponse {
  // No additional fields - just success/error
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ProcessingCancelResponse extends BaseIPCResponse {
  // No additional fields - just success/error
}

export interface ProcessingStatusResponse extends BaseIPCResponse {
  isRunning?: boolean;
  status?: 'running' | 'idle';
}

export interface ProcessingValidateConfigResponse extends BaseIPCResponse {
  isValid?: boolean;
  errors?: string[];
}

export interface ProcessingValidateFFmpegResponse extends BaseIPCResponse {
  isValid?: boolean;
  ffmpegPath?: string;
}

// ============================================================================
// Media IPC Response Types
// ============================================================================

export interface MediaMetadataResponse {
  metadata: {
    duration: number;
    width: number;
    height: number;
    framerate: number;
    size: number;
    format: string;
  } | null;
  thumbnail: string | null; // Base64 encoded image
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MediaClearCacheResponse {
  // void return type
}

export interface MediaUrlResponse {
  mediaUrl: string | null;
}

// ============================================================================
// Subtitle IPC Response Types
// ============================================================================

export interface SubtitleWorkspaceLoadResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspaceData: any | null; // WorkspaceSubtitleData from SubtitleIPCHandlers
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubtitleWorkspaceSaveResponse extends BaseIPCResponse {
  // No additional fields - just success/error
}

export interface SubtitleWorkspaceExistsResponse {
  exists: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubtitleWorkspaceDeleteResponse extends BaseIPCResponse {
  // No additional fields - just success/error
}

export interface SubtitleImportJsonResponse extends BaseIPCResponse {
  subtitles?: unknown[];
}

export interface SubtitleValidateFormatResponse {
  isValid: boolean;
  errors?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubtitleSyncToStepResponse extends BaseIPCResponse {
  // No additional fields - just success/error
}

export interface SubtitleSyncFromStepResponse {
  subtitles?: unknown[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubtitleClearWorkspaceResponse {
  // void return type
}

export interface SubtitleListWorkspacesResponse {
  workspaces: string[];
}

export interface SubtitleWorkspaceMetadataResponse {
  metadata: {
    subtitleCount: number;
    lastSaved: string;
  } | null;
}

export interface SubtitleCleanupOrphanedDataResponse {
  removedCount: number;
}

export interface SubtitleExportWorkspaceDataResponse extends BaseIPCResponse {
  data?: string; // JSON string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubtitleImportWorkspaceDataResponse extends BaseIPCResponse {
  // No additional fields - just success/error
}

// ============================================================================
// App/Workspace IPC Response Types
// ============================================================================

export interface AppStateResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any; // AppState from store
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppSetActiveWorkspaceResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppUpdateWindowStateResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppClearRecentWorkspacesResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppValidateAndCleanStateResponse {
  // void return type
}

export interface WorkspaceCreateResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace: any; // WorkspaceSchema
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceDeleteResponse {
  // void return type
}

export interface WorkspaceListResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspaces: any[]; // WorkspaceSchema[]
}

export interface WorkspaceGetResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace: any | null; // WorkspaceSchema | null
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceUpdateResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceRenameResponse {
  // void return type
}

export interface WorkspaceDuplicateResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace: any; // WorkspaceSchema
}

export interface WorkspaceExistsResponse {
  exists: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StepUpdateContentResponse {
  // void return type
}

export interface StepGetContentResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any; // StepContent
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StepResetContentResponse {
  // void return type
}

export interface GroupCreateResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group: any; // GroupSchema
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GroupDeleteResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GroupUpdateResponse {
  // void return type
}

export interface GroupListResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groups: any[]; // GroupSchema[]
}

export interface GroupGetResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group: any | null; // GroupSchema | null
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceAddToGroupResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceRemoveFromGroupResponse {
  // void return type
}

// ============================================================================
// Workflow IPC Response Types
// ============================================================================

export interface WorkflowGetStateResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any; // WorkflowState
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkflowSetCurrentStepResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkflowSetStepStateResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkflowResetStateResponse {
  // void return type
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkflowRemoveWorkspaceStateResponse {
  // void return type
}

export interface WorkflowGetAllStatesResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  states: Record<string, any>; // Record<string, WorkflowState>
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkflowCleanupResponse {
  // void return type
}
