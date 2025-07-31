/**
 * Jest test setup for Phase 4 comprehensive testing
 * 
 * Sets up global mocks, utilities, and configuration for testing
 * workspace management system including IPC, IndexedDB, and performance monitoring.
 */

// Extend Jest matchers for accessibility and DOM testing
import '@testing-library/jest-dom'

// Mock IndexedDB for testing environment
const FDBFactory = require('fake-indexeddb/lib/FDBFactory')
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange')

global.indexedDB = new FDBFactory()
global.IDBKeyRange = FDBKeyRange

// Mock performance API for testing
if (!global.performance) {
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    memory: {
      usedJSHeapSize: 1024 * 1024 * 10, // 10MB
      totalJSHeapSize: 1024 * 1024 * 50, // 50MB
      jsHeapSizeLimit: 1024 * 1024 * 100 // 100MB
    }
  } as any
} else {
  // If performance exists, just mock the now function
  global.performance.now = jest.fn(() => Date.now())
}

// Mock Electron IPC with realistic subtitle persistence responses
global.window = Object.assign(global.window || {}, {
  electron: {
    ipcRenderer: {
      invoke: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    }
  }
})

// Setup default subtitle persistence IPC mocks
const mockSubtitleIPCResponses = {
  'subtitle-file-operation': (request: any) => {
    const { operation, fileId, data } = request
    
    switch (operation) {
      case 'read':
        return Promise.resolve({
          success: true,
          data: {
            metadata: { fileId: fileId || 'mock-file', workspaceId: 'mock-workspace', version: 1, schemaVersion: 1 },
            subtitles: [
              { id: 'sub-1', startTime: 0, endTime: 3000, text: 'Mock subtitle 1', confidence: 0.9 },
              { id: 'sub-2', startTime: 3000, endTime: 6000, text: 'Mock subtitle 2', confidence: 0.8 }
            ],
            statistics: { totalSubtitles: 2, totalDuration: 6000, wordCount: 6 },
            editHistory: [],
            validation: { isValid: true, warnings: [], errors: [], qualityScore: 0.9 }
          },
          performance: { bytesProcessed: 1000, processingTime: 150, cacheHit: false }
        })
        
      case 'create':
      case 'update':
        return Promise.resolve({
          success: true,
          data: `${operation}-${Date.now()}`,
          performance: { bytesProcessed: JSON.stringify(data).length, processingTime: 200, cacheHit: false }
        })
        
      case 'validate':
        return Promise.resolve({
          success: true,
          data: {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: { totalSubtitles: 2, validSubtitles: 2 },
            performance: { validationTime: 100 }
          }
        })
        
      case 'delete':
        return Promise.resolve({
          success: true,
          data: { deleted: true },
          performance: { bytesProcessed: 0, processingTime: 50 }
        })
        
      default:
        return Promise.resolve({
          success: true,
          data: null,
          performance: { bytesProcessed: 0, processingTime: 10 }
        })
    }
  },
  
  'subtitle-batch-operation': (request: any) => {
    const results = request.operations.map((op: any, index: number) => ({
      success: true,
      data: mockSubtitleIPCResponses['subtitle-file-operation'](op),
      performance: { bytesProcessed: 500, processingTime: 100 }
    }))
    
    return Promise.resolve({
      success: true,
      results,
      summary: { total: results.length, successful: results.length, failed: 0 }
    })
  },
  
  'save-subtitle-session': () => Promise.resolve({ success: true, data: { saved: true } }),
  
  'load-subtitle-session': (request: any) => Promise.resolve({
    sessionId: `session-${Date.now()}`,
    workspaceId: request.workspaceId || 'mock-workspace',
    sessionType: request.sessionType || 'review',
    createdAt: Date.now() - 3600000,
    lastUpdated: Date.now() - 60000,
    state: { selectedSubtitleIds: [], editMode: 'simple', viewMode: 'list' },
    autoSave: { enabled: true, interval: 30000, pendingChanges: false },
    preferences: { showConfidenceScores: true, showTimestamps: true },
    statistics: { editsCount: 0, timeSpent: 0, subtitlesReviewed: 0, issuesResolved: 0 }
  })
}

// Apply default mock behavior
global.window.electron.ipcRenderer.invoke.mockImplementation((channel: string, ...args: any[]) => {
  if (mockSubtitleIPCResponses[channel as keyof typeof mockSubtitleIPCResponses]) {
    return mockSubtitleIPCResponses[channel as keyof typeof mockSubtitleIPCResponses](...args)
  }
  return Promise.resolve({ success: true, data: null })
})

// Mock console methods to reduce test noise while keeping errors visible
const originalConsole = { ...console }

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error // Keep errors visible
}

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}

global.localStorage = localStorageMock
global.sessionStorage = localStorageMock

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Mock fetch for network operations
global.fetch = jest.fn()

// Mock crypto.randomUUID for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => {
      // Generate a valid UUID v4 format
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }),
    ...global.crypto
  }
})

// Mock structuredClone for IndexedDB operations
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj))
  }
}

// Mock setTimeout and setInterval for consistent timing in tests
jest.useFakeTimers()

// Setup global test timeout
jest.setTimeout(30000) // 30 second timeout for complex tests

// Global test utilities
global.testUtils = {
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  flushPromises: () => new Promise(resolve => setImmediate(resolve)),
  
  advanceTimers: (ms: number) => {
    jest.advanceTimersByTime(ms)
    return global.testUtils.flushPromises()
  },
  
  mockIndexedDB: () => {
    const mockDB = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          put: jest.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          delete: jest.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          clear: jest.fn().mockReturnValue({ onsuccess: null, onerror: null })
        })
      }),
      close: jest.fn()
    }
    
    global.indexedDB.open = jest.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: mockDB
    })
    
    return mockDB
  }
}

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  
  // Reset performance mocks
  if (global.performance?.now && typeof global.performance.now === 'function' && 'mockClear' in global.performance.now) {
    (global.performance.now as jest.Mock).mockClear()
  }
  
  // Reset console mocks
  Object.keys(console).forEach(key => {
    if (key !== 'error' && typeof console[key].mockClear === 'function') {
      console[key].mockClear()
    }
  })
  
  // Clear localStorage mock
  localStorageMock.clear()
  Object.values(localStorageMock).forEach(fn => {
    if (typeof fn.mockClear === 'function') {
      fn.mockClear()
    }
  })
})

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

export {}