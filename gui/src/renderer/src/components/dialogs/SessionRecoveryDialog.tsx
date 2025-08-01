/**
 * Session Recovery Dialog
 * 
 * Shows when users return to Step 4 and there's a recoverable subtitle editing session
 */

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material'
import { 
  Restore as RestoreIcon, 
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material'

interface SessionRecoveryDialogProps {
  open: boolean
  sessionId: string | null
  sessionInfo?: {
    lastModified: number
    subtitleCount: number
    editCount: number
    workspaceId: string
  }
  onRecover: (sessionId: string) => Promise<boolean>
  onDiscard: () => void
  onClose: () => void
}

export const SessionRecoveryDialog: React.FC<SessionRecoveryDialogProps> = ({
  open,
  sessionId,
  sessionInfo,
  onRecover,
  onDiscard,
  onClose
}) => {
  const [isRecovering, setIsRecovering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRecover = async () => {
    if (!sessionId) return
    
    setIsRecovering(true)
    setError(null)
    
    try {
      const success = await onRecover(sessionId)
      if (success) {
        onClose()
      } else {
        setError('Failed to recover session. This could be due to corrupted data or storage issues. You can still start fresh and your processed subtitles will be available.')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Recovery failed: ${errorMessage}. You can start fresh and continue working.`)
      console.error('Session recovery error:', err)
    } finally {
      setIsRecovering(false)
    }
  }

  const handleDiscard = () => {
    onDiscard()
    onClose()
  }

  const formatLastModified = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString()
  }

  if (!sessionId) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreIcon color="primary" />
          <Typography variant="h6" component="span">
            Recover Previous Session
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert 
          severity="info" 
          icon={<WarningIcon />}
          sx={{ mb: 3 }}
        >
          We found a previous subtitle editing session that wasn't completed. 
          You can recover your work or start fresh.
        </Alert>

        {sessionInfo && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Session Details
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  Last modified: {formatLastModified(sessionInfo.lastModified)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={`${sessionInfo.subtitleCount} subtitles`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`${sessionInfo.editCount} edits made`}
                  variant="outlined"
                  color={sessionInfo.editCount > 0 ? 'primary' : 'default'}
                />
              </Box>
            </Box>
          </Box>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => {
                  setError(null)
                  handleRecover()
                }}
                disabled={isRecovering}
              >
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary">
          <strong>Recover Session:</strong> Continue where you left off with all your previous edits intact.
          {sessionInfo?.editCount && sessionInfo.editCount > 0 && (
            <> Your {sessionInfo.editCount} unsaved edit{sessionInfo.editCount === 1 ? '' : 's'} will be restored.</>
          )}
          <br />
          <strong>Start Fresh:</strong> Begin a new editing session (previous edits will be permanently lost).
        </Typography>
        
        {!error && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            💡 Your processed subtitles are always safe - this only affects manual edits made in the review step.
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={handleDiscard}
          color="error"
          variant="outlined"
          startIcon={<DeleteIcon />}
          disabled={isRecovering}
        >
          Start Fresh
        </Button>
        
        <Button
          onClick={handleRecover}
          color="primary"
          variant="contained"
          startIcon={isRecovering ? <CircularProgress size={16} /> : <RestoreIcon />}
          disabled={isRecovering}
          sx={{ minWidth: 140 }}
        >
          {isRecovering ? 'Recovering...' : 'Recover Session'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}