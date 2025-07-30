import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { 
  ErrorCategory, 
  ErrorSeverity, 
  EngineError, 
  EngineErrorContext, 
  EngineRecoveryAction 
} from '../../types/error'
import { errorHandler } from '../../utils/errorHandler'
import { IPCProcessError } from '../../../types'

interface Props {
  children: ReactNode
  onEngineError?: (error: EngineError, errorInfo: ErrorInfo) => void
  enableEngineRecovery?: boolean
  enableIpcMonitoring?: boolean
  processingStep?: string
}

interface State {
  hasEngineError: boolean
  engineError: EngineError | null
  ipcErrors: IPCProcessError[]
  engineRecoveryAttempts: number
}

export class ProcessingErrorBoundary extends Component<Props, State> {
  private ipcErrorCleanup: (() => void) | null = null

  public state: State = {
    hasEngineError: false,
    engineError: null,
    ipcErrors: [],
    engineRecoveryAttempts: 0
  }

  public componentDidMount() {
    if (this.props.enableIpcMonitoring) {
      this.setupIpcMonitoring()
    }
  }

  public componentWillUnmount() {
    this.cleanupIpcMonitoring()
  }

  private setupIpcMonitoring() {
    // Monitor IPC errors
    if (window.cantocapAPI?.onProcessError) {
      this.ipcErrorCleanup = window.cantocapAPI.onProcessError((errorData: IPCProcessError) => {
        this.handleIpcError(errorData)
      })
    }
  }

  private cleanupIpcMonitoring() {
    if (this.ipcErrorCleanup) {
      this.ipcErrorCleanup()
      this.ipcErrorCleanup = null
    }
  }


  private handleIpcError(errorData: IPCProcessError) {
    this.setState(prevState => ({
      ipcErrors: [...prevState.ipcErrors, errorData]
    }))

    // Convert IPC error to EngineError for consistent handling
    const engineError = this.createEngineErrorFromIpc(errorData)
    
    // Add breadcrumb for IPC error
    errorHandler.addBreadcrumb({
      category: 'engine',
      message: `IPC Error: ${errorData.type} - ${errorData.message}`,
      level: 'error',
      data: {
        errorType: errorData.type,
        exitCode: errorData.exitCode,
        processingStep: this.props.processingStep
      }
    })

    // Trigger error boundary if it's a critical IPC error
    if (this.isCriticalEngineError(engineError)) {
      // Simulate error to trigger boundary
      setTimeout(() => {
        throw engineError
      }, 0)
    }

    // Call custom handler if provided
    if (this.props.onEngineError) {
      this.props.onEngineError(engineError, { componentStack: '' } as ErrorInfo)
    }
  }

  private createEngineErrorFromIpc(ipcError: IPCProcessError): EngineError {
    const error = new Error(ipcError.message) as EngineError
    error.name = 'EngineIPCError'
    error.type = ipcError.type
    error.exitCode = ipcError.exitCode
    error.category = this.getEngineErrorCategory(ipcError.type)
    error.ipcData = ipcError
    
    return error
  }

  private getEngineErrorCategory(errorType: string): ErrorCategory {
    switch (errorType) {
      case 'startup_error':
        return ErrorCategory.ENGINE_STARTUP
      case 'runtime_error':
        return ErrorCategory.ENGINE_RUNTIME
      case 'exit_error':
        return ErrorCategory.ENGINE_EXIT
      case 'spawn_error':
        return ErrorCategory.ENGINE_SPAWN
      case 'setup_error':
        return ErrorCategory.ENGINE_SETUP
      default:
        return ErrorCategory.ENGINE_IPC
    }
  }

  private isCriticalEngineError(error: EngineError): boolean {
    const criticalTypes = ['startup_error', 'spawn_error', 'setup_error']
    return criticalTypes.includes(error.type)
  }

  private getEngineColorScheme(category: ErrorCategory): { primary: string; secondary: string; accent: string } {
    const engineColors = {
      [ErrorCategory.ENGINE_IPC]: {
        primary: '#7C3AED', // Purple
        secondary: '#A855F7',
        accent: '#C4B5FD'
      },
      [ErrorCategory.ENGINE_STARTUP]: {
        primary: '#DC2626', // Red
        secondary: '#EF4444',
        accent: '#FCA5A5'
      },
      [ErrorCategory.ENGINE_RUNTIME]: {
        primary: '#EA580C', // Orange
        secondary: '#F97316',
        accent: '#FDBA74'
      },
      [ErrorCategory.ENGINE_EXIT]: {
        primary: '#B91C1C', // Dark Red
        secondary: '#DC2626',
        accent: '#F87171'
      },
      [ErrorCategory.ENGINE_SPAWN]: {
        primary: '#7C2D12', // Dark Orange
        secondary: '#9A3412',
        accent: '#FB923C'
      },
      [ErrorCategory.ENGINE_SETUP]: {
        primary: '#1E40AF', // Blue
        secondary: '#3B82F6',
        accent: '#93C5FD'
      }
    }

    return engineColors[category] || {
      primary: '#6B7280', // Gray fallback
      secondary: '#9CA3AF',
      accent: '#D1D5DB'
    }
  }

  private getEngineRecoveryActions(): EngineRecoveryAction[] {
    const { engineError } = this.state
    if (!engineError) return []

    const baseActions: EngineRecoveryAction[] = [
      {
        id: 'retry-engine',
        label: 'Retry Processing',
        description: 'Restart the engine and retry processing',
        icon: '🔄',
        action: this.handleRetryEngine,
        primary: true,
        engineSpecific: true
      },
      {
        id: 'restart-engine',
        label: 'Restart Engine',
        description: 'Forcefully restart the CantoCap engine',
        icon: '⚡',
        action: this.handleRestartEngine,
        engineSpecific: true,
        requiresRestart: true
      }
    ]

    // Add engine setup action for certain error types
    if (['startup_error', 'spawn_error', 'setup_error'].includes(engineError.type)) {
      baseActions.push({
        id: 'engine-setup',
        label: 'Run Engine Setup',
        description: 'Run full engine initialization and setup',
        icon: '🛠️',
        action: this.handleEngineSetup,
        engineSpecific: true,
        requiresEngineSetup: true
      })
    }

    // Add safe mode action for critical errors
    baseActions.push({
      id: 'safe-mode',
      label: 'Safe Mode',
      description: 'Clear all data and restart safely',
      icon: '🛡️',
      action: this.handleSafeMode,
      dangerous: true
    })

    return baseActions
  }

  private handleRetryEngine = () => {
    this.setState({ 
      hasEngineError: false, 
      engineError: null,
      engineRecoveryAttempts: this.state.engineRecoveryAttempts + 1
    })
    
    // Cancel current process and restart
    if (window.cantocapAPI?.cancelProcess) {
      window.cantocapAPI.cancelProcess()
    }
    
    // Brief delay before retrying
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  private handleRestartEngine = () => {
    this.setState({ 
      engineRecoveryAttempts: this.state.engineRecoveryAttempts + 1
    })
    
    // Force restart the application
    window.location.reload()
  }

  private handleEngineSetup = async () => {
    try {
      if (window.cantocapAPI?.runEngineSetup) {
        await window.cantocapAPI.runEngineSetup()
        this.setState({ 
          hasEngineError: false, 
          engineError: null,
          engineRecoveryAttempts: 0
        })
      }
    } catch (error) {
      console.error('Engine setup failed:', error)
    }
  }

  private handleSafeMode = () => {
    // Clear all storage and restart
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }

  private createEngineErrorContext(error: EngineError, errorInfo: ErrorInfo): EngineErrorContext {
    const baseContext = errorHandler.createErrorContext(error, errorInfo.componentStack)
    
    return {
      ...baseContext,
      engineType: error.type,
      engineStage: error.engineStage,
      exitCode: error.exitCode,
      ipcData: error.ipcData,
      recoveryAttempts: this.state.engineRecoveryAttempts
    }
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Check if it's an engine error
    if ('type' in error && 'category' in error) {
      return {
        hasEngineError: true,
        engineError: error as EngineError
      }
    }
    
    return {}
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Handle engine-specific errors
    if ('type' in error && 'category' in error) {
      const engineError = error as EngineError
      const engineErrorContext = this.createEngineErrorContext(engineError, errorInfo)
      
      console.error('ProcessingErrorBoundary caught engine error:', engineError, errorInfo)
      
      // Add engine-specific breadcrumb
      errorHandler.addBreadcrumb({
        category: 'engine-error',
        message: `Engine Error: ${engineError.type} - ${engineError.message}`,
        level: 'error',
        data: {
          engineType: engineError.type,
          exitCode: engineError.exitCode,
          processingStep: this.props.processingStep,
          recoveryAttempts: this.state.engineRecoveryAttempts
        }
      })

      // Log to Electron main process
      if (window.electronAPI?.logError) {
        window.electronAPI.logError({
          message: engineError.message,
          stack: engineError.stack,
          componentStack: errorInfo.componentStack,
          errorContext: engineErrorContext
        })
      }

      // Call custom engine error handler
      if (this.props.onEngineError) {
        this.props.onEngineError(engineError, errorInfo)
      }
    }
  }

  public render() {
    const { hasEngineError, engineError, ipcErrors } = this.state
    const { children, enableEngineRecovery = true } = this.props

    // If we have an engine error, render specialized engine error UI
    if (hasEngineError && engineError) {
      const colors = this.getEngineColorScheme(engineError.category)
      const recoveryActions = enableEngineRecovery ? this.getEngineRecoveryActions() : []

      // Use the existing ErrorBoundary component but with engine-specific props
      return (
        <ErrorBoundary
          fallbackTitle={`Engine ${engineError.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          fallbackMessage="The CantoCap engine encountered a critical error. Please try the recovery options below."
          enableDetailedView={true}
          enableRecovery={enableEngineRecovery}
          level="section"
          onError={(error, errorInfo) => {
            // Custom handling for nested errors
            console.error('Nested error in ProcessingErrorBoundary:', error, errorInfo)
          }}
        >
          {/* This will never render since we have an error, but ErrorBoundary will show error UI */}
          <div style={{ display: 'none' }}>Engine Error Fallback</div>
        </ErrorBoundary>
      )
    }

    // If we have IPC errors but no critical engine error, show them as warnings
    if (ipcErrors.length > 0) {
      return (
        <ErrorBoundary
          fallbackTitle="Processing Warning"
          fallbackMessage="Some engine communication issues were detected but processing may continue."
          enableDetailedView={true}
          enableRecovery={false}
          level="component"
        >
          {children}
        </ErrorBoundary>
      )
    }

    // No errors, render children normally
    return (
      <ErrorBoundary
        fallbackTitle="Processing Error"
        fallbackMessage="An error occurred during processing. This may be related to the engine or system resources."
        enableDetailedView={true}
        enableRecovery={true}
        level="section"
        onError={(error, errorInfo) => {
          // Auto-categorize as potential engine error
          console.error('ProcessingErrorBoundary caught general error:', error, errorInfo)
        }}
      >
        {children}
      </ErrorBoundary>
    )
  }
}