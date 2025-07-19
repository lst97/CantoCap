"""Media file validation service."""

from dataclasses import dataclass
from typing import Optional, List
import os

from ...domain import MediaFile


@dataclass
class ValidationResult:
    """Result of media file validation."""
    
    is_valid: bool
    error_message: Optional[str] = None
    warnings: List[str] = None
    file_info: Optional[dict] = None
    
    def __post_init__(self) -> None:
        """Initialize warnings list if None."""
        if self.warnings is None:
            self.warnings = []
    
    @classmethod
    def valid(
        cls, 
        file_info: Optional[dict] = None, 
        warnings: Optional[List[str]] = None
    ) -> "ValidationResult":
        """Create valid result."""
        return cls(
            is_valid=True,
            file_info=file_info,
            warnings=warnings or []
        )
    
    @classmethod
    def invalid(
        cls, 
        error_message: str, 
        warnings: Optional[List[str]] = None
    ) -> "ValidationResult":
        """Create invalid result."""
        return cls(
            is_valid=False,
            error_message=error_message,
            warnings=warnings or []
        )


class MediaFileValidator:
    """Service for validating media files before processing."""
    
    def __init__(
        self,
        max_file_size_gb: float = 10.0,
        min_file_size_mb: float = 0.1,
        check_permissions: bool = True
    ):
        """
        Initialize validator with constraints.
        
        Args:
            max_file_size_gb: Maximum file size in GB
            min_file_size_mb: Minimum file size in MB  
            check_permissions: Whether to check file permissions
        """
        self.max_file_size_gb = max_file_size_gb
        self.min_file_size_mb = min_file_size_mb
        self.check_permissions = check_permissions
    
    def validate(self, media_file: MediaFile) -> ValidationResult:
        """
        Perform comprehensive validation of media file.
        
        Args:
            media_file: The media file to validate
            
        Returns:
            ValidationResult: Validation result with details
        """
        warnings = []
        
        try:
            # Basic validation (existence, type, format)
            self._validate_basic_requirements(media_file)
            
            # Size validation
            size_warnings = self._validate_file_size(media_file)
            warnings.extend(size_warnings)
            
            # Permission validation
            if self.check_permissions:
                permission_warnings = self._validate_permissions(media_file)
                warnings.extend(permission_warnings)
            
            # Format-specific validation
            format_warnings = self._validate_format_specific(media_file)
            warnings.extend(format_warnings)
            
            # Generate file info
            file_info = self._generate_file_info(media_file)
            
            return ValidationResult.valid(
                file_info=file_info,
                warnings=warnings
            )
            
        except Exception as e:
            return ValidationResult.invalid(
                error_message=str(e),
                warnings=warnings
            )
    
    def _validate_basic_requirements(self, media_file: MediaFile) -> None:
        """Validate basic file requirements."""
        # This will raise exceptions if validation fails
        media_file.validate()
    
    def _validate_file_size(self, media_file: MediaFile) -> List[str]:
        """Validate file size constraints."""
        warnings = []
        
        size_mb = media_file.get_size_mb()
        size_gb = size_mb / 1024
        
        # Check minimum size
        if size_mb < self.min_file_size_mb:
            raise ValueError(
                f"File too small: {size_mb:.2f}MB. "
                f"Minimum size: {self.min_file_size_mb}MB"
            )
        
        # Check maximum size
        if size_gb > self.max_file_size_gb:
            raise ValueError(
                f"File too large: {size_gb:.2f}GB. "
                f"Maximum size: {self.max_file_size_gb}GB"
            )
        
        # Add warnings for potentially problematic sizes
        if size_mb < 1.0:
            warnings.append(f"Very small file: {size_mb:.2f}MB - may be too short for meaningful transcription")
        
        if size_gb > 5.0:
            warnings.append(f"Large file: {size_gb:.2f}GB - processing may take significant time")
        
        return warnings
    
    def _validate_permissions(self, media_file: MediaFile) -> List[str]:
        """Validate file access permissions."""
        warnings = []
        file_path = media_file.get_file_path()
        
        # Check read permission
        if not os.access(file_path.path, os.R_OK):
            raise PermissionError(f"No read permission for file: {file_path.path}")
        
        # Check if output directory is writable
        output_dir = file_path.get_parent()
        if not os.access(output_dir.path, os.W_OK):
            raise PermissionError(f"No write permission for output directory: {output_dir.path}")
        
        return warnings
    
    def _validate_format_specific(self, media_file: MediaFile) -> List[str]:
        """Validate format-specific requirements."""
        warnings = []
        
        extension = media_file.get_extension()
        
        # Video format specific checks
        if media_file.is_video():
            # Common video formats that work well
            recommended_video = {'.mp4', '.avi', '.mkv', '.mov'}
            if extension not in recommended_video:
                warnings.append(
                    f"Video format {extension} may have compatibility issues. "
                    f"Recommended: {', '.join(sorted(recommended_video))}"
                )
        
        # Audio format specific checks  
        elif media_file.is_audio():
            # Compressed audio formats may lose quality
            compressed_formats = {'.mp3', '.aac', '.ogg'}
            if extension in compressed_formats:
                warnings.append(
                    f"Compressed audio format {extension} may reduce transcription accuracy. "
                    f"Consider using .wav or .flac for best results"
                )
        
        return warnings
    
    def _generate_file_info(self, media_file: MediaFile) -> dict:
        """Generate comprehensive file information."""
        return {
            "name": media_file.get_name(),
            "extension": media_file.get_extension(),
            "size_mb": round(media_file.get_size_mb(), 2),
            "size_bytes": media_file.get_size_bytes(),
            "mime_type": media_file.get_mime_type(),
            "is_video": media_file.is_video(),
            "is_audio": media_file.is_audio(),
            "path": media_file.get_file_path().path,
            "expected_output": media_file.get_output_srt_path().path
        }
    
    def validate_path_string(self, file_path: str) -> ValidationResult:
        """
        Quick validation of file path string.
        
        Args:
            file_path: File path to validate
            
        Returns:
            ValidationResult: Validation result
        """
        try:
            media_file = MediaFile.from_path(file_path)
            return self.validate(media_file)
        except Exception as e:
            return ValidationResult.invalid(str(e))
    
    def get_validation_summary(self, result: ValidationResult) -> str:
        """
        Get human-readable validation summary.
        
        Args:
            result: Validation result to summarize
            
        Returns:
            str: Human-readable summary
        """
        if not result.is_valid:
            return f"❌ Validation failed: {result.error_message}"
        
        summary_parts = ["✅ File is valid"]
        
        if result.file_info:
            info = result.file_info
            file_type = "video" if info["is_video"] else "audio"
            summary_parts.append(
                f"({info['name']}, {file_type}, {info['size_mb']}MB)"
            )
        
        if result.warnings:
            summary_parts.append(f"⚠️  {len(result.warnings)} warning(s)")
            for warning in result.warnings:
                summary_parts.append(f"  • {warning}")
        
        return "\n".join(summary_parts)