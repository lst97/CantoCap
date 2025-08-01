// Workspace Database Service - IndexedDB Abstraction Layer
import type { 
  Workspace, 
  WorkspaceSession, 
  MigrationLogEntry, 
  WorkspaceError,
  WorkspacePerformanceMetrics,
  // Step Configuration Types
  StepConfigurationRecord,
  WorkflowStepId,
  StepConfigMap,
  StepConfiguration,
  BatchResult,
  StepConfigUpdate,
  EnhancedWorkspacePerformanceMetrics,
  CachedStepConfig,
  StepConfigError,
  // Grouping Types
  WorkspaceGroup,
  WorkspaceWithGrouping,
  WorkspaceGroupColor,
  GroupOperationResult,
  DragOperation
} from '../types/workspace'
import type {
  // Subtitle Temporary Storage Types
  SubtitleTempStorageRecord,
  SubtitleTempSessionRecord,
  SubtitleTempMetadata,
  SubtitleTempError
} from '../types/subtitle-temp-storage'
import { 
  WORKSPACE_CONSTANTS,
  isValidWorkspaceId,
  isValidWorkflowStepId,
  generateStepConfigCacheKey,
  calculateConfigChecksum,
  estimateConfigSize,
  compressConfigData,
  decompressConfigData
} from '../types/workspace'

// Database Configuration
const DB_NAME = 'CantoCap_Workspaces'
const DB_VERSION = 4 // Upgraded for subtitle temp storage support
const STORES = {
  WORKSPACES: 'workspaces',
  SESSIONS: 'workspace_sessions',
  MIGRATION_LOG: 'migration_log',
  STEP_CONFIGURATIONS: 'step_configurations',
  STEP_CONFIG_CACHE: 'step_config_cache',
  PERFORMANCE_METRICS: 'performance_metrics',
  WORKSPACE_GROUPS: 'workspace_groups',
  WORKSPACE_GROUP_MAPPINGS: 'workspace_group_mappings',
  // Subtitle Temporary Storage Stores
  SUBTITLE_TEMP_STORAGE: 'subtitle_temp_storage',
  SUBTITLE_TEMP_SESSIONS: 'subtitle_temp_sessions',
  SUBTITLE_TEMP_METADATA: 'subtitle_temp_metadata'
} as const

// Enhanced Performance monitoring with step configuration support
class EnhancedPerformanceMonitor {
  private metrics: EnhancedWorkspacePerformanceMetrics[] = []
  private readonly maxMetrics = 1000

  recordOperation(
    operationType: EnhancedWorkspacePerformanceMetrics['operationType'],
    startTime: number,
    success: boolean,
    workspaceId?: string,
    dataSize?: number,
    error?: string,
    // Enhanced parameters
    category: EnhancedWorkspacePerformanceMetrics['category'] = 'workspace',
    stepId?: WorkflowStepId,
    cacheMetrics?: EnhancedWorkspacePerformanceMetrics['cacheMetrics'],
    configSize?: number,
    configCount?: number
  ): void {
    const metric: EnhancedWorkspacePerformanceMetrics = {
      operationType,
      duration: Date.now() - startTime,
      success,
      workspaceId,
      dataSize,
      error,
      timestamp: Date.now(),
      category,
      stepId,
      cacheMetrics,
      configSize,
      configCount
    }

    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  // Legacy method for backward compatibility
  recordLegacyOperation(
    operationType: WorkspacePerformanceMetrics['operationType'],
    startTime: number,
    success: boolean,
    workspaceId?: string,
    dataSize?: number,
    error?: string
  ): void {
    this.recordOperation(operationType, startTime, success, workspaceId, dataSize, error)
  }

  getEnhancedMetrics(): EnhancedWorkspacePerformanceMetrics[] {
    return [...this.metrics]
  }

  // Legacy method for backward compatibility
  getMetrics(): WorkspacePerformanceMetrics[] {
    return [...this.metrics]
  }

  clearMetrics(): void {
    this.metrics = []
  }
}

// Main Database Service
export class WorkspaceDatabase {
  private db: IDBDatabase | null = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null
  private performanceMonitor = new EnhancedPerformanceMonitor()

  constructor() {
    this.initializeDatabase()
  }

  // Database Initialization
  private async initializeDatabase(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(this.createError('STORAGE_UNAVAILABLE', 'IndexedDB is not supported in this browser'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        const errorMessage = request.error?.message || 'Unknown database error'
        console.error('IndexedDB initialization failed:', errorMessage)
        
        // If it's a corruption error, try to delete and recreate the database
        if (errorMessage.includes('Internal error') || errorMessage.includes('backing store')) {
          console.log('Attempting to recover from database corruption...')
          this.recoverFromCorruption().then(resolve).catch(reject)
          return
        }
        
        reject(this.createError('STORAGE_UNAVAILABLE', `Failed to open database: ${errorMessage}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        
        // Setup error handling for connection issues
        this.db.onerror = (event) => {
          console.error('Database error:', event)
        }

        this.db.onversionchange = () => {
          this.db?.close()
          console.warn('Database version changed, please reload the page')
        }

        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create workspaces store
        if (!db.objectStoreNames.contains(STORES.WORKSPACES)) {
          const workspaceStore = db.createObjectStore(STORES.WORKSPACES, { keyPath: 'id' })
          workspaceStore.createIndex('name', 'name', { unique: false })
          workspaceStore.createIndex('createdAt', 'createdAt', { unique: false })
          workspaceStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false })
          workspaceStore.createIndex('isActive', 'isActive', { unique: false })
          workspaceStore.createIndex('groupId', 'groupId', { unique: false })
          workspaceStore.createIndex('positionInGroup', 'positionInGroup', { unique: false })
        }

        // Create sessions store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' })
          sessionStore.createIndex('workspaceId', 'workspaceId', { unique: false })
          sessionStore.createIndex('sessionType', 'sessionType', { unique: false })
          sessionStore.createIndex('isActive', 'isActive', { unique: false })
        }

        // Create migration log store
        if (!db.objectStoreNames.contains(STORES.MIGRATION_LOG)) {
          const migrationStore = db.createObjectStore(STORES.MIGRATION_LOG, { keyPath: 'id' })
          migrationStore.createIndex('phase', 'phase', { unique: false })
          migrationStore.createIndex('timestamp', 'timestamp', { unique: false })
          migrationStore.createIndex('success', 'success', { unique: false })
        }

        // Create step configurations store
        if (!db.objectStoreNames.contains(STORES.STEP_CONFIGURATIONS)) {
          const stepConfigStore = db.createObjectStore(STORES.STEP_CONFIGURATIONS, { 
            keyPath: ['workspace_id', 'step_id'] 
          })
          stepConfigStore.createIndex('workspace_id', 'workspace_id', { unique: false })
          stepConfigStore.createIndex('step_id', 'step_id', { unique: false })
          stepConfigStore.createIndex('last_modified', 'last_modified', { unique: false })
          stepConfigStore.createIndex('version', 'version', { unique: false })
        }

        // Create step configuration cache store
        if (!db.objectStoreNames.contains(STORES.STEP_CONFIG_CACHE)) {
          const cacheStore = db.createObjectStore(STORES.STEP_CONFIG_CACHE, { keyPath: 'cache_key' })
          cacheStore.createIndex('expiry_time', 'expiry_time', { unique: false })
          cacheStore.createIndex('last_accessed', 'last_accessed', { unique: false })
          cacheStore.createIndex('access_count', 'access_count', { unique: false })
          cacheStore.createIndex('is_dirty', 'is_dirty', { unique: false })
        }

        // Create enhanced performance metrics store
        if (!db.objectStoreNames.contains(STORES.PERFORMANCE_METRICS)) {
          const metricsStore = db.createObjectStore(STORES.PERFORMANCE_METRICS, { 
            keyPath: 'id',
            autoIncrement: true 
          })
          metricsStore.createIndex('operationType', 'operationType', { unique: false })
          metricsStore.createIndex('timestamp', 'timestamp', { unique: false })
          metricsStore.createIndex('workspaceId', 'workspaceId', { unique: false })
          metricsStore.createIndex('category', 'category', { unique: false })
          metricsStore.createIndex('stepId', 'stepId', { unique: false })
        }

        // Create workspace groups store
        if (!db.objectStoreNames.contains(STORES.WORKSPACE_GROUPS)) {
          const groupsStore = db.createObjectStore(STORES.WORKSPACE_GROUPS, { keyPath: 'id' })
          groupsStore.createIndex('name', 'name', { unique: false })
          groupsStore.createIndex('position', 'position', { unique: false })
          groupsStore.createIndex('createdAt', 'createdAt', { unique: false })
          groupsStore.createIndex('color', 'color', { unique: false })
        }

        // Create workspace group mappings store
        if (!db.objectStoreNames.contains(STORES.WORKSPACE_GROUP_MAPPINGS)) {
          const mappingsStore = db.createObjectStore(STORES.WORKSPACE_GROUP_MAPPINGS, { keyPath: 'workspaceId' })
          mappingsStore.createIndex('groupId', 'groupId', { unique: false })
          mappingsStore.createIndex('positionInGroup', 'positionInGroup', { unique: false })
        }

        // Create subtitle temporary storage store
        if (!db.objectStoreNames.contains(STORES.SUBTITLE_TEMP_STORAGE)) {
          const tempStorageStore = db.createObjectStore(STORES.SUBTITLE_TEMP_STORAGE, { keyPath: 'id' })
          tempStorageStore.createIndex('workspaceId', 'workspaceId', { unique: false })
          tempStorageStore.createIndex('sessionId', 'sessionId', { unique: false })
          tempStorageStore.createIndex('storageType', 'storageType', { unique: false })
          tempStorageStore.createIndex('createdAt', 'createdAt', { unique: false })
          tempStorageStore.createIndex('lastModified', 'lastModified', { unique: false })
          tempStorageStore.createIndex('contentHash', 'contentHash', { unique: false })
          tempStorageStore.createIndex('isLatest', 'isLatest', { unique: false })
          tempStorageStore.createIndex('parentId', 'parentId', { unique: false })
          tempStorageStore.createIndex('generationLevel', 'generationLevel', { unique: false })
        }

        // Create subtitle temporary sessions store
        if (!db.objectStoreNames.contains(STORES.SUBTITLE_TEMP_SESSIONS)) {
          const tempSessionsStore = db.createObjectStore(STORES.SUBTITLE_TEMP_SESSIONS, { keyPath: 'sessionId' })
          tempSessionsStore.createIndex('workspaceId', 'workspaceId', { unique: false })
          tempSessionsStore.createIndex('sessionType', 'sessionType', { unique: false })
          tempSessionsStore.createIndex('status', 'status', { unique: false })
          tempSessionsStore.createIndex('createdAt', 'createdAt', { unique: false })
          tempSessionsStore.createIndex('lastActivity', 'lastActivity', { unique: false })
          tempSessionsStore.createIndex('stateHash', 'stateHash', { unique: false })
        }

        // Create subtitle temporary metadata store
        if (!db.objectStoreNames.contains(STORES.SUBTITLE_TEMP_METADATA)) {
          const tempMetadataStore = db.createObjectStore(STORES.SUBTITLE_TEMP_METADATA, { keyPath: 'id' })
          tempMetadataStore.createIndex('workspaceId', 'workspaceId', { unique: false })
          tempMetadataStore.createIndex('sessionId', 'sessionId', { unique: false })
          tempMetadataStore.createIndex('storageType', 'storageType', { unique: false })
          tempMetadataStore.createIndex('createdAt', 'createdAt', { unique: false })
          tempMetadataStore.createIndex('lastModified', 'lastModified', { unique: false })
          tempMetadataStore.createIndex('contentHash', 'contentHash', { unique: false })
          tempMetadataStore.createIndex('metadataHash', 'metadataHash', { unique: false })
        }
      }
    })

    return this.initializationPromise
  }

  // Utility Methods
  private createError(code: WorkspaceError['code'], message: string, workspaceId?: string, phase?: string): WorkspaceError {
    const error = new Error(message) as WorkspaceError
    error.code = code
    error.workspaceId = workspaceId
    error.phase = phase
    return error
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase()
    }
  }

  private async getTransaction(storeNames: string[], mode: IDBTransactionMode = 'readonly'): Promise<IDBTransaction> {
    await this.ensureInitialized()
    if (!this.db) {
      throw this.createError('STORAGE_UNAVAILABLE', 'Database is not initialized')
    }
    return this.db.transaction(storeNames, mode)
  }

  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Workspace Operations
  async createWorkspace(workspace: Workspace): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES], 'readwrite')
      const store = transaction.objectStore(STORES.WORKSPACES)
      
      await this.promisifyRequest(store.add(workspace))
      
      this.performanceMonitor.recordLegacyOperation(
        'create', 
        startTime, 
        true, 
        workspace.id, 
        JSON.stringify(workspace).length
      )
    } catch (error) {
      this.performanceMonitor.recordLegacyOperation(
        'create', 
        startTime, 
        false, 
        workspace.id, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      
      if (error instanceof DOMException && error.name === 'ConstraintError') {
        throw this.createError('VALIDATION_ERROR', `Workspace with id '${workspace.id}' already exists`, workspace.id)
      }
      throw error
    }
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES])
      const store = transaction.objectStore(STORES.WORKSPACES)
      
      const result = await this.promisifyRequest(store.get(id))
      
      this.performanceMonitor.recordLegacyOperation(
        'switch', 
        startTime, 
        true, 
        id, 
        result ? JSON.stringify(result).length : 0
      )
      
      return result || null
    } catch (error) {
      this.performanceMonitor.recordLegacyOperation(
        'switch', 
        startTime, 
        false, 
        id, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES])
      const store = transaction.objectStore(STORES.WORKSPACES)
      
      const result = await this.promisifyRequest(store.getAll())
      
      // Sort by last accessed time (most recent first)
      result.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      
      this.performanceMonitor.recordLegacyOperation(
        'switch', 
        startTime, 
        true, 
        undefined, 
        JSON.stringify(result).length
      )
      
      return result
    } catch (error) {
      this.performanceMonitor.recordLegacyOperation(
        'switch', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  async updateWorkspace(workspace: Workspace): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES], 'readwrite')
      const store = transaction.objectStore(STORES.WORKSPACES)
      
      // Ensure workspace exists before updating
      const existing = await this.promisifyRequest(store.get(workspace.id))
      if (!existing) {
        throw this.createError('WORKSPACE_NOT_FOUND', `Workspace with id '${workspace.id}' not found`, workspace.id)
      }
      
      workspace.updatedAt = Date.now()
      await this.promisifyRequest(store.put(workspace))
      
      this.performanceMonitor.recordLegacyOperation(
        'update', 
        startTime, 
        true, 
        workspace.id, 
        JSON.stringify(workspace).length
      )
    } catch (error) {
      this.performanceMonitor.recordLegacyOperation(
        'update', 
        startTime, 
        false, 
        workspace.id, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  async deleteWorkspace(id: string): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES, STORES.SESSIONS], 'readwrite')
      const workspaceStore = transaction.objectStore(STORES.WORKSPACES)
      const sessionStore = transaction.objectStore(STORES.SESSIONS)
      
      // Verify workspace exists
      const existing = await this.promisifyRequest(workspaceStore.get(id))
      if (!existing) {
        throw this.createError('WORKSPACE_NOT_FOUND', `Workspace with id '${id}' not found`, id)
      }
      
      // Delete all associated sessions
      const sessionIndex = sessionStore.index('workspaceId')
      const sessionCursor = sessionIndex.openCursor(IDBKeyRange.only(id))
      
      await new Promise<void>((resolve, reject) => {
        sessionCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            resolve()
          }
        }
        sessionCursor.onerror = () => reject(sessionCursor.error)
      })
      
      // Delete the workspace
      await this.promisifyRequest(workspaceStore.delete(id))
      
      this.performanceMonitor.recordLegacyOperation('delete', startTime, true, id)
    } catch (error) {
      this.performanceMonitor.recordLegacyOperation(
        'delete', 
        startTime, 
        false, 
        id, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  // Session Operations
  async createSession(session: WorkspaceSession): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.SESSIONS], 'readwrite')
      const store = transaction.objectStore(STORES.SESSIONS)
      
      await this.promisifyRequest(store.add(session))
      
      this.performanceMonitor.recordLegacyOperation(
        'create', 
        startTime, 
        true, 
        session.workspaceId, 
        JSON.stringify(session).length
      )
    } catch (error) {
      this.performanceMonitor.recordLegacyOperation(
        'create', 
        startTime, 
        false, 
        session.workspaceId, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  async getSession(sessionId: string): Promise<WorkspaceSession | null> {
    const transaction = await this.getTransaction([STORES.SESSIONS])
    const store = transaction.objectStore(STORES.SESSIONS)
    
    const result = await this.promisifyRequest(store.get(sessionId))
    return result || null
  }

  async getWorkspaceSessions(workspaceId: string): Promise<WorkspaceSession[]> {
    const transaction = await this.getTransaction([STORES.SESSIONS])
    const store = transaction.objectStore(STORES.SESSIONS)
    const index = store.index('workspaceId')
    
    const result = await this.promisifyRequest(index.getAll(workspaceId))
    return result
  }

  async updateSession(session: WorkspaceSession): Promise<void> {
    const transaction = await this.getTransaction([STORES.SESSIONS], 'readwrite')
    const store = transaction.objectStore(STORES.SESSIONS)
    
    session.updatedAt = Date.now()
    await this.promisifyRequest(store.put(session))
  }

  async deleteSession(sessionId: string): Promise<void> {
    const transaction = await this.getTransaction([STORES.SESSIONS], 'readwrite')
    const store = transaction.objectStore(STORES.SESSIONS)
    
    await this.promisifyRequest(store.delete(sessionId))
  }

  async deleteWorkspaceSessions(workspaceId: string): Promise<void> {
    const transaction = await this.getTransaction([STORES.SESSIONS], 'readwrite')
    const store = transaction.objectStore(STORES.SESSIONS)
    const index = store.index('workspaceId')
    
    const cursor = index.openCursor(IDBKeyRange.only(workspaceId))
    
    await new Promise<void>((resolve, reject) => {
      cursor.onsuccess = (event) => {
        const result = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (result) {
          result.delete()
          result.continue()
        } else {
          resolve()
        }
      }
      cursor.onerror = () => reject(cursor.error)
    })
  }

  // Migration Log Operations
  async addMigrationLogEntry(entry: MigrationLogEntry): Promise<void> {
    const transaction = await this.getTransaction([STORES.MIGRATION_LOG], 'readwrite')
    const store = transaction.objectStore(STORES.MIGRATION_LOG)
    
    await this.promisifyRequest(store.add(entry))
  }

  async getMigrationLog(): Promise<MigrationLogEntry[]> {
    const transaction = await this.getTransaction([STORES.MIGRATION_LOG])
    const store = transaction.objectStore(STORES.MIGRATION_LOG)
    const index = store.index('timestamp')
    
    const result = await this.promisifyRequest(index.getAll())
    return result.reverse() // Most recent first
  }

  // ============================================================================
  // WORKSPACE GROUPING OPERATIONS
  // ============================================================================

  /**
   * Create a new workspace group
   */
  async createWorkspaceGroup(group: WorkspaceGroup): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUPS], 'readwrite')
      const store = transaction.objectStore(STORES.WORKSPACE_GROUPS)
      
      await this.promisifyRequest(store.add(group))
      
      this.performanceMonitor.recordOperation(
        'create', 
        startTime, 
        true, 
        undefined, 
        JSON.stringify(group).length,
        undefined,
        'workspace_group',
        undefined,
        undefined,
        JSON.stringify(group).length,
        1
      )
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'create', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_group'
      )
      
      if (error instanceof DOMException && error.name === 'ConstraintError') {
        throw this.createError('VALIDATION_ERROR', `Workspace group with id '${group.id}' already exists`)
      }
      throw error
    }
  }

  /**
   * Get a workspace group by ID
   */
  async getWorkspaceGroup(groupId: string): Promise<WorkspaceGroup | null> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUPS])
      const store = transaction.objectStore(STORES.WORKSPACE_GROUPS)
      
      const result = await this.promisifyRequest(store.get(groupId))
      
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        true, 
        undefined, 
        result ? JSON.stringify(result).length : 0,
        undefined,
        'workspace_group'
      )
      
      return result || null
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_group'
      )
      throw error
    }
  }

  /**
   * Get all workspace groups
   */
  async getAllWorkspaceGroups(): Promise<WorkspaceGroup[]> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUPS])
      const store = transaction.objectStore(STORES.WORKSPACE_GROUPS)
      const index = store.index('position')
      
      const result = await this.promisifyRequest(index.getAll())
      
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        true, 
        undefined, 
        JSON.stringify(result).length,
        undefined,
        'workspace_group',
        undefined,
        undefined,
        JSON.stringify(result).length,
        result.length
      )
      
      return result
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_group'
      )
      throw error
    }
  }

  /**
   * Update a workspace group
   */
  async updateWorkspaceGroup(group: WorkspaceGroup): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUPS], 'readwrite')
      const store = transaction.objectStore(STORES.WORKSPACE_GROUPS)
      
      // Ensure group exists before updating
      const existing = await this.promisifyRequest(store.get(group.id))
      if (!existing) {
        throw this.createError('VALIDATION_ERROR', `Workspace group with id '${group.id}' not found`)
      }
      
      group.updatedAt = Date.now()
      await this.promisifyRequest(store.put(group))
      
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        true, 
        undefined, 
        JSON.stringify(group).length,
        undefined,
        'workspace_group'
      )
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_group'
      )
      throw error
    }
  }

  /**
   * Delete a workspace group
   */
  async deleteWorkspaceGroup(groupId: string): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUPS, STORES.WORKSPACE_GROUP_MAPPINGS], 'readwrite')
      const groupsStore = transaction.objectStore(STORES.WORKSPACE_GROUPS)
      const mappingsStore = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      
      // Verify group exists
      const existing = await this.promisifyRequest(groupsStore.get(groupId))
      if (!existing) {
        throw this.createError('VALIDATION_ERROR', `Workspace group with id '${groupId}' not found`)
      }
      
      // Delete all mappings for this group
      const mappingIndex = mappingsStore.index('groupId')
      const mappingCursor = mappingIndex.openCursor(IDBKeyRange.only(groupId))
      
      await new Promise<void>((resolve, reject) => {
        mappingCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            resolve()
          }
        }
        mappingCursor.onerror = () => reject(mappingCursor.error)
      })
      
      // Delete the group
      await this.promisifyRequest(groupsStore.delete(groupId))
      
      this.performanceMonitor.recordOperation('delete', startTime, true, undefined, undefined, undefined, 'workspace_group')
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'delete', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_group'
      )
      throw error
    }
  }

  /**
   * Add workspace to group with atomic transaction
   */
  async addWorkspaceToGroup(workspaceId: string, groupId: string | null, position: number): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUP_MAPPINGS, STORES.WORKSPACE_GROUPS], 'readwrite')
      const mappingsStore = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      const groupsStore = transaction.objectStore(STORES.WORKSPACE_GROUPS)
      
      // Verify group exists if groupId is provided
      if (groupId) {
        const group = await this.promisifyRequest(groupsStore.get(groupId))
        if (!group) {
          throw this.createError('VALIDATION_ERROR', `Workspace group with id '${groupId}' not found`)
        }
      }
      
      // Create/update the mapping
      const mapping = {
        workspaceId,
        groupId,
        positionInGroup: position,
        updatedAt: Date.now()
      }
      
      await this.promisifyRequest(mappingsStore.put(mapping))
      
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        true, 
        workspaceId, 
        JSON.stringify(mapping).length,
        undefined,
        'workspace_mapping'
      )
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        false, 
        workspaceId, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_mapping'
      )
      throw error
    }
  }

  /**
   * Remove workspace from group
   */
  async removeWorkspaceFromGroup(workspaceId: string): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUP_MAPPINGS], 'readwrite')
      const store = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      
      await this.promisifyRequest(store.delete(workspaceId))
      
      this.performanceMonitor.recordOperation('delete', startTime, true, workspaceId, undefined, undefined, 'workspace_mapping')
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'delete', 
        startTime, 
        false, 
        workspaceId, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_mapping'
      )
      throw error
    }
  }

  /**
   * Get workspace group mappings
   */
  async getWorkspaceGroupMappings(): Promise<Record<string, string | null>> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUP_MAPPINGS])
      const store = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      
      const mappings = await this.promisifyRequest(store.getAll())
      const result: Record<string, string | null> = {}
      
      mappings.forEach(mapping => {
        result[mapping.workspaceId] = mapping.groupId
      })
      
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        true, 
        undefined, 
        JSON.stringify(result).length,
        undefined,
        'workspace_mapping',
        undefined,
        undefined,
        JSON.stringify(result).length,
        mappings.length
      )
      
      return result
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_mapping'
      )
      throw error
    }
  }

  /**
   * Get workspaces by group ID
   */
  async getWorkspacesByGroup(groupId: string | null): Promise<WorkspaceWithGrouping[]> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES, STORES.WORKSPACE_GROUP_MAPPINGS])
      const workspaceStore = transaction.objectStore(STORES.WORKSPACES)
      const mappingStore = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      
      // Get all workspaces
      const allWorkspaces = await this.promisifyRequest(workspaceStore.getAll()) as Workspace[]
      
      // Get all mappings
      const allMappings = await this.promisifyRequest(mappingStore.getAll())
      const mappingMap = new Map(allMappings.map(m => [m.workspaceId, m]))
      
      // Filter and enhance workspaces with grouping data
      const result: WorkspaceWithGrouping[] = []
      
      for (const workspace of allWorkspaces) {
        const mapping = mappingMap.get(workspace.id)
        const workspaceGroupId = mapping?.groupId || null
        
        if (workspaceGroupId === groupId) {
          result.push({
            ...workspace,
            groupId: workspaceGroupId,
            positionInGroup: mapping?.positionInGroup || 0
          })
        }
      }
      
      // Sort by position within group
      result.sort((a, b) => a.positionInGroup - b.positionInGroup)
      
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        true, 
        undefined, 
        JSON.stringify(result).length,
        undefined,
        'workspace_group_query',
        undefined,
        undefined,
        JSON.stringify(result).length,
        result.length
      )
      
      return result
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_group_query'
      )
      throw error
    }
  }

  /**
   * Batch reorder workspaces within a group
   */
  async reorderWorkspacesInGroup(groupId: string | null, workspaceIds: string[]): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACE_GROUP_MAPPINGS], 'readwrite')
      const store = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      
      // Update positions for each workspace
      for (let i = 0; i < workspaceIds.length; i++) {
        const workspaceId = workspaceIds[i]
        const mapping = {
          workspaceId,
          groupId,
          positionInGroup: i,
          updatedAt: Date.now()
        }
        
        await this.promisifyRequest(store.put(mapping))
      }
      
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        true, 
        undefined, 
        workspaceIds.length * 50, // Estimate
        undefined,
        'workspace_reorder',
        undefined,
        undefined,
        workspaceIds.length * 50,
        workspaceIds.length
      )
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_reorder'
      )
      throw error
    }
  }

  /**
   * Migrate existing workspaces to support grouping
   * This method ensures backward compatibility by creating default mappings
   */
  async migrateWorkspacesToGrouping(): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES, STORES.WORKSPACE_GROUP_MAPPINGS], 'readwrite')
      const workspaceStore = transaction.objectStore(STORES.WORKSPACES)
      const mappingStore = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      
      // Get all workspaces
      const workspaces = await this.promisifyRequest(workspaceStore.getAll()) as Workspace[]
      
      // Get existing mappings to avoid duplicates
      const existingMappings = await this.promisifyRequest(mappingStore.getAll())
      const existingWorkspaceIds = new Set(existingMappings.map(m => m.workspaceId))
      
      let migratedCount = 0
      
      // Create default mappings for workspaces without grouping data
      for (let i = 0; i < workspaces.length; i++) {
        const workspace = workspaces[i]
        
        if (!existingWorkspaceIds.has(workspace.id)) {
          const mapping = {
            workspaceId: workspace.id,
            groupId: null, // Ungrouped by default
            positionInGroup: i,
            updatedAt: Date.now()
          }
          
          await this.promisifyRequest(mappingStore.put(mapping))
          migratedCount++
        }
      }
      
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        true, 
        undefined, 
        migratedCount * 50, // Estimate
        undefined,
        'workspace_migration',
        undefined,
        undefined,
        migratedCount * 50,
        migratedCount
      )
      
      console.log(`Migrated ${migratedCount} workspaces to grouping system`)
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'update', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_migration'
      )
      throw error
    }
  }

  /**
   * Get all workspaces with grouping information
   */
  async getAllWorkspacesWithGrouping(): Promise<WorkspaceWithGrouping[]> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([STORES.WORKSPACES, STORES.WORKSPACE_GROUP_MAPPINGS])
      const workspaceStore = transaction.objectStore(STORES.WORKSPACES)
      const mappingStore = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      
      // Get all workspaces and mappings
      const [workspaces, mappings] = await Promise.all([
        this.promisifyRequest(workspaceStore.getAll()) as Promise<Workspace[]>,
        this.promisifyRequest(mappingStore.getAll())
      ])
      
      // Create mapping lookup
      const mappingMap = new Map(mappings.map(m => [m.workspaceId, m]))
      
      // Enhance workspaces with grouping data
      const result: WorkspaceWithGrouping[] = workspaces.map(workspace => {
        const mapping = mappingMap.get(workspace.id)
        return {
          ...workspace,
          groupId: mapping?.groupId || null,
          positionInGroup: mapping?.positionInGroup || 0
        }
      })
      
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        true, 
        undefined, 
        JSON.stringify(result).length,
        undefined,
        'workspace_with_grouping',
        undefined,
        undefined,
        JSON.stringify(result).length,
        result.length
      )
      
      return result
    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error',
        'workspace_with_grouping'
      )
      throw error
    }
  }

  // ============================================================================
  // STEP CONFIGURATION OPERATIONS
  // ============================================================================

  /**
   * Create or update a step configuration
   */
  async setStepConfiguration<T extends StepConfigMap[K], K extends WorkflowStepId>(
    workspaceId: string,
    stepId: K,
    config: Partial<T>,
    options: {
      merge?: boolean
      skipValidation?: boolean
    } = {}
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Validate inputs
      if (!isValidWorkspaceId(workspaceId)) {
        throw this.createError('VALIDATION_ERROR', 'Invalid workspace ID', workspaceId)
      }
      if (!isValidWorkflowStepId(stepId)) {
        throw this.createStepConfigError('STEP_CONFIG_INVALID', 'Invalid step ID', workspaceId, stepId)
      }

      // Get existing configuration if merging
      let finalConfig = config
      if (options.merge) {
        const existing = await this.getStepConfiguration(workspaceId, stepId)
        if (existing) {
          finalConfig = { ...existing, ...config }
        }
      }

      // Create configuration record
      const configData = compressConfigData(finalConfig)
      const configSize = estimateConfigSize(finalConfig)
      
      if (configSize > WORKSPACE_CONSTANTS.MAX_STEP_CONFIG_SIZE) {
        throw this.createStepConfigError('STEP_CONFIG_INVALID', 'Configuration too large', workspaceId, stepId)
      }

      const record: StepConfigurationRecord = {
        workspace_id: workspaceId,
        step_id: stepId,
        config_data: configData,
        last_modified: Date.now(),
        version: WORKSPACE_CONSTANTS.STEP_CONFIG_VERSION,
        schema_version: WORKSPACE_CONSTANTS.DEFAULT_STEP_CONFIG_SCHEMA_VERSION,
        checksum: calculateConfigChecksum(finalConfig),
        is_compressed: configSize > WORKSPACE_CONSTANTS.CONFIG_SIZE_WARNING_THRESHOLD
      }

      // Store in database
      const transaction = await this.getTransaction([STORES.STEP_CONFIGURATIONS], 'readwrite')
      const store = transaction.objectStore(STORES.STEP_CONFIGURATIONS)
      
      await this.promisifyRequest(store.put(record))

      // Record performance metrics
      this.performanceMonitor.recordOperation(
        'update',
        startTime,
        true,
        workspaceId,
        configSize,
        undefined,
        'step_config',
        stepId,
        undefined,
        configSize,
        1
      )

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'update',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'step_config',
        stepId
      )
      throw error
    }
  }

  /**
   * Get a step configuration
   */
  async getStepConfiguration<T extends StepConfigMap[K], K extends WorkflowStepId>(
    workspaceId: string,
    stepId: K
  ): Promise<T | null> {
    const startTime = Date.now()
    
    try {
      // Validate inputs
      if (!isValidWorkspaceId(workspaceId)) {
        throw this.createError('VALIDATION_ERROR', 'Invalid workspace ID', workspaceId)
      }
      if (!isValidWorkflowStepId(stepId)) {
        throw this.createStepConfigError('STEP_CONFIG_INVALID', 'Invalid step ID', workspaceId, stepId)
      }

      const transaction = await this.getTransaction([STORES.STEP_CONFIGURATIONS])
      const store = transaction.objectStore(STORES.STEP_CONFIGURATIONS)
      
      const record = await this.promisifyRequest(store.get([workspaceId, stepId])) as StepConfigurationRecord | undefined

      if (!record) {
        this.performanceMonitor.recordOperation(
          'switch',
          startTime,
          true,
          workspaceId,
          0,
          undefined,
          'step_config',
          stepId,
          undefined,
          0,
          0
        )
        return null
      }

      // Decompress and return configuration
      const config = decompressConfigData(record.config_data) as T
      const configSize = estimateConfigSize(config)

      this.performanceMonitor.recordOperation(
        'switch',
        startTime,
        true,
        workspaceId,
        configSize,
        undefined,
        'step_config',
        stepId,
        undefined,
        configSize,
        1
      )

      return config

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'step_config',
        stepId
      )
      throw error
    }
  }

  /**
   * Get multiple step configurations efficiently
   */
  async getMultipleStepConfigurations(
    workspaceId: string,
    stepIds: WorkflowStepId[]
  ): Promise<Partial<Record<WorkflowStepId, any>>> {
    const startTime = Date.now()
    
    try {
      if (!isValidWorkspaceId(workspaceId)) {
        throw this.createError('VALIDATION_ERROR', 'Invalid workspace ID', workspaceId)
      }

      const transaction = await this.getTransaction([STORES.STEP_CONFIGURATIONS])
      const store = transaction.objectStore(STORES.STEP_CONFIGURATIONS)
      const index = store.index('workspace_id')
      
      // Get all configurations for the workspace
      const allRecords = await this.promisifyRequest(index.getAll(workspaceId)) as StepConfigurationRecord[]
      
      // Filter and process requested step configurations
      const result: Partial<Record<WorkflowStepId, any>> = {}
      let totalSize = 0
      let configCount = 0

      for (const record of allRecords) {
        if (stepIds.includes(record.step_id)) {
          try {
            const config = decompressConfigData(record.config_data)
            result[record.step_id] = config
            totalSize += estimateConfigSize(config)
            configCount++
          } catch (error) {
            console.warn(`Failed to decompress configuration for step ${record.step_id}:`, error)
          }
        }
      }

      this.performanceMonitor.recordOperation(
        'switch',
        startTime,
        true,
        workspaceId,
        totalSize,
        undefined,
        'step_config',
        undefined,
        undefined,
        totalSize,
        configCount
      )

      return result

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'step_config'
      )
      throw error
    }
  }

  /**
   * Batch update step configurations
   */
  async batchUpdateStepConfigurations(
    workspaceId: string,
    updates: StepConfigUpdate[]
  ): Promise<BatchResult> {
    const startTime = Date.now()
    const updatedSteps: WorkflowStepId[] = []
    const errors: BatchResult['errors'] = []
    
    try {
      if (!isValidWorkspaceId(workspaceId)) {
        throw this.createError('VALIDATION_ERROR', 'Invalid workspace ID', workspaceId)
      }

      const transaction = await this.getTransaction([STORES.STEP_CONFIGURATIONS], 'readwrite')
      const store = transaction.objectStore(STORES.STEP_CONFIGURATIONS)
      
      let totalSize = 0
      
      for (const update of updates) {
        try {
          // Get existing configuration if merging
          let finalConfig = update.config
          if (update.merge) {
            const existing = await this.promisifyRequest(store.get([workspaceId, update.stepId])) as StepConfigurationRecord | undefined
            if (existing) {
              const existingConfig = decompressConfigData(existing.config_data)
              finalConfig = { ...existingConfig, ...update.config }
            }
          }

          // Create configuration record
          const configData = compressConfigData(finalConfig)
          const configSize = estimateConfigSize(finalConfig)
          totalSize += configSize
          
          if (configSize > WORKSPACE_CONSTANTS.MAX_STEP_CONFIG_SIZE) {
            errors.push({
              stepId: update.stepId,
              error: 'Configuration too large'
            })
            continue
          }

          const record: StepConfigurationRecord = {
            workspace_id: workspaceId,
            step_id: update.stepId,
            config_data: configData,
            last_modified: Date.now(),
            version: WORKSPACE_CONSTANTS.STEP_CONFIG_VERSION,
            schema_version: WORKSPACE_CONSTANTS.DEFAULT_STEP_CONFIG_SCHEMA_VERSION,
            checksum: calculateConfigChecksum(finalConfig),
            is_compressed: configSize > WORKSPACE_CONSTANTS.CONFIG_SIZE_WARNING_THRESHOLD
          }

          await this.promisifyRequest(store.put(record))
          updatedSteps.push(update.stepId)

        } catch (error) {
          errors.push({
            stepId: update.stepId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const result: BatchResult = {
        success: errors.length === 0,
        updatedSteps,
        errors,
        totalUpdated: updatedSteps.length,
        totalErrors: errors.length
      }

      this.performanceMonitor.recordOperation(
        'update',
        startTime,
        result.success,
        workspaceId,
        totalSize,
        result.success ? undefined : `${result.totalErrors} errors`,
        'step_config',
        undefined,
        undefined,
        totalSize,
        result.totalUpdated
      )

      return result

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'update',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'step_config'
      )
      throw error
    }
  }

  /**
   * Delete a step configuration
   */
  async deleteStepConfiguration(workspaceId: string, stepId: WorkflowStepId): Promise<void> {
    const startTime = Date.now()
    
    try {
      if (!isValidWorkspaceId(workspaceId) || !isValidWorkflowStepId(stepId)) {
        throw this.createStepConfigError('STEP_CONFIG_INVALID', 'Invalid parameters', workspaceId, stepId)
      }

      const transaction = await this.getTransaction([STORES.STEP_CONFIGURATIONS], 'readwrite')
      const store = transaction.objectStore(STORES.STEP_CONFIGURATIONS)
      
      await this.promisifyRequest(store.delete([workspaceId, stepId]))

      this.performanceMonitor.recordOperation(
        'delete',
        startTime,
        true,
        workspaceId,
        undefined,
        undefined,
        'step_config',
        stepId
      )

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'delete',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'step_config',
        stepId
      )
      throw error
    }
  }

  /**
   * Delete all step configurations for a workspace
   */
  async deleteWorkspaceStepConfigurations(workspaceId: string): Promise<void> {
    const startTime = Date.now()
    
    try {
      if (!isValidWorkspaceId(workspaceId)) {
        throw this.createError('VALIDATION_ERROR', 'Invalid workspace ID', workspaceId)
      }

      const transaction = await this.getTransaction([STORES.STEP_CONFIGURATIONS], 'readwrite')
      const store = transaction.objectStore(STORES.STEP_CONFIGURATIONS)
      const index = store.index('workspace_id')
      
      const cursor = index.openCursor(IDBKeyRange.only(workspaceId))
      let deletedCount = 0
      
      await new Promise<void>((resolve, reject) => {
        cursor.onsuccess = (event) => {
          const result = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (result) {
            result.delete()
            deletedCount++
            result.continue()
          } else {
            resolve()
          }
        }
        cursor.onerror = () => reject(cursor.error)
      })

      this.performanceMonitor.recordOperation(
        'delete',
        startTime,
        true,
        workspaceId,
        undefined,
        undefined,
        'step_config',
        undefined,
        undefined,
        undefined,
        deletedCount
      )

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'delete',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'step_config'
      )
      throw error
    }
  }

  // ============================================================================
  // STEP CONFIGURATION CACHE OPERATIONS
  // ============================================================================

  /**
   * Cache a step configuration
   */
  async cacheStepConfiguration(
    workspaceId: string,
    stepId: WorkflowStepId,
    config: any,
    ttl: number = WORKSPACE_CONSTANTS.DEFAULT_CACHE_TTL
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      const cacheKey = generateStepConfigCacheKey(workspaceId, stepId)
      const configData = compressConfigData(config)
      const configSize = estimateConfigSize(config)
      
      const cacheRecord = {
        cache_key: cacheKey,
        config_data: configData,
        expiry_time: Date.now() + ttl,
        access_count: 1,
        is_dirty: false,
        last_accessed: Date.now(),
        size: configSize
      }

      const transaction = await this.getTransaction([STORES.STEP_CONFIG_CACHE], 'readwrite')
      const store = transaction.objectStore(STORES.STEP_CONFIG_CACHE)
      
      await this.promisifyRequest(store.put(cacheRecord))

      this.performanceMonitor.recordOperation(
        'create',
        startTime,
        true,
        workspaceId,
        configSize,
        undefined,
        'cache',
        stepId,
        { hitRate: 0, accessTime: Date.now() - startTime, cacheSize: configSize }
      )

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'create',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'cache',
        stepId
      )
      throw error
    }
  }

  /**
   * Get cached step configuration
   */
  async getCachedStepConfiguration(
    workspaceId: string,
    stepId: WorkflowStepId
  ): Promise<any | null> {
    const startTime = Date.now()
    
    try {
      const cacheKey = generateStepConfigCacheKey(workspaceId, stepId)
      
      const transaction = await this.getTransaction([STORES.STEP_CONFIG_CACHE], 'readwrite')
      const store = transaction.objectStore(STORES.STEP_CONFIG_CACHE)
      
      const cacheRecord = await this.promisifyRequest(store.get(cacheKey))
      
      if (!cacheRecord) {
        this.performanceMonitor.recordOperation(
          'switch',
          startTime,
          true,
          workspaceId,
          0,
          undefined,
          'cache',
          stepId,
          { hitRate: 0, accessTime: Date.now() - startTime, cacheSize: 0 }
        )
        return null
      }

      // Check if expired
      if (Date.now() > cacheRecord.expiry_time) {
        await this.promisifyRequest(store.delete(cacheKey))
        this.performanceMonitor.recordOperation(
          'switch',
          startTime,
          true,
          workspaceId,
          0,
          'Cache expired',
          'cache',
          stepId,
          { hitRate: 0, accessTime: Date.now() - startTime, cacheSize: 0 }
        )
        return null
      }

      // Update access statistics
      cacheRecord.access_count++
      cacheRecord.last_accessed = Date.now()
      await this.promisifyRequest(store.put(cacheRecord))

      const config = decompressConfigData(cacheRecord.config_data)
      
      this.performanceMonitor.recordOperation(
        'switch',
        startTime,
        true,
        workspaceId,
        cacheRecord.size || 0,
        undefined,
        'cache',
        stepId,
        { hitRate: 1, accessTime: Date.now() - startTime, cacheSize: cacheRecord.size || 0 }
      )

      return config

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'switch',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'cache',
        stepId
      )
      throw error
    }
  }

  /**
   * Clear step configuration cache
   */
  async clearStepConfigCache(workspaceId?: string, stepId?: WorkflowStepId): Promise<void> {
    const startTime = Date.now()
    
    try {
      const transaction = await this.getTransaction([STORES.STEP_CONFIG_CACHE], 'readwrite')
      const store = transaction.objectStore(STORES.STEP_CONFIG_CACHE)
      
      if (workspaceId && stepId) {
        // Clear specific cache entry
        const cacheKey = generateStepConfigCacheKey(workspaceId, stepId)
        await this.promisifyRequest(store.delete(cacheKey))
      } else if (workspaceId) {
        // Clear all cache entries for workspace
        const cursor = store.openCursor()
        await new Promise<void>((resolve, reject) => {
          cursor.onsuccess = (event) => {
            const result = (event.target as IDBRequest<IDBCursorWithValue | null>).result
            if (result) {
              const key = result.key as string
              if (key.startsWith(`${workspaceId}:`)) {
                result.delete()
              }
              result.continue()
            } else {
              resolve()
            }
          }
          cursor.onerror = () => reject(cursor.error)
        })
      } else {
        // Clear entire cache
        await this.promisifyRequest(store.clear())
      }

      this.performanceMonitor.recordOperation(
        'delete',
        startTime,
        true,
        workspaceId,
        undefined,
        undefined,
        'cache',
        stepId
      )

    } catch (error) {
      this.performanceMonitor.recordOperation(
        'delete',
        startTime,
        false,
        workspaceId,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
        'cache',
        stepId
      )
      throw error
    }
  }

  // ============================================================================
  // STEP CONFIGURATION ERROR HANDLING
  // ============================================================================

  private createStepConfigError(
    code: StepConfigError['code'],
    message: string,
    workspaceId?: string,
    stepId?: WorkflowStepId,
    configData?: any
  ): StepConfigError {
    const error = new Error(message) as StepConfigError
    error.code = code
    error.workspaceId = workspaceId
    error.stepId = stepId
    error.configData = configData
    return error
  }

  // Database Maintenance
  async clearAllData(): Promise<void> {
    const startTime = Date.now()
    try {
      const transaction = await this.getTransaction([
        STORES.WORKSPACES, 
        STORES.SESSIONS, 
        STORES.MIGRATION_LOG,
        STORES.STEP_CONFIGURATIONS,
        STORES.STEP_CONFIG_CACHE,
        STORES.PERFORMANCE_METRICS,
        STORES.WORKSPACE_GROUPS,
        STORES.WORKSPACE_GROUP_MAPPINGS,
        STORES.SUBTITLE_TEMP_STORAGE,
        STORES.SUBTITLE_TEMP_SESSIONS,
        STORES.SUBTITLE_TEMP_METADATA
      ], 'readwrite')
      
      await Promise.all([
        this.promisifyRequest(transaction.objectStore(STORES.WORKSPACES).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.SESSIONS).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.MIGRATION_LOG).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.STEP_CONFIGURATIONS).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.STEP_CONFIG_CACHE).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.PERFORMANCE_METRICS).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.WORKSPACE_GROUPS).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.SUBTITLE_TEMP_STORAGE).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.SUBTITLE_TEMP_SESSIONS).clear()),
        this.promisifyRequest(transaction.objectStore(STORES.SUBTITLE_TEMP_METADATA).clear())
      ])
      
      this.performanceMonitor.recordLegacyOperation('delete', startTime, true)
    } catch (error) {
      this.performanceMonitor.recordLegacyOperation(
        'delete', 
        startTime, 
        false, 
        undefined, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  async getDatabaseSize(): Promise<{ workspaces: number; sessions: number; total: number }> {
    const transaction = await this.getTransaction([STORES.WORKSPACES, STORES.SESSIONS])
    
    const [workspaces, sessions] = await Promise.all([
      this.promisifyRequest(transaction.objectStore(STORES.WORKSPACES).getAll()),
      this.promisifyRequest(transaction.objectStore(STORES.SESSIONS).getAll())
    ])
    
    const workspacesSize = JSON.stringify(workspaces).length
    const sessionsSize = JSON.stringify(sessions).length
    
    return {
      workspaces: workspacesSize,
      sessions: sessionsSize,
      total: workspacesSize + sessionsSize
    }
  }

  // Performance Monitoring
  getPerformanceMetrics(): WorkspacePerformanceMetrics[] {
    return this.performanceMonitor.getMetrics()
  }

  getEnhancedPerformanceMetrics(): EnhancedWorkspacePerformanceMetrics[] {
    return this.performanceMonitor.getEnhancedMetrics()
  }

  clearPerformanceMetrics(): void {
    this.performanceMonitor.clearMetrics()
  }

  // Database Recovery from Corruption
  private async recoverFromCorruption(): Promise<void> {
    try {
      console.log('Attempting to delete corrupted database...')
      
      // Close any existing connection
      if (this.db) {
        this.db.close()
        this.db = null
      }
      
      // Delete the corrupted database
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME)
        deleteRequest.onsuccess = () => {
          console.log('Corrupted database deleted successfully')
          resolve()
        }
        deleteRequest.onerror = () => {
          console.error('Failed to delete corrupted database:', deleteRequest.error)
          reject(deleteRequest.error)
        }
        deleteRequest.onblocked = () => {
          console.warn('Database deletion blocked by other connections')
          // Try to proceed anyway
          setTimeout(() => resolve(), 1000)
        }
      })
      
      // Wait a bit before recreating
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Reset initialization state
      this.isInitialized = false
      this.initializationPromise = null
      
      // Try to recreate the database
      console.log('Recreating database after corruption recovery...')
      return this.initializeDatabase()
      
    } catch (error) {
      console.error('Database recovery failed:', error)
      throw this.createError('STORAGE_UNAVAILABLE', `Database recovery failed: ${error}`)
    }
  }

  // Database Health Check
  async healthCheck(): Promise<{ isHealthy: boolean; issues: string[] }> {
    const issues: string[] = []
    
    try {
      await this.ensureInitialized()
      
      if (!this.db) {
        issues.push('Database is not initialized')
        return { isHealthy: false, issues }
      }
      
      // Test basic operations on all stores
      const transaction = await this.getTransaction([
        STORES.WORKSPACES, 
        STORES.STEP_CONFIGURATIONS,
        STORES.STEP_CONFIG_CACHE,
        STORES.WORKSPACE_GROUPS,
        STORES.WORKSPACE_GROUP_MAPPINGS,
        STORES.SUBTITLE_TEMP_STORAGE,
        STORES.SUBTITLE_TEMP_SESSIONS,
        STORES.SUBTITLE_TEMP_METADATA
      ])
      
      // Test workspace operations
      const workspaceStore = transaction.objectStore(STORES.WORKSPACES)
      await this.promisifyRequest(workspaceStore.count())
      
      // Test step configuration operations
      const stepConfigStore = transaction.objectStore(STORES.STEP_CONFIGURATIONS)
      await this.promisifyRequest(stepConfigStore.count())
      
      // Test cache operations
      const cacheStore = transaction.objectStore(STORES.STEP_CONFIG_CACHE)
      await this.promisifyRequest(cacheStore.count())
      
      // Test workspace group operations
      const groupsStore = transaction.objectStore(STORES.WORKSPACE_GROUPS)
      await this.promisifyRequest(groupsStore.count())
      
      // Test workspace group mappings operations
      const mappingsStore = transaction.objectStore(STORES.WORKSPACE_GROUP_MAPPINGS)
      await this.promisifyRequest(mappingsStore.count())
      
      // Test subtitle temp storage operations
      const tempStorageStore = transaction.objectStore(STORES.SUBTITLE_TEMP_STORAGE)
      await this.promisifyRequest(tempStorageStore.count())
      
      // Test subtitle temp sessions operations
      const tempSessionsStore = transaction.objectStore(STORES.SUBTITLE_TEMP_SESSIONS)
      await this.promisifyRequest(tempSessionsStore.count())
      
      // Test subtitle temp metadata operations
      const tempMetadataStore = transaction.objectStore(STORES.SUBTITLE_TEMP_METADATA)
      await this.promisifyRequest(tempMetadataStore.count())
      
    } catch (error) {
      issues.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    return {
      isHealthy: issues.length === 0,
      issues
    }
  }

  // Cleanup and Disposal
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isInitialized = false
      this.initializationPromise = null
    }
  }
}

// Singleton instance
export const workspaceDatabase = new WorkspaceDatabase()

// Error handling utilities
export function isWorkspaceDBError(error: any): error is WorkspaceError {
  return error && typeof error.code === 'string' && 
    ['WORKSPACE_NOT_FOUND', 'MIGRATION_FAILED', 'STORAGE_UNAVAILABLE', 'VALIDATION_ERROR', 'BACKUP_FAILED'].includes(error.code)
}

// Database utilities
export async function waitForDatabase(): Promise<void> {
  let retries = 0
  const maxRetries = 10
  const delay = 100
  
  while (retries < maxRetries) {
    const health = await workspaceDatabase.healthCheck()
    if (health.isHealthy) {
      return
    }
    
    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, retries)))
    retries++
  }
  
  throw new Error('Database failed to initialize after maximum retries')
}