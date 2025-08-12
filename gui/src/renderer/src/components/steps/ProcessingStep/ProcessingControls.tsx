import React, { useState } from "react";
import {
  Typography,
  Stack,
  Box,
} from "@mui/material";
import {
  Stop as StopIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
} from "@mui/icons-material";
import { 
  useProcessingStepContent,
  useStepActions 
} from "../../../stores/useStepStore";
import { ProcessingCard, TerminateButton } from "./styles";
import { CancelConfirmationDialog } from "./CancelConfirmationDialog";
import { formatTime } from "./utils";

export const ProcessingControls: React.FC = () => {
  const processing = useProcessingStepContent();
  const { cancelTranscription } = useStepActions();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Calculate elapsed time for display
  const timeElapsed = processing.startTime && processing.endTime 
    ? Math.floor((new Date(processing.endTime).getTime() - new Date(processing.startTime).getTime()) / 1000)
    : processing.timeElapsed || 0;

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    cancelTranscription();
    setShowCancelDialog(false);
  };

  return (
    <>
      <ProcessingCard>
        <Typography
          variant="h6"
          sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}
        >
          <StopIcon sx={{ color: "#ED4245" }} />
          Processing Controls
        </Typography>

        <Stack spacing={3}>
          <TerminateButton
            startIcon={<StopIcon />}
            fullWidth
            onClick={handleCancelClick}
            disabled={processing.status !== 'running'}
          >
            Cancel Processing
          </TerminateButton>

          {processing.hardwareInfo && (
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 2, color: "text.secondary" }}
              >
                System Resources
              </Typography>
              <Stack spacing={1.5}>
                {processing.hardwareInfo.gpuAcceleration && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <MemoryIcon fontSize="small" sx={{ color: "#57F287" }} />
                    <Typography variant="body2">
                      GPU Acceleration: Enabled
                    </Typography>
                  </Box>
                )}
                {processing.hardwareInfo.memoryUsage && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <MemoryIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      Memory: {processing.hardwareInfo.memoryUsage}
                    </Typography>
                  </Box>
                )}
                {processing.hardwareInfo.processingSpeed && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SpeedIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      Processing Speed: {processing.hardwareInfo.processingSpeed}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {timeElapsed > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, color: "text.secondary" }}
              >
                Processing Time
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                Elapsed: {formatTime(timeElapsed)}
              </Typography>
              {processing.estimatedTimeRemaining && processing.estimatedTimeRemaining > 0 && (
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  Remaining: ~{formatTime(processing.estimatedTimeRemaining)}
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </ProcessingCard>

      <CancelConfirmationDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleConfirmCancel}
      />
    </>
  );
};