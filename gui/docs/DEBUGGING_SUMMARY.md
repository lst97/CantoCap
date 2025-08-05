# Workflow Initialization Race Condition Debugging

## Overview
Comprehensive runtime debugging has been added to trace the exact execution flow and identify the race condition between workspace session restoration and default workflow state initialization.

## Key Race Condition Issue
The frontend-developer identified that saved session data containing `currentStep: 'config'` overrides the intended default of step 1 (input-file), causing step 1 navigation failures.

## Debugging Infrastructure Added

### 1. WorkflowStateManager Debug Logging
**File**: `/src/renderer/src/services/workflow-state-manager.ts`

- **Constructor logging**: Tracks when singleton is created and initialized
- **initializeDefaultSteps()**: Detailed logging of step creation and default step setting
- **loadState()**: Comprehensive logging of persistence restoration with race condition warnings
- **setCurrentStep()**: Detailed validation and step change tracking
- **Debug utilities**: Call stack tracking and state debugging helpers

### 2. Workflow Store Debug Logging  
**File**: `/src/renderer/src/stores/workflow-store.ts`

- **initializeFromWorkspace()**: Tracks workspace initialization impact on workflow state
- **setCurrentStep()**: Logs step change attempts and results
- **onRehydrateStorage()**: Tracks Zustand persistence rehydration

### 3. Navigation Hooks Debug Logging
**File**: `/src/renderer/src/hooks/useWorkflowStateManager.ts`

- **useWorkflowState()**: Tracks hook initialization and subscription setup
- **navigateToStep()**: Comprehensive navigation attempt logging with failure analysis
- **State change subscriptions**: Logs all workflow state change events

### 4. Workspace Context Debug Logging
**File**: `/src/renderer/src/contexts/WorkspaceConfigContext.tsx`

- **Provider initialization**: Tracks workspace system initialization timing
- **Workspace restoration**: Logs before/after workspace data loading

### 5. React State Utils Debug Logging
**File**: `/src/renderer/src/utils/react-state-utils.ts`

- **Automatic sync**: Logs all automatic state synchronization attempts
- **Error recovery**: Tracks error recovery state loading
- **synchronizeState()**: Manual synchronization call tracking

### 6. Comprehensive Debug Utilities
**File**: `/src/renderer/src/utils/workflow-debug.ts`

- **debugRaceCondition()**: Complete race condition analysis
- **debugNavigationFailure()**: Navigation failure diagnostic
- **debugInitialization()**: Component initialization tracking  
- **debugWorkspaceRestoration()**: Workspace restoration impact analysis
- **startRaceConditionMonitoring()**: Continuous monitoring for unexpected state changes
- **Global debug object**: Available in dev console as `window.workflowDebug`

## Debug Log Categories

### 🔧 [DEBUG] - General debug information
- Initialization sequences
- State changes
- Method calls
- Validation results

### ❌ [DEBUG] - Error conditions  
- Navigation failures
- Validation errors
- Exception handling

### ⚠️ [POTENTIAL RACE CONDITION] - Race condition warnings
- When persistence restoration overrides default step
- Unexpected state changes
- Timing conflicts

### 🚨 [RACE CONDITION DEBUG] - Comprehensive race condition analysis
- Triggered when step 1 navigation fails
- Complete state dump with performance metrics
- Call stack analysis

## Key Debug Points to Watch

1. **Singleton Creation**: When WorkflowStateManager singleton is created
2. **Default Step Setting**: When currentStepId is set to 'input-file' 
3. **Persistence Loading**: When loadState() is called and what it restores
4. **Workspace Initialization**: When workspace system initializes and affects workflow state
5. **Navigation Attempts**: When components try to navigate to step 1 and why they fail

## Expected Debug Flow

1. WorkflowStateManager singleton created → currentStepId = 'input-file'
2. Workspace system initializes
3. If persistence exists, loadState() called → **POTENTIAL RACE CONDITION**
4. React components initialize and attempt navigation
5. Navigation failures trigger comprehensive debugging

## Usage

The debugging is automatically active. To get debug summaries:

```javascript
// In browser console (development only)
window.workflowDebug.raceCondition('manual-check')
window.workflowDebug.state()
window.workflowDebug.calls()
```

## Next Steps

1. Run the application and observe console logs
2. Look for ⚠️ and 🚨 markers indicating race conditions
3. Track the exact timing of initialization vs. persistence restoration
4. Identify what's overriding the default step setting
5. Implement fix based on findings

The debugging will help definitively identify:
- Exact order of initialization calls
- What state is being restored vs. what should be default  
- Why step 1 navigation fails (accessibility, validation, etc.)
- Race condition timing between different initialization processes