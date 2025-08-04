import { useState, useRef, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, Typography, CircularProgress } from '@mui/material';
import { AppContent } from './components/AppContent';
import { WorkspaceConfigProvider } from './contexts/WorkspaceConfigContext';
import { EnhancedWorkspaceConfigProvider } from './contexts/EnhancedWorkspaceConfigContext';
import { WorkflowStateProvider } from './contexts/WorkflowStateContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAppStore } from './stores/app-store';
import { workflowStateManager } from './services/workflow-state-manager';
import theme from './theme/theme';
import './styles/globals.css';
import { JSX } from 'react/jsx-runtime';

function App(): JSX.Element {
  console.log("🔄 App component rendering...");
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  
  // Mounting guard to prevent unwanted effects during restoration
  const hasMountedRef = useRef(false);
  const isRestoringRef = useRef(false);
  const initializationCompleteRef = useRef(false);
  
  // Get app store methods for initialization
  const {
    initializeApp,
    loadConfigFromStorage,
    restoreUIState,
    showNotification,
  } = useAppStore();
  
  console.log("🔄 App component render, isInitializing:", isInitializing, "isWorkspaceReady:", isWorkspaceReady);

  // Main initialization effect - runs only once on mount
  useEffect(() => {
    // Skip if already initializing or during restoration
    if (hasMountedRef.current || isRestoringRef.current) {
      return;
    }

    hasMountedRef.current = true;
    console.log('🔄 App useEffect starting initialization...');

    const runInitialization = async () => {
      try {
        isRestoringRef.current = true;

        console.log('🚀 Initializing application...');
        await initializeApp();

        console.log('📁 Loading config from storage...');
        loadConfigFromStorage();

        console.log('🔄 Restoring UI state...');
        restoreUIState();

        // Initialize workflow system after core app initialization
        console.log('🔄 Initializing workflow state manager...');
        try {
          await workflowStateManager.initialize();
          console.log('✅ Workflow state manager initialized successfully');
        } catch (workflowError) {
          console.error('❌ Workflow state manager initialization failed:', workflowError);
          // Continue with app initialization even if workflow fails
          showNotification(
            'Workflow initialization warning - some features may be limited',
            'warning'
          );
        }

        console.log('✅ Application initialization completed');
        initializationCompleteRef.current = true;
        setIsInitializing(false);

        // Set workspace as ready immediately after initialization
        console.log('✅ Setting workspace as ready');
        setIsWorkspaceReady(true);
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showNotification(`Initialization failed: ${errorMessage}`, 'error');
        // Ensure loading screen is cleared even on failure
        setIsInitializing(false);
        setIsWorkspaceReady(true); // Allow app to continue even with errors
      } finally {
        isRestoringRef.current = false;
      }
    };

    runInitialization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initializeApp,
    loadConfigFromStorage,
    restoreUIState,
    showNotification,
  ]);

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
            gap: 2
          }}
        >
          <CircularProgress size={48} thickness={2} />
          <Typography variant="h6" color="text.primary">
            Loading Application
          </Typography>
          <Typography variant="body2" color="text.secondary">
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
        <WorkspaceConfigProvider>
          <EnhancedWorkspaceConfigProvider>
            <WorkflowStateProvider>
              <AppContent
                globalSettingsOpen={globalSettingsOpen}
                handleCloseGlobalSettings={handleCloseGlobalSettings}
              />
            </WorkflowStateProvider>
          </EnhancedWorkspaceConfigProvider>
        </WorkspaceConfigProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;