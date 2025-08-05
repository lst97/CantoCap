/**
 * Workspace Store Grouping Tests
 * Comprehensive testing for workspace grouping store functionality including
 * drag-and-drop state management, auto-save integration, and error handling.
 */

import { jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react'
import { useWorkspaceStore } from '../workspace-store'
import { workspaceDatabase } from '../../services/workspace/workspace-database'
// REMOVED: auto-save-engine import - timer-based auto-save system deleted
import type { 
  WorkspaceGroup, 
  WorkspaceWithGrouping,
  WorkspaceGroupColor,
  DragOperation,
  GroupOperationResult
} from '../../types/workspace'

// Mock dependencies
jest.mock('../../services/workspace-database', () => ({
  workspaceDatabase: {
    initialize: jest.fn(),
    getAllGroups: jest.fn(),
    getAllWorkspaces: jest.fn(),
    getGroupWorkspaces: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    addWorkspaceToGroup: jest.fn(),
    removeWorkspaceFromGroup: jest.fn(),
    reorderWorkspacesInGroup: jest.fn(),
    executeDragOperation: jest.fn(),
    validateDataConsistency: jest.fn(),
    getAllGroupMappings: jest.fn()
  }
}))

// REMOVED: auto-save-engine mock - timer-based auto-save system deleted

const mockDatabase = workspaceDatabase as jest.Mocked<typeof workspaceDatabase>

describe('Workspace Store Grouping', () => {
  let store: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Reset store state
    const { result } = renderHook(() => useWorkspaceStore())
    store = result.current
    
    // Setup default mocks
    mockDatabase.getAllGroups.mockResolvedValue([])
    mockDatabase.getAllWorkspaces.mockResolvedValue([])
    mockDatabase.getAllGroupMappings.mockResolvedValue([])
    mockDatabase.validateDataConsistency.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      stats: { groupCount: 0, workspaceCount: 0, mappingCount: 0 }
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllTimers()
  })

  describe('Group Management Actions', () => {
    it('should create new workspace group', async () => {
      const mockGroup: WorkspaceGroup = {
        id: 'test-group-1',
        name: 'Development Projects',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDatabase.createGroup.mockResolvedValue({
        success: true,
        data: mockGroup,
        operation: 'group-created'
      })

      await act(async () => {
        const result = await store.createWorkspaceGroup({
          name: 'Development Projects',
          color: 'blue' as WorkspaceGroupColor
        })
        
        expect(result.success).toBe(true)
        expect(result.data.name).toBe('Development Projects')
        expect(result.data.color).toBe('blue')
      })

      expect(mockDatabase.createGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Development Projects',
          color: 'blue',
          isExpanded: true,
          order: 0
        })
      )

      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith(mockGroup.id)
    })

    it('should update workspace group properties', async () => {
      const existingGroup: WorkspaceGroup = {
        id: 'group-update-test',
        name: 'Original Name',
        color: 'blue',
        isExpanded: false,
        order: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      }

      const updatedGroup: WorkspaceGroup = {
        ...existingGroup,
        name: 'Updated Name',
        color: 'red',
        isExpanded: true,
        updatedAt: new Date()
      }

      mockDatabase.updateGroup.mockResolvedValue({
        success: true,
        data: updatedGroup,
        operation: 'group-updated'
      })

      await act(async () => {
        const result = await store.updateWorkspaceGroup(existingGroup.id, {
          name: 'Updated Name',
          color: 'red' as WorkspaceGroupColor,
          isExpanded: true
        })
        
        expect(result.success).toBe(true)
        expect(result.data.name).toBe('Updated Name')
        expect(result.data.color).toBe('red')
        expect(result.data.isExpanded).toBe(true)
      })

      expect(mockDatabase.updateGroup).toHaveBeenCalledWith(
        existingGroup.id,
        expect.objectContaining({
          name: 'Updated Name',
          color: 'red',
          isExpanded: true
        })
      )

      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith(existingGroup.id)
    })

    it('should delete workspace group and redistribute workspaces', async () => {
      const groupToDelete: WorkspaceGroup = {
        id: 'group-delete-test',
        name: 'Group to Delete',
        color: 'yellow',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDatabase.deleteGroup.mockResolvedValue({
        success: true,
        data: { deleted: true, redistributedWorkspaces: ['ws-1', 'ws-2'] },
        operation: 'group-deleted'
      })

      await act(async () => {
        const result = await store.deleteWorkspaceGroup(groupToDelete.id)
        
        expect(result.success).toBe(true)
        expect(result.data.deleted).toBe(true)
        expect(result.data.redistributedWorkspaces).toHaveLength(2)
      })

      expect(mockDatabase.deleteGroup).toHaveBeenCalledWith(groupToDelete.id)
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith(groupToDelete.id)
    })

    it('should toggle group expansion state', async () => {
      const group: WorkspaceGroup = {
        id: 'group-toggle',
        name: 'Toggle Test',
        color: 'green',
        isExpanded: false,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDatabase.updateGroup.mockResolvedValue({
        success: true,
        data: { ...group, isExpanded: true, updatedAt: new Date() },
        operation: 'group-updated'
      })

      await act(async () => {
        const result = await store.toggleGroupExpansion(group.id)
        
        expect(result.success).toBe(true)
        expect(result.data.isExpanded).toBe(true)
      })

      expect(mockDatabase.updateGroup).toHaveBeenCalledWith(
        group.id,
        expect.objectContaining({ isExpanded: true })
      )
    })

    it('should handle group creation errors gracefully', async () => {
      mockDatabase.createGroup.mockRejectedValue(new Error('Database error'))

      await act(async () => {
        const result = await store.createWorkspaceGroup({
          name: 'Failed Group',
          color: 'red' as WorkspaceGroupColor
        })
        
        expect(result.success).toBe(false)
        expect(result.error).toBe('Database error')
      })

      // Should not trigger auto-save on failure
      expect(mockAutoSave.scheduleGroupUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Drag-and-Drop Operations', () => {
    let mockWorkspaces: any[]
    let mockGroups: WorkspaceGroup[]

    beforeEach(() => {
      mockWorkspaces = [
        {
          id: 'ws-1',
          name: 'Workspace 1',
          emoji: '📁',
          color: '#3b82f6',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false
        },
        {
          id: 'ws-2',
          name: 'Workspace 2',
          emoji: '📂',
          color: '#10b981',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false
        },
        {
          id: 'ws-3',
          name: 'Workspace 3',
          emoji: '📄',
          color: '#f59e0b',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false
        }
      ]

      mockGroups = [
        {
          id: 'group-1',
          name: 'Group 1',
          color: 'blue',
          isExpanded: true,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'group-2',
          name: 'Group 2', 
          color: 'green',
          isExpanded: true,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockDatabase.getAllWorkspaces.mockResolvedValue(mockWorkspaces)
      mockDatabase.getAllGroups.mockResolvedValue(mockGroups)
    })

    it('should handle workspace-to-workspace drag creating new group', async () => {
      const newGroupId = 'new-group-123'
      
      mockDatabase.executeDragOperation.mockResolvedValue({
        success: true,
        operation: 'group-created',
        groupId: newGroupId,
        data: {
          id: newGroupId,
          name: 'New Group',
          color: 'default',
          isExpanded: true,
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      const dragOperation: DragOperation = {
        type: 'workspace-to-workspace',
        sourceId: 'ws-1',
        targetId: 'ws-2',
        position: 'combine'
      }

      await act(async () => {
        const result = await store.executeDragOperation(dragOperation)
        
        expect(result.success).toBe(true)
        expect(result.operation).toBe('group-created')
        expect(result.groupId).toBe(newGroupId)
      })

      expect(mockDatabase.executeDragOperation).toHaveBeenCalledWith(dragOperation)
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith(newGroupId)
    })

    it('should handle workspace-to-group drag operation', async () => {
      mockDatabase.executeDragOperation.mockResolvedValue({
        success: true,
        operation: 'workspace-added-to-group',
        groupId: 'group-1',
        data: { workspaceId: 'ws-1', groupId: 'group-1', orderInGroup: 1 }
      })

      const dragOperation: DragOperation = {
        type: 'workspace-to-group',
        sourceId: 'ws-1',
        targetId: 'group-1',
        position: 'end'
      }

      await act(async () => {
        const result = await store.executeDragOperation(dragOperation)
        
        expect(result.success).toBe(true)
        expect(result.operation).toBe('workspace-added-to-group')
        expect(result.groupId).toBe('group-1')
      })

      expect(mockDatabase.executeDragOperation).toHaveBeenCalledWith(dragOperation)
      expect(mockAutoSave.scheduleWorkspaceUpdate).toHaveBeenCalledWith('ws-1')
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith('group-1')
    })

    it('should handle group reordering drag operation', async () => {
      mockDatabase.executeDragOperation.mockResolvedValue({
        success: true,
        operation: 'groups-reordered',
        data: { reorderedGroups: ['group-2', 'group-1'] }
      })

      const dragOperation: DragOperation = {
        type: 'group-reorder',
        sourceId: 'group-2',
        targetId: 'group-1',
        position: 'before'
      }

      await act(async () => {
        const result = await store.executeDragOperation(dragOperation)
        
        expect(result.success).toBe(true)
        expect(result.operation).toBe('groups-reordered')
      })

      expect(mockDatabase.executeDragOperation).toHaveBeenCalledWith(dragOperation)
      
      // Should schedule updates for both affected groups
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith('group-1')
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith('group-2')
    })

    it('should handle workspace removal from group', async () => {
      mockDatabase.executeDragOperation.mockResolvedValue({
        success: true,
        operation: 'workspace-removed-from-group',
        groupId: 'group-1',
        data: { workspaceId: 'ws-1', wasUngrouped: true }
      })

      const dragOperation: DragOperation = {
        type: 'workspace-to-ungrouped',
        sourceId: 'ws-1',
        targetId: null,
        position: 'end'
      }

      await act(async () => {
        const result = await store.executeDragOperation(dragOperation)
        
        expect(result.success).toBe(true)
        expect(result.operation).toBe('workspace-removed-from-group')
      })

      expect(mockDatabase.executeDragOperation).toHaveBeenCalledWith(dragOperation)
      expect(mockAutoSave.scheduleWorkspaceUpdate).toHaveBeenCalledWith('ws-1')
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith('group-1')
    })

    it('should handle drag operation failures with rollback', async () => {
      mockDatabase.executeDragOperation.mockResolvedValue({
        success: false,
        error: 'Workspace ws-1 is already in a group',
        operation: 'failed'
      })

      const dragOperation: DragOperation = {
        type: 'workspace-to-group',
        sourceId: 'ws-1', 
        targetId: 'group-2',
        position: 'end'
      }

      await act(async () => {
        const result = await store.executeDragOperation(dragOperation)
        
        expect(result.success).toBe(false)
        expect(result.error).toBe('Workspace ws-1 is already in a group')
      })

      // Should not trigger auto-save on failure
      expect(mockAutoSave.scheduleWorkspaceUpdate).not.toHaveBeenCalled()
      expect(mockAutoSave.scheduleGroupUpdate).not.toHaveBeenCalled()
    })

    it('should batch multiple drag operations efficiently', async () => {
      const operations: DragOperation[] = [
        {
          type: 'workspace-to-group',
          sourceId: 'ws-1',
          targetId: 'group-1',
          position: 'end'
        },
        {
          type: 'workspace-to-group', 
          sourceId: 'ws-2',
          targetId: 'group-1',
          position: 'end'
        },
        {
          type: 'workspace-to-group',
          sourceId: 'ws-3',
          targetId: 'group-2',
          position: 'end'
        }
      ]

      // Mock successful operations
      mockDatabase.executeDragOperation
        .mockResolvedValueOnce({
          success: true,
          operation: 'workspace-added-to-group',
          groupId: 'group-1'
        })
        .mockResolvedValueOnce({
          success: true,
          operation: 'workspace-added-to-group',
          groupId: 'group-1'
        })
        .mockResolvedValueOnce({
          success: true,
          operation: 'workspace-added-to-group',
          groupId: 'group-2'
        })

      await act(async () => {
        const results = await store.batchExecuteDragOperations(operations)
        
        expect(results).toHaveLength(3)
        expect(results.every(r => r.success)).toBe(true)
      })

      expect(mockDatabase.executeDragOperation).toHaveBeenCalledTimes(3)
      
      // Auto-save should be scheduled for all affected workspaces and groups
      expect(mockAutoSave.scheduleWorkspaceUpdate).toHaveBeenCalledTimes(3)
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith('group-1')
      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith('group-2')
    })
  })

  describe('Data Loading & Caching', () => {
    it('should load workspace grouping data on initialization', async () => {
      const mockGroups: WorkspaceGroup[] = [
        {
          id: 'group-1',
          name: 'Development',
          color: 'blue',
          isExpanded: true,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const mockWorkspaces = [
        {
          id: 'ws-1',
          name: 'Project A',
          emoji: '📁',
          color: '#3b82f6',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false
        }
      ]

      const mockMappings = [
        {
          workspaceId: 'ws-1',
          groupId: 'group-1',
          orderInGroup: 0,
          createdAt: new Date()
        }
      ]

      mockDatabase.getAllGroups.mockResolvedValue(mockGroups)
      mockDatabase.getAllWorkspaces.mockResolvedValue(mockWorkspaces)
      mockDatabase.getAllGroupMappings.mockResolvedValue(mockMappings)

      await act(async () => {
        await store.loadWorkspaceGroupingData()
      })

      expect(mockDatabase.getAllGroups).toHaveBeenCalled()
      expect(mockDatabase.getAllWorkspaces).toHaveBeenCalled()
      expect(mockDatabase.getAllGroupMappings).toHaveBeenCalled()

      // Verify state was updated
      expect(store.workspaceGroups).toHaveLength(1)
      expect(store.workspaceGroups[0].id).toBe('group-1')
    })

    it('should cache grouped workspace data for performance', async () => {
      const mockGroups: WorkspaceGroup[] = [
        {
          id: 'group-1',
          name: 'Development',
          color: 'blue',
          isExpanded: true,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const mockWorkspaces = [
        {
          id: 'ws-1',
          name: 'Project A',
          emoji: '📁',
          color: '#3b82f6',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false
        }
      ]

      const mockMappings = [
        {
          workspaceId: 'ws-1',
          groupId: 'group-1',
          orderInGroup: 0,
          createdAt: new Date()
        }
      ]

      mockDatabase.getAllGroups.mockResolvedValue(mockGroups)
      mockDatabase.getAllWorkspaces.mockResolvedValue(mockWorkspaces)
      mockDatabase.getAllGroupMappings.mockResolvedValue(mockMappings)

      await act(async () => {
        await store.loadWorkspaceGroupingData()
      })

      // Access cached data multiple times
      const groupedData1 = store.getGroupedWorkspaces()
      const groupedData2 = store.getGroupedWorkspaces()
      const groupedData3 = store.getGroupedWorkspaces()

      // Should return the same cached object
      expect(groupedData1).toBe(groupedData2)
      expect(groupedData2).toBe(groupedData3)

      // Database should only be called once during initial load
      expect(mockDatabase.getAllGroups).toHaveBeenCalledTimes(1)
      expect(mockDatabase.getAllWorkspaces).toHaveBeenCalledTimes(1)
      expect(mockDatabase.getAllGroupMappings).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache when data changes', async () => {
      // Initial load
      mockDatabase.getAllGroups.mockResolvedValue([])
      mockDatabase.getAllWorkspaces.mockResolvedValue([])
      mockDatabase.getAllGroupMappings.mockResolvedValue([])

      await act(async () => {
        await store.loadWorkspaceGroupingData()
      })

      const initialCache = store.getGroupedWorkspaces()

      // Modify data - should invalidate cache
      const newGroup: WorkspaceGroup = {
        id: 'new-group',
        name: 'New Group',
        color: 'green',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDatabase.createGroup.mockResolvedValue({
        success: true,
        data: newGroup,
        operation: 'group-created'
      })

      await act(async () => {
        await store.createWorkspaceGroup({
          name: 'New Group',
          color: 'green' as WorkspaceGroupColor
        })
      })

      const newCache = store.getGroupedWorkspaces()

      // Cache should be different after modification
      expect(newCache).not.toBe(initialCache)
    })

    it('should handle loading errors gracefully', async () => {
      mockDatabase.getAllGroups.mockRejectedValue(new Error('Database connection failed'))
      mockDatabase.getAllWorkspaces.mockResolvedValue([])
      mockDatabase.getAllGroupMappings.mockResolvedValue([])

      await act(async () => {
        const result = await store.loadWorkspaceGroupingData()
        
        expect(result.success).toBe(false)
        expect(result.error).toBe('Database connection failed')
      })

      // Should maintain empty state on failure
      expect(store.workspaceGroups).toHaveLength(0)
      expect(store.groupingError).toBeTruthy()
    })
  })

  describe('Auto-Save Integration', () => {
    it('should integrate with auto-save engine for group operations', async () => {
      const mockGroup: WorkspaceGroup = {
        id: 'autosave-group',
        name: 'Auto-save Test',
        color: 'purple',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDatabase.createGroup.mockResolvedValue({
        success: true,
        data: mockGroup,
        operation: 'group-created'
      })

      mockAutoSave.isEnabled.mockReturnValue(true)

      await act(async () => {
        await store.createWorkspaceGroup({
          name: 'Auto-save Test',
          color: 'purple' as WorkspaceGroupColor
        })
      })

      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith(mockGroup.id)
    })

    it('should skip auto-save when disabled', async () => {
      const mockGroup: WorkspaceGroup = {
        id: 'no-autosave-group',
        name: 'No Auto-save Test',
        color: 'orange',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDatabase.createGroup.mockResolvedValue({
        success: true,
        data: mockGroup,
        operation: 'group-created'
      })

      mockAutoSave.isEnabled.mockReturnValue(false)

      await act(async () => {
        await store.createWorkspaceGroup({
          name: 'No Auto-save Test',
          color: 'orange' as WorkspaceGroupColor
        })
      })

      expect(mockAutoSave.scheduleGroupUpdate).not.toHaveBeenCalled()
    })

    it('should handle auto-save failures gracefully', async () => {
      const mockGroup: WorkspaceGroup = {
        id: 'autosave-fail-group',
        name: 'Auto-save Fail Test',
        color: 'red',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDatabase.createGroup.mockResolvedValue({
        success: true,
        data: mockGroup,
        operation: 'group-created'
      })

      mockAutoSave.scheduleGroupUpdate.mockRejectedValue(new Error('Auto-save failed'))

      await act(async () => {
        const result = await store.createWorkspaceGroup({
          name: 'Auto-save Fail Test',
          color: 'red' as WorkspaceGroupColor
        })
        
        // Operation should still succeed even if auto-save fails
        expect(result.success).toBe(true)
      })

      expect(mockAutoSave.scheduleGroupUpdate).toHaveBeenCalledWith(mockGroup.id)
    })
  })

  describe('Error Handling & Recovery', () => {
    it('should handle concurrent operation conflicts', async () => {
      mockDatabase.executeDragOperation
        .mockRejectedValueOnce(new Error('Workspace ws-1 is already in a group'))
        .mockResolvedValueOnce({
          success: true,
          operation: 'workspace-added-to-group',
          groupId: 'group-1'
        })

      const dragOperation: DragOperation = {
        type: 'workspace-to-group',
        sourceId: 'ws-1',
        targetId: 'group-1',
        position: 'end'
      }

      await act(async () => {
        // First attempt fails
        const result1 = await store.executeDragOperation(dragOperation)
        expect(result1.success).toBe(false)

        // Retry should succeed
        const result2 = await store.executeDragOperation(dragOperation)
        expect(result2.success).toBe(true)
      })

      expect(mockDatabase.executeDragOperation).toHaveBeenCalledTimes(2)
    })

    it('should validate operations before execution', async () => {
      // Invalid operation - workspace to itself
      const invalidOperation: DragOperation = {
        type: 'workspace-to-workspace',
        sourceId: 'ws-1',
        targetId: 'ws-1', // Same workspace
        position: 'combine'
      }

      await act(async () => {
        const result = await store.executeDragOperation(invalidOperation)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid drag operation')
      })

      // Database should not be called for invalid operations
      expect(mockDatabase.executeDragOperation).not.toHaveBeenCalled()
    })

    it('should recover from database disconnection', async () => {
      // Simulate database disconnection
      mockDatabase.getAllGroups.mockRejectedValue(new Error('Database unavailable'))

      await act(async () => {
        const result = await store.loadWorkspaceGroupingData()
        
        expect(result.success).toBe(false)
        expect(result.error).toBe('Database unavailable')
        expect(store.groupingError).toBeTruthy()
      })

      // Simulate reconnection
      mockDatabase.getAllGroups.mockResolvedValue([])
      mockDatabase.getAllWorkspaces.mockResolvedValue([])
      mockDatabase.getAllGroupMappings.mockResolvedValue([])

      await act(async () => {
        const result = await store.loadWorkspaceGroupingData()
        
        expect(result.success).toBe(true)
        expect(store.groupingError).toBeFalsy()
      })
    })

    it('should handle partial operation failures in batch operations', async () => {
      const operations: DragOperation[] = [
        {
          type: 'workspace-to-group',
          sourceId: 'ws-1',
          targetId: 'group-1',
          position: 'end'
        },
        {
          type: 'workspace-to-group',
          sourceId: 'ws-invalid', // This will fail
          targetId: 'group-1',
          position: 'end'
        },
        {
          type: 'workspace-to-group',
          sourceId: 'ws-3',
          targetId: 'group-2',
          position: 'end'
        }
      ]

      mockDatabase.executeDragOperation
        .mockResolvedValueOnce({ success: true, operation: 'workspace-added-to-group' })
        .mockResolvedValueOnce({ success: false, error: 'Workspace not found', operation: 'failed' })
        .mockResolvedValueOnce({ success: true, operation: 'workspace-added-to-group' })

      await act(async () => {
        const results = await store.batchExecuteDragOperations(operations)
        
        expect(results).toHaveLength(3)
        expect(results[0].success).toBe(true)
        expect(results[1].success).toBe(false)
        expect(results[2].success).toBe(true)
      })

      // Only successful operations should trigger auto-save
      expect(mockAutoSave.scheduleWorkspaceUpdate).toHaveBeenCalledTimes(2)
      expect(mockAutoSave.scheduleWorkspaceUpdate).toHaveBeenCalledWith('ws-1')
      expect(mockAutoSave.scheduleWorkspaceUpdate).toHaveBeenCalledWith('ws-3')
    })
  })
})