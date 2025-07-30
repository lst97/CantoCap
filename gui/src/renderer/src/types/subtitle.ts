// Subtitle Editing Types

export interface SubtitleEntry {
  id: string
  index: number
  startTime: number
  endTime: number
  duration: number
  text: string
  originalText?: string
  confidence?: number
  speaker?: string
  cueSettings?: string // VTT cue settings like "line:90%"
}

export interface SubtitleModification {
  id: string
  subtitleId: string
  timestamp: string
  type: 'added' | 'modified' | 'deleted' | 'split' | 'merged'
  original?: SubtitleEntry
  modified?: SubtitleEntry
  changeTimestamp: Date
  description: string
}

export interface TempSubtitleSession {
  sessionId: string
  originalPath: string
  tempPath: string
  videoPath: string
  originalSubtitles: SubtitleEntry[]
  currentSubtitles: SubtitleEntry[]
  modifications: SubtitleModification[]
  lastModified: Date
  isDirty: boolean
  currentTime: number
  selectedSubtitleId: string | null
  isVideoPlaying: boolean
  shouldAutoPause: boolean
  videoDuration: number
}

export interface SubtitleEditState {
  session: TempSubtitleSession | null
  isLoading: boolean
  error: string | null
  undoStack: SubtitleModification[]
  redoStack: SubtitleModification[]
  isAutoSaving: boolean
  lastAutoSave: Date | null
}

export interface DiffLine {
  type: 'added' | 'deleted' | 'unchanged'
  content: string
  lineNumber?: number
}

export interface SubtitleDiff {
  subtitleId: string
  lines: DiffLine[]
  changeType: 'modified' | 'added' | 'deleted'
}

export interface VideoSubtitleSync {
  videoFile: string
  srtFile: string
  isValidSync: boolean
  duration: number
  error?: string
}