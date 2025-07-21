"""Domain repository interfaces for CantoCap."""

from .audio_repository import IAudioRepository
from .transcription_repository import ITranscriptionRepository
from .subtitle_repository import ISubtitleRepository

__all__ = [
    "IAudioRepository",
    "ITranscriptionRepository", 
    "ISubtitleRepository"
]