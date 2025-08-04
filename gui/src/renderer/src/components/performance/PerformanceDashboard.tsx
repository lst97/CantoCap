/**
 * Performance Dashboard Component
 * Real-time monitoring and visualization of WorkflowStateManager performance
 * Displays metrics, alerts, benchmarks, and optimization opportunities
 */

import React, { useState, useCallback, useMemo } from 'react'
import { useWorkflowPerformanceMonitor } from '../../hooks/useOptimizedWorkflowState'
import { workflowObjectPool } from '../../services/object-pool'

interface PerformanceCardProps {
  title: string
  value: string | number
  unit?: string
  target?: number
  status: 'good' | 'warning' | 'critical'
  description?: string
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  title,
  value,
  unit = '',
  target,
  status,
  description
}) => {
  const statusColors = {
    good: 'bg-green-100 border-green-500 text-green-800',
    warning: 'bg-yellow-100 border-yellow-500 text-yellow-800',
    critical: 'bg-red-100 border-red-500 text-red-800'
  }

  const statusIcons = {
    good: '✅',
    warning: '⚠️',
    critical: '❌'
  }

  return (
    <div className={`p-4 border-l-4 rounded-lg ${statusColors[status]}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <div className="text-2xl font-bold mt-1">
            {typeof value === 'number' ? value.toFixed(2) : value}
            {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
          </div>
          {target && (
            <div className="text-xs mt-1 opacity-75">
              Target: {target}{unit}
            </div>
          )}
          {description && (
            <div className="text-xs mt-2 opacity-90">{description}</div>
          )}
        </div>
        <div className="text-xl">{statusIcons[status]}</div>
      </div>
    </div>
  )
}

interface AlertItemProps {
  alert: {
    type: 'warning' | 'critical'
    message: string
    timestamp: number
  }
}

const AlertItem: React.FC<AlertItemProps> = ({ alert }) => {
  const timeAgo = useMemo(() => {
    const diff = Date.now() - alert.timestamp
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ago`
    }
    return `${seconds}s ago`
  }, [alert.timestamp])

  const alertColors = {
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    critical: 'bg-red-50 border-red-200 text-red-800'
  }

  return (
    <div className={`p-3 border rounded-lg ${alertColors[alert.type]}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <span className="font-medium text-xs uppercase tracking-wide">
            {alert.type}
          </span>
          <p className="text-sm mt-1">{alert.message}</p>
        </div>
        <span className="text-xs opacity-75 ml-2">{timeAgo}</span>
      </div>
    </div>
  )
}

export const PerformanceDashboard: React.FC = () => {
  const { metrics, alerts, runBenchmarks, generateReport, clearData } = useWorkflowPerformanceMonitor()
  const [benchmarkResults, setBenchmarkResults] = useState<Map<string, any> | null>(null)
  const [isRunningBenchmarks, setIsRunningBenchmarks] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [report, setReport] = useState<string>('')

  // Get object pool stats
  const poolStats = useMemo(() => workflowObjectPool.getPoolStats(), [])

  // Calculate performance status
  const getPerformanceStatus = useCallback((value: number, target: number, invert = false): 'good' | 'warning' | 'critical' => {
    const ratio = invert ? target / value : value / target
    if (ratio >= 0.9) return 'good'
    if (ratio >= 0.7) return 'warning'
    return 'critical'
  }, [])

  const handleRunBenchmarks = useCallback(async () => {
    setIsRunningBenchmarks(true)
    try {
      const results = await runBenchmarks()
      setBenchmarkResults(results)
    } catch (error) {
      console.error('Benchmark failed:', error)
    } finally {
      setIsRunningBenchmarks(false)
    }
  }, [runBenchmarks])

  const handleGenerateReport = useCallback(() => {
    const reportText = generateReport()
    setReport(reportText)
    setShowReport(true)
  }, [generateReport])

  const handleClearData = useCallback(() => {
    clearData()
    setBenchmarkResults(null)
    setReport('')
    setShowReport(false)
  }, [clearData])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          WorkflowStateManager Performance Dashboard
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={handleRunBenchmarks}
            disabled={isRunningBenchmarks}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunningBenchmarks ? 'Running...' : 'Run Benchmarks'}
          </button>
          <button
            onClick={handleGenerateReport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Generate Report
          </button>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Clear Data
          </button>
        </div>
      </div>

      {/* Core Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PerformanceCard
          title="State Transition Time"
          value={metrics.lastTransitionTime}
          unit="ms"
          target={1}
          status={getPerformanceStatus(metrics.lastTransitionTime, 1, true)}
          description={`Avg: ${metrics.avgTransitionTime.toFixed(2)}ms, Max: ${metrics.maxTransitionTime.toFixed(2)}ms`}
        />
        
        <PerformanceCard
          title="Cache Hit Rate"
          value={(metrics.cacheHitRate * 100)}
          unit="%"
          target={90}
          status={getPerformanceStatus(metrics.cacheHitRate * 100, 90)}
          description={`${metrics.cacheHits} hits, ${metrics.cacheMisses} misses`}
        />
        
        <PerformanceCard
          title="Memory Usage"
          value={(metrics.memoryUsage / 1024 / 1024)}
          unit="MB"
          target={50}
          status={getPerformanceStatus(metrics.memoryUsage / 1024 / 1024, 50, true)}
          description="JavaScript heap size"
        />
        
        <PerformanceCard
          title="Re-render Time"
          value={metrics.rerenderTime}
          unit="ms"
          target={10}
          status={getPerformanceStatus(metrics.rerenderTime, 10, true)}
          description={`${metrics.rerenderCount} total re-renders`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <PerformanceCard
          title="Notification Time"
          value={metrics.notificationTime}
          unit="ms"
          target={5}
          status={getPerformanceStatus(metrics.notificationTime, 5, true)}
        />
        
        <PerformanceCard
          title="Observer Count"
          value={metrics.observerCount}
          status="good"
          description="Active subscriptions"
        />
        
        <PerformanceCard
          title="Transition Count"
          value={metrics.transitionCount}
          status="good"
          description="Total state changes"
        />
        
        <PerformanceCard
          title="Error Rate"
          value={(metrics.errorRate * 100)}
          unit="%"
          target={1}
          status={getPerformanceStatus(metrics.errorRate * 100, 1, true)}
        />
        
        <PerformanceCard
          title="System Load"
          value={(metrics.systemLoad * 100)}
          unit="%"
          target={30}
          status={getPerformanceStatus(metrics.systemLoad * 100, 30, true)}
        />
      </div>

      {/* Object Pool Statistics */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">Object Pool Utilization</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {poolStats.stateChangeEvents.poolSize}
            </div>
            <div className="text-sm text-gray-600">State Change Events</div>
            <div className="text-xs text-gray-500">
              {(poolStats.stateChangeEvents.utilization * 100).toFixed(1)}% utilization
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {poolStats.stateMetadata.poolSize}
            </div>
            <div className="text-sm text-gray-600">State Metadata</div>
            <div className="text-xs text-gray-500">
              {(poolStats.stateMetadata.utilization * 100).toFixed(1)}% utilization
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {poolStats.notifications.poolSize}
            </div>
            <div className="text-sm text-gray-600">Notifications</div>
            <div className="text-xs text-gray-500">
              {(poolStats.notifications.utilization * 100).toFixed(1)}% utilization
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {(poolStats.totalMemorySaving / 1024).toFixed(1)}KB
            </div>
            <div className="text-sm text-gray-600">Memory Saved</div>
            <div className="text-xs text-gray-500">Estimated savings</div>
          </div>
        </div>
      </div>

      {/* Performance Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Performance Alerts</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alerts.slice(-10).reverse().map((alert, index) => (
              <AlertItem key={index} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Benchmark Results */}
      {benchmarkResults && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Benchmark Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from(benchmarkResults.entries()).map(([name, result]) => (
              <div key={name} className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-sm">{result.name}</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div>Avg: {result.avgTime.toFixed(3)}ms</div>
                  <div>Min: {result.minTime.toFixed(3)}ms</div>
                  <div>Max: {result.maxTime.toFixed(3)}ms</div>
                  <div>Throughput: {result.throughput.toFixed(0)} ops/sec</div>
                  {result.memoryDelta !== 0 && (
                    <div>Memory: {(result.memoryDelta / 1024).toFixed(1)}KB</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Report Modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl max-h-80vh overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Performance Report</h2>
              <button
                onClick={() => setShowReport(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <pre className="text-sm bg-gray-100 p-4 rounded-lg overflow-auto whitespace-pre-wrap">
              {report}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(report)
                  alert('Report copied to clipboard!')
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tips */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Performance Optimization Tips</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h3 className="font-medium mb-2">🎯 Target Metrics</h3>
            <ul className="space-y-1">
              <li>• State transitions: &lt;1ms</li>
              <li>• Cache hit rate: &gt;90%</li>
              <li>• Memory usage: &lt;50MB</li>
              <li>• Re-render time: &lt;10ms</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">⚡ Optimization Strategies</h3>
            <ul className="space-y-1">
              <li>• Use optimized hooks for better memoization</li>
              <li>• Batch state transitions when possible</li>
              <li>• Enable object pooling for memory efficiency</li>
              <li>• Monitor performance alerts regularly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerformanceDashboard