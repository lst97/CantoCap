# CantoCap Desktop GUI - Claude Code Documentation

## Project Overview

**CantoCap Desktop GUI** is a modern Electron-based desktop application for generating Cantonese subtitles from audio/video files. It provides an intuitive graphical interface for the CantoCap Python engine, featuring advanced AI-powered transcription with optional Gemini API integration, speaker identification, music detection, and comprehensive subtitle editing capabilities.

### Key Features
- 🎬 **Drag & Drop Interface** - Easy file selection with preview
- 🔧 **Advanced Configuration** - Comprehensive settings for transcription optimization
- ⚡ **Real-time Progress** - Live progress tracking with hardware monitoring
- 🧠 **AI-Powered** - Optional Gemini API integration for enhanced accuracy
- 🌐 **Multi-language** - Support for Traditional and Simplified Chinese output
- 🎯 **Speaker Identification** - Automatic speaker diarization
- 🎵 **Music Detection** - Identify and label music segments
- 📝 **Subtitle Editor** - Built-in editor with real-time preview
- 📱 **Cross-platform** - Windows, macOS, and Linux support

### Application Architecture
The application follows a **multi-process Electron architecture**:
- **Main Process**: System integration, file operations, Python engine communication
- **Renderer Process**: React UI with secure IPC communication
- **Engine Integration**: Communication with the CantoCap Python engine via IPC

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+, Electron 37.2.4
- **Package Manager**: pnpm 8.15.0
- **Build System**: Electron Vite 4.0.0 with Vite 7.0.6
- **Language**: TypeScript 5.8.3

### Frontend Stack
- **Framework**: React 19.1.1 with TypeScript
- **UI Library**: Material-UI (MUI) 7.2.0 with Emotion styling
- **State Management**: Zustand 5.0.6
- **Styling**: TailwindCSS 4.1.11 with PostCSS
- **Component Architecture**: Modular component system with step-based workflow

### Engine Integration
- **IPC Communication**: Secure Electron IPC with context isolation
- **Python Engine**: External CantoCap engine communication via process management
- **File Operations**: Native Electron file system APIs
- **System Integration**: Dependency checking, hardware monitoring

### Development Tools
- **Linting**: ESLint 9.32.0 with TypeScript and React plugins
- **Testing**: Jest with jsdom, React Testing Library
- **Build**: Electron Builder 26.0.19 for cross-platform distribution
- **Code Quality**: Strict TypeScript configuration with comprehensive rules

### External Dependencies
- **FFmpeg**: Required for audio/video processing
- **Python 3.12**: Required for running the external CantoCap engine
- **CantoCap Engine**: Standalone Python application for subtitle generation
- **System Libraries**: Platform-specific multimedia libraries

## Development Commands

### Quick Start
```bash
# Install Dependencies
pnpm install

# Start Development Server (with hot reload)
pnpm dev

# Start Preview Mode
pnpm preview
```

### Building & Distribution
```bash
# Build Application
pnpm build

# Type Check
pnpm type-check

# Lint Code
pnpm lint

# Package Application (without installer)
pnpm package

# Create Distribution (with installer)
pnpm dist

# Platform-specific Distribution
pnpm dist:win    # Windows
pnpm dist:mac    # macOS  
pnpm dist:linux  # Linux
```

### Testing
```bash
# Run Tests
npm test  # Note: Jest not yet in pnpm scripts

# Run Tests with Coverage
npm run test:coverage

# Watch Mode
npm run test:watch
```

### Maintenance
```bash
# Clean Build
rm -rf out dist node_modules && pnpm install

# Reinstall Dependencies
pnpm install --frozen-lockfile

# Update Dependencies
pnpm update
```

## Architecture Overview

### Project Structure
```
gui/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts         # Application entry point & IPC setup
│   │   ├── dependency-checker.ts  # System validation
│   │   ├── process-manager.ts     # External engine communication
│   │   ├── config-manager.ts      # Application configuration
│   │   └── initialization-service.ts  # Setup & dependency management
│   ├── preload/             # Secure IPC bridge
│   │   └── index.ts         # Context bridge API definitions
│   ├── renderer/            # React frontend application
│   │   └── src/
│   │       ├── components/  # React component library
│   │       │   ├── steps/   # Workflow step components
│   │       │   ├── layout/  # Layout & navigation components
│   │       │   ├── forms/   # Form input components
│   │       │   ├── feedback/# Progress & notification components
│   │       │   └── elements/# Base UI elements
│   │       ├── stores/      # Zustand state management
│   │       ├── services/    # Business logic services
│   │       ├── utils/       # Utility functions & helpers
│   │       ├── types/       # Component-specific TypeScript types
│   │       └── theme/       # MUI theme configuration
│   └── types/               # Shared TypeScript definitions
├── out/                     # Build output directory
├── dist/                    # Distribution packages
├── temp/                    # Temporary processing files
└── logs/                    # Application logs
```

### Component Architecture

#### Step-Based Workflow
The application implements a **5-step workflow** for subtitle generation:

1. **InputFileStep**: File selection and validation
2. **ConfigStep**: Transcription settings and API configuration
3. **ProcessingStep**: Real-time processing with progress tracking
4. **ReviewStep**: Subtitle editing and preview
5. **ExportStep**: Export options and file formats

#### State Management
- **app-store.ts**: Global application state (Zustand)
- **workflow-store.ts**: Step navigation and workflow state
- **subtitle-edit-store.ts**: Subtitle editing functionality
- **export-store.ts**: Export configuration and operations

#### IPC Communication
- **Secure Context Bridge**: No direct Node.js access from renderer
- **Typed IPC Messages**: Full TypeScript support for IPC calls
- **Event-Driven Updates**: Real-time progress and status updates
- **Error Handling**: Comprehensive error propagation and display

### Security Architecture
- **Context Isolation**: Enabled for security
- **Sandboxed Renderer**: No direct Node.js access
- **Input Validation**: All user inputs validated and sanitized
- **Secure File Operations**: Managed through IPC with permission checks

## Configuration

### Application Settings
Configuration is automatically managed through:
- **Local Storage**: UI preferences and non-sensitive settings
- **Encrypted Storage**: API keys and sensitive configuration
- **Window State**: Position, size, and maximization state
- **Processing History**: Previous transcription jobs

### Environment Variables
```bash
NODE_ENV=development|production         # Build environment
ELECTRON_RENDERER_URL=http://localhost  # Dev server URL (development only)
```

### Build Configuration Files
- **electron.vite.config.js**: Vite build configuration with React support
- **package.json**: Electron Builder settings and scripts
- **tsconfig.json**: TypeScript configuration with path aliases
- **eslint.config.js**: ESLint rules for all environments
- **jest.config.js**: Jest testing configuration
- **postcss.config.js**: PostCSS configuration for TailwindCSS

### Path Aliases
```typescript
"@/*": ["src/*"]
"@main/*": ["src/main/*"]
"@preload/*": ["src/preload/*"]  
"@renderer/*": ["src/renderer/*"]
```

## Testing Strategy

### Test Structure
```
src/
├── renderer/src/components/steps/__tests__/
│   └── ExportStep.test.tsx
├── renderer/src/stores/__tests__/
│   └── export-store.test.ts
├── renderer/src/services/__tests__/
│   └── message-processor.test.ts
└── renderer/src/utils/__tests__/
    ├── format-converters.test.ts
    └── format-converters.integration.test.ts
```

### Testing Framework
- **Jest**: Testing framework with jsdom environment
- **React Testing Library**: Component testing utilities
- **TypeScript Support**: Full TypeScript testing support
- **Coverage Thresholds**: 80% minimum coverage for critical components

### Test Categories
- **Unit Tests**: Individual component and utility testing
- **Integration Tests**: Service and store integration testing
- **Component Tests**: React component behavior testing
- **Format Tests**: Subtitle format conversion testing

## Development Workflow

### Getting Started
1. **Prerequisites**: Node.js 18+, pnpm, Python 3.12, FFmpeg
2. **Clone & Setup**: `cd gui && pnpm install`
3. **Start Development**: `pnpm dev`
4. **System Check**: Application will validate dependencies on startup

### Adding New Features
1. **Main Process**: Add system integration in `src/main/`
2. **IPC Communication**: Extend APIs in `src/preload/index.ts`
3. **UI Components**: Create React components in `src/renderer/src/components/`
4. **State Management**: Update Zustand stores in `src/renderer/src/stores/`
5. **Types**: Add TypeScript definitions in `src/types/`

### Code Style & Quality
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Enforced code style with React and TypeScript rules
- **Component Patterns**: Functional components with hooks
- **Error Boundaries**: Comprehensive error handling at component level

### Debugging
- **Main Process**: Node.js debugger or console logging
- **Renderer Process**: Browser DevTools (F12 in development)
- **IPC Messages**: Built-in debug panel for message monitoring
- **Engine Communication**: IPC message forwarding from external CantoCap engine

## Deployment & Distribution

### Prerequisites Check
The application automatically validates:
- **Node.js**: Version 18 or higher
- **Python**: Version 3.12 specifically required
- **FFmpeg**: System-wide installation required
- **System Libraries**: Platform-specific dependencies

### Build Process
1. **Development Build**: `pnpm build` (fast, unoptimized)
2. **Production Build**: `pnpm dist` (optimized, with installer)
3. **Platform Builds**: Separate commands for Windows, macOS, Linux
4. **Package Validation**: Automatic dependency bundling verification

### Distribution Outputs
- **Portable Apps**: Standalone executables
- **Installers**: Platform-specific installation packages
- **Auto-updater Ready**: Electron Builder auto-updater support

## Agent Dispatch Protocol

For complex, multi-domain tasks requiring specialized expertise, this project uses the Agent Organizer system.

When encountering tasks that involve:
- **Multi-Process Architecture**: Main/renderer/preload coordination
- **Electron-Specific Issues**: IPC, security, or packaging problems
- **React Component Development**: Complex UI components or state management
- **Engine Integration**: External CantoCap engine communication or process management
- **Cross-Platform Compatibility**: Platform-specific functionality
- **Performance Optimization**: Bundle size, memory usage, or startup time
- **Security Auditing**: Electron security best practices
- **Testing Infrastructure**: Component testing or E2E workflows

Use the Agent Organizer to assemble and coordinate specialized AI agents for optimal results.

### Recommended Agent Combinations

**For Electron Development**:
- `electron-pro`: Desktop application architecture and Electron-specific patterns
- `typescript-pro`: Type-safe development and advanced TypeScript features
- `security-auditor`: Electron security best practices and vulnerability assessment

**For React Frontend**:
- `react-pro`: Modern React patterns and component architecture
- `frontend-developer`: UI/UX optimization and responsive design
- `typescript-pro`: Component typing and state management

**For Engine Integration**:
- `backend-architect`: External engine communication and process management design
- `performance-engineer`: Optimization and resource management
- `devops-engineer`: Process orchestration and dependency management

**For Testing & Quality**:
- `test-automator`: Comprehensive testing strategy and automation
- `qa-expert`: Quality assurance and testing best practices
- `code-reviewer-pro`: Code quality and architectural review

## Troubleshooting

### Common Issues

**"Python 3.12 not found"**
- Install Python 3.12 from python.org
- Ensure `python3.12` or `python` is in PATH
- Required for running the external CantoCap engine
- Use initialization service for guided setup

**"FFmpeg not available"**
- **Windows**: `winget install FFmpeg` or download binaries
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`

**"Application won't start"**
- Verify Node.js version 18+
- Clear node_modules: `rm -rf node_modules && pnpm install`
- Check dependency conflicts in `pnpm-lock.yaml`

**"Build fails with permission errors"**
- Ensure write permissions to project directory
- **Windows**: Run as administrator if needed
- **macOS/Linux**: Check file ownership and permissions

### Performance Optimization
- **GPU Acceleration**: Enable in hardware settings for faster processing
- **Memory Usage**: Adjust chunk duration for large files  
- **Processing Priority**: Balance speed vs. quality in model settings
- **Bundle Optimization**: Use `pnpm build` for optimized production builds

### Development Issues
- **Hot Reload**: Restart dev server if hot reload stops working
- **Type Errors**: Run `pnpm type-check` for comprehensive type validation
- **IPC Issues**: Check preload script registration and context bridge setup
- **Engine Communication**: Monitor IPC debug panel for external engine messages

---

## Additional Resources

- **API Reference**: TypeScript definitions in `src/types/`
- **Component Library**: Storybook-ready component documentation
- **Architecture Decisions**: Git history and commit messages for context
- **Engine Dependencies**: Requires external CantoCap engine for subtitle generation

*This documentation is optimized for Claude Code interactions and provides comprehensive context for development, debugging, and feature enhancement.*