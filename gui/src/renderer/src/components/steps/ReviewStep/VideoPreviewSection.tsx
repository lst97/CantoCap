import React, { useState, useEffect, useRef } from "react";
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
import { 
  useVideoState,
  useSelectedSubtitle,
  useSubtitleActions 
} from "../../../stores/useSubtitleEditStore";
import { useInputFile, useSubtitles } from "../../../stores/useStepStore";
import { Subtitle } from "../../../stores/types/StoreTypes";
import { ActionButton } from "./styles";
import { formatTime } from "./utils";
import { ElectronWindow } from "../../../../../types";

// Supported video formats in typical browsers/Electron
const SUPPORTED_VIDEO_FORMATS = [
  { ext: 'mp4', mimeType: 'video/mp4', codecs: ['avc1', 'mp4v', 'h264'] },
  { ext: 'webm', mimeType: 'video/webm', codecs: ['vp8', 'vp9'] },
  { ext: 'ogg', mimeType: 'video/ogg', codecs: ['theora'] },
  { ext: 'avi', mimeType: 'video/x-msvideo', codecs: [] },
  { ext: 'mov', mimeType: 'video/quicktime', codecs: [] },
  { ext: 'mkv', mimeType: 'video/x-matroska', codecs: [] }
];

const validateVideoFile = (filePath: string) => {
  if (!filePath) return { isValid: false, reason: 'No file path provided' };
  
  const ext = filePath.split('.').pop()?.toLowerCase();
  const supportedFormat = SUPPORTED_VIDEO_FORMATS.find(f => f.ext === ext);
  
  if (!supportedFormat) {
    return { 
      isValid: false, 
      reason: `Unsupported format: .${ext}. Supported: ${SUPPORTED_VIDEO_FORMATS.map(f => f.ext).join(', ')}` 
    };
  }
  
  return { isValid: true, format: supportedFormat };
};

export const VideoPreviewSection: React.FC = () => {
  const subtitles = useSubtitles();
  const selectedSubtitle = useSelectedSubtitle();
  const { currentTime, isVideoPlaying, videoPath } = useVideoState();
  const { setCurrentTime, setVideoPlaying, jumpToSubtitle, setVideoDuration } = useSubtitleActions();
  const inputFile = useInputFile();
  const [duration, setDuration] = useState(0);
  const lastUpdateRef = useRef<number>(0);
  const [isJumpTriggered, setIsJumpTriggered] = useState(false);

  // Video path resolution - prioritize inputFile from Step 1, fallback to videoPath from subtitle store
  const rawVideoPath = inputFile || videoPath || '';
  const [videoDataUrl, setVideoDataUrl] = React.useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = React.useState(false);
  
  // Convert local file path to data URL for secure playback (same as Step 1)
  React.useEffect(() => {
    const convertVideoSource = async () => {
      if (!rawVideoPath) {
        setVideoDataUrl(null);
        setIsLoadingVideo(false);
        return;
      }

      // Check if it's already a data URL or web URL
      if (rawVideoPath.startsWith('data:') || rawVideoPath.startsWith('http://') || rawVideoPath.startsWith('https://')) {
        setVideoDataUrl(rawVideoPath);
        setIsLoadingVideo(false);
        return;
      }

      // Convert local file path to data URL
      setIsLoadingVideo(true);
      try {
        const dataUrl = await (window as unknown as ElectronWindow).cantocapAPI.getVideoDataUrl(rawVideoPath);
        setVideoDataUrl(dataUrl);
        console.log('🎬 VideoPreviewSection: Successfully converted to data URL');
      } catch (error) {
        console.error('🎬 VideoPreviewSection: Failed to convert video to data URL:', error);
        setVideoDataUrl(null);
      } finally {
        setIsLoadingVideo(false);
      }
    };

    convertVideoSource();
  }, [rawVideoPath]);
  
  // Enhanced debug logging for video source resolution
  React.useEffect(() => {
    const validation = validateVideoFile(rawVideoPath);
    
    console.log('🎬 VideoPreviewSection video source:', {
      inputFile,
      videoPath,
      rawVideoPath,
      videoDataUrl: videoDataUrl ? 'data URL created' : 'no data URL',
      isLoadingVideo,
      usingInputFile: !!inputFile,
      isEmpty: !rawVideoPath,
      validation
    });
    
    if (!validation.isValid && rawVideoPath) {
      console.warn('🎬 Video format issue:', validation.reason);
    }
  }, [inputFile, videoPath, rawVideoPath, videoDataUrl, isLoadingVideo]);

  // Use data URL for video source
  const resolvedVideoPath = videoDataUrl;
  
  const isPlaying = isVideoPlaying;

  const handleTimeUpdate = (time: number) => {
    // Throttle time updates to improve performance (update every ~100ms)
    const now = Date.now();
    if (now - lastUpdateRef.current < 100) return;
    lastUpdateRef.current = now;

    setCurrentTime(time);
  };

  const handleLoadedMetadata = (dur: number) => {
    setDuration(dur);
    setVideoDuration(dur);
  };

  // Sync video player time when store currentTime changes (for jumpToSubtitle)
  useEffect(() => {
    // This ensures the video player receives the updated currentTime from store
    // particularly important when jumpToSubtitle updates the store time
  }, [currentTime]);

  const jumpToSelected = () => {
    if (selectedSubtitle?.id) {
      setIsJumpTriggered(true);
      jumpToSubtitle(selectedSubtitle.id);
      
      // Reset the trigger flag after the subtitle duration plus some buffer time
      // This ensures the video player has enough time to detect the boundary
      const subtitleDuration = selectedSubtitle.endTime - selectedSubtitle.startTime;
      setTimeout(() => {
        setIsJumpTriggered(false);
      }, subtitleDuration * 1000 + 2000); // subtitle duration + 2 second buffer
    }
  };

  const getCurrentSubtitle = (): Subtitle | null => {
    if (!subtitles || !Array.isArray(subtitles)) return null;

    return (
      subtitles.find(
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
      {isLoadingVideo ? (
        <Box
          sx={{
            height: "calc(100% - 190px)", // Same height as video player
            width: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            borderRadius: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            mb: 1,
            flexShrink: 0,
            gap: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Loading video...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Converting video for secure playback
          </Typography>
        </Box>
      ) : resolvedVideoPath ? (
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
              selectedSubtitle={selectedSubtitle ? {
                id: selectedSubtitle.id,
                startTime: selectedSubtitle.startTime,
                endTime: selectedSubtitle.endTime,
              } : undefined}
              autoReturnToStart={true}
              isJumpTriggered={isJumpTriggered}
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
          disabled={!resolvedVideoPath}
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
          disabled={!selectedSubtitle}
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

            {/* Centered subtitle text with caption and translation */}
            <Box sx={{ pt: 1 }}>
              {/* Main caption text */}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  lineHeight: 1.3,
                  color: "white",
                  textAlign: "center",
                  whiteSpace: "pre-line",
                  mb: currentSubtitle.translation && currentSubtitle.translation.trim() && 
                      currentSubtitle.translation !== currentSubtitle.text ? 0.5 : 0,
                }}
              >
                {currentSubtitle.text}
              </Typography>

              {/* Translation text if available and different from caption */}
              {currentSubtitle.translation && 
               currentSubtitle.translation.trim() && 
               currentSubtitle.translation !== currentSubtitle.text && (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 400,
                    fontSize: "0.9rem",
                    lineHeight: 1.3,
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