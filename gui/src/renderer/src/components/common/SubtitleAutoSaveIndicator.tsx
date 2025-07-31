/**
 * SubtitleAutoSaveIndicator Component
 * 
 * Visual indicator for subtitle file operations and auto-save status.
 * Shows loading states, success indicators, and error messages.
 */

import React, { useState, useEffect } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
  Alert,
  Collapse,
  Typography,
  LinearProgress
} from '@mui/material'
import {
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon,
  Cached as RefreshIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import type { UseSubtitlePersistenceResult } from '../../hooks/useSubtitlePersistence'
import type { SubtitleFileError } from '../../types/subtitle-persistence'

/**
 * Component props
 */
interface SubtitleAutoSaveIndicatorProps {
  /** Subtitle persistence hook result */
  persistenceData: UseSubtitlePersistenceResult
  /** Show detailed information */
  showDetails?: boolean
  /** Show performance metrics */
  showPerformance?: boolean
  /** Compact mode for smaller displays */
  compact?: boolean
  /** Custom CSS class */
  className?: string
  /** Position of the indicator */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline'
  /** Auto-hide success messages after delay */
  autoHideSuccess?: boolean
  /** Auto-hide delay in milliseconds */
  autoHideDelay?: number
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Get error severity color
 */
function getErrorSeverity(error: SubtitleFileError): 'error' | 'warning' | 'info' {
  const criticalCodes = [
    'SUBTITLE_FILE_CORRUPTED',
    'SUBTITLE_FILE_ACCESS_DENIED',
    'SUBTITLE_CHECKSUM_MISMATCH'
  ]
  
  const warningCodes = [
    'SUBTITLE_FILE_TOO_LARGE',
    'SUBTITLE_VALIDATION_FAILED',
    'SUBTITLE_OPERATION_TIMEOUT'
  ]
  
  if (criticalCodes.includes(error.code)) return 'error'
  if (warningCodes.includes(error.code)) return 'warning'
  return 'info'
}

/**
 * SubtitleAutoSaveIndicator component
 */
export const SubtitleAutoSaveIndicator: React.FC<SubtitleAutoSaveIndicatorProps> = ({
  persistenceData,
  showDetails = false,
  showPerformance = false,
  compact = false,
  className,
  position = 'top-right',
  autoHideSuccess = true,
  autoHideDelay = 3000
}) => {
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [expandedDetails, setExpandedDetails] = useState(false)

  const {
    isLoadingFiles,
    isSavingFiles,
    isAutoSaving,
    isValidating,
    lastAutoSave,
    hasUnsavedChanges,
    pendingOperations,
    error,
    fileErrors,
    performanceMetrics,
    cacheMetrics,
    clearError,
    clearFileError,
    saveAll
  } = persistenceData

  // Auto-hide success message
  useEffect(() => {
    if (lastAutoSave && autoHideSuccess) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), autoHideDelay)
      return () => clearTimeout(timer)
    }
  }, [lastAutoSave, autoHideSuccess, autoHideDelay])

  // Show/hide error messages
  useEffect(() => {
    setShowError(!!(error || Object.keys(fileErrors).length > 0))
  }, [error, fileErrors])

  /**
   * Get position styles
   */
  const getPositionStyles = () => {
    if (position === 'inline') return {}
    
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1300,
      gap: 1,
      display: 'flex',
      flexDirection: 'column' as const
    }
    
    switch (position) {
      case 'top-right':
        return { ...baseStyles, top: 16, right: 16 }
      case 'top-left':
        return { ...baseStyles, top: 16, left: 16 }
      case 'bottom-right':
        return { ...baseStyles, bottom: 16, right: 16 }
      case 'bottom-left':
        return { ...baseStyles, bottom: 16, left: 16 }
      default:
        return baseStyles
    }
  }

  /**
   * Get current status info
   */
  const getStatusInfo = () => {
    if (isLoadingFiles) {
      return {
        icon: <CircularProgress size={16} />,
        label: 'Loading files...',
        color: 'primary' as const,
        variant: 'filled' as const
      }
    }
    
    if (isSavingFiles || isAutoSaving) {
      return {
        icon: <SaveIcon />,
        label: isAutoSaving ? 'Auto-saving...' : 'Saving...',
        color: 'primary' as const,
        variant: 'filled' as const
      }
    }
    
    if (isValidating) {
      return {
        icon: <CircularProgress size={16} />,
        label: 'Validating...',
        color: 'secondary' as const,
        variant: 'filled' as const
      }
    }
    
    if (error || Object.keys(fileErrors).length > 0) {
      const errorCount = Object.keys(fileErrors).length + (error ? 1 : 0)
      return {
        icon: <ErrorIcon />,
        label: `${errorCount} error${errorCount > 1 ? 's' : ''}`,
        color: 'error' as const,
        variant: 'filled' as const
      }
    }
    
    if (hasUnsavedChanges) {
      return {
        icon: <ScheduleIcon />,
        label: 'Unsaved changes',
        color: 'warning' as const,
        variant: 'outlined' as const
      }
    }
    
    if (lastAutoSave && showSuccess) {
      return {
        icon: <CheckCircleIcon />,
        label: 'Files saved',
        color: 'success' as const,
        variant: 'filled' as const
      }
    }
    
    if (lastAutoSave) {
      const timeSince = Date.now() - lastAutoSave
      return {
        icon: <CheckCircleIcon />,
        label: `Saved ${formatDuration(timeSince)} ago`,
        color: 'success' as const,
        variant: 'outlined' as const
      }
    }
    
    return null
  }

  const statusInfo = getStatusInfo()
  const hasActivity = pendingOperations > 0
  const fileErrorEntries = Object.entries(fileErrors)

  // Don't render if no status to show
  if (!statusInfo && !showDetails && !showPerformance && pendingOperations === 0) {
    return null
  }

  return (
    <Box sx={{ ...getPositionStyles() }} className={className}>
      {/* Main Status Indicator */}
      {statusInfo && (
        <Tooltip 
          title={
            hasActivity 
              ? `${pendingOperations} operation${pendingOperations > 1 ? 's' : ''} in progress`
              : statusInfo.label
          }
        >
          <Chip
            icon={statusInfo.icon}
            label={compact ? undefined : statusInfo.label}
            size={compact ? 'small' : 'medium'}
            color={statusInfo.color}
            variant={statusInfo.variant}
            onClick={showDetails ? () => setExpandedDetails(!expandedDetails) : undefined}
            clickable={showDetails}
            sx={{
              backgroundColor: statusInfo.variant === 'filled' 
                ? `${statusInfo.color}.main` 
                : 'transparent',
              animation: hasActivity ? 'pulse 2s infinite' : undefined,
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.7 },
                '100%': { opacity: 1 }
              }
            }}
          />
        </Tooltip>
      )}

      {/* Progress Bar for Active Operations */}
      {hasActivity && (
        <LinearProgress 
          variant="indeterminate" 
          sx={{ 
            width: compact ? 120 : 200,
            height: 2,
            borderRadius: 1
          }}
        />
      )}

      {/* Action Buttons */}
      {(hasUnsavedChanges || error || fileErrorEntries.length > 0) && !compact && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {hasUnsavedChanges && (
            <Tooltip title="Save all changes">
              <IconButton 
                size="small" 
                onClick={saveAll}
                disabled={isSavingFiles}
              >
                <CloudUploadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {(error || fileErrorEntries.length > 0) && (
            <Tooltip title="Clear errors">
              <IconButton 
                size="small" 
                onClick={() => {
                  clearError()
                  fileErrorEntries.forEach(([fileId]) => clearFileError(fileId))
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Detailed Information */}
      <Collapse in={expandedDetails && showDetails}>
        <Box sx={{ 
          mt: 1, 
          p: 2, 
          backgroundColor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1,
          maxWidth: 300
        }}>
          <Typography variant="subtitle2" gutterBottom>
            File Operations Status
          </Typography>
          
          {/* File Counts */}
          <Typography variant="body2" color="text.secondary">
            Files loaded: {Object.keys(persistenceData.currentFiles).length}
          </Typography>
          
          {pendingOperations > 0 && (
            <Typography variant="body2" color="text.secondary">
              Operations pending: {pendingOperations}
            </Typography>
          )}
          
          {/* Auto-save Info */}
          {lastAutoSave && (
            <Typography variant="body2" color="text.secondary">
              Last saved: {new Date(lastAutoSave).toLocaleTimeString()}
            </Typography>
          )}
          
          {/* Cache Information */}
          {showPerformance && cacheMetrics && (
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" display="block">
                Cache: {Math.round(cacheMetrics.hitRate * 100)}% hit rate
              </Typography>
              <Typography variant="caption" display="block">
                Size: {formatFileSize(cacheMetrics.currentSize)}
              </Typography>
            </Box>
          )}
          
          {/* Performance Metrics */}
          {showPerformance && performanceMetrics.length > 0 && (
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" display="block">
                Recent operations: {performanceMetrics.length}
              </Typography>
              {performanceMetrics.slice(-3).map((metric, index) => (
                <Typography key={index} variant="caption" display="block">
                  {metric.operationType}: {formatDuration(metric.duration)}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Error Messages */}
      <Collapse in={showError}>
        <Box sx={{ mt: 1, maxWidth: 400 }}>
          {/* General Error */}
          {error && (
            <Alert 
              severity={getErrorSeverity(error)}
              variant="filled"
              size="small"
              onClose={() => clearError()}
              sx={{ mb: 1 }}
            >
              <Typography variant="body2">
                {error.message}
              </Typography>
              {error.recovery && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Suggestion: {error.recovery.description}
                </Typography>
              )}
            </Alert>
          )}
          
          {/* File-specific Errors */}
          {fileErrorEntries.map(([fileId, fileError]) => (
            <Alert
              key={fileId}
              severity={getErrorSeverity(fileError)}
              variant="filled"
              size="small"
              onClose={() => clearFileError(fileId)}
              sx={{ mb: 1 }}
            >
              <Typography variant="body2">
                File {fileId}: {fileError.message}
              </Typography>
              {fileError.recovery && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Suggestion: {fileError.recovery.description}
                </Typography>
              )}
            </Alert>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

export default SubtitleAutoSaveIndicator