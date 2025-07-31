// Performance Optimization Example Component
// This demonstrates how to use the new performance-optimized features

import React, { useState, useCallback } from 'react'
import { 
  usePerformanceOptimization,
  useAutoSavePerformance,
  usePerformantStepConfig,
  useBackgroundSync,
  useAdaptivePerformance,
  usePerformanceAwareRendering
} from '../hooks/usePerformanceOptimization'

interface PerformanceOptimizationExampleProps {
  workspaceId: string
}

export const PerformanceOptimizationExample: React.FC<PerformanceOptimizationExampleProps> = ({
  workspaceId
}) => {
  const [configData, setConfigData] = useState({
    language: 'zh',
    model: 'whisper-large',
    quality: 'high'
  })

  // Main performance monitoring hook
  const {
    snapshot,
    isMonitoring,
    autoOptimizationEnabled,
    toggleAutoOptimization,
    applyOptimization,
    acknowledgeAlert
  } = usePerformanceOptimization()

  // Auto-save performance monitoring
  const {
    metrics: autoSaveMetrics,
    suggestions: autoSaveSuggestions,
    flush: flushAutoSave,
    applyOptimization: applyAutoSaveOptimization
  } = useAutoSavePerformance()

  // Performance-aware step configuration
  const {
    saveConfig,
    debouncedSave,
    immediateSave,
    saveLatency,
    isOptimized
  } = usePerformantStepConfig(workspaceId, 'config')

  // Background processing coordination
  const {
    workerStats,
    isProcessing,
    compressData,
    performCleanup
  } = useBackgroundSync()

  // Adaptive performance based on system resources
  const {
    performanceMode,
    systemLoad,
    optimizedSettings
  } = useAdaptivePerformance()

  // Performance-aware rendering
  const {
    renderCount,
    averageRenderTime,
    shouldOptimizeRendering,
    renderPerformanceStatus,
    startRenderTiming,
    endRenderTiming
  } = usePerformanceAwareRendering('PerformanceExample')

  // Start render timing on component mount
  React.useEffect(() => {
    startRenderTiming()
    return endRenderTiming
  })

  // Handle configuration changes with performance-aware saving
  const handleConfigChange = useCallback((key: string, value: any) => {
    const newConfig = { ...configData, [key]: value }
    setConfigData(newConfig)
    
    // Use debounced save for frequent changes
    debouncedSave(newConfig)
  }, [configData, debouncedSave])

  // Handle critical configuration changes
  const handleCriticalConfigChange = useCallback((key: string, value: any) => {
    const newConfig = { ...configData, [key]: value }
    setConfigData(newConfig)
    
    // Use immediate save for critical changes
    immediateSave(newConfig)
  }, [configData, immediateSave])

  // Handle data compression
  const handleCompressData = useCallback(async () => {
    try {
      const result = await compressData(configData, 'json')
      console.log('Compression result:', result)
    } catch (error) {
      console.error('Compression failed:', error)
    }
  }, [configData, compressData])

  // Handle performance cleanup
  const handleCleanup = useCallback(async () => {
    try {
      const result = await performCleanup({
        clearExpiredCache: true,
        optimizeMemory: true
      })
      console.log('Cleanup result:', result)
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }, [performCleanup])

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>Performance Optimization Dashboard</h2>
      
      {/* Performance Overview */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Performance Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>Overall Score:</strong> {snapshot?.overallScore || 0}/100
          </div>
          <div>
            <strong>Performance Mode:</strong> {performanceMode}
          </div>
          <div>
            <strong>Monitoring:</strong> {isMonitoring ? 'Active' : 'Inactive'}
          </div>
          <div>
            <strong>Auto-Optimization:</strong> {autoOptimizationEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>

      {/* System Resources */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>System Resources</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div>
            <strong>CPU:</strong> {systemLoad.cpu.toFixed(1)}%
          </div>
          <div>
            <strong>Memory:</strong> {systemLoad.memory.toFixed(1)}%
          </div>
          <div>
            <strong>Storage:</strong> {systemLoad.storage.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Auto-Save Performance */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Auto-Save Performance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>Save Latency:</strong> {saveLatency}ms
          </div>
          <div>
            <strong>Optimized:</strong> {isOptimized ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Pending Saves:</strong> {autoSaveMetrics?.pendingSaves || 0}
          </div>
          <div>
            <strong>Success Rate:</strong> {
              autoSaveMetrics 
                ? ((autoSaveMetrics.successfulOperations / Math.max(autoSaveMetrics.totalOperations, 1)) * 100).toFixed(1)
                : 0
            }%
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          <button onClick={flushAutoSave} style={{ marginRight: '10px' }}>
            Flush Pending Saves
          </button>
        </div>
      </div>

      {/* Background Processing */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Background Processing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>Active Tasks:</strong> {workerStats.activeThreads}
          </div>
          <div>
            <strong>Processing:</strong> {isProcessing ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Total Processed:</strong> {workerStats.totalTasksProcessed}
          </div>
          <div>
            <strong>Error Rate:</strong> {(workerStats.errorRate * 100).toFixed(2)}%
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          <button onClick={handleCompressData} style={{ marginRight: '10px' }}>
            Compress Data
          </button>
          <button onClick={handleCleanup}>
            Perform Cleanup
          </button>
        </div>
      </div>

      {/* Render Performance */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Render Performance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>Render Count:</strong> {renderCount}
          </div>
          <div>
            <strong>Avg Render Time:</strong> {averageRenderTime.toFixed(2)}ms
          </div>
          <div>
            <strong>Status:</strong> {renderPerformanceStatus}
          </div>
          <div>
            <strong>Should Optimize:</strong> {shouldOptimizeRendering ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      {/* Configuration Test */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Configuration Management</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <label>
              Language:
              <select
                value={configData.language}
                onChange={(e) => handleConfigChange('language', e.target.value)}
                style={{ marginLeft: '5px' }}
              >
                <option value="zh">Chinese</option>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
              </select>
            </label>
          </div>
          <div>
            <label>
              Model:
              <select
                value={configData.model}
                onChange={(e) => handleCriticalConfigChange('model', e.target.value)}
                style={{ marginLeft: '5px' }}
              >
                <option value="whisper-base">Whisper Base</option>
                <option value="whisper-large">Whisper Large</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>
          <div>
            <label>
              Quality:
              <select
                value={configData.quality}
                onChange={(e) => handleConfigChange('quality', e.target.value)}
                style={{ marginLeft: '5px' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Performance Alerts */}
      {snapshot?.alerts && snapshot.alerts.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ff9800', borderRadius: '5px', backgroundColor: '#fff3e0' }}>
          <h3>Performance Alerts</h3>
          {snapshot.alerts.map(alert => (
            <div key={alert.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '3px' }}>
              <div style={{ fontWeight: 'bold', color: alert.severity === 'critical' ? '#f44336' : '#ff9800' }}>
                {alert.title}
              </div>
              <div style={{ fontSize: '0.9em', color: '#666' }}>
                {alert.description}
              </div>
              <div style={{ marginTop: '5px' }}>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  style={{ fontSize: '0.8em', padding: '2px 8px' }}
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optimization Suggestions */}
      {autoSaveSuggestions.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #4caf50', borderRadius: '5px', backgroundColor: '#f1f8e9' }}>
          <h3>Optimization Suggestions</h3>
          {autoSaveSuggestions.map(suggestion => (
            <div key={suggestion.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '3px' }}>
              <div style={{ fontWeight: 'bold' }}>
                {suggestion.title}
              </div>
              <div style={{ fontSize: '0.9em', color: '#666' }}>
                {suggestion.description}
              </div>
              <div style={{ fontSize: '0.8em', color: '#888' }}>
                Impact: {suggestion.impact}
              </div>
              {suggestion.action && (
                <div style={{ marginTop: '5px' }}>
                  <button
                    onClick={() => applyAutoSaveOptimization(suggestion.id)}
                    style={{ fontSize: '0.8em', padding: '2px 8px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '3px' }}
                  >
                    Apply Optimization
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Performance Controls</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={toggleAutoOptimization}>
            {autoOptimizationEnabled ? 'Disable' : 'Enable'} Auto-Optimization
          </button>
          <button onClick={() => console.log('Optimized Settings:', optimizedSettings)}>
            Log Optimized Settings
          </button>
          <button onClick={() => console.log('Performance Snapshot:', snapshot)}>
            Log Performance Snapshot
          </button>
        </div>
      </div>
    </div>
  )
}

export default PerformanceOptimizationExample