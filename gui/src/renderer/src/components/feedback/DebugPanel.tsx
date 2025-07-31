import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'
import { MessageProcessor } from '../../services/message-processor'
import type { IPCMessage, ProcessedMessage } from '../../../../types'

interface DebugLog {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  category: 'system' | 'process' | 'model' | 'user'
  source: string
  content: string
  data?: any
  shouldNotify?: boolean
  displayClass?: string
  icon?: string
}

export function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false)
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [consoleLogs, setConsoleLogs] = useState<Array<{
    id: string
    timestamp: string
    level: 'log' | 'error' | 'warn' | 'info'
    args: any[]
  }>>([])
  const [filter, setFilter] = useState<string>('all')
  const { processing, config } = useAppStore()

  // Only show in development or when localStorage flag is set
  const shouldShow = process.env.NODE_ENV === 'development' || 
                    localStorage.getItem('debug-panel') === 'true'

  // Intercept console logs
  useEffect(() => {
    if (!shouldShow) return

    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    }

    const interceptConsole = (level: 'log' | 'error' | 'warn' | 'info', originalMethod: any) => {
      return (...args: any[]) => {
        // Call original method first
        originalMethod.apply(console, args)
        
        // Capture for debug panel
        const logEntry = {
          id: `console_${Date.now()}_${Math.random()}`,
          timestamp: new Date().toLocaleTimeString(),
          level,
          args: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          )
        }
        
        setConsoleLogs(prev => [logEntry, ...prev].slice(0, 50)) // Keep last 50 console logs
      }
    }

    console.log = interceptConsole('log', originalConsole.log)
    console.error = interceptConsole('error', originalConsole.error)
    console.warn = interceptConsole('warn', originalConsole.warn)
    console.info = interceptConsole('info', originalConsole.info)

    return () => {
      // Restore original console methods
      console.log = originalConsole.log
      console.error = originalConsole.error
      console.warn = originalConsole.warn
      console.info = originalConsole.info
    }
  }, [shouldShow])

  // Add keyboard shortcut for debug mode (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        const enabled = localStorage.getItem('debug-panel') === 'true'
        localStorage.setItem('debug-panel', (!enabled).toString())
        alert(`Debug panel ${!enabled ? 'enabled' : 'disabled'}. Refresh to apply.`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Add legacy log entry (for backward compatibility)
  const addLegacyLog = (level: 'info' | 'error' | 'warning', source: string, message: string, details?: any) => {
    const newLog: DebugLog = {
      id: `legacy_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      category: 'process',
      source,
      content: message,
      data: details,
      displayClass: `message-${level} category-process`,
      icon: level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️'
    }
    setLogs(prev => [newLog, ...prev].slice(0, 100)) // Keep last 100 logs
  }

  // Handle notifications for important messages
  const handleNotification = (message: ProcessedMessage) => {
    // You can integrate with your notification system here
    // For now, just log to console
    console.log(`Notification: ${message.content}`, message)
  }

  // Listen to IPC messages
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = []

    if (window.electronAPI) {
      // Primary modern IPC message handler
      cleanupFunctions.push(
        window.electronAPI.onIPCMessage((message: IPCMessage) => {
          const processed = MessageProcessor.processMessage(message)
          const log: DebugLog = {
            id: message.id,
            timestamp: new Date(message.timestamp).toLocaleTimeString(),
            level: message.level,
            category: message.category,
            source: message.source,
            content: message.content,
            data: message.data,
            shouldNotify: processed.shouldNotify,
            displayClass: processed.displayClass,
            icon: processed.icon
          }
          setLogs(prev => [log, ...prev].slice(0, 100))
          
          // Handle notifications for important messages
          if (processed.shouldNotify && message.level !== 'debug') {
            handleNotification(processed)
          }
        })
      )

      // Legacy handlers (for backward compatibility)
      cleanupFunctions.push(
        window.electronAPI.onProcessStarted((data) => {
          addLegacyLog('info', 'ProcessManager', `Process started: ${data.message}`, data)
        })
      )

      cleanupFunctions.push(
        window.electronAPI.onProcessMessage((data) => {
          addLegacyLog('info', 'ProcessOutput', data.message, data)
        })
      )

      cleanupFunctions.push(
        window.electronAPI.onProcessError((data) => {
          addLegacyLog('error', 'ProcessError', data.message, data)
        })
      )

      cleanupFunctions.push(
        window.electronAPI.onProcessComplete((data) => {
          addLegacyLog('info', 'ProcessManager', `Process completed: ${data.message}`, data)
        })
      )
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [])

  // Build CLI command preview with proper quoting
  const buildCliCommand = (cfg: any) => {
    const args = []
    
    // Helper function to quote all string values (not just paths)
    const quoteValue = (value: string | number) => {
      // Convert to string and quote all values
      return `"${value}"`
    }
    
    // All arguments first, input file at the end
    
    // Only include -o if output directory differs from input directory
    if (cfg.outputFile && cfg.inputFile) {
      const inputDir = cfg.inputFile.substring(0, cfg.inputFile.lastIndexOf('/') || cfg.inputFile.lastIndexOf('\\'))
      const outputDir = cfg.outputFile.substring(0, cfg.outputFile.lastIndexOf('/') || cfg.outputFile.lastIndexOf('\\'))
      
      if (inputDir !== outputDir) {
        args.push('-o', quoteValue(cfg.outputFile))
      }
    }
    if (cfg.language) args.push('-l', quoteValue(cfg.language))
    if (cfg.model) args.push('-m', quoteValue(cfg.model))
    if (cfg.priority && cfg.priority !== 'balanced') args.push('-p', quoteValue(cfg.priority))
    if (cfg.speakers) args.push('--speakers')
    if (cfg.written) args.push('--written')
    if (cfg.music) args.push('--music')
    if (cfg.verbose) args.push('--verbose')
    if (cfg.noGeminiRefinement) args.push('--no-gemini-refinement')
    if (cfg.charset && cfg.charset !== 'traditional') args.push('--charset', quoteValue(cfg.charset))
    if (cfg.geminiKey) args.push('--gemini-key', quoteValue('[REDACTED]'))
    if (cfg.maxChunkDuration && cfg.maxChunkDuration !== 15) args.push('--max-chunk-duration', quoteValue(cfg.maxChunkDuration))
    if (cfg.videoQuality && cfg.videoQuality !== '360p') args.push('--video-quality', quoteValue(cfg.videoQuality))
    if (cfg.terminologyConfig) args.push('-c', quoteValue(cfg.terminologyConfig))
    // FFmpeg path is required - use resolved path or fallback
    if (cfg.ffmpegPath) {
      args.push('--ffmpeg-path', quoteValue(cfg.ffmpegPath))
    } else {
      args.push('--ffmpeg-path', quoteValue('ffmpeg'))
    }
    if (cfg.subtitle) args.push('--subtitle', quoteValue(cfg.subtitle))
    if (cfg.startTime !== null && cfg.endTime !== null) {
      args.push('--start-time', quoteValue(cfg.startTime))
      args.push('--end-time', quoteValue(cfg.endTime))
    } else if (cfg.duration && cfg.duration !== 10.0) {
      args.push('-d', quoteValue(cfg.duration))
    }
    
    // Input file at the end
    if (cfg.inputFile) args.push(quoteValue(cfg.inputFile))

    return `python3 -m src.presentation.cli.main --ipc-mode ${args.join(' ')}`
  }

  // Log CLI command when config changes
  useEffect(() => {
    if (config.inputFile) {
      const cliCommand = buildCliCommand(config)
      addLegacyLog('info', 'CLIGenerator', `Generated CLI command: ${cliCommand}`, { config, command: cliCommand })
    }
  }, [config])

  // Return null if debug panel should not be shown
  if (!shouldShow) return null

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter || log.category === filter)

  const clearLogs = () => {
    setLogs([])
    setConsoleLogs([])
  }

  if (!isVisible) {
    return (
      <div className="debug-toggle">
        <button 
          onClick={() => setIsVisible(true)}
          className="debug-toggle-btn"
          title="Show Debug Panel"
        >
          🐛 Debug
        </button>
      </div>
    )
  }

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>🐛 Developer Debug Panel</h3>
        <div className="debug-controls">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Logs</option>
            <option value="critical">Critical</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
            <option value="system">System</option>
            <option value="process">Process</option>
            <option value="model">Model</option>
          </select>
          <button onClick={clearLogs} className="debug-btn">Clear</button>
          <button 
            onClick={() => {
              const enabled = localStorage.getItem('debug-panel') === 'true'
              localStorage.setItem('debug-panel', (!enabled).toString())
              if (!enabled) {
                alert('Debug panel will remain available after refresh')
              } else {
                alert('Debug panel will hide after refresh')
              }
            }} 
            className="debug-btn"
            title="Toggle persistent debug mode"
          >
            📌
          </button>
          <button onClick={() => setIsVisible(false)} className="debug-btn">×</button>
        </div>
      </div>

      <div className="debug-content">
        {/* Current State */}
        <div className="debug-section">
          <h4>Current State</h4>
          <div className="debug-info">
            <div><strong>Processing:</strong> {processing.stage}</div>
            <div><strong>Active:</strong> {processing.isActive ? 'Yes' : 'No'}</div>
            <div><strong>Progress:</strong> {processing.progress}%</div>
            <div><strong>Input File:</strong> {config.inputFile || 'None'}</div>
            <div><strong>Model:</strong> {config.model || 'Auto'}</div>
            <div><strong>Language:</strong> {config.language}</div>
          </div>
        </div>

        {/* Performance Monitor */}
        <div className="debug-section">
          <h4>Subtitle Performance Monitor</h4>
          <div className="debug-info">
            {(() => {
              try {
                const perfMonitor = require('../../utils/performance-utils').PerformanceMonitor.getInstance();
                const stats = perfMonitor.getPerformanceStats();
                const cacheStats = require('../../utils/subtitle-transformation').getCacheStats();
                
                return (
                  <div>
                    <div><strong>Average Operation Time:</strong> {stats.averageDuration.toFixed(2)}ms</div>
                    <div><strong>Total Operations:</strong> {stats.operationCount}</div>
                    <div><strong>Slow Operations:</strong> {stats.slowOperations}</div>
                    <div><strong>Cache Entries:</strong> {cacheStats.size}</div>
                    <div><strong>Performance Status:</strong> 
                      <span style={{ 
                        color: stats.averageDuration < 30 ? '#4CAF50' : 
                               stats.averageDuration < 100 ? '#ff9800' : '#ff4444',
                        fontWeight: 'bold',
                        marginLeft: '5px'
                      }}>
                        {stats.averageDuration < 30 ? 'Excellent' : 
                         stats.averageDuration < 100 ? 'Good' : 'Needs Optimization'}
                      </span>
                    </div>
                    {stats.fastestOperation && (
                      <div><strong>Fastest Operation:</strong> {stats.fastestOperation.name} ({stats.fastestOperation.duration.toFixed(2)}ms)</div>
                    )}
                    {stats.slowestOperation && (
                      <div><strong>Slowest Operation:</strong> {stats.slowestOperation.name} ({stats.slowestOperation.duration.toFixed(2)}ms)</div>
                    )}
                    <details className="debug-details">
                      <summary>Performance Targets</summary>
                      <div style={{ padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', marginTop: '4px' }}>
                        <div>• Small datasets (≤20 items): &lt;30ms</div>
                        <div>• Medium datasets (20-100 items): &lt;150ms</div>
                        <div>• Large datasets (&gt;100 items): &lt;300ms</div>
                        <div style={{ marginTop: '8px', color: '#61dafb' }}>
                          Current Target Achievement: {stats.averageDuration < 30 ? '✅ Excellent' : 
                                                     stats.averageDuration < 100 ? '⚠️ Acceptable' : '❌ Needs Work'}
                        </div>
                      </div>
                    </details>
                  </div>
                );
              } catch (error) {
                return <div style={{ color: '#ff6b6b' }}>Performance monitoring unavailable</div>;
              }
            })()}
          </div>
        </div>

        {/* Processing Statistics */}
        <div className="debug-section">
          <h4>Processing Statistics</h4>
          <div className="debug-info">
            {processing.statistics ? (
              <div>
                <div><strong>Statistics Available:</strong> Yes</div>
                <div><strong>Quality Score:</strong> {processing.statistics.quality_score ? `${(processing.statistics.quality_score * 100).toFixed(1)}%` : 'N/A'}</div>
                <div><strong>Quality Grade:</strong> {processing.statistics.quality_grade || 'N/A'}</div>
                <div><strong>Quality Confidence:</strong> {processing.statistics.quality_confidence ? `${(processing.statistics.quality_confidence * 100).toFixed(1)}%` : 'N/A'}</div>
                <div><strong>Translation Coverage:</strong> {processing.statistics.translation_coverage ? `${(processing.statistics.translation_coverage * 100).toFixed(1)}%` : 'N/A'}</div>
                <div><strong>Coverage Confidence:</strong> {processing.statistics.coverage_confidence ? `${(processing.statistics.coverage_confidence * 100).toFixed(1)}%` : 'N/A'}</div>
                <div><strong>Total Subtitles:</strong> {processing.statistics.total_subtitles || 'N/A'}</div>
                <div><strong>Total Duration:</strong> {processing.statistics.total_duration ? `${processing.statistics.total_duration.toFixed(1)}s` : 'N/A'}</div>
                <div><strong>Word Count:</strong> {processing.statistics.word_count || 'N/A'}</div>
                <div><strong>Algorithm Version:</strong> {processing.statistics.algorithm_version || 'N/A'}</div>
                <details className="debug-details">
                  <summary>Full Statistics Object</summary>
                  <pre>{JSON.stringify(processing.statistics, null, 2)}</pre>
                </details>
              </div>
            ) : (
              <div style={{ color: '#ff6b6b' }}>
                <div><strong>Statistics Available:</strong> No</div>
                <div><strong>Reason:</strong> No statistics received from engine</div>
                <div><strong>Check:</strong> Ensure engine generates and sends statistics via IPC</div>
              </div>
            )}
          </div>
        </div>

        {/* Current CLI Command */}
        {config.inputFile && (
          <div className="debug-section">
            <h4>Generated CLI Command</h4>
            <div className="debug-command">
              <pre>{buildCliCommand(config)}</pre>
              <button 
                onClick={() => navigator.clipboard.writeText(buildCliCommand(config))}
                className="debug-copy-btn"
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>
        )}

        {/* Current Error */}
        {processing.error && (
          <div className="debug-section">
            <h4>Current Error</h4>
            <div className="debug-error">
              <pre>{processing.error}</pre>
            </div>
          </div>
        )}

        {/* Console Logs */}
        <div className="debug-section">
          <h4>Console Logs ({consoleLogs.length})</h4>
          <div className="debug-logs">
            {consoleLogs.length === 0 ? (
              <div className="debug-no-logs">No console logs captured</div>
            ) : (
              consoleLogs.map(log => (
                <div key={log.id} className={`debug-log-entry debug-console-${log.level}`}>
                  <div className="debug-log-header">
                    <span className="debug-timestamp">{log.timestamp}</span>
                    <span className="debug-icon">
                      {log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️'}
                    </span>
                    <span className={`debug-type debug-console-type-${log.level}`}>
                      CONSOLE.{log.level.toUpperCase()}
                    </span>
                    <span className="debug-source">Browser</span>
                  </div>
                  <div className="debug-log-message">
                    <pre>{log.args.join(' ')}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Process Logs */}
        <div className="debug-section">
          <h4>Process Logs ({filteredLogs.length})</h4>
          <div className="debug-logs">
            {filteredLogs.length === 0 ? (
              <div className="debug-no-logs">No logs to display</div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className={`debug-log-entry ${log.displayClass || `debug-${log.level}`}`}>
                  <div className="debug-log-header">
                    <span className="debug-timestamp">{log.timestamp}</span>
                    <span className="debug-icon">{log.icon}</span>
                    <span className={`debug-type debug-type-${log.level}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className={`debug-category debug-category-${log.category}`}>
                      {log.category.toUpperCase()}
                    </span>
                    <span className="debug-source">{log.source}</span>
                  </div>
                  <div className="debug-log-message">
                    <pre>{log.content}</pre>
                  </div>
                  {log.data && (
                    <details className="debug-details">
                      <summary>Details</summary>
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .debug-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
        }

        .debug-toggle-btn {
          background: #ff6b6b;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .debug-toggle-btn:hover {
          background: #ff5252;
        }

        .debug-panel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 600px;
          max-height: 80vh;
          background: #1e1e1e;
          color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 12px;
          z-index: 9999;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .debug-header {
          background: #2d2d2d;
          padding: 12px;
          border-bottom: 1px solid #404040;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .debug-header h3 {
          margin: 0;
          font-size: 14px;
          color: #ff6b6b;
        }

        .debug-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .debug-controls select {
          background: #404040;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
        }

        .debug-btn {
          background: #404040;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 11px;
        }

        .debug-btn:hover {
          background: #505050;
        }

        .debug-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .debug-section {
          margin-bottom: 16px;
          border: 1px solid #404040;
          border-radius: 6px;
          overflow: hidden;
        }

        .debug-section h4 {
          margin: 0;
          background: #2d2d2d;
          padding: 8px 12px;
          font-size: 12px;
          color: #61dafb;
          border-bottom: 1px solid #404040;
        }

        .debug-info {
          padding: 8px 12px;
          background: #252525;
        }

        .debug-info div {
          margin-bottom: 4px;
        }

        .debug-command {
          padding: 8px 12px;
          background: #252525;
          position: relative;
        }

        .debug-command pre {
          margin: 0;
          word-wrap: break-word;
          white-space: pre-wrap;
          color: #98fb98;
          background: #1a1a1a;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #404040;
        }

        .debug-copy-btn {
          position: absolute;
          top: 12px;
          right: 16px;
          background: #404040;
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
        }

        .debug-error {
          padding: 8px 12px;
          background: #252525;
        }

        .debug-error pre {
          margin: 0;
          color: #ff6b6b;
          background: #2a1a1a;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ff4444;
          white-space: pre-wrap;
        }

        .debug-logs {
          max-height: 300px;
          overflow-y: auto;
          background: #252525;
        }

        .debug-no-logs {
          padding: 20px;
          text-align: center;
          color: #888;
          font-style: italic;
        }

        .debug-log-entry {
          border-bottom: 1px solid #333;
          padding: 8px 12px;
        }

        .debug-log-entry:last-child {
          border-bottom: none;
        }

        .debug-log-header {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 4px;
          font-size: 10px;
        }

        .debug-timestamp {
          color: #888;
        }

        .debug-type {
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 9px;
        }

        .debug-icon {
          margin-right: 4px;
          font-size: 10px;
        }

        .debug-type-critical {
          background: #d32f2f;
          color: white;
        }

        .debug-type-error {
          background: #ff4444;
          color: white;
        }

        .debug-type-warning {
          background: #ff9800;
          color: white;
        }

        .debug-type-info {
          background: #4CAF50;
          color: white;
        }

        .debug-type-debug {
          background: #9C27B0;
          color: white;
        }

        .debug-category {
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 9px;
          margin-left: 4px;
        }

        .debug-category-system {
          background: #ff6b35;
          color: white;
        }

        .debug-category-process {
          background: #2196F3;
          color: white;
        }

        .debug-category-model {
          background: #795548;
          color: white;
        }

        .debug-category-user {
          background: #607d8b;
          color: white;
        }

        .debug-source {
          color: #61dafb;
          font-weight: bold;
        }

        .debug-log-message {
          margin-left: 0;
        }

        .debug-log-message pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          background: #1a1a1a;
          padding: 6px;
          border-radius: 3px;
          border-left: 3px solid #404040;
        }

        .debug-error .debug-log-message pre {
          border-left-color: #ff4444;
          background: #2a1a1a;
        }

        .debug-details {
          margin-top: 8px;
        }

        .debug-details summary {
          cursor: pointer;
          color: #61dafb;
          font-size: 10px;
        }

        .debug-details pre {
          margin: 4px 0 0 0;
          background: #1a1a1a;
          padding: 8px;
          border-radius: 3px;
          color: #888;
          font-size: 10px;
          max-height: 200px;
          overflow-y: auto;
        }

        .debug-console-log {
          border-left: 3px solid #4CAF50;
        }

        .debug-console-error {
          border-left: 3px solid #ff4444;
        }

        .debug-console-warn {
          border-left: 3px solid #ff9800;
        }

        .debug-console-info {
          border-left: 3px solid #2196F3;
        }

        .debug-console-type-log {
          background: #4CAF50;
          color: white;
        }

        .debug-console-type-error {
          background: #ff4444;
          color: white;
        }

        .debug-console-type-warn {
          background: #ff9800;
          color: white;
        }

        .debug-console-type-info {
          background: #2196F3;
          color: white;
        }
      `}</style>
    </div>
  )
}