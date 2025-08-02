/**
 * Simplified IndexedDB operations for subtitle storage
 * 
 * Pure IndexedDB implementation for storing original and modified subtitle data
 * without file system dependencies. Provides simple save/load operations.
 */

import type { SubtitleEntry } from '../types/subtitle'
import type { SubtitleTempMetadata } from '../types/subtitle-temp-storage'
import { getIndexedDBPerformanceMonitor } from './indexeddb-performance-monitor'

// ============================================================================
// TYPES
// ============================================================================

export interface SubtitleTempStorage {
  id: string                    // Primary key: `${workspaceId}-${sessionId}-${dataType}`
  workspaceId: string          // Workspace binding
  sessionId: string            // Session association  
  dataType: 'original' | 'modified'
  contentData: string          // JSON string of subtitle data
  metadata: SubtitleTempMetadata
  createdAt: number
  lastModified: number
}

export interface SessionSubtitles {
  original: SubtitleEntry[] | null
  modified: SubtitleEntry[] | null
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

const DB_NAME = 'CantoCap_SubtitleSimple'
const DB_VERSION = 1
const STORE_NAME = 'subtitle_storage'

let dbInstance: IDBDatabase | null = null

/**
 * Initialize IndexedDB database
 */
async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('workspaceId', 'workspaceId', { unique: false })
        store.createIndex('sessionId', 'sessionId', { unique: false })
        store.createIndex('dataType', 'dataType', { unique: false })
        store.createIndex('workspaceSession', ['workspaceId', 'sessionId'], { unique: false })
      }
    }
  })
}

/**
 * Generate storage ID
 */
function generateStorageId(workspaceId: string, sessionId: string, dataType: 'original' | 'modified'): string {
  return `${workspaceId}-${sessionId}-${dataType}`
}

/**
 * Create basic metadata
 */
function createMetadata(workspaceId: string, sessionId: string): SubtitleTempMetadata {
  const now = Date.now()
  return {
    id: generateStorageId(workspaceId, sessionId, 'original'), // Default ID, will be updated
    workspaceId,
    sessionId,
    storageType: 'auto_save',
    createdAt: now,
    lastModified: now,
    dataSize: 0,
    contentHash: '',
    metadataHash: '',
    version: 1,
    schemaVersion: 1
  }
}

// ============================================================================
// CORE OPERATIONS
// ============================================================================

/**
 * Save original subtitles to IndexedDB
 */
export async function saveOriginalSubtitles(
  workspaceId: string,
  sessionId: string,
  subtitles: SubtitleEntry[]
): Promise<void> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  
  const id = generateStorageId(workspaceId, sessionId, 'original')
  const contentData = JSON.stringify(subtitles)
  const metadata = createMetadata(workspaceId, sessionId)
  metadata.id = id
  metadata.dataSize = new Blob([contentData]).size
  
  const record: SubtitleTempStorage = {
    id,
    workspaceId,
    sessionId,
    dataType: 'original',
    contentData,
    metadata,
    createdAt: Date.now(),
    lastModified: Date.now()
  }
  
  return new Promise((resolve, reject) => {
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Save modified subtitles to IndexedDB
 */
export async function saveModifiedSubtitles(
  workspaceId: string,
  sessionId: string,
  subtitles: SubtitleEntry[]
): Promise<void> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  
  const id = generateStorageId(workspaceId, sessionId, 'modified')
  const contentData = JSON.stringify(subtitles)
  const metadata = createMetadata(workspaceId, sessionId)
  metadata.id = id
  metadata.storageType = 'modified'
  metadata.dataSize = new Blob([contentData]).size
  
  const record: SubtitleTempStorage = {
    id,
    workspaceId,
    sessionId,
    dataType: 'modified',
    contentData,
    metadata,
    createdAt: Date.now(),
    lastModified: Date.now()
  }
  
  return new Promise((resolve, reject) => {
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Load session subtitles (both original and modified) from IndexedDB
 */
export async function loadSessionSubtitles(
  workspaceId: string,
  sessionId: string
): Promise<SessionSubtitles> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readonly')
  const store = transaction.objectStore(STORE_NAME)
  
  // Load original subtitles
  const originalId = generateStorageId(workspaceId, sessionId, 'original')
  const originalPromise = new Promise<SubtitleEntry[] | null>((resolve, reject) => {
    const request = store.get(originalId)
    request.onsuccess = () => {
      if (request.result) {
        try {
          const subtitles = JSON.parse(request.result.contentData) as SubtitleEntry[]
          resolve(subtitles)
        } catch (error) {
          console.error('Failed to parse original subtitles:', error)
          resolve(null)
        }
      } else {
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error)
  })
  
  // Load modified subtitles
  const modifiedId = generateStorageId(workspaceId, sessionId, 'modified')
  const modifiedPromise = new Promise<SubtitleEntry[] | null>((resolve, reject) => {
    const request = store.get(modifiedId)
    request.onsuccess = () => {
      if (request.result) {
        try {
          const subtitles = JSON.parse(request.result.contentData) as SubtitleEntry[]
          resolve(subtitles)
        } catch (error) {
          console.error('Failed to parse modified subtitles:', error)
          resolve(null)
        }
      } else {
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error)
  })
  
  const [original, modified] = await Promise.all([originalPromise, modifiedPromise])
  
  return {
    original,
    modified
  }
}

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Delete session data from IndexedDB
 */
export async function deleteSessionData(
  workspaceId: string,
  sessionId: string
): Promise<void> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  
  const originalId = generateStorageId(workspaceId, sessionId, 'original')
  const modifiedId = generateStorageId(workspaceId, sessionId, 'modified')
  
  const deletePromises = [originalId, modifiedId].map(id => 
    new Promise<void>((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  )
  
  await Promise.all(deletePromises)
}

/**
 * Check if session has stored data
 */
export async function hasSessionData(
  workspaceId: string,
  sessionId: string
): Promise<{ hasOriginal: boolean; hasModified: boolean }> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readonly')
  const store = transaction.objectStore(STORE_NAME)
  
  const originalId = generateStorageId(workspaceId, sessionId, 'original')
  const modifiedId = generateStorageId(workspaceId, sessionId, 'modified')
  
  const originalPromise = new Promise<boolean>((resolve, reject) => {
    const request = store.get(originalId)
    request.onsuccess = () => resolve(!!request.result)
    request.onerror = () => reject(request.error)
  })
  
  const modifiedPromise = new Promise<boolean>((resolve, reject) => {
    const request = store.get(modifiedId)
    request.onsuccess = () => resolve(!!request.result)
    request.onerror = () => reject(request.error)
  })
  
  const [hasOriginal, hasModified] = await Promise.all([originalPromise, modifiedPromise])
  
  return {
    hasOriginal,
    hasModified
  }
}

/**
 * List all sessions for a workspace
 */
export async function listWorkspaceSessions(workspaceId: string): Promise<string[]> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readonly')
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index('workspaceId')
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(workspaceId)
    request.onsuccess = () => {
      const sessions = new Set<string>()
      request.result.forEach((record: SubtitleTempStorage) => {
        sessions.add(record.sessionId)
      })
      resolve(Array.from(sessions))
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Clean up workspace-specific session data with performance monitoring
 */
export async function cleanupWorkspaceSession(workspaceId: string): Promise<{
  deletedSessions: number
  deletedRecords: number
  reclaimedBytes: number
}> {
  const monitor = getIndexedDBPerformanceMonitor({ enabled: true })
  const operationId = monitor.startOperation('cleanup', STORE_NAME, {
    workspaceId,
    operationType: 'workspace_cleanup'
  })
  
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('workspaceId')
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(workspaceId)
      request.onsuccess = () => {
        const records = request.result as SubtitleTempStorage[]
        const sessions = new Set<string>()
        let reclaimedBytes = 0
        
        const deletePromises = records.map(record => {
          sessions.add(record.sessionId)
          reclaimedBytes += record.metadata.dataSize || 0
          
          return new Promise<void>((deleteResolve, deleteReject) => {
            const deleteRequest = store.delete(record.id)
            deleteRequest.onsuccess = () => deleteResolve()
            deleteRequest.onerror = () => deleteReject(deleteRequest.error)
          })
        })
        
        Promise.all(deletePromises)
          .then(() => {
            const result = {
              deletedSessions: sessions.size,
              deletedRecords: records.length,
              reclaimedBytes
            }
            
            monitor.endOperation(operationId, true, {
              recordCount: records.length,
              dataSize: reclaimedBytes
            })
            
            resolve(result)
          })
          .catch(error => {
            monitor.endOperation(operationId, false, { error })
            reject(error)
          })
      }
      request.onerror = () => {
        monitor.endOperation(operationId, false, { error: request.error || new Error('Unknown error') })
        reject(request.error)
      }
    })
  } catch (error) {
    monitor.endOperation(operationId, false, { error: error as Error })
    throw error
  }
}

/**
 * Clean up old session data with performance monitoring
 */
export async function cleanupOldSessions(olderThanDays: number = 7): Promise<{
  deletedSessions: number
  deletedRecords: number
  reclaimedBytes: number
  duration: number
}> {
  const startTime = performance.now()
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
  const sessions = new Set<string>()
  let reclaimedBytes = 0
  
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const records = request.result as SubtitleTempStorage[]
      const oldRecords = records.filter(record => record.lastModified < cutoffTime)
      
      const deletePromises = oldRecords.map(record => {
        sessions.add(record.sessionId)
        reclaimedBytes += record.metadata.dataSize || 0
        
        return new Promise<void>((deleteResolve, deleteReject) => {
          const deleteRequest = store.delete(record.id)
          deleteRequest.onsuccess = () => deleteResolve()
          deleteRequest.onerror = () => deleteReject(deleteRequest.error)
        })
      })
      
      Promise.all(deletePromises)
        .then(() => {
          const duration = performance.now() - startTime
          resolve({
            deletedSessions: sessions.size,
            deletedRecords: oldRecords.length,
            reclaimedBytes,
            duration
          })
        })
        .catch(reject)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Clean up orphaned sessions (sessions without workspace)
 */
export async function cleanupOrphanedSessions(): Promise<{
  deletedSessions: number
  deletedRecords: number
  reclaimedBytes: number
}> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const records = request.result as SubtitleTempStorage[]
      const sessions = new Set<string>()
      let reclaimedBytes = 0
      
      // Find orphaned records (empty or invalid workspaceId)
      const orphanedRecords = records.filter(record => 
        !record.workspaceId || 
        record.workspaceId.trim() === '' ||
        record.workspaceId === 'unknown'
      )
      
      const deletePromises = orphanedRecords.map(record => {
        sessions.add(record.sessionId)
        reclaimedBytes += record.metadata.dataSize || 0
        
        return new Promise<void>((deleteResolve, deleteReject) => {
          const deleteRequest = store.delete(record.id)
          deleteRequest.onsuccess = () => deleteResolve()
          deleteRequest.onerror = () => deleteReject(deleteRequest.error)
        })
      })
      
      Promise.all(deletePromises)
        .then(() => resolve({
          deletedSessions: sessions.size,
          deletedRecords: orphanedRecords.length,
          reclaimedBytes
        }))
        .catch(reject)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get storage statistics for monitoring
 */
export async function getStorageStats(): Promise<{
  totalRecords: number
  totalSessions: number
  totalWorkspaces: number
  totalBytes: number
  oldestRecord: number
  newestRecord: number
}> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readonly')
  const store = transaction.objectStore(STORE_NAME)
  
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const records = request.result as SubtitleTempStorage[]
      const sessions = new Set<string>()
      const workspaces = new Set<string>()
      let totalBytes = 0
      let oldestRecord = Date.now()
      let newestRecord = 0
      
      records.forEach(record => {
        sessions.add(record.sessionId)
        workspaces.add(record.workspaceId)
        totalBytes += record.metadata.dataSize || 0
        oldestRecord = Math.min(oldestRecord, record.createdAt)
        newestRecord = Math.max(newestRecord, record.lastModified)
      })
      
      resolve({
        totalRecords: records.length,
        totalSessions: sessions.size,
        totalWorkspaces: workspaces.size,
        totalBytes,
        oldestRecord: records.length > 0 ? oldestRecord : Date.now(),
        newestRecord: records.length > 0 ? newestRecord : Date.now()
      })
    }
    request.onerror = () => reject(request.error)
  })
}