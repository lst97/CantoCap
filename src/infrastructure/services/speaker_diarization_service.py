"""Speaker diarization service using pyannote.audio."""

from typing import List, Dict, Any, Optional
import warnings
import os

from ...domain.entities import SpeakerDiarization, SpeakerSegment
from ...domain.value_objects import FilePath


class SpeakerDiarizationService:
    """Service for speaker diarization using pyannote.audio."""
    
    def __init__(self, model_name: str = "pyannote/speaker-diarization-3.1"):
        """
        Initialize speaker diarization service.
        
        Args:
            model_name: Hugging Face model name for diarization
        """
        self.model_name = model_name
        self.pipeline = None
        self._device = self._get_optimal_device()
    
    def _get_optimal_device(self) -> 'torch.device':
        """Determine optimal device for inference."""
        try:
            import torch
            if torch.cuda.is_available():
                return torch.device("cuda")
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return torch.device("mps")  # Apple Silicon
            else:
                return torch.device("cpu")
        except ImportError:
            import torch
            return torch.device("cpu")
    
    def load_model(self, hf_token: Optional[str] = None) -> bool:
        """
        Load speaker diarization model.
        
        Args:
            hf_token: Hugging Face token for model access (optional, will try to load from env)
            
        Returns:
            bool: True if model loaded successfully
        """
        try:
            # Import pyannote.audio
            from pyannote.audio import Pipeline
            
            # Get HuggingFace token from environment if not provided
            if hf_token is None:
                hf_token = self._get_hf_token_from_env()
            
            # Suppress some warnings for cleaner output
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Load the pipeline with authentication token
                # Try both parameter names for compatibility
                try:
                    self.pipeline = Pipeline.from_pretrained(
                        self.model_name,
                        token=hf_token
                    )
                except TypeError:
                    # Fallback to older parameter name
                    self.pipeline = Pipeline.from_pretrained(
                        self.model_name,
                        use_auth_token=hf_token
                    )
                
                # Move to appropriate device
                if self._device.type != "cpu":
                    self.pipeline.to(self._device)
            
            return True
            
        except Exception as e:
            print(f"Failed to load speaker diarization model: {e}")
            if "authentication" in str(e).lower() or "gated" in str(e).lower():
                print("Hint: Make sure HUGGINGFACE_AUTH_TOKEN is set in your .env file")
                print("Visit https://hf.co/pyannote/speaker-diarization-3.1 to accept user conditions")
            self.pipeline = None
            return False
    
    def _get_hf_token_from_env(self) -> Optional[str]:
        """Get HuggingFace token from environment variables."""
        import os
        
        # Try to load from .env file first
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            # dotenv not available, continue with os.environ
            pass
        
        # Check various possible environment variable names
        token_names = [
            'HUGGINGFACE_AUTH_TOKEN',
            'HUGGINGFACE_TOKEN', 
            'HF_TOKEN',
            'HF_AUTH_TOKEN'
        ]
        
        for token_name in token_names:
            token = os.environ.get(token_name)
            if token:
                return token
        
        return None
    
    def is_model_loaded(self) -> bool:
        """
        Check if model is loaded and ready.
        
        Returns:
            bool: True if model is ready
        """
        return self.pipeline is not None
    
    def diarize_audio_file(
        self,
        audio_file_path: str,
        num_speakers: Optional[int] = None,
        min_speakers: int = 1,
        max_speakers: int = 10
    ) -> Dict[str, Any]:
        """
        Perform speaker diarization on audio file.
        
        Args:
            audio_file_path: Path to audio file
            num_speakers: Fixed number of speakers (optional)
            min_speakers: Minimum number of speakers
            max_speakers: Maximum number of speakers
            
        Returns:
            dict: Diarization result with segments and metadata
            
        Raises:
            RuntimeError: If model not loaded or diarization fails
        """
        if not self.is_model_loaded():
            raise RuntimeError("Speaker diarization model not loaded. Call load_model() first.")
        
        # Validate file exists
        file_path = FilePath.from_string(audio_file_path)
        file_path.validate_exists()
        
        try:
            # Configure diarization parameters
            if num_speakers is not None:
                # Fixed number of speakers
                diarization = self.pipeline(
                    audio_file_path,
                    num_speakers=num_speakers
                )
            else:
                # Auto-detect number of speakers
                diarization = self.pipeline(
                    audio_file_path,
                    min_speakers=min_speakers,
                    max_speakers=max_speakers
                )
            
            # Process results
            return self._process_diarization_result(diarization, audio_file_path)
            
        except Exception as e:
            raise RuntimeError(f"Speaker diarization failed: {e}")
    
    def _process_diarization_result(
        self, 
        diarization_result, 
        audio_file_path: str
    ) -> Dict[str, Any]:
        """
        Process raw diarization result into standardized format.
        
        Args:
            diarization_result: Raw result from pyannote.audio
            audio_file_path: Original audio file path
            
        Returns:
            dict: Processed result with standardized format
        """
        segments = []
        speakers = set()
        
        # Process each segment
        for segment, _, speaker in diarization_result.itertracks(yield_label=True):
            # Create standardized segment
            segment_data = {
                "speaker_id": str(speaker),
                "start_time": segment.start,
                "end_time": segment.end,
                "confidence": getattr(segment, 'confidence', None)
            }
            segments.append(segment_data)
            speakers.add(segment_data["speaker_id"])
        
        # Calculate total duration
        total_duration = max(seg["end_time"] for seg in segments) if segments else 0.0
        
        return {
            "segments": segments,
            "num_speakers": len(speakers),
            "total_duration": total_duration,
            "source_file": audio_file_path,
            "speakers": sorted(list(speakers))
        }
    
    def create_diarization_entity(
        self, 
        diarization_result: Dict[str, Any]
    ) -> SpeakerDiarization:
        """
        Create SpeakerDiarization entity from diarization result.
        
        Args:
            diarization_result: Processed diarization result
            
        Returns:
            SpeakerDiarization: Domain entity
        """
        segments = []
        for seg_data in diarization_result["segments"]:
            segment = SpeakerSegment.create(
                speaker_id=seg_data["speaker_id"],
                start_seconds=seg_data["start_time"],
                end_seconds=seg_data["end_time"],
                confidence=seg_data.get("confidence")
            )
            segments.append(segment)
        
        return SpeakerDiarization.create(
            segments=segments,
            total_duration=diarization_result.get("total_duration")
        )
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about loaded model.
        
        Returns:
            dict: Model information
        """
        return {
            "model_name": self.model_name,
            "device": str(self._device),
            "is_loaded": self.is_model_loaded()
        }
    
    def estimate_processing_time(self, duration_seconds: float) -> float:
        """
        Estimate diarization processing time.
        
        Args:
            duration_seconds: Audio duration in seconds
            
        Returns:
            float: Estimated processing time in seconds
        """
        # Speaker diarization is typically 1-3x realtime depending on device
        if self._device.type == "cuda":
            return duration_seconds * 1.0  # ~1x realtime on GPU
        elif self._device.type == "mps":
            return duration_seconds * 1.5  # ~1.5x realtime on Apple Silicon
        else:
            return duration_seconds * 2.5  # ~2.5x realtime on CPU
    
    def cleanup(self) -> None:
        """Clean up model resources."""
        if self.pipeline is not None:
            del self.pipeline
            self.pipeline = None
            
        # Clear CUDA cache if available
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass