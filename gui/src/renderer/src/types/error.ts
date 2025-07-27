// Enhanced Error Handling Types

export enum ErrorCategory {
  RUNTIME = 'runtime',
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  PROCESSING = 'processing',
  VALIDATION = 'validation',
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