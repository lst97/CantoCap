import React from "react";
import {
  Box,
  Typography,
  Stack,
  Chip,
} from "@mui/material";
import {
  CheckCircle as CheckIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  AccessTime as TimeIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  MovieCreation as VideoIcon,
  Language as LanguageIcon,
  Psychology as AiIcon,
  Speaker as SpeakerIcon,
  MusicNote as MusicIcon,
  Info as InfoIcon,
  Celebration as CelebrationIcon,
} from "@mui/icons-material";
import { 
  useProcessingStepContent,
  useConfigStepContent 
} from "../../../stores/useStepStore";
import { SuccessCard, InfoSection, CelebrationHeader } from "./styles";
import { formatTime } from "./utils";

export const ProcessingComplete: React.FC = () => {
  const processing = useProcessingStepContent();
  const config = useConfigStepContent();

  // Extract quality metrics from processing statistics
  const statistics = processing.statistics;
  const hasQualityMetrics = statistics?.quality_score !== undefined;
  const hasCoverageMetrics = statistics?.translation_coverage !== undefined;

  // Debug logging to check what statistics are being received
  console.log("ProcessingComplete Debug:");
  console.log("- processing.statistics:", statistics);
  console.log("- hasQualityMetrics:", hasQualityMetrics);
  console.log("- hasCoverageMetrics:", hasCoverageMetrics);
  if (statistics) {
    console.log("- quality_score:", statistics.quality_score);
    console.log("- quality_grade:", statistics.quality_grade);
    console.log("- translation_coverage:", statistics.translation_coverage);
  }

  return (
    <SuccessCard>
      <CelebrationHeader>
        <CelebrationIcon className="celebration-icon" />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: "#57F287",
            mb: 0.5,
            textShadow: "0px 2px 4px rgba(87, 242, 135, 0.2)",
          }}
        >
          Processing Complete!
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: "text.secondary",
            fontSize: "1.1rem",
          }}
        >
          Your subtitles have been generated successfully
        </Typography>
      </CelebrationHeader>

      <Stack spacing={3}>
        {/* File Information Section */}
        <InfoSection>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <VideoIcon sx={{ color: "#7DD3FC", fontSize: "1.5rem" }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#FFFFFF" }}>
              File Information
            </Typography>
          </Box>
          <Stack spacing={2}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box
                sx={{
                  minWidth: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "#57F287",
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                >
                  INPUT FILE
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 500, wordBreak: "break-all" }}
                >
                  {config.inputFile || "Unknown file"}
                </Typography>
              </Box>
            </Box>
            {config.outputFile && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    minWidth: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: "#22C55E",
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                  >
                    OUTPUT FILE
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 500, wordBreak: "break-all" }}
                  >
                    {config.outputFile}
                  </Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </InfoSection>

        {/* Performance Statistics */}
        <InfoSection>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <AnalyticsIcon sx={{ color: "#F59E0B", fontSize: "1.5rem" }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#FFFFFF" }}>
              Performance Statistics
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 2,
                borderRadius: 2,
                backgroundColor: "rgba(87, 242, 135, 0.1)",
                border: "1px solid rgba(87, 242, 135, 0.2)",
              }}
            >
              <TimeIcon sx={{ color: "#57F287", fontSize: "1.2rem" }} />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                >
                  TOTAL TIME
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, fontFamily: "monospace" }}
                >
                  {formatTime(processing.startTime && processing.endTime 
                    ? Math.floor((new Date(processing.endTime).getTime() - new Date(processing.startTime).getTime()) / 1000)
                    : processing.timeElapsed || 0)}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 2,
                borderRadius: 2,
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
              }}
            >
              <CheckIcon sx={{ color: "#22C55E", fontSize: "1.2rem" }} />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                >
                  COMPLETION
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {processing.progress}%
                </Typography>
              </Box>
            </Box>
            {processing.hardwareInfo?.gpuAcceleration && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: "rgba(125, 211, 252, 0.1)",
                  border: "1px solid rgba(125, 211, 252, 0.2)",
                }}
              >
                <MemoryIcon sx={{ color: "#7DD3FC", fontSize: "1.2rem" }} />
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                  >
                    GPU ACCELERATION
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 600, color: "#7DD3FC" }}
                  >
                    Enabled
                  </Typography>
                </Box>
              </Box>
            )}
            {processing.hardwareInfo?.memoryUsage && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: "rgba(168, 85, 247, 0.1)",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                }}
              >
                <SpeedIcon sx={{ color: "#A855F7", fontSize: "1.2rem" }} />
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                  >
                    PEAK MEMORY
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {processing.hardwareInfo.memoryUsage}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </InfoSection>

        {/* Quality & Translation Metrics */}
        {(hasQualityMetrics || hasCoverageMetrics) && (
          <InfoSection>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}
            >
              <AnalyticsIcon sx={{ color: "#22C55E", fontSize: "1.5rem" }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "#FFFFFF" }}
              >
                Quality & Translation Analysis
              </Typography>
            </Box>

            {hasQualityMetrics && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 2, color: "text.secondary", fontSize: "0.9rem" }}
                >
                  OVERALL QUALITY ASSESSMENT
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      border: "1px solid rgba(34, 197, 94, 0.2)",
                    }}
                  >
                    <CheckIcon sx={{ color: "#22C55E", fontSize: "1.2rem" }} />
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                      >
                        QUALITY GRADE
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: "#22C55E" }}
                      >
                        {statistics?.quality_grade || "N/A"}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "rgba(87, 242, 135, 0.1)",
                      border: "1px solid rgba(87, 242, 135, 0.2)",
                    }}
                  >
                    <SpeedIcon sx={{ color: "#57F287", fontSize: "1.2rem" }} />
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                      >
                        QUALITY SCORE
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {statistics?.quality_score
                          ? `${(statistics.quality_score * 100).toFixed(1)}%`
                          : "N/A"}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "rgba(125, 211, 252, 0.1)",
                      border: "1px solid rgba(125, 211, 252, 0.2)",
                    }}
                  >
                    <InfoIcon sx={{ color: "#7DD3FC", fontSize: "1.2rem" }} />
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                      >
                        CONFIDENCE
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {statistics?.quality_confidence
                          ? `${(statistics.quality_confidence * 100).toFixed(
                              0
                            )}%`
                          : "N/A"}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {statistics?.quality_breakdown && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        mb: 1.5,
                        color: "text.secondary",
                        fontSize: "0.8rem",
                      }}
                    >
                      QUALITY BREAKDOWN
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 1.5,
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#10B981",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Technical
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.quality_breakdown.technical * 100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#3B82F6",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Linguistic
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.quality_breakdown.linguistic * 100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#F59E0B",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Readability
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.quality_breakdown.readability * 100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#EC4899",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Translation
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.quality_breakdown.translation * 100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {hasCoverageMetrics && (
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 2, color: "text.secondary", fontSize: "0.9rem" }}
                >
                  TRANSLATION COVERAGE ANALYSIS
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "rgba(168, 85, 247, 0.1)",
                      border: "1px solid rgba(168, 85, 247, 0.2)",
                    }}
                  >
                    <LanguageIcon
                      sx={{ color: "#A855F7", fontSize: "1.2rem" }}
                    />
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                      >
                        COVERAGE
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {statistics?.translation_coverage
                          ? `${(statistics.translation_coverage * 100).toFixed(
                              1
                            )}%`
                          : "N/A"}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.2)",
                    }}
                  >
                    <InfoIcon sx={{ color: "#F59E0B", fontSize: "1.2rem" }} />
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                      >
                        CONFIDENCE
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {statistics?.coverage_confidence
                          ? `${(statistics.coverage_confidence * 100).toFixed(
                              0
                            )}%`
                          : "N/A"}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {statistics?.coverage_breakdown && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        mb: 1.5,
                        color: "text.secondary",
                        fontSize: "0.8rem",
                      }}
                    >
                      COVERAGE BREAKDOWN
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 1.5,
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#06B6D4",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Subtitle
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.coverage_breakdown.subtitle_coverage *
                              100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#8B5CF6",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Temporal
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.coverage_breakdown.temporal_coverage *
                              100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#10B981",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Content
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.coverage_breakdown.content_coverage *
                              100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#F59E0B",
                          }}
                        />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Quality
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(
                              statistics.coverage_breakdown
                                .translation_quality * 100
                            ).toFixed(0)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </InfoSection>
        )}

        {/* Configuration Details */}
        <InfoSection>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <SettingsIcon sx={{ color: "#EC4899", fontSize: "1.5rem" }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#FFFFFF" }}>
              Processing Configuration
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <LanguageIcon sx={{ color: "#F59E0B", fontSize: "1.1rem" }} />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                >
                  LANGUAGE
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {config.language === "zh"
                    ? "Chinese (Cantonese)"
                    : config.language}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <LanguageIcon sx={{ color: "#10B981", fontSize: "1.1rem" }} />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                >
                  CHARACTER SET
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {config.charset === "traditional"
                    ? "Traditional Chinese"
                    : "Simplified Chinese"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <SpeedIcon sx={{ color: "#EF4444", fontSize: "1.1rem" }} />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontSize: "0.8rem" }}
                >
                  PRIORITY
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {config.priority.charAt(0).toUpperCase() +
                    config.priority.slice(1)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Feature Chips */}
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontSize: "0.8rem", mb: 1.5 }}
            >
              PROCESSING FEATURES
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {/* Basic Features - Always show written style */}
              <Chip
                icon={<InfoIcon sx={{ fontSize: "1rem" }} />}
                label={`Written Style${config.geminiKey ? ' (Enhanced)' : ''}`}
                size="small"
                sx={{
                  backgroundColor: config.geminiKey 
                    ? "rgba(34, 197, 94, 0.2)" 
                    : "rgba(125, 211, 252, 0.2)",
                  borderColor: config.geminiKey 
                    ? "rgba(34, 197, 94, 0.4)" 
                    : "rgba(125, 211, 252, 0.4)",
                  color: config.geminiKey ? "#4ADE80" : "#7DD3FC",
                  fontWeight: 500,
                }}
                variant="outlined"
              />
              
              {/* Enhanced Options */}
              {config.speakers && (
                <Chip
                  icon={<SpeakerIcon sx={{ fontSize: "1rem" }} />}
                  label="Speaker Diarization"
                  size="small"
                  sx={{
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    color: "#60A5FA",
                    fontWeight: 500,
                  }}
                  variant="outlined"
                />
              )}
              {config.music && (
                <Chip
                  icon={<MusicIcon sx={{ fontSize: "1rem" }} />}
                  label="Music Detection"
                  size="small"
                  sx={{
                    backgroundColor: "rgba(168, 85, 247, 0.2)",
                    borderColor: "rgba(168, 85, 247, 0.4)",
                    color: "#C084FC",
                    fontWeight: 500,
                  }}
                  variant="outlined"
                />
              )}
              {config.geminiKey && !config.noGeminiRefinement && (
                <Chip
                  icon={<AiIcon sx={{ fontSize: "1rem" }} />}
                  label="AI Refinement (Gemini Flash)"
                  size="small"
                  sx={{
                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                    borderColor: "rgba(34, 197, 94, 0.4)",
                    color: "#4ADE80",
                    fontWeight: 500,
                  }}
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        </InfoSection>
      </Stack>
    </SuccessCard>
  );
};