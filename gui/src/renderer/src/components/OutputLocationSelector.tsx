import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Alert,
  Stack
} from '@mui/material'
import {
  Folder as FolderIcon,
  Clear as ClearIcon,
  AutoAwesome as AutoIcon
} from '@mui/icons-material'
import { useAppStore } from '../store/app-store'

export const OutputLocationSelector: React.FC = () => {
  const { config, updateConfig, showNotification } = useAppStore()

  const handleOutputSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFolderDialog()
      
      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0]
        const fileName = config.inputFile 
          ? config.inputFile.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '.srt')
          : 'output.srt'
        const outputPath = `${folderPath}/${fileName}`
        
        updateConfig('outputFile', outputPath)
        showNotification('Output location selected', 'success')
      }
    } catch (error) {
      showNotification(`Failed to select output location: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }, [config.inputFile, updateConfig, showNotification])

  const handleOutputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig('outputFile', e.target.value)
  }, [updateConfig])

  const handleClearOutput = useCallback(() => {
    updateConfig('outputFile', null)
  }, [updateConfig])

  const getOutputFolder = (filePath: string | null) => {
    if (!filePath) return null
    const parts = filePath.split(/[\\/]/)
    parts.pop() // Remove filename
    return parts.join('/')
  }

  const getOutputFilename = (filePath: string | null) => {
    if (!filePath) return null
    return filePath.split(/[\\/]/).pop()
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderIcon color="primary" />
        Output Location
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        If not specified, output will be saved next to the input file
      </Typography>
      
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            value={config.outputFile || ''}
            onChange={handleOutputChange}
            placeholder="Auto-generated from input file"
            size="small"
            InputProps={{
              endAdornment: config.outputFile && (
                <IconButton size="small" onClick={handleClearOutput}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )
            }}
          />
          <Button
            variant="outlined"
            onClick={handleOutputSelect}
            startIcon={<FolderIcon />}
            sx={{ minWidth: 'auto', px: 2 }}
          >
            Browse
          </Button>
        </Box>
        
        {config.outputFile && (
          <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              📄 {getOutputFilename(config.outputFile)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              📁 {getOutputFolder(config.outputFile)}
            </Typography>
          </Paper>
        )}
        
        {!config.outputFile && config.inputFile && (
          <Alert 
            icon={<AutoIcon />} 
            severity="info" 
            sx={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
          >
            <Typography variant="body2">
              <strong>Auto-generated location:</strong><br />
              {config.inputFile.replace(/\.[^/.]+$/, '.srt')}
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}