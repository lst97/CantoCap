"""
Unit tests for IPC error handling integration.
"""

import pytest
import json
import sys
from io import StringIO
from unittest.mock import patch, MagicMock

from src.infrastructure.error_handling import (
    handle_error, handle_warning, safe_execute, set_global_ipc_mode, get_global_ipc_mode,
    CantoSubError, AudioProcessingError, TranscriptionError
)


class TestIPCErrorHandling:
    """Test suite for IPC error handling integration."""
    
    def setup_method(self):
        """Setup for each test method."""
        # Reset global IPC mode
        set_global_ipc_mode(False)
    
    def test_handle_error_with_ipc_mode_enabled(self):
        """Test that handle_error outputs JSON when IPC mode is enabled."""
        error = AudioProcessingError(
            "Test error message",
            error_code="TEST_ERROR",
            details={"test_detail": "test_value"}
        )
        
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            with patch('sys.exit') as mock_exit:
                handle_error(error, context="Test context", ipc_mode=True)
                
                # Verify JSON output
                output = mock_stdout.getvalue().strip()
                json_data = json.loads(output)
                
                assert json_data["type"] == "error"
                assert json_data["data"]["error"] == "Test error message"
                assert json_data["data"]["error_type"] == "AudioProcessingError"
                assert json_data["data"]["context"] == "Test context"
                assert json_data["data"]["error_code"] == "TEST_ERROR"
                assert json_data["data"]["test_detail"] == "test_value"
                assert "timestamp" in json_data
                
                # Verify exit was not called (no exit_code provided)
                mock_exit.assert_not_called()
    
    def test_handle_error_with_ipc_mode_disabled(self):
        """Test that handle_error uses rich output when IPC mode is disabled."""
        error = AudioProcessingError("Test error message")
        
        with patch('src.infrastructure.error_handling._print_error') as mock_print_error:
            with patch('sys.exit') as mock_exit:
                handle_error(error, context="Test context", ipc_mode=False)
                
                # Verify rich output was called
                mock_print_error.assert_called_once()
                mock_exit.assert_not_called()
    
    def test_handle_error_with_exit_code(self):
        """Test that handle_error exits with correct code in IPC mode."""
        error = TranscriptionError("Test error")
        
        with patch('sys.stdout', new_callable=StringIO):
            with patch('sys.exit') as mock_exit:
                handle_error(error, exit_code=2, ipc_mode=True)
                mock_exit.assert_called_once_with(2)
    
    def test_handle_error_with_traceback(self):
        """Test that handle_error includes traceback when requested in IPC mode."""
        error = CantoSubError("Test error")
        
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            with patch('traceback.format_exc', return_value="Mock traceback"):
                handle_error(error, show_traceback=True, ipc_mode=True)
                
                output = mock_stdout.getvalue().strip()
                json_data = json.loads(output)
                
                assert json_data["data"]["traceback"] == "Mock traceback"
    
    def test_handle_warning_with_ipc_mode_enabled(self):
        """Test that handle_warning outputs JSON log when IPC mode is enabled."""
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            handle_warning(
                "Test warning message",
                context="Test context",
                details={"detail_key": "detail_value"},
                ipc_mode=True
            )
            
            output = mock_stdout.getvalue().strip()
            json_data = json.loads(output)
            
            assert json_data["type"] == "log"
            assert json_data["data"]["level"] == "warning"
            assert "Test warning message" in json_data["data"]["message"]
            assert "context" in json_data["data"]["message"]
            assert "detail_key" in json_data["data"]["message"]
    
    def test_handle_warning_with_ipc_mode_disabled(self):
        """Test that handle_warning uses rich output when IPC mode is disabled."""
        with patch('src.infrastructure.error_handling._print_warning') as mock_print_warning:
            handle_warning("Test warning", ipc_mode=False)
            mock_print_warning.assert_called_once()
    
    def test_safe_execute_with_ipc_mode_warning(self):
        """Test that safe_execute uses IPC mode for warnings when reraise=False."""
        def failing_function():
            raise ValueError("Test error")
        
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            result = safe_execute(
                failing_function,
                error_message="Operation failed",
                reraise=False,
                default_return="default",
                ipc_mode=True
            )
            
            assert result == "default"
            
            output = mock_stdout.getvalue().strip()
            json_data = json.loads(output)
            
            assert json_data["type"] == "log"
            assert json_data["data"]["level"] == "warning"
            assert "Operation failed" in json_data["data"]["message"]
    
    def test_global_ipc_mode_setting(self):
        """Test global IPC mode setting and getting."""
        assert get_global_ipc_mode() is False
        
        set_global_ipc_mode(True)
        assert get_global_ipc_mode() is True
        
        set_global_ipc_mode(False)
        assert get_global_ipc_mode() is False
    
    def test_global_error_handler_with_ipc_mode(self):
        """Test that global error handler respects IPC mode."""
        from src.infrastructure.error_handling import setup_global_error_handler
        
        # Set IPC mode
        set_global_ipc_mode(True)
        
        # Setup global error handler
        setup_global_error_handler()
        
        # Mock exception
        test_exception = RuntimeError("Test global error")
        
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            with patch('sys.exit') as mock_exit:
                # Simulate global exception
                sys.excepthook(RuntimeError, test_exception, None)
                
                output = mock_stdout.getvalue().strip()
                json_data = json.loads(output)
                
                assert json_data["type"] == "error"
                assert json_data["data"]["error"] == "Test global error"
                assert json_data["data"]["context"] == "Global exception handler"
                mock_exit.assert_called_once_with(1)
    
    def test_keyboard_interrupt_with_ipc_mode(self):
        """Test that KeyboardInterrupt is handled correctly in IPC mode."""
        from src.infrastructure.error_handling import setup_global_error_handler
        
        set_global_ipc_mode(True)
        setup_global_error_handler()
        
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            with patch('sys.exit') as mock_exit:
                sys.excepthook(KeyboardInterrupt, KeyboardInterrupt(), None)
                
                output = mock_stdout.getvalue().strip()
                json_data = json.loads(output)
                
                assert json_data["type"] == "error"
                assert json_data["data"]["error"] == "Operation cancelled by user"
                assert json_data["data"]["reason"] == "keyboard_interrupt"
                mock_exit.assert_called_once_with(1)
    
    def test_error_with_no_details(self):
        """Test error handling when error has no custom details."""
        error = Exception("Simple error")
        
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            handle_error(error, context="Test", ipc_mode=True)
            
            output = mock_stdout.getvalue().strip()
            json_data = json.loads(output)
            
            assert json_data["data"]["error"] == "Simple error"
            assert json_data["data"]["error_type"] == "Exception"
            assert json_data["data"]["context"] == "Test"
            # Should not have error_code or custom details
            assert "error_code" not in json_data["data"]
    
    def test_json_serialization_error_fallback(self):
        """Test fallback when JSON serialization fails."""
        # Create an object that can't be serialized
        class UnserializableError(Exception):
            def __init__(self):
                self.unserializable = object()  # Can't be JSON serialized
        
        error = UnserializableError()
        
        with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
            # This should trigger the JSON serialization fallback in ipc_error
            handle_error(error, ipc_mode=True)
            
            output = mock_stdout.getvalue().strip()
            # Should still get valid JSON output (the fallback error message)
            json_data = json.loads(output)
            assert json_data["type"] == "error"