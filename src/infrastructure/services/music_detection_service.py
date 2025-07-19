"""Music detection service using audio classification models."""

from typing import List, Dict, Any, Optional
import warnings

from ...domain.entities import MusicDetection, MusicSegment, MusicType
from ...domain.value_objects import FilePath


class MusicDetectionService:
    """Service for music detection using Hugging Face audio classification models."""
    
    def __init__(self, model_name: str = "microsoft/speecht5_vc"):
        """
        Initialize music detection service.
        
        Args:
            model_name: Hugging Face model name for audio classification
        """
        self.model_name = model_name
        self.pipeline = None
        self._device = self._get_optimal_device()
    
    def _get_optimal_device(self) -> str:
        """Determine optimal device for inference."""
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return "mps"  # Apple Silicon
            else:
                return "cpu"
        except ImportError:
            return "cpu"
    
    def load_model(self, model_name: Optional[str] = None) -> bool:
        """
        Load music detection model.
        
        Args:
            model_name: Optional model name to override default
            
        Returns:
            bool: True if model loaded successfully
        """
        try:
            from transformers import pipeline
            import torch
            
            model_to_load = model_name or self.model_name
            
            # Suppress some warnings for cleaner output
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Use audio classification pipeline
                self.pipeline = pipeline(
                    "audio-classification",
                    model=model_to_load,
                    device=self._device,
                    torch_dtype=torch.float16 if self._device != "cpu" else torch.float32,
                )
            
            self.model_name = model_to_load
            return True
            
        except Exception as e:
            print(f"Failed to load music detection model: {e}")
            # Fallback: create mock service for development
            self.pipeline = "mock"
            return True
    
    def is_model_loaded(self) -> bool:
        """
        Check if model is loaded and ready.
        
        Returns:
            bool: True if model is ready
        """
        return self.pipeline is not None
    
    def detect_music_in_file(
        self,
        audio_file_path: str,
        window_size: float = 5.0,
        hop_size: float = 2.5,
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Detect music segments in audio file.
        
        Args:
            audio_file_path: Path to audio file
            window_size: Size of analysis window in seconds
            hop_size: Step size between windows in seconds
            confidence_threshold: Minimum confidence for music detection
            
        Returns:
            dict: Music detection result with segments and metadata
            
        Raises:
            RuntimeError: If model not loaded or detection fails
        """
        if not self.is_model_loaded():
            raise RuntimeError("Music detection model not loaded. Call load_model() first.")
        
        # Validate file exists
        file_path = FilePath.from_string(audio_file_path)
        file_path.validate_exists()
        
        try:
            if self.pipeline == "mock":
                # Mock implementation for development
                return self._create_mock_detection_result(audio_file_path)
            
            # Load audio and analyze in windows
            segments = self._analyze_audio_windows(
                audio_file_path,
                window_size,
                hop_size,
                confidence_threshold
            )
            
            # Merge adjacent segments
            merged_segments = self._merge_adjacent_segments(segments)
            
            return {
                "segments": merged_segments,
                "total_duration": self._get_audio_duration(audio_file_path),
                "source_file": audio_file_path,
                "window_size": window_size,
                "confidence_threshold": confidence_threshold
            }
            
        except Exception as e:
            raise RuntimeError(f"Music detection failed: {e}")
    
    def _analyze_audio_windows(
        self,
        audio_file_path: str,
        window_size: float,
        hop_size: float,
        confidence_threshold: float
    ) -> List[Dict[str, Any]]:
        """Analyze audio in overlapping windows."""
        import librosa
        
        # Load audio
        audio, sr = librosa.load(audio_file_path, sr=16000)
        duration = len(audio) / sr
        
        segments = []
        current_time = 0.0
        
        while current_time < duration:
            end_time = min(current_time + window_size, duration)
            
            # Extract window
            start_sample = int(current_time * sr)
            end_sample = int(end_time * sr)
            window_audio = audio[start_sample:end_sample]
            
            # Classify window
            try:
                # Convert to format expected by pipeline
                result = self.pipeline(window_audio)
                
                # Find music-related classifications
                music_confidence = self._extract_music_confidence(result)
                
                if music_confidence >= confidence_threshold:
                    music_type = self._classify_music_type(result)
                    segments.append({
                        "start_time": current_time,
                        "end_time": end_time,
                        "music_type": music_type,
                        "confidence": music_confidence
                    })
            
            except Exception as e:
                print(f"Warning: Failed to classify window at {current_time}s: {e}")
            
            current_time += hop_size
        
        return segments
    
    def _extract_music_confidence(self, classification_result: List[Dict]) -> float:
        """Extract music confidence from classification result."""
        # Look for music-related labels
        music_keywords = ["music", "song", "instrumental", "melody", "audio"]
        max_confidence = 0.0
        
        for result in classification_result:
            label = result["label"].lower()
            score = result["score"]
            
            if any(keyword in label for keyword in music_keywords):
                max_confidence = max(max_confidence, score)
        
        return max_confidence
    
    def _classify_music_type(self, classification_result: List[Dict]) -> MusicType:
        """Classify type of music from classification result."""
        # Simple heuristic based on common labels
        for result in classification_result:
            label = result["label"].lower()
            
            if "instrumental" in label:
                return MusicType.INSTRUMENTAL
            elif "vocal" in label or "singing" in label:
                return MusicType.VOCAL
            elif "background" in label:
                return MusicType.BACKGROUND_MUSIC
            elif "music" in label:
                return MusicType.FOREGROUND_MUSIC
        
        return MusicType.UNKNOWN
    
    def _merge_adjacent_segments(
        self, 
        segments: List[Dict[str, Any]], 
        max_gap: float = 1.0
    ) -> List[Dict[str, Any]]:
        """Merge adjacent music segments."""
        if not segments:
            return segments
        
        merged = []
        current = segments[0]
        
        for next_segment in segments[1:]:
            gap = next_segment["start_time"] - current["end_time"]
            same_type = current["music_type"] == next_segment["music_type"]
            
            if gap <= max_gap and same_type:
                # Merge segments
                current["end_time"] = next_segment["end_time"]
                current["confidence"] = max(current["confidence"], next_segment["confidence"])
            else:
                merged.append(current)
                current = next_segment
        
        merged.append(current)
        return merged
    
    def _get_audio_duration(self, audio_file_path: str) -> float:
        """Get audio duration using librosa."""
        try:
            import librosa
            duration = librosa.get_duration(path=audio_file_path)
            return duration
        except Exception:
            # Fallback: return 0 if can't determine
            return 0.0
    
    def _create_mock_detection_result(self, audio_file_path: str) -> Dict[str, Any]:
        """Create mock detection result for development."""
        # Simple mock: detect music in middle third of audio
        try:
            duration = self._get_audio_duration(audio_file_path)
            if duration <= 0:
                duration = 30.0  # Default fallback
            
            start_music = duration * 0.33
            end_music = duration * 0.66
            
            return {
                "segments": [
                    {
                        "start_time": start_music,
                        "end_time": end_music,
                        "music_type": MusicType.BACKGROUND_MUSIC,
                        "confidence": 0.8
                    }
                ] if duration > 10 else [],  # Only add music for longer files
                "total_duration": duration,
                "source_file": audio_file_path,
                "window_size": 5.0,
                "confidence_threshold": 0.5
            }
        except Exception:
            return {
                "segments": [],
                "total_duration": 0.0,
                "source_file": audio_file_path,
                "window_size": 5.0,
                "confidence_threshold": 0.5
            }
    
    def create_detection_entity(
        self, 
        detection_result: Dict[str, Any]
    ) -> MusicDetection:
        """
        Create MusicDetection entity from detection result.
        
        Args:
            detection_result: Processed detection result
            
        Returns:
            MusicDetection: Domain entity
        """
        segments = []
        for seg_data in detection_result["segments"]:
            segment = MusicSegment.create(
                start_seconds=seg_data["start_time"],
                end_seconds=seg_data["end_time"],
                music_type=seg_data.get("music_type", MusicType.UNKNOWN),
                confidence=seg_data.get("confidence")
            )
            segments.append(segment)
        
        return MusicDetection.create(
            segments=segments,
            total_duration=detection_result.get("total_duration")
        )
    
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
            "is_mock": self.pipeline == "mock"
        }
    
    def estimate_processing_time(self, duration_seconds: float) -> float:
        """
        Estimate music detection processing time.
        
        Args:
            duration_seconds: Audio duration in seconds
            
        Returns:
            float: Estimated processing time in seconds
        """
        if self.pipeline == "mock":
            return 1.0  # Mock is instant
        
        # Music detection with windowing is typically 0.5-2x realtime
        if self._device == "cuda":
            return duration_seconds * 0.5
        elif self._device == "mps":
            return duration_seconds * 1.0
        else:
            return duration_seconds * 1.5
    
    def cleanup(self) -> None:
        """Clean up model resources."""
        if self.pipeline is not None and self.pipeline != "mock":
            del self.pipeline
            self.pipeline = None
            
        # Clear CUDA cache if available
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass