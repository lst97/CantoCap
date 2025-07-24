"""Tests for error handling infrastructure."""

import unittest
from unittest.mock import Mock, patch, mock_open
import sys
import os
from pathlib import Path
import tempfile

from src.infrastructure.error_handling import (
    CantoCapError, AudioProcessingError, TranscriptionError, LLMProcessingError,
    FileSystemError, DependencyError, ConfigurationError, ValidationError,
    handle_error, handle_warning, safe_execute, robust_file_operation,
    check_dependencies, validate_file_path, validate_audio_file,
    set_global_ipc_mode, get_global_ipc_mode, setup_global_error_handler,
    _print_error, _print_warning
)


class TestCantoCapErrors(unittest.TestCase):
    """Test cases for CantoCap error classes."""

    def test_cantocap_error_basic(self):
        """Test basic CantoCapError creation."""
        error = CantoCapError("Test error message")
        
        self.assertEqual(str(error), "Test error message")
        self.assertEqual(error.message, "Test error message")
        self.assertEqual(error.error_code, "CantoCapError")
        self.assertEqual(error.details, {})

    def test_cantocap_error_with_code_and_details(self):
        """Test CantoCapError with error code and details."""
        details = {"file": "test.mp3", "line": 42}
        error = CantoCapError("Test error", error_code="TEST_001", details=details)
        
        self.assertEqual(error.message, "Test error")
        self.assertEqual(error.error_code, "TEST_001")
        self.assertEqual(error.details, details)

    def test_audio_processing_error(self):
        """Test AudioProcessingError inheritance."""
        error = AudioProcessingError("Audio processing failed")
        
        self.assertIsInstance(error, CantoCapError)
        self.assertEqual(error.error_code, "AudioProcessingError")

    def test_transcription_error(self):
        """Test TranscriptionError inheritance."""
        error = TranscriptionError("Transcription failed")
        
        self.assertIsInstance(error, CantoCapError)
        self.assertEqual(error.error_code, "TranscriptionError")

    def test_llm_processing_error(self):
        """Test LLMProcessingError inheritance."""
        error = LLMProcessingError("LLM processing failed")
        
        self.assertIsInstance(error, CantoCapError)
        self.assertEqual(error.error_code, "LLMProcessingError")

    def test_file_system_error(self):
        """Test FileSystemError inheritance."""
        error = FileSystemError("File system operation failed")
        
        self.assertIsInstance(error, CantoCapError)
        self.assertEqual(error.error_code, "FileSystemError")

    def test_dependency_error(self):
        """Test DependencyError inheritance."""
        error = DependencyError("Missing dependency")
        
        self.assertIsInstance(error, CantoCapError)
        self.assertEqual(error.error_code, "DependencyError")

    def test_configuration_error(self):
        """Test ConfigurationError inheritance."""
        error = ConfigurationError("Configuration invalid")
        
        self.assertIsInstance(error, CantoCapError)
        self.assertEqual(error.error_code, "ConfigurationError")

    def test_validation_error(self):
        """Test ValidationError inheritance."""
        error = ValidationError("Validation failed")
        
        self.assertIsInstance(error, CantoCapError)
        self.assertEqual(error.error_code, "ValidationError")


class TestErrorHandling(unittest.TestCase):
    """Test cases for error handling functions."""

    def setUp(self):
        """Set up test fixtures."""
        # Reset global IPC mode
        set_global_ipc_mode(False)

    @patch('src.infrastructure.error_handling._rich_available', True)
    @patch('src.infrastructure.error_handling._console')
    def test_print_error_with_rich(self, mock_console):
        """Test error printing with Rich available."""
        _print_error("Test error", "TestError", {"key": "value"})
        
        mock_console.print.assert_called_once()

    @patch('src.infrastructure.error_handling._rich_available', False)
    @patch('builtins.print')
    def test_print_error_without_rich(self, mock_print):
        """Test error printing without Rich."""
        _print_error("Test error", "TestError", {"key": "value"})
        
        mock_print.assert_called()

    @patch('src.infrastructure.error_handling._rich_available', True)
    @patch('src.infrastructure.error_handling._console')
    def test_print_warning_with_rich(self, mock_console):
        """Test warning printing with Rich available."""
        _print_warning("Test warning", {"key": "value"})
        
        mock_console.print.assert_called_once()

    @patch('src.infrastructure.error_handling._rich_available', False)
    @patch('builtins.print')
    def test_print_warning_without_rich(self, mock_print):
        """Test warning printing without Rich."""
        _print_warning("Test warning", {"key": "value"})
        
        mock_print.assert_called()

    @patch('src.infrastructure.error_handling._print_error')
    def test_handle_error_basic(self, mock_print_error):
        """Test basic error handling."""
        error = CantoCapError("Test error")
        
        handle_error(error, context="Test context")
        
        mock_print_error.assert_called_once()

    @patch('src.infrastructure.error_handling._print_error')
    def test_handle_error_with_details(self, mock_print_error):
        """Test error handling with custom details."""
        error = CantoCapError("Test error", details={"custom": "detail"})
        
        handle_error(error, context="Test context", show_traceback=True)
        
        mock_print_error.assert_called_once()

    @patch('sys.exit')
    @patch('src.infrastructure.error_handling._print_error')
    def test_handle_error_with_exit(self, mock_print_error, mock_exit):
        """Test error handling with exit code."""
        error = CantoCapError("Test error")
        
        handle_error(error, exit_code=1)
        
        mock_print_error.assert_called_once()
        mock_exit.assert_called_once_with(1)

    @patch('src.infrastructure.error_handling._print_warning')
    def test_handle_warning_basic(self, mock_print_warning):
        """Test basic warning handling."""
        handle_warning("Test warning", context="Test context")
        
        mock_print_warning.assert_called_once()

    @patch('src.infrastructure.error_handling._print_warning')
    def test_handle_warning_with_details(self, mock_print_warning):
        """Test warning handling with details."""
        details = {"key": "value"}
        
        handle_warning("Test warning", details=details)
        
        mock_print_warning.assert_called_once()

    def test_safe_execute_success(self):
        """Test safe_execute with successful function."""
        def successful_func():
            return "success"
        
        result = safe_execute(successful_func)
        
        self.assertEqual(result, "success")

    def test_safe_execute_with_cantocap_error_reraise(self):
        """Test safe_execute with CantoCapError and reraise=True."""
        def failing_func():
            raise CantoCapError("Test error")
        
        with self.assertRaises(CantoCapError):
            safe_execute(failing_func, reraise=True)

    def test_safe_execute_with_generic_error_reraise(self):
        """Test safe_execute with generic error and reraise=True."""
        def failing_func():
            raise ValueError("Generic error")
        
        with self.assertRaises(CantoCapError):
            safe_execute(failing_func, reraise=True)

    @patch('src.infrastructure.error_handling.handle_warning')
    def test_safe_execute_with_error_no_reraise(self, mock_handle_warning):
        """Test safe_execute without reraising errors."""
        def failing_func():
            raise ValueError("Generic error")
        
        result = safe_execute(failing_func, reraise=False, default_return="default")
        
        self.assertEqual(result, "default")
        mock_handle_warning.assert_called_once()

    def test_robust_file_operation_success(self):
        """Test robust_file_operation decorator with successful operation."""
        @robust_file_operation("test operation", "/test/path")
        def successful_operation():
            return "success"
        
        result = successful_operation()
        
        self.assertEqual(result, "success")

    def test_robust_file_operation_file_not_found(self):
        """Test robust_file_operation with FileNotFoundError."""
        @robust_file_operation("test operation", "/test/path")
        def failing_operation():
            raise FileNotFoundError("File not found")
        
        with self.assertRaises(FileSystemError) as context:
            failing_operation()
        
        self.assertIn("File not found during test operation", str(context.exception))

    def test_robust_file_operation_permission_error(self):
        """Test robust_file_operation with PermissionError."""
        @robust_file_operation("test operation", "/test/path")
        def failing_operation():
            raise PermissionError("Permission denied")
        
        with self.assertRaises(FileSystemError) as context:
            failing_operation()
        
        self.assertIn("Permission denied during test operation", str(context.exception))

    def test_robust_file_operation_os_error(self):
        """Test robust_file_operation with OSError."""
        @robust_file_operation("test operation", "/test/path")
        def failing_operation():
            raise OSError("OS error")
        
        with self.assertRaises(FileSystemError) as context:
            failing_operation()
        
        self.assertIn("OS error during test operation", str(context.exception))

    def test_robust_file_operation_generic_error(self):
        """Test robust_file_operation with generic exception."""
        @robust_file_operation("test operation", "/test/path")
        def failing_operation():
            raise ValueError("Generic error")
        
        with self.assertRaises(FileSystemError) as context:
            failing_operation()
        
        self.assertIn("Unexpected error during test operation", str(context.exception))

    def test_check_dependencies_all_available(self):
        """Test check_dependencies with all dependencies available."""
        # Use built-in modules that should always be available
        dependencies = ["os", "sys", "pathlib"]
        
        # Should not raise an exception
        check_dependencies(dependencies)

    def test_check_dependencies_missing_dependency(self):
        """Test check_dependencies with missing dependency."""
        dependencies = ["non_existent_module_12345"]
        
        with self.assertRaises(DependencyError) as context:
            check_dependencies(dependencies, "Test operation")
        
        self.assertIn("Missing required dependencies", str(context.exception))
        self.assertIn("non_existent_module_12345", context.exception.details["missing_dependencies"])

    def test_check_dependencies_mixed_availability(self):
        """Test check_dependencies with mixed available/missing dependencies."""
        dependencies = ["os", "non_existent_module_12345", "sys"]
        
        with self.assertRaises(DependencyError) as context:
            check_dependencies(dependencies)
        
        missing = context.exception.details["missing_dependencies"]
        self.assertEqual(missing, ["non_existent_module_12345"])

    def test_validate_file_path_success(self):
        """Test validate_file_path with valid file."""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = validate_file_path(tmp_path)
            self.assertEqual(result, Path(tmp_path))
        finally:
            os.unlink(tmp_path)

    def test_validate_file_path_not_exist_required(self):
        """Test validate_file_path when file doesn't exist but is required."""
        non_existent_path = "/non/existent/file.txt"
        
        with self.assertRaises(ValidationError) as context:
            validate_file_path(non_existent_path, must_exist=True)
        
        self.assertIn("File does not exist", str(context.exception))

    def test_validate_file_path_not_exist_not_required(self):
        """Test validate_file_path when file doesn't exist and is not required."""
        non_existent_path = "/non/existent/file.txt"
        
        result = validate_file_path(non_existent_path, must_exist=False)
        
        self.assertEqual(result, Path(non_existent_path))

    def test_validate_file_path_directory_when_file_required(self):
        """Test validate_file_path with directory when file is required."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            with self.assertRaises(ValidationError) as context:
                validate_file_path(tmp_dir, must_be_file=True)
            
            self.assertIn("Path is not a file", str(context.exception))

    @patch('os.access')
    def test_validate_file_path_not_readable(self, mock_access):
        """Test validate_file_path when file is not readable."""
        mock_access.return_value = False
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            with self.assertRaises(ValidationError) as context:
                validate_file_path(tmp_path, readable=True)
            
            self.assertIn("File is not readable", str(context.exception))
        finally:
            os.unlink(tmp_path)

    @patch('os.access')
    def test_validate_file_path_not_writable(self, mock_access):
        """Test validate_file_path when file is not writable."""
        def access_side_effect(path, mode):
            if mode == os.R_OK:
                return True
            elif mode == os.W_OK:
                return False
            return True
        
        mock_access.side_effect = access_side_effect
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            with self.assertRaises(ValidationError) as context:
                validate_file_path(tmp_path, writable=True)
            
            self.assertIn("File is not writable", str(context.exception))
        finally:
            os.unlink(tmp_path)

    @patch('src.infrastructure.error_handling.handle_warning')
    def test_validate_audio_file_success(self, mock_handle_warning):
        """Test validate_audio_file with valid audio file."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = validate_audio_file(tmp_path)
            self.assertEqual(result, Path(tmp_path))
        finally:
            os.unlink(tmp_path)

    @patch('src.infrastructure.error_handling.handle_warning')
    def test_validate_audio_file_unsupported_extension(self, mock_handle_warning):
        """Test validate_audio_file with unsupported extension."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            result = validate_audio_file(tmp_path)
            self.assertEqual(result, Path(tmp_path))
            mock_handle_warning.assert_called()
        finally:
            os.unlink(tmp_path)

    @patch('src.infrastructure.error_handling.handle_warning')
    def test_validate_audio_file_large_file_warning(self, mock_handle_warning):
        """Test validate_audio_file with large file warning."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name
        
        # Mock the file size to be large
        import stat
        from unittest.mock import MagicMock
        with patch.object(Path, 'stat') as mock_stat:
            stat_result = MagicMock()
            stat_result.st_size = 1500 * 1024 * 1024  # 1.5GB
            stat_result.st_mode = stat.S_IFREG  # Regular file
            mock_stat.return_value = stat_result
            
            try:
                result = validate_audio_file(tmp_path)
                self.assertEqual(result, Path(tmp_path))
                mock_handle_warning.assert_called()
            finally:
                os.unlink(tmp_path)

    def test_set_get_global_ipc_mode(self):
        """Test setting and getting global IPC mode."""
        # Initial state should be False
        self.assertFalse(get_global_ipc_mode())
        
        # Set to True
        set_global_ipc_mode(True)
        self.assertTrue(get_global_ipc_mode())
        
        # Set back to False
        set_global_ipc_mode(False)
        self.assertFalse(get_global_ipc_mode())

    @patch('sys.exit')
    def test_setup_global_error_handler_keyboard_interrupt(self, mock_exit):
        """Test global error handler with KeyboardInterrupt."""
        setup_global_error_handler()
        
        # Simulate KeyboardInterrupt
        try:
            raise KeyboardInterrupt()
        except KeyboardInterrupt:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            sys.excepthook(exc_type, exc_value, exc_traceback)
        
        mock_exit.assert_called_once_with(1)

    @patch('src.infrastructure.error_handling.handle_error')
    def test_setup_global_error_handler_generic_exception(self, mock_handle_error):
        """Test global error handler with generic exception."""
        setup_global_error_handler()
        
        # Simulate generic exception
        try:
            raise ValueError("Test error")
        except ValueError:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            sys.excepthook(exc_type, exc_value, exc_traceback)
        
        mock_handle_error.assert_called_once()

    def test_error_with_details_serialization(self):
        """Test that error details are properly serialized."""
        details = {
            "file_path": "/test/path.mp3",
            "error_code": "AUDIO_001",
            "timestamp": "2023-01-01T00:00:00Z"
        }
        
        error = AudioProcessingError("Processing failed", details=details)
        
        self.assertEqual(error.details, details)
        self.assertIn("file_path", error.details)
        self.assertIn("error_code", error.details)

    def test_robust_file_operation_preserves_function_metadata(self):
        """Test that robust_file_operation preserves function metadata."""
        @robust_file_operation("test operation", "/test/path")
        def test_function():
            """Test function docstring."""
            return "test"
        
        self.assertEqual(test_function.__name__, "test_function")
        self.assertEqual(test_function.__doc__, "Test function docstring.")


class TestIpcModeErrorHandling(unittest.TestCase):
    """Test cases for IPC mode error handling."""

    def setUp(self):
        """Set up test fixtures."""
        set_global_ipc_mode(True)

    def tearDown(self):
        """Clean up after tests."""
        set_global_ipc_mode(False)

    @patch('src.infrastructure.error_handling._output_json')
    def test_handle_error_ipc_mode(self, mock_output_json):
        """Test error handling in IPC mode."""
        error = CantoCapError("Test error", error_code="TEST_001", details={"key": "value"})
        
        # Mock the import path
        with patch('src.infrastructure.error_handling._output_json', mock_output_json):
            handle_error(error, context="Test context", ipc_mode=True)
        
        mock_output_json.assert_called_once()
        call_args = mock_output_json.call_args[0]
        self.assertEqual(call_args[0], "error")
        error_data = call_args[1]
        self.assertIn("error", error_data)
        self.assertIn("error_type", error_data)
        self.assertIn("context", error_data)

    @patch('src.infrastructure.error_handling.ipc_log')
    def test_handle_warning_ipc_mode(self, mock_ipc_log):
        """Test warning handling in IPC mode."""
        with patch('src.infrastructure.error_handling.ipc_log', mock_ipc_log):
            handle_warning("Test warning", context="Test context", ipc_mode=True)
        
        mock_ipc_log.assert_called_once()


if __name__ == '__main__':
    unittest.main()