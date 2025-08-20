import React, { useMemo, useCallback, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Chip, Tooltip, Alert } from '@mui/material';
import {
  Translate as TranslateIcon,
  Language as LanguageIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import {
  useExportActions,
  useExportUserSelections,
  useSubtitles,
  useExportStepContent,
} from '../../../stores/useStepStore';
import { useExportStepActions } from '../../../stores/steps/useExportStepStore';
import { useAppStore } from '../../../stores/useAppStore';
import type { Subtitle } from '../../../stores/types/StoreTypes';
import { getFormatLanguageCapabilities, validateLanguageSelection, type LanguageSelection, type ExportFormat } from '../../../stores/steps/exportLanguageHelpers';

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
    chineseCount: subtitles.filter((sub) => sub.text && sub.text.trim()).length,
    translationCount: subtitles.filter((sub) => sub.translation && sub.translation.trim()).length,
  };
};

export const LanguageOptions: React.FC = () => {
  const { updateUserSelections, generatePreviewContent } = useExportActions();
  const userSelections = useExportUserSelections();
  const subtitles = useSubtitles();
  const exportStep = useExportStepContent();
  
  // Enhanced persistence hooks
  const exportStepActions = useExportStepActions();
  const appStore = useAppStore();
  const activeWorkspaceId = appStore.activeWorkspaceId;

  // Load workspace-specific language preferences on mount and workspace change
  useEffect(() => {
    if (activeWorkspaceId) {
      exportStepActions.loadExportPreferences(activeWorkspaceId)
        .then((preferences) => {
          if (preferences) {
            console.log(`📖 Loading language preferences for workspace: ${activeWorkspaceId}`, preferences);
            
            // Apply loaded preferences to current state
            if (preferences.selectedLanguages && preferences.selectedLanguages.length > 0) {
              updateUserSelections({ 
                selectedLanguages: preferences.selectedLanguages,
                includeMetadata: preferences.includeMetadata ?? userSelections.includeMetadata,
                showTimestamps: preferences.showTimestamps ?? userSelections.showTimestamps,
                customOutputPath: preferences.customOutputPath || userSelections.customOutputPath
              });
            }
          } else {
            console.log(`📝 No existing preferences found for workspace: ${activeWorkspaceId}, using defaults`);
          }
        })
        .catch((error) => {
          console.warn('Failed to load export preferences:', error);
        });
    }
  }, [activeWorkspaceId, exportStepActions, updateUserSelections]);

  // Save preferences when they change
  const savePreferences = useCallback(async (updatedSelections: Partial<typeof userSelections>) => {
    if (!activeWorkspaceId) return;
    
    try {
      const preferences = {
        workspaceId: activeWorkspaceId,
        preferredFormat: exportStep.format,
        selectedLanguages: updatedSelections.selectedLanguages || userSelections.selectedLanguages,
        includeMetadata: updatedSelections.includeMetadata ?? userSelections.includeMetadata,
        showTimestamps: updatedSelections.showTimestamps ?? userSelections.showTimestamps,
        customOutputPath: updatedSelections.customOutputPath || userSelections.customOutputPath,
        exportSettings: exportStep.exportSettings,
        lastUsedSettings: {
          format: exportStep.format,
          timestamp: Date.now()
        }
      };
      
      await exportStepActions.saveExportPreferences(activeWorkspaceId, preferences);
      console.log(`💾 Saved language preferences for workspace: ${activeWorkspaceId}`, preferences);
    } catch (error) {
      console.error('Failed to save export preferences:', error);
    }
  }, [activeWorkspaceId, exportStep.format, exportStep.exportSettings, userSelections, exportStepActions]);

  const analysis = useMemo(() => {
    return analyzeSubtitleEntries(subtitles || []);
  }, [subtitles]);

  // Get format capabilities for the current export format
  const formatCapabilities = useMemo(() => {
    return getFormatLanguageCapabilities(exportStep.format as ExportFormat);
  }, [exportStep.format]);

  // Validate current language selection
  const languageValidation = useMemo(() => {
    return validateLanguageSelection(
      subtitles || [], 
      userSelections.selectedLanguages as LanguageSelection[]
    );
  }, [subtitles, userSelections.selectedLanguages]);

  const handleOptionChange = useCallback(
    async (key: string) => {
      switch (key) {
        case 'includeOriginal':
          const currentLanguages = userSelections.selectedLanguages || [];
          const hasOriginal = currentLanguages.includes('original');
          const newLanguages = hasOriginal
            ? currentLanguages.filter((lang) => lang !== 'original')
            : [...currentLanguages, 'original'];

          // Prevent removing all languages
          if (newLanguages.length === 0) return;

          const originalSelections = { selectedLanguages: newLanguages };
          updateUserSelections(originalSelections);
          // Save preferences with workspace isolation
          await savePreferences(originalSelections);
          // Trigger immediate preview update
          setTimeout(() => generatePreviewContent(), 0);
          break;

        case 'includeTranslation':
          const currentLangs = userSelections.selectedLanguages || [];
          const hasTranslation = currentLangs.includes('translation');
          const newLangs = hasTranslation
            ? currentLangs.filter((lang) => lang !== 'translation')
            : [...currentLangs, 'translation'];

          // Prevent removing all languages
          if (newLangs.length === 0) return;

          const translationSelections = { selectedLanguages: newLangs };
          updateUserSelections(translationSelections);
          // Save preferences with workspace isolation
          await savePreferences(translationSelections);
          // Trigger immediate preview update
          setTimeout(() => generatePreviewContent(), 0);
          break;

        case 'includeMetadata':
          const metadataSelections = { includeMetadata: !userSelections.includeMetadata };
          updateUserSelections(metadataSelections);
          // Save preferences with workspace isolation
          await savePreferences(metadataSelections);
          // Trigger immediate preview update
          setTimeout(() => generatePreviewContent(), 0);
          break;

        case 'includeTimestamps':
          const timestampSelections = { showTimestamps: !userSelections.showTimestamps };
          updateUserSelections(timestampSelections);
          // Save preferences with workspace isolation
          await savePreferences(timestampSelections);
          // Trigger immediate preview update
          setTimeout(() => generatePreviewContent(), 0);
          break;
      }
    },
    [userSelections, updateUserSelections, generatePreviewContent, savePreferences]
  );

  const options: QuickOption[] = useMemo(() => {
    const selectedLanguages = userSelections.selectedLanguages || [];
    const hasOriginal = selectedLanguages.includes('original');
    const hasTranslation = selectedLanguages.includes('translation');

    return [
      {
        key: 'includeOriginal',
        label: 'Original Text',
        icon: <LanguageIcon />,
        description: 'Include original subtitle text in the exported file',
        example: `Available: ${analysis.chineseCount}/${analysis.totalCount} subtitles`,
        enabled: hasOriginal,
        disabled: hasOriginal && !hasTranslation,
        disabledReason:
          hasOriginal && !hasTranslation
            ? 'At least one language option must be selected'
            : undefined,
        compatibility: formatCapabilities.supportsMultipleLanguages 
          ? undefined 
          : `${exportStep.format.toUpperCase()} format only supports single language`,
      },
      {
        key: 'includeTranslation',
        label: 'Translation',
        icon: <TranslateIcon />,
        description: 'Include translation text in the exported file',
        example: `Available: ${analysis.translationCount}/${analysis.totalCount} subtitles | ${formatCapabilities.description}`,
        enabled: hasTranslation,
        disabled: hasTranslation && !hasOriginal,
        disabledReason:
          hasTranslation && !hasOriginal
            ? 'At least one language option must be selected'
            : undefined,
        compatibility: formatCapabilities.supportsMultipleLanguages 
          ? undefined 
          : `${exportStep.format.toUpperCase()} format only supports single language`,
      },
      {
        key: 'includeMetadata',
        label: 'Confidence Scores',
        icon: <CheckCircleIcon />,
        description: 'Include confidence scores and metadata in export',
        enabled: userSelections.includeMetadata,
        compatibility: exportStep.format === 'json' ? undefined : 
                     exportStep.format === 'fcpxml' ? 'Metadata included as XML title attributes' : 'Limited support in non-JSON formats',
      },
      {
        key: 'includeTimestamps',
        label: 'Show Timestamps',
        icon: <ScheduleIcon />,
        description: 'Include timing information in plain text exports',
        enabled: userSelections.showTimestamps,
        compatibility: exportStep.format === 'txt' ? undefined : 
                     exportStep.format === 'fcpxml' ? 'FCPXML includes timestamps in timeline format' : 'Only applies to TXT format',
      },
    ];
  }, [analysis, userSelections, formatCapabilities, exportStep.format]);

  return (
    <Box>
      {/* Language Selection Validation Warning */}
      {!languageValidation.isValid && languageValidation.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Language Selection Issue
          </Typography>
          {languageValidation.warnings.map((warning, index) => (
            <Typography key={index} variant="body2" sx={{ fontSize: '0.85rem' }}>
              • {warning}
            </Typography>
          ))}
        </Alert>
      )}
      
      {/* Format Information */}
      {formatCapabilities && (
        <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(0, 0, 0, 0.1)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {exportStep.format.toUpperCase()} Format Compatibility
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
            {formatCapabilities.description}
          </Typography>
          {languageValidation.isValid && (
            <Typography variant="body2" color="success.main" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
              ✓ {languageValidation.totalAvailable} subtitles will be exported with current selection
            </Typography>
          )}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
                  ? 'rgba(0, 0, 0, 0.3)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: 1,
                borderColor: option.enabled ? 'primary.main' : 'divider',
                transition: 'all 0.2s',
                cursor: option.disabled ? 'not-allowed' : 'pointer',
                position: 'relative',
                opacity: option.disabled ? 0.6 : 1,
                '&:hover': !option.disabled
                  ? {
                      backgroundColor: option.enabled
                        ? 'rgba(0, 0, 0, 0.4)'
                        : 'rgba(255, 255, 255, 0.08)',
                      transform: 'translateY(-1px)',
                    }
                  : {},
              }}
            >
              {/* Check icon in top right */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  opacity: option.enabled ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <CheckCircleIcon color='primary' sx={{ fontSize: '1.2rem' }} />
              </Box>

              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 3 }}>
                  {option.icon}
                  <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                    {option.label}
                  </Typography>
                </Box>
                {option.compatibility && (
                  <Box sx={{ ml: 3 }}>
                    <Chip
                      label={option.compatibility}
                      size='small'
                      sx={{
                        fontSize: '0.65rem',
                        height: 18,
                        backgroundColor: 'rgba(255, 152, 0, 0.15)',
                        color: '#FF9800',
                        border: '1px solid rgba(255, 152, 0, 0.3)',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                )}
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ fontSize: '0.8rem', mb: 1 }}
                >
                  {option.description}
                </Typography>
                {option.example && (
                  <Typography
                    variant='body2'
                    sx={{
                      fontSize: '0.75rem',
                      color: option.compatibility ? 'warning.main' : 'primary.main',
                      fontStyle: 'italic',
                      backgroundColor: option.compatibility
                        ? 'rgba(255, 152, 0, 0.05)'
                        : 'rgba(0, 0, 0, 0.1)',
                      padding: '4px 8px',
                      borderRadius: 1,
                      border: option.compatibility
                        ? '1px solid rgba(255, 152, 0, 0.2)'
                        : '1px solid rgba(0, 0, 0, 0.2)',
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
          ) : (
            paperContent
          );
        })}
      </Box>
    </Box>
  );
};
