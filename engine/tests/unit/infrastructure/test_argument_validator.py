"""Tests for ArgumentValidator."""

import unittest
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os
from pathlib import Path

from src.infrastructure.validation.argument_validator import (
    ArgumentValidator, ValidationResult, ValidationIssue, ValidationSeverity, ValidationError
)


class TestValidationResult(unittest.TestCase):
    """Test cases for ValidationResult."""

    def test_has_errors_true(self):
        """Test has_errors property when errors are present."""
        issues = [
            ValidationIssue("field1", "Error message", ValidationSeverity.ERROR),
            ValidationIssue("field2", "Warning message", ValidationSeverity.WARNING)
        ]
        result = ValidationResult(is_valid=False, issues=issues)
        
        self.assertTrue(result.has_errors)

    def test_has_errors_false(self):
        """Test has_errors property when no errors are present."""
        issues = [
            ValidationIssue("field1", "Warning message", ValidationSeverity.WARNING),
            ValidationIssue("field2", "Info message", ValidationSeverity.INFO)
        ]
        result = ValidationResult(is_valid=True, issues=issues)
        
        self.assertFalse(result.has_errors)

    def test_has_warnings_true(self):
        """Test has_warnings property when warnings are present."""
        issues = [
            ValidationIssue("field1", "Warning message", ValidationSeverity.WARNING),
            ValidationIssue("field2", "Info message", ValidationSeverity.INFO)
        ]
        result = ValidationResult(is_valid=True, issues=issues)
        
        self.assertTrue(result.has_warnings)

    def test_has_warnings_false(self):
        """Test has_warnings property when no warnings are present."""
        issues = [
            ValidationIssue("field1", "Error message", ValidationSeverity.ERROR),
            ValidationIssue("field2", "Info message", ValidationSeverity.INFO)
        ]
        result = ValidationResult(is_valid=False, issues=issues)
        
        self.assertFalse(result.has_warnings)

    def test_get_error_messages(self):
        """Test getting error messages."""
        issues = [
            ValidationIssue("field1", "Error 1", ValidationSeverity.ERROR),
            ValidationIssue("field2", "Warning 1", ValidationSeverity.WARNING),
            ValidationIssue("field3", "Error 2", ValidationSeverity.ERROR)
        ]
        result = ValidationResult(is_valid=False, issues=issues)
        
        error_messages = result.get_error_messages()
        
        self.assertEqual(error_messages, ["Error 1", "Error 2"])

    def test_get_warning_messages(self):
        """Test getting warning messages."""
        issues = [
            ValidationIssue("field1", "Error 1", ValidationSeverity.ERROR),
            ValidationIssue("field2", "Warning 1", ValidationSeverity.WARNING),
            ValidationIssue("field3", "Warning 2", ValidationSeverity.WARNING)
        ]
        result = ValidationResult(is_valid=False, issues=issues)
        
        warning_messages = result.get_warning_messages()
        
        self.assertEqual(warning_messages, ["Warning 1", "Warning 2"])


class TestValidationError(unittest.TestCase):
    """Test cases for ValidationError."""

    def test_validation_error_creation(self):
        """Test ValidationError creation."""
        error = ValidationError("test_field", "Test error message", "Test suggestion")
        
        self.assertEqual(error.field, "test_field")
        self.assertEqual(error.message, "Test error message")
        self.assertEqual(error.suggestion, "Test suggestion")
        self.assertEqual(str(error), "test_field: Test error message")

    def test_validation_error_no_suggestion(self):
        """Test ValidationError creation without suggestion."""
        error = ValidationError("test_field", "Test error message")
        
        self.assertEqual(error.field, "test_field")
        self.assertEqual(error.message, "Test error message")
        self.assertIsNone(error.suggestion)


class TestArgumentValidator(unittest.TestCase):
    """Test cases for ArgumentValidator."""

    def test_validate_file_path_empty_path(self):
        """Test file path validation with empty path."""
        result = ArgumentValidator.validate_file_path("")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("empty or contain only whitespace", result.get_error_messages()[0])

    def test_validate_file_path_whitespace_only(self):
        """Test file path validation with whitespace-only path."""
        result = ArgumentValidator.validate_file_path("   ")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)

    def test_validate_file_path_dangerous_characters(self):
        """Test file path validation with dangerous characters."""
        dangerous_path = "/test/file$with|dangerous&chars"
        
        result = ArgumentValidator.validate_file_path(dangerous_path)
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("dangerous characters", result.get_error_messages()[0])

    def test_validate_file_path_path_traversal(self):
        """Test file path validation with path traversal attempt."""
        traversal_path = "/test/../../../etc/passwd"
        
        result = ArgumentValidator.validate_file_path(traversal_path)
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("Path traversal", result.get_error_messages()[0])

    def test_validate_file_path_spaces_warning(self):
        """Test file path validation with spaces (warning)."""
        path_with_spaces = "/test/file with spaces.mp3"
        
        with tempfile.NamedTemporaryFile(suffix=" with spaces.mp3", delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = ArgumentValidator.validate_file_path(tmp_path, must_exist=False)
            
            # Should be valid but with warnings about spaces
            self.assertTrue(result.is_valid)
            self.assertTrue(result.has_warnings)
            self.assertIn("spaces", result.get_warning_messages()[0])
        finally:
            os.unlink(tmp_path)

    def test_validate_file_path_invalid_format(self):
        """Test file path validation with invalid format."""
        # Use a path that will cause Path() to fail
        with patch('pathlib.Path') as mock_path:
            mock_path.side_effect = ValueError("Invalid path")
            
            result = ArgumentValidator.validate_file_path("/invalid/path")
            
            self.assertFalse(result.is_valid)
            self.assertTrue(result.has_errors)
            self.assertIn("Invalid path format", result.get_error_messages()[0])

    def test_validate_file_path_nonexistent_required(self):
        """Test file path validation when file doesn't exist but is required."""
        nonexistent_path = "/nonexistent/file.mp3"
        
        result = ArgumentValidator.validate_file_path(nonexistent_path, must_exist=True)
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("does not exist", result.get_error_messages()[0])

    def test_validate_file_path_directory_when_file_required(self):
        """Test file path validation with directory when file is required."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            result = ArgumentValidator.validate_file_path(tmp_dir, must_be_file=True)
            
            self.assertFalse(result.is_valid)
            self.assertTrue(result.has_errors)
            self.assertIn("not a file", result.get_error_messages()[0])

    def test_validate_file_path_invalid_extension(self):
        """Test file path validation with invalid extension."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = ArgumentValidator.validate_file_path(
                tmp_path, 
                allowed_extensions={'.mp3', '.wav'}
            )
            
            self.assertFalse(result.is_valid)
            self.assertTrue(result.has_errors)
            self.assertIn("not supported", result.get_error_messages()[0])
        finally:
            os.unlink(tmp_path)

    def test_validate_file_path_large_file_error(self):
        """Test file path validation with file exceeding maximum size."""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        # Mock file size to exceed maximum
        import stat
        from unittest.mock import MagicMock
        with patch.object(Path, 'stat') as mock_stat:
            stat_result = MagicMock()
            stat_result.st_size = 15 * 1024**3  # 15GB
            stat_result.st_mode = stat.S_IFREG  # Regular file
            mock_stat.return_value = stat_result
            
            try:
                result = ArgumentValidator.validate_file_path(tmp_path)
                
                self.assertFalse(result.is_valid)
                self.assertTrue(result.has_errors)
                self.assertIn("exceeds maximum limit", result.get_error_messages()[0])
            finally:
                os.unlink(tmp_path)

    def test_validate_file_path_large_file_warning(self):
        """Test file path validation with file triggering size warning."""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        # Mock file size to trigger warning
        import stat
        from unittest.mock import MagicMock
        with patch.object(Path, 'stat') as mock_stat:
            stat_result = MagicMock()
            stat_result.st_size = 2 * 1024**3  # 2GB
            stat_result.st_mode = stat.S_IFREG  # Regular file
            mock_stat.return_value = stat_result
            
            try:
                result = ArgumentValidator.validate_file_path(tmp_path)
                
                self.assertTrue(result.is_valid)
                self.assertTrue(result.has_warnings)
                self.assertIn("Large file size", result.get_warning_messages()[0])
            finally:
                os.unlink(tmp_path)

    @patch('os.access')
    def test_validate_file_path_not_readable(self, mock_access):
        """Test file path validation when file is not readable."""
        mock_access.return_value = False
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = ArgumentValidator.validate_file_path(tmp_path, check_readable=True)
            
            self.assertFalse(result.is_valid)
            self.assertTrue(result.has_errors)
            self.assertIn("not readable", result.get_error_messages()[0])
        finally:
            os.unlink(tmp_path)

    @patch('os.access')
    def test_validate_file_path_not_writable(self, mock_access):
        """Test file path validation when file is not writable."""
        def access_side_effect(path, mode):
            if mode == os.W_OK:
                return False
            return True
        
        mock_access.side_effect = access_side_effect
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = ArgumentValidator.validate_file_path(tmp_path, check_writable=True)
            
            self.assertFalse(result.is_valid)
            self.assertTrue(result.has_errors)
            self.assertIn("not writable", result.get_error_messages()[0])
        finally:
            os.unlink(tmp_path)

    def test_validate_file_path_success(self):
        """Test successful file path validation."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = ArgumentValidator.validate_file_path(
                tmp_path,
                allowed_extensions={'.mp3', '.wav'}
            )
            
            self.assertTrue(result.is_valid)
            self.assertFalse(result.has_errors)
            self.assertIsNotNone(result.sanitized_value)
        finally:
            os.unlink(tmp_path)

    def test_validate_language_code_empty(self):
        """Test language code validation with empty code."""
        result = ArgumentValidator.validate_language_code("")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("cannot be empty", result.get_error_messages()[0])

    @patch('src.domain.value_objects.LanguageCode.is_supported')
    def test_validate_language_code_unsupported(self, mock_is_supported):
        """Test language code validation with unsupported code."""
        mock_is_supported.return_value = False
        
        with patch('src.domain.value_objects.LanguageCode.get_supported_codes', 
                  return_value={'en': 'English', 'zh': 'Chinese'}):
            result = ArgumentValidator.validate_language_code("xx")
            
            self.assertFalse(result.is_valid)
            self.assertTrue(result.has_errors)
            self.assertIn("Unsupported language code", result.get_error_messages()[0])

    @patch('src.domain.value_objects.LanguageCode.is_supported')
    @patch('src.domain.value_objects.LanguageCode.from_string')
    def test_validate_language_code_success(self, mock_from_string, mock_is_supported):
        """Test successful language code validation."""
        mock_is_supported.return_value = True
        mock_lang_code = Mock()
        mock_lang_code.__str__ = Mock(return_value="zh-yue")
        mock_from_string.return_value = mock_lang_code
        
        result = ArgumentValidator.validate_language_code("zh-yue")
        
        self.assertTrue(result.is_valid)
        self.assertFalse(result.has_errors)
        self.assertEqual(result.sanitized_value, "zh-yue")

    def test_validate_enum_value_empty(self):
        """Test enum value validation with empty value."""
        result = ArgumentValidator.validate_enum_value("", ["value1", "value2"], "test_field")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("cannot be empty", result.get_error_messages()[0])

    def test_validate_enum_value_invalid(self):
        """Test enum value validation with invalid value."""
        result = ArgumentValidator.validate_enum_value("invalid", ["value1", "value2"], "test_field")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("Invalid value", result.get_error_messages()[0])

    def test_validate_enum_value_case_insensitive(self):
        """Test enum value validation with case-insensitive matching."""
        result = ArgumentValidator.validate_enum_value(
            "VALUE1", ["value1", "value2"], "test_field", case_sensitive=False
        )
        
        self.assertTrue(result.is_valid)
        self.assertFalse(result.has_errors)
        self.assertEqual(result.sanitized_value, "value1")

    def test_validate_enum_value_case_sensitive(self):
        """Test enum value validation with case-sensitive matching."""
        result = ArgumentValidator.validate_enum_value(
            "VALUE1", ["value1", "value2"], "test_field", case_sensitive=True
        )
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)

    def test_validate_model_name_none(self):
        """Test model name validation with None (auto-selection)."""
        result = ArgumentValidator.validate_model_name(None)
        
        self.assertTrue(result.is_valid)
        self.assertIsNone(result.sanitized_value)

    def test_validate_model_name_valid(self):
        """Test model name validation with valid model."""
        result = ArgumentValidator.validate_model_name("large-v3")
        
        self.assertTrue(result.is_valid)
        self.assertEqual(result.sanitized_value, "large-v3")

    def test_validate_model_name_invalid(self):
        """Test model name validation with invalid model."""
        result = ArgumentValidator.validate_model_name("invalid-model")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("Invalid model name", result.get_error_messages()[0])

    def test_validate_ffmpeg_path_none(self):
        """Test FFmpeg path validation with None."""
        result = ArgumentValidator.validate_ffmpeg_path(None)
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("FFmpeg path is required", result.get_error_messages()[0])

    @patch('shutil.which')
    def test_validate_ffmpeg_path_system_path_found(self, mock_which):
        """Test FFmpeg path validation with system PATH."""
        mock_which.return_value = "/usr/bin/ffmpeg"
        
        result = ArgumentValidator.validate_ffmpeg_path("ffmpeg")
        
        self.assertTrue(result.is_valid)
        self.assertEqual(result.sanitized_value, "ffmpeg")

    @patch('shutil.which')
    def test_validate_ffmpeg_path_system_path_not_found(self, mock_which):
        """Test FFmpeg path validation when not found in system PATH."""
        mock_which.return_value = None
        
        result = ArgumentValidator.validate_ffmpeg_path("ffmpeg")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("not found in system PATH", result.get_error_messages()[0])

    @patch('os.access')
    def test_validate_ffmpeg_path_not_executable(self, mock_access):
        """Test FFmpeg path validation when file is not executable."""
        def access_side_effect(path, mode):
            if mode == os.X_OK:
                return False
            return True
        
        mock_access.side_effect = access_side_effect
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = ArgumentValidator.validate_ffmpeg_path(tmp_path)
            
            self.assertFalse(result.is_valid)
            self.assertTrue(result.has_errors)
            self.assertIn("not executable", result.get_error_messages()[0])
        finally:
            os.unlink(tmp_path)

    def test_validate_numeric_range_below_minimum(self):
        """Test numeric range validation below minimum."""
        result = ArgumentValidator.validate_numeric_range(5, min_value=10, field_name="test_value")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("below minimum", result.get_error_messages()[0])

    def test_validate_numeric_range_above_maximum(self):
        """Test numeric range validation above maximum."""
        result = ArgumentValidator.validate_numeric_range(15, max_value=10, field_name="test_value")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("exceeds maximum", result.get_error_messages()[0])

    def test_validate_numeric_range_within_range(self):
        """Test numeric range validation within valid range."""
        result = ArgumentValidator.validate_numeric_range(7, min_value=5, max_value=10, field_name="test_value")
        
        self.assertTrue(result.is_valid)
        self.assertEqual(result.sanitized_value, 7)

    def test_validate_api_key_required_missing(self):
        """Test API key validation when required but missing."""
        result = ArgumentValidator.validate_api_key(None, required=True)
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("API key is required", result.get_error_messages()[0])

    def test_validate_api_key_too_short(self):
        """Test API key validation with too short key."""
        result = ArgumentValidator.validate_api_key("short")
        
        self.assertTrue(result.is_valid)  # Short keys are warnings, not errors
        self.assertTrue(result.has_warnings)
        self.assertIn("too short", result.get_warning_messages()[0])

    def test_validate_api_key_with_spaces(self):
        """Test API key validation with spaces."""
        result = ArgumentValidator.validate_api_key("api key with spaces")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("contains spaces", result.get_error_messages()[0])

    def test_validate_api_key_placeholder(self):
        """Test API key validation with placeholder value."""
        result = ArgumentValidator.validate_api_key("your-api-key")
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors)
        self.assertIn("placeholder", result.get_error_messages()[0])

    def test_validate_api_key_valid(self):
        """Test API key validation with valid key."""
        result = ArgumentValidator.validate_api_key("sk-1234567890abcdef")
        
        self.assertTrue(result.is_valid)
        self.assertEqual(result.sanitized_value, "sk-1234567890abcdef")

    def test_validate_all_arguments_comprehensive(self):
        """Test comprehensive argument validation."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as input_file:
            input_path = input_file.name
        
        try:
            args = {
                'input_file': input_path,
                'output_file': '/tmp/output.srt',
                'language': 'zh-yue',
                'subtitle': 'en',
                'model': 'large-v3',
                'priority': 'quality',
                'charset': 'traditional',
                'max_chunk_duration': 30,
                'gemini_api_key': 'valid-key-1234567890',
                'speakers': True,
                'verbose': False
            }
            
            with patch('src.domain.value_objects.LanguageCode.is_supported', return_value=True):
                with patch('src.domain.value_objects.LanguageCode.from_string') as mock_from_string:
                    mock_lang = Mock()
                    mock_lang.__str__ = Mock(side_effect=['zh-yue', 'en'])
                    mock_from_string.return_value = mock_lang
                    
                    is_valid, issues, sanitized_args = ArgumentValidator.validate_all_arguments(args)
            
            # Should be valid or have only warnings
            error_issues = [issue for issue in issues if issue.severity == ValidationSeverity.ERROR]
            
            # Check that sanitized arguments contain expected values
            self.assertIn('input_file', sanitized_args)
            self.assertIn('speakers', sanitized_args)
            self.assertIn('verbose', sanitized_args)
            
        finally:
            os.unlink(input_path)

    def test_validation_issue_dataclass(self):
        """Test ValidationIssue dataclass."""
        issue = ValidationIssue(
            field="test_field",
            message="Test message",
            severity=ValidationSeverity.WARNING,
            suggestion="Test suggestion"
        )
        
        self.assertEqual(issue.field, "test_field")
        self.assertEqual(issue.message, "Test message")
        self.assertEqual(issue.severity, ValidationSeverity.WARNING)
        self.assertEqual(issue.suggestion, "Test suggestion")

    def test_validation_severity_enum(self):
        """Test ValidationSeverity enum values."""
        self.assertEqual(ValidationSeverity.ERROR.value, "error")
        self.assertEqual(ValidationSeverity.WARNING.value, "warning")
        self.assertEqual(ValidationSeverity.INFO.value, "info")


if __name__ == '__main__':
    unittest.main()