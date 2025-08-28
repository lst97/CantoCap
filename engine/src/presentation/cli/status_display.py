"""
Simple status display for non-IPC mode with optional verbose details.
"""

import sys
import threading
import time
import warnings
from typing import Optional
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.live import Live
from rich.layout import Layout
from rich.panel import Panel
from rich.text import Text
from rich.table import Table
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
import re


@dataclass
class StatusMessage:
    """Represents a status message with conversion information."""
    timestamp: datetime
    technical_content: str
    user_friendly: str
    level: str = "info"  # info, warning, error
    category: str = "process"  # system, model, process
    details: Optional[str] = None


@dataclass
class SimpleProgressState:
    """Tracks the current progress state."""
    current_stage: str = "Initializing"
    percent: float = 0.0
    substage: Optional[str] = None
    status_messages: list = field(default_factory=list)
    technical_details: list = field(default_factory=list)
    start_time: datetime = field(default_factory=datetime.now)
    model_ready_detected: bool = False
    processing_started: bool = False
    
    
class MessageConverter:
    """Converts technical messages to user-friendly descriptions."""
    
    CONVERSION_PATTERNS = {
        # Device and hardware setup
        r"Using Apple Metal Performance Shaders": "Using GPU acceleration (Apple Metal)",
        r"Device set to use (mps|cuda|cpu)": "Setting up processing device",
        r"Using dtype: torch\..*": "Configuring model precision",
        
        # Model operations
        r"Loading model ['\"](.*?)['\"]": "Loading AI model: {0}",
        r".*downloading.*model.*": "Downloading model files",
        r".*pipeline.*loading.*": "Initializing processing pipeline",
        r".*ready.*": "Model ready for processing",
        
        # Audio processing
        r".*extracting audio.*": "Extracting audio from video",
        r".*validating audio.*": "Validating audio format",
        r".*audio.*successful.*": "Audio preparation complete",
        
        # Transcription
        r".*transcrib.*": "Converting speech to text",
        r".*chunk.*(\d+).*": "Processing audio segment {0}",
        r".*validation.*applied.*": "Verifying transcription quality",
        
        # Subtitle processing
        r".*generating.*subtitle.*": "Creating subtitle file",
        r".*formatting.*": "Formatting subtitles",
        r".*saving.*": "Saving output file",
        
        # Warnings (keep visible but simplified)
        r"Using `chunk_length_s` is very experimental": "Using experimental chunking mode",
        r".*deprecated.*": "Using compatibility mode",
        r"FutureWarning.*input.*deprecated.*": "Library compatibility warning",
        r".*FutureWarning.*": "Library warning",
        
        # Errors
        r".*error.*": "Processing error occurred",
        r".*failed.*": "Operation failed",
        r".*exception.*": "Unexpected error",
    }
    
    def convert_message(self, technical_content: str) -> StatusMessage:
        """Convert technical message to user-friendly format."""
        content = technical_content.strip()
        
        # Determine level
        level = "info"
        if any(word in content.lower() for word in ['warning', 'warn', 'experimental', 'deprecated']):
            level = "warning"
        elif any(word in content.lower() for word in ['error', 'failed', 'exception', 'critical']):
            level = "error"
        
        # Convert message
        user_friendly = content
        for pattern, replacement in self.CONVERSION_PATTERNS.items():
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                try:
                    user_friendly = replacement.format(*match.groups())
                except:
                    user_friendly = replacement
                break
        
        # If no pattern matched, keep the original content (no simplification)
        if user_friendly == content:
            user_friendly = content  # Keep original technical message
        
        return StatusMessage(
            timestamp=datetime.now(),
            technical_content=content,
            user_friendly=user_friendly,
            level=level,
            details=content if user_friendly != content else None
        )
    

class StatusDisplay:
    """Simple status display for non-IPC mode."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.console = Console()
        self.converter = MessageConverter()
        self.state = SimpleProgressState()
        self.is_active = False
        self._lock = threading.Lock()
        self._live_display: Optional[Live] = None
        
        # Console output monitoring
        self._original_stdout = sys.stdout
        self._original_stderr = sys.stderr
        self._monitoring = False
        
        # Warning capture
        self._original_showwarning = warnings.showwarning
        
        # Export settings
        self._last_export_path: Optional[str] = None

    def start(self):
        """Start the status display."""
        with self._lock:
            if self.is_active:
                return
                
            self.is_active = True
            self.state.start_time = datetime.now()
            
            # Show immediate loading spinner
            self._show_loading_spinner()
            
            if self.verbose:
                self._start_verbose_display()
            else:
                self._start_simple_display()
            
            # Start smart console monitoring that filters Rich output
            self._start_console_monitoring()
            
            # Capture warnings
            self._setup_warning_capture()
    
    def stop(self):
        """Stop the status display."""
        with self._lock:
            if not self.is_active:
                return
                
            self.is_active = False
            self._stop_console_monitoring()
            self._restore_warning_capture()
            
            if self._live_display:
                self._live_display.stop()
                self._live_display = None
    
    def update_progress(self, stage: str, percent: float, message: str = "", substage: str = None):
        """Update the current progress."""
        with self._lock:
            self.state.current_stage = stage
            self.state.percent = percent
            self.state.substage = substage
            
            if message:
                status_msg = self.converter.convert_message(message)
                self.state.status_messages.append(status_msg)
                
                # Check for model ready transition
                self._check_model_ready_transition(status_msg)
                
                # Keep more messages for expanded display
                if len(self.state.status_messages) > 50:
                    self.state.status_messages = self.state.status_messages[-50:]
            
            # Update live display
            self._update_live_display()
    
    def add_console_output(self, content: str):
        """Add console output for processing."""
        if not content.strip():
            return
            
        with self._lock:
            status_msg = self.converter.convert_message(content)
            self.state.status_messages.append(status_msg)
            
            # Check for model ready transition
            self._check_model_ready_transition(status_msg)
            
            if self.verbose:
                self.state.technical_details.append(content)
                # Keep more technical details for expanded display
                if len(self.state.technical_details) > 100:
                    self.state.technical_details = self.state.technical_details[-100:]
            
            # Keep more status messages for expanded display
            if len(self.state.status_messages) > 50:
                self.state.status_messages = self.state.status_messages[-50:]
            
            # Update live display
            self._update_live_display()
    
    def _update_live_display(self):
        """Update the live display if active."""
        if self._live_display and self.is_active:
            try:
                if self.verbose:
                    self._live_display.update(self._get_verbose_layout())
                else:
                    self._live_display.update(self._get_simple_layout())
            except Exception:
                # If update fails, recreate the display
                self._restart_display()
    
    def _check_model_ready_transition(self, status_msg: StatusMessage):
        """Check if model ready and trigger automatic transition to processing."""
        # Detect "Model ready for processing" message
        if (status_msg.user_friendly == "Model ready for processing" and 
            not self.state.model_ready_detected):
            
            self.state.model_ready_detected = True
            
            # Schedule processing transition after a short delay
            def trigger_processing():
                import time
                time.sleep(1.0)  # Brief pause to show "Model ready" status
                
                with self._lock:
                    if not self.state.processing_started:
                        self.state.processing_started = True
                        
                        # Update stage to "Processing" and increase progress
                        self.state.current_stage = "Processing"
                        # Move progress forward to show we're beyond model preparation
                        if self.state.percent < 40:
                            self.state.percent = 40
                        
                        # Add processing status message
                        processing_msg = StatusMessage(
                            timestamp=datetime.now(),
                            technical_content="Processing audio content",
                            user_friendly="Processing audio content...",
                            level="info",
                            category="process"
                        )
                        self.state.status_messages.append(processing_msg)
                        
                        # Update live display
                        self._update_live_display()
            
            # Start transition in background thread
            threading.Thread(target=trigger_processing, daemon=True).start()
    
    def _start_simple_display(self):
        """Start simple progress display."""
        # Ensure any existing display is stopped
        if self._live_display:
            self._live_display.stop()
            self._live_display = None
            
        self._create_simple_layout()
        self._live_display = Live(
            self._get_simple_layout(), 
            console=self.console, 
            refresh_per_second=4,
            screen=True,  # Use alternate screen buffer
            auto_refresh=True
        )
        self._live_display.start()
    
    def _create_simple_layout(self):
        """Create the simple layout elements."""
        # Create a wider progress bar (thicker appearance through width)
        self._progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(
                bar_width=50,  # Increased from 30 to 50 for wider/thicker appearance
                complete_style="bold green",
                finished_style="bold green",
                pulse_style="bold blue"
            ),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=self.console
        )
        self._task_id = self._progress.add_task(self.state.current_stage, total=100)
        
    def _get_simple_layout(self):
        """Get the current simple layout."""
        # Update progress
        self._progress.update(
            self._task_id, 
            description=self.state.current_stage,
            completed=self.state.percent
        )
        
        # Recent status messages with color coding (no emojis)
        status_text = Text()
        if self.state.status_messages:
            for msg in self.state.status_messages:  # Show ALL messages to use full available space
                # Color per message type without emojis
                if msg.level == "error":
                    color = "bold red"
                elif msg.level == "warning":
                    color = "bold yellow"
                else:
                    color = "bold green"
                
                status_text.append(f"• {msg.user_friendly}\n", style=color)
        else:
            status_text.append("Ready to start...", style="dim")
        
        layout = Layout()
        layout.split_column(
            Layout(Panel(self._progress, title="Progress", border_style="blue"), size=4),  # Reduced back to 4 since bars can't be made thicker
            Layout(Panel(status_text, title="Status", border_style="green"))  # No size limit - uses all remaining space
        )
        return layout
    
    def _start_verbose_display(self):
        """Start verbose display with detailed information."""
        # Ensure any existing display is stopped
        if self._live_display:
            self._live_display.stop()
            self._live_display = None
            
        self._create_verbose_layout()
        self._live_display = Live(
            self._get_verbose_layout(), 
            console=self.console, 
            refresh_per_second=2,
            screen=True,  # Use alternate screen buffer
            auto_refresh=True
        )
        self._live_display.start()
    
    def _create_verbose_layout(self):
        """Create the verbose layout elements."""
        # Create a wider progress bar (thicker appearance through width)
        self._verbose_progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(
                bar_width=60,  # Increased from 40 to 60 for wider/thicker appearance
                complete_style="bold green",
                finished_style="bold green",
                pulse_style="bold blue"
            ),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=self.console
        )
        self._verbose_task_id = self._verbose_progress.add_task(self.state.current_stage, total=100)
        
    def _get_verbose_layout(self):
        """Get the current verbose layout."""
        # Update progress
        description = f"{self.state.current_stage}" + (f" - {self.state.substage}" if self.state.substage else "")
        self._verbose_progress.update(
            self._verbose_task_id, 
            description=description,
            completed=self.state.percent
        )
        
        # Status messages table
        status_table = Table(show_header=True, header_style="bold magenta", show_lines=True)
        status_table.add_column("Time", style="dim", width=8)
        status_table.add_column("Status", style="green")  # No width limit - allow full text
        status_table.add_column("Level", width=8)
        
        for msg in self.state.status_messages:  # Show ALL messages to use full available space
            time_str = msg.timestamp.strftime("%H:%M:%S")
            
            # Color per message type without emojis
            if msg.level == "error":
                level_style = "bold red"
            elif msg.level == "warning":
                level_style = "bold yellow"
            else:
                level_style = "bold green"
            
            status_table.add_row(
                time_str,
                f"[{level_style}]• {msg.user_friendly}[/{level_style}]",
                f"[{level_style}]{msg.level.upper()}[/{level_style}]"
            )
        
        # Technical details (if available)
        tech_text = Text()
        if self.state.technical_details:
            for detail in self.state.technical_details:  # Show ALL technical details to use full available space
                tech_text.append(f"• {detail}\n", style="dim")
        else:
            tech_text.append("No technical details available", style="dim italic")
        
        # Layout with maximum space utilization
        layout = Layout()
        layout.split_column(
            Layout(Panel(self._verbose_progress, title="🔄 Processing Progress", border_style="blue"), size=4),  # Reduced back to 4 for more space for content
            Layout(Panel(status_table, title="📊 Status Messages", border_style="green")),  # Uses available space dynamically  
            Layout(Panel(tech_text, title="🔧 Technical Details", border_style="yellow"))   # Uses available space dynamically
        )
        return layout
    
    def _start_console_monitoring(self):
        """Start monitoring console output."""
        if self._monitoring:
            return
            
        self._monitoring = True
        
        # Smart console monitoring that filters Rich output
        class SmartOutputWrapper:
            def __init__(self, original_stream, display):
                self.original = original_stream
                self.display = display
                # ANSI escape sequence pattern to filter Rich output
                self.ansi_pattern = re.compile(r'\x1b\[[0-9;]*[mGKHfJABCDsuhl]')
                
            def write(self, text):
                # Write to original stream
                result = self.original.write(text)
                self.original.flush()
                
                # Filter and process for status display
                if text and text.strip():
                    # Filter out Rich's ANSI escape sequences and control characters
                    clean_text = self.ansi_pattern.sub('', text).strip()
                    
                    # Only process real application output, ignore Rich display updates
                    if (clean_text and 
                        not clean_text.startswith('│') and  # Rich table borders
                        not clean_text.startswith('┃') and  # Rich table content
                        not clean_text.startswith('╭') and  # Rich box top
                        not clean_text.startswith('╰') and  # Rich box bottom
                        not clean_text.startswith('─') and  # Rich horizontal lines
                        not clean_text.startswith('━') and  # Rich bold horizontal lines
                        not clean_text.startswith('┏') and  # Rich table corners
                        not clean_text.startswith('┗') and  # Rich table corners
                        not clean_text.startswith('┓') and  # Rich table corners
                        not clean_text.startswith('┛') and  # Rich table corners
                        not clean_text.startswith('┠') and  # Rich table connectors
                        not clean_text.startswith('┨') and  # Rich table connectors
                        len(clean_text) > 3):              # Ignore very short strings
                        
                        self.display.add_console_output(clean_text)
                    
                return result
                
            def flush(self):
                self.original.flush()
                
            def __getattr__(self, name):
                return getattr(self.original, name)
        
        # Replace streams with smart wrappers
        sys.stdout = SmartOutputWrapper(self._original_stdout, self)
        sys.stderr = SmartOutputWrapper(self._original_stderr, self)
    
    def _stop_console_monitoring(self):
        """Stop monitoring console output."""
        if not self._monitoring:
            return
            
        self._monitoring = False
        
        # Restore original streams
        sys.stdout = self._original_stdout
        sys.stderr = self._original_stderr
    
    def _restart_display(self):
        """Restart the display in case of issues."""
        if self._live_display:
            self._live_display.stop()
            self._live_display = None
        
        if self.verbose:
            self._start_verbose_display()
        else:
            self._start_simple_display()
    
    def _setup_warning_capture(self):
        """Set up warning capture to show warnings in status display."""
        def custom_showwarning(message, category, filename, lineno, file=None, line=None):
            # Capture warning for our status display
            warning_text = f"{category.__name__}: {str(message)}"
            self.add_console_output(warning_text)
            
            # Don't show original warning since we're capturing it
            # self._original_showwarning(message, category, filename, lineno, file, line)
        
        warnings.showwarning = custom_showwarning
    
    def _restore_warning_capture(self):
        """Restore original warning handling."""
        warnings.showwarning = self._original_showwarning
    
    def _show_loading_spinner(self):
        """Show immediate loading spinner until full display is ready."""
        # Clear screen and show prominent loading message
        self.console.clear()
        
        # Create a prominent loading message with animation
        loading_panel = Panel(
            Text("⚡ CantoCap Loading...\n🔄 Initializing status display system...", 
                 style="bold cyan", justify="center"),
            title="[bold yellow]Please Wait[/bold yellow]",
            border_style="yellow",
            padding=(1, 2)
        )
        
        self.console.print("\n" * 3)  # Add some top spacing
        self.console.print(loading_panel, justify="center")
        self.console.print("\n" * 2)  # Add bottom spacing
        
        # Force immediate display
        self.console.file.flush()

    def export_logs_to_file(self, file_path: str) -> None:
        """Export collected status and technical logs to a text file.

        Args:
            file_path: Destination path for the exported .txt log
        """
        try:
            # Prepare log content
            lines = []
            lines.append("CantoCap Verbose Log")
            lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")

            # Status messages
            lines.append("=== Status Messages ===")
            if self.state.status_messages:
                for msg in self.state.status_messages:
                    ts = msg.timestamp.strftime('%H:%M:%S') if isinstance(msg.timestamp, datetime) else "--:--:--"
                    level = msg.level.upper() if getattr(msg, 'level', None) else 'INFO'
                    lines.append(f"[{ts}] [{level}] {msg.user_friendly}")
                    if msg.details and msg.details != msg.user_friendly:
                        lines.append(f"    Details: {msg.details}")
            else:
                lines.append("(no status messages)")

            # Technical details
            lines.append("")
            lines.append("=== Technical Details ===")
            if self.state.technical_details:
                for detail in self.state.technical_details:
                    lines.append(detail.rstrip())
            else:
                lines.append("(no technical details)")

            content = "\n".join(lines) + "\n"

            # Ensure directory exists
            from pathlib import Path
            dest = Path(file_path)
            dest.parent.mkdir(parents=True, exist_ok=True)

            with open(dest, 'w', encoding='utf-8') as f:
                f.write(content)

            self._last_export_path = str(dest)
        except Exception:
            # Best-effort: don't fail the main flow if export fails
            pass
    
    @contextmanager
    def status_context(self):
        """Context manager for status display."""
        self.start()
        try:
            yield self
        finally:
            self.stop()


# Global instance for easy access
_global_display: Optional[StatusDisplay] = None


def get_status_display(verbose: bool = False) -> StatusDisplay:
    """Get or create global status display."""
    global _global_display
    if _global_display is None:
        _global_display = StatusDisplay(verbose)
    return _global_display


def start_status_display(verbose: bool = False):
    """Start global status display."""
    # Show immediate loading spinner
    console = Console()
    console.clear()
    
    # Create a prominent loading message with animation
    loading_panel = Panel(
        Text("⚡ CantoCap Starting...\n🔄 Initializing processing engine...", 
             style="bold cyan", justify="center"),
        title="[bold yellow]Please Wait[/bold yellow]",
        border_style="yellow",
        padding=(1, 2)
    )
    
    console.print("\n" * 3)  # Add some top spacing
    console.print(loading_panel, justify="center")
    console.print("\n" * 2)  # Add bottom spacing
    console.file.flush()  # Force immediate display
    
    # Small delay to ensure spinner is visible
    time.sleep(0.5)
    
    # Now start the actual display
    display = get_status_display(verbose)
    display.start()


def stop_status_display():
    """Stop global status display."""
    global _global_display
    if _global_display:
        _global_display.stop()


@contextmanager
def status_context(verbose: bool = False):
    """Context manager for status display."""
    display = StatusDisplay(verbose)
    display.start()
    try:
        yield display
    finally:
        display.stop()
