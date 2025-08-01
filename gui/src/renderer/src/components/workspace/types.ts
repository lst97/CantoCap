/**
 * Phase 1 MVP: Workspace Management Types
 * Minimal viable workspace functionality without groups/folders
 */

export interface Workspace {
  id: string
  name: string
  emoji?: string
  color?: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
  sessionData?: {
    inputFile?: string
    outputFile?: string
    config?: Record<string, any>
    currentStep?: string
  }
}

export interface WorkspaceContextMenuProps {
  workspace: Workspace
  anchorEl: HTMLElement | null
  onClose: () => void
  onRename: (workspaceId: string, newName: string) => Promise<void>
  onDuplicate: (workspaceId: string) => Promise<void>
  onDelete: (workspaceId: string) => Promise<void>
  onSetActive: (workspaceId: string) => Promise<void>
}

export interface WorkspaceCreationDialogProps {
  open: boolean
  onClose: () => void
  onCreateWorkspace: (name: string, copyFromId?: string) => Promise<void>
  availableWorkspaces: Workspace[]
}

export interface WorkspaceMigrationProgressProps {
  isOpen: boolean
  currentPhase: string
  progress: number
  canRollback: boolean
  onRollback: () => void
  onClose: () => void
}

export interface WorkspaceAvatarProps {
  workspace: Workspace
  size?: 'small' | 'medium' | 'large'
  isActive?: boolean
  onClick?: () => void
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void
  // Drag and drop support
  enableDragDrop?: boolean
  data?: any // Additional data for drag context
  sx?: any // Additional styling
}

// Phase 1 Constraints
export const PHASE1_CONSTRAINTS = {
  MAX_WORKSPACES: 10,
  MAX_WORKSPACE_NAME_LENGTH: 30,
  SUPPORTED_FEATURES: {
    groups: false,
    dragAndDrop: false,
    sharing: false,
    templates: false
  }
} as const