import { useState, useRef, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, Typography, CircularProgress } from '@mui/material';
import { AppContent } from './components/AppContent';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import theme from './theme/theme';
import './styles/globals.css';
import { JSX } from 'react/jsx-runtime';
import { createComponentLogger } from './utils/logger';

// Import new Zustand stores
import { useAppActions } from './stores/useAppStore';
import { useWorkspaceActions } from './stores/useWorkspaceStore';
import { useWorkflowActions } from './stores/useWorkflowStore';

// Import validation utilities
import { validateWorkspaceId, safeWorkspaceOperation } from './utils/workspaceValidation';

function App(): JSX.Element {
  const logger = createComponentLogger('App');

  logger.component('App', 'mount');

  const [isInitializing, setIsInitializing] = useState(true);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [isWorkspaceInitialized, setIsWorkspaceInitialized] = useState(false);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);

  // Mounting guard to prevent unwanted effects during restoration
  const hasMountedRef = useRef(false);
  const isRestoringRef = useRef(false);
  const initializationCompleteRef = useRef(false);

  // Use proper hooks to get store actions
  const appActions = useAppActions();
  const workspaceActions = useWorkspaceActions();
  const workflowActions = useWorkflowActions();

  // Get workspace state for restoration (used for React hooks requirement)

  logger.debug('App component render state', {
    isInitializing,
    isWorkspaceReady,
  });

  // Main initialization effect - runs only once on mount
  useEffect(() => {
    // Skip if already initializing or during restoration
    if (hasMountedRef.current || isRestoringRef.current) {
      return;
    }

    hasMountedRef.current = true;
    logger.info('🔄 Starting application initialization');

    // Helper function to restore the active workspace
    const restoreActiveWorkspace = async () => {
      await safeWorkspaceOperation(async () => {
        // Get the current app state (should have activeWorkspaceId loaded)
        const { useAppStore } = await import('./stores/useAppStore');
        const currentActiveWorkspaceId = useAppStore.getState().activeWorkspaceId;

        logger.debug('Checking for active workspace to restore', { currentActiveWorkspaceId });

        if (currentActiveWorkspaceId) {
          // Validate workspace ID format first
          const validation = validateWorkspaceId(currentActiveWorkspaceId);
          if (!validation.isValid) {
            logger.warn('Active workspace ID is invalid', { errors: validation.errors });
            await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', null);
            return;
          }

          // Check if the workspace still exists
          const exists = await window.electron.ipcRenderer.invoke(
            'workspace:exists',
            currentActiveWorkspaceId
          );

          if (exists) {
            logger.info('Restoring active workspace', { workspaceId: currentActiveWorkspaceId });
            // Use workspaceActions to switch to the restored workspace
            await workspaceActions.switchWorkspace(currentActiveWorkspaceId);
            logger.info('Active workspace restored successfully');
          } else {
            logger.warn('Previously active workspace no longer exists, clearing active workspace');
            // Clear the invalid active workspace
            await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', null);
          }
        } else {
          logger.info('No previous active workspace to restore');
        }
      }, 'restore active workspace');
    };

    const runInitialization = async () => {
      try {
        isRestoringRef.current = true;

        logger.info('🚀 Initializing application stores');

        // Load app state first and wait for completion
        logger.debug('Loading app state from electron store');
        await appActions.loadAppState();

        // Verify app state is actually loaded
        const { useAppStore } = await import('./stores/useAppStore');
        const loadedState = useAppStore.getState();
        logger.info('App state loaded from main process', {
          activeWorkspaceId: loadedState.activeWorkspaceId,
          recentWorkspaces: loadedState.recentWorkspaces,
          windowState: loadedState.windowState,
        });

        // Load available workspaces
        logger.debug('Loading workspaces from electron store');
        await workspaceActions.loadWorkspaces();
        logger.info('Workspaces loaded from main process');

        // Skip validation during initial app startup to avoid clearing valid activeWorkspaceId
        // The activeWorkspaceId will be validated when actually switching workspaces
        logger.debug('Skipping app state validation during startup to preserve activeWorkspaceId');

        // Signal that workspace store is now safe to use
        setIsWorkspaceInitialized(true);

        // Restore active workspace if it exists
        await restoreActiveWorkspace();

        // Load workflow state for the active workspace (if any)
        const { useAppStore: useAppStoreForWorkflowInit } = await import('./stores/useAppStore');
        const currentActiveWorkspaceId = useAppStoreForWorkflowInit.getState().activeWorkspaceId;

        if (currentActiveWorkspaceId) {
          logger.debug('Loading workflow state for active workspace', {
            workspaceId: currentActiveWorkspaceId,
          });
          await workflowActions.loadWorkflowState(currentActiveWorkspaceId);
          logger.info('Workflow state loaded for workspace', {
            workspaceId: currentActiveWorkspaceId,
          });
        } else {
          // Only reset workflow if no active workspace
          await workflowActions.resetWorkflow();
          logger.debug('Workflow state initialized (no active workspace)');
        }

        logger.info('✅ Application initialization completed');
        initializationCompleteRef.current = true;
        setIsInitializing(false);

        // Set workspace as ready immediately after initialization
        logger.info('Setting workspace as ready');
        setIsWorkspaceReady(true);
      } catch (error) {
        logger.error('App initialization failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Initialization failed', { errorMessage });
        // Ensure loading screen is cleared even on failure
        setIsInitializing(false);
        setIsWorkspaceReady(true); // Allow app to continue even with errors
      } finally {
        isRestoringRef.current = false;
      }
    };

    runInitialization();
  }, [appActions, workspaceActions, workflowActions, logger]); // Include all dependencies

  // Global settings dialog state
  const handleCloseGlobalSettings = () => {
    setGlobalSettingsOpen(false);
  };

  // Show loading screen during initialization or workspace setup
  if (isInitializing || !isWorkspaceReady) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            backgroundColor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CircularProgress size={48} thickness={2} />
          <Typography variant='h6' color='text.primary'>
            Loading Application
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Loading workspace and dependencies
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary
      fallbackTitle='Application Error'
      fallbackMessage='The application encountered an error. This often happens during file upload or processing.'
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContent
          globalSettingsOpen={globalSettingsOpen}
          handleCloseGlobalSettings={handleCloseGlobalSettings}
          isWorkspaceInitialized={isWorkspaceInitialized}
        />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
