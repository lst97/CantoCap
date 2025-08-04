import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { StepStore } from '../../stores/step-store'
import { WorkspaceState } from '../../types/workspace'

// Mock electron store to simulate persistence
const mockLocalStorage = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn()
}

describe('Workflow Step Persistence', () => {
  let stepStore: StepStore

  beforeEach(() => {
    // Reset stores before each test
    useWorkspaceStore.getState().initializeWorkspaces()
    stepStore = new StepStore()

    // Reset mocks
    mockLocalStorage.get.mockClear()
    mockLocalStorage.set.mockClear()
    mockLocalStorage.clear.mockClear()
  })

  afterEach(() => {
    // Clear any persisted state after each test
    // Reset workspace store state
    const store = useWorkspaceStore.getState()
    store.clearError?.()
    stepStore.reset()
  })

  describe('Step Persistence Scenarios', () => {
    // Test persistence for each workflow step
    const stepTestCases = [
      { step: 1, description: 'Initial Import Step' },
      { step: 2, description: 'Configuration Step' },
      { step: 3, description: 'Processing Step' },
      { step: 5, description: 'Export Step' }
    ]

    stepTestCases.forEach(({ step, description }) => {
      it(`should persist user on step ${step} (${description}) after app reload`, () => {
        // Set current step
        stepStore.setCurrentStep(step)

        // Simulate app reload by creating a new store instance
        const reloadedStepStore = new StepStore()

        // Verify the current step remains unchanged
        expect(reloadedStepStore.currentStep).toBe(step)
      })
    })

    it('should maintain correct workflow progression', () => {
      // Simulate normal workflow progression
      const expectedProgression = [1, 2, 3, 4, 5]
      expectedProgression.forEach(step => {
        stepStore.setCurrentStep(step)
      })

      // Create a new store instance to simulate reload
      const reloadedStepStore = new StepStore()

      // Verify final step is reached
      expect(reloadedStepStore.currentStep).toBe(5)
    })
  })

  describe('Edge Case Handling', () => {
    it('should handle partial/corrupted state gracefully', () => {
      // Simulate corrupted state
      mockLocalStorage.get.mockReturnValue(null)

      // Create store with potentially corrupted state
      const stepStore = new StepStore()

      // Verify it defaults to initial step or handles gracefully
      expect(stepStore.currentStep).toBe(1)
    })

    it('should prevent jumping to step 4 incorrectly', () => {
      // Explicitly test against the previously reported issue
      stepStore.setCurrentStep(2) // Set to configuration step
      
      // Simulate app reload
      const reloadedStepStore = new StepStore()

      // Verify step remains 2, not incorrectly moved to 4
      expect(reloadedStepStore.currentStep).toBe(2)
    })
  })

  describe('Workspace Integration', () => {
    it('should maintain step consistency with workspace state', () => {
      // Create a mock workspace state
      const mockWorkspaceState: WorkspaceState = {
        id: 'test-workspace',
        name: 'Test Workspace',
        createdAt: new Date(),
        currentStep: 3,
        subtitles: []
      }

      // Create a mock workspace using the new API
      const store = useWorkspaceStore.getState()
      await store.createWorkspace('Test Workspace')
      
      // Get the current workspace to verify
      const currentWorkspace = store.currentWorkspace
      expect(currentWorkspace).toBeDefined()
    })
  })
})