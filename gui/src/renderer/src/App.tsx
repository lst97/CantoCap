import React, { useEffect } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, Box } from '@mui/material'
import { useAppStore } from './store/app-store'
import { HeaderBar } from './components/HeaderBar'
import { MainContent } from './components/MainContent'
import { ProgressPanel } from './components/ProgressPanel'
import { NotificationContainer } from './components/NotificationContainer'
import { ModalContainer } from './components/ModalContainer'
import { DebugPanel } from './components/DebugPanel'
import theme from './theme/theme'
import './styles/globals.css'

function App(): JSX.Element {
  const { 
    initializeApp, 
    processing, 
    updateProcessing, 
    resetProcessing,
    showNotification,
    addToHistory,
    loadConfigFromStorage
  } = useAppStore()

  useEffect(() => {
    // Initialize the application
    initializeApp()
    loadConfigFromStorage()

    // Setup IPC event listeners
    const cleanupFunctions: (() => void)[] = []

    // Progress updates
    cleanupFunctions.push(
      window.cantocapAPI.onProgressUpdate((data) => {
        updateProcessing({
          progress: data.progress || 0,
          message: data.message || data.status || 'Processing...',
          stage: data.stage || data.status || 'processing',
          currentStep: data.currentStep,
          totalSteps: data.totalSteps,
          hardwareInfo: data.hardwareInfo
        })
      })
    )

    // Process started
    cleanupFunctions.push(
      window.cantocapAPI.onProcessStarted((data) => {
        updateProcessing({
          isActive: true,
          stage: 'preparing',
          message: data.message || 'Process started'
        })
      })
    )

    // Process completed
    cleanupFunctions.push(
      window.cantocapAPI.onProcessComplete((data) => {
        updateProcessing({
          isActive: false,
          stage: 'completed',
          progress: 100,
          message: data.message || 'Transcription completed successfully'
        })
        
        showNotification('Transcription completed successfully!', 'success')
        addToHistory(useAppStore.getState().config.inputFile!, 'completed', data.outputFile)
      })
    )

    // Process errors
    cleanupFunctions.push(
      window.cantocapAPI.onProcessError((data) => {
        updateProcessing({
          isActive: false,
          stage: 'error',
          error: data.message || 'An error occurred',
          message: `Error: ${data.message || 'Unknown error'}`
        })
        
        showNotification(`Error: ${data.message || 'Unknown error'}`, 'error')
        addToHistory(useAppStore.getState().config.inputFile!, 'failed')
      })
    )

    // Process messages (non-JSON output)
    cleanupFunctions.push(
      window.cantocapAPI.onProcessMessage((data) => {
        if (data.message && !data.message.startsWith('Error:')) {
          updateProcessing({
            message: data.message
          })
        }
      })
    )

    // Cleanup on unmount
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
      window.cantocapAPI.removeAllListeners()
    }
  }, [initializeApp, updateProcessing, resetProcessing, showNotification, addToHistory, loadConfigFromStorage])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: '100vh',
          backgroundColor: 'background.default'
        }}
      >
        <HeaderBar />
        <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <MainContent />
        </Box>
        {processing.isActive && <ProgressPanel />}
        <NotificationContainer />
        <ModalContainer />
        <DebugPanel />
      </Box>
    </ThemeProvider>
  )
}

export default App