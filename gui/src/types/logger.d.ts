export interface LogLevel {
  error: 0;
  warn: 1;
  info: 2;
  verbose: 3;
  debug: 4;
  silly: 5;
}

export interface LoggerConfig {
  level: keyof LogLevel;
  isDevelopment: boolean;
  fileLogPath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export interface ProcessingLogData {
  sessionId: string;
  step: string;
  progress?: number;
  duration?: number;
  memoryUsage?: number;
  metadata?: Record<string, unknown>;
}

// Core logging methods that are common to all loggers
export interface CoreLoggerMethods {
  error: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  verbose: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
  silly: (message: string, data?: Record<string, unknown>) => void;
  
  // Index signature for proxy methods
  [key: string]: any;
}

// Main process logger with additional system methods
export interface MainProcessLogger extends CoreLoggerMethods {
  // System-level methods for main process
  system: (message: string, details?: Record<string, unknown>) => void;
  engine: (message: string, data?: unknown) => void;
  security: (message: string, context?: Record<string, unknown>) => void;
  fileOp: (operation: string, path: string, result?: 'success' | 'error', error?: Error) => void;
  lifecycle: (event: string, data?: Record<string, unknown>) => void;
  
  // Custom methods for our app
  processing: (message: string, data?: ProcessingLogData) => void;
  performance: (message: string, metrics?: Record<string, number>) => void;
  ipc: (direction: 'send' | 'receive', channel: string, data?: unknown) => void;
}

// Renderer process logger with UI-specific methods
export interface RendererLogger extends CoreLoggerMethods {
  // UI-specific methods for renderer process
  ui: (action: string, component?: string, data?: Record<string, unknown>) => void;
  store: (action: string, store: string, state?: unknown) => void;
  component: (component: string, lifecycle: 'mount' | 'unmount' | 'update' | 'error', data?: Record<string, unknown>) => void;
  userAction: (action: string, context?: Record<string, unknown>) => void;
  errorBoundary: (component: string, error: Error, errorInfo?: Record<string, unknown>) => void;
  performance: (metric: string, value: number, context?: Record<string, unknown>) => void;
  navigation: (from: string, to: string, data?: Record<string, unknown>) => void;
}

// Generic logger type that can be either main or renderer
export type Logger = MainProcessLogger | RendererLogger;

declare global {
  interface Window {
    logger: Logger;
  }
}