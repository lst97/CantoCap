import React, { Component, ReactNode } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { useAppStore } from '../../../store/app-store';
import { useSubtitleEditStore } from '../../../stores/subtitle-edit-store';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ReviewStepErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 ReviewStep Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Try to clear the subtitle editing session to prevent further issues
    try {
      const subtitleStore = useSubtitleEditStore.getState();
      subtitleStore.clearSession();
    } catch (clearError) {
      console.error('Failed to clear subtitle session after error:', clearError);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // Clear subtitle editing session
    try {
      const subtitleStore = useSubtitleEditStore.getState();
      subtitleStore.clearSession();
    } catch (error) {
      console.error('Failed to clear session during reset:', error);
    }
  };

  handleRetry = () => {
    this.handleReset();
    // Force a re-render by updating a timestamp
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center'
          }}
        >
          <Alert severity="error" sx={{ mb: 3, maxWidth: 600 }}>
            <Typography variant="h6" gutterBottom>
              Review Step Error
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              The subtitle review interface encountered an error. This often happens when processing large JSON files or during session initialization.
            </Typography>
            {this.state.error && (
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mb: 2 }}>
                {this.state.error.message}
              </Typography>
            )}
          </Alert>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={this.handleReset}
            >
              Reset Review Session
            </Button>
            <Button
              variant="outlined"
              onClick={this.handleRetry}
            >
              Reload Application
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 500 }}>
            If this error persists, try importing a smaller JSON file or restart the application.
          </Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}