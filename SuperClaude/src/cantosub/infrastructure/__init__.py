"""Infrastructure layer for CantoSub - External service implementations."""

from .repositories import (
    FFmpegAudioRepository,
    WhisperTranscriptionRepository,
    FileSubtitleRepository
)
from .services import (
    FFmpegService,
    CharsetConversionService
)

# Import Phase 2 services conditionally
try:
    from .services import (
        WhisperService,
        SpeakerDiarizationService,
        LLMServiceFactory,
        ILLMService,
        OpenAILLMService,
        GeminiLLMService,
        MusicDetectionService
    )
    _PHASE2_AVAILABLE = True
except ImportError:
    WhisperService = None
    SpeakerDiarizationService = None
    LLMServiceFactory = None
    ILLMService = None
    OpenAILLMService = None
    GeminiLLMService = None
    MusicDetectionService = None
    _PHASE2_AVAILABLE = False

__all__ = [
    "FFmpegAudioRepository",
    "WhisperTranscriptionRepository", 
    "FileSubtitleRepository",
    "FFmpegService",
    "CharsetConversionService"
]

# Add Phase 2 services if available
if _PHASE2_AVAILABLE:
    __all__.extend([
        "WhisperService",
        "SpeakerDiarizationService",
        "LLMServiceFactory",
        "ILLMService", 
        "OpenAILLMService",
        "GeminiLLMService",
        "MusicDetectionService"
    ])