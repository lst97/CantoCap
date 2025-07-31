/**
 * Test Utilities for Workspace and Step Configuration Testing
 * 
 * Comprehensive utilities for setting up test environments, mocking data,
 * and validating workspace and step configuration functionality.
 */

import { jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react'
import type { 
  WorkspaceConfig, 
  StepConfiguration,
  WorkspaceSession,
  AutoSaveStatus,
  WorkspaceMetadata,
  StepDependency,
  PerformanceMetric
} from '../../types/workspace'
import type { WorkflowStep } from '../../types/workflow'

/**
 * Mock Data Generators
 */
export class MockDataGenerator {
  private static idCounter = 0

  static generateWorkspaceId(): string {
    return `ws_test_${++this.idCounter}_${Date.now()}`
  }

  static generateWorkspace(overrides?: Partial<WorkspaceMetadata>): WorkspaceMetadata {
    const id = this.generateWorkspaceId()
    return {
      id,
      name: `Test Workspace ${this.idCounter}`,
      isActive: false,
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 1000,
      lastAccessedAt: Date.now() - 100,
      ...overrides
    }
  }

  static generateWorkspaceConfig(workspaceId?: string, overrides?: Partial<WorkspaceConfig>): WorkspaceConfig {
    return {
      workspaceId: workspaceId || this.generateWorkspaceId(),
      language: 'zh',
      inputFile: null,
      outputFile: null,
      translationOptions: {
        sourceLanguage: 'auto',
        targetLanguage: 'zh',
        enableTranslation: true
      },
      processingOptions: {
        audioQuality: 'high',
        processingSpeed: 'balanced'
      },
      ...overrides
    }
  }

  static generateStepConfiguration(
    stepId: WorkflowStep,
    workspaceId?: string,
    overrides?: Partial<StepConfiguration>
  ): StepConfiguration {
    const baseConfig: StepConfiguration = {
      stepId,
      workspaceId: workspaceId || this.generateWorkspaceId(),
      isCompleted: false,
      data: this.generateStepData(stepId),
      validationState: { isValid: true, errors: [] },
      lastModified: Date.now()
    }

    return { ...baseConfig, ...overrides }
  }

  static generateStepData(stepId: WorkflowStep): any {
    switch (stepId) {
      case 'input':
        return {
          inputFile: { path: '/test/input.mp4', name: 'input.mp4' },
          language: 'zh',
          formatOptions: {
            videoCodec: 'h264',
            audioCodec: 'aac'
          }
        }

      case 'processing':
        return {
          inputFile: { path: '/test/input.mp4', name: 'input.mp4' },
          language: 'zh',
          processingProgress: 0,
          status: 'pending',
          estimatedTimeRemaining: 300
        }

      case 'review':
        return {
          transcriptionResult: {
            segments: this.generateSubtitleSegments(5),
            language: 'zh',
            confidence: 0.92
          },
          outputFile: { path: '/test/output.srt', name: 'output.srt' },
          editableSegments: this.generateEditableSegments(5)
        }

      case 'export':
        return {
          outputFile: { path: '/test/final.srt', name: 'final.srt' },
          exportFormat: 'srt',
          exportOptions: {
            includeTimestamps: true,
            encoding: 'utf-8'
          }
        }

      default:
        return {}
    }
  }

  static generateSubtitleSegments(count: number = 10) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      start: i * 3,
      end: (i * 3) + 2.5,
      text: `测试字幕段落 ${i + 1}`,
      confidence: 0.85 + (Math.random() * 0.15)
    }))
  }

  static generateEditableSegments(count: number = 10) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      startTime: i * 3,
      endTime: (i * 3) + 2.5,
      text: `测试字幕段落 ${i + 1}`,
      originalText: `测试字幕段落 ${i + 1}`,
      isEdited: false,
      confidence: 0.85 + (Math.random() * 0.15)
    }))
  }

  static generateWorkspaceSession(workspaceId?: string): WorkspaceSession {
    return {
      workspaceId: workspaceId || this.generateWorkspaceId(),
      currentStep: 'input',
      stepData: {
        inputFile: { path: '/test/session.mp4', name: 'session.mp4' },
        processingProgress: 0
      },
      lastSaved: Date.now() - 5000
    }
  }

  static generatePerformanceMetrics(count: number = 5): PerformanceMetric[] {
    const operations = ['create', 'update', 'delete', 'switch', 'save'] as const
    
    return Array.from({ length: count }, (_, i) => ({
      operationType: operations[i % operations.length],
      duration: 50 + Math.random() * 200,
      success: Math.random() > 0.1, // 90% success rate
      workspaceId: this.generateWorkspaceId(),
      timestamp: Date.now() - (i * 1000),
      metadata: {
        stepId: i % 2 === 0 ? 'input' : 'processing',
        dataSize: Math.floor(Math.random() * 1000)
      }
    }))
  }

  static reset(): void {
    this.idCounter = 0
  }
}

/**
 * Mock API Builder
 */
export class MockAPIBuilder {
  private mockAPI: any = {}

  constructor() {
    this.setupDefaults()
  }

  private setupDefaults(): void {
    this.mockAPI = {
      // Workspace Management
      initializeWorkspaceSystem: jest.fn().mockResolvedValue({ success: true }),
      listWorkspaces: jest.fn().mockResolvedValue([]),
      createWorkspace: jest.fn().mockImplementation((name: string) => 
        Promise.resolve({
          success: true,
          workspaceId: MockDataGenerator.generateWorkspaceId()
        })
      ),
      deleteWorkspace: jest.fn().mockResolvedValue({ success: true }),
      syncWorkspace: jest.fn().mockResolvedValue({ success: true }),

      // Configuration Management
      getWorkspaceConfig: jest.fn().mockImplementation((workspaceId: string) =>
        Promise.resolve(MockDataGenerator.generateWorkspaceConfig(workspaceId))
      ),
      syncWorkspaceConfig: jest.fn().mockResolvedValue({ success: true }),

      // Step Configuration
      getStepConfiguration: jest.fn().mockImplementation((stepId: WorkflowStep, workspaceId: string) =>
        Promise.resolve(MockDataGenerator.generateStepConfiguration(stepId, workspaceId))
      ),
      saveStepConfiguration: jest.fn().mockResolvedValue({ success: true }),
      validateStepConfiguration: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),

      // Dependencies and Validation
      getStepDependencies: jest.fn().mockResolvedValue([]),
      validateStepDependencies: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),

      // Migration and Backup
      startWorkspaceMigration: jest.fn().mockResolvedValue({ success: true, backupPath: '/backup/test.json' }),
      completeWorkspaceMigration: jest.fn().mockResolvedValue({ success: true }),
      rollbackWorkspaceMigration: jest.fn().mockResolvedValue({ success: true }),
      getWorkspaceMigrationStatus: jest.fn().mockResolvedValue(null),
      createWorkspaceBackup: jest.fn().mockResolvedValue({ success: true, backupPath: '/backup/test.json' }),
      restoreWorkspaceBackup: jest.fn().mockResolvedValue({ success: true }),

      // Performance and Monitoring
      getWorkspacePerformanceMetrics: jest.fn().mockResolvedValue(MockDataGenerator.generatePerformanceMetrics()),
      recordWorkspaceOperation: jest.fn().mockResolvedValue({ success: true }),
      clearWorkspacePerformanceMetrics: jest.fn().mockResolvedValue({ success: true }),

      // Auto-save
      getAutoSaveStatus: jest.fn().mockResolvedValue({
        isEnabled: true,
        pendingSaves: 0,
        failedSaves: 0,
        lastSaveTime: Date.now(),
        lastError: null
      }),
      setAutoSaveOptions: jest.fn().mockResolvedValue({ success: true }),

      // Network and System
      isOnline: jest.fn().mockReturnValue(true),
      isSystemReady: jest.fn().mockResolvedValue(true),

      // Event Listeners
      onWorkspaceUpdate: jest.fn(() => () => {}),
      onConfigurationChange: jest.fn(() => () => {}),
      onAutoSaveUpdate: jest.fn(() => () => {}),
      onWorkspaceMigrationUpdate: jest.fn(() => () => {}),
      onWorkspaceMigrationProgress: jest.fn(() => () => {}),
      onWorkspaceMigrationRollback: jest.fn(() => () => {})
    }
  }

  // Fluent API for configuration
  workspaceOperations(config: {
    listDelay?: number
    createSuccess?: boolean
    deleteSuccess?: boolean
  }): this {
    if (config.listDelay) {
      this.mockAPI.listWorkspaces.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([]), config.listDelay))
      )
    }
    if (config.createSuccess !== undefined) {
      this.mockAPI.createWorkspace.mockResolvedValue({ 
        success: config.createSuccess,
        workspaceId: config.createSuccess ? MockDataGenerator.generateWorkspaceId() : undefined
      })
    }
    if (config.deleteSuccess !== undefined) {
      this.mockAPI.deleteWorkspace.mockResolvedValue({ success: config.deleteSuccess })
    }
    return this
  }

  configurationOperations(config: {
    syncDelay?: number
    syncSuccess?: boolean
    validationErrors?: string[]
  }): this {
    if (config.syncDelay) {
      this.mockAPI.syncWorkspaceConfig.mockImplementation(() =>
        new Promise(resolve => 
          setTimeout(() => resolve({ success: config.syncSuccess ?? true }), config.syncDelay)
        )
      )
    }
    if (config.validationErrors) {
      this.mockAPI.validateStepConfiguration.mockResolvedValue({
        isValid: config.validationErrors.length === 0,
        errors: config.validationErrors
      })
    }
    return this
  }

  networkConditions(config: {
    isOnline?: boolean
    networkDelay?: number
    intermittentFailures?: boolean
  }): this {
    this.mockAPI.isOnline.mockReturnValue(config.isOnline ?? true)
    
    if (config.intermittentFailures) {
      let callCount = 0
      this.mockAPI.syncWorkspaceConfig.mockImplementation(() => {
        callCount++
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Intermittent network failure'))
        }
        return new Promise(resolve => 
          setTimeout(() => resolve({ success: true }), config.networkDelay || 100)
        )
      })
    }
    return this
  }

  migrationScenario(config: {
    hasLegacyData?: boolean
    migrationInProgress?: boolean
    migrationSuccess?: boolean
  }): this {
    if (config.migrationInProgress) {
      this.mockAPI.getWorkspaceMigrationStatus.mockResolvedValue({
        isInProgress: true,
        currentPhase: 'migrate',
        totalPhases: 3,
        completedPhases: 1,
        canRollback: true
      })
    }
    
    if (config.migrationSuccess !== undefined) {
      this.mockAPI.completeWorkspaceMigration.mockResolvedValue({ success: config.migrationSuccess })
    }
    return this
  }

  performanceProfile(config: {
    slowOperations?: boolean
    memoryPressure?: boolean
    highLatency?: boolean
  }): this {
    if (config.slowOperations) {
      Object.keys(this.mockAPI).forEach(key => {
        if (typeof this.mockAPI[key] === 'function' && key.includes('sync')) {
          const originalImpl = this.mockAPI[key]
          this.mockAPI[key] = jest.fn().mockImplementation((...args) =>
            new Promise(resolve => setTimeout(() => resolve(originalImpl(...args)), 1000))
          )
        }
      })
    }
    return this
  }

  build(): any {
    return this.mockAPI
  }
}

/**
 * Test Environment Setup
 */
export class TestEnvironment {
  public mockAPI: any
  private originalConsole: any
  private performanceMarks: Map<string, number> = new Map()

  constructor(apiConfig?: (builder: MockAPIBuilder) => MockAPIBuilder) {
    const builder = new MockAPIBuilder()
    this.mockAPI = apiConfig ? apiConfig(builder).build() : builder.build()
  }

  async setup(): Promise<void> {
    // Setup global mocks
    global.window = {
      cantocapAPI: this.mockAPI,
      performance: {
        now: jest.fn(() => Date.now()),
        mark: jest.fn((name: string) => {
          this.performanceMarks.set(name, Date.now())
        }),
        measure: jest.fn((name: string, startMark?: string, endMark?: string) => {
          const startTime = startMark ? this.performanceMarks.get(startMark) || 0 : 0
          const endTime = endMark ? this.performanceMarks.get(endMark) || Date.now() : Date.now()
          return endTime - startTime
        }),
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB
          totalJSHeapSize: 100 * 1024 * 1024, // 100MB
          jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
        }
      },
      navigator: { onLine: true },
      indexedDB: {
        open: jest.fn(),
        deleteDatabase: jest.fn()
      }
    } as any

    // Mock crypto API
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

    // Setup IndexedDB mock
    global.indexedDB = {
      open: jest.fn().mockReturnValue({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
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
      }),
      deleteDatabase: jest.fn()
    } as any

    // Mock workspace database
    const mockWorkspaceDatabase = {
      healthCheck: jest.fn().mockResolvedValue(true),
      getAllWorkspaces: jest.fn().mockResolvedValue([]),
      updateWorkspace: jest.fn().mockResolvedValue(undefined),
      getPerformanceMetrics: jest.fn().mockResolvedValue([]),
      getEnhancedPerformanceMetrics: jest.fn().mockResolvedValue([]),
      saveWorkspace: jest.fn().mockResolvedValue(undefined),
      deleteWorkspace: jest.fn().mockResolvedValue(undefined),
      batchUpdateStepConfigurations: jest.fn().mockResolvedValue(undefined)
    }

    // Mock the database import
    jest.doMock('../../services/workspace-database', () => ({
      workspaceDatabase: mockWorkspaceDatabase,
      getWorkspaceDatabase: () => mockWorkspaceDatabase
    }))

    // Note: step-config-cache service doesn't exist yet, skipping mock

    // Mock migration service (if it exists)
    try {
      const mockMigrationService = {
        getMigrationStatus: jest.fn().mockReturnValue(null),
        startMigration: jest.fn().mockResolvedValue({ success: true }),
        completeMigration: jest.fn().mockResolvedValue({ success: true })
      }

      jest.doMock('../../services/migration-service', () => ({
        migrationService: mockMigrationService
      }))
    } catch (error) {
      // Service exists but may have different structure, provide basic mock
    }

    // Mock timers
    jest.useFakeTimers()

    // Suppress console output during tests
    this.originalConsole = { ...console }
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: this.originalConsole.error // Keep errors visible
    }
  }

  async cleanup(): Promise<void> {
    jest.useRealTimers()
    jest.clearAllMocks()
    
    // Restore console
    if (this.originalConsole) {
      global.console = this.originalConsole
    }

    // Cleanup globals
    delete (global as any).window
    delete (global as any).indexedDB

    // Reset data generators
    MockDataGenerator.reset()
    this.performanceMarks.clear()
  }

  // Utility methods for common test scenarios
  async fastForwardTime(ms: number): Promise<void> {
    await act(async () => {
      jest.advanceTimersByTime(ms)
      await jest.runAllTimersAsync()
    })
  }

  simulateNetworkFailure(): void {
    this.mockAPI.syncWorkspaceConfig.mockRejectedValue(new Error('Network unavailable'))
    this.mockAPI.syncWorkspace.mockRejectedValue(new Error('Network unavailable'))
  }

  simulateNetworkRecovery(): void {
    this.mockAPI.syncWorkspaceConfig.mockResolvedValue({ success: true })
    this.mockAPI.syncWorkspace.mockResolvedValue({ success: true })
  }

  getPerformanceMark(name: string): number | undefined {
    return this.performanceMarks.get(name)
  }

  measurePerformance(name: string, fn: () => Promise<void>): Promise<number> {
    return new Promise(async (resolve) => {
      const startTime = Date.now()
      await fn()
      const duration = Date.now() - startTime
      this.performanceMarks.set(name, duration)
      resolve(duration)
    })
  }
}

/**
 * Test Assertion Helpers
 */
export class TestAssertions {
  static expectWorkspaceConfig(
    actual: WorkspaceConfig | null | undefined,
    expected: Partial<WorkspaceConfig>
  ): void {
    expect(actual).toBeDefined()
    expect(actual).not.toBeNull()
    
    if (actual) {
      Object.keys(expected).forEach(key => {
        expect(actual[key as keyof WorkspaceConfig]).toEqual(expected[key as keyof WorkspaceConfig])
      })
    }
  }

  static expectStepConfiguration(
    actual: StepConfiguration | null | undefined,
    expected: Partial<StepConfiguration>
  ): void {
    expect(actual).toBeDefined()
    expect(actual).not.toBeNull()
    
    if (actual) {
      Object.keys(expected).forEach(key => {
        if (key === 'data') {
          // Deep comparison for data object
          expect(actual.data).toMatchObject(expected.data || {})
        } else {
          expect(actual[key as keyof StepConfiguration]).toEqual(expected[key as keyof StepConfiguration])
        }
      })
    }
  }

  static expectAutoSaveStatus(
    actual: AutoSaveStatus,
    expected: Partial<AutoSaveStatus>
  ): void {
    Object.keys(expected).forEach(key => {
      expect(actual[key as keyof AutoSaveStatus]).toEqual(expected[key as keyof AutoSaveStatus])
    })
  }

  static expectPerformanceWithinTarget(
    actualTime: number,
    targetTime: number,
    tolerance: number = 0.1
  ): void {
    const allowedTime = targetTime * (1 + tolerance)
    expect(actualTime).toBeLessThan(allowedTime)
  }

  static expectMemoryUsageWithinLimits(
    actualUsage: number,
    maxUsage: number
  ): void {
    expect(actualUsage).toBeLessThanOrEqual(maxUsage)
  }
}

/**
 * Workspace Test Scenarios
 */
export class WorkspaceTestScenarios {
  static async createBasicWorkspaceScenario(env: TestEnvironment) {
    const workspace = MockDataGenerator.generateWorkspace({ isActive: true })
    const config = MockDataGenerator.generateWorkspaceConfig(workspace.id)
    
    env.mockAPI.createWorkspace.mockResolvedValue({
      success: true,
      workspaceId: workspace.id
    })
    env.mockAPI.getWorkspaceConfig.mockResolvedValue(config)
    
    return { workspace, config }
  }

  static async createComplexWorkflowScenario(env: TestEnvironment) {
    const workspace = MockDataGenerator.generateWorkspace({ isActive: true })
    const config = MockDataGenerator.generateWorkspaceConfig(workspace.id, {
      inputFile: { path: '/test/complex.mp4', name: 'complex.mp4' },
      language: 'zh',
      translationOptions: {
        sourceLanguage: 'auto',
        targetLanguage: 'en',
        enableTranslation: true
      }
    })

    const steps: { [key in WorkflowStep]: StepConfiguration } = {
      input: MockDataGenerator.generateStepConfiguration('input', workspace.id, { isCompleted: true }),
      processing: MockDataGenerator.generateStepConfiguration('processing', workspace.id, { isCompleted: true }),
      review: MockDataGenerator.generateStepConfiguration('review', workspace.id, { isCompleted: false }),
      export: MockDataGenerator.generateStepConfiguration('export', workspace.id, { isCompleted: false })
    }

    env.mockAPI.createWorkspace.mockResolvedValue({ success: true, workspaceId: workspace.id })
    env.mockAPI.getWorkspaceConfig.mockResolvedValue(config)
    
    Object.entries(steps).forEach(([stepId, stepConfig]) => {
      env.mockAPI.getStepConfiguration
        .mockResolvedValueOnce(stepConfig)
    })

    return { workspace, config, steps }
  }

  static async createMigrationScenario(env: TestEnvironment) {
    const legacyData = {
      'cantocap-config': JSON.stringify({
        language: 'zh',
        apiKey: 'legacy-key-123',
        inputFile: { path: '/legacy/file.mp4', name: 'legacy.mp4' }
      }),
      'cantocap-recent-files': JSON.stringify([
        '/legacy/file1.mp4',
        '/legacy/file2.mp4'
      ])
    }

    env.mockAPI.startWorkspaceMigration.mockResolvedValue({
      success: true,
      backupPath: '/backup/migration.json'
    })
    env.mockAPI.completeWorkspaceMigration.mockResolvedValue({ success: true })

    return { legacyData }
  }
}

/**
 * Export all utilities
 */
export {
  MockDataGenerator,
  MockAPIBuilder,
  TestEnvironment,
  TestAssertions,
  WorkspaceTestScenarios
}