"""
Comprehensive unit tests for GenerateSubtitlesCommand.
"""

import pytest
from unittest.mock import patch, MagicMock

from src.application.commands.generate_subtitles_command import GenerateSubtitlesCommand
from src.domain.value_objects.file_path import FilePath
from src.domain.value_objects.charset import Charset
from src.domain.value_objects.language_code import LanguageCode


class TestGenerateSubtitlesCommandCreation:
    """Test GenerateSubtitlesCommand creation and validation."""
    
    def test_create_valid_minimal_command(self):
        """Test creating command with minimal valid parameters."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        assert command.input_file_path == "/path/to/video.mp4"
        assert command.output_file_path is None
        assert command.language == "zh"
        assert command.model_name == "openai/whisper-large-v3"
        assert command.enable_speakers is False
        assert command.enable_written_style is False
        assert command.enable_music_detection is False
        assert command.charset == "traditional"
        assert command.enable_gemini_refinement is True
        assert command.gemini_api_key is None
        assert command.video_compression_quality == "360p"
        assert command.max_chunk_duration_minutes == 15
        assert command.terminology_config_path is None
        assert command.hf_token is None
        assert command.enable_translation is False
        assert command.translation_language is None
    
    def test_create_valid_full_command(self):
        """Test creating command with all parameters."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/path/to/output.srt",
            language="ja",
            model_name="openai/whisper-small",
            enable_speakers=True,
            enable_written_style=True,
            enable_music_detection=True,
            charset="simplified",
            enable_gemini_refinement=False,
            gemini_api_key="test-api-key",
            video_compression_quality="720p",
            max_chunk_duration_minutes=10,
            terminology_config_path="/path/to/config.json",
            hf_token="test-hf-token",
            enable_translation=True,
            translation_language="en_us"
        )
        
        assert command.input_file_path == "/path/to/video.mp4"
        assert command.output_file_path == "/path/to/output.srt"
        assert command.language == "ja"
        assert command.model_name == "openai/whisper-small"
        assert command.enable_speakers is True
        assert command.enable_written_style is True
        assert command.enable_music_detection is True
        assert command.charset == "simplified"
        assert command.enable_gemini_refinement is False
        assert command.gemini_api_key == "test-api-key"
        assert command.video_compression_quality == "720p"
        assert command.max_chunk_duration_minutes == 10
        assert command.terminology_config_path == "/path/to/config.json"
        assert command.hf_token == "test-hf-token"
        assert command.enable_translation is True
        assert command.translation_language == "en_us"
    
    def test_create_with_auto_model_selection(self):
        """Test creating command with auto model selection."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            model_name=None  # Auto-selection
        )
        
        assert command.model_name is None
    
    def test_create_empty_input_path_raises_error(self):
        """Test that empty input path raises ValueError."""
        with pytest.raises(ValueError, match="Input file path cannot be empty"):
            GenerateSubtitlesCommand(input_file_path="")
        
        with pytest.raises(ValueError, match="Input file path cannot be empty"):
            GenerateSubtitlesCommand(input_file_path="   ")
    
    def test_create_empty_output_path_raises_error(self):
        """Test that empty output path string raises ValueError."""
        with pytest.raises(ValueError, match="Output file path cannot be empty string"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                output_file_path=""
            )
        
        with pytest.raises(ValueError, match="Output file path cannot be empty string"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                output_file_path="   "
            )
    
    def test_create_empty_language_raises_error(self):
        """Test that empty language raises ValueError."""
        with pytest.raises(ValueError, match="Language cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                language=""
            )
        
        with pytest.raises(ValueError, match="Language cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                language="   "
            )
    
    def test_create_empty_model_name_raises_error(self):
        """Test that empty model name string raises ValueError."""
        with pytest.raises(ValueError, match="Model name cannot be empty string"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                model_name=""
            )
        
        with pytest.raises(ValueError, match="Model name cannot be empty string"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                model_name="   "
            )
    
    def test_create_empty_charset_raises_error(self):
        """Test that empty charset raises ValueError."""
        with pytest.raises(ValueError, match="Charset cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                charset=""
            )
        
        with pytest.raises(ValueError, match="Charset cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                charset="   "
            )
    
    def test_create_empty_video_quality_raises_error(self):
        """Test that empty video compression quality raises ValueError."""
        with pytest.raises(ValueError, match="Video compression quality cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                video_compression_quality=""
            )
        
        with pytest.raises(ValueError, match="Video compression quality cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                video_compression_quality="   "
            )
    
    def test_create_invalid_chunk_duration_raises_error(self):
        """Test that invalid chunk duration raises ValueError."""
        with pytest.raises(ValueError, match="Max chunk duration must be positive"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                max_chunk_duration_minutes=0
            )
        
        with pytest.raises(ValueError, match="Max chunk duration must be positive"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                max_chunk_duration_minutes=-5
            )
    
    def test_create_translation_enabled_without_language_raises_error(self):
        """Test that enabling translation without language raises ValueError."""
        with pytest.raises(ValueError, match="Translation language must be specified when translation is enabled"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                enable_translation=True,
                translation_language=None
            )
    
    def test_create_empty_translation_language_raises_error(self):
        """Test that empty translation language raises ValueError."""
        with pytest.raises(ValueError, match="Translation language must be specified when translation is enabled"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                enable_translation=True,
                translation_language=""
            )
        
        with pytest.raises(ValueError, match="Translation language cannot be empty string"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                enable_translation=True,
                translation_language="   "
            )
    
    @patch('src.domain.value_objects.language_code.LanguageCode.is_supported')
    def test_create_unsupported_translation_language_raises_error(self, mock_is_supported):
        """Test that unsupported translation language raises ValueError."""
        mock_is_supported.return_value = False
        
        with pytest.raises(ValueError, match="Unsupported translation language: invalid_lang"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                enable_translation=True,
                translation_language="invalid_lang"
            )
        
        mock_is_supported.assert_called_once_with("invalid_lang")


class TestGenerateSubtitlesCommandPathMethods:
    """Test GenerateSubtitlesCommand path-related methods."""
    
    def test_get_input_file_path(self):
        """Test getting input file path as FilePath object."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        input_path = command.get_input_file_path()
        assert isinstance(input_path, FilePath)
        assert input_path.path == "/path/to/video.mp4"
    
    def test_get_output_file_path_custom(self):
        """Test getting custom output file path."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/custom/output.srt"
        )
        
        output_path = command.get_output_file_path()
        assert isinstance(output_path, FilePath)
        assert output_path.path == "/custom/output.srt"
    
    def test_get_output_file_path_none(self):
        """Test getting output file path when None."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        output_path = command.get_output_file_path()
        assert output_path is None
    
    def test_get_default_output_path(self):
        """Test getting default output path."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        default_path = command.get_default_output_path()
        assert isinstance(default_path, FilePath)
        # Should generate SRT path based on input
        assert default_path.get_extension() == ".srt"
        assert "video" in default_path.get_stem()
    
    def test_get_effective_output_path_custom(self):
        """Test getting effective output path when custom is set."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/custom/output.srt"
        )
        
        effective_path = command.get_effective_output_path()
        assert isinstance(effective_path, FilePath)
        assert effective_path.path == "/custom/output.srt"
    
    def test_get_effective_output_path_default(self):
        """Test getting effective output path when using default."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        effective_path = command.get_effective_output_path()
        default_path = command.get_default_output_path()
        
        assert effective_path.path == default_path.path


class TestGenerateSubtitlesCommandValueObjectMethods:
    """Test GenerateSubtitlesCommand value object conversion methods."""
    
    def test_get_charset_traditional(self):
        """Test getting charset as Charset object for traditional."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            charset="traditional"
        )
        
        charset = command.get_charset()
        assert isinstance(charset, Charset)
        # Verify charset value (depends on Charset implementation)
    
    def test_get_charset_simplified(self):
        """Test getting charset as Charset object for simplified."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            charset="simplified"
        )
        
        charset = command.get_charset()
        assert isinstance(charset, Charset)
    
    def test_get_language_style_written(self):
        """Test getting language style for written style."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_written_style=True
        )
        
        style = command.get_language_style()
        assert style == "written"
    
    def test_get_language_style_colloquial(self):
        """Test getting language style for colloquial style."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_written_style=False
        )
        
        style = command.get_language_style()
        assert style == "colloquial"
    
    @patch('src.domain.value_objects.language_code.LanguageCode.from_string')
    def test_get_translation_language_valid(self, mock_from_string):
        """Test getting translation language as LanguageCode object."""
        mock_language_code = MagicMock()
        mock_from_string.return_value = mock_language_code
        
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_translation=True,
            translation_language="en_us"
        )
        
        language_code = command.get_translation_language()
        assert language_code == mock_language_code
        mock_from_string.assert_called_once_with("en_us")
    
    def test_get_translation_language_none(self):
        """Test getting translation language when None."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        language_code = command.get_translation_language()
        assert language_code is None


class TestGenerateSubtitlesCommandFeatureFlags:
    """Test GenerateSubtitlesCommand feature flag methods."""
    
    def test_requires_translation_true(self):
        """Test requires_translation when translation is enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_translation=True,
            translation_language="en_us"
        )
        
        assert command.requires_translation() is True
    
    def test_requires_translation_false_disabled(self):
        """Test requires_translation when translation is disabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_translation=False,
            translation_language="en_us"
        )
        
        assert command.requires_translation() is False
    
    def test_requires_translation_false_no_language(self):
        """Test requires_translation when no language is set."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_translation=False,
            translation_language=None
        )
        
        assert command.requires_translation() is False
    
    def test_requires_gemini_flash_speakers(self):
        """Test requires_gemini_flash when speakers enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_speakers=True,
            enable_gemini_refinement=False
        )
        
        assert command.requires_gemini_flash() is True
    
    def test_requires_gemini_flash_refinement(self):
        """Test requires_gemini_flash when refinement enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_speakers=False,
            enable_gemini_refinement=True
        )
        
        assert command.requires_gemini_flash() is True
    
    def test_requires_gemini_flash_translation(self):
        """Test requires_gemini_flash when translation enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_speakers=False,
            enable_gemini_refinement=False,
            enable_translation=True,
            translation_language="en_us"
        )
        
        assert command.requires_gemini_flash() is True
    
    def test_requires_gemini_flash_false(self):
        """Test requires_gemini_flash when no Gemini features enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_speakers=False,
            enable_gemini_refinement=False,
            enable_translation=False
        )
        
        assert command.requires_gemini_flash() is False
    
    def test_has_phase2_features_speakers(self):
        """Test has_phase2_features with speakers enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_speakers=True
        )
        
        assert command.has_phase2_features() is True
    
    def test_has_phase2_features_written_style(self):
        """Test has_phase2_features with written style enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_written_style=True
        )
        
        assert command.has_phase2_features() is True
    
    def test_has_phase2_features_music_detection(self):
        """Test has_phase2_features with music detection enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_music_detection=True
        )
        
        assert command.has_phase2_features() is True
    
    def test_has_phase2_features_gemini_refinement(self):
        """Test has_phase2_features with Gemini refinement enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_gemini_refinement=True
        )
        
        assert command.has_phase2_features() is True
    
    def test_has_phase2_features_translation(self):
        """Test has_phase2_features with translation enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_translation=True,
            translation_language="en_us"
        )
        
        assert command.has_phase2_features() is True
    
    def test_has_phase2_features_false(self):
        """Test has_phase2_features when no phase 2 features enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            enable_gemini_refinement=False,
            enable_translation=False
        )
        
        assert command.has_phase2_features() is False


class TestGenerateSubtitlesCommandValidation:
    """Test GenerateSubtitlesCommand validation methods."""
    
    @patch.object(FilePath, 'validate_exists')
    @patch.object(FilePath, 'validate_is_file')
    @patch.object(FilePath, 'validate_supported_format')
    @patch.object(FilePath, 'exists')
    @patch.object(FilePath, 'is_dir')
    def test_validate_paths_success(self, mock_is_dir, mock_exists, 
                                   mock_validate_supported, mock_validate_is_file, 
                                   mock_validate_exists):
        """Test successful path validation."""
        # Mock all validations to pass
        mock_validate_exists.return_value = None
        mock_validate_is_file.return_value = None
        mock_validate_supported.return_value = None
        mock_exists.return_value = True
        mock_is_dir.return_value = True
        
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/output/result.srt"
        )
        
        # Should not raise exception
        command.validate_paths()
        
        # Verify input file validations were called
        mock_validate_exists.assert_called_once()
        mock_validate_is_file.assert_called_once()
        mock_validate_supported.assert_called_once()
        
        # Verify output directory validations were called
        assert mock_exists.call_count >= 1
        assert mock_is_dir.call_count >= 1
    
    @patch.object(FilePath, 'validate_exists')
    def test_validate_paths_input_not_exists(self, mock_validate_exists):
        """Test path validation when input file doesn't exist."""
        mock_validate_exists.side_effect = FileNotFoundError("File not found")
        
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/nonexistent.mp4"
        )
        
        with pytest.raises(FileNotFoundError, match="File not found"):
            command.validate_paths()
    
    @patch.object(FilePath, 'validate_exists')
    @patch.object(FilePath, 'validate_is_file')
    def test_validate_paths_input_not_file(self, mock_validate_is_file, mock_validate_exists):
        """Test path validation when input is not a file."""
        mock_validate_exists.return_value = None
        mock_validate_is_file.side_effect = ValueError("Path is not a file")
        
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/directory"
        )
        
        with pytest.raises(ValueError, match="Path is not a file"):
            command.validate_paths()
    
    @patch.object(FilePath, 'validate_exists')
    @patch.object(FilePath, 'validate_is_file')
    @patch.object(FilePath, 'validate_supported_format')
    def test_validate_paths_unsupported_format(self, mock_validate_supported, 
                                             mock_validate_is_file, mock_validate_exists):
        """Test path validation with unsupported format."""
        mock_validate_exists.return_value = None
        mock_validate_is_file.return_value = None
        mock_validate_supported.side_effect = ValueError("Unsupported file format")
        
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/file.txt"
        )
        
        with pytest.raises(ValueError, match="Unsupported file format"):
            command.validate_paths()
    
    @patch.object(FilePath, 'validate_exists')
    @patch.object(FilePath, 'validate_is_file')
    @patch.object(FilePath, 'validate_supported_format')
    @patch.object(FilePath, 'exists')
    def test_validate_paths_output_dir_not_exists(self, mock_exists, mock_validate_supported,
                                                 mock_validate_is_file, mock_validate_exists):
        """Test path validation when output directory doesn't exist."""
        # Input validations pass
        mock_validate_exists.return_value = None
        mock_validate_is_file.return_value = None
        mock_validate_supported.return_value = None
        
        # Output directory doesn't exist
        mock_exists.return_value = False
        
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/nonexistent/output.srt"
        )
        
        with pytest.raises(FileNotFoundError, match="Output directory does not exist"):
            command.validate_paths()
    
    @patch.object(FilePath, 'validate_exists')
    @patch.object(FilePath, 'validate_is_file')
    @patch.object(FilePath, 'validate_supported_format')
    @patch.object(FilePath, 'exists')
    @patch.object(FilePath, 'is_dir')
    def test_validate_paths_output_not_dir(self, mock_is_dir, mock_exists, 
                                         mock_validate_supported, mock_validate_is_file, 
                                         mock_validate_exists):
        """Test path validation when output path is not a directory."""
        # Input validations pass
        mock_validate_exists.return_value = None
        mock_validate_is_file.return_value = None
        mock_validate_supported.return_value = None
        
        # Output parent exists but is not a directory
        mock_exists.return_value = True
        mock_is_dir.return_value = False
        
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/path/to/file.txt/output.srt"
        )
        
        with pytest.raises(ValueError, match="Output path is not a directory"):
            command.validate_paths()


class TestGenerateSubtitlesCommandStringRepresentation:
    """Test GenerateSubtitlesCommand string representations."""
    
    def test_str_representation_with_output(self):
        """Test string representation with custom output path."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/custom/output.srt",
            language="ja"
        )
        
        str_repr = str(command)
        assert "GenerateSubtitlesCommand(" in str_repr
        assert "input='/path/to/video.mp4'" in str_repr
        assert "output='/custom/output.srt'" in str_repr
        assert "lang='ja'" in str_repr
    
    def test_str_representation_auto_output(self):
        """Test string representation with auto output path."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        str_repr = str(command)
        assert "output='auto'" in str_repr
    
    def test_repr_representation(self):
        """Test repr representation."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/output.srt",
            language="zh",
            model_name="openai/whisper-small",
            enable_speakers=True
        )
        
        repr_str = repr(command)
        assert "GenerateSubtitlesCommand(" in repr_str
        assert "input_file_path='/path/to/video.mp4'" in repr_str
        assert "output_file_path='/output.srt'" in repr_str
        assert "language='zh'" in repr_str
        assert "model_name='openai/whisper-small'" in repr_str
        assert "gemini_enabled=True" in repr_str  # Because speakers is enabled


class TestGenerateSubtitlesCommandImmutability:
    """Test GenerateSubtitlesCommand immutability."""
    
    def test_frozen_dataclass(self):
        """Test that GenerateSubtitlesCommand is immutable (frozen dataclass)."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        with pytest.raises(AttributeError):
            command.input_file_path = "/different/path.mp4"
        
        with pytest.raises(AttributeError):
            command.enable_speakers = True


class TestGenerateSubtitlesCommandEdgeCases:
    """Test GenerateSubtitlesCommand edge cases."""
    
    def test_unicode_paths(self):
        """Test command with Unicode characters in paths."""
        command = GenerateSubtitlesCommand(
            input_file_path="/路径/到/视频.mp4",
            output_file_path="/输出/字幕.srt"
        )
        
        input_path = command.get_input_file_path()
        output_path = command.get_output_file_path()
        
        assert "视频" in input_path.get_name()
        assert "字幕" in output_path.get_name()
    
    def test_very_long_paths(self):
        """Test command with very long file paths."""
        long_path = "/very/long/path/" + "a" * 200 + "/video.mp4"
        
        command = GenerateSubtitlesCommand(
            input_file_path=long_path
        )
        
        input_path = command.get_input_file_path()
        assert len(input_path.path) > 200
    
    def test_special_characters_in_paths(self):
        """Test command with special characters in paths."""
        special_path = "/path with spaces/file & symbols!@#$.mp4"
        
        command = GenerateSubtitlesCommand(
            input_file_path=special_path
        )
        
        input_path = command.get_input_file_path()
        assert "file & symbols!@#$" in input_path.get_name()
    
    def test_model_name_variations(self):
        """Test command with various model name formats."""
        model_names = [
            "openai/whisper-tiny",
            "openai/whisper-base",
            "openai/whisper-small", 
            "openai/whisper-medium",
            "openai/whisper-large-v3",
            "whisperX/large-v3"
        ]
        
        for model_name in model_names:
            command = GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                model_name=model_name
            )
            assert command.model_name == model_name
    
    def test_extreme_chunk_duration(self):
        """Test command with extreme chunk duration values."""
        # Very small chunk duration
        command1 = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            max_chunk_duration_minutes=1
        )
        assert command1.max_chunk_duration_minutes == 1
        
        # Very large chunk duration
        command2 = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            max_chunk_duration_minutes=1000
        )
        assert command2.max_chunk_duration_minutes == 1000
    
    def test_all_boolean_combinations(self):
        """Test command with all possible boolean flag combinations."""
        boolean_flags = [
            'enable_speakers',
            'enable_written_style', 
            'enable_music_detection',
            'enable_gemini_refinement',
            'enable_translation'
        ]
        
        # Test a few combinations
        test_combinations = [
            [True, False, True, False, False],
            [False, True, False, True, False],
            [True, True, True, True, False],  # Can't enable translation without language
            [False, False, False, False, False]
        ]
        
        for combination in test_combinations:
            kwargs = dict(zip(boolean_flags, combination))
            
            # Handle translation special case
            if kwargs['enable_translation']:
                kwargs['translation_language'] = 'en_us'
            
            command = GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                **kwargs
            )
            
            # Verify all flags are set correctly
            for flag, expected_value in zip(boolean_flags, combination):
                assert getattr(command, flag) == expected_value


class TestGenerateSubtitlesCommandComplexScenarios:
    """Test GenerateSubtitlesCommand in complex usage scenarios."""
    
    def test_full_feature_command(self):
        """Test command with all features enabled."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/long_video.mkv",
            output_file_path="/output/subtitles.srt",
            language="zh",
            model_name="openai/whisper-large-v3",
            enable_speakers=True,
            enable_written_style=True,
            enable_music_detection=True,
            charset="simplified",
            enable_gemini_refinement=True,
            gemini_api_key="sk-test-key",
            video_compression_quality="720p",
            max_chunk_duration_minutes=5,
            terminology_config_path="/config/terminology.json",
            hf_token="hf_test_token",
            enable_translation=True,
            translation_language="en_us"
        )
        
        # Verify all features are properly configured
        assert command.has_phase2_features() is True
        assert command.requires_gemini_flash() is True
        assert command.requires_translation() is True
        
        # Verify derived values
        assert command.get_language_style() == "written"
        assert command.get_translation_language() is not None
        assert command.get_charset() is not None
    
    def test_minimal_performance_command(self):
        """Test command optimized for minimal performance impact."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            model_name="openai/whisper-tiny",  # Fastest model
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            enable_gemini_refinement=False,
            enable_translation=False,
            max_chunk_duration_minutes=30  # Large chunks for efficiency
        )
        
        # Verify minimal configuration
        assert command.has_phase2_features() is False
        assert command.requires_gemini_flash() is False
        assert command.requires_translation() is False
        assert command.model_name == "openai/whisper-tiny"
    
    def test_enterprise_configuration(self):
        """Test command configured for enterprise use."""
        command = GenerateSubtitlesCommand(
            input_file_path="/enterprise/media/presentation.mp4",
            output_file_path="/enterprise/output/presentation_subtitles.srt",
            language="zh",
            model_name="openai/whisper-large-v3",
            enable_speakers=True,  # For meeting transcription
            enable_written_style=True,  # Professional language
            enable_music_detection=False,  # Not needed for presentations
            charset="simplified",  # For wider readability
            enable_gemini_refinement=True,  # Quality improvement
            video_compression_quality="480p",  # Balance quality/processing
            max_chunk_duration_minutes=10,  # Manageable chunks
            terminology_config_path="/enterprise/config/business_terms.json",
            enable_translation=True,
            translation_language="en_us"  # For international audience
        )
        
        # Verify enterprise features
        assert command.has_phase2_features() is True
        assert command.requires_gemini_flash() is True
        assert command.requires_translation() is True
        assert command.enable_written_style is True
        assert command.terminology_config_path is not None