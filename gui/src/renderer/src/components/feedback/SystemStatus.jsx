import React, { useCallback } from 'react'
import { useAppStore } from '../../store/app-store'

export const SystemStatus = () => {
  const { 
    dependencies, 
    hardware, 
    checkDependencies, 
    checkHardware, 
    showNotification,
    setActiveModal
  } = useAppStore()

  const handleCheckDependencies = useCallback(async () => {
    await checkDependencies()
    showNotification('Dependencies checked', 'info')
  }, [checkDependencies, showNotification])

  const handleCheckHardware = useCallback(async () => {
    try {
      await checkHardware()
      setActiveModal('hardware')
    } catch (error) {
      showNotification(`Hardware check failed: ${error.message}`, 'error')
    }
  }, [checkHardware, showNotification, setActiveModal])

  const handleOpenInstallGuide = useCallback(async (dependency) => {
    const urls = {
      python: 'https://www.python.org/downloads/release/python-3120/',
      ffmpeg: 'https://ffmpeg.org/download.html'
    }
    
    if (urls[dependency]) {
      await window.cantocapAPI.openExternalUrl(urls[dependency])
    }
  }, [])

  const getStatusIcon = (status, available) => {
    if (status === 'checking') return '🔄'
    if (available) return '✅'
    if (status === 'error') return '🚨'
    return '❌'
  }

  const getStatusText = (status, available, name) => {
    if (status === 'checking') return 'Checking...'
    if (available) return `${name} Available`
    if (status === 'error') return 'Check Failed'
    return `${name} Missing`
  }

  const getStatusClass = (status, available) => {
    if (status === 'checking') return 'checking'
    if (available) return 'available'
    if (status === 'error') return 'error'
    return 'missing'
  }

  return (
    <div className="system-status">
      <h3 className="section-title">📊 System Status</h3>
      
      <div className="status-list">
        <div className="status-item">
          <div className="status-header">
            <span className="status-icon">
              {getStatusIcon(dependencies.python.status, dependencies.python.available)}
            </span>
            <div className="status-info">
              <div className="status-name">Python 3.12</div>
              <div className={`status-text ${getStatusClass(dependencies.python.status, dependencies.python.available)}`}>
                {getStatusText(dependencies.python.status, dependencies.python.available, 'Python')}
              </div>
            </div>
          </div>
          
          {dependencies.python.version && (
            <div className="status-details">
              <div className="detail-item">
                <span className="detail-label">Version:</span>
                <span className="detail-value">{dependencies.python.version}</span>
              </div>
            </div>
          )}
          
          {!dependencies.python.available && dependencies.python.status !== 'checking' && (
            <div className="status-actions">
              <button
                className="install-btn"
                onClick={() => handleOpenInstallGuide('python')}
              >
                Install Python 3.12
              </button>
            </div>
          )}
        </div>
        
        <div className="status-item">
          <div className="status-header">
            <span className="status-icon">
              {getStatusIcon(dependencies.ffmpeg.status, dependencies.ffmpeg.available)}
            </span>
            <div className="status-info">
              <div className="status-name">FFmpeg</div>
              <div className={`status-text ${getStatusClass(dependencies.ffmpeg.status, dependencies.ffmpeg.available)}`}>
                {getStatusText(dependencies.ffmpeg.status, dependencies.ffmpeg.available, 'FFmpeg')}
              </div>
            </div>
          </div>
          
          {dependencies.ffmpeg.version && (
            <div className="status-details">
              <div className="detail-item">
                <span className="detail-label">Version:</span>
                <span className="detail-value">{dependencies.ffmpeg.version.split('\n')[0]}</span>
              </div>
            </div>
          )}
          
          {!dependencies.ffmpeg.available && dependencies.ffmpeg.status !== 'checking' && (
            <div className="status-actions">
              <button
                className="install-btn"
                onClick={() => handleOpenInstallGuide('ffmpeg')}
              >
                Install FFmpeg
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="status-controls">
        <button
          className="check-btn"
          onClick={handleCheckDependencies}
          disabled={dependencies.python.status === 'checking' || dependencies.ffmpeg.status === 'checking'}
        >
          🔄 Recheck Dependencies
        </button>
        
        <button
          className="hardware-btn"
          onClick={handleCheckHardware}
          disabled={hardware.checking || !dependencies.python.available}
        >
          {hardware.checking ? '🔄 Checking...' : '🖥️ Check Hardware'}
        </button>
      </div>
      
      {hardware.lastChecked && (
        <div className="hardware-summary">
          <div className="summary-header">
            <span className="summary-icon">🖥️</span>
            <span className="summary-title">Last Hardware Check</span>
            <span className="summary-time">
              {new Date(hardware.lastChecked).toLocaleTimeString()}
            </span>
          </div>
          
          {hardware.info && (
            <div className="summary-content">
              <div className="summary-item">
                <span className="summary-label">Status:</span>
                <span className="summary-value">Hardware Compatible</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="system-requirements">
        <div className="requirements-header">
          <span className="requirements-icon">📋</span>
          <span className="requirements-title">System Requirements</span>
        </div>
        <div className="requirements-list">
          <div className="requirement-item">
            <span className="req-icon">🐍</span>
            <span className="req-text">Python 3.12 or later</span>
          </div>
          <div className="requirement-item">
            <span className="req-icon">🎥</span>
            <span className="req-text">FFmpeg for media processing</span>
          </div>
          <div className="requirement-item">
            <span className="req-icon">💾</span>
            <span className="req-text">4GB+ RAM recommended</span>
          </div>
          <div className="requirement-item">
            <span className="req-icon">🎮</span>
            <span className="req-text">GPU acceleration optional</span>
          </div>
        </div>
      </div>
    </div>
  )
}