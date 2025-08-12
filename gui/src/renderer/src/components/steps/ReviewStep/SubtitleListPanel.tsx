import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  VisibilityOff as HideIcon,
} from '@mui/icons-material';
import {
  useSubtitles,
  useOriginalSubtitles,
  useSelectedSubtitle,
  useVideoState,
  useSaveState,
  useSubtitleActions,
  useSubtitleWorkspace,
  Subtitle,
} from '../../../stores/useSubtitleEditStore';
import { ReviewCard, ModificationChip, ActionButton } from './styles';
import { formatTime, generateCharacterDiff } from './utils';
import { DiffPart } from './types';

// Interface for gap state management
interface GapState {
  index: number;
  gapDuration: number;
  isEnabled: boolean;
  prevSubtitle: Subtitle;
  currSubtitle: Subtitle;
}

export const SubtitleListPanel: React.FC = () => {
  const subtitles = useSubtitles();
  const originalSubtitles = useOriginalSubtitles();
  const selectedSubtitle = useSelectedSubtitle();
  const { currentTime, isVideoPlaying, videoDuration } = useVideoState();
  const { workspaceId } = useSubtitleWorkspace();
  const { isSaving } = useSaveState();
  const { deleteSubtitle, addSubtitle, setSelectedSubtitle, jumpToSubtitle, saveToWorkspace } =
    useSubtitleActions();

  // State for diff view
  const [showDiff, setShowDiff] = useState(false);

  // No need for separate original data loading - it's handled by the store

  // DEBUG: Log subtitle data
  React.useEffect(() => {
    console.log('🔍 DEBUG: SubtitleListPanel data:', {
      workspaceId,
      hasSubtitles: !!subtitles.length,
      subtitlesLength: subtitles.length,
      hasOriginalSubtitles: !!originalSubtitles.length,
      originalSubtitlesLength: originalSubtitles.length,
      isVideoPlaying,
      currentTime,
      selectedSubtitleId: selectedSubtitle?.id,
    });
  }, [subtitles, originalSubtitles, workspaceId, isVideoPlaying, currentTime, selectedSubtitle]);

  // Get current subtitle based on current time for highlighting
  const getCurrentSubtitle = (): Subtitle | null => {
    if (!subtitles.length || !isVideoPlaying) {
      return null; // No subtitle is "currently playing" if video isn't playing
    }

    return (
      subtitles.find(
        (subtitle) => currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
      ) || null
    );
  };

  const currentPlayingSubtitle = getCurrentSubtitle();

  const [hoveredSubtitleId, setHoveredSubtitleId] = useState<string | null>(null);
  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const currentSubtitleRef = useRef<HTMLDivElement>(null);

  // 🚀 OPTIMIZED: Calculate all gap states once when subtitles change
  const gapStates = useMemo((): Map<number, GapState> => {
    const gaps = new Map<number, GapState>();

    if (!subtitles || subtitles.length < 2) {
      return gaps;
    }

    console.log('🔧 RECALCULATING GAP STATES for', subtitles.length, 'subtitles');

    for (let i = 1; i < subtitles.length; i++) {
      const prevSubtitle = subtitles[i - 1];
      const currSubtitle = subtitles[i];

      if (!prevSubtitle || !currSubtitle) continue;

      // 🔢 Ensure proper number conversion
      const prevEndTime = Number(prevSubtitle.endTime);
      const currStartTime = Number(currSubtitle.startTime);

      // Validate the parsed numbers
      if (isNaN(prevEndTime) || isNaN(currStartTime)) {
        continue;
      }

      const gapDuration = currStartTime - prevEndTime;
      // 🔧 CORRECTED: Use 1 second threshold now that formatTime shows precise timestamps
      const isEnabled = gapDuration >= 1.0; // Enable if gap is ≥1 second (meaningful gap for new subtitles)

      gaps.set(i, {
        index: i,
        gapDuration,
        isEnabled,
        prevSubtitle,
        currSubtitle,
      });
    }

    return gaps;
  }, [subtitles]); // Only recalculate when subtitles change

  // Auto-scroll to center current subtitle when it changes
  useEffect(() => {
    if (currentPlayingSubtitle && currentSubtitleRef.current && listContainerRef.current) {
      const container = listContainerRef.current;
      const element = currentSubtitleRef.current;

      // Calculate the position to center the element
      const containerHeight = container.clientHeight;
      const elementTop = element.offsetTop;
      const elementHeight = element.clientHeight;

      // Scroll to center the current subtitle
      const scrollPosition = elementTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: scrollPosition,
        behavior: 'smooth',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayingSubtitle?.id]); // Only trigger when current subtitle changes

  const handleSubtitleClick = (subtitle: Subtitle) => {
    setSelectedSubtitle(subtitle.id);
    // Don't jump to subtitle on click - only select it for editing
  };

  const handleEdit = (subtitleId: string) => {
    setSelectedSubtitle(subtitleId);
    jumpToSubtitle(subtitleId);
  };

  const handleDelete = async (subtitleId: string) => {
    try {
      deleteSubtitle(subtitleId);
      await saveToWorkspace();
    } catch (error) {
      console.error('Failed to delete subtitle:', error);
    }
  };

  const handleAddBetween = (index: number) => {
    const gapState = gapStates.get(index);
    if (!gapState || !gapState.isEnabled) {
      console.warn(`❌ Cannot add subtitle - gap ${index} is disabled or invalid`);
      return;
    }

    const { prevSubtitle, currSubtitle, gapDuration } = gapState;

    // Calculate optimal timing for new subtitle
    const startTime = prevSubtitle.endTime + 0.1; // 0.1 second after previous ends

    // Use 5 seconds duration, or entire gap if less than 5 seconds (minus buffer)
    let endTime: number;
    if (gapDuration <= 5.2) {
      // 5 seconds + 0.2 buffer
      endTime = currSubtitle.startTime - 0.1; // 0.1 second before next starts
    } else {
      endTime = startTime + 5.0; // 5 seconds duration
    }

    const newSubtitle = {
      index: prevSubtitle.index + 1,
      startTime,
      endTime,
      duration: endTime - startTime,
      text: '',
      translation: '',
    };

    addSubtitle(newSubtitle);

    // Auto-select the new subtitle for editing
    setTimeout(() => {
      const addedSubtitle = subtitles.find((s) => s.startTime === startTime);
      if (addedSubtitle) {
        setSelectedSubtitle(addedSubtitle.id);
      }
    }, 100);

    console.log(
      `✅ Added new subtitle between ${prevSubtitle.index} and ${currSubtitle.index}`,
      newSubtitle
    );
  };

  // Check if there's space at the end for adding new subtitle
  const hasSpaceAtEnd = (): boolean => {
    if (!subtitles || !Array.isArray(subtitles)) return false;

    // If no subtitles yet, allow adding
    if (subtitles.length === 0) return true;

    // If no video duration yet, don't allow (wait for video to load)
    if (!videoDuration || videoDuration <= 0) return false;

    const lastSubtitle = subtitles[subtitles.length - 1];

    // Check if there's at least 5.1 seconds of space after the last subtitle
    // (5 seconds for new subtitle + 0.1 second buffer)
    const remainingTime = videoDuration - lastSubtitle.endTime;
    return remainingTime >= 5.1;
  };

  // Handle adding new subtitle at the end
  const handleAddNew = () => {
    if (!subtitles || !Array.isArray(subtitles) || !hasSpaceAtEnd()) return;

    let startTime: number;
    let endTime: number;

    if (subtitles.length === 0) {
      // First subtitle
      startTime = 0;
      endTime = Math.min(5.0, videoDuration - 0.1); // Don't exceed video duration
    } else {
      // Add after last subtitle
      const lastSubtitle = subtitles[subtitles.length - 1];
      startTime = lastSubtitle.endTime + 0.1; // 0.1 second after last subtitle ends

      // Use 5 seconds or remaining video time (minus buffer), whichever is smaller
      const remainingTime = videoDuration - startTime - 0.1; // 0.1 buffer
      endTime = startTime + Math.min(5.0, remainingTime);
    }

    const newSubtitle = {
      index: subtitles.length + 1,
      startTime,
      endTime,
      duration: endTime - startTime,
      text: '',
      translation: '',
    };

    addSubtitle(newSubtitle);

    // Auto-select the new subtitle for editing
    setTimeout(() => {
      const addedSubtitle = subtitles.find((s) => s.startTime === startTime);
      if (addedSubtitle) {
        setSelectedSubtitle(addedSubtitle.id);
      }
    }, 100);

    console.log('✅ Added new subtitle at end:', newSubtitle);
  };

  // Get original subtitle for comparison
  const getOriginalSubtitle = (currentSubtitle: Subtitle): Subtitle | null => {
    if (!originalSubtitles.length) return null;

    // Try to find by ID first
    let original = originalSubtitles.find((orig) => orig.id === currentSubtitle.id);

    // If not found by ID, try to find by index or timing
    if (!original) {
      original = originalSubtitles.find(
        (orig) =>
          orig.index === currentSubtitle.index ||
          (Math.abs(orig.startTime - currentSubtitle.startTime) < 0.1 &&
            Math.abs(orig.endTime - currentSubtitle.endTime) < 0.1)
      );
    }

    return original || null;
  };

  const getModificationType = (subtitle: Subtitle): 'added' | 'modified' | 'deleted' | null => {
    const originalSubtitle = getOriginalSubtitle(subtitle);

    if (!originalSubtitle) {
      // Current subtitle exists but no original found - likely added
      return 'added';
    }

    // Compare with original
    const originalChinese = originalSubtitle.text || '';
    const currentChinese = subtitle.text || '';
    const originalTranslation = originalSubtitle.translation || '';
    const currentTranslation = subtitle.translation || '';

    // Check if either Chinese text or translation has changed
    const chineseChanged = originalChinese.trim() !== currentChinese.trim();
    const translationChanged = originalTranslation.trim() !== currentTranslation.trim();

    if (chineseChanged || translationChanged) {
      return 'modified';
    }

    return null; // No changes detected
  };

  if (isSaving) {
    return (
      <ReviewCard>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 300,
          }}
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Saving...</Typography>
        </Box>
      </ReviewCard>
    );
  }

  if (!subtitles.length) {
    return (
      <ReviewCard>
        <Typography variant='h6' sx={{ mb: 2 }}>
          Generated Subtitles
        </Typography>
        <Alert severity='info'>
          No subtitles available. Complete the processing step to generate subtitles.
        </Alert>
      </ReviewCard>
    );
  }

  return (
    <ReviewCard
      sx={{
        height: '100%', // Use available height from parent container
        maxHeight: '100%', // Allow parent container to control height
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant='h6'>Generated Subtitles</Typography>
          <Chip label={subtitles.length} size='small' />
          {/* Show available gaps only (gaps that are large enough for adding subtitles) */}
          {(() => {
            const availableGaps = Array.from(gapStates.values()).filter(
              (gap) => gap.isEnabled
            ).length;
            return availableGaps > 0 ? (
              <Chip
                label={`${availableGaps} gap${availableGaps > 1 ? 's' : ''}`}
                size='small'
                variant='outlined'
                sx={{
                  fontSize: '0.65rem',
                  backgroundColor: 'rgba(87, 242, 135, 0.1)',
                  borderColor: 'rgba(87, 242, 135, 0.3)',
                  color: '#57F287',
                }}
              />
            ) : null;
          })()}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={showDiff ? 'Hide diff view' : 'Show diff view'}>
            <IconButton
              size='small'
              onClick={() => setShowDiff(!showDiff)}
              disabled={!originalSubtitles.length}
            >
              <HideIcon color={showDiff ? 'primary' : 'inherit'} />
            </IconButton>
          </Tooltip>
          {showDiff && originalSubtitles.length > 0 && (
            <Chip
              label={`${originalSubtitles.length} original`}
              size='small'
              variant='outlined'
              sx={{
                fontSize: '0.65rem',
                backgroundColor: 'rgba(29, 185, 84, 0.1)',
                borderColor: 'rgba(29, 185, 84, 0.3)',
                color: '#1DB954',
              }}
            />
          )}
        </Box>
      </Box>

      <Box
        ref={listContainerRef}
        sx={{
          flex: '1 1 0',
          overflow: 'auto',
          mb: 2,
          minHeight: 0,
        }}
      >
        <List dense>
          {subtitles.map((subtitle, index) => {
            const isSelected = selectedSubtitle?.id === subtitle.id;
            const isCurrentlyPlaying = currentPlayingSubtitle?.id === subtitle.id;
            const modificationType = getModificationType(subtitle);
            const isHovered = hoveredSubtitleId === subtitle.id;

            return (
              <React.Fragment key={subtitle.id}>
                {/* 🎯 OPTIMIZED: Gap area between subtitles with individual state */}
                {index > 0 &&
                  (() => {
                    const gapState = gapStates.get(index);

                    // Skip if no gap state (shouldn't happen, but safety first)
                    if (!gapState) {
                      console.warn(`❌ No gap state found for index ${index}`);
                      return null;
                    }

                    const { gapDuration, isEnabled } = gapState;
                    const isGapHovered = hoveredGapIndex === index;

                    return (
                      <Box
                        key={`gap-${index}`}
                        sx={{
                          height: isGapHovered ? '40px' : '8px', // Expand when hovered
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          backgroundColor: 'transparent',
                          borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                          transition: 'height 0.2s ease', // Smooth height transition
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.02)',
                            cursor: isEnabled ? 'pointer' : 'not-allowed',
                          },
                        }}
                        onMouseEnter={() => setHoveredGapIndex(index)}
                        onMouseLeave={() => setHoveredGapIndex(null)}
                        onClick={() => isEnabled && handleAddBetween(index)}
                      >
                        {/* Only show button when hovering over gap */}
                        {isGapHovered && (
                          <Tooltip
                            title={
                              isEnabled
                                ? `Add subtitle in ${gapDuration.toFixed(2)}s gap`
                                : `Gap too small (${gapDuration.toFixed(2)}s) - need ≥1.0s`
                            }
                          >
                            <Box
                              className='add-button'
                              sx={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: isEnabled
                                  ? 'rgba(245, 158, 11, 0.1)' // Enabled: amber
                                  : 'rgba(128, 128, 128, 0.1)', // Disabled: gray
                                border: isEnabled
                                  ? '2px dashed #F59E0B' // Enabled: amber dashed
                                  : '2px dashed #666', // Disabled: gray dashed
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: isEnabled ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s ease',
                                opacity: isEnabled ? 0.8 : 0.4,
                                '&:hover': isEnabled
                                  ? {
                                      opacity: 1,
                                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                      borderColor: '#D97706',
                                      transform: 'scale(1.1)',
                                    }
                                  : {},
                              }}
                            >
                              <AddIcon
                                sx={{
                                  fontSize: '16px',
                                  color: isEnabled ? '#F59E0B' : '#666',
                                }}
                              />
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    );
                  })()}

                <Box
                  ref={isCurrentlyPlaying ? currentSubtitleRef : null}
                  sx={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredSubtitleId(subtitle.id)}
                  onMouseLeave={() => setHoveredSubtitleId(null)}
                >
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => handleSubtitleClick(subtitle)}
                    sx={{
                      border: 1,
                      borderColor: isCurrentlyPlaying
                        ? '#57F287'
                        : isSelected
                          ? 'primary.main'
                          : 'divider',
                      borderRadius: 2,
                      mb: 1,
                      p: 2,
                      position: 'relative',
                      backgroundColor: isCurrentlyPlaying
                        ? 'rgba(87, 242, 135, 0.1)'
                        : 'transparent',
                      '&.Mui-selected': {
                        backgroundColor: isCurrentlyPlaying
                          ? 'rgba(87, 242, 135, 0.15)'
                          : 'rgba(245, 158, 11, 0.1)',
                        borderColor: isCurrentlyPlaying ? '#57F287' : '#F59E0B',
                      },
                      '&:hover': {
                        backgroundColor: isCurrentlyPlaying
                          ? 'rgba(87, 242, 135, 0.15)'
                          : 'rgba(245, 158, 11, 0.05)',
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box>
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 1,
                              mb: 1,
                              alignItems: 'center',
                            }}
                          >
                            <Chip
                              label={formatTime(subtitle.startTime)}
                              size='small'
                              variant='outlined'
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                              }}
                            />
                            {subtitle.confidence !== undefined && subtitle.confidence > 0 && (
                              <Chip
                                label={`${subtitle.confidence}%`}
                                size='small'
                                color={
                                  subtitle.confidence > 90
                                    ? 'success'
                                    : subtitle.confidence > 80
                                      ? 'warning'
                                      : 'error'
                                }
                              />
                            )}
                            {modificationType && (
                              <ModificationChip
                                modificationType={modificationType}
                                label={modificationType}
                                size='small'
                                variant='outlined'
                              />
                            )}
                            {isCurrentlyPlaying && (
                              <Chip
                                label='PLAYING'
                                size='small'
                                sx={{
                                  backgroundColor: '#57F287',
                                  color: '#000',
                                  fontWeight: 600,
                                  fontSize: '0.65rem',
                                  animation: 'pulse 2s infinite',
                                }}
                                icon={
                                  <PlayIcon
                                    sx={{
                                      fontSize: '12px !important',
                                      color: '#000 !important',
                                    }}
                                  />
                                }
                              />
                            )}
                          </Box>

                          <Typography
                            variant='body2'
                            sx={{
                              fontWeight: 500,
                              mb: 0.5,
                              lineHeight: 1.4,
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {subtitle.text}
                          </Typography>

                          {/* Display translation text if available */}
                          {subtitle.translation &&
                            subtitle.translation.trim() &&
                            subtitle.translation !== subtitle.text && (
                              <Typography
                                variant='body2'
                                sx={{
                                  fontWeight: 400,
                                  mb: 0.5,
                                  lineHeight: 1.4,
                                  whiteSpace: 'pre-line',
                                  color: 'text.secondary',
                                  fontStyle: 'italic',
                                  fontSize: '0.9em',
                                }}
                              >
                                {subtitle.translation}
                              </Typography>
                            )}

                          {modificationType === 'modified' &&
                            showDiff &&
                            (() => {
                              const originalSubtitle = getOriginalSubtitle(subtitle);
                              if (!originalSubtitle) return null;

                              const originalChinese = originalSubtitle.text || '';
                              const originalTranslation = originalSubtitle.translation || '';

                              const currentChinese = subtitle.text || '';
                              const currentTranslation = subtitle.translation || '';

                              const chineseChanged =
                                originalChinese.trim() !== currentChinese.trim();
                              const translationChanged =
                                originalTranslation.trim() !== currentTranslation.trim();

                              if (!chineseChanged && !translationChanged) return null;

                              const renderDiffParts = (parts: DiffPart[]) =>
                                parts.map((part, index) => (
                                  <Typography
                                    key={index}
                                    component='span'
                                    sx={{
                                      backgroundColor:
                                        part.type === 'added'
                                          ? 'rgba(87, 242, 135, 0.2)'
                                          : part.type === 'removed'
                                            ? 'rgba(237, 66, 69, 0.2)'
                                            : 'transparent',
                                      color:
                                        part.type === 'added'
                                          ? '#57F287'
                                          : part.type === 'removed'
                                            ? '#ED4245'
                                            : 'inherit',
                                      textDecoration:
                                        part.type === 'removed' ? 'line-through' : 'none',
                                      padding: part.type !== 'unchanged' ? '1px 2px' : '0',
                                      borderRadius: '2px',
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    {part.text}
                                  </Typography>
                                ));

                              return (
                                <Box
                                  sx={{
                                    mt: 1,
                                    p: 1,
                                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: 1,
                                    border: '1px solid rgba(64, 68, 75, 0.3)',
                                  }}
                                >
                                  <Typography
                                    variant='caption'
                                    color='text.secondary'
                                    sx={{ mb: 0.5, display: 'block' }}
                                  >
                                    Changes:
                                  </Typography>

                                  {/* Chinese text changes */}
                                  {chineseChanged && (
                                    <Box sx={{ mb: translationChanged ? 1 : 0 }}>
                                      <Typography
                                        variant='caption'
                                        color='text.secondary'
                                        sx={{ fontSize: '0.7rem', display: 'block', mb: 0.25 }}
                                      >
                                        Chinese:
                                      </Typography>
                                      <Box sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                                        {renderDiffParts(
                                          generateCharacterDiff(originalChinese, currentChinese)
                                        )}
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Translation changes */}
                                  {translationChanged && (
                                    <Box>
                                      <Typography
                                        variant='caption'
                                        color='text.secondary'
                                        sx={{ fontSize: '0.7rem', display: 'block', mb: 0.25 }}
                                      >
                                        Translation:
                                      </Typography>
                                      <Box sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                                        {renderDiffParts(
                                          generateCharacterDiff(
                                            originalTranslation,
                                            currentTranslation
                                          )
                                        )}
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Data source indicator */}
                                  <Box
                                    sx={{
                                      mt: 1,
                                      pt: 1,
                                      borderTop: '1px solid rgba(64, 68, 75, 0.2)',
                                    }}
                                  >
                                    <Typography
                                      variant='caption'
                                      color='text.secondary'
                                      sx={{
                                        fontSize: '0.65rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: '50%',
                                          backgroundColor: '#1DB954',
                                        }}
                                      />
                                      Compared with original
                                    </Typography>
                                  </Box>
                                </Box>
                              );
                            })()}
                        </Box>
                      }
                    />
                  </ListItemButton>

                  {/* Hover action buttons */}
                  {isHovered && (
                    <Box
                      sx={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        gap: 1,
                        backgroundColor: 'rgba(47, 49, 54, 0.95)',
                        borderRadius: 1,
                        padding: '4px',
                        border: '1px solid rgba(64, 68, 75, 0.5)',
                        zIndex: 2,
                      }}
                    >
                      <Tooltip title='Edit'>
                        <IconButton
                          size='small'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(subtitle.id);
                          }}
                          sx={{
                            color: '#F59E0B',
                            '&:hover': {
                              backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            },
                          }}
                        >
                          <EditIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title='Delete'>
                        <IconButton
                          size='small'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(subtitle.id);
                          }}
                          disabled={isSaving}
                          sx={{
                            color: '#ED4245',
                            '&:hover': {
                              backgroundColor: 'rgba(237, 66, 69, 0.1)',
                            },
                            '&:disabled': {
                              color: 'rgba(237, 66, 69, 0.3)',
                            },
                          }}
                        >
                          {isSaving ? (
                            <CircularProgress size={16} sx={{ color: '#ED4245' }} />
                          ) : (
                            <DeleteIcon fontSize='small' />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </React.Fragment>
            );
          })}
        </List>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          mt: 'auto', // Push to bottom
        }}
      >
        <ActionButton
          startIcon={<AddIcon />}
          size='medium'
          fullWidth
          onClick={handleAddNew}
          disabled={!hasSpaceAtEnd()}
          sx={{
            py: 1.5,
            fontWeight: 600,
            backgroundColor: 'rgba(245, 158, 11, 0.1)', // Transparent amber background
            border: '2px dashed #F59E0B', // Dotted amber border
            color: '#F59E0B', // Amber text color
            '&:hover': {
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderColor: '#D97706',
            },
            '&:disabled': {
              backgroundColor: 'rgba(128, 128, 128, 0.1)',
              borderColor: '#666',
              color: '#666',
            },
          }}
        >
          Add New Subtitle
        </ActionButton>
      </Box>
    </ReviewCard>
  );
};
