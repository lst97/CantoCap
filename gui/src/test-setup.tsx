/**
 * Jest Test Setup Configuration
 * Global test setup, mocks, and utilities for WorkflowStateManager testing
 */

import '@testing-library/jest-dom'
import { jest } from '@jest/globals'
import React from 'react'

// Mock Electron APIs
const mockElectronAPI = {
  saveFileDialog: jest.fn(),
  writeExportFile: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  showMessageBox: jest.fn(),
  openExternal: jest.fn(),
  getAppVersion: jest.fn().mockReturnValue('1.0.0'),
  getAppPath: jest.fn().mockReturnValue('/app'),
  on: jest.fn(),
  off: jest.fn(),
  send: jest.fn()
}

// Mock window APIs
Object.defineProperty(window, 'cantocapAPI', {
  value: mockElectronAPI,
  writable: true
})

// Mock performance API for testing
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000
    }
  },
  writable: true
})

// Mock requestAnimationFrame
Object.defineProperty(global, 'requestAnimationFrame', {
  value: jest.fn((cb: FrameRequestCallback) => {
    setTimeout(cb, 16)
    return 1
  }),
  writable: true
})

// Mock cancelAnimationFrame
Object.defineProperty(global, 'cancelAnimationFrame', {
  value: jest.fn(),
  writable: true
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
}

Object.defineProperty(global, 'ResizeObserver', {
  value: MockResizeObserver,
  writable: true
})

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
  
  // Helper for triggering intersection events in tests
  triggerIntersection(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this)
  }
}

Object.defineProperty(global, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true
})

// Mock console methods for cleaner test output
const originalConsole = { ...console }

beforeEach(() => {
  // Reset console mocks
  console.error = jest.fn()
  console.warn = jest.fn()
  console.log = jest.fn()
  console.info = jest.fn()
  console.debug = jest.fn()
})

afterEach(() => {
  // Restore console methods
  Object.assign(console, originalConsole)
})

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R
      toHaveBeenCalledWithError(message?: string): R
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    return {
      message: () => 
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass
    }
  },
  
  toHaveBeenCalledWithError(received: jest.MockedFunction<any>, message?: string) {
    const calls = received.mock.calls
    const hasErrorCall = calls.some(call => 
      call.some(arg => arg instanceof Error || (message && arg?.toString?.().includes(message)))
    )
    
    return {
      message: () => 
        hasErrorCall
          ? `expected function not to be called with error${message ? ` containing "${message}"` : ''}`
          : `expected function to be called with error${message ? ` containing "${message}"` : ''}`,
      pass: hasErrorCall
    }
  }
})

// Mock IndexedDB for persistence testing
import 'fake-indexeddb/auto'

// Setup fake timers helper
export const setupFakeTimers = () => {
  jest.useFakeTimers()
  
  return {
    runAllTimers: () => jest.runAllTimers(),
    advanceTimersByTime: (ms: number) => jest.advanceTimersByTime(ms),
    runOnlyPendingTimers: () => jest.runOnlyPendingTimers(),
    cleanup: () => {
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  }
}

// Performance testing helpers
export const createPerformanceTestHelpers = () => {
  const measurements: Array<{ name: string; duration: number; memory?: number }> = []
  
  return {
    measure: async <T extends unknown>(name: string, operation: () => Promise<T> | T): Promise<{ result: T; duration: number }> => {
      const startTime = performance.now()
      const startMemory = (performance as any).memory?.usedJSHeapSize
      
      const result = await operation()
      
      const endTime = performance.now()
      const endMemory = (performance as any).memory?.usedJSHeapSize
      const duration = endTime - startTime
      
      measurements.push({
        name,
        duration,
        memory: startMemory && endMemory ? endMemory - startMemory : undefined
      })
      
      return { result, duration }
    },
    
    getMeasurements: () => [...measurements],
    
    clearMeasurements: () => {
      measurements.length = 0
    },
    
    expectPerformanceTarget: (duration: number, target: number, operation: string) => {
      expect(duration).toBeLessThan(target)
      if (duration >= target * 0.8) {
        console.warn(`⚠️  Performance warning: ${operation} took ${duration.toFixed(3)}ms (target: ${target}ms)`)
      }
    }
  }
}

// Accessibility testing helpers
export const createAccessibilityTestHelpers = () => {
  return {
    expectNoAccessibilityViolations: async (container: Element) => {
      const { axe } = await import('jest-axe')
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    },
    
    expectFocusable: (element: Element) => {
      expect(element).toHaveAttribute('tabIndex')
      expect(parseInt(element.getAttribute('tabIndex') || '0')).toBeGreaterThanOrEqual(0)
    },
    
    expectNotFocusable: (element: Element) => {
      const tabIndex = element.getAttribute('tabIndex')
      expect(tabIndex === null || parseInt(tabIndex) < 0).toBe(true)
    },
    
    expectAriaLabel: (element: Element, expectedLabel?: string) => {
      const ariaLabel = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')
      expect(ariaLabel).toBeTruthy()
      if (expectedLabel) {
        expect(ariaLabel).toContain(expectedLabel)
      }
    },
    
    expectLiveRegion: (element: Element, politeness: 'polite' | 'assertive' = 'polite') => {
      expect(element).toHaveAttribute('aria-live', politeness)
    }
  }
}

// Mock data generators for testing
export const createMockData = {
  stateChangeEvent: (stepId: string, oldState: string, newState: string) => ({
    stepId,
    oldState,
    newState,
    metadata: {
      state: newState,
      lastModified: Date.now(),
      reason: 'Test transition'
    },
    timestamp: Date.now(),
    transitionKey: `${oldState}-to-${newState}`,
    isValid: true
  }),
  
  workflowStep: (id: string, state: string) => ({
    id,
    title: `Step ${id}`,
    description: `Description for ${id}`,
    stateMetadata: {
      state,
      lastModified: Date.now(),
      reason: 'Test state'
    }
  }),
  
  batchOperation: (stepId: string, newState: string, index: number) => ({
    stepId,
    newState,
    metadata: {
      reason: `Batch operation ${index}`,
      context: { batchIndex: index }
    }
  })
}

// Test cleanup helpers
export const cleanup = {
  timers: () => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  },
  
  mocks: () => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  },
  
  dom: () => {
    document.body.innerHTML = ''
  },
  
  all: () => {
    cleanup.timers()
    cleanup.mocks()
    cleanup.dom()
  }
}

// Error boundary for testing React components
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Test Error Boundary caught an error:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">
          <h2>Test Error Boundary</h2>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      )
    }
    
    return this.props.children
  }
}

// Global beforeEach setup
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks()
  
  // Reset DOM
  document.body.innerHTML = ''
  
  // Reset mock implementations
  mockElectronAPI.saveFileDialog.mockResolvedValue({ canceled: false, filePath: '/test/file.txt' })
  mockElectronAPI.writeExportFile.mockResolvedValue(undefined)
  mockElectronAPI.readFile.mockResolvedValue('test content')
  mockElectronAPI.writeFile.mockResolvedValue(undefined)
  mockElectronAPI.showMessageBox.mockResolvedValue({ response: 0 })
})

// Global afterEach cleanup
afterEach(() => {
  // Run any pending timers
  jest.runOnlyPendingTimers()
  
  // Clean up any remaining mocks
  cleanup.mocks()
})

export default {
  setupFakeTimers,
  createPerformanceTestHelpers,
  createAccessibilityTestHelpers,
  createMockData,
  cleanup,
  TestErrorBoundary
}