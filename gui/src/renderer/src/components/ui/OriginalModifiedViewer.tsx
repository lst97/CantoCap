/**
 * OriginalModifiedViewer Component
 * 
 * Side-by-side comparison viewer for original and modified subtitle content.
 * Provides visual diff highlighting, navigation, and restoration capabilities.
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Card,
  CardContent,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  Paper
} from '@mui/material'
import {
  CompareArrows as CompareIcon,
  Restore as RestoreIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  FilterList as FilterIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import type { SubtitleData } from '../../../types'
import type {
  SubtitleTempContent,
  SubtitleValidationWarning
} from '../../types/subtitle-temp-storage'

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

export interface OriginalModifiedViewerProps {
  /** Original subtitle content */
  originalContent: SubtitleTempContent
  /** Modified subtitle content */
  modifiedContent: SubtitleTempContent
  /** Currently selected subtitle index */
  selectedIndex?: number
  /** Show only modified subtitles */
  showOnlyModified?: boolean
  /** Show validation warnings */
  showValidationWarnings?: boolean
  /** Restore subtitle callback */
  onRestoreSubtitle?: (subtitleId: number) => void
  /** Navigate to subtitle callback */
  onNavigateToSubtitle?: (index: number) => void
  /** Selection change callback */
  onSelectionChange?: (index: number) => void
}

interface DiffInfo {
  subtitleId: number
  hasTextChanges: boolean
  hasTimingChanges: boolean
  hasTranslationChanges: boolean
  changeType: 'added' | 'modified' | 'deleted' | 'unchanged'
  changeCount: number
}

interface DiffStats {
  totalChanges: number
  textChanges: number
  timingChanges: number
  translationChanges: number
  additions: number
  modifications: number
  deletions: number
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateDiff(original: SubtitleData[], modified: SubtitleData[]): {
  diffs: DiffInfo[]
  stats: DiffStats
} {
  const originalMap = new Map(original.map(s => [s.id, s]))
  const modifiedMap = new Map(modified.map(s => [s.id, s]))
  
  const allIds = new Set([...originalMap.keys(), ...modifiedMap.keys()])
  const diffs: DiffInfo[] = []
  
  let stats: DiffStats = {
    totalChanges: 0,
    textChanges: 0,
    timingChanges: 0,
    translationChanges: 0,
    additions: 0,
    modifications: 0,
    deletions: 0
  }

  for (const id of allIds) {
    const originalSub = originalMap.get(id)
    const modifiedSub = modifiedMap.get(id)
    
    let changeType: DiffInfo['changeType'] = 'unchanged'
    let hasTextChanges = false
    let hasTimingChanges = false
    let hasTranslationChanges = false
    let changeCount = 0

    if (!originalSub && modifiedSub) {
      changeType = 'added'
      stats.additions++
      changeCount = 1
    } else if (originalSub && !modifiedSub) {
      changeType = 'deleted'
      stats.deletions++
      changeCount = 1
    } else if (originalSub && modifiedSub) {
      // Check for text changes
      if (originalSub.text !== modifiedSub.text) {
        hasTextChanges = true
        stats.textChanges++
        changeCount++
      }
      
      // Check for timing changes
      if (originalSub.startTime !== modifiedSub.startTime || 
          originalSub.endTime !== modifiedSub.endTime) {
        hasTimingChanges = true
        stats.timingChanges++
        changeCount++
      }
      
      // Check for translation changes
      if (originalSub.translation !== modifiedSub.translation) {
        hasTranslationChanges = true
        stats.translationChanges++
        changeCount++
      }
      
      if (changeCount > 0) {
        changeType = 'modified'
        stats.modifications++
      }
    }

    if (changeCount > 0) {
      stats.totalChanges++
    }

    diffs.push({
      subtitleId: id,
      hasTextChanges,
      hasTimingChanges,
      hasTranslationChanges,
      changeType,
      changeCount
    })
  }

  return { diffs, stats }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}`
}

function getChangeColor(changeType: DiffInfo['changeType']): string {
  switch (changeType) {
    case 'added': return '#4caf50'
    case 'modified': return '#ff9800'
    case 'deleted': return '#f44336'
    default: return '#9e9e9e'
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OriginalModifiedViewer: React.FC<OriginalModifiedViewerProps> = ({
  originalContent,
  modifiedContent,
  selectedIndex = 0,
  showOnlyModified = true,
  showValidationWarnings = true,
  onRestoreSubtitle,
  onNavigateToSubtitle,
  onSelectionChange
}) => {
  const [showComparison, setShowComparison] = useState(true)
  const [currentFilter, setCurrentFilter] = useState<'all' | 'modified' | 'text' | 'timing'>('all')
  const [showSideBySide, setShowSideBySide] = useState(true)

  // Calculate differences
  const { diffs, stats } = useMemo(() => 
    calculateDiff(originalContent.subtitles, modifiedContent.subtitles),
    [originalContent.subtitles, modifiedContent.subtitles]
  )

  // Filter subtitles based on current filter
  const filteredDiffs = useMemo(() => {
    return diffs.filter(diff => {
      switch (currentFilter) {
        case 'modified':
          return diff.changeType !== 'unchanged'
        case 'text':
          return diff.hasTextChanges
        case 'timing':
          return diff.hasTimingChanges
        default:
          return true
      }
    })
  }, [diffs, currentFilter])

  // Get current subtitle data
  const currentDiff = filteredDiffs[selectedIndex]
  const originalSubtitle = currentDiff ? originalContent.subtitles.find(s => s.id === currentDiff.subtitleId) : null
  const modifiedSubtitle = currentDiff ? modifiedContent.subtitles.find(s => s.id === currentDiff.subtitleId) : null

  // Navigation handlers
  const handlePrevious = () => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1
      onSelectionChange?.(newIndex)
      onNavigateToSubtitle?.(newIndex)
    }
  }

  const handleNext = () => {
    if (selectedIndex < filteredDiffs.length - 1) {
      const newIndex = selectedIndex + 1
      onSelectionChange?.(newIndex)
      onNavigateToSubtitle?.(newIndex)
    }
  }

  const handleRestore = () => {
    if (currentDiff && onRestoreSubtitle) {
      onRestoreSubtitle(currentDiff.subtitleId)
    }
  }

  if (filteredDiffs.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            py: 4 
          }}>
            <CheckIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Changes Found
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {currentFilter === 'all' 
                ? 'The content appears to be identical.'
                : `No changes found matching the current filter: ${currentFilter}`
              }
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareIcon color="primary" />
            Content Comparison
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={showSideBySide}
                  onChange={(e) => setShowSideBySide(e.target.checked)}
                  size="small"
                />
              }
              label="Side by side"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showComparison}
                  onChange={(e) => setShowComparison(e.target.checked)}
                  size="small"
                />
              }
              label="Show comparison"
            />
          </Stack>
        </Box>

        {/* Statistics */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Chip label={`${stats.totalChanges} changes`} size="small" color="primary" />
          <Chip label={`${stats.additions} added`} size="small" sx={{ backgroundColor: '#4caf50', color: 'white' }} />
          <Chip label={`${stats.modifications} modified`} size="small" sx={{ backgroundColor: '#ff9800', color: 'white' }} />
          {stats.deletions > 0 && (
            <Chip label={`${stats.deletions} deleted`} size="small" sx={{ backgroundColor: '#f44336', color: 'white' }} />
          )}
        </Stack>

        {/* Filters and Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant={currentFilter === 'all' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setCurrentFilter('all')}
            >
              All ({diffs.length})
            </Button>
            <Button
              variant={currentFilter === 'modified' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setCurrentFilter('modified')}
            >
              Modified ({diffs.filter(d => d.changeType !== 'unchanged').length})
            </Button>
            <Button
              variant={currentFilter === 'text' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setCurrentFilter('text')}
            >
              Text ({stats.textChanges})
            </Button>
            <Button
              variant={currentFilter === 'timing' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setCurrentFilter('timing')}
            >
              Timing ({stats.timingChanges})
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {selectedIndex + 1} of {filteredDiffs.length}
            </Typography>
            <IconButton onClick={handlePrevious} disabled={selectedIndex === 0} size="small">
              <PrevIcon />
            </IconButton>
            <IconButton onClick={handleNext} disabled={selectedIndex >= filteredDiffs.length - 1} size="small">
              <NextIcon />
            </IconButton>
          </Stack>
        </Box>
      </Paper>

      {/* Content Comparison */}
      {currentDiff && (
        <Paper sx={{ flex: 1, p: 2, overflow: 'hidden' }}>
          {/* Subtitle Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1">
                Subtitle #{currentDiff.subtitleId}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Chip
                  label={currentDiff.changeType}
                  size="small"
                  sx={{ 
                    backgroundColor: getChangeColor(currentDiff.changeType),
                    color: 'white'
                  }}
                />
                {currentDiff.hasTextChanges && <Chip label="Text" size="small" variant="outlined" />}
                {currentDiff.hasTimingChanges && <Chip label="Timing" size="small" variant="outlined" />}
                {currentDiff.hasTranslationChanges && <Chip label="Translation" size="small" variant="outlined" />}
              </Stack>
            </Box>
            
            {onRestoreSubtitle && originalSubtitle && (
              <Button
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={handleRestore}
                size="small"
              >
                Restore Original
              </Button>
            )}
          </Box>

          {showComparison && (
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: showSideBySide ? '1fr 1fr' : '1fr',
              gap: 2,
              height: 'calc(100% - 100px)',
              overflow: 'auto'
            }}>
              {/* Original Content */}
              {(showSideBySide || !modifiedSubtitle) && originalSubtitle && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Original
                    </Typography>
                    
                    {/* Timing */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {formatTime(originalSubtitle.startTime)} → {formatTime(originalSubtitle.endTime)}
                    </Typography>
                    
                    {/* Text */}
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mb: 1,
                        backgroundColor: currentDiff.hasTextChanges ? 'rgba(244, 67, 54, 0.1)' : 'transparent',
                        p: currentDiff.hasTextChanges ? 1 : 0,
                        borderRadius: 1
                      }}
                    >
                      {originalSubtitle.text || <em>No text</em>}
                    </Typography>
                    
                    {/* Translation */}
                    {originalSubtitle.translation && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          fontStyle: 'italic',
                          backgroundColor: currentDiff.hasTranslationChanges ? 'rgba(244, 67, 54, 0.1)' : 'transparent',
                          p: currentDiff.hasTranslationChanges ? 1 : 0,
                          borderRadius: 1
                        }}
                      >
                        Translation: {originalSubtitle.translation}
                      </Typography>
                    )}
                    
                    {/* Additional Info */}
                    {originalSubtitle.confidence && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Confidence: {(originalSubtitle.confidence * 100).toFixed(1)}%
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Modified Content */}
              {modifiedSubtitle && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      {showSideBySide ? 'Modified' : 'Current'}
                    </Typography>
                    
                    {/* Timing */}
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 1,
                        backgroundColor: currentDiff.hasTimingChanges ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                        p: currentDiff.hasTimingChanges ? 0.5 : 0,
                        borderRadius: 1
                      }}
                    >
                      {formatTime(modifiedSubtitle.startTime)} → {formatTime(modifiedSubtitle.endTime)}
                    </Typography>
                    
                    {/* Text */}
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mb: 1,
                        backgroundColor: currentDiff.hasTextChanges ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                        p: currentDiff.hasTextChanges ? 1 : 0,
                        borderRadius: 1
                      }}
                    >
                      {modifiedSubtitle.text || <em>No text</em>}
                    </Typography>
                    
                    {/* Translation */}
                    {modifiedSubtitle.translation && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          fontStyle: 'italic',
                          backgroundColor: currentDiff.hasTranslationChanges ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                          p: currentDiff.hasTranslationChanges ? 1 : 0,
                          borderRadius: 1
                        }}
                      >
                        Translation: {modifiedSubtitle.translation}
                      </Typography>
                    )}
                    
                    {/* Additional Info */}
                    {modifiedSubtitle.confidence && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Confidence: {(modifiedSubtitle.confidence * 100).toFixed(1)}%
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* No Modified Content */}
              {!modifiedSubtitle && currentDiff.changeType === 'deleted' && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Modified
                    </Typography>
                    <Alert severity="info">
                      This subtitle has been deleted
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  )
}

export default OriginalModifiedViewer