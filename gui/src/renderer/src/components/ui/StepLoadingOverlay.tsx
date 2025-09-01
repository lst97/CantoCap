import React from 'react';
import { Box, CircularProgress, Typography, Fade } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: theme.zIndex.modal - 1, // Below modals but above content
  backdropFilter: 'blur(2px)',
  ...theme.applyStyles('dark', {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  }),
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  boxShadow: theme.shadows[4],
  border: `1px solid ${theme.palette.divider}`,
  minWidth: 240,
  maxWidth: 320,
}));

interface StepLoadingOverlayProps {
  /** Whether the overlay is visible */
  open: boolean;
  /** Loading message to display */
  message?: string;
  /** Secondary message for additional details */
  subtitle?: string;
  /** Show spinning progress indicator */
  showProgress?: boolean;
  /** Custom progress size */
  progressSize?: number;
  /** Transition timeout in milliseconds */
  timeout?: number;
  /** Whether the overlay is transitioning */
  isTransitioning?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * StepLoadingOverlay component for displaying loading states within step content area
 *
 * This overlay is specifically designed for WORKSPACE OPERATIONS ONLY:
 * - Initial workspace system loading
 * - Workspace switching/loading
 *
 * IMPORTANT: Should NOT be used for normal step configuration changes to avoid
 * disruptive UX during regular user interactions.
 */
export const StepLoadingOverlay: React.FC<StepLoadingOverlayProps> = ({
  open,
  message = 'Loading...',
  subtitle,
  showProgress = true,
  progressSize = 40,
  timeout = 400,
  className,
}) => {
  return (
    <Fade in={open} timeout={timeout} unmountOnExit>
      <StyledOverlay className={className}>
        <LoadingContainer>
          {showProgress && (
            <CircularProgress
              variant='indeterminate'
              size={progressSize}
              thickness={4}
              sx={{
                color: 'primary.main',
                animation: 'spin 1.4s linear infinite',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                  animation: 'circular-dash 1.4s ease-in-out infinite',
                },
                '@keyframes spin': {
                  '0%': {
                    transform: 'rotate(0deg)',
                  },
                  '100%': {
                    transform: 'rotate(360deg)',
                  },
                },
                '@keyframes circular-dash': {
                  '0%': {
                    strokeDasharray: '1px, 200px',
                    strokeDashoffset: '0px',
                  },
                  '50%': {
                    strokeDasharray: '100px, 200px',
                    strokeDashoffset: '-15px',
                  },
                  '100%': {
                    strokeDasharray: '100px, 200px',
                    strokeDashoffset: '-125px',
                  },
                },
              }}
            />
          )}

          <Box textAlign='center'>
            <Typography
              variant='subtitle1'
              component='div'
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                mb: subtitle ? 0.5 : 0,
              }}
            >
              {message}
            </Typography>

            {subtitle && (
              <Typography variant='body2' color='text.secondary' sx={{ opacity: 0.8 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </LoadingContainer>
      </StyledOverlay>
    </Fade>
  );
};

// Specialized variants for common use cases

interface WorkspaceStepLoadingOverlayProps {
  open: boolean;
  workspaceName?: string;
}

/**
 * Specialized loading overlay for workspace operations within step content
 * Only shows during workspace loading/switching - NOT for configuration changes
 */
export const WorkspaceStepLoadingOverlay: React.FC<WorkspaceStepLoadingOverlayProps> = ({
  open,
  workspaceName,
}) => {
  // Determine the appropriate message based on context
  const getMessage = () => {
    if (workspaceName) {
      return 'Switching Workspace';
    }
    return 'Loading Configuration';
  };

  const getSubtitle = () => {
    if (workspaceName) {
      return `Loading "${workspaceName}"...`;
    }
    return 'Initializing workspace settings...';
  };

  return (
    <StepLoadingOverlay
      open={open}
      message={getMessage()}
      subtitle={getSubtitle()}
      progressSize={36}
    />
  );
};

interface ConfigStepLoadingOverlayProps {
  open: boolean;
  stepName?: string;
}

/**
 * Specialized loading overlay for configuration loading within step content
 * DEPRECATED: Should not be used to avoid disruptive UX during config changes
 * Use WorkspaceStepLoadingOverlay for workspace operations instead
 */
export const ConfigStepLoadingOverlay: React.FC<ConfigStepLoadingOverlayProps> = ({
  open,
  stepName,
}) => (
  <StepLoadingOverlay
    open={open}
    message='Loading Configuration'
    subtitle={stepName ? `Preparing ${stepName} settings...` : 'Loading step configuration...'}
    progressSize={32}
  />
);

export default StepLoadingOverlay;
