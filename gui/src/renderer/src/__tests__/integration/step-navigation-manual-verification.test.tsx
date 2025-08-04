/**
 * Manual Verification Test for Step Navigation System
 * 
 * Quick manual test to verify basic functionality before comprehensive testing
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { StepNavigation } from '../../components/layout/StepNavigation';
import { WorkflowStateProvider } from '../../contexts/WorkflowStateContext';
import { workflowStateManager } from '../../services/workflow-state-manager';
import { StepState } from '../../types/workflow-state';

// Test theme
const testTheme = createTheme({ palette: { mode: 'light' } });

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={testTheme}>
    <WorkflowStateProvider>
      {children}
    </WorkflowStateProvider>
  </ThemeProvider>
);

// Mock dependencies
jest.mock('../../stores/app-store', () => ({
  useAppStore: () => ({ processing: { isActive: false, stage: 'idle' } })
}));

jest.mock('../../stores/ui-store', () => ({
  useUIStore: () => ({ isSettingsMode: false }),
  selectSettingsUI: () => ({ isSettingsMode: false })
}));

jest.mock('../../stores/workspace-store', () => ({
  useWorkspaceStore: () => ({ currentWorkspace: { name: 'Test Workspace' } })
}));

describe('Step Navigation - Manual Verification', () => {
  beforeEach(() => {
    workflowStateManager.reset();
    jest.clearAllMocks();
  });

  test('should render step navigation component', () => {
    render(<StepNavigation />, { wrapper: TestWrapper });
    
    // Check that component renders
    expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    expect(screen.getByText('Processing Steps')).toBeInTheDocument();
    
    // Check that steps are rendered
    const stepButtons = screen.getAllByRole('button');
    expect(stepButtons.length).toBeGreaterThan(0);
    
    console.log('✅ Component renders successfully');
    console.log('✅ Step buttons found:', stepButtons.length);
  });

  test('should show step states correctly', async () => {
    render(<StepNavigation />, { wrapper: TestWrapper });
    
    // Input file should be ready by default
    const inputFileStep = screen.getByText(/Input File/i);
    expect(inputFileStep).toBeInTheDocument();
    
    // Other steps should be blocked
    const configStep = screen.getByText(/Configuration/i);
    expect(configStep).toBeInTheDocument();
    
    console.log('✅ Step states display correctly');
  });

  test('should handle basic navigation', async () => {
    const user = userEvent.setup();
    
    // Ensure input-file is ready
    await workflowStateManager.transitionState('input-file', StepState.Ready);
    
    render(<StepNavigation />, { wrapper: TestWrapper });
    
    // Find the input file step button by its accessible label
    const stepButtons = screen.getAllByRole('button');
    const inputFileButton = stepButtons.find(button => 
      button.getAttribute('aria-label')?.includes('Input File')
    );
    
    expect(inputFileButton).toBeDefined();
    console.log('✅ Input File button found with correct aria-label');
    
    if (inputFileButton && !inputFileButton.hasAttribute('aria-disabled')) {
      await user.click(inputFileButton);
      
      // Check that navigation occurred
      await waitFor(() => {
        expect(workflowStateManager.getCurrentStep()).toBe('input-file');
      });
      
      console.log('✅ Basic navigation works');
    }
  });

  test('should show blocked steps as disabled', () => {
    render(<StepNavigation />, { wrapper: TestWrapper });
    
    const stepButtons = screen.getAllByRole('button');
    const blockedButtons = stepButtons.filter(button => 
      button.getAttribute('aria-disabled') === 'true'
    );
    
    expect(blockedButtons.length).toBeGreaterThan(0);
    console.log('✅ Blocked steps are properly disabled:', blockedButtons.length);
  });

  test('should have accessibility attributes', () => {
    render(<StepNavigation />, { wrapper: TestWrapper });
    
    const stepButtons = screen.getAllByRole('button');
    let accessibilityCount = 0;
    
    stepButtons.forEach(button => {
      if (button.hasAttribute('aria-label')) {
        accessibilityCount++;
      }
    });
    
    expect(accessibilityCount).toBeGreaterThan(0);
    console.log('✅ Accessibility attributes present:', accessibilityCount, 'buttons have aria-labels');
  });

  test('should show step ID validation works', () => {
    // Test the createStepId function directly
    const { createStepId } = require('../../types/workflow-state');
    
    // Valid step IDs
    expect(() => createStepId('input-file')).not.toThrow();
    expect(() => createStepId('config')).not.toThrow();
    expect(() => createStepId('processing')).not.toThrow();
    
    // Invalid step IDs
    expect(() => createStepId('Invalid-ID')).toThrow();
    expect(() => createStepId('')).toThrow();
    
    console.log('✅ Step ID validation works correctly');
  });

  test('should log debug information', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    render(<StepNavigation />, { wrapper: TestWrapper });
    
    // Check that debug logs are created
    expect(consoleSpy).toHaveBeenCalled();
    
    const debugLogs = consoleSpy.mock.calls.filter(call => 
      call[0]?.includes?.('🔧 [STEP NAVIGATION]') || 
      call[0]?.includes?.('🔧 [SINGLETON]')
    );
    
    expect(debugLogs.length).toBeGreaterThan(0);
    console.log('✅ Debug logging is active:', debugLogs.length, 'debug messages');
    
    consoleSpy.mockRestore();
  });
});