import { ipcMain, WebContents } from 'electron';
import { ProcessManager } from '../process-manager';
import type { ProcessingConfig, ProcessingEvent } from '../../types';

export class ProcessingIPCHandlers {
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
        console.log('🚀 Processing:start called with config:', {
          inputFile: config.inputFile,
          outputFile: config.outputFile,
          model: config.modelSettings.whisperModel,
          language: config.language,
          ffmpegPath: config.ffmpegPath
        });

        // Validate FFmpeg path before starting processing
        if (!config.ffmpegPath || config.ffmpegPath === 'ffmpeg') {
          const errorMessage = 'SETUP_ERROR: FFmpeg executable not found or invalid path. Please install FFmpeg to process audio/video files.';
          console.error('❌ Processing start validation failed:', errorMessage);
          
          // Send error event to renderer
          this.webContents.send('processing:event', {
            type: 'error',
            data: { error: errorMessage }
          });
          
          return { 
            success: false, 
            error: errorMessage 
          };
        }

        console.log(`✅ FFmpeg validation passed: ${config.ffmpegPath}`);

        // Create callback that sends events to renderer
        const callback = (event: ProcessingEvent) => {
          console.log('📡 Processing event:', event.type, event.data);
          this.webContents.send('processing:event', event);
        };

        await this.processManager.startTranscriptionModern(config, callback);
        
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to start processing:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Send error event to renderer
        this.webContents.send('processing:event', {
          type: 'error',
          data: { error: errorMessage }
        });
        
        return { 
          success: false, 
          error: errorMessage 
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
            message: 'Processing cancelled by user'
          }
        });
        
        console.log('✅ Processing cancelled');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to cancel processing:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
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
          status: isRunning ? 'running' : 'idle'
        };
      } catch (error) {
        console.error('❌ Failed to get processing status:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Convert config from step stores to ProcessingConfig format
    ipcMain.handle('processing:convertConfig', async (_, stepConfig: {
      inputStep: any;
      configStep: any;
    }) => {
      try {
        const { inputStep, configStep } = stepConfig;
        
        console.log('🔧 [DEBUG] ProcessingIPCHandlers - convertConfig called');
        
        // Get media duration for timeout calculation
        let mediaDuration: number | undefined;
        try {
          if (inputStep.mediaMetadata?.duration) {
            mediaDuration = inputStep.mediaMetadata.duration;
          } else if (inputStep.inputFile || inputStep.selectedFile) {
            // Note: We'll need to get duration from the input step or make this async with proper video metadata lookup
            // For now, we'll rely on inputStep.mediaMetadata being populated by the UI
            console.log('Media duration not available in inputStep.mediaMetadata, using fallback timeout calculation');
          }
        } catch (error) {
          console.warn('Failed to get media duration for timeout calculation:', error);
          // Continue without duration - will use fallback timeout
        }
        
        // Pre-resolve FFmpeg path using ProcessManager
        console.log('🔧 [DEBUG] Pre-resolving FFmpeg path...');
        const resolvedFFmpegPath = await this.processManager.findFFmpegExecutable();
        console.log(`🔧 [DEBUG] Resolved FFmpeg path: "${resolvedFFmpegPath}"`);
        
        // Validate FFmpeg path resolution
        if (resolvedFFmpegPath === 'ffmpeg') {
          const errorMessage = 
            'SETUP_ERROR: FFmpeg executable not found. Please install FFmpeg and ensure it is available in your system PATH, ' +
            'or install it to a standard location. FFmpeg is required for audio/video processing.';
          console.error('❌ FFmpeg validation failed:', errorMessage);
          return {
            success: false,
            error: errorMessage
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
            temperature: configStep.modelSettings?.temperature || 0.0
          },
          
          // API keys
          apiKeys: {
            gemini: configStep.apiKeys?.gemini || configStep.geminiKey,
            openai: configStep.apiKeys?.openai,
            huggingface: configStep.apiKeys?.huggingface
          },
          
          // Features
          features: {
            speakers: configStep.speakers || false,
            written: configStep.written || false,
            music: configStep.music || false
          },
          
          // Advanced settings
          advancedSettings: {
            chunkDuration: configStep.advancedSettings?.chunkDuration || 15,
            numWorkers: configStep.advancedSettings?.numWorkers || 1,
            enableSpeakerDiarization: configStep.advancedSettings?.enableSpeakerDiarization || false,
            enableMusicDetection: configStep.advancedSettings?.enableMusicDetection || false
          },
          
          // CLI options
          priority: configStep.priority,
          noGeminiRefinement: configStep.noGeminiRefinement,
          maxChunkDuration: configStep.maxChunkDuration,
          videoQuality: configStep.videoQuality,
          terminologyConfig: configStep.terminologyConfig,
          ffmpegPath: resolvedFFmpegPath, // Now pre-resolved instead of relying on ProcessManager later
          verbose: configStep.verbose
        };

        console.log('🔧 [DEBUG] ProcessingIPCHandlers - Created ProcessingConfig:');
        console.log(`🔧 [DEBUG] - configStep.ffmpegPath input: "${configStep.ffmpegPath}"`);
        console.log(`🔧 [DEBUG] - resolved FFmpeg path: "${resolvedFFmpegPath}"`);
        console.log(`🔧 [DEBUG] - processingConfig.ffmpegPath output: "${processingConfig.ffmpegPath}"`);

        console.log('✅ Converted step config to ProcessingConfig:', {
          inputFile: processingConfig.inputFile,
          model: processingConfig.modelSettings.whisperModel,
          hasGeminiKey: !!processingConfig.apiKeys.gemini,
          hasHuggingFaceKey: !!processingConfig.apiKeys.huggingface,
          ffmpegPath: processingConfig.ffmpegPath
        });

        return { 
          success: true, 
          config: processingConfig 
        };
      } catch (error) {
        console.error('❌ Failed to convert config:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

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
          errors: isValid ? undefined : errors
        };
      } catch (error) {
        console.error('❌ Failed to validate config:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Get processing time estimate
    ipcMain.handle('processing:getTimeEstimate', (_, config: ProcessingConfig) => {
      try {
        const estimate = this.processManager.getProcessingTimeEstimate(config);
        
        console.log('📊 Processing time estimate:', {
          estimatedTime: estimate.estimatedProcessingDisplay,
          timeout: estimate.timeoutDisplay,
          basedOnDuration: estimate.basedOnDuration
        });

        return { 
          success: true, 
          estimate 
        };
      } catch (error) {
        console.error('❌ Failed to get processing time estimate:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Validate FFmpeg availability
    ipcMain.handle('processing:validateFFmpeg', async () => {
      try {
        console.log('🔍 Validating FFmpeg availability...');
        const ffmpegPath = await this.processManager.findFFmpegExecutable();
        
        const isValid = ffmpegPath !== 'ffmpeg';
        
        console.log(`🔍 FFmpeg validation result: ${isValid ? 'VALID' : 'INVALID'} (${ffmpegPath})`);
        
        return { 
          success: true, 
          isValid,
          ffmpegPath: isValid ? ffmpegPath : undefined,
          error: isValid ? undefined : 'SETUP_ERROR: FFmpeg executable not found. Please install FFmpeg and ensure it is available in your system PATH.'
        };
      } catch (error) {
        console.error('❌ Failed to validate FFmpeg:', error);
        return { 
          success: false, 
          isValid: false,
          error: error instanceof Error ? error.message : 'Unknown error validating FFmpeg' 
        };
      }
    });

    console.log('✅ Processing IPC handlers initialized');
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
    
    console.log('✅ Processing IPC handlers cleaned up');
  }
}