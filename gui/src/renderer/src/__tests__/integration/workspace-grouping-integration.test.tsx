/**
 * Workspace Grouping Integration Tests
 * End-to-end integration testing for the complete workspace grouping system
 * including UI components, store management, database persistence, and auto-save.
 */

import { jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import React from 'react'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'
import { workspaceDatabase } from '../../services/workspace-database'
import { useWorkspaceStore } from '../../stores/workspace-store'
// REMOVED: auto-save-engine import - timer-based auto-save system deleted
import type { 
  WorkspaceGroup, 
  WorkspaceWithGrouping,
  DragOperation,
  GroupOperationResult
} from '../../types/workspace'
import { EnhancedWorkspacePanel } from '../../components/workspace/EnhancedWorkspacePanel'

// Setup real IndexedDB for integration testing
const setupRealIndexedDB = () => {
  global.indexedDB = new FDBFactory()
  global.IDBKeyRange = FDBKeyRange
}

// Test wrapper component
const TestWorkspaceSystem: React.FC = () => {
  return (
    <div data-testid="workspace-system">
      <EnhancedWorkspacePanel />
    </div>
  )
}

describe('Workspace Grouping Integration', () => {
  beforeEach(async () => {
    setupRealIndexedDB()
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Initialize database with clean state
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

  describe('Complete Group Creation Workflow', () => {
    it('should create group through drag operation and persist to database', async () => {
      // Create initial workspaces
      const workspace1 = {
        id: 'ws-integration-1',
        name: 'Integration Test 1',
        emoji: '🧪',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      const workspace2 = {
        id: 'ws-integration-2',
        name: 'Integration Test 2',
        emoji: '⚗️',
        color: '#10b981',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      // Add workspaces to database
      await workspaceDatabase.createWorkspace(workspace1)
      await workspaceDatabase.createWorkspace(workspace2)

      // Execute drag operation to create group
      const dragOperation: DragOperation = {
        type: 'workspace-to-workspace',
        sourceId: 'ws-integration-1',
        targetId: 'ws-integration-2',
        position: 'combine'
      }

      const result = await workspaceDatabase.executeDragOperation(dragOperation)

      expect(result.success).toBe(true)
      expect(result.operation).toBe('group-created')
      expect(result.groupId).toBeTruthy()

      // Verify group was created in database
      const groups = await workspaceDatabase.getAllGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0].id).toBe(result.groupId)

      // Verify both workspaces are in the group
      const mappings = await workspaceDatabase.getGroupWorkspaces(result.groupId!)
      expect(mappings).toHaveLength(2)
      expect(mappings.map(m => m.workspaceId)).toContain('ws-integration-1')
      expect(mappings.map(m => m.workspaceId)).toContain('ws-integration-2')
    })

    it('should update UI state after group creation', async () => {
      // This would require a more complex setup with actual React components
      // For now, we test the store integration directly
      
      const workspace1 = {
        id: 'ws-ui-1',
        name: 'UI Test 1',
        emoji: '💻',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      const workspace2 = {
        id: 'ws-ui-2',
        name: 'UI Test 2',
        emoji: '🖥️',
        color: '#10b981',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createWorkspace(workspace1)
      await workspaceDatabase.createWorkspace(workspace2)

      // Simulate store group creation
      const store = useWorkspaceStore.getState()
      
      const result = await store.createWorkspaceGroup({
        name: 'UI Integration Group',
        color: 'blue'
      })

      expect(result.success).toBe(true)

      // Add workspaces to the group
      await store.executeDragOperation({
        type: 'workspace-to-group',
        sourceId: 'ws-ui-1',
        targetId: result.data.id,
        position: 'end'
      })

      await store.executeDragOperation({
        type: 'workspace-to-group',
        sourceId: 'ws-ui-2',
        targetId: result.data.id,
        position: 'end'
      })

      // Verify store state is updated
      const groupedData = store.getGroupedWorkspaces()
      expect(groupedData.groups).toHaveLength(1)
      expect(groupedData.groups[0].workspaces).toHaveLength(2)
    })
  })

  describe('Auto-Save Integration', () => {
    it('should trigger auto-save after group operations', async () => {
      const autoSaveSpy = jest.spyOn(autoSaveEngine, 'scheduleGroupUpdate')
        .mockResolvedValue(undefined)

      const group: WorkspaceGroup = {
        id: 'autosave-integration-group',
        name: 'Auto-save Integration',
        color: 'green',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Verify auto-save was triggered
      expect(autoSaveSpy).toHaveBeenCalledWith(group.id)

      autoSaveSpy.mockRestore()
    })

    it('should handle auto-save failures gracefully', async () => {
      const autoSaveSpy = jest.spyOn(autoSaveEngine, 'scheduleGroupUpdate')
        .mockRejectedValue(new Error('Auto-save failed'))

      const group: WorkspaceGroup = {
        id: 'autosave-fail-group',
        name: 'Auto-save Fail Test',
        color: 'red',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Operation should still succeed even if auto-save fails
      await expect(workspaceDatabase.createGroup(group))
        .resolves.not.toThrow()

      // Verify group was created despite auto-save failure
      const retrievedGroup = await workspaceDatabase.getGroup(group.id)
      expect(retrievedGroup).toEqual(group)

      autoSaveSpy.mockRestore()
    })

    it('should batch auto-save operations for multiple changes', async () => {
      const autoSaveSpy = jest.spyOn(autoSaveEngine, 'scheduleGroupUpdate')
        .mockResolvedValue(undefined)
      
      const workspaceSpy = jest.spyOn(autoSaveEngine, 'scheduleWorkspaceUpdate')
        .mockResolvedValue(undefined)

      // Create group and workspaces
      const group: WorkspaceGroup = {
        id: 'batch-group',
        name: 'Batch Operations',
        color: 'purple',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace1 = {
        id: 'batch-ws-1',
        name: 'Batch Workspace 1',
        emoji: '📦',
        color: '#8b5cf6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      const workspace2 = {
        id: 'batch-ws-2',
        name: 'Batch Workspace 2',
        emoji: '📫',
        color: '#8b5cf6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace1)
      await workspaceDatabase.createWorkspace(workspace2)

      // Add both workspaces to group in sequence
      await workspaceDatabase.addWorkspaceToGroup(workspace1.id, group.id, 0)
      await workspaceDatabase.addWorkspaceToGroup(workspace2.id, group.id, 1)

      // Auto-save should be called for group and both workspaces
      expect(autoSaveSpy).toHaveBeenCalledWith(group.id)
      expect(workspaceSpy).toHaveBeenCalledWith(workspace1.id)
      expect(workspaceSpy).toHaveBeenCalledWith(workspace2.id)

      autoSaveSpy.mockRestore()
      workspaceSpy.mockRestore()
    })
  })

  describe('Database Migration Integration', () => {
    it('should migrate existing workspaces to grouped system', async () => {
      // Create v2-style workspaces (without grouping)
      const existingWorkspaces = [
        {
          id: 'migrate-ws-1',
          name: 'Existing Workspace 1',
          emoji: '🗃️',
          color: '#6366f1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          isActive: false
        },
        {
          id: 'migrate-ws-2',
          name: 'Existing Workspace 2',
          emoji: '🗂️',
          color: '#8b5cf6',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          isActive: true
        }
      ]

      // Add workspaces to database
      for (const workspace of existingWorkspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Trigger migration by loading grouping data
      const groups = await workspaceDatabase.getAllGroups()
      const mappings = await workspaceDatabase.getAllGroupMappings()

      // Should have no groups or mappings for existing workspaces
      expect(groups).toHaveLength(0)
      expect(mappings).toHaveLength(0)

      // Workspaces should still exist and be retrievable
      const workspaces = await workspaceDatabase.getAllWorkspaces()
      expect(workspaces).toHaveLength(2)
      expect(workspaces[0].id).toBe('migrate-ws-1')
      expect(workspaces[1].id).toBe('migrate-ws-2')
    })

    it('should handle migration with corrupted group data', async () => {
      // Create valid workspace
      const workspace = {
        id: 'migration-ws',
        name: 'Migration Test',
        emoji: '🔄',
        color: '#f59e0b',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createWorkspace(workspace)

      // Attempt to create invalid group (should be handled gracefully)
      const invalidGroup = {
        id: '', // Invalid empty ID
        name: 'Invalid Group',
        color: 'blue' as const,
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await expect(workspaceDatabase.createGroup(invalidGroup))
        .rejects.toThrow()

      // Valid workspace should still exist
      const retrievedWorkspace = await workspaceDatabase.getWorkspace(workspace.id)
      expect(retrievedWorkspace).toEqual(workspace)
    })
  })

  describe('Cross-Component Integration', () => {
    it('should synchronize state between components and store', async () => {
      // Create test data
      const group: WorkspaceGroup = {
        id: 'sync-group',
        name: 'Sync Test Group',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace = {
        id: 'sync-ws',
        name: 'Sync Test Workspace',
        emoji: '🔄',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace)

      // Load data into store
      const store = useWorkspaceStore.getState()
      await store.loadWorkspaceGroupingData()

      // Verify store state matches database
      const storeGroups = store.workspaceGroups
      expect(storeGroups).toHaveLength(1)
      expect(storeGroups[0].id).toBe(group.id)

      // Make change through store
      await store.toggleGroupExpansion(group.id)

      // Verify change persisted to database
      const updatedGroup = await workspaceDatabase.getGroup(group.id)
      expect(updatedGroup!.isExpanded).toBe(false) // Should be toggled
    })

    it('should handle concurrent operations from multiple components', async () => {
      const group: WorkspaceGroup = {
        id: 'concurrent-group',
        name: 'Concurrent Test',
        color: 'green',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Simulate concurrent updates from different components
      const update1 = workspaceDatabase.updateGroup(group.id, { name: 'Update 1' })
      const update2 = workspaceDatabase.updateGroup(group.id, { color: 'red' })
      const update3 = workspaceDatabase.updateGroup(group.id, { isExpanded: false })

      const results = await Promise.allSettled([update1, update2, update3])

      // At least one operation should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length
      expect(successful).toBeGreaterThan(0)

      // Final state should be consistent
      const finalGroup = await workspaceDatabase.getGroup(group.id)
      expect(finalGroup).toBeTruthy()
      expect(finalGroup!.id).toBe(group.id)
    })
  })

  describe('Error Recovery Integration', () => {
    it('should recover from database disconnection during operations', async () => {
      // Create initial state
      const group: WorkspaceGroup = {
        id: 'recovery-group',
        name: 'Recovery Test',
        color: 'orange',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await workspaceDatabase.createGroup(group)

      // Simulate database disconnection by closing database
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('CantoCap_Workspaces')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      db.close()

      // Attempt operation while disconnected
      const store = useWorkspaceStore.getState()
      const result = await store.updateWorkspaceGroup(group.id, { name: 'Updated Name' })

      // Operation should fail gracefully
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()

      // Reconnect and retry
      await workspaceDatabase.initialize()
      const retryResult = await store.updateWorkspaceGroup(group.id, { name: 'Retry Update' })

      expect(retryResult.success).toBe(true)
      expect(retryResult.data.name).toBe('Retry Update')
    })

    it('should handle partial operation failures in batch operations', async () => {
      const operations: DragOperation[] = [
        {
          type: 'workspace-to-workspace',
          sourceId: 'valid-ws-1',
          targetId: 'valid-ws-2',
          position: 'combine'
        },
        {
          type: 'workspace-to-workspace',
          sourceId: 'invalid-ws',
          targetId: 'valid-ws-1',
          position: 'combine'
        },
        {
          type: 'workspace-to-workspace',
          sourceId: 'valid-ws-3',
          targetId: 'valid-ws-4',
          position: 'combine'
        }
      ]

      // Create valid workspaces
      const validWorkspaces = [
        { id: 'valid-ws-1', name: 'Valid 1', emoji: '✅', color: '#22c55e', createdAt: new Date(), updatedAt: new Date(), isActive: false },
        { id: 'valid-ws-2', name: 'Valid 2', emoji: '✅', color: '#22c55e', createdAt: new Date(), updatedAt: new Date(), isActive: false },
        { id: 'valid-ws-3', name: 'Valid 3', emoji: '✅', color: '#22c55e', createdAt: new Date(), updatedAt: new Date(), isActive: false },
        { id: 'valid-ws-4', name: 'Valid 4', emoji: '✅', color: '#22c55e', createdAt: new Date(), updatedAt: new Date(), isActive: false }
      ]

      for (const workspace of validWorkspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Execute batch operations
      const results = await Promise.allSettled(
        operations.map(op => workspaceDatabase.executeDragOperation(op))
      )

      // Some operations should succeed, some should fail
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length

      expect(successful).toBeGreaterThan(0)
      expect(failed).toBeGreaterThan(0)
      
      // System should remain in consistent state
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })
  })

  describe('Performance Integration', () => {
    it('should handle large-scale operations efficiently', async () => {
      const startTime = performance.now()

      // Create large dataset
      const groups: WorkspaceGroup[] = Array.from({ length: 10 }, (_, i) => ({
        id: `perf-group-${i}`,
        name: `Performance Group ${i}`,
        color: ['blue', 'green', 'yellow', 'orange', 'red'][i % 5] as any,
        isExpanded: i % 2 === 0,
        order: i,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      const workspaces = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-ws-${i}`,
        name: `Performance Workspace ${i}`,
        emoji: '⚡',
        color: '#f59e0b',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }))

      // Create groups
      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }

      // Create workspaces
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Distribute workspaces among groups
      for (let i = 0; i < workspaces.length; i++) {
        const groupIndex = i % groups.length
        await workspaceDatabase.addWorkspaceToGroup(
          workspaces[i].id,
          groups[groupIndex].id,
          Math.floor(i / groups.length)
        )
      }

      const endTime = performance.now()

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(30000) // < 30s for large dataset

      // Verify data integrity
      const allGroups = await workspaceDatabase.getAllGroups()
      const allMappings = await workspaceDatabase.getAllGroupMappings()

      expect(allGroups).toHaveLength(10)
      expect(allMappings).toHaveLength(100)

      // Verify data consistency
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })

    it('should optimize queries for grouped workspace retrieval', async () => {
      // Create test data
      const group: WorkspaceGroup = {
        id: 'query-group',
        name: 'Query Optimization',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspaces = Array.from({ length: 20 }, (_, i) => ({
        id: `query-ws-${i}`,
        name: `Query Workspace ${i}`,
        emoji: '🔍',
        color: '#3b82f6',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }))

      await workspaceDatabase.createGroup(group)
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
        await workspaceDatabase.addWorkspaceToGroup(workspace.id, group.id, workspaces.indexOf(workspace))
      }

      // Measure query performance
      const queryStart = performance.now()
      const groupWorkspaces = await workspaceDatabase.getGroupWorkspaces(group.id)
      const queryEnd = performance.now()

      expect(queryEnd - queryStart).toBeLessThan(100) // < 100ms for 20 workspaces
      expect(groupWorkspaces).toHaveLength(20)
      expect(groupWorkspaces[0].orderInGroup).toBe(0)
      expect(groupWorkspaces[19].orderInGroup).toBe(19)
    })
  })

  describe('Data Consistency Integration', () => {
    it('should maintain referential integrity across all operations', async () => {
      // Create complex data structure
      const group1: WorkspaceGroup = {
        id: 'integrity-group-1',
        name: 'Integrity Group 1',
        color: 'blue',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const group2: WorkspaceGroup = {
        id: 'integrity-group-2',
        name: 'Integrity Group 2',
        color: 'green',
        isExpanded: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspaces = [
        { id: 'integrity-ws-1', name: 'WS 1', emoji: '1️⃣', color: '#3b82f6', createdAt: new Date(), updatedAt: new Date(), isActive: false },
        { id: 'integrity-ws-2', name: 'WS 2', emoji: '2️⃣', color: '#10b981', createdAt: new Date(), updatedAt: new Date(), isActive: false },
        { id: 'integrity-ws-3', name: 'WS 3', emoji: '3️⃣', color: '#f59e0b', createdAt: new Date(), updatedAt: new Date(), isActive: false }
      ]

      // Create all entities
      await workspaceDatabase.createGroup(group1)
      await workspaceDatabase.createGroup(group2)
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Create relationships
      await workspaceDatabase.addWorkspaceToGroup('integrity-ws-1', 'integrity-group-1', 0)
      await workspaceDatabase.addWorkspaceToGroup('integrity-ws-2', 'integrity-group-1', 1)
      await workspaceDatabase.addWorkspaceToGroup('integrity-ws-3', 'integrity-group-2', 0)

      // Perform various operations
      await workspaceDatabase.removeWorkspaceFromGroup('integrity-ws-2', 'integrity-group-1')
      await workspaceDatabase.addWorkspaceToGroup('integrity-ws-2', 'integrity-group-2', 1)
      await workspaceDatabase.deleteGroup('integrity-group-1')

      // Verify referential integrity
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Verify orphaned workspace is handled correctly
      const remainingMappings = await workspaceDatabase.getAllGroupMappings()
      expect(remainingMappings).toHaveLength(2) // Only ws-2 and ws-3 in group-2

      // Verify ws-1 is now ungrouped
      const ws1Mappings = await workspaceDatabase.getWorkspaceGroupMappings('integrity-ws-1')
      expect(ws1Mappings).toHaveLength(0)
    })

    it('should validate and repair inconsistent data', async () => {
      // Create initial valid state
      const group: WorkspaceGroup = {
        id: 'repair-group',
        name: 'Repair Test',
        color: 'red',
        isExpanded: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const workspace = {
        id: 'repair-ws',
        name: 'Repair Workspace',
        emoji: '🔧',
        color: '#ef4444',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false
      }

      await workspaceDatabase.createGroup(group)
      await workspaceDatabase.createWorkspace(workspace)
      await workspaceDatabase.addWorkspaceToGroup(workspace.id, group.id, 0)

      // Simulate data corruption by deleting workspace but leaving mapping
      await workspaceDatabase.deleteWorkspace(workspace.id)

      // Validation should detect the inconsistency
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)

      // System should be able to repair by cleaning up orphaned mappings
      const orphanedMappings = await workspaceDatabase.getGroupWorkspaces(group.id)
      expect(orphanedMappings).toHaveLength(0) // Should be cleaned up automatically
    })
  })
})