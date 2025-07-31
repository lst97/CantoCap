// Workspace Store - Enhanced Zustand State Management with Step Configuration Support
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
// UUID v4 generator using Web Crypto API
const generateUUID = (): string => {
  return crypto.randomUUID()
}
import { workspaceDatabase } from '../services/workspace-database'
import { migrationService } from '../services/migration-service'
import { autoSaveEngine } from '../services/auto-save-engine'
import { performanceMonitor } from '../utils/performance-monitor'
import type { 
  Workspace, 
  WorkspaceConfig, 
  WorkspaceMetadata,
  WorkspaceSession,
  SessionType,
  MigrationStatus,
  WorkspaceStore,
  WorkspaceStoreState,
  WorkspaceStoreActions,
  WorkspaceError,
  WorkspacePerformanceMetrics,
  AutoSaveStatus,
  AutoSaveConfig,
  WorkspaceBackup,
  WorkspaceExportData,
  WorkspaceImportOptions,
  WorkspaceValidationResult,
  // Enhanced types for step configuration support
  EnhancedWorkspaceStore,
  EnhancedWorkspaceStoreState,
  EnhancedWorkspaceStoreActions,
  WorkflowStepId,
  StepConfigMap,
  StepConfigUpdate,
  BatchResult,
  StepConfigCache,
  CachedStepConfig,
  CacheConfig,
  CacheMetrics,
  EnhancedWorkspacePerformanceMetrics,
  MigrationResult
} from '../types/workspace'
import { 
  WORKSPACE_CONSTANTS,
  generateStepConfigCacheKey,
  isCacheEntryExpired,
  DEFAULT_STEP_CONFIGS,
  createDefaultStepConfig,
  mergeStepConfigs,
  estimateConfigSize
} from '../types/workspace'

// Validation utilities
function validateWorkspaceName(name: string): boolean {
  return name.length > 0 && 
         name.length <= WORKSPACE_CONSTANTS.MAX_NAME_LENGTH && 
         !/[<>:"/\\|?*]/.test(name)
}

function validateWorkspace(workspace: Workspace): WorkspaceValidationResult {
  const errors: Array<{ field: string; message: string; value: any }> = []
  const warnings: Array<{ field: string; message: string; value: any }> = []

  if (!validateWorkspaceName(workspace.name)) {
    errors.push({
      field: 'name',
      message: 'Invalid workspace name. Must be 1-100 characters and not contain special characters.',
      value: workspace.name
    })
  }

  if (!workspace.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspace.id)) {
    errors.push({
      field: 'id',
      message: 'Invalid workspace ID. Must be a valid UUID v4.',
      value: workspace.id
    })
  }

  if (workspace.metadata?.description && workspace.metadata.description.length > WORKSPACE_CONSTANTS.MAX_DESCRIPTION_LENGTH) {
    warnings.push({
      field: 'metadata.description',
      message: `Description is longer than recommended (${WORKSPACE_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters).`,
      value: workspace.metadata.description
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Enhanced Step Configuration Cache Manager
class StepConfigCacheManager {
  private cache: StepConfigCache = {}
  private config: CacheConfig = WORKSPACE_CONSTANTS.DEFAULT_CACHE_CONFIG
  private metrics: CacheMetrics = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
    totalRequests: 0,
    hitRate: 0,
    averageAccessTime: 0,
    cacheSize: 0,
    entryCount: 0
  }

  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): CacheConfig {
    return { ...this.config }
  }

  async get<T>(workspaceId: string, stepId: WorkflowStepId): Promise<T | null> {
    const startTime = Date.now()
    this.metrics.totalRequests++
    
    const cacheKey = generateStepConfigCacheKey(workspaceId, stepId)
    const cached = this.cache[cacheKey]
    
    if (!cached) {
      this.metrics.missCount++
      this.updateMetrics(startTime)
      return null
    }
    
    // Check expiry
    if (isCacheEntryExpired(cached)) {
      delete this.cache[cacheKey]
      this.metrics.missCount++
      this.metrics.evictionCount++
      this.updateMetrics(startTime)
      return null
    }
    
    // Update access statistics
    cached.accessCount++
    cached.lastAccessed = Date.now()
    
    this.metrics.hitCount++
    this.updateMetrics(startTime)
    
    return cached.data as T
  }

  async set<T>(
    workspaceId: string, 
    stepId: WorkflowStepId, 
    data: T, 
    ttl: number = this.config.defaultTTL
  ): Promise<void> {
    const cacheKey = generateStepConfigCacheKey(workspaceId, stepId)
    const size = estimateConfigSize(data)
    
    // Check size limits
    if (size > this.config.maxSize / 10) { // Don't cache entries larger than 10% of max cache size
      return
    }
    
    // Evict if necessary
    await this.evictIfNecessary(size)
    
    const cachedEntry: CachedStepConfig<T> = {
      data,
      expiryTime: Date.now() + ttl,
      accessCount: 1,
      isDirty: false,
      lastAccessed: Date.now(),
      size
    }
    
    this.cache[cacheKey] = cachedEntry
    this.updateCacheSize()
  }

  async markDirty(workspaceId: string, stepId: WorkflowStepId): Promise<void> {
    const cacheKey = generateStepConfigCacheKey(workspaceId, stepId)
    const cached = this.cache[cacheKey]
    
    if (cached) {
      cached.isDirty = true
    }
  }

  async invalidate(workspaceId?: string, stepId?: WorkflowStepId): Promise<void> {
    if (workspaceId && stepId) {
      // Invalidate specific entry
      const cacheKey = generateStepConfigCacheKey(workspaceId, stepId)
      delete this.cache[cacheKey]
    } else if (workspaceId) {
      // Invalidate all entries for workspace
      Object.keys(this.cache).forEach(key => {
        if (key.startsWith(`${workspaceId}:`)) {
          delete this.cache[key]
        }
      })
    } else {
      // Clear entire cache
      this.cache = {}
    }
    
    this.updateCacheSize()
  }

  getDirtyEntries(): Array<{ workspaceId: string; stepId: WorkflowStepId; data: any }> {
    const dirtyEntries: Array<{ workspaceId: string; stepId: WorkflowStepId; data: any }> = []
    
    Object.entries(this.cache).forEach(([cacheKey, cached]) => {
      if (cached.isDirty) {
        const parts = cacheKey.split(':')
        if (parts.length === 2) {
          dirtyEntries.push({
            workspaceId: parts[0],
            stepId: parts[1] as WorkflowStepId,
            data: cached.data
          })
        }
      }
    })
    
    return dirtyEntries
  }

  clearDirtyFlags(): void {
    Object.values(this.cache).forEach(cached => {
      cached.isDirty = false
    })
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  private async evictIfNecessary(newEntrySize: number): Promise<void> {
    // Check entry count limit
    if (Object.keys(this.cache).length >= this.config.maxEntries) {
      this.evictLRU()
    }
    
    // Check size limit
    while (this.metrics.cacheSize + newEntrySize > this.config.maxSize && Object.keys(this.cache).length > 0) {
      this.evictLRU()
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()
    
    Object.entries(this.cache).forEach(([key, cached]) => {
      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed
        oldestKey = key
      }
    })
    
    if (oldestKey) {
      delete this.cache[oldestKey]
      this.metrics.evictionCount++
    }
  }

  private updateCacheSize(): void {
    this.metrics.cacheSize = Object.values(this.cache).reduce((total, cached) => total + (cached.size || 0), 0)
    this.metrics.entryCount = Object.keys(this.cache).length
  }

  private updateMetrics(startTime: number): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? this.metrics.hitCount / this.metrics.totalRequests 
      : 0
    
    const accessTime = Date.now() - startTime
    this.metrics.averageAccessTime = (this.metrics.averageAccessTime + accessTime) / 2
  }
}

// Performance-optimized Auto-save manager using the new auto-save engine
class PerformanceOptimizedAutoSaveManager {
  private stepConfigCacheManager: StepConfigCacheManager

  constructor(cacheManager: StepConfigCacheManager) {
    this.stepConfigCacheManager = cacheManager
    
    // Initialize performance monitoring
    performanceMonitor.startMonitoring({
      monitoringInterval: 2000,
      enableAutoOptimization: true
    })
  }

  configure(config: Partial<AutoSaveConfig>): void {
    autoSaveEngine.configure(config)
  }

  getStatus(): AutoSaveStatus & { performanceMetrics?: any } {
    const engineStatus = autoSaveEngine.getStatus()
    return {
      ...engineStatus,
      performanceMetrics: engineStatus.performanceMetrics
    }
  }

  async scheduleSave(saveOperation: () => Promise<void>): Promise<void> {
    // For backward compatibility, we'll wrap the operation
    return new Promise((resolve, reject) => {
      // Execute the operation immediately and schedule workspace save
      saveOperation().then(() => {
        resolve()
      }).catch(reject)
    })
  }

  async scheduleStepConfigSave(
    workspaceId: string,
    stepId: WorkflowStepId,
    config: any,
    priority: 'critical' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    // Mark cache as dirty for immediate UI responsiveness
    await this.stepConfigCacheManager.markDirty(workspaceId, stepId)
    
    // Use the performance-optimized auto-save engine
    return autoSaveEngine.scheduleStepConfigSave(workspaceId, stepId, config, priority)
  }

  async scheduleWorkspaceSave(
    workspaceId: string,
    data: any,
    priority: 'critical' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    return autoSaveEngine.scheduleWorkspaceSave(workspaceId, data, priority)
  }

  async flushDirtyStepConfigs(): Promise<void> {
    const dirtyEntries = this.stepConfigCacheManager.getDirtyEntries()
    
    if (dirtyEntries.length === 0) {
      return
    }

    // Group by workspace for batch operations
    const workspaceGroups = dirtyEntries.reduce((groups, entry) => {
      if (!groups[entry.workspaceId]) {
        groups[entry.workspaceId] = []
      }
      groups[entry.workspaceId].push({
        stepId: entry.stepId,
        config: entry.data,
        merge: true
      } as StepConfigUpdate)
      return groups
    }, {} as Record<string, StepConfigUpdate[]>)

    // Use the performance-optimized batch processing
    for (const [workspaceId, updates] of Object.entries(workspaceGroups)) {
      try {
        await workspaceDatabase.batchUpdateStepConfigurations(workspaceId, updates)
      } catch (error) {
        console.error(`Failed to save step configurations for workspace ${workspaceId}:`, error)
      }
    }

    // Clear dirty flags after successful save
    this.stepConfigCacheManager.clearDirtyFlags()
  }

  async flush(): Promise<void> {
    await autoSaveEngine.flush()
    await this.flushDirtyStepConfigs()
  }

  disable(): void {
    autoSaveEngine.disable()
  }

  // Get performance metrics and optimization suggestions
  getPerformanceMetrics() {
    return {
      autoSave: autoSaveEngine.getStatus().performanceMetrics,
      performance: performanceMonitor.getCurrentSnapshot(),
      optimizations: autoSaveEngine.getOptimizationSuggestions()
    }
  }

  // Apply performance optimization
  async applyOptimization(suggestionId: string): Promise<void> {
    return autoSaveEngine.applyOptimizationSuggestion(suggestionId)
  }
}

// Legacy Auto-save manager for backward compatibility
class AutoSaveManager {
  private config: AutoSaveConfig = {
    enabled: true,
    debounceMs: 1500,
    maxRetries: 3,
    batchSize: 1,
    includesSessions: true
  }
  
  private status: AutoSaveStatus = {
    isEnabled: true,
    pendingSaves: 0,
    failedSaves: 0
  }
  
  private debounceTimer: NodeJS.Timeout | null = null
  private saveQueue: Array<() => Promise<void>> = []

  configure(config: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...config }
    this.status.isEnabled = this.config.enabled
  }

  getStatus(): AutoSaveStatus {
    return { ...this.status }
  }

  async scheduleSave(saveOperation: () => Promise<void>): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    this.saveQueue.push(saveOperation)
    this.status.pendingSaves = this.saveQueue.length

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.processSaveQueue()
    }, this.config.debounceMs)

    this.status.nextScheduledSave = Date.now() + this.config.debounceMs
  }

  private async processSaveQueue(): Promise<void> {
    if (this.saveQueue.length === 0) {
      return
    }

    const operations = this.saveQueue.splice(0, this.config.batchSize)
    this.status.pendingSaves = this.saveQueue.length

    for (const operation of operations) {
      let retries = 0
      let success = false

      while (retries < this.config.maxRetries && !success) {
        try {
          await operation()
          success = true
          this.status.lastSaveTime = Date.now()
        } catch (error) {
          retries++
          if (retries >= this.config.maxRetries) {
            this.status.failedSaves++
            console.error('Auto-save failed after maximum retries:', error)
          } else {
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)))
          }
        }
      }
    }

    // Process remaining queue
    if (this.saveQueue.length > 0) {
      setTimeout(() => this.processSaveQueue(), 100)
    }

    this.status.nextScheduledSave = undefined
  }

  disable(): void {
    this.config.enabled = false
    this.status.isEnabled = false
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    
    this.saveQueue = []
    this.status.pendingSaves = 0
  }
}

// Create the enhanced store
export const useWorkspaceStore = create<EnhancedWorkspaceStore>()(
  subscribeWithSelector((set, get) => {
    // Initialize enhanced managers with performance optimization
    const stepConfigCacheManager = new StepConfigCacheManager()
    const performanceOptimizedAutoSaveManager = new PerformanceOptimizedAutoSaveManager(stepConfigCacheManager)
    
    const state: EnhancedWorkspaceStoreState = {
      // Core state (backward compatibility)
      currentWorkspace: null,
      availableWorkspaces: [],
      isInitialized: false,
      isLoading: false,
      migrationStatus: null,
      performanceMetrics: [],
      autoSaveStatus: performanceOptimizedAutoSaveManager.getStatus(),
      lastError: null,
      
      // Enhanced state
      stepConfigCache: {},
      cacheMetrics: stepConfigCacheManager.getMetrics(),
      cacheConfig: stepConfigCacheManager.getConfig(),
      stepConfigMigrationStatus: {
        isEnabled: false,
        inProgress: false,
        completedWorkspaces: [],
        failedWorkspaces: [],
        lastMigrationResult: undefined
      },
      hasAnyWorkspace: false,
      workspaceCount: 0,
      enhancedMetrics: []
    }

    const actions: EnhancedWorkspaceStoreActions = {
      // Initialization
      initializeWorkspaces: async () => {
        if (get().isInitialized) return

        set({ isLoading: true })
        
        try {
          // Wait for database to be ready
          await workspaceDatabase.healthCheck()
          
          // Load all workspaces
          const workspaces = await workspaceDatabase.getAllWorkspaces()
          
          // Find the active workspace or set first as active
          let currentWorkspace = workspaces.find(w => w.isActive) || null
          
          if (!currentWorkspace && workspaces.length > 0) {
            currentWorkspace = workspaces[0]
            currentWorkspace.isActive = true
            currentWorkspace.lastAccessedAt = Date.now()
            await workspaceDatabase.updateWorkspace(currentWorkspace)
          }

          set({
            availableWorkspaces: workspaces,
            currentWorkspace,
            isInitialized: true,
            isLoading: false,
            hasAnyWorkspace: workspaces.length > 0,
            workspaceCount: workspaces.length,
            performanceMetrics: workspaceDatabase.getPerformanceMetrics(),
            enhancedMetrics: workspaceDatabase.getEnhancedPerformanceMetrics(),
            cacheMetrics: stepConfigCacheManager.getMetrics()
          })

        } catch (error) {
          console.error('Failed to initialize workspaces:', error)
          set({ 
            isLoading: false, 
            lastError: error as WorkspaceError
          })
        }
      },

      // Core Workspace Operations
      createWorkspace: async (name: string, config?: Partial<WorkspaceConfig>) => {
        if (!validateWorkspaceName(name)) {
          throw new Error('Invalid workspace name')
        }

        const now = Date.now()
        const workspace: Workspace = {
          id: generateUUID(),
          name,
          createdAt: now,
          updatedAt: now,
          lastAccessedAt: now,
          isActive: false,
          config: {
            // Default config merged with provided config
            inputFile: null,
            outputFile: null,
            language: 'zh',
            model: null,
            priority: 'balanced',
            speakers: false,
            written: true,
            music: false,
            charset: 'traditional',
            geminiKey: '',
            hfToken: '',
            noGeminiRefinement: false,
            maxChunkDuration: 15,
            videoQuality: '360p',
            terminologyConfig: null,
            ffmpegPath: null,
            subtitle: null,
            duration: 10.0,
            verbose: false,
            startTime: null,
            endTime: null,
            importedJsonFile: null,
            workspaceId: '',
            lastModified: now,
            version: WORKSPACE_CONSTANTS.WORKSPACE_VERSION,
            ...config
          },
          metadata: {
            description: '',
            tags: [],
            autoSaveEnabled: true,
            backupRetentionDays: WORKSPACE_CONSTANTS.DEFAULT_BACKUP_RETENTION_DAYS,
            totalProcessingTime: 0,
            totalProcessedFiles: 0
          }
        }

        // Validate workspace
        const validation = validateWorkspace(workspace)
        if (!validation.isValid) {
          throw new Error(`Workspace validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
        }

        try {
          await workspaceDatabase.createWorkspace(workspace)
          
          set(state => ({
            availableWorkspaces: [...state.availableWorkspaces, workspace],
            performanceMetrics: workspaceDatabase.getPerformanceMetrics()
          }))

          return workspace
        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      switchWorkspace: async (workspaceId: string) => {
        const state = get()
        
        if (state.currentWorkspace && state.currentWorkspace.id === workspaceId) {
          return // Already active
        }

        set({ isLoading: true })

        try {
          const workspace = await workspaceDatabase.getWorkspace(workspaceId)
          if (!workspace) {
            throw new Error(`Workspace with id '${workspaceId}' not found`)
          }

          // Deactivate current workspace
          if (state.currentWorkspace) {
            const currentWorkspace = { 
              ...state.currentWorkspace, 
              isActive: false 
            }
            await workspaceDatabase.updateWorkspace(currentWorkspace)

            // Auto-save current workspace with performance optimization
            performanceOptimizedAutoSaveManager.scheduleWorkspaceSave(
              currentWorkspace.id, 
              currentWorkspace, 
              'normal'
            )
          }

          // Activate new workspace
          workspace.isActive = true
          workspace.lastAccessedAt = Date.now()
          await workspaceDatabase.updateWorkspace(workspace)

          // Update state
          set(state => ({
            currentWorkspace: workspace,
            availableWorkspaces: state.availableWorkspaces.map(w => 
              w.id === workspaceId 
                ? workspace 
                : w.id === state.currentWorkspace?.id 
                  ? { ...w, isActive: false }
                  : w
            ),
            isLoading: false,
            performanceMetrics: workspaceDatabase.getPerformanceMetrics()
          }))

        } catch (error) {
          set({ 
            isLoading: false, 
            lastError: error as WorkspaceError 
          })
          throw error
        }
      },

      updateWorkspaceConfig: async (workspaceId: string, config: Partial<WorkspaceConfig>) => {
        const state = get()
        const workspace = state.availableWorkspaces.find(w => w.id === workspaceId)
        
        if (!workspace) {
          throw new Error(`Workspace with id '${workspaceId}' not found`)
        }

        const updatedWorkspace = {
          ...workspace,
          config: { ...workspace.config, ...config },
          updatedAt: Date.now()
        }

        try {
          await workspaceDatabase.updateWorkspace(updatedWorkspace)
          
          set(state => ({
            availableWorkspaces: state.availableWorkspaces.map(w => 
              w.id === workspaceId ? updatedWorkspace : w
            ),
            currentWorkspace: state.currentWorkspace?.id === workspaceId 
              ? updatedWorkspace 
              : state.currentWorkspace,
            performanceMetrics: workspaceDatabase.getPerformanceMetrics()
          }))

          // Schedule performance-optimized auto-save
          performanceOptimizedAutoSaveManager.scheduleWorkspaceSave(
            workspaceId, 
            updatedWorkspace, 
            'normal'
          )

        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      updateWorkspaceMetadata: async (workspaceId: string, metadata: Partial<WorkspaceMetadata>) => {
        const state = get()
        const workspace = state.availableWorkspaces.find(w => w.id === workspaceId)
        
        if (!workspace) {
          throw new Error(`Workspace with id '${workspaceId}' not found`)
        }

        const updatedWorkspace = {
          ...workspace,
          metadata: { ...workspace.metadata, ...metadata },
          updatedAt: Date.now()
        }

        try {
          await workspaceDatabase.updateWorkspace(updatedWorkspace)
          
          set(state => ({
            availableWorkspaces: state.availableWorkspaces.map(w => 
              w.id === workspaceId ? updatedWorkspace : w
            ),
            currentWorkspace: state.currentWorkspace?.id === workspaceId 
              ? updatedWorkspace 
              : state.currentWorkspace
          }))

        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      deleteWorkspace: async (workspaceId: string) => {
        const state = get()
        
        if (state.currentWorkspace?.id === workspaceId) {
          throw new Error('Cannot delete the currently active workspace')
        }

        try {
          await workspaceDatabase.deleteWorkspace(workspaceId)
          
          set(state => ({
            availableWorkspaces: state.availableWorkspaces.filter(w => w.id !== workspaceId),
            performanceMetrics: workspaceDatabase.getPerformanceMetrics()
          }))

        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      duplicateWorkspace: async (workspaceId: string, newName: string) => {
        const state = get()
        const originalWorkspace = state.availableWorkspaces.find(w => w.id === workspaceId)
        
        if (!originalWorkspace) {
          throw new Error(`Workspace with id '${workspaceId}' not found`)
        }

        if (!validateWorkspaceName(newName)) {
          throw new Error('Invalid workspace name')
        }

        const now = Date.now()
        const duplicatedWorkspace: Workspace = {
          ...originalWorkspace,
          id: generateUUID(),
          name: newName,
          createdAt: now,
          updatedAt: now,
          lastAccessedAt: now,
          isActive: false,
          config: {
            ...originalWorkspace.config,
            workspaceId: '',
            lastModified: now
          },
          metadata: {
            ...originalWorkspace.metadata,
            description: originalWorkspace.metadata?.description 
              ? `Copy of ${originalWorkspace.name}` 
              : undefined,
            totalProcessingTime: 0,
            totalProcessedFiles: 0
          }
        }

        try {
          await workspaceDatabase.createWorkspace(duplicatedWorkspace)
          
          set(state => ({
            availableWorkspaces: [...state.availableWorkspaces, duplicatedWorkspace]
          }))

          return duplicatedWorkspace
        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      // Session Management
      saveWorkspaceSession: async (sessionType: SessionType, sessionData: any) => {
        const state = get()
        if (!state.currentWorkspace) {
          throw new Error('No active workspace')
        }

        const session: WorkspaceSession = {
          id: generateUUID(),
          workspaceId: state.currentWorkspace.id,
          sessionType,
          sessionData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true
        }

        try {
          // Deactivate existing sessions of the same type
          const existingSessions = await workspaceDatabase.getWorkspaceSessions(state.currentWorkspace.id)
          for (const existingSession of existingSessions) {
            if (existingSession.sessionType === sessionType && existingSession.isActive) {
              await workspaceDatabase.updateSession({
                ...existingSession,
                isActive: false
              })
            }
          }

          await workspaceDatabase.createSession(session)
        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      loadWorkspaceSession: async (workspaceId: string, sessionType: SessionType) => {
        try {
          const sessions = await workspaceDatabase.getWorkspaceSessions(workspaceId)
          const activeSession = sessions.find(s => 
            s.sessionType === sessionType && s.isActive
          )
          
          return activeSession?.sessionData || null
        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      deleteWorkspaceSession: async (workspaceId: string, sessionType: SessionType) => {
        try {
          const sessions = await workspaceDatabase.getWorkspaceSessions(workspaceId)
          const sessionsToDelete = sessions.filter(s => s.sessionType === sessionType)
          
          for (const session of sessionsToDelete) {
            await workspaceDatabase.deleteSession(session.id)
          }
        } catch (error) {
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      // Performance-Optimized Auto-Save & Persistence
      autoSaveCurrentWorkspace: async () => {
        const state = get()
        if (!state.currentWorkspace) return

        const updatedWorkspace = {
          ...state.currentWorkspace,
          updatedAt: Date.now()
        }

        await performanceOptimizedAutoSaveManager.scheduleWorkspaceSave(
          state.currentWorkspace.id,
          updatedWorkspace,
          'normal'
        )

        set({ autoSaveStatus: performanceOptimizedAutoSaveManager.getStatus() })
      },

      enableAutoSave: (config?: Partial<AutoSaveConfig>) => {
        if (config) {
          performanceOptimizedAutoSaveManager.configure(config)
        }
        set({ autoSaveStatus: performanceOptimizedAutoSaveManager.getStatus() })
      },

      disableAutoSave: () => {
        performanceOptimizedAutoSaveManager.disable()
        set({ autoSaveStatus: performanceOptimizedAutoSaveManager.getStatus() })
      },

      // Performance Monitoring and Optimization
      getPerformanceMetrics: () => {
        return performanceOptimizedAutoSaveManager.getPerformanceMetrics()
      },

      applyPerformanceOptimization: async (suggestionId: string) => {
        await performanceOptimizedAutoSaveManager.applyOptimization(suggestionId)
        set({ autoSaveStatus: performanceOptimizedAutoSaveManager.getStatus() })
      },

      flushPendingSaves: async () => {
        await performanceOptimizedAutoSaveManager.flush()
        set({ autoSaveStatus: performanceOptimizedAutoSaveManager.getStatus() })
      },

      // Migration Operations
      startMigration: async () => {
        try {
          const result = await migrationService.startMigration()
          set({ migrationStatus: migrationService.getMigrationStatus() })
          return result
        } catch (error) {
          set({ 
            lastError: error as WorkspaceError,
            migrationStatus: migrationService.getMigrationStatus()
          })
          throw error
        }
      },

      completeMigration: async () => {
        try {
          const result = await migrationService.completeMigration()
          set({ migrationStatus: migrationService.getMigrationStatus() })
          
          // Reinitialize workspaces after successful migration
          if (result.success) {
            await get().initializeWorkspaces()
          }
          
          return result
        } catch (error) {
          set({ 
            lastError: error as WorkspaceError,
            migrationStatus: migrationService.getMigrationStatus()
          })
          throw error
        }
      },

      rollbackMigration: async () => {
        try {
          const result = await migrationService.rollbackMigration()
          set({ migrationStatus: migrationService.getMigrationStatus() })
          return result
        } catch (error) {
          set({ 
            lastError: error as WorkspaceError,
            migrationStatus: migrationService.getMigrationStatus()
          })
          throw error
        }
      },

      getMigrationStatus: async () => {
        const status = migrationService.getMigrationStatus()
        set({ migrationStatus: status })
        return status
      },

      // Backup and Recovery (basic implementations)
      createBackup: async (workspaceId: string, description?: string) => {
        // Placeholder implementation
        const backup: WorkspaceBackup = {
          id: generateUUID(),
          workspaceId,
          backupPath: `backup_${workspaceId}_${Date.now()}`,
          createdAt: Date.now(),
          size: 0,
          isAutomatic: false,
          description,
          configSnapshot: {} as WorkspaceConfig
        }
        return backup
      },

      restoreFromBackup: async (backupId: string) => {
        throw new Error('Backup operations not yet implemented')
      },

      listBackups: async (workspaceId: string) => {
        return []
      },

      deleteBackup: async (backupId: string) => {
        // Placeholder
      },

      // Import/Export (basic implementations)
      exportWorkspace: async (workspaceId: string, format) => {
        const workspace = await workspaceDatabase.getWorkspace(workspaceId)
        if (!workspace) {
          throw new Error(`Workspace with id '${workspaceId}' not found`)
        }

        const sessions = await workspaceDatabase.getWorkspaceSessions(workspaceId)
        
        return {
          workspace,
          sessions: format === 'config_only' ? [] : sessions,
          backups: [],
          metadata: {
            exportedAt: Date.now(),
            version: WORKSPACE_CONSTANTS.WORKSPACE_VERSION.toString(),
            format
          }
        }
      },

      importWorkspace: async (data: WorkspaceExportData, options: WorkspaceImportOptions) => {
        const workspace = data.workspace
        
        if (options.overwriteExisting) {
          const existing = await workspaceDatabase.getWorkspace(workspace.id)
          if (existing) {
            await workspaceDatabase.updateWorkspace(workspace)
          } else {
            await workspaceDatabase.createWorkspace(workspace)
          }
        } else {
          workspace.id = generateUUID()
          await workspaceDatabase.createWorkspace(workspace)
        }

        if (options.includesSessions && data.sessions) {
          for (const session of data.sessions) {
            session.workspaceId = workspace.id
            session.id = generateUUID()
            await workspaceDatabase.createSession(session)
          }
        }

        set(state => ({
          availableWorkspaces: [...state.availableWorkspaces, workspace]
        }))

        return workspace
      },

      // Validation and Integrity
      validateWorkspace: (workspace: Workspace) => {
        return validateWorkspace(workspace)
      },

      repairWorkspace: async (workspaceId: string) => {
        // Placeholder implementation
        return { success: true, issues: [] }
      },

      clearPerformanceMetrics: () => {
        workspaceDatabase.clearPerformanceMetrics()
        set({ performanceMetrics: [] })
      },

      // Error Handling
      clearError: () => {
        set({ lastError: null })
      },

      handleError: (error: WorkspaceError) => {
        console.error('Workspace error:', error)
        set({ lastError: error })
      },

      // ============================================================================
      // STEP CONFIGURATION MANAGEMENT
      // ============================================================================

      getStepConfig: async <T extends StepConfigMap[K], K extends WorkflowStepId>(
        workspaceId: string,
        stepId: K
      ): Promise<T | null> => {
        try {
          // Try cache first
          const cached = await stepConfigCacheManager.get<T>(workspaceId, stepId)
          if (cached !== null) {
            return cached
          }

          // Load from database
          const config = await workspaceDatabase.getStepConfiguration<T, K>(workspaceId, stepId)
          
          // Cache the result
          if (config) {
            await stepConfigCacheManager.set(workspaceId, stepId, config)
          }

          return config

        } catch (error) {
          console.error(`Failed to get step config for ${stepId}:`, error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      setStepConfig: async <T extends StepConfigMap[K], K extends WorkflowStepId>(
        workspaceId: string,
        stepId: K,
        config: Partial<T>,
        options: {
          merge?: boolean
          skipValidation?: boolean
          skipCache?: boolean
          createBackup?: boolean
        } = {}
      ): Promise<void> => {
        try {
          const { merge = true, skipCache = false } = options

          // Update cache immediately for responsiveness
          if (!skipCache) {
            const existing = await stepConfigCacheManager.get<T>(workspaceId, stepId)
            const finalConfig = existing && merge ? mergeStepConfigs(stepId, existing, config) : config
            await stepConfigCacheManager.set(workspaceId, stepId, finalConfig)
          }

          // Schedule performance-optimized database save
          await performanceOptimizedAutoSaveManager.scheduleStepConfigSave(workspaceId, stepId, config, 'normal')

          // Update cache metrics in state
          set(state => ({
            cacheMetrics: stepConfigCacheManager.getMetrics(),
            autoSaveStatus: performanceOptimizedAutoSaveManager.getStatus()
          }))

        } catch (error) {
          console.error(`Failed to set step config for ${stepId}:`, error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      getMultipleStepConfigs: async (
        workspaceId: string,
        stepIds: WorkflowStepId[]
      ): Promise<Partial<Record<WorkflowStepId, any>>> => {
        try {
          const result: Partial<Record<WorkflowStepId, any>> = {}
          const uncachedStepIds: WorkflowStepId[] = []

          // Check cache first
          for (const stepId of stepIds) {
            const cached = await stepConfigCacheManager.get(workspaceId, stepId)
            if (cached !== null) {
              result[stepId] = cached
            } else {
              uncachedStepIds.push(stepId)
            }
          }

          // Load uncached configurations from database
          if (uncachedStepIds.length > 0) {
            const dbConfigs = await workspaceDatabase.getMultipleStepConfigurations(workspaceId, uncachedStepIds)
            
            // Cache and add to result
            for (const [stepId, config] of Object.entries(dbConfigs)) {
              result[stepId as WorkflowStepId] = config
              await stepConfigCacheManager.set(workspaceId, stepId as WorkflowStepId, config)
            }
          }

          return result

        } catch (error) {
          console.error('Failed to get multiple step configs:', error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      batchUpdateStepConfigs: async (
        workspaceId: string,
        updates: StepConfigUpdate[]
      ): Promise<BatchResult> => {
        try {
          // Update cache for immediate responsiveness
          for (const update of updates) {
            const existing = await stepConfigCacheManager.get(workspaceId, update.stepId)
            const finalConfig = existing && update.merge 
              ? mergeStepConfigs(update.stepId, existing, update.config)
              : update.config
            await stepConfigCacheManager.set(workspaceId, update.stepId, finalConfig)
          }

          // Perform batch database update
          const result = await workspaceDatabase.batchUpdateStepConfigurations(workspaceId, updates)

          // Update state
          set(state => ({
            cacheMetrics: stepConfigCacheManager.getMetrics(),
            enhancedMetrics: workspaceDatabase.getEnhancedPerformanceMetrics()
          }))

          return result

        } catch (error) {
          console.error('Failed to batch update step configs:', error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      resetStepConfig: async <K extends WorkflowStepId>(
        workspaceId: string,
        stepId: K
      ): Promise<void> => {
        try {
          const defaultConfig = createDefaultStepConfig(stepId)
          await actions.setStepConfig(workspaceId, stepId, defaultConfig, { merge: false })
        } catch (error) {
          console.error(`Failed to reset step config for ${stepId}:`, error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      validateStepConfig: async <T extends StepConfigMap[K], K extends WorkflowStepId>(
        workspaceId: string,
        stepId: K,
        config: Partial<T>
      ): Promise<{
        isValid: boolean
        errors: string[]
        warnings: string[]
      }> => {
        // Basic validation - can be enhanced
        const errors: string[] = []
        const warnings: string[] = []

        if (!config || typeof config !== 'object') {
          errors.push('Configuration must be an object')
        }

        // Size validation
        const configSize = estimateConfigSize(config)
        if (configSize > WORKSPACE_CONSTANTS.MAX_STEP_CONFIG_SIZE) {
          errors.push(`Configuration too large (${configSize} bytes, max ${WORKSPACE_CONSTANTS.MAX_STEP_CONFIG_SIZE})`)
        }

        if (configSize > WORKSPACE_CONSTANTS.CONFIG_SIZE_WARNING_THRESHOLD) {
          warnings.push(`Configuration is large (${configSize} bytes)`)
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings
        }
      },

      // ============================================================================
      // CACHE MANAGEMENT
      // ============================================================================

      clearStepConfigCache: async (workspaceId?: string, stepId?: WorkflowStepId): Promise<void> => {
        try {
          await stepConfigCacheManager.invalidate(workspaceId, stepId)
          await workspaceDatabase.clearStepConfigCache(workspaceId, stepId)
          
          set(state => ({
            cacheMetrics: stepConfigCacheManager.getMetrics()
          }))
        } catch (error) {
          console.error('Failed to clear step config cache:', error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      refreshStepConfigCache: async (
        workspaceId: string,
        stepIds?: WorkflowStepId[]
      ): Promise<void> => {
        try {
          // Clear existing cache entries
          if (stepIds) {
            for (const stepId of stepIds) {
              await stepConfigCacheManager.invalidate(workspaceId, stepId)
            }
          } else {
            await stepConfigCacheManager.invalidate(workspaceId)
          }

          // Reload from database
          const configs = await workspaceDatabase.getMultipleStepConfigurations(
            workspaceId, 
            stepIds || ['input-file', 'config', 'processing', 'review', 'export']
          )

          // Populate cache
          for (const [stepId, config] of Object.entries(configs)) {
            await stepConfigCacheManager.set(workspaceId, stepId as WorkflowStepId, config)
          }

          set(state => ({
            cacheMetrics: stepConfigCacheManager.getMetrics()
          }))
        } catch (error) {
          console.error('Failed to refresh step config cache:', error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      getCacheMetrics: (): CacheMetrics => {
        return stepConfigCacheManager.getMetrics()
      },

      configureCaching: (config: Partial<CacheConfig>): void => {
        stepConfigCacheManager.configure(config)
        set(state => ({
          cacheConfig: stepConfigCacheManager.getConfig()
        }))
      },

      // ============================================================================
      // EMPTY STATE MANAGEMENT
      // ============================================================================

      hasAnyWorkspace: (): boolean => {
        return get().availableWorkspaces.length > 0
      },

      getWorkspaceCount: (): number => {
        return get().availableWorkspaces.length
      },

      isStepConfigEnabled: async (workspaceId: string): Promise<boolean> => {
        try {
          const workspace = await workspaceDatabase.getWorkspace(workspaceId)
          return workspace?.config._stepConfigsEnabled === true
        } catch (error) {
          console.error('Failed to check step config status:', error)
          return false
        }
      },

      // ============================================================================
      // MIGRATION SUPPORT
      // ============================================================================

      migrateToStepConfigs: async (workspaceId?: string): Promise<MigrationResult> => {
        const result: MigrationResult = {
          success: false,
          migratedWorkspaces: [],
          errors: [],
          rollbackData: undefined,
          statistics: {
            totalWorkspaces: 0,
            successfulMigrations: 0,
            failedMigrations: 0,
            skippedWorkspaces: 0,
            migrationTime: Date.now()
          }
        }

        try {
          set(state => ({
            stepConfigMigrationStatus: {
              ...state.stepConfigMigrationStatus,
              inProgress: true
            }
          }))

          // Get workspaces to migrate
          const workspacesToMigrate = workspaceId 
            ? [await workspaceDatabase.getWorkspace(workspaceId)].filter(Boolean)
            : await workspaceDatabase.getAllWorkspaces()

          result.statistics.totalWorkspaces = workspacesToMigrate.length

          for (const workspace of workspacesToMigrate) {
            try {
              // Skip if already migrated
              if (workspace.config._stepConfigsEnabled) {
                result.statistics.skippedWorkspaces++
                continue
              }

              // TODO: Implement actual migration logic
              // This would involve mapping legacy config to step configs
              
              // Mark as migrated
              workspace.config._stepConfigsEnabled = true
              await workspaceDatabase.updateWorkspace(workspace)
              
              result.migratedWorkspaces.push(workspace.id)
              result.statistics.successfulMigrations++

            } catch (error) {
              result.errors.push({
                workspaceId: workspace.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                code: 'MIGRATION_FAILED',
                recoverable: true
              })
              result.statistics.failedMigrations++
            }
          }

          result.success = result.errors.length === 0
          result.statistics.migrationTime = Date.now() - result.statistics.migrationTime

          set(state => ({
            stepConfigMigrationStatus: {
              ...state.stepConfigMigrationStatus,
              inProgress: false,
              completedWorkspaces: result.migratedWorkspaces,
              failedWorkspaces: result.errors.map(e => e.workspaceId),
              lastMigrationResult: result
            }
          }))

          return result

        } catch (error) {
          console.error('Migration failed:', error)
          set(state => ({
            stepConfigMigrationStatus: {
              ...state.stepConfigMigrationStatus,
              inProgress: false
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      needsStepConfigMigration: async (workspaceId: string): Promise<boolean> => {
        try {
          const workspace = await workspaceDatabase.getWorkspace(workspaceId)
          return workspace ? !workspace.config._stepConfigsEnabled : false
        } catch (error) {
          console.error('Failed to check migration status:', error)
          return false
        }
      },

      rollbackStepConfigMigration: async (
        workspaceId: string,
        rollbackData: MigrationResult['rollbackData']
      ): Promise<void> => {
        // TODO: Implement rollback logic
        throw new Error('Rollback not yet implemented')
      },

      // ============================================================================
      // ENHANCED PERFORMANCE MONITORING
      // ============================================================================

      getEnhancedPerformanceMetrics: (): EnhancedWorkspacePerformanceMetrics[] => {
        return workspaceDatabase.getEnhancedPerformanceMetrics()
      },

      clearEnhancedPerformanceMetrics: (): void => {
        workspaceDatabase.clearPerformanceMetrics()
        set({ 
          performanceMetrics: [],
          enhancedMetrics: []
        })
      },

      // ============================================================================
      // UTILITY METHODS
      // ============================================================================

      exportStepConfigs: async (
        workspaceId: string,
        stepIds?: WorkflowStepId[]
      ): Promise<Record<WorkflowStepId, any>> => {
        try {
          const allStepIds = stepIds || ['input-file', 'config', 'processing', 'review', 'export']
          const configs = await workspaceDatabase.getMultipleStepConfigurations(workspaceId, allStepIds)
          return configs as Record<WorkflowStepId, any>
        } catch (error) {
          console.error('Failed to export step configs:', error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      },

      importStepConfigs: async (
        workspaceId: string,
        stepConfigs: Partial<Record<WorkflowStepId, any>>,
        options: {
          overwrite?: boolean
          skipValidation?: boolean
          createBackup?: boolean
        } = {}
      ): Promise<BatchResult> => {
        try {
          const updates: StepConfigUpdate[] = Object.entries(stepConfigs).map(([stepId, config]) => ({
            stepId: stepId as WorkflowStepId,
            config,
            merge: !options.overwrite
          }))

          return await actions.batchUpdateStepConfigs(workspaceId, updates)
        } catch (error) {
          console.error('Failed to import step configs:', error)
          set({ lastError: error as WorkspaceError })
          throw error
        }
      }
    }

    return { ...state, ...actions }
  })
)

// Auto-save subscription
useWorkspaceStore.subscribe(
  (state) => state.currentWorkspace,
  (currentWorkspace, previousWorkspace) => {
    if (currentWorkspace && currentWorkspace !== previousWorkspace) {
      // Trigger auto-save when workspace changes
      const store = useWorkspaceStore.getState()
      store.autoSaveCurrentWorkspace()
    }
  },
  { equalityFn: (a, b) => a?.id === b?.id && a?.updatedAt === b?.updatedAt }
)