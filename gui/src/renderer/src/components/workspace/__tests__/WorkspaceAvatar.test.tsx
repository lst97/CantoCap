/**
 * Phase 1 MVP: WorkspaceAvatar Component Tests
 * Unit tests for workspace avatar component functionality
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import theme from '../../../theme/theme'
import { WorkspaceAvatar } from '../WorkspaceAvatar'
import { mockWorkspaces, createMockWorkspace } from './test-utils'

// Test wrapper with theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
)

describe('WorkspaceAvatar', () => {
  const defaultProps = {
    workspace: mockWorkspaces[0],
    onClick: jest.fn(),
    onContextMenu: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Display Content', () => {
    it('displays emoji when provided', () => {
      const workspace = createMockWorkspace({ emoji: '🎬', name: 'Movie Project' })
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={workspace} />
        </TestWrapper>
      )
      
      expect(screen.getByText('🎬')).toBeInTheDocument()
    })

    it('displays first character when no emoji', () => {
      const workspace = createMockWorkspace({ emoji: undefined, name: 'Movie Project' })
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={workspace} />
        </TestWrapper>
      )
      
      expect(screen.getByText('M')).toBeInTheDocument()
    })

    it('displays fallback character when no name or emoji', () => {
      const workspace = createMockWorkspace({ emoji: undefined, name: '' })
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={workspace} />
        </TestWrapper>
      )
      
      expect(screen.getByText('粵')).toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} size="small" />
        </TestWrapper>
      )
      
      const avatar = screen.getByRole('img')
      expect(avatar).toHaveStyle({
        width: '40px',
        height: '40px'
      })
    })

    it('renders medium size correctly (default)', () => {
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} size="medium" />
        </TestWrapper>
      )
      
      const avatar = screen.getByRole('img')
      expect(avatar).toHaveStyle({
        width: '52px',
        height: '52px'
      })
    })

    it('renders large size correctly', () => {
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} size="large" />
        </TestWrapper>
      )
      
      const avatar = screen.getByRole('img')
      expect(avatar).toHaveStyle({
        width: '64px',
        height: '64px'
      })
    })
  })

  describe('Active State', () => {
    it('shows active indicator when isActive is true', () => {
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} isActive={true} />
        </TestWrapper>
      )
      
      // Check for active indicator dot (positioned absolutely)
      const activeIndicator = screen.getByRole('img').parentElement?.querySelector('[style*="position: absolute"]')
      expect(activeIndicator).toBeInTheDocument()
    })

    it('does not show active indicator when isActive is false', () => {
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} isActive={false} />
        </TestWrapper>
      )
      
      const activeIndicator = screen.getByRole('img').parentElement?.querySelector('[style*="position: absolute"]')
      expect(activeIndicator).not.toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls onClick when avatar is clicked', () => {
      const onClick = jest.fn()
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} onClick={onClick} />
        </TestWrapper>
      )
      
      fireEvent.click(screen.getByRole('img'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('calls onContextMenu when right-clicked', () => {
      const onContextMenu = jest.fn()
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} onContextMenu={onContextMenu} />
        </TestWrapper>
      )
      
      fireEvent.contextMenu(screen.getByRole('img'))
      expect(onContextMenu).toHaveBeenCalledTimes(1)
    })
  })

  describe('Tooltip', () => {
    it('shows workspace name in tooltip', async () => {
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={defaultProps.workspace} />
        </TestWrapper>
      )
      
      fireEvent.mouseEnter(screen.getByRole('img'))
      expect(await screen.findByText(defaultProps.workspace.name)).toBeInTheDocument()
    })
  })

  describe('Color Generation', () => {
    it('uses workspace color when provided', () => {
      const workspace = createMockWorkspace({ color: '#FF5733' })
      render(
        <TestWrapper>
          <WorkspaceAvatar workspace={workspace} />
        </TestWrapper>
      )
      
      const avatar = screen.getByRole('img')
      expect(avatar).toHaveStyle({
        backgroundColor: '#FF5733'
      })
    })

    it('generates consistent color from workspace ID when no color provided', () => {
      const workspace1 = createMockWorkspace({ id: 'test-id-1', color: undefined })
      const workspace2 = createMockWorkspace({ id: 'test-id-1', color: undefined })
      
      const { rerender } = render(
        <TestWrapper>
          <WorkspaceAvatar workspace={workspace1} />
        </TestWrapper>
      )
      
      const avatar1Style = screen.getByRole('img').style.backgroundColor
      
      rerender(
        <TestWrapper>
          <WorkspaceAvatar workspace={workspace2} />
        </TestWrapper>
      )
      
      const avatar2Style = screen.getByRole('img').style.backgroundColor
      expect(avatar1Style).toBe(avatar2Style)
    })
  })
})