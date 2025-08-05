import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { useSubtitleEditStore } from './subtitle-edit-store'
import { useAppStore } from '../stores/app-store'
import { useWorkspaceStore } from './workspace-store'
import { workflowStateManager } from '../services/workflow/workflow-state-manager'
import { StepState } from '../types/workflow-state'
import { convertToSRT, convertToVTT, convertToASS, convertToJSON } from '../utils/format-converters'
import { generateExportId } from '../utils/id-generator'
import type { SubtitleEntry } from '../types/subtitle'
import type { ExportSession } from '../types/workspace'

export interface ExportFormat {
  id: string
  name: string
  extension: string
  description: string
  features: string[]
}

export interface ExportSettings {
  selectedFormat: string
  includeCantonese: boolean
  includeEnglish: boolean
  includeTimestampMetadata: boolean
  includeConfidenceScores: boolean
  customSettings?: Record<string, any>
}

export interface ExportHistoryItem {
  id: string
  fileName: string
  filePath: string
  format: string
  timestamp: number
  size: number
  settings: ExportSettings
  subtitleCount: number
}

export interface ExportProgress {
  isExporting: boolean
  progress: number
  stage: string
  message: string
  error: string | null
  canCancel: boolean
}

export interface ExportPreview {
  content: string
  estimatedSize: number
  subtitleCount: number
  format: ExportFormat
}

interface ExportState {
  // Core state
  settings: ExportSettings
  progress: ExportProgress
  history: ExportHistoryItem[]
  preview: ExportPreview | null
  
  // Available formats
  formats: ExportFormat[]
  
  // Error handling
  lastError: string | null
}

interface ExportActions {
  // Settings management
  updateSettings: (settings: Partial<ExportSettings>) => void
  resetSettings: () => void
  
  // Export operations
  exportSubtitles: (outputPath?: string) => Promise<void>
  exportMultipleFormats: (formats: string[], basePath?: string) => Promise<void>
  cancelExport: () => void
  
  // Preview management
  generatePreview: () => void
  clearPreview: () => void
  
  // History management
  addToHistory: (item: Omit<ExportHistoryItem, 'id'>) => void
  removeFromHistory: (id: string) => void
  clearHistory: () => void
  
  // Workspace Integration
  saveToWorkspace: () => Promise<void>
  loadFromWorkspace: () => Promise<void>
  syncWithWorkspace: () => Promise<void>
  
  // Utility
  getSubtitleData: () => SubtitleEntry[]
  estimateFileSize: (format: string, subtitles: SubtitleEntry[]) => number
  formatFileSize: (bytes: number) => string
  
  // Error handling
  setError: (error: string | null) => void
  clearError: () => void
}

type ExportStore = ExportState & ExportActions

const DEFAULT_FORMATS: ExportFormat[] = [
  { 
    id: 'srt', 
    name: 'SubRip (SRT)', 
    extension: '.srt',
    description: 'Most widely supported subtitle format',
    features: ['Universal compatibility', 'Simple text format', 'Timestamp support']
  },
  { 
    id: 'vtt', 
    name: 'WebVTT (VTT)', 
    extension: '.vtt',
    description: 'Modern web subtitle format',
    features: ['Web optimized', 'Styling support', 'Chapter markers']
  },
  { 
    id: 'ass', 
    name: 'Advanced SSA (ASS)', 
    extension: '.ass',
    description: 'Advanced subtitle format with styling',
    features: ['Advanced styling', 'Positioning', 'Effects support']
  },
  { 
    id: 'json', 
    name: 'JSON Data', 
    extension: '.json',
    description: 'Machine-readable format for developers',
    features: ['Structured data', 'API friendly', 'Metadata included']
  }
]

const DEFAULT_SETTINGS: ExportSettings = {
  selectedFormat: 'srt',
  includeCantonese: true,
  includeEnglish: true,
  includeTimestampMetadata: false,
  includeConfidenceScores: false
}

const DEFAULT_PROGRESS: ExportProgress = {
  isExporting: false,
  progress: 0,
  stage: 'idle',
  message: 'Ready to export',
  error: null,
  canCancel: false
}

export const useExportStore = create<ExportStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // Initial state
      settings: DEFAULT_SETTINGS,
      progress: DEFAULT_PROGRESS,
      history: [],
      preview: null,
      formats: DEFAULT_FORMATS,
      lastError: null,

      // Settings management
      updateSettings: (newSettings: Partial<ExportSettings>) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings }
        }))
        
        // Regenerate preview when settings change
        setTimeout(() => get().generatePreview(), 100)
      },

      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS })
        get().generatePreview()
      },

      // Export operations
      exportSubtitles: async (outputPath?: string) => {
        const { settings, getSubtitleData } = get()
        const subtitles = getSubtitleData()
        
        if (subtitles.length === 0) {
          get().setError('No subtitles available for export')
          return
        }

        set(state => ({
          progress: {
            ...state.progress,
            isExporting: true,
            progress: 0,
            stage: 'preparing',
            message: 'Preparing export...',
            error: null,
            canCancel: true
          }
        }))

        try {
          // Show file dialog if no output path provided
          let filePath = outputPath
          if (!filePath) {
            const format = get().formats.find(f => f.id === settings.selectedFormat)
            const result = await window.cantocapAPI.saveFileDialog({
              defaultPath: `subtitles${format?.extension || '.srt'}`,
              filters: [
                { 
                  name: format?.name || 'Subtitle Files', 
                  extensions: [format?.extension.slice(1) || 'srt'] 
                },
                { name: 'All Files', extensions: ['*'] }
              ]
            })
            
            if (result.canceled || !result.filePath) {
              get().cancelExport()
              return
            }
            filePath = result.filePath
          }

          // Update progress
          set(state => ({
            progress: {
              ...state.progress,
              progress: 30,
              stage: 'converting',
              message: 'Converting subtitles...'
            }
          }))

          // Convert subtitles based on format
          let content: string
          switch (settings.selectedFormat) {
            case 'srt':
              content = convertToSRT(subtitles, settings)
              break
            case 'vtt':
              content = convertToVTT(subtitles, settings)
              break
            case 'ass':
              content = convertToASS(subtitles, settings)
              break
            case 'json':
              content = convertToJSON(subtitles, settings)
              break
            default:
              throw new Error(`Unsupported format: ${settings.selectedFormat}`)
          }

          // Update progress
          set(state => ({
            progress: {
              ...state.progress,
              progress: 70,
              stage: 'writing',
              message: 'Writing file...'
            }
          }))

          // Write file
          await window.cantocapAPI.writeExportFile(filePath, content)

          // Get file stats
          const fileSize = new Blob([content]).size
          const format = get().formats.find(f => f.id === settings.selectedFormat)

          // Add to history
          get().addToHistory({
            fileName: filePath.split('/').pop() || 'unknown',
            filePath,
            format: format?.name || settings.selectedFormat,
            timestamp: Date.now(),
            size: fileSize,
            settings: { ...settings },
            subtitleCount: subtitles.length
          })

          // Complete export
          set(state => ({
            progress: {
              ...state.progress,
              progress: 100,
              stage: 'completed',
              message: 'Export completed successfully',
              isExporting: false,
              canCancel: false
            }
          }))

          // Mark export step as completed in workflow using WorkflowStateManager
          await workflowStateManager.transitionState('export', StepState.Complete, {
            reason: 'Export completed successfully'
          })

          // Show success notification using system toast
          const appStore = useAppStore.getState()
          const exportFormat = get().formats.find(f => f.id === settings.selectedFormat)
          appStore.showNotification(
            `Export completed successfully! File saved as ${exportFormat?.name || settings.selectedFormat}.`,
            'success',
            4000
          )

          // Clear progress after delay
          setTimeout(() => {
            set(state => ({
              progress: {
                ...DEFAULT_PROGRESS,
                stage: 'completed',
                message: 'Ready for next export'
              }
            }))
          }, 3000)

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Export failed'
          set(state => ({
            progress: {
              ...state.progress,
              isExporting: false,
              error: errorMessage,
              message: 'Export failed',
              canCancel: false
            }
          }))
          get().setError(errorMessage)
        }
      },

      exportMultipleFormats: async (formatIds: string[], basePath?: string) => {
        const { getSubtitleData } = get()
        const subtitles = getSubtitleData()
        
        if (subtitles.length === 0) {
          get().setError('No subtitles available for export')
          return
        }

        set(state => ({
          progress: {
            ...state.progress,
            isExporting: true,
            progress: 0,
            stage: 'preparing',
            message: 'Preparing multi-format export...',
            error: null,
            canCancel: true
          }
        }))

        try {
          let baseFilePath = basePath
          if (!baseFilePath) {
            const result = await window.cantocapAPI.saveFileDialog({
              defaultPath: 'subtitles',
              filters: [
                { name: 'All Files', extensions: ['*'] }
              ]
            })
            
            if (result.canceled || !result.filePath) {
              get().cancelExport()
              return
            }
            baseFilePath = result.filePath
          }

          const totalFormats = formatIds.length
          const { settings } = get()

          for (let i = 0; i < formatIds.length; i++) {
            const formatId = formatIds[i]
            const format = get().formats.find(f => f.id === formatId)
            if (!format) continue

            const progress = Math.round((i / totalFormats) * 100)
            set(state => ({
              progress: {
                ...state.progress,
                progress,
                stage: 'converting',
                message: `Converting to ${format.name}... (${i + 1}/${totalFormats})`
              }
            }))

            // Convert content
            let content: string
            switch (formatId) {
              case 'srt':
                content = convertToSRT(subtitles, settings)
                break
              case 'vtt':
                content = convertToVTT(subtitles, settings)
                break
              case 'ass':
                content = convertToASS(subtitles, settings)
                break
              case 'json':
                content = convertToJSON(subtitles, settings)
                break
              default:
                continue
            }

            // Write file
            const filePath = `${baseFilePath}${format.extension}`
            await window.cantocapAPI.writeExportFile(filePath, content)

            // Add to history
            const fileSize = new Blob([content]).size
            get().addToHistory({
              fileName: filePath.split('/').pop() || 'unknown',
              filePath,
              format: format.name,
              timestamp: Date.now(),
              size: fileSize,
              settings: { ...settings },
              subtitleCount: subtitles.length
            })
          }

          // Complete export
          set(state => ({
            progress: {
              ...state.progress,
              progress: 100,
              stage: 'completed',
              message: `Exported ${formatIds.length} formats successfully`,
              isExporting: false,
              canCancel: false
            }
          }))

          // Mark export step as completed in workflow using WorkflowStateManager
          await workflowStateManager.transitionState('export', StepState.Complete, {
            reason: 'Multi-format export completed successfully'
          })

          // Show success notification using system toast
          const appStore = useAppStore.getState()
          appStore.showNotification(
            `Multi-format export completed! Exported ${formatIds.length} formats successfully.`,
            'success',
            4000
          )

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Multi-format export failed'
          set(state => ({
            progress: {
              ...state.progress,
              isExporting: false,
              error: errorMessage,
              message: 'Export failed',
              canCancel: false
            }
          }))
          get().setError(errorMessage)
        }
      },

      cancelExport: () => {
        set(state => ({
          progress: {
            ...DEFAULT_PROGRESS,
            stage: 'cancelled',
            message: 'Export cancelled'
          }
        }))
      },

      // Preview management
      generatePreview: () => {
        try {
          const { settings, getSubtitleData, estimateFileSize } = get()
          const subtitles = getSubtitleData()
          
          if (subtitles.length === 0) {
            set({ preview: null })
            return
          }

          // Show all subtitles in preview
          const previewSubtitles = subtitles
          let content: string

          switch (settings.selectedFormat) {
            case 'srt':
              content = convertToSRT(previewSubtitles, settings)
              break
            case 'vtt':
              content = convertToVTT(previewSubtitles, settings)
              break
            case 'ass':
              content = convertToASS(previewSubtitles, settings)
              break
            case 'json':
              content = convertToJSON(previewSubtitles, settings)
              break
            default:
              content = convertToSRT(previewSubtitles, settings)
          }

          const format = get().formats.find(f => f.id === settings.selectedFormat) || get().formats[0]
          const estimatedSize = estimateFileSize(settings.selectedFormat, subtitles)

          set({
            preview: {
              content,
              estimatedSize,
              subtitleCount: subtitles.length,
              format
            }
          })
        } catch (error) {
          console.error('Failed to generate preview:', error)
          set({ preview: null })
        }
      },

      clearPreview: () => {
        set({ preview: null })
      },

      // History management
      addToHistory: (item: Omit<ExportHistoryItem, 'id'>) => {
        const historyItem: ExportHistoryItem = {
          ...item,
          id: generateExportId()
        }

        set(state => ({
          history: [historyItem, ...state.history.slice(0, 19)] // Keep last 20 items
        }))

        // Auto-save to workspace after adding to history
        get().saveToWorkspace().catch(error => {
          console.error('Failed to auto-save export history to workspace:', error)
        })
      },

      removeFromHistory: (id: string) => {
        set(state => ({
          history: state.history.filter(item => item.id !== id)
        }))
      },

      clearHistory: () => {
        set({ history: [] })
      },

      // Workspace Integration
      saveToWorkspace: async () => {
        try {
          const workspaceStore = useWorkspaceStore.getState()
          if (workspaceStore.currentWorkspace) {
            const { settings, history } = get()
            
            const sessionData: ExportSession = {
              lastExportConfig: settings,
              exportHistory: history.map(item => ({
                format: item.format,
                filePath: item.filePath,
                timestamp: item.timestamp,
                fileSize: item.size
              })),
              exportPresets: [] // Could be enhanced to include export presets
            }

            // UPDATED: Use step configuration instead of legacy sessions
            await workspaceStore.setStepConfig(
              workspaceStore.currentWorkspace.id,
              'export',
              {
                exportSettings: get().settings,
                exportHistory: sessionData.exportHistory
              }
            )
          }
        } catch (error) {
          console.error('Failed to save export session to workspace:', error)
          set({ lastError: 'Failed to save export session to workspace' })
        }
      },

      loadFromWorkspace: async () => {
        try {
          const workspaceStore = useWorkspaceStore.getState()
          if (workspaceStore.currentWorkspace) {
            // UPDATED: Use step configuration instead of legacy sessions
            const exportStepConfig = await workspaceStore.getStepConfig(
              workspaceStore.currentWorkspace.id,
              'export'
            )

            if (exportStepConfig?.data) {
              // Restore export settings from step configuration
              set(state => ({
                settings: exportStepConfig.data.exportSettings ? {
                  ...state.settings,
                  ...exportStepConfig.data.exportSettings
                } : state.settings,
                history: exportStepConfig.data.exportHistory || state.history
              }))
            }
          }
        } catch (error) {
          console.error('Failed to load export configuration from workspace:', error)
          set({ lastError: 'Failed to load export configuration from workspace' })
        }
      },

      syncWithWorkspace: async () => {
        try {
          // Load from workspace first, then save current state
          await get().loadFromWorkspace()
          await get().saveToWorkspace()
        } catch (error) {
          console.error('Failed to sync with workspace:', error)
          set({ lastError: 'Failed to sync with workspace' })
        }
      },

      // Utility functions
      getSubtitleData: (): SubtitleEntry[] => {
        const subtitleStore = useSubtitleEditStore.getState()
        return subtitleStore.session?.currentSubtitles || []
      },

      estimateFileSize: (format: string, subtitles: SubtitleEntry[]): number => {
        if (subtitles.length === 0) return 0

        // Rough estimation based on format
        const avgTextLength = subtitles.reduce((sum, sub) => sum + sub.text.length, 0) / subtitles.length
        const totalTextLength = subtitles.length * avgTextLength

        switch (format) {
          case 'srt':
            return totalTextLength * 1.8 // Include timestamps and formatting
          case 'vtt':
            return totalTextLength * 2.0 // Include metadata and styling
          case 'ass':
            return totalTextLength * 2.5 // Include style definitions
          case 'json':
            return totalTextLength * 3.0 // Include metadata and structure
          default:
            return totalTextLength * 1.8
        }
      },

      formatFileSize: (bytes: number): string => {
        if (bytes === 0) return '0 B'
        
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
      },

      // Error handling
      setError: (error: string | null) => {
        set({ lastError: error })
      },

      clearError: () => {
        set({ lastError: null })
      }
    })),
    {
      name: 'export-storage',
      partialize: (state) => ({
        settings: state.settings,
        history: state.history
      })
    }
  )
)

// Auto-generate preview when subtitles change
useSubtitleEditStore.subscribe(
  (state) => state.session?.currentSubtitles,
  () => {
    const exportStore = useExportStore.getState()
    if (exportStore.settings.selectedFormat) {
      setTimeout(() => exportStore.generatePreview(), 100)
    }
  }
)