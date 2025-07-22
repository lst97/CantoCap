"""
Unit tests for IPC handler module.
"""

import json
import pytest
from datetime import datetime, timezone
from io import StringIO
from unittest.mock import patch, MagicMock

from src.presentation.cli.ipc_handler import (
    ipc_log,
    ipc_progress,
    ipc_result,
    ipc_error,
    _get_timestamp,
    _output_json
)


class TestIPCHandler:
    """Test cases for IPC handler functions."""

    def test_get_timestamp_format(self):
        """Test that timestamp is in correct ISO 8601 format."""
        timestamp = _get_timestamp()
        
        # Should be parseable as ISO 8601
        parsed = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        assert parsed.tzinfo is not None
        
        # Should contain timezone info
        assert timestamp.endswith('+00:00') or 'T' in timestamp

    @patch('sys.stdout', new_callable=StringIO)
    def test_output_json_basic(self, mock_stdout):
        """Test basic JSON output functionality."""
        test_data = {"message": "test", "level": "info"}
        
        _output_json("log", test_data)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "log"
        assert "timestamp" in parsed
        assert parsed["data"] == test_data

    @patch('sys.stdout', new_callable=StringIO)
    def test_output_json_serialization_error(self, mock_stdout):
        """Test JSON output handles serialization errors gracefully."""
        # Create data that can't be serialized
        test_data = {"func": lambda x: x}  # Functions can't be JSON serialized
        
        _output_json("log", test_data)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "error"
        assert "JSON serialization failed" in parsed["data"]["error"]
        assert parsed["data"]["original_type"] == "log"

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_log_basic(self, mock_stdout):
        """Test basic log message output."""
        ipc_log("Test message")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "log"
        assert parsed["data"]["message"] == "Test message"
        assert parsed["data"]["level"] == "info"
        assert "timestamp" in parsed

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_log_with_level(self, mock_stdout):
        """Test log message with custom level."""
        ipc_log("Error occurred", level="error")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "log"
        assert parsed["data"]["message"] == "Error occurred"
        assert parsed["data"]["level"] == "error"

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_progress_basic(self, mock_stdout):
        """Test basic progress update output."""
        ipc_progress("Processing audio", 45.5)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "progress"
        assert parsed["data"]["task"] == "Processing audio"
        assert parsed["data"]["percent"] == 45.5
        assert "details" not in parsed["data"]

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_progress_with_details(self, mock_stdout):
        """Test progress update with details."""
        ipc_progress("Transcribing", 75.0, details="Processing segment 3/4")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "progress"
        assert parsed["data"]["task"] == "Transcribing"
        assert parsed["data"]["percent"] == 75.0
        assert parsed["data"]["details"] == "Processing segment 3/4"

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_progress_percent_rounding(self, mock_stdout):
        """Test that progress percentage is properly rounded."""
        ipc_progress("Test", 33.333333)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["data"]["percent"] == 33.33

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_result_basic(self, mock_stdout):
        """Test basic result output."""
        ipc_result("/path/to/output.srt")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "result"
        assert parsed["data"]["path"] == "/path/to/output.srt"
        assert parsed["data"]["success"] is True

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_result_with_failure(self, mock_stdout):
        """Test result output with failure status."""
        ipc_result("/path/to/output.srt", success=False)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "result"
        assert parsed["data"]["path"] == "/path/to/output.srt"
        assert parsed["data"]["success"] is False

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_result_with_kwargs(self, mock_stdout):
        """Test result output with additional data."""
        ipc_result(
            "/path/to/output.srt",
            success=True,
            subtitle_count=42,
            processing_time=15.5,
            statistics={"words": 150, "speakers": 2}
        )
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "result"
        assert parsed["data"]["path"] == "/path/to/output.srt"
        assert parsed["data"]["success"] is True
        assert parsed["data"]["subtitle_count"] == 42
        assert parsed["data"]["processing_time"] == 15.5
        assert parsed["data"]["statistics"] == {"words": 150, "speakers": 2}

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_error_basic(self, mock_stdout):
        """Test basic error output."""
        ipc_error("File not found")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "error"
        assert parsed["data"]["error"] == "File not found"
        assert "details" not in parsed["data"]

    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_error_with_details(self, mock_stdout):
        """Test error output with details."""
        error_details = {
            "file_path": "/missing/file.mp4",
            "error_code": 404,
            "traceback": "Stack trace here..."
        }
        
        ipc_error("File not found", details=error_details)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "error"
        assert parsed["data"]["error"] == "File not found"
        assert parsed["data"]["details"] == error_details

    @patch('sys.stdout', new_callable=StringIO)
    def test_json_output_is_valid(self, mock_stdout):
        """Test that all output produces valid JSON."""
        # Test all functions produce valid JSON
        ipc_log("Test log")
        ipc_progress("Test task", 50.0)
        ipc_result("/test/path.srt", success=True)
        ipc_error("Test error")
        
        outputs = mock_stdout.getvalue().strip().split('\n')
        
        # Each line should be valid JSON
        for output_line in outputs:
            parsed = json.loads(output_line)
            assert "type" in parsed
            assert "timestamp" in parsed
            assert "data" in parsed

    @patch('sys.stdout', new_callable=StringIO)
    def test_unicode_handling(self, mock_stdout):
        """Test that Unicode characters are handled correctly."""
        unicode_message = "Processing file: café_résumé.mp4 🎵"
        
        ipc_log(unicode_message)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["data"]["message"] == unicode_message

    @patch('sys.stdout', new_callable=StringIO)
    def test_flush_behavior(self, mock_stdout):
        """Test that output is flushed immediately."""
        with patch('builtins.print') as mock_print:
            ipc_log("Test message")
            
            # Verify print was called with flush=True
            mock_print.assert_called_once()
            args, kwargs = mock_print.call_args
            assert kwargs.get('flush') is True

    def test_timestamp_consistency(self):
        """Test that timestamps are generated consistently."""
        # Get multiple timestamps in quick succession
        timestamps = [_get_timestamp() for _ in range(5)]
        
        # All should be valid ISO format
        for ts in timestamps:
            datetime.fromisoformat(ts.replace('Z', '+00:00'))
        
        # Should be in chronological order (or at least not decreasing)
        for i in range(1, len(timestamps)):
            assert timestamps[i] >= timestamps[i-1]