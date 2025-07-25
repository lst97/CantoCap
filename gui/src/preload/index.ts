import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { 
  ElectronAPI, 
  AppConfig, 
  DependencyStatus, 
  HardwareInfo, 
  FileDialogOptions,
  FileDialogResult,
  IPCProgressUpdate,
  IPCProcessComplete,
  IPCProcessError,
  IPCProcessMessage,
  InitializationResult
} from '../types'

// Custom APIs for renderer
const api: ElectronAPI = {
  // System Operations
  checkDependencies: (): Promise<Record<string, DependencyStatus>> => 
    ipcRenderer.invoke('check-dependencies'),

  // Initialization and Setup
  runInitialization: (): Promise<InitializationResult> => 
    ipcRenderer.invoke('run-initialization'),

  openPythonDownload: (): Promise<void> => 
    ipcRenderer.invoke('open-python-download'),

  openPyenvGuide: (): Promise<void> => 
    ipcRenderer.invoke('open-pyenv-guide'),

  openFFmpegDownload: (): Promise<void> => 
    ipcRenderer.invoke('open-ffmpeg-download'),

  runEngineSetup: (): Promise<boolean> => 
    ipcRenderer.invoke('run-engine-setup'),

  getAppVersion: (): Promise<string> => 
    ipcRenderer.invoke('get-app-version'),

  openExternalUrl: (url: string): Promise<void> => 
    ipcRenderer.invoke('open-external-url', url),

  // Window Controls
  minimizeWindow: (): Promise<void> => 
    ipcRenderer.invoke('window:minimize'),

  maximizeWindow: (): Promise<void> => 
    ipcRenderer.invoke('window:maximize'),

  closeWindow: (): Promise<void> => 
    ipcRenderer.invoke('window:close'),

  isWindowMaximized: (): Promise<boolean> => 
    ipcRenderer.invoke('window:isMaximized'),

  getPlatform: (): Promise<string> => 
    ipcRenderer.invoke('get-platform'),

  // File System Operations
  openFileDialog: (options?: FileDialogOptions): Promise<FileDialogResult> => 
    ipcRenderer.invoke('dialog:openFile', options),

  openFolderDialog: (): Promise<FileDialogResult> => 
    ipcRenderer.invoke('dialog:openFolder'),

  // Process Management
  startTranscription: (config: AppConfig): void => 
    ipcRenderer.send('start-transcription', config),

  cancelProcess: (): void => 
    ipcRenderer.send('cancel-process'),

  checkHardware: (): Promise<HardwareInfo> => 
    ipcRenderer.invoke('check-hardware'),

  // Event Listeners (with automatic cleanup)
  onProgressUpdate: (callback: (data: IPCProgressUpdate) => void): (() => void) => {
    const wrappedCallback = (event: IpcRendererEvent, data: IPCProgressUpdate) => callback(data)
    ipcRenderer.on('progress-update', wrappedCallback)
    
    // Return cleanup function
    return () => ipcRenderer.removeListener('progress-update', wrappedCallback)
  },

  onProcessStarted: (callback: (data: IPCProcessMessage) => void): (() => void) => {
    const wrappedCallback = (event: IpcRendererEvent, data: IPCProcessMessage) => callback(data)
    ipcRenderer.on('process-started', wrappedCallback)
    return () => ipcRenderer.removeListener('process-started', wrappedCallback)
  },

  onProcessComplete: (callback: (data: IPCProcessComplete) => void): (() => void) => {
    const wrappedCallback = (event: IpcRendererEvent, data: IPCProcessComplete) => callback(data)
    ipcRenderer.on('process-complete', wrappedCallback)
    return () => ipcRenderer.removeListener('process-complete', wrappedCallback)
  },

  onProcessError: (callback: (data: IPCProcessError) => void): (() => void) => {
    const wrappedCallback = (event: IpcRendererEvent, data: IPCProcessError) => callback(data)
    ipcRenderer.on('process-error', wrappedCallback)
    return () => ipcRenderer.removeListener('process-error', wrappedCallback)
  },

  onProcessMessage: (callback: (data: IPCProcessMessage) => void): (() => void) => {
    const wrappedCallback = (event: IpcRendererEvent, data: IPCProcessMessage) => callback(data)
    ipcRenderer.on('process-message', wrappedCallback)
    return () => ipcRenderer.removeListener('process-message', wrappedCallback)
  },

  // Utility Functions
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('progress-update')
    ipcRenderer.removeAllListeners('process-started')
    ipcRenderer.removeAllListeners('process-complete')
    ipcRenderer.removeAllListeners('process-error')
    ipcRenderer.removeAllListeners('process-message')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('cantocapAPI', api)
    contextBridge.exposeInMainWorld('electronAPI', api) // Add alias for consistency
  } catch (error) {
    console.error('Failed to expose APIs:', error)
  }
} else {
  // @ts-ignore (fallback for non-isolated context)
  window.electron = electronAPI
  // @ts-ignore (fallback for non-isolated context)
  window.cantocapAPI = api
  // @ts-ignore (fallback for non-isolated context)
  window.electronAPI = api
}

// Security: Remove Node.js globals
// @ts-ignore
delete global.process
// @ts-ignore
delete global.Buffer
// @ts-ignore
delete global.setImmediate
// @ts-ignore
delete global.clearImmediate

// Security: Prevent access to Node.js modules
Object.freeze(process)

// Development utilities (only in dev mode)
if (process.env.NODE_ENV === 'development') {
  const debugAPI = {
    getProcessInfo: () => ({
      platform: process.platform,
      version: process.version,
      versions: process.versions
    }),
    testIPC: () => ipcRenderer.invoke('check-dependencies')
  }

  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('debugAPI', debugAPI)
    } catch (error) {
      console.error('Failed to expose debug API:', error)
    }
  } else {
    // @ts-ignore (fallback for non-isolated context)
    window.debugAPI = debugAPI
  }
}