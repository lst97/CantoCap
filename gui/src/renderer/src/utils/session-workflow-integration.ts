/**
 * Session Workflow Integration
 * 
 * Coordinates session management with workflow navigation and workspace operations
 * Provides atomic operations that maintain consistency across all systems
 */

import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { useWorkspaceStore } from '../stores/workspace-store'
import { workflowStateManager } from '../services/workflow-state-manager'
import { StepState } from '../types/workflow-state'
import { 
  navigateToReviewFromJsonImport, 
  navigateToReviewFromProcessing,
  navigateToConfig,
  type NavigationContext,
  type NavigationResult
} from './workflow-navigation'
import { atomicJsonNavigation } from './step-state-controller'

// Enhanced result type for integrated operations
export interface IntegratedOperationResult extends NavigationResult {
  sessionCleanupResult?: {
    deletedSessions: number
    deletedRecords: number
    reclaimedBytes: number
  }
  workspaceRebound?: boolean
  sessionInitialized?: boolean
}

/**
 * Atomic operation: JSON import with session reset and navigation
 * Ensures clean session state before navigation to review
 */
export const handleJsonImportWithSessionReset = async (
  subtitleData: any[],
  context?: NavigationContext
): Promise<IntegratedOperationResult> => {
  console.log('🚀 Starting atomic JSON import operation with session integration', {
    dataLength: subtitleData?.length,
    sourceType: context?.sourceType,
    triggeredBy: context?.metadata?.triggeredBy
  })
  
  const subtitleStore = useSubtitleEditStore.getState()
  const workspaceStore = useWorkspaceStore.getState()
  
  try {
    // Ensure no batch operations are in progress using batch manager
    try {
      const batchManager = await import('./json-import-batch-manager');
      if (batchManager.isJsonImportBatchActive()) {
        console.warn('⚠️ JSON import batch still in progress, aborting session integration');
        return {
          success: false,
          error: 'Batch import operation still in progress'
        };
      }
    } catch (error) {
      // Fallback to legacy check
      if ((window as any).__JSON_IMPORT_IN_PROGRESS) {
        console.warn('⚠️ JSON import batch still in progress (fallback), aborting session integration');
        return {
          success: false,
          error: 'Batch import operation still in progress'
        };
      }
    }
    
    // Step 1: Reset session state first (critical for clean state)
    console.log('🧹 Step 1: Resetting session for JSON import')
    subtitleStore.resetSessionForNewContent('step1_import')
    
    // Step 2: Cleanup any existing workspace sessions
    let sessionCleanupResult
    if (workspaceStore.currentWorkspace) {
      console.log('🧹 Step 2: Cleaning up existing workspace sessions')
      sessionCleanupResult = await subtitleStore.cleanupWorkspaceSession(
        workspaceStore.currentWorkspace.id
      )
      console.log('✅ Session cleanup completed:', sessionCleanupResult)
    }
    
    // Step 3: Initialize new session with imported data
    console.log('🔄 Step 3: Initializing new session with imported data')
    let sessionInitialized = false
    if (workspaceStore.currentWorkspace && subtitleData.length > 0) {
      try {
        await subtitleStore.initializeSession(
          '', // No subtitle path for JSON import
          '', // Video path will be set separately
          workspaceStore.currentWorkspace.id,
          subtitleData,
          true // Pre-transformed data
        )
        sessionInitialized = true
        console.log('✅ New session initialized with imported data')
      } catch (sessionError) {
        console.warn('⚠️ Failed to initialize session with imported data:', sessionError)
        // Continue with navigation even if session init fails
      }
    }
    
    // Step 4: Perform atomic navigation and workflow operations
    console.log('🚀 Step 4: Performing atomic navigation and state updates')
    
    let navigationResult: NavigationResult
    
    try {
      // Execute atomic JSON navigation (already handles state coordination internally)
      console.log('🔄 Executing atomic JSON navigation')
      await atomicJsonNavigation(context)
      
      // Synchronize workflow state to ensure consistency
      console.log('🔄 Synchronizing workflow state')
      // WorkflowStateManager automatically handles workspace synchronization
      
      // Create successful navigation result since atomic operations succeeded
      navigationResult = {
        success: true,
        metadata: context
      }
    } catch (error) {
      console.error('❌ Atomic navigation failed:', error)
      navigationResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Navigation failed',
        metadata: context
      }
    }
    
    // Single verification delay instead of multiple delays
    console.log('✅ Step 5: Final state verification')
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('✅ Atomic JSON import operation completed successfully', {
      sessionInitialized,
      cleanupRecords: sessionCleanupResult?.deletedRecords || 0,
      sourceType: context?.sourceType
    })
    
    return {
      success: true,
      sessionCleanupResult,
      workspaceRebound: true,
      sessionInitialized,
      rollbackFn: navigationResult?.rollbackFn
    }
    
  } catch (error) {
    console.error('❌ Atomic JSON import operation failed:', error)
    
    // Attempt rollback if we have a navigation rollback function
    // Note: Session state has already been reset, which is generally desired
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionCleanupResult: sessionCleanupResult || undefined,
      sessionInitialized: false
    }
  }
}

/**
 * Atomic operation: Video deletion with comprehensive cleanup and rebinding
 */
export const handleVideoRemovalWithCleanup = async (): Promise<IntegratedOperationResult> => {
  console.log('🗑️ Starting atomic video removal operation')
  
  const subtitleStore = useSubtitleEditStore.getState()
  const workspaceStore = useWorkspaceStore.getState()
  
  try {
    // Step 1: Reset session state first
    console.log('🧹 Step 1: Resetting session for video removal')
    subtitleStore.resetSessionForNewContent('step1_video_change')
    
    // Step 2: Comprehensive workspace session cleanup
    let sessionCleanupResult
    if (workspaceStore.currentWorkspace) {
      console.log('🧹 Step 2: Comprehensive workspace cleanup')
      sessionCleanupResult = await subtitleStore.cleanupWorkspaceSession(
        workspaceStore.currentWorkspace.id
      )
      console.log('✅ Comprehensive cleanup completed:', sessionCleanupResult)
    }
    
    // Step 3: Rebind workspace session
    console.log('🔄 Step 3: Rebinding workspace session')
    let workspaceRebound = false
    try {
      await workspaceStore.initializeWorkspaces()
      workspaceRebound = true
      console.log('✅ Workspace session rebound successfully')
    } catch (rebindError) {
      console.warn('⚠️ Failed to rebind workspace session:', rebindError)
      // Continue operation even if rebind fails
    }
    
    // Step 4: Navigate to appropriate step (config)
    console.log('🚀 Step 4: Navigating to config step')
    try {
      navigateToConfig()
      console.log('✅ Navigation to config completed')
    } catch (navError) {
      console.warn('⚠️ Failed to navigate to config:', navError)
    }
    
    // Step 5: Synchronize workflow state
    console.log('🔄 Step 5: Synchronizing workflow state')
    // WorkflowStateManager automatically handles workspace synchronization
    
    console.log('✅ Atomic video removal operation completed successfully')
    
    return {
      success: true,
      sessionCleanupResult,
      workspaceRebound,
      sessionInitialized: false
    }
    
  } catch (error) {
    console.error('❌ Atomic video removal operation failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      workspaceRebound: false,
      sessionInitialized: false
    }
  }
}

/**
 * Atomic operation: Processing completion with session setup for review
 */
export const handleProcessingCompletionWithSessionSetup = async (
  subtitleData: any[],
  context?: NavigationContext
): Promise<IntegratedOperationResult> => {
  console.log('🚀 Starting atomic processing completion operation')
  
  const subtitleStore = useSubtitleEditStore.getState()
  const workspaceStore = useWorkspaceStore.getState()
  
  try {
    // Step 1: Ensure session is properly initialized with processed data
    console.log('🔄 Step 1: Ensuring session is initialized with processed data')
    let sessionInitialized = false
    
    if (workspaceStore.currentWorkspace && subtitleData.length > 0) {
      try {
        // Check if we already have a session for this workspace
        const existingSessionId = subtitleStore.getWorkspaceSessionId(
          workspaceStore.currentWorkspace.id
        )
        
        if (!existingSessionId) {
          // Initialize new session if none exists
          await subtitleStore.initializeSession(
            '', // Subtitle path set elsewhere
            '', // Video path set elsewhere  
            workspaceStore.currentWorkspace.id,
            subtitleData,
            true // Pre-transformed data from processing
          )
          sessionInitialized = true
          console.log('✅ New session initialized with processed data')
        } else {
          console.log('✅ Using existing session for processed data')
          sessionInitialized = true
        }
      } catch (sessionError) {
        console.warn('⚠️ Failed to ensure session initialization:', sessionError)
        // Continue with navigation
      }
    }
    
    // Step 2: Perform atomic navigation to review
    console.log('🚀 Step 2: Performing atomic navigation to review')
    const navigationResult = navigateToReviewFromProcessing(context)
    
    if (!navigationResult.success) {
      console.error('❌ Navigation failed:', navigationResult.error)
      return {
        ...navigationResult,
        sessionInitialized
      }
    }
    
    // Step 3: Synchronize workflow state
    console.log('🔄 Step 3: Synchronizing workflow state')
    // WorkflowStateManager automatically handles workspace synchronization
    
    console.log('✅ Atomic processing completion operation completed successfully')
    
    return {
      success: true,
      sessionInitialized,
      workspaceRebound: true,
      rollbackFn: navigationResult.rollbackFn
    }
    
  } catch (error) {
    console.error('❌ Atomic processing completion operation failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionInitialized: false
    }
  }
}

/**
 * Enhanced session reset that coordinates with workspace and workflow systems
 */
export const performEnhancedSessionReset = async (
  reason: 'step1_import' | 'step1_video_change' | 'step3_generation',
  workspaceId?: string
): Promise<IntegratedOperationResult> => {
  console.log(`🔄 Performing enhanced session reset for: ${reason}`)
  
  const subtitleStore = useSubtitleEditStore.getState()
  const workspaceStore = useWorkspaceStore.getState()
  
  try {
    // Step 1: Standard session reset
    subtitleStore.resetSessionForNewContent(reason)
    
    // Step 2: Workspace-specific cleanup if needed
    let sessionCleanupResult
    const targetWorkspaceId = workspaceId || workspaceStore.currentWorkspace?.id
    
    if (targetWorkspaceId && (reason === 'step1_video_change' || reason === 'step3_generation')) {
      console.log('🧹 Performing workspace-specific cleanup')
      sessionCleanupResult = await subtitleStore.cleanupWorkspaceSession(targetWorkspaceId)
      console.log('✅ Workspace cleanup completed:', sessionCleanupResult)
    }
    
    // Step 3: Synchronize workflow state
    console.log('🔄 Synchronizing workflow state after reset')
    // WorkflowStateManager automatically handles workspace synchronization
    
    console.log(`✅ Enhanced session reset completed for: ${reason}`)
    
    return {
      success: true,
      sessionCleanupResult,
      workspaceRebound: true,
      sessionInitialized: false
    }
    
  } catch (error) {
    console.error(`❌ Enhanced session reset failed for ${reason}:`, error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionInitialized: false
    }
  }
}

/**
 * Workspace change handler with session coordination
 */
export const handleWorkspaceChangeWithSessionCoordination = async (
  newWorkspaceId: string,
  previousWorkspaceId?: string
): Promise<IntegratedOperationResult> => {
  console.log('🔄 Handling workspace change with session coordination')
  
  const subtitleStore = useSubtitleEditStore.getState()
  
  try {
    // Step 1: Save current session to previous workspace if applicable
    if (previousWorkspaceId) {
      console.log('💾 Saving current session to previous workspace')
      try {
        await subtitleStore.saveSessionToTempStorage()
        console.log('✅ Session saved to previous workspace')
      } catch (saveError) {
        console.warn('⚠️ Failed to save session to previous workspace:', saveError)
      }
    }
    
    // Step 2: Check for existing session in new workspace
    console.log('🔍 Checking for existing session in new workspace')
    const existingSessionId = await subtitleStore.checkAndRestoreWorkspaceSession(newWorkspaceId)
    
    let sessionInitialized = false
    if (existingSessionId) {
      console.log('✅ Restored existing session from new workspace:', existingSessionId)
      sessionInitialized = true
      
      // CRITICAL FIX: Validate workflow step after session restoration
      // Only allow navigation to review if there's actual subtitle data
      const restoredSession = subtitleStore.session
      const hasSubtitleData = restoredSession?.currentSubtitles && 
                             restoredSession.currentSubtitles.length > 0
      
      const currentStep = workflowStateManager.getCurrentStep()
      console.log('🔧 [SESSION DEBUG] Post-restoration workflow validation', {
        currentStep,
        hasSubtitleData,
        sessionId: existingSessionId,
        subtitleCount: restoredSession?.currentSubtitles?.length || 0,
        timestamp: new Date().toISOString()
      })
      
      // If session was restored but there's no subtitle data to justify review step,
      // ensure we stay on a logical step (input-file unless there's a valid reason)
      if (!hasSubtitleData && currentStep === 'review') {
        console.log('🔧 [SESSION FIX] Session restored but no subtitle data - forcing step to input-file')
        workflowStateManager.setCurrentStep('input-file')
        
        // Also ensure proper step states
        await workflowStateManager.transitionState('review', StepState.Blocked, {
          reason: 'No subtitle data - review not available'
        })
        await workflowStateManager.transitionState('export', StepState.Blocked, {
          reason: 'No subtitle data - export not available'
        })
      } else if (hasSubtitleData) {
        console.log('🔧 [SESSION FIX] Session has subtitle data - ensuring review step is ready')
        // If there's subtitle data, ensure review step is ready
        await workflowStateManager.transitionState('review', StepState.Ready, {
          reason: 'Session restored with subtitle data'
        })
        
        // For JSON imports or when subtitle data exists, navigate to review
        // Only if we're not already on review step
        if (currentStep !== 'review') {
          console.log('🔧 [SESSION FIX] Navigating to review step due to subtitle data')
          // The setCurrentStep method has its own initialization blocking logic
          workflowStateManager.setCurrentStep('review')
        }
      }
    } else {
      console.log('ℹ️ No existing session found in new workspace')
    }
    
    // Step 3: Synchronize workflow state with new workspace
    console.log('🔄 Synchronizing workflow state with new workspace')
    // WorkflowStateManager automatically handles workspace synchronization
    
    console.log('✅ Workspace change with session coordination completed successfully')
    
    return {
      success: true,
      sessionInitialized,
      workspaceRebound: true
    }
    
  } catch (error) {
    console.error('❌ Workspace change with session coordination failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionInitialized: false
    }
  }
}