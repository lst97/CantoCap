/**
 * Comprehensive usage examples for the refactored WorkflowStateManager system
 * Demonstrates integration patterns, best practices, and migration strategies
 */

import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Grid
} from '@mui/material'
import {
  PlayArrow as StartIcon,
  Check as CompleteIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Block as BlockIcon,
  Skip as SkipIcon
} from '@mui/icons-material'

// New WorkflowStateManager imports
import {
  useWorkflowState,
  useWorkflowNavigation,
  useStepState,
  useStepTransitions,
  useWorkflowControl,
  useStepValidation
} from '../hooks/useWorkflowStateManager'
import { StepState } from '../types/workflow-state'
import { WorkflowStateErrorBoundary } from '../components/common/WorkflowStateErrorBoundary'
import { WorkflowStepWrapper } from '../components/steps/WorkflowStepWrapper'
import { useWorkflowIntegration } from '../utils/react-state-utils'

/**
 * Main usage example component showing all features
 */
export const WorkflowStateManagerDemo: React.FC = () => {
  return (
    <WorkflowStateErrorBoundary>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          WorkflowStateManager Usage Examples
        </Typography>
        
        <Stack spacing={4}>
          <BasicUsageExample />
          <StepManagementExample />
          <TransitionControlExample />
          <ErrorHandlingExample />
          <MigrationExample />
          <PerformanceExample />
        </Stack>
      </Box>
    </WorkflowStateErrorBoundary>
  )
}

/**
 * Basic usage example - reading workflow state
 */
const BasicUsageExample: React.FC = () => {
  const { steps, currentStep, currentStepId } = useWorkflowState()
  const { getStepProgress } = useWorkflowValidation()
  
  const progress = getStepProgress()
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          1. Basic Workflow State Reading
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Current Progress
            </Typography>
            <Alert severity="info">
              Step: {currentStep?.title || 'None'} ({currentStepId})<br />
              Progress: {progress.completedSteps}/{progress.totalSteps} steps ({Math.round(progress.progressPercentage)}%)
            </Alert>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              All Steps Status
            </Typography>
            <Stack spacing={1}>
              {steps.map(step => (
                <Box key={step.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StepStateChip state={step.stateMetadata.state} />
                  <Typography variant="body2">{step.title}</Typography>
                </Box>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

/**
 * Individual step management example
 */
const StepManagementExample: React.FC = () => {
  const { step, state, isAccessible } = useStepState('config')
  const { navigateToStep, canNavigateToStep } = useWorkflowNavigation()
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          2. Individual Step Management
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Config Step Details
            </Typography>
            <Alert severity={isAccessible ? 'success' : 'warning'}>
              <strong>State:</strong> {state}<br />
              <strong>Accessible:</strong> {isAccessible ? 'Yes' : 'No'}<br />
              <strong>Can Navigate:</strong> {canNavigateToStep('config') ? 'Yes' : 'No'}
            </Alert>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Navigation Actions
            </Typography>
            <Stack spacing={1}>
              <Button
                variant="outlined"
                disabled={!canNavigateToStep('config')}
                onClick={() => navigateToStep('config')}
              >
                Navigate to Config
              </Button>
              {step && (
                <Typography variant="caption" color="text.secondary">
                  Last modified: {new Date(step.stateMetadata.lastModified).toLocaleString()}
                </Typography>
              )}
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

/**
 * State transition control example
 */
const TransitionControlExample: React.FC = () => {
  const {
    markStepComplete,
    markStepError,
    markStepReady,
    markStepBlocked,
    markStepSkipped,
    isTransitioning,
    lastError
  } = useStepTransitions()
  
  const [selectedStep, setSelectedStep] = useState('input-file')
  
  const handleTransition = async (action: string) => {
    try {
      switch (action) {
        case 'complete':
          await markStepComplete(selectedStep)
          break
        case 'error':
          await markStepError(selectedStep, 'Demo error message')
          break
        case 'ready':
          await markStepReady(selectedStep)
          break
        case 'blocked':
          await markStepBlocked(selectedStep, 'Demo blocked reason')
          break
        case 'skip':
          await markStepSkipped(selectedStep, 'Demo skip reason')
          break
      }
    } catch (error) {
      console.error('Transition failed:', error)
    }
  }
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          3. State Transition Control
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Select Step & Action
            </Typography>
            <Stack spacing={2}>
              <select 
                value={selectedStep} 
                onChange={(e) => setSelectedStep(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px' }}
              >
                <option value="input-file">Input File</option>
                <option value="config">Configuration</option>
                <option value="processing">Processing</option>
                <option value="review">Review</option>
                <option value="export">Export</option>
              </select>
              
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button size="small" onClick={() => handleTransition('ready')} disabled={isTransitioning}>
                  Ready
                </Button>
                <Button size="small" onClick={() => handleTransition('complete')} disabled={isTransitioning}>
                  Complete
                </Button>
                <Button size="small" onClick={() => handleTransition('error')} disabled={isTransitioning}>
                  Error
                </Button>
                <Button size="small" onClick={() => handleTransition('blocked')} disabled={isTransitioning}>
                  Block
                </Button>
                <Button size="small" onClick={() => handleTransition('skip')} disabled={isTransitioning}>
                  Skip
                </Button>
              </Stack>
            </Stack>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Transition Status
            </Typography>
            {isTransitioning && (
              <Alert severity="info">Transitioning...</Alert>
            )}
            {lastError && (
              <Alert severity="error" onClose={() => {}}>
                Error: {lastError}
              </Alert>
            )}
            {!isTransitioning && !lastError && (
              <Alert severity="success">Ready for transitions</Alert>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

/**
 * Error handling and recovery example
 */
const ErrorHandlingExample: React.FC = () => {
  const { resetWorkflow, saveState, loadState, isBusy } = useWorkflowControl()
  const [actionResult, setActionResult] = useState<string | null>(null)
  
  const handleAction = async (action: 'reset' | 'save' | 'load') => {
    setActionResult(null)
    
    try {
      let result
      switch (action) {
        case 'reset':
          result = await resetWorkflow()
          break
        case 'save':
          result = await saveState()
          break
        case 'load':
          result = await loadState()
          break
      }
      
      setActionResult(result.success ? `${action} succeeded` : `${action} failed: ${result.error}`)
    } catch (error) {
      setActionResult(`${action} error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          4. Error Handling & Recovery
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Workflow Control Actions
            </Typography>
            <Stack spacing={1}>
              <Button 
                variant="outlined" 
                onClick={() => handleAction('reset')}
                disabled={isBusy}
              >
                Reset Workflow
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => handleAction('save')}
                disabled={isBusy}
              >
                Save State
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => handleAction('load')}
                disabled={isBusy}
              >
                Load State
              </Button>
            </Stack>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Action Results
            </Typography>
            {isBusy && <Alert severity="info">Processing...</Alert>}
            {actionResult && (
              <Alert severity={actionResult.includes('succeeded') ? 'success' : 'error'}>
                {actionResult}
              </Alert>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

/**
 * Migration and compatibility example
 */
const MigrationExample: React.FC = () => {
  const { 
    checkStateConsistency,
    synchronizeState,
    currentStepId,
    steps
  } = useWorkflowIntegration()
  
  const [migrationResult, setMigrationResult] = useState<string | null>(null)
  const [isConsistent, setIsConsistent] = useState(true)
  
  const handleMigration = async () => {
    setMigrationResult('Migrating...')
    try {
      await synchronizeState()
      const consistent = checkStateConsistency()
      setIsConsistent(consistent)
      setMigrationResult(consistent ? 'Migration successful' : 'Migration completed with warnings')
    } catch (error) {
      setMigrationResult('Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          5. Migration & Legacy Compatibility
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Migration Status
            </Typography>
            <Alert severity={isConsistent ? 'success' : 'warning'}>
              <strong>Consistent:</strong> {isConsistent ? 'Yes' : 'No'}<br />
              <strong>Steps Count:</strong> {steps.length}<br />
              <strong>Current Step:</strong> {currentStepId}
            </Alert>
            
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Button size="small" onClick={handleMigration}>
                Run Migration
              </Button>
              <Button size="small" onClick={() => synchronizeState()}>
                Force Sync
              </Button>
            </Stack>
            
            {migrationResult && (
              <Alert severity="info" sx={{ mt: 1 }}>
                {migrationResult}
              </Alert>
            )}
          </Grid>
          
        </Grid>
      </CardContent>
    </Card>
  )
}

/**
 * Performance monitoring example
 */
const PerformanceExample: React.FC = () => {
  const { _updateCount } = useWorkflowState()
  const [renderCount, setRenderCount] = useState(0)
  
  useEffect(() => {
    setRenderCount(prev => prev + 1)
  })
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          6. Performance Monitoring
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Update Metrics
            </Typography>
            <Alert severity="info">
              <strong>State Updates:</strong> {_updateCount}<br />
              <strong>Component Renders:</strong> {renderCount}<br />
              <strong>Efficiency:</strong> {renderCount > 0 ? (_updateCount / renderCount * 100).toFixed(1) : 0}%
            </Alert>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Performance Tips
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Use specific step hooks instead of full state<br />
              • Memoize expensive calculations<br />
              • Use error boundaries for isolation<br />
              • Monitor update frequency vs renders
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

/**
 * Utility component for displaying step state chips
 */
const StepStateChip: React.FC<{ state: StepState }> = ({ state }) => {
  const getChipProps = () => {
    switch (state) {
      case StepState.Ready:
        return { label: 'Ready', color: 'primary' as const, icon: <StartIcon /> }
      case StepState.Complete:
        return { label: 'Complete', color: 'success' as const, icon: <CompleteIcon /> }
      case StepState.Error:
        return { label: 'Error', color: 'error' as const, icon: <ErrorIcon /> }
      case StepState.Warning:
        return { label: 'Warning', color: 'warning' as const, icon: <WarningIcon /> }
      case StepState.Blocked:
        return { label: 'Blocked', color: 'default' as const, icon: <BlockIcon /> }
      case StepState.Skip:
        return { label: 'Skipped', color: 'default' as const, icon: <SkipIcon /> }
      default:
        return { label: 'Unknown', color: 'default' as const, icon: null }
    }
  }
  
  const { label, color, icon } = getChipProps()
  
  return (
    <Chip 
      label={label} 
      color={color} 
      size="small" 
      icon={icon}
      sx={{ fontSize: '0.7rem' }}
    />
  )
}

/**
 * Example of wrapped step component
 */
export const ExampleStepComponent: React.FC = () => {
  return (
    <WorkflowStepWrapper
      stepId="config"
      autoTransitionOnMount={true}
      requiredConditions={[
        () => true, // Example condition
      ]}
      onStepComplete={async () => {
        console.log('Config step completed!')
      }}
      onStepError={(error) => {
        console.error('Config step error:', error)
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">Configuration Step Content</Typography>
        <Typography variant="body2">
          This content is automatically wrapped with state management,
          error handling, and accessibility features.
        </Typography>
      </Box>
    </WorkflowStepWrapper>
  )
}

export default WorkflowStateManagerDemo