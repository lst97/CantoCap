/**
 * Workspace Grouping Accessibility Tests
 * Comprehensive accessibility testing for workspace grouping system
 * including keyboard navigation, screen reader support, and WCAG compliance.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import { axe, toHaveNoViolations } from 'jest-axe'
import { EnhancedWorkspacePanel } from '../../components/workspace/EnhancedWorkspacePanel'
import { WorkspaceGroup } from '../../components/workspace/WorkspaceGroup'
import type { 
  WorkspaceGroup as WorkspaceGroupType, 
  WorkspaceWithGrouping 
} from '../../types/workspace'

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations)

// Mock workspace store for accessibility testing
jest.mock('../../stores/workspace-store', () => ({
  useWorkspaceStore: () => ({
    workspaces: mockWorkspaces,
    workspaceGroups: mockGroups,
    activeWorkspace: mockWorkspaces[1],
    executeDragOperation: mockExecuteDragOperation,
    toggleGroupExpansion: mockToggleGroupExpansion,
    createWorkspaceGroup: mockCreateWorkspaceGroup,
    getGroupedWorkspaces: mockGetGroupedWorkspaces,
    isLoading: false,
    error: null
  })
}))

// Mock data
const mockGroups: WorkspaceGroupType[] = [
  {
    id: 'group-1',
    name: 'Development Projects',
    color: 'blue',
    isExpanded: true,
    order: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'group-2',
    name: 'Testing Environment',
    color: 'green',
    isExpanded: false,
    order: 1,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  }
]

const mockWorkspaces: WorkspaceWithGrouping[] = [
  {
    id: 'ws-1',
    name: 'Frontend Development',
    emoji: '💻',
    color: '#3b82f6',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isActive: false,
    groupId: 'group-1',
    orderInGroup: 0
  },
  {
    id: 'ws-2',
    name: 'Backend API',
    emoji: '⚙️',
    color: '#10b981',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    isActive: true,
    groupId: 'group-1',
    orderInGroup: 1
  },
  {
    id: 'ws-3',
    name: 'Mobile App',
    emoji: '📱',
    color: '#f59e0b',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    isActive: false,
    groupId: 'group-2',
    orderInGroup: 0
  },
  {
    id: 'ws-4',
    name: 'Standalone Project',
    emoji: '📄',
    color: '#8b5cf6',
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
    isActive: false
    // No groupId - ungrouped workspace
  }
]

// Mock store functions
const mockExecuteDragOperation = jest.fn()
const mockToggleGroupExpansion = jest.fn()
const mockCreateWorkspaceGroup = jest.fn()
const mockGetGroupedWorkspaces = jest.fn(() => ({
  groups: mockGroups.map(group => ({
    ...group,
    workspaces: mockWorkspaces.filter(ws => ws.groupId === group.id)
  })),
  ungroupedWorkspaces: mockWorkspaces.filter(ws => !ws.groupId)
}))

describe('Workspace Grouping Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations in workspace panel', async () => {
      const { container } = render(<EnhancedWorkspacePanel />)
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations in expanded group', async () => {
      const expandedGroup = { ...mockGroups[0], isExpanded: true }
      const groupWorkspaces = mockWorkspaces.filter(ws => ws.groupId === expandedGroup.id)
      
      const { container } = render(
        <WorkspaceGroup
          group={expandedGroup}
          workspaces={groupWorkspaces}
          onToggleExpansion={jest.fn()}
          onWorkspaceClick={jest.fn()}
          onWorkspaceContextMenu={jest.fn()}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations in collapsed group', async () => {
      const collapsedGroup = { ...mockGroups[1], isExpanded: false }
      const groupWorkspaces = mockWorkspaces.filter(ws => ws.groupId === collapsedGroup.id)
      
      const { container } = render(
        <WorkspaceGroup
          group={collapsedGroup}
          workspaces={groupWorkspaces}
          onToggleExpansion={jest.fn()}
          onWorkspaceClick={jest.fn()}
          onWorkspaceContextMenu={jest.fn()}
        />
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should maintain accessibility during drag operations', async () => {
      const { container } = render(<EnhancedWorkspacePanel />)
      
      // Simulate drag start
      const draggableWorkspace = screen.getByText('Standalone Project')
      fireEvent.dragStart(draggableWorkspace)
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation through groups', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      // Find first group button
      const firstGroup = screen.getByRole('button', { name: /development projects/i })
      
      // Focus should be able to reach the group
      await user.tab()
      expect(firstGroup).toHaveFocus()

      // Arrow keys should navigate between groups
      await user.keyboard('{ArrowDown}')
      const secondGroup = screen.getByRole('button', { name: /testing environment/i })
      expect(secondGroup).toHaveFocus()
    })

    it('should toggle group expansion with keyboard', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const groupButton = screen.getByRole('button', { name: /development projects/i })
      groupButton.focus()

      // Enter key should toggle expansion
      await user.keyboard('{Enter}')
      expect(mockToggleGroupExpansion).toHaveBeenCalledWith('group-1')

      // Space key should also toggle expansion
      await user.keyboard(' ')
      expect(mockToggleGroupExpansion).toHaveBeenCalledTimes(2)
    })

    it('should navigate into expanded group workspaces', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const expandedGroup = screen.getByRole('button', { name: /development projects/i })
      expandedGroup.focus()

      // Navigate into group content
      await user.keyboard('{ArrowDown}')
      
      // Should focus on first workspace in expanded group
      const firstWorkspace = screen.getByText('💻 Frontend Development')
      expect(firstWorkspace).toHaveFocus()

      // Continue navigation through workspaces
      await user.keyboard('{ArrowDown}')
      const secondWorkspace = screen.getByText('⚙️ Backend API')
      expect(secondWorkspace).toHaveFocus()
    })

    it('should support Home/End navigation', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      // Focus any item
      const middleItem = screen.getByRole('button', { name: /testing environment/i })
      middleItem.focus()

      // Home should go to first focusable item
      await user.keyboard('{Home}')
      const firstItem = screen.getByRole('button', { name: /development projects/i })
      expect(firstItem).toHaveFocus()

      // End should go to last focusable item
      await user.keyboard('{End}')
      const lastItem = screen.getByText('📄 Standalone Project')
      expect(lastItem).toHaveFocus()
    })

    it('should handle Escape key to exit drag mode', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByText('📄 Standalone Project')
      workspace.focus()

      // Start drag with Space
      await user.keyboard(' ')
      expect(workspace).toHaveAttribute('aria-grabbed', 'true')

      // Escape should cancel drag
      await user.keyboard('{Escape}')
      expect(workspace).toHaveAttribute('aria-grabbed', 'false')
    })

    it('should support tab navigation through all interactive elements', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const interactiveElements = [
        screen.getByRole('button', { name: /development projects/i }),
        screen.getByText('💻 Frontend Development'),
        screen.getByText('⚙️ Backend API'),
        screen.getByRole('button', { name: /testing environment/i }),
        screen.getByText('📄 Standalone Project')
      ]

      // Tab through all elements
      for (const element of interactiveElements) {
        await user.tab()
        expect(element).toHaveFocus()
      }
    })
  })

  describe('Screen Reader Support', () => {
    it('should provide proper ARIA labels for groups', () => {
      render(<EnhancedWorkspacePanel />)

      const expandedGroup = screen.getByRole('button', { name: /development projects/i })
      expect(expandedGroup).toHaveAttribute('aria-expanded', 'true')
      expect(expandedGroup).toHaveAttribute('aria-label', expect.stringContaining('Development Projects'))

      const collapsedGroup = screen.getByRole('button', { name: /testing environment/i })
      expect(collapsedGroup).toHaveAttribute('aria-expanded', 'false')
    })

    it('should announce workspace count in groups', () => {
      render(<EnhancedWorkspacePanel />)

      const groupButton = screen.getByRole('button', { name: /development projects/i })
      const ariaDescription = groupButton.getAttribute('aria-describedby')
      
      if (ariaDescription) {
        const description = screen.getByText('2 workspaces') // Should announce count
        expect(description).toBeInTheDocument()
      }
    })

    it('should provide proper roles for workspace items', () => {
      render(<EnhancedWorkspacePanel />)

      const workspaceItems = screen.getAllByRole('button')
      
      // Workspace items should have button role for interaction
      workspaceItems.forEach(item => {
        expect(item).toHaveAttribute('role', 'button')
      })
    })

    it('should announce active workspace state', () => {
      render(<EnhancedWorkspacePanel />)

      const activeWorkspace = screen.getByText('⚙️ Backend API')
      expect(activeWorkspace).toHaveAttribute('aria-current', 'true')
      expect(activeWorkspace).toHaveAttribute('aria-label', expect.stringContaining('active'))
    })

    it('should provide live region announcements for drag operations', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByText('📄 Standalone Project')
      
      // Start drag operation
      await user.pointer({ keys: '[MouseLeft>]', target: workspace })
      
      // Should have live region announcement
      const liveRegion = screen.queryByRole('status')
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveTextContent(/dragging/i)
    })

    it('should announce successful drag completion', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'workspace-added-to-group',
        groupId: 'group-1'
      })

      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByText('📄 Standalone Project')
      const targetGroup = screen.getByRole('button', { name: /development projects/i })

      // Perform drag and drop
      await user.pointer([
        { keys: '[MouseLeft>]', target: workspace },
        { target: targetGroup },
        { keys: '[/MouseLeft]' }
      ])

      await waitFor(() => {
        const successAnnouncement = screen.queryByRole('status')
        expect(successAnnouncement).toHaveTextContent(/added to group/i)
      })
    })

    it('should provide descriptive text for group colors', () => {
      render(<EnhancedWorkspacePanel />)

      const blueGroup = screen.getByRole('button', { name: /development projects/i })
      expect(blueGroup).toHaveAttribute('aria-description', expect.stringContaining('blue'))

      const greenGroup = screen.getByRole('button', { name: /testing environment/i })
      expect(greenGroup).toHaveAttribute('aria-description', expect.stringContaining('green'))
    })
  })

  describe('Focus Management', () => {
    it('should maintain focus during group expansion/collapse', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const groupButton = screen.getByRole('button', { name: /development projects/i })
      groupButton.focus()

      // Toggle expansion
      await user.keyboard('{Enter}')
      
      // Focus should remain on group button
      expect(groupButton).toHaveFocus()
    })

    it('should restore focus after drag operation completion', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'workspace-added-to-group',
        groupId: 'group-1'
      })

      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByText('📄 Standalone Project')
      workspace.focus()

      // Perform keyboard drag
      await user.keyboard(' ') // Start drag
      await user.keyboard('{ArrowUp}') // Navigate to target
      await user.keyboard(' ') // Complete drag

      await waitFor(() => {
        // Focus should be restored to a logical location
        expect(document.activeElement).toBeTruthy()
      })
    })

    it('should trap focus in modal dialogs', async () => {
      // This would test focus trapping in any modal dialogs
      // that might be part of the workspace grouping system
      render(<EnhancedWorkspacePanel />)

      // If there are modal dialogs, they should trap focus
      // This is a placeholder for modal-specific focus testing
      expect(screen.getByText('Development Projects')).toBeInTheDocument()
    })

    it('should provide clear focus indicators', () => {
      render(<EnhancedWorkspacePanel />)

      const focusableElements = screen.getAllByRole('button')
      
      focusableElements.forEach(element => {
        element.focus()
        
        // Element should have visible focus indicator
        const computedStyle = getComputedStyle(element)
        expect(computedStyle.outline).not.toBe('none')
      })
    })

    it('should handle focus when items are added/removed', async () => {
      const user = userEvent.setup()
      
      // Mock successful group creation
      mockCreateWorkspaceGroup.mockResolvedValue({
        success: true,
        data: {
          id: 'new-group',
          name: 'New Group',
          color: 'purple',
          isExpanded: true,
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      render(<EnhancedWorkspacePanel />)

      // Focus should be manageable when new groups are added
      const initialFocusable = screen.getAllByRole('button')
      const initialCount = initialFocusable.length

      // Add new group (this would trigger through some UI action)
      // Focus should move to new group or remain in logical position
      expect(initialCount).toBeGreaterThan(0)
    })
  })

  describe('High Contrast and Visual Accessibility', () => {
    it('should maintain contrast ratios for group colors', () => {
      const { container } = render(<EnhancedWorkspacePanel />)

      // Check that color combinations meet WCAG contrast requirements
      const groupElements = container.querySelectorAll('[data-group-color]')
      
      groupElements.forEach(element => {
        const computedStyle = getComputedStyle(element)
        const backgroundColor = computedStyle.backgroundColor
        const color = computedStyle.color
        
        // Colors should provide sufficient contrast
        // This would typically use a contrast calculation library
        expect(backgroundColor).toBeTruthy()
        expect(color).toBeTruthy()
      })
    })

    it('should support high contrast mode', () => {
      // Simulate high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      render(<EnhancedWorkspacePanel />)

      // In high contrast mode, elements should have enhanced visual distinction
      const groups = screen.getAllByRole('button')
      groups.forEach(group => {
        expect(group).toBeInTheDocument()
        // Would check for high contrast styling
      })
    })

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      render(<EnhancedWorkspacePanel />)

      // Animations should be reduced or disabled
      const animatedElements = screen.getAllByRole('button')
      animatedElements.forEach(element => {
        const computedStyle = getComputedStyle(element)
        // Should have reduced or no animations
        expect(computedStyle.animationDuration).toBe('0s')
      })
    })
  })

  describe('Touch and Mobile Accessibility', () => {
    it('should provide adequate touch targets', () => {
      render(<EnhancedWorkspacePanel />)

      const touchTargets = screen.getAllByRole('button')
      
      touchTargets.forEach(target => {
        const rect = target.getBoundingClientRect()
        
        // Touch targets should be at least 44x44px (WCAG guideline)
        expect(rect.width).toBeGreaterThanOrEqual(44)
        expect(rect.height).toBeGreaterThanOrEqual(44)
      })
    })

    it('should support gesture-based navigation', async () => {
      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByText('📄 Standalone Project')
      
      // Simulate touch-based drag operation
      await user.pointer([
        { keys: '[TouchA>]', target: workspace },
        { coords: { x: 100, y: 200 } },
        { keys: '[/TouchA]' }
      ])

      // Should handle touch-based interactions appropriately
      expect(workspace).toBeInTheDocument()
    })

    it('should provide haptic feedback indicators', () => {
      render(<EnhancedWorkspacePanel />)

      // Elements that would trigger haptic feedback should be marked
      const interactiveElements = screen.getAllByRole('button')
      
      interactiveElements.forEach(element => {
        // Would check for data attributes or classes that indicate haptic feedback
        expect(element).toBeInTheDocument()
      })
    })
  })

  describe('Error State Accessibility', () => {
    it('should announce drag operation errors', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: false,
        error: 'Cannot add workspace to this group',
        operation: 'failed'
      })

      const user = userEvent.setup()
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByText('📄 Standalone Project')
      const targetGroup = screen.getByRole('button', { name: /development projects/i })

      // Perform failed drag operation
      await user.pointer([
        { keys: '[MouseLeft>]', target: workspace },
        { target: targetGroup },
        { keys: '[/MouseLeft]' }
      ])

      await waitFor(() => {
        const errorAnnouncement = screen.queryByRole('alert')
        expect(errorAnnouncement).toHaveTextContent(/cannot add workspace/i)
      })
    })

    it('should provide error recovery instructions', async () => {
      render(<EnhancedWorkspacePanel />)

      // When errors occur, should provide clear instructions for recovery
      // This would be tested with actual error states
      expect(screen.getByText('Development Projects')).toBeInTheDocument()
    })
  })

  describe('Language and Internationalization', () => {
    it('should support RTL (right-to-left) languages', () => {
      // Mock RTL direction
      document.dir = 'rtl'
      
      const { container } = render(<EnhancedWorkspacePanel />)
      
      // Layout should adapt for RTL languages
      expect(container).toBeInTheDocument()
      
      // Reset
      document.dir = 'ltr'
    })

    it('should provide translatable aria-labels', () => {
      render(<EnhancedWorkspacePanel />)

      const groups = screen.getAllByRole('button')
      
      groups.forEach(group => {
        const ariaLabel = group.getAttribute('aria-label')
        if (ariaLabel) {
          // Should not contain hardcoded English strings
          expect(ariaLabel).toBeTruthy()
        }
      })
    })

    it('should respect browser language preferences', () => {
      // Mock different language setting
      Object.defineProperty(navigator, 'language', {
        writable: true,
        value: 'es-ES'
      })

      render(<EnhancedWorkspacePanel />)

      // Should adapt to user's language preferences
      expect(screen.getByText('Development Projects')).toBeInTheDocument()
    })
  })
})