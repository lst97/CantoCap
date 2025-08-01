import React, { useState } from 'react'
import { Box, Typography, Alert, Paper } from '@mui/material'
import { WorkspaceAvatar } from './WorkspaceAvatar'
import { WorkspaceContextMenu } from './WorkspaceContextMenu'
import { WorkspaceDeleteDialog } from './WorkspaceDeleteDialog'
import { Workspace } from './types'

/**
 * WorkspaceInteractionTest - Test component to validate UX improvements
 * Tests all interaction patterns: hover, click, drag, context menu, deletion
 */
export const WorkspaceInteractionTest: React.FC = () => {
  const [testWorkspace] = useState<Workspace>({
    id: 'test-workspace-1',
    name: 'Test Workspace',
    emoji: '🧪',
    color: '#F59E0B',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: false
  })

  const [contextMenu, setContextMenu] = useState<{
    workspace: Workspace
    anchorEl: HTMLElement
  } | null>(null)

  const [deleteDialog, setDeleteDialog] = useState(false)
  const [lastAction, setLastAction] = useState<string>('')

  const handleClick = () => {
    setLastAction('✅ Click detected - workspace switch')
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    setLastAction('✅ Context menu opened - right click detected')
    setContextMenu({
      workspace: testWorkspace,
      anchorEl: event.currentTarget
    })
  }

  const handleCloseContextMenu = () => {
    setContextMenu(null)
  }

  const handleRename = async (workspaceId: string, newName: string) => {
    setLastAction(`✅ Rename triggered: ${newName}`)
    setContextMenu(null)
  }

  const handleDuplicate = async (workspaceId: string) => {
    setLastAction('✅ Duplicate triggered')
    setContextMenu(null)
  }

  const handleDelete = async (workspaceId: string) => {
    setLastAction('✅ Delete confirmed')
    setDeleteDialog(false)
    setContextMenu(null)
  }

  const handleSetActive = async (workspaceId: string) => {
    setLastAction('✅ Set active triggered')
    setContextMenu(null)
  }

  const openDeleteDialog = () => {
    setDeleteDialog(true)
    setContextMenu(null)
  }

  return (
    <Box sx={{ p: 4, maxWidth: 600 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Workspace Interaction UX Test
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Test the following interactions:
        <ul>
          <li><strong>Hover:</strong> Should show pointer cursor + subtle highlight</li>
          <li><strong>Left Click:</strong> Should trigger workspace switch</li>
          <li><strong>Right Click:</strong> Should open context menu</li>
          <li><strong>Drag:</strong> Should work for grouping (disabled in this test)</li>
        </ul>
      </Alert>

      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Test Workspace Avatar</Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <WorkspaceAvatar
            workspace={testWorkspace}
            size="large"
            isActive={false}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            enableDragDrop={false} // Disabled for this test
          />
        </Box>

        <Typography variant="body2" color="text.secondary" textAlign="center">
          Try hovering, clicking, and right-clicking the workspace avatar above
        </Typography>
      </Paper>

      {lastAction && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <strong>Last Action:</strong> {lastAction}
        </Alert>
      )}

      <Paper sx={{ p: 2, backgroundColor: 'action.hover' }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Expected Behavior:</strong>
          <br />• Cursor should always be "pointer" (not "grab")
          <br />• Hover should show subtle highlight
          <br />• Click should log workspace switch
          <br />• Right-click should open context menu
          <br />• Context menu should show enhanced descriptions
          <br />• Delete should show confirmation dialog
        </Typography>
      </Paper>

      {/* Context Menu */}
      {contextMenu && (
        <WorkspaceContextMenu
          workspace={contextMenu.workspace}
          anchorEl={contextMenu.anchorEl}
          onClose={handleCloseContextMenu}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onSetActive={handleSetActive}
        />
      )}

      {/* Delete Dialog */}
      <WorkspaceDeleteDialog
        open={deleteDialog}
        workspace={testWorkspace}
        loading={false}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => handleDelete(testWorkspace.id)}
      />
    </Box>
  )
}