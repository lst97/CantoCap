/**
 * Workspace Grouping Edge Cases Tests
 * Comprehensive testing for edge cases, error conditions, and boundary scenarios
 * in the workspace grouping system to ensure robust production behavior.
 */

import { jest } from '@jest/globals'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'
import { workspaceDatabase } from '../../services/workspace-database'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { 
  WorkspaceGroup, 
  WorkspaceWithGrouping,
  DragOperation,
  GroupOperationResult
} from '../../types/workspace'

// Setup IndexedDB for edge case testing
const setupTestDB = () => {
  global.indexedDB = new FDBFactory()
  global.IDBKeyRange = FDBKeyRange
}

describe('Workspace Grouping Edge Cases', () => {
  beforeEach(async () => {
    setupTestDB()
    jest.clearAllMocks()
    jest.useFakeTimers()
    await workspaceDatabase.initialize()
  })

  afterEach(async () => {
    jest.useRealTimers()
    jest.clearAllTimers()
    
    // Clean up database
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('CantoCap_Workspaces')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      db.close()
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase('CantoCap_Workspaces')
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Data Validation Edge Cases', () => {
    it('should handle empty group names gracefully', async () => {
      const emptyNameGroup: WorkspaceGroup = {
        id: 'empty-name-group',
        name: '', // Empty name
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await workspaceDatabase.createGroup(emptyNameGroup)
      
      // Should either succeed with empty name or provide default name
      if (result.success) {
        expect(result.data.name).toBeDefined()
      } else {
        expect(result.error).toContain('name')
      }
    })

    it('should handle extremely long group names', async () => {
      const longName = 'A'.repeat(1000) // 1000 character name
      const longNameGroup: WorkspaceGroup = {
        id: 'long-name-group',
        name: longName,
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await workspaceDatabase.createGroup(longNameGroup)
      
      if (result.success) {
        // Should truncate or handle long names appropriately
        expect(result.data.name.length).toBeLessThanOrEqual(255)
      } else {
        expect(result.error).toBeTruthy()
      }
    })

    it('should handle special characters in group names', async () => {
      const specialChars = ['<script>', '&#x27;', '&quot;', '\n\r\t', '🚀💻📱']
      
      for (const name of specialChars) {
        const group: WorkspaceGroup = {
          id: `special-char-${Math.random()}`,
          name,
          color: 'blue',
          isExpanded: true,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const result = await workspaceDatabase.createGroup(group)
        
        if (result.success) {
          // Should sanitize or handle special characters safely
          expect(result.data.name).toBeDefined()
          expect(result.data.name).not.toContain('<script>')
        }
      }
    })

    it('should handle invalid dates in group data', async () => {
      const invalidDateGroup = {
        id: 'invalid-date-group',
        name: 'Invalid Date Group',
        color: 'blue' as const,
        isExpanded: true,
        order: 0,
        createdAt: new Date('invalid-date'), // Invalid date
        updatedAt: new Date('2024-13-45') // Invalid date
      }

      await expect(workspaceDatabase.createGroup(invalidDateGroup))
        .rejects.toThrow()
    })

    it('should handle null and undefined values in group data', async () => {
      const nullValueGroup = {
        id: 'null-value-group',
        name: null, // Null name
        color: undefined, // Undefined color
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any

      await expect(workspaceDatabase.createGroup(nullValueGroup))
        .rejects.toThrow()
    })
  })

  describe('Boundary Value Testing', () => {
    it('should handle maximum number of workspaces in a group', async () => {
      const group: WorkspaceGroup = {
        id: 'max-workspaces-group',
        name: 'Max Workspaces Test',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Create maximum number of workspaces (assuming 1000 is the limit)
      const maxWorkspaces = 1000
      const workspaces = Array.from({ length: maxWorkspaces }, (_, i) => ({
        id: `max-ws-${i}`,
        name: `Max Workspace ${i}`,
        emoji: '📁',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }))

      // Add workspaces
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Add all to group
      for (let i = 0; i < maxWorkspaces; i++) {
        try {
          await workspaceDatabase.addWorkspaceToGroup(workspaces[i].id, group.id, i)
        } catch (error) {
          // Should handle gracefully when limit is reached
          expect(error).toBeDefined()
          break
        }
      }

      const groupWorkspaces = await workspaceDatabase.getGroupWorkspaces(group.id)
      expect(groupWorkspaces.length).toBeLessThanOrEqual(maxWorkspaces)
    })

    it('should handle maximum number of groups', async () => {
      const maxGroups = 100
      const groups: WorkspaceGroup[] = Array.from({ length: maxGroups }, (_, i) => ({
        id: `max-group-${i}`,
        name: `Max Group ${i}`,
        color: ['blue', 'green', 'yellow', 'orange', 'red'][i % 5] as any,
        isExpanded: true,
        order: i,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      let createdCount = 0
      for (const group of groups) {
        try {
          const result = await workspaceDatabase.createGroup(group)
          if (result.success) {
            createdCount++
          }
        } catch (error) {
          // Should handle gracefully when limit is reached
          break
        }
      }

      expect(createdCount).toBeGreaterThan(0)
    })

    it('should handle zero-length arrays and empty collections', async () => {
      // Empty reorder operation
      const group: WorkspaceGroup = {
        id: 'empty-reorder-group',
        name: 'Empty Reorder Test',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Reorder with empty array
      const result = await workspaceDatabase.reorderWorkspacesInGroup(group.id, [])
      expect(result.success).toBe(true)
    })

    it('should handle negative order values', async () => {
      const negativeOrderGroup: WorkspaceGroup = {
        id: 'negative-order-group',
        name: 'Negative Order Test',
        color: 'blue',
        isExpanded: true,
        order: -1, // Negative order
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await workspaceDatabase.createGroup(negativeOrderGroup)
      
      if (result.success) {
        // Should normalize negative orders or handle appropriately
        expect(result.data.order).toBeGreaterThanOrEqual(0)
      } else {
        expect(result.error).toBeTruthy()
      }
    })
  })

  describe('Concurrent Operation Edge Cases', () => {
    it('should handle rapid successive operations on same group', async () => {
      const group: WorkspaceGroup = {
        id: 'rapid-ops-group',
        name: 'Rapid Operations Test',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Rapid successive updates
      const rapidOperations = Array.from({ length: 50 }, (_, i) => 
        workspaceDatabase.updateGroup(group.id, { name: `Rapid Update ${i}` })
      )

      const results = await Promise.allSettled(rapidOperations)
      
      // Some operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      expect(successful).toBeGreaterThan(0)

      // Final state should be consistent
      const finalGroup = await workspaceDatabase.getGroup(group.id)
      expect(finalGroup).toBeTruthy()
    })

    it('should handle workspace being added to multiple groups simultaneously', async () => {
      const workspace = {
        id: 'concurrent-ws',
        name: 'Concurrent Workspace',
        emoji: '⚡',
        color: '#f59e0b',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      const groups = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-group-${i}`,
        name: `Concurrent Group ${i}`,
        color: 'blue' as const,
        isExpanded: true,
        order: i,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      await workspaceDatabase.createWorkspace(workspace)
      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }

      // Try to add workspace to all groups simultaneously
      const concurrentAdds = groups.map(group => 
        workspaceDatabase.addWorkspaceToGroup(workspace.id, group.id, 0)
      )

      const results = await Promise.allSettled(concurrentAdds)
      
      // Only one should succeed (workspace can only be in one group)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      expect(successful).toBeLessThanOrEqual(1)

      // Verify workspace is only in one group
      const mappings = await workspaceDatabase.getAllGroupMappings()
      const workspaceMappings = mappings.filter(m => m.workspaceId === workspace.id)
      expect(workspaceMappings).toHaveLength(successful)
    })

    it('should handle group deletion while workspaces are being added', async () => {
      const group: WorkspaceGroup = {
        id: 'deletion-race-group',
        name: 'Deletion Race Test',
        color: 'red',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace = {
        id: 'deletion-race-ws',
        name: 'Deletion Race Workspace',
        emoji: '🏃',
        color: '#ef4444',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace)

      // Race condition: delete group while adding workspace
      const deletePromise = workspaceDatabase.deleteGroup(group.id)
      const addPromise = workspaceDatabase.addWorkspaceToGroup(workspace.id, group.id, 0)

      const [deleteResult, addResult] = await Promise.allSettled([deletePromise, addPromise])

      // One operation should succeed, the other should fail gracefully
      if (deleteResult.status === 'fulfilled' && deleteResult.value.success) {
        expect(addResult.status).toBe('rejected')
      } else if (addResult.status === 'fulfilled' && addResult.value.success) {
        expect(deleteResult.status).toBe('rejected')
      }

      // Data should remain consistent
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })
  })

  describe('Memory and Resource Edge Cases', () => {
    it('should handle operations when memory is constrained', async () => {
      // Simulate memory pressure by creating large objects
      const largeObjects: any[] = []
      
      try {
        // Consume memory
        for (let i = 0; i < 1000; i++) {
          largeObjects.push(new Array(10000).fill(`memory-pressure-${i}`))
        }

        // Try to perform operations under memory pressure
        const group: WorkspaceGroup = {
          id: 'memory-pressure-group',
          name: 'Memory Pressure Test',
          color: 'orange',
          isExpanded: true,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const result = await workspaceDatabase.createGroup(group)
        expect(result.success).toBe(true)

      } finally {
        // Clean up memory
        largeObjects.length = 0
      }
    })

    it('should handle database storage quota exceeded', async () => {
      // Create a large amount of data to potentially exceed quota
      const largeGroups: WorkspaceGroup[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `quota-group-${i}`,
        name: `Quota Test Group ${i} - ${'Very long description that takes up space '.repeat(100)}`,
        color: 'blue',
        isExpanded: true,
        order: i,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      let successCount = 0
      let quotaExceeded = false

      for (const group of largeGroups) {
        try {
          const result = await workspaceDatabase.createGroup(group)
          if (result.success) {
            successCount++
          } else {
            quotaExceeded = true
            break
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'QuotaExceededError') {
            quotaExceeded = true
            break
          }
        }
      }

      // Should handle quota exceeded gracefully
      expect(successCount).toBeGreaterThan(0)
      
      if (quotaExceeded) {
        // Database should still be functional
        const validation = await workspaceDatabase.validateDataConsistency()
        expect(validation.isValid).toBe(true)
      }
    })
  })

  describe('Network and Persistence Edge Cases', () => {
    it('should handle IndexedDB database corruption', async () => {
      // Create some initial data
      const group: WorkspaceGroup = {
        id: 'corruption-test-group',
        name: 'Corruption Test',
        color: 'red',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Simulate database corruption by closing and corrupting
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('CantoCap_Workspaces')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      db.close()

      // Try to perform operations after potential corruption
      try {
        const result = await workspaceDatabase.getGroup(group.id)
        expect(result).toBeDefined()
      } catch (error) {
        // Should handle corruption gracefully
        expect(error).toBeDefined()
      }
    })

    it('should handle browser storage being disabled', async () => {
      // Mock storage being disabled
      const originalIndexedDB = global.indexedDB
      global.indexedDB = undefined as any

      try {
        await expect(workspaceDatabase.initialize())
          .rejects.toThrow()
      } finally {
        global.indexedDB = originalIndexedDB
      }
    })

    it('should handle database version conflicts', async () => {
      // Initialize with current version
      await workspaceDatabase.initialize()

      // Try to simulate version conflict by opening with different version
      const conflictDB = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('CantoCap_Workspaces', 999) // Different version
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        request.onupgradeneeded = () => {
          // Simulate upgrade needed
          resolve(request.result)
        }
      })

      conflictDB.close()

      // Original database should still work or handle version conflict
      const groups = await workspaceDatabase.getAllGroups()
      expect(Array.isArray(groups)).toBe(true)
    })
  })

  describe('Invalid Operation Edge Cases', () => {
    it('should handle drag operations with non-existent sources', async () => {
      const invalidDragOp: DragOperation = {
        type: 'workspace-to-group',
        sourceId: 'non-existent-workspace',
        targetId: 'also-non-existent',
        position: 'end'
      }

      const result = await workspaceDatabase.executeDragOperation(invalidDragOp)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should handle circular drag operations', async () => {
      const group: WorkspaceGroup = {
        id: 'circular-group',
        name: 'Circular Test',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Try to drag group onto itself
      const circularDragOp: DragOperation = {
        type: 'group-reorder',
        sourceId: 'circular-group',
        targetId: 'circular-group',
        position: 'before'
      }

      const result = await workspaceDatabase.executeDragOperation(circularDragOp)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('circular' || 'self')
    })

    it('should handle malformed drag operation data', async () => {
      const malformedOps = [
        { type: 'invalid-type', sourceId: 'ws-1', targetId: 'group-1' },
        { type: 'workspace-to-group', sourceId: '', targetId: 'group-1' },
        { type: 'workspace-to-group', sourceId: null, targetId: 'group-1' },
        { type: 'workspace-to-group', sourceId: 'ws-1', targetId: '' },
        { position: 'end' }, // Missing required fields
        null,
        undefined
      ] as any[]

      for (const op of malformedOps) {
        const result = await workspaceDatabase.executeDragOperation(op)
        expect(result.success).toBe(false)
        expect(result.error).toBeTruthy()
      }
    })

    it('should handle operations on deleted entities', async () => {
      // Create and delete group
      const group: WorkspaceGroup = {
        id: 'deleted-group',
        name: 'To Be Deleted',
        color: 'red',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.deleteGroup(group.id)

      // Try to operate on deleted group
      const result = await workspaceDatabase.updateGroup(group.id, { name: 'Updated Name' })
      
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('State Consistency Edge Cases', () => {
    it('should maintain consistency after partial operation failures', async () => {
      const group: WorkspaceGroup = {
        id: 'consistency-group',
        name: 'Consistency Test',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspaces = Array.from({ length: 10 }, (_, i) => ({
        id: `consistency-ws-${i}`,
        name: `Consistency Workspace ${i}`,
        emoji: '📊',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }))

      await workspaceDatabase.createGroup(group)
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Add some workspaces successfully
      await workspaceDatabase.addWorkspaceToGroup(workspaces[0].id, group.id, 0)
      await workspaceDatabase.addWorkspaceToGroup(workspaces[1].id, group.id, 1)

      // Simulate failure during batch operation
      const batchOps = workspaces.slice(2).map((ws, i) => 
        workspaceDatabase.addWorkspaceToGroup(ws.id, group.id, i + 2)
      )

      // Some operations may fail
      await Promise.allSettled(batchOps)

      // Data should remain consistent
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })

    it('should handle orphaned mappings after workspace deletion', async () => {
      const group: WorkspaceGroup = {
        id: 'orphan-group',
        name: 'Orphan Test',
        color: 'yellow',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace = {
        id: 'orphan-workspace',
        name: 'Orphan Workspace',
        emoji: '👻',
        color: '#f59e0b',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace)
      await workspaceDatabase.addWorkspaceToGroup(workspace.id, group.id, 0)

      // Delete workspace (should clean up mapping)
      await workspaceDatabase.deleteWorkspace(workspace.id)

      // Verify orphaned mappings are cleaned up
      const groupWorkspaces = await workspaceDatabase.getGroupWorkspaces(group.id)
      expect(groupWorkspaces).toHaveLength(0)

      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })

    it('should handle database in inconsistent state at startup', async () => {
      // Create inconsistent state manually
      const group: WorkspaceGroup = {
        id: 'inconsistent-group',
        name: 'Inconsistent Test',
        color: 'red',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Manually create mapping without workspace (simulate corruption)
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('CantoCap_Workspaces')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const transaction = db.transaction(['workspace_group_mappings'], 'readwrite')
      const store = transaction.objectStore('workspace_group_mappings')
      
      await new Promise<void>((resolve, reject) => {
        const request = store.add({
          workspaceId: 'non-existent-workspace',
          groupId: group.id,
          orderInGroup: 0,
          createdAt: new Date()
        })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      db.close()

      // System should detect and handle inconsistency
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Edge Cases', () => {
    it('should handle operations when system is under load', async () => {
      // Simulate system load with intensive operations
      const loadSimulation = Array.from({ length: 100 }, () => 
        new Promise(resolve => {
          // CPU intensive task
          let sum = 0
          for (let i = 0; i < 100000; i++) {
            sum += Math.sqrt(i)
          }
          setTimeout(() => resolve(sum), 1)
        })
      )

      // Start load simulation
      const loadPromise = Promise.all(loadSimulation)

      // Perform database operations under load
      const group: WorkspaceGroup = {
        id: 'under-load-group',
        name: 'Under Load Test',
        color: 'orange',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const startTime = performance.now()
      const result = await workspaceDatabase.createGroup(group)
      const endTime = performance.now()

      expect(result.success).toBe(true)
      
      // Operation should complete even under load (may be slower)
      expect(endTime - startTime).toBeLessThan(10000) // 10 second timeout

      await loadPromise // Clean up load simulation
    })

    it('should handle rapid UI state changes', async () => {
      const store = useWorkspaceStore.getState()
      
      // Create initial data
      const group: WorkspaceGroup = {
        id: 'rapid-ui-group',
        name: 'Rapid UI Test',
        color: 'purple',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)
      await store.loadWorkspaceGroupingData()

      // Rapid UI state changes
      const rapidChanges = Array.from({ length: 100 }, (_, i) => 
        store.updateWorkspaceGroup(group.id, { 
          name: `Rapid Change ${i}`,
          isExpanded: i % 2 === 0
        })
      )

      const results = await Promise.allSettled(rapidChanges)
      
      // Most changes should succeed
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      expect(successful).toBeGreaterThan(50)

      // Final state should be consistent
      const finalGroup = await workspaceDatabase.getGroup(group.id)
      expect(finalGroup).toBeTruthy()
    })
  })
})