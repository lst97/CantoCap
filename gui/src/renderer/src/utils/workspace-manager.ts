/**
 * Workspace Manager
 * 
 * Central service for managing workspace operations including creation,
 * switching, persistence, and migration coordination.
 */

import { WorkspaceConfig, AppConfig } from '../types/workflow'
import { IndexedDBService } from './indexeddb-service'
import { WorkspaceMigrationService, MigrationResult } from './workspace-migration'

export class WorkspaceManager {
  private indexedDBService: IndexedDBService
  private migrationService: WorkspaceMigrationService
  private currentWorkspaceId: string | null = null
  private workspaces: Map<string, WorkspaceConfig> = new Map()

  constructor() {
    this.indexedDBService = new IndexedDBService()
    this.migrationService = new WorkspaceMigrationService()
  }

  /**
   * Initialize the workspace manager
   */
  async initialize(): Promise<void> {
    await this.indexedDBService.initialize()
    await this.loadWorkspaces()
    
    // Set default workspace if none exists
    if (this.workspaces.size === 0) {
      await this.createDefaultWorkspace()
    }
    
    // Set current workspace if none is active
    if (!this.currentWorkspaceId) {
      const activeWorkspace = Array.from(this.workspaces.values()).find(w => w.isActive)
      if (activeWorkspace) {
        this.currentWorkspaceId = activeWorkspace.id
      } else {
        // Set first workspace as active
        const firstWorkspace = Array.from(this.workspaces.values())[0]
        if (firstWorkspace) {
          this.currentWorkspaceId = firstWorkspace.id
          firstWorkspace.isActive = true
          await this.saveWorkspace(firstWorkspace)
        }
      }
    }
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(workspaceData: Partial<WorkspaceConfig>): Promise<WorkspaceConfig> {
    const id = workspaceData.id || this.generateWorkspaceId()
    
    const workspace: WorkspaceConfig = {
      id,
      name: workspaceData.name || 'New Workspace',
      description: workspaceData.description || '',
      appConfig: workspaceData.appConfig || this.getDefaultAppConfig(),
      workflowStep: workspaceData.workflowStep || 'input',
      createdAt: workspaceData.createdAt || new Date(),
      lastUsed: workspaceData.lastUsed || new Date(),
      isActive: workspaceData.isActive || false
    }

    await this.saveWorkspace(workspace)
    this.workspaces.set(id, workspace)

    return workspace
  }

  /**
   * Get current workspace
   */
  async getCurrentWorkspace(): Promise<WorkspaceConfig | null> {
    if (!this.currentWorkspaceId) {
      return null
    }
    
    return this.workspaces.get(this.currentWorkspaceId) || null
  }

  /**
   * Set current workspace
   */
  async setCurrentWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    // Deactivate current workspace
    if (this.currentWorkspaceId) {
      const currentWorkspace = this.workspaces.get(this.currentWorkspaceId)
      if (currentWorkspace) {
        currentWorkspace.isActive = false
        await this.saveWorkspace(currentWorkspace)
      }
    }

    // Activate new workspace
    workspace.isActive = true
    workspace.lastUsed = new Date()
    this.currentWorkspaceId = workspaceId
    
    await this.saveWorkspace(workspace)
  }

  /**
   * Get all workspaces
   */
  async getAllWorkspaces(): Promise<WorkspaceConfig[]> {
    return Array.from(this.workspaces.values())
  }

  /**
   * Load workspaces from IndexedDB
   */
  async loadWorkspaces(): Promise<void> {
    try {
      const workspaceKeys = await this.indexedDBService.getAllKeys('workspaces')
      
      for (const key of workspaceKeys) {
        const workspace = await this.indexedDBService.get(key)
        if (workspace && workspace.id) {
          this.workspaces.set(workspace.id, workspace)
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    }
  }

  /**
   * Save workspace to IndexedDB
   */
  async saveWorkspace(workspace: WorkspaceConfig): Promise<void> {
    await this.indexedDBService.set(`workspace-${workspace.id}`, workspace)
  }

  /**
   * Save current workspace state
   */
  async saveCurrentState(): Promise<void> {
    if (this.currentWorkspaceId) {
      const workspace = this.workspaces.get(this.currentWorkspaceId)
      if (workspace) {
        await this.saveWorkspace(workspace)
      }
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    // Cannot delete the only workspace
    if (this.workspaces.size === 1) {
      throw new Error('Cannot delete the only workspace')
    }

    // If deleting current workspace, switch to another
    if (this.currentWorkspaceId === workspaceId) {
      const otherWorkspaces = Array.from(this.workspaces.values()).filter(w => w.id !== workspaceId)
      await this.setCurrentWorkspace(otherWorkspaces[0].id)
    }

    await this.indexedDBService.delete(`workspace-${workspaceId}`)
    this.workspaces.delete(workspaceId)
  }

  /**
   * Migrate from legacy configuration
   */
  async migrateFromLegacyConfig(legacyConfig: any): Promise<MigrationResult> {
    try {
      // Create default workspace with migrated config
      const migratedConfig = await this.migrationService.migrateAppConfig(legacyConfig)
      
      const defaultWorkspace = await this.createWorkspace({
        name: 'Default Workspace',
        description: 'Migrated from legacy configuration',
        appConfig: migratedConfig,
        isActive: true
      })

      await this.setCurrentWorkspace(defaultWorkspace.id)

      return {
        success: true,
        workspaces: [defaultWorkspace]
      }
    } catch (error) {
      return {
        success: false,
        workspaces: [],
        error: error instanceof Error ? error.message : 'Migration failed'
      }
    }
  }

  /**
   * Create default workspace
   */
  private async createDefaultWorkspace(): Promise<WorkspaceConfig> {
    return await this.createWorkspace({
      name: 'Default Workspace',
      description: 'Default workspace for CantoCap',
      isActive: true
    })
  }

  /**
   * Get default app configuration
   */
  private getDefaultAppConfig(): AppConfig {
    return {
      language: 'en',
      model: 'small',
      priority: 'balanced',
      numSpeakers: 'auto',
      outputFormat: 'srt',
      batchSize: 25,
      useGPU: false,
      deviceId: 'cpu',
      computeType: 'int8',
      vadFilter: true,
      vadThreshold: 0.6,
      logProb: -1.0,
      noSpeechThreshold: 0.6,
      compressionRatio: 2.4,
      temperature: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
      bestOf: 5,
      patience: 1.0,
      lengthPenalty: 1.0,
      repetitionPenalty: 1.0,
      noRepeatNgramSize: 0,
      maxNewTokens: null,
      promptLookupNumTokens: null,
      hallucination_silence_threshold: null,
      hotwords: null,
      language_detection_threshold: null,
      language_detection_segments: null
    }
  }

  /**
   * Generate unique workspace ID
   */
  private generateWorkspaceId(): string {
    return `workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Send IPC message (mock for testing)
   */
  private async sendIPCMessage(channel: string, data: any): Promise<any> {
    // In real implementation, this would use Electron IPC
    if (typeof window !== 'undefined' && window.electron) {
      return await window.electron.invoke(channel, data)
    }
    
    // Mock response for testing
    return Promise.resolve({ success: true })
  }
}