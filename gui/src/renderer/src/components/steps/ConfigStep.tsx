import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Stack, LinearProgress, Fade, Alert, Snackbar } from '@mui/material';
import {
  Settings as SettingsIcon,
  Preview as PreviewIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { AdvancedPanel } from '../ui/AdvancedPanel';
import { OutputLocationSelector } from '../forms/OutputLocationSelector';
import { QuickOptionsSelector } from '../forms/QuickOptionsSelector';
import { CharsetSelector } from '../forms/CharsetSelector';
import { APIKeyInput } from '../forms/APIKeyInput';
import { TranslationSelector } from '../forms/TranslationSelector';
// ActionPanel removed - processing logic should be handled in Step 3, not Step 2
import { Button } from '@mui/material';
import { PlayArrow as PlayIcon } from '@mui/icons-material';
import { BaseCard } from '../elements';
import {
  useConfigStepContent,
  useStepActions,
  useStepError,
  useStepLoading,
  useInputStepContent,
  useProcessingStepContent, // Re-added for processing status validation
} from '../../stores/useStepStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useActiveWorkspaceId } from '../../stores/useAppStore';
import { useSubtitleActions } from '../../stores/useSubtitleEditStore';
import { useProcessingStepActions } from '../../stores/steps/useProcessingStepStore';
import type {
  TranslationLanguage,
  ProcessingLanguage,
  WhisperModel,
  ConfigStepData,
} from '../../stores/types/StoreTypes';
import { StepStatus, StepStatusType } from '../../stores/types/StoreTypes';
import { createComponentLogger } from '../../utils/logger';

// Context for config updates
const ConfigUpdateContext = React.createContext<{
  updateConfig: (updates: Partial<ConfigStepData>) => Promise<void>;
  config: ConfigStepData;
  isValid: boolean;
} | null>(null);

export const useConfigUpdate = () => {
  const context = React.useContext(ConfigUpdateContext);
  if (!context) {
    throw new Error('useConfigUpdate must be used within ConfigStep');
  }
  return context;
};

// Helper function to get human-readable translation language names
const getTranslationLanguageName = (code: TranslationLanguage): string => {
  const languageNames: Record<TranslationLanguage, string> = {
    en_us: 'English (US)',
    en_uk: 'English (UK)',
    en_au: 'English (Australia)',
    en_ca: 'English (Canada)',
    zh_cn: 'Chinese (Simplified)',
    zh_tw: 'Chinese (Traditional)',
    ja_jp: 'Japanese',
    ko_kr: 'Korean',
    es_es: 'Spanish (Spain)',
    es_mx: 'Spanish (Mexico)',
    fr_fr: 'French (France)',
    fr_ca: 'French (Canada)',
    de_de: 'German',
    it_it: 'Italian',
    pt_br: 'Portuguese (Brazil)',
    pt_pt: 'Portuguese (Portugal)',
    ru_ru: 'Russian',
    ar_sa: 'Arabic',
    hi_in: 'Hindi',
    th_th: 'Thai',
    vi_vn: 'Vietnamese',
    id_id: 'Indonesian',
    ms_my: 'Malay',
    tl_ph: 'Filipino/Tagalog',
  };
  return languageNames[code] || code;
};

// Helper function to get human-readable processing language names
const getProcessingLanguageName = (code: ProcessingLanguage): string => {
  const languageNames: Record<ProcessingLanguage, string> = {
    en: 'English',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
    hi: 'Hindi',
    vi: 'Vietnamese',
    uk: 'Ukrainian',
    pl: 'Polish',
    hu: 'Hungarian',
    fi: 'Finnish',
    fa: 'Persian',
    el: 'Greek',
    tr: 'Turkish',
    da: 'Danish',
    he: 'Hebrew',
    ur: 'Urdu',
    te: 'Telugu',
    ca: 'Catalan',
    ml: 'Malayalam',
    no: 'Norwegian',
    nn: 'Norwegian Nynorsk',
    sk: 'Slovak',
    sl: 'Slovenian',
    hr: 'Croatian',
    ro: 'Romanian',
    eu: 'Basque',
    gl: 'Galician',
    ka: 'Georgian',
    lv: 'Latvian',
    tl: 'Tagalog',
    nl: 'Dutch',
    cs: 'Czech',
  };
  return languageNames[code] || code;
};

// Helper function to get human-readable model names
const getModelDisplayName = (model: WhisperModel): string => {
  const modelNames: Record<WhisperModel, string> = {
    'openai/whisper-small': 'Whisper Small',
    'openai/whisper-medium': 'Whisper Medium',
    'openai/whisper-large-v2': 'Whisper Large V2',
    'openai/whisper-large-v3': 'Whisper Large V3',
    'openai/whisper-large-v3-turbo': 'Whisper Large V3 Turbo',
    'whisperx/large-v3': 'WhisperX Large V3',
  };
  return modelNames[model] || model;
};

// Config validation helpers
const validateConfiguration = (config: ConfigStepData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.charset) {
    errors.push('Character set is required');
  }

  if (!config.language) {
    errors.push('Processing language is required');
  }

  if (!config.modelSettings?.whisperModel) {
    errors.push('Whisper model is required');
  }

  if (config.geminiKey && typeof config.geminiKey !== 'string') {
    errors.push('Gemini API key must be a valid string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const ConfigPreview: React.FC = () => {
  const config = useConfigStepContent();

  const getCompletionPercentage = () => {
    let completed = 0;
    const total = 6;

    if (config.outputFile || config.inputFile) completed++;
    if (config.charset) completed++;
    if (config.language) completed++;
    if (config.modelSettings?.whisperModel) completed++;
    if (config.subtitle) completed++;
    if (config.geminiKey || config.speakers || config.written || config.music) completed++;

    return Math.round((completed / total) * 100);
  };

  const completion = getCompletionPercentage();

  return (
    <BaseCard variant='subtle' sx={{ p: 3, height: 'fit-content' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography
          variant='h6'
          sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}
        >
          <PreviewIcon color='primary' />
          Configuration Summary
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            {completion}%
          </Typography>
          {completion === 100 && <CheckIcon color='success' fontSize='small' />}
        </Box>
      </Box>

      <LinearProgress
        variant='determinate'
        value={completion}
        sx={{
          mb: 3,
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            background:
              completion === 100
                ? 'linear-gradient(90deg, #57F287 0%, #22C55E 100%)'
                : 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
          },
        }}
      />

      <Stack spacing={3}>
        <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <Typography variant='subtitle2' color='primary' sx={{ mb: 1, fontWeight: 600 }}>
            📁 Output
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {config.outputFile ? config.outputFile.split(/[\\/]/).pop() : 'Auto-generated'}
          </Typography>
        </Box>

        <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <Typography variant='subtitle2' color='primary' sx={{ mb: 1, fontWeight: 600 }}>
            🌐 Language & Format
          </Typography>
          <Typography variant='body2'>
            {config.charset === 'traditional' ? '繁體中文' : '简体中文'} •{' '}
            {config.subtitle
              ? `Translation: ${getTranslationLanguageName(config.subtitle)}`
              : 'No Translation'}
          </Typography>
        </Box>

        <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <Typography variant='subtitle2' color='primary' sx={{ mb: 1, fontWeight: 600 }}>
            ⚙️ Processing
          </Typography>
          <Typography variant='body2'>
            {config.modelSettings?.whisperModel
              ? getModelDisplayName(config.modelSettings.whisperModel)
              : 'Auto-select'}{' '}
            • {config.language ? getProcessingLanguageName(config.language) : 'Auto-detect'}
          </Typography>
        </Box>

        {(config.speakers || config.music || config.geminiKey) && (
          <Fade in={true}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: 'rgba(87, 242, 135, 0.05)',
                border: '1px solid rgba(87, 242, 135, 0.1)',
              }}
            >
              <Typography variant='subtitle2' color='success.main' sx={{ mb: 1, fontWeight: 600 }}>
                ✨ Enhanced Features
              </Typography>
              <Stack spacing={0.5}>
                {config.speakers && (
                  <Typography variant='body2' sx={{ fontSize: '0.8rem' }}>
                    • Speaker identification
                  </Typography>
                )}
                {config.music && (
                  <Typography variant='body2' sx={{ fontSize: '0.8rem' }}>
                    • Music detection
                  </Typography>
                )}
                {config.geminiKey && (
                  <Typography variant='body2' sx={{ fontSize: '0.8rem' }}>
                    • AI refinement (Gemini)
                  </Typography>
                )}
                {config.geminiKey && config.written && (
                  <Typography variant='body2' sx={{ fontSize: '0.8rem' }}>
                    • Enhanced written style conversion
                  </Typography>
                )}
              </Stack>
            </Box>
          </Fade>
        )}
      </Stack>
    </BaseCard>
  );
};

const ConfigSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  important?: boolean;
}> = ({ title, icon, children, important = false }) => {
  return (
    <BaseCard variant={important ? 'important' : 'default'} interactive sx={{ p: 3 }}>
      <Typography
        variant='h6'
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          fontWeight: 600,
          color: important ? 'primary.main' : 'text.primary',
        }}
      >
        {icon}
        {title}
      </Typography>
      {children}
    </BaseCard>
  );
};

export const ConfigStep: React.FC = () => {
  const logger = createComponentLogger('ConfigStep');
  const config = useConfigStepContent();
  const inputStep = useInputStepContent();
  const processing = useProcessingStepContent(); // Re-added for processing status validation
  const { updateStepContent, clearError } = useStepActions();
  const setStepState = useWorkflowStore((state) => state.actions.setStepState);
  const currentConfigStepState = useWorkflowStore((state) => state.stepStates.config);
  const workflowActions = useWorkflowStore((state) => state.actions);
  const activeWorkspaceId = useActiveWorkspaceId();
  const { clearWorkspace } = useSubtitleActions();
  const { startProcessing } = useProcessingStepActions();
  const error = useStepError();
  const isLoading = useStepLoading();
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [userErrorMessage, setUserErrorMessage] = useState<string>('');
  const [showUserError, setShowUserError] = useState(false);

  const isReady = !isLoading;

  // Validate configuration whenever it changes
  const validation = useMemo(() => {
    return validateConfiguration(config);
  }, [config]);

  // Update step content with validation results
  const updateConfigWithValidation = useCallback(
    async (updates: Partial<typeof config>) => {
      try {
        await updateStepContent('config', {
          ...updates,
          lastModified: Date.now(),
        });

        // Validate the updated configuration
        const newConfig = { ...config, ...updates };
        const validation = validateConfiguration(newConfig);

        await updateStepContent('config', {
          isValid: validation.isValid,
          validationErrors: validation.errors,
        });

        setValidationErrors(validation.errors);
      } catch (err) {
        logger.error('Failed to update config:', { error: err });
      }
    },
    [config, updateStepContent, logger]
  );

  // Handle errors
  useEffect(() => {
    if (error) {
      setShowErrorNotification(true);
    }
  }, [error]);

  // Update validation errors when validation changes
  useEffect(() => {
    setValidationErrors(validation.errors);
  }, [validation]);

  // Update config step state based on validation and input file availability
  // IMPORTANT: Only change step state if the calculated state differs from current state
  // This prevents unnecessary state changes when navigating to the step
  useEffect(() => {
    const inputFile = inputStep?.inputFile || inputStep?.selectedFile;
    const huggingFaceKey = config?.apiKeys?.huggingface;

    // Calculate what the step state should be based on current conditions
    // Removed processing status check - Step 2 should not depend on processing state
    let calculatedState: StepStatusType;
    if (!inputFile) {
      // If no input file from step 1, show warning
      calculatedState = StepStatus.WARNING;
    } else if (!huggingFaceKey) {
      // If no Hugging Face API key, show warning (required)
      calculatedState = StepStatus.WARNING;
    } else if (validation.isValid) {
      // If validation passes and input file exists and API key provided, set to READY
      calculatedState = StepStatus.READY;
    } else {
      // If other validation fails, set to WARNING
      calculatedState = StepStatus.WARNING;
    }

    // Only call setStepState if the calculated state is different from current state
    // This prevents unnecessary step state changes during navigation
    if (currentConfigStepState !== calculatedState) {
      setStepState('config', calculatedState);
    }
  }, [
    inputStep?.inputFile,
    inputStep?.selectedFile,
    validation.isValid,
    config?.apiKeys?.huggingface,
    currentConfigStepState,
    setStepState,
    logger,
  ]);

  // Simple handler to start subtitle generation and navigate to Step 3
  const handleStartTranscription = useCallback(async () => {
    if (!activeWorkspaceId) {
      logger.error('No workspace selected');
      return;
    }

    const inputFile = inputStep?.inputFile || inputStep?.selectedFile;
    const huggingFaceKey = config?.apiKeys?.huggingface;

    // Comprehensive validation with user-friendly error messages
    if (!inputFile) {
      setUserErrorMessage('Please select an input file first');
      setShowUserError(true);
      return;
    }

    if (!activeWorkspaceId) {
      setUserErrorMessage('Please select a workspace first');
      setShowUserError(true);
      return;
    }

    if (!huggingFaceKey) {
      setUserErrorMessage('Hugging Face API key is required for subtitle generation');
      setShowUserError(true);
      return;
    }

    if (processing.status === 'running') {
      setUserErrorMessage('Processing is already running. Please wait for it to complete.');
      setShowUserError(true);
      return;
    }

    // Use the existing validation logic from Step 2
    const validationResult = validateConfiguration(config);
    if (!validationResult.isValid) {
      const errorMsg = `Configuration issues: ${validationResult.errors.join(', ')}`;
      setUserErrorMessage(errorMsg);
      setShowUserError(true);
      return;
    }

    // Additional validation for required fields
    if (!config?.charset) {
      setUserErrorMessage('Character set is required');
      setShowUserError(true);
      return;
    }

    if (!config?.language) {
      setUserErrorMessage('Processing language is required');
      setShowUserError(true);
      return;
    }

    if (!config?.modelSettings?.whisperModel) {
      setUserErrorMessage('Whisper model is required');
      setShowUserError(true);
      return;
    }

    try {
      // Clear subtitle store to prepare for new transcription results
      clearWorkspace();

      // IMPORTANT: Mark config as complete first, then set processing step to ready
      // Navigation permissions are calculated based on current step states
      await setStepState('config', StepStatus.COMPLETE);
      await setStepState('processing', StepStatus.READY);

      // Navigate to processing step - now it should be accessible
      await workflowActions.navigateToStep('processing');

      // Now start the actual processing
      // Convert step config to ProcessingConfig format using context bridge API
      const conversionResult = await window.cantocapAPI.processingConvertConfig({
        inputStep,
        configStep: config,
      });

      if (!conversionResult.success || !conversionResult.config) {
        throw new Error(conversionResult.error || 'Failed to convert configuration');
      }

      // Get processing time estimate and show to user
      try {
        const estimateResult = await window.cantocapAPI.processingGetTimeEstimate(
          conversionResult.config
        );

        if (estimateResult.success && estimateResult.estimate) {
          const { estimate } = estimateResult;
          const durationText = estimate.basedOnDuration
            ? `Based on media duration, estimated processing time: ${estimate.estimatedProcessingDisplay}`
            : `Estimated processing time: ${estimate.estimatedProcessingDisplay} (timeout: ${estimate.timeoutDisplay})`;
          logger.debug('Processing estimate:', { durationText });
        }
      } catch (estimateError) {
        logger.warn('Failed to get processing estimate:', { error: estimateError });
        // Continue without estimate - not critical
      }

      // Update the processing store to 'running' state BEFORE starting the IPC call
      startProcessing({
        currentPhase: 'initializing',
        logs: ['Starting transcription process...'],
      });

      // Start the actual transcription process using context bridge API
      const startResult = await window.cantocapAPI.processingStart(conversionResult.config);

      if (!startResult.success) {
        // If backend start failed, reset processing state back to idle
        startProcessing({ status: 'idle', logs: ['Failed to start processing'] });
        throw new Error(startResult.error || 'Failed to start transcription process');
      }
    } catch (error) {
      logger.error('Failed to start transcription workflow:', { error });

      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setUserErrorMessage(`Failed to start transcription: ${errorMessage}`);
      setShowUserError(true);

      // Reset workflow states back to config if there was an error
      try {
        await setStepState('config', StepStatus.READY);
        await setStepState('processing', StepStatus.ERROR);
        await workflowActions.navigateToStep('config');
      } catch (navError) {
        logger.error('Failed to reset workflow states:', { error: navError });
      }
    }
  }, [
    activeWorkspaceId,
    inputStep,
    config,
    clearWorkspace,
    setStepState,
    workflowActions,
    startProcessing,
    processing.status,
    logger,
  ]);

  // Check if we can start transcription - comprehensive validation
  // Step 2 should validate all its configuration requirements
  const canStartTranscription = useMemo(() => {
    const inputFile = inputStep?.inputFile || inputStep?.selectedFile;
    const huggingFaceKey = config?.apiKeys?.huggingface;

    // Basic requirements
    if (!inputFile || !activeWorkspaceId || !huggingFaceKey) {
      return false;
    }

    // Prevent concurrent processing sessions
    if (processing.status === 'running') {
      return false;
    }

    // Use existing validation logic
    const validationResult = validateConfiguration(config);
    if (!validationResult.isValid) {
      return false;
    }

    // Check required configuration fields
    if (!config?.charset || !config?.language || !config?.modelSettings?.whisperModel) {
      return false;
    }

    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputStep?.inputFile,
    inputStep?.selectedFile,
    activeWorkspaceId,
    config?.apiKeys?.huggingface,
    config?.charset,
    config?.language,
    config?.modelSettings?.whisperModel,
    processing.status,
    validation.isValid,
  ]);

  // Get validation status for user feedback
  const getValidationStatus = () => {
    const inputFile = inputStep?.inputFile || inputStep?.selectedFile;
    const huggingFaceKey = config?.apiKeys?.huggingface;

    const issues = [];

    if (!inputFile) {
      issues.push('No input file selected');
    }

    if (!activeWorkspaceId) {
      issues.push('No workspace selected');
    }

    if (!huggingFaceKey) {
      issues.push('Hugging Face API key is required');
    }

    if (processing.status === 'running') {
      issues.push('Processing is already running');
    }

    if (!config?.charset) {
      issues.push('Character set not selected');
    }

    if (!config?.language) {
      issues.push('Processing language not selected');
    }

    if (!config?.modelSettings?.whisperModel) {
      issues.push('Whisper model not selected');
    }

    // Add validation errors from the validateConfiguration function
    if (!validation.isValid) {
      issues.push(...validation.errors);
    }

    return {
      isReady: issues.length === 0,
      issues: issues,
    };
  };

  const validationStatus = getValidationStatus();

  return (
    isReady && (
      <ConfigUpdateContext.Provider
        value={{
          updateConfig: updateConfigWithValidation,
          config,
          isValid: validation.isValid,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Main Configuration - Scrollable */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 3,
              pr: 2,
            }}
          >
            {/* Configuration Error State */}
            {error && (
              <Alert severity='error' sx={{ mb: 2 }} onClose={() => clearError()}>
                Failed to load configuration: {error}
              </Alert>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert severity='warning' sx={{ mb: 2 }}>
                <Typography variant='body2' sx={{ mb: 1, fontWeight: 600 }}>
                  Configuration Issues:
                </Typography>
                <Box component='ul' sx={{ m: 0, pl: 2 }}>
                  {validationErrors.map((error, index) => (
                    <Box component='li' key={index} sx={{ fontSize: '0.875rem' }}>
                      {error}
                    </Box>
                  ))}
                </Box>
              </Alert>
            )}

            <Box sx={{ mb: 4 }}>
              <Typography
                variant='h5'
                sx={{
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  fontWeight: 700,
                }}
              >
                <SettingsIcon color='primary' />
                Transcription Configuration
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Configure your subtitle generation settings for optimal results
              </Typography>
            </Box>

            <Stack spacing={3}>
              <ConfigSection
                title='Output Settings'
                icon={<Box sx={{ fontSize: '1.25rem' }}>📁</Box>}
                important={true}
              >
                <OutputLocationSelector />
              </ConfigSection>

              <ConfigSection
                title='Language & Format'
                icon={<Box sx={{ fontSize: '1.25rem' }}>🌐</Box>}
              >
                <Stack spacing={3}>
                  <CharsetSelector />
                  <TranslationSelector />
                </Stack>
              </ConfigSection>

              <ConfigSection
                title='Processing Options'
                icon={<Box sx={{ fontSize: '1.25rem' }}>⚙️</Box>}
              >
                <QuickOptionsSelector />
              </ConfigSection>

              <ConfigSection
                title='Keys Management'
                icon={<Box sx={{ fontSize: '1.25rem' }}>🔑</Box>}
                important={true}
              >
                <APIKeyInput />
              </ConfigSection>

              <AdvancedPanel />
            </Stack>

            {/* Bottom padding for better scrolling */}
            <Box sx={{ height: 24 }} />
          </Box>

          {/* Actions and Configuration Preview - Scrollable */}
          <Box
            sx={{
              width: 450,
              minWidth: 450,
              maxWidth: 450,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              p: 4,
              pl: 3,
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              overflow: 'auto',
            }}
          >
            {/* Validation Status */}
            {!validationStatus.isReady && (
              <Alert severity='warning' sx={{ mb: 2 }}>
                <Typography variant='body2' sx={{ mb: 1, fontWeight: 600 }}>
                  Cannot Generate Subtitles:
                </Typography>
                <Box component='ul' sx={{ m: 0, pl: 2 }}>
                  {validationStatus.issues.slice(0, 3).map((issue, index) => (
                    <Box component='li' key={index} sx={{ fontSize: '0.875rem' }}>
                      {issue}
                    </Box>
                  ))}
                  {validationStatus.issues.length > 3 && (
                    <Box
                      component='li'
                      sx={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'text.secondary' }}
                    >
                      ...and {validationStatus.issues.length - 3} more issue
                      {validationStatus.issues.length - 3 > 1 ? 's' : ''}
                    </Box>
                  )}
                </Box>
              </Alert>
            )}

            {/* Generate Subtitles Button */}
            <Button
              variant='contained'
              color='primary'
              size='large'
              fullWidth
              onClick={handleStartTranscription}
              disabled={!canStartTranscription}
              startIcon={<PlayIcon />}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                background: canStartTranscription
                  ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                  : 'rgba(245, 158, 11, 0.3)',
                '&:hover': {
                  background: canStartTranscription
                    ? 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
                    : 'rgba(245, 158, 11, 0.3)',
                  transform: canStartTranscription ? 'translateY(-2px)' : 'none',
                  boxShadow: canStartTranscription ? '0 8px 25px rgba(245, 158, 11, 0.4)' : 'none',
                },
                '&:disabled': {
                  color: 'rgba(255, 255, 255, 0.5)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Generate Subtitles
            </Button>

            <ConfigPreview />
          </Box>
        </Box>

        {/* Error Notification */}
        <Snackbar
          open={showErrorNotification}
          autoHideDuration={6000}
          onClose={() => {
            setShowErrorNotification(false);
            clearError();
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => {
              setShowErrorNotification(false);
              clearError();
            }}
            severity='error'
            variant='filled'
          >
            {error || 'Failed to save configuration'}
          </Alert>
        </Snackbar>

        {/* User Error Notification */}
        <Snackbar
          open={showUserError}
          autoHideDuration={6000}
          onClose={() => {
            setShowUserError(false);
            setUserErrorMessage('');
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => {
              setShowUserError(false);
              setUserErrorMessage('');
            }}
            severity='error'
            variant='filled'
          >
            {userErrorMessage}
          </Alert>
        </Snackbar>
      </ConfigUpdateContext.Provider>
    )
  );
};
