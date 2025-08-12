import React from 'react'
import { useAppStore } from '../../stores/useAppStore'

export const HardwareModal = () => {
  const { hardware, closeModal } = useAppStore()

  const formatHardwareInfo = (info) => {
    if (typeof info === 'string') {
      return info.split('\n').filter(line => line.trim())
    }
    
    if (typeof info === 'object') {
      return Object.entries(info).map(([key, value]) => `${key}: ${value}`)
    }
    
    return ['Hardware information not available']
  }

  return (
    <div className="hardware-modal">
      <div className="modal-header">
        <h2>🖥️ Hardware Information</h2>
        <button className="modal-close-btn" onClick={closeModal}>
          ✕
        </button>
      </div>
      
      <div className="modal-content">
        {hardware.checking ? (
          <div className="checking-state">
            <div className="checking-icon">🔄</div>
            <div className="checking-text">Checking hardware capabilities...</div>
          </div>
        ) : hardware.error ? (
          <div className="error-state">
            <div className="error-icon">❌</div>
            <div className="error-title">Hardware Check Failed</div>
            <div className="error-message">{hardware.error}</div>
          </div>
        ) : hardware.info ? (
          <div className="hardware-details">
            <div className="details-section">
              <h3>System Information</h3>
              <div className="info-list">
                {formatHardwareInfo(hardware.info).map((line, index) => (
                  <div key={index} className="info-item">
                    {line}
                  </div>
                ))}
              </div>
            </div>
            
            {hardware.info.raw_output && (
              <div className="details-section">
                <h3>Raw Output</h3>
                <div className="raw-output">
                  <pre>{hardware.info.raw_output}</pre>
                </div>
              </div>
            )}
            
            <div className="details-section">
              <h3>Recommendations</h3>
              <div className="recommendations">
                <div className="recommendation-item">
                  <span className="rec-icon">💡</span>
                  <span className="rec-text">
                    Use GPU acceleration if available for faster processing
                  </span>
                </div>
                <div className="recommendation-item">
                  <span className="rec-icon">⚡</span>
                  <span className="rec-text">
                    Choose model size based on available VRAM and processing power
                  </span>
                </div>
                <div className="recommendation-item">
                  <span className="rec-icon">🎯</span>
                  <span className="rec-text">
                    Enable verbose output to monitor resource usage during processing
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-info-state">
            <div className="no-info-icon">📋</div>
            <div className="no-info-text">No hardware information available</div>
          </div>
        )}
        
        <div className="last-checked">
          {hardware.lastChecked && (
            <div className="checked-info">
              <span className="checked-icon">🕒</span>
              <span className="checked-text">
                Last checked: {new Date(hardware.lastChecked).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="modal-footer">
        <button className="modal-btn secondary" onClick={closeModal}>
          Close
        </button>
      </div>
    </div>
  )
}