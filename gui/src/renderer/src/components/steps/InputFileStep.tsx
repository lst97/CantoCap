import React, { useEffect, useState, useCallback } from 'react';
import { Box, Alert, Snackbar, LinearProgress, Typography } from '@mui/material';
import { InputPanel } from '../ui/InputPanel';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useStepActions, useStepError, useInputStepContent, useStepLoading } from '../../stores/useStepStore';
import { VideoMetadata } from '../../stores/types/StoreTypes';

export const InputFileStep: React.FC = () => {
  const stepActions = useStepActions();
  const error = useStepError();
  const isLoading = useStepLoading();
  const inputStepContent = useInputStepContent();
  const [showErrorNotification, setShowErrorNotification] = useState(false);

  // Handle errors
  useEffect(() => {
    if (error) {
      setShowErrorNotification(true);
    }
  }, [error]);

  // React 19 Optimization: Memoize range selection handler
  const handleRangeSelect = useCallback(
    async (start: number, end: number) => {
      try {
        const duration = end - start;

        await stepActions.updateStepContent('input', {
          selectedRange: { start, end, duration },
          lastModified: Date.now(),
        });
      } catch (error) {
        console.error('Failed to save range selection:', error);
      }
    },
    [stepActions]
  );

  // React 19 Optimization: Memoize metadata update handler
  const handleMetadataUpdate = useCallback(
    async (metadata: VideoMetadata) => {
      try {
        await stepActions.updateStepContent('input', {
          mediaMetadata: metadata,
          lastModified: Date.now(),
        });
      } catch (error) {
        console.error('Failed to save media metadata:', error);
      }
    },
    [stepActions]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: string) => {
      try {
        await stepActions.updateStepContent('input', {
          selectedFile: file,
          inputFile: file,
          lastModified: Date.now(),
        });
      } catch (error) {
        console.error('Failed to save file selection:', error);
      }
    },
    [stepActions]
  );

  // Handle JSON file selection
  const handleJsonFileSelect = useCallback(
    async (file: string | null) => {
      try {
        await stepActions.updateStepContent('input', {
          importedJsonFile: file,
          lastModified: Date.now(),
        });
      } catch (error) {
        console.error('Failed to save JSON file selection:', error);
      }
    },
    [stepActions]
  );

  // Clear error function
  const clearError = useCallback(() => {
    stepActions.clearError();
  }, [stepActions]);

  // Show loading state while workspace is initializing
  if (isLoading) {
    return (
      <Box
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <LinearProgress sx={{ width: '100%', maxWidth: 400, mb: 2 }} />
        <Typography variant='body2' color='text.secondary'>
          Loading workspace configuration...
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* File Upload, Media Preview & Range Selection */}
        <ErrorBoundary
          fallbackTitle='File Upload Error'
          fallbackMessage="An error occurred while processing your video file. This might be due to a corrupted file, unsupported format, or insufficient system resources. Please try again with a different file or use the 'Browse Files' button instead of drag and drop."
        >
          <InputPanel
            // Pass workspace-aware configuration
            initialFile={inputStepContent?.selectedFile || inputStepContent?.inputFile || null}
            initialRange={inputStepContent?.selectedRange}
            initialJsonFile={inputStepContent?.importedJsonFile || null}
            onFileSelect={handleFileSelect}
            onJsonFileSelect={handleJsonFileSelect}
            onRangeSelect={handleRangeSelect}
            onMetadataUpdate={handleMetadataUpdate}
          />
        </ErrorBoundary>
      </Box>

      {/* Error Notification */}
      <Snackbar
        open={showErrorNotification}
        autoHideDuration={6000}
        onClose={() => {
          setShowErrorNotification(false);
          clearError();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => {
            setShowErrorNotification(false);
            clearError();
          }}
          severity='error'
          variant='filled'
        >
          {error || 'Failed to save configuration'}
        </Alert>
      </Snackbar>
    </>
  );
};
