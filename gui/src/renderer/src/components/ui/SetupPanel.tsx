import { DependencyStatus } from '../../../../types'
import { useState, useEffect } from 'react'

declare global {
  interface Window {
    cantocapAPI: {
      checkDependencies: () => Promise<Record<string, DependencyStatus>>;
      runInitialization: () => Promise<any>;
      openPythonDownload: () => Promise<void>;
      openPyenvGuide: () => Promise<void>;
      openFFmpegDownload: () => Promise<void>;
      runEngineSetup: () => Promise<boolean>;
    };
  }
}

interface SetupPanelProps {
  isVisible: boolean
  onClose: () => void
  onComplete: () => void
}

interface InitializationResult {
  success: boolean
  message: string
  dependencies: Record<string, DependencyStatus>
  requiresRestart?: boolean
}

export function SetupPanel({ isVisible, onClose, onComplete }: SetupPanelProps) {
  const [dependencies, setDependencies] = useState<Record<string, DependencyStatus>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [initializationResult, setInitializationResult] = useState<InitializationResult | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (isVisible) {
      checkDependencies()
    }
  }, [isVisible])

  const checkDependencies = async () => {
    setIsLoading(true)
    try {
      const deps = await window.cantocapAPI.checkDependencies()
      setDependencies(deps)
    } catch (error) {
      console.error('Failed to check dependencies:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const runInitialization = async () => {
    setIsLoading(true)
    try {
      const result = await window.cantocapAPI.runInitialization()
      setInitializationResult(result)
      if (result.success) {
        setTimeout(() => {
          onComplete()
        }, 2000)
      }
    } catch (error) {
      console.error('Initialization failed:', error)
      setInitializationResult({
        success: false,
        message: 'Initialization failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        dependencies: {}
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openPythonDownload = async () => {
    await window.cantocapAPI.openPythonDownload()
  }

  const openPyenvGuide = async () => {
    await window.cantocapAPI.openPyenvGuide()
  }

  const openFFmpegDownload = async () => {
    await window.cantocapAPI.openFFmpegDownload()
  }

  const runEngineSetup = async () => {
    setIsLoading(true)
    try {
      const success = await window.cantocapAPI.runEngineSetup()
      if (success) {
        await checkDependencies()
        setInitializationResult({
          success: true,
          message: 'Engine setup completed successfully',
          dependencies: {}
        })
      } else {
        setInitializationResult({
          success: false,
          message: 'Engine setup failed',
          dependencies: {}
        })
      }
    } catch (error) {
      console.error('Engine setup failed:', error)
      setInitializationResult({
        success: false,
        message: 'Engine setup failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        dependencies: {}
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isVisible) return null

  const hasAnyMissing = Object.values(dependencies).some(dep => dep.status === 'missing')
  const allSatisfied = Object.values(dependencies).every(dep => dep.status === 'available')

  return (
    <div className="setup-panel-overlay">
      <div className="setup-panel">
        <div className="setup-header">
          <h2>Setup & Dependencies</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="setup-content">
          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Checking dependencies...</p>
            </div>
          )}

          {!isLoading && (
            <>
              <div className="dependencies-section">
                <h3>Dependencies Status</h3>
                <div className="dependencies-list">
                  {Object.entries(dependencies).map(([key, dep]) => (
                    <div key={key} className={`dependency-item ${dep.status}`}>
                      <div className="dependency-info">
                        <span className="dependency-name">{dep.name}</span>
                        <span className={`dependency-status ${dep.status}`}>
                          {dep.status === 'available' && '✓ Installed'}
                          {dep.status === 'missing' && '✗ Missing'}
                          {dep.status === 'checking' && '⏳ Checking...'}
                          {dep.status === 'error' && '⚠ Error'}
                        </span>
                      </div>
                      {dep.version && (
                        <div className="dependency-version">Version: {dep.version}</div>
                      )}
                      {dep.status === 'missing' && (
                        <div className="dependency-actions">
                          <p className="help-text">{dep.helpText}</p>
                          {key === 'python' && (
                            <div className="action-buttons">
                              <button onClick={openPythonDownload} className="action-button primary">
                                Download Python
                              </button>
                              <button onClick={openPyenvGuide} className="action-button secondary">
                                pyenv Guide
                              </button>
                            </div>
                          )}
                          {key === 'ffmpeg' && (
                            <div className="action-buttons">
                              <button onClick={openFFmpegDownload} className="action-button primary">
                                Download FFmpeg
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="setup-actions">
                {hasAnyMissing && (
                  <div className="missing-deps-actions">
                    <h4>Quick Setup</h4>
                    <p>Install missing dependencies automatically:</p>
                    <button 
                      onClick={runInitialization} 
                      className="setup-button primary"
                      disabled={isLoading}
                    >
                      Auto-Install Dependencies
                    </button>
                  </div>
                )}

                <div className="manual-setup">
                  <h4>Manual Setup</h4>
                  <div className="setup-options">
                    <button 
                      onClick={runEngineSetup} 
                      className="setup-button secondary"
                      disabled={isLoading}
                    >
                      Run Engine Setup
                    </button>
                    <button 
                      onClick={checkDependencies} 
                      className="setup-button secondary"
                      disabled={isLoading}
                    >
                      Refresh Status
                    </button>
                  </div>
                </div>

                <div className="advanced-section">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="toggle-button"
                  >
                    {showAdvanced ? '▼' : '▶'} Advanced Options
                  </button>
                  
                  {showAdvanced && (
                    <div className="advanced-content">
                      <h5>Installation Guides</h5>
                      <div className="guide-links">
                        <a href="#" onClick={openPythonDownload}>Python Installation Guide</a>
                        <a href="#" onClick={openPyenvGuide}>pyenv Setup Guide</a>
                        <a href="#" onClick={openFFmpegDownload}>FFmpeg Installation Guide</a>
                      </div>
                      
                      <h5>System Information</h5>
                      <div className="system-info">
                        <p>Platform: {navigator.platform}</p>
                        <p>User Agent: {navigator.userAgent}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {initializationResult && (
                <div className={`initialization-result ${initializationResult.success ? 'success' : 'error'}`}>
                  <h4>{initializationResult.success ? 'Success!' : 'Error'}</h4>
                  <p>{initializationResult.message}</p>
                  {initializationResult.requiresRestart && (
                    <p className="restart-notice">
                      <strong>Note:</strong> Please restart the application to use the newly installed dependencies.
                    </p>
                  )}
                </div>
              )}

              {allSatisfied && !initializationResult && (
                <div className="all-satisfied">
                  <h4>✓ All Dependencies Satisfied</h4>
                  <p>Your system is ready to use CantoCap!</p>
                  <button onClick={onComplete} className="setup-button primary">
                    Continue
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .setup-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .setup-panel {
          background: white;
          border-radius: 12px;
          max-width: 800px;
          max-height: 90vh;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .setup-header {
          background: #f8f9fa;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .setup-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6c757d;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .close-button:hover {
          background-color: #e9ecef;
        }

        .setup-content {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .loading-indicator {
          text-align: center;
          padding: 40px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .dependencies-section {
          margin-bottom: 30px;
        }

        .dependencies-section h3 {
          margin-bottom: 15px;
          color: #2c3e50;
        }

        .dependency-item {
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
          background: #f8f9fa;
        }

        .dependency-item.found {
          border-color: #28a745;
          background: #d4edda;
        }

        .dependency-item.missing {
          border-color: #dc3545;
          background: #f8d7da;
        }

        .dependency-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }

        .dependency-name {
          font-weight: 600;
          color: #2c3e50;
        }

        .dependency-status {
          font-size: 14px;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .dependency-status.found {
          background: #28a745;
          color: white;
        }

        .dependency-status.missing {
          background: #dc3545;
          color: white;
        }

        .dependency-version, .dependency-path {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 5px;
        }

        .dependency-actions {
          margin-top: 10px;
        }

        .help-text {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 10px;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .action-button.primary {
          background: #007bff;
          color: white;
        }

        .action-button.primary:hover {
          background: #0056b3;
        }

        .action-button.secondary {
          background: #6c757d;
          color: white;
        }

        .action-button.secondary:hover {
          background: #545b62;
        }

        .setup-actions {
          border-top: 1px solid #e9ecef;
          padding-top: 20px;
        }

        .setup-actions h4 {
          margin-bottom: 10px;
          color: #2c3e50;
        }

        .setup-button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.2s;
          margin-right: 10px;
          margin-bottom: 10px;
        }

        .setup-button.primary {
          background: #28a745;
          color: white;
        }

        .setup-button.primary:hover:not(:disabled) {
          background: #1e7e34;
        }

        .setup-button.secondary {
          background: #6c757d;
          color: white;
        }

        .setup-button.secondary:hover:not(:disabled) {
          background: #545b62;
        }

        .setup-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .manual-setup, .missing-deps-actions {
          margin-bottom: 20px;
        }

        .setup-options {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .toggle-button {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          padding: 5px 0;
        }

        .advanced-content {
          margin-top: 15px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .advanced-content h5 {
          margin-bottom: 10px;
          color: #2c3e50;
        }

        .guide-links {
          margin-bottom: 15px;
        }

        .guide-links a {
          display: block;
          color: #007bff;
          text-decoration: none;
          margin-bottom: 5px;
          font-size: 14px;
        }

        .guide-links a:hover {
          text-decoration: underline;
        }

        .system-info p {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 5px;
          word-break: break-all;
        }

        .initialization-result {
          margin-top: 20px;
          padding: 15px;
          border-radius: 8px;
        }

        .initialization-result.success {
          background: #d4edda;
          border: 1px solid #28a745;
          color: #155724;
        }

        .initialization-result.error {
          background: #f8d7da;
          border: 1px solid #dc3545;
          color: #721c24;
        }

        .initialization-result h4 {
          margin-bottom: 10px;
        }

        .restart-notice {
          font-weight: 600;
          margin-top: 10px;
        }

        .all-satisfied {
          text-align: center;
          padding: 30px;
          background: #d4edda;
          border-radius: 8px;
          margin-top: 20px;
        }

        .all-satisfied h4 {
          color: #155724;
          margin-bottom: 10px;
        }

        .all-satisfied p {
          color: #155724;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  )
}