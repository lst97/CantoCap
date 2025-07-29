export interface CancelConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export interface ErrorDisplayProps {
  error: string | null;
}

export interface StageInfo {
  name: string;
  emoji: string;
}