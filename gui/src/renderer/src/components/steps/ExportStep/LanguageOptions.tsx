import React, { useMemo, useCallback } from "react";
import { Box, Typography, Paper, Stack, Chip, Tooltip } from "@mui/material";
import {
  Translate as TranslateIcon,
  Language as LanguageIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";

import { useExportStore } from "../../../stores/export-store";
import { useAppStore } from "../../../store/app-store";
import type { ExportSettings } from "../../../stores/export-store";
import {
  analyzeSubtitleEntries,
  getLanguageDisplayName,
} from "../../../utils/subtitle-parser";

interface QuickOption {
  key: keyof ExportSettings;
  label: string;
  icon: React.ReactNode;
  description: string;
  example?: string;
  enabled: boolean;
  compatibility?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const LanguageOptions: React.FC = () => {
  const { settings, updateSettings, getSubtitleData } = useExportStore();
  const { config } = useAppStore();
  const subtitles = getSubtitleData();

  const analysis = useMemo(() => {
    return analyzeSubtitleEntries(subtitles, config.language);
  }, [subtitles, config.language]);

  const translationLanguage = useMemo(() => {
    return getLanguageDisplayName(config.language);
  }, [config.language]);

  const handleOptionChange = useCallback(
    (key: keyof ExportSettings) => {
      // Prevent unchecking if it would leave no language options selected
      if (key === 'includeCantonese' || key === 'includeEnglish') {
        const newValue = !settings[key];
        const otherKey = key === 'includeCantonese' ? 'includeEnglish' : 'includeCantonese';
        
        // If trying to uncheck and the other option is also unchecked, prevent the action
        if (!newValue && !settings[otherKey]) {
          return; // Do nothing - at least one language option must remain selected
        }
      }
      
      updateSettings({ [key]: !settings[key] });
    },
    [settings, updateSettings]
  );

  const options: QuickOption[] = useMemo(() => [
    {
      key: "includeCantonese",
      label: "Caption",
      icon: <LanguageIcon />,
      description: "Include original Chinese text in the exported subtitles",
      example: `Available: ${analysis.chineseCount}/${analysis.totalCount} subtitles`,
      enabled: settings.includeCantonese,
      disabled: settings.includeCantonese && !settings.includeEnglish,
      disabledReason: settings.includeCantonese && !settings.includeEnglish ? "At least one language option must be selected" : undefined,
    },
    {
      key: "includeEnglish",
      label: "Translation",
      icon: <TranslateIcon />,
      description: `Include ${translationLanguage} translation text in the exported subtitles`,
      example: `Available: ${analysis.translationCount}/${analysis.totalCount} subtitles`,
      enabled: settings.includeEnglish,
      disabled: settings.includeEnglish && !settings.includeCantonese,
      disabledReason: settings.includeEnglish && !settings.includeCantonese ? "At least one language option must be selected" : undefined,
    },
    {
      key: "includeTimestampMetadata",
      label: "Timestamp Metadata",
      icon: <ScheduleIcon />,
      description: "Add detailed timing information and frame data to export",
      enabled: settings.includeTimestampMetadata,
    },
  ], [analysis, translationLanguage, settings]);

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 2,
        }}
      >
        {options.map((option) => {
          const paperContent = (
            <Paper
              key={option.key}
              onClick={() => !option.disabled && handleOptionChange(option.key)}
              sx={{
                p: 2,
                backgroundColor: option.enabled
                  ? "rgba(0, 0, 0, 0.3)"
                  : "rgba(255, 255, 255, 0.05)",
                border: 1,
                borderColor: option.enabled ? "primary.main" : "divider",
                transition: "all 0.2s",
                cursor: option.disabled ? "not-allowed" : "pointer",
                position: "relative",
                opacity: option.disabled ? 0.6 : 1,
                "&:hover": !option.disabled ? {
                  backgroundColor: option.enabled
                    ? "rgba(0, 0, 0, 0.4)"
                    : "rgba(255, 255, 255, 0.08)",
                  transform: "translateY(-1px)",
                } : {},
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
              </Box>
              {option.compatibility && (
                <Box sx={{ ml: 3 }}>
                  <Chip
                    label={option.compatibility}
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
                </Box>
              )}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: "0.8rem", mb: 1 }}
              >
                {option.description}
              </Typography>
              {option.example && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.75rem",
                    color: option.compatibility
                      ? "warning.main"
                      : "primary.main",
                    fontStyle: "italic",
                    backgroundColor: option.compatibility
                      ? "rgba(255, 152, 0, 0.05)"
                      : "rgba(0, 0, 0, 0.1)",
                    padding: "4px 8px",
                    borderRadius: 1,
                    border: option.compatibility
                      ? "1px solid rgba(255, 152, 0, 0.2)"
                      : "1px solid rgba(0, 0, 0, 0.2)",
                  }}
                >
                  {option.example}
                </Typography>
              )}
            </Stack>
          </Paper>
          );

          return option.disabled ? (
            <Tooltip key={option.key} title={option.disabledReason} arrow>
              {paperContent}
            </Tooltip>
          ) : paperContent;
        })}
      </Box>
    </Box>
  );
};
