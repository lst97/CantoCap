import React, { useCallback } from 'react'
import { useAppStore } from '../store/app-store'

export const ModelSettings = () => {
  const { config, updateConfig } = useAppStore()

  const handleModelChange = useCallback((e) => {
    updateConfig('model', e.target.value === 'auto' ? null : e.target.value)
  }, [updateConfig])

  const handlePriorityChange = useCallback((e) => {
    updateConfig('priority', e.target.value)
  }, [updateConfig])

  const handleLanguageChange = useCallback((e) => {
    updateConfig('language', e.target.value)
  }, [updateConfig])

  const modelOptions = [
    { value: 'auto', label: 'Auto-select (Recommended)', description: 'Automatically choose the best model for your hardware' },
    { value: 'whisperX/large-v3', label: 'WhisperX Large v3', description: 'Highest accuracy, requires powerful GPU' },
    { value: 'whisperX/medium', label: 'WhisperX Medium', description: 'Good balance of speed and accuracy' },
    { value: 'whisperX/small', label: 'WhisperX Small', description: 'Faster processing, lower accuracy' },
    { value: 'openai/whisper-large-v3', label: 'OpenAI Whisper Large v3', description: 'High accuracy, slower processing' },
    { value: 'openai/whisper-medium', label: 'OpenAI Whisper Medium', description: 'Standard accuracy and speed' },
    { value: 'openai/whisper-small', label: 'OpenAI Whisper Small', description: 'Fast processing, basic accuracy' }
  ]

  const priorityOptions = [
    { value: 'speed', label: 'Speed', description: 'Prioritize fast processing over accuracy' },
    { value: 'balanced', label: 'Balanced', description: 'Balance between speed and accuracy' },
    { value: 'quality', label: 'Quality', description: 'Prioritize accuracy over processing speed' }
  ]

  const languageOptions = [
    { value: 'zh', label: 'Chinese (zh)', description: 'Chinese language detection' },
    { value: 'en', label: 'English (en)', description: 'English language detection' },
    { value: 'auto', label: 'Auto-detect', description: 'Automatically detect language' }
  ]

  return (
    <div className="model-settings">
      <h3 className="section-title">🎯 Model Settings</h3>
      
      <div className="setting-group">
        <label className="setting-label">
          Model Selection
        </label>
        <select
          className="setting-select"
          value={config.model || 'auto'}
          onChange={handleModelChange}
        >
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="setting-description">
          {modelOptions.find(opt => opt.value === (config.model || 'auto'))?.description}
        </div>
      </div>
      
      <div className="setting-group">
        <label className="setting-label">
          Processing Priority
        </label>
        <select
          className="setting-select"
          value={config.priority}
          onChange={handlePriorityChange}
        >
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="setting-description">
          {priorityOptions.find(opt => opt.value === config.priority)?.description}
        </div>
      </div>
      
      <div className="setting-group">
        <label className="setting-label">
          Language Detection
        </label>
        <select
          className="setting-select"
          value={config.language}
          onChange={handleLanguageChange}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="setting-description">
          {languageOptions.find(opt => opt.value === config.language)?.description}
        </div>
      </div>
    </div>
  )
}