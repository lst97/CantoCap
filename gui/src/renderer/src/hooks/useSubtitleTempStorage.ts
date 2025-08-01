/**
 * useSubtitleTempStorage Hook
 * 
 * Main interface for the enhanced subtitle auto-save system with IndexedDB persistence,
 * real-time auto-save, session recovery, and comprehensive error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWorkspaceConfig } from '../contexts/WorkspaceConfigContext'
import type { SubtitleData } from '../../../types'
import type {
  SubtitleTempContent,
  SubtitleTempSession,
  SubtitleTempMetadata,
  SubtitleAutoSaveConfig,
  SubtitleTempError,
  SubtitleTempResult,
  SubtitleTempStorageConfig,
  SubtitleValidationWarning,
  SubtitleValidationError,
  generateTempStorageId,
  calculateContentHash,
  isSubtitleTempError,
  isSubtitleTempContent
} from '../types/subtitle-temp-storage'

import {
  DEFAULT_SUBTITLE_TEMP_CONFIG,
  SUBTITLE_TEMP_STORAGE_CONSTANTS
} from '../types/subtitle-temp-storage'

// ============================================================================
// HOOK CONFIGURATION AND OPTIONS
// ============================================================================

export interface UseSubtitleTempStorageOptions {
  /** Enable automatic saving */
  autoSaveEnabled?: boolean
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number
  /** Save on idle timeout */
  saveOnIdle?: boolean
  /** Idle timeout in milliseconds */
  idleTimeout?: number
  /** Maximum number of backups to retain */
  maxBackups?: number
  /** Enable compression for large content */
  compressionEnabled?: boolean
  /** Validate content before saving */
  validateBeforeSave?: boolean
  /** Enable session recovery on startup */
  enableSessionRecovery?: boolean
  /** Custom error handler */
  onError?: (error: SubtitleTempError) => void
  /** Auto-save success callback */
  onAutoSave?: (metadata: SubtitleTempMetadata) => void
  /** Session recovery callback */
  onSessionRecovered?: (session: SubtitleTempSession) => void
}

export interface UseSubtitleTempStorageResult {
  // Core State
  currentContent: SubtitleTempContent | null
  currentSession: SubtitleTempSession | null
  isLoading: boolean
  isSaving: boolean
  isAutoSaving: boolean
  hasUnsavedChanges: boolean
  lastSaveTime: number | null
  
  // Error State
  error: SubtitleTempError | null
  validationWarnings: SubtitleValidationWarning[]
  validationErrors: SubtitleValidationError[]
  
  // Session Recovery
  hasRecoverableSession: boolean
  recoverableSessionIds: string[]
  
  // Content Operations
  saveContent: (content: SubtitleTempContent, options?: SaveContentOptions) => Promise<SubtitleTempResult<string>>
  loadContent: (storageId: string) => Promise<SubtitleTempResult<SubtitleTempContent>>
  updateContent: (subtitles: SubtitleData[], context?: Partial<SubtitleTempContent['editingContext']>) => void
  clearContent: () => void
  
  // Session Management
  createSession: (sessionType?: SubtitleTempSession['sessionType']) => Promise<SubtitleTempResult<string>>
  recoverSession: (sessionId: string) => Promise<SubtitleTempResult<SubtitleTempSession>>
  updateSession: (updates: Partial<SubtitleTempSession>) => Promise<SubtitleTempResult<void>>
  endSession: () => Promise<SubtitleTempResult<void>>
  
  // Auto-save Control
  enableAutoSave: (interval?: number) => void
  disableAutoSave: () => void
  forceSave: () => Promise<SubtitleTempResult<string>>
  
  // Backup Management
  createBackup: (description?: string) => Promise<SubtitleTempResult<string>>
  restoreBackup: (backupId: string) => Promise<SubtitleTempResult<void>>
  getBackupHistory: () => Promise<SubtitleTempResult<SubtitleTempMetadata[]>>
  
  // Error Handling
  clearError: () => void
  retryLastOperation: () => Promise<SubtitleTempResult<any>>
  
  // Cleanup
  cleanup: (options?: CleanupOptions) => Promise<SubtitleTempResult<void>>
}

interface SaveContentOptions {
  createBackup?: boolean
  description?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
}

interface CleanupOptions {
  olderThanDays?: number
  keepLatest?: number
  removeOrphaned?: boolean
}

// ============================================================================
// MAIN HOOK IMPLEMENTATION
// ============================================================================

export function useSubtitleTempStorage(
  options: UseSubtitleTempStorageOptions = {}
): UseSubtitleTempStorageResult {
  const { currentWorkspaceId, isWorkspaceReady } = useWorkspaceConfig()
  
  // Merge options with defaults
  const config: Required<UseSubtitleTempStorageOptions> = {
    autoSaveEnabled: true,
    autoSaveInterval: 30000, // 30 seconds
    saveOnIdle: true,
    idleTimeout: 300000, // 5 minutes
    maxBackups: 10,
    compressionEnabled: true,
    validateBeforeSave: true,
    enableSessionRecovery: true,
    onError: () => {},
    onAutoSave: () => {},
    onSessionRecovered: () => {},
    ...options
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [currentContent, setCurrentContent] = useState<SubtitleTempContent | null>(null)
  const [currentSession, setCurrentSession] = useState<SubtitleTempSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null)
  const [error, setError] = useState<SubtitleTempError | null>(null)
  const [validationWarnings, setValidationWarnings] = useState<SubtitleValidationWarning[]>([])
  const [validationErrors, setValidationErrors] = useState<SubtitleValidationError[]>([])
  const [hasRecoverableSession, setHasRecoverableSession] = useState(false)
  const [recoverableSessionIds, setRecoverableSessionIds] = useState<string[]>([])

  // Internal refs for timers and state tracking
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const lastOperationRef = useRef<() => Promise<SubtitleTempResult<any>> | null>(null)
  const dbRef = useRef<IDBDatabase | null>(null)

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  const initializeDatabase = useCallback(async (): Promise<IDBDatabase> => {
    if (dbRef.current) return dbRef.current

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DEFAULT_SUBTITLE_TEMP_CONFIG.database.name, DEFAULT_SUBTITLE_TEMP_CONFIG.database.version)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        dbRef.current = request.result
        resolve(request.result)
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('subtitle_temp_storage')) {
          const storageStore = db.createObjectStore('subtitle_temp_storage', { keyPath: 'id' })
          storageStore.createIndex('workspaceId', 'workspaceId', { unique: false })
          storageStore.createIndex('sessionId', 'sessionId', { unique: false })
          storageStore.createIndex('storageType', 'storageType', { unique: false })
          storageStore.createIndex('lastModified', 'lastModified', { unique: false })
        }
        
        if (!db.objectStoreNames.contains('subtitle_temp_sessions')) {
          const sessionStore = db.createObjectStore('subtitle_temp_sessions', { keyPath: 'sessionId' })
          sessionStore.createIndex('workspaceId', 'workspaceId', { unique: false })
          sessionStore.createIndex('sessionType', 'sessionType', { unique: false })
          sessionStore.createIndex('lastActivity', 'lastActivity', { unique: false })
        }
      }
    })
  }, [])

  const performDatabaseOperation = useCallback(async <T>(
    operation: (db: IDBDatabase) => Promise<T>
  ): Promise<SubtitleTempResult<T>> => {
    try {
      const db = await initializeDatabase()
      const result = await operation(db)
      return {
        success: true,
        data: result,
        metrics: { duration: 0, dataSize: 0 }
      }
    } catch (error) {
      const tempError: SubtitleTempError = {
        code: 'STORAGE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Database operation failed',
        timestamp: Date.now(),
        severity: 'high',
        workspaceId: currentWorkspaceId || undefined
      }
      
      setError(tempError)
      config.onError(tempError)
      
      return {
        success: false,
        error: tempError,
        metrics: { duration: 0 }
      }
    }
  }, [initializeDatabase, currentWorkspaceId, config])

  // ============================================================================
  // CONTENT VALIDATION
  // ============================================================================

  const validateContent = useCallback((content: SubtitleTempContent): {
    isValid: boolean
    warnings: SubtitleValidationWarning[]
    errors: SubtitleValidationError[]
  } => {
    const warnings: SubtitleValidationWarning[] = []
    const errors: SubtitleValidationError[] = []

    // Validate basic structure
    if (!isSubtitleTempContent(content)) {
      errors.push({
        id: generateTempStorageId('validation-error'),
        type: 'schema_violation',
        message: 'Content does not match expected schema',
        critical: true,
        recoverable: false
      })
      return { isValid: false, warnings, errors }
    }

    // Validate subtitles
    content.subtitles.forEach((subtitle, index) => {
      // Check timing
      if (subtitle.startTime >= subtitle.endTime) {
        errors.push({
          id: generateTempStorageId('validation-error'),
          subtitleId: subtitle.id,
          type: 'invalid_timing',
          message: `Invalid timing: start time (${subtitle.startTime}) >= end time (${subtitle.endTime})`,
          critical: true,
          recoverable: true
        })
      }

      // Check for overlaps with next subtitle
      if (index < content.subtitles.length - 1) {
        const nextSubtitle = content.subtitles[index + 1]
        if (subtitle.endTime > nextSubtitle.startTime) {
          warnings.push({
            id: generateTempStorageId('validation-warning'),
            subtitleId: subtitle.id,
            type: 'timing_overlap',
            message: `Overlap detected with next subtitle`,
            severity: 'medium',
            autoFixable: true
          })
        }
      }

      // Check for large gaps
      if (index > 0) {
        const prevSubtitle = content.subtitles[index - 1]
        const gap = subtitle.startTime - prevSubtitle.endTime
        if (gap > 5000) { // 5 seconds
          warnings.push({
            id: generateTempStorageId('validation-warning'),
            subtitleId: subtitle.id,
            type: 'timing_gap',
            message: `Large gap (${(gap / 1000).toFixed(1)}s) before this subtitle`,
            severity: 'low',
            autoFixable: false
          })
        }
      }

      // Check confidence levels
      if (subtitle.confidence && subtitle.confidence < 0.7) {
        warnings.push({
          id: generateTempStorageId('validation-warning'),
          subtitleId: subtitle.id,
          type: 'low_confidence',
          message: `Low confidence score: ${(subtitle.confidence * 100).toFixed(1)}%`,
          severity: subtitle.confidence < 0.5 ? 'high' : 'medium',
          autoFixable: false
        })
      }

      // Check for empty text
      if (!subtitle.text || subtitle.text.trim().length === 0) {
        warnings.push({
          id: generateTempStorageId('validation-warning'),
          subtitleId: subtitle.id,
          type: 'missing_translation',
          message: 'Empty subtitle text',
          severity: 'medium',
          autoFixable: false
        })
      }

      // Check for long text
      if (subtitle.text && subtitle.text.length > 100) {
        warnings.push({
          id: generateTempStorageId('validation-warning'),
          subtitleId: subtitle.id,
          type: 'long_text',
          message: `Long subtitle text (${subtitle.text.length} characters)`,
          severity: 'low',
          autoFixable: false
        })
      }
    })

    const isValid = errors.length === 0
    return { isValid, warnings, errors }
  }, [])

  // ============================================================================
  // CONTENT OPERATIONS
  // ============================================================================

  const saveContent = useCallback(async (
    content: SubtitleTempContent,
    options: SaveContentOptions = {}
  ): Promise<SubtitleTempResult<string>> => {
    if (!currentWorkspaceId) {
      const error: SubtitleTempError = {
        code: 'SESSION_EXPIRED',
        message: 'No active workspace',
        timestamp: Date.now(),
        severity: 'critical'
      }
      return { success: false, error, metrics: { duration: 0 } }
    }

    const startTime = performance.now()
    setIsSaving(true)

    try {
      // Validate content if requested
      if (config.validateBeforeSave) {
        const validation = validateContent(content)
        setValidationWarnings(validation.warnings)
        setValidationErrors(validation.errors)
        
        if (!validation.isValid) {
          const error: SubtitleTempError = {
            code: 'VALIDATION_FAILED',
            message: `Content validation failed: ${validation.errors.length} errors`,
            timestamp: Date.now(),
            severity: 'high',
            workspaceId: currentWorkspaceId
          }
          return { success: false, error, metrics: { duration: performance.now() - startTime } }
        }
      }

      // Create metadata
      const storageId = generateTempStorageId('content')
      const contentHash = await calculateContentHash(content)
      const dataSize = new Blob([JSON.stringify(content)]).size
      
      const metadata: SubtitleTempMetadata = {
        id: storageId,
        workspaceId: currentWorkspaceId,
        sessionId: currentSession?.sessionId || generateTempStorageId('session'),
        storageType: options.createBackup ? 'session_backup' : 'auto_save',
        createdAt: Date.now(),
        lastModified: Date.now(),
        dataSize,
        contentHash,
        metadataHash: await calculateContentHash({ id: storageId, workspaceId: currentWorkspaceId }),
        version: 1,
        schemaVersion: 1,
        autoSave: {
          intervalMs: config.autoSaveInterval,
          triggerReason: options.createBackup ? 'user_action' : 'timer',
          changeCount: content.changeTracking.changeCount,
          lastUserAction: content.changeTracking.lastUserAction
        }
      }

      // Save to database
      const result = await performDatabaseOperation(async (db) => {
        const transaction = db.transaction(['subtitle_temp_storage'], 'readwrite')
        const store = transaction.objectStore('subtitle_temp_storage')
        
        const record = {
          id: storageId,
          workspaceId: currentWorkspaceId,
          sessionId: metadata.sessionId,
          storageType: metadata.storageType,
          contentData: JSON.stringify(content),
          metadataData: JSON.stringify(metadata),
          contentHash,
          metadataHash: metadata.metadataHash,
          createdAt: metadata.createdAt,
          lastModified: metadata.lastModified,
          dataSize,
          version: 1,
          schemaVersion: 1,
          isCompressed: false,
          generationLevel: 0,
          isLatest: true
        }
        
        await new Promise<void>((resolve, reject) => {
          const request = store.put(record)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
        
        return storageId
      })

      if (result.success) {
        setLastSaveTime(Date.now())
        setHasUnsavedChanges(false)
        setCurrentContent(content)
        config.onAutoSave(metadata)
      }

      return result
    } finally {
      setIsSaving(false)
    }
  }, [currentWorkspaceId, currentSession, config, performDatabaseOperation, validateContent])

  const loadContent = useCallback(async (storageId: string): Promise<SubtitleTempResult<SubtitleTempContent>> => {
    setIsLoading(true)
    
    try {
      return await performDatabaseOperation(async (db) => {
        const transaction = db.transaction(['subtitle_temp_storage'], 'readonly')
        const store = transaction.objectStore('subtitle_temp_storage')
        
        const record = await new Promise<any>((resolve, reject) => {
          const request = store.get(storageId)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        
        if (!record) {
          throw new Error(`Content not found: ${storageId}`)
        }
        
        const content = JSON.parse(record.contentData) as SubtitleTempContent
        
        // Validate loaded content
        if (!isSubtitleTempContent(content)) {
          throw new Error('Invalid content format')
        }
        
        setCurrentContent(content)
        return content
      })
    } finally {
      setIsLoading(false)
    }
  }, [performDatabaseOperation])

  const updateContent = useCallback((
    subtitles: SubtitleData[],
    context?: Partial<SubtitleTempContent['editingContext']>
  ) => {
    if (!currentContent || !currentWorkspaceId) return

    const updatedContent: SubtitleTempContent = {
      ...currentContent,
      subtitles,
      editingContext: {
        ...currentContent.editingContext,
        ...context
      },
      changeTracking: {
        ...currentContent.changeTracking,
        changeCount: currentContent.changeTracking.changeCount + 1,
        lastUserAction: Date.now(),
        modifiedIds: new Set([...currentContent.changeTracking.modifiedIds, ...subtitles.map(s => s.id)])
      }
    }

    setCurrentContent(updatedContent)
    setHasUnsavedChanges(true)
    lastActivityRef.current = Date.now()

    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    
    if (config.saveOnIdle) {
      idleTimerRef.current = setTimeout(() => {
        if (hasUnsavedChanges) {
          forceSave()
        }
      }, config.idleTimeout)
    }
  }, [currentContent, currentWorkspaceId, hasUnsavedChanges, config])

  const clearContent = useCallback(() => {
    setCurrentContent(null)
    setHasUnsavedChanges(false)
    setValidationWarnings([])
    setValidationErrors([])
  }, [])

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  const createSession = useCallback(async (
    sessionType: SubtitleTempSession['sessionType'] = 'review'
  ): Promise<SubtitleTempResult<string>> => {
    if (!currentWorkspaceId) {
      const error: SubtitleTempError = {
        code: 'SESSION_EXPIRED',
        message: 'No active workspace',
        timestamp: Date.now(),
        severity: 'critical'
      }
      return { success: false, error, metrics: { duration: 0 } }
    }

    const sessionId = generateTempStorageId('session')
    const now = Date.now()
    
    const session: SubtitleTempSession = {
      sessionId,
      workspaceId: currentWorkspaceId,
      sessionType,
      createdAt: now,
      lastActivity: now,
      state: {
        editingMode: 'simple',
        multiSelect: {
          enabled: false,
          selectedIds: []
        },
        undoRedoState: {
          undoStackSize: 0,
          redoStackSize: 0,
          canUndo: false,
          canRedo: false,
          lastActionTimestamp: now
        },
        pendingChanges: {
          hasChanges: false,
          changeCount: 0,
          lastChangeTimestamp: now,
          needsValidation: false
        }
      },
      autoSaveConfig: {
        enabled: config.autoSaveEnabled,
        intervalMs: config.autoSaveInterval,
        saveOnIdle: config.saveOnIdle,
        idleTimeoutMs: config.idleTimeout,
        saveOnChangeCount: 10,
        createBackups: true,
        maxBackups: config.maxBackups,
        compressionEnabled: config.compressionEnabled,
        validateBeforeSave: config.validateBeforeSave
      },
      sessionStats: {
        totalEdits: 0,
        editingTime: 0,
        autoSavesCount: 0,
        manualSavesCount: 0,
        validationRuns: 0,
        errorCount: 0,
        averageSaveInterval: config.autoSaveInterval
      },
      backupManagement: {
        maxBackups: config.maxBackups,
        retentionHours: 24,
        lastCleanup: now,
        backupIds: []
      }
    }

    const result = await performDatabaseOperation(async (db) => {
      const transaction = db.transaction(['subtitle_temp_sessions'], 'readwrite')
      const store = transaction.objectStore('subtitle_temp_sessions')
      
      const record = {
        sessionId,
        workspaceId: currentWorkspaceId,
        sessionType,
        sessionData: JSON.stringify(session),
        stateHash: await calculateContentHash(session.state),
        createdAt: now,
        lastActivity: now,
        status: 'active' as const,
        storageIds: [],
        configData: JSON.stringify(session.autoSaveConfig),
        version: 1,
        schemaVersion: 1
      }
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(record)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
      
      return sessionId
    })

    if (result.success) {
      setCurrentSession(session)
    }

    return result
  }, [currentWorkspaceId, config, performDatabaseOperation])

  const recoverSession = useCallback(async (sessionId: string): Promise<SubtitleTempResult<SubtitleTempSession>> => {
    return await performDatabaseOperation(async (db) => {
      const transaction = db.transaction(['subtitle_temp_sessions'], 'readonly')
      const store = transaction.objectStore('subtitle_temp_sessions')
      
      const record = await new Promise<any>((resolve, reject) => {
        const request = store.get(sessionId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      
      if (!record) {
        throw new Error(`Session not found: ${sessionId}`)
      }
      
      const session = JSON.parse(record.sessionData) as SubtitleTempSession
      setCurrentSession(session)
      config.onSessionRecovered(session)
      
      return session
    })
  }, [performDatabaseOperation, config])

  const updateSession = useCallback(async (updates: Partial<SubtitleTempSession>): Promise<SubtitleTempResult<void>> => {
    if (!currentSession) {
      const error: SubtitleTempError = {
        code: 'SESSION_EXPIRED',
        message: 'No active session',
        timestamp: Date.now(),
        severity: 'high'
      }
      return { success: false, error, metrics: { duration: 0 } }
    }

    const updatedSession: SubtitleTempSession = {
      ...currentSession,
      ...updates,
      lastActivity: Date.now()
    }

    const result = await performDatabaseOperation(async (db) => {
      const transaction = db.transaction(['subtitle_temp_sessions'], 'readwrite')
      const store = transaction.objectStore('subtitle_temp_sessions')
      
      const record = {
        sessionId: updatedSession.sessionId,
        workspaceId: updatedSession.workspaceId,
        sessionType: updatedSession.sessionType,
        sessionData: JSON.stringify(updatedSession),
        stateHash: await calculateContentHash(updatedSession.state),
        createdAt: updatedSession.createdAt,
        lastActivity: updatedSession.lastActivity,
        status: 'active' as const,
        storageIds: [],
        configData: JSON.stringify(updatedSession.autoSaveConfig),
        version: 1,
        schemaVersion: 1
      }
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(record)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })

    if (result.success) {
      setCurrentSession(updatedSession)
    }

    return result
  }, [currentSession, performDatabaseOperation])

  const endSession = useCallback(async (): Promise<SubtitleTempResult<void>> => {
    if (!currentSession) {
      return { success: true, data: undefined, metrics: { duration: 0 } }
    }

    // Save any pending changes
    if (hasUnsavedChanges && currentContent) {
      await saveContent(currentContent, { createBackup: true, description: 'Session end backup' })
    }

    // Update session status
    const result = await performDatabaseOperation(async (db) => {
      const transaction = db.transaction(['subtitle_temp_sessions'], 'readwrite')
      const store = transaction.objectStore('subtitle_temp_sessions')
      
      const record = await new Promise<any>((resolve, reject) => {
        const request = store.get(currentSession.sessionId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      
      if (record) {
        record.status = 'inactive'
        record.lastActivity = Date.now()
        
        await new Promise<void>((resolve, reject) => {
          const request = store.put(record)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }
    })

    if (result.success) {
      setCurrentSession(null)
      clearContent()
    }

    return result
  }, [currentSession, hasUnsavedChanges, currentContent, saveContent, performDatabaseOperation, clearContent])

  // ============================================================================
  // AUTO-SAVE MANAGEMENT
  // ============================================================================

  const enableAutoSave = useCallback((interval?: number) => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
    }

    const saveInterval = interval || config.autoSaveInterval
    
    autoSaveTimerRef.current = setInterval(async () => {
      if (hasUnsavedChanges && currentContent && !isSaving) {
        setIsAutoSaving(true)
        try {
          await saveContent(currentContent)
        } catch (error) {
          console.error('Auto-save failed:', error)
        } finally {
          setIsAutoSaving(false)
        }
      }
    }, saveInterval)
  }, [config.autoSaveInterval, hasUnsavedChanges, currentContent, isSaving, saveContent])

  const disableAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [])

  const forceSave = useCallback(async (): Promise<SubtitleTempResult<string>> => {
    if (!currentContent) {
      const error: SubtitleTempError = {
        code: 'VALIDATION_FAILED',
        message: 'No content to save',
        timestamp: Date.now(),
        severity: 'low'
      }
      return { success: false, error, metrics: { duration: 0 } }
    }

    return await saveContent(currentContent, { priority: 'high' })
  }, [currentContent, saveContent])

  // ============================================================================
  // BACKUP MANAGEMENT
  // ============================================================================

  const createBackup = useCallback(async (description?: string): Promise<SubtitleTempResult<string>> => {
    if (!currentContent) {
      const error: SubtitleTempError = {
        code: 'VALIDATION_FAILED',
        message: 'No content to backup',
        timestamp: Date.now(),
        severity: 'low'
      }
      return { success: false, error, metrics: { duration: 0 } }
    }

    return await saveContent(currentContent, {
      createBackup: true,
      description: description || `Manual backup - ${new Date().toLocaleString()}`
    })
  }, [currentContent, saveContent])

  const restoreBackup = useCallback(async (backupId: string): Promise<SubtitleTempResult<void>> => {
    const loadResult = await loadContent(backupId)
    if (!loadResult.success) {
      return loadResult as SubtitleTempResult<void>
    }

    setCurrentContent(loadResult.data)
    setHasUnsavedChanges(true)
    
    return { success: true, data: undefined, metrics: { duration: 0 } }
  }, [loadContent])

  const getBackupHistory = useCallback(async (): Promise<SubtitleTempResult<SubtitleTempMetadata[]>> => {
    if (!currentWorkspaceId) {
      const error: SubtitleTempError = {
        code: 'SESSION_EXPIRED',
        message: 'No active workspace',
        timestamp: Date.now(),
        severity: 'high'
      }
      return { success: false, error, metrics: { duration: 0 } }
    }

    return await performDatabaseOperation(async (db) => {
      const transaction = db.transaction(['subtitle_temp_storage'], 'readonly')
      const store = transaction.objectStore('subtitle_temp_storage')
      const index = store.index('workspaceId')
      
      const records = await new Promise<any[]>((resolve, reject) => {
        const request = index.getAll(currentWorkspaceId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      
      const backups = records
        .filter(record => record.storageType === 'session_backup')
        .map(record => JSON.parse(record.metadataData) as SubtitleTempMetadata)
        .sort((a, b) => b.lastModified - a.lastModified)
      
      return backups
    })
  }, [currentWorkspaceId, performDatabaseOperation])

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const retryLastOperation = useCallback(async (): Promise<SubtitleTempResult<any>> => {
    if (lastOperationRef.current) {
      return await lastOperationRef.current()
    }
    
    const error: SubtitleTempError = {
      code: 'VALIDATION_FAILED',
      message: 'No operation to retry',
      timestamp: Date.now(),
      severity: 'low'
    }
    return { success: false, error, metrics: { duration: 0 } }
  }, [])

  // ============================================================================
  // CLEANUP
  // ============================================================================

  const cleanup = useCallback(async (options: CleanupOptions = {}): Promise<SubtitleTempResult<void>> => {
    const opts = {
      olderThanDays: 7,
      keepLatest: 5,
      removeOrphaned: true,
      ...options
    }

    return await performDatabaseOperation(async (db) => {
      const transaction = db.transaction(['subtitle_temp_storage'], 'readwrite')
      const store = transaction.objectStore('subtitle_temp_storage')
      const cutoffTime = Date.now() - (opts.olderThanDays * 24 * 60 * 60 * 1000)
      
      // Get all records to clean up
      const allRecords = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      
      // Filter old records
      const oldRecords = allRecords.filter(record => record.lastModified < cutoffTime)
      
      // Keep latest records per workspace
      const workspaceGroups = new Map<string, any[]>()
      allRecords.forEach(record => {
        if (!workspaceGroups.has(record.workspaceId)) {
          workspaceGroups.set(record.workspaceId, [])
        }
        workspaceGroups.get(record.workspaceId)!.push(record)
      })
      
      // Delete old records
      for (const record of oldRecords) {
        const workspaceRecords = workspaceGroups.get(record.workspaceId) || []
        const sortedRecords = workspaceRecords.sort((a, b) => b.lastModified - a.lastModified)
        
        if (sortedRecords.indexOf(record) >= opts.keepLatest) {
          await new Promise<void>((resolve, reject) => {
            const request = store.delete(record.id)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
          })
        }
      }
    })
  }, [performDatabaseOperation])

  // ============================================================================
  // EFFECTS AND INITIALIZATION
  // ============================================================================

  // Check for recoverable sessions on workspace change
  useEffect(() => {
    if (!isWorkspaceReady || !currentWorkspaceId || !config.enableSessionRecovery) return

    const checkRecoverableSessions = async () => {
      try {
        const db = await initializeDatabase()
        const transaction = db.transaction(['subtitle_temp_sessions'], 'readonly')
        const store = transaction.objectStore('subtitle_temp_sessions')
        const index = store.index('workspaceId')
        
        const records = await new Promise<any[]>((resolve, reject) => {
          const request = index.getAll(currentWorkspaceId)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        
        const recoverableSessions = records
          .filter(record => record.status === 'active')
          .map(record => record.sessionId)
        
        setRecoverableSessionIds(recoverableSessions)
        setHasRecoverableSession(recoverableSessions.length > 0)
      } catch (error) {
        console.error('Failed to check recoverable sessions:', error)
      }
    }

    checkRecoverableSessions()
  }, [isWorkspaceReady, currentWorkspaceId, config.enableSessionRecovery, initializeDatabase])

  // Setup auto-save
  useEffect(() => {
    if (config.autoSaveEnabled) {
      enableAutoSave()
    } else {
      disableAutoSave()
    }

    return () => {
      disableAutoSave()
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
    }
  }, [config.autoSaveEnabled, enableAutoSave, disableAutoSave])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dbRef.current) {
        dbRef.current.close()
      }
    }
  }, [])

  // ============================================================================
  // RETURN HOOK RESULT
  // ============================================================================

  return {
    // Core State
    currentContent,
    currentSession,
    isLoading,
    isSaving,
    isAutoSaving,
    hasUnsavedChanges,
    lastSaveTime,
    
    // Error State
    error,
    validationWarnings,
    validationErrors,
    
    // Session Recovery
    hasRecoverableSession,
    recoverableSessionIds,
    
    // Content Operations
    saveContent,
    loadContent,
    updateContent,
    clearContent,
    
    // Session Management
    createSession,
    recoverSession,
    updateSession,
    endSession,
    
    // Auto-save Control
    enableAutoSave,
    disableAutoSave,
    forceSave,
    
    // Backup Management
    createBackup,
    restoreBackup,
    getBackupHistory,
    
    // Error Handling
    clearError,
    retryLastOperation,
    
    // Cleanup
    cleanup
  }
}