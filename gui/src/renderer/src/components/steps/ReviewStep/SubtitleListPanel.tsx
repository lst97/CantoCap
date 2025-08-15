import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  useSubtitleEditStore,
  useSubtitles,
  useOriginalSubtitles,
  useSelectedSubtitle,
  useSaveState,
  useSubtitleActions,
  useSubtitleWorkspace,
} from '../../../stores/useSubtitleEditStore';
import { useInputStepContent } from '../../../stores/useStepStore';
import { useActiveWorkspaceId } from '../../../stores/useAppStore';
import { Subtitle } from '../../../stores/types/StoreTypes';
import { ReviewCard, ModificationChip, ActionButton } from './styles';
import { formatTime, generateCharacterDiff } from './utils';
import { DiffPart } from './types';
import { ElectronWindow } from '../../../../../types';

// Interface for gap state management
interface GapState {
  index: number;
  gapDuration: number;
  isEnabled: boolean;
  prevSubtitle: Subtitle;
  currSubtitle: Subtitle;
}

export const SubtitleListPanel: React.FC = () => {
  const rawSubtitles = useSubtitles();
  const originalSubtitles = useOriginalSubtitles();
  const { isDirty: _isDirty } = useSaveState();
  const inputStepContent = useInputStepContent();
  const activeWorkspaceId = useActiveWorkspaceId();

  // Memoize subtitles with proper dependencies to prevent infinite loops while detecting real changes
  const subtitles = useMemo(() => rawSubtitles, [rawSubtitles]);
  const selectedSubtitle = useSelectedSubtitle();

  // PERFORMANCE FIX: Use separate selectors to prevent re-renders from currentTime changes
  const currentTime = useSubtitleEditStore((state) => state.currentTime);
  const isVideoPlaying = useSubtitleEditStore((state) => state.isVideoPlaying);
  const videoDuration = useSubtitleEditStore((state) => state.videoDuration);

  const { workspaceId } = useSubtitleWorkspace();
  const { isSaving } = useSaveState();
  const { deleteSubtitle, addSubtitle, setSelectedSubtitle, jumpToSubtitle, saveToWorkspace } =
    useSubtitleActions();

  // State for diff view and JSON loading
  const [showDiff, setShowDiff] = useState(false);
  const [isLoadingJsonSubtitles, setIsLoadingJsonSubtitles] = useState(false);

  // Handle JSON subtitle loading when JSON was imported but no subtitles are loaded
  useEffect(() => {
    const loadJsonSubtitles = async () => {
      const hasJsonImport = !!inputStepContent?.importedJsonFile;
      const hasSubtitles = subtitles && subtitles.length > 0;

      // Only load if we have JSON import but no subtitles, and we're not already loading
      if (hasJsonImport && !hasSubtitles && !isLoadingJsonSubtitles && activeWorkspaceId) {
        console.log(
          '🔄 JSON import detected but no subtitles loaded, attempting to load from backend...'
        );
        setIsLoadingJsonSubtitles(true);

        try {
          // Try to load subtitles from the backend sync store
          const syncResult = await (
            window as unknown as ElectronWindow
          ).cantocapAPI.subtitleSyncFromStep(activeWorkspaceId);
          if (
            syncResult &&
            (syncResult as any).subtitles &&
            Array.isArray((syncResult as any).subtitles) &&
            (syncResult as any).subtitles.length > 0
          ) {
            console.log(
              `✅ Found ${(syncResult as any).subtitles.length} subtitles in backend, importing to subtitle edit store...`
            );

            // Note: importFromJson functionality would be handled here
            // This is where subtitle data would be imported into the edit store
            console.log(
              'Subtitle import would happen here with:',
              (syncResult as any).subtitles.length,
              'subtitles'
            );

            console.log(
              '✅ Subtitles successfully loaded into subtitle edit store from JSON import'
            );
          } else {
            console.log(
              '❌ No subtitles found in backend sync store, trying to load JSON file directly...'
            );

            // Fallback: try to load the JSON file directly
            if (inputStepContent?.importedJsonFile) {
              try {
                const jsonContent = await (
                  window as unknown as ElectronWindow
                ).cantocapAPI.readJsonFile(inputStepContent.importedJsonFile);
                if (
                  jsonContent &&
                  (jsonContent as any).subtitles &&
                  Array.isArray((jsonContent as any).subtitles)
                ) {
                  console.log(
                    `✅ Loaded JSON file directly with ${(jsonContent as any).subtitles.length} subtitles`
                  );

                  // Note: importFromJson functionality would be handled here
                  console.log('✅ Subtitles would be imported from direct JSON file load');
                } else {
                  console.log('❌ JSON file does not contain valid subtitle data');
                }
              } catch (jsonError) {
                console.error('❌ Failed to load JSON file directly:', jsonError);
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to load JSON subtitles:', error);
        } finally {
          setIsLoadingJsonSubtitles(false);
        }
      }
    };

    loadJsonSubtitles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputStepContent?.importedJsonFile,
    subtitles?.length,
    activeWorkspaceId,
    isLoadingJsonSubtitles,
    inputStepContent?.inputFile,
  ]);

  // Listen for manual retry events
  useEffect(() => {
    const handleRetryLoad = () => {
      setIsLoadingJsonSubtitles(false); // This will trigger the main effect to run again
    };

    window.addEventListener('retryJsonLoad', handleRetryLoad);
    return () => window.removeEventListener('retryJsonLoad', handleRetryLoad);
  }, []);

  // Get current subtitle based on current time for highlighting - MEMOIZED FOR PERFORMANCE
  const currentPlayingSubtitle = useMemo((): Subtitle | null => {
    if (!subtitles.length || !isVideoPlaying) {
      return null; // No subtitle is "currently playing" if video isn't playing
    }

    return (
      subtitles.find(
        (subtitle) => currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
      ) || null
    );
  }, [subtitles, currentTime, isVideoPlaying]); // Only recalculate when these values change

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
        console.warn(`❌ Invalid timing data for gap ${i}:`, { prevEndTime, currStartTime });
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

    console.log(
      '✅ Gap calculation complete:',
      Array.from(gaps.values()).map((g) => ({
        index: g.index,
        duration: g.gapDuration.toFixed(2),
        enabled: g.isEnabled,
      }))
    );
    return gaps;
  }, [subtitles]); // Only recalculate when subtitles change

  // DEBUG: Log subtitle data and gap states - PERFORMANCE OPTIMIZED
  // Only log when significant changes occur, not on every video time update
  React.useEffect(() => {
    console.log('🔍 DEBUG: SubtitleListPanel data:', {
      workspaceId,
      hasSubtitles: !!subtitles.length,
      subtitlesLength: subtitles.length,
      hasOriginalSubtitles: !!originalSubtitles.length,
      originalSubtitlesLength: originalSubtitles.length,
      selectedSubtitleId: selectedSubtitle?.id,
      gapStatesCount: gapStates.size,
      availableGaps: Array.from(gapStates.values()).filter((g) => g.isEnabled).length,
      hasJsonImport: !!inputStepContent?.importedJsonFile,
      jsonFilePath: inputStepContent?.importedJsonFile,
      isLoadingJsonSubtitles,
    });

    // Debug first few subtitles to check caption vs translation data
    if (subtitles.length > 0) {
      console.log(
        '📝 First 3 subtitles data structure:',
        subtitles.slice(0, 3).map((s, i) => ({
          index: i,
          id: s.id,
          text: s.text,
          translation: s.translation,
          hasTranslation: !!(s.translation && s.translation.trim() && s.translation !== s.text),
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subtitles.length, // Only when subtitle count changes
    originalSubtitles.length, // Only when original count changes
    workspaceId, // Only when workspace changes
    selectedSubtitle?.id, // Only when selection changes
    gapStates.size, // Only when gap count changes
    inputStepContent?.importedJsonFile, // Only when JSON import changes
    isLoadingJsonSubtitles, // Only when loading state changes
    // Removed: isVideoPlaying, currentTime - these change constantly during playback
  ]);

  // Auto-scroll to center current subtitle when it changes - THROTTLED FOR PERFORMANCE
  useEffect(() => {
    if (currentPlayingSubtitle && currentSubtitleRef.current && listContainerRef.current) {
      const container = listContainerRef.current;
      const element = currentSubtitleRef.current;

      // Calculate the position to center the element
      const containerHeight = container.clientHeight;
      const elementTop = element.offsetTop;
      const elementHeight = element.clientHeight;

      // Scroll to center the current subtitle with instant behavior during playback
      // to avoid smooth scrolling interfering with video timeline
      const scrollPosition = elementTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: scrollPosition,
        behavior: isVideoPlaying ? 'instant' : 'smooth', // Instant during playback, smooth when paused
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayingSubtitle?.id, isVideoPlaying]); // Re-run when subtitle changes or play state changes

  const handleSubtitleClick = (subtitle: Subtitle) => {
    setSelectedSubtitle(subtitle.id);
    // Don't jump to subtitle on click - only select it for editing
  };

  const handleEdit = useCallback(
    (subtitleId: string) => {
      // PERFORMANCE FIX: Optimize jump-to-subtitle to prevent interference with video playback
      setSelectedSubtitle(subtitleId);

      // Use a small delay to ensure the selection is processed before jumping
      // This prevents the jumping action from conflicting with continuous video time updates
      setTimeout(() => {
        jumpToSubtitle(subtitleId);
      }, 50);
    },
    [setSelectedSubtitle, jumpToSubtitle]
  );

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
    const hasJsonImport = !!inputStepContent?.importedJsonFile;

    return (
      <ReviewCard>
        <Typography variant='h6' sx={{ mb: 2 }}>
          Generated Subtitles
        </Typography>
        {isLoadingJsonSubtitles ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography>Loading subtitles from imported JSON...</Typography>
          </Box>
        ) : hasJsonImport ? (
          <Alert
            severity='warning'
            action={
              <ActionButton
                size='small'
                onClick={() => {
                  setIsLoadingJsonSubtitles(false); // Reset loading state to trigger retry
                  // Force re-run of the effect
                  const loadEffect = setTimeout(() => {
                    const event = new CustomEvent('retryJsonLoad');
                    window.dispatchEvent(event);
                  }, 100);
                  return () => clearTimeout(loadEffect);
                }}
                sx={{ fontSize: '0.75rem' }}
              >
                Retry Load
              </ActionButton>
            }
          >
            Imported JSON subtitles could not be loaded. Try re-importing your JSON file from Step
            1, or check the console for error details.
          </Alert>
        ) : (
          <Alert severity='info'>
            No subtitles available. Complete the processing step to generate subtitles.
          </Alert>
        )}
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

                          {/* Main caption text (transcription) */}
                          <Typography
                            variant='body2'
                            sx={{
                              fontWeight: 500,
                              mb: subtitle.translation && subtitle.translation.trim() ? 0.25 : 0.5,
                              lineHeight: 1.4,
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {subtitle.text}
                          </Typography>

                          {/* Translation text if available */}
                          {subtitle.translation && subtitle.translation.trim() && (
                            <Typography
                              variant='body2'
                              sx={{
                                fontWeight: 400,
                                mb: 0.5,
                                lineHeight: 1.4,
                                whiteSpace: 'pre-line',
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontStyle: 'italic',
                                fontSize: '0.85em',
                                pl: 1,
                                borderLeft: '2px solid rgba(245, 158, 11, 0.3)',
                                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                                borderRadius: '0 4px 4px 0',
                                py: 0.5,
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
