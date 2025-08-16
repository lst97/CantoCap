import { useCallback } from 'react';
import { Box, Typography, Button, Chip, Stack, Card, Alert, Fade, Collapse } from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useAppActions, useActiveWorkspaceId } from '../../stores/useAppStore';
import {
  useConfigStepContent,
  useProcessingStepContent,
  useInputStepContent,
} from '../../stores/useStepStore';
import { useWorkflowActions, useWorkflowStore } from '../../stores/useWorkflowStore';
import { useProcessingStepActions } from '../../stores/steps/useProcessingStepStore';
import { ElectronWindow, StepStatus } from '../../stores/types/StoreTypes';
import {
  ProcessingConvertConfigResponse,
  ProcessingTimeEstimateResponse,
  ProcessingStartResponse,
  ProcessingCancelResponse,
} from '@/types';

export const ActionPanel = () => {
  // Get app-level data
  const appActions = useAppActions();
  const activeWorkspaceId = useActiveWorkspaceId();

  // Get step-specific data
  const config = useConfigStepContent();
  const inputStep = useInputStepContent();
  const processing = useProcessingStepContent();
  const workflowActions = useWorkflowActions();
  const setStepState = useWorkflowStore((state) => state.actions.setStepState);
  const { startProcessing } = useProcessingStepActions();

  // Check if transcription can be started
  const canStartTranscription = useCallback(() => {
    const inputFile = inputStep.inputFile || inputStep.selectedFile;
    const huggingFaceKey = config.apiKeys?.huggingface;
    return !!(inputFile && activeWorkspaceId && huggingFaceKey && processing.status !== 'running');
  }, [
    inputStep.inputFile,
    inputStep.selectedFile,
    activeWorkspaceId,
    config.apiKeys?.huggingface,
    processing.status,
  ]);

  // Helper to show notifications (placeholder)
  const showNotification = useCallback(
    (message: string, type: string = 'info') => {
      console.log(`[${type.toUpperCase()}] ${message}`);
      if (appActions.showNotification) {
        appActions.showNotification(message, type);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appActions.showNotification]
  );

  const handleStartTranscription = useCallback(async () => {
    if (!canStartTranscription()) {
      const inputFile = inputStep.inputFile || inputStep.selectedFile;
      const huggingFaceKey = config.apiKeys?.huggingface;
      if (!inputFile) {
        showNotification('Please select an input file first', 'error');
      } else if (!activeWorkspaceId) {
        showNotification('Please select a workspace first', 'error');
      } else if (!huggingFaceKey) {
        showNotification('Hugging Face API key is required for subtitle generation', 'error');
      }
      return;
    }

    try {
      const isRegeneration = processing.status === 'completed';
      
      if (isRegeneration) {
        console.log('🔄 Regenerate Subtitles clicked - resetting processing state');
        showNotification('Starting subtitle regeneration...', 'info');
      } else {
        console.log('🎯 Generate Subtitles clicked - updating workflow states');
      }

      // Mark config step as complete and set processing step to ready
      await setStepState('config', StepStatus.COMPLETE);
      await setStepState('processing', StepStatus.READY);
      console.log('✅ Config step marked as complete, Processing step set to ready');

      // Navigate to processing step
      await workflowActions.navigateToStep('processing');

      // Convert step config to ProcessingConfig format using new IPC handler
      const conversionResult = (await (
        window as unknown as ElectronWindow
      ).electron.ipcRenderer.invoke('processing:convertConfig', {
        inputStep,
        configStep: config,
      })) as ProcessingConvertConfigResponse;


      if (!conversionResult.success || !conversionResult.config) {
        throw new Error(conversionResult.error || 'Failed to convert configuration');
      }

      // Get processing time estimate and show to user
      try {
        const estimateResult = (await (
          window as unknown as ElectronWindow
        ).electron.ipcRenderer.invoke(
          'processing:getTimeEstimate',
          conversionResult.config
        )) as ProcessingTimeEstimateResponse;

        if (estimateResult.success && estimateResult.estimate) {
          const { estimate } = estimateResult;
          const durationText = estimate.basedOnDuration
            ? `Based on media duration, estimated processing time: ${estimate.estimatedProcessingDisplay}`
            : `Estimated processing time: ${estimate.estimatedProcessingDisplay} (timeout: ${estimate.timeoutDisplay})`;
          showNotification(durationText, 'info');
        }
      } catch (estimateError) {
        console.warn('Failed to get processing estimate:', estimateError);
        // Continue without estimate - not critical
      }

      // Update the processing store to 'running' state BEFORE starting the IPC call
      console.log('🚀 ActionPanel: Setting processing state to running before starting backend');
      startProcessing({
        currentPhase: 'initializing',
        logs: ['Starting transcription process...']
      });

      // Start the actual transcription process
      const startResult = (await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
        'processing:start',
        conversionResult.config
      )) as ProcessingStartResponse;

      if (startResult.success) {
        const successMessage = isRegeneration 
          ? 'Subtitle regeneration process started successfully'
          : 'Transcription process started successfully';
        showNotification(successMessage, 'success');
        console.log('✅ ActionPanel: Processing started successfully, backend will send status updates via IPC events');
      } else {
        // If backend start failed, reset processing state back to idle
        console.error('❌ ActionPanel: Backend processing start failed, resetting state');
        startProcessing({ status: 'idle', logs: ['Failed to start processing'] });
        throw new Error(startResult.error || 'Failed to start transcription process');
      }
    } catch (error) {
      console.error('Failed to start transcription:', error);
      showNotification(
        `Failed to start transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );

      // Reset workflow states back to config if there was an error
      try {
        console.log('❌ Transcription start failed - resetting workflow states');
        await setStepState('config', StepStatus.READY);
        await setStepState('processing', StepStatus.ERROR);
        await workflowActions.navigateToStep('config');
        console.log('✅ Workflow states reset to config step');
      } catch (navError) {
        console.error('Failed to reset workflow states:', navError);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canStartTranscription,
    inputStep,
    config,
    activeWorkspaceId,
    workflowActions,
    showNotification,
    setStepState,
    startProcessing,
  ]);

  const handleCancelTranscription = useCallback(async () => {
    try {
      const result = (await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke(
        'processing:cancel'
      )) as ProcessingCancelResponse;

      if (result.success) {
        showNotification('Transcription cancelled', 'info');
      } else {
        throw new Error(result.error || 'Failed to cancel transcription');
      }
    } catch (error) {
      console.error('Failed to cancel transcription:', error);
      showNotification(
        `Failed to cancel transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }, [showNotification]);

  const getButtonState = () => {
    if (processing.status === 'running') {
      return {
        text: 'Cancel Processing',
        icon: '⏹️',
        className: 'cancel-btn',
        action: handleCancelTranscription,
        disabled: processing.status !== 'running',
      };
    }

    // If processing is completed, allow re-generation
    if (processing.status === 'completed') {
      return {
        text: 'Regenerate Subtitles',
        icon: '🔄',
        className: 'generate-btn secondary',
        action: handleStartTranscription,
        disabled: false,
      };
    }

    if (canStartTranscription()) {
      return {
        text: 'Generate Subtitles',
        icon: '🎬',
        className: 'generate-btn primary',
        action: handleStartTranscription,
        disabled: false,
      };
    }

    return {
      text: 'Generate Subtitles',
      icon: '🎬',
      className: 'generate-btn disabled',
      action: () => {},
      disabled: true,
    };
  };

  const buttonState = getButtonState();

  const getReadinessStatus = () => {
    // If processing is completed, show regeneration option
    if (processing.status === 'completed') {
      return {
        ready: true,
        message: 'Subtitles are available - proceed to review/export or regenerate if needed',
        icon: '✅',
      };
    }

    const issues = [];
    const inputFile = inputStep.inputFile || inputStep.selectedFile;
    const huggingFaceKey = config.apiKeys?.huggingface;

    if (!inputFile) issues.push('No input file selected');
    if (!activeWorkspaceId) issues.push('No workspace selected');
    if (!huggingFaceKey) issues.push('Hugging Face API key is required');
    // Note: Dependencies check would need to be implemented in AppStore or separate dependency store

    if (issues.length === 0) {
      return { ready: true, message: 'Ready to generate subtitles', icon: '✅' };
    }

    return {
      ready: false,
      message: `${issues.length} issue${issues.length > 1 ? 's' : ''}: ${issues.join(', ')}`,
      icon: '⚠️',
    };
  };

  const readiness = getReadinessStatus();

  // Note: Step state management is handled by the parent ConfigStep component
  // This component only handles validation display and button actions

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Typography
        variant='h6'
        sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600, mb: 1 }}
      >
        🚀 Actions
      </Typography>

      {/* Enhanced Readiness Status */}
      <Fade in={true}>
        <Alert
          severity={readiness.ready ? 'success' : 'warning'}
          icon={readiness.ready ? <CheckIcon /> : <WarningIcon />}
          sx={{
            borderRadius: 3,
            backgroundColor: readiness.ready
              ? 'rgba(87, 242, 135, 0.1)'
              : 'rgba(254, 231, 92, 0.1)',
            border: 1,
            borderColor: readiness.ready ? 'rgba(87, 242, 135, 0.3)' : 'rgba(254, 231, 92, 0.3)',
            '& .MuiAlert-icon': {
              color: readiness.ready ? 'success.main' : 'warning.main',
            },
            '& .MuiAlert-message': {
              fontWeight: 500,
              fontSize: '0.875rem',
            },
          }}
        >
          <Typography variant='body2' sx={{ fontWeight: 500 }}>
            {readiness.ready ? '✨ Ready to Generate' : 'Issues Found'}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ fontSize: '0.8rem', mt: 0.5 }}>
            {readiness.message}
          </Typography>
        </Alert>
      </Fade>

      {/* Enhanced Action Button */}
      <Button
        variant={processing.status === 'running' ? 'outlined' : 'contained'}
        color={processing.status === 'running' ? 'error' : 'primary'}
        size='large'
        fullWidth
        onClick={buttonState.action}
        disabled={buttonState.disabled}
        startIcon={
          processing.status === 'running' ? (
            <StopIcon />
          ) : processing.status === 'completed' ? (
            <RefreshIcon />
          ) : (
            <PlayIcon />
          )
        }
        sx={{
          py: 2,
          px: 3,
          fontSize: '1.1rem',
          fontWeight: 700,
          borderRadius: 3,
          textTransform: 'none',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background:
            processing.status === 'running'
              ? 'transparent'
              : buttonState.disabled
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.3) 100%)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', // Consistent orange for both generate and regenerate
          '&:hover': {
            transform: buttonState.disabled ? 'none' : 'translateY(-2px)',
            boxShadow: buttonState.disabled
              ? 'none'
              : processing.status === 'running'
                ? '0 4px 20px rgba(237, 66, 69, 0.3)'
                : '0 8px 25px rgba(245, 158, 11, 0.4)', // Consistent orange shadow for both generate and regenerate
          },
          '&:disabled': {
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'not-allowed',
          },
        }}
      >
        {buttonState.text}
      </Button>

      {/* Enhanced Processing Info */}
      <Collapse in={processing.status === 'running'}>
        <Card
          sx={{
            p: 3,
            background:
              'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: 3,
          }}
        >
          <Typography
            variant='subtitle1'
            sx={{
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontWeight: 600,
              color: 'primary.main',
            }}
          >
            <RefreshIcon
              fontSize='small'
              sx={{
                animation: 'spin 2s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
            Processing in Progress
          </Typography>

          <Stack spacing={2}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{ fontSize: '0.75rem', mb: 0.5 }}
              >
                CURRENT STAGE
              </Typography>
              <Typography variant='body1' sx={{ fontWeight: 500 }}>
                {processing.currentPhase || 'Initializing...'}
              </Typography>
            </Box>

            {processing.timeElapsed && processing.timeElapsed > 0 && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ fontSize: '0.75rem', mb: 0.5 }}
                >
                  TIME ELAPSED
                </Typography>
                <Typography
                  variant='body1'
                  sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <TimeIcon fontSize='small' color='secondary' />
                  {Math.floor((processing.timeElapsed || 0) / 60)}m{' '}
                  {(processing.timeElapsed || 0) % 60}s
                </Typography>
              </Box>
            )}
          </Stack>
        </Card>
      </Collapse>

      {/* Enhanced Configuration Summary */}
      <Card
        sx={{
          p: 3,
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
        }}
      >
        <Typography
          variant='subtitle1'
          sx={{
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontWeight: 600,
          }}
        >
          📋 Configuration Quick View
        </Typography>

        <Stack spacing={1}>
          {config.inputFile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant='body2' color='text.secondary'>
                Input:
              </Typography>
              <Typography variant='body2' sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {config.inputFile.split(/[\\/]/).pop()}
              </Typography>
            </Box>
          )}

          {processing.status === 'completed' && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant='body2' color='text.secondary'>
                Subtitles:
              </Typography>
              <Typography
                variant='body2'
                sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'success.main' }}
              >
                Available
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant='body2' color='text.secondary'>
              Language:
            </Typography>
            <Typography variant='body2'>{config.language || 'Auto-detect'}</Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant='body2' color='text.secondary'>
              Model:
            </Typography>
            <Typography variant='body2'>
              {config.modelSettings?.whisperModel || 'Auto-select'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant='body2' color='text.secondary'>
              Character Set:
            </Typography>
            <Typography variant='body2'>
              {config.charset === 'traditional' ? 'Traditional' : 'Simplified'}
            </Typography>
          </Box>

          {config.subtitle && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant='body2' color='text.secondary'>
                Translation:
              </Typography>
              <Typography variant='body2'>{config.subtitle}</Typography>
            </Box>
          )}

          <Box>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
              Features:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {/* Basic Features - Always show written style since it's a core function */}
              <Chip
                label={`✍️ Transcription${config.geminiKey ? ' (AI Enhanced)' : ''}`}
                size='small'
                sx={{
                  fontSize: '0.7rem',
                  height: 24,
                  backgroundColor: config.geminiKey
                    ? 'rgba(87, 242, 135, 0.15)'
                    : 'rgba(125, 211, 252, 0.15)',
                  color: config.geminiKey ? 'success.main' : 'info.main',
                  border: config.geminiKey
                    ? '1px solid rgba(87, 242, 135, 0.3)'
                    : '1px solid rgba(125, 211, 252, 0.3)',
                  fontWeight: 500,
                }}
              />

              {/* Enhanced Options */}
              {[
                config.speakers && { label: 'Speakers', icon: '👥' },
                config.music && { label: 'Music Detection', icon: '🎵' },
                config.geminiKey && { label: 'AI Refinement', icon: '✨' },
              ]
                .filter((option): option is { label: string; icon: string } => Boolean(option))
                .map((option, index) => (
                  <Chip
                    key={index}
                    label={`${option.icon} ${option.label}`}
                    size='small'
                    sx={{
                      fontSize: '0.7rem',
                      height: 24,
                      backgroundColor: 'rgba(87, 242, 135, 0.15)',
                      color: 'success.main',
                      border: '1px solid rgba(87, 242, 135, 0.3)',
                      fontWeight: 500,
                    }}
                  />
                ))}
            </Box>
          </Box>
        </Stack>
      </Card>

      {/* Enhanced Tips */}
      <Card
        sx={{
          p: 3,
          background:
            'linear-gradient(135deg, rgba(125, 211, 252, 0.08) 0%, rgba(125, 211, 252, 0.03) 100%)',
          border: '1px solid rgba(125, 211, 252, 0.2)',
          borderRadius: 3,
        }}
      >
        <Typography
          variant='subtitle1'
          sx={{
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontWeight: 600,
            color: 'info.main',
          }}
        >
          💡 Pro Tips
        </Typography>

        <Stack spacing={2}>
          {!config.geminiKey && (
            <Alert
              severity='info'
              sx={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(125, 211, 252, 0.3)',
                '& .MuiAlert-icon': { color: 'info.main' },
              }}
            >
              <Typography variant='body2' sx={{ fontSize: '0.8rem' }}>
                Add a Gemini API key for enhanced transcription accuracy
              </Typography>
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <InfoIcon sx={{ color: 'info.main', fontSize: '1rem', mt: 0.25 }} />
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}
            >
              Enable speaker identification for multi-speaker content and music detection for
              content with background audio
            </Typography>
          </Box>

          {processing.status === 'completed' && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <RefreshIcon sx={{ color: 'success.main', fontSize: '1rem', mt: 0.25 }} />
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}
              >
                Not satisfied with the results? Click &quote;Regenerate Subtitles&quot; to process again with 
                different settings or improved audio quality
              </Typography>
            </Box>
          )}
        </Stack>
      </Card>
    </Box>
  );
};
