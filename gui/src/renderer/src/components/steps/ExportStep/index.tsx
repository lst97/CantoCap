import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Alert,
  Snackbar,
  LinearProgress,
} from '@mui/material';
import { Download as DownloadIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';

import {
  useExportStepContent,
  useExportActions,
  useSubtitles,
  useStepActions,
  useStepLoading,
  useStepError,
} from '../../../stores/useStepStore';
import { ConfigSection } from './ConfigSection';
import { FormatSelector } from './FormatSelector';
import { LanguageOptions } from './LanguageOptions';
import { ExportActions, ExportActionsRef } from './ExportActions';
import { ExportPreview } from './ExportPreview';
import { ExportHistory } from './ExportHistory';

export const ExportStep: React.FC = () => {
  // Use selective subscriptions to prevent unnecessary re-renders
  const exportStep = useExportStepContent();
  const { generatePreviewContent } = useExportActions();
  const subtitles = useSubtitles();
  const stepActions = useStepActions();
  const isLoading = useStepLoading();
  const error = useStepError();

  // Memoize export status to prevent child re-renders
  const exportStatus = React.useMemo(
    () => ({
      isExporting: exportStep.isExporting,
      exportProgress: exportStep.exportProgress,
      lastExportError: exportStep.lastExportError,
    }),
    [exportStep.isExporting, exportStep.exportProgress, exportStep.lastExportError]
  );

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const isMenuOpen = Boolean(menuAnchorEl);
  const exportActionsRef = useRef<ExportActionsRef>(null);

  const canExport = subtitles && subtitles.length > 0 && !exportStatus.isExporting;

  // Event handlers - defined before any conditional returns to satisfy rules of hooks
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  const handleMultiFormatMenuClick = useCallback(() => {
    exportActionsRef.current?.openMultiFormatDialog();
    handleMenuClose();
  }, [handleMenuClose]);

  // Handle errors
  useEffect(() => {
    if (error) {
      setShowErrorNotification(true);
    }
  }, [error]);

  // Generate initial preview on mount - use ref to prevent infinite loops
  const hasGeneratedPreview = useRef(false);

  useEffect(() => {
    if (!hasGeneratedPreview.current) {
      hasGeneratedPreview.current = true;
      generatePreviewContent();
    }
  }, [generatePreviewContent]);

  // Show loading state while step is initializing
  if (isLoading) {
    return (
      <Box
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <LinearProgress sx={{ width: '100%', maxWidth: 400, mb: 2 }} />
        <Typography variant='body2' color='text.secondary'>
          Loading export configuration...
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Main Configuration - Scrollable */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
            pr: 2,
          }}
        >
          {/* Configuration Loading State */}
          {isLoading && (
            <Alert severity='info' sx={{ mb: 2 }}>
              Loading export configuration...
            </Alert>
          )}

          {/* Configuration Error State */}
          {error && (
            <Alert severity='error' sx={{ mb: 2 }} onClose={() => stepActions.clearError()}>
              Failed to load configuration: {error}
            </Alert>
          )}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant='h5'
              sx={{
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                fontWeight: 700,
              }}
            >
              <DownloadIcon color='primary' />
              Export Configuration
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Configure your export settings and preview the output
            </Typography>
          </Box>

          <Stack spacing={3}>
            <ConfigSection
              title='Export Format'
              icon={<Box sx={{ fontSize: '1.25rem' }}>📄</Box>}
              important={true}
            >
              <FormatSelector />
            </ConfigSection>

            <ConfigSection
              title='Language Options'
              icon={<Box sx={{ fontSize: '1.25rem' }}>🌐</Box>}
            >
              <LanguageOptions />
            </ConfigSection>

            <ConfigSection
              title='Export Actions'
              icon={<Box sx={{ fontSize: '1.25rem' }}>⚡</Box>}
              important={true}
              action={
                <Tooltip title='More options'>
                  <IconButton
                    onClick={handleMenuOpen}
                    size='small'
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Tooltip>
              }
            >
              <ExportActions ref={exportActionsRef} />
            </ConfigSection>
          </Stack>

          {/* Bottom padding for better scrolling */}
          <Box sx={{ height: 24 }} />
        </Box>

        {/* Preview and History Panel - Scrollable */}
        <Box
          sx={{
            width: 450,
            minWidth: 450,
            maxWidth: 450,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            p: 4,
            pl: 3,
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            overflow: 'auto',
          }}
        >
          <ExportPreview />
          <ExportHistory />
        </Box>

        {/* Options Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={isMenuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleMultiFormatMenuClick} disabled={!canExport}>
            Export Multiple Formats
          </MenuItem>
        </Menu>
      </Box>

      {/* Error Notification */}
      <Snackbar
        open={showErrorNotification}
        autoHideDuration={6000}
        onClose={() => {
          setShowErrorNotification(false);
          stepActions.clearError();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => {
            setShowErrorNotification(false);
            stepActions.clearError();
          }}
          severity='error'
          variant='filled'
        >
          {exportStatus.lastExportError || error || 'Failed to export configuration'}
        </Alert>
      </Snackbar>
    </>
  );
};
