/**
 * Test Utilities for WorkflowStateManager Testing
 * Provides mocks, helpers, and common test patterns for workflow state testing
 */

import { jest } from '@jest/globals'
import {
  StepState,
  StepId,
  createStepId,
  createTimestamp,
  createVersion,
  WorkflowStateManagerConfig,
  WorkflowStateSnapshot,
  StateChangeEvent,
  AnyWorkflowStepState,
  StepStateMetadata,
  BatchStateOperation,
  WorkflowStatePersistence,
  WORKFLOW_CONSTANTS
} from '../../types/workflow-state'
import { WorkflowStateManager } from '../../services/workflow-state-manager'

/**
 * Mock implementation of WorkflowStatePersistence for testing
 */
export class MockPersistence implements WorkflowStatePersistence {
  private storage: WorkflowStateSnapshot | null = null
  private shouldFail: boolean = false
  private failureType: 'save' | 'load' | 'all' | null = null

  async saveState(snapshot: WorkflowStateSnapshot): Promise<void> {
    if (this.shouldFail && (this.failureType === 'save' || this.failureType === 'all')) {
      throw new Error('Mock save failure')
    }
    this.storage = JSON.parse(JSON.stringify(snapshot)) // Deep clone
  }

  async loadState(): Promise<WorkflowStateSnapshot | null> {
    if (this.shouldFail && (this.failureType === 'load' || this.failureType === 'all')) {
      throw new Error('Mock load failure')
    }
    return this.storage ? JSON.parse(JSON.stringify(this.storage)) : null
  }

  async clearState(): Promise<void> {
    this.storage = null
  }

  async hasStoredState(): Promise<boolean> {
    return this.storage !== null
  }

  async getStorageInfo(): Promise<{ size: number; lastModified: number }> {
    if (!this.storage) {
      return { size: 0, lastModified: 0 }
    }
    return {
      size: JSON.stringify(this.storage).length,
      lastModified: this.storage.timestamp
    }
  }

  // Test helper methods
  simulateFailure(fail: boolean = true, type: 'save' | 'load' | 'all' = 'all') {
    this.shouldFail = fail
    this.failureType = type
  }

  getStoredData(): WorkflowStateSnapshot | null {
    return this.storage
  }

  setStoredData(data: WorkflowStateSnapshot | null) {
    this.storage = data
  }
}

/**
 * Factory for creating test step states
 */
export class StepStateFactory {
  static createStep(
    id: string,
    state: StepState,
    options: {
      title?: string
      description?: string
      message?: string
      reason?: string
      context?: Record<string, unknown>
    } = {}
  ): AnyWorkflowStepState {
    return {
      id: createStepId(id),
      title: options.title || `Step ${id}`,
      description: options.description || `Description for ${id}`,
      stateMetadata: this.createMetadata(state, options)
    }
  }

  static createMetadata<T extends StepState>(
    state: T,
    options: {
      message?: string
      reason?: string
      context?: Record<string, unknown>
      previousState?: StepState
    } = {}
  ): StepStateMetadata<T> {
    return {
      state,
      lastModified: createTimestamp(),
      message: options.message,
      reason: options.reason,
      context: options.context ? Object.freeze({ ...options.context }) : undefined,
      previousState: options.previousState
    } as StepStateMetadata<T>
  }

  static createReadyStep(id: string, options: any = {}): AnyWorkflowStepState {
    return this.createStep(id, StepState.Ready, options)
  }

  static createCompleteStep(id: string, options: any = {}): AnyWorkflowStepState {
    return this.createStep(id, StepState.Complete, options)
  }

  static createBlockedStep(id: string, options: any = {}): AnyWorkflowStepState {
    return this.createStep(id, StepState.Blocked, options)
  }

  static createErrorStep(id: string, message: string, options: any = {}): AnyWorkflowStepState {
    return this.createStep(id, StepState.Error, { message, ...options })
  }

  static createWarningStep(id: string, message: string, options: any = {}): AnyWorkflowStepState {
    return this.createStep(id, StepState.Warning, { message, ...options })
  }

  static createSkippedStep(id: string, reason: string, options: any = {}): AnyWorkflowStepState {
    return this.createStep(id, StepState.Skip, { reason, ...options })
  }
}

/**
 * Event collector for testing state change events
 */
export class StateChangeEventCollector {
  private events: StateChangeEvent[] = []
  private subscriptions: Array<() => void> = []

  subscribe(manager: WorkflowStateManager, stepId?: StepId): () => void {
    const unsubscribe = manager.subscribe((event) => {
      this.events.push(event)
    }, stepId)
    
    this.subscriptions.push(unsubscribe)
    return unsubscribe
  }

  getEvents(): StateChangeEvent[] {
    return [...this.events]
  }

  getEventsForStep(stepId: StepId): StateChangeEvent[] {
    return this.events.filter(event => event.stepId === stepId)
  }

  getEventsByTransition(from: StepState, to: StepState): StateChangeEvent[] {
    return this.events.filter(event => 
      event.oldState === from && event.newState === to
    )
  }

  getLastEvent(): StateChangeEvent | null {
    return this.events.length > 0 ? this.events[this.events.length - 1] : null
  }

  clear(): void {
    this.events = []
  }

  destroy(): void {
    this.subscriptions.forEach(unsubscribe => unsubscribe())
    this.subscriptions = []
    this.events = []
  }

  // Assertion helpers
  expectEventCount(count: number): void {
    expect(this.events).toHaveLength(count)
  }

  expectTransition(stepId: StepId, from: StepState, to: StepState): void {
    const event = this.events.find(e => 
      e.stepId === stepId && e.oldState === from && e.newState === to
    )
    expect(event).toBeDefined()
  }

  expectNoEvents(): void {
    expect(this.events).toHaveLength(0)
  }
}

/**
 * Workflow test scenarios builder
 */
export class WorkflowScenarioBuilder {
  private steps: Array<{
    stepId: string
    action: 'transition' | 'batch' | 'wait' | 'assert'
    params: any
  }> = []

  transition(stepId: string, newState: StepState, metadata?: any): this {
    this.steps.push({
      stepId,
      action: 'transition',
      params: { newState, metadata }
    })
    return this
  }

  batch(operations: BatchStateOperation[]): this {
    this.steps.push({
      stepId: '',
      action: 'batch',
      params: { operations }
    })
    return this
  }

  wait(ms: number): this {
    this.steps.push({
      stepId: '',
      action: 'wait',
      params: { ms }
    })
    return this
  }

  assert(stepId: string, expectedState: StepState): this {
    this.steps.push({
      stepId,
      action: 'assert',
      params: { expectedState }
    })
    return this
  }

  async execute(manager: WorkflowStateManager): Promise<void> {
    for (const step of this.steps) {
      switch (step.action) {
        case 'transition':
          await manager.transitionState(step.stepId, step.params.newState, step.params.metadata)
          break
        case 'batch':
          await manager.batchTransition(step.params.operations)
          break
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.params.ms))
          break
        case 'assert':
          expect(manager.getStepState(step.stepId)).toBe(step.params.expectedState)
          break
      }
    }
  }

  // Predefined scenarios
  static completeWorkflow(): WorkflowScenarioBuilder {
    return new WorkflowScenarioBuilder()
      .transition('input-file', StepState.Complete)
      .assert('config', StepState.Ready)
      .transition('config', StepState.Complete)
      .assert('processing', StepState.Ready)
      .transition('processing', StepState.Complete)
      .assert('review', StepState.Ready)
      .transition('review', StepState.Complete)
      .assert('export', StepState.Ready)
      .transition('export', StepState.Complete)
  }

  static errorRecovery(): WorkflowScenarioBuilder {
    return new WorkflowScenarioBuilder()
      .transition('input-file', StepState.Complete)
      .transition('config', StepState.Complete)
      .transition('processing', StepState.Error, { message: 'Processing failed' })
      .assert('review', StepState.Blocked)
      .transition('processing', StepState.Ready)
      .transition('processing', StepState.Complete)
      .assert('review', StepState.Ready)
  }

  static skipSteps(): WorkflowScenarioBuilder {
    return new WorkflowScenarioBuilder()
      .transition('input-file', StepState.Complete)
      .transition('config', StepState.Complete)
      .transition('processing', StepState.Skip, { reason: 'Using existing subtitles' })
      .assert('review', StepState.Blocked)
      .transition('review', StepState.Ready)
      .transition('review', StepState.Complete)
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  static async measureOperation<T>(
    operation: () => Promise<T>,
    name: string = 'operation'
  ): Promise<{ result: T; duration: number; memory?: number }> {
    const startTime = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize

    const result = await operation()

    const endTime = performance.now()
    const endMemory = (performance as any).memory?.usedJSHeapSize

    return {
      result,
      duration: endTime - startTime,
      memory: startMemory && endMemory ? endMemory - startMemory : undefined
    }
  }

  static async measureMultipleOperations<T>(
    operation: () => Promise<T>,
    iterations: number,
    name: string = 'operation'
  ): Promise<{
    results: T[]
    durations: number[]
    avgDuration: number
    maxDuration: number
    minDuration: number
    totalMemory?: number
  }> {
    const results: T[] = []
    const durations: number[] = []
    const startMemory = (performance as any).memory?.usedJSHeapSize

    for (let i = 0; i < iterations; i++) {
      const measurement = await this.measureOperation(operation, `${name}-${i}`)
      results.push(measurement.result)
      durations.push(measurement.duration)
    }

    const endMemory = (performance as any).memory?.usedJSHeapSize

    return {
      results,
      durations,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      totalMemory: startMemory && endMemory ? endMemory - startMemory : undefined
    }
  }

  static expectPerformanceTarget(
    duration: number,
    target: number,
    operation: string
  ): void {
    expect(duration).toBeLessThan(target)
    if (duration >= target * 0.8) {
      console.warn(`⚠️  Performance warning: ${operation} took ${duration.toFixed(3)}ms (target: ${target}ms)`)
    }
  }
}

/**
 * Mock manager factory for testing
 */
export class MockWorkflowStateManager {
  static create(config: Partial<WorkflowStateManagerConfig> = {}): WorkflowStateManager {
    const mockPersistence = new MockPersistence()
    
    return new WorkflowStateManager({
      strictValidation: true,
      enableLogging: false,
      maxHistoryEntries: 50,
      persistence: mockPersistence,
      ...config
    })
  }

  static createWithPersistence(persistence: WorkflowStatePersistence): WorkflowStateManager {
    return new WorkflowStateManager({
      strictValidation: true,
      enableLogging: false,
      maxHistoryEntries: 50,
      persistence
    })
  }

  static createWithStates(steps: Record<string, StepState>): WorkflowStateManager {
    const manager = this.create()

    // Apply initial states
    Object.entries(steps).forEach(async ([stepId, state]) => {
      await manager.transitionState(stepId, state)
    })

    return manager
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  static generateStateSnapshot(options: {
    currentStepId?: string
    stepStates?: Record<string, StepState>
    includeContext?: boolean
  } = {}): WorkflowStateSnapshot {
    const {
      currentStepId = 'input-file',
      stepStates = {
        'input-file': StepState.Ready,
        'config': StepState.Blocked,
        'processing': StepState.Blocked,
        'review': StepState.Blocked,
        'export': StepState.Blocked
      },
      includeContext = false
    } = options

    const steps: Record<string, AnyWorkflowStepState> = {}

    Object.entries(stepStates).forEach(([id, state]) => {
      steps[createStepId(id)] = StepStateFactory.createStep(id, state, {
        context: includeContext ? { testData: true, stepId: id } : undefined
      })
    })

    return {
      currentStepId: createStepId(currentStepId),
      steps: Object.freeze(steps),
      timestamp: createTimestamp(),
      version: createVersion('2.0.0')
    }
  }

  static generateBatchOperations(
    count: number,
    stepId: string = 'input-file'
  ): BatchStateOperation[] {
    return Array.from({ length: count }, (_, i) => ({
      stepId: createStepId(stepId),
      newState: i % 2 === 0 ? StepState.Complete : StepState.Ready,
      metadata: {
        reason: `Batch operation ${i}`,
        context: { batchIndex: i }
      }
    }))
  }

  static generateLargeMetadata(): Record<string, unknown> {
    return {
      fileInfo: {
        name: 'large-video.mp4',
        size: 5000000000, // 5GB
        duration: 7200, // 2 hours
        format: 'mp4',
        codec: 'h264'
      },
      processingOptions: {
        quality: 'high',
        language: 'cantonese',
        confidence: 85,
        segments: 1000,
        vocabulary: Array.from({ length: 1000 }, (_, i) => `word${i}`)
      },
      results: {
        segments: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          start: i * 7.2,
          end: (i + 1) * 7.2,
          text: `Segment ${i} text content`,
          confidence: Math.random() * 100
        })),
        statistics: {
          totalWords: 15000,
          avgConfidence: 87.5,
          processingTime: 3600000,
          errorCount: 5
        }
      }
    }
  }
}

/**
 * Assertion helpers for workflow testing
 */
export class WorkflowAssertions {
  static expectStepState(
    manager: WorkflowStateManager,
    stepId: string,
    expectedState: StepState,
    message?: string
  ): void {
    const actualState = manager.getStepState(stepId)
    expect(actualState).toBe(expectedState)
    
    if (message) {
      const step = manager.getStep(stepId)
      expect(step?.stateMetadata.message).toBe(message)
    }
  }

  static expectStepAccessibility(
    manager: WorkflowStateManager,
    accessibleSteps: string[],
    blockedSteps: string[]
  ): void {
    accessibleSteps.forEach(stepId => {
      expect(manager.isStepAccessible(stepId)).toBe(true)
    })

    blockedSteps.forEach(stepId => {
      expect(manager.isStepAccessible(stepId)).toBe(false)
    })
  }

  static expectWorkflowProgress(
    manager: WorkflowStateManager,
    expectedComplete: number,
    expectedTotal: number
  ): void {
    const steps = Array.from(manager.getAllSteps().values())
    const completedCount = steps.filter(step => 
      step.stateMetadata.state === StepState.Complete
    ).length

    expect(completedCount).toBe(expectedComplete)
    expect(steps.length).toBe(expectedTotal)
  }

  static expectHistoryLength(
    manager: WorkflowStateManager,
    expectedLength: number
  ): void {
    const history = manager.getStateHistory()
    expect(history).toHaveLength(expectedLength)
  }

  static expectTransitionSuccess(
    result: any,
    expectedState?: StepState
  ): void {
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    
    if (expectedState) {
      expect(result.result).toBe(expectedState)
    }
  }

  static expectTransitionFailure(
    result: any,
    expectedError?: string
  ): void {
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    
    if (expectedError) {
      expect(result.error).toContain(expectedError)
    }
  }
}

/**
 * Setup and teardown utilities
 */
export class TestSetup {
  static setupPerformanceAPI(): void {
    global.performance = {
      now: jest.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 10000000,
        jsHeapSizeLimit: 100000000
      }
    } as any

    global.requestAnimationFrame = jest.fn((cb) => {
      setTimeout(cb, 16)
      return 1
    })
  }

  static setupTimers(): void {
    jest.useFakeTimers()
  }

  static restoreTimers(): void {
    jest.useRealTimers()
  }

  static async cleanupManagers(...managers: WorkflowStateManager[]): Promise<void> {
    await Promise.all(managers.map(manager => {
      try {
        manager.destroy()
      } catch (error) {
        console.warn('Error destroying manager:', error)
      }
    }))
  }
}

/**
 * Common test patterns and scenarios
 */
export const TestPatterns = {
  // Complete workflow execution
  async completeWorkflow(manager: WorkflowStateManager): Promise<void> {
    await WorkflowScenarioBuilder.completeWorkflow().execute(manager)
  },

  // Error and recovery scenario
  async errorRecovery(manager: WorkflowStateManager): Promise<void> {
    await WorkflowScenarioBuilder.errorRecovery().execute(manager)
  },

  // Skip steps scenario
  async skipSteps(manager: WorkflowStateManager): Promise<void> {
    await WorkflowScenarioBuilder.skipSteps().execute(manager)
  },

  // Performance stress test
  async stressTest(
    manager: WorkflowStateManager,
    iterations: number = 100
  ): Promise<{ avgDuration: number; maxDuration: number }> {
    const durations: number[] = []

    for (let i = 0; i < iterations; i++) {
      const measurement = await PerformanceTestUtils.measureOperation(async () => {
        await manager.transitionState('input-file', i % 2 === 0 ? StepState.Complete : StepState.Ready)
      })
      durations.push(measurement.duration)
    }

    return {
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      maxDuration: Math.max(...durations)
    }
  }
}