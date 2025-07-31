/**
 * Subtitle Edit Store
 * 
 * Store for subtitle editing functionality with session management
 */

import { create } from 'zustand'
import { TempSubtitleSession, SubtitleEntry, SubtitleModification } from '../types/subtitle'

interface SubtitleEditState {
  session: TempSubtitleSession | null
  edits: SubtitleModification[]
  isLoading: boolean
  error: string | null
  undoStack: SubtitleModification[]
  redoStack: SubtitleModification[]
  isAutoSaving: boolean
  lastAutoSave: Date | null
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
}

type SubtitleEditStore = SubtitleEditState & SubtitleEditActions

export const useSubtitleEditStore = create<SubtitleEditStore>()((set, get) => ({
  session: null,
  edits: [],
  isLoading: false,
  error: null,
  undoStack: [],
  redoStack: [],
  isAutoSaving: false,
  lastAutoSave: null,

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
        videoDuration: 0,
        totalDuration: transformedSubtitles.length > 0 
          ? Math.max(...transformedSubtitles.map(s => s.endTime))
          : 0
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
      lastAutoSave: null
    })
  }
}))

// Export class for testing compatibility
export class SubtitleEditStore {
  constructor() {}
}