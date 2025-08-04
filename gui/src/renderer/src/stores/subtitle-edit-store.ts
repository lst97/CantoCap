/**
 * Subtitle Edit Store
 * 
 * Store for subtitle editing functionality with session management
 */

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { TempSubtitleSession, SubtitleEntry, SubtitleModification } from '../types/subtitle'
import { generateSessionId, generateContentId } from '../utils/id-generator'
import type { SubtitleData } from '../../../types'
import { 
  saveOriginalSubtitles, 
  saveModifiedSubtitles, 
  loadSessionSubtitles, 
  hasSessionData,
  deleteSessionData,
  listWorkspaceSessions,
  cleanupWorkspaceSession,
  cleanupOldSessions,
  cleanupOrphanedSessions,
  getStorageStats
} from '../utils/subtitle-indexeddb'

// Simplified temp storage interface for session data (legacy compatibility)
interface SimplifiedTempContent {
  metadata: {
    contentId: string
    workspaceId: string
    sessionId: string
    contentType: string
    version: number
    createdAt: number
    lastModified: number
    dataSize: number
    contentHash: string
    isCompressed: boolean
  }
  subtitles: SubtitleData[]
  editingContext: {
    currentTime?: number
    selectedSubtitleId?: string | null
    isVideoPlaying?: boolean
    videoDuration?: number
    videoPath?: string
    editingMode: 'simple' | 'advanced'
    autoSaveEnabled: boolean
    lastUserAction: number
  }
  changeTracking: {
    changeCount: number
    lastUserAction: number
    modifiedIds: Set<string>
  }
  validationState: {
    isValid: boolean
    warnings: any[]
    errors: any[]
    lastValidation: number
    needsRevalidation: boolean
  }
}

interface SubtitleEditState {
  session: TempSubtitleSession | null
  edits: SubtitleModification[]
  isLoading: boolean
  error: string | null
  undoStack: SubtitleModification[]
  redoStack: SubtitleModification[]
  isAutoSaving: boolean
  lastAutoSave: Date | null
  lastResetTime?: number // Debounce rapid session resets
  // Manual save state
  isSaving: boolean
  saveError: string | null
  lastManualSave: Date | null
  // Performance monitoring state
  performanceMonitoring: {
    enabled: boolean
    indexedDBOperations: number
    totalOperationTime: number
    errorCount: number
    lastCleanup: number
  }
  // Enhanced persistence state
  sessionRecovery: {
    hasRecoverableSession: boolean
    recoverableSessionId: string | null
    lastSessionWorkspaceId: string | null
    sessionDetails?: {
      lastModified: number
      subtitleCount: number
      editCount: number
    }
  }
  persistenceEnabled: boolean
  // Auto-save integration
  autoSaveCallback: ((subtitles: SubtitleData[], action: string) => void) | null
}

interface SubtitleEditActions {
  initializeSession: (subtitlePath: string, videoPath: string, workspaceId: string, importedData?: any[], preTransformed?: boolean) => Promise<void>
  clearSession: () => void
  loadSession: (sessionData: TempSubtitleSession) => void
  saveEdit: (edit: SubtitleModification) => void
  setCurrentTime: (time: number) => void
  setVideoPlaying: (playing: boolean) => void
  jumpToSubtitle: (subtitleId: string) => void
  setVideoDuration: (duration: number) => void
  setSelectedSubtitle: (subtitleId: string | null) => void
  updateSubtitle: (subtitleId: string, updates: Partial<SubtitleEntry>) => void
  addSubtitle: (startTime: number, endTime: number, text?: string) => void
  deleteSubtitle: (subtitleId: string) => void
  splitSubtitle: (subtitleId: string, splitTime: number) => void
  mergeSubtitles: (firstId: string, secondId: string) => void
  undo: () => void
  redo: () => void
  clearUndoRedo: () => void
  reset: () => void
  // Manual save actions
  manualSaveToIndexedDB: () => Promise<boolean>
  clearSaveError: () => void
  // Enhanced persistence actions
  enablePersistence: (workspaceId: string) => void
  disablePersistence: () => void
  checkForRecoverableSession: (workspaceId: string) => Promise<boolean>
  recoverSession: (sessionId: string) => Promise<boolean>
  saveSessionToTempStorage: () => Promise<void>
  convertToTempContent: () => SimplifiedTempContent | null
  restorePersistedSession: () => Promise<boolean>
  // Session management for content changes
  resetSessionForNewContent: (reason: 'step1_import' | 'step1_video_change' | 'step3_generation') => void
  // Auto-save integration callbacks
  setAutoSaveCallback: (callback: ((subtitles: SubtitleData[], action: string) => void) | null) => void
  // Workspace-session mapping functions
  getWorkspaceSessionId: (workspaceId: string) => string | null
  hasWorkspaceSession: (workspaceId: string) => boolean
  checkAndRestoreWorkspaceSession: (workspaceId: string) => Promise<string | null>
  clearSessionForWorkspace: (workspaceId: string) => void
  // Enhanced cleanup functions
  cleanupWorkspaceSession: (workspaceId: string) => Promise<{deletedSessions: number, deletedRecords: number, reclaimedBytes: number}>
  performSystemCleanup: (options?: {olderThanDays?: number, removeOrphaned?: boolean}) => Promise<{totalCleaned: number, reclaimedBytes: number, duration: number}>
  getSessionStats: () => Promise<{totalRecords: number, totalSessions: number, totalWorkspaces: number, totalBytes: number}>
  // Performance monitoring
  enablePerformanceMonitoring: () => void
  disablePerformanceMonitoring: () => void
  getPerformanceMetrics: () => {indexedDBOperations: number, averageOperationTime: number, errorRate: number}
}

type SubtitleEditStore = SubtitleEditState & SubtitleEditActions

// Helper function to trigger auto-save callback and save to IndexedDB
// DISABLED FOR PERFORMANCE: Auto-save system removed to eliminate 2-3 second re-render delays
const triggerAutoSaveCallback = async (store: SubtitleEditStore, action: string) => {
  // Auto-save functionality disabled for performance improvements
  // Manual save methods still available for future implementation
  console.log(`📝 Action recorded (auto-save disabled): ${action}`);
}

export const useSubtitleEditStore = create<SubtitleEditStore>()(subscribeWithSelector(persist((set, get) => ({
  session: null,
  edits: [],
  isLoading: false,
  error: null,
  undoStack: [],
  redoStack: [],
  isAutoSaving: false,
  lastAutoSave: null,
  // Manual save state
  isSaving: false,
  saveError: null,
  lastManualSave: null,
  // Enhanced persistence state
  sessionRecovery: {
    hasRecoverableSession: false,
    recoverableSessionId: null,
    lastSessionWorkspaceId: null
  },
  persistenceEnabled: false,
  // Auto-save integration
  autoSaveCallback: null,
  // Performance monitoring state
  performanceMonitoring: {
    enabled: false,
    indexedDBOperations: 0,
    totalOperationTime: 0,
    errorCount: 0,
    lastCleanup: Date.now()
  },

  initializeSession: async (subtitlePath: string, videoPath: string, workspaceId: string, importedData?: any[], preTransformed: boolean = false) => {
    const state = get()
    const startTime = performance.now()
    
    // Performance monitoring
    if (state.performanceMonitoring.enabled) {
      set(state => ({
        performanceMonitoring: {
          ...state.performanceMonitoring,
          indexedDBOperations: state.performanceMonitoring.indexedDBOperations + 1
        }
      }))
    }
    
    try {
      console.log('🔍 DEBUG: Store initializeSession called with:', {
        subtitlePath,
        videoPath,
        workspaceId,
        hasImportedData: !!importedData,
        importedDataLength: importedData?.length,
        preTransformed
      });
      
      // Validate workspaceId is provided and not empty
      if (!workspaceId || workspaceId.trim() === '') {
        throw new Error('Cannot initialize session: workspaceId is required and cannot be empty')
      }
      
      set({ isLoading: true, error: null })
      
      // Cleanup previous sessions for this workspace to prevent conflicts
      try {
        const cleanupResult = await cleanupWorkspaceSession(workspaceId)
        console.log('🧹 Cleaned up workspace sessions before initialization:', cleanupResult)
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup workspace sessions (continuing):', cleanupError)
      }
      
      // Use pre-transformed data if available, otherwise assume importedData is already SubtitleEntry[]
      const transformedSubtitles: SubtitleEntry[] = preTransformed 
        ? (importedData as SubtitleEntry[] || [])
        : (importedData || []).map((sub, index) => ({
            id: `subtitle-${sub.index || index + 1}`,
            index: sub.index || index + 1,
            startTime: sub.startTime || 0,
            endTime: sub.endTime || 0,
            duration: sub.duration || (sub.endTime - sub.startTime),
            text: sub.caption || sub.text || '',
            translation: sub.translation || undefined,
            confidence: sub.confidence || undefined,
            speaker: sub.speaker || undefined,
            isMusic: sub.isMusic || false
          }))
      
      // Create workspace-bound session ID for persistence across navigation
      const sessionId = `${workspaceId}-session-${Date.now()}-${generateSessionId(9)}`
      
      // FIXED: Set currentTime to -1 for imported data to prevent "PLAYING" state on import
      const isImportedData = importedData && importedData.length > 0;
      const initialCurrentTime = isImportedData ? -1 : 0; // -1 ensures no subtitle matches initially
      
      const sessionData: TempSubtitleSession = {
        sessionId,
        workspaceId, // Bind session to workspace
        videoPath,
        originalSubtitles: [...transformedSubtitles],
        currentSubtitles: transformedSubtitles,
        modifications: [],
        lastModified: new Date(),
        isDirty: false,
        currentTime: initialCurrentTime, // FIXED: Use -1 for imports to prevent playing state
        selectedSubtitleId: null,
        isVideoPlaying: false, // Always false initially
        shouldAutoPause: false,
        videoDuration: 0
      }
      
      // Save original subtitles to IndexedDB with error handling
      try {
        const saveStartTime = performance.now()
        await saveOriginalSubtitles(workspaceId, sessionId, transformedSubtitles)
        const saveEndTime = performance.now()
        
        // Performance tracking
        if (state.performanceMonitoring.enabled) {
          set(state => ({
            performanceMonitoring: {
              ...state.performanceMonitoring,
              totalOperationTime: state.performanceMonitoring.totalOperationTime + (saveEndTime - saveStartTime)
            }
          }))
        }
        
        console.log('✅ Original subtitles saved to IndexedDB')
      } catch (error) {
        console.error('Failed to save original subtitles to IndexedDB:', error)
        
        // Track error
        if (state.performanceMonitoring.enabled) {
          set(state => ({
            performanceMonitoring: {
              ...state.performanceMonitoring,
              errorCount: state.performanceMonitoring.errorCount + 1
            }
          }))
        }
        
        // Continue without IndexedDB storage for now
      }
      
      set({ 
        session: sessionData,
        isLoading: false 
      })
      
      console.log('✅ Subtitle editing session initialized:', sessionData)
      
      // Final performance tracking
      if (state.performanceMonitoring.enabled) {
        const totalTime = performance.now() - startTime
        set(state => ({
          performanceMonitoring: {
            ...state.performanceMonitoring,
            totalOperationTime: state.performanceMonitoring.totalOperationTime + totalTime
          }
        }))
        console.log(`⚡ Session initialization took ${totalTime.toFixed(2)}ms`)
      }
    } catch (error) {
      console.error('Failed to initialize subtitle session:', error)
      
      // Track error
      if (state.performanceMonitoring.enabled) {
        set(state => ({
          performanceMonitoring: {
            ...state.performanceMonitoring,
            errorCount: state.performanceMonitoring.errorCount + 1
          }
        }))
      }
      
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  },

  clearSession: () => {
    set({
      session: null,
      edits: [],
      isLoading: false,
      error: null,
      undoStack: [],
      redoStack: [],
      isAutoSaving: false,
      lastAutoSave: null,
      isSaving: false,
      saveError: null,
      lastManualSave: null
    })
    console.log('🧹 Subtitle editing session cleared')
  },

  loadSession: (sessionData: TempSubtitleSession) => {
    set({ 
      session: sessionData,
      error: null
    })
  },

  saveEdit: (edit: SubtitleModification) => {
    set((state) => ({
      edits: [...state.edits, edit]
    }))
  },

  setCurrentTime: (time: number) => {
    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentTime: time
      } : null
    }))
  },

  setVideoPlaying: (playing: boolean) => {
    set((state) => ({
      session: state.session ? {
        ...state.session,
        isVideoPlaying: playing
      } : null
    }))
  },

  jumpToSubtitle: (subtitleId: string) => {
    const state = get()
    if (!state.session) return
    
    const subtitle = state.session.currentSubtitles.find(s => s.id === subtitleId)
    if (subtitle) {
      set((state) => ({
        session: state.session ? {
          ...state.session,
          currentTime: subtitle.startTime,
          selectedSubtitleId: subtitleId,
          shouldAutoPause: true
        } : null
      }))
    }
  },

  setVideoDuration: (duration: number) => {
    set((state) => ({
      session: state.session ? {
        ...state.session,
        videoDuration: duration
      } : null
    }))
  },

  setSelectedSubtitle: (subtitleId: string | null) => {
    set((state) => ({
      session: state.session ? {
        ...state.session,
        selectedSubtitleId: subtitleId
      } : null
    }))
  },

  updateSubtitle: (subtitleId: string, updates: Partial<SubtitleEntry>) => {
    const state = get()
    if (!state.session) return

    const currentSubtitles = [...state.session.currentSubtitles]
    const index = currentSubtitles.findIndex(s => s.id === subtitleId)
    
    if (index === -1) return

    const originalSubtitle = currentSubtitles[index]
    const updatedSubtitle = { ...originalSubtitle, ...updates }
    
    // Create modification record
    const modification: SubtitleModification = {
      id: `mod-${Date.now()}`,
      subtitleId,
      timestamp: new Date().toISOString(),
      type: 'modified',
      original: originalSubtitle,
      modified: updatedSubtitle,
      changeTimestamp: new Date(),
      description: `Updated subtitle ${subtitleId}`
    }

    currentSubtitles[index] = updatedSubtitle

    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentSubtitles,
        modifications: [...state.session.modifications, modification],
        isDirty: true,
        lastModified: new Date()
      } : null,
      undoStack: [...state.undoStack, modification],
      redoStack: [] // Clear redo stack on new action
    }))

    // Auto-save disabled for performance
    // const store = get()
    // triggerAutoSaveCallback(store, 'updateSubtitle')
  },

  addSubtitle: (startTime: number, endTime: number, text: string = '') => {
    const state = get()
    if (!state.session) return

    const currentSubtitles = [...state.session.currentSubtitles]
    
    // Find the appropriate index to insert the new subtitle (ordered by start time)
    let insertIndex = currentSubtitles.findIndex(s => s.startTime > startTime)
    if (insertIndex === -1) insertIndex = currentSubtitles.length

    // Generate new subtitle
    const newSubtitle: SubtitleEntry = {
      id: `new-${Date.now()}`,
      index: insertIndex + 1,
      startTime,
      endTime,
      duration: endTime - startTime,
      text,
      translation: undefined,
      confidence: undefined,
      speaker: undefined
    }
    
    // Create modification record
    const modification: SubtitleModification = {
      id: `mod-${Date.now()}`,
      subtitleId: newSubtitle.id,
      timestamp: new Date().toISOString(),
      type: 'added',
      modified: newSubtitle,
      changeTimestamp: new Date(),
      description: `Added new subtitle at ${startTime.toFixed(2)}s`
    }

    // Insert the new subtitle
    currentSubtitles.splice(insertIndex, 0, newSubtitle)
    
    // Reindex subsequent subtitles
    for (let i = insertIndex + 1; i < currentSubtitles.length; i++) {
      currentSubtitles[i] = { ...currentSubtitles[i], index: i + 1 }
    }

    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentSubtitles,
        modifications: [...state.session.modifications, modification],
        isDirty: true,
        lastModified: new Date(),
        selectedSubtitleId: newSubtitle.id // Auto-select the new subtitle
      } : null,
      undoStack: [...state.undoStack, modification],
      redoStack: [] // Clear redo stack on new action
    }))

    // Auto-save disabled for performance
    // const store = get()
    // triggerAutoSaveCallback(store, 'addSubtitle')
  },

  deleteSubtitle: (subtitleId: string) => {
    const state = get()
    if (!state.session) return

    const currentSubtitles = [...state.session.currentSubtitles]
    const index = currentSubtitles.findIndex(s => s.id === subtitleId)
    
    if (index === -1) return

    const deletedSubtitle = currentSubtitles[index]
    
    // Create modification record
    const modification: SubtitleModification = {
      id: `mod-${Date.now()}`,
      subtitleId,
      timestamp: new Date().toISOString(),
      type: 'deleted',
      original: deletedSubtitle,
      changeTimestamp: new Date(),
      description: `Deleted subtitle ${subtitleId}`
    }

    currentSubtitles.splice(index, 1)

    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentSubtitles,
        modifications: [...state.session.modifications, modification],
        isDirty: true,
        lastModified: new Date(),
        selectedSubtitleId: null // Clear selection after delete
      } : null,
      undoStack: [...state.undoStack, modification],
      redoStack: [] // Clear redo stack on new action
    }))

    // Auto-save disabled for performance
    // const store = get()
    // triggerAutoSaveCallback(store, 'deleteSubtitle')
  },

  splitSubtitle: (subtitleId: string, splitTime: number) => {
    const state = get()
    if (!state.session) return

    const currentSubtitles = [...state.session.currentSubtitles]
    const index = currentSubtitles.findIndex(s => s.id === subtitleId)
    
    if (index === -1) return

    const originalSubtitle = currentSubtitles[index]
    
    // Create two new subtitles
    const firstPart: SubtitleEntry = {
      ...originalSubtitle,
      id: `${subtitleId}-part1`,
      endTime: splitTime,
      duration: splitTime - originalSubtitle.startTime
    }
    
    const secondPart: SubtitleEntry = {
      ...originalSubtitle,
      id: `${subtitleId}-part2`,
      index: originalSubtitle.index + 0.5, // Temporary index adjustment
      startTime: splitTime,
      duration: originalSubtitle.endTime - splitTime
    }
    
    // Create modification record
    const modification: SubtitleModification = {
      id: `mod-${Date.now()}`,
      subtitleId,
      timestamp: new Date().toISOString(),
      type: 'split',
      original: originalSubtitle,
      changeTimestamp: new Date(),
      description: `Split subtitle ${subtitleId} at ${splitTime}s`
    }

    // Replace original with two parts
    currentSubtitles.splice(index, 1, firstPart, secondPart)

    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentSubtitles,
        modifications: [...state.session.modifications, modification],
        isDirty: true,
        lastModified: new Date()
      } : null,
      undoStack: [...state.undoStack, modification],
      redoStack: [] // Clear redo stack on new action
    }))

    // Auto-save disabled for performance
    // const store = get()
    // triggerAutoSaveCallback(store, 'splitSubtitle')
  },

  mergeSubtitles: (firstId: string, secondId: string) => {
    const state = get()
    if (!state.session) return

    const currentSubtitles = [...state.session.currentSubtitles]
    const firstIndex = currentSubtitles.findIndex(s => s.id === firstId)
    const secondIndex = currentSubtitles.findIndex(s => s.id === secondId)
    
    if (firstIndex === -1 || secondIndex === -1) return

    const firstSubtitle = currentSubtitles[firstIndex]
    const secondSubtitle = currentSubtitles[secondIndex]
    
    // Create merged subtitle
    const mergedSubtitle: SubtitleEntry = {
      ...firstSubtitle,
      id: `merged-${Date.now()}`,
      endTime: secondSubtitle.endTime,
      duration: secondSubtitle.endTime - firstSubtitle.startTime,
      text: `${firstSubtitle.text} ${secondSubtitle.text}`.trim(),
      translation: firstSubtitle.translation && secondSubtitle.translation
        ? `${firstSubtitle.translation} ${secondSubtitle.translation}`.trim()
        : firstSubtitle.translation || secondSubtitle.translation
    }
    
    // Create modification record
    const modification: SubtitleModification = {
      id: `mod-${Date.now()}`,
      subtitleId: firstId,
      timestamp: new Date().toISOString(),
      type: 'merged',
      original: firstSubtitle,
      modified: mergedSubtitle,
      changeTimestamp: new Date(),
      description: `Merged subtitles ${firstId} and ${secondId}`
    }

    // Remove both originals and add merged
    const minIndex = Math.min(firstIndex, secondIndex)
    const maxIndex = Math.max(firstIndex, secondIndex)
    
    currentSubtitles.splice(maxIndex, 1) // Remove second (higher index first)
    currentSubtitles.splice(minIndex, 1, mergedSubtitle) // Replace first with merged

    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentSubtitles,
        modifications: [...state.session.modifications, modification],
        isDirty: true,
        lastModified: new Date()
      } : null,
      undoStack: [...state.undoStack, modification],
      redoStack: [] // Clear redo stack on new action
    }))

    // Auto-save disabled for performance
    // const store = get()
    // triggerAutoSaveCallback(store, 'mergeSubtitles')
  },

  undo: () => {
    const state = get()
    if (state.undoStack.length === 0 || !state.session) return

    const lastModification = state.undoStack[state.undoStack.length - 1]
    const currentSubtitles = [...state.session.currentSubtitles]
    
    // Move to redo stack
    const newUndoStack = state.undoStack.slice(0, -1)
    const newRedoStack = [...state.redoStack, lastModification]

    // Reverse the modification based on type
    switch (lastModification.type) {
      case 'modified':
        // Restore original values
        if (lastModification.original) {
          const index = currentSubtitles.findIndex(s => s.id === lastModification.subtitleId)
          if (index !== -1) {
            currentSubtitles[index] = { ...lastModification.original }
          }
        }
        break
        
      case 'added':
        // Remove the added subtitle
        const addedIndex = currentSubtitles.findIndex(s => s.id === lastModification.subtitleId)
        if (addedIndex !== -1) {
          currentSubtitles.splice(addedIndex, 1)
          // Reindex subsequent subtitles
          for (let i = addedIndex; i < currentSubtitles.length; i++) {
            currentSubtitles[i] = { ...currentSubtitles[i], index: i + 1 }
          }
        }
        break
        
      case 'deleted':
        // Restore the deleted subtitle
        if (lastModification.original) {
          const insertIndex = currentSubtitles.findIndex(s => s.startTime > lastModification.original!.startTime)
          const targetIndex = insertIndex === -1 ? currentSubtitles.length : insertIndex
          currentSubtitles.splice(targetIndex, 0, { ...lastModification.original })
          // Reindex subsequent subtitles
          for (let i = targetIndex + 1; i < currentSubtitles.length; i++) {
            currentSubtitles[i] = { ...currentSubtitles[i], index: i + 1 }
          }
        }
        break
        
      default:
        console.warn(`Undo not implemented for modification type: ${lastModification.type}`)
        return
    }

    // Remove the last modification from the session's modifications array
    const sessionModifications = state.session.modifications.filter(mod => mod.id !== lastModification.id)

    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentSubtitles,
        modifications: sessionModifications,
        isDirty: true,
        lastModified: new Date()
      } : null,
      undoStack: newUndoStack,
      redoStack: newRedoStack
    }))

    // Auto-save disabled for performance
    // const store = get()
    // triggerAutoSaveCallback(store, 'undo')
  },

  redo: () => {
    const state = get()
    if (state.redoStack.length === 0 || !state.session) return

    const lastRedo = state.redoStack[state.redoStack.length - 1]
    const currentSubtitles = [...state.session.currentSubtitles]
    
    // Move back to undo stack
    const newRedoStack = state.redoStack.slice(0, -1)
    const newUndoStack = [...state.undoStack, lastRedo]

    // Reapply the modification based on type
    switch (lastRedo.type) {
      case 'modified':
        // Apply the modified values
        if (lastRedo.modified) {
          const index = currentSubtitles.findIndex(s => s.id === lastRedo.subtitleId)
          if (index !== -1) {
            currentSubtitles[index] = { ...lastRedo.modified }
          }
        }
        break
        
      case 'added':
        // Re-add the subtitle
        if (lastRedo.modified) {
          const insertIndex = currentSubtitles.findIndex(s => s.startTime > lastRedo.modified!.startTime)
          const targetIndex = insertIndex === -1 ? currentSubtitles.length : insertIndex
          currentSubtitles.splice(targetIndex, 0, { ...lastRedo.modified })
          // Reindex subsequent subtitles
          for (let i = targetIndex + 1; i < currentSubtitles.length; i++) {
            currentSubtitles[i] = { ...currentSubtitles[i], index: i + 1 }
          }
        }
        break
        
      case 'deleted':
        // Re-delete the subtitle
        const deleteIndex = currentSubtitles.findIndex(s => s.id === lastRedo.subtitleId)
        if (deleteIndex !== -1) {
          currentSubtitles.splice(deleteIndex, 1)
          // Reindex subsequent subtitles
          for (let i = deleteIndex; i < currentSubtitles.length; i++) {
            currentSubtitles[i] = { ...currentSubtitles[i], index: i + 1 }
          }
        }
        break
        
      default:
        console.warn(`Redo not implemented for modification type: ${lastRedo.type}`)
        return
    }

    // Re-add the modification to the session's modifications array
    const sessionModifications = [...state.session.modifications, lastRedo]

    set((state) => ({
      session: state.session ? {
        ...state.session,
        currentSubtitles,
        modifications: sessionModifications,
        isDirty: true,
        lastModified: new Date()
      } : null,
      undoStack: newUndoStack,
      redoStack: newRedoStack
    }))

    // Auto-save disabled for performance
    // const store = get()
    // triggerAutoSaveCallback(store, 'redo')
  },

  clearUndoRedo: () => {
    set((state) => ({
      undoStack: [],
      redoStack: []
    }))
  },

  // Manual save methods
  manualSaveToIndexedDB: async (): Promise<boolean> => {
    const state = get()
    
    // Check if session exists and has changes
    if (!state.session || !state.session.isDirty) {
      console.log('📝 Manual save skipped: No dirty session to save')
      return true // No changes to save, consider successful
    }

    // Check required data
    if (!state.session.workspaceId || !state.session.sessionId || !state.session.currentSubtitles) {
      console.error('❌ Manual save failed: Missing required session data')
      set({ saveError: 'Missing required session data for save operation' })
      return false
    }

    set({ 
      isSaving: true, 
      saveError: null 
    })

    try {
      const startTime = performance.now()
      
      // Save modified subtitles to IndexedDB
      await saveModifiedSubtitles(
        state.session.workspaceId,
        state.session.sessionId,
        state.session.currentSubtitles
      )

      const endTime = performance.now()
      const saveTime = new Date()

      // Update state with successful save
      set({ 
        isSaving: false,
        lastManualSave: saveTime,
        saveError: null,
        session: state.session ? {
          ...state.session,
          isDirty: false, // Mark as clean after successful save
          lastModified: saveTime
        } : null
      })

      // Performance tracking
      if (state.performanceMonitoring.enabled) {
        set(state => ({
          performanceMonitoring: {
            ...state.performanceMonitoring,
            indexedDBOperations: state.performanceMonitoring.indexedDBOperations + 1,
            totalOperationTime: state.performanceMonitoring.totalOperationTime + (endTime - startTime)
          }
        }))
      }

      console.log(`✅ Manual save completed successfully in ${(endTime - startTime).toFixed(2)}ms`)
      return true

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during save'
      console.error('❌ Manual save failed:', error)
      
      // Track error in performance monitoring
      if (state.performanceMonitoring.enabled) {
        set(state => ({
          performanceMonitoring: {
            ...state.performanceMonitoring,
            errorCount: state.performanceMonitoring.errorCount + 1
          }
        }))
      }

      set({ 
        isSaving: false,
        saveError: errorMessage
      })
      
      return false
    }
  },

  clearSaveError: () => {
    set({ saveError: null })
  },

  reset: () => {
    set({
      session: null,
      edits: [],
      isLoading: false,
      error: null,
      undoStack: [],
      redoStack: [],
      isAutoSaving: false,
      lastAutoSave: null,
      isSaving: false,
      saveError: null,
      lastManualSave: null,
      sessionRecovery: {
        hasRecoverableSession: false,
        recoverableSessionId: null,
        lastSessionWorkspaceId: null
      },
      persistenceEnabled: false
    })
  },

  // Enhanced persistence actions
  enablePersistence: (workspaceId: string) => {
    set((state) => ({
      persistenceEnabled: true,
      sessionRecovery: {
        ...state.sessionRecovery,
        lastSessionWorkspaceId: workspaceId
      }
    }))
  },

  disablePersistence: () => {
    set({
      persistenceEnabled: false
    })
  },

  checkForRecoverableSession: async (workspaceId: string): Promise<boolean> => {
    try {
      // Check if there are any sessions for this workspace using the new IndexedDB utilities
      const sessionIds = await listWorkspaceSessions(workspaceId)
      
      if (sessionIds.length > 0) {
        // Find sessions that have data (either original or modified)
        for (const sessionId of sessionIds) {
          const sessionData = await hasSessionData(workspaceId, sessionId)
          
          if (sessionData.hasOriginal || sessionData.hasModified) {
            // Load subtitle data to get counts for recovery dialog
            let subtitleCount = 0
            let editCount = 0
            
            try {
              const subtitles = await loadSessionSubtitles(workspaceId, sessionId)
              if (subtitles.modified) {
                subtitleCount = subtitles.modified.length
                editCount = 1 // If we have modified data, assume there's at least one edit
              } else if (subtitles.original) {
                subtitleCount = subtitles.original.length
                editCount = 0
              }
            } catch (error) {
              console.warn('Failed to load session data for recovery info:', error)
            }
            
            set((state) => ({
              sessionRecovery: {
                ...state.sessionRecovery,
                hasRecoverableSession: true,
                recoverableSessionId: sessionId,
                lastSessionWorkspaceId: workspaceId,
                sessionDetails: {
                  lastModified: Date.now(), // We don't have exact timestamp from simple storage
                  subtitleCount,
                  editCount
                }
              }
            }))
            return true
          }
        }
      }
      
      return false
    } catch (error) {
      console.error('Failed to check for recoverable session:', error)
      return false
    }
  },

  recoverSession: async (sessionId: string): Promise<boolean> => {
    try {
      const state = get()
      const workspaceId = state.sessionRecovery.lastSessionWorkspaceId
      
      if (!workspaceId) {
        console.error('Cannot recover session: no workspace ID available')
        return false
      }
      
      // Load session subtitles from IndexedDB
      const subtitles = await loadSessionSubtitles(workspaceId, sessionId)
      
      if (!subtitles.original && !subtitles.modified) {
        console.error('No subtitle data found for session')
        return false
      }
      
      // Use modified subtitles if available, otherwise use original
      const currentSubtitles = subtitles.modified || subtitles.original || []
      const originalSubtitles = subtitles.original || currentSubtitles
      
      // Create recovered session (note: we don't have full context from simple storage)
      // Try to get video path from app store config as fallback
      const appStore = (await import('../stores/app-store')).useAppStore.getState()
      const fallbackVideoPath = appStore.config.inputFile || ''
      
      const recoveredSession: TempSubtitleSession = {
        sessionId,
        workspaceId,
        videoPath: fallbackVideoPath, // Use config.inputFile as fallback since IndexedDB doesn't store video path
        originalSubtitles: [...originalSubtitles],
        currentSubtitles: [...currentSubtitles],
        modifications: [],
        lastModified: new Date(),
        isDirty: subtitles.modified ? true : false,
        currentTime: 0,
        selectedSubtitleId: null,
        isVideoPlaying: false,
        shouldAutoPause: false,
        videoDuration: 0
      }
      
      set({
        session: recoveredSession,
        sessionRecovery: {
          hasRecoverableSession: false,
          recoverableSessionId: null,
          lastSessionWorkspaceId: null
        }
      })
      
      console.log('✅ Session recovered from IndexedDB:', sessionId)
      return true
    } catch (error) {
      console.error('Failed to recover session:', error)
      return false
    }
  },

  saveSessionToTempStorage: async (): Promise<void> => {
    const state = get()
    if (!state.session || !state.persistenceEnabled) {
      return
    }

    try {
      // Save modified subtitles to IndexedDB if session is dirty
      if (state.session.isDirty && state.session.workspaceId && state.session.sessionId) {
        await saveModifiedSubtitles(
          state.session.workspaceId,
          state.session.sessionId,
          state.session.currentSubtitles
        )
        
        set({ lastAutoSave: new Date() })
        console.log('✅ Session auto-saved to IndexedDB')
      }
    } catch (error) {
      console.error('Failed to save session to temp storage:', error)
    }
  },

  convertToTempContent: (): SimplifiedTempContent | null => {
    const state = get()
    if (!state.session) {
      return null
    }

    return {
      metadata: {
        contentId: generateContentId(),
        workspaceId: state.sessionRecovery.lastSessionWorkspaceId || 'unknown',
        sessionId: state.session.sessionId,
        contentType: 'subtitle_session',
        version: 1,
        createdAt: Date.now(),
        lastModified: Date.now(),
        dataSize: 0,
        contentHash: '',
        isCompressed: false
      },
      subtitles: state.session.currentSubtitles.map(subtitle => ({
        id: parseInt(subtitle.id),
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        text: subtitle.text || '',
        translation: subtitle.translation,
        confidence: subtitle.confidence,
        speaker: subtitle.speaker
      })),
      editingContext: {
        currentTime: state.session.currentTime,
        selectedSubtitleId: state.session.selectedSubtitleId,
        isVideoPlaying: state.session.isVideoPlaying,
        videoDuration: state.session.videoDuration,
        videoPath: state.session.videoPath,
        editingMode: 'simple',
        autoSaveEnabled: true,
        lastUserAction: Date.now()
      },
      changeTracking: {
        changeCount: state.session.modifications.length,
        lastUserAction: Date.now(),
        modifiedIds: new Set(state.session.modifications.map(mod => mod.subtitleId))
      },
      validationState: {
        isValid: true,
        warnings: [],
        errors: [],
        lastValidation: Date.now(),
        needsRevalidation: false
      }
    }
  },

  restorePersistedSession: async (): Promise<boolean> => {
    const state = get()
    
    // Check if we have a persisted session marked as recoverable
    if (!state.sessionRecovery.hasRecoverableSession || !state.sessionRecovery.recoverableSessionId) {
      return false
    }

    try {
      // Recover session from IndexedDB
      const sessionId = state.sessionRecovery.recoverableSessionId
      const success = await state.recoverSession(sessionId)
      
      if (success) {
        console.log('✅ Session recovered from IndexedDB:', sessionId)
        return true
      }
      
      console.log('❌ Failed to restore session from IndexedDB:', sessionId)
      return false
    } catch (error) {
      console.error('Failed to restore persisted session:', error)
      return false
    }
  },

  // Reset session when new content is available from Step 1 or Step 3
  resetSessionForNewContent: (reason: 'step1_import' | 'step1_video_change' | 'step3_generation') => {
    const state = get()
    
    // Prevent rapid successive resets (debounce to 100ms)
    const now = Date.now()
    if (state.lastResetTime && (now - state.lastResetTime) < 100) {
      console.log(`⚠️ Skipping rapid reset for: ${reason} (within 100ms of previous reset)`)
      return
    }
    
    console.log(`🔄 Resetting session for new content: ${reason}`)
    
    // Enhanced cleanup with IndexedDB cleanup for certain scenarios
    if (reason === 'step1_video_change' && state.session?.workspaceId) {
      // Async cleanup without blocking the reset
      cleanupWorkspaceSession(state.session.workspaceId)
        .then(result => {
          console.log('🧹 Cleaned up IndexedDB for video change:', result)
        })
        .catch(error => {
          console.warn('⚠️ Failed to cleanup IndexedDB for video change:', error)
        })
    }
    
    // Clear current session state
    set({
      session: null,
      edits: [],
      undoStack: [],
      redoStack: [],
      error: null,
      isLoading: false,
      isSaving: false,
      saveError: null,
      lastManualSave: null,
      lastResetTime: now,
      // Reset session recovery state to prevent stale session recovery
      sessionRecovery: {
        hasRecoverableSession: false,
        recoverableSessionId: null,
        lastSessionWorkspaceId: state.sessionRecovery.lastSessionWorkspaceId
      }
    })

    // Do NOT trigger auto-save callback here to prevent loops
    // Components will detect session changes through state subscription
    
    console.log(`✅ Session reset complete for: ${reason}`)
  },

  // Auto-save integration callback setter
  setAutoSaveCallback: (callback: ((subtitles: SubtitleData[], action: string) => void) | null) => {
    set({ autoSaveCallback: callback })
  },

  // Workspace-session mapping functions
  getWorkspaceSessionId: (workspaceId: string): string | null => {
    const state = get()
    
    console.log('🔍 getWorkspaceSessionId called with workspaceId:', workspaceId)
    console.log('🔍 Current state.session:', state.session ? {
      sessionId: state.session.sessionId,
      workspaceId: state.session.workspaceId
    } : null)
    
    if (state.session && state.session.workspaceId === workspaceId) {
      console.log('✅ Found matching session in current state:', state.session.sessionId)
      return state.session.sessionId
    }
    
    console.log('❌ No active session found for workspaceId:', workspaceId)
    return null
  },

  hasWorkspaceSession: (workspaceId: string): boolean => {
    return get().getWorkspaceSessionId(workspaceId) !== null
  },

  // Check for workspace session and restore if needed
  checkAndRestoreWorkspaceSession: async (workspaceId: string): Promise<string | null> => {
    const state = get()
    
    console.log('🔍 DEBUG: checkAndRestoreWorkspaceSession called with workspaceId:', workspaceId)
    
    // Check if there's already an active session for this workspace
    if (state.session && state.session.workspaceId === workspaceId) {
      // Check if session has subtitle data, if not try to restore it from IndexedDB
      if (state.session.currentSubtitles && state.session.currentSubtitles.length > 0) {
        console.log('✅ Found active session with data for workspace:', state.session.sessionId)
        return state.session.sessionId
      } else {
        console.log('🔄 Active session exists but no subtitle data, attempting to restore from IndexedDB:', state.session.sessionId)
        // Continue to IndexedDB restoration logic below
      }
    }
    
    // Find and restore session from IndexedDB
    try {
      const sessionIds = await listWorkspaceSessions(workspaceId)
      const existingSession = state.session
      
      if (sessionIds.length > 0) {
        // Try to restore the first session that has data
        for (const sessionId of sessionIds) {
          const sessionData = await hasSessionData(workspaceId, sessionId)
          
          if (sessionData.hasOriginal || sessionData.hasModified) {
            console.log('🔄 Found IndexedDB session for workspace, attempting restore:', sessionId)
            
            // Load session data from IndexedDB
            const subtitles = await loadSessionSubtitles(workspaceId, sessionId)
            const currentSubtitles = subtitles.modified || subtitles.original || []
            const originalSubtitles = subtitles.original || currentSubtitles
            
            // If we have an existing session, update it with the loaded data
            if (existingSession && existingSession.workspaceId === workspaceId) {
              console.log('🔄 Updating existing session with IndexedDB data')
              
              const updatedSession: TempSubtitleSession = {
                ...existingSession,
                originalSubtitles: [...originalSubtitles],
                currentSubtitles: [...currentSubtitles],
                modifications: [],
                lastModified: new Date(),
                isDirty: subtitles.modified ? true : false,
              }
              
              // Update the existing session with loaded data
              set({ session: updatedSession })
              
              console.log('✅ Updated existing session with IndexedDB data for workspace:', workspaceId)
              return existingSession.sessionId
            } else {
              // Create new restored session
              // Try to get video path from app store config as fallback
              const appStore = (await import('../stores/app-store')).useAppStore.getState()
              const fallbackVideoPath = appStore.config.inputFile || ''
              
              const restoredSession: TempSubtitleSession = {
                sessionId,
                workspaceId,
                videoPath: fallbackVideoPath, // Use config.inputFile as fallback since IndexedDB doesn't store video path
                originalSubtitles: [...originalSubtitles],
                currentSubtitles: [...currentSubtitles],
                modifications: [],
                lastModified: new Date(),
                isDirty: subtitles.modified ? true : false,
                currentTime: 0,
                selectedSubtitleId: null,
                isVideoPlaying: false,
                shouldAutoPause: false,
                videoDuration: 0
              }
              
              // Load the session into the store
              set({ session: restoredSession })
              
              console.log('✅ Session restored from IndexedDB for workspace:', workspaceId)
              return sessionId
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to check IndexedDB for workspace session:', error)
    }
    
    console.log('❌ No session found or restored for workspaceId:', workspaceId)
    return null
  },

  clearSessionForWorkspace: (workspaceId: string) => {
    const state = get()
    if (state.session && state.session.workspaceId === workspaceId) {
      console.log(`🗑️ Clearing session for workspace: ${workspaceId}`)
      set({
        session: null,
        edits: [],
        undoStack: [],
        redoStack: [],
        error: null
      })
    }
  },

  // Enhanced cleanup functions
  cleanupWorkspaceSession: async (workspaceId: string) => {
    const startTime = performance.now()
    
    try {
      const result = await cleanupWorkspaceSession(workspaceId)
      const endTime = performance.now()
      
      console.log(`🧹 Workspace ${workspaceId} cleanup completed:`, {
        ...result,
        duration: `${(endTime - startTime).toFixed(2)}ms`
      })
      
      return result
    } catch (error) {
      console.error(`❌ Failed to cleanup workspace ${workspaceId}:`, error)
      throw error
    }
  },

  performSystemCleanup: async (options = {}) => {
    const { olderThanDays = 7, removeOrphaned = true } = options
    const startTime = performance.now()
    let totalCleaned = 0
    let totalReclaimedBytes = 0
    
    try {
      console.log('🧹 Starting system cleanup...', { olderThanDays, removeOrphaned })
      
      // Cleanup old sessions
      const oldSessionsResult = await cleanupOldSessions(olderThanDays)
      totalCleaned += oldSessionsResult.deletedRecords
      totalReclaimedBytes += oldSessionsResult.reclaimedBytes
      
      // Cleanup orphaned sessions if requested
      if (removeOrphaned) {
        const orphanedResult = await cleanupOrphanedSessions()
        totalCleaned += orphanedResult.deletedRecords
        totalReclaimedBytes += orphanedResult.reclaimedBytes
      }
      
      const duration = performance.now() - startTime
      
      // Update cleanup timestamp
      set(state => ({
        performanceMonitoring: {
          ...state.performanceMonitoring,
          lastCleanup: Date.now()
        }
      }))
      
      const result = {
        totalCleaned,
        reclaimedBytes: totalReclaimedBytes,
        duration
      }
      
      console.log('✅ System cleanup completed:', result)
      return result
    } catch (error) {
      console.error('❌ System cleanup failed:', error)
      throw error
    }
  },

  getSessionStats: async () => {
    try {
      const stats = await getStorageStats()
      console.log('📊 Session statistics:', stats)
      return stats
    } catch (error) {
      console.error('❌ Failed to get session stats:', error)
      throw error
    }
  },

  // Performance monitoring
  enablePerformanceMonitoring: () => {
    set(state => ({
      performanceMonitoring: {
        ...state.performanceMonitoring,
        enabled: true
      }
    }))
    console.log('⚡ Performance monitoring enabled')
  },

  disablePerformanceMonitoring: () => {
    set(state => ({
      performanceMonitoring: {
        ...state.performanceMonitoring,
        enabled: false
      }
    }))
    console.log('⚡ Performance monitoring disabled')
  },

  getPerformanceMetrics: () => {
    const state = get()
    const metrics = {
      indexedDBOperations: state.performanceMonitoring.indexedDBOperations,
      averageOperationTime: state.performanceMonitoring.indexedDBOperations > 0
        ? state.performanceMonitoring.totalOperationTime / state.performanceMonitoring.indexedDBOperations
        : 0,
      errorRate: state.performanceMonitoring.indexedDBOperations > 0
        ? (state.performanceMonitoring.errorCount / state.performanceMonitoring.indexedDBOperations) * 100
        : 0
    }
    
    console.log('📊 Performance metrics:', metrics)
    return metrics
  }
}), {
  name: 'subtitle-edit-store',
  partialize: (state) => ({
    // Persist the core session data for app restart recovery
    session: state.session ? {
      sessionId: state.session.sessionId,
      workspaceId: state.session.workspaceId, // Include workspace binding
      videoPath: state.session.videoPath,
      lastModified: state.session.lastModified,
      isDirty: state.session.isDirty,
      currentTime: state.session.currentTime,
      selectedSubtitleId: state.session.selectedSubtitleId,
      videoDuration: state.session.videoDuration,
      // Store subtitle count for recovery dialog info with null checks
      subtitleCount: state.session.currentSubtitles && Array.isArray(state.session.currentSubtitles) ? state.session.currentSubtitles.length : 0,
      editCount: state.session.modifications && Array.isArray(state.session.modifications) ? state.session.modifications.length : 0
    } : null,
    // Persist persistence settings
    sessionRecovery: state.sessionRecovery,
    persistenceEnabled: state.persistenceEnabled,
    // Store edit count for session info
    edits: state.edits.slice(-10), // Keep last 10 edits for context
    lastAutoSave: state.lastAutoSave
  }),
  // Enhanced merge function to handle session restoration
  merge: (persistedState: any, currentState: SubtitleEditStore) => {
    const merged = { ...currentState, ...persistedState }
    
    // Validate that any persisted session has a proper workspaceId
    if (persistedState?.session) {
      if (!persistedState.session.workspaceId) {
        console.warn('🔧 Clearing persisted session without workspaceId:', persistedState.session.sessionId)
        merged.session = null
        merged.sessionRecovery = {
          hasRecoverableSession: false,
          recoverableSessionId: null,
          lastSessionWorkspaceId: null
        }
      } else if (persistedState.session.isDirty) {
        // If we have a valid persisted session, mark it as recoverable
        merged.sessionRecovery = {
          hasRecoverableSession: true,
          recoverableSessionId: persistedState.session.sessionId,
          lastSessionWorkspaceId: persistedState.session.workspaceId
        }
      }
    }
    
    // Initialize performance monitoring state if not present
    if (!persistedState?.performanceMonitoring) {
      merged.performanceMonitoring = {
        enabled: false,
        indexedDBOperations: 0,
        totalOperationTime: 0,
        errorCount: 0,
        lastCleanup: Date.now()
      }
    }
    
    return merged
  }
})))

// PERFORMANCE IMPROVEMENT: Auto-save subscription disabled to eliminate 2-3 second re-render delays
// Auto-save subscription for temp storage integration - DISABLED
// let autoSaveInterval: NodeJS.Timeout | null = null

// DISABLED: Subscribe to state changes for auto-save
// This 30-second interval and subscription was causing significant performance issues
// Manual save methods are still available via saveSessionToTempStorage()

/*
// Original auto-save subscription (disabled for performance)
useSubtitleEditStore.subscribe(
  (state) => ({ session: state.session, persistenceEnabled: state.persistenceEnabled }),
  (current, previous) => {
    // Set up auto-save when persistence is enabled and session exists
    if (current.persistenceEnabled && current.session && current.session.isDirty && !previous.session?.isDirty) {
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval)
      }
      
      autoSaveInterval = setInterval(() => {
        const state = useSubtitleEditStore.getState()
        if (state.session?.isDirty && state.persistenceEnabled) {
          state.saveSessionToTempStorage()
        }
      }, 30000) // Auto-save every 30 seconds
    }
    
    // Clean up auto-save when persistence is disabled
    if (!current.persistenceEnabled && autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
  },
  { equalityFn: (a, b) => a.persistenceEnabled === b.persistenceEnabled && a.session?.isDirty === b.session?.isDirty }
)
*/

// Clean up duplicate class definition for testing compatibility