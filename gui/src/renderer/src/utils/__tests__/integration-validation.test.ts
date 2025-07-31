import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { WorkspaceManager } from '../workspace-manager'
import { IndexedDBService } from '../indexeddb-service'
import { AppStore } from '../../stores/app-store'
import { WorkflowStore } from '../../stores/workflow-store'
import { SubtitleEditStore } from '../../stores/subtitle-edit-store'

interface IntegrationTestStep {
  name: string
  action: () => Promise<any>
  validation: (result: any) => Promise<boolean>
  expectedDuration?: number
}

interface WorkflowTestResult {
  step: string
  success: boolean
  duration: number
  result: any
  error?: string
}

class WorkflowTester {
  private results: WorkflowTestResult[] = []
  private workspaceManager: WorkspaceManager
  private appStore: AppStore
  private workflowStore: WorkflowStore
  private subtitleStore: SubtitleEditStore

  constructor() {
    this.workspaceManager = new WorkspaceManager()
    this.appStore = new AppStore()
    this.workflowStore = new WorkflowStore()
    this.subtitleStore = new SubtitleEditStore()
  }

  async runStep(step: IntegrationTestStep): Promise<WorkflowTestResult> {
    const startTime = performance.now()
    
    try {
      const result = await step.action()
      const duration = performance.now() - startTime
      
      const validationSuccess = await step.validation(result)
      
      const stepResult: WorkflowTestResult = {
        step: step.name,
        success: validationSuccess,
        duration,
        result
      }
      
      this.results.push(stepResult)
      return stepResult
      
    } catch (error) {
      const duration = performance.now() - startTime
      const stepResult: WorkflowTestResult = {
        step: step.name,
        success: false,
        duration,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      
      this.results.push(stepResult)
      return stepResult
    }
  }

  async startApp(): Promise<WorkflowTestResult> {
    return await this.runStep({
      name: 'App Startup',
      action: async () => {
        await this.workspaceManager.initialize()
        return { initialized: true }
      },
      validation: async (result) => result.initialized === true
    })
  }

  async completeMigration(): Promise<WorkflowTestResult> {
    return await this.runStep({
      name: 'Migration Completion',
      action: async () => {
        // Simulate existing config to migrate
        const existingConfig = {
          language: 'en',
          model: 'small',
          priority: 'balanced'
        }
        
        const migrated = await this.workspaceManager.migrateFromLegacyConfig(existingConfig)
        return migrated
      },
      validation: async (result) => result && result.workspaces && result.workspaces.length > 0
    })
  }

  async createWorkspace(name: string): Promise<WorkflowTestResult> {
    return await this.runStep({
      name: `Create Workspace: ${name}`,
      action: async () => {
        const workspace = await this.workspaceManager.createWorkspace({
          name,
          description: `Integration test workspace: ${name}`,
          appConfig: {
            language: 'en',
            model: 'medium',
            priority: 'balanced'
          }
        })
        return workspace
      },
      validation: async (result) => result && result.name === name
    })
  }

  async configureSettings(config: any): Promise<WorkflowTestResult> {
    return await this.runStep({
      name: 'Configure Settings',
      action: async () => {
        await this.appStore.updateConfig(config)
        await this.workspaceManager.saveCurrentState()
        return await this.appStore.getConfig()
      },
      validation: async (result) => {
        return Object.keys(config).every(key => result[key] === config[key])
      }
    })
  }

  async switchWorkspace(workspaceId: string): Promise<WorkflowTestResult> {
    return await this.runStep({
      name: `Switch to Workspace: ${workspaceId}`,
      action: async () => {
        await this.workspaceManager.setCurrentWorkspace(workspaceId)
        const workspace = await this.workspaceManager.getCurrentWorkspace()
        await this.appStore.loadFromWorkspace(workspace!)
        return workspace
      },
      validation: async (result) => result && result.id === workspaceId
    })
  }

  async restartApp(): Promise<WorkflowTestResult> {
    return await this.runStep({
      name: 'App Restart Simulation',
      action: async () => {
        // Clear in-memory state
        this.appStore.reset()
        this.workflowStore.reset()
        
        // Reinitialize as if app restarted
        await this.workspaceManager.initialize()
        await this.workspaceManager.loadWorkspaces()
        
        return { restarted: true }
      },
      validation: async (result) => result.restarted === true
    })
  }

  async validateStateRestoration(): Promise<WorkflowTestResult> {
    return await this.runStep({
      name: 'State Restoration Validation',
      action: async () => {
        const currentWorkspace = await this.workspaceManager.getCurrentWorkspace()
        const appConfig = await this.appStore.getConfig()
        const workflowStep = this.workflowStore.currentStep
        
        return {
          hasWorkspace: !!currentWorkspace,
          hasConfig: !!appConfig,
          hasWorkflowState: !!workflowStep,
          workspace: currentWorkspace,
          config: appConfig,
          step: workflowStep
        }
      },
      validation: async (result) => {
        return result.hasWorkspace && result.hasConfig && result.hasWorkflowState
      }
    })
  }

  allStepsSuccessful(): boolean {
    return this.results.every(result => result.success)
  }

  getResults(): WorkflowTestResult[] {
    return this.results
  }

  getFailures(): WorkflowTestResult[] {
    return this.results.filter(result => !result.success)
  }

  getAverageDuration(): number {
    const durations = this.results.map(r => r.duration)
    return durations.reduce((sum, d) => sum + d, 0) / durations.length
  }
}

class StoreIntegrationTester {
  private workspaceManager: WorkspaceManager
  private appStore: AppStore
  private workflowStore: WorkflowStore
  private subtitleStore: SubtitleEditStore
  private indexedDBService: IndexedDBService

  constructor() {
    this.workspaceManager = new WorkspaceManager()
    this.appStore = new AppStore()
    this.workflowStore = new WorkflowStore()
    this.subtitleStore = new SubtitleEditStore()
    this.indexedDBService = new IndexedDBService()
  }

  async createWorkspace(name: string) {
    return await this.workspaceManager.createWorkspace({
      name,
      description: `Store integration test workspace: ${name}`,
      appConfig: {
        language: 'en',
        model: 'medium',
        priority: 'balanced'
      }
    })
  }

  async modifyAppConfig(config: any) {
    await this.appStore.updateConfig(config)
    await this.workspaceManager.saveCurrentState()
  }

  async updateWorkflowStep(step: string, data: any) {
    this.workflowStore.updateStep(step as any)
    this.workflowStore.updateStepData(data)
    await this.workspaceManager.saveCurrentState()
  }

  async saveSubtitleSession(sessionData: any) {
    const currentWorkspace = await this.workspaceManager.getCurrentWorkspace()
    if (currentWorkspace) {
      await this.indexedDBService.set(`subtitle-session-${currentWorkspace.id}`, sessionData)
    }
  }

  async validateDataConsistency() {
    const currentWorkspace = await this.workspaceManager.getCurrentWorkspace()
    
    if (!currentWorkspace) {
      throw new Error('No current workspace for consistency validation')
    }

    // Get data from different layers
    const indexedDBConfig = await this.indexedDBService.get(`workspace-${currentWorkspace.id}`)
    const storeConfig = await this.appStore.getConfig()
    const workflowState = this.workflowStore.getState()

    return {
      indexedDB: indexedDBConfig,
      storeState: storeConfig,
      workflowState: workflowState,
      mainProcess: currentWorkspace
    }
  }
}

describe('End-to-End Integration Validation', () => {
  let workspaceManager: WorkspaceManager
  let indexedDBService: IndexedDBService

  beforeEach(async () => {
    workspaceManager = new WorkspaceManager()
    indexedDBService = new IndexedDBService()
    
    // Clear any existing data
    await indexedDBService.clear()
  })

  afterEach(async () => {
    await indexedDBService.clear()
  })

  describe('Complete User Workflow Integration', () => {
    it('should handle complete user workflow from startup to state restoration', async () => {
      const workflow = new WorkflowTester()
      
      // Execute complete workflow
      await workflow.startApp()
      await workflow.completeMigration()
      await workflow.createWorkspace('Integration Test Project')
      await workflow.configureSettings({ 
        language: 'zh', 
        model: 'large',
        priority: 'quality'
      })
      await workflow.switchWorkspace('default')
      await workflow.restartApp()
      await workflow.validateStateRestoration()
      
      const results = workflow.getResults()
      const failures = workflow.getFailures()
      
      console.log('Complete Workflow Results:')
      results.forEach(result => {
        console.log(`  ${result.step}: ${result.success ? '✅' : '❌'} (${result.duration.toFixed(2)}ms)`)
        if (!result.success && result.error) {
          console.log(`    Error: ${result.error}`)
        }
      })
      
      console.log(`Average step duration: ${workflow.getAverageDuration().toFixed(2)}ms`)
      console.log(`All steps successful: ${workflow.allStepsSuccessful()}`)
      
      expect(workflow.allStepsSuccessful()).toBe(true)
      expect(failures.length).toBe(0)
      expect(workflow.getAverageDuration()).toBeLessThan(1000) // Average under 1s per step
      
    }, 30000) // 30 second timeout for full workflow
  })

  describe('Store Layer Data Integrity', () => {
    it('should maintain data integrity across all store layers', async () => {
      const integrationTester = new StoreIntegrationTester()
      
      // Create workspace and modify data across different stores
      const workspace = await integrationTester.createWorkspace('Data Integrity Test')
      
      // Modify app configuration
      await integrationTester.modifyAppConfig({ 
        priority: 'quality',
        language: 'zh',
        model: 'large-v3',
        useGPU: true
      })
      
      // Update workflow state
      await integrationTester.updateWorkflowStep('processing', { 
        completed: true,
        progress: 85,
        status: 'Processing audio...'
      })
      
      // Save subtitle session data
      await integrationTester.saveSubtitleSession({ 
        subtitles: [
          { id: 'sub1', start: 0, end: 2000, text: 'Test subtitle 1' },
          { id: 'sub2', start: 2000, end: 4000, text: 'Test subtitle 2' }
        ],
        edits: [
          { id: 'edit1', subtitleId: 'sub1', originalText: 'Original', editedText: 'Edited' }
        ]
      })
      
      // Validate data consistency across all layers
      const consistency = await integrationTester.validateDataConsistency()
      
      console.log('Data Consistency Results:')
      console.log('IndexedDB data:', consistency.indexedDB)
      console.log('Store state:', consistency.storeState)
      console.log('Workflow state:', consistency.workflowState)
      console.log('Main process workspace:', consistency.mainProcess)
      
      // Validate that critical data is consistent
      expect(consistency.storeState.priority).toBe('quality')
      expect(consistency.storeState.language).toBe('zh')
      expect(consistency.storeState.model).toBe('large-v3')
      expect(consistency.storeState.useGPU).toBe(true)
      
      // Validate workspace data persisted correctly
      expect(consistency.mainProcess.name).toBe('Data Integrity Test')
      expect(consistency.mainProcess.appConfig.priority).toBe('quality')
      
    }, 15000) // 15 second timeout
  })

  describe('Multi-Workspace Context Switching', () => {
    it('should handle multiple workspace context switching with data isolation', async () => {
      const workflow = new WorkflowTester()
      
      await workflow.startApp()
      
      // Create multiple workspaces with different configurations
      const workspace1 = await workflow.createWorkspace('Project Alpha')
      const workspace2 = await workflow.createWorkspace('Project Beta')
      const workspace3 = await workflow.createWorkspace('Project Gamma')
      
      // Configure each workspace differently
      await workflow.configureSettings({ 
        language: 'en', 
        model: 'small',
        priority: 'speed'
      })
      
      await workflow.switchWorkspace(workspace2.result.id)
      await workflow.configureSettings({ 
        language: 'zh', 
        model: 'large',
        priority: 'quality'
      })
      
      await workflow.switchWorkspace(workspace3.result.id)
      await workflow.configureSettings({ 
        language: 'es', 
        model: 'medium',
        priority: 'balanced'
      })
      
      // Switch back to first workspace and validate isolation
      await workflow.switchWorkspace(workspace1.result.id)
      const finalConfig = await workflow.appStore.getConfig()
      
      console.log('Multi-Workspace Context Results:')
      console.log('Final config after switching back:', finalConfig)
      
      expect(finalConfig.language).toBe('en')
      expect(finalConfig.model).toBe('small')
      expect(finalConfig.priority).toBe('speed')
      
      expect(workflow.allStepsSuccessful()).toBe(true)
      
    }, 20000) // 20 second timeout
  })

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from various failure scenarios', async () => {
      const workflow = new WorkflowTester()
      
      await workflow.startApp()
      await workflow.createWorkspace('Recovery Test')
      
      // Test IndexedDB failure recovery
      const originalSet = indexedDBService.set
      let setCallCount = 0
      
      indexedDBService.set = jest.fn(async (key, value) => {
        setCallCount++
        if (setCallCount === 2) {
          // Simulate failure on second call
          throw new Error('IndexedDB quota exceeded')
        }
        return originalSet.call(indexedDBService, key, value)
      })
      
      // This should trigger fallback behavior
      try {
        await workflow.configureSettings({ 
          language: 'fr',
          model: 'large',
          priority: 'quality'
        })
      } catch (error) {
        // Expected to fail but should recover
        console.log('Expected IndexedDB failure occurred:', error)
      }
      
      // Restore normal behavior
      indexedDBService.set = originalSet
      
      // Verify system can continue operating
      const recoveryResult = await workflow.configureSettings({ 
        language: 'de',
        model: 'medium'
      })
      
      console.log('Error Recovery Results:')
      console.log('Recovery successful:', recoveryResult.success)
      
      expect(recoveryResult.success).toBe(true)
      
    }, 15000) // 15 second timeout
  })

  describe('Performance Under Load', () => {
    it('should maintain performance with concurrent operations', async () => {
      const workflow = new WorkflowTester()
      
      await workflow.startApp()
      
      // Create multiple workspaces concurrently
      const workspacePromises = Array.from({ length: 5 }, (_, i) => 
        workflow.createWorkspace(`Concurrent Workspace ${i + 1}`)
      )
      
      const startTime = performance.now()
      const workspaces = await Promise.all(workspacePromises)
      const concurrentCreationTime = performance.now() - startTime
      
      // Perform concurrent workspace switches
      const switchPromises = workspaces.map(async (workspace, i) => {
        const start = performance.now()
        await workflow.switchWorkspace(workspace.result.id)
        await workflow.configureSettings({ 
          language: ['en', 'zh', 'es', 'fr', 'de'][i],
          priority: ['speed', 'quality', 'balanced'][i % 3]
        })
        return performance.now() - start
      })
      
      const switchTimes = await Promise.all(switchPromises)
      const avgSwitchTime = switchTimes.reduce((sum, time) => sum + time, 0) / switchTimes.length
      
      console.log('Concurrent Operations Results:')
      console.log(`Concurrent workspace creation: ${concurrentCreationTime.toFixed(2)}ms`)
      console.log(`Average concurrent switch time: ${avgSwitchTime.toFixed(2)}ms`)
      console.log(`All workspaces created successfully: ${workspaces.every(w => w.success)}`)
      
      expect(concurrentCreationTime).toBeLessThan(5000) // 5s for 5 concurrent creations
      expect(avgSwitchTime).toBeLessThan(1000) // Average under 1s even with concurrency
      expect(workspaces.every(w => w.success)).toBe(true)
      
    }, 30000) // 30 second timeout
  })

  describe('Session Persistence Validation', () => {
    it('should persist and restore complex session state correctly', async () => {
      const workflow = new WorkflowTester()
      
      await workflow.startApp()
      const workspace = await workflow.createWorkspace('Session Persistence Test')
      
      // Create complex session state
      await workflow.configureSettings({
        language: 'ja',
        model: 'large-v3',
        priority: 'quality',
        useGPU: true,
        temperature: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        hotwords: 'technical, API, database, authentication',
        numSpeakers: '4'
      })
      
      // Add workflow state
      workflow.workflowStore.updateStep('processing')
      workflow.workflowStore.updateStepData({
        progress: 65,
        status: 'Processing audio segments...',
        processingTime: 12000,
        estimatedTimeRemaining: 8000
      })
      
      // Add subtitle editing state
      const subtitleData = {
        subtitles: Array.from({ length: 50 }, (_, i) => ({
          id: `sub-${i + 1}`,
          start: i * 2000,
          end: (i + 1) * 2000 - 100,
          text: `Subtitle line ${i + 1} for persistence testing`,
          speaker: `Speaker ${(i % 4) + 1}`,
          confidence: 0.8 + Math.random() * 0.2
        })),
        edits: Array.from({ length: 10 }, (_, i) => ({
          id: `edit-${i + 1}`,
          subtitleId: `sub-${i * 5 + 1}`,
          originalText: `Original text ${i + 1}`,
          editedText: `Edited text ${i + 1}`,
          timestamp: new Date(Date.now() - i * 60000)
        }))
      }
      
      const integrationTester = new StoreIntegrationTester()
      await integrationTester.saveSubtitleSession(subtitleData)
      
      // Save current state
      await workspaceManager.saveCurrentState()
      
      // Simulate app restart
      await workflow.restartApp()
      
      // Validate state restoration
      const restorationResult = await workflow.validateStateRestoration()
      
      // Verify complex state was restored correctly
      const restoredConfig = await workflow.appStore.getConfig()
      const subtitleSession = await indexedDBService.get(`subtitle-session-${workspace.result.id}`)
      
      console.log('Session Persistence Results:')
      console.log('State restoration successful:', restorationResult.success)
      console.log('Complex config restored:', restoredConfig)
      console.log('Subtitle session restored:', subtitleSession ? 'Yes' : 'No')
      
      expect(restorationResult.success).toBe(true)
      expect(restoredConfig.language).toBe('ja')
      expect(restoredConfig.model).toBe('large-v3')
      expect(restoredConfig.hotwords).toBe('technical, API, database, authentication')
      expect(subtitleSession).toBeTruthy()
      expect(subtitleSession.subtitles).toHaveLength(50)
      expect(subtitleSession.edits).toHaveLength(10)
      
    }, 25000) // 25 second timeout
  })
})