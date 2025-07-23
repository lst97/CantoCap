import React, { useCallback } from 'react'
import { useAppStore } from '../store/app-store'

export const TranslationSelector = () => {
  const { config, updateConfig } = useAppStore()

  const handleTranslationChange = useCallback((e) => {
    const value = e.target.value
    updateConfig('subtitle', value === 'none' ? null : value)
  }, [updateConfig])

  const translationOptions = [
    { value: 'none', label: 'No Translation', description: 'Output in original language only' },
    { value: 'en_us', label: 'English (US)', description: 'American English translation' },
    { value: 'en_gb', label: 'English (UK)', description: 'British English translation' },
    { value: 'ja_jp', label: '日本語 (Japanese)', description: 'Japanese translation' },
    { value: 'ko_kr', label: '한국어 (Korean)', description: 'Korean translation' },
    { value: 'es_es', label: 'Español (Spanish)', description: 'Spanish translation' },
    { value: 'fr_fr', label: 'Français (French)', description: 'French translation' },
    { value: 'de_de', label: 'Deutsch (German)', description: 'German translation' },
    { value: 'it_it', label: 'Italiano (Italian)', description: 'Italian translation' },
    { value: 'pt_br', label: 'Português (Portuguese)', description: 'Portuguese translation' },
    { value: 'ru_ru', label: 'Русский (Russian)', description: 'Russian translation' }
  ]

  const getCurrentSelection = () => {
    return config.subtitle || 'none'
  }

  const getSelectedOption = () => {
    return translationOptions.find(option => option.value === getCurrentSelection())
  }

  return (
    <div className="translation-selector">
      <label className="form-label">
        🌍 Subtitle Translation (Optional)
      </label>
      
      <div className="translation-description">
        Generate dual-language subtitles with translation alongside original text
      </div>
      
      <div className="translation-select-container">
        <select
          className="translation-select"
          value={getCurrentSelection()}
          onChange={handleTranslationChange}
        >
          {translationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="select-arrow">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      
      {config.subtitle && (
        <div className="translation-preview">
          <div className="preview-header">
            <span className="preview-icon">📝</span>
            <span className="preview-title">Output Format Preview:</span>
          </div>
          
          <div className="preview-content">
            <div className="subtitle-line original">
              <div className="line-number">1</div>
              <div className="line-text">
                <div className="timestamp">00:00:01,000 &rarr; 00:00:03,500</div>
                <div className="text-content">你好，歡迎收看我們的節目</div>
              </div>
            </div>
            
            <div className="subtitle-line translation">
              <div className="line-number">2</div>
              <div className="line-text">
                <div className="timestamp">00:00:01,000 &rarr; 00:00:03,500</div>
                <div className="text-content">{getSelectedOption()?.description.split(' ')[0]} translation text</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!config.subtitle && (
        <div className="no-translation-info">
          <div className="info-icon">ℹ️</div>
          <div className="info-content">
            <div className="info-title">Single language output</div>
            <div className="info-text">
              Subtitles will be generated in the original language only ({config.charset === 'traditional' ? 'Traditional' : 'Simplified'} Chinese)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}