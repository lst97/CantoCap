import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, IconButton, Tooltip, Typography, Collapse, Divider } from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowLeft as KeyboardArrowLeftIcon,
} from '@mui/icons-material';
import { WorkspaceContextMenu } from '../workspace/WorkspaceContextMenu';
import { GroupContextMenu } from '../workspace/GroupContextMenu';
import { WorkspaceCreationDialog } from '../workspace/WorkspaceCreationDialog';
import { WorkspaceDeleteDialog } from '../workspace/WorkspaceDeleteDialog';
import { WorkspaceRenameDialog } from '../workspace/WorkspaceRenameDialog';
import { GroupCreationDialog } from '../workspace/GroupCreationDialog';
import {
  useWorkspaceList,
  useWorkspaceLoading,
  useWorkspaceCount,
  useAvailableGroups,
  useCreateWorkspace,
  useSwitchWorkspace,
  useRenameWorkspace,
  useDuplicateWorkspace,
  useDeleteWorkspace,
  useCreateGroup,
  useAddWorkspaceToGroup,
  useRemoveWorkspaceFromGroup,
  useToggleGroupExpansion,
} from '../../stores/useWorkspaceStore';
import { useActiveWorkspaceId } from '../../stores/useAppStore';
import { useSubtitleActions, useSaveState } from '../../stores/useSubtitleEditStore';
import { WorkspaceSwitchingOverlay } from '../ui/WorkspaceSwitchingOverlay';
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog';
import { getGroupColorRgb } from '../workspace/GroupColorPicker';
import type { WorkspaceWithGrouping, WorkspaceGroupColor } from '../../stores/types/StoreTypes';
import { createComponentLogger } from '../../utils/logger';

interface WorkspacePanelProps {
  onSettings?: () => void;
}

/**
 * WorkspacePanel - Discord-style tiny workspace sidebar
 * Shows workspace avatars in a vertical column like Discord servers
 */
export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({ onSettings }) => {
  // Use direct store hooks with stable references
  const workspaceListRaw = useWorkspaceList();
  const activeWorkspaceId = useActiveWorkspaceId();
  const logger = createComponentLogger('WorkspacePanel');

  // Ref for debug logging optimization
  const prevActiveIdRef = React.useRef<string | null>(null);
  const isLoading = useWorkspaceLoading();
  const workspaceCount = useWorkspaceCount();

  // Compute workspaces with isActive property
  const workspaces = useMemo(() => {
    if (!workspaceListRaw) return [];

    // Compute isActive for each workspace
    const computedWorkspaces = workspaceListRaw.map((workspace) => {
      const isActive = workspace.id === activeWorkspaceId;
      return {
        ...workspace,
        isActive,
      };
    }) as WorkspaceWithGrouping[];

    // Debug info for active workspace - only log on changes to avoid spam
    const activeWorkspace = computedWorkspaces.find((w) => w.isActive);
    if (workspaceListRaw.length > 0 && prevActiveIdRef.current !== activeWorkspaceId) {
      logger.info(
        `🔍 Workspaces: ${workspaceListRaw.length} Active: ${activeWorkspace?.name || 'None'}`
      );
      prevActiveIdRef.current = activeWorkspaceId;
    }

    return computedWorkspaces;
  }, [workspaceListRaw, activeWorkspaceId, logger]);

  // Get pre-computed grouping data directly from store (stable references)
  const availableGroups = useAvailableGroups();

  // Get action hooks directly from store
  const createWorkspace = useCreateWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const renameWorkspace = useRenameWorkspace();
  const duplicateWorkspace = useDuplicateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const createGroup = useCreateGroup();
  const addWorkspaceToGroup = useAddWorkspaceToGroup();
  const removeWorkspaceFromGroup = useRemoveWorkspaceFromGroup();
  const toggleGroupExpansion = useToggleGroupExpansion();

  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceWithGrouping | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<WorkspaceWithGrouping | null>(null);
  const [groupCreationDialogOpen, setGroupCreationDialogOpen] = useState(false);
  const [currentWorkspaceForGroup, setCurrentWorkspaceForGroup] =
    useState<WorkspaceWithGrouping | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    workspace: WorkspaceWithGrouping;
    anchorEl: HTMLElement;
  } | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<{
    group: WorkspaceWithGrouping['group'];
    anchorEl: HTMLElement;
  } | null>(null);

  // Scroll edge detection state
  const [showTopIndicator, setShowTopIndicator] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(false);

  // Workspace switching overlay state
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingWorkspaceName, setSwitchingWorkspaceName] = useState('');

  // Unsaved changes detection state
  const { saveToWorkspace, loadSubtitlesForWorkspace } = useSubtitleActions();
  const { isDirty, isSaving, saveError } = useSaveState();
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingWorkspaceSwitch, setPendingWorkspaceSwitch] =
    useState<WorkspaceWithGrouping | null>(null);

  // Organize workspaces by groups
  const groupedWorkspaces = useMemo(() => {
    if (!workspaces || workspaces.length === 0) return { grouped: [], ungrouped: [] };

    const ungrouped: WorkspaceWithGrouping[] = [];

    // Create a map to avoid duplicate groups
    const groupMap = new Map<
      string,
      {
        group: WorkspaceWithGrouping['group'];
        workspaces: WorkspaceWithGrouping[];
      }
    >();

    workspaces.forEach((workspace) => {
      if (workspace.group) {
        const groupId = workspace.group.id;
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, {
            group: workspace.group,
            workspaces: [],
          });
        }
        groupMap.get(groupId)!.workspaces.push(workspace);
      } else {
        ungrouped.push(workspace);
      }
    });

    // Sort groups by position and workspaces by creation date
    const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
      if (!a.group || !b.group) return 0;
      return a.group.position - b.group.position;
    });

    sortedGroups.forEach((groupData) => {
      groupData.workspaces.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    ungrouped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { grouped: sortedGroups, ungrouped };
  }, [workspaces]);

  // Handle group expansion toggle
  const handleGroupToggle = useCallback(
    async (groupId: string) => {
      try {
        await toggleGroupExpansion(groupId);
      } catch (error) {
        logger.error('Failed to toggle group expansion:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [toggleGroupExpansion, logger]
  );

  // Event handlers with proper error handling and unsaved changes detection
  const handleWorkspaceClick = useCallback(
    async (workspace: WorkspaceWithGrouping) => {
      try {
        // Skip if already active workspace
        if (workspace.isActive) {
          return;
        }

        // Check for unsaved changes before switching
        if (isDirty) {
          setPendingWorkspaceSwitch(workspace);
          setShowUnsavedDialog(true);
          return;
        }

        // Auto-expand group if workspace belongs to collapsed group
        if (workspace.group && !workspace.group.isExpanded) {
          await handleGroupToggle(workspace.group.id);
        }

        // Show loading overlay
        setSwitchingWorkspaceName(workspace.name);
        setIsSwitching(true);

        // Switch workspace
        await switchWorkspace(workspace.id);

        // Hide loading overlay
        setIsSwitching(false);
      } catch (error) {
        logger.error('Failed to switch workspace:', {
          error: error instanceof Error ? error.message : String(error),
        });
        setIsSwitching(false);
      }
    },
    [switchWorkspace, handleGroupToggle, isDirty, logger]
  );

  const handleWorkspaceContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, workspace: WorkspaceWithGrouping) => {
      event.preventDefault();
      // Ensure the element is valid and attached to the DOM
      const target = event.currentTarget;
      if (
        target &&
        document.contains(target) &&
        target.offsetParent !== null &&
        target.isConnected
      ) {
        // Additional check: ensure the element has proper dimensions
        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContextMenu({
            workspace,
            anchorEl: target,
          });
        }
      }
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleGroupContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, group: WorkspaceWithGrouping['group']) => {
      event.preventDefault();
      const target = event.currentTarget;
      if (
        target &&
        document.contains(target) &&
        target.offsetParent !== null &&
        target.isConnected &&
        group
      ) {
        // Additional check: ensure the element has proper dimensions
        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setGroupContextMenu({
            group,
            anchorEl: target,
          });
        }
      }
    },
    []
  );

  const handleCloseGroupContextMenu = useCallback(() => {
    setGroupContextMenu(null);
  }, []);

  // Effect to close context menus when DOM structure changes (e.g., groups deleted, workspaces moved)
  useEffect(() => {
    // If we have an active workspace context menu, check if its anchor is still valid
    if (contextMenu && contextMenu.anchorEl) {
      if (!document.contains(contextMenu.anchorEl) || contextMenu.anchorEl.offsetParent === null) {
        setContextMenu(null);
      }
    }

    // If we have an active group context menu, check if its anchor is still valid
    if (groupContextMenu && groupContextMenu.anchorEl) {
      if (
        !document.contains(groupContextMenu.anchorEl) ||
        groupContextMenu.anchorEl.offsetParent === null
      ) {
        setGroupContextMenu(null);
      }
    }
  }, [groupedWorkspaces, contextMenu, groupContextMenu]);

  const handleCreateWorkspace = useCallback(
    async (
      name: string,
      copyFromId?: string,
      backgroundColor?: string,
      emoji?: string,
      groupInfo?: {
        action: 'existing' | 'new';
        groupId?: string;
        newGroupName?: string;
        newGroupColor?: WorkspaceGroupColor;
      }
    ) => {
      try {
        let workspaceId: string;

        // Create the workspace first
        if (copyFromId) {
          const result = await duplicateWorkspace(copyFromId, name);
          if (!result) {
            throw new Error('Failed to duplicate workspace');
          }
          workspaceId = result;
        } else {
          workspaceId = await createWorkspace(name, backgroundColor, emoji);
        }

        // Handle group assignment if specified
        if (groupInfo && workspaceId) {
          let groupId = groupInfo.groupId;

          // Create new group if needed
          if (groupInfo.action === 'new' && groupInfo.newGroupName) {
            groupId = await createGroup(
              groupInfo.newGroupName,
              groupInfo.newGroupColor || 'default'
            );
          }

          // Add workspace to group
          if (groupId) {
            await addWorkspaceToGroup(workspaceId, groupId);
          }
        }

        setCreateDialogOpen(false);
      } catch (error) {
        logger.error('Failed to create workspace:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [createWorkspace, duplicateWorkspace, createGroup, addWorkspaceToGroup, logger]
  );

  const handleSetActiveWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        // Find workspace name for loading message
        const workspace = workspaces.find((w) => w.id === workspaceId);
        const workspaceName = workspace?.name || 'workspace';

        // Show loading overlay
        setSwitchingWorkspaceName(workspaceName);
        setIsSwitching(true);

        // Switch workspace
        await switchWorkspace(workspaceId);

        // Hide loading and close context menu
        setIsSwitching(false);
        setContextMenu(null);
      } catch (error) {
        logger.error('Failed to set active workspace:', {
          error: error instanceof Error ? error.message : String(error),
        });
        setIsSwitching(false);
        setContextMenu(null);
      }
    },
    [switchWorkspace, workspaces, logger]
  );

  const handleRenameWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (workspace) {
        setWorkspaceToRename(workspace);
        setRenameDialogOpen(true);
        setContextMenu(null); // Close context menu
      }
    },
    [workspaces]
  );

  const handleConfirmRenameWorkspace = useCallback(
    async (newName: string) => {
      if (!workspaceToRename) return;

      try {
        await renameWorkspace(workspaceToRename.id, newName);
        setRenameDialogOpen(false);
        setWorkspaceToRename(null);
      } catch (error) {
        logger.error('Failed to rename workspace:', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Error handling is managed by the store, but keep dialog open
      }
    },
    [renameWorkspace, workspaceToRename, logger]
  );

  const handleCloseRenameDialog = useCallback(() => {
    setRenameDialogOpen(false);
    setWorkspaceToRename(null);
  }, []);

  const handleCreateNewGroup = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (workspace) {
        setCurrentWorkspaceForGroup(workspace);
        setGroupCreationDialogOpen(true);
        setContextMenu(null); // Close context menu
      }
    },
    [workspaces]
  );

  const handleConfirmCreateGroup = useCallback(
    async (name: string, color: WorkspaceGroupColor, workspaceIds: string[]): Promise<string> => {
      try {
        // Create the group with the proper color
        const groupId = await createGroup(name, color);

        // Add all selected workspaces to the group
        for (const workspaceId of workspaceIds) {
          await addWorkspaceToGroup(workspaceId, groupId);
        }

        setGroupCreationDialogOpen(false);
        setCurrentWorkspaceForGroup(null);
        return groupId;
      } catch (error) {
        logger.error('Failed to create group:', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Re-throw to let the dialog handle it
      }
    },
    [createGroup, addWorkspaceToGroup, logger]
  );

  const handleCloseGroupCreationDialog = useCallback(() => {
    setGroupCreationDialogOpen(false);
    setCurrentWorkspaceForGroup(null);
  }, []);

  const handleDuplicateWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
        const defaultName = `Copy of ${currentWorkspace?.name || 'Workspace'}`;
        await duplicateWorkspace(workspaceId, defaultName);
        setContextMenu(null);
      } catch (error) {
        logger.error('Failed to duplicate workspace:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [duplicateWorkspace, workspaces, logger]
  );

  const handleDeleteWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (workspace) {
        setWorkspaceToDelete(workspace);
        setDeleteDialogOpen(true);
        setContextMenu(null); // Close context menu
      }
    },
    [workspaces]
  );

  const handleConfirmDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete) return;

    try {
      await deleteWorkspace(workspaceToDelete.id);
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    } catch (error) {
      logger.error('Failed to delete workspace:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Error handling is managed by the store, but keep dialog open
    }
  }, [deleteWorkspace, workspaceToDelete, logger]);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setWorkspaceToDelete(null);
  }, []);

  // Handle scroll events for edge detection
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const tolerance = 5; // Small tolerance for edge detection

    // Only show indicators if content is scrollable
    const hasScrollableContent = scrollHeight > clientHeight;

    const isAtTop = scrollTop <= tolerance;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - tolerance;

    setShowTopIndicator(hasScrollableContent && isAtTop);
    setShowBottomIndicator(hasScrollableContent && isAtBottom);
  }, []);

  // Unsaved changes dialog handlers for workspace switching
  const handleSaveAndSwitchWorkspace = useCallback(async () => {
    try {
      await saveToWorkspace();
      setShowUnsavedDialog(false);

      if (pendingWorkspaceSwitch) {
        // Auto-expand group if workspace belongs to collapsed group
        if (pendingWorkspaceSwitch.group && !pendingWorkspaceSwitch.group.isExpanded) {
          await handleGroupToggle(pendingWorkspaceSwitch.group.id);
        }

        // Show loading overlay
        setSwitchingWorkspaceName(pendingWorkspaceSwitch.name);
        setIsSwitching(true);

        // Switch workspace
        await switchWorkspace(pendingWorkspaceSwitch.id);

        // Hide loading overlay
        setIsSwitching(false);
        setPendingWorkspaceSwitch(null);
      }
    } catch (error) {
      logger.error('Failed to save before workspace switch:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Dialog stays open to show error
    }
  }, [saveToWorkspace, switchWorkspace, handleGroupToggle, pendingWorkspaceSwitch, logger]);

  const handleDiscardAndSwitchWorkspace = useCallback(async () => {
    try {
      // Reload from last saved state to discard changes
      if (activeWorkspaceId) {
        await loadSubtitlesForWorkspace(activeWorkspaceId, '', []);
      }

      setShowUnsavedDialog(false);

      if (pendingWorkspaceSwitch) {
        // Auto-expand group if workspace belongs to collapsed group
        if (pendingWorkspaceSwitch.group && !pendingWorkspaceSwitch.group.isExpanded) {
          await handleGroupToggle(pendingWorkspaceSwitch.group.id);
        }

        // Show loading overlay
        setSwitchingWorkspaceName(pendingWorkspaceSwitch.name);
        setIsSwitching(true);

        // Switch workspace
        await switchWorkspace(pendingWorkspaceSwitch.id);

        // Hide loading overlay
        setIsSwitching(false);
        setPendingWorkspaceSwitch(null);
      }
    } catch (error) {
      logger.error('Failed to switch workspace after discard:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue anyway
      setShowUnsavedDialog(false);
      if (pendingWorkspaceSwitch) {
        setSwitchingWorkspaceName(pendingWorkspaceSwitch.name);
        setIsSwitching(true);
        await switchWorkspace(pendingWorkspaceSwitch.id);
        setIsSwitching(false);
        setPendingWorkspaceSwitch(null);
      }
    }
  }, [
    loadSubtitlesForWorkspace,
    activeWorkspaceId,
    switchWorkspace,
    handleGroupToggle,
    pendingWorkspaceSwitch,
    logger,
  ]);

  const handleCancelWorkspaceSwitch = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingWorkspaceSwitch(null);
  }, []);

  return (
    <Box
      sx={{
        width: 72, // Discord-like narrow sidebar
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgb(32, 34, 37)', // Discord dark sidebar color
        borderRadius: 0,
        overflow: 'hidden',
        py: 1,
      }}
    >
      {/* Create workspace button at top */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <Tooltip title='Create new workspace' placement='right'>
          <IconButton
            onClick={() => setCreateDialogOpen(true)}
            disabled={isLoading}
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'rgb(54, 57, 63)',
              color: 'rgb(176, 180, 185)',
              borderRadius: '50%',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'white',
                borderRadius: '16px',
                transition: 'all 0.2s ease',
              },
            }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Separator line */}
      {workspaceCount > 0 && (
        <Box
          sx={{
            height: 2,
            backgroundColor: 'rgb(54, 57, 63)',
            mx: 2,
            mb: 1,
            borderRadius: 1,
          }}
        />
      )}

      {/* Workspace avatars */}
      <Box
        onScroll={handleScroll}
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          px: 1,
          position: 'relative',
          // Hide scrollbar but keep scroll behavior
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }}
      >
        {/* Edge scroll indicators - bottom-right positioned */}
        {showTopIndicator && (
          <Box
            sx={{
              position: 'absolute',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(204, 122, 0, 0.8), rgba(204, 122, 0, 0.4))',
              boxShadow: '0 0 8px rgba(204, 122, 0, 0.6)',
              zIndex: 2,
              opacity: showTopIndicator ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: 'none',
            }}
          />
        )}

        {showBottomIndicator && (
          <Box
            sx={{
              position: 'absolute',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(204, 122, 0, 0.8), rgba(204, 122, 0, 0.4))',
              boxShadow: '0 0 8px rgba(204, 122, 0, 0.6)',
              zIndex: 2,
              opacity: showBottomIndicator ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Render grouped workspaces */}
        {groupedWorkspaces.grouped.map((groupData) => {
          if (!groupData.group) return null;

          const group = groupData.group;
          const groupColor = getGroupColorRgb(group.color);
          const isExpanded = group.isExpanded;

          return (
            <Box key={group.id} sx={{ width: '100%', mb: 2.5 }}>
              {/* Group Header */}
              <Tooltip title={group.name} placement='right' arrow>
                <Box
                  onClick={() => handleGroupToggle(group.id)}
                  onContextMenu={(event) => handleGroupContextMenu(event, group)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    backgroundColor: 'rgb(40, 43, 48)',
                    border: `1px solid ${groupColor}`,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'rgb(47, 50, 56)',
                      borderColor: groupColor,
                    },
                  }}
                >
                  <Box
                    sx={{
                      color: groupColor,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      mr: 0.25,
                      fontSize: '0.8rem',
                    }}
                  >
                    {isExpanded ? (
                      <KeyboardArrowDownIcon fontSize='inherit' />
                    ) : (
                      <KeyboardArrowLeftIcon fontSize='inherit' />
                    )}
                  </Box>
                  <Typography
                    variant='caption'
                    sx={{
                      color: 'rgb(185, 187, 190)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 52,
                    }}
                  >
                    {group.name}
                  </Typography>
                </Box>
              </Tooltip>

              {/* Collapsed Group Preview - Vertical Stacked Avatars */}
              {!isExpanded && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mt: 1, // Increased margin for better spacing from divider
                    gap: 0, // Remove gap for tight stacking
                  }}
                >
                  {/* Show up to 2 avatars vertically stacked with count overlay */}
                  <Box sx={{ position: 'relative' }}>
                    {groupData.workspaces.slice(0, 2).map((workspace, index) => (
                      <Tooltip
                        key={workspace.id}
                        title={`${workspace.name} (${group.name})`}
                        placement='right'
                      >
                        <Box
                          onClick={() => handleWorkspaceClick(workspace)}
                          onContextMenu={(event) => handleWorkspaceContextMenu(event, workspace)}
                          sx={{
                            width: 42, // Larger size for collapsed state
                            height: 42, // Larger size for collapsed state
                            backgroundColor: workspace.isActive
                              ? workspace.backgroundColor || 'primary.main'
                              : workspace.backgroundColor || 'rgb(54, 57, 63)',
                            color: 'white',
                            borderRadius: workspace.isActive ? '12px' : '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1.1rem', // Slightly larger font
                            fontWeight: 'bold',
                            transition: 'all 0.15s ease-out',
                            border: `2px solid ${workspace.isActive ? groupColor : 'rgb(32, 34, 37)'}`,
                            boxShadow: workspace.isActive
                              ? '0 3px 8px rgba(0, 0, 0, 0.3)'
                              : '0 2px 4px rgba(0, 0, 0, 0.2)',
                            // Create tight overlap effect by using larger negative margin on second item
                            marginTop: index > 0 ? '-12px' : '0',
                            zIndex: 2 - index, // Higher z-index for first item
                            '&:hover': {
                              transform: 'scale(1.1)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                              zIndex: 10,
                            },
                          }}
                        >
                          {workspace.emoji || workspace.name.charAt(0).toUpperCase()}
                        </Box>
                      </Tooltip>
                    ))}

                    {/* Show count for remaining workspaces - positioned at the bottom center */}
                    {groupData.workspaces.length > 2 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -6,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 24,
                          height: 16,
                          backgroundColor: 'rgba(54, 57, 63, 0.95)',
                          color: 'rgba(255, 255, 255, 0.7)', // Lighter text color
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: 'normal', // Less bold for lighter appearance
                          border: `1px solid rgba(255, 255, 255, 0.3)`, // Lighter border
                          zIndex: 10,
                        }}
                      >
                        +{groupData.workspaces.length - 2}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {/* Expanded Group - Individual Workspace Avatars */}
              <Collapse in={isExpanded} timeout={300}>
                <Box
                  sx={{
                    mt: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  {groupData.workspaces.map((workspace) => (
                    <Tooltip key={workspace.id} title={workspace.name} placement='right'>
                      <Box
                        onClick={() => handleWorkspaceClick(workspace)}
                        onContextMenu={(event) => handleWorkspaceContextMenu(event, workspace)}
                        sx={{
                          width: 56,
                          height: 56,
                          backgroundColor: workspace.isActive
                            ? workspace.backgroundColor || 'primary.main'
                            : workspace.backgroundColor || 'rgb(54, 57, 63)',
                          color: 'white',
                          borderRadius: workspace.isActive ? '18px' : '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          position: 'relative',
                          transition: 'all 0.15s ease-out',
                          transform: workspace.isActive ? 'scale(1.05)' : 'scale(1)',
                          border: `2px solid ${workspace.isActive ? groupColor : 'transparent'}`,
                          boxShadow: workspace.isActive
                            ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                            : '0 2px 4px rgba(0, 0, 0, 0.2)',
                          '&:hover': {
                            borderRadius: '18px',
                            backgroundColor: workspace.backgroundColor
                              ? workspace.isActive
                                ? workspace.backgroundColor
                                : workspace.backgroundColor
                              : workspace.isActive
                                ? 'primary.main'
                                : 'primary.dark',
                            transform: 'scale(1.05)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            borderColor: groupColor,
                          },
                          '&:active': {
                            transform: 'scale(0.98)',
                          },
                        }}
                      >
                        {workspace.emoji || workspace.name.charAt(0).toUpperCase()}

                        {/* Active workspace indicator */}
                        {workspace.isActive && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: -2,
                              right: 4,
                              transform: 'translateX(50%)',
                              width: 16,
                              height: 16,
                              backgroundColor: groupColor,
                              borderRadius: '50%',
                              border: '3px solid rgb(32, 34, 37)',
                              boxShadow: `0 2px 6px ${groupColor}40`,
                              zIndex: 2,
                            }}
                          />
                        )}
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        })}

        {/* Ungrouped workspaces */}
        {groupedWorkspaces.ungrouped.length > 0 && (
          <Box sx={{ width: '100%', mt: 3 }}>
            {/* Simple horizontal divider for ungrouped section */}
            {groupedWorkspaces.grouped.length > 0 && (
              <Divider
                sx={{
                  mb: 1.5,
                  mx: 2,
                  borderColor: 'rgb(88, 101, 242)', // Use a subtle accent color for ungrouped divider
                  '&::before, &::after': {
                    borderColor: 'rgb(88, 101, 242)',
                    borderWidth: '1px',
                  },
                }}
              />
            )}

            {/* Render ungrouped workspaces */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              {groupedWorkspaces.ungrouped.map((workspace) => (
                <Tooltip key={workspace.id} title={workspace.name} placement='right'>
                  <Box
                    onClick={() => handleWorkspaceClick(workspace)}
                    onContextMenu={(event) => handleWorkspaceContextMenu(event, workspace)}
                    sx={{
                      width: 56,
                      height: 56,
                      backgroundColor: workspace.isActive
                        ? workspace.backgroundColor || 'primary.main'
                        : workspace.backgroundColor || 'rgb(54, 57, 63)',
                      color: 'white',
                      borderRadius: workspace.isActive ? '18px' : '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      position: 'relative',
                      transition: 'all 0.15s ease-out',
                      transform: workspace.isActive ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: workspace.isActive
                        ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                        : '0 2px 4px rgba(0, 0, 0, 0.2)',
                      '&:hover': {
                        borderRadius: '18px',
                        backgroundColor: workspace.backgroundColor
                          ? workspace.isActive
                            ? workspace.backgroundColor
                            : workspace.backgroundColor
                          : workspace.isActive
                            ? 'primary.main'
                            : 'primary.dark',
                        transform: 'scale(1.05)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                      },
                    }}
                  >
                    {workspace.emoji || workspace.name.charAt(0).toUpperCase()}

                    {/* Active workspace indicator */}
                    {workspace.isActive && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -2,
                          right: 4,
                          transform: 'translateX(50%)',
                          width: 16,
                          height: 16,
                          backgroundColor: 'rgb(88, 101, 242)',
                          borderRadius: '50%',
                          border: '3px solid rgb(32, 34, 37)',
                          boxShadow: '0 2px 6px rgba(88, 101, 242, 0.4)',
                          zIndex: 2,
                        }}
                      />
                    )}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Settings button at bottom */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
        <Tooltip title='Workspace settings' placement='right'>
          <IconButton
            onClick={onSettings}
            disabled={isLoading}
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'rgb(54, 57, 63)',
              color: 'rgb(176, 180, 185)',
              borderRadius: '50%',
              '&:hover': {
                backgroundColor: 'rgb(64, 68, 75)',
                borderRadius: '16px',
                transition: 'all 0.2s ease',
              },
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Workspace Creation Dialog */}
      <WorkspaceCreationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreateWorkspace={handleCreateWorkspace}
        availableWorkspaces={workspaces}
        availableGroups={availableGroups}
        onCreateGroup={createGroup}
        onAddWorkspaceToGroup={addWorkspaceToGroup}
      />

      {/* Context Menu */}
      {contextMenu && (
        <WorkspaceContextMenu
          workspace={contextMenu.workspace}
          anchorEl={contextMenu.anchorEl}
          onClose={handleCloseContextMenu}
          onRename={handleRenameWorkspace}
          onDuplicate={handleDuplicateWorkspace}
          onDelete={handleDeleteWorkspace}
          onSetActive={handleSetActiveWorkspace}
          onAddToGroup={addWorkspaceToGroup}
          onRemoveFromGroup={async (workspaceId: string) => {
            // Close context menu immediately to prevent anchor element issues
            setContextMenu(null);
            // Then remove workspace from group
            await removeWorkspaceFromGroup(workspaceId);
          }}
          onCreateGroup={async (name: string, workspaceId: string) => {
            const groupId = await createGroup(name);
            await addWorkspaceToGroup(workspaceId, groupId);
            return groupId;
          }}
          onCreateNewGroup={handleCreateNewGroup}
          availableGroups={availableGroups}
          availableWorkspaces={workspaces}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <WorkspaceDeleteDialog
        open={deleteDialogOpen}
        workspace={workspaceToDelete}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDeleteWorkspace}
      />

      {/* Rename Confirmation Dialog */}
      <WorkspaceRenameDialog
        open={renameDialogOpen}
        workspace={workspaceToRename}
        onClose={handleCloseRenameDialog}
        onConfirm={handleConfirmRenameWorkspace}
        availableWorkspaces={workspaces}
      />

      {/* Group Creation Dialog */}
      <GroupCreationDialog
        open={groupCreationDialogOpen}
        onClose={handleCloseGroupCreationDialog}
        onCreateGroup={handleConfirmCreateGroup}
        currentWorkspace={currentWorkspaceForGroup || undefined}
        availableWorkspaces={workspaces}
        autoAddCurrentWorkspace={true}
      />

      {/* Group Context Menu */}
      {groupContextMenu && groupContextMenu.group && (
        <GroupContextMenu
          group={groupContextMenu.group}
          anchorEl={groupContextMenu.anchorEl}
          onClose={handleCloseGroupContextMenu}
          onRenameGroup={async (groupId: string, newName: string) => {
            // Call the group service to rename the group
            const success = await window.electron.ipcRenderer.invoke('group:update', groupId, {
              name: newName,
            });
            if (!success) {
              throw new Error('Failed to rename group');
            }
          }}
          onDeleteGroup={async (groupId: string) => {
            // Call the group service to delete the group
            const success = await window.electron.ipcRenderer.invoke('group:delete', groupId);
            if (!success) {
              throw new Error('Failed to delete group');
            }
          }}
          onChangeGroupColor={async (groupId: string, color) => {
            // Call the group service to update the group color
            const success = await window.electron.ipcRenderer.invoke('group:update', groupId, {
              color,
            });
            if (!success) {
              throw new Error('Failed to change group color');
            }
          }}
        />
      )}

      {/* Workspace Switching Loading Overlay */}
      <WorkspaceSwitchingOverlay isVisible={isSwitching} workspaceName={switchingWorkspaceName} />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onSave={handleSaveAndSwitchWorkspace}
        onDiscard={handleDiscardAndSwitchWorkspace}
        onCancel={handleCancelWorkspaceSwitch}
        isSaving={isSaving}
        saveError={saveError}
      />
    </Box>
  );
};
