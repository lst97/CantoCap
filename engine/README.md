# CantoCap

An advanced CLI tool for generating accurate Cantonese subtitles from audio/video files using OpenAI Whisper with AI-powered enhancements via Google Gemini Flash.

## Features

### Core Transcription
- **Intelligent Model Selection**: Automatic Whisper model selection based on hardware capabilities
- **High-Quality Recognition**: Uses OpenAI Whisper V3.1 with priority-based model selection (speed/quality/balanced)
- **Multiple Formats**: Supports various audio/video formats (MP4, AVI, MKV, WAV, MP3, etc.)
- **Optimized Subtitles**: Automatically formats subtitles with proper timing and text breaking

### AI-Powered Enhancements
- **🤖 Gemini Flash Integration**: AI-powered transcription refinement and speaker identification
- **🎭 Automatic Speaker Detection**: No manual speaker counting - AI identifies speaker count automatically
- **📝 Language Style Control**: Choose between written formal Cantonese or natural spoken style
- **✨ Transcription Refinement**: AI improves accuracy, grammar, and contextual understanding
- **📹 Video Compression**: Automatic video optimization for AI analysis
- **📊 Smart Chunking**: Handles large files by intelligently splitting for processing

### Advanced Features
- **🔊 Speaker Diarization**: Automatic speaker segmentation and labeling
- **🎵 Music Detection**: Identifies and labels music segments
- **🈶 Character Set Conversion**: Convert between Traditional and Simplified Chinese
- **🌐 Environment Configuration**: .env file support for API keys
- **⚡ Hardware Optimization**: GPU acceleration with MPS, CUDA, and Intel XPU support
- **🎨 Rich CLI**: Beautiful terminal interface with real-time progress tracking and spinners

## Installation

### Prerequisites

- Python 3.9 - 3.12
- FFmpeg (for audio extraction)
- Google Gemini API key (optional, for AI-powered features)
- CUDA-compatible GPU (optional, for faster processing)

### Method 1: Package Installation (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd canton-cap/engine

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install CantoCap Engine package with all dependencies
pip install -e .

# Optional: Install with GPU support for CUDA acceleration
pip install -e .[gpu]

# Optional: Install development dependencies
pip install -e .[dev]
```

### Method 2: Legacy Installation

```bash
# Clone the repository
git clone <repository-url>
cd canton-cap/engine

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies using requirements.txt
pip install -r requirements.txt

# Install in development mode
pip install -e .
```

### Method 3: Development Setup with Makefile

```bash
# Clone the repository
git clone <repository-url>
cd canton-cap/engine

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Complete development setup (installs package + dev dependencies)
make dev-setup
```

### Installation Notes

- **Package Name**: The project is packaged as `python -m src.presentation.cli.main`, but due to import issues, use `python -m src.presentation.cli.main` for execution
- **FFmpeg Requirement**: FFmpeg is required and must be specified with `--ffmpeg-path` option for subtitle generation
- **Optional Dependencies**: 
  - `[gpu]` - Installs CUDA-enabled PyTorch for GPU acceleration
  - `[dev]` - Installs development tools (pytest, black, mypy, etc.)
  - `[test]` - Installs only testing dependencies
- **Python Version**: Requires Python 3.9-3.12 (recommended: Python 3.11+)
- **Virtual Environment**: Highly recommended to avoid dependency conflicts

### Install FFmpeg

**Windows:**
Download from <https://ffmpeg.org/download.html> and add to PATH

**macOS:**

```bash
brew install ffmpeg
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install ffmpeg
```

## Usage

### Basic Usage with Module Execution

```bash
# Generate subtitles for a video file (requires FFmpeg path)
python -m src.presentation.cli.main video.mp4 --ffmpeg-path ffmpeg

# Specify custom output path
python -m src.presentation.cli.main video.mp4 --output subtitles.srt --ffmpeg-path /usr/local/bin/ffmpeg

# Use different language (if needed)
python -m src.presentation.cli.main audio.wav --language zh --ffmpeg-path ffmpeg

# Use specific Whisper model
python -m src.presentation.cli.main video.mkv --model openai/whisper-medium --ffmpeg-path ffmpeg

# Prioritize speed over quality
python -m src.presentation.cli.main video.mp4 --priority speed --ffmpeg-path ffmpeg

# Prioritize quality over speed
python -m src.presentation.cli.main video.mp4 --priority quality --ffmpeg-path ffmpeg
```

### Alternative: Package Installation Method

If you have the package properly installed, you can use:

```bash
# Generate subtitles for a video file
python -m src.presentation.cli.main video.mp4
```

### AI-Enhanced Usage

```bash
# Enable automatic speaker identification and AI refinement
python -m src.presentation.cli.main video.mp4 --speakers --gemini-key YOUR_API_KEY --ffmpeg-path ffmpeg

# Convert to formal written Cantonese style
python -m src.presentation.cli.main video.mp4 --written --gemini-key YOUR_API_KEY --ffmpeg-path ffmpeg

# Full AI-powered processing with all features
python -m src.presentation.cli.main movie.mkv --speakers --written --music --gemini-key YOUR_API_KEY --ffmpeg-path ffmpeg

# Use environment variable for API key
echo "GEMINI_API_KEY=your_key_here" > .env
python -m src.presentation.cli.main video.mp4 --speakers --written --ffmpeg-path ffmpeg

# Use custom terminology for mixed language content
python -m src.presentation.cli.main video.mp4 --terminology-config examples/terminology_config.json --ffmpeg-path ffmpeg

# Check hardware capabilities
python -m src.presentation.cli.main hardware
python -m src.presentation.cli.main hardware --priority speed
```

### Command Options

#### Core Options
- `input_file`: Path to input audio/video file (required)
- `--output, -o`: Custom output SRT file path (optional)
- `--language, -l`: Language code for transcription (default: "zh")
- `--model, -m`: Specific Whisper model to use (overrides auto-selection)
- `--priority, -p`: Model selection priority: "speed", "quality", or "balanced" (default: "balanced")
- `--verbose`: Show detailed technical information during processing
- `--version, -v`: Show version information
- `--help`: Show help message

#### AI Enhancement Options
- `--speakers`: Enable automatic speaker identification and diarization
- `--written`: Convert colloquial speech to formal written Cantonese style
- `--music`: Enable music detection and add [music] labels
- `--gemini-key`: Google Gemini API key (overrides .env file and environment variables)
- `--no-gemini-refinement`: Disable Gemini Flash transcription refinement

#### Advanced Options
- `--charset`: Character set for output ("traditional" or "simplified", default: "traditional")
- `--max-chunk-duration`: Maximum chunk duration in minutes for large files (default: 15)
- `--video-quality`: Video compression quality for AI analysis ("360p", "480p", "720p", default: "360p")
- `--terminology-config`: Path to custom terminology JSON configuration file for handling mixed language content
- `--ipc-mode`: Enable IPC mode for machine-readable JSON output

### Supported Formats

**Video:** MP4, AVI, MKV, MOV, WMV, FLV, WebM
**Audio:** MP3, WAV, FLAC, AAC, OGG, M4A

## Development

### Project Structure

```bash
canton-cap/engine/
├── src/                   # Source code
│   ├── __main__.py       # Module entry point
│   ├── application/      # Use cases and commands
│   │   ├── commands/     # Business commands
│   │   ├── services/     # Application services
│   │   └── use_cases/    # Business logic orchestration
│   ├── cantocap_engine/  # Legacy entry point
│   ├── domain/           # Business logic and entities
│   │   ├── entities/     # Business entities
│   │   ├── repositories/ # Repository interfaces
│   │   ├── services/     # Domain services
│   │   └── value_objects/ # Value objects and data types
│   ├── infrastructure/   # External service implementations
│   │   ├── config/       # Configuration files
│   │   ├── repositories/ # Repository implementations
│   │   ├── services/     # Infrastructure services
│   │   ├── utils/        # Utility functions
│   │   └── validation/   # Validation services
│   └── presentation/     # CLI interface and DI container
│       ├── cli/          # Command-line interface
│       └── di/           # Dependency injection
├── tests/                # Comprehensive test suite
│   ├── conftest.py       # Test configuration and fixtures
│   ├── unit/             # Unit tests (fast, isolated)
│   ├── integration/      # Integration tests (external deps)
│   └── e2e/              # End-to-end tests (full workflow)
├── examples/             # Example configuration files
├── pyproject.toml        # Project configuration and dependencies
├── requirements.txt      # Production dependencies (legacy)
├── Makefile             # Development automation
├── CLAUDE.md            # AI assistant instructions
├── TESTING.md           # Testing documentation
└── GPU_SETUP_GUIDE.md   # GPU setup instructions
```

### Running Tests

The project includes comprehensive testing with unit, integration, and end-to-end tests.

```bash
# Install development dependencies
make install-dev
# or
pip install -e .[dev]

# Run all tests
make test
# or
pytest

# Run specific test types using markers
pytest -m unit              # Unit tests only (fast, isolated)
pytest -m integration       # Integration tests (external dependencies)
pytest -m e2e               # End-to-end tests (full workflow)
pytest -m slow              # Long-running tests

# Run tests by directory
pytest tests/unit/          # Unit tests
pytest tests/integration/   # Integration tests  
pytest tests/e2e/          # End-to-end tests

# Run with coverage
make test-cov
# or
pytest --cov=src --cov-report=html --cov-report=term-missing

# Run specific test categories
make test-unit              # Unit tests only
make test-integration       # Integration tests only
make test-e2e              # End-to-end tests only

# Skip tests requiring external dependencies
pytest -m "not slow and not requires_ffmpeg and not requires_api"
```

### Test Markers

The test suite uses pytest markers for categorization:
- `unit`: Fast, isolated unit tests
- `integration`: Tests requiring external dependencies (FFmpeg, APIs)
- `e2e`: End-to-end workflow tests
- `slow`: Long-running tests
- `requires_ffmpeg`: Tests that need FFmpeg installed
- `requires_api`: Tests that need API keys
- `requires_gpu`: Tests that need GPU acceleration

### Code Quality

The project includes automated code quality tools with configuration in `pyproject.toml`.

```bash
# Run all quality checks
make quality

# Format code (Black with 88 character line length)
make format
# or
black src/ tests/

# Sort imports (isort with Black profile)
isort src/ tests/

# Type checking (mypy in strict mode)
make typecheck
# or
mypy src/

# Linting (flake8)
make lint
# or
flake8 src/ tests/

# Individual quality tools
black --check src/ tests/    # Check formatting without changes
isort --check-only src/ tests/  # Check import sorting
```

### Development Workflow

```bash
# Complete development setup
make dev-setup

# Clean build artifacts
make clean

# Build distribution packages
make build

# Install in development mode
make install-local
# or
pip install -e .
```

## Architecture

CantoCap follows Clean Architecture and Domain-Driven Design principles with clear separation of concerns:

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

### Presentation Layer (`src/presentation/`)

**CLI Interface**: Rich command-line experience
- `main.py` - Main application entry point with Typer
- `commands.py` - Core subtitle generation command
- `hardware_command.py` - Hardware analysis and recommendations
- `progress_display.py` - Rich progress indicators and spinners
- `ipc_handler.py` - Inter-process communication support

**Dependency Injection**: Clean service lifecycle management
- `Container` - Centralized dependency injection and service management

## Configuration

### Environment Variables

Create a `.env` file in your project directory:

```bash
# Google Gemini API key for AI features
GEMINI_API_KEY=your_api_key_here
GOOGLE_GEMINI_API_KEY=your_api_key_here  # Alternative name
GOOGLE_API_KEY=your_api_key_here         # Alternative name
```

### API Key Priority

1. `--gemini-key` command line argument (highest priority)
2. `.env` file variables
3. Environment variables
4. Graceful degradation without AI features (lowest priority)

### Hardware Optimization

CantoCap automatically detects and optimizes for your hardware:

- **NVIDIA GPU**: CUDA acceleration for faster processing
- **Apple Silicon**: Metal Performance Shaders (MPS) acceleration
- **Intel**: Intel XPU acceleration (if available)
- **CPU Fallback**: Works on any system with automatic model selection

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`pytest`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## AI Features Deep Dive

### Gemini Flash Integration

CantoCap leverages Google's Gemini Flash model for advanced AI processing:

- **Automatic Speaker Detection**: Analyzes video content to determine speaker count without manual input
- **Contextual Understanding**: AI understands scene context, emotions, and speaker relationships
- **Language Style Adaptation**: Converts between colloquial speech and formal written Cantonese
- **Transcription Refinement**: Improves accuracy by understanding context and correcting errors

### Language Style Differences

**Colloquial (Spoken) Style** (`default`):
- Preserves natural speech patterns: 點解、乜嘢、做咩
- Keeps spoken particles: 啦、喎、咖、㗎、吖
- Maintains conversational tone and informal grammar

**Written Style** (`--written`):
- Formal vocabulary: 為什麼、什麼、為何
- Removes spoken particles and replaces with punctuation
- Uses standard written Chinese sentence structures
- Professional tone suitable for formal subtitles

### Processing Pipeline

1. **Video Analysis** 🎬 → Gemini Flash analyzes video for speaker identification
2. **Audio Extraction** 🎵 → FFmpeg extracts high-quality audio
3. **Whisper Transcription** 🗣️ → Initial speech-to-text conversion
4. **Speaker Diarization** 👥 → Segments audio by speaker
5. **AI Refinement** ✨ → Gemini Flash improves accuracy and applies style
6. **Subtitle Optimization** 📝 → Final formatting and timing optimization

## Custom Terminology Configuration

CantoCap supports custom terminology configuration to handle mixed English-Cantonese content, proper nouns, brand names, and domain-specific terms accurately.

### Configuration File

Create a JSON configuration file (example: `examples/terminology_config.json`) with your custom terms:

```json
{
  "version": "1.0",
  "language": "cantonese",
  "terminology": {
    "proper_nouns": [
      {
        "id": "hong_kong",
        "spoken_forms": ["Hong Kong", "香港", "HK"],
        "written_form": "香港",
        "spoken_preference": "香港",
        "priority": "high"
      }
    ],
    "brand_names": [
      {
        "id": "apple_company",
        "spoken_forms": ["Apple", "蘋果公司", "apple"],
        "written_form": "蘋果公司",
        "spoken_preference": "Apple",
        "priority": "high"
      }
    ]
  },
  "style_rules": {
    "written": {
      "prefer_chinese": true,
      "convert_english": true
    },
    "colloquial": {
      "preserve_spoken": true,
      "natural_mixing": true
    }
  }
}
```

### Usage Examples

```bash
# Use custom terminology with written style (converts English to Chinese)
python -m src.presentation.cli.main video.mp4 --written --terminology-config examples/terminology_config.json --ffmpeg-path ffmpeg

# Use custom terminology with colloquial style (preserves natural speech)
python -m src.presentation.cli.main video.mp4 --terminology-config examples/terminology_config.json --ffmpeg-path ffmpeg

# Combined with AI features
python -m src.presentation.cli.main video.mp4 --speakers --terminology-config my_terms.json --gemini-key YOUR_KEY --ffmpeg-path ffmpeg
```

### Terminology Categories

- **proper_nouns**: Geographic locations, organization names
- **brand_names**: Company names, product brands  
- **technical_terms**: Industry jargon, technical vocabulary
- **slang_terms**: Colloquial expressions, trendy phrases
- **industry_terms**: Domain-specific terminology
- **locations**: Local place names, landmarks
- **person_names**: Common names in your content

### Style Handling

- **Written Style**: Converts English terms to Chinese equivalents for formal subtitles
- **Colloquial Style**: Preserves natural code-switching and spoken preferences

## Troubleshooting

### Common Issues

**Model Selection Not Working:**
```bash
# Ensure you're using the correct flags and FFmpeg path
python -m src.presentation.cli.main video.mp4 --model openai/whisper-small --ffmpeg-path ffmpeg  # Specific model
python -m src.presentation.cli.main video.mp4 --priority speed --ffmpeg-path ffmpeg              # Priority-based selection
```

**Gemini Features Not Working:**
```bash
# Check API key configuration
python -m src.presentation.cli.main video.mp4 --speakers --gemini-key YOUR_KEY --ffmpeg-path ffmpeg

# Verify environment setup
echo $GEMINI_API_KEY
cat .env
```

**Performance Issues:**
```bash
# Check hardware capabilities
python -m src.presentation.cli.main hardware

# Use faster model for speed
python -m src.presentation.cli.main video.mp4 --priority speed --ffmpeg-path ffmpeg

# Reduce video quality for AI processing
python -m src.presentation.cli.main video.mp4 --speakers --video-quality 360p --ffmpeg-path ffmpeg
```

**Large File Processing:**
```bash
# Adjust chunk duration for very large files
python -m src.presentation.cli.main large_video.mp4 --max-chunk-duration 10 --ffmpeg-path ffmpeg

# Monitor processing with verbose output
python -m src.presentation.cli.main video.mp4 --verbose --ffmpeg-path ffmpeg
```

**Terminology Configuration Issues:**
```bash
# Verify terminology config file format
cat examples/terminology_config.json | python -m json.tool

# Test with specific terminology file
python -m src.presentation.cli.main video.mp4 --terminology-config my_terms.json --verbose --ffmpeg-path ffmpeg
```

**FFmpeg Path Issues:**
```bash
# Try different FFmpeg paths
python -m src.presentation.cli.main video.mp4 --ffmpeg-path /usr/local/bin/ffmpeg
python -m src.presentation.cli.main video.mp4 --ffmpeg-path /opt/homebrew/bin/ffmpeg
python -m src.presentation.cli.main video.mp4 --ffmpeg-path ffmpeg  # If in PATH
```

### Getting Help

- Use `python -m src.presentation.cli.main --help` for command reference
- Use `python -m src.presentation.cli.main hardware` to check system capabilities
- Enable `--verbose` for detailed processing information
- Check `.env` file configuration for API keys
- Review `TESTING.md` for testing procedures
- Check `GPU_SETUP_GUIDE.md` for GPU acceleration setup

## Acknowledgments

- OpenAI Whisper for excellent speech recognition
- Google Gemini Flash for advanced AI capabilities
- FFmpeg for audio processing capabilities
- The Python community for amazing libraries
