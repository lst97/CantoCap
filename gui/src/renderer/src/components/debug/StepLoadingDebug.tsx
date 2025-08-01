import React from 'react'
import { Box, Typography, Paper, Chip } from '@mui/material'
import { useStepLoadingState } from '../../hooks/useStepLoadingState'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useWorkspaceRequirement } from '../../contexts/WorkspaceConfigContext'
import { useWorkspaceStore } from '../../stores/workspace-store'

/**
 * Debug component to display step loading states
 * Use this to verify the loading overlay timing is working correctly
 */
export const StepLoadingDebug: React.FC = () => {
  const { currentStep } = useWorkflowStore()
  const { isReady: isWorkspaceReady } = useWorkspaceRequirement()
  const { isLoading: isWorkspaceLoading, currentWorkspace } = useWorkspaceStore()
  const stepLoadingState = useStepLoadingState(currentStep)

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        position: 'fixed', 
        top: 20, 
        right: 20, 
        p: 2, 
        minWidth: 300,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white'
      }}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        Step Loading Debug
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 120 }}>Current Step:</Typography>
          <Chip label={currentStep} size="small" />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 120 }}>Workspace Ready:</Typography>
          <Chip 
            label={isWorkspaceReady ? 'Ready' : 'Not Ready'} 
            size="small" 
            color={isWorkspaceReady ? 'success' : 'error'}
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 120 }}>Workspace Loading:</Typography>
          <Chip 
            label={isWorkspaceLoading ? 'Loading' : 'Idle'} 
            size="small" 
            color={isWorkspaceLoading ? 'warning' : 'default'}
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 120 }}>Step Loading:</Typography>
          <Chip 
            label={stepLoadingState.isLoading ? 'Loading' : 'Idle'} 
            size="small" 
            color={stepLoadingState.isLoading ? 'warning' : 'default'}
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 120 }}>Step Ready:</Typography>
          <Chip 
            label={stepLoadingState.isReady ? 'Ready' : 'Not Ready'} 
            size="small" 
            color={stepLoadingState.isReady ? 'success' : 'error'}
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 120 }}>Overlay Shown:</Typography>
          <Chip 
            label={stepLoadingState.isLoading ? 'Yes' : 'No'} 
            size="small" 
            color={stepLoadingState.isLoading ? 'primary' : 'default'}
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 120 }}>Transitioning:</Typography>
          <Chip 
            label={stepLoadingState.isTransitioning ? 'Yes' : 'No'} 
            size="small" 
            color={stepLoadingState.isTransitioning ? 'warning' : 'default'}
          />
        </Box>
        
        {currentWorkspace && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 120 }}>Workspace:</Typography>
            <Typography variant="caption">{currentWorkspace.name}</Typography>
          </Box>
        )}
        
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="grey.400">
            Loading Message: {stepLoadingState.loadingMessage}
          </Typography>
          <br />
          <Typography variant="caption" color="grey.400">
            Subtitle: {stepLoadingState.loadingSubtitle}
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}

export default StepLoadingDebug