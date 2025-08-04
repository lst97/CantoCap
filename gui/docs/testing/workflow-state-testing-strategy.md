# WorkflowStateManager Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for the WorkflowStateManager system, covering all state transitions, edge cases, performance requirements, and integration scenarios.

## Testing Goals

- **90%+ test coverage** for state management code
- **All state transitions validated** (valid and invalid combinations)
- **Atomic operations and rollback** scenarios tested
- **Persistence and restoration** across app reloads
- **React component integration** and re-rendering behavior
- **Error handling and recovery** mechanisms
- **Performance benchmarks** and stress testing
- **UI accessibility** and disabled state behavior
- **Observer pattern** and notification systems

## Test Suite Structure

### 1. Core Functionality Tests (`workflow-state-manager.test.ts`)

**Scope:** Basic state management, transitions, validation, and core features

**Test Categories:**
- **Initialization:** Default step states, current step, empty history
- **State Transition Validation:** All valid/invalid transition combinations
- **Dependent Step Management:** Automatic blocking/unblocking of subsequent steps
- **Atomic Operations:** Rollback functionality, transaction-like behavior
- **Batch Operations:** Multiple state changes with atomic semantics
- **Performance & Caching:** Validation caching, cache invalidation
- **State Persistence:** Save/load functionality with mock persistence
- **Observer Pattern:** Event notification, subscription management
- **State History:** Circular buffer, entry limits
- **Utility Methods:** Type-safe getters, accessibility checks
- **Error Handling:** Invalid inputs, edge cases

**Key Test Scenarios:**
```typescript
// Valid transition matrix testing
Ready → Complete ✓
Ready → Error ✓
Ready → Warning ✓
Ready → Blocked ✓
Ready → Skip ✓

Complete → Ready ✓
Complete → Error ✓
Complete → Blocked ✗ (invalid)

Error → Ready ✓
Error → Warning ✓
Error → Complete ✗ (invalid)

// Dependency chain testing
input-file Complete → config Ready
config Complete → processing Ready
Reset input-file → block all subsequent steps
```

### 2. Stress Testing (`workflow-state-manager-stress.test.ts`)

**Scope:** High-load scenarios, memory management, concurrent operations

**Test Categories:**
- **High-Volume Operations:** 1000+ rapid state transitions
- **Memory Management:** Memory leak detection, bounded growth
- **Cache Performance:** High hit rates under load, efficient invalidation
- **Concurrent Operations:** Simultaneous read/write, data consistency
- **Resource Exhaustion:** Excessive observers, rapid changes
- **Error Recovery:** Transient errors, observer failures

**Performance Targets:**
- State transitions: **<1ms average**
- Notifications: **<10ms with 100+ observers**
- Cache operations: **<0.1ms average**
- Memory growth: **<50MB total**

### 3. End-to-End Integration (`workflow-state-manager-e2e.test.ts`)

**Scope:** Complete workflow scenarios, persistence integration, app reload simulation

**Test Categories:**
- **Complete Workflow Execution:** Full subtitle generation workflow
- **Error Scenarios:** Processing failures, recovery workflows
- **Workflow Variations:** Skipped steps, warnings, mixed states
- **Persistence Integration:** Save/restore across sessions
- **Auto-Save Functionality:** Interval-based persistence
- **Data Corruption Handling:** Invalid persistence data recovery
- **Concurrent Instances:** Multiple browser tabs/windows

**Realistic Scenarios:**
- Upload → Configure → Process → Review → Export
- Processing error → Recovery → Continue
- Skip processing (use existing subtitles) → Review → Export
- App reload during processing → State restoration

### 4. React Integration (`useWorkflowStateManager.test.tsx`)

**Scope:** React hooks, component integration, re-rendering behavior

**Test Categories:**
- **Hook Functionality:** All custom hooks return correct data
- **State Synchronization:** React state updates with manager changes
- **Re-rendering Optimization:** Memoization prevents unnecessary renders
- **Event Handling:** State change events trigger React updates
- **Navigation Logic:** Step accessibility validation
- **Transition Methods:** Hook-based state transitions
- **Error States:** Error handling in React context
- **Legacy Compatibility:** Boolean flag mapping

**Hook Coverage:**
- `useWorkflowState` - Complete workflow state access
- `useStepState` - Individual step state management
- `useWorkflowNavigation` - Step navigation with validation
- `useStepTransitions` - State transition operations
- `useStepValidation` - Accessibility and progress checks
- `useWorkflowControl` - Workflow control operations
- `useLegacyWorkflowCompat` - Backward compatibility

### 5. Accessibility Testing (`WorkflowStateManager-accessibility.test.tsx`)

**Scope:** ARIA compliance, keyboard navigation, screen reader compatibility

**Test Categories:**
- **ARIA Compliance:** Proper roles, labels, descriptions
- **Keyboard Navigation:** Tab order, Enter/Space activation, arrow keys
- **Screen Reader Support:** Meaningful announcements, state changes
- **Disabled State Behavior:** Proper indication, prevented interaction
- **Live Regions:** Error alerts, status updates, progress announcements
- **Focus Management:** Logical focus flow, error recovery

**Accessibility Standards:**
- **WCAG 2.1 AA compliance**
- **Semantic HTML structure**
- **Keyboard-only navigation support**
- **Screen reader compatibility**
- **High contrast support**

### 6. Performance Benchmarks (`workflow-state-manager-performance.test.ts`)

**Scope:** Performance measurement, optimization validation, benchmark tracking

**Test Categories:**
- **State Transition Speed:** <1ms target measurement
- **Notification Performance:** Observer scaling, debouncing efficiency
- **Cache Effectiveness:** Hit rates, invalidation speed
- **Memory Management:** Leak detection, garbage collection pressure
- **Batch Operation Scaling:** Linear performance with batch size
- **Real-World Scenarios:** Realistic workflow performance

**Benchmark Targets:**
```typescript
PERFORMANCE_TARGETS = {
  STATE_TRANSITION: 1,    // 1ms per transition
  NOTIFICATION: 10,       // 10ms with 100 observers
  CACHE_ACCESS: 0.1,      // 0.1ms cache lookup
  BATCH_OPERATION: 50,    // 50ms for 10 operations
  MEMORY_LIMIT: 50MB      // Maximum memory growth
}
```

## Test Utilities and Helpers

### Mock Infrastructure (`workflow-state-test-utils.ts`)

**Components:**
- **MockPersistence:** Configurable persistence simulation
- **StepStateFactory:** Test data generation
- **StateChangeEventCollector:** Event tracking and assertions
- **WorkflowScenarioBuilder:** Predefined test scenarios
- **PerformanceTestUtils:** Timing and memory measurement
- **MockWorkflowStateManager:** Pre-configured test instances

**Usage Examples:**
```typescript
// Create test scenario
const scenario = WorkflowScenarioBuilder.completeWorkflow()
await scenario.execute(manager)

// Collect and verify events
const collector = new StateChangeEventCollector()
collector.subscribe(manager)
collector.expectTransition('input-file', StepState.Ready, StepState.Complete)

// Performance measurement
const measurement = await PerformanceTestUtils.measureOperation(
  () => manager.transitionState('input-file', StepState.Complete)
)
PerformanceTestUtils.expectPerformanceTarget(measurement.duration, 1, 'transition')
```

## Running Tests

### Test Commands

```bash
# Run all workflow state tests
npm run test:workflow-state

# Run specific test suites
npm test workflow-state-manager.test.ts
npm test workflow-state-manager-stress.test.ts
npm test workflow-state-manager-e2e.test.ts
npm test useWorkflowStateManager.test.tsx
npm test WorkflowStateManager-accessibility.test.tsx
npm test workflow-state-manager-performance.test.ts

# Coverage reporting
npm run test:coverage -- --testPathPattern=workflow-state

# Performance benchmarking
npm run test:performance -- --testPathPattern=workflow-state-manager-performance

# Accessibility testing
npm run test:accessibility -- --testPathPattern=accessibility
```

### Test Configuration

**Jest Configuration for Workflow Tests:**
```javascript
{
  testMatch: ['**/__tests__/**/*workflow-state*.test.*'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'jsdom',
  coverageThreshold: {
    'src/services/workflow-state-manager.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
}
```

### CI/CD Integration

**GitHub Actions Workflow:**
```yaml
- name: Run Workflow State Tests
  run: |
    npm run test:workflow-state
    npm run test:coverage -- --testPathPattern=workflow-state
    npm run test:performance -- --testPathPattern=workflow-state-manager-performance

- name: Accessibility Testing
  run: |
    npm run test:accessibility -- --testPathPattern=accessibility
    npm run test -- --testPathPattern=accessibility --coverage
```

## Test Data and Scenarios

### Standard Test Scenarios

1. **Happy Path Workflow:**
   - Complete all steps in sequence
   - Verify dependent step unblocking
   - Check final state consistency

2. **Error Recovery:**
   - Introduce processing error
   - Recover from error state
   - Continue workflow normally

3. **Step Skipping:**
   - Skip processing step
   - Manual unblock of review
   - Complete remaining workflow

4. **Persistence Scenarios:**
   - Save state mid-workflow
   - Simulate app restart
   - Restore and continue

5. **Concurrent Operations:**
   - Multiple rapid state changes
   - Batch operations with conflicts
   - Observer notification stress

### Edge Cases

- Invalid step IDs and state values
- Concurrent transition attempts
- Observer errors during notifications
- Persistence failures and recovery
- Memory pressure scenarios
- Network timeouts in persistence

## Coverage Requirements

### Minimum Coverage Targets

- **Line Coverage:** 90%
- **Branch Coverage:** 85%
- **Function Coverage:** 95%
- **Statement Coverage:** 90%

### Critical Path Coverage

- All state transition combinations
- Error handling pathways
- Observer notification flows
- Persistence save/load cycles
- Cache invalidation logic
- Dependency management rules

## Performance Monitoring

### Continuous Benchmarking

Track performance metrics across test runs:
- State transition timing
- Memory usage patterns
- Cache hit rates
- Observer notification efficiency

### Performance Regression Detection

Alert on performance degradation:
- >20% increase in transition time
- >50% increase in memory usage
- <70% cache hit rate
- >100ms notification delays

## Quality Assurance

### Code Review Checklist

- [ ] All state transitions tested
- [ ] Error conditions covered
- [ ] Performance targets met
- [ ] Accessibility standards verified
- [ ] React integration validated
- [ ] Documentation updated

### Test Maintenance

- Review test scenarios quarterly
- Update performance baselines
- Validate accessibility compliance
- Refactor test utilities as needed
- Monitor test execution time

## Debugging and Troubleshooting

### Common Test Issues

1. **Timing Issues:** Use fake timers for debouncing tests
2. **Memory Leaks:** Ensure proper cleanup in afterEach
3. **Mock Persistence:** Reset state between tests
4. **React Testing:** Use proper act() wrapper for state updates
5. **Performance Tests:** Use real timers for accurate measurement

### Test Debugging Tools

- Performance profiler utilities
- State change event logging
- Memory usage tracking
- Cache hit rate monitoring
- Observer notification tracing

## Future Enhancements

### Planned Test Improvements

- Visual regression testing for UI components
- Cross-browser compatibility testing
- Mobile device testing scenarios
- Internationalization testing
- Security vulnerability testing

### Test Automation Expansion

- Property-based testing for state transitions
- Mutation testing for test effectiveness
- Continuous performance monitoring
- Automated accessibility scanning
- Load testing with realistic data volumes

This comprehensive testing strategy ensures the WorkflowStateManager system meets all quality, performance, and accessibility requirements while providing confidence in its reliability and maintainability.