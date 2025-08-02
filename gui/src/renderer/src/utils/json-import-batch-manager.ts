/**
 * JSON Import Batch Manager
 * 
 * Manages batch operation flags and prevents race conditions during JSON import
 */

interface BatchState {
  isActive: boolean;
  startTime: number;
  timeoutId?: number;
  deferredIntegration?: any;
}

const BATCH_TIMEOUT = 5000; // 5 seconds max for batch operations
const CLEANUP_INTERVAL = 10000; // Check for stuck flags every 10 seconds

/**
 * Start a JSON import batch operation
 */
export const startJsonImportBatch = (): void => {
  console.log('🚀 Starting JSON import batch operation');
  
  // Clear any existing batch state
  clearJsonImportBatch();
  
  const startTime = Date.now();
  (window as any).__JSON_IMPORT_IN_PROGRESS = true;
  (window as any).__JSON_IMPORT_START_TIME = startTime;
  
  // Set a timeout to automatically clear stuck batches
  const timeoutId = setTimeout(() => {
    console.warn('⚠️ JSON import batch timeout - force clearing batch flag');
    clearJsonImportBatch();
  }, BATCH_TIMEOUT);
  
  (window as any).__JSON_IMPORT_TIMEOUT_ID = timeoutId;
};

/**
 * End a JSON import batch operation
 */
export const endJsonImportBatch = (): void => {
  const duration = (window as any).__JSON_IMPORT_START_TIME 
    ? Date.now() - (window as any).__JSON_IMPORT_START_TIME 
    : 0;
    
  console.log('🏁 Ending JSON import batch operation', { duration });
  
  // Clear timeout
  if ((window as any).__JSON_IMPORT_TIMEOUT_ID) {
    clearTimeout((window as any).__JSON_IMPORT_TIMEOUT_ID);
    delete (window as any).__JSON_IMPORT_TIMEOUT_ID;
  }
  
  // Clear batch flags
  delete (window as any).__JSON_IMPORT_START_TIME;
  (window as any).__JSON_IMPORT_IN_PROGRESS = false;
};

/**
 * Force clear batch state (for cleanup/recovery)
 */
export const clearJsonImportBatch = (): void => {
  console.log('🧹 Clearing JSON import batch state');
  
  // Clear timeout if exists
  if ((window as any).__JSON_IMPORT_TIMEOUT_ID) {
    clearTimeout((window as any).__JSON_IMPORT_TIMEOUT_ID);
    delete (window as any).__JSON_IMPORT_TIMEOUT_ID;
  }
  
  // Clear all batch-related flags
  delete (window as any).__JSON_IMPORT_START_TIME;
  (window as any).__JSON_IMPORT_IN_PROGRESS = false;
  
  // Clear any deferred integration
  delete (window as any).__DEFERRED_JSON_INTEGRATION;
  
  // Clear integration timeouts
  if ((window as any).__INTEGRATION_TIMEOUTS) {
    Object.values((window as any).__INTEGRATION_TIMEOUTS).forEach((timeoutId: any) => {
      clearTimeout(timeoutId);
    });
    delete (window as any).__INTEGRATION_TIMEOUTS;
  }
};

/**
 * Check if batch operation is currently active
 */
export const isJsonImportBatchActive = (): boolean => {
  return !!(window as any).__JSON_IMPORT_IN_PROGRESS;
};

/**
 * Get batch operation status and duration
 */
export const getJsonImportBatchStatus = (): BatchState => {
  const isActive = !!(window as any).__JSON_IMPORT_IN_PROGRESS;
  const startTime = (window as any).__JSON_IMPORT_START_TIME || 0;
  
  return {
    isActive,
    startTime,
    timeoutId: (window as any).__JSON_IMPORT_TIMEOUT_ID,
    deferredIntegration: (window as any).__DEFERRED_JSON_INTEGRATION
  };
};

/**
 * Defer an integration operation until batch completes
 */
export const deferJsonIntegration = (integrationData: any): void => {
  console.log('📋 Deferring JSON integration until batch completes');
  (window as any).__DEFERRED_JSON_INTEGRATION = {
    ...integrationData,
    deferredAt: Date.now()
  };
};

/**
 * Get and clear any deferred integration
 */
export const getDeferredJsonIntegration = (): any | null => {
  const deferred = (window as any).__DEFERRED_JSON_INTEGRATION;
  if (deferred) {
    delete (window as any).__DEFERRED_JSON_INTEGRATION;
    console.log('📤 Retrieved deferred JSON integration:', deferred);
  }
  return deferred;
};

/**
 * Initialize cleanup monitoring (call once at app startup)
 */
export const initializeBatchCleanupMonitor = (): void => {
  // Periodic cleanup of stuck batch operations
  setInterval(() => {
    const status = getJsonImportBatchStatus();
    if (status.isActive && status.startTime) {
      const duration = Date.now() - status.startTime;
      if (duration > BATCH_TIMEOUT) {
        console.warn('⚠️ Detected stuck JSON import batch operation, force cleaning');
        clearJsonImportBatch();
      }
    }
  }, CLEANUP_INTERVAL);
  
  console.log('🔧 JSON import batch cleanup monitor initialized');
};

/**
 * Safe execution wrapper for batch operations
 */
export const executeInBatch = async <T>(operation: () => Promise<T>): Promise<T> => {
  startJsonImportBatch();
  
  try {
    const result = await operation();
    return result;
  } catch (error) {
    console.error('❌ Batch operation failed:', error);
    throw error;
  } finally {
    endJsonImportBatch();
  }
};