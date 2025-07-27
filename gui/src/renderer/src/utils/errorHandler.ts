import { ErrorCategory, ErrorSeverity, ErrorContext, SystemInfo, UserAction, Breadcrumb, ErrorExplanation } from '../types/error'

class ErrorHandler {
  private static instance: ErrorHandler
  private userActions: UserAction[] = []
  private breadcrumbs: Breadcrumb[] = []
  private sessionId: string = Math.random().toString(36).substring(2, 15)

  private constructor() {
    this.setupGlobalErrorHandlers()
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), 'unhandledrejection')
    })

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'global')
    })

    // Track user actions
    this.trackUserActions()
  }

  private trackUserActions(): void {
    const events = ['click', 'keydown', 'submit', 'change']
    
    events.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        const target = event.target as HTMLElement
        this.addUserAction({
          type: eventType,
          timestamp: Date.now(),
          target: target.tagName + (target.id ? `#${target.id}` : '') + (target.className ? `.${target.className}` : ''),
          details: {
            key: eventType === 'keydown' ? (event as KeyboardEvent).key : undefined,
            value: target instanceof HTMLInputElement ? target.value : undefined
          }
        })
      }, { passive: true })
    })
  }

  public addUserAction(action: UserAction): void {
    this.userActions.push(action)
    // Keep only last 50 actions
    if (this.userActions.length > 50) {
      this.userActions = this.userActions.slice(-50)
    }
  }

  public addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now()
    })
    // Keep only last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100)
    }
  }

  private getSystemInfo(): SystemInfo {
    const nav = navigator
    const memory = (performance as any)?.memory

    return {
      userAgent: nav.userAgent,
      platform: nav.platform,
      language: nav.language,
      cookieEnabled: nav.cookieEnabled,
      onLine: nav.onLine,
      memory: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      } : undefined
    }
  }

  public categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
      return ErrorCategory.NETWORK
    }
    
    if (message.includes('file') || stack.includes('filesystem') || message.includes('enoent')) {
      return ErrorCategory.FILE_SYSTEM
    }
    
    if (message.includes('processing') || message.includes('transcription') || message.includes('ffmpeg')) {
      return ErrorCategory.PROCESSING
    }
    
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorCategory.VALIDATION
    }
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError' || error.name === 'SyntaxError') {
      return ErrorCategory.RUNTIME
    }

    return ErrorCategory.UNKNOWN
  }

  public determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    const message = error.message.toLowerCase()
    
    if (message.includes('critical') || message.includes('fatal') || category === ErrorCategory.FILE_SYSTEM) {
      return ErrorSeverity.CRITICAL
    }
    
    if (category === ErrorCategory.PROCESSING || category === ErrorCategory.NETWORK) {
      return ErrorSeverity.HIGH
    }
    
    if (category === ErrorCategory.VALIDATION) {
      return ErrorSeverity.MEDIUM
    }
    
    return ErrorSeverity.LOW
  }

  public getErrorExplanation(error: Error, category: ErrorCategory): ErrorExplanation {
    const explanations: Record<ErrorCategory, ErrorExplanation> = {
      [ErrorCategory.RUNTIME]: {
        title: 'Application Runtime Error',
        description: 'A runtime error occurred while the application was running. This is typically caused by a programming issue or unexpected data.',
        possibleCauses: [
          'Unexpected data format or type',
          'Missing required properties or methods',
          'Memory or resource constraints',
          'Compatibility issues with browser or system'
        ],
        suggestedActions: [
          'Try refreshing the page',
          'Clear your browser cache',
          'Try again with different input data',
          'Contact support if the issue persists'
        ],
        technicalDetails: error.message
      },
      [ErrorCategory.NETWORK]: {
        title: 'Network Connection Error',
        description: 'Unable to connect to the required services. This could be due to internet connectivity issues or server problems.',
        possibleCauses: [
          'No internet connection',
          'Server is temporarily unavailable',
          'Firewall or proxy blocking the request',
          'Service maintenance in progress'
        ],
        suggestedActions: [
          'Check your internet connection',
          'Try again in a few minutes',
          'Contact your network administrator',
          'Use a different network if available'
        ]
      },
      [ErrorCategory.FILE_SYSTEM]: {
        title: 'File System Error',
        description: 'There was a problem accessing or processing files on your system.',
        possibleCauses: [
          'File not found or moved',
          'Insufficient permissions',
          'Disk space full',
          'File is corrupted or in use'
        ],
        suggestedActions: [
          'Check if the file exists and is accessible',
          'Ensure you have the necessary permissions',
          'Free up disk space',
          'Try with a different file'
        ]
      },
      [ErrorCategory.PROCESSING]: {
        title: 'Processing Error',
        description: 'An error occurred while processing your request. This might be related to the input data or processing configuration.',
        possibleCauses: [
          'Unsupported file format',
          'Invalid configuration settings',
          'Processing timeout',
          'Insufficient system resources'
        ],
        suggestedActions: [
          'Check your file format and size',
          'Review your configuration settings',
          'Try with simpler settings',
          'Restart the application'
        ]
      },
      [ErrorCategory.VALIDATION]: {
        title: 'Validation Error',
        description: 'The input data or configuration does not meet the required criteria.',
        possibleCauses: [
          'Missing required fields',
          'Invalid data format',
          'Values outside acceptable range',
          'Incompatible settings combination'
        ],
        suggestedActions: [
          'Check all required fields are filled',
          'Verify data format and values',
          'Review configuration settings',
          'Follow the input guidelines'
        ]
      },
      [ErrorCategory.UNKNOWN]: {
        title: 'Unknown Error',
        description: 'An unexpected error occurred. The system was unable to determine the exact cause.',
        possibleCauses: [
          'Rare edge case condition',
          'System compatibility issue',
          'Temporary resource constraint',
          'Unknown external factor'
        ],
        suggestedActions: [
          'Try refreshing the page',
          'Restart the application',
          'Try again later',
          'Report this issue with details'
        ],
        technicalDetails: error.message
      }
    }

    return explanations[category]
  }

  public createErrorContext(error: Error, componentStack?: string): ErrorContext {
    const category = this.categorizeError(error)
    const severity = this.determineSeverity(error, category)
    
    return {
      errorId: Math.random().toString(36).substring(2, 15),
      timestamp: Date.now(),
      category,
      severity,
      userAgent: navigator.userAgent,
      appVersion: process.env.npm_package_version || '1.0.0',
      systemInfo: this.getSystemInfo(),
      userActions: [...this.userActions],
      componentStack: componentStack || '',
      breadcrumbs: [...this.breadcrumbs],
      url: window.location.href,
      sessionId: this.sessionId
    }
  }

  private handleError(error: Error, source: string): void {
    console.error(`[${source}] Error caught:`, error)
    this.addBreadcrumb({
      category: 'error',
      message: `${source}: ${error.message}`,
      level: 'error',
      data: { source, stack: error.stack }
    })
  }

  public exportErrorData(): string {
    return JSON.stringify({
      userActions: this.userActions,
      breadcrumbs: this.breadcrumbs,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      systemInfo: this.getSystemInfo()
    }, null, 2)
  }
}

export const errorHandler = ErrorHandler.getInstance()