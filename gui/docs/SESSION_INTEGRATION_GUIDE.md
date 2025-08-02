# Session Integration System Guide

## Overview

The Session Integration System coordinates session management, workflow navigation, and workspace operations to ensure data consistency across the application. This guide explains how the integrated system works and how to use it effectively.

## System Architecture

### Core Components

1. **Enhanced Session Management** (`cleanupWorkspaceSession`, `performEnhancedSessionReset`)
   - Manages IndexedDB cleanup and workspace session binding
   - Provides atomic operations for session state management
   - Handles session recovery and data persistence

2. **Atomic Navigation** (`navigateToReviewFromJsonImport`, `navigateToReviewFromProcessing`)
   - Ensures workflow state consistency during navigation
   - Provides rollback capabilities for failed operations
   - Coordinates with session management for clean state transitions

3. **Integrated Operations** (`session-workflow-integration.ts`)
   - Combines session management with navigation for atomic operations
   - Provides comprehensive error handling and recovery
   - Maintains data consistency across all systems

## Key Integration Points

### 1. Video File Operations

**Video Upload/Change:**
```typescript
// Triggered automatically in app-store.ts when inputFile changes
performEnhancedSessionReset('step1_video_change', workspaceId)
```

**Video Removal:**
```typescript
// Comprehensive cleanup with workspace rebinding
handleVideoRemovalWithCleanup()
```

### 2. JSON Import Operations

**JSON Import with Navigation:**
```typescript
// Complete operation: reset → cleanup → session init → navigation
handleJsonImportWithSessionReset(subtitleData, context)
```

**Usage in Components:**
```typescript
import { processJsonImportComplete } from '../utils/session-integration-exports'

// In your component
const result = await processJsonImportComplete(importedSubtitleData)
if (result.success) {
  // Import completed successfully
} else {
  // Handle error
}
```

### 3. Processing Completion

**After Subtitle Generation:**
```typescript
// Setup session and navigate to review
handleProcessingCompletionWithSessionSetup(subtitleData, context)
```

**Usage in Components:**
```typescript
import { processProcessingComplete } from '../utils/session-integration-exports'

// In your processing component
const result = await processProcessingComplete(generatedSubtitleData)
if (result.success) {
  // Processing completion handled
}
```

### 4. Workspace Changes

**Automatic Coordination:**
```typescript
// Called automatically when workspace changes
handleWorkspaceChangeWithSessionCoordination(newWorkspaceId, previousWorkspaceId)
```

## Session Reset Triggers

The integrated system automatically handles session resets for these scenarios:

### 1. Video File Changes (`step1_video_change`)
- **Trigger:** User uploads new video or removes video file
- **Actions:** Enhanced cleanup → Session reset → Workspace rebinding
- **Result:** Clean session state for new video content

### 2. JSON Import (`step1_import`)
- **Trigger:** User imports or removes JSON subtitle file
- **Actions:** Session reset → Cleanup → Session initialization → Navigation
- **Result:** Direct navigation to review step with imported data

### 3. Subtitle Generation (`step3_generation`)
- **Trigger:** User starts transcription or processing completes
- **Actions:** Pre-cleanup → Session reset → Session setup → Navigation
- **Result:** Clean session for new generated subtitles

## Error Handling and Recovery

### Fallback Mechanisms

All integrated operations include fallback mechanisms:

1. **Enhanced → Standard:** If enhanced operations fail, fall back to standard session reset
2. **Integrated → Component:** If integration fails, components can handle locally
3. **Atomic Rollback:** Navigation operations provide rollback functions

### Error Logging

The system provides comprehensive logging:
- ✅ Success operations with result details
- ⚠️ Warnings for non-critical failures with fallback actions
- ❌ Errors for critical failures with recovery instructions

## Best Practices

### For Component Developers

1. **Use Convenience Functions:**
   ```typescript
   import { processJsonImportComplete, processProcessingComplete } from '../utils/session-integration-exports'
   ```

2. **Handle Results Properly:**
   ```typescript
   const result = await processJsonImportComplete(data)
   if (result.success) {
     // Success path
   } else {
     console.error('Import failed:', result.error)
     // Handle error
   }
   ```

3. **Don't Mix Systems:**
   - Use integrated functions instead of calling session/navigation separately
   - Let the system handle coordination automatically
   - Trust the fallback mechanisms

### For Store Developers

1. **Use Enhanced Operations:**
   ```typescript
   // Instead of direct session reset
   subtitleStore.resetSessionForNewContent('step1_video_change')
   
   // Use enhanced reset
   performEnhancedSessionReset('step1_video_change', workspaceId)
   ```

2. **Coordinate with Workspace:**
   ```typescript
   // Always consider workspace context
   const workspaceStore = useWorkspaceStore.getState()
   const currentWorkspace = workspaceStore.currentWorkspace
   ```

3. **Handle Async Operations:**
   ```typescript
   // Use proper async handling with fallbacks
   enhancedOperation()
     .then(result => console.log('Success:', result))
     .catch(error => {
       console.warn('Failed, using fallback:', error)
       fallbackOperation()
     })
   ```

## Data Flow Diagram

```
User Action (Video/JSON/Generation)
         ↓
   App Store updateConfig
         ↓
 Integrated Operation Call
         ↓
    ┌─── Session Reset ───┐
    │                    │
    ▼                    ▼
Workspace Cleanup   Workflow Sync
    │                    │
    └─── Navigation ─────┘
         ↓
   Consistent State
```

## Testing Integration

### Unit Tests

Test individual functions:
```typescript
describe('Session Integration', () => {
  it('should handle JSON import with session reset', async () => {
    const result = await handleJsonImportWithSessionReset(mockData)
    expect(result.success).toBe(true)
    expect(result.sessionInitialized).toBe(true)
  })
})
```

### Integration Tests

Test complete workflows:
```typescript
describe('Complete Workflow', () => {
  it('should complete video → processing → review workflow', async () => {
    // Test full user journey with integrated operations
  })
})
```

## Monitoring and Debugging

### Log Monitoring

Watch for these log patterns:
- `🔄 Starting atomic [operation]`
- `✅ Enhanced [operation] completed`
- `⚠️ Enhanced [operation] failed, using fallback`
- `❌ [operation] failed`

### Performance Metrics

The system tracks:
- Session cleanup duration and bytes reclaimed
- Navigation success/failure rates
- Fallback usage frequency
- Error patterns and recovery success

### Debug Mode

Enable detailed logging:
```typescript
// In development
localStorage.setItem('debug-session-integration', 'true')
```

## Migration Guide

### From Direct Session Management

**Before:**
```typescript
subtitleStore.resetSessionForNewContent('step1_import')
// Manual navigation
navigateToReview()
```

**After:**
```typescript
import { processJsonImportComplete } from '../utils/session-integration-exports'
await processJsonImportComplete(subtitleData)
```

### From Manual Coordination

**Before:**
```typescript
// Manual coordination across stores
subtitleStore.resetSession()
workflowStore.setCurrentStep('review')
workspaceStore.updateConfig()
```

**After:**
```typescript
// Integrated atomic operation
const result = await handleJsonImportWithSessionReset(data, context)
```

## Future Enhancements

The system is designed for extensibility:
1. **Additional Operations:** New integrated operations can be added
2. **Enhanced Recovery:** More sophisticated rollback mechanisms
3. **Performance Monitoring:** Real-time performance tracking
4. **Predictive Cleanup:** Proactive session management based on usage patterns