import log from 'electron-log';
import { app } from 'electron';
import { join } from 'path';
import type { Logger, LoggerConfig, ProcessingLogData } from '../types/logger';

/**
 * Centralized logger configuration for the CantoCap application
 * Provides environment-aware logging with structured output
 */
export class LoggerService {
  private static instance: Logger | null = null;
  private static isDevelopment: boolean = process.env.NODE_ENV === 'development';

  /**
   * Initialize the logger with environment-specific configuration
   */
  public static initialize(): Logger {
    if (LoggerService.instance) {
      return LoggerService.instance;
    }

    const config: LoggerConfig = {
      level: LoggerService.isDevelopment ? 'debug' : 'warn',
      isDevelopment: LoggerService.isDevelopment,
      fileLogPath: LoggerService.getLogFilePath(),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    };

    LoggerService.configureLogger(log, config);
    LoggerService.addCustomMethods(log);

    LoggerService.instance = log as unknown as Logger;

    // Log initialization
    LoggerService.instance.info('🚀 Logger initialized', {
      environment: config.isDevelopment ? 'development' : 'production',
      level: config.level,
      logPath: config.fileLogPath,
    });

    return LoggerService.instance;
  }

  /**
   * Get the singleton logger instance
   */
  public static getLogger(): Logger {
    if (!LoggerService.instance) {
      return LoggerService.initialize();
    }
    return LoggerService.instance;
  }

  /**
   * Configure the electron-log instance
   */
  private static configureLogger(logger: typeof log, config: LoggerConfig): void {
    // Configure console transport
    logger.transports.console.level = config.level;
    logger.transports.console.format = config.isDevelopment
      ? '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
      : '[{h}:{i}:{s}] [{level}] {text}';

    // Configure file transport
    if (config.fileLogPath) {
      logger.transports.file.level = config.isDevelopment ? 'debug' : 'info';
      logger.transports.file.maxSize = config.maxFileSize || 10 * 1024 * 1024; // Default to 10MB
      logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
      logger.transports.file.resolvePathFn = () => config.fileLogPath!;
    }

    // Disable remote transport for security
    logger.transports.remote.level = false;

    // Configure console output for different environments
    if (!config.isDevelopment) {
      // In production, only show warnings and errors in console
      logger.transports.console.level = 'warn';
    }
  }

  /**
   * Add custom logging methods for specific use cases
   */
  private static addCustomMethods(logger: typeof log): void {
    // Processing-specific logging
    (logger as any).processing = (message: string, data?: ProcessingLogData) => {
      const logData = data ? ` | ${JSON.stringify(data)}` : '';
      logger.info(`[PROCESSING] ${message}${logData}`);
    };

    // Performance logging
    (logger as any).performance = (message: string, metrics?: Record<string, number>) => {
      const metricsStr = metrics ? ` | ${JSON.stringify(metrics)}` : '';
      logger.info(`[PERFORMANCE] ${message}${metricsStr}`);
    };

    // IPC communication logging
    (logger as any).ipc = (direction: 'send' | 'receive', channel: string, data?: unknown) => {
      const prefix = direction === 'send' ? '[IPC→]' : '[IPC←]';
      const dataStr = data && LoggerService.isDevelopment ? ` | ${JSON.stringify(data)}` : '';
      logger.debug(`${prefix} ${channel}${dataStr}`);
    };
  }

  /**
   * Get the appropriate log file path based on the platform and app state
   */
  private static getLogFilePath(): string {
    try {
      if (app?.isPackaged) {
        // Production: Use app's log directory
        const userDataPath = app.getPath('userData');
        return join(userDataPath, 'logs', 'main.log');
      } else {
        // Development: Use project directory
        return join(process.cwd(), 'logs', 'dev.log');
      }
    } catch (error) {
      // Fallback if app is not available
      return join(process.cwd(), 'logs', 'fallback.log');
    }
  }

  /**
   * Set log level dynamically
   */
  public static setLogLevel(level: keyof typeof log.transports.console.level): void {
    const logger = LoggerService.getLogger();
    logger.transports.console.level = level;
    logger.transports.file.level = level;
    logger.info(`📊 Log level changed to: ${level}`);
  }

  /**
   * Clear old log files
   */
  public static async clearLogs(): Promise<void> {
    const logger = LoggerService.getLogger();
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const logDir = path.dirname(LoggerService.getLogFilePath());
      const files = await fs.readdir(logDir);

      const logFiles = files.filter((file) => file.endsWith('.log'));

      for (const file of logFiles) {
        await fs.unlink(path.join(logDir, file));
      }

      logger.info('🗑️ Log files cleared successfully');
    } catch (error) {
      logger.error('❌ Failed to clear log files:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export the logger for easy imports
export const logger = LoggerService.getLogger();
