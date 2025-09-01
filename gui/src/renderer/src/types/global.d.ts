// Global type declarations for CantoCap GUI
import type {
  DependencyStatus,
  InitializationResult,
  FileDialogOptions,
  FileDialogResult,
  SaveFileDialogResult,
  IPCMessage,
  HardwareInfo,
  AppConfig,
} from '../../../types';

declare global {
  interface Window {
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

      // App Settings (global)
      settingsGet: () => Promise<{
        success: boolean;
        settings?: { apiKeys: { gemini?: string; openai?: string; huggingface?: string } };
        error?: string;
      }>;
      settingsUpdate: (partial: {
        apiKeys?: { gemini?: string; openai?: string; huggingface?: string };
      }) => Promise<{
        success: boolean;
        settings?: { apiKeys: { gemini?: string; openai?: string; huggingface?: string } };
        error?: string;
      }>;

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
      readJsonFile: (filePath: string) => Promise<any>;

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
      subtitleWorkspaceLoad: (workspaceId: string) => Promise<any>;
      subtitleWorkspaceSave: (
        workspaceId: string,
        data: any
      ) => Promise<{ success: boolean; error?: string }>;
      subtitleWorkspaceExists: (workspaceId: string) => Promise<boolean>;
      subtitleWorkspaceDelete: (workspaceId: string) => Promise<{ success: boolean }>;

      // Subtitle Management - Import Operations
      subtitleImportJson: (
        filePath: string
      ) => Promise<{ success: boolean; subtitles?: any[]; error?: string }>;
      subtitleValidateFormat: (data: any) => Promise<{ isValid: boolean; errors?: string[] }>;

      // Subtitle Management - Step Integration
      subtitleSyncToStep: (workspaceId: string, subtitles: any[]) => Promise<{ success: boolean }>;
      subtitleSyncFromStep: (workspaceId: string) => Promise<{ subtitles?: any[] }>;

      // Workflow State Management - CRITICAL FOR STEP TRANSITIONS
      workflowGetState: (workspaceId: string) => Promise<any>;
      workflowSetCurrentStep: (workspaceId: string, step: string) => Promise<{ success: boolean }>;
      workflowSetStepState: (
        workspaceId: string,
        step: string,
        state: string
      ) => Promise<{ success: boolean }>;
      workflowResetState: (workspaceId: string) => Promise<{ success: boolean }>;
      workflowRemoveWorkspaceState: (workspaceId: string) => Promise<{ success: boolean }>;
      workflowGetAllStates: () => Promise<any>;
      workflowCleanup: (activeWorkspaceIds: string[]) => Promise<{ success: boolean }>;

      // Processing Control - CRITICAL FOR STEP 2→3 TRANSITION
      processingStart: (config: any) => Promise<{ success: boolean; error?: string }>;
      processingCancel: () => Promise<{ success: boolean; error?: string }>;
      processingGetStatus: () => Promise<{
        success: boolean;
        isRunning: boolean;
        status: string;
        error?: string;
      }>;
      processingConvertConfig: (
        stepConfig: any
      ) => Promise<{ success: boolean; config?: any; error?: string }>;
      processingValidateConfig: (
        config: any
      ) => Promise<{ success: boolean; isValid: boolean; errors?: string[]; error?: string }>;
      processingGetTimeEstimate: (
        config: any
      ) => Promise<{ success: boolean; estimate?: any; error?: string }>;
      processingValidateFFmpeg: () => Promise<{
        success: boolean;
        isValid: boolean;
        ffmpegPath?: string;
        error?: string;
      }>;

      // IPC Event Handlers for processing and workflow events
      onProcessingEvent: (callback: (data: any) => void) => () => void;
      onWorkflowStepChanged: (callback: (data: any) => void) => () => void;
      onWorkflowStepStateChanged: (callback: (data: any) => void) => () => void;
      onWorkflowStateReset: (callback: (data: any) => void) => () => void;

      // Utility Functions
      removeAllListeners: () => void;
    };

    // Electron API alias for consistency
    electronAPI: Window['cantocapAPI'];

    // Additional IPC access for compatibility
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, callback: (...args: any[]) => void) => void;
        removeListener: (channel: string, callback: (...args: any[]) => void) => void;
        removeAllListeners: (channel: string) => void;
      };
    };

    // Debug API (development only)
    debugAPI?: {
      getProcessInfo: () => {
        platform: string;
        version: string;
        versions: any;
      };
      testIPC: () => Promise<Record<string, DependencyStatus>>;
    };
  }
}

export {};
