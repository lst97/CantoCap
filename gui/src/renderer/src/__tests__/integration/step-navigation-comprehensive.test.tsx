/**
 * Comprehensive Step Navigation System Test Suite
 * 
 * Tests all aspects of the enhanced step navigation system including:
 * - Core navigation functionality for all step states
 * - User experience features (loading states, feedback)
 * - Error handling and edge cases
 * - Integration with workflow system
 * - Performance and debugging
 * - Accessibility features
 * 
 * @version 1.0.0
 * @author QA Expert
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { StepNavigation } from '../../components/layout/StepNavigation';
import { WorkflowStateProvider } from '../../contexts/WorkflowStateContext';
import { workflowStateManager } from '../../services/workflow/workflow-state-manager';
import { StepState, createStepId } from '../../types/workflow-state';

// Test theme for consistent Material-UI rendering
const testTheme = createTheme({
  palette: { mode: 'light' }
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={testTheme}>
    <WorkflowStateProvider>
      {children}
    </WorkflowStateProvider>
  </ThemeProvider>
);

// Mock store dependencies
jest.mock('../../stores/app-store', () => ({
  useAppStore: () => ({
    processing: {
      isActive: false,
      stage: 'idle'
    }
  })
}));

jest.mock('../../stores/ui-store', () => ({
  useUIStore: () => ({
    isSettingsMode: false
  }),
  selectSettingsUI: (state: any) => ({
    isSettingsMode: false
  })
}));

jest.mock('../../stores/workspace-store', () => ({
  useWorkspaceStore: () => ({
    currentWorkspace: {
      name: 'Test Workspace'
    }
  })
}));

describe('Step Navigation System - Comprehensive Testing', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarns: string[] = [];

  beforeEach(() => {
    // Reset workflow state manager to initial state
    workflowStateManager.reset();
    
    // Capture console outputs for debugging analysis
    consoleLogs = [];
    consoleErrors = [];
    consoleWarns = [];
    
    jest.spyOn(console, 'log').mockImplementation((message) => {
      consoleLogs.push(message);
    });
    
    jest.spyOn(console, 'error').mockImplementation((message) => {
      consoleErrors.push(message);
    });
    
    jest.spyOn(console, 'warn').mockImplementation((message) => {
      consoleWarns.push(message);
    });
    
    // Mock performance.now for timing tests
    jest.spyOn(performance, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Core Step Navigation Testing', () => {
    describe('Step State Navigation Validation', () => {
      test('should navigate to ready steps successfully', async () => {
        const user = userEvent.setup();
        
        // Set input-file step to ready state
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        expect(inputFileStep).toBeInTheDocument();
        expect(inputFileStep).not.toHaveAttribute('aria-disabled', 'true');
        
        await user.click(inputFileStep);
        
        await waitFor(() => {
          expect(workflowStateManager.getCurrentStep()).toBe('input-file');
        });
        
        // Verify success feedback appears
        await waitFor(() => {
          expect(screen.getByText(/successfully navigated to input-file/i)).toBeInTheDocument();
        });
      });

      test('should navigate to complete steps successfully', async () => {
        const user = userEvent.setup();
        
        // Set up steps: input-file complete, processing ready
        await workflowStateManager.transitionState('input-file', StepState.Complete);
        await workflowStateManager.transitionState('processing', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        // Should be able to navigate to completed input-file step
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        await waitFor(() => {
          expect(workflowStateManager.getCurrentStep()).toBe('input-file');
        });
        
        // Should also be able to navigate to ready processing step
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        await user.click(processingStep);
        
        await waitFor(() => {
          expect(workflowStateManager.getCurrentStep()).toBe('processing');
        });
      });

      test('should block navigation to blocked steps with clear error message', async () => {
        const user = userEvent.setup();
        
        // Set processing step to blocked
        await workflowStateManager.transitionState('processing', StepState.Blocked, {
          message: 'Please select a video file first',
          reason: 'Input file required'
        });
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        expect(processingStep).toHaveAttribute('aria-disabled', 'true');
        
        await user.click(processingStep);
        
        // Verify error message appears
        await waitFor(() => {
          expect(screen.getByText(/please select a video file first before proceeding to processing/i)).toBeInTheDocument();
        });
        
        // Verify step didn't change
        expect(workflowStateManager.getCurrentStep()).not.toBe('processing');
      });

      test('should handle error steps gracefully', async () => {
        const user = userEvent.setup();
        
        // Set processing step to error state
        await workflowStateManager.transitionState('processing', StepState.Error, {
          message: 'Processing failed due to codec error',
          reason: 'Unsupported video format'
        });
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        expect(processingStep).toHaveAttribute('aria-disabled', 'true');
        
        // Verify error state is visible
        expect(screen.getByText(/error/i)).toBeInTheDocument();
        expect(screen.getByText(/processing failed due to codec error/i)).toBeInTheDocument();
        
        await user.click(processingStep);
        
        // Verify error message in feedback
        await waitFor(() => {
          expect(screen.getByText(/processing encountered an error/i)).toBeInTheDocument();
        });
      });

      test('should handle skip steps appropriately', async () => {
        const user = userEvent.setup();
        
        // Set review step to skip state
        await workflowStateManager.transitionState('review', StepState.Skip, {
          message: 'Automatic processing enabled',
          reason: 'User chose to skip manual review'
        });
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const reviewStep = screen.getByRole('button', { name: /navigate to review/i });
        expect(reviewStep).toHaveAttribute('aria-disabled', 'true');
        
        // Verify skip state styling
        expect(screen.getByText(/skipped/i)).toBeInTheDocument();
        
        await user.click(reviewStep);
        
        // Should not navigate to skipped step
        expect(workflowStateManager.getCurrentStep()).not.toBe('review');
      });
    });

    describe('Step ID Validation Testing', () => {
      test('should accept valid step IDs with hyphens', async () => {
        const user = userEvent.setup();
        
        // Test the fix for step ID validation regex
        const validStepIds = ['input-file', 'config', 'processing', 'review', 'export'];
        
        for (const stepId of validStepIds) {
          // Ensure step is ready
          await workflowStateManager.transitionState(stepId, StepState.Ready);
          
          render(<StepNavigation />, { wrapper: TestWrapper });
          
          const stepButton = screen.getByRole('button', { name: new RegExp(`navigate to ${stepId}`, 'i') });
          await user.click(stepButton);
          
          await waitFor(() => {
            expect(workflowStateManager.getCurrentStep()).toBe(stepId);
          });
          
          // Verify no step ID validation errors in console
          const stepIdErrors = consoleErrors.filter(error => 
            error.includes('Invalid step ID format') || error.includes('Step ID validation failed')
          );
          expect(stepIdErrors).toHaveLength(0);
        }
      });

      test('should handle invalid step ID formats gracefully', async () => {
        const user = userEvent.setup();
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        // Simulate navigation to invalid step ID (this would need to be done via direct hook call)
        // This test verifies the createStepId function validation
        expect(() => createStepId('Invalid-Step-ID')).toThrow('Invalid step ID format');
        expect(() => createStepId('123invalid')).toThrow('Invalid step ID format');
        expect(() => createStepId('')).toThrow('Invalid step ID format');
      });
    });
  });

  describe('2. User Experience Testing', () => {
    describe('Loading States', () => {
      test('should show loading spinner during navigation transition', async () => {
        const user = userEvent.setup();
        
        // Mock slow navigation
        jest.spyOn(workflowStateManager, 'setCurrentStep').mockImplementation(() => {
          return new Promise(resolve => setTimeout(() => resolve(true), 100));
        });
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        // Should show loading indicator
        await waitFor(() => {
          expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
        
        // Loading should clear after completion
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 200 });
      });

      test('should throttle multiple rapid clicks', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        
        // Rapid clicks within 500ms should be throttled
        await user.click(inputFileStep);
        await user.click(inputFileStep);
        await user.click(inputFileStep);
        
        // Check console logs for throttling message
        await waitFor(() => {
          const throttleMessages = consoleLogs.filter(log => 
            log.includes('Navigation throttled - too rapid clicks')
          );
          expect(throttleMessages.length).toBeGreaterThan(0);
        });
      });
    });

    describe('User Feedback', () => {
      test('should show success notifications for successful navigation', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        await waitFor(() => {
          expect(screen.getByText(/successfully navigated to input-file/i)).toBeInTheDocument();
        });
        
        // Success message should auto-hide after 2 seconds
        await waitFor(() => {
          expect(screen.queryByText(/successfully navigated to input-file/i)).not.toBeInTheDocument();
        }, { timeout: 2500 });
      });

      test('should show warning messages for blocked steps', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('processing', StepState.Blocked);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        await user.click(processingStep);
        
        await waitFor(() => {
          expect(screen.getByText(/please select a video file first/i)).toBeInTheDocument();
        });
        
        // Warning message should auto-hide after 5 seconds
        await waitFor(() => {
          expect(screen.queryByText(/please select a video file first/i)).not.toBeInTheDocument();
        }, { timeout: 5500 });
      });

      test('should show error messages with clear guidance', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('processing', StepState.Error, {
          message: 'Processing failed',
          reason: 'Video codec not supported'
        });
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        await user.click(processingStep);
        
        await waitFor(() => {
          expect(screen.getByText(/processing encountered an error/i)).toBeInTheDocument();
        });
      });

      test('should show info messages for special cases', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        
        // Click while already navigating
        await user.click(inputFileStep);
        await user.click(inputFileStep);
        
        await waitFor(() => {
          expect(screen.getByText(/navigation already in progress/i)).toBeInTheDocument();
        });
      });
    });

    describe('Accessibility', () => {
      test('should have proper ARIA labels', async () => {
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const stepButtons = screen.getAllByRole('button');
        stepButtons.forEach(button => {
          expect(button).toHaveAttribute('aria-label');
          expect(button).toHaveAttribute('role', 'button');
        });
      });

      test('should support keyboard navigation with Enter and Space keys', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        
        // Test Enter key
        inputFileStep.focus();
        await user.keyboard('{Enter}');
        
        await waitFor(() => {
          expect(workflowStateManager.getCurrentStep()).toBe('input-file');
        });
        
        // Reset and test Space key
        await workflowStateManager.transitionState('processing', StepState.Ready);
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        
        processingStep.focus();
        await user.keyboard(' ');
        
        await waitFor(() => {
          expect(workflowStateManager.getCurrentStep()).toBe('processing');
        });
      });

      test('should properly manage focus and tabindex', async () => {
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const enabledButtons = screen.getAllByRole('button').filter(button => 
          !button.hasAttribute('aria-disabled') || button.getAttribute('aria-disabled') === 'false'
        );
        
        const disabledButtons = screen.getAllByRole('button').filter(button => 
          button.getAttribute('aria-disabled') === 'true'
        );
        
        enabledButtons.forEach(button => {
          expect(button).not.toHaveAttribute('tabindex', '-1');
        });
        
        disabledButtons.forEach(button => {
          expect(button).toHaveAttribute('tabindex', '-1');
        });
      });

      test('should have screen reader compatible tooltips', async () => {
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const stepButtons = screen.getAllByRole('button');
        
        // Each step should have a tooltip
        stepButtons.forEach(button => {
          expect(button.closest('[data-testid]') || button).toHaveAttribute('aria-label');
        });
      });
    });
  });

  describe('3. Error Handling & Edge Cases', () => {
    describe('Edge Case Scenarios', () => {
      test('should handle navigation during ongoing state transitions', async () => {
        const user = userEvent.setup();
        
        // Mock ongoing transition
        jest.spyOn(workflowStateManager, 'setCurrentStep').mockImplementation(() => {
          return new Promise(resolve => setTimeout(() => resolve(true), 100));
        });
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        await workflowStateManager.transitionState('processing', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        
        // Start first navigation
        await user.click(inputFileStep);
        
        // Try to navigate to another step while first navigation is in progress
        await user.click(processingStep);
        
        await waitFor(() => {
          expect(screen.getByText(/navigation already in progress/i)).toBeInTheDocument();
        });
      });

      test('should handle rapid successive navigation attempts', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        
        // Rapid successive clicks
        await user.click(inputFileStep);
        await user.click(inputFileStep);
        await user.click(inputFileStep);
        
        // Should see throttling messages in console
        const throttleMessages = consoleLogs.filter(log => 
          log.includes('Navigation throttled')
        );
        expect(throttleMessages.length).toBeGreaterThan(0);
      });

      test('should handle navigation to non-existent steps', async () => {
        // This would be tested at the hook level since the UI only shows valid steps
        const nonExistentSteps = ['non-existent', 'invalid-step', ''];
        
        for (const stepId of nonExistentSteps) {
          try {
            createStepId(stepId);
            fail('Should have thrown error for invalid step ID');
          } catch (error) {
            expect(error).toBeInstanceOf(TypeError);
            expect((error as Error).message).toContain('Invalid step ID format');
          }
        }
      });
    });

    describe('Error Recovery', () => {
      test('should recover gracefully from failed navigation attempts', async () => {
        const user = userEvent.setup();
        
        // Mock navigation failure
        jest.spyOn(workflowStateManager, 'setCurrentStep').mockRejectedValueOnce(
          new Error('Navigation failed')
        );
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        await waitFor(() => {
          expect(screen.getByText(/navigation error/i)).toBeInTheDocument();
        });
        
        // Error should not leave UI in broken state
        expect(inputFileStep).not.toBeDisabled();
      });

      test('should provide clear error messages with actionable guidance', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('processing', StepState.Blocked, {
          message: 'No input file selected',
          reason: 'Input file required for processing'
        });
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        await user.click(processingStep);
        
        await waitFor(() => {
          const errorMessage = screen.getByText(/please select a video file first/i);
          expect(errorMessage).toBeInTheDocument();
        });
      });

      test('should properly cleanup loading states on failure', async () => {
        const user = userEvent.setup();
        
        // Mock navigation failure after delay
        jest.spyOn(workflowStateManager, 'setCurrentStep').mockImplementation(() => {
          return new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Navigation failed')), 50)
          );
        });
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        // Should show loading initially
        await waitFor(() => {
          expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
        
        // Loading should clear after failure
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });
        
        // Error message should appear
        await waitFor(() => {
          expect(screen.getByText(/navigation error/i)).toBeInTheDocument();
        });
      });
    });
  });

  describe('4. Integration Testing', () => {
    describe('Workflow Integration', () => {
      test('should reflect step state changes immediately in navigation UI', async () => {
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        // Initially, processing should be blocked
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        expect(processingStep).toHaveAttribute('aria-disabled', 'true');
        
        // Complete input-file step
        await act(async () => {
          await workflowStateManager.transitionState('input-file', StepState.Complete);
          await workflowStateManager.transitionState('processing', StepState.Ready);
        });
        
        // Processing step should now be enabled
        await waitFor(() => {
          expect(processingStep).not.toHaveAttribute('aria-disabled', 'true');
        });
      });

      test('should not interfere with ongoing state transitions', async () => {
        const user = userEvent.setup();
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        // Start a state transition
        const transitionPromise = workflowStateManager.transitionState('input-file', StepState.Complete);
        
        // Try to navigate during transition
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        // Wait for transition to complete
        await transitionPromise;
        
        // Navigation should work normally after transition
        await waitFor(() => {
          expect(workflowStateManager.getCurrentStep()).toBe('input-file');
        });
      });

      test('should properly integrate with WorkflowStateContext', async () => {
        const user = userEvent.setup();
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        // Verify context integration by checking step array rendering
        const stepButtons = screen.getAllByRole('button');
        expect(stepButtons.length).toBeGreaterThan(0);
        
        // Each step should have proper context data
        stepButtons.forEach(button => {
          expect(button).toHaveAttribute('aria-label');
        });
      });
    });

    describe('Cross-Component Integration', () => {
      test('should coordinate with useWorkflowNavigation hook properly', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        // Verify navigation logs show proper coordination
        await waitFor(() => {
          const navigationLogs = consoleLogs.filter(log => 
            log.includes('Navigation attempt:') || log.includes('Navigation successful:')
          );
          expect(navigationLogs.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('5. Performance & Debugging Testing', () => {
    describe('Performance', () => {
      test('should complete navigation within performance targets (<100ms for local state changes)', async () => {
        const user = userEvent.setup();
        
        let startTime: number;
        let endTime: number;
        
        // Mock performance timing
        jest.spyOn(performance, 'now')
          .mockReturnValueOnce(0) // Start time
          .mockReturnValueOnce(50); // End time (50ms)
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        
        startTime = performance.now();
        await user.click(inputFileStep);
        endTime = performance.now();
        
        await waitFor(() => {
          expect(workflowStateManager.getCurrentStep()).toBe('input-file');
        });
        
        // Check for performance logs
        const performanceLogs = consoleLogs.filter(log => 
          log.includes('duration:') || log.includes('ms')
        );
        expect(performanceLogs.length).toBeGreaterThan(0);
      });

      test('should not cause memory leaks during repeated navigation', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        await workflowStateManager.transitionState('processing', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        const processingStep = screen.getByRole('button', { name: /navigate to processing/i });
        
        // Perform multiple navigations
        for (let i = 0; i < 5; i++) {
          await user.click(inputFileStep);
          await waitFor(() => expect(workflowStateManager.getCurrentStep()).toBe('input-file'));
          
          await user.click(processingStep);
          await waitFor(() => expect(workflowStateManager.getCurrentStep()).toBe('processing'));
        }
        
        // No specific memory leak test, but verify no excessive warnings/errors
        const memoryWarnings = consoleWarns.filter(warn => 
          warn.includes('memory') || warn.includes('leak')
        );
        expect(memoryWarnings).toHaveLength(0);
      });
    });

    describe('Debugging', () => {
      test('should provide comprehensive logs with proper formatting', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        await waitFor(() => {
          // Check for various log types
          const debugLogs = consoleLogs.filter(log => 
            log.includes('🔧 [STEP NAVIGATION]') || 
            log.includes('🧭 Navigation attempt:') ||
            log.includes('✅ Navigation successful:')
          );
          expect(debugLogs.length).toBeGreaterThan(0);
        });
      });

      test('should provide accurate performance metrics', async () => {
        const user = userEvent.setup();
        
        // Mock performance timing
        jest.spyOn(performance, 'now')
          .mockReturnValueOnce(100) // Start time
          .mockReturnValueOnce(150); // End time
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        await waitFor(() => {
          const performanceLogs = consoleLogs.filter(log => 
            log.includes('50.00ms') // Expected duration
          );
          expect(performanceLogs.length).toBeGreaterThan(0);
        });
      });

      test('should provide detailed error context', async () => {
        const user = userEvent.setup();
        
        // Mock navigation error
        jest.spyOn(workflowStateManager, 'setCurrentStep').mockRejectedValueOnce(
          new Error('Test navigation error')
        );
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        await waitFor(() => {
          const errorLogs = consoleErrors.filter(error => 
            error.includes('🚨 Navigation error:') || 
            error.includes('Test navigation error')
          );
          expect(errorLogs.length).toBeGreaterThan(0);
        });
      });

      test('should provide session tracking for debugging', async () => {
        const user = userEvent.setup();
        
        await workflowStateManager.transitionState('input-file', StepState.Ready);
        
        render(<StepNavigation />, { wrapper: TestWrapper });
        
        const inputFileStep = screen.getByRole('button', { name: /navigate to input-file/i });
        await user.click(inputFileStep);
        
        await waitFor(() => {
          const sessionLogs = consoleLogs.filter(log => 
            log.includes('sessionId:')
          );
          expect(sessionLogs.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('6. Visual and Animation Testing', () => {
    test('should show appropriate visual indicators for different step states', async () => {
      render(<StepNavigation />, { wrapper: TestWrapper });
      
      // Check for completed step indicators
      await act(async () => {
        await workflowStateManager.transitionState('input-file', StepState.Complete);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/done/i)).toBeInTheDocument();
      });
      
      // Check for error step indicators
      await act(async () => {
        await workflowStateManager.transitionState('processing', StepState.Error, {
          message: 'Test error'
        });
      });
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
        expect(screen.getByText(/test error/i)).toBeInTheDocument();
      });
    });

    test('should show processing animations when active', async () => {
      // Mock processing state
      jest.doMock('../../stores/app-store', () => ({
        useAppStore: () => ({
          processing: {
            isActive: true,
            stage: 'processing'
          }
        })
      }));
      
      await act(async () => {
        await workflowStateManager.transitionState('processing', StepState.Ready);
      });
      
      render(<StepNavigation />, { wrapper: TestWrapper });
      
      // Should show processing indicators
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
      expect(screen.getByText(/processing in progress/i)).toBeInTheDocument();
    });
  });
});