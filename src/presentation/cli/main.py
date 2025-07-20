"""Main CLI application for CantoSub."""

import typer
from typing import Optional
from pathlib import Path
from rich.console import Console

from .commands import generate_command
from .hardware_command import hardware_command
from ...infrastructure.error_handling import validate_file_path, ValidationError, handle_error

console = Console()

# Create the main Typer application
app = typer.Typer(
    name="cantosub",
    help="CantoSub - Generate Cantonese subtitles from audio/video files",
    add_completion=False,
    rich_markup_mode="rich"
)

# Add the hardware capabilities command
app.command(name="hardware")(hardware_command)

# Add the generate command as an explicit subcommand
app.command(name="generate")(generate_command)

# Main callback that handles both direct file processing and subcommands
@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    input_file: Optional[Path] = typer.Argument(
        None,
        help="Path to input audio/video file",
    ),
    output_file: Optional[Path] = typer.Option(
        None,
        "--output",
        "-o", 
        help="Output SRT file path (default: same directory as input with .srt extension)"
    ),
    language: str = typer.Option(
        "zh",
        "--language",
        "-l",
        help="Language code for transcription (default: zh for Chinese)"
    ),
    model: Optional[str] = typer.Option(
        None,
        "--model",
        "-m",
        help="Whisper model to use (auto-selects optimal model if not specified)"
    ),
    priority: str = typer.Option(
        "balanced",
        "--priority",
        "-p",
        help="Model selection priority: 'speed', 'quality', or 'balanced'"
    ),
    # Enhanced Phase 2 features
    speakers: bool = typer.Option(
        False,
        "--speakers",
        help="Enable automatic speaker identification and diarization using Gemini Flash"
    ),
    written: bool = typer.Option(
        False,
        "--written",
        help="Convert colloquial speech to formal written style using LLM"
    ),
    music: bool = typer.Option(
        False,
        "--music", 
        help="Enable music detection and add [music] labels"
    ),
    charset: str = typer.Option(
        "traditional",
        "--charset",
        help="Character set for output (traditional or simplified)"
    ),
    
    # New Gemini Flash options
    gemini_api_key: Optional[str] = typer.Option(
        None,
        "--gemini-key",
        help="Google Gemini API key (overrides .env file and environment variables)"
    ),
    
    disable_gemini_refinement: bool = typer.Option(
        False,
        "--no-gemini-refinement",
        help="Disable Gemini Flash transcription refinement"
    ),
    
    # Enhanced chunking options
    max_chunk_duration: int = typer.Option(
        15,
        "--max-chunk-duration",
        help="Maximum chunk duration in minutes for large files"
    ),
    
    video_quality: str = typer.Option(
        "360p",
        "--video-quality",
        help="Video compression quality for LLM analysis (360p, 480p, 720p)"
    ),
    version: bool = typer.Option(
        False,
        "--version",
        "-v",
        help="Show version information"
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        help="Show detailed technical information during processing"
    ),
    ipc_mode: bool = typer.Option(
        False,
        "--ipc-mode",
        help="Enable IPC mode for machine-readable JSON output"
    )
) -> None:
    """
    CantoSub - Generate Cantonese subtitles with intelligent model selection.
    
    This tool automatically selects the optimal Whisper model based on your hardware
    capabilities and extracts audio from video/audio files to generate accurate
    Cantonese subtitles using OpenAI Whisper speech recognition.
    
    Examples:
    
        # Basic usage (auto-selects optimal model)
        cantosub video.mp4
        
        # Prioritize speed over quality
        cantosub video.mp4 --priority speed
        
        # Prioritize quality over speed  
        cantosub video.mp4 --priority quality
        
        # Override with specific model
        cantosub video.mp4 --model openai/whisper-medium
        
        # Check hardware capabilities
        cantosub hardware
        
        # Enhanced features with Gemini Flash
        cantosub movie.mkv --speakers --written --music --gemini-key YOUR_API_KEY
    """
    # Set global IPC mode for error handling
    from ...infrastructure.error_handling import set_global_ipc_mode
    set_global_ipc_mode(ipc_mode)
    
    if version:
        from ... import __version__
        console.print(f"[bold blue]CantoSub[/bold blue] version [green]{__version__}[/green]")
        return
    
    # Check if we're in a subcommand context
    if ctx.invoked_subcommand is not None:
        return
    
    # Check if the input_file is actually a command name that should be handled as a subcommand
    if input_file is not None and str(input_file) in ['hardware', 'generate']:
        # This means the user typed 'hardware' or 'generate' but it was parsed as input_file
        # Let Typer handle it as a subcommand by returning early
        return
    
    # If no input file provided, show help
    if input_file is None:
        console.print(ctx.get_help())
        return
        
    # Call generate command directly
    generate_command(
        input_file=input_file,
        output_file=output_file,
        language=language,
        model=model,
        priority=priority,
        speakers=speakers,
        written=written,
        music=music,
        charset=charset,
        gemini_api_key=gemini_api_key,
        disable_gemini_refinement=disable_gemini_refinement,
        max_chunk_duration=max_chunk_duration,
        video_quality=video_quality,
        verbose=verbose,
        ipc_mode=ipc_mode
    )


if __name__ == "__main__":
    app()