"""Enhanced error handling for CantoSub application."""

import traceback
import functools
from typing import Any, Callable, Optional, Type, Union
from pathlib import Path
import sys

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text
    _console = Console()
    _rich_available = True
except ImportError:
    _console = None
    _rich_available = False


class CantoSubError(Exception):
    """Base exception for CantoSub errors."""
    
    def __init__(self, message: str, error_code: str = None, details: dict = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}


class AudioProcessingError(CantoSubError):
    """Errors related to audio processing."""
    pass


class TranscriptionError(CantoSubError):
    """Errors related to transcription."""
    pass


class LLMProcessingError(CantoSubError):
    """Errors related to LLM processing."""
    pass


class FileSystemError(CantoSubError):
    """Errors related to file system operations."""
    pass


class DependencyError(CantoSubError):
    """Errors related to missing dependencies."""
    pass


class ConfigurationError(CantoSubError):
    """Errors related to configuration."""
    pass


class ValidationError(CantoSubError):
    """Errors related to input validation."""
    pass


def _print_error(message: str, error_type: str = "Error", details: dict = None) -> None:
    """Print error message using Rich if available."""
    if _rich_available and _console:
        error_text = Text()
        error_text.append("❌ ", style="red")
        error_text.append(f"{error_type}: ", style="bold red")
        error_text.append(message, style="red")
        
        if details:
            error_text.append("\n\n📋 Details:\n", style="bold")
            for key, value in details.items():
                error_text.append(f"   • {key}: {value}\n", style="yellow")
        
        _console.print(Panel(
            error_text,
            title="🚨 Error",
            title_align="left",
            border_style="red"
        ))
    else:
        print(f"❌ {error_type}: {message}")
        if details:
            print("\n📋 Details:")
            for key, value in details.items():
                print(f"   • {key}: {value}")


def _print_warning(message: str, details: dict = None) -> None:
    """Print warning message using Rich if available."""
    if _rich_available and _console:
        warning_text = Text()
        warning_text.append("⚠️ ", style="yellow")
        warning_text.append("Warning: ", style="bold yellow")
        warning_text.append(message, style="yellow")
        
        if details:
            warning_text.append("\n\n📋 Details:\n", style="bold")
            for key, value in details.items():
                warning_text.append(f"   • {key}: {value}\n", style="cyan")
        
        _console.print(Panel(
            warning_text,
            title="⚠️ Warning",
            title_align="left",
            border_style="yellow"
        ))
    else:
        print(f"⚠️ Warning: {message}")
        if details:
            print("\n📋 Details:")
            for key, value in details.items():
                print(f"   • {key}: {value}")


def handle_error(
    error: Exception,
    context: str = "Operation",
    exit_code: int = None,
    show_traceback: bool = False,
    ipc_mode: bool = False
) -> None:
    """
    Handle errors with rich formatting and optional exit.
    
    Args:
        error: Exception to handle
        context: Context description for the error
        exit_code: If provided, exit with this code
        show_traceback: Whether to show full traceback
        ipc_mode: Whether to output JSON errors for IPC communication
    """
    error_type = type(error).__name__
    message = str(error)
    
    details = {}
    if hasattr(error, 'details'):
        details.update(error.details)
    
    if hasattr(error, 'error_code'):
        details['Error Code'] = error.error_code
    
    details['Context'] = context
    
    if show_traceback:
        details['Traceback'] = traceback.format_exc()
    
    if ipc_mode:
        # Import here to avoid circular imports
        from ..presentation.cli.ipc_handler import _output_json
        
        # Create structured error data for IPC - flatten structure for better access
        error_data = {
            'error': message,
            'error_type': error_type,
            'context': context
        }
        
        # Add custom error details if available
        if hasattr(error, 'details') and error.details:
            error_data.update(error.details)
        
        # Add error code if available
        if hasattr(error, 'error_code'):
            error_data['error_code'] = error.error_code
        
        # Add traceback if requested
        if show_traceback:
            error_data['traceback'] = traceback.format_exc()
        
        # Output JSON error directly with flattened structure
        _output_json("error", error_data)
    else:
        _print_error(message, error_type, details)
    
    if exit_code is not None:
        sys.exit(exit_code)


def handle_warning(message: str, context: str = None, details: dict = None, ipc_mode: bool = False) -> None:
    """
    Handle warnings with rich formatting.
    
    Args:
        message: Warning message
        context: Context description
        details: Additional details dictionary
        ipc_mode: Whether to output JSON warnings for IPC communication
    """
    warning_details = details or {}
    if context:
        warning_details['Context'] = context
    
    if ipc_mode:
        # Import here to avoid circular imports
        from ..presentation.cli.ipc_handler import ipc_log
        
        # Create structured warning data for IPC
        log_details = {}
        if context:
            log_details['context'] = context
        if details:
            log_details.update(details)
        
        # Output as warning-level log in IPC mode
        if log_details:
            ipc_log(f"{message} - Details: {log_details}", "warning")
        else:
            ipc_log(message, "warning")
    else:
        _print_warning(message, warning_details)


def safe_execute(
    func: Callable,
    error_message: str = "Operation failed",
    error_type: Type[CantoSubError] = CantoSubError,
    context: str = None,
    default_return: Any = None,
    reraise: bool = True,
    ipc_mode: bool = False
) -> Any:
    """
    Safely execute a function with error handling.
    
    Args:
        func: Function to execute
        error_message: Custom error message
        error_type: Exception type to raise
        context: Context for error reporting
        default_return: Value to return on error (if not reraising)
        reraise: Whether to reraise exceptions
        ipc_mode: Whether to output JSON warnings for IPC communication
        
    Returns:
        Function result or default_return on error
        
    Raises:
        CantoSubError: If reraise is True and an error occurs
    """
    try:
        return func()
    except Exception as e:
        if reraise:
            if isinstance(e, CantoSubError):
                raise
            else:
                raise error_type(
                    f"{error_message}: {str(e)}",
                    details={'original_error': str(e), 'context': context}
                )
        else:
            handle_warning(
                f"{error_message}: {str(e)}",
                context=context,
                details={'original_error': str(e)},
                ipc_mode=ipc_mode
            )
            return default_return


def robust_file_operation(
    operation: str,
    file_path: Union[str, Path],
    context: str = None
) -> Callable:
    """
    Decorator for robust file operations.
    
    Args:
        operation: Description of the operation
        file_path: Path to the file being operated on
        context: Additional context
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except FileNotFoundError as e:
                raise FileSystemError(
                    f"File not found during {operation}",
                    details={
                        'file_path': str(file_path),
                        'operation': operation,
                        'context': context,
                        'original_error': str(e)
                    }
                )
            except PermissionError as e:
                raise FileSystemError(
                    f"Permission denied during {operation}",
                    details={
                        'file_path': str(file_path),
                        'operation': operation,
                        'context': context,
                        'original_error': str(e)
                    }
                )
            except OSError as e:
                raise FileSystemError(
                    f"OS error during {operation}",
                    details={
                        'file_path': str(file_path),
                        'operation': operation,
                        'context': context,
                        'original_error': str(e)
                    }
                )
            except Exception as e:
                raise FileSystemError(
                    f"Unexpected error during {operation}",
                    details={
                        'file_path': str(file_path),
                        'operation': operation,
                        'context': context,
                        'original_error': str(e)
                    }
                )
        return wrapper
    return decorator


def check_dependencies(dependencies: list[str], context: str = "Operation") -> None:
    """
    Check if required dependencies are available.
    
    Args:
        dependencies: List of module names to check
        context: Context for error reporting
        
    Raises:
        DependencyError: If any dependency is missing
    """
    missing = []
    for dep in dependencies:
        try:
            __import__(dep)
        except ImportError:
            missing.append(dep)
    
    if missing:
        raise DependencyError(
            f"Missing required dependencies for {context}",
            details={
                'missing_dependencies': missing,
                'install_command': f"pip install {' '.join(missing)}",
                'context': context
            }
        )


def validate_file_path(
    file_path: Union[str, Path],
    must_exist: bool = True,
    must_be_file: bool = True,
    readable: bool = True,
    writable: bool = False
) -> Path:
    """
    Validate file path with comprehensive checks.
    
    Args:
        file_path: Path to validate
        must_exist: Whether file must exist
        must_be_file: Whether path must be a file (not directory)
        readable: Whether file must be readable
        writable: Whether file must be writable
        
    Returns:
        Path: Validated path object
        
    Raises:
        ValidationError: If validation fails
    """
    path = Path(file_path)
    
    if must_exist and not path.exists():
        raise ValidationError(
            f"File does not exist: {path}",
            details={'file_path': str(path), 'requirement': 'must_exist'}
        )
    
    if path.exists():
        if must_be_file and not path.is_file():
            raise ValidationError(
                f"Path is not a file: {path}",
                details={'file_path': str(path), 'requirement': 'must_be_file'}
            )
        
        if readable and not os.access(path, os.R_OK):
            raise ValidationError(
                f"File is not readable: {path}",
                details={'file_path': str(path), 'requirement': 'readable'}
            )
        
        if writable and not os.access(path, os.W_OK):
            raise ValidationError(
                f"File is not writable: {path}",
                details={'file_path': str(path), 'requirement': 'writable'}
            )
    
    return path


def validate_audio_file(file_path: Union[str, Path]) -> Path:
    """
    Validate audio/video file.
    
    Args:
        file_path: Path to audio/video file
        
    Returns:
        Path: Validated path object
        
    Raises:
        ValidationError: If validation fails
    """
    path = validate_file_path(file_path, must_exist=True, must_be_file=True, readable=True)
    
    # Check file extension
    valid_extensions = {
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',  # Audio
        '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv'    # Video
    }
    
    if path.suffix.lower() not in valid_extensions:
        handle_warning(
            f"File extension '{path.suffix}' may not be supported",
            context="Audio file validation",
            details={
                'file_path': str(path),
                'file_extension': path.suffix,
                'supported_extensions': list(valid_extensions)
            }
        )
    
    # Check file size (warn if very large)
    try:
        size_mb = path.stat().st_size / (1024 * 1024)
        if size_mb > 1000:  # > 1GB
            handle_warning(
                f"Large file detected ({size_mb:.1f}MB). Processing may take a long time.",
                context="Audio file validation",
                details={'file_path': str(path), 'size_mb': f"{size_mb:.1f}"}
            )
    except Exception:
        pass  # Ignore size check errors
    
    return path


# Global IPC mode state
_global_ipc_mode = False

def set_global_ipc_mode(enabled: bool) -> None:
    """Set global IPC mode for error handling."""
    global _global_ipc_mode
    _global_ipc_mode = enabled

def get_global_ipc_mode() -> bool:
    """Get current global IPC mode setting."""
    return _global_ipc_mode

# Global error handler setup
def setup_global_error_handler():
    """Setup global exception handler."""
    def handle_exception(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            # Handle Ctrl+C gracefully
            if _global_ipc_mode:
                from ..presentation.cli.ipc_handler import _output_json
                error_data = {
                    "error": "Operation cancelled by user",
                    "reason": "keyboard_interrupt"
                }
                _output_json("error", error_data)
            elif _rich_available and _console:
                _console.print("\n\n🛑 [yellow]Operation cancelled by user[/yellow]")
            else:
                print("\n\n🛑 Operation cancelled by user")
            sys.exit(1)
        else:
            # Handle other exceptions
            handle_error(
                exc_value,
                context="Global exception handler",
                show_traceback=True,
                exit_code=1,
                ipc_mode=_global_ipc_mode
            )
    
    sys.excepthook = handle_exception


# Import os for file permission checks
import os