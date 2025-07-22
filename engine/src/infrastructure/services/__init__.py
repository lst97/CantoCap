"""Infrastructure services for CantoCap."""

from .ffmpeg_service import FFmpegService
from .charset_conversion_service import CharsetConversionService
# LLM services removed - now using Gemini Flash service directly

# Import performance services conditionally
try:
    from .parallel_audio_service import ParallelAudioService
    _PARALLEL_AVAILABLE = True
except ImportError:
    ParallelAudioService = None
    _PARALLEL_AVAILABLE = False

# Import services with heavy dependencies conditionally
try:
    from .whisper_service import WhisperService
    _WHISPER_AVAILABLE = True
except ImportError:
    WhisperService = None
    _WHISPER_AVAILABLE = False

try:
    from .speaker_diarization_service import SpeakerDiarizationService
    _SPEAKER_AVAILABLE = True
except ImportError:
    SpeakerDiarizationService = None
    _SPEAKER_AVAILABLE = False

try:
    from .music_detection_service import MusicDetectionService
    _MUSIC_AVAILABLE = True
except ImportError:
    MusicDetectionService = None
    _MUSIC_AVAILABLE = False

# LLM services removed - now using Gemini Flash service directly
_LLM_AVAILABLE = False
LLMServiceFactory = ILLMService = UnifiedLLMService = None
OpenAILLMService = GeminiLLMService = EnhancedLLMService = None

__all__ = [
    "FFmpegService",
    "CharsetConversionService"
]

# Add performance services if available
if _PARALLEL_AVAILABLE:
    __all__.append("ParallelAudioService")

# Add heavy dependency services if available
if _WHISPER_AVAILABLE:
    __all__.append("WhisperService")
if _SPEAKER_AVAILABLE:
    __all__.append("SpeakerDiarizationService") 
if _MUSIC_AVAILABLE:
    __all__.append("MusicDetectionService")
# LLM services removed - use Gemini Flash service directly