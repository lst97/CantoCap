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
import { 
  useProcessingStepContent,
  useStepActions,
  useStepError 
} from "../../../stores/useStepStore";
import { useWorkflowActions } from "../../../stores/useWorkflowStore";
import { ErrorCategory } from "../../../types/error";
import { errorHandler } from "../../../utils/errorHandler";
import { ErrorCard, InfoSection } from "./styles";

export const ProcessingError: React.FC = () => {
  const processing = useProcessingStepContent();
  const { resetStepContent } = useStepActions();
  const error = useStepError();
  const workflowActions = useWorkflowActions();
  // Modern workflow navigation using WorkflowStateManager
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  // Calculate elapsed time for display
  const timeElapsed = processing.startTime && processing.endTime 
    ? Math.floor((new Date(processing.endTime).getTime() - new Date(processing.startTime).getTime()) / 1000)
    : processing.timeElapsed || 0;

  // Use logs from processing step
  const recentMessages = processing.logs?.slice(-20) || [];
  const errorMessages = recentMessages.filter((msg) => 
    typeof msg === 'string' ? msg.toLowerCase().includes('error') : false
  );
  
  // Get last activity from logs
  const lastActivity = processing.logs && processing.logs.length > 0 
    ? processing.logs[processing.logs.length - 1] 
    : null;

  // Get error message from step error or processing logs
  const errorMessage = error || (errorMessages.length > 0 ? errorMessages[errorMessages.length - 1] : null);

  if (!errorMessage) return null;

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

  // Get error category
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
    resetStepContent('processing');
    setTimeout(() => {
      workflowActions.navigateToStep("config");
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
        resetStepContent('processing');
        workflowActions.navigateToStep("config");
      }
    } catch (setupError) {
      console.error("Engine setup failed:", setupError);
    }
  };

  const handleCopyError = () => {
    const errorData = {
      error: errorMessage,
      category: errorCategory,
      processingStage: processing.status,
      timestamp: new Date().toISOString(),
      recoveryAttempts,
      errorMessages: errorMessages,
      recentMessages: recentMessages,
      processingInfo: {
        status: processing.status,
        currentPhase: processing.currentPhase,
        progress: processing.progress,
        timeElapsed: timeElapsed,
        startTime: processing.startTime,
        endTime: processing.endTime,
        logs: processing.logs,
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
      processingStage: processing.status,
      timestamp: new Date().toISOString(),
      recoveryAttempts,
      errorMessages: errorMessages,
      recentMessages: recentMessages,
      processingInfo: {
        status: processing.status,
        currentPhase: processing.currentPhase,
        progress: processing.progress,
        timeElapsed: timeElapsed,
        startTime: processing.startTime,
        endTime: processing.endTime,
        logs: processing.logs,
        hardwareInfo: processing.hardwareInfo,
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
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
                {errorMessage.includes("Exit Code:") && (
                  <Chip
                    label={
                      errorMessage.match(/Exit Code: (\d+)/)?.[0] ||
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

            {/* Additional Error Messages */}
            {errorMessages.length > 1 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, color: "text.primary" }}>
                  Additional Errors
                </Typography>
                <Alert
                  severity="warning"
                  sx={{
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    mb: 2,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    PROCESSING ERROR - {new Date().toLocaleTimeString()}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {errorMessages[errorMessages.length - 2]}
                  </Typography>
                </Alert>
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontStyle: "italic",
                    textAlign: "center",
                  }}
                >
                  {errorMessages.length} total error{errorMessages.length !== 1 ? "s" : ""} recorded.{" "}
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
                {errorExplanation.possibleCauses.map((cause: string, index: number) => (
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
                {errorExplanation.suggestedActions.map((action: string, index: number) => (
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
                          <strong>Processing Status:</strong> {processing.status}
                        </Typography>
                        {processing.currentPhase && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Current Phase:</strong> {processing.currentPhase}
                          </Typography>
                        )}
                        {processing.progress > 0 && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Progress:</strong> {Math.round(processing.progress)}%
                          </Typography>
                        )}
                        {timeElapsed > 0 && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Time Elapsed:</strong> {timeElapsed}s
                          </Typography>
                        )}
                        {recoveryAttempts > 0 && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Recovery Attempts:</strong> {recoveryAttempts}
                          </Typography>
                        )}
                        {errorMessages.length > 0 && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Error Count:</strong> {errorMessages.length}
                          </Typography>
                        )}
                        {errorMessage.includes("Exit Code:") && (
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                          >
                            <strong>Exit Code:</strong>{" "}
                            {errorMessage.match(/Exit Code: (\d+)/)?.[1] || "Unknown"}
                          </Typography>
                        )}
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
                          {recentMessages.map((msg, index) => (
                            <Typography
                              key={index}
                              variant="body2"
                              sx={{
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                                color: typeof msg === 'string' && msg.toLowerCase().includes('error')
                                  ? "#FF6B6B"
                                  : typeof msg === 'string' && msg.toLowerCase().includes('warning')
                                  ? "#F59E0B"
                                  : "#96989D",
                                wordBreak: "break-word",
                              }}
                            >
                              <span
                                style={{ color: "#7DD3FC", fontSize: "0.7rem" }}
                              >
                                [{new Date().toLocaleTimeString()}]
                              </span>{" "}
                              <span
                                style={{ color: "#A855F7", fontSize: "0.7rem" }}
                              >
                                [{processing.currentPhase || processing.status}]
                              </span>{" "}
                              {typeof msg === 'string' ? msg : JSON.stringify(msg)}
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
                          {errorMessages.map((errorMsg, index) => (
                            <Box key={index}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                  color: "#FF6B6B",
                                  fontWeight: 600,
                                }}
                              >
                                [{new Date().toLocaleTimeString()}] {(processing.currentPhase || processing.status).toUpperCase()}
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
                                {typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}
                              </Typography>
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
                            color: typeof lastActivity === 'string' && lastActivity.toLowerCase().includes('error')
                              ? "#FF6B6B"
                              : typeof lastActivity === 'string' && lastActivity.toLowerCase().includes('warning')
                              ? "#F59E0B"
                              : "#96989D",
                            wordBreak: "break-word",
                          }}
                        >
                          <span
                            style={{ color: "#7DD3FC", fontSize: "0.75rem" }}
                          >
                            [{new Date().toLocaleTimeString()}]
                          </span>{" "}
                          <span
                            style={{ color: "#A855F7", fontSize: "0.75rem" }}
                          >
                            [{processing.currentPhase || processing.status}]
                          </span>{" "}
                          {typeof lastActivity === 'string' ? lastActivity : JSON.stringify(lastActivity)}
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
