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
  useSubtitles,
  useStepLoading,
  useStepError,
} from '../../../stores/useStepStore';
import { createKeyboardHandler } from './utils';

export interface ExportActionsRef {
  openMultiFormatDialog: () => void;
}

// Available export formats for multi-export
const EXPORT_FORMATS = [
  { id: 'srt', name: 'SRT', extension: '.srt' },
  { id: 'vtt', name: 'WebVTT', extension: '.vtt' },
  { id: 'txt', name: 'Plain Text', extension: '.txt' },
  { id: 'json', name: 'JSON', extension: '.json' },
];

export const ExportActions = React.forwardRef<ExportActionsRef>((_props, ref) => {
  const exportStep = useExportStepContent();
  const {
    updateActionsState,
    setExportingState,
    addExportRecord,
    generatePreviewContent,
    updateExportFormat,
  } = useExportActions();
  const subtitles = useSubtitles();
  const isLoading = useStepLoading();
  const stepError = useStepError();

  // Extract state from export step
  const actionsState = exportStep.actionsState;
  const exportStatus = {
    isExporting: exportStep.isExporting,
    exportProgress: exportStep.exportProgress,
    lastExportError: exportStep.lastExportError,
  };

  // Add state for success message
  const [showSuccessMessage, setShowSuccessMessage] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState('');

  const canExport = subtitles && subtitles.length > 0 && !exportStatus.isExporting && !isLoading;

  const handleSingleExport = useCallback(async () => {
    if (!canExport) return;

    try {
      setExportingState(true, 0);

      // Generate the export content first
      setExportingState(true, 20);
      await generatePreviewContent();

      // Get the latest preview content which contains the formatted export
      // We need to wait a moment for the state to update after generatePreviewContent
      await new Promise((resolve) => setTimeout(resolve, 100));
      const exportContent = exportStep.previewContent;

      if (!exportContent || exportContent.includes('# No subtitles available')) {
        throw new Error('No content available for export');
      }

      setExportingState(true, 40);

      // Show save dialog to user
      const defaultFileName = `subtitles.${exportStep.format}`;
      const saveResult = await window.electronAPI.saveFileDialog({
        defaultPath: exportStep.customOutputPath || defaultFileName,
        filters: [
          { name: 'Subtitle Files', extensions: [exportStep.format] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        setExportingState(false, undefined, 'Export cancelled by user');
        return;
      }

      setExportingState(true, 70);

      // Write the file using IPC
      const writeResult = await window.electronAPI.writeExportFile(
        saveResult.filePath,
        exportContent
      );

      if (!writeResult.success) {
        throw new Error('Failed to write export file');
      }

      setExportingState(true, 90);

      // Calculate file size (approximate based on content length)
      const fileSize = new Blob([exportContent]).size;

      // Add to export history
      addExportRecord({
        format: exportStep.format,
        outputPath: saveResult.filePath,
        exportedAt: new Date().toISOString(),
        fileSize,
        subtitleCount: subtitles?.length || 0,
      });

      setExportingState(true, 100);

      // Show success message
      setSuccessMessage(`Successfully exported to ${saveResult.filePath}`);
      setShowSuccessMessage(true);

      // Show success briefly before clearing
      setTimeout(() => {
        setExportingState(false);
        setShowSuccessMessage(false);
      }, 3000);
    } catch (error) {
      setShowSuccessMessage(false); // Clear any success messages
      const errorMessage =
        error instanceof Error ? error.message : 'Export failed due to an unknown error';
      setExportingState(false, undefined, errorMessage);
    }
  }, [
    canExport,
    exportStep,
    subtitles,
    setExportingState,
    addExportRecord,
    generatePreviewContent,
  ]);

  const handleMultiExport = useCallback(async () => {
    if (!actionsState.selectedFormats || actionsState.selectedFormats.length === 0) return;

    try {
      setExportingState(true, 0);

      // Show folder dialog for multi-export
      const folderResult = await window.electronAPI.openFolderDialog();

      if (folderResult.canceled || !folderResult.filePaths?.[0]) {
        setExportingState(false, undefined, 'Export cancelled by user');
        return;
      }

      const outputFolder = folderResult.filePaths[0];
      const totalFormats = actionsState.selectedFormats?.length || 0;
      let completedFormats = 0;

      // Store original format
      const originalFormat = exportStep.format;

      for (const format of actionsState.selectedFormats || []) {
        try {
          const progressStart = (completedFormats / totalFormats) * 80; // Reserve 20% for final operations
          setExportingState(true, progressStart);

          // Update format for content generation
          updateExportFormat(format);

          // Wait for format update to propagate
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Generate content for this format
          await generatePreviewContent();

          setExportingState(true, progressStart + 10);

          // Wait for content generation to complete
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Get the generated content
          const exportContent = exportStep.previewContent;

          if (!exportContent || exportContent.includes('# No subtitles available')) {
            throw new Error(`No content available for ${format} format`);
          }

          setExportingState(true, progressStart + 15);

          // Create file path
          const fileName = `subtitles.${format}`;
          const filePath = `${outputFolder}/${fileName}`;

          // Write the file
          const writeResult = await window.electronAPI.writeExportFile(filePath, exportContent);

          if (!writeResult.success) {
            throw new Error(`Failed to write ${format} file`);
          }

          setExportingState(true, progressStart + 18);

          // Calculate file size
          const fileSize = new Blob([exportContent]).size;

          // Add to export history
          addExportRecord({
            format,
            outputPath: filePath,
            exportedAt: new Date().toISOString(),
            fileSize,
            subtitleCount: subtitles?.length || 0,
          });

          completedFormats++;
        } catch {
          // Log format-specific error but continue with other formats
          // This allows partial success in multi-format exports
          continue;
        }
      }

      setExportingState(true, 90);

      // Restore original format
      updateExportFormat(originalFormat);

      updateActionsState({
        showMultiFormatDialog: false,
        selectedFormats: [],
      });

      setExportingState(true, 100);

      // Show success message
      const exportedFormats = (actionsState.selectedFormats || []).join(', ').toUpperCase();
      setSuccessMessage(
        `Successfully exported ${completedFormats} formats (${exportedFormats}) to ${outputFolder}`
      );
      setShowSuccessMessage(true);

      // Show success briefly before clearing
      setTimeout(() => {
        setExportingState(false);
        setShowSuccessMessage(false);
      }, 3000);
    } catch (error) {
      setShowSuccessMessage(false); // Clear any success messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Multi-format export failed due to an unknown error';
      setExportingState(false, undefined, errorMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actionsState.selectedFormats,
    subtitles,
    exportStep,
    setExportingState,
    addExportRecord,
    updateActionsState,
    generatePreviewContent,
  ]);

  const handleCancel = useCallback(() => {
    setShowSuccessMessage(false); // Clear any success messages
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

  // Clear success/error messages when export starts
  useEffect(() => {
    if (exportStatus.isExporting) {
      setShowSuccessMessage(false);
    }
  }, [exportStatus.isExporting]);

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

      {/* Success Display */}
      {showSuccessMessage && (
        <Alert severity='success' sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle>Export Successful</AlertTitle>
          {successMessage}
        </Alert>
      )}

      {/* Error Display */}
      {(exportStatus.lastExportError || stepError) && (
        <Alert severity='error' sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle>Export Error</AlertTitle>
          {exportStatus.lastExportError || stepError}
        </Alert>
      )}

      <Stack spacing={2}>
        {/* Primary Export Button - Made taller */}
        <Tooltip title={canExport ? 'Export subtitles (Ctrl+E)' : 'No subtitles available'}>
          <span>
            <Button
              variant='contained'
              startIcon={
                exportStatus.isExporting ? <CircularProgress size={20} /> : <DownloadIcon />
              }
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
                    checked={actionsState.selectedFormats?.includes(format.id) || false}
                    onChange={(e) => {
                      const currentFormats = actionsState.selectedFormats || [];
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
            disabled={!actionsState.selectedFormats || actionsState.selectedFormats.length === 0}
          >
            Export {actionsState.selectedFormats?.length || 0} Format
            {(actionsState.selectedFormats?.length || 0) !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

ExportActions.displayName = 'ExportActions';
