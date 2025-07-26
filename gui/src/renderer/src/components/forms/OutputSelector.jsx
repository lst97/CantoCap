import React, { useCallback } from 'react'
import { useAppStore } from '../../store/app-store'

export const OutputSelector = () => {
  const { config, updateConfig, showNotification } = useAppStore()

  const handleOutputSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFolderDialog()
      
      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0]
        const fileName = config.inputFile 
          ? config.inputFile.split(/[\\/]/).pop().replace(/\.[^/.]+$/, '.srt')
          : 'output.srt'
        const outputPath = `${folderPath}/${fileName}`
        
        updateConfig('outputFile', outputPath)
        showNotification('Output location selected', 'success')
      }
    } catch (error) {
      showNotification(`Failed to select output location: ${error.message}`, 'error')
    }
  }, [config.inputFile, updateConfig, showNotification])

  const handleOutputChange = useCallback((e) => {
    updateConfig('outputFile', e.target.value)
  }, [updateConfig])

  const handleClearOutput = useCallback(() => {
    updateConfig('outputFile', null)
  }, [updateConfig])

  const getOutputFolder = (filePath) => {
    if (!filePath) return null
    const parts = filePath.split(/[\\/]/)
    parts.pop() // Remove filename
    return parts.join('/')
  }

  const getOutputFilename = (filePath) => {
    if (!filePath) return null
    return filePath.split(/[\\/]/).pop()
  }

  return (
    <div className="output-selector">
      <label className="form-label">
        📁 Output Location (Optional)
      </label>
      <div className="output-hint">
        If not specified, output will be saved next to the input file
      </div>
      
      <div className="output-input-container">
        <input
          type="text"
          className="output-path-input"
          value={config.outputFile || ''}
          onChange={handleOutputChange}
          placeholder="Auto-generated from input file"
        />
        
        <button
          type="button"
          className="output-browse-btn"
          onClick={handleOutputSelect}
          title="Browse for output folder"
        >
          📁
        </button>
        
        {config.outputFile && (
          <button
            type="button"
            className="output-clear-btn"
            onClick={handleClearOutput}
            title="Clear output location"
          >
            ✕
          </button>
        )}
      </div>
      
      {config.outputFile && (
        <div className="output-preview">
          <div className="output-info">
            <div className="output-filename">
              📄 {getOutputFilename(config.outputFile)}
            </div>
            <div className="output-folder">
              📁 {getOutputFolder(config.outputFile)}
            </div>
          </div>
        </div>
      )}
      
      {!config.outputFile && config.inputFile && (
        <div className="output-auto">
          <div className="auto-output-info">
            <div className="auto-icon">⚡</div>
            <div className="auto-text">
              <div>Auto-generated location:</div>
              <div className="auto-path">
                {config.inputFile.replace(/\.[^/.]+$/, '.srt')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}