import React from 'react'
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Tooltip
} from '@mui/material'
import {
  MoreHoriz as MoreIcon,
  Check as CheckIcon,
  Remove as SkipIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Block as BlockedIcon
} from '@mui/icons-material'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useAppStore } from '../../stores/app-store'
import { useWorkflowValidationStore } from '../../stores/workflow-validation-store'
import { useUIStore, selectSettingsUI } from '../../stores/ui-store'
import { useWorkflowIntegration } from '../../hooks/useWorkflowIntegration'
import { useWorkspaceStore } from '../../stores/workspace-store'

export const StepNavigation: React.FC = () => {
  const { currentStep, steps } = useWorkflowStore()
  const { processing } = useAppStore()
  const validationStore = useWorkflowValidationStore()
  const settingsUI = useUIStore(selectSettingsUI)
  const { currentWorkspace } = useWorkspaceStore()
  const { navigateToStep } = useWorkflowIntegration()
  
  // Disable navigation when processing is active (except for the current processing step)
  const isProcessingActive = processing.isActive && processing.stage !== 'idle' && processing.stage !== 'completed'
  
  // Hide step navigation when in settings mode
  if (settingsUI.isSettingsMode) {
    return null
  }
  
  const handleStepClick = async (stepId: string) => {
    await navigateToStep(stepId)
  }
  
  const getStepValidation = (stepId: string) => {
    return validationStore.stepValidations[stepId]
  }
  
  const getStepIcon = (step: any, index: number) => {
    const validation = getStepValidation(step.id)
    
    // Special logic for input-file step - never show error (it's the entry point)
    if (step.id === 'input-file') {
      if (step.isCompleted) {
        return <CheckIcon sx={{ fontSize: 16 }} />
      }
      if (step.isSkipped) {
        return <SkipIcon sx={{ fontSize: 16 }} />
      }
      // Show number for input-file step (never error)
      return index + 1
    }
    
    // Special logic for config step - only when accessible
    if (step.id === 'config' && step.isAccessible && (validation?.canAccess !== false)) {
      if (step.isCompleted) {
        return <CheckIcon sx={{ fontSize: 16 }} />
      }
      if (step.isSkipped) {
        return <SkipIcon sx={{ fontSize: 16 }} />
      }
      // Show number instead of error for accessible config step
      return index + 1
    }
    
    if (step.hasError) {
      return <ErrorIcon sx={{ fontSize: 16 }} />
    }
    
    if (validation && !validation.canAccess && !step.isCompleted) {
      return <BlockedIcon sx={{ fontSize: 16 }} />
    }
    
    if (step.isSkipped) {
      return <SkipIcon sx={{ fontSize: 16 }} />
    }
    
    if (step.isCompleted) {
      return <CheckIcon sx={{ fontSize: 16 }} />
    }
    
    if (validation && validation.warnings.length > 0) {
      return <WarningIcon sx={{ fontSize: 16 }} />
    }
    
    return index + 1
  }
  
  const getStepColor = (step: any) => {
    const validation = getStepValidation(step.id)
    
    // Special logic for input-file step - never show error color
    if (step.id === 'input-file') {
      if (step.isCompleted) return 'success.main'
      if (currentStep === step.id) return 'primary.main'
      if (step.isSkipped) return 'grey.500'
      return 'grey.600' // Normal accessible color
    }
    
    // Special logic for config step - only when accessible
    if (step.id === 'config' && step.isAccessible && (validation?.canAccess !== false)) {
      if (step.isCompleted) return 'success.main'
      if (currentStep === step.id) return 'primary.main'
      if (step.isSkipped) return 'grey.500'
      return 'grey.600' // Normal accessible color
    }
    
    if (step.hasError) return 'error.main'
    if (validation && !validation.canAccess && !step.isCompleted) return 'grey.800'
    if (step.isSkipped) return 'grey.500'
    if (step.isCompleted) return 'success.main'
    if (currentStep === step.id) return 'primary.main'
    if (validation && validation.warnings.length > 0) return 'warning.main'
    if (step.isAccessible) return 'grey.600'
    return 'grey.800'
  }
  
  const getStepTooltip = (step: any) => {
    const validation = getStepValidation(step.id)
    
    if (step.hasError) {
      return `Error: ${step.errorMessage || 'Unknown error'}`
    }
    
    if (validation && !validation.canAccess) {
      return `Blocked: ${validation.errors.join(', ')}`
    }
    
    if (validation && validation.warnings.length > 0) {
      return `Warning: ${validation.warnings.join(', ')}`
    }
    
    if (!step.isAccessible) {
      return 'Complete previous steps to unlock'
    }
    
    return step.description
  }

  // Get the highest priority chip to display (only one chip at a time)
  const getStepChip = (step: any) => {
    const validation = getStepValidation(step.id)
    
    // Priority order (highest to lowest):
    // 1. Error (highest priority)
    // 2. Blocked
    // 3. Warning  
    // 4. Skipped
    // 5. Done/Completed
    // 6. Ready (lowest priority)
    
    // Error chip (highest priority)
    if (step.hasError && step.id !== 'input-file' && !(step.id === 'config' && step.isAccessible)) {
      return (
        <Chip 
          label="Error" 
          size="small" 
          color="error"
          sx={{ height: 16, fontSize: '0.65rem' }}
        />
      )
    }
    
    // Blocked chip
    if (validation && !validation.canAccess && !step.hasError) {
      return (
        <Chip 
          label="Blocked" 
          size="small" 
          color="default"
          sx={{ height: 16, fontSize: '0.65rem', opacity: 0.8 }}
        />
      )
    }
    
    // Warning chip
    if (validation && validation.warnings.length > 0 && !step.hasError) {
      return (
        <Chip 
          label="Warning" 
          size="small" 
          color="warning"
          sx={{ height: 16, fontSize: '0.65rem' }}
        />
      )
    }
    
    // Skipped chip
    if (step.isSkipped && !step.hasError) {
      return (
        <Chip 
          label="Skipped" 
          size="small" 
          color="default"
          sx={{ height: 16, fontSize: '0.65rem', opacity: 0.7 }}
        />
      )
    }
    
    // Done/Completed chip
    if (step.isCompleted && !step.isSkipped && !step.hasError) {
      return (
        <Chip 
          label="Done" 
          size="small" 
          color="success"
          sx={{ height: 16, fontSize: '0.65rem' }}
        />
      )
    }
    
    // Ready chip (lowest priority - only show for config step when accessible)
    if (step.id === 'config' && step.isAccessible && (validation?.canAccess !== false) && !step.isCompleted && !step.isSkipped) {
      return (
        <Chip 
          label="Ready" 
          size="small" 
          color="primary"
          sx={{ height: 16, fontSize: '0.65rem' }}
        />
      )
    }
    
    // Return null if no chip should be displayed
    return null
  }

  return (
    <Box 
      sx={{ 
        width: 280,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider'
      }}
    >
      {/* Header */}
      <Box 
        sx={{ 
          height: 48,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {currentWorkspace?.name || 'Subtitle Workflow'}
        </Typography>
        <IconButton size="small">
          <MoreIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Steps */}
      <Box sx={{ flex: 1, p: 1, overflow: 'auto' }}>
        <Box sx={{ mb: 2 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              px: 1,
              py: 0.5,
              fontWeight: 600,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 1
            }}
          >
            Processing Steps
          </Typography>
          <List dense sx={{ mt: 0.5 }}>
            {steps.map((step, index) => {
              const validation = getStepValidation(step.id)
              const isDisabled = !step.isAccessible || 
                                (validation && !validation.canAccess) ||
                                (isProcessingActive && step.id !== 'processing')
              
              return (
                <Tooltip
                  key={step.id}
                  title={getStepTooltip(step)}
                  placement="right"
                  arrow
                >
                  <ListItemButton
                    selected={currentStep === step.id}
                    disabled={isDisabled}
                    onClick={() => handleStepClick(step.id)}
                    sx={{
                      borderRadius: 1,
                      mx: 0.5,
                      mb: 0.5,
                      minHeight: 60,
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        color: 'primary.main',
                        borderLeft: 3,
                        borderColor: 'primary.main',
                        '&:hover': {
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        }
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                      '&.Mui-disabled': {
                        opacity: 0.5
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: 28, 
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: getStepColor(step),
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        opacity: step.isSkipped ? 0.7 : 1
                      }}>
                        {getStepIcon(step, index)}
                      </Box>
                    </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 600, 
                          fontSize: '0.875rem',
                          opacity: step.isSkipped ? 0.7 : 1,
                          textDecoration: step.isSkipped ? 'line-through' : 'none'
                        }}
                      >
                        {step.title}
                      </Typography>
                      {getStepChip(step)}
                    </Box>
                  }
                  secondary={step.description}
                  primaryTypographyProps={{ 
                    fontWeight: currentStep === step.id ? 600 : 400
                  }}
                  secondaryTypographyProps={{ 
                    fontSize: '0.75rem',
                    color: 'text.secondary'
                  }}
                />
                  </ListItemButton>
                </Tooltip>
              )
            })}
          </List>
        </Box>
      </Box>
    </Box>
  )
}