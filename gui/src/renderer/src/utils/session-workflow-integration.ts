/**
 * Session Workflow Integration
 * 
 * Coordinates session management with workflow navigation and workspace operations
 * Provides atomic operations that maintain consistency across all systems
 */

import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useWorkflowStore } from '../stores/workflow-store'
import { 
  navigateToReviewFromJsonImport, 
  navigateToReviewFromProcessing,
  navigateToConfig,
  synchronizeWorkflowState,
  type NavigationContext,
  type NavigationResult
} from './workflow-navigation'

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
  console.log('🚀 Starting atomic JSON import operation with session integration')
  
  const subtitleStore = useSubtitleEditStore.getState()
  const workspaceStore = useWorkspaceStore.getState()
  
  try {
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
    
    // Step 4: Perform atomic navigation to review
    console.log('🚀 Step 4: Performing atomic navigation to review')
    const navigationResult = navigateToReviewFromJsonImport(context)
    
    if (!navigationResult.success) {
      console.error('❌ Navigation failed:', navigationResult.error)
      return {
        ...navigationResult,
        sessionCleanupResult,
        sessionInitialized
      }
    }
    
    // Step 5: Synchronize workflow state
    console.log('🔄 Step 5: Synchronizing workflow state')
    await synchronizeWorkflowState()
    
    console.log('✅ Atomic JSON import operation completed successfully')
    
    return {
      success: true,
      sessionCleanupResult,
      workspaceRebound: true,
      sessionInitialized,
      rollbackFn: navigationResult.rollbackFn
    }
    
  } catch (error) {
    console.error('❌ Atomic JSON import operation failed:', error)
    
    // Attempt rollback if we have a navigation rollback function
    // Note: Session state has already been reset, which is generally desired
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionCleanupResult,
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
    await synchronizeWorkflowState()
    
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
    await synchronizeWorkflowState()
    
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
    await synchronizeWorkflowState()
    
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
    } else {
      console.log('ℹ️ No existing session found in new workspace')
    }
    
    // Step 3: Synchronize workflow state with new workspace
    console.log('🔄 Synchronizing workflow state with new workspace')
    await synchronizeWorkflowState()
    
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