import React, { memo, useEffect, useRef, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { CustomTitleBar } from './layout/CustomTitleBar';
import { HeaderBar } from './layout/HeaderBar';
import { StepNavigation } from './layout/StepNavigation';
import { MainContentArea } from './layout/MainContentArea';
import { NotificationContainer } from './feedback/NotificationContainer';
import { DebugPanel } from './feedback/DebugPanel';
import { DevToolsButton } from './common/DevToolsButton';
import { DebugMenu } from './common/DebugMenu';
import { GlobalSettingsDialog } from './dialogs/GlobalSettingsDialog';
import { WorkspacePanel, EmptyWorkspaceState } from './workspace';
import { useWorkspaceCount, useCreateWorkspace } from '../stores/useWorkspaceStore';
import { createComponentLogger } from '../utils/logger';

interface AppContentProps {
  globalSettingsOpen: boolean;
  handleOpenGlobalSettings: () => void;
  handleCloseGlobalSettings: () => void;
  isWorkspaceInitialized?: boolean;
}

export const AppContent: React.FC<AppContentProps> = memo(
  ({
    globalSettingsOpen,
    handleOpenGlobalSettings,
    handleCloseGlobalSettings,
    isWorkspaceInitialized = false
  }) => {
    const isInitialized = useRef(false);

    const logger = createComponentLogger('AppContent');

    logger.component('AppContent', 'mount');

    // Only use the passed prop to determine if workspace is ready
    // This prevents the race condition entirely by relying on App component's initialization
    const isWorkspaceStoreReady = isWorkspaceInitialized;

    // Get workspace count to determine if we should show empty state
    const workspaceCount = useWorkspaceCount();
    const createWorkspace = useCreateWorkspace();

    // Handler for creating workspace from empty state
    const handleCreateWorkspace = useCallback(
      async (name: string) => {
        try {
          await createWorkspace(name);
        } catch (error) {
          logger.error('Failed to create workspace:', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      [createWorkspace, logger]
    );

    // Only log once during initialization to reduce console noise
    useEffect(() => {
      if (!isInitialized.current) {
        logger.info('✅ App content workflow integration initialized');
        isInitialized.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <Box
        sx={{
          height: '100vh',
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Custom title bar - Windows/Linux */}
        <CustomTitleBar />

        {/* Application header bar */}
        <HeaderBar />

        {/* Main layout */}
        <Box
          sx={{
            display: 'flex',
            flexGrow: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Always show workspace panel (Discord-style sidebar) */}
          {isWorkspaceStoreReady && <WorkspacePanel onSettings={handleOpenGlobalSettings} />}

          {/* Show empty workspace state when no workspaces exist */}
          {isWorkspaceStoreReady && workspaceCount === 0 ? (
            <EmptyWorkspaceState onCreateWorkspace={handleCreateWorkspace} />
          ) : (
            <>
              {/* Step navigation */}
              {isWorkspaceStoreReady ? (
                <StepNavigation />
              ) : (
                <Box
                  sx={{
                    width: 280,
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    borderRight: 1,
                    borderColor: 'divider',
                  }}
                />
              )}

              {/* Main content area */}
              {isWorkspaceStoreReady ? (
                <MainContentArea />
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'background.default',
                  }}
                >
                  <Typography variant='h6' color='text.secondary'>
                    Initializing workspace...
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Global components */}
        <NotificationContainer />

        {/* Development tools */}
        {process.env.NODE_ENV === 'development' && (
          <>
            <DebugPanel />
            <DevToolsButton />
            <DebugMenu />
          </>
        )}

        {/* Global settings dialog */}
        <GlobalSettingsDialog open={globalSettingsOpen} onClose={handleCloseGlobalSettings} />
      </Box>
    );
  }
);

AppContent.displayName = 'AppContent';