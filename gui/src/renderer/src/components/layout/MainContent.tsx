import { Container, Box, Fade, Collapse } from '@mui/material';
import Grid from '@mui/material/Grid';
import { InputPanel } from '../ui/InputPanel';
import { AdvancedPanel } from '../ui/AdvancedPanel';
import { AdvancedPanelPlaceholder } from '../ui/AdvancedPanelPlaceholder';
import { ActionPanel } from '../ui/ActionPanel';
import { useAppStore } from '../../stores/useAppStore';

export const MainContent = () => {
  const { ui } = useAppStore();

  return (
    <Container
      maxWidth='xl'
      sx={{
        flex: 1,
        py: 3,
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 2, sm: 3, md: 4, lg: 6 },
      }}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={{ xs: 2, md: 3, lg: 4 }} sx={{ alignItems: 'flex-start' }}>
          {/* Main Input Section - Always 2/3 width on desktop */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Fade in timeout={300}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: { xs: 2, md: 3 },
                  width: '100%',
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <InputPanel />
                </Box>
                <Box sx={{ width: '100%' }}>
                  <ActionPanel />
                </Box>
              </Box>
            </Fade>
          </Grid>

          {/* Advanced Settings Panel - Always 1/3 width on desktop */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Fade in timeout={400}>
              <Box
                sx={{
                  width: '100%',
                  position: { lg: 'sticky' },
                  top: { lg: 24 },
                  alignSelf: 'flex-start',
                }}
              >
                {ui.showAdvanced ? (
                  <Collapse in={ui.showAdvanced} timeout={300}>
                    <AdvancedPanel />
                  </Collapse>
                ) : (
                  <AdvancedPanelPlaceholder />
                )}
              </Box>
            </Fade>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};
