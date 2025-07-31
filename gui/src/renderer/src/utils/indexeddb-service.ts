/**
 * IndexedDB Service
 * 
 * Provides a Promise-based interface for IndexedDB operations
 * with error handling and fallback mechanisms.
 */

export class IndexedDBService {
  private dbName = 'cantocap-workspace-db'
  private version = 1
  private db: IDBDatabase | null = null

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create object stores
        if (!db.objectStoreNames.contains('workspaces')) {
          db.createObjectStore('workspaces', { keyPath: 'id' })
        }
        
        if (!db.objectStoreNames.contains('app-config')) {
          db.createObjectStore('app-config')
        }
        
        if (!db.objectStoreNames.contains('subtitle-sessions')) {
          db.createObjectStore('subtitle-sessions')
        }
        
        if (!db.objectStoreNames.contains('workflow-state')) {
          db.createObjectStore('workflow-state')
        }
      }
    })
  }

  /**
   * Set a value in IndexedDB
   */
  async set(key: string, value: any): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const storeName = this.getStoreName(key)
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      const request = store.put(value, key)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to set ${key}`))
    })
  }

  /**
   * Get a value from IndexedDB
   */
  async get(key: string): Promise<any> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const storeName = this.getStoreName(key)
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      
      const request = store.get(key)
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error(`Failed to get ${key}`))
    })
  }

  /**
   * Delete a value from IndexedDB
   */
  async delete(key: string): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const storeName = this.getStoreName(key)
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      const request = store.delete(key)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to delete ${key}`))
    })
  }

  /**
   * Clear all data from IndexedDB
   */
  async clear(): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    const storeNames = ['workspaces', 'app-config', 'subtitle-sessions', 'workflow-state']
    
    for (const storeName of storeNames) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        
        const request = store.clear()
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`))
      })
    }
  }

  /**
   * Get all keys from a store
   */
  async getAllKeys(storeName: string): Promise<string[]> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      
      const request = store.getAllKeys()
      
      request.onsuccess = () => resolve(request.result as string[])
      request.onerror = () => reject(new Error(`Failed to get keys from ${storeName}`))
    })
  }

  /**
   * Get all values from a store
   */
  async getAll(storeName: string): Promise<any[]> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`))
    })
  }

  /**
   * Determine the appropriate store name for a key
   */
  private getStoreName(key: string): string {
    if (key.startsWith('workspace-')) {
      return 'workspaces'
    } else if (key.startsWith('app-config')) {
      return 'app-config'
    } else if (key.startsWith('subtitle-session')) {
      return 'subtitle-sessions'
    } else if (key.startsWith('workflow-')) {
      return 'workflow-state'
    }
    
    // Default to app-config store
    return 'app-config'
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}