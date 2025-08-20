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

const ReviewStepComponent: React.FC = () => {
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
          console.log('Audio file validation - assuming file exists (no direct API available)');
        }

        return { valid: true };
      } catch (error) {
        console.error('Error validating media file:', error);
        return {
          valid: false,
          error: 'Unable to verify media file existence. Please ensure the file is accessible.',
        };
      }
    },
    []
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
    []
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
    []
  );

  const validateJsonData = useCallback(
    (
      importedJsonFile: string | null,
      stepSubtitles: unknown[]
    ): { valid: boolean; error?: string } => {
      console.log(
        '🔍 JSON Validation - ImportedFile:',
        importedJsonFile,
        'StepSubtitles:',
        stepSubtitles
      );

      // Only validate if this is a JSON import workflow (indicated by importedJsonFile)
      if (importedJsonFile) {
        console.log('📄 JSON import detected, validating subtitle data...');

        if (!stepSubtitles || !Array.isArray(stepSubtitles)) {
          console.log('❌ Subtitles is not an array:', stepSubtitles);
          return {
            valid: false,
            error:
              'No subtitle data found from the imported JSON file. The JSON import may have failed or the file may be corrupted. Please return to Step 1 and re-import your JSON caption file.',
          };
        }

        if (stepSubtitles.length === 0) {
          console.log('❌ Subtitles array is empty');
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
        console.log(
          `📊 Subtitle validation (${isImportedData ? 'imported' : 'model-generated'}): ${validSubtitles.length}/${stepSubtitles.length} valid subtitles`
        );

        // Log some sample subtitles for debugging
        if (stepSubtitles.length > 0 && validSubtitles.length === 0) {
          console.log('🔍 Sample subtitle for debugging:', stepSubtitles[0]);
          console.log('🔍 Validation type:', isImportedData ? 'imported JSON' : 'model-generated');

          // Debug first subtitle structure
          const firstSub = stepSubtitles[0] as Record<string, unknown>;
          console.log('🔍 First subtitle structure:', {
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
            console.log('⚠️ Subtitles have basic timing structure but may need normalization');
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
          console.log(`⚠️ Low validity ratio: ${validityRatio}`);
          return {
            valid: false,
            error: `Only ${validSubtitles.length} of ${stepSubtitles.length} subtitles from the JSON are in valid format. Please check your JSON file format.`,
          };
        }

        console.log('✅ JSON validation passed');
      } else {
        console.log('ℹ️ No JSON import detected, skipping JSON validation');
      }

      return { valid: true };
    },
    [isValidModelSubtitle, isValidImportedSubtitle]
  );

  // Effect to automatically import JSON data from processing step
  // FIXED: Removed editStoreSubtitles from dependency to prevent infinite loop
  useEffect(() => {
    const importJsonFromProcessing = async () => {
      console.log('🔍 ReviewStep: Checking processing data on load/change:', {
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
          console.log(
            '📡 ReviewStep: Processing completed with JSON data, importing into review step'
          );
          console.log(
            '📡 JSON data source:',
            processingOriginalJsonData ? 'originalJsonData' : 'jsonSubtitleData'
          );
          console.log('📡 Subtitles to import:', jsonDataToImport?.subtitles?.length || 0);
          console.log(
            '📡 Reason: stepSubtitles empty?',
            !stepSubtitles || stepSubtitles.length === 0,
            'hasProcessed?',
            hasProcessedJsonData.current
          );

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
            console.log(
              '✅ ReviewStep: Successfully synced processing data to step store for persistence'
            );

            console.log('✅ ReviewStep: Successfully imported JSON data from processing step');

            // Clear any previous validation errors since we have new data
            setValidationError(null);
            setHasValidationRun(false);
          } catch (error) {
            console.error('❌ ReviewStep: Failed to import JSON data from processing step:', error);
            hasProcessedJsonData.current = false; // Allow retry
            setValidationError(
              'Failed to import generated subtitles. Please try navigating to Step 4 again.'
            );
          }
        } else if (!jsonDataToImport) {
          console.log('⚠️ ReviewStep: Processing completed but no JSON data found');
          // Try to load from step subtitles if available
          if (stepSubtitles && stepSubtitles.length > 0) {
            console.log(
              '📡 ReviewStep: Found step subtitles, loading those instead:',
              stepSubtitles.length
            );
          }
        } else {
          console.log(
            'ℹ️ ReviewStep: Processing data available but already imported or step subtitles exist'
          );
        }
      } else if (processingStatus !== 'completed') {
        console.log('ℹ️ ReviewStep: Processing not completed yet, status:', processingStatus);
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
        console.log(
          '⏸️ Skipping validation - State:',
          reviewStepState,
          'IsValidating:',
          isValidating,
          'HasRun:',
          hasValidationRun
        );
        return;
      }

      console.log('🔍 Starting Review Step validation...', { validationKey, reviewStepState });
      setIsValidating(true);
      setValidationError(null);

      try {
        // Validate media file presence
        console.log('🎬 Validating media file:', inputFile);
        const mediaValidation = await validateMediaFile(inputFile ?? null);
        if (!mediaValidation.valid) {
          console.log('❌ Media validation failed:', mediaValidation.error);
          setValidationError(mediaValidation.error || 'Media file validation failed');
          setHasValidationRun(true);
          await setStepState('review', StepStatus.ERROR);
          return;
        }

        // Validate JSON data integrity (only if JSON was imported)
        console.log(
          '📄 Validating JSON data. ImportedFile:',
          inputStepContent?.importedJsonFile,
          'Subtitles count:',
          stepSubtitles?.length
        );

        // If we have a JSON import OR processing completed but no subtitles, try to load from the backend sync store
        let subtitlesToValidate = stepSubtitles;
        const hasJsonImport = inputStepContent?.importedJsonFile;
        const hasProcessingCompleted =
          processingStatus === 'completed' && (processingJsonData || processingOriginalJsonData);

        if (
          (hasJsonImport || hasProcessingCompleted) &&
          (!stepSubtitles || stepSubtitles.length === 0)
        ) {
          console.log('🔄 No subtitles in step store, attempting to load from sync store...');
          console.log(
            '🔄 Reason: hasJsonImport?',
            !!hasJsonImport,
            'hasProcessingCompleted?',
            !!hasProcessingCompleted
          );
          try {
            const syncResult = await (
              window as unknown as ElectronWindow
            ).cantocapAPI.subtitleSyncFromStep(activeWorkspaceId!);
            if (syncResult && syncResult.subtitles && syncResult.subtitles.length > 0) {
              console.log(`✅ Found ${syncResult.subtitles.length} subtitles in sync store`);
              subtitlesToValidate = syncResult.subtitles as Subtitle[];

              // Update the step store with the found subtitles to fix the missing subtitles issue
              try {
                await updateStepContent('review', { subtitles: syncResult.subtitles });
                console.log('✅ Updated step store with synced subtitles');
              } catch (updateError) {
                console.log('⚠️ Failed to update step store:', updateError);
              }
            } else {
              console.log('⚠️ No subtitles found in sync store either');
              // Give a small delay and try again - the export might still be in progress
              console.log('🔄 Waiting 500ms and trying sync again...');
              await new Promise((resolve) => setTimeout(resolve, 500));
              const retryResult = await (
                window as unknown as ElectronWindow
              ).cantocapAPI.subtitleSyncFromStep(activeWorkspaceId!);
              if (retryResult && retryResult.subtitles && retryResult.subtitles.length > 0) {
                console.log(
                  `✅ Found ${retryResult.subtitles.length} subtitles in sync store on retry`
                );
                subtitlesToValidate = retryResult.subtitles as Subtitle[];
                try {
                  await updateStepContent('review', { subtitles: retryResult.subtitles });
                  console.log('✅ Updated step store with synced subtitles on retry');
                } catch (updateError) {
                  console.log('⚠️ Failed to update step store on retry:', updateError);
                }
              } else {
                console.log('❌ Still no subtitles found after retry');
              }
            }
          } catch (syncError) {
            console.log('⚠️ Failed to load from sync store:', syncError);
          }
        }

        const jsonValidation = validateJsonData(
          inputStepContent?.importedJsonFile ?? null,
          subtitlesToValidate
        );
        if (!jsonValidation.valid) {
          console.log('❌ JSON validation failed:', jsonValidation.error);
          setValidationError(jsonValidation.error || 'JSON data validation failed');
          setHasValidationRun(true);
          await setStepState('review', StepStatus.ERROR);
          return;
        }

        // If we reach here, validation passed
        console.log('✅ Review Step validation passed');

        // Clear any previous validation errors
        setValidationError(null);
        setHasValidationRun(true);
      } catch (error) {
        console.error('💥 Validation error:', error);
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
      console.error('Failed to navigate to Step 1:', error);
    }
  }, [navigateToStep]);

  const handleReimportJson = useCallback(async () => {
    // Navigate back to step 1 where user can re-import JSON
    await handleReturnToStep1();
  }, [handleReturnToStep1]);

  // Add a manual retry function for debugging
  const handleRetryValidation = useCallback(async () => {
    console.log('🔄 Manual retry validation requested');
    setValidationError(null);
    setIsValidating(false);
    setHasValidationRun(false); // Reset validation flag

    // Reset step state to trigger re-validation
    await setStepState('review', StepStatus.READY);
  }, [setStepState]);

  // NEW: Restore functionality for returning to original processed JSON
  const handleRestoreOriginal = useCallback(async () => {
    if (!processingOriginalJsonData || !activeWorkspaceId) {
      console.warn('Cannot restore: missing original data or workspace ID');
      return;
    }

    try {
      console.log('🔄 Restoring original JSON data from processing step');

      // Use the new restore method specifically designed for processing step data
      const subtitlesArray = processingOriginalJsonData?.subtitles || [];
      await useSubtitleEditStore
        .getState()
        .actions.restoreFromProcessingOriginal(activeWorkspaceId, inputFile || '', subtitlesArray);

      console.log('✅ Successfully restored original JSON data');

      // Clear validation errors since we have fresh original data
      setValidationError(null);
      setHasValidationRun(false);
    } catch (error) {
      console.error('❌ Failed to restore original JSON data:', error);
      setValidationError('Failed to restore original data. Please try again.');
    }
  }, [processingOriginalJsonData, activeWorkspaceId, inputFile]);

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
    console.log(
      '🔄 ReviewStep: Workspace changed, resetting processed JSON flag for proper reload handling'
    );
    hasProcessedJsonData.current = false;
  }, [currentWorkspaceId, activeWorkspaceId, inputStepContent?.importedJsonFile]);

  // Initialize subtitles when workspace or step subtitles change
  useEffect(() => {
    const initializeSubtitles = async () => {
      const workspaceId = currentWorkspaceId || activeWorkspaceId;
      console.log('🔄 ReviewStep: Initializing subtitles for workspace:', workspaceId, {
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
            console.log('🔄 ReviewStep: No step subtitles, importing from processing JSON data');
            console.log(
              '🔄 Processing data available:',
              jsonDataToImport?.subtitles?.length,
              'subtitles'
            );
            try {
              hasProcessedJsonData.current = true;
              const subtitlesArray = jsonDataToImport?.subtitles || [];
              await importFromJson(workspaceId, inputFile || '', subtitlesArray);

              // CRITICAL: Sync the imported processing data to step store for persistence
              await exportToStep();
              console.log(
                '✅ ReviewStep: Successfully synced fallback processing data to step store'
              );

              // CRITICAL: Also update the review step content directly
              // Use the imported subtitles directly instead of accessing edit store to prevent loops
              const { useSubtitleEditStore } = await import('../../stores/useSubtitleEditStore');
              const currentSubtitles = useSubtitleEditStore.getState().subtitles;
              await updateStepContent('review', { subtitles: currentSubtitles });
              console.log(
                '✅ ReviewStep: Updated review step content with processed subtitles (fallback)'
              );

              console.log('✅ ReviewStep: Successfully imported processing data as fallback');
              return; // Exit early since importFromJson handles everything
            } catch (error) {
              console.error('❌ ReviewStep: Fallback import failed:', error);
              hasProcessedJsonData.current = false;
            }
          }
        }

        if (subtitlesToLoad.length > 0) {
          console.log(
            '🔄 ReviewStep: Loading subtitles from',
            dataSource,
            ':',
            subtitlesToLoad.length
          );
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
            console.log(
              '🔄 Forcing subtitle workspace reload for JSON import - resetting diff baseline'
            );
            console.log(`📄 Processing new JSON import: ${currentJsonFile}`);
            // For force reload, clear workspace and initialize fresh
            await clearWorkspace();
            // Mark this JSON file as processed to prevent infinite loop
            processedJsonImportRef.current = currentJsonFile;

            // CRITICAL: Use importFromJson to establish proper original baseline for diff
            // This ensures the imported JSON data becomes the "original" for comparison
            try {
              await importFromJson(workspaceId, videoPath, transformedSubtitles);
              console.log('✅ JSON import processed with fresh baseline for diff comparison');
            } catch (error) {
              console.error('❌ Failed to import JSON data for diff baseline:', error);
              // Fallback to regular load if import fails
              loadSubtitlesForWorkspace(workspaceId, videoPath, transformedSubtitles);
            }
            return;
          } else if (hasJsonImport) {
            console.log(`ℹ️ JSON import already processed: ${currentJsonFile}`);
            // CRITICAL FIX: For processed JSON imports, only force reload for truly fresh processing data
            // Check if processing JUST completed (not from app reload) by verifying it hasn't been processed yet
            const jsonDataToImport = processingOriginalJsonData || processingJsonData;
            const hasFreshProcessingForJson =
              processingStatus === 'completed' && jsonDataToImport && !hasProcessedJsonData.current;

            console.log('🔄 Loading workspace data for processed JSON import', {
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

          console.log('🔄 Loading subtitles for workspace', {
            hasFreshProcessingData: hasFreshProcessingForNonJson,
            forceReload: hasFreshProcessingForNonJson,
            processingStatus,
            hasProcessedJsonData: hasProcessedJsonData.current,
          });

          loadSubtitlesForWorkspace(workspaceId, videoPath, transformedSubtitles);
        } else {
          console.log('ℹ️ ReviewStep: No subtitle data available from any source');
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
