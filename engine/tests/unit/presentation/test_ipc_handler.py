"""
Tests for the enhanced IPC handler system.
"""

import json
import pytest
from unittest.mock import patch, MagicMock
from io import StringIO
import sys

from src.presentation.cli.ipc_handler import (
    IPCHandler, get_handler, ipc_log, ipc_progress, 
    ipc_result, ipc_error, ipc_classify_output
)
from src.presentation.cli.message_classifier import MessageLevel, MessageCategory


class TestIPCHandler:
    """Test the enhanced IPC handler functionality."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.handler = IPCHandler()
        
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_basic_message(self, mock_stdout):
        """Test basic message sending."""
        self.handler._send(
            MessageLevel.INFO, 
            MessageCategory.PROCESS, 
            "test_source", 
            "Test message"
        )
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "info"
        assert message["category"] == "process"
        assert message["source"] == "test_source"
        assert message["content"] == "Test message"
        assert "id" in message
        assert "timestamp" in message
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_message_with_data(self, mock_stdout):
        """Test sending message with additional data."""
        test_data = {"key": "value", "number": 42}
        
        self.handler._send(
            MessageLevel.ERROR,
            MessageCategory.SYSTEM,
            "error_source",
            "Error occurred",
            test_data
        )
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "error"
        assert message["data"] == test_data
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_classified_message(self, mock_stdout):
        """Test automatic message classification."""
        # Test model output classification
        self.handler.send_classified("Loading checkpoint shards: 100%", "stderr")
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "info"  # Should be INFO, not ERROR
        assert message["category"] == "model"
        assert message["source"] == "model_loader"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_progress(self, mock_stdout):
        """Test progress message sending."""
        self.handler.send_progress("Loading Model", 75.5, "Model loading in progress")
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "info"
        assert message["category"] == "process"
        assert message["source"] == "progress"
        assert message["data"]["stage"] == "Loading Model"
        assert message["data"]["percent"] == 75.5
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_result_success(self, mock_stdout):
        """Test successful result sending."""
        self.handler.send_result("/path/to/output.srt", True, subtitle_count=25)
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "info"
        assert message["category"] == "process"
        assert message["source"] == "result"
        assert message["data"]["success"] is True
        assert message["data"]["subtitle_count"] == 25
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_result_failure(self, mock_stdout):
        """Test failure result sending."""
        self.handler.send_result("/path/to/output.srt", False)
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "error"
        assert message["data"]["success"] is False
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_send_error(self, mock_stdout):
        """Test error message sending."""
        error_details = {"code": 404, "path": "/missing/file"}
        self.handler.send_error("File not found", error_details)
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "error"
        assert message["category"] == "system"
        assert message["source"] == "error"
        assert message["data"]["details"] == error_details
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_json_serialization_fallback(self, mock_stdout):
        """Test fallback when JSON serialization fails."""
        # Create a non-serializable object
        non_serializable = object()
        
        with patch('json.dumps', side_effect=TypeError("Not serializable")):
            self.handler._send(
                MessageLevel.INFO,
                MessageCategory.SYSTEM,
                "test",
                "Test message"
            )
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "error"
        assert "JSON serialization failed" in message["content"]
    
    def test_message_id_generation(self):
        """Test that message IDs are unique and sequential."""
        id1 = self.handler._generate_id()
        id2 = self.handler._generate_id()
        
        assert id1 != id2
        assert "msg_000001" in id1
        assert "msg_000002" in id2


class TestPublicAPIFunctions:
    """Test the public API functions."""
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_log_function(self, mock_stdout):
        """Test the ipc_log public function."""
        ipc_log("Test log message", "warning")
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "warning"
        assert message["content"] == "Test log message"
        assert message["source"] == "log"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_progress_function(self, mock_stdout):
        """Test the ipc_progress public function."""
        ipc_progress("Processing", 50.0, "Halfway done")
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "info"
        assert message["data"]["stage"] == "Processing"
        assert message["data"]["percent"] == 50.0
        assert "Halfway done" in message["content"]
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_result_function(self, mock_stdout):
        """Test the ipc_result public function."""
        ipc_result("/output.srt", True, duration=120.5)
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "info"
        assert message["data"]["success"] is True
        assert message["data"]["duration"] == 120.5
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_error_function(self, mock_stdout):
        """Test the ipc_error public function."""
        error_details = {"error_code": "E001"}
        ipc_error("Something went wrong", error_details)
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "error"
        assert message["content"] == "Something went wrong"
        assert message["data"]["details"] == error_details
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_ipc_classify_output_function(self, mock_stdout):
        """Test the ipc_classify_output public function."""
        # Test model output classification
        ipc_classify_output("transformers.models.whisper: Loading model", "stderr")
        
        output = mock_stdout.getvalue().strip()
        message = json.loads(output)
        
        assert message["level"] == "info"  # Should be INFO, not ERROR
        assert message["category"] == "model"
    
    def test_global_handler_singleton(self):
        """Test that get_handler returns the same instance."""
        handler1 = get_handler()
        handler2 = get_handler()
        
        assert handler1 is handler2


class TestIntegration:
    """Integration tests for the IPC system."""
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_model_stderr_classification_integration(self, mock_stdout):
        """Test end-to-end classification of model stderr output."""
        model_outputs = [
            "Loading checkpoint shards: 100%|██████████| 2/2 [00:01<00:00,  1.33it/s]",
            "Some weights of Wav2Vec2ForCTC were not initialized from the model checkpoint",
            "transformers.tokenization_utils_base: Model name 'openai/whisper-large-v3'",
        ]
        
        for output in model_outputs:
            ipc_classify_output(output, "stderr")
        
        lines = mock_stdout.getvalue().strip().split('\n')
        assert len(lines) == len(model_outputs)
        
        for line in lines:
            message = json.loads(line)
            assert message["level"] == "info", f"Model output should be INFO: {message['content']}"
            assert message["category"] == "model"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_debug_message_classification_integration(self, mock_stdout):
        """Test end-to-end classification of debug messages."""
        debug_messages = [
            "Debug: CLI command execution started",
            "Debug: STDERR - Model loading output",
            "Hardware check completed successfully"
        ]
        
        for msg in debug_messages:
            ipc_classify_output(msg, "stdout")
        
        lines = mock_stdout.getvalue().strip().split('\n')
        
        for line in lines:
            message = json.loads(line)
            assert message["level"] == "debug", f"Debug message should be DEBUG: {message['content']}"
            assert message["category"] == "system"
    
    @patch('sys.stdout', new_callable=StringIO)
    def test_mixed_message_types_integration(self, mock_stdout):
        """Test classification of mixed message types."""
        messages = [
            ("Loading checkpoint shards", "stderr", "info", "model"),
            ("Debug: Starting process", "stdout", "debug", "system"),
            ("Warning: Deprecated feature", "stderr", "warning", "system"),
            ("Error: File not found", "stdout", "error", "system"),
            ("Critical: System failure", "stderr", "critical", "system")
        ]
        
        for content, stream, expected_level, expected_category in messages:
            ipc_classify_output(content, stream)
        
        lines = mock_stdout.getvalue().strip().split('\n')
        assert len(lines) == len(messages)
        
        for i, line in enumerate(lines):
            message = json.loads(line)
            expected_level = messages[i][2]
            expected_category = messages[i][3]
            
            assert message["level"] == expected_level, f"Message {i}: Expected {expected_level}, got {message['level']}"
            assert message["category"] == expected_category, f"Message {i}: Expected {expected_category}, got {message['category']}"