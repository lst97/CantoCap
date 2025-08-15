"""
Console output interceptor for comprehensive IPC logging.
"""

import sys
import io
import threading
import time
from typing import Optional, Callable, TextIO
from contextlib import contextmanager

try:
    from .ipc_handler import get_handler
except ImportError:
    # Handle standalone testing
    pass


class StreamCapture:
    """Custom stream wrapper that captures and forwards output to IPC."""
    
    def __init__(self, stream_name: str, original_stream: TextIO, ipc_handler):
        self.stream_name = stream_name
        self.original_stream = original_stream
        self.ipc_handler = ipc_handler
        self._lock = threading.Lock()
        
        # Copy important attributes from original stream
        self.encoding = getattr(original_stream, 'encoding', 'utf-8')
        self.mode = getattr(original_stream, 'mode', 'w')
        self.name = getattr(original_stream, 'name', f'<{stream_name}>')
        self.closed = False
        
    def write(self, text: str) -> int:
        """Capture and forward output to both original stream and IPC."""
        if not text or text.isspace():
            return len(text)
            
        with self._lock:
            # Write to original stream for normal console output
            result = self.original_stream.write(text)
            self.original_stream.flush()
            
            # Process and send to IPC
            self._process_and_send(text.rstrip('\n'))
            
        return result
    
    def flush(self):
        """Flush the original stream."""
        self.original_stream.flush()
    
    def close(self):
        """Close the stream."""
        self.closed = True
        if hasattr(self.original_stream, 'close'):
            self.original_stream.close()
    
    def writable(self):
        """Return whether the stream supports writing."""
        return True
    
    def readable(self):
        """Return whether the stream supports reading."""
        return False
    
    def seekable(self):
        """Return whether the stream supports seeking."""
        return False
    
    def isatty(self):
        """Return whether the stream is a TTY."""
        return getattr(self.original_stream, 'isatty', lambda: False)()
    
    def _process_and_send(self, content: str):
        """Process captured content and send via IPC."""
        if not content.strip():
            return
            
        # Send the console output as log message via IPC
        # IPC handler now uses original stdout directly to avoid infinite recursion
        self.ipc_handler.send_log_message(content)


class ConsoleInterceptor:
    """Global console output interceptor for comprehensive IPC logging."""
    
    def __init__(self, ipc_handler=None):
        self.ipc_handler = ipc_handler or get_handler()
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        self.original_print = print
        self.is_active = False
        self._captured_streams = {}
        
    def start_capture(self):
        """Start capturing all console output."""
        if self.is_active:
            return
            
        self.is_active = True
        
        # Replace stdout and stderr with our custom streams
        sys.stdout = StreamCapture('stdout', self.original_stdout, self.ipc_handler)
        sys.stderr = StreamCapture('stderr', self.original_stderr, self.ipc_handler)
        
        # Replace print function to ensure we catch everything
        def captured_print(*args, **kwargs):
            # Use our custom stdout for print statements
            kwargs.setdefault('file', sys.stdout)
            self.original_print(*args, **kwargs)
            
        # Monkey patch the print function
        import builtins
        builtins.print = captured_print
        
    def stop_capture(self):
        """Stop capturing console output and restore original streams."""
        if not self.is_active:
            return
            
        self.is_active = False
        
        # Restore original streams
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr
        
        # Restore original print function
        import builtins
        builtins.print = self.original_print
        
    @contextmanager
    def capture_context(self):
        """Context manager for temporary console capture."""
        self.start_capture()
        try:
            yield
        finally:
            self.stop_capture()
    
    def __enter__(self):
        self.start_capture()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop_capture()


# Global interceptor instance
_global_interceptor: Optional[ConsoleInterceptor] = None


def start_console_capture(ipc_handler=None):
    """Start global console capture."""
    global _global_interceptor
    if _global_interceptor is None:
        _global_interceptor = ConsoleInterceptor(ipc_handler)
    _global_interceptor.start_capture()


def stop_console_capture():
    """Stop global console capture."""
    global _global_interceptor
    if _global_interceptor:
        _global_interceptor.stop_capture()


@contextmanager
def console_capture_context(ipc_handler=None):
    """Context manager for console capture."""
    start_console_capture(ipc_handler)
    try:
        yield
    finally:
        stop_console_capture()