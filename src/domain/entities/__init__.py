"""Domain entities for CantoCap."""

from .media_file import MediaFile
from .audio_stream import AudioStream
from .transcription import Transcription, TranscriptionChunk
from .subtitle import Subtitle, SubtitleDocument
from .speaker import SpeakerSegment, SpeakerDiarization
from .music import MusicSegment, MusicDetection, MusicType

__all__ = [
    "MediaFile",
    "AudioStream", 
    "Transcription",
    "TranscriptionChunk",
    "Subtitle",
    "SubtitleDocument",
    "SpeakerSegment",
    "SpeakerDiarization",
    "MusicSegment", 
    "MusicDetection",
    "MusicType"
]