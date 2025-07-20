"""Command for generating subtitles from media files."""

from dataclasses import dataclass
from typing import Optional

from ...domain.value_objects import FilePath, Charset


@dataclass(frozen=True)
class GenerateSubtitlesCommand:
    """Command to generate subtitles from a media file."""
    
    input_file_path: str
    output_file_path: Optional[str] = None
    language: str = "zh"  # Chinese
    model_name: Optional[str] = "openai/whisper-large-v3"  # None enables auto-selection
    
    # Phase 2 features
    enable_speakers: bool = False
    # REMOVED: num_speakers - now auto-detected by Gemini Flash
    enable_written_style: bool = False
    enable_music_detection: bool = False
    charset: str = "traditional"
    
    # New Gemini Flash features
    enable_gemini_refinement: bool = True  # Default enabled
    gemini_api_key: Optional[str] = None
    video_compression_quality: str = "360p"  # For LLM processing
    max_chunk_duration_minutes: int = 15  # Maximum chunk duration
    
    def __post_init__(self) -> None:
        """Validate command parameters."""
        if not self.input_file_path.strip():
            raise ValueError("Input file path cannot be empty")
        
        if self.output_file_path is not None and not self.output_file_path.strip():
            raise ValueError("Output file path cannot be empty string")
        
        if not self.language.strip():
            raise ValueError("Language cannot be empty")
        
        if self.model_name is not None and not self.model_name.strip():
            raise ValueError("Model name cannot be empty string")
        
        if not self.charset.strip():
            raise ValueError("Charset cannot be empty")
        
        if not self.video_compression_quality.strip():
            raise ValueError("Video compression quality cannot be empty")
        
        if self.max_chunk_duration_minutes <= 0:
            raise ValueError("Max chunk duration must be positive")
    
    def get_input_file_path(self) -> FilePath:
        """Get input file path as FilePath object."""
        return FilePath.from_string(self.input_file_path)
    
    def get_output_file_path(self) -> Optional[FilePath]:
        """Get output file path as FilePath object."""
        if self.output_file_path is None:
            return None
        return FilePath.from_string(self.output_file_path)
    
    def get_default_output_path(self) -> FilePath:
        """Get default output path based on input file."""
        input_path = self.get_input_file_path()
        return input_path.get_output_srt_path()
    
    def get_effective_output_path(self) -> FilePath:
        """Get the effective output path (custom or default)."""
        custom_output = self.get_output_file_path()
        return custom_output if custom_output is not None else self.get_default_output_path()
    
    def get_charset(self) -> Charset:
        """Get charset as Charset object."""
        return Charset.from_string(self.charset)
    
    def get_language_style(self) -> str:
        """Get language style preference for Gemini Flash."""
        return "written" if self.enable_written_style else "colloquial"
    
    def requires_gemini_flash(self) -> bool:
        """Check if Gemini Flash features are enabled."""
        return self.enable_speakers or self.enable_gemini_refinement
    
    def has_phase2_features(self) -> bool:
        """Check if any Phase 2 features are enabled."""
        return (self.enable_speakers or 
                self.enable_written_style or 
                self.enable_music_detection or
                self.enable_gemini_refinement)
    
    def validate_paths(self) -> None:
        """Validate that paths are accessible."""
        # Validate input file
        input_path = self.get_input_file_path()
        input_path.validate_exists()
        input_path.validate_is_file()
        input_path.validate_supported_format()
        
        # Validate output directory is writable
        output_path = self.get_effective_output_path()
        output_dir = output_path.get_parent()
        if not output_dir.exists():
            raise FileNotFoundError(f"Output directory does not exist: {output_dir.path}")
        if not output_dir.is_dir():
            raise ValueError(f"Output path is not a directory: {output_dir.path}")
    
    def __str__(self) -> str:
        """String representation."""
        output_str = self.output_file_path or "auto"
        return f"GenerateSubtitlesCommand(input='{self.input_file_path}', output='{output_str}', lang='{self.language}')"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return (
            f"GenerateSubtitlesCommand("
            f"input_file_path='{self.input_file_path}', "
            f"output_file_path={self.output_file_path!r}, "
            f"language='{self.language}', "
            f"model_name='{self.model_name}', "
            f"gemini_enabled={self.requires_gemini_flash()})"
        )