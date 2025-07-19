"""Audio stream entity for processed audio data."""

from dataclasses import dataclass
from typing import Optional

from ..value_objects import FilePath, AudioFormat


@dataclass
class AudioStream:
    """Domain entity representing extracted and processed audio data."""
    
    file_path: FilePath
    format: AudioFormat
    duration_seconds: Optional[float] = None
    _validated: bool = False
    
    def __post_init__(self) -> None:
        """Initialize audio stream with basic validation."""
        if not isinstance(self.file_path, FilePath):
            raise TypeError("file_path must be a FilePath instance")
        
        if not isinstance(self.format, AudioFormat):
            raise TypeError("format must be an AudioFormat instance")
    
    @classmethod
    def create(
        cls,
        file_path: FilePath,
        format: AudioFormat,
        duration_seconds: Optional[float] = None
    ) -> "AudioStream":
        """Create an AudioStream instance."""
        return cls(
            file_path=file_path,
            format=format,
            duration_seconds=duration_seconds
        )
    
    @classmethod
    def create_for_whisper(
        cls,
        file_path: FilePath,
        duration_seconds: Optional[float] = None
    ) -> "AudioStream":
        """Create AudioStream with Whisper-compatible format."""
        return cls(
            file_path=file_path,
            format=AudioFormat.WHISPER_FORMAT,
            duration_seconds=duration_seconds
        )
    
    def validate(self) -> None:
        """Validate the audio stream file."""
        if self._validated:
            return
        
        # Check file exists
        self.file_path.validate_exists()
        self.file_path.validate_is_file()
        
        # Check file has content
        size_bytes = self.file_path.get_size_bytes()
        if size_bytes == 0:
            raise ValueError(f"Audio file is empty: {self.file_path.path}")
        
        # Validate audio file extension matches format
        expected_ext = self.format.get_file_extension()
        actual_ext = self.file_path.get_extension()
        if actual_ext != expected_ext:
            raise ValueError(
                f"File extension {actual_ext} doesn't match format {expected_ext}"
            )
        
        self._validated = True
    
    def is_validated(self) -> bool:
        """Check if audio stream has been validated."""
        return self._validated
    
    def get_file_path(self) -> FilePath:
        """Get the audio file path."""
        return self.file_path
    
    def get_format(self) -> AudioFormat:
        """Get the audio format."""
        return self.format
    
    def get_duration_seconds(self) -> Optional[float]:
        """Get duration in seconds if available."""
        return self.duration_seconds
    
    def set_duration_seconds(self, duration: float) -> None:
        """Set the duration in seconds."""
        if duration <= 0:
            raise ValueError("Duration must be positive")
        self.duration_seconds = duration
    
    def get_duration_minutes(self) -> Optional[float]:
        """Get duration in minutes if available."""
        if self.duration_seconds is None:
            return None
        return self.duration_seconds / 60.0
    
    def is_whisper_compatible(self) -> bool:
        """Check if format is compatible with Whisper."""
        return self.format.is_compatible_with_whisper()
    
    def get_estimated_processing_time(self) -> Optional[float]:
        """Estimate processing time based on duration (rough heuristic)."""
        if self.duration_seconds is None:
            return None
        
        # Whisper typically processes ~2-5x realtime depending on model and hardware
        # Use conservative estimate of 3x realtime
        return self.duration_seconds * 3.0
    
    def get_file_size_mb(self) -> float:
        """Get file size in megabytes."""
        return self.file_path.get_size_mb()
    
    def cleanup(self) -> bool:
        """Remove the temporary audio file if it exists."""
        try:
            if self.file_path.exists():
                self.file_path.to_pathlib().unlink()
                return True
            return False
        except OSError:
            return False
    
    def __str__(self) -> str:
        """String representation."""
        duration_str = f"{self.duration_seconds:.1f}s" if self.duration_seconds else "unknown duration"
        size_str = f"{self.get_file_size_mb():.1f}MB"
        return f"AudioStream({self.file_path.get_name()}, {self.format}, {duration_str}, {size_str})"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return (
            f"AudioStream(file_path={self.file_path!r}, "
            f"format={self.format!r}, "
            f"duration_seconds={self.duration_seconds}, "
            f"validated={self._validated})"
        )