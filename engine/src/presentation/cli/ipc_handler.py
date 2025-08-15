"""
Modern IPC Handler for ProcessingEvent communication with GUI.
Sends ProcessingEvent format directly without legacy classification overhead.
"""

import json
import sys
import uuid
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from decimal import Decimal
from enum import Enum
from dataclasses import is_dataclass, asdict

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

from .progress_manager import ProgressManager, ProcessingStage


class IPCHandler:
    """Modern IPC handler for ProcessingEvent communication with GUI."""
    
    def __init__(self):
        self.progress_manager = ProgressManager()
        self.session_id = str(uuid.uuid4())
        self.message_counter = 0
        self.command_line = self._capture_command_line()
        self.start_time = datetime.now(timezone.utc)
        
        # Store original stdout for direct IPC output (to avoid console interception loops)
        # In test environments, use sys.stdout directly to work with mocking
        if hasattr(sys, '_called_from_test') or 'pytest' in sys.modules:
            self._original_stdout = sys.stdout
        else:
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

    def _sanitize_for_json(self, obj):
        """Recursively sanitize data for JSON serialization, converting objects to dictionaries."""
        # Handle None
        if obj is None:
            return None
            
        # Handle basic JSON-serializable types
        elif isinstance(obj, (str, int, float, bool)):
            return obj
            
        # Handle datetime objects
        elif isinstance(obj, datetime):
            return obj.isoformat()
            
        # Handle Decimal objects
        elif isinstance(obj, Decimal):
            return float(obj)
            
        # Handle Enum objects
        elif isinstance(obj, Enum):
            return obj.value
            
        # Handle dataclasses
        elif is_dataclass(obj):
            try:
                return self._sanitize_for_json(asdict(obj))
            except Exception:
                # Fallback to manual conversion if asdict fails
                return self._sanitize_for_json(obj.__dict__)
                
        # Handle objects with to_dict method
        elif hasattr(obj, 'to_dict') and callable(getattr(obj, 'to_dict')):
            try:
                return self._sanitize_for_json(obj.to_dict())
            except Exception as e:
                # Fallback to string representation if to_dict fails
                return f"<{obj.__class__.__name__} to_dict failed: {str(e)}>"
                
        # Handle dictionaries
        elif isinstance(obj, dict):
            try:
                return {str(k): self._sanitize_for_json(v) for k, v in obj.items()}
            except Exception as e:
                return f"<dict serialization failed: {str(e)}>"
                
        # Handle lists and tuples
        elif isinstance(obj, (list, tuple)):
            try:
                return [self._sanitize_for_json(item) for item in obj]
            except Exception as e:
                return f"<list/tuple serialization failed: {str(e)}>"
                
        # Handle sets
        elif isinstance(obj, set):
            try:
                return [self._sanitize_for_json(item) for item in obj]
            except Exception as e:
                return f"<set serialization failed: {str(e)}>"
                
        # Handle custom objects with __dict__
        elif hasattr(obj, '__dict__') and not isinstance(obj, (str, int, float, bool, type(None))):
            try:
                class_name = obj.__class__.__name__
                
                # Special handling for known problematic classes
                if class_name == 'QualityIssue':
                    return {
                        "category": getattr(obj, 'category', 'unknown'),
                        "issue_type": getattr(obj, 'issue_type', 'unknown'),
                        "severity": getattr(obj, 'severity', 0.0),
                        "subtitle_index": getattr(obj, 'subtitle_index', None),
                        "description": getattr(obj, 'description', None),
                        "suggested_fix": getattr(obj, 'suggested_fix', None)
                    }
                elif class_name in ['QualityMetrics', 'CoverageMetrics', 'EnhancedStatistics']:
                    # Try to_dict first, then fallback to __dict__
                    if hasattr(obj, 'to_dict'):
                        return self._sanitize_for_json(obj.to_dict())
                    else:
                        return {str(k): self._sanitize_for_json(v) for k, v in obj.__dict__.items()}
                else:
                    # For other objects, convert their __dict__
                    return {str(k): self._sanitize_for_json(v) for k, v in obj.__dict__.items()}
                    
            except Exception as e:
                # Fallback to string representation with class info
                return f"<{obj.__class__.__name__} object serialization failed: {str(e)}>"
                
        # Handle other types with string conversion
        else:
            try:
                # Try to convert to string
                return str(obj)
            except Exception as e:
                # Last resort fallback
                return f"<{type(obj).__name__} string conversion failed: {str(e)}>"

    def _send_processing_event(self, processing_event: Dict[str, Any]) -> None:
        """Send ProcessingEvent directly to GUI via stdout."""
        try:
            # Sanitize the event data for JSON serialization
            sanitized_event = self._sanitize_for_json(processing_event)
            
            # Additional validation step - try to serialize to catch any remaining issues
            json_output = json.dumps(sanitized_event, ensure_ascii=False, separators=(',', ':'))
            
            # Use original stdout to avoid console interception loops
            self._original_stdout.write(json_output + '\n')
            self._original_stdout.flush()
            
        except (TypeError, ValueError, OverflowError) as e:
            # Enhanced error handling for JSON serialization failures
            self._send_fallback_error(f"JSON serialization failed: {str(e)} - Event type: {processing_event.get('type', 'unknown')}")
            
        except Exception as e:
            # Catch-all for any other serialization issues
            self._send_fallback_error(f"Unexpected error during event serialization: {str(e)}")
    
    def _send_fallback_error(self, error_msg: str) -> None:
        """Send fallback error when JSON fails."""
        # Create a simple, guaranteed-serializable error event
        fallback_event = {
            "type": "error",
            "data": {
                "status": "error",
                "error": str(error_msg),  # Ensure it's a string
                "message": str(error_msg)
            }
        }
        try:
            # Use minimal options to ensure serialization works
            json_output = json.dumps(fallback_event, ensure_ascii=True, separators=(',', ':'))
            self._original_stdout.write(json_output + '\n')
            self._original_stdout.flush()
        except Exception as final_error:
            # Last resort - write plain text with minimal formatting
            try:
                error_text = f"FATAL_JSON_ERROR: {str(error_msg)} | Final error: {str(final_error)}\n"
                self._original_stdout.write(error_text)
                self._original_stdout.flush()
            except:
                # Ultimate fallback - just try to write something
                try:
                    self._original_stdout.write("CRITICAL_SERIALIZATION_FAILURE\n")
                    self._original_stdout.flush()
                except:
                    pass  # Give up gracefully
    
    def send_log_message(self, message: str, phase: str = None) -> None:
        """Send log message in ProcessingEvent format."""
        processing_event = {
            "type": "log-message",
            "data": {
                "message": message
            }
        }
        
        if phase:
            processing_event["data"]["phase"] = phase
            
        self._send_processing_event(processing_event)
    
    def send_status_change(self, status: str, phase: str = None, message: str = None) -> None:
        """Send status change in ProcessingEvent format."""
        processing_event = {
            "type": "status-change",
            "data": {
                "status": status
            }
        }
        
        if phase:
            processing_event["data"]["phase"] = phase
        if message:
            processing_event["data"]["message"] = message
            
        self._send_processing_event(processing_event)
    
    def send_progress(self, stage: str, percent: float, message: str, 
                     substage: str = None, **kwargs) -> None:
        """Send enhanced progress update in ProcessingEvent format expected by GUI."""
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
        
        # Create ProcessingEvent structure expected by GUI (no nesting)
        processing_event = {
            "type": "progress-update",
            "data": {
                "progress": round(percent, 2),
                "phase": stage,
                "message": message
            }
        }
        
        # Add substage if available
        if substage:
            processing_event["data"]["substage"] = substage
            
        # Add any additional progress data
        processing_event["data"].update(kwargs)
        
        # Send ProcessingEvent using the helper method
        self._send_processing_event(processing_event)
    
    
    def send_completion_with_json_subtitles(
        self,
        subtitle_data: Dict[str, Any],
        output_file_path: Optional[str] = None,
        success: bool = True,
        **kwargs
    ) -> None:
        """
        Send completion event with JSON subtitle data in ProcessingEvent format.
        
        Args:
            subtitle_data: Complete JSON subtitle data structure
            output_file_path: Optional SRT file path for backward compatibility
            success: Whether the processing was successful
            **kwargs: Additional data to include
        """
        try:
            # Create descriptive content message
            if success:
                subtitle_count = 0
                if subtitle_data and "subtitles" in subtitle_data:
                    subtitle_count = len(subtitle_data["subtitles"])
                
                message = f"Processing completed: {subtitle_count} subtitles generated"
                if output_file_path:
                    message += f" (SRT: {output_file_path})"
            else:
                message = "Processing failed"
                if output_file_path:
                    message += f": {output_file_path}"
            
            # Create ProcessingEvent structure for completion
            processing_event = {
                "type": "complete",
                "data": {
                    "status": "completed" if success else "error",
                    "message": message,
                    "subtitleData": self._sanitize_for_json(subtitle_data),
                    "outputFile": output_file_path,
                    "outputFilePath": output_file_path,  # Alternative name as per interface
                    **kwargs
                }
            }
            
            # Add error field if failed
            if not success:
                processing_event["data"]["error"] = message
            
            # Send ProcessingEvent using the helper method
            self._send_processing_event(processing_event)
            
        except Exception as e:
            # Fallback error handling for JSON serialization failures
            error_msg = f"Failed to send completion event: {str(e)}"
            self._send_fallback_error(error_msg)
    
    
    def send_processing_error(self, error_msg: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Send processing error in ProcessingEvent format expected by GUI."""
        try:
            # Create ProcessingEvent structure for error
            processing_event = {
                "type": "error",
                "data": {
                    "status": "error",
                    "error": error_msg,
                    "message": error_msg
                }
            }
            
            # Add details if provided
            if details:
                processing_event["data"].update(details)
            
            # Send ProcessingEvent using the helper method
            self._send_processing_event(processing_event)
            
        except Exception as e:
            # Fallback error handling for JSON serialization failures
            fallback_msg = f"Failed to send processing error: {str(e)} (Original error: {error_msg})"
            self._send_fallback_error(fallback_msg)
    


# Global handler instance
_handler: Optional[IPCHandler] = None


def get_handler() -> IPCHandler:
    """Get global IPC handler instance."""
    global _handler
    if _handler is None:
        _handler = IPCHandler()
    return _handler


# Public API functions for ProcessingEvent communication
def ipc_log_message(message: str, phase: str = None) -> None:
    """Send log message in ProcessingEvent format."""
    handler = get_handler()
    handler.send_log_message(message, phase)


def ipc_progress(task: str, percent: float, details: Optional[str] = None, 
                substage: str = None, **kwargs) -> None:
    """Send enhanced progress update."""
    handler = get_handler()
    message = f"{task}: {details}" if details else task
    handler.send_progress(task, percent, message, substage, **kwargs)


def ipc_completion_with_json(subtitle_data: Dict[str, Any], 
                            output_file_path: Optional[str] = None,
                            success: bool = True, **kwargs) -> None:
    """Send completion event with JSON subtitle data in ProcessingEvent format."""
    handler = get_handler()
    handler.send_completion_with_json_subtitles(subtitle_data, output_file_path, success, **kwargs)


def ipc_processing_error(error: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Send processing error in ProcessingEvent format expected by GUI."""
    handler = get_handler()
    handler.send_processing_error(error, details)


def ipc_status_change(status: str, phase: str = None, message: str = None) -> None:
    """Send status change in ProcessingEvent format."""
    handler = get_handler()
    handler.send_status_change(status, phase, message)


# Legacy compatibility functions (for backwards compatibility during transition)
def ipc_log(message: str, level: str = "info") -> None:
    """Send log message - redirects to new format."""
    ipc_log_message(message)

def ipc_error(error: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Send error message - redirects to new format.""" 
    ipc_processing_error(error, details)

def ipc_result(path: str, success: bool = True, **kwargs) -> None:
    """Send result - redirects to completion format."""
    # For results without subtitle data, send a basic completion
    ipc_completion_with_json({}, path, success, **kwargs)


