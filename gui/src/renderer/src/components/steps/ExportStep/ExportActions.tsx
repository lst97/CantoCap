import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
  Stack,
  Divider,
  LinearProgress,
  Alert,
  AlertTitle,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem
} from '@mui/material'
import {
  Download as DownloadIcon,
  Cancel as CancelIcon
} from '@mui/icons-material'

import { useExportStore } from '../../../stores/export-store'
import { createKeyboardHandler } from './utils'

export interface ExportActionsRef {
  openMultiFormatDialog: () => void
}

export const ExportActions = React.forwardRef<ExportActionsRef>((props, ref) => {
  const { 
    progress, 
    getSubtitleData, 
    exportSubtitles, 
    exportMultipleFormats,
    cancelExport,
    lastError,
    formats
  } = useExportStore()
  
  const [showMultiFormatDialog, setShowMultiFormatDialog] = useState(false)
  const [selectedFormats, setSelectedFormats] = useState<string[]>([])
  
  const subtitles = getSubtitleData()
  const canExport = subtitles.length > 0 && !progress.isExporting
  
  const handleSingleExport = useCallback(async () => {
    if (!canExport) return
    
    try {
      await exportSubtitles()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }, [canExport, exportSubtitles])
  
  const handleMultiExport = useCallback(async () => {
    if (selectedFormats.length === 0) return
    
    try {
      await exportMultipleFormats(selectedFormats)
      setShowMultiFormatDialog(false)
      setSelectedFormats([])
    } catch (error) {
      console.error('Multi-format export failed:', error)
    }
  }, [selectedFormats, exportMultipleFormats])
  
  const handleCancel = useCallback(() => {
    cancelExport()
  }, [cancelExport])
  
  // Expose methods to parent via ref
  React.useImperativeHandle(ref, () => ({
    openMultiFormatDialog: () => setShowMultiFormatDialog(true)
  }), [])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = createKeyboardHandler(canExport, handleSingleExport)
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canExport, handleSingleExport])
  
  return (
    <Box role="region" aria-labelledby="export-actions-title">

      {/* Progress Display */}
      {progress.isExporting && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="primary">
              {progress.message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progress.progress)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress.progress} 
            sx={{ mb: 1, height: 6, borderRadius: 3 }}
            aria-label={`Export progress: ${Math.round(progress.progress)}%`}
          />
          <Typography variant="caption" color="text.secondary">
            Stage: {progress.stage}
          </Typography>
        </Box>
      )}
      
      {/* Error Display */}
      {lastError && (
        <Alert severity="error" sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle>Export Error</AlertTitle>
          {lastError}
        </Alert>
      )}
      
      <Stack spacing={2}>
        {/* Primary Export Button - Made taller */}
        <Tooltip title={canExport ? "Export subtitles (Ctrl+E)" : "No subtitles available"}>
          <span>
            <Button
              variant="contained"
              startIcon={progress.isExporting ? <CircularProgress size={20} /> : <DownloadIcon />}
              size="large"
              fullWidth
              disabled={!canExport}
              onClick={handleSingleExport}
              aria-describedby="export-help-text"
              sx={{ 
                height: 56, // Increased height from default ~36px
                fontSize: '1rem',
                fontWeight: 600
              }}
            >
              {progress.isExporting ? 'Exporting...' : 'Export Subtitles'}
            </Button>
          </span>
        </Tooltip>
        
        <Typography id="export-help-text" variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Keyboard shortcut: Ctrl+E
        </Typography>
        
        {/* Cancel Button (shown during export) */}
        {progress.isExporting && progress.canCancel && (
          <Button
            variant="outlined"
            color="error"
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
        open={showMultiFormatDialog} 
        onClose={() => setShowMultiFormatDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Export Multiple Formats</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the formats you want to export simultaneously:
          </Typography>
          <Stack spacing={1}>
            {formats.map(format => (
              <FormControlLabel
                key={format.id}
                control={
                  <Checkbox
                    checked={selectedFormats.includes(format.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFormats(prev => [...prev, format.id])
                      } else {
                        setSelectedFormats(prev => prev.filter(id => id !== format.id))
                      }
                    }}
                  />
                }
                label={`${format.name} (${format.extension})`}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMultiFormatDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleMultiExport}
            disabled={selectedFormats.length === 0}
          >
            Export {selectedFormats.length} Format{selectedFormats.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
})