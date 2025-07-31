import React, { useCallback } from "react";
import { Box, Typography, Paper, Stack, Tooltip } from "@mui/material";
import {
  Bolt as BoltIcon,
  People as PeopleIcon,
  Edit as EditIcon,
  MusicNote as MusicIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
} from "@mui/icons-material";
import { Chip } from "@mui/material";
import { useAppStore } from "../../stores/app-store";
import { AppConfig } from "@/types";

interface QuickOption {
  key: keyof AppConfig;
  label: string;
  icon: React.ReactNode;
  description: string;
  example: string;
  enabled: boolean;
  experimental?: boolean;
}

export const QuickOptionsSelector: React.FC = () => {
  const { config, updateConfig } = useAppStore();

  const hasGeminiKey = config.geminiKey && config.geminiKey.trim().length > 0;

  const handleOptionChange = useCallback(
    (key: keyof AppConfig) => {
      // Written style logic:
      // - Without Gemini: Always enabled, cannot be disabled
      // - With Gemini: Can be toggled freely
      if (key === "written" && !hasGeminiKey) {
        // If no Gemini key, written style cannot be disabled (always enabled)
        return;
      }
      updateConfig(key, !config[key]);
    },
    [config, updateConfig, hasGeminiKey]
  );

  const options: QuickOption[] = [
    {
      key: "speakers",
      label: "Speaker Identification",
      icon: <PeopleIcon />,
      description: "Identify and label different speakers in the audio",
      example: "Example: [SPEAKER_01] 我知道!",
      enabled: config.speakers,
      experimental: true,
    },
    {
      key: "written",
      label: "Written Style Conversion",
      icon: <EditIcon />,
      description: hasGeminiKey
        ? "Enhanced AI-powered style conversion with Gemini"
        : "Built-in Whisper written style conversion (always enabled)",
      example: hasGeminiKey
        ? 'Example: "咩料？" → "什麼情況？" (Enhanced with Gemini AI)'
        : 'Example: "咩料？" → "什麼情況？" (Built-in conversion)',
      enabled: hasGeminiKey ? config.written : true, // Always enabled without Gemini
    },
    {
      key: "music",
      label: "Music Detection",
      icon: <MusicIcon />,
      description: "Detect and label music segments in the audio",
      example: "Example: [MUSIC]",
      enabled: config.music,
      experimental: true,
    },
  ];

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
      >
        <BoltIcon color="primary" />
        Quick Options
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          // Ensure all cards have same height
          gridAutoRows: "1fr",
          alignItems: "stretch",
        }}
      >
        {options.map((option) => {
          // For written style: disable clicking when no Gemini key (always enabled state)
          const isDisabled = option.key === "written" && !hasGeminiKey;
          const tooltipTitle = isDisabled
            ? "Written style will be used and cannot be disabled without a Gemini API key."
            : "";

          const paperContent = (
            <Paper
              onClick={() => !isDisabled && handleOptionChange(option.key)}
              sx={{
                p: 2,
                backgroundColor: option.enabled
                  ? "rgba(245, 158, 11, 0.1)"
                  : isDisabled
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(255, 255, 255, 0.05)",
                border: 1,
                borderColor: option.enabled
                  ? "primary.main"
                  : isDisabled
                  ? "rgba(255, 193, 7, 0.3)"
                  : "divider",
                transition: "all 0.2s",
                cursor: isDisabled ? "not-allowed" : "pointer",
                position: "relative",
                opacity: isDisabled ? 0.7 : 1,
                // Ensure cards stretch to full height and arrange content properly
                height: "100%",
                display: "flex",
                flexDirection: "column",
                "&:hover": !isDisabled
                  ? {
                      backgroundColor: option.enabled
                        ? "rgba(245, 158, 11, 0.15)"
                        : "rgba(255, 255, 255, 0.08)",
                      transform: "translateY(-1px)",
                    }
                  : {
                      borderColor: isDisabled
                        ? "rgba(255, 193, 7, 0.5)"
                        : undefined,
                    },
              }}
            >
              {/* Status icon in top right */}
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  opacity: option.enabled || isDisabled ? 1 : 0,
                  transition: "opacity 0.2s ease",
                }}
              >
                {option.enabled ? (
                  <CheckCircleIcon
                    color="primary"
                    sx={{ fontSize: "1.2rem" }}
                  />
                ) : isDisabled ? (
                  <BlockIcon sx={{ fontSize: "1.2rem", color: "#FF9800" }} />
                ) : null}
              </Box>

              <Stack 
                spacing={1} 
                sx={{ 
                  height: "100%", 
                  justifyContent: "space-between" 
                }}
              >
                {/* Header section with icon, title, and chip */}
                <Box>
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 1, pr: 3 }}
                  >
                    {option.icon}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {option.label}
                    </Typography>
                    {option.experimental && (
                      <Chip
                        label="Experimental"
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          height: 18,
                          backgroundColor: "rgba(255, 152, 0, 0.15)",
                          color: "#FF9800",
                          border: "1px solid rgba(255, 152, 0, 0.3)",
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.8rem", mt: 1 }}
                  >
                    {option.description}
                  </Typography>
                </Box>
                
                {/* Example section - pushed to bottom */}
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.75rem",
                    color: isDisabled ? "text.secondary" : "primary.main",
                    fontStyle: "italic",
                    backgroundColor: isDisabled
                      ? "rgba(255, 152, 0, 0.05)"
                      : "rgba(245, 158, 11, 0.05)",
                    padding: "4px 8px",
                    borderRadius: 1,
                    border: isDisabled
                      ? "1px solid rgba(255, 152, 0, 0.2)"
                      : "1px solid rgba(245, 158, 11, 0.2)",
                  }}
                >
                  {option.example}
                </Typography>
              </Stack>
            </Paper>
          );

          return (
            <div key={String(option.key)} style={{ height: "100%" }}>
              {isDisabled ? (
                <Tooltip
                  title={tooltipTitle}
                  arrow
                  placement="top"
                  sx={{
                    "& .MuiTooltip-tooltip": {
                      backgroundColor: "#2F3136",
                      color: "#DCDDDE",
                      fontSize: "0.875rem",
                      maxWidth: 300,
                      border: "1px solid rgba(255, 193, 7, 0.3)",
                    },
                    "& .MuiTooltip-arrow": {
                      color: "#2F3136",
                    },
                  }}
                >
                  <Box sx={{ height: "100%" }}>{paperContent}</Box>
                </Tooltip>
              ) : (
                paperContent
              )}
            </div>
          );
        })}
      </Box>
    </Box>
  );
};
