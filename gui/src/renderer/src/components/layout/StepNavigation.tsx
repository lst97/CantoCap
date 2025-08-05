import React, { useCallback, useEffect, useState, useRef } from 'react';
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
  Snackbar,
  Alert,
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
import { useAppStore } from '../../stores/app-store';
import { useUIStore, selectSettingsUI } from '../../stores/ui-store';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useWorkflowState } from '../../contexts/WorkflowStateContext';
import { useWorkflowNavigation } from '../../hooks/useWorkflowStateManager';
import { useWorkspaceStateSync } from '../../hooks/useWorkspaceStateSync';
import { workflowStateManager } from '../../services/workflow/workflow-state-manager';
import { StepState, AnyWorkflowStepState, StateChangeEvent } from '../../types/workflow-state';

export const StepNavigation: React.FC = () => {
  const { stepsArray, currentStepId } = useWorkflowState();
  const { navigateToStep } = useWorkflowNavigation();
  const { processing } = useAppStore();
  const settingsUI = useUIStore(selectSettingsUI);
  const { currentWorkspace } = useWorkspaceStore();
  
  // Workspace state synchronization hook with optimized performance
  const { syncToWorkspace, isInitialMount } = useWorkspaceStateSync({
    syncDebounceMs: 500,
    minSyncInterval: 1000,
    enableLogging: process.env.NODE_ENV === 'development'
  });

  // Enhanced state management for navigation feedback
  const [navigationState, setNavigationState] = useState<{
    isNavigating: boolean;
    navigatingToStep: string | null;
    lastNavigationAttempt: { stepId: string; timestamp: number } | null;
    feedback: {
      open: boolean;
      message: string;
      severity: 'error' | 'warning' | 'info' | 'success';
    };
  }>({
    isNavigating: false,
    navigatingToStep: null,
    lastNavigationAttempt: null,
    feedback: {
      open: false,
      message: '',
      severity: 'info'
    }
  });

  // Subscribe to workflow state changes for workspace sync
  useEffect(() => {
    const unsubscribe = workflowStateManager.subscribe((event: StateChangeEvent) => {
      // Only sync after initial mount to avoid syncing during restoration
      if (!isInitialMount.current) {
        syncToWorkspace(event);
      }
      
      // Debug logging only in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [STEP NAVIGATION] Step state changed:', {
          stepId: event.stepId,
          previousState: event.previousState,
          newState: event.newState,
          currentStepId: currentStepId
        });
      }
    });
    
    return unsubscribe;
  }, [syncToWorkspace, currentStepId]);


  // Disable navigation when processing is active (except for the current processing step)
  const isProcessingActive =
    processing.isActive && processing.stage !== 'idle' && processing.stage !== 'completed';

  // Enhanced handleStepClick with workspace integration, loading states, feedback, and accessibility
  const handleStepClick = useCallback(
    async (stepId: string, event?: React.MouseEvent | React.KeyboardEvent) => {
      // Prevent rapid successive clicks
      const now = Date.now();
      if (navigationState.lastNavigationAttempt && 
          now - navigationState.lastNavigationAttempt.timestamp < 500 &&
          navigationState.lastNavigationAttempt.stepId === stepId) {
        // Navigation throttled (silent in production)
        return;
      }

      // Accessibility support for keyboard navigation
      if (event && 'key' in event) {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return; // Only respond to Enter and Space keys
        }
        event.preventDefault();
      }

      // Check if currently navigating
      if (navigationState.isNavigating) {
        // Navigation in progress (silent in production)
        setNavigationState(prev => ({
          ...prev,
          feedback: {
            open: true,
            message: 'Navigation already in progress, please wait...',
            severity: 'info'
          }
        }));
        return;
      }

      // Navigation initiated (silent in production)

      // Set loading state
      setNavigationState(prev => ({
        ...prev,
        isNavigating: true,
        navigatingToStep: stepId,
        lastNavigationAttempt: { stepId, timestamp: now },
        feedback: { ...prev.feedback, open: false } // Close any existing feedback
      }));

      try {
        const result = await navigateToStep(stepId);
        
        if (result.success) {
          // Success feedback (silent - no snackbar)
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Navigation successful: ${stepId}`);
          }
          
          // Workspace sync will be handled automatically by the hook
          
          setNavigationState(prev => ({
            ...prev,
            isNavigating: false,
            navigatingToStep: null,
            feedback: { ...prev.feedback, open: false } // Don't show success snackbar
          }));

        } else {
          // Navigation blocked or failed
          const isBlocked = result.stepState && ['blocked', 'pending'].includes(result.stepState);
          const severity = isBlocked ? 'warning' : 'error';
          const userMessage = result.details || result.error || 'Navigation failed';

          console.warn(`⚠️ Navigation ${isBlocked ? 'blocked' : 'failed'}: ${stepId}`, {
            error: result.error,
            details: result.details,
            stepState: result.stepState
          });

          setNavigationState(prev => ({
            ...prev,
            isNavigating: false,
            navigatingToStep: null,
            feedback: {
              open: true,
              message: userMessage,
              severity
            }
          }));

          // Auto-hide error/warning messages after 5 seconds
          setTimeout(() => {
            setNavigationState(prev => ({
              ...prev,
              feedback: { ...prev.feedback, open: false }
            }));
          }, 5000);
        }
      } catch (error) {
        // Unexpected error handling
        const errorMessage = error instanceof Error ? error.message : 'Unexpected navigation error';
        
        console.error(`🚨 Navigation error: ${stepId}`, error);
        
        setNavigationState(prev => ({
          ...prev,
          isNavigating: false,
          navigatingToStep: null,
          feedback: {
            open: true,
            message: `Navigation error: ${errorMessage}`,
            severity: 'error'
          }
        }));

        // Auto-hide error messages after 5 seconds
        setTimeout(() => {
          setNavigationState(prev => ({
            ...prev,
            feedback: { ...prev.feedback, open: false }
          }));
        }, 5000);
      }
    },
    [navigateToStep, navigationState.isNavigating, navigationState.lastNavigationAttempt]
  );

  // Handler for closing feedback snackbar
  const handleCloseFeedback = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setNavigationState(prev => ({
      ...prev,
      feedback: { ...prev.feedback, open: false }
    }));
  }, []);

  const getStepIcon = useCallback(
    (step: AnyWorkflowStepState, index: number) => {
      const state = step.stateMetadata.state;
      const isCurrentStep = currentStepId === step.id;
      const isProcessingStep = step.id === 'processing' && isProcessingActive;

      // Enhanced icon selection with processing awareness
      switch (state) {
        case StepState.Complete:
          return (
            <Grow in={true} timeout={300}>
              <CompletedIcon sx={{ fontSize: 16, color: 'inherit' }} />
            </Grow>
          );
        case StepState.Error:
          return (
            <Box sx={{ position: 'relative' }}>
              <ErrorIcon sx={{ fontSize: 16, color: 'inherit' }} />
              {/* Subtle pulsing effect for errors */}
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
        case StepState.Warning:
          return <WarningIcon sx={{ fontSize: 16, color: 'inherit' }} />;
        case StepState.Blocked:
          return isCurrentStep && isProcessingActive ? (
            <LockedIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
          ) : (
            <BlockedIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.6 }} />
          );
        case StepState.Skip:
          return <SkipIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />;
        case StepState.Ready:
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
          ) : isCurrentStep ? (
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
                opacity: state === StepState.Pending ? 0.7 : 1,
              }}
            >
              {index + 1}
            </Typography>
          );
      }
    },
    [currentStepId, isProcessingActive]
  );

  const getStepColor = useCallback(
    (step: AnyWorkflowStepState) => {
      const state = step.stateMetadata.state;
      const isCurrentStep = currentStepId === step.id;
      const isProcessingStep = step.id === 'processing' && isProcessingActive;

      // Enhanced color logic with processing awareness
      switch (state) {
        case StepState.Complete:
          return isCurrentStep ? 'success.dark' : 'success.main';
        case StepState.Error:
          return 'error.main';
        case StepState.Warning:
          return isCurrentStep ? 'warning.dark' : 'warning.main';
        case StepState.Blocked:
          return isCurrentStep && isProcessingActive
            ? 'warning.main' // Highlight blocked state during processing
            : 'grey.700';
        case StepState.Skip:
          return 'grey.500';
        case StepState.Ready:
          if (isProcessingStep) {
            return 'info.main'; // Special color for active processing
          }
          return isCurrentStep ? 'primary.main' : 'grey.600';
        default:
          return isCurrentStep ? 'primary.main' : 'grey.700';
      }
    },
    [currentStepId, isProcessingActive]
  );

  const getStepTooltip = useCallback(
    (step: AnyWorkflowStepState) => {
      const state = step.stateMetadata.state;
      const metadata = step.stateMetadata;
      const isCurrentStep = currentStepId === step.id;
      const isProcessingStep = step.id === 'processing' && isProcessingActive;

      // Enhanced context-aware tooltips
      switch (state) {
        case StepState.Error:
          return `❌ Error: ${metadata.message || 'This step encountered an error and needs attention'}`;
        case StepState.Warning:
          return `⚠️ Warning: ${metadata.message || 'This step completed with warnings'}`;
        case StepState.Blocked:
          if (isProcessingActive && !isProcessingStep) {
            return `⏸️ Blocked: Waiting for processing to complete before this step becomes available`;
          }
          return `🚫 Blocked: ${metadata.message || 'Complete previous steps to unlock this step'}`;
        case StepState.Skip:
          return `⏭️ Skipped: ${metadata.message || 'This step was skipped based on your workflow'}`;
        case StepState.Complete:
          const completedAt =
            metadata.stateSpecific && 'completedAt' in metadata.stateSpecific
              ? metadata.stateSpecific.completedAt
              : null;
          const timeInfo = completedAt
            ? ` (completed ${new Date(completedAt).toLocaleTimeString()})`
            : '';
          return `✅ Completed: ${step.description}${timeInfo}`;
        case StepState.Ready:
          if (isProcessingStep) {
            return `⚙️ Processing: Currently processing your content - this may take a moment`;
          }
          if (isCurrentStep) {
            return `▶️ Current: ${step.description} - Click to continue or navigate to other available steps`;
          }
          return `✋ Ready: ${step.description} - Click to navigate to this step`;
        default:
          return step.description;
      }
    },
    [currentStepId, isProcessingActive]
  );

  // Get the appropriate chip based on StepState enum with enhanced styling
  const getStepChip = useCallback(
    (step: AnyWorkflowStepState) => {
      const state = step.stateMetadata.state;
      const isCurrentStep = currentStepId === step.id;
      const isProcessingStep = step.id === 'processing' && isProcessingActive;

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
        case StepState.Error:
          return (
            <Fade in={true} timeout={300}>
              <Chip
                label='Error'
                color='error'
                variant={isCurrentStep ? 'filled' : 'outlined'}
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
        case StepState.Warning:
          return (
            <Chip
              label='Warning'
              color='warning'
              variant={isCurrentStep ? 'filled' : 'outlined'}
              {...baseChipProps}
            />
          );
        case StepState.Blocked:
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
        case StepState.Skip:
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
        case StepState.Complete:
          return (
            <Grow in={true} timeout={500}>
              <Chip
                label='Done'
                color='success'
                variant={isCurrentStep ? 'filled' : 'outlined'}
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
        case StepState.Ready:
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
          return isCurrentStep ? (
            <Chip label='Current' color='primary' variant='filled' {...baseChipProps} />
          ) : null;
        default:
          return null;
      }
    },
    [currentStepId, isProcessingActive]
  );

  // Hide step navigation when in settings mode
  if (settingsUI.isSettingsMode) {
    return null;
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

      {/* Header */}
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
        <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
          {currentWorkspace?.name || 'Subtitle Workflow'}
          {isProcessingActive && (
            <Typography
              component='span'
              variant='caption'
              sx={{
                ml: 1,
                color: 'info.main',
                fontStyle: 'italic',
                fontSize: '0.7rem',
              }}
            >
              (Processing...)
            </Typography>
          )}
        </Typography>
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
            {stepsArray.map((step, index) => {
              const state = step.stateMetadata.state;
              const isDisabled =
                state === StepState.Blocked ||
                state === StepState.Skip ||
                (isProcessingActive && step.id !== 'processing');
              const isSelected = currentStepId === step.id;

              return (
                <Tooltip key={step.id} title={getStepTooltip(step)} placement='right' arrow>
                  <ListItemButton
                    selected={isSelected}
                    disabled={isDisabled || navigationState.isNavigating}
                    onClick={(event) => handleStepClick(step.id, event)}
                    onKeyDown={(event) => handleStepClick(step.id, event)}
                    role="button"
                    tabIndex={isDisabled ? -1 : 0}
                    aria-label={`Navigate to ${step.id} step - ${getStepTooltip(step).replace(/[^a-zA-Z0-9\s]/g, '')}`}
                    aria-disabled={isDisabled || navigationState.isNavigating}
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
                        opacity: state === StepState.Blocked && isProcessingActive ? 0.6 : 0.4,
                        cursor: 'not-allowed',
                        backgroundColor:
                          state === StepState.Error ? 'rgba(211, 47, 47, 0.05)' : 'transparent',
                        '&::before': {
                          content:
                            state === StepState.Blocked && isProcessingActive ? '""' : 'none',
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
                      ...(step.id === 'processing' &&
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
                          backgroundColor: getStepColor(step),
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          opacity: state === StepState.Skip ? 0.7 : 1,
                          position: 'relative',

                          // Enhanced state-specific styling
                          ...(state === StepState.Complete && {
                            boxShadow: '0 0 0 2px rgba(76, 175, 80, 0.3)',
                            transform: 'scale(1.05)',
                          }),

                          ...(state === StepState.Error && {
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

                          ...(step.id === 'processing' &&
                            isProcessingActive && {
                              boxShadow: '0 0 0 2px rgba(33, 150, 243, 0.4)',
                              transform: 'scale(1.1)',
                            }),

                          ...(isSelected &&
                            state !== StepState.Error && {
                              boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.5)',
                              transform: 'scale(1.08)',
                            }),

                          ...(state === StepState.Blocked &&
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
                        {getStepIcon(step, index)}

                        {/* Processing progress indicator */}
                        {step.id === 'processing' && isProcessingActive && (
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

                        {/* Navigation loading indicator */}
                        {navigationState.isNavigating && navigationState.navigatingToStep === step.id && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              zIndex: 10,
                            }}
                          >
                            <CircularProgress
                              size={16}
                              thickness={4}
                              sx={{
                                color: 'primary.main',
                                animation: 'fadeInOut 1s ease-in-out infinite',
                                '@keyframes fadeInOut': {
                                  '0%, 100%': { opacity: 0.7 },
                                  '50%': { opacity: 1 },
                                },
                              }}
                            />
                          </Box>
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
                              opacity: state === StepState.Skip ? 0.7 : 1,
                              textDecoration: state === StepState.Skip ? 'line-through' : 'none',
                              transition: 'all 0.2s ease-in-out',
                              color: state === StepState.Error ? 'error.main' : 'inherit',
                              flexGrow: 1,
                            }}
                          >
                            {step.title}
                          </Typography>
                          {getStepChip(step)}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography
                            variant='caption'
                            sx={{
                              fontSize: '0.75rem',
                              color: state === StepState.Error ? 'error.main' : 'text.secondary',
                              opacity: state === StepState.Skip ? 0.7 : 1,
                              lineHeight: 1.2,
                              transition: 'color 0.2s ease-in-out',
                            }}
                          >
                            {step.description}
                          </Typography>

                          {/* Additional context for processing state */}
                          {step.id === 'processing' && isProcessingActive && (
                            <Box sx={{ mt: 0.5 }}>
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
                            </Box>
                          )}

                          {/* Error details */}
                          {state === StepState.Error && step.stateMetadata.message && (
                            <Typography
                              variant='caption'
                              sx={{
                                fontSize: '0.65rem',
                                color: 'error.main',
                                fontStyle: 'italic',
                                mt: 0.25,
                                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 0.5,
                                border: '1px solid rgba(211, 47, 47, 0.2)',
                              }}
                            >
                              {step.stateMetadata.message}
                            </Typography>
                          )}

                          {/* Warning details */}
                          {state === StepState.Warning && step.stateMetadata.message && (
                            <Typography
                              variant='caption'
                              sx={{
                                fontSize: '0.65rem',
                                color: 'warning.main',
                                fontStyle: 'italic',
                                mt: 0.25,
                                backgroundColor: 'rgba(245, 124, 0, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 0.5,
                                border: '1px solid rgba(245, 124, 0, 0.2)',
                              }}
                            >
                              {step.stateMetadata.message}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>
        </Box>
      </Box>

      {/* Navigation feedback snackbar */}
      <Snackbar
        open={navigationState.feedback.open}
        autoHideDuration={navigationState.feedback.severity === 'success' ? 2000 : 5000}
        onClose={handleCloseFeedback}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          zIndex: 9999,
          '& .MuiSnackbarContent-root': {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }
        }}
      >
        <Alert
          onClose={handleCloseFeedback}
          severity={navigationState.feedback.severity}
          variant="filled"
          sx={{
            width: '100%',
            borderRadius: 2,
            fontWeight: 500,
            '& .MuiAlert-icon': {
              fontSize: '1.2rem',
            },
            '& .MuiAlert-message': {
              fontSize: '0.875rem',
              lineHeight: 1.4,
            },
            // Custom styling based on severity
            ...(navigationState.feedback.severity === 'success' && {
              backgroundColor: 'success.main',
              color: 'success.contrastText',
            }),
            ...(navigationState.feedback.severity === 'warning' && {
              backgroundColor: 'warning.main',
              color: 'warning.contrastText',
            }),
            ...(navigationState.feedback.severity === 'error' && {
              backgroundColor: 'error.main',
              color: 'error.contrastText',
            }),
          }}
        >
          {navigationState.feedback.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

StepNavigation.displayName = 'StepNavigation';
