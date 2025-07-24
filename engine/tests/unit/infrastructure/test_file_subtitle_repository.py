"""Tests for FileSubtitleRepository."""

import unittest
from unittest.mock import Mock, patch, mock_open, MagicMock
import os
import tempfile
from pathlib import Path
from datetime import timedelta

import srt

from src.infrastructure.repositories.file_subtitle_repository import FileSubtitleRepository
from src.domain.entities import SubtitleDocument, Subtitle
from src.domain.value_objects import FilePath, Timestamp


class TestFileSubtitleRepository(unittest.TestCase):
    """Test cases for FileSubtitleRepository."""

    def setUp(self):
        """Set up test fixtures."""
        self.repository = FileSubtitleRepository(create_backups=True)
        self.no_backup_repository = FileSubtitleRepository(create_backups=False)

    def test_init_with_backups(self):
        """Test repository initialization with backups enabled."""
        repo = FileSubtitleRepository(create_backups=True)
        self.assertTrue(repo.create_backups)

    def test_init_without_backups(self):
        """Test repository initialization with backups disabled."""
        repo = FileSubtitleRepository(create_backups=False)
        self.assertFalse(repo.create_backups)

    def test_init_default_backups(self):
        """Test repository initialization with default backup setting."""
        repo = FileSubtitleRepository()
        self.assertTrue(repo.create_backups)

    @patch('os.makedirs')
    @patch('builtins.open', new_callable=mock_open)
    def test_save_subtitle_document_success(self, mock_file, mock_makedirs):
        """Test successful subtitle document saving."""
        # Create mock subtitle document
        mock_subtitle_doc = Mock(spec=SubtitleDocument)
        mock_subtitle_doc.to_srt_content.return_value = "1\n00:00:01,000 --> 00:00:03,000\nTest subtitle\n\n"
        
        # Create mock file path
        mock_output_path = Mock(spec=FilePath)
        mock_output_path.path = "/test/output.srt"
        mock_output_path.get_parent.return_value = Mock()
        mock_output_path.get_parent().exists.return_value = True
        mock_output_path.exists.return_value = True
        mock_output_path.get_size_bytes.return_value = 100
        
        result = self.repository.save_subtitle_document(mock_subtitle_doc, mock_output_path)
        
        self.assertTrue(result)
        mock_file.assert_called_once_with("/test/output.srt", 'w', encoding="utf-8")
        mock_subtitle_doc.to_srt_content.assert_called_once()

    @patch('os.makedirs')
    @patch('builtins.open', new_callable=mock_open)
    def test_save_subtitle_document_create_directory(self, mock_file, mock_makedirs):
        """Test subtitle document saving with directory creation."""
        mock_subtitle_doc = Mock(spec=SubtitleDocument)
        mock_subtitle_doc.to_srt_content.return_value = "test content"
        
        mock_output_path = Mock(spec=FilePath)
        mock_output_path.path = "/test/new_dir/output.srt"
        mock_parent_dir = Mock()
        mock_parent_dir.exists.return_value = False
        mock_parent_dir.path = "/test/new_dir"
        mock_output_path.get_parent.return_value = mock_parent_dir
        mock_output_path.exists.return_value = True
        mock_output_path.get_size_bytes.return_value = 100
        
        result = self.repository.save_subtitle_document(mock_subtitle_doc, mock_output_path)
        
        self.assertTrue(result)
        mock_makedirs.assert_called_once_with("/test/new_dir", exist_ok=True)

    @patch('builtins.open', new_callable=mock_open)
    def test_save_subtitle_document_file_write_error(self, mock_file):
        """Test subtitle document saving with file write error."""
        mock_file.side_effect = OSError("Write failed")
        
        mock_subtitle_doc = Mock(spec=SubtitleDocument)
        mock_output_path = Mock(spec=FilePath)
        mock_output_path.path = "/test/output.srt"
        mock_output_path.get_parent.return_value = Mock()
        mock_output_path.get_parent().exists.return_value = True
        
        with self.assertRaises(OSError) as context:
            self.repository.save_subtitle_document(mock_subtitle_doc, mock_output_path)
        
        self.assertIn("Failed to save subtitle file", str(context.exception))

    @patch('builtins.open', new_callable=mock_open)
    def test_save_subtitle_document_zero_size_file(self, mock_file):
        """Test subtitle document saving when resulting file has zero size."""
        mock_subtitle_doc = Mock(spec=SubtitleDocument)
        mock_subtitle_doc.to_srt_content.return_value = "test content"
        
        mock_output_path = Mock(spec=FilePath)
        mock_output_path.path = "/test/output.srt"
        mock_output_path.get_parent.return_value = Mock()
        mock_output_path.get_parent().exists.return_value = True
        mock_output_path.exists.return_value = True
        mock_output_path.get_size_bytes.return_value = 0  # Zero size
        
        with self.assertRaises(OSError) as context:
            self.repository.save_subtitle_document(mock_subtitle_doc, mock_output_path)
        
        self.assertIn("Failed to write subtitle file", str(context.exception))

    @patch('builtins.open', new_callable=mock_open, read_data="1\n00:00:01,000 --> 00:00:03,000\nTest subtitle\n\n")
    @patch('srt.parse')
    def test_load_subtitle_document_success(self, mock_srt_parse, mock_file):
        """Test successful subtitle document loading."""
        # Mock SRT subtitle
        mock_srt_subtitle = Mock()
        mock_srt_subtitle.index = 1
        mock_srt_subtitle.start = timedelta(seconds=1)
        mock_srt_subtitle.end = timedelta(seconds=3)
        mock_srt_subtitle.content = "Test subtitle"
        mock_srt_parse.return_value = [mock_srt_subtitle]
        
        # Mock file path
        mock_input_path = Mock(spec=FilePath)
        mock_input_path.path = "/test/input.srt"
        mock_input_path.validate_exists.return_value = None
        mock_input_path.validate_is_file.return_value = None
        
        # Mock SubtitleDocument.create
        with patch('src.infrastructure.repositories.file_subtitle_repository.SubtitleDocument.create') as mock_create:
            mock_subtitle_doc = Mock(spec=SubtitleDocument)
            mock_create.return_value = mock_subtitle_doc
            
            result = self.repository.load_subtitle_document(mock_input_path)
            
            self.assertEqual(result, mock_subtitle_doc)
            mock_input_path.validate_exists.assert_called_once()
            mock_input_path.validate_is_file.assert_called_once()
            mock_create.assert_called_once()

    @patch('builtins.open', new_callable=mock_open)
    def test_load_subtitle_document_file_not_found(self, mock_file):
        """Test subtitle document loading with file not found."""
        mock_input_path = Mock(spec=FilePath)
        mock_input_path.path = "/test/nonexistent.srt"
        mock_input_path.validate_exists.side_effect = FileNotFoundError()
        
        with self.assertRaises(FileNotFoundError) as context:
            self.repository.load_subtitle_document(mock_input_path)
        
        self.assertIn("Subtitle file not found", str(context.exception))

    @patch('builtins.open', new_callable=mock_open, read_data="invalid srt content")
    def test_load_subtitle_document_invalid_format(self, mock_file):
        """Test subtitle document loading with invalid SRT format."""
        mock_input_path = Mock(spec=FilePath)
        mock_input_path.path = "/test/invalid.srt"
        mock_input_path.validate_exists.return_value = None
        mock_input_path.validate_is_file.return_value = None
        
        with patch.object(self.repository, 'validate_srt_format', return_value=False):
            with self.assertRaises(ValueError) as context:
                self.repository.load_subtitle_document(mock_input_path)
            
            self.assertIn("Invalid SRT format", str(context.exception))

    @patch('builtins.open', new_callable=mock_open)
    def test_load_subtitle_document_unicode_error(self, mock_file):
        """Test subtitle document loading with unicode error."""
        mock_file.side_effect = UnicodeError("Decoding failed")
        
        mock_input_path = Mock(spec=FilePath)
        mock_input_path.path = "/test/input.srt"
        mock_input_path.validate_exists.return_value = None
        mock_input_path.validate_is_file.return_value = None
        
        with self.assertRaises(UnicodeError) as context:
            self.repository.load_subtitle_document(mock_input_path)
        
        self.assertIn("Failed to read subtitle file", str(context.exception))

    @patch('srt.parse')
    def test_validate_srt_format_valid(self, mock_srt_parse):
        """Test SRT format validation with valid content."""
        # Mock valid SRT subtitles
        mock_subtitle1 = Mock()
        mock_subtitle1.index = 1
        mock_subtitle2 = Mock()
        mock_subtitle2.index = 2
        mock_srt_parse.return_value = [mock_subtitle1, mock_subtitle2]
        
        result = self.repository.validate_srt_format("valid content")
        
        self.assertTrue(result)

    @patch('srt.parse')
    def test_validate_srt_format_empty(self, mock_srt_parse):
        """Test SRT format validation with empty content."""
        mock_srt_parse.return_value = []
        
        result = self.repository.validate_srt_format("empty")
        
        self.assertFalse(result)

    @patch('srt.parse')
    def test_validate_srt_format_invalid_indices(self, mock_srt_parse):
        """Test SRT format validation with invalid indices."""
        # Mock subtitles with non-sequential indices
        mock_subtitle1 = Mock()
        mock_subtitle1.index = 1
        mock_subtitle2 = Mock()
        mock_subtitle2.index = 3  # Should be 2
        mock_srt_parse.return_value = [mock_subtitle1, mock_subtitle2]
        
        result = self.repository.validate_srt_format("invalid indices")
        
        self.assertFalse(result)

    @patch('srt.parse')
    def test_validate_srt_format_parse_error(self, mock_srt_parse):
        """Test SRT format validation with parse error."""
        mock_srt_parse.side_effect = Exception("Parse failed")
        
        result = self.repository.validate_srt_format("unparseable content")
        
        self.assertFalse(result)

    def test_format_srt_content(self):
        """Test SRT content formatting."""
        mock_subtitle_doc = Mock(spec=SubtitleDocument)
        mock_subtitle_doc.to_srt_content.return_value = "formatted content"
        
        result = self.repository.format_srt_content(mock_subtitle_doc)
        
        self.assertEqual(result, "formatted content")
        mock_subtitle_doc.to_srt_content.assert_called_once()

    @patch('shutil.copy2')
    @patch('src.infrastructure.repositories.file_subtitle_repository.datetime')
    def test_backup_existing_file_success(self, mock_datetime, mock_copy2):
        """Test successful file backup creation."""
        # Mock datetime
        mock_datetime.now.return_value.strftime.return_value = "20231201_143000"
        
        # Mock file path
        mock_file_path = Mock(spec=FilePath)
        mock_file_path.exists.return_value = True
        mock_file_path.get_stem.return_value = "subtitle"
        mock_file_path.get_extension.return_value = ".srt"
        mock_file_path.path = "/test/subtitle.srt"
        
        # Mock parent directory
        mock_parent = Mock()
        mock_parent.to_pathlib.return_value = Path("/test")
        mock_file_path.get_parent.return_value = mock_parent
        
        result = self.repository.backup_existing_file(mock_file_path)
        
        self.assertIsInstance(result, FilePath)
        mock_copy2.assert_called_once_with("/test/subtitle.srt", "/test/subtitle_backup_20231201_143000.srt")

    def test_backup_existing_file_backups_disabled(self):
        """Test file backup when backups are disabled."""
        mock_file_path = Mock(spec=FilePath)
        
        result = self.no_backup_repository.backup_existing_file(mock_file_path)
        
        self.assertIsNone(result)

    def test_backup_existing_file_file_not_exists(self):
        """Test file backup when file doesn't exist."""
        mock_file_path = Mock(spec=FilePath)
        mock_file_path.exists.return_value = False
        
        result = self.repository.backup_existing_file(mock_file_path)
        
        self.assertIsNone(result)

    @patch('shutil.copy2')
    def test_backup_existing_file_copy_error(self, mock_copy2):
        """Test file backup with copy error."""
        mock_copy2.side_effect = OSError("Copy failed")
        
        mock_file_path = Mock(spec=FilePath)
        mock_file_path.exists.return_value = True
        mock_file_path.get_stem.return_value = "subtitle"
        mock_file_path.get_extension.return_value = ".srt"
        mock_file_path.path = "/test/subtitle.srt"
        mock_parent = Mock()
        mock_parent.to_pathlib.return_value = Path("/test")
        mock_file_path.get_parent.return_value = mock_parent
        
        # Should not raise exception, just return None
        result = self.repository.backup_existing_file(mock_file_path)
        
        self.assertIsNone(result)

    def test_save_subtitle_document_custom_encoding(self):
        """Test subtitle document saving with custom encoding."""
        mock_subtitle_doc = Mock(spec=SubtitleDocument)
        mock_subtitle_doc.to_srt_content.return_value = "test content"
        
        mock_output_path = Mock(spec=FilePath)
        mock_output_path.path = "/test/output.srt"
        mock_output_path.get_parent.return_value = Mock()
        mock_output_path.get_parent().exists.return_value = True
        mock_output_path.exists.return_value = True
        mock_output_path.get_size_bytes.return_value = 100
        
        with patch('builtins.open', mock_open()) as mock_file:
            result = self.repository.save_subtitle_document(
                mock_subtitle_doc, mock_output_path, encoding="latin-1"
            )
            
            self.assertTrue(result)
            mock_file.assert_called_with(mock_output_path.path, 'w', encoding="latin-1")

    def test_load_subtitle_document_custom_encoding(self):
        """Test subtitle document loading with custom encoding."""
        mock_input_path = Mock(spec=FilePath)
        mock_input_path.path = "/test/input.srt"
        mock_input_path.validate_exists.return_value = None
        mock_input_path.validate_is_file.return_value = None
        
        with patch('builtins.open', mock_open(read_data="test")) as mock_file:
            with patch.object(self.repository, 'validate_srt_format', return_value=True):
                with patch('srt.parse', return_value=[]):
                    with patch('src.infrastructure.repositories.file_subtitle_repository.SubtitleDocument.create'):
                        try:
                            self.repository.load_subtitle_document(mock_input_path, encoding="latin-1")
                        except:
                            pass  # We expect this to fail due to empty subtitles
                        
                        mock_file.assert_called_with(mock_input_path.path, 'r', encoding="latin-1")

    def test_integration_with_real_srt_content(self):
        """Integration test with real SRT content."""
        srt_content = """1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,000
This is a test

"""
        # Test validation
        result = self.repository.validate_srt_format(srt_content)
        self.assertTrue(result)
        
        # Test parsing with mocked file operations
        mock_input_path = Mock(spec=FilePath)
        mock_input_path.path = "/test/test.srt"
        mock_input_path.validate_exists.return_value = None
        mock_input_path.validate_is_file.return_value = None
        
        with patch('builtins.open', mock_open(read_data=srt_content)):
            with patch('src.infrastructure.repositories.file_subtitle_repository.SubtitleDocument.create') as mock_create:
                mock_subtitle_doc = Mock(spec=SubtitleDocument)
                mock_create.return_value = mock_subtitle_doc
                
                result = self.repository.load_subtitle_document(mock_input_path)
                
                self.assertEqual(result, mock_subtitle_doc)
                # Verify create was called with correct number of subtitles
                create_call_args = mock_create.call_args[1]
                subtitles = create_call_args['subtitles']
                self.assertEqual(len(subtitles), 2)
                self.assertEqual(subtitles[0].content, "Hello world")
                self.assertEqual(subtitles[1].content, "This is a test")


if __name__ == '__main__':
    unittest.main()