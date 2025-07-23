import React, { useCallback } from 'react'
import { useAppStore } from '../store/app-store'

export const ActionPanel = () => {
  const { 
    canStartTranscription,
    startTranscription,
    cancelTranscription,
    processing,
    config,
    dependencies,
    toggleAdvanced,
    ui,
    showNotification
  } = useAppStore()

  const handleStartTranscription = useCallback(() => {
    if (!canStartTranscription()) {
      if (!config.inputFile) {
        showNotification('Please select an input file first', 'error')
      } else if (!dependencies.python.available) {
        showNotification('Python 3.12 is required but not available', 'error')
      } else if (!dependencies.ffmpeg.available) {
        showNotification('FFmpeg is required but not available', 'error')
      }
      return
    }
    
    startTranscription()
  }, [canStartTranscription, startTranscription, config.inputFile, dependencies, showNotification])

  const handleCancelTranscription = useCallback(() => {
    cancelTranscription()
  }, [cancelTranscription])

  const getButtonState = () => {
    if (processing.isActive) {
      return {
        text: 'Cancel Processing',
        icon: '⏹️',
        className: 'cancel-btn',
        action: handleCancelTranscription,
        disabled: false
      }
    }
    
    if (canStartTranscription()) {
      return {
        text: 'Generate Subtitles',
        icon: '🎬',
        className: 'generate-btn primary',
        action: handleStartTranscription,
        disabled: false
      }
    }
    
    return {
      text: 'Generate Subtitles',
      icon: '🎬',
      className: 'generate-btn disabled',
      action: () => {},
      disabled: true
    }
  }

  const buttonState = getButtonState()

  const getReadinessStatus = () => {
    const issues = []
    
    if (!config.inputFile) issues.push('No input file selected')
    if (!dependencies.python.available) issues.push('Python 3.12 not available')
    if (!dependencies.ffmpeg.available) issues.push('FFmpeg not available')
    
    if (issues.length === 0) {
      return { ready: true, message: 'Ready to generate subtitles', icon: '✅' }
    }
    
    return { 
      ready: false, 
      message: `${issues.length} issue${issues.length > 1 ? 's' : ''}: ${issues.join(', ')}`,
      icon: '⚠️'
    }
  }

  const readiness = getReadinessStatus()

  return (
    <div className="action-panel">
      <div className="panel-header">
        <h2>🚀 Actions</h2>
        <button
          className="advanced-toggle-btn"
          onClick={toggleAdvanced}
          title={ui.showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
        >
          {ui.showAdvanced ? '⚙️ Hide Advanced' : '⚙️ Show Advanced'}
        </button>
      </div>
      
      <div className="panel-content">
        <div className="readiness-status">
          <div className={`status-indicator ${readiness.ready ? 'ready' : 'not-ready'}`}>
            <span className="status-icon">{readiness.icon}</span>
            <span className="status-message">{readiness.message}</span>
          </div>
        </div>
        
        <div className="action-buttons">
          <button
            className={`action-btn ${buttonState.className}`}
            onClick={buttonState.action}
            disabled={buttonState.disabled}
          >
            <span className="btn-icon">{buttonState.icon}</span>
            <span className="btn-text">{buttonState.text}</span>
          </button>
        </div>
        
        {processing.isActive && (
          <div className="processing-info">
            <div className="processing-stage">
              <span className="stage-icon">🔄</span>
              <span className="stage-text">
                Stage: {processing.stage.charAt(0).toUpperCase() + processing.stage.slice(1)}
              </span>
            </div>
            
            {processing.timeElapsed > 0 && (
              <div className="processing-time">
                <span className="time-icon">⏱️</span>
                <span className="time-text">
                  Elapsed: {Math.floor(processing.timeElapsed / 60)}m {processing.timeElapsed % 60}s
                </span>
              </div>
            )}
          </div>
        )}
        
        <div className="config-summary">
          <div className="summary-header">
            <span className="summary-icon">📋</span>
            <span className="summary-title">Current Configuration</span>
          </div>
          
          <div className="config-items">
            {config.inputFile && (
              <div className="config-item">
                <span className="config-label">Input:</span>
                <span className="config-value" title={config.inputFile}>
                  {config.inputFile.split(/[\\/]/).pop()}
                </span>
              </div>
            )}
            
            <div className="config-item">
              <span className="config-label">Language:</span>
              <span className="config-value">
                {config.language === 'zh' ? 'Chinese' : config.language.toUpperCase()}
              </span>
            </div>
            
            <div className="config-item">
              <span className="config-label">Model:</span>
              <span className="config-value">
                {config.model || 'Auto-select'}
              </span>
            </div>
            
            <div className="config-item">
              <span className="config-label">Character Set:</span>
              <span className="config-value">
                {config.charset === 'traditional' ? 'Traditional' : 'Simplified'}
              </span>
            </div>
            
            {config.subtitle && (
              <div className="config-item">
                <span className="config-label">Translation:</span>
                <span className="config-value">
                  {config.subtitle.toUpperCase()}
                </span>
              </div>
            )}
            
            <div className="config-item">
              <span className="config-label">Options:</span>
              <span className="config-value">
                {[
                  config.speakers && 'Speakers',
                  config.written && 'Written Style',
                  config.music && 'Music Detection',
                  config.geminiKey && 'AI Refinement'
                ].filter(Boolean).join(', ') || 'None'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="action-tips">
          <div className="tip-header">
            <span className="tip-icon">💡</span>
            <span className="tip-title">Tips</span>
          </div>
          
          <div className="tip-list">
            <div className="tip-item">
              Use a Gemini API key for better transcription accuracy
            </div>
            <div className="tip-item">
              Enable speaker identification for multi-speaker content
            </div>
            <div className="tip-item">
              Check hardware specs for optimal model selection
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}