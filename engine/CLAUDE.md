# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CantoCap is an advanced CLI tool for generating accurate Cantonese subtitles from audio/video files using OpenAI Whisper with AI-powered enhancements via Google Gemini Flash. The project follows Clean Architecture and Domain-Driven Design principles with comprehensive features including speaker diarization, music detection, automatic language style conversion, and intelligent hardware optimization.

## Development Commands

### Setup and Installation

**IMPORTANT: Virtual Environment Required**
```bash
# Create and activate virtual environment (REQUIRED)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install production dependencies
make install
# or
pip install -r requirements.txt

# Install development dependencies (from pyproject.toml)
make install-dev
# or
pip install -e .[dev]

# Install with GPU support
pip install -e .[gpu]

# Complete development setup
make dev-setup

# Install in development mode (editable)
make install-local
# or
pip install -e .
```

### Hardware Analysis and Model Selection
```bash
# ALWAYS activate virtual environment first
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Check hardware capabilities and model recommendations
python -m src.presentation.cli.main hardware

# Check with specific priority
python -m src.presentation.cli.main hardware --priority speed
python -m src.presentation.cli.main hardware --priority quality

# Check with expected audio duration for timing estimates
python -m src.presentation.cli.main hardware --duration 30.0
```

### Basic Usage (Note: Virtual Environment + FFmpeg path required)
```bash
# ALWAYS activate virtual environment first
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Generate subtitles for a video file
python -m src.presentation.cli.main video.mp4 --ffmpeg-path ffmpeg

# With AI-powered features
python -m src.presentation.cli.main video.mp4 --speakers --written --music --gemini-key YOUR_API_KEY --ffmpeg-path ffmpeg

# Custom terminology configuration
python -m src.presentation.cli.main video.mp4 --terminology-config examples/terminology_config.json --ffmpeg-path ffmpeg
```

### Testing
```bash
# ALWAYS activate virtual environment first
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Run all tests
make test
# or
pytest

# Run specific test types
make test-unit        # Unit tests only
make test-integration # Integration tests only 
make test-e2e         # End-to-end tests only

# Run tests by markers
pytest -m unit              # Fast, isolated unit tests
pytest -m integration       # Tests requiring external dependencies
pytest -m e2e               # End-to-end workflow tests
pytest -m slow              # Long-running tests
pytest -m requires_ffmpeg   # Tests requiring FFmpeg
pytest -m requires_api      # Tests requiring API keys
pytest -m requires_gpu      # Tests requiring GPU acceleration

# Run with coverage
make test-cov
# or
pytest --cov=src --cov-report=html --cov-report=term-missing

# Skip tests requiring external dependencies
pytest -m "not slow and not requires_ffmpeg and not requires_api"
```

### Code Quality
```bash
# ALWAYS activate virtual environment first
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Format code
make format
# or
black src/ tests/ && isort src/ tests/

# Run linting
make lint
# or  
flake8 src/ tests/

# Type checking
make typecheck
# or
mypy src/

# Run all quality checks
make quality
```

### Build and Packaging
```bash
# ALWAYS activate virtual environment first
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Clean build artifacts
make clean

# Build distribution packages
make build

# Install in development mode
make install-local
```

## Architecture Overview

The codebase follows Clean Architecture with four distinct layers and comprehensive service implementations:

### Domain Layer (`src/domain/`)

**Value Objects**: Immutable data containers with validation
- `Timestamp`, `FilePath`, `AudioFormat`, `Charset`, `LanguageCode`, `AlignmentLanguageCode`, `TerminologyTerm`

**Entities**: Business objects with identity and behavior
- `MediaFile`, `AudioStream`, `Transcription`, `Subtitle`, `Speaker`, `Music`

**Domain Services**: Core business logic
- `SubtitleFormattingService`, `DualLanguageSubtitleService`

**Repository Interfaces**: Abstract contracts for external services
- `IAudioRepository`, `ITranscriptionRepository`, `ISubtitleRepository`

### Application Layer (`src/application/`)

**Commands**: Encapsulated user requests
- `GenerateSubtitlesCommand`

**Use Cases**: Business workflow orchestration
- `GenerateSubtitlesUseCase`

**Application Services**: Application-specific logic
- `MediaFileValidator`, `SubtitleValidationService`, `TerminologyConfigService`

### Infrastructure Layer (`src/infrastructure/`)

**External Service Integrations**:
- `FFmpegService`, `WhisperService`, `WhisperXService`
- `LLMService`, `PromptService`
- `HardwareDetector`, `ConfigurationService`

**AI-Powered Services**:
- `SpeakerCountService`, `TranscriptionRefinementService`, `SubtitleTranslationService`
- `SpeakerDiarizationService`, `MusicDetectionService`
- `VideoPreprocessingService`, `MediaChunkingService`, `VideoCompressionService`

**Repository Implementations**:
- `FFmpegAudioRepository`, `WhisperTranscriptionRepository`, `FileSubtitleRepository`

**Utilities and Validation**:
- `CharsetConversionService`, `WarningService`, `ParallelAudioService`
- `ArgumentValidator`, `LLMTextCleaningUtil`
- Configuration files in `src/infrastructure/config/`

### Presentation Layer (`src/presentation/`)

**CLI Interface**: Rich command-line experience
- `main.py` - Main application entry point with Typer
- `commands.py` - Core subtitle generation command
- `hardware_command.py` - Hardware analysis and recommendations
- `progress_display.py` - Rich progress indicators and spinners
- `ipc_handler.py` - Inter-process communication support

**Dependency Injection**: Clean service lifecycle management
- `Container` - Centralized dependency injection and service management

## Key Implementation Details

### CLI Entry Point
- **Module execution**: `python -m src.presentation.cli.main <input_file> [options]` (recommended due to import issues)
- **Package command**: `cantocap-engine <input_file> [options]` (requires proper installation)
- **Hardware analysis**: `python -m src.presentation.cli.main hardware [options]`
- **Entry point**: `src/presentation/cli/main.py`
- **DI container**: `src/presentation/di/container.py`
- **FFmpeg requirement**: All file processing requires `--ffmpeg-path` argument

### Use Case Pattern
All business operations flow through use cases with comprehensive processing pipeline:
1. **Command validation** and argument parsing
2. **Media file loading and validation** with format support detection
3. **Audio extraction** via FFmpeg with quality optimization
4. **Transcription** via Whisper or WhisperX with model selection
5. **AI-powered enhancements** (optional):
   - Speaker identification and diarization
   - Transcription refinement via Gemini Flash
   - Language style conversion (colloquial ↔ formal)
   - Music detection and labeling
6. **Subtitle formatting** and timing optimization
7. **Character set conversion** (Traditional ↔ Simplified Chinese)
8. **Translation** to additional languages (optional)
9. **File output** with backup handling and cleanup

### Intelligent Model Selection
- **Automatic model selection** based on hardware capabilities (VRAM, CPU, performance)
- **Priority-based optimization**: `--priority speed|quality|balanced` 
- **Hardware detection**: CUDA, Apple MPS, Intel XPU support with fallback to CPU
- **Manual override**: `--model <model_name>` to force specific model (includes WhisperX support)
- **Hardware analysis**: `python -m src.presentation.cli.main hardware` command for capabilities and recommendations
- **GPU acceleration**: Supports CUDA, Apple MPS, and Intel XPU with automatic fallback
- See `GPU_SETUP_GUIDE.md` for GPU setup instructions

### AI-Powered Features
- **Gemini Flash Integration**: Advanced AI processing for transcription refinement and speaker analysis
- **Automatic Speaker Detection**: AI determines speaker count without manual configuration
- **Language Style Control**: Convert between colloquial speech and formal written Cantonese
- **Custom Terminology**: JSON-based configuration for proper nouns, technical terms, and mixed-language content
- **Music Detection**: Automatic identification and labeling of music segments
- **Video Preprocessing**: Intelligent video compression for AI analysis optimization

### Development Phases
- **Phase 1** (Complete): Basic Cantonese transcription to SRT
- **Phase 2** (Complete): Speaker diarization, music detection, LLM-based style conversion, character set conversion
- **Phase 3** (Complete): Polishing, localization, and comprehensive error handling
- **Phase 4** (Complete): Distribution, packaging, and future-proofing
- **Phase 5** (Current): Comprehensive unit, integration, and end-to-end testing with CI/CD pipeline

## Testing Strategy

### Test Organization
The project includes comprehensive testing with advanced fixtures and configuration:

- **Unit Tests** (`tests/unit/`): Fast, isolated tests for individual components
  - Domain layer tests: Value objects, entities, services
  - Application layer tests: Commands, use cases, validators
  - Infrastructure tests: Services, repositories, utilities
  - Presentation tests: CLI commands, IPC handlers
- **Integration Tests** (`tests/integration/`): Test external service integrations
  - FFmpeg integration, Whisper/WhisperX integration
  - Complete processing pipelines, CLI integration
- **E2E Tests** (`tests/e2e/`): Full workflow tests with real media files
  - Comprehensive workflow testing with various scenarios

### Test Configuration (`tests/conftest.py`)
Advanced pytest configuration with fixtures for:
- **Sample data**: Video files, subtitle data, transcription results
- **Mock services**: Whisper service, hardware detector, containers
- **Environment management**: API keys, test environment isolation
- **Performance testing**: Timing utilities and benchmarking
- **Automatic cleanup**: Temporary file management

### Test Markers and Execution
```bash
# Markers for test categorization
pytest -m unit              # Fast, isolated unit tests
pytest -m integration       # Tests requiring external dependencies  
pytest -m e2e               # End-to-end workflow tests
pytest -m slow              # Long-running tests
pytest -m requires_ffmpeg   # Tests requiring FFmpeg installation
pytest -m requires_api      # Tests requiring API keys
pytest -m requires_gpu      # Tests requiring GPU acceleration

# Skip specific test types
pytest -m "not slow and not requires_ffmpeg and not requires_api"
```

### Coverage Requirements
- **Minimum 80% coverage** enforced with strict reporting
- **Coverage reports** generated in `htmlcov/` directory
- **Exclusions**: Test files, debug code, protocol definitions
- **Coverage configuration** in `pyproject.toml` with detailed reporting

## Dependencies and External Services

### Core Dependencies (Production)
- **Typer[all]**: CLI framework with Rich formatting and comprehensive features
- **Transformers**: Hugging Face library for Whisper models (≥4.53.2)
- **PyTorch**: ML framework with CUDA support (≥2.7.1)
- **TorchAudio**: Audio processing for ML models (≥2.7.1)
- **FFmpeg-python**: Audio/video processing wrapper (≥0.2.0)
- **SRT**: Subtitle file format handling (≥3.5.3)
- **OpenAI**: API client for AI services (≥1.97.0)
- **Google GenerativeAI**: Gemini Flash integration (≥0.8.5)
- **python-dotenv**: Environment variable management (≥1.1.1)
- **Rich**: Terminal formatting and progress display (≥14.0.0)

### AI and Audio Processing
- **PyAnnote.Audio**: Speaker diarization and analysis (≥3.3.2)
- **WhisperX**: Enhanced Whisper with speaker alignment (≥3.4.2)
- **Librosa**: Audio analysis and feature extraction (≥0.11.0)
- **Accelerate**: ML model acceleration (≥1.9.0)
- **OpenCC-Python-Reimplemented**: Chinese character conversion (≥0.1.7)

### External Services
- **FFmpeg**: Audio/video processing (must be installed separately with `--ffmpeg-path`)
- **Google Gemini Flash**: AI-powered transcription refinement and speaker analysis
- **Whisper Models**: Downloaded automatically via Transformers and WhisperX
- **GPU Support**: CUDA, Apple MPS, Intel XPU with automatic detection and fallback

### Development Tools
- **pytest**: Testing framework with comprehensive fixtures and coverage (≥7.0)
- **pytest-cov**: Coverage reporting and analysis (≥4.0)
- **pytest-mock**: Mock utilities for testing (≥3.0)
- **black**: Code formatting with 88 character line length (≥23.0)
- **isort**: Import sorting with black profile (≥5.0)
- **mypy**: Static type checking in strict mode (≥1.0)
- **flake8**: Linting and style checking (≥6.0)

### Optional Dependencies
- **[gpu]**: CUDA-enabled PyTorch packages for GPU acceleration
- **[dev]**: Complete development toolchain (testing, formatting, linting)
- **[test]**: Testing dependencies only

## Configuration and Paths

### Project Structure
```
src/
├── __main__.py                  # Module entry point
├── application/                 # Use cases and commands
│   ├── commands/               # Business commands
│   ├── services/               # Application services
│   └── use_cases/              # Business logic orchestration
├── cantocap_engine/            # Legacy entry point
├── domain/                     # Business logic and entities
│   ├── entities/               # Business entities
│   ├── repositories/           # Repository interfaces
│   ├── services/               # Domain services
│   └── value_objects/          # Value objects and data types
├── infrastructure/             # External service implementations
│   ├── config/                 # Configuration files (transcription_prompts.json)
│   ├── repositories/           # Repository implementations
│   ├── services/               # Infrastructure services
│   ├── utils/                  # Utility functions
│   └── validation/             # Validation services
└── presentation/               # CLI interface and DI container
    ├── cli/                    # Command-line interface
    └── di/                     # Dependency injection
```

### Important Configuration
- **Virtual Environment**: **REQUIRED** - Always run `source venv/bin/activate` before any operations
- **Package name**: `cantocap-engine` (defined in pyproject.toml)
- **CLI execution**: Use `python -m src.presentation.cli.main` due to import issues (after venv activation)
- **FFmpeg requirement**: Must specify `--ffmpeg-path` for all file processing operations
- **Python version**: 3.9-3.12 required (configured in pyproject.toml)
- **Line length**: 88 characters (black/isort configuration in pyproject.toml)
- **Type checking**: Strict mode enabled in mypy with detailed overrides
- **Configuration**: Comprehensive pyproject.toml with tool configurations
- **Package management**: setuptools build system with modern packaging

### GPU Setup
If working with GPU acceleration:
1. Install CUDA-enabled PyTorch: `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`
2. Verify GPU detection: Run test files in project root
3. Refer to `GPU_SETUP_GUIDE.md` for detailed setup

## Common Patterns

### Domain-Driven Design
- **Value objects** for data validation and immutability (FilePath, Timestamp, LanguageCode, etc.)
- **Repository pattern** for data access abstraction with clear interfaces
- **Dependency injection** for loose coupling and testability via Container class
- **Command pattern** for encapsulated user requests with validation
- **Service pattern** for both domain logic and infrastructure concerns

### Error Handling
- **Comprehensive validation** at domain boundaries with custom exceptions
- **Graceful degradation** patterns (GPU → CPU fallback, API failures)
- **User-friendly error messages** via Rich console with IPC mode support
- **Global error handling** with context preservation and structured output
- **Automatic cleanup** of temporary files and resources in finally blocks
- **IPC-aware error reporting** with JSON structured output when enabled

### Performance Considerations
- **Lazy loading** of ML models and heavy resources
- **Intelligent model selection** based on hardware capabilities
- **GPU memory management** with automatic detection and optimization
- **Chunked processing** for large media files with configurable duration
- **Parallel processing** support for multi-core systems
- **Caching strategies** for model loading and configuration
- **Resource cleanup** and memory management throughout processing pipeline

### AI Integration Patterns
- **Modular AI services** with fallback mechanisms
- **Configuration-driven** AI behavior with JSON configs
- **Progressive enhancement** - core functionality works without AI features
- **API key management** with multiple sources and graceful degradation
- **Prompt engineering** with structured templates and context management

## IPC Mode and Error Handling

### IPC (Inter-Process Communication) Mode
- **Enable with `--ipc-mode`** flag for machine-readable JSON output
- **Structured JSON output** for programmatic integration with other tools
- **Error handling adaptation** with consistent JSON error messages
- **Global IPC state management** affecting behavior across all services
- **Progress reporting** via structured JSON instead of Rich progress bars

### Global Error Handling
- **Comprehensive error handling** with user-friendly Rich console formatting
- **Graceful degradation patterns** (GPU → CPU fallback, API service failures)
- **Automatic resource cleanup** of temporary files and GPU memory in error scenarios
- **IPC-aware error reporting** with structured JSON output when enabled
- **Contextual error messages** with actionable guidance for users
- **Stack trace management** with appropriate detail levels for different modes

## Additional Documentation

### Related Files
- **`TESTING.md`**: Comprehensive testing documentation and procedures
- **`GPU_SETUP_GUIDE.md`**: Detailed GPU acceleration setup instructions
- **`ARGUMENT_VALIDATION.md`**: Command-line argument validation documentation
- **`examples/terminology_config.json`**: Sample custom terminology configuration

### Key Features Summary
- **Multi-format support**: MP4, AVI, MKV, WAV, MP3, FLAC, and more
- **AI-powered enhancements**: Speaker diarization, transcription refinement, style conversion
- **Hardware optimization**: Automatic model selection based on CUDA, MPS, XPU capabilities
- **Comprehensive testing**: Unit, integration, and E2E tests with detailed fixtures
- **Professional CLI**: Rich formatting, progress indicators, and comprehensive error handling
- **Modular architecture**: Clean separation of concerns with dependency injection
- **Extensible design**: Easy addition of new AI services and processing features