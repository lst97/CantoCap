/**
 * Comprehensive QA Test Suite for Enhanced Workflow & Session Management Integration
 * 
 * Tests the critical user journeys and integration points between session management,
 * workflow navigation, and workspace operations that were enhanced in recent phases.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  handleJsonImportWithSessionReset,
  handleVideoRemovalWithCleanup,
  handleProcessingCompletionWithSessionSetup,
  handleWorkspaceChangeWithSessionCoordination,
  performEnhancedSessionReset,
  type IntegratedOperationResult
} from '../../utils/session-workflow-integration'
import { 
  navigateToReviewFromJsonImport,
  navigateToReviewFromProcessing,
  navigateToConfig
} from '../../utils/workflow-navigation'

// Mock stores with realistic state
const mockSubtitleEditStore = {
  session: null,
  isLoading: false,
  error: null,
  performanceMonitoring: {
    enabled: true,
    indexedDBOperations: 0,
    totalOperationTime: 0,
    errorCount: 0,
    lastCleanup: Date.now()
  },
  sessionRecovery: {
    hasRecoverableSession: false,
    recoverableSessionId: null,
    lastSessionWorkspaceId: null
  },
  // Core session management actions
  resetSessionForNewContent: jest.fn(),
  cleanupWorkspaceSession: jest.fn().mockResolvedValue({
    deletedSessions: 2,
    deletedRecords: 15,
    reclaimedBytes: 1024 * 500 // 500KB
  }),
  initializeSession: jest.fn().mockResolvedValue(true),
  saveSessionToTempStorage: jest.fn().mockResolvedValue(true),
  checkAndRestoreWorkspaceSession: jest.fn().mockResolvedValue('session-123'),
  getWorkspaceSessionId: jest.fn().mockReturnValue('session-123'),
  hasWorkspaceSession: jest.fn().mockReturnValue(true),
  clearSessionForWorkspace: jest.fn(),
  getState: jest.fn().mockReturnValue(this)
}

const mockWorkspaceStore = {
  currentWorkspace: {
    id: 'workspace-test-123',
    name: 'Test Workspace',
    createdAt: Date.now(),
    lastModified: Date.now()
  },
  initializeWorkspaces: jest.fn().mockResolvedValue(true),
  getState: jest.fn().mockReturnValue(this)
}

const mockWorkflowStore = {
  steps: [
    { id: 'input-file', isCompleted: true, isAccessible: true },
    { id: 'config', isCompleted: false, isAccessible: false },
    { id: 'processing', isCompleted: false, isAccessible: false },
    { id: 'review', isCompleted: false, isAccessible: false },
    { id: 'export', isCompleted: false, isAccessible: false }
  ],
  currentStep: 'input-file',
  setCurrentStep: jest.fn(),
  completeStep: jest.fn(),
  markStepAsSkipped: jest.fn(),
  enableStep: jest.fn(),
  setStepImportContext: jest.fn(),
  executeAtomicOperation: jest.fn((operation) => {
    try {
      operation()
      return { 
        success: true, 
        rollbackFn: jest.fn(),
        previousState: { currentStep: 'input-file' }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        rollbackFn: jest.fn()
      }
    }
  }),
  initializeFromWorkspace: jest.fn().mockResolvedValue(true),
  getState: jest.fn().mockReturnValue(this)
}

// Mock the store imports
jest.mock('../../stores/subtitle-edit-store', () => ({
  useSubtitleEditStore: {
    getState: () => mockSubtitleEditStore
  }
}))

jest.mock('../../stores/workspace-store', () => ({
  useWorkspaceStore: {
    getState: () => mockWorkspaceStore
  }
}))

jest.mock('../../stores/workflow-store', () => ({
  useWorkflowStore: {
    getState: () => mockWorkflowStore
  }
}))

describe('🧪 Session-Workflow Integration QA Suite', () => {
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset store states
    mockSubtitleEditStore.session = null
    mockSubtitleEditStore.isLoading = false
    mockSubtitleEditStore.error = null
    
    mockWorkflowStore.currentStep = 'input-file'
    mockWorkflowStore.steps[0].isCompleted = true
    
    // Reset function implementations to defaults
    mockSubtitleEditStore.cleanupWorkspaceSession.mockResolvedValue({
      deletedSessions: 2,
      deletedRecords: 15,
      reclaimedBytes: 1024 * 500
    })
    mockSubtitleEditStore.initializeSession.mockResolvedValue(true)
    mockSubtitleEditStore.checkAndRestoreWorkspaceSession.mockResolvedValue('session-123')
    mockWorkflowStore.executeAtomicOperation.mockImplementation((operation) => {
      try {
        operation()
        return { 
          success: true, 
          rollbackFn: jest.fn(),
          previousState: { currentStep: 'input-file' }
        }
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          rollbackFn: jest.fn()
        }
      }
    })
  })

  describe('🎯 Critical User Journey 1: JSON Import → Direct Review Navigation', () => {
    
    it('should perform atomic JSON import with session reset and navigation to review', async () => {
      const testSubtitleData = [
        { id: '1', startTime: 1000, endTime: 3000, text: 'Test subtitle 1' },
        { id: '2', startTime: 4000, endTime: 6000, text: 'Test subtitle 2' }
      ]
      
      const result = await handleJsonImportWithSessionReset(testSubtitleData, {
        sourceType: 'json-import',
        timestamp: Date.now(),
        metadata: { fileName: 'test.json', subtitleCount: 2 }
      })
      
      // Verify atomic operation success
      expect(result.success).toBe(true)
      expect(result.sessionInitialized).toBe(true)
      expect(result.workspaceRebound).toBe(true)
      expect(result.sessionCleanupResult).toBeDefined()
      
      // Verify session operations were called in correct order
      expect(mockSubtitleEditStore.resetSessionForNewContent).toHaveBeenCalledWith('step1_import')
      expect(mockSubtitleEditStore.cleanupWorkspaceSession).toHaveBeenCalledWith('workspace-test-123')
      expect(mockSubtitleEditStore.initializeSession).toHaveBeenCalledWith(
        '', '', 'workspace-test-123', testSubtitleData, true
      )
      
      // Verify workflow navigation
      expect(mockWorkflowStore.executeAtomicOperation).toHaveBeenCalled()
      
      // Verify rollback capability
      expect(result.rollbackFn).toBeDefined()
      expect(typeof result.rollbackFn).toBe('function')
    })
    
    it('should handle session initialization failure gracefully', async () => {
      mockSubtitleEditStore.initializeSession.mockRejectedValue(new Error('Session init failed'))
      
      const testSubtitleData = [
        { id: '1', startTime: 1000, endTime: 3000, text: 'Test subtitle 1' }
      ]
      
      const result = await handleJsonImportWithSessionReset(testSubtitleData)
      
      // Should still succeed with navigation even if session init fails
      expect(result.success).toBe(true)
      expect(result.sessionInitialized).toBe(false)
      expect(mockSubtitleEditStore.resetSessionForNewContent).toHaveBeenCalled()
    })
    
    it('should handle navigation failure with proper rollback', async () => {
      mockWorkflowStore.executeAtomicOperation.mockReturnValue({
        success: false,
        error: 'Navigation failed',
        rollbackFn: jest.fn()
      })
      
      const testSubtitleData = [
        { id: '1', startTime: 1000, endTime: 3000, text: 'Test subtitle 1' }
      ]
      
      const result = await handleJsonImportWithSessionReset(testSubtitleData)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Navigation failed')
      expect(result.sessionCleanupResult).toBeDefined()
    })
  })

  describe('🗑️ Critical User Journey 2: Video Deletion → Session Cleanup & Rebinding', () => {
    
    it('should perform complete video removal with comprehensive cleanup', async () => {
      const result = await handleVideoRemovalWithCleanup()
      
      // Verify atomic operation success
      expect(result.success).toBe(true)
      expect(result.workspaceRebound).toBe(true)
      expect(result.sessionInitialized).toBe(false) // Should be false for video removal
      expect(result.sessionCleanupResult).toBeDefined()
      
      // Verify cleanup operations
      expect(mockSubtitleEditStore.resetSessionForNewContent).toHaveBeenCalledWith('step1_video_change')
      expect(mockSubtitleEditStore.cleanupWorkspaceSession).toHaveBeenCalledWith('workspace-test-123')
      expect(mockWorkspaceStore.initializeWorkspaces).toHaveBeenCalled()
      
      // Verify navigation to config step
      expect(mockWorkflowStore.setCurrentStep).toHaveBeenCalledWith('config')
    })
    
    it('should handle workspace rebinding failure gracefully', async () => {
      mockWorkspaceStore.initializeWorkspaces.mockRejectedValue(new Error('Rebind failed'))
      
      const result = await handleVideoRemovalWithCleanup()
      
      // Should still succeed even if rebind fails
      expect(result.success).toBe(true)
      expect(result.workspaceRebound).toBe(false)
      expect(mockSubtitleEditStore.resetSessionForNewContent).toHaveBeenCalled()
    })
    
    it('should handle cleanup errors and continue operation', async () => {
      mockSubtitleEditStore.cleanupWorkspaceSession.mockRejectedValue(new Error('Cleanup failed'))
      
      const result = await handleVideoRemovalWithCleanup()
      
      expect(result.success).toBe(true)
      expect(result.sessionCleanupResult).toBeUndefined()
    })
  })

  describe('⚙️ Critical User Journey 3: Processing Completion → Review Setup', () => {
    
    it('should setup session for review after processing completion', async () => {
      const processedSubtitleData = [
        { id: '1', startTime: 1000, endTime: 3000, text: 'Processed subtitle 1' },
        { id: '2', startTime: 4000, endTime: 6000, text: 'Processed subtitle 2' }
      ]
      
      // Mock no existing session scenario
      mockSubtitleEditStore.getWorkspaceSessionId.mockReturnValue(null)
      
      const result = await handleProcessingCompletionWithSessionSetup(processedSubtitleData, {
        sourceType: 'regular',
        timestamp: Date.now(),
        metadata: { processingTime: 5000 }
      })
      
      expect(result.success).toBe(true)
      expect(result.sessionInitialized).toBe(true)
      expect(result.workspaceRebound).toBe(true)
      
      // Verify session initialization with processed data
      expect(mockSubtitleEditStore.initializeSession).toHaveBeenCalledWith(
        '', '', 'workspace-test-123', processedSubtitleData, true
      )
      
      // Verify navigation to review
      expect(mockWorkflowStore.executeAtomicOperation).toHaveBeenCalled()
    })
    
    it('should use existing session if available', async () => {
      const processedSubtitleData = [
        { id: '1', startTime: 1000, endTime: 3000, text: 'Processed subtitle 1' }
      ]
      
      // Mock existing session scenario
      mockSubtitleEditStore.getWorkspaceSessionId.mockReturnValue('existing-session-456')
      
      const result = await handleProcessingCompletionWithSessionSetup(processedSubtitleData)
      
      expect(result.success).toBe(true)
      expect(result.sessionInitialized).toBe(true)
      
      // Should not initialize new session if one exists
      expect(mockSubtitleEditStore.initializeSession).not.toHaveBeenCalled()
    })
  })

  describe('🔄 Critical User Journey 4: Workspace Switching → Session Coordination', () => {
    
    it('should coordinate session data when switching workspaces', async () => {
      const newWorkspaceId = 'workspace-new-456'
      const previousWorkspaceId = 'workspace-test-123'
      
      const result = await handleWorkspaceChangeWithSessionCoordination(
        newWorkspaceId, 
        previousWorkspaceId
      )
      
      expect(result.success).toBe(true)
      expect(result.sessionInitialized).toBe(true)
      expect(result.workspaceRebound).toBe(true)
      
      // Verify session save for previous workspace
      expect(mockSubtitleEditStore.saveSessionToTempStorage).toHaveBeenCalled()
      
      // Verify session check and restore for new workspace
      expect(mockSubtitleEditStore.checkAndRestoreWorkspaceSession).toHaveBeenCalledWith(newWorkspaceId)
      
      // Verify workflow state synchronization
      expect(mockWorkflowStore.initializeFromWorkspace).toHaveBeenCalled()
    })
    
    it('should handle missing existing session in new workspace', async () => {
      mockSubtitleEditStore.checkAndRestoreWorkspaceSession.mockResolvedValue(null)
      
      const result = await handleWorkspaceChangeWithSessionCoordination('workspace-new-456')
      
      expect(result.success).toBe(true)
      expect(result.sessionInitialized).toBe(false)
      expect(result.workspaceRebound).toBe(true)
    })
    
    it('should handle session save failure gracefully', async () => {
      mockSubtitleEditStore.saveSessionToTempStorage.mockRejectedValue(new Error('Save failed'))
      
      const result = await handleWorkspaceChangeWithSessionCoordination(
        'workspace-new-456', 
        'workspace-test-123'
      )
      
      // Should continue operation even if save fails
      expect(result.success).toBe(true)
      expect(mockSubtitleEditStore.checkAndRestoreWorkspaceSession).toHaveBeenCalled()
    })
  })

  describe('🔧 Critical User Journey 5: Enhanced Session Reset Operations', () => {
    
    it('should perform enhanced session reset for video change', async () => {
      const result = await performEnhancedSessionReset('step1_video_change', 'workspace-test-123')
      
      expect(result.success).toBe(true)
      expect(result.workspaceRebound).toBe(true)
      expect(result.sessionInitialized).toBe(false)
      expect(result.sessionCleanupResult).toBeDefined()
      
      // Verify reset and cleanup operations
      expect(mockSubtitleEditStore.resetSessionForNewContent).toHaveBeenCalledWith('step1_video_change')
      expect(mockSubtitleEditStore.cleanupWorkspaceSession).toHaveBeenCalledWith('workspace-test-123')
      expect(mockWorkflowStore.initializeFromWorkspace).toHaveBeenCalled()
    })
    
    it('should perform enhanced session reset for subtitle generation', async () => {
      const result = await performEnhancedSessionReset('step3_generation')
      
      expect(result.success).toBe(true)
      
      // Should use current workspace when none specified
      expect(mockSubtitleEditStore.resetSessionForNewContent).toHaveBeenCalledWith('step3_generation')
      expect(mockSubtitleEditStore.cleanupWorkspaceSession).toHaveBeenCalledWith('workspace-test-123')
    })
    
    it('should skip workspace cleanup for import operations', async () => {
      const result = await performEnhancedSessionReset('step1_import')
      
      expect(result.success).toBe(true)
      expect(result.sessionCleanupResult).toBeUndefined()
      
      // Should only do basic reset for import
      expect(mockSubtitleEditStore.resetSessionForNewContent).toHaveBeenCalledWith('step1_import')
      expect(mockSubtitleEditStore.cleanupWorkspaceSession).not.toHaveBeenCalled()
    })
  })

  describe('🔐 Integration Point Testing: Session ↔ IndexedDB', () => {
    
    it('should validate session cleanup returns proper metrics', async () => {
      const mockCleanupResult = {
        deletedSessions: 5,
        deletedRecords: 42,
        reclaimedBytes: 1024 * 2048 // 2MB
      }
      
      mockSubtitleEditStore.cleanupWorkspaceSession.mockResolvedValue(mockCleanupResult)
      
      const result = await handleVideoRemovalWithCleanup()
      
      expect(result.sessionCleanupResult).toEqual(mockCleanupResult)
      expect(result.sessionCleanupResult?.reclaimedBytes).toBeGreaterThan(1024 * 1024) // > 1MB
    })
    
    it('should handle IndexedDB operation failures gracefully', async () => {
      mockSubtitleEditStore.cleanupWorkspaceSession.mockRejectedValue(
        new Error('IndexedDB: QuotaExceededError')
      )
      
      const result = await handleVideoRemovalWithCleanup()
      
      // Should continue operation even with IndexedDB errors
      expect(result.success).toBe(true)
      expect(result.sessionCleanupResult).toBeUndefined()
    })
  })

  describe('🔄 Integration Point Testing: Workflow ↔ Session State', () => {
    
    it('should maintain workflow state consistency during session operations', async () => {
      const testSubtitleData = [
        { id: '1', startTime: 1000, endTime: 3000, text: 'Test subtitle' }
      ]
      
      await handleJsonImportWithSessionReset(testSubtitleData)
      
      // Verify workflow synchronization was called
      expect(mockWorkflowStore.initializeFromWorkspace).toHaveBeenCalled()
      
      // Verify atomic operation was used for navigation
      expect(mockWorkflowStore.executeAtomicOperation).toHaveBeenCalled()
    })
    
    it('should handle workflow synchronization failures', async () => {
      mockWorkflowStore.initializeFromWorkspace.mockRejectedValue(new Error('Sync failed'))
      
      const result = await performEnhancedSessionReset('step1_video_change')
      
      // Should still report success even if sync fails
      expect(result.success).toBe(true)
    })
  })

  describe('🏪 Integration Point Testing: App Store ↔ Integrated Systems', () => {
    
    it('should verify workspace store integration during operations', async () => {
      const result = await handleVideoRemovalWithCleanup()
      
      // Verify workspace store was accessed for current workspace
      expect(mockWorkspaceStore.getState).toHaveBeenCalled()
      
      // Verify workspace initialization was called
      expect(mockWorkspaceStore.initializeWorkspaces).toHaveBeenCalled()
    })
    
    it('should handle missing current workspace gracefully', async () => {
      mockWorkspaceStore.currentWorkspace = null
      
      const result = await handleVideoRemovalWithCleanup()
      
      expect(result.success).toBe(true)
      expect(result.sessionCleanupResult).toBeUndefined()
    })
  })

  describe('🔧 Error Recovery & System Stability', () => {
    
    it('should provide comprehensive error information on failure', async () => {
      const testError = new Error('Critical system failure')
      mockSubtitleEditStore.resetSessionForNewContent.mockImplementation(() => {
        throw testError
      })
      
      const result = await handleJsonImportWithSessionReset([])
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Critical system failure')
      expect(result.sessionInitialized).toBe(false)
    })
    
    it('should maintain system stability during concurrent operations', async () => {
      // Simulate concurrent operations
      const operations = [
        handleJsonImportWithSessionReset([{ id: '1', startTime: 1000, endTime: 2000, text: 'Test 1' }]),
        handleVideoRemovalWithCleanup(),
        performEnhancedSessionReset('step1_video_change'),
        handleWorkspaceChangeWithSessionCoordination('workspace-concurrent-789')
      ]
      
      const results = await Promise.allSettled(operations)
      
      // All operations should complete (either successfully or with handled errors)
      expect(results.every(result => result.status === 'fulfilled')).toBe(true)
      
      // Verify no unhandled exceptions
      const fulfillResults = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)
      expect(fulfillResults.length).toBe(4)
    })
  })

  describe('📊 Performance Validation', () => {
    
    it('should complete atomic operations within performance thresholds', async () => {
      const startTime = performance.now()
      
      await handleJsonImportWithSessionReset([
        { id: '1', startTime: 1000, endTime: 2000, text: 'Performance test' }
      ])
      
      const operationTime = performance.now() - startTime
      
      // Atomic operations should complete within 100ms
      expect(operationTime).toBeLessThan(100)
    })
    
    it('should handle large session cleanup efficiently', async () => {
      const largeCleanupResult = {
        deletedSessions: 100,
        deletedRecords: 5000,
        reclaimedBytes: 1024 * 1024 * 50 // 50MB
      }
      
      mockSubtitleEditStore.cleanupWorkspaceSession.mockResolvedValue(largeCleanupResult)
      
      const startTime = performance.now()
      const result = await handleVideoRemovalWithCleanup()
      const operationTime = performance.now() - startTime
      
      expect(result.success).toBe(true)
      expect(result.sessionCleanupResult?.reclaimedBytes).toBeGreaterThan(1024 * 1024 * 10) // > 10MB
      
      // Even large cleanup should complete within reasonable time
      expect(operationTime).toBeLessThan(200)
    })
  })
})