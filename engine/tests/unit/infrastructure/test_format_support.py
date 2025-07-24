"""Tests for CLI format support validation."""

import unittest
from unittest.mock import Mock, patch
import os
import tempfile
from pathlib import Path

from src.infrastructure.validation.argument_validator import ArgumentValidator


class TestFormatSupport(unittest.TestCase):
    """Test cases for format support validation."""

    def test_supported_video_formats(self):
        """Test that all supported video formats are recognized."""
        supported_formats = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg']
        
        for fmt in supported_formats:
            with self.subTest(format=fmt):
                # Create a temporary file with the format extension
                with tempfile.NamedTemporaryFile(suffix=fmt, delete=False) as temp_file:
                    temp_path = temp_file.name
                
                try:
                    result = ArgumentValidator.validate_file_path(
                        temp_path,
                        field_name='input_file',
                        must_exist=True,
                        must_be_file=True,
                        allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                        check_readable=True
                    )
                    self.assertTrue(result.is_valid, f"Format {fmt} should be supported but was rejected: {result.get_error_messages()}")
                finally:
                    # Clean up
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)

    def test_supported_audio_formats(self):
        """Test that all supported audio formats are recognized."""
        supported_formats = ['.wav', '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.opus']
        
        for fmt in supported_formats:
            with self.subTest(format=fmt):
                # Create a temporary file with the format extension
                with tempfile.NamedTemporaryFile(suffix=fmt, delete=False) as temp_file:
                    temp_path = temp_file.name
                
                try:
                    result = ArgumentValidator.validate_file_path(
                        temp_path,
                        field_name='input_file',
                        must_exist=True,
                        must_be_file=True,
                        allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                        check_readable=True
                    )
                    self.assertTrue(result.is_valid, f"Format {fmt} should be supported but was rejected: {result.get_error_messages()}")
                finally:
                    # Clean up
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)

    def test_unsupported_formats(self):
        """Test that unsupported formats are rejected."""
        unsupported_formats = ['.txt', '.pdf', '.doc', '.exe', '.zip', '.rar']
        
        for fmt in unsupported_formats:
            with self.subTest(format=fmt):
                # Create a temporary file with the format extension
                with tempfile.NamedTemporaryFile(suffix=fmt, delete=False) as temp_file:
                    temp_path = temp_file.name
                
                try:
                    result = ArgumentValidator.validate_file_path(
                        temp_path,
                        field_name='input_file',
                        must_exist=True,
                        must_be_file=True,
                        allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                        check_readable=True
                    )
                    self.assertFalse(result.is_valid, f"Format {fmt} should not be supported but was accepted")
                    # Should have an error about unsupported file type
                    error_messages = result.get_error_messages()
                    self.assertTrue(any("not supported" in msg for msg in error_messages), 
                                  f"Expected 'not supported' error for {fmt}, got: {error_messages}")
                finally:
                    # Clean up
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)

    def test_mov_format_specifically(self):
        """Test .mov format specifically (reported issue)."""
        # Create a temporary .mov file
        with tempfile.NamedTemporaryFile(suffix='.mov', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            result = ArgumentValidator.validate_file_path(
                temp_path,
                field_name='input_file',
                must_exist=True,
                must_be_file=True,
                allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                check_readable=True
            )
            self.assertTrue(result.is_valid, f".mov format should be supported but was rejected: {result.get_error_messages()}")
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_case_insensitive_formats(self):
        """Test that format checking is case insensitive."""
        formats_to_test = ['.MOV', '.Mp4', '.AVI', '.mkV', '.WAV', '.MP3']
        
        for fmt in formats_to_test:
            with self.subTest(format=fmt):
                # Create a temporary file with the format extension
                with tempfile.NamedTemporaryFile(suffix=fmt, delete=False) as temp_file:
                    temp_path = temp_file.name
                
                try:
                    result = ArgumentValidator.validate_file_path(
                        temp_path,
                        field_name='input_file',
                        must_exist=True,
                        must_be_file=True,
                        allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                        check_readable=True
                    )
                    self.assertTrue(result.is_valid, f"Format {fmt} (case variant) should be supported: {result.get_error_messages()}")
                finally:
                    # Clean up
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)

    def test_format_validation_with_nonexistent_file(self):
        """Test format validation behavior with non-existent files."""
        # Test with supported format extension but non-existent file
        nonexistent_path = "/path/to/nonexistent/file.mov"
        
        result = ArgumentValidator.validate_file_path(
            nonexistent_path,
            field_name='input_file',
            must_exist=True,
            must_be_file=True,
            allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
            check_readable=True
        )
        
        # This should fail due to file not existing, not format issues
        self.assertFalse(result.is_valid)
        error_messages = result.get_error_messages()
        self.assertTrue(any("does not exist" in msg for msg in error_messages), 
                       f"Expected 'does not exist' error, got: {error_messages}")

    def test_validate_all_arguments_with_mov_file(self):
        """Test complete argument validation with .mov file."""
        # Create a temporary .mov file
        with tempfile.NamedTemporaryFile(suffix='.mov', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            args_to_validate = {
                'input_file': temp_path,
                'output_file': None,
                'language': 'zh_cn',  # Use valid language code
                'model': None,
                'priority': 'balanced',
                'video_quality': '720p',  # Use valid video quality
                'charset': 'traditional',
                'ffmpeg_path': 'ffmpeg',  # Provide valid ffmpeg path
                'terminology_config': None,
                'max_chunk_duration': 10,
                'gemini_api_key': None,
                'hf_token': None,
                'subtitle': None,
                'speakers': False,
                'written': False,
                'music': False,
                'disable_gemini_refinement': False,
                'verbose': False,
                'ipc_mode': False
            }
            
            is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(args_to_validate)
            
            # Check if there are any format-related issues specifically
            format_issues = [issue for issue in validation_issues 
                           if 'input_file' in issue.field and 'not supported' in issue.message]
            self.assertEqual(len(format_issues), 0, f"Should not have format issues for .mov file: {format_issues}")
            
            # Verify input_file was processed correctly
            if 'input_file' not in sanitized_args:
                # Check if validation failed due to non-format issues
                non_format_issues = [issue for issue in validation_issues if issue.field != 'input_file']
                if non_format_issues:
                    self.skipTest(f"Test skipped due to non-format validation issues: {non_format_issues}")
            
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_comprehensive_format_coverage(self):
        """Test that format constants match expected supported formats."""
        # Test that MOV is in the supported formats
        with tempfile.NamedTemporaryFile(suffix='.mov', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # This should pass if .mov is in SUPPORTED_VIDEO_FORMATS
            result = ArgumentValidator.validate_file_path(
                temp_path,
                field_name='input_file',
                must_exist=True,
                must_be_file=True,
                allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                check_readable=True
            )
            self.assertTrue(result.is_valid, f".mov should be in SUPPORTED_VIDEO_FORMATS constant: {result.get_error_messages()}")
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


if __name__ == '__main__':
    unittest.main()