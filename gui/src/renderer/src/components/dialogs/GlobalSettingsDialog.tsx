import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Stack,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Assessment as SystemIcon,
  Info as InfoIcon,
  VpnKey as VpnKeyIcon,
  Tune as TuneIcon,
  Language as LanguageIcon,
  LinkedIn as LinkedInIcon,
  Email as EmailIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import { SystemStatus } from '../feedback/SystemStatus';
import { GlobalAPIKeyInput } from '../forms/GlobalAPIKeyInput';
import { useAppStore } from '../../stores/useAppStore';

interface GlobalSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const GlobalSettingsDialog: React.FC<GlobalSettingsDialogProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState(0);
  const appVersion = useAppStore((state) => state.appVersion);
  const { actions } = useAppStore();

  // Load latest dependency status and app version when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        if (actions.checkDependencies) {
          await actions.checkDependencies();
        }
      } catch {
        /* ignore */
      }
    })();
  }, [open, actions]);

  const handleChange = useCallback((_e: React.SyntheticEvent, value: number) => setTab(value), []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='md'
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#2F3136',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          minHeight: '60vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 2,
          pr: 6,
          pb: 1,
          pt: 1,
          backgroundColor: '#36393F',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 32 }}>
          <SystemIcon color='primary' />
          <Typography variant='h6' sx={{ fontWeight: 600, color: '#DCDDDE' }}>
            Global Settings
          </Typography>
          {appVersion && (
            <Chip size='small' label={`v${appVersion}`} sx={{ ml: 1, opacity: 0.7 }} />
          )}
        </Box>
        <IconButton
          aria-label='Close settings'
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#B9BBBE',
            backgroundColor: 'transparent',
            transition: 'all 0.15s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#FFFFFF',
            },
            '&:focus-visible': {
              outline: '2px solid rgba(255,255,255,0.25)',
              outlineOffset: 2,
            },
          }}
          size='small'
        >
          <CloseIcon fontSize='small' />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Tabs
          value={tab}
          onChange={handleChange}
          variant='fullWidth'
          sx={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: '#2F3136',
          }}
        >
          <Tab
            icon={<SystemIcon />}
            iconPosition='start'
            label='System'
            sx={{ color: '#DCDDDE' }}
          />
          <Tab
            icon={<VpnKeyIcon />}
            iconPosition='start'
            label='API Keys'
            sx={{ color: '#DCDDDE' }}
          />
          <Tab
            icon={<TuneIcon />}
            iconPosition='start'
            label='Preferences'
            sx={{ color: '#DCDDDE' }}
          />
          <Tab icon={<InfoIcon />} iconPosition='start' label='About' sx={{ color: '#DCDDDE' }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            <Box>
              <Typography
                variant='subtitle1'
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  color: '#DCDDDE',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <SystemIcon fontSize='small' />
                System & Dependencies
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
                Check and manage required dependencies detected by the app.
              </Typography>
              <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              <SystemStatus />
            </Box>
          )}

          {tab === 1 && (
            <Box>
              <Typography
                variant='subtitle1'
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  color: '#DCDDDE',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <VpnKeyIcon fontSize='small' />
                API Keys
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
                Configure API keys for Gemini and Hugging Face. These enable AI enhancement and
                model access.
              </Typography>
              <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              <GlobalAPIKeyInput />
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <Typography
                variant='subtitle1'
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  color: '#DCDDDE',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <TuneIcon fontSize='small' />
                Preferences
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
                Basic appearance and behavior preferences.
              </Typography>
              <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              <Stack spacing={2}>
                <Typography variant='body2' color='text.secondary'>
                  Additional preferences can be added here (theme, telemetry, confirmations, etc.).
                </Typography>
              </Stack>
            </Box>
          )}

          {tab === 3 && (
            <Box>
              <Typography
                variant='subtitle1'
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  color: '#DCDDDE',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <InfoIcon fontSize='small' />
                About CantoCap
              </Typography>
              <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              <Stack spacing={1.5}>
                <Typography variant='body1' color='text.primary' sx={{ fontWeight: 'bold' }}>
                  CantoCap version {appVersion}
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                  Cantonese To Caption
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                  To eliminate the time-consuming and tedious process of creating subtitles,
                  allowing creators to focus on their content specially for Hong Kong and Cantonese
                  community.
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                  整字幕嘥時間又麻煩, 純粹想 YouTuber 可以專心搞好啲片,
                  特別為香港同講廣東話嘅朋友整。
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                  License: Free and open-source. Use your own API key. Paid services may be
                  available in the future for users how want more seamless experience.
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                  授權: 費用全免, 而且係開源嘅。用返你自己條 API Key 就得。將來可能會出收費服務,
                  畀啲手殘想撳個掣就用到嘅朋友仔。
                </Typography>

                <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

                <Typography variant='body2' color='text.secondary'>
                  Author: lst97 - SIO TOU (Nelson) LAI
                </Typography>
                <Stack direction='row' spacing={1} sx={{ mt: 2 }}>
                  <IconButton
                    size='small'
                    onClick={() => window.cantocapAPI.openExternalUrl('https://www.lst97.dev')}
                  >
                    <LanguageIcon />
                  </IconButton>
                  <IconButton
                    size='small'
                    onClick={() =>
                      window.cantocapAPI.openExternalUrl('https://www.linkedin.com/in/lst97')
                    }
                  >
                    <LinkedInIcon />
                  </IconButton>
                  <IconButton
                    size='small'
                    onClick={() => window.cantocapAPI.openExternalUrl('mailto:contact@lst97.dev')}
                  >
                    <EmailIcon />
                  </IconButton>
                  <IconButton
                    size='small'
                    onClick={() =>
                      window.cantocapAPI.openExternalUrl('https://github.com/lst97/canto-cap')
                    }
                  >
                    <GitHubIcon />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          p: 1,
          backgroundColor: '#36393F',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        <Button
          onClick={onClose}
          variant='outlined'
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.18)',
            color: '#DCDDDE',
            px: 3,
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderColor: 'rgba(255, 255, 255, 0.28)',
              color: '#FFFFFF',
            },
            '& .MuiTouchRipple-root': { opacity: 0.2 },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
