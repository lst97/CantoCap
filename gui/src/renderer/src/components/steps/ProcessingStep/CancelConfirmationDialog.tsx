import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
} from "@mui/material";
import {
  Warning as WarningIcon,
  Close as CloseIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import { CancelConfirmationDialogProps } from "./types";
import { TerminateButton } from "./styles";

export const CancelConfirmationDialog: React.FC<CancelConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        backgroundColor: "#2F3136",
        borderRadius: 2,
        border: "1px solid rgba(64, 68, 75, 0.3)",
      },
    }}
  >
    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <WarningIcon sx={{ color: "#FEE75C" }} />
      <Typography variant="h6">Cancel Processing?</Typography>
      <IconButton
        onClick={onClose}
        sx={{ ml: "auto", color: "text.secondary" }}
      >
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent>
      <Typography>
        Are you sure you want to cancel the current processing operation? This
        will stop the transcription and you'll lose all progress.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ p: 2, gap: 1 }}>
      <Button onClick={onClose} variant="outlined">
        Continue Processing
      </Button>
      <TerminateButton onClick={onConfirm} startIcon={<StopIcon />}>
        Cancel Processing
      </TerminateButton>
    </DialogActions>
  </Dialog>
);