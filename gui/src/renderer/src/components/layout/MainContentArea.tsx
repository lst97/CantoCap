import React from 'react';
import { Box, Typography } from '@mui/material';
import { useCurrentStep } from '../../stores/useWorkflowStore';
import { useCurrentWorkspace } from '../../stores/useWorkspaceStore';
import { useAppStore } from '../../stores/useAppStore';
import { InputFileStep } from '../steps/InputFileStep';
import { ConfigStep } from '../steps/ConfigStep';
import { ProcessingStep } from '../steps/ProcessingStep';
import { ReviewStep } from '../steps/ReviewStep';
import { ExportStep } from '../steps/ExportStep';
import { ErrorBoundary } from '../common/ErrorBoundary';
import type { StepType } from '../../stores/types/StoreTypes';
import { createComponentLogger } from '../../utils/logger';

// Step metadata for UI display
const STEP_METADATA: Record<StepType, { title: string; description: string }> = {
  input: {
    title: 'Input File Selection',
    description: 'Select your audio or video file to transcribe',
  },
  config: {
    title: 'Configuration',
    description: 'Configure transcription settings and options',
  },
  processing: {
    title: 'Processing',
    description: 'Transcribing your audio to generate subtitles',
  },
  review: {
    title: 'Review & Edit',
    description: 'Review and edit the generated subtitles',
  },
  export: {
    title: 'Export',
    description: 'Export your subtitles in various formats',
  },
};

export const MainContentArea: React.FC = () => {
  const logger = createComponentLogger('MainContentArea');
  // Get current workflow step and workspace data from new stores
  const currentStep = useCurrentStep();
  const currentWorkspace = useCurrentWorkspace();
  const { isLoading } = useAppStore();

  // Derive current step data
  const currentStepId = currentStep || 'input';
  const currentStepData = STEP_METADATA[currentStepId];

  // Show loading state while app is initializing
  if (isLoading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <Typography variant='body1' color='text.secondary'>
          Loading application...
        </Typography>
      </Box>
    );
  }

  // Show empty state if no workspace is selected
  if (!currentWorkspace) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography variant='h6' color='text.secondary'>
          No Workspace Selected
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          Please select or create a workspace to continue.
        </Typography>
      </Box>
    );
  }

  const renderStepContent = () => {
    // FIXED: Use conditional rendering instead of CSS hiding to prevent background rendering
    // This ensures only the active step is mounted and running, preventing unnecessary effects
    logger.info(`🔄 MainContentArea: Rendering step "${currentStepId}"`);

    switch (currentStepId) {
      case 'input':
        return (
          <Box sx={{ height: '100%' }}>
            <ErrorBoundary
              fallbackTitle='Input File Step Error'
              fallbackMessage='An error occurred in the input file step. Please try refreshing or contact support.'
            >
              <InputFileStep />
            </ErrorBoundary>
          </Box>
        );

      case 'config':
        return (
          <Box sx={{ height: '100%' }}>
            <ErrorBoundary
              fallbackTitle='Configuration Step Error'
              fallbackMessage='An error occurred in the configuration step. Please check your settings and try again.'
            >
              <ConfigStep />
            </ErrorBoundary>
          </Box>
        );

      case 'processing':
        return (
          <Box sx={{ height: '100%' }}>
            <ErrorBoundary
              fallbackTitle='Processing Step Error'
              fallbackMessage='An error occurred during processing. Please check your files and try again.'
            >
              <ProcessingStep />
            </ErrorBoundary>
          </Box>
        );

      case 'review':
        return (
          <Box sx={{ height: '100%' }}>
            <ErrorBoundary
              fallbackTitle='Review Step Error'
              fallbackMessage='An error occurred in the review step. Your progress has been saved automatically.'
            >
              <ReviewStep />
            </ErrorBoundary>
          </Box>
        );

      case 'export':
        return (
          <Box sx={{ height: '100%' }}>
            <ErrorBoundary
              fallbackTitle='Export Step Error'
              fallbackMessage='An error occurred during export. Please try again or check your export settings.'
            >
              <ExportStep />
            </ErrorBoundary>
          </Box>
        );

      default:
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant='h5' color='text.secondary'>
              Step not found
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              The requested step &quot;{currentStepId}&quot; could not be loaded.
            </Typography>
          </Box>
        );
    }
  };

  return (
    <>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Content Header */}
        <Box
          sx={{
            height: 48,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
          }}
        >
          <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
            {currentStepData?.title || currentStepId || 'Unknown Step'}
          </Typography>
          {currentStepData?.description && (
            <Typography variant='body2' color='text.secondary' sx={{ ml: 2 }}>
              {currentStepData.description}
            </Typography>
          )}
        </Box>

        {/* Content Area */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{renderStepContent()}</Box>
      </Box>
    </>
  );
};
