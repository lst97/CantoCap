/**
 * Workspace Component Types
 * Component-specific types that extend the centralized store types
 */

import React from 'react';

import type {
  WorkspaceWithGrouping,
  WorkspaceGroup,
  WorkspaceGroupColor,
} from '../../stores/types/StoreTypes';

// Re-export centralized types for component use
export type {
  WorkspaceMetadata,
  WorkspaceWithGrouping,
  WorkspaceGroup,
  WorkspaceGroupColor,
} from '../../stores/types/StoreTypes';

export interface WorkspaceContextMenuProps {
  workspace: WorkspaceWithGrouping;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onRename: (workspaceId: string) => void;
  onDuplicate: (workspaceId: string) => Promise<void>;
  onDelete: (workspaceId: string) => void;
  onSetActive: (workspaceId: string) => Promise<void>;
  // Group management actions
  onAddToGroup?: (workspaceId: string, groupId: string) => void;
  onRemoveFromGroup?: (workspaceId: string) => void;
  onCreateGroup?: (name: string, workspaceId: string) => void;
  onCreateNewGroup?: (workspaceId: string) => void;
  availableGroups?: WorkspaceGroup[];
  availableWorkspaces?: WorkspaceWithGrouping[];
}

export interface WorkspaceCreationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateWorkspace: (
    name: string, 
    copyFromId?: string, 
    backgroundColor?: string, 
    emoji?: string,
    groupInfo?: { action: 'existing' | 'new'; groupId?: string; newGroupName?: string; newGroupColor?: WorkspaceGroupColor }
  ) => Promise<void>;
  availableWorkspaces: WorkspaceWithGrouping[];
  // Group management props
  availableGroups?: WorkspaceGroup[];
  onCreateGroup?: (name: string, color: WorkspaceGroupColor) => Promise<string>;
  onAddWorkspaceToGroup?: (workspaceId: string, groupId: string) => Promise<void>;
}

export interface WorkspaceAvatarProps {
  workspace: WorkspaceWithGrouping;
  size?: 'small' | 'medium' | 'large';
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  sx?: any; // Additional styling
}

export interface WorkspaceGroupProps {
  group: WorkspaceGroup;
  workspaces: WorkspaceWithGrouping[];
  isActive?: boolean;
  onToggleExpansion: (groupId: string) => void;
  onWorkspaceClick: (workspace: WorkspaceWithGrouping) => void;
  onWorkspaceContextMenu: (event: React.MouseEvent, workspace: WorkspaceWithGrouping) => void;
  onGroupContextMenu?: (event: React.MouseEvent, group: WorkspaceGroup) => void;
}

// Workspace Panel Constraints and Constants
export const WORKSPACE_CONSTRAINTS = {
  MAX_WORKSPACES: 50,
  MAX_WORKSPACE_NAME_LENGTH: 50,
  MAX_GROUP_NAME_LENGTH: 30,
  MAX_WORKSPACES_PER_GROUP: 20,
  SUPPORTED_FEATURES: {
    groups: true,
    contextMenuGrouping: true,
    sharing: false,
    templates: false,
  },
} as const;
