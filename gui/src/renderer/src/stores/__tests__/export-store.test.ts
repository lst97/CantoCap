/**
 * Tests for export store functionality
 */

import { act, renderHook } from '@testing-library/react'
import { useExportStore } from '../export-store'
import { useSubtitleEditStore } from '../subtitle-edit-store'
import { useWorkflowStore } from '../workflow-store'
import type { SubtitleEntry } from '../../types/subtitle'

// Mock dependencies
jest.mock('../subtitle-edit-store', () => ({
  useSubtitleEditStore: {
    getState: jest.fn(),
    subscribe: jest.fn()
  }
}))

jest.mock('../workflow-store', () => ({
  useWorkflowStore: {
    getState: jest.fn()
  }
}))

// Mock Electron API
const mockSaveFileDialog = jest.fn()
const mockWriteExportFile = jest.fn()

global.window = {
  ...global.window,
  cantocapAPI: {
    saveFileDialog: mockSaveFileDialog,
    writeExportFile: mockWriteExportFile
  }
} as any

// Mock subtitle data
const mockSubtitles: SubtitleEntry[] = [
  {
    id: 'sub_1',
    index: 0,
    startTime: 0.5,
    endTime: 2.5,
    duration: 2.0,
    text: '你好世界',
    translation: 'Hello World',
    confidence: 95
  },
  {
    id: 'sub_2',
    index: 1,
    startTime: 3.0,
    endTime: 5.5,
    duration: 2.5,
    text: '這是測試',
    translation: 'This is a test',
    confidence: 88
  }
]

const mockSubtitleEditState = {
  session: {
    currentSubtitles: mockSubtitles
  }
}

const mockWorkflowState = {
  completeStep: jest.fn()
}

describe('Export Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSubtitleEditStore.getState as jest.Mock).mockReturnValue(mockSubtitleEditState)
    ;(useWorkflowStore.getState as jest.Mock).mockReturnValue(mockWorkflowState)
    mockSaveFileDialog.mockResolvedValue({ canceled: false, filePath: '/test/subtitles.srt' })
    mockWriteExportFile.mockResolvedValue(undefined)
  })

  describe('Initial State', () => {
    it('should have correct default settings', () => {
      const { result } = renderHook(() => useExportStore())
      
      expect(result.current.settings).toEqual({
        selectedFormat: 'srt',
        includeCantonese: true,
        includeEnglish: true,
        includeConfidenceScores: false,
        includeTimestampMetadata: false
      })
    })

    it('should have all supported formats', () => {
      const { result } = renderHook(() => useExportStore())
      
      expect(result.current.formats).toHaveLength(4)
      expect(result.current.formats.map(f => f.id)).toEqual(['srt', 'vtt', 'ass', 'json'])
    })

    it('should have empty history initially', () => {
      const { result } = renderHook(() => useExportStore())
      
      expect(result.current.history).toEqual([])
    })

    it('should have idle progress state initially', () => {
      const { result } = renderHook(() => useExportStore())
      
      expect(result.current.progress).toEqual({
        isExporting: false,
        progress: 0,
        stage: 'idle',
        message: 'Ready to export',
        error: null,
        canCancel: false
      })
    })
  })

  describe('Settings Management', () => {
    it('should update settings correctly', () => {
      const { result } = renderHook(() => useExportStore())
      
      act(() => {
        result.current.updateSettings({
          selectedFormat: 'vtt',
          includeConfidenceScores: true
        })
      })
      
      expect(result.current.settings.selectedFormat).toBe('vtt')
      expect(result.current.settings.includeConfidenceScores).toBe(true)
      expect(result.current.settings.includeCantonese).toBe(true) // Should preserve existing
    })

    it('should reset settings to defaults', () => {
      const { result } = renderHook(() => useExportStore())
      
      // First change settings
      act(() => {
        result.current.updateSettings({
          selectedFormat: 'ass',
          includeConfidenceScores: true,
          includeTimestampMetadata: true
        })
      })
      
      // Then reset
      act(() => {
        result.current.resetSettings()
      })
      
      expect(result.current.settings).toEqual({
        selectedFormat: 'srt',
        includeCantonese: true,
        includeEnglish: true,
        includeConfidenceScores: false,
        includeTimestampMetadata: false
      })
    })
  })

  describe('Export Operations', () => {
    it('should export subtitles successfully', async () => {
      const { result } = renderHook(() => useExportStore())
      
      await act(async () => {
        await result.current.exportSubtitles('/test/output.srt')
      })
      
      expect(mockWriteExportFile).toHaveBeenCalledWith('/test/output.srt', expect.any(String))
      expect(result.current.progress.stage).toBe('completed')
      expect(result.current.history).toHaveLength(1)
      expect(mockWorkflowState.completeStep).toHaveBeenCalledWith('export')
    })

    it('should show file dialog when no output path provided', async () => {
      const { result } = renderHook(() => useExportStore())
      
      await act(async () => {
        await result.current.exportSubtitles()
      })
      
      expect(mockSaveFileDialog).toHaveBeenCalledWith({
        defaultPath: 'subtitles.srt',
        filters: [
          { name: 'SubRip (SRT)', extensions: ['srt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
    })

    it('should handle file dialog cancellation', async () => {
      mockSaveFileDialog.mockResolvedValue({ canceled: true })
      const { result } = renderHook(() => useExportStore())
      
      await act(async () => {
        await result.current.exportSubtitles()
      })
      
      expect(mockWriteExportFile).not.toHaveBeenCalled()
      expect(result.current.progress.stage).toBe('cancelled')
    })

    it('should handle export errors', async () => {
      mockWriteExportFile.mockRejectedValue(new Error('Write failed'))
      const { result } = renderHook(() => useExportStore())
      
      await act(async () => {
        await result.current.exportSubtitles('/test/output.srt')
      })
      
      expect(result.current.progress.error).toBe('Write failed')
      expect(result.current.lastError).toBe('Write failed')
    })

    it('should handle no subtitles available', async () => {
      ;(useSubtitleEditStore.getState as jest.Mock).mockReturnValue({
        session: { currentSubtitles: [] }
      })
      
      const { result } = renderHook(() => useExportStore())
      
      await act(async () => {
        await result.current.exportSubtitles('/test/output.srt')
      })
      
      expect(mockWriteExportFile).not.toHaveBeenCalled()
      expect(result.current.lastError).toBe('No subtitles available for export')
    })

    it('should export multiple formats', async () => {
      const { result } = renderHook(() => useExportStore())
      
      await act(async () => {
        await result.current.exportMultipleFormats(['srt', 'vtt'], '/test/subtitles')
      })
      
      expect(mockWriteExportFile).toHaveBeenCalledTimes(2)
      expect(mockWriteExportFile).toHaveBeenCalledWith('/test/subtitles.srt', expect.any(String))
      expect(mockWriteExportFile).toHaveBeenCalledWith('/test/subtitles.vtt', expect.any(String))
      expect(result.current.history).toHaveLength(2)
    })

    it('should cancel export', () => {
      const { result } = renderHook(() => useExportStore())
      
      act(() => {
        result.current.cancelExport()
      })
      
      expect(result.current.progress.stage).toBe('cancelled')
      expect(result.current.progress.message).toBe('Export cancelled')
    })
  })

  describe('Preview Management', () => {
    it('should generate preview correctly', () => {
      const { result } = renderHook(() => useExportStore())
      
      act(() => {
        result.current.generatePreview()
      })
      
      expect(result.current.preview).toEqual({
        content: expect.any(String),
        estimatedSize: expect.any(Number),
        subtitleCount: 2,
        format: expect.objectContaining({
          id: 'srt',
          name: 'SubRip (SRT)'
        })
      })
    })

    it('should clear preview', () => {
      const { result } = renderHook(() => useExportStore())
      
      // First generate a preview
      act(() => {
        result.current.generatePreview()
      })
      
      expect(result.current.preview).not.toBeNull()
      
      // Then clear it
      act(() => {
        result.current.clearPreview()
      })
      
      expect(result.current.preview).toBeNull()
    })

    it('should return null preview for empty subtitles', () => {
      ;(useSubtitleEditStore.getState as jest.Mock).mockReturnValue({
        session: { currentSubtitles: [] }
      })
      
      const { result } = renderHook(() => useExportStore())
      
      act(() => {
        result.current.generatePreview()
      })
      
      expect(result.current.preview).toBeNull()
    })
  })

  describe('History Management', () => {
    it('should add item to history', () => {
      const { result } = renderHook(() => useExportStore())
      
      const historyItem = {
        fileName: 'test.srt',
        filePath: '/test/test.srt',
        format: 'SubRip (SRT)',
        timestamp: Date.now(),
        size: 1024,
        settings: result.current.settings,
        subtitleCount: 2
      }
      
      act(() => {
        result.current.addToHistory(historyItem)
      })
      
      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0]).toEqual(expect.objectContaining({
        ...historyItem,
        id: expect.any(String)
      }))
    })

    it('should remove item from history', () => {
      const { result } = renderHook(() => useExportStore())
      
      const historyItem = {
        fileName: 'test.srt',
        filePath: '/test/test.srt',
        format: 'SubRip (SRT)',
        timestamp: Date.now(),
        size: 1024,
        settings: result.current.settings,
        subtitleCount: 2
      }
      
      act(() => {
        result.current.addToHistory(historyItem)
      })
      
      const itemId = result.current.history[0].id
      
      act(() => {
        result.current.removeFromHistory(itemId)
      })
      
      expect(result.current.history).toHaveLength(0)
    })

    it('should clear all history', () => {
      const { result } = renderHook(() => useExportStore())
      
      // Add multiple items
      act(() => {
        result.current.addToHistory({
          fileName: 'test1.srt',
          filePath: '/test/test1.srt',
          format: 'SubRip (SRT)',
          timestamp: Date.now(),
          size: 1024,
          settings: result.current.settings,
          subtitleCount: 2
        })
        result.current.addToHistory({
          fileName: 'test2.vtt',
          filePath: '/test/test2.vtt',
          format: 'WebVTT (VTT)',
          timestamp: Date.now(),
          size: 2048,
          settings: result.current.settings,
          subtitleCount: 2
        })
      })
      
      expect(result.current.history).toHaveLength(2)
      
      act(() => {
        result.current.clearHistory()
      })
      
      expect(result.current.history).toHaveLength(0)
    })

    it('should limit history to 20 items', () => {
      const { result } = renderHook(() => useExportStore())
      
      // Add 25 items
      act(() => {
        for (let i = 0; i < 25; i++) {
          result.current.addToHistory({
            fileName: `test${i}.srt`,
            filePath: `/test/test${i}.srt`,
            format: 'SubRip (SRT)',
            timestamp: Date.now() + i,
            size: 1024,
            settings: result.current.settings,
            subtitleCount: 2
          })
        }
      })
      
      expect(result.current.history).toHaveLength(20)
    })
  })

  describe('Utility Functions', () => {
    it('should get subtitle data correctly', () => {
      const { result } = renderHook(() => useExportStore())
      
      const subtitles = result.current.getSubtitleData()
      
      expect(subtitles).toEqual(mockSubtitles)
    })

    it('should estimate file size correctly', () => {
      const { result } = renderHook(() => useExportStore())
      
      const srtSize = result.current.estimateFileSize('srt', mockSubtitles)
      const vttSize = result.current.estimateFileSize('vtt', mockSubtitles)
      const assSize = result.current.estimateFileSize('ass', mockSubtitles)
      const jsonSize = result.current.estimateFileSize('json', mockSubtitles)
      
      expect(srtSize).toBeGreaterThan(0)
      expect(vttSize).toBeGreaterThan(srtSize)
      expect(assSize).toBeGreaterThan(vttSize)
      expect(jsonSize).toBeGreaterThan(assSize)
    })

    it('should format file size correctly', () => {
      const { result } = renderHook(() => useExportStore())
      
      expect(result.current.formatFileSize(0)).toBe('0 B')
      expect(result.current.formatFileSize(1024)).toBe('1.0 KB')
      expect(result.current.formatFileSize(1048576)).toBe('1.0 MB')
      expect(result.current.formatFileSize(1073741824)).toBe('1.0 GB')
    })

    it('should format file size with proper precision', () => {
      const { result } = renderHook(() => useExportStore())
      
      expect(result.current.formatFileSize(1536)).toBe('1.5 KB')
      expect(result.current.formatFileSize(2621440)).toBe('2.5 MB')
    })
  })

  describe('Error Handling', () => {
    it('should set and clear errors', () => {
      const { result } = renderHook(() => useExportStore())
      
      act(() => {
        result.current.setError('Test error')
      })
      
      expect(result.current.lastError).toBe('Test error')
      
      act(() => {
        result.current.clearError()
      })
      
      expect(result.current.lastError).toBeNull()
    })
  })

  describe('Progress Updates', () => {
    it('should update progress during export', async () => {
      const { result } = renderHook(() => useExportStore())
      
      const exportPromise = act(async () => {
        await result.current.exportSubtitles('/test/output.srt')
      })
      
      // During export, progress should be updating
      expect(result.current.progress.isExporting).toBe(true)
      
      await exportPromise
      
      // After export, should be completed
      expect(result.current.progress.stage).toBe('completed')
    })
  })
})