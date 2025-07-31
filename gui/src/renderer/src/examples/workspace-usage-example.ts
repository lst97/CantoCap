/**
 * Workspace System Usage Example
 * 
 * Demonstrates how to use the complete workspace system that integrates:
 * - IndexedDB storage layer (backend-architect's infrastructure)
 * - Main process workspace management (WorkspaceManager)
 * - IPC integration layer (WorkspaceIPCIntegration)
 * - Zustand stores integration
 * 
 * This example shows the complete workflow from initialization to usage.
 */

import { getWorkspaceIPCIntegration } from '../services/workspace-ipc-integration'
import { getWorkspaceDatabase } from '../services/workspace-database'
import type { 
  Workspace, 
  WorkspaceConfig, 
  WorkspaceCreateOptions 
} from '../types/workspace'
import type { AppConfig } from '../../../types'

/**
 * Complete Workspace System Example
 */
export class WorkspaceSystemExample {
  private integration = getWorkspaceIPCIntegration()
  private database = getWorkspaceDatabase()
  private isInitialized = false

  /**
   * Initialize workspace system
   * This should be called when the app starts
   */
  public async initializeSystem(): Promise<{ success: boolean, message: string }> {
    try {
      console.log('🚀 Initializing workspace system...')
      
      // Step 1: Initialize the complete integration
      const initResult = await this.integration.initializeIntegration()
      
      if (!initResult.success) {
        throw new Error(initResult.message)
      }

      // Step 2: Wait for system to be ready
      let attempts = 0
      const maxAttempts = 30 // 30 seconds max
      
      while (!await this.integration.isSystemReady() && attempts < maxAttempts) {
        console.log(`⏳ Waiting for system to be ready... (${attempts + 1}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error('System initialization timeout')
      }

      this.isInitialized = true
      console.log('✅ Workspace system initialized successfully')
      
      return { success: true, message: 'System ready' }
    } catch (error) {
      console.error('❌ Failed to initialize workspace system:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Create a new workspace
   */
  public async createWorkspace(name: string, options?: Partial<WorkspaceConfig>): Promise<{ success: boolean, workspace?: Workspace }> {
    if (!this.isInitialized) {
      throw new Error('System not initialized. Call initializeSystem() first.')
    }

    try {
      console.log(`📁 Creating workspace: ${name}`)
      
      // Create workspace through integration layer
      const createResult = await this.integration.createWorkspace(name, options)
      
      if (!createResult.success || !createResult.workspaceId) {
        throw new Error('Failed to create workspace')
      }

      // Retrieve the created workspace
      const workspace = await this.database.getWorkspace(createResult.workspaceId)
      
      if (!workspace) {
        throw new Error('Workspace created but not found in database')
      }

      console.log(`✅ Workspace created: ${workspace.name} (${workspace.id})`)
      
      return { success: true, workspace }
    } catch (error) {
      console.error('❌ Failed to create workspace:', error)
      return { success: false }
    }
  }

  /**
   * Switch to a different workspace
   */
  public async switchWorkspace(workspaceId: string): Promise<{ success: boolean, workspace?: Workspace }> {
    if (!this.isInitialized) {
      throw new Error('System not initialized')
    }

    try {
      console.log(`🔄 Switching to workspace: ${workspaceId}`)
      
      // Get workspace from IndexedDB
      const workspace = await this.database.getWorkspace(workspaceId)
      
      if (!workspace) {
        throw new Error('Workspace not found')
      }

      // Update active status
      const allWorkspaces = await this.database.getAllWorkspaces()
      
      // Deactivate all workspaces
      for (const ws of allWorkspaces) {
        if (ws.isActive) {
          ws.isActive = false
          await this.database.saveWorkspace(ws)
        }
      }

      // Activate target workspace
      workspace.isActive = true
      workspace.lastAccessedAt = Date.now()
      await this.database.saveWorkspace(workspace)

      // Sync to main process
      await this.integration.syncWorkspaceToMainProcess(workspaceId)

      console.log(`✅ Switched to workspace: ${workspace.name}`)
      
      return { success: true, workspace }
    } catch (error) {
      console.error('❌ Failed to switch workspace:', error)
      return { success: false }
    }
  }

  /**
   * Update workspace configuration
   */
  public async updateWorkspaceConfig(
    workspaceId: string, 
    configUpdates: Partial<WorkspaceConfig>
  ): Promise<{ success: boolean }> {
    if (!this.isInitialized) {
      throw new Error('System not initialized')
    }

    try {
      console.log(`⚙️ Updating workspace config: ${workspaceId}`)
      
      // Get current workspace
      const workspace = await this.database.getWorkspace(workspaceId)
      
      if (!workspace) {
        throw new Error('Workspace not found')
      }

      // Update configuration
      workspace.config = {
        ...workspace.config,
        ...configUpdates,
        lastModified: Date.now(),
        version: (workspace.config.version || 1) + 1
      }
      workspace.updatedAt = Date.now()

      // Save to IndexedDB
      await this.database.saveWorkspace(workspace)

      // Auto-sync to main process (debounced)
      await this.integration.autoSync(workspaceId, configUpdates)

      console.log(`✅ Workspace config updated: ${workspace.name}`)
      
      return { success: true }
    } catch (error) {
      console.error('❌ Failed to update workspace config:', error)
      return { success: false }
    }
  }

  /**
   * List all available workspaces
   */
  public async listWorkspaces(): Promise<Workspace[]> {
    if (!this.isInitialized) {
      throw new Error('System not initialized')
    }

    try {
      return await this.database.getAllWorkspaces()
    } catch (error) {
      console.error('❌ Failed to list workspaces:', error)
      return []
    }
  }

  /**
   * Get the currently active workspace
   */
  public async getActiveWorkspace(): Promise<Workspace | null> {
    if (!this.isInitialized) {
      throw new Error('System not initialized')
    }

    try {
      const workspaces = await this.database.getAllWorkspaces()
      return workspaces.find(ws => ws.isActive) || null
    } catch (error) {
      console.error('❌ Failed to get active workspace:', error)
      return null
    }
  }

  /**
   * Delete a workspace
   */
  public async deleteWorkspace(workspaceId: string): Promise<{ success: boolean }> {
    if (!this.isInitialized) {
      throw new Error('System not initialized')
    }

    try {
      console.log(`🗑️ Deleting workspace: ${workspaceId}`)
      
      // Delete through integration layer
      const deleteResult = await this.integration.deleteWorkspace(workspaceId)
      
      if (!deleteResult.success) {
        throw new Error('Failed to delete workspace')
      }

      console.log(`✅ Workspace deleted: ${workspaceId}`)
      
      return { success: true }
    } catch (error) {
      console.error('❌ Failed to delete workspace:', error)
      return { success: false }
    }
  }

  /**
   * Create a backup of a workspace
   */
  public async createBackup(workspaceId: string): Promise<{ success: boolean, backupPath?: string }> {
    if (!this.isInitialized) {
      throw new Error('System not initialized')
    }

    try {
      console.log(`💾 Creating backup for workspace: ${workspaceId}`)
      
      const backupResult = await this.integration.createBackup(workspaceId)
      
      if (backupResult.success) {
        console.log(`✅ Backup created: ${backupResult.backupPath}`)
      }
      
      return backupResult
    } catch (error) {
      console.error('❌ Failed to create backup:', error)
      return { success: false }
    }
  }

  /**
   * Get system performance metrics
   */
  public async getPerformanceMetrics() {
    if (!this.isInitialized) {
      throw new Error('System not initialized')
    }

    try {
      return await this.integration.getPerformanceMetrics()
    } catch (error) {
      console.error('❌ Failed to get performance metrics:', error)
      return []
    }
  }

  /**
   * Demonstrate complete workflow
   */
  public async demonstrateWorkflow(): Promise<void> {
    console.log('🎯 Starting workspace system demonstration...')

    try {
      // 1. Initialize system
      const initResult = await this.initializeSystem()
      if (!initResult.success) {
        throw new Error(`Initialization failed: ${initResult.message}`)
      }

      // 2. Create first workspace
      const workspace1 = await this.createWorkspace('Project Alpha', {
        language: 'en',
        priority: 'quality',
        speakers: true
      })
      
      if (!workspace1.success || !workspace1.workspace) {
        throw new Error('Failed to create first workspace')
      }

      // 3. Create second workspace
      const workspace2 = await this.createWorkspace('Project Beta', {
        language: 'zh',
        priority: 'speed',
        music: true
      })
      
      if (!workspace2.success || !workspace2.workspace) {
        throw new Error('Failed to create second workspace')
      }

      // 4. Switch between workspaces
      await this.switchWorkspace(workspace1.workspace.id)
      await this.switchWorkspace(workspace2.workspace.id)

      // 5. Update configuration
      await this.updateWorkspaceConfig(workspace2.workspace.id, {
        geminiKey: 'demo-key-123',
        maxChunkDuration: 45
      })

      // 6. List all workspaces
      const allWorkspaces = await this.listWorkspaces()
      console.log(`📋 Total workspaces: ${allWorkspaces.length}`)

      // 7. Get active workspace
      const activeWorkspace = await this.getActiveWorkspace()
      console.log(`🎯 Active workspace: ${activeWorkspace?.name}`)

      // 8. Create backup
      if (activeWorkspace) {
        await this.createBackup(activeWorkspace.id)
      }

      // 9. Show performance metrics
      const metrics = await this.getPerformanceMetrics()
      console.log(`📊 Performance metrics count: ${metrics.length}`)

      console.log('🎉 Workspace system demonstration completed successfully!')

    } catch (error) {
      console.error('❌ Demonstration failed:', error)
      throw error
    }
  }

  /**
   * Cleanup system resources
   */
  public cleanup(): void {
    this.integration.cleanup()
    this.isInitialized = false
    console.log('🧹 Workspace system cleaned up')
  }
}

/**
 * Usage Examples
 */

// Example 1: Basic Usage
export async function basicUsageExample() {
  const system = new WorkspaceSystemExample()
  
  try {
    // Initialize
    await system.initializeSystem()
    
    // Create workspace
    const result = await system.createWorkspace('My First Workspace')
    
    if (result.success && result.workspace) {
      console.log('Workspace created:', result.workspace.name)
      
      // Update config
      await system.updateWorkspaceConfig(result.workspace.id, {
        language: 'en',
        priority: 'balanced'
      })
    }
  } finally {
    system.cleanup()
  }
}

// Example 2: Advanced Usage with Error Handling
export async function advancedUsageExample() {
  const system = new WorkspaceSystemExample()
  
  try {
    // Initialize with error handling
    const initResult = await system.initializeSystem()
    if (!initResult.success) {
      console.error('Failed to initialize:', initResult.message)
      return
    }

    // Create multiple workspaces
    const workspaces = await Promise.allSettled([
      system.createWorkspace('Audio Project'),
      system.createWorkspace('Video Project'),
      system.createWorkspace('Podcast Project')
    ])

    const successful = workspaces
      .filter((result): result is PromiseFulfilledResult<{success: boolean, workspace?: Workspace}> => 
        result.status === 'fulfilled' && result.value.success
      )
      .map(result => result.value.workspace!)

    console.log(`Created ${successful.length} workspaces successfully`)

    // Switch to first successful workspace
    if (successful.length > 0) {
      await system.switchWorkspace(successful[0].id)
      
      // Create backup
      const backupResult = await system.createBackup(successful[0].id)
      if (backupResult.success) {
        console.log('Backup created at:', backupResult.backupPath)
      }
    }

  } catch (error) {
    console.error('Advanced usage example failed:', error)
  } finally {
    system.cleanup()
  }
}

// Example 3: Complete Demonstration
export async function runCompleteDemo() {
  const system = new WorkspaceSystemExample()
  
  try {
    await system.demonstrateWorkflow()
  } catch (error) {
    console.error('Complete demo failed:', error)
  } finally {
    system.cleanup()
  }
}

// Example 4: Integration with React Components
export function useWorkspaceSystem() {
  const system = new WorkspaceSystemExample()
  
  return {
    initialize: () => system.initializeSystem(),
    createWorkspace: (name: string, config?: Partial<WorkspaceConfig>) => 
      system.createWorkspace(name, config),
    switchWorkspace: (id: string) => system.switchWorkspace(id),
    updateConfig: (id: string, config: Partial<WorkspaceConfig>) => 
      system.updateWorkspaceConfig(id, config),
    listWorkspaces: () => system.listWorkspaces(),
    getActiveWorkspace: () => system.getActiveWorkspace(),
    deleteWorkspace: (id: string) => system.deleteWorkspace(id),
    createBackup: (id: string) => system.createBackup(id),
    getMetrics: () => system.getPerformanceMetrics(),
    cleanup: () => system.cleanup()
  }
}