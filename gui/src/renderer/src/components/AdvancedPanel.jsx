import React from 'react'
import { ModelSettings } from './ModelSettings'
import { ProcessingOptions } from './ProcessingOptions'
import { AdvancedSettings } from './AdvancedSettings'
import { SystemStatus } from './SystemStatus'
import { useAppStore } from '../store/app-store'

export const AdvancedPanel = () => {
  const { toggleAdvanced } = useAppStore()

  return (
    <div className="advanced-panel" style={{ width: '100%' }}>
      <div className="panel-header">
        <h2>🔧 Advanced Options</h2>
        <button
          className="panel-toggle-btn"
          onClick={toggleAdvanced}
          title="Hide advanced options"
        >
          ✕
        </button>
      </div>
      
      <div className="panel-content" style={{ width: '100%' }}>
        <div className="advanced-section" style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}>
          <ModelSettings />
        </div>
        
        <div className="advanced-section" style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}>
          <ProcessingOptions />
        </div>
        
        <div className="advanced-section" style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}>
          <AdvancedSettings />
        </div>
        
        <div className="advanced-section" style={{ width: '100%' }}>
          <SystemStatus />
        </div>
      </div>
    </div>
  )
}