"""Service for handling accuracy warnings and graceful degradation."""

import sys
from enum import Enum
from typing import Optional, List
from rich.console import Console
from rich.panel import Panel
from rich.text import Text


class WarningLevel(Enum):
    """Warning severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AccuracyWarningService:
    """Service for handling accuracy warnings and graceful degradation."""
    
    def __init__(self, console: Optional[Console] = None):
        """Initialize warning service."""
        self.console = console or Console()
        self.warnings_issued = []
    
    def warn_missing_gemini_key(self, impact_features: List[str]):
        """Warn about missing Gemini API key and impact on accuracy."""
        warning_text = Text()
        warning_text.append("⚠️ Gemini API Key Not Found\n\n", style="bold yellow")
        warning_text.append("The following features will be disabled:\n", style="yellow")
        
        for feature in impact_features:
            warning_text.append(f"  • {feature}\n", style="yellow")
        
        warning_text.append("\nThis may result in reduced subtitle accuracy.\n", style="yellow")
        warning_text.append("To enable full functionality:\n", style="white")
        warning_text.append("  1. Set GEMINI_API_KEY in .env file\n", style="cyan")
        warning_text.append("  2. Set GEMINI_API_KEY environment variable\n", style="cyan")
        warning_text.append("  3. Use --gemini-key argument\n", style="cyan")
        
        self.console.print(Panel(
            warning_text,
            title="🤖 Gemini Integration Warning",
            border_style="yellow",
            title_align="left"
        ))
        
        self.warnings_issued.append("missing_gemini_key")
    
    def warn_chunking_required(self, file_size_mb: float, chunk_count: int):
        """Warn about file chunking requirements."""
        warning_text = Text()
        warning_text.append("📊 Large File Detected\n\n", style="bold blue")
        warning_text.append(f"File size: {file_size_mb:.1f} MB\n", style="blue")
        warning_text.append(f"Will be processed in {chunk_count} chunks\n\n", style="blue")
        warning_text.append("This may take longer but ensures complete processing.", style="white")
        
        self.console.print(Panel(
            warning_text,
            title="📁 File Chunking Notice",
            border_style="blue",
            title_align="left"
        ))
        
        self.warnings_issued.append("chunking_required")
    
    def warn_rate_limit_risk(self, estimated_tokens: int, rate_limit: int):
        """Warn about potential rate limiting."""
        if estimated_tokens > rate_limit * 0.8:  # 80% of rate limit
            warning_text = Text()
            warning_text.append("🚦 Rate Limit Warning\n\n", style="bold orange3")
            warning_text.append(f"Estimated tokens: {estimated_tokens:,}\n", style="orange3")
            warning_text.append(f"Rate limit: {rate_limit:,}/minute\n\n", style="orange3")
            warning_text.append("Processing may be throttled. Consider:", style="white")
            warning_text.append("\n  • Smaller video chunks\n", style="cyan")
            warning_text.append("  • Lower resolution compression\n", style="cyan")
            warning_text.append("  • Paid tier for higher limits\n", style="cyan")
            
            self.console.print(Panel(
                warning_text,
                title="⚡ API Rate Limit Warning",
                border_style="orange3",
                title_align="left"
            ))
            
            self.warnings_issued.append("rate_limit_risk")
    
    def warn_missing_dependencies(self, missing_deps: List[str], feature_impact: str):
        """Warn about missing optional dependencies."""
        warning_text = Text()
        warning_text.append("📦 Missing Dependencies\n\n", style="bold yellow")
        warning_text.append("The following packages are not installed:\n", style="yellow")
        
        for dep in missing_deps:
            warning_text.append(f"  • {dep}\n", style="red")
        
        warning_text.append(f"\nImpact: {feature_impact}\n\n", style="yellow")
        warning_text.append("To install missing dependencies:\n", style="white")
        
        if "google-generativeai" in missing_deps:
            warning_text.append("  pip install google-generativeai\n", style="cyan")
        if "python-dotenv" in missing_deps:
            warning_text.append("  pip install python-dotenv\n", style="cyan")
        
        self.console.print(Panel(
            warning_text,
            title="🔧 Dependency Warning",
            border_style="yellow",
            title_align="left"
        ))
        
        self.warnings_issued.append("missing_dependencies")
    
    def warn_file_too_large(self, file_size_mb: float, max_size_mb: float):
        """Warn about files that exceed processing limits."""
        warning_text = Text()
        warning_text.append("📏 File Size Warning\n\n", style="bold orange3")
        warning_text.append(f"File size: {file_size_mb:.1f} MB\n", style="orange3")
        warning_text.append(f"Recommended max: {max_size_mb:.1f} MB\n\n", style="orange3")
        warning_text.append("This file may exceed API limits or cause timeouts.\n", style="white")
        warning_text.append("Consider:\n", style="white")
        warning_text.append("  • Using --max-chunk-duration to create smaller chunks\n", style="cyan")
        warning_text.append("  • Compressing video before processing\n", style="cyan")
        warning_text.append("  • Processing segments separately\n", style="cyan")
        
        self.console.print(Panel(
            warning_text,
            title="⚠️ File Size Warning",
            border_style="orange3",
            title_align="left"
        ))
        
        self.warnings_issued.append("file_too_large")
    
    def warn_compression_failed(self, original_size_mb: float, error_message: str):
        """Warn about video compression failures."""
        warning_text = Text()
        warning_text.append("🎥 Video Compression Failed\n\n", style="bold red")
        warning_text.append(f"Original file size: {original_size_mb:.1f} MB\n", style="red")
        warning_text.append(f"Error: {error_message}\n\n", style="red")
        warning_text.append("Proceeding with original file - this may:\n", style="white")
        warning_text.append("  • Increase processing time\n", style="yellow")
        warning_text.append("  • Exceed API limits\n", style="yellow")
        warning_text.append("  • Result in higher costs\n", style="yellow")
        
        self.console.print(Panel(
            warning_text,
            title="💥 Compression Error",
            border_style="red",
            title_align="left"
        ))
        
        self.warnings_issued.append("compression_failed")
    
    def info_fallback_mode(self, disabled_features: List[str]):
        """Inform about fallback to basic mode."""
        info_text = Text()
        info_text.append("🔄 Fallback Mode Activated\n\n", style="bold blue")
        info_text.append("The following features are disabled:\n", style="blue")
        
        for feature in disabled_features:
            info_text.append(f"  • {feature}\n", style="blue")
        
        info_text.append("\nProcessing will continue with basic Whisper transcription.\n", style="white")
        info_text.append("Quality may be reduced but core functionality remains available.", style="white")
        
        self.console.print(Panel(
            info_text,
            title="ℹ️ Processing Mode",
            border_style="blue",
            title_align="left"
        ))
        
        self.warnings_issued.append("fallback_mode")
    
    def has_warned(self, warning_type: str) -> bool:
        """Check if a specific warning has been issued."""
        return warning_type in self.warnings_issued
    
    def get_warning_count(self) -> int:
        """Get total number of warnings issued."""
        return len(self.warnings_issued)
    
    def clear_warnings(self):
        """Clear all issued warnings."""
        self.warnings_issued.clear()