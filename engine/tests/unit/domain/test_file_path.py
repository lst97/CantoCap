"""
Comprehensive unit tests for FilePath value object.
"""

import pytest
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.domain.value_objects.file_path import FilePath


class TestFilePathCreation:
    """Test FilePath creation and validation."""
    
    def test_create_from_string_valid(self):
        """Test creating FilePath from valid string."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        assert file_path.path == os.path.normpath("/path/to/file.mp4")
    
    def test_create_from_string_normalized(self):
        """Test that path is normalized on creation."""
        # Test with mixed separators and redundant parts
        file_path = FilePath.from_string("/path//to/../to/./file.mp4")
        expected = os.path.normpath("/path/to/file.mp4")
        assert file_path.path == expected
    
    def test_create_from_string_empty_raises_error(self):
        """Test that empty string raises ValueError."""
        with pytest.raises(ValueError, match="File path cannot be empty"):
            FilePath.from_string("")
    
    def test_create_from_string_whitespace_only_raises_error(self):
        """Test that whitespace-only string raises ValueError."""
        with pytest.raises(ValueError, match="File path cannot be empty"):
            FilePath.from_string("   ")
    
    def test_create_from_pathlib_valid(self):
        """Test creating FilePath from pathlib.Path."""
        pathlib_path = Path("/path/to/file.mp3")
        file_path = FilePath.from_pathlib(pathlib_path)
        assert file_path.path == str(pathlib_path)
    
    def test_direct_construction_valid(self):
        """Test direct construction with valid path."""
        file_path = FilePath(path="/path/to/file.wav")
        assert file_path.path == os.path.normpath("/path/to/file.wav")
    
    def test_direct_construction_normalization(self):
        """Test that direct construction normalizes path."""
        file_path = FilePath(path="/path//to/../file.mkv")
        expected = os.path.normpath("/path/file.mkv")
        assert file_path.path == expected


class TestFilePathConversion:
    """Test FilePath conversion methods."""
    
    def test_to_pathlib(self):
        """Test conversion to pathlib.Path."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        pathlib_path = file_path.to_pathlib()
        assert isinstance(pathlib_path, Path)
        assert str(pathlib_path) == file_path.path
    
    def test_to_pathlib_round_trip(self):
        """Test round trip conversion maintains consistency."""
        original_path = "/path/to/file.avi"
        file_path = FilePath.from_string(original_path)
        pathlib_path = file_path.to_pathlib()
        file_path2 = FilePath.from_pathlib(pathlib_path)
        assert file_path.path == file_path2.path


class TestFilePathInformation:
    """Test FilePath information extraction methods."""
    
    def test_get_extension_lowercase(self):
        """Test getting file extension in lowercase."""
        test_cases = [
            ("/path/to/file.MP4", ".mp4"),
            ("/path/to/file.AVI", ".avi"),
            ("/path/to/file.wav", ".wav"),
            ("/path/to/file", ""),
            ("/path/to/file.tar.gz", ".gz")
        ]
        
        for path, expected_ext in test_cases:
            file_path = FilePath.from_string(path)
            assert file_path.get_extension() == expected_ext
    
    def test_get_name(self):
        """Test getting file name without directory."""
        test_cases = [
            ("/path/to/file.mp4", "file.mp4"),
            ("/file.avi", "file.avi"),
            ("file.wav", "file.wav"),
            ("/path/to/directory/", "directory")
        ]
        
        for path, expected_name in test_cases:
            file_path = FilePath.from_string(path)
            assert file_path.get_name() == expected_name
    
    def test_get_stem(self):
        """Test getting file name without extension."""
        test_cases = [
            ("/path/to/file.mp4", "file"),
            ("/path/to/file.tar.gz", "file.tar"),
            ("/path/to/file", "file"),
            ("/path/to/.hidden", ".hidden")
        ]
        
        for path, expected_stem in test_cases:
            file_path = FilePath.from_string(path)
            assert file_path.get_stem() == expected_stem
    
    def test_get_parent(self):
        """Test getting parent directory as FilePath."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        parent = file_path.get_parent()
        assert isinstance(parent, FilePath)
        assert parent.path == os.path.normpath("/path/to")
    
    def test_get_parent_root(self):
        """Test getting parent of root-level file."""
        file_path = FilePath.from_string("/file.mp4")
        parent = file_path.get_parent()
        assert isinstance(parent, FilePath)
        # Parent of /file.mp4 should be /
        assert parent.path in ["/", "\\"] or parent.path == os.path.normpath("/")


class TestFilePathMediaSupport:
    """Test media file support checking."""
    
    def test_is_supported_media_file_video(self):
        """Test supported video file extensions."""
        video_extensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
        
        for ext in video_extensions:
            file_path = FilePath.from_string(f"/path/to/file{ext}")
            assert file_path.is_supported_media_file(), f"Extension {ext} should be supported"
    
    def test_is_supported_media_file_audio(self):
        """Test supported audio file extensions."""
        audio_extensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']
        
        for ext in audio_extensions:
            file_path = FilePath.from_string(f"/path/to/file{ext}")
            assert file_path.is_supported_media_file(), f"Extension {ext} should be supported"
    
    def test_is_supported_media_file_case_insensitive(self):
        """Test that media file checking is case insensitive."""
        test_cases = [
            "/path/to/file.MP4",
            "/path/to/file.AVI", 
            "/path/to/file.WAV",
            "/path/to/file.Mp3"
        ]
        
        for path in test_cases:
            file_path = FilePath.from_string(path)
            assert file_path.is_supported_media_file(), f"Path {path} should be supported"
    
    def test_is_supported_media_file_unsupported(self):
        """Test unsupported file extensions."""
        unsupported_extensions = ['.txt', '.pdf', '.doc', '.jpg', '.png', '.zip', '.exe']
        
        for ext in unsupported_extensions:
            file_path = FilePath.from_string(f"/path/to/file{ext}")
            assert not file_path.is_supported_media_file(), f"Extension {ext} should not be supported"
    
    def test_is_supported_media_file_no_extension(self):
        """Test file without extension."""
        file_path = FilePath.from_string("/path/to/file")
        assert not file_path.is_supported_media_file()


class TestFilePathGeneration:
    """Test FilePath generation methods."""
    
    def test_get_output_srt_path(self):
        """Test generating output SRT file path."""
        file_path = FilePath.from_string("/path/to/video.mp4")
        srt_path = file_path.get_output_srt_path()
        
        assert isinstance(srt_path, FilePath)
        assert srt_path.path == os.path.normpath("/path/to/video.srt")
        assert srt_path.get_extension() == ".srt"
    
    def test_get_output_srt_path_different_extensions(self):
        """Test SRT path generation for different input extensions."""
        test_cases = [
            ("/path/to/file.mp4", "/path/to/file.srt"),
            ("/path/to/file.avi", "/path/to/file.srt"),
            ("/path/to/file.wav", "/path/to/file.srt"),
            ("/path/to/file", "/path/to/file.srt")
        ]
        
        for input_path, expected_output in test_cases:
            file_path = FilePath.from_string(input_path)
            srt_path = file_path.get_output_srt_path()
            assert srt_path.path == os.path.normpath(expected_output)
    
    def test_get_temp_audio_path(self):
        """Test generating temporary audio file path."""
        file_path = FilePath.from_string("/path/to/video.mp4")
        temp_path = file_path.get_temp_audio_path()
        
        assert isinstance(temp_path, FilePath)
        assert temp_path.get_extension() == ".wav"
        assert temp_path.get_name() == "video_temp.wav"
        assert temp_path.get_parent().path == file_path.get_parent().path
    
    def test_get_temp_audio_path_different_stems(self):
        """Test temp audio path generation for different file stems."""
        test_cases = [
            "/path/to/movie.mp4",
            "/path/to/audio_file.wav",
            "/path/to/presentation.mkv"
        ]
        
        for input_path in test_cases:
            file_path = FilePath.from_string(input_path)
            temp_path = file_path.get_temp_audio_path()
            expected_name = f"{file_path.get_stem()}_temp.wav"
            assert temp_path.get_name() == expected_name


class TestFilePathValidation:
    """Test FilePath validation methods."""
    
    def test_validate_supported_format_valid(self):
        """Test validation passes for supported formats."""
        supported_files = [
            "/path/to/file.mp4",
            "/path/to/file.avi",
            "/path/to/file.wav",
            "/path/to/file.mp3"
        ]
        
        for path in supported_files:
            file_path = FilePath.from_string(path)
            # Should not raise exception
            file_path.validate_supported_format()
    
    def test_validate_supported_format_invalid_raises_error(self):
        """Test validation raises error for unsupported formats."""
        file_path = FilePath.from_string("/path/to/file.txt")
        
        with pytest.raises(ValueError) as exc_info:
            file_path.validate_supported_format()
        
        error_message = str(exc_info.value)
        assert "Unsupported file format" in error_message
        assert ".txt" in error_message
        assert ".mp4" in error_message  # Should list supported formats


class TestFilePathFileSystemOperations:
    """Test FilePath file system operations with mocking."""
    
    @patch('pathlib.Path.exists')
    def test_exists_true(self, mock_exists):
        """Test exists method when file exists."""
        mock_exists.return_value = True
        file_path = FilePath.from_string("/path/to/file.mp4")
        assert file_path.exists() is True
        mock_exists.assert_called_once()
    
    @patch('pathlib.Path.exists')
    def test_exists_false(self, mock_exists):
        """Test exists method when file doesn't exist."""
        mock_exists.return_value = False
        file_path = FilePath.from_string("/path/to/file.mp4")
        assert file_path.exists() is False
        mock_exists.assert_called_once()
    
    @patch('pathlib.Path.is_file')
    def test_is_file_true(self, mock_is_file):
        """Test is_file method when path is a file."""
        mock_is_file.return_value = True
        file_path = FilePath.from_string("/path/to/file.mp4")
        assert file_path.is_file() is True
        mock_is_file.assert_called_once()
    
    @patch('pathlib.Path.is_file')
    def test_is_file_false(self, mock_is_file):
        """Test is_file method when path is not a file."""
        mock_is_file.return_value = False
        file_path = FilePath.from_string("/path/to/directory")
        assert file_path.is_file() is False
        mock_is_file.assert_called_once()
    
    @patch('pathlib.Path.is_dir')
    def test_is_dir_true(self, mock_is_dir):
        """Test is_dir method when path is a directory."""
        mock_is_dir.return_value = True
        file_path = FilePath.from_string("/path/to/directory")
        assert file_path.is_dir() is True
        mock_is_dir.assert_called_once()
    
    @patch('pathlib.Path.is_dir')
    def test_is_dir_false(self, mock_is_dir):
        """Test is_dir method when path is not a directory."""
        mock_is_dir.return_value = False
        file_path = FilePath.from_string("/path/to/file.mp4")
        assert file_path.is_dir() is False
        mock_is_dir.assert_called_once()
    
    @patch('pathlib.Path.exists')
    def test_validate_exists_valid(self, mock_exists):
        """Test validate_exists passes when file exists."""
        mock_exists.return_value = True
        file_path = FilePath.from_string("/path/to/file.mp4")
        # Should not raise exception
        file_path.validate_exists()
        mock_exists.assert_called_once()
    
    @patch('pathlib.Path.exists')
    def test_validate_exists_invalid_raises_error(self, mock_exists):
        """Test validate_exists raises error when file doesn't exist."""
        mock_exists.return_value = False
        file_path = FilePath.from_string("/path/to/nonexistent.mp4")
        
        with pytest.raises(FileNotFoundError, match="File not found: .*nonexistent.mp4"):
            file_path.validate_exists()
        mock_exists.assert_called_once()
    
    @patch('pathlib.Path.is_file')
    def test_validate_is_file_valid(self, mock_is_file):
        """Test validate_is_file passes when path is a file."""
        mock_is_file.return_value = True
        file_path = FilePath.from_string("/path/to/file.mp4")
        # Should not raise exception
        file_path.validate_is_file()
        mock_is_file.assert_called_once()
    
    @patch('pathlib.Path.is_file')
    def test_validate_is_file_invalid_raises_error(self, mock_is_file):
        """Test validate_is_file raises error when path is not a file."""
        mock_is_file.return_value = False
        file_path = FilePath.from_string("/path/to/directory")
        
        with pytest.raises(ValueError, match="Path is not a file: .*directory"):
            file_path.validate_is_file()
        mock_is_file.assert_called_once()


class TestFilePathFileSize:
    """Test FilePath file size methods with mocking."""
    
    @patch('pathlib.Path.exists')
    @patch('pathlib.Path.stat')
    def test_get_size_bytes(self, mock_stat, mock_exists):
        """Test getting file size in bytes."""
        mock_exists.return_value = True
        mock_stat_result = MagicMock()
        mock_stat_result.st_size = 1024000  # 1MB
        mock_stat.return_value = mock_stat_result
        
        file_path = FilePath.from_string("/path/to/file.mp4")
        size = file_path.get_size_bytes()
        
        assert size == 1024000
        mock_exists.assert_called_once()
        mock_stat.assert_called_once()
    
    @patch('pathlib.Path.exists')
    def test_get_size_bytes_nonexistent_raises_error(self, mock_exists):
        """Test get_size_bytes raises error for nonexistent file."""
        mock_exists.return_value = False
        file_path = FilePath.from_string("/path/to/nonexistent.mp4")
        
        with pytest.raises(FileNotFoundError, match="File not found: .*nonexistent.mp4"):
            file_path.get_size_bytes()
        mock_exists.assert_called_once()
    
    @patch('pathlib.Path.exists')
    @patch('pathlib.Path.stat')
    def test_get_size_mb(self, mock_stat, mock_exists):
        """Test getting file size in megabytes."""
        mock_exists.return_value = True
        mock_stat_result = MagicMock()
        mock_stat_result.st_size = 2097152  # 2MB
        mock_stat.return_value = mock_stat_result
        
        file_path = FilePath.from_string("/path/to/file.mp4")
        size_mb = file_path.get_size_mb()
        
        assert size_mb == 2.0
        mock_exists.assert_called_once()
        mock_stat.assert_called_once()
    
    @patch('pathlib.Path.exists')
    @patch('pathlib.Path.stat')
    def test_get_size_mb_fractional(self, mock_stat, mock_exists):
        """Test getting fractional file size in megabytes."""
        mock_exists.return_value = True
        mock_stat_result = MagicMock()
        mock_stat_result.st_size = 1572864  # 1.5MB
        mock_stat.return_value = mock_stat_result
        
        file_path = FilePath.from_string("/path/to/file.mp4")
        size_mb = file_path.get_size_mb()
        
        assert abs(size_mb - 1.5) < 0.001
        mock_exists.assert_called_once()
        mock_stat.assert_called_once()


class TestFilePathImmutability:
    """Test FilePath immutability."""
    
    def test_frozen_dataclass(self):
        """Test that FilePath is immutable (frozen dataclass)."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        
        with pytest.raises(AttributeError):
            file_path.path = "/different/path.mp4"
    
    def test_supported_extensions_immutable(self):
        """Test that SUPPORTED_EXTENSIONS is immutable."""
        # Should be a frozenset
        assert isinstance(FilePath.SUPPORTED_EXTENSIONS, frozenset)
        
        # Should not be modifiable
        with pytest.raises(AttributeError):
            FilePath.SUPPORTED_EXTENSIONS.add('.new_ext')


class TestFilePathStringRepresentation:
    """Test FilePath string representations."""
    
    def test_str_representation(self):
        """Test string representation."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        str_repr = str(file_path)
        # Should contain the path
        assert "/path/to/file.mp4" in str_repr or file_path.path in str_repr
    
    def test_repr_representation(self):
        """Test repr representation."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        repr_str = repr(file_path)
        # Should contain class name and path
        assert "FilePath" in repr_str
        assert "file.mp4" in repr_str


class TestFilePathEdgeCases:
    """Test FilePath edge cases and boundary conditions."""
    
    def test_unicode_paths(self):
        """Test handling of Unicode characters in paths."""
        unicode_path = "/path/to/文件.mp4"
        file_path = FilePath.from_string(unicode_path)
        assert file_path.get_name() == "文件.mp4"
        assert file_path.get_stem() == "文件"
        assert file_path.get_extension() == ".mp4"
    
    def test_very_long_path(self):
        """Test handling of very long file paths."""
        long_name = "a" * 100
        long_path = f"/path/to/{long_name}.mp4"
        file_path = FilePath.from_string(long_path)
        assert file_path.get_stem() == long_name
        assert file_path.get_extension() == ".mp4"
    
    def test_special_characters_in_path(self):
        """Test handling of special characters in paths."""
        special_path = "/path/to/file with spaces & symbols!@#$.mp4"
        file_path = FilePath.from_string(special_path)
        assert file_path.get_extension() == ".mp4"
        assert "file with spaces & symbols!@#$" in file_path.get_stem()
    
    def test_relative_paths(self):
        """Test handling of relative paths."""
        relative_path = "./relative/path/file.mp4"
        file_path = FilePath.from_string(relative_path)
        # Path should be normalized
        assert file_path.path == os.path.normpath(relative_path)
    
    def test_windows_style_paths(self):
        """Test handling of Windows-style paths on any platform."""
        import platform
        if platform.system() == 'Windows':
            windows_path = "C:\\path\\to\\file.mp4"
            file_path = FilePath.from_string(windows_path)
            assert file_path.get_name() == "file.mp4"
            assert file_path.get_extension() == ".mp4"
        else:
            # On Unix systems, backslashes are part of filename
            windows_path = "C:\\path\\to\\file.mp4"
            file_path = FilePath.from_string(windows_path)
            # The entire string becomes the filename
            assert file_path.get_name() == "C:\\path\\to\\file.mp4"
    
    def test_path_with_multiple_dots(self):
        """Test handling of filenames with multiple dots."""
        multi_dot_path = "/path/to/file.backup.2023.mp4"
        file_path = FilePath.from_string(multi_dot_path)
        assert file_path.get_extension() == ".mp4"
        assert file_path.get_stem() == "file.backup.2023"


class TestFilePathRealFileSystemIntegration:
    """Test FilePath with real file system operations."""
    
    def test_with_temporary_file(self):
        """Test FilePath operations with a real temporary file."""
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
            temp_path = temp_file.name
            
        try:
            # Write some content to make it a real file
            with open(temp_path, 'wb') as f:
                f.write(b'test content')
            
            file_path = FilePath.from_string(temp_path)
            
            # Test real file operations
            assert file_path.exists()
            assert file_path.is_file()
            assert not file_path.is_dir()
            assert file_path.get_extension() == '.mp4'
            assert file_path.get_size_bytes() > 0
            assert file_path.get_size_mb() > 0
            
            # Test validation methods
            file_path.validate_exists()  # Should not raise
            file_path.validate_is_file()  # Should not raise
            file_path.validate_supported_format()  # Should not raise
            
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def test_with_temporary_directory(self):
        """Test FilePath operations with a real temporary directory."""
        with tempfile.TemporaryDirectory() as temp_dir:
            dir_path = FilePath.from_string(temp_dir)
            
            # Test directory operations
            assert dir_path.exists()
            assert not dir_path.is_file()
            assert dir_path.is_dir()
            
            # Validation should work
            dir_path.validate_exists()  # Should not raise
            
            # validate_is_file should raise
            with pytest.raises(ValueError, match="Path is not a file"):
                dir_path.validate_is_file()