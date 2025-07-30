/**
 * Tests for ExportStep component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ExportStep } from '../ExportStep'
import { useExportStore } from '../../../stores/export-store'
import type { ExportFormat, ExportSettings, ExportProgress, ExportPreview, ExportHistoryItem } from '../../../stores/export-store'
import type { SubtitleEntry } from '../../../types/subtitle'

// Mock the export store
jest.mock('../../../stores/export-store')

// Mock MUI theme
const theme = createTheme()

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
)

// Mock data
const mockFormats: ExportFormat[] = [
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

const mockSettings: ExportSettings = {
  selectedFormat: 'srt',
  includeCantonese: true,
  includeEnglish: true,
  includeConfidenceScores: false,
  includeTimestampMetadata: false
}

const mockProgress: ExportProgress = {
  isExporting: false,
  progress: 0,
  stage: 'idle',
  message: 'Ready to export',
  error: null,
  canCancel: false
}

const mockPreview: ExportPreview = {
  content: '1\n00:00:00,500 --> 00:00:02,500\n你好世界\n\n2\n00:00:03,000 --> 00:00:05,500\n這是測試',
  estimatedSize: 1024,
  subtitleCount: 2,
  format: mockFormats[0]
}

const mockHistory: ExportHistoryItem[] = [
  {
    id: 'history_1',
    fileName: 'test.srt',
    filePath: '/test/test.srt',
    format: 'SubRip (SRT)',
    timestamp: Date.now() - 3600000, // 1 hour ago
    size: 1024,
    settings: mockSettings,
    subtitleCount: 2
  }
]

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

// Mock store implementation
const mockStoreActions = {
  updateSettings: jest.fn(),
  resetSettings: jest.fn(),
  exportSubtitles: jest.fn(),
  exportMultipleFormats: jest.fn(),
  cancelExport: jest.fn(),
  generatePreview: jest.fn(),
  clearPreview: jest.fn(),
  addToHistory: jest.fn(),
  removeFromHistory: jest.fn(),
  clearHistory: jest.fn(),
  getSubtitleData: jest.fn(() => mockSubtitles),
  estimateFileSize: jest.fn(() => 1024),
  formatFileSize: jest.fn((bytes: number) => `${Math.round(bytes / 1024)} KB`),
  setError: jest.fn(),
  clearError: jest.fn()
}

const mockStoreState = {
  settings: mockSettings,
  progress: mockProgress,
  history: mockHistory,
  preview: mockPreview,
  formats: mockFormats,
  lastError: null,
  ...mockStoreActions
}

describe('ExportStep Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useExportStore as jest.Mock).mockReturnValue(mockStoreState)
  })

  describe('Rendering', () => {
    it('should render main sections', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByText('Export Configuration')).toBeInTheDocument()
      expect(screen.getByText('Export Format')).toBeInTheDocument()
      expect(screen.getByText('Language Options')).toBeInTheDocument()
      expect(screen.getByText('Export Actions')).toBeInTheDocument()
      expect(screen.getByText('Export Preview')).toBeInTheDocument()
      expect(screen.getByText('Export History')).toBeInTheDocument()
    })

    it('should render all supported formats', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      mockFormats.forEach(format => {
        expect(screen.getByText(format.name)).toBeInTheDocument()
        expect(screen.getByText(format.description)).toBeInTheDocument()
      })
    })

    it('should show format features as chips', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('Universal compatibility')).toBeInTheDocument()
      expect(screen.getByText('Web optimized')).toBeInTheDocument()
      expect(screen.getByText('Advanced styling')).toBeInTheDocument()
      expect(screen.getByText('Structured data')).toBeInTheDocument()
    })
  })

  describe('Format Selection', () => {
    it('should allow format selection', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const vttRadio = screen.getByRole('radio', { name: /webvtt/i })
      await user.click(vttRadio)

      expect(mockStoreActions.updateSettings).toHaveBeenCalledWith({
        selectedFormat: 'vtt'
      })
    })

    it('should show selected format as checked', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const srtRadio = screen.getByRole('radio', { name: /subrip/i })
      expect(srtRadio).toBeChecked()
    })

    it('should show format validation warnings', () => {
      const mockStoreWithValidation = {
        ...mockStoreState,
        getSubtitleData: jest.fn(() => [
          {
            id: 'sub_1',
            index: 0,
            startTime: 0.5,
            endTime: 0.8, // Short duration
            duration: 0.3,
            text: 'Short subtitle'
          }
        ])
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithValidation)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      // Should show warning icon for formats with validation issues
      const warningIcons = screen.getAllByTestId('WarningIcon')
      expect(warningIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Language Options', () => {
    it('should render language option checkboxes', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByRole('checkbox', { name: /include cantonese text/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /include english translation/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /include confidence scores/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /include timestamp metadata/i })).toBeInTheDocument()
    })

    it('should show subtitle statistics', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('2 of 2 subtitles available')).toBeInTheDocument() // Cantonese
      expect(screen.getByText('2 of 2 subtitles available')).toBeInTheDocument() // English
      expect(screen.getByText('2 of 2 subtitles have confidence data')).toBeInTheDocument()
    })

    it('should update settings when checkboxes are toggled', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const confidenceCheckbox = screen.getByRole('checkbox', { name: /include confidence scores/i })
      await user.click(confidenceCheckbox)

      expect(mockStoreActions.updateSettings).toHaveBeenCalledWith({
        includeConfidenceScores: true
      })
    })

    it('should reflect current settings in checkboxes', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByRole('checkbox', { name: /include cantonese text/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /include english translation/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /include confidence scores/i })).not.toBeChecked()
      expect(screen.getByRole('checkbox', { name: /include timestamp metadata/i })).not.toBeChecked()
    })
  })

  describe('Export Actions', () => {
    it('should render main export button', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const exportButton = screen.getByRole('button', { name: /export subtitles/i })
      expect(exportButton).toBeInTheDocument()
      expect(exportButton).toBeEnabled()
    })

    it('should disable export button when no subtitles available', () => {
      const mockStoreWithNoSubtitles = {
        ...mockStoreState,
        getSubtitleData: jest.fn(() => [])
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithNoSubtitles)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const exportButton = screen.getByRole('button', { name: /export subtitles/i })
      expect(exportButton).toBeDisabled()
    })

    it('should call export function when export button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const exportButton = screen.getByRole('button', { name: /export subtitles/i })
      await user.click(exportButton)

      expect(mockStoreActions.exportSubtitles).toHaveBeenCalled()
    })

    it('should show progress during export', () => {
      const mockStoreWithProgress = {
        ...mockStoreState,
        progress: {
          ...mockProgress,
          isExporting: true,
          progress: 50,
          stage: 'converting',
          message: 'Converting subtitles...'
        }
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithProgress)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('Converting subtitles...')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByText('Stage: converting')).toBeInTheDocument()
    })

    it('should show cancel button during export', () => {
      const mockStoreWithProgress = {
        ...mockStoreState,
        progress: {
          ...mockProgress,
          isExporting: true,
          canCancel: true
        }
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithProgress)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByRole('button', { name: /cancel export/i })).toBeInTheDocument()
    })

    it('should show error message when export fails', () => {
      const mockStoreWithError = {
        ...mockStoreState,
        lastError: 'Export failed: File not found'
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithError)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('Export Error')).toBeInTheDocument()
      expect(screen.getByText('Export failed: File not found')).toBeInTheDocument()
    })

    it('should handle preview button click', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const previewButton = screen.getByRole('button', { name: /preview export/i })
      await user.click(previewButton)

      expect(mockStoreActions.generatePreview).toHaveBeenCalled()
    })

    it('should handle multi-format export dialog', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const multiFormatButton = screen.getByRole('button', { name: /export multiple formats/i })
      await user.click(multiFormatButton)

      expect(screen.getByText('Export Multiple Formats')).toBeInTheDocument()
      
      // Should show format checkboxes
      mockFormats.forEach(format => {
        expect(screen.getByRole('checkbox', { name: new RegExp(format.name, 'i') })).toBeInTheDocument()
      })
    })
  })

  describe('Export Preview', () => {
    it('should render preview content', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('Export Preview')).toBeInTheDocument()
      expect(screen.getByText(mockPreview.content)).toBeInTheDocument()
      expect(screen.getByText('SubRip (SRT)')).toBeInTheDocument()
      expect(screen.getByText('1 KB')).toBeInTheDocument()
      expect(screen.getByText('2 entries')).toBeInTheDocument()
    })

    it('should show empty state when no preview available', () => {
      const mockStoreWithoutPreview = {
        ...mockStoreState,
        preview: null
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithoutPreview)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('Select a format and configure options to see preview')).toBeInTheDocument()
    })

    it('should handle copy to clipboard', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
      Object.assign(navigator, { clipboard: mockClipboard })

      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
      await user.click(copyButton)

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockPreview.content)
    })

    it('should open fullscreen preview dialog', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const fullscreenButton = screen.getByRole('button', { name: /view fullscreen/i })
      await user.click(fullscreenButton)

      expect(screen.getByText('Preview - SubRip (SRT)')).toBeInTheDocument()
    })
  })

  describe('Export History', () => {
    it('should render history items', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('Export History')).toBeInTheDocument()
      expect(screen.getByText('test.srt')).toBeInTheDocument()
      expect(screen.getByText('SubRip (SRT)')).toBeInTheDocument()
      expect(screen.getByText(/1 KB •/)).toBeInTheDocument()
    })

    it('should show empty state when no history available', () => {
      const mockStoreWithoutHistory = {
        ...mockStoreState,
        history: []
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithoutHistory)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText('No exports yet. Your export history will appear here.')).toBeInTheDocument()
    })

    it('should handle history item menu', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const menuButton = screen.getByRole('button', { name: /options for test.srt/i })
      await user.click(menuButton)

      expect(screen.getByText('Open File')).toBeInTheDocument()
      expect(screen.getByText('Remove from History')).toBeInTheDocument()
    })

    it('should handle clear history', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const clearButton = screen.getByRole('button', { name: /clear all history/i })
      await user.click(clearButton)

      expect(mockStoreActions.clearHistory).toHaveBeenCalled()
    })

    it('should format relative timestamps correctly', () => {
      const recentHistory = [
        {
          ...mockHistory[0],
          timestamp: Date.now() - 60000 // 1 minute ago
        }
      ]
      const mockStoreWithRecentHistory = {
        ...mockStoreState,
        history: recentHistory
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithRecentHistory)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByText(/1 min ago/)).toBeInTheDocument()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+E for export', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      fireEvent.keyDown(window, { key: 'e', ctrlKey: true })

      expect(mockStoreActions.exportSubtitles).toHaveBeenCalled()
    })

    it('should handle Ctrl+P for preview', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      fireEvent.keyDown(window, { key: 'p', ctrlKey: true })

      expect(mockStoreActions.generatePreview).toHaveBeenCalled()
    })

    it('should handle Cmd+E on Mac', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      fireEvent.keyDown(window, { key: 'e', metaKey: true })

      expect(mockStoreActions.exportSubtitles).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-labelledby', 'export-step-title')
      expect(screen.getByRole('region', { name: /export format/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /language options/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /export actions/i })).toBeInTheDocument()
    })

    it('should have proper form labels', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'format-selector-title')

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('aria-describedby')
      })
    })

    it('should have descriptive button labels', () => {
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      expect(screen.getByRole('button', { name: /export subtitles \(ctrl\+e\)/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /generate preview \(ctrl\+p\)/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      // Tab through interactive elements
      await user.tab()
      expect(screen.getAllByRole('radio')[0]).toHaveFocus()

      await user.tab()
      expect(screen.getAllByRole('checkbox')[0]).toHaveFocus()
    })

    it('should announce progress to screen readers', () => {
      const mockStoreWithProgress = {
        ...mockStoreState,
        progress: {
          ...mockProgress,
          isExporting: true,
          progress: 75
        }
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithProgress)

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', 'Export progress: 75%')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('(max-width: 899.95px)'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      // Mobile layout should stack vertically
      const mainBox = screen.getByRole('main')
      expect(mainBox).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle clipboard API errors gracefully', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockRejectedValue(new Error('Clipboard access denied'))
      }
      Object.assign(navigator, { clipboard: mockClipboard })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
      await user.click(copyButton)

      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('should handle export errors gracefully', async () => {
      const mockStoreWithErrorHandler = {
        ...mockStoreState,
        exportSubtitles: jest.fn().mockRejectedValue(new Error('Export failed'))
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithErrorHandler)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ExportStep />
        </TestWrapper>
      )

      const exportButton = screen.getByRole('button', { name: /export subtitles/i })
      await user.click(exportButton)

      expect(consoleSpy).toHaveBeenCalledWith('Export failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })
})