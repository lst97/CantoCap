"""
Unit tests for JsonSubtitleService.
"""

import pytest
import json
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from src.infrastructure.services.json_subtitle_service import (
    JsonSubtitleService,
    JsonSubtitleMetadata,
    JsonSubtitleEntry,
    JsonSubtitleDocument
)
from src.domain.entities.subtitle import SubtitleDocument, Subtitle
from src.domain.value_objects.timestamp import Timestamp
from src.domain.value_objects.file_path import FilePath
from src.application.commands.generate_subtitles_command import GenerateSubtitlesCommand
from src.infrastructure.error_handling import TranscriptionError


class TestJsonSubtitleEntry:
    """Test JsonSubtitleEntry functionality."""
    
    def test_create_entry_with_translation(self):
        """Test creating entry with translation."""
        entry = JsonSubtitleEntry(
            index=1,
            start_time=0.0,
            end_time=2.5,
            duration=2.5,
            caption="你好世界",
            translation="Hello World"
        )
        
        result = entry.to_dict()
        
        assert result == {
            "index": 1,
            "startTime": 0.0,
            "endTime": 2.5,
            "duration": 2.5,
            "caption": "你好世界",
            "translation": "Hello World"
        }
    
    def test_create_entry_without_translation(self):
        """Test creating entry without translation."""
        entry = JsonSubtitleEntry(
            index=1,
            start_time=0.0,
            end_time=2.5,
            duration=2.5,
            caption="你好世界"
        )
        
        result = entry.to_dict()
        
        assert result == {
            "index": 1,
            "startTime": 0.0,
            "endTime": 2.5,
            "duration": 2.5,
            "caption": "你好世界"
        }
        assert "translation" not in result


class TestJsonSubtitleMetadata:
    """Test JsonSubtitleMetadata functionality."""
    
    def test_create_metadata_with_defaults(self):
        """Test creating metadata with default values."""
        metadata = JsonSubtitleMetadata()
        
        assert metadata.format == "CantoCap JSON Subtitle Export"
        assert metadata.version == "1.0"
        assert metadata.generated_at != ""
        assert metadata.settings == {}
        assert metadata.statistics == {}
    
    def test_create_metadata_with_custom_values(self):
        """Test creating metadata with custom values."""
        custom_time = "2025-07-30T09:48:57.254Z"
        settings = {"includeEnglish": True}
        stats = {"totalSubtitles": 10}
        
        metadata = JsonSubtitleMetadata(
            generated_at=custom_time,
            settings=settings,
            statistics=stats
        )
        
        assert metadata.generated_at == custom_time
        assert metadata.settings == settings
        assert metadata.statistics == stats


class TestJsonSubtitleDocument:
    """Test JsonSubtitleDocument functionality."""
    
    def test_to_dict_conversion(self):
        """Test converting document to dictionary."""
        metadata = JsonSubtitleMetadata(
            settings={"includeEnglish": True},
            statistics={"totalSubtitles": 1}
        )
        
        subtitles = [
            JsonSubtitleEntry(
                index=1,
                start_time=0.0,
                end_time=2.5,
                duration=2.5,
                caption="Test caption"
            )
        ]
        
        doc = JsonSubtitleDocument(metadata=metadata, subtitles=subtitles)
        result = doc.to_dict()
        
        assert "metadata" in result
        assert "subtitles" in result
        assert result["metadata"]["format"] == "CantoCap JSON Subtitle Export"
        assert result["metadata"]["settings"]["includeEnglish"] is True
        assert len(result["subtitles"]) == 1
        assert result["subtitles"][0]["caption"] == "Test caption"
    
    def test_to_json_conversion(self):
        """Test converting document to JSON string."""
        metadata = JsonSubtitleMetadata()
        subtitles = [
            JsonSubtitleEntry(
                index=1,
                start_time=0.0,
                end_time=2.5,
                duration=2.5,
                caption="测试"
            )
        ]
        
        doc = JsonSubtitleDocument(metadata=metadata, subtitles=subtitles)
        json_str = doc.to_json()
        
        # Verify it's valid JSON
        parsed = json.loads(json_str)
        assert parsed["subtitles"][0]["caption"] == "测试"
        
        # Test with indentation
        json_str_pretty = doc.to_json(indent=2)
        assert "\n" in json_str_pretty


class TestJsonSubtitleService:
    """Test JsonSubtitleService functionality."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.service = JsonSubtitleService()
        
        # Create test subtitle document
        self.test_subtitles = [
            Subtitle.create(
                index=1,
                start_seconds=0.0,
                end_seconds=2.5,
                content="你好，世界！"
            ),
            Subtitle.create(
                index=2,
                start_seconds=3.0,
                end_seconds=5.5,
                content="这是测试字幕。"
            )
        ]
        
        self.test_document = SubtitleDocument.create(
            subtitles=self.test_subtitles,
            source_file=FilePath.from_string("/test/video.mp4"),
            language="zh"
        )
        
        # Create test command
        self.test_command = GenerateSubtitlesCommand(
            input_file_path="/test/video.mp4",
            output_file_path="/test/output.srt",
            language="zh",
            enable_translation=False
        )
    
    def test_extract_settings_from_command_basic(self):
        """Test extracting basic settings from command."""
        settings = self.service._extract_settings_from_command(self.test_command)
        
        assert settings["includeCantonese"] is True
        assert settings["includeEnglish"] is False
        assert settings["includeTimestampMetadata"] is False
        assert settings["language"] == "zh"
        assert settings["charset"] == "traditional"
        assert settings["model_name"] == "openai/whisper-large-v3"
    
    def test_extract_settings_with_translation(self):
        """Test extracting settings with translation enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/test/video.mp4",
            enable_translation=True,
            translation_language="en_us"
        )
        
        settings = self.service._extract_settings_from_command(command)
        
        assert settings["includeEnglish"] is True
        assert settings["enable_translation"] is True
        assert settings["translation_language"] == "en_us"
    
    def test_extract_settings_with_advanced_features(self):
        """Test extracting settings with advanced features."""
        command = GenerateSubtitlesCommand(
            input_file_path="/test/video.mp4",
            enable_speakers=True,
            enable_written_style=True,
            enable_music_detection=True,
            enable_gemini_refinement=True
        )
        
        settings = self.service._extract_settings_from_command(command)
        
        assert settings["enable_speakers"] is True
        assert settings["enable_written_style"] is True
        assert settings["enable_music_detection"] is True
        assert settings["enable_gemini_refinement"] is True
    
    def test_process_statistics_basic(self):
        """Test processing basic statistics."""
        stats = self.service._process_statistics(self.test_document, None)
        
        assert stats["totalSubtitles"] == 2
        assert stats["totalDuration"] == 5.5
        assert stats["averageConfidence"] == 0.0
    
    def test_process_statistics_enhanced(self):
        """Test processing enhanced statistics."""
        input_stats = {
            "quality_score": 0.95,
            "quality_grade": "A",
            "processing_confidence": 0.88,
            "quality_breakdown": {
                "technical": 0.96,
                "linguistic": 0.94
            },
            "translation_coverage": 0.92,
            "algorithm_version": "v2.0"
        }
        
        stats = self.service._process_statistics(self.test_document, input_stats)
        
        assert stats["qualityScore"] == 0.95
        assert stats["qualityGrade"] == "A"
        assert stats["averageConfidence"] == 0.88
        assert stats["qualityBreakdown"]["technical"] == 0.96
        assert stats["translationCoverage"] == 0.92
        assert stats["algorithmVersion"] == "v2.0"
    
    def test_convert_subtitles_single_language(self):
        """Test converting single-language subtitles."""
        json_subtitles = self.service._convert_subtitles(self.test_document)
        
        assert len(json_subtitles) == 2
        
        first_subtitle = json_subtitles[0]
        assert first_subtitle.index == 1
        assert first_subtitle.start_time == 0.0
        assert first_subtitle.end_time == 2.5
        assert first_subtitle.duration == 2.5
        assert first_subtitle.caption == "你好，世界！"
        assert first_subtitle.translation is None
    
    def test_convert_subtitles_dual_language(self):
        """Test converting dual-language subtitles."""
        # Create dual-language subtitle document
        dual_language_subtitles = [
            Subtitle.create(
                index=1,
                start_seconds=0.0,
                end_seconds=2.5,
                content="你好，世界！\nHello, World!"
            )
        ]
        
        dual_document = SubtitleDocument.create(
            subtitles=dual_language_subtitles,
            source_file=FilePath.from_string("/test/video.mp4"),
            language="zh+en"
        )
        
        json_subtitles = self.service._convert_subtitles(dual_document)
        
        assert len(json_subtitles) == 1
        subtitle = json_subtitles[0]
        assert subtitle.caption == "你好，世界！"
        assert subtitle.translation == "Hello, World!"
    
    def test_extract_dual_language_content_single(self):
        """Test extracting content from single-language text."""
        caption, translation = self.service._extract_dual_language_content("你好世界")
        
        assert caption == "你好世界"
        assert translation is None
    
    def test_extract_dual_language_content_dual(self):
        """Test extracting content from dual-language text."""
        content = "你好世界\nHello World"
        caption, translation = self.service._extract_dual_language_content(content)
        
        assert caption == "你好世界"
        assert translation == "Hello World"
    
    def test_extract_dual_language_content_mixed_lines(self):
        """Test extracting content with mixed language lines."""
        content = "你好世界\nHello World\n再见\nGoodbye"
        caption, translation = self.service._extract_dual_language_content(content)
        
        assert "你好世界" in caption
        assert "再见" in caption
        assert "Hello World" in translation
        assert "Goodbye" in translation
    
    def test_convert_subtitle_document_success(self):
        """Test successful subtitle document conversion."""
        test_stats = {
            "quality_score": 0.95,
            "processing_confidence": 0.88
        }
        
        result = self.service.convert_subtitle_document(
            self.test_document,
            self.test_command,
            test_stats
        )
        
        assert isinstance(result, JsonSubtitleDocument)
        assert result.metadata.format == "CantoCap JSON Subtitle Export"
        assert len(result.subtitles) == 2
        assert result.metadata.statistics["qualityScore"] == 0.95
        assert result.metadata.settings["language"] == "zh"
    
    def test_convert_subtitle_document_error_handling(self):
        """Test error handling in subtitle document conversion."""
        # Create a problematic command that will cause an error
        with patch.object(self.service, '_extract_settings_from_command', side_effect=Exception("Test error")):
            with pytest.raises(TranscriptionError) as exc_info:
                self.service.convert_subtitle_document(
                    self.test_document,
                    self.test_command,
                    {}
                )
            
            assert "Failed to convert subtitle document to JSON" in str(exc_info.value)
            assert exc_info.value.details["subtitle_count"] == 2
            assert exc_info.value.details["language"] == "zh"
    
    def test_create_json_response_success(self):
        """Test successful JSON response creation."""
        test_stats = {
            "quality_score": 0.95,
            "processing_time": 45.2
        }
        
        response = self.service.create_json_response(
            subtitle_document=self.test_document,
            command=self.test_command,
            statistics=test_stats,
            output_file_path="/test/output.srt"
        )
        
        assert "subtitle_data" in response
        assert "processing_info" in response
        
        subtitle_data = response["subtitle_data"]
        assert subtitle_data["metadata"]["format"] == "CantoCap JSON Subtitle Export"
        assert len(subtitle_data["subtitles"]) == 2
        
        processing_info = response["processing_info"]
        assert processing_info["success"] is True
        assert processing_info["input_file"] == "/test/video.mp4"
        assert processing_info["output_file"] == "/test/output.srt"
        assert processing_info["language"] == "zh"
    
    def test_create_json_response_error_handling(self):
        """Test error handling in JSON response creation."""
        with patch.object(self.service, 'convert_subtitle_document', side_effect=Exception("Conversion error")):
            response = self.service.create_json_response(
                subtitle_document=self.test_document,
                command=self.test_command,
                statistics={},
                output_file_path="/test/output.srt"
            )
            
            assert response["subtitle_data"] is None
            assert response["processing_info"]["success"] is False
            assert "Conversion error" in response["processing_info"]["error"]
    
    def test_json_serialization_compatibility(self):
        """Test that generated JSON is properly serializable."""
        result = self.service.convert_subtitle_document(
            self.test_document,
            self.test_command,
            {"quality_score": 0.95}
        )
        
        # Convert to JSON and back to ensure serialization works
        json_str = result.to_json()
        parsed = json.loads(json_str)
        
        assert parsed["metadata"]["format"] == "CantoCap JSON Subtitle Export"
        assert len(parsed["subtitles"]) == 2
        assert parsed["subtitles"][0]["caption"] == "你好，世界！"
        
        # Verify Chinese characters are preserved
        assert "你好，世界！" in json_str
    
    def test_edge_case_empty_content(self):
        """Test handling of edge cases like empty content."""
        # Test empty content extraction
        caption, translation = self.service._extract_dual_language_content("")
        assert caption == ""
        assert translation is None
        
        # Test whitespace-only content
        caption, translation = self.service._extract_dual_language_content("   \n   ")
        assert caption.strip() == ""
        assert translation is None
    
    def test_edge_case_speaker_labels(self):
        """Test handling of speaker labels in content."""
        content = "[SPEAKER_01] 你好世界\n[SPEAKER_01] Hello World"
        caption, translation = self.service._extract_dual_language_content(content)
        
        # Speaker labels should be filtered out during language detection
        assert "你好世界" in caption
        assert "Hello World" in translation
        assert "[SPEAKER_01]" not in caption
        assert "[SPEAKER_01]" not in translation
    
    @patch('src.infrastructure.services.json_subtitle_service.datetime')
    def test_metadata_timestamp_generation(self, mock_datetime):
        """Test that metadata timestamp is properly generated."""
        fixed_time = datetime(2025, 7, 30, 9, 48, 57, 254000, timezone.utc)
        mock_datetime.now.return_value = fixed_time
        mock_datetime.timezone = timezone
        
        metadata = JsonSubtitleMetadata()
        
        assert metadata.generated_at == "2025-07-30T09:48:57.254000+00:00"