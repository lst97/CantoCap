/**
 * Phase 1 MVP: Workspace Component Test Utilities
 * Testing utilities and mocks for workspace management components
 */

import type { Workspace } from '../types'

// Mock workspace data for testing
export const mockWorkspaces: Workspace[] = [
  {
    id: 'workspace-1',
    name: 'CantoCap Workspace',
    emoji: '粵',
    color: '#F59E0B',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-02T15:30:00Z'),
    isActive: true,
    sessionData: {
      inputFile: '/path/to/video.mp4',
      currentStep: 'config',
      config: {
        language: 'zh',
        charset: 'traditional'
      }
    }
  },
  {
    id: 'workspace-2',
    name: 'Movie Project',
    emoji: '🎬',
    color: '#57F287',
    createdAt: new Date('2024-01-03T09:15:00Z'),
    updatedAt: new Date('2024-01-03T09:15:00Z'),
    isActive: false,
    sessionData: {
      currentStep: 'input-file'
    }
  },
  {
    id: 'workspace-3',
    name: 'Music Videos',
    emoji: '🎵',
    color: '#7DD3FC',
    createdAt: new Date('2024-01-04T14:20:00Z'),
    updatedAt: new Date('2024-01-04T16:45:00Z'),
    isActive: false
  }
]

// Mock workspace actions for testing
export const mockWorkspaceActions = {
  onCreateWorkspace: jest.fn().mockResolvedValue(undefined),
  onSwitchWorkspace: jest.fn().mockResolvedValue(undefined),
  onRenameWorkspace: jest.fn().mockResolvedValue(undefined),
  onDuplicateWorkspace: jest.fn().mockResolvedValue(undefined),
  onDeleteWorkspace: jest.fn().mockResolvedValue(undefined),
  onSetActive: jest.fn().mockResolvedValue(undefined),
  onRollback: jest.fn().mockResolvedValue(undefined),
  onSettings: jest.fn()
}

// Test scenarios
export const testScenarios = {
  emptyWorkspaces: {
    workspaces: [],
    activeWorkspace: null
  },
  singleWorkspace: {
    workspaces: [mockWorkspaces[0]],
    activeWorkspace: mockWorkspaces[0]
  },
  multipleWorkspaces: {
    workspaces: mockWorkspaces,
    activeWorkspace: mockWorkspaces[0]
  },
  migrationInProgress: {
    workspaces: mockWorkspaces,
    activeWorkspace: mockWorkspaces[0],
    isMigrating: true,
    migrationPhase: 'data-migration',
    migrationProgress: 65,
    canRollback: true
  },
  migrationError: {
    workspaces: mockWorkspaces,
    activeWorkspace: mockWorkspaces[0],
    isMigrating: true,
    migrationPhase: 'error',
    migrationProgress: 45,
    canRollback: true
  }
}

// Helper functions for testing
export const createMockWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: `workspace-${Date.now()}`,
  name: 'Test Workspace',
  emoji: '🧪',
  color: '#F59E0B',
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: false,
  ...overrides
})

export const setupContextMenuTest = (workspace: Workspace = mockWorkspaces[0]) => {
  const mockAnchorEl = document.createElement('div')
  const props = {
    workspace,
    anchorEl: mockAnchorEl,
    onClose: jest.fn(),
    ...mockWorkspaceActions
  }
  return { props, mockAnchorEl }
}

export const setupCreationDialogTest = () => {
  const props = {
    open: true,
    onClose: jest.fn(),
    onCreateWorkspace: mockWorkspaceActions.onCreateWorkspace,
    availableWorkspaces: mockWorkspaces
  }
  return { props }
}

// Custom render helpers would go here for React Testing Library integration
// export const renderWithTheme = (component: React.ReactElement) => { ... }
// export const renderWithWorkspaceProvider = (component: React.ReactElement) => { ... }