"""
Message classifier for intelligent IPC communication.
Classifies messages based on content patterns to distinguish between
actual errors and model/library debug outputs.
"""

import re
from enum import Enum
from typing import Optional, List, Tuple
from dataclasses import dataclass


class MessageLevel(Enum):
    """Message severity levels."""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class MessageCategory(Enum):
    """Message category types."""
    SYSTEM = "system"
    PROCESS = "process"
    MODEL = "model"
    USER = "user"
    CONSOLE = "console"  # New category for raw console output


@dataclass
class ClassificationRule:
    """Rule for classifying messages."""
    patterns: List[str]
    level: MessageLevel
    category: MessageCategory
    source: str


class MessageClassifier:
    """Intelligent message classifier for IPC communication."""
    
    def __init__(self):
        self.rules = [
            # Device and hardware setup (INFO level)
            ClassificationRule(
                patterns=[
                    r"Using Apple Metal Performance Shaders",
                    r"Device set to use (mps|cuda|cpu)",
                    r"Using dtype: torch\.",
                    r"Hardware acceleration",
                    r"GPU detected",
                    r"CPU.*cores detected"
                ],
                level=MessageLevel.INFO,
                category=MessageCategory.SYSTEM,
                source="device_setup"
            ),
            
            # Model loading and initialization (INFO level)
            ClassificationRule(
                patterns=[
                    r"Loading model .* on device:",
                    r"Standard pipeline loading successful",
                    r"Model loaded successfully on",
                    r"Pipeline initialized",
                    r"Model ready for",
                    r"Loading checkpoint shards:",
                    r"transformers\.",
                    r"torch\.",
                    r"Some weights .* not initialized",
                    r"model loaded in",
                    r"Loading.*model",
                    r".*\.safetensors",
                    r"Special tokens have been added",
                    r".*model.*loaded.*successfully",
                    r".*automatically selected.*",
                    r".*loading model.*",
                    r".*tokenizer.*loaded.*",
                    r"The new embeddings will be initialized",
                    r"Generate kwargs failed",
                    r"Retrying with minimal parameters"
                ],
                level=MessageLevel.INFO,
                category=MessageCategory.MODEL,
                source="model_loader"
            ),
            
            # Transformers library warnings (WARNING level, but MODEL category)
            ClassificationRule(
                patterns=[
                    r"Using `chunk_length_s` is very experimental",
                    r"FutureWarning.*inputs.*deprecated",
                    r"The attention mask is not set",
                    r"pad token is same as eos token",
                    r"may result in unpredictable behaviour",
                    r"To disable this.*mean_resizing=False",
                    r"More information.*github\.com/huggingface"
                ],
                level=MessageLevel.WARNING,
                category=MessageCategory.MODEL,
                source="model_warning"
            ),
            
            # Processing and transcription (INFO level)
            ClassificationRule(
                patterns=[
                    r"Validation applied:",
                    r"TRIM tags",
                    r"REPEAT tags",
                    r"Uploading.*file.*transcription",
                    r"File uploaded with ID:",
                    r"File state check",
                    r"ready for processing",
                    r"Cleaning up uploaded file",
                    r"File cleanup completed",
                    r"Transcription.*completed:",
                    r"changes made",
                    r"Translating subtitles to",
                    r"Translation completed:",
                    r"subtitles translated",
                    r"Translation quality score:",
                    r"Dual-language subtitles created:",
                    r"entries"
                ],
                level=MessageLevel.INFO,
                category=MessageCategory.PROCESS,
                source="transcription_process"
            ),
            
            # Debug information
            ClassificationRule(
                patterns=[
                    r"^Debug:",
                    r"Hardware check",
                    r"Engine status", 
                    r"CLI command",
                    r"Working directory",
                    r"Python executable",
                    r"STDERR -",
                    r"^Debug: STDERR",
                    r"Executing command"
                ],
                level=MessageLevel.DEBUG,
                category=MessageCategory.SYSTEM,
                source="debug_system"
            ),
            
            # System warnings (not errors)
            ClassificationRule(
                patterns=[
                    r"Warning:",
                    r"UserWarning:",
                    r"FutureWarning:",
                    r"DeprecationWarning:",
                    r"Fallback to",
                    r"Performance impact",
                    r".*warning.*deprecated.*"
                ],
                level=MessageLevel.WARNING,
                category=MessageCategory.SYSTEM,
                source="system_warning"
            ),
            
            # Critical system failures
            ClassificationRule(
                patterns=[
                    r"Critical:",
                    r"Fatal:",
                    r"Segmentation fault",
                    r"CUDA out of memory",
                    r"SystemExit",
                    r"KeyboardInterrupt",
                    r"Process exited with code.*[^0]$"
                ],
                level=MessageLevel.CRITICAL,
                category=MessageCategory.SYSTEM,
                source="system_critical"
            ),
            
            # Actual errors
            ClassificationRule(
                patterns=[
                    r"^Error:",
                    r"^Exception:",
                    r"Failed to",
                    r"Cannot",
                    r"Invalid",
                    r"Missing",
                    r"No such file",
                    r"Permission denied",
                    r".*not found.*",
                    r".*failed.*"
                ],
                level=MessageLevel.ERROR,
                category=MessageCategory.SYSTEM,
                source="system_error"
            )
        ]
        
        # Compile patterns for efficiency
        self.compiled_rules = []
        for rule in self.rules:
            compiled_patterns = [re.compile(p, re.IGNORECASE) for p in rule.patterns]
            self.compiled_rules.append((compiled_patterns, rule))
    
    def classify(self, message: str, stream: str = "stdout", 
                exit_code: Optional[int] = None) -> Tuple[MessageLevel, MessageCategory, str]:
        """
        Classify message and return level, category, source.
        
        Args:
            message: The message content to classify
            stream: The stream the message came from ("stdout" or "stderr")
            exit_code: Optional exit code for additional context
            
        Returns:
            Tuple of (MessageLevel, MessageCategory, source_string)
        """
        
        # Exit code classification (highest priority)
        if exit_code is not None:
            if exit_code < 0:
                return MessageLevel.CRITICAL, MessageCategory.SYSTEM, "exit_handler"
            elif exit_code > 0:
                return MessageLevel.ERROR, MessageCategory.SYSTEM, "exit_handler"
        
        # Pattern-based classification
        message_lower = message.lower().strip()
        for compiled_patterns, rule in self.compiled_rules:
            if any(pattern.search(message) for pattern in compiled_patterns):
                return rule.level, rule.category, rule.source
        
        # Default classification based on stream
        if stream == "stderr":
            # stderr without error patterns is likely model output (INFO)
            return MessageLevel.INFO, MessageCategory.MODEL, "model_output"
        else:
            return MessageLevel.INFO, MessageCategory.PROCESS, "process_output"
    
    def is_model_output(self, message: str) -> bool:
        """Check if message is likely from model/library output."""
        model_indicators = [
            "loading", "checkpoint", "transformers", "torch", 
            "model", "tokenizer", "safetensors", "weights"
        ]
        message_lower = message.lower()
        return any(indicator in message_lower for indicator in model_indicators)
    
    def is_debug_output(self, message: str) -> bool:
        """Check if message is debug output."""
        return message.lower().startswith("debug:")