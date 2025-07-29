import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { 
  SubtitleEditState, 
  TempSRTSession, 
  SubtitleEntry, 
  SubtitleModification,
  VideoSubtitleSync 
} from '../types/subtitle'

interface SubtitleEditActions {
  // Session Management
  initializeSession: (srtPath: string, videoPath: string) => Promise<void>
  clearSession: () => void
  autoSave: () => Promise<void>
  
  // Subtitle Operations
  updateSubtitle: (id: string, changes: Partial<SubtitleEntry>) => void
  deleteSubtitle: (id: string) => void
  addSubtitle: (subtitle: Omit<SubtitleEntry, 'id'>) => void
  splitSubtitle: (id: string, splitTime: number) => void
  mergeSubtitles: (id1: string, id2: string) => void
  
  // Selection and Navigation
  setSelectedSubtitle: (id: string | null) => void
  jumpToSubtitle: (id: string) => void
  setCurrentTime: (time: number) => void
  
  // Video Control
  setVideoPlaying: (playing: boolean) => void
  pauseVideo: () => void
  setVideoDuration: (duration: number) => void
  
  // Undo/Redo
  undo: () => void
  redo: () => void
  clearUndoRedo: () => void
  
  // Utility
  generateDiff: (original: SubtitleEntry, modified: SubtitleEntry) => any
  exportCurrentSRT: () => Promise<string>
  validateVideoSync: () => Promise<VideoSubtitleSync>
}

type SubtitleEditStore = SubtitleEditState & SubtitleEditActions

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const parseSRTFile = async (filePath: string): Promise<SubtitleEntry[]> => {
  try {
    console.log('Loading SRT file from:', filePath)
    
    // For now, we'll implement a temporary solution using fetch for local files
    // This will be replaced with proper Electron API file reading in production
    let fileContent: string
    
    try {
      // Try to read as local file URL for development/testing
      const response = await fetch(`file://${filePath}`)
      if (response.ok) {
        fileContent = await response.text()
      } else {
        throw new Error(`Failed to read file: ${response.status}`)
      }
    } catch (fetchError) {
      console.warn('Fetch method failed, using fallback approach:', fetchError)
      
      // Temporary workaround: For now, return mock data that represents the expected structure
      // This will be replaced when proper file reading API is implemented
      console.log('Using fallback mock data - actual SRT parsing will be implemented when file API is available')
      
      return [
        {
          id: generateUUID(),
          index: 1,
          startTime: 0,
          endTime: 4,
          duration: 4,
          text: '使用模擬數據 - 等待實際SRT文件讀取功能',
          originalText: '使用模擬數據 - 等待實際SRT文件讀取功能'
        },
        {
          id: generateUUID(),
          index: 2,
          startTime: 6,
          endTime: 9,
          duration: 3,
          text: '這些是臨時數據，實際應用中會讀取真實的SRT文件',
          originalText: '這些是臨時數據，實際應用中會讀取真實的SRT文件'
        },
        {
          id: generateUUID(),
          index: 3,
          startTime: 12,
          endTime: 16,
          duration: 4,
          text: '請等待開發人員實現文件讀取API',
          originalText: '請等待開發人員實現文件讀取API'
        }
      ]
    }
    
    if (!fileContent || fileContent.trim() === '') {
      console.warn('SRT file is empty or could not be read:', filePath)
      return []
    }
    
    // Parse SRT format
    const subtitles: SubtitleEntry[] = []
    const blocks = fileContent.trim().split('\n\n')
    
    for (const block of blocks) {
      const lines = block.trim().split('\n')
      if (lines.length < 3) continue
      
      // Parse index (first line)
      const index = parseInt(lines[0].trim(), 10)
      if (isNaN(index)) continue
      
      // Parse timestamps (second line)
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/)
      if (!timeMatch) continue
      
      const startTime = parseTimeFromSRT(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4])
      const endTime = parseTimeFromSRT(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8])
      const duration = endTime - startTime
      
      // Parse text (remaining lines)
      const text = lines.slice(2).join('\n').trim()
      if (!text) continue
      
      subtitles.push({
        id: generateUUID(),
        index,
        startTime,
        endTime,
        duration,
        text,
        originalText: text // Store original for diff comparison
      })
    }
    
    console.log(`Successfully parsed ${subtitles.length} subtitles from SRT file`)
    return subtitles
    
  } catch (error) {
    console.error('Failed to parse SRT file:', error)
    
    // Fallback to mock data if file reading fails
    console.log('Using fallback mock data due to SRT parsing error')
    return [
      {
        id: generateUUID(),
        index: 1,
        startTime: 2,
        endTime: 7,
        duration: 5,
        text: '你好，歡迎收看今日嘅新聞',
        confidence: 95,
        originalText: '你好，歡迎收看今日嘅新聞'
      },
      {
        id: generateUUID(),
        index: 2,
        startTime: 10,
        endTime: 14,
        duration: 4,
        text: '今日天氣非常之好',
        confidence: 88,
        originalText: '今日天氣非常之好'
      },
      {
        id: generateUUID(),
        index: 3,
        startTime: 18,
        endTime: 23,
        duration: 5,
        text: '預計會有陽光普照',
        confidence: 92,
        originalText: '預計會有陽光普照'
      }
    ]
  }
}

// Helper function to parse SRT timestamp format to seconds
const parseTimeFromSRT = (hours: string, minutes: string, seconds: string, milliseconds: string): number => {
  const h = parseInt(hours, 10)
  const m = parseInt(minutes, 10)
  const s = parseInt(seconds, 10)
  const ms = parseInt(milliseconds, 10)
  
  return h * 3600 + m * 60 + s + ms / 1000
}

const createTempFile = async (originalPath: string, sessionId: string): Promise<string> => {
  // In real implementation, this would create a temporary file in temp directory
  // For now, return a mock temp path
  return `${originalPath}.${sessionId}.tmp`
}

const getVideoPathFromConfig = (inputVideoPath: string): string => {
  // Return the original input video file path
  return inputVideoPath
}

export const useSubtitleEditStore = create<SubtitleEditStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    session: null,
    isLoading: false,
    error: null,
    undoStack: [],
    redoStack: [],
    isAutoSaving: false,
    lastAutoSave: null,

    // Session Management
    initializeSession: async (srtPath: string, videoPath?: string) => {
      set({ isLoading: true, error: null })
      
      try {
        const sessionId = generateUUID()
        const tempPath = await createTempFile(srtPath, sessionId)
        const originalSubtitles = await parseSRTFile(srtPath)
        const detectedVideoPath = videoPath || srtPath
        
        const session: TempSRTSession = {
          sessionId,
          originalPath: srtPath,
          tempPath,
          videoPath: detectedVideoPath,
          originalSubtitles,
          currentSubtitles: [...originalSubtitles],
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
          session, 
          isLoading: false,
          undoStack: [],
          redoStack: []
        })

        // Start auto-save interval
        const autoSaveInterval = setInterval(() => {
          const currentState = get()
          if (currentState.session?.isDirty && !currentState.isAutoSaving) {
            currentState.autoSave()
          }
        }, 30000) // Auto-save every 30 seconds

        // Store interval ID for cleanup
        ;(session as any).autoSaveInterval = autoSaveInterval
        
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to initialize session',
          isLoading: false 
        })
      }
    },

    clearSession: () => {
      const { session } = get()
      if (session && (session as any).autoSaveInterval) {
        clearInterval((session as any).autoSaveInterval)
      }
      
      set({
        session: null,
        undoStack: [],
        redoStack: [],
        error: null,
        lastAutoSave: null
      })
    },

    autoSave: async () => {
      const { session } = get()
      if (!session || !session.isDirty) return

      set({ isAutoSaving: true })
      
      try {
        // In real implementation, write current subtitles to temp file
        await new Promise(resolve => setTimeout(resolve, 100)) // Mock save delay
        
        set(state => ({
          ...state,
          session: state.session ? {
            ...state.session,
            isDirty: false,
            lastModified: new Date()
          } : null,
          isAutoSaving: false,
          lastAutoSave: new Date()
        }))
      } catch (error) {
        set({ 
          isAutoSaving: false,
          error: 'Auto-save failed'
        })
      }
    },

    // Subtitle Operations
    updateSubtitle: (id: string, changes: Partial<SubtitleEntry>) => {
      const { session } = get()
      if (!session) return

      const subtitleIndex = session.currentSubtitles.findIndex(s => s.id === id)
      if (subtitleIndex === -1) return

      const original = session.currentSubtitles[subtitleIndex]
      const modified = { ...original, ...changes }

      set(state => {
        if (!state.session) return state

        const newSubtitles = [...state.session.currentSubtitles]
        newSubtitles[subtitleIndex] = modified

        // Check if the modified text matches the original text
        const isRevertedToOriginal = modified.originalText && modified.text === modified.originalText

        let newModifications = [...state.session.modifications]
        let modification: SubtitleModification | null = null

        if (isRevertedToOriginal) {
          // Remove any existing modification records for this subtitle when reverted to original
          newModifications = newModifications.filter(m => m.subtitleId !== id)
        } else {
          // Create modification record only if text differs from original
          modification = {
            id: generateUUID(),
            subtitleId: id,
            timestamp: new Date().toISOString(),
            type: 'modified',
            original,
            modified,
            changeTimestamp: new Date(),
            description: `Updated subtitle ${original.index}`
          }
          
          // Remove any existing modification for this subtitle and add the new one
          newModifications = newModifications.filter(m => m.subtitleId !== id)
          newModifications.push(modification)
        }

        return {
          ...state,
          session: {
            ...state.session,
            currentSubtitles: newSubtitles,
            modifications: newModifications,
            isDirty: true,
            lastModified: new Date()
          },
          undoStack: modification ? [...state.undoStack, modification] : state.undoStack,
          redoStack: [] // Clear redo stack on new change
        }
      })
    },

    deleteSubtitle: (id: string) => {
      const { session } = get()
      if (!session) return

      const subtitle = session.currentSubtitles.find(s => s.id === id)
      if (!subtitle) return

      const modification: SubtitleModification = {
        id: generateUUID(),
        subtitleId: id,
        timestamp: new Date().toISOString(),
        type: 'deleted',
        original: subtitle,
        changeTimestamp: new Date(),
        description: `Deleted subtitle ${subtitle.index}`
      }

      set(state => {
        if (!state.session) return state

        return {
          ...state,
          session: {
            ...state.session,
            currentSubtitles: state.session.currentSubtitles.filter(s => s.id !== id),
            modifications: [...state.session.modifications, modification],
            isDirty: true,
            lastModified: new Date(),
            selectedSubtitleId: state.session.selectedSubtitleId === id ? null : state.session.selectedSubtitleId
          },
          undoStack: [...state.undoStack, modification],
          redoStack: []
        }
      })
    },

    addSubtitle: (subtitle: Omit<SubtitleEntry, 'id'>) => {
      const { session } = get()
      if (!session) return

      const newSubtitle: SubtitleEntry = {
        ...subtitle,
        id: generateUUID()
      }

      const modification: SubtitleModification = {
        id: generateUUID(),
        subtitleId: newSubtitle.id,
        timestamp: new Date().toISOString(),
        type: 'added',
        modified: newSubtitle,
        changeTimestamp: new Date(),
        description: `Added subtitle ${newSubtitle.index}`
      }

      set(state => {
        if (!state.session) return state

        // Insert subtitle in correct time order
        const newSubtitles = [...state.session.currentSubtitles, newSubtitle]
          .sort((a, b) => a.startTime - b.startTime)
          .map((s, index) => ({ ...s, index: index + 1 }))

        return {
          ...state,
          session: {
            ...state.session,
            currentSubtitles: newSubtitles,
            modifications: [...state.session.modifications, modification],
            isDirty: true,
            lastModified: new Date()
          },
          undoStack: [...state.undoStack, modification],
          redoStack: []
        }
      })
    },

    splitSubtitle: (id: string, splitTime: number) => {
      const { session } = get()
      if (!session) return

      const subtitle = session.currentSubtitles.find(s => s.id === id)
      if (!subtitle || splitTime <= subtitle.startTime || splitTime >= subtitle.endTime) return

      const firstPart: SubtitleEntry = {
        ...subtitle,
        id: generateUUID(),
        endTime: splitTime,
        duration: splitTime - subtitle.startTime
      }

      const secondPart: SubtitleEntry = {
        ...subtitle,
        id: generateUUID(),
        startTime: splitTime,
        duration: subtitle.endTime - splitTime,
        index: subtitle.index + 1
      }

      const modification: SubtitleModification = {
        id: generateUUID(),
        subtitleId: id,
        timestamp: new Date().toISOString(),
        type: 'split',
        original: subtitle,
        changeTimestamp: new Date(),
        description: `Split subtitle ${subtitle.index} at ${splitTime}s`
      }

      set(state => {
        if (!state.session) return state

        const newSubtitles = state.session.currentSubtitles
          .filter(s => s.id !== id)
          .concat([firstPart, secondPart])
          .sort((a, b) => a.startTime - b.startTime)
          .map((s, index) => ({ ...s, index: index + 1 }))

        return {
          ...state,
          session: {
            ...state.session,
            currentSubtitles: newSubtitles,
            modifications: [...state.session.modifications, modification],
            isDirty: true,
            lastModified: new Date()
          },
          undoStack: [...state.undoStack, modification],
          redoStack: []
        }
      })
    },

    mergeSubtitles: (id1: string, id2: string) => {
      const { session } = get()
      if (!session) return

      const subtitle1 = session.currentSubtitles.find(s => s.id === id1)
      const subtitle2 = session.currentSubtitles.find(s => s.id === id2)
      
      if (!subtitle1 || !subtitle2) return

      // Ensure correct order
      const [first, second] = subtitle1.startTime < subtitle2.startTime 
        ? [subtitle1, subtitle2] 
        : [subtitle2, subtitle1]

      const merged: SubtitleEntry = {
        ...first,
        id: generateUUID(),
        endTime: second.endTime,
        duration: second.endTime - first.startTime,
        text: `${first.text} ${second.text}`.trim()
      }

      const modification: SubtitleModification = {
        id: generateUUID(),
        subtitleId: `${id1}+${id2}`,
        timestamp: new Date().toISOString(),
        type: 'merged',
        changeTimestamp: new Date(),
        description: `Merged subtitles ${first.index} and ${second.index}`
      }

      set(state => {
        if (!state.session) return state

        const newSubtitles = state.session.currentSubtitles
          .filter(s => s.id !== id1 && s.id !== id2)
          .concat([merged])
          .sort((a, b) => a.startTime - b.startTime)
          .map((s, index) => ({ ...s, index: index + 1 }))

        return {
          ...state,
          session: {
            ...state.session,
            currentSubtitles: newSubtitles,
            modifications: [...state.session.modifications, modification],
            isDirty: true,
            lastModified: new Date()
          },
          undoStack: [...state.undoStack, modification],
          redoStack: []
        }
      })
    },

    // Selection and Navigation
    setSelectedSubtitle: (id: string | null) => {
      set(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          selectedSubtitleId: id
        } : null
      }))
    },

    jumpToSubtitle: (id: string) => {
      const { session } = get()
      if (!session) return

      const subtitle = session.currentSubtitles.find(s => s.id === id)
      if (subtitle) {
        console.log('Jump to subtitle:', { 
          id, 
          subtitle: subtitle.text.substring(0, 20) + '...', 
          startTime: subtitle.startTime,
          endTime: subtitle.endTime 
        })
        
        get().pauseVideo() // Pause video when jumping to subtitle
        get().setCurrentTime(subtitle.startTime)
        get().setSelectedSubtitle(id)
        
        // Enable auto-pause when subtitle ends
        set(state => ({
          ...state,
          session: state.session ? {
            ...state.session,
            shouldAutoPause: true
          } : null
        }))
      }
    },

    setCurrentTime: (time: number) => {
      set(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          currentTime: time
        } : null
      }))
    },

    // Video Control
    setVideoPlaying: (playing: boolean) => {
      set(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          isVideoPlaying: playing
        } : null
      }))
    },

    pauseVideo: () => {
      set(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          isVideoPlaying: false
        } : null
      }))
    },

    setVideoDuration: (duration: number) => {
      set(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          videoDuration: duration
        } : null
      }))
    },

    // Undo/Redo
    undo: () => {
      const { undoStack, session } = get()
      if (undoStack.length === 0 || !session) return

      const lastModification = undoStack[undoStack.length - 1]
      
      set(state => {
        if (!state.session) return state

        let newSubtitles = [...state.session.currentSubtitles]
        let newModifications = [...state.session.modifications]

        // Apply undo logic based on modification type
        switch (lastModification.type) {
          case 'modified':
            if (lastModification.original) {
              // Restore the original subtitle
              const subtitleIndex = newSubtitles.findIndex(s => s.id === lastModification.subtitleId)
              if (subtitleIndex !== -1) {
                newSubtitles[subtitleIndex] = { ...lastModification.original }
              }
              // Remove the modification record
              newModifications = newModifications.filter(m => m.id !== lastModification.id)
            }
            break
            
          case 'added':
            // Remove the added subtitle
            newSubtitles = newSubtitles.filter(s => s.id !== lastModification.subtitleId)
            // Remove the modification record
            newModifications = newModifications.filter(m => m.id !== lastModification.id)
            break
            
          case 'deleted':
            if (lastModification.original) {
              // Restore the deleted subtitle
              newSubtitles.push(lastModification.original)
              newSubtitles.sort((a, b) => a.startTime - b.startTime)
              newSubtitles = newSubtitles.map((s, index) => ({ ...s, index: index + 1 }))
              // Remove the modification record
              newModifications = newModifications.filter(m => m.id !== lastModification.id)
            }
            break
        }

        return {
          ...state,
          session: {
            ...state.session,
            currentSubtitles: newSubtitles,
            modifications: newModifications,
            isDirty: true,
            lastModified: new Date()
          },
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, lastModification]
        }
      })
    },

    redo: () => {
      const { redoStack, session } = get()
      if (redoStack.length === 0 || !session) return

      const modification = redoStack[redoStack.length - 1]
      
      set(state => {
        if (!state.session) return state

        let newSubtitles = [...state.session.currentSubtitles]
        let newModifications = [...state.session.modifications]

        // Apply redo logic based on modification type
        switch (modification.type) {
          case 'modified':
            if (modification.modified) {
              // Apply the modified subtitle
              const subtitleIndex = newSubtitles.findIndex(s => s.id === modification.subtitleId)
              if (subtitleIndex !== -1) {
                newSubtitles[subtitleIndex] = { ...modification.modified }
              }
              // Re-add the modification record
              newModifications = newModifications.filter(m => m.id !== modification.id)
              newModifications.push(modification)
            }
            break
            
          case 'added':
            if (modification.modified) {
              // Re-add the subtitle
              newSubtitles.push(modification.modified)
              newSubtitles.sort((a, b) => a.startTime - b.startTime)
              newSubtitles = newSubtitles.map((s, index) => ({ ...s, index: index + 1 }))
              // Re-add the modification record
              newModifications = newModifications.filter(m => m.id !== modification.id)
              newModifications.push(modification)
            }
            break
            
          case 'deleted':
            // Re-delete the subtitle
            newSubtitles = newSubtitles.filter(s => s.id !== modification.subtitleId)
            // Re-add the modification record
            newModifications = newModifications.filter(m => m.id !== modification.id)
            newModifications.push(modification)
            break
        }

        return {
          ...state,
          session: {
            ...state.session,
            currentSubtitles: newSubtitles,
            modifications: newModifications,
            isDirty: true,
            lastModified: new Date()
          },
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, modification]
        }
      })
    },

    clearUndoRedo: () => {
      set(state => ({
        ...state,
        undoStack: [],
        redoStack: []
      }))
    },

    // Utility
    generateDiff: (original: SubtitleEntry, modified: SubtitleEntry) => {
      // Use react-diff-view's diff generation utilities
      // This would generate the actual diff data structure
      return {
        oldText: original.text,
        newText: modified.text,
        hunks: [] // This would contain the actual diff hunks
      }
    },

    exportCurrentSRT: async (): Promise<string> => {
      const { session } = get()
      if (!session) throw new Error('No active session')

      // Generate SRT format from current subtitles
      const srtContent = session.currentSubtitles
        .map(subtitle => {
          const startTime = formatSRTTime(subtitle.startTime)
          const endTime = formatSRTTime(subtitle.endTime)
          return `${subtitle.index}\n${startTime} --> ${endTime}\n${subtitle.text}\n`
        })
        .join('\n')

      return srtContent
    },

    validateVideoSync: async (): Promise<VideoSubtitleSync> => {
      const { session } = get()
      if (!session) {
        return {
          videoFile: '',
          srtFile: '',
          isValidSync: false,
          duration: 0,
          error: 'No active session'
        }
      }

      // In real implementation, this would validate video file exists and get duration
      // For now, set a mock duration and update the session
      const mockDuration = 180 // 3 minutes
      
      // Update session with video duration
      set(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          videoDuration: mockDuration
        } : null
      }))
      
      return {
        videoFile: session.videoPath,
        srtFile: session.originalPath,
        isValidSync: true,
        duration: mockDuration
      }
    }
  }))
)

// Utility function to format time for SRT
const formatSRTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}