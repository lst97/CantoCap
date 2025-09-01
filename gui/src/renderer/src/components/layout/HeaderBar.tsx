import React, { useEffect, useMemo } from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, Avatar } from '@mui/material';
import {
  MovieFilter as MovieIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import { useAppStore } from '../../stores/useAppStore';

export const HeaderBar: React.FC = () => {
  const appVersion = useAppStore((s) => s.appVersion);
  const dependencies = useAppStore((s) => s.dependencies);
  const actions = useAppStore((s) => s.actions);

  // Kick off a single dependency check on mount
  useEffect(() => {
    if (actions.checkDependencies) {
      actions.checkDependencies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = useMemo(() => {
    const deps = Object.values(dependencies);

    if (!deps || deps.length === 0 || deps.some((d) => !d || d.status === 'checking')) {
      return {
        status: 'checking',
        color: 'warning' as const,
        text: 'Checking System...',
        icon: <PendingIcon fontSize='small' />,
      };
    }

    if (deps.every((d) => d.available)) {
      return {
        status: 'ready',
        color: 'success' as const,
        text: 'System Ready',
        icon: <CheckIcon fontSize='small' />,
      };
    }

    return {
      status: 'missing',
      color: 'error' as const,
      text: 'Dependencies Missing',
      icon: <ErrorIcon fontSize='small' />,
    };
  }, [dependencies]);

  return (
    <AppBar
      position='static'
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
        height: 36, // Discord-like compact height
        WebkitAppRegion: 'drag', // Make the entire bar draggable
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center', // Center everything
          position: 'relative', // For absolute positioning of version

          minHeight: '36px !important', // Override default Toolbar height
          height: 36,
        }}
      >
        {/* Center: App Logo, Title and System Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 22, // Small Discord-like size
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MovieIcon sx={{ fontSize: 18 }} />
          </Avatar>

          <Typography
            variant='h6'
            component='h1'
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '1rem',
              lineHeight: 1,
              letterSpacing: '-0.01em',
            }}
          >
            CantoCap
          </Typography>

          <Chip
            icon={status.icon}
            label={status.text}
            color={status.color}
            variant='outlined'
            size='small'
            sx={{
              fontWeight: 500,
              fontSize: '0.75rem',
              height: 22, // Smaller Discord-like height
              WebkitAppRegion: 'no-drag', // Make chip non-draggable
              '& .MuiChip-icon': {
                fontSize: '0.875rem',
              },
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />
        </Box>

        {/* Right: Version - Positioned absolutely */}
        <Box
          sx={{
            position: 'absolute',
            right: 16,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Chip
            label={`v${appVersion || '1.0.0'}`}
            size='small'
            variant='filled'
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.1)', // Darker, less visible background
              color: 'text.secondary',
              border: 'none',
              fontSize: '0.7rem',
              height: 22, // Very compact
              opacity: 0.6, // Make it less prominent
              WebkitAppRegion: 'no-drag', // Make chip non-draggable
              '& .MuiChip-label': {
                px: 0.75,
              },
              '&:hover': {
                opacity: 0.8, // Slightly more visible on hover
              },
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
};
