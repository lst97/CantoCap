import React, { useCallback, useState, useRef } from 'react'
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Stack,
  Chip,
  IconButton,
  Alert
} from '@mui/material'
import { 
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Clear as ClearIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon
} from '@mui/icons-material'
import { useAppStore } from '../store/app-store'

export const FileSelector: React.FC = () => {
  const { config, updateConfig, showNotification } = useAppStore()
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'] },
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        updateConfig('inputFile', filePath)
        
        // Auto-generate output filename if not set
        if (!config.outputFile) {
          const outputPath = filePath.replace(/\.[^/.]+$/, '.srt')
          updateConfig('outputFile', outputPath)
        }
        
        showNotification('Input file selected successfully', 'success')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      showNotification(`Failed to select file: ${errorMsg}`, 'error')
    }
  }, [updateConfig, config.outputFile, showNotification])

  const handleClearFile = useCallback(() => {
    updateConfig('inputFile', null)
    if (config.outputFile && config.outputFile.endsWith('.srt')) {
      updateConfig('outputFile', null)
    }
  }, [updateConfig, config.outputFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      const supportedTypes = [
        'video/', 'audio/',
        '.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv',
        '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'
      ]
      
      const isSupported = supportedTypes.some(type => 
        file.type.startsWith(type) || file.name.toLowerCase().endsWith(type.replace('.', ''))
      )
      
      if (isSupported) {
        updateConfig('inputFile', file.path)
        
        if (!config.outputFile) {
          const outputPath = file.path.replace(/\.[^/.]+$/, '.srt')
          updateConfig('outputFile', outputPath)
        }
        
        showNotification('File selected successfully', 'success')
      } else {
        showNotification('Unsupported file type', 'error')
      }
    }
  }, [updateConfig, config.outputFile, showNotification])

  const getFileName = (filePath: string | null): string | null => {
    if (!filePath) return null
    return filePath.split(/[\\/]/).pop() || null
  }

  const getFileIcon = (filePath: string | null) => {
    if (!filePath) return <FileIcon />
    const ext = filePath.split('.').pop()?.toLowerCase()
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv']
    const audioExts = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg']
    
    if (videoExts.includes(ext || '')) return <VideoIcon />
    if (audioExts.includes(ext || '')) return <AudioIcon />
    return <FileIcon />
  }

  const getFileType = (filePath: string | null): string => {
    if (!filePath) return 'No file selected'
    const ext = filePath.split('.').pop()?.toLowerCase()
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv']
    const audioExts = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg']
    
    if (videoExts.includes(ext || '')) return 'Video File'
    if (audioExts.includes(ext || '')) return 'Audio File'
    return 'Media File'
  }

  return (
    <Box>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          mb: 2, 
          fontWeight: 500,
          color: 'text.primary',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5
        }}
      >
        Select Audio/Video File
        <Chip label="Required" size="small" color="primary" variant="outlined" />
      </Typography>

      {/* Drag & Drop Area */}
      <Paper
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          p: 3,
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragOver ? 'primary.main' : 'grey.300',
          backgroundColor: isDragOver ? 'primary.50' : 'background.paper',
          transition: 'all 0.2s ease-in-out',
          cursor: 'pointer',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'primary.50'
          }
        }}
        onClick={handleFileSelect}
      >
        {config.inputFile ? (
          // Selected File Display
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: 'primary.main', fontSize: 40 }}>
                  {getFileIcon(config.inputFile)}
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    {getFileName(config.inputFile)}
                  </Typography>
                  <Chip 
                    label={getFileType(config.inputFile)} 
                    size="small" 
                    color="success"
                    variant="outlined"
                  />
                </Box>
              </Box>
              <IconButton 
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFile()
                }}
                color="error"
                size="small"
              >
                <ClearIcon />
              </IconButton>
            </Box>
            
            <Alert severity="success" sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {config.inputFile}
              </Typography>
            </Alert>
          </Stack>
        ) : (
          // Empty State
          <Stack alignItems="center" spacing={2}>
            <UploadIcon 
              sx={{ 
                fontSize: 64, 
                color: isDragOver ? 'primary.main' : 'grey.400' 
              }} 
            />
            <Box textAlign="center">
              <Typography variant="h6" sx={{ mb: 1, color: 'text.primary' }}>
                {isDragOver ? 'Drop your file here' : 'Choose or drag your file here'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supported formats: MP4, AVI, MOV, MP3, WAV, FLAC, and more
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              startIcon={<UploadIcon />}
              sx={{ mt: 2 }}
              onClick={(e) => e.stopPropagation()}
            >
              Browse Files
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  )
}