# Type-Safe Step Configuration System

## Overview

The Type-Safe Step Configuration System provides comprehensive TypeScript support for the enhanced workspace store, enabling developers to work with step configurations using full type safety, runtime validation, and React integration.

## Architecture

```bash
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   React Components  │    │    Validation       │    │   Type Guards       │
│                     │    │    System           │    │                     │
│ - useStepConfig     │    │                     │    │ - Runtime checks    │
│ - useWorkspace      │    │ - Step validation   │    │ - Type predicates   │
│   Integration       │    │ - Error reporting   │    │ - Sanitization      │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      │
                            ┌─────────────────────┐
                            │  Enhanced Workspace │
                            │       Store         │
                            │                     │
                            │ - Step Config CRUD  │
                            │ - Caching Layer     │
                            │ - Auto-save         │
                            │ - Migration Support │
                            └─────────────────────┘
```

## Components

### 1. Type Guards (`/utils/typeGuards.ts`)

Runtime type checking that works beyond compile time:

```typescript
import { isValidStepConfig, sanitizeStepConfig } from '../utils/typeGuards'

// Runtime validation
if (isValidStepConfig('input-file', config)) {
  // config is now properly typed as InputFileStepConfig
  console.log(config.selectedFile) // Type-safe access
}

// Sanitization
const clean = sanitizeStepConfig('config', userInput)
if (clean) {
  // clean is guaranteed to be valid ConfigStepConfig
  await store.setStepConfig(workspaceId, 'config', clean)
}
```

**Key Functions:**

- `isValidWorkflowStepId()` - Validates step IDs
- `isValidStepConfig<K>()` - Generic step config validation
- `isInputFileStepConfig()` - Specific validators for each step
- `sanitizeStepConfig<K>()` - Clean and validate configurations

### 2. Validation System (`/utils/stepConfigValidation.ts`)

Comprehensive validation with detailed error reporting:

```typescript
import { validateStepConfig, validateBatchStepConfigs } from '../utils/stepConfigValidation'

// Single step validation
const result = validateStepConfig('config', {
  language: 'zh',
  priority: 'invalid-priority', // This will be caught
  maxChunkDuration: -5 // This will also be caught
})

if (!result.isValid) {
  result.errors.forEach(error => {
    console.error(`${error.field}: ${error.message}`)
    if (error.suggestion) {
      console.log(`Suggestion: ${error.suggestion}`)
    }
  })
}

// Batch validation
const batchResult = validateBatchStepConfigs({
  'input-file': inputConfig,
  'config': configData,
  'processing': processingConfig
})

console.log(`Total errors: ${batchResult.totalErrors}`)
console.log(`Critical steps: ${batchResult.criticalErrors.join(', ')}`)
```

**Features:**

- Field-level validation with specific error messages
- Warning system for non-critical issues
- Auto-fix suggestions with optional auto-apply
- Batch validation for multiple steps
- Performance hints and optimization recommendations

### 3. React Hooks (`/hooks/useStepConfig.ts`)

Type-safe React integration:

```typescript
import { useStepConfig, useInputFileConfig } from '../hooks/useStepConfig'

// Generic hook with full type safety
const {
  config,           // Typed as InputFileStepConfig | null
  isLoading,
  isSaving,
  error,
  isDirty,
  validationResult,
  updateConfig,     // Type-safe updates
  save,
  resetToDefault
} = useStepConfig('input-file', workspaceId, {
  autoValidate: true,
  syncEnabled: true,
  onError: (error) => handleError(error),
  onValidationSuccess: () => console.log('Valid!'),
  onValidationError: (result) => showErrors(result.errors)
})

// Specialized hooks for convenience
const inputConfig = useInputFileConfig(workspaceId)
const configStep = useConfigStepConfig(workspaceId)
```

**Hook Features:**

- **Type Safety**: Full TypeScript support with proper generics
- **Caching**: Automatic cache management with hit indicators
- **Auto-validation**: Real-time validation with debouncing
- **Auto-save**: Debounced saving with optimistic updates
- **Error Handling**: Comprehensive error states and recovery
- **Dirty Tracking**: Track unsaved changes
- **Revert Support**: Ability to revert unsaved changes

### 4. Workspace Integration (`/hooks/useWorkspaceIntegration.ts`)

Higher-level workspace management:

```typescript
import { 
  useWorkspaceRequirement,
  useWorkspaceStepIntegration,
  useInputFileIntegration 
} from '../hooks/useWorkspaceIntegration'

// Workspace requirement detection
const {
  hasAnyWorkspace,
  hasActiveWorkspace,
  stepConfigsEnabled,
  isEmpty
} = useWorkspaceRequirement()

// Comprehensive step integration
const {
  stepConfigs,           // All step configurations
  configHealth,          // Overall health status
  validationResults,     // Validation for all steps
  updateStepConfig,      // Type-safe updates
  updateMultipleSteps,   // Batch updates
  validateAll,           // Validate all steps
  saveAll               // Save all changes
} = useWorkspaceStepIntegration()

// Step-specific integration with workspace context
const {
  hasFile,
  hasValidFile,
  canProceed,
  ...stepConfig
} = useInputFileIntegration()
```

## Usage Examples

### Basic Step Configuration

```typescript
const MyComponent: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceRequirement()
  const {
    config,
    updateConfig,
    validationResult,
    isDirty,
    save
  } = useStepConfig('config', activeWorkspaceId, {
    autoValidate: true,
    syncEnabled: true
  })

  const handleLanguageChange = async (language: string) => {
    await updateConfig({ language })
  }

  const handleAdvancedConfig = async () => {
    await updateConfig({
      advancedOptions: {
        qualityThresholds: {
          confidence: 0.9,
          accuracy: 0.85
        },
        parallelProcessing: true
      }
    })
  }

  return (
    <div>
      <select 
        value={config?.language || ''} 
        onChange={(e) => handleLanguageChange(e.target.value)}
      >
        <option value="zh">Chinese</option>
        <option value="en">English</option>
      </select>
      
      {validationResult?.errors.map(error => (
        <div key={error.field} style={{ color: 'red' }}>
          {error.message}
        </div>
      ))}
      
      {isDirty && <button onClick={save}>Save</button>}
    </div>
  )
}
```

### Workspace Empty State Handling

```typescript
const WorkspaceWrapper: React.FC = ({ children }) => {
  const {
    isEmpty,
    isCreating,
    createFirstWorkspace
  } = useWorkspaceEmptyState()

  if (isEmpty) {
    return (
      <div>
        <h2>Welcome!</h2>
        <p>Create your first workspace to get started.</p>
        <button 
          onClick={() => createFirstWorkspace('My Workspace')}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Workspace'}
        </button>
      </div>
    )
  }

  return <>{children}</>
}
```

### Batch Operations

```typescript
const BatchConfigManager: React.FC = () => {
  const {
    stepConfigs,
    configHealth,
    updateMultipleSteps,
    validateAll,
    saveAll
  } = useWorkspaceStepIntegration()

  const handleBatchUpdate = async () => {
    await updateMultipleSteps({
      'input-file': {
        filePreferences: {
          autoValidate: true,
          extractMetadata: true
        }
      },
      'config': {
        language: 'zh',
        priority: 'balanced'
      },
      'processing': {
        qualitySettings: {
          enableQualityChecks: true
        }
      }
    })
  }

  const handleValidateAll = async () => {
    const result = await validateAll()
    console.log(`${result.totalErrors} errors, ${result.totalWarnings} warnings`)
  }

  return (
    <div>
      <div>Health: {configHealth?.overallHealth}</div>
      <button onClick={handleBatchUpdate}>Apply Defaults</button>
      <button onClick={handleValidateAll}>Validate All</button>
      <button onClick={saveAll}>Save All</button>
    </div>
  )
}
```

### Manual Validation

```typescript
import { validateStepConfig } from '../utils/stepConfigValidation'
import { isValidStepConfig } from '../utils/typeGuards'

const validateUserInput = (stepId: WorkflowStepId, userConfig: any) => {
  // Runtime type checking
  if (!isValidStepConfig(stepId, userConfig)) {
    throw new Error('Invalid configuration format')
  }

  // Detailed validation
  const result = validateStepConfig(stepId, userConfig)
  
  if (!result.isValid) {
    // Handle errors
    result.errors.forEach(error => {
      console.error(`${error.field}: ${error.message}`)
      if (error.suggestion) {
        console.log(`💡 ${error.suggestion}`)
      }
    })
    return false
  }

  // Handle warnings
  result.warnings.forEach(warning => {
    console.warn(`⚠️ ${warning.field}: ${warning.message}`)
  })

  // Handle suggestions
  result.suggestions?.forEach(suggestion => {
    console.log(`💡 ${suggestion.field}: ${suggestion.suggestion}`)
    if (suggestion.autoApply) {
      console.log('  → Auto-apply available')
    }
  })

  return true
}
```

## Error Handling

### Error Types

```typescript
// Step configuration specific errors
interface StepConfigError extends Error {
  code: 'STEP_CONFIG_NOT_FOUND' | 'STEP_CONFIG_INVALID' | /* ... */
  workspaceId?: string
  stepId?: WorkflowStepId
  validationErrors?: string[]
  recoveryAction?: string
}

// Enhanced workspace errors
interface WorkspaceError extends Error {
  code: 'WORKSPACE_NOT_FOUND' | 'STEP_CONFIG_ERROR' | /* ... */
  stepConfigError?: StepConfigError
  affectedSteps?: WorkflowStepId[]
  recoverable?: boolean
}
```

### Error Handling Patterns

```typescript
const MyComponent: React.FC = () => {
  const {
    config,
    error,
    clearError,
    updateConfig
  } = useStepConfig('config', workspaceId, {
    onError: (error) => {
      if (error.code === 'STEP_CONFIG_INVALID') {
        showNotification('Invalid configuration', 'error')
      } else if (error.recoverable) {
        showRetryOption()
      } else {
        showFatalError(error.message)
      }
    }
  })

  const handleRetry = async () => {
    clearError()
    try {
      await updateConfig(lastConfig)
    } catch (err) {
      // Handle retry failure
    }
  }

  if (error && !error.recoverable) {
    return <ErrorFallback error={error} onRetry={handleRetry} />
  }

  // ... rest of component
}
```

## Performance Considerations

### Caching Strategy

The system implements a multi-level caching strategy:

1. **Memory Cache**: In-memory LRU cache for frequently accessed configurations
2. **IndexedDB Cache**: Persistent browser storage for offline capability
3. **Database Cache**: Server-side caching layer

### Optimization Features

- **Debounced Auto-save**: Prevents excessive database writes
- **Optimistic Updates**: Immediate UI updates with background sync
- **Batch Operations**: Efficient multi-step updates
- **Lazy Loading**: Load configurations only when needed
- **Cache Warming**: Preload configurations for better performance

### Performance Monitoring

```typescript
const { cacheMetrics } = useWorkspaceStore()

console.log(`Cache hit rate: ${cacheMetrics.hitRate * 100}%`)
console.log(`Average access time: ${cacheMetrics.averageAccessTime}ms`)
```

## Migration Support

### Legacy Configuration Migration

The system supports automatic migration from legacy workspace configurations:

```typescript
const { migrationStatus } = useMigrationStatus()

if (migrationStatus.migrationNeeded) {
  // Show migration prompt
  const migrate = async () => {
    await store.migrateToStepConfigs(workspaceId)
  }
}
```

### Backward Compatibility

- Legacy configurations continue to work
- Gradual migration with rollback support
- Version-aware schema handling
- Migration validation and error recovery

## Testing

### Unit Tests

```typescript
// Example test structure
describe('useStepConfig', () => {
  it('should provide type-safe configuration access', async () => {
    const { result } = renderHook(() => 
      useStepConfig('input-file', 'workspace-id')
    )
    
    await act(async () => {
      await result.current.updateConfig({
        selectedFile: '/test/video.mp4'
      })
    })
    
    expect(result.current.config?.selectedFile).toBe('/test/video.mp4')
    expect(result.current.isDirty).toBe(true)
  })
})
```

### Integration Tests

- Full workflow testing with real database
- Migration scenario testing
- Performance benchmarking
- Error recovery testing

## Best Practices

### 1. Always Use Type Guards

```typescript
// ✅ Good
if (isValidStepConfig('config', userInput)) {
  await store.setStepConfig(workspaceId, 'config', userInput)
}

// ❌ Bad
await store.setStepConfig(workspaceId, 'config', userInput as ConfigStepConfig)
```

### 2. Handle Empty States

```typescript
// ✅ Good
const { isEmpty, createFirstWorkspace } = useWorkspaceEmptyState()
if (isEmpty) {
  return <EmptyStateComponent onCreateWorkspace={createFirstWorkspace} />
}

// ❌ Bad
const { activeWorkspaceId } = useWorkspaceRequirement()
const config = useStepConfig('config', activeWorkspaceId!) // Dangerous!
```

### 3. Use Specialized Hooks

```typescript
// ✅ Good
const inputFile = useInputFileIntegration()
if (inputFile.canProceed) {
  // Move to next step
}

// ❌ Less optimal
const input = useStepConfig('input-file', workspaceId)
const manual = input.config?.selectedFile && input.validationResult?.isValid
```

### 4. Implement Error Boundaries

```typescript
const StepConfigErrorBoundary: React.FC = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={<StepConfigErrorFallback />}
      onError={(error) => {
        if (isStepConfigError(error)) {
          // Handle step config specific errors
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
```

## Troubleshooting

### Common Issues

1. **Configuration Not Loading**
   - Check workspace is active: `useWorkspaceRequirement()`
   - Verify step configs enabled: `stepConfigsEnabled`
   - Check network connectivity and database status

2. **Validation Errors**
   - Use `validateStepConfig()` for detailed error reporting
   - Check type guards: `isValidStepConfig()`
   - Review field-specific validation requirements

3. **Performance Issues**
   - Monitor cache hit rate: `getCacheMetrics()`
   - Enable debouncing: `debounceMs` option
   - Use batch operations for multiple updates

4. **Type Errors**
   - Ensure proper generic usage: `useStepConfig<K>`
   - Use type guards for runtime validation
   - Check TypeScript version compatibility

### Debug Tools

```typescript
// Enable debug logging
const config = useStepConfig('config', workspaceId, {
  onError: console.error,
  onValidationSuccess: () => console.log('✅ Valid'),
  onValidationError: (result) => console.warn('⚠️ Invalid:', result)
})

// Performance monitoring
const metrics = store.getCacheMetrics()
console.table(metrics)

// Health check
const { configHealth } = useWorkspaceStepIntegration()
console.log('Health:', configHealth?.overallHealth)
```

## API Reference

See the complete API documentation in the TypeScript definitions:

- `/types/workspace.ts` - Complete type definitions
- `/utils/typeGuards.ts` - Runtime type checking
- `/utils/stepConfigValidation.ts` - Validation system
- `/hooks/useStepConfig.ts` - React hooks
- `/hooks/useWorkspaceIntegration.ts` - Workspace integration

---

*For more examples, see `/examples/StepConfigUsageExamples.tsx`*
