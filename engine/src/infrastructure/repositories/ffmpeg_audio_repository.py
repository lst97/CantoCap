"""FFmpeg-based audio repository implementation."""

from typing import Optional

from ...domain.repositories import IAudioRepository
from ...domain.entities import MediaFile, AudioStream
from ...domain.value_objects import AudioFormat, FilePath
from ..services import FFmpegService


class FFmpegAudioRepository(IAudioRepository):
    """Audio repository implementation using FFmpeg."""
    
    def __init__(self, ffmpeg_service: FFmpegService):
        """
        Initialize with FFmpeg service.
        
        Args:
            ffmpeg_service: FFmpeg service instance
        """
        self.ffmpeg_service = ffmpeg_service
    
    def extract_audio_from_media(
        self,
        media_file: MediaFile,
        target_format: AudioFormat,
        output_path: Optional[str] = None
    ) -> AudioStream:
        """
        Extract audio from media file using FFmpeg.
        
        Args:
            media_file: Input media file
            target_format: Target audio format
            output_path: Optional custom output path
            
        Returns:
            AudioStream: Extracted audio stream
            
        Raises:
            RuntimeError: If extraction fails
        """
        # Ensure media file is validated
        if not media_file.is_validated():
            media_file.validate()
        
        # Determine output path
        if output_path is None:
            temp_audio_path = media_file.get_temp_audio_path()
        else:
            temp_audio_path = FilePath.from_string(output_path)
        
        try:
            # Extract audio using FFmpeg service
            success = self.ffmpeg_service.extract_audio(
                input_path=media_file.get_file_path().path,
                output_path=temp_audio_path.path,
                target_format=target_format
            )
            
            if not success:
                raise RuntimeError("Audio extraction failed")
            
            # Get audio duration
            duration = self.ffmpeg_service.get_audio_duration(temp_audio_path.path)
            
            # Create and return AudioStream
            audio_stream = AudioStream.create(
                file_path=temp_audio_path,
                format=target_format,
                duration_seconds=duration
            )
            
            # Validate the created audio stream
            audio_stream.validate()
            
            return audio_stream
            
        except Exception as e:
            # Clean up partial file if it exists
            if temp_audio_path.exists():
                try:
                    temp_audio_path.to_pathlib().unlink()
                except OSError:
                    pass
            
            raise RuntimeError(f"Failed to extract audio: {e}")
    
    def validate_audio_format(self, audio_stream: AudioStream) -> bool:
        """
        Validate audio stream format using FFmpeg.
        
        Args:
            audio_stream: Audio stream to validate
            
        Returns:
            bool: True if format is valid
        """
        try:
            # Use domain validation first
            audio_stream.validate()
            
            # Use FFmpeg service for detailed format validation
            return self.ffmpeg_service.validate_audio_file(
                file_path=audio_stream.get_file_path().path,
                expected_format=audio_stream.get_format()
            )
            
        except Exception:
            return False
    
    def get_audio_duration(self, audio_stream: AudioStream) -> float:
        """
        Get audio duration using FFmpeg.
        
        Args:
            audio_stream: Audio stream
            
        Returns:
            float: Duration in seconds
            
        Raises:
            RuntimeError: If duration cannot be determined
        """
        try:
            duration = self.ffmpeg_service.get_audio_duration(
                audio_stream.get_file_path().path
            )
            return duration
            
        except Exception as e:
            raise RuntimeError(f"Failed to get audio duration: {e}")
    
    def cleanup_temp_audio(self, audio_stream: AudioStream) -> bool:
        """
        Clean up temporary audio file.
        
        Args:
            audio_stream: Audio stream with temp file
            
        Returns:
            bool: True if cleanup successful
        """
        return audio_stream.cleanup()