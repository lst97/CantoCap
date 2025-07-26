import React, { useCallback, useState } from 'react'
import { useAppStore } from '../../store/app-store'

export const AdvancedSettings = () => {
  const { config, updateConfig, showNotification } = useAppStore()
  const [showFFmpegPath, setShowFFmpegPath] = useState(false)

  const handleNumericChange = useCallback((key, value) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      updateConfig(key, numValue)
    }
  }, [updateConfig])

  const handleSelectChange = useCallback((key, value) => {
    updateConfig(key, value)
  }, [updateConfig])

  const handleConfigFileSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        updateConfig('terminologyConfig', result.filePaths[0])
        showNotification('Configuration file selected', 'success')
      }
    } catch (error) {
      showNotification(`Failed to select config file: ${error.message}`, 'error')
    }
  }, [updateConfig, showNotification])

  const handleFFmpegPathSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFileDialog({
        filters: [
          { name: 'Executable Files', extensions: ['exe', ''] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        updateConfig('ffmpegPath', result.filePaths[0])
        showNotification('FFmpeg path selected', 'success')
      }
    } catch (error) {
      showNotification(`Failed to select FFmpeg path: ${error.message}`, 'error')
    }
  }, [updateConfig, showNotification])

  const clearConfigFile = useCallback(() => {
    updateConfig('terminologyConfig', null)
  }, [updateConfig])

  const clearFFmpegPath = useCallback(() => {
    updateConfig('ffmpegPath', null)
  }, [updateConfig])

  const videoQualityOptions = [
    { value: '360p', label: '360p (Fast)', description: 'Low quality, faster processing' },
    { value: '480p', label: '480p (Balanced)', description: 'Medium quality and speed' },
    { value: '720p', label: '720p (High)', description: 'High quality, slower processing' }
  ]

  return (
    <div className="advanced-settings">
      <h3 className="section-title">🔧 Advanced Settings</h3>
      
      <div className="settings-grid">
        <div className="setting-group">
          <label className="setting-label">
            Max Chunk Duration (minutes)
          </label>
          <input
            type="number"
            className="setting-input"
            value={config.maxChunkDuration}
            onChange={(e) => handleNumericChange('maxChunkDuration', e.target.value)}
            min="5"
            max="60"
            step="5"
          />
          <div className="setting-description">
            Maximum duration for processing chunks. Smaller values use less memory.
          </div>
        </div>
        
        <div className="setting-group">
          <label className="setting-label">
            Video Quality for Analysis
          </label>
          <select
            className="setting-select"
            value={config.videoQuality}
            onChange={(e) => handleSelectChange('videoQuality', e.target.value)}
          >
            {videoQualityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="setting-description">
            {videoQualityOptions.find(opt => opt.value === config.videoQuality)?.description}
          </div>
        </div>
        
        <div className="setting-group">
          <label className="setting-label">
            Duration Estimate (minutes)
          </label>
          <input
            type="number"
            className="setting-input"
            value={config.duration}
            onChange={(e) => handleNumericChange('duration', e.target.value)}
            min="0.1"
            max="1440"
            step="0.5"
          />
          <div className="setting-description">
            Expected audio duration for hardware estimation and optimization.
          </div>
        </div>
      </div>
      
      <div className="file-settings">
        <div className="setting-group">
          <label className="setting-label">
            Terminology Configuration File
          </label>
          <div className="file-input-group">
            <input
              type="text"
              className="file-path-input"
              value={config.terminologyConfig || ''}
              placeholder="No configuration file selected"
              readOnly
            />
            <button
              type="button"
              className="file-browse-btn"
              onClick={handleConfigFileSelect}
            >
              Browse
            </button>
            {config.terminologyConfig && (
              <button
                type="button"
                className="file-clear-btn"
                onClick={clearConfigFile}
              >
                ✕
              </button>
            )}
          </div>
          <div className="setting-description">
            JSON file with custom terminology and language style rules.
          </div>
        </div>
        
        <div className="setting-group">
          <label className="setting-label">
            <div className="label-with-toggle">
              Custom FFmpeg Path
              <button
                type="button"
                className="toggle-setting-btn"
                onClick={() => setShowFFmpegPath(!showFFmpegPath)}
              >
                {showFFmpegPath ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          
          {showFFmpegPath && (
            <>
              <div className="file-input-group">
                <input
                  type="text"
                  className="file-path-input"
                  value={config.ffmpegPath || ''}
                  placeholder="Use system FFmpeg (recommended)"
                  readOnly
                />
                <button
                  type="button"
                  className="file-browse-btn"
                  onClick={handleFFmpegPathSelect}
                >
                  Browse
                </button>
                {config.ffmpegPath && (
                  <button
                    type="button"
                    className="file-clear-btn"
                    onClick={clearFFmpegPath}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="setting-description">
                Override system FFmpeg with a custom executable path.
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="advanced-note">
        <div className="note-icon">⚠️</div>
        <div className="note-content">
          <strong>Note:</strong> These are advanced settings. Default values work well for most use cases.
        </div>
      </div>
    </div>
  )
}