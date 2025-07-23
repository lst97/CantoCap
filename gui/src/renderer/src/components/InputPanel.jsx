import React from 'react'
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Stack,
  Divider
} from '@mui/material'
import { FolderOpen as FolderIcon } from '@mui/icons-material'
import { FileSelector } from './FileSelector'
import { OutputSelector } from './OutputSelector'
import { QuickOptions } from './QuickOptions'
import { CharsetSelector } from './CharsetSelector'
import { APIKeyInput } from './APIKeyInput'
import { TranslationSelector } from './TranslationSelector'

export const InputPanel = () => {
  return (
    <Card 
      elevation={2}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <CardContent sx={{ flex: 1, p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <FolderIcon color="primary" sx={{ fontSize: 24 }} />
          <Typography 
            variant="h6" 
            component="h2"
            sx={{ 
              fontWeight: 600,
              color: 'text.primary'
            }}
          >
            Input & Basic Settings
          </Typography>
        </Box>

        {/* Content */}
        <Stack spacing={3} sx={{ flex: 1 }}>
          <Box>
            <FileSelector />
          </Box>
          
          <Divider />
          
          <Box>
            <OutputSelector />
          </Box>
          
          <Box>
            <QuickOptions />
          </Box>
          
          <Box>
            <CharsetSelector />
          </Box>
          
          <Divider />
          
          <Box>
            <APIKeyInput />
          </Box>
          
          <Box>
            <TranslationSelector />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}