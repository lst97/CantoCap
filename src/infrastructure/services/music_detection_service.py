"""Music detection service using Whisper's transcription analysis."""

from typing import List, Dict, Any, Optional
import warnings

from ...domain.entities import MusicDetection, MusicSegment, MusicType
from ...domain.value_objects import FilePath, Timestamp


class MusicDetectionService:
    """Service for music detection using Whisper's transcription analysis."""
    
    def __init__(self):
        """Initialize music detection service."""
        self._device = "cpu"  # Use CPU for lightweight analysis
    
    def is_ready(self) -> bool:
        """
        Check if service is ready (always ready since no model loading required).
        
        Returns:
            bool: True since no model loading required
        """
        return True
    
    def detect_music_from_whisper_result(
        self,
        whisper_result: Dict[str, Any],
        audio_duration: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Detect music segments from Whisper transcription result.
        
        This analyzes Whisper's output to identify potential music segments by:
        1. Looking for gaps in speech transcription
        2. Analyzing confidence scores for speech segments
        3. Identifying non-speech tokens or empty transcriptions
        
        Args:
            whisper_result: Processed Whisper transcription result
            audio_duration: Total audio duration in seconds
            
        Returns:
            dict: Music detection result with segments and metadata
        """
        try:
            segments = []
            
            # Get chunks from whisper result
            chunks = whisper_result.get("chunks", [])
            if not chunks:
                # No transcription - assume entire audio is music
                if audio_duration and audio_duration > 0:
                    segments.append({
                        "start_time": 0.0,
                        "end_time": audio_duration,
                        "music_type": MusicType.UNKNOWN.value,
                        "confidence": 0.7
                    })
                return self._create_result(segments, audio_duration)
            
            # Analyze gaps between speech segments
            segments.extend(self._detect_music_gaps(chunks, audio_duration))
            
            # Analyze low-confidence speech segments (might be music)
            segments.extend(self._detect_music_from_low_confidence(chunks))
            
            # Merge overlapping segments
            segments = self._merge_overlapping_segments(segments)
            
            return self._create_result(segments, audio_duration)
            
        except Exception as e:
            # Return empty result on error
            return self._create_result([], audio_duration)
    
    def _detect_music_gaps(
        self, 
        chunks: List[Dict[str, Any]], 
        audio_duration: Optional[float]
    ) -> List[Dict[str, Any]]:
        """Detect music in gaps between speech segments."""
        segments = []
        min_gap_duration = 2.0  # Minimum gap duration to consider as music
        
        # Sort chunks by start time
        sorted_chunks = sorted(chunks, key=lambda x: x.get("timestamp", [0, 0])[0])
        
        for i in range(len(sorted_chunks)):
            current_chunk = sorted_chunks[i]
            current_timestamp = current_chunk.get("timestamp", [0, 0])
            current_end = current_timestamp[1] if len(current_timestamp) > 1 else current_timestamp[0]
            
            # Check gap before first chunk
            if i == 0:
                current_start = current_timestamp[0]
                if current_start > min_gap_duration:
                    segments.append({
                        "start_time": 0.0,
                        "end_time": current_start,
                        "music_type": MusicType.BACKGROUND_MUSIC.value,
                        "confidence": 0.6
                    })
            
            # Check gap after current chunk
            if i < len(sorted_chunks) - 1:
                next_chunk = sorted_chunks[i + 1]
                next_timestamp = next_chunk.get("timestamp", [0, 0])
                next_start = next_timestamp[0]
                
                gap_duration = next_start - current_end
                if gap_duration > min_gap_duration:
                    segments.append({
                        "start_time": current_end,
                        "end_time": next_start,
                        "music_type": MusicType.BACKGROUND_MUSIC.value,
                        "confidence": 0.6
                    })
            
            # Check gap after last chunk
            elif i == len(sorted_chunks) - 1 and audio_duration:
                gap_duration = audio_duration - current_end
                if gap_duration > min_gap_duration:
                    segments.append({
                        "start_time": current_end,
                        "end_time": audio_duration,
                        "music_type": MusicType.BACKGROUND_MUSIC.value,
                        "confidence": 0.6
                    })
        
        return segments
    
    def _detect_music_from_low_confidence(
        self, 
        chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect music from low-confidence or unclear speech segments."""
        segments = []
        
        for chunk in chunks:
            text = chunk.get("text", "").strip().lower()
            timestamp = chunk.get("timestamp", [0, 0])
            
            if len(timestamp) < 2:
                continue
                
            start_time = timestamp[0]
            end_time = timestamp[1]
            duration = end_time - start_time
            
            # Skip very short segments
            if duration < 1.0:
                continue
            
            # Check for music indicators in text
            music_indicators = [
                "♪", "♫", "♬", "🎵", "🎶",  # Musical symbols
                "[music]", "[singing]", "[instrumental]",  # Common labels
                "la la", "na na", "da da",  # Vocal music patterns
                "mmm", "hmm", "ahh", "ohh"  # Humming patterns
            ]
            
            # Check for non-speech patterns
            is_likely_music = False
            
            # Very short text might be music
            if len(text) < 5 and duration > 3.0:
                is_likely_music = True
            
            # Contains music indicators
            if any(indicator in text for indicator in music_indicators):
                is_likely_music = True
            
            # Repetitive patterns (like "la la la")
            words = text.split()
            if len(words) >= 3:
                # Check for repetitive words
                unique_words = set(words)
                if len(unique_words) <= len(words) // 2:  # More than 50% repetition
                    is_likely_music = True
            
            if is_likely_music:
                # Determine music type based on text content
                music_type = MusicType.UNKNOWN
                if any(vocal in text for vocal in ["la", "na", "da", "mmm", "ahh"]):
                    music_type = MusicType.VOCAL
                elif "[instrumental]" in text or len(text.strip()) == 0:
                    music_type = MusicType.INSTRUMENTAL
                else:
                    music_type = MusicType.BACKGROUND_MUSIC
                
                segments.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "music_type": music_type.value,
                    "confidence": 0.5
                })
        
        return segments
    
    def _merge_overlapping_segments(
        self, 
        segments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Merge overlapping or adjacent music segments."""
        if not segments:
            return segments
        
        # Sort by start time
        sorted_segments = sorted(segments, key=lambda x: x["start_time"])
        merged = []
        
        current = sorted_segments[0].copy()
        
        for next_segment in sorted_segments[1:]:
            # Check if segments overlap or are very close (within 0.5 seconds)
            if next_segment["start_time"] <= current["end_time"] + 0.5:
                # Merge segments
                current["end_time"] = max(current["end_time"], next_segment["end_time"])
                # Keep higher confidence
                current["confidence"] = max(current["confidence"], next_segment["confidence"])
                # Prefer more specific music type
                if current["music_type"] == MusicType.UNKNOWN.value:
                    current["music_type"] = next_segment["music_type"]
            else:
                merged.append(current)
                current = next_segment.copy()
        
        merged.append(current)
        
        # Filter out very short segments (less than 1 second)
        merged = [seg for seg in merged if seg["end_time"] - seg["start_time"] >= 1.0]
        
        return merged
    
    def _create_result(
        self, 
        segments: List[Dict[str, Any]], 
        total_duration: Optional[float]
    ) -> Dict[str, Any]:
        """Create standardized music detection result."""
        return {
            "segments": segments,
            "total_duration": total_duration,
            "num_segments": len(segments),
            "total_music_duration": sum(
                seg["end_time"] - seg["start_time"] for seg in segments
            )
        }
    
    def create_music_detection_entity(
        self, 
        detection_result: Dict[str, Any]
    ) -> MusicDetection:
        """
        Create MusicDetection entity from detection result.
        
        Args:
            detection_result: Processed music detection result
            
        Returns:
            MusicDetection: Domain entity
        """
        segments = []
        for seg_data in detection_result["segments"]:
            music_type = MusicType(seg_data["music_type"])
            segment = MusicSegment.create(
                start_seconds=seg_data["start_time"],
                end_seconds=seg_data["end_time"],
                music_type=music_type,
                confidence=seg_data.get("confidence")
            )
            segments.append(segment)
        
        return MusicDetection.create(
            segments=segments,
            total_duration=detection_result.get("total_duration")
        )
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about detection method.
        
        Returns:
            dict: Detection method information
        """
        return {
            "method": "whisper_analysis",
            "device": self._device,
            "capabilities": [
                "gap_detection",
                "low_confidence_analysis", 
                "pattern_recognition"
            ]
        }
    
    def estimate_processing_time(self, duration_seconds: float) -> float:
        """
        Estimate music detection processing time.
        
        Args:
            duration_seconds: Audio duration in seconds
            
        Returns:
            float: Estimated processing time in seconds
        """
        # Music detection is very fast since it only analyzes existing transcription
        return duration_seconds * 0.01  # ~1% of audio duration