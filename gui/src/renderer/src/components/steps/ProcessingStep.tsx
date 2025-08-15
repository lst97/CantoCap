import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Snackbar} from "@mui/material";
import { 
  useProcessingStepContent,
  useStepActions,
  useStepLoading,
  useStepError
} from "../../stores/useStepStore";
import { useWorkflowActions } from "../../stores/useWorkflowStore";
import { ProcessingErrorBoundary } from "../common/ProcessingErrorBoundary";
import { IdleState } from "./ProcessingStep/IdleState";
import { ProcessingControls } from "./ProcessingStep/ProcessingControls";
import { ProcessingStatus } from "./ProcessingStep/ProcessingStatus";
import { ProcessingComplete } from "./ProcessingStep/ProcessingComplete";
import { ProcessingError } from "./ProcessingStep/ProcessingError";
import { useProcessingEvents } from "../../hooks/useProcessingEvents";
import type { ProcessingError as ProcessingErrorType } from '@/types';
import type { ElectronWindow, StepType, StepStatusType } from '../../stores/types/StoreTypes';

// Enhanced error categorization and handling
const categorizeProcessingError = (errorMessage: string): ProcessingErrorType => {
  const message = errorMessage.toLowerCase();
  
  // FFmpeg related errors
  if (message.includes('ffmpeg') && (message.includes('not found') || message.includes('executable'))) {
    return {
      code: 'SETUP_ERROR',
      message: 'FFmpeg is required but not found. Please install FFmpeg to process audio/video files.',
      details: { 
        component: 'FFmpeg', 
        originalError: errorMessage,
        installGuide: 'https://ffmpeg.org/download.html'
      },
      recoverable: true
    };
  }
  
  // Engine/Python related errors
  if (message.includes('python') || message.includes('engine') || message.includes('subprocess')) {
    return {
      code: 'ENGINE_NOT_FOUND',
      message: 'CantoCap engine is not available. Please check your Python installation and engine setup.',
      details: { 
        component: 'Engine', 
        originalError: errorMessage,
        suggestion: 'Try restarting the application or checking engine dependencies'
      },
      recoverable: true
    };
  }
  
  // Configuration errors
  if (message.includes('config') || message.includes('invalid') || message.includes('missing')) {
    return {
      code: 'INVALID_CONFIG',
      message: 'Invalid processing configuration. Please check your settings and try again.',
      details: { 
        component: 'Configuration', 
        originalError: errorMessage,
        suggestion: 'Review your configuration settings in the previous step'
      },
      recoverable: true
    };
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('time out')) {
    return {
      code: 'TIMEOUT_ERROR',
      message: 'Processing timed out. This usually happens with very long files.',
      details: { 
        component: 'Processing', 
        originalError: errorMessage,
        suggestion: 'Try processing shorter segments or increase timeout settings'
      },
      recoverable: true
    };
  }
  
  // IPC/Communication errors
  if (message.includes('ipc') || message.includes('communication') || message.includes('connection')) {
    return {
      code: 'IPC_ERROR',
      message: 'Communication error with the processing engine.',
      details: { 
        component: 'IPC', 
        originalError: errorMessage,
        suggestion: 'Try restarting the application'
      },
      recoverable: true
    };
  }
  
  // Generic process failure
  return {
    code: 'PROCESS_FAILED',
    message: 'Processing failed unexpectedly. Please try again.',
    details: { 
      component: 'Processing', 
      originalError: errorMessage,
      suggestion: 'Check the logs for more details and try again'
    },
    recoverable: true
  };
};

// Pre-processing validation with automatic checks
const validateProcessingPrerequisites = async (): Promise<{ isValid: boolean; errors: ProcessingErrorType[] }> => {
  const errors: ProcessingErrorType[] = [];
  
  try {
    // Validate FFmpeg availability
    const ffmpegValidation = await (window as unknown as ElectronWindow).electron.ipcRenderer.invoke('processing:validateFFmpeg') as {
      success: boolean;
      isValid: boolean;
    };
    if (!ffmpegValidation.success || !ffmpegValidation.isValid) {
      errors.push({
        code: 'SETUP_ERROR',
        message: 'FFmpeg is not available',
        details: { 
          component: 'FFmpeg',
          suggestion: 'Install FFmpeg and restart the application' 
        },
        recoverable: true
      });
    }
    
    // Additional validations can be added here
    // - Engine availability
    // - Required API keys
    // - Input file accessibility
    
  } catch (error) {
    errors.push({
      code: 'IPC_ERROR',
      message: 'Failed to validate prerequisites',
      details: { 
        component: 'Validation',
        originalError: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check system connectivity and try again'
      },
      recoverable: true
    });
  }
  
  return { isValid: errors.length === 0, errors };
};

// Automatic recovery mechanisms for specific error types
const attemptAutomaticRecovery = async (error: ProcessingErrorType): Promise<{ recovered: boolean; newError?: ProcessingErrorType }> => {
  console.log(`🔄 Attempting automatic recovery for error: ${error.code}`);
  
  switch (error.code) {
    case 'SETUP_ERROR':
      if (error.details?.component === 'FFmpeg') {
        // Try to re-detect FFmpeg after a brief delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        const validation = await validateProcessingPrerequisites();
        if (validation.isValid) {
          console.log('✅ FFmpeg recovery successful');
          return { recovered: true };
        }
      }
      break;
      
    case 'IPC_ERROR':
      // Try to reconnect or reinitialize IPC
      console.log('🔄 Attempting IPC recovery...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { recovered: false }; // For now, manual intervention required
      
    case 'ENGINE_NOT_FOUND':
      // Try to restart engine connection
      console.log('🔄 Attempting engine recovery...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return { recovered: false }; // Would need engine restart capability
      
    default:
      console.log(`⚠️ No automatic recovery available for error: ${error.code}`);
      return { recovered: false };
  }
  
  return { recovered: false };
};

// Enhanced error state management with automatic recovery and fallbacks
const handleProcessingError = async (
  error: ProcessingErrorType,
  setError: (error: string) => void,
  workflowActions: {
    setStepState: (step: StepType, state: StepStatusType) => Promise<void>;
  },
  updateStepContent: <T>(step: StepType, content: Partial<T>, workspaceId?: string) => Promise<void>,
  localLogs: string[],
  retryCount: number = 0
) => {
  console.error(`💥 Processing Error [${error.code}]:`, error.message);
  console.error('💥 Error details:', error.details);
  
  // Attempt automatic recovery for recoverable errors (max 2 retries)
  if (error.recoverable && retryCount < 2) {
    console.log(`🔄 Attempting recovery (attempt ${retryCount + 1}/2)...`);
    
    const recoveryLogs = [...localLogs, `Error [${error.code}]: ${error.message}`, `Attempting automatic recovery (${retryCount + 1}/2)...`];
    
    // Update state to show recovery attempt
    updateStepContent('processing', {
      status: 'running',
      logs: recoveryLogs,
      errorCode: error.code,
      errorDetails: error.details,
      recoveryAttempt: retryCount + 1
    });
    
    const recovery = await attemptAutomaticRecovery(error);
    
    if (recovery.recovered) {
      const successLogs = [...recoveryLogs, `✅ Automatic recovery successful`];
      updateStepContent('processing', {
        status: 'idle',
        logs: successLogs,
        errorCode: null,
        errorDetails: null,
        recoveryAttempt: null
      });
      console.log('✅ Automatic recovery successful');
      return; // Exit without setting error state
    } else {
      const failedLogs = [...recoveryLogs, `❌ Automatic recovery failed`];
      updateStepContent('processing', {
        logs: failedLogs
      });
    }
  }
  
  // If recovery failed or not attempted, set error state
  const errorLogs = [
    ...localLogs,
    `Error [${error.code}]: ${error.message}`,
    ...(error.details?.suggestion ? [`Suggestion: ${error.details.suggestion}`] : []),
    ...(retryCount > 0 ? [`Recovery attempts failed (${retryCount}/2)`] : [])
  ];
  
  updateStepContent('processing', {
    status: 'error',
    endTime: new Date().toISOString(),
    logs: errorLogs,
    errorCode: error.code,
    errorDetails: error.details,
    recoverable: error.recoverable,
    retryCount
  });
  
  // Set workflow state to error with enhanced context
  const errorContext = error.recoverable ? ' (Try again or check suggestions)' : ' (Manual intervention required)';
  setError(`${error.message}${errorContext}`);
  workflowActions.setStepState('processing', 'error' as StepStatusType);
  
  // Log recovery suggestions
  if (error.recoverable && error.details?.suggestion) {
    console.log(`💡 Recovery suggestion: ${error.details.suggestion}`);
  }
};

export const ProcessingStep: React.FC = () => {
  const processing = useProcessingStepContent();
  const { updateStepContent, setError, clearError } = useStepActions();
  const workflowActions = useWorkflowActions();
  const isLoading = useStepLoading();
  const error = useStepError();
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  
  // Add missing state variables
  const [retryCount, setRetryCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [localLogs] = useState<string[]>([]);
  const [localPhase] = useState<string>('');

  // Set up IPC event listeners for real-time processing updates
  useProcessingEvents();


  // Handle errors
  useEffect(() => {
    if (error) {
      setShowErrorNotification(true)
    }
  }, [error])

  // Calculate time elapsed for display
  const timeElapsed = processing.startTime && processing.endTime 
    ? Math.floor((new Date(processing.endTime).getTime() - new Date(processing.startTime).getTime()) / 1000)
    : processing.timeElapsed || 0;

  // Note: Workflow state transitions are now handled directly in the processing event handlers
  // This ensures immediate response to completion/error events rather than waiting for store updates

  // Reset retry count when processing status changes to success states or when restarting
  useEffect(() => {
    if (processing.status === 'running' || processing.status === 'completed') {
      console.log('🔄 Resetting retry count due to successful processing state');
      setRetryCount(0);
      setIsRecovering(false);
    }
  }, [processing.status]);

  // Real-time timer that updates elapsed time every second
  useEffect(() => {
    if (processing.status !== 'running' || !processing.startTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - new Date(processing.startTime!).getTime()) / 1000);
      updateStepContent('processing', { timeElapsed: elapsed });
    }, 1000);

    return () => clearInterval(interval);
  }, [processing.status, processing.startTime, updateStepContent]);

  // Show loading state while workspace is initializing
  if (isLoading) {
    return (
      <Box sx={{ 
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <LinearProgress sx={{ width: '100%', maxWidth: 400, mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Loading processing configuration...
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <ProcessingErrorBoundary
        enableEngineRecovery={true}
        enableIpcMonitoring={true}
        processingStep={processing.status}
        onEngineError={(error, errorInfo) => {
          console.error('Engine error in ProcessingStep:', error, errorInfo)
          
          // Categorize and handle engine error with enhanced system
          const categorizedError = categorizeProcessingError(error.message);
          
          // Add engine-specific context
          const engineError = {
            ...categorizedError,
            details: {
              ...categorizedError.details,
              errorInfo,
              component: 'Engine',
              type: 'Engine Error Boundary',
              timeElapsed: processing.startTime 
                ? Math.floor((Date.now() - new Date(processing.startTime).getTime()) / 1000)
                : timeElapsed
            }
          };
          
          // Set recovery state
          setIsRecovering(true);
          
          // Use enhanced error handler with retry count
          handleProcessingError(engineError, setError, workflowActions, updateStepContent, localLogs, retryCount)
            .then(() => {
              setIsRecovering(false);
              if (engineError.recoverable && retryCount < 2) {
                setRetryCount(prev => prev + 1);
              }
            })
            .catch(recoveryError => {
              console.error('Error during engine recovery attempt:', recoveryError);
              setIsRecovering(false);
            });
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            height: "100%",
            p: 3,
          }}
        >
          {/* Configuration Error State */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={() => clearError()}
            >
              Configuration error: {error}
            </Alert>
          )}
        {/* Progress Header - Hidden in idle state and error state */}
        {processing.status !== "idle" && processing.status !== "error" && (
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography
              variant="h4"
              sx={{ mb: 3, fontWeight: 600, color: "#FFFFFF" }}
            >
              {processing.status === "completed"
                ? "Processing Complete!"
                : "Generating Subtitles"}
            </Typography>

            <Box sx={{ maxWidth: 600, mx: "auto" }}>
              {/* Enhanced Progress Container */}
              <Box
                sx={{
                  p: 3,
                  backgroundColor: "rgba(47, 49, 54, 0.6)",
                  borderRadius: 3,
                  border: "1px solid rgba(64, 68, 75, 0.3)",
                  backdropFilter: "blur(10px)",
                }}
              >
                {/* Stage Indicator */}
                {processing.status === "running" && (localPhase || processing.currentPhase) && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1.5,
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: isRecovering ? "#EF4444" : "#F59E0B",
                        animation:
                          "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                      }}
                    />
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        color: isRecovering ? "#EF4444" : "#F59E0B",
                        textTransform: "capitalize",
                      }}
                    >
                      {isRecovering ? "Recovering..." : (localPhase || processing.currentPhase || "Processing...")}
                    </Typography>
                    {retryCount > 0 && !isRecovering && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#EAB308",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                        }}
                      >
                        (Retry {retryCount}/2)
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Enhanced Progress Bar */}
                <LinearProgress
                  variant="determinate"
                  value={processing.progress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    mb: 2,
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 4,
                      background:
                        processing.status === "completed"
                          ? "linear-gradient(90deg, #57F287 0%, #22C55E 50%, #16A34A 100%)"
                          : "linear-gradient(90deg, #F59E0B 0%, #EAB308 50%, #D97706 100%)",
                      boxShadow:
                        processing.status === "completed"
                          ? "0 0 12px rgba(87, 242, 135, 0.4)"
                          : "0 0 12px rgba(245, 158, 11, 0.4)",
                    },
                  }}
                />

                {/* Progress Value */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      fontFamily: "monospace",
                      color:
                        processing.status === "completed" ? "#57F287" : "#F59E0B",
                    }}
                  >
                    {processing.progress}%
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      ml: 1,
                      color: "text.secondary",
                      fontWeight: 500,
                    }}
                  >
                    Complete
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Main Content Area - Stacked Layout */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            maxWidth: processing.status === "completed" || processing.status === "error" ? 900 : 600,
            mx: "auto",
            width: "100%",
          }}
        >
          {processing.status === "completed" ? (
            <ProcessingComplete />
          ) : processing.status === "idle" ? (
            <IdleState />
          ) : processing.status === "error" ? (
            <ProcessingError />
          ) : (
            <>
              <ProcessingStatus />
              <ProcessingControls />
            </>
          )}
        </Box>

      </Box>
    </ProcessingErrorBoundary>


    {/* Error Notification */}
    <Snackbar
      open={showErrorNotification}
      autoHideDuration={6000}
      onClose={() => {
        setShowErrorNotification(false)
        clearError()
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={() => {
          setShowErrorNotification(false)
          clearError()
        }} 
        severity="error"
        variant="filled"
      >
        {error || 'Failed to save processing state'}
      </Alert>
    </Snackbar>
  </>
  );
};