# Electron Integration Guide

## Overview

This guide covers the enhanced Electron integration features implemented for robust cross-platform state management, debugging, and performance monitoring.

## Architecture

### Core Components

1. **ElectronStateBridge** - Main integration service
2. **ElectronDebugPanel** - Advanced debugging interface
3. **ElectronStateValidator** - Cross-platform validation
4. **ElectronConfigManager** - Configuration management

### Integration Points

- Workflow State Manager integration
- Enhanced IPC communication
- Cross-platform file path handling
- Performance monitoring
- Security validation

## Features

### 1. Enhanced State Management

#### Cross-Platform Compatibility
```typescript
import { ElectronStateBridge } from './services/electron-state-bridge'

const bridge = ElectronStateBridge.getInstance()
await bridge.initialize()

// Persist state with Electron metadata
await bridge.persistState(snapshot, workspaceId)

// Load state with platform validation
const state = await bridge.loadState(workspaceId)
```

#### State Validation
```typescript
import { validateElectronState } from './utils/electron-state-validation'

const result = await validateElectronState(snapshot)
if (!result.isValid) {
  console.error('Validation errors:', result.errors)
  console.warn('Validation warnings:', result.warnings)
}
```

### 2. Advanced Debugging

#### Debug Panel Usage
```typescript
import { ElectronDebugPanel } from './components/debug/ElectronDebugPanel'

// Add to your component
<ElectronDebugPanel 
  isVisible={showDebug}
  onClose={() => setShowDebug(false)}
  position="floating"
/>
```

#### Console Commands (Development)
In the browser console, access debug utilities:
```javascript
// Check environment information
cantoCapDebug.getEnvironmentInfo()

// Test IPC connection
cantoCapDebug.testIPC()

// Open DevTools
cantoCapDebug.openDevTools()

// Get memory usage
cantoCapDebug.getMemoryUsage()

// Generate debug report
cantoCapDebug.generateReport()
```

### 3. Performance Monitoring

#### Automatic Monitoring
- Memory usage tracking
- IPC latency measurement
- State transition timing
- Cross-platform performance metrics

#### Manual Performance Checks
```typescript
import { ElectronDebugCollector } from './services/electron-state-bridge'

// Update performance metrics
ElectronDebugCollector.updatePerformanceMetrics({
  stateTransitionTime: 25.5,
  ipcLatency: 10.2,
  renderTime: 16.7
})

// Generate performance report
const report = await ElectronDebugCollector.generateDebugReport()
```

### 4. Configuration Management

#### Basic Configuration
```typescript
import { electronConfigManager, applyElectronConfigPreset } from './config/electron-integration'

// Apply preset for development
applyElectronConfigPreset('development')

// Custom configuration
electronConfigManager.updateConfig({
  performance: {
    memoryWarningThreshold: 150,
    stateTransitionWarningThreshold: 30
  },
  debug: {
    enabled: true,
    logLevel: 'debug'
  }
})
```

#### Available Presets
- `development` - Full debugging and monitoring
- `production` - Minimal overhead, error logging only
- `testing` - Optimized for test environments
- `highPerformance` - Lower thresholds, larger caches
- `secure` - Enhanced security validation

## Platform-Specific Features

### Windows
- Automatic path normalization (`/` → `\`)
- Windows-specific performance metrics
- Registry integration (if needed)

### macOS
- macOS-specific memory management
- Native notification integration
- Keychain integration support

### Linux
- X11/Wayland compatibility
- Distribution-specific optimizations
- Package manager integration

## Security Features

### Context Isolation Validation
- Verifies proper context isolation setup
- Warns about security misconfigurations
- Validates IPC communication integrity

### Sandbox Compatibility
- Detects sandbox mode status
- Provides fallback mechanisms
- Security recommendations

### Process Isolation
- Validates proper process separation
- Monitors inter-process communication
- Detects potential security issues

## Performance Thresholds

### Memory Usage
- **Warning**: 100MB heap usage
- **Critical**: 200MB heap usage
- **Heap Fragmentation**: >90% of allocated heap

### Timing
- **State Transitions**: <50ms (warning), <100ms (critical)
- **IPC Latency**: <20ms (warning), <50ms (critical)
- **Validation**: <100ms for complete state validation

### Optimization Recommendations
- Use validation cache for repeated operations
- Enable compression for large state snapshots
- Batch IPC operations when possible
- Monitor memory usage in long-running sessions

## Error Handling

### Common Issues and Solutions

#### IPC Communication Failures
```typescript
// Automatic retry with exponential backoff
const result = await ElectronIPCBridge.safeIPCCall('operation', data, timeout)
if (result === null) {
  // Handle failure - check main process health
  const isHealthy = await ElectronIPCBridge.checkIPCHealth()
  if (!isHealthy) {
    // Suggest restart or show error to user
  }
}
```

#### Platform Compatibility Issues
```typescript
// Automatic path normalization
const normalizedPath = await ElectronPathUtils.normalizePath(inputPath)

// Cross-platform validation
const result = await validateElectronState(snapshot)
const platformIssues = result.errors.filter(e => e.category === 'compatibility')
```

#### Memory Management
```typescript
// Monitor memory usage
const envInfo = await bridge.getElectronEnvironmentInfo()
if (envInfo.memory?.usedJSHeapSize > 200 * 1024 * 1024) {
  // Clear caches, trigger GC, or warn user
  electronStateValidator.clearCache()
}
```

## Testing

### Integration Tests
Run the comprehensive test suite:
```bash
npm run test:integration -- --testPathPattern=electron-state-integration
```

### Manual Testing Checklist
- [ ] State persistence across app restarts
- [ ] Cross-platform path handling
- [ ] IPC communication under load
- [ ] Memory usage under normal operation
- [ ] Debug panel functionality
- [ ] Error recovery mechanisms

## Debugging Tips

### Enable Verbose Logging
```typescript
updateElectronConfig({
  debug: {
    enabled: true,
    logLevel: 'debug',
    enablePerformanceMonitoring: true
  }
})
```

### Access Debug Information
1. Open DevTools (F12 or Ctrl+Shift+I)
2. Check Console for debug messages
3. Use `cantoCapDebug` commands
4. Export debug report for analysis

### Performance Profiling
1. Enable performance monitoring
2. Monitor state transition times
3. Check memory usage patterns
4. Analyze IPC communication frequency

## Migration Guide

### From Legacy State Management
1. Import new services
2. Update state persistence calls
3. Add validation where needed
4. Test cross-platform compatibility

### Configuration Migration
```typescript
// Old approach
localStorage.setItem('debug-panel', 'true')

// New approach
updateElectronConfig({
  debug: { enabled: true }
})
```

## Best Practices

### State Management
- Always validate state before persistence
- Use branded types for type safety
- Handle cross-platform path issues
- Monitor performance metrics

### Debugging
- Use debug panel for development
- Export reports for issue analysis
- Monitor IPC health regularly
- Clear validation cache periodically

### Security
- Enable context isolation
- Validate IPC communications
- Monitor security events
- Follow principle of least privilege

### Performance
- Use validation cache effectively
- Monitor memory usage
- Batch operations when possible
- Set appropriate thresholds

## Troubleshooting

### Common Problems

1. **High Memory Usage**
   - Clear validation cache: `electronStateValidator.clearCache()`
   - Check for memory leaks in state management
   - Monitor long-running operations

2. **Slow State Transitions**
   - Check performance thresholds
   - Enable performance monitoring
   - Optimize state logic

3. **IPC Communication Issues**
   - Test IPC health: `cantoCapDebug.testIPC()`
   - Check main process connectivity
   - Verify context isolation setup

4. **Cross-Platform Issues**
   - Use path normalization utilities
   - Test on all target platforms
   - Validate platform-specific code

### Support Resources
- Debug reports: Use `generateDebugReport()` for detailed analysis
- Performance metrics: Monitor via debug panel
- Error logs: Check console and persistent logs
- Community: Share debug reports for assistance

## Future Enhancements

### Planned Features
- Real-time performance dashboards
- Advanced memory profiling
- Network communication monitoring
- Plugin system for custom validators

### Contribution Guidelines
- Follow TypeScript best practices
- Add comprehensive tests
- Update documentation
- Consider cross-platform compatibility

---

For more detailed information, see the individual component documentation and TypeScript definitions in the codebase.