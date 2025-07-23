# CantoCap Desktop GUI

A modern Electron desktop application for generating Cantonese subtitles from audio/video files with an intuitive graphical interface.

## Features

- 🎬 **Drag & Drop Interface** - Easy file selection with preview
- 🔧 **Advanced Configuration** - Comprehensive settings for transcription optimization
- ⚡ **Real-time Progress** - Live progress tracking with hardware monitoring
- 🧠 **AI-Powered** - Optional Gemini API integration for enhanced accuracy
- 🌐 **Multi-language** - Support for Traditional and Simplified Chinese output
- 🎯 **Speaker Identification** - Automatic speaker diarization
- 🎵 **Music Detection** - Identify and label music segments
- 📱 **Cross-platform** - Windows, macOS, and Linux support

## Prerequisites

Before running the application, ensure you have:

- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **pnpm** - Install with `npm install -g pnpm`
- **Python 3.12** - Download from [python.org](https://www.python.org/downloads/release/python-3120/)
- **FFmpeg** - Download from [ffmpeg.org](https://ffmpeg.org/download.html)

The application will automatically check for these dependencies and guide you through installation if needed.

## Quick Start

### Development Setup

1. **Clone and Navigate**
   ```bash
   cd gui
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Start Development Server**
   ```bash
   pnpm dev
   ```

The application will automatically open and check for system dependencies.

### Building for Production

1. **Build the Application**
   ```bash
   pnpm build
   ```

2. **Package for Distribution**
   ```bash
   # Build for current platform
   pnpm dist
   
   # Build for specific platforms
   pnpm dist:win    # Windows
   pnpm dist:mac    # macOS
   pnpm dist:linux  # Linux
   ```

3. **Find Distribution Files**
   - Built applications will be in the `dist/` directory
   - Installers and portable versions available for each platform

## Project Structure

```
gui/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts         # Application entry point
│   │   ├── dependency-checker.ts  # System validation
│   │   └── process-manager.ts     # Python CLI integration
│   ├── preload/             # Secure IPC bridge
│   │   └── index.ts         # Context bridge API
│   ├── renderer/            # React frontend
│   │   └── src/
│   │       ├── components/  # React components
│   │       ├── store/       # Zustand state management
│   │       ├── styles/      # CSS styles
│   │       └── types/       # TypeScript definitions
│   └── types/               # Shared type definitions
├── resources/               # Static assets
├── build/                   # Build configuration
└── dist/                    # Built application
```

## Architecture Overview

### Multi-Process Architecture
- **Main Process** - System integration, file operations, Python CLI management
- **Renderer Process** - React UI with secure IPC communication
- **Python Engine** - Subtitle generation backend (located in `../engine/`)

### Key Technologies
- **Electron + Vite** - Fast development with hot reloading
- **React + TypeScript** - Type-safe modern UI development
- **Zustand** - Lightweight state management
- **Node.js Spawn** - Secure Python process management

### Security Features
- **Context Isolation** - Secure IPC between processes
- **Sandboxed Renderer** - No direct Node.js access from UI
- **Input Validation** - All user inputs validated and sanitized

## Configuration

### Application Settings
The app automatically saves configuration to local storage:
- File paths and processing options
- API keys (encrypted)
- UI preferences

### Environment Variables
- `NODE_ENV` - Development/production mode
- `ELECTRON_RENDERER_URL` - Dev server URL (development only)

### Build Configuration
- `electron.vite.config.js` - Vite build configuration
- `package.json` - Electron Builder settings
- `tsconfig.json` - TypeScript configuration

## Development

### Available Scripts

```bash
# Development
pnpm dev          # Start development server
pnpm preview      # Preview production build

# Building
pnpm build        # Build for production
pnpm type-check   # TypeScript type checking
pnpm lint         # ESLint code linting

# Distribution
pnpm package      # Package without installer
pnpm dist         # Build + create installer
```

### Adding New Features

1. **Main Process** - Add system integration in `src/main/`
2. **IPC Communication** - Extend APIs in `src/preload/index.ts`
3. **UI Components** - Create React components in `src/renderer/src/components/`
4. **State Management** - Update Zustand store in `src/renderer/src/store/`
5. **Types** - Add TypeScript definitions in `src/types/`

### Debugging

- **Main Process** - Use `console.log()` or attach Node.js debugger
- **Renderer Process** - Use browser DevTools (F12 in development)
- **IPC Communication** - Monitor messages in both processes

## Troubleshooting

### Common Issues

**"Python 3.12 not found"**
- Install Python 3.12 from python.org
- Ensure `python3.12` or `python` is in your PATH

**"FFmpeg not available"**
- Install FFmpeg from ffmpeg.org
- Windows: Use winget or download binaries
- macOS: Use `brew install ffmpeg`
- Linux: Use `sudo apt install ffmpeg`

**Build fails with permission errors**
- Ensure you have write permissions to the project directory
- Try running as administrator (Windows) or with sudo (macOS/Linux)

**Application won't start**
- Check that all dependencies are installed with `pnpm install`
- Verify Node.js version is 18 or higher
- Clear node_modules and reinstall if needed

### Performance Optimization

- **GPU Acceleration** - Enable in hardware settings for faster processing
- **Memory Usage** - Adjust chunk duration for large files
- **Processing Priority** - Balance speed vs. quality in model settings

### Getting Help

1. Check this README for common solutions
2. Review the application logs in DevTools
3. Verify system requirements are met
4. Test with a smaller audio file first

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following TypeScript best practices
4. Test thoroughly on your target platform
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/) and [Vite](https://vitejs.dev/)
- UI powered by [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/)
- State management with [Zustand](https://github.com/pmndrs/zustand)
- Subtitle generation by CantoCap Python Engine