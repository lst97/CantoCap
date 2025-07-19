"""Transcription entities for Whisper output representation."""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any

from ..value_objects import Timestamp


@dataclass
class TranscriptionChunk:
    """Individual transcription chunk with timing and text."""
    
    text: str
    start_time: Timestamp
    end_time: Timestamp
    confidence: Optional[float] = None
    
    def __post_init__(self) -> None:
        """Validate chunk constraints."""
        if not self.text.strip():
            raise ValueError("Transcription chunk text cannot be empty")
        
        if self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time")
        
        if self.confidence is not None:
            if not (0.0 <= self.confidence <= 1.0):
                raise ValueError("Confidence must be between 0.0 and 1.0")
    
    @classmethod
    def create(
        cls,
        text: str,
        start_seconds: float,
        end_seconds: float,
        confidence: Optional[float] = None
    ) -> "TranscriptionChunk":
        """Create chunk from raw values."""
        return cls(
            text=text.strip(),
            start_time=Timestamp.from_seconds(start_seconds),
            end_time=Timestamp.from_seconds(end_seconds),
            confidence=confidence
        )
    
    @classmethod
    def from_whisper_chunk(cls, whisper_data: Dict[str, Any]) -> "TranscriptionChunk":
        """Create chunk from Whisper output format."""
        return cls.create(
            text=whisper_data.get("text", "").strip(),
            start_seconds=whisper_data.get("timestamp", [0, 0])[0],
            end_seconds=whisper_data.get("timestamp", [0, 0])[1],
            confidence=whisper_data.get("confidence")
        )
    
    def get_duration_seconds(self) -> float:
        """Get chunk duration in seconds."""
        return self.end_time.seconds - self.start_time.seconds
    
    def get_text(self) -> str:
        """Get the transcribed text."""
        return self.text
    
    def get_start_time(self) -> Timestamp:
        """Get start timestamp."""
        return self.start_time
    
    def get_end_time(self) -> Timestamp:
        """Get end timestamp."""
        return self.end_time
    
    def has_confidence(self) -> bool:
        """Check if confidence score is available."""
        return self.confidence is not None
    
    def get_confidence(self) -> Optional[float]:
        """Get confidence score if available."""
        return self.confidence
    
    def is_high_confidence(self, threshold: float = 0.8) -> bool:
        """Check if chunk has high confidence (above threshold)."""
        return self.confidence is not None and self.confidence >= threshold
    
    def overlaps_with(self, other: "TranscriptionChunk") -> bool:
        """Check if this chunk overlaps with another chunk."""
        return (
            self.start_time < other.end_time and 
            self.end_time > other.start_time
        )
    
    def __str__(self) -> str:
        """String representation."""
        confidence_str = f" (conf: {self.confidence:.2f})" if self.confidence else ""
        return f"[{self.start_time.to_srt_format()} --> {self.end_time.to_srt_format()}] {self.text}{confidence_str}"


@dataclass
class Transcription:
    """Complete transcription result from speech-to-text processing."""
    
    chunks: List[TranscriptionChunk]
    full_text: str
    language: str = "zh"  # Cantonese/Chinese
    total_duration: Optional[float] = None
    
    def __post_init__(self) -> None:
        """Validate transcription constraints."""
        if not self.chunks:
            raise ValueError("Transcription must have at least one chunk")
        
        # Validate chunks are in chronological order
        for i in range(1, len(self.chunks)):
            if self.chunks[i-1].start_time > self.chunks[i].start_time:
                raise ValueError("Transcription chunks must be in chronological order")
        
        # If full_text is empty, generate from chunks
        if not self.full_text.strip():
            self.full_text = " ".join(chunk.text for chunk in self.chunks)
    
    @classmethod
    def create(
        cls,
        chunks: List[TranscriptionChunk],
        full_text: Optional[str] = None,
        language: str = "zh",
        total_duration: Optional[float] = None
    ) -> "Transcription":
        """Create transcription from chunks."""
        if full_text is None:
            full_text = " ".join(chunk.text for chunk in chunks)
        
        return cls(
            chunks=chunks,
            full_text=full_text,
            language=language,
            total_duration=total_duration
        )
    
    @classmethod
    def from_whisper_result(cls, whisper_result: Dict[str, Any]) -> "Transcription":
        """Create transcription from Whisper pipeline result."""
        # Extract chunks from Whisper result
        chunks = []
        if "chunks" in whisper_result:
            for chunk_data in whisper_result["chunks"]:
                try:
                    chunk = TranscriptionChunk.from_whisper_chunk(chunk_data)
                    chunks.append(chunk)
                except (KeyError, ValueError) as e:
                    # Skip invalid chunks but log the issue
                    continue
        
        # Fallback: create single chunk from full text if no chunks
        if not chunks and "text" in whisper_result:
            chunk = TranscriptionChunk.create(
                text=whisper_result["text"],
                start_seconds=0.0,
                end_seconds=whisper_result.get("duration", 0.0)
            )
            chunks = [chunk]
        
        return cls.create(
            chunks=chunks,
            full_text=whisper_result.get("text", ""),
            language=whisper_result.get("language", "zh"),
            total_duration=whisper_result.get("duration")
        )
    
    def get_chunks(self) -> List[TranscriptionChunk]:
        """Get all transcription chunks."""
        return self.chunks
    
    def get_full_text(self) -> str:
        """Get complete transcribed text."""
        return self.full_text
    
    def get_chunk_count(self) -> int:
        """Get number of chunks."""
        return len(self.chunks)
    
    def get_total_duration(self) -> Optional[float]:
        """Get total duration if available."""
        return self.total_duration
    
    def get_duration_from_chunks(self) -> float:
        """Calculate duration from first and last chunk."""
        if not self.chunks:
            return 0.0
        return self.chunks[-1].end_time.seconds - self.chunks[0].start_time.seconds
    
    def get_language(self) -> str:
        """Get detected language."""
        return self.language
    
    def get_average_confidence(self) -> Optional[float]:
        """Get average confidence across all chunks."""
        confidences = [
            chunk.confidence for chunk in self.chunks 
            if chunk.confidence is not None
        ]
        return sum(confidences) / len(confidences) if confidences else None
    
    def get_low_confidence_chunks(self, threshold: float = 0.5) -> List[TranscriptionChunk]:
        """Get chunks with confidence below threshold."""
        return [
            chunk for chunk in self.chunks
            if chunk.confidence is not None and chunk.confidence < threshold
        ]
    
    def has_timing_gaps(self, max_gap_seconds: float = 1.0) -> bool:
        """Check if there are significant gaps between chunks."""
        for i in range(1, len(self.chunks)):
            gap = self.chunks[i].start_time.seconds - self.chunks[i-1].end_time.seconds
            if gap > max_gap_seconds:
                return True
        return False
    
    def get_word_count(self) -> int:
        """Get approximate word count."""
        # For Chinese text, count characters as words are not space-separated
        return len(self.full_text.replace(" ", ""))
    
    def __str__(self) -> str:
        """String representation."""
        duration_str = f"{self.total_duration:.1f}s" if self.total_duration else "unknown duration"
        avg_conf = self.get_average_confidence()
        conf_str = f", avg conf: {avg_conf:.2f}" if avg_conf else ""
        return f"Transcription({len(self.chunks)} chunks, {duration_str}{conf_str})"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return (
            f"Transcription(chunks={len(self.chunks)}, "
            f"language='{self.language}', "
            f"total_duration={self.total_duration})"
        )