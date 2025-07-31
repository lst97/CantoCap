import React from 'react'
import { EnhancedWorkspacePanel, useWorkspacePanelIntegration } from '../workspace'

interface WorkspacePanelProps {
  onSettings?: () => void
}

/**
 * WorkspacePanel - Integration wrapper for enhanced workspace management
 * Phase 1 MVP: Maintains existing API while providing full workspace functionality
 */
export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  onSettings = () => console.log('Open settings')
}) => {
  const workspaceIntegration = useWorkspacePanelIntegration()

  return (
    <EnhancedWorkspacePanel
      {...workspaceIntegration}
      onSettings={onSettings}
    />
  )
}