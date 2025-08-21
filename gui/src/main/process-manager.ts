import { spawn, ChildProcess } from 'child_process';
import { join, resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MainLogger } from './logger';
import type { MainProcessLogger } from '../types/logger';
import type { AppConfig, ProcessingConfig, ProcessingEvent, ProcessingError } from '../types';

const execAsync = promisify(exec);
const logger: MainProcessLogger = MainLogger.createScopedLogger('ProcessManager');

type ProcessCallback = (eventType: string, data: unknown) => void;
type ModernProcessCallback = (event: ProcessingEvent) => void;

export class ProcessManager {
  private activeProcess: ChildProcess | null = null;
  private pythonPath: string | null = null;
  private enginePath: string;
  private venvActivated: boolean = false;
  private currentStatistics: Record<string, unknown> | null = null;
  private currentOutputFile: string | null = null;
  private processTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BASE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes base timeout
  private readonly MIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes minimum
  private readonly MAX_TIMEOUT_MS = 120 * 60 * 1000; // 2 hours maximum

  constructor() {
    this.enginePath = this.getEnginePath();
  }

  private getEnginePath(): string {
    if (app.isPackaged) {
      // In production, engine is in resources/engine
      return join(process.resourcesPath, 'engine');
    } else {
      // In development, engine is in parent directory
      return resolve(join(__dirname, '../../../engine'));
    }
  }

  private async findPythonExecutable(): Promise<string> {
    if (this.pythonPath && this.venvActivated) return this.pythonPath;

    // First, try to find and use the virtual environment Python
    const venvPython = await this.findVenvPython();
    if (venvPython) {
      this.pythonPath = venvPython;
      this.venvActivated = true;
      return venvPython;
    }

    // Fallback to system Python if no venv found
    const candidates = ['python3.12', 'python3', 'python'];

    for (const candidate of candidates) {
      try {
        await this.testPythonExecutable(candidate);
        this.pythonPath = candidate;
        this.venvActivated = false;
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error('No suitable Python executable found');
  }

  public async findFFmpegExecutable(): Promise<string> {
    logger.debug('🔍 Starting FFmpeg executable search', { platform: process.platform });

    // First try to find FFmpeg in system PATH
    const candidates = ['ffmpeg'];

    for (const candidate of candidates) {
      try {
        const command = process.platform === 'win32' ? 'where' : 'which';
        logger.debug('🔍 Executing command', { command: `${command} ${candidate}` });

        const { stdout } = await execAsync(`${command} ${candidate}`);
        const ffmpegPath = stdout.trim().split('\n')[0]; // Get first result

        logger.debug('🔍 Command output', { output: stdout.trim() });
        logger.debug('🔍 Parsed FFmpeg path', { path: ffmpegPath });

        if (ffmpegPath && existsSync(ffmpegPath)) {
          logger.info('✅ Found FFmpeg in system PATH', { path: ffmpegPath });
          return ffmpegPath;
        } else {
          logger.warn('⚠️ FFmpeg path exists check failed', { path: ffmpegPath });
        }
      } catch (error) {
        logger.debug('❌ FFmpeg not found with command', {
          candidate,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    // Fallback to common installation paths
    logger.debug('🔍 Checking common installation paths');
    const commonPaths =
      process.platform === 'win32'
        ? [
            'C:\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
          ]
        : process.platform === 'darwin'
          ? ['/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/bin/ffmpeg']
          : ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/snap/bin/ffmpeg'];

    logger.debug('🔍 Checking common paths', { count: commonPaths.length });

    for (const path of commonPaths) {
      logger.debug('🔍 Checking path', { path });
      if (existsSync(path)) {
        logger.info('✅ Found FFmpeg at common path', { path });
        return path;
      }
    }

    // If still not found, return 'ffmpeg' and let the engine handle the error
    logger.warn('❌ FFmpeg executable not found', {
      message: 'Not found in PATH or common locations',
    });
    logger.warn('❌ Returning fallback ffmpeg command', {
      warning: 'This will likely cause engine validation error',
    });
    return 'ffmpeg';
  }

  private async findVenvPython(): Promise<string | null> {
    const venvPath = join(this.enginePath, 'venv');
    const venvPython =
      process.platform === 'win32'
        ? join(venvPath, 'Scripts', 'python.exe')
        : join(venvPath, 'bin', 'python');

    try {
      // Check if venv directory exists first
      if (!existsSync(venvPath)) {
        return null;
      }

      // Check if Python executable exists
      if (!existsSync(venvPython)) {
        return null;
      }

      // Check if venv exists and Python is valid
      await this.testPythonExecutable(venvPython);
      return venvPython;
    } catch (error) {
      logger.debug('Virtual environment Python test failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private testPythonExecutable(pythonCmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(pythonCmd, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.on('close', (code: number | null) => {
        if (code === 0 && stdout.includes('Python 3.')) {
          resolve(pythonCmd);
        } else {
          reject(new Error(`Invalid Python executable: ${pythonCmd}`));
        }
      });

      process.on('error', reject);
    });
  }

  // Modern method with ProcessingConfig interface
  public async startTranscriptionModern(
    config: ProcessingConfig,
    callback: ModernProcessCallback
  ): Promise<void> {
    try {
      if (this.activeProcess) {
        const error: ProcessingError = {
          code: 'PROCESS_FAILED',
          message: 'Another transcription process is already running',
          recoverable: true, // Can be resolved by canceling current process
        };
        callback({
          type: 'error',
          data: { error: error.message },
        });
        throw error;
      }

      // Reset captured data for new processing
      this.currentStatistics = null;
      this.currentOutputFile = null;

      // Convert modern config to legacy format for CLI building
      const legacyConfig = await this.convertToLegacyConfig(config);

      // Ensure engine setup before starting transcription
      callback({
        type: 'status-change',
        data: {
          status: 'running',
          phase: 'setup',
          message: 'Ensuring engine setup...',
        },
      });

      await this.ensureEngineSetupModern(callback);

      const pythonCmd = await this.findPythonExecutable();
      const args = this.buildCliArguments(legacyConfig);

      callback({
        type: 'status-change',
        data: {
          status: 'running',
          phase: 'initializing',
          message: 'Starting transcription process...',
        },
      });

      // Start the process
      this.activeProcess = spawn(
        pythonCmd,
        ['-m', 'src.presentation.cli.main', '--ipc-mode', ...args],
        {
          cwd: this.enginePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
          env: {
            ...process.env,
            PYTHONPATH: this.enginePath,
          },
        }
      );

      // Convert mediaDuration to numeric if it's a string (safety fix)
      let numericDuration: number | undefined;
      if (config.mediaDuration !== undefined) {
        const mediaDuration = config.mediaDuration as number | string; // Type assertion for runtime safety
        if (typeof mediaDuration === 'string') {
          // Parse "18:00" format to seconds
          const parts = mediaDuration.split(':');
          if (parts.length === 2) {
            const minutes = parseInt(parts[0]);
            const seconds = parseInt(parts[1]);
            numericDuration = minutes * 60 + seconds;
            logger.debug('✅ Converted string duration to numeric', {
              original: mediaDuration,
              converted: numericDuration,
            });
          } else {
            logger.error('❌ Invalid duration string format', { mediaDuration });
          }
        } else if (typeof mediaDuration === 'number') {
          numericDuration = mediaDuration;
        }
      }

      // Calculate dynamic timeout based on media duration and complexity
      const dynamicTimeoutMs = this.calculateProcessingTimeout(config, numericDuration);
      const timeoutDisplay = this.formatTimeoutDuration(dynamicTimeoutMs);

      // Setup dynamic timeout for the process
      this.processTimeout = setTimeout(() => {
        if (this.activeProcess) {
          const error: ProcessingError = {
            code: 'TIMEOUT_ERROR',
            message: `Processing timed out after ${timeoutDisplay}`,
            recoverable: true,
          };

          callback({
            type: 'error',
            data: { error: error.message },
          });

          this.cancelProcess();
        }
      }, dynamicTimeoutMs);

      // Handle stdout and stderr with modern callback
      this.setupProcessListeners(callback);
    } catch (error) {
      const processingError: ProcessingError = {
        code: 'SETUP_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
      };

      callback({
        type: 'error',
        data: { error: processingError.message },
      });
    }
  }

  // Legacy method for backward compatibility
  public async startTranscription(config: AppConfig, callback: ProcessCallback): Promise<void> {
    try {
      if (this.activeProcess) {
        throw new Error('Another transcription process is already running');
      }

      // Reset captured data for new processing
      this.currentStatistics = null;
      this.currentOutputFile = null;

      // Ensure engine setup before starting transcription
      callback('process-started', {
        message: 'Ensuring engine setup...',
        stage: 'setup',
      });

      await this.ensureEngineSetup(callback);

      const pythonCmd = await this.findPythonExecutable();
      const args = this.buildCliArguments(config);

      callback('process-started', {
        message: 'Starting transcription process...',
        stage: 'initializing',
      });

      // Ensure we're using the venv python with proper module path
      this.activeProcess = spawn(
        pythonCmd,
        ['-m', 'src.presentation.cli.main', '--ipc-mode', ...args],
        {
          cwd: this.enginePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
          env: {
            ...process.env,
            PYTHONPATH: this.enginePath,
          },
        }
      );

      // Handle stdout (JSON messages from new IPC system)
      this.activeProcess.stdout?.on('data', (data: Buffer) => {
        this.classifyAndSendMessage(data, 'stdout', callback);
      });

      // Handle stderr (classify all output intelligently)
      this.activeProcess.stderr?.on('data', (data: Buffer) => {
        this.classifyAndSendMessage(data, 'stderr', callback);
      });

      // Handle process completion
      this.activeProcess.on('close', (code: number | null) => {
        this.activeProcess = null;

        if (code === 0) {
          const completionData: {
            message: string;
            exitCode: number | null;
            statistics?: Record<string, unknown>;
            outputFile?: string;
          } = {
            message: 'Transcription completed successfully',
            exitCode: code,
          };

          // Include statistics if captured
          if (this.currentStatistics) {
            completionData.statistics = this.currentStatistics;
          }

          // Include output file if captured
          if (this.currentOutputFile) {
            completionData.outputFile = this.currentOutputFile;
          }

          callback('process-complete', completionData);

          // Reset captured data for next run
          this.currentStatistics = null;
          this.currentOutputFile = null;
        } else {
          callback('process-error', {
            message: `Process exited with code ${code}`,
            type: 'exit_error',
            exitCode: code,
          });

          // Reset captured data on error too
          this.currentStatistics = null;
          this.currentOutputFile = null;
        }
      });

      // Handle process errors
      this.activeProcess.on('error', (error: Error) => {
        this.activeProcess = null;
        callback('process-error', {
          message: `Failed to start process: ${error.message}`,
          type: 'spawn_error',
        });
      });
    } catch (error) {
      callback('process-error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'setup_error',
      });
    }
  }

  public async ensureEngineSetup(callback?: ProcessCallback): Promise<void> {
    const venvPath = join(this.enginePath, 'venv');

    // Check if venv exists
    if (!existsSync(venvPath)) {
      if (callback) {
        callback('process-started', {
          message: 'Virtual environment not found. Running engine setup...',
          stage: 'setup',
        });
      }

      // Run the setup script to create venv and install dependencies
      await this.runEngineSetup(callback);
    } else {
      // Verify venv is working
      const venvPython = await this.findVenvPython();
      if (!venvPython) {
        if (callback) {
          callback('process-started', {
            message: 'Virtual environment corrupted. Re-running setup...',
            stage: 'setup',
          });
        }
        await this.runEngineSetup(callback);
      }
    }

    // Refresh python path to use venv
    this.pythonPath = null;
    this.venvActivated = false;
    await this.findPythonExecutable();
  }

  private async runEngineSetup(callback?: ProcessCallback): Promise<void> {
    const setupScript = join(this.enginePath, 'setup_env.py');

    if (!existsSync(setupScript)) {
      const errorMessage =
        `Engine setup script not found at: ${setupScript}\n\n` +
        `This may indicate that:\n` +
        `- The application was not installed correctly\n` +
        `- Files were moved or deleted\n` +
        `- You're running from an incomplete installation\n\n` +
        `Please reinstall the application to fix this issue.`;

      if (callback) {
        callback('process-error', {
          message: errorMessage,
          type: 'setup_error',
        });
      }
      throw new Error(errorMessage);
    }

    if (callback) {
      callback('process-started', {
        message: 'Running engine setup script...',
        stage: 'setup',
      });
    }

    return new Promise((resolve, reject) => {
      // Use system Python to run the setup script
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const setupProcess = spawn(pythonCmd, [setupScript], {
        cwd: this.enginePath,
        stdio: 'pipe',
        shell: true,
      });

      let _stdout = '';
      let stderr = '';

      setupProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        _stdout += output;
        if (callback) {
          callback('process-message', { message: output.trim() });
        }
      });

      setupProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        if (callback) {
          callback('process-message', { message: output.trim() });
        }
      });

      const timeout = setTimeout(() => {
        setupProcess.kill();
        reject(new Error('Engine setup timed out after 10 minutes'));
      }, 600000); // 10 minute timeout

      setupProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        if (code === 0) {
          if (callback) {
            callback('process-started', {
              message: 'Engine setup completed successfully',
              stage: 'setup',
            });
          }
          resolve();
        } else {
          const errorMessage =
            `Engine setup failed with exit code ${code}. This may be due to:\n` +
            `- Missing Python dependencies\n` +
            `- Network connectivity issues\n` +
            `- Insufficient disk space\n` +
            `- Permission issues\n\n` +
            `Error output:\n${stderr || 'No error output available'}`;

          if (callback) {
            callback('process-error', {
              message: errorMessage,
              type: 'setup_error',
            });
          }
          reject(new Error(errorMessage));
        }
      });

      setupProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start engine setup: ${error.message}`));
      });
    });
  }

  public cancelProcess(): void {
    // Clear timeout first
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }

    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM');

      // Force kill after 5 seconds if process doesn't terminate gracefully
      setTimeout(() => {
        if (this.activeProcess) {
          this.activeProcess.kill('SIGKILL');
          this.activeProcess = null;
        }
      }, 5000);
    }
  }

  private buildCliArguments(config: AppConfig): string[] {
    const args: string[] = [];

    // All arguments first, input file at the end

    // Only include -o if output directory differs from input directory
    if (config.outputFile && config.inputFile) {
      const inputDir = dirname(config.inputFile);
      const outputDir = dirname(config.outputFile);

      // Only add -o flag if directories are different
      if (inputDir !== outputDir) {
        args.push('-o', config.outputFile);
      }
    }

    if (config.language) {
      args.push('-l', config.language);
    }

    if (config.model) {
      args.push('-m', config.model);
    }

    if (config.priority && config.priority !== 'balanced') {
      args.push('-p', config.priority);
    }

    // Boolean flags
    if (config.speakers) {
      args.push('--speakers');
    }

    if (config.written) {
      args.push('--written');
    }

    if (config.music) {
      args.push('--music');
    }

    if (config.verbose) {
      args.push('--verbose');
    }

    if (config.noGeminiRefinement) {
      args.push('--no-gemini-refinement');
    }

    // String/number arguments
    if (config.charset && config.charset !== 'traditional') {
      args.push('--charset', config.charset);
    }

    if (config.geminiKey) {
      args.push('--gemini-key', config.geminiKey);
    }

    if (config.maxChunkDuration && config.maxChunkDuration !== 15) {
      args.push('--max-chunk-duration', String(config.maxChunkDuration));
    }

    if (config.videoQuality && config.videoQuality !== '360p') {
      args.push('--video-quality', config.videoQuality);
    }

    if (config.terminologyConfig) {
      args.push('-c', config.terminologyConfig);
    }

    // FFmpeg path is now required - should already be resolved by convertToLegacyConfig
    logger.debug('🔧 Building CLI arguments', { ffmpegPath: config.ffmpegPath });
    if (config.ffmpegPath) {
      logger.debug('🔧 Adding ffmpeg-path argument', { path: config.ffmpegPath });
      args.push('--ffmpeg-path', config.ffmpegPath);
    } else {
      // Fallback - should not happen if convertToLegacyConfig was called
      logger.warn('⚠️ FFmpeg path undefined/null - using fallback', { fallback: 'ffmpeg' });
      args.push('--ffmpeg-path', 'ffmpeg');
    }

    if (config.subtitle && typeof config.subtitle === 'string') {
      args.push('--subtitle', config.subtitle);
    }

    // Note: duration field was removed from AppConfig as it's not part of the CLI interface

    // Input file at the end (required)
    if (config.inputFile) {
      args.push(config.inputFile);
    }

    return args;
  }

  public isProcessRunning(): boolean {
    return this.activeProcess !== null;
  }

  // Get estimated processing time for UI display (without starting process)
  public getProcessingTimeEstimate(config: ProcessingConfig): {
    timeoutMs: number;
    timeoutDisplay: string;
    estimatedProcessingMs: number;
    estimatedProcessingDisplay: string;
    basedOnDuration: boolean;
  } {
    const timeoutMs = this.calculateProcessingTimeout(config, config.mediaDuration);
    const timeoutDisplay = this.formatTimeoutDuration(timeoutMs);

    // Calculate estimated processing time based on model complexity
    let estimatedProcessingMs = this.BASE_TIMEOUT_MS * 0.3; // Default fallback
    let basedOnDuration = false;

    if (config.mediaDuration && config.mediaDuration > 0) {
      // Base processing estimate based on Whisper model size (more conservative than timeout)
      let processingFactor = 0.5; // Default for medium models

      if (config.modelSettings.whisperModel.includes('small')) {
        processingFactor = 0.3; // Small models are faster
      } else if (config.modelSettings.whisperModel.includes('large')) {
        processingFactor = 1.0; // Large models take longer
      } else {
        processingFactor = 0.5; // Medium models
      }

      // Additional complexity factors
      if (config.features.speakers) processingFactor += 0.2;
      if (config.features.music) processingFactor += 0.1;
      if (config.apiKeys.gemini && config.modelSettings.enableGemini) processingFactor += 0.3;

      estimatedProcessingMs = config.mediaDuration * 1000 * processingFactor;
      basedOnDuration = true;
    }

    const estimatedProcessingDisplay = this.formatTimeoutDuration(estimatedProcessingMs);

    return {
      timeoutMs,
      timeoutDisplay,
      estimatedProcessingMs,
      estimatedProcessingDisplay,
      basedOnDuration,
    };
  }

  private classifyAndSendMessage(
    data: Buffer,
    stream: 'stdout' | 'stderr',
    callback: ProcessCallback
  ): void {
    const lines = data.toString().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsedData = JSON.parse(line);

        // Check for new IPC message format (has id and level)
        if (parsedData.id && parsedData.level) {
          // Check if this is a result message with statistics
          if (
            parsedData.category === 'process' &&
            parsedData.source === 'result' &&
            parsedData.data
          ) {
            if (parsedData.data.statistics) {
              this.currentStatistics = parsedData.data.statistics;
            }
            if (parsedData.data.output_path) {
              this.currentOutputFile = parsedData.data.output_path;
            }
          }
          callback('ipc-message', parsedData);
        } else {
          // Legacy format - convert to new format
          const convertedMessage = this.convertLegacyMessage(
            parsedData as Record<string, unknown>,
            stream
          );
          callback('ipc-message', convertedMessage);
        }
      } catch {
        // Non-JSON output - create new format message
        const enhancedMessage = this.createEnhancedMessage(line.trim(), stream);
        callback('ipc-message', enhancedMessage);
      }
    }
  }

  private createEnhancedMessage(
    content: string,
    stream: 'stdout' | 'stderr'
  ): {
    id: string;
    timestamp: string;
    level: string;
    category: string;
    source: string;
    content: string;
    data: {
      stream: string;
      raw_output: boolean;
    };
  } {
    const level = this.classifyRawOutput(content, stream);
    const category = stream === 'stderr' ? 'model' : 'process';

    return {
      id: `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      source: `${stream}_capture`,
      content,
      data: {
        stream,
        raw_output: true,
      },
    };
  }

  private convertLegacyMessage(
    parsedData: Record<string, unknown>,
    _stream: string
  ): {
    id: string;
    timestamp: string;
    level: string;
    category: string;
    source: string;
    content: string;
    data: Record<string, unknown>;
  } {
    // Convert old message format to new format
    let level = 'info';
    let category = 'process';

    if (parsedData.type === 'error') {
      level = 'error';
      category = 'system';
    } else if (
      typeof parsedData.data === 'object' &&
      parsedData.data &&
      'level' in parsedData.data &&
      typeof parsedData.data.level === 'string'
    ) {
      level = parsedData.data.level;
    }

    const timestamp =
      typeof parsedData.timestamp === 'string' ? parsedData.timestamp : new Date().toISOString();
    const data =
      typeof parsedData.data === 'object' && parsedData.data
        ? (parsedData.data as Record<string, unknown>)
        : {};
    const message = typeof data.message === 'string' ? data.message : '';
    const error = typeof data.error === 'string' ? data.error : '';
    const content = message || error || JSON.stringify(data);

    return {
      id: `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      level,
      category,
      source: 'legacy_handler',
      content,
      data,
    };
  }

  // Calculate dynamic timeout based on media duration and processing complexity
  private calculateProcessingTimeout(
    config: ProcessingConfig,
    mediaDurationSeconds?: number
  ): number {
    let timeoutMs = this.BASE_TIMEOUT_MS;

    // If media duration is available, use it as the primary factor
    if (mediaDurationSeconds && mediaDurationSeconds > 0) {
      // Base timeout multiplier based on Whisper model size
      let modelMultiplier = 8; // Default for medium models

      if (config.modelSettings.whisperModel.includes('small')) {
        modelMultiplier = 4; // Small models: 4x media duration
      } else if (config.modelSettings.whisperModel.includes('large')) {
        modelMultiplier = 16; // Large models: 16x media duration
      } else {
        modelMultiplier = 8; // Medium models: 8x media duration
      }

      // Calculate base timeout: media duration * model multiplier
      timeoutMs = mediaDurationSeconds * 1000 * modelMultiplier;

      // Additional complexity factors (add extra time, not multipliers)
      let additionalTimeMs = 0;

      if (config.features.speakers) {
        additionalTimeMs += mediaDurationSeconds * 1000 * 0.5; // +0.5x for speaker diarization
      }

      if (config.features.music) {
        additionalTimeMs += mediaDurationSeconds * 1000 * 0.3; // +0.3x for music detection
      }

      if (config.apiKeys.gemini && config.modelSettings.enableGemini) {
        additionalTimeMs += mediaDurationSeconds * 1000 * 1.0; // +1x for AI enhancement
      }

      timeoutMs += additionalTimeMs;

      // Add base overhead for setup, I/O, etc.
      timeoutMs += this.BASE_TIMEOUT_MS;
    } else {
      // Fallback: adjust base timeout based on model and features when no duration available
      let multiplier = 4.0; // Base multiplier for medium models

      if (config.modelSettings.whisperModel.includes('small')) {
        multiplier = 2.0; // Small models are faster
      } else if (config.modelSettings.whisperModel.includes('large')) {
        multiplier = 8.0; // Large models are much slower
      }

      // Additional complexity factors
      if (config.features.speakers) multiplier += 0.5;
      if (config.features.music) multiplier += 0.3;
      if (config.apiKeys.gemini && config.modelSettings.enableGemini) multiplier += 1.0;

      timeoutMs = this.BASE_TIMEOUT_MS * multiplier;
    }

    // Enforce minimum and maximum bounds
    timeoutMs = Math.max(this.MIN_TIMEOUT_MS, Math.min(timeoutMs, this.MAX_TIMEOUT_MS));

    return Math.floor(timeoutMs);
  }

  // Helper method to format timeout duration for user display
  private formatTimeoutDuration(timeoutMs: number): string {
    const minutes = Math.floor(timeoutMs / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }

  // Helper method to convert modern config to legacy format
  private async convertToLegacyConfig(config: ProcessingConfig): Promise<AppConfig> {
    logger.debug('🔧 Converting to legacy config', { inputFfmpegPath: config.ffmpegPath });

    // Resolve FFmpeg path if not provided or if it's just 'ffmpeg'
    let ffmpegPath = config.ffmpegPath;
    logger.debug('🔧 Initial ffmpegPath value', { ffmpegPath });

    if (!ffmpegPath || ffmpegPath === 'ffmpeg') {
      logger.debug('🔧 FFmpeg path needs resolution - calling findFFmpegExecutable()');
      ffmpegPath = await this.findFFmpegExecutable();
      logger.debug('🔧 Resolved ffmpegPath', { resolvedPath: ffmpegPath });
    } else {
      logger.debug('🔧 Using provided ffmpegPath without resolution');
    }

    const legacyConfig = {
      inputFile: config.inputFile,
      outputFile: config.outputFile,
      charset: config.charset,
      language: config.language,
      model: config.modelSettings.whisperModel,
      subtitle: config.subtitle,
      geminiKey: config.apiKeys.gemini,
      speakers: config.features.speakers,
      written: config.features.written,
      music: config.features.music,
      priority: config.priority,
      noGeminiRefinement: config.noGeminiRefinement,
      maxChunkDuration: config.maxChunkDuration,
      videoQuality: config.videoQuality,
      terminologyConfig: config.terminologyConfig,
      ffmpegPath: ffmpegPath,
      verbose: config.verbose,
    };

    logger.debug('🔧 Final legacy config', { ffmpegPath: legacyConfig.ffmpegPath });
    return legacyConfig;
  }

  // Modern engine setup with modern callback
  private async ensureEngineSetupModern(callback: ModernProcessCallback): Promise<void> {
    const venvPath = join(this.enginePath, 'venv');

    // Check if venv exists
    if (!existsSync(venvPath)) {
      callback({
        type: 'status-change',
        data: {
          status: 'running',
          phase: 'setup',
          message: 'Virtual environment not found. Running engine setup...',
        },
      });

      await this.runEngineSetupModern(callback);
    } else {
      // Verify venv is working
      const venvPython = await this.findVenvPython();
      if (!venvPython) {
        callback({
          type: 'status-change',
          data: {
            status: 'running',
            phase: 'setup',
            message: 'Virtual environment corrupted. Re-running setup...',
          },
        });
        await this.runEngineSetupModern(callback);
      }
    }

    // Refresh python path to use venv
    this.pythonPath = null;
    this.venvActivated = false;
    await this.findPythonExecutable();
  }

  // Modern engine setup runner
  private async runEngineSetupModern(callback: ModernProcessCallback): Promise<void> {
    const setupScript = join(this.enginePath, 'setup_env.py');

    if (!existsSync(setupScript)) {
      const error: ProcessingError = {
        code: 'ENGINE_NOT_FOUND',
        message: 'Engine setup script not found. Please reinstall the application.',
        recoverable: false,
      };

      callback({
        type: 'error',
        data: { error: error.message },
      });
      throw error;
    }

    callback({
      type: 'status-change',
      data: {
        status: 'running',
        phase: 'setup',
        message: 'Running engine setup script...',
      },
    });

    return new Promise((resolve, reject) => {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const setupProcess = spawn(pythonCmd, [setupScript], {
        cwd: this.enginePath,
        stdio: 'pipe',
        shell: true,
      });

      let stderr = '';

      setupProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        callback({
          type: 'log-message',
          data: { message: output.trim() },
        });
      });

      setupProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        callback({
          type: 'log-message',
          data: { message: output.trim() },
        });
      });

      const timeout = setTimeout(() => {
        setupProcess.kill();
        reject(new Error('Engine setup timed out after 10 minutes'));
      }, 600000); // 10 minute timeout

      setupProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        if (code === 0) {
          callback({
            type: 'status-change',
            data: {
              status: 'running',
              phase: 'setup',
              message: 'Engine setup completed successfully',
            },
          });
          resolve();
        } else {
          const error: ProcessingError = {
            code: 'SETUP_ERROR',
            message: `Engine setup failed with exit code ${code}`,
            details: { stderr },
            recoverable: true,
          };

          callback({
            type: 'error',
            data: { error: error.message },
          });
          reject(error);
        }
      });

      setupProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // Setup process listeners for modern callback
  private setupProcessListeners(callback: ModernProcessCallback): void {
    if (!this.activeProcess) return;

    // Handle stdout (JSON messages from IPC system)
    this.activeProcess.stdout?.on('data', (data: Buffer) => {
      this.classifyAndSendModernMessage(data, 'stdout', callback);
    });

    // Handle stderr
    this.activeProcess.stderr?.on('data', (data: Buffer) => {
      this.classifyAndSendModernMessage(data, 'stderr', callback);
    });

    // Handle process completion
    this.activeProcess.on('close', (code: number | null) => {
      this.activeProcess = null;

      // Clear timeout
      if (this.processTimeout) {
        clearTimeout(this.processTimeout);
        this.processTimeout = null;
      }

      if (code === 0) {
        const completionData: {
          status: 'idle' | 'running' | 'completed' | 'error';
          message: string;
          statistics?: Record<string, unknown>;
          outputFile?: string;
        } = {
          status: 'completed',
          message: 'Transcription completed successfully',
        };

        // Include statistics if captured
        if (this.currentStatistics) {
          completionData.statistics = this.currentStatistics;
        }

        // Include output file if captured
        if (this.currentOutputFile) {
          completionData.outputFile = this.currentOutputFile;
        }

        callback({
          type: 'complete',
          data: completionData,
        });

        // Reset captured data for next run
        this.currentStatistics = null;
        this.currentOutputFile = null;
      } else {
        callback({
          type: 'error',
          data: {
            status: 'error',
            error: `Process exited with code ${code}`,
          },
        });

        // Reset captured data on error too
        this.currentStatistics = null;
        this.currentOutputFile = null;
      }
    });

    // Handle process errors
    this.activeProcess.on('error', (error: Error) => {
      this.activeProcess = null;

      // Clear timeout
      if (this.processTimeout) {
        clearTimeout(this.processTimeout);
        this.processTimeout = null;
      }

      callback({
        type: 'error',
        data: {
          status: 'error',
          error: `Failed to start process: ${error.message}`,
        },
      });
    });
  }

  // Modern message classification
  private classifyAndSendModernMessage(
    data: Buffer,
    _stream: 'stdout' | 'stderr',
    callback: ModernProcessCallback
  ): void {
    const lines = data.toString().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsedData = JSON.parse(line);

        // Check for ProcessingEvent format (from engine)
        if (parsedData.type && parsedData.data) {
          logger.debug('📡 Received ProcessingEvent from engine', { eventType: parsedData.type });

          // Handle ProcessingEvent format directly
          if (parsedData.type === 'complete') {
            // Store completion data for the completion event
            if (parsedData.data.subtitleData) {
              this.currentStatistics = parsedData.data.subtitleData;
            }
            if (parsedData.data.outputFile || parsedData.data.outputFilePath) {
              this.currentOutputFile = parsedData.data.outputFile || parsedData.data.outputFilePath;
            }
          }

          // Forward ProcessingEvent directly to callback
          callback(parsedData);
        }
      } catch {
        // Non-JSON output - treat as log message
        callback({
          type: 'log-message',
          data: { message: line.trim() },
        });
      }
    }
  }

  private classifyRawOutput(message: string, stream: string): string {
    const msgLower = message.toLowerCase();

    // Model/library output patterns (INFO level - not errors!)
    if (
      msgLower.includes('loading checkpoint') ||
      msgLower.includes('transformers') ||
      msgLower.includes('model loaded') ||
      msgLower.includes('special tokens') ||
      msgLower.includes('safetensors')
    ) {
      return 'info';
    }

    // Debug patterns
    if (
      msgLower.includes('debug:') ||
      msgLower.includes('hardware check') ||
      msgLower.includes('engine status') ||
      msgLower.includes('cli command')
    ) {
      return 'debug';
    }

    // Warning patterns
    if (
      msgLower.includes('warning') ||
      msgLower.includes('deprecated') ||
      msgLower.includes('userwarning')
    ) {
      return 'warning';
    }

    // Critical patterns
    if (
      msgLower.includes('fatal') ||
      msgLower.includes('critical') ||
      msgLower.includes('segmentation fault')
    ) {
      return 'critical';
    }

    // Error patterns
    if (
      msgLower.includes('error') ||
      msgLower.includes('failed') ||
      msgLower.includes('exception')
    ) {
      return 'error';
    }

    // Default: stderr without error patterns is likely model output (INFO)
    return stream === 'stderr' ? 'info' : 'info';
  }
}
