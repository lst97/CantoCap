import React from 'react'
import { Box, Card, CardContent, Typography, Button } from '@mui/material'
import { Settings, ChevronLeft } from '@mui/icons-material'
import { useAppStore } from '../../store/app-store'

export const AdvancedPanelPlaceholder = () => {
  const { toggleAdvanced } = useAppStore()

  return (
    <Card
      sx={{
        width: '100%',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(245, 158, 11, 0.08) 100%)',
        border: '2px dashed rgba(245, 158, 11, 0.2)',
        borderRadius: 3,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        alignSelf: 'flex-start',
        '&:hover': {
          borderColor: 'rgba(245, 158, 11, 0.4)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.12) 100%)',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px rgba(245, 158, 11, 0.15)'
        }
      }}
    >
      <CardContent sx={{ textAlign: 'center', p: 4 }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            mb: 3,
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
          }}
        >
          <Settings sx={{ fontSize: 40, color: 'white' }} />
        </Box>
        
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            mb: 2,
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textAlign: 'center'
          }}
        >
          Advanced Settings
        </Typography>
        
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 3, lineHeight: 1.6 }}
        >
          Configure model parameters, processing options, and system settings for enhanced control over your transcription workflow.
        </Typography>
        
        <Button
          variant="contained"
          size="large"
          onClick={toggleAdvanced}
          startIcon={<ChevronLeft />}
          sx={{
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            color: 'white',
            fontWeight: 600,
            px: 3,
            py: 1.5,
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
              transform: 'translateY(-1px)',
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)'
            }
          }}
        >
          Show Advanced Options
        </Button>
        
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(245, 158, 11, 0.1)' }}>
          <Typography variant="caption" color="text.secondary">
            Features: Model Selection • Processing Options • System Monitoring
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}