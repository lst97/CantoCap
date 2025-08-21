import { ipcMain, WebContents } from 'electron';
import { ProcessManager } from '../process-manager';
import { MainLogger } from '../logger';
import type { MainProcessLogger } from '../../types/logger';
import type { ProcessingConfig, ProcessingEvent } from '../../types';

export class ProcessingIPCHandlers {
  private logger: MainProcessLogger = MainLogger.createScopedLogger('ProcessingIPC');

  constructor(
    private processManager: ProcessManager,
    private webContents: WebContents
  ) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // ============================================================================
    // PROCESSING CONTROL HANDLERS
    // ============================================================================

    // Start transcription with modern config
    ipcMain.handle('processing:start', async (_, config: ProcessingConfig) => {
      try {
        this.logger.info('🚀 Processing start called', {
          inputFile: config.inputFile,
          outputFile: config.outputFile,
          model: config.modelSettings.whisperModel,
          language: config.language,
          ffmpegPath: config.ffmpegPath,
        });

        // Validate FFmpeg path before starting processing
        if (!config.ffmpegPath || config.ffmpegPath === 'ffmpeg') {
          const errorMessage =
            'SETUP_ERROR: FFmpeg executable not found or invalid path. Please install FFmpeg to process audio/video files.';
          this.logger.error('Processing start validation failed', { error: errorMessage });

          // Send error event to renderer
          this.webContents.send('processing:event', {
            type: 'error',
            data: { error: errorMessage },
          });

          return {
            success: false,
            error: errorMessage,
          };
        }

        this.logger.info('FFmpeg validation passed', { ffmpegPath: config.ffmpegPath });

        // Create callback that sends events to renderer
        const callback = (event: ProcessingEvent) => {
          this.logger.debug('Processing event', { type: event.type, data: event.data });
          this.webContents.send('processing:event', event);
        };

        await this.processManager.startTranscriptionModern(config, callback);

        return { success: true };
      } catch (error) {
        this.logger.error('Failed to start processing', {
          error: error instanceof Error ? error.message : String(error),
        });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Send error event to renderer
        this.webContents.send('processing:event', {
          type: 'error',
          data: { error: errorMessage },
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    });

    // Cancel processing
    ipcMain.handle('processing:cancel', () => {
      try {
        this.processManager.cancelProcess();

        // Send cancellation event to renderer
        this.webContents.send('processing:event', {
          type: 'status-change',
          data: {
            status: 'idle',
            message: 'Processing cancelled by user',
          },
        });

        this.logger.info('Processing cancelled by user');
        return { success: true };
      } catch (error) {
        this.logger.error('Failed to cancel processing', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get processing status
    ipcMain.handle('processing:getStatus', () => {
      try {
        const isRunning = this.processManager.isProcessRunning();
        return {
          success: true,
          isRunning,
          status: isRunning ? 'running' : 'idle',
        };
      } catch (error) {
        this.logger.error('Failed to get processing status', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Convert config from step stores to ProcessingConfig format
    ipcMain.handle(
      'processing:convertConfig',
      async (
        _,
        stepConfig: {
          inputStep: any;
          configStep: any;
        }
      ) => {
        try {
          const { inputStep, configStep } = stepConfig;

          this.logger.debug('Converting config from step stores to ProcessingConfig format');

          // Get media duration for timeout calculation - CRITICAL SECTION
          let mediaDuration: number | undefined;

          try {
            // Extract video duration for timeout calculation
            if (inputStep && typeof inputStep === 'object') {
              // First try direct videoDurationSeconds (preferred)
              const videoSeconds = inputStep.videoDurationSeconds;
              if (typeof videoSeconds === 'number' && !isNaN(videoSeconds) && videoSeconds > 0) {
                mediaDuration = videoSeconds;
                this.logger.debug('Using videoDurationSeconds', { mediaDuration });
              } else {
                // Fallback to metadata duration (string format)
                const metadata = inputStep.mediaMetadata;
                if (metadata && metadata.duration) {
                  const metaDuration = metadata.duration;
                  if (typeof metaDuration === 'string') {
                    // Parse "18:00" format to seconds
                    const parts = metaDuration.split(':');
                    if (parts.length === 2) {
                      const minutes = parseInt(parts[0]);
                      const seconds = parseInt(parts[1]);
                      mediaDuration = minutes * 60 + seconds;
                      this.logger.debug('Parsed metadata duration', {
                        metaDuration,
                        mediaDuration,
                      });
                    }
                  } else if (typeof metaDuration === 'number') {
                    mediaDuration = metaDuration;
                  }
                }
              }
            }
          } catch (criticalError) {
            this.logger.error('Error extracting mediaDuration', {
              error: criticalError instanceof Error ? criticalError.message : String(criticalError),
            });
            mediaDuration = undefined;
          }

          // Pre-resolve FFmpeg path using ProcessManager
          const resolvedFFmpegPath = await this.processManager.findFFmpegExecutable();

          // Validate FFmpeg path resolution
          if (resolvedFFmpegPath === 'ffmpeg') {
            const errorMessage =
              'SETUP_ERROR: FFmpeg executable not found. Please install FFmpeg and ensure it is available in your system PATH, ' +
              'or install it to a standard location. FFmpeg is required for audio/video processing.';
            this.logger.error('FFmpeg validation failed', { error: errorMessage });
            return {
              success: false,
              error: errorMessage,
            };
          }

          // Build ProcessingConfig from step data
          const processingConfig: ProcessingConfig = {
            // Required fields
            inputFile: inputStep.inputFile || inputStep.selectedFile,

            // Media metadata
            mediaDuration,

            // Core configuration
            outputFile: configStep.outputFile,
            charset: configStep.charset || 'traditional',
            language: configStep.language || 'zh',
            subtitle: configStep.subtitle,

            // Model settings
            modelSettings: {
              whisperModel: configStep.modelSettings?.whisperModel || 'openai/whisper-large-v3',
              geminiModel: configStep.modelSettings?.geminiModel,
              enableGemini: configStep.modelSettings?.enableGemini || false,
              temperature: configStep.modelSettings?.temperature || 0.0,
            },

            // API keys
            apiKeys: {
              gemini: configStep.apiKeys?.gemini || configStep.geminiKey,
              openai: configStep.apiKeys?.openai,
              huggingface: configStep.apiKeys?.huggingface,
            },

            // Features
            features: {
              speakers: configStep.speakers || false,
              written: configStep.written || false,
              music: configStep.music || false,
            },

            // Advanced settings
            advancedSettings: {
              chunkDuration: configStep.advancedSettings?.chunkDuration || 15,
              numWorkers: configStep.advancedSettings?.numWorkers || 1,
              enableSpeakerDiarization:
                configStep.advancedSettings?.enableSpeakerDiarization || false,
              enableMusicDetection: configStep.advancedSettings?.enableMusicDetection || false,
            },

            // CLI options
            priority: configStep.priority,
            noGeminiRefinement: configStep.noGeminiRefinement,
            maxChunkDuration: configStep.maxChunkDuration,
            videoQuality: configStep.videoQuality,
            terminologyConfig: configStep.terminologyConfig,
            ffmpegPath: resolvedFFmpegPath, // Now pre-resolved instead of relying on ProcessManager later
            verbose: configStep.verbose,
          };

          this.logger.info('Converted step config to ProcessingConfig', {
            inputFile: processingConfig.inputFile,
            model: processingConfig.modelSettings.whisperModel,
            hasGeminiKey: !!processingConfig.apiKeys.gemini,
            hasHuggingFaceKey: !!processingConfig.apiKeys.huggingface,
            ffmpegPath: processingConfig.ffmpegPath,
            mediaDuration: processingConfig.mediaDuration,
          });

          return {
            success: true,
            config: processingConfig,
          };
        } catch (error) {
          this.logger.error('Failed to convert config', {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    );

    // Validate processing config
    ipcMain.handle('processing:validateConfig', (_, config: ProcessingConfig) => {
      try {
        const errors: string[] = [];

        // Required field validation
        if (!config.inputFile) {
          errors.push('Input file is required');
        }

        if (!config.apiKeys.huggingface) {
          errors.push('Hugging Face API key is required');
        }

        if (!config.modelSettings.whisperModel) {
          errors.push('Whisper model is required');
        }

        // File existence validation would go here if needed

        const isValid = errors.length === 0;

        return {
          success: true,
          isValid,
          errors: isValid ? undefined : errors,
        };
      } catch (error) {
        this.logger.error('Failed to validate config', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get processing time estimate
    ipcMain.handle('processing:getTimeEstimate', (_, config: ProcessingConfig) => {
      try {
        const estimate = this.processManager.getProcessingTimeEstimate(config);

        this.logger.info('Processing time estimate calculated', {
          estimatedTime: estimate.estimatedProcessingDisplay,
          timeout: estimate.timeoutDisplay,
          basedOnDuration: estimate.basedOnDuration,
        });

        return {
          success: true,
          estimate,
        };
      } catch (error) {
        this.logger.error('Failed to get processing time estimate', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Validate FFmpeg availability
    ipcMain.handle('processing:validateFFmpeg', async () => {
      try {
        this.logger.debug('Validating FFmpeg availability');
        const ffmpegPath = await this.processManager.findFFmpegExecutable();

        const isValid = ffmpegPath !== 'ffmpeg';

        this.logger.info('FFmpeg validation result', { isValid, ffmpegPath });

        return {
          success: true,
          isValid,
          ffmpegPath: isValid ? ffmpegPath : undefined,
          error: isValid
            ? undefined
            : 'SETUP_ERROR: FFmpeg executable not found. Please install FFmpeg and ensure it is available in your system PATH.',
        };
      } catch (error) {
        this.logger.error('Failed to validate FFmpeg', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          isValid: false,
          error: error instanceof Error ? error.message : 'Unknown error validating FFmpeg',
        };
      }
    });

    this.logger.info('Processing IPC handlers initialized successfully');
  }

  // Cleanup method to remove all handlers
  public cleanup(): void {
    ipcMain.removeAllListeners('processing:start');
    ipcMain.removeAllListeners('processing:cancel');
    ipcMain.removeAllListeners('processing:getStatus');
    ipcMain.removeAllListeners('processing:convertConfig');
    ipcMain.removeAllListeners('processing:validateConfig');
    ipcMain.removeAllListeners('processing:getTimeEstimate');
    ipcMain.removeAllListeners('processing:validateFFmpeg');

    this.logger.info('Processing IPC handlers cleaned up successfully');
  }
}
