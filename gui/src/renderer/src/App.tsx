import { useState, useRef, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, Typography, CircularProgress } from '@mui/material';
import { AppContent } from './components/AppContent';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import theme from './theme/theme';
import './styles/globals.css';
import { JSX } from 'react/jsx-runtime';

// Import new Zustand stores
import { useAppActions, useActiveWorkspaceId } from './stores/useAppStore';
import { useWorkspaceActions, useWorkspaceExists } from './stores/useWorkspaceStore';
import { useWorkflowActions } from './stores/useWorkflowStore';

// Import validation utilities
import { validateWorkspaceId, safeWorkspaceOperation } from './utils/workspaceValidation';

function App(): JSX.Element {
  console.log('🔄 App component rendering...');

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
  const activeWorkspaceId = useActiveWorkspaceId();
  const _workspaceExists = useWorkspaceExists(activeWorkspaceId); // Used for React state consistency

  console.log(
    '🔄 App component render, isInitializing:',
    isInitializing,
    'isWorkspaceReady:',
    isWorkspaceReady
  );

  // Main initialization effect - runs only once on mount
  useEffect(() => {
    // Skip if already initializing or during restoration
    if (hasMountedRef.current || isRestoringRef.current) {
      return;
    }

    hasMountedRef.current = true;
    console.log('🔄 App useEffect starting initialization...');

    // Helper function to restore the active workspace
    const restoreActiveWorkspace = async () => {
      await safeWorkspaceOperation(async () => {
        // Get the current app state (should have activeWorkspaceId loaded)
        const { useAppStore } = await import('./stores/useAppStore');
        const currentActiveWorkspaceId = useAppStore.getState().activeWorkspaceId;
        
        console.log('🔄 Checking for active workspace to restore:', currentActiveWorkspaceId);
        
        if (currentActiveWorkspaceId) {
          // Validate workspace ID format first
          const validation = validateWorkspaceId(currentActiveWorkspaceId);
          if (!validation.isValid) {
            console.warn('⚠️ Active workspace ID is invalid:', validation.errors);
            await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', '');
            return;
          }
          
          // Check if the workspace still exists
          const exists = await window.electron.ipcRenderer.invoke('workspace:exists', currentActiveWorkspaceId);
          
          if (exists) {
            console.log('🔄 Restoring active workspace:', currentActiveWorkspaceId);
            // Use workspaceActions to switch to the restored workspace
            await workspaceActions.switchWorkspace(currentActiveWorkspaceId);
            console.log('✅ Active workspace restored successfully');
          } else {
            console.warn('⚠️ Previously active workspace no longer exists, clearing active workspace');
            // Clear the invalid active workspace
            await window.electron.ipcRenderer.invoke('app:setActiveWorkspace', '');
          }
        } else {
          console.log('ℹ️ No previous active workspace to restore');
        }
      }, 'restore active workspace');
    };

    const runInitialization = async () => {
      try {
        isRestoringRef.current = true;

        console.log('🚀 Initializing application stores...');

        // Load app state first and wait for completion
        console.log('🔄 Loading app state from electron store...');
        await appActions.loadAppState();
        
        // Verify app state is actually loaded
        const { useAppStore } = await import('./stores/useAppStore');
        const loadedState = useAppStore.getState();
        console.log('📁 App state loaded from main process:', {
          activeWorkspaceId: loadedState.activeWorkspaceId,
          recentWorkspaces: loadedState.recentWorkspaces,
          windowState: loadedState.windowState
        });

        // Load available workspaces
        console.log('🔄 Loading workspaces from electron store...');
        await workspaceActions.loadWorkspaces();
        console.log('📁 Workspaces loaded from main process');
        
        // Skip validation during initial app startup to avoid clearing valid activeWorkspaceId
        // The activeWorkspaceId will be validated when actually switching workspaces
        console.log('ℹ️ Skipping app state validation during startup to preserve activeWorkspaceId');
        
        // Signal that workspace store is now safe to use
        setIsWorkspaceInitialized(true);

        // Restore active workspace if it exists
        await restoreActiveWorkspace();

        // Reset workflow to initial state
        await workflowActions.resetWorkflow();
        console.log('🔄 Workflow state initialized');

        console.log('✅ Application initialization completed');
        initializationCompleteRef.current = true;
        setIsInitializing(false);

        // Set workspace as ready immediately after initialization
        console.log('✅ Setting workspace as ready');
        setIsWorkspaceReady(true);
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Initialization failed: ${errorMessage}`);
        // Ensure loading screen is cleared even on failure
        setIsInitializing(false);
        setIsWorkspaceReady(true); // Allow app to continue even with errors
      } finally {
        isRestoringRef.current = false;
      }
    };

    runInitialization();
  }, []); // Remove action dependencies to prevent circular renders

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
