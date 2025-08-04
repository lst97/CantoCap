/**
 * Example Usage of Workflow State Transitions
 * Demonstrates how to integrate the new atomic workflow state operations
 * with error boundaries and step components
 */

import React, { useCallback, useState } from 'react'
import { Box, Button, Typography, Alert, Stack } from '@mui/material'
import { WorkflowStateErrorBoundary } from '../components/common/WorkflowStateErrorBoundary'
import {
  useWorkflowStateTransitions,
  useStepErrorHandling,
  useProcessingStateManagement,
  useFileUploadStateManagement
} from '../hooks/useWorkflowStateTransitions'

/**
 * Example Input File Step with Error Boundary Integration
 */
function ExampleInputFileStep() {
  const { uploadVideo, removeVideo, uploadJson } = useFileUploadStateManagement()
  const { markError, markWarning, clearError } = useStepErrorHandling('input-file')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Clear any previous errors
      await clearError()

      if (file.name.endsWith('.json')) {
        // JSON import workflow
        await uploadJson(file.path)
        setSelectedFile(file.path)
      } else if (file.name.match(/\.(mp4|avi|mov|mkv)$/i)) {
        // Video upload workflow
        await uploadVideo(file.path)
        setSelectedFile(file.path)
      } else {
        // Invalid file type
        await markWarning('Unsupported file type. Please select a video file or JSON subtitle file.')
      }
    } catch (error) {
      await markError(`Failed to upload file: ${(error as Error).message}`, 'high')
    }
  }, [uploadVideo, uploadJson, markError, markWarning, clearError])

  const handleFileRemove = useCallback(async () => {
    try {
      await removeVideo()
      setSelectedFile(null)
      await clearError()
    } catch (error) {
      await markError(`Failed to remove file: ${(error as Error).message}`, 'medium')
    }
  }, [removeVideo, clearError, markError])

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Input File Step
      </Typography>
      
      <Stack spacing={2}>
        <input
          type="file"
          accept=".mp4,.avi,.mov,.mkv,.json"
          onChange={handleFileSelect}
        />
        
        {selectedFile && (
          <Alert severity="success">
            File selected: {selectedFile}
            <Button size="small" onClick={handleFileRemove} sx={{ ml: 1 }}>
              Remove
            </Button>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}

/**
 * Example Processing Step with State Management
 */
function ExampleProcessingStep() {
  const { startProcessing, completeProcessing, errorProcessing } = useProcessingStateManagement()
  const { markWarning } = useStepErrorHandling('processing')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleStartProcessing = useCallback(async () => {
    try {
      setIsProcessing(true)
      await startProcessing()
      
      // Simulate processing
      setTimeout(async () => {
        try {
          // Simulate random success/failure
          if (Math.random() > 0.3) {
            await completeProcessing()
          } else {
            await errorProcessing('Processing failed due to audio quality issues')
          }
        } catch (error) {
          await errorProcessing(`Unexpected error: ${(error as Error).message}`)
        } finally {
          setIsProcessing(false)
        }
      }, 3000)
    } catch (error) {
      await errorProcessing(`Failed to start processing: ${(error as Error).message}`)
      setIsProcessing(false)
    }
  }, [startProcessing, completeProcessing, errorProcessing])

  const handleRetryProcessing = useCallback(async () => {
    await markWarning('Retrying processing with adjusted settings...')
    await handleStartProcessing()
  }, [handleStartProcessing, markWarning])

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Processing Step
      </Typography>
      
      <Stack spacing={2}>
        <Button
          variant="contained"
          onClick={handleStartProcessing}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Start Processing'}
        </Button>
        
        <Button
          variant="outlined"
          onClick={handleRetryProcessing}
          disabled={isProcessing}
        >
          Retry with Different Settings
        </Button>
        
        {isProcessing && (
          <Alert severity="info">
            Processing in progress. All other steps are temporarily blocked.
          </Alert>
        )}
      </Stack>
    </Box>
  )
}

/**
 * Example Configuration Step
 */
function ExampleConfigStep() {
  const { handleConfigurationComplete } = useWorkflowStateTransitions()
  const { markError, clearError } = useStepErrorHandling('config')
  const [language, setLanguage] = useState('')
  const [model, setModel] = useState('')

  const handleGenerateSubtitles = useCallback(async () => {
    try {
      // Clear any previous errors
      await clearError()

      // Validate configuration
      if (!language || !model) {
        await markError('Please select both language and model before generating subtitles', 'medium')
        return
      }

      // Complete configuration and move to processing
      await handleConfigurationComplete()
    } catch (error) {
      await markError(`Configuration error: ${(error as Error).message}`, 'high')
    }
  }, [language, model, handleConfigurationComplete, markError, clearError])

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Configuration Step
      </Typography>
      
      <Stack spacing={2}>
        <Box>
          <Typography variant="body2" gutterBottom>Language:</Typography>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">Select Language</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </Box>
        
        <Box>
          <Typography variant="body2" gutterBottom>Model:</Typography>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Select Model</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </Box>
        
        <Button
          variant="contained"
          onClick={handleGenerateSubtitles}
          disabled={!language || !model}
        >
          Generate Subtitles
        </Button>
      </Stack>
    </Box>
  )
}

/**
 * Main example component showing error boundary integration
 */
export function WorkflowStateTransitionUsage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Workflow State Transition Examples
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3 }}>
        This demonstrates the new atomic workflow state transitions with integrated error handling.
      </Typography>
      
      <Stack spacing={4}>
        {/* Input File Step with Error Boundary */}
        <WorkflowStateErrorBoundary
          stepId="input-file"
          autoMarkStepError={true}
        >
          <ExampleInputFileStep />
        </WorkflowStateErrorBoundary>
        
        {/* Config Step with Error Boundary */}
        <WorkflowStateErrorBoundary
          stepId="config"
          autoMarkStepError={true}
        >
          <ExampleConfigStep />
        </WorkflowStateErrorBoundary>
        
        {/* Processing Step with Error Boundary */}
        <WorkflowStateErrorBoundary
          stepId="processing"
          autoMarkStepError={true}
        >
          <ExampleProcessingStep />
        </WorkflowStateErrorBoundary>
      </Stack>
      
      <Box sx={{ mt: 4, p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          State Transition Rules Implemented:
        </Typography>
        <ul>
          <li><strong>Video removal:</strong> All steps reset to Blocked except Step 1 → Ready</li>
          <li><strong>Video upload:</strong> Step 1 → Complete, Step 2 → Ready, NO auto-navigation</li>
          <li><strong>JSON import after video:</strong> Step 4 → Ready, Steps 2&3 → Skip, navigate to Step 4</li>
          <li><strong>Generate subtitle:</strong> Step 2 → Complete, Step 3 → Ready</li>
          <li><strong>Processing:</strong> During processing ALL other steps → Blocked until complete/error</li>
          <li><strong>Export:</strong> Step 4 → Complete, Step 5 → Ready</li>
          <li><strong>Error handling:</strong> Error boundaries automatically set step state to Error</li>
        </ul>
      </Box>
    </Box>
  )
}