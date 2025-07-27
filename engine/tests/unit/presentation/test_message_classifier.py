"""
Standalone tests for the message classifier system.
"""

import sys
from pathlib import Path
import pytest

# Add src to path to import directly
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

from presentation.cli.message_classifier import MessageClassifier, MessageLevel, MessageCategory


class TestMessageClassifierStandalone:
    """Test the message classification functionality standalone."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.classifier = MessageClassifier()
    
    def test_model_output_classification(self):
        """Test that model outputs are classified as INFO, not ERROR."""
        test_cases = [
            "Loading checkpoint shards: 100%|██████████| 2/2 [00:01<00:00,  1.33it/s]",
            "Some weights of Wav2Vec2ForCTC were not initialized from the model checkpoint",
            "transformers.tokenization_utils_base: Model name 'openai/whisper-large-v3'",
            "Special tokens have been added in the vocabulary",
            "model loaded in 5.2 seconds",
            "Loading model from checkpoint"
        ]
        
        for message in test_cases:
            level, category, source = self.classifier.classify(message, "stderr")
            assert level == MessageLevel.INFO, f"Expected INFO for: {message}"
            assert category == MessageCategory.MODEL, f"Expected MODEL category for: {message}"
            assert source == "model_loader", f"Expected model_loader source for: {message}"
    
    def test_debug_output_classification(self):
        """Test that debug messages are classified correctly."""
        test_cases = [
            "Debug: CLI command execution started",
            "Debug: STDERR - Loading model weights",
            "Hardware check completed successfully",
            "Engine status: operational",
            "Working directory: /path/to/engine",
            "Python executable: /usr/bin/python3"
        ]
        
        for message in test_cases:
            level, category, source = self.classifier.classify(message)
            assert level == MessageLevel.DEBUG, f"Expected DEBUG for: {message}"
            assert category == MessageCategory.SYSTEM, f"Expected SYSTEM category for: {message}"
    
    def test_warning_classification(self):
        """Test that warnings are classified correctly."""
        test_cases = [
            "Warning: This feature is deprecated",
            "UserWarning: Performance may be impacted",
            "FutureWarning: This will be removed in the next version",
            "DeprecationWarning: Use the new API instead"
        ]
        
        for message in test_cases:
            level, category, source = self.classifier.classify(message)
            assert level == MessageLevel.WARNING, f"Expected WARNING for: {message}"
            assert category == MessageCategory.SYSTEM, f"Expected SYSTEM category for: {message}"
    
    def test_error_classification(self):
        """Test that actual errors are classified correctly."""
        test_cases = [
            "Error: File not found",
            "Exception: Invalid configuration",
            "Failed to load model weights",
            "Cannot access the specified path",
            "Invalid input format",
            "Missing required dependency"
        ]
        
        for message in test_cases:
            level, category, source = self.classifier.classify(message)
            assert level == MessageLevel.ERROR, f"Expected ERROR for: {message}"
            assert category == MessageCategory.SYSTEM, f"Expected SYSTEM category for: {message}"
    
    def test_critical_classification(self):
        """Test that critical errors are classified correctly."""
        test_cases = [
            "Critical: System failure detected",
            "Fatal: Unable to recover from error",
            "Segmentation fault",
            "CUDA out of memory",
            "Process exited with code -1"
        ]
        
        for message in test_cases:
            level, category, source = self.classifier.classify(message)
            assert level == MessageLevel.CRITICAL, f"Expected CRITICAL for: {message}"
            assert category == MessageCategory.SYSTEM, f"Expected SYSTEM category for: {message}"
    
    def test_exit_code_classification(self):
        """Test that exit codes are classified correctly."""
        # Successful exit
        level, category, source = self.classifier.classify("Process completed", exit_code=0)
        assert level == MessageLevel.INFO
        
        # Error exit
        level, category, source = self.classifier.classify("Process failed", exit_code=1)
        assert level == MessageLevel.ERROR
        assert source == "exit_handler"
        
        # Critical exit
        level, category, source = self.classifier.classify("Process crashed", exit_code=-1)
        assert level == MessageLevel.CRITICAL
        assert source == "exit_handler"
    
    def test_stderr_default_classification(self):
        """Test that unmatched stderr is classified as model output (INFO)."""
        message = "Some random library output that doesn't match patterns"
        level, category, source = self.classifier.classify(message, "stderr")
        
        assert level == MessageLevel.INFO
        assert category == MessageCategory.MODEL
        assert source == "model_output"
    
    def test_stdout_default_classification(self):
        """Test that unmatched stdout is classified as process output (INFO)."""
        message = "Some process output"
        level, category, source = self.classifier.classify(message, "stdout")
        
        assert level == MessageLevel.INFO
        assert category == MessageCategory.PROCESS
        assert source == "process_output"
    
    def test_helper_methods(self):
        """Test the helper methods."""
        # Test model output detection
        assert self.classifier.is_model_output("Loading checkpoint shards")
        assert self.classifier.is_model_output("transformers library message")
        assert not self.classifier.is_model_output("Regular system message")
        
        # Test debug output detection
        assert self.classifier.is_debug_output("Debug: Starting process")
        assert not self.classifier.is_debug_output("Info: Process started")
    
    def test_pattern_precedence(self):
        """Test that more specific patterns take precedence."""
        # A message that could match multiple patterns should match the most specific one
        message = "Critical: Error in model loading checkpoint"
        level, category, source = self.classifier.classify(message)
        
        # Should be classified as CRITICAL, not ERROR or INFO
        assert level == MessageLevel.CRITICAL
        assert category == MessageCategory.SYSTEM
        assert source == "system_critical"