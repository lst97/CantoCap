import React, { useEffect, useCallback, useRef } from "react";
import { Box } from "@mui/material";
import { useAppStore } from "../../store/app-store";
import { useSubtitleEditStore } from "../../stores/subtitle-edit-store";
import { VideoPreviewSection } from "./ReviewStep/VideoPreviewSection";
import { SubtitleEditor } from "./ReviewStep/SubtitleEditor";
import { SubtitleListPanel } from "./ReviewStep/SubtitleListPanel";
import { ReviewStepErrorBoundary } from "./ReviewStep/ReviewStepErrorBoundary";
import { pulseKeyframes } from "./ReviewStep/styles";
import { PerformanceMonitor, debounce } from "../../utils/performance-utils";

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

  // Create stable reference to prevent infinite re-renders
  const lastInitDataRef = useRef<{
    inputFile: string | null;
    outputFile: string | null;
    subtitleCount: number;
    videoPath: string | null;
    originalPath: string | null;
  }>({
    inputFile: null,
    outputFile: null,
    subtitleCount: 0,
    videoPath: null,
    originalPath: null,
  });

  // Performance monitor instance
  const performanceMonitor = PerformanceMonitor.getInstance();

  // Stable initialization function with useCallback and performance monitoring
  const stableInitializeSession = useCallback(async (subtitlePath: string, videoPath: string, importedData?: any[]) => {
    const operationName = importedData ? 'JSON Import Session Init' : 'SRT Session Init';
    performanceMonitor.startOperation(operationName);
    
    try {
      console.log("🔄 Initializing subtitle editing session:", {
        subtitlePath,
        videoPath,
        hasImportedData: !!importedData,
        dataCount: importedData?.length || 0
      });

      // Clear existing session first to prevent conflicts
      clearSession();

      if (importedData) {
        // For imported JSON data, pass data directly to store
        await initializeSession(subtitlePath, videoPath, importedData);
      } else {
        // For regular SRT files
        await initializeSession(subtitlePath, videoPath);
      }
      
      performanceMonitor.endOperation(operationName, importedData?.length);
    } catch (error) {
      console.error("Failed to initialize subtitle editing session:", error);
      performanceMonitor.endOperation(`${operationName} (ERROR)`, importedData?.length);
    }
  }, [initializeSession, clearSession, performanceMonitor]);

  // Initialize session when component mounts and data is available
  useEffect(() => {
    if (isLoading) return; // Don't initialize while loading

    const currentData = {
      inputFile: config.inputFile,
      outputFile: config.outputFile,
      subtitleCount: Array.isArray(config.subtitle) ? config.subtitle.length : 0,
      videoPath: session?.videoPath || null,
      originalPath: session?.originalPath || null,
    };

    // Check if data has actually changed to prevent unnecessary re-initialization
    const dataChanged = 
      lastInitDataRef.current.inputFile !== currentData.inputFile ||
      lastInitDataRef.current.outputFile !== currentData.outputFile ||
      lastInitDataRef.current.subtitleCount !== currentData.subtitleCount ||
      lastInitDataRef.current.videoPath !== currentData.videoPath ||
      lastInitDataRef.current.originalPath !== currentData.originalPath;

    if (!dataChanged) {
      return; // No change, skip initialization
    }

    // Update reference for future comparisons
    lastInitDataRef.current = currentData;

    // Initialize based on available data
    if (config.inputFile && Array.isArray(config.subtitle) && config.subtitle.length > 0) {
      // JSON subtitles imported - convert format and initialize
      const subtitleEntries = config.subtitle.map((sub, index) => {
        // Extract Chinese text and translation separately
        // Handle both old format (text/translation) and new format (caption/translation)
        const chineseText = sub.caption || sub.text || '';
        const translationText = sub.translation || '';
        
        return {
          id: `imported-${sub.id || index + 1}`,
          index: sub.id || index + 1,
          startTime: sub.startTime,
          endTime: sub.endTime,
          duration: sub.endTime - sub.startTime,
          text: chineseText, // Chinese text only
          originalText: translationText, // Translation text only
          confidence: sub.confidence || undefined,
          speaker: sub.speaker || undefined,
          isMusic: sub.isMusic || false
        };
      });

      stableInitializeSession('imported-subtitles.json', config.inputFile, subtitleEntries);
    } else if (config.inputFile && config.outputFile) {
      // Regular SRT file from processing
      const srtPath = config.outputFile.replace(/\.[^/.]+$/, ".srt");
      stableInitializeSession(srtPath, config.inputFile);
    }
  }, [
    config.inputFile,
    config.outputFile,
    config.subtitle?.length, // Only track length, not the entire array
    isLoading,
    stableInitializeSession
  ]);

  return (
    <ReviewStepErrorBoundary>
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
    </ReviewStepErrorBoundary>
  );
};