import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { Warning as WarningIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { WorkspaceWithGrouping } from './types';
import { useWorkspaceActions, useWorkspaceLoading } from '../../stores/useWorkspaceStore';

export interface WorkspaceDeleteDialogProps {
  open: boolean;
  workspace: WorkspaceWithGrouping | null;
  onClose: () => void;
  onConfirm?: () => void; // Optional - will use store action if not provided
}

/**
 * WorkspaceDeleteDialog - Deletion confirmation dialog
 * Features: Clear warning, workspace name display, data loss explanation
 */
export const WorkspaceDeleteDialog: React.FC<WorkspaceDeleteDialogProps> = ({
  open,
  workspace,
  onClose,
  onConfirm,
}) => {
  // Get store actions and state
  const { deleteWorkspace } = useWorkspaceActions();
  const loading = useWorkspaceLoading();

  // Handle delete confirmation
  const handleConfirm = async () => {
    if (!workspace) return;

    try {
      if (onConfirm) {
        // Use provided callback
        await onConfirm();
      } else {
        // Use store action
        await deleteWorkspace(workspace.id);
      }

      onClose();
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      // Error handling is managed by the store
    }
  };
  if (!workspace) return null;

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      maxWidth='sm'
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'error.main',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1,
        }}
      >
        <WarningIcon sx={{ color: 'error.main', fontSize: 28 }} />
        <Typography variant='h6' component='div' sx={{ fontWeight: 600 }}>
          Delete Workspace
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Alert severity='error' sx={{ mb: 2 }}>
          <Typography variant='body2' sx={{ fontWeight: 500 }}>
            This action cannot be undone
          </Typography>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant='body1' sx={{ mb: 1.5 }}>
            Are you sure you want to delete the workspace:
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              backgroundColor: 'action.hover',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                backgroundColor: workspace.color || '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              {workspace.emoji || workspace.name.charAt(0).toUpperCase()}
            </Box>
            <Typography variant='body1' sx={{ fontWeight: 500 }}>
              {workspace.name}
            </Typography>
          </Box>
        </Box>

        <Typography variant='body2' color='text.secondary' sx={{ lineHeight: 1.5 }}>
          All workspace data will be permanently removed, including:
        </Typography>

        <Box
          component='ul'
          sx={{
            mt: 1,
            mb: 0,
            pl: 2,
            '& li': {
              color: 'text.secondary',
              fontSize: '0.875rem',
              lineHeight: 1.4,
              mb: 0.5,
            },
          }}
        >
          <li>Session configuration and state</li>
          <li>Input and output file associations</li>
          <li>Workspace-specific settings</li>
          <li>Processing history and logs</li>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2,
          gap: 1,
        }}
      >
        <Button onClick={onClose} disabled={loading} variant='outlined' sx={{ minWidth: 80 }}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading}
          variant='contained'
          color='error'
          startIcon={loading ? undefined : <DeleteIcon />}
          sx={{
            minWidth: 120,
            fontWeight: 600,
          }}
        >
          {loading ? 'Deleting...' : 'Delete Workspace'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
