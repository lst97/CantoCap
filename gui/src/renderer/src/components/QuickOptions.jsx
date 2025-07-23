import React, { useCallback } from 'react'
import { useAppStore } from '../store/app-store'

export const QuickOptions = () => {
  const { config, updateConfig } = useAppStore()

  const handleOptionChange = useCallback((key) => {
    updateConfig(key, !config[key])
  }, [config, updateConfig])

  const options = [
    {
      key: 'speakers',
      label: 'Speaker Identification',
      icon: '👥',
      description: 'Identify and label different speakers in the audio',
      enabled: config.speakers
    },
    {
      key: 'written',
      label: 'Written Style Conversion',
      icon: '✍️',
      description: 'Convert colloquial speech to formal written style',
      enabled: config.written
    },
    {
      key: 'music',
      label: 'Music Detection',
      icon: '🎵',
      description: 'Detect and label music segments in the audio',
      enabled: config.music
    }
  ]

  return (
    <div className="quick-options">
      <label className="form-label">
        ⚡ Quick Options
      </label>
      
      <div className="options-grid">
        {options.map((option) => (
          <div key={option.key} className="option-card">
            <label className="option-label">
              <input
                type="checkbox"
                className="option-checkbox"
                checked={option.enabled}
                onChange={() => handleOptionChange(option.key)}
              />
              
              <div className="option-content">
                <div className="option-header">
                  <span className="option-icon">{option.icon}</span>
                  <span className="option-title">{option.label}</span>
                </div>
                <div className="option-description">
                  {option.description}
                </div>
              </div>
              
              <div className="option-toggle">
                <div className={`toggle-switch ${option.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="toggle-thumb"></div>
                </div>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}