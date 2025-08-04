/**
 * useAutoSaveIntegration Hook (DEPRECATED - Timer Logic Removed)
 * 
 * Legacy bridge between subtitle editing actions and temp storage system.
 * Timer-based auto-save has been replaced by event-driven configuration system.
 * This hook now only provides session management functionality.
 */

import { useCallback } from 'react'
import { useSubtitleTempStorage, UseSubtitleTempStorageOptions } from './useSubtitleTempStorage'
import { useWorkspaceConfig } from '../contexts/WorkspaceConfigContext'
import type { SubtitleTempContent } from '../types/subtitle-temp-storage'
import type { SubtitleData } from '../../../types'
import { getSessionManager } from '../utils/session-manager'

export interface AutoSaveIntegrationOptions extends UseSubtitleTempStorageOptions {
  /** Enable debug logging */
  debug?: boolean
  /** DEPRECATED: Timer-based auto-save disabled */
  disabled?: boolean
  /** Enable enhanced session management */
  enhancedSessionManagement?: boolean
}

export interface AutoSaveIntegrationResult {
  // Session state (simplified)
  currentSession: any
  hasRecoverableSession: boolean
  
  // Manual controls (preserved for compatibility)
  forceSave: () => Promise<void>
  createBackup: (description?: string) => Promise<void>
  clearContent: () => void
  
  // Initialization (simplified)
  initializeFromSubtitles: (subtitles: SubtitleData[], originalPath?: string) => Promise<void>
  initializeFromImport: (subtitles: SubtitleData[], importPath: string) => Promise<void>
  
  // Recovery
  recoverSession: (sessionId?: string) => Promise<void>
  
  // Cleanup
  cleanup: () => Promise<void>
  
  // Session management
  sessionManager: any | null
}

export function useAutoSaveIntegration(
  options: AutoSaveIntegrationOptions = {}
): AutoSaveIntegrationResult {
  const { currentWorkspaceId, isWorkspaceReady } = useWorkspaceConfig()
  const {
    debug = false,
    disabled = true, // PERMANENTLY DISABLED - Timer-based auto-save removed
    enhancedSessionManagement = false,
    ...tempStorageOptions
  } = options

  // Initialize session manager (if enabled)
  const sessionManager = enhancedSessionManagement 
    ? getSessionManager({
        enablePerformanceMonitoring: false,
        debug
      })
    : null

  // Initialize temp storage (without auto-save timers)
  const tempStorage = useSubtitleTempStorage({
    autoSaveEnabled: false, // Disabled - using event-driven system instead
    enableSessionRecovery: true,
    onError: (error) => {
      if (debug) console.error('🚨 Session storage error:', error)
    },
    onSessionRecovered: (session) => {
      if (debug) console.log('🔄 Session recovered:', session.sessionId)
    },
    ...tempStorageOptions
  })

  // Convert subtitle data to temp storage content (simplified)
  const convertToTempContent = useCallback(async (
    subtitles: SubtitleData[], 
    originalPath?: string,
    sessionId?: string
  ): Promise<SubtitleTempContent> => {
    const now = Date.now()
    
    return {
      metadata: {
        contentId: sessionId || `content_${now}`,
        workspaceId: currentWorkspaceId || 'unknown',
        sessionId: sessionId || `session_${now}`,
        originalPath: originalPath || '',
        tempPath: `temp/${now}_subtitles.json`,
        contentType: 'subtitle_session',
        version: 1,
        createdAt: now,
        lastModified: now,
        dataSize: JSON.stringify(subtitles).length,
        contentHash: `hash_${now}`,
        isCompressed: false
      },
      subtitles,
      editingContext: {
        currentTime: 0,
        selectedSubtitleId: null,
        isVideoPlaying: false,
        videoDuration: 0,
        videoPath: '',
        editingMode: 'simple' as const,
        autoSaveEnabled: false,
        lastUserAction: now
      },
      changeTracking: {
        changeCount: 1,
        lastUserAction: now,
        modifiedIds: new Set(subtitles.map(s => s.id))
      },
      validationState: {
        isValid: true,
        warnings: [],
        errors: [],
        lastValidation: now,
        needsRevalidation: false
      }
    }
  }, [currentWorkspaceId])

  // Manual force save (simplified)
  const forceSave = useCallback(async () => {
    try {
      if (debug) console.log('🔄 Force save requested (no-op - using event-driven system)')
    } catch (error) {
      console.error('🚨 Force save failed:', error)
      throw error
    }
  }, [debug])

  // Create manual backup (simplified)
  const createBackup = useCallback(async (description?: string) => {
    try {
      if (debug) console.log('💾 Manual backup requested:', description)
    } catch (error) {
      console.error('🚨 Backup creation failed:', error)
      throw error
    }
  }, [debug])

  // Initialize from subtitle array (simplified)
  const initializeFromSubtitles = useCallback(async (
    subtitles: SubtitleData[], 
    originalPath?: string
  ) => {
    try {
      if (debug) {
        console.log('🚀 Initialize from subtitles:', {
          subtitleCount: subtitles.length,
          originalPath
        })
      }
    } catch (error) {
      console.error('🚨 Failed to initialize from subtitles:', error)
      throw error
    }
  }, [debug])

  // Initialize from imported JSON (simplified)
  const initializeFromImport = useCallback(async (
    subtitles: SubtitleData[], 
    importPath: string
  ) => {
    try {
      if (debug) {
        console.log('📥 Initialize from import:', {
          subtitleCount: subtitles.length,
          importPath
        })
      }
    } catch (error) {
      console.error('🚨 Failed to initialize from import:', error)
      throw error
    }
  }, [debug])

  // Recover session (simplified)
  const recoverSession = useCallback(async (sessionId?: string) => {
    try {
      if (debug) console.log('🔄 Session recovery requested:', sessionId)
    } catch (error) {
      console.error('🚨 Session recovery failed:', error)
      throw error
    }
  }, [debug])

  // Cleanup function (simplified)
  const cleanup = useCallback(async () => {
    try {
      if (debug) console.log('🧹 Cleanup requested')
    } catch (error) {
      console.error('🚨 Cleanup failed:', error)
    }
  }, [debug])

  return {
    // Session state (simplified)
    currentSession: tempStorage.currentSession,
    hasRecoverableSession: tempStorage.hasRecoverableSession,
    
    // Manual controls (preserved for compatibility)
    forceSave,
    createBackup,
    clearContent: tempStorage.clearContent,
    
    // Initialization (simplified)
    initializeFromSubtitles,
    initializeFromImport,
    
    // Recovery
    recoverSession,
    
    // Cleanup
    cleanup,
    
    // Session management
    sessionManager
  }
}