/**
 * Error Boundary for Workflow State Management
 * Handles state-related errors gracefully with fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import {
  Box,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Paper,
  Stack
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { workflowStateManager } from '../../services/workflow/workflow-state-manager'
import { stepStateController, atomicStepError } from '../../utils/step-state-controller'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  stepId?: string // Optional step ID for automatic step state management
  autoMarkStepError?: boolean // Whether to automatically mark step as error
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorBoundaryId: string
}

export class WorkflowStateErrorBoundary extends Component<Props, State> {
  private retryCount = 0
  private maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorBoundaryId: `workflow-error-${Date.now()}`
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorBoundaryId: `workflow-error-${Date.now()}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workflow State Error Boundary caught an error:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
      errorBoundaryId: this.state.errorBoundaryId,
      stepId: this.props.stepId
    })

    this.setState({
      error,
      errorInfo
    })

    // Automatically mark step as error if configured
    if (this.props.stepId && this.props.autoMarkStepError !== false) {
      this.markStepAsError(this.props.stepId, error.message)
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Report to monitoring service if available
    if (typeof window !== 'undefined' && (window as any).errorReporting) {
      (window as any).errorReporting.captureException(error, {
        context: 'WorkflowStateErrorBoundary',
        componentStack: errorInfo.componentStack,
        errorBoundaryId: this.state.errorBoundaryId,
        stepId: this.props.stepId
      })
    }
  }

  /**
   * Mark the associated step as error using the step state controller
   */
  private async markStepAsError(stepId: string, errorMessage: string) {
    try {
      const severity = this.getErrorSeverity()
      await atomicStepError(stepId, errorMessage, severity)
      console.log(`✅ Step ${stepId} marked as error automatically by error boundary`)
    } catch (markError) {
      console.error(`Failed to mark step ${stepId} as error:`, markError)
    }
  }

  handleReset = () => {
    if (this.retryCount >= this.maxRetries) {
      console.warn('Maximum retry attempts reached. Resetting workflow state.')
      this.handleResetWorkflow()
      return
    }

    this.retryCount += 1
    console.log(`Retrying workflow state recovery (attempt ${this.retryCount}/${this.maxRetries})`)
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorBoundaryId: `workflow-error-${Date.now()}`
    })
  }

  handleResetWorkflow = async () => {
    try {
      console.log('Resetting workflow state due to persistent errors')
      workflowStateManager.reset()
      
      this.retryCount = 0
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorBoundaryId: `workflow-error-${Date.now()}`
      })
    } catch (resetError) {
      console.error('Failed to reset workflow state:', resetError)
      // If reset fails, we need to reload the entire application
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }
  }

  handleReloadApp = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  getErrorSeverity = (): 'low' | 'medium' | 'high' | 'critical' => {
    const { error } = this.state
    
    if (!error) return 'low'
    
    // Analyze error to determine severity
    const errorMessage = error.message.toLowerCase()
    const errorStack = error.stack?.toLowerCase() || ''
    
    // Critical errors that require immediate attention
    if (
      errorMessage.includes('step_not_found') ||
      errorMessage.includes('invalid_transition') ||
      errorStack.includes('workflowstatemanager')
    ) {
      return 'critical'
    }
    
    // High severity errors
    if (
      errorMessage.includes('validation_failed') ||
      errorMessage.includes('persistence_error') ||
      this.retryCount >= this.maxRetries
    ) {
      return 'high'
    }
    
    // Medium severity errors
    if (
      errorMessage.includes('condition_not_met') ||
      errorMessage.includes('timeout')
    ) {
      return 'medium'
    }
    
    return 'low'
  }

  renderErrorFallback() {
    const { error, errorInfo, errorBoundaryId } = this.state
    const severity = this.getErrorSeverity()
    const isRetryAvailable = this.retryCount < this.maxRetries
    
    return (
      <Box
        sx={{
          p: 3,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.paper'
        }}
        role="alert"
        aria-labelledby="workflow-error-title"
        aria-describedby="workflow-error-description"
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 600,
            width: '100%',
            textAlign: 'center'
          }}
        >
          <Stack spacing={3}>
            {/* Error Icon and Title */}
            <Box>
              <WarningIcon 
                sx={{ 
                  fontSize: 48, 
                  color: severity === 'critical' ? 'error.main' : 'warning.main',
                  mb: 2 
                }} 
              />
              <Typography 
                id="workflow-error-title"
                variant="h5" 
                gutterBottom
                sx={{ fontWeight: 600 }}
              >
                Workflow State Error
              </Typography>
            </Box>
            
            {/* Error Alert */}
            <Alert 
              severity={severity === 'critical' ? 'error' : 'warning'}
              sx={{ textAlign: 'left' }}
            >
              <AlertTitle>
                {severity === 'critical' ? 'Critical Error' : 'Workflow Issue'}
              </AlertTitle>
              <Typography 
                id="workflow-error-description"
                variant="body2"
                sx={{ mb: 1 }}
              >
                {severity === 'critical' 
                  ? 'A critical error occurred in the workflow state system. Your progress is safe, but the workflow needs to be reset.'
                  : 'There was a problem with the workflow state. This is usually temporary and can be resolved by retrying.'
                }
              </Typography>
              {error && (
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  Error: {error.message}
                </Typography>
              )}
            </Alert>
            
            {/* Action Buttons */}
            <Stack direction="row" spacing={2} justifyContent="center">
              {isRetryAvailable && (
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReset}
                  aria-label={`Retry workflow recovery (attempt ${this.retryCount + 1} of ${this.maxRetries})`}
                >
                  Try Again ({this.maxRetries - this.retryCount} attempts left)
                </Button>
              )}
              
              <Button
                variant={isRetryAvailable ? 'outlined' : 'contained'}
                startIcon={<SettingsIcon />}
                onClick={this.handleResetWorkflow}
                color={severity === 'critical' ? 'error' : 'primary'}
                aria-label="Reset workflow to initial state"
              >
                Reset Workflow
              </Button>
              
              {severity === 'critical' && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={this.handleReloadApp}
                  aria-label="Reload entire application"
                >
                  Reload App
                </Button>
              )}
            </Stack>
            
            {/* Debug Information (Development) */}
            {process.env.NODE_ENV === 'development' && error && (
              <details style={{ textAlign: 'left', marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                  Debug Information
                </summary>
                <Box sx={{ mt: 1, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    <strong>Error:</strong> {error.toString()}<br />
                    <strong>Error ID:</strong> {errorBoundaryId}<br />
                    <strong>Retry Count:</strong> {this.retryCount}/{this.maxRetries}<br />
                    <strong>Severity:</strong> {severity}<br />
                    {errorInfo && (
                      <>
                        <strong>Component Stack:</strong><br />
                        <pre style={{ fontSize: '0.6rem', overflow: 'auto', maxHeight: '200px' }}>
                          {errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </Typography>
                </Box>
              </details>
            )}
          </Stack>
        </Paper>
      </Box>
    )
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI takes precedence
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      return this.renderErrorFallback()
    }

    return this.props.children
  }
}

/**
 * HOC for wrapping components with workflow state error boundary
 */
export function withWorkflowStateErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode
    stepId?: string
    autoMarkStepError?: boolean
  }
) {
  const WrappedComponent = (props: P) => (
    <WorkflowStateErrorBoundary 
      fallback={options?.fallback}
      stepId={options?.stepId}
      autoMarkStepError={options?.autoMarkStepError}
    >
      <Component {...props} />
    </WorkflowStateErrorBoundary>
  )
  
  WrappedComponent.displayName = `withWorkflowStateErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Hook for manually triggering error boundary from within components
 */
export function useWorkflowStateErrorHandler() {
  const throwError = (error: Error) => {
    // This will trigger the error boundary
    throw error
  }
  
  const handleStateError = (errorMessage: string, context?: Record<string, any>) => {
    const error = new Error(`Workflow State Error: ${errorMessage}`)
    if (context) {
      (error as any).context = context
    }
    throwError(error)
  }
  
  return {
    throwError,
    handleStateError
  }
}