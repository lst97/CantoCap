# CantoSub

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

- Python 3.9 <= 3.12
- FFmpeg (for audio extraction)
- Google Gemini API key (optional, for AI-powered features)
- CUDA-compatible GPU (optional, for faster processing)

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

# For Gemini Flash AI features (optional)
pip install -r requirements-gemini.txt
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

# Use specific Whisper model
cantosub video.mkv --model openai/whisper-medium

# Prioritize speed over quality
cantosub video.mp4 --priority speed

# Prioritize quality over speed
cantosub video.mp4 --priority quality
```

### AI-Enhanced Usage

```bash
# Enable automatic speaker identification and AI refinement
cantosub video.mp4 --speakers --gemini-key YOUR_API_KEY

# Convert to formal written Cantonese style
cantosub video.mp4 --written --gemini-key YOUR_API_KEY

# Full AI-powered processing with all features
cantosub movie.mkv --speakers --written --music --gemini-key YOUR_API_KEY

# Use environment variable for API key
echo "GEMINI_API_KEY=your_key_here" > .env
cantosub video.mp4 --speakers --written

# Use custom terminology for mixed language content
cantosub video.mp4 --terminology-config examples/terminology_config.json

# Check hardware capabilities
cantosub hardware
cantosub hardware --priority speed
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

- **Services**: `FFmpegService`, `WhisperService`, `GeminiFlashService`
- **Repositories**: `FFmpegAudioRepository`, `WhisperTranscriptionRepository`, `FileSubtitleRepository`
- **AI Services**: `VideoPreprocessingService`, `MediaChunkingService`, `ConfigurationService`
- **Phase 2 Services**: `SpeakerDiarizationService`, `MusicDetectionService`, `CharsetConversionService`

### Presentation Layer

- **CLI**: Typer-based command-line interface with Rich formatting
- **DI Container**: Dependency injection for clean separation

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

CantoSub automatically detects and optimizes for your hardware:

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

CantoSub leverages Google's Gemini Flash model for advanced AI processing:

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

CantoSub supports custom terminology configuration to handle mixed English-Cantonese content, proper nouns, brand names, and domain-specific terms accurately.

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
cantosub video.mp4 --written --terminology-config examples/terminology_config.json

# Use custom terminology with colloquial style (preserves natural speech)
cantosub video.mp4 --terminology-config examples/terminology_config.json

# Combined with AI features
cantosub video.mp4 --speakers --terminology-config my_terms.json --gemini-key YOUR_KEY
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
# Ensure you're using the correct flags
cantosub video.mp4 --model openai/whisper-tiny  # Specific model
cantosub video.mp4 --priority speed              # Priority-based selection
```

**Gemini Features Not Working:**
```bash
# Check API key configuration
cantosub video.mp4 --speakers --gemini-key YOUR_KEY

# Verify environment setup
echo $GEMINI_API_KEY
cat .env
```

**Performance Issues:**
```bash
# Check hardware capabilities
cantosub hardware

# Use faster model for speed
cantosub video.mp4 --priority speed

# Reduce video quality for AI processing
cantosub video.mp4 --speakers --video-quality 360p
```

**Large File Processing:**
```bash
# Adjust chunk duration for very large files
cantosub large_video.mp4 --max-chunk-duration 10

# Monitor processing with verbose output
cantosub video.mp4 --verbose
```

**Terminology Configuration Issues:**
```bash
# Verify terminology config file format
cat examples/terminology_config.json | python -m json.tool

# Test with specific terminology file
cantosub video.mp4 --terminology-config my_terms.json --verbose
```

### Getting Help

- Use `cantosub --help` for command reference
- Use `cantosub hardware` to check system capabilities
- Enable `--verbose` for detailed processing information
- Check `.env` file configuration for API keys

## Acknowledgments

- OpenAI Whisper for excellent speech recognition
- Google Gemini Flash for advanced AI capabilities
- FFmpeg for audio processing capabilities
- The Python community for amazing libraries
