/**
 * End-to-End Integration Tests for WorkflowStateManager
 * Tests complete workflow scenarios, persistence integration, and cross-app reload scenarios
 */

import { jest } from '@jest/globals'
import { WorkflowStateManager } from '../workflow-state-manager'
import {
  StepState,
  createStepId,
  createTimestamp,
  createVersion,
  WorkflowStateSnapshot,
  WorkflowStatePersistence,
  StateChangeEvent,
  WORKFLOW_CONSTANTS
} from '../../types/workflow-state'

// Mock browser APIs
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000
  }
} as any

global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16)
  return 1
})

// Mock IndexedDB for persistence testing
class MockIndexedDBPersistence implements WorkflowStatePersistence {
  private storage: WorkflowStateSnapshot | null = null
  private shouldFail = false

  async saveState(snapshot: WorkflowStateSnapshot): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Storage error')
    }
    this.storage = { ...snapshot }
  }

  async loadState(): Promise<WorkflowStateSnapshot | null> {
    if (this.shouldFail) {
      throw new Error('Load error')
    }
    return this.storage ? { ...this.storage } : null
  }

  async clearState(): Promise<void> {
    this.storage = null
  }

  async hasStoredState(): Promise<boolean> {
    return this.storage !== null
  }

  async getStorageInfo(): Promise<{ size: number; lastModified: number }> {
    if (!this.storage) {
      return { size: 0, lastModified: 0 }
    }
    return {
      size: JSON.stringify(this.storage).length,
      lastModified: this.storage.timestamp
    }
  }

  // Test helper methods
  simulateFailure(fail: boolean = true) {
    this.shouldFail = fail
  }

  getStoredData() {
    return this.storage
  }
}

jest.useFakeTimers()

describe('WorkflowStateManager - End-to-End Integration', () => {
  let manager: WorkflowStateManager
  let persistence: MockIndexedDBPersistence
  let stateChangeEvents: StateChangeEvent[] = []

  beforeEach(() => {
    jest.clearAllMocks()
    stateChangeEvents = []
    persistence = new MockIndexedDBPersistence()
    
    manager = new WorkflowStateManager({
      strictValidation: true,
      enableLogging: false,
      maxHistoryEntries: 50,
      persistence,
      autoSaveInterval: 1000 // 1 second for testing
    })

    manager.subscribe((event) => {
      stateChangeEvents.push(event)
    })

    jest.runOnlyPendingTimers()
  })

  afterEach(() => {
    manager.destroy()
    jest.runOnlyPendingTimers()
  })

  describe('Complete Workflow Execution', () => {
    it('should execute complete subtitle generation workflow', async () => {
      // Step 1: Upload file (input-file)
      expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      expect(manager.isStepAccessible('input-file')).toBe(true)
      
      const inputResult = await manager.transitionState('input-file', StepState.Complete, {
        reason: 'File uploaded successfully',
        context: { fileName: 'test-video.mp4', duration: 120 }
      })
      
      expect(inputResult.success).toBe(true)
      expect(manager.getStepState('config')).toBe(StepState.Ready) // Should be unblocked
      
      // Step 2: Configure settings (config)
      const configResult = await manager.transitionState('config', StepState.Complete, {
        reason: 'Configuration completed',
        context: { language: 'cantonese', outputFormat: 'srt' }
      })
      
      expect(configResult.success).toBe(true)
      expect(manager.getStepState('processing')).toBe(StepState.Ready)
      
      // Step 3: Process video (processing)
      const processingResult = await manager.transitionState('processing', StepState.Complete, {
        reason: 'Processing completed',
        context: { subtitlesGenerated: 45, totalDuration: 120 }
      })
      
      expect(processingResult.success).toBe(true)
      expect(manager.getStepState('review')).toBe(StepState.Ready)
      
      // Step 4: Review subtitles (review)
      const reviewResult = await manager.transitionState('review', StepState.Complete, {
        reason: 'Review completed',
        context: { editsCount: 3, finalApproval: true }
      })
      
      expect(reviewResult.success).toBe(true)
      expect(manager.getStepState('export')).toBe(StepState.Ready)
      
      // Step 5: Export files (export)
      const exportResult = await manager.transitionState('export', StepState.Complete, {
        reason: 'Export completed',
        context: { filesSaved: ['subtitles.srt', 'subtitles.vtt'], exportPath: '/downloads' }
      })
      
      expect(exportResult.success).toBe(true)
      
      // Verify final state
      const allSteps = manager.getAllSteps()
      const allComplete = Array.from(allSteps.values()).every(
        step => step.stateMetadata.state === StepState.Complete
      )
      expect(allComplete).toBe(true)
      
      // Verify workflow history
      const history = manager.getStateHistory()
      expect(history.length).toBe(5) // One transition per step
      
      // Verify all events were emitted
      expect(stateChangeEvents.length).toBe(5)
    })

    it('should handle workflow with errors and recovery', async () => {
      // Complete first two steps normally
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('config', StepState.Complete)
      
      // Processing step encounters error
      const errorResult = await manager.transitionState('processing', StepState.Error, {
        message: 'Transcription service unavailable',
        reason: 'Service timeout',
        context: { errorCode: 503, retryAfter: 30 }
      })
      
      expect(errorResult.success).toBe(true)
      expect(manager.getStepState('processing')).toBe(StepState.Error)
      expect(manager.getStepState('review')).toBe(StepState.Blocked) // Should remain blocked
      
      // Recover from error
      const recoveryResult = await manager.transitionState('processing', StepState.Ready, {
        reason: 'Service restored, retrying',
        context: { retryAttempt: 1 }
      })
      
      expect(recoveryResult.success).toBe(true)
      
      // Complete processing after recovery
      await manager.transitionState('processing', StepState.Complete, {
        reason: 'Processing completed after retry',
        context: { retrySuccessful: true, subtitlesGenerated: 45 }
      })
      
      expect(manager.getStepState('review')).toBe(StepState.Ready)
      
      // Continue workflow normally
      await manager.transitionState('review', StepState.Complete)
      await manager.transitionState('export', StepState.Complete)
      
      // Verify error recovery is recorded in history
      const history = manager.getStateHistory()
      const errorEvents = history.filter(event => 
        event.newState === StepState.Error || event.oldState === StepState.Error
      )
      expect(errorEvents.length).toBe(2) // Error transition and recovery
    })

    it('should handle workflow with skipped steps', async () => {
      // Complete input and config
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('config', StepState.Complete)
      
      // Skip processing (e.g., using pre-existing subtitles)
      const skipResult = await manager.transitionState('processing', StepState.Skip, {
        reason: 'Using pre-existing subtitles',
        context: { skipReason: 'subtitles-provided', existingFile: 'subtitles.srt' }
      })
      
      expect(skipResult.success).toBe(true)
      expect(manager.getStepState('processing')).toBe(StepState.Skip)
      
      // Review step should still be blocked (skipped step doesn't unblock next)
      expect(manager.getStepState('review')).toBe(StepState.Blocked)
      
      // Manually unblock review by setting it ready
      await manager.transitionState('review', StepState.Ready, {
        reason: 'Review enabled for pre-existing subtitles'
      })
      
      // Complete remaining workflow
      await manager.transitionState('review', StepState.Complete)
      await manager.transitionState('export', StepState.Complete)
      
      // Verify mixed completion states
      expect(manager.getStepState('processing')).toBe(StepState.Skip)
      expect(manager.getStepState('review')).toBe(StepState.Complete)
      expect(manager.getStepState('export')).toBe(StepState.Complete)
    })

    it('should handle workflow reset and restart', async () => {
      // Complete partial workflow
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('config', StepState.Complete)
      await manager.transitionState('processing', StepState.Complete)
      
      // Reset workflow
      manager.reset()
      
      // Verify reset state
      expect(manager.getCurrentStep()).toBe(createStepId('input-file'))
      expect(manager.getStepState('input-file')).toBe(StepState.Ready)
      expect(manager.getStepState('config')).toBe(StepState.Blocked)
      expect(manager.getStepState('processing')).toBe(StepState.Blocked)
      expect(manager.getStepState('review')).toBe(StepState.Blocked)
      expect(manager.getStepState('export')).toBe(StepState.Blocked)
      
      // History should be cleared
      expect(manager.getStateHistory()).toHaveLength(0)
      
      // Should be able to restart workflow
      await manager.transitionState('input-file', StepState.Complete, {
        reason: 'Restarted workflow with new file'
      })
      
      expect(manager.getStepState('config')).toBe(StepState.Ready)
    })
  })

  describe('Persistence and App Reload Scenarios', () => {
    it('should persist and restore complete workflow state', async () => {
      // Execute partial workflow
      await manager.transitionState('input-file', StepState.Complete, {
        context: { fileName: 'video.mp4' }
      })
      await manager.transitionState('config', StepState.Complete, {
        context: { settings: { language: 'cantonese' } }
      })
      await manager.transitionState('processing', StepState.Warning, {
        message: 'Low confidence in some segments',
        context: { confidenceIssues: 5 }
      })
      
      // Save state
      await manager.saveState()
      
      // Verify state was persisted
      const storedData = persistence.getStoredData()
      expect(storedData).not.toBeNull()
      expect(storedData?.currentStepId).toBe(createStepId('input-file'))
      
      // Simulate app restart - create new manager
      const newManager = new WorkflowStateManager({
        strictValidation: true,
        enableLogging: false,
        maxHistoryEntries: 50,
        persistence
      })
      
      // Load state
      const loadResult = await newManager.loadState()
      expect(loadResult).toBe(true)
      
      // Verify state restoration
      expect(newManager.getStepState('input-file')).toBe(StepState.Complete)
      expect(newManager.getStepState('config')).toBe(StepState.Complete)
      expect(newManager.getStepState('processing')).toBe(StepState.Warning)
      expect(newManager.getStepState('review')).toBe(StepState.Blocked)
      
      // Verify context data was restored
      const processingStep = newManager.getStep('processing')
      expect(processingStep?.stateMetadata.context).toMatchObject({
        confidenceIssues: 5
      })
      
      // Continue workflow from restored state
      await newManager.transitionState('processing', StepState.Complete)
      expect(newManager.getStepState('review')).toBe(StepState.Ready)
      
      newManager.destroy()
    })

    it('should handle persistence failures gracefully', async () => {
      // Simulate storage failure
      persistence.simulateFailure(true)
      
      // Complete some workflow steps
      await manager.transitionState('input-file', StepState.Complete)
      await manager.transitionState('config', StepState.Complete)
      
      // Attempt to save (should fail)
      await expect(manager.saveState()).rejects.toThrow('Storage error')
      
      // Manager should still be functional
      expect(manager.getStepState('input-file')).toBe(StepState.Complete)
      expect(manager.getStepState('config')).toBe(StepState.Complete)
      
      // Restore storage functionality
      persistence.simulateFailure(false)
      
      // Save should now work
      await expect(manager.saveState()).resolves.not.toThrow()
    })

    it('should handle missing persistence gracefully', async () => {
      const managerWithoutPersistence = new WorkflowStateManager({
        strictValidation: true,
        enableLogging: false,
        maxHistoryEntries: 50
        // No persistence provided
      })
      
      // Should still function normally
      await managerWithoutPersistence.transitionState('input-file', StepState.Complete)
      expect(managerWithoutPersistence.getStepState('input-file')).toBe(StepState.Complete)
      
      // Save/load should be no-ops
      await expect(managerWithoutPersistence.saveState()).resolves.not.toThrow()
      const loadResult = await managerWithoutPersistence.loadState()
      expect(loadResult).toBe(false)
      
      managerWithoutPersistence.destroy()
    })

    it('should handle corrupted persistence data', async () => {
      // Save valid state first
      await manager.transitionState('input-file', StepState.Complete)
      await manager.saveState()
      
      // Simulate corrupted data by directly modifying storage
      const corruptedData = {
        currentStepId: 'invalid-step-id',
        steps: {
          'invalid-step': {
            id: 'invalid-step',
            stateMetadata: { state: 'invalid-state' }
          }
        },
        timestamp: 'invalid-timestamp',
        version: 'invalid-version'
      } as any
      
      await persistence.saveState(corruptedData)
      
      // Create new manager and attempt to load corrupted data
      const newManager = new WorkflowStateManager({
        strictValidation: true,
        enableLogging: false,
        maxHistoryEntries: 50,
        persistence
      })
      
      // Load should fail gracefully
      const loadResult = await newManager.loadState()
      expect(loadResult).toBe(false)
      
      // Manager should initialize with default state
      expect(newManager.getStepState('input-file')).toBe(StepState.Ready)
      expect(newManager.getStepState('config')).toBe(StepState.Blocked)
      
      newManager.destroy()
    })
  })

  describe('Auto-Save Functionality', () => {
    it('should auto-save at configured intervals', async () => {
      // Make a state change
      await manager.transitionState('input-file', StepState.Complete)
      
      // Advance timer to trigger auto-save
      jest.advanceTimersByTime(1000)
      
      // Wait for auto-save to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify auto-save occurred
      const storedData = persistence.getStoredData()
      expect(storedData).not.toBeNull()
      expect(storedData?.steps[createStepId('input-file')]).toMatchObject({
        stateMetadata: expect.objectContaining({
          state: StepState.Complete
        })
      })
    })

    it('should handle auto-save errors without affecting functionality', async () => {
      // Simulate storage failure
      persistence.simulateFailure(true)
      
      // Make state changes
      await manager.transitionState('input-file', StepState.Complete)
      
      // Advance timer to trigger auto-save
      jest.advanceTimersByTime(1000)
      
      // Wait for auto-save attempt
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Manager should still be functional despite auto-save failure
      expect(manager.getStepState('input-file')).toBe(StepState.Complete)
      
      // Can still make manual saves after fixing storage
      persistence.simulateFailure(false)
      await expect(manager.saveState()).resolves.not.toThrow()
    })
  })

  describe('Complex Integration Scenarios', () => {
    it('should handle batch operations in workflow context', async () => {
      // Batch transition multiple steps
      const batchResult = await manager.batchTransition([
        { stepId: createStepId('input-file'), newState: StepState.Complete },
        { stepId: createStepId('config'), newState: StepState.Ready },
        { stepId: createStepId('processing'), newState: StepState.Ready }
      ])
      
      expect(batchResult.success).toBe(true)
      
      // Verify dependency logic still works
      expect(manager.getStepState('input-file')).toBe(StepState.Complete)
      expect(manager.getStepState('config')).toBe(StepState.Ready)
      expect(manager.getStepState('processing')).toBe(StepState.Ready)
      
      // Review should still be blocked (processing not complete)
      expect(manager.getStepState('review')).toBe(StepState.Blocked)
    })

    it('should maintain performance under realistic usage patterns', async () => {
      const startTime = performance.now()
      
      // Simulate realistic workflow usage with multiple cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        // Forward progression
        await manager.transitionState('input-file', StepState.Complete)
        await manager.transitionState('config', StepState.Complete)
        await manager.transitionState('processing', StepState.Complete)
        await manager.transitionState('review', StepState.Complete)
        await manager.transitionState('export', StepState.Complete)
        
        // Save state
        await manager.saveState()
        
        // Reset for next cycle
        manager.reset()
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete multiple cycles efficiently
      expect(duration).toBeLessThan(1000) // 1 second for 5 complete cycles
      
      // Memory should be reasonable
      const metrics = manager.getPerformanceMetrics()
      expect(metrics.memoryUsage).toBeLessThan(10000000) // 10MB
    })

    it('should handle concurrent workflow instances', async () => {
      // Create multiple manager instances (simulating multiple browser tabs)
      const manager1 = new WorkflowStateManager({ persistence, enableLogging: false })
      const manager2 = new WorkflowStateManager({ persistence, enableLogging: false })
      
      try {
        // Progress both workflows
        await manager1.transitionState('input-file', StepState.Complete)
        await manager2.transitionState('input-file', StepState.Complete)
        
        // Save from both (last one wins)
        await manager1.saveState()
        await manager2.saveState()
        
        // Create new manager and load state
        const manager3 = new WorkflowStateManager({ persistence, enableLogging: false })
        const loadResult = await manager3.loadState()
        
        expect(loadResult).toBe(true)
        expect(manager3.getStepState('input-file')).toBe(StepState.Complete)
        
        manager3.destroy()
      } finally {
        manager1.destroy()
        manager2.destroy()
      }
    })

    it('should provide comprehensive workflow analytics', async () => {
      // Execute complete workflow with timing
      const startTime = Date.now()
      
      await manager.transitionState('input-file', StepState.Complete, {
        context: { startTime, fileName: 'video.mp4' }
      })
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      await manager.transitionState('config', StepState.Complete, {
        context: { configTime: Date.now() - startTime }
      })
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      await manager.transitionState('processing', StepState.Complete, {
        context: { processingTime: Date.now() - startTime, segmentsProcessed: 45 }
      })
      
      await manager.transitionState('review', StepState.Complete, {
        context: { reviewTime: Date.now() - startTime, editsCount: 3 }
      })
      
      await manager.transitionState('export', StepState.Complete, {
        context: { totalTime: Date.now() - startTime, exportSize: 1024 }
      })
      
      // Analyze workflow completion
      const history = manager.getStateHistory()
      const totalSteps = Array.from(manager.getAllSteps().values())
      const completedSteps = totalSteps.filter(step => step.stateMetadata.state === StepState.Complete)
      
      expect(completedSteps.length).toBe(5)
      expect(history.length).toBe(5)
      
      // Verify timing data is preserved
      const exportStep = manager.getStep('export')
      expect(exportStep?.stateMetadata.context).toHaveProperty('totalTime')
      expect(exportStep?.stateMetadata.context).toHaveProperty('exportSize')
      
      // Performance metrics should be available
      const metrics = manager.getPerformanceMetrics()
      expect(metrics.stateTransitionTime).toBeGreaterThanOrEqual(0)
      expect(metrics.notificationTime).toBeGreaterThanOrEqual(0)
      expect(metrics.observerCount).toBeGreaterThanOrEqual(0)
    })
  })
})