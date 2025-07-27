// Application Types and Interfaces

export interface DependencyStatus {
  name: string
  status: 'checking' | 'found' | 'missing' | 'error'
  version: string | null
  path: string | null
  available: boolean
  downloadUrl?: string
  autoInstallUrls?: Record<string, string>
  helpText?: string
  error: string | null
}

export interface ProcessingState {
  isActive: boolean
  stage: 'idle' | 'preparing' | 'transcribing' | 'refining' | 'completed' | 'error' | 'cancelled'
  progress: number
  message: string
  timeElapsed: number
  timeRemaining: number
  currentStep: number | null
  totalSteps: number | null
  hardwareInfo: HardwareInfo | null
  error: string | null
  startTime?: number
}

export interface HardwareInfo {
  gpuAcceleration?: boolean
  memoryUsage?: string
  cpuUsage?: string
  raw_output?: string
  python_available?: boolean
  engine_path?: string
  [key: string]: any
}

export interface AppConfig {
  inputFile: string | null
  outputFile: string | null
  language: string
  model: string | null
  priority: 'speed' | 'balanced' | 'quality'
  speakers: boolean
  written: boolean
  music: boolean
  charset: 'traditional' | 'simplified'
  geminiKey: string
  noGeminiRefinement: boolean
  maxChunkDuration: number
  videoQuality: '360p' | '480p' | '720p'
  terminologyConfig: string | null
  ffmpegPath: string | null
  subtitle: string | null
  duration: number
  verbose: boolean
  startTime: number | null
  endTime: number | null
}

export interface UIState {
  activeModal: string | null
  showAdvanced: boolean
  notifications: Notification[]
  theme: 'light' | 'dark' | 'system'
  sidebarExpanded: boolean
  processingHistory: ProcessingHistoryEntry[]
}

export interface Notification {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  timestamp: number
}

export interface ProcessingHistoryEntry {
  id: number
  inputFile: string
  outputFile: string | null
  status: 'started' | 'completed' | 'failed' | 'cancelled'
  timestamp: number
  config: AppConfig
}

export interface HardwareState {
  info: HardwareInfo | null
  lastChecked: number | null
  checking: boolean
  error: string | null
}

export interface AppState {
  isInitialized: boolean
  appVersion: string | null
  dependencies: {
    python: DependencyStatus
    ffmpeg: DependencyStatus
  }
  processing: ProcessingState
  config: AppConfig
  ui: UIState
  hardware: HardwareState
}

// Modern IPC Message Types
export interface IPCMessage {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  category: 'system' | 'process' | 'model' | 'user'
  source: string
  content: string
  data?: Record<string, any>
}

export interface ProcessedMessage extends IPCMessage {
  shouldNotify: boolean
  displayClass: string
  icon: string
}

// Legacy interfaces (for backward compatibility during transition)
export interface IPCProgressUpdate {
  progress?: number
  message?: string
  status?: string
  stage?: string
  currentStep?: number
  totalSteps?: number
  hardwareInfo?: HardwareInfo
}

export interface IPCProcessComplete {
  message: string
  outputFile?: string
  exitCode: number
}

export interface IPCProcessError {
  message: string
  type: 'startup_error' | 'runtime_error' | 'exit_error' | 'spawn_error' | 'setup_error'
  exitCode?: number
}

export interface IPCProcessMessage {
  message: string
}

// File Dialog Types
export interface FileDialogOptions {
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export interface FileDialogResult {
  canceled: boolean
  filePaths: string[]
}

// Initialization Types
export interface InitializationResult {
  success: boolean
  message: string
  dependencies: Record<string, DependencyStatus>
  requiresRestart?: boolean
}

// Electron API Types
export interface ElectronAPI {
  checkDependencies: () => Promise<Record<string, DependencyStatus>>
  runInitialization: () => Promise<InitializationResult>
  openPythonDownload: () => Promise<void>
  openPyenvGuide: () => Promise<void>
  openFFmpegDownload: () => Promise<void>
  runEngineSetup: () => Promise<boolean>
  getAppVersion: () => Promise<string>
  openExternalUrl: (url: string) => Promise<void>
  openFileDialog: (options?: FileDialogOptions) => Promise<FileDialogResult>
  openFolderDialog: () => Promise<FileDialogResult>
  startTranscription: (config: AppConfig) => void
  cancelProcess: () => void
  checkHardware: () => Promise<HardwareInfo>
  onIPCMessage: (callback: (data: IPCMessage) => void) => () => void
  onProgressUpdate: (callback: (data: IPCProgressUpdate) => void) => () => void
  onProcessStarted: (callback: (data: IPCProcessMessage) => void) => () => void
  onProcessComplete: (callback: (data: IPCProcessComplete) => void) => () => void
  onProcessError: (callback: (data: IPCProcessError) => void) => () => void
  onProcessMessage: (callback: (data: IPCProcessMessage) => void) => () => void
  removeAllListeners: () => void
}

// Global Window Interface Extension
declare global {
  interface Window {
    cantocapAPI: ElectronAPI
    electronAPI: ElectronAPI // Add alias for consistency
    electron: any
    debugAPI?: {
      getProcessInfo: () => any
      testIPC: () => Promise<any>
    }
  }
}

export {};