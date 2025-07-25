"""Comprehensive argument validation for CantoCap CLI."""

import re
import os
from pathlib import Path
from typing import Optional, List, Dict, Any, Union, Tuple
from dataclasses import dataclass
from enum import Enum

from ...domain.value_objects import LanguageCode
from ...domain.value_objects.alignment_language_code import AlignmentLanguageCode


class ValidationSeverity(Enum):
    """Severity levels for validation issues."""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    """Represents a single validation issue."""
    field: str
    message: str
    severity: ValidationSeverity
    suggestion: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of argument validation."""
    is_valid: bool
    issues: List[ValidationIssue]
    sanitized_value: Optional[Any] = None
    
    @property
    def has_errors(self) -> bool:
        """Check if there are any error-level issues."""
        return any(issue.severity == ValidationSeverity.ERROR for issue in self.issues)
    
    @property
    def has_warnings(self) -> bool:
        """Check if there are any warning-level issues."""
        return any(issue.severity == ValidationSeverity.WARNING for issue in self.issues)
    
    def get_error_messages(self) -> List[str]:
        """Get all error messages."""
        return [issue.message for issue in self.issues if issue.severity == ValidationSeverity.ERROR]
    
    def get_warning_messages(self) -> List[str]:
        """Get all warning messages."""
        return [issue.message for issue in self.issues if issue.severity == ValidationSeverity.WARNING]


class ValidationError(Exception):
    """Raised when argument validation fails."""
    def __init__(self, field: str, message: str, suggestion: Optional[str] = None):
        self.field = field
        self.message = message
        self.suggestion = suggestion
        super().__init__(f"{field}: {message}")


class ArgumentValidator:
    """Comprehensive argument validator for CantoCap CLI."""
    
    # Dangerous path characters that could cause shell injection or path traversal
    DANGEROUS_PATH_CHARS = ['$', '`', '|', '&', ';', '>', '<', '(', ')', '{', '}', '!', '\n', '\r', '\0']
    
    # Valid path pattern (alphanumeric, spaces, common punctuation, path separators)
    VALID_PATH_PATTERN = re.compile(r'^[a-zA-Z0-9\s\-_.,/\\:~]+$')
    
    # File size limits
    MAX_FILE_SIZE_GB = 10  # Maximum file size in GB
    WARN_FILE_SIZE_GB = 1  # Warn if file size exceeds this
    
    # Supported media formats
    SUPPORTED_AUDIO_FORMATS = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.opus'}
    SUPPORTED_VIDEO_FORMATS = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'}
    SUPPORTED_FORMATS = SUPPORTED_AUDIO_FORMATS | SUPPORTED_VIDEO_FORMATS
    
    @classmethod
    def validate_file_path(
        cls,
        path: Union[str, Path],
        field_name: str = "file_path",
        must_exist: bool = True,
        must_be_file: bool = True,
        allowed_extensions: Optional[set] = None,
        check_readable: bool = True,
        check_writable: bool = False
    ) -> ValidationResult:
        """
        Validate a file path with comprehensive checks.
        
        Args:
            path: The file path to validate
            field_name: Name of the field for error messages
            must_exist: Whether the file must exist
            must_be_file: Whether the path must be a file (not directory)
            allowed_extensions: Set of allowed file extensions (e.g., {'.mp3', '.wav'})
            check_readable: Whether to check if file is readable
            check_writable: Whether to check if file/directory is writable
            
        Returns:
            ValidationResult with validation status and any issues
        """
        issues = []
        
        # Convert to string if Path object
        path_str = str(path)
        
        # Check for empty path
        if not path_str or path_str.isspace():
            issues.append(ValidationIssue(
                field=field_name,
                message="Path cannot be empty or contain only whitespace",
                severity=ValidationSeverity.ERROR
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Check for dangerous characters
        dangerous_chars_found = [char for char in cls.DANGEROUS_PATH_CHARS if char in path_str]
        if dangerous_chars_found:
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Path contains potentially dangerous characters: {dangerous_chars_found}",
                severity=ValidationSeverity.ERROR,
                suggestion="Remove special characters from the path"
            ))
        
        # Check for path traversal attempts
        if '..' in path_str or path_str.startswith('~'):
            normalized_path = os.path.normpath(os.path.expanduser(path_str))
            if '..' in normalized_path:
                issues.append(ValidationIssue(
                    field=field_name,
                    message="Path traversal detected",
                    severity=ValidationSeverity.ERROR,
                    suggestion="Use absolute paths or paths relative to current directory"
                ))
        
        # Handle spaces in path (warning, not error)
        if ' ' in path_str:
            issues.append(ValidationIssue(
                field=field_name,
                message="Path contains spaces which may cause issues",
                severity=ValidationSeverity.WARNING,
                suggestion=f"Consider using quoted path: \"{path_str}\""
            ))
        
        # Create Path object for further validation
        try:
            path_obj = Path(path_str).resolve()
        except (ValueError, OSError) as e:
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Invalid path format: {str(e)}",
                severity=ValidationSeverity.ERROR
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Check if path exists
        if must_exist and not path_obj.exists():
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Path does not exist: {path_obj}",
                severity=ValidationSeverity.ERROR,
                suggestion="Check the file path and ensure the file exists"
            ))
        
        # Check if it's a file or directory
        if path_obj.exists():
            if must_be_file and not path_obj.is_file():
                issues.append(ValidationIssue(
                    field=field_name,
                    message=f"Path is not a file: {path_obj}",
                    severity=ValidationSeverity.ERROR,
                    suggestion="Provide a path to a file, not a directory"
                ))
            
            # Check file extension
            if must_be_file and allowed_extensions:
                ext = path_obj.suffix.lower()
                if ext not in allowed_extensions:
                    issues.append(ValidationIssue(
                        field=field_name,
                        message=f"File type '{ext}' is not supported",
                        severity=ValidationSeverity.ERROR,
                        suggestion=f"Supported formats: {', '.join(sorted(allowed_extensions))}"
                    ))
            
            # Check file size
            if must_be_file and path_obj.is_file():
                file_size_gb = path_obj.stat().st_size / (1024 ** 3)
                if file_size_gb > cls.MAX_FILE_SIZE_GB:
                    issues.append(ValidationIssue(
                        field=field_name,
                        message=f"File size ({file_size_gb:.1f}GB) exceeds maximum limit ({cls.MAX_FILE_SIZE_GB}GB)",
                        severity=ValidationSeverity.ERROR,
                        suggestion="Use a smaller file or split it into chunks"
                    ))
                elif file_size_gb > cls.WARN_FILE_SIZE_GB:
                    issues.append(ValidationIssue(
                        field=field_name,
                        message=f"Large file size ({file_size_gb:.1f}GB) may take a long time to process",
                        severity=ValidationSeverity.WARNING,
                        suggestion="Consider using a smaller file for faster processing"
                    ))
            
            # Check permissions
            if check_readable and not os.access(path_obj, os.R_OK):
                issues.append(ValidationIssue(
                    field=field_name,
                    message="File is not readable",
                    severity=ValidationSeverity.ERROR,
                    suggestion="Check file permissions"
                ))
            
            if check_writable:
                # For files that exist, check write permission
                if path_obj.is_file() and not os.access(path_obj, os.W_OK):
                    issues.append(ValidationIssue(
                        field=field_name,
                        message="File is not writable",
                        severity=ValidationSeverity.ERROR,
                        suggestion="Check file permissions"
                    ))
                # For directories, check if we can write to them
                elif path_obj.is_dir() and not os.access(path_obj, os.W_OK):
                    issues.append(ValidationIssue(
                        field=field_name,
                        message="Directory is not writable",
                        severity=ValidationSeverity.ERROR,
                        suggestion="Check directory permissions"
                    ))
        
        # For output paths that don't exist, check parent directory
        elif not must_exist and check_writable:
            parent_dir = path_obj.parent
            if not parent_dir.exists():
                issues.append(ValidationIssue(
                    field=field_name,
                    message=f"Parent directory does not exist: {parent_dir}",
                    severity=ValidationSeverity.ERROR,
                    suggestion="Create the parent directory first"
                ))
            elif not os.access(parent_dir, os.W_OK):
                issues.append(ValidationIssue(
                    field=field_name,
                    message=f"Cannot write to parent directory: {parent_dir}",
                    severity=ValidationSeverity.ERROR,
                    suggestion="Check directory permissions"
                ))
        
        # Return result
        is_valid = not any(issue.severity == ValidationSeverity.ERROR for issue in issues)
        sanitized_path = str(path_obj) if is_valid else None
        
        return ValidationResult(
            is_valid=is_valid,
            issues=issues,
            sanitized_value=sanitized_path
        )
    
    @classmethod
    def validate_alignment_language_code(cls, code: str, field_name: str = "language") -> ValidationResult:
        """Validate an alignment language code (simple 2-letter format)."""
        issues = []
        
        if not code:
            issues.append(ValidationIssue(
                field=field_name,
                message="Language code cannot be empty",
                severity=ValidationSeverity.ERROR
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Check if alignment language is supported
        if not AlignmentLanguageCode.is_supported(code):
            supported_codes = AlignmentLanguageCode.get_supported_codes()
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Unsupported language code: '{code}'",
                severity=ValidationSeverity.ERROR,
                suggestion=f"Supported codes: {', '.join(sorted(supported_codes.keys()))}"
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Normalize the language code
        try:
            normalized = AlignmentLanguageCode.from_string(code)
            
            # Check if language is not Chinese and add warning
            if not normalized.is_chinese:
                issues.append(ValidationIssue(
                    field=field_name,
                    message=f"CantoCap is optimized for Chinese language processing. "
                           f"While '{normalized.code}' is supported, you may experience "
                           f"unexpected behavior or reduced accuracy for non-Chinese content.",
                    severity=ValidationSeverity.WARNING,
                    suggestion="For best results, use Chinese language code (zh)"
                ))
            
            return ValidationResult(
                is_valid=True,
                issues=issues,
                sanitized_value=str(normalized)
            )
        except ValueError as e:
            issues.append(ValidationIssue(
                field=field_name,
                message=str(e),
                severity=ValidationSeverity.ERROR
            ))
            return ValidationResult(is_valid=False, issues=issues)
    
    @classmethod
    def validate_translation_language_code(cls, code: str, field_name: str = "subtitle") -> ValidationResult:
        """Validate a translation language code (full language_country format)."""
        issues = []
        
        if not code:
            issues.append(ValidationIssue(
                field=field_name,
                message="Language code cannot be empty",
                severity=ValidationSeverity.ERROR
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Check if translation language is supported
        if not LanguageCode.is_supported(code):
            supported_codes = LanguageCode.get_supported_codes()
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Unsupported language code: '{code}'",
                severity=ValidationSeverity.ERROR,
                suggestion=f"Supported codes: {', '.join(sorted(supported_codes.keys()))}"
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Normalize the language code
        try:
            normalized = LanguageCode.from_string(code)
            
            return ValidationResult(
                is_valid=True,
                issues=issues,
                sanitized_value=str(normalized)
            )
        except ValueError as e:
            issues.append(ValidationIssue(
                field=field_name,
                message=str(e),
                severity=ValidationSeverity.ERROR
            ))
            return ValidationResult(is_valid=False, issues=issues)
    
    @classmethod
    def validate_language_code(cls, code: str, field_name: str = "language") -> ValidationResult:
        """Validate a language code (legacy method - defaults to alignment language)."""
        # For backward compatibility, default to alignment language validation
        return cls.validate_alignment_language_code(code, field_name)
    
    @classmethod
    def validate_enum_value(
        cls,
        value: str,
        allowed_values: List[str],
        field_name: str,
        case_sensitive: bool = False
    ) -> ValidationResult:
        """Validate that a value is in a list of allowed values."""
        issues = []
        
        if not value:
            issues.append(ValidationIssue(
                field=field_name,
                message=f"{field_name} cannot be empty",
                severity=ValidationSeverity.ERROR
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Normalize for comparison if not case sensitive
        check_value = value if case_sensitive else value.lower()
        allowed_normalized = allowed_values if case_sensitive else [v.lower() for v in allowed_values]
        
        if check_value not in allowed_normalized:
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Invalid value '{value}' for {field_name}",
                severity=ValidationSeverity.ERROR,
                suggestion=f"Must be one of: {', '.join(allowed_values)}"
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Return the original allowed value (properly cased)
        if not case_sensitive:
            idx = allowed_normalized.index(check_value)
            sanitized = allowed_values[idx]
        else:
            sanitized = value
        
        return ValidationResult(
            is_valid=True,
            issues=[],
            sanitized_value=sanitized
        )
    
    @classmethod
    def validate_model_name(cls, model: Optional[str], field_name: str = "model") -> ValidationResult:
        """Validate Whisper model name."""
        issues = []
        
        # Model can be None for auto-selection
        if model is None:
            return ValidationResult(is_valid=True, issues=[], sanitized_value=None)
        
        # List of valid Whisper models (full format only)
        valid_models = [
            # Full OpenAI format names
            "openai/whisper-small",
            "openai/whisper-medium", 
            "openai/whisper-large-v2", 
            "openai/whisper-large-v3", 
            "openai/whisper-large-v3-turbo",
            # WhisperX model
            "whisperX/large-v3"
        ]
        
        if model not in valid_models:
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Invalid model name: '{model}'",
                severity=ValidationSeverity.ERROR,
                suggestion=f"Valid models: {', '.join(valid_models)}"
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        return ValidationResult(is_valid=True, issues=[], sanitized_value=model)
    
    @classmethod
    def validate_ffmpeg_path(cls, path: Optional[str], field_name: str = "ffmpeg_path") -> ValidationResult:
        """Validate FFmpeg executable path - requires full path to executable."""
        issues = []
        
        if path is None:
            issues.append(ValidationIssue(
                field=field_name,
                message="FFmpeg path is required",
                severity=ValidationSeverity.ERROR,
                suggestion="Provide the full path to FFmpeg executable (e.g., /usr/bin/ffmpeg or C:\\ffmpeg\\bin\\ffmpeg.exe)"
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Reject "ffmpeg" - require full path only
        if path == "ffmpeg":
            issues.append(ValidationIssue(
                field=field_name,
                message="FFmpeg path must be a full path to the executable, not just 'ffmpeg'",
                severity=ValidationSeverity.ERROR,
                suggestion="Provide the full path to FFmpeg executable (e.g., /usr/bin/ffmpeg or C:\\ffmpeg\\bin\\ffmpeg.exe)"
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        # Validate as a file path with proper Windows support
        result = cls.validate_file_path(
            path,
            field_name=field_name,
            must_exist=True,
            must_be_file=True,
            allowed_extensions={'.exe', ''} if os.name == 'nt' else {''}, 
            check_readable=True,
            check_writable=False
        )
        
        # Additional check for executability (skip on Windows for .exe files)
        if result.is_valid and result.sanitized_value:
            path_obj = Path(result.sanitized_value)
            
            # On Windows, .exe files are executable by default
            if os.name == 'nt':
                if not path_obj.suffix.lower() == '.exe':
                    result.issues.append(ValidationIssue(
                        field=field_name,
                        message="On Windows, FFmpeg executable should have .exe extension",
                        severity=ValidationSeverity.WARNING,
                        suggestion="Use ffmpeg.exe instead of ffmpeg"
                    ))
            else:
                # On Unix systems, check executable permission
                if not os.access(path_obj, os.X_OK):
                    result.issues.append(ValidationIssue(
                        field=field_name,
                        message="FFmpeg file is not executable",
                        severity=ValidationSeverity.ERROR,
                        suggestion="Check file permissions (chmod +x on Unix systems)"
                    ))
                    result.is_valid = False
        
        return result
    
    @classmethod
    def validate_numeric_range(
        cls,
        value: Union[int, float],
        min_value: Optional[Union[int, float]] = None,
        max_value: Optional[Union[int, float]] = None,
        field_name: str = "value"
    ) -> ValidationResult:
        """Validate that a numeric value is within a specified range."""
        issues = []
        
        if min_value is not None and value < min_value:
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Value {value} is below minimum ({min_value})",
                severity=ValidationSeverity.ERROR,
                suggestion=f"Value must be at least {min_value}"
            ))
        
        if max_value is not None and value > max_value:
            issues.append(ValidationIssue(
                field=field_name,
                message=f"Value {value} exceeds maximum ({max_value})",
                severity=ValidationSeverity.ERROR,
                suggestion=f"Value must be at most {max_value}"
            ))
        
        return ValidationResult(
            is_valid=len(issues) == 0,
            issues=issues,
            sanitized_value=value if len(issues) == 0 else None
        )
    
    @classmethod
    def validate_api_key(cls, key: Optional[str], field_name: str = "api_key", required: bool = False) -> ValidationResult:
        """Validate an API key format."""
        issues = []
        
        if required and not key:
            issues.append(ValidationIssue(
                field=field_name,
                message="API key is required",
                severity=ValidationSeverity.ERROR,
                suggestion="Provide API key via parameter or environment variable"
            ))
            return ValidationResult(is_valid=False, issues=issues)
        
        if key:
            # Check for common API key format issues
            if len(key) < 10:
                issues.append(ValidationIssue(
                    field=field_name,
                    message="API key appears to be too short",
                    severity=ValidationSeverity.WARNING,
                    suggestion="Verify that you've provided the complete API key"
                ))
            
            if ' ' in key:
                issues.append(ValidationIssue(
                    field=field_name,
                    message="API key contains spaces",
                    severity=ValidationSeverity.ERROR,
                    suggestion="Remove any spaces from the API key"
                ))
            
            # Check for common placeholder values
            placeholders = ['your-api-key', 'your_api_key', 'xxxx', '<api-key>', '[api_key]', 'api-key-here', 'insert-key-here']
            key_lower = key.lower()
            if any(placeholder in key_lower for placeholder in placeholders):
                issues.append(ValidationIssue(
                    field=field_name,
                    message="API key appears to be a placeholder",
                    severity=ValidationSeverity.ERROR,
                    suggestion="Replace with your actual API key"
                ))
        
        is_valid = not any(issue.severity == ValidationSeverity.ERROR for issue in issues)
        return ValidationResult(
            is_valid=is_valid,
            issues=issues,
            sanitized_value=key.strip() if key and is_valid else None
        )
    
    @classmethod
    def validate_all_arguments(cls, args: Dict[str, Any]) -> Tuple[bool, List[ValidationIssue], Dict[str, Any]]:
        """
        Validate all command arguments comprehensively.
        
        Args:
            args: Dictionary of argument names to values
            
        Returns:
            Tuple of (is_valid, issues, sanitized_args)
        """
        all_issues = []
        sanitized_args = {}
        
        # Validate input file
        if 'input_file' in args:
            result = cls.validate_file_path(
                args['input_file'],
                field_name='input_file',
                must_exist=True,
                must_be_file=True,
                allowed_extensions=cls.SUPPORTED_FORMATS,
                check_readable=True
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['input_file'] = result.sanitized_value
        
        # Validate output file
        if 'output_file' in args and args['output_file']:
            result = cls.validate_file_path(
                args['output_file'],
                field_name='output_file',
                must_exist=False,
                must_be_file=True,
                allowed_extensions={'.srt'},
                check_writable=True
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['output_file'] = result.sanitized_value
        
        # Validate alignment language code (for --language flag)
        if 'language' in args:
            result = cls.validate_alignment_language_code(args['language'], field_name='language')
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['language'] = result.sanitized_value
        
        # Validate subtitle translation language (for --subtitle flag)
        if 'subtitle' in args and args['subtitle']:
            result = cls.validate_translation_language_code(args['subtitle'], field_name='subtitle')
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['subtitle'] = result.sanitized_value
        
        # Validate model
        if 'model' in args:
            result = cls.validate_model_name(args['model'], field_name='model')
            all_issues.extend(result.issues)
            if result.sanitized_value is not None:
                sanitized_args['model'] = result.sanitized_value
        
        # Validate priority
        if 'priority' in args:
            result = cls.validate_enum_value(
                args['priority'],
                ['speed', 'quality', 'balanced'],
                field_name='priority'
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['priority'] = result.sanitized_value
        
        # Validate video quality
        if 'video_quality' in args:
            result = cls.validate_enum_value(
                args['video_quality'],
                ['360p', '480p', '720p'],
                field_name='video_quality'
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['video_quality'] = result.sanitized_value
        
        # Validate charset
        if 'charset' in args:
            result = cls.validate_enum_value(
                args['charset'],
                ['traditional', 'simplified'],
                field_name='charset'
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['charset'] = result.sanitized_value
        
        # Validate FFmpeg path
        if 'ffmpeg_path' in args:
            result = cls.validate_ffmpeg_path(args['ffmpeg_path'], field_name='ffmpeg_path')
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['ffmpeg_path'] = result.sanitized_value
        
        # Validate terminology config
        if 'terminology_config' in args and args['terminology_config']:
            result = cls.validate_file_path(
                args['terminology_config'],
                field_name='terminology_config',
                must_exist=True,
                must_be_file=True,
                allowed_extensions={'.json'},
                check_readable=True
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['terminology_config'] = result.sanitized_value
        
        # Validate max chunk duration
        if 'max_chunk_duration' in args:
            result = cls.validate_numeric_range(
                args['max_chunk_duration'],
                min_value=1,
                max_value=60,
                field_name='max_chunk_duration'
            )
            all_issues.extend(result.issues)
            if result.sanitized_value is not None:
                sanitized_args['max_chunk_duration'] = result.sanitized_value
        
        # Validate API keys
        if 'gemini_api_key' in args:
            result = cls.validate_api_key(
                args['gemini_api_key'],
                field_name='gemini_api_key',
                required=False
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['gemini_api_key'] = result.sanitized_value
        
        if 'hf_token' in args:
            result = cls.validate_api_key(
                args['hf_token'],
                field_name='hf_token',
                required=False
            )
            all_issues.extend(result.issues)
            if result.sanitized_value:
                sanitized_args['hf_token'] = result.sanitized_value
        
        # Copy over boolean flags and other args that don't need validation
        for key in ['speakers', 'written', 'music', 'disable_gemini_refinement', 
                    'verbose', 'ipc_mode', 'translation_help']:
            if key in args:
                sanitized_args[key] = args[key]
        
        is_valid = not any(issue.severity == ValidationSeverity.ERROR for issue in all_issues)
        return is_valid, all_issues, sanitized_args