import React, { useState } from 'react'
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  IconButton,
  Stack,
  Divider
} from '@mui/material'
import { 
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Undo as UndoIcon,
  VolumeUp as VolumeIcon
} from '@mui/icons-material'

interface Subtitle {
  id: string
  timestamp: string
  startTime: number
  endTime: number
  cantonese: string
  english: string
  confidence: number
}

const VideoPlayer: React.FC = () => (
  <Paper sx={{ p: 2, height: 'fit-content' }}>
    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <VolumeIcon color="primary" />
      Video Preview
    </Typography>
    
    {/* Video placeholder */}
    <Box sx={{ 
      width: '100%', 
      aspectRatio: '16/9', 
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      mb: 2
    }}>
      <Typography variant="h6" color="text.secondary">
        Video Player
      </Typography>
    </Box>
    
    {/* Video controls */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton color="primary">
        <PlayIcon />
      </IconButton>
      <Typography variant="body2" sx={{ flex: 1 }}>
        00:01:23 / 00:03:45
      </Typography>
      <Button variant="outlined" size="small">
        Jump to Selected
      </Button>
    </Box>
    
    {/* Current subtitle display */}
    <Paper sx={{ p: 2, mt: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
      <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
        你好，歡迎收看今日嘅新聞
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Hello, welcome to today&apos;s news
      </Typography>
    </Paper>
  </Paper>
)

const SubtitleEditor: React.FC = () => {
  const [editingSubtitle] = useState<Subtitle | null>(null)

  return (
    <Paper sx={{ p: 3, height: 'fit-content' }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon color="primary" />
        Edit Subtitle
      </Typography>
      
      {editingSubtitle ? (
        <Stack spacing={2}>
          <TextField
            label="Timestamp"
            value={editingSubtitle.timestamp}
            size="small"
            fullWidth
          />
          <TextField
            label="Cantonese Text"
            value={editingSubtitle.cantonese}
            multiline
            rows={3}
            size="small"
            fullWidth
          />
          <TextField
            label="English Translation"
            value={editingSubtitle.english}
            multiline
            rows={3}
            size="small"
            fullWidth
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<SaveIcon />} size="small" sx={{ flex: 1 }}>
              Save Changes
            </Button>
            <Button variant="outlined" startIcon={<UndoIcon />} size="small">
              Cancel
            </Button>
          </Box>
          
          <Divider />
          
          <Typography variant="subtitle2">Quick Actions:</Typography>
          <Stack spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} size="small" fullWidth>
              Regenerate This Subtitle
            </Button>
            <Button variant="outlined" size="small" fullWidth>
              Split at Current Time
            </Button>
            <Button variant="outlined" size="small" fullWidth>
              Merge with Next
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: 200,
          border: 2,
          borderStyle: 'dashed',
          borderColor: 'divider',
          borderRadius: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <EditIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Select a subtitle from the list to edit
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

const SubtitleList: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  // Mock data - would come from your store
  const subtitles: Subtitle[] = [
    {
      id: '1',
      timestamp: '00:00:12',
      startTime: 12,
      endTime: 18,
      cantonese: '你好，歡迎收看今日嘅新聞',
      english: 'Hello, welcome to today\'s news',
      confidence: 95
    },
    {
      id: '2',
      timestamp: '00:00:18',
      startTime: 18,
      endTime: 24,
      cantonese: '今日天氣非常之好',
      english: 'The weather is very good today',
      confidence: 88
    },
    {
      id: '3',
      timestamp: '00:00:24',
      startTime: 24,
      endTime: 30,
      cantonese: '預計會有陽光普照',
      english: 'Sunny weather is expected',
      confidence: 92
    }
  ]

  return (
    <Paper sx={{ p: 2, height: '500px', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6">Generated Subtitles</Typography>
        <Chip label={subtitles.length} size="small" />
      </Box>
      
      <List dense>
        {subtitles.map((subtitle) => (
          <ListItemButton
            key={subtitle.id}
            selected={selectedId === subtitle.id}
            onClick={() => setSelectedId(subtitle.id)}
            sx={{
              border: 1,
              borderColor: selectedId === subtitle.id ? 'primary.main' : 'divider',
              borderRadius: 1,
              mb: 1,
              '&.Mui-selected': {
                backgroundColor: 'rgba(245, 158, 11, 0.1)'
              }
            }}
          >
            <ListItemText
              primary={
                <Box>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Chip label={subtitle.timestamp} size="small" variant="outlined" />
                    <Chip 
                      label={`${subtitle.confidence}%`} 
                      size="small" 
                      color={subtitle.confidence > 90 ? "success" : subtitle.confidence > 80 ? "warning" : "error"}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                    {subtitle.cantonese}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {subtitle.english}
                  </Typography>
                </Box>
              }
            />
          </ListItemButton>
        ))}
      </List>
      
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} size="small" fullWidth>
          Regenerate All
        </Button>
        <Button variant="outlined" size="small" fullWidth>
          Export Current
        </Button>
      </Box>
    </Paper>
  )
}

export const ReviewStep: React.FC = () => {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, height: '100%', p: 3 }}>
      {/* Subtitle List */}
      <Box>
        <SubtitleList />
      </Box>
      
      {/* Video Player with Subtitles */}
      <Box>
        <VideoPlayer />
      </Box>
      
      {/* Edit Panel */}
      <Box>
        <SubtitleEditor />
      </Box>
    </Box>
  )
}