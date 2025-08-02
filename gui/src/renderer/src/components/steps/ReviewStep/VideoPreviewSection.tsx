import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Chip,
} from "@mui/material";
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
} from "@mui/icons-material";
import { BasicVideoPlayer } from "../../VideoPlayer/BasicVideoPlayer";
import { useSubtitleEditStore } from "../../../stores/subtitle-edit-store";
import { useAppStore } from "../../../stores/app-store";
import { SubtitleEntry } from "../../../types/subtitle";
import { ActionButton } from "./styles";
import { formatTime } from "./utils";
import { VideoPreviewSectionProps } from "./types";

export const VideoPreviewSection: React.FC<VideoPreviewSectionProps> = () => {
  const {
    session,
    setCurrentTime,
    setVideoPlaying,
    jumpToSubtitle,
    setVideoDuration,
  } = useSubtitleEditStore();
  const { config } = useAppStore();
  const [duration, setDuration] = useState(0);

  // Video path resolution with fallback logic
  const resolvedVideoPath = session?.videoPath || config.inputFile || '';
  
  // Debug logging for video path resolution
  useEffect(() => {
    console.log('🎬 DEBUG: VideoPreviewSection video path resolution:', {
      'session.videoPath': session?.videoPath,
      'config.inputFile': config.inputFile,
      'resolvedVideoPath': resolvedVideoPath,
      'fallbackUsed': !session?.videoPath && !!config.inputFile,
      'hasSession': !!session,
      'timestamp': new Date().toISOString()
    });
  }, [session?.videoPath, config.inputFile, resolvedVideoPath]);

  const isPlaying = session?.isVideoPlaying || false;
  const shouldAutoPause = session?.shouldAutoPause || false;
  const currentTime = session?.currentTime || 0;

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);

    // Auto-pause when subtitle selection ends
    if (shouldAutoPause && session?.selectedSubtitleId && session.currentSubtitles && Array.isArray(session.currentSubtitles)) {
      const selectedSubtitle = session.currentSubtitles.find(
        (s) => s.id === session.selectedSubtitleId
      );
      if (selectedSubtitle && time >= selectedSubtitle.endTime) {
        setVideoPlaying(false);
        // Disable auto-pause after it triggers
        if (session && useSubtitleEditStore.getState().session) {
          useSubtitleEditStore.setState((state) => ({
            ...state,
            session: state.session
              ? {
                  ...state.session,
                  shouldAutoPause: false,
                }
              : null,
          }));
        }
      }
    }
  };

  const handleLoadedMetadata = (dur: number) => {
    setDuration(dur);
    setVideoDuration(dur); // Store in the session for other components to access
  };

  // Sync video player time when store currentTime changes (for jumpToSubtitle)
  useEffect(() => {
    // This ensures the video player receives the updated currentTime from store
    // particularly important when jumpToSubtitle updates the store time
  }, [session?.currentTime]);

  const jumpToSelected = () => {
    if (session?.selectedSubtitleId) {
      jumpToSubtitle(session.selectedSubtitleId);
    }
  };

  const getCurrentSubtitle = (): SubtitleEntry | null => {
    if (!session || !session.currentSubtitles || !Array.isArray(session.currentSubtitles)) return null;

    return (
      session.currentSubtitles.find(
        (subtitle) =>
          currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
      ) || null
    );
  };

  const currentSubtitle = getCurrentSubtitle();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Compact header */}
      <Typography
        variant="h6"
        sx={{
          mb: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: "white",
          fontSize: "1.1rem",
        }}
      >
        <VolumeIcon color="primary" />
        Video Preview
      </Typography>

      {/* Video player - fixed height to prevent subtitle expansion from affecting it */}
      {(session || resolvedVideoPath) ? (
        <Box
          sx={{
            height: "calc(100% - 190px)", // Adjusted height: total minus header(40px), controls(40px), and subtitle preview(110px)
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 1,
            flexShrink: 0, // Prevent shrinking
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: "100%",
              maxWidth: "100%",
              maxHeight: "100%",
              position: "relative",
            }}
          >
            <BasicVideoPlayer
              src={resolvedVideoPath}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              isPlaying={isPlaying}
              onPlay={() => setVideoPlaying(true)}
              onPause={() => setVideoPlaying(false)}
            />
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            height: "calc(100% - 190px)", // Same adjusted height as video player
            width: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 1,
            flexShrink: 0, // Prevent shrinking
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No video loaded
          </Typography>
        </Box>
      )}

      {/* Compact video controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <IconButton
          color="primary"
          size="small"
          onClick={() => setVideoPlaying(!isPlaying)}
          disabled={!session && !resolvedVideoPath}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontFamily: "monospace",
            color: "white",
            fontSize: "0.8rem",
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
        <ActionButton
          size="small"
          onClick={jumpToSelected}
          disabled={!session?.selectedSubtitleId}
          sx={{ fontSize: "0.75rem", py: 0.5, px: 1 }}
        >
          Jump to Selected
        </ActionButton>
      </Box>

      {/* Fixed height subtitle display for 3 lines */}
      <Paper
        sx={{
          p: 2,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          borderRadius: 1,
          textAlign: "center",
          height: "110px", // Increased height for better text display and timestamp
          flexShrink: 0, // Don't shrink this container
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden", // Hide overflow if text is too long
          position: "relative", // For timestamp positioning
        }}
      >
        {currentSubtitle ? (
          <>
            {/* Timestamp in top-left fixed position */}
            <Box
              sx={{
                position: "absolute",
                top: 8,
                left: 8,
                display: "flex",
                alignItems: "center",
                gap: 1,
                zIndex: 1,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ 
                  fontSize: "0.7rem",
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                }}
              >
                {formatTime(currentSubtitle.startTime)} → {formatTime(currentSubtitle.endTime)}
              </Typography>
              {currentSubtitle.confidence && (
                <Chip
                  label={`${currentSubtitle.confidence}%`}
                  size="small"
                  color={
                    currentSubtitle.confidence > 90
                      ? "success"
                      : currentSubtitle.confidence > 80
                      ? "warning"
                      : "error"
                  }
                  sx={{ height: "18px", fontSize: "0.6rem" }}
                />
              )}
            </Box>

            {/* Centered subtitle text */}
            <Box sx={{ pt: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  lineHeight: 1.3,
                  color: "white",
                  textAlign: "center",
                  whiteSpace: "pre-line",
                  mb: currentSubtitle.translation && currentSubtitle.translation.trim() && currentSubtitle.translation !== currentSubtitle.text ? 0.5 : 0,
                }}
              >
                {currentSubtitle.text}
              </Typography>
              
              {/* Display translation if available */}
              {currentSubtitle.translation && 
               currentSubtitle.translation.trim() && 
               currentSubtitle.translation !== currentSubtitle.text && (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 400,
                    fontSize: "0.9rem",
                    lineHeight: 1.2,
                    color: "rgba(255, 255, 255, 0.8)",
                    textAlign: "center",
                    whiteSpace: "pre-line",
                    fontStyle: "italic",
                  }}
                >
                  {currentSubtitle.translation}
                </Typography>
              )}
            </Box>
          </>
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontStyle: "italic", fontSize: "0.75rem" }}
          >
            No subtitle at current time
          </Typography>
        )}
      </Paper>
    </Box>
  );
};