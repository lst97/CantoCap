"""Media file entity representing input audio/video files."""

from dataclasses import dataclass
from typing import Optional
import mimetypes

from ..value_objects import FilePath


@dataclass
class MediaFile:
    """Domain entity representing an input media file with validation."""
    
    file_path: FilePath
    _validated: bool = False
    _mime_type: Optional[str] = None
    _size_bytes: Optional[int] = None
    
    def __post_init__(self) -> None:
        """Initialize media file with basic validation."""
        if not isinstance(self.file_path, FilePath):
            raise TypeError("file_path must be a FilePath instance")
    
    @classmethod
    def from_path(cls, path: str) -> "MediaFile":
        """Create MediaFile from path string."""
        file_path = FilePath.from_string(path)
        return cls(file_path=file_path)
    
    def validate(self) -> None:
        """Perform comprehensive validation of the media file."""
        if self._validated:
            return
        
        # Check file existence
        self.file_path.validate_exists()
        
        # Check it's actually a file
        self.file_path.validate_is_file()
        
        # Check supported format
        self.file_path.validate_supported_format()
        
        # Validate file size (not empty, not too large)
        self._size_bytes = self.file_path.get_size_bytes()
        if self._size_bytes == 0:
            raise ValueError(f"File is empty: {self.file_path.path}")
        
        # 10GB limit for safety
        max_size = 10 * 1024 * 1024 * 1024  
        if self._size_bytes > max_size:
            raise ValueError(
                f"File too large: {self._size_bytes / (1024**3):.1f}GB. "
                f"Maximum size: 10GB"
            )
        
        # Detect MIME type
        self._mime_type, _ = mimetypes.guess_type(self.file_path.path)
        
        self._validated = True
    
    def is_validated(self) -> bool:
        """Check if file has been validated."""
        return self._validated
    
    def get_file_path(self) -> FilePath:
        """Get the file path."""
        return self.file_path
    
    def get_name(self) -> str:
        """Get file name."""
        return self.file_path.get_name()
    
    def get_extension(self) -> str:
        """Get file extension."""
        return self.file_path.get_extension()
    
    def get_size_bytes(self) -> int:
        """Get file size in bytes (validates if needed)."""
        if self._size_bytes is None:
            self.validate()
        return self._size_bytes
    
    def get_size_mb(self) -> float:
        """Get file size in megabytes."""
        return self.get_size_bytes() / (1024 * 1024)
    
    def get_mime_type(self) -> Optional[str]:
        """Get MIME type (validates if needed)."""
        if self._mime_type is None:
            self.validate()
        return self._mime_type
    
    def is_video(self) -> bool:
        """Check if file is a video format."""
        video_extensions = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'}
        return self.get_extension() in video_extensions
    
    def is_audio(self) -> bool:
        """Check if file is an audio format."""
        audio_extensions = {'.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'}
        return self.get_extension() in audio_extensions
    
    def get_output_srt_path(self) -> FilePath:
        """Get the expected output SRT file path."""
        return self.file_path.get_output_srt_path()
    
    def get_temp_audio_path(self) -> FilePath:
        """Get temporary audio file path for processing."""
        return self.file_path.get_temp_audio_path()
    
    def __str__(self) -> str:
        """String representation."""
        size_str = f"{self.get_size_mb():.1f}MB" if self._size_bytes else "unknown size"
        type_str = "video" if self.is_video() else "audio"
        return f"MediaFile({self.get_name()}, {type_str}, {size_str})"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return f"MediaFile(file_path={self.file_path!r}, validated={self._validated})"