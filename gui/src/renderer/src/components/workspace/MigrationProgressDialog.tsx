import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Alert
} from '@mui/material'
import {
  Storage as StorageIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { WorkspaceMigrationProgressProps } from './types'

/**
 * MigrationProgressDialog - Progress dialog for IndexedDB workspace migration
 * Features: Phase-based progress tracking, rollback capability, error handling
 * Now integrated with real-time migration events from IPC
 */
export const MigrationProgressDialog: React.FC<WorkspaceMigrationProgressProps> = ({
  isOpen,
  currentPhase,
  progress,
  canRollback,
  onRollback,
  onClose
}) => {
  const [realTimeProgress, setRealTimeProgress] = useState({ phase: currentPhase, progress })
  const [migrationMessages, setMigrationMessages] = useState<string[]>([])

  // Subscribe to real-time migration progress events
  useEffect(() => {
    if (isOpen && window.cantocapAPI) {
      const unsubscribeProgress = window.cantocapAPI.onWorkspaceMigrationProgress?.(
        (data: { phase: string, progress: number, message: string }) => {
          setRealTimeProgress({ phase: data.phase, progress: data.progress })
          if (data.message) {
            setMigrationMessages(prev => [...prev.slice(-2), data.message]) // Keep last 3 messages
          }
        }
      )

      const unsubscribeMigration = window.cantocapAPI.onWorkspaceMigrationUpdate?.(
        (data: any) => {
          if (data.phase) {
            setRealTimeProgress(prev => ({ ...prev, phase: data.phase }))
          }
          if (data.message) {
            setMigrationMessages(prev => [...prev.slice(-2), data.message])
          }
        }
      )

      return () => {
        unsubscribeProgress?.()
        unsubscribeMigration?.()
      }
    }
  }, [isOpen])

  // Use real-time data if available, fall back to props
  const effectivePhase = realTimeProgress.phase || currentPhase
  const effectiveProgress = realTimeProgress.progress ?? progress
  const migrationPhases = {
    'initializing': {
      title: 'Initializing Migration',
      description: 'Preparing workspace storage system...',
      color: 'info' as const
    },
    'backup': {
      title: 'Creating Backup',
      description: 'Backing up existing data for safety...',
      color: 'warning' as const
    },
    'schema-creation': {
      title: 'Creating Database Schema',
      description: 'Setting up workspace and session tables...',
      color: 'info' as const
    },
    'data-migration': {
      title: 'Migrating Data',
      description: 'Moving existing configuration to workspace format...',
      color: 'info' as const
    },
    'validation': {
      title: 'Validating Migration',
      description: 'Verifying data integrity and consistency...',
      color: 'info' as const
    },
    'cleanup': {
      title: 'Finalizing',
      description: 'Cleaning up temporary files...',
      color: 'success' as const
    },
    'completed': {
      title: 'Migration Complete',
      description: 'Workspace system is now ready to use!',
      color: 'success' as const
    },
    'error': {
      title: 'Migration Failed',
      description: 'An error occurred during migration. You can rollback to the previous state.',
      color: 'error' as const
    },
    'rollback': {
      title: 'Rolling Back',
      description: 'Restoring previous state...',
      color: 'warning' as const
    }
  }

  const phase = migrationPhases[effectivePhase as keyof typeof migrationPhases] || migrationPhases.initializing
  const isCompleted = effectivePhase === 'completed'
  const isError = effectivePhase === 'error'
  const isRollingBack = effectivePhase === 'rollback'

  const getProgressVariant = () => {
    if (isError) return 'determinate'
    if (isCompleted) return 'determinate'
    return effectiveProgress === 0 ? 'indeterminate' : 'determinate'
  }

  const getProgressValue = () => {
    if (isError) return 100
    if (isCompleted) return 100
    return effectiveProgress
  }

  const getProgressColor = () => {
    if (isError) return 'error'
    if (isCompleted) return 'success'
    return 'primary'
  }

  return (
    <Dialog 
      open={isOpen} 
      onClose={isCompleted ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={!isCompleted}
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: 'background.paper'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        pb: 1
      }}>
        <StorageIcon color="primary" />
        Workspace Migration
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        {/* Current Phase Status */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {phase.title}
            </Typography>
            <Chip 
              size="small" 
              label={effectivePhase.replace('-', ' ')}
              color={phase.color}
              variant="outlined"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {phase.description}
          </Typography>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <LinearProgress 
            variant={getProgressVariant()}
            value={getProgressValue()}
            color={getProgressColor()}
            sx={{ 
              height: 8,
              borderRadius: 4,
              backgroundColor: `${getProgressColor()}.main`,
              backgroundOpacity: 0.1
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {isCompleted ? 'Complete' : isError ? 'Failed' : 'In Progress'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round(getProgressValue())}%
            </Typography>
          </Box>
        </Box>

        {/* Success Message */}
        {isCompleted && (
          <Alert 
            severity="success" 
            icon={<SuccessIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              <strong>Migration successful!</strong> Your workspace system is now active. 
              You can create and manage multiple workspaces for different projects.
            </Typography>
          </Alert>
        )}

        {/* Error Message with Rollback Option */}
        {isError && (
          <Alert 
            severity="error" 
            icon={<WarningIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" sx={{ mb: canRollback ? 1 : 0 }}>
              <strong>Migration failed.</strong> Don't worry - your original data is safe.
            </Typography>
            {canRollback && (
              <Typography variant="body2" color="text.secondary">
                You can rollback to restore the previous state, or try the migration again later.
              </Typography>
            )}
          </Alert>
        )}

        {/* Migration Steps Overview */}
        {!isCompleted && !isError && (
          <Box sx={{ 
            p: 2, 
            borderRadius: 2, 
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.1)'
          }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Migration Steps:
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              1. Create backup • 2. Setup database • 3. Migrate data • 4. Validate • 5. Complete
            </Typography>
          </Box>
        )}

        {/* Real-time Migration Messages */}
        {migrationMessages.length > 0 && !isCompleted && (
          <Box sx={{ 
            mt: 2,
            p: 2, 
            borderRadius: 2, 
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            maxHeight: 100,
            overflow: 'auto'
          }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Progress:
            </Typography>
            {migrationMessages.map((message, index) => (
              <Typography 
                key={index} 
                variant="body2" 
                color="text.secondary" 
                sx={{ fontSize: '0.8rem', mb: 0.5 }}
              >
                {message}
              </Typography>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {isError && canRollback && !isRollingBack && (
          <Button 
            onClick={onRollback}
            startIcon={<RefreshIcon />}
            color="warning"
            variant="outlined"
          >
            Rollback
          </Button>
        )}
        
        {isCompleted && (
          <Button 
            onClick={onClose}
            variant="contained"
            color="success"
            startIcon={<SuccessIcon />}
          >
            Continue
          </Button>
        )}
        
        {(isError && !canRollback) && (
          <Button 
            onClick={onClose}
            variant="outlined"
          >
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}