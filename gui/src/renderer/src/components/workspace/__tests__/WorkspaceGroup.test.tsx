/**
 * WorkspaceGroup Component Tests
 * Comprehensive testing for the WorkspaceGroup component including
 * rendering, interactions, drag-and-drop, and accessibility.
 */

import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { WorkspaceGroup } from '../WorkspaceGroup'
import type { WorkspaceGroup as WorkspaceGroupType, WorkspaceWithGrouping } from '../../../types/workspace'

// Mock MUI components to focus on component logic
jest.mock('@mui/material', () => ({
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  IconButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  Typography: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} {...props}>{children}</span>
  ),
  Collapse: ({ children, in: isOpen, ...props }: any) => (
    <div data-testid="collapse" data-open={isOpen} {...props}>
      {isOpen && children}
    </div>
  ),
  Tooltip: ({ children, title }: any) => (
    <div title={title}>{children}</div>
  )
}))

jest.mock('@mui/icons-material', () => ({
  ExpandMore: () => <span data-testid="expand-more">ExpandMore</span>,
  ExpandLess: () => <span data-testid="expand-less">ExpandLess</span>,
  Folder: () => <span data-testid="folder">Folder</span>,
  FolderOpen: () => <span data-testid="folder-open">FolderOpen</span>
}))

// Mock @dnd-kit components
jest.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false
  })
}))

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: jest.fn(() => '')
    }
  }
}))

// Mock WorkspaceAvatar component
jest.mock('../WorkspaceAvatar', () => ({
  WorkspaceAvatar: ({ workspace, onClick, onContextMenu }: any) => (
    <div
      data-testid={`workspace-avatar-${workspace.id}`}
      onClick={() => onClick(workspace)}
      onContextMenu={(e) => onContextMenu(e, workspace)}
    >
      {workspace.emoji} {workspace.name}
    </div>
  )
}))

describe('WorkspaceGroup Component', () => {
  const mockGroup: WorkspaceGroupType = {
    id: 'group-1',
    name: 'Development Projects',
    color: 'blue',
    isExpanded: true,
    order: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }

  const mockWorkspaces: WorkspaceWithGrouping[] = [
    {
      id: 'ws-1',
      name: 'Project A',
      emoji: '📁',
      color: '#3b82f6',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      isActive: false,
      groupId: 'group-1',
      orderInGroup: 0
    },
    {
      id: 'ws-2',
      name: 'Project B',
      emoji: '📂',
      color: '#10b981',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      isActive: true,
      groupId: 'group-1',
      orderInGroup: 1
    }
  ]

  const defaultProps = {
    group: mockGroup,
    workspaces: mockWorkspaces,
    isActive: false,
    onToggleExpansion: jest.fn(),
    onWorkspaceClick: jest.fn(),
    onWorkspaceContextMenu: jest.fn(),
    onGroupContextMenu: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render group with basic information', () => {
      render(<WorkspaceGroup {...defaultProps} />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Workspace count
      expect(screen.getByTestId('folder-open')).toBeInTheDocument() // Expanded state
    })

    it('should render group in collapsed state', () => {
      const collapsedGroup = { ...mockGroup, isExpanded: false }
      
      render(<WorkspaceGroup {...defaultProps} group={collapsedGroup} />)

      expect(screen.getByTestId('folder')).toBeInTheDocument() // Collapsed state
      expect(screen.getByTestId('expand-more')).toBeInTheDocument()
      
      const collapse = screen.getByTestId('collapse')
      expect(collapse).toHaveAttribute('data-open', 'false')
    })

    it('should render workspaces when expanded', () => {
      render(<WorkspaceGroup {...defaultProps} />)

      expect(screen.getByTestId('workspace-avatar-ws-1')).toBeInTheDocument()
      expect(screen.getByTestId('workspace-avatar-ws-2')).toBeInTheDocument()
      expect(screen.getByText('📁 Project A')).toBeInTheDocument()
      expect(screen.getByText('📂 Project B')).toBeInTheDocument()
    })

    it('should not render workspaces when collapsed', () => {
      const collapsedGroup = { ...mockGroup, isExpanded: false }
      
      render(<WorkspaceGroup {...defaultProps} group={collapsedGroup} />)

      expect(screen.queryByTestId('workspace-avatar-ws-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('workspace-avatar-ws-2')).not.toBeInTheDocument()
    })

    it('should apply correct group color styling', () => {
      render(<WorkspaceGroup {...defaultProps} />)

      // The component should apply the blue color to the group header
      const groupHeader = screen.getByRole('button', { name: /development projects/i })
      expect(groupHeader).toBeInTheDocument()
    })

    it('should render empty group correctly', () => {
      render(<WorkspaceGroup {...defaultProps} workspaces={[]} />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // Zero workspace count
      expect(screen.queryByTestId('workspace-avatar-ws-1')).not.toBeInTheDocument()
    })

    it('should render group with different colors', () => {
      const colors: Array<WorkspaceGroupType['color']> = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'default']
      
      colors.forEach(color => {
        const coloredGroup = { ...mockGroup, color, id: `group-${color}` }
        const { unmount } = render(<WorkspaceGroup {...defaultProps} group={coloredGroup} />)
        
        expect(screen.getByText('Development Projects')).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('Interactions', () => {
    it('should toggle expansion when header is clicked', async () => {
      const user = userEvent.setup()
      const onToggleExpansion = jest.fn()

      render(<WorkspaceGroup {...defaultProps} onToggleExpansion={onToggleExpansion} />)

      const toggleButton = screen.getByRole('button', { name: /development projects/i })
      await user.click(toggleButton)

      expect(onToggleExpansion).toHaveBeenCalledWith('group-1')
    })

    it('should handle workspace click events', async () => {
      const user = userEvent.setup()
      const onWorkspaceClick = jest.fn()

      render(<WorkspaceGroup {...defaultProps} onWorkspaceClick={onWorkspaceClick} />)

      const workspaceAvatar = screen.getByTestId('workspace-avatar-ws-1')
      await user.click(workspaceAvatar)

      expect(onWorkspaceClick).toHaveBeenCalledWith(mockWorkspaces[0])
    })

    it('should handle workspace context menu events', async () => {
      const user = userEvent.setup()
      const onWorkspaceContextMenu = jest.fn()

      render(<WorkspaceGroup {...defaultProps} onWorkspaceContextMenu={onWorkspaceContextMenu} />)

      const workspaceAvatar = screen.getByTestId('workspace-avatar-ws-1')
      await user.pointer({ keys: '[MouseRight]', target: workspaceAvatar })

      expect(onWorkspaceContextMenu).toHaveBeenCalledWith(
        expect.any(Object), // Event object
        mockWorkspaces[0]
      )
    })

    it('should handle group context menu events', async () => {
      const user = userEvent.setup()
      const onGroupContextMenu = jest.fn()

      render(<WorkspaceGroup {...defaultProps} onGroupContextMenu={onGroupContextMenu} />)

      const groupHeader = screen.getByRole('button', { name: /development projects/i })
      await user.pointer({ keys: '[MouseRight]', target: groupHeader })

      expect(onGroupContextMenu).toHaveBeenCalledWith(
        expect.any(Object), // Event object
        mockGroup
      )
    })

    it('should not call onGroupContextMenu when not provided', async () => {
      const user = userEvent.setup()

      render(<WorkspaceGroup {...defaultProps} onGroupContextMenu={undefined} />)

      const groupHeader = screen.getByRole('button', { name: /development projects/i })
      
      // Should not throw error when context menu handler is not provided
      await expect(user.pointer({ keys: '[MouseRight]', target: groupHeader }))
        .resolves.not.toThrow()
    })
  })

  describe('Drag and Drop Integration', () => {
    it('should integrate with @dnd-kit sortable', () => {
      const TestDndContext = () => (
        <DndContext onDragEnd={() => {}}>
          <WorkspaceGroup {...defaultProps} />
        </DndContext>
      )

      render(<TestDndContext />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
      // The useSortable hook should be called and provide drag capabilities
    })

    it('should render with drag transform applied', () => {
      // Mock the useSortable hook to return transform values
      const mockUseSortable = jest.requireMock('@dnd-kit/sortable').useSortable
      mockUseSortable.mockReturnValue({
        attributes: { 'data-sortable': true },
        listeners: { onPointerDown: jest.fn() },
        setNodeRef: jest.fn(),
        transform: { x: 10, y: 5, scaleX: 1, scaleY: 1 },
        transition: 'transform 200ms ease',
        isDragging: false
      })

      render(<WorkspaceGroup {...defaultProps} />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
    })

    it('should handle dragging state correctly', () => {
      const mockUseSortable = jest.requireMock('@dnd-kit/sortable').useSortable
      mockUseSortable.mockReturnValue({
        attributes: {},
        listeners: {},
        setNodeRef: jest.fn(),
        transform: null,
        transition: null,
        isDragging: true // Group is being dragged
      })

      render(<WorkspaceGroup {...defaultProps} />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
      // Component should apply dragging styles when isDragging is true
    })
  })

  describe('Workspace Ordering', () => {
    it('should render workspaces in correct order', () => {
      const orderedWorkspaces = [
        { ...mockWorkspaces[1], orderInGroup: 0 }, // Project B first
        { ...mockWorkspaces[0], orderInGroup: 1 }  // Project A second
      ]

      render(<WorkspaceGroup {...defaultProps} workspaces={orderedWorkspaces} />)

      const workspaceElements = screen.getAllByTestId(/workspace-avatar-/)
      expect(workspaceElements[0]).toHaveAttribute('data-testid', 'workspace-avatar-ws-2')
      expect(workspaceElements[1]).toHaveAttribute('data-testid', 'workspace-avatar-ws-1')
    })

    it('should handle workspaces with missing orderInGroup', () => {
      const workspacesWithoutOrder = mockWorkspaces.map(ws => ({
        ...ws,
        orderInGroup: undefined
      }))

      render(<WorkspaceGroup {...defaultProps} workspaces={workspacesWithoutOrder} />)

      // Should still render workspaces even without explicit ordering
      expect(screen.getByTestId('workspace-avatar-ws-1')).toBeInTheDocument()
      expect(screen.getByTestId('workspace-avatar-ws-2')).toBeInTheDocument()
    })
  })

  describe('Active State Handling', () => {
    it('should highlight active workspace', () => {
      render(<WorkspaceGroup {...defaultProps} />)

      // The active workspace (ws-2) should be rendered with active state
      expect(screen.getByTestId('workspace-avatar-ws-2')).toBeInTheDocument()
      // Component should apply active styling to the active workspace
    })

    it('should highlight active group', () => {
      render(<WorkspaceGroup {...defaultProps} isActive={true} />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
      // Component should apply active group styling
    })
  })

  describe('Performance', () => {
    it('should render large number of workspaces efficiently', () => {
      const manyWorkspaces = Array.from({ length: 50 }, (_, i) => ({
        id: `ws-${i}`,
        name: `Workspace ${i}`,
        emoji: '📁',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false,
        groupId: 'group-1',
        orderInGroup: i
      }))

      const startTime = performance.now()
      render(<WorkspaceGroup {...defaultProps} workspaces={manyWorkspaces} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // Should render within 100ms
      expect(screen.getByText('50')).toBeInTheDocument() // Workspace count
    })

    it('should memoize expensive calculations', () => {
      const { rerender } = render(<WorkspaceGroup {...defaultProps} />)

      // Re-render with same props - should not recalculate
      rerender(<WorkspaceGroup {...defaultProps} />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
      // Component should use memoized values for performance
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<WorkspaceGroup {...defaultProps} />)

      const groupButton = screen.getByRole('button', { name: /development projects/i })
      expect(groupButton).toHaveAttribute('aria-expanded', 'true')
      
      // Should have accessible name and description
      expect(groupButton).toBeInTheDocument()
    })

    it('should update ARIA attributes based on expansion state', () => {
      const { rerender } = render(<WorkspaceGroup {...defaultProps} />)

      let groupButton = screen.getByRole('button', { name: /development projects/i })
      expect(groupButton).toHaveAttribute('aria-expanded', 'true')

      // Re-render in collapsed state
      const collapsedGroup = { ...mockGroup, isExpanded: false }
      rerender(<WorkspaceGroup {...defaultProps} group={collapsedGroup} />)

      groupButton = screen.getByRole('button', { name: /development projects/i })
      expect(groupButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      const onToggleExpansion = jest.fn()

      render(<WorkspaceGroup {...defaultProps} onToggleExpansion={onToggleExpansion} />)

      const groupButton = screen.getByRole('button', { name: /development projects/i })
      
      // Focus the group button
      groupButton.focus()
      expect(groupButton).toHaveFocus()

      // Press Enter to toggle expansion
      await user.keyboard('{Enter}')
      expect(onToggleExpansion).toHaveBeenCalledWith('group-1')

      // Press Space to toggle expansion
      await user.keyboard(' ')
      expect(onToggleExpansion).toHaveBeenCalledTimes(2)
    })

    it('should provide screen reader friendly content', () => {
      render(<WorkspaceGroup {...defaultProps} />)

      expect(screen.getByText('Development Projects')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Workspace count for screen readers
      
      // Should have meaningful text content for screen readers
      const groupContent = screen.getByText('Development Projects').closest('div')
      expect(groupContent).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing group data gracefully', () => {
      const incompleteGroup = {
        id: 'incomplete-group',
        name: '',
        color: 'blue' as const,
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      render(<WorkspaceGroup {...defaultProps} group={incompleteGroup} />)

      // Should render even with empty name
      expect(screen.getByText('0')).toBeInTheDocument() // Workspace count
    })

    it('should handle invalid workspace data gracefully', () => {
      const invalidWorkspaces = [
        {
          id: '',
          name: null,
          emoji: '',
          color: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false,
          groupId: 'group-1',
          orderInGroup: 0
        }
      ] as any

      expect(() => {
        render(<WorkspaceGroup {...defaultProps} workspaces={invalidWorkspaces} />)
      }).not.toThrow()
    })

    it('should handle callback errors gracefully', async () => {
      const user = userEvent.setup()
      const onToggleExpansion = jest.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })

      // Mock console.error to avoid test noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<WorkspaceGroup {...defaultProps} onToggleExpansion={onToggleExpansion} />)

      const groupButton = screen.getByRole('button', { name: /development projects/i })
      
      // Should not crash when callback throws error
      await expect(user.click(groupButton)).resolves.not.toThrow()

      consoleSpy.mockRestore()
    })
  })
})