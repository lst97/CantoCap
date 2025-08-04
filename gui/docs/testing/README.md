# WorkflowStateManager Testing

This directory contains comprehensive testing for the WorkflowStateManager system.

## Quick Start

```bash
# Run all WorkflowStateManager tests
npm run test:workflow-state:all

# Run specific test categories
npm run test:workflow-state:unit        # Core functionality
npm run test:workflow-state:stress      # Stress testing
npm run test:workflow-state:e2e         # End-to-end scenarios
npm run test:workflow-state:hooks       # React integration
npm run test:workflow-state:accessibility # Accessibility compliance
npm run test:workflow-state:performance # Performance benchmarks

# Coverage reporting
npm run test:workflow-state:coverage
```

## Test Structure

- **Core Tests**: State transitions, validation, persistence
- **Stress Tests**: High-load scenarios, memory management
- **E2E Tests**: Complete workflow scenarios, app reload simulation
- **React Tests**: Hook integration, component behavior
- **Accessibility Tests**: ARIA compliance, keyboard navigation
- **Performance Tests**: Benchmarks, optimization validation

## Coverage Targets

- **Line Coverage**: 90%
- **Branch Coverage**: 85%
- **Function Coverage**: 95%
- **Statement Coverage**: 90%

## Performance Targets

- State transitions: **<1ms average**
- Notifications: **<10ms with 100+ observers**
- Cache operations: **<0.1ms average**
- Memory growth: **<50MB total**

## Documentation

See `workflow-state-testing-strategy.md` for detailed testing strategy and implementation details.