/**
 * Workspace Grouping Performance Tests
 * Performance benchmarking and optimization validation for workspace grouping system
 * including drag operations, large datasets, and memory usage monitoring.
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

// Performance measurement utilities
class PerformanceMonitor {
  private startTime: number = 0
  private startMemory: number = 0

  start() {
    this.startTime = performance.now()
    this.startMemory = this.getMemoryUsage()
  }

  end() {
    const endTime = performance.now()
    const endMemory = this.getMemoryUsage()
    
    return {
      duration: endTime - this.startTime,
      memoryDelta: endMemory - this.startMemory,
      memoryUsage: endMemory
    }
  }

  private getMemoryUsage(): number {
    if (global.performance?.memory) {
      return global.performance.memory.usedJSHeapSize / (1024 * 1024) // MB
    }
    return 0
  }
}

// Data generation utilities
const generateTestWorkspaces = (count: number): any[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `perf-ws-${i}`,
    name: `Performance Workspace ${i}`,
    emoji: ['📁', '📂', '📄', '📊', '📈'][i % 5],
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5],
    createdAt: new Date(Date.now() - Math.random() * 86400000), // Random within last day
    updatedAt: new Date(),
    isActive: i === 0
  }))
}

const generateTestGroups = (count: number): WorkspaceGroup[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `perf-group-${i}`,
    name: `Performance Group ${i}`,
    color: ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'default'][i % 7] as any,
    isExpanded: i % 3 !== 0, // Vary expansion state
    order: i,
    createdAt: new Date(Date.now() - Math.random() * 86400000),
    updatedAt: new Date()
  }))
}

// Setup IndexedDB for performance testing
const setupPerformanceDB = () => {
  global.indexedDB = new FDBFactory()
  global.IDBKeyRange = FDBKeyRange
}

describe('Workspace Grouping Performance', () => {
  const monitor = new PerformanceMonitor()

  beforeEach(async () => {
    setupPerformanceDB()
    jest.clearAllMocks()
    await workspaceDatabase.initialize()
  })

  afterEach(async () => {
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

  describe('Database Operation Performance', () => {
    it('should create groups efficiently at scale', async () => {
      const groupCount = 100
      const groups = generateTestGroups(groupCount)

      monitor.start()
      
      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(5000) // < 5s for 100 groups
      expect(metrics.memoryDelta).toBeLessThan(50) // < 50MB memory increase
      
      // Verify all groups were created
      const retrievedGroups = await workspaceDatabase.getAllGroups()
      expect(retrievedGroups).toHaveLength(groupCount)
    })

    it('should create workspaces efficiently at scale', async () => {
      const workspaceCount = 500
      const workspaces = generateTestWorkspaces(workspaceCount)

      monitor.start()
      
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(10000) // < 10s for 500 workspaces
      expect(metrics.memoryDelta).toBeLessThan(100) // < 100MB memory increase
      
      // Verify all workspaces were created
      const retrievedWorkspaces = await workspaceDatabase.getAllWorkspaces()
      expect(retrievedWorkspaces).toHaveLength(workspaceCount)
    })

    it('should handle batch group mappings efficiently', async () => {
      const groupCount = 20
      const workspaceCount = 200
      const groups = generateTestGroups(groupCount)
      const workspaces = generateTestWorkspaces(workspaceCount)

      // Create groups and workspaces
      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      monitor.start()
      
      // Distribute workspaces among groups
      for (let i = 0; i < workspaces.length; i++) {
        const groupIndex = i % groups.length
        await workspaceDatabase.addWorkspaceToGroup(
          workspaces[i].id,
          groups[groupIndex].id,
          Math.floor(i / groups.length)
        )
      }
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(15000) // < 15s for 200 mappings
      expect(metrics.memoryDelta).toBeLessThan(75) // < 75MB memory increase
      
      // Verify all mappings were created
      const allMappings = await workspaceDatabase.getAllGroupMappings()
      expect(allMappings).toHaveLength(workspaceCount)
    })

    it('should query grouped workspaces efficiently', async () => {
      // Setup test data
      const groups = generateTestGroups(10)
      const workspaces = generateTestWorkspaces(100)

      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Create mappings
      for (let i = 0; i < workspaces.length; i++) {
        const groupIndex = i % groups.length
        await workspaceDatabase.addWorkspaceToGroup(
          workspaces[i].id,
          groups[groupIndex].id,
          Math.floor(i / groups.length)
        )
      }

      monitor.start()
      
      // Query all groups with their workspaces
      const queryResults = await Promise.all(
        groups.map(group => workspaceDatabase.getGroupWorkspaces(group.id))
      )
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(500) // < 500ms for querying 10 groups
      expect(queryResults.every(result => result.length === 10)).toBe(true) // Each group has 10 workspaces
    })

    it('should delete operations perform efficiently', async () => {
      // Setup test data
      const groups = generateTestGroups(50)
      const workspaces = generateTestWorkspaces(250)

      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Create mappings
      for (let i = 0; i < workspaces.length; i++) {
        const groupIndex = i % groups.length
        await workspaceDatabase.addWorkspaceToGroup(
          workspaces[i].id,
          groups[groupIndex].id,
          Math.floor(i / groups.length)
        )
      }

      monitor.start()
      
      // Delete half the groups (should handle workspace redistribution)
      for (let i = 0; i < groups.length / 2; i++) {
        await workspaceDatabase.deleteGroup(groups[i].id)
      }
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(8000) // < 8s for deleting 25 groups
      
      // Verify deletions and cleanup
      const remainingGroups = await workspaceDatabase.getAllGroups()
      expect(remainingGroups).toHaveLength(25)
      
      // Verify data consistency
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })
  })

  describe('Drag Operation Performance', () => {
    it('should execute workspace-to-workspace drags efficiently', async () => {
      const workspaces = generateTestWorkspaces(20)
      
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      const dragOperations: DragOperation[] = []
      
      // Create 10 group creation operations
      for (let i = 0; i < 10; i++) {
        dragOperations.push({
          type: 'workspace-to-workspace',
          sourceId: workspaces[i * 2].id,
          targetId: workspaces[i * 2 + 1].id,
          position: 'combine'
        })
      }

      monitor.start()
      
      for (const operation of dragOperations) {
        await workspaceDatabase.executeDragOperation(operation)
      }
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(3000) // < 3s for 10 group creations
      
      // Verify groups were created
      const groups = await workspaceDatabase.getAllGroups()
      expect(groups).toHaveLength(10)
    })

    it('should handle concurrent drag operations efficiently', async () => {
      const workspaces = generateTestWorkspaces(30)
      const groups = generateTestGroups(5)
      
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }

      // Create concurrent drag operations
      const operations: DragOperation[] = Array.from({ length: 15 }, (_, i) => ({
        type: 'workspace-to-group',
        sourceId: workspaces[i].id,
        targetId: groups[i % groups.length].id,
        position: 'end'
      }))

      monitor.start()
      
      // Execute operations concurrently
      const results = await Promise.allSettled(
        operations.map(op => workspaceDatabase.executeDragOperation(op))
      )
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(5000) // < 5s for 15 concurrent operations
      
      // Most operations should succeed (some may fail due to race conditions)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      expect(successful).toBeGreaterThan(10) // At least 70% success rate
    })

    it('should batch drag operations for better performance', async () => {
      const workspaces = generateTestWorkspaces(50)
      const group = generateTestGroups(1)[0]
      
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
      await workspaceDatabase.createGroup(group)

      const operations: DragOperation[] = workspaces.map((workspace, i) => ({
        type: 'workspace-to-group',
        sourceId: workspace.id,
        targetId: group.id,
        position: 'end'
      }))

      // Test individual operations
      monitor.start()
      for (let i = 0; i < 10; i++) {
        await workspaceDatabase.executeDragOperation(operations[i])
      }
      const individualMetrics = monitor.end()

      // Reset for batch test
      await workspaceDatabase.deleteGroup(group.id)
      await workspaceDatabase.createGroup(group)

      // Test batch operations (if implemented)
      monitor.start()
      const batchResults = await Promise.all(
        operations.slice(10, 20).map(op => workspaceDatabase.executeDragOperation(op))
      )
      const batchMetrics = monitor.end()

      // Batch operations should be more efficient
      expect(batchMetrics.duration).toBeLessThan(individualMetrics.duration)
      expect(batchResults.every(r => r.success)).toBe(true)
    })

    it('should optimize reordering operations', async () => {
      const workspaces = generateTestWorkspaces(30)
      const group = generateTestGroups(1)[0]
      
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
      await workspaceDatabase.createGroup(group)

      // Add all workspaces to group
      for (let i = 0; i < workspaces.length; i++) {
        await workspaceDatabase.addWorkspaceToGroup(workspaces[i].id, group.id, i)
      }

      // Create reordering operations
      const newOrder = workspaces.map((ws, i) => ({
        workspaceId: ws.id,
        orderInGroup: workspaces.length - 1 - i // Reverse order
      }))

      monitor.start()
      
      await workspaceDatabase.reorderWorkspacesInGroup(group.id, newOrder)
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(1000) // < 1s for reordering 30 items
      
      // Verify reordering was applied
      const groupWorkspaces = await workspaceDatabase.getGroupWorkspaces(group.id)
      expect(groupWorkspaces[0].workspaceId).toBe(workspaces[workspaces.length - 1].id)
      expect(groupWorkspaces[workspaces.length - 1].workspaceId).toBe(workspaces[0].id)
    })
  })

  describe('Store Performance', () => {
    it('should load large datasets efficiently into store', async () => {
      // Create large dataset
      const groups = generateTestGroups(25)
      const workspaces = generateTestWorkspaces(250)

      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }
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

      const store = useWorkspaceStore.getState()

      monitor.start()
      
      await store.loadWorkspaceGroupingData()
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(2000) // < 2s to load large dataset
      expect(metrics.memoryDelta).toBeLessThan(100) // < 100MB memory increase
      
      // Verify all data was loaded
      expect(store.workspaceGroups).toHaveLength(25)
      expect(store.workspaces).toHaveLength(250)
    })

    it('should cache grouped workspace data efficiently', async () => {
      const groups = generateTestGroups(10)
      const workspaces = generateTestWorkspaces(100)

      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      const store = useWorkspaceStore.getState()
      await store.loadWorkspaceGroupingData()

      // First access - should build cache
      monitor.start()
      const firstAccess = store.getGroupedWorkspaces()
      const firstMetrics = monitor.end()

      // Subsequent accesses - should use cache
      monitor.start()
      const secondAccess = store.getGroupedWorkspaces()
      const thirdAccess = store.getGroupedWorkspaces()
      const cachedMetrics = monitor.end()

      // Cached access should be much faster
      expect(cachedMetrics.duration).toBeLessThan(firstMetrics.duration / 5)
      
      // Should return same object (cached)
      expect(secondAccess).toBe(thirdAccess)
    })

    it('should handle rapid state updates efficiently', async () => {
      const group = generateTestGroups(1)[0]
      await workspaceDatabase.createGroup(group)

      const store = useWorkspaceStore.getState()
      await store.loadWorkspaceGroupingData()

      monitor.start()
      
      // Perform rapid updates
      for (let i = 0; i < 50; i++) {
        await store.updateWorkspaceGroup(group.id, {
          name: `Updated Name ${i}`,
          isExpanded: i % 2 === 0
        })
      }
      
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(5000) // < 5s for 50 rapid updates
      
      // Verify final state
      const finalGroup = store.workspaceGroups.find(g => g.id === group.id)
      expect(finalGroup!.name).toBe('Updated Name 49')
    })
  })

  describe('Memory Usage Optimization', () => {
    it('should not leak memory during drag operations', async () => {
      const workspaces = generateTestWorkspaces(20)
      const groups = generateTestGroups(3)

      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }

      const initialMemory = global.performance?.memory?.usedJSHeapSize || 0

      // Perform many drag operations
      for (let cycle = 0; cycle < 5; cycle++) {
        for (let i = 0; i < workspaces.length; i++) {
          const groupIndex = (i + cycle) % groups.length
          await workspaceDatabase.executeDragOperation({
            type: 'workspace-to-group',
            sourceId: workspaces[i].id,
            targetId: groups[groupIndex].id,
            position: 'end'
          })
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = global.performance?.memory?.usedJSHeapSize || 0
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024) // MB

      expect(memoryIncrease).toBeLessThan(50) // < 50MB increase after many operations
    })

    it('should efficiently manage large workspace collections', async () => {
      const largeWorkspaceCount = 1000
      const workspaces = generateTestWorkspaces(largeWorkspaceCount)

      const initialMemory = global.performance?.memory?.usedJSHeapSize || 0

      // Create all workspaces
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      const creationMemory = global.performance?.memory?.usedJSHeapSize || 0
      const memoryPerWorkspace = (creationMemory - initialMemory) / largeWorkspaceCount / 1024 // KB per workspace

      expect(memoryPerWorkspace).toBeLessThan(5) // < 5KB per workspace
    })

    it('should clean up resources after group deletion', async () => {
      const groups = generateTestGroups(20)
      const workspaces = generateTestWorkspaces(100)

      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Create mappings
      for (let i = 0; i < workspaces.length; i++) {
        const groupIndex = i % groups.length
        await workspaceDatabase.addWorkspaceToGroup(
          workspaces[i].id,
          groups[groupIndex].id,
          Math.floor(i / groups.length)
        )
      }

      const beforeDeletion = global.performance?.memory?.usedJSHeapSize || 0

      // Delete all groups
      for (const group of groups) {
        await workspaceDatabase.deleteGroup(group.id)
      }

      // Force garbage collection
      if (global.gc) {
        global.gc()
      }

      const afterDeletion = global.performance?.memory?.usedJSHeapSize || 0
      const memoryFreed = (beforeDeletion - afterDeletion) / (1024 * 1024) // MB

      // Should free significant memory
      expect(memoryFreed).toBeGreaterThan(0)
    })
  })

  describe('Real-World Performance Scenarios', () => {
    it('should handle typical user workflow efficiently', async () => {
      // Simulate typical user workflow:
      // 1. Load existing workspaces
      // 2. Create some groups
      // 3. Organize workspaces into groups
      // 4. Reorder and modify groups
      // 5. Delete some groups

      const workspaces = generateTestWorkspaces(25) // Typical user might have 25 workspaces
      
      monitor.start()

      // Step 1: Create workspaces (user starts using app)
      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }

      // Step 2: User creates groups
      const groups = [
        { name: 'Development', color: 'blue' },
        { name: 'Testing', color: 'green' },
        { name: 'Production', color: 'red' }
      ]

      const createdGroups: WorkspaceGroup[] = []
      for (let i = 0; i < groups.length; i++) {
        const group: WorkspaceGroup = {
          id: `user-group-${i}`,
          name: groups[i].name,
          color: groups[i].color as any,
          isExpanded: true,
          order: i,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        await workspaceDatabase.createGroup(group)
        createdGroups.push(group)
      }

      // Step 3: User organizes workspaces (drag and drop)
      for (let i = 0; i < workspaces.length; i++) {
        const groupIndex = Math.floor(i / 8) % createdGroups.length
        await workspaceDatabase.addWorkspaceToGroup(
          workspaces[i].id,
          createdGroups[groupIndex].id,
          i % 8
        )
      }

      // Step 4: User reorders groups
      await workspaceDatabase.updateGroup(createdGroups[0].id, { order: 2 })
      await workspaceDatabase.updateGroup(createdGroups[1].id, { order: 0 })
      await workspaceDatabase.updateGroup(createdGroups[2].id, { order: 1 })

      // Step 5: User deletes a group
      await workspaceDatabase.deleteGroup(createdGroups[1].id)

      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(10000) // < 10s for complete workflow
      expect(metrics.memoryDelta).toBeLessThan(75) // < 75MB memory increase

      // Verify final state
      const remainingGroups = await workspaceDatabase.getAllGroups()
      expect(remainingGroups).toHaveLength(2)
      
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })

    it('should maintain performance under concurrent user actions', async () => {
      // Simulate multiple users or windows making concurrent changes
      const workspaces = generateTestWorkspaces(30)
      const groups = generateTestGroups(5)

      for (const workspace of workspaces) {
        await workspaceDatabase.createWorkspace(workspace)
      }
      for (const group of groups) {
        await workspaceDatabase.createGroup(group)
      }

      monitor.start()

      // Simulate concurrent operations from different sources
      const concurrentOperations = [
        // User 1: Adding workspaces to groups
        ...Array.from({ length: 10 }, (_, i) => 
          workspaceDatabase.addWorkspaceToGroup(workspaces[i].id, groups[i % 3].id, i)
        ),
        // User 2: Updating group properties
        ...groups.map(group => 
          workspaceDatabase.updateGroup(group.id, { name: `Updated ${group.name}` })
        ),
        // User 3: Reordering operations
        ...Array.from({ length: 5 }, (_, i) =>
          workspaceDatabase.executeDragOperation({
            type: 'workspace-to-group',
            sourceId: workspaces[i + 15].id,
            targetId: groups[(i + 2) % groups.length].id,
            position: 'end'
          })
        )
      ]

      const results = await Promise.allSettled(concurrentOperations)
      const metrics = monitor.end()

      expect(metrics.duration).toBeLessThan(8000) // < 8s for concurrent operations
      
      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length
      expect(successful / results.length).toBeGreaterThan(0.8) // >80% success rate

      // System should remain consistent
      const validation = await workspaceDatabase.validateDataConsistency()
      expect(validation.isValid).toBe(true)
    })
  })
})