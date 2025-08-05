import React from 'react'
import { Box, Typography } from '@mui/material'
import { workflowStateManager } from '../../services/workflow/workflow-state-manager'
import { useWorkflowState } from '../../contexts/WorkflowStateContext'
import { useWorkspaceRequirement } from '../../contexts/WorkspaceConfigContext'
import { useWorkspacePanelIntegration } from '../workspace/hooks'
import { useUIStore, selectSettingsUI } from '../../stores/ui-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useStepLoadingState } from '../../hooks/useStepLoadingState'
import { InputFileStep } from '../steps/InputFileStep'
import { ConfigStep } from '../steps/ConfigStep'
import { ProcessingStep } from '../steps/ProcessingStep'
import { ReviewStep } from '../steps/ReviewStep'
import { ExportStep } from '../steps/ExportStep'
import { EmptyWorkspaceState } from '../workspace/EmptyWorkspaceState'
import { SettingsContentArea } from '../settings/SettingsContentArea'
import { LoadingOverlay } from '../ui/LoadingOverlay'
import { WorkspaceStepLoadingOverlay } from '../ui/StepLoadingOverlay'
import { ErrorBoundary } from '../common/ErrorBoundary'

export const MainContentArea: React.FC = () => {
  const { currentStep, currentStepId } = useWorkflowState()
  const allSteps = workflowStateManager.getAllSteps()
  const { isEmpty, isReady } = useWorkspaceRequirement()
  const { onCreateWorkspace, isLoading } = useWorkspacePanelIntegration()
  const settingsUI = useUIStore(selectSettingsUI)
  const { exitSettingsMode } = useUIStore()
  
  const currentStepData = allSteps.get(currentStepId)
  
  // Use the comprehensive step loading state hook
  const stepLoadingState = useStepLoadingState(currentStepId)

  // Show settings content area if in settings mode
  if (settingsUI.isSettingsMode) {
    return (
      <>
        <SettingsContentArea onBack={exitSettingsMode} />
        <LoadingOverlay />
      </>
    )
  }

  // Show empty state if no workspaces exist
  if (isReady && isEmpty) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <EmptyWorkspaceState 
          onCreateWorkspace={onCreateWorkspace}
          isLoading={isLoading}
        />
        <LoadingOverlay />
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
        <LoadingOverlay />
      </Box>
    )
  }

  const renderStepContent = () => {
    switch (currentStepId) {
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
              The requested step &quot;{currentStepId}&quot; could not be loaded.
            </Typography>
          </Box>
        )
    }
  }

  return (
    <>
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
            {currentStepData?.definition?.title || (typeof currentStep?.title === 'string' ? currentStep.title : null) || currentStepId || 'Unknown Step'}
          </Typography>
          {currentStepData?.definition?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              {String(currentStepData.definition.description)}
            </Typography>
          )}
        </Box>

        {/* Content Area */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {renderStepContent()}
          
          {/* Step Content Loading Overlay - ONLY shows during workspace operations (not config changes) */}
          <WorkspaceStepLoadingOverlay 
            open={stepLoadingState.isLoading} 
            workspaceName={stepLoadingState.workspaceName}
          />
        </Box>
      </Box>
      
      {/* Global Loading Overlay */}
      <LoadingOverlay />
    </>
  )
}