"""
Modern IPC Handler with intelligent message classification.
Replaces the old IPC system completely for better error/info distinction.
"""

import json
import sys
import uuid
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

from .message_classifier import MessageClassifier, MessageLevel, MessageCategory
from .progress_manager import ProgressManager, ProcessingStage


class IPCHandler:
    """Modern IPC handler with intelligent message classification."""
    
    def __init__(self):
        self.classifier = MessageClassifier()
        self.progress_manager = ProgressManager()
        self.session_id = str(uuid.uuid4())
        self.message_counter = 0
        self.command_line = self._capture_command_line()
        self.start_time = datetime.now(timezone.utc)
        
        # Store original stdout for direct IPC output (to avoid console interception loops)
        self._original_stdout = sys.stdout
        
    def _generate_id(self) -> str:
        """Generate unique message ID."""
        self.message_counter += 1
        return f"msg_{self.message_counter:06d}"
    
    def _capture_command_line(self) -> str:
        """Capture the command line that started this process."""
        try:
            return ' '.join(sys.argv)
        except:
            return "unknown"
    
    def _get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics."""
        if not HAS_PSUTIL:
            return {}
            
        try:
            process = psutil.Process()
            cpu_percent = process.cpu_percent()
            memory_info = process.memory_info()
            
            return {
                "cpu_usage": cpu_percent,
                "memory_usage_mb": memory_info.rss / 1024 / 1024,
                "memory_percent": process.memory_percent(),
                "num_threads": process.num_threads()
            }
        except:
            return {}
    
    def _get_session_context(self) -> Dict[str, Any]:
        """Get session context information."""
        return {
            "session_id": self.session_id,
            "command_line": self.command_line,
            "working_directory": os.getcwd(),
            "process_id": os.getpid(),
            "uptime": (datetime.now(timezone.utc) - self.start_time).total_seconds()
        }

    def _send(self, level: MessageLevel, category: MessageCategory, 
             source: str, content: str, data: Optional[Dict[str, Any]] = None,
             raw_output: Optional[str] = None, context: Optional[Dict[str, Any]] = None,
             performance: Optional[Dict[str, Any]] = None) -> None:
        """Send enhanced classified message to GUI via stdout."""
        
        message = {
            "id": self._generate_id(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": self.session_id,
            "level": level.value,
            "category": category.value,
            "source": source,
            "content": content
        }
        
        # Add optional fields
        if data:
            message["data"] = data
        if raw_output:
            message["raw_output"] = raw_output
        if context:
            message["context"] = context
        if performance:
            message["performance"] = performance
            
        try:
            json_output = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
            # Use original stdout to avoid console interception loops
            self._original_stdout.write(json_output + '\n')
            self._original_stdout.flush()
        except (TypeError, ValueError) as e:
            # Fallback for serialization errors
            self._send_fallback_error(f"JSON serialization failed: {str(e)}")
    
    def _send_fallback_error(self, error_msg: str) -> None:
        """Send fallback error when JSON fails."""
        fallback = {
            "id": f"error_{self.message_counter}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": "error",
            "category": "system",
            "source": "ipc_handler",
            "content": error_msg
        }
        # Use original stdout to avoid console interception loops
        self._original_stdout.write(json.dumps(fallback) + '\n')
        self._original_stdout.flush()
    
    def send_console_output(self, content: str, stream: str = "stdout", 
                           raw_output: Optional[str] = None, exit_code: Optional[int] = None) -> None:
        """Send console output with automatic classification and context."""
        level, category, source = self.classifier.classify(content, stream, exit_code)
        
        # Check if this indicates a progress stage
        progress_stage = self.progress_manager.get_stage_for_message(content)
        context = self._get_session_context()
        performance = self._get_performance_metrics()
        
        self._send(
            level, category, source, content,
            raw_output=raw_output or content,
            context=context,
            performance=performance
        )
    
    def send_classified(self, content: str, stream: str = "stdout", 
                       exit_code: Optional[int] = None) -> None:
        """Send message with automatic classification (legacy compatibility)."""
        self.send_console_output(content, stream, content, exit_code)
    
    def send_progress(self, stage: str, percent: float, message: str, 
                     substage: str = None, **kwargs) -> None:
        """Send enhanced progress update."""
        # Try to find the stage enum
        stage_enum = None
        for processing_stage in ProcessingStage:
            if processing_stage.value == stage:
                stage_enum = processing_stage
                break
                
        if stage_enum:
            progress_data = self.progress_manager.update_progress(
                stage_enum, substage, percent, message
            )
        else:
            progress_data = {
                "stage": stage,
                "percent": round(percent, 2),
                "substage": substage,
                "message": message
            }
            
        # Add any additional data
        progress_data.update(kwargs)
        
        self._send(MessageLevel.INFO, MessageCategory.PROCESS, "progress", message, progress_data)
    
    def send_result(self, output_path: str, success: bool = True, **kwargs) -> None:
        """Send final processing result."""
        data = {
            "output_path": output_path,
            "success": success,
            **kwargs
        }
        
        level = MessageLevel.INFO if success else MessageLevel.ERROR
        content = f"Processing {'completed' if success else 'failed'}: {output_path}"
        
        self._send(level, MessageCategory.PROCESS, "result", content, data)
    
    def send_error(self, error_msg: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Send error message."""
        data = {"details": details} if details else None
        self._send(MessageLevel.ERROR, MessageCategory.SYSTEM, "error", error_msg, data)
    
    def send_debug(self, message: str) -> None:
        """Send debug message."""
        self._send(MessageLevel.DEBUG, MessageCategory.SYSTEM, "debug", message)
    
    def send_info(self, message: str) -> None:
        """Send info message."""
        self._send(MessageLevel.INFO, MessageCategory.PROCESS, "info", message)


# Global handler instance
_handler: Optional[IPCHandler] = None


def get_handler() -> IPCHandler:
    """Get global IPC handler instance."""
    global _handler
    if _handler is None:
        _handler = IPCHandler()
    return _handler


# Public API functions (maintain compatibility with existing calls)
def ipc_log(message: str, level: str = "info") -> None:
    """Send log message with specified level."""
    handler = get_handler()
    
    level_map = {
        "debug": MessageLevel.DEBUG,
        "info": MessageLevel.INFO,
        "warning": MessageLevel.WARNING,
        "error": MessageLevel.ERROR,
        "critical": MessageLevel.CRITICAL
    }
    
    msg_level = level_map.get(level, MessageLevel.INFO)
    category = MessageCategory.SYSTEM if level in ["error", "critical"] else MessageCategory.PROCESS
    
    handler._send(msg_level, category, "log", message)


def ipc_progress(task: str, percent: float, details: Optional[str] = None, 
                substage: str = None, **kwargs) -> None:
    """Send enhanced progress update."""
    handler = get_handler()
    message = f"{task}: {details}" if details else task
    handler.send_progress(task, percent, message, substage, **kwargs)


def ipc_result(path: str, success: bool = True, **kwargs) -> None:
    """Send processing result."""
    handler = get_handler()
    handler.send_result(path, success, **kwargs)


def ipc_error(error: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Send error message."""
    handler = get_handler()
    handler.send_error(error, details)


def ipc_classify_output(content: str, stream: str = "stdout", 
                       exit_code: Optional[int] = None) -> None:
    """Classify and send any output (main function for stderr/stdout)."""
    handler = get_handler()
    handler.send_console_output(content, stream, content, exit_code)

def ipc_console_output(content: str, stream: str = "stdout", 
                      raw_output: Optional[str] = None, exit_code: Optional[int] = None) -> None:
    """Send console output with enhanced context and classification."""
    handler = get_handler()
    handler.send_console_output(content, stream, raw_output, exit_code)