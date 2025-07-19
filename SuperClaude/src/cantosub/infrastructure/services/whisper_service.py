"""Whisper service for speech-to-text transcription."""

import torch
from transformers import pipeline, Pipeline
from typing import Optional, Dict, Any, List
import warnings

from ...domain.value_objects import FilePath
from ...domain.entities import Transcription


class WhisperService:
    """Service for Whisper speech-to-text operations."""
    
    def __init__(self, model_name: str = "openai/whisper-large-v3"):
        """
        Initialize Whisper service.
        
        Args:
            model_name: Hugging Face model name/path
        """
        self.model_name = model_name
        self.pipeline: Optional[Pipeline] = None
        self._device = self._get_optimal_device()
    
    def _get_optimal_device(self) -> str:
        """Determine optimal device for inference."""
        if torch.cuda.is_available():
            return "cuda"
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            return "mps"  # Apple Silicon
        else:
            return "cpu"
    
    def load_model(self, model_name: Optional[str] = None) -> bool:
        """
        Load Whisper model for transcription.
        
        Args:
            model_name: Optional model name to override default
            
        Returns:
            bool: True if model loaded successfully
        """
        try:
            model_to_load = model_name or self.model_name
            
            # Suppress some warnings for cleaner output
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                self.pipeline = pipeline(
                    "automatic-speech-recognition",
                    model=model_to_load,
                    device=self._device,
                    torch_dtype=torch.float16 if self._device != "cpu" else torch.float32,
                    return_timestamps=True
                )
            
            self.model_name = model_to_load
            return True
            
        except Exception as e:
            print(f"Failed to load Whisper model: {e}")
            self.pipeline = None
            return False
    
    def is_model_loaded(self) -> bool:
        """
        Check if model is loaded and ready.
        
        Returns:
            bool: True if model is ready
        """
        return self.pipeline is not None
    
    def transcribe_audio_file(
        self,
        audio_file_path: str,
        language: str = "zh",
        return_timestamps: bool = True
    ) -> Dict[str, Any]:
        """
        Transcribe audio file to text with timestamps.
        
        Args:
            audio_file_path: Path to audio file
            language: Language code (default: "zh" for Chinese)
            return_timestamps: Whether to return word-level timestamps
            
        Returns:
            dict: Transcription result with text and timestamps
            
        Raises:
            RuntimeError: If model not loaded
            FileNotFoundError: If audio file doesn't exist
        """
        if not self.is_model_loaded():
            raise RuntimeError("Whisper model not loaded. Call load_model() first.")
        
        # Validate file exists
        file_path = FilePath.from_string(audio_file_path)
        file_path.validate_exists()
        
        try:
            # Configure generation parameters
            generate_kwargs = {
                "language": language,
                "task": "transcribe"
            }
            
            # Run transcription
            result = self.pipeline(
                audio_file_path,
                return_timestamps=return_timestamps,
                generate_kwargs=generate_kwargs
            )
            
            # Process and format result
            return self._process_whisper_result(result, audio_file_path)
            
        except Exception as e:
            raise RuntimeError(f"Transcription failed: {e}")
    
    def _process_whisper_result(
        self, 
        result: Dict[str, Any], 
        audio_file_path: str
    ) -> Dict[str, Any]:
        """
        Process raw Whisper result into standardized format.
        
        Args:
            result: Raw result from Whisper pipeline
            audio_file_path: Original audio file path
            
        Returns:
            dict: Processed result with standardized format
        """
        processed = {
            "text": result.get("text", ""),
            "language": "zh",  # Default for our use case
            "chunks": [],
            "source_file": audio_file_path
        }
        
        # Process chunks with timestamps
        if "chunks" in result:
            for chunk in result["chunks"]:
                processed_chunk = {
                    "text": chunk.get("text", "").strip(),
                    "timestamp": chunk.get("timestamp", [0.0, 0.0])
                }
                
                # Only add non-empty chunks
                if processed_chunk["text"]:
                    processed["chunks"].append(processed_chunk)
        
        # If no chunks but we have text, create a single chunk
        elif processed["text"].strip():
            processed["chunks"] = [{
                "text": processed["text"].strip(),
                "timestamp": [0.0, 0.0]  # Will need duration from audio file
            }]
        
        return processed
    
    def create_transcription_entity(
        self, 
        whisper_result: Dict[str, Any]
    ) -> Transcription:
        """
        Create Transcription entity from Whisper result.
        
        Args:
            whisper_result: Processed Whisper result
            
        Returns:
            Transcription: Domain entity
        """
        return Transcription.from_whisper_result(whisper_result)
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about loaded model.
        
        Returns:
            dict: Model information
        """
        return {
            "model_name": self.model_name,
            "device": self._device,
            "is_loaded": self.is_model_loaded(),
            "torch_version": torch.__version__,
            "cuda_available": torch.cuda.is_available(),
            "mps_available": hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()
        }
    
    def estimate_processing_time(self, duration_seconds: float) -> float:
        """
        Estimate transcription processing time.
        
        Args:
            duration_seconds: Audio duration in seconds
            
        Returns:
            float: Estimated processing time in seconds
        """
        # Rough estimates based on typical performance
        if self._device == "cuda":
            # GPU: roughly 0.2-0.5x realtime
            return duration_seconds * 0.3
        elif self._device == "mps":
            # Apple Silicon: roughly 0.5-1x realtime  
            return duration_seconds * 0.7
        else:
            # CPU: roughly 2-5x realtime
            return duration_seconds * 3.0
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language codes.
        
        Returns:
            list: Supported language codes
        """
        # Whisper supports many languages - returning most common ones
        return [
            "zh",   # Chinese
            "en",   # English
            "es",   # Spanish
            "fr",   # French
            "de",   # German
            "ja",   # Japanese
            "ko",   # Korean
            "pt",   # Portuguese
            "ru",   # Russian
            "ar",   # Arabic
        ]
    
    def cleanup(self) -> None:
        """Clean up model resources."""
        if self.pipeline is not None:
            del self.pipeline
            self.pipeline = None
            
        # Clear CUDA cache if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()