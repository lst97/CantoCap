import { useEffect } from 'react';
import { useProcessingStepStore } from '../stores/steps/useProcessingStepStore';
import { useReviewStepStore } from '../stores/steps/useReviewStepStore';
import { useWorkflowActions } from '../stores/useWorkflowStore';
import type { ElectronWindow } from '../stores/types/StoreTypes';
import { StepStatus } from '../stores/types/StoreTypes';
import type { ProcessingEvent } from '../../../types';
import type { CantocapSubtitleData } from '../../../types/SubtitleTypes';

/**
 * Hook to set up IPC event listeners for processing events
 * This ensures the processing store stays in sync with backend processing status
 */
export const useProcessingEvents = () => {
  const { updateStatusFromEvent } = useProcessingStepStore(state => state.actions);
  const reviewStepActions = useReviewStepStore(state => state.actions);
  const workflowActions = useWorkflowActions();

  useEffect(() => {
    const electronWindow = window as unknown as ElectronWindow;
    
    if (!electronWindow.electron?.ipcRenderer) {
      console.warn('⚠️ useProcessingEvents: IPC Renderer not available');
      return;
    }

    console.log('📡 useProcessingEvents: Setting up processing event listeners');

    // Handler for processing events from the backend
    // Note: Electron IPC sends events as (event, ...args) where args[0] is our ProcessingEvent
    const handleProcessingEvent = async (...args: any[]) => {
      console.log('📡 useProcessingEvents: Received IPC event with args:', args.length);
      
      // Based on user's logs, the first arg might be the raw event with sender/ports
      // and the actual ProcessingEvent data should be in args[1] or args[0] depending on the IPC pattern
      let eventData: ProcessingEvent | undefined;
      
      // Try to find the ProcessingEvent in the arguments
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg && typeof arg === 'object' && arg.type && arg.data) {
          console.log(`📡 useProcessingEvents: Found ProcessingEvent at args[${i}]:`, arg);
          eventData = arg;
          break;
        }
      }
      
      if (!eventData) {
        console.error('📡 useProcessingEvents: No valid ProcessingEvent found in args:', args);
        return;
      }

      try {
        switch (eventData.type) {
          case 'status-change':
            // Only persist important status changes, not regular logs
            if (eventData.data.status) {
              console.log(`📡 useProcessingEvents: Status changed to ${eventData.data.status} - updating store`);
              updateStatusFromEvent({
                status: eventData.data.status,
                phase: eventData.data.phase
              });
            }
            break;

          case 'progress-update':
            // Update progress but don't persist every progress message
            if (eventData.data.progress !== undefined) {
              updateStatusFromEvent({
                progress: eventData.data.progress,
                phase: eventData.data.phase
              });
            }
            break;

          case 'log-message':
            // For regular log messages, just log them but don't persist to store
            // The UI will show them in real-time but they won't be saved
            console.log('📡 Processing Log:', eventData.data.message);
            break;

          case 'phase-change':
            // Phase changes are important for UI display - persist these
            if (eventData.data.phase) {
              console.log(`📡 useProcessingEvents: Phase changed to ${eventData.data.phase} - updating store`);
              updateStatusFromEvent({
                phase: eventData.data.phase
              });
            }
            break;

          case 'error':
            // Errors are critical - always persist
            console.log('📡 useProcessingEvents: Error occurred - updating store');
            updateStatusFromEvent({
              status: 'error',
              error: eventData.data.message || 'Processing error occurred'
            });
            break;

          case 'complete':
            // Completion is critical - update processing store and prepare review step
            console.log('📡 useProcessingEvents: Processing completed - handling completion workflow');
            console.log('📡 Complete event data:', eventData.data);
            
            // Extract JSON subtitle data and processing information from completion event
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const completionData: any = {
              status: 'completed',
              progress: 100,
              message: eventData.data.message || 'Processing completed successfully'
            };

            // Extract processing info (file paths, statistics, etc.)
            if (eventData.data.outputFilePath) {
              console.log('📡 Found output file path in completion event');
              completionData.outputFile = eventData.data.outputFilePath;
            }

            // Extract statistics from subtitle data metadata
            if (eventData.data.statistics) {
              console.log('📡 Found statistics in completion event');
              completionData.statistics = eventData.data.statistics;
            }

            // If the completion event includes JSON subtitle data, extract it
            if (eventData.data.subtitleData) {
              console.log('📡 Found JSON subtitle data in completion event');
              completionData.jsonSubtitleData = eventData.data.subtitleData;
            }

            // Update processing step store with completion data
            updateStatusFromEvent(completionData);
            
            // CRITICAL FIX: Ensure processing store status is set to 'completed' to prevent timer updates
            console.log('🔧 useProcessingEvents: Explicitly setting processing store status to completed');
            updateStatusFromEvent({ status: 'completed' });
            
            // Handle step transitions and review step setup
            try {
              console.log('📡 useProcessingEvents: Starting completion workflow...');
              
              // 1. Load JSON subtitle data into review step if available
              if (eventData.data.subtitleData) {
                console.log('📡 useProcessingEvents: Loading JSON subtitle data into review step');
                const subtitleData = eventData.data.subtitleData as CantocapSubtitleData;
                
                // Set the JSON data in review step store
                reviewStepActions.setJsonSubtitleData(subtitleData);
                
                // Load subtitles from JSON data for display
                reviewStepActions.loadSubtitlesFromJson();
                
                // Set processing statistics if available
                if (eventData.data.statistics) {
                  reviewStepActions.updateReviewStep({
                    processingStatistics: eventData.data.statistics,
                    processingCompleted: true,
                    lastProcessedAt: new Date().toISOString()
                  });
                }
                
                console.log('✅ useProcessingEvents: JSON subtitle data loaded into review step');
              }
              
              // 2. Set processing step as complete
              console.log('📡 useProcessingEvents: Setting processing step as complete');
              await workflowActions.setStepState('processing', StepStatus.COMPLETE);
              console.log('✅ useProcessingEvents: Processing step marked as complete');
              
              // 3. Set review step as ready
              console.log('📡 useProcessingEvents: Setting review step as ready');
              await workflowActions.setStepState('review', StepStatus.READY);
              console.log('✅ useProcessingEvents: Review step marked as ready');
              
              // 4. Navigate to review step
              console.log('📡 useProcessingEvents: Navigating to review step');
              await workflowActions.navigateToStep('review');
              console.log('✅ useProcessingEvents: Navigation to review step completed');
              
              console.log('🎉 useProcessingEvents: Completion workflow finished successfully');
              
            } catch (error) {
              console.error('❌ useProcessingEvents: Failed during completion workflow:', error);
              
              // If we fail, at least try to enable the review step
              try {
                await workflowActions.setStepState('review', StepStatus.READY);
                console.log('✅ useProcessingEvents: Review step enabled as fallback');
              } catch (fallbackError) {
                console.error('❌ useProcessingEvents: Failed fallback review step enable:', fallbackError);
              }
            }
            break;

          default:
            console.warn('📡 useProcessingEvents: Unknown event type:', eventData.type);
        }
      } catch (error) {
        console.error('📡 useProcessingEvents: Error handling processing event:', error);
      }
    };

    // Set up the IPC listener
    electronWindow.electron.ipcRenderer.on('processing:event', handleProcessingEvent);

    console.log('✅ useProcessingEvents: Processing event listeners registered');

    // Cleanup function - Note: IPC cleanup is handled automatically by Electron
    return () => {
      console.log('🧹 useProcessingEvents: Processing event listeners cleanup called');
    };
  }, [updateStatusFromEvent, reviewStepActions, workflowActions]);
};