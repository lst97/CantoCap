import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
} from "@mui/material";
import {
  Error as ErrorIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { IPCProcessError } from "@/types";
import { ErrorCard } from "./styles";
import { ErrorDisplayProps } from "./types";
import { getErrorIcon } from "./utils";

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  const [ipcErrors, setIpcErrors] = useState<IPCProcessError[]>([]);

  useEffect(() => {
    const cleanup = window.cantocapAPI.onProcessError(
      (errorData: IPCProcessError) => {
        setIpcErrors((prev) => [...prev, errorData]);
      }
    );

    return cleanup;
  }, []);

  if (!error && ipcErrors.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      {/* Processing state error */}
      {error && (
        <ErrorCard>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
            <ErrorIcon sx={{ color: "#ED4245", mt: 0.5 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: "#ED4245", mb: 1 }}>
                Processing Error
              </Typography>
              <Typography variant="body2" sx={{ color: "text.primary" }}>
                {error}
              </Typography>
            </Box>
          </Box>
        </ErrorCard>
      )}

      {/* IPC errors */}
      {ipcErrors.map((ipcError, index) => (
        <ErrorCard key={index}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
            {getErrorIcon(ipcError.type)}
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: "#ED4245", mb: 1 }}>
                {ipcError.type
                  .replace("_", " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                {ipcError.exitCode && ` (Exit Code: ${ipcError.exitCode})`}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.primary" }}>
                {ipcError.message}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() =>
                setIpcErrors((prev) => prev.filter((_, i) => i !== index))
              }
              sx={{ color: "text.secondary" }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </ErrorCard>
      ))}
    </Box>
  );
};