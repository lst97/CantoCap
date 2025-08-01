import React, { useState, useCallback, useMemo } from 'react'
import { Box, IconButton, Tooltip, Divider, Typography, CircularProgress, Alert } from '@mui/material'
import { 
  Add as AddIcon, 
  Settings as SettingsIcon,
  Warning as WarningIcon 
} from '@mui/icons-material'
import { 
  DndContext, 
  DragEndEvent, 
  DragOverEvent, 
  DragStartEvent,
  closestCenter,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  UniqueIdentifier,
  useDroppable
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { WorkspaceAvatar } from './WorkspaceAvatar'
import { WorkspaceGroup } from './WorkspaceGroup'
import { WorkspaceContextMenu } from './WorkspaceContextMenu'
import { WorkspaceCreationDialog } from './WorkspaceCreationDialog'
import { MigrationProgressDialog } from './MigrationProgressDialog'
import { useWorkspacePanelIntegration } from './hooks'
import type { Workspace } from './types'
import type { 
  WorkspaceGroup as WorkspaceGroupType, 
  WorkspaceWithGrouping, 
  WorkspaceGroupColor,
  DragOperation 
} from '../../types/workspace'

// UnGroup Drop Zone Component
const UnGroupZone: React.FC<{ isVisible: boolean; isActive: boolean }> = ({ isVisible, isActive }) => {
  const { setNodeRef } = useDroppable({
    id: 'ungroup-zone',
    data: { type: 'ungroup-zone' }
  })

  if (!isVisible) return null

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        right: '10px',
        height: '40px',
        backgroundColor: isActive 
          ? 'rgba(239, 68, 68, 0.2)' 
          : 'rgba(156, 163, 175, 0.1)',
        border: '2px dashed',
        borderColor: isActive 
          ? '#ef4444' 
          : '#9ca3af',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        opacity: isActive ? 1 : 0.6,
        transition: 'all 0.2s ease'
      }}
    >
      <Typography 
        variant="caption" 
        sx={{ 
          color: isActive ? '#ef4444' : '#9ca3af',
          fontWeight: 'bold',
          fontSize: '0.7rem'
        }}
      >
        Drop here to ungroup
      </Typography>
    </div>
  )
}

interface EnhancedWorkspacePanelProps {
  // Settings callback (only external prop needed now)
  onSettings?: () => void
  // Drag and drop configuration
  enableDragDrop?: boolean
  // Initial workspace groups (for demonstration)
  initialGroups?: WorkspaceGroupType[]
}

/**
 * EnhancedWorkspacePanel - Fully integrated workspace management panel
 * Now includes Discord-like workspace grouping with drag-and-drop functionality
 * Features: workspace reordering, group creation, drag-to-combine, visual feedback
 */
export const EnhancedWorkspacePanel: React.FC<EnhancedWorkspacePanelProps> = ({
  onSettings = () => console.log('Open settings'),
  enableDragDrop = true,
  initialGroups = []
}) => {
  // Get all workspace state and actions from integrated store
  const {
    workspaces,
    activeWorkspace,
    isMigrating,
    migrationPhase,
    migrationProgress,
    canRollback,
    isLoading,
    lastError,
    onCreateWorkspace,
    onSwitchWorkspace,
    onRenameWorkspace,
    onDuplicateWorkspace,
    onDeleteWorkspace,
    onRollback
  } = useWorkspacePanelIntegration()

  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    workspace: Workspace
    anchorEl: HTMLElement
  } | null>(null)
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null)

  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<{
    type: 'workspace' | 'group'
    id: string
    sourceGroupId?: string | null
  } | null>(null)
  const [dragOverItem, setDragOverItem] = useState<{
    type: 'workspace' | 'group' | 'empty-space'
    id?: string
    operation?: DragOperation
  } | null>(null)

  // Workspace Groups State (demo implementation - in production this would come from store)
  const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroupType[]>(initialGroups)
  const [workspaceGroupMappings, setWorkspaceGroupMappings] = useState<Record<string, string | null>>({})
  const [groupExpansionState, setGroupExpansionState] = useState<Record<string, boolean>>(
    initialGroups.reduce((acc, group) => ({ ...acc, [group.id]: group.isExpanded }), {})
  )

  // Enhanced event handlers with loading states and error handling
  const handleWorkspaceClick = useCallback(async (workspace: Workspace) => {
    if (workspace.id !== activeWorkspace?.id && !operationInProgress) {
      setOperationInProgress('switching')
      try {
        await onSwitchWorkspace(workspace.id)
      } catch (error) {
        console.error('Failed to switch workspace:', error)
      } finally {
        setOperationInProgress(null)
      }
    }
  }, [activeWorkspace?.id, onSwitchWorkspace, operationInProgress])

  const handleWorkspaceContextMenu = useCallback((event: React.MouseEvent<HTMLElement>, workspace: Workspace) => {
    event.preventDefault()
    if (!operationInProgress) {
      setContextMenu({
        workspace,
        anchorEl: event.currentTarget
      })
    }
  }, [operationInProgress])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleCreateWorkspace = useCallback(async (name: string, copyFromId?: string) => {
    setOperationInProgress('creating')
    try {
      await onCreateWorkspace(name, copyFromId)
      setCreateDialogOpen(false)
    } catch (error) {
      console.error('Failed to create workspace:', error)
      // Dialog stays open on error for user to retry
    } finally {
      setOperationInProgress(null)
    }
  }, [onCreateWorkspace])

  const handleSetActiveWorkspace = useCallback(async (workspaceId: string) => {
    setOperationInProgress('switching')
    try {
      await onSwitchWorkspace(workspaceId)
      setContextMenu(null)
    } catch (error) {
      console.error('Failed to set active workspace:', error)
    } finally {
      setOperationInProgress(null)
    }
  }, [onSwitchWorkspace])

  // Drag and Drop Helper Functions
  const generateGroupId = () => `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  const createNewGroup = useCallback((name: string, workspaceIds: string[], color: WorkspaceGroupColor = 'default'): WorkspaceGroupType => {
    const groupId = generateGroupId()
    return {
      id: groupId,
      name,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      position: workspaceGroups.length,
      isExpanded: true,
      metadata: {
        workspaceCount: workspaceIds.length
      }
    }
  }, [workspaceGroups.length])

  const addWorkspaceToGroup = useCallback((workspaceId: string, groupId: string) => {
    setWorkspaceGroupMappings(prev => ({ ...prev, [workspaceId]: groupId }))
  }, [])

  const removeWorkspaceFromGroup = useCallback((workspaceId: string) => {
    setWorkspaceGroupMappings(prev => ({ ...prev, [workspaceId]: null }))
  }, [])

  const updateGroupWorkspaceCount = useCallback((groupId: string) => {
    const workspaceCount = Object.values(workspaceGroupMappings).filter(id => id === groupId).length
    setWorkspaceGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, metadata: { ...group.metadata, workspaceCount } }
        : group
    ))
  }, [workspaceGroupMappings])

  // Organize workspaces by groups
  const organizedWorkspaces = useMemo(() => {
    const grouped: Record<string, WorkspaceWithGrouping[]> = {}
    const ungrouped: WorkspaceWithGrouping[] = []

    workspaces.forEach((workspace, index) => {
      const groupId = workspaceGroupMappings[workspace.id] || null
      const workspaceWithGrouping: WorkspaceWithGrouping = {
        ...workspace,
        groupId,
        positionInGroup: index
      }

      if (groupId) {
        if (!grouped[groupId]) grouped[groupId] = []
        grouped[groupId].push(workspaceWithGrouping)
      } else {
        ungrouped.push(workspaceWithGrouping)
      }
    })

    return { grouped, ungrouped }
  }, [workspaces, workspaceGroupMappings])

  // Drag and Drop Event Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const activeData = active.data.current
    
    if (activeData?.type === 'workspace') {
      setDraggedItem({
        type: 'workspace',
        id: active.id as string,
        sourceGroupId: activeData.workspace?.groupId || null
      })
    } else if (activeData?.type === 'group') {
      setDraggedItem({
        type: 'group',
        id: active.id as string
      })
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || !draggedItem) return

    const overData = over.data.current
    let operation: DragOperation = 'reorder-workspace'

    // Determine drag operation based on dragged item and drop target
    if (draggedItem.type === 'workspace' && overData?.type === 'workspace') {
      // Workspace onto workspace - could create group or reorder
      const overWorkspace = overData.workspace
      const draggedWorkspaceGroupId = draggedItem.sourceGroupId
      const overWorkspaceGroupId = overWorkspace?.groupId

      if (!draggedWorkspaceGroupId && !overWorkspaceGroupId) {
        operation = 'create-group' // Two ungrouped workspaces
      } else if (draggedWorkspaceGroupId !== overWorkspaceGroupId) {
        operation = 'move-to-group' // Moving between groups
      } else {
        operation = 'reorder-workspace' // Reordering within same group
      }
    } else if (draggedItem.type === 'workspace' && overData?.type === 'group') {
      operation = 'move-to-group'
    } else if (draggedItem.type === 'group') {
      operation = 'reorder-group'
    } else if (draggedItem.type === 'workspace' && over.id === 'ungroup-zone') {
      // Workspace dragged to ungroup zone
      operation = 'ungroup-workspace'
    } else if (draggedItem.type === 'workspace' && !overData) {
      // Workspace dragged to empty space - ungroup if currently grouped
      if (draggedItem.sourceGroupId) {
        operation = 'ungroup-workspace'
      }
    }

    setDragOverItem({
      type: overData?.type || 'empty-space',
      id: over.id as string,
      operation
    })
  }, [draggedItem])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || !draggedItem) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const overData = over.data.current
    const operation = dragOverItem?.operation

    try {
      if (operation === 'create-group' && draggedItem.type === 'workspace') {
        // Create new group with two workspaces
        const draggedWorkspaceId = draggedItem.id
        const overWorkspaceId = over.id as string
        
        if (draggedWorkspaceId !== overWorkspaceId) {
          const draggedWorkspace = workspaces.find(w => w.id === draggedWorkspaceId)
          const overWorkspace = workspaces.find(w => w.id === overWorkspaceId)
          
          if (draggedWorkspace && overWorkspace) {
            const newGroup = createNewGroup(
              `${draggedWorkspace.name} & ${overWorkspace.name}`,
              [draggedWorkspaceId, overWorkspaceId],
              'blue'
            )
            
            setWorkspaceGroups(prev => [...prev, newGroup])
            addWorkspaceToGroup(draggedWorkspaceId, newGroup.id)
            addWorkspaceToGroup(overWorkspaceId, newGroup.id)
            setGroupExpansionState(prev => ({ ...prev, [newGroup.id]: true }))
          }
        }
      } else if (operation === 'move-to-group' && draggedItem.type === 'workspace') {
        // Move workspace to different group
        const draggedWorkspaceId = draggedItem.id
        
        if (overData?.type === 'group') {
          addWorkspaceToGroup(draggedWorkspaceId, over.id as string)
        } else if (overData?.type === 'workspace') {
          const overWorkspace = overData.workspace
          if (overWorkspace?.groupId) {
            addWorkspaceToGroup(draggedWorkspaceId, overWorkspace.groupId)
          }
        }
      } else if (operation === 'ungroup-workspace' && draggedItem.type === 'workspace') {
        // Remove workspace from group
        removeWorkspaceFromGroup(draggedItem.id)
      }
      
      // Update group workspace counts
      workspaceGroups.forEach(group => updateGroupWorkspaceCount(group.id))
      
    } catch (error) {
      console.error('Failed to handle drag operation:', error)
    } finally {
      setDraggedItem(null)
      setDragOverItem(null)
    }
  }, [draggedItem, dragOverItem, workspaces, workspaceGroups, createNewGroup, addWorkspaceToGroup, removeWorkspaceFromGroup, updateGroupWorkspaceCount])

  // Group Management Functions
  const handleToggleGroupExpansion = useCallback((groupId: string) => {
    setGroupExpansionState(prev => ({ ...prev, [groupId]: !prev[groupId] }))
    setWorkspaceGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, isExpanded: !group.isExpanded }
        : group
    ))
  }, [])

  // Custom collision detection for better drag experience
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First, let's see if there are any collisions with the pointer
    const pointerIntersections = pointerWithin(args)
    if (pointerIntersections.length > 0) {
      return pointerIntersections
    }

    // If there are no pointer intersections, return rectangle intersections
    return rectIntersection(args)
  }, [])

  // Generate sortable items for DndKit
  const sortableItems = useMemo(() => {
    const items: UniqueIdentifier[] = []
    
    // Add all groups
    workspaceGroups.forEach(group => items.push(group.id))
    
    // Add ungrouped workspaces
    organizedWorkspaces.ungrouped.forEach(workspace => items.push(workspace.id))
    
    // Add workspaces within groups (for nested sorting)
    Object.values(organizedWorkspaces.grouped).flat().forEach(workspace => items.push(workspace.id))
    
    // Add ungroup zone as a droppable target
    items.push('ungroup-zone')
    
    return items
  }, [workspaceGroups, organizedWorkspaces])

  const renderWorkspaceList = () => {
    if (isLoading && workspaces.length === 0) {
      return (
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        }}>
          <CircularProgress size={24} />
        </Box>
      )
    }

    if (workspaces.length === 0) {
      return (
        <Box sx={{ 
          textAlign: 'center', 
          py: 2,
          opacity: 0.6
        }}>
          <Typography variant="caption" sx={{ 
            writingMode: 'vertical-lr',
            color: 'text.secondary',
            fontSize: '0.7rem'
          }}>
            No workspaces
          </Typography>
        </Box>
      )
    }

    return (
      <>
        {/* Render Workspace Groups */}
        {workspaceGroups.map((group) => {
          const groupWorkspaces = organizedWorkspaces.grouped[group.id] || []
          return (
            <WorkspaceGroup
              key={group.id}
              group={{ ...group, isExpanded: groupExpansionState[group.id] ?? group.isExpanded }}
              workspaces={groupWorkspaces}
              onToggleExpansion={handleToggleGroupExpansion}
              onWorkspaceClick={(workspace: WorkspaceWithGrouping) => handleWorkspaceClick(workspace)}
              onWorkspaceContextMenu={(event: React.MouseEvent, workspace: WorkspaceWithGrouping) => 
                handleWorkspaceContextMenu(event, workspace)
              }
            />
          )
        })}

        {/* Render Ungrouped Workspaces */}
        {organizedWorkspaces.ungrouped.map((workspace) => (
          <Box key={workspace.id} sx={{ position: 'relative' }}>
            <WorkspaceAvatar
              workspace={workspace}
              size="medium"
              isActive={workspace.id === activeWorkspace?.id}
              onClick={() => handleWorkspaceClick(workspace)}
              onContextMenu={(event) => handleWorkspaceContextMenu(event, workspace)}
              data={{
                type: 'workspace',
                workspace
              }}
            />
            {/* Switching indicator */}
            {operationInProgress === 'switching' && workspace.id === activeWorkspace?.id && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: 2
                }}
              >
                <CircularProgress size={20} sx={{ color: 'white' }} />
              </Box>
            )}
          </Box>
        ))}

        {/* Ungroup Drop Zone */}
        <UnGroupZone 
          isVisible={draggedItem?.type === 'workspace' && !!draggedItem?.sourceGroupId}
          isActive={dragOverItem?.operation === 'ungroup-workspace'}
        />

        {/* Drag Overlay Indicator */}
        {draggedItem && dragOverItem && dragOverItem.operation !== 'ungroup-workspace' && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '2px dashed',
              borderColor: 'primary.main',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              pointerEvents: 'none'
            }}
          >
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              {dragOverItem.operation === 'create-group' && 'Create Group'}
              {dragOverItem.operation === 'move-to-group' && 'Add to Group'}
              {dragOverItem.operation === 'reorder-workspace' && 'Reorder'}
            </Typography>
          </Box>
        )}
      </>
    )
  }

  return (
    <>
      <DndContext
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Box 
          sx={{ 
            width: 80,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
            gap: 2,
            borderRight: 1,
            borderColor: 'divider',
            height: '100%',
            overflow: 'hidden'
          }}
        >
        {/* Error Alert */}
        {lastError && (
          <Alert 
            severity="error" 
            sx={{ 
              width: '90%', 
              fontSize: '0.7rem',
              '& .MuiAlert-message': { overflow: 'hidden', textOverflow: 'ellipsis' }
            }}
          >
            {lastError.message || 'Workspace error'}
          </Alert>
        )}

        {/* Create New Workspace Button */}
        <Tooltip title="Create New Workspace" placement="right">
          <IconButton
            onClick={() => setCreateDialogOpen(true)}
            disabled={isMigrating || isLoading || operationInProgress === 'creating'}
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'primary.main',
              borderRadius: 2,
              color: 'white',
              position: 'relative',
              '&:hover': { 
                backgroundColor: 'primary.dark', 
                transform: 'scale(1.05)',
                boxShadow: 4
              },
              '&:disabled': {
                backgroundColor: 'grey.600',
                color: 'grey.400'
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: 2
            }}
          >
            {operationInProgress === 'creating' ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              <AddIcon sx={{ fontSize: 32 }} />
            )}
          </IconButton>
        </Tooltip>
        
        {/* Workspace List with Drag & Drop */}
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1.5,
            width: '100%',
            alignItems: 'center',
            overflow: 'auto',
            py: 1,
            position: 'relative'
          }}>
            {renderWorkspaceList()}
          </Box>
        </SortableContext>

        {/* Divider */}
        {workspaces.length > 0 && (
          <Divider sx={{ width: '60%', bgcolor: 'divider' }} />
        )}
        
        {/* Settings Button */}
        <Tooltip title="Settings" placement="right">
          <IconButton
            onClick={onSettings}
            disabled={isMigrating || isLoading}
            sx={{
              width: 40,
              height: 40,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                transform: 'scale(1.05)'
              },
              '&:disabled': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'grey.600'
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        </Box>
      </DndContext>

      {/* Workspace Creation Dialog */}
      <WorkspaceCreationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreateWorkspace={handleCreateWorkspace}
        availableWorkspaces={workspaces}
      />

      {/* Context Menu */}
      {contextMenu && (
        <WorkspaceContextMenu
          workspace={contextMenu.workspace}
          anchorEl={contextMenu.anchorEl}
          onClose={handleCloseContextMenu}
          onRename={onRenameWorkspace}
          onDuplicate={onDuplicateWorkspace}
          onDelete={onDeleteWorkspace}
          onSetActive={handleSetActiveWorkspace}
        />
      )}

      {/* Migration Progress Dialog */}
      <MigrationProgressDialog
        isOpen={isMigrating}
        currentPhase={migrationPhase}
        progress={migrationProgress}
        canRollback={canRollback}
        onRollback={onRollback}
        onClose={() => {}} // Migration dialog auto-closes on completion
      />
    </>
  )
}

// Create a wrapper component for backward compatibility
export const WorkspacePanel = EnhancedWorkspacePanel