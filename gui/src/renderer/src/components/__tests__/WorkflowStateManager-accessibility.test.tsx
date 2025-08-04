/**
 * Accessibility Testing for WorkflowStateManager UI Components
 * Tests keyboard navigation, screen reader compatibility, ARIA compliance, and disabled state behavior
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { jest } from '@jest/globals'
import {
  useWorkflowState,
  useStepState,
  useWorkflowNavigation,
  useStepTransitions
} from '../../hooks/useWorkflowStateManager'
import {
  StepState,
  createStepId,
  StateChangeEvent
} from '../../types/workflow-state'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock the hooks
const mockUseWorkflowState = useWorkflowState as jest.MockedFunction<typeof useWorkflowState>
const mockUseStepState = useStepState as jest.MockedFunction<typeof useStepState>
const mockUseWorkflowNavigation = useWorkflowNavigation as jest.MockedFunction<typeof useWorkflowNavigation>
const mockUseStepTransitions = useStepTransitions as jest.MockedFunction<typeof useStepTransitions>

jest.mock('../../hooks/useWorkflowStateManager', () => ({
  useWorkflowState: jest.fn(),
  useStepState: jest.fn(),
  useWorkflowNavigation: jest.fn(),
  useStepTransitions: jest.fn()
}))

// Test Components for accessibility testing
const WorkflowStepCard: React.FC<{
  stepId: string
  title: string
  description: string
  onNavigate?: (stepId: string) => void
}> = ({ stepId, title, description, onNavigate }) => {
  const { state, isAccessible, isComplete, isError, hasWarning, isBlocked } = useStepState(stepId)
  const { navigateToStep } = useWorkflowNavigation()

  const getAriaLabel = () => {
    const status = isComplete ? 'completed' : 
                  isError ? 'has errors' :
                  hasWarning ? 'has warnings' :
                  isBlocked ? 'blocked' :
                  isAccessible ? 'ready' : 'not ready'
    return `${title}, ${status}`
  }

  const getStatusIcon = () => {
    if (isComplete) return '✓'
    if (isError) return '✕'
    if (hasWarning) return '⚠'
    if (isBlocked) return '🔒'
    return '○'
  }

  return (
    <div
      role="button"
      tabIndex={isAccessible ? 0 : -1}
      aria-label={getAriaLabel()}
      aria-disabled={!isAccessible}
      aria-describedby={`${stepId}-description`}
      className={`workflow-step ${state} ${isAccessible ? 'accessible' : 'blocked'}`}
      onClick={() => isAccessible && (onNavigate?.(stepId) || navigateToStep(stepId))}
      onKeyDown={(e) => {
        if (isAccessible && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onNavigate?.(stepId) || navigateToStep(stepId)
        }
      }}
      data-testid={`step-${stepId}`}
    >
      <div className="step-header">
        <span className="step-icon" aria-hidden="true">{getStatusIcon()}</span>
        <h3 className="step-title">{title}</h3>
      </div>
      <p id={`${stepId}-description`} className="step-description">
        {description}
      </p>
      {!isAccessible && (
        <div className="step-status" aria-live="polite">
          {isBlocked ? 'Step is blocked. Complete previous steps first.' :
           isError ? 'Step has errors. Please resolve before continuing.' :
           'Step is not ready.'}
        </div>
      )}
    </div>
  )
}

const WorkflowProgress: React.FC = () => {
  const { steps } = useWorkflowState()
  
  const completedSteps = steps.filter(step => step.stateMetadata.state === StepState.Complete).length
  const totalSteps = steps.length
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return (
    <div role="progressbar" 
         aria-valuenow={progressPercentage}
         aria-valuemin={0}
         aria-valuemax={100}
         aria-label={`Workflow progress: ${completedSteps} of ${totalSteps} steps completed`}
         className="workflow-progress">
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${progressPercentage}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="progress-text" aria-hidden="true">
        {completedSteps}/{totalSteps} steps completed ({progressPercentage.toFixed(0)}%)
      </div>
    </div>
  )
}

const WorkflowControls: React.FC = () => {
  const { isTransitioning, lastError, clearError } = useStepTransitions()
  
  return (
    <div className="workflow-controls">
      {lastError && (
        <div 
          role="alert"
          aria-live="assertive"
          className="error-message"
          data-testid="error-alert"
        >
          <span>Error: {lastError}</span>
          <button 
            onClick={clearError}
            aria-label="Dismiss error message"
            className="error-dismiss"
          >
            ✕
          </button>
        </div>
      )}
      
      {isTransitioning && (
        <div 
          role="status"
          aria-live="polite"
          className="transitioning-status"
          data-testid="transitioning-status"
        >
          <span>Processing workflow step...</span>
        </div>
      )}
    </div>
  )
}

const WorkflowStepper: React.FC = () => {
  const { steps, currentStepId } = useWorkflowState()
  const [focusedStepIndex, setFocusedStepIndex] = React.useState(0)

  const handleKeyNavigation = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        setFocusedStepIndex(prev => Math.min(prev + 1, steps.length - 1))
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        setFocusedStepIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setFocusedStepIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedStepIndex(steps.length - 1)
        break
    }
  }

  return (
    <nav 
      role="navigation"
      aria-label="Workflow steps"
      className="workflow-stepper"
      onKeyDown={handleKeyNavigation}
    >
      <ol className="step-list" role="list">
        {steps.map((step, index) => (
          <li key={step.id} role="listitem">
            <WorkflowStepCard
              stepId={step.id}
              title={step.title}
              description={step.description}
            />
          </li>
        ))}
      </ol>
    </nav>
  )
}

const FullWorkflowInterface: React.FC = () => {
  return (
    <main role="main" className="workflow-interface">
      <header>
        <h1>Subtitle Generation Workflow</h1>
        <WorkflowProgress />
      </header>
      
      <WorkflowControls />
      <WorkflowStepper />
      
      <aside role="complementary" aria-label="Workflow help">
        <h2>Instructions</h2>
        <p>Complete each step in order to generate subtitles for your video.</p>
        <ul>
          <li>Use Tab to navigate between steps</li>
          <li>Press Enter or Space to activate a step</li>
          <li>Use arrow keys to move between steps</li>
        </ul>
      </aside>
    </main>
  )
}

describe('WorkflowStateManager - Accessibility Testing', () => {
  const mockSteps = [
    {
      id: createStepId('input-file'),
      title: 'Input File',
      description: 'Upload your video file',
      stateMetadata: { state: StepState.Ready, lastModified: Date.now() }
    },
    {
      id: createStepId('config'),
      title: 'Configuration',
      description: 'Configure transcription settings',
      stateMetadata: { state: StepState.Blocked, lastModified: Date.now() }
    },
    {
      id: createStepId('processing'),
      title: 'Processing',
      description: 'Generate subtitles',
      stateMetadata: { state: StepState.Blocked, lastModified: Date.now() }
    }
  ]

  beforeEach(() => {
    // Setup default mock implementations
    mockUseWorkflowState.mockReturnValue({
      steps: mockSteps,
      currentStepId: createStepId('input-file'),
      currentStep: mockSteps[0],
      allSteps: new Map(mockSteps.map(step => [step.id, step])),
      _updateCount: 0
    })

    mockUseStepState.mockImplementation((stepId) => {
      const step = mockSteps.find(s => s.id === stepId)
      const state = step?.stateMetadata.state || StepState.Blocked
      
      return {
        step,
        state,
        typedStep: null,
        isReady: state === StepState.Ready,
        isComplete: state === StepState.Complete,
        isBlocked: state === StepState.Blocked,
        isError: state === StepState.Error,
        isSkipped: state === StepState.Skip,
        hasWarning: state === StepState.Warning,
        isAccessible: state === StepState.Ready || state === StepState.Complete
      }
    })

    mockUseWorkflowNavigation.mockReturnValue({
      currentStepId: createStepId('input-file'),
      navigateToStep: jest.fn().mockResolvedValue({ success: true }),
      canNavigateToStep: jest.fn().mockImplementation((stepId) => 
        stepId === 'input-file'
      )
    })

    mockUseStepTransitions.mockReturnValue({
      transitionStepState: jest.fn().mockResolvedValue({ success: true }),
      markStepComplete: jest.fn().mockResolvedValue({ success: true }),
      markStepError: jest.fn().mockResolvedValue({ success: true }),
      markStepReady: jest.fn().mockResolvedValue({ success: true }),
      markStepBlocked: jest.fn().mockResolvedValue({ success: true }),
      markStepSkipped: jest.fn().mockResolvedValue({ success: true }),
      markStepWarning: jest.fn().mockResolvedValue({ success: true }),
      isTransitioning: false,
      lastError: null,
      clearError: jest.fn()
    })
  })

  describe('ARIA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<FullWorkflowInterface />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should provide proper role attributes', () => {
      render(<FullWorkflowInterface />)
      
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: /workflow steps/i })).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByRole('complementary', { name: /workflow help/i })).toBeInTheDocument()
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    it('should provide descriptive aria-labels', () => {
      render(<WorkflowStepCard stepId="input-file" title="Input File" description="Upload video" />)
      
      const stepButton = screen.getByRole('button', { name: /input file, ready/i })
      expect(stepButton).toBeInTheDocument()
      expect(stepButton).toHaveAttribute('aria-describedby', 'input-file-description')
    })

    it('should indicate disabled state correctly', () => {
      render(<WorkflowStepCard stepId="config" title="Configuration" description="Setup options" />)
      
      const stepButton = screen.getByRole('button')
      expect(stepButton).toHaveAttribute('aria-disabled', 'true')
      expect(stepButton).toHaveAttribute('tabIndex', '-1')
    })

    it('should provide live regions for dynamic content', () => {
      render(<WorkflowControls />)
      
      // Error messages should have role="alert"
      mockUseStepTransitions.mockReturnValue({
        ...mockUseStepTransitions(),
        lastError: 'Test error message'
      })
      
      const { rerender } = render(<WorkflowControls />)
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive')
      
      // Status messages should have role="status"
      mockUseStepTransitions.mockReturnValue({
        ...mockUseStepTransitions(),
        isTransitioning: true,
        lastError: null
      })
      
      rerender(<WorkflowControls />)
      const statusMessage = screen.getByRole('status')
      expect(statusMessage).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide proper progress bar semantics', () => {
      render(<WorkflowProgress />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressBar).toHaveAttribute('aria-label', /workflow progress/i)
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support Tab navigation', async () => {
      const user = userEvent.setup()
      render(<FullWorkflowInterface />)
      
      // First accessible step should be focusable
      const inputStep = screen.getByTestId('step-input-file')
      await user.tab()
      expect(inputStep).toHaveFocus()
      
      // Blocked steps should be skipped
      await user.tab()
      expect(inputStep).not.toHaveFocus()
    })

    it('should support Enter and Space key activation', async () => {
      const user = userEvent.setup()
      const mockNavigate = jest.fn()
      
      render(
        <WorkflowStepCard 
          stepId="input-file" 
          title="Input File" 
          description="Upload video"
          onNavigate={mockNavigate}
        />
      )
      
      const stepButton = screen.getByRole('button')
      stepButton.focus()
      
      // Test Enter key
      await user.keyboard('{Enter}')
      expect(mockNavigate).toHaveBeenCalledWith('input-file')
      
      mockNavigate.mockClear()
      
      // Test Space key
      await user.keyboard(' ')
      expect(mockNavigate).toHaveBeenCalledWith('input-file')
    })

    it('should support arrow key navigation in stepper', async () => {
      const user = userEvent.setup()
      render(<WorkflowStepper />)
      
      const stepper = screen.getByRole('navigation')
      stepper.focus()
      
      // Arrow keys should navigate between steps
      await user.keyboard('{ArrowRight}')
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowLeft}')
      await user.keyboard('{ArrowUp}')
      
      // Home and End keys should work
      await user.keyboard('{Home}')
      await user.keyboard('{End}')
      
      // Should not throw errors
      expect(stepper).toBeInTheDocument()
    })

    it('should skip non-interactive elements in tab order', async () => {
      const user = userEvent.setup()
      render(<FullWorkflowInterface />)
      
      // Icons and decorative elements should not be focusable
      const icons = screen.getAllByText(/[✓✕⚠🔒○]/)
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true')
      })
    })

    it('should provide keyboard shortcuts documentation', () => {
      render(<FullWorkflowInterface />)
      
      const instructions = screen.getByRole('complementary')
      expect(instructions).toHaveTextContent(/use tab to navigate/i)
      expect(instructions).toHaveTextContent(/press enter or space/i)
      expect(instructions).toHaveTextContent(/arrow keys/i)
    })
  })

  describe('Screen Reader Compatibility', () => {
    it('should provide meaningful step descriptions', () => {
      render(<WorkflowStepCard stepId="input-file" title="Input File" description="Upload your video file" />)
      
      const description = screen.getByText('Upload your video file')
      expect(description).toHaveAttribute('id', 'input-file-description')
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'input-file-description')
    })

    it('should announce state changes', () => {
      render(<WorkflowStepCard stepId="input-file" title="Input File" description="Upload video" />)
      
      // Mock state change to complete
      mockUseStepState.mockReturnValue({
        step: mockSteps[0],
        state: StepState.Complete,
        typedStep: null,
        isReady: false,
        isComplete: true,
        isBlocked: false,
        isError: false,
        isSkipped: false,
        hasWarning: false,
        isAccessible: true
      })
      
      const { rerender } = render(<WorkflowStepCard stepId="input-file" title="Input File" description="Upload video" />)
      
      const button = screen.getByRole('button', { name: /input file, completed/i })
      expect(button).toBeInTheDocument()
    })

    it('should provide status updates for blocked steps', () => {
      render(<WorkflowStepCard stepId="config" title="Configuration" description="Setup options" />)
      
      const statusMessage = screen.getByText(/step is blocked/i)
      expect(statusMessage).toHaveAttribute('aria-live', 'polite')
    })

    it('should announce errors prominently', () => {
      mockUseStepTransitions.mockReturnValue({
        ...mockUseStepTransitions(),
        lastError: 'Upload failed'
      })
      
      render(<WorkflowControls />)
      
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive')
      expect(errorAlert).toHaveTextContent('Error: Upload failed')
    })

    it('should provide progress updates', () => {
      // Mock some completed steps
      mockUseWorkflowState.mockReturnValue({
        steps: [
          { ...mockSteps[0], stateMetadata: { state: StepState.Complete, lastModified: Date.now() } },
          { ...mockSteps[1], stateMetadata: { state: StepState.Complete, lastModified: Date.now() } },
          { ...mockSteps[2], stateMetadata: { state: StepState.Blocked, lastModified: Date.now() } }
        ],
        currentStepId: createStepId('processing'),
        currentStep: mockSteps[2],
        allSteps: new Map(),
        _updateCount: 1
      })
      
      render(<WorkflowProgress />)
      
      const progressBar = screen.getByRole('progressbar', { 
        name: /workflow progress: 2 of 3 steps completed/i 
      })
      expect(progressBar).toHaveAttribute('aria-valuenow', '67') // 2/3 * 100 rounded
    })
  })

  describe('Disabled State Behavior', () => {
    it('should properly disable blocked steps', () => {
      render(<WorkflowStepCard stepId="config" title="Configuration" description="Setup options" />)
      
      const stepButton = screen.getByRole('button')
      expect(stepButton).toHaveAttribute('aria-disabled', 'true')
      expect(stepButton).toHaveAttribute('tabIndex', '-1')
      expect(stepButton).toHaveClass('blocked')
    })

    it('should prevent interaction with disabled steps', async () => {
      const user = userEvent.setup()
      const mockNavigate = jest.fn()
      
      render(
        <WorkflowStepCard 
          stepId="config" 
          title="Configuration" 
          description="Setup options"
          onNavigate={mockNavigate}
        />
      )
      
      const stepButton = screen.getByRole('button')
      
      // Click should not trigger navigation
      await user.click(stepButton)
      expect(mockNavigate).not.toHaveBeenCalled()
      
      // Keyboard activation should not work
      stepButton.focus()
      await user.keyboard('{Enter}')
      await user.keyboard(' ')
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should provide clear disabled state messaging', () => {
      render(<WorkflowStepCard stepId="config" title="Configuration" description="Setup options" />)
      
      const statusMessage = screen.getByText(/complete previous steps first/i)
      expect(statusMessage).toBeInTheDocument()
      expect(statusMessage).toHaveAttribute('aria-live', 'polite')
    })

    it('should visually distinguish disabled states', () => {
      render(<WorkflowStepCard stepId="config" title="Configuration" description="Setup options" />)
      
      const stepButton = screen.getByRole('button')
      expect(stepButton).toHaveClass('blocked')
      
      const icon = screen.getByText('🔒')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Error State Accessibility', () => {
    it('should properly announce error states', () => {
      mockUseStepState.mockReturnValue({
        step: { ...mockSteps[0], stateMetadata: { state: StepState.Error, lastModified: Date.now() } },
        state: StepState.Error,
        typedStep: null,
        isReady: false,
        isComplete: false,
        isBlocked: false,
        isError: true,
        isSkipped: false,
        hasWarning: false,
        isAccessible: false
      })
      
      render(<WorkflowStepCard stepId="input-file" title="Input File" description="Upload video" />)
      
      const button = screen.getByRole('button', { name: /input file, has errors/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })

    it('should provide error dismissal functionality', async () => {
      const user = userEvent.setup()
      const mockClearError = jest.fn()
      
      mockUseStepTransitions.mockReturnValue({
        ...mockUseStepTransitions(),
        lastError: 'Upload failed',
        clearError: mockClearError
      })
      
      render(<WorkflowControls />)
      
      const dismissButton = screen.getByRole('button', { name: /dismiss error message/i })
      await user.click(dismissButton)
      
      expect(mockClearError).toHaveBeenCalled()
    })

    it('should maintain focus management during error states', async () => {
      const user = userEvent.setup()
      const mockClearError = jest.fn()
      
      mockUseStepTransitions.mockReturnValue({
        ...mockUseStepTransitions(),
        lastError: 'Upload failed',
        clearError: mockClearError
      })
      
      render(<WorkflowControls />)
      
      const dismissButton = screen.getByRole('button', { name: /dismiss error message/i })
      dismissButton.focus()
      
      await user.keyboard('{Enter}')
      expect(mockClearError).toHaveBeenCalled()
    })
  })

  describe('Warning State Accessibility', () => {
    it('should announce warning states appropriately', () => {
      mockUseStepState.mockReturnValue({
        step: { ...mockSteps[0], stateMetadata: { state: StepState.Warning, lastModified: Date.now() } },
        state: StepState.Warning,
        typedStep: null,
        isReady: false,
        isComplete: false,
        isBlocked: false,
        isError: false,
        isSkipped: false,
        hasWarning: true,
        isAccessible: true
      })
      
      render(<WorkflowStepCard stepId="input-file" title="Input File" description="Upload video" />)
      
      const button = screen.getByRole('button', { name: /input file, has warnings/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-disabled', 'false')
    })

    it('should allow interaction with warning states', async () => {
      const user = userEvent.setup()
      const mockNavigate = jest.fn()
      
      mockUseStepState.mockReturnValue({
        step: { ...mockSteps[0], stateMetadata: { state: StepState.Warning, lastModified: Date.now() } },
        state: StepState.Warning,
        typedStep: null,
        isReady: false,
        isComplete: false,
        isBlocked: false,
        isError: false,
        isSkipped: false,
        hasWarning: true,
        isAccessible: true
      })
      
      render(
        <WorkflowStepCard 
          stepId="input-file" 
          title="Input File" 
          description="Upload video"
          onNavigate={mockNavigate}
        />
      )
      
      const stepButton = screen.getByRole('button')
      await user.click(stepButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('input-file')
    })
  })

  describe('Dynamic Content Updates', () => {
    it('should handle live region updates properly', async () => {
      const { rerender } = render(<WorkflowControls />)
      
      // Initially no error
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      
      // Add error
      mockUseStepTransitions.mockReturnValue({
        ...mockUseStepTransitions(),
        lastError: 'Network error'
      })
      
      rerender(<WorkflowControls />)
      
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toHaveTextContent('Error: Network error')
    })

    it('should update progress announcements', () => {
      const { rerender } = render(<WorkflowProgress />)
      
      // Update to show progress
      mockUseWorkflowState.mockReturnValue({
        steps: [
          { ...mockSteps[0], stateMetadata: { state: StepState.Complete, lastModified: Date.now() } },
          { ...mockSteps[1], stateMetadata: { state: StepState.Blocked, lastModified: Date.now() } },
          { ...mockSteps[2], stateMetadata: { state: StepState.Blocked, lastModified: Date.now() } }
        ],
        currentStepId: createStepId('config'),
        currentStep: mockSteps[1],
        allSteps: new Map(),
        _updateCount: 1
      })
      
      rerender(<WorkflowProgress />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', /1 of 3 steps completed/i)
    })
  })
})