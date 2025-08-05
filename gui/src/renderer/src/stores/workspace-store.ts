// Workspace Store - Enhanced Zustand State Management with Step Configuration Support
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
// UUID v4 generator using Web Crypto API
const generateUUID = (): string => {
  return crypto.randomUUID()
}
import { workspaceDatabase } from '../services/workspace/workspace-database'
import { migrationService } from '../services/migration-service'
// REMOVED: auto-save-engine - timer-based auto-save system deleted
import { performanceMonitor } from '../utils/performance-monitor'
import type { 
  Workspace, 
  WorkspaceConfig, 
  WorkspaceMetadata,
  // REMOVED: WorkspaceSession, SessionType (legacy - replaced by step states)
  WorkspaceError,
  AutoSaveStatus,
  AutoSaveConfig,
  WorkspaceBackup,
  WorkspaceExportData,
  WorkspaceImportOptions,
  WorkspaceValidationResult,
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
  MigrationResult,
  // Workspace grouping types
  WorkspaceGroup,
  WorkspaceWithGrouping,
  WorkspaceGroupColor,
  WorkspaceGroupingState,
  WorkspaceGroupingActions,
  GroupOperationResult,
  DragOperation,
  EnhancedWorkspaceStoreWithGrouping
} from '../types/workspace'
import { 
  WORKSPACE_CONSTANTS,
  generateStepConfigCacheKey,
  isCacheEntryExpired,
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

// Grouping validation functions
function validateGroupName(name: string): boolean {
  return name.length > 0 && 
         name.length <= WORKSPACE_CONSTANTS.MAX_NAME_LENGTH && 
         !/[<>:"/\\|?*]/.test(name)
}

function validateWorkspaceGroup(group: WorkspaceGroup): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!validateGroupName(group.name)) {
    errors.push('Invalid group name. Must be 1-100 characters and not contain special characters.')
  }

  if (!group.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(group.id)) {
    errors.push('Invalid group ID. Must be a valid UUID v4.')
  }

  if (group.position < 0) {
    errors.push('Group position must be non-negative.')
  }

  const validColors: WorkspaceGroupColor[] = [
    'blue', 'green', 'red', 'yellow', 'purple', 'pink', 'orange', 'teal', 'gray', 'cyan'
  ]
  if (!validColors.includes(group.color)) {
    errors.push(`Invalid group color. Must be one of: ${validColors.join(', ')}.`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

function validateDragOperation(
  operation: DragOperation,
  draggedItem: { type: 'workspace' | 'group'; id: string; sourceGroupId?: string | null },
  dropTarget: { type: 'workspace' | 'group' | 'empty-space'; id?: string; groupId?: string | null },
  currentState: { groups: WorkspaceGroup[]; workspaceGroupMappings: Record<string, string | null> }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  switch (operation) {
    case 'move-to-group':
      if (draggedItem.type !== 'workspace') {
        errors.push('Only workspaces can be moved to groups.')
      }
      if (dropTarget.type !== 'group') {
        errors.push('Target must be a group for move-to-group operation.')
      }
      if (draggedItem.sourceGroupId === dropTarget.id) {
        errors.push('Cannot move workspace to the same group.')
      }
      if (!currentState.groups.find(g => g.id === dropTarget.id)) {
        errors.push('Target group does not exist.')
      }
      break

    case 'ungroup-workspace':
      if (draggedItem.type !== 'workspace') {
        errors.push('Only workspaces can be ungrouped.')
      }
      if (!draggedItem.sourceGroupId) {
        errors.push('Workspace is not in a group.')
      }
      break

    case 'reorder-workspace':
      if (draggedItem.type !== 'workspace') {
        errors.push('Only workspaces can be reordered.')
      }
      if (draggedItem.id === dropTarget.id) {
        errors.push('Cannot reorder workspace to its current position.')
      }
      break

    case 'reorder-group':
      if (draggedItem.type !== 'group') {
        errors.push('Only groups can be reordered.')
      }
      if (draggedItem.id === dropTarget.id) {
        errors.push('Cannot reorder group to its current position.')
      }
      break

    case 'create-group':
      // This operation has specific UI validation requirements
      if (draggedItem.type !== 'workspace') {
        errors.push('Only workspaces can be used to create groups.')
      }
      break

    default:
      errors.push(`Unknown drag operation: ${operation}`)
  }

  return {
    isValid: errors.length === 0,
    errors
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
    // REMOVED: auto-save-engine - timer-based auto-save system deleted
    console.log('Auto-save configure called (no-op)')
  }

  getStatus(): AutoSaveStatus & { performanceMetrics?: any } {
    // REMOVED: auto-save-engine - timer-based auto-save system deleted
    return {
      isEnabled: false,
      pendingSaves: 0,
      failedSaves: 0,
      performanceMetrics: null
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
    
    // REMOVED: auto-save-engine - now using event-driven config system
    console.log('Step config save scheduled (no-op - using event-driven system)')
    return Promise.resolve()
  }

  // PERFORMANCE FIX: Memoize workspace save calls to prevent duplicate logs
  private lastWorkspaceSaveCall = new Map<string, { timestamp: number, data: string }>()
  private lastLogTime = 0
  
  async scheduleWorkspaceSave(
    workspaceId: string,
    data: any,
    priority: 'critical' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    // PERFORMANCE FIX: Skip duplicate save calls within 100ms window
    const dataString = JSON.stringify(data)
    const now = Date.now()
    const lastCall = this.lastWorkspaceSaveCall.get(workspaceId)
    
    if (lastCall && now - lastCall.timestamp < 100 && lastCall.data === dataString) {
      // Skip duplicate save call
      return Promise.resolve()
    }
    
    this.lastWorkspaceSaveCall.set(workspaceId, { timestamp: now, data: dataString })
    
    // REMOVED: auto-save-engine - now using event-driven config system
    // Only log in development and with throttling
    if (process.env.NODE_ENV === 'development' && now - (this.lastLogTime || 0) > 5000) {
      console.log('🔧 [PERFORMANCE] Workspace save scheduled (no-op - using event-driven system)', {
        workspaceId,
        priority,
        dataSize: dataString.length,
        timestamp: new Date().toISOString()
      })
      this.lastLogTime = now
    }
    return Promise.resolve()
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
    // REMOVED: auto-save-engine - now using event-driven config system
    await this.flushDirtyStepConfigs()
  }

  disable(): void {
    // REMOVED: auto-save-engine - now using event-driven config system
    console.log('Auto-save disable called (no-op)')
  }

  // Get performance metrics and optimization suggestions
  getPerformanceMetrics() {
    return {
      autoSave: null, // REMOVED: auto-save-engine performance metrics
      performance: performanceMonitor.getCurrentSnapshot(),
      optimizations: [] // REMOVED: auto-save-engine optimizations
    }
  }

  // Apply performance optimization
  async applyOptimization(suggestionId: string): Promise<void> {
    // REMOVED: auto-save-engine - now using event-driven config system
    console.log('Apply optimization called (no-op):', suggestionId)
    return Promise.resolve()
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

// Create the enhanced store with grouping support
export const useWorkspaceStore = create<EnhancedWorkspaceStoreWithGrouping>()(
  subscribeWithSelector((set, get) => {
    // Initialize enhanced managers with performance optimization
    const stepConfigCacheManager = new StepConfigCacheManager()
    const performanceOptimizedAutoSaveManager = new PerformanceOptimizedAutoSaveManager(stepConfigCacheManager)
    
    const state: EnhancedWorkspaceStoreState & { grouping: WorkspaceGroupingState } = {
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
      enhancedMetrics: [],
      
      // Workspace grouping state
      grouping: {
        groups: [],
        workspaceGroupMappings: {},
        dragState: {
          draggedItem: null,
          dropTarget: null,
          isDragging: false
        },
        isGroupOperationLoading: false
      }
    }

    const actions: EnhancedWorkspaceStoreActions = {
      // Initialization
      initializeWorkspaces: async () => {
        if (get().isInitialized) return

        set({ isLoading: true })
        
        try {
          // Wait for database to be ready
          await workspaceDatabase.healthCheck()
          
          // Migrate existing workspaces to support grouping
          await workspaceDatabase.migrateWorkspacesToGrouping()
          
          // Load all workspaces with grouping data
          const workspaces = await workspaceDatabase.getAllWorkspacesWithGrouping()
          
          // Load workspace groups and mappings
          const [groups, mappings] = await Promise.all([
            workspaceDatabase.getAllWorkspaceGroups(),
            workspaceDatabase.getWorkspaceGroupMappings()
          ])
          
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
            cacheMetrics: stepConfigCacheManager.getMetrics(),
            grouping: {
              groups,
              workspaceGroupMappings: mappings,
              dragState: {
                draggedItem: null,
                dropTarget: null,
                isDragging: false
              },
              isGroupOperationLoading: false
            }
          })

        } catch (error) {
          console.error('Failed to initialize workspaces:', error)
          set({ 
            isLoading: false, 
            lastError: error as WorkspaceError
          })
        }
      },

      // Core Workspace Operations (with grouping support)
      createWorkspace: async (name: string, config?: Partial<WorkspaceConfig>, groupId?: string | null) => {
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
          
          // Add workspace to group if specified
          if (groupId !== undefined) {
            const state = get()
            const position = state.grouping.groups.find(g => g.id === groupId)?.metadata?.workspaceCount || 0
            await workspaceDatabase.addWorkspaceToGroup(workspace.id, groupId, position)
          }
          
          // Create enhanced workspace with grouping info
          const workspaceWithGrouping: WorkspaceWithGrouping = {
            ...workspace,
            groupId: groupId || null,
            positionInGroup: 0
          }
          
          set(state => ({
            availableWorkspaces: [...state.availableWorkspaces, workspaceWithGrouping],
            performanceMetrics: workspaceDatabase.getPerformanceMetrics(),
            grouping: {
              ...state.grouping,
              workspaceGroupMappings: {
                ...state.grouping.workspaceGroupMappings,
                [workspace.id]: groupId || null
              }
            }
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

      // REMOVED: Legacy Session Management (replaced by step state system)
      // saveWorkspaceSession, loadWorkspaceSession, deleteWorkspaceSession methods removed
      // Use step configuration system instead via setStepConfig/getStepConfig

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

        // REMOVED: Legacy session export (replaced by step configurations)
        const stepConfigs = await workspaceDatabase.getStepConfigurations(workspaceId)
        
        return {
          workspace,
          sessions: [], // Legacy sessions removed - use stepConfigs instead
          stepConfigurations: format === 'config_only' ? [] : stepConfigs,
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

              // Implement actual migration logic - map legacy config to step configs
              const stepConfigs: Partial<StepConfigMap> = {
                'input-file': {
                  filePreferences: {
                    autoValidate: true,
                    extractMetadata: true,
                    suggestOptimalSettings: true
                  },
                  lastInputDirectory: workspace.config.lastInputDirectory
                },
                'config': {
                  language: workspace.config.language || 'zh',
                  model: workspace.config.model,
                  priority: workspace.config.priority || 'balanced',
                  speakers: workspace.config.speakers || false,
                  written: workspace.config.written || true,
                  music: workspace.config.music || false,
                  charset: workspace.config.charset || 'traditional',
                  geminiKey: workspace.config.geminiKey,
                  hfToken: workspace.config.hfToken,
                  noGeminiRefinement: workspace.config.noGeminiRefinement || false,
                  maxChunkDuration: workspace.config.maxChunkDuration || 15,
                  videoQuality: workspace.config.videoQuality || '360p',
                  terminologyConfig: workspace.config.terminologyConfig,
                  ffmpegPath: workspace.config.ffmpegPath
                },
                'processing': {
                  verbose: workspace.config.verbose || false,
                  qualitySettings: {
                    targetAccuracy: 0.9,
                    minimumConfidence: 0.7,
                    enableQualityChecks: true
                  },
                  monitoring: {
                    enableDetailedLogging: false,
                    trackPerformanceMetrics: true,
                    saveDebugInfo: false
                  }
                },
                'review': createDefaultStepConfig('review'),
                'export': {
                  outputFile: workspace.config.outputFile,
                  formatSettings: {
                    format: 'srt',
                    encoding: 'utf8',
                    includeMetadata: false,
                    includeConfidenceScores: false
                  },
                  postProcessing: {
                    removeEmptyLines: true,
                    normalizeWhitespace: true,
                    applyTextFormatting: false,
                    generateSummary: false
                  },
                  qualityAssurance: {
                    finalValidation: true,
                    exportChecklist: [],
                    backupOriginal: true
                  }
                }
              }

              // Save step configurations to database
              for (const [stepId, config] of Object.entries(stepConfigs) as Array<[WorkflowStepId, any]>) {
                if (config) {
                  await workspaceDatabase.setStepConfig(workspace.id, stepId, config)
                }
              }
              
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
        if (!rollbackData?.workspaceConfigs?.[workspaceId]) {
          throw new Error(`No rollback data available for workspace ${workspaceId}`)
        }

        try {
          // Restore original workspace configuration
          const originalConfig = rollbackData.workspaceConfigs[workspaceId]
          const workspace = await workspaceDatabase.getWorkspace(workspaceId)
          
          if (!workspace) {
            throw new Error(`Workspace ${workspaceId} not found`)
          }

          // Restore legacy configuration
          workspace.config = { ...originalConfig, _stepConfigsEnabled: false }
          await workspaceDatabase.updateWorkspace(workspace)

          // Remove step configurations
          const stepIds: WorkflowStepId[] = ['input-file', 'config', 'processing', 'review', 'export']
          for (const stepId of stepIds) {
            try {
              await workspaceDatabase.deleteStepConfig(workspaceId, stepId)
            } catch (error) {
              // Continue even if step config doesn't exist
              console.warn(`Failed to delete step config ${stepId} for workspace ${workspaceId}:`, error)
            }
          }

          // Clear step config cache
          const cacheKeys = stepIds.map(stepId => generateStepConfigCacheKey(workspaceId, stepId))
          cacheKeys.forEach(key => {
            delete get().stepConfigCache[key]
          })

          set(state => ({
            stepConfigMigrationStatus: {
              ...state.stepConfigMigrationStatus,
              completedWorkspaces: state.stepConfigMigrationStatus.completedWorkspaces.filter(id => id !== workspaceId),
              failedWorkspaces: state.stepConfigMigrationStatus.failedWorkspaces.filter(id => id !== workspaceId)
            }
          }))

          console.log(`Successfully rolled back migration for workspace ${workspaceId}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown rollback error'
          console.error(`Failed to rollback migration for workspace ${workspaceId}:`, errorMessage)
          throw new Error(`Rollback failed: ${errorMessage}`)
        }
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

    // Workspace Grouping Actions
    const groupingActions: WorkspaceGroupingActions = {
      // Group Management
      createGroup: async (name: string, color?: WorkspaceGroupColor, workspaceIds?: string[]) => {
        const groupId = generateUUID()
        const now = Date.now()
        const position = get().grouping.groups.length

        const group: WorkspaceGroup = {
          id: groupId,
          name,
          color: color || 'blue',
          createdAt: now,
          updatedAt: now,
          position,
          isExpanded: true,
          metadata: {
            workspaceCount: workspaceIds?.length || 0
          }
        }

        // Validate group
        const validation = validateWorkspaceGroup(group)
        if (!validation.isValid) {
          throw new Error(`Group validation failed: ${validation.errors.join(', ')}`)
        }

        // Check for duplicate names
        const state = get()
        if (state.grouping.groups.some(g => g.name === name)) {
          throw new Error(`A group with the name '${name}' already exists`)
        }

        try {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          await workspaceDatabase.createWorkspaceGroup(group)

          // Add workspaces to group if specified
          if (workspaceIds && workspaceIds.length > 0) {
            for (let i = 0; i < workspaceIds.length; i++) {
              await workspaceDatabase.addWorkspaceToGroup(workspaceIds[i], groupId, i)
            }
          }

          // Update state
          const mappings = await workspaceDatabase.getWorkspaceGroupMappings()
          
          set(state => ({
            grouping: {
              ...state.grouping,
              groups: [...state.grouping.groups, group],
              workspaceGroupMappings: mappings,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'create-group',
                affectedWorkspaces: workspaceIds || [],
                affectedGroups: [groupId]
              }
            }
          }))

          return group
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'create-group',
                affectedWorkspaces: workspaceIds || [],
                affectedGroups: [groupId],
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      updateGroup: async (groupId: string, updates: Partial<Omit<WorkspaceGroup, 'id' | 'createdAt'>>) => {
        const state = get()
        const existingGroup = state.grouping.groups.find(g => g.id === groupId)
        
        if (!existingGroup) {
          throw new Error(`Group with id '${groupId}' not found`)
        }

        const updatedGroup: WorkspaceGroup = {
          ...existingGroup,
          ...updates,
          updatedAt: Date.now()
        }

        try {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          await workspaceDatabase.updateWorkspaceGroup(updatedGroup)

          set(state => ({
            grouping: {
              ...state.grouping,
              groups: state.grouping.groups.map(g => g.id === groupId ? updatedGroup : g),
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'reorder-group',
                affectedWorkspaces: [],
                affectedGroups: [groupId]
              }
            }
          }))
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'reorder-group',
                affectedWorkspaces: [],
                affectedGroups: [groupId],
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      deleteGroup: async (groupId: string, redistributeWorkspaces = false) => {
        const state = get()
        const group = state.grouping.groups.find(g => g.id === groupId)
        
        if (!group) {
          throw new Error(`Group with id '${groupId}' not found`)
        }

        // Find workspaces in this group
        const workspacesInGroup = Object.entries(state.grouping.workspaceGroupMappings)
          .filter(([, gId]) => gId === groupId)
          .map(([workspaceId]) => workspaceId)

        try {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          // Handle workspace redistribution
          if (redistributeWorkspaces && workspacesInGroup.length > 0) {
            // Move workspaces to ungrouped
            for (const workspaceId of workspacesInGroup) {
              await workspaceDatabase.removeWorkspaceFromGroup(workspaceId)
            }
          }

          await workspaceDatabase.deleteWorkspaceGroup(groupId)

          // Update state
          const mappings = await workspaceDatabase.getWorkspaceGroupMappings()
          
          set(state => ({
            grouping: {
              ...state.grouping,
              groups: state.grouping.groups.filter(g => g.id !== groupId),
              workspaceGroupMappings: mappings,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'reorder-group',
                affectedWorkspaces: workspacesInGroup,
                affectedGroups: [groupId]
              }
            }
          }))
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'reorder-group',
                affectedWorkspaces: workspacesInGroup,
                affectedGroups: [groupId],
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      reorderGroups: async (groupIds: string[]) => {
        try {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          const state = get()
          const updatedGroups = groupIds.map((id, index) => {
            const group = state.grouping.groups.find(g => g.id === id)
            if (!group) throw new Error(`Group with id '${id}' not found`)
            return { ...group, position: index, updatedAt: Date.now() }
          })

          // Update all groups in database
          for (const group of updatedGroups) {
            await workspaceDatabase.updateWorkspaceGroup(group)
          }

          set(state => ({
            grouping: {
              ...state.grouping,
              groups: updatedGroups.sort((a, b) => a.position - b.position),
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'reorder-group',
                affectedWorkspaces: [],
                affectedGroups: groupIds
              }
            }
          }))
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'reorder-group',
                affectedWorkspaces: [],
                affectedGroups: groupIds,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      // Workspace-Group Operations
      addWorkspaceToGroup: async (workspaceId: string, groupId: string, position = 0) => {
        try {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          await workspaceDatabase.addWorkspaceToGroup(workspaceId, groupId, position)
          const mappings = await workspaceDatabase.getWorkspaceGroupMappings()

          set(state => ({
            grouping: {
              ...state.grouping,
              workspaceGroupMappings: mappings,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'move-to-group',
                affectedWorkspaces: [workspaceId],
                affectedGroups: [groupId]
              }
            }
          }))
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'move-to-group',
                affectedWorkspaces: [workspaceId],
                affectedGroups: [groupId],
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      removeWorkspaceFromGroup: async (workspaceId: string) => {
        try {
          const currentGroupId = get().grouping.workspaceGroupMappings[workspaceId]
          
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          await workspaceDatabase.removeWorkspaceFromGroup(workspaceId)
          const mappings = await workspaceDatabase.getWorkspaceGroupMappings()

          set(state => ({
            grouping: {
              ...state.grouping,
              workspaceGroupMappings: mappings,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'ungroup-workspace',
                affectedWorkspaces: [workspaceId],
                affectedGroups: currentGroupId ? [currentGroupId] : []
              }
            }
          }))
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'ungroup-workspace',
                affectedWorkspaces: [workspaceId],
                affectedGroups: [],
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      moveWorkspaceBetweenGroups: async (workspaceId: string, fromGroupId: string | null, toGroupId: string | null, position = 0) => {
        try {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          await workspaceDatabase.addWorkspaceToGroup(workspaceId, toGroupId, position)
          const mappings = await workspaceDatabase.getWorkspaceGroupMappings()

          set(state => ({
            grouping: {
              ...state.grouping,
              workspaceGroupMappings: mappings,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'move-to-group',
                affectedWorkspaces: [workspaceId],
                affectedGroups: [fromGroupId, toGroupId].filter(Boolean) as string[]
              }
            }
          }))
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'move-to-group',
                affectedWorkspaces: [workspaceId],
                affectedGroups: [fromGroupId, toGroupId].filter(Boolean) as string[],
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      reorderWorkspacesInGroup: async (groupId: string | null, workspaceIds: string[]) => {
        try {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: true
            }
          }))

          await workspaceDatabase.reorderWorkspacesInGroup(groupId, workspaceIds)
          const mappings = await workspaceDatabase.getWorkspaceGroupMappings()

          set(state => ({
            grouping: {
              ...state.grouping,
              workspaceGroupMappings: mappings,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: true,
                operation: 'reorder-workspace',
                affectedWorkspaces: workspaceIds,
                affectedGroups: groupId ? [groupId] : []
              }
            }
          }))
        } catch (error) {
          set(state => ({
            grouping: {
              ...state.grouping,
              isGroupOperationLoading: false,
              lastGroupOperation: {
                success: false,
                operation: 'reorder-workspace',
                affectedWorkspaces: workspaceIds,
                affectedGroups: groupId ? [groupId] : [],
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            },
            lastError: error as WorkspaceError
          }))
          throw error
        }
      },

      // Drag and Drop Operations
      startDrag: (itemType: 'workspace' | 'group', itemId: string, sourceGroupId?: string | null, sourcePosition = 0) => {
        const state = get()
        const draggedItem = state.grouping.dragState.draggedItem
        
        if (draggedItem) {
          // Cancel previous drag if any
          groupingActions.cancelDrag()
        }

        const workspace = state.availableWorkspaces.find(w => w.id === itemId)
        const group = state.grouping.groups.find(g => g.id === itemId)

        set(state => ({
          grouping: {
            ...state.grouping,
            dragState: {
              draggedItem: {
                type: itemType,
                id: itemId,
                sourceGroupId,
                sourcePosition
              },
              dropTarget: null,
              isDragging: true,
              dragPreview: {
                name: itemType === 'workspace' ? workspace?.name || 'Unknown' : group?.name || 'Unknown',
                color: itemType === 'group' ? group?.color : undefined,
                workspaceCount: itemType === 'group' ? group?.metadata?.workspaceCount : undefined
              }
            }
          }
        }))
      },

      updateDropTarget: (targetType: 'workspace' | 'group' | 'empty-space', targetId?: string, operation?: DragOperation) => {
        const state = get()
        if (!state.grouping.dragState.isDragging) return

        const draggedItem = state.grouping.dragState.draggedItem
        if (!draggedItem) return

        // Determine operation based on drag context
        let detectedOperation: DragOperation = operation || 'reorder-workspace'
        
        if (!operation) {
          if (draggedItem.type === 'group') {
            detectedOperation = 'reorder-group'
          } else if (targetType === 'group' && draggedItem.sourceGroupId !== targetId) {
            detectedOperation = 'move-to-group'
          } else if (targetType === 'empty-space') {
            detectedOperation = 'ungroup-workspace'
          }
        }

        set(state => ({
          grouping: {
            ...state.grouping,
            dragState: {
              ...state.grouping.dragState,
              dropTarget: {
                type: targetType,
                id: targetId,
                groupId: targetType === 'group' ? targetId : state.grouping.workspaceGroupMappings[targetId || ''],
                position: 0, // Will be calculated based on drop position
                operation: detectedOperation
              }
            }
          }
        }))
      },

      endDrag: async (): Promise<GroupOperationResult | null> => {
        const state = get()
        const { draggedItem, dropTarget } = state.grouping.dragState

        if (!draggedItem || !dropTarget) {
          groupingActions.cancelDrag()
          return null
        }

        // Validate drag operation
        const validation = validateDragOperation(
          dropTarget.operation,
          draggedItem,
          dropTarget,
          { groups: state.grouping.groups, workspaceGroupMappings: state.grouping.workspaceGroupMappings }
        )

        if (!validation.isValid) {
          const errorResult: GroupOperationResult = {
            success: false,
            operation: dropTarget.operation,
            affectedWorkspaces: [draggedItem.id],
            affectedGroups: [],
            error: `Validation failed: ${validation.errors.join(', ')}`
          }

          set(state => ({
            grouping: {
              ...state.grouping,
              dragState: {
                draggedItem: null,
                dropTarget: null,
                isDragging: false
              },
              lastGroupOperation: errorResult
            }
          }))

          return errorResult
        }

        try {
          let result: GroupOperationResult | null = null

          // Execute the appropriate operation
          switch (dropTarget.operation) {
            case 'move-to-group':
              if (draggedItem.type === 'workspace' && dropTarget.type === 'group') {
                await groupingActions.moveWorkspaceBetweenGroups(
                  draggedItem.id,
                  draggedItem.sourceGroupId || null,
                  dropTarget.id || null,
                  dropTarget.position
                )
                result = {
                  success: true,
                  operation: 'move-to-group',
                  affectedWorkspaces: [draggedItem.id],
                  affectedGroups: [draggedItem.sourceGroupId, dropTarget.id].filter(Boolean) as string[]
                }
              }
              break

            case 'ungroup-workspace':
              if (draggedItem.type === 'workspace') {
                await groupingActions.removeWorkspaceFromGroup(draggedItem.id)
                result = {
                  success: true,
                  operation: 'ungroup-workspace',
                  affectedWorkspaces: [draggedItem.id],
                  affectedGroups: draggedItem.sourceGroupId ? [draggedItem.sourceGroupId] : []
                }
              }
              break

            case 'reorder-workspace':
              if (draggedItem.type === 'workspace' && dropTarget.groupId) {
                // Get current workspace order in group
                const workspacesInGroup = state.availableWorkspaces
                  .filter(w => state.grouping.workspaceGroupMappings[w.id] === dropTarget.groupId)
                  .sort((a, b) => a.positionInGroup - b.positionInGroup)
                  .map(w => w.id)

                // Reorder the array
                const draggedIndex = workspacesInGroup.indexOf(draggedItem.id)
                if (draggedIndex !== -1) {
                  workspacesInGroup.splice(draggedIndex, 1)
                  workspacesInGroup.splice(dropTarget.position, 0, draggedItem.id)
                }

                await groupingActions.reorderWorkspacesInGroup(dropTarget.groupId, workspacesInGroup)
                result = {
                  success: true,
                  operation: 'reorder-workspace',
                  affectedWorkspaces: workspacesInGroup,
                  affectedGroups: dropTarget.groupId ? [dropTarget.groupId] : []
                }
              }
              break

            case 'create-group':
              // This would be handled by specific UI logic
              break

            case 'reorder-group':
              if (draggedItem.type === 'group') {
                const currentGroups = [...state.grouping.groups].sort((a, b) => a.position - b.position)
                const draggedIndex = currentGroups.findIndex(g => g.id === draggedItem.id)
                
                if (draggedIndex !== -1) {
                  const [draggedGroup] = currentGroups.splice(draggedIndex, 1)
                  currentGroups.splice(dropTarget.position, 0, draggedGroup)
                  
                  const reorderedIds = currentGroups.map(g => g.id)
                  await groupingActions.reorderGroups(reorderedIds)
                  
                  result = {
                    success: true,
                    operation: 'reorder-group',
                    affectedWorkspaces: [],
                    affectedGroups: reorderedIds
                  }
                }
              }
              break
          }

          // Clear drag state
          set(state => ({
            grouping: {
              ...state.grouping,
              dragState: {
                draggedItem: null,
                dropTarget: null,
                isDragging: false
              },
              lastGroupOperation: result || state.grouping.lastGroupOperation
            }
          }))

          return result
        } catch (error) {
          const errorResult: GroupOperationResult = {
            success: false,
            operation: dropTarget.operation,
            affectedWorkspaces: [draggedItem.id],
            affectedGroups: [],
            error: error instanceof Error ? error.message : 'Unknown error'
          }

          set(state => ({
            grouping: {
              ...state.grouping,
              dragState: {
                draggedItem: null,
                dropTarget: null,
                isDragging: false
              },
              lastGroupOperation: errorResult
            },
            lastError: error as WorkspaceError
          }))

          return errorResult
        }
      },

      cancelDrag: () => {
        set(state => ({
          grouping: {
            ...state.grouping,
            dragState: {
              draggedItem: null,
              dropTarget: null,
              isDragging: false
            }
          }
        }))
      },

      // Group Display
      toggleGroupExpansion: async (groupId: string) => {
        const state = get()
        const group = state.grouping.groups.find(g => g.id === groupId)
        
        if (group) {
          await groupingActions.updateGroup(groupId, { isExpanded: !group.isExpanded })
        }
      },

      expandAllGroups: async () => {
        const state = get()
        for (const group of state.grouping.groups) {
          if (!group.isExpanded) {
            await groupingActions.updateGroup(group.id, { isExpanded: true })
          }
        }
      },

      collapseAllGroups: async () => {
        const state = get()
        for (const group of state.grouping.groups) {
          if (group.isExpanded) {
            await groupingActions.updateGroup(group.id, { isExpanded: false })
          }
        }
      },

      // Utility Functions
      getWorkspacesByGroup: (groupId: string | null): WorkspaceWithGrouping[] => {
        const state = get()
        return state.availableWorkspaces.filter(workspace => {
          const workspaceGroupId = state.grouping.workspaceGroupMappings[workspace.id]
          return workspaceGroupId === groupId
        }).sort((a, b) => a.positionInGroup - b.positionInGroup)
      },

      getGroupById: (groupId: string): WorkspaceGroup | null => {
        const state = get()
        return state.grouping.groups.find(g => g.id === groupId) || null
      },

      getWorkspaceGroup: (workspaceId: string): WorkspaceGroup | null => {
        const state = get()
        const groupId = state.grouping.workspaceGroupMappings[workspaceId]
        return groupId ? groupingActions.getGroupById(groupId) : null
      },

      validateGroupOperation: (operation: DragOperation, sourceId: string, targetId?: string): boolean => {
        const state = get()
        
        switch (operation) {
          case 'move-to-group':
            return sourceId !== targetId && !!state.grouping.groups.find(g => g.id === targetId)
          
          case 'ungroup-workspace':
            return !!state.grouping.workspaceGroupMappings[sourceId]
          
          case 'reorder-workspace':
          case 'reorder-group':
            return sourceId !== targetId
          
          case 'create-group':
            return true
          
          default:
            return false
        }
      }
    }

    return { ...state, ...actions, grouping: groupingActions }
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

// Auto-save subscription for grouping changes
useWorkspaceStore.subscribe(
  (state) => ({
    groups: state.grouping.groups,
    mappings: state.grouping.workspaceGroupMappings
  }),
  (current, previous) => {
    // Check if groups or mappings changed
    const groupsChanged = JSON.stringify(current.groups) !== JSON.stringify(previous?.groups)
    const mappingsChanged = JSON.stringify(current.mappings) !== JSON.stringify(previous?.mappings)
    
    if (groupsChanged || mappingsChanged) {
      const store = useWorkspaceStore.getState()
      
      // Auto-save current workspace if it exists (metadata might have changed)
      if (store.currentWorkspace) {
        store.autoSaveCurrentWorkspace()
      }
      
      // Log grouping changes for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('Workspace grouping changed:', {
          groupsChanged,
          mappingsChanged,
          groupCount: current.groups.length,
          mappingCount: Object.keys(current.mappings).length
        })
      }
    }
  },
  { 
    equalityFn: (a, b) => 
      JSON.stringify(a?.groups) === JSON.stringify(b?.groups) &&
      JSON.stringify(a?.mappings) === JSON.stringify(b?.mappings)
  }
)