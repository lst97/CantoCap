/**
 * Debug Integration Example
 * 
 * Practical example showing how to integrate the debugging framework
 * with the ReviewStep component to track and prevent infinite render loops.
 */

import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { useReviewStepDebugger, DebugUtils } from './review-step-debugger';

// Enable debugging in development
if (process.env.NODE_ENV === 'development') {
  DebugUtils.enableInDevelopment();
}

/**
 * Example of integrating debugging hooks into ReviewStep component
 */
export const ReviewStepWithDebugging: React.FC = () => {
  // Initialize debugging hook
  const { trackRender, trackStateChange } = useReviewStepDebugger('ReviewStep');
  
  // Example store hooks (replace with actual hooks)
  const { config } = useAppStore();
  const { session, isLoading, initializeSession } = useSubtitleEditStore();
  const { currentWorkspaceId } = useWorkspaceConfig();
  
  // Track previous values to detect changes
  const prevValuesRef = useRef({
    sessionId: null as string | null,
    configInputFile: null as string | null,
    currentWorkspaceId: null as string | null,
    isLoading: false
  });

  // Create stable references to prevent infinite loops
  const stableInitializeSession = useCallback(
    async (subtitlePath: string, videoPath: string, workspaceId: string) => {
      // Track the function call
      trackStateChange(
        'subtitle-edit-store',
        'session',
        null,
        'initializing',
        'stableInitializeSession-call'
      );

      try {
        await initializeSession(subtitlePath, videoPath, workspaceId);
        
        trackStateChange(
          'subtitle-edit-store',
          'session',
          'initializing',
          'initialized',
          'stableInitializeSession-success'
        );
      } catch (error) {
        trackStateChange(
          'subtitle-edit-store',
          'session',
          'initializing',
          'error',
          'stableInitializeSession-error'
        );
        throw error;
      }
    },
    [initializeSession, trackStateChange] // Minimal, stable dependencies
  );

  // CRITICAL: Track the problematic 17-dependency useEffect
  useEffect(() => {
    // Detect changes in dependencies
    const currentValues = {
      sessionId: session?.sessionId || null,
      configInputFile: config.inputFile || null,
      currentWorkspaceId,
      isLoading
    };

    const stateChanges = [];
    const prevValues = prevValuesRef.current;

    if (prevValues.sessionId !== currentValues.sessionId) {
      stateChanges.push(`session.sessionId: ${prevValues.sessionId} → ${currentValues.sessionId}`);
    }
    if (prevValues.configInputFile !== currentValues.configInputFile) {
      stateChanges.push(`config.inputFile: ${prevValues.configInputFile} → ${currentValues.configInputFile}`);
    }
    if (prevValues.currentWorkspaceId !== currentValues.currentWorkspaceId) {
      stateChanges.push(`currentWorkspaceId: ${prevValues.currentWorkspaceId} → ${currentValues.currentWorkspaceId}`);
    }
    if (prevValues.isLoading !== currentValues.isLoading) {
      stateChanges.push(`isLoading: ${prevValues.isLoading} → ${currentValues.isLoading}`);
    }

    // Track the render with dependency information
    trackRender({
      sessionId: currentValues.sessionId,
      configInputFile: currentValues.configInputFile,
      currentWorkspaceId: currentValues.currentWorkspaceId,
      isLoading: currentValues.isLoading,
      effectName: 'main-initialization-effect',
      dependencyCount: 17 // Actual dependency count
    }, stateChanges);

    // Update previous values for next comparison
    prevValuesRef.current = currentValues;

    // Check if auto-initialization is disabled (infinite loop prevention)
    if (typeof window !== 'undefined' && (window as any).__DISABLE_AUTO_INITIALIZATION__) {
      console.warn('⚠️ Auto-initialization disabled due to infinite loop detection');
      return;
    }

    // Your actual initialization logic here (simplified)
    const initializeIfNeeded = async () => {
      if (!session && !isLoading && currentWorkspaceId && config.inputFile) {
        try {
          await stableInitializeSession(
            config.outputFile || 'default.srt',
            config.inputFile,
            currentWorkspaceId
          );
        } catch (error) {
          console.error('Session initialization failed:', error);
        }
      }
    };

    // Debounce initialization to prevent rapid calls
    const timeoutId = setTimeout(initializeIfNeeded, 150);
    return () => clearTimeout(timeoutId);

  }, [
    // ORIGINAL 17 DEPENDENCIES - track all changes
    session?.sessionId,
    isLoading,
    currentWorkspaceId,
    config.inputFile,
    config.outputFile,
    config.importedJsonFile,
    // ... other dependencies
    stableInitializeSession,
    trackRender
  ]);

  // Track config updates
  const handleConfigUpdate = useCallback((key: string, value: any) => {
    const previousValue = config[key as keyof typeof config];
    
    trackStateChange(
      'app-store',
      'config',
      previousValue,
      value,
      'user-action'
    );

    // Call actual config update
    // updateConfig(key, value);
  }, [config, trackStateChange]);

  // Example: Track workspace changes
  useEffect(() => {
    const previousWorkspaceId = prevValuesRef.current.currentWorkspaceId;
    
    if (previousWorkspaceId !== currentWorkspaceId) {
      trackStateChange(
        'workspace-store',
        'workspace',
        previousWorkspaceId,
        currentWorkspaceId,
        'workspace-switch'
      );
    }
  }, [currentWorkspaceId, trackStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Generate final debug report on unmount
      if (process.env.NODE_ENV === 'development') {
        const report = reviewStepDebugger.generateReport();
        console.log('📊 ReviewStep Debug Report:', report);
        
        if (report.recommendations.length > 0) {
          console.warn('⚠️ Performance Recommendations:', report.recommendations);
        }
      }
    };
  }, []);

  return (
    <div>
      {/* Your actual component JSX */}
      <div>ReviewStep Component Content</div>
      
      {/* Development-only debugging overlay */}
      {process.env.NODE_ENV === 'development' && (
        <DebugOverlay />
      )}
    </div>
  );
};

/**
 * Development debugging overlay component
 */
const DebugOverlay: React.FC = () => {
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);
  const [debugReport, setDebugReport] = React.useState<any>(null);

  const generateReport = useCallback(() => {
    const report = (window as any).debugReviewStep?.generateReport();
    setDebugReport(report);
  }, []);

  if (!showDebugInfo) {
    return (
      <button
        onClick={() => setShowDebugInfo(true)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 9999,
          padding: '8px 12px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px'
        }}
      >
        🔍 Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        width: '300px',
        maxHeight: '400px',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '16px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        overflow: 'auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <strong>ReviewStep Debug</strong>
        <button onClick={() => setShowDebugInfo(false)}>✕</button>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <button onClick={generateReport} style={{ marginRight: '8px' }}>
          📊 Report
        </button>
        <button onClick={() => window.debugReviewStep?.traceJsonImport()}>
          📋 Trace Import
        </button>
      </div>

      {debugReport && (
        <div>
          <div><strong>Total Renders:</strong> {debugReport.summary.totalRenders}</div>
          <div><strong>State Changes:</strong> {debugReport.summary.totalStateChanges}</div>
          <div><strong>Memory Usage:</strong> {Math.round(debugReport.summary.avgMemoryUsage / 1024 / 1024)}MB</div>
          
          {debugReport.recommendations.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong>⚠️ Issues:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                {debugReport.recommendations.slice(0, 3).map((rec: string, index: number) => (
                  <li key={index} style={{ fontSize: '11px' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Higher-order component for adding debugging to any component
 */
export function withDebugging<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.forwardRef<any, P>((props, ref) => {
    const { trackRender } = useReviewStepDebugger(componentName);
    const renderCount = useRef(0);

    // Track every render
    useEffect(() => {
      renderCount.current += 1;
      trackRender({
        renderCount: renderCount.current,
        propsKeys: Object.keys(props),
        timestamp: Date.now()
      });
    });

    return <Component {...props} ref={ref} />;
  });
}

/**
 * Custom hook for monitoring component performance
 */
export function usePerformanceMonitoring(componentName: string) {
  const { trackRender, trackStateChange } = useReviewStepDebugger(componentName);
  const renderStartTime = useRef<number>(0);

  // Start performance tracking
  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  // End performance tracking
  useEffect(() => {
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;

    trackRender({
      renderDuration,
      performanceNow: renderEndTime,
      isSlowRender: renderDuration > 16 // 60fps threshold
    });

    // Log slow renders
    if (renderDuration > 100) { // 100ms threshold
      console.warn(`⚠️ Slow render detected in ${componentName}:`, {
        duration: `${renderDuration.toFixed(2)}ms`,
        threshold: '100ms'
      });
    }
  });

  return {
    trackRender,
    trackStateChange,
    measureOperation: useCallback(<T>(operation: () => T, operationName: string): T => {
      const startTime = performance.now();
      try {
        const result = operation();
        const duration = performance.now() - startTime;
        
        trackStateChange(
          componentName,
          'session',
          'operation-start',
          'operation-end',
          `${operationName}-${duration.toFixed(2)}ms`
        );

        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        trackStateChange(
          componentName,
          'session',
          'operation-start',
          'operation-error',
          `${operationName}-error-${duration.toFixed(2)}ms`
        );
        throw error;
      }
    }, [trackStateChange, componentName])
  };
}

// Usage example with the actual ReviewStep imports
// (These would be replaced with real imports in the actual implementation)
const useAppStore = () => ({ config: { inputFile: null, outputFile: null, importedJsonFile: null } });
const useSubtitleEditStore = () => ({ 
  session: null, 
  isLoading: false, 
  initializeSession: async () => {} 
});
const useWorkspaceConfig = () => ({ currentWorkspaceId: 'workspace-1' });
const reviewStepDebugger = { generateReport: () => ({}) };

export default ReviewStepWithDebugging;