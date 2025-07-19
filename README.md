# CantoSub

A CLI tool for generating accurate Cantonese subtitles from audio/video files using OpenAI Whisper.

## Features

- **Automatic Transcription**: Uses OpenAI Whisper V3 for high-quality Cantonese speech recognition
- **Multiple Formats**: Supports various audio/video formats (MP4, AVI, MKV, WAV, MP3, etc.)
- **Optimized Subtitles**: Automatically formats subtitles with proper timing and text breaking
- **Clean Architecture**: Built with Domain-Driven Design principles for maintainability
- **Rich CLI**: Beautiful terminal interface with progress tracking

## Installation

### Prerequisites

- Python 3.9+
- FFmpeg (for audio extraction)

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd cantosub

# Create virtual environment
python -m venv .venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

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

### Basic Usage

```bash
# Generate subtitles for a video file
cantosub video.mp4

# Specify custom output path
cantosub video.mp4 --output subtitles.srt

# Use different language (if needed)
cantosub audio.wav --language zh

# Use different Whisper model
cantosub video.mkv --model openai/whisper-medium
```

### Command Options

- `input_file`: Path to input audio/video file (required)
- `--output, -o`: Custom output SRT file path (optional)
- `--language, -l`: Language code for transcription (default: "zh")
- `--model, -m`: Whisper model to use (default: "openai/whisper-large-v3")
- `--version, -v`: Show version information
- `--help`: Show help message

### Supported Formats

**Video:** MP4, AVI, MKV, MOV, WMV, FLV, WebM
**Audio:** MP3, WAV, FLAC, AAC, OGG, M4A

## Development

### Project Structure

```bash
cantosub/
├── src/cantosub/           # Source code
│   ├── domain/            # Business logic and entities
│   ├── application/       # Use cases and commands
│   ├── infrastructure/    # External service implementations
│   └── presentation/      # CLI interface and DI container
├── tests/                 # Test suite
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── requirements.txt       # Production dependencies
├── requirements-dev.txt   # Development dependencies
└── pyproject.toml        # Project configuration
```

### Running Tests

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run all tests
pytest

# Run specific test types
pytest tests/unit/          # Unit tests only
pytest tests/integration/   # Integration tests only
pytest tests/e2e/          # End-to-end tests only

# Run with coverage
pytest --cov=src/cantosub --cov-report=html
```

### Code Quality

```bash
# Format code
black src/ tests/

# Sort imports
isort src/ tests/

# Type checking
mypy src/

# Linting
flake8 src/ tests/
```

## Architecture

CantoSub follows Clean Architecture and Domain-Driven Design principles:

### Domain Layer

- **Value Objects**: `Timestamp`, `FilePath`, `AudioFormat`
- **Entities**: `MediaFile`, `AudioStream`, `Transcription`, `Subtitle`, `SubtitleDocument`
- **Services**: `SubtitleFormattingService`
- **Repository Interfaces**: Define contracts for external services

### Application Layer

- **Commands**: `GenerateSubtitlesCommand`
- **Use Cases**: `GenerateSubtitlesUseCase`
- **Services**: `MediaFileValidator`

### Infrastructure Layer

- **Services**: `FFmpegService`, `WhisperService`
- **Repositories**: `FFmpegAudioRepository`, `WhisperTranscriptionRepository`, `FileSubtitleRepository`

### Presentation Layer

- **CLI**: Typer-based command-line interface with Rich formatting
- **DI Container**: Dependency injection for clean separation

## Phase 1 Limitations

This is Phase 1 of the CantoSub project. Current limitations:

- **Cantonese Only**: Optimized for Cantonese speech recognition
- **Basic Output**: Standard SRT format only
- **No Advanced Features**: No speaker diarization, music detection, or stylistic conversion (planned for Phase 2-4)

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

## Acknowledgments

- OpenAI Whisper for excellent speech recognition
- FFmpeg for audio processing capabilities
- The Python community for amazing libraries
