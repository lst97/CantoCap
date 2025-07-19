"""Whisper-based transcription repository implementation."""

from typing import Optional, Dict, Any

from ...domain.repositories import ITranscriptionRepository
from ...domain.entities import AudioStream, Transcription
from ..services import WhisperService


class WhisperTranscriptionRepository(ITranscriptionRepository):
    """Transcription repository implementation using Whisper."""
    
    def __init__(self, whisper_service: WhisperService):
        """
        Initialize with Whisper service.
        
        Args:
            whisper_service: Whisper service instance
        """
        self.whisper_service = whisper_service
    
    def load_model(self, model_name: str = "openai/whisper-large-v3") -> bool:
        """
        Load Whisper model.
        
        Args:
            model_name: Model name/path to load
            
        Returns:
            bool: True if model loaded successfully
        """
        return self.whisper_service.load_model(model_name)
    
    def transcribe_audio(
        self,
        audio_stream: AudioStream,
        language: str = "zh",
        return_timestamps: bool = True
    ) -> Transcription:
        """
        Transcribe audio stream using Whisper.
        
        Args:
            audio_stream: Audio to transcribe
            language: Target language code
            return_timestamps: Whether to include timestamps
            
        Returns:
            Transcription: Transcription result
            
        Raises:
            RuntimeError: If transcription fails
        """
        # Ensure audio stream is validated
        if not audio_stream.is_validated():
            audio_stream.validate()
        
        # Check Whisper compatibility
        if not audio_stream.is_whisper_compatible():
            raise ValueError(
                f"Audio format not compatible with Whisper: {audio_stream.get_format()}"
            )
        
        try:
            # Transcribe using Whisper service
            whisper_result = self.whisper_service.transcribe_audio_file(
                audio_file_path=audio_stream.get_file_path().path,
                language=language,
                return_timestamps=return_timestamps
            )
            
            # Add duration to result if available
            if audio_stream.get_duration_seconds() is not None:
                whisper_result["duration"] = audio_stream.get_duration_seconds()
            
            # Create and return Transcription entity
            transcription = self.whisper_service.create_transcription_entity(whisper_result)
            
            # Validate transcription has content
            if not transcription.chunks:
                raise ValueError("Transcription produced no results")
            
            return transcription
            
        except Exception as e:
            raise RuntimeError(f"Audio transcription failed: {e}")
    
    def is_model_loaded(self) -> bool:
        """
        Check if model is loaded.
        
        Returns:
            bool: True if model is ready
        """
        return self.whisper_service.is_model_loaded()
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information.
        
        Returns:
            dict: Model information
        """
        return self.whisper_service.get_model_info()
    
    def estimate_transcription_time(self, audio_stream: AudioStream) -> Optional[float]:
        """
        Estimate transcription processing time.
        
        Args:
            audio_stream: Audio to estimate for
            
        Returns:
            float: Estimated time in seconds, None if unknown
        """
        duration = audio_stream.get_duration_seconds()
        if duration is None:
            return None
        
        return self.whisper_service.estimate_processing_time(duration)
    
    def get_supported_languages(self) -> list[str]:
        """
        Get supported language codes.
        
        Returns:
            list: Supported language codes
        """
        return self.whisper_service.get_supported_languages()