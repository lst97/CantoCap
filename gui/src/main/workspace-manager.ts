import { app } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { readFile, writeFile, mkdir, access, unlink } from 'fs/promises'
import type { AppConfig } from '../types'
import { getConfigManager } from './config-manager'
import type {
  Workspace,
  WorkspaceMetadata,
  WorkspaceConfig,
  MigrationStatus,
  WorkspaceError,
  WorkspacePerformanceMetrics
} from '../renderer/src/types/workspace'

// Workspace Registry Interface
interface WorkspaceRegistry {
  version: number
  workspaces: Array<{
    id: string
    name: string
    createdAt: number
    updatedAt: number
    lastAccessedAt: number
    isActive: boolean
    configPath: string
    backupPath?: string
  }>
  migration: {
    isCompleted: boolean
    version: number
    lastMigrationDate: number
    backupPath?: string
  }
}

interface WorkspaceRegistryEntry {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  isActive: boolean
  configPath: string
  backupPath?: string
}

export class WorkspaceManager {
  private registryPath: string
  private workspacesDir: string
  private backupsDir: string
  private registry: WorkspaceRegistry
  private configManager = getConfigManager()
  private performanceMetrics: WorkspacePerformanceMetrics[] = []
  private migrationStatus: MigrationStatus | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    this.workspacesDir = join(userDataPath, 'workspaces')
    this.backupsDir = join(userDataPath, 'backups')
    this.registryPath = join(this.workspacesDir, 'registry.json')
    
    // Ensure directories exist
    this.ensureDirectories()
    
    // Initialize registry
    this.registry = this.loadRegistry()
  }

  private ensureDirectories(): void {
    try {
      for (const dir of [this.workspacesDir, this.backupsDir]) {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
      }
    } catch (error) {
      console.error('Failed to create workspace directories:', error)
      throw this.createWorkspaceError('STORAGE_UNAVAILABLE', 'Failed to initialize workspace directories')
    }
  }

  private loadRegistry(): WorkspaceRegistry {
    try {
      if (existsSync(this.registryPath)) {
        const registryData = readFileSync(this.registryPath, 'utf-8')
        const registry = JSON.parse(registryData) as WorkspaceRegistry
        
        // Validate registry structure
        if (!registry.version || !Array.isArray(registry.workspaces)) {
          return this.createDefaultRegistry()
        }
        
        return registry
      }
    } catch (error) {
      console.warn('Failed to load workspace registry, creating new one:', error)
    }
    
    return this.createDefaultRegistry()
  }

  private createDefaultRegistry(): WorkspaceRegistry {
    return {
      version: 1,
      workspaces: [],
      migration: {
        isCompleted: false,
        version: 0,
        lastMigrationDate: 0
      }
    }
  }

  private saveRegistry(): void {
    try {
      writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save workspace registry:', error)
      throw this.createWorkspaceError('STORAGE_UNAVAILABLE', 'Failed to save workspace registry')
    }
  }

  private createWorkspaceError(code: WorkspaceError['code'], message: string, workspaceId?: string, details?: any): WorkspaceError {
    const error = new Error(message) as WorkspaceError
    error.code = code
    error.workspaceId = workspaceId
    error.details = details
    return error
  }

  private recordPerformanceMetric(metric: Omit<WorkspacePerformanceMetrics, 'timestamp'>): void {
    const fullMetric: WorkspacePerformanceMetrics = {
      ...metric,
      timestamp: Date.now()
    }
    
    this.performanceMetrics.push(fullMetric)
    
    // Keep only last 1000 metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics.splice(0, this.performanceMetrics.length - 1000)
    }
  }

  // Registry Management
  public async initializeRegistry(): Promise<void> {
    const startTime = Date.now()
    try {
      this.registry = this.loadRegistry()
      
      // Cleanup stale workspace references
      const validWorkspaces = this.registry.workspaces.filter(workspace => {
        try {
          return existsSync(workspace.configPath)
        } catch {
          return false
        }
      })
      
      if (validWorkspaces.length !== this.registry.workspaces.length) {
        this.registry.workspaces = validWorkspaces
        this.saveRegistry()
      }
      
      this.recordPerformanceMetric({
        operationType: 'create',
        duration: Date.now() - startTime,
        success: true
      })
    } catch (error) {
      this.recordPerformanceMetric({
        operationType: 'create',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  // Core Workspace Operations
  public async createWorkspace(name: string, config?: Partial<WorkspaceConfig>): Promise<{ success: boolean, workspaceId: string }> {
    const startTime = Date.now()
    const workspaceId = this.generateWorkspaceId()
    
    try {
      // Validate name
      if (!this.isValidWorkspaceName(name)) {
        throw this.createWorkspaceError('VALIDATION_ERROR', 'Invalid workspace name')
      }
      
      // Check for duplicate names
      const existsName = this.registry.workspaces.some(w => w.name === name)
      if (existsName) {
        throw this.createWorkspaceError('VALIDATION_ERROR', 'Workspace name already exists')
      }
      
      // Create workspace directory
      const workspaceDir = join(this.workspacesDir, workspaceId)
      await mkdir(workspaceDir, { recursive: true })
      
      // Create workspace config
      const configPath = join(workspaceDir, 'config.json')
      const workspaceConfig: WorkspaceConfig = {
        ...(config || {}),
        workspaceId,
        lastModified: Date.now(),
        version: 1,
        // Use base config as defaults
        inputFile: config?.inputFile || null,
        outputFile: config?.outputFile || null,
        language: config?.language || 'zh',
        model: config?.model || null,
        priority: config?.priority || 'balanced',
        speakers: config?.speakers || false,
        written: config?.written || false,
        music: config?.music || false,
        charset: config?.charset || 'traditional',
        geminiKey: config?.geminiKey || '',
        hfToken: config?.hfToken || '',
        noGeminiRefinement: config?.noGeminiRefinement || false,
        maxChunkDuration: config?.maxChunkDuration || 30,
        videoQuality: config?.videoQuality || '720p',
        terminologyConfig: config?.terminologyConfig || null,
        ffmpegPath: config?.ffmpegPath || null,
        subtitle: config?.subtitle || null,
        duration: config?.duration || 0,
        verbose: config?.verbose || false,
        startTime: config?.startTime || null,
        endTime: config?.endTime || null,
        importedJsonFile: config?.importedJsonFile || null
      }
      
      await writeFile(configPath, JSON.stringify(workspaceConfig, null, 2), 'utf-8')
      
      // Add to registry
      const now = Date.now()
      const registryEntry: WorkspaceRegistryEntry = {
        id: workspaceId,
        name,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
        isActive: false,
        configPath
      }
      
      this.registry.workspaces.push(registryEntry)
      
      // Set as active if it's the first workspace
      if (this.registry.workspaces.length === 1) {
        registryEntry.isActive = true
      }
      
      this.saveRegistry()
      
      this.recordPerformanceMetric({
        operationType: 'create',
        duration: Date.now() - startTime,
        success: true,
        workspaceId
      })
      
      return { success: true, workspaceId }
    } catch (error) {
      this.recordPerformanceMetric({
        operationType: 'create',
        duration: Date.now() - startTime,
        success: false,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  public async deleteWorkspace(workspaceId: string): Promise<{ success: boolean }> {
    const startTime = Date.now()
    
    try {
      const workspaceIndex = this.registry.workspaces.findIndex(w => w.id === workspaceId)
      if (workspaceIndex === -1) {
        throw this.createWorkspaceError('WORKSPACE_NOT_FOUND', 'Workspace not found', workspaceId)
      }
      
      const workspace = this.registry.workspaces[workspaceIndex]
      
      // Create backup before deletion
      await this.createWorkspaceBackup(workspaceId, 'Pre-deletion backup')
      
      // Remove workspace directory
      const workspaceDir = dirname(workspace.configPath)
      try {
        await this.removeDirectoryRecursive(workspaceDir)
      } catch (error) {
        console.warn('Failed to remove workspace directory:', error)
        // Continue with registry removal even if directory cleanup fails
      }
      
      // Remove from registry
      this.registry.workspaces.splice(workspaceIndex, 1)
      
      // If this was the active workspace, activate another one
      if (workspace.isActive && this.registry.workspaces.length > 0) {
        this.registry.workspaces[0].isActive = true
      }
      
      this.saveRegistry()
      
      this.recordPerformanceMetric({
        operationType: 'delete',
        duration: Date.now() - startTime,
        success: true,
        workspaceId
      })
      
      return { success: true }
    } catch (error) {
      this.recordPerformanceMetric({
        operationType: 'delete',
        duration: Date.now() - startTime,
        success: false,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Check if there are existing workspaces that need migration
   */
  public async hasExistingWorkspaces(): Promise<boolean> {
    return this.registry.workspaces.length > 0
  }

  public async getWorkspaceList(): Promise<Array<WorkspaceMetadata & { id: string, name: string, isActive: boolean }>> {
    try {
      const workspaces = await Promise.all(
        this.registry.workspaces.map(async (registryEntry) => {
          try {
            const config = await this.loadWorkspaceConfig(registryEntry.id)
            return {
              id: registryEntry.id,
              name: registryEntry.name,
              isActive: registryEntry.isActive,
              createdAt: registryEntry.createdAt,
              updatedAt: registryEntry.updatedAt,
              lastAccessedAt: registryEntry.lastAccessedAt,
              // Default metadata - in a full implementation, this would be stored separately
              description: `Workspace for ${registryEntry.name}`,
              tags: [],
              color: '#3b82f6',
              icon: '📁',
              totalProcessingTime: 0,
              totalProcessedFiles: 0,
              autoSaveEnabled: true,
              backupRetentionDays: 30
            }
          } catch (error) {
            console.warn(`Failed to load workspace ${registryEntry.id}:`, error)
            return null
          }
        })
      )
      
      return workspaces.filter(Boolean) as Array<WorkspaceMetadata & { id: string, name: string, isActive: boolean }>
    } catch (error) {
      console.error('Failed to get workspace list:', error)
      return []
    }
  }

  // Configuration Management
  public async syncWorkspaceConfig(workspaceId: string, config: AppConfig): Promise<void> {
    const startTime = Date.now()
    
    try {
      const workspace = this.registry.workspaces.find(w => w.id === workspaceId)
      if (!workspace) {
        throw this.createWorkspaceError('WORKSPACE_NOT_FOUND', 'Workspace not found', workspaceId)
      }
      
      // Load current config
      const currentConfig = await this.loadWorkspaceConfig(workspaceId)
      
      // Create updated config
      const updatedConfig: WorkspaceConfig = {
        ...currentConfig,
        ...config,
        workspaceId,
        lastModified: Date.now(),
        version: (currentConfig.version || 1) + 1
      }
      
      // Save updated config
      await writeFile(workspace.configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
      
      // Update registry
      workspace.updatedAt = Date.now()
      this.saveRegistry()
      
      this.recordPerformanceMetric({
        operationType: 'update',
        duration: Date.now() - startTime,
        success: true,
        workspaceId
      })
    } catch (error) {
      this.recordPerformanceMetric({
        operationType: 'update',
        duration: Date.now() - startTime,
        success: false,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  public async getWorkspaceConfig(workspaceId: string): Promise<AppConfig | null> {
    try {
      return await this.loadWorkspaceConfig(workspaceId)
    } catch (error) {
      console.error(`Failed to get workspace config for ${workspaceId}:`, error)
      return null
    }
  }

  private async loadWorkspaceConfig(workspaceId: string): Promise<WorkspaceConfig> {
    const workspace = this.registry.workspaces.find(w => w.id === workspaceId)
    if (!workspace) {
      throw this.createWorkspaceError('WORKSPACE_NOT_FOUND', 'Workspace not found', workspaceId)
    }
    
    try {
      const configData = await readFile(workspace.configPath, 'utf-8')
      return JSON.parse(configData)
    } catch (error) {
      throw this.createWorkspaceError('STORAGE_UNAVAILABLE', 'Failed to load workspace config', workspaceId)
    }
  }

  // Migration Support
  public async createMigrationBackup(): Promise<{ success: boolean, backupPath: string }> {
    const startTime = Date.now()
    
    try {
      const backupId = `migration_${Date.now()}`
      const backupPath = join(this.backupsDir, `${backupId}.json`)
      
      // Create comprehensive backup
      const backupData = {
        registry: this.registry,
        workspaceConfigs: {},
        createdAt: Date.now(),
        version: 1
      }
      
      // Include all workspace configs
      for (const workspace of this.registry.workspaces) {
        try {
          const config = await this.loadWorkspaceConfig(workspace.id)
          backupData.workspaceConfigs[workspace.id] = config
        } catch (error) {
          console.warn(`Failed to backup config for workspace ${workspace.id}:`, error)
        }
      }
      
      await writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8')
      
      // Update migration status
      this.migrationStatus = {
        isInProgress: true,
        currentPhase: 'backup_created',
        totalPhases: 3,
        completedPhases: 1,
        startTime: Date.now(),
        canRollback: true,
        backupPath
      }
      
      this.recordPerformanceMetric({
        operationType: 'backup',
        duration: Date.now() - startTime,
        success: true
      })
      
      return { success: true, backupPath }
    } catch (error) {
      this.recordPerformanceMetric({
        operationType: 'backup',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  public async validateMigration(): Promise<{ success: boolean, issues: string[] }> {
    const issues: string[] = []
    
    try {
      // Validate registry integrity
      if (!this.registry.version || !Array.isArray(this.registry.workspaces)) {
        issues.push('Registry structure is invalid')
      }
      
      // Validate workspace configs
      for (const workspace of this.registry.workspaces) {
        try {
          await access(workspace.configPath)
          const config = await this.loadWorkspaceConfig(workspace.id)
          if (!config.workspaceId || config.workspaceId !== workspace.id) {
            issues.push(`Workspace ${workspace.id} has inconsistent configuration`)
          }
        } catch (error) {
          issues.push(`Workspace ${workspace.id} config is inaccessible`)
        }
      }
      
      // Validate active workspace consistency
      const activeWorkspaces = this.registry.workspaces.filter(w => w.isActive)
      if (activeWorkspaces.length > 1) {
        issues.push('Multiple active workspaces detected')
      }
      
      return { success: issues.length === 0, issues }
    } catch (error) {
      issues.push(`Migration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { success: false, issues }
    }
  }

  public async rollbackMigration(): Promise<{ success: boolean }> {
    try {
      if (!this.migrationStatus?.backupPath) {
        throw new Error('No migration backup available')
      }
      
      // Load backup data
      const backupData = JSON.parse(await readFile(this.migrationStatus.backupPath, 'utf-8'))
      
      // Restore registry
      this.registry = backupData.registry
      this.saveRegistry()
      
      // Restore workspace configs
      for (const [workspaceId, config] of Object.entries(backupData.workspaceConfigs)) {
        const workspace = this.registry.workspaces.find(w => w.id === workspaceId)
        if (workspace) {
          await writeFile(workspace.configPath, JSON.stringify(config, null, 2), 'utf-8')
        }
      }
      
      // Clear migration status
      this.migrationStatus = null
      
      return { success: true }
    } catch (error) {
      console.error('Migration rollback failed:', error)
      return { success: false }
    }
  }

  public getMigrationStatus(): MigrationStatus | null {
    return this.migrationStatus
  }

  // Backup & Recovery
  public async createWorkspaceBackup(workspaceId: string, description?: string): Promise<string> {
    const startTime = Date.now()
    
    try {
      const workspace = this.registry.workspaces.find(w => w.id === workspaceId)
      if (!workspace) {
        throw this.createWorkspaceError('WORKSPACE_NOT_FOUND', 'Workspace not found', workspaceId)
      }
      
      const backupId = `${workspaceId}_${Date.now()}`
      const backupPath = join(this.backupsDir, `${backupId}.json`)
      
      // Create backup data
      const config = await this.loadWorkspaceConfig(workspaceId)
      const backupData = {
        workspace: {
          id: workspaceId,
          name: workspace.name,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          config
        },
        backup: {
          id: backupId,
          createdAt: Date.now(),
          description: description || 'Manual backup',
          version: 1
        }
      }
      
      await writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8')
      
      this.recordPerformanceMetric({
        operationType: 'backup',
        duration: Date.now() - startTime,
        success: true,
        workspaceId
      })
      
      return backupPath
    } catch (error) {
      this.recordPerformanceMetric({
        operationType: 'backup',
        duration: Date.now() - startTime,
        success: false,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  public async restoreWorkspaceFromBackup(backupPath: string): Promise<Workspace> {
    try {
      const backupData = JSON.parse(await readFile(backupPath, 'utf-8'))
      const workspaceData = backupData.workspace
      
      if (!workspaceData || !workspaceData.id) {
        throw this.createWorkspaceError('VALIDATION_ERROR', 'Invalid backup data')
      }
      
      // Restore or create workspace
      let registryEntry = this.registry.workspaces.find(w => w.id === workspaceData.id)
      if (!registryEntry) {
        // Create new registry entry
        const workspaceDir = join(this.workspacesDir, workspaceData.id)
        await mkdir(workspaceDir, { recursive: true })
        
        registryEntry = {
          id: workspaceData.id,
          name: workspaceData.name,
          createdAt: workspaceData.createdAt,
          updatedAt: Date.now(),
          lastAccessedAt: Date.now(),
          isActive: false,
          configPath: join(workspaceDir, 'config.json')
        }
        
        this.registry.workspaces.push(registryEntry)
      }
      
      // Restore config
      await writeFile(registryEntry.configPath, JSON.stringify(workspaceData.config, null, 2), 'utf-8')
      
      // Update registry
      registryEntry.updatedAt = Date.now()
      this.saveRegistry()
      
      return {
        id: workspaceData.id,
        name: workspaceData.name,
        createdAt: workspaceData.createdAt,
        updatedAt: registryEntry.updatedAt,
        lastAccessedAt: registryEntry.lastAccessedAt,
        isActive: registryEntry.isActive,
        config: workspaceData.config,
        metadata: {
          description: `Restored from backup`,
          tags: [],
          color: '#3b82f6',
          icon: '🔄',
          autoSaveEnabled: true,
          backupRetentionDays: 30
        }
      }
    } catch (error) {
      throw this.createWorkspaceError('BACKUP_FAILED', 'Failed to restore from backup', undefined, error)
    }
  }

  // Utility Methods
  private generateWorkspaceId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private isValidWorkspaceName(name: string): boolean {
    return name.length > 0 && name.length <= 100 && !/[<>:"/\\|?*]/.test(name)
  }

  private async removeDirectoryRecursive(dirPath: string): Promise<void> {
    try {
      const items = readdirSync(dirPath)
      
      for (const item of items) {
        const itemPath = join(dirPath, item)
        const stat = statSync(itemPath)
        
        if (stat.isDirectory()) {
          await this.removeDirectoryRecursive(itemPath)
        } else {
          unlinkSync(itemPath)
        }
      }
      
      // Remove the directory itself
      await unlink(dirPath)
    } catch (error) {
      console.warn(`Failed to remove directory ${dirPath}:`, error)
    }
  }

  // Performance and Monitoring
  public getPerformanceMetrics(): WorkspacePerformanceMetrics[] {
    return [...this.performanceMetrics]
  }

  public clearPerformanceMetrics(): void {
    this.performanceMetrics = []
  }
}

// Singleton instance
let workspaceManager: WorkspaceManager | null = null

export function getWorkspaceManager(): WorkspaceManager {
  if (!workspaceManager) {
    workspaceManager = new WorkspaceManager()
  }
  return workspaceManager
}