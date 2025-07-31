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
import { useAppStore } from "../../../stores/app-store";
import { ProcessingCard, TerminateButton } from "./styles";
import { CancelConfirmationDialog } from "./CancelConfirmationDialog";
import { formatTime } from "./utils";

export const ProcessingControls: React.FC = () => {
  const { processing, cancelTranscription, hardware } = useAppStore();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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
            disabled={!processing.isActive}
          >
            Cancel Processing
          </TerminateButton>

          {hardware.info && (
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 2, color: "text.secondary" }}
              >
                System Resources
              </Typography>
              <Stack spacing={1.5}>
                {hardware.info.gpuAcceleration && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <MemoryIcon fontSize="small" sx={{ color: "#57F287" }} />
                    <Typography variant="body2">
                      GPU Acceleration: Enabled
                    </Typography>
                  </Box>
                )}
                {hardware.info.memoryUsage && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <MemoryIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      Memory: {hardware.info.memoryUsage}
                    </Typography>
                  </Box>
                )}
                {hardware.info.cpuUsage && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SpeedIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      CPU Usage: {hardware.info.cpuUsage}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {processing.timeElapsed > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, color: "text.secondary" }}
              >
                Processing Time
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                Elapsed: {formatTime(processing.timeElapsed)}
              </Typography>
              {processing.timeRemaining > 0 && (
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  Remaining: ~{formatTime(processing.timeRemaining)}
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