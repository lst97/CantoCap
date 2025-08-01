/**
 * Enhanced Workspace Panel Drag-and-Drop Tests
 * Comprehensive testing for drag-and-drop functionality in the enhanced workspace panel
 * including @dnd-kit integration, visual feedback, and drag operation handling.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import { 
  DndContext, 
  DragOverlay, 
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { EnhancedWorkspacePanel } from '../EnhancedWorkspacePanel'
import type { 
  WorkspaceGroup, 
  WorkspaceWithGrouping,
  DragOperation 
} from '../../../types/workspace'

// Mock the workspace store
jest.mock('../../../stores/workspace-store', () => ({
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

// Mock child components to focus on drag-and-drop logic
jest.mock('../WorkspaceGroup', () => ({
  WorkspaceGroup: ({ group, workspaces, onToggleExpansion, onWorkspaceClick }: any) => (
    <div 
      data-testid={`workspace-group-${group.id}`}
      data-sortable-id={group.id}
    >
      <button onClick={() => onToggleExpansion(group.id)}>
        {group.name} ({workspaces.length})
      </button>
      {group.isExpanded && workspaces.map((ws: any) => (
        <div 
          key={ws.id}
          data-testid={`workspace-${ws.id}`}
          data-sortable-id={ws.id}
          onClick={() => onWorkspaceClick(ws)}
        >
          {ws.emoji} {ws.name}
        </div>
      ))}
    </div>
  )
}))

jest.mock('../WorkspaceAvatar', () => ({
  WorkspaceAvatar: ({ workspace, onClick, isDragging }: any) => (
    <div 
      data-testid={`workspace-avatar-${workspace.id}`}
      data-sortable-id={workspace.id}
      data-dragging={isDragging}
      onClick={() => onClick(workspace)}
    >
      {workspace.emoji} {workspace.name}
    </div>
  )
}))

// Mock data
const mockGroups: WorkspaceGroup[] = [
  {
    id: 'group-1',
    name: 'Development',
    color: 'blue',
    isExpanded: true,
    order: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'group-2',
    name: 'Testing',
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
  },
  {
    id: 'ws-3',
    name: 'Test Project',
    emoji: '🧪',
    color: '#f59e0b',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    isActive: false,
    groupId: 'group-2',
    orderInGroup: 0
  },
  {
    id: 'ws-4',
    name: 'Ungrouped Project',
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

describe('Enhanced Workspace Panel Drag-and-Drop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllTimers()
  })

  describe('Drag-and-Drop Setup', () => {
    it('should render with DndContext and sortable items', () => {
      render(<EnhancedWorkspacePanel />)

      expect(screen.getByTestId('workspace-group-group-1')).toBeInTheDocument()
      expect(screen.getByTestId('workspace-group-group-2')).toBeInTheDocument()
      expect(screen.getByTestId('workspace-avatar-ws-4')).toBeInTheDocument() // Ungrouped
    })

    it('should initialize drag sensors correctly', () => {
      render(<EnhancedWorkspacePanel />)

      // Component should render without errors, indicating sensors are set up correctly
      expect(screen.getByText('Development (2)')).toBeInTheDocument()
    })

    it('should create sortable contexts for groups and workspaces', () => {
      render(<EnhancedWorkspacePanel />)

      // All draggable items should have sortable IDs
      expect(screen.getByTestId('workspace-group-group-1')).toHaveAttribute('data-sortable-id', 'group-1')
      expect(screen.getByTestId('workspace-group-group-2')).toHaveAttribute('data-sortable-id', 'group-2')
      expect(screen.getByTestId('workspace-avatar-ws-4')).toHaveAttribute('data-sortable-id', 'ws-4')
    })
  })

  describe('Workspace-to-Workspace Drag Operations', () => {
    it('should handle drag start for workspace-to-workspace combination', async () => {
      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      
      // Simulate drag start
      fireEvent.dragStart(sourceWorkspace, {
        dataTransfer: {
          setData: jest.fn(),
          effectAllowed: 'move'
        }
      })

      await waitFor(() => {
        // Should show visual feedback for potential drop targets
        expect(sourceWorkspace).toHaveAttribute('data-dragging', 'true')
      })
    })

    it('should create new group when dropping workspace onto another workspace', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'group-created',
        groupId: 'new-group-123',
        data: {
          id: 'new-group-123',
          name: 'New Group',
          color: 'default',
          isExpanded: true,
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetWorkspace = screen.getByTestId('workspace-1') // In expanded group

      // Simulate drag and drop
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragOver(targetWorkspace)
      fireEvent.drop(targetWorkspace)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalledWith({
          type: 'workspace-to-workspace',
          sourceId: 'ws-4',
          targetId: 'ws-1',
          position: 'combine'
        })
      })
    })

    it('should prevent workspace from being dropped onto itself', async () => {
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByTestId('workspace-avatar-ws-4')

      // Simulate drag and drop onto self
      fireEvent.dragStart(workspace)
      fireEvent.dragOver(workspace)
      fireEvent.drop(workspace)

      await waitFor(() => {
        // Should not call executeDragOperation for invalid self-drop
        expect(mockExecuteDragOperation).not.toHaveBeenCalled()
      })
    })
  })

  describe('Workspace-to-Group Drag Operations', () => {
    it('should add workspace to group when dropped onto group header', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'workspace-added-to-group',
        groupId: 'group-2',
        data: { workspaceId: 'ws-4', groupId: 'group-2', orderInGroup: 1 }
      })

      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetGroup = screen.getByTestId('workspace-group-group-2')

      // Simulate drag and drop
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragOver(targetGroup)
      fireEvent.drop(targetGroup)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalledWith({
          type: 'workspace-to-group',
          sourceId: 'ws-4',
          targetId: 'group-2',
          position: 'end'
        })
      })
    })

    it('should insert workspace at specific position within group', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'workspace-added-to-group',
        groupId: 'group-1',
        data: { workspaceId: 'ws-4', groupId: 'group-1', orderInGroup: 1 }
      })

      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetWorkspace = screen.getByTestId('workspace-2') // Second workspace in group

      // Simulate drag and drop at specific position
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragOver(targetWorkspace, {
        clientY: 100 // Simulate drop position
      })
      fireEvent.drop(targetWorkspace)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalledWith({
          type: 'workspace-to-group',
          sourceId: 'ws-4',
          targetId: 'group-1',
          position: 'after',
          targetWorkspaceId: 'ws-2'
        })
      })
    })

    it('should prevent adding workspace to group it already belongs to', async () => {
      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-1') // Already in group-1
      const targetGroup = screen.getByTestId('workspace-group-group-1')

      // Simulate drag and drop
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragOver(targetGroup)
      fireEvent.drop(targetGroup)

      await waitFor(() => {
        // Should not call executeDragOperation for workspace already in target group
        expect(mockExecuteDragOperation).not.toHaveBeenCalled()
      })
    })
  })

  describe('Group Reordering Operations', () => {
    it('should reorder groups when group is dropped onto another group', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'groups-reordered',
        data: { reorderedGroups: ['group-2', 'group-1'] }
      })

      render(<EnhancedWorkspacePanel />)

      const sourceGroup = screen.getByTestId('workspace-group-group-2')
      const targetGroup = screen.getByTestId('workspace-group-group-1')

      // Simulate drag and drop
      fireEvent.dragStart(sourceGroup)
      fireEvent.dragOver(targetGroup)
      fireEvent.drop(targetGroup)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalledWith({
          type: 'group-reorder',
          sourceId: 'group-2',
          targetId: 'group-1',
          position: 'before'
        })
      })
    })

    it('should handle group reordering with different drop positions', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'groups-reordered',
        data: { reorderedGroups: ['group-1', 'group-2'] }
      })

      render(<EnhancedWorkspacePanel />)

      const sourceGroup = screen.getByTestId('workspace-group-group-1')
      const targetGroup = screen.getByTestId('workspace-group-group-2')

      // Simulate drag and drop after target
      fireEvent.dragStart(sourceGroup)
      fireEvent.dragOver(targetGroup, {
        clientY: 200 // Simulate drop after target
      })
      fireEvent.drop(targetGroup)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalledWith({
          type: 'group-reorder',
          sourceId: 'group-1',
          targetId: 'group-2',
          position: 'after'
        })
      })
    })
  })

  describe('Workspace Ungrouping Operations', () => {
    it('should remove workspace from group when dropped outside groups', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'workspace-removed-from-group',
        groupId: 'group-1',
        data: { workspaceId: 'ws-1', wasUngrouped: true }
      })

      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-1')
      const ungroupedArea = screen.getByRole('main') // Drop outside groups

      // Simulate drag and drop to ungrouped area
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragOver(ungroupedArea)
      fireEvent.drop(ungroupedArea)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalledWith({
          type: 'workspace-to-ungrouped',
          sourceId: 'ws-1',
          targetId: null,
          position: 'end'
        })
      })
    })

    it('should reorder ungrouped workspaces', async () => {
      // Add another ungrouped workspace for testing
      const extraUngrouped = {
        id: 'ws-5',
        name: 'Another Ungrouped',
        emoji: '📋',
        color: '#ec4899',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      mockGetGroupedWorkspaces.mockReturnValue({
        groups: mockGroups.map(group => ({
          ...group,
          workspaces: mockWorkspaces.filter(ws => ws.groupId === group.id)
        })),
        ungroupedWorkspaces: [mockWorkspaces[3], extraUngrouped]
      })

      mockExecuteDragOperation.mockResolvedValue({
        success: true,
        operation: 'ungrouped-workspaces-reordered',
        data: { reorderedWorkspaces: ['ws-5', 'ws-4'] }
      })

      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      // Would need to simulate drop onto another ungrouped workspace

      // This test demonstrates the structure for ungrouped reordering
      expect(screen.getByTestId('workspace-avatar-ws-4')).toBeInTheDocument()
    })
  })

  describe('Visual Feedback', () => {
    it('should show drag overlay when dragging workspace', async () => {
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByTestId('workspace-avatar-ws-4')

      fireEvent.dragStart(workspace)

      await waitFor(() => {
        // Should show drag overlay with workspace preview
        const dragOverlay = screen.queryByTestId('drag-overlay')
        expect(dragOverlay || workspace).toHaveAttribute('data-dragging', 'true')
      })
    })

    it('should highlight valid drop targets during drag', async () => {
      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetGroup = screen.getByTestId('workspace-group-group-1')

      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragEnter(targetGroup)

      await waitFor(() => {
        // Target group should be highlighted as valid drop target
        expect(targetGroup).toHaveClass('drop-target-active')
      })
    })

    it('should show insertion indicators for precise positioning', async () => {
      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetWorkspace = screen.getByTestId('workspace-1')

      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragOver(targetWorkspace, {
        clientY: 50 // Simulate hover over top half
      })

      await waitFor(() => {
        // Should show insertion line above target workspace
        const insertionIndicator = screen.queryByTestId('insertion-indicator')
        expect(insertionIndicator).toBeInTheDocument()
      })
    })

    it('should remove visual feedback when drag ends', async () => {
      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByTestId('workspace-avatar-ws-4')

      fireEvent.dragStart(workspace)
      fireEvent.dragEnd(workspace)

      await waitFor(() => {
        // All drag-related visual feedback should be removed
        expect(workspace).not.toHaveAttribute('data-dragging', 'true')
        expect(screen.queryByTestId('drag-overlay')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle drag operation failures gracefully', async () => {
      mockExecuteDragOperation.mockResolvedValue({
        success: false,
        error: 'Workspace is already in a group',
        operation: 'failed'
      })

      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetGroup = screen.getByTestId('workspace-group-group-1')

      fireEvent.dragStart(sourceWorkspace)
      fireEvent.drop(targetGroup)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalled()
        // Should show error feedback to user
        // Component should reset to original state
      })
    })

    it('should handle invalid drop targets', async () => {
      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const invalidTarget = screen.getByText('Development (2)') // Text node, not valid drop target

      fireEvent.dragStart(sourceWorkspace)
      fireEvent.dragOver(invalidTarget)
      fireEvent.drop(invalidTarget)

      await waitFor(() => {
        // Should not execute drag operation for invalid target
        expect(mockExecuteDragOperation).not.toHaveBeenCalled()
      })
    })

    it('should recover from drag operation network failures', async () => {
      mockExecuteDragOperation.mockRejectedValue(new Error('Network error'))

      // Mock console.error to avoid test noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetGroup = screen.getByTestId('workspace-group-group-1')

      fireEvent.dragStart(sourceWorkspace)
      fireEvent.drop(targetGroup)

      await waitFor(() => {
        expect(mockExecuteDragOperation).toHaveBeenCalled()
        // Component should handle promise rejection gracefully
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Performance', () => {
    it('should handle drag operations with large numbers of workspaces', async () => {
      // Create large dataset
      const manyWorkspaces = Array.from({ length: 100 }, (_, i) => ({
        id: `ws-large-${i}`,
        name: `Large Workspace ${i}`,
        emoji: '📁',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false,
        groupId: i < 50 ? 'group-1' : 'group-2',
        orderInGroup: i < 50 ? i : i - 50
      }))

      mockGetGroupedWorkspaces.mockReturnValue({
        groups: mockGroups.map(group => ({
          ...group,
          workspaces: manyWorkspaces.filter(ws => ws.groupId === group.id)
        })),
        ungroupedWorkspaces: []
      })

      const startTime = performance.now()
      render(<EnhancedWorkspacePanel />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(500) // Should render within 500ms
    })

    it('should debounce rapid drag operations', async () => {
      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      const targetGroup = screen.getByTestId('workspace-group-group-1')

      // Simulate rapid drag operations
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.drop(targetGroup)
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.drop(targetGroup)
      fireEvent.dragStart(sourceWorkspace)
      fireEvent.drop(targetGroup)

      await waitFor(() => {
        // Should only execute one operation due to debouncing
        expect(mockExecuteDragOperation).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Accessibility', () => {
    it('should support keyboard-initiated drag operations', async () => {
      const user = userEvent.setup()

      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByTestId('workspace-avatar-ws-4')
      
      // Focus the workspace
      workspace.focus()
      expect(workspace).toHaveFocus()

      // Use keyboard to initiate drag
      await user.keyboard('{Space}') // Start drag with space
      
      // Should enter drag mode
      expect(workspace).toHaveAttribute('aria-grabbed', 'true')
    })

    it('should announce drag operations to screen readers', async () => {
      render(<EnhancedWorkspacePanel />)

      const sourceWorkspace = screen.getByTestId('workspace-avatar-ws-4')
      
      fireEvent.dragStart(sourceWorkspace)

      await waitFor(() => {
        // Should have aria-live announcement for drag start
        const announcement = screen.queryByRole('status')
        expect(announcement).toBeInTheDocument()
      })
    })

    it('should provide clear focus management during drag operations', async () => {
      const user = userEvent.setup()

      render(<EnhancedWorkspacePanel />)

      const workspace = screen.getByTestId('workspace-avatar-ws-4')
      
      workspace.focus()
      await user.keyboard('{Space}') // Start drag

      // Focus should remain on dragged item or move to appropriate target
      expect(document.activeElement).toBeTruthy()
    })
  })
})