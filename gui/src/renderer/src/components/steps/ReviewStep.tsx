import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Alert, AlertTitle, Button, Stack } from '@mui/material';
import { useActiveWorkspaceId } from '../../stores/useAppStore';
import {
  useInputFile,
  useSubtitles,
  useInputStepContent,
  useStepActions,
} from '../../stores/useStepStore';
import {
  useSubtitleWorkspace,
  useSubtitleActions,
  useSubtitleEditStore,
} from '../../stores/useSubtitleEditStore';
import { useStepState, useWorkflowActions } from '../../stores/useWorkflowStore';
import {
  useProcessingJsonData,
  useProcessingOriginalJsonData,
  useProcessingStatus,
} from '../../stores/steps/useProcessingStepStore';
import { StepStatus, Subtitle } from '../../stores/types/StoreTypes';
import { VideoPreviewSection } from './ReviewStep/VideoPreviewSection';
import { SubtitleEditor } from './ReviewStep/SubtitleEditor';
import { SubtitleListPanel } from './ReviewStep/SubtitleListPanel';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ElectronWindow } from '@/types';
import { createComponentLogger } from '../../utils/logger';

const ReviewStepComponent: React.FC = () => {
  const logger = createComponentLogger('ReviewStep');
  const { workspaceId: currentWorkspaceId } = useSubtitleWorkspace();
  const activeWorkspaceId = useActiveWorkspaceId();
  const { loadSubtitlesForWorkspace, clearWorkspace, importFromJson, exportToStep } =
    useSubtitleActions();
  const { setStepState, navigateToStep } = useWorkflowActions();
  const { updateStepContent } = useStepActions();
  const inputFile = useInputFile();
  const stepSubtitles = useSubtitles();
  const inputStepContent = useInputStepContent();
  const reviewStepState = useStepState('review');

  // Processing data for automatic import and restore functionality
  const processingJsonData = useProcessingJsonData();
  const processingOriginalJsonData = useProcessingOriginalJsonData();
  const processingStatus = useProcessingStatus();

  // Centralized subtitle source logic
  const getSubtitlesForReview = useCallback((): Subtitle[] => {
    logger.debug('getSubtitlesForReview: Checking all subtitle sources', {
      stepSubtitlesCount: stepSubtitles?.length || 0,
      hasInputStepContent: !!inputStepContent,
      importedSubtitlesCount: inputStepContent?.importedSubtitles?.length || 0,
      importedJsonFile: inputStepContent?.importedJsonFile,
      processingStatus,
      hasProcessingJsonData: !!processingJsonData,
      hasProcessingOriginalJsonData: !!processingOriginalJsonData
    });

    // Priority 1: Step subtitles (already loaded in review/edit store)
    if (stepSubtitles && stepSubtitles.length > 0) {
      logger.info('getSubtitlesForReview: Using step subtitles', { count: stepSubtitles.length });
      return stepSubtitles;
    }

    // Priority 2: Imported subtitles from Step 1 (already parsed and converted)
    if (inputStepContent?.importedSubtitles && inputStepContent.importedSubtitles.length > 0) {
      logger.info('getSubtitlesForReview: Using imported subtitles from Step 1', { 
        count: inputStepContent.importedSubtitles.length,
        filePath: inputStepContent.importedJsonFile
      });
      return inputStepContent.importedSubtitles;
    }

    // Priority 3: Processing subtitles from Step 3 (needs conversion)
    if (processingStatus === 'completed') {
      const processingData = processingOriginalJsonData || processingJsonData;
      if (processingData) {
        logger.info('getSubtitlesForReview: Using processing subtitles from Step 3');
        // Use centralized converter to handle CantoCap format
        const { convertToStandardSubtitles } = require('../../utils/subtitleConverter');
        return convertToStandardSubtitles(processingData);
      }
    }

    logger.warn('getSubtitlesForReview: No subtitle data available from any source');
    return [];
  }, [stepSubtitles, inputStepContent?.importedSubtitles, processingStatus, processingOriginalJsonData, processingJsonData, logger]);

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidationRun, setHasValidationRun] = useState(false);

  // Ref to track processed JSON imports to prevent infinite loops
  const processedJsonImportRef = useRef<string | null>(null);
  const hasProcessedJsonData = useRef<boolean>(false);

  // Validation functions
  const validateMediaFile = useCallback(
    async (inputFile: string | null): Promise<{ valid: boolean; error?: string }> => {
      if (!inputFile) {
        return {
          valid: false,
          error:
            'No media file selected in Step 1. Please return to Step 1 and select a video/audio file.',
        };
      }

      try {
        // Use the existing video metadata API to validate file existence for video files
        const ext = inputFile.split('.').pop()?.toLowerCase();
        const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];

        if (videoExts.includes(ext || '')) {
          // For video files, try to get metadata - this will fail if file doesn't exist
          const result = await (window as unknown as ElectronWindow).cantocapAPI.getVideoMetadata(
            inputFile
          );
          if (result.error) {
            return {
              valid: false,
              error: `Video file is not accessible or has been moved: ${inputFile}. Please return to Step 1 and select the file again.`,
            };
          }
        } else {
          // For audio files, we'll use a more basic validation approach
          // Since there's no direct file existence check, we'll assume the file exists
          // This is a limitation but better than breaking the workflow
          logger.info('Audio file validation - assuming file exists (no direct API available)');
        }

        return { valid: true };
      } catch (error) {
        logger.error('Error validating media file', { error });
        return {
          valid: false,
          error: 'Unable to verify media file existence. Please ensure the file is accessible.',
        };
      }
    },
    [logger]
  );

  // Type guard for subtitle validation
  // Validation for model-generated subtitles (from processing step)
  const isValidModelSubtitle = useCallback(
    (
      sub: unknown
    ): sub is { startTime: number; endTime: number; text?: string; caption?: string } => {
      if (sub === null || typeof sub !== 'object') {
        return false;
      }
      const subtitle = sub as Record<string, unknown>;
      return (
        typeof subtitle.startTime === 'number' &&
        typeof subtitle.endTime === 'number' &&
        (typeof subtitle.text === 'string' || typeof subtitle.caption === 'string') &&
        subtitle.startTime < subtitle.endTime
      );
    },
    [logger]
  );

  // Validation for user-imported JSON subtitles (from step 1)
  const isValidImportedSubtitle = useCallback(
    (
      sub: unknown
    ): sub is { startTime: number; endTime: number; text?: string; caption?: string } => {
      if (sub === null || typeof sub !== 'object') {
        return false;
      }
      const subtitle = sub as Record<string, unknown>;

      // More flexible validation for imported JSON - accept different field names
      const startTime =
        typeof subtitle.startTime === 'number'
          ? subtitle.startTime
          : typeof subtitle.start === 'number'
            ? subtitle.start
            : null;
      const endTime =
        typeof subtitle.endTime === 'number'
          ? subtitle.endTime
          : typeof subtitle.end === 'number'
            ? subtitle.end
            : null;

      // Accept various text field names from different export formats
      const hasText =
        typeof subtitle.text === 'string' ||
        typeof subtitle.caption === 'string' ||
        typeof subtitle.content === 'string';

      return startTime !== null && endTime !== null && hasText && startTime < endTime;
    },
    [logger]
  );

  const validateJsonData = useCallback(
    (
      importedJsonFile: string | null,
      stepSubtitles: unknown[]
    ): { valid: boolean; error?: string } => {
      logger.debug('JSON validation started', { 
        importedJsonFile, 
        stepSubtitlesCount: Array.isArray(stepSubtitles) ? stepSubtitles.length : 'not array' 
      });

      // Only validate if this is a JSON import workflow (indicated by importedJsonFile)
      if (importedJsonFile) {
        logger.debug('JSON import detected, validating subtitle data');

        if (!stepSubtitles || !Array.isArray(stepSubtitles)) {
          logger.warn('Subtitles is not an array', { stepSubtitlesType: typeof stepSubtitles });
          return {
            valid: false,
            error:
              'No subtitle data found from the imported JSON file. The JSON import may have failed or the file may be corrupted. Please return to Step 1 and re-import your JSON caption file.',
          };
        }

        if (stepSubtitles.length === 0) {
          logger.warn('Subtitles array is empty');
          return {
            valid: false,
            error:
              "No subtitle data found after JSON import. This could indicate:\n\n• JSON import succeeded but subtitles aren't being loaded into the review step\n• The JSON structure wasn't recognized by the import process\n• There's a sync issue between import and review steps\n\nTry:\n1. Re-importing the JSON file from Step 1\n2. Check that your JSON has a 'subtitles' array with valid entries\n3. Each subtitle should have 'startTime', 'endTime', and 'caption'/'text' properties",
          };
        }

        // Additional validation for subtitle content - use appropriate validator
        // Determine if this is imported JSON (step 1) or model-generated (processing step)
        const isImportedData = !!importedJsonFile;
        const validator = isImportedData ? isValidImportedSubtitle : isValidModelSubtitle;
        const validSubtitles = stepSubtitles.filter(validator);
        logger.debug('Subtitle validation results', {
          type: isImportedData ? 'imported' : 'model-generated',
          validSubtitles: validSubtitles.length,
          totalSubtitles: stepSubtitles.length
        });

        // Log some sample subtitles for debugging
        if (stepSubtitles.length > 0 && validSubtitles.length === 0) {
          logger.debug('Sample subtitle for debugging', { sampleSubtitle: stepSubtitles[0] });

          // Debug first subtitle structure
          const firstSub = stepSubtitles[0] as Record<string, unknown>;
          logger.debug('First subtitle structure analysis', {
            hasStartTime: typeof firstSub?.startTime === 'number',
            hasEndTime: typeof firstSub?.endTime === 'number',
            hasText: typeof firstSub?.text === 'string',
            hasCaption: typeof firstSub?.caption === 'string',
            hasContent: typeof firstSub?.content === 'string',
            startTimeValue: firstSub?.startTime,
            endTimeValue: firstSub?.endTime,
          });
        }

        // Be more lenient - allow if at least some subtitles are valid or if we have any subtitles at all
        if (validSubtitles.length === 0 && stepSubtitles.length > 0) {
          // Check if subtitles have basic structure even if they don't pass strict validation
          const hasBasicStructure = stepSubtitles.some(
            (sub) =>
              sub &&
              typeof sub === 'object' &&
              (typeof (sub as Record<string, unknown>).startTime === 'number' ||
                typeof (sub as Record<string, unknown>).start === 'number') &&
              (typeof (sub as Record<string, unknown>).endTime === 'number' ||
                typeof (sub as Record<string, unknown>).end === 'number')
          );

          if (hasBasicStructure) {
            logger.debug('Subtitles have basic timing structure but may need normalization');
            return { valid: true }; // Allow it through - subtitle processing can handle normalization
          }

          return {
            valid: false,
            error:
              'The imported JSON contains subtitle data but in an unexpected format. Please check your JSON file format and re-import.',
          };
        }

        // If we have at least 50% valid subtitles, consider it acceptable
        const validityRatio =
          stepSubtitles.length > 0 ? validSubtitles.length / stepSubtitles.length : 0;
        if (validityRatio < 0.5 && stepSubtitles.length > 10) {
          logger.warn('Low subtitle validity ratio', { validityRatio });
          return {
            valid: false,
            error: `Only ${validSubtitles.length} of ${stepSubtitles.length} subtitles from the JSON are in valid format. Please check your JSON file format.`,
          };
        }

        logger.debug('JSON validation passed');
      } else {
        logger.debug('No JSON import detected, skipping JSON validation');
      }

      return { valid: true };
    },
    [isValidModelSubtitle, isValidImportedSubtitle, logger]
  );

  // Effect to automatically import JSON data from processing step
  // FIXED: Removed editStoreSubtitles from dependency to prevent infinite loop
  useEffect(() => {
    const importJsonFromProcessing = async () => {
      logger.debug('ReviewStep: Checking processing data on load/change', {
        processingStatus,
        hasJsonData: !!processingJsonData,
        hasOriginalJsonData: !!processingOriginalJsonData,
        hasProcessedJson: hasProcessedJsonData.current,
        activeWorkspaceId,
        subtitlesFromProcessing: processingJsonData?.subtitles?.length || 0,
        subtitlesFromOriginal: processingOriginalJsonData?.subtitles?.length || 0,
        stepSubtitlesCount: stepSubtitles?.length || 0,
      });

      // ENHANCED: Try to import from processing step data (including after app reload)
      if (processingStatus === 'completed' && activeWorkspaceId) {
        // Prefer originalJsonData if available (for fresh imports), fallback to jsonSubtitleData
        const jsonDataToImport = processingOriginalJsonData || processingJsonData;

        // FIXED: Better detection for when to import data
        // Check if we have processing data but no step subtitles (app reload scenario)
        const shouldImportFromProcessing =
          jsonDataToImport &&
          (!stepSubtitles || stepSubtitles.length === 0 || !hasProcessedJsonData.current);

        if (shouldImportFromProcessing) {
          logger.info('ReviewStep: Processing completed with JSON data, importing into review step');
          logger.debug('JSON data source', {
            source: processingOriginalJsonData ? 'originalJsonData' : 'jsonSubtitleData',
          });
          logger.debug('Subtitles to import', {
            count: jsonDataToImport?.subtitles?.length || 0,
          });
          logger.debug('Import reason analysis', {
            stepSubtitlesEmpty: !stepSubtitles || stepSubtitles.length === 0,
            hasProcessed: hasProcessedJsonData.current,
          });

          try {
            // Mark as processed to prevent duplicate imports
            hasProcessedJsonData.current = true;

            // Import the JSON data into the subtitle editing store
            // Extract subtitles array from the JSON data structure
            const subtitlesArray = jsonDataToImport?.subtitles || [];
            await importFromJson(activeWorkspaceId, inputFile || '', subtitlesArray);

            // CRITICAL: Sync the imported processing data to step store for persistence
            // This ensures the data is available after app reload (similar to step 1 JSON import)
            await exportToStep();
            logger.debug('ReviewStep: Successfully synced processing data to step store for persistence');

            logger.info('ReviewStep: Successfully imported JSON data from processing step');

            // Clear any previous validation errors since we have new data
            setValidationError(null);
            setHasValidationRun(false);
          } catch (error) {
            logger.error('ReviewStep: Failed to import JSON data from processing step', { error });
            hasProcessedJsonData.current = false; // Allow retry
            setValidationError(
              'Failed to import generated subtitles. Please try navigating to Step 4 again.'
            );
          }
        } else if (!jsonDataToImport) {
          logger.warn('ReviewStep: Processing completed but no JSON data found');
          // Try to load from step subtitles if available
          if (stepSubtitles && stepSubtitles.length > 0) {
            logger.debug('ReviewStep: Found step subtitles, loading those instead', {
              stepSubtitlesCount: stepSubtitles.length
            });
          }
        } else {
          logger.debug('ReviewStep: Processing data available but already imported or step subtitles exist');
        }
      } else if (processingStatus !== 'completed') {
        logger.debug('ReviewStep: Processing not completed yet', { status: processingStatus });
      }
    };

    importJsonFromProcessing();
  }, [
    processingStatus,
    processingJsonData,
    processingOriginalJsonData,
    activeWorkspaceId,
    importFromJson,
    exportToStep,
    updateStepContent,
    inputFile,
    stepSubtitles,
    logger,
  ]);

  // Main validation effect
  useEffect(() => {
    const performValidation = async () => {
      // Create a unique validation key based on current data
      const validationKey = `${inputFile}-${stepSubtitles?.length}-${inputStepContent?.importedJsonFile}`;

      // Skip validation if already running, in blocked/error state, or if we've already validated this data
      if (
        isValidating ||
        reviewStepState === StepStatus.BLOCK ||
        reviewStepState === StepStatus.SKIP ||
        (reviewStepState === StepStatus.ERROR && hasValidationRun)
      ) {
        logger.debug('Skipping validation', {
          state: reviewStepState,
          isValidating,
          hasRun: hasValidationRun
        });
        return;
      }

      logger.info('Starting Review Step validation', { validationKey, reviewStepState });
      setIsValidating(true);
      setValidationError(null);

      try {
        // Validate media file presence
        logger.debug('Validating media file', { inputFile });
        const mediaValidation = await validateMediaFile(inputFile ?? null);
        if (!mediaValidation.valid) {
          logger.warn('Media validation failed', { error: mediaValidation.error });
          setValidationError(mediaValidation.error || 'Media file validation failed');
          setHasValidationRun(true);
          await setStepState('review', StepStatus.ERROR);
          return;
        }

        // Validate JSON data integrity (only if JSON was imported)
        logger.debug('Validating JSON data', {
          importedFile: inputStepContent?.importedJsonFile,
          subtitlesCount: stepSubtitles?.length
        });

        // Use centralized subtitle source logic
        const availableSubtitles = getSubtitlesForReview();
        
        if (availableSubtitles.length === 0) {
          logger.warn('No subtitle data available from any source');
          setValidationError(
            'No subtitle data found. Please either:\n\n' +
            '• Import subtitles from Step 1 (JSON file)\n' +
            '• Complete processing in Step 3 to generate subtitles\n' +
            '• Check that your imported JSON file contains valid subtitle data'
          );
          setHasValidationRun(true);
          await setStepState('review', StepStatus.ERROR);
          return;
        }

        logger.info('Found subtitles for review', { count: availableSubtitles.length });

        // If we have subtitles but they're not in the step store, load them
        if (!stepSubtitles || stepSubtitles.length === 0) {
          logger.info('Loading subtitles into review step store');
          try {
            await updateStepContent('review', { subtitles: availableSubtitles });
          } catch (updateError) {
            logger.warn('Failed to update step store with subtitles', { error: updateError });
          }
        }

        // If we reach here, validation passed
        logger.info('Review Step validation passed');

        // Clear any previous validation errors
        setValidationError(null);
        setHasValidationRun(true);
      } catch (error) {
        logger.error('Validation error', { error });
        setValidationError('Unexpected error during validation. Please try again.');
        setHasValidationRun(true);
        await setStepState('review', StepStatus.ERROR);
      } finally {
        setIsValidating(false);
      }
    };

    // Only run validation when data actually changes
    performValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputFile,
    stepSubtitles,
    inputStepContent?.importedJsonFile,
    processingStatus,
    processingJsonData,
    processingOriginalJsonData,
    reviewStepState, // Add this back but with proper loop protection
  ]);

  // Recovery actions
  const handleReturnToStep1 = useCallback(async () => {
    try {
      // Clear validation error and reset step state before navigation
      setValidationError(null);
      setIsValidating(false);
      setHasValidationRun(false); // Reset validation flag
      await navigateToStep('input');
    } catch (error) {
      logger.error('Failed to navigate to Step 1', { error });
    }
  }, [navigateToStep, logger]);

  const handleReimportJson = useCallback(async () => {
    // Navigate back to step 1 where user can re-import JSON
    await handleReturnToStep1();
  }, [handleReturnToStep1]);

  // Add a manual retry function for debugging
  const handleRetryValidation = useCallback(async () => {
    logger.debug('Manual retry validation requested');
    setValidationError(null);
    setIsValidating(false);
    setHasValidationRun(false); // Reset validation flag

    // Reset step state to trigger re-validation
    await setStepState('review', StepStatus.READY);
  }, [setStepState, logger]);

  // NEW: Restore functionality for returning to original processed JSON
  const handleRestoreOriginal = useCallback(async () => {
    if (!processingOriginalJsonData || !activeWorkspaceId) {
      logger.warn('Cannot restore: missing original data or workspace ID');
      return;
    }

    try {
      logger.info('Restoring original JSON data from processing step');

      // Use the new restore method specifically designed for processing step data
      const subtitlesArray = processingOriginalJsonData?.subtitles || [];
      await useSubtitleEditStore
        .getState()
        .actions.restoreFromProcessingOriginal(activeWorkspaceId, inputFile || '', subtitlesArray);

      logger.info('Successfully restored original JSON data');

      // Clear validation errors since we have fresh original data
      setValidationError(null);
      setHasValidationRun(false);
    } catch (error) {
      logger.error('Failed to restore original JSON data', { error });
      setValidationError('Failed to restore original data. Please try again.');
    }
  }, [processingOriginalJsonData, activeWorkspaceId, inputFile, logger]);

  // Check if current data differs from original (for showing restore button)
  const hasDataChanged = useCallback(() => {
    if (!processingOriginalJsonData || !stepSubtitles) {
      return false;
    }

    const originalSubtitles = processingOriginalJsonData.subtitles || [];

    // Simple comparison - check if lengths differ or content differs
    if (originalSubtitles.length !== stepSubtitles.length) {
      return true;
    }

    // Check if any subtitle text has changed
    for (let i = 0; i < originalSubtitles.length; i++) {
      const original = originalSubtitles[i];
      const current = stepSubtitles[i];

      if (
        original.caption !== current.text ||
        original.startTime !== current.startTime ||
        original.endTime !== current.endTime
      ) {
        return true;
      }
    }

    return false;
  }, [processingOriginalJsonData, stepSubtitles]);

  // Reset processed JSON tracking when workspace changes or JSON import is removed
  useEffect(() => {
    if (!inputStepContent?.importedJsonFile) {
      processedJsonImportRef.current = null;
    }

    // FIXED: Reset processed JSON flag when workspace changes to allow proper reload
    // This ensures that after app reload, we can properly detect and import processing data
    logger.debug('ReviewStep: Workspace changed, resetting processed JSON flag for proper reload handling');
    hasProcessedJsonData.current = false;
  }, [currentWorkspaceId, activeWorkspaceId, inputStepContent?.importedJsonFile, logger]);

  // Initialize subtitles when workspace or step subtitles change
  useEffect(() => {
    const initializeSubtitles = async () => {
      const workspaceId = currentWorkspaceId || activeWorkspaceId;
      logger.debug('ReviewStep: Initializing subtitles for workspace', {
        workspaceId,
        stepSubtitlesCount: stepSubtitles?.length || 0,
        hasProcessingJsonData: !!processingJsonData,
        hasProcessingOriginalJsonData: !!processingOriginalJsonData,
        processingStatus,
        hasProcessedJsonFlag: hasProcessedJsonData.current,
      });

      // ENHANCED: Try multiple sources for subtitle data
      if (workspaceId) {
        let subtitlesToLoad: Subtitle[] = [];
        let dataSource = 'none';

        // Priority 1: Use step subtitles if available
        if (stepSubtitles && Array.isArray(stepSubtitles) && stepSubtitles.length > 0) {
          subtitlesToLoad = stepSubtitles;
          dataSource = 'stepSubtitles';
        }
        // Priority 2: If no step subtitles but have processing data, try to import from there
        // FIXED: Better app reload detection - reset the hasProcessedJsonData flag when appropriate
        else if (
          processingStatus === 'completed' &&
          (processingOriginalJsonData || processingJsonData)
        ) {
          const jsonDataToImport = processingOriginalJsonData || processingJsonData;

          // ENHANCED: After app reload, if we have processing data but no step subtitles,
          // we should try to import again even if the flag says it's processed
          const shouldAttemptImport =
            jsonDataToImport &&
            jsonDataToImport.subtitles &&
            jsonDataToImport.subtitles.length > 0 &&
            (!hasProcessedJsonData.current || stepSubtitles?.length === 0);

          if (shouldAttemptImport) {
            logger.debug('ReviewStep: No step subtitles, importing from processing JSON data');
            logger.debug('Processing data available', {
              subtitlesCount: jsonDataToImport?.subtitles?.length
            });
            try {
              hasProcessedJsonData.current = true;
              const subtitlesArray = jsonDataToImport?.subtitles || [];
              await importFromJson(workspaceId, inputFile || '', subtitlesArray);

              // CRITICAL: Sync the imported processing data to step store for persistence
              await exportToStep();
              logger.debug('ReviewStep: Successfully synced fallback processing data to step store');

              // CRITICAL: Also update the review step content directly
              // Use the imported subtitles directly instead of accessing edit store to prevent loops
              const { useSubtitleEditStore } = await import('../../stores/useSubtitleEditStore');
              const currentSubtitles = useSubtitleEditStore.getState().subtitles;
              await updateStepContent('review', { subtitles: currentSubtitles });
              logger.debug('ReviewStep: Updated review step content with processed subtitles (fallback)');

              logger.info('ReviewStep: Successfully imported processing data as fallback');
              return; // Exit early since importFromJson handles everything
            } catch (error) {
              logger.error('ReviewStep: Fallback import failed', { error });
              hasProcessedJsonData.current = false;
            }
          }
        }

        if (subtitlesToLoad.length > 0) {
          logger.debug('ReviewStep: Loading subtitles from source', {
            dataSource,
            count: subtitlesToLoad.length
          });
          const videoPath = inputFile || '';

          // Transform step store subtitles to subtitle edit store format
          const transformedSubtitles = subtitlesToLoad.map((sub, index) => ({
            ...sub,
            index: index + 1,
            duration: sub.endTime - sub.startTime,
            // CRITICAL: Preserve translation field for proper diff comparison
            // Don't override translation with undefined - keep original value
          }));

          // CRITICAL FIX: Force reload when JSON was imported to ensure fresh baseline
          // This prevents loading old originalSubtitles from persisted workspace data
          const hasJsonImport = !!inputStepContent?.importedJsonFile;
          const currentJsonFile = inputStepContent?.importedJsonFile;
          const forceReload = hasJsonImport && processedJsonImportRef.current !== currentJsonFile;

          if (forceReload && currentJsonFile) {
            logger.debug('Forcing subtitle workspace reload for JSON import - resetting diff baseline');
            logger.debug('Processing new JSON import', { jsonFile: currentJsonFile });
            // For force reload, clear workspace and initialize fresh
            await clearWorkspace();
            // Mark this JSON file as processed to prevent infinite loop
            processedJsonImportRef.current = currentJsonFile;

            // CRITICAL: Use importFromJson to establish proper original baseline for diff
            // This ensures the imported JSON data becomes the "original" for comparison
            try {
              await importFromJson(workspaceId, videoPath, transformedSubtitles);
              logger.debug('JSON import processed with fresh baseline for diff comparison');
            } catch (error) {
              logger.error('Failed to import JSON data for diff baseline', { error });
              // Fallback to regular load if import fails
              loadSubtitlesForWorkspace(workspaceId, videoPath, transformedSubtitles);
            }
            return;
          } else if (hasJsonImport) {
            logger.debug('JSON import already processed', { jsonFile: currentJsonFile });
            // CRITICAL FIX: For processed JSON imports, only force reload for truly fresh processing data
            // Check if processing JUST completed (not from app reload) by verifying it hasn't been processed yet
            const jsonDataToImport = processingOriginalJsonData || processingJsonData;
            const hasFreshProcessingForJson =
              processingStatus === 'completed' && jsonDataToImport && !hasProcessedJsonData.current;

            logger.debug('Loading workspace data for processed JSON import', {
              hasFreshProcessingData: hasFreshProcessingForJson,
              forceReload: hasFreshProcessingForJson,
              processingStatus,
              hasProcessedJsonData: hasProcessedJsonData.current,
            });

            loadSubtitlesForWorkspace(workspaceId, videoPath, transformedSubtitles);
            return;
          }
          // CRITICAL FIX: For non-JSON imports, only force reload for truly fresh processing data
          // Check if processing JUST completed (not from app reload) by verifying it hasn't been processed yet
          const jsonDataToImport = processingOriginalJsonData || processingJsonData;
          const hasFreshProcessingForNonJson =
            processingStatus === 'completed' && jsonDataToImport && !hasProcessedJsonData.current;

          logger.debug('Loading subtitles for workspace', {
            hasFreshProcessingData: hasFreshProcessingForNonJson,
            forceReload: hasFreshProcessingForNonJson,
            processingStatus,
            hasProcessedJsonData: hasProcessedJsonData.current,
          });

          loadSubtitlesForWorkspace(workspaceId, videoPath, transformedSubtitles);
        } else {
          logger.warn('ReviewStep: No subtitle data available from any source');
        }
      }
    };

    initializeSubtitles();
  }, [
    currentWorkspaceId,
    activeWorkspaceId,
    stepSubtitles,
    inputFile,
    loadSubtitlesForWorkspace,
    inputStepContent?.importedJsonFile,
    clearWorkspace,
    importFromJson,
    exportToStep,
    updateStepContent,
    processingJsonData,
    processingOriginalJsonData,
    processingStatus,
    logger,
  ]);

  // Handle SKIP state - show disabled interface
  if (reviewStepState === StepStatus.SKIP) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#36393f',
          borderRadius: 2,
          p: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Alert
          severity='info'
          sx={{
            maxWidth: 500,
            '.MuiAlert-message': {
              textAlign: 'center',
            },
          }}
        >
          <Typography variant='h6' sx={{ mb: 1 }}>
            Review Step Skipped
          </Typography>
          <Typography variant='body2'>
            This step has been marked as skipped in the workflow. You can still access it through
            the step navigation if needed.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Check if step is in a problematic state where interaction should be limited
  const isStepDisabled =
    reviewStepState === StepStatus.BLOCK || reviewStepState === StepStatus.ERROR;
  const hasValidationError = validationError !== null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#36393f',
        borderRadius: 2,
        p: 2,
        gap: 2,
        opacity: isStepDisabled || hasValidationError ? 0.6 : 1,
        pointerEvents: isStepDisabled || hasValidationError ? 'none' : 'auto',
      }}
    >
      {/* Original Data Available & Modified Indicator */}
      {processingOriginalJsonData && hasDataChanged() && !hasValidationError && (
        <Alert
          severity='info'
          sx={{
            mb: 2,
            pointerEvents: 'auto !important',
            position: 'relative',
            zIndex: 1,
          }}
          action={
            <Button
              size='small'
              variant='outlined'
              onClick={handleRestoreOriginal}
              sx={{ fontSize: '0.75rem' }}
            >
              Restore Original
            </Button>
          }
        >
          <AlertTitle>Subtitle Data Modified</AlertTitle>
          <Typography variant='body2'>
            You have made changes to the generated subtitles. You can restore the original processed
            data at any time.
          </Typography>
        </Alert>
      )}

      {/* Validation Error Display */}
      {hasValidationError && (
        <Alert
          severity='error'
          sx={{
            mb: 2,
            // Ensure error alert is always interactive even when step is disabled
            pointerEvents: 'auto !important',
            position: 'relative',
            zIndex: 1,
          }}
          action={
            <Stack direction='row' spacing={1}>
              <Button
                size='small'
                variant='outlined'
                onClick={handleReturnToStep1}
                sx={{ fontSize: '0.75rem' }}
              >
                Return to Step 1
              </Button>
              {inputStepContent?.importedJsonFile && (
                <Button
                  size='small'
                  variant='outlined'
                  onClick={handleReimportJson}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Re-import JSON
                </Button>
              )}
              {processingOriginalJsonData && (
                <Button
                  size='small'
                  variant='outlined'
                  onClick={handleRestoreOriginal}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Restore Original
                </Button>
              )}
              {process.env.NODE_ENV === 'development' && (
                <Button
                  size='small'
                  variant='outlined'
                  onClick={handleRetryValidation}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Retry Validation
                </Button>
              )}
            </Stack>
          }
        >
          <AlertTitle>Review Step Validation Error</AlertTitle>
          <Typography variant='body2'>{validationError}</Typography>
        </Alert>
      )}

      {/* Step Status Indicator */}
      {isStepDisabled && !hasValidationError && (
        <Alert
          severity='warning'
          sx={{
            mb: 1,
            '.MuiAlert-message': {
              fontSize: '0.875rem',
            },
          }}
        >
          {reviewStepState === StepStatus.BLOCK
            ? 'Complete previous steps to access the review interface'
            : 'Review step has encountered an error and is currently disabled'}
        </Alert>
      )}

      {/* Top Row - Video Preview */}
      <Box
        sx={{
          height: '45%', // Take about 45% of available height
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 1,
          p: 2,
          overflow: 'hidden',
        }}
      >
        <VideoPreviewSection />
      </Box>

      {/* Bottom Row - 2-Column Layout */}
      <Box
        sx={{
          height: '55%', // Take remaining 55% of height
          display: 'grid',
          gridTemplateColumns: '1fr 1fr', // Equal width columns
          gap: 2,
          overflow: 'hidden',
        }}
      >
        {/* Left Panel - Generated Subtitles */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <SubtitleListPanel />
        </Box>

        {/* Right Panel - Edit Subtitle */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <SubtitleEditor />
        </Box>
      </Box>
    </Box>
  );
};

// Export with error boundary wrapper
export const ReviewStep: React.FC = () => (
  <ErrorBoundary
    fallbackTitle='Review Step Error'
    fallbackMessage='The subtitle review interface encountered an error. This often happens when processing large files or during workspace initialization.'
    enableDetailedView={true}
    enableRecovery={true}
    level='section'
  >
    <ReviewStepComponent />
  </ErrorBoundary>
);

export default ReviewStep;
