import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type {
  ElectronAPI,
  AppConfig,
  DependencyStatus,
  HardwareInfo,
  FileDialogOptions,
  FileDialogResult,
  SaveFileDialogResult,
  IPCMessage,
  IPCProgressUpdate,
  IPCProcessComplete,
  IPCProcessError,
  IPCProcessMessage,
  InitializationResult,
} from "../types";
import type {
  WorkspaceMetadata,
  MigrationStatus,
  WorkspacePerformanceMetrics
} from "../renderer/src/types/workspace";
import {
  SUBTITLE_IPC_CHANNELS,
  CreateSubtitleFileParams,
  LoadSubtitleFileParams,
  SaveSubtitleFileParams,
  DeleteSubtitleFileParams,
  GetSubtitleMetadataParams,
  CleanupSubtitleFilesParams,
  BatchSubtitleOperationParams,
  SubtitleFileResult,
  SubtitleFileContent,
  SubtitleFileMetadata,
  BatchSubtitleOperationResult,
  PathValidationResult,
  SubtitleFileCacheMetrics
} from "../types/subtitle-ipc";

// Custom APIs for renderer
const api: ElectronAPI = {
  // System Operations
  checkDependencies: (): Promise<Record<string, DependencyStatus>> =>
    ipcRenderer.invoke("check-dependencies"),

  // Initialization and Setup
  runInitialization: (): Promise<InitializationResult> =>
    ipcRenderer.invoke("run-initialization"),

  openPythonDownload: (): Promise<void> =>
    ipcRenderer.invoke("open-python-download"),

  openPyenvGuide: (): Promise<void> => ipcRenderer.invoke("open-pyenv-guide"),

  openFFmpegDownload: (): Promise<void> =>
    ipcRenderer.invoke("open-ffmpeg-download"),

  runEngineSetup: (): Promise<boolean> =>
    ipcRenderer.invoke("run-engine-setup"),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),

  openExternalUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke("open-external-url", url),

  // Window Controls (these are handled separately)
  getPlatform: (): Promise<string> => ipcRenderer.invoke("get-platform"),

  // DevTools Controls
  openDevTools: (): Promise<void> => ipcRenderer.invoke("devtools:open"),
  closeDevTools: (): Promise<void> => ipcRenderer.invoke("devtools:close"),
  toggleDevTools: (): Promise<void> => ipcRenderer.invoke("devtools:toggle"),

  // File System Operations
  openFileDialog: (options?: FileDialogOptions): Promise<FileDialogResult> =>
    ipcRenderer.invoke("dialog:openFile", options),

  openFolderDialog: (): Promise<FileDialogResult> =>
    ipcRenderer.invoke("dialog:openFolder"),

  saveFileDialog: (options?: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<SaveFileDialogResult> =>
    ipcRenderer.invoke("dialog:saveFile", options),

  writeExportFile: (
    filePath: string,
    content: string
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("export:writeFile", filePath, content),

  readJsonFile: (filePath: string): Promise<any> =>
    ipcRenderer.invoke("file:readJson", filePath),

  // Config Management
  getConfig: (): Promise<any> => ipcRenderer.invoke("config:get"),

  setConfig: (section: string, value: any): Promise<void> =>
    ipcRenderer.invoke("config:set", section, value),

  updateConfig: (updates: any): Promise<void> =>
    ipcRenderer.invoke("config:update", updates),

  getConfigSection: (section: string): Promise<any> =>
    ipcRenderer.invoke("config:getSection", section),

  updateConfigSection: (section: string, updates: any): Promise<void> =>
    ipcRenderer.invoke("config:updateSection", section, updates),

  setLastInputPath: (path: string): Promise<void> =>
    ipcRenderer.invoke("config:setLastInputPath", path),

  setLastOutputPath: (path: string): Promise<void> =>
    ipcRenderer.invoke("config:setLastOutputPath", path),

  resetConfig: (): Promise<void> => ipcRenderer.invoke("config:reset"),

  resetConfigSection: (section: string): Promise<void> =>
    ipcRenderer.invoke("config:resetSection", section),

  // Process Management
  startTranscription: (config: AppConfig): void =>
    ipcRenderer.send("start-transcription", config),

  cancelProcess: (): void => ipcRenderer.send("cancel-process"),

  checkHardware: (): Promise<HardwareInfo> =>
    ipcRenderer.invoke("check-hardware"),

  // Modern IPC Message Handler
  onIPCMessage: (callback: (data: IPCMessage) => void): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: IPCMessage) =>
      callback(data);
    ipcRenderer.on("ipc-message", wrappedCallback);
    return () => ipcRenderer.removeListener("ipc-message", wrappedCallback);
  },

  // Legacy Event Listeners (for backward compatibility)
  onProgressUpdate: (
    callback: (data: IPCProgressUpdate) => void
  ): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: IPCProgressUpdate) =>
      callback(data);
    ipcRenderer.on("progress-update", wrappedCallback);

    // Return cleanup function
    return () => ipcRenderer.removeListener("progress-update", wrappedCallback);
  },

  onProcessStarted: (
    callback: (data: IPCProcessMessage) => void
  ): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: IPCProcessMessage) =>
      callback(data);
    ipcRenderer.on("process-started", wrappedCallback);
    return () => ipcRenderer.removeListener("process-started", wrappedCallback);
  },

  onProcessComplete: (
    callback: (data: IPCProcessComplete) => void
  ): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: IPCProcessComplete) =>
      callback(data);
    ipcRenderer.on("process-complete", wrappedCallback);
    return () =>
      ipcRenderer.removeListener("process-complete", wrappedCallback);
  },

  onProcessError: (callback: (data: IPCProcessError) => void): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: IPCProcessError) =>
      callback(data);
    ipcRenderer.on("process-error", wrappedCallback);
    return () => ipcRenderer.removeListener("process-error", wrappedCallback);
  },

  onProcessMessage: (
    callback: (data: IPCProcessMessage) => void
  ): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: IPCProcessMessage) =>
      callback(data);
    ipcRenderer.on("process-message", wrappedCallback);
    return () => ipcRenderer.removeListener("process-message", wrappedCallback);
  },

  // Workspace Management
  listWorkspaces: (): Promise<Array<WorkspaceMetadata & { id: string, name: string, isActive: boolean }>> =>
    ipcRenderer.invoke("workspace:list"),

  createWorkspace: (name: string): Promise<{ success: boolean, workspaceId: string }> =>
    ipcRenderer.invoke("workspace:create", name),

  deleteWorkspace: (workspaceId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:delete", workspaceId),

  syncWorkspace: (workspaceId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:sync", workspaceId),

  // Configuration Management
  getWorkspaceConfig: (workspaceId: string): Promise<AppConfig | null> =>
    ipcRenderer.invoke("workspace:getConfig", workspaceId),

  syncWorkspaceConfig: (workspaceId: string, config: AppConfig): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:syncConfig", workspaceId, config),

  // Migration Operations
  startWorkspaceMigration: (): Promise<{ success: boolean, backupPath: string }> =>
    ipcRenderer.invoke("workspace:startMigration"),

  completeWorkspaceMigration: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:completeMigration"),

  rollbackWorkspaceMigration: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:rollbackMigration"),

  getWorkspaceMigrationStatus: (): Promise<MigrationStatus | null> =>
    ipcRenderer.invoke("workspace:getMigrationStatus"),

  // Backup & Recovery
  createWorkspaceBackup: (workspaceId: string): Promise<{ success: boolean, backupPath: string }> =>
    ipcRenderer.invoke("workspace:createBackup", workspaceId),

  restoreWorkspaceBackup: (backupPath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:restoreBackup", backupPath),

  // Performance Monitoring
  getWorkspacePerformanceMetrics: (): Promise<WorkspacePerformanceMetrics[]> =>
    ipcRenderer.invoke("workspace:getPerformanceMetrics"),

  clearWorkspacePerformanceMetrics: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:clearPerformanceMetrics"),

  // Initialization
  initializeWorkspaceSystem: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("workspace:initialize"),

  // Workspace Event Listeners
  onWorkspaceMigrationUpdate: (callback: (data: MigrationStatus) => void): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: MigrationStatus) => callback(data);
    ipcRenderer.on("workspace:migrationUpdate", wrappedCallback);
    return () => ipcRenderer.removeListener("workspace:migrationUpdate", wrappedCallback);
  },

  onWorkspaceMigrationProgress: (callback: (data: { phase: string, progress: number, message: string }) => void): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: { phase: string, progress: number, message: string }) => callback(data);
    ipcRenderer.on("workspace:migrationProgress", wrappedCallback);
    return () => ipcRenderer.removeListener("workspace:migrationProgress", wrappedCallback);
  },

  onWorkspaceMigrationRollback: (callback: (data: { success: boolean, message: string }) => void): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: { success: boolean, message: string }) => callback(data);
    ipcRenderer.on("workspace:migrationRollback", wrappedCallback);
    return () => ipcRenderer.removeListener("workspace:migrationRollback", wrappedCallback);
  },

  // ============================================================================
  // SUBTITLE FILE OPERATIONS
  // ============================================================================

  // Core subtitle file operations
  createSubtitleFile: (params: CreateSubtitleFileParams): Promise<SubtitleFileResult<SubtitleFileMetadata>> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.CREATE, params),

  loadSubtitleFile: (params: LoadSubtitleFileParams): Promise<SubtitleFileResult<SubtitleFileContent>> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.LOAD, params),

  saveSubtitleFile: (params: SaveSubtitleFileParams): Promise<SubtitleFileResult<SubtitleFileMetadata>> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.SAVE, params),

  deleteSubtitleFile: (params: DeleteSubtitleFileParams): Promise<SubtitleFileResult<boolean>> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.DELETE, params),

  getSubtitleMetadata: (params: GetSubtitleMetadataParams): Promise<SubtitleFileResult<SubtitleFileMetadata[]>> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.METADATA, params),

  cleanupSubtitleFiles: (params: CleanupSubtitleFilesParams): Promise<SubtitleFileResult<{
    deletedFiles: string[]
    compressedFiles: string[]
    freedSpace: number
  }>> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.CLEANUP, params),

  // Batch operations
  batchSubtitleOperation: (params: BatchSubtitleOperationParams): Promise<BatchSubtitleOperationResult> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.BATCH_OPERATION, params),

  // Cache management
  getSubtitleCacheMetrics: (): Promise<SubtitleFileCacheMetrics | null> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.CACHE_METRICS),

  clearSubtitleCache: (workspaceId?: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.CACHE_CLEAR, workspaceId),

  // Performance monitoring
  getSubtitlePerformanceMetrics: (): Promise<any[]> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.PERFORMANCE_METRICS),

  // Validation
  validateSubtitlePath: (workspaceId: string, path: string, operation: 'read' | 'write' | 'delete'): Promise<PathValidationResult> =>
    ipcRenderer.invoke(SUBTITLE_IPC_CHANNELS.VALIDATE_PATH, { workspaceId, path, operation }),

  // Event listeners for subtitle operations
  onSubtitleStreamProgress: (callback: (data: any) => void): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on(SUBTITLE_IPC_CHANNELS.STREAM_PROGRESS, wrappedCallback);
    return () => ipcRenderer.removeListener(SUBTITLE_IPC_CHANNELS.STREAM_PROGRESS, wrappedCallback);
  },

  // ============================================================================
  // TEMP FILE STORAGE
  // ============================================================================
  
  // Store imported JSON caption as temp file
  storeTempSubtitleData: (data: any): Promise<{ success: boolean, tempFilePath?: string, error?: string }> =>
    ipcRenderer.invoke('store-temp-subtitle-data', data),

  // Load temp subtitle data
  loadTempSubtitleData: (): Promise<{ success: boolean, data?: any, error?: string }> =>
    ipcRenderer.invoke('load-temp-subtitle-data'),

  // Clear temp subtitle data
  clearTempSubtitleData: (): Promise<{ success: boolean, error?: string }> =>
    ipcRenderer.invoke('clear-temp-subtitle-data'),

  // Utility Functions
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners("ipc-message");
    ipcRenderer.removeAllListeners("progress-update");
    ipcRenderer.removeAllListeners("process-started");
    ipcRenderer.removeAllListeners("process-complete");
    ipcRenderer.removeAllListeners("process-error");
    ipcRenderer.removeAllListeners("process-message");
    // Workspace listeners
    ipcRenderer.removeAllListeners("workspace:migrationUpdate");
    ipcRenderer.removeAllListeners("workspace:migrationProgress");
    ipcRenderer.removeAllListeners("workspace:migrationRollback");
    // Subtitle file listeners
    ipcRenderer.removeAllListeners(SUBTITLE_IPC_CHANNELS.STREAM_PROGRESS);
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("cantocapAPI", api);
    contextBridge.exposeInMainWorld("electronAPI", api); // Add alias for consistency
  } catch (error) {
    console.error("Failed to expose APIs:", error);
  }
} else {
  (window as any).electron = electronAPI;
  (window as any).cantocapAPI = api;
  (window as any).electronAPI = api;
}

// Security: Remove Node.js globals (if they exist)
try {
  delete (global as any).process;
  delete (global as any).Buffer;
  delete (global as any).setImmediate;
  delete (global as any).clearImmediate;
} catch (e) {
  // Ignore deletion errors
}

// Security: Prevent access to Node.js modules
Object.freeze(process);

// Development utilities (only in dev mode)
if (process.env.NODE_ENV === "development") {
  const debugAPI = {
    getProcessInfo: () => ({
      platform: process.platform,
      version: process.version,
      versions: process.versions,
    }),
    testIPC: () => ipcRenderer.invoke("check-dependencies"),
  };

  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld("debugAPI", debugAPI);
    } catch (error) {
      console.error("Failed to expose debug API:", error);
    }
  } else {
    (window as any).debugAPI = debugAPI;
  }
}
