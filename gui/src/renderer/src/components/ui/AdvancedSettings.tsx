import React, { useCallback, useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Button,
  IconButton,
  Stack,
  Paper,
  Grid,
  Collapse,
  Alert,
  Slider,
  InputAdornment
} from '@mui/material'
import {
  Timer as TimerIcon,
  VideoSettings as VideoIcon,
  Folder as FileIcon,
  Build as FFmpegIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Clear as ClearIcon,
  Warning as WarningIcon,
  Memory as WorkersIcon,
  AutoAwesome as AdaptiveIcon,
  SmartToy as AIIcon
} from '@mui/icons-material'
import { useConfigStepContent, useStepActions } from '../../stores/useStepStore'
import type { ChunkingStrategy } from '../../stores/types/StoreTypes'

interface OptionType {
  value: string
  label: string
  description: string
}

export const AdvancedSettings: React.FC = () => {
  const config = useConfigStepContent()
  const { updateStepContent } = useStepActions()
  
  const updateConfig = useCallback((key: string, value: unknown) => {
    updateStepContent('config', { [key]: value })
  }, [updateStepContent])
  
  const updateAdvancedSetting = useCallback((key: string, value: unknown) => {
    updateStepContent('config', { 
      advancedSettings: { 
        ...config.advancedSettings, 
        [key]: value 
      } 
    })
  }, [updateStepContent, config.advancedSettings])
  
  const updateChunkingStrategy = useCallback((updates: Partial<ChunkingStrategy>) => {
    const currentStrategy = config.advancedSettings?.chunkingStrategy || {
      whisperChunkDuration: 30,
      whisperOverlap: 5,
      geminiChunkDuration: 900, // 15 minutes
      geminiOverlap: 30
    }
    
    updateAdvancedSetting('chunkingStrategy', {
      ...currentStrategy,
      ...updates
    })
  }, [updateAdvancedSetting, config.advancedSettings?.chunkingStrategy])
  
  const showNotification = useCallback((message: string, type: string = 'info') => {
    console.log(`Notification [${type}]:`, message)
  }, [])
  
  const [showFFmpegPath, setShowFFmpegPath] = useState(false)

  const handleNumericChange = useCallback((key: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      updateConfig(key, numValue)
    }
  }, [updateConfig])

  const handleSelectChange = useCallback((key: string, value: string) => {
    updateConfig(key, value)
  }, [updateConfig])

  const handleConfigFileSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        updateConfig('terminologyConfig', result.filePaths[0])
        showNotification('Configuration file selected', 'success')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showNotification(`Failed to select config file: ${errorMessage}`, 'error')
    }
  }, [updateConfig, showNotification])

  const handleFFmpegPathSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          { name: 'Executable Files', extensions: ['exe', ''] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        updateConfig('ffmpegPath', result.filePaths[0])
        showNotification('FFmpeg path selected', 'success')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showNotification(`Failed to select FFmpeg path: ${errorMessage}`, 'error')
    }
  }, [updateConfig, showNotification])

  const clearConfigFile = useCallback(() => {
    updateConfig('terminologyConfig', null)
  }, [updateConfig])

  const clearFFmpegPath = useCallback(() => {
    updateConfig('ffmpegPath', null)
  }, [updateConfig])

  const videoQualityOptions: OptionType[] = [
    { value: '360p', label: '360p (Fast)', description: 'Low quality, faster processing' },
    { value: '480p', label: '480p (Balanced)', description: 'Medium quality and speed' },
    { value: '720p', label: '720p (High)', description: 'High quality, slower processing' }
  ]
  
  
  const chunkingStrategy = config.advancedSettings?.chunkingStrategy || {
    whisperChunkDuration: 30,
    whisperOverlap: 5,
    geminiChunkDuration: 900,
    geminiOverlap: 30
  }

  const getChunkDurationMarks = () => [
    { value: 5, label: '5m' },
    { value: 15, label: '15m' },
    { value: 30, label: '30m' },
    { value: 45, label: '45m' },
    { value: 60, label: '60m' }
  ]

  const SettingGroup: React.FC<{
    icon: React.ReactNode
    title: string
    description: string
    children: React.ReactNode
    warning?: string
  }> = ({ icon, title, description, children, warning }) => (
    <Paper sx={{ 
      p: 3, 
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: 2
    }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          mb: 1,
          fontWeight: 600,
          color: '#DCDDDE'
        }}>
          {icon}
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {description}
        </Typography>
        {warning && (
          <Alert 
            severity="warning" 
            sx={{ 
              mt: 2, 
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              '& .MuiAlert-icon': { color: '#FF9800' }
            }}
          >
            <Typography variant="caption">{warning}</Typography>
          </Alert>
        )}
      </Box>
      {children}
    </Paper>
  )

  return (
    <Stack spacing={3}>
      <SettingGroup
        icon={<TimerIcon color="primary" fontSize="small" />}
        title="Max Chunk Duration"
        description="Maximum duration for processing chunks. Smaller values use less memory but may increase processing time."
      >
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ px: 1, py: 2 }}>
              <Slider
                value={config.maxChunkDuration}
                onChange={(_, value) => updateConfig('maxChunkDuration', value)}
                min={5}
                max={60}
                step={5}
                marks={getChunkDurationMarks()}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value} min`}
                sx={{
                  color: '#F59E0B',
                  height: 8,
                  '& .MuiSlider-thumb': {
                    backgroundColor: '#F59E0B',
                    border: '2px solid #2F3136',
                    width: 20,
                    height: 20,
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: '0 0 0 8px rgba(245, 158, 11, 0.16)',
                    },
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: '#F59E0B',
                    height: 6,
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    height: 6,
                  },
                  '& .MuiSlider-mark': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    width: 3,
                    height: 3,
                  },
                  '& .MuiSlider-markLabel': {
                    color: '#96989D',
                    fontSize: '0.7rem',
                    top: 28,
                  },
                }}
              />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              type="number"
              value={config.maxChunkDuration}
              onChange={(e) => handleNumericChange('maxChunkDuration', e.target.value)}
              inputProps={{ min: 5, max: 60, step: 5 }}
              size="small"
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">minutes</InputAdornment>
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2F3136',
                  '& fieldset': { borderColor: '#40444B' },
                  '&:hover fieldset': { borderColor: '#5865F2' },
                  '&.Mui-focused fieldset': { borderColor: '#5865F2' },
                },
                '& .MuiInputBase-input': { color: '#DCDDDE' },
              }}
            />
          </Grid>
        </Grid>
      </SettingGroup>

      <SettingGroup
        icon={<AdaptiveIcon color="primary" fontSize="small" />}
        title="AI Service Chunking Strategy"
        description="Optimized chunking for both AI services working together. OpenAI Whisper uses 30-second chunks for transcription, while Google Gemini uses 15-minute chunks for refinement and translation with better context understanding."
      >
        <Stack spacing={3}>

          {/* Whisper Chunk Settings */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#DCDDDE' }}>
              OpenAI Whisper (Transcription)
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <Box sx={{ px: 1, py: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Chunk Duration: {chunkingStrategy.whisperChunkDuration}s
                  </Typography>
                  <Slider
                    value={chunkingStrategy.whisperChunkDuration}
                    onChange={(_, value) => updateChunkingStrategy({ whisperChunkDuration: value as number })}
                    min={10}
                    max={60}
                    step={5}
                    marks={[
                      { value: 10, label: '10s' },
                      { value: 30, label: '30s (Optimal)' },
                      { value: 45, label: '45s' },
                      { value: 60, label: '60s' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}s`}
                    sx={{
                      color: '#F59E0B',
                      height: 6,
                      '& .MuiSlider-thumb': {
                        backgroundColor: '#F59E0B',
                        border: '2px solid #2F3136',
                        width: 18,
                        height: 18,
                      },
                      '& .MuiSlider-track': {
                        backgroundColor: '#F59E0B',
                        height: 4,
                      },
                      '& .MuiSlider-rail': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        height: 4,
                      },
                      '& .MuiSlider-markLabel': {
                        color: '#96989D',
                        fontSize: '0.65rem',
                      },
                    }}
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="Overlap"
                  value={chunkingStrategy.whisperOverlap}
                  onChange={(e) => updateChunkingStrategy({ whisperOverlap: parseInt(e.target.value) })}
                  inputProps={{ min: 0, max: 15, step: 1 }}
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">sec</InputAdornment>
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2F3136',
                      '& fieldset': { borderColor: '#40444B' },
                      '&:hover fieldset': { borderColor: '#F59E0B' },
                      '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                      // Hide number input arrows to match dark theme
                      '& input[type=number]': {
                        MozAppearance: 'textfield',
                        '&::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '&::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                      },
                    },
                    '& .MuiInputBase-input': { color: '#DCDDDE' },
                    '& .MuiInputLabel-root': { color: '#96989D' },
                  }}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Gemini Chunk Settings */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#DCDDDE' }}>
              Google Gemini (Refinement & Translation)
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <Box sx={{ px: 1, py: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Chunk Duration: {Math.round(chunkingStrategy.geminiChunkDuration / 60)}min
                  </Typography>
                  <Slider
                    value={chunkingStrategy.geminiChunkDuration / 60}
                    onChange={(_, value) => updateChunkingStrategy({ geminiChunkDuration: (value as number) * 60 })}
                    min={5}
                    max={30}
                    step={5}
                    marks={[
                      { value: 5, label: '5min' },
                      { value: 15, label: '15min (Optimal)' },
                      { value: 20, label: '20min' },
                      { value: 30, label: '30min' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}min`}
                    sx={{
                      color: '#F59E0B',
                      height: 6,
                      '& .MuiSlider-thumb': {
                        backgroundColor: '#F59E0B',
                        border: '2px solid #2F3136',
                        width: 18,
                        height: 18,
                      },
                      '& .MuiSlider-track': {
                        backgroundColor: '#F59E0B',
                        height: 4,
                      },
                      '& .MuiSlider-rail': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        height: 4,
                      },
                      '& .MuiSlider-markLabel': {
                        color: '#96989D',
                        fontSize: '0.65rem',
                      },
                    }}
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="Overlap"
                  value={chunkingStrategy.geminiOverlap}
                  onChange={(e) => updateChunkingStrategy({ geminiOverlap: parseInt(e.target.value) })}
                  inputProps={{ min: 0, max: 120, step: 15 }}
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">sec</InputAdornment>
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2F3136',
                      '& fieldset': { borderColor: '#40444B' },
                      '&:hover fieldset': { borderColor: '#F59E0B' },
                      '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                      // Hide number input arrows to match dark theme
                      '& input[type=number]': {
                        MozAppearance: 'textfield',
                        '&::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '&::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                      },
                    },
                    '& .MuiInputBase-input': { color: '#DCDDDE' },
                    '& .MuiInputLabel-root': { color: '#96989D' },
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </SettingGroup>

      <SettingGroup
        icon={<VideoIcon color="primary" fontSize="small" />}
        title="Video Quality for Analysis"
        description="Quality setting for video analysis. Lower quality processes faster but may affect accuracy for visual cues."
      >
        <FormControl fullWidth size="small">
          <Select
            value={config.videoQuality}
            onChange={(e) => handleSelectChange('videoQuality', e.target.value)}
            displayEmpty
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2F3136',
                  '& .MuiMenuItem-root': {
                    color: 'text.primary',
                    '&:hover': { backgroundColor: '#36393F' },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      '&:hover': { backgroundColor: 'rgba(245, 158, 11, 0.3)' },
                    },
                  },
                },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#2F3136',
                '& fieldset': { borderColor: '#40444B' },
                '&:hover fieldset': { borderColor: '#5865F2' },
                '&.Mui-focused fieldset': { borderColor: '#5865F2' },
              },
              '& .MuiSelect-select': {
                backgroundColor: '#2F3136 !important',
                color: '#DCDDDE',
                padding: '12px',
              },
              '& .MuiSelect-icon': { color: '#96989D' },
            }}
          >
            {videoQualityOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {option.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </SettingGroup>

      <SettingGroup
        icon={<WorkersIcon color="primary" fontSize="small" />}
        title="Worker Threads"
        description="Number of worker threads for parallel processing. Higher values can speed up processing on multi-core systems."
      >
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ px: 1, py: 2 }}>
              <Slider
                value={config.advancedSettings?.numWorkers ?? 4}
                onChange={(_, value) => updateAdvancedSetting('numWorkers', value)}
                min={1}
                max={12}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                  { value: 12, label: '12' }
                ]}
                valueLabelDisplay="auto"
                sx={{
                  color: '#F59E0B',
                  height: 8,
                  '& .MuiSlider-thumb': {
                    backgroundColor: '#F59E0B',
                    border: '2px solid #2F3136',
                    width: 20,
                    height: 20,
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: '0 0 0 8px rgba(245, 158, 11, 0.16)',
                    },
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: '#F59E0B',
                    height: 6,
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    height: 6,
                  },
                  '& .MuiSlider-mark': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    width: 3,
                    height: 3,
                  },
                  '& .MuiSlider-markLabel': {
                    color: '#96989D',
                    fontSize: '0.7rem',
                    top: 28,
                  },
                }}
              />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              type="number"
              value={config.advancedSettings?.numWorkers ?? 4}
              onChange={(e) => updateAdvancedSetting('numWorkers', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 12, step: 1 }}
              size="small"
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">threads</InputAdornment>
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2F3136',
                  '& fieldset': { borderColor: '#40444B' },
                  '&:hover fieldset': { borderColor: '#5865F2' },
                  '&.Mui-focused fieldset': { borderColor: '#5865F2' },
                },
                '& .MuiInputBase-input': { color: '#DCDDDE' },
              }}
            />
          </Grid>
        </Grid>
      </SettingGroup>

      <SettingGroup
        icon={<FileIcon color="primary" fontSize="small" />}
        title="Terminology Configuration"
        description="JSON file with custom terminology and language style rules for improved transcription accuracy."
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            value={config.terminologyConfig || ''}
            placeholder="No configuration file selected"
            size="small"
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: config.terminologyConfig && (
                <InputAdornment position="end">
                  <IconButton onClick={clearConfigFile} size="small" sx={{ color: '#96989D' }}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#2F3136',
                '& fieldset': { borderColor: '#40444B' },
                '&:hover fieldset': { borderColor: '#5865F2' },
              },
              '& .MuiInputBase-input': { 
                color: config.terminologyConfig ? '#DCDDDE' : '#96989D',
                cursor: 'default'
              },
            }}
          />
          <Button
            variant="outlined"
            onClick={handleConfigFileSelect}
            sx={{
              minWidth: 'auto',
              px: 2,
              borderColor: '#40444B',
              color: '#DCDDDE',
              '&:hover': {
                borderColor: '#5865F2',
                backgroundColor: 'rgba(88, 101, 242, 0.1)'
              }
            }}
          >
            Browse
          </Button>
        </Box>
      </SettingGroup>

      <SettingGroup
        icon={<FFmpegIcon color="primary" fontSize="small" />}
        title="Custom FFmpeg Path"
        description="Override system FFmpeg with a custom executable path. Only needed if FFmpeg is not in your system PATH."
        warning="Only modify this if you're experiencing FFmpeg-related issues or need a specific version."
      >
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setShowFFmpegPath(!showFFmpegPath)}
            startIcon={showFFmpegPath ? <CollapseIcon /> : <ExpandIcon />}
            sx={{
              borderColor: '#40444B',
              color: '#DCDDDE',
              '&:hover': {
                borderColor: '#5865F2',
                backgroundColor: 'rgba(88, 101, 242, 0.1)'
              }
            }}
          >
            {showFFmpegPath ? 'Hide' : 'Show'} FFmpeg Path Settings
          </Button>
        </Box>
        
        <Collapse in={showFFmpegPath}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              value={config.ffmpegPath || ''}
              placeholder="Use system FFmpeg (recommended)"
              size="small"
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: config.ffmpegPath && (
                  <InputAdornment position="end">
                    <IconButton onClick={clearFFmpegPath} size="small" sx={{ color: '#96989D' }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2F3136',
                  '& fieldset': { borderColor: '#40444B' },
                  '&:hover fieldset': { borderColor: '#5865F2' },
                },
                '& .MuiInputBase-input': { 
                  color: config.ffmpegPath ? '#DCDDDE' : '#96989D',
                  cursor: 'default'
                },
              }}
            />
            <Button
              variant="outlined"
              onClick={handleFFmpegPathSelect}
              sx={{
                minWidth: 'auto',
                px: 2,
                borderColor: '#40444B',
                color: '#DCDDDE',
                '&:hover': {
                  borderColor: '#5865F2',
                  backgroundColor: 'rgba(88, 101, 242, 0.1)'
                }
              }}
            >
              Browse
            </Button>
          </Box>
        </Collapse>
      </SettingGroup>

      <Alert 
        severity="info" 
        icon={<WarningIcon />}
        sx={{ 
          backgroundColor: 'rgba(125, 211, 252, 0.1)',
          border: '1px solid rgba(125, 211, 252, 0.3)',
          '& .MuiAlert-icon': { color: '#7DD3FC' }
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          AI Service Chunking Benefits
        </Typography>
        <Typography variant="body2">
          The unified chunking system optimizes processing for both AI services working together:
        </Typography>
        <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
          <Typography component="li" variant="body2" sx={{ fontSize: '0.85rem' }}>
            <strong>OpenAI Whisper (30s chunks):</strong> Optimal for speech-to-text transcription with balanced accuracy
          </Typography>
          <Typography component="li" variant="body2" sx={{ fontSize: '0.85rem' }}>
            <strong>Google Gemini (15min chunks):</strong> Leverages large context for transcription refinement and translation
          </Typography>
          <Typography component="li" variant="body2" sx={{ fontSize: '0.85rem' }}>
            <strong>Unified processing:</strong> Both services automatically use their optimal chunk sizes for best results
          </Typography>
        </Box>
      </Alert>
    </Stack>
  )
}