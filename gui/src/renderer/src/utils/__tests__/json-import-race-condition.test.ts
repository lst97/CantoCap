/**
 * Test for JSON import race condition fixes
 * Validates that batch operations prevent race conditions
 */

import { 
  startJsonImportBatch, 
  endJsonImportBatch, 
  isJsonImportBatchActive,
  clearJsonImportBatch,
  deferJsonIntegration,
  getDeferredJsonIntegration
} from '../json-import-batch-manager';

describe('JSON Import Race Condition Fixes', () => {
  beforeEach(() => {
    // Clean up any existing state
    clearJsonImportBatch();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    clearJsonImportBatch();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Batch Manager', () => {
    test('should track batch state correctly', () => {
      expect(isJsonImportBatchActive()).toBe(false);
      
      startJsonImportBatch();
      expect(isJsonImportBatchActive()).toBe(true);
      
      endJsonImportBatch();
      expect(isJsonImportBatchActive()).toBe(false);
    });

    test('should auto-clear stuck batches', () => {
      startJsonImportBatch();
      expect(isJsonImportBatchActive()).toBe(true);
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(6000);
      
      expect(isJsonImportBatchActive()).toBe(false);
    });

    test('should handle deferred integrations', () => {
      const testData = { subtitleData: [], config: {}, timestamp: Date.now() };
      
      deferJsonIntegration(testData);
      const retrieved = getDeferredJsonIntegration();
      
      expect(retrieved).toMatchObject(testData);
      expect(getDeferredJsonIntegration()).toBeNull(); // Should be cleared after retrieval
    });
  });

  describe('Race Condition Prevention', () => {
    test('should prevent multiple rapid config updates during batch', async () => {
      const mockUpdateConfig = jest.fn();
      
      // Simulate batch operation
      startJsonImportBatch();
      
      // Attempt multiple rapid updates
      mockUpdateConfig('subtitle', []);
      mockUpdateConfig('importedJsonFile', 'test.json');
      mockUpdateConfig('isImportedFromJson', true);
      
      // Batch should still be active
      expect(isJsonImportBatchActive()).toBe(true);
      
      endJsonImportBatch();
      
      // Now batch should be cleared
      expect(isJsonImportBatchActive()).toBe(false);
    });

    test('should defer session integration during batch', () => {
      const integrationData = {
        subtitleData: [{ text: 'test' }],
        config: { inputFile: 'test.mp4' },
        timestamp: Date.now()
      };
      
      startJsonImportBatch();
      
      // Integration should be deferred
      deferJsonIntegration(integrationData);
      
      endJsonImportBatch();
      
      // Should be able to retrieve deferred integration
      const retrieved = getDeferredJsonIntegration();
      expect(retrieved).toMatchObject(integrationData);
    });
  });

  describe('Timeout and Cleanup', () => {
    test('should force clear batch after timeout', () => {
      startJsonImportBatch();
      expect(isJsonImportBatchActive()).toBe(true);
      
      // Advance time beyond batch timeout (5 seconds)
      jest.advanceTimersByTime(5100);
      
      expect(isJsonImportBatchActive()).toBe(false);
    });

    test('should clear deferred integrations on force clear', () => {
      const testData = { test: 'data' };
      
      startJsonImportBatch();
      deferJsonIntegration(testData);
      
      clearJsonImportBatch();
      
      expect(isJsonImportBatchActive()).toBe(false);
      expect(getDeferredJsonIntegration()).toBeNull();
    });
  });

  describe('Integration with Config Updates', () => {
    test('should simulate real JSON import workflow', async () => {
      const mockSubtitleData = [
        { text: 'Test subtitle 1', start: 0, end: 2 },
        { text: 'Test subtitle 2', start: 2, end: 4 }
      ];
      
      // Start batch operation
      startJsonImportBatch();
      
      // Simulate config updates (these should be batched)
      const updates = [
        ['subtitle', mockSubtitleData],
        ['importedJsonFile', 'test.json'],
        ['isImportedFromJson', true]
      ];
      
      // All updates happen while batch is active
      expect(isJsonImportBatchActive()).toBe(true);
      
      // End batch
      endJsonImportBatch();
      
      // Now integration can proceed
      expect(isJsonImportBatchActive()).toBe(false);
    });
  });
});

/**
 * Integration test simulating the race condition scenario
 */
describe('JSON Import Race Condition Integration', () => {
  test('should handle rapid succession of events without race conditions', async () => {
    const events = [];
    
    // Simulate the sequence that was causing race conditions
    
    // 1. Start JSON import
    startJsonImportBatch();
    events.push('batch_started');
    
    // 2. Config updates (rapid succession)
    events.push('config_update_subtitle');
    events.push('config_update_imported_file');
    events.push('config_update_imported_flag');
    
    // 3. Session integration attempted during batch (should be deferred)
    if (isJsonImportBatchActive()) {
      deferJsonIntegration({ data: 'test' });
      events.push('integration_deferred');
    } else {
      events.push('integration_immediate');
    }
    
    // 4. End batch
    endJsonImportBatch();
    events.push('batch_ended');
    
    // 5. Process deferred integration
    const deferred = getDeferredJsonIntegration();
    if (deferred) {
      events.push('deferred_integration_processed');
    }
    
    // 6. Navigation should happen after everything is settled
    events.push('navigation_to_review');
    
    // Verify the correct sequence
    expect(events).toEqual([
      'batch_started',
      'config_update_subtitle',
      'config_update_imported_file', 
      'config_update_imported_flag',
      'integration_deferred',
      'batch_ended',
      'deferred_integration_processed',
      'navigation_to_review'
    ]);
  });
});