# WorkflowStateManager Architecture Design

## Overview

The WorkflowStateManager provides centralized, type-safe workflow state management, replacing the existing boolean flag system with an enum-based architecture. This design eliminates state inconsistencies, provides better type safety, and enables more robust workflow control.

## Architecture Components

### 1. Core State Management

#### StepState Enum
```typescript
enum StepState {
  Ready = 'ready',        // Step is accessible and ready for interaction
  Complete = 'complete',  // Step has been successfully completed
  Error = 'error',        // Step has a critical error blocking completion
  Warning = 'warning',    // Step has warnings but can still be completed
  Blocked = 'blocked',    // Step is blocked by incomplete prerequisites
  Skip = 'skip'          // Step has been intentionally skipped
}
```

**Replaces Boolean Flags:**
- `isAccessible` → `Ready` | `Complete` | `Warning` states
- `isCompleted` → `Complete` state
- `isSkipped` → `Skip` state
- `hasError` → `Error` state

#### WorkflowStateManager Class
**Location:** `/src/renderer/src/services/workflow-state-manager.ts`

**Key Features:**
- Centralized state control with validation
- Type-safe state transitions with rollback capability
- Atomic batch operations for multi-step updates
- Observer pattern for state change notifications
- Auto-save functionality with configurable intervals
- State transition history for debugging

**Core Methods:**
```typescript
// State Transitions
async transitionState(stepId: string, newState: StepState, metadata?: Partial<StepStateMetadata>): Promise<StateTransitionResult>
async batchTransition(operations: BatchStateOperation[]): Promise<BatchOperationResult>

// State Queries
getStepState(stepId: string): StepState | null
isStepAccessible(stepId: string): boolean
getStep(stepId: string): WorkflowStepState | null

// Persistence
async saveState(): Promise<void>
async loadState(): Promise<boolean>

// Observers
subscribe(observer: (event: StateChangeEvent) => void): () => void
```

### 2. State Persistence System

#### Persistence Interface
**Location:** `/src/renderer/src/types/workflow-state.ts`

```typescript
interface WorkflowStatePersistence {
  saveState(snapshot: WorkflowStateSnapshot): Promise<void>
  loadState(): Promise<WorkflowStateSnapshot | null>
  clearState(): Promise<void>
  hasStoredState(): Promise<boolean>
  getStorageInfo(): Promise<{ size: number; lastModified: number }>
}
```

#### Persistence Implementations
**Location:** `/src/renderer/src/services/workflow-state-persistence.ts`

1. **WorkspaceStatePersistence** (Primary)
   - Integrates with existing workspace storage system
   - Persists state per workspace for isolation
   - Leverages existing workspace database infrastructure

2. **LocalStorageStatePersistence** (Fallback)
   - Browser localStorage for basic persistence
   - Used when workspace system unavailable

3. **MemoryStatePersistence** (Development)
   - In-memory storage for testing scenarios
   - No persistence across sessions

### 3. Integration Layer

#### WorkflowStateIntegration Class
**Location:** `/src/renderer/src/services/workflow-state-integration.ts`

**Purpose:** Provides backwards compatibility during migration from boolean flags to enum states.

**Key Features:**
- Bidirectional conversion between boolean flags and enum states
- Legacy-compatible API methods
- Migration utilities for existing data
- Drop-in replacement for current boolean flag operations

**Migration Methods:**
```typescript
// Convert between formats
booleanFlagsToState(step: WorkflowStep): StepState
stateToBooleanFlags(state: StepState): BooleanFlags
convertLegacyStep(legacyStep: WorkflowStep): WorkflowStepState

// Enhanced operations
async completeStep(stepId: string, context?: Record<string, any>): Promise<void>
async resetStep(stepId: string, context?: Record<string, any>): Promise<void>
async skipStep(stepId: string, context?: Record<string, any>): Promise<void>
```

### 4. Migration System

#### Migration Utilities
**Location:** `/src/renderer/src/utils/workflow-state-migration.ts`

**Features:**
- Migration plan analysis with risk assessment
- Dry-run capability for testing migrations
- Automatic backup creation and rollback
- Verification tools to ensure migration accuracy
- Auto-migration for seamless upgrades

**Migration Process:**
1. **Analysis Phase:** `analyzeMigrationNeeds()` - Examines current data and creates migration plan
2. **Execution Phase:** `executeMigration()` - Performs actual migration with safety checks
3. **Verification Phase:** `verifyMigration()` - Confirms migration accuracy
4. **Rollback Option:** `rollbackMigration()` - Reverts changes if needed

## Integration with Existing Systems

### 1. Step State Controller Integration

The new WorkflowStateManager integrates with the existing `step-state-controller.ts` through the integration layer:

```typescript
// Enhanced atomic operations
import { workflowStateIntegration } from '../services/workflow-state-integration'

// Drop-in replacements for existing methods
await workflowStateIntegration.completeStep('input-file')
await workflowStateIntegration.resetStep('config')
const isAccessible = workflowStateIntegration.isStepAccessible('review')
```

### 2. Workflow Store Integration

The integration layer provides methods that work seamlessly with existing Zustand workflow store:

```typescript
// In workflow-store.ts
import { getAllLegacySteps, isStepAccessible } from '../services/workflow-state-integration'

// Get legacy-compatible step data
const steps = getAllLegacySteps()

// Use enhanced accessibility checking
const canProgress = (stepId: string) => isStepAccessible(stepId)
```

### 3. Workspace Store Integration

State persistence automatically integrates with the workspace system:

```typescript
// Automatic workspace-based persistence
const workspaceStore = useWorkspaceStore.getState()
await workspaceStore.saveWorkspaceSession(
  workspace.id,
  'workflow-state',
  stateSnapshot
)
```

## Migration Strategy

### Phase 1: Installation (No Breaking Changes)
1. Deploy new WorkflowStateManager system alongside existing boolean flag system
2. Initialize integration layer with auto-migration
3. Existing code continues to work unchanged

### Phase 2: Migration (Gradual Transition)
1. Run migration analysis to identify any data conflicts
2. Execute migration with backup creation
3. Verify migration accuracy
4. Update components to use integration layer methods

### Phase 3: Optimization (Enhanced Features)
1. Update components to use enum states directly
2. Remove boolean flag compatibility layer
3. Leverage advanced features (warnings, enhanced error states)

### Example Migration Code
```typescript
import { autoMigrate, getMigrationStatus } from '../utils/workflow-state-migration'
import { workflowStateIntegration } from '../services/workflow-state-integration'

// Check if migration is needed
const status = getMigrationStatus()
if (status.needsMigration) {
  // Get existing steps from current store
  const legacySteps = useWorkflowStore.getState().steps
  
  // Auto-migrate with safety checks
  const success = await autoMigrate(legacySteps)
  
  if (success) {
    console.log('Migration completed successfully')
  }
}

// Initialize integration layer
await workflowStateIntegration.initialize()
```

## Benefits

### 1. Type Safety
- Eliminates boolean flag conflicts and invalid state combinations
- Compile-time validation of state transitions
- IntelliSense support for valid states

### 2. Centralized Control
- Single source of truth for workflow state
- Consistent state transition validation
- Atomic operations prevent race conditions

### 3. Enhanced Debugging
- State transition history for troubleshooting
- Detailed metadata for each state change
- Observer pattern for monitoring state changes

### 4. Robustness
- Automatic dependency management between steps
- Rollback capability for failed operations
- Validation rules prevent invalid transitions

### 5. Persistence
- Multiple storage backends with automatic fallback
- Workspace-isolated state management
- Reliable state restoration on app reload

## Usage Examples

### Basic State Management
```typescript
import { workflowStateManager, StepState } from '../services/workflow-state-manager'

// Complete a step
await workflowStateManager.transitionState('input-file', StepState.Complete, {
  reason: 'File uploaded successfully',
  context: { fileName: 'video.mp4' }
})

// Check step accessibility
const isAccessible = workflowStateManager.isStepAccessible('config')

// Get current state
const currentState = workflowStateManager.getStepState('processing')
```

### Batch Operations
```typescript
// Atomic multi-step update
const operations = [
  { stepId: 'config', newState: StepState.Skip, metadata: { reason: 'Auto-configured' } },
  { stepId: 'processing', newState: StepState.Ready, metadata: { reason: 'Ready for processing' } }
]

const result = await workflowStateManager.batchTransition(operations)
if (!result.success && result.rollback) {
  result.rollback() // Automatic rollback on failure
}
```

### State Monitoring
```typescript
// Subscribe to state changes
const unsubscribe = workflowStateManager.subscribe((event) => {
  console.log(`Step ${event.stepId} changed from ${event.oldState} to ${event.newState}`)
  console.log('Reason:', event.metadata.reason)
})

// Clean up when component unmounts
return unsubscribe
```

## Implementation Files

1. **Core Types:** `/src/renderer/src/types/workflow-state.ts`
2. **State Manager:** `/src/renderer/src/services/workflow-state-manager.ts`
3. **Persistence:** `/src/renderer/src/services/workflow-state-persistence.ts`
4. **Integration:** `/src/renderer/src/services/workflow-state-integration.ts`
5. **Migration:** `/src/renderer/src/utils/workflow-state-migration.ts`

## Next Steps

1. **Testing:** Create comprehensive unit tests for state transitions and migration
2. **Component Updates:** Update existing workflow components to use integration layer
3. **Performance Monitoring:** Monitor state manager performance and optimize as needed
4. **Documentation:** Create detailed API documentation and usage guides
5. **Gradual Migration:** Plan phased rollout to existing components

This architecture provides a robust foundation for workflow state management while maintaining backwards compatibility and enabling a smooth transition from the existing boolean flag system.