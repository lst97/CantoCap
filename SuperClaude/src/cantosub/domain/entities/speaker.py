"""Speaker entities for speaker diarization."""

from dataclasses import dataclass
from typing import List, Optional

from ..value_objects import Timestamp


@dataclass
class SpeakerSegment:
    """Individual speaker segment with timing and speaker identity."""
    
    speaker_id: str
    start_time: Timestamp
    end_time: Timestamp
    confidence: Optional[float] = None
    
    def __post_init__(self) -> None:
        """Validate speaker segment constraints."""
        if not self.speaker_id.strip():
            raise ValueError("Speaker ID cannot be empty")
        
        if self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time")
        
        if self.confidence is not None:
            if not (0.0 <= self.confidence <= 1.0):
                raise ValueError("Confidence must be between 0.0 and 1.0")
    
    @classmethod
    def create(
        cls,
        speaker_id: str,
        start_seconds: float,
        end_seconds: float,
        confidence: Optional[float] = None
    ) -> "SpeakerSegment":
        """Create speaker segment from raw values."""
        return cls(
            speaker_id=speaker_id.strip(),
            start_time=Timestamp.from_seconds(start_seconds),
            end_time=Timestamp.from_seconds(end_seconds),
            confidence=confidence
        )
    
    def get_duration_seconds(self) -> float:
        """Get segment duration in seconds."""
        return self.end_time.seconds - self.start_time.seconds
    
    def overlaps_with_timestamp(self, timestamp: Timestamp) -> bool:
        """Check if timestamp falls within this speaker segment."""
        return self.start_time <= timestamp <= self.end_time
    
    def overlaps_with_timespan(self, start: Timestamp, end: Timestamp) -> bool:
        """Check if timespan overlaps with this speaker segment."""
        return self.start_time < end and self.end_time > start
    
    def get_overlap_duration(self, start: Timestamp, end: Timestamp) -> float:
        """Get overlap duration with given timespan."""
        overlap_start = max(self.start_time.seconds, start.seconds)
        overlap_end = min(self.end_time.seconds, end.seconds)
        return max(0.0, overlap_end - overlap_start)
    
    def __str__(self) -> str:
        """String representation."""
        confidence_str = f" (conf: {self.confidence:.2f})" if self.confidence else ""
        return f"[{self.start_time.to_srt_format()} --> {self.end_time.to_srt_format()}] {self.speaker_id}{confidence_str}"


@dataclass
class SpeakerDiarization:
    """Complete speaker diarization result."""
    
    segments: List[SpeakerSegment]
    total_duration: Optional[float] = None
    num_speakers: Optional[int] = None
    
    def __post_init__(self) -> None:
        """Validate diarization constraints."""
        if not self.segments:
            raise ValueError("Diarization must have at least one segment")
        
        # Validate segments are in chronological order
        for i in range(1, len(self.segments)):
            if self.segments[i-1].start_time > self.segments[i].start_time:
                raise ValueError("Speaker segments must be in chronological order")
        
        # Calculate number of speakers if not provided
        if self.num_speakers is None:
            unique_speakers = set(segment.speaker_id for segment in self.segments)
            self.num_speakers = len(unique_speakers)
    
    @classmethod
    def create(
        cls,
        segments: List[SpeakerSegment],
        total_duration: Optional[float] = None
    ) -> "SpeakerDiarization":
        """Create speaker diarization from segments."""
        return cls(
            segments=segments,
            total_duration=total_duration
        )
    
    def get_speaker_for_timestamp(self, timestamp: Timestamp) -> Optional[str]:
        """Get speaker ID for a given timestamp."""
        for segment in self.segments:
            if segment.overlaps_with_timestamp(timestamp):
                return segment.speaker_id
        return None
    
    def get_speaker_for_timespan(
        self, 
        start: Timestamp, 
        end: Timestamp
    ) -> Optional[str]:
        """Get primary speaker for a timespan (most overlap)."""
        best_speaker = None
        max_overlap = 0.0
        
        for segment in self.segments:
            overlap_duration = segment.get_overlap_duration(start, end)
            if overlap_duration > max_overlap:
                max_overlap = overlap_duration
                best_speaker = segment.speaker_id
        
        return best_speaker
    
    def get_unique_speakers(self) -> List[str]:
        """Get list of unique speaker IDs."""
        unique_speakers = list(set(segment.speaker_id for segment in self.segments))
        return sorted(unique_speakers)
    
    def get_speaker_speaking_time(self, speaker_id: str) -> float:
        """Get total speaking time for a speaker."""
        total_time = 0.0
        for segment in self.segments:
            if segment.speaker_id == speaker_id:
                total_time += segment.get_duration_seconds()
        return total_time
    
    def get_speaker_statistics(self) -> dict:
        """Get statistics about speakers."""
        unique_speakers = self.get_unique_speakers()
        stats = {
            "num_speakers": len(unique_speakers),
            "total_segments": len(self.segments),
            "speakers": {}
        }
        
        for speaker_id in unique_speakers:
            speaker_segments = [s for s in self.segments if s.speaker_id == speaker_id]
            speaking_time = self.get_speaker_speaking_time(speaker_id)
            
            stats["speakers"][speaker_id] = {
                "segments": len(speaker_segments),
                "speaking_time": speaking_time,
                "percentage": (speaking_time / self.total_duration * 100) if self.total_duration else 0.0
            }
        
        return stats
    
    def has_speaker_changes(self) -> bool:
        """Check if there are speaker changes in the diarization."""
        return len(self.get_unique_speakers()) > 1
    
    def __str__(self) -> str:
        """String representation."""
        duration_str = f"{self.total_duration:.1f}s" if self.total_duration else "unknown duration"
        return f"SpeakerDiarization({len(self.segments)} segments, {self.num_speakers} speakers, {duration_str})"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return (
            f"SpeakerDiarization(segments={len(self.segments)}, "
            f"num_speakers={self.num_speakers}, "
            f"total_duration={self.total_duration})"
        )