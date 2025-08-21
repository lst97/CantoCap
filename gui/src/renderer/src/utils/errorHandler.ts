// Enhanced error handler with full ErrorContext support
import {
  ErrorCategory,
  ErrorExplanation,
  ErrorContext,
  ErrorSeverity,
  Breadcrumb,
} from '../types/error';
import { createComponentLogger } from './logger';

const logger = createComponentLogger('ErrorHandler');

class ErrorHandler {
  createErrorContext(error: Error, componentStack?: string): ErrorContext {
    return {
      errorId: this.generateErrorId(),
      timestamp: Date.now(),
      category: this.categorizeError(error),
      severity: this.determineSeverity(error),
      userAgent: navigator.userAgent,
      appVersion: this.getAppVersion(),
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        memory: this.getMemoryInfo(),
      },
      userActions: [],
      componentStack: componentStack || '',
      breadcrumbs: [],
      url: window.location.href,
      sessionId: this.getSessionId(),
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('file') || message.includes('blob')) {
      return ErrorCategory.FILE_SYSTEM;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    return ErrorCategory.RUNTIME;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('warning') || message.includes('minor')) {
      return ErrorSeverity.LOW;
    }
    if (message.includes('important') || message.includes('major')) {
      return ErrorSeverity.HIGH;
    }
    return ErrorSeverity.MEDIUM;
  }

  private getAppVersion(): string {
    return process.env.npm_package_version || '1.0.0';
  }

  private getMemoryInfo() {
    try {
      const memory = (performance as any).memory;
      return memory
        ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          }
        : undefined;
    } catch {
      return undefined;
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('error_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('error_session_id', sessionId);
    }
    return sessionId;
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    logger.debug('Error breadcrumb added', { breadcrumb });
  }

  getErrorExplanation(error: Error, category: ErrorCategory): ErrorExplanation {
    const baseExplanation: ErrorExplanation = {
      title: this.getCategoryTitle(category),
      description: this.getCategoryDescription(category),
      possibleCauses: this.getPossibleCauses(category, error),
      suggestedActions: this.getSuggestedActions(category, error),
      technicalDetails: error.message,
    };

    return baseExplanation;
  }

  private getCategoryTitle(category: ErrorCategory): string {
    const titles: Record<ErrorCategory, string> = {
      [ErrorCategory.ENGINE_STARTUP]: 'Engine Startup Failed',
      [ErrorCategory.ENGINE_RUNTIME]: 'Engine Runtime Error',
      [ErrorCategory.ENGINE_EXIT]: 'Engine Process Terminated',
      [ErrorCategory.ENGINE_SPAWN]: 'Engine Launch Failed',
      [ErrorCategory.ENGINE_SETUP]: 'Engine Setup Required',
      [ErrorCategory.ENGINE_IPC]: 'Engine Communication Error',
      [ErrorCategory.PROCESSING]: 'Processing Error',
      [ErrorCategory.RUNTIME]: 'Application Runtime Error',
      [ErrorCategory.NETWORK]: 'Network Connection Error',
      [ErrorCategory.FILE_SYSTEM]: 'File System Error',
      [ErrorCategory.VALIDATION]: 'Validation Error',
      [ErrorCategory.UNKNOWN]: 'Unknown Error',
    };
    return titles[category] || 'Unknown Error';
  }

  private getCategoryDescription(category: ErrorCategory): string {
    const descriptions: Record<ErrorCategory, string> = {
      [ErrorCategory.ENGINE_STARTUP]: 'The subtitle generation engine failed to start properly.',
      [ErrorCategory.ENGINE_RUNTIME]:
        'An error occurred while the engine was processing your request.',
      [ErrorCategory.ENGINE_EXIT]:
        'The subtitle generation engine stopped unexpectedly during processing.',
      [ErrorCategory.ENGINE_SPAWN]: 'Unable to launch the subtitle generation engine.',
      [ErrorCategory.ENGINE_SETUP]: 'The engine requires initial setup or configuration.',
      [ErrorCategory.ENGINE_IPC]:
        'Communication with the subtitle generation engine was interrupted.',
      [ErrorCategory.PROCESSING]: 'An error occurred during the subtitle generation process.',
      [ErrorCategory.RUNTIME]: 'An unexpected error occurred in the application.',
      [ErrorCategory.NETWORK]: 'Unable to establish a network connection.',
      [ErrorCategory.FILE_SYSTEM]: 'Unable to access or modify files on your system.',
      [ErrorCategory.VALIDATION]: 'The provided input contains invalid data.',
      [ErrorCategory.UNKNOWN]: 'An unexpected error occurred.',
    };
    return descriptions[category] || 'An unexpected error occurred.';
  }

  private getPossibleCauses(category: ErrorCategory, _error: Error): string[] {
    const causes: Record<ErrorCategory, string[]> = {
      [ErrorCategory.ENGINE_STARTUP]: [
        'Python is not installed or not accessible',
        'Required Python dependencies are missing',
        'Engine files are corrupted or missing',
        'Insufficient system permissions',
      ],
      [ErrorCategory.ENGINE_RUNTIME]: [
        'Invalid input file format',
        'Insufficient system memory',
        'Engine configuration error',
        'Temporary file system issues',
      ],
      [ErrorCategory.ENGINE_EXIT]: [
        'Processing was manually cancelled',
        'System resource exhaustion',
        'Invalid processing parameters',
        'Engine encountered an unhandled exception',
      ],
      [ErrorCategory.ENGINE_SPAWN]: [
        'Python executable not found in system PATH',
        'Engine script files are missing or corrupted',
        'System security software blocking execution',
        'Insufficient system resources',
      ],
      [ErrorCategory.ENGINE_SETUP]: [
        'Initial engine configuration is incomplete',
        'Required dependencies need to be installed',
        'Engine needs to be updated or repaired',
        'System environment variables are not configured',
      ],
      [ErrorCategory.ENGINE_IPC]: [
        'Engine process terminated unexpectedly',
        'Communication protocol version mismatch',
        'System firewall or security software interference',
        'Engine process is unresponsive',
      ],
      [ErrorCategory.PROCESSING]: [
        'Input file is corrupted or unreadable',
        'Unsupported file format',
        'Insufficient disk space for processing',
        'Network interruption during cloud processing',
      ],
      [ErrorCategory.RUNTIME]: [
        'Application state corruption',
        'Browser compatibility issue',
        'Insufficient system memory',
        'Unexpected user interaction',
      ],
      [ErrorCategory.NETWORK]: [
        'Internet connection is unavailable',
        'Firewall blocking network requests',
        'DNS resolution failure',
        'Server is temporarily unavailable',
      ],
      [ErrorCategory.FILE_SYSTEM]: [
        'File is locked by another application',
        'Insufficient disk space',
        'File permissions are restrictive',
        'File path contains invalid characters',
      ],
      [ErrorCategory.VALIDATION]: [
        'Required fields are missing',
        'Input data format is incorrect',
        'File size exceeds maximum limit',
        'Invalid configuration parameters',
      ],
      [ErrorCategory.UNKNOWN]: [
        'Unexpected application state',
        'Third-party software interference',
        'System configuration issue',
        'Temporary system resource problem',
      ],
    };
    return causes[category] || ['An unexpected error occurred'];
  }

  private getSuggestedActions(category: ErrorCategory, _error: Error): string[] {
    const actions: Record<ErrorCategory, string[]> = {
      [ErrorCategory.ENGINE_STARTUP]: [
        'Run engine setup to install required dependencies',
        'Verify Python installation and PATH configuration',
        'Check system permissions for the application',
        'Restart the application as administrator if needed',
      ],
      [ErrorCategory.ENGINE_RUNTIME]: [
        'Try processing with different settings',
        'Verify input file integrity',
        'Free up system memory and retry',
        'Check available disk space',
      ],
      [ErrorCategory.ENGINE_EXIT]: [
        'Try the operation again',
        'Reduce processing complexity or file size',
        'Check system resources and close other applications',
        'Verify input file format and integrity',
      ],
      [ErrorCategory.ENGINE_SPAWN]: [
        'Run engine setup to configure the system',
        'Verify Python is installed and accessible',
        'Check antivirus software settings',
        'Restart the application with administrator privileges',
      ],
      [ErrorCategory.ENGINE_SETUP]: [
        "Click 'Run Engine Setup' to configure the system",
        'Ensure Python and pip are installed',
        'Check internet connection for dependency downloads',
        'Verify system has sufficient disk space',
      ],
      [ErrorCategory.ENGINE_IPC]: [
        'Restart the application',
        'Check system firewall settings',
        'Verify engine process is not blocked by antivirus',
        'Try processing with simpler settings',
      ],
      [ErrorCategory.PROCESSING]: [
        'Verify input file is valid and not corrupted',
        'Try processing a different file',
        'Check available disk space',
        'Verify network connection if using cloud features',
      ],
      [ErrorCategory.RUNTIME]: [
        'Refresh the application',
        'Clear browser cache and reload',
        'Close other applications to free memory',
        'Try the operation again',
      ],
      [ErrorCategory.NETWORK]: [
        'Check your internet connection',
        'Disable VPN or proxy temporarily',
        'Check firewall settings',
        'Try again in a few minutes',
      ],
      [ErrorCategory.FILE_SYSTEM]: [
        'Close any applications using the file',
        'Check available disk space',
        'Verify file permissions',
        'Try saving to a different location',
      ],
      [ErrorCategory.VALIDATION]: [
        'Verify all required fields are filled',
        'Check input data format',
        'Ensure file size is within limits',
        'Review configuration settings',
      ],
      [ErrorCategory.UNKNOWN]: [
        'Try the operation again',
        'Restart the application',
        'Check system resources',
        'Contact support if the problem persists',
      ],
    };
    return actions[category] || ['Try the operation again'];
  }

  captureException(error: Error, context?: ErrorContext): void {
    logger.error('Captured exception', {
      error: error.message,
      stack: error.stack,
      context,
    });
  }
}

export const errorHandler = new ErrorHandler();
