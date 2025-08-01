/**
 * Example: App-level Integration with Centralized Configuration Manager
 * 
 * Shows how to integrate the enhanced workspace config provider
 * with your existing app structure.
 */

import React from 'react'
import { EnhancedWorkspaceConfigProvider } from '../contexts/EnhancedWorkspaceConfigContext'
import { ConfigurationStepExample, ProcessingStepExample } from './StepComponentExample'

// Example: Root App component integration
export const AppWithCentralizedConfig: React.FC = () => {
  return (
    <EnhancedWorkspaceConfigProvider>
      <div>
        <h1>CantonCap GUI - Centralized Configuration</h1>
        
        {/* Your existing app components */}
        <main>
          {/* Step components now use unified configuration */}
          <ConfigurationStepExample />
          <ProcessingStepExample />
          
          {/* Other components... */}
        </main>
      </div>
    </EnhancedWorkspaceConfigProvider>
  )
}

// Example: Gradual migration approach
export const AppWithGradualMigration: React.FC = () => {
  return (
    <EnhancedWorkspaceConfigProvider>
      {/* New components use enhanced config */}
      <ConfigurationStepExample />
      
      {/* Existing components continue working with original context */}
      {/* They can be migrated one by one */}
      <LegacyComponentThatStillWorks />
    </EnhancedWorkspaceConfigProvider>
  )
}

// Example: Legacy component that continues to work
const LegacyComponentThatStillWorks: React.FC = () => {
  // This still works because we re-export the original hooks
  const { useWorkspaceConfig } = await import('../contexts/EnhancedWorkspaceConfigContext')
  // Original functionality preserved
  
  return <div>Legacy component still works</div>
}