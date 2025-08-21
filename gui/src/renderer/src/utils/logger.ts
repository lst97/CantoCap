import log from 'electron-log/renderer.js';
import type { RendererLogger as RendererLoggerType } from '../../../types/logger';

/**
 * Renderer process logger configuration
 * Provides structured logging for the React frontend
 */
export class RendererLogger {
  private static instance: RendererLoggerType | null = null;
  private static readonly isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Initialize the renderer process logger
   */
  public static initialize(): RendererLoggerType {
    if (RendererLogger.instance) {
      return RendererLogger.instance;
    }

    // Configure the logger
    RendererLogger.configureRendererLogger(log);
    RendererLogger.addRendererMethods(log);

    RendererLogger.instance = log as unknown as RendererLoggerType;

    // Log initialization
    RendererLogger.instance.info('🖥️ Renderer process logger initialized', {
      environment: RendererLogger.isDevelopment ? 'development' : 'production',
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    return RendererLogger.instance;
  }

  /**
   * Get the renderer process logger instance
   */
  public static getLogger(): RendererLoggerType {
    if (!RendererLogger.instance) {
      return RendererLogger.initialize();
    }
    return RendererLogger.instance;
  }

  /**
   * Configure electron-log for renderer process
   */
  private static configureRendererLogger(logger: typeof log): void {
    try {
      // Console transport configuration - more restrictive in renderer
      if (logger.transports?.console) {
        logger.transports.console.level = RendererLogger.isDevelopment ? 'debug' : 'error';
        logger.transports.console.format = RendererLogger.isDevelopment
          ? '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [RENDERER] [{level}] {text}'
          : '[{h}:{i}:{s}] [RENDERER] [{level}] {text}';
      }

      // File transport - let main process handle file logging
      if (logger.transports?.file) {
        logger.transports.file.level = false;
      }

      // Remote transport disabled
      if (logger.transports?.remote) {
        logger.transports.remote.level = false;
      }

      // IPC transport - disable to avoid main process dependency warnings
      if (logger.transports?.ipc) {
        logger.transports.ipc.level = false;
      }
    } catch (error) {
      // Fallback to console.warn if logger configuration fails
      console.warn('Failed to configure renderer logger transports:', error);
    }
  }

  /**
   * Add renderer process specific logging methods
   */
  private static addRendererMethods(logger: typeof log): void {
    // UI interaction logging
    (
      logger as unknown as {
        ui: (action: string, component?: string, data?: Record<string, unknown>) => void;
      }
    ).ui = (action: string, component?: string, data?: Record<string, unknown>) => {
      const componentStr = component ? `[${component}]` : '';
      const dataStr = data && RendererLogger.isDevelopment ? ` | ${JSON.stringify(data)}` : '';
      logger.debug(`[UI] ${componentStr} ${action}${dataStr}`);
    };

    // Store/state logging
    (
      logger as unknown as { store: (action: string, store: string, state?: unknown) => void }
    ).store = (action: string, store: string, state?: unknown) => {
      const stateStr = state && RendererLogger.isDevelopment ? ` | ${JSON.stringify(state)}` : '';
      logger.debug(`[STORE] [${store}] ${action}${stateStr}`);
    };

    // Component lifecycle logging
    (
      logger as unknown as {
        component: (
          component: string,
          lifecycle: 'mount' | 'unmount' | 'update' | 'error',
          data?: Record<string, unknown>
        ) => void;
      }
    ).component = (
      component: string,
      lifecycle: 'mount' | 'unmount' | 'update' | 'error',
      data?: Record<string, unknown>
    ) => {
      const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
      logger.debug(`[COMPONENT] [${component}] ${lifecycle}${dataStr}`);
    };

    // User action logging
    (
      logger as unknown as {
        userAction: (action: string, context?: Record<string, unknown>) => void;
      }
    ).userAction = (action: string, context?: Record<string, unknown>) => {
      const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
      logger.info(`[USER] ${action}${contextStr}`);
    };

    // Error boundary logging
    (
      logger as unknown as {
        errorBoundary: (
          component: string,
          error: Error,
          errorInfo?: Record<string, unknown>
        ) => void;
      }
    ).errorBoundary = (component: string, error: Error, errorInfo?: Record<string, unknown>) => {
      const infoStr = errorInfo ? ` | ${JSON.stringify(errorInfo)}` : '';
      logger.error(
        `[ERROR-BOUNDARY] [${component}] ${error.message} | Stack: ${error.stack}${infoStr}`
      );
    };

    // Performance logging for renderer
    (
      logger as unknown as {
        performance: (metric: string, value: number, context?: Record<string, unknown>) => void;
      }
    ).performance = (metric: string, value: number, context?: Record<string, unknown>) => {
      const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
      logger.info(`[PERFORMANCE] ${metric}: ${value}ms${contextStr}`);
    };

    // Navigation logging
    (
      logger as unknown as {
        navigation: (from: string, to: string, data?: Record<string, unknown>) => void;
      }
    ).navigation = (from: string, to: string, data?: Record<string, unknown>) => {
      const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
      logger.debug(`[NAVIGATION] ${from} → ${to}${dataStr}`);
    };
  }

  /**
   * Create a scoped logger for specific components
   */
  public static createComponentLogger(componentName: string): RendererLoggerType {
    const baseLogger = RendererLogger.getLogger();

    return new Proxy(baseLogger, {
      get(target, prop: string | symbol) {
        if (
          typeof target[prop as keyof typeof target] === 'function' &&
          ['error', 'warn', 'info', 'verbose', 'debug', 'silly'].includes(prop as string)
        ) {
          return (message: string, ...args: unknown[]) => {
            return target[prop as keyof typeof target](`[${componentName}] ${message}`, ...args);
          };
        }
        return target[prop as keyof typeof target];
      },
    }) as RendererLoggerType;
  }

  /**
   * Create a scoped logger for specific stores
   */
  public static createStoreLogger(storeName: string): RendererLoggerType {
    const baseLogger = RendererLogger.getLogger();

    return new Proxy(baseLogger, {
      get(target, prop: string | symbol) {
        if (
          typeof target[prop as keyof typeof target] === 'function' &&
          ['error', 'warn', 'info', 'verbose', 'debug', 'silly'].includes(prop as string)
        ) {
          return (message: string, ...args: unknown[]) => {
            return target[prop as keyof typeof target](`[STORE:${storeName}] ${message}`, ...args);
          };
        }
        return target[prop as keyof typeof target];
      },
    }) as RendererLoggerType;
  }

  /**
   * Create a scoped logger for React hooks
   */
  public static createHookLogger(hookName: string): RendererLoggerType & {
    hookMount: (dependencies?: Record<string, unknown>) => void;
    hookUnmount: (cleanup?: Record<string, unknown>) => void;
    hookUpdate: (changes?: Record<string, unknown>) => void;
    hookRender: (renderCount?: number, reason?: string) => void;
    hookEffect: (effectName: string, dependencies?: unknown[], action?: 'run' | 'skip' | 'cleanup') => void;
    hookState: (stateName: string, oldValue?: unknown, newValue?: unknown) => void;
    hookCallback: (callbackName: string, dependencies?: unknown[], recreated?: boolean) => void;
    hookMemo: (memoName: string, dependencies?: unknown[], recomputed?: boolean) => void;
  } {
    const baseLogger = RendererLogger.getLogger();

    // Create the base proxy logger
    const proxyLogger = new Proxy(baseLogger, {
      get(target, prop: string | symbol) {
        if (
          typeof target[prop as keyof typeof target] === 'function' &&
          ['error', 'warn', 'info', 'verbose', 'debug', 'silly'].includes(prop as string)
        ) {
          return (message: string, ...args: unknown[]) => {
            return target[prop as keyof typeof target](`[HOOK:${hookName}] ${message}`, ...args);
          };
        }
        return target[prop as keyof typeof target];
      },
    }) as RendererLoggerType;

    // Add hook-specific logging methods
    return {
      ...proxyLogger,
      hookMount: (dependencies?: Record<string, unknown>) => {
        const depsStr = dependencies ? ` | deps: ${JSON.stringify(dependencies)}` : '';
        baseLogger.debug(`[HOOK:${hookName}] mounted${depsStr}`);
      },
      hookUnmount: (cleanup?: Record<string, unknown>) => {
        const cleanupStr = cleanup ? ` | cleanup: ${JSON.stringify(cleanup)}` : '';
        baseLogger.debug(`[HOOK:${hookName}] unmounted${cleanupStr}`);
      },
      hookUpdate: (changes?: Record<string, unknown>) => {
        const changesStr = changes ? ` | changes: ${JSON.stringify(changes)}` : '';
        baseLogger.debug(`[HOOK:${hookName}] updated${changesStr}`);
      },
      hookRender: (renderCount?: number, reason?: string) => {
        const countStr = renderCount ? ` (#${renderCount})` : '';
        const reasonStr = reason ? ` | reason: ${reason}` : '';
        baseLogger.debug(`[HOOK:${hookName}] render${countStr}${reasonStr}`);
      },
      hookEffect: (effectName: string, dependencies?: unknown[], action?: 'run' | 'skip' | 'cleanup') => {
        const depsStr = dependencies && RendererLogger.isDevelopment ? ` | deps: ${JSON.stringify(dependencies)}` : '';
        const actionStr = action ? ` | ${action}` : '';
        baseLogger.debug(`[HOOK:${hookName}] effect[${effectName}]${actionStr}${depsStr}`);
      },
      hookState: (stateName: string, oldValue?: unknown, newValue?: unknown) => {
        const valueStr = RendererLogger.isDevelopment && oldValue !== undefined && newValue !== undefined 
          ? ` | ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}` 
          : '';
        baseLogger.debug(`[HOOK:${hookName}] state[${stateName}]${valueStr}`);
      },
      hookCallback: (callbackName: string, dependencies?: unknown[], recreated?: boolean) => {
        const depsStr = dependencies && RendererLogger.isDevelopment ? ` | deps: ${JSON.stringify(dependencies)}` : '';
        const recreatedStr = recreated !== undefined ? ` | ${recreated ? 'recreated' : 'cached'}` : '';
        baseLogger.debug(`[HOOK:${hookName}] callback[${callbackName}]${recreatedStr}${depsStr}`);
      },
      hookMemo: (memoName: string, dependencies?: unknown[], recomputed?: boolean) => {
        const depsStr = dependencies && RendererLogger.isDevelopment ? ` | deps: ${JSON.stringify(dependencies)}` : '';
        const recomputedStr = recomputed !== undefined ? ` | ${recomputed ? 'recomputed' : 'cached'}` : '';
        baseLogger.debug(`[HOOK:${hookName}] memo[${memoName}]${recomputedStr}${depsStr}`);
      },
    };
  }
}

// Export the renderer logger for easy imports
export const rendererLogger = RendererLogger.getLogger();

// Export convenience functions
export const createComponentLogger = RendererLogger.createComponentLogger;
export const createStoreLogger = RendererLogger.createStoreLogger;
export const createHookLogger = RendererLogger.createHookLogger;
