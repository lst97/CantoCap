/**
 * useAutoSaveIntegration Hook
 * 
 * Bridge between subtitle editing actions and temp storage auto-save system.
 * Listens to subtitle edit store changes and triggers temp storage updates.
 */

import { useEffect, useCallback, useRef } from 'react'
import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { useSubtitleTempStorage, UseSubtitleTempStorageOptions } from './useSubtitleTempStorage'
import { useWorkspaceConfig } from '../contexts/WorkspaceConfigContext'
import type { SubtitleTempContent } from '../types/subtitle-temp-storage'
import type { SubtitleData } from '../../../types'
import { ContentHashManager } from '../utils/performance-optimized-hash'
import { PerformanceMonitor } from '../utils/performance-utils'
import { globalPerformanceAnalyzer, logPerformanceImprovement } from '../utils/performance-monitoring-report'
import { getSessionManager, quickCleanupWorkspace, quickCheckRecovery } from '../utils/session-manager'

export interface AutoSaveIntegrationOptions extends UseSubtitleTempStorageOptions {
  /** Enable debug logging */
  debug?: boolean
  /** Custom debounce delay for auto-save (default: 2000ms) */
  autoSaveDebounce?: number
  /** Disable auto-save integration (for testing) */
  disabled?: boolean
  /** Enable enhanced session management */
  enhancedSessionManagement?: boolean
  /** Auto-cleanup old sessions */
  autoCleanupEnabled?: boolean
}

export interface AutoSaveIntegrationResult {
  // Temp storage state
  isAutoSaving: boolean
  hasUnsavedChanges: boolean
  lastSaveTime: number | null
  
  // Session state
  currentSession: any
  hasRecoverableSession: boolean
  
  // Manual controls
  forceSave: () => Promise<void>
  createBackup: (description?: string) => Promise<void>
  clearContent: () => void
  
  // Initialization
  initializeFromSubtitles: (subtitles: SubtitleData[], originalPath?: string) => Promise<void>
  initializeFromImport: (subtitles: SubtitleData[], importPath: string) => Promise<void>
  
  // Enhanced recovery
  recoverSession: (sessionId?: string) => Promise<void>
  
  // Enhanced cleanup
  cleanup: () => Promise<void>
  
  // Enhanced features
  sessionManager: any | null
  performanceMetrics: any | null
}

export function useAutoSaveIntegration(
  options: AutoSaveIntegrationOptions = {}
): AutoSaveIntegrationResult {
  const { currentWorkspaceId, isWorkspaceReady } = useWorkspaceConfig()
  const {
    debug = false,
    autoSaveDebounce = 2000,
    disabled = true, // PERMANENTLY DISABLED FOR PERFORMANCE - auto-save causes 2-3 second delays and infinite re-renders
    enhancedSessionManagement = false, // PERMANENTLY DISABLED FOR PERFORMANCE
    autoCleanupEnabled = false, // PERMANENTLY DISABLED FOR PERFORMANCE
    ...tempStorageOptions
  } = options

  // Initialize session manager
  const sessionManager = enhancedSessionManagement 
    ? getSessionManager({
        enablePerformanceMonitoring: true,
        autoCleanupInterval: autoCleanupEnabled ? 60 * 60 * 1000 : 0, // 1 hour
        maxSessionAge: 7, // days
        debug
      })
    : null

  // Get subtitle edit store state and actions
  const {
    session,
    undoStack,
    redoStack,
    isLoading: storeLoading
  } = useSubtitleEditStore()

  // Initialize temp storage with auto-save enabled
  const tempStorage = useSubtitleTempStorage({
    autoSaveEnabled: !disabled,
    autoSaveInterval: 30000, // 30 seconds background auto-save
    enableSessionRecovery: true,
    onError: (error) => {
      if (debug) console.error('🚨 Auto-save temp storage error:', error)
    },
    onAutoSave: (metadata) => {
      if (debug) console.log('💾 Auto-save completed:', metadata.id, metadata.lastModified)
    },
    onSessionRecovered: (session) => {
      if (debug) console.log('🔄 Session recovered:', session.sessionId)
    },
    ...tempStorageOptions
  })

  // Refs for debouncing and tracking
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedChangeRef = useRef<number>(0)
  const isInitializedRef = useRef<boolean>(false)
  const lastSubtitleHashRef = useRef<string>('')
  const isCleaningUpRef = useRef<boolean>(false)
  const ongoingAutoSaveRef = useRef<Promise<void> | null>(null)

  // Create subtitle content hash for change detection - optimized version
  const createSubtitleHash = useCallback(async (subtitles: SubtitleData[]): Promise<string> => {
    const hashData = subtitles.map(s => ({ id: s.id, text: s.text, startTime: s.startTime, endTime: s.endTime }))
    return ContentHashManager.calculateOptimizedHash(hashData, {
      requiresCrypto: false,
      useCache: true,
      priority: 'speed'
    })
  }, [])

  // Convert subtitle edit session to temp storage content - optimized version
  const convertToTempContent = useCallback(async (
    subtitles: SubtitleData[], 
    originalPath?: string,
    sessionId?: string
  ): Promise<SubtitleTempContent> => {
    const now = Date.now()
    
    // Calculate content hash asynchronously with caching
    const contentHash = await ContentHashManager.calculateOptimizedHash(subtitles, {
      requiresCrypto: false,
      useCache: true,
      priority: 'speed'
    })
    
    return {
      metadata: {
        contentId: sessionId || session?.sessionId || `content_${now}`,
        workspaceId: currentWorkspaceId || 'unknown',
        sessionId: sessionId || session?.sessionId || `session_${now}`,
        originalPath: originalPath || session?.subtitlePath || '',
        tempPath: `temp/${now}_subtitles.json`,
        contentType: 'subtitle_session',
        version: 1,
        createdAt: now,
        lastModified: now,
        dataSize: 0, // Calculate lazily to avoid blocking
        contentHash,
        isCompressed: false
      },
      subtitles,
      editingContext: {
        currentTime: session?.currentTime || 0,
        selectedSubtitleId: session?.selectedSubtitleId || null,
        isVideoPlaying: session?.isVideoPlaying || false,
        videoDuration: session?.videoDuration || 0,
        videoPath: session?.videoPath || '',
        editingMode: 'simple' as const,
        autoSaveEnabled: !disabled,
        lastUserAction: now
      },
      changeTracking: {
        changeCount: undoStack.length + 1,
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
  }, [session, undoStack, currentWorkspaceId, disabled])

  // Debounced auto-save function - optimized version
  const debouncedAutoSave = useCallback(async (subtitles: SubtitleData[]) => {
    if (disabled || !currentWorkspaceId || !subtitles.length || isCleaningUpRef.current) return

    const saveOperation = async () => {
      const currentHash = await createSubtitleHash(subtitles)
      
      // Skip if content hasn't changed or cleanup started
      if (currentHash === lastSubtitleHashRef.current || isCleaningUpRef.current) {
        if (debug) console.log('🔄 Auto-save skipped - no changes detected or cleanup in progress')
        return
      }

      lastSubtitleHashRef.current = currentHash

      try {
        const tempContent = await convertToTempContent(subtitles)
        
        if (debug) {
          console.log('💾 Auto-saving subtitle changes:', {
            subtitleCount: subtitles.length,
            changeCount: tempContent.changeTracking.changeCount,
            sessionId: tempContent.metadata.sessionId
          })
        }

        // Check cleanup status before database operation
        if (isCleaningUpRef.current) {
          if (debug) console.log('🚫 Auto-save cancelled - cleanup in progress')
          return
        }

        // Update temp storage with latest content
        tempStorage.updateContent(subtitles, {
          currentTime: session?.currentTime,
          selectedSubtitleId: session?.selectedSubtitleId,
          lastUserAction: Date.now()
        })

      } catch (error) {
        // Only log error if it's not a cleanup-related database closing error
        if (!isCleaningUpRef.current && !error.message?.includes('database connection is closing')) {
          console.error('🚨 Auto-save failed:', error)
        }
      }
    }

    // Track ongoing auto-save operation
    ongoingAutoSaveRef.current = saveOperation()
    await ongoingAutoSaveRef.current
    ongoingAutoSaveRef.current = null
  }, [disabled, currentWorkspaceId, createSubtitleHash, convertToTempContent, tempStorage, session, debug])

  // Trigger debounced auto-save
  const triggerAutoSave = useCallback((subtitles: SubtitleData[]) => {
    if (disabled || !isInitializedRef.current || isCleaningUpRef.current) return

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new debounced timer
    debounceTimerRef.current = setTimeout(() => {
      debouncedAutoSave(subtitles)
    }, autoSaveDebounce)

    if (debug) console.log('⏱️ Auto-save scheduled for', autoSaveDebounce, 'ms')
  }, [disabled, debouncedAutoSave, autoSaveDebounce, debug])

  // Watch for subtitle changes in the store
  useEffect(() => {
    if (!session?.currentSubtitles || disabled || storeLoading) return

    const currentChangeTime = session.lastModified?.getTime() || 0
    
    // Skip if we've already processed this change
    if (currentChangeTime <= lastProcessedChangeRef.current) return
    
    lastProcessedChangeRef.current = currentChangeTime

    if (debug) {
      console.log('🔄 Subtitle change detected in auto-save integration:', {
        subtitleCount: session.currentSubtitles.length,
        changeTime: currentChangeTime,
        sessionId: session.sessionId,
        lastProcessed: lastProcessedChangeRef.current
      })
    }

    // Trigger auto-save for current subtitles
    triggerAutoSave(session.currentSubtitles)
  }, [session?.currentSubtitles, session?.lastModified, disabled, storeLoading, triggerAutoSave, debug])

  // Manual force save - optimized version
  const forceSave = useCallback(async () => {
    if (!session?.currentSubtitles || disabled) return

    try {
      const tempContent = await convertToTempContent(session.currentSubtitles)
      await tempStorage.saveContent(tempContent, { priority: 'high' })
      
      if (debug) console.log('🔄 Force save completed')
    } catch (error) {
      console.error('🚨 Force save failed:', error)
      throw error
    }
  }, [session?.currentSubtitles, disabled, convertToTempContent, tempStorage, debug])

  // Create manual backup - optimized version
  const createBackup = useCallback(async (description?: string) => {
    if (!session?.currentSubtitles || disabled) return

    try {
      const tempContent = await convertToTempContent(session.currentSubtitles)
      await tempStorage.saveContent(tempContent, { 
        createBackup: true, 
        description: description || `Manual backup - ${new Date().toLocaleString()}`
      })
      
      if (debug) console.log('💾 Manual backup created:', description)
    } catch (error) {
      console.error('🚨 Backup creation failed:', error)
      throw error
    }
  }, [session?.currentSubtitles, disabled, convertToTempContent, tempStorage, debug])

  // Initialize from subtitle array (e.g., from Step 3 model generation) - optimized version
  const initializeFromSubtitles = useCallback(async (
    subtitles: SubtitleData[], 
    originalPath?: string
  ) => {
    if (disabled) return

    const perfMonitor = PerformanceMonitor.getInstance()
    perfMonitor.startOperation('Subtitle Session Init')

    try {
      // Create session in temp storage
      const sessionResult = await tempStorage.createSession('review')
      if (!sessionResult.success) {
        throw new Error('Failed to create temp storage session')
      }

      // Save as original content (immutable baseline) - now async
      const originalContent = await convertToTempContent(subtitles, originalPath, sessionResult.data)
      await tempStorage.saveContent(originalContent, { 
        createBackup: true, 
        description: 'Original content from model generation' 
      })

      isInitializedRef.current = true
      lastSubtitleHashRef.current = await createSubtitleHash(subtitles)

      if (debug) {
        console.log('🚀 Auto-save initialized from subtitles:', {
          subtitleCount: subtitles.length,
          originalPath,
          sessionId: sessionResult.data
        })
      }

      perfMonitor.endOperation('Subtitle Session Init', subtitles.length)
    } catch (error) {
      perfMonitor.endOperation('Subtitle Session Init (ERROR)', subtitles.length)
      console.error('🚨 Failed to initialize from subtitles:', error)
      throw error
    }
  }, [disabled, tempStorage, convertToTempContent, createSubtitleHash, debug])

  // Initialize from imported JSON (e.g., from Step 1 import) - ENHANCED WITH SESSION MANAGER
  const initializeFromImport = useCallback(async (
    subtitles: SubtitleData[], 
    importPath: string
  ) => {
    if (disabled) return
    
    // Wait for workspace to be ready before attempting session creation
    if (!isWorkspaceReady || !currentWorkspaceId) {
      console.warn('⏳ Workspace not ready for auto-save initialization, skipping...', {
        isWorkspaceReady,
        currentWorkspaceId: !!currentWorkspaceId
      })
      return
    }

    const perfMonitor = PerformanceMonitor.getInstance()
    const startTime = performance.now()
    perfMonitor.startOperation('JSON Import Session Init (ENHANCED)')

    try {
      if (sessionManager && enhancedSessionManagement) {
        // Enhanced session management path
        const sessionId = `${currentWorkspaceId}-import-${Date.now()}`
        
        // Initialize session with enhanced features
        const sessionResult = await sessionManager.initializeSession(
          currentWorkspaceId,
          sessionId,
          subtitles.map(sub => ({
            id: `subtitle-${sub.id}`,
            index: sub.id,
            startTime: sub.startTime,
            endTime: sub.endTime,
            duration: sub.endTime - sub.startTime,
            text: sub.text || '',
            translation: sub.translation,
            confidence: sub.confidence,
            speaker: sub.speaker,
            isMusic: sub.isMusic || false
          })),
          {
            validateWorkspace: true,
            cleanupPrevious: true,
            createBackup: false
          }
        )
        
        if (!sessionResult.success) {
          throw sessionResult.error || new Error('Session initialization failed')
        }
        
        // Update state
        isInitializedRef.current = true
        lastSubtitleHashRef.current = await createSubtitleHash(subtitles)
        
        if (debug) {
          console.log('📥 Auto-save initialized with session manager:', {
            subtitleCount: subtitles.length,
            importPath,
            sessionId: sessionResult.data,
            duration: sessionResult.duration
          })
        }
      } else {
        // Original optimized path (fallback)
        const cleanupPromise = tempStorage.cleanup({ removeOrphaned: true })
        const sessionPromise = tempStorage.createSession('import')
        
        const contentPromise = convertToTempContent(subtitles, importPath)
        const hashPromise = createSubtitleHash(subtitles)

        const [cleanupResult, sessionResult, originalContent, contentHash] = await Promise.all([
          cleanupPromise,
          sessionPromise,
          contentPromise,
          hashPromise
        ])

        if (!sessionResult.success) {
          throw new Error('Failed to create temp storage session')
        }

        originalContent.metadata.sessionId = sessionResult.data
        originalContent.metadata.contentId = sessionResult.data
        
        await tempStorage.saveContent(originalContent, { 
          createBackup: true, 
          description: 'Original imported JSON content' 
        })

        isInitializedRef.current = true
        lastSubtitleHashRef.current = contentHash

        if (debug) {
          console.log('📥 Auto-save initialized (fallback path):', {
            subtitleCount: subtitles.length,
            importPath,
            sessionId: sessionResult.data
          })
        }
      }

      perfMonitor.endOperation('JSON Import Session Init (ENHANCED)', subtitles.length)
      
      // Record performance improvement
      const duration = performance.now() - startTime
      const baselineDuration = 245
      if (duration < baselineDuration) {
        logPerformanceImprovement(
          'JSON Import Session Init (Enhanced)',
          baselineDuration,
          duration,
          subtitles.length
        )
      }
      
    } catch (error) {
      perfMonitor.endOperation('JSON Import Session Init (ENHANCED ERROR)', subtitles.length)
      console.error('🚨 Failed to initialize from import:', error)
      throw error
    }
  }, [disabled, isWorkspaceReady, currentWorkspaceId, tempStorage, convertToTempContent, createSubtitleHash, debug, sessionManager, enhancedSessionManagement])

  // Recover session
  const recoverSession = useCallback(async (sessionId: string) => {
    if (disabled) return

    try {
      await tempStorage.recoverSession(sessionId)
      isInitializedRef.current = true
      
      if (debug) console.log('🔄 Session recovered:', sessionId)
    } catch (error) {
      console.error('🚨 Session recovery failed:', error)
      throw error
    }
  }, [disabled, tempStorage, debug])

  // Enhanced cleanup function with session manager integration
  const cleanup = useCallback(async () => {
    // Set cleanup flag to prevent new auto-save operations
    isCleaningUpRef.current = true

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Wait for any ongoing auto-save operation to complete
    if (ongoingAutoSaveRef.current) {
      try {
        if (debug) console.log('⏳ Waiting for ongoing auto-save to complete...')
        await ongoingAutoSaveRef.current
      } catch (error) {
        if (debug) console.log('🚫 Ongoing auto-save was cancelled or failed during cleanup')
      }
    }

    // Reset refs
    isInitializedRef.current = false
    lastProcessedChangeRef.current = 0
    lastSubtitleHashRef.current = ''

    try {
      // Enhanced cleanup with session manager
      if (sessionManager && enhancedSessionManagement && currentWorkspaceId) {
        const cleanupResult = await sessionManager.performSystemCleanup({
          olderThanDays: 1,
          removeOrphaned: true
        })
        
        if (debug) {
          console.log('🧹 Enhanced cleanup completed:', cleanupResult.data)
        }
      } else {
        // Fallback to temp storage cleanup
        await tempStorage.endSession()
        await tempStorage.cleanup({ olderThanDays: 1, keepLatest: 3 })
      }
      
      if (debug) console.log('🧹 Auto-save cleanup completed')
    } catch (error) {
      console.error('🚨 Cleanup failed:', error)
    } finally {
      // Reset cleanup flag
      isCleaningUpRef.current = false
    }
  }, [tempStorage, debug, sessionManager, enhancedSessionManagement, currentWorkspaceId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Enhanced recovery function
  const enhancedRecoverSession = useCallback(async (sessionId?: string) => {
    if (disabled || !currentWorkspaceId) return

    try {
      if (sessionManager && enhancedSessionManagement) {
        const recoveryResult = await sessionManager.checkAndRestoreWorkspaceSession(currentWorkspaceId)
        
        if (recoveryResult.success && recoveryResult.data) {
          if (debug) console.log('🔄 Enhanced session recovery:', recoveryResult.data)
          // Additional recovery logic here
        } else {
          if (debug) console.log('ℹ️ No sessions to recover via enhanced method')
        }
      } else {
        // Fallback to temp storage recovery
        await tempStorage.recoverSession(sessionId || '')
      }
      
      isInitializedRef.current = true
    } catch (error) {
      console.error('🚨 Enhanced session recovery failed:', error)
      throw error
    }
  }, [disabled, currentWorkspaceId, sessionManager, enhancedSessionManagement, tempStorage, debug])

  return {
    // Temp storage state
    isAutoSaving: tempStorage.isAutoSaving,
    hasUnsavedChanges: tempStorage.hasUnsavedChanges,
    lastSaveTime: tempStorage.lastSaveTime,
    
    // Session state
    currentSession: tempStorage.currentSession,
    hasRecoverableSession: tempStorage.hasRecoverableSession,
    
    // Manual controls
    forceSave,
    createBackup,
    clearContent: tempStorage.clearContent,
    
    // Initialization
    initializeFromSubtitles,
    initializeFromImport,
    
    // Recovery (enhanced)
    recoverSession: enhancedRecoverSession,
    
    // Cleanup (enhanced)
    cleanup,
    
    // Enhanced features
    sessionManager: sessionManager,
    performanceMetrics: sessionManager?.getPerformanceMetrics() || null
  }
}