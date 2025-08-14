import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Save as SaveIcon,
  Delete as DiscardIcon,
} from '@mui/icons-material';

interface UnsavedChangesDialogProps {
  open: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  saveError?: string | null;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  open,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false,
  saveError = null,
}) => {
  const handleSave = async () => {
    try {
      await onSave();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      disableEscapeKeyDown={isSaving}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        Unsaved Changes
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          You have unsaved changes to your subtitles. What would you like to do?
        </Typography>
        
        {saveError && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="error.dark">
              Save failed: {saveError}
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={isSaving}
          variant="outlined"
        >
          Cancel
        </Button>
        
        <Button
          onClick={onDiscard}
          disabled={isSaving}
          variant="outlined"
          color="error"
          startIcon={<DiscardIcon />}
        >
          Discard Changes
        </Button>
        
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};