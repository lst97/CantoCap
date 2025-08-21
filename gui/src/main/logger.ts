import log from 'electron-log/main.js';
import { app } from 'electron';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { MainProcessLogger } from '../types/logger';

/**
 * Main process logger configuration
 * Handles file system operations and ensures log directory exists
 */
export class MainLogger {
  private static instance: MainProcessLogger | null = null;
  private static readonly isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Initialize the main process logger
   */
  public static initialize(): MainProcessLogger {
    if (MainLogger.instance) {
      return MainLogger.instance;
    }

    // Ensure log directory exists
    const logPath = MainLogger.getLogFilePath();
    const logDir = dirname(logPath);

    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Configure the logger
    MainLogger.configureMainLogger(log, logPath);
    MainLogger.addMainProcessMethods(log);

    MainLogger.instance = log as unknown as MainProcessLogger;

    // Log initialization with system info
    MainLogger.instance.info('🚀 Main process logger initialized', {
      environment: MainLogger.isDevelopment ? 'development' : 'production',
      platform: process.platform,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      logPath: logPath,
      pid: process.pid,
    });

    return MainLogger.instance;
  }

  /**
   * Get the main process logger instance
   */
  public static getLogger(): MainProcessLogger {
    if (!MainLogger.instance) {
      return MainLogger.initialize();
    }
    return MainLogger.instance;
  }

  /**
   * Configure electron-log for main process
   */
  private static configureMainLogger(logger: typeof log, logPath: string): void {
    // Console transport configuration
    logger.transports.console.level = MainLogger.isDevelopment ? 'debug' : 'warn';
    logger.transports.console.format = MainLogger.isDevelopment
      ? '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [MAIN] [{level}] {text}'
      : '[{h}:{i}:{s}] [MAIN] [{level}] {text}';

    // File transport configuration
    logger.transports.file.level = MainLogger.isDevelopment ? 'debug' : 'info';
    logger.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [MAIN] [{level}] {text}';
    logger.transports.file.resolvePathFn = () => logPath;

    // Disable remote transport
    logger.transports.remote.level = false;

    // Enable error handling
    logger.errorHandler.startCatching();
  }

  /**
   * Add main process specific logging methods
   */
  private static addMainProcessMethods(logger: typeof log): void {
    // System-level logging
    (
      logger as unknown as { system: (message: string, details?: Record<string, unknown>) => void }
    ).system = (message: string, details?: Record<string, unknown>) => {
      const detailsStr = details ? ` | ${JSON.stringify(details)}` : '';
      logger.info(`[SYSTEM] ${message}${detailsStr}`);
    };

    // Engine communication logging
    (logger as unknown as { engine: (message: string, data?: unknown) => void }).engine = (
      message: string,
      data?: unknown
    ) => {
      const dataStr = data && MainLogger.isDevelopment ? ` | ${JSON.stringify(data)}` : '';
      logger.info(`[ENGINE] ${message}${dataStr}`);
    };

    // Security logging
    (
      logger as unknown as {
        security: (message: string, context?: Record<string, unknown>) => void;
      }
    ).security = (message: string, context?: Record<string, unknown>) => {
      const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
      logger.warn(`[SECURITY] ${message}${contextStr}`);
    };

    // File operation logging
    (
      logger as unknown as {
        fileOp: (
          operation: string,
          path: string,
          result?: 'success' | 'error',
          error?: Error
        ) => void;
      }
    ).fileOp = (operation: string, path: string, result?: 'success' | 'error', error?: Error) => {
      const status = result ? ` | ${result}` : '';
      const errorStr = error ? ` | ${error.message}` : '';
      logger.info(`[FILE-OP] ${operation}: ${path}${status}${errorStr}`);
    };

    // Process lifecycle logging
    (
      logger as unknown as { lifecycle: (event: string, data?: Record<string, unknown>) => void }
    ).lifecycle = (event: string, data?: Record<string, unknown>) => {
      const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
      logger.info(`[LIFECYCLE] ${event}${dataStr}`);
    };
  }

  /**
   * Get appropriate log file path for main process
   */
  private static getLogFilePath(): string {
    try {
      if (app?.isPackaged) {
        const userDataPath = app.getPath('userData');
        return join(userDataPath, 'logs', 'main.log');
      } else {
        return join(process.cwd(), 'logs', 'main-dev.log');
      }
    } catch {
      return join(process.cwd(), 'logs', 'main-fallback.log');
    }
  }

  /**
   * Create a scoped logger for specific modules
   */
  public static createScopedLogger(scope: string): MainProcessLogger {
    const baseLogger = MainLogger.getLogger();

    // Create a proxy that adds scope to all log messages
    return new Proxy(baseLogger, {
      get(target, prop: string | symbol) {
        if (
          typeof target[prop as keyof typeof target] === 'function' &&
          ['error', 'warn', 'info', 'verbose', 'debug', 'silly'].includes(prop as string)
        ) {
          return (message: string, ...args: unknown[]) => {
            return target[prop as keyof typeof target](`[${scope}] ${message}`, ...args);
          };
        }
        return target[prop as keyof typeof target];
      },
    }) as MainProcessLogger;
  }
}

// Export the main logger for easy imports
export const mainLogger = MainLogger.getLogger();
