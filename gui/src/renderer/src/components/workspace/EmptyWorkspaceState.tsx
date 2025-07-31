/**
 * EmptyWorkspaceState Component
 * Welcome screen for new users with no workspaces
 * Provides onboarding guidance and workspace creation
 */

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Chip,
  Fade,
  useTheme,
  alpha
} from '@mui/material'
import {
  Add as AddIcon,
  VideoLibrary as VideoIcon,
  Subtitles as SubtitlesIcon,
  Speed as SpeedIcon,
  CloudUpload as UploadIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { WorkspaceCreationDialog } from './WorkspaceCreationDialog'

interface EmptyWorkspaceStateProps {
  onCreateWorkspace: (name: string, copyFromId?: string) => Promise<void>
  isLoading?: boolean
}

export const EmptyWorkspaceState: React.FC<EmptyWorkspaceStateProps> = ({
  onCreateWorkspace,
  isLoading = false
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const theme = useTheme()

  const features = [
    {
      icon: <VideoIcon color="primary" />,
      title: 'Video Processing',
      description: 'Support for multiple video formats with intelligent segmentation'
    },
    {
      icon: <SubtitlesIcon color="primary" />,
      title: 'AI-Powered Subtitles',
      description: 'Generate accurate subtitles with speaker detection and refinement'
    },
    {
      icon: <SpeedIcon color="primary" />,
      title: 'Fast Processing',
      description: 'Optimized workflow with parallel processing and smart caching'
    }
  ]

  const handleCreateWorkspace = async (name: string, copyFromId?: string) => {
    try {
      await onCreateWorkspace(name, copyFromId)
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Failed to create workspace:', error)
      // Error handling will be done by the parent component
    }
  }

  return (
    <>
      <Container maxWidth="md" sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
        <Fade in timeout={800}>
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            {/* Welcome Header */}
            <Box sx={{ mb: 6 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  mb: 3,
                  border: `3px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                <VideoIcon sx={{ fontSize: 64, color: 'primary.main' }} />
              </Box>
              
              <Typography 
                variant="h3" 
                gutterBottom 
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 2
                }}
              >
                Welcome to CantoCap
              </Typography>
              
              <Typography 
                variant="h6" 
                color="text.secondary" 
                sx={{ maxWidth: 500, mx: 'auto', lineHeight: 1.6 }}
              >
                Create your first workspace to start generating AI-powered subtitles for your videos
              </Typography>
            </Box>

            {/* Create Workspace Button */}
            <Box sx={{ mb: 6 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setIsDialogOpen(true)}
                disabled={isLoading}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  boxShadow: theme.shadows[8],
                  '&:hover': {
                    boxShadow: theme.shadows[12],
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Create Your First Workspace
              </Button>
            </Box>

            {/* Features Overview */}
            <Stack spacing={3} sx={{ mb: 6 }}>
              {features.map((feature, index) => (
                <Fade in timeout={800 + (index * 200)} key={feature.title}>
                  <Card
                    elevation={0}
                    sx={{
                      background: alpha(theme.palette.background.paper, 0.6),
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: theme.shadows[4],
                        transform: 'translateY(-2px)',
                        background: alpha(theme.palette.background.paper, 0.8)
                      }
                    }}
                  >
                    <CardContent sx={{ py: 3 }}>
                      <Stack direction="row" spacing={3} alignItems="center">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            backgroundColor: alpha(theme.palette.primary.main, 0.1)
                          }}
                        >
                          {feature.icon}
                        </Box>
                        <Box sx={{ textAlign: 'left', flex: 1 }}>
                          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                            {feature.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {feature.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Fade>
              ))}
            </Stack>

            {/* Quick Tips */}
            <Box
              sx={{
                p: 3,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.info.main, 0.05),
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
              }}
            >
              <Typography variant="subtitle2" color="info.main" gutterBottom sx={{ fontWeight: 600 }}>
                Quick Tips
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mt: 2 }}>
                <Chip
                  icon={<UploadIcon />}
                  label="Drag & drop video files"
                  size="small"
                  variant="outlined"
                  color="info"
                />
                <Chip
                  icon={<SettingsIcon />}
                  label="Configure processing settings"
                  size="small"
                  variant="outlined"
                  color="info"
                />
                <Chip
                  icon={<SubtitlesIcon />}
                  label="Review and export subtitles"
                  size="small"
                  variant="outlined"
                  color="info"
                />
              </Stack>
            </Box>
          </Box>
        </Fade>
      </Container>

      {/* Workspace Creation Dialog */}
      <WorkspaceCreationDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreateWorkspace={handleCreateWorkspace}
        availableWorkspaces={[]} // Empty for new users
      />
    </>
  )
}