/**
 * SubtitleAutoSaveIndicator Component
 * 
 * Enhanced visual indicator for subtitle temp storage operations and auto-save status.
 * Shows loading states, success indicators, error messages, and validation warnings.
 * Supports both legacy persistence and new temp storage systems.
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
  Alert,
  Collapse,
  Typography,
  LinearProgress,
  Stack
} from '@mui/material'
import {
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon,
  Cached as RefreshIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  CloudDone,
  Sync,
  History,
  Refresh
} from '@mui/icons-material'
import type { UseSubtitlePersistenceResult } from '../../hooks/useSubtitlePersistence'
import type { UseSubtitleTempStorageResult } from '../../hooks/useSubtitleTempStorage'
import type { SubtitleFileError } from '../../types/subtitle-persistence'
import type {
  SubtitleTempError,
  SubtitleValidationWarning,
  SubtitleValidationError
} from '../../types/subtitle-temp-storage'

/**
 * Component props - supports both legacy and temp storage
 */
interface SubtitleAutoSaveIndicatorProps {
  /** Subtitle persistence hook result (legacy) */
  persistenceData?: UseSubtitlePersistenceResult
  /** Subtitle temp storage hook result (new) */
  tempStorageData?: UseSubtitleTempStorageResult
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
  /** Display variant */
  variant?: 'default' | 'compact' | 'detailed'
  /** Show when idle */
  showWhenIdle?: boolean
  /** Enable details expansion */
  expandable?: boolean
  /** Manual save callback */
  onManualSave?: () => void
  /** Error retry callback */
  onRetry?: () => void
  /** Clear error callback */
  onClearError?: () => void
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
 * Get error severity color for legacy errors
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
 * Get temp storage error severity
 */
function getTempErrorSeverity(error: SubtitleTempError): 'error' | 'warning' | 'info' {
  if (error.severity === 'critical' || error.severity === 'high') return 'error'
  if (error.severity === 'medium') return 'warning'
  return 'info'
}

/**
 * Format time ago for display
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (seconds < 30) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleString()
}

/**
 * Get status info for temp storage system
 */
function getTempStorageStatusInfo(data: UseSubtitleTempStorageResult): {
  type: 'saving' | 'saved' | 'error' | 'warning' | 'pending' | 'idle'
  label: string
  description: string
  icon: React.ReactNode
  color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'default'
  severity: 'low' | 'medium' | 'high' | 'critical'
  actionable: boolean
} {
  const {
    isSaving,
    isAutoSaving,
    hasUnsavedChanges,
    lastSaveTime,
    error,
    validationWarnings,
    validationErrors
  } = data

  // Error state takes precedence
  if (error) {
    return {
      type: 'error',
      label: 'Save Error',
      description: error.message,
      icon: <ErrorIcon />,
      color: 'error',
      severity: error.severity,
      actionable: true
    }
  }

  // Validation errors
  if (validationErrors.length > 0) {
    const criticalErrors = validationErrors.filter(e => e.critical)
    return {
      type: 'error',
      label: `${validationErrors.length} Validation Error${validationErrors.length > 1 ? 's' : ''}`,
      description: criticalErrors.length > 0 
        ? `${criticalErrors.length} critical errors prevent saving`
        : 'Content validation failed',
      icon: <ErrorIcon />,
      color: 'error',
      severity: criticalErrors.length > 0 ? 'critical' : 'high',
      actionable: true
    }
  }

  // Currently saving
  if (isAutoSaving) {
    return {
      type: 'saving',
      label: 'Auto-saving...',
      description: 'Automatically saving your changes',
      icon: <CircularProgress size={16} />,
      color: 'primary',
      severity: 'low',
      actionable: false
    }
  }

  if (isSaving) {
    return {
      type: 'saving',
      label: 'Saving...',
      description: 'Saving your changes',
      icon: <CircularProgress size={16} />,
      color: 'primary',
      severity: 'low',
      actionable: false
    }
  }

  // Validation warnings
  if (validationWarnings.length > 0) {
    const highWarnings = validationWarnings.filter(w => w.severity === 'high')
    return {
      type: 'warning',
      label: `${validationWarnings.length} Warning${validationWarnings.length > 1 ? 's' : ''}`,
      description: highWarnings.length > 0
        ? `${highWarnings.length} high priority warnings detected`
        : 'Content validation warnings found',
      icon: <WarningIcon />,
      color: 'warning',
      severity: highWarnings.length > 0 ? 'high' : 'medium',
      actionable: false
    }
  }

  // Unsaved changes
  if (hasUnsavedChanges) {
    return {
      type: 'pending',
      label: 'Unsaved Changes',
      description: 'You have unsaved changes that will be auto-saved',
      icon: <Sync />,
      color: 'info',
      severity: 'medium',
      actionable: true
    }
  }

  // Recently saved
  if (lastSaveTime && (Date.now() - lastSaveTime) < 60000) { // 1 minute
    return {
      type: 'saved',
      label: 'Saved',
      description: `Last saved ${formatTimeAgo(lastSaveTime)}`,
      icon: <CheckCircleIcon />,
      color: 'success',
      severity: 'low',
      actionable: false
    }
  }

  // All saved, no recent activity
  return {
    type: 'idle',
    label: lastSaveTime ? 'All Saved' : 'Ready',
    description: lastSaveTime 
      ? `Last saved ${formatTimeAgo(lastSaveTime)}`
      : 'Ready to save changes',
    icon: <CloudDone />,
    color: 'default',
    severity: 'low',
    actionable: false
  }
}

/**
 * SubtitleAutoSaveIndicator component
 */
export const SubtitleAutoSaveIndicator: React.FC<SubtitleAutoSaveIndicatorProps> = ({
  persistenceData,
  tempStorageData,
  showDetails = false,
  showPerformance = false,
  compact = false,
  className,
  position = 'top-right',
  autoHideSuccess = true,
  autoHideDelay = 3000,
  variant = 'default',
  showWhenIdle = true,
  expandable = false,
  onManualSave,
  onRetry,
  onClearError
}) => {
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [expandedDetails, setExpandedDetails] = useState(false)

  // Determine which data source to use
  const usingTempStorage = !!tempStorageData
  
  // Extract data from appropriate source
  const data = useMemo(() => {
    if (usingTempStorage && tempStorageData) {
      return {
        isLoading: tempStorageData.isLoading,
        isSaving: tempStorageData.isSaving,
        isAutoSaving: tempStorageData.isAutoSaving,
        hasUnsavedChanges: tempStorageData.hasUnsavedChanges,
        lastSaveTime: tempStorageData.lastSaveTime,
        error: tempStorageData.error,
        validationWarnings: tempStorageData.validationWarnings,
        validationErrors: tempStorageData.validationErrors,
        pendingOperations: 0, // Not available in temp storage
        performanceMetrics: [], // Not directly comparable
        cacheMetrics: null
      }
    } else if (persistenceData) {
      return {
        isLoading: persistenceData.isLoadingFiles,
        isSaving: persistenceData.isSavingFiles,
        isAutoSaving: persistenceData.isAutoSaving,
        hasUnsavedChanges: persistenceData.hasUnsavedChanges,
        lastSaveTime: persistenceData.lastAutoSave,
        error: persistenceData.error,
        validationWarnings: [], // Not available in legacy system
        validationErrors: [], // Not available in legacy system
        pendingOperations: persistenceData.pendingOperations,
        performanceMetrics: persistenceData.performanceMetrics,
        cacheMetrics: persistenceData.cacheMetrics
      }
    }
    return null
  }, [usingTempStorage, tempStorageData, persistenceData])

  // Auto-hide success message
  useEffect(() => {
    if (data?.lastSaveTime && autoHideSuccess) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), autoHideDelay)
      return () => clearTimeout(timer)
    }
  }, [data?.lastSaveTime, autoHideSuccess, autoHideDelay])

  // Show/hide error messages
  useEffect(() => {
    if (usingTempStorage && tempStorageData) {
      setShowError(!!(tempStorageData.error || tempStorageData.validationErrors.length > 0))
    } else if (persistenceData) {
      setShowError(!!(persistenceData.error || Object.keys(persistenceData.fileErrors).length > 0))
    }
  }, [usingTempStorage, tempStorageData, persistenceData])

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

  // Get status info using appropriate system
  const statusInfo = useMemo(() => {
    if (!data) return null
    
    if (usingTempStorage && tempStorageData) {
      const tempStatus = getTempStorageStatusInfo(tempStorageData)
      return {
        icon: tempStatus.icon,
        label: tempStatus.label,
        color: tempStatus.color,
        variant: (tempStatus.type === 'saving' || tempStatus.type === 'error') ? 'filled' : 'outlined',
        description: tempStatus.description,
        actionable: tempStatus.actionable,
        type: tempStatus.type
      }
    } else {
      // Legacy status logic
      if (data.isLoading) {
        return {
          icon: <CircularProgress size={16} />,
          label: 'Loading files...',
          color: 'primary' as const,
          variant: 'filled' as const,
          description: 'Loading subtitle files',
          actionable: false,
          type: 'saving' as const
        }
      }
      
      if (data.isSaving || data.isAutoSaving) {
        return {
          icon: <SaveIcon />,
          label: data.isAutoSaving ? 'Auto-saving...' : 'Saving...',
          color: 'primary' as const,
          variant: 'filled' as const,
          description: data.isAutoSaving ? 'Automatically saving changes' : 'Saving changes',
          actionable: false,
          type: 'saving' as const
        }
      }
      
      if (data.error) {
        return {
          icon: <ErrorIcon />,
          label: 'Save Error',
          color: 'error' as const,
          variant: 'filled' as const,
          description: data.error.message || 'An error occurred while saving',
          actionable: true,
          type: 'error' as const
        }
      }
      
      if (data.hasUnsavedChanges) {
        return {
          icon: <ScheduleIcon />,
          label: 'Unsaved changes',
          color: 'warning' as const,
          variant: 'outlined' as const,
          description: 'You have unsaved changes',
          actionable: true,
          type: 'pending' as const
        }
      }
      
      if (data.lastSaveTime && showSuccess) {
        return {
          icon: <CheckCircleIcon />,
          label: 'Files saved',
          color: 'success' as const,
          variant: 'filled' as const,
          description: 'Files have been saved successfully',
          actionable: false,
          type: 'saved' as const
        }
      }
      
      if (data.lastSaveTime) {
        const timeSince = Date.now() - data.lastSaveTime
        return {
          icon: <CheckCircleIcon />,
          label: `Saved ${formatDuration(timeSince)} ago`,
          color: 'success' as const,
          variant: 'outlined' as const,
          description: `Last saved ${formatTimeAgo(data.lastSaveTime)}`,
          actionable: false,
          type: 'saved' as const
        }
      }
      
      return null
    }
  }, [data, usingTempStorage, tempStorageData, showSuccess])

  const hasActivity = data?.pendingOperations > 0
  const fileErrorEntries = persistenceData ? Object.entries(persistenceData.fileErrors) : []

  // Don't show anything in idle state if showWhenIdle is false
  if (!showWhenIdle && statusInfo?.type === 'idle') {
    return null
  }

  // Don't render if no status to show
  if (!statusInfo && !showDetails && !showPerformance && !hasActivity) {
    return null
  }

  const handleChipClick = () => {
    if (expandable) {
      setExpandedDetails(!expandedDetails)
    } else if (statusInfo?.actionable) {
      if (statusInfo.type === 'error' && onRetry) {
        onRetry()
      } else if (statusInfo.type === 'pending' && onManualSave) {
        onManualSave()
      }
    }
  }

  return (
    <Box 
      sx={{ 
        ...getPositionStyles(),
        display: 'flex', 
        flexDirection: 'column',
        alignItems: variant === 'compact' ? 'center' : 'flex-start',
        minHeight: variant === 'compact' ? 24 : 32
      }} 
      className={className}
      role="status"
      aria-live="polite"
      aria-label={statusInfo ? `Auto-save status: ${statusInfo.label}. ${statusInfo.description}` : 'Auto-save status'}
    >
      {/* Main Status Indicator */}
      {statusInfo && (
        <Tooltip 
          title={statusInfo.description}
          placement="top"
          arrow
        >
          <Chip
            icon={statusInfo.icon}
            label={variant === 'compact' ? statusInfo.label.split(' ')[0] : statusInfo.label}
            size={compact || variant === 'compact' ? 'small' : 'medium'}
            color={statusInfo.color}
            variant={statusInfo.variant}
            onClick={statusInfo.actionable || expandable ? handleChipClick : undefined}
            clickable={statusInfo.actionable || expandable}
            sx={{
              cursor: statusInfo.actionable || expandable ? 'pointer' : 'default',
              backgroundColor: statusInfo.variant === 'filled' 
                ? `rgba(${getColorRgb(statusInfo.color)}, 0.1)` 
                : 'transparent',
              borderColor: `rgba(${getColorRgb(statusInfo.color)}, 0.3)`,
              animation: hasActivity || statusInfo.type === 'saving' ? 'pulse 2s infinite' : undefined,
              '&:hover': statusInfo.actionable || expandable ? {
                backgroundColor: `rgba(${getColorRgb(statusInfo.color)}, 0.15)`
              } : {},
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
            borderRadius: 1,
            mt: 0.5
          }}
        />
      )}

      {/* Action Buttons */}
      {!compact && variant !== 'compact' && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          {data?.hasUnsavedChanges && onManualSave && (
            <Tooltip title="Save all changes">
              <IconButton 
                size="small" 
                onClick={onManualSave}
                disabled={data.isSaving}
              >
                <CloudUploadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {(data?.error || (usingTempStorage && (tempStorageData?.validationErrors.length || 0) > 0)) && (
            <Stack direction="row" spacing={1}>
              {onRetry && (
                <Tooltip title="Retry operation">
                  <IconButton size="small" onClick={onRetry}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {onClearError && (
                <Tooltip title="Clear error">
                  <IconButton size="small" onClick={onClearError}>
                    <ErrorIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
        </Box>
      )}

      {/* Detailed Information */}
      <Collapse in={(expandedDetails && showDetails) || variant === 'detailed'}>
        <Box sx={{ 
          mt: 1, 
          p: 1, 
          border: 1, 
          borderColor: 'divider', 
          borderRadius: 1,
          maxWidth: 300
        }}>
          {/* Error Details */}
          {data?.error && (
            <Alert 
              severity={usingTempStorage ? getTempErrorSeverity(data.error as SubtitleTempError) : getErrorSeverity(data.error as SubtitleFileError)}
              size="small"
              action={
                <Stack direction="row" spacing={1}>
                  {onRetry && (
                    <IconButton size="small" onClick={onRetry}>
                      <Refresh fontSize="small" />
                    </IconButton>
                  )}
                  {onClearError && (
                    <IconButton size="small" onClick={onClearError}>
                      <ErrorIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              }
            >
              <Typography variant="body2">
                {data.error.message}
              </Typography>
              {usingTempStorage && (data.error as SubtitleTempError).recoverySuggestions && (data.error as SubtitleTempError).recoverySuggestions!.length > 0 && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Suggestion: {(data.error as SubtitleTempError).recoverySuggestions![0]}
                </Typography>
              )}
            </Alert>
          )}

          {/* Validation Errors */}
          {usingTempStorage && tempStorageData && tempStorageData.validationErrors.length > 0 && (
            <Alert severity="error" size="small" sx={{ mt: data?.error ? 1 : 0 }}>
              <Typography variant="body2" fontWeight="medium">
                Validation Errors ({tempStorageData.validationErrors.length}):
              </Typography>
              {tempStorageData.validationErrors.slice(0, 3).map((validationError, index) => (
                <Typography key={validationError.id} variant="caption" display="block">
                  • {validationError.message}
                </Typography>
              ))}
              {tempStorageData.validationErrors.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {tempStorageData.validationErrors.length - 3} more
                </Typography>
              )}
            </Alert>
          )}

          {/* Validation Warnings */}
          {usingTempStorage && tempStorageData && tempStorageData.validationWarnings.length > 0 && (
            <Alert severity="warning" size="small" sx={{ mt: (data?.error || (tempStorageData?.validationErrors.length || 0) > 0) ? 1 : 0 }}>
              <Typography variant="body2" fontWeight="medium">
                Validation Warnings ({tempStorageData.validationWarnings.length}):
              </Typography>
              {tempStorageData.validationWarnings.slice(0, 3).map((warning, index) => (
                <Typography key={warning.id} variant="caption" display="block">
                  • {warning.message}
                  {warning.autoFixable && (
                    <Typography component="span" color="primary" sx={{ ml: 1 }}>
                      (Auto-fixable)
                    </Typography>
                  )}
                </Typography>
              ))}
              {tempStorageData.validationWarnings.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {tempStorageData.validationWarnings.length - 3} more
                </Typography>
              )}
            </Alert>
          )}

          {/* Status Info */}
          {!data?.error && (usingTempStorage ? tempStorageData?.validationErrors.length === 0 : true) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {statusInfo?.description || 'System ready'}
              </Typography>
            </Box>
          )}

          {/* Performance Info */}
          {showPerformance && (
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              {data?.lastSaveTime && (
                <Typography variant="caption" display="block">
                  Last saved: {new Date(data.lastSaveTime).toLocaleTimeString()}
                </Typography>
              )}
              
              {data?.cacheMetrics && (
                <>
                  <Typography variant="caption" display="block">
                    Cache: {Math.round(data.cacheMetrics.hitRate * 100)}% hit rate
                  </Typography>
                  <Typography variant="caption" display="block">
                    Size: {formatFileSize(data.cacheMetrics.currentSize)}
                  </Typography>
                </>
              )}
              
              {data?.performanceMetrics && data.performanceMetrics.length > 0 && (
                <>
                  <Typography variant="caption" display="block">
                    Recent operations: {data.performanceMetrics.length}
                  </Typography>
                  {data.performanceMetrics.slice(-3).map((metric, index) => (
                    <Typography key={index} variant="caption" display="block">
                      {metric.operationType}: {formatDuration(metric.duration)}
                    </Typography>
                  ))}
                </>
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function getColorRgb(color: string): string {
  const colorMap = {
    primary: '25, 118, 210',
    success: '46, 125, 50', 
    error: '211, 47, 47',
    warning: '245, 124, 0',
    info: '2, 136, 209',
    default: '158, 158, 158'
  }
  return colorMap[color as keyof typeof colorMap] || colorMap.default
}

// ============================================================================
// SPECIALIZED VARIANTS
// ============================================================================

export const CompactSubtitleAutoSaveIndicator: React.FC<Omit<SubtitleAutoSaveIndicatorProps, 'variant'>> = (props) => (
  <SubtitleAutoSaveIndicator {...props} variant="compact" showWhenIdle={true} />
)

export const DetailedSubtitleAutoSaveIndicator: React.FC<Omit<SubtitleAutoSaveIndicatorProps, 'variant'>> = (props) => (
  <SubtitleAutoSaveIndicator {...props} variant="detailed" showWhenIdle={true} />
)

export const HeaderSubtitleAutoSaveIndicator: React.FC<Omit<SubtitleAutoSaveIndicatorProps, 'variant' | 'showWhenIdle'>> = (props) => (
  <SubtitleAutoSaveIndicator {...props} variant="default" showWhenIdle={false} expandable={true} />
)

export default SubtitleAutoSaveIndicator