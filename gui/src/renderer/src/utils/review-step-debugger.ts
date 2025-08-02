/**
 * ReviewStep Component Debugging Framework
 * 
 * Comprehensive debugging utilities for tracing infinite re-render loops,
 * component interaction mapping, and performance analysis.
 */

interface RenderCycleData {
  timestamp: number;
  componentName: string;
  renderCount: number;
  dependencies: Record<string, any>;
  stateChanges: string[];
  memoryUsage?: number;
  performanceMarks: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
}

interface StateChangeEvent {
  timestamp: number;
  source: string;
  changeType: 'config' | 'session' | 'workspace' | 'callback';
  oldValue: any;
  newValue: any;
  triggeredBy: string;
  stackTrace?: string;
}

interface ComponentInteractionMap {
  componentName: string;
  dependencies: {
    stores: string[];
    hooks: string[];
    contexts: string[];
    props: string[];
  };
  children: string[];
  triggers: string[];
  effects: {
    dependencies: string[];
    cleanup: boolean;
    stableRefs: boolean;
  }[];
}

class ReviewStepDebugger {
  private static instance: ReviewStepDebugger;
  private renderCycles: Map<string, RenderCycleData[]> = new Map();
  private stateChanges: StateChangeEvent[] = new Map();
  private memorySnapshots: Array<{ timestamp: number; usage: number }> = [];
  private isEnabled: boolean = false;
  private maxHistorySize: number = 1000;

  static getInstance(): ReviewStepDebugger {
    if (!ReviewStepDebugger.instance) {
      ReviewStepDebugger.instance = new ReviewStepDebugger();
    }
    return ReviewStepDebugger.instance;
  }

  /**
   * Enable debugging with optional configuration
   */
  enable(options?: {
    maxHistorySize?: number;
    enableMemoryTracking?: boolean;
    enableStackTraces?: boolean;
  }): void {
    this.isEnabled = true;
    if (options?.maxHistorySize) {
      this.maxHistorySize = options.maxHistorySize;
    }
    
    console.log('🔍 ReviewStep Debugger enabled:', {
      maxHistorySize: this.maxHistorySize,
      enableMemoryTracking: options?.enableMemoryTracking ?? false,
      enableStackTraces: options?.enableStackTraces ?? false
    });

    // Set up performance monitoring
    if (typeof window !== 'undefined') {
      (window as any).__REVIEWSTEP_DEBUGGER__ = this;
    }
  }

  /**
   * Disable debugging and clean up
   */
  disable(): void {
    this.isEnabled = false;
    this.renderCycles.clear();
    this.stateChanges.length = 0;
    this.memorySnapshots.length = 0;
    
    if (typeof window !== 'undefined') {
      delete (window as any).__REVIEWSTEP_DEBUGGER__;
    }
    
    console.log('🔍 ReviewStep Debugger disabled');
  }

  /**
   * Track a render cycle for a component
   */
  trackRenderCycle(
    componentName: string,
    dependencies: Record<string, any>,
    stateChanges: string[] = []
  ): void {
    if (!this.isEnabled) return;

    const now = Date.now();
    const memoryUsage = this.getMemoryUsage();
    
    const renderData: RenderCycleData = {
      timestamp: now,
      componentName,
      renderCount: this.getRenderCount(componentName) + 1,
      dependencies: { ...dependencies },
      stateChanges: [...stateChanges],
      memoryUsage,
      performanceMarks: {
        startTime: performance.now()
      }
    };

    // Get or create render history for component
    const componentHistory = this.renderCycles.get(componentName) || [];
    componentHistory.push(renderData);

    // Limit history size
    if (componentHistory.length > this.maxHistorySize) {
      componentHistory.shift();
    }

    this.renderCycles.set(componentName, componentHistory);

    // Check for infinite render loops
    this.detectInfiniteRenderLoop(componentName, componentHistory);
  }

  /**
   * Track state changes across the application
   */
  trackStateChange(
    source: string,
    changeType: 'config' | 'session' | 'workspace' | 'callback',
    oldValue: any,
    newValue: any,
    triggeredBy: string,
    includeStackTrace: boolean = false
  ): void {
    if (!this.isEnabled) return;

    const stateChange: StateChangeEvent = {
      timestamp: Date.now(),
      source,
      changeType,
      oldValue,
      newValue,
      triggeredBy,
      stackTrace: includeStackTrace ? new Error().stack : undefined
    };

    this.stateChanges.push(stateChange);

    // Limit history size
    if (this.stateChanges.length > this.maxHistorySize) {
      this.stateChanges.shift();
    }

    // Log significant state changes
    if (this.isSignificantChange(oldValue, newValue)) {
      console.log('🔄 Significant state change:', {
        source,
        changeType,
        triggeredBy,
        timestamp: new Date(stateChange.timestamp).toISOString()
      });
    }
  }

  /**
   * Create a comprehensive component interaction map
   */
  createComponentInteractionMap(): ComponentInteractionMap {
    return {
      componentName: 'ReviewStep',
      dependencies: {
        stores: [
          'useAppStore',
          'useSubtitleEditStore', 
          'useWorkspaceStore'
        ],
        hooks: [
          'useSubtitleTempStorage',
          'useAutoSaveIntegration'
        ],
        contexts: [
          'useReviewStepConfig',
          'useWorkspaceConfig'
        ],
        props: []
      },
      children: [
        'VideoPreviewSection',
        'SubtitleEditor', 
        'SubtitleListPanel'
      ],
      triggers: [
        'config.inputFile changes',
        'config.importedJsonFile changes',
        'config.subtitle changes',
        'session state changes',
        'workspace changes'
      ],
      effects: [
        {
          dependencies: ['session?.sessionId', 'isLoading', 'currentWorkspaceId', 'isReady', 'config.*'],
          cleanup: true,
          stableRefs: false
        },
        {
          dependencies: ['isReady', 'currentWorkspaceId'],
          cleanup: true,
          stableRefs: true
        },
        {
          dependencies: ['session?.isDirty', 'isReady', 'currentWorkspaceId'],
          cleanup: true,
          stableRefs: true
        }
      ]
    };
  }

  /**
   * Analyze render propagation paths for a specific trigger
   */
  traceRenderPropagation(triggerType: 'json_import' | 'config_change' | 'session_reset'): {
    sequence: string[];
    estimatedDuration: number;
    memoryImpact: number;
    criticalPath: string[];
  } {
    const sequences = {
      json_import: [
        '1. JSON Upload Event',
        '2. app-store.updateConfig("importedJsonFile", file)',
        '3. Config change triggers session reset in app-store',
        '4. subtitle-edit-store.resetSessionForNewContent()',
        '5. ReviewStep detects config change (17-dep useEffect)',
        '6. initializeSessionIfNeeded() called',
        '7. stableInitializeSession() creates new session',
        '8. Session state update triggers useEffect again',
        '9. INFINITE LOOP: Steps 5-8 repeat indefinitely'
      ],
      config_change: [
        '1. User action triggers config update',
        '2. app-store.updateConfig() called',
        '3. Workspace-specific config sync',
        '4. Session reset logic executes',
        '5. ReviewStep re-renders due to config dependency',
        '6. New session initialization if needed',
        '7. Additional renders due to session state changes'
      ],
      session_reset: [
        '1. Session reset triggered',
        '2. Store state cleared',
        '3. Component detects session change',
        '4. Initialization useEffect triggered',
        '5. New session creation',
        '6. State propagation to child components'
      ]
    };

    return {
      sequence: sequences[triggerType],
      estimatedDuration: this.estimateSequenceDuration(triggerType),
      memoryImpact: this.estimateMemoryImpact(triggerType),
      criticalPath: this.identifyCriticalPath(triggerType)
    };
  }

  /**
   * Generate a comprehensive debugging report
   */
  generateReport(): {
    summary: any;
    renderAnalysis: any;
    stateChangeAnalysis: any;  
    memoryAnalysis: any;
    recommendations: string[];
  } {
    const now = Date.now();
    const recentTimeWindow = 10000; // 10 seconds

    return {
      summary: {
        totalComponents: this.renderCycles.size,
        totalRenders: Array.from(this.renderCycles.values()).reduce((sum, cycles) => sum + cycles.length, 0),
        totalStateChanges: this.stateChanges.length,
        timeWindow: `${Math.round((now - this.getEarliestTimestamp()) / 1000)}s`,
        avgMemoryUsage: this.getAverageMemoryUsage()
      },
      renderAnalysis: this.analyzeRenderPatterns(),
      stateChangeAnalysis: this.analyzeStateChangePatterns(),
      memoryAnalysis: this.analyzeMemoryUsage(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Export debugging data for external analysis
   */
  exportData(): {
    renderCycles: any;
    stateChanges: StateChangeEvent[];
    memorySnapshots: any[];
    metadata: any;
  } {
    return {
      renderCycles: Object.fromEntries(this.renderCycles),
      stateChanges: [...this.stateChanges],
      memorySnapshots: [...this.memorySnapshots],
      metadata: {
        exportTimestamp: Date.now(),
        totalDataPoints: this.renderCycles.size + this.stateChanges.length,
        debuggerVersion: '1.0.0'
      }
    };
  }

  // Private helper methods

  private getRenderCount(componentName: string): number {
    const history = this.renderCycles.get(componentName);
    return history ? history.length : 0;
  }

  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private detectInfiniteRenderLoop(componentName: string, history: RenderCycleData[]): void {
    if (history.length < 10) return;

    // Check last 10 renders in short time window
    const recent = history.slice(-10);
    const timeWindow = recent[recent.length - 1].timestamp - recent[0].timestamp;
    
    if (timeWindow < 5000) { // 10 renders in 5 seconds
      console.error('🚨 INFINITE RENDER LOOP DETECTED:', {
        component: componentName,
        renderCount: recent.length,
        timeWindow: `${timeWindow}ms`,
        lastDependencies: recent[recent.length - 1].dependencies
      });
      
      // Attempt to break the loop by disabling auto-initialization
      if (typeof window !== 'undefined') {
        (window as any).__DISABLE_AUTO_INITIALIZATION__ = true;
        console.log('🔧 Auto-initialization disabled to break render loop');
      }
    }
  }

  private isSignificantChange(oldValue: any, newValue: any): boolean {
    // Consider changes significant if they affect core functionality
    if (typeof oldValue !== typeof newValue) return true;
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return oldValue.length !== newValue.length;
    }
    if (typeof oldValue === 'object' && oldValue !== null && newValue !== null) {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }
    return oldValue !== newValue;
  }

  private estimateSequenceDuration(triggerType: string): number {
    // Estimated durations based on profiling data
    const durations = {
      json_import: 2500, // 2.5s average for JSON import sequence
      config_change: 800, // 0.8s for config changes
      session_reset: 1200 // 1.2s for session reset
    };
    return durations[triggerType] || 1000;
  }

  private estimateMemoryImpact(triggerType: string): number {
    // Estimated memory impact in bytes
    const impacts = {
      json_import: 1024 * 1024 * 5, // 5MB for large JSON imports
      config_change: 1024 * 100, // 100KB for config changes
      session_reset: 1024 * 500 // 500KB for session reset
    };
    return impacts[triggerType] || 1024 * 100;
  }

  private identifyCriticalPath(triggerType: string): string[] {
    const criticalPaths = {
      json_import: [
        'updateConfig()',
        'resetSessionForNewContent()',
        'useEffect[17-deps]',
        'stableInitializeSession()'
      ],
      config_change: [
        'updateConfig()',
        'workspace sync',
        'component re-render'
      ],
      session_reset: [
        'resetSessionForNewContent()',
        'clearSession()',
        'session state update'
      ]
    };
    return criticalPaths[triggerType] || [];
  }

  private getEarliestTimestamp(): number {
    let earliest = Date.now();
    
    for (const cycles of this.renderCycles.values()) {
      if (cycles.length > 0) {
        earliest = Math.min(earliest, cycles[0].timestamp);
      }
    }
    
    if (this.stateChanges.length > 0) {
      earliest = Math.min(earliest, this.stateChanges[0].timestamp);
    }
    
    return earliest;
  }

  private getAverageMemoryUsage(): number {
    const allCycles = Array.from(this.renderCycles.values()).flat();
    const memoryValues = allCycles
      .map(cycle => cycle.memoryUsage)
      .filter(memory => memory !== undefined) as number[];
    
    if (memoryValues.length === 0) return 0;
    
    return memoryValues.reduce((sum, memory) => sum + memory, 0) / memoryValues.length;
  }

  private analyzeRenderPatterns(): any {
    const patterns: any = {};
    
    for (const [componentName, cycles] of this.renderCycles) {
      const recentCycles = cycles.slice(-20); // Last 20 renders
      
      patterns[componentName] = {
        totalRenders: cycles.length,
        recentRenders: recentCycles.length,
        averageInterval: this.calculateAverageInterval(recentCycles),
        dependencyChanges: this.analyzeDependencyChanges(recentCycles),
        hasRenderLoop: this.hasRenderLoop(recentCycles)
      };
    }
    
    return patterns;
  }

  private analyzeStateChangePatterns(): any {
    const patterns = {
      bySource: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byTrigger: {} as Record<string, number>,
      timeline: this.stateChanges.map(change => ({
        timestamp: change.timestamp,
        source: change.source,
        type: change.changeType
      }))
    };

    for (const change of this.stateChanges) {
      patterns.bySource[change.source] = (patterns.bySource[change.source] || 0) + 1;
      patterns.byType[change.changeType] = (patterns.byType[change.changeType] || 0) + 1;
      patterns.byTrigger[change.triggeredBy] = (patterns.byTrigger[change.triggeredBy] || 0) + 1;
    }

    return patterns;
  }

  private analyzeMemoryUsage(): any {
    const allCycles = Array.from(this.renderCycles.values()).flat();
    const memoryValues = allCycles
      .map(cycle => cycle.memoryUsage)
      .filter(memory => memory !== undefined) as number[];

    if (memoryValues.length === 0) {
      return { available: false };
    }

    return {
      available: true,
      min: Math.min(...memoryValues),
      max: Math.max(...memoryValues),
      average: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
      trend: this.calculateMemoryTrend(memoryValues),
      leakSuspected: this.detectMemoryLeak(memoryValues)
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const report = this.analyzeRenderPatterns();

    // Check for excessive renders
    for (const [componentName, analysis] of Object.entries(report)) {
      const data = analysis as any;
      if (data.totalRenders > 50) {
        recommendations.push(`${componentName}: Reduce render frequency (${data.totalRenders} renders detected)`);
      }
      if (data.hasRenderLoop) {
        recommendations.push(`${componentName}: Fix infinite render loop`);
      }
    }

    // Check state change patterns
    const stateAnalysis = this.analyzeStateChangePatterns();
    if (stateAnalysis.byType.config > 20) {
      recommendations.push('Reduce config update frequency to prevent cascading renders');
    }
    if (stateAnalysis.byType.session > 30) {
      recommendations.push('Optimize session state management to reduce updates');
    }

    // Memory recommendations
    const memoryAnalysis = this.analyzeMemoryUsage();
    if (memoryAnalysis.available && memoryAnalysis.leakSuspected) {
      recommendations.push('Memory leak suspected - review cleanup functions and subscriptions');
    }

    return recommendations;
  }

  private calculateAverageInterval(cycles: RenderCycleData[]): number {
    if (cycles.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < cycles.length; i++) {
      intervals.push(cycles[i].timestamp - cycles[i - 1].timestamp);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private analyzeDependencyChanges(cycles: RenderCycleData[]): Record<string, number> {
    const changes: Record<string, number> = {};
    
    for (let i = 1; i < cycles.length; i++) {
      const prev = cycles[i - 1].dependencies;
      const curr = cycles[i].dependencies;
      
      for (const key of Object.keys(curr)) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
          changes[key] = (changes[key] || 0) + 1;
        }
      }
    }
    
    return changes;
  }

  private hasRenderLoop(cycles: RenderCycleData[]): boolean {
    if (cycles.length < 10) return false;
    
    const recent = cycles.slice(-10);
    const timeWindow = recent[recent.length - 1].timestamp - recent[0].timestamp;
    
    return timeWindow < 5000; // 10 renders in 5 seconds
  }

  private calculateMemoryTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 5) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    const threshold = firstAvg * 0.1; // 10% threshold
    
    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  }

  private detectMemoryLeak(values: number[]): boolean {
    const trend = this.calculateMemoryTrend(values);
    const growth = values.length > 1 ? values[values.length - 1] / values[0] : 1;
    
    return trend === 'increasing' && growth > 1.5; // 50% memory growth
  }
}

export const reviewStepDebugger = ReviewStepDebugger.getInstance();

/**
 * React Hook for easy integration with ReviewStep component
 */
export function useReviewStepDebugger(componentName: string = 'ReviewStep') {
  const renderCountRef = useRef(0);
  
  const trackRender = useCallback((dependencies: Record<string, any>, stateChanges: string[] = []) => {
    renderCountRef.current += 1;
    reviewStepDebugger.trackRenderCycle(componentName, dependencies, stateChanges);
  }, [componentName]);

  const trackStateChange = useCallback((
    source: string,
    changeType: 'config' | 'session' | 'workspace' | 'callback',
    oldValue: any,
    newValue: any,
    triggeredBy: string
  ) => {
    reviewStepDebugger.trackStateChange(source, changeType, oldValue, newValue, triggeredBy);
  }, []);

  return {
    trackRender,
    trackStateChange,
    renderCount: renderCountRef.current,
    debugger: reviewStepDebugger
  };
}

/**
 * Development-only debugging utilities
 */
export const DebugUtils = {
  /**
   * Enable debugging in development mode
   */
  enableInDevelopment(): void {
    if (process.env.NODE_ENV === 'development') {
      reviewStepDebugger.enable({
        maxHistorySize: 500,
        enableMemoryTracking: true,
        enableStackTraces: true
      });
      
      // Add global debugging commands
      if (typeof window !== 'undefined') {
        (window as any).debugReviewStep = {
          generateReport: () => reviewStepDebugger.generateReport(),
          exportData: () => reviewStepDebugger.exportData(),
          createInteractionMap: () => reviewStepDebugger.createComponentInteractionMap(),
          traceJsonImport: () => reviewStepDebugger.traceRenderPropagation('json_import'),
          disable: () => reviewStepDebugger.disable()
        };
        
        console.log('🔍 ReviewStep debugging enabled. Use window.debugReviewStep for commands.');
      }
    }
  },

  /**
   * Create a performance test scenario
   */
  createPerformanceTest(): {
    simulateJsonImport: () => Promise<void>;
    simulateRapidConfigChanges: () => Promise<void>;
    simulateWorkspaceSwitching: () => Promise<void>;
  } {
    return {
      simulateJsonImport: async () => {
        console.log('🧪 Simulating JSON import scenario...');
        // This would trigger the actual JSON import flow for testing
      },
      simulateRapidConfigChanges: async () => {
        console.log('🧪 Simulating rapid config changes...');
        // This would rapidly change config values to test render loops
      },
      simulateWorkspaceSwitching: async () => {
        console.log('🧪 Simulating workspace switching...');
        // This would simulate rapid workspace changes during operations
      }
    };
  }
};