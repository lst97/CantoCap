import React, { useCallback } from 'react'
import { useAppStore } from '../../store/app-store'

export const ProcessingOptions = () => {
  const { config, updateConfig } = useAppStore()

  const handleToggle = useCallback((key) => {
    updateConfig(key, !config[key])
  }, [config, updateConfig])

  const processingOptions = [
    {
      key: 'speakers',
      label: 'Speaker Diarization',
      icon: '👥',
      description: 'Identify and separate different speakers in the audio',
      example: 'Output: [SPEAKER_01] 我知道!',
      enabled: config.speakers
    },
    {
      key: 'music',
      label: 'Music Detection',
      icon: '🎵',
      description: 'Detect and label background music or sound effects',
      example: 'Output: [MUSIC]',
      enabled: config.music
    },
    {
      key: 'verbose',
      label: 'Verbose Output',
      icon: '📝',
      description: 'Show detailed processing information during transcription',
      example: 'Shows timestamps, confidence scores, and processing details',
      enabled: config.verbose
    },
    {
      key: 'noGeminiRefinement',
      label: 'Disable Gemini Refinement',
      icon: '🚫',
      description: 'Skip AI-powered transcription refinement (faster but less accurate)',
      example: 'Raw transcription without AI enhancement and error correction',
      enabled: config.noGeminiRefinement,
      inverted: true // This option is inverted (enabled = disabled feature)
    }
  ]

  return (
    <div className="processing-options">
      <h3 className="section-title">🎛️ Processing Options</h3>
      
      <div className="options-list">
        {processingOptions.map((option) => (
          <div key={option.key} className="processing-option">
            <label className="option-wrapper">
              <input
                type="checkbox"
                className="option-checkbox"
                checked={option.enabled}
                onChange={() => handleToggle(option.key)}
              />
              
              <div className="option-info">
                <div className="option-header">
                  <span className="option-icon">{option.icon}</span>
                  <span className="option-title">{option.label}</span>
                </div>
                <div className="option-description">
                  {option.description}
                </div>
                {option.example && (
                  <div className="option-example">
                    <strong>Example:</strong> {option.example}
                  </div>
                )}
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
      
      <div className="processing-note">
        <div className="note-icon">💡</div>
        <div className="note-content">
          <strong>Tip:</strong> Enable speaker diarization and music detection for more detailed subtitles, 
          but note that this will increase processing time. These features help create more professional and accessible subtitles.
        </div>
      </div>
      
      <div className="processing-features">
        <div className="features-header">
          <span className="features-icon">✨</span>
          <span className="features-title">Enhanced Features Preview</span>
        </div>
        <div className="features-examples">
          <div className="feature-example">
            <span className="example-label">Speaker ID:</span>
            <span className="example-text">[SPEAKER_01] Welcome to our podcast!</span>
          </div>
          <div className="feature-example">
            <span className="example-label">Music:</span>
            <span className="example-text">[MUSIC] Intro theme music [/MUSIC]</span>
          </div>
          <div className="feature-example">
            <span className="example-label">Enhanced:</span>
            <span className="example-text">AI-corrected grammar and punctuation</span>
          </div>
        </div>
      </div>
    </div>
  )
}