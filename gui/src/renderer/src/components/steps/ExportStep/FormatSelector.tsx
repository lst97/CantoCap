import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Chip, Alert, Tooltip } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

import { useExportStepContent, useExportActions, useSubtitles } from '../../../stores/useStepStore';
import type { Subtitle } from '../../../stores/types/StoreTypes';

// Available export formats
const EXPORT_FORMATS = [
  {
    id: 'srt',
    name: 'SRT',
    description: 'SubRip Subtitle format - most widely supported',
    features: ['Timestamps', 'Line Numbers', 'Multi-line', 'Cross-platform'],
  },
  {
    id: 'vtt',
    name: 'WebVTT',
    description: 'Web Video Text Track format for HTML5 video',
    features: ['Web Standard', 'Styling Support', 'Cue Settings', 'HTML5'],
  },
  {
    id: 'txt',
    name: 'Plain Text',
    description: 'Simple text file with optional timestamps',
    features: ['Simple', 'Readable', 'Timestamps Optional', 'Universal'],
  },
  {
    id: 'json',
    name: 'JSON',
    description: 'Structured JSON format with metadata and subtitles',
    features: ['Structured', 'Metadata', 'API-friendly', 'Machine-readable'],
  },
  {
    id: 'fcpxml',
    name: 'FCPXML',
    description: 'Final Cut Pro XML format for professional video editing workflows',
    features: ['Professional', 'Timeline-ready', 'NLE Compatible', 'Final Cut Pro'],
  },
];

// Basic validation for subtitle formats
const validateForFormat = (subtitles: Subtitle[], formatId: string): string[] => {
  const issues: string[] = [];

  if (!subtitles || subtitles.length === 0) {
    issues.push('No subtitles available');
    return issues;
  }

  // Check for common issues
  const hasLongLines = subtitles.some((sub) => sub.text && sub.text.length > 80);
  const hasSpecialChars = subtitles.some((sub) => sub.text && /[<>&]/.test(sub.text));

  if (formatId === 'srt' && hasSpecialChars) {
    issues.push('Contains HTML/XML characters');
  }

  if (formatId === 'vtt' && hasLongLines) {
    issues.push('Some lines exceed recommended length');
  }

  if (formatId === 'json') {
    // JSON format is generally robust, but check for potential issues
    const hasInvalidChars = subtitles.some((sub) => 
      // eslint-disable-next-line no-control-regex
      sub.text && /[\u0000-\u001F\u007F-\u009F]/.test(sub.text)
    );
    if (hasInvalidChars) {
      issues.push('Contains control characters that may not display properly');
    }
  }

  if (formatId === 'fcpxml') {
    // FCPXML format validation for professional video editing
    const hasXMLIncompatibleChars = subtitles.some((sub) => 
      sub.text && /[<>&"']/.test(sub.text.replace(/&[a-zA-Z0-9#]+;/g, ''))
    );
    if (hasXMLIncompatibleChars) {
      issues.push('Contains XML characters that will be escaped');
    }
    
    const hasVeryShortDurations = subtitles.some((sub) => 
      (sub.endTime - sub.startTime) < 0.1
    );
    if (hasVeryShortDurations) {
      issues.push('Very short subtitle durations may not be suitable for video editing');
    }
  }

  return issues;
};

export const FormatSelector: React.FC = () => {
  const exportStep = useExportStepContent();
  const { updateExportFormat } = useExportActions();
  const subtitles = useSubtitles();

  const [localValidationIssues, setLocalValidationIssues] = useState<Record<string, string[]>>({});

  // Memoize validation issues to prevent unnecessary recalculation
  const validationIssues = useMemo(() => {
    const issues: Record<string, string[]> = {};
    EXPORT_FORMATS.forEach((format) => {
      const formatIssues = validateForFormat(subtitles, format.id);
      if (formatIssues.length > 0) {
        issues[format.id] = formatIssues;
      }
    });
    return issues;
  }, [subtitles]);

  // Update local state only when validation issues actually change
  useEffect(() => {
    setLocalValidationIssues((prevIssues) => {
      const issueKeys = Object.keys(validationIssues).sort();
      const prevKeys = Object.keys(prevIssues).sort();

      // Compare keys first
      if (
        issueKeys.length !== prevKeys.length ||
        !issueKeys.every((key) => prevKeys.includes(key))
      ) {
        return validationIssues;
      }

      // Compare issue arrays for each key
      for (const key of issueKeys) {
        const currentIssues = validationIssues[key] || [];
        const prevKeyIssues = prevIssues[key] || [];

        if (
          currentIssues.length !== prevKeyIssues.length ||
          !currentIssues.every((issue) => prevKeyIssues.includes(issue))
        ) {
          return validationIssues;
        }
      }

      // No changes, return previous state to prevent re-render
      return prevIssues;
    });
  }, [validationIssues]);

  const handleFormatChange = useCallback(
    (formatId: string) => {
      updateExportFormat(formatId);
    },
    [updateExportFormat]
  );

  return (
    <Box role='region' aria-labelledby='format-selector-title'>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 2,
          width: '100%',
        }}
      >
        {EXPORT_FORMATS.map((format) => {
          const hasIssues = localValidationIssues[format.id]?.length > 0;
          const isSelected = exportStep.format === format.id;

          return (
            <Box
              key={format.id}
              sx={{
                p: 2,
                border: 1,
                borderRadius: 2,
                borderColor: isSelected
                  ? 'primary.main'
                  : hasIssues
                    ? 'warning.main'
                    : 'rgba(255, 255, 255, 0.1)',
                backgroundColor: hasIssues
                  ? 'rgba(245, 158, 11, 0.02)'
                  : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s ease-in-out',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  transform: 'translateY(-1px)',
                },
              }}
              onClick={() => handleFormatChange(format.id)}
            >
              <Box sx={{ width: '100%', flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                    {format.name}
                  </Typography>
                  {hasIssues && (
                    <Tooltip title={localValidationIssues[format.id]?.join(', ')}>
                      <WarningIcon color='warning' fontSize='small' />
                    </Tooltip>
                  )}
                </Box>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                  {format.description}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: hasIssues ? 1 : 0 }}>
                  {format.features.map((feature) => (
                    <Chip key={feature} label={feature} size='small' variant='outlined' />
                  ))}
                </Box>
                {hasIssues && (
                  <Alert severity='warning' sx={{ mt: 1 }}>
                    <Typography variant='caption'>
                      {localValidationIssues[format.id]?.slice(0, 2).join('; ')}
                      {localValidationIssues[format.id]?.length > 2 && '...'}
                    </Typography>
                  </Alert>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
