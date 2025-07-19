"""Subtitle entities for SRT file generation."""

from dataclasses import dataclass
from typing import List, Optional
import srt

from ..value_objects import Timestamp, FilePath


@dataclass
class Subtitle:
    """Individual subtitle entry with timing and content."""
    
    index: int
    start_time: Timestamp
    end_time: Timestamp
    content: str
    
    def __post_init__(self) -> None:
        """Validate subtitle constraints."""
        if self.index < 1:
            raise ValueError("Subtitle index must be positive")
        
        if self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time")
        
        if not self.content.strip():
            raise ValueError("Subtitle content cannot be empty")
    
    @classmethod
    def create(
        cls,
        index: int,
        start_seconds: float,
        end_seconds: float,
        content: str
    ) -> "Subtitle":
        """Create subtitle from raw values."""
        return cls(
            index=index,
            start_time=Timestamp.from_seconds(start_seconds),
            end_time=Timestamp.from_seconds(end_seconds),
            content=content.strip()
        )
    
    @classmethod
    def from_transcription_chunk(
        cls,
        index: int,
        chunk: "TranscriptionChunk"  # Import handled at runtime
    ) -> "Subtitle":
        """Create subtitle from transcription chunk."""
        return cls(
            index=index,
            start_time=chunk.start_time,
            end_time=chunk.end_time,
            content=chunk.text
        )
    
    def get_duration_seconds(self) -> float:
        """Get subtitle duration in seconds."""
        return self.end_time.seconds - self.start_time.seconds
    
    def get_index(self) -> int:
        """Get subtitle index."""
        return self.index
    
    def get_start_time(self) -> Timestamp:
        """Get start timestamp."""
        return self.start_time
    
    def get_end_time(self) -> Timestamp:
        """Get end timestamp."""
        return self.end_time
    
    def get_content(self) -> str:
        """Get subtitle content."""
        return self.content
    
    def set_content(self, content: str) -> None:
        """Set subtitle content with validation."""
        if not content.strip():
            raise ValueError("Subtitle content cannot be empty")
        self.content = content.strip()
    
    def to_srt_subtitle(self) -> srt.Subtitle:
        """Convert to srt library Subtitle object."""
        return srt.Subtitle(
            index=self.index,
            start=self.start_time.to_timedelta(),
            end=self.end_time.to_timedelta(),
            content=self.content
        )
    
    def overlaps_with(self, other: "Subtitle") -> bool:
        """Check if this subtitle overlaps with another."""
        return (
            self.start_time < other.end_time and 
            self.end_time > other.start_time
        )
    
    def is_too_short(self, min_duration: float = 0.5) -> bool:
        """Check if subtitle duration is too short."""
        return self.get_duration_seconds() < min_duration
    
    def is_too_long(self, max_duration: float = 10.0) -> bool:
        """Check if subtitle duration is too long."""
        return self.get_duration_seconds() > max_duration
    
    def get_character_count(self) -> int:
        """Get character count of content."""
        return len(self.content)
    
    def is_too_long_text(self, max_chars: int = 80) -> bool:
        """Check if subtitle text is too long for display."""
        return self.get_character_count() > max_chars
    
    def __str__(self) -> str:
        """String representation."""
        return f"Subtitle({self.index}: {self.start_time.to_srt_format()} -> {self.end_time.to_srt_format()}, '{self.content[:30]}...')"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return (
            f"Subtitle(index={self.index}, "
            f"start_time={self.start_time!r}, "
            f"end_time={self.end_time!r}, "
            f"content={self.content!r})"
        )


@dataclass
class SubtitleDocument:
    """Complete subtitle document for SRT file generation."""
    
    subtitles: List[Subtitle]
    source_file: Optional[FilePath] = None
    language: str = "zh"
    
    def __post_init__(self) -> None:
        """Validate subtitle document constraints."""
        if not self.subtitles:
            raise ValueError("Subtitle document must contain at least one subtitle")
        
        # Validate indices are sequential
        for i, subtitle in enumerate(self.subtitles, 1):
            if subtitle.index != i:
                raise ValueError(f"Subtitle indices must be sequential. Expected {i}, got {subtitle.index}")
        
        # Validate chronological order
        for i in range(1, len(self.subtitles)):
            if self.subtitles[i-1].start_time > self.subtitles[i].start_time:
                raise ValueError("Subtitles must be in chronological order")
    
    @classmethod
    def create(
        cls,
        subtitles: List[Subtitle],
        source_file: Optional[FilePath] = None,
        language: str = "zh"
    ) -> "SubtitleDocument":
        """Create subtitle document from list of subtitles."""
        return cls(
            subtitles=subtitles,
            source_file=source_file,
            language=language
        )
    
    @classmethod
    def from_transcription(
        cls,
        transcription: "Transcription",  # Import handled at runtime
        source_file: Optional[FilePath] = None
    ) -> "SubtitleDocument":
        """Create subtitle document from transcription."""
        subtitles = [
            Subtitle.from_transcription_chunk(i + 1, chunk)
            for i, chunk in enumerate(transcription.chunks)
        ]
        
        return cls.create(
            subtitles=subtitles,
            source_file=source_file,
            language=transcription.language
        )
    
    def get_subtitles(self) -> List[Subtitle]:
        """Get all subtitles."""
        return self.subtitles
    
    def get_subtitle_count(self) -> int:
        """Get number of subtitles."""
        return len(self.subtitles)
    
    def get_total_duration(self) -> float:
        """Get total duration from first to last subtitle."""
        if not self.subtitles:
            return 0.0
        return self.subtitles[-1].end_time.seconds - self.subtitles[0].start_time.seconds
    
    def get_language(self) -> str:
        """Get document language."""
        return self.language
    
    def get_source_file(self) -> Optional[FilePath]:
        """Get source file if available."""
        return self.source_file
    
    def has_overlapping_subtitles(self) -> bool:
        """Check if any subtitles overlap."""
        for i in range(1, len(self.subtitles)):
            if self.subtitles[i-1].overlaps_with(self.subtitles[i]):
                return True
        return False
    
    def get_timing_gaps(self, min_gap: float = 0.1) -> List[tuple]:
        """Get list of timing gaps between subtitles."""
        gaps = []
        for i in range(1, len(self.subtitles)):
            gap = self.subtitles[i].start_time.seconds - self.subtitles[i-1].end_time.seconds
            if gap > min_gap:
                gaps.append((i-1, i, gap))
        return gaps
    
    def get_quality_issues(self) -> List[str]:
        """Get list of potential quality issues."""
        issues = []
        
        if self.has_overlapping_subtitles():
            issues.append("Found overlapping subtitles")
        
        short_subtitles = [s for s in self.subtitles if s.is_too_short()]
        if short_subtitles:
            issues.append(f"Found {len(short_subtitles)} subtitles shorter than 0.5s")
        
        long_subtitles = [s for s in self.subtitles if s.is_too_long()]
        if long_subtitles:
            issues.append(f"Found {len(long_subtitles)} subtitles longer than 10s")
        
        long_text_subtitles = [s for s in self.subtitles if s.is_too_long_text()]
        if long_text_subtitles:
            issues.append(f"Found {len(long_text_subtitles)} subtitles with text longer than 80 chars")
        
        return issues
    
    def to_srt_content(self) -> str:
        """Convert to SRT file content."""
        srt_subtitles = [subtitle.to_srt_subtitle() for subtitle in self.subtitles]
        return srt.compose(srt_subtitles)
    
    def save_to_file(self, output_path: FilePath) -> None:
        """Save subtitle document to SRT file."""
        content = self.to_srt_content()
        
        with open(output_path.path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def get_statistics(self) -> dict:
        """Get document statistics."""
        return {
            "subtitle_count": self.get_subtitle_count(),
            "total_duration": self.get_total_duration(),
            "average_subtitle_duration": self.get_total_duration() / self.get_subtitle_count() if self.subtitles else 0,
            "language": self.language,
            "has_overlaps": self.has_overlapping_subtitles(),
            "quality_issues": len(self.get_quality_issues())
        }
    
    def __str__(self) -> str:
        """String representation."""
        duration_str = f"{self.get_total_duration():.1f}s"
        source_str = f" from {self.source_file.get_name()}" if self.source_file else ""
        return f"SubtitleDocument({len(self.subtitles)} subtitles, {duration_str}{source_str})"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return (
            f"SubtitleDocument(subtitles={len(self.subtitles)}, "
            f"source_file={self.source_file!r}, "
            f"language='{self.language}')"
        )