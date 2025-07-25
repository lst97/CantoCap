import React from 'react'
import { 
  Box, 
  Typography, 
  LinearProgress, 
  Paper, 
  Button, 
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import { 
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon
} from '@mui/icons-material'
import { ProgressPanel } from '../ProgressPanel'

interface ProcessingStage {
  id: string
  name: string
  isCompleted: boolean
  isActive: boolean
  description: string
}

const ProcessingActions: React.FC = () => (
  <Paper sx={{ p: 3, height: 'fit-content' }}>
    <Typography variant="h6" sx={{ mb: 2 }}>
      Processing Controls
    </Typography>
    
    <Stack spacing={2}>
      <Button 
        variant="contained" 
        startIcon={<StopIcon />} 
        color="error"
        fullWidth
      >
        Cancel Processing
      </Button>
      
      <Button 
        variant="outlined" 
        startIcon={<RefreshIcon />}
        fullWidth
        disabled
      >
        Restart Processing
      </Button>
      
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          System Resources
        </Typography>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MemoryIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              GPU: NVIDIA RTX 3080
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SpeedIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              Processing Speed: 2.3x realtime
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Stack>
  </Paper>
)

const LiveOutput: React.FC = () => {
  const stages: ProcessingStage[] = [
    { id: 'audio-extract', name: 'Audio Extraction', isCompleted: true, isActive: false, description: 'Extracting audio from video file' },
    { id: 'transcription', name: 'Speech Recognition', isCompleted: false, isActive: true, description: 'Converting speech to text' },
    { id: 'translation', name: 'Translation', isCompleted: false, isActive: false, description: 'Translating to English' },
    { id: 'refinement', name: 'AI Refinement', isCompleted: false, isActive: false, description: 'Improving accuracy with AI' },
    { id: 'formatting', name: 'Format Generation', isCompleted: false, isActive: false, description: 'Creating subtitle files' }
  ]

  return (
    <Paper sx={{ p: 3, height: 'fit-content' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Processing Stages
      </Typography>
      
      <List dense>
        {stages.map((stage) => (
          <ListItem key={stage.id} sx={{ px: 0 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {stage.isCompleted ? (
                <CheckIcon color="success" fontSize="small" />
              ) : stage.isActive ? (
                <RefreshIcon color="primary" fontSize="small" sx={{ animation: 'spin 2s linear infinite' }} />
              ) : (
                <PendingIcon color="disabled" fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: stage.isActive ? 600 : 400 }}>
                    {stage.name}
                  </Typography>
                  {stage.isActive && <Chip label="Active" size="small" color="primary" />}
                  {stage.isCompleted && <Chip label="Done" size="small" color="success" />}
                </Box>
              }
              secondary={stage.description}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  )
}

export const ProcessingStep: React.FC = () => {
  const progress = 65 // This would come from your processing state

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%', p: 3 }}>
      {/* Progress Header */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Generating Subtitles
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Processing your media file... This may take a few minutes.
        </Typography>
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 12, 
              borderRadius: 6,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 6
              }
            }} 
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {progress}% Complete
          </Typography>
        </Box>
      </Box>
      
      {/* Live Output and Controls */}
      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        <LiveOutput />
        <ProcessingActions />
      </Box>
      
      {/* Include existing ProgressPanel for detailed progress */}
      <ProgressPanel />
    </Box>
  )
}