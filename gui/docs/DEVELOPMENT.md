# Development Guide

This guide provides comprehensive information for developing the CantoCap GUI application.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Run tests
pnpm run test

# Build for production
pnpm run build
```

## Development Scripts

### Core Development

- `pnpm run dev` - Start Electron development server with hot reload
- `pnpm run build` - Build for production (~12s build time)
- `pnpm run preview` - Preview built application

### Code Quality

- `pnpm run lint` - Run ESLint with caching (optimized performance)
- `pnpm run lint:fix` - Auto-fix ESLint issues
- `pnpm run lint:performance` - Benchmark ESLint performance
- `pnpm run format` - Format code with Prettier
- `pnpm run format:check` - Check code formatting
- `pnpm run fix-unused-vars` - Auto-fix common unused variable patterns

### Type Checking

- `pnpm run type-check` - Check TypeScript types
- `pnpm run type-check:watch` - Watch mode for type checking

### Testing

- `pnpm run test` - Run all tests
- `pnpm run test:watch` - Watch mode for tests
- `pnpm run test:coverage` - Generate test coverage report
- `pnpm run test:migration` - Run migration validation tests
- `pnpm run test:performance` - Run performance benchmark tests

### Distribution

- `pnpm run dist` - Build and package for current platform
- `pnpm run dist:win` - Package for Windows
- `pnpm run dist:mac` - Package for macOS
- `pnpm run dist:linux` - Package for Linux

## Development Environment Setup

### VS Code Configuration

The project includes optimized VS Code settings:

- **Auto-formatting** on save with Prettier
- **ESLint integration** with auto-fix on save
- **TypeScript** IntelliSense optimizations
- **Debugging configurations** for Electron main/renderer processes
- **Recommended extensions** for optimal development experience

### Key Features

- Fast refresh for React components
- Source maps for debugging
- Optimized TypeScript compilation
- ESLint caching for faster linting
- Tailwind CSS IntelliSense

## Architecture Overview

### Multi-Process Architecture

```bash
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Main Process  │◄──►│ Renderer Process│◄──►│ Preload Scripts │
│   (Node.js)     │    │   (Chromium)    │    │   (Bridge)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **Main Process**: Electron app lifecycle, window management, file system access
- **Renderer Process**: React UI, user interactions, business logic
- **Preload Scripts**: Secure bridge between main and renderer processes

### Directory Structure

```bash
src/
├── main/           # Main process (Node.js + Electron)
├── preload/        # Preload scripts (Bridge)
├── renderer/       # Renderer process (React + TypeScript)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── stores/      # Zustand state management
│   │   ├── utils/       # Utility functions
│   │   └── types/       # TypeScript type definitions
├── types/          # Shared type definitions
```

## Build Optimizations

### Performance Enhancements

- **ESLint caching** reduces lint time by ~70%
- **TypeScript incremental compilation** for faster type checking
- **Vite optimizations** with chunk splitting and tree shaking
- **Source maps** enabled for debugging without performance impact

### Bundle Analysis

- Vendor chunk: React, React DOM (~25KB)
- MUI chunk: Material-UI components (~770KB)
- Utils chunk: Zustand, Highlight.js (~50KB)
- Main chunk: Application code (~1.3MB)

## Debugging

### Main Process Debugging

1. Start with `F5` or use "Debug Electron Main Process" configuration
2. Set breakpoints in `src/main/**/*.ts` files
3. Use Chrome DevTools for Node.js debugging

### Renderer Process Debugging

1. Use "Debug Electron Renderer Process" configuration
2. Open Chrome DevTools in the Electron window
3. Set breakpoints in React components and utilities

### Combined Debugging

Use the "Debug Electron (Main + Renderer)" compound configuration for full debugging capabilities.

## Code Quality Standards

### ESLint Configuration

- Optimized for Electron multi-process environment
- TypeScript-first with strict rules
- React Hooks compliance
- Performance-optimized with caching

### TypeScript Configuration

- Strict mode enabled
- Path mapping for clean imports
- ES2020 target with modern features
- Full type coverage required

### Testing Strategy

- Jest with jsdom environment
- React Testing Library for component tests
- Integration tests for critical workflows
- Performance benchmarks for optimization validation

## Performance Monitoring

### Build Performance

- Target build time: <15 seconds
- ESLint performance: <5 seconds with caching
- Type checking: <3 seconds incremental

### Runtime Performance

- First meaningful paint: <2 seconds
- Bundle size optimization with code splitting
- Memory usage optimization in Electron processes

## Common Issues & Solutions

### ESLint Performance

```bash
# Clear ESLint cache if experiencing issues
rm .eslintcache
pnpm run lint
```

### Build Issues

```bash
# Clean build artifacts
rm -rf dist dist-electron out .eslintcache
pnpm install
pnpm run build
```

### TypeScript Issues

```bash
# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P > "TypeScript: Restart TS Server"
```

## Contributing

1. Ensure all tests pass: `pnpm run test`
2. Lint and format code: `pnpm run lint:fix && pnpm run format`
3. Verify TypeScript compliance: `pnpm run type-check`
4. Test build process: `pnpm run build`

## IDE Extensions (Recommended)

Essential extensions for optimal development experience:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Jest
- GitLens
- Material Icon Theme

The project includes automatic extension recommendations in `.vscode/extensions.json`.
