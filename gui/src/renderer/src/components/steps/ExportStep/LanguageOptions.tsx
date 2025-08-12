import React, { useMemo, useCallback } from "react";
import { Box, Typography, Paper, Stack, Chip, Tooltip } from "@mui/material";
import {
  Translate as TranslateIcon,
  Language as LanguageIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";

import { 
  useExportActions,
  useExportUserSelections,
  useSubtitles
} from "../../../stores/useStepStore";
import type { Subtitle } from "../../../stores/types/StoreTypes";

interface QuickOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  example?: string;
  enabled: boolean;
  compatibility?: string;
  disabled?: boolean;
  disabledReason?: string;
}

// Simple analysis function without external dependencies
const analyzeSubtitleEntries = (subtitles: Subtitle[]) => {
  if (!subtitles || subtitles.length === 0) {
    return {
      totalCount: 0,
      chineseCount: 0,
      translationCount: 0,
    };
  }
  
  return {
    totalCount: subtitles.length,
    chineseCount: subtitles.filter(sub => sub.text && sub.text.trim()).length,
    translationCount: subtitles.filter(sub => sub.translation && sub.translation.trim()).length,
  };
};

export const LanguageOptions: React.FC = () => {
  const { updateUserSelections } = useExportActions();
  const userSelections = useExportUserSelections();
  const subtitles = useSubtitles();

  const analysis = useMemo(() => {
    return analyzeSubtitleEntries(subtitles);
  }, [subtitles]);

  const handleOptionChange = useCallback(
    (key: string) => {
      switch (key) {
        case 'includeOriginal':
          const currentLanguages = userSelections.selectedLanguages;
          const hasOriginal = currentLanguages.includes('original');
          const newLanguages = hasOriginal 
            ? currentLanguages.filter(lang => lang !== 'original')
            : [...currentLanguages, 'original'];
          
          // Prevent removing all languages
          if (newLanguages.length === 0) return;
          
          updateUserSelections({ selectedLanguages: newLanguages });
          break;
          
        case 'includeTranslation':
          const currentLangs = userSelections.selectedLanguages;
          const hasTranslation = currentLangs.includes('translation');
          const newLangs = hasTranslation 
            ? currentLangs.filter(lang => lang !== 'translation')
            : [...currentLangs, 'translation'];
          
          // Prevent removing all languages  
          if (newLangs.length === 0) return;
          
          updateUserSelections({ selectedLanguages: newLangs });
          break;
          
        case 'includeMetadata':
          updateUserSelections({ includeMetadata: !userSelections.includeMetadata });
          break;
          
        case 'includeTimestamps':
          updateUserSelections({ showTimestamps: !userSelections.showTimestamps });
          break;
      }
    },
    [userSelections, updateUserSelections]
  );

  const options: QuickOption[] = useMemo(() => {
    const hasOriginal = userSelections.selectedLanguages.includes('original');
    const hasTranslation = userSelections.selectedLanguages.includes('translation');
    
    return [
      {
        key: "includeOriginal",
        label: "Original Text",
        icon: <LanguageIcon />,
        description: "Include original subtitle text in the exported file",
        example: `Available: ${analysis.chineseCount}/${analysis.totalCount} subtitles`,
        enabled: hasOriginal,
        disabled: hasOriginal && !hasTranslation,
        disabledReason: hasOriginal && !hasTranslation ? "At least one language option must be selected" : undefined,
      },
      {
        key: "includeTranslation",
        label: "Translation",
        icon: <TranslateIcon />,
        description: "Include translation text in the exported file",
        example: `Available: ${analysis.translationCount}/${analysis.totalCount} subtitles`,
        enabled: hasTranslation,
        disabled: hasTranslation && !hasOriginal,
        disabledReason: hasTranslation && !hasOriginal ? "At least one language option must be selected" : undefined,
      },
      {
        key: "includeMetadata",
        label: "Confidence Scores",
        icon: <CheckCircleIcon />,
        description: "Include confidence scores and metadata in export",
        enabled: userSelections.includeMetadata,
      },
      {
        key: "includeTimestamps",
        label: "Show Timestamps",
        icon: <ScheduleIcon />,
        description: "Include timing information in plain text exports",
        enabled: userSelections.showTimestamps,
      },
    ];
  }, [analysis, userSelections]);

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
