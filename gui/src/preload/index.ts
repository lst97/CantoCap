import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  ElectronAPI,
  AppConfig,
  DependencyStatus,
  HardwareInfo,
  FileDialogOptions,
  FileDialogResult,
  SaveFileDialogResult,
  IPCMessage,
  InitializationResult,
} from '../types';

// Custom APIs for renderer - SIMPLIFIED FOR WORKSPACE MIGRATION
const api: ElectronAPI = {
  // System Operations
  checkDependencies: (): Promise<Record<string, DependencyStatus>> =>
    ipcRenderer.invoke('check-dependencies'),

  // Initialization and Setup
  runInitialization: (): Promise<InitializationResult> => ipcRenderer.invoke('run-initialization'),

  openPythonDownload: (): Promise<void> => ipcRenderer.invoke('open-python-download'),

  openPyenvGuide: (): Promise<void> => ipcRenderer.invoke('open-pyenv-guide'),

  openFFmpegDownload: (): Promise<void> => ipcRenderer.invoke('open-ffmpeg-download'),

  runEngineSetup: (): Promise<boolean> => ipcRenderer.invoke('run-engine-setup'),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  openExternalUrl: (url: string): Promise<void> => ipcRenderer.invoke('open-external-url', url),

  // Window Controls
  getPlatform: (): Promise<string> => ipcRenderer.invoke('get-platform'),

  // DevTools Controls
  openDevTools: (): Promise<void> => ipcRenderer.invoke('devtools:open'),
  closeDevTools: (): Promise<void> => ipcRenderer.invoke('devtools:close'),
  toggleDevTools: (): Promise<void> => ipcRenderer.invoke('devtools:toggle'),

  // File System Operations
  openFileDialog: (options?: FileDialogOptions): Promise<FileDialogResult> =>
    ipcRenderer.invoke('dialog:openFile', options),

  openFolderDialog: (): Promise<FileDialogResult> => ipcRenderer.invoke('dialog:openFolder'),

  saveFileDialog: (options?: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<SaveFileDialogResult> => ipcRenderer.invoke('dialog:saveFile', options),

  writeExportFile: (filePath: string, content: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('export:writeFile', filePath, content),

  readJsonFile: (filePath: string): Promise<any> => ipcRenderer.invoke('file:readJson', filePath),

  // Video Processing
  getVideoMetadata: (
    filePath: string
  ): Promise<{
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
  }> => ipcRenderer.invoke('video:getMetadata', filePath),

  clearVideoCache: (): Promise<void> => ipcRenderer.invoke('video:clearCache'),

  getMediaUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('media:getUrl', filePath),

  validateMediaFile: (
    filePath: string
  ): Promise<{
    isValid: boolean;
    exists: boolean;
    error?: string;
  }> => ipcRenderer.invoke('media:validateFile', filePath),

  // Process Management
  startTranscription: (config: AppConfig): void => ipcRenderer.send('start-transcription', config),

  cancelProcess: (): void => ipcRenderer.send('cancel-process'),

  checkHardware: (): Promise<HardwareInfo> => ipcRenderer.invoke('check-hardware'),

  // Modern IPC Message Handler
  onIPCMessage: (callback: (data: IPCMessage) => void): (() => void) => {
    const wrappedCallback = (_: IpcRendererEvent, data: IPCMessage) => callback(data);
    ipcRenderer.on('ipc-message', wrappedCallback);
    return () => ipcRenderer.removeListener('ipc-message', wrappedCallback);
  },

  // Subtitle Management - Workspace Operations
  subtitleWorkspaceLoad: (workspaceId: string): Promise<any> =>
    ipcRenderer.invoke('subtitle:workspace-load', workspaceId),

  subtitleWorkspaceSave: (
    workspaceId: string,
    data: any
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('subtitle:workspace-save', workspaceId, data),

  subtitleWorkspaceExists: (workspaceId: string): Promise<boolean> =>
    ipcRenderer.invoke('subtitle:workspace-exists', workspaceId),

  subtitleWorkspaceDelete: (workspaceId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('subtitle:workspace-delete', workspaceId),

  // Subtitle Management - Import Operations (JSON only)
  subtitleImportJson: (
    filePath: string
  ): Promise<{ success: boolean; subtitles?: any[]; error?: string }> =>
    ipcRenderer.invoke('subtitle:import-json', filePath),

  subtitleValidateFormat: (data: any): Promise<{ isValid: boolean; errors?: string[] }> =>
    ipcRenderer.invoke('subtitle:validate-format', data),

  // Subtitle Management - Step Integration
  subtitleSyncToStep: (workspaceId: string, subtitles: any[]): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('subtitle:sync-to-step', workspaceId, subtitles),

  subtitleSyncFromStep: (workspaceId: string): Promise<{ subtitles?: any[] }> =>
    ipcRenderer.invoke('subtitle:sync-from-step', workspaceId),

  // Workflow State Management - CRITICAL FOR STEP TRANSITIONS
  workflowGetState: (workspaceId: string): Promise<any> =>
    ipcRenderer.invoke('workflow:getState', workspaceId),

  workflowSetCurrentStep: (workspaceId: string, step: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('workflow:setCurrentStep', workspaceId, step),

  workflowSetStepState: (
    workspaceId: string,
    step: string,
    state: string
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('workflow:setStepState', workspaceId, step, state),

  workflowResetState: (workspaceId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('workflow:resetState', workspaceId),

  workflowRemoveWorkspaceState: (workspaceId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('workflow:removeWorkspaceState', workspaceId),

  workflowGetAllStates: (): Promise<any> => ipcRenderer.invoke('workflow:getAllStates'),

  workflowCleanup: (activeWorkspaceIds: string[]): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('workflow:cleanup', activeWorkspaceIds),

  // Processing Control - CRITICAL FOR STEP 2→3 TRANSITION
  processingStart: (config: any): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('processing:start', config),

  processingCancel: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('processing:cancel'),

  processingGetStatus: (): Promise<{
    success: boolean;
    isRunning: boolean;
    status: string;
    error?: string;
  }> => ipcRenderer.invoke('processing:getStatus'),

  processingConvertConfig: (
    stepConfig: any
  ): Promise<{ success: boolean; config?: any; error?: string }> =>
    ipcRenderer.invoke('processing:convertConfig', stepConfig),

  processingValidateConfig: (
    config: any
  ): Promise<{ success: boolean; isValid: boolean; errors?: string[]; error?: string }> =>
    ipcRenderer.invoke('processing:validateConfig', config),

  processingGetTimeEstimate: (
    config: any
  ): Promise<{ success: boolean; estimate?: any; error?: string }> =>
    ipcRenderer.invoke('processing:getTimeEstimate', config),

  processingValidateFFmpeg: (): Promise<{
    success: boolean;
    isValid: boolean;
    ffmpegPath?: string;
    error?: string;
  }> => ipcRenderer.invoke('processing:validateFFmpeg'),

  // IPC Event Handlers for processing events
  onProcessingEvent: (callback: (data: any) => void): (() => void) => {
    const wrappedCallback = (_: any, data: any) => callback(data);
    ipcRenderer.on('processing:event', wrappedCallback);
    return () => ipcRenderer.removeListener('processing:event', wrappedCallback);
  },

  onWorkflowStepChanged: (callback: (data: any) => void): (() => void) => {
    const wrappedCallback = (_: any, data: any) => callback(data);
    ipcRenderer.on('workflow:stepChanged', wrappedCallback);
    return () => ipcRenderer.removeListener('workflow:stepChanged', wrappedCallback);
  },

  onWorkflowStepStateChanged: (callback: (data: any) => void): (() => void) => {
    const wrappedCallback = (_: any, data: any) => callback(data);
    ipcRenderer.on('workflow:stepStateChanged', wrappedCallback);
    return () => ipcRenderer.removeListener('workflow:stepStateChanged', wrappedCallback);
  },

  onWorkflowStateReset: (callback: (data: any) => void): (() => void) => {
    const wrappedCallback = (_: any, data: any) => callback(data);
    ipcRenderer.on('workflow:stateReset', wrappedCallback);
    return () => ipcRenderer.removeListener('workflow:stateReset', wrappedCallback);
  },

  // Utility Functions
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('ipc-message');
    ipcRenderer.removeAllListeners('processing:event');
    ipcRenderer.removeAllListeners('workflow:stepChanged');
    ipcRenderer.removeAllListeners('workflow:stepStateChanged');
    ipcRenderer.removeAllListeners('workflow:stateReset');
  },
};

// Custom electron API for IPC compatibility
const electronCompat = {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, callback: (...args: any[]) => void) => ipcRenderer.on(channel, callback),
    removeListener: (channel: string, callback: (...args: any[]) => void) => ipcRenderer.removeListener(channel, callback),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronCompat);
    contextBridge.exposeInMainWorld('cantocapAPI', api);
    contextBridge.exposeInMainWorld('electronAPI', api); // Add alias for consistency
  } catch (error) {
    console.error('Failed to expose APIs:', error);
  }
} else {
  (window as any).electron = electronCompat;
  (window as any).cantocapAPI = api;
  (window as any).electronAPI = api;
}

// Security: Remove Node.js globals (if they exist)
try {
  delete (global as any).process;
  delete (global as any).Buffer;
  delete (global as any).setImmediate;
  delete (global as any).clearImmediate;
} catch {
  // Ignore deletion errors
}

// Security: Prevent access to Node.js modules
Object.freeze(process);

// Development utilities (only in dev mode)
if (process.env.NODE_ENV === 'development') {
  const debugAPI = {
    getProcessInfo: () => ({
      platform: process.platform,
      version: process.version,
      versions: process.versions,
    }),
    testIPC: () => ipcRenderer.invoke('check-dependencies'),
  };

  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('debugAPI', debugAPI);
    } catch (error) {
      console.error('Failed to expose debug API:', error);
    }
  } else {
    (window as any).debugAPI = debugAPI;
  }
}
