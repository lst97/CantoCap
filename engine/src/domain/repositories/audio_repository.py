"""Audio repository interface for audio extraction and processing."""

from abc import ABC, abstractmethod
from typing import Optional

from ..entities import MediaFile, AudioStream
from ..value_objects import AudioFormat


class IAudioRepository(ABC):
    """Interface for audio extraction and processing operations."""
    
    @abstractmethod
    def extract_audio_from_media(
        self,
        media_file: MediaFile,
        target_format: AudioFormat,
        output_path: Optional[str] = None
    ) -> AudioStream:
        """
        Extract audio from media file and convert to target format.
        
        Args:
            media_file: The input media file
            target_format: Desired audio format specification
            output_path: Optional custom output path
            
        Returns:
            AudioStream: The extracted and processed audio
            
        Raises:
            AudioExtractionError: If extraction fails
            FileNotFoundError: If input file doesn't exist
            PermissionError: If cannot write to output location
        """
        pass
    
    @abstractmethod
    def validate_audio_format(self, audio_stream: AudioStream) -> bool:
        """
        Validate that audio stream matches expected format.
        
        Args:
            audio_stream: The audio stream to validate
            
        Returns:
            bool: True if format is valid
            
        Raises:
            ValidationError: If validation fails
        """
        pass
    
    @abstractmethod
    def get_audio_duration(self, audio_stream: AudioStream) -> float:
        """
        Get duration of audio stream in seconds.
        
        Args:
            audio_stream: The audio stream
            
        Returns:
            float: Duration in seconds
            
        Raises:
            AudioProcessingError: If cannot determine duration
        """
        pass
    
    @abstractmethod
    def cleanup_temp_audio(self, audio_stream: AudioStream) -> bool:
        """
        Clean up temporary audio files.
        
        Args:
            audio_stream: The audio stream with temp file
            
        Returns:
            bool: True if cleanup successful
        """
        pass