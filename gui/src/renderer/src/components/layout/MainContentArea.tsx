import React from 'react'
import { Box, Typography } from '@mui/material'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useWorkspaceRequirement } from '../../contexts/WorkspaceConfigContext'
import { useWorkspacePanelIntegration } from '../workspace/hooks'
import { InputFileStep } from '../steps/InputFileStep'
import { ConfigStep } from '../steps/ConfigStep'
import { ProcessingStep } from '../steps/ProcessingStep'
import { ReviewStep } from '../steps/ReviewStep'
import { ExportStep } from '../steps/ExportStep'
import { EmptyWorkspaceState } from '../workspace/EmptyWorkspaceState'
import { ErrorBoundary } from '../common/ErrorBoundary'

export const MainContentArea: React.FC = () => {
  const { currentStep, steps } = useWorkflowStore()
  const { isEmpty, isReady } = useWorkspaceRequirement()
  const { onCreateWorkspace, isLoading } = useWorkspacePanelIntegration()
  
  const currentStepData = steps.find(step => step.id === currentStep)

  // Show empty state if no workspaces exist
  if (isReady && isEmpty) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <EmptyWorkspaceState 
          onCreateWorkspace={onCreateWorkspace}
          isLoading={isLoading}
        />
      </Box>
    )
  }

  // Show loading state while workspace system is initializing
  if (!isReady) {
    return (
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%' 
      }}>
        <Typography variant="body1" color="text.secondary">
          Initializing workspace system...
        </Typography>
      </Box>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'input-file':
        return (
          <ErrorBoundary 
            fallbackTitle="Input File Step Error"
            fallbackMessage="An error occurred in the input file step. Please try refreshing or contact support."
          >
            <InputFileStep />
          </ErrorBoundary>
        )
      case 'config':
        return (
          <ErrorBoundary 
            fallbackTitle="Configuration Step Error"
            fallbackMessage="An error occurred in the configuration step. Please check your settings and try again."
          >
            <ConfigStep />
          </ErrorBoundary>
        )
      case 'processing':
        return (
          <ErrorBoundary 
            fallbackTitle="Processing Step Error"
            fallbackMessage="An error occurred during processing. Please check your files and try again."
          >
            <ProcessingStep />
          </ErrorBoundary>
        )
      case 'review':
        return (
          <ErrorBoundary 
            fallbackTitle="Review Step Error"
            fallbackMessage="An error occurred in the review step. Your progress has been saved automatically."
          >
            <ReviewStep />
          </ErrorBoundary>
        )
      case 'export':
        return (
          <ErrorBoundary 
            fallbackTitle="Export Step Error"
            fallbackMessage="An error occurred during export. Please try again or check your export settings."
          >
            <ExportStep />
          </ErrorBoundary>
        )
      default:
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="h5" color="text.secondary">
              Step not found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The requested step &quot;{currentStep}&quot; could not be loaded.
            </Typography>
          </Box>
        )
    }
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Content Header */}
      <Box 
        sx={{ 
          height: 48,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'rgba(0, 0, 0, 0.05)'
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {currentStepData?.title || currentStep}
        </Typography>
        {currentStepData?.description && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            {currentStepData.description}
          </Typography>
        )}
      </Box>

      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {renderStepContent()}
      </Box>
    </Box>
  )
}