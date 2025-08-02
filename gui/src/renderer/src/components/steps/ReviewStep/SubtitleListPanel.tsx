import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
} from "@mui/material";
import {
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  VisibilityOff as HideIcon,
} from "@mui/icons-material";
import { useSubtitleEditStore } from "../../../stores/subtitle-edit-store";
import { useAppStore } from "../../../stores/app-store";
import { SubtitleEntry, SubtitleModification } from "../../../types/subtitle";
import { ReviewCard, ModificationChip, ActionButton } from "./styles";
import { formatTime, generateCharacterDiff, generateBilingualDiff } from "./utils";
import { SubtitleListPanelProps } from "./types";
import { loadSessionSubtitles } from "../../../utils/subtitle-indexeddb";

// Interface for gap state management
interface GapState {
  index: number;
  gapDuration: number;
  isEnabled: boolean;
  prevSubtitle: SubtitleEntry;
  currSubtitle: SubtitleEntry;
}

export const SubtitleListPanel: React.FC<SubtitleListPanelProps> = () => {
  const {
    session,
    setSelectedSubtitle,
    jumpToSubtitle,
    deleteSubtitle,
    addSubtitle,
    isLoading,
    manualSaveToIndexedDB,
    isSaving,
  } = useSubtitleEditStore();
  
  const { config } = useAppStore();
  const currentWorkspaceId = config?.workspaceId;

  // State for IndexedDB original data for accurate diff comparison
  const [originalSubtitlesFromDB, setOriginalSubtitlesFromDB] = useState<SubtitleEntry[]>([]);
  const [isLoadingOriginalData, setIsLoadingOriginalData] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // Load original subtitles from IndexedDB for accurate diff comparison
  const loadOriginalDataForDiff = useCallback(async () => {
    if (!session?.workspaceId || !session?.sessionId || isLoadingOriginalData) {
      return;
    }

    setIsLoadingOriginalData(true);
    try {
      console.log('🔍 Loading original subtitles from IndexedDB for diff comparison');
      const subtitles = await loadSessionSubtitles(session.workspaceId, session.sessionId);
      
      if (subtitles.original && Array.isArray(subtitles.original)) {
        setOriginalSubtitlesFromDB(subtitles.original);
        console.log('✅ Loaded original subtitles for diff:', subtitles.original.length);
      } else {
        console.log('⚠️ No original subtitles found in IndexedDB');
        setOriginalSubtitlesFromDB([]);
      }
    } catch (error) {
      console.error('❌ Failed to load original subtitles for diff:', error);
      setOriginalSubtitlesFromDB([]);
    } finally {
      setIsLoadingOriginalData(false);
    }
  }, [session?.workspaceId, session?.sessionId]);

  // Clear original data when session changes
  useEffect(() => {
    setOriginalSubtitlesFromDB([]);
  }, [session?.workspaceId, session?.sessionId]);

  // DEBUG: Log session data when it changes (with performance monitoring)
  React.useEffect(() => {
    const perfStart = performance.now();
    
    console.log('🔍 DEBUG: SubtitleListPanel session data:', {
      hasSession: !!session,
      sessionId: session?.sessionId,
      workspaceId: session?.workspaceId,
      hasCurrentSubtitles: !!session?.currentSubtitles,
      currentSubtitlesLength: session?.currentSubtitles?.length,
      currentSubtitlesSample: session?.currentSubtitles?.slice(0, 2),
      isLoading,
      sessionLastModified: session?.lastModified,
      sessionIsDirty: session?.isDirty,
      isVideoPlaying: session?.isVideoPlaying, // ADDED: Monitor video playing state
      currentTime: session?.currentTime // ADDED: Monitor current time
    });
    
    // Additional debug for empty session but should have data
    if (!session?.currentSubtitles?.length && !isLoading) {
      console.log('⚠️ DEBUG: SubtitleListPanel has no data to display');
      
      // Check if app config has subtitle data that should be in session
      if (config?.subtitle?.length > 0) {
        console.log('🔍 DEBUG: App config has subtitle data but session is empty:', {
          configSubtitleLength: config.subtitle.length,
          hasImportedJson: !!config.importedJsonFile,
          isImportedFromJson: !!config.isImportedFromJson,
          configSample: config.subtitle.slice(0, 2)
        });
      }
    }
    
    // PERFORMANCE: Log render time for debugging
    const perfEnd = performance.now();
    if (perfEnd - perfStart > 10) { // Only log if > 10ms
      console.log('⏱️ PERF: SubtitleListPanel debug effect took', (perfEnd - perfStart).toFixed(2), 'ms');
    }
  }, [session, isLoading, config]);

  // Get current subtitle based on current time for highlighting
  // FIXED: Only show as "currently playing" when video is actually playing
  const getCurrentSubtitle = (): SubtitleEntry | null => {
    if (!session || !session.currentSubtitles || !Array.isArray(session.currentSubtitles)) return null;
    
    // CRITICAL FIX: Only return current subtitle if video is actually playing
    // This prevents all subtitles from showing "PLAYING" state on JSON import
    if (!session.isVideoPlaying) {
      return null; // No subtitle is "currently playing" if video isn't playing
    }

    return (
      session.currentSubtitles.find(
        (subtitle) =>
          session.currentTime >= subtitle.startTime &&
          session.currentTime <= subtitle.endTime
      ) || null
    );
  };

  const currentSubtitle = getCurrentSubtitle();

  const [hoveredSubtitleId, setHoveredSubtitleId] = useState<string | null>(
    null
  );
  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const currentSubtitleRef = useRef<HTMLDivElement>(null);

  // 🚀 OPTIMIZED: Calculate all gap states once when subtitles change
  const gapStates = useMemo((): Map<number, GapState> => {
    const perfStart = performance.now();
    const gaps = new Map<number, GapState>();

    if (!session?.currentSubtitles || session.currentSubtitles.length < 2) {
      return gaps;
    }

    console.log(
      "🔧 RECALCULATING GAP STATES for",
      session.currentSubtitles.length,
      "subtitles"
    );

    // 🧪 TEST: Log all subtitle timestamps to understand the data structure
    session.currentSubtitles.forEach((subtitle, idx) => {
      console.log(`📝 Subtitle ${idx}:`, {
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        startFormatted: formatTime(Number(subtitle.startTime)),
        endFormatted: formatTime(Number(subtitle.endTime)),
        text: subtitle.text.substring(0, 30) + "...",
      });
    });

    for (let i = 1; i < session.currentSubtitles.length; i++) {
      const prevSubtitle = session.currentSubtitles[i - 1];
      const currSubtitle = session.currentSubtitles[i];

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

    // PERFORMANCE: Log calculation time
    const perfEnd = performance.now();
    if (perfEnd - perfStart > 5) { // Only log if > 5ms
      console.log('⏱️ PERF: Gap states calculation took', (perfEnd - perfStart).toFixed(2), 'ms');
    }
    
    return gaps;
  }, [session?.currentSubtitles]); // Only recalculate when subtitles change

  // Auto-scroll to center current subtitle when it changes
  useEffect(() => {
    if (
      currentSubtitle &&
      currentSubtitleRef.current &&
      listContainerRef.current
    ) {
      const container = listContainerRef.current;
      const element = currentSubtitleRef.current;

      // Calculate the position to center the element
      const containerHeight = container.clientHeight;
      const elementTop = element.offsetTop;
      const elementHeight = element.clientHeight;

      // Scroll to center the current subtitle
      const scrollPosition =
        elementTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: scrollPosition,
        behavior: "smooth",
      });
    }
  }, [currentSubtitle?.id]); // Only trigger when current subtitle changes

  const handleSubtitleClick = (subtitle: SubtitleEntry) => {
    setSelectedSubtitle(subtitle.id);
    // Don't jump to subtitle on click - only select it for editing
  };

  const handleEdit = (subtitleId: string) => {
    setSelectedSubtitle(subtitleId);
    jumpToSubtitle(subtitleId);
  };

  const handleDelete = async (subtitleId: string) => {
    deleteSubtitle(subtitleId);
    await manualSaveToIndexedDB();
  };

  const handleAddBetween = (index: number) => {
    if (!session) return;

    const gapState = gapStates.get(index);
    if (!gapState || !gapState.isEnabled) {
      console.warn(
        `❌ Cannot add subtitle - gap ${index} is disabled or invalid`
      );
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
      text: "",
      translation: "",
    };

    addSubtitle(newSubtitle);

    // Auto-select the new subtitle for editing
    setTimeout(() => {
      setSelectedSubtitle(
        (session?.currentSubtitles && Array.isArray(session.currentSubtitles) 
          ? session.currentSubtitles.find((s) => s.startTime === startTime)?.id 
          : null) ||
          null
      );
    }, 100);

    console.log(
      `✅ Added new subtitle between ${prevSubtitle.index} and ${currSubtitle.index}`,
      newSubtitle
    );
  };

  // Check if there's space at the end for adding new subtitle
  const hasSpaceAtEnd = (): boolean => {
    if (!session || !session.currentSubtitles || !Array.isArray(session.currentSubtitles)) return false;

    // If no subtitles yet, allow adding
    if (session.currentSubtitles.length === 0) return true;

    // If no video duration yet, don't allow (wait for video to load)
    if (!session.videoDuration || session.videoDuration <= 0) return false;

    const lastSubtitle =
      session.currentSubtitles[session.currentSubtitles.length - 1];

    // Check if there's at least 5.1 seconds of space after the last subtitle
    // (5 seconds for new subtitle + 0.1 second buffer)
    const remainingTime = session.videoDuration - lastSubtitle.endTime;
    return remainingTime >= 5.1;
  };

  // Handle adding new subtitle at the end
  const handleAddNew = () => {
    if (!session || !session.currentSubtitles || !Array.isArray(session.currentSubtitles) || !hasSpaceAtEnd()) return;

    let startTime: number;
    let endTime: number;

    if (session.currentSubtitles.length === 0) {
      // First subtitle
      startTime = 0;
      endTime = Math.min(5.0, session.videoDuration - 0.1); // Don't exceed video duration
    } else {
      // Add after last subtitle
      const lastSubtitle =
        session.currentSubtitles[session.currentSubtitles.length - 1];
      startTime = lastSubtitle.endTime + 0.1; // 0.1 second after last subtitle ends

      // Use 5 seconds or remaining video time (minus buffer), whichever is smaller
      const remainingTime = session.videoDuration - startTime - 0.1; // 0.1 buffer
      endTime = startTime + Math.min(5.0, remainingTime);
    }

    const newSubtitle = {
      index: session.currentSubtitles.length + 1,
      startTime,
      endTime,
      duration: endTime - startTime,
      text: "",
      translation: "",
    };

    addSubtitle(newSubtitle);

    // Auto-select the new subtitle for editing
    setTimeout(() => {
      setSelectedSubtitle(
        (session?.currentSubtitles && Array.isArray(session.currentSubtitles) 
          ? session.currentSubtitles.find((s) => s.startTime === startTime)?.id 
          : null) ||
          null
      );
    }, 100);

    console.log("✅ Added new subtitle at end:", newSubtitle);
  };

  const getModificationForSubtitle = (
    subtitleId: string
  ): SubtitleModification | null => {
    if (!session) return null;
    return (
      session.modifications.find((m) => m.subtitleId === subtitleId) || null
    );
  };

  // NEW: Get original subtitle from IndexedDB data for accurate comparison
  const getOriginalSubtitleFromDB = (currentSubtitle: SubtitleEntry): SubtitleEntry | null => {
    if (!originalSubtitlesFromDB.length) return null;
    
    // Try to find by ID first
    let original = originalSubtitlesFromDB.find(orig => orig.id === currentSubtitle.id);
    
    // If not found by ID, try to find by index or timing (for subtitles that might have been re-indexed)
    if (!original) {
      original = originalSubtitlesFromDB.find(orig => 
        orig.index === currentSubtitle.index ||
        (Math.abs(orig.startTime - currentSubtitle.startTime) < 0.1 && 
         Math.abs(orig.endTime - currentSubtitle.endTime) < 0.1)
      );
    }
    
    return original || null;
  };

  const getModificationType = (
    subtitle: SubtitleEntry
  ): "added" | "modified" | "deleted" | null => {
    // First check modification history for added/deleted subtitles (these always show)
    const modification = getModificationForSubtitle(subtitle.id);
    if (modification?.type === "added" || modification?.type === "deleted") {
      return modification.type;
    }

    // NEW: Use IndexedDB original data for comparison if available
    if (originalSubtitlesFromDB.length > 0) {
      const originalSubtitle = getOriginalSubtitleFromDB(subtitle);
      
      if (!originalSubtitle) {
        // Current subtitle exists but no original found - likely added
        return "added";
      }
      
      // Compare with original from IndexedDB
      const originalChinese = originalSubtitle.text || '';
      const currentChinese = subtitle.text || '';
      const originalTranslation = originalSubtitle.translation || '';
      const currentTranslation = subtitle.translation || '';

      // Check if either Chinese text or translation has changed
      const chineseChanged = originalChinese.trim() !== currentChinese.trim();
      const translationChanged = originalTranslation.trim() !== currentTranslation.trim();

      if (chineseChanged || translationChanged) {
        return "modified";
      }
      
      return null; // No changes detected
    }

    // FALLBACK: Use modification records if IndexedDB data not available
    if (modification && modification.original && modification.type === 'modified') {
      const originalChinese = modification.original.text || '';
      const currentChinese = subtitle.text || '';
      const originalTranslation = modification.original.translation || '';
      const currentTranslation = subtitle.translation || '';

      // Check if either Chinese text or translation has changed
      const chineseChanged = originalChinese.trim() !== currentChinese.trim();
      const translationChanged = originalTranslation.trim() !== currentTranslation.trim();

      if (chineseChanged || translationChanged) {
        return "modified";
      }
    }

    return null;
  };

  if (isLoading) {
    return (
      <ReviewCard>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 300,
          }}
        >
          <CircularProgress />
        </Box>
      </ReviewCard>
    );
  }

  // REMOVED: Fallback display mechanism that prevented proper session initialization
  // The session should be properly initialized instead of showing fallback data
  
  // Check for session data availability
  const hasSessionData = session?.currentSubtitles?.length > 0;
  const hasConfigData = config?.subtitle?.length > 0;
  const isJsonImport = config?.importedJsonFile || config?.isImportedFromJson;
  
  // REMOVED: Fallback display logic - this was preventing proper session initialization
  // If we have config data but no session, the session initialization should handle it
  if (!hasSessionData && hasConfigData && isJsonImport) {
    console.log('🔄 DEBUG: Config data available but no session - session initialization should handle this');
    // Let the session initialization handle this case instead of showing fallback
  }

  if (!session) {
    return (
      <ReviewCard>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Generated Subtitles
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Subtitle session is initializing...
        </Alert>
        <Alert severity="info">
          <Typography variant="body2" sx={{ mb: 1 }}>
            {isJsonImport && hasConfigData ? 
              'JSON import detected - session is being initialized with imported data.' :
              hasConfigData ?
              'Subtitle data found - session is being initialized.' :
              'No subtitle data available yet. Complete Step 3 to generate subtitles.'}
          </Typography>
          <Typography variant="body2">
            <strong>Status:</strong>
            <br />• Workspace ID: {currentWorkspaceId || 'Not set'}
            <br />• Has config data: {hasConfigData ? `Yes (${config?.subtitle?.length || 0} subtitles)` : 'No'}
            <br />• JSON import: {isJsonImport ? 'Yes' : 'No'}
            <br />• Session loading: {isLoading ? 'Yes' : 'No'}
            {!currentWorkspaceId && (
              <>
                <br /><br /><strong>Action needed:</strong> Please select a video file in Step 1 to initialize workspace.
              </>
            )}
          </Typography>
        </Alert>
      </ReviewCard>
    );
  }

  return (
    <ReviewCard
      sx={{
        height: "100%", // Use available height from parent container
        maxHeight: "100%", // Allow parent container to control height
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6">Generated Subtitles</Typography>
          <Chip label={session.currentSubtitles?.length || 0} size="small" />
          {session.isDirty && (
            <Chip label="Modified" size="small" color="warning" />
          )}
          {/* Show available gaps only (gaps that are large enough for adding subtitles) */}
          {(() => {
            const availableGaps = Array.from(gapStates.values()).filter(gap => gap.isEnabled).length;
            return availableGaps > 0 ? (
              <Chip
                label={`${availableGaps} gap${availableGaps > 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ 
                  fontSize: "0.65rem",
                  backgroundColor: "rgba(87, 242, 135, 0.1)",
                  borderColor: "rgba(87, 242, 135, 0.3)",
                  color: "#57F287"
                }}
              />
            ) : null;
          })()}
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title={showDiff ? "Hide diff view" : "Show diff view (loads original data)"}>
            <IconButton 
              size="small" 
              onClick={() => {
                const newShowDiff = !showDiff;
                setShowDiff(newShowDiff);
                // Load original data when diff view is enabled (only if we don't have it yet)
                if (newShowDiff && session?.workspaceId && session?.sessionId && originalSubtitlesFromDB.length === 0 && !isLoadingOriginalData) {
                  loadOriginalDataForDiff();
                }
              }}
              disabled={isLoadingOriginalData}
            >
              <HideIcon color={showDiff ? "primary" : "inherit"} />
            </IconButton>
          </Tooltip>
          {showDiff && originalSubtitlesFromDB.length > 0 && (
            <Chip
              label={`${originalSubtitlesFromDB.length} original`}
              size="small"
              variant="outlined"
              sx={{ 
                fontSize: "0.65rem",
                backgroundColor: "rgba(29, 185, 84, 0.1)",
                borderColor: "rgba(29, 185, 84, 0.3)",
                color: "#1DB954"
              }}
            />
          )}
          {isLoadingOriginalData && (
            <CircularProgress size={16} sx={{ ml: 1 }} />
          )}
        </Box>
      </Box>

      <Box
        ref={listContainerRef}
        sx={{
          flex: "1 1 0",
          overflow: "auto",
          mb: 2,
          minHeight: 0,
        }}
      >
        <List dense>
          {(session.currentSubtitles || []).map((subtitle, index) => {
            const isSelected = session.selectedSubtitleId === subtitle.id;
            const isCurrentlyPlaying = currentSubtitle?.id === subtitle.id;
            const modificationType = getModificationType(subtitle);
            const modification = getModificationForSubtitle(subtitle.id);
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
                          height: isGapHovered ? "40px" : "8px", // Expand when hovered
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          backgroundColor: "transparent",
                          borderTop: "1px solid rgba(0, 0, 0, 0.06)",
                          borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
                          transition: "height 0.2s ease", // Smooth height transition
                          "&:hover": {
                            backgroundColor: "rgba(0, 0, 0, 0.02)",
                            cursor: isEnabled ? "pointer" : "not-allowed",
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
                                ? `Add subtitle in ${gapDuration.toFixed(
                                    2
                                  )}s gap`
                                : `Gap too small (${gapDuration.toFixed(
                                    2
                                  )}s) - need ≥1.0s`
                            }
                          >
                            <Box
                              className="add-button"
                              sx={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                backgroundColor: isEnabled
                                  ? "rgba(245, 158, 11, 0.1)" // Enabled: amber
                                  : "rgba(128, 128, 128, 0.1)", // Disabled: gray
                                border: isEnabled
                                  ? "2px dashed #F59E0B" // Enabled: amber dashed
                                  : "2px dashed #666", // Disabled: gray dashed
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: isEnabled ? "pointer" : "not-allowed",
                                transition: "all 0.2s ease",
                                opacity: isEnabled ? 0.8 : 0.4,
                                "&:hover": isEnabled
                                  ? {
                                      opacity: 1,
                                      backgroundColor:
                                        "rgba(245, 158, 11, 0.15)",
                                      borderColor: "#D97706",
                                      transform: "scale(1.1)",
                                    }
                                  : {},
                              }}
                            >
                              <AddIcon
                                sx={{
                                  fontSize: "16px",
                                  color: isEnabled ? "#F59E0B" : "#666",
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
                  sx={{ position: "relative" }}
                  onMouseEnter={() => setHoveredSubtitleId(subtitle.id)}
                  onMouseLeave={() => setHoveredSubtitleId(null)}
                >
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => handleSubtitleClick(subtitle)}
                    sx={{
                      border: 1,
                      borderColor: isCurrentlyPlaying
                        ? "#57F287"
                        : isSelected
                        ? "primary.main"
                        : "divider",
                      borderRadius: 2,
                      mb: 1,
                      p: 2,
                      position: "relative",
                      backgroundColor: isCurrentlyPlaying
                        ? "rgba(87, 242, 135, 0.1)"
                        : "transparent",
                      "&.Mui-selected": {
                        backgroundColor: isCurrentlyPlaying
                          ? "rgba(87, 242, 135, 0.15)"
                          : "rgba(245, 158, 11, 0.1)",
                        borderColor: isCurrentlyPlaying ? "#57F287" : "#F59E0B",
                      },
                      "&:hover": {
                        backgroundColor: isCurrentlyPlaying
                          ? "rgba(87, 242, 135, 0.15)"
                          : "rgba(245, 158, 11, 0.05)",
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box>
                          <Box
                            sx={{
                              display: "flex",
                              gap: 1,
                              mb: 1,
                              alignItems: "center",
                            }}
                          >
                            <Chip
                              label={formatTime(subtitle.startTime)}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                              }}
                            />
                            {subtitle.confidence !== undefined &&
                              subtitle.confidence > 0 && (
                                <Chip
                                  label={`${subtitle.confidence}%`}
                                  size="small"
                                  color={
                                    subtitle.confidence > 90
                                      ? "success"
                                      : subtitle.confidence > 80
                                      ? "warning"
                                      : "error"
                                  }
                                />
                              )}
                            {modificationType && (
                              <ModificationChip
                                modificationType={modificationType}
                                label={modificationType}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {isCurrentlyPlaying && (
                              <Chip
                                label="PLAYING"
                                size="small"
                                sx={{
                                  backgroundColor: "#57F287",
                                  color: "#000",
                                  fontWeight: 600,
                                  fontSize: "0.65rem",
                                  animation: "pulse 2s infinite",
                                }}
                                icon={
                                  <PlayIcon
                                    sx={{
                                      fontSize: "12px !important",
                                      color: "#000 !important",
                                    }}
                                  />
                                }
                              />
                            )}
                          </Box>

                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              mb: 0.5,
                              lineHeight: 1.4,
                              whiteSpace: "pre-line",
                            }}
                          >
                            {subtitle.text}
                          </Typography>

                          {/* Display translation text if available */}
                          {subtitle.translation && 
                           subtitle.translation.trim() && 
                           subtitle.translation !== subtitle.text && (
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 400,
                                mb: 0.5,
                                lineHeight: 1.4,
                                whiteSpace: "pre-line",
                                color: "text.secondary",
                                fontStyle: "italic",
                                fontSize: "0.9em",
                              }}
                            >
                              {subtitle.translation}
                            </Typography>
                          )}

                          {modificationType === "modified" && showDiff && (() => {
                            // NEW: Use IndexedDB original data if available, fallback to modification records
                            const originalSubtitle = getOriginalSubtitleFromDB(subtitle);
                            let originalChinese = '';
                            let originalTranslation = '';
                            
                            if (originalSubtitle) {
                              // Use IndexedDB original data
                              originalChinese = originalSubtitle.text || '';
                              originalTranslation = originalSubtitle.translation || '';
                            } else {
                              // Fallback to modification records
                              const modification = getModificationForSubtitle(subtitle.id);
                              if (!modification || !modification.original) return null;
                              originalChinese = modification.original.text || '';
                              originalTranslation = modification.original.translation || '';
                            }

                            const currentChinese = subtitle.text || '';
                            const currentTranslation = subtitle.translation || '';

                            const chineseChanged = originalChinese.trim() !== currentChinese.trim();
                            const translationChanged = originalTranslation.trim() !== currentTranslation.trim();

                            if (!chineseChanged && !translationChanged) return null;

                            const renderDiffParts = (parts: any[]) => parts.map((part, index) => (
                              <Typography
                                key={index}
                                component="span"
                                sx={{
                                  backgroundColor:
                                    part.type === "added"
                                      ? "rgba(87, 242, 135, 0.2)"
                                      : part.type === "removed"
                                      ? "rgba(237, 66, 69, 0.2)"
                                      : "transparent",
                                  color:
                                    part.type === "added"
                                      ? "#57F287"
                                      : part.type === "removed"
                                      ? "#ED4245"
                                      : "inherit",
                                  textDecoration:
                                    part.type === "removed"
                                      ? "line-through"
                                      : "none",
                                  padding:
                                    part.type !== "unchanged"
                                      ? "1px 2px"
                                      : "0",
                                  borderRadius: "2px",
                                  whiteSpace: "pre-wrap",
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
                                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                                  borderRadius: 1,
                                  border: "1px solid rgba(64, 68, 75, 0.3)",
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ mb: 0.5, display: "block" }}
                                >
                                  Changes:
                                </Typography>
                                
                                {/* Chinese text changes */}
                                {chineseChanged && (
                                  <Box sx={{ mb: translationChanged ? 1 : 0 }}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ fontSize: "0.7rem", display: "block", mb: 0.25 }}
                                    >
                                      Chinese:
                                    </Typography>
                                    <Box sx={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
                                      {renderDiffParts(generateCharacterDiff(originalChinese, currentChinese))}
                                    </Box>
                                  </Box>
                                )}

                                {/* Translation changes */}
                                {translationChanged && (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ fontSize: "0.7rem", display: "block", mb: 0.25 }}
                                    >
                                      Translation:
                                    </Typography>
                                    <Box sx={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
                                      {renderDiffParts(generateCharacterDiff(originalTranslation, currentTranslation))}
                                    </Box>
                                  </Box>
                                )}
                                
                                {/* Data source indicator */}
                                <Box sx={{ mt: 1, pt: 1, borderTop: "1px solid rgba(64, 68, 75, 0.2)" }}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontSize: "0.65rem", display: "flex", alignItems: "center", gap: 0.5 }}
                                  >
                                    {originalSubtitle ? (
                                      <>
                                        <Box 
                                          sx={{ 
                                            width: 6, 
                                            height: 6, 
                                            borderRadius: "50%", 
                                            backgroundColor: "#1DB954" 
                                          }} 
                                        />
                                        Compared with IndexedDB original
                                      </>
                                    ) : (
                                      <>
                                        <Box 
                                          sx={{ 
                                            width: 6, 
                                            height: 6, 
                                            borderRadius: "50%", 
                                            backgroundColor: "#F59E0B" 
                                          }} 
                                        />
                                        Compared with modification record
                                      </>
                                    )}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })()}

                          {modification && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ mt: 0.5, display: "block" }}
                            >
                              {modification.description} •{" "}
                              {new Date(
                                modification.changeTimestamp
                              ).toLocaleTimeString()}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>

                  {/* Hover action buttons */}
                  {isHovered && (
                    <Box
                      sx={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        display: "flex",
                        gap: 1,
                        backgroundColor: "rgba(47, 49, 54, 0.95)",
                        borderRadius: 1,
                        padding: "4px",
                        border: "1px solid rgba(64, 68, 75, 0.5)",
                        zIndex: 2,
                      }}
                    >
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(subtitle.id);
                          }}
                          sx={{
                            color: "#F59E0B",
                            "&:hover": {
                              backgroundColor: "rgba(245, 158, 11, 0.1)",
                            },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(subtitle.id);
                          }}
                          disabled={isSaving}
                          sx={{
                            color: "#ED4245",
                            "&:hover": {
                              backgroundColor: "rgba(237, 66, 69, 0.1)",
                            },
                            "&:disabled": {
                              color: "rgba(237, 66, 69, 0.3)",
                            },
                          }}
                        >
                          {isSaving ? (
                            <CircularProgress size={16} sx={{ color: "#ED4245" }} />
                          ) : (
                            <DeleteIcon fontSize="small" />
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
          mt: "auto", // Push to bottom
        }}
      >
        <ActionButton
          startIcon={<AddIcon />}
          size="medium"
          fullWidth
          onClick={handleAddNew}
          disabled={!hasSpaceAtEnd()}
          sx={{
            py: 1.5,
            fontWeight: 600,
            backgroundColor: "rgba(245, 158, 11, 0.1)", // Transparent amber background
            border: "2px dashed #F59E0B", // Dotted amber border
            color: "#F59E0B", // Amber text color
            "&:hover": {
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              borderColor: "#D97706",
            },
            "&:disabled": {
              backgroundColor: "rgba(128, 128, 128, 0.1)",
              borderColor: "#666",
              color: "#666",
            },
          }}
        >
          Add New Subtitle
        </ActionButton>
      </Box>
    </ReviewCard>
  );
};
