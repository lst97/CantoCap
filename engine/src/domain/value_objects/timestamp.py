"""Timestamp value object for precise time handling in subtitles."""

from dataclasses import dataclass
from datetime import timedelta
from typing import Union


@dataclass(frozen=True)
class Timestamp:
    """Immutable timestamp for subtitle timing with validation."""
    
    seconds: float
    
    def __post_init__(self) -> None:
        """Validate timestamp constraints."""
        if self.seconds < 0:
            raise ValueError("Timestamp cannot be negative")
        if self.seconds > 86400:  # 24 hours in seconds
            raise ValueError("Timestamp cannot exceed 24 hours")
    
    @classmethod
    def from_seconds(cls, seconds: float) -> "Timestamp":
        """Create timestamp from seconds."""
        return cls(seconds=seconds)
    
    @classmethod
    def from_milliseconds(cls, milliseconds: float) -> "Timestamp":
        """Create timestamp from milliseconds."""
        return cls(seconds=milliseconds / 1000.0)
    
    @classmethod
    def from_timedelta(cls, td: timedelta) -> "Timestamp":
        """Create timestamp from timedelta."""
        return cls(seconds=td.total_seconds())
    
    def to_timedelta(self) -> timedelta:
        """Convert to timedelta for SRT library compatibility."""
        return timedelta(seconds=self.seconds)
    
    def to_milliseconds(self) -> float:
        """Convert to milliseconds."""
        return self.seconds * 1000.0
    
    def to_srt_format(self) -> str:
        """Convert to SRT timestamp format (HH:MM:SS,mmm)."""
        hours = int(self.seconds // 3600)
        minutes = int((self.seconds % 3600) // 60)
        seconds = int(self.seconds % 60)
        milliseconds = int((self.seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"
    
    def __add__(self, other: Union["Timestamp", float]) -> "Timestamp":
        """Add timestamp or seconds."""
        if isinstance(other, Timestamp):
            return Timestamp(self.seconds + other.seconds)
        return Timestamp(self.seconds + other)
    
    def __sub__(self, other: Union["Timestamp", float]) -> "Timestamp":
        """Subtract timestamp or seconds."""
        if isinstance(other, Timestamp):
            result_seconds = self.seconds - other.seconds
        else:
            result_seconds = self.seconds - other
        
        if result_seconds < 0:
            raise ValueError("Resulting timestamp cannot be negative")
        return Timestamp(result_seconds)
    
    def __lt__(self, other) -> bool:
        """Less than comparison. Supports both Timestamp objects and float values (as seconds)."""
        if isinstance(other, Timestamp):
            return self.seconds < other.seconds
        elif isinstance(other, (int, float)):
            return self.seconds < other
        else:
            return NotImplemented
    
    def __le__(self, other) -> bool:
        """Less than or equal comparison. Supports both Timestamp objects and float values (as seconds)."""
        if isinstance(other, Timestamp):
            return self.seconds <= other.seconds
        elif isinstance(other, (int, float)):
            return self.seconds <= other
        else:
            return NotImplemented
    
    def __gt__(self, other) -> bool:
        """Greater than comparison. Supports both Timestamp objects and float values (as seconds)."""
        if isinstance(other, Timestamp):
            return self.seconds > other.seconds
        elif isinstance(other, (int, float)):
            return self.seconds > other
        else:
            return NotImplemented
    
    def __ge__(self, other) -> bool:
        """Greater than or equal comparison. Supports both Timestamp objects and float values (as seconds)."""
        if isinstance(other, Timestamp):
            return self.seconds >= other.seconds
        elif isinstance(other, (int, float)):
            return self.seconds >= other
        else:
            return NotImplemented
    
    def __format__(self, format_spec: str) -> str:
        """Support for f-string formatting. Formats the seconds value."""
        return format(self.seconds, format_spec)