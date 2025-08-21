import { useEffect, useRef } from 'react';
import { useProcessingStepStore } from '../stores/steps/useProcessingStepStore';
import { useReviewStepStore } from '../stores/steps/useReviewStepStore';
import { useWorkflowActions } from '../stores/useWorkflowStore';
import type { ElectronWindow } from '../stores/types/StoreTypes';
import { StepStatus } from '../stores/types/StoreTypes';
import type { ProcessingEvent } from '../../../types';
import type { CantocapSubtitleData } from '../../../types/SubtitleTypes';
import { createHookLogger } from '../utils/logger';

const logger = createHookLogger('ProcessingEventsHook');

/**
 * Hook to set up IPC event listeners for processing events
 * This ensures the processing store stays in sync with backend processing status
 */
export const useProcessingEvents = () => {
  const { updateStatusFromEvent } = useProcessingStepStore((state) => state.actions);
  const reviewStepActions = useReviewStepStore((state) => state.actions);
  const workflowActions = useWorkflowActions();
  
  // Message deduplication refs
  const lastLogMessage = useRef<string>('');
  const lastProgressPercent = useRef<number>(-1);

  useEffect(() => {
    const electronWindow = window as unknown as ElectronWindow;

    if (!electronWindow.electron?.ipcRenderer) {
      logger.warn('IPC Renderer not available');
      return;
    }

    logger.hookMount({ listenersSetup: true });

    // Handler for processing events from the backend
    const handleProcessingEvent = async (...args: unknown[]) => {
      let eventData: ProcessingEvent | undefined;

      // Find the ProcessingEvent in the arguments
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg && typeof arg === 'object' && arg !== null && 'type' in arg && 'data' in arg) {
          eventData = arg as ProcessingEvent;
          break;
        }
      }

      if (!eventData) {
        logger.error('No valid ProcessingEvent found in IPC args', { argsLength: args.length });
        return;
      }

      try {
        switch (eventData.type) {
          case 'status-change':
            if (eventData.data.status) {
              logger.info('Status changed', {
                status: eventData.data.status,
                phase: eventData.data.phase,
              });
              updateStatusFromEvent({
                status: eventData.data.status,
                phase: eventData.data.phase,
              });
            }
            break;

          case 'progress-update':
            if (eventData.data.progress !== undefined) {
              const progress = eventData.data.progress;
              // Only log and update when progress actually changes
              if (progress !== lastProgressPercent.current) {
                lastProgressPercent.current = progress;
                // Only log significant progress milestones to reduce noise
                if (progress % 10 === 0 || progress === 100) {
                  logger.debug('Progress update', { progress, phase: eventData.data.phase });
                }
                updateStatusFromEvent({
                  progress: eventData.data.progress,
                  phase: eventData.data.phase,
                });
              }
            }
            break;

          case 'log-message':
            // Log processing messages with deduplication
            const currentMessage = eventData.data.message;
            if (currentMessage && currentMessage !== lastLogMessage.current) {
              lastLogMessage.current = currentMessage;
              logger.debug('Processing log', { message: currentMessage });
            }
            break;

          case 'phase-change':
            if (eventData.data.phase) {
              logger.info('Phase changed', { phase: eventData.data.phase });
              updateStatusFromEvent({
                phase: eventData.data.phase,
              });
            }
            break;

          case 'error':
            logger.error('Processing error occurred', {
              message: eventData.data.message || 'Unknown processing error',
            });
            updateStatusFromEvent({
              status: 'error',
              error: eventData.data.message || 'Processing error occurred',
            });
            break;

          case 'complete':
            logger.info('Processing completed - starting completion workflow', {
              hasOutputFile: !!eventData.data.outputFilePath,
              hasStatistics: !!eventData.data.statistics,
              hasSubtitleData: !!eventData.data.subtitleData,
            });

            // Extract completion data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const completionData: any = {
              status: 'completed',
              progress: 100,
              message: eventData.data.message || 'Processing completed successfully',
            };

            // Extract processing info
            if (eventData.data.outputFilePath) {
              completionData.outputFile = eventData.data.outputFilePath;
            }
            if (eventData.data.statistics) {
              completionData.statistics = eventData.data.statistics;
            }
            if (eventData.data.subtitleData) {
              completionData.jsonSubtitleData = eventData.data.subtitleData;
            }

            // Update processing step store with completion data
            updateStatusFromEvent(completionData);
            updateStatusFromEvent({ status: 'completed' }); // Ensure timer stops

            // Handle step transitions and review step setup
            try {
              // 1. Load JSON subtitle data into review step if available
              if (eventData.data.subtitleData) {
                const subtitleData = eventData.data.subtitleData as CantocapSubtitleData;
                reviewStepActions.setJsonSubtitleData(subtitleData);
                reviewStepActions.loadSubtitlesFromJson();

                if (eventData.data.statistics) {
                  reviewStepActions.updateReviewStep({
                    processingStatistics: eventData.data.statistics,
                    processingCompleted: true,
                    lastProcessedAt: new Date().toISOString(),
                  });
                }
                logger.debug('JSON subtitle data loaded into review step');
              }

              // 2. Set processing step as complete
              await workflowActions.setStepState('processing', StepStatus.COMPLETE);
              // 3. Set review step as ready
              await workflowActions.setStepState('review', StepStatus.READY);
              // 4. Navigate to review step
              await workflowActions.navigateToStep('review');

              logger.info('Completion workflow finished successfully');
            } catch (error) {
              logger.error('Failed during completion workflow', { error });
              // Fallback: try to enable review step
              try {
                await workflowActions.setStepState('review', StepStatus.READY);
                logger.info('Review step enabled as fallback');
              } catch (fallbackError) {
                logger.error('Failed fallback review step enable', { error: fallbackError });
              }
            }
            break;

          default:
            logger.warn('Unknown event type', { eventType: eventData.type });
        }
      } catch (error) {
        logger.error('Error handling processing event', { error, eventType: eventData?.type });
      }
    };

    // Set up the IPC listener
    electronWindow.electron.ipcRenderer.on('processing:event', handleProcessingEvent);
    logger.debug('IPC event listeners registered');

    // Cleanup function
    return () => {
      // Reset deduplication refs
      lastLogMessage.current = '';
      lastProgressPercent.current = -1;
      logger.hookUnmount({ listenersCleanup: true });
    };
  }, [updateStatusFromEvent, reviewStepActions, workflowActions]);
};
