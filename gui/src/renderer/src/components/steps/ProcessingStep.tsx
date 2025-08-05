import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Snackbar} from "@mui/material";
import { useAppStore } from "../../stores/app-store";
import { workflowStateManager } from "../../services/workflow/workflow-state-manager";
import { StepState } from "../../types/workflow-state";
import { useProcessingStepConfig, useWorkspaceConfig } from '../../contexts/WorkspaceConfigContext';
import { ProcessingErrorBoundary } from "../common/ProcessingErrorBoundary";
import { IdleState } from "./ProcessingStep/IdleState";
import { ProcessingControls } from "./ProcessingStep/ProcessingControls";
import { ProcessingStatus } from "./ProcessingStep/ProcessingStatus";
import { ProcessingComplete } from "./ProcessingStep/ProcessingComplete";
import { ProcessingError } from "./ProcessingStep/ProcessingError";
import { ErrorDisplay } from "./ProcessingStep/ErrorDisplay";
import { getStageInfo } from "./ProcessingStep/utils";

export const ProcessingStep: React.FC = () => {
  const { processing, updateProcessing } = useAppStore();
  // Modern workflow state management with WorkflowStateManager
  const [config, updateConfig, { isLoading, error, isReady }] = useProcessingStepConfig()
  const { lastError, clearError } = useWorkspaceConfig()
  const [showErrorNotification, setShowErrorNotification] = useState(false)


  // Handle errors
  useEffect(() => {
    if (lastError || error) {
      setShowErrorNotification(true)
    }
  }, [lastError, error])

  // Save processing state changes to workspace
  useEffect(() => {
    if (isReady && processing) {
      updateConfig({
        processingState: {
          stage: processing.stage,
          progress: processing.progress,
          timeElapsed: processing.timeElapsed,
          isActive: processing.isActive,
          startTime: processing.startTime,
          error: processing.error
        },
        lastModified: Date.now()
      }).catch(error => {
        console.error('Failed to save processing state:', error)
      })
    }
  }, [processing, updateConfig, isReady])

  // Complete the processing step when processing finishes successfully
  useEffect(() => {
    if (processing.stage === 'completed' && !processing.error) {
      workflowStateManager.transitionState('processing', StepState.Complete, {
        reason: 'Processing completed successfully'
      });
    }
  }, [processing.stage, processing.error]);

  // Real-time timer that updates elapsed time every second
  useEffect(() => {
    if (!processing.isActive || !processing.startTime || processing.stage === 'error') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - processing.startTime!) / 1000);
      updateProcessing({ timeElapsed: elapsed });
    }, 1000);

    return () => clearInterval(interval);
  }, [processing.isActive, processing.startTime, processing.stage, updateProcessing]);

  // Show loading state while workspace is initializing
  if (!isReady) {
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
        processingStep={processing.stage}
        onEngineError={(error, errorInfo) => {
          console.error('Engine error in ProcessingStep:', error, errorInfo)
          // Update processing state to show error while preserving existing values
          updateProcessing({ 
            ...processing, // Preserve all existing values
            stage: 'error', 
            error: error.message,
            isActive: false,
            // Calculate final time elapsed if we have a start time
            timeElapsed: processing.startTime 
              ? Math.floor((Date.now() - processing.startTime) / 1000)
              : processing.timeElapsed
          })
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
          {/* Configuration Loading State */}
          {isLoading && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Loading processing configuration...
            </Alert>
          )}

          {/* Configuration Error State */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={() => clearError()}
            >
              Failed to load configuration: {error.message}
            </Alert>
          )}
        {/* Progress Header - Hidden in idle state and error state */}
        {processing.stage !== "idle" && processing.stage !== "error" && (
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography
              variant="h4"
              sx={{ mb: 3, fontWeight: 600, color: "#FFFFFF" }}
            >
              {processing.stage === "completed"
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
                {(processing.stage === "preparing" ||
                  processing.stage === "transcribing" ||
                  processing.stage === "refining" ||
                  processing.stage === "cancelled") && (
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
                      {getStageInfo(processing.stage).name}
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
                        processing.stage === "completed"
                          ? "linear-gradient(90deg, #57F287 0%, #22C55E 50%, #16A34A 100%)"
                          : "linear-gradient(90deg, #F59E0B 0%, #EAB308 50%, #D97706 100%)",
                      boxShadow:
                        processing.stage === "completed"
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
                        processing.stage === "completed" ? "#57F287" : "#F59E0B",
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
            maxWidth: processing.stage === "completed" || (processing.stage === "error" && processing.error) ? 900 : 600,
            mx: "auto",
            width: "100%",
          }}
        >
          {processing.stage === "completed" ? (
            <ProcessingComplete />
          ) : processing.stage === "idle" ? (
            <IdleState />
          ) : processing.stage === "error" && processing.error ? (
            <ProcessingError error={processing.error} />
          ) : (
            <>
              <ProcessingStatus />
              <ProcessingControls />
            </>
          )}
        </Box>

        {/* Legacy Error Display - Only show if no main error state */}
        {processing.stage !== "error" && <ErrorDisplay error={processing.error} />}
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
        {lastError?.message || error?.message || 'Failed to save processing state'}
      </Alert>
    </Snackbar>
  </>
  );
};