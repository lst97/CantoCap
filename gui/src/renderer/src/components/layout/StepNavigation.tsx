import React from 'react'
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip
} from '@mui/material'
import {
  MoreHoriz as MoreIcon,
  Check as CheckIcon,
  Remove as SkipIcon,
  Error as ErrorIcon
} from '@mui/icons-material'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useAppStore } from '../../store/app-store'

export const StepNavigation: React.FC = () => {
  const { currentStep, steps, setCurrentStep } = useWorkflowStore()
  const { processing } = useAppStore()
  
  // Disable navigation when processing is active (except for the current processing step)
  const isProcessingActive = processing.isActive && processing.stage !== 'idle' && processing.stage !== 'completed'

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
          Subtitle Workflow
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
            {steps.map((step, index) => (
              <ListItemButton
                key={step.id}
                selected={currentStep === step.id}
                disabled={!step.isAccessible || (isProcessingActive && step.id !== 'processing')}
                onClick={() => setCurrentStep(step.id)}
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
                    backgroundColor: step.hasError ? 'error.main' :
                                    step.isSkipped ? 'grey.500' :
                                    step.isCompleted ? 'success.main' : 
                                    currentStep === step.id ? 'primary.main' : 
                                    step.isAccessible ? 'grey.600' : 'grey.800',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    opacity: step.isSkipped ? 0.7 : 1
                  }}>
                    {step.hasError ? (
                      <ErrorIcon sx={{ fontSize: 16 }} />
                    ) : step.isSkipped ? (
                      <SkipIcon sx={{ fontSize: 16 }} />
                    ) : step.isCompleted ? (
                      <CheckIcon sx={{ fontSize: 16 }} />
                    ) : (
                      index + 1
                    )}
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
                      {step.hasError && (
                        <Chip 
                          label="Error" 
                          size="small" 
                          color="error"
                          sx={{ height: 16, fontSize: '0.65rem' }}
                        />
                      )}
                      {step.isSkipped && !step.hasError && (
                        <Chip 
                          label="Skipped" 
                          size="small" 
                          color="default"
                          sx={{ height: 16, fontSize: '0.65rem', opacity: 0.7 }}
                        />
                      )}
                      {step.isCompleted && !step.isSkipped && !step.hasError && (
                        <Chip 
                          label="Done" 
                          size="small" 
                          color="success"
                          sx={{ height: 16, fontSize: '0.65rem' }}
                        />
                      )}
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
            ))}
          </List>
        </Box>
      </Box>
    </Box>
  )
}