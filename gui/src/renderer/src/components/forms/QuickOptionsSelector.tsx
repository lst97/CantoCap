import React, { useCallback } from "react";
import { Box, Typography, Paper, Stack } from "@mui/material";
import {
  Bolt as BoltIcon,
  People as PeopleIcon,
  Edit as EditIcon,
  MusicNote as MusicIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { Chip } from "@mui/material";
import { useAppStore } from "../../store/app-store";

interface QuickOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  example: string;
  enabled: boolean;
  experimental?: boolean;
}

export const QuickOptionsSelector: React.FC = () => {
  const { config, updateConfig } = useAppStore();

  const handleOptionChange = useCallback(
    (key: string) => {
      updateConfig(key, !config[key as keyof typeof config]);
    },
    [config, updateConfig]
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
      description: "Convert colloquial speech to formal written style",
      example: 'Example: "咩料？" → "什麼情況？"',
      enabled: config.written,
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
        }}
      >
        {options.map((option) => (
          <Paper
            key={option.key}
            onClick={() => handleOptionChange(option.key)}
            sx={{
              p: 2,
              backgroundColor: option.enabled
                ? "rgba(245, 158, 11, 0.1)"
                : "rgba(255, 255, 255, 0.05)",
              border: 1,
              borderColor: option.enabled ? "primary.main" : "divider",
              transition: "all 0.2s",
              cursor: "pointer",
              position: "relative",
              "&:hover": {
                backgroundColor: option.enabled
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(255, 255, 255, 0.08)",
                transform: "translateY(-1px)",
              },
            }}
          >
            {/* Check icon in top right */}
            <Box
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                opacity: option.enabled ? 1 : 0,
                transition: "opacity 0.2s ease",
              }}
            >
              <CheckCircleIcon color="primary" sx={{ fontSize: "1.2rem" }} />
            </Box>

            <Stack spacing={1}>
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
                sx={{ fontSize: "0.8rem", mb: 1 }}
              >
                {option.description}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: "0.75rem",
                  color: "primary.main",
                  fontStyle: "italic",
                  backgroundColor: "rgba(245, 158, 11, 0.05)",
                  padding: "4px 8px",
                  borderRadius: 1,
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                }}
              >
                {option.example}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};
