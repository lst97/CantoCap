/**
 * ReviewStep Infinite Render Loop Debugging Test Suite
 * 
 * Comprehensive test suite for validating the debugging framework
 * and ensuring infinite render loops are properly identified and prevented.
 */

import { describe, test, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { reviewStepDebugger, useReviewStepDebugger, DebugUtils } from '../utils/review-step-debugger';

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1024 * 1024 * 50 // 50MB
  }
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

describe('ReviewStep Infinite Render Loop Debugging', () => {
  beforeEach(() => {
    // Enable debugging for tests
    reviewStepDebugger.enable({
      maxHistorySize: 100,
      enableMemoryTracking: true,
      enableStackTraces: false
    });
    
    // Reset mocks
    vi.clearAllMocks();
    mockPerformance.now.mockImplementation(() => Date.now());
  });

  afterEach(() => {
    // Clean up after each test
    reviewStepDebugger.disable();
    delete (global as any).window;
  });

  describe('Render Cycle Tracking', () => {
    test('should track individual render cycles', () => {
      const dependencies = {
        sessionId: 'test-session',
        configInputFile: '/test/video.mp4',
        isLoading: false
      };

      reviewStepDebugger.trackRenderCycle('ReviewStep', dependencies, ['config.inputFile changed']);

      const report = reviewStepDebugger.generateReport();
      expect(report.summary.totalRenders).toBe(1);
      expect(report.renderAnalysis.ReviewStep.totalRenders).toBe(1);
    });

    test('should detect infinite render loops', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate rapid renders within short time window
      const baseTime = Date.now();
      mockPerformance.now.mockImplementation(() => baseTime);

      for (let i = 0; i < 12; i++) {
        reviewStepDebugger.trackRenderCycle('ReviewStep', {
          sessionId: `session-${i}`,
          renderCount: i + 1
        });
        
        // Advance time by small increments (total < 5 seconds)
        mockPerformance.now.mockImplementation(() => baseTime + (i * 300));
      }

      // Should detect infinite loop after 10 renders in 5 seconds
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFINITE RENDER LOOP DETECTED'),
        expect.objectContaining({
          component: 'ReviewStep',
          renderCount: 10
        })
      );

      consoleSpy.mockRestore();
    });

    test('should track memory usage during renders', () => {
      const initialMemory = 1024 * 1024 * 50; // 50MB
      const increasedMemory = 1024 * 1024 * 75; // 75MB

      mockPerformance.memory.usedJSHeapSize = initialMemory;
      reviewStepDebugger.trackRenderCycle('ReviewStep', { test: 'initial' });

      mockPerformance.memory.usedJSHeapSize = increasedMemory;
      reviewStepDebugger.trackRenderCycle('ReviewStep', { test: 'increased' });

      const report = reviewStepDebugger.generateReport();
      expect(report.memoryAnalysis.available).toBe(true);
      expect(report.memoryAnalysis.min).toBe(initialMemory);
      expect(report.memoryAnalysis.max).toBe(increasedMemory);
    });
  });

  describe('State Change Tracking', () => {
    test('should track config updates', () => {
      reviewStepDebugger.trackStateChange(
        'app-store',
        'config',
        '/old/video.mp4',
        '/new/video.mp4',
        'user-upload'
      );

      const report = reviewStepDebugger.generateReport();
      expect(report.stateChangeAnalysis.bySource['app-store']).toBe(1);
      expect(report.stateChangeAnalysis.byType.config).toBe(1);
    });

    test('should track session state changes', () => {
      reviewStepDebugger.trackStateChange(
        'subtitle-edit-store',
        'session',
        null,
        { sessionId: 'new-session' },
        'initialization'
      );

      const report = reviewStepDebugger.generateReport();
      expect(report.stateChangeAnalysis.byType.session).toBe(1);
      expect(report.stateChangeAnalysis.byTrigger.initialization).toBe(1);
    });

    test('should identify significant state changes', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Significant change: different types
      reviewStepDebugger.trackStateChange(
        'test-store',
        'config',
        null,
        { data: 'new' },
        'test'
      );

      // Significant change: array length difference
      reviewStepDebugger.trackStateChange(
        'test-store',
        'config',
        [1, 2, 3],
        [1, 2, 3, 4],
        'test'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Significant state change'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Component Interaction Mapping', () => {
    test('should create comprehensive interaction map', () => {
      const map = reviewStepDebugger.createComponentInteractionMap();

      expect(map.componentName).toBe('ReviewStep');
      expect(map.dependencies.stores).toContain('useAppStore');
      expect(map.dependencies.stores).toContain('useSubtitleEditStore');
      expect(map.dependencies.hooks).toContain('useSubtitleTempStorage');
      expect(map.children).toContain('VideoPreviewSection');
      expect(map.children).toContain('SubtitleEditor');
    });

    test('should identify critical effect dependencies', () => {
      const map = reviewStepDebugger.createComponentInteractionMap();
      
      // Find the problematic 17-dependency useEffect
      const criticalEffect = map.effects.find(effect => 
        effect.dependencies.includes('config.*') && 
        effect.stableRefs === false
      );

      expect(criticalEffect).toBeDefined();
      expect(criticalEffect?.cleanup).toBe(true);
      expect(criticalEffect?.stableRefs).toBe(false);
    });
  });

  describe('Render Propagation Tracing', () => {
    test('should trace JSON import propagation', () => {
      const trace = reviewStepDebugger.traceRenderPropagation('json_import');

      expect(trace.sequence).toContain('JSON Upload Event');
      expect(trace.sequence).toContain('INFINITE LOOP: Steps 5-8 repeat indefinitely');
      expect(trace.estimatedDuration).toBeGreaterThan(2000);
      expect(trace.criticalPath).toContain('updateConfig()');
      expect(trace.criticalPath).toContain('stableInitializeSession()');
    });

    test('should trace config change propagation', () => {
      const trace = reviewStepDebugger.traceRenderPropagation('config_change');

      expect(trace.sequence).toContain('User action triggers config update');
      expect(trace.sequence).toContain('Session reset logic executes');
      expect(trace.criticalPath).toContain('updateConfig()');
    });

    test('should trace session reset propagation', () => {
      const trace = reviewStepDebugger.traceRenderPropagation('session_reset');

      expect(trace.sequence).toContain('Session reset triggered');
      expect(trace.sequence).toContain('New session creation');
      expect(trace.criticalPath).toContain('resetSessionForNewContent()');
    });
  });

  describe('useReviewStepDebugger Hook', () => {
    test('should provide render tracking functionality', () => {
      const { result } = renderHook(() => useReviewStepDebugger('TestComponent'));

      act(() => {
        result.current.trackRender({ test: 'dependency' }, ['state changed']);
      });

      expect(result.current.renderCount).toBe(1);

      const report = reviewStepDebugger.generateReport();
      expect(report.renderAnalysis.TestComponent.totalRenders).toBe(1);
    });

    test('should provide state change tracking', () => {
      const { result } = renderHook(() => useReviewStepDebugger());

      act(() => {
        result.current.trackStateChange(
          'test-source',
          'config',
          'old-value',
          'new-value',
          'test-trigger'
        );
      });

      const report = reviewStepDebugger.generateReport();
      expect(report.stateChangeAnalysis.bySource['test-source']).toBe(1);
    });
  });

  describe('Memory Leak Detection', () => {
    test('should detect memory leaks', () => {
      const memoryValues = [
        1024 * 1024 * 50,  // 50MB
        1024 * 1024 * 60,  // 60MB
        1024 * 1024 * 70,  // 70MB
        1024 * 1024 * 80,  // 80MB
        1024 * 1024 * 90   // 90MB - 80% growth indicates leak
      ];

      memoryValues.forEach((memory, index) => {
        mockPerformance.memory.usedJSHeapSize = memory;
        reviewStepDebugger.trackRenderCycle('ReviewStep', { iteration: index });
      });

      const report = reviewStepDebugger.generateReport();
      expect(report.memoryAnalysis.leakSuspected).toBe(true);
      expect(report.memoryAnalysis.trend).toBe('increasing');
    });

    test('should not flag stable memory usage as leak', () => {
      const stableMemory = 1024 * 1024 * 50; // 50MB stable

      for (let i = 0; i < 10; i++) {
        mockPerformance.memory.usedJSHeapSize = stableMemory + (Math.random() * 1024 * 100); // Small variations
        reviewStepDebugger.trackRenderCycle('ReviewStep', { iteration: i });
      }

      const report = reviewStepDebugger.generateReport();
      expect(report.memoryAnalysis.leakSuspected).toBe(false);
      expect(report.memoryAnalysis.trend).toBe('stable');
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive reports', () => {
      // Generate some test data
      reviewStepDebugger.trackRenderCycle('ReviewStep', { test: 1 });
      reviewStepDebugger.trackRenderCycle('ReviewStep', { test: 2 });
      reviewStepDebugger.trackStateChange('app-store', 'config', 'old', 'new', 'test');

      const report = reviewStepDebugger.generateReport();

      expect(report.summary.totalComponents).toBe(1);
      expect(report.summary.totalRenders).toBe(2);
      expect(report.summary.totalStateChanges).toBe(1);
      expect(report.renderAnalysis.ReviewStep).toBeDefined();
      expect(report.stateChangeAnalysis.bySource['app-store']).toBe(1);
    });

    test('should provide actionable recommendations', () => {
      // Simulate excessive renders
      for (let i = 0; i < 60; i++) {
        reviewStepDebugger.trackRenderCycle('ReviewStep', { iteration: i });
      }

      // Simulate excessive config changes
      for (let i = 0; i < 25; i++) {
        reviewStepDebugger.trackStateChange('app-store', 'config', i, i + 1, 'test');
      }

      const report = reviewStepDebugger.generateReport();
      
      expect(report.recommendations).toContain(
        expect.stringContaining('Reduce render frequency')
      );
      expect(report.recommendations).toContain(
        expect.stringContaining('Reduce config update frequency')
      );
    });
  });

  describe('Development Utilities', () => {
    test('should enable debugging in development mode', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Mock window object
      const mockWindow = { debugReviewStep: undefined };
      (global as any).window = mockWindow;

      DebugUtils.enableInDevelopment();

      expect(mockWindow.debugReviewStep).toBeDefined();
      expect(mockWindow.debugReviewStep.generateReport).toBeTypeOf('function');
      expect(mockWindow.debugReviewStep.exportData).toBeTypeOf('function');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    test('should not enable debugging in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockWindow = { debugReviewStep: undefined };
      (global as any).window = mockWindow;

      DebugUtils.enableInDevelopment();

      expect(mockWindow.debugReviewStep).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge Case Scenarios', () => {
    test('should handle rapid workspace switching', async () => {
      const workspaces = ['workspace-1', 'workspace-2', 'workspace-3'];
      
      // Simulate rapid workspace changes
      workspaces.forEach((workspaceId, index) => {
        reviewStepDebugger.trackStateChange(
          'workspace-store',
          'workspace',
          workspaces[index - 1] || null,
          workspaceId,
          'user-switch'
        );
        
        reviewStepDebugger.trackRenderCycle('ReviewStep', {
          currentWorkspaceId: workspaceId,
          switchIndex: index
        });
      });

      const report = reviewStepDebugger.generateReport();
      expect(report.stateChangeAnalysis.byType.workspace).toBe(3);
      expect(report.summary.totalRenders).toBe(3);
    });

    test('should handle concurrent JSON imports', () => {
      const imports = [
        { file: 'import1.json', data: [1, 2, 3] },
        { file: 'import2.json', data: [4, 5, 6] },
        { file: 'import3.json', data: [7, 8, 9] }
      ];

      imports.forEach((importData, index) => {
        reviewStepDebugger.trackStateChange(
          'app-store',
          'config',
          index > 0 ? imports[index - 1].file : null,
          importData.file,
          'json-import'
        );

        reviewStepDebugger.trackRenderCycle('ReviewStep', {
          importedJsonFile: importData.file,
          subtitleData: importData.data,
          importIndex: index
        });
      });

      const report = reviewStepDebugger.generateReport();
      expect(report.stateChangeAnalysis.byTrigger['json-import']).toBe(3);
    });

    test('should handle error recovery scenarios', () => {
      // Simulate initialization failure
      reviewStepDebugger.trackStateChange(
        'subtitle-edit-store',
        'session',
        null,
        'INITIALIZATION_FAILED',
        'session-init-error'
      );

      // Simulate circuit breaker activation
      reviewStepDebugger.trackRenderCycle('ReviewStep', {
        circuitBreakerActive: true,
        failureCount: 4,
        lastFailure: Date.now()
      });

      // Simulate recovery attempt
      reviewStepDebugger.trackStateChange(
        'subtitle-edit-store',
        'session',
        'INITIALIZATION_FAILED',
        { sessionId: 'recovered-session' },
        'circuit-breaker-recovery'
      );

      const report = reviewStepDebugger.generateReport();
      expect(report.stateChangeAnalysis.byTrigger['session-init-error']).toBe(1);
      expect(report.stateChangeAnalysis.byTrigger['circuit-breaker-recovery']).toBe(1);
    });
  });

  describe('Performance Test Scenarios', () => {
    test('should create performance test utilities', () => {
      const testUtils = DebugUtils.createPerformanceTest();

      expect(testUtils.simulateJsonImport).toBeTypeOf('function');
      expect(testUtils.simulateRapidConfigChanges).toBeTypeOf('function');
      expect(testUtils.simulateWorkspaceSwitching).toBeTypeOf('function');
    });

    test('should measure render performance impact', () => {
      const startTime = Date.now();
      mockPerformance.now.mockImplementation(() => startTime);

      // Simulate performance-heavy render cycle
      reviewStepDebugger.trackRenderCycle('ReviewStep', {
        heavyComputation: true,
        dataSize: 10000
      });

      const endTime = startTime + 2500; // 2.5 second render
      mockPerformance.now.mockImplementation(() => endTime);

      const report = reviewStepDebugger.generateReport();
      expect(report.renderAnalysis.ReviewStep.totalRenders).toBe(1);
      
      // Should recommend optimization for slow renders
      if (report.recommendations.length > 0) {
        expect(report.recommendations.some(rec => 
          rec.includes('render') || rec.includes('performance')
        )).toBe(true);
      }
    });
  });

  describe('Data Export and Analysis', () => {
    test('should export debugging data for external analysis', () => {
      // Generate test data
      reviewStepDebugger.trackRenderCycle('ReviewStep', { test: 'export' });
      reviewStepDebugger.trackStateChange('test-store', 'config', 'old', 'new', 'export-test');

      const exportData = reviewStepDebugger.exportData();

      expect(exportData.renderCycles.ReviewStep).toBeDefined();
      expect(exportData.stateChanges).toHaveLength(1);
      expect(exportData.metadata.exportTimestamp).toBeTypeOf('number');
      expect(exportData.metadata.debuggerVersion).toBeDefined();
    });

    test('should maintain data integrity during export', () => {
      const originalData = {
        component: 'TestComponent',
        dependencies: { test: 'value' },
        stateChanges: ['change1', 'change2']
      };

      reviewStepDebugger.trackRenderCycle(
        originalData.component,
        originalData.dependencies,
        originalData.stateChanges
      );

      const exportData = reviewStepDebugger.exportData();
      const exportedRender = exportData.renderCycles[originalData.component][0];

      expect(exportedRender.componentName).toBe(originalData.component);
      expect(exportedRender.dependencies).toEqual(originalData.dependencies);
      expect(exportedRender.stateChanges).toEqual(originalData.stateChanges);
    });
  });
});

/**
 * Integration Tests for Real-World Scenarios
 */
describe('ReviewStep Integration Debugging', () => {
  beforeEach(() => {
    reviewStepDebugger.enable({ maxHistorySize: 200 });
  });

  afterEach(() => {
    reviewStepDebugger.disable();
  });

  test('should simulate full JSON import workflow', async () => {
    // Step 1: Initial state
    reviewStepDebugger.trackRenderCycle('ReviewStep', {
      session: null,
      isLoading: false,
      currentWorkspaceId: 'workspace-1'
    });

    // Step 2: JSON file upload
    reviewStepDebugger.trackStateChange(
      'app-store',
      'config',
      null,
      '/path/to/subtitles.json',
      'file-upload'
    );

    // Step 3: Config change triggers session reset
    reviewStepDebugger.trackStateChange(
      'subtitle-edit-store', 
      'session',
      { sessionId: 'old-session' },
      null,
      'session-reset-for-import'
    );

    // Step 4: Component re-renders due to config change
    reviewStepDebugger.trackRenderCycle('ReviewStep', {
      session: null,
      isLoading: false,
      currentWorkspaceId: 'workspace-1',
      'config.importedJsonFile': '/path/to/subtitles.json'
    });

    // Step 5: Session initialization triggered
    reviewStepDebugger.trackStateChange(
      'subtitle-edit-store',
      'session',
      null,
      { sessionId: 'new-session-from-json' },
      'json-import-initialization'
    );

    // Step 6: Component re-renders due to session creation
    reviewStepDebugger.trackRenderCycle('ReviewStep', {
      session: { sessionId: 'new-session-from-json' },
      isLoading: false,
      currentWorkspaceId: 'workspace-1',
      'config.importedJsonFile': '/path/to/subtitles.json'
    });

    const report = reviewStepDebugger.generateReport();
    const trace = reviewStepDebugger.traceRenderPropagation('json_import');

    expect(report.summary.totalRenders).toBe(3);
    expect(report.summary.totalStateChanges).toBe(3);
    expect(trace.sequence).toContain('JSON Upload Event');
    expect(report.stateChangeAnalysis.byTrigger['file-upload']).toBe(1);
    expect(report.stateChangeAnalysis.byTrigger['json-import-initialization']).toBe(1);
  });

  test('should detect and prevent infinite loop in JSON import', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockWindow = { __DISABLE_AUTO_INITIALIZATION__: false };
    (global as any).window = mockWindow;

    const baseTime = Date.now();
    mockPerformance.now.mockImplementation(() => baseTime);

    // Simulate the infinite loop scenario
    for (let i = 0; i < 15; i++) {
      // Each render triggers the next one
      reviewStepDebugger.trackRenderCycle('ReviewStep', {
        session: i % 2 === 0 ? null : { sessionId: `session-${i}` },
        renderLoop: true,
        iteration: i
      });

      // Advance time slightly (rapid renders)
      mockPerformance.now.mockImplementation(() => baseTime + (i * 200));
    }

    // Should detect infinite loop and set prevention flag
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('INFINITE RENDER LOOP DETECTED'),
      expect.any(Object)
    );
    expect(mockWindow.__DISABLE_AUTO_INITIALIZATION__).toBe(true);

    consoleSpy.mockRestore();
  });
});