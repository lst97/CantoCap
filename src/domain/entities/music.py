"""Music detection entities."""

from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

from ..value_objects import Timestamp


class MusicType(Enum):
    """Types of detected music."""
    BACKGROUND_MUSIC = "background_music"
    FOREGROUND_MUSIC = "foreground_music"
    INSTRUMENTAL = "instrumental"
    VOCAL = "vocal"
    SPEECH_WITH_MUSIC = "speech_with_music"
    UNKNOWN = "unknown"


@dataclass
class MusicSegment:
    """Individual music segment with timing and classification."""
    
    start_time: Timestamp
    end_time: Timestamp
    music_type: MusicType = MusicType.UNKNOWN
    confidence: Optional[float] = None
    
    def __post_init__(self) -> None:
        """Validate music segment constraints."""
        if self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time")
        
        if self.confidence is not None:
            if not (0.0 <= self.confidence <= 1.0):
                raise ValueError("Confidence must be between 0.0 and 1.0")
    
    @classmethod
    def create(
        cls,
        start_seconds: float,
        end_seconds: float,
        music_type: MusicType = MusicType.UNKNOWN,
        confidence: Optional[float] = None
    ) -> "MusicSegment":
        """Create music segment from raw values."""
        return cls(
            start_time=Timestamp.from_seconds(start_seconds),
            end_time=Timestamp.from_seconds(end_seconds),
            music_type=music_type,
            confidence=confidence
        )
    
    def get_duration_seconds(self) -> float:
        """Get segment duration in seconds."""
        return self.end_time.seconds - self.start_time.seconds
    
    def overlaps_with_timestamp(self, timestamp: Timestamp) -> bool:
        """Check if timestamp falls within this music segment."""
        return self.start_time <= timestamp <= self.end_time
    
    def overlaps_with_timespan(self, start: Timestamp, end: Timestamp) -> bool:
        """Check if timespan overlaps with this music segment."""
        return self.start_time < end and self.end_time > start
    
    def should_suppress_speech(self) -> bool:
        """Check if this music segment should suppress speech transcription."""
        # Foreground music and instrumental music should suppress speech
        return self.music_type in (MusicType.FOREGROUND_MUSIC, MusicType.INSTRUMENTAL)
    
    def should_add_music_label(self) -> bool:
        """Check if this segment should add a [music] label to subtitles."""
        # Any detected music should get a label
        return True
    
    def get_music_label(self) -> str:
        """Get appropriate music label for subtitles."""
        if self.music_type == MusicType.BACKGROUND_MUSIC:
            return "[background music]"
        elif self.music_type == MusicType.FOREGROUND_MUSIC:
            return "[music]"
        elif self.music_type == MusicType.INSTRUMENTAL:
            return "[instrumental music]"
        elif self.music_type == MusicType.VOCAL:
            return "[music with vocals]"
        elif self.music_type == MusicType.SPEECH_WITH_MUSIC:
            return "[music]"
        else:
            return "[music]"
    
    def __str__(self) -> str:
        """String representation."""
        confidence_str = f" (conf: {self.confidence:.2f})" if self.confidence else ""
        return f"[{self.start_time.to_srt_format()} --> {self.end_time.to_srt_format()}] {self.music_type.value}{confidence_str}"


@dataclass
class MusicDetection:
    """Complete music detection result."""
    
    segments: List[MusicSegment]
    total_duration: Optional[float] = None
    
    def __post_init__(self) -> None:
        """Validate music detection constraints."""
        # Validate segments are in chronological order
        for i in range(1, len(self.segments)):
            if self.segments[i-1].start_time > self.segments[i].start_time:
                raise ValueError("Music segments must be in chronological order")
    
    @classmethod
    def create(
        cls,
        segments: List[MusicSegment],
        total_duration: Optional[float] = None
    ) -> "MusicDetection":
        """Create music detection from segments."""
        return cls(
            segments=segments,
            total_duration=total_duration
        )
    
    @classmethod
    def empty(cls, total_duration: Optional[float] = None) -> "MusicDetection":
        """Create empty music detection (no music found)."""
        return cls(segments=[], total_duration=total_duration)
    
    def has_music(self) -> bool:
        """Check if any music was detected."""
        return len(self.segments) > 0
    
    def get_music_for_timestamp(self, timestamp: Timestamp) -> Optional[MusicSegment]:
        """Get music segment for a given timestamp."""
        for segment in self.segments:
            if segment.overlaps_with_timestamp(timestamp):
                return segment
        return None
    
    def get_music_for_timespan(
        self, 
        start: Timestamp, 
        end: Timestamp
    ) -> List[MusicSegment]:
        """Get all music segments that overlap with timespan."""
        overlapping = []
        for segment in self.segments:
            if segment.overlaps_with_timespan(start, end):
                overlapping.append(segment)
        return overlapping
    
    def should_suppress_speech_at(self, timestamp: Timestamp) -> bool:
        """Check if speech should be suppressed at given timestamp."""
        music = self.get_music_for_timestamp(timestamp)
        return music is not None and music.should_suppress_speech()
    
    def get_total_music_duration(self) -> float:
        """Get total duration of detected music."""
        return sum(segment.get_duration_seconds() for segment in self.segments)
    
    def get_music_percentage(self) -> float:
        """Get percentage of audio that contains music."""
        if not self.total_duration or self.total_duration == 0:
            return 0.0
        
        music_duration = self.get_total_music_duration()
        return (music_duration / self.total_duration) * 100.0
    
    def get_music_type_statistics(self) -> dict:
        """Get statistics about music types."""
        stats = {}
        for music_type in MusicType:
            type_segments = [s for s in self.segments if s.music_type == music_type]
            if type_segments:
                total_duration = sum(s.get_duration_seconds() for s in type_segments)
                stats[music_type.value] = {
                    "segments": len(type_segments),
                    "duration": total_duration,
                    "percentage": (total_duration / self.total_duration * 100) if self.total_duration else 0.0
                }
        return stats
    
    def merge_adjacent_segments(self, max_gap_seconds: float = 0.5) -> "MusicDetection":
        """Merge adjacent music segments of the same type."""
        if not self.segments:
            return self
        
        merged_segments = []
        current_segment = self.segments[0]
        
        for next_segment in self.segments[1:]:
            # Check if segments are adjacent and of same type
            gap = next_segment.start_time.seconds - current_segment.end_time.seconds
            same_type = current_segment.music_type == next_segment.music_type
            
            if gap <= max_gap_seconds and same_type:
                # Merge segments
                current_segment = MusicSegment(
                    start_time=current_segment.start_time,
                    end_time=next_segment.end_time,
                    music_type=current_segment.music_type,
                    confidence=max(
                        current_segment.confidence or 0.0,
                        next_segment.confidence or 0.0
                    ) if (current_segment.confidence and next_segment.confidence) else None
                )
            else:
                merged_segments.append(current_segment)
                current_segment = next_segment
        
        merged_segments.append(current_segment)
        
        return MusicDetection.create(
            segments=merged_segments,
            total_duration=self.total_duration
        )
    
    def __str__(self) -> str:
        """String representation."""
        duration_str = f"{self.total_duration:.1f}s" if self.total_duration else "unknown duration"
        music_pct = f"{self.get_music_percentage():.1f}%" if self.total_duration else "unknown%"
        return f"MusicDetection({len(self.segments)} segments, {music_pct} music, {duration_str})"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return (
            f"MusicDetection(segments={len(self.segments)}, "
            f"total_duration={self.total_duration})"
        )