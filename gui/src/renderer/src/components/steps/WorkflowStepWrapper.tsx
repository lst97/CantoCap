/**
 * Wrapper component for workflow steps that provides centralized state management
 * Handles common step functionality like state transitions, error handling, and accessibility
 */

import React, { useEffect, useCallback, useMemo } from 'react'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { 
  useStepState, 
  useStepTransitions, 
  useWorkflowNavigation 
} from '../../hooks/useWorkflowStateManager'
import { StepState } from '../../types/workflow-state'
import { WorkflowStateErrorBoundary } from '../common/WorkflowStateErrorBoundary'

interface WorkflowStepWrapperProps {
  stepId: string
  children: React.ReactNode
  autoTransitionOnMount?: boolean
  requiredConditions?: Array<() => boolean | Promise<boolean>>
  onStepComplete?: () => void | Promise<void>
  onStepError?: (error: Error) => void
  loadingMessage?: string
  className?: string
}

export const WorkflowStepWrapper: React.FC<WorkflowStepWrapperProps> = ({
  stepId,
  children,
  autoTransitionOnMount = false,
  requiredConditions = [],
  onStepComplete,
  onStepError,
  loadingMessage = 'Loading step...',
  className
}) => {
  const { 
    step, 
    state, 
    isReady, 
    isComplete, 
    isBlocked, 
    isError, 
    isSkipped,
    hasWarning,
    isAccessible 
  } = useStepState(stepId)
  
  const { 
    markStepReady, 
    markStepComplete, 
    markStepError, 
    markStepBlocked,
    isTransitioning,
    lastError,
    clearError
  } = useStepTransitions()
  
  const { currentStepId } = useWorkflowNavigation()
  
  const isCurrentStep = currentStepId === stepId
  const shouldShowContent = isAccessible && !isSkipped

  // Auto-transition to ready on mount if requested
  useEffect(() => {
    if (autoTransitionOnMount && state === StepState.Blocked && isCurrentStep) {
      checkConditionsAndTransition()
    }
  }, [autoTransitionOnMount, state, isCurrentStep, stepId])

  // Check required conditions and transition step state accordingly
  const checkConditionsAndTransition = useCallback(async () => {
    if (requiredConditions.length === 0) {
      await markStepReady(stepId, {
        reason: 'Auto-transition on mount',
        context: { autoTransition: true }
      })
      return
    }

    try {
      for (const condition of requiredConditions) {
        const result = await condition()
        if (!result) {
          await markStepBlocked(stepId, 'Required conditions not met', {
            context: { failedConditions: true }
          })
          return
        }
      }
      
      await markStepReady(stepId, {
        reason: 'All required conditions satisfied',
        context: { conditionsChecked: requiredConditions.length }
      })
    } catch (error) {
      console.error(`Failed to check conditions for step ${stepId}:`, error)
      await markStepError(stepId, `Condition check failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        context: { conditionCheckError: true }
      })
      
      if (onStepError) {
        onStepError(error instanceof Error ? error : new Error('Unknown condition check error'))
      }
    }
  }, [stepId, requiredConditions, markStepReady, markStepBlocked, markStepError, onStepError])

  // Handle step completion
  const handleStepComplete = useCallback(async () => {
    try {
      await markStepComplete(stepId, {
        reason: 'Step completed successfully',
        context: { 
          completedAt: Date.now(),
          completionMethod: 'programmatic'
        }
      })
      
      if (onStepComplete) {
        await onStepComplete()
      }
    } catch (error) {
      console.error(`Failed to complete step ${stepId}:`, error)
      await markStepError(stepId, `Completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        context: { completionError: true }
      })
      
      if (onStepError) {
        onStepError(error instanceof Error ? error : new Error('Unknown completion error'))
      }
    }
  }, [stepId, markStepComplete, markStepError, onStepComplete, onStepError])

  // Memoized step status for performance
  const stepStatus = useMemo(() => {
    if (!step) return { status: 'loading', message: 'Step not found' }
    
    switch (state) {
      case StepState.Ready:
        return { status: 'ready', message: 'Step is ready for interaction' }
      case StepState.Complete:
        return { status: 'complete', message: 'Step completed successfully' }
      case StepState.Error:
        return { status: 'error', message: step.stateMetadata.message || 'Step has errors' }
      case StepState.Warning:
        return { status: 'warning', message: step.stateMetadata.message || 'Step has warnings' }
      case StepState.Blocked:
        return { status: 'blocked', message: step.stateMetadata.message || 'Step is blocked' }
      case StepState.Skip:
        return { status: 'skipped', message: 'Step was skipped' }
      default:
        return { status: 'unknown', message: 'Unknown step state' }
    }
  }, [step, state])

  // Render loading state
  if (isTransitioning) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          p: 4,
          gap: 2
        }}
        className={className}
        role="status"
        aria-label="Step is transitioning"
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          {loadingMessage}
        </Typography>
      </Box>
    )
  }

  // Render error state
  if (isError) {
    return (
      <Box sx={{ p: 2 }} className={className}>
        <Alert 
          severity="error" 
          onClose={clearError}
          action={
            <Box>
              {/* Add retry button if needed */}
            </Box>
          }
        >
          <Typography variant="subtitle2" gutterBottom>
            Step Error: {step?.title}
          </Typography>
          <Typography variant="body2">
            {stepStatus.message}
          </Typography>
          {lastError && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', fontFamily: 'monospace' }}>
              Technical details: {lastError}
            </Typography>
          )}
        </Alert>
      </Box>
    )
  }

  // Render blocked state
  if (isBlocked) {
    return (
      <Box sx={{ p: 2 }} className={className}>
        <Alert severity="info">
          <Typography variant="subtitle2" gutterBottom>
            Step Blocked: {step?.title}
          </Typography>
          <Typography variant="body2">
            {stepStatus.message}
          </Typography>
        </Alert>
      </Box>
    )
  }

  // Render skipped state
  if (isSkipped) {
    return (
      <Box sx={{ p: 2, opacity: 0.7 }} className={className}>
        <Alert severity="info">
          <Typography variant="subtitle2" gutterBottom>
            Step Skipped: {step?.title}
          </Typography>
          <Typography variant="body2">
            {stepStatus.message}
          </Typography>
        </Alert>
      </Box>
    )
  }

  // Render warning state (still accessible)
  if (hasWarning && shouldShowContent) {
    return (
      <WorkflowStateErrorBoundary>
        <Box className={className}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {stepStatus.message}
            </Typography>
          </Alert>
          <Box
            role="main"
            aria-label={`${step?.title} step content`}
            aria-describedby={`step-${stepId}-description`}
          >
            {children}
          </Box>
        </Box>
      </WorkflowStateErrorBoundary>
    )
  }

  // Render normal content for ready/complete steps
  if (shouldShowContent) {
    return (
      <WorkflowStateErrorBoundary>
        <Box 
          className={className}
          role="main"
          aria-label={`${step?.title} step content`}
          aria-describedby={`step-${stepId}-description`}
        >
          {children}
        </Box>
      </WorkflowStateErrorBoundary>
    )
  }

  // Fallback for inaccessible steps
  return (
    <Box sx={{ p: 2 }} className={className}>
      <Alert severity="info">
        <Typography variant="subtitle2" gutterBottom>
          Step Not Available: {step?.title}
        </Typography>
        <Typography variant="body2">
          Complete previous steps to access this step.
        </Typography>
      </Alert>
    </Box>
  )
}

/**
 * HOC for wrapping step components with workflow state management
 */
export function withWorkflowStep<P extends object>(
  Component: React.ComponentType<P>,
  stepId: string,
  options?: Omit<WorkflowStepWrapperProps, 'stepId' | 'children'>
) {
  const WrappedComponent = (props: P) => (
    <WorkflowStepWrapper stepId={stepId} {...options}>
      <Component {...props} />
    </WorkflowStepWrapper>
  )
  
  WrappedComponent.displayName = `withWorkflowStep(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

export default WorkflowStepWrapper