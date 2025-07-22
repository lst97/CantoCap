"""Domain layer for CantoCap - Core business logic and rules."""

# Value Objects
from .value_objects import Timestamp, FilePath, AudioFormat, LanguageCode

# Entities  
from .entities import (
    MediaFile,
    AudioStream,
    Transcription,
    TranscriptionChunk,
    Subtitle,
    SubtitleDocument
)

# Services
from .services import SubtitleFormattingService, DualLanguageSubtitleService

# Repository Interfaces
from .repositories import (
    IAudioRepository,
    ITranscriptionRepository,
    ISubtitleRepository
)

__all__ = [
    # Value Objects
    "Timestamp",
    "FilePath", 
    "AudioFormat",
    "LanguageCode",
    
    # Entities
    "MediaFile",
    "AudioStream",
    "Transcription",
    "TranscriptionChunk", 
    "Subtitle",
    "SubtitleDocument",
    
    # Services
    "SubtitleFormattingService",
    "DualLanguageSubtitleService",
    
    # Repository Interfaces
    "IAudioRepository",
    "ITranscriptionRepository",
    "ISubtitleRepository"
]