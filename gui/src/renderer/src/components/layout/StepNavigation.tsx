/**
 * Step Navigation Component
 * Uses centralized Zustand store system for step navigation and state management
 * Maintains the same polished UI design with updated architecture
 */

import React, { useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Tooltip,
  LinearProgress,
  Fade,
  Grow,
  CircularProgress,
} from '@mui/material';
import {
  MoreHoriz as MoreIcon,
  Remove as SkipIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Block as BlockedIcon,
  PlayArrow as ReadyIcon,
  HourglassTop as ProcessingIcon,
  LockOutlined as LockedIcon,
  CheckCircleOutline as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
} from '@mui/icons-material';

// Use centralized store system
import {
  useCurrentStep,
  useWorkflowActions,
  useStepState,
  useWorkflowStore,
} from '../../stores/useWorkflowStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useInputStepContent } from '../../stores/useStepStore';
import type { StepType, StepStatusType } from '../../stores/types/StoreTypes';
import { StepStatus } from '../../stores/types/StoreTypes';

// Step metadata to provide titles and descriptions
const STEP_METADATA: Record<StepType, { title: string; description: string }> = {
  input: {
    title: 'Select Input',
    description: 'Choose your audio/video file to transcribe',
  },
  config: {
    title: 'Configure Settings',
    description: 'Set up transcription and translation options',
  },
  processing: {
    title: 'Processing',
    description: 'Transcribing and generating subtitles',
  },
  review: {
    title: 'Review & Edit',
    description: 'Review and edit generated subtitles',
  },
  export: {
    title: 'Export Results',
    description: 'Export subtitles in your preferred format',
  },
};

// Performance optimized component with centralized state
export const StepNavigation: React.FC = React.memo(() => {
  // Use centralized store hooks - optimized to prevent infinite renders
  const currentStep = useCurrentStep();
  const workflowActions = useWorkflowActions();
  const workspaces = useWorkspaceStore(state => state.workspaces);
  const currentWorkspaceId = useWorkspaceStore(state => state.currentWorkspaceId);
  const inputStepContent = useInputStepContent();

  // Get current workspace
  const currentWorkspace = currentWorkspaceId ? workspaces[currentWorkspaceId] : null;

  // Memoized processing state - check if processing step is active
  const processingStepState = useStepState('processing');
  const isProcessingActive = useMemo(() => {
    return currentStep === 'processing' && processingStepState === StepStatus.READY;
  }, [currentStep, processingStepState]);

  // Get steps with states - memoized to prevent infinite renders
  const stepsWithStates = useMemo(() => {
    const stepStates = useWorkflowStore.getState().stepStates;
    const canNavigate = useWorkflowStore.getState().canNavigate;
    const STEP_ORDER: StepType[] = ['input', 'config', 'processing', 'review', 'export'];
    
    return STEP_ORDER.map((step) => ({
      step,
      state: stepStates[step],
      canNavigate: canNavigate[step],
      isCurrent: currentStep === step,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, processingStepState]); // Only depend on current step and processing state

  // Enhanced handleStepClick with centralized navigation
  const handleStepClick = useCallback(
    async (stepId: StepType, event?: React.MouseEvent | React.KeyboardEvent) => {
      // Accessibility support for keyboard navigation
      if (event && 'key' in event) {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
      }

      try {
        await workflowActions.navigateToStep(stepId);
      } catch (error) {
        console.error(`Navigation error for ${stepId}:`, error);
      }
    },
    [workflowActions]
  );

  // Memoized icon rendering function
  const getStepIcon = useCallback(
    (stepData: { step: StepType; state: StepStatusType; isCurrent: boolean }, index: number) => {
      const { step, state, isCurrent } = stepData;
      const isProcessingStep = step === 'processing' && isProcessingActive;

      switch (state) {
        case StepStatus.COMPLETE:
          return (
            <Grow in={true} timeout={300}>
              <CompletedIcon sx={{ fontSize: 16, color: 'inherit' }} />
            </Grow>
          );
        case StepStatus.ERROR:
          return (
            <Box sx={{ position: 'relative' }}>
              <ErrorIcon sx={{ fontSize: 16, color: 'inherit' }} />
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'error.main',
                  opacity: 0.3,
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)', opacity: 0.3 },
                    '50%': { transform: 'scale(1.2)', opacity: 0.1 },
                    '100%': { transform: 'scale(1)', opacity: 0.3 },
                  },
                }}
              />
            </Box>
          );
        case StepStatus.WARNING:
          return <WarningIcon sx={{ fontSize: 16, color: 'inherit' }} />;
        case StepStatus.BLOCK:
          return isCurrent && isProcessingActive ? (
            <LockedIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
          ) : (
            <BlockedIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.6 }} />
          );
        case StepStatus.SKIP:
          return <SkipIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />;
        case StepStatus.READY:
          return isProcessingStep ? (
            <Box sx={{ position: 'relative' }}>
              <ProcessingIcon
                sx={{
                  fontSize: 16,
                  color: 'inherit',
                  animation: 'spin 2s linear infinite',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </Box>
          ) : isCurrent ? (
            <ReadyIcon sx={{ fontSize: 16, color: 'inherit' }} />
          ) : (
            <PendingIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.8 }} />
          );
        default:
          return (
            <Typography
              variant='caption'
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              {index + 1}
            </Typography>
          );
      }
    },
    [isProcessingActive]
  );

  // Memoized color determination
  const getStepColor = useCallback(
    (stepData: { step: StepType; state: StepStatusType; isCurrent: boolean }) => {
      const { step, state, isCurrent } = stepData;
      const isProcessingStep = step === 'processing' && isProcessingActive;

      switch (state) {
        case StepStatus.COMPLETE:
          return isCurrent ? 'success.dark' : 'success.main';
        case StepStatus.ERROR:
          return 'error.main';
        case StepStatus.WARNING:
          return isCurrent ? 'warning.dark' : 'warning.main';
        case StepStatus.BLOCK:
          return isCurrent && isProcessingActive ? 'warning.main' : 'grey.700';
        case StepStatus.SKIP:
          return 'grey.500';
        case StepStatus.READY:
          if (isProcessingStep) {
            return 'info.main';
          }
          return isCurrent ? 'primary.main' : 'grey.600';
        default:
          return isCurrent ? 'primary.main' : 'grey.700';
      }
    },
    [isProcessingActive]
  );

  // Memoized tooltip content
  const getStepTooltip = useCallback(
    (stepData: { step: StepType; state: StepStatusType; isCurrent: boolean }) => {
      const { step, state, isCurrent } = stepData;
      const isProcessingStep = step === 'processing' && isProcessingActive;
      const description = STEP_METADATA[step].description;

      switch (state) {
        case StepStatus.ERROR:
          return `❌ Error: This step encountered an error and needs attention`;
        case StepStatus.WARNING:
          return `⚠️ Warning: This step completed with warnings`;
        case StepStatus.BLOCK:
          if (isProcessingActive && !isProcessingStep) {
            return `⏸️ Blocked: Waiting for processing to complete before this step becomes available`;
          }
          return `🚫 Blocked: Complete previous steps to unlock this step`;
        case StepStatus.SKIP:
          return `⏭️ Skipped: This step was skipped based on your workflow`;
        case StepStatus.COMPLETE:
          return `✅ Completed: ${description}`;
        case StepStatus.READY:
          if (isProcessingStep) {
            return `⚙️ Processing: Currently processing your content - this may take a moment`;
          }
          if (isCurrent) {
            return `▶️ Current: ${description} - Click to continue or navigate to other available steps`;
          }
          return `✋ Ready: ${description} - Click to navigate to this step`;
        default:
          return description;
      }
    },
    [isProcessingActive]
  );

  // Memoized chip rendering
  const getStepChip = useCallback(
    (stepData: { step: StepType; state: StepStatusType; isCurrent: boolean }) => {
      const { step, state, isCurrent } = stepData;
      const isProcessingStep = step === 'processing' && isProcessingActive;

      const baseChipProps = {
        size: 'small' as const,
        sx: {
          height: 16,
          fontSize: '0.65rem',
          fontWeight: 500,
          transition: 'all 0.2s ease-in-out',
        },
      };

      switch (state) {
        case StepStatus.ERROR:
          return (
            <Fade in={true} timeout={300}>
              <Chip
                label='Error'
                color='error'
                variant={isCurrent ? 'filled' : 'outlined'}
                {...baseChipProps}
                sx={{
                  ...baseChipProps.sx,
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                }}
              />
            </Fade>
          );
        case StepStatus.WARNING:
          return (
            <Chip
              label='Warning'
              color='warning'
              variant={isCurrent ? 'filled' : 'outlined'}
              {...baseChipProps}
            />
          );
        case StepStatus.BLOCK:
          return (
            <Chip
              label={isProcessingActive && !isProcessingStep ? 'Waiting' : 'Blocked'}
              color='default'
              variant='outlined'
              {...baseChipProps}
              sx={{
                ...baseChipProps.sx,
                opacity: 0.7,
                borderColor: isProcessingActive && !isProcessingStep ? 'warning.main' : 'grey.400',
              }}
            />
          );
        case StepStatus.SKIP:
          return (
            <Chip
              label='Skipped'
              color='default'
              variant='outlined'
              {...baseChipProps}
              sx={{
                ...baseChipProps.sx,
                opacity: 0.6,
                textDecoration: 'line-through',
              }}
            />
          );
        case StepStatus.COMPLETE:
          return (
            <Grow in={true} timeout={500}>
              <Chip
                label='Done'
                color='success'
                variant={isCurrent ? 'filled' : 'outlined'}
                {...baseChipProps}
                sx={{
                  ...baseChipProps.sx,
                  '&.MuiChip-filled': {
                    backgroundColor: 'success.main',
                    color: 'success.contrastText',
                  },
                }}
              />
            </Grow>
          );
        case StepStatus.READY:
          if (isProcessingStep) {
            return (
              <Chip
                label='Processing'
                color='info'
                variant='filled'
                {...baseChipProps}
                sx={{
                  ...baseChipProps.sx,
                  backgroundColor: 'info.main',
                  color: 'info.contrastText',
                  animation: 'glow 2s ease-in-out infinite alternate',
                  '@keyframes glow': {
                    '0%': { opacity: 0.8 },
                    '100%': { opacity: 1 },
                  },
                }}
              />
            );
          }
          return isCurrent ? (
            <Chip label='Current' color='primary' variant='filled' {...baseChipProps} />
          ) : null;
        default:
          return null;
      }
    },
    [isProcessingActive]
  );

  // Show loading state if no steps available
  if (stepsWithStates.length === 0) {
    return (
      <Box
        sx={{
          width: 280,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: 1,
          borderColor: 'divider',
          minHeight: 400,
        }}
      >
        <CircularProgress size={24} />
        <Typography variant='caption' sx={{ mt: 2, color: 'text.secondary' }}>
          Loading workflow...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 280,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        position: 'relative',
      }}
    >
      {/* Processing progress indicator */}
      {isProcessingActive && (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 10,
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'info.main',
              animation: 'processingGlow 2s ease-in-out infinite alternate',
              '@keyframes processingGlow': {
                '0%': { opacity: 0.8 },
                '100%': { opacity: 1 },
              },
            },
          }}
        />
      )}

      {/* Header with workspace info and import context indicator */}
      <Box
        sx={{
          height: 48,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
            {currentWorkspace?.name || 'Subtitle Workflow'}
          </Typography>

          {/* Import context indicator */}
          {inputStepContent?.importedJsonFile && (
            <Tooltip title={`Imported: ${inputStepContent.importedJsonFile.split('/').pop()}`}>
              <Chip
                label='JSON'
                size='small'
                color='info'
                variant='outlined'
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: 500,
                }}
              />
            </Tooltip>
          )}

          {isProcessingActive && (
            <Typography
              component='span'
              variant='caption'
              sx={{
                color: 'info.main',
                fontStyle: 'italic',
                fontSize: '0.7rem',
              }}
            >
              (Processing...)
            </Typography>
          )}
        </Box>
        <IconButton size='small'>
          <MoreIcon fontSize='small' />
        </IconButton>
      </Box>

      {/* Steps */}
      <Box sx={{ flex: 1, p: 1, overflow: 'auto' }}>
        <Box sx={{ mb: 2 }}>
          <Typography
            variant='caption'
            sx={{
              px: 1,
              py: 0.5,
              fontWeight: 600,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Processing Steps
          </Typography>
          <List dense sx={{ mt: 0.5 }}>
            {stepsWithStates.map((stepData, index) => {
              const { step, state, canNavigate, isCurrent } = stepData;
              const isDisabled = !canNavigate || (isProcessingActive && step !== 'processing');
              const isSelected = isCurrent;

              return (
                <Tooltip key={step} title={getStepTooltip(stepData)} placement='right' arrow>
                  <ListItemButton
                    selected={isSelected}
                    disabled={isDisabled}
                    onClick={(event) => handleStepClick(step, event)}
                    onKeyDown={(event) => handleStepClick(step, event)}
                    role='button'
                    tabIndex={isDisabled ? -1 : 0}
                    aria-label={`Navigate to ${step} step - ${getStepTooltip(stepData).replace(/[^a-zA-Z0-9\s]/g, '')}`}
                    aria-disabled={isDisabled}
                    aria-current={isSelected ? 'step' : undefined}
                    sx={{
                      borderRadius: 1,
                      mx: 0.5,
                      mb: 0.5,
                      minHeight: 60,
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

                      // Enhanced selected state styling
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        color: 'primary.main',
                        borderLeft: 3,
                        borderColor: 'primary.main',
                        transform: 'translateX(2px)',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)',
                        '&:hover': {
                          backgroundColor: 'rgba(245, 158, 11, 0.18)',
                          transform: 'translateX(3px)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          background: 'linear-gradient(to bottom, primary.main, primary.dark)',
                        },
                      },

                      // Enhanced hover states
                      '&:hover:not(.Mui-disabled):not(.Mui-selected)': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        transform: 'translateX(1px)',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          backgroundColor: 'primary.main',
                          opacity: 0.5,
                        },
                      },

                      // Enhanced disabled state
                      '&.Mui-disabled': {
                        opacity: state === StepStatus.BLOCK && isProcessingActive ? 0.6 : 0.4,
                        cursor: 'not-allowed',
                        backgroundColor:
                          state === StepStatus.ERROR ? 'rgba(211, 47, 47, 0.05)' : 'transparent',
                        '&::before': {
                          content: state === StepStatus.BLOCK && isProcessingActive ? '""' : 'none',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          backgroundColor: 'warning.main',
                          opacity: 0.5,
                        },
                      },

                      // Processing step special styling
                      ...(step === 'processing' &&
                        isProcessingActive && {
                          backgroundColor: 'rgba(33, 150, 243, 0.08)',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 2,
                            background:
                              'linear-gradient(90deg, transparent, info.main, transparent)',
                            animation: 'shimmer 2s ease-in-out infinite',
                            '@keyframes shimmer': {
                              '0%': { transform: 'translateX(-100%)' },
                              '100%': { transform: 'translateX(100%)' },
                            },
                          },
                        }),
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: getStepColor(stepData),
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          opacity: state === StepStatus.SKIP ? 0.7 : 1,
                          position: 'relative',

                          // Enhanced state-specific styling
                          ...(state === StepStatus.COMPLETE && {
                            boxShadow: '0 0 0 2px rgba(76, 175, 80, 0.3)',
                            transform: 'scale(1.05)',
                          }),

                          ...(state === StepStatus.ERROR && {
                            boxShadow: '0 0 0 2px rgba(211, 47, 47, 0.4)',
                            animation: 'errorPulse 2s infinite',
                            '@keyframes errorPulse': {
                              '0%, 100%': {
                                boxShadow: '0 0 0 2px rgba(211, 47, 47, 0.4)',
                              },
                              '50%': {
                                boxShadow: '0 0 0 4px rgba(211, 47, 47, 0.2)',
                              },
                            },
                          }),

                          ...(step === 'processing' &&
                            isProcessingActive && {
                              boxShadow: '0 0 0 2px rgba(33, 150, 243, 0.4)',
                              transform: 'scale(1.1)',
                            }),

                          ...(isSelected &&
                            state !== 'error' && {
                              boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.5)',
                              transform: 'scale(1.08)',
                            }),

                          ...(state === StepStatus.BLOCK &&
                            isProcessingActive && {
                              backgroundColor: 'warning.main',
                              animation: 'waitingPulse 3s ease-in-out infinite',
                              '@keyframes waitingPulse': {
                                '0%, 100%': { opacity: 0.6 },
                                '50%': { opacity: 0.8 },
                              },
                            }),
                        }}
                      >
                        {getStepIcon(stepData, index)}

                        {/* Processing progress indicator */}
                        {step === 'processing' && isProcessingActive && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -2,
                              left: -2,
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              border: '2px solid transparent',
                              borderTop: '2px solid info.light',
                              animation: 'spin 1s linear infinite',
                              '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' },
                              },
                            }}
                          />
                        )}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Typography
                            variant='body2'
                            sx={{
                              fontWeight: isSelected ? 700 : 600,
                              fontSize: '0.875rem',
                              opacity: state === StepStatus.SKIP ? 0.7 : 1,
                              textDecoration: state === StepStatus.SKIP ? 'line-through' : 'none',
                              transition: 'all 0.2s ease-in-out',
                              color: state === StepStatus.ERROR ? 'error.main' : 'inherit',
                              flexGrow: 1,
                            }}
                          >
                            {STEP_METADATA[step].title}
                          </Typography>
                          {getStepChip(stepData)}
                        </Box>
                      }
                      secondary={
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <Typography
                            variant='caption'
                            component="span"
                            sx={{
                              fontSize: '0.75rem',
                              color: state === 'error' ? 'error.main' : 'text.secondary',
                              opacity: state === StepStatus.SKIP ? 0.7 : 1,
                              lineHeight: 1.2,
                              transition: 'color 0.2s ease-in-out',
                            }}
                          >
                            {STEP_METADATA[step].description}
                          </Typography>

                          {/* Additional context for processing state */}
                          {step === 'processing' && isProcessingActive && (
                            <span style={{ marginTop: '4px', display: 'block' }}>
                              <LinearProgress
                                sx={{
                                  height: 2,
                                  borderRadius: 1,
                                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: 'info.main',
                                    borderRadius: 1,
                                  },
                                }}
                              />
                              <Typography
                                variant='caption'
                                component="span"
                                sx={{
                                  fontSize: '0.65rem',
                                  color: 'info.main',
                                  fontStyle: 'italic',
                                  mt: 0.25,
                                  display: 'block',
                                }}
                              >
                                Processing in progress...
                              </Typography>
                            </span>
                          )}

                          {/* Error details */}
                          {state === StepStatus.ERROR && (
                            <Typography
                              variant='caption'
                              component="span"
                              sx={{
                                fontSize: '0.65rem',
                                color: 'error.main',
                                fontStyle: 'italic',
                                mt: 0.25,
                                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 0.5,
                                border: '1px solid rgba(211, 47, 47, 0.2)',
                                display: 'block',
                              }}
                            >
                              Step encountered an error
                            </Typography>
                          )}

                          {/* Warning details */}
                          {state === StepStatus.WARNING && (
                            <Typography
                              variant='caption'
                              component="span"
                              sx={{
                                fontSize: '0.65rem',
                                color: 'warning.main',
                                fontStyle: 'italic',
                                mt: 0.25,
                                backgroundColor: 'rgba(245, 124, 0, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 0.5,
                                border: '1px solid rgba(245, 124, 0, 0.2)',
                                display: 'block',
                              }}
                            >
                              Step completed with warnings
                            </Typography>
                          )}
                        </span>
                      }
                    />
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>
        </Box>
      </Box>
    </Box>
  );
});

StepNavigation.displayName = 'EnhancedStepNavigation';

export default StepNavigation;
