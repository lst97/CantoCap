import React, { useState, useCallback } from 'react'
import { useAppStore } from '../../store/app-store'

export const APIKeyInput = () => {
  const { config, updateConfig } = useAppStore()
  const [showKey, setShowKey] = useState(false)
  const [keyValidation, setKeyValidation] = useState(null)

  const handleKeyChange = useCallback((e) => {
    const value = e.target.value
    updateConfig('geminiKey', value)
    
    if (value) {
      if (value.length < 20) {
        setKeyValidation({ valid: false, message: 'API key seems too short' })
      } else if (!value.startsWith('AI')) {
        setKeyValidation({ valid: false, message: 'Gemini API keys typically start with "AI"' })
      } else {
        setKeyValidation({ valid: true, message: 'API key format looks valid' })
      }
    } else {
      setKeyValidation(null)
    }
  }, [updateConfig])

  const handleToggleRefinement = useCallback(() => {
    updateConfig('noGeminiRefinement', !config.noGeminiRefinement)
  }, [config.noGeminiRefinement, updateConfig])

  const toggleShowKey = useCallback(() => {
    setShowKey(!showKey)
  }, [showKey])

  const clearKey = useCallback(() => {
    updateConfig('geminiKey', '')
    setKeyValidation(null)
  }, [updateConfig])

  const openGeminiDocs = useCallback(async () => {
    await window.cantocapAPI.openExternalUrl('https://makersuite.google.com/app/apikey')
  }, [])

  return (
    <div className="api-key-input">
      <label className="form-label">
        🔑 Google Gemini API Key (Optional)
      </label>
      
      <div className="api-key-description">
        Enables AI-powered transcription refinement for better accuracy
      </div>
      
      <div className="key-input-container">
        <div className="key-input-wrapper">
          <input
            type={showKey ? 'text' : 'password'}
            className={`key-input ${keyValidation?.valid === false ? 'invalid' : keyValidation?.valid ? 'valid' : ''}`}
            value={config.geminiKey}
            onChange={handleKeyChange}
            placeholder="Enter your Gemini API key here..."
          />
          
          <button
            type="button"
            className="key-toggle-btn"
            onClick={toggleShowKey}
            title={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? '🙈' : '👁️'}
          </button>
          
          {config.geminiKey && (
            <button
              type="button"
              className="key-clear-btn"
              onClick={clearKey}
              title="Clear API key"
            >
              ✕
            </button>
          )}
        </div>
        
        <button
          type="button"
          className="get-key-btn"
          onClick={openGeminiDocs}
          title="Get your free Gemini API key"
        >
          Get Key
        </button>
      </div>
      
      {keyValidation && (
        <div className={`key-validation ${keyValidation.valid ? 'valid' : 'invalid'}`}>
          <span className="validation-icon">
            {keyValidation.valid ? '✅' : '⚠️'}
          </span>
          <span className="validation-message">
            {keyValidation.message}
          </span>
        </div>
      )}
      
      <div className="refinement-option">
        <label className="refinement-label">
          <input
            type="checkbox"
            checked={!config.noGeminiRefinement}
            onChange={handleToggleRefinement}
            className="refinement-checkbox"
            disabled={!config.geminiKey}
          />
          <span className="refinement-text">
            Enable Gemini refinement (improves transcription accuracy)
          </span>
        </label>
      </div>
      
      {!config.geminiKey && (
        <div className="no-key-info">
          <div className="info-icon">ℹ️</div>
          <div className="info-content">
            <div className="info-title">No API key provided</div>
            <div className="info-text">
              CantoCap will work without an API key, but transcription accuracy may be lower.
              Get a free API key to enable AI-powered refinement.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}