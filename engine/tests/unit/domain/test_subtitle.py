"""
Comprehensive unit tests for Subtitle entities.
"""

import pytest
from unittest.mock import MagicMock, patch
import srt
from datetime import timedelta

from src.domain.entities.subtitle import Subtitle, SubtitleDocument
from src.domain.value_objects.timestamp import Timestamp
from src.domain.value_objects.file_path import FilePath


class TestSubtitleCreation:
    """Test Subtitle creation and validation."""
    
    def test_create_valid_subtitle(self):
        """Test creating a valid subtitle."""
        start_time = Timestamp.from_seconds(10.0)
        end_time = Timestamp.from_seconds(15.0)
        subtitle = Subtitle(
            index=1,
            start_time=start_time,
            end_time=end_time,
            content="Hello world"
        )
        
        assert subtitle.index == 1
        assert subtitle.start_time == start_time
        assert subtitle.end_time == end_time
        assert subtitle.content == "Hello world"
    
    def test_create_subtitle_with_create_method(self):
        """Test creating subtitle using create class method."""
        subtitle = Subtitle.create(
            index=2,
            start_seconds=5.5,
            end_seconds=8.2,
            content="  Test content  "
        )
        
        assert subtitle.index == 2
        assert subtitle.start_time.seconds == 5.5
        assert subtitle.end_time.seconds == 8.2
        assert subtitle.content == "Test content"  # Should be stripped
    
    def test_create_subtitle_invalid_index_raises_error(self):
        """Test that invalid index raises ValueError."""
        with pytest.raises(ValueError, match="Subtitle index must be positive"):
            Subtitle(
                index=0,
                start_time=Timestamp.from_seconds(10.0),
                end_time=Timestamp.from_seconds(15.0),
                content="Test"
            )
        
        with pytest.raises(ValueError, match="Subtitle index must be positive"):
            Subtitle(
                index=-1,
                start_time=Timestamp.from_seconds(10.0),
                end_time=Timestamp.from_seconds(15.0),
                content="Test"
            )
    
    def test_create_subtitle_invalid_timing_raises_error(self):
        """Test that invalid timing raises ValueError."""
        # Start time >= end time
        with pytest.raises(ValueError, match="Start time must be before end time"):
            Subtitle(
                index=1,
                start_time=Timestamp.from_seconds(15.0),
                end_time=Timestamp.from_seconds(10.0),
                content="Test"
            )
        
        with pytest.raises(ValueError, match="Start time must be before end time"):
            Subtitle(
                index=1,
                start_time=Timestamp.from_seconds(10.0),
                end_time=Timestamp.from_seconds(10.0),
                content="Test"
            )
    
    def test_create_subtitle_empty_content_raises_error(self):
        """Test that empty content raises ValueError."""
        with pytest.raises(ValueError, match="Subtitle content cannot be empty"):
            Subtitle(
                index=1,
                start_time=Timestamp.from_seconds(10.0),
                end_time=Timestamp.from_seconds(15.0),
                content=""
            )
        
        with pytest.raises(ValueError, match="Subtitle content cannot be empty"):
            Subtitle(
                index=1,
                start_time=Timestamp.from_seconds(10.0),
                end_time=Timestamp.from_seconds(15.0),
                content="   "
            )
    
    def test_from_transcription_chunk(self):
        """Test creating subtitle from transcription chunk."""
        # Mock transcription chunk
        mock_chunk = MagicMock()
        mock_chunk.start_time = Timestamp.from_seconds(5.0)
        mock_chunk.end_time = Timestamp.from_seconds(8.0)
        mock_chunk.text = "Transcribed text"
        
        subtitle = Subtitle.from_transcription_chunk(3, mock_chunk)
        
        assert subtitle.index == 3
        assert subtitle.start_time.seconds == 5.0
        assert subtitle.end_time.seconds == 8.0
        assert subtitle.content == "Transcribed text"


class TestSubtitleMethods:
    """Test Subtitle instance methods."""
    
    def test_get_duration_seconds(self):
        """Test getting subtitle duration."""
        subtitle = Subtitle.create(1, 10.5, 13.2, "Test")
        assert abs(subtitle.get_duration_seconds() - 2.7) < 1e-10
    
    def test_get_duration_seconds_zero(self):
        """Test getting duration when very short."""
        subtitle = Subtitle.create(1, 10.0, 10.001, "Test")
        assert abs(subtitle.get_duration_seconds() - 0.001) < 1e-10
    
    def test_getter_methods(self):
        """Test all getter methods."""
        subtitle = Subtitle.create(5, 20.0, 25.0, "Content")
        
        assert subtitle.get_index() == 5
        assert subtitle.get_start_time().seconds == 20.0
        assert subtitle.get_end_time().seconds == 25.0
        assert subtitle.get_content() == "Content"
    
    def test_set_content_valid(self):
        """Test setting valid content."""
        subtitle = Subtitle.create(1, 10.0, 15.0, "Original")
        subtitle.set_content("New content")
        assert subtitle.content == "New content"
    
    def test_set_content_strips_whitespace(self):
        """Test that set_content strips whitespace."""
        subtitle = Subtitle.create(1, 10.0, 15.0, "Original")
        subtitle.set_content("  New content  ")
        assert subtitle.content == "New content"
    
    def test_set_content_empty_raises_error(self):
        """Test that setting empty content raises ValueError."""
        subtitle = Subtitle.create(1, 10.0, 15.0, "Original")
        
        with pytest.raises(ValueError, match="Subtitle content cannot be empty"):
            subtitle.set_content("")
        
        with pytest.raises(ValueError, match="Subtitle content cannot be empty"):
            subtitle.set_content("   ")
    
    def test_to_srt_subtitle(self):
        """Test conversion to srt library Subtitle object."""
        subtitle = Subtitle.create(2, 10.5, 15.25, "Test content")
        srt_subtitle = subtitle.to_srt_subtitle()
        
        assert isinstance(srt_subtitle, srt.Subtitle)
        assert srt_subtitle.index == 2
        assert srt_subtitle.start == timedelta(seconds=10.5)
        assert srt_subtitle.end == timedelta(seconds=15.25)
        assert srt_subtitle.content == "Test content"
    
    def test_overlaps_with_true(self):
        """Test overlap detection when subtitles overlap."""
        subtitle1 = Subtitle.create(1, 10.0, 15.0, "First")
        subtitle2 = Subtitle.create(2, 12.0, 18.0, "Second")
        
        assert subtitle1.overlaps_with(subtitle2)
        assert subtitle2.overlaps_with(subtitle1)
    
    def test_overlaps_with_false_separate(self):
        """Test overlap detection when subtitles are separate."""
        subtitle1 = Subtitle.create(1, 10.0, 15.0, "First")
        subtitle2 = Subtitle.create(2, 16.0, 20.0, "Second")
        
        assert not subtitle1.overlaps_with(subtitle2)
        assert not subtitle2.overlaps_with(subtitle1)
    
    def test_overlaps_with_false_adjacent(self):
        """Test overlap detection when subtitles are adjacent."""
        subtitle1 = Subtitle.create(1, 10.0, 15.0, "First")
        subtitle2 = Subtitle.create(2, 15.0, 20.0, "Second")
        
        assert not subtitle1.overlaps_with(subtitle2)
        assert not subtitle2.overlaps_with(subtitle1)
    
    def test_overlaps_with_partial(self):
        """Test overlap detection with partial overlaps."""
        subtitle1 = Subtitle.create(1, 10.0, 15.0, "First")
        subtitle2 = Subtitle.create(2, 14.5, 18.0, "Second")
        
        assert subtitle1.overlaps_with(subtitle2)
        assert subtitle2.overlaps_with(subtitle1)
    
    def test_is_too_short_default_threshold(self):
        """Test short duration detection with default threshold."""
        short_subtitle = Subtitle.create(1, 10.0, 10.3, "Short")  # 0.3s
        normal_subtitle = Subtitle.create(2, 10.0, 11.0, "Normal")  # 1.0s
        
        assert short_subtitle.is_too_short()
        assert not normal_subtitle.is_too_short()
    
    def test_is_too_short_custom_threshold(self):
        """Test short duration detection with custom threshold."""
        subtitle = Subtitle.create(1, 10.0, 10.8, "Test")  # 0.8s
        
        assert not subtitle.is_too_short(0.5)  # Not short with 0.5s threshold
        assert subtitle.is_too_short(1.0)      # Short with 1.0s threshold
    
    def test_is_too_long_default_threshold(self):
        """Test long duration detection with default threshold."""
        long_subtitle = Subtitle.create(1, 10.0, 25.0, "Long")    # 15.0s
        normal_subtitle = Subtitle.create(2, 10.0, 15.0, "Normal") # 5.0s
        
        assert long_subtitle.is_too_long()
        assert not normal_subtitle.is_too_long()
    
    def test_is_too_long_custom_threshold(self):
        """Test long duration detection with custom threshold."""
        subtitle = Subtitle.create(1, 10.0, 17.0, "Test")  # 7.0s
        
        assert not subtitle.is_too_long(10.0)  # Not long with 10s threshold
        assert subtitle.is_too_long(5.0)       # Long with 5s threshold
    
    def test_get_character_count(self):
        """Test character count calculation."""
        subtitle = Subtitle.create(1, 10.0, 15.0, "Hello 世界!")
        assert subtitle.get_character_count() == 9  # Includes Unicode characters
    
    def test_get_character_count_empty(self):
        """Test character count for minimal content."""
        subtitle = Subtitle.create(1, 10.0, 15.0, "A")
        assert subtitle.get_character_count() == 1
    
    def test_is_too_long_text_default_threshold(self):
        """Test long text detection with default threshold."""
        long_text = "A" * 100  # 100 characters
        short_text = "Short text"
        
        long_subtitle = Subtitle.create(1, 10.0, 15.0, long_text)
        short_subtitle = Subtitle.create(2, 10.0, 15.0, short_text)
        
        assert long_subtitle.is_too_long_text()
        assert not short_subtitle.is_too_long_text()
    
    def test_is_too_long_text_custom_threshold(self):
        """Test long text detection with custom threshold."""
        text = "A" * 50  # 50 characters
        subtitle = Subtitle.create(1, 10.0, 15.0, text)
        
        assert not subtitle.is_too_long_text(100)  # Not long with 100 char threshold
        assert subtitle.is_too_long_text(30)       # Long with 30 char threshold


class TestSubtitleStringRepresentation:
    """Test Subtitle string representations."""
    
    def test_str_representation(self):
        """Test string representation."""
        subtitle = Subtitle.create(1, 10.5, 15.25, "This is a test subtitle content for display")
        str_repr = str(subtitle)
        
        assert "Subtitle(1:" in str_repr
        assert "00:00:10,500" in str_repr
        assert "00:00:15,250" in str_repr
        assert "This is a test subtitle conten" in str_repr  # Truncated
    
    def test_repr_representation(self):
        """Test repr representation."""
        subtitle = Subtitle.create(2, 5.0, 8.0, "Test")
        repr_str = repr(subtitle)
        
        assert "Subtitle(" in repr_str
        assert "index=2" in repr_str
        assert "start_time=" in repr_str
        assert "end_time=" in repr_str
        assert "content='Test'" in repr_str


class TestSubtitleDocumentCreation:
    """Test SubtitleDocument creation and validation."""
    
    def test_create_valid_document(self):
        """Test creating a valid subtitle document."""
        subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First"),
            Subtitle.create(2, 3.0, 5.0, "Second"),
            Subtitle.create(3, 6.0, 8.0, "Third")
        ]
        
        source_file = FilePath.from_string("/path/to/video.mp4")
        
        document = SubtitleDocument(
            subtitles=subtitles,
            source_file=source_file,
            language="zh"
        )
        
        assert document.subtitles == subtitles
        assert document.source_file == source_file
        assert document.language == "zh"
    
    def test_create_document_with_create_method(self):
        """Test creating document using create class method."""
        subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First"),
            Subtitle.create(2, 3.0, 5.0, "Second")
        ]
        
        document = SubtitleDocument.create(
            subtitles=subtitles,
            language="en"
        )
        
        assert document.subtitles == subtitles
        assert document.source_file is None
        assert document.language == "en"
    
    def test_create_document_empty_subtitles_raises_error(self):
        """Test that empty subtitles list raises ValueError."""
        with pytest.raises(ValueError, match="Subtitle document must contain at least one subtitle"):
            SubtitleDocument(subtitles=[], language="zh")
    
    def test_create_document_non_sequential_indices_raises_error(self):
        """Test that non-sequential indices raise ValueError."""
        subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First"),
            Subtitle.create(3, 3.0, 5.0, "Third")  # Missing index 2
        ]
        
        with pytest.raises(ValueError, match="Subtitle indices must be sequential"):
            SubtitleDocument(subtitles=subtitles, language="zh")
    
    def test_create_document_wrong_start_index_raises_error(self):
        """Test that starting with wrong index raises ValueError."""
        # Index 0 should be rejected at the Subtitle level
        with pytest.raises(ValueError, match="Subtitle index must be positive"):
            Subtitle.create(0, 0.0, 2.0, "Zero")
    
    def test_create_document_non_chronological_raises_error(self):
        """Test that non-chronological order raises ValueError."""
        subtitles = [
            Subtitle.create(1, 5.0, 7.0, "Second"),  # Starts later
            Subtitle.create(2, 0.0, 2.0, "First")   # Starts earlier
        ]
        
        with pytest.raises(ValueError, match="Subtitles must be in chronological order"):
            SubtitleDocument(subtitles=subtitles, language="zh")
    
    def test_from_transcription(self):
        """Test creating document from transcription."""
        # Mock transcription with chunks
        mock_transcription = MagicMock()
        mock_transcription.language = "zh"
        
        mock_chunk1 = MagicMock()
        mock_chunk1.start_time = Timestamp.from_seconds(0.0)
        mock_chunk1.end_time = Timestamp.from_seconds(2.0)
        mock_chunk1.text = "First chunk"
        
        mock_chunk2 = MagicMock()
        mock_chunk2.start_time = Timestamp.from_seconds(3.0)
        mock_chunk2.end_time = Timestamp.from_seconds(5.0)
        mock_chunk2.text = "Second chunk"
        
        mock_transcription.chunks = [mock_chunk1, mock_chunk2]
        
        source_file = FilePath.from_string("/path/to/audio.wav")
        
        document = SubtitleDocument.from_transcription(
            mock_transcription,
            source_file=source_file
        )
        
        assert len(document.subtitles) == 2
        assert document.subtitles[0].index == 1
        assert document.subtitles[0].content == "First chunk"
        assert document.subtitles[1].index == 2
        assert document.subtitles[1].content == "Second chunk"
        assert document.source_file == source_file
        assert document.language == "zh"


class TestSubtitleDocumentMethods:
    """Test SubtitleDocument instance methods."""
    
    def setup_method(self):
        """Set up test data for each test."""
        self.subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First subtitle"),
            Subtitle.create(2, 3.0, 5.0, "Second subtitle"),
            Subtitle.create(3, 6.0, 8.0, "Third subtitle")
        ]
        self.document = SubtitleDocument(
            subtitles=self.subtitles,
            language="zh"
        )
    
    def test_get_subtitles(self):
        """Test getting all subtitles."""
        assert self.document.get_subtitles() == self.subtitles
    
    def test_get_subtitle_count(self):
        """Test getting subtitle count."""
        assert self.document.get_subtitle_count() == 3
    
    def test_get_total_duration(self):
        """Test getting total duration."""
        # From first start (0.0) to last end (8.0)
        assert self.document.get_total_duration() == 8.0
    
    def test_get_total_duration_empty(self):
        """Test total duration with empty subtitles."""
        # This shouldn't happen due to validation, but test the method
        empty_document = SubtitleDocument.__new__(SubtitleDocument)
        empty_document.subtitles = []
        assert empty_document.get_total_duration() == 0.0
    
    def test_get_language(self):
        """Test getting language."""
        assert self.document.get_language() == "zh"
    
    def test_get_source_file(self):
        """Test getting source file."""
        assert self.document.get_source_file() is None
        
        # Test with source file
        source_file = FilePath.from_string("/path/to/video.mp4")
        document_with_source = SubtitleDocument(
            subtitles=self.subtitles,
            source_file=source_file,
            language="zh"
        )
        assert document_with_source.get_source_file() == source_file
    
    def test_has_overlapping_subtitles_false(self):
        """Test overlap detection when no overlaps exist."""
        assert not self.document.has_overlapping_subtitles()
    
    def test_has_overlapping_subtitles_true(self):
        """Test overlap detection when overlaps exist."""
        overlapping_subtitles = [
            Subtitle.create(1, 0.0, 3.0, "First"),
            Subtitle.create(2, 2.0, 5.0, "Second")  # Overlaps with first
        ]
        
        overlapping_document = SubtitleDocument(
            subtitles=overlapping_subtitles,
            language="zh"
        )
        
        assert overlapping_document.has_overlapping_subtitles()
    
    def test_get_timing_gaps_default_threshold(self):
        """Test getting timing gaps with default threshold."""
        gaps = self.document.get_timing_gaps()
        
        # Gap 1: between subtitle 1 (ends at 2.0) and subtitle 2 (starts at 3.0) = 1.0s
        # Gap 2: between subtitle 2 (ends at 5.0) and subtitle 3 (starts at 6.0) = 1.0s
        assert len(gaps) == 2
        assert gaps[0] == (0, 1, 1.0)  # Between indices 0 and 1, gap of 1.0s
        assert gaps[1] == (1, 2, 1.0)  # Between indices 1 and 2, gap of 1.0s
    
    def test_get_timing_gaps_custom_threshold(self):
        """Test getting timing gaps with custom threshold."""
        gaps = self.document.get_timing_gaps(min_gap=1.5)
        
        # With 1.5s threshold, 1.0s gaps should be ignored
        assert len(gaps) == 0
        
        gaps = self.document.get_timing_gaps(min_gap=0.5)
        
        # With 0.5s threshold, 1.0s gaps should be included
        assert len(gaps) == 2
    
    def test_get_timing_gaps_no_gaps(self):
        """Test getting timing gaps when subtitles are adjacent."""
        adjacent_subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First"),
            Subtitle.create(2, 2.0, 4.0, "Second"),  # Adjacent
            Subtitle.create(3, 4.0, 6.0, "Third")   # Adjacent
        ]
        
        adjacent_document = SubtitleDocument(
            subtitles=adjacent_subtitles,
            language="zh"
        )
        
        gaps = adjacent_document.get_timing_gaps()
        assert len(gaps) == 0


class TestSubtitleDocumentQualityAnalysis:
    """Test SubtitleDocument quality analysis methods."""
    
    def test_get_quality_issues_no_issues(self):
        """Test quality analysis when no issues exist."""
        good_subtitles = [
            Subtitle.create(1, 0.0, 2.0, "Good subtitle"),
            Subtitle.create(2, 3.0, 5.0, "Another good subtitle")
        ]
        
        document = SubtitleDocument(subtitles=good_subtitles, language="zh")
        issues = document.get_quality_issues()
        assert len(issues) == 0
    
    def test_get_quality_issues_overlapping(self):
        """Test quality analysis with overlapping subtitles."""
        overlapping_subtitles = [
            Subtitle.create(1, 0.0, 3.0, "First"),
            Subtitle.create(2, 2.0, 5.0, "Second")
        ]
        
        document = SubtitleDocument(subtitles=overlapping_subtitles, language="zh")
        issues = document.get_quality_issues()
        
        assert len(issues) >= 1
        assert any("overlapping" in issue.lower() for issue in issues)
    
    def test_get_quality_issues_short_subtitles(self):
        """Test quality analysis with short subtitles."""
        short_subtitles = [
            Subtitle.create(1, 0.0, 0.2, "Short"),  # 0.2s - too short
            Subtitle.create(2, 1.0, 3.0, "Normal duration")
        ]
        
        document = SubtitleDocument(subtitles=short_subtitles, language="zh")
        issues = document.get_quality_issues()
        
        assert len(issues) >= 1
        assert any("shorter than 0.5s" in issue for issue in issues)
    
    def test_get_quality_issues_long_subtitles(self):
        """Test quality analysis with long subtitles."""
        long_subtitles = [
            Subtitle.create(1, 0.0, 15.0, "Very long subtitle"),  # 15s - too long
            Subtitle.create(2, 16.0, 18.0, "Normal duration")
        ]
        
        document = SubtitleDocument(subtitles=long_subtitles, language="zh")
        issues = document.get_quality_issues()
        
        assert len(issues) >= 1
        assert any("longer than 10s" in issue for issue in issues)
    
    def test_get_quality_issues_long_text(self):
        """Test quality analysis with long text."""
        long_text = "A" * 100  # 100 characters - too long for display
        long_text_subtitles = [
            Subtitle.create(1, 0.0, 2.0, long_text),
            Subtitle.create(2, 3.0, 5.0, "Normal text")
        ]
        
        document = SubtitleDocument(subtitles=long_text_subtitles, language="zh")
        issues = document.get_quality_issues()
        
        assert len(issues) >= 1
        assert any("longer than 80 chars" in issue for issue in issues)
    
    def test_get_quality_issues_multiple_issues(self):
        """Test quality analysis with multiple types of issues."""
        problematic_subtitles = [
            Subtitle.create(1, 0.0, 0.3, "Short"),  # Too short
            Subtitle.create(2, 2.0, 15.0, "A" * 100),  # Too long duration and text
            Subtitle.create(3, 14.0, 16.0, "Overlap")  # Overlaps with previous
        ]
        
        document = SubtitleDocument(subtitles=problematic_subtitles, language="zh")
        issues = document.get_quality_issues()
        
        # Should detect multiple types of issues
        assert len(issues) >= 3
        issue_text = " ".join(issues).lower()
        assert "overlapping" in issue_text
        assert "shorter than" in issue_text
        assert "longer than" in issue_text


class TestSubtitleDocumentOutput:
    """Test SubtitleDocument output methods."""
    
    def setup_method(self):
        """Set up test data."""
        self.subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First subtitle"),
            Subtitle.create(2, 3.0, 5.0, "Second subtitle")
        ]
        self.document = SubtitleDocument(subtitles=self.subtitles, language="zh")
    
    def test_to_srt_content(self):
        """Test conversion to SRT content."""
        srt_content = self.document.to_srt_content()
        
        assert isinstance(srt_content, str)
        assert "1" in srt_content
        assert "00:00:00,000 --> 00:00:02,000" in srt_content
        assert "First subtitle" in srt_content
        assert "2" in srt_content
        assert "00:00:03,000 --> 00:00:05,000" in srt_content
        assert "Second subtitle" in srt_content
    
    @patch('builtins.open', create=True)
    def test_save_to_file(self, mock_open):
        """Test saving to file."""
        mock_file = MagicMock()
        mock_open.return_value.__enter__.return_value = mock_file
        
        output_path = FilePath.from_string("/path/to/output.srt")
        self.document.save_to_file(output_path)
        
        mock_open.assert_called_once_with(output_path.path, 'w', encoding='utf-8')
        mock_file.write.assert_called_once()
        
        # Verify the content written is SRT format
        written_content = mock_file.write.call_args[0][0]
        assert "First subtitle" in written_content
        assert "Second subtitle" in written_content
    
    def test_get_statistics(self):
        """Test getting document statistics."""
        stats = self.document.get_statistics()
        
        assert isinstance(stats, dict)
        assert stats["subtitle_count"] == 2
        assert stats["total_duration"] == 5.0  # From 0.0 to 5.0
        assert stats["average_subtitle_duration"] == 2.5  # 5.0 / 2
        assert stats["language"] == "zh"
        assert stats["has_overlaps"] is False
        assert stats["quality_issues"] == 0  # No issues in test data
    
    def test_get_statistics_with_issues(self):
        """Test statistics with quality issues."""
        problematic_subtitles = [
            Subtitle.create(1, 0.0, 0.3, "Short"),  # Short duration
            Subtitle.create(2, 1.0, 3.0, "Normal")
        ]
        
        document = SubtitleDocument(subtitles=problematic_subtitles, language="en")
        stats = document.get_statistics()
        
        assert stats["quality_issues"] > 0


class TestSubtitleDocumentStringRepresentation:
    """Test SubtitleDocument string representations."""
    
    def test_str_representation_no_source(self):
        """Test string representation without source file."""
        subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First"),
            Subtitle.create(2, 3.0, 8.0, "Second")
        ]
        document = SubtitleDocument(subtitles=subtitles, language="zh")
        
        str_repr = str(document)
        assert "SubtitleDocument(2 subtitles, 8.0s)" in str_repr
    
    def test_str_representation_with_source(self):
        """Test string representation with source file."""
        subtitles = [Subtitle.create(1, 0.0, 5.0, "Test")]
        source_file = FilePath.from_string("/path/to/video.mp4")
        document = SubtitleDocument(
            subtitles=subtitles,
            source_file=source_file,
            language="zh"
        )
        
        str_repr = str(document)
        assert "SubtitleDocument(1 subtitles, 5.0s from video.mp4)" in str_repr
    
    def test_repr_representation(self):
        """Test repr representation."""
        subtitles = [Subtitle.create(1, 0.0, 2.0, "Test")]
        document = SubtitleDocument(subtitles=subtitles, language="en")
        
        repr_str = repr(document)
        assert "SubtitleDocument(" in repr_str
        assert "subtitles=1" in repr_str
        assert "language='en'" in repr_str


class TestSubtitleDocumentEdgeCases:
    """Test SubtitleDocument edge cases."""
    
    def test_single_subtitle_document(self):
        """Test document with single subtitle."""
        subtitle = Subtitle.create(1, 10.0, 15.0, "Only subtitle")
        document = SubtitleDocument(subtitles=[subtitle], language="zh")
        
        assert document.get_subtitle_count() == 1
        assert document.get_total_duration() == 5.0
        assert not document.has_overlapping_subtitles()
        assert len(document.get_timing_gaps()) == 0
    
    def test_adjacent_subtitles_no_gaps(self):
        """Test document with perfectly adjacent subtitles."""
        subtitles = [
            Subtitle.create(1, 0.0, 2.0, "First"),
            Subtitle.create(2, 2.0, 4.0, "Second"),
            Subtitle.create(3, 4.0, 6.0, "Third")
        ]
        
        document = SubtitleDocument(subtitles=subtitles, language="zh")
        assert len(document.get_timing_gaps()) == 0
        assert not document.has_overlapping_subtitles()
    
    def test_minimal_timing_precision(self):
        """Test document with very precise timing."""
        subtitles = [
            Subtitle.create(1, 0.001, 0.502, "Precise start"),
            Subtitle.create(2, 0.503, 1.004, "Precise end")
        ]
        
        document = SubtitleDocument(subtitles=subtitles, language="zh")
        
        # Should handle precise timing correctly
        assert document.get_total_duration() == pytest.approx(1.003, abs=1e-10)
        gaps = document.get_timing_gaps(min_gap=0.0001)
        assert len(gaps) == 1
        assert gaps[0][2] == pytest.approx(0.001, abs=1e-10)  # Gap of 0.001s