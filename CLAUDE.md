# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CantoSub is a CLI tool for generating accurate Cantonese subtitles from audio/video files using OpenAI Whisper. The project follows Clean Architecture and Domain-Driven Design principles with clear separation of concerns across layers.

## Development Commands

### Setup and Installation
```bash
# Install production dependencies
make install
# or
pip install -r requirements.txt

# Install development dependencies  
make install-dev
# or
pip install -e .[dev]

# Complete development setup
make dev-setup
```

### Hardware Analysis and Model Selection
```bash
# Check hardware capabilities and model recommendations
cantosub hardware

# Check with specific priority
cantosub hardware --priority speed
cantosub hardware --priority quality

# Check with expected audio duration for timing estimates
cantosub hardware --duration 30.0
```

### Testing
```bash
# Run all tests
make test
# or
pytest

# Run specific test types
make test-unit        # Unit tests only
make test-integration # Integration tests only 
make test-e2e         # End-to-end tests only

# Run with coverage
make test-cov
# or
pytest --cov=src/cantosub --cov-report=html --cov-report=term-missing
```

### Code Quality
```bash
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
# Clean build artifacts
make clean

# Build distribution packages
make build

# Install in development mode
make install-local
```

## Architecture Overview

The codebase follows Clean Architecture with four distinct layers:

### Domain Layer (`src/domain/`)
- **Value Objects**: `Timestamp`, `FilePath`, `AudioFormat`, `Charset` - immutable data containers
- **Entities**: `MediaFile`, `AudioStream`, `Transcription`, `Subtitle`, `Speaker`, `Music` - business objects with identity
- **Repository Interfaces**: Abstract contracts for external services (`IAudioRepository`, `ITranscriptionRepository`, `ISubtitleRepository`)
- **Domain Services**: `SubtitleFormattingService` - core business logic

### Application Layer (`src/application/`)
- **Use Cases**: `GenerateSubtitlesUseCase` - orchestrates domain operations
- **Commands**: `GenerateSubtitlesCommand` - encapsulates user requests
- **Application Services**: `MediaFileValidator` - application-specific validation

### Infrastructure Layer (`src/infrastructure/`)
- **External Services**: `FFmpegService`, `WhisperService`, `LLMService` - integrations with external tools
- **Repository Implementations**: `FFmpegAudioRepository`, `WhisperTranscriptionRepository`, `FileSubtitleRepository`
- **Phase 2 Services**: `SpeakerDiarizationService`, `MusicDetectionService`, `CharsetConversionService` (partially implemented)

### Presentation Layer (`src/presentation/`)
- **CLI Interface**: Typer-based command-line interface with Rich formatting
- **Dependency Injection**: `Container` class manages service dependencies and lifecycle

## Key Implementation Details

### CLI Entry Point
- Main command: `cantosub <input_file> [options]`
- Hardware analysis: `cantosub hardware [options]`
- Entry point: `src/presentation/cli/main.py`
- DI container: `src/presentation/di/container.py`

### Use Case Pattern
All business operations flow through use cases:
1. Command validation
2. Media file loading and validation  
3. Audio extraction via FFmpeg
4. Transcription via Whisper
5. Subtitle formatting and optimization
6. File output with backup handling

### Intelligent Model Selection
- **Automatic model selection** based on hardware capabilities (VRAM, CPU, performance)
- **Priority-based optimization**: `--priority speed|quality|balanced`
- **Hardware detection**: CUDA, Apple MPS, Intel XPU support with fallback to CPU
- **Manual override**: `--model <model_name>` to force specific model
- **Hardware analysis**: `cantosub hardware` command for capabilities and recommendations
- See `GPU_SETUP_GUIDE.md` for GPU setup instructions

### Phase Development
- **Phase 1** (Current): Basic Cantonese transcription to SRT
- **Phase 2** (Planned): Speaker diarization, music detection, LLM-based style conversion, character set conversion
- Phase 2 features are partially implemented but not fully functional

## Testing Strategy

### Test Organization
- **Unit Tests** (`tests/unit/`): Fast, isolated tests for individual components
- **Integration Tests** (`tests/integration/`): Test external service integrations (FFmpeg, Whisper)
- **E2E Tests** (`tests/e2e/`): Full workflow tests with real media files

### Test Markers
```bash
pytest -m unit          # Fast unit tests
pytest -m integration   # Tests requiring external dependencies
pytest -m e2e           # Full workflow tests
pytest -m slow          # Long-running tests
```

### Coverage Requirements
- Minimum 80% coverage enforced
- Coverage reports generated in `htmlcov/`

## Dependencies and External Services

### Core Dependencies
- **Typer**: CLI framework with Rich formatting
- **Transformers**: Hugging Face library for Whisper models
- **PyTorch**: ML framework (with CUDA support for GPU)
- **FFmpeg-python**: Audio/video processing wrapper
- **SRT**: Subtitle file format handling

### External Services
- **FFmpeg**: Audio extraction from video files (must be installed separately)
- **Whisper Models**: Downloaded automatically via Transformers
- **GPU Support**: CUDA-enabled PyTorch for faster transcription

### Development Tools
- **pytest**: Testing framework with coverage
- **black**: Code formatting (88 character line length)
- **isort**: Import sorting (black profile)
- **mypy**: Static type checking (strict mode)
- **flake8**: Linting and style checking

## Configuration and Paths

### Project Structure
```
src/cantosub/
├── domain/          # Business logic and entities
├── application/     # Use cases and commands  
├── infrastructure/  # External service implementations
└── presentation/    # CLI interface and DI
```

### Important Configuration
- Package name: `cantosub` (entry point in pyproject.toml)
- Python version: 3.9+ required
- Line length: 88 characters (black/isort)
- Type checking: Strict mode enabled in mypy

### GPU Setup
If working with GPU acceleration:
1. Install CUDA-enabled PyTorch: `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`
2. Verify GPU detection: Run test files in project root
3. Refer to `GPU_SETUP_GUIDE.md` for detailed setup

## Common Patterns

### Domain-Driven Design
- Use value objects for data validation (FilePath, Timestamp)
- Repository pattern for data access abstraction
- Dependency injection for loose coupling
- Command pattern for user requests

### Error Handling
- Comprehensive validation at domain boundaries
- Graceful degradation (GPU → CPU fallback)
- User-friendly error messages via Rich console
- Cleanup of temporary files in finally blocks

### Performance Considerations
- Lazy loading of ML models
- Temporary file cleanup
- GPU memory management
- Chunked processing for large files