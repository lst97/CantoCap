"""Infrastructure services for CantoSub."""

from .ffmpeg_service import FFmpegService
from .charset_conversion_service import CharsetConversionService

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

try:
    from .llm_service import LLMServiceFactory, ILLMService, OpenAILLMService, GeminiLLMService
    _LLM_AVAILABLE = True
except ImportError:
    LLMServiceFactory = ILLMService = OpenAILLMService = GeminiLLMService = None
    _LLM_AVAILABLE = False

__all__ = [
    "FFmpegService",
    "CharsetConversionService"
]

# Add heavy dependency services if available
if _WHISPER_AVAILABLE:
    __all__.append("WhisperService")
if _SPEAKER_AVAILABLE:
    __all__.append("SpeakerDiarizationService") 
if _MUSIC_AVAILABLE:
    __all__.append("MusicDetectionService")
if _LLM_AVAILABLE:
    __all__.extend(["LLMServiceFactory", "ILLMService", "OpenAILLMService", "GeminiLLMService"])