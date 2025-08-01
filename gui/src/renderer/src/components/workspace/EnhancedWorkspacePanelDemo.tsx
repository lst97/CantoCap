import React from 'react'
import { Box, Typography, Paper } from '@mui/material'
import { EnhancedWorkspacePanel } from './EnhancedWorkspacePanel'
import type { WorkspaceGroup as WorkspaceGroupType } from '../../types/workspace'

/**
 * Demo component showcasing the enhanced workspace panel with drag-and-drop grouping
 * This demonstrates Discord-like workspace organization capabilities
 */
export const EnhancedWorkspacePanelDemo: React.FC = () => {
  // Sample groups for demonstration
  const demoGroups: WorkspaceGroupType[] = [
    {
      id: 'group-1',
      name: 'Content Projects',
      color: 'blue',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      position: 0,
      isExpanded: true,
      description: 'YouTube and media content projects',
      metadata: {
        workspaceCount: 3,
        lastAccessedAt: Date.now() - 3600000,
        statistics: {
          totalProcessingTime: 1200000,
          totalProcessedFiles: 15,
          averageProcessingTime: 80000
        }
      }
    },
    {
      id: 'group-2',
      name: 'Educational Videos',
      color: 'green',
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 172800000,
      position: 1,
      isExpanded: false,
      description: 'Educational and tutorial content',
      metadata: {
        workspaceCount: 2,
        lastAccessedAt: Date.now() - 7200000,
        statistics: {
          totalProcessingTime: 900000,
          totalProcessedFiles: 8,
          averageProcessingTime: 112500
        }
      }
    }
  ]

  return (
    <Box sx={{ display: 'flex', height: '100vh', gap: 3, p: 3 }}>
      {/* Enhanced Workspace Panel */}
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <EnhancedWorkspacePanel
          enableDragDrop={true}
          initialGroups={demoGroups}
          onSettings={() => console.log('Settings clicked')}
        />
      </Paper>

      {/* Demo Instructions */}
      <Box sx={{ flex: 1, p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Enhanced Workspace Panel Demo
        </Typography>
        
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          🎯 Features Demonstrated
        </Typography>
        
        <Box component="ul" sx={{ pl: 2 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Discord-like Groups:</strong> Workspaces organized in collapsible folders with color coding
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Drag & Drop:</strong> Drag workspaces onto each other to create groups automatically
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Group Management:</strong> Expand/collapse groups, move workspaces between groups
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Visual Feedback:</strong> Real-time visual indicators during drag operations
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Responsive Design:</strong> Maintains existing functionality while adding grouping
          </Typography>
        </Box>

        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          🖱️ How to Use
        </Typography>
        
        <Box component="ol" sx={{ pl: 2 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Create Groups:</strong> Drag one workspace onto another to automatically create a group
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Add to Groups:</strong> Drag workspace onto a group header or workspace within group
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Expand/Collapse:</strong> Click on group headers to toggle expansion state
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Context Menus:</strong> Right-click on workspaces for additional options
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Visual Cues:</strong> Watch for drag overlay indicators showing available operations
          </Typography>
        </Box>

        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          ⚙️ Technical Implementation
        </Typography>
        
        <Box component="ul" sx={{ pl: 2 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>@dnd-kit Integration:</strong> Modern, accessible drag-and-drop with TypeScript
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>State Management:</strong> Efficient React state with optimistic updates
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Performance Optimized:</strong> Memoized components and minimal re-renders
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Accessibility:</strong> Keyboard navigation and screen reader support
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Type Safe:</strong> Full TypeScript integration with workspace grouping types
          </Typography>
        </Box>

        <Paper sx={{ p: 2, mt: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
          <Typography variant="body2">
            <strong>💡 Pro Tip:</strong> This demo shows local state management. In production, 
            the grouping state would be persisted to the workspace store and synchronized 
            across sessions for a complete user experience.
          </Typography>
        </Paper>
      </Box>
    </Box>
  )
}