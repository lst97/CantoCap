import React from 'react';
import { Box } from '@mui/material';
import { useWorkflowIntegration } from '../hooks/useWorkflowIntegration';
import { CustomTitleBar } from './layout/CustomTitleBar';
import { WorkspacePanel } from './layout/WorkspacePanel';
import { StepNavigation } from './layout/StepNavigation';
import { MainContentArea } from './layout/MainContentArea';
import { NotificationContainer } from './feedback/NotificationContainer';
import { ModalContainer } from './modals/ModalContainer';
import { DebugPanel } from './feedback/DebugPanel';
import { ErrorTestButton } from './debug/ErrorTestButton';
import { DevToolsButton } from './common/DevToolsButton';
import { DebugMenu } from './common/DebugMenu';
import { GlobalSettingsDialog } from './dialogs/GlobalSettingsDialog';

interface AppContentProps {
  globalSettingsOpen: boolean;
  handleCloseGlobalSettings: () => void;
}

export const AppContent: React.FC<AppContentProps> = ({
  globalSettingsOpen,
  handleCloseGlobalSettings,
}) => {
  
  // Initialize workflow integration system - now safely inside WorkflowStateProvider
  useWorkflowIntegration();
  
  console.log("✅ App content workflow integration initialized");

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

      {/* Main layout */}
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Workspace panel */}
        <WorkspacePanel onSettings={() => {}} />

        {/* Step navigation */}
        <StepNavigation />

        {/* Main content area */}
        <MainContentArea />
      </Box>

      {/* Global components */}
      <NotificationContainer />
      <ModalContainer />

      {/* Development tools */}
      {process.env.NODE_ENV === 'development' && (
        <>
          <DebugPanel />
          <ErrorTestButton />
          <DevToolsButton />
          <DebugMenu />
        </>
      )}

      {/* Global settings dialog */}
      <GlobalSettingsDialog open={globalSettingsOpen} onClose={handleCloseGlobalSettings} />
    </Box>
  );
};
