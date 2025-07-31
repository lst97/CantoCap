# Step Configuration Type System Documentation

## Overview

This document describes the comprehensive TypeScript type system for step-specific workspace configurations in the Canton Cap GUI application. The type system enables type-safe, per-step configuration management with backward compatibility, caching, and migration support.

## Architecture

### Core Components

1. **Step Configuration Types** - Individual configuration interfaces for each workflow step
2. **Enhanced Store Types** - Type-safe store actions and state management  
3. **Cache Layer Types** - Performance optimization with intelligent caching
4. **Migration Types** - Backward compatibility and data migration support
5. **Validation Framework** - Runtime validation and error handling

### Workflow Steps

The system supports 5 workflow steps:

- `input-file` - File selection, validation, and metadata extraction
- `config` - Core processing configuration and API settings
- `processing` - Runtime processing settings and monitoring
- `review` - Subtitle review and editing preferences
- `export` - Output file settings and post-processing

## Type System Design

### Step Configuration Mapping

```typescript
export type StepConfigMap = {
  'input-file': InputFileStepConfig
  'config': ConfigStepConfig
  'processing': ProcessingStepConfig
  'review': ReviewStepConfig
  'export': ExportStepConfig
}
```

### Type-Safe Store Methods

```typescript
// Get step configuration with full type safety
getStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
  workspaceId: string, 
  stepId: K
): Promise<T | null>

// Set step configuration with type constraints
setStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
  workspaceId: string,
  stepId: K, 
  config: Partial<T>
): Promise<void>
```

## Usage Examples

### Basic Step Configuration Access

```typescript
import { useWorkspaceStore } from '../stores/workspace-store'
import type { ConfigStepConfig, InputFileStepConfig } from '../types/workspace'

const store = useWorkspaceStore()

// Type-safe getter - TypeScript knows the return type
const configStep: ConfigStepConfig | null = await store.getStepConfig(
  'workspace-id', 
  'config'
)

// Type-safe setter - TypeScript validates the config structure
await store.setStepConfig('workspace-id', 'config', {
  language: 'zh',
  priority: 'balanced',
  speakers: true
})

// Input file step example
const inputConfig: InputFileStepConfig | null = await store.getStepConfig(
  'workspace-id',
  'input-file'
)

await store.setStepConfig('workspace-id', 'input-file', {
  selectedFile: '/path/to/video.mp4',
  videoMetadata: {
    duration: 120,
    hasAudio: true,
    format: 'mp4'
  }
})
```

### Batch Operations

```typescript
// Update multiple step configurations at once
const updates: StepConfigUpdate[] = [
  {
    stepId: 'config',
    config: { language: 'en', priority: 'quality' },
    merge: true
  },
  {
    stepId: 'processing',
    config: { verbose: true },
    merge: true
  }
]

const result: BatchResult = await store.batchUpdateStepConfigs(
  'workspace-id',
  updates
)

if (result.success) {
  console.log(`Updated ${result.totalUpdated} configurations`)
} else {
  console.error('Batch update failed:', result.errors)
}
```

### Migration Support

```typescript
// Check if migration is needed
const needsMigration = await store.needsStepConfigMigration('workspace-id')

if (needsMigration) {
  // Perform migration
  const migrationResult = await store.migrateToStepConfigs('workspace-id')
  
  if (migrationResult.success) {
    console.log('Migration completed successfully')
  } else {
    // Rollback if needed
    await store.rollbackStepConfigMigration('workspace-id', migrationResult.rollbackData)
  }
}
```

### Validation and Health Checks

```typescript
import { checkConfigHealth, validateStepConfigSchema } from '../types/workspace'

// Validate individual step configuration
const validation = await store.validateStepConfig('workspace-id', 'config', {
  language: 'invalid-lang', // This will trigger validation error
  priority: 'quality'
})

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors)
}

// Full configuration health check
const stepConfigs = await store.getMultipleStepConfigs('workspace-id', [
  'input-file', 'config', 'processing', 'review', 'export'
])

const healthCheck = checkConfigHealth('workspace-id', stepConfigs)
console.log('Overall health:', healthCheck.overallHealth)
console.log('Issues:', healthCheck.issues)
```

### Cache Management

```typescript
// Configure caching
store.configureCaching({
  maxSize: 100 * 1024 * 1024, // 100MB
  defaultTTL: 600000,          // 10 minutes
  enableCompression: true
})

// Get cache metrics
const metrics = store.getCacheMetrics()
console.log(`Cache hit rate: ${metrics.hitRate}%`)

// Clear cache when needed
await store.clearStepConfigCache('workspace-id', 'config')

// Refresh cache from database
await store.refreshStepConfigCache('workspace-id', ['config', 'processing'])
```

## Integration with Components

### React Component Usage

```typescript
import React, { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'
import type { ConfigStepConfig } from '../types/workspace'

const ConfigStepComponent: React.FC = () => {
  const store = useWorkspaceStore()
  const currentWorkspace = store.currentWorkspace
  const [config, setConfig] = useState<ConfigStepConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentWorkspace) {
      loadConfig()
    }
  }, [currentWorkspace])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const stepConfig = await store.getStepConfig(
        currentWorkspace!.id, 
        'config'
      )
      setConfig(stepConfig)
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = async (updates: Partial<ConfigStepConfig>) => {
    try {
      await store.setStepConfig(
        currentWorkspace!.id,
        'config',
        updates,
        { merge: true }
      )
      // Reload to get updated config
      await loadConfig()
    } catch (error) {
      console.error('Failed to update config:', error)
    }
  }

  if (loading) return <div>Loading configuration...</div>
  if (!config) return <div>No configuration found</div>

  return (
    <div>
      <h2>Configuration Step</h2>
      <div>
        <label>Language: </label>
        <select 
          value={config.language || 'zh'}
          onChange={(e) => updateConfig({ language: e.target.value })}
        >
          <option value="zh">Chinese</option>
          <option value="en">English</option>
        </select>
      </div>
      <div>
        <label>Priority: </label>
        <select 
          value={config.priority || 'balanced'}
          onChange={(e) => updateConfig({ 
            priority: e.target.value as 'speed' | 'balanced' | 'quality'
          })}
        >
          <option value="speed">Speed</option>
          <option value="balanced">Balanced</option>
          <option value="quality">Quality</option>
        </select>
      </div>
    </div>
  )
}
```

## Error Handling

### Type-Safe Error Handling

```typescript
import { isStepConfigError, isWorkspaceError } from '../types/workspace'

try {
  await store.setStepConfig('workspace-id', 'config', invalidConfig)
} catch (error) {
  if (isStepConfigError(error)) {
    console.error('Step config error:', error.code)
    console.error('Step ID:', error.stepId)
    console.error('Validation errors:', error.validationErrors)
  } else if (isWorkspaceError(error)) {
    console.error('Workspace error:', error.code)
    console.error('Affected steps:', error.affectedSteps)
  } else {
    console.error('Unknown error:', error)
  }
}
```

## Performance Considerations

### Optimization Strategies

1. **Caching** - Intelligent caching with LRU eviction
2. **Batch Operations** - Reduce database round trips
3. **Lazy Loading** - Load configurations on demand
4. **Compression** - Compress large configurations
5. **Validation Optimization** - Cache validation results

### Monitoring

```typescript
// Monitor performance
const metrics = store.getEnhancedPerformanceMetrics()
const stepConfigMetrics = metrics.filter(m => m.category === 'step_config')

stepConfigMetrics.forEach(metric => {
  console.log(`Operation: ${metric.operationType}`)
  console.log(`Duration: ${metric.duration}ms`)
  console.log(`Step: ${metric.stepId}`)
  console.log(`Cache hit rate: ${metric.cacheMetrics?.hitRate}%`)
})
```

## Migration Strategy

### Legacy to Step Configuration Migration

The system automatically detects legacy workspace configurations and provides seamless migration:

1. **Detection** - Identifies workspaces using legacy flat configuration
2. **Migration** - Converts flat config to step-specific configurations
3. **Validation** - Ensures migrated data integrity
4. **Rollback** - Provides rollback capability if migration fails

### Migration Process

```typescript
// Migration is triggered automatically on first access
const config = await store.getStepConfig('workspace-id', 'config')

// Or manually trigger migration
const result = await store.migrateToStepConfigs('workspace-id')

if (result.success) {
  console.log(`Migrated ${result.statistics.successfulMigrations} workspaces`)
} else {
  console.error('Migration failed:', result.errors)
  // Rollback available
  if (result.rollbackData) {
    await store.rollbackStepConfigMigration('workspace-id', result.rollbackData)
  }
}
```

## Type Safety Benefits

1. **Compile-time validation** - Prevents runtime errors
2. **IntelliSense support** - Full IDE autocomplete and type checking
3. **Refactoring safety** - Changes are automatically validated across codebase
4. **API consistency** - Ensures consistent usage patterns
5. **Documentation** - Types serve as living documentation

## Implementation Status

✅ **Phase 1: Type Definitions** (Current)

- Complete step configuration interfaces
- Enhanced store type definitions
- Migration and compatibility types
- Utility types and type guards

🔄 **Phase 2: Implementation** (Next)

- Extend existing store with new methods
- Implement caching layer
- Add validation and error handling
- Create migration utilities

🔄 **Phase 3: Integration** (Future)

- Update components to use new types
- Add health monitoring
- Performance optimization
- Testing and validation

## Files Created/Modified

- `/gui/src/renderer/src/types/workspace.ts` - Enhanced with comprehensive step configuration types
- `/gui/docs/STEP_CONFIGURATION_TYPES.md` - This documentation file

The type system provides a solid foundation for the enhanced workspace configuration system while maintaining backward compatibility and developer experience.
