import { useEffect, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, Typography, CircularProgress } from '@mui/material';
import { useAppStore } from './stores/app-store';
import { useWorkflowStore } from './stores/workflow-store';
import { navigateToReview } from './utils/workflow-navigation';
import { WorkspaceConfigProvider } from './contexts/WorkspaceConfigContext';
import { CustomTitleBar } from './components/layout/CustomTitleBar';
import { WorkspacePanel } from './components/layout/WorkspacePanel';
import { StepNavigation } from './components/layout/StepNavigation';
import { MainContentArea } from './components/layout/MainContentArea';
import { NotificationContainer } from './components/feedback/NotificationContainer';
import { ModalContainer } from './components/modals/ModalContainer';
import { DebugPanel } from './components/feedback/DebugPanel';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ErrorTestButton } from './components/debug/ErrorTestButton';
import { DevToolsButton } from './components/common/DevToolsButton';
import { DebugMenu } from './components/common/DebugMenu';
import theme from './theme/theme';
import './styles/globals.css';
import { JSX } from 'react/jsx-runtime';

function App(): JSX.Element {
  console.log("🔄 App component rendering...");
  
  const [isInitializing, setIsInitializing] = useState(true);
  
  const {
    initializeApp,
    processing,
    updateProcessing,
    resetProcessing,
    showNotification,
    addToHistory,
    loadConfigFromStorage,
    restoreUIState,
    addDebugMessage,
  } = useAppStore();
  
  console.log("✅ App store hooks initialized");

  useEffect(() => {
    console.log("🔄 App useEffect starting initialization...");
    
    const runInitialization = async () => {
      try {
        console.log("🔄 Starting app initialization...");
        await initializeApp();
        console.log("✅ App initialization completed");
        
        console.log("🔄 Starting config loading...");
        loadConfigFromStorage();
        console.log("✅ Config loading completed");
        
        console.log("🔄 Starting UI state restoration...");
        restoreUIState();
        console.log("✅ UI state restoration completed");
        
        console.log("✅ All initialization completed successfully");
      } catch (error) {
        console.error("❌ Error during initialization (continuing with limited functionality):", error);
        showNotification(`Some features may be limited due to initialization error: ${error instanceof Error ? error.message : String(error)}`, 'warning', 8000);
      } finally {
        setIsInitializing(false);
        console.log("✅ Initialization phase completed, app is ready");
      }
    };
    
    runInitialization();

    // Setup IPC event listeners
    const cleanupFunctions: (() => void)[] = [];

    console.log("🔄 Setting up IPC event listeners...");
    
    // Check API availability before setting up listeners
    if (!window.cantocapAPI) {
      console.error("❌ cantocapAPI not available - Electron preload may have failed");
      showNotification("API not available - please restart the application", 'error');
      return;
    }
    
    console.log("✅ cantocapAPI is available");
    
    // Modern IPC progress updates
    try {
      cleanupFunctions.push(
        window.cantocapAPI.onIPCMessage((message) => {
        // Handle progress messages from new IPC system
        if (message.category === 'process' && message.source === 'progress' && message.data) {
          const progressData = message.data;
          updateProcessing({
            progress: progressData.percent || 0,
            message: progressData.message || message.content || 'Processing...',
            stage: progressData.stage || 'processing',
            currentStep: progressData.currentStep,
            totalSteps: progressData.totalSteps,
            hardwareInfo: progressData.hardwareInfo,
            timeElapsed: progressData.elapsed_time || 0,
            timeRemaining: progressData.estimated_remaining || 0,
            substage: progressData.substage,
            engineStage: progressData.stage,
          });

          // Add debug message for progress updates
          addDebugMessage(
            progressData.stage || 'processing',
            progressData.message || message.content || 'Processing...',
            'info',
            'progress'
          );
        }

        // Handle all other messages as debug messages
        else if (message.content && message.content.trim()) {
          const messageLevel = (message.level as 'debug' | 'info' | 'warning' | 'error') || 'info';
          const stage =
            message.data?.stage || processing.engineStage || processing.stage || 'unknown';

          addDebugMessage(stage, message.content, messageLevel, message.source);
        }
      })
    );

    // Legacy Progress updates (fallback)
    cleanupFunctions.push(
      window.cantocapAPI.onProgressUpdate((data) => {
        // Map incoming stage values to allowed types
        const mapStage = (
          stage: string | undefined
        ):
          | 'error'
          | 'idle'
          | 'preparing'
          | 'transcribing'
          | 'refining'
          | 'completed'
          | 'cancelled'
          | undefined => {
          if (!stage) return 'preparing';
          switch (stage.toLowerCase()) {
            case 'processing':
            case 'preparing':
              return 'preparing';
            case 'transcribing':
              return 'transcribing';
            case 'refining':
              return 'refining';
            case 'completed':
              return 'completed';
            case 'error':
              return 'error';
            case 'cancelled':
              return 'cancelled';
            case 'idle':
              return 'idle';
            default:
              return 'preparing'; // Default fallback
          }
        };

        updateProcessing({
          progress: data.progress || 0,
          message: data.message || data.status || 'Processing...',
          stage: mapStage(data.stage || data.status),
          currentStep: data.currentStep,
          totalSteps: data.totalSteps,
          hardwareInfo: data.hardwareInfo,
        });
      })
    );

    // Process started
    cleanupFunctions.push(
      window.cantocapAPI.onProcessStarted((data) => {
        updateProcessing({
          isActive: true,
          stage: 'preparing',
          message: data.message || 'Process started',
        });
      })
    );

    // Process completed
    cleanupFunctions.push(
      window.cantocapAPI.onProcessComplete(async (data) => {
        // Debug logging to check what data is being received from engine
        console.log('onProcessComplete Debug:');
        console.log('- data:', data);
        console.log('- data.statistics:', data.statistics);
        if (data.statistics) {
          console.log('- statistics.quality_score:', data.statistics.quality_score);
          console.log('- statistics.quality_grade:', data.statistics.quality_grade);
          console.log('- statistics.translation_coverage:', data.statistics.translation_coverage);
        }

        updateProcessing({
          isActive: false,
          stage: 'completed',
          progress: 100,
          message: data.message || 'Transcription completed successfully',
          statistics: data.statistics,
        });

        // Clear any error state from processing step
        const workflowStore = useWorkflowStore.getState();
        workflowStore.clearStepError('processing');
        workflowStore.completeStep('processing');

        // Load subtitle data with translations if available
        const currentConfig = useAppStore.getState().config;
        if (
          data.outputFile &&
          currentConfig.subtitle &&
          typeof currentConfig.subtitle === 'string'
        ) {
          try {
            // Try to load JSON subtitle data (contains translations)
            const jsonPath = data.outputFile.replace(/\.[^/.]+$/, '.json');
            console.log('Loading subtitle translations from:', jsonPath);

            const subtitleData = await window.cantocapAPI.readJsonFile(jsonPath);
            if (subtitleData && Array.isArray(subtitleData)) {
              // Update config with subtitle data containing translations
              const { updateConfig } = useAppStore.getState();
              updateConfig('subtitle', subtitleData);
              console.log(`Loaded ${subtitleData.length} subtitles with translation data`);
            }
          } catch (error) {
            console.warn('Could not load subtitle translation data:', error);
            // Continue without translations - not a critical error
          }
        }

        showNotification('Transcription completed successfully!', 'success');
        addToHistory(useAppStore.getState().config.inputFile!, 'completed', data.outputFile);

        // Navigate to review step when processing completes
        navigateToReview();
      })
    );

    // Process errors
    cleanupFunctions.push(
      window.cantocapAPI.onProcessError((data) => {
        // Preserve existing processing state when error occurs
        const currentProcessing = useAppStore.getState().processing;
        updateProcessing({
          ...currentProcessing, // Preserve all existing values
          isActive: false,
          stage: 'error',
          error: data.message || 'An error occurred',
          message: `Error: ${data.message || 'Unknown error'}`,
          // Calculate final time elapsed if we have a start time
          timeElapsed: currentProcessing.startTime
            ? Math.floor((Date.now() - currentProcessing.startTime) / 1000)
            : currentProcessing.timeElapsed,
        });

        // Mark processing step as having an error
        const workflowStore = useWorkflowStore.getState();
        workflowStore.markStepAsError('processing', data.message || 'Processing failed');

        // Add error as debug message for detailed tracking
        addDebugMessage(
          'error',
          `${data.type || 'process_error'}: ${data.message || 'Unknown error'}${data.exitCode ? ` (Exit Code: ${data.exitCode})` : ''}`,
          'error',
          'process_error'
        );

        showNotification(`Error: ${data.message || 'Unknown error'}`, 'error');
        addToHistory(useAppStore.getState().config.inputFile!, 'failed');

        // Stay on processing step to show error - don't navigate away
        // Users can see the error and retry or go back manually
      })
    );

    // Process messages (non-JSON output)
    cleanupFunctions.push(
      window.cantocapAPI.onProcessMessage((data) => {
        if (data.message && !data.message.startsWith('Error:')) {
          updateProcessing({
            message: data.message,
          });
        }
      })
    );

      console.log(`✅ Set up ${cleanupFunctions.length} IPC event listeners`);
    } catch (error) {
      console.error("❌ Error setting up IPC event listeners:", error);
      showNotification("Failed to set up IPC listeners", 'error');
    }

    // Cleanup on unmount
    return () => {
      console.log("🔄 Cleaning up App component...");
      try {
        cleanupFunctions.forEach((cleanup) => cleanup());
        if (window.cantocapAPI?.removeAllListeners) {
          window.cantocapAPI.removeAllListeners();
        }
        console.log("✅ App cleanup completed");
      } catch (error) {
        console.error("❌ Error during cleanup:", error);
      }
    };
  }, [
    initializeApp,
    updateProcessing,
    resetProcessing,
    showNotification,
    addToHistory,
    loadConfigFromStorage,
    addDebugMessage,
    processing.engineStage,
    processing.stage,
    restoreUIState
  ]);

  console.log("🔄 App component render, isInitializing:", isInitializing);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            backgroundColor: 'background.default',
            color: 'text.primary',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">
            Initializing CantoCap...
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
          <Box
            sx={{
              height: '100vh',
              backgroundColor: 'background.default',
              color: 'text.primary',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Custom Title Bar */}
            <CustomTitleBar />

            <ErrorBoundary
              fallbackTitle='Content Loading Error'
              fallbackMessage='There was an error loading the main content area. Please try uploading your file again.'
            >
              <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Workspace Panel */}
                <WorkspacePanel />

                {/* Step Navigation */}
                <StepNavigation />

                {/* Main Content Area */}
                <ErrorBoundary
                  fallbackTitle='File Upload Error'
                  fallbackMessage='An error occurred while processing your video file. Please check that the file is not corrupted and try again.'
                >
                  <MainContentArea />
                </ErrorBoundary>
              </Box>
            </ErrorBoundary>

            {/* ProgressPanel removed - processing now shows in step 3 */}
            <NotificationContainer />
            <ModalContainer />
            <DebugPanel />
            <ErrorTestButton position='bottom-right' />
            <DevToolsButton showLabel />
            <DebugMenu />
          </Box>
        </WorkspaceConfigProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
