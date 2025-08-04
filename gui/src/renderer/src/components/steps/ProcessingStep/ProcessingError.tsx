import React, { useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Fade,
} from "@mui/material";
import {
  Error as ErrorIcon,
  RestartAlt as RestartIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Engineering as EngineIcon,
  Terminal as ConsoleIcon,
  PowerSettingsNew as PowerIcon,
} from "@mui/icons-material";
import { useAppStore } from "../../../stores/app-store";
import { workflowStateManager } from "../../../services/workflow-state-manager";
import { ErrorCategory } from "../../../types/error";
import { errorHandler } from "../../../utils/errorHandler";
import { ErrorCard, InfoSection } from "./styles";

interface ProcessingErrorProps {
  error: string | null;
}

export const ProcessingError: React.FC<ProcessingErrorProps> = ({ error }) => {
  const { processing, resetProcessing } = useAppStore();
  // Modern workflow navigation using WorkflowStateManager
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  // Debug logging to understand processing state
  console.log('ProcessingError - Current processing state:', {
    stage: processing.stage,
    currentStep: processing.currentStep,
    totalSteps: processing.totalSteps,
    progress: processing.progress,
    timeElapsed: processing.timeElapsed,
    startTime: processing.startTime,
    engineStage: processing.engineStage,
    substage: processing.substage,
    message: processing.message
  });

  // Helper functions to check if values are meaningful
  const hasValidEngineStage = () => {
    const stage = processing.engineStage || processing.substage;
    return stage && stage !== 'Error' && stage.toLowerCase() !== 'n/a';
  };

  const hasValidCurrentStep = () => {
    if (processing.currentStep && processing.totalSteps) return true;
    if (processing.currentStep) return true;
    if (processing.substage && processing.substage !== 'Error') return true;
    if (processing.engineStage && processing.engineStage !== 'Error') return true;
    return false;
  };

  const hasValidMessage = () => {
    const msg = processing.message || lastActivity?.message;
    return msg && msg.toLowerCase() !== 'n/a' && !msg.startsWith('Error: ');
  };

  const hasValidProgress = () => {
    return processing.progress && processing.progress > 0;
  };

  const hasValidTimeElapsed = () => {
    if (processing.timeElapsed && processing.timeElapsed > 0) return true;
    if (processing.startTime) return true;
    return false;
  };

  const getFormattedCurrentStep = () => {
    if (processing.currentStep && processing.totalSteps) {
      return `${processing.currentStep} / ${processing.totalSteps}`;
    } else if (processing.currentStep) {
      return `${processing.currentStep}`;
    } else if (processing.substage && processing.substage !== 'Error') {
      return processing.substage;
    } else if (processing.engineStage && processing.engineStage !== 'Error') {
      return processing.engineStage;
    }
    return null;
  };

  const getFormattedTimeElapsed = () => {
    if (processing.timeElapsed && processing.timeElapsed > 0) {
      return `${Math.floor(processing.timeElapsed / 1000)}s`;
    } else if (processing.startTime) {
      return `${Math.floor((Date.now() - processing.startTime) / 1000)}s`;
    }
    return null;
  };

  // Use debug messages from app store instead of capturing separately
  const debugMessages = processing.debugMessages || [];

  // Get recent messages (last 20 for better context)
  const recentMessages = debugMessages.slice(-20);

  // Get error messages specifically
  const errorMessages = debugMessages.filter((msg) => msg.level === "error");

  // Get the last activity (most recent message)
  const lastActivity =
    recentMessages.length > 0
      ? recentMessages[recentMessages.length - 1]
      : null;

  // Get the most recent error for detailed display
  const primaryError =
    errorMessages.length > 0 ? errorMessages[errorMessages.length - 1] : null;

  if (!error && errorMessages.length === 0) return null;

  // Determine error type and severity based on debug messages
  const getErrorCategory = (errorMsg: string): ErrorCategory => {
    const msg = errorMsg.toLowerCase();

    // Check for specific error types in debug messages
    if (
      msg.includes("exit_error") ||
      (msg.includes("exit") && msg.includes("code"))
    ) {
      return ErrorCategory.ENGINE_EXIT;
    }
    if (msg.includes("startup_error")) {
      return ErrorCategory.ENGINE_STARTUP;
    }
    if (msg.includes("runtime_error")) {
      return ErrorCategory.ENGINE_RUNTIME;
    }
    if (msg.includes("spawn_error")) {
      return ErrorCategory.ENGINE_SPAWN;
    }
    if (msg.includes("setup_error")) {
      return ErrorCategory.ENGINE_SETUP;
    }
    if (msg.includes("process_error")) {
      return ErrorCategory.ENGINE_IPC;
    }
    if (msg.includes("python") || msg.includes("cantocap")) {
      return ErrorCategory.ENGINE_RUNTIME;
    }
    return ErrorCategory.PROCESSING;
  };

  // Get error category and message
  const errorMessage =
    error || primaryError?.message || "Unknown processing error";
  const errorCategory = getErrorCategory(errorMessage);

  // Get engine-specific color scheme - Updated to match current design
  const getEngineColorScheme = (category: ErrorCategory) => {
    const engineColors: Record<
      ErrorCategory,
      { primary: string; secondary: string; accent: string }
    > = {
      [ErrorCategory.ENGINE_IPC]: {
        primary: "#7C3AED",
        secondary: "#A855F7",
        accent: "#C4B5FD",
      }, // Purple - IPC
      [ErrorCategory.ENGINE_STARTUP]: {
        primary: "#ED4245",
        secondary: "#EF4444",
        accent: "#FCA5A5",
      }, // Discord Red - Critical
      [ErrorCategory.ENGINE_RUNTIME]: {
        primary: "#F59E0B",
        secondary: "#EAB308",
        accent: "#FCD34D",
      }, // Primary Amber - Runtime
      [ErrorCategory.ENGINE_EXIT]: {
        primary: "#ED4245",
        secondary: "#DC2626",
        accent: "#F87171",
      }, // Discord Red - Exit
      [ErrorCategory.ENGINE_SPAWN]: {
        primary: "#EA580C",
        secondary: "#F97316",
        accent: "#FDBA74",
      }, // Orange - Spawn
      [ErrorCategory.ENGINE_SETUP]: {
        primary: "#7DD3FC",
        secondary: "#3B82F6",
        accent: "#93C5FD",
      }, // Light Blue - Setup
      [ErrorCategory.PROCESSING]: {
        primary: "#F59E0B",
        secondary: "#EAB308",
        accent: "#FCD34D",
      }, // Primary Amber
      [ErrorCategory.RUNTIME]: {
        primary: "#F59E0B",
        secondary: "#EAB308",
        accent: "#FCD34D",
      }, // Primary Amber
      [ErrorCategory.NETWORK]: {
        primary: "#EF4444",
        secondary: "#DC2626",
        accent: "#F87171",
      }, // Red
      [ErrorCategory.FILE_SYSTEM]: {
        primary: "#8B5CF6",
        secondary: "#7C3AED",
        accent: "#C4B5FD",
      }, // Purple
      [ErrorCategory.VALIDATION]: {
        primary: "#F59E0B",
        secondary: "#EAB308",
        accent: "#FCD34D",
      }, // Amber
      [ErrorCategory.UNKNOWN]: {
        primary: "#96989D",
        secondary: "#9CA3AF",
        accent: "#D1D5DB",
      }, // Gray
    };
    return (
      engineColors[category] || {
        primary: "#96989D",
        secondary: "#9CA3AF",
        accent: "#D1D5DB",
      }
    );
  };

  const colors = getEngineColorScheme(errorCategory);

  // Get error icon based on category
  const getErrorIcon = (category: ErrorCategory) => {
    const iconProps = { sx: { fontSize: "3rem", color: colors.primary } };
    switch (category) {
      case ErrorCategory.ENGINE_STARTUP:
      case ErrorCategory.ENGINE_SPAWN:
        return <PowerIcon {...iconProps} />;
      case ErrorCategory.ENGINE_RUNTIME:
      case ErrorCategory.ENGINE_EXIT:
        return <EngineIcon {...iconProps} />;
      case ErrorCategory.ENGINE_IPC:
        return <ConsoleIcon {...iconProps} />;
      case ErrorCategory.ENGINE_SETUP:
        return <SettingsIcon {...iconProps} />;
      default:
        return <ErrorIcon {...iconProps} />;
    }
  };

  // Get error explanation
  const errorExplanation = errorHandler.getErrorExplanation(
    new Error(errorMessage),
    errorCategory
  );

  // Recovery actions
  const handleRetry = () => {
    setRecoveryAttempts((prev) => prev + 1);
    resetProcessing();
    setTimeout(() => {
      workflowStateManager.setCurrentStep("config");
    }, 500);
  };

  const handleRestart = () => {
    setRecoveryAttempts((prev) => prev + 1);
    window.location.reload();
  };

  const handleEngineSetup = async () => {
    try {
      setRecoveryAttempts((prev) => prev + 1);
      if (window.cantocapAPI?.runEngineSetup) {
        await window.cantocapAPI.runEngineSetup();
        resetProcessing();
        workflowStateManager.setCurrentStep("config");
      }
    } catch (setupError) {
      console.error("Engine setup failed:", setupError);
    }
  };

  const handleCopyError = () => {
    const errorData = {
      error: errorMessage,
      category: errorCategory,
      processingStage: processing.stage,
      timestamp: new Date().toISOString(),
      recoveryAttempts,
      errorMessages: errorMessages,
      recentMessages: recentMessages,
      lastActivity: lastActivity,
      processingInfo: {
        stage: processing.stage,
        engineStage: processing.engineStage,
        substage: processing.substage,
        currentStep: processing.currentStep,
        totalSteps: processing.totalSteps,
        progress: processing.progress,
        timeElapsed: processing.timeElapsed,
        message: processing.message,
      },
    };

    navigator.clipboard
      .writeText(JSON.stringify(errorData, null, 2))
      .then(() => console.log("Error data copied to clipboard"))
      .catch((err) => console.error("Failed to copy error data:", err));
  };

  const handleDownloadError = () => {
    const errorData = {
      error: errorMessage,
      category: errorCategory,
      processingStage: processing.stage,
      timestamp: new Date().toISOString(),
      recoveryAttempts,
      errorMessages: errorMessages,
      recentMessages: recentMessages,
      lastActivity: lastActivity,
      processingInfo: {
        stage: processing.stage,
        engineStage: processing.engineStage,
        substage: processing.substage,
        currentStep: processing.currentStep,
        totalSteps: processing.totalSteps,
        progress: processing.progress,
        timeElapsed: processing.timeElapsed,
        message: processing.message,
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        platform:
          navigator.platform,
        language: navigator.language,
        online: navigator.onLine,
        memory: (navigator as any).deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
      },
    };

    const blob = new Blob([JSON.stringify(errorData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cantocap-engine-error-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ErrorCard>
      <Fade in timeout={500}>
        <Box sx={{ flex: 1 }}>
          {/* Error Header */}
          <Box
            sx={{
              p: 4,
              background: `linear-gradient(135deg, ${colors.primary}15 0%, ${colors.primary}05 100%)`,
              borderBottom: `1px solid ${colors.primary}30`,
              textAlign: "center",
            }}
          >
            <Stack alignItems="center" spacing={2}>
              {getErrorIcon(errorCategory)}

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: colors.primary,
                  mb: 1,
                }}
              >
                {errorExplanation.title}
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  label={errorCategory.replace("_", " ").toUpperCase()}
                  size="small"
                  sx={{
                    backgroundColor: `${colors.primary}20`,
                    color: colors.primary,
                    fontWeight: 600,
                    border: `1px solid ${colors.primary}40`,
                  }}
                />
                {primaryError?.message.includes("Exit Code:") && (
                  <Chip
                    label={
                      primaryError.message.match(/Exit Code: (\d+)/)?.[0] ||
                      "Exit Code: Unknown"
                    }
                    size="small"
                    sx={{
                      backgroundColor: "rgba(239, 68, 68, 0.2)",
                      color: "#EF4444",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  />
                )}
                {recoveryAttempts > 0 && (
                  <Chip
                    label={`Attempts: ${recoveryAttempts}`}
                    size="small"
                    sx={{
                      backgroundColor: "rgba(156, 163, 175, 0.2)",
                      color: "#9CA3AF",
                      fontWeight: 600,
                    }}
                  />
                )}
                <Chip
                  label={`${errorMessages.length} Error${
                    errorMessages.length !== 1 ? "s" : ""
                  }`}
                  size="small"
                  sx={{
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    color: "#EF4444",
                    fontWeight: 600,
                  }}
                />
              </Stack>

              <Typography
                variant="body1"
                sx={{
                  color: "text.secondary",
                  maxWidth: 600,
                  lineHeight: 1.6,
                }}
              >
                {errorExplanation.description}
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ p: 4 }}>
            {/* Error Message */}
            <Alert
              severity="error"
              sx={{
                mb: 3,
                backgroundColor: `${colors.primary}10`,
                border: `1px solid ${colors.primary}30`,
                "& .MuiAlert-icon": { color: colors.primary },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Error Details:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: "monospace",
                  wordBreak: "break-word",
                  backgroundColor: "rgba(0, 0, 0, 0.1)",
                  p: 1,
                  borderRadius: 1,
                }}
              >
                {errorMessage}
              </Typography>
            </Alert>

            {/* Additional Error Messages - Show only the last one if multiple exist */}
            {errorMessages.length > 1 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, color: "text.primary" }}>
                  Additional Engine Error
                </Typography>
                {(() => {
                  // Get the second to last error (most recent additional error)
                  const additionalError = errorMessages[errorMessages.length - 2];
                  return (
                    <Alert
                      severity="warning"
                      sx={{
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        mb: 2,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {additionalError.stage.toUpperCase()} -{" "}
                        {new Date(additionalError.timestamp).toLocaleTimeString()}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                        }}
                      >
                        {additionalError.message}
                      </Typography>
                      {additionalError.source && (
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", opacity: 0.7 }}
                        >
                          Source: {additionalError.source}
                        </Typography>
                      )}
                    </Alert>
                  );
                })()}
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontStyle: "italic",
                    textAlign: "center",
                  }}
                >
                  {errorMessages.length - 1} total error{errorMessages.length - 1 !== 1 ? "s" : ""} recorded.{" "}
                  <strong>See Technical Details below for complete error history.</strong>
                </Typography>
              </Box>
            )}

            {/* Possible Causes */}
            <InfoSection>
              <Typography
                variant="h6"
                sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
              >
                🔍 Possible Causes
              </Typography>
              <Stack spacing={1}>
                {errorExplanation.possibleCauses.map((cause, index) => (
                  <Box
                    key={index}
                    sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
                  >
                    <Typography variant="body2" sx={{ color: colors.primary }}>
                      •
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {cause}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </InfoSection>

            {/* Suggested Actions */}
            <InfoSection>
              <Typography
                variant="h6"
                sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
              >
                💡 Suggested Actions
              </Typography>
              <Stack spacing={1}>
                {errorExplanation.suggestedActions.map((action, index) => (
                  <Box
                    key={index}
                    sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
                  >
                    <Typography variant="body2" sx={{ color: "#F59E0B" }}>
                      •
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      {action}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </InfoSection>

            {/* Recovery Actions */}
            <InfoSection>
              <Typography
                variant="h6"
                sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}
              >
                🔧 Recovery Options
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<RestartIcon />}
                  onClick={handleRetry}
                  sx={{
                    py: 1.5,
                    px: 3,
                    borderRadius: 3,
                    fontWeight: 600,
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                    color: "#FFFFFF",
                    "&:hover": {
                      background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.accent} 100%)`,
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  Try Again
                </Button>

                {(errorCategory === ErrorCategory.ENGINE_STARTUP ||
                  errorCategory === ErrorCategory.ENGINE_SETUP ||
                  errorCategory === ErrorCategory.ENGINE_SPAWN) && (
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={handleEngineSetup}
                    sx={{
                      py: 1.5,
                      px: 3,
                      borderRadius: 3,
                      fontWeight: 600,
                      borderColor: colors.primary,
                      color: colors.primary,
                      "&:hover": {
                        backgroundColor: `${colors.primary}10`,
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    Run Engine Setup
                  </Button>
                )}

                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRestart}
                  sx={{
                    py: 1.5,
                    px: 3,
                    borderRadius: 3,
                    fontWeight: 600,
                    borderColor: "#6B7280",
                    color: "#6B7280",
                    "&:hover": {
                      backgroundColor: "rgba(107, 114, 128, 0.1)",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  Restart App
                </Button>
              </Stack>
            </InfoSection>

            {/* Technical Details */}
            <Accordion
              expanded={showTechnicalDetails}
              onChange={() => setShowTechnicalDetails(!showTechnicalDetails)}
              sx={{
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 2,
                color: "text.primary",
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant="h6"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  🔬 Technical Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  {/* Error Information */}
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 2,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ color: "text.secondary" }}
                      >
                        Error Information
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Copy to clipboard">
                          <IconButton
                            size="small"
                            onClick={handleCopyError}
                            sx={{ color: "text.secondary" }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download error report">
                          <IconButton
                            size="small"
                            onClick={handleDownloadError}
                            sx={{ color: "text.secondary" }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        borderRadius: 2,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <Stack spacing={1}>
                        {/* Always show category and processing stage */}
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong>Category:</strong> {errorCategory}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong>Processing Stage:</strong> {processing.stage}
                        </Typography>

                        {/* Only show engine stage if meaningful */}
                        {hasValidEngineStage() && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Engine Stage:</strong>{" "}
                            {processing.engineStage || processing.substage}
                          </Typography>
                        )}

                        {/* Only show current step if meaningful */}
                        {hasValidCurrentStep() && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Current Step:</strong> {getFormattedCurrentStep()}
                          </Typography>
                        )}

                        {/* Only show last message if meaningful */}
                        {hasValidMessage() && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Last Message:</strong>{" "}
                            {processing.message || lastActivity?.message}
                          </Typography>
                        )}

                        {/* Only show progress if > 0 */}
                        {hasValidProgress() && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Progress:</strong> {Math.round(processing.progress)}%
                          </Typography>
                        )}

                        {/* Only show time elapsed if meaningful */}
                        {hasValidTimeElapsed() && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Time Elapsed:</strong> {getFormattedTimeElapsed()}
                          </Typography>
                        )}

                        {/* Only show recovery attempts if > 0 */}
                        {recoveryAttempts > 0 && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Recovery Attempts:</strong> {recoveryAttempts}
                          </Typography>
                        )}

                        {/* Always show error count if > 0 */}
                        {errorMessages.length > 0 && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Error Count:</strong> {errorMessages.length}
                          </Typography>
                        )}

                        {/* Only show exit code if available */}
                        {primaryError?.message.includes("Exit Code:") && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Exit Code:</strong>{" "}
                            {primaryError.message.match(
                              /Exit Code: (\d+)/
                            )?.[1] || "Unknown"}
                          </Typography>
                        )}

                        {/* Always show error timestamp */}
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong>Error Timestamp:</strong>{" "}
                          {new Date().toISOString()}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>

                  {/* Detailed Error Message */}
                  {error && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 2, color: "text.secondary" }}
                      >
                        Detailed Error Message
                      </Typography>
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "rgba(255, 107, 107, 0.1)",
                          borderRadius: 2,
                          border: "1px solid rgba(255, 107, 107, 0.3)",
                          maxHeight: 150,
                          overflow: "auto",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            color: "#FF6B6B",
                            wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {error}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Recent Debug Messages */}
                  {recentMessages.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 2, color: "text.secondary" }}
                      >
                        Recent Debug Messages (Last {recentMessages.length})
                      </Typography>
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "rgba(0, 0, 0, 0.3)",
                          borderRadius: 2,
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          maxHeight: 200,
                          overflow: "auto",
                        }}
                      >
                        <Stack spacing={0.5}>
                          {recentMessages.map((msg) => (
                            <Typography
                              key={msg.id}
                              variant="body2"
                              sx={{
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                                color:
                                  msg.level === "error"
                                    ? "#FF6B6B"
                                    : msg.level === "warning"
                                    ? "#F59E0B"
                                    : "#96989D",
                                wordBreak: "break-word",
                              }}
                            >
                              <span
                                style={{ color: "#7DD3FC", fontSize: "0.7rem" }}
                              >
                                [{new Date(msg.timestamp).toLocaleTimeString()}]
                              </span>{" "}
                              <span
                                style={{ color: "#A855F7", fontSize: "0.7rem" }}
                              >
                                [{msg.stage}]
                              </span>{" "}
                              {msg.source && (
                                <span
                                  style={{
                                    color: "#22C55E",
                                    fontSize: "0.7rem",
                                  }}
                                >
                                  [{msg.source}]
                                </span>
                              )}{" "}
                              {msg.message}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  )}

                  {/* Error-Specific Messages */}
                  {errorMessages.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 2, color: "text.secondary" }}
                      >
                        Error Messages ({errorMessages.length})
                      </Typography>
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "rgba(255, 107, 107, 0.1)",
                          borderRadius: 2,
                          border: "1px solid rgba(255, 107, 107, 0.3)",
                          maxHeight: 200,
                          overflow: "auto",
                        }}
                      >
                        <Stack spacing={1}>
                          {errorMessages.map((errorMsg) => (
                            <Box key={errorMsg.id}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                  color: "#FF6B6B",
                                  fontWeight: 600,
                                }}
                              >
                                [
                                {new Date(
                                  errorMsg.timestamp
                                ).toLocaleTimeString()}
                                ] {errorMsg.stage.toUpperCase()}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: "monospace",
                                  fontSize: "0.75rem",
                                  color: "#FF9999",
                                  ml: 1,
                                  wordBreak: "break-word",
                                }}
                              >
                                {errorMsg.message}
                              </Typography>
                              {errorMsg.source && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.7rem",
                                    color: "#96989D",
                                    ml: 1,
                                  }}
                                >
                                  Source: {errorMsg.source}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  )}

                  {/* Last Activity */}
                  {lastActivity && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 2, color: "text.secondary" }}
                      >
                        Last Processing Activity
                      </Typography>
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "rgba(0, 0, 0, 0.3)",
                          borderRadius: 2,
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            color:
                              lastActivity.level === "error"
                                ? "#FF6B6B"
                                : lastActivity.level === "warning"
                                ? "#F59E0B"
                                : "#96989D",
                            wordBreak: "break-word",
                          }}
                        >
                          <span
                            style={{ color: "#7DD3FC", fontSize: "0.75rem" }}
                          >
                            [
                            {new Date(
                              lastActivity.timestamp
                            ).toLocaleTimeString()}
                            ]
                          </span>{" "}
                          <span
                            style={{ color: "#A855F7", fontSize: "0.75rem" }}
                          >
                            [{lastActivity.stage}]
                          </span>{" "}
                          {lastActivity.source && (
                            <span
                              style={{ color: "#22C55E", fontSize: "0.75rem" }}
                            >
                              [{lastActivity.source}]
                            </span>
                          )}{" "}
                          {lastActivity.message}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* System Information */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 2, color: "text.secondary" }}
                    >
                      System Information
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        borderRadius: 2,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong style={{ color: "#DCDDDE" }}>
                            Platform:
                          </strong>{" "}
                          {navigator.platform}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong style={{ color: "#DCDDDE" }}>
                            User Agent:
                          </strong>{" "}
                          {navigator.userAgent}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong style={{ color: "#DCDDDE" }}>
                            Language:
                          </strong>{" "}
                          {navigator.language}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong style={{ color: "#DCDDDE" }}>Online:</strong>{" "}
                          {navigator.onLine ? "Yes" : "No"}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong style={{ color: "#DCDDDE" }}>Memory:</strong>{" "}
                          {(navigator as any).deviceMemory
                            ? `${(navigator as any).deviceMemory}GB`
                            : "Unknown"}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                        >
                          <strong style={{ color: "#DCDDDE" }}>
                            Hardware Concurrency:
                          </strong>{" "}
                          {navigator.hardwareConcurrency || "Unknown"}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Box>
      </Fade>
    </ErrorCard>
  );
};
