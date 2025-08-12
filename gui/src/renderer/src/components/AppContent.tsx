import React, { memo, useEffect, useRef, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { CustomTitleBar } from './layout/CustomTitleBar';
import { HeaderBar } from './layout/HeaderBar';
import { StepNavigation } from './layout/StepNavigation';
import { MainContentArea } from './layout/MainContentArea';
import { NotificationContainer } from './feedback/NotificationContainer';
import { ModalContainer } from './modals/ModalContainer';
import { DebugPanel } from './feedback/DebugPanel';
import { DevToolsButton } from './common/DevToolsButton';
import { DebugMenu } from './common/DebugMenu';
import { GlobalSettingsDialog } from './dialogs/GlobalSettingsDialog';
import { WorkspacePanel, EmptyWorkspaceState } from './workspace';
import { useWorkspaceCount, useCreateWorkspace } from '../stores/useWorkspaceStore';

interface AppContentProps {
  globalSettingsOpen: boolean;
  handleCloseGlobalSettings: () => void;
  isWorkspaceInitialized?: boolean;
}

export const AppContent: React.FC<AppContentProps> = memo(
  ({ globalSettingsOpen, handleCloseGlobalSettings, isWorkspaceInitialized = false }) => {
    const isInitialized = useRef(false);
    
    // Only use the passed prop to determine if workspace is ready
    // This prevents the race condition entirely by relying on App component's initialization
    const isWorkspaceStoreReady = isWorkspaceInitialized;
    
    // Get workspace count to determine if we should show empty state
    const workspaceCount = useWorkspaceCount();
    const createWorkspace = useCreateWorkspace();

    // Handler for creating workspace from empty state
    const handleCreateWorkspace = useCallback(async (name: string) => {
      try {
        await createWorkspace(name);
      } catch (error) {
        console.error('Failed to create workspace:', error);
      }
    }, [createWorkspace]);

    // Only log once during initialization to reduce console noise
    useEffect(() => {
      if (!isInitialized.current) {
        console.log('✅ App content workflow integration initialized');
        isInitialized.current = true;
      }
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
          {isWorkspaceStoreReady && <WorkspacePanel onSettings={() => {}} />}

          {/* Show empty workspace state when no workspaces exist */}
          {isWorkspaceStoreReady && workspaceCount === 0 ? (
            <EmptyWorkspaceState onCreateWorkspace={handleCreateWorkspace} />
          ) : (
            <>
              {/* Step navigation */}
              {isWorkspaceStoreReady ? (
                <StepNavigation />
              ) : (
                <Box sx={{ width: 280, backgroundColor: 'rgba(0, 0, 0, 0.1)', borderRight: 1, borderColor: 'divider' }} />
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
                    backgroundColor: 'background.default'
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Initializing workspace...
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Global components */}
        <NotificationContainer />
        <ModalContainer />

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
