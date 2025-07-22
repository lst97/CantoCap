"""Enhanced progress display system for CantoCap CLI."""

from typing import Optional, Callable, Any, Dict
from rich.console import Console
from rich.progress import (
    Progress, SpinnerColumn, TextColumn, BarColumn, 
    TimeElapsedColumn, MofNCompleteColumn
)
from rich.spinner import Spinner
from rich.panel import Panel
from rich.text import Text
from rich.live import Live
from rich.layout import Layout
import time
from enum import Enum
from dataclasses import dataclass


class ProcessingStage(Enum):
    """Enum for processing stages."""
    INITIALIZING = "initializing"
    VALIDATING = "validating" 
    LOADING_MEDIA_FILE = "loading_media_file"
    GEMINI_VIDEO_COMPRESSION = "gemini_video_compression"
    GEMINI_SPEAKER_IDENTIFICATION = "gemini_speaker_identification"
    EXTRACTING_AUDIO = "extracting_audio"
    VALIDATING_AUDIO = "validating_audio"
    PREPARING_MODEL = "preparing_model"
    DOWNLOADING_MODEL = "downloading_model"
    LOADING_MODEL = "loading_model"
    TRANSCRIBING = "transcribing"
    VALIDATING_TRANSCRIPTION = "validating_transcription"
    SPEAKER_DIARIZATION = "speaker_diarization"
    MUSIC_DETECTION = "music_detection"
    GENERATING_SUBTITLE_DOCUMENT = "generating_subtitle_document"
    SUBTITLE_VALIDATION = "subtitle_validation"
    GEMINI_TRANSCRIPTION_REFINEMENT = "gemini_transcription_refinement"
    SUBTITLE_TRANSLATION = "subtitle_translation"
    CHARSET_CONVERSION = "charset_conversion"
    FORMATTING_SUBTITLES = "formatting_subtitles"
    SAVING_FILE = "saving_file"
    GENERATING_STATISTICS = "generating_statistics"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class StageInfo:
    """Information about a processing stage."""
    name: str
    description: str
    progress_start: int
    progress_end: int
    emoji: str


class ProgressDisplayManager:
    """Enhanced progress display manager with stage-based progress tracking."""
    
    # Define processing stages with realistic progress ranges
    STAGES = {
        ProcessingStage.INITIALIZING: StageInfo(
            "Initializing", "Setting up processing environment", 0, 3, "⚙️"
        ),
        ProcessingStage.VALIDATING: StageInfo(
            "Validating", "Checking input file and parameters", 3, 6, "📋"
        ),
        ProcessingStage.LOADING_MEDIA_FILE: StageInfo(
            "Loading Media", "Loading and validating media file", 6, 9, "📁"
        ),
        ProcessingStage.GEMINI_VIDEO_COMPRESSION: StageInfo(
            "Video Compression", "Compressing video for Gemini Flash analysis", 9, 12, "🎬"
        ),
        ProcessingStage.GEMINI_SPEAKER_IDENTIFICATION: StageInfo(
            "Speaker ID", "Identifying speakers using Gemini Flash", 12, 18, "🤖"
        ),
        ProcessingStage.EXTRACTING_AUDIO: StageInfo(
            "Audio Extraction", "Extracting audio from media file", 18, 23, "🎵"
        ),
        ProcessingStage.VALIDATING_AUDIO: StageInfo(
            "Audio Validation", "Validating extracted audio format", 23, 25, "🔍"
        ),
        ProcessingStage.PREPARING_MODEL: StageInfo(
            "Model Prep", "Preparing Whisper model", 25, 28, "🧠"
        ),
        ProcessingStage.DOWNLOADING_MODEL: StageInfo(
            "Model Download", "Downloading Whisper model (first time only)", 28, 35, "⬇️"
        ),
        ProcessingStage.LOADING_MODEL: StageInfo(
            "Model Loading", "Loading model into memory", 35, 40, "🚀"
        ),
        ProcessingStage.TRANSCRIBING: StageInfo(
            "Transcribing", "Converting speech to text with Whisper", 40, 60, "🗣️"
        ),
        ProcessingStage.VALIDATING_TRANSCRIPTION: StageInfo(
            "Transcription Check", "Validating transcription results", 60, 62, "🔍"
        ),
        ProcessingStage.SPEAKER_DIARIZATION: StageInfo(
            "Speaker Analysis", "Analyzing speaker segments", 62, 67, "👥"
        ),
        ProcessingStage.MUSIC_DETECTION: StageInfo(
            "Music Detection", "Detecting music segments", 67, 70, "🎼"
        ),
        ProcessingStage.GENERATING_SUBTITLE_DOCUMENT: StageInfo(
            "Generating Subtitles", "Creating initial subtitle document", 70, 75, "📄"
        ),
        ProcessingStage.SUBTITLE_VALIDATION: StageInfo(
            "Subtitle Validation", "Applying validation tags", 75, 77, "✅"
        ),
        ProcessingStage.GEMINI_TRANSCRIPTION_REFINEMENT: StageInfo(
            "AI Refinement", "Refining transcription with Gemini Flash", 77, 82, "✨"
        ),
        ProcessingStage.SUBTITLE_TRANSLATION: StageInfo(
            "Translation", "Translating subtitles to target language", 82, 87, "🌐"
        ),
        ProcessingStage.CHARSET_CONVERSION: StageInfo(
            "Charset Conversion", "Converting character encoding", 87, 89, "🔄"
        ),
        ProcessingStage.FORMATTING_SUBTITLES: StageInfo(
            "Formatting", "Formatting and optimizing subtitles", 89, 92, "📝"
        ),
        ProcessingStage.SAVING_FILE: StageInfo(
            "Saving", "Saving subtitle file", 92, 96, "💾"
        ),
        ProcessingStage.GENERATING_STATISTICS: StageInfo(
            "Statistics", "Generating processing statistics", 96, 99, "📊"
        ),
        ProcessingStage.COMPLETED: StageInfo(
            "Complete", "Processing completed successfully", 100, 100, "✅"
        ),
        ProcessingStage.ERROR: StageInfo(
            "Error", "An error occurred during processing", 0, 0, "❌"
        )
    }
    
    def __init__(self, console: Optional[Console] = None):
        """Initialize progress display manager."""
        self.console = console or Console()
        self.current_stage = ProcessingStage.INITIALIZING
        self.current_stage_progress = 0.0  # 0.0 to 1.0 within current stage
        self.status_messages = []
        self.show_technical_details = False
        self.live_display: Optional[Live] = None
        
    def create_layout(self) -> Layout:
        """Create the layout for the progress display."""
        layout = Layout()
        
        # Calculate dynamic status section size based on message count
        message_count = len(self.status_messages)
        status_size = max(6, min(12, message_count + 3))  # 6-12 lines, +3 for padding
        
        layout.split_column(
            Layout(name="progress_section", size=4),
            Layout(name="status_section", size=status_size)
        )
        
        return layout
        
    def get_overall_progress(self) -> int:
        """Calculate overall progress percentage."""
        stage_info = self.STAGES[self.current_stage]
        stage_range = stage_info.progress_end - stage_info.progress_start
        
        # Calculate progress within the current stage
        stage_progress = stage_info.progress_start + (stage_range * self.current_stage_progress)
        
        return int(stage_progress)
    
    def update_stage(
        self, 
        stage: ProcessingStage, 
        stage_progress: float = 0.0,
        status_message: Optional[str] = None
    ) -> None:
        """
        Update the current processing stage.
        
        Args:
            stage: The new processing stage
            stage_progress: Progress within the stage (0.0 to 1.0)
            status_message: Optional status message to display
        """
        self.current_stage = stage
        self.current_stage_progress = max(0.0, min(1.0, stage_progress))
        
        if status_message:
            self.add_status_message(status_message)
    
    def update_stage_progress(self, progress: float) -> None:
        """Update progress within the current stage."""
        self.current_stage_progress = max(0.0, min(1.0, progress))
    
    def add_status_message(self, message: str, style: str = "white") -> None:
        """Add a status message to the display."""
        timestamp = time.strftime("%H:%M:%S")
        formatted_message = f"[dim]{timestamp}[/dim] {message}"
        
        self.status_messages.append((formatted_message, style))
        
        # Keep only last 6 messages to prevent overflow and reduce whitespace
        if len(self.status_messages) > 6:
            self.status_messages = self.status_messages[-6:]
    
    def add_technical_message(self, message: str) -> None:
        """Add a technical message (only shown if technical details enabled)."""
        if self.show_technical_details:
            self.add_status_message(f"[dim]Technical: {message}[/dim]", "dim")
    
    def add_debug_message(self, message: str) -> None:
        """Add a debug message (only shown in verbose mode)."""
        if self.show_technical_details:
            self.add_status_message(f"[dim cyan]Debug: {message}[/dim cyan]", "dim")
    
    def add_performance_message(self, message: str) -> None:
        """Add a performance-related message (only shown in verbose mode)."""
        if self.show_technical_details:
            self.add_status_message(f"[dim yellow]Perf: {message}[/dim yellow]", "dim")
    
    def create_progress_panel(self) -> Panel:
        """Create the main progress panel with spinner."""
        stage_info = self.STAGES[self.current_stage]
        overall_progress = self.get_overall_progress()
        
        # Create progress bar text with spinner for active stages
        progress_text = Text()
        
        # Add spinner for active stages (not completed or error)
        if self.current_stage not in [ProcessingStage.COMPLETED, ProcessingStage.ERROR] and overall_progress < 100:
            # Use rich's built-in spinner characters
            spinner_frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
            spinner_char = spinner_frames[int(time.time() * 4) % len(spinner_frames)]
            progress_text.append(f"{spinner_char} ", style="bold cyan")
        
        progress_text.append(f"{stage_info.emoji} ", style="bold")
        progress_text.append(stage_info.description, style="bold blue")
        
        # Add stage progress indicator within current stage
        if self.current_stage_progress > 0 and self.current_stage_progress < 1:
            stage_percent = int(self.current_stage_progress * 100)
            progress_text.append(f" ({stage_percent}%)", style="dim")
        
        # Create the progress bar
        bar_width = 40
        filled_width = int((overall_progress / 100) * bar_width)
        empty_width = bar_width - filled_width
        
        progress_bar = Text()
        progress_bar.append("█" * filled_width, style="bold green")
        progress_bar.append("░" * empty_width, style="dim")
        
        # Create percentage display
        percentage_text = Text(f" {overall_progress}%", style="bold white")
        
        # Combine all elements
        content = Text()
        content.append_text(progress_text)
        content.append("\n")
        content.append_text(progress_bar)
        content.append_text(percentage_text)
        
        return Panel(
            content,
            title="🎬 Processing Progress",
            title_align="left",
            border_style="blue"
        )
    
    def create_status_panel(self) -> Panel:
        """Create the status messages panel."""
        if not self.status_messages:
            content = Text("Ready to start processing...", style="dim")
        else:
            content = Text()
            for i, (message, style) in enumerate(self.status_messages):
                if i > 0:
                    content.append("\n")
                content.append(message, style=style)
        
        # Dynamic height based on content
        message_count = len(self.status_messages) if self.status_messages else 1
        panel_height = max(4, min(10, message_count + 2))  # 4-10 lines with padding
        
        return Panel(
            content,
            title="📋 Status",
            title_align="left",
            border_style="green",
            height=panel_height
        )
    
    def render(self) -> Layout:
        """Render the complete progress display."""
        layout = self.create_layout()
        
        layout["progress_section"].update(self.create_progress_panel())
        layout["status_section"].update(self.create_status_panel())
        
        return layout
    
    def __enter__(self):
        """Enter context manager."""
        if self.live_display is not None:
            # Avoid creating duplicate Live displays
            self.live_display.stop()
        
        self.live_display = Live(
            self.render(), 
            console=self.console, 
            refresh_per_second=4,
            transient=False
        )
        self.live_display.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager."""
        if self.live_display:
            self.live_display.stop()
            self.live_display = None
    
    def update_display(self) -> None:
        """Update the live display."""
        if self.live_display:
            self.live_display.update(self.render())


class WhisperProgressTracker:
    """Progress tracker specifically for Whisper operations."""
    
    def __init__(self, display_manager: ProgressDisplayManager):
        """Initialize with display manager."""
        self.display_manager = display_manager
        self.model_download_started = False
        self.model_loading_started = False
        self.transcription_started = False
    
    def on_model_download_start(self) -> None:
        """Called when model download starts."""
        if not self.model_download_started:
            self.display_manager.update_stage(
                ProcessingStage.DOWNLOADING_MODEL,
                0.0,
                "Starting model download..."
            )
            self.model_download_started = True
    
    def on_model_download_progress(self, progress: float) -> None:
        """Called during model download progress."""
        self.display_manager.update_stage_progress(progress)
        self.display_manager.add_status_message(
            f"Downloading model... {progress * 100:.1f}%"
        )
    
    def on_model_load_start(self) -> None:
        """Called when model loading starts."""
        if not self.model_loading_started:
            self.display_manager.update_stage(
                ProcessingStage.LOADING_MODEL,
                0.0,
                "Loading model into memory..."
            )
            self.model_loading_started = True
    
    def on_model_load_complete(self, device: str) -> None:
        """Called when model loading completes."""
        self.display_manager.update_stage(
            ProcessingStage.LOADING_MODEL,
            1.0,
            f"Model loaded successfully on {device}"
        )
    
    def on_transcription_start(self, duration: float) -> None:
        """Called when transcription starts."""
        if not self.transcription_started:
            self.display_manager.update_stage(
                ProcessingStage.TRANSCRIBING,
                0.0,
                f"Starting transcription of {duration:.1f}s audio..."
            )
            self.transcription_started = True
    
    def on_transcription_progress(self, progress: float) -> None:
        """Called during transcription progress."""
        self.display_manager.update_stage_progress(progress)
        self.display_manager.add_status_message(
            f"Transcribing audio... {progress * 100:.1f}%"
        )
    
    def on_transcription_chunk_complete(self, chunk_index: int, total_chunks: int) -> None:
        """Called when a transcription chunk completes."""
        progress = chunk_index / total_chunks if total_chunks > 0 else 0.0
        self.display_manager.update_stage_progress(progress)
        self.display_manager.add_status_message(
            f"Processed chunk {chunk_index}/{total_chunks}"
        )


def create_enhanced_progress_context(console: Optional[Console] = None) -> ProgressDisplayManager:
    """
    Create an enhanced progress display context manager.
    
    Args:
        console: Optional Rich console instance
        
    Returns:
        ProgressDisplayManager: Context manager for progress display
    """
    return ProgressDisplayManager(console)