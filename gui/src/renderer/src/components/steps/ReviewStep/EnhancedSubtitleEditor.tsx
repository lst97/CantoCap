/**
 * EnhancedSubtitleEditor Component
 * 
 * Enhanced subtitle editor with integrated auto-save, session recovery,
 * original vs modified comparison, and real-time validation.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Stack,
  Divider,
  Tooltip,
  Card,
  CardContent,
  Alert,
  Dialog,
  Switch,
  FormControlLabel
} from '@mui/material'
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  CallSplit as SplitIcon,
  MergeType as MergeIcon,
  Delete as DeleteIcon,
  RestoreOutlined as RestoreIcon,
  FileDownload as ExportIcon,
  History as HistoryIcon,
  Compare as CompareIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { useSubtitleEditStore } from '../../../stores/subtitle-edit-store'
import { workflowStateManager } from '../../../services/workflow/workflow-state-manager'
import { StepState } from '../../../types/workflow-state'
import { useSubtitleTempStorage } from '../../../hooks/useSubtitleTempStorage'
import { ReviewCard, ActionButton } from './styles'
import { formatTime, parseTime } from './utils'
import { SubtitleEditorProps } from './types'
// REMOVED: SubtitleAutoSaveIndicator - auto-save UI components deleted
import { SessionRecoveryDialog } from '../../dialogs/SessionRecoveryDialog'
import { OriginalModifiedViewer } from '../../ui/OriginalModifiedViewer'
import type { SubtitleData } from '../../../../types'
import type {
  SubtitleTempContent,
  SubtitleTempSession
} from '../../../types/subtitle-temp-storage'

// ============================================================================
// ENHANCED COMPONENT
// ============================================================================

export const EnhancedSubtitleEditor: React.FC<SubtitleEditorProps> = () => {
  const {
    session,
    updateSubtitle,
    deleteSubtitle,
    splitSubtitle,
    mergeSubtitles,
    setSelectedSubtitle,
    undo,
    redo,
    undoStack,
    redoStack,
    clearUndoRedo,
  } = useSubtitleEditStore()
  
  // Modern workflow navigation using WorkflowStateManager

  // Enhanced temp storage integration
  const tempStorage = useSubtitleTempStorage({
    autoSaveEnabled: true,
    autoSaveInterval: 30000, // 30 seconds
    saveOnIdle: true,
    idleTimeout: 300000, // 5 minutes
    enableSessionRecovery: true,
    onSessionRecovered: (recoveredSession) => {
      setShowRecoveryDialog(false)
      // Integrate recovered session with subtitle editor
      console.log('Session recovered:', recoveredSession)
    }
  })

  const [editText, setEditText] = useState('')
  const [editTranslation, setEditTranslation] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [originalContent, setOriginalContent] = useState<SubtitleTempContent | null>(null)

  const editingSubtitle = session?.selectedSubtitleId
    ? session.currentSubtitles.find((s) => s.id === session.selectedSubtitleId)
    : null

  // Check if this is a new subtitle (empty text and no original text)
  const isNewSubtitle =
    editingSubtitle && !editingSubtitle.text && !editingSubtitle.translation
  
  // Check if subtitle has translation
  const hasTranslation = editingSubtitle && editingSubtitle.translation && 
    editingSubtitle.translation.trim() && editingSubtitle.translation !== editingSubtitle.text

  // Initialize session on mount
  useEffect(() => {
    if (session && !tempStorage.currentSession) {
      tempStorage.createSession('review').then(result => {
        if (result.success) {
          console.log('Review session created:', result.data)
        }
      })
    }
  }, [session, tempStorage])

  // Check for recoverable sessions on mount
  useEffect(() => {
    if (tempStorage.hasRecoverableSession && !showRecoveryDialog) {
      setShowRecoveryDialog(true)
    }
  }, [tempStorage.hasRecoverableSession, showRecoveryDialog])

  // Update temp storage when subtitles change
  useEffect(() => {
    if (session?.currentSubtitles && tempStorage.currentSession) {
      tempStorage.updateContent(session.currentSubtitles, {
        selectedIds: session.selectedSubtitleId ? [session.selectedSubtitleId] : [],
        viewState: {
          scrollPosition: 0,
          zoomLevel: 1,
          displayMode: 'list',
          showConfidence: true,
          showTimings: true
        }
      })
    }
  }, [session?.currentSubtitles, session?.selectedSubtitleId, tempStorage])

  // Update local state when selected subtitle changes
  useEffect(() => {
    if (editingSubtitle) {
      setEditText(editingSubtitle.text)
      setEditTranslation(editingSubtitle.translation || '')
      setEditStartTime(formatTime(editingSubtitle.startTime))
      setEditEndTime(formatTime(editingSubtitle.endTime))
      setHasChanges(false)
    }
  }, [editingSubtitle])

  // Store original content for comparison
  useEffect(() => {
    if (session?.currentSubtitles && !originalContent) {
      const content: SubtitleTempContent = {
        metadata: {
          id: 'original',
          workspaceId: session.workspaceId || 'unknown',
          sessionId: 'original',
          version: 1,
          schemaVersion: 1
        },
        subtitles: session.currentSubtitles,
        statistics: {
          totalCount: session.currentSubtitles.length,
          modifiedCount: 0,
          totalDuration: 0,
          contentCoverage: 100,
          averageConfidence: 0.9,
          textStats: {
            totalCharacters: 0,
            totalWords: 0,
            averageWordsPerSubtitle: 0
          },
          qualityMetrics: {
            highConfidenceCount: 0,
            mediumConfidenceCount: 0,
            lowConfidenceCount: 0,
            untranslatedCount: 0,
            emptyTextCount: 0
          },
          timingAnalysis: {
            averageDuration: 0,
            minDuration: 0,
            maxDuration: 0,
            gapCount: 0,
            overlapCount: 0,
            totalGapDuration: 0
          }
        },
        editingContext: {
          selectedIds: [],
          filters: {
            showOnlyModified: false,
            showOnlyUntranslated: false,
            showOnlyLowConfidence: false
          },
          viewState: {
            scrollPosition: 0,
            zoomLevel: 1,
            displayMode: 'list',
            showConfidence: true,
            showTimings: true
          }
        },
        changeTracking: {
          changeCount: 0,
          lastUserAction: Date.now(),
          modifiedIds: new Set(),
          changeSeverity: 'minor'
        },
        validation: {
          isValid: true,
          lastValidated: Date.now(),
          warnings: [],
          errors: [],
          integrityScore: 1.0
        }
      }
      setOriginalContent(content)
    }
  }, [session?.currentSubtitles, originalContent])

  const handleTextChange = (value: string) => {
    setEditText(value)
    setHasChanges(editingSubtitle?.text !== value || (editingSubtitle?.originalText || '') !== editTranslation)
  }

  const handleTranslationChange = (value: string) => {
    setEditTranslation(value)
    setHasChanges(editingSubtitle?.text !== editText || (editingSubtitle?.originalText || '') !== value)
  }

  const handleSave = useCallback(async () => {
    if (!editingSubtitle || !hasChanges) return

    updateSubtitle(editingSubtitle.id, {
      text: editText,
      translation: editTranslation || undefined,
      startTime: parseTime(editStartTime),
      endTime: parseTime(editEndTime),
    })
    
    setHasChanges(false)

    // Force save to temp storage
    if (tempStorage.hasUnsavedChanges) {
      await tempStorage.forceSave()
    }
  }, [editingSubtitle, hasChanges, editText, editTranslation, editStartTime, editEndTime, updateSubtitle, tempStorage])

  const handleCancel = () => {
    if (editingSubtitle) {
      setEditText(editingSubtitle.text)
      setEditTranslation(editingSubtitle.translation || '')
      setEditStartTime(formatTime(editingSubtitle.startTime))
      setEditEndTime(formatTime(editingSubtitle.endTime))
      setHasChanges(false)
    }
  }

  const handleReset = () => {
    if (editingSubtitle) {
      setEditText(editingSubtitle.text)
      setEditTranslation(editingSubtitle.translation || '')
      setHasChanges(false)
    }
  }

  const handleDelete = () => {
    if (editingSubtitle) {
      deleteSubtitle(editingSubtitle.id)
      setSelectedSubtitle(null)
    }
  }

  const handleExport = async () => {
    await workflowStateManager.transitionState('review', StepState.Complete, {
      reason: 'Review completed - user initiated export'
    })
    await workflowStateManager.transitionState('export', StepState.Ready, {
      reason: 'Review completed - export step now accessible'
    })
    workflowStateManager.setCurrentStep('export')
  }

  const handleSplit = () => {
    if (editingSubtitle && session) {
      const splitTime =
        session.currentTime ||
        (editingSubtitle.startTime + editingSubtitle.endTime) / 2
      if (
        splitTime > editingSubtitle.startTime &&
        splitTime < editingSubtitle.endTime
      ) {
        splitSubtitle(editingSubtitle.id, splitTime)
      }
    }
  }

  const handleMergeNext = () => {
    if (!editingSubtitle || !session) return

    const currentIndex = session.currentSubtitles.findIndex(
      (s) => s.id === editingSubtitle.id
    )
    if (
      currentIndex >= 0 &&
      currentIndex < session.currentSubtitles.length - 1
    ) {
      const nextSubtitle = session.currentSubtitles[currentIndex + 1]
      mergeSubtitles(editingSubtitle.id, nextSubtitle.id)
    }
  }

  const handleRestoreOriginal = (subtitleId: number) => {
    if (originalContent) {
      const originalSubtitle = originalContent.subtitles.find(s => s.id === subtitleId)
      if (originalSubtitle) {
        updateSubtitle(subtitleId, originalSubtitle)
      }
    }
  }

  // Create current modified content for comparison
  const currentModifiedContent = useMemo((): SubtitleTempContent | null => {
    if (!session?.currentSubtitles || !originalContent) return null
    
    return {
      ...originalContent,
      metadata: {
        ...originalContent.metadata,
        id: 'modified'
      },
      subtitles: session.currentSubtitles,
      changeTracking: {
        changeCount: tempStorage.currentContent?.changeTracking.changeCount || 0,
        lastUserAction: Date.now(),
        modifiedIds: new Set(session.currentSubtitles.map(s => s.id)),
        changeSeverity: 'moderate'
      },
      validation: {
        isValid: tempStorage.validationErrors.length === 0,
        lastValidated: Date.now(),
        warnings: tempStorage.validationWarnings,
        errors: tempStorage.validationErrors,
        integrityScore: tempStorage.validationErrors.length === 0 ? 1.0 : 0.7
      }
    }
  }, [session?.currentSubtitles, originalContent, tempStorage])

  return (
    <>
      <ReviewCard sx={{ display: 'flex', flexDirection: 'column', height: '90%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <EditIcon color="primary" />
            {isNewSubtitle ? 'Add Subtitle' : 'Edit Subtitle'}
          </Typography>

          {/* Enhanced Header Controls */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* REMOVED: SubtitleAutoSaveIndicator - auto-save UI components deleted */}

            {/* Comparison Toggle */}
            {originalContent && currentModifiedContent && (
              <Tooltip title="Compare with original">
                <IconButton
                  size="small"
                  onClick={() => setShowComparison(!showComparison)}
                  color={showComparison ? 'primary' : 'default'}
                >
                  <CompareIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* Session Recovery */}
            {tempStorage.hasRecoverableSession && (
              <Tooltip title="Recover previous session">
                <IconButton
                  size="small"
                  onClick={() => setShowRecoveryDialog(true)}
                  color="warning"
                >
                  <HistoryIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* Reset and Undo/Redo */}
            <Tooltip title="Reset Changes">
              <IconButton
                size="small"
                onClick={handleReset}
                disabled={!hasChanges}
                sx={{ color: '#F59E0B' }}
              >
                <RestoreIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Undo">
              <IconButton
                size="small"
                onClick={undo}
                disabled={undoStack.length === 0}
              >
                <UndoIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Redo">
              <IconButton
                size="small"
                onClick={redo}
                disabled={redoStack.length === 0}
              >
                <RedoIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Validation Alerts */}
        {tempStorage.validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {tempStorage.validationErrors.length} validation error{tempStorage.validationErrors.length > 1 ? 's' : ''} found
            </Typography>
          </Alert>
        )}

        {tempStorage.validationWarnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {tempStorage.validationWarnings.length} validation warning{tempStorage.validationWarnings.length > 1 ? 's' : ''} found
            </Typography>
          </Alert>
        )}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {editingSubtitle ? (
            <Stack spacing={2} sx={{ flex: 1 }}>
              {/* Timing Controls */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{
                    style: { fontFamily: 'monospace', fontSize: '0.875rem' },
                  }}
                />
                <TextField
                  label="End Time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{
                    style: { fontFamily: 'monospace', fontSize: '0.875rem' },
                  }}
                />
              </Box>

              {/* Text Editor */}
              <TextField
                label="Subtitle"
                value={editText}
                onChange={(e) => handleTextChange(e.target.value)}
                multiline
                rows={hasTranslation ? 2 : 4}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: hasChanges
                      ? 'rgba(245, 158, 11, 0.05)'
                      : 'transparent',
                  },
                }}
              />

              {/* Translation Editor */}
              {(hasTranslation || editTranslation.trim()) && (
                <TextField
                  label="Translation"
                  value={editTranslation}
                  onChange={(e) => handleTranslationChange(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: hasChanges
                        ? 'rgba(245, 158, 11, 0.05)'
                        : 'transparent',
                    },
                  }}
                />
              )}

              {/* Confidence and Info */}
              {editingSubtitle.confidence && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Confidence:
                  </Typography>
                  <Chip
                    label={`${editingSubtitle.confidence}%`}
                    size="small"
                    color={
                      editingSubtitle.confidence > 90
                        ? 'success'
                        : editingSubtitle.confidence > 80
                        ? 'warning'
                        : 'error'
                    }
                  />
                  {editingSubtitle.speaker && (
                    <Chip
                      label={`Speaker: ${editingSubtitle.speaker}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              )}

              {/* Save/Cancel buttons */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  size="small"
                  sx={{ flex: 1 }}
                  onClick={handleSave}
                  disabled={!hasChanges}
                >
                  Save Changes
                </Button>
                <ActionButton
                  startIcon={<UndoIcon />}
                  size="small"
                  onClick={handleCancel}
                  disabled={!hasChanges}
                >
                  Cancel
                </ActionButton>
              </Box>

              <Divider />

              {/* Quick Actions */}
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                Quick Actions:
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <ActionButton
                    startIcon={<SplitIcon />}
                    size="small"
                    sx={{ flex: 1 }}
                    onClick={handleSplit}
                    disabled={
                      !session ||
                      !session.currentTime ||
                      session.currentTime <= editingSubtitle.startTime ||
                      session.currentTime >= editingSubtitle.endTime
                    }
                  >
                    Split at Current Time
                  </ActionButton>
                  <ActionButton
                    startIcon={<MergeIcon />}
                    size="small"
                    sx={{ flex: 1 }}
                    onClick={handleMergeNext}
                  >
                    Merge with Next
                  </ActionButton>
                </Box>
                <Box>
                  <ActionButton
                    startIcon={<DeleteIcon />}
                    size="small"
                    color="error"
                    onClick={handleDelete}
                    fullWidth
                  >
                    Delete Subtitle
                  </ActionButton>
                </Box>
              </Stack>
            </Stack>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 300,
                border: 2,
                borderStyle: 'dashed',
                borderColor: 'divider',
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <EditIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Select a subtitle from the list to edit
              </Typography>
            </Box>
          )}
          
          {/* Export Button - Always visible at bottom */}
          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={handleExport}
              startIcon={<ExportIcon />}
              sx={{
                py: 2,
                px: 3,
                fontSize: '1.1rem',
                fontWeight: 700,
                borderRadius: 3,
                textTransform: 'none',
                background: 'linear-gradient(45deg, #F59E0B 30%, #EAB308 90%)',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #D97706 30%, #F59E0B 90%)',
                  boxShadow: '0 6px 25px rgba(245, 158, 11, 0.4)',
                  transform: 'translateY(-2px)',
                },
                '&:active': {
                  transform: 'translateY(0px)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Export Subtitles
            </Button>
          </Box>
        </Box>
      </ReviewCard>

      {/* Session Recovery Dialog */}
      <SessionRecoveryDialog
        open={showRecoveryDialog}
        onClose={() => setShowRecoveryDialog(false)}
        recoverableSessionIds={tempStorage.recoverableSessionIds}
        tempStorage={tempStorage}
      />

      {/* Comparison Dialog */}
      <Dialog
        open={showComparison}
        onClose={() => setShowComparison(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        {originalContent && currentModifiedContent && (
          <OriginalModifiedViewer
            originalContent={originalContent}
            modifiedContent={currentModifiedContent}
            selectedIndex={session?.selectedSubtitleId ? 
              session.currentSubtitles.findIndex(s => s.id === session.selectedSubtitleId) : 0
            }
            onRestoreSubtitle={handleRestoreOriginal}
            onNavigateToSubtitle={(index) => {
              const subtitle = session?.currentSubtitles[index]
              if (subtitle) {
                setSelectedSubtitle(subtitle.id)
              }
            }}
          />
        )}
      </Dialog>
    </>
  )
}

export default EnhancedSubtitleEditor