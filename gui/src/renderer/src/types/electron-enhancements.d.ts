/**
 * Enhanced Electron Type Declarations
 * Provides additional type safety for Electron renderer process
 */

declare namespace NodeJS {
  interface Process {
    contextIsolated?: boolean
    nodeIntegration?: boolean
  }
}

interface Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number  
    jsHeapSizeLimit: number
  }
}

// Enhanced state change event types for IPC optimization
export interface OptimizedStateChangeEvent {
  stepId: string
  state: string
  timestamp: number
  reason?: string
  workspaceContext?: {
    currentStep: string
    stepCount: number
  }
}

export interface BatchedStateChange {
  batchedChanges: OptimizedStateChangeEvent[]
  batchSize: number
  timestamp: number
}