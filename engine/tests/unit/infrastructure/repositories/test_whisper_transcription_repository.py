"""Unit tests for WhisperTranscriptionRepository private methods."""

import pytest
from typing import List

from engine.src.domain.entities import TranscriptionChunk, Transcription
from engine.src.infrastructure.repositories.whisper_transcription_repository import WhisperTranscriptionRepository

@pytest.mark.unit
class TestWhisperTranscriptionRepositoryPrivateMethods:
    """Test private methods for transcription processing."""

    @pytest.fixture
    def sample_transcription_chunks(self) -> List[TranscriptionChunk]:
        """Create sample transcription chunks for testing."""
        return [
            TranscriptionChunk(text="Hello", start_time=0.5, end_time=1.5, confidence=0.9),
            TranscriptionChunk(text="World", start_time=2.0, end_time=3.0, confidence=0.8)
        ]

    @pytest.fixture
    def sample_transcription(self, sample_transcription_chunks) -> Transcription:
        """Create a sample transcription for testing."""
        return Transcription.create(
            chunks=sample_transcription_chunks,
            full_text="Hello World",
            language="zh",
            total_duration=2.5
        )

    def test_adjust_transcription_timestamps_basic(self, sample_transcription):
        """Test basic timestamp adjustment functionality."""
        repo = WhisperTranscriptionRepository(None)  # Mock service not needed
        
        # Adjust timestamps by 5 seconds
        adjusted_transcription = repo._adjust_transcription_timestamps(sample_transcription, 5.0)
        
        # Check metadata preservation
        assert adjusted_transcription.full_text == sample_transcription.full_text
        assert adjusted_transcription.language == sample_transcription.language
        assert adjusted_transcription.total_duration == sample_transcription.total_duration
        
        # Verify timestamp adjustments
        assert adjusted_transcription.chunks[0].start_time.seconds == 5.5
        assert adjusted_transcription.chunks[0].end_time.seconds == 6.5
        assert adjusted_transcription.chunks[1].start_time.seconds == 7.0
        assert adjusted_transcription.chunks[1].end_time.seconds == 8.0

    def test_adjust_transcription_timestamps_edge_cases(self, sample_transcription):
        """Test edge cases for timestamp adjustment."""
        repo = WhisperTranscriptionRepository(None)
        
        # Zero offset - should return original transcription
        zero_offset_result = repo._adjust_transcription_timestamps(sample_transcription, 0.0)
        assert zero_offset_result == sample_transcription
        
        # Empty chunks case
        empty_transcription = Transcription.create(
            chunks=[],
            full_text="",
            language="zh",
            total_duration=0.0
        )
        empty_result = repo._adjust_transcription_timestamps(empty_transcription, 5.0)
        assert len(empty_result.chunks) == 0
        
        # Error case: Invalid offset type
        with pytest.raises(ValueError, match="offset must be a number"):
            repo._adjust_transcription_timestamps(sample_transcription, "not a number")
        
        # Error case: Invalid transcription type
        with pytest.raises(ValueError, match="transcription must be a Transcription instance"):
            repo._adjust_transcription_timestamps("not a transcription", 5.0)

    def test_merge_transcriptions_basic(self, sample_transcription):
        """Test basic transcription merging functionality."""
        repo = WhisperTranscriptionRepository(None)
        
        # Create multiple transcriptions with different offsets
        t1 = sample_transcription
        t2 = repo._adjust_transcription_timestamps(sample_transcription, 5.0)
        
        # Merge transcriptions
        merged_transcription = repo._merge_transcriptions([t1, t2])
        
        # Verify merged result
        assert len(merged_transcription.chunks) == 4  # 2 chunks from each source
        assert merged_transcription.language == "zh"
        
        # Check chronological sorting
        sorted_chunk_starts = [chunk.start_time.seconds for chunk in merged_transcription.chunks]
        assert sorted_chunk_starts == sorted(sorted_chunk_starts)
        
        # Check text merging
        assert "Hello World" in merged_transcription.full_text
        assert len(merged_transcription.full_text) > 0

    def test_merge_transcriptions_edge_cases(self, sample_transcription):
        """Test edge cases for transcription merging."""
        repo = WhisperTranscriptionRepository(None)
        
        # Single transcription case
        single_result = repo._merge_transcriptions([sample_transcription])
        assert single_result == sample_transcription
        
        # Empty chunks case
        empty_transcription = Transcription.create(
            chunks=[],
            full_text="",
            language="zh",
            total_duration=0.0
        )
        empty_result = repo._merge_transcriptions([empty_transcription, empty_transcription])
        assert len(empty_result.chunks) == 0
        
        # Error cases
        with pytest.raises(ValueError, match="No transcriptions to merge"):
            repo._merge_transcriptions([])
        
        with pytest.raises(ValueError, match="transcriptions must be a list"):
            repo._merge_transcriptions("not a list")
        
        with pytest.raises(ValueError):
            repo._merge_transcriptions([sample_transcription, "invalid item"])

    def test_merge_transcriptions_duration_calculation(self, sample_transcription):
        """Test total duration calculation during merge."""
        repo = WhisperTranscriptionRepository(None)
        
        # Transcriptions with and without duration
        t1 = sample_transcription
        t2 = Transcription.create(
            chunks=[
                TranscriptionChunk(text="Test", start_time=10.0, end_time=12.0, confidence=0.9)
            ],
            full_text="Test",
            language="zh",
            total_duration=2.0
        )
        t3 = Transcription.create(
            chunks=[
                TranscriptionChunk(text="More", start_time=15.0, end_time=17.0, confidence=0.8)
            ],
            full_text="More",
            language="zh",
            total_duration=2.0
        )
        
        # Merge transcriptions
        merged_transcription = repo._merge_transcriptions([t1, t2, t3])
        
        # Check duration calculation methods
        assert merged_transcription.total_duration is not None
        # Method 1: Sum of durations
        if merged_transcription.total_duration is not None:
            assert merged_transcription.total_duration == 4.0