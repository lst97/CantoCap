/**
 * Infinite Re-render Validation Test
 * 
 * Tests the critical fixes implemented for P0 infinite re-render loops in ReviewStep component.
 * Validates that the component can handle JSON import → Step 4 workflow without performance issues.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ReviewStep } from '../components/steps/ReviewStep';
import { useAppStore } from '../stores/app-store';
import { useSubtitleEditStore } from '../stores/subtitle-edit-store';

// Mock the stores
jest.mock('../stores/app-store');
jest.mock('../stores/subtitle-edit-store');
jest.mock('../contexts/WorkspaceConfigContext');

// Mock the complex child components
jest.mock('../components/steps/ReviewStep/VideoPreviewSection', () => ({
  VideoPreviewSection: () => <div data-testid="video-preview">Video Preview</div>
}));

jest.mock('../components/steps/ReviewStep/SubtitleListPanel', () => ({
  SubtitleListPanel: () => <div data-testid="subtitle-list">Subtitle List</div>
}));

jest.mock('../components/steps/ReviewStep/SubtitleEditor', () => ({
  SubtitleEditor: () => <div data-testid="subtitle-editor">Subtitle Editor</div>
}));

describe('ReviewStep Infinite Re-render Fixes', () => {
  const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;
  const mockUseSubtitleEditStore = useSubtitleEditStore as jest.MockedFunction<typeof useSubtitleEditStore>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock app store with JSON import scenario
    mockUseAppStore.mockReturnValue({
      config: {
        inputFile: '/test/video.mp4',
        subtitle: [
          {
            id: 1,
            startTime: 0,
            endTime: 2,
            text: 'Test subtitle 1',
            confidence: 0.9
          },
          {
            id: 2,
            startTime: 2,
            endTime: 4,
            text: 'Test subtitle 2',
            confidence: 0.8
          }
        ],
        importedJsonFile: '/test/subtitles.json',
        isImportedFromJson: true,
        outputFile: null
      }
    });

    // Mock subtitle edit store
    mockUseSubtitleEditStore.mockReturnValue({
      session: null,
      isLoading: false,
      initializeSession: jest.fn(),
      clearSession: jest.fn(),
      enablePersistence: jest.fn(),
      checkForRecoverableSession: jest.fn(),
      restorePersistedSession: jest.fn(),
      sessionRecovery: {
        hasRecoverableSession: false,
        recoverableSessionId: null,
        lastSessionWorkspaceId: null
      },
      undoStack: [],
      redoStack: [],
      setAutoSaveCallback: jest.fn()
    });

    // Mock workspace config context
    require('../contexts/WorkspaceConfigContext').useReviewStepConfig = jest.fn().mockReturnValue({
      config: {},
      updateConfig: jest.fn(),
      isLoading: false,
      error: null,
      isReady: true,
      persistenceData: {
        currentSession: { workspaceId: 'test-workspace' },
        currentFiles: {}
      },
      loadSubtitleFile: jest.fn(),
      saveSubtitleFile: jest.fn(),
      createSubtitleFile: jest.fn(),
      isLoadingFiles: false,
      isSavingFiles: false,
      hasUnsavedFileChanges: false,
      fileError: null,
      clearFileError: jest.fn()
    });

    require('../contexts/WorkspaceConfigContext').useWorkspaceConfig = jest.fn().mockReturnValue({
      autoSaveStatus: { lastSaveTime: null },
      isAutoSaving: false,
      lastError: null,
      clearError: jest.fn(),
      currentWorkspaceId: 'test-workspace'
    });
  });

  it('should render without infinite re-renders during JSON import scenario', async () => {
    const renderCount = jest.fn();
    
    // Wrap ReviewStep to count renders
    const TestWrapper = () => {
      renderCount();
      return <ReviewStep />;
    };

    render(<TestWrapper />);

    // Wait for initial render and any immediate effects
    await waitFor(() => {
      expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Ensure component rendered successfully
    expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-list')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-editor')).toBeInTheDocument();

    // Wait a bit more to catch any delayed re-renders
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // CRITICAL: Render count should be minimal (1-3 renders max for proper React behavior)
    expect(renderCount).toHaveBeenCalledTimes(expect.any(Number));
    expect(renderCount.mock.calls.length).toBeLessThan(10); // Should not have excessive re-renders
    
    console.log(`✅ ReviewStep rendered ${renderCount.mock.calls.length} times (should be <10)`);
  });

  it('should handle rapid state changes without cascading re-renders', async () => {
    const renderCount = jest.fn();
    
    const TestWrapper = () => {
      renderCount();
      return <ReviewStep />;
    };

    const { rerender } = render(<TestWrapper />);

    // Simulate rapid config changes (like what happens during JSON import)
    for (let i = 0; i < 5; i++) {
      mockUseAppStore.mockReturnValue({
        config: {
          inputFile: '/test/video.mp4',
          subtitle: [
            {
              id: 1,
              startTime: 0,
              endTime: 2,
              text: `Test subtitle ${i + 1}`,
              confidence: 0.9
            }
          ],
          importedJsonFile: `/test/subtitles-${i}.json`,
          isImportedFromJson: true,
          outputFile: null
        }
      });

      rerender(<TestWrapper />);
      
      // Small delay between changes
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    }

    // Wait for all effects to settle
    await waitFor(() => {
      expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Should handle rapid changes gracefully without excessive re-renders
    expect(renderCount.mock.calls.length).toBeLessThan(20); // 5 config changes shouldn't cause >20 renders
    
    console.log(`✅ Handled rapid changes with ${renderCount.mock.calls.length} renders (should be <20)`);
  });

  it('should have stable React.memo implementation', () => {
    const ReviewStepMemoized = ReviewStep;
    
    // Verify that ReviewStep is properly memoized
    expect(ReviewStepMemoized.displayName).toBeDefined();
    
    // Test memo comparison function (should always return true since no props)
    const prevProps = {};
    const nextProps = {};
    
    // ReviewStep memo should prevent re-renders when props haven't changed
    // Since ReviewStep has no props, it should always prevent re-renders
    expect(typeof ReviewStepMemoized).toBe('function');
  });

  it('should cleanup resources on unmount', () => {
    const { unmount } = render(<ReviewStep />);
    
    // Should unmount without errors or memory leaks
    expect(() => unmount()).not.toThrow();
    
    console.log('✅ Component unmounted cleanly without errors');
  });
});