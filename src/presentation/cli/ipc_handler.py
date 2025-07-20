"""
IPC Handler Module for JSON-based Inter-Process Communication.

This module provides functions for outputting machine-readable JSON messages
to stdout for GUI integration and external process communication.
"""

import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _get_timestamp() -> str:
    """Generate ISO 8601 timestamp with timezone."""
    return datetime.now(timezone.utc).isoformat()


def _output_json(message_type: str, data: Dict[str, Any]) -> None:
    """Output JSON message to stdout with consistent formatting."""
    message = {
        "type": message_type,
        "timestamp": _get_timestamp(),
        "data": data
    }
    
    try:
        json_output = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
        print(json_output, flush=True)
    except (TypeError, ValueError) as e:
        # Fallback error output if JSON serialization fails
        error_message = {
            "type": "error",
            "timestamp": _get_timestamp(),
            "data": {
                "error": f"JSON serialization failed: {str(e)}",
                "original_type": message_type
            }
        }
        print(json.dumps(error_message), flush=True)


def ipc_log(message: str, level: str = "info") -> None:
    """
    Output log message as JSON.
    
    Args:
        message: The log message to output
        level: Log level (info, warning, error, debug)
    """
    data = {
        "message": message,
        "level": level
    }
    _output_json("log", data)


def ipc_progress(task: str, percent: float, details: Optional[str] = None) -> None:
    """
    Output progress update as JSON.
    
    Args:
        task: Name of the current task
        percent: Progress percentage (0.0 to 100.0)
        details: Optional additional details about the progress
    """
    data = {
        "task": task,
        "percent": round(percent, 2),
    }
    
    if details is not None:
        data["details"] = details
        
    _output_json("progress", data)


def ipc_result(path: str, success: bool = True, **kwargs) -> None:
    """
    Output final result as JSON.
    
    Args:
        path: Path to the output file
        success: Whether the operation was successful
        **kwargs: Additional result data (subtitle_count, processing_time, etc.)
    """
    data = {
        "path": path,
        "success": success
    }
    
    # Add any additional result data
    data.update(kwargs)
    
    _output_json("result", data)


def ipc_error(error: str, details: Optional[Dict[str, Any]] = None) -> None:
    """
    Output error message as JSON.
    
    Args:
        error: Error message
        details: Optional dictionary with additional error details
    """
    data = {
        "error": error
    }
    
    if details is not None:
        data["details"] = details
        
    _output_json("error", data)