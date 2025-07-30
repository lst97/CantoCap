// Enhanced Error Handling Types

export enum ErrorCategory {
  RUNTIME = 'runtime',
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  PROCESSING = 'processing',
  VALIDATION = 'validation',
  ENGINE_IPC = 'engine_ipc',
  ENGINE_STARTUP = 'engine_startup',
  ENGINE_RUNTIME = 'engine_runtime',
  ENGINE_EXIT = 'engine_exit',
  ENGINE_SPAWN = 'engine_spawn',
  ENGINE_SETUP = 'engine_setup',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SystemInfo {
  userAgent: string
  platform: string
  language: string
  cookieEnabled: boolean
  onLine: boolean
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

export interface UserAction {
  type: string
  timestamp: number
  target?: string
  details?: Record<string, any>
}

export interface Breadcrumb {
  timestamp: number
  category: string
  message: string
  level: 'info' | 'warning' | 'error'
  data?: Record<string, any>
}

export interface ErrorContext {
  errorId: string
  timestamp: number
  category: ErrorCategory
  severity: ErrorSeverity
  userAgent: string
  appVersion: string
  systemInfo: SystemInfo
  userActions: UserAction[]
  componentStack: string
  breadcrumbs: Breadcrumb[]
  url: string
  userId?: string
  sessionId: string
}

export interface RecoveryAction {
  id: string
  label: string
  description: string
  icon: string
  action: () => void
  primary?: boolean
  dangerous?: boolean
}

export interface ErrorExplanation {
  title: string
  description: string
  possibleCauses: string[]
  suggestedActions: string[]
  technicalDetails?: string
}

// Engine-specific error types
export interface EngineError extends Error {
  category: ErrorCategory
  type: 'startup_error' | 'runtime_error' | 'exit_error' | 'spawn_error' | 'setup_error'
  exitCode?: number
  engineStage?: string
  ipcData?: any
}

export interface EngineErrorContext extends ErrorContext {
  engineType: 'startup_error' | 'runtime_error' | 'exit_error' | 'spawn_error' | 'setup_error'
  engineStage?: string
  exitCode?: number
  ipcData?: any
  recoveryAttempts?: number
}

export interface EngineRecoveryAction extends RecoveryAction {
  engineSpecific?: boolean
  requiresRestart?: boolean
  requiresEngineSetup?: boolean
}