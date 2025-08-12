import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Snackbar} from "@mui/material";
import { 
  useProcessingStepContent,
  useConfigStepContent,
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
import { ErrorDisplay } from "./ProcessingStep/ErrorDisplay";
import { getStageInfo } from "./ProcessingStep/utils";

export const ProcessingStep: React.FC = () => {
  const processing = useProcessingStepContent();
  const config = useConfigStepContent();
  const { updateStepContent, setError, clearError } = useStepActions();
  const workflowActions = useWorkflowActions();
  const isLoading = useStepLoading();
  const error = useStepError();
  const [showErrorNotification, setShowErrorNotification] = useState(false);


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

  // Complete the processing step when processing finishes successfully
  useEffect(() => {
    if (processing.status === 'completed') {
      workflowActions.setStepState('processing', 'complete');
    }
  }, [processing.status, workflowActions]);

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
          // Update processing state to show error while preserving existing values
          updateStepContent('processing', { 
            status: 'error',
            endTime: new Date().toISOString(),
            // Calculate final time elapsed if we have a start time
            timeElapsed: processing.startTime 
              ? Math.floor((Date.now() - new Date(processing.startTime).getTime()) / 1000)
              : timeElapsed
          });
          setError(error.message);
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
                {processing.status === "running" && processing.currentPhase && (
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
                        bgcolor: "#F59E0B",
                        animation:
                          "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                      }}
                    />
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        color: "#F59E0B",
                        textTransform: "capitalize",
                      }}
                    >
                      {processing.currentPhase}
                    </Typography>
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

        {/* Legacy Error Display - Only show if no main error state */}
        {processing.status !== "error" && error && <ErrorDisplay error={error} />}
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