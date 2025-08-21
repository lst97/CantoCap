import React, { Component, ErrorInfo, ReactNode } from 'react';
import { generateErrorId } from '../../utils/id-generator';
import {
  Box,
  Typography,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Report as ReportIcon,
} from '@mui/icons-material';
import { createComponentLogger, createHookLogger } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

/**
 * WorkspaceErrorBoundary - Error boundary specifically for workspace components
 * Provides graceful error handling with recovery options
 */
export class WorkspaceErrorBoundary extends Component<Props, State> {
  logger = createComponentLogger('WorkspaceErrorBoundary');
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call parent error handler
    this.props.onError?.(error, errorInfo);

    // Log error for debugging
    console.group('🚨 Workspace Error Boundary');
    this.logger.error('Error:', { error: error });
    this.logger.error('Error Info:', { errorInfo: errorInfo });
    this.logger.error('Component Stack:', { componentStack: errorInfo.componentStack });
    console.groupEnd();

    // Report error to monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Send error report to main process
      if (window.cantocapAPI) {
        const errorReport = {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          workspace: 'unknown', // Could get from workspace store
          errorId: this.state.errorId,
        };

        // In a real implementation, this would send to error reporting service
        this.logger.info('Error report prepared:', errorReport);
      }
    } catch (reportingError) {
      this.logger.error('Failed to report error:', { reportingError: reportingError });
    }
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: '',
      });
    }
  };

  private handleReset = () => {
    this.retryCount = 0;
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  private handleReloadApp = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo } = this.state;
      const canRetry = this.retryCount < this.maxRetries;

      return (
        <Paper
          sx={{
            p: 3,
            m: 2,
            maxWidth: 800,
            mx: 'auto',
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'error.main',
            bgcolor: 'error.50',
          }}
          elevation={0}
        >
          <Box sx={{ mb: 3 }}>
            <ErrorIcon
              sx={{
                fontSize: 48,
                color: 'error.main',
                mb: 2,
              }}
            />
            <Typography variant='h5' gutterBottom color='error.main'>
              Workspace Error
            </Typography>
            <Typography variant='body1' color='text.secondary' sx={{ mb: 2 }}>
              Something went wrong with the workspace system. Don&apost worry - your data is safe.
            </Typography>
          </Box>

          <Alert severity='error' sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant='body2'>
              <strong>Error:</strong> {error?.message || 'Unknown error occurred'}
            </Typography>
            <Typography variant='caption' color='text.secondary' sx={{ mt: 1, display: 'block' }}>
              Error ID: {this.state.errorId}
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
            {canRetry && (
              <Button
                variant='contained'
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
                color='primary'
              >
                Try Again ({this.maxRetries - this.retryCount} attempts left)
              </Button>
            )}

            <Button variant='outlined' startIcon={<RefreshIcon />} onClick={this.handleReset}>
              Reset Component
            </Button>

            <Button variant='outlined' color='warning' onClick={this.handleReloadApp}>
              Reload App
            </Button>
          </Box>

          {/* Error Details (Expandable) */}
          <Accordion sx={{ mt: 2, textAlign: 'left' }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls='error-details-content'
              id='error-details-header'
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReportIcon fontSize='small' />
                <Typography variant='subtitle2'>Technical Details</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 2 }}>
                <Typography variant='subtitle2' gutterBottom>
                  Error Message:
                </Typography>
                <Typography
                  variant='body2'
                  component='pre'
                  sx={{
                    bgcolor: 'grey.100',
                    p: 1,
                    borderRadius: 1,
                    fontSize: '0.8rem',
                    overflow: 'auto',
                  }}
                >
                  {error?.message}
                </Typography>
              </Box>

              {error?.stack && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant='subtitle2' gutterBottom>
                    Stack Trace:
                  </Typography>
                  <Typography
                    variant='body2'
                    component='pre'
                    sx={{
                      bgcolor: 'grey.100',
                      p: 1,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {error.stack}
                  </Typography>
                </Box>
              )}

              {errorInfo?.componentStack && (
                <Box>
                  <Typography variant='subtitle2' gutterBottom>
                    Component Stack:
                  </Typography>
                  <Typography
                    variant='body2'
                    component='pre'
                    sx={{
                      bgcolor: 'grey.100',
                      p: 1,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {errorInfo.componentStack}
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>

          <Typography variant='caption' color='text.secondary' sx={{ mt: 2, display: 'block' }}>
            If this error persists, please report it with the Error ID above.
          </Typography>
        </Paper>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling workspace errors in functional components
 */
export const useWorkspaceErrorHandler = () => {
  const logger = createHookLogger('WorkspaceErrorHook');
  const handleError = React.useCallback((error: Error, context?: string) => {
    logger.error(`Workspace Error${context ? ` in ${context}` : ''}:`, {error: error});

    // TODO: In a real implementation, you might:
    // 1. Send error to error reporting service
    // 2. Update error state in workspace store
    // 3. Show user-friendly error message
    // 4. Attempt automatic recovery

    if (window.cantocapAPI) {
      // Could send error to main process
      logger.info('Error would be reported to main process:', {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAsyncError = React.useCallback(
    async <T,>(
      operation: () => Promise<T>,
      context?: string,
      fallback?: T
    ): Promise<T | undefined> => {
      try {
        return await operation();
      } catch (error) {
        handleError(error as Error, context);
        return fallback;
      }
    },
    [handleError]
  );

  return {
    handleError,
    handleAsyncError,
  };
};
