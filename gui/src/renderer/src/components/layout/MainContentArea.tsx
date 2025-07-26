import React from 'react'
import { Box, Typography } from '@mui/material'
import { useWorkflowStore } from '../../stores/workflow-store'
import { InputFileStep } from '../steps/InputFileStep'
import { ConfigStep } from '../steps/ConfigStep'
import { ProcessingStep } from '../steps/ProcessingStep'
import { ReviewStep } from '../steps/ReviewStep'
import { ExportStep } from '../steps/ExportStep'

export const MainContentArea: React.FC = () => {
  const { currentStep, steps } = useWorkflowStore()
  
  const currentStepData = steps.find(step => step.id === currentStep)

  const renderStepContent = () => {
    switch (currentStep) {
      case 'input-file':
        return <InputFileStep />
      case 'config':
        return <ConfigStep />
      case 'processing':
        return <ProcessingStep />
      case 'review':
        return <ReviewStep />
      case 'export':
        return <ExportStep />
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