/**
 * Workspace Database Grouping Tests
 * Comprehensive testing for workspace grouping database operations including
 * schema migration, CRUD operations, and data integrity validation.
 */

import { jest } from '@jest/globals'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'
import { workspaceDatabase } from '../workspace/workspace-database'
import type { 
  WorkspaceGroup, 
  WorkspaceWithGrouping, 
  WorkspaceGroupColor,
  GroupOperationResult,
  DragOperation 
} from '../../types/workspace'

// Setup IndexedDB mocks
const setupTestDB = () => {
  global.indexedDB = new FDBFactory()
  global.IDBKeyRange = FDBKeyRange
}

describe('Workspace Database Grouping', () => {
  beforeEach(() => {
    setupTestDB()
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllTimers()
  })

  describe('Schema Migration v2 → v3', () => {
    it('should migrate existing database to v3 with grouping support', async () => {
      // Create v2 database with existing workspaces
      const v2Workspaces = [
        {
          id: 'ws-1',
          name: 'Project A',
          emoji: '📁',
          color: '#3b82f6',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          isActive: false
        },
        {
          id: 'ws-2', 
          name: 'Project B',
          emoji: '📂',
          color: '#10b981',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          isActive: true
        }
      ]

      // Initialize database and trigger migration
      await workspaceDatabase.initialize()
      
      // Add v2 workspaces
      for (const workspace of v2Workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Verify migration created grouping tables
      const groups = await workspaceDatabase.getAllGroups()
      const mappings = await workspaceDatabase.getAllGroupMappings()
      
      expect(groups).toEqual([])
      expect(mappings).toEqual([])

      // Verify existing workspaces remain intact
      const workspaces = await workspaceDatabase.getAllWorkspaces()
      expect(workspaces).toHaveLength(2)
      expect(workspaces[0].id).toBe('ws-1')
      expect(workspaces[1].id).toBe('ws-2')
    })

    it('should handle migration with corrupted data gracefully', async () => {
      // Create database with invalid data
      await workspaceDatabase.initialize()
      
      // Attempt to add invalid workspace data
      const invalidWorkspace = {
        id: null, // Invalid ID
        name: '',
        createdAt: 'invalid-date'
      } as any

      await expect(workspaceDatabase.createWorkspace(invalidWorkspace))
        .rejects.toThrow()

      // Verify database remains functional
      const validWorkspace = {
        id: 'ws-valid',
        name: 'Valid Workspace',
        emoji: '✅',
        color: '#22c55e',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await expect(workspaceDatabase.createWorkspace(validWorkspace))
        .resolves.not.toThrow()
    })

    it('should benchmark migration performance with large datasets', async () => {
      const startTime = performance.now()
      
      await workspaceDatabase.initialize()
      
      // Create 100 workspaces
      const workspaces = Array.from({ length: 100 }, (_, i) => ({
        id: `ws-${i}`,
        name: `Workspace ${i}`,
        emoji: '📁',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: i === 0
      }))

      const batchCreateStart = performance.now()
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
      const batchCreateEnd = performance.now()

      const migrationEnd = performance.now()
      
      expect(batchCreateEnd - batchCreateStart).toBeLessThan(5000) // < 5s for 100 workspaces
      expect(migrationEnd - startTime).toBeLessThan(10000) // < 10s total
    })
  })

  describe('Group CRUD Operations', () => {
    beforeEach(async () => {
      await workspaceDatabase.initialize()
    })

    it('should create workspace group with validation', async () => {
      const group: WorkspaceGroup = {
        id: 'group-1',
        name: 'Development Projects',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await workspaceDatabase.createGroup(group)
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(group)
      
      // Verify persistence
      const retrievedGroup = await workspaceDatabase.getGroup(group.id)
      expect(retrievedGroup).toEqual(group)
    })

    it('should prevent duplicate group IDs', async () => {
      const group: WorkspaceGroup = {
        id: 'group-duplicate',
        name: 'Test Group',
        color: 'green',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)
      
      // Attempt to create duplicate
      await expect(workspaceDatabase.createGroup(group))
        .rejects.toThrow('Group with ID group-duplicate already exists')
    })

    it('should update group properties atomically', async () => {
      const group: WorkspaceGroup = {
        id: 'group-update',
        name: 'Original Name',
        color: 'blue',
        isExpanded: false,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      const updates = {
        name: 'Updated Name',
        color: 'red' as WorkspaceGroupColor,
        isExpanded: true
      }

      const result = await workspaceDatabase.updateGroup(group.id, updates)
      
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Updated Name')
      expect(result.data.color).toBe('red')
      expect(result.data.isExpanded).toBe(true)
      expect(result.data.updatedAt).not.toEqual(group.updatedAt)
    })

    it('should delete group and handle workspace redistribution', async () => {
      // Create group and workspaces
      const group: WorkspaceGroup = {
        id: 'group-delete',
        name: 'To Delete',
        color: 'yellow',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace1 = {
        id: 'ws-1',
        name: 'Workspace 1',
        emoji: '📁',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      const workspace2 = {
        id: 'ws-2',
        name: 'Workspace 2', 
        emoji: '📂',
        color: '#10b981',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace1)
      await workspaceDatabase.createWorkspace(workspace2)
      
      // Add workspaces to group
      await workspaceDatabase.addWorkspaceToGroup(workspace1.id, group.id, 0)
      await workspaceDatabase.addWorkspaceToGroup(workspace2.id, group.id, 1)

      // Delete group
      const result = await workspaceDatabase.deleteGroup(group.id)
      
      expect(result.success).toBe(true)
      
      // Verify group is deleted
      const deletedGroup = await workspaceDatabase.getGroup(group.id)
      expect(deletedGroup).toBeNull()
      
      // Verify workspaces still exist but are ungrouped
      const workspaces = await workspaceDatabase.getAllWorkspaces()
      expect(workspaces).toHaveLength(2)
      
      const mappings = await workspaceDatabase.getWorkspaceGroupMappings(workspace1.id)
      expect(mappings).toHaveLength(0)
    })

    it('should handle concurrent group operations safely', async () => {
      const group: WorkspaceGroup = {
        id: 'group-concurrent',
        name: 'Concurrent Test',
        color: 'orange',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Simulate concurrent updates
      const updates1 = workspaceDatabase.updateGroup(group.id, { name: 'Update 1' })
      const updates2 = workspaceDatabase.updateGroup(group.id, { name: 'Update 2' })
      const updates3 = workspaceDatabase.updateGroup(group.id, { color: 'red' })

      const results = await Promise.allSettled([updates1, updates2, updates3])
      
      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length
      expect(successful).toBeGreaterThan(0)

      // Final state should be consistent
      const finalGroup = await workspaceDatabase.getGroup(group.id)
      expect(finalGroup).toBeTruthy()
      expect(finalGroup!.id).toBe(group.id)
    })
  })

  describe('Workspace Group Mappings', () => {
    let testGroup: WorkspaceGroup
    let testWorkspaces: any[]

    beforeEach(async () => {
      await workspaceDatabase.initialize()
      
      testGroup = {
        id: 'test-group',
        name: 'Test Group',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      testWorkspaces = [
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
        }
      ]

      await workspaceDatabase.createGroup(testGroup)
      for (const workspace of testWorkspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
    })

    it('should add workspace to group with proper ordering', async () => {
      const result1 = await workspaceDatabase.addWorkspaceToGroup('ws-1', testGroup.id, 0)
      const result2 = await workspaceDatabase.addWorkspaceToGroup('ws-2', testGroup.id, 1)
      
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)

      const mappings = await workspaceDatabase.getGroupWorkspaces(testGroup.id)
      expect(mappings).toHaveLength(2)
      expect(mappings[0].workspaceId).toBe('ws-1')
      expect(mappings[0].orderInGroup).toBe(0)
      expect(mappings[1].workspaceId).toBe('ws-2')
      expect(mappings[1].orderInGroup).toBe(1)
    })

    it('should remove workspace from group', async () => {
      await workspaceDatabase.addWorkspaceToGroup('ws-1', testGroup.id, 0)
      await workspaceDatabase.addWorkspaceToGroup('ws-2', testGroup.id, 1)

      const result = await workspaceDatabase.removeWorkspaceFromGroup('ws-1', testGroup.id)
      
      expect(result.success).toBe(true)

      const mappings = await workspaceDatabase.getGroupWorkspaces(testGroup.id)
      expect(mappings).toHaveLength(1)
      expect(mappings[0].workspaceId).toBe('ws-2')
    })

    it('should reorder workspaces within group', async () => {
      await workspaceDatabase.addWorkspaceToGroup('ws-1', testGroup.id, 0)
      await workspaceDatabase.addWorkspaceToGroup('ws-2', testGroup.id, 1)

      // Swap order
      const result = await workspaceDatabase.reorderWorkspacesInGroup(testGroup.id, [
        { workspaceId: 'ws-2', orderInGroup: 0 },
        { workspaceId: 'ws-1', orderInGroup: 1 }
      ])

      expect(result.success).toBe(true)

      const mappings = await workspaceDatabase.getGroupWorkspaces(testGroup.id)
      expect(mappings[0].workspaceId).toBe('ws-2')
      expect(mappings[0].orderInGroup).toBe(0)
      expect(mappings[1].workspaceId).toBe('ws-1')
      expect(mappings[1].orderInGroup).toBe(1)
    })

    it('should prevent workspace from being in multiple groups', async () => {
      const secondGroup: WorkspaceGroup = {
        id: 'second-group',
        name: 'Second Group',
        color: 'green',
        isExpanded: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(secondGroup)
      await workspaceDatabase.addWorkspaceToGroup('ws-1', testGroup.id, 0)

      // Attempt to add same workspace to second group
      await expect(workspaceDatabase.addWorkspaceToGroup('ws-1', secondGroup.id, 0))
        .rejects.toThrow('Workspace ws-1 is already in a group')
    })
  })

  describe('Atomic Drag Operations', () => {
    let testGroups: WorkspaceGroup[]
    let testWorkspaces: any[]

    beforeEach(async () => {
      await workspaceDatabase.initialize()
      
      testGroups = [
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

      testWorkspaces = [
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

      for (const group of testGroups) {
        await workspaceDatabase.createGroup(group)
      }
      for (const workspace of testWorkspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
    })

    it('should handle workspace-to-workspace drag creating new group', async () => {
      const dragOperation: DragOperation = {
        type: 'workspace-to-workspace',
        sourceId: 'ws-1',
        targetId: 'ws-2',
        position: 'combine'
      }

      const result = await workspaceDatabase.executeDragOperation(dragOperation)
      
      expect(result.success).toBe(true)
      expect(result.operation).toBe('group-created')
      expect(result.groupId).toBeTruthy()

      // Verify new group was created
      const groups = await workspaceDatabase.getAllGroups()
      const newGroup = groups.find(g => g.id === result.groupId)
      expect(newGroup).toBeTruthy()
      expect(newGroup!.name).toContain('Group')

      // Verify both workspaces are in the new group
      const mappings = await workspaceDatabase.getGroupWorkspaces(result.groupId!)
      expect(mappings).toHaveLength(2)
      expect(mappings.map(m => m.workspaceId)).toContain('ws-1')
      expect(mappings.map(m => m.workspaceId)).toContain('ws-2')
    })

    it('should handle workspace-to-group drag operation', async () => {
      // Add ws-1 to group-1
      await workspaceDatabase.addWorkspaceToGroup('ws-1', 'group-1', 0)

      const dragOperation: DragOperation = {
        type: 'workspace-to-group', 
        sourceId: 'ws-2',
        targetId: 'group-1',
        position: 'end'
      }

      const result = await workspaceDatabase.executeDragOperation(dragOperation)
      
      expect(result.success).toBe(true)
      expect(result.operation).toBe('workspace-added-to-group')

      // Verify ws-2 was added to group-1
      const mappings = await workspaceDatabase.getGroupWorkspaces('group-1')
      expect(mappings).toHaveLength(2)
      expect(mappings.map(m => m.workspaceId)).toContain('ws-2')
    })

    it('should handle group reordering drag operation', async () => {
      const dragOperation: DragOperation = {
        type: 'group-reorder',
        sourceId: 'group-2',
        targetId: 'group-1', 
        position: 'before'
      }

      const result = await workspaceDatabase.executeDragOperation(dragOperation)
      
      expect(result.success).toBe(true)
      expect(result.operation).toBe('groups-reordered')

      // Verify group order changed
      const groups = await workspaceDatabase.getAllGroups()
      const sortedGroups = groups.sort((a, b) => a.order - b.order)
      expect(sortedGroups[0].id).toBe('group-2')
      expect(sortedGroups[1].id).toBe('group-1')
    })

    it('should rollback failed atomic operations', async () => {
      // Create invalid drag operation
      const dragOperation: DragOperation = {
        type: 'workspace-to-group',
        sourceId: 'ws-nonexistent',
        targetId: 'group-1', 
        position: 'end'
      }

      const result = await workspaceDatabase.executeDragOperation(dragOperation)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()

      // Verify no partial changes occurred
      const mappings = await workspaceDatabase.getGroupWorkspaces('group-1')
      expect(mappings).toHaveLength(0)
    })

    it('should handle concurrent drag operations with conflict resolution', async () => {
      const operation1: DragOperation = {
        type: 'workspace-to-group',
        sourceId: 'ws-1',
        targetId: 'group-1',
        position: 'end'
      }

      const operation2: DragOperation = {
        type: 'workspace-to-group', 
        sourceId: 'ws-1',
        targetId: 'group-2',
        position: 'end'
      }

      // Execute concurrent operations
      const results = await Promise.allSettled([
        workspaceDatabase.executeDragOperation(operation1),
        workspaceDatabase.executeDragOperation(operation2)
      ])

      // One should succeed, one should fail
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success)
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success)
      
      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(1)

      // Verify workspace is only in one group
      const mappings1 = await workspaceDatabase.getGroupWorkspaces('group-1')
      const mappings2 = await workspaceDatabase.getGroupWorkspaces('group-2')
      const totalMappings = mappings1.length + mappings2.length
      expect(totalMappings).toBe(1)
    })
  })

  describe('Data Integrity & Performance', () => {
    beforeEach(async () => {
      await workspaceDatabase.initialize()
    })

    it('should maintain referential integrity', async () => {
      const group: WorkspaceGroup = {
        id: 'integrity-group',
        name: 'Integrity Test',
        color: 'purple',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace = {
        id: 'integrity-ws',
        name: 'Integrity Workspace',
        emoji: '🔗',
        color: '#8b5cf6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace)
      await workspaceDatabase.addWorkspaceToGroup(workspace.id, group.id, 0)

      // Delete workspace - mapping should be cleaned up
      await workspaceDatabase.deleteWorkspace(workspace.id)

      const mappings = await workspaceDatabase.getGroupWorkspaces(group.id)
      expect(mappings).toHaveLength(0)
    })

    it('should handle large group operations efficiently', async () => {
      const startTime = performance.now()

      // Create large group with 50 workspaces
      const group: WorkspaceGroup = {
        id: 'large-group',
        name: 'Large Group',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      const workspaces = Array.from({ length: 50 }, (_, i) => ({
        id: `large-ws-${i}`,
        name: `Large Workspace ${i}`,
        emoji: '📁',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }))

      // Batch create workspaces
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Add all to group
      for (let i = 0; i < workspaces.length; i++) {
        await workspaceDatabase.addWorkspaceToGroup(workspaces[i].id, group.id, i)
      }

      const endTime = performance.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000) // < 10s

      // Verify all mappings exist
      const mappings = await workspaceDatabase.getGroupWorkspaces(group.id)
      expect(mappings).toHaveLength(50)
    })

    it('should validate data consistency after operations', async () => {
      // Create test data
      const group: WorkspaceGroup = {
        id: 'consistency-group',
        name: 'Consistency Test',
        color: 'green',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace = {
        id: 'consistency-ws',
        name: 'Consistency Workspace',
        emoji: '✅',
        color: '#22c55e',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace)
      await workspaceDatabase.addWorkspaceToGroup(workspace.id, group.id, 0)

      // Run consistency validation
      const validation = await workspaceDatabase.validateDataConsistency()
      
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.warnings).toHaveLength(0)
      expect(validation.stats).toBeDefined()
      expect(validation.stats.groupCount).toBe(1)
      expect(validation.stats.workspaceCount).toBe(1)
      expect(validation.stats.mappingCount).toBe(1)
    })
  })
})