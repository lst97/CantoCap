// ============================================================================
// SHARED TYPE DEFINITIONS - CENTRALIZED TYPES FOR CANTON CAP GUI
// ============================================================================

// Dependency checking types
export interface DependencyStatus {
  status: 'checking' | 'available' | 'missing' | 'error';
  available: boolean;
  version?: string;
  name?: string;
  helpText?: string;
  downloadUrl?: string;
}

// Application configuration types
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
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: <T = unknown>(channel: string, callback: (event: T) => void) => void;
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
    
    // Video Processing
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
    getVideoDataUrl: (filePath: string) => Promise<string | null>;
    
    // Process Management
    startTranscription: (config: AppConfig) => void;
    cancelProcess: () => void;
    checkHardware: () => Promise<HardwareInfo>;
    
    // Modern IPC Message Handler
    onIPCMessage: (callback: (data: IPCMessage) => void) => (() => void);
    
    // Subtitle Management - Workspace Operations
    subtitleWorkspaceLoad: (workspaceId: string) => Promise<unknown>;
    subtitleWorkspaceSave: (workspaceId: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
    subtitleWorkspaceExists: (workspaceId: string) => Promise<boolean>;
    subtitleWorkspaceDelete: (workspaceId: string) => Promise<{ success: boolean }>;
    
    // Subtitle Management - Import Operations
    subtitleImportJson: (filePath: string) => Promise<{ success: boolean; subtitles?: unknown[]; error?: string }>;
    subtitleValidateFormat: (data: unknown) => Promise<{ isValid: boolean; errors?: string[] }>;
    
    // Subtitle Management - Step Integration
    subtitleSyncToStep: (workspaceId: string, subtitles: unknown[]) => Promise<{ success: boolean }>;
    subtitleSyncFromStep: (workspaceId: string) => Promise<{ subtitles?: unknown[] }>;
    
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
  WhisperModel
} from '../renderer/src/stores/types/StoreTypes';