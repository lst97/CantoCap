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

// Custom APIs for renderer - SIMPLIFIED FOR WORKSPACE MIGRATION
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

  // Window Controls
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

  // Video Processing
  getVideoMetadata: (filePath: string): Promise<{
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
  }> => ipcRenderer.invoke("video:getMetadata", filePath),
  
  clearVideoCache: (): Promise<void> => ipcRenderer.invoke("video:clearCache"),
  
  getVideoDataUrl: (filePath: string): Promise<string | null> => 
    ipcRenderer.invoke("video:getDataUrl", filePath),

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


  
  // Utility Functions
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners("ipc-message");
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