"""
Tests for the ProcessingEvent IPC handler system.
"""

import json
import pytest
from unittest.mock import patch, MagicMock
from io import StringIO
import sys

from src.presentation.cli.ipc_handler import (
    IPCHandler, get_handler, ipc_log_message, ipc_progress, 
    ipc_completion_with_json, ipc_processing_error, ipc_status_change
)
from src.domain.value_objects.quality_metrics import QualityIssue, QualityMetrics
from datetime import datetime
from decimal import Decimal
from enum import Enum


class TestIPCHandler:
    """Test the ProcessingEvent IPC handler functionality."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.handler = IPCHandler()
        
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_log_message(self, mock_stdout):
        """Test log message in ProcessingEvent format."""
        self.handler.send_log_message("Test log message", "test_phase")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "log-message"
        assert parsed["data"]["message"] == "Test log message"
        assert parsed["data"]["phase"] == "test_phase"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_status_change(self, mock_stdout):
        """Test status change in ProcessingEvent format."""
        self.handler.send_status_change("running", "initialization", "Starting process")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "status-change"
        assert parsed["data"]["status"] == "running"
        assert parsed["data"]["phase"] == "initialization"
        assert parsed["data"]["message"] == "Starting process"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_progress(self, mock_stdout):
        """Test progress message in ProcessingEvent format."""
        self.handler.send_progress("Loading Model", 75.5, "Model loading in progress")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "progress-update"
        assert parsed["data"]["progress"] == 75.5
        assert parsed["data"]["phase"] == "Loading Model"
        assert parsed["data"]["message"] == "Model loading in progress"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_processing_error(self, mock_stdout):
        """Test error message in ProcessingEvent format."""
        self.handler.send_processing_error("Test error message", {"details": "error details"})
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "error"
        assert parsed["data"]["status"] == "error"
        assert parsed["data"]["error"] == "Test error message"
        assert parsed["data"]["message"] == "Test error message"
        assert parsed["data"]["details"] == "error details"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_completion(self, mock_stdout):
        """Test completion message in ProcessingEvent format."""
        subtitle_data = {
            "subtitles": [{"start": "00:00:00", "end": "00:00:02", "text": "Test"}],
            "metadata": {"duration": 2.0}
        }
        
        self.handler.send_completion_with_json_subtitles(
            subtitle_data, "/path/to/output.srt", True
        )
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "complete"
        assert parsed["data"]["status"] == "completed"
        assert parsed["data"]["subtitleData"] == subtitle_data
        assert parsed["data"]["outputFile"] == "/path/to/output.srt"
        assert "1 subtitles generated" in parsed["data"]["message"]
    
    def test_json_sanitization(self):
        """Test JSON sanitization for custom objects."""
        # Test with a mock QualityIssue object
        class MockQualityIssue:
            def __init__(self):
                self.category = "test_category"
                self.issue_type = "test_type"
                self.severity = 0.5
                self.subtitle_index = 1
                self.description = "test description"
                self.suggested_fix = "test fix"
        
        mock_issue = MockQualityIssue()
        sanitized = self.handler._sanitize_for_json(mock_issue)
        
        assert sanitized["category"] == "test_category"
        assert sanitized["issue_type"] == "test_type"
        assert sanitized["severity"] == 0.5
        assert sanitized["subtitle_index"] == 1
        assert sanitized["description"] == "test description"
        assert sanitized["suggested_fix"] == "test fix"


class TestPublicAPIFunctions:
    """Test the public API functions."""
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_log_message_function(self, mock_stdout):
        """Test the ipc_log_message public function."""
        ipc_log_message("Test message", "test_phase")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "log-message"
        assert parsed["data"]["message"] == "Test message"
        assert parsed["data"]["phase"] == "test_phase"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_progress_function(self, mock_stdout):
        """Test the ipc_progress public function."""
        ipc_progress("Processing", 50.0, "Halfway done")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "progress-update"
        assert parsed["data"]["progress"] == 50.0
        assert parsed["data"]["phase"] == "Processing"
        assert "Halfway done" in parsed["data"]["message"]
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_processing_error_function(self, mock_stdout):
        """Test the ipc_processing_error public function."""
        ipc_processing_error("Error occurred", {"code": "TEST_ERROR"})
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "error"
        assert parsed["data"]["error"] == "Error occurred"
        assert parsed["data"]["code"] == "TEST_ERROR"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_status_change_function(self, mock_stdout):
        """Test the ipc_status_change public function."""
        ipc_status_change("completed", "final", "Process finished")
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "status-change"
        assert parsed["data"]["status"] == "completed"
        assert parsed["data"]["phase"] == "final"
        assert parsed["data"]["message"] == "Process finished"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_completion_with_json_function(self, mock_stdout):
        """Test the ipc_completion_with_json public function."""
        subtitle_data = {"subtitles": [], "metadata": {}}
        ipc_completion_with_json(subtitle_data, "/output.srt", True)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "complete"
        assert parsed["data"]["subtitleData"] == subtitle_data
        assert parsed["data"]["outputFile"] == "/output.srt"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_json_serialization_complex_objects(self, mock_stdout):
        """Test JSON serialization of complex objects including QualityIssue."""
        # Create a QualityIssue object
        quality_issue = QualityIssue(
            category="technical",
            issue_type="timing",
            severity=0.8,
            subtitle_index=5,
            description="Subtitle timing issue",
            suggested_fix="Adjust timing by 0.5 seconds"
        )
        
        # Create test data with various complex types
        complex_data = {
            "quality_issues": [quality_issue],
            "timestamp": datetime.now(),
            "precision_value": Decimal('3.14159'),
            "nested_data": {
                "list_of_issues": [quality_issue, quality_issue],
                "metadata": {"version": 1.0, "created": datetime.now()}
            }
        }
        
        # Test completion with complex data
        ipc_completion_with_json(complex_data, "/output.srt", True)
        
        output = mock_stdout.getvalue().strip()
        parsed = json.loads(output)  # This should not raise an exception
        
        assert parsed["type"] == "complete"
        assert "subtitleData" in parsed["data"]
        
        # Verify that QualityIssue was properly serialized
        subtitle_data = parsed["data"]["subtitleData"]
        assert "quality_issues" in subtitle_data
        assert len(subtitle_data["quality_issues"]) == 1
        
        serialized_issue = subtitle_data["quality_issues"][0]
        assert serialized_issue["category"] == "technical"
        assert serialized_issue["issue_type"] == "timing"
        assert serialized_issue["severity"] == 0.8
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_json_serialization_edge_cases(self, mock_stdout):
        """Test JSON serialization with edge cases and problematic types."""
        handler = IPCHandler()
        
        # Test enum
        class TestEnum(Enum):
            VALUE1 = "test_value"
        
        # Test data with edge cases
        edge_case_data = {
            "none_value": None,
            "enum_value": TestEnum.VALUE1,
            "empty_list": [],
            "empty_dict": {},
            "set_value": {"item1", "item2"},  # Sets should be converted to lists
            "tuple_value": (1, 2, 3)
        }
        
        # Test with handler directly
        sanitized = handler._sanitize_for_json(edge_case_data)
        
        # Verify it can be JSON serialized
        json_str = json.dumps(sanitized)
        parsed_back = json.loads(json_str)
        
        assert parsed_back["none_value"] is None
        assert parsed_back["enum_value"] == "test_value"
        assert isinstance(parsed_back["set_value"], list)
        assert isinstance(parsed_back["tuple_value"], list)


class TestGlobalHandlerInstance:
    """Test the global handler instance management."""
    
    def test_get_handler_singleton(self):
        """Test that get_handler returns the same instance."""
        handler1 = get_handler()
        handler2 = get_handler()
        
        assert handler1 is handler2
    
    def test_handler_initialization(self):
        """Test handler initialization."""
        handler = get_handler()
        
        assert hasattr(handler, 'progress_manager')
        assert hasattr(handler, 'session_id')
        assert hasattr(handler, '_original_stdout')