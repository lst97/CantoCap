import { Component, ErrorInfo, ReactNode } from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  Alert, 
  Stack, 
  IconButton,
  Chip,
  Fade,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material'
import {
  RestartAlt as RestartIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Security as SafeModeIcon} from '@mui/icons-material'
import { errorHandler } from '../../utils/errorHandler'
import { ErrorCategory, ErrorSeverity, ErrorContext, RecoveryAction } from '../../types/error'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  enableDetailedView?: boolean
  enableRecovery?: boolean
  level?: 'page' | 'section' | 'component'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorContext: ErrorContext | null
  showTechnicalDetails: boolean
  isRecovering: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorContext: null,
    showTechnicalDetails: false,
    isRecovering: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    const errorContext = errorHandler.createErrorContext(error, errorInfo.componentStack || undefined)
    
    this.setState({
      error,
      errorInfo,
      errorContext
    })

    // Add breadcrumb for error boundary catch
    errorHandler.addBreadcrumb({
      category: 'error',
      message: `ErrorBoundary caught: ${error.message}`,
      level: 'error',
      data: {
        componentStack: errorInfo.componentStack,
        errorId: errorContext.errorId
      }
    })

    // Report error to debug panel if available
    if (window.electronAPI?.logError) {
      window.electronAPI.logError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorContext
      })
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private handleReload = () => {
    this.setState({ isRecovering: true })
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  private handleReset = () => {
    this.setState({ isRecovering: true })
    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorContext: null,
        showTechnicalDetails: false,
        isRecovering: false
      })
    }, 500)
  }

  private handleSafeMode = () => {
    // Clear all local storage and reset to safe state
    localStorage.clear()
    sessionStorage.clear()
    this.handleReload()
  }

  private handleCopyError = () => {
    if (this.state.errorContext && this.state.error) {
      const errorData = {
        error: {
          message: this.state.error.message,
          stack: this.state.error.stack,
          name: this.state.error.name
        },
        context: this.state.errorContext,
        componentStack: this.state.errorInfo?.componentStack
      }
      
      navigator.clipboard.writeText(JSON.stringify(errorData, null, 2))
        .then(() => {
          // Could show a toast notification here
          console.log('Error data copied to clipboard')
        })
        .catch(err => console.error('Failed to copy error data:', err))
    }
  }

  private handleDownloadError = () => {
    if (this.state.errorContext && this.state.error) {
      const errorData = {
        error: {
          message: this.state.error.message,
          stack: this.state.error.stack,
          name: this.state.error.name
        },
        context: this.state.errorContext,
        componentStack: this.state.errorInfo?.componentStack,
        exportedAt: new Date().toISOString()
      }
      
      const blob = new Blob([JSON.stringify(errorData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `error-report-${this.state.errorContext.errorId}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  private toggleTechnicalDetails = () => {
    this.setState(prevState => ({
      showTechnicalDetails: !prevState.showTechnicalDetails
    }))
  }

  private getRecoveryActions(): RecoveryAction[] {
    return [
      {
        id: 'retry',
        label: 'Try Again',
        description: 'Attempt to recover from the error',
        icon: '🔄',
        action: this.handleReset,
        primary: true
      },
      {
        id: 'reload',
        label: 'Reload App',
        description: 'Refresh the entire application',
        icon: '🔃',
        action: this.handleReload
      },
      {
        id: 'safe-mode',
        label: 'Safe Mode',
        description: 'Clear all data and restart safely',
        icon: '🛡️',
        action: this.handleSafeMode,
        dangerous: true
      }
    ]
  }

  private getCategoryColor(category: ErrorCategory): string {
    const colors = {
      [ErrorCategory.RUNTIME]: '#ED4245', // Discord Red
      [ErrorCategory.NETWORK]: '#7DD3FC', // Light Blue
      [ErrorCategory.FILE_SYSTEM]: '#FEE75C', // Discord Yellow
      [ErrorCategory.PROCESSING]: '#F59E0B', // Primary Amber
      [ErrorCategory.VALIDATION]: '#F87171', // Light Red
      [ErrorCategory.UNKNOWN]: '#96989D' // Discord Medium Text
    }
    return colors[category] || colors[ErrorCategory.UNKNOWN]
  }

  private getSeverityColor(severity: ErrorSeverity): string {
    const colors = {
      [ErrorSeverity.LOW]: '#57F287', // Discord Green
      [ErrorSeverity.MEDIUM]: '#FEE75C', // Discord Yellow
      [ErrorSeverity.HIGH]: '#F59E0B', // Primary Amber
      [ErrorSeverity.CRITICAL]: '#ED4245' // Discord Red
    }
    return colors[severity] || colors[ErrorSeverity.MEDIUM]
  }

  public render() {
    if (this.state.hasError) {
      const { fallbackTitle = 'Something went wrong', enableDetailedView = true, enableRecovery = true } = this.props
      const { error, errorContext, showTechnicalDetails, isRecovering } = this.state
      
      if (!error || !errorContext) return null
      
      const explanation = errorHandler.getErrorExplanation(error, errorContext.category)
      const recoveryActions = this.getRecoveryActions()

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            p: { xs: 2, md: 4 },
            background: '#36393F', // Discord Dark Gray background
          }}
        >
          <Fade in timeout={500}>
            <Card
              sx={{
                maxWidth: 800,
                width: '100%',
                backgroundColor: '#2F3136', // Discord Darker Gray
                border: '1px solid rgba(64, 68, 75, 0.3)', // Discord Border Color
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15), 0px 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Error Header */}
              <Box
                sx={{
                  p: 4,
                  background: `linear-gradient(135deg, ${this.getCategoryColor(errorContext.category)}15 0%, ${this.getCategoryColor(errorContext.category)}05 100%)`,
                  borderBottom: `1px solid ${this.getCategoryColor(errorContext.category)}30`,
                  position: 'relative'
                }}
              >
                <Stack direction="row" alignItems="center" spacing={3}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${this.getCategoryColor(errorContext.category)}30 0%, ${this.getCategoryColor(errorContext.category)}10 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.5rem'
                    }}
                  >
                    🚨
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h4" sx={{ 
                      fontWeight: 700,
                      mb: 1,
                      color: this.getCategoryColor(errorContext.category)
                    }}>
                      {explanation.title}
                    </Typography>
                    
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <Chip
                        label={errorContext.category.replace('_', ' ').toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: `${this.getCategoryColor(errorContext.category)}20`,
                          color: this.getCategoryColor(errorContext.category),
                          fontWeight: 600,
                          border: `1px solid ${this.getCategoryColor(errorContext.category)}40`
                        }}
                      />
                      <Chip
                        label={errorContext.severity.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: `${this.getSeverityColor(errorContext.severity)}20`,
                          color: this.getSeverityColor(errorContext.severity),
                          fontWeight: 600,
                          border: `1px solid ${this.getSeverityColor(errorContext.severity)}40`
                        }}
                      />
                      <Chip
                        label={`ID: ${errorContext.errorId}`}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(150, 152, 157, 0.15)',
                          color: 'text.secondary',
                          fontFamily: 'monospace',
                          fontSize: '0.7rem'
                        }}
                      />
                    </Stack>
                    
                    <Typography variant="body1" sx={{ lineHeight: 1.6, color: '#DCDDDE' }}>
                      {explanation.description}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Error Summary */}
              <Box sx={{ p: 4 }}>
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 3,
                    backgroundColor: 'rgba(237, 66, 69, 0.1)',
                    border: '1px solid rgba(237, 66, 69, 0.3)',
                    color: '#DCDDDE', // Discord Light Text
                    '& .MuiAlert-icon': {
                      color: '#ED4245' // Discord Red
                    },
                    '& .MuiAlert-message': {
                      color: '#DCDDDE'
                    }
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Error Message:
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'monospace', 
                    wordBreak: 'break-word',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#FF6B6B',
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid rgba(255, 107, 107, 0.2)'
                  }}>
                    {error.message}
                  </Typography>
                </Alert>

                {/* Possible Causes */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#DCDDDE' }}>
                    🔍 Possible Causes
                  </Typography>
                  <Stack spacing={1}>
                    {explanation.possibleCauses.map((cause, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#96989D' }}>•</Typography>
                        <Typography variant="body2" sx={{ color: '#96989D' }}>{cause}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Suggested Actions */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#DCDDDE' }}>
                    💡 Suggested Actions
                  </Typography>
                  <Stack spacing={1}>
                    {explanation.suggestedActions.map((action, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#F59E0B' }}>•</Typography>
                        <Typography variant="body2" sx={{ color: '#DCDDDE' }}>{action}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Recovery Actions */}
                {enableRecovery && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#DCDDDE' }}>
                      🔧 Recovery Options
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      {recoveryActions.map((action) => (
                        <Button
                          key={action.id}
                          variant={action.primary ? 'contained' : 'outlined'}
                          color={action.dangerous ? 'error' : action.primary ? 'primary' : 'inherit'}
                          onClick={action.action}
                          disabled={isRecovering}
                          startIcon={
                            action.id === 'retry' ? <RestartIcon /> :
                            action.id === 'reload' ? <RefreshIcon /> :
                            action.id === 'safe-mode' ? <SafeModeIcon /> : null
                          }
                          sx={{
                            py: 1.5,
                            px: 3,
                            borderRadius: 3,
                            fontWeight: 600,
                            transition: 'all 0.3s ease',
                            ...(action.primary ? {
                              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                              color: '#000000',
                              boxShadow: '0px 1px 3px rgba(245, 158, 11, 0.12), 0px 1px 2px rgba(245, 158, 11, 0.24)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
                                boxShadow: '0px 4px 8px rgba(245, 158, 11, 0.15), 0px 2px 4px rgba(245, 158, 11, 0.3)',
                                transform: isRecovering ? 'none' : 'translateY(-1px)'
                              }
                            } : action.dangerous ? {
                              background: 'linear-gradient(135deg, #ED4245 0%, #DC2626 100%)',
                              color: '#FFFFFF',
                              border: 'none',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #F87171 0%, #ED4245 100%)',
                                transform: isRecovering ? 'none' : 'translateY(-1px)'
                              }
                            } : {
                              backgroundColor: 'transparent',
                              color: '#F59E0B',
                              border: '2px solid #F59E0B',
                              '&:hover': {
                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                borderColor: '#FCD34D',
                                color: '#FCD34D',
                                transform: isRecovering ? 'none' : 'translateY(-1px)'
                              }
                            })
                          }}
                        >
                          {isRecovering ? 'Processing...' : action.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Technical Details */}
                {enableDetailedView && (
                  <Accordion 
                    expanded={showTechnicalDetails} 
                    onChange={this.toggleTechnicalDetails}
                    sx={{
                      backgroundColor: 'rgba(64, 68, 75, 0.1)',
                      border: '1px solid rgba(64, 68, 75, 0.3)',
                      borderRadius: 2,
                      color: '#DCDDDE',
                      '&:before': { display: 'none' },
                      '& .MuiAccordionSummary-content': {
                        color: '#DCDDDE'
                      },
                      '& .MuiSvgIcon-root': {
                        color: '#DCDDDE'
                      }
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        🔬 Technical Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={3}>
                        {/* Error Stack */}
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: '#96989D' }}>Stack Trace</Typography>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="Copy to clipboard">
                                <IconButton size="small" onClick={this.handleCopyError} sx={{ color: '#96989D', '&:hover': { color: '#DCDDDE' } }}>
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download error report">
                                <IconButton size="small" onClick={this.handleDownloadError} sx={{ color: '#96989D', '&:hover': { color: '#DCDDDE' } }}>
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                          <Box
                            sx={{
                              p: 2,
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: 2,
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              maxHeight: 300,
                              overflow: 'auto'
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: '#FF6B6B'
                              }}
                            >
                              {error.stack || 'No stack trace available'}
                            </Typography>
                          </Box>
                        </Box>

                        {/* System Info */}
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 2, color: '#96989D' }}>System Information</Typography>
                          <Box
                            sx={{
                              p: 2,
                              backgroundColor: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 2,
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <Stack spacing={1}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#96989D' }}>
                                <strong style={{ color: '#DCDDDE' }}>Timestamp:</strong> {new Date(errorContext.timestamp).toISOString()}
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#96989D' }}>
                                <strong style={{ color: '#DCDDDE' }}>Session ID:</strong> {errorContext.sessionId}
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#96989D' }}>
                                <strong style={{ color: '#DCDDDE' }}>Platform:</strong> {errorContext.systemInfo.platform}
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#96989D' }}>
                                <strong style={{ color: '#DCDDDE' }}>Language:</strong> {errorContext.systemInfo.language}
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#96989D' }}>
                                <strong style={{ color: '#DCDDDE' }}>Online:</strong> {errorContext.systemInfo.onLine ? 'Yes' : 'No'}
                              </Typography>
                            </Stack>
                          </Box>
                        </Box>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>
            </Card>
          </Fade>
        </Box>
      )
    }

    return this.props.children
  }
}