import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert, Stack } from '@mui/material';
import { RestartAlt as RestartIcon, BugReport as BugIcon } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Report error to debug panel if available
    if (window.electronAPI?.logError) {
      window.electronAPI.logError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      const { fallbackTitle = 'Something went wrong', fallbackMessage } = this.props;
      const { error, errorInfo } = this.state;

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              width: '100%',
            }}
          >
            <Stack spacing={3} alignItems="center">
              <BugIcon
                sx={{
                  fontSize: 64,
                  color: 'error.main',
                }}
              />
              
              <Typography variant="h5" color="error.main" gutterBottom>
                {fallbackTitle}
              </Typography>
              
              <Typography variant="body1" color="text.secondary">
                {fallbackMessage || 
                  'An unexpected error occurred while processing your video. This might be due to an unsupported file format or corrupted file.'}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Error Details:
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                    {error.message}
                  </Typography>
                </Alert>
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<RestartIcon />}
                  onClick={this.handleReset}
                  color="primary"
                >
                  Try Again
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={this.handleReload}
                >
                  Reload App
                </Button>
              </Stack>

              {process.env.NODE_ENV === 'development' && errorInfo && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    backgroundColor: 'grey.100',
                    borderRadius: 1,
                    width: '100%',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Component Stack (Development):
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {errorInfo.componentStack}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}