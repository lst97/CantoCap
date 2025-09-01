import React, { useCallback } from 'react';
import { Box, Typography, Button, Stack, Card, Grid, CircularProgress, Alert } from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  OpenInNew as ExternalIcon,
  Psychology as PythonIcon,
  Movie as FFmpegIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useAppStore } from '../../stores/useAppStore';
import type { DependencyStatus } from '../../../../types/index';

export const SystemStatus: React.FC = () => {
  // Select each slice separately to avoid returning a new object per render
  const dependencies = useAppStore((state) => state.dependencies);
  const { checkDependencies, showNotification } = useAppStore(
    (state) => state.actions
  );

  const handleCheckDependencies = useCallback(async () => {
    if (checkDependencies) {
      await checkDependencies();
      if (showNotification) {
        showNotification('Dependencies checked', 'info');
      }
    }
  }, [checkDependencies, showNotification]);

  const handleOpenInstallGuide = useCallback(async (dependency: string) => {
    const urls: Record<string, string> = {
      python: 'https://www.python.org/downloads/release/python-3120/',
      ffmpeg: 'https://ffmpeg.org/download.html',
    };

    if (urls[dependency]) {
      await window.cantocapAPI.openExternalUrl(urls[dependency]);
    }
  }, []);

  const getStatusIcon = (dependency: DependencyStatus) => {
    if (dependency.status === 'checking') {
      return <CircularProgress size={20} sx={{ color: '#F59E0B' }} />;
    }
    if (dependency.available) {
      return <CheckIcon sx={{ color: '#57F287', fontSize: 20 }} />;
    }
    if (dependency.status === 'error') {
      return <ErrorIcon sx={{ color: '#ED4245', fontSize: 20 }} />;
    }
    return <WarningIcon sx={{ color: '#FF9800', fontSize: 20 }} />;
  };

  const getStatusText = (dependency: DependencyStatus, name: string) => {
    if (dependency.status === 'checking') return 'Checking...';
    if (dependency.available) return `${name} Available`;
    if (dependency.status === 'error') return 'Check Failed';
    return `${name} Missing`;
  };

  const getStatusColor = (dependency: DependencyStatus) => {
    if (dependency.status === 'checking') return '#F59E0B';
    if (dependency.available) return '#57F287';
    if (dependency.status === 'error') return '#ED4245';
    return '#FF9800';
  };

  const allDependenciesAvailable = dependencies.python.available && dependencies.ffmpeg.available;
  const isChecking =
    dependencies.python.status === 'checking' || dependencies.ffmpeg.status === 'checking';

  return (
    <Stack spacing={3}>
      {/* Status Overview */}
      <Alert
        severity={allDependenciesAvailable ? 'success' : 'warning'}
        icon={allDependenciesAvailable ? <CheckIcon /> : <WarningIcon />}
        sx={{
          backgroundColor: allDependenciesAvailable
            ? 'rgba(87, 242, 135, 0.1)'
            : 'rgba(255, 152, 0, 0.1)',
          border: `1px solid ${
            allDependenciesAvailable ? 'rgba(87, 242, 135, 0.3)' : 'rgba(255, 152, 0, 0.3)'
          }`,
          borderRadius: 2,
          '& .MuiAlert-icon': {
            color: allDependenciesAvailable ? '#57F287' : '#FF9800',
          },
        }}
      >
        <Typography variant='subtitle2' sx={{ fontWeight: 600, mb: 0.5 }}>
          {allDependenciesAvailable ? '✨ System Ready' : '⚠️ Dependencies Required'}
        </Typography>
        <Typography variant='body2'>
          {allDependenciesAvailable
            ? 'All required dependencies are available and ready for transcription.'
            : 'Some dependencies are missing. Install them to enable full functionality.'}
        </Typography>
      </Alert>

      {/* Dependencies Status - Compact Cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              p: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: dependencies.python.available
                  ? 'rgba(87, 242, 135, 0.3)'
                  : 'rgba(255, 152, 0, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  backgroundColor: dependencies.python.available
                    ? 'rgba(87, 242, 135, 0.15)'
                    : 'rgba(237, 66, 69, 0.15)',
                  color: dependencies.python.available ? '#57F287' : '#ED4245',
                }}
              >
                <PythonIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant='body2' sx={{ fontWeight: 600, color: '#DCDDDE' }}>
                  Python 3.12
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getStatusIcon(dependencies.python)}
                  <Typography
                    variant='caption'
                    sx={{ color: getStatusColor(dependencies.python), fontWeight: 500 }}
                  >
                    {getStatusText(dependencies.python, 'Python')}
                  </Typography>
                </Box>
                {dependencies.python.version && (
                  <Typography variant='caption' sx={{ color: '#96989D', fontFamily: 'monospace' }}>
                    {dependencies.python.version.split('\n')[0]}
                  </Typography>
                )}
              </Box>
              {!dependencies.python.available && dependencies.python.status !== 'checking' && (
                <Button
                  variant='outlined'
                  size='small'
                  startIcon={<ExternalIcon fontSize='small' />}
                  onClick={() => handleOpenInstallGuide('python')}
                  sx={{
                    borderColor: '#40444B',
                    color: '#DCDDDE',
                    fontSize: '0.7rem',
                    py: 0.5,
                    px: 1,
                    '&:hover': {
                      borderColor: '#5865F2',
                      backgroundColor: 'rgba(88, 101, 242, 0.1)',
                    },
                  }}
                >
                  Install
                </Button>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              p: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: dependencies.ffmpeg.available
                  ? 'rgba(87, 242, 135, 0.3)'
                  : 'rgba(255, 152, 0, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  backgroundColor: dependencies.ffmpeg.available
                    ? 'rgba(87, 242, 135, 0.15)'
                    : 'rgba(237, 66, 69, 0.15)',
                  color: dependencies.ffmpeg.available ? '#57F287' : '#ED4245',
                }}
              >
                <FFmpegIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant='body2' sx={{ fontWeight: 600, color: '#DCDDDE' }}>
                  FFmpeg
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getStatusIcon(dependencies.ffmpeg)}
                  <Typography
                    variant='caption'
                    sx={{ color: getStatusColor(dependencies.ffmpeg), fontWeight: 500 }}
                  >
                    {getStatusText(dependencies.ffmpeg, 'FFmpeg')}
                  </Typography>
                </Box>
                {dependencies.ffmpeg.version && (
                  <Typography variant='caption' sx={{ color: '#96989D', fontFamily: 'monospace' }}>
                    {dependencies.ffmpeg.version.split('\n')[0]}
                  </Typography>
                )}
              </Box>
              {!dependencies.ffmpeg.available && dependencies.ffmpeg.status !== 'checking' && (
                <Button
                  variant='outlined'
                  size='small'
                  startIcon={<ExternalIcon fontSize='small' />}
                  onClick={() => handleOpenInstallGuide('ffmpeg')}
                  sx={{
                    borderColor: '#40444B',
                    color: '#DCDDDE',
                    fontSize: '0.7rem',
                    py: 0.5,
                    px: 1,
                    '&:hover': {
                      borderColor: '#5865F2',
                      backgroundColor: 'rgba(88, 101, 242, 0.1)',
                    },
                  }}
                >
                  Install
                </Button>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Control Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant='outlined'
          startIcon={<RefreshIcon />}
          onClick={handleCheckDependencies}
          disabled={isChecking}
          sx={{
            borderColor: '#40444B',
            color: '#DCDDDE',
            '&:hover': {
              borderColor: '#5865F2',
              backgroundColor: 'rgba(88, 101, 242, 0.1)',
            },
            '&:disabled': {
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          {isChecking ? 'Checking...' : 'Recheck Dependencies'}
        </Button>

        
      </Box>

      {/* System Requirements - Compact Grid */}
      <Card
        sx={{
          p: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 2,
        }}
      >
        <Typography
          variant='body2'
          sx={{
            fontWeight: 600,
            color: '#DCDDDE',
            mb: 2,
          }}
        >
          📋 System Requirements
        </Typography>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <PythonIcon sx={{ color: '#3776AB', fontSize: 16 }} />
              <Typography variant='caption'>Python 3.12</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FFmpegIcon sx={{ color: '#FF6B35', fontSize: 16 }} />
              <Typography variant='caption'>FFmpeg</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <MemoryIcon sx={{ color: '#9333EA', fontSize: 16 }} />
              <Typography variant='caption'>4GB+ RAM</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SpeedIcon sx={{ color: '#10B981', fontSize: 16 }} />
              <Typography variant='caption'>GPU optional</Typography>
            </Box>
          </Grid>
        </Grid>
      </Card>
    </Stack>
  );
};
