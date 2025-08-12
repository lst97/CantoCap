import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Chip,
  Paper
} from '@mui/material'
import {
  SmartToy as ModelIcon,
  Speed as SpeedIcon,
  Language as LanguageIcon,
  Star as StarIcon
} from '@mui/icons-material'
import { useAppStore } from '../../stores/useAppStore'

interface OptionType {
  value: string
  label: string
  description: string
  recommended?: boolean
  performance?: 'fast' | 'balanced' | 'quality'
  experimental?: boolean
}

export const ModelSettings: React.FC = () => {
  const { config, updateConfig } = useAppStore()

  const handleModelChange = useCallback((e: any) => {
    updateConfig('model', e.target.value === 'auto' ? null : e.target.value)
  }, [updateConfig])

  const handlePriorityChange = useCallback((e: any) => {
    updateConfig('priority', e.target.value)
  }, [updateConfig])

  const handleLanguageChange = useCallback((e: any) => {
    updateConfig('language', e.target.value)
  }, [updateConfig])

  const modelOptions: OptionType[] = [
    { 
      value: 'auto', 
      label: 'Auto-select', 
      description: 'Automatically choose the best OpenAI model for your hardware',
      recommended: true,
      performance: 'balanced'
    },
    { 
      value: 'openai/whisper-large-v3', 
      label: 'OpenAI Whisper Large v3', 
      description: 'Best accuracy for Cantonese transcription (recommended)',
      performance: 'quality',
      recommended: true
    },
    { 
      value: 'openai/whisper-medium', 
      label: 'OpenAI Whisper Medium', 
      description: 'Good accuracy for Cantonese, balanced speed',
      performance: 'balanced'
    },
    { 
      value: 'openai/whisper-small', 
      label: 'OpenAI Whisper Small', 
      description: 'Fast processing, basic accuracy for Cantonese',
      performance: 'fast'
    },
    { 
      value: 'whisperX/large-v3', 
      label: 'WhisperX Large v3', 
      description: 'Lower accuracy for Cantonese than OpenAI, but faster processing. Backup model only.',
      performance: 'fast',
      experimental: true
    }
  ]

  const priorityOptions: OptionType[] = [
    { 
      value: 'speed', 
      label: 'Speed Priority', 
      description: 'Prioritize fast processing over accuracy',
      performance: 'fast'
    },
    { 
      value: 'balanced', 
      label: 'Balanced Mode', 
      description: 'Balance between speed and accuracy',
      performance: 'balanced',
      recommended: true
    },
    { 
      value: 'quality', 
      label: 'Quality Priority', 
      description: 'Prioritize accuracy over processing speed',
      performance: 'quality'
    }
  ]

  const languageOptions: OptionType[] = [
    { 
      value: 'zh', 
      label: 'Chinese (zh)', 
      description: 'Optimized for Chinese language detection',
      recommended: true
    },
    { 
      value: 'auto', 
      label: 'Auto-detect', 
      description: 'Automatically detect language from audio (extra processing time)'
    }
  ]

  const getPerformanceChip = (performance?: string) => {
    if (!performance) return null
    
    const colors = {
      fast: { bg: 'rgba(87, 242, 135, 0.15)', color: '#57F287', label: 'Fast' },
      balanced: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', label: 'Balanced' },
      quality: { bg: 'rgba(125, 211, 252, 0.15)', color: '#7DD3FC', label: 'Quality' }
    }
    
    const style = colors[performance as keyof typeof colors]
    if (!style) return null
    
    return (
      <Chip
        label={style.label}
        size="small"
        sx={{
          fontSize: '0.65rem',
          height: 20,
          backgroundColor: style.bg,
          color: style.color,
          border: `1px solid ${style.color}30`,
          fontWeight: 500
        }}
      />
    )
  }

  const renderOption = (options: OptionType[], value: string) => {
    const option = options.find(opt => opt.value === value)
    return option ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">{option.label}</Typography>
        {option.recommended && (
          <Chip
            icon={<StarIcon sx={{ fontSize: '0.7rem !important' }} />}
            label="Recommended"
            size="small"
            color="primary"
            sx={{
              fontSize: '0.65rem',
              height: 20,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#F59E0B'
            }}
          />
        )}
        {option.experimental && (
          <Chip
            label="Experimental"
            size="small"
            sx={{
              fontSize: '0.65rem',
              height: 20,
              backgroundColor: 'rgba(255, 152, 0, 0.15)',
              color: '#FF9800',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              fontWeight: 600,
            }}
          />
        )}
        {getPerformanceChip(option.performance)}
      </Box>
    ) : null
  }

  const SettingGroup: React.FC<{
    icon: React.ReactNode
    title: string
    description: string
    children: React.ReactNode
  }> = ({ icon, title, description, children }) => (
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
      </Box>
      {children}
    </Paper>
  )

  return (
    <Stack spacing={3}>
      <SettingGroup
        icon={<ModelIcon color="primary" fontSize="small" />}
        title="Model Selection"
        description="Choose the AI model that best fits your hardware and accuracy needs"
      >
        <FormControl fullWidth size="small">
          <Select
            value={config.model || 'auto'}
            onChange={handleModelChange}
            displayEmpty
            renderValue={(value) => renderOption(modelOptions, value as string)}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2F3136',
                  '& .MuiMenuItem-root': {
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: '#36393F',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(245, 158, 11, 0.3)',
                      },
                    },
                  },
                },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#2F3136',
                '& fieldset': {
                  borderColor: '#40444B',
                },
                '&:hover fieldset': {
                  borderColor: '#5865F2',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865F2',
                  boxShadow: '0 0 0 3px rgba(88, 101, 242, 0.1)',
                },
              },
              '& .MuiSelect-select': {
                backgroundColor: '#2F3136 !important',
                color: '#DCDDDE',
                padding: '12px',
                fontSize: '14px',
              },
              '& .MuiSelect-icon': {
                color: '#96989D',
              },
            }}
          >
            {modelOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.label}
                    </Typography>
                    {option.recommended && (
                      <Chip
                        icon={<StarIcon sx={{ fontSize: '0.7rem !important' }} />}
                        label="Recommended"
                        size="small"
                        color="primary"
                        sx={{
                          fontSize: '0.65rem',
                          height: 18,
                          backgroundColor: 'rgba(245, 158, 11, 0.2)',
                          color: '#F59E0B'
                        }}
                      />
                    )}
                    {option.experimental && (
                      <Chip
                        label="Experimental"
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 18,
                          backgroundColor: 'rgba(255, 152, 0, 0.15)',
                          color: '#FF9800',
                          border: '1px solid rgba(255, 152, 0, 0.3)',
                          fontWeight: 600,
                        }}
                      />
                    )}
                    {getPerformanceChip(option.performance)}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {option.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </SettingGroup>

      <SettingGroup
        icon={<SpeedIcon color="primary" fontSize="small" />}
        title="Processing Priority"
        description="Balance between processing speed and transcription accuracy"
      >
        <FormControl fullWidth size="small">
          <Select
            value={config.priority}
            onChange={handlePriorityChange}
            displayEmpty
            renderValue={(value) => renderOption(priorityOptions, value as string)}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2F3136',
                  '& .MuiMenuItem-root': {
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: '#36393F',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(245, 158, 11, 0.3)',
                      },
                    },
                  },
                },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#2F3136',
                '& fieldset': {
                  borderColor: '#40444B',
                },
                '&:hover fieldset': {
                  borderColor: '#5865F2',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865F2',
                  boxShadow: '0 0 0 3px rgba(88, 101, 242, 0.1)',
                },
              },
              '& .MuiSelect-select': {
                backgroundColor: '#2F3136 !important',
                color: '#DCDDDE',
                padding: '12px',
                fontSize: '14px',
              },
              '& .MuiSelect-icon': {
                color: '#96989D',
              },
            }}
          >
            {priorityOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.label}
                    </Typography>
                    {option.recommended && (
                      <Chip
                        icon={<StarIcon sx={{ fontSize: '0.7rem !important' }} />}
                        label="Recommended"
                        size="small"
                        color="primary"
                        sx={{
                          fontSize: '0.65rem',
                          height: 18,
                          backgroundColor: 'rgba(245, 158, 11, 0.2)',
                          color: '#F59E0B'
                        }}
                      />
                    )}
                    {getPerformanceChip(option.performance)}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {option.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </SettingGroup>

      <SettingGroup
        icon={<LanguageIcon color="primary" fontSize="small" />}
        title="Language Detection"
        description="Configure language detection for optimal transcription accuracy"
      >
        <FormControl fullWidth size="small">
          <Select
            value={config.language}
            onChange={handleLanguageChange}
            displayEmpty
            renderValue={(value) => renderOption(languageOptions, value as string)}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2F3136',
                  '& .MuiMenuItem-root': {
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: '#36393F',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(245, 158, 11, 0.3)',
                      },
                    },
                  },
                },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#2F3136',
                '& fieldset': {
                  borderColor: '#40444B',
                },
                '&:hover fieldset': {
                  borderColor: '#5865F2',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#5865F2',
                  boxShadow: '0 0 0 3px rgba(88, 101, 242, 0.1)',
                },
              },
              '& .MuiSelect-select': {
                backgroundColor: '#2F3136 !important',
                color: '#DCDDDE',
                padding: '12px',
                fontSize: '14px',
              },
              '& .MuiSelect-icon': {
                color: '#96989D',
              },
            }}
          >
            {languageOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.label}
                    </Typography>
                    {option.recommended && (
                      <Chip
                        icon={<StarIcon sx={{ fontSize: '0.7rem !important' }} />}
                        label="Recommended"
                        size="small"
                        color="primary"
                        sx={{
                          fontSize: '0.65rem',
                          height: 18,
                          backgroundColor: 'rgba(245, 158, 11, 0.2)',
                          color: '#F59E0B'
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {option.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </SettingGroup>
    </Stack>
  )
}