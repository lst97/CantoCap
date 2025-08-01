/**
 * Subtitle Edit Store
 * 
 * Store for subtitle editing functionality with session management
 */

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { TempSubtitleSession, SubtitleEntry, SubtitleModification } from '../types/subtitle'
import type { SubtitleData } from '../../../types'
import { generateTempStorageId } from '../types/subtitle-temp-storage'

// Simplified temp storage interface for session data
interface SimplifiedTempContent {
  metadata: {
    contentId: string
    workspaceId: string
    sessionId: string
    originalPath: string
    tempPath: string
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
  // Enhanced persistence state
  sessionRecovery: {
    hasRecoverableSession: boolean
    recoverableSessionId: string | null
    lastSessionWorkspaceId: string | null
  }
  persistenceEnabled: boolean
  tempStorageId: string | null
}

interface SubtitleEditActions {
  initializeSession: (subtitlePath: string, videoPath: string, importedData?: any[], preTransformed?: boolean) => Promise<void>
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
  // Enhanced persistence actions
  enablePersistence: (workspaceId: string) => void
  disablePersistence: () => void
  checkForRecoverableSession: (workspaceId: string) => Promise<boolean>
  recoverSession: (sessionId: string) => Promise<boolean>
  saveSessionToTempStorage: () => Promise<void>
  convertToTempContent: () => SimplifiedTempContent | null
  restorePersistedSession: () => Promise<boolean>
}

type SubtitleEditStore = SubtitleEditState & SubtitleEditActions

export const useSubtitleEditStore = create<SubtitleEditStore>()(subscribeWithSelector(persist((set, get) => ({
  session: null,
  edits: [],
  isLoading: false,
  error: null,
  undoStack: [],
  redoStack: [],
  isAutoSaving: false,
  lastAutoSave: null,
  // Enhanced persistence state
  sessionRecovery: {
    hasRecoverableSession: false,
    recoverableSessionId: null,
    lastSessionWorkspaceId: null
  },
  persistenceEnabled: false,
  tempStorageId: null,

  initializeSession: async (subtitlePath: string, videoPath: string, importedData?: any[], preTransformed: boolean = false) => {
    try {
      set({ isLoading: true, error: null })
      
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
            originalText: sub.translation || sub.originalText || undefined,
            confidence: sub.confidence || undefined,
            speaker: sub.speaker || undefined,
            isMusic: sub.isMusic || false
          }))
      
      // Create proper TempSubtitleSession
      const sessionData: TempSubtitleSession = {
        sessionId: `session-${Date.now()}`,
        originalPath: subtitlePath,
        tempPath: subtitlePath,
        videoPath,
        originalSubtitles: [...transformedSubtitles],
        currentSubtitles: transformedSubtitles,
        modifications: [],
        lastModified: new Date(),
        isDirty: false,
        currentTime: 0,
        selectedSubtitleId: null,
        isVideoPlaying: false,
        shouldAutoPause: false,
        videoDuration: 0
      }
      
      set({ 
        session: sessionData,
        isLoading: false 
      })
      
      console.log('✅ Subtitle editing session initialized:', sessionData)
    } catch (error) {
      console.error('Failed to initialize subtitle session:', error)
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
      lastAutoSave: null
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
      originalText: undefined,
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
      originalText: firstSubtitle.originalText && secondSubtitle.originalText
        ? `${firstSubtitle.originalText} ${secondSubtitle.originalText}`.trim()
        : firstSubtitle.originalText || secondSubtitle.originalText
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
  },

  clearUndoRedo: () => {
    set((state) => ({
      undoStack: [],
      redoStack: []
    }))
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
      sessionRecovery: {
        hasRecoverableSession: false,
        recoverableSessionId: null,
        lastSessionWorkspaceId: null
      },
      persistenceEnabled: false,
      tempStorageId: null
    })
  },

  // Enhanced persistence actions
  enablePersistence: (workspaceId: string) => {
    set((state) => ({
      persistenceEnabled: true,
      sessionRecovery: {
        ...state.sessionRecovery,
        lastSessionWorkspaceId: workspaceId
      },
      tempStorageId: state.tempStorageId || generateTempStorageId('session')
    }))
  },

  disablePersistence: () => {
    set({
      persistenceEnabled: false,
      tempStorageId: null
    })
  },

  checkForRecoverableSession: async (workspaceId: string): Promise<boolean> => {
    try {
      // Check IndexedDB for existing session using proper database name
      const dbRequest = indexedDB.open('CantoCap_SubtitleTemp', 1)
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        dbRequest.onsuccess = () => resolve(dbRequest.result)
        dbRequest.onerror = () => reject(dbRequest.error)
        
        // Add onupgradeneeded handler to create object stores if they don't exist
        dbRequest.onupgradeneeded = (event) => {
          const database = (event.target as IDBOpenDBRequest).result
          
          // Create stores if they don't exist
          if (!database.objectStoreNames.contains('subtitle_temp_storage')) {
            const storageStore = database.createObjectStore('subtitle_temp_storage', { keyPath: 'id' })
            storageStore.createIndex('workspaceId', 'workspaceId', { unique: false })
            storageStore.createIndex('sessionId', 'sessionId', { unique: false })
            storageStore.createIndex('storageType', 'storageType', { unique: false })
            storageStore.createIndex('lastModified', 'lastModified', { unique: false })
          }
          
          if (!database.objectStoreNames.contains('subtitle_temp_sessions')) {
            const sessionStore = database.createObjectStore('subtitle_temp_sessions', { keyPath: 'sessionId' })
            sessionStore.createIndex('workspaceId', 'workspaceId', { unique: false })
            sessionStore.createIndex('sessionType', 'sessionType', { unique: false })
            sessionStore.createIndex('lastActivity', 'lastActivity', { unique: false })
          }
        }
      })

      // Check if object stores exist before creating transaction
      if (!db.objectStoreNames.contains('subtitle_temp_sessions')) {
        console.warn('IndexedDB subtitle_temp_sessions store does not exist')
        return false
      }

      const transaction = db.transaction(['subtitle_temp_sessions'], 'readonly')
      const store = transaction.objectStore('subtitle_temp_sessions')
      const index = store.index('workspaceId')
      
      const records = await new Promise<any[]>((resolve, reject) => {
        const request = index.getAll(workspaceId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      
      const activeSession = records.find(record => record.status === 'active')
      
      if (activeSession) {
        set((state) => ({
          sessionRecovery: {
            ...state.sessionRecovery,
            hasRecoverableSession: true,
            recoverableSessionId: activeSession.sessionId,
            lastSessionWorkspaceId: workspaceId
          }
        }))
        return true
      }
      
      return false
    } catch (error) {
      console.error('Failed to check for recoverable session:', error)
      return false
    }
  },

  recoverSession: async (sessionId: string): Promise<boolean> => {
    try {
      // Load session from IndexedDB using proper database initialization
      const dbRequest = indexedDB.open('CantoCap_SubtitleTemp', 1)
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        dbRequest.onsuccess = () => resolve(dbRequest.result)
        dbRequest.onerror = () => reject(dbRequest.error)
        
        // Add onupgradeneeded handler to create object stores if they don't exist
        dbRequest.onupgradeneeded = (event) => {
          const database = (event.target as IDBOpenDBRequest).result
          
          // Create stores if they don't exist
          if (!database.objectStoreNames.contains('subtitle_temp_storage')) {
            const storageStore = database.createObjectStore('subtitle_temp_storage', { keyPath: 'id' })
            storageStore.createIndex('workspaceId', 'workspaceId', { unique: false })
            storageStore.createIndex('sessionId', 'sessionId', { unique: false })
            storageStore.createIndex('storageType', 'storageType', { unique: false })
            storageStore.createIndex('lastModified', 'lastModified', { unique: false })
          }
          
          if (!database.objectStoreNames.contains('subtitle_temp_sessions')) {
            const sessionStore = database.createObjectStore('subtitle_temp_sessions', { keyPath: 'sessionId' })
            sessionStore.createIndex('workspaceId', 'workspaceId', { unique: false })
            sessionStore.createIndex('sessionType', 'sessionType', { unique: false })
            sessionStore.createIndex('lastActivity', 'lastActivity', { unique: false })
          }
        }
      })

      // Check if object stores exist before creating transaction
      if (!db.objectStoreNames.contains('subtitle_temp_sessions') || 
          !db.objectStoreNames.contains('subtitle_temp_storage')) {
        console.warn('IndexedDB object stores do not exist, cannot recover session')
        return false
      }

      const transaction = db.transaction(['subtitle_temp_sessions', 'subtitle_temp_storage'], 'readonly')
      const sessionStore = transaction.objectStore('subtitle_temp_sessions')
      const contentStore = transaction.objectStore('subtitle_temp_storage')
      
      const sessionRecord = await new Promise<any>((resolve, reject) => {
        const request = sessionStore.get(sessionId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      
      if (!sessionRecord) {
        return false
      }
      
      // Find the latest content for this session
      const sessionIndex = contentStore.index('sessionId')
      const contentRecords = await new Promise<any[]>((resolve, reject) => {
        const request = sessionIndex.getAll(sessionId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      
      const latestContent = contentRecords
        .sort((a, b) => b.lastModified - a.lastModified)[0]
      
      if (latestContent) {
        const content = JSON.parse(latestContent.contentData) as SimplifiedTempContent
        const sessionData = JSON.parse(sessionRecord.sessionData)
        
        // Convert temp content back to session format
        const recoveredSession: TempSubtitleSession = {
          sessionId: sessionData.sessionId,
          originalPath: content.metadata.originalPath,
          tempPath: content.metadata.tempPath,
          videoPath: content.editingContext.videoPath || '',
          originalSubtitles: content.subtitles.map((sub, index) => ({
            id: sub.id.toString(),
            index: index,
            startTime: sub.startTime,
            endTime: sub.endTime,
            duration: sub.endTime - sub.startTime,
            text: sub.text,
            originalText: sub.translation || sub.text,
            confidence: sub.confidence,
            speaker: sub.speaker
          })),
          currentSubtitles: content.subtitles.map((sub, index) => ({
            id: sub.id.toString(),
            index: index,
            startTime: sub.startTime,
            endTime: sub.endTime,
            duration: sub.endTime - sub.startTime,
            text: sub.text,
            originalText: sub.translation || sub.text,
            confidence: sub.confidence,
            speaker: sub.speaker
          })),
          modifications: [],
          lastModified: new Date(content.metadata.lastModified),
          isDirty: false,
          currentTime: content.editingContext.currentTime || 0,
          selectedSubtitleId: content.editingContext.selectedSubtitleId,
          isVideoPlaying: content.editingContext.isVideoPlaying || false,
          shouldAutoPause: false,
          videoDuration: content.editingContext.videoDuration || 0
        }
        
        set({
          session: recoveredSession,
          sessionRecovery: {
            hasRecoverableSession: false,
            recoverableSessionId: null,
            lastSessionWorkspaceId: null
          },
          tempStorageId: latestContent.id
        })
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Failed to recover session:', error)
      return false
    }
  },

  saveSessionToTempStorage: async (): Promise<void> => {
    const state = get()
    if (!state.session || !state.persistenceEnabled || !state.tempStorageId) {
      return
    }

    const tempContent = state.convertToTempContent()
    if (!tempContent) {
      return
    }

    try {
      // Save to IndexedDB using proper database name
      const dbRequest = indexedDB.open('CantoCap_SubtitleTemp', 1)
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        dbRequest.onsuccess = () => resolve(dbRequest.result)
        dbRequest.onerror = () => reject(dbRequest.error)
        
        // Add onupgradeneeded handler to create object stores if they don't exist
        dbRequest.onupgradeneeded = (event) => {
          const database = (event.target as IDBOpenDBRequest).result
          
          // Create stores if they don't exist
          if (!database.objectStoreNames.contains('subtitle_temp_storage')) {
            const storageStore = database.createObjectStore('subtitle_temp_storage', { keyPath: 'id' })
            storageStore.createIndex('workspaceId', 'workspaceId', { unique: false })
            storageStore.createIndex('sessionId', 'sessionId', { unique: false })
            storageStore.createIndex('storageType', 'storageType', { unique: false })
            storageStore.createIndex('lastModified', 'lastModified', { unique: false })
          }
          
          if (!database.objectStoreNames.contains('subtitle_temp_sessions')) {
            const sessionStore = database.createObjectStore('subtitle_temp_sessions', { keyPath: 'sessionId' })
            sessionStore.createIndex('workspaceId', 'workspaceId', { unique: false })
            sessionStore.createIndex('sessionType', 'sessionType', { unique: false })
            sessionStore.createIndex('lastActivity', 'lastActivity', { unique: false })
          }
        }
      })

      // Check if object stores exist before creating transaction
      if (!db.objectStoreNames.contains('subtitle_temp_storage')) {
        console.warn('IndexedDB subtitle_temp_storage store does not exist, cannot save session')
        return
      }

      const transaction = db.transaction(['subtitle_temp_storage'], 'readwrite')
      const store = transaction.objectStore('subtitle_temp_storage')
      
      const record = {
        id: state.tempStorageId,
        workspaceId: state.sessionRecovery.lastSessionWorkspaceId,
        sessionId: state.session.sessionId,
        storageType: 'auto_save',
        contentData: JSON.stringify(tempContent),
        contentHash: '',
        createdAt: Date.now(),
        lastModified: Date.now(),
        dataSize: JSON.stringify(tempContent).length,
        version: 1,
        schemaVersion: 1,
        isCompressed: false,
        generationLevel: 0,
        isLatest: true
      }
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(record)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
      
      set({ lastAutoSave: new Date() })
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
        contentId: generateTempStorageId('content'),
        workspaceId: state.sessionRecovery.lastSessionWorkspaceId || 'unknown',
        sessionId: state.session.sessionId,
        originalPath: state.session.originalPath,
        tempPath: state.session.tempPath,
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
        originalText: subtitle.originalText,
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
      // Try to recover from IndexedDB first (enhanced system)
      const sessionId = state.sessionRecovery.recoverableSessionId
      const success = await state.recoverSession(sessionId)
      
      if (success) {
        console.log('✅ Session recovered from IndexedDB:', sessionId)
        return true
      }
      
      // If IndexedDB recovery fails, check if we have persisted session data in localStorage
      const persistedState: any = JSON.parse(localStorage.getItem('subtitle-edit-store') || '{}')
      
      if (persistedState.state?.session && persistedState.state.session.isDirty) {
        // Reconstruct minimal session for recovery dialog
        const sessionInfo = persistedState.state.session
        
        // Create a placeholder session that can trigger the recovery dialog
        const partialSession: TempSubtitleSession = {
          sessionId: sessionInfo.sessionId,
          originalPath: sessionInfo.originalPath,
          tempPath: sessionInfo.tempPath,
          videoPath: sessionInfo.videoPath,
          originalSubtitles: [], // Will be loaded from temp storage
          currentSubtitles: [], // Will be loaded from temp storage
          modifications: [],
          lastModified: new Date(sessionInfo.lastModified),
          isDirty: sessionInfo.isDirty,
          currentTime: sessionInfo.currentTime || 0,
          selectedSubtitleId: sessionInfo.selectedSubtitleId,
          isVideoPlaying: false,
          shouldAutoPause: false,
          videoDuration: sessionInfo.videoDuration || 0
        }
        
        set((state) => ({
          session: partialSession,
          sessionRecovery: {
            hasRecoverableSession: true,
            recoverableSessionId: sessionInfo.sessionId,
            lastSessionWorkspaceId: state.sessionRecovery.lastSessionWorkspaceId
          }
        }))
        
        console.log('📝 Partial session restored from localStorage for recovery:', sessionInfo.sessionId)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Failed to restore persisted session:', error)
      return false
    }
  }
}), {
  name: 'subtitle-edit-store',
  partialize: (state) => ({
    // Persist the core session data for app restart recovery
    session: state.session ? {
      sessionId: state.session.sessionId,
      originalPath: state.session.originalPath,
      tempPath: state.session.tempPath,
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
    tempStorageId: state.tempStorageId,
    // Store edit count for session info
    edits: state.edits.slice(-10), // Keep last 10 edits for context
    lastAutoSave: state.lastAutoSave
  }),
  // Enhanced merge function to handle session restoration
  merge: (persistedState: any, currentState: SubtitleEditStore) => {
    const merged = { ...currentState, ...persistedState }
    
    // If we have a persisted session, mark it as recoverable
    if (persistedState?.session && persistedState.session.isDirty) {
      merged.sessionRecovery = {
        hasRecoverableSession: true,
        recoverableSessionId: persistedState.session.sessionId,
        lastSessionWorkspaceId: persistedState.sessionRecovery?.lastSessionWorkspaceId || null
      }
    }
    
    return merged
  }
})))

// Auto-save subscription for temp storage integration
let autoSaveInterval: NodeJS.Timeout | null = null

// Subscribe to state changes for auto-save
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

// Clean up duplicate class definition for testing compatibility