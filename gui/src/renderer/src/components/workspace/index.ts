/**
 * Simplified Workspace Components
 * Clean, modern workspace management system with Zustand store integration
 */

// Main Components
export { WorkspacePanel } from '../layout/WorkspacePanel';
export { WorkspaceAvatar } from './WorkspaceAvatar';
export { WorkspaceGroup } from './WorkspaceGroup';
export { WorkspaceContextMenu } from './WorkspaceContextMenu';
export { WorkspaceCreationDialog } from './WorkspaceCreationDialog';
export { WorkspaceDeleteDialog } from './WorkspaceDeleteDialog';
export { EmptyWorkspaceState } from './EmptyWorkspaceState';

// Status and Monitoring Components
export { WorkspaceStatusIndicator, WorkspaceHealthStatus } from './WorkspaceStatusIndicator';
export { WorkspaceErrorBoundary, useWorkspaceErrorHandler } from './WorkspaceErrorBoundary';

// Hooks and Integration
export { useWorkspaceManagement, useWorkspacePanelIntegration } from './hooks';

// Performance Utilities (simplified)
export {
  PerformanceMonitor,
  PerformanceDebugger,
  useDebounce,
  useFastWorkspaceSwitch,
} from './performance-utils';

// Types (re-exported from centralized types)
export type {
  WorkspaceContextMenuProps,
  WorkspaceCreationDialogProps,
  WorkspaceAvatarProps,
} from './types';
