/**
 * IPC Error Handling Utilities
 * 
 * Provides robust error handling and recovery mechanisms for IPC communication
 * to prevent "Object has been destroyed" errors and improve user experience.
 */

// Common IPC error types
export interface IPCError extends Error {
  code?: string;
  isIPCError?: boolean;
}

/**
 * Enhanced error detection for IPC failures
 */
export const isIPCError = (error: unknown): error is IPCError => {
  if (!(error instanceof Error)) return false;
  
  const message = error.message.toLowerCase();
  return (
    message.includes('object has been destroyed') ||
    message.includes('ipc') ||
    message.includes('context bridge') ||
    message.includes('electron') ||
    message.includes('invoke')
  );
};

/**
 * Safe IPC call wrapper with retry and error recovery
 */
export const safeIPCCall = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 2,
  retryDelay: number = 100
): Promise<{ success: boolean; data?: T; error?: string }> => {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      lastError = error;
      console.warn(`🔄 IPC call '${operationName}' failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      
      // Don't retry if it's not an IPC-related error
      if (!isIPCError(error)) {
        break;
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }
  
  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown IPC error';
  console.error(`❌ IPC call '${operationName}' failed after ${maxRetries + 1} attempts:`, lastError);
  
  return { 
    success: false, 
    error: `IPC communication failed: ${errorMessage}` 
  };
};

/**
 * Check if context bridge APIs are available
 */
export const checkIPCAvailability = (): boolean => {
  try {
    const window = globalThis.window as any;
    return !!(window?.cantocapAPI && typeof window.cantocapAPI === 'object');
  } catch {
    return false;
  }
};

/**
 * Get safe reference to cantocapAPI with error handling
 */
export const getSafeAPI = () => {
  try {
    const window = globalThis.window as any;
    if (!window?.cantocapAPI) {
      throw new Error('CantoCap API not available - context bridge may not be initialized');
    }
    return window.cantocapAPI;
  } catch (error) {
    console.error('Failed to access CantoCap API:', error);
    return null;
  }
};

/**
 * Enhanced workflow IPC helpers with error recovery
 */
export const workflowIPC = {
  setCurrentStep: async (workspaceId: string, step: string) => {
    return safeIPCCall(
      () => getSafeAPI()?.workflowSetCurrentStep(workspaceId, step),
      'workflow:setCurrentStep'
    );
  },
  
  setStepState: async (workspaceId: string, step: string, state: string) => {
    return safeIPCCall(
      () => getSafeAPI()?.workflowSetStepState(workspaceId, step, state),
      'workflow:setStepState'
    );
  },
  
  resetState: async (workspaceId: string) => {
    return safeIPCCall(
      () => getSafeAPI()?.workflowResetState(workspaceId),
      'workflow:resetState'
    );
  },
  
  getState: async (workspaceId: string) => {
    return safeIPCCall(
      () => getSafeAPI()?.workflowGetState(workspaceId),
      'workflow:getState'
    );
  }
};

/**
 * Enhanced processing IPC helpers with error recovery
 */
export const processingIPC = {
  start: async (config: any) => {
    return safeIPCCall(
      () => getSafeAPI()?.processingStart(config),
      'processing:start'
    );
  },
  
  cancel: async () => {
    return safeIPCCall(
      () => getSafeAPI()?.processingCancel(),
      'processing:cancel'
    );
  },
  
  convertConfig: async (stepConfig: any) => {
    return safeIPCCall(
      () => getSafeAPI()?.processingConvertConfig(stepConfig),
      'processing:convertConfig'
    );
  },
  
  getTimeEstimate: async (config: any) => {
    return safeIPCCall(
      () => getSafeAPI()?.processingGetTimeEstimate(config),
      'processing:getTimeEstimate'
    );
  },
  
  validateFFmpeg: async () => {
    return safeIPCCall(
      () => getSafeAPI()?.processingValidateFFmpeg(),
      'processing:validateFFmpeg'
    );
  }
};