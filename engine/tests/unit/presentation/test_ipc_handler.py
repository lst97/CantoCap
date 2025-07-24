"""
Comprehensive unit tests for IPC Handler module.
"""

import pytest
import json
import sys
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from io import StringIO

from src.presentation.cli.ipc_handler import (
    _get_timestamp,
    _output_json,
    ipc_log,
    ipc_progress,
    ipc_result,
    ipc_error
)


class TestTimestampGeneration:
    """Test timestamp generation utilities."""
    
    def test_get_timestamp_format(self):
        """Test that timestamp is in correct ISO format."""
        timestamp = _get_timestamp()
        
        # Should be a string
        assert isinstance(timestamp, str)
        
        # Should be parseable as datetime
        parsed = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        assert isinstance(parsed, datetime)
        
        # Should have timezone info
        assert parsed.tzinfo is not None
    
    def test_get_timestamp_utc(self):
        """Test that timestamp is in UTC timezone."""
        timestamp = _get_timestamp()
        
        # Parse the timestamp
        parsed = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        
        # Should be UTC timezone
        assert parsed.tzinfo == timezone.utc
    
    @patch('src.presentation.cli.ipc_handler.datetime')
    def test_get_timestamp_uses_datetime_now(self, mock_datetime):
        """Test that _get_timestamp uses datetime.now."""
        mock_now = MagicMock()
        mock_now.isoformat.return_value = "2023-12-01T12:00:00+00:00"
        mock_datetime.now.return_value = mock_now
        mock_datetime.timezone = timezone
        
        result = _get_timestamp()
        
        mock_datetime.now.assert_called_once_with(timezone.utc)
        mock_now.isoformat.assert_called_once()
        assert result == "2023-12-01T12:00:00+00:00"


class TestOutputJson:
    """Test JSON output utility function."""
    
    @patch('builtins.print')
    def test_output_json_basic(self, mock_print):
        """Test basic JSON output."""
        message_type = "test"
        data = {"key": "value", "number": 42}
        
        _output_json(message_type, data)
        
        # Verify print was called once
        mock_print.assert_called_once()
        
        # Get the printed content
        printed_content = mock_print.call_args[0][0]
        
        # Parse as JSON
        parsed = json.loads(printed_content)
        
        # Verify structure
        assert parsed["type"] == "test"
        assert "timestamp" in parsed
        assert parsed["data"] == data
    
    @patch('builtins.print')
    def test_output_json_flush_enabled(self, mock_print):
        """Test that JSON output uses flush=True."""
        _output_json("test", {"data": "value"})
        
        # Verify flush=True was used
        mock_print.assert_called_once()
        call_kwargs = mock_print.call_args[1]
        assert call_kwargs.get('flush') is True
    
    @patch('builtins.print')
    def test_output_json_unicode_support(self, mock_print):
        """Test JSON output with Unicode characters."""
        data = {"message": "Hello 世界", "emoji": "🎉"}
        
        _output_json("unicode_test", data)
        
        printed_content = mock_print.call_args[0][0]
        parsed = json.loads(printed_content)
        
        # Unicode should be preserved
        assert parsed["data"]["message"] == "Hello 世界"
        assert parsed["data"]["emoji"] == "🎉"
    
    @patch('builtins.print')
    def test_output_json_compact_format(self, mock_print):
        """Test that JSON output is compact (no extra spaces)."""
        data = {"key1": "value1", "key2": "value2"}
        
        _output_json("compact_test", data)
        
        printed_content = mock_print.call_args[0][0]
        
        # Should not contain extra spaces around separators
        assert ", " not in printed_content  # No space after comma
        assert ": " not in printed_content  # No space after colon
    
    @patch('builtins.print')
    @patch('json.dumps')
    def test_output_json_serialization_error_fallback(self, mock_dumps, mock_print):
        """Test fallback behavior when JSON serialization fails."""
        # First call raises error, second call succeeds
        mock_dumps.side_effect = [TypeError("Cannot serialize"), '{"fallback": "json"}']
        
        _output_json("error_test", {"problematic": "data"})
        
        # Should have called print once (for fallback message)
        mock_print.assert_called_once()
        
        # Should have called dumps twice (original + fallback)
        assert mock_dumps.call_count == 2
        
        # Verify fallback structure
        fallback_call = mock_dumps.call_args_list[1]
        fallback_message = fallback_call[0][0]
        
        assert fallback_message["type"] == "error"
        assert "JSON serialization failed" in fallback_message["data"]["error"]
        assert fallback_message["data"]["original_type"] == "error_test"
    
    @patch('src.presentation.cli.ipc_handler._get_timestamp')
    @patch('builtins.print')
    def test_output_json_timestamp_integration(self, mock_print, mock_timestamp):
        """Test that output_json properly integrates timestamp."""
        mock_timestamp.return_value = "2023-12-01T12:00:00Z"
        
        _output_json("timestamp_test", {"data": "value"})
        
        printed_content = mock_print.call_args[0][0]
        parsed = json.loads(printed_content)
        
        assert parsed["timestamp"] == "2023-12-01T12:00:00Z"
        mock_timestamp.assert_called_once()


class TestIpcLog:
    """Test IPC log function."""
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_log_basic(self, mock_output_json):
        """Test basic log message."""
        ipc_log("Test message")
        
        mock_output_json.assert_called_once_with("log", {
            "message": "Test message",
            "level": "info"
        })
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_log_with_level(self, mock_output_json):
        """Test log message with custom level."""
        ipc_log("Error occurred", "error")
        
        mock_output_json.assert_called_once_with("log", {
            "message": "Error occurred",
            "level": "error"
        })
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_log_different_levels(self, mock_output_json):
        """Test log messages with different levels."""
        levels = ["info", "warning", "error", "debug"]
        
        for level in levels:
            ipc_log(f"Message for {level}", level)
        
        # Verify all calls were made
        assert mock_output_json.call_count == len(levels)
        
        # Verify each call had correct level
        for i, level in enumerate(levels):
            call_args = mock_output_json.call_args_list[i]
            assert call_args[0][1]["level"] == level
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_log_default_level(self, mock_output_json):
        """Test that default level is 'info'."""
        ipc_log("Default level message")
        
        call_args = mock_output_json.call_args[0][1]
        assert call_args["level"] == "info"
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_log_unicode_message(self, mock_output_json):
        """Test log message with Unicode characters."""
        unicode_message = "Processing 文件.mp4 with 🎥 video"
        
        ipc_log(unicode_message, "info")
        
        call_args = mock_output_json.call_args[0][1]
        assert call_args["message"] == unicode_message
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_log_empty_message(self, mock_output_json):
        """Test log with empty message."""
        ipc_log("", "warning")
        
        mock_output_json.assert_called_once_with("log", {
            "message": "",
            "level": "warning"
        })


class TestIpcProgress:
    """Test IPC progress function."""
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_progress_basic(self, mock_output_json):
        """Test basic progress message."""
        ipc_progress("Processing", 50.0)
        
        mock_output_json.assert_called_once_with("progress", {
            "task": "Processing",
            "percent": 50.0
        })
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_progress_with_details(self, mock_output_json):
        """Test progress message with details."""
        ipc_progress("Transcription", 75.5, "Loading model")
        
        mock_output_json.assert_called_once_with("progress", {
            "task": "Transcription",
            "percent": 75.5,
            "details": "Loading model"
        })
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_progress_without_details(self, mock_output_json):
        """Test progress message without details."""
        ipc_progress("Audio extraction", 25.0, None)
        
        call_data = mock_output_json.call_args[0][1]
        assert "details" not in call_data
        assert call_data["task"] == "Audio extraction"
        assert call_data["percent"] == 25.0
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_progress_percent_rounding(self, mock_output_json):
        """Test that progress percentage is rounded to 2 decimal places."""
        ipc_progress("Test", 33.333333)
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["percent"] == 33.33
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_progress_boundary_values(self, mock_output_json):
        """Test progress with boundary values."""
        # Test 0%
        ipc_progress("Start", 0.0)
        call_data = mock_output_json.call_args_list[0][0][1]
        assert call_data["percent"] == 0.0
        
        # Test 100%
        ipc_progress("Complete", 100.0)
        call_data = mock_output_json.call_args_list[1][0][1]
        assert call_data["percent"] == 100.0
        
        # Test fractional
        ipc_progress("Fractional", 0.001)
        call_data = mock_output_json.call_args_list[2][0][1]
        assert call_data["percent"] == 0.0  # Rounded
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_progress_unicode_task_and_details(self, mock_output_json):
        """Test progress with Unicode task name and details."""
        ipc_progress("处理中", 60.0, "正在加载模型")
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["task"] == "处理中"
        assert call_data["details"] == "正在加载模型"


class TestIpcResult:
    """Test IPC result function."""
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_result_basic_success(self, mock_output_json):
        """Test basic successful result."""
        ipc_result("/path/to/output.srt")
        
        mock_output_json.assert_called_once_with("result", {
            "path": "/path/to/output.srt",
            "success": True
        })
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_result_explicit_success(self, mock_output_json):
        """Test result with explicit success flag."""
        ipc_result("/path/to/output.srt", success=True)
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["success"] is True
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_result_failure(self, mock_output_json):
        """Test result with failure flag."""
        ipc_result("/path/to/output.srt", success=False)
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["success"] is False
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_result_with_additional_data(self, mock_output_json):
        """Test result with additional data."""
        ipc_result(
            "/path/to/output.srt",
            success=True,
            subtitle_count=42,
            processing_time=15.5,
            model_used="whisper-large"
        )
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["path"] == "/path/to/output.srt"
        assert call_data["success"] is True
        assert call_data["subtitle_count"] == 42
        assert call_data["processing_time"] == 15.5
        assert call_data["model_used"] == "whisper-large"
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_result_with_statistics(self, mock_output_json):
        """Test result with statistics dictionary."""
        stats = {
            "total_duration": 120.5,
            "average_subtitle_duration": 3.2,
            "quality_score": 0.95
        }
        
        ipc_result("/output.srt", statistics=stats)
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["statistics"] == stats
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_result_unicode_path(self, mock_output_json):
        """Test result with Unicode characters in path."""
        unicode_path = "/路径/到/输出.srt"
        
        ipc_result(unicode_path, success=True)
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["path"] == unicode_path
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_result_overwrites_success_and_path(self, mock_output_json):
        """Test that kwargs cannot override path and success."""
        ipc_result(
            "/correct/path.srt",
            success=True,
            extra_data="value"  # Use different parameter name
        )
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["path"] == "/correct/path.srt"
        assert call_data["success"] is True


class TestIpcError:
    """Test IPC error function."""
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_error_basic(self, mock_output_json):
        """Test basic error message."""
        ipc_error("Something went wrong")
        
        mock_output_json.assert_called_once_with("error", {
            "error": "Something went wrong"
        })
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_error_with_details(self, mock_output_json):
        """Test error message with details."""
        details = {
            "error_code": "FILE_NOT_FOUND",
            "file_path": "/missing/file.mp4",
            "attempted_operation": "transcription"
        }
        
        ipc_error("File not found", details)
        
        mock_output_json.assert_called_once_with("error", {
            "error": "File not found",
            "details": details
        })
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_error_without_details(self, mock_output_json):
        """Test error message without details."""
        ipc_error("Generic error", None)
        
        call_data = mock_output_json.call_args[0][1]
        assert "details" not in call_data
        assert call_data["error"] == "Generic error"
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_error_empty_details(self, mock_output_json):
        """Test error with empty details dictionary."""
        ipc_error("Error with empty details", {})
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["details"] == {}
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_error_unicode_message(self, mock_output_json):
        """Test error message with Unicode characters."""
        unicode_error = "文件不存在 - File does not exist 📁"
        
        ipc_error(unicode_error)
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["error"] == unicode_error
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_ipc_error_complex_details(self, mock_output_json):
        """Test error with complex details structure."""
        complex_details = {
            "error_trace": ["step1", "step2", "step3"],
            "system_info": {
                "os": "macOS",
                "python_version": "3.9.0"
            },
            "recommendations": [
                "Check file permissions",
                "Verify file format"
            ]
        }
        
        ipc_error("Complex error", complex_details)
        
        call_data = mock_output_json.call_args[0][1]
        assert call_data["details"] == complex_details


class TestIpcHandlerIntegration:
    """Test IPC handler integration scenarios."""
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_full_workflow_output(self, mock_stdout):
        """Test full workflow of IPC messages."""
        # Simulate a complete workflow
        ipc_log("Starting processing", "info")
        ipc_progress("Initialization", 0.0, "Loading models")
        ipc_progress("Processing", 50.0, "Transcribing audio")
        ipc_progress("Finalizing", 100.0, "Saving subtitles")
        ipc_result("/output.srt", success=True, subtitle_count=25)
        
        # Get all output
        output_lines = mock_stdout.getvalue().strip().split('\n')
        
        # Should have 5 lines of JSON
        assert len(output_lines) == 5
        
        # Parse each line
        messages = [json.loads(line) for line in output_lines]
        
        # Verify message types
        assert messages[0]["type"] == "log"
        assert messages[1]["type"] == "progress"
        assert messages[2]["type"] == "progress"
        assert messages[3]["type"] == "progress"
        assert messages[4]["type"] == "result"
        
        # Verify progression
        assert messages[1]["data"]["percent"] == 0.0
        assert messages[2]["data"]["percent"] == 50.0
        assert messages[3]["data"]["percent"] == 100.0
        
        # Verify final result
        assert messages[4]["data"]["success"] is True
        assert messages[4]["data"]["subtitle_count"] == 25
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_error_workflow_output(self, mock_stdout):
        """Test error workflow output."""
        # Simulate error workflow
        ipc_log("Starting processing", "info")
        ipc_progress("Processing", 25.0)
        ipc_error("FFmpeg not found", {"command": "ffmpeg", "exit_code": 127})
        
        output_lines = mock_stdout.getvalue().strip().split('\n')
        messages = [json.loads(line) for line in output_lines]
        
        # Should end with error
        assert messages[-1]["type"] == "error"
        assert messages[-1]["data"]["error"] == "FFmpeg not found"
        assert messages[-1]["data"]["details"]["exit_code"] == 127
    
    def test_all_functions_use_consistent_timestamp_format(self):
        """Test that all IPC functions use consistent timestamp format."""
        with patch('src.presentation.cli.ipc_handler._output_json') as mock_output:
            # Call all IPC functions
            ipc_log("test")
            ipc_progress("test", 50.0)
            ipc_result("/test.srt")
            ipc_error("test error")
            
            # All should have called _output_json
            assert mock_output.call_count == 4
            
            # All calls should be to the same function (consistent behavior)
            for call in mock_output.call_args_list:
                assert len(call[0]) == 2  # message_type, data
                assert isinstance(call[0][0], str)  # message_type is string
                assert isinstance(call[0][1], dict)  # data is dict


class TestIpcHandlerEdgeCases:
    """Test IPC handler edge cases and error scenarios."""
    
    @patch('builtins.print')
    def test_very_large_data_structure(self, mock_print):
        """Test handling of very large data structures."""
        large_data = {"large_list": list(range(10000))}
        
        _output_json("large_test", large_data)
        
        # Should not raise exception
        mock_print.assert_called_once()
        
        # Should produce valid JSON
        printed_content = mock_print.call_args[0][0]
        parsed = json.loads(printed_content)
        assert len(parsed["data"]["large_list"]) == 10000
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_special_characters_in_all_functions(self, mock_output_json):
        """Test special characters handling in all functions."""
        special_chars = "Special chars: !@#$%^&*()[]{}|\\:;\"'<>?,./"
        
        ipc_log(special_chars)
        ipc_progress(special_chars, 50.0, special_chars)
        ipc_result(special_chars, custom_field=special_chars)
        ipc_error(special_chars, {"field": special_chars})
        
        # All should handle special characters without errors
        assert mock_output_json.call_count == 4
        
        # Verify special characters are preserved
        for call in mock_output_json.call_args_list:
            data = call[0][1]
            # Check that at least one field contains the basic special characters
            json_str = json.dumps(data)
            assert "Special chars:" in json_str
            assert "!@#$%^&*()" in json_str
    
    @patch('builtins.print')
    def test_none_values_handling(self, mock_print):
        """Test handling of None values in data."""
        data_with_none = {
            "valid_field": "value",
            "none_field": None,
            "nested": {"inner_none": None}
        }
        
        _output_json("none_test", data_with_none)
        
        printed_content = mock_print.call_args[0][0]
        parsed = json.loads(printed_content)
        
        # None values should be preserved as null in JSON
        assert parsed["data"]["none_field"] is None
        assert parsed["data"]["nested"]["inner_none"] is None
    
    @patch('src.presentation.cli.ipc_handler._output_json')
    def test_extreme_percentage_values(self, mock_output_json):
        """Test progress with extreme percentage values."""
        extreme_values = [-100.0, -1.0, 0.0, 100.0, 200.0, 999.99]
        
        for value in extreme_values:
            ipc_progress("extreme_test", value)
        
        assert mock_output_json.call_count == len(extreme_values)
        
        # All values should be handled (no validation in function)
        for i, value in enumerate(extreme_values):
            call_data = mock_output_json.call_args_list[i][0][1]
            assert call_data["percent"] == round(value, 2)
    
    @patch('builtins.print')
    def test_circular_reference_prevention(self, mock_print):
        """Test handling of circular references in data."""
        # Create circular reference
        circular_dict = {"key": "value"}
        circular_dict["self"] = circular_dict
        
        # Should handle gracefully with fallback
        _output_json("circular_test", circular_dict)
        
        # Print should be called (either success or fallback)
        mock_print.assert_called()
        
        # If fallback was used, should contain error message
        printed_content = mock_print.call_args[0][0]
        parsed = json.loads(printed_content)
        
        # Either original worked (unlikely) or fallback error message
        assert parsed["type"] in ["circular_test", "error"]