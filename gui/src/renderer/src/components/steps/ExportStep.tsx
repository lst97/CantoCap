import React, { useState } from 'react'
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material'
import { 
  Download as DownloadIcon,
  FilePresent as FileIcon,
  History as HistoryIcon,
  Preview as PreviewIcon
} from '@mui/icons-material'

interface ExportFormat {
  id: string
  name: string
  extension: string
  description: string
  features: string[]
}

interface ExportHistoryItem {
  id: string
  fileName: string
  format: string
  timestamp: string
  size: string
}

const FormatSelector: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState('srt')
  
  const formats: ExportFormat[] = [
    { 
      id: 'srt', 
      name: 'SubRip (SRT)', 
      extension: '.srt',
      description: 'Most widely supported subtitle format',
      features: ['Universal compatibility', 'Simple text format', 'Timestamp support']
    },
    { 
      id: 'vtt', 
      name: 'WebVTT (VTT)', 
      extension: '.vtt',
      description: 'Modern web subtitle format',
      features: ['Web optimized', 'Styling support', 'Chapter markers']
    },
    { 
      id: 'ass', 
      name: 'Advanced SSA (ASS)', 
      extension: '.ass',
      description: 'Advanced subtitle format with styling',
      features: ['Advanced styling', 'Positioning', 'Effects support']
    },
    { 
      id: 'json', 
      name: 'JSON Data', 
      extension: '.json',
      description: 'Machine-readable format for developers',
      features: ['Structured data', 'API friendly', 'Metadata included']
    }
  ]

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Export Format
      </Typography>
      
      <RadioGroup value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)}>
        <Stack spacing={2}>
          {formats.map((format) => (
            <Paper 
              key={format.id}
              sx={{ 
                p: 2, 
                border: 1,
                borderColor: selectedFormat === format.id ? 'primary.main' : 'divider',
                backgroundColor: selectedFormat === format.id ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
              }}
            >
              <FormControlLabel
                value={format.id}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {format.name} <Chip label={format.extension} size="small" sx={{ ml: 1 }} />
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {format.description}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {format.features.map((feature) => (
                        <Chip key={feature} label={feature} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                }
                sx={{ width: '100%', alignItems: 'flex-start' }}
              />
            </Paper>
          ))}
        </Stack>
      </RadioGroup>
    </Paper>
  )
}

const LanguageOptions: React.FC = () => (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h6" sx={{ mb: 2 }}>
      Language Options
    </Typography>
    
    <Stack spacing={2}>
      <FormControlLabel
        control={<Checkbox defaultChecked />}
        label="Include Cantonese Text"
      />
      <FormControlLabel
        control={<Checkbox defaultChecked />}
        label="Include English Translation"
      />
      <FormControlLabel
        control={<Checkbox />}
        label="Include Confidence Scores"
      />
      <FormControlLabel
        control={<Checkbox />}
        label="Include Timestamp Metadata"
      />
    </Stack>
  </Paper>
)

const ExportActions: React.FC = () => (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h6" sx={{ mb: 2 }}>
      Export Actions
    </Typography>
    
    <Stack spacing={2}>
      <Button
        variant="contained"
        startIcon={<DownloadIcon />}
        size="large"
        fullWidth
      >
        Export Subtitles
      </Button>
      
      <Button
        variant="outlined"
        startIcon={<PreviewIcon />}
        fullWidth
      >
        Preview Export
      </Button>
      
      <Divider />
      
      <Typography variant="subtitle2">Additional Options:</Typography>
      
      <Button
        variant="outlined"
        size="small"
        fullWidth
      >
        Export Multiple Formats
      </Button>
      
      <Button
        variant="outlined"
        size="small"
        fullWidth
      >
        Save Export Template
      </Button>
    </Stack>
  </Paper>
)

const ExportPreview: React.FC = () => (
  <Paper sx={{ p: 3, height: 'fit-content' }}>
    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <PreviewIcon color="primary" />
      Export Preview
    </Typography>
    
    <Box sx={{ 
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      p: 2,
      borderRadius: 1,
      fontFamily: 'monospace',
      fontSize: '0.75rem',
      color: 'grey.300',
      mb: 2,
      maxHeight: 200,
      overflow: 'auto'
    }}>
      <pre>{`1
00:00:12,000 --> 00:00:18,000
你好，歡迎收看今日嘅新聞
Hello, welcome to today's news

2
00:00:18,000 --> 00:00:24,000
今日天氣非常之好
The weather is very good today

3
00:00:24,000 --> 00:00:30,000
預計會有陽光普照
Sunny weather is expected`}</pre>
    </Box>
    
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">Format:</Typography>
        <Typography variant="body2">SubRip (SRT)</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">File Size:</Typography>
        <Typography variant="body2">~2.4 KB</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">Entries:</Typography>
        <Typography variant="body2">3 subtitles</Typography>
      </Box>
    </Stack>
  </Paper>
)

const ExportHistory: React.FC = () => {
  const history: ExportHistoryItem[] = [
    { id: '1', fileName: 'news-video-subtitles.srt', format: 'SRT', timestamp: '2 minutes ago', size: '2.4 KB' },
    { id: '2', fileName: 'interview-captions.vtt', format: 'VTT', timestamp: '1 hour ago', size: '3.1 KB' },
    { id: '3', fileName: 'presentation-subs.json', format: 'JSON', timestamp: 'Yesterday', size: '5.2 KB' }
  ]

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon color="primary" />
        Recent Exports
      </Typography>
      
      <List dense>
        {history.map((item) => (
          <ListItem key={item.id} sx={{ px: 0 }}>
            <ListItemIcon>
              <FileIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={item.fileName}
              secondary={`${item.format} • ${item.size} • ${item.timestamp}`}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  )
}

export const ExportStep: React.FC = () => {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3, height: '100%', p: 3 }}>
      {/* Export Options */}
      <Box>
        <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon color="primary" />
          Export Configuration
        </Typography>
        <Stack spacing={3}>
          <FormatSelector />
          <LanguageOptions />
          <ExportActions />
        </Stack>
      </Box>
      
      {/* Export Preview and History */}
      <Box>
        <ExportPreview />
        <ExportHistory />
      </Box>
    </Box>
  )
}