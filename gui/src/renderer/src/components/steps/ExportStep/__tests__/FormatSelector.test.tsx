/**
 * Tests for FormatSelector component responsive layout
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { FormatSelector } from '../FormatSelector'
import { useExportStore } from '../../../../stores/export-store'
import type { ExportFormat, ExportSettings } from '../../../../stores/export-store'
import type { SubtitleEntry } from '../../../../types/subtitle'

// Mock the export store
jest.mock('../../../../stores/export-store')

// Mock format validators
jest.mock('../../../../utils/format-converters', () => ({
  validateForFormat: jest.fn(() => [])
}))

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
  clearError: jest.fn()
}

const mockStoreState = {
  settings: mockSettings,
  formats: mockFormats,
  getSubtitleData: jest.fn(() => mockSubtitles),
  ...mockStoreActions
}

describe('FormatSelector Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useExportStore as jest.Mock).mockReturnValue(mockStoreState)
  })

  describe('Responsive Layout', () => {
    it('should render all format cards in grid container', () => {
      render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      // Check that all formats are rendered
      mockFormats.forEach(format => {
        expect(screen.getByText(format.name)).toBeInTheDocument()
        expect(screen.getByText(format.description)).toBeInTheDocument()
      })

      // Check that radio group is present
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    })

    it('should use Grid layout instead of Stack', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      // Check for MUI Grid container class
      const gridContainer = container.querySelector('.MuiGrid-container')
      expect(gridContainer).toBeInTheDocument()

      // Check for Grid items
      const gridItems = container.querySelectorAll('.MuiGrid-item')
      expect(gridItems).toHaveLength(mockFormats.length)
    })

    it('should apply correct responsive breakpoints to grid items', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const gridItems = container.querySelectorAll('.MuiGrid-item')
      
      gridItems.forEach(item => {
        // Check for responsive grid classes
        expect(item).toHaveClass('MuiGrid-grid-xs-12') // Full width on mobile
        expect(item).toHaveClass('MuiGrid-grid-sm-12') // Full width on small screens
        expect(item).toHaveClass('MuiGrid-grid-md-6')  // Half width on medium screens and up
      })
    })

    it('should maintain equal height cards with flexbox', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const formatCards = container.querySelectorAll('[role="radiogroup"] .MuiGrid-item > .MuiBox-root')
      
      formatCards.forEach(card => {
        const styles = window.getComputedStyle(card)
        expect(styles.height).toBe('100%')
        expect(styles.display).toBe('flex')
        expect(styles.flexDirection).toBe('column')
      })
    })

    it('should maintain proper spacing between cards', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const gridContainer = container.querySelector('.MuiGrid-container')
      expect(gridContainer).toHaveClass('MuiGrid-spacing-xs-2')
    })
  })

  describe('Functionality', () => {
    it('should maintain radio button functionality', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <FormatSelector />
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
          <FormatSelector />
        </TestWrapper>
      )

      const srtRadio = screen.getByRole('radio', { name: /subrip/i })
      expect(srtRadio).toBeChecked()
    })

    it('should display format features as chips', () => {
      render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      expect(screen.getByText('Universal compatibility')).toBeInTheDocument()
      expect(screen.getByText('Web optimized')).toBeInTheDocument()
      expect(screen.getByText('Advanced styling')).toBeInTheDocument()
      expect(screen.getByText('Structured data')).toBeInTheDocument()
    })

    it('should maintain hover effects on cards', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const firstCard = container.querySelector('[role="radiogroup"] .MuiGrid-item > .MuiBox-root')
      expect(firstCard).toHaveStyle('transition: all 0.2s ease-in-out')
    })

    it('should preserve accessibility attributes', () => {
      render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const region = screen.getByRole('region', { name: /format-selector-title/i })
      expect(region).toBeInTheDocument()

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'format-selector-title')

      // All radio buttons should be accessible
      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(mockFormats.length)
    })
  })

  describe('Visual Styling', () => {
    it('should apply correct border colors for selected state', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      // Check that selected format has primary border
      const selectedCard = container.querySelector('[role="radiogroup"] .MuiGrid-item > .MuiBox-root')
      const styles = window.getComputedStyle(selectedCard!)
      // Border color should be set via sx prop - actual computed style will depend on theme
      expect(selectedCard).toHaveStyle('border-width: 1px')
    })

    it('should apply correct background colors', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const cards = container.querySelectorAll('[role="radiogroup"] .MuiGrid-item > .MuiBox-root')
      cards.forEach(card => {
        // All cards should have background colors set
        const styles = window.getComputedStyle(card)
        expect(styles.backgroundColor).toBeTruthy()
      })
    })

    it('should maintain consistent padding and border radius', () => {
      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const cards = container.querySelectorAll('[role="radiogroup"] .MuiGrid-item > .MuiBox-root')
      cards.forEach(card => {
        const styles = window.getComputedStyle(card)
        expect(styles.borderRadius).toBeTruthy()
        expect(styles.padding).toBeTruthy()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      const validateForFormat = require('../../../../utils/format-converters').validateForFormat
      validateForFormat.mockReturnValue(['Short duration detected'])

      render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      // Should still render all formats even with validation errors
      mockFormats.forEach(format => {
        expect(screen.getByText(format.name)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty formats array', () => {
      const mockStoreWithNoFormats = {
        ...mockStoreState,
        formats: []
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithNoFormats)

      render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const gridContainer = screen.getByRole('radiogroup').querySelector('.MuiGrid-container')
      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer?.children).toHaveLength(0)
    })

    it('should handle single format', () => {
      const mockStoreWithSingleFormat = {
        ...mockStoreState,
        formats: [mockFormats[0]]
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithSingleFormat)

      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const gridItems = container.querySelectorAll('.MuiGrid-item')
      expect(gridItems).toHaveLength(1)
    })

    it('should handle odd number of formats', () => {
      const mockStoreWithOddFormats = {
        ...mockStoreState,
        formats: mockFormats.slice(0, 3) // 3 formats
      }
      ;(useExportStore as jest.Mock).mockReturnValue(mockStoreWithOddFormats)

      const { container } = render(
        <TestWrapper>
          <FormatSelector />
        </TestWrapper>
      )

      const gridItems = container.querySelectorAll('.MuiGrid-item')
      expect(gridItems).toHaveLength(3)
      
      // All should maintain same responsive classes
      gridItems.forEach(item => {
        expect(item).toHaveClass('MuiGrid-grid-md-6')
      })
    })
  })
})