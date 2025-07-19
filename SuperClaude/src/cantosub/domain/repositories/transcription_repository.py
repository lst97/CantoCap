"""Transcription repository interface for speech-to-text operations."""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

from ..entities import AudioStream, Transcription


class ITranscriptionRepository(ABC):
    """Interface for speech-to-text transcription operations."""
    
    @abstractmethod
    def load_model(self, model_name: str = "openai/whisper-large-v3") -> bool:
        """
        Load the speech-to-text model.
        
        Args:
            model_name: Name/path of the model to load
            
        Returns:
            bool: True if model loaded successfully
            
        Raises:
            ModelLoadError: If model cannot be loaded
            ResourceError: If insufficient system resources
        """
        pass
    
    @abstractmethod
    def transcribe_audio(
        self,
        audio_stream: AudioStream,
        language: str = "zh",
        return_timestamps: bool = True
    ) -> Transcription:
        """
        Transcribe audio stream to text with timestamps.
        
        Args:
            audio_stream: The audio to transcribe
            language: Target language code (default: "zh" for Chinese)
            return_timestamps: Whether to include word-level timestamps
            
        Returns:
            Transcription: The transcription result with timing
            
        Raises:
            TranscriptionError: If transcription fails
            ModelNotLoadedError: If model not loaded
            UnsupportedFormatError: If audio format not supported
        """
        pass
    
    @abstractmethod
    def is_model_loaded(self) -> bool:
        """
        Check if transcription model is loaded and ready.
        
        Returns:
            bool: True if model is ready for transcription
        """
        pass
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded model.
        
        Returns:
            dict: Model information including name, size, language support
        """
        pass
    
    @abstractmethod
    def estimate_transcription_time(self, audio_stream: AudioStream) -> Optional[float]:
        """
        Estimate transcription processing time.
        
        Args:
            audio_stream: The audio to estimate for
            
        Returns:
            float: Estimated processing time in seconds, None if unknown
        """
        pass
    
    @abstractmethod
    def get_supported_languages(self) -> list[str]:
        """
        Get list of supported language codes.
        
        Returns:
            list: Supported language codes
        """
        pass