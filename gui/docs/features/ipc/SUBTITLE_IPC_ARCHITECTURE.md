# Electron IPC Architecture for Subtitle File Operations

## Overview

This document describes the comprehensive Electron IPC architecture for secure subtitle file persistence that integrates seamlessly with the existing workspace system and subtitle editing functionality.

## Architecture Components

### 1. **Type System** (`src/types/subtitle-ipc.ts`)

- **Comprehensive type definitions** for all IPC operations
- **Security-focused interfaces** with validation and error handling
- **Performance optimization types** for caching and streaming
- **Integration with existing types** (SubtitleData, WorkspaceConfig, etc.)

### 2. **Main Process Handler** (`src/main/subtitle-file-manager.ts`)

- **Secure file operations** with workspace integration
- **Performance optimization** through caching and compression
- **Error handling and recovery** following existing patterns
- **Metrics and monitoring** for performance tracking

### 3. **IPC Integration** (`src/main/index.ts`)

- **Secure IPC channels** following established patterns
- **Error handling** with consistent logging
- **Integration with existing workspace system**

### 4. **Preload Security Layer** (`src/preload/index.ts`)

- **Contextbridge exposure** of subtitle file APIs
- **Type safety** at the IPC boundary
- **Event listener management**

## Backend Architecture Implementation

The system implements the required backend architecture:

```bash
userData/workspaces/workspace_[id]/subtitles/
├── original.json      // Original subtitle data
├── modified.json      // User-modified subtitle data  
├── metadata.json      // File metadata and tracking
├── sessions/          // Session state backups
│   ├── session-{id}.json
│   └── ...
└── backups/          // File backups
    ├── original-backup-{timestamp}.json
    └── ...
```

## Security Implementation

### 1. **Path Validation and Sanitization**

```typescript
// Comprehensive path validation
const pathValidation = this.validateFilePath(filePath, 'write')
if (!pathValidation.isValid) {
  throw this.createError('PATH_TRAVERSAL_BLOCKED', 'Invalid file path')
}
```

### 2. **Workspace Access Control**

```typescript
// Validate workspace exists and is accessible
const workspaceConfig = await this.workspaceManager.getWorkspaceConfig(workspaceId)
if (!workspaceConfig) {
  throw this.createError('WORKSPACE_NOT_FOUND', 'Workspace not found')
}
```

### 3. **File Integrity Validation**

```typescript
// Checksum validation for file integrity
if (params.options?.validateChecksum && parsedContent.metadata?.checksum) {
  const actualChecksum = this.calculateChecksum(fileContent)
  if (actualChecksum !== parsedContent.metadata.checksum) {
    throw this.createError('CHECKSUM_MISMATCH', 'File integrity check failed')
  }
}
```

### 4. **Optimistic Locking**

```typescript
// Version conflict detection
if (params.options?.expectedVersion && existingContent.metadata.version !== params.options.expectedVersion) {
  throw this.createError('VERSION_CONFLICT', 'File was modified by another process')
}
```

## Performance Optimization

### 1. **Intelligent Caching System**

- **LRU cache** with configurable size and TTL
- **Cache hit/miss metrics** for monitoring
- **Automatic cache cleanup** and compression
- **Workspace-specific cache** clearing

```typescript
// Cache configuration
const DEFAULT_SUBTITLE_CACHE_CONFIG: SubtitleFileCacheConfig = {
  enabled: true,
  maxSize: 100 * 1024 * 1024, // 100MB
  maxEntries: 1000,
  defaultTTL: 300000, // 5 minutes
  enableLRU: true
}
```

### 2. **File Compression Support**

- **Optional compression** for large subtitle files
- **Compression cache** for frequently accessed files
- **Compression ratio tracking** for optimization

### 3. **Batch Operations**

- **Controlled concurrency** for multiple operations
- **Continue-on-error** support for bulk operations
- **Performance statistics** and timing metrics

### 4. **Streaming for Large Files**

- **Chunked reading/writing** for files >50MB
- **Progress tracking** for long operations
- **Memory-efficient processing**

## Integration with Existing Systems

### 1. **Workspace Manager Integration**

```typescript
// Reuses existing workspace validation and directory management
const workspaceDir = await this.getWorkspaceSubtitleDir(params.workspaceId)
const workspaceConfig = await this.workspaceManager.getWorkspaceConfig(workspaceId)
```

### 2. **Error Handling Patterns**

```typescript
// Follows existing error logging patterns
safeError('Failed to create subtitle file:', error);
return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
```

### 3. **Performance Metrics**

```typescript
// Integrates with existing performance tracking
this.recordPerformanceMetric({
  operationType: 'create',
  duration: Date.now() - startTime,
  success: true,
  workspaceId: params.workspaceId
});
```

## Usage Examples

### 1. **Creating a Subtitle File**

```typescript
// In renderer process
const result = await window.electronAPI.createSubtitleFile({
  workspaceId: 'workspace_123',
  fileType: 'original',
  content: subtitleEntries,
  options: {
    compress: true,
    encoding: 'utf8',
    createBackup: true
  }
});

if (result.success) {
  console.log('File created:', result.data.filePath);
}
```

### 2. **Loading with Cache**

```typescript
const result = await window.electronAPI.loadSubtitleFile({
  workspaceId: 'workspace_123',
  fileType: 'modified',
  options: {
    useCache: true,
    validateChecksum: true
  }
});

if (result.success) {
  console.log('Loaded from cache:', result.metadata?.fromCache);
  console.log('Subtitles:', result.data.subtitles);
}
```

### 3. **Saving with Optimistic Locking**

```typescript
const result = await window.electronAPI.saveSubtitleFile({
  workspaceId: 'workspace_123',
  fileType: 'modified',
  content: updatedSubtitles,
  sessionInfo: {
    sessionId: currentSession.sessionId,
    videoPath: currentSession.videoPath,
    modifications: modifications
  },
  options: {
    expectedVersion: currentMetadata.version,
    createBackup: true
  }
});
```

### 4. **Batch Operations**

```typescript
const result = await window.electronAPI.batchSubtitleOperation({
  workspaceId: 'workspace_123',
  operations: [
    {
      type: 'save',
      params: saveParams
    },
    {
      type: 'cleanup',
      params: cleanupParams
    }
  ],
  options: {
    continueOnError: true,
    maxConcurrency: 3
  }
});

console.log('Batch result:', result.statistics);
```

## Integration with Subtitle Edit Store

The IPC layer integrates seamlessly with the existing subtitle editing store:

```typescript
// In subtitle-edit-store.ts
const saveToFile = async (workspaceId: string, sessionId: string) => {
  const session = get().session;
  if (!session) return;

  const result = await window.electronAPI.saveSubtitleFile({
    workspaceId,
    fileType: 'session',
    content: session.currentSubtitles,
    sessionInfo: {
      sessionId,
      videoPath: session.videoPath,
      modifications: session.modifications
    },
    options: {
      compress: true,
      createBackup: false
    }
  });

  if (result.success) {
    set(state => ({
      session: {
        ...state.session!,
        isDirty: false,
        lastModified: new Date()
      }
    }));
  }
};
```

## Error Handling and Recovery

### 1. **Comprehensive Error Codes**

```typescript
export type SubtitleFileErrorCode = 
  | 'FILE_NOT_FOUND'
  | 'FILE_ACCESS_DENIED' 
  | 'FILE_CORRUPTED'
  | 'WORKSPACE_NOT_FOUND'
  | 'INVALID_SESSION'
  | 'CHECKSUM_MISMATCH'
  | 'VERSION_CONFLICT'
  // ... more codes
```

### 2. **Error Recovery Suggestions**

```typescript
interface SubtitleFileError extends Error {
  recovery?: {
    canRetry: boolean
    suggestedAction: string
    alternativeFiles?: string[]
  }
}
```

### 3. **Graceful Degradation**

- **Cache misses** fall back to file system
- **Compression failures** fall back to uncompressed storage
- **Version conflicts** provide merge strategies
- **File corruption** attempts backup recovery

## Performance Monitoring

### 1. **Cache Metrics**

```typescript
interface SubtitleFileCacheMetrics {
  hitRate: number
  totalRequests: number
  currentSize: number
  entryCount: number
  averageAccessTime: number
  evictions: number
}
```

### 2. **Operation Metrics**

```typescript
interface SubtitleFilePerformanceMetrics {
  operationType: 'create' | 'load' | 'save' | 'delete' | 'cleanup'
  duration: number
  success: boolean
  fileSize?: number
  fromCache?: boolean
  compressionRatio?: number
}
```

## Security Best Practices

1. **Path Traversal Protection**: All file paths are validated and sanitized
2. **Workspace Isolation**: Files are isolated within workspace directories
3. **File Type Validation**: Only allowed file types can be processed
4. **Content Validation**: File content is validated before processing
5. **Error Information Limiting**: Error messages don't expose sensitive paths
6. **Atomic Operations**: File writes use atomic operations to prevent corruption

## Future Enhancements

1. **Real-time Synchronization**: WebSocket-based real-time updates
2. **Advanced Compression**: Implement actual compression algorithms (zlib, lz4)
3. **Encryption Support**: Add encryption for sensitive subtitle content
4. **Cloud Storage Integration**: Support for cloud-based subtitle storage
5. **Conflict Resolution UI**: User interface for handling merge conflicts
6. **Performance Profiling**: Advanced performance analysis and optimization

## File Structure Summary

```bash
src/
├── types/
│   └── subtitle-ipc.ts           # Comprehensive IPC type definitions
├── main/
│   ├── index.ts                  # IPC handler registration
│   └── subtitle-file-manager.ts  # Core file operation logic
└── preload/
    └── index.ts                  # Secure API exposure
```

This architecture provides a secure, performant, and well-integrated solution for subtitle file persistence that follows Electron security best practices and seamlessly integrates with the existing application architecture.
