import React, { useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
  Stack,
  LinearProgress,
  Alert,
  AlertTitle,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Download as DownloadIcon, Cancel as CancelIcon } from '@mui/icons-material';

import { 
  useExportStepContent, 
  useExportActions,
  useExportActionsState,
  useExportStatus,
  useSubtitles 
} from '../../../stores/useStepStore';
import { createKeyboardHandler } from './utils';

export interface ExportActionsRef {
  openMultiFormatDialog: () => void;
}

// Available export formats for multi-export
const EXPORT_FORMATS = [
  { id: 'srt', name: 'SRT', extension: '.srt' },
  { id: 'vtt', name: 'WebVTT', extension: '.vtt' },
  { id: 'txt', name: 'Plain Text', extension: '.txt' }
];

export const ExportActions = React.forwardRef<ExportActionsRef>((_props, ref) => {
  const exportStep = useExportStepContent();
  const { updateActionsState, setExportingState, addExportRecord } = useExportActions();
  const actionsState = useExportActionsState();
  const exportStatus = useExportStatus();
  const subtitles = useSubtitles();

  const canExport = subtitles.length > 0 && !exportStatus.isExporting;

  const handleSingleExport = useCallback(async () => {
    if (!canExport) return;

    try {
      setExportingState(true, 0);
      
      // Simulate export process
      for (let i = 0; i <= 100; i += 20) {
        setExportingState(true, i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Add to export history
      addExportRecord({
        format: exportStep.format,
        outputPath: exportStep.customOutputPath || `subtitles.${exportStep.format}`,
        exportedAt: new Date().toISOString(),
        fileSize: Math.floor(Math.random() * 50000) + 10000,
        subtitleCount: subtitles.length
      });
      
      setExportingState(false);
    } catch (error) {
      console.error('Export failed:', error);
      setExportingState(false, undefined, error instanceof Error ? error.message : 'Export failed');
    }
  }, [canExport, exportStep, subtitles, setExportingState, addExportRecord]);

  const handleMultiExport = useCallback(async () => {
    if (actionsState.selectedFormats.length === 0) return;

    try {
      setExportingState(true, 0);
      
      for (const format of actionsState.selectedFormats) {
        // Simulate export for each format
        for (let i = 0; i <= 100; i += 25) {
          setExportingState(true, i);
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // Add to export history
        addExportRecord({
          format,
          outputPath: `subtitles.${format}`,
          exportedAt: new Date().toISOString(),
          fileSize: Math.floor(Math.random() * 50000) + 10000,
          subtitleCount: subtitles.length
        });
      }
      
      updateActionsState({ 
        showMultiFormatDialog: false, 
        selectedFormats: [] 
      });
      setExportingState(false);
    } catch (error) {
      console.error('Multi-format export failed:', error);
      setExportingState(false, undefined, error instanceof Error ? error.message : 'Multi-format export failed');
    }
  }, [actionsState.selectedFormats, subtitles, setExportingState, addExportRecord, updateActionsState]);

  const handleCancel = useCallback(() => {
    setExportingState(false, undefined, 'Export cancelled by user');
  }, [setExportingState]);

  // Expose methods to parent via ref
  React.useImperativeHandle(
    ref,
    () => ({
      openMultiFormatDialog: () => updateActionsState({ showMultiFormatDialog: true }),
    }),
    [updateActionsState]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = createKeyboardHandler(canExport, handleSingleExport);

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canExport, handleSingleExport]);

  return (
    <Box role='region' aria-labelledby='export-actions-title'>
      {/* Progress Display */}
      {exportStatus.isExporting && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
          >
            <Typography variant='body2' color='primary'>
              Exporting subtitles...
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {Math.round(exportStatus.exportProgress || 0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant='determinate'
            value={exportStatus.exportProgress || 0}
            sx={{ mb: 1, height: 6, borderRadius: 3 }}
            aria-label={`Export progress: ${Math.round(exportStatus.exportProgress || 0)}%`}
          />
          <Typography variant='caption' color='text.secondary'>
            Generating {exportStep.format.toUpperCase()} format...
          </Typography>
        </Box>
      )}

      {/* Error Display */}
      {exportStatus.lastExportError && (
        <Alert severity='error' sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle>Export Error</AlertTitle>
          {exportStatus.lastExportError}
        </Alert>
      )}

      <Stack spacing={2}>
        {/* Primary Export Button - Made taller */}
        <Tooltip title={canExport ? 'Export subtitles (Ctrl+E)' : 'No subtitles available'}>
          <span>
            <Button
              variant='contained'
              startIcon={exportStatus.isExporting ? <CircularProgress size={20} /> : <DownloadIcon />}
              size='large'
              fullWidth
              disabled={!canExport}
              onClick={handleSingleExport}
              aria-describedby='export-help-text'
              sx={{
                height: 56, // Increased height from default ~36px
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              {exportStatus.isExporting ? 'Exporting...' : 'Export Subtitles'}
            </Button>
          </span>
        </Tooltip>

        <Typography
          id='export-help-text'
          variant='caption'
          color='text.secondary'
          sx={{ textAlign: 'center' }}
        >
          Keyboard shortcut: Ctrl+E
        </Typography>

        {/* Cancel Button (shown during export) */}
        {exportStatus.isExporting && (
          <Button
            variant='outlined'
            color='error'
            startIcon={<CancelIcon />}
            fullWidth
            onClick={handleCancel}
          >
            Cancel Export
          </Button>
        )}
      </Stack>

      {/* Multi-format Export Dialog */}
      <Dialog
        open={actionsState.showMultiFormatDialog}
        onClose={() => updateActionsState({ showMultiFormatDialog: false })}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Export Multiple Formats</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Select the formats you want to export simultaneously:
          </Typography>
          <Stack spacing={1}>
            {EXPORT_FORMATS.map((format) => (
              <FormControlLabel
                key={format.id}
                control={
                  <Checkbox
                    checked={actionsState.selectedFormats.includes(format.id)}
                    onChange={(e) => {
                      const currentFormats = actionsState.selectedFormats;
                      const newFormats = e.target.checked 
                        ? [...currentFormats, format.id]
                        : currentFormats.filter((id) => id !== format.id);
                      
                      updateActionsState({ selectedFormats: newFormats });
                    }}
                  />
                }
                label={`${format.name} (${format.extension})`}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => updateActionsState({ showMultiFormatDialog: false })}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleMultiExport}
            disabled={actionsState.selectedFormats.length === 0}
          >
            Export {actionsState.selectedFormats.length} Format{actionsState.selectedFormats.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

ExportActions.displayName = 'ExportActions';
