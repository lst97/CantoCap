import React from 'react'
import { EnhancedWorkspacePanel, useWorkspacePanelIntegration } from '../workspace'
import { useSettingsIntegration } from '../../hooks/useWorkflowIntegration'

interface WorkspacePanelProps {
  onSettings?: () => void
}

/**
 * WorkspacePanel - Integration wrapper for enhanced workspace management
 * Enhanced with settings mode integration
 */
export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  onSettings
}) => {
  const workspaceIntegration = useWorkspacePanelIntegration()
  const { enterSettings } = useSettingsIntegration()
  
  const handleSettingsClick = () => {
    if (onSettings) {
      onSettings()
    } else {
      // Default to entering settings mode with system tab
      enterSettings('system')
    }
  }

  return (
    <EnhancedWorkspacePanel
      {...workspaceIntegration}
      onSettings={handleSettingsClick}
    />
  )
}