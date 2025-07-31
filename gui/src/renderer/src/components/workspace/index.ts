/**
 * Phase 3: Integrated Workspace Components
 * Fully integrated workspace management system with real backend storage
 */

// Main Components
export {
  EnhancedWorkspacePanel,
  WorkspacePanel,
} from "./EnhancedWorkspacePanel";
export { WorkspaceAvatar } from "./WorkspaceAvatar";
export { WorkspaceContextMenu } from "./WorkspaceContextMenu";
export { WorkspaceCreationDialog } from "./WorkspaceCreationDialog";
export { MigrationProgressDialog } from "./MigrationProgressDialog";

// Status and Monitoring Components
export {
  WorkspaceStatusIndicator,
  WorkspaceHealthStatus,
} from "./WorkspaceStatusIndicator";
export {
  WorkspaceErrorBoundary,
  useWorkspaceErrorHandler,
} from "./WorkspaceErrorBoundary";

// Hooks and Integration
export {
  useWorkspaceManagement,
  useWorkspacePanelIntegration,
  useWorkspaceSession,
} from "./hooks";

// Performance Utilities
export {
  PerformanceMonitor,
  WorkspacePreloader,
  PerformanceDebugger,
  useDebounce,
  useOptimisticUpdate,
  useBatchedUpdates,
  useFastWorkspaceSwitch,
  useVirtualizedWorkspaces,
} from "./performance-utils";

// Types
export type {
  Workspace,
  WorkspaceContextMenuProps,
  WorkspaceCreationDialogProps,
  WorkspaceMigrationProgressProps,
  WorkspaceAvatarProps,
} from "./types";

// Constants
export { PHASE1_CONSTRAINTS } from "./types";

/**
 * Integration Guide:
 *
 * 1. Wrap your app with WorkspaceErrorBoundary for error handling
 * 2. Use EnhancedWorkspacePanel as a drop-in replacement for the old WorkspacePanel
 * 3. Add WorkspaceStatusIndicator to your status bar for real-time feedback
 * 4. Performance monitoring is automatic - check console for metrics
 * 5. All components are now self-contained with integrated store operations
 *
 * Example usage:
 *
 * ```typescript
 * import {
 *   WorkspaceErrorBoundary,
 *   EnhancedWorkspacePanel,
 *   WorkspaceStatusIndicator
 * } from './components/workspace'
 *
 * function App() {
 *   return (
 *     React.createElement(WorkspaceErrorBoundary, null,
 *       React.createElement('div', { className: 'app' },
 *         React.createElement(EnhancedWorkspacePanel, { onSettings: () => {} }),
 *         React.createElement('div', { className: 'main-content' },
 *           React.createElement(WorkspaceStatusIndicator, { compact: true }),
 *           // Your app content
 *         )
 *       )
 *     )
 *   )
 * }
 * ```
 */
