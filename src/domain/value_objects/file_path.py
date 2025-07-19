"""File path value object with validation and utility methods."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Set


@dataclass(frozen=True)
class FilePath:
    """Immutable file path with validation and utility methods."""
    
    path: str
    
    # Supported media file extensions
    SUPPORTED_EXTENSIONS: Set[str] = frozenset({
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',  # Video
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'          # Audio
    })
    
    def __post_init__(self) -> None:
        """Validate file path constraints."""
        if not self.path.strip():
            raise ValueError("File path cannot be empty")
        
        # Normalize path separators
        normalized_path = os.path.normpath(self.path)
        object.__setattr__(self, 'path', normalized_path)
    
    @classmethod
    def from_string(cls, path_str: str) -> "FilePath":
        """Create FilePath from string."""
        return cls(path=path_str)
    
    @classmethod
    def from_pathlib(cls, path: Path) -> "FilePath":
        """Create FilePath from pathlib.Path."""
        return cls(path=str(path))
    
    def to_pathlib(self) -> Path:
        """Convert to pathlib.Path."""
        return Path(self.path)
    
    def exists(self) -> bool:
        """Check if file exists."""
        return self.to_pathlib().exists()
    
    def is_file(self) -> bool:
        """Check if path points to a file."""
        return self.to_pathlib().is_file()
    
    def is_dir(self) -> bool:
        """Check if path points to a directory."""
        return self.to_pathlib().is_dir()
    
    def get_extension(self) -> str:
        """Get file extension in lowercase."""
        return self.to_pathlib().suffix.lower()
    
    def get_name(self) -> str:
        """Get file name without directory."""
        return self.to_pathlib().name
    
    def get_stem(self) -> str:
        """Get file name without extension."""
        return self.to_pathlib().stem
    
    def get_parent(self) -> "FilePath":
        """Get parent directory as FilePath."""
        return FilePath(str(self.to_pathlib().parent))
    
    def is_supported_media_file(self) -> bool:
        """Check if file extension is supported for media processing."""
        return self.get_extension() in self.SUPPORTED_EXTENSIONS
    
    def get_output_srt_path(self) -> "FilePath":
        """Generate output SRT file path in same directory."""
        srt_path = self.to_pathlib().with_suffix('.srt')
        return FilePath(str(srt_path))
    
    def get_temp_audio_path(self) -> "FilePath":
        """Generate temporary audio file path for processing."""
        temp_name = f"{self.get_stem()}_temp.wav"
        temp_path = self.get_parent().to_pathlib() / temp_name
        return FilePath(str(temp_path))
    
    def validate_exists(self) -> None:
        """Validate that file exists, raise exception if not."""
        if not self.exists():
            raise FileNotFoundError(f"File not found: {self.path}")
    
    def validate_is_file(self) -> None:
        """Validate that path is a file, raise exception if not."""
        if not self.is_file():
            raise ValueError(f"Path is not a file: {self.path}")
    
    def validate_supported_format(self) -> None:
        """Validate that file format is supported."""
        if not self.is_supported_media_file():
            supported = ", ".join(sorted(self.SUPPORTED_EXTENSIONS))
            raise ValueError(
                f"Unsupported file format: {self.get_extension()}. "
                f"Supported formats: {supported}"
            )
    
    def get_size_bytes(self) -> int:
        """Get file size in bytes."""
        if not self.exists():
            raise FileNotFoundError(f"File not found: {self.path}")
        return self.to_pathlib().stat().st_size
    
    def get_size_mb(self) -> float:
        """Get file size in megabytes."""
        return self.get_size_bytes() / (1024 * 1024)