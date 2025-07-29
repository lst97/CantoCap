import React, { useEffect } from "react";
import { Box } from "@mui/material";
import { useAppStore } from "../../store/app-store";
import { useSubtitleEditStore } from "../../stores/subtitle-edit-store";
import { VideoPreviewSection } from "./ReviewStep/VideoPreviewSection";
import { SubtitleEditor } from "./ReviewStep/SubtitleEditor";
import { SubtitleListPanel } from "./ReviewStep/SubtitleListPanel";
import { pulseKeyframes } from "./ReviewStep/styles";

export const ReviewStep: React.FC = () => {
  const { config } = useAppStore();
  const { initializeSession, clearSession, session, isLoading } = useSubtitleEditStore();

  // Inject CSS animation
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = pulseKeyframes;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Initialize session when component mounts and SRT is available
  useEffect(() => {
    const initializeEditingSession = async () => {
      // Check if we have both input and output files
      if (config.inputFile && config.outputFile && !isLoading) {
        try {
          // Use the actual SRT output path from Step 3 processing
          const srtPath = config.outputFile.replace(/\.[^/.]+$/, ".srt");
          const videoPath = config.inputFile;

          // Check if we need to reinitialize with new files
          const needsReinit = !session || 
            (session && (session.videoPath !== videoPath || session.originalPath !== srtPath));

          if (needsReinit) {
            console.log("🔄 Files changed, reinitializing subtitle editing session:", {
              previousVideoPath: session?.videoPath,
              newVideoPath: videoPath,
              previousSrtPath: session?.originalPath,
              newSrtPath: srtPath,
            });

            // Clear existing session if it exists
            if (session) {
              clearSession();
            }

            // Initialize with new files
            await initializeSession(srtPath, videoPath);
          } else {
            console.log("✅ Session already initialized with current files");
          }
        } catch (error) {
          console.error(
            "Failed to initialize subtitle editing session:",
            error
          );
        }
      }
    };

    initializeEditingSession();
  }, [
    config.outputFile,
    config.inputFile,
    session?.videoPath,
    session?.originalPath,
    isLoading,
    initializeSession,
    clearSession,
  ]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Video Preview Section - increased to ~50% of height */}
      <Box
        sx={{
          flex: "0 0 40%",
          minHeight: "380px", // Increased for better video viewing
          p: 2,
          borderBottom: "1px solid rgba(64, 68, 75, 0.3)",
          backgroundColor: "#202225",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        <VideoPreviewSection />
      </Box>

      {/* Two-column layout - drastically reduced to ~50% for button visibility */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
          flex: "1 1 60%", // Drastically reduced to ensure Add button is fully visible
          maxHeight: "60vh", // Much smaller height to prevent overflow
          overflow: "hidden",
          p: 2,
          position: "relative",
          zIndex: 0,
        }}
      >
        {/* Left Column - Generated Subtitles with Diff */}
        <Box
          sx={{
            minHeight: 0,
            maxHeight: "90%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <SubtitleListPanel />
        </Box>

        {/* Right Column - Edit Panel */}
        <Box
          sx={{
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <SubtitleEditor />
        </Box>
      </Box>
    </Box>
  );
};