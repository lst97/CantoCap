import React, { useCallback } from 'react'
import { useAppStore } from '../../store/app-store'

export const CharsetSelector = () => {
  const { config, updateConfig } = useAppStore()

  const handleCharsetChange = useCallback((charset) => {
    updateConfig('charset', charset)
  }, [updateConfig])

  const charsets = [
    {
      value: 'traditional',
      label: 'Traditional Chinese',
      icon: '繁',
      description: 'Traditional Chinese characters (繁體字)',
      example: '繁體中文字幕'
    },
    {
      value: 'simplified',
      label: 'Simplified Chinese', 
      icon: '简',
      description: 'Simplified Chinese characters (简体字)',
      example: '简体中文字幕'
    }
  ]

  return (
    <div className="charset-selector">
      <label className="form-label">
        🌐 Character Set
      </label>
      
      <div className="charset-options">
        {charsets.map((charset) => (
          <label key={charset.value} className="charset-option">
            <input
              type="radio"
              name="charset"
              value={charset.value}
              checked={config.charset === charset.value}
              onChange={() => handleCharsetChange(charset.value)}
              className="charset-radio"
            />
            
            <div className="charset-card">
              <div className="charset-header">
                <div className="charset-icon">{charset.icon}</div>
                <div className="charset-info">
                  <div className="charset-label">{charset.label}</div>
                  <div className="charset-description">{charset.description}</div>
                </div>
              </div>
              
              <div className="charset-example">
                <div className="example-label">Example:</div>
                <div className="example-text">{charset.example}</div>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}